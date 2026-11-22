/**
 * ============================================================================
 * 【檔案名稱】：modules/economy/economy_system.js
 * 【負責功能】：處理金幣扣款驗證、三元素獨立動態算價、賣塔退款計算、戰時移塔扣款與提前開波獎金。
 * 【讀取資料】：讀取 modules/economy/economy_data.js 的經濟數值表。
 * 【常見修改入口】：
 *   1. 修改動態召喚算價規則：修改 getSummonCost()。
 *   2. 修改賣塔退費或提前開波獎金算法：修改 getTowerSellRefund()、getEarlyWaveBonus()。
 * ============================================================================
 */
(function (global) {
    'use strict';

    const GameApp = global.GameApp = global.GameApp || {};
    let G = null;

    function bind(ctx) { G = ctx; }

    function getData() {
        return (GameApp.data && GameApp.data.economy) || {};
    }

    function hasMetaNode(nodeId) {
        const TreeSys = GameApp.systems && GameApp.systems.tree;
        if (TreeSys && typeof TreeSys.isMetaNodeUnlocked === 'function') {
            return TreeSys.isMetaNodeUnlocked(nodeId);
        }
        const bk = GameApp.backend || (GameApp.core && GameApp.core.backend);
        if (bk && typeof bk.loadMetaTreeState === 'function') {
            return bk.loadMetaTreeState().unlockedNodes.includes(nodeId);
        }
        return false;
    }

    function hasBlessingActive(blessingId) {
        const TreeSys = GameApp.systems && GameApp.systems.tree;
        return Boolean(TreeSys && typeof TreeSys.hasBlessing === 'function' && TreeSys.hasBlessing(blessingId));
    }

    function canTradeStocks() {
        return hasMetaNode('wealth_2');
    }

    function canOpenBlindBox() {
        return hasMetaNode('fate_1');
    }

    function canUseWager() {
        return hasMetaNode('fate_2');
    }

    function getStockSellFeeRate() {
        const d = getData();
        if (hasBlessingActive('insider_trading')) return 0;
        if (hasMetaNode('wealth_3')) return Number.isFinite(d.STOCK_SELL_FEE_META) ? d.STOCK_SELL_FEE_META : 0.02;
        return Number.isFinite(d.STOCK_SELL_FEE) ? d.STOCK_SELL_FEE : 0.05;
    }

    function getBlindBoxPityThreshold() {
        const d = getData();
        if (hasMetaNode('fate_3')) {
            return Number.isFinite(d.BLIND_BOX_PITY_STREAK_META) ? d.BLIND_BOX_PITY_STREAK_META : 2;
        }
        return Number.isFinite(d.BLIND_BOX_PITY_STREAK) ? d.BLIND_BOX_PITY_STREAK : 3;
    }

    function getInitialGold(mapSpec, contractsOverride = null) {
        const d = getData();
        const base = Number.isFinite(d.INITIAL_GOLD) ? d.INITIAL_GOLD : 40;
        const bonus = (mapSpec && Number.isFinite(mapSpec.startGoldBonus)) ? mapSpec.startGoldBonus : 0;
        const contracts = contractsOverride || (G && G.state && G.state.activeContracts);
        const penalty = (contracts && typeof contracts.has === 'function' && contracts.has('budget_crunch')) ? 15 : 0;
        return Math.max(10, base + bonus - penalty);
    }

    function resolveShopTypeKey(type) {
        if (GameApp.data && GameApp.data.towers && typeof GameApp.data.towers.getBaseShopKey === 'function') {
            return GameApp.data.towers.getBaseShopKey(type);
        }
        const raw = String(type || '');
        if (raw.startsWith('fire')) return 'fire';
        if (raw.startsWith('ice')) return 'ice';
        if (raw.startsWith('thunder')) return 'thunder';
        return raw;
    }

    /**
     * 計算指定元素下一次召喚所需金幣（支援 fire / fire_bud 雙向正規化查表）
     */
    function getSummonCost(type, spawnCountsOverride = null) {
        const d = getData();
        const shopKey = resolveShopTypeKey(type);
        const overrides = (d.ELEMENT_PRICE_OVERRIDES && (d.ELEMENT_PRICE_OVERRIDES[type] || d.ELEMENT_PRICE_OVERRIDES[shopKey])) || {};
        const maxCost = Number.isFinite(overrides.costMax) ? overrides.costMax : (d.COST_MAX ?? 65);
        const counts = spawnCountsOverride || (G && G.state && G.state.spawnCounts) || {};
        const rawCount = counts[type] !== undefined ? counts[type] : counts[shopKey];
        const count = Math.max(0, Math.floor(Number(rawCount) || 0));

        const steps = Array.isArray(overrides.costSteps)
            ? overrides.costSteps
            : (!Number.isFinite(overrides.baseCost) && Array.isArray(d.SUMMON_COST_STEPS) ? d.SUMMON_COST_STEPS : null);
        if (steps && steps.length > 0) {
            const rawStepCost = Number(steps[Math.min(count, steps.length - 1)]);
            if (Number.isFinite(rawStepCost)) {
                return Math.min(maxCost, Math.max(0, rawStepCost));
            }
        }

        const baseCost = Number.isFinite(overrides.baseCost) ? overrides.baseCost : (d.BASE_COST ?? 10);
        const step = Number.isFinite(overrides.costStep) ? overrides.costStep : (d.COST_STEP ?? 8);
        return Math.min(maxCost, baseCost + count * step);
    }

    function canAffordSummon(type, currentGoldOverride = null, spawnCountsOverride = null) {
        const gold = currentGoldOverride !== null ? currentGoldOverride : (G && G.state ? G.state.currentGold : 0);
        const cost = getSummonCost(type, spawnCountsOverride);
        return gold >= cost;
    }

    function deductSummonCost(type) {
        if (!G || !G.state) return { ok: false, cost: 0 };
        const st = G.state;
        const shopKey = resolveShopTypeKey(type);
        const cost = getSummonCost(type, st.spawnCounts);
        if (st.currentGold < cost) return { ok: false, cost };
        st.currentGold -= cost;
        const nextCount = (Number(st.spawnCounts[shopKey] ?? st.spawnCounts[type]) || 0) + 1;
        st.spawnCounts[shopKey] = nextCount;
        st.spawnCounts[type] = nextCount;
        st.spawnCounts[`${shopKey}_bud`] = nextCount;
        return { ok: true, cost };
    }

    function getSellRefundRate(rootLevelOverride = null) {
        const d = getData();
        const lv = rootLevelOverride !== null
            ? Number(rootLevelOverride)
            : ((G && G.state && Number.isFinite(G.state.rootLevel)) ? G.state.rootLevel : 0);
        if (lv >= 2) {
            return Number.isFinite(d.SELL_REFUND_RATE_LV2) ? d.SELL_REFUND_RATE_LV2 : 0.80;
        }
        return Number.isFinite(d.SELL_REFUND_RATE) ? d.SELL_REFUND_RATE : 0.70;
    }

    function getTowerSellRefund(towerObj, rootLevelOverride = null) {
        if (!towerObj) return 0;
        const d = getData();
        const baseCost = d.BASE_COST ?? 10;
        const refundRate = getSellRefundRate(rootLevelOverride);
        const fallback = baseCost * Math.pow(2, Math.max(0, (towerObj.tier || 1) - 1));
        const invested = Number.isFinite(towerObj.investedGold) ? towerObj.investedGold : fallback;
        return Math.floor(invested * refundRate + 1e-9);
    }

    /**
     * 單波非戰鬥淨收益軟上限：maxNonCombatGain(w) = 22 + 8 * w
     */
    function maxNonCombatGain(waveNum = null) {
        const d = getData();
        const base = Number.isFinite(d.NON_COMBAT_GAIN_BASE) ? d.NON_COMBAT_GAIN_BASE : 22;
        const perWave = Number.isFinite(d.NON_COMBAT_GAIN_PER_WAVE) ? d.NON_COMBAT_GAIN_PER_WAVE : 8;
        const rawW = waveNum !== null ? waveNum : (G && G.state ? G.state.currentWave : 1);
        const w = Math.max(1, Math.floor(Number(rawW) || 1));
        return base + perWave * w;
    }

    /**
     * 無盡靈脈灌注第 k 次費用：150 + 75 * k
     */
    function getInfusionCost(k = 1) {
        const d = getData();
        const base = Number.isFinite(d.INFUSION_BASE_COST) ? d.INFUSION_BASE_COST : 150;
        const step = Number.isFinite(d.INFUSION_STEP_COST) ? d.INFUSION_STEP_COST : 75;
        const count = Math.max(1, Math.floor(Number(k) || 1));
        return base + step * count;
    }

    /**
     * 計算聚寶根鬚（Lv.0 → Lv.3）於指定波次的波末產出明細（受單波非戰鬥淨收益軟上限 22 + 8w 約束）
     */
    function computeRootWaveIncome(rootLevel = null, currentGold = null, waveNum = null) {
        const d = getData();
        const lv = rootLevel !== null
            ? Math.max(0, Math.min(3, Math.floor(Number(rootLevel) || 0)))
            : ((G && G.state && Number.isFinite(G.state.rootLevel)) ? G.state.rootLevel : 0);
        const gold = currentGold !== null
            ? Math.max(0, Number(currentGold) || 0)
            : ((G && G.state && Number.isFinite(G.state.currentGold)) ? G.state.currentGold : 0);
        const w = waveNum !== null
            ? Math.max(1, Math.floor(Number(waveNum) || 1))
            : ((G && G.state && Number.isFinite(G.state.currentWave)) ? G.state.currentWave : 1);

        const waveCap = maxNonCombatGain(w);
        const fixedArr = Array.isArray(d.TREASURE_ROOTS_FIXED_GAIN) ? d.TREASURE_ROOTS_FIXED_GAIN : [0, 15, 32, 42];
        const interestRate = Number.isFinite(d.TREASURE_ROOTS_LV3_INTEREST_RATE) ? d.TREASURE_ROOTS_LV3_INTEREST_RATE : 0.08;
        const interestCap = Number.isFinite(d.TREASURE_ROOTS_LV3_INTEREST_CAP) ? d.TREASURE_ROOTS_LV3_INTEREST_CAP : 35;

        if (lv <= 0) {
            return {
                level: 0,
                wave: w,
                fixedGain: 0,
                rawInterest: 0,
                uncappedGain: 0,
                waveCap,
                baseGain: 0,
                interestGain: 0,
                totalGain: 0,
                isInterestCapped: false,
                isSoftCapped: false
            };
        }

        const fixedGain = Number(fixedArr[lv]) || (lv === 1 ? 15 : (lv === 2 ? 32 : 42));
        const unClampedInterest = lv >= 3 ? Math.floor(gold * interestRate + 1e-9) : 0;
        const rawInterest = lv >= 3 ? Math.min(interestCap, unClampedInterest) : 0;
        const uncappedGain = fixedGain + rawInterest;
        const totalGain = Math.min(waveCap, uncappedGain);
        const baseGain = Math.min(waveCap, fixedGain);
        const interestGain = Math.max(0, totalGain - baseGain);

        return {
            level: lv,
            wave: w,
            fixedGain,
            rawInterest,
            uncappedGain,
            waveCap,
            baseGain,
            interestGain,
            totalGain,
            isInterestCapped: lv >= 3 && unClampedInterest > interestCap,
            isSoftCapped: uncappedGain > waveCap
        };
    }

    function getCombatMoveCost() {
        const d = getData();
        return Number.isFinite(d.COMBAT_MOVE_COST) ? d.COMBAT_MOVE_COST : 5;
    }

    function canAffordCombatMove(isRelocationFree) {
        if (isRelocationFree) return true;
        const st = G && G.state;
        return Boolean(st && st.currentGold >= getCombatMoveCost());
    }

    function getObstacleClearCost() {
        const d = getData();
        return Number.isFinite(d.OBSTACLE_CLEAR_COST) ? d.OBSTACLE_CLEAR_COST : 45;
    }

    function canAffordObstacleClear() {
        const st = G && G.state;
        return Boolean(st && st.currentGold >= getObstacleClearCost());
    }

    function getCrownAwakenCost() {
        const d = getData();
        return {
            gold: Number.isFinite(d.CROWN_AWAKEN_GOLD_COST) ? d.CROWN_AWAKEN_GOLD_COST : 220,
            dew: Number.isFinite(d.CROWN_AWAKEN_DEW_COST) ? d.CROWN_AWAKEN_DEW_COST : 60
        };
    }

    function canAffordCrownAwaken() {
        const st = G && G.state;
        if (!st) return false;
        const cost = getCrownAwakenCost();
        return st.currentGold >= cost.gold && st.dewEnergy >= cost.dew;
    }

    function getEarlyWaveBonus(remainingMs = null) {
        const d = getData();
        const cfg = d.EARLY_WAVE_BONUS || { BASE_BONUS: 2, PER_SECOND_RATE: 1.5, MAX_BONUS: 15 };
        const ms = remainingMs !== null ? remainingMs : (G && G.state ? G.state.waveTimerMs : 0);
        return Math.min(cfg.MAX_BONUS ?? 15, (cfg.BASE_BONUS ?? 2) + Math.floor((cfg.PER_SECOND_RATE ?? 1.5) * Math.max(0, ms / 1000)));
    }

    function computeKillGold(baseReward, mapSpec) {
        if (!Number.isFinite(baseReward) || baseReward <= 0) return 0;
        const d = getData();
        const mult = (mapSpec && Number.isFinite(mapSpec.killGoldMult)) ? mapSpec.killGoldMult : 1.0;
        const isSurgeActive = Boolean(G && G.state && G.state.activeWager && G.state.activeWager.type === 'monster_surge');
        const surgeMult = isSurgeActive ? (Number.isFinite(d.WAGER_SURGE_KILL_GOLD_MULT) ? d.WAGER_SURGE_KILL_GOLD_MULT : 1.45) : 1.0;
        return Math.max(1, Math.round(baseReward * mult * surgeMult));
    }

    // ==================== 單波非戰鬥淨收益軟上限帳本（maxNonCombatGain(w) = 22 + 8w） ====================
    function ensureWaveNonCombatLedger(waveNum = null) {
        const rawW = waveNum !== null ? waveNum : (G && G.state ? G.state.currentWave : 1);
        const w = Math.max(1, Math.floor(Number(rawW) || 1));
        if (G && G.state) {
            if (G.state.nonCombatLedgerWave !== w) {
                G.state.nonCombatLedgerWave = w;
                G.state.waveNonCombatGold = 0;
            }
        }
        return w;
    }

    function getRemainingNonCombatCap(waveNum = null) {
        const w = ensureWaveNonCombatLedger(waveNum);
        const cap = maxNonCombatGain(w);
        const used = (G && G.state && Number.isFinite(G.state.waveNonCombatGold)) ? Math.max(0, G.state.waveNonCombatGold) : 0;
        return Math.max(0, cap - used);
    }

    function recordNonCombatNetGain(rawNetAmount, waveNum = null) {
        const w = ensureWaveNonCombatLedger(waveNum);
        const req = Math.max(0, Math.round(Number(rawNetAmount) || 0));
        const rem = getRemainingNonCombatCap(w);
        const allowed = Math.min(rem, req);
        if (G && G.state && allowed > 0) {
            G.state.waveNonCombatGold = (G.state.waveNonCombatGold || 0) + allowed;
        }
        return {
            wave: w,
            requested: req,
            granted: allowed,
            waveCap: maxNonCombatGain(w),
            usedAfter: (G && G.state && G.state.waveNonCombatGold) || allowed,
            remainingAfter: Math.max(0, rem - allowed),
            isSoftCapped: req > rem
        };
    }

    // ==================== A. 元素股市（🔥火股、❄️冰股、⚡雷股） ====================
    const STOCK_ELEMENTS = ['fire', 'ice', 'thunder'];

    function createInitialStockState() {
        const d = getData();
        const initPrice = Number.isFinite(d.STOCK_INITIAL_PRICE) ? d.STOCK_INITIAL_PRICE : 20;
        const stocks = {};
        STOCK_ELEMENTS.forEach((el) => {
            stocks[el] = {
                element: el,
                price: initPrice,
                prevPrice: initPrice,
                lastDelta: 0,
                shares: 0,
                totalCost: 0,
                weaknessRatio: 1 / 3,
                muIntel: 0,
                trend: 'neutral' // 'bull' | 'bear' | 'neutral'
            };
        });
        return stocks;
    }

    /**
     * 根據「下波預告」中弱點為該元素的怪物占比 r_e (0 ~ 1) 計算內線趨勢訊號：
     *   mu_intel = 0.24 * (r_e - 1/3)
     */
    function computeStockIntelSignal(r_e) {
        const d = getData();
        const coeff = Number.isFinite(d.STOCK_INTEL_COEFF) ? d.STOCK_INTEL_COEFF : 0.24;
        const ratio = Math.max(0, Math.min(1, Number(r_e) || 0));
        return coeff * (ratio - (1 / 3));
    }

    /**
     * 掃描指定波次的出怪佇列，回傳三元素弱點占比 r_e (0 ~ 1)
     */
    function getWaveElementWeaknessRatios(waveNum = null) {
        const WaveSys = GameApp.systems && GameApp.systems.wave;
        const monsterDb = (GameApp.data && GameApp.data.monsters && GameApp.data.monsters.MONSTER_DATABASE) || {};
        const st = G && G.state;
        const targetWave = waveNum !== null
            ? Math.max(1, Math.floor(Number(waveNum) || 1))
            : (st ? (st.waveState === 'INTERMISSION' ? (st.currentWave || 1) + 1 : (st.currentWave || 1)) : 1);

        const plan = (WaveSys && typeof WaveSys.buildWaveQueue === 'function')
            ? WaveSys.buildWaveQueue(targetWave)
            : { queue: [] };
        const queue = Array.isArray(plan.queue) ? plan.queue : [];
        const counts = { fire: 0, ice: 0, thunder: 0 };
        let total = 0;

        for (let i = 0; i < queue.length; i++) {
            const entry = queue[i];
            if (!entry || entry.isTreasureThief || entry.typeKey === 'thief') continue;
            const mCfg = monsterDb[entry.typeKey] || {};
            const weak = (entry.isBoss && entry.bossSpec && entry.bossSpec.weakness)
                || mCfg.weakness
                || 'fire';
            const weight = entry.isBoss ? 3 : (entry.isElite ? 1.5 : 1);
            if (counts[weak] !== undefined) {
                counts[weak] += weight;
                total += weight;
            }
        }

        if (total <= 0) {
            return { wave: targetWave, fire: 1 / 3, ice: 1 / 3, thunder: 1 / 3 };
        }
        return {
            wave: targetWave,
            fire: counts.fire / total,
            ice: counts.ice / total,
            thunder: counts.thunder / total
        };
    }

    function refreshStockForecastSignals(forecastWaveNum = null) {
        if (!G || !G.state) return null;
        if (!G.state.stocks) G.state.stocks = createInitialStockState();
        const st = G.state;
        const targetWave = forecastWaveNum !== null
            ? Math.max(1, Math.floor(Number(forecastWaveNum) || 1))
            : ((st.waveState === 'SPAWNING' || st.waveState === 'CLEARING' || st.waveState === 'INTERMISSION')
                ? (st.currentWave || 1) + 1
                : (st.currentWave || 1));
        const ratios = getWaveElementWeaknessRatios(targetWave);

        STOCK_ELEMENTS.forEach((el) => {
            const rec = st.stocks[el];
            if (!rec) return;
            const r_e = Number.isFinite(ratios[el]) ? ratios[el] : (1 / 3);
            const mu = computeStockIntelSignal(r_e);
            rec.weaknessRatio = r_e;
            rec.muIntel = mu;
            rec.trend = mu > 0.012 ? 'bull' : (mu < -0.012 ? 'bear' : 'neutral');
            rec.forecastWave = targetWave;
        });
        return st.stocks;
    }

    /**
     * 波末結算更新下一波股價（依下波預告 mu_intel = 0.24 * (r_e - 1/3) 搭配受控溫和波動，限制區間 [10, 60]）
     */
    function settleWaveStocks(nextWaveNum = null, options = {}) {
        if (!G || !G.state) return null;
        const st = G.state;
        const d = getData();
        if (!st.stocks) st.stocks = createInitialStockState();

        const minPrice = Number.isFinite(d.STOCK_MIN_PRICE) ? d.STOCK_MIN_PRICE : 10;
        const maxPrice = Number.isFinite(d.STOCK_MAX_PRICE) ? d.STOCK_MAX_PRICE : 60;
        const noiseAmp = Number.isFinite(options.noiseAmp)
            ? options.noiseAmp
            : (Number.isFinite(d.STOCK_NOISE_AMP) ? d.STOCK_NOISE_AMP : 0.025);

        const targetWave = nextWaveNum !== null
            ? Math.max(1, Math.floor(Number(nextWaveNum) || 1))
            : (st.currentWave || 1) + 1;
        const ratios = options.ratiosOverride || getWaveElementWeaknessRatios(targetWave);

        const changes = {};
        STOCK_ELEMENTS.forEach((el) => {
            const rec = st.stocks[el];
            const prevPrice = Number(rec.price) || 20;
            const r_e = Number.isFinite(ratios[el]) ? ratios[el] : (1 / 3);
            const mu_intel = computeStockIntelSignal(r_e);
            const rawNoise = options.deterministic ? 0 : ((Math.random() * 2 - 1) * noiseAmp);
            let effectiveRate = mu_intel + rawNoise;
            // 控制噪聲幅度，避免預告訊號反轉失靈
            if (mu_intel > 0.012) {
                effectiveRate = Math.max(0.018, effectiveRate);
            } else if (mu_intel < -0.012) {
                effectiveRate = Math.min(-0.018, effectiveRate);
            }

            let nextPrice = Math.round(prevPrice * (1 + effectiveRate));
            if (mu_intel > 0.015 && nextPrice <= prevPrice && prevPrice < maxPrice) {
                nextPrice = prevPrice + 1;
            } else if (mu_intel < -0.015 && nextPrice >= prevPrice && prevPrice > minPrice) {
                nextPrice = prevPrice - 1;
            }
            nextPrice = Math.min(maxPrice, Math.max(minPrice, nextPrice));

            rec.prevPrice = prevPrice;
            rec.price = nextPrice;
            rec.lastDelta = nextPrice - prevPrice;
            rec.weaknessRatio = r_e;
            rec.muIntel = mu_intel;
            rec.trend = mu_intel > 0.012 ? 'bull' : (mu_intel < -0.012 ? 'bear' : 'neutral');
            rec.forecastWave = targetWave;
            changes[el] = {
                prevPrice,
                nextPrice,
                delta: rec.lastDelta,
                r_e,
                mu_intel,
                trend: rec.trend
            };
        });

        return changes;
    }

    function grantRandomStockShare(options = {}) {
        if (!G || !G.state) return { ok: false, reason: 'no_runtime' };
        const st = G.state;
        const d = getData();
        if (!st.stocks) st.stocks = createInitialStockState();
        const maxShares = Number.isFinite(d.STOCK_MAX_SHARES) ? d.STOCK_MAX_SHARES : 10;
        const candidates = STOCK_ELEMENTS.filter(el => st.stocks[el] && (st.stocks[el].shares || 0) < maxShares);
        if (candidates.length === 0) return { ok: false, reason: 'all_max_shares' };
        const picked = options.elementKey && candidates.includes(options.elementKey)
            ? options.elementKey
            : candidates[Math.floor(Math.random() * candidates.length)];
        const rec = st.stocks[picked];
        rec.shares += 1;
        return {
            ok: true,
            element: picked,
            shares: rec.shares,
            dividendBonus: getElementDividendBonus(picked)
        };
    }

    function buyStock(elementKey) {
        if (!G || !G.state) return { ok: false, reason: 'no_runtime' };
        if (!canTradeStocks()) return { ok: false, reason: 'meta_locked', metaNode: 'wealth_2' };
        const st = G.state;
        const d = getData();
        if (!st.stocks) st.stocks = createInitialStockState();
        const rec = st.stocks[elementKey];
        if (!rec) return { ok: false, reason: 'invalid_element' };

        const maxShares = Number.isFinite(d.STOCK_MAX_SHARES) ? d.STOCK_MAX_SHARES : 10;
        if (rec.shares >= maxShares) {
            return { ok: false, reason: 'max_shares', shares: rec.shares, maxShares };
        }
        const price = Math.max(10, Math.min(60, Math.round(Number(rec.price) || 20)));
        if (st.currentGold < price) {
            return { ok: false, reason: 'insufficient_gold', price, currentGold: st.currentGold };
        }

        st.currentGold -= price;
        rec.shares += 1;
        rec.totalCost = (rec.totalCost || 0) + price;
        return {
            ok: true,
            element: elementKey,
            price,
            shares: rec.shares,
            totalCost: rec.totalCost,
            dividendBonus: getElementDividendBonus(elementKey)
        };
    }

    function sellStock(elementKey, waveNum = null) {
        if (!G || !G.state) return { ok: false, reason: 'no_runtime' };
        if (!canTradeStocks()) return { ok: false, reason: 'meta_locked', metaNode: 'wealth_2' };
        const st = G.state;
        const d = getData();
        if (!st.stocks) st.stocks = createInitialStockState();
        const rec = st.stocks[elementKey];
        if (!rec || rec.shares <= 0) {
            return { ok: false, reason: 'no_shares', shares: 0 };
        }

        const feeRate = getStockSellFeeRate();
        const price = Math.max(10, Math.min(60, Math.round(Number(rec.price) || 20)));
        const fee = feeRate <= 0 ? 0 : Math.max(1, Math.round(price * feeRate));
        const grossSell = Math.max(1, price - fee);
        const avgCost = (rec.totalCost || 0) / Math.max(1, rec.shares);
        const principal = Math.min(grossSell, avgCost);
        const rawProfit = Math.max(0, grossSell - avgCost);

        let allowedProfit = 0;
        let isSoftCapped = false;
        if (rawProfit > 0) {
            const capRes = recordNonCombatNetGain(rawProfit, waveNum);
            allowedProfit = capRes.granted;
            isSoftCapped = capRes.isSoftCapped;
        }

        const payout = Math.max(1, Math.round(principal + allowedProfit));
        rec.shares -= 1;
        rec.totalCost = rec.shares > 0 ? Math.max(0, Math.round(rec.totalCost - avgCost)) : 0;
        st.currentGold += payout;
        if (allowedProfit > 0) {
            st.totalGoldEarned = (st.totalGoldEarned || 0) + allowedProfit;
        }

        return {
            ok: true,
            element: elementKey,
            price,
            fee,
            grossSell,
            payout,
            netProfit: allowedProfit,
            rawProfit: Math.round(rawProfit),
            isSoftCapped,
            shares: rec.shares,
            dividendBonus: getElementDividendBonus(elementKey)
        };
    }

    function getElementDividendBonus(elementKey) {
        const d = getData();
        const perShare = hasBlessingActive('insider_trading')
            ? 0.030
            : (Number.isFinite(d.STOCK_DIVIDEND_PER_SHARE) ? d.STOCK_DIVIDEND_PER_SHARE : 0.024);
        const cap = Number.isFinite(d.STOCK_DIVIDEND_CAP) ? d.STOCK_DIVIDEND_CAP : 0.24;
        const rec = G && G.state && G.state.stocks && G.state.stocks[elementKey];
        const shares = rec ? Math.max(0, Math.min(10, Math.floor(Number(rec.shares) || 0))) : 0;
        return Math.min(cap, Number((shares * perShare).toFixed(4)));
    }

    /**
     * 計算指定防禦塔獲得的持股紅利 b_dividend（每 1 股 +0.024，上限 +0.24）
     */
    function getTowerDividendBonus(towerObj) {
        if (!towerObj || !G || !G.state || !G.state.stocks) return 0;
        const d = getData();
        const cap = Number.isFinite(d.STOCK_DIVIDEND_CAP) ? d.STOCK_DIVIDEND_CAP : 0.24;
        const towersDict = (GameApp.data && GameApp.data.towers && GameApp.data.towers.TOWERS) || {};
        const cfg = towersDict[towerObj.type] || {};
        const elemTag = cfg.elementTag || resolveShopTypeKey(towerObj.type);

        if (STOCK_ELEMENTS.includes(elemTag)) {
            return getElementDividendBonus(elemTag);
        }
        const lineages = Array.isArray(cfg.lineageTags) ? cfg.lineageTags : [];
        let best = 0;
        for (let i = 0; i < lineages.length; i++) {
            if (STOCK_ELEMENTS.includes(lineages[i])) {
                best = Math.max(best, getElementDividendBonus(lineages[i]));
            }
        }
        return Math.min(cap, best);
    }

    // ==================== B. 命運種子盲盒（自適應定價 + 4 抽必出保底 + 防刷錢鎖） ====================
    function getAverageShopCost(spawnCountsOverride = null) {
        const costs = STOCK_ELEMENTS.map(el => getSummonCost(el, spawnCountsOverride));
        const sum = costs.reduce((acc, c) => acc + c, 0);
        return sum / Math.max(1, costs.length);
    }

    /**
     * 盲盒自適應定價：boxCost = clamp(Math.round(1.15 * avgShopCost), 35, 85)
     */
    function getBlindBoxCost(avgShopCostOverride = null, spawnCountsOverride = null) {
        const d = getData();
        const mult = Number.isFinite(d.BLIND_BOX_COST_MULT) ? d.BLIND_BOX_COST_MULT : 1.15;
        const minCost = Number.isFinite(d.BLIND_BOX_MIN_COST) ? d.BLIND_BOX_MIN_COST : 35;
        const maxCost = Number.isFinite(d.BLIND_BOX_MAX_COST) ? d.BLIND_BOX_MAX_COST : 85;
        const avgCost = Number.isFinite(avgShopCostOverride)
            ? avgShopCostOverride
            : getAverageShopCost(spawnCountsOverride);
        const raw = Math.round(mult * avgCost);
        return Math.min(maxCost, Math.max(minCost, raw));
    }

    function pickRandomFromArray(arr, randVal = null) {
        if (!Array.isArray(arr) || arr.length === 0) return null;
        const r = Number.isFinite(randVal) ? Math.max(0, Math.min(0.999999, randVal)) : Math.random();
        return arr[Math.floor(r * arr.length)];
    }

    /**
     * 抽取命運種子盲盒結果：
     *   - 機率分布：1★ 塔 48%、2★ 塔 32%、萬能融合果實 12%、3★ 塔 8%
     *   - 保底機制：連續 3 次只開出 1★ 時，第 4 次必出 2★ 以上（其中 25% 機率直出 3★）
     *   - 每次未出 2★ 以上為全隊疊加 +1.5% 暴擊率（上限 +15%）
     */
    function rollBlindBoxOutcome(options = {}) {
        const d = getData();
        const st = G && G.state;
        const pityThreshold = getBlindBoxPityThreshold();
        const pityT3Chance = Number.isFinite(d.BLIND_BOX_PITY_TIER3_CHANCE) ? d.BLIND_BOX_PITY_TIER3_CHANCE : 0.25;
        const critStep = hasBlessingActive('gambler_lucky_leaf')
            ? 0.02
            : (Number.isFinite(d.BLIND_BOX_CRIT_BONUS_STEP) ? d.BLIND_BOX_CRIT_BONUS_STEP : 0.015);
        const critCap = Number.isFinite(d.BLIND_BOX_CRIT_BONUS_CAP) ? d.BLIND_BOX_CRIT_BONUS_CAP : 0.15;

        const t1Pool = ['fire_bud', 'ice_bud', 'thunder_bud'];
        const t2Pool = ['fire_trunk', 'ice_trunk', 'thunder_trunk', 'steam_trunk', 'magnet_trunk', 'plasma_trunk'];
        const t3Pool = ['fire_A', 'fire_B', 'ice_A', 'ice_B', 'thunder_A', 'thunder_B', 'steam_A', 'steam_B', 'magnet_A', 'magnet_B', 'plasma_A', 'plasma_B'];

        const streak = st ? Math.max(0, Number(st.blindBox1StarStreak) || 0) : 0;
        const isPityTriggered = Boolean(options.forcePity || streak >= pityThreshold);
        const r = Number.isFinite(options.rollValue) ? options.rollValue : Math.random();

        let kind = 'tower';
        let tier = 1;
        let towerType = null;

        if (options.forceOutcome) {
            if (options.forceOutcome === 'fruit') {
                kind = 'fruit';
                tier = 0;
            } else if (options.forceOutcome === 'tier3') {
                kind = 'tower';
                tier = 3;
            } else if (options.forceOutcome === 'tier2') {
                kind = 'tower';
                tier = 2;
            } else {
                kind = 'tower';
                tier = 1;
            }
        } else if (isPityTriggered) {
            // 連續 3 次 1★ 後第 4 抽必出 2★ 以上（25% 直出 3★，75% 出 2★）
            kind = 'tower';
            tier = r < pityT3Chance ? 3 : 2;
        } else {
            // 1★: 0~0.48 (48%), 2★: 0.48~0.80 (32%), 萬能果實: 0.80~0.92 (12%), 3★: 0.92~1.00 (8%)
            if (r < 0.48) {
                kind = 'tower';
                tier = 1;
            } else if (r < 0.80) {
                kind = 'tower';
                tier = 2;
            } else if (r < 0.92) {
                const fruitFull = Boolean(st && (st.fusionFruitCount || 0) >= 1 && !options.allowFruitOverflow);
                if (fruitFull) {
                    kind = 'tower';
                    tier = 2;
                } else {
                    kind = 'fruit';
                    tier = 0;
                }
            } else {
                kind = 'tower';
                tier = 3;
            }
        }

        if (kind === 'tower') {
            const pool = tier === 3 ? t3Pool : (tier === 2 ? t2Pool : t1Pool);
            towerType = options.towerTypeOverride || pickRandomFromArray(pool, options.subRollValue);
        }

        const isTwoStarOrAbove = kind === 'tower' && tier >= 2;
        if (st && options.commitState !== false) {
            if (kind === 'tower' && tier === 1) {
                st.blindBox1StarStreak = streak + 1;
            } else if (isTwoStarOrAbove) {
                st.blindBox1StarStreak = 0;
            }
            if (!isTwoStarOrAbove) {
                st.teamCritBonusRate = Math.min(critCap, Number(((st.teamCritBonusRate || 0) + critStep).toFixed(4)));
            }
        }

        return {
            kind,
            tier,
            towerType,
            isPityTriggered,
            isTwoStarOrAbove,
            streakAfter: st ? st.blindBox1StarStreak : (kind === 'tower' && tier === 1 ? streak + 1 : 0),
            teamCritBonusRate: st ? (st.teamCritBonusRate || 0) : 0
        };
    }

    // ==================== C. 波次對賭懸賞（零封懸賞 / 魔潮加碼） ====================
    function canSelectWaveWager() {
        if (!G || !G.state) return false;
        const st = G.state;
        return !st.isGameOver && (st.waveState === 'PREP' || st.waveState === 'INTERMISSION');
    }

    function cancelWaveWager() {
        if (!G || !G.state || !G.state.activeWager) return { ok: false, reason: 'no_active_wager' };
        const st = G.state;
        if (!canSelectWaveWager()) {
            return { ok: false, reason: 'wave_already_started' };
        }
        const prev = st.activeWager;
        if (prev.type === 'zero_leak' && prev.stake > 0) {
            st.currentGold += prev.stake;
        } else if (prev.type === 'monster_surge' && prev.countedUsage) {
            st.surgeWagerUsedCount = Math.max(0, (st.surgeWagerUsedCount || 0) - 1);
        }
        st.activeWager = null;
        return { ok: true, cancelledType: prev.type, refundedStake: prev.stake || 0 };
    }

    function selectWaveWager(wagerType) {
        if (!G || !G.state) return { ok: false, reason: 'no_runtime' };
        if (!canUseWager()) return { ok: false, reason: 'meta_locked', metaNode: 'fate_2' };
        const st = G.state;
        const d = getData();
        if (!canSelectWaveWager()) {
            return { ok: false, reason: 'not_in_prep_phase' };
        }

        // 若點擊目前已選中的同一懸賞，則取消選取並退回押金/次數
        if (st.activeWager && st.activeWager.type === wagerType) {
            return cancelWaveWager();
        }

        if (wagerType === 'zero_leak') {
            const stake = Number.isFinite(d.WAGER_ZERO_LEAK_STAKE) ? d.WAGER_ZERO_LEAK_STAKE : 40;
            const potentialGold = st.currentGold + ((st.activeWager && st.activeWager.type === 'zero_leak') ? st.activeWager.stake : 0);
            if (potentialGold < stake) {
                return { ok: false, reason: 'insufficient_gold', stake, currentGold: st.currentGold };
            }
            if (st.activeWager) cancelWaveWager();
            st.currentGold -= stake;
            st.activeWager = {
                type: 'zero_leak',
                stake,
                leakedThisWave: false,
                startBaseHp: st.baseHp
            };
            return { ok: true, type: 'zero_leak', stake };
        }

        if (wagerType === 'monster_surge') {
            const maxUses = Number.isFinite(d.WAGER_SURGE_MAX_PER_RUN) ? d.WAGER_SURGE_MAX_PER_RUN : 2;
            const used = st.surgeWagerUsedCount || 0;
            if (used >= maxUses) {
                return { ok: false, reason: 'max_uses_reached', used, maxUses };
            }
            if (st.activeWager) cancelWaveWager();
            st.surgeWagerUsedCount = used + 1;
            st.activeWager = {
                type: 'monster_surge',
                stake: 0,
                countedUsage: true,
                hpMult: Number.isFinite(d.WAGER_SURGE_HP_MULT) ? d.WAGER_SURGE_HP_MULT : 1.25,
                speedMult: Number.isFinite(d.WAGER_SURGE_SPEED_MULT) ? d.WAGER_SURGE_SPEED_MULT : 1.10,
                killGoldMult: Number.isFinite(d.WAGER_SURGE_KILL_GOLD_MULT) ? d.WAGER_SURGE_KILL_GOLD_MULT : 1.45
            };
            return {
                ok: true,
                type: 'monster_surge',
                usedCount: st.surgeWagerUsedCount,
                remainingUses: Math.max(0, maxUses - st.surgeWagerUsedCount)
            };
        }

        return { ok: false, reason: 'invalid_wager_type' };
    }

    function onWaveMonsterLeaked() {
        if (!G || !G.state) return;
        G.state.waveLeakedCount = (G.state.waveLeakedCount || 0) + 1;
        if (G.state.activeWager) {
            G.state.activeWager.leakedThisWave = true;
        }
    }

    function settleWaveWager(waveNum = null) {
        if (!G || !G.state || !G.state.activeWager) return null;
        const st = G.state;
        const d = getData();
        const w = waveNum !== null ? Math.max(1, Math.floor(Number(waveNum) || 1)) : Math.max(1, st.currentWave || 1);
        const wager = st.activeWager;
        st.activeWager = null;

        if (wager.type === 'zero_leak') {
            const stake = Number(wager.stake) || 40;
            const luckyBonus = hasBlessingActive('gambler_lucky_leaf') ? 10 : 0;
            const rawNetProfit = (Number.isFinite(d.WAGER_ZERO_LEAK_NET_PROFIT) ? d.WAGER_ZERO_LEAK_NET_PROFIT : 30) + luckyBonus;
            const failDew = Number.isFinite(d.WAGER_ZERO_LEAK_FAIL_DEW) ? d.WAGER_ZERO_LEAK_FAIL_DEW : 15;
            const leaked = Boolean(wager.leakedThisWave || (st.waveLeakedCount || 0) > 0 || (Number.isFinite(wager.startBaseHp) && st.baseHp < wager.startBaseHp));

            if (!leaked) {
                const capRes = recordNonCombatNetGain(rawNetProfit, w);
                const netGain = capRes.granted;
                const totalReturn = stake + netGain;
                st.currentGold += totalReturn;
                st.totalGoldEarned = (st.totalGoldEarned || 0) + netGain;
                const capNoteZh = capRes.isSoftCapped ? `，受單波軟上限 ${capRes.waveCap} 💰 約束` : '';
                const capNoteEn = capRes.isSoftCapped ? `, capped at ${capRes.waveCap} 💰` : '';
                return {
                    type: 'zero_leak',
                    success: true,
                    stake,
                    netGain,
                    totalReturn,
                    dewComp: 0,
                    isSoftCapped: capRes.isSoftCapped,
                    summaryZh: `零封懸賞成功：返還 ${totalReturn} 💰（淨賺 +${netGain} 💰${capNoteZh}）`,
                    summaryEn: `Zero-Leak Bounty Won: Returned ${totalReturn} 💰 (Net +${netGain} 💰${capNoteEn})`
                };
            }

            const dewMax = (GameApp.data && GameApp.data.tree && GameApp.data.tree.TREE_CONFIG && GameApp.data.tree.TREE_CONFIG.DEW_MAX) || 120;
            st.dewEnergy = Math.min(dewMax, (st.dewEnergy || 0) + failDew);
            return {
                type: 'zero_leak',
                success: false,
                stake,
                netGain: -stake,
                totalReturn: 0,
                dewComp: failDew,
                isSoftCapped: false,
                summaryZh: `零封懸賞失敗：押金 ${stake} 💰 沒收，補償 +${failDew} 💧`,
                summaryEn: `Zero-Leak Bounty Failed: ${stake} 💰 forfeited, compensated +${failDew} 💧`
            };
        }

        if (wager.type === 'monster_surge') {
            const maxSlots = Number.isFinite(d.FUSION_FRUIT_MAX_SLOTS) ? d.FUSION_FRUIT_MAX_SLOTS : 1;
            const prevFruits = st.fusionFruitCount || 0;
            st.fusionFruitCount = Math.min(maxSlots, prevFruits + 1);
            const fruitGained = st.fusionFruitCount - prevFruits;
            return {
                type: 'monster_surge',
                success: true,
                fruitGained,
                fusionFruitCount: st.fusionFruitCount,
                summaryZh: `魔潮加碼守住：本波擊殺賞金 ×1.45 結算完成，獲得 +1 顆萬能融合果實`,
                summaryEn: `Monster Surge Cleared: ×1.45 kill bounty & +1 Universal Fusion Fruit earned`
            };
        }

        return null;
    }

    const EconomySystem = {
        bind,
        getInitialGold,
        getSummonCost,
        canAffordSummon,
        deductSummonCost,
        getSellRefundRate,
        getTowerSellRefund,
        maxNonCombatGain,
        getInfusionCost,
        computeRootWaveIncome,
        getCombatMoveCost,
        canAffordCombatMove,
        getObstacleClearCost,
        canAffordObstacleClear,
        getCrownAwakenCost,
        canAffordCrownAwaken,
        getEarlyWaveBonus,
        computeKillGold,
        ensureWaveNonCombatLedger,
        getRemainingNonCombatCap,
        recordNonCombatNetGain,
        canTradeStocks,
        canOpenBlindBox,
        canUseWager,
        getStockSellFeeRate,
        getBlindBoxPityThreshold,
        grantRandomStockShare,
        createInitialStockState,
        computeStockIntelSignal,
        getWaveElementWeaknessRatios,
        refreshStockForecastSignals,
        settleWaveStocks,
        buyStock,
        sellStock,
        getElementDividendBonus,
        getTowerDividendBonus,
        getAverageShopCost,
        getBlindBoxCost,
        rollBlindBoxOutcome,
        canSelectWaveWager,
        selectWaveWager,
        cancelWaveWager,
        onWaveMonsterLeaked,
        settleWaveWager
    };

    GameApp.systems = GameApp.systems || {};
    GameApp.systems.economy = EconomySystem;
})(window);
