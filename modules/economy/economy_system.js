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
        const mult = (mapSpec && Number.isFinite(mapSpec.killGoldMult)) ? mapSpec.killGoldMult : 1.0;
        return Math.max(1, Math.round(baseReward * mult));
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
        computeKillGold
    };

    GameApp.systems = GameApp.systems || {};
    GameApp.systems.economy = EconomySystem;
})(window);
