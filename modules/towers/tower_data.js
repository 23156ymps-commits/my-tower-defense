/**
 * ============================================================================
 * 【檔案名稱】：modules/towers/tower_data.js
 * 【負責功能】：存放所有基礎塔與跨元素融合塔的名稱、色系、攻擊樣式標籤（attackStyle）、
 *               Lv.1～3 階級傷害表、每秒攻速、射程與專屬技能參數。
 * 【讀取資料】：無（本檔為純角色數值設定表，供 tower_attack_system.js、renderer.js 與商店讀取）。
 * 【常見修改入口】：
 *   1. 調整各塔傷害、射程或攻速：直接修改 TOWERS.<角色ID> 內的 tierDamage、range、attackIntervalMs。
 *   2. 新增全新防禦塔：在 TOWERS 內新增一筆物件並填寫 attackStyle 標籤，商店與圖鑑將自動掃描生成。
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

    // 戰鬥傷害核心公式常數
    const COMBAT_CONSTANTS = {
        ATTACK_INTERVAL: 1000,
        ARMOR_HYPERBOLIC_K: 30,             // 雙曲線百分比護甲常數：30 / (30 + effectiveArmor)
        WEAKNESS_MULTIPLIER: 2.0            // 元素相剋暴擊倍率 (200%)
    };

    const ROLE_TAG_PREFIXES = {
        fire: '破甲·短',
        ice: '緩速·中',
        thunder: '連電·長'
    };

    /**
     * 全角色設定總表（支援 6 大攻擊樣式標籤：
     * burst_armor_break / slow_control / chain_lightning / aoe_mist / stun_pulse / pierce_beam）
     */
    const TOWERS = {
        fire: {
            id: 'fire',
            name: '火塔',
            icon: '🔥',
            color: '#e74c3c',
            palette: { rune: '#C94A38', glow: '#F4DFC8' },
            isHybrid: false,
            shopSpawnable: true,
            elementTag: 'fire',
            lineageTags: ['fire'],
            attackStyle: 'burst_armor_break',
            range: 1.8,
            attacksPerSec: 0.77,
            attackIntervalMs: 1300,
            roleTagPrefix: '破甲·短',
            roleTag: '破甲·短1.8·1.3s',
            tierDamage: [0, 24, 54, 120],
            effectParams: {
                shredRate: 0.30,
                shredDurationMs: 3000,
                lv3SplashRatio: 0.35,
                lv3SplashRadiusCells: 1.0
            }
        },
        ice: {
            id: 'ice',
            name: '冰塔',
            icon: '❄️',
            color: '#38bdf8',
            palette: { rune: '#4A9EBF', glow: '#D6EEF7' },
            isHybrid: false,
            shopSpawnable: true,
            elementTag: 'ice',
            lineageTags: ['ice'],
            attackStyle: 'slow_control',
            range: 2.8,
            attacksPerSec: 1.0,
            attackIntervalMs: 1000,
            roleTagPrefix: '緩速·中',
            roleTag: '緩速·中2.8·1.0s',
            tierDamage: [0, 14, 32, 72],
            effectParams: {
                slowRate: 0.45,
                slowDurationMs: 2000,
                lv3SlowRate: 0.60,
                lv3SlowDurationMs: 2500,
                lv3AoeRadiusCells: 1.2,
                lv3AoeSlowRate: 0.30,
                lv3AoeSlowDurationMs: 1500
            }
        },
        thunder: {
            id: 'thunder',
            name: '雷塔',
            icon: '⚡',
            color: '#f59e0b',
            palette: { rune: '#E0B43C', glow: '#F7EAC0' },
            isHybrid: false,
            shopSpawnable: true,
            elementTag: 'thunder',
            lineageTags: ['thunder'],
            attackStyle: 'chain_lightning',
            range: 4.2,
            attacksPerSec: 1.54,
            attackIntervalMs: 650,
            roleTagPrefix: '連電·長',
            roleTag: '連電·長4.2·0.65s',
            tierDamage: [0, 10, 22, 50],
            effectParams: {
                boltCount: 2,
                lv3BoltCount: 3,
                boltDelayMs: 90
            }
        },
        steam: {
            id: 'steam',
            name: '蒸氣爆裂塔',
            icon: '💨',
            color: '#7dd3fc',
            palette: { rune: '#D97724', glow: '#4A9EBF' },
            isHybrid: true,
            shopSpawnable: false,
            elementTag: 'steam',
            lineageTags: ['fire', 'ice'],
            attackStyle: 'aoe_mist',
            range: 2.5,
            attacksPerSec: 0.87,
            attackIntervalMs: 1150,
            roleTagPrefix: '穿甲濺射·',
            roleTag: '穿甲濺射·2.5·1.15s',
            tierDamage: [0, 0, 41, 108],
            effectParams: {
                splashRadiusCells: 1.3,
                splashRatio: 0.75,
                armorPierce: 0.50
            }
        },
        magnet: {
            id: 'magnet',
            name: '極地磁暴塔',
            icon: '💠',
            color: '#818cf8',
            palette: { rune: '#4A9EBF', glow: '#E0B43C' },
            isHybrid: true,
            shopSpawnable: false,
            elementTag: 'magnet',
            lineageTags: ['ice', 'thunder'],
            attackStyle: 'stun_pulse',
            range: 3.2,
            attacksPerSec: 1.05,
            attackIntervalMs: 950,
            roleTagPrefix: '群緩連鎖·',
            roleTag: '群緩連鎖·3.2·0.95s',
            tierDamage: [0, 0, 27, 74],
            effectParams: {
                slowRate: 0.50,
                slowDurationMs: 2200,
                aoeRadiusCells: 1.3,
                chainExtraTargets: 2,
                chainRadiusCells: 2.6,
                chainDamageRatio: 0.75
            }
        },
        plasma: {
            id: 'plasma',
            name: '電漿聚焦塔',
            icon: '☄️',
            color: '#facc15',
            palette: { rune: '#C94A38', glow: '#E0B43C' },
            isHybrid: true,
            shopSpawnable: false,
            elementTag: 'plasma',
            lineageTags: ['fire', 'thunder'],
            attackStyle: 'pierce_beam',
            range: 3.8,
            attacksPerSec: 2.22,
            attackIntervalMs: 450,
            roleTagPrefix: '疊傷光束·',
            roleTag: '疊傷光束·3.8·0.45s',
            tierDamage: [0, 0, 15, 42],
            effectParams: {
                stackBonus: 0.15,
                maxStacks: 5
            }
        }
    };

    // 動態產生相容查表
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

        Object.keys(TOWERS).forEach((key) => {
            const t = TOWERS[key];
            if (!t) return;
            if (Array.isArray(TIER_DAMAGE_TABLE[key])) {
                t.tierDamage = TIER_DAMAGE_TABLE[key];
            } else {
                TIER_DAMAGE_TABLE[key] = Array.isArray(t.tierDamage) ? t.tierDamage : [0, 15, 35, 80];
            }
            if (!t.isHybrid && t.shopSpawnable !== false) {
                BASE_ELEMENT_TYPES.push(key);
            }
            const lineages = Array.isArray(t.lineageTags) ? t.lineageTags : [t.elementTag || key];
            if (lineages.includes('ice')) ICE_LINEAGE_TYPES.push(key);
            if (lineages.includes('fire')) FIRE_LINEAGE_TYPES.push(key);
            if (lineages.includes('thunder')) THUNDER_LINEAGE_TYPES.push(key);
        });
    }

    /**
     * 動態掃描商店可召喚之基礎角色 ID 清單（使用 Object.keys 自動發現）
     */
    function getShopTowerTypes() {
        syncLegacyAliases();
        return Object.keys(TOWERS).filter(key => {
            const t = TOWERS[key];
            return Boolean(t && !t.isHybrid && t.shopSpawnable !== false);
        });
    }

    syncLegacyAliases();

    Object.assign(CONFIG, {
        ATTACK_INTERVAL: COMBAT_CONSTANTS.ATTACK_INTERVAL,
        ARMOR_HYPERBOLIC_K: COMBAT_CONSTANTS.ARMOR_HYPERBOLIC_K,
        WEAKNESS_MULTIPLIER: COMBAT_CONSTANTS.WEAKNESS_MULTIPLIER,
        FIRE_SHRED_RATE: TOWERS.fire.effectParams.shredRate,
        FIRE_SHRED_DURATION_MS: TOWERS.fire.effectParams.shredDurationMs,
        FIRE_LV3_SPLASH_RATIO: TOWERS.fire.effectParams.lv3SplashRatio,
        FIRE_LV3_SPLASH_RADIUS_CELLS: TOWERS.fire.effectParams.lv3SplashRadiusCells,
        ICE_SLOW_DURATION_MS: TOWERS.ice.effectParams.slowDurationMs,
        ICE_SLOW_RATE: TOWERS.ice.effectParams.slowRate,
        ICE_LV3_SLOW_DURATION_MS: TOWERS.ice.effectParams.lv3SlowDurationMs,
        ICE_LV3_SLOW_RATE: TOWERS.ice.effectParams.lv3SlowRate,
        ICE_LV3_AOE_RADIUS_CELLS: TOWERS.ice.effectParams.lv3AoeRadiusCells,
        ICE_LV3_AOE_SLOW_RATE: TOWERS.ice.effectParams.lv3AoeSlowRate,
        ICE_LV3_AOE_SLOW_DURATION_MS: TOWERS.ice.effectParams.lv3AoeSlowDurationMs,
        THUNDER_BOLT_COUNT: TOWERS.thunder.effectParams.boltCount,
        THUNDER_LV3_BOLT_COUNT: TOWERS.thunder.effectParams.lv3BoltCount,
        THUNDER_BOLT_DELAY_MS: TOWERS.thunder.effectParams.boltDelayMs,
        STEAM_SPLASH_RADIUS_CELLS: TOWERS.steam.effectParams.splashRadiusCells,
        STEAM_SPLASH_RATIO: TOWERS.steam.effectParams.splashRatio,
        STEAM_ARMOR_PIERCE: TOWERS.steam.effectParams.armorPierce,
        MAGNET_SLOW_RATE: TOWERS.magnet.effectParams.slowRate,
        MAGNET_SLOW_DURATION_MS: TOWERS.magnet.effectParams.slowDurationMs,
        MAGNET_AOE_RADIUS_CELLS: TOWERS.magnet.effectParams.aoeRadiusCells,
        MAGNET_CHAIN_EXTRA_TARGETS: TOWERS.magnet.effectParams.chainExtraTargets,
        MAGNET_CHAIN_RADIUS_CELLS: TOWERS.magnet.effectParams.chainRadiusCells,
        MAGNET_CHAIN_DAMAGE_RATIO: TOWERS.magnet.effectParams.chainDamageRatio,
        PLASMA_STACK_BONUS: TOWERS.plasma.effectParams.stackBonus,
        PLASMA_MAX_STACKS: TOWERS.plasma.effectParams.maxStacks
    });

    GameApp.data = GameApp.data || {};
    GameApp.data.towers = {
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
        getShopTowerTypes,
        syncLegacyAliases
    };

    if (global.GameConfig) {
        Object.assign(global.GameConfig, {
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
