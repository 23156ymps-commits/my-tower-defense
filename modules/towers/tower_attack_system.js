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
        return (GameApp.data && GameApp.data.evolutions && GameApp.data.evolutions.MAX_TIER) || 5;
    }

    function getScionAuraAtCell(cellIndex) {
        const zeroAura = { active: false, speedBonus: 0, rangeBonus: 0, powerBonus: 0 };
        if (!G || !G.state || !Array.isArray(G.state.board) || cellIndex === null || cellIndex === undefined) {
            return zeroAura;
        }
        const econData = (GameApp.data && GameApp.data.economy) || {};
        const radiusCells = Number.isFinite(econData.SCION_AURA_RADIUS_CELLS) ? econData.SCION_AURA_RADIUS_CELLS : 2.2;
        const speedBonus = Number.isFinite(econData.SCION_AURA_SPEED_BONUS) ? econData.SCION_AURA_SPEED_BONUS : 0.16;
        const rangeBonus = Number.isFinite(econData.SCION_AURA_RANGE_BONUS) ? econData.SCION_AURA_RANGE_BONUS : 0.30;
        const powerBonus = Number.isFinite(econData.SCION_AURA_POWER_BONUS) ? econData.SCION_AURA_POWER_BONUS : 0.08;

        const targetCoords = indexToCoords(cellIndex);
        if (!targetCoords) return zeroAura;
        for (let i = 0; i < G.state.board.length; i++) {
            if (i === cellIndex) continue;
            const ally = G.state.board[i];
            if (!ally || (Number(ally.tier) || 1) < 5) continue;
            const c = indexToCoords(i);
            if (!c) continue;
            if (Math.hypot(targetCoords.x - c.x, targetCoords.y - c.y) <= radiusCells + 0.001) {
                return { active: true, speedBonus, rangeBonus, powerBonus };
            }
        }
        return zeroAura;
    }

    function getTowerBaseRangeCells(towerObj) {
        const tier = towerObj && Number.isFinite(towerObj.tier) ? towerObj.tier : 1;
        const cfg = towerObj ? getTowerCfg(towerObj.type, tier) : null;
        if (!cfg) return 2.0;
        let baseRange = clampNumber(cfg.range, 0.5, 15.0, 2.0);
        if (Array.isArray(cfg.tierRange) && Number.isFinite(cfg.tierRange[tier]) && cfg.tierRange[tier] > 0) {
            baseRange = clampNumber(cfg.tierRange[tier], 0.5, 15.0, 2.0);
        }
        return baseRange;
    }

    function getTowerEffectiveRangeCells(index, towerObj) {
        const baseRange = getTowerBaseRangeCells(towerObj);
        const aura = (index !== null && index !== undefined) ? getScionAuraAtCell(index) : null;
        const auraRange = (aura && aura.active) ? aura.rangeBonus : 0;
        const TerrainSys = GameApp.systems && GameApp.systems.terrain;
        const rangeMult = (TerrainSys && index !== null && index !== undefined)
            ? TerrainSys.getTerrainBonusesAt(index).rangeMult
            : 1.0;
        return Math.min(15.0, (baseRange + auraRange) * rangeMult);
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

        const aura = (index !== null && index !== undefined) ? getScionAuraAtCell(index) : null;
        if (aura && aura.active) {
            speedMult *= (1 + aura.speedBonus);
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

        const actualTier = cfg.nodeTier || resolvedTier;
        const isHybridBase = Boolean(cfg.isHybrid && actualTier <= 2);
        const defaultU = isHybridBase
            ? (actualTier === 1 ? 2 : 3)
            : ((td.STAR_NUTRITION_U && td.STAR_NUTRITION_U[actualTier]) || Math.pow(2, Math.max(0, actualTier - 1)));
        const nutritionU = Number.isFinite(options.nutritionU) ? Math.max(defaultU, options.nutritionU) : defaultU;
        const defaultPath = Array.isArray(cfg.defaultLineagePath) ? cfg.defaultLineagePath.slice() : [cfg.shortName || cfg.name || normalizedType];

        return {
            uid: options.uid || st.towerUidCounter++,
            type: normalizedType,
            tier: actualTier,
            nutritionU,
            costShare: Number.isFinite(options.costShare) ? options.costShare : (cfg.costShare || defaultU),
            lineagePath: Array.isArray(options.lineagePath) && options.lineagePath.length > 0 ? options.lineagePath.slice() : defaultPath,
            accMs,
            scionPulseAccMs: Number.isFinite(options.scionPulseAccMs) ? options.scionPulseAccMs : 0,
            infusionCount: Math.max(0, Math.floor(Number(options.infusionCount) || 0)),
            investedGold,
            targetMode: options.targetMode || 'first',
            totalDamage: Number.isFinite(options.totalDamage) ? options.totalDamage : 0,
            aimAngleDeg: Number.isFinite(options.aimAngleDeg) ? options.aimAngleDeg : 0,
            shotCounter: 0,
            focusTargetId: null,
            focusStacks: 0,
            isCrowned: Boolean(options.isCrowned || actualTier >= 5 || cfg.isScion),
            stunnedMs: Number.isFinite(options.stunnedMs) ? options.stunnedMs : 0
        };
    }

    function recordTowerDamage(towerObj, damageAmount, damageCategory = 'single') {
        if (!towerObj || !Number.isFinite(damageAmount) || damageAmount <= 0) return;
        towerObj.totalDamage = (towerObj.totalDamage || 0) + damageAmount;
        G.state.totalTeamDamage += damageAmount;
        if (GameApp.backend && typeof GameApp.backend.recordDamageByType === 'function') {
            GameApp.backend.recordDamageByType(damageCategory, damageAmount);
        }
        const cfg = getTowerCfg(towerObj.type, towerObj.tier);
        if (!G.state.peakTowerSnapshot || towerObj.totalDamage >= G.state.peakTowerSnapshot.totalDamage) {
            G.state.peakTowerSnapshot = {
                uid: towerObj.uid,
                type: towerObj.type,
                tier: towerObj.tier,
                isCrowned: Boolean(towerObj.isCrowned),
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
        return scales;
    }

    function getBaseDamageForTower(towerObj, cfg) {
        const towersData = getTowersData();
        const tier = (towerObj && Number.isFinite(towerObj.tier)) ? towerObj.tier : ((cfg && cfg.nodeTier) || 1);
        const nutritionU = towerObj && Number.isFinite(towerObj.nutritionU) ? towerObj.nutritionU : null;
        if (typeof towersData.calculateUnitTierDamage === 'function') {
            return towersData.calculateUnitTierDamage(cfg || (towerObj && towerObj.type), nutritionU, tier);
        }
        if (cfg && Number.isFinite(cfg.damage) && !cfg.isAlias) {
            return cfg.damage;
        }
        const dmgRow = (towersData.TIER_DAMAGE_TABLE && towersData.TIER_DAMAGE_TABLE[towerObj.type]) || (cfg && cfg.tierDamage);
        return (dmgRow && dmgRow[tier]) || (cfg && cfg.damage) || 15;
    }

    /**
     * 無盡靈脈灌注預留計算函式 b_infusion(k)：
     *   第 k 次費用：150 + 75 * k
     *   1 <= k <= 5：0.12 * k
     *   k > 5：0.60 + 0.07 * (k - 5)
     */
    function b_infusion(k = 0) {
        const count = Math.max(0, Math.floor(Number(k) || 0));
        if (count <= 0) return 0;
        if (count <= 5) return Number((0.12 * count).toFixed(4));
        return Number((0.60 + 0.07 * (count - 5)).toFixed(4));
    }

    function getInfusionCost(k = 1) {
        const step = Math.max(1, Math.floor(Number(k) || 1));
        return 150 + 75 * step;
    }

    /**
     * 自身戰力加法桶 B_power = b_terrain + b_blessing + b_dividend + b_infusion(k)
     * （地形上限 0.25、賜福上限 0.30、持股紅利預留欄位上限 0.24）
     */
    function computePowerBucket(towerObj = null, monster = null, options = {}) {
        const constants = getTowersData().COMBAT_CONSTANTS || {};
        const terrainCap = Number.isFinite(constants.POWER_TERRAIN_CAP) ? constants.POWER_TERRAIN_CAP : 0.25;
        const blessingCap = Number.isFinite(constants.POWER_BLESSING_CAP) ? constants.POWER_BLESSING_CAP : 0.30;
        const dividendCap = Number.isFinite(constants.POWER_DIVIDEND_CAP) ? constants.POWER_DIVIDEND_CAP : 0.24;

        const cfg = towerObj ? (getTowerCfg(towerObj.type, towerObj.tier) || {}) : {};
        const family = cfg.family || (towerObj && towerObj.type) || '';
        const lineageTags = Array.isArray(cfg.lineageTags) ? cfg.lineageTags : [];
        const isIceLineage = family === 'ice' || family === 'steam' || family === 'magnet' || lineageTags.includes('ice');
        const WaveSys = GameApp.systems && GameApp.systems.wave;
        const mapSpec = (G && G.map && G.map.spec) || (WaveSys && typeof WaveSys.getCurrentMapSpec === 'function' ? WaveSys.getCurrentMapSpec() : null);
        const mapIceBonus = (mapSpec && Number.isFinite(mapSpec.iceDamageBonus) && isIceLineage) ? Math.max(0, mapSpec.iceDamageBonus) : 0;

        const rawTerrain = Number.isFinite(options.b_terrain)
            ? options.b_terrain
            : Math.max(0, ((options.terrainMult ?? 1.0) - 1) + mapIceBonus);
        const b_terrain = Math.min(terrainCap, Math.max(0, rawTerrain));

        const TreeSys = GameApp.systems && GameApp.systems.tree;
        const resonanceBonus = (TreeSys && monster && typeof TreeSys.getElementalResonanceMult === 'function')
            ? Math.max(0, TreeSys.getElementalResonanceMult(towerObj, monster) - 1)
            : 0;
        const scionAura = (options.cellIndex !== undefined && options.cellIndex !== null)
            ? getScionAuraAtCell(options.cellIndex)
            : null;
        const auraPowerBonus = (scionAura && scionAura.active) ? scionAura.powerBonus : 0;
        const bloodPactBonus = (TreeSys && typeof TreeSys.getBloodPactPowerBonus === 'function')
            ? TreeSys.getBloodPactPowerBonus()
            : 0;
        const rawBlessing = Number.isFinite(options.b_blessing)
            ? options.b_blessing
            : (resonanceBonus + auraPowerBonus + ((G && G.state && Number(G.state.blessingPowerBonus)) || 0) + bloodPactBonus);
        const b_blessing = Math.min(blessingCap, Math.max(0, rawBlessing));

        const EconSys = GameApp.systems && GameApp.systems.economy;
        const stockDividend = (EconSys && towerObj && typeof EconSys.getTowerDividendBonus === 'function')
            ? EconSys.getTowerDividendBonus(towerObj)
            : 0;
        const rawDividend = Number.isFinite(options.b_dividend)
            ? options.b_dividend
            : (stockDividend + ((G && G.state && Number(G.state.dividendBonus)) || 0));
        const b_dividend = Math.min(dividendCap, Math.max(0, rawDividend));

        const infusionK = Number.isFinite(options.infusionCount)
            ? options.infusionCount
            : (Number.isFinite(options.k)
                ? options.k
                : ((towerObj && Number.isFinite(towerObj.infusionCount))
                    ? towerObj.infusionCount
                    : ((G && G.state && Number(G.state.infusionCount)) || 0)));
        const b_inf = Number.isFinite(options.b_infusion) ? Math.max(0, options.b_infusion) : b_infusion(infusionK);

        const B_power = b_terrain + b_blessing + b_dividend + b_inf;
        return {
            b_terrain,
            b_blessing,
            b_dividend,
            b_infusion: b_inf,
            B_power
        };
    }

    function getTowerInspectorStats(index, towerObj) {
        const cfg = getTowerCfg(towerObj.type, towerObj.tier) || {};
        const baseDmg = getBaseDamageForTower(towerObj, cfg);
        const intervalSec = Math.max(0.12, getTowerAttackInterval(towerObj, index) / 1000);
        const fxParams = cfg.effectParams || {};
        const TerrainSys = GameApp.systems && GameApp.systems.terrain;
        const style = cfg.attackStyle || 'burst_armor_break';

        let singleHitFactor = 1.0;
        if (style === 'pierce_beam' || style === 'plasma_A_deathray' || style === 'plasma_B_refract' || style === 'plasma_twin') {
            singleHitFactor = 1 + (towerObj.focusStacks || 0) * (fxParams.stackBonus || 0.12);
        } else if (style === 'thunder_B_judgment' || style === 'thunder_twin') {
            const everyN = fxParams.judgmentEveryN || 3;
            const mult = fxParams.judgmentMult || 2.5;
            singleHitFactor = ((everyN - 1) + mult) / everyN;
        }

        const terrainBonuses = TerrainSys ? TerrainSys.getTerrainBonusesAt(index) : { damageMult: 1.0, terrainType: null };
        const powerBucket = computePowerBucket(towerObj, null, { terrainMult: terrainBonuses.damageMult, cellIndex: index });
        const scionAura = (index !== null && index !== undefined) ? getScionAuraAtCell(index) : { active: false };
        const unitDmg = baseDmg * (1 + powerBucket.B_power);
        let singleDps = Math.round((unitDmg * singleHitFactor) / intervalSec);
        if (style === 'fire_B_ember' || style === 'fire_twin') {
            singleDps += Math.round((fxParams.burnFlatDps || 8) * 2);
        }

        const isEn = Boolean(GameApp.i18n && GameApp.i18n.isEnglish());
        let aoeDps = null;
        let aoeLabel = null;
        if (style === 'chain_lightning' || style === 'thunder_twin') {
            const chainTotalMult = getThunderChainScales(towerObj, cfg).reduce((sum, s) => sum + s, 0);
            aoeDps = Math.round((unitDmg * singleHitFactor * chainTotalMult) / intervalSec);
            aoeLabel = isEn ? 'Chain' : '連鎖';
        } else if (style === 'stun_pulse' || style === 'magnet_B_overload') {
            const extraChain = (fxParams.chainTargets ? fxParams.chainTargets - 1 : (fxParams.chainExtraTargets ?? 2));
            const chainRatio = fxParams.chainDamageRatio ?? 0.70;
            const dynShockDmg = Math.round(10 + 2.5 * Math.max(1, (G && G.state && Number(G.state.currentWave)) || 1));
            const shockExtra = style === 'magnet_B_overload' ? dynShockDmg * 2 : 0;
            aoeDps = Math.round((unitDmg * (1 + extraChain * chainRatio)) / intervalSec + shockExtra);
            aoeLabel = isEn ? 'Chain' : '連鎖';
        } else if (style === 'magnet_twin') {
            const extraChain = (fxParams.chainTargets ? fxParams.chainTargets - 1 : 2);
            const chainRatio = fxParams.chainDamageRatio ?? 0.75;
            const dynShockDmg = Math.round(10 + 2.5 * Math.max(1, (G && G.state && Number(G.state.currentWave)) || 1));
            aoeDps = Math.round((unitDmg * (2.4 + extraChain * chainRatio)) / intervalSec + dynShockDmg * 2);
            aoeLabel = isEn ? 'Twin AoE' : '雙生';
        } else if (style === 'aoe_mist' || style === 'fire_A_mortar' || style === 'steam_A_pressure' || style === 'fire_twin' || style === 'steam_twin') {
            const splashRatio = fxParams.splashRatio ?? 0.65;
            const poolDps = (style === 'steam_A_pressure' || style === 'steam_twin') ? (fxParams.poolDps || 28) * 2 : 0;
            const burnBonus = style === 'fire_twin' ? (fxParams.burnFlatDps || 8) * 2 : 0;
            aoeDps = Math.round((unitDmg * (1 + 2 * splashRatio)) / intervalSec + poolDps + burnBonus);
            aoeLabel = isEn ? 'AoE' : '群傷';
        } else if (style === 'ice_A_permafrost' || style === 'steam_B_fog' || style === 'magnet_A_singularity' || style === 'ice_twin') {
            aoeDps = Math.round((unitDmg * (style === 'ice_twin' ? 2.75 : 2.4)) / intervalSec);
            aoeLabel = isEn ? 'AoE' : '群傷';
        } else if (style === 'ice_B_icicle') {
            const secondRatio = fxParams.secondTargetRatio ?? 0.60;
            aoeDps = Math.round((unitDmg * (1 + secondRatio)) / intervalSec);
            aoeLabel = isEn ? 'Pierce' : '穿透';
        } else if (style === 'plasma_B_refract' || style === 'plasma_twin') {
            const refCount = fxParams.refractTargets ?? 2;
            const refRatio = fxParams.refractRatio ?? 0.50;
            aoeDps = Math.round((unitDmg * (singleHitFactor + refCount * refRatio)) / intervalSec);
            aoeLabel = isEn ? 'Refract' : '折射';
        } else if (style === 'fire_B_ember') {
            aoeDps = Math.round(singleDps * 2.1);
            aoeLabel = isEn ? 'Burn AoE' : '灼燒';
        } else if (style === 'tri_storm_cloud') {
            aoeDps = Math.round(singleDps + (fxParams.cloudDps || 60.3) * 3);
            aoeLabel = isEn ? 'Cloud AoE' : '雷雲群傷';
        } else if (style === 'tri_starforge_nova') {
            aoeDps = Math.round((unitDmg * (1 + 2 * (fxParams.splashRatio || 0.80))) / intervalSec);
            aoeLabel = isEn ? 'Nova AoE' : '超新星';
        } else if (style === 'tri_prism_zero') {
            const refCount = fxParams.refractTargets ?? 2;
            const refRatio = fxParams.refractRatio ?? 0.547;
            aoeDps = Math.round((unitDmg * (1 + refCount * refRatio)) / intervalSec);
            aoeLabel = isEn ? '3-Beam' : '三束折射';
        } else if (style === 'primal_genesis') {
            aoeDps = Math.round((unitDmg * (1 + 2.5 * (fxParams.splashRatio || 0.72))) / intervalSec);
            aoeLabel = isEn ? 'Genesis' : '創世群傷';
        }

        return {
            dps: singleDps,
            aoeDps,
            aoeLabel,
            rangeStr: Number(getTowerEffectiveRangeCells(index, towerObj).toFixed(2)).toString(),
            terrainType: terrainBonuses.terrainType,
            damageMult: terrainBonuses.damageMult,
            hasScionAura: Boolean(scionAura && scionAura.active),
            baseDmg
        };
    }

    function getTowerHoverTooltipData(index, towerObj) {
        if (!towerObj) return null;
        const cfg = getTowerCfg(towerObj.type, towerObj.tier) || {};
        const baseDmg = getBaseDamageForTower(towerObj, cfg);
        const TerrainSys = GameApp.systems && GameApp.systems.terrain;
        const terrainBonuses = (TerrainSys && index !== null && index !== undefined)
            ? TerrainSys.getTerrainBonusesAt(index)
            : { damageMult: 1.0, terrainType: null };
        const powerBucket = computePowerBucket(towerObj, null, { terrainMult: terrainBonuses.damageMult, cellIndex: index });
        const effDmg = Math.max(1, Math.round(baseDmg * (1 + powerBucket.B_power)));
        const intervalSec = (Math.max(120, getTowerAttackInterval(towerObj, index)) / 1000).toFixed(2);
        const effRange = Number(getTowerEffectiveRangeCells(index, towerObj).toFixed(2)).toString();
        const stars = GameApp.renderer && typeof GameApp.renderer.getTierStars === 'function'
            ? GameApp.renderer.getTierStars(towerObj.tier)
            : '★'.repeat(Math.max(1, Math.min(5, towerObj.tier || 1)));
        const desc = cfg.tooltipSummary || cfg.roleSummary || (Array.isArray(cfg.badges) ? cfg.badges.join(' · ') : '');
        const isEn = Boolean(GameApp.i18n && GameApp.i18n.isEnglish());

        const EvoSys = GameApp.systems && GameApp.systems.evolution;
        const curU = (EvoSys && typeof EvoSys.getTowerNutritionU === 'function')
            ? EvoSys.getTowerNutritionU(towerObj)
            : (towerObj.nutritionU || 1);
        const nextU = (EvoSys && typeof EvoSys.getNextStarTargetU === 'function')
            ? EvoSys.getNextStarTargetU(towerObj.tier)
            : null;
        const growthTag = (towerObj.tier === 3 || towerObj.tier === 4) && nextU
            ? ` (${curU}/${nextU} U)`
            : '';
        const tierLabel = cfg.isPrimalCore
            ? (isEn ? '5★ Primal Core' : '5★ 原初之核')
            : (towerObj.tier >= 5
                ? (isEn ? '5★ Scion' : '5★ 神裔')
                : (cfg.isTwinCrown ? (isEn ? '4★ Twin AB' : '4★ 雙生AB') : `${stars}${growthTag}`));
        const scionAura = (index !== null && index !== undefined) ? getScionAuraAtCell(index) : null;
        const extraTags = [];
        if (cfg.isTriElement) {
            extraTags.push(isEn ? 'Tri 1.26x' : '三元 1.26x');
        }
        if ((towerObj.infusionCount || 0) > 0) {
            extraTags.push(isEn ? `Infuse +${towerObj.infusionCount}` : `灌注 +${towerObj.infusionCount}`);
        }
        if (scionAura && scionAura.active) {
            extraTags.push(isEn ? 'Scion Aura' : '神裔光環');
        }
        const extraStr = extraTags.length > 0 ? `${isEn ? ' | ' : ' ｜ '}${extraTags.join(' · ')}` : '';
        const statsLine = isEn
            ? `DMG ${effDmg} | CD ${intervalSec}s | Rng ${effRange}`
            : `單發 ${effDmg} ｜ 攻速 ${intervalSec}s ｜ 射程 ${effRange}`;

        return {
            nameLine: `${cfg.icon || '✨'} ${cfg.name || towerObj.type} · ${tierLabel}`,
            statsLine,
            descLine: `${desc}${extraStr}`
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
        const randIdx = Math.floor(((GameApp.helpers && typeof GameApp.helpers.nextRunRandom === 'function') ? GameApp.helpers.nextRunRandom() : Math.random()) * bestPool.length);
        return { index: bestPool[randIdx], mode: bestCoverage > 0 ? 'near-path' : 'fallback' };
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

    /**
     * 四桶分離最終傷害公式（不連乘膨脹）：
     *   D_final = Math.max(1, Math.round(D_tier * M_elem * M_armor * (1 + B_power) * (1 + B_vuln)))
     *   A_eff = Math.max(0, A_base * (1 - R_shred) * (1 - P_pierce))
     *   M_armor = 35 / (35 + A_eff)
     *   B_power = b_terrain + b_blessing + b_dividend + b_infusion(k)
     *   B_vuln = Math.min(0.60, v_root + v_frost_mist + v_brand)
     */
    function calculateDamage(towerObj, monster, options = {}) {
        const towersData = getTowersData();
        const cfg = (towerObj && getTowerCfg(towerObj.type, towerObj.tier)) || {};
        const baseDmg = getBaseDamageForTower(towerObj || {}, cfg);
        const D_tier = Number.isFinite(options.D_tier)
            ? options.D_tier
            : baseDmg * (options.damageScale ?? 1.0) * (options.extraMult ?? 1.0);

        const MonsterSys = GameApp.systems && GameApp.systems.monster;

        const towerElementTag = cfg.elementTag || (towerObj && towerObj.type);
        const lineageTags = Array.isArray(cfg.lineageTags) ? cfg.lineageTags : [];
        const isTriElement = Boolean(cfg.isTriElement || cfg.isPrimalCore);
        const isWeakness = Boolean((!cfg.isHybrid && !isTriElement) && monster && monster.weakness && towerElementTag === monster.weakness);
        const isAffinity = Boolean((isTriElement && monster) || (cfg.isHybrid && monster && monster.weakness && lineageTags.includes(monster.weakness)));

        const constants = towersData.COMBAT_CONSTANTS || {};
        const weaknessMult = Number.isFinite(constants.WEAKNESS_MULTIPLIER) ? constants.WEAKNESS_MULTIPLIER : 1.75;
        const affinityMult = Number.isFinite(constants.HYBRID_AFFINITY_MULTIPLIER) ? constants.HYBRID_AFFINITY_MULTIPLIER : 1.35;
        const triAffinityMult = Number.isFinite(constants.TRIELEMENT_AFFINITY_MULTIPLIER) ? constants.TRIELEMENT_AFFINITY_MULTIPLIER : 1.26;
        const M_elem = Number.isFinite(options.M_elem)
            ? options.M_elem
            : (isTriElement ? (monster ? triAffinityMult : 1.0) : (isWeakness ? weaknessMult : (isAffinity ? affinityMult : 1.0)));

        const family = cfg.family || (towerObj && towerObj.type);
        let P_pierce = Math.max(0, Math.min(1, Number(options.P_pierce ?? options.armorPierce) || 0));
        if (towerObj && towerObj.isCrowned && (family === 'steam' || towerObj.type === 'steam_bud')) {
            P_pierce = Math.min(1.0, P_pierce + 0.25);
        }
        const A_base = Math.max(0, Number(options.A_base ?? (monster && (monster.A_base ?? monster.armor))) || 0);
        const R_shred = Number.isFinite(options.R_shred)
            ? Math.max(0, Math.min(1, Number(options.R_shred)))
            : ((monster && Number.isFinite(monster.R_shred))
                ? Math.max(0, Math.min(1, Number(monster.R_shred)))
                : ((monster && monster.armorShredTimer > 0) ? Math.max(0, Math.min(1, Number(monster.armorShredRate) || 0.30)) : 0));

        const A_eff = Math.max(0, A_base * (1 - R_shred) * (1 - P_pierce));
        const M_armor = Number.isFinite(options.M_armor) ? options.M_armor : (35 / (35 + A_eff));

        const powerInfo = computePowerBucket(towerObj, monster, options);
        const B_power = Number.isFinite(options.B_power) ? options.B_power : powerInfo.B_power;

        const B_vuln = Number.isFinite(options.B_vuln)
            ? Math.min(0.60, Math.max(0, Number(options.B_vuln)))
            : (MonsterSys && typeof MonsterSys.getMonsterVulnerabilityBonus === 'function'
                ? MonsterSys.getMonsterVulnerabilityBonus(monster)
                : Math.min(0.60, ((monster && (monster.rootTimer || 0) > 0) ? (monster.rootVulnRate || 0) : 0)));

        const D_final = Math.max(1, Math.round(D_tier * M_elem * M_armor * (1 + B_power) * (1 + B_vuln)));

        return {
            damage: D_final,
            D_final,
            D_tier,
            M_elem,
            A_eff,
            M_armor,
            B_power,
            B_vuln,
            powerBreakdown: powerInfo,
            isWeakness,
            isAffinity
        };
    }

    function maybeRevealByAoE(monster) {
        if (!monster || !monster.isStealthed) return;
        const MonsterSys = GameApp.systems && GameApp.systems.monster;
        if (MonsterSys && typeof MonsterSys.revealStealthMonster === 'function') {
            const isEn = Boolean(GameApp.i18n && GameApp.i18n.isEnglish());
            MonsterSys.revealStealthMonster(monster, isEn ? 'Revealed' : '破隱現形');
        }
    }

    function applyHitToMonster(towerIndex, towerObj, monster, options = {}) {
        if (!monster || monster.hp <= 0 || (monster.isTargetable === false && !options.allowStealthed)) return null;
        if (monster.isStealthed && options.allowStealthed) {
            maybeRevealByAoE(monster);
        }
        const TerrainSys = GameApp.systems && GameApp.systems.terrain;
        const MonsterSys = GameApp.systems && GameApp.systems.monster;
        const TreeSys = GameApp.systems && GameApp.systems.tree;
        const cfg = getTowerCfg(towerObj.type, towerObj.tier) || {};
        const fxParams = cfg.effectParams || {};
        const family = cfg.family || towerObj.type;
        const lineageTags = Array.isArray(cfg.lineageTags) ? cfg.lineageTags : [];

        const armorPierce = options.armorPierce ?? (fxParams.armorPierce || 0);
        if (TreeSys && typeof TreeSys.registerResonanceHit === 'function') {
            TreeSys.registerResonanceHit(towerObj, monster);
        }
        const terrainMult = options.terrainMult ?? (TerrainSys ? TerrainSys.getTowerTerrainDamageMult(towerIndex) : 1.0);
        const result = calculateDamage(towerObj, monster, {
            damageScale: options.damageScale ?? 1.0,
            terrainMult,
            cellIndex: towerIndex,
            extraMult: options.extraMult ?? 1.0,
            armorPierce
        });

        let finalDamage = result.damage;
        let isTeamCrit = false;
        const teamCritRate = (G && G.state && Number(G.state.teamCritBonusRate)) || 0;
        const critRoll = (GameApp.helpers && typeof GameApp.helpers.nextRunRandom === 'function') ? GameApp.helpers.nextRunRandom() : Math.random();
        if (!result.isWeakness && teamCritRate > 0 && !options.disableRandomCrit && critRoll < teamCritRate) {
            finalDamage = Math.max(1, Math.round(finalDamage * 1.5));
            isTeamCrit = true;
        }
        let shellReduced = false;
        if ((monster.shellHitsLeft || 0) > 0) {
            monster.shellHitsLeft -= 1;
            const red = Number.isFinite(monster.shellReduction) ? monster.shellReduction : 0.50;
            finalDamage = Math.max(1, Math.round(finalDamage * (1 - red)));
            shellReduced = true;
        } else if ((monster.hardShellHitsLeft || 0) > 0) {
            monster.hardShellHitsLeft -= 1;
            finalDamage = Math.max(1, Math.round(finalDamage * (monster.hardShellDmgMult ?? 0.5)));
            shellReduced = true;
        }

        const isShieldBreaker = family === 'thunder' || family === 'magnet' || family === 'plasma' || lineageTags.includes('thunder');
        let hpDmg = finalDamage;
        let shieldAbsorbed = 0;
        if ((monster.shield || 0) > 0) {
            const breakMult = isShieldBreaker ? (monster.shieldThunderMult || 1.40) : 1.0;
            const effectivePool = monster.shield / breakMult;
            if (finalDamage <= effectivePool) {
                shieldAbsorbed = Math.min(monster.shield, Math.round(finalDamage * breakMult));
                monster.shield = Math.max(0, monster.shield - shieldAbsorbed);
                hpDmg = 0;
            } else {
                shieldAbsorbed = monster.shield;
                monster.shield = 0;
                hpDmg = Math.max(1, Math.round(finalDamage - effectivePool));
            }
        }

        const hpBefore = monster.hp;
        monster.hp = Math.max(0, hpBefore - hpDmg);
        const dealtTotal = shieldAbsorbed + Math.min(hpBefore, hpDmg);
        recordTowerDamage(towerObj, dealtTotal, options.damageCategory || 'single');

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
            MonsterSys.applySlowToMonster(monster, baseRate, baseDur, options.slowSourceId || towerObj.type);
        }

        // T4 聖冠覺醒被動效果（依六大血脈分流）
        if (towerObj && towerObj.isCrowned && monster.hp > 0 && MonsterSys) {
            if (family === 'fire' && typeof MonsterSys.applyCrownTrueBurn === 'function') {
                MonsterSys.applyCrownTrueBurn(monster, towerObj, 0.015, 3000);
            } else if (family === 'ice') {
                MonsterSys.applyVulnerabilityToMonster(monster, 0.15, 2500, 'crown_ice');
                MonsterSys.applySlowToMonster(monster, 0.55, 2000, 'crown_ice');
            } else if (family === 'magnet') {
                const nowMs = G.state.elapsedPlayMs || 0;
                if (nowMs >= (monster._crownMagnetReadyAt || 0)) {
                    monster._crownMagnetReadyAt = nowMs + 4000;
                    const dur = monster.isBoss ? 600 : 1200;
                    monster.rootTimer = Math.max(monster.rootTimer || 0, dur);
                    if (GameApp.renderer) GameApp.renderer.spawnFloatingNotice((GameApp.i18n && GameApp.i18n.isEnglish()) ? '🧲 Magnet Root' : '🧲 磁場定身', monster.pixelX, monster.pixelY, 'pity-seed');
                }
            }
        }

        // 🔥 焦土烙印祝福：火系與蒸氣塔觸發破甲或暴擊時留下 2.5s 燃燒路徑
        if (TreeSys && typeof TreeSys.trySpawnScorchedBrand === 'function') {
            const didShredOrCrit = Boolean(willApplyShred || armorPierce > 0 || result.isWeakness || result.isAffinity);
            TreeSys.trySpawnScorchedBrand(towerObj, monster, didShredOrCrit);
        }

        const isEn = Boolean(GameApp.i18n && GameApp.i18n.isEnglish());
        const displayDmg = hpDmg > 0 ? hpDmg : shieldAbsorbed;
        const critTag = isTeamCrit ? (isEn ? 'Crit ' : '暴擊 ') : '';
        const dmgTag = options.dmgTag || critTag || (shellReduced ? (isEn ? 'Shell ' : '甲殼 ') : (shieldAbsorbed > 0 && hpDmg === 0 ? (isEn ? 'Shield ' : '破盾 ') : ''));
        GameApp.renderer.spawnDamageNumber(displayDmg, result.isWeakness || isTeamCrit, monster.pixelX, monster.pixelY, dmgTag, result.isAffinity);
        if (monster.hp > 0 && (result.isWeakness || result.isAffinity) && typeof GameApp.renderer.triggerMonsterHitFlash === 'function') {
            GameApp.renderer.triggerMonsterHitFlash(monster.id);
        }

        // 感電協同觸發：任何防禦塔命中感電怪額外觸發 +12 雷傷（單怪 0.35s 內置冷卻）
        if (monster.hp > 0 && MonsterSys && typeof MonsterSys.tryTriggerShockBonusDamage === 'function') {
            MonsterSys.tryTriggerShockBonusDamage(monster, towerObj);
        }

        // ❄️ 極寒碎冰祝福：處於減速或凍結狀態且血量低於 15% 時直接碎裂處決
        if (monster.hp > 0 && TreeSys && typeof TreeSys.shouldGlacialShatter === 'function' && TreeSys.shouldGlacialShatter(towerObj, monster)) {
            const shatterDmg = monster.hp;
            monster.hp = 0;
            recordTowerDamage(towerObj, shatterDmg);
            GameApp.renderer.spawnDamageNumber(shatterDmg, true, monster.pixelX, monster.pixelY, isEn ? 'Shatter ' : '碎冰 ');
            GameApp.renderer.emitParticleBurst(monster.pixelX, monster.pixelY, '#4A9EBF', 8, 85);
        }

        // T4 ⚡ 雷系聖冠被動：<10% 血量天雷斬殺（Boss 5%）
        if (monster.hp > 0 && towerObj && towerObj.isCrowned && family === 'thunder') {
            const crownExecPct = monster.isBoss ? 0.05 : 0.10;
            if ((monster.hp / Math.max(1, monster.maxHp)) < crownExecPct) {
                const execDmg = monster.hp;
                monster.hp = 0;
                recordTowerDamage(towerObj, execDmg);
                GameApp.renderer.spawnDamageNumber(execDmg, true, monster.pixelX, monster.pixelY, isEn ? '⚡Smite ' : '⚡天雷 ');
            }
        }

        // 焚世餘燼樹 (fire_B) <12% 血量處決
        if (monster.hp > 0 && options.executeThresholdPct > 0 && (monster.hp / Math.max(1, monster.maxHp)) < options.executeThresholdPct) {
            const execDmg = monster.hp;
            monster.hp = 0;
            recordTowerDamage(towerObj, execDmg);
            GameApp.renderer.spawnDamageNumber(execDmg, true, monster.pixelX, monster.pixelY, isEn ? 'Execute ' : '斬殺 ');
        }

        if (monster.hp > 0 && MonsterSys) {
            if (typeof MonsterSys.tryTriggerPantherStealth === 'function') {
                MonsterSys.tryTriggerPantherStealth(monster);
            }
            if (typeof MonsterSys.checkVoidBossPhaseShift === 'function') {
                MonsterSys.checkVoidBossPhaseShift(monster);
            }
        }

        if (monster.hp <= 0 && MonsterSys) {
            MonsterSys.handleMonsterKilled(monster, towerObj, dealtTotal);
        }
        return result;
    }

    function applySplashDamage(towerIndex, towerObj, targetPos, radiusPx, excludeId, hitOptions, slowParams = null) {
        const MonsterSys = GameApp.systems && GameApp.systems.monster;
        const targets = G.state.monsters.filter(m =>
            m.id !== excludeId && m.hp > 0 && (m.isTargetable !== false || m.isStealthed) && Math.hypot(m.pixelX - targetPos.left, m.pixelY - targetPos.top) <= radiusPx
        );
        const aoeHitOptions = Object.assign({}, hitOptions, { allowStealthed: true, damageCategory: 'aoe' });
        for (let i = 0; i < targets.length; i++) {
            applyHitToMonster(towerIndex, towerObj, targets[i], aoeHitOptions);
            if (slowParams && slowParams.rate > 0 && targets[i].hp > 0 && MonsterSys) {
                MonsterSys.applySlowToMonster(targets[i], slowParams.rate, slowParams.durationMs, slowParams.sourceId || towerObj.type);
            }
        }
    }

    function fireLightningBolt(towerIndex, towerObj, boltOptions = {}) {
        const st = G.state;
        if (!G.callbacks.isGameplayActive() || st.monsters.length === 0 || st.board[towerIndex] !== towerObj) return false;
        const primaryTarget = boltOptions.primaryTarget || findBestTargetInRange(towerIndex, towerObj);
        if (!primaryTarget) return false;

        const Renderer = GameApp.renderer;
        const coords = indexToCoords(towerIndex);
        const towerPos = Renderer.getCellCenter(coords.x, coords.y);
        const cfg = getTowerCfg(towerObj.type, towerObj.tier) || {};
        const fxParams = cfg.effectParams || {};
        const scales = boltOptions.scales || getThunderChainScales(towerObj, cfg);
        const chainRadiusPx = (fxParams.chainRadiusCells ?? 2.6) * G.boardMetrics.step;
        const isLv3 = towerObj.tier >= 3;

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
        applyHitToMonster(towerIndex, towerObj, primaryTarget, {
            damageScale: scales[0] ?? 1.0,
            extraMult: boltOptions.primaryExtraMult ?? 1.0,
            armorPierce: boltOptions.primaryArmorPierce ?? 0,
            dmgTag: boltOptions.primaryDmgTag || ''
        });
        if (primaryTarget.hp <= 0 && stormExtra > 0) {
            maxBounces += stormExtra;
        }
        Renderer.emitCanvasAttackFX(towerObj.type, towerPos, firstPos, { isLv3 });
        if (boltOptions.judgmentRingColor) {
            Renderer.emitRingFX(firstPos.left, firstPos.top, G.boardMetrics.step * 0.95, boltOptions.judgmentRingColor, 0.26, 260);
        }

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
            applyHitToMonster(towerIndex, towerObj, bestNext, { damageScale: scaleVal, damageCategory: 'aoe' });
            if (bestNext.hp <= 0 && stormExtra > 0) {
                maxBounces += stormExtra;
            }
            Renderer.emitCanvasAttackFX(towerObj.type, prevPos, nextPos, { isLv3 });
            prevPos = nextPos;
        }

        GameApp.audio.playTowerShot(towerObj.type);
        return true;
    }

    function findIcePierceSecondTarget(towerPos, targetPos, primaryTarget, fxParams) {
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
            if (cand.id === primaryTarget.id || cand.hp <= 0 || cand.isTargetable === false) continue;
            const relX = cand.pixelX - targetPos.left;
            const relY = cand.pixelY - targetPos.top;
            const dot = relX * ux + relY * uy;
            if (dot < 0) continue;
            const dist = Math.hypot(relX, relY);
            if (dist > maxSearchPx) continue;
            const perp = Math.abs(relX * (-uy) + relY * ux);
            const score = perp <= maxLineWidthPx ? dist : dist + perp * 1.5;
            if (score < bestScore) {
                bestScore = score;
                secondTarget = cand;
            }
        }
        return secondTarget;
    }

    function executePlasmaRefract(towerIndex, towerObj, target, targetPos, fxParams) {
        const refractRadiusPx = (fxParams.refractRadiusCells ?? 2.4) * G.boardMetrics.step;
        const refractRatio = fxParams.refractRatio ?? 0.50;
        const refractMax = fxParams.refractTargets ?? 2;
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
                damageScale: refractRatio,
                damageCategory: 'aoe'
            });
            GameApp.renderer.emitCanvasAttackFX('plasma', targetPos, subPos, { stacks: 1 });
        }
    }

    function executeMagnetChainBounce(towerIndex, towerObj, target, targetPos, fxParams, applyShock = false) {
        const TreeSys = GameApp.systems && GameApp.systems.tree;
        const MonsterSys = GameApp.systems && GameApp.systems.monster;
        const chainRadiusPx = (fxParams.chainRadiusCells ?? 2.6) * G.boardMetrics.step;
        const stormExtra = (TreeSys && typeof TreeSys.getChainStormExtraBounces === 'function') ? TreeSys.getChainStormExtraBounces() : 0;
        const stormRadiusPx = (TreeSys && typeof TreeSys.getChainStormRadiusCells === 'function')
            ? TreeSys.getChainStormRadiusCells() * G.boardMetrics.step
            : chainRadiusPx;
        const baseTargets = fxParams.chainTargets ?? 3;
        let totalTargets = baseTargets;

        if (applyShock && MonsterSys) MonsterSys.applyShockToMonster(target, fxParams, towerObj);
        const hitSet = new Set([target.id]);
        let prevPos = targetPos;
        for (let b = 1; b < totalTargets; b++) {
            const searchRadius = b >= baseTargets ? stormRadiusPx : chainRadiusPx;
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
            if (applyShock && MonsterSys) MonsterSys.applyShockToMonster(bestNext, fxParams, towerObj);
            applyHitToMonster(towerIndex, towerObj, bestNext, {
                damageScale: fxParams.chainDamageRatio ?? 0.75,
                damageCategory: 'aoe'
            });
            if (bestNext.hp <= 0 && stormExtra > 0) totalTargets += stormExtra;
            GameApp.renderer.emitCanvasAttackFX('magnet-arc', prevPos, nextPos);
            prevPos = nextPos;
        }
    }

    function triggerScionMapPulse(towerIndex, towerObj) {
        if (!G || !G.state || !Array.isArray(G.state.monsters) || G.state.monsters.length === 0) return false;
        const Renderer = GameApp.renderer;
        const coords = indexToCoords(towerIndex);
        if (!coords || !Renderer) return false;
        const towerPos = Renderer.getCellCenter(coords.x, coords.y);
        const cfg = getTowerCfg(towerObj.type, towerObj.tier) || {};
        const family = cfg.family || 'fire';
        const econData = (GameApp.data && GameApp.data.economy) || {};
        const ratio = Number.isFinite(econData.SCION_PULSE_DAMAGE_RATIO) ? econData.SCION_PULSE_DAMAGE_RATIO : 0.40;
        const MonsterSys = GameApp.systems && GameApp.systems.monster;
        const isEn = Boolean(GameApp.i18n && GameApp.i18n.isEnglish());

        let hitAny = false;
        const pulseMonsters = G.state.monsters.slice();
        for (let i = 0; i < pulseMonsters.length; i++) {
            const m = pulseMonsters[i];
            if (!m || m.hp <= 0 || m.isTargetable === false) continue;
            hitAny = true;
            if (MonsterSys) {
                if (family === 'fire') MonsterSys.applyBurnToMonster(m, { burnDps: 8, burnDurationMs: 2500 }, towerObj);
                else if (family === 'ice') MonsterSys.applySlowToMonster(m, 0.35, 2200, 'scion_pulse');
                else if (family === 'thunder' || family === 'magnet') MonsterSys.applyShockToMonster(m, { shockDurationMs: 2500, shockBonusBase: 10, shockBonusPerWave: 2.5 }, towerObj);
                else if (family === 'steam') MonsterSys.applyVulnerabilityToMonster(m, 0.12, 2400, 'scion_pulse');
                else if (family === 'plasma') MonsterSys.applyArmorShred(m, 0.25, 2500);
            }
            applyHitToMonster(towerIndex, towerObj, m, {
                damageScale: ratio,
                damageCategory: 'aoe',
                dmgTag: isEn ? 'Pulse ' : '神脈 '
            });
        }
        if (hitAny) {
            Renderer.emitRingFX(towerPos.left, towerPos.top, G.boardMetrics.step * 6.5, '#D97724', 0.28, 420);
            Renderer.emitParticleBurst(towerPos.left, towerPos.top, '#E0B43C', 10, 95);
        }
        return hitAny;
    }

    function getPrimalCoreLinkedNeighbors(coreIndex) {
        if (!G || !G.state || !Array.isArray(G.state.board) || coreIndex === null || coreIndex === undefined) {
            return [];
        }
        const cols = CONFIG.GRID_COLS || 15;
        const rows = CONFIG.GRID_ROWS || 10;
        const c = indexToCoords(coreIndex);
        const { coordsToIndex } = GameApp.helpers || {};
        if (!c || typeof coordsToIndex !== 'function') return [];
        const neighbors = [];
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                if (dx === 0 && dy === 0) continue;
                const nx = c.x + dx;
                const ny = c.y + dy;
                if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) continue;
                const nIdx = coordsToIndex(nx, ny);
                if (G.state.board[nIdx]) neighbors.push(nIdx);
            }
        }
        return neighbors;
    }

    function triggerPrimalGenesisPulse(towerIndex, towerObj) {
        if (!G || !G.state || !Array.isArray(G.state.monsters) || G.state.monsters.length === 0) return false;
        const Renderer = GameApp.renderer;
        const coords = indexToCoords(towerIndex);
        if (!coords || !Renderer) return false;
        const towerPos = Renderer.getCellCenter(coords.x, coords.y);
        const cfg = getTowerCfg(towerObj.type, towerObj.tier) || {};
        const fxParams = cfg.effectParams || {};
        const baseRatio = Number.isFinite(fxParams.genesisPulseRatio) ? fxParams.genesisPulseRatio : 0.45;
        const linkStep = Number.isFinite(fxParams.genesisLinkBonusPerAlly) ? fxParams.genesisLinkBonusPerAlly : 0.03;
        const linked = getPrimalCoreLinkedNeighbors(towerIndex);
        const ratio = baseRatio * (1 + Math.min(8, linked.length) * linkStep);
        const armorPierce = Number.isFinite(fxParams.armorPierce) ? fxParams.armorPierce : 0.30;
        const MonsterSys = GameApp.systems && GameApp.systems.monster;
        const isEn = Boolean(GameApp.i18n && GameApp.i18n.isEnglish());

        let hitAny = false;
        const pulseMonsters = G.state.monsters.slice();
        for (let i = 0; i < pulseMonsters.length; i++) {
            const m = pulseMonsters[i];
            if (!m || m.hp <= 0 || m.isTargetable === false) continue;
            hitAny = true;
            if (MonsterSys) {
                MonsterSys.applyBurnToMonster(m, { burnDps: 10, burnDurationMs: 2500 }, towerObj);
                MonsterSys.applySlowToMonster(m, 0.35, 2200, 'primal_pulse');
                MonsterSys.applyShockToMonster(m, { shockDurationMs: 2500, shockBonusBase: 10, shockBonusPerWave: 2.5 }, towerObj);
            }
            applyHitToMonster(towerIndex, towerObj, m, {
                damageScale: ratio,
                armorPierce,
                damageCategory: 'aoe',
                dmgTag: isEn ? '🌳Genesis ' : '🌳創世 '
            });
        }
        if (hitAny) {
            Renderer.emitRingFX(towerPos.left, towerPos.top, G.boardMetrics.step * 7.2, '#E0B43C', 0.32, 460);
            Renderer.emitParticleBurst(towerPos.left, towerPos.top, '#F4F1EA', 14, 115);
            linked.forEach((nIdx) => {
                const nc = indexToCoords(nIdx);
                const np = nc ? Renderer.getCellCenter(nc.x, nc.y) : null;
                if (np) Renderer.emitHitFlash(np.left, np.top, '#E0B43C');
            });
        }
        return hitAny;
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
            const MonsterSys = GameApp.systems && GameApp.systems.monster;
            const frostRadiusPx = (fxParams.aoeRadiusCells ?? 1.5) * G.boardMetrics.step;
            const slowSpec = { rate: fxParams.slowRate ?? 0.60, durationMs: fxParams.slowDurationMs ?? 2500 };

            const wasSlowed = MonsterSys ? MonsterSys.isMonsterSlowed(target) : false;
            applyHitToMonster(towerIndex, towerObj, target, {
                forceSlow: true,
                slowRate: slowSpec.rate,
                slowDurationMs: slowSpec.durationMs,
                slowSourceId: 'ice_A'
            });
            if (wasSlowed && target.hp > 0) {
                tryPermafrostFreezeWithBurst(towerIndex, towerObj, target, fxParams);
            }

            const splashRatio = fxParams.aoeDamageRatio ?? 0.35;
            for (let i = 0; i < G.state.monsters.length; i++) {
                const m = G.state.monsters[i];
                if (m.id === target.id || m.hp <= 0 || (m.isTargetable === false && !m.isStealthed)) continue;
                if (Math.hypot(m.pixelX - targetPos.left, m.pixelY - targetPos.top) <= frostRadiusPx) {
                    maybeRevealByAoE(m);
                    const mWasSlowed = MonsterSys ? MonsterSys.isMonsterSlowed(m) : false;
                    applyHitToMonster(towerIndex, towerObj, m, {
                        damageScale: splashRatio,
                        damageCategory: 'aoe',
                        forceSlow: true,
                        slowRate: slowSpec.rate,
                        slowDurationMs: slowSpec.durationMs,
                        slowSourceId: 'ice_A'
                    });
                    if (mWasSlowed && m.hp > 0) {
                        tryPermafrostFreezeWithBurst(towerIndex, towerObj, m, fxParams);
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
            const secondTarget = findIcePierceSecondTarget(towerPos, targetPos, target, fxParams);

            if (secondTarget) {
                const secControlled = MonsterSys ? MonsterSys.isMonsterControlled(secondTarget) : false;
                const secPos = { left: secondTarget.pixelX, top: secondTarget.pixelY };
                applyHitToMonster(towerIndex, towerObj, secondTarget, {
                    damageScale: secondRatio,
                    damageCategory: 'aoe',
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
                dmgTag: isJudgment ? ((GameApp.i18n && GameApp.i18n.isEnglish()) ? '⚡Judge ' : '⚡天罰 ') : ''
            });
            GameApp.renderer.emitCanvasAttackFX('thunder', towerPos, targetPos, { isLv3: true });
            if (isJudgment) {
                GameApp.renderer.emitRingFX(targetPos.left, targetPos.top, G.boardMetrics.step * 0.95, '#E0B43C', 0.26, 260);
            }
        },

        // T2 蒸氣噴泉：無視 45% 護甲 ＋ 1.3 格 70% 濺射
        aoe_mist(towerIndex, towerObj, cfg, target, towerPos, targetPos) {
            const fxParams = cfg.effectParams || {};
            const crownAoEBonus = towerObj && towerObj.isCrowned ? 0.4 : 0;
            const splashRadiusPx = ((fxParams.splashRadiusCells ?? 1.3) + crownAoEBonus) * G.boardMetrics.step;
            const splashRatio = fxParams.splashRatio ?? 0.70;
            const armorPierce = fxParams.armorPierce ?? 0.45;

            applyHitToMonster(towerIndex, towerObj, target, { armorPierce });
            applySplashDamage(towerIndex, towerObj, targetPos, splashRadiusPx, target.id, { damageScale: splashRatio, armorPierce });
            GameApp.renderer.emitCanvasAttackFX('steam', towerPos, targetPos, { splashRadiusPx });
        },

        // T3 💨A 焦熱蒸壓樹：無視 65% 護甲 ＋ 1.4 格 65% 濺射 ＋ 落點 3s 滾燙蒸氣池 (28/s)
        steam_A_pressure(towerIndex, towerObj, cfg, target, towerPos, targetPos) {
            const fxParams = cfg.effectParams || {};
            const MonsterSys = GameApp.systems && GameApp.systems.monster;
            const crownAoEBonus = towerObj && towerObj.isCrowned ? 0.4 : 0;
            const splashRadiusPx = ((fxParams.splashRadiusCells ?? 1.4) + crownAoEBonus) * G.boardMetrics.step;
            const splashRatio = fxParams.splashRatio ?? 0.65;
            const armorPierce = fxParams.armorPierce ?? 0.65;

            applyHitToMonster(towerIndex, towerObj, target, { armorPierce });
            applySplashDamage(towerIndex, towerObj, targetPos, splashRadiusPx, target.id, { damageScale: splashRatio, armorPierce });
            if (MonsterSys && typeof MonsterSys.spawnGroundHazard === 'function') {
                MonsterSys.spawnGroundHazard({
                    type: 'steam_pool',
                    x: targetPos.left,
                    y: targetPos.top,
                    radiusPx: ((fxParams.poolRadiusCells ?? 1.3) + crownAoEBonus) * G.boardMetrics.step,
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
            const MonsterSys = GameApp.systems && GameApp.systems.monster;
            const crownAoEBonus = towerObj && towerObj.isCrowned ? 0.4 : 0;
            const fogRadiusPx = ((fxParams.aoeRadiusCells ?? 1.6) + crownAoEBonus) * G.boardMetrics.step;
            const slowSpec = { rate: fxParams.slowRate ?? 0.35, durationMs: fxParams.slowDurationMs ?? 3000 };
            const vulnBonus = fxParams.vulnBonus ?? 0.20;
            const vulnDur = fxParams.vulnDurationMs ?? 3000;

            const victims = G.state.monsters.filter(m =>
                m.hp > 0 && (m.isTargetable !== false || m.isStealthed) && Math.hypot(m.pixelX - targetPos.left, m.pixelY - targetPos.top) <= fogRadiusPx
            );
            if (!victims.some(m => m.id === target.id)) victims.unshift(target);

            for (let i = 0; i < victims.length; i++) {
                const m = victims[i];
                maybeRevealByAoE(m);
                if (MonsterSys) {
                    MonsterSys.applySlowToMonster(m, slowSpec.rate, slowSpec.durationMs, 'steam_B_fog');
                    MonsterSys.applyVulnerabilityToMonster(m, vulnBonus, vulnDur, 'steam_B_fog');
                }
                applyHitToMonster(towerIndex, towerObj, m, {
                    damageScale: m.id === target.id ? 1.0 : 0.75,
                    damageCategory: m.id === target.id ? 'single' : 'aoe',
                    allowStealthed: true
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
            const pulseSlow = { rate: fxParams.slowRate ?? 0.45, durationMs: fxParams.slowDurationMs ?? 2200 };
            const stormExtra = (TreeSys && typeof TreeSys.getChainStormExtraBounces === 'function') ? TreeSys.getChainStormExtraBounces() : 0;
            const stormRadiusPx = (TreeSys && typeof TreeSys.getChainStormRadiusCells === 'function')
                ? TreeSys.getChainStormRadiusCells() * G.boardMetrics.step
                : chainRadiusPx;
            let maxChain = fxParams.chainExtraTargets ?? 2;

            const stunMs = fxParams.stunDurationMs ?? 350;
            const bossStunMs = fxParams.bossStunDurationMs ?? 150;
            const bossStunImmuneMs = fxParams.bossStunImmuneMs ?? 2500;

            applyHitToMonster(towerIndex, towerObj, target);
            if (target.hp <= 0 && stormExtra > 0) maxChain += stormExtra;
            if (target.hp > 0 && MonsterSys) {
                MonsterSys.applySlowToMonster(target, pulseSlow.rate, pulseSlow.durationMs, 'magnet_pulse');
                if (typeof MonsterSys.applyStunToMonster === 'function') {
                    MonsterSys.applyStunToMonster(target, stunMs, {
                        bossDurationMs: bossStunMs,
                        bossImmuneMs: bossStunImmuneMs
                    });
                }
            }
            for (let i = 0; i < G.state.monsters.length; i++) {
                const m = G.state.monsters[i];
                if (m.hp > 0 && (m.isTargetable !== false || m.isStealthed) && Math.hypot(m.pixelX - targetPos.left, m.pixelY - targetPos.top) <= frostRadiusPx && MonsterSys) {
                    maybeRevealByAoE(m);
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
                applyHitToMonster(towerIndex, towerObj, bestNext, { damageScale: fxParams.chainDamageRatio ?? 0.70, damageCategory: 'aoe' });
                if (bestNext.hp <= 0 && stormExtra > 0) maxChain += stormExtra;
                if (bestNext.hp > 0 && MonsterSys) {
                    MonsterSys.applySlowToMonster(bestNext, pulseSlow.rate, pulseSlow.durationMs, 'magnet_pulse');
                    if (typeof MonsterSys.applyStunToMonster === 'function') {
                        MonsterSys.applyStunToMonster(bestNext, stunMs, {
                            bossDurationMs: bossStunMs,
                            bossImmuneMs: bossStunImmuneMs
                        });
                    }
                }
                GameApp.renderer.emitCanvasAttackFX('magnet-arc', prevPos, nextPos);
                prevPos = nextPos;
            }
        },

        // T3 💠A 引力黑洞樹：1.5 格 45% 群體減速，每第 3 次脈衝將範圍內非 Boss 怪沿路徑回拉 0.45 格聚攏
        magnet_A_singularity(towerIndex, towerObj, cfg, target, towerPos, targetPos) {
            const fxParams = cfg.effectParams || {};
            const MonsterSys = GameApp.systems && GameApp.systems.monster;
            const radiusPx = (fxParams.aoeRadiusCells ?? 1.5) * G.boardMetrics.step;
            const slowSpec = { rate: fxParams.slowRate ?? 0.45, durationMs: fxParams.slowDurationMs ?? 2400 };

            towerObj.shotCounter = (towerObj.shotCounter || 0) + 1;
            const isPullPulse = (towerObj.shotCounter % (fxParams.pullEveryN || 3)) === 0;
            const pullCells = fxParams.pullDistanceCells ?? 0.45;

            const victims = G.state.monsters.filter(m =>
                m.hp > 0 && (m.isTargetable !== false || m.isStealthed) && Math.hypot(m.pixelX - targetPos.left, m.pixelY - targetPos.top) <= radiusPx
            );
            if (!victims.some(m => m.id === target.id)) victims.unshift(target);

            for (let i = 0; i < victims.length; i++) {
                const m = victims[i];
                maybeRevealByAoE(m);
                applyHitToMonster(towerIndex, towerObj, m, {
                    damageScale: m.id === target.id ? 1.0 : 0.80,
                    damageCategory: m.id === target.id ? 'single' : 'aoe',
                    allowStealthed: true
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
            applyHitToMonster(towerIndex, towerObj, target);
            GameApp.renderer.emitCanvasAttackFX('magnet-arc', towerPos, targetPos);
            executeMagnetChainBounce(towerIndex, towerObj, target, targetPos, fxParams, true);
        },

        // T2 電漿導管：無視 15% 護甲 ＋ 連續鎖定同一目標最高 4 層 (+12%/層)
        pierce_beam(towerIndex, towerObj, cfg, target, towerPos, targetPos) {
            const fxParams = cfg.effectParams || {};
            const maxStacks = (fxParams.maxStacks ?? 4) + (towerObj && towerObj.isCrowned ? 4 : 0);
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
            const maxStacks = (fxParams.maxStacks ?? 8) + (towerObj && towerObj.isCrowned ? 4 : 0);
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
            const maxStacks = (fxParams.maxStacks ?? 4) + (towerObj && towerObj.isCrowned ? 4 : 0);
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
            executePlasmaRefract(towerIndex, towerObj, target, targetPos, fxParams);
            if (G.state.selectedIndex === towerIndex) G.callbacks.updateTowerInspector();
        },

        // 4★ 雙生 & 5★ 神裔：🔥 雙生焰息（熔核群爆破甲 ＋ 焚世5層灼燒與斬殺）
        fire_twin(towerIndex, towerObj, cfg, target, towerPos, targetPos) {
            const fxParams = cfg.effectParams || {};
            const MonsterSys = GameApp.systems && GameApp.systems.monster;
            const splashRadiusPx = (fxParams.splashRadiusCells ?? 1.45) * G.boardMetrics.step;
            const splashRatio = fxParams.splashRatio ?? 0.60;
            const shredRate = fxParams.shredRate ?? 0.45;
            const shredDurationMs = fxParams.shredDurationMs ?? 4000;
            const execPct = fxParams.executeThresholdPct ?? 0.12;
            if (MonsterSys) {
                MonsterSys.applyBurnToMonster(target, fxParams, towerObj);
                MonsterSys.applyGrievousWound(target, fxParams.grievousRate ?? 0.50, fxParams.grievousDurationMs ?? 5000);
            }
            applyHitToMonster(towerIndex, towerObj, target, {
                forceShred: true,
                shredRate,
                shredDurationMs,
                executeThresholdPct: execPct
            });
            applySplashDamage(towerIndex, towerObj, targetPos, splashRadiusPx, target.id, {
                damageScale: splashRatio,
                forceShred: true,
                shredRate,
                shredDurationMs,
                executeThresholdPct: execPct
            });
            GameApp.renderer.emitCanvasAttackFX('fire', towerPos, targetPos, { splashRadiusPx });
        },

        // 4★ 雙生 & 5★ 神裔：❄️ 雙生寒獄（永凍領域群控凍結 ＋ 冰錐穿刺碎冰增傷）
        ice_twin(towerIndex, towerObj, cfg, target, towerPos, targetPos) {
            const fxParams = cfg.effectParams || {};
            const MonsterSys = GameApp.systems && GameApp.systems.monster;
            const frostRadiusPx = (fxParams.aoeRadiusCells ?? 1.55) * G.boardMetrics.step;
            const slowSpec = { rate: fxParams.slowRate ?? 0.60, durationMs: fxParams.slowDurationMs ?? 2500 };
            const shatterBonus = fxParams.shatterBonus ?? 0.55;
            const secondRatio = fxParams.secondTargetRatio ?? 0.60;

            const primaryControlled = MonsterSys ? MonsterSys.isMonsterControlled(target) : false;
            const wasSlowed = MonsterSys ? MonsterSys.isMonsterSlowed(target) : false;
            applyHitToMonster(towerIndex, towerObj, target, {
                extraMult: primaryControlled ? (1 + shatterBonus) : 1.0,
                forceSlow: true,
                slowRate: slowSpec.rate,
                slowDurationMs: slowSpec.durationMs,
                slowSourceId: 'ice_twin'
            });
            if (wasSlowed && target.hp > 0) {
                tryPermafrostFreezeWithBurst(towerIndex, towerObj, target, fxParams);
            }

            const splashRatio = fxParams.aoeDamageRatio ?? 0.38;
            for (let i = 0; i < G.state.monsters.length; i++) {
                const m = G.state.monsters[i];
                if (m.id === target.id || m.hp <= 0 || (m.isTargetable === false && !m.isStealthed)) continue;
                if (Math.hypot(m.pixelX - targetPos.left, m.pixelY - targetPos.top) <= frostRadiusPx) {
                    maybeRevealByAoE(m);
                    const mWasSlowed = MonsterSys ? MonsterSys.isMonsterSlowed(m) : false;
                    const mCtrl = MonsterSys ? MonsterSys.isMonsterControlled(m) : false;
                    applyHitToMonster(towerIndex, towerObj, m, {
                        damageScale: splashRatio,
                        damageCategory: 'aoe',
                        extraMult: mCtrl ? (1 + shatterBonus * 0.5) : 1.0,
                        forceSlow: true,
                        slowRate: slowSpec.rate,
                        slowDurationMs: slowSpec.durationMs,
                        slowSourceId: 'ice_twin'
                    });
                    if (mWasSlowed && m.hp > 0) {
                        tryPermafrostFreezeWithBurst(towerIndex, towerObj, m, fxParams);
                    }
                }
            }

            const secondTarget = findIcePierceSecondTarget(towerPos, targetPos, target, fxParams);
            if (secondTarget && secondTarget.hp > 0) {
                const secCtrl = MonsterSys ? MonsterSys.isMonsterControlled(secondTarget) : false;
                const secPos = { left: secondTarget.pixelX, top: secondTarget.pixelY };
                applyHitToMonster(towerIndex, towerObj, secondTarget, {
                    damageScale: secondRatio,
                    damageCategory: 'aoe',
                    extraMult: secCtrl ? (1 + shatterBonus) : 1.0,
                    forceSlow: true,
                    slowRate: slowSpec.rate,
                    slowDurationMs: slowSpec.durationMs,
                    slowSourceId: 'ice_twin'
                });
                GameApp.renderer.emitCanvasAttackFX('ice', targetPos, secPos);
            }
            GameApp.renderer.emitCanvasAttackFX('ice', towerPos, targetPos, { frostRadiusPx });
        },

        // 4★ 雙生 & 5★ 神裔：⚡ 雙生天殛（4 鏈連鎖雷擊 ＋ 每第 3 發 2.5x 天罰破甲）
        thunder_twin(towerIndex, towerObj, cfg, target) {
            const fxParams = cfg.effectParams || {};
            towerObj.shotCounter = (towerObj.shotCounter || 0) + 1;
            const everyN = fxParams.judgmentEveryN || 3;
            const isJudgment = (towerObj.shotCounter % everyN) === 0;
            const isEn = Boolean(GameApp.i18n && GameApp.i18n.isEnglish());
            return fireLightningBolt(towerIndex, towerObj, {
                primaryTarget: target,
                primaryExtraMult: isJudgment ? (fxParams.judgmentMult || 2.5) : 1.0,
                primaryArmorPierce: isJudgment ? (fxParams.judgmentArmorPierce || 0.40) : 0,
                primaryDmgTag: isJudgment ? (isEn ? '⚡Judge ' : '⚡天罰 ') : '',
                judgmentRingColor: isJudgment ? '#E0B43C' : null
            });
        },

        // 4★ 雙生 & 5★ 神裔：💨 雙生蒸霧（65% 穿甲高壓蒸氣池 ＋ 1.6 格 35% 減速與 +20% 易傷迷霧）
        steam_twin(towerIndex, towerObj, cfg, target, towerPos, targetPos) {
            const fxParams = cfg.effectParams || {};
            const MonsterSys = GameApp.systems && GameApp.systems.monster;
            const crownAoEBonus = (towerObj && towerObj.isCrowned) ? 0.4 : 0;
            const fogRadiusPx = ((fxParams.aoeRadiusCells ?? 1.6) + crownAoEBonus) * G.boardMetrics.step;
            const splashRatio = fxParams.splashRatio ?? 0.70;
            const armorPierce = fxParams.armorPierce ?? 0.65;
            const slowRate = fxParams.slowRate ?? 0.35;
            const slowDurationMs = fxParams.slowDurationMs ?? 3000;
            const vulnBonus = fxParams.vulnBonus ?? 0.20;
            const vulnDur = fxParams.vulnDurationMs ?? 3000;

            const victims = G.state.monsters.filter(m =>
                m.hp > 0 && (m.isTargetable !== false || m.isStealthed) && Math.hypot(m.pixelX - targetPos.left, m.pixelY - targetPos.top) <= fogRadiusPx
            );
            if (!victims.some(m => m.id === target.id)) victims.unshift(target);
            for (let i = 0; i < victims.length; i++) {
                const m = victims[i];
                maybeRevealByAoE(m);
                if (MonsterSys) {
                    MonsterSys.applySlowToMonster(m, slowRate, slowDurationMs, 'steam_twin');
                    MonsterSys.applyVulnerabilityToMonster(m, vulnBonus, vulnDur, 'steam_B_fog');
                }
                applyHitToMonster(towerIndex, towerObj, m, {
                    damageScale: m.id === target.id ? 1.0 : splashRatio,
                    damageCategory: m.id === target.id ? 'single' : 'aoe',
                    armorPierce,
                    allowStealthed: true
                });
            }
            if (MonsterSys && typeof MonsterSys.spawnGroundHazard === 'function') {
                MonsterSys.spawnGroundHazard({
                    type: 'steam_pool',
                    x: targetPos.left,
                    y: targetPos.top,
                    radiusPx: ((fxParams.poolRadiusCells ?? 1.35) + crownAoEBonus) * G.boardMetrics.step,
                    dps: fxParams.poolDps ?? 32,
                    durationMs: fxParams.poolDurationMs ?? 3000,
                    sourceTower: towerObj
                });
            }
            GameApp.renderer.emitCanvasAttackFX('steam', towerPos, targetPos, { splashRadiusPx: fogRadiusPx });
        },

        // 4★ 雙生 & 5★ 神裔：💠 雙生磁界（1.55 格引力回拉磁場 ＋ 3 目標感電連鎖）
        magnet_twin(towerIndex, towerObj, cfg, target, towerPos, targetPos) {
            const fxParams = cfg.effectParams || {};
            const MonsterSys = GameApp.systems && GameApp.systems.monster;
            const radiusPx = (fxParams.aoeRadiusCells ?? 1.55) * G.boardMetrics.step;
            const slowSpec = { rate: fxParams.slowRate ?? 0.45, durationMs: fxParams.slowDurationMs ?? 2400 };
            towerObj.shotCounter = (towerObj.shotCounter || 0) + 1;
            const isPullPulse = (towerObj.shotCounter % (fxParams.pullEveryN || 3)) === 0;
            const pullCells = fxParams.pullDistanceCells ?? 0.45;

            const victims = G.state.monsters.filter(m =>
                m.hp > 0 && (m.isTargetable !== false || m.isStealthed) && Math.hypot(m.pixelX - targetPos.left, m.pixelY - targetPos.top) <= radiusPx
            );
            if (!victims.some(m => m.id === target.id)) victims.unshift(target);
            for (let i = 0; i < victims.length; i++) {
                const m = victims[i];
                maybeRevealByAoE(m);
                if (MonsterSys) MonsterSys.applyShockToMonster(m, fxParams, towerObj);
                applyHitToMonster(towerIndex, towerObj, m, {
                    damageScale: m.id === target.id ? 1.0 : 0.78,
                    damageCategory: m.id === target.id ? 'single' : 'aoe',
                    allowStealthed: true
                });
                if (m.hp > 0 && MonsterSys) {
                    MonsterSys.applySlowToMonster(m, slowSpec.rate, slowSpec.durationMs, 'magnet_twin');
                    if (isPullPulse && !m.isBoss) {
                        MonsterSys.pullMonsterAlongPath(m, pullCells);
                    }
                }
            }
            GameApp.renderer.emitCanvasAttackFX('magnet-arc', towerPos, targetPos, { frostRadiusPx: radiusPx });
            if (isPullPulse) {
                GameApp.renderer.emitRingFX(targetPos.left, targetPos.top, radiusPx, '#E0B43C', 0.25, 320);
            }
            executeMagnetChainBounce(towerIndex, towerObj, target, targetPos, fxParams, true);
        },

        // 4★ 雙生 & 5★ 神裔：☄️ 雙生聚變（8/12 層極限死光 + 45% 穿甲 ＋ 2 副光束折射）
        plasma_twin(towerIndex, towerObj, cfg, target, towerPos, targetPos) {
            const fxParams = cfg.effectParams || {};
            const maxStacks = (fxParams.maxStacks ?? 8) + (towerObj && towerObj.isCrowned ? 4 : 0);
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
            executePlasmaRefract(towerIndex, towerObj, target, targetPos, fxParams);
            if (G.state.selectedIndex === towerIndex) G.callbacks.updateTowerInspector();
        },

        // Stage 2 三元傳奇：⛈️ 天災風暴樹（2.2 格漂移熾凍雷雲 ＋ 45% 穿甲 ＋ 減速 ＋ 雲內死亡 15% 殉爆）
        tri_storm_cloud(towerIndex, towerObj, cfg, target, towerPos, targetPos) {
            const fxParams = cfg.effectParams || {};
            const MonsterSys = GameApp.systems && GameApp.systems.monster;
            const armorPierce = fxParams.armorPierce ?? 0.45;
            applyHitToMonster(towerIndex, towerObj, target, {
                armorPierce,
                forceSlow: true,
                slowRate: fxParams.slowRate ?? 0.35,
                slowDurationMs: fxParams.slowDurationMs ?? 2000,
                slowSourceId: 'storm_cloud'
            });
            if (MonsterSys && typeof MonsterSys.spawnGroundHazard === 'function') {
                MonsterSys.spawnGroundHazard({
                    type: 'storm_cloud',
                    x: targetPos.left,
                    y: targetPos.top,
                    radiusPx: (fxParams.cloudRadiusCells ?? 2.2) * G.boardMetrics.step,
                    dps: fxParams.cloudDps ?? 60.3,
                    durationMs: fxParams.cloudDurationMs ?? 3600,
                    armorPierce,
                    slowRate: fxParams.slowRate ?? 0.35,
                    slowDurationMs: fxParams.slowDurationMs ?? 2000,
                    martyrPct: fxParams.martyrPct ?? 0.15,
                    martyrRadiusPx: (fxParams.martyrRadiusCells ?? 1.5) * G.boardMetrics.step,
                    martyrCapNormal: fxParams.martyrCapNormal ?? 420,
                    martyrCapBoss: fxParams.martyrCapBoss ?? 650,
                    sourceTower: towerObj
                });
            }
            GameApp.renderer.emitCanvasAttackFX('storm_tri', towerPos, targetPos, {
                frostRadiusPx: (fxParams.cloudRadiusCells ?? 2.2) * G.boardMetrics.step
            });
        },

        // Stage 2 三元傳奇：🌋 星界熔爐樹（1.8 格聚怪 ＋ 0.5s 凍結 ＋ 40% 群體破甲超新星 ＋ 50% 重傷）
        tri_starforge_nova(towerIndex, towerObj, cfg, target, towerPos, targetPos) {
            const fxParams = cfg.effectParams || {};
            const MonsterSys = GameApp.systems && GameApp.systems.monster;
            const radiusPx = (fxParams.aoeRadiusCells ?? 1.8) * G.boardMetrics.step;
            const splashRatio = fxParams.splashRatio ?? 0.80;
            const shredRate = fxParams.shredRate ?? 0.40;
            const shredDurationMs = fxParams.shredDurationMs ?? 4000;
            const pullCells = fxParams.pullDistanceCells ?? 0.45;
            const freezeMs = fxParams.freezeDurationMs ?? 500;

            const victims = G.state.monsters.filter(m =>
                m.hp > 0 && (m.isTargetable !== false || m.isStealthed) && Math.hypot(m.pixelX - targetPos.left, m.pixelY - targetPos.top) <= radiusPx
            );
            if (!victims.some(m => m.id === target.id)) victims.unshift(target);
            for (let i = 0; i < victims.length; i++) {
                const m = victims[i];
                maybeRevealByAoE(m);
                if (MonsterSys) {
                    MonsterSys.applyGrievousWound(m, fxParams.grievousRate ?? 0.50, fxParams.grievousDurationMs ?? 5000);
                }
                applyHitToMonster(towerIndex, towerObj, m, {
                    damageScale: m.id === target.id ? 1.0 : splashRatio,
                    damageCategory: m.id === target.id ? 'single' : 'aoe',
                    forceShred: true,
                    shredRate,
                    shredDurationMs,
                    allowStealthed: true
                });
                if (m.hp > 0 && MonsterSys) {
                    if (!m.isBoss) MonsterSys.pullMonsterAlongPath(m, pullCells);
                    if (typeof MonsterSys.tryApplyDirectFreeze === 'function') {
                        MonsterSys.tryApplyDirectFreeze(m, freezeMs, {
                            bossFreezeMult: fxParams.bossFreezeMult ?? 0.50,
                            freezeImmuneMs: fxParams.freezeImmuneMs ?? 6000
                        });
                    }
                }
            }
            GameApp.renderer.emitCanvasAttackFX('starforge_tri', towerPos, targetPos, { splashRadiusPx: radiusPx });
        },

        // Stage 2 三元傳奇：❄️ 絕對零度稜鏡（1 主＋2 副折射光束 ＋ 5 層熱脹冷縮脆化 ＋ 滿層碎晶爆發與 0.8s 冰封）
        tri_prism_zero(towerIndex, towerObj, cfg, target, towerPos, targetPos) {
            const fxParams = cfg.effectParams || {};
            const MonsterSys = GameApp.systems && GameApp.systems.monster;
            const isEn = Boolean(GameApp.i18n && GameApp.i18n.isEnglish());
            const shatterMult = fxParams.shatterMult ?? 2.0;
            const freezeMs = fxParams.freezeDurationMs ?? 800;

            const strikeBeam = (victim, beamScale, category) => {
                if (!victim || victim.hp <= 0) return;
                applyHitToMonster(towerIndex, towerObj, victim, {
                    damageScale: beamScale,
                    damageCategory: category,
                    forceSlow: true,
                    slowRate: 0.35,
                    slowDurationMs: 2200,
                    slowSourceId: 'prism_zero'
                });
                if (victim.hp > 0 && MonsterSys && typeof MonsterSys.registerPrismThermalHit === 'function') {
                    const th = MonsterSys.registerPrismThermalHit(victim, fxParams);
                    if (th && th.shattered) {
                        applyHitToMonster(towerIndex, towerObj, victim, {
                            damageScale: beamScale * shatterMult,
                            damageCategory: 'aoe',
                            applySlow: false,
                            applyShred: false,
                            dmgTag: isEn ? '❄️Shatter ' : '❄️碎晶 '
                        });
                        if (victim.hp > 0 && typeof MonsterSys.tryApplyDirectFreeze === 'function') {
                            MonsterSys.tryApplyDirectFreeze(victim, freezeMs, {
                                bossFreezeMult: fxParams.bossFreezeMult ?? 0.50,
                                freezeImmuneMs: fxParams.freezeImmuneMs ?? 6000
                            });
                        }
                        if (GameApp.renderer) {
                            GameApp.renderer.emitParticleBurst(victim.pixelX, victim.pixelY, '#D6EEF7', 10, 95);
                        }
                    }
                }
            };

            strikeBeam(target, 1.0, 'single');
            GameApp.renderer.emitCanvasAttackFX('prism_tri', towerPos, targetPos, { stacks: 2 });

            const refractRadiusPx = (fxParams.refractRadiusCells ?? 2.6) * G.boardMetrics.step;
            const refractRatio = fxParams.refractRatio ?? 0.547;
            const refractMax = fxParams.refractTargets ?? 2;
            const candidates = [];
            for (let i = 0; i < G.state.monsters.length; i++) {
                const cand = G.state.monsters[i];
                if (cand.id === target.id || cand.hp <= 0 || cand.isTargetable === false) continue;
                const d = Math.hypot(cand.pixelX - targetPos.left, cand.pixelY - targetPos.top);
                if (d <= refractRadiusPx) candidates.push({ monster: cand, dist: d });
            }
            candidates.sort((a, b) => a.dist - b.dist);
            const hitCount = Math.min(refractMax, candidates.length);
            for (let k = 0; k < hitCount; k++) {
                const sub = candidates[k].monster;
                const subPos = { left: sub.pixelX, top: sub.pixelY };
                strikeBeam(sub, refractRatio, 'aoe');
                GameApp.renderer.emitCanvasAttackFX('prism_tri', targetPos, subPos, { stacks: 1 });
            }
        },

        // 唯一 5★ 創世世界樹·原初之核：三元融合高穿透爆裂主炮（並由 5s 計時器驅動創世脈動）
        primal_genesis(towerIndex, towerObj, cfg, target, towerPos, targetPos) {
            const fxParams = cfg.effectParams || {};
            const MonsterSys = GameApp.systems && GameApp.systems.monster;
            const splashRadiusPx = (fxParams.splashRadiusCells ?? 1.6) * G.boardMetrics.step;
            const splashRatio = fxParams.splashRatio ?? 0.72;
            const armorPierce = fxParams.armorPierce ?? 0.30;

            if (MonsterSys) {
                MonsterSys.applyBurnToMonster(target, { burnDps: 12, burnDurationMs: 3000 }, towerObj);
                MonsterSys.applySlowToMonster(target, 0.45, 2400, 'primal_core');
                MonsterSys.applyShockToMonster(target, { shockDurationMs: 3000, shockBonusBase: 10, shockBonusPerWave: 2.5 }, towerObj);
            }
            applyHitToMonster(towerIndex, towerObj, target, {
                armorPierce,
                forceShred: true,
                shredRate: 0.35,
                shredDurationMs: 3500
            });
            applySplashDamage(towerIndex, towerObj, targetPos, splashRadiusPx, target.id, {
                damageScale: splashRatio,
                armorPierce,
                allowStealthed: true
            });
            GameApp.renderer.emitCanvasAttackFX('primal_core', towerPos, targetPos, { splashRadiusPx });
        }
    };

    function performTowerAttack(towerIndex, towerObj) {
        const Renderer = GameApp.renderer, coords = indexToCoords(towerIndex);
        const towerPos = Renderer.getCellCenter(coords.x, coords.y);
        const isLv3 = towerObj.tier >= 3;
        const cfg = getTowerCfg(towerObj.type, towerObj.tier) || { attackStyle: 'burst_armor_break', effectParams: {} };
        const style = cfg.attackStyle || 'burst_armor_break';

        if (style === 'chain_lightning') {
            return fireLightningBolt(towerIndex, towerObj);
        }
        if (style === 'thunder_twin') {
            const target = findBestTargetInRange(towerIndex, towerObj);
            if (!target) return false;
            return ATTACK_STYLE_HANDLERS.thunder_twin(towerIndex, towerObj, cfg, target, towerPos, { left: target.pixelX, top: target.pixelY });
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
        for (let idx = 0; idx < st.board.length; idx++) {
            const towerObj = st.board[idx];
            if (towerObj === null) continue;

            // 自爆或 Boss EMP 癱瘓倒數與外觀切換
            if ((towerObj.stunnedMs || 0) > 0 || towerObj._hadStunClass) {
                towerObj.stunnedMs = Math.max(0, (towerObj.stunnedMs || 0) - dtMs);
                const nowStunned = towerObj.stunnedMs > 0;
                if (towerObj._hadStunClass !== nowStunned) {
                    towerObj._hadStunClass = nowStunned;
                    if (GameApp.renderer && typeof GameApp.renderer.setTowerStunnedVisual === 'function') {
                        GameApp.renderer.setTowerStunnedVisual(idx, nowStunned);
                    }
                }
                if (nowStunned) continue;
            }

            if (st.monsters.length === 0 && st.waveState !== 'SPAWNING') continue;
            if (!Number.isFinite(towerObj.accMs)) towerObj.accMs = 0;
            const intervalMs = getTowerAttackInterval(towerObj, idx);
            towerObj.accMs = towerObj.accMs + dtMs;
            if (towerObj.accMs >= intervalMs && st.monsters.length > 0 && performTowerAttack(idx, towerObj)) {
                towerObj.accMs = Math.min(intervalMs, Math.max(0, towerObj.accMs - intervalMs));
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
            } else {
                towerObj.accMs = Math.min(intervalMs, towerObj.accMs);
            }

            if ((Number(towerObj.tier) || 1) >= 5 && st.monsters.length > 0) {
                const econData = (GameApp.data && GameApp.data.economy) || {};
                const cfg5 = getTowerCfg(towerObj.type, towerObj.tier) || {};
                const isPrimal = Boolean(towerObj.type === 'primal_core' || cfg5.isPrimalCore);
                const pulseIntervalMs = isPrimal
                    ? ((cfg5.effectParams && cfg5.effectParams.genesisPulseIntervalMs) || 5000)
                    : (Number.isFinite(econData.SCION_PULSE_INTERVAL_MS) ? econData.SCION_PULSE_INTERVAL_MS : 6000);
                towerObj.scionPulseAccMs = (towerObj.scionPulseAccMs || 0) + dtMs;
                if (towerObj.scionPulseAccMs >= pulseIntervalMs) {
                    const fired = isPrimal ? triggerPrimalGenesisPulse(idx, towerObj) : triggerScionMapPulse(idx, towerObj);
                    if (fired) didCombatAct = true;
                    towerObj.scionPulseAccMs %= pulseIntervalMs;
                }
            }
        }
        const MonsterSys = GameApp.systems && GameApp.systems.monster;
        if (MonsterSys && typeof MonsterSys.pruneDeadMonsters === 'function') {
            MonsterSys.pruneDeadMonsters();
        }
        if (didCombatAct) GameApp.renderer.renderMonsterLayer();
    }

    function tryPermafrostFreezeWithBurst(towerIndex, towerObj, victim, fxParams) {
        if (!victim || victim.hp <= 0) return false;
        const MonsterSys = GameApp.systems && GameApp.systems.monster;
        if (!MonsterSys || typeof MonsterSys.registerPermafrostHitAndTryFreeze !== 'function') return false;
        const froze = MonsterSys.registerPermafrostHitAndTryFreeze(victim, towerObj, fxParams);
        if (froze && victim.hp > 0) {
            const burstScale = Number.isFinite(fxParams && fxParams.freezeBurstMult) ? fxParams.freezeBurstMult : 1.5;
            const isEn = Boolean(GameApp.i18n && GameApp.i18n.isEnglish());
            applyHitToMonster(towerIndex, towerObj, victim, {
                damageScale: burstScale,
                damageCategory: 'aoe',
                allowStealthed: true,
                applySlow: false,
                applyShred: false,
                dmgTag: isEn ? '❄️Burst ' : '❄️冰爆 '
            });
            if (GameApp.renderer) {
                GameApp.renderer.emitParticleBurst(victim.pixelX, victim.pixelY, '#8EE8FF', 10, 95);
            }
        }
        return froze;
    }

    function refreshAllTowerAttackReadiness() {
        const board = G && G.state && G.state.board;
        if (!Array.isArray(board)) return 0;
        let count = 0;
        for (let idx = 0; idx < board.length; idx++) {
            const towerObj = board[idx];
            if (!towerObj) continue;
            const intervalMs = getTowerAttackInterval(towerObj, idx);
            towerObj.accMs = intervalMs;
            if (towerObj._recoilEl) {
                towerObj._recoilEl.classList.remove('tower-recoil');
            }
            count++;
        }
        return count;
    }

    const TowerAttackSystem = {
        bind,
        getTowerCfg,
        getScionAuraAtCell,
        getTowerBaseRangeCells,
        getTowerEffectiveRangeCells,
        getTowerRangePx,
        getTowerAttackInterval,
        getThunderChainScales,
        createTowerObj,
        recordTowerDamage,
        b_infusion,
        computeInfusionBonus: b_infusion,
        getInfusionCost,
        computePowerBucket,
        getTowerInspectorStats,
        getTowerHoverTooltipData,
        pickSmartSpawnIndex,
        isMonsterPreferred,
        findBestTargetInRange,
        calculateDamage,
        applyHitToMonster,
        fireThunderBolt: fireLightningBolt,
        triggerScionMapPulse,
        getPrimalCoreLinkedNeighbors,
        triggerPrimalGenesisPulse,
        performTowerAttack,
        updateTowersCombat,
        refreshAllTowerAttackReadiness
    };

    GameApp.systems = GameApp.systems || {};
    GameApp.systems.towerAttack = TowerAttackSystem;
    GameApp.systems.towers = TowerAttackSystem;
})(window);
