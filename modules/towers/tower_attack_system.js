/**
 * ============================================================================
 * 【檔案名稱】：modules/towers/tower_attack_system.js
 * 【負責功能】：防禦塔索敵優先級篩選、獨立冷卻計時（含 2.50x 攻速上限與 120ms 冷卻下限）、
 *               元素世界樹 21 節點全攻擊樣式（attackStyle）驅動開火、真連鎖 hitSet 防重、
 *               雙曲線護甲 K=35 與純血 1.75x / 共生 1.35x 親和傷害結算。
 * 【讀取資料】：讀取 modules/towers/tower_data.js、terrain_system.js、monster_system.js 與 tree_system.js。
 * 【常見修改入口】：
 *   1. 修改索敵篩選與優先級比較邏輯：修改 findBestTargetInRange()、isMonsterPreferred()。
 *   2. 新增或調整 21 節點攻擊樣式行為：修改 ATTACK_STYLE_HANDLERS 內對應的處理函式。
 * ============================================================================
 */
(function (global) {
    'use strict';

    const GameApp = global.GameApp = global.GameApp || {};
    const CONFIG = GameApp.config || {};
    const { clampNumber, indexToCoords } = GameApp.helpers || {};

    let G = null;
    function bind(ctx) { G = ctx; }

    function getTowersData() {
        return (GameApp.data && GameApp.data.towers) || {};
    }

    function getTowerCfg(type, tier = 1) {
        const td = getTowersData();
        const dict = td.TOWERS || {};
        if (dict[type] && !dict[type].isAlias) return dict[type];
        if (typeof td.normalizeTowerType === 'function') {
            const norm = td.normalizeTowerType(type, tier);
            if (dict[norm]) return dict[norm];
        }
        return dict[type] || null;
    }

    function getMaxTier() {
        return (GameApp.data && GameApp.data.evolutions && GameApp.data.evolutions.MAX_TIER) || 3;
    }

    function getTowerBaseRangeCells(towerObj) {
        const tier = towerObj && Number.isFinite(towerObj.tier) ? towerObj.tier : 1;
        const cfg = towerObj ? getTowerCfg(towerObj.type, tier) : null;
        if (!cfg) return 2.0;
        if (Array.isArray(cfg.tierRange) && Number.isFinite(cfg.tierRange[tier]) && cfg.tierRange[tier] > 0) {
            return clampNumber(cfg.tierRange[tier], 0.5, 15.0, 2.0);
        }
        return clampNumber(cfg.range, 0.5, 15.0, 2.0);
    }

    function getTowerEffectiveRangeCells(index, towerObj) {
        const baseRange = getTowerBaseRangeCells(towerObj);
        const TerrainSys = GameApp.systems && GameApp.systems.terrain;
        const rangeMult = (TerrainSys && index !== null && index !== undefined)
            ? TerrainSys.getTerrainBonusesAt(index).rangeMult
            : 1.0;
        return baseRange * rangeMult;
    }

    function getTowerRangePx(towerObj, index = null) {
        const rangeCells = (index !== null && index !== undefined)
            ? getTowerEffectiveRangeCells(index, towerObj)
            : getTowerBaseRangeCells(towerObj);
        return rangeCells * G.boardMetrics.step;
    }

    /**
     * 計算攻擊間隔（套用 Phase 2A 硬性上限：攻速乘區上限 2.50x，攻擊冷卻下限 120ms）
     */
    function getTowerAttackInterval(towerOrType, index = null) {
        const type = typeof towerOrType === 'string' ? towerOrType : towerOrType.type;
        const tier = (typeof towerOrType === 'object' && towerOrType && towerOrType.tier) ? towerOrType.tier : 1;
        const cfg = getTowerCfg(type, tier);
        const cc = getTowersData().COMBAT_CONSTANTS || {};
        const baseInterval = (cfg && cfg.attackIntervalMs) || CONFIG.ATTACK_INTERVAL || 1000;
        let speedMult = 1.0;

        const TerrainSys = GameApp.systems && GameApp.systems.terrain;
        if (TerrainSys && index !== null && index !== undefined) {
            speedMult *= TerrainSys.getTerrainBonusesAt(index).attackSpeedMult;
        }

        const TreeSys = GameApp.systems && GameApp.systems.tree;
        if (TreeSys) {
            speedMult *= TreeSys.getTowerBlessingSpeedMult(type);
        }

        if (G && G.state && G.state.frenzyActiveMs > 0) {
            const treeData = (GameApp.data && GameApp.data.tree) || {};
            const frenzyBonus = (treeData.ACTIVE_SKILLS && treeData.ACTIVE_SKILLS.frenzy && treeData.ACTIVE_SKILLS.frenzy.speedBonus)
                || CONFIG.SKILL_FRENZY_SPEED_BONUS || 0.35;
            speedMult *= (1 + frenzyBonus);
        }

        const maxSpeedMult = Number.isFinite(cc.ATTACK_SPEED_MULT_CAP) ? cc.ATTACK_SPEED_MULT_CAP : 2.50;
        const floorMs = Number.isFinite(cc.ATTACK_COOLDOWN_FLOOR_MS) ? cc.ATTACK_COOLDOWN_FLOOR_MS : 120;
        const clampedSpeed = Math.min(maxSpeedMult, Math.max(0.1, speedMult));
        return Math.max(floorMs, Math.round(baseInterval / clampedSpeed));
    }

    function createTowerObj(type, tier, investedGold, initialAccMs = null, options = {}) {
        const st = G.state;
        const td = getTowersData();
        const resolvedTier = Math.max(1, Math.min(getMaxTier(), Number(tier) || 1));
        const normalizedType = (!options.keepRawType && typeof td.normalizeTowerType === 'function')
            ? td.normalizeTowerType(type, resolvedTier)
            : type;
        const cfg = getTowerCfg(normalizedType, resolvedTier) || {};
        const accMs = initialAccMs !== null ? initialAccMs
            : (st.board.some(t => t && t.type === normalizedType) ? -(((st.towerPhaseSeq++ % 3) + 1) * 130) : 0);

        const defaultPath = Array.isArray(cfg.defaultLineagePath) ? cfg.defaultLineagePath.slice() : [cfg.shortName || cfg.name || normalizedType];
        return {
            uid: options.uid || st.towerUidCounter++,
            type: normalizedType,
            tier: cfg.nodeTier || resolvedTier,
            costShare: Number.isFinite(options.costShare) ? options.costShare : (cfg.costShare || Math.pow(2, resolvedTier - 1)),
            lineagePath: Array.isArray(options.lineagePath) && options.lineagePath.length > 0 ? options.lineagePath.slice() : defaultPath,
            accMs,
            investedGold,
            targetMode: options.targetMode || 'first',
            totalDamage: Number.isFinite(options.totalDamage) ? options.totalDamage : 0,
            aimAngleDeg: Number.isFinite(options.aimAngleDeg) ? options.aimAngleDeg : 0,
            shotCounter: 0,
            focusTargetId: null,
            focusStacks: 0
        };
    }

    function recordTowerDamage(towerObj, damageAmount) {
        if (!towerObj || !Number.isFinite(damageAmount) || damageAmount <= 0) return;
        towerObj.totalDamage = (towerObj.totalDamage || 0) + damageAmount;
        G.state.totalTeamDamage += damageAmount;
        const cfg = getTowerCfg(towerObj.type, towerObj.tier);
        if (!G.state.peakTowerSnapshot || towerObj.totalDamage >= G.state.peakTowerSnapshot.totalDamage) {
            G.state.peakTowerSnapshot = {
                uid: towerObj.uid,
                type: towerObj.type,
                tier: towerObj.tier,
                name: cfg ? cfg.name : towerObj.type,
                icon: cfg ? cfg.icon : '',
                totalDamage: towerObj.totalDamage
            };
        }
    }

    const DEFAULT_CHAIN_SCALES_BY_TIER = {
        1: [1.0, 0.55],
        2: [1.0, 0.65, 0.45],
        3: [1.0, 0.75, 0.55, 0.40]
    };

    function getThunderChainScales(towerObj, cfg = null) {
        const tier = Math.max(1, Math.min(getMaxTier(), Number(towerObj && towerObj.tier) || 1));
        const resolvedCfg = cfg || getTowerCfg(towerObj.type, tier) || {};
        const fxParams = resolvedCfg.effectParams || {};
        let rawScales = null;
        if (Array.isArray(fxParams.chainScales) && fxParams.chainScales.length > 0) {
            rawScales = fxParams.chainScales;
        } else if (fxParams.chainScalesByTier && Array.isArray(fxParams.chainScalesByTier[tier])) {
            rawScales = fxParams.chainScalesByTier[tier];
        } else {
            rawScales = DEFAULT_CHAIN_SCALES_BY_TIER[tier] || [1.0, 0.55];
        }
        const scales = rawScales.slice();

        const TreeSys = GameApp.systems && GameApp.systems.tree;
        const extraTargets = TreeSys ? TreeSys.getThunderChainBonus(towerObj.type) : 0;
        for (let i = 0; i < extraTargets; i++) {
            const last = scales.length > 0 ? scales[scales.length - 1] : 0.55;
            scales.push(Math.max(0.30, Number((last - 0.15).toFixed(2))));
        }
        return scales;
    }

    function getBaseDamageForTower(towerObj, cfg) {
        if (cfg && Number.isFinite(cfg.damage) && !cfg.isAlias) {
            return cfg.damage;
        }
        const towersData = getTowersData();
        const dmgRow = (towersData.TIER_DAMAGE_TABLE && towersData.TIER_DAMAGE_TABLE[towerObj.type]) || (cfg && cfg.tierDamage);
        return (dmgRow && dmgRow[towerObj.tier]) || (cfg && cfg.damage) || 15;
    }

    function getTowerInspectorStats(index, towerObj) {
        const cfg = getTowerCfg(towerObj.type, towerObj.tier) || {};
        const baseDmg = getBaseDamageForTower(towerObj, cfg);
        const intervalSec = Math.max(0.12, getTowerAttackInterval(towerObj, index) / 1000);
        const fxParams = cfg.effectParams || {};
        const TreeSys = GameApp.systems && GameApp.systems.tree;
        const TerrainSys = GameApp.systems && GameApp.systems.terrain;
        const style = cfg.attackStyle || 'burst_armor_break';

        let singleHitFactor = 1.0;
        if (style === 'pierce_beam' || style === 'plasma_A_deathray' || style === 'plasma_B_refract') {
            singleHitFactor = 1 + (towerObj.focusStacks || 0) * (fxParams.stackBonus || 0.12);
        } else if (style === 'thunder_B_judgment') {
            const everyN = fxParams.judgmentEveryN || 3;
            const mult = fxParams.judgmentMult || 2.2;
            singleHitFactor = ((everyN - 1) + mult) / everyN;
        }

        const terrainBonuses = TerrainSys ? TerrainSys.getTerrainBonusesAt(index) : { damageMult: 1.0, terrainType: null };
        const globalBlessMult = TreeSys ? TreeSys.getGlobalBlessingDamageMult() : 1.0;
        const unitDmg = baseDmg * terrainBonuses.damageMult * globalBlessMult;
        let singleDps = Math.round((unitDmg * singleHitFactor) / intervalSec);
        if (style === 'fire_B_ember') {
            singleDps += Math.round((fxParams.burnFlatDps || 8) * 2);
        }

        let aoeDps = null;
        let aoeLabel = null;
        if (style === 'chain_lightning') {
            const chainTotalMult = getThunderChainScales(towerObj, cfg).reduce((sum, s) => sum + s, 0);
            aoeDps = Math.round((unitDmg * chainTotalMult) / intervalSec);
            aoeLabel = '連鎖 DPS';
        } else if (style === 'stun_pulse' || style === 'magnet_B_overload') {
            const extraChain = (fxParams.chainTargets ? fxParams.chainTargets - 1 : (fxParams.chainExtraTargets ?? 2))
                + (TreeSys ? TreeSys.getThunderChainBonus(towerObj.type) : 0);
            const chainRatio = fxParams.chainDamageRatio ?? 0.70;
            const shockExtra = style === 'magnet_B_overload' ? (fxParams.shockBonusDamage || 12) * 2 : 0;
            aoeDps = Math.round((unitDmg * (1 + extraChain * chainRatio)) / intervalSec + shockExtra);
            aoeLabel = '連鎖 DPS';
        } else if (style === 'aoe_mist' || style === 'fire_A_mortar' || style === 'steam_A_pressure') {
            const splashRatio = fxParams.splashRatio ?? 0.65;
            const poolDps = style === 'steam_A_pressure' ? (fxParams.poolDps || 28) * 2 : 0;
            aoeDps = Math.round((unitDmg * (1 + 2 * splashRatio)) / intervalSec + poolDps);
            aoeLabel = '預估群傷';
        } else if (style === 'ice_A_permafrost' || style === 'steam_B_fog' || style === 'magnet_A_singularity') {
            aoeDps = Math.round((unitDmg * 2.4) / intervalSec);
            aoeLabel = '預估群傷';
        } else if (style === 'ice_B_icicle') {
            const secondRatio = fxParams.secondTargetRatio ?? 0.60;
            aoeDps = Math.round((unitDmg * (1 + secondRatio)) / intervalSec);
            aoeLabel = '穿透 DPS';
        } else if (style === 'plasma_B_refract') {
            const refCount = fxParams.refractTargets ?? 2;
            const refRatio = fxParams.refractRatio ?? 0.50;
            aoeDps = Math.round((unitDmg * (singleHitFactor + refCount * refRatio)) / intervalSec);
            aoeLabel = '折射 DPS';
        } else if (style === 'fire_B_ember') {
            aoeDps = Math.round(singleDps * 2.1);
            aoeLabel = '瘟疫群傷';
        }

        return {
            dps: singleDps,
            aoeDps,
            aoeLabel,
            rangeStr: Number(getTowerEffectiveRangeCells(index, towerObj).toFixed(2)).toString(),
            terrainType: terrainBonuses.terrainType
        };
    }

    function getTowerHoverTooltipData(index, towerObj) {
        if (!towerObj) return null;
        const cfg = getTowerCfg(towerObj.type, towerObj.tier) || {};
        const baseDmg = getBaseDamageForTower(towerObj, cfg);
        const TerrainSys = GameApp.systems && GameApp.systems.terrain;
        const TreeSys = GameApp.systems && GameApp.systems.tree;
        const terrainBonuses = (TerrainSys && index !== null && index !== undefined)
            ? TerrainSys.getTerrainBonusesAt(index)
            : { damageMult: 1.0, terrainType: null };
        const globalBlessMult = TreeSys ? TreeSys.getGlobalBlessingDamageMult() : 1.0;
        const effDmg = Math.max(1, Math.round(baseDmg * terrainBonuses.damageMult * globalBlessMult));
        const intervalSec = (Math.max(120, getTowerAttackInterval(towerObj, index)) / 1000).toFixed(2);
        const effRange = Number(getTowerEffectiveRangeCells(index, towerObj).toFixed(2)).toString();
        const stars = GameApp.renderer && typeof GameApp.renderer.getTierStars === 'function'
            ? GameApp.renderer.getTierStars(towerObj.tier)
            : '★'.repeat(Math.max(1, Math.min(3, towerObj.tier || 1)));
        const desc = cfg.tooltipSummary || cfg.roleSummary || (Array.isArray(cfg.badges) ? cfg.badges.join(' · ') : '');

        return {
            nameLine: `${cfg.icon || '✨'} ${cfg.name || towerObj.type} · ${stars}`,
            statsLine: `單發 ${effDmg} ｜ 攻速 ${intervalSec}s ｜ 射程 ${effRange}`,
            descLine: desc
        };
    }

    function pickSmartSpawnIndex(type = null) {
        const st = G.state, map = G.map;
        const boardSize = CONFIG.BOARD_SIZE || 150;
        const TerrainSys = GameApp.systems && GameApp.systems.terrain;
        const canPlace = (idx) => (TerrainSys ? TerrainSys.canBuildAt(idx) : !map.pathCellIndices.has(idx)) && st.board[idx] === null;

        if (st.buildTargetIndex !== null && st.buildTargetIndex >= 0 && st.buildTargetIndex < boardSize && canPlace(st.buildTargetIndex)) {
            return { index: st.buildTargetIndex, mode: 'targeted' };
        }
        const pathCoords = Array.from(map.pathCellIndices).map(indexToCoords);
        const towerProbe = { type: type || 'fire_bud', tier: 1 };
        let bestCoverage = -1, bestPathDist = Infinity, bestPool = [];
        for (let idx = 0; idx < boardSize; idx++) {
            if (!canPlace(idx)) continue;
            const c = indexToCoords(idx);
            const rangeCells = getTowerEffectiveRangeCells(idx, towerProbe);
            let coverage = 0;
            for (let p = 0; p < pathCoords.length; p++) {
                if (Math.hypot(c.x - pathCoords[p].x, c.y - pathCoords[p].y) <= rangeCells + 0.001) coverage++;
            }
            const dist = map.cellPathDist[idx];
            if (coverage > bestCoverage || (coverage === bestCoverage && dist < bestPathDist - 1e-4)) {
                bestCoverage = coverage;
                bestPathDist = dist;
                bestPool = [idx];
            } else if (coverage === bestCoverage && Math.abs(dist - bestPathDist) <= 1e-4) {
                bestPool.push(idx);
            }
        }
        if (bestPool.length === 0) return null;
        return { index: bestPool[Math.floor(Math.random() * bestPool.length)], mode: bestCoverage > 0 ? 'near-path' : 'fallback' };
    }

    // ==================== 索敵優先級與標籤驅動傷害結算 ====================
    function isMonsterPreferred(cand, best, mode) {
        if (!best) return true;
        if (mode === 'armor' && Math.abs((cand.armor || 0) - (best.armor || 0)) > 0.01) return (cand.armor || 0) > (best.armor || 0);
        if (mode === 'lowhp' && cand.hp !== best.hp) return cand.hp < best.hp;
        const MonsterSys = GameApp.systems && GameApp.systems.monster;
        const pCand = MonsterSys ? MonsterSys.getMonsterProgress(cand) : 0;
        const pBest = MonsterSys ? MonsterSys.getMonsterProgress(best) : 0;
        return pCand > pBest;
    }

    function findBestTargetInRange(towerIndex, towerObj, excludeIds = null) {
        const monsters = G.state.monsters;
        if (monsters.length === 0) return null;
        const coords = indexToCoords(towerIndex), towerPos = GameApp.renderer.getCellCenter(coords.x, coords.y);
        const rangePx = getTowerRangePx(towerObj, towerIndex), mode = towerObj.targetMode || 'first';
        let bestTarget = null;
        for (let i = 0; i < monsters.length; i++) {
            const m = monsters[i];
            if (m.hp <= 0 || m.isTargetable === false || (excludeIds && excludeIds.has(m.id))) continue;
            if (Math.hypot(m.pixelX - towerPos.left, m.pixelY - towerPos.top) <= rangePx && isMonsterPreferred(m, bestTarget, mode)) {
                bestTarget = m;
            }
        }
        return bestTarget;
    }

    function calculateDamage(towerObj, monster, options = {}) {
        const towersData = getTowersData();
        const cfg = getTowerCfg(towerObj.type, towerObj.tier) || {};
        const baseDmg = getBaseDamageForTower(towerObj, cfg);

        const TreeSys = GameApp.systems && GameApp.systems.tree;
        const MonsterSys = GameApp.systems && GameApp.systems.monster;

        const thornMult = TreeSys ? TreeSys.getGlobalBlessingDamageMult() : 1.0;
        const towerElementTag = cfg.elementTag || towerObj.type;
        const lineageTags = Array.isArray(cfg.lineageTags) ? cfg.lineageTags : [];
        const isWeakness = Boolean((!cfg.isHybrid) && monster.weakness && towerElementTag === monster.weakness);
        const isAffinity = Boolean(cfg.isHybrid && monster.weakness && lineageTags.includes(monster.weakness));

        const vulnMult = MonsterSys && typeof MonsterSys.getMonsterVulnerabilityMultiplier === 'function'
            ? MonsterSys.getMonsterVulnerabilityMultiplier(monster)
            : (1.0 + Math.min(0.60, ((monster.rootTimer || 0) > 0 ? (monster.rootVulnRate || 0) : 0)));

        const constants = towersData.COMBAT_CONSTANTS || {};
        const weaknessMult = Number.isFinite(constants.WEAKNESS_MULTIPLIER) ? constants.WEAKNESS_MULTIPLIER : 1.75;
        const affinityMult = Number.isFinite(constants.HYBRID_AFFINITY_MULTIPLIER) ? constants.HYBRID_AFFINITY_MULTIPLIER : 1.35;
        const weakMult = isWeakness ? weaknessMult : (isAffinity ? affinityMult : 1.0);
        const resonanceMult = TreeSys && typeof TreeSys.getElementalResonanceMult === 'function'
            ? TreeSys.getElementalResonanceMult(towerObj, monster)
            : 1.0;
        const raw = baseDmg * thornMult * resonanceMult * (options.damageScale ?? 1.0) * (options.terrainMult ?? 1.0) * (options.extraMult ?? 1.0) * weakMult * vulnMult;
        const effArmor = MonsterSys ? MonsterSys.getMonsterEffectiveArmor(monster, options.armorPierce || 0) : (monster.armor || 0);
        const kVal = (constants && constants.ARMOR_HYPERBOLIC_K) || 35;
        return {
            damage: Math.max(1, Math.round(raw * (kVal / (kVal + effArmor)))),
            isWeakness,
            isAffinity
        };
    }

    function applyHitToMonster(towerIndex, towerObj, monster, options = {}) {
        if (!monster || monster.hp <= 0 || monster.isTargetable === false) return null;
        const TerrainSys = GameApp.systems && GameApp.systems.terrain;
        const MonsterSys = GameApp.systems && GameApp.systems.monster;
        const TreeSys = GameApp.systems && GameApp.systems.tree;
        const cfg = getTowerCfg(towerObj.type, towerObj.tier) || {};
        const fxParams = cfg.effectParams || {};

        const armorPierce = options.armorPierce ?? (fxParams.armorPierce || 0);
        if (TreeSys && typeof TreeSys.registerResonanceHit === 'function') {
            TreeSys.registerResonanceHit(towerObj, monster);
        }
        const terrainMult = options.terrainMult ?? (TerrainSys ? TerrainSys.getTowerTerrainDamageMult(towerIndex) : 1.0);
        const result = calculateDamage(towerObj, monster, {
            damageScale: options.damageScale ?? 1.0,
            terrainMult,
            extraMult: options.extraMult ?? 1.0,
            armorPierce
        });

        const hpBefore = monster.hp;
        monster.hp = Math.max(0, hpBefore - result.damage);
        recordTowerDamage(towerObj, Math.min(hpBefore, result.damage));

        // 依選項或攻擊樣式套用破甲／減速
        const willApplyShred = (cfg.attackStyle === 'burst_armor_break' || options.forceShred) && options.applyShred !== false && MonsterSys;
        if (willApplyShred) {
            MonsterSys.applyArmorShred(
                monster,
                options.shredRate ?? fxParams.shredRate ?? 0.25,
                options.shredDurationMs ?? fxParams.shredDurationMs ?? 3000
            );
        }
        if ((cfg.attackStyle === 'slow_control' || options.forceSlow) && options.applySlow !== false && MonsterSys) {
            const baseRate = options.slowRate ?? fxParams.slowRate ?? 0.40;
            const baseDur = options.slowDurationMs ?? fxParams.slowDurationMs ?? 2000;
            const slowSpec = TreeSys ? TreeSys.getIceLineageSlowParams(towerObj.type, baseRate, baseDur) : { rate: baseRate, durationMs: baseDur };
            MonsterSys.applySlowToMonster(monster, slowSpec.rate, slowSpec.durationMs, options.slowSourceId || towerObj.type);
        }

        // 🔥 焦土烙印祝福：火系與蒸氣塔觸發破甲或暴擊時留下 2.5s 燃燒路徑
        if (TreeSys && typeof TreeSys.trySpawnScorchedBrand === 'function') {
            const didShredOrCrit = Boolean(willApplyShred || armorPierce > 0 || result.isWeakness || result.isAffinity);
            TreeSys.trySpawnScorchedBrand(towerObj, monster, didShredOrCrit);
        }

        GameApp.renderer.spawnDamageNumber(result.damage, result.isWeakness, monster.pixelX, monster.pixelY, options.dmgTag || '', result.isAffinity);

        // 感電協同觸發：任何防禦塔命中感電怪額外觸發 +12 雷傷（單怪 0.35s 內置冷卻）
        if (monster.hp > 0 && MonsterSys && typeof MonsterSys.tryTriggerShockBonusDamage === 'function') {
            MonsterSys.tryTriggerShockBonusDamage(monster, towerObj);
        }

        // ❄️ 極寒碎冰祝福：處於減速或凍結狀態且血量低於 15% 時直接碎裂處決
        if (monster.hp > 0 && TreeSys && typeof TreeSys.shouldGlacialShatter === 'function' && TreeSys.shouldGlacialShatter(towerObj, monster)) {
            const shatterDmg = monster.hp;
            monster.hp = 0;
            recordTowerDamage(towerObj, shatterDmg);
            GameApp.renderer.spawnDamageNumber(shatterDmg, true, monster.pixelX, monster.pixelY, '碎冰 ');
            GameApp.renderer.emitParticleBurst(monster.pixelX, monster.pixelY, '#4A9EBF', 8, 85);
        }

        // 焚世餘燼樹 (fire_B) <12% 血量處決
        if (monster.hp > 0 && options.executeThresholdPct > 0 && (monster.hp / Math.max(1, monster.maxHp)) < options.executeThresholdPct) {
            const execDmg = monster.hp;
            monster.hp = 0;
            recordTowerDamage(towerObj, execDmg);
            GameApp.renderer.spawnDamageNumber(execDmg, true, monster.pixelX, monster.pixelY, '斬殺');
        }

        if (monster.hp <= 0 && MonsterSys) {
            MonsterSys.handleMonsterKilled(monster, towerObj, result.damage);
        }
        return result;
    }

    function applySplashDamage(towerIndex, towerObj, targetPos, radiusPx, excludeId, hitOptions, slowParams = null) {
        const MonsterSys = GameApp.systems && GameApp.systems.monster;
        const targets = G.state.monsters.filter(m =>
            m.id !== excludeId && m.hp > 0 && m.isTargetable !== false && Math.hypot(m.pixelX - targetPos.left, m.pixelY - targetPos.top) <= radiusPx
        );
        for (let i = 0; i < targets.length; i++) {
            applyHitToMonster(towerIndex, towerObj, targets[i], hitOptions);
            if (slowParams && slowParams.rate > 0 && targets[i].hp > 0 && MonsterSys) {
                MonsterSys.applySlowToMonster(targets[i], slowParams.rate, slowParams.durationMs, slowParams.sourceId || towerObj.type);
            }
        }
    }

    function fireLightningBolt(towerIndex, towerObj) {
        const st = G.state;
        if (!G.callbacks.isGameplayActive() || st.monsters.length === 0 || st.board[towerIndex] !== towerObj) return false;
        const primaryTarget = findBestTargetInRange(towerIndex, towerObj);
        if (!primaryTarget) return false;

        const Renderer = GameApp.renderer;
        const coords = indexToCoords(towerIndex);
        const towerPos = Renderer.getCellCenter(coords.x, coords.y);
        const cfg = getTowerCfg(towerObj.type, towerObj.tier) || {};
        const fxParams = cfg.effectParams || {};
        const scales = getThunderChainScales(towerObj, cfg);
        const chainRadiusPx = (fxParams.chainRadiusCells ?? 2.6) * G.boardMetrics.step;
        const isLv3 = towerObj.tier >= getMaxTier();

        const firstPos = { left: primaryTarget.pixelX, top: primaryTarget.pixelY };
        Renderer.updateTowerAimVisual(towerIndex, towerObj, towerPos, firstPos);

        const TreeSys = GameApp.systems && GameApp.systems.tree;
        const stormExtra = (TreeSys && typeof TreeSys.getChainStormExtraBounces === 'function') ? TreeSys.getChainStormExtraBounces() : 0;
        const stormRadiusPx = (TreeSys && typeof TreeSys.getChainStormRadiusCells === 'function')
            ? TreeSys.getChainStormRadiusCells() * G.boardMetrics.step
            : chainRadiusPx;
        let maxBounces = scales.length;

        // 單次攻擊內以 hitSet 嚴格鎖定已命中怪物，禁止彈跳回同一目標
        const hitSet = new Set([primaryTarget.id]);
        applyHitToMonster(towerIndex, towerObj, primaryTarget, { damageScale: scales[0] ?? 1.0 });
        if (primaryTarget.hp <= 0 && stormExtra > 0) {
            maxBounces += stormExtra;
        }
        Renderer.emitCanvasAttackFX(towerObj.type, towerPos, firstPos, { isLv3 });

        let prevPos = firstPos;
        for (let b = 1; b < maxBounces; b++) {
            const searchRadius = b >= scales.length ? stormRadiusPx : chainRadiusPx;
            let bestNext = null;
            let bestDist = Infinity;
            for (let i = 0; i < st.monsters.length; i++) {
                const cand = st.monsters[i];
                if (cand.hp <= 0 || cand.isTargetable === false || hitSet.has(cand.id)) continue;
                const d = Math.hypot(cand.pixelX - prevPos.left, cand.pixelY - prevPos.top);
                if (d <= searchRadius && d < bestDist) {
                    bestDist = d;
                    bestNext = cand;
                }
            }
            if (!bestNext) break;
            hitSet.add(bestNext.id);
            const nextPos = { left: bestNext.pixelX, top: bestNext.pixelY };
            const scaleVal = b < scales.length ? scales[b] : (scales[scales.length - 1] ?? 0.55);
            applyHitToMonster(towerIndex, towerObj, bestNext, { damageScale: scaleVal });
            if (bestNext.hp <= 0 && stormExtra > 0) {
                maxBounces += stormExtra;
            }
            Renderer.emitCanvasAttackFX(towerObj.type, prevPos, nextPos, { isLv3 });
            prevPos = nextPos;
        }

        GameApp.audio.playTowerShot(towerObj.type);
        return true;
    }

    /**
     * 元素世界樹 21 節點全攻擊樣式處理器
     */
    const ATTACK_STYLE_HANDLERS = {
        // T1 火芽 / T2 炎核樹幹：單體重擊破甲
        burst_armor_break(towerIndex, towerObj, cfg, target, towerPos, targetPos) {
            applyHitToMonster(towerIndex, towerObj, target);
            GameApp.renderer.emitCanvasAttackFX('fire', towerPos, targetPos);
        },

        // T3 🔥A 熔核轟擊樹：1.3 格 60% 濺射 ＋ 45% 群體破甲 (4s)
        fire_A_mortar(towerIndex, towerObj, cfg, target, towerPos, targetPos) {
            const fxParams = cfg.effectParams || {};
            const splashRadiusPx = (fxParams.splashRadiusCells ?? 1.3) * G.boardMetrics.step;
            const splashRatio = fxParams.splashRatio ?? 0.60;
            const shredRate = fxParams.shredRate ?? 0.45;
            const shredDurationMs = fxParams.shredDurationMs ?? 4000;

            applyHitToMonster(towerIndex, towerObj, target, {
                forceShred: true,
                shredRate,
                shredDurationMs
            });
            applySplashDamage(towerIndex, towerObj, targetPos, splashRadiusPx, target.id, {
                damageScale: splashRatio,
                forceShred: true,
                shredRate,
                shredDurationMs
            });
            GameApp.renderer.emitCanvasAttackFX('fire', towerPos, targetPos, { splashRadiusPx });
        },

        // T3 🔥B 焚世餘燼樹：5 層灼燒 (每 2s 傳染 1.2 格) ＋ 50% 重傷 ＋ <12% 血量處決
        fire_B_ember(towerIndex, towerObj, cfg, target, towerPos, targetPos) {
            const fxParams = cfg.effectParams || {};
            const MonsterSys = GameApp.systems && GameApp.systems.monster;
            if (MonsterSys) {
                MonsterSys.applyBurnToMonster(target, fxParams, towerObj);
                MonsterSys.applyGrievousWound(target, fxParams.grievousRate ?? 0.50, fxParams.grievousDurationMs ?? 5000);
            }
            applyHitToMonster(towerIndex, towerObj, target, {
                executeThresholdPct: fxParams.executeThresholdPct ?? 0.12
            });
            GameApp.renderer.emitCanvasAttackFX('fire', towerPos, targetPos);
        },

        // T1 冰芽 / T2 霜晶樹幹：單體減速
        slow_control(towerIndex, towerObj, cfg, target, towerPos, targetPos) {
            applyHitToMonster(towerIndex, towerObj, target);
            GameApp.renderer.emitCanvasAttackFX('ice', towerPos, targetPos);
        },

        // T3 ❄️A 永凍領域樹：1.5 格群體 60% 減速 ＋ 每命中已減速目標第 4 次觸發 0.9s 凍結 (Boss 減半，6s 免疫)
        ice_A_permafrost(towerIndex, towerObj, cfg, target, towerPos, targetPos) {
            const fxParams = cfg.effectParams || {};
            const TreeSys = GameApp.systems && GameApp.systems.tree;
            const MonsterSys = GameApp.systems && GameApp.systems.monster;
            const frostRadiusPx = (fxParams.aoeRadiusCells ?? 1.5) * G.boardMetrics.step;
            const slowSpec = TreeSys
                ? TreeSys.getIceLineageSlowParams(towerObj.type, fxParams.slowRate ?? 0.60, fxParams.slowDurationMs ?? 2500)
                : { rate: fxParams.slowRate ?? 0.60, durationMs: fxParams.slowDurationMs ?? 2500 };

            const wasSlowed = MonsterSys ? MonsterSys.isMonsterSlowed(target) : false;
            applyHitToMonster(towerIndex, towerObj, target, {
                forceSlow: true,
                slowRate: slowSpec.rate,
                slowDurationMs: slowSpec.durationMs,
                slowSourceId: 'ice_A'
            });
            if (wasSlowed && target.hp > 0 && MonsterSys) {
                MonsterSys.registerPermafrostHitAndTryFreeze(target, towerObj, fxParams);
            }

            for (let i = 0; i < G.state.monsters.length; i++) {
                const m = G.state.monsters[i];
                if (m.id === target.id || m.hp <= 0 || m.isTargetable === false) continue;
                if (Math.hypot(m.pixelX - targetPos.left, m.pixelY - targetPos.top) <= frostRadiusPx && MonsterSys) {
                    const mWasSlowed = MonsterSys.isMonsterSlowed(m);
                    MonsterSys.applySlowToMonster(m, slowSpec.rate, slowSpec.durationMs, 'ice_A');
                    if (mWasSlowed) {
                        MonsterSys.registerPermafrostHitAndTryFreeze(m, towerObj, fxParams);
                    }
                }
            }
            GameApp.renderer.emitCanvasAttackFX('ice', towerPos, targetPos, { frostRadiusPx });
        },

        // T3 ❄️B 冰錐穿刺樹：直線穿透 2 體 (次體 60%)，對任何減速/凍結/纏繞目標 +55% 碎冰增傷
        ice_B_icicle(towerIndex, towerObj, cfg, target, towerPos, targetPos) {
            const fxParams = cfg.effectParams || {};
            const MonsterSys = GameApp.systems && GameApp.systems.monster;
            const shatterBonus = fxParams.shatterBonus ?? 0.55;
            const secondRatio = fxParams.secondTargetRatio ?? 0.60;

            const primaryControlled = MonsterSys ? MonsterSys.isMonsterControlled(target) : false;
            applyHitToMonster(towerIndex, towerObj, target, {
                extraMult: primaryControlled ? (1 + shatterBonus) : 1.0,
                forceSlow: true,
                slowRate: fxParams.slowRate ?? 0.40,
                slowDurationMs: fxParams.slowDurationMs ?? 2000,
                slowSourceId: 'ice_B'
            });
            GameApp.renderer.emitCanvasAttackFX('ice', towerPos, targetPos);

            // 尋找直線延伸方向或鄰近的第二名敵人進行冰錐穿透
            const dirX = targetPos.left - towerPos.left;
            const dirY = targetPos.top - towerPos.top;
            const dirLen = Math.hypot(dirX, dirY) || 1;
            const ux = dirX / dirLen, uy = dirY / dirLen;
            const maxSearchPx = (fxParams.pierceSearchRadiusCells ?? 2.3) * G.boardMetrics.step;
            const maxLineWidthPx = (fxParams.pierceLineWidthCells ?? 0.90) * G.boardMetrics.step;

            let secondTarget = null;
            let bestScore = Infinity;
            for (let i = 0; i < G.state.monsters.length; i++) {
                const cand = G.state.monsters[i];
                if (cand.id === target.id || cand.hp <= 0 || cand.isTargetable === false) continue;
                const relX = cand.pixelX - targetPos.left;
                const relY = cand.pixelY - targetPos.top;
                const dist = Math.hypot(relX, relY);
                if (dist > maxSearchPx) continue;
                const perp = Math.abs(relX * (-uy) + relY * ux);
                const score = perp <= maxLineWidthPx ? dist : dist + perp * 1.5;
                if (score < bestScore) {
                    bestScore = score;
                    secondTarget = cand;
                }
            }

            if (secondTarget) {
                const secControlled = MonsterSys ? MonsterSys.isMonsterControlled(secondTarget) : false;
                const secPos = { left: secondTarget.pixelX, top: secondTarget.pixelY };
                applyHitToMonster(towerIndex, towerObj, secondTarget, {
                    damageScale: secondRatio,
                    extraMult: secControlled ? (1 + shatterBonus) : 1.0,
                    forceSlow: true,
                    slowRate: fxParams.slowRate ?? 0.40,
                    slowDurationMs: fxParams.slowDurationMs ?? 2000,
                    slowSourceId: 'ice_B'
                });
                GameApp.renderer.emitCanvasAttackFX('ice', targetPos, secPos);
            }
        },

        // T3 ⚡B 落雷審判樹：每第 3 發降下 2.2x 天罰雷擊並無視 40% 護甲
        thunder_B_judgment(towerIndex, towerObj, cfg, target, towerPos, targetPos) {
            const fxParams = cfg.effectParams || {};
            towerObj.shotCounter = (towerObj.shotCounter || 0) + 1;
            const everyN = fxParams.judgmentEveryN || 3;
            const isJudgment = (towerObj.shotCounter % everyN) === 0;
            const extraMult = isJudgment ? (fxParams.judgmentMult || 2.2) : 1.0;
            const armorPierce = isJudgment ? (fxParams.judgmentArmorPierce || 0.40) : 0;

            applyHitToMonster(towerIndex, towerObj, target, {
                extraMult,
                armorPierce,
                dmgTag: isJudgment ? '⚡天罰 ' : ''
            });
            GameApp.renderer.emitCanvasAttackFX('thunder', towerPos, targetPos, { isLv3: true });
            if (isJudgment) {
                GameApp.renderer.emitRingFX(targetPos.left, targetPos.top, G.boardMetrics.step * 0.95, '#E0B43C', 0.26, 260);
            }
        },

        // T2 蒸氣噴泉：無視 45% 護甲 ＋ 1.3 格 70% 濺射
        aoe_mist(towerIndex, towerObj, cfg, target, towerPos, targetPos) {
            const fxParams = cfg.effectParams || {};
            const TreeSys = GameApp.systems && GameApp.systems.tree;
            const MonsterSys = GameApp.systems && GameApp.systems.monster;
            const splashRadiusPx = (fxParams.splashRadiusCells ?? 1.3) * G.boardMetrics.step;
            const splashRatio = fxParams.splashRatio ?? 0.70;
            const armorPierce = fxParams.armorPierce ?? 0.45;
            const mistSlow = TreeSys ? TreeSys.getIceLineageSlowParams(towerObj.type, 0, 0) : { rate: 0, durationMs: 0 };

            applyHitToMonster(towerIndex, towerObj, target, { armorPierce });
            if (mistSlow.rate > 0 && target.hp > 0 && MonsterSys) {
                MonsterSys.applySlowToMonster(target, mistSlow.rate, mistSlow.durationMs, 'steam_chill');
            }
            applySplashDamage(towerIndex, towerObj, targetPos, splashRadiusPx, target.id, { damageScale: splashRatio, armorPierce }, mistSlow);
            GameApp.renderer.emitCanvasAttackFX('steam', towerPos, targetPos, { splashRadiusPx });
        },

        // T3 💨A 焦熱蒸壓樹：無視 65% 護甲 ＋ 1.4 格 65% 濺射 ＋ 落點 3s 滾燙蒸氣池 (28/s)
        steam_A_pressure(towerIndex, towerObj, cfg, target, towerPos, targetPos) {
            const fxParams = cfg.effectParams || {};
            const MonsterSys = GameApp.systems && GameApp.systems.monster;
            const splashRadiusPx = (fxParams.splashRadiusCells ?? 1.4) * G.boardMetrics.step;
            const splashRatio = fxParams.splashRatio ?? 0.65;
            const armorPierce = fxParams.armorPierce ?? 0.65;

            applyHitToMonster(towerIndex, towerObj, target, { armorPierce });
            applySplashDamage(towerIndex, towerObj, targetPos, splashRadiusPx, target.id, { damageScale: splashRatio, armorPierce });
            if (MonsterSys && typeof MonsterSys.spawnGroundHazard === 'function') {
                MonsterSys.spawnGroundHazard({
                    type: 'steam_pool',
                    x: targetPos.left,
                    y: targetPos.top,
                    radiusPx: (fxParams.poolRadiusCells ?? 1.3) * G.boardMetrics.step,
                    dps: fxParams.poolDps ?? 28,
                    durationMs: fxParams.poolDurationMs ?? 3000,
                    sourceTower: towerObj
                });
            }
            GameApp.renderer.emitCanvasAttackFX('steam', towerPos, targetPos, { splashRadiusPx });
        },

        // T3 💨B 霜霧迷宮樹：1.6 格迷霧 AoE，附加 35% 減速 ＋ +20% 全隊濕冷易傷 (3s)
        steam_B_fog(towerIndex, towerObj, cfg, target, towerPos, targetPos) {
            const fxParams = cfg.effectParams || {};
            const TreeSys = GameApp.systems && GameApp.systems.tree;
            const MonsterSys = GameApp.systems && GameApp.systems.monster;
            const fogRadiusPx = (fxParams.aoeRadiusCells ?? 1.6) * G.boardMetrics.step;
            const slowSpec = TreeSys
                ? TreeSys.getIceLineageSlowParams(towerObj.type, fxParams.slowRate ?? 0.35, fxParams.slowDurationMs ?? 3000)
                : { rate: fxParams.slowRate ?? 0.35, durationMs: fxParams.slowDurationMs ?? 3000 };
            const vulnBonus = fxParams.vulnBonus ?? 0.20;
            const vulnDur = fxParams.vulnDurationMs ?? 3000;

            const victims = G.state.monsters.filter(m =>
                m.hp > 0 && m.isTargetable !== false && Math.hypot(m.pixelX - targetPos.left, m.pixelY - targetPos.top) <= fogRadiusPx
            );
            if (!victims.some(m => m.id === target.id)) victims.unshift(target);

            for (let i = 0; i < victims.length; i++) {
                const m = victims[i];
                if (MonsterSys) {
                    MonsterSys.applySlowToMonster(m, slowSpec.rate, slowSpec.durationMs, 'steam_B_fog');
                    MonsterSys.applyVulnerabilityToMonster(m, vulnBonus, vulnDur, 'steam_B_fog');
                }
                applyHitToMonster(towerIndex, towerObj, m, {
                    damageScale: m.id === target.id ? 1.0 : 0.75
                });
            }
            GameApp.renderer.emitCanvasAttackFX('steam', towerPos, targetPos, { frostRadiusPx: fogRadiusPx });
        },

        // T2 極地磁環：45% 群體減速 ＋ 2 次不同目標彈射 (70%)
        stun_pulse(towerIndex, towerObj, cfg, target, towerPos, targetPos) {
            const fxParams = cfg.effectParams || {};
            const TreeSys = GameApp.systems && GameApp.systems.tree;
            const MonsterSys = GameApp.systems && GameApp.systems.monster;
            const frostRadiusPx = (fxParams.aoeRadiusCells ?? 1.3) * G.boardMetrics.step;
            const chainRadiusPx = (fxParams.chainRadiusCells ?? 2.6) * G.boardMetrics.step;
            const pulseSlow = TreeSys
                ? TreeSys.getIceLineageSlowParams(towerObj.type, fxParams.slowRate ?? 0.45, fxParams.slowDurationMs ?? 2200)
                : { rate: 0.45, durationMs: 2200 };
            const stormExtra = (TreeSys && typeof TreeSys.getChainStormExtraBounces === 'function') ? TreeSys.getChainStormExtraBounces() : 0;
            const stormRadiusPx = (TreeSys && typeof TreeSys.getChainStormRadiusCells === 'function')
                ? TreeSys.getChainStormRadiusCells() * G.boardMetrics.step
                : chainRadiusPx;
            let maxChain = (fxParams.chainExtraTargets ?? 2) + (TreeSys ? TreeSys.getThunderChainBonus(towerObj.type) : 0);

            applyHitToMonster(towerIndex, towerObj, target);
            if (target.hp <= 0 && stormExtra > 0) maxChain += stormExtra;
            if (target.hp > 0 && MonsterSys) MonsterSys.applySlowToMonster(target, pulseSlow.rate, pulseSlow.durationMs, 'magnet_pulse');
            for (let i = 0; i < G.state.monsters.length; i++) {
                const m = G.state.monsters[i];
                if (m.hp > 0 && m.isTargetable !== false && Math.hypot(m.pixelX - targetPos.left, m.pixelY - targetPos.top) <= frostRadiusPx && MonsterSys) {
                    MonsterSys.applySlowToMonster(m, pulseSlow.rate, pulseSlow.durationMs, 'magnet_pulse');
                }
            }
            GameApp.renderer.emitCanvasAttackFX('magnet-arc', towerPos, targetPos, { frostRadiusPx });

            const visited = new Set([target.id]);
            let prevPos = targetPos;
            for (let bounce = 0; bounce < maxChain; bounce++) {
                const searchRadius = bounce >= (fxParams.chainExtraTargets ?? 2) ? stormRadiusPx : chainRadiusPx;
                let bestNext = null, bestDist = Infinity;
                for (let i = 0; i < G.state.monsters.length; i++) {
                    const cand = G.state.monsters[i];
                    if (cand.hp <= 0 || cand.isTargetable === false || visited.has(cand.id)) continue;
                    const d = Math.hypot(cand.pixelX - prevPos.left, cand.pixelY - prevPos.top);
                    if (d <= searchRadius && d < bestDist) { bestDist = d; bestNext = cand; }
                }
                if (!bestNext) break;
                visited.add(bestNext.id);
                const nextPos = { left: bestNext.pixelX, top: bestNext.pixelY };
                applyHitToMonster(towerIndex, towerObj, bestNext, { damageScale: fxParams.chainDamageRatio ?? 0.70 });
                if (bestNext.hp <= 0 && stormExtra > 0) maxChain += stormExtra;
                if (bestNext.hp > 0 && MonsterSys) MonsterSys.applySlowToMonster(bestNext, pulseSlow.rate, pulseSlow.durationMs, 'magnet_pulse');
                GameApp.renderer.emitCanvasAttackFX('magnet-arc', prevPos, nextPos);
                prevPos = nextPos;
            }
        },

        // T3 💠A 引力黑洞樹：1.5 格 45% 群體減速，每第 3 次脈衝將範圍內非 Boss 怪沿路徑回拉 0.45 格聚攏
        magnet_A_singularity(towerIndex, towerObj, cfg, target, towerPos, targetPos) {
            const fxParams = cfg.effectParams || {};
            const TreeSys = GameApp.systems && GameApp.systems.tree;
            const MonsterSys = GameApp.systems && GameApp.systems.monster;
            const radiusPx = (fxParams.aoeRadiusCells ?? 1.5) * G.boardMetrics.step;
            const slowSpec = TreeSys
                ? TreeSys.getIceLineageSlowParams(towerObj.type, fxParams.slowRate ?? 0.45, fxParams.slowDurationMs ?? 2400)
                : { rate: 0.45, durationMs: 2400 };

            towerObj.shotCounter = (towerObj.shotCounter || 0) + 1;
            const isPullPulse = (towerObj.shotCounter % (fxParams.pullEveryN || 3)) === 0;
            const pullCells = fxParams.pullDistanceCells ?? 0.45;

            const victims = G.state.monsters.filter(m =>
                m.hp > 0 && m.isTargetable !== false && Math.hypot(m.pixelX - targetPos.left, m.pixelY - targetPos.top) <= radiusPx
            );
            if (!victims.some(m => m.id === target.id)) victims.unshift(target);

            for (let i = 0; i < victims.length; i++) {
                const m = victims[i];
                applyHitToMonster(towerIndex, towerObj, m, {
                    damageScale: m.id === target.id ? 1.0 : 0.80
                });
                if (m.hp > 0 && MonsterSys) {
                    MonsterSys.applySlowToMonster(m, slowSpec.rate, slowSpec.durationMs, 'magnet_A');
                    if (isPullPulse && !m.isBoss) {
                        MonsterSys.pullMonsterAlongPath(m, pullCells);
                    }
                }
            }
            GameApp.renderer.emitCanvasAttackFX('magnet-arc', towerPos, targetPos, { frostRadiusPx: radiusPx });
            if (isPullPulse) {
                GameApp.renderer.emitRingFX(targetPos.left, targetPos.top, radiusPx, '#E0B43C', 0.25, 320);
            }
        },

        // T3 💠B 電磁超載樹：3 目標不同單位彈射 ＋ 附加 3.5s 感電 (+12 雷傷，0.35s 內置冷卻)
        magnet_B_overload(towerIndex, towerObj, cfg, target, towerPos, targetPos) {
            const fxParams = cfg.effectParams || {};
            const TreeSys = GameApp.systems && GameApp.systems.tree;
            const MonsterSys = GameApp.systems && GameApp.systems.monster;
            const chainRadiusPx = (fxParams.chainRadiusCells ?? 2.6) * G.boardMetrics.step;
            const stormExtra = (TreeSys && typeof TreeSys.getChainStormExtraBounces === 'function') ? TreeSys.getChainStormExtraBounces() : 0;
            const stormRadiusPx = (TreeSys && typeof TreeSys.getChainStormRadiusCells === 'function')
                ? TreeSys.getChainStormRadiusCells() * G.boardMetrics.step
                : chainRadiusPx;
            let totalTargets = (fxParams.chainTargets ?? 3) + (TreeSys ? TreeSys.getThunderChainBonus(towerObj.type) : 0);

            if (MonsterSys) MonsterSys.applyShockToMonster(target, fxParams, towerObj);
            applyHitToMonster(towerIndex, towerObj, target);
            if (target.hp <= 0 && stormExtra > 0) totalTargets += stormExtra;
            GameApp.renderer.emitCanvasAttackFX('magnet-arc', towerPos, targetPos);

            const hitSet = new Set([target.id]);
            let prevPos = targetPos;
            for (let b = 1; b < totalTargets; b++) {
                const searchRadius = b >= (fxParams.chainTargets ?? 3) ? stormRadiusPx : chainRadiusPx;
                let bestNext = null, bestDist = Infinity;
                for (let i = 0; i < G.state.monsters.length; i++) {
                    const cand = G.state.monsters[i];
                    if (cand.hp <= 0 || cand.isTargetable === false || hitSet.has(cand.id)) continue;
                    const d = Math.hypot(cand.pixelX - prevPos.left, cand.pixelY - prevPos.top);
                    if (d <= searchRadius && d < bestDist) { bestDist = d; bestNext = cand; }
                }
                if (!bestNext) break;
                hitSet.add(bestNext.id);
                const nextPos = { left: bestNext.pixelX, top: bestNext.pixelY };
                if (MonsterSys) MonsterSys.applyShockToMonster(bestNext, fxParams, towerObj);
                applyHitToMonster(towerIndex, towerObj, bestNext, { damageScale: fxParams.chainDamageRatio ?? 0.75 });
                if (bestNext.hp <= 0 && stormExtra > 0) totalTargets += stormExtra;
                GameApp.renderer.emitCanvasAttackFX('magnet-arc', prevPos, nextPos);
                prevPos = nextPos;
            }
        },

        // T2 電漿導管：無視 15% 護甲 ＋ 連續鎖定同一目標最高 4 層 (+12%/層)
        pierce_beam(towerIndex, towerObj, cfg, target, towerPos, targetPos) {
            const fxParams = cfg.effectParams || {};
            const maxStacks = fxParams.maxStacks ?? 4;
            const stackBonus = fxParams.stackBonus ?? 0.12;
            const armorPierce = fxParams.armorPierce ?? 0.15;
            towerObj.focusStacks = towerObj.focusTargetId === target.id
                ? Math.min(maxStacks, (towerObj.focusStacks || 0) + 1)
                : 0;
            towerObj.focusTargetId = target.id;
            applyHitToMonster(towerIndex, towerObj, target, {
                extraMult: 1 + towerObj.focusStacks * stackBonus,
                armorPierce
            });
            GameApp.renderer.emitCanvasAttackFX('plasma', towerPos, targetPos, { stacks: towerObj.focusStacks });
            if (G.state.selectedIndex === towerIndex) G.callbacks.updateTowerInspector();
        },

        // T3 ☄️A 聚變死光樹：最高疊 8 層鎖定 (+18%/層，最高 2.44x)，>=5 層附帶 45% 穿甲；切換目標僅掉 2 層不清零
        plasma_A_deathray(towerIndex, towerObj, cfg, target, towerPos, targetPos) {
            const fxParams = cfg.effectParams || {};
            const maxStacks = fxParams.maxStacks ?? 8;
            const stackBonus = fxParams.stackBonus ?? 0.18;
            const dropStacks = fxParams.switchDropStacks ?? 2;

            if (towerObj.focusTargetId === null) {
                towerObj.focusStacks = 1;
            } else if (towerObj.focusTargetId === target.id) {
                towerObj.focusStacks = Math.min(maxStacks, (towerObj.focusStacks || 0) + 1);
            } else {
                towerObj.focusStacks = Math.max(0, (towerObj.focusStacks || 0) - dropStacks);
            }
            towerObj.focusTargetId = target.id;

            const armorPierce = towerObj.focusStacks >= (fxParams.highStackThreshold ?? 5)
                ? (fxParams.highStackArmorPierce ?? 0.45)
                : 0;
            applyHitToMonster(towerIndex, towerObj, target, {
                extraMult: 1 + towerObj.focusStacks * stackBonus,
                armorPierce
            });
            GameApp.renderer.emitCanvasAttackFX('plasma', towerPos, targetPos, { stacks: towerObj.focusStacks });
            if (G.state.selectedIndex === towerIndex) G.callbacks.updateTowerInspector();
        },

        // T3 ☄️B 弧光折射樹：主光束最高 4 層 (+15%/層)，並向主目標 2.4 格內最多 2 名不同敵人折射 50% 副光束
        plasma_B_refract(towerIndex, towerObj, cfg, target, towerPos, targetPos) {
            const fxParams = cfg.effectParams || {};
            const maxStacks = fxParams.maxStacks ?? 4;
            const stackBonus = fxParams.stackBonus ?? 0.15;
            const refractRadiusPx = (fxParams.refractRadiusCells ?? 2.4) * G.boardMetrics.step;
            const refractRatio = fxParams.refractRatio ?? 0.50;
            const refractMax = fxParams.refractTargets ?? 2;

            towerObj.focusStacks = towerObj.focusTargetId === target.id
                ? Math.min(maxStacks, (towerObj.focusStacks || 0) + 1)
                : 0;
            towerObj.focusTargetId = target.id;

            applyHitToMonster(towerIndex, towerObj, target, {
                extraMult: 1 + towerObj.focusStacks * stackBonus
            });
            GameApp.renderer.emitCanvasAttackFX('plasma', towerPos, targetPos, { stacks: towerObj.focusStacks });

            const candidates = [];
            for (let i = 0; i < G.state.monsters.length; i++) {
                const cand = G.state.monsters[i];
                if (cand.id === target.id || cand.hp <= 0 || cand.isTargetable === false) continue;
                const d = Math.hypot(cand.pixelX - targetPos.left, cand.pixelY - targetPos.top);
                if (d <= refractRadiusPx) {
                    candidates.push({ monster: cand, dist: d });
                }
            }
            candidates.sort((a, b) => a.dist - b.dist);
            const hitCount = Math.min(refractMax, candidates.length);
            for (let k = 0; k < hitCount; k++) {
                const sub = candidates[k].monster;
                const subPos = { left: sub.pixelX, top: sub.pixelY };
                applyHitToMonster(towerIndex, towerObj, sub, {
                    damageScale: refractRatio
                });
                GameApp.renderer.emitCanvasAttackFX('plasma', targetPos, subPos, { stacks: 1 });
            }
            if (G.state.selectedIndex === towerIndex) G.callbacks.updateTowerInspector();
        }
    };

    function performTowerAttack(towerIndex, towerObj) {
        const Renderer = GameApp.renderer, coords = indexToCoords(towerIndex);
        const towerPos = Renderer.getCellCenter(coords.x, coords.y);
        const isLv3 = towerObj.tier >= getMaxTier();
        const cfg = getTowerCfg(towerObj.type, towerObj.tier) || { attackStyle: 'burst_armor_break', effectParams: {} };
        const style = cfg.attackStyle || 'burst_armor_break';

        if (style === 'chain_lightning') {
            return fireLightningBolt(towerIndex, towerObj);
        }

        const target = findBestTargetInRange(towerIndex, towerObj);
        if (!target) return false;
        const targetPos = { left: target.pixelX, top: target.pixelY };
        Renderer.updateTowerAimVisual(towerIndex, towerObj, towerPos, targetPos);

        const handler = ATTACK_STYLE_HANDLERS[style] || ATTACK_STYLE_HANDLERS.burst_armor_break;
        handler(towerIndex, towerObj, cfg, target, towerPos, targetPos, isLv3);

        GameApp.audio.playTowerShot(towerObj.type);
        return true;
    }

    function updateTowersCombat(dtMs) {
        if (!G.callbacks.isGameplayActive()) return;
        const st = G.state;
        let didCombatAct = false;

        if (st.pendingBolts.length > 0) {
            const prevQueue = st.pendingBolts, remainingQueue = [];
            st.pendingBolts = [];
            for (let i = 0; i < prevQueue.length; i++) {
                const bolt = prevQueue[i];
                if (bolt.sessionId !== st.sessionId || !G.callbacks.isGameplayActive()) continue;
                bolt.remainingMs -= dtMs;
                if (bolt.remainingMs <= 0) {
                    if (fireLightningBolt(bolt.towerIndex, bolt.towerObj)) didCombatAct = true;
                } else {
                    remainingQueue.push(bolt);
                }
            }
            st.pendingBolts = remainingQueue.concat(st.pendingBolts);
        }

        if (Array.isArray(st.pendingOverchargeShots) && st.pendingOverchargeShots.length > 0) {
            const prevShots = st.pendingOverchargeShots;
            const remainShots = [];
            st.pendingOverchargeShots = [];
            for (let i = 0; i < prevShots.length; i++) {
                const shot = prevShots[i];
                if (shot.sessionId !== st.sessionId || !G.callbacks.isGameplayActive()) continue;
                shot.remainingMs -= dtMs;
                if (shot.remainingMs <= 0) {
                    if (st.board[shot.towerIndex] === shot.towerObj && st.monsters.length > 0) {
                        if (performTowerAttack(shot.towerIndex, shot.towerObj)) didCombatAct = true;
                    }
                } else {
                    remainShots.push(shot);
                }
            }
            st.pendingOverchargeShots = remainShots.concat(st.pendingOverchargeShots);
        }

        const TreeSys = GameApp.systems && GameApp.systems.tree;
        if (st.monsters.length > 0 || st.waveState === 'SPAWNING') {
            for (let idx = 0; idx < st.board.length; idx++) {
                const towerObj = st.board[idx];
                if (towerObj === null) continue;
                if (!Number.isFinite(towerObj.accMs)) towerObj.accMs = 0;
                const intervalMs = getTowerAttackInterval(towerObj, idx);
                towerObj.accMs = Math.min(intervalMs, towerObj.accMs + dtMs);
                if (towerObj.accMs >= intervalMs && st.monsters.length > 0 && performTowerAttack(idx, towerObj)) {
                    towerObj.accMs -= intervalMs;
                    didCombatAct = true;
                    if (TreeSys && typeof TreeSys.shouldTriggerDewOvercharge === 'function' && TreeSys.shouldTriggerDewOvercharge()) {
                        if (!Array.isArray(st.pendingOverchargeShots)) st.pendingOverchargeShots = [];
                        st.pendingOverchargeShots.push({
                            towerIndex: idx,
                            towerObj,
                            remainingMs: 110,
                            sessionId: st.sessionId
                        });
                    }
                }
            }
        }
        if (didCombatAct) GameApp.renderer.renderMonsterLayer();
    }

    const TowerAttackSystem = {
        bind,
        getTowerCfg,
        getTowerBaseRangeCells,
        getTowerEffectiveRangeCells,
        getTowerRangePx,
        getTowerAttackInterval,
        getThunderChainScales,
        createTowerObj,
        recordTowerDamage,
        getTowerInspectorStats,
        getTowerHoverTooltipData,
        pickSmartSpawnIndex,
        isMonsterPreferred,
        findBestTargetInRange,
        calculateDamage,
        applyHitToMonster,
        fireThunderBolt: fireLightningBolt,
        performTowerAttack,
        updateTowersCombat
    };

    GameApp.systems = GameApp.systems || {};
    GameApp.systems.towerAttack = TowerAttackSystem;
    GameApp.systems.towers = TowerAttackSystem;
})(window);
