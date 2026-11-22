/**
 * ============================================================================
 * 【檔案名稱】：modules/towers/tower_data.js
 * 【負責功能】：存放元素世界樹 21 節點（3 根芽 T1 → 6 主幹 T2 → 12 冠枝 T3）的名稱、
 *               色票 Token、攻擊樣式標籤（attackStyle）、單發傷害、攻速、射程與分支技能參數。
 * 【讀取資料】：無（本檔為純角色數值設定表，供 tower_attack_system.js、evolution_system.js、renderer.js 與商店讀取）。
 * 【常見修改入口】：
 *   1. 調整各節點傷害、射程或攻速：直接修改 WORLD_TREE_NODES.<節點ID> 內的 damage、range、attackIntervalMs。
 *   2. 調整護甲常數、純血相剋或共生親和倍率：修改 COMBAT_CONSTANTS。
 * ============================================================================
 */
(function (global) {
    'use strict';

    const GameApp = global.GameApp = global.GameApp || {};
    const CONFIG = GameApp.config || {};

    // 索敵優先級循環與顯示名稱
    const TARGET_MODE_CYCLE = ['first', 'armor', 'lowhp'];
    const TARGET_MODE_LABELS = {
        first: '最前',
        armor: '高護甲',
        lowhp: '殘血'
    };

    // 戰鬥傷害核心公式常數（含四桶分離防膨脹與 Phase 2A 硬性上限鎖）
    const COMBAT_CONSTANTS = {
        ATTACK_INTERVAL: 1000,
        ARMOR_HYPERBOLIC_K: 35,             // 雙曲線百分比護甲常數：35 / (35 + A_eff)
        WEAKNESS_MULTIPLIER: 1.75,          // 純元素相剋暴擊倍率 (175%)
        HYBRID_AFFINITY_MULTIPLIER: 1.35,   // 跨元素共生／冠枝命中任一父系弱點之親和倍率 (135%)
        POWER_TERRAIN_CAP: 0.25,            // 自身戰力加法桶：地形上限 0.25
        POWER_BLESSING_CAP: 0.30,           // 自身戰力加法桶：賜福上限 0.30
        POWER_DIVIDEND_CAP: 0.24,           // 自身戰力加法桶：持股紅利預留欄位上限 0.24
        INFUSION_BASE_COST: 150,            // 無盡靈脈灌注第 k 次費用基礎：150 + 75 * k
        INFUSION_STEP_COST: 75,             // 無盡靈脈灌注第 k 次費用遞增：75 * k
        VULN_ADDITIVE_CAP: 0.60,            // 敵方易傷加法桶硬上限 60%：B_vuln = Math.min(0.60, v_root + v_frost_mist + v_brand)
        SLOW_DIMINISH_SECOND_FACTOR: 0.25,  // 減速遞減：最高減速 + 次高減速 × 0.25
        SLOW_TOTAL_CAP: 0.70,               // 總減速上限 70%（移速下限 0.30）
        MIN_SPEED_FLOOR_RATIO: 0.30,        // 減速後移速下限比例 30%（定身/凍結除外）
        ATTACK_SPEED_MULT_CAP: 2.50,        // 攻速乘區上限 2.50x
        ATTACK_COOLDOWN_FLOOR_MS: 120       // 攻擊冷卻下限 120ms
    };

    // 第 3 階段：5 星金字塔（最高 16U）與單位濃縮效率 E(star)
    const STAR_NUTRITION_U = { 1: 1, 2: 2, 3: 4, 4: 8, 5: 16 };
    const STAR_CONCENTRATION_EFFICIENCY = { 1: 1.00, 2: 1.075, 3: 1.15, 4: 1.20, 5: 1.24 };
    const FAMILY_BASE_1STAR_DAMAGE = {
        fire: 25,
        ice: 15,
        thunder: 13,
        steam: 23,
        magnet: 15,
        plasma: 6.5
    };

    function getUnitConcentrationEfficiency(nutritionU = 1, star = null) {
        const s = Number.isFinite(star) ? Math.max(1, Math.min(5, Number(star))) : null;
        if (s === 1) return 1.00;
        if (s === 2) return 1.075;
        const u = Math.max(1, Math.min(16, Number(nutritionU) || (s ? (STAR_NUTRITION_U[s] || 1) : 1)));
        if (u <= 1) return 1.00;
        if (u <= 2) return 1.00 + (u - 1) * (1.075 - 1.00);
        if (u <= 4) return 1.075 + ((u - 2) / 2) * (1.15 - 1.075);
        if (u <= 8) return 1.15 + ((u - 4) / 4) * (1.20 - 1.15);
        return 1.20 + ((u - 8) / 8) * (1.24 - 1.20);
    }

    function calculateUnitTierDamage(familyOrCfg, nutritionU = 1, star = 1) {
        const fam = typeof familyOrCfg === 'string'
            ? familyOrCfg.replace(/_(bud|trunk|A|B|crown_A|crown_B|twin_AB|scion)$/, '')
            : ((familyOrCfg && (familyOrCfg.family || familyOrCfg.elementTag)) || 'fire');
        const d1 = Number.isFinite(FAMILY_BASE_1STAR_DAMAGE[fam]) ? FAMILY_BASE_1STAR_DAMAGE[fam] : 15;
        const resolvedStar = Math.max(1, Math.min(5, Number(star) || (familyOrCfg && familyOrCfg.nodeTier) || 1));
        const defaultU = (familyOrCfg && familyOrCfg.isHybrid && resolvedStar <= 2)
            ? (resolvedStar === 1 ? 2 : 3)
            : (STAR_NUTRITION_U[resolvedStar] || 1);
        const effU = Number.isFinite(nutritionU) ? Math.max(1, Number(nutritionU)) : defaultU;
        const eStar = getUnitConcentrationEfficiency(effU, resolvedStar);
        return Math.max(1, Math.round(d1 * effU * eStar));
    }

    const ROLE_TAG_PREFIXES = {
        fire: '破甲·中',
        ice: '緩速·中',
        thunder: '連電·長'
    };

    /**
     * 元素世界樹 21 節點完整定義表（3 根芽 T1 → 6 主幹 T2 → 12 冠枝 T3）
     * 成本嚴格守恒：T1 = 1x、T2 = 2x、T3 = 4x
     */
    const WORLD_TREE_NODES = {
        // ==================== Tier 1：3 根芽 (T1) ====================
        fire_bud: {
            id: 'fire_bud',
            shopKey: 'fire',
            name: '火芽',
            shortName: '🔥火芽',
            icon: '🔥',
            image: '',
            color: '#C94A38',
            palette: { rune: '#C94A38', glow: '#F4DFC8' },
            nodeTier: 1,
            costShare: 1,
            isHybrid: false,
            shopSpawnable: true,
            elementTag: 'fire',
            lineageTags: ['fire'],
            defaultLineagePath: ['🔥火芽'],
            attackStyle: 'burst_armor_break',
            range: 2.3,
            attacksPerSec: Number((1000 / 1200).toFixed(2)),
            attackIntervalMs: 1200,
            roleTagPrefix: '破甲·中',
            roleTag: '破甲 · 單發 25 · 2.3 格',
            shopRoleTag: '破甲 · 單發 25 · 2.3 格',
            roleSummary: '基礎灼燒破甲根芽',
            tooltipSummary: '25% 破甲（3.0s）· 單體重擊',
            damage: 25,
            tierDamage: [0, 25, 58, 185],
            badges: ['單發 25 · 1.20s', '射程 2.3 格', '25%破甲 3.0s'],
            effectParams: {
                shredRate: 0.25,
                shredDurationMs: 3000
            }
        },
        ice_bud: {
            id: 'ice_bud',
            shopKey: 'ice',
            name: '冰芽',
            shortName: '❄️冰芽',
            icon: '❄️',
            image: '',
            color: '#4A9EBF',
            palette: { rune: '#4A9EBF', glow: '#D6EEF7' },
            nodeTier: 1,
            costShare: 1,
            isHybrid: false,
            shopSpawnable: true,
            elementTag: 'ice',
            lineageTags: ['ice'],
            defaultLineagePath: ['❄️冰芽'],
            attackStyle: 'slow_control',
            range: 2.8,
            attacksPerSec: 1.00,
            attackIntervalMs: 1000,
            roleTagPrefix: '緩速·中',
            roleTag: '緩速 · 單發 15 · 2.8 格',
            shopRoleTag: '緩速 · 單發 15 · 2.8 格',
            roleSummary: '基礎寒霜減速根芽',
            tooltipSummary: '40% 緩速（2.0s）· 寒霜控場',
            damage: 15,
            tierDamage: [0, 15, 36, 82],
            badges: ['單發 15 · 1.00s', '射程 2.8 格', '40%減速 2.0s'],
            effectParams: {
                slowRate: 0.40,
                slowDurationMs: 2000
            }
        },
        thunder_bud: {
            id: 'thunder_bud',
            shopKey: 'thunder',
            name: '雷芽',
            shortName: '⚡雷芽',
            icon: '⚡',
            image: '',
            color: '#E0B43C',
            palette: { rune: '#E0B43C', glow: '#F7EAC0' },
            nodeTier: 1,
            costShare: 1,
            isHybrid: false,
            shopSpawnable: true,
            elementTag: 'thunder',
            lineageTags: ['thunder'],
            defaultLineagePath: ['⚡雷芽'],
            attackStyle: 'chain_lightning',
            range: 3.6,
            attacksPerSec: Number((1000 / 900).toFixed(2)),
            attackIntervalMs: 900,
            roleTagPrefix: '連電·長',
            roleTag: '連電 · 單發 13 · 3.6 格',
            shopRoleTag: '連電 · 單發 13 · 3.6 格',
            roleSummary: '真2體連鎖閃電根芽',
            tooltipSummary: '真·2 體連鎖（100%/55%）',
            damage: 13,
            tierDamage: [0, 13, 26, 52],
            badges: ['單發 13 · 0.90s', '射程 3.6 格', '真2體連鎖 100/55%'],
            effectParams: {
                boltCount: 2,
                chainRadiusCells: 2.6,
                chainScales: [1.0, 0.55]
            }
        },

        // ==================== Tier 1 異系轉職：3 新物種 (1★) ====================
        steam_bud: {
            id: 'steam_bud',
            family: 'steam',
            name: '蒸氣噴泉',
            shortName: '💨蒸氣',
            icon: '💨',
            image: '',
            color: '#D97724',
            palette: { rune: '#D97724', glow: '#4A9EBF' },
            nodeTier: 1,
            costShare: 2,
            isHybrid: true,
            isPureTrunk: false,
            shopSpawnable: false,
            elementTag: 'steam',
            lineageTags: ['fire', 'ice'],
            defaultLineagePath: ['🔥火芽+❄️冰芽', '💨蒸氣'],
            attackStyle: 'aoe_mist',
            range: 2.7,
            attacksPerSec: Number((1000 / 1100).toFixed(2)),
            attackIntervalMs: 1100,
            roleTagPrefix: '穿甲濺射·',
            roleTag: '穿甲濺射·2.7·1.10s',
            roleSummary: '火冰轉職穿甲範圍爆裂塔',
            tooltipSummary: '45% 穿甲 · 1.3 格 70% 濺射',
            damage: 46,
            tierDamage: [0, 46, 99, 110],
            badges: ['單發 46 · 1.10s', '無視 45% 護甲', '1.3 格 70% 濺射'],
            effectParams: {
                armorPierce: 0.45,
                splashRadiusCells: 1.3,
                splashRatio: 0.70
            }
        },
        magnet_bud: {
            id: 'magnet_bud',
            family: 'magnet',
            name: '極地磁環',
            shortName: '💠磁環',
            icon: '💠',
            image: '',
            color: '#4A9EBF',
            palette: { rune: '#4A9EBF', glow: '#E0B43C' },
            nodeTier: 1,
            costShare: 2,
            isHybrid: true,
            isPureTrunk: false,
            shopSpawnable: false,
            elementTag: 'magnet',
            lineageTags: ['ice', 'thunder'],
            defaultLineagePath: ['❄️冰芽+⚡雷芽', '💠磁環'],
            attackStyle: 'stun_pulse',
            range: 3.2,
            attacksPerSec: 1.00,
            attackIntervalMs: 1000,
            roleTagPrefix: '群緩連鎖·',
            roleTag: '群緩連鎖·3.2·1.00s',
            roleSummary: '冰雷轉職群體減速彈射塔',
            tooltipSummary: '45% 群體減速 · 2 次彈射（70%）',
            damage: 30,
            tierDamage: [0, 30, 48, 69],
            badges: ['單發 30 · 1.00s', '45% 群體減速', '2 次彈射（70%）'],
            effectParams: {
                slowRate: 0.45,
                slowDurationMs: 2200,
                aoeRadiusCells: 1.3,
                chainExtraTargets: 2,
                chainRadiusCells: 2.6,
                chainDamageRatio: 0.70
            }
        },
        plasma_bud: {
            id: 'plasma_bud',
            family: 'plasma',
            name: '電漿導管',
            shortName: '☄️電漿',
            icon: '☄️',
            image: '',
            color: '#E0B43C',
            palette: { rune: '#C94A38', glow: '#E0B43C' },
            nodeTier: 1,
            costShare: 2,
            isHybrid: true,
            isPureTrunk: false,
            shopSpawnable: false,
            elementTag: 'plasma',
            lineageTags: ['fire', 'thunder'],
            defaultLineagePath: ['🔥火芽+⚡雷芽', '☄️電漿'],
            attackStyle: 'pierce_beam',
            range: 3.6,
            attacksPerSec: Number((1000 / 450).toFixed(2)),
            attackIntervalMs: 450,
            roleTagPrefix: '疊傷光束·',
            roleTag: '疊傷光束·3.6·0.45s',
            roleSummary: '火雷轉職高頻穿甲聚焦塔',
            tooltipSummary: '15% 穿甲 · 鎖定疊 4 層（+12%/層）',
            damage: 13,
            tierDamage: [0, 13, 28, 32],
            badges: ['單發 13 · 0.45s', '無視 15% 護甲', '最高 4 層（+12%/層）'],
            effectParams: {
                armorPierce: 0.15,
                stackBonus: 0.12,
                maxStacks: 4
            }
        },

        // ==================== Tier 2：6 主幹 (3 基礎系 2★ + 3 轉職系 2★) ====================
        fire_trunk: {
            id: 'fire_trunk',
            family: 'fire',
            name: '炎核樹幹',
            shortName: '🔥炎核',
            icon: '🔥',
            image: '',
            color: '#C94A38',
            palette: { rune: '#C94A38', glow: '#F4DFC8' },
            nodeTier: 2,
            costShare: 2,
            isHybrid: false,
            isPureTrunk: true,
            shopSpawnable: false,
            elementTag: 'fire',
            lineageTags: ['fire'],
            defaultLineagePath: ['🔥火芽', '🔥炎核'],
            attackStyle: 'burst_armor_break',
            range: 2.5,
            attacksPerSec: Number((1000 / 1150).toFixed(2)),
            attackIntervalMs: 1150,
            roleTagPrefix: '破甲主幹·',
            roleTag: '破甲主幹·2.5·1.15s',
            roleSummary: '純血火系重擊破甲主幹',
            tooltipSummary: '35% 破甲（3.5s）· 單體重擊',
            damage: 54,
            tierDamage: [0, 25, 54, 115, 240, 496],
            badges: ['單發 54 · 1.15s', '射程 2.5 格', '35% 破甲 3.5s'],
            effectParams: {
                shredRate: 0.35,
                shredDurationMs: 3500
            }
        },
        ice_trunk: {
            id: 'ice_trunk',
            family: 'ice',
            name: '霜晶樹幹',
            shortName: '❄️霜晶',
            icon: '❄️',
            image: '',
            color: '#4A9EBF',
            palette: { rune: '#4A9EBF', glow: '#D6EEF7' },
            nodeTier: 2,
            costShare: 2,
            isHybrid: false,
            isPureTrunk: true,
            shopSpawnable: false,
            elementTag: 'ice',
            lineageTags: ['ice'],
            defaultLineagePath: ['❄️冰芽', '❄️霜晶'],
            attackStyle: 'slow_control',
            range: 3.0,
            attacksPerSec: 1.00,
            attackIntervalMs: 1000,
            roleTagPrefix: '霜控主幹·',
            roleSummary: '純血冰系強效減速主幹',
            tooltipSummary: '50% 強效緩速（2.2s）',
            damage: 32,
            tierDamage: [0, 15, 32, 69, 144, 298],
            badges: ['單發 32 · 1.00s', '射程 3.0 格', '50% 減速 2.2s'],
            effectParams: {
                slowRate: 0.50,
                slowDurationMs: 2200
            }
        },
        thunder_trunk: {
            id: 'thunder_trunk',
            family: 'thunder',
            name: '雷紋樹幹',
            shortName: '⚡雷紋',
            icon: '⚡',
            image: '',
            color: '#E0B43C',
            palette: { rune: '#E0B43C', glow: '#F7EAC0' },
            nodeTier: 2,
            costShare: 2,
            isHybrid: false,
            isPureTrunk: true,
            shopSpawnable: false,
            elementTag: 'thunder',
            lineageTags: ['thunder'],
            defaultLineagePath: ['⚡雷芽', '⚡雷紋'],
            attackStyle: 'chain_lightning',
            range: 3.8,
            attacksPerSec: Number((1000 / 850).toFixed(2)),
            attackIntervalMs: 850,
            roleTagPrefix: '連鎖主幹·',
            roleTag: '連鎖主幹·3.8·0.85s',
            roleSummary: '純血雷系真3體連鎖主幹',
            tooltipSummary: '真·3 體連鎖（100%/65%/45%）',
            damage: 28,
            tierDamage: [0, 13, 28, 60, 125, 258],
            badges: ['單發 28 · 0.85s', '射程 3.8 格', '真 3 體連鎖 100/65/45%'],
            effectParams: {
                boltCount: 3,
                chainRadiusCells: 2.6,
                chainScales: [1.0, 0.65, 0.45]
            }
        },
        steam_trunk: {
            id: 'steam_trunk',
            family: 'steam',
            name: '高階蒸氣',
            shortName: '💨高階蒸氣',
            icon: '💨',
            image: '',
            color: '#D97724',
            palette: { rune: '#D97724', glow: '#4A9EBF' },
            nodeTier: 2,
            costShare: 4,
            isHybrid: true,
            isPureTrunk: false,
            shopSpawnable: false,
            elementTag: 'steam',
            lineageTags: ['fire', 'ice'],
            defaultLineagePath: ['🔥火芽+❄️冰芽', '💨蒸氣', '💨高階蒸氣'],
            attackStyle: 'aoe_mist',
            range: 2.8,
            attacksPerSec: Number((1000 / 1100).toFixed(2)),
            attackIntervalMs: 1100,
            roleTagPrefix: '高階蒸氣·',
            roleTag: '高階蒸氣·2.8·1.10s',
            roleSummary: '高階火冰穿甲範圍爆裂',
            tooltipSummary: '45% 穿甲 · 1.3 格 70% 濺射',
            damage: 74,
            tierDamage: [0, 46, 74, 106, 221, 456],
            badges: ['單發 74 · 1.10s', '無視 45% 護甲', '1.3 格 70% 濺射'],
            effectParams: {
                armorPierce: 0.45,
                splashRadiusCells: 1.3,
                splashRatio: 0.70
            }
        },
        magnet_trunk: {
            id: 'magnet_trunk',
            family: 'magnet',
            name: '高階磁環',
            shortName: '💠高階磁環',
            icon: '💠',
            image: '',
            color: '#4A9EBF',
            palette: { rune: '#4A9EBF', glow: '#E0B43C' },
            nodeTier: 2,
            costShare: 4,
            isHybrid: true,
            isPureTrunk: false,
            shopSpawnable: false,
            elementTag: 'magnet',
            lineageTags: ['ice', 'thunder'],
            defaultLineagePath: ['❄️冰芽+⚡雷芽', '💠磁環', '💠高階磁環'],
            attackStyle: 'stun_pulse',
            range: 3.3,
            attacksPerSec: 1.00,
            attackIntervalMs: 1000,
            roleTagPrefix: '高階磁環·',
            roleTag: '高階磁環·3.3·1.00s',
            roleSummary: '高階冰雷群體減速彈射',
            tooltipSummary: '45% 群體減速 · 2 次彈射（70%）',
            damage: 48,
            tierDamage: [0, 30, 48, 69, 144, 298],
            badges: ['單發 48 · 1.00s', '45% 群體減速', '2 次彈射（70%）'],
            effectParams: {
                slowRate: 0.45,
                slowDurationMs: 2200,
                aoeRadiusCells: 1.3,
                chainExtraTargets: 2,
                chainRadiusCells: 2.6,
                chainDamageRatio: 0.70
            }
        },
        plasma_trunk: {
            id: 'plasma_trunk',
            family: 'plasma',
            name: '高階電漿',
            shortName: '☄️高階電漿',
            icon: '☄️',
            image: '',
            color: '#E0B43C',
            palette: { rune: '#C94A38', glow: '#E0B43C' },
            nodeTier: 2,
            costShare: 4,
            isHybrid: true,
            isPureTrunk: false,
            shopSpawnable: false,
            elementTag: 'plasma',
            lineageTags: ['fire', 'thunder'],
            defaultLineagePath: ['🔥火芽+⚡雷芽', '☄️電漿', '☄️高階電漿'],
            attackStyle: 'pierce_beam',
            range: 3.7,
            attacksPerSec: Number((1000 / 450).toFixed(2)),
            attackIntervalMs: 450,
            roleTagPrefix: '高階電漿·',
            roleTag: '高階電漿·3.7·0.45s',
            roleSummary: '高階火雷穿甲聚焦光束',
            tooltipSummary: '15% 穿甲 · 鎖定疊 4 層（+12%/層）',
            damage: 21,
            tierDamage: [0, 13, 21, 30, 62, 129],
            badges: ['單發 21 · 0.45s', '無視 15% 護甲', '最高 4 層（+12%/層）'],
            effectParams: {
                armorPierce: 0.15,
                stackBonus: 0.12,
                maxStacks: 4
            }
        },

        // ==================== Tier 3：12 冠枝 (每座主幹分為 Branch A / Branch B) ====================
        fire_A: {
            id: 'fire_A',
            family: 'fire',
            branchCode: 'A',
            parentTrunk: 'fire_trunk',
            name: '熔核轟擊樹',
            shortName: '🔥A 熔核轟擊',
            displayBadge: '🔥A 熔核轟擊樹',
            icon: '🔥',
            image: '',
            color: '#C94A38',
            palette: { rune: '#C94A38', glow: '#E0B43C' },
            nodeTier: 3,
            costShare: 4,
            isHybrid: false,
            shopSpawnable: false,
            elementTag: 'fire',
            lineageTags: ['fire'],
            defaultLineagePath: ['🔥火芽', '🔥炎核', '🔥A 熔核轟擊'],
            attackStyle: 'fire_A_mortar',
            range: 2.8,
            attacksPerSec: Number((1000 / 1350).toFixed(2)),
            attackIntervalMs: 1350,
            roleTagPrefix: '重砲群破·',
            roleTag: '重砲群破·2.8·1.35s',
            roleSummary: '大範圍重砲濺射＋45% 群體破甲',
            tooltipSummary: '1.3 格 60% 濺射 · 45% 群體破甲',
            damage: 115,
            tierDamage: [0, 25, 54, 115, 240, 496],
            badges: ['單發 115 · 1.25s', '1.3 格 60% 濺射', '45% 群體破甲 4s'],
            attackIntervalMs: 1250,
            attacksPerSec: Number((1000 / 1250).toFixed(2)),
            effectParams: {
                splashRadiusCells: 1.3,
                splashRatio: 0.60,
                shredRate: 0.45,
                shredDurationMs: 4000
            }
        },
        fire_B: {
            id: 'fire_B',
            family: 'fire',
            branchCode: 'B',
            parentTrunk: 'fire_trunk',
            name: '焚世餘燼樹',
            shortName: '🔥B 焚世餘燼',
            displayBadge: '🔥B 焚世餘燼樹',
            icon: '🔥',
            image: '',
            color: '#D97724',
            palette: { rune: '#C94A38', glow: '#D97724' },
            nodeTier: 3,
            costShare: 4,
            isHybrid: false,
            shopSpawnable: false,
            elementTag: 'fire',
            lineageTags: ['fire'],
            defaultLineagePath: ['🔥火芽', '🔥炎核', '🔥B 焚世餘燼'],
            attackStyle: 'fire_B_ember',
            range: 3.0,
            attacksPerSec: Number((1000 / 880).toFixed(2)),
            attackIntervalMs: 880,
            roleTagPrefix: '灼燒斬殺·',
            roleTag: '灼燒斬殺·3.0·0.88s',
            roleSummary: '5 層灼燒瘟疫傳染＋重傷與 12% 斬殺',
            tooltipSummary: '5 層灼燒傳染 · 50% 重傷 · <12% 斬殺',
            damage: 115,
            tierDamage: [0, 25, 54, 115, 240, 496],
            badges: ['單發 115 · 射程 3.0', '5 層灼燒 +2s 傳染', '50% 重傷 · <12% 處決'],
            effectParams: {
                burnMaxStacks: 5,
                burnFlatDps: 8,
                burnPctMaxHp: 0.0035,
                burnBossCapPerStack: 35,
                burnDurationMs: 5000,
                burnSpreadIntervalMs: 2000,
                burnSpreadRadiusCells: 1.2,
                grievousRate: 0.50,
                grievousDurationMs: 5000,
                executeThresholdPct: 0.12
            }
        },
        ice_A: {
            id: 'ice_A',
            family: 'ice',
            branchCode: 'A',
            parentTrunk: 'ice_trunk',
            name: '永凍領域樹',
            shortName: '❄️A 永凍領域',
            displayBadge: '❄️A 永凍領域樹',
            icon: '❄️',
            image: '',
            color: '#4A9EBF',
            palette: { rune: '#4A9EBF', glow: '#F4F1EA' },
            nodeTier: 3,
            costShare: 4,
            isHybrid: false,
            shopSpawnable: false,
            elementTag: 'ice',
            lineageTags: ['ice'],
            defaultLineagePath: ['❄️冰芽', '❄️霜晶', '❄️A 永凍領域'],
            attackStyle: 'ice_A_permafrost',
            range: 3.2,
            attacksPerSec: Number((1000 / 1100).toFixed(2)),
            attackIntervalMs: 1100,
            roleTagPrefix: '永凍控場·',
            roleTag: '永凍控場·3.2·1.10s',
            roleSummary: '1.5 格 60% 群緩＋每 4 擊觸發凍結與 1.5x 冰爆傷害',
            tooltipSummary: '1.5 格 60% 群緩 · 4 擊凍結 ＋ 1.5x 冰爆',
            damage: 69,
            tierDamage: [0, 15, 32, 69, 144, 298],
            badges: ['單發 69 · 1.10s', '1.5 格 60% 群緩', '4 擊凍結 ＋ 1.5x 冰爆'],
            effectParams: {
                aoeRadiusCells: 1.5,
                slowRate: 0.60,
                slowDurationMs: 2500,
                hitsToFreeze: 4,
                freezeDurationMs: 900,
                bossFreezeMult: 0.50,
                freezeImmuneMs: 6000,
                freezeBurstMult: 1.5
            }
        },
        ice_B: {
            id: 'ice_B',
            family: 'ice',
            branchCode: 'B',
            parentTrunk: 'ice_trunk',
            name: '冰錐穿刺樹',
            shortName: '❄️B 冰錐穿刺',
            displayBadge: '❄️B 冰錐穿刺樹',
            icon: '❄️',
            image: '',
            color: '#4A9EBF',
            palette: { rune: '#4A9EBF', glow: '#E0B43C' },
            nodeTier: 3,
            costShare: 4,
            isHybrid: false,
            shopSpawnable: false,
            elementTag: 'ice',
            lineageTags: ['ice'],
            defaultLineagePath: ['❄️冰芽', '❄️霜晶', '❄️B 冰錐穿刺'],
            attackStyle: 'ice_B_icicle',
            range: 3.5,
            attacksPerSec: Number((1000 / 900).toFixed(2)),
            attackIntervalMs: 900,
            roleTagPrefix: '穿刺碎冰·',
            roleTag: '穿刺碎冰·3.5·0.90s',
            roleSummary: '直線雙體穿透＋對受控敵人 +55% 碎冰傷',
            tooltipSummary: '直線貫穿 2 體 · 受控目標 +55% 碎冰',
            damage: 69,
            tierDamage: [0, 15, 32, 69, 144, 298],
            badges: ['單發 69 · 0.90s', '直線穿透 2 體 (60%)', '受控目標 +55% 碎冰'],
            effectParams: {
                pierceTargets: 2,
                secondTargetRatio: 0.60,
                pierceLineWidthCells: 0.90,
                pierceSearchRadiusCells: 2.3,
                shatterBonus: 0.55,
                slowRate: 0.40,
                slowDurationMs: 2000
            }
        },
        thunder_A: {
            id: 'thunder_A',
            family: 'thunder',
            branchCode: 'A',
            parentTrunk: 'thunder_trunk',
            name: '連鎖天雷樹',
            shortName: '⚡A 連鎖天雷',
            displayBadge: '⚡A 連鎖天雷樹',
            icon: '⚡',
            image: '',
            color: '#E0B43C',
            palette: { rune: '#E0B43C', glow: '#F4F1EA' },
            nodeTier: 3,
            costShare: 4,
            isHybrid: false,
            shopSpawnable: false,
            elementTag: 'thunder',
            lineageTags: ['thunder'],
            defaultLineagePath: ['⚡雷芽', '⚡雷紋', '⚡A 連鎖天雷'],
            attackStyle: 'chain_lightning',
            range: 4.0,
            attacksPerSec: Number((1000 / 850).toFixed(2)),
            attackIntervalMs: 850,
            roleTagPrefix: '四連天雷·',
            roleTag: '四連天雷·4.0·0.85s',
            roleSummary: '高頻真 4 體不同目標連鎖電網',
            tooltipSummary: '真·4 體連鎖（100%/75%/55%/40%）',
            damage: 60,
            tierDamage: [0, 13, 28, 60, 125, 258],
            badges: ['單發 60 · 0.85s', '射程 4.0 格', '真 4 體連鎖 100/75/55/40%'],
            effectParams: {
                boltCount: 4,
                chainRadiusCells: 2.6,
                chainScales: [1.0, 0.75, 0.55, 0.40]
            }
        },
        thunder_B: {
            id: 'thunder_B',
            family: 'thunder',
            branchCode: 'B',
            parentTrunk: 'thunder_trunk',
            name: '落雷審判樹',
            shortName: '⚡B 落雷審判',
            displayBadge: '⚡B 落雷審判樹',
            icon: '⚡',
            image: '',
            color: '#E0B43C',
            palette: { rune: '#E0B43C', glow: '#D97724' },
            nodeTier: 3,
            costShare: 4,
            isHybrid: false,
            shopSpawnable: false,
            elementTag: 'thunder',
            lineageTags: ['thunder'],
            defaultLineagePath: ['⚡雷芽', '⚡雷紋', '⚡B 落雷審判'],
            attackStyle: 'thunder_B_judgment',
            range: 4.8,
            attacksPerSec: Number((1000 / 1050).toFixed(2)),
            attackIntervalMs: 1050,
            roleTagPrefix: '天罰狙擊·',
            roleTag: '天罰狙擊·4.8·1.05s',
            roleSummary: '超遠距離狙擊＋每第 3 發 2.5x 穿甲天罰',
            tooltipSummary: '超遠狙擊 · 每 3 發 2.5x 穿甲天罰',
            damage: 60,
            tierDamage: [0, 13, 28, 60, 125, 258],
            badges: ['單發 60 · 射程 4.8', '每第 3 發 2.5x 天罰', '天罰無視 40% 護甲'],
            effectParams: {
                judgmentEveryN: 3,
                judgmentMult: 2.5,
                judgmentArmorPierce: 0.40
            }
        },
        steam_A: {
            id: 'steam_A',
            family: 'steam',
            branchCode: 'A',
            parentTrunk: 'steam_trunk',
            affinityBias: 'fire',
            name: '焦熱蒸壓樹',
            shortName: '💨A 焦熱蒸壓',
            displayBadge: '💨A 焦熱蒸壓樹',
            icon: '💨',
            image: '',
            color: '#D97724',
            palette: { rune: '#C94A38', glow: '#4A9EBF' },
            nodeTier: 3,
            costShare: 4,
            isHybrid: true,
            shopSpawnable: false,
            elementTag: 'steam',
            lineageTags: ['fire', 'ice'],
            defaultLineagePath: ['🔥火芽', '💨蒸氣', '💨A 焦熱蒸壓'],
            attackStyle: 'steam_A_pressure',
            range: 2.9,
            attacksPerSec: Number((1000 / 1100).toFixed(2)),
            attackIntervalMs: 1100,
            roleTagPrefix: '高壓蒸池·',
            roleTag: '高壓蒸池·2.9·1.10s',
            roleSummary: '65% 高穿甲爆裂＋地面 3s 滾燙蒸氣池',
            tooltipSummary: '65% 穿甲濺射 · 3.0s 蒸氣池（28/s）',
            damage: 106,
            tierDamage: [0, 46, 74, 106, 221, 456],
            badges: ['單發 106 · 65% 穿甲', '1.4 格 65% 濺射', '3s 蒸氣池 (28/s)'],
            effectParams: {
                armorPierce: 0.65,
                splashRadiusCells: 1.4,
                splashRatio: 0.65,
                poolDurationMs: 3000,
                poolDps: 28,
                poolRadiusCells: 1.3
            }
        },
        steam_B: {
            id: 'steam_B',
            family: 'steam',
            branchCode: 'B',
            parentTrunk: 'steam_trunk',
            affinityBias: 'ice',
            name: '霜霧迷宮樹',
            shortName: '💨B 霜霧迷宮',
            displayBadge: '💨B 霜霧迷宮樹',
            icon: '💨',
            image: '',
            color: '#4A9EBF',
            palette: { rune: '#4A9EBF', glow: '#D97724' },
            nodeTier: 3,
            costShare: 4,
            isHybrid: true,
            shopSpawnable: false,
            elementTag: 'steam',
            lineageTags: ['fire', 'ice'],
            defaultLineagePath: ['❄️冰芽', '💨蒸氣', '💨B 霜霧迷宮'],
            attackStyle: 'steam_B_fog',
            range: 3.1,
            attacksPerSec: Number((1000 / 1100).toFixed(2)),
            attackIntervalMs: 1100,
            roleTagPrefix: '霜霧易傷·',
            roleTag: '霜霧易傷·3.1·1.10s',
            roleSummary: '1.6 格大範圍迷霧減速＋全隊 +20% 易傷＋迷霧敵擊殺金幣 +15%',
            tooltipSummary: '1.6 格 35% 群緩 · +20% 易傷 · +15% 掉幣',
            damage: 106,
            tierDamage: [0, 46, 74, 106, 221, 456],
            badges: ['單發 106 · 1.6 格迷霧', '+20% 易傷 · 35% 減速', '迷霧擊殺金幣 +15%'],
            effectParams: {
                aoeRadiusCells: 1.6,
                slowRate: 0.35,
                slowDurationMs: 3000,
                vulnBonus: 0.20,
                vulnDurationMs: 3000,
                mistKillGoldBonusRate: 0.15
            }
        },
        magnet_A: {
            id: 'magnet_A',
            family: 'magnet',
            branchCode: 'A',
            parentTrunk: 'magnet_trunk',
            affinityBias: 'ice',
            name: '引力黑洞樹',
            shortName: '💠A 引力黑洞',
            displayBadge: '💠A 引力黑洞樹',
            icon: '💠',
            image: '',
            color: '#4A9EBF',
            palette: { rune: '#4A9EBF', glow: '#E0B43C' },
            nodeTier: 3,
            costShare: 4,
            isHybrid: true,
            shopSpawnable: false,
            elementTag: 'magnet',
            lineageTags: ['ice', 'thunder'],
            defaultLineagePath: ['❄️冰芽', '💠極地磁環', '💠A 引力黑洞'],
            attackStyle: 'magnet_A_singularity',
            range: 3.3,
            attacksPerSec: Number((1000 / 1250).toFixed(2)),
            attackIntervalMs: 1250,
            roleTagPrefix: '黑洞聚怪·',
            roleTag: '黑洞聚怪·3.3·1.25s',
            roleSummary: '1.5 格 45% 群緩＋每第 3 擊沿路徑回拉 0.45 格',
            tooltipSummary: '1.5 格 45% 群緩 · 第 3 擊回拉 0.45 格',
            damage: 69,
            tierDamage: [0, 30, 48, 69, 144, 298],
            badges: ['單發 69 · 1.25s', '1.5 格 45% 群緩', '第 3 擊回拉 0.45 格'],
            effectParams: {
                aoeRadiusCells: 1.5,
                slowRate: 0.45,
                slowDurationMs: 2400,
                pullEveryN: 3,
                pullDistanceCells: 0.45
            }
        },
        magnet_B: {
            id: 'magnet_B',
            family: 'magnet',
            branchCode: 'B',
            parentTrunk: 'magnet_trunk',
            affinityBias: 'thunder',
            name: '電磁超載樹',
            shortName: '💠B 電磁超載',
            displayBadge: '💠B 電磁超載樹',
            icon: '💠',
            image: '',
            color: '#E0B43C',
            palette: { rune: '#E0B43C', glow: '#4A9EBF' },
            nodeTier: 3,
            costShare: 4,
            isHybrid: true,
            shopSpawnable: false,
            elementTag: 'magnet',
            lineageTags: ['ice', 'thunder'],
            defaultLineagePath: ['⚡雷芽', '💠極地磁環', '💠B 電磁超載'],
            attackStyle: 'magnet_B_overload',
            range: 3.5,
            attacksPerSec: Number((1000 / 950).toFixed(2)),
            attackIntervalMs: 950,
            roleTagPrefix: '感電超載·',
            roleTag: '感電超載·3.5·0.95s',
            roleSummary: '3 目標不重複彈射＋3.5s 感電協同附傷 (10 + 2.5 × 波數)',
            tooltipSummary: '3 目標彈射 · 感電附傷 (10 + 2.5 × 波數)',
            damage: 69,
            tierDamage: [0, 30, 48, 69, 144, 298],
            badges: ['單發 69 · 0.95s', '3 目標不同怪彈射', '感電 3.5s (10+2.5/波)'],
            effectParams: {
                chainTargets: 3,
                chainRadiusCells: 2.6,
                chainDamageRatio: 0.75,
                shockDurationMs: 3500,
                shockBonusBase: 10,
                shockBonusPerWave: 2.5,
                shockBonusDamage: 12,
                shockIcdMs: 350
            }
        },
        plasma_A: {
            id: 'plasma_A',
            family: 'plasma',
            branchCode: 'A',
            parentTrunk: 'plasma_trunk',
            affinityBias: 'fire',
            name: '聚變死光樹',
            shortName: '☄️A 聚變死光',
            displayBadge: '☄️A 聚變死光樹',
            icon: '☄️',
            image: '',
            color: '#C94A38',
            palette: { rune: '#C94A38', glow: '#E0B43C' },
            nodeTier: 3,
            costShare: 4,
            isHybrid: true,
            shopSpawnable: false,
            elementTag: 'plasma',
            lineageTags: ['fire', 'thunder'],
            defaultLineagePath: ['🔥火芽', '☄️電漿導管', '☄️A 聚變死光'],
            attackStyle: 'plasma_A_deathray',
            range: 3.9,
            attacksPerSec: 2.50,
            attackIntervalMs: 400,
            roleTagPrefix: '聚變死光·',
            roleTag: '聚變死光·3.9·0.40s',
            roleSummary: '8 層高倍鎖定 (2.44x)＋5 層 45% 穿甲·換怪僅掉 2 層',
            tooltipSummary: '8 層鎖定（2.44x）· 5 層起 45% 穿甲',
            damage: 30,
            tierDamage: [0, 13, 21, 30, 62, 129],
            badges: ['單發 30 · 0.40s', '8 層鎖定 (+18%/層)', '>=5 層 45% 穿甲·換怪-2 層'],
            effectParams: {
                maxStacks: 8,
                stackBonus: 0.18,
                highStackThreshold: 5,
                highStackArmorPierce: 0.45,
                switchDropStacks: 2
            }
        },
        plasma_B: {
            id: 'plasma_B',
            family: 'plasma',
            branchCode: 'B',
            parentTrunk: 'plasma_trunk',
            affinityBias: 'thunder',
            name: '弧光折射樹',
            shortName: '☄️B 弧光折射',
            displayBadge: '☄️B 弧光折射樹',
            icon: '☄️',
            image: '',
            color: '#E0B43C',
            palette: { rune: '#E0B43C', glow: '#C94A38' },
            nodeTier: 3,
            costShare: 4,
            isHybrid: true,
            shopSpawnable: false,
            elementTag: 'plasma',
            lineageTags: ['fire', 'thunder'],
            defaultLineagePath: ['⚡雷芽', '☄️電漿導管', '☄️B 弧光折射'],
            attackStyle: 'plasma_B_refract',
            range: 3.9,
            attacksPerSec: 2.00,
            attackIntervalMs: 500,
            roleTagPrefix: '弧光折射·',
            roleTag: '弧光折射·3.9·0.50s',
            roleSummary: '主光束 4 層聚焦＋向 2.4 格內折射 2 道 50% 副光束',
            tooltipSummary: '主束 4 層聚焦 · 折射 2 道 50% 副束',
            damage: 30,
            tierDamage: [0, 13, 21, 30, 62, 129],
            badges: ['單發 30 · 0.50s', '主束 4 層 (+15%/層)', '2.4 格折射 2 副束 (50%)'],
            effectParams: {
                maxStacks: 4,
                stackBonus: 0.15,
                refractTargets: 2,
                refractRadiusCells: 2.4,
                refractRatio: 0.50
            }
        }
    };

    // ==================== Tier 4（18 座古冠／雙生神冠，8U）與 Tier 5（6 座世界樹神裔，16U） ====================
    const T4_T5_LINEAGE_SPECS = {
        fire: {
            crownAName: '熾陽熔爐古冠', crownAShort: '🔥A 極意古冠',
            crownBName: '永劫餘燼古冠', crownBShort: '🔥B 極意古冠',
            twinName: '熾燼雙生神冠', twinShort: '🔥AB 雙生神冠',
            scionName: '炎煌神裔', scionShort: '🔥世界樹神裔',
            crownIntervalA: 1120, crownIntervalB: 760, twinInterval: 1000, scionInterval: 880,
            twinSummary: '1.4 格 65% 濺射破甲 (45%)＋5 層灼燒傳染 (<14% 斬殺)',
            scionSummary: '雙分支重砲灼燒完全體＋1.5% 聖冠真傷＋2.2 格友軍光環＋全圖脈動'
        },
        ice: {
            crownAName: '極晝冰獄古冠', crownAShort: '❄️A 極意古冠',
            crownBName: '碎界冰槍古冠', crownBShort: '❄️B 極意古冠',
            twinName: '霜鋒雙生神冠', twinShort: '❄️AB 雙生神冠',
            scionName: '極霜神裔', scionShort: '❄️世界樹神裔',
            crownIntervalA: 960, crownIntervalB: 780, twinInterval: 920, scionInterval: 820,
            twinSummary: '1.6 格 60% 群緩 4 擊凍結＋直線貫穿 2 體 (+60% 碎冰)',
            scionSummary: '永凍冰槍雙修＋15% 脆冰易傷＋2.2 格友軍光環＋全圖脈動'
        },
        thunder: {
            crownAName: '滅界天網古冠', crownAShort: '⚡A 極意古冠',
            crownBName: '終焉聖裁古冠', crownBShort: '⚡B 極意古冠',
            twinName: '霄霆雙生神冠', twinShort: '⚡AB 雙生神冠',
            scionName: '雷極神裔', scionShort: '⚡世界樹神裔',
            crownIntervalA: 740, crownIntervalB: 920, twinInterval: 880, scionInterval: 780,
            twinSummary: '真 4 體連鎖天雷＋每第 3 發 2.4x 穿甲天罰審判',
            scionSummary: '天雷審判雙極＋<10% 天罰處決＋2.2 格友軍光環＋全圖脈動'
        },
        steam: {
            crownAName: '深淵鍋爐古冠', crownAShort: '💨A 極意古冠',
            crownBName: '永霧蝕骨古冠', crownBShort: '💨B 極意古冠',
            twinName: '蒸霖雙生神冠', twinShort: '💨AB 雙生神冠',
            scionName: '蒼霧神裔', scionShort: '💨世界樹神裔',
            crownIntervalA: 960, crownIntervalB: 960, twinInterval: 980, scionInterval: 880,
            twinSummary: '65% 穿甲濺射＋滾燙蒸氣池 (36/s)＋1.6 格霜霧 (+22% 易傷)',
            scionSummary: '高壓霜霧完全體＋額外 25% 穿甲與 0.4 格擴散＋友軍光環＋全圖脈動'
        },
        magnet: {
            crownAName: '奇點坍縮古冠', crownAShort: '💠A 極意古冠',
            crownBName: '超頻雷網古冠', crownBShort: '💠B 極意古冠',
            twinName: '磁穹雙生神冠', twinShort: '💠AB 雙生神冠',
            scionName: '星磁神裔', scionShort: '💠世界樹神裔',
            crownIntervalA: 1080, crownIntervalB: 820, twinInterval: 960, scionInterval: 840,
            twinSummary: '1.6 格群緩回拉 0.5 格＋3 目標感電 (10 + 2.5 × 波數)',
            scionSummary: '磁穹超載完全體＋週期定身控場＋2.2 格友軍光環＋全圖脈動'
        },
        plasma: {
            crownAName: '恆星湮滅古冠', crownAShort: '☄️A 極意古冠',
            crownBName: '萬象稜鏡古冠', crownBShort: '☄️B 極意古冠',
            twinName: '穹光雙生神冠', twinShort: '☄️AB 雙生神冠',
            scionName: '曜漿神裔', scionShort: '☄️世界樹神裔',
            crownIntervalA: 340, crownIntervalB: 430, twinInterval: 410, scionInterval: 360,
            twinSummary: '8 層聚變鎖定 (≥5 層 45% 穿甲)＋折射 2 道 55% 副束',
            scionSummary: '聚變稜鏡完全體 (最高 12 層鎖定)＋2.2 格友軍光環＋全圖脈動'
        }
    };

    const CROWN_EFFECT_OVERRIDES = {
        fire_crown_A: { splashRadiusCells: 1.6, splashRatio: 0.72, shredRate: 0.55, shredDurationMs: 4500 },
        fire_crown_B: { burnMaxStacks: 7, burnFlatDps: 14, burnPctMaxHp: 0.0045, burnBossCapPerStack: 45, grievousRate: 0.60, executeThresholdPct: 0.16 },
        ice_crown_A: { aoeRadiusCells: 1.8, slowRate: 0.65, hitsToFreeze: 3, freezeDurationMs: 1100, freezeImmuneMs: 5000 },
        ice_crown_B: { pierceTargets: 3, secondTargetRatio: 0.72, shatterBonus: 0.75, slowRate: 0.50 },
        thunder_crown_A: { boltCount: 5, chainRadiusCells: 3.0, chainScales: [1.0, 0.80, 0.65, 0.50, 0.38] },
        thunder_crown_B: { judgmentEveryN: 3, judgmentMult: 2.8, judgmentArmorPierce: 0.55 },
        steam_crown_A: { armorPierce: 0.75, splashRadiusCells: 1.65, splashRatio: 0.75, poolDurationMs: 3600, poolDps: 52, poolRadiusCells: 1.5 },
        steam_crown_B: { aoeRadiusCells: 1.9, slowRate: 0.45, vulnBonus: 0.30, vulnDurationMs: 3600 },
        magnet_crown_A: { aoeRadiusCells: 1.8, slowRate: 0.52, pullEveryN: 2, pullDistanceCells: 0.55 },
        magnet_crown_B: { chainTargets: 4, chainDamageRatio: 0.82, shockDurationMs: 4200, shockBonusDamage: 24, shockIcdMs: 280 },
        plasma_crown_A: { maxStacks: 10, stackBonus: 0.20, highStackThreshold: 4, highStackArmorPierce: 0.55, switchDropStacks: 1 },
        plasma_crown_B: { maxStacks: 5, stackBonus: 0.18, refractTargets: 3, refractRadiusCells: 2.8, refractRatio: 0.62 }
    };

    Object.keys(T4_T5_LINEAGE_SPECS).forEach((fam) => {
        const spec = T4_T5_LINEAGE_SPECS[fam];
        const cfgA = WORLD_TREE_NODES[`${fam}_A`];
        const cfgB = WORLD_TREE_NODES[`${fam}_B`];
        if (!cfgA || !cfgB) return;

        const dmg4 = calculateUnitTierDamage(fam, 8, 4);
        const dmg5 = calculateUnitTierDamage(fam, 16, 5);
        const cdA = spec.crownIntervalA || Math.max(120, Math.round(cfgA.attackIntervalMs * 0.86));
        const cdB = spec.crownIntervalB || Math.max(120, Math.round(cfgB.attackIntervalMs * 0.86));
        const twinRange = Number((Math.max(cfgA.range, cfgB.range) + 0.3).toFixed(2));
        const scionRange = Number((Math.max(cfgA.range, cfgB.range) + 0.7).toFixed(2));

        const mkPath = (tail) => {
            const p = (cfgA.defaultLineagePath || []).slice(0, -1);
            p.push(tail);
            return p;
        };

        const cAId = `${fam}_crown_A`;
        WORLD_TREE_NODES[cAId] = Object.assign({}, cfgA, {
            id: cAId,
            family: fam,
            branchCode: 'A',
            isCrownMastery: true,
            isTwinCrown: false,
            nodeTier: 4,
            costShare: 8,
            name: spec.crownAName,
            shortName: spec.crownAShort,
            displayBadge: `${cfgA.icon}A ${spec.crownAName}`,
            range: Number((cfgA.range + 0.3).toFixed(2)),
            attackIntervalMs: cdA,
            attacksPerSec: Number((1000 / cdA).toFixed(2)),
            damage: dmg4,
            tierDamage: [0, cfgA.tierDamage[1], cfgA.tierDamage[2], cfgA.tierDamage[3], dmg4, dmg5],
            defaultLineagePath: mkPath(spec.crownAShort),
            roleSummary: `${cfgA.roleSummary}（4★ 極意特化強化）`,
            tooltipSummary: `${cfgA.tooltipSummary} · 攻速強化`,
            badges: [`單發 ${dmg4} · ${(cdA / 1000).toFixed(2)}s`, `射程 ${Number((cfgA.range + 0.3).toFixed(2))} 格`, '極意古冠 A 强化'],
            effectParams: Object.assign({}, cfgA.effectParams || {}, CROWN_EFFECT_OVERRIDES[cAId] || {})
        });

        const cBId = `${fam}_crown_B`;
        WORLD_TREE_NODES[cBId] = Object.assign({}, cfgB, {
            id: cBId,
            family: fam,
            branchCode: 'B',
            isCrownMastery: true,
            isTwinCrown: false,
            nodeTier: 4,
            costShare: 8,
            name: spec.crownBName,
            shortName: spec.crownBShort,
            displayBadge: `${cfgB.icon}B ${spec.crownBName}`,
            range: Number((cfgB.range + 0.3).toFixed(2)),
            attackIntervalMs: cdB,
            attacksPerSec: Number((1000 / cdB).toFixed(2)),
            damage: dmg4,
            tierDamage: [0, cfgB.tierDamage[1], cfgB.tierDamage[2], cfgB.tierDamage[3], dmg4, dmg5],
            defaultLineagePath: mkPath(spec.crownBShort),
            roleSummary: `${cfgB.roleSummary}（4★ 極意特化強化）`,
            tooltipSummary: `${cfgB.tooltipSummary} · 攻速強化`,
            badges: [`單發 ${dmg4} · ${(cdB / 1000).toFixed(2)}s`, `射程 ${Number((cfgB.range + 0.3).toFixed(2))} 格`, '極意古冠 B 強化'],
            effectParams: Object.assign({}, cfgB.effectParams || {}, CROWN_EFFECT_OVERRIDES[cBId] || {})
        });

        const twinId = `${fam}_twin_AB`;
        const twinParams = Object.assign({}, cfgA.effectParams || {}, cfgB.effectParams || {});
        WORLD_TREE_NODES[twinId] = {
            id: twinId,
            family: fam,
            branchCode: 'AB',
            isTwinCrown: true,
            nodeTier: 4,
            costShare: 8,
            isHybrid: cfgA.isHybrid,
            shopSpawnable: false,
            icon: cfgA.icon,
            image: '',
            color: cfgA.color,
            palette: cfgA.palette,
            elementTag: cfgA.elementTag,
            lineageTags: (cfgA.lineageTags || [fam]).slice(),
            name: spec.twinName,
            shortName: spec.twinShort,
            displayBadge: `${cfgA.icon}AB ${spec.twinName}`,
            attackStyle: `${fam}_twin`,
            range: twinRange,
            attackIntervalMs: spec.twinInterval,
            attacksPerSec: Number((1000 / spec.twinInterval).toFixed(2)),
            roleTagPrefix: '雙生神冠·',
            roleTag: `雙生神冠·${twinRange}·${(spec.twinInterval / 1000).toFixed(2)}s`,
            roleSummary: spec.twinSummary,
            tooltipSummary: spec.twinSummary,
            damage: dmg4,
            tierDamage: [0, cfgA.tierDamage[1], cfgA.tierDamage[2], cfgA.tierDamage[3], dmg4, dmg5],
            defaultLineagePath: mkPath(spec.twinShort),
            badges: [`單發 ${dmg4} · ${(spec.twinInterval / 1000).toFixed(2)}s`, `射程 ${twinRange} 格`, 'A + B 雙分支合體'],
            effectParams: Object.assign(twinParams, {
                poolDps: Math.max(twinParams.poolDps || 28, 36),
                vulnBonus: Math.max(twinParams.vulnBonus || 0.20, 0.22),
                shockBonusDamage: Math.max(twinParams.shockBonusDamage || 12, 18),
                refractRatio: Math.max(twinParams.refractRatio || 0.50, 0.55)
            })
        };

        const scionId = `${fam}_scion`;
        WORLD_TREE_NODES[scionId] = {
            id: scionId,
            family: fam,
            branchCode: '神',
            isScion: true,
            isTwinCrown: true,
            nodeTier: 5,
            costShare: 16,
            isHybrid: cfgA.isHybrid,
            shopSpawnable: false,
            icon: cfgA.icon,
            image: '',
            color: '#E0B43C',
            palette: { rune: cfgA.color, glow: '#E0B43C' },
            elementTag: cfgA.elementTag,
            lineageTags: (cfgA.lineageTags || [fam]).slice(),
            name: spec.scionName,
            shortName: spec.scionShort,
            displayBadge: `${cfgA.icon}5★ ${spec.scionName}`,
            attackStyle: `${fam}_twin`,
            range: scionRange,
            attackIntervalMs: spec.scionInterval,
            attacksPerSec: Number((1000 / spec.scionInterval).toFixed(2)),
            roleTagPrefix: '世界樹神裔·',
            roleTag: `世界樹神裔·${scionRange}·${(spec.scionInterval / 1000).toFixed(2)}s`,
            roleSummary: spec.scionSummary,
            tooltipSummary: spec.scionSummary,
            damage: dmg5,
            tierDamage: [0, cfgA.tierDamage[1], cfgA.tierDamage[2], cfgA.tierDamage[3], dmg4, dmg5],
            defaultLineagePath: [cfgA.shortName, spec.twinShort, spec.scionShort],
            badges: [`單發 ${dmg5} · ${(spec.scionInterval / 1000).toFixed(2)}s`, '2.2 格友軍光環', '6.0s 全圖神樹脈動'],
            effectParams: Object.assign({}, twinParams, CROWN_EFFECT_OVERRIDES[cAId] || {}, CROWN_EFFECT_OVERRIDES[cBId] || {}, {
                poolDps: 56,
                shockBonusDamage: 26,
                refractRatio: 0.65,
                hasScionAura: true,
                hasMapPulse: true
            })
        };
    });

    // 建立包含 48 節點與舊版基礎鍵別名（fire/ice/thunder/steam/magnet/plasma）的 TOWERS 字典
    const TOWERS = Object.assign({}, WORLD_TREE_NODES, {
        fire: Object.assign({}, WORLD_TREE_NODES.fire_bud, {
            id: 'fire',
            canonicalId: 'fire_bud',
            isAlias: true,
            shopSpawnable: false,
            tierRange: [0, 2.3, 2.5, 2.8, 3.1, 3.5],
            tierDamage: [0, 25, 54, 115, 240, 496]
        }),
        ice: Object.assign({}, WORLD_TREE_NODES.ice_bud, {
            id: 'ice',
            canonicalId: 'ice_bud',
            isAlias: true,
            shopSpawnable: false,
            tierRange: [0, 2.8, 3.0, 3.2, 3.5, 3.9],
            tierDamage: [0, 15, 32, 69, 144, 298]
        }),
        thunder: Object.assign({}, WORLD_TREE_NODES.thunder_bud, {
            id: 'thunder',
            canonicalId: 'thunder_bud',
            isAlias: true,
            shopSpawnable: false,
            tierRange: [0, 3.6, 3.8, 4.0, 4.3, 4.7],
            tierDamage: [0, 13, 28, 60, 125, 258]
        }),
        steam: Object.assign({}, WORLD_TREE_NODES.steam_bud, {
            id: 'steam',
            canonicalId: 'steam_bud',
            isAlias: true,
            shopSpawnable: false,
            tierRange: [0, 2.7, 2.8, 2.9, 3.2, 3.6],
            tierDamage: [0, 46, 74, 106, 221, 456]
        }),
        magnet: Object.assign({}, WORLD_TREE_NODES.magnet_bud, {
            id: 'magnet',
            canonicalId: 'magnet_bud',
            isAlias: true,
            shopSpawnable: false,
            tierRange: [0, 3.2, 3.3, 3.3, 3.6, 4.0],
            tierDamage: [0, 30, 48, 69, 144, 298]
        }),
        plasma: Object.assign({}, WORLD_TREE_NODES.plasma_bud, {
            id: 'plasma',
            canonicalId: 'plasma_bud',
            isAlias: true,
            shopSpawnable: false,
            tierRange: [0, 3.6, 3.7, 3.9, 4.2, 4.6],
            tierDamage: [0, 13, 21, 30, 62, 129]
        })
    });

    /**
     * 將舊版或簡寫塔型別 + 星級 正規化為 48 節點標準 ID（1★～5★）
     */
    function normalizeTowerType(type, tier = 1) {
        const raw = String(type || 'fire_bud');
        const t = Math.max(1, Math.min(5, Number(tier) || 1));
        const suffix = t === 1 ? 'bud' : (t === 2 ? 'trunk' : (t === 3 ? 'A' : (t === 4 ? 'crown_A' : 'scion')));
        if (['fire', 'ice', 'thunder', 'steam', 'magnet', 'plasma'].includes(raw)) {
            return `${raw}_${suffix}`;
        }
        const budMatch = raw.match(/^(fire|ice|thunder|steam|magnet|plasma)_bud$/);
        if (budMatch) {
            return `${budMatch[1]}_${suffix}`;
        }
        if (WORLD_TREE_NODES[raw]) return raw;
        return raw;
    }

    /**
     * 取得商店計價對應的基礎元素鍵（'fire' | 'ice' | 'thunder'）
     */
    function getBaseShopKey(type) {
        const raw = String(type || '');
        const mPure = raw.match(/^(fire|ice|thunder)(?:_(?:bud|trunk|A|B|crown_A|crown_B|twin_AB|scion))?$/);
        if (mPure) return mPure[1];
        const cfg = TOWERS[raw];
        return (cfg && (cfg.shopKey || cfg.elementTag)) || raw;
    }

    const TIER_DAMAGE_TABLE = {};
    const BASE_ELEMENT_TYPES = [];
    const ICE_LINEAGE_TYPES = [];
    const FIRE_LINEAGE_TYPES = [];
    const THUNDER_LINEAGE_TYPES = [];

    function syncLegacyAliases() {
        BASE_ELEMENT_TYPES.length = 0;
        ICE_LINEAGE_TYPES.length = 0;
        FIRE_LINEAGE_TYPES.length = 0;
        THUNDER_LINEAGE_TYPES.length = 0;

        // 同步別名與正規節點數值
        ['fire', 'ice', 'thunder'].forEach((baseKey) => {
            const bud = WORLD_TREE_NODES[`${baseKey}_bud`];
            const trunk = WORLD_TREE_NODES[`${baseKey}_trunk`];
            const branchA = WORLD_TREE_NODES[`${baseKey}_A`];
            const crownA = WORLD_TREE_NODES[`${baseKey}_crown_A`];
            const scion = WORLD_TREE_NODES[`${baseKey}_scion`];
            if (bud && TOWERS[baseKey]) {
                TOWERS[baseKey].range = bud.range;
                TOWERS[baseKey].attackIntervalMs = bud.attackIntervalMs;
                TOWERS[baseKey].damage = bud.damage;
                TOWERS[baseKey].tierDamage = [
                    0,
                    bud.damage,
                    trunk ? trunk.damage : calculateUnitTierDamage(baseKey, 2, 2),
                    branchA ? branchA.damage : calculateUnitTierDamage(baseKey, 4, 3),
                    crownA ? crownA.damage : calculateUnitTierDamage(baseKey, 8, 4),
                    scion ? scion.damage : calculateUnitTierDamage(baseKey, 16, 5)
                ];
            }
        });

        Object.keys(TOWERS).forEach((key) => {
            const t = TOWERS[key];
            if (!t) return;
            if (Number.isFinite(t.damage)) {
                const d = t.damage;
                if (!Array.isArray(t.tierDamage) || !t.isAlias) {
                    t.tierDamage = Array.isArray(t.tierDamage) && t.tierDamage.length >= 6
                        ? t.tierDamage
                        : [0, d, d, d, d, d];
                }
            }
            TIER_DAMAGE_TABLE[key] = Array.isArray(t.tierDamage) ? t.tierDamage : [0, 15, 32, 69, 144, 298];

            if (!t.isAlias && !t.isHybrid && t.shopSpawnable) {
                BASE_ELEMENT_TYPES.push(key);
            }
            const lineages = Array.isArray(t.lineageTags) ? t.lineageTags : [t.elementTag || key];
            if (lineages.includes('ice')) ICE_LINEAGE_TYPES.push(key);
            if (lineages.includes('fire')) FIRE_LINEAGE_TYPES.push(key);
            if (lineages.includes('thunder')) THUNDER_LINEAGE_TYPES.push(key);
        });
    }

    function getShopTowerTypes() {
        syncLegacyAliases();
        return Object.keys(WORLD_TREE_NODES).filter(key => {
            const t = WORLD_TREE_NODES[key];
            return Boolean(t && t.nodeTier === 1 && t.shopSpawnable !== false);
        });
    }

    syncLegacyAliases();

    Object.assign(CONFIG, {
        ATTACK_INTERVAL: COMBAT_CONSTANTS.ATTACK_INTERVAL,
        ARMOR_HYPERBOLIC_K: COMBAT_CONSTANTS.ARMOR_HYPERBOLIC_K,
        WEAKNESS_MULTIPLIER: COMBAT_CONSTANTS.WEAKNESS_MULTIPLIER,
        HYBRID_AFFINITY_MULTIPLIER: COMBAT_CONSTANTS.HYBRID_AFFINITY_MULTIPLIER,
        VULN_ADDITIVE_CAP: COMBAT_CONSTANTS.VULN_ADDITIVE_CAP,
        SLOW_TOTAL_CAP: COMBAT_CONSTANTS.SLOW_TOTAL_CAP,
        MIN_SPEED_FLOOR_RATIO: COMBAT_CONSTANTS.MIN_SPEED_FLOOR_RATIO,
        ATTACK_SPEED_MULT_CAP: COMBAT_CONSTANTS.ATTACK_SPEED_MULT_CAP,
        ATTACK_COOLDOWN_FLOOR_MS: COMBAT_CONSTANTS.ATTACK_COOLDOWN_FLOOR_MS
    });

    GameApp.data = GameApp.data || {};
    GameApp.data.towers = {
        WORLD_TREE_NODES,
        TOWERS,
        ELEMENT_CONFIG: TOWERS,
        ROLE_TAG_PREFIXES,
        BASE_ELEMENT_TYPES,
        ICE_LINEAGE_TYPES,
        FIRE_LINEAGE_TYPES,
        THUNDER_LINEAGE_TYPES,
        TARGET_MODE_CYCLE,
        TARGET_MODE_LABELS,
        TIER_DAMAGE_TABLE,
        COMBAT_CONSTANTS,
        STAR_NUTRITION_U,
        STAR_CONCENTRATION_EFFICIENCY,
        FAMILY_BASE_1STAR_DAMAGE,
        getUnitConcentrationEfficiency,
        calculateUnitTierDamage,
        normalizeTowerType,
        getBaseShopKey,
        getShopTowerTypes,
        syncLegacyAliases
    };

    if (global.GameConfig) {
        Object.assign(global.GameConfig, {
            WORLD_TREE_NODES,
            ELEMENT_CONFIG: TOWERS,
            ROLE_TAG_PREFIXES,
            BASE_ELEMENT_TYPES,
            ICE_LINEAGE_TYPES,
            FIRE_LINEAGE_TYPES,
            THUNDER_LINEAGE_TYPES,
            TARGET_MODE_CYCLE,
            TARGET_MODE_LABELS,
            TIER_DAMAGE_TABLE
        });
    }
})(window);
