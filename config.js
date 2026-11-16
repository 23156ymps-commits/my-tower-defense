(function (global) {
    'use strict';

    // ==================== 1. 遊戲規格與平衡參數 ====================
    const CONFIG = {
        DEBUG_MODE: false,                  // 試玩模式預設隱藏測試作弊按鈕；改為 true 可恢復開發測試工具
        VICTORY_WAVE: 10,                   // 正式試玩版總關卡波數（第 10 波為最終魔王戰）
        INITIAL_GOLD: 40,
        INITIAL_BASE_HP: 20,
        BASE_COST: 10,
        COST_STEP: 10,
        COST_MAX: 60,                       // 三元素召喚價格上限 60 金幣
        MAX_TIER: 3,
        ATTACK_INTERVAL: 1000,              // 預設攻速間隔 (ms)
        BOARD_COLS: 15,
        BOARD_ROWS: 10,
        BOARD_SIZE: 150,                    // 15 寬 x 10 高 = 150 格
        SUMMON_NEAR_PATH_RADIUS: 2.0,       // 未指定格時優先落於跑道 2 格內
        MONSTER_BASE_SPEED: 2.6,            // 怪物基礎移動速度 (格/秒)
        MONSTER_SPEED_SCALE: 1.0,           // Firebase Remote Config 怪物速度全局倍率
        MONSTER_HP_SCALE: 1.0,              // Firebase Remote Config 怪物血量全局倍率
        ARMOR_HYPERBOLIC_K: 30,             // 雙曲線百分比護甲常數：30 / (30 + effectiveArmor)
        FIRE_SHRED_RATE: 0.30,              // 火塔命中灼燒破甲幅度（降護甲 30%）
        FIRE_SHRED_DURATION_MS: 3000,       // 火塔灼燒破甲持續時間 (ms)
        FIRE_LV3_SPLASH_RATIO: 0.35,        // 火塔 Lv.3 炎爆濺射傷害比例 (35%)
        FIRE_LV3_SPLASH_RADIUS_CELLS: 1.0,  // 火塔 Lv.3 炎爆濺射半徑 (格)
        ICE_SLOW_DURATION_MS: 2000,         // 冰塔基礎緩速持續時間 (ms)
        ICE_SLOW_RATE: 0.45,                // 冰塔基礎緩速幅度 (降速 45%)
        ICE_LV3_SLOW_DURATION_MS: 2500,     // 冰塔 Lv.3 深度緩速持續時間 (ms)
        ICE_LV3_SLOW_RATE: 0.60,            // 冰塔 Lv.3 深度緩速幅度 (降速 60%)
        ICE_LV3_AOE_RADIUS_CELLS: 1.2,      // 冰塔 Lv.3 寒霜濺射半徑 (格)
        ICE_LV3_AOE_SLOW_RATE: 0.30,        // 冰塔 Lv.3 寒霜濺射緩速幅度 (降速 30%)
        ICE_LV3_AOE_SLOW_DURATION_MS: 1500, // 冰塔 Lv.3 寒霜濺射緩速時間 (ms)
        THUNDER_BOLT_COUNT: 2,              // 雷塔基礎連射閃電數
        THUNDER_LV3_BOLT_COUNT: 3,          // 雷塔 Lv.3 質變三連閃電
        THUNDER_BOLT_DELAY_MS: 90,          // 雷塔後續閃電延遲間隔 (ms，依倍速縮放)
        STEAM_SPLASH_RADIUS_CELLS: 1.3,     // 蒸氣爆裂塔範圍濺射半徑 (格)
        STEAM_SPLASH_RATIO: 0.75,           // 蒸氣爆裂塔濺射傷害比例 (75%)
        STEAM_ARMOR_PIERCE: 0.50,           // 蒸氣爆裂塔無視目標護甲比例 (50%)
        MAGNET_SLOW_RATE: 0.50,             // 極地磁暴塔感電冰環群體緩速 (50%)
        MAGNET_SLOW_DURATION_MS: 2200,      // 極地磁暴塔緩速時間 (ms)
        MAGNET_AOE_RADIUS_CELLS: 1.3,       // 極地磁暴塔感電冰環半徑 (格)
        MAGNET_CHAIN_EXTRA_TARGETS: 2,      // 極地磁暴塔連鎖彈跳額外敵人數 (2 名)
        MAGNET_CHAIN_RADIUS_CELLS: 2.6,     // 極地磁暴塔連鎖彈跳半徑 (格)
        MAGNET_CHAIN_DAMAGE_RATIO: 0.75,    // 極地磁暴塔連鎖彈跳傷害比例
        PLASMA_STACK_BONUS: 0.15,           // 電漿聚焦塔連續鎖定同一目標每層增傷 (15%)
        PLASMA_MAX_STACKS: 5,               // 電漿聚焦塔最大疊加層數 (5 層)
        SLIME_SPLIT_COUNT: 2,               // 分裂史萊姆死亡分裂數量
        SLIME_SPLIT_HP_RATIO: 0.30,         // 迷你史萊姆為母體最大血量的 30%
        SELL_REFUND_RATE: 0.7,              // 出售退還投入金幣 70%
        COMBAT_MOVE_COST: 5,                // 戰鬥出怪/清場期間移動塔位費用
        WEAKNESS_MULTIPLIER: 2.0,           // 弱點相剋暴擊倍率 (200%)
        INITIAL_PREP_MS: 3000,              // 開局備戰倒數 (ms)
        WAVE_INTERMISSION_MS: 4000,         // 波次間休息倒數 (ms)
        STORAGE_BEST_WAVE_KEY: 'merge_defense_best_wave',
        STORAGE_MAP_RECORDS_KEY: 'merge_defense_map_records',
        STORAGE_MUTE_KEY: 'merge_defense_muted',

        // 世界樹活體狀態門檻（對應 70% / 35%）
        WORLD_TREE_HEALTHY_MIN: 14,
        WORLD_TREE_WARNING_MIN: 7,

        // 靈露能量與主動樹靈技能
        DEW_INITIAL: 20,
        DEW_MAX: 100,
        DEW_GAIN_NORMAL: 4,
        DEW_GAIN_SPECIAL: 8,
        DEW_GAIN_BOSS: 30,
        SKILL_ENTANGLE_COST: 40,
        SKILL_ENTANGLE_CD_MS: 8000,
        SKILL_ENTANGLE_DUR_MS: 2500,
        SKILL_ENTANGLE_VULN_BONUS: 0.20,
        SKILL_FRENZY_COST: 60,
        SKILL_FRENZY_CD_MS: 12000,
        SKILL_FRENZY_DUR_MS: 5000,
        SKILL_FRENZY_SPEED_BONUS: 0.35,

        // 世界樹枝枒祝福（每 3 波 3 選 1）與中後期平滑血量校準
        BLESSING_INTERVAL_WAVES: 3,
        BLESSING_SEED_INTERVAL: 5,
        BLESSING_WINTER_SLOW_BONUS: 0.12,
        BLESSING_WINTER_SLOW_CAP: 0.75,
        BLESSING_WINTER_DURATION_BONUS_MS: 500,
        BLESSING_WINTER_STEAM_CHILL_MS: 2000,
        BLESSING_EMBER_RADIUS_CELLS: 1.0,
        BLESSING_EMBER_DAMAGE_RATIO: 0.25,
        BLESSING_LIFE_HEAL: 4,
        BLESSING_DEW_GAIN_BONUS: 0.25,
        BLESSING_THUNDER_SPEED_BONUS: 0.15,
        BLESSING_THUNDER_EXTRA_TARGETS: 1,
        BLESSING_THORN_GLOBAL_DMG: 0.12,
        BLESSING_THORN_TREE_RADIUS_CELLS: 2.5,
        BLESSING_THORN_NEAR_TREE_DMG: 0.10,
        WAVE5_PLUS_HP_MULT: 1.12,

        // Web Audio 原生合成音效基礎音量（各聲部包絡維持 0.08~0.18 之間）
        SFX_VOLUME_MIN: 0.08,
        SFX_VOLUME_MAX: 0.18
    };

    // 基礎三元素與跨元素融合塔設定
    const ELEMENT_CONFIG = {
        fire: {
            name: "火塔",
            icon: "🔥",
            range: 1.8,
            attackIntervalMs: 1300,
            roleTag: "破甲·短1.8·1.3s",
            color: "#e74c3c",
            isHybrid: false
        },
        ice: {
            name: "冰塔",
            icon: "❄️",
            range: 2.8,
            attackIntervalMs: 1000,
            roleTag: "緩速·中2.8·1.0s",
            color: "#38bdf8",
            isHybrid: false
        },
        thunder: {
            name: "雷塔",
            icon: "⚡",
            range: 4.2,
            attackIntervalMs: 650,
            roleTag: "連電·長4.2·0.65s",
            color: "#f59e0b",
            isHybrid: false
        },
        steam: {
            name: "蒸氣爆裂塔",
            icon: "💨",
            range: 2.5,
            attackIntervalMs: 1150,
            roleTag: "穿甲濺射·2.5·1.15s",
            color: "#7dd3fc",
            isHybrid: true
        },
        magnet: {
            name: "極地磁暴塔",
            icon: "💠",
            range: 3.2,
            attackIntervalMs: 950,
            roleTag: "群緩連鎖·3.2·0.95s",
            color: "#818cf8",
            isHybrid: true
        },
        plasma: {
            name: "電漿聚焦塔",
            icon: "☄️",
            range: 3.8,
            attackIntervalMs: 450,
            roleTag: "疊傷光束·3.8·0.45s",
            color: "#facc15",
            isHybrid: true
        }
    };

    const ROLE_TAG_PREFIXES = {
        fire: '破甲·短',
        ice: '緩速·中',
        thunder: '連電·長'
    };

    const BASE_ELEMENT_TYPES = ['fire', 'ice', 'thunder'];
    const ICE_LINEAGE_TYPES = ['ice', 'steam', 'magnet'];
    const FIRE_LINEAGE_TYPES = ['fire', 'steam', 'plasma'];
    const THUNDER_LINEAGE_TYPES = ['thunder', 'magnet', 'plasma'];
    const SPECIAL_MECHANIC_MONSTERS = new Set(['hound', 'slime', 'golem']);

    // 世界樹枝枒祝福庫（每局唯一不重複）
    const BLESSINGS_CATALOG = [
        {
            id: 'abundant_seed',
            icon: '🌱',
            name: '豐饒種子',
            desc: '每累計召喚 5 座塔，第 5 座直接進階為 ★★（Lv.2），召喚區顯示保底進度。'
        },
        {
            id: 'winter_bloodline',
            icon: '❄️',
            name: '凜冬血脈',
            desc: '冰／蒸氣／磁暴塔緩速效果額外 +12%（最高 75%），緩速時間 +0.5 秒。'
        },
        {
            id: 'searing_embers',
            icon: '🔥',
            name: '熾熱餘燼',
            desc: '火／蒸氣／電漿塔擊殺敵人時，引發 1.0 格餘燼爆裂，造成致命一擊 25% 傷害。'
        },
        {
            id: 'life_nectar',
            icon: '💧',
            name: '生命甘露',
            desc: '🌳 世界樹立即回復 4 點生命（不超過 20），且今後擊殺獲得靈露能量 +25%。'
        },
        {
            id: 'thunder_conduction',
            icon: '⚡',
            name: '雷鳴超導',
            desc: '雷／磁暴／電漿塔攻速提升 15%，且閃電／磁暴連鎖目標數額外 +1。'
        },
        {
            id: 'thorn_bulwark',
            icon: '🌿',
            name: '荊棘壁壘',
            desc: '全場防禦塔基礎傷害 +12%，且距離世界樹 2.5 格內的敵人再受額外 +10% 傷害。'
        }
    ];

    // 跨元素融合配方表（Key 為排序後的基礎元素組合）
    const FUSION_RECIPES = {
        'fire+ice': 'steam',
        'ice+thunder': 'magnet',
        'fire+thunder': 'plasma'
    };

    // 索敵優先級模式
    const TARGET_MODE_CYCLE = ['first', 'armor', 'lowhp'];
    const TARGET_MODE_LABELS = {
        first: '最前',
        armor: '高護甲',
        lowhp: '殘血'
    };

    // 超線性階級傷害查表 (Lv.2 > 2x Lv.1, Lv.3 > 2x Lv.2)
    const TIER_DAMAGE_TABLE = {
        fire: [0, 24, 54, 120],
        ice: [0, 14, 32, 72],
        thunder: [0, 10, 22, 50],
        steam: [0, 0, 48, 108],
        magnet: [0, 0, 32, 74],
        plasma: [0, 0, 18, 42]
    };

    // 戰術地形格定義
    const TERRAIN_CONFIG = {
        highground: {
            name: '制高點',
            icon: '⛰️',
            shortTag: '⛰️ 射程+30%',
            tooltip: '⛰️ 制高點：放置於此的塔射程 +30%',
            rangeMult: 1.30
        },
        mana_vein: {
            name: '元素靈脈',
            icon: '✨',
            shortTag: '✨ 攻速+25%',
            tooltip: '✨ 元素靈脈：放置於此的塔攻速 +25%',
            attackSpeedMult: 1.25
        },
        world_tree: {
            name: '世界樹庇護所',
            icon: '🌿',
            shortTag: '🌿 滿血傷+20%',
            tooltip: '🌿 世界樹庇護所：依基地血量比例提供最高 +20% 傷害加成',
            maxDamageBonus: 0.20
        }
    };

    // 怪物弱點與基礎數值表（含新增機制怪：疾風獵犬、分裂史萊姆、重裝魔像）
    const MONSTER_DATABASE = {
        wood: {
            name: "蔓藤巨魔",
            icon: "🌿",
            weakness: "fire",
            baseHp: 68,
            baseReward: 10,
            speedMult: 1.0,
            baseArmor: 0,
            splitsOnDeath: false
        },
        lava: {
            name: "熔岩傀儡",
            icon: "🌋",
            weakness: "ice",
            baseHp: 78,
            baseReward: 11,
            speedMult: 0.92,
            baseArmor: 0,
            splitsOnDeath: false
        },
        air: {
            name: "機械飛艇",
            icon: "🛸",
            weakness: "thunder",
            baseHp: 60,
            baseReward: 10,
            speedMult: 1.15,
            baseArmor: 0,
            splitsOnDeath: false
        },
        hound: {
            name: "疾風獵犬",
            icon: "🐺",
            weakness: "ice",
            baseHp: 44,
            baseReward: 9,
            speedMult: 1.65,
            baseArmor: 0,
            splitsOnDeath: false
        },
        slime: {
            name: "分裂史萊姆",
            icon: "🟢",
            weakness: "fire",
            baseHp: 90,
            baseReward: 13,
            speedMult: 0.88,
            baseArmor: 0,
            splitsOnDeath: true
        },
        golem: {
            name: "重裝魔像",
            icon: "🗿",
            weakness: "thunder",
            baseHp: 112,
            baseReward: 16,
            speedMult: 0.72,
            baseArmor: 15,
            splitsOnDeath: false
        }
    };

    // 魔王輪替序列（Wave 5 弱冰 -> Wave 10 弱火腐朽古樹王 -> Wave 15 弱雷，避免撞屬性）
    const BOSS_ROSTER = [
        { typeKey: 'lava', name: '熔岩巨獸王', icon: '🌋', armorBase: 12, hpBase: 1950 },
        { typeKey: 'wood', name: '腐朽古樹王', icon: '👹', armorBase: 15, hpBase: 4200 },
        { typeKey: 'air', name: '風暴領主王', icon: '🛸', armorBase: 17, hpBase: 5600 }
    ];

    // 波次強度與魔王參數（Wave 4~10 血量上調 1.4x~1.5x 以配合新戰術系統）
    const WAVE_BALANCE = {
        BASE_COUNT: 6,
        COUNT_PER_WAVE: 2,
        MAX_COUNT_PER_WAVE: 28,
        HP_GROWTH_LINEAR: 0.28,
        HP_GROWTH_QUAD: 0.03,
        REWARD_WAVE_STEP: 2,
        ELITE_START_WAVE: 4,
        ELITE_BASE_ARMOR: 6,
        ELITE_ARMOR_GROWTH_STEP: 3,
        ELITE_HP_MULT: 2.1,
        ELITE_REWARD_MULT: 2.2,
        ELITE_SPEED_MULT: 0.85,
        FINAL_WAVE_ESCORT_COUNT: 14,
        WAVE5_ESCORT_COUNT: 10,
        BOSS_SPEED_MULT: 0.55,
        BOSS_REWARD: 120,
        MID_BOSS_REWARD: 75,
        BOSS_BASE_DAMAGE: 20,
        MID_BOSS_BASE_DAMAGE: 8,
        ENDLESS_BOSS_BASE_DAMAGE: 10,
        SPAWN_INTERVAL_BASE_MS: 1600,
        SPAWN_INTERVAL_DECAY_MS: 65,
        SPAWN_INTERVAL_MIN_MS: 750
    };

    // 雙地圖關卡與路徑點（WAYPOINTS）設定（🌲 晨光森林 / 🔥 熔岩峽谷）
    const MAPS_CONFIG = {
        forest: {
            id: 'forest',
            name: '🌲 晨光森林',
            startGoldBonus: 0,
            killGoldMult: 1.0,
            waypoints: [
                { x: 0, y: 2 },
                { x: 12, y: 2 },
                { x: 12, y: 7 },
                { x: 2, y: 7 },
                { x: 2, y: 9 },
                { x: 14, y: 9 }
            ],
            terrainLayout: {
                highground: [
                    [10, 3], [13, 4], [6, 5], [10, 6], [3, 5], [7, 8]
                ],
                mana_vein: [
                    [8, 3], [13, 6], [4, 6], [5, 8], [9, 8], [11, 8]
                ],
                world_tree: [
                    [14, 7], [12, 8], [13, 8], [14, 8]
                ]
            }
        },
        lava: {
            id: 'lava',
            name: '🔥 熔岩峽谷',
            startGoldBonus: 10,
            killGoldMult: 1.15,
            waypoints: [
                { x: 0, y: 1 },
                { x: 8, y: 1 },
                { x: 8, y: 5 },
                { x: 4, y: 5 },
                { x: 4, y: 8 },
                { x: 14, y: 8 },
                { x: 14, y: 9 }
            ],
            terrainLayout: {
                highground: [
                    [6, 3], [7, 4], [3, 5], [6, 7], [10, 7], [11, 4]
                ],
                mana_vein: [
                    [3, 2], [7, 2], [5, 4], [3, 7], [8, 7], [12, 7]
                ],
                world_tree: [
                    [14, 7], [13, 7], [12, 9], [13, 9]
                ]
            }
        }
    };

    // 波次怪池配置（WAVES）
    const WAVES = {
        pools: [
            { maxWave: 1, monsters: ['wood', 'lava', 'air'] },
            { maxWave: 2, monsters: ['wood', 'lava', 'air', 'hound'] },
            { maxWave: 3, monsters: ['wood', 'lava', 'air', 'hound', 'slime'] },
            { maxWave: Infinity, monsters: ['wood', 'lava', 'air', 'hound', 'slime', 'golem'] }
        ]
    };

    function coordsToIndex(x, y) {
        return y * CONFIG.BOARD_COLS + x;
    }

    function indexToCoords(index) {
        return {
            x: index % CONFIG.BOARD_COLS,
            y: Math.floor(index / CONFIG.BOARD_COLS)
        };
    }

    function getBossSpecForWave(waveNum) {
        const milestoneIdx = Math.max(0, Math.floor(waveNum / 5) - 1);
        const template = BOSS_ROSTER[milestoneIdx % BOSS_ROSTER.length];
        const endlessCycles = Math.max(0, Math.floor((waveNum - CONFIG.VICTORY_WAVE) / 5));

        let bossHp;
        if (waveNum === 5) {
            bossHp = template.hpBase;
        } else if (waveNum === CONFIG.VICTORY_WAVE) {
            bossHp = 4200;
        } else {
            bossHp = Math.round(4200 * (1 + endlessCycles * 0.65));
        }
        if (waveNum >= 5) {
            bossHp = Math.round(bossHp * CONFIG.WAVE5_PLUS_HP_MULT);
        }

        const bossArmor = template.armorBase + endlessCycles * 2;
        const bossBaseDamage = waveNum === CONFIG.VICTORY_WAVE
            ? WAVE_BALANCE.BOSS_BASE_DAMAGE
            : (waveNum === 5 ? WAVE_BALANCE.MID_BOSS_BASE_DAMAGE : WAVE_BALANCE.ENDLESS_BOSS_BASE_DAMAGE);

        return {
            typeKey: template.typeKey,
            name: template.name,
            icon: template.icon,
            weakness: MONSTER_DATABASE[template.typeKey].weakness,
            armor: bossArmor,
            hp: bossHp,
            baseDamage: bossBaseDamage,
            reward: waveNum === 5 ? WAVE_BALANCE.MID_BOSS_REWARD : WAVE_BALANCE.BOSS_REWARD
        };
    }

    function getWaveNormalPool(waveNum) {
        for (let i = 0; i < WAVES.pools.length; i++) {
            if (waveNum <= WAVES.pools[i].maxWave) {
                return WAVES.pools[i].monsters;
            }
        }
        return WAVES.pools[WAVES.pools.length - 1].monsters;
    }

    function clampNumber(val, min, max, fallback) {
        const n = Number(val);
        if (!Number.isFinite(n)) return fallback;
        return Math.min(max, Math.max(min, n));
    }

    global.GameConfig = {
        CONFIG,
        ELEMENT_CONFIG,
        ROLE_TAG_PREFIXES,
        BASE_ELEMENT_TYPES,
        ICE_LINEAGE_TYPES,
        FIRE_LINEAGE_TYPES,
        THUNDER_LINEAGE_TYPES,
        SPECIAL_MECHANIC_MONSTERS,
        BLESSINGS_CATALOG,
        FUSION_RECIPES,
        TARGET_MODE_CYCLE,
        TARGET_MODE_LABELS,
        TIER_DAMAGE_TABLE,
        TERRAIN_CONFIG,
        MONSTER_DATABASE,
        BOSS_ROSTER,
        WAVE_BALANCE,
        MAPS_CONFIG,
        WAVES,
        clampNumber,
        coordsToIndex,
        indexToCoords,
        getBossSpecForWave,
        getWaveNormalPool
    };
})(window);
