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

// 雙地圖關卡設定（🌲 晨光森林 / 🔥 熔岩峽谷）
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

function coordsToIndex(x, y) {
    return y * CONFIG.BOARD_COLS + x;
}

function indexToCoords(index) {
    return {
        x: index % CONFIG.BOARD_COLS,
        y: Math.floor(index / CONFIG.BOARD_COLS)
    };
}

let WAYPOINTS = [];
let START_CELL_INDEX = 0;
let END_CELL_INDEX = CONFIG.BOARD_SIZE - 1;
const PATH_CELL_INDICES = new Set();
const CELL_PATH_DIST = new Float32Array(CONFIG.BOARD_SIZE);
const TERRAIN_MAP = new Map();
let WAYPOINT_CUM_DIST = [0];
const PATH_FLOW_ARROWS = new Map();

function getCurrentMapSpec() {
    return MAPS_CONFIG[currentMapId] || MAPS_CONFIG.forest;
}

function applyMapConfig(mapId) {
    const spec = MAPS_CONFIG[mapId] || MAPS_CONFIG.forest;
    currentMapId = spec.id;
    WAYPOINTS = spec.waypoints.map(pt => ({ x: pt.x, y: pt.y }));
    START_CELL_INDEX = coordsToIndex(WAYPOINTS[0].x, WAYPOINTS[0].y);
    END_CELL_INDEX = coordsToIndex(WAYPOINTS[WAYPOINTS.length - 1].x, WAYPOINTS[WAYPOINTS.length - 1].y);

    // 1. 產生所有路徑經過的格子編號集合
    PATH_CELL_INDICES.clear();
    for (let i = 0; i < WAYPOINTS.length - 1; i++) {
        const p1 = WAYPOINTS[i];
        const p2 = WAYPOINTS[i + 1];

        let curX = p1.x;
        let curY = p1.y;
        PATH_CELL_INDICES.add(coordsToIndex(curX, curY));

        while (curX !== p2.x || curY !== p2.y) {
            if (curX < p2.x) curX++;
            else if (curX > p2.x) curX--;
            else if (curY < p2.y) curY++;
            else if (curY > p2.y) curY--;
            PATH_CELL_INDICES.add(coordsToIndex(curX, curY));
        }
    }

    // 2. 預計算每個格子到最近跑道格子的歐氏格距
    const pathCoords = Array.from(PATH_CELL_INDICES).map(indexToCoords);
    for (let idx = 0; idx < CONFIG.BOARD_SIZE; idx++) {
        if (PATH_CELL_INDICES.has(idx)) {
            CELL_PATH_DIST[idx] = 0;
            continue;
        }
        const c = indexToCoords(idx);
        let minDist = Infinity;
        for (let p = 0; p < pathCoords.length; p++) {
            const d = Math.hypot(c.x - pathCoords[p].x, c.y - pathCoords[p].y);
            if (d < minDist) minDist = d;
        }
        CELL_PATH_DIST[idx] = minDist;
    }

    // 3. 配置 16 格戰術地形（嚴禁與跑道重疊）
    TERRAIN_MAP.clear();
    Object.entries(spec.terrainLayout).forEach(([terrainType, coordsList]) => {
        for (let i = 0; i < coordsList.length; i++) {
            const [x, y] = coordsList[i];
            const idx = coordsToIndex(x, y);
            if (!PATH_CELL_INDICES.has(idx)) {
                TERRAIN_MAP.set(idx, terrainType);
            }
        }
    });

    // 4. 預計算路徑點累積距離與跑道流向箭頭
    WAYPOINT_CUM_DIST = [0];
    for (let i = 0; i < WAYPOINTS.length - 1; i++) {
        const dx = WAYPOINTS[i + 1].x - WAYPOINTS[i].x;
        const dy = WAYPOINTS[i + 1].y - WAYPOINTS[i].y;
        WAYPOINT_CUM_DIST.push(WAYPOINT_CUM_DIST[i] + Math.hypot(dx, dy));
    }

    PATH_FLOW_ARROWS.clear();
    let step = 0;
    for (let i = 0; i < WAYPOINTS.length - 1; i++) {
        const p1 = WAYPOINTS[i];
        const p2 = WAYPOINTS[i + 1];
        const segDx = Math.sign(p2.x - p1.x);
        const segDy = Math.sign(p2.y - p1.y);
        const deg = segDx === 1 ? 0 : (segDy === 1 ? 90 : (segDx === -1 ? 180 : -90));

        let curX = p1.x;
        let curY = p1.y;
        while (curX !== p2.x || curY !== p2.y) {
            const idx = coordsToIndex(curX, curY);
            const isCorner = curX === p1.x && curY === p1.y && i > 0;
            if (idx !== START_CELL_INDEX && idx !== END_CELL_INDEX && (isCorner || step % 2 === 1)) {
                PATH_FLOW_ARROWS.set(idx, deg);
            }
            curX += segDx;
            curY += segDy;
            step++;
        }
    }

    if (typeof document !== 'undefined' && document.body) {
        document.body.classList.toggle('map-lava', currentMapId === 'lava');
    }
}

// ==================== 2. 狀態管理與持久化紀錄 ====================
function loadBestWave() {
    try {
        const saved = parseInt(localStorage.getItem(CONFIG.STORAGE_BEST_WAVE_KEY), 10);
        return Number.isFinite(saved) && saved >= 1 ? saved : 1;
    } catch (err) {
        return 1;
    }
}

function saveBestWave(wave) {
    try {
        localStorage.setItem(CONFIG.STORAGE_BEST_WAVE_KEY, String(wave));
    } catch (err) {
        // 受限瀏覽環境或隱私模式可能無法寫入 localStorage，靜默忽略不中斷遊戲
    }
}

function loadMapRecords() {
    const legacyBest = loadBestWave();
    const defaults = {
        forest: { bestWave: Math.max(1, legacyBest), bestStars: 0 },
        lava: { bestWave: 1, bestStars: 0 }
    };
    try {
        const raw = localStorage.getItem(CONFIG.STORAGE_MAP_RECORDS_KEY);
        if (!raw) return defaults;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return defaults;

        ['forest', 'lava'].forEach(id => {
            const rec = parsed[id];
            if (rec && typeof rec === 'object') {
                const w = parseInt(rec.bestWave, 10);
                const s = parseInt(rec.bestStars, 10);
                if (Number.isFinite(w) && w >= 1) {
                    defaults[id].bestWave = id === 'forest' ? Math.max(w, legacyBest) : w;
                }
                if (Number.isFinite(s) && s >= 0) {
                    defaults[id].bestStars = Math.min(3, s);
                }
            }
        });
        return defaults;
    } catch (err) {
        return defaults;
    }
}

function saveMapRecord(mapId, wave, stars = null) {
    const records = loadMapRecords();
    const target = records[mapId] || { bestWave: 1, bestStars: 0 };
    if (Number.isFinite(wave) && wave > target.bestWave) {
        target.bestWave = wave;
    }
    if (Number.isFinite(stars) && stars > target.bestStars) {
        target.bestStars = Math.min(3, Math.max(0, stars));
    }
    records[mapId] = target;

    try {
        localStorage.setItem(CONFIG.STORAGE_MAP_RECORDS_KEY, JSON.stringify(records));
    } catch (err) {
        // 靜默忽略
    }
    const maxOverall = Math.max(records.forest.bestWave || 1, records.lava.bestWave || 1);
    saveBestWave(maxOverall);
    return records;
}

function getMapBestWave(mapId) {
    const records = loadMapRecords();
    return (records[mapId] && records[mapId].bestWave) || 1;
}

function renderMapSelectorUI() {
    const records = loadMapRecords();
    if (mapSelectorGridEl) {
        const cards = mapSelectorGridEl.querySelectorAll('.map-card');
        cards.forEach(card => {
            const isSelected = card.dataset.mapId === currentMapId;
            card.classList.toggle('selected', isSelected);
            card.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
        });
    }

    const formatRec = (rec) => {
        const starsTxt = rec.bestStars > 0 ? `通關 ${'⭐'.repeat(rec.bestStars)}` : '尚未通關';
        return `🏆 最高 Wave ${rec.bestWave} ｜ ${starsTxt}`;
    };
    if (mapRecordForestEl) mapRecordForestEl.innerText = formatRec(records.forest);
    if (mapRecordLavaEl) mapRecordLavaEl.innerText = formatRec(records.lava);
}

function selectMap(mapId) {
    if (waveState !== 'WAITING_START') return;
    if (!MAPS_CONFIG[mapId] || mapId === currentMapId) return;

    applyMapConfig(mapId);
    const mapSpec = getCurrentMapSpec();
    bestWave = getMapBestWave(currentMapId);
    currentGold = CONFIG.INITIAL_GOLD + (mapSpec.startGoldBonus || 0);
    selectedIndex = null;
    buildTargetIndex = null;
    hoveredIndex = null;

    initBoard();
    renderBoard();
    renderMapSelectorUI();
    updateHUD();

    const bonusNote = mapSpec.startGoldBonus > 0
        ? `（起始金幣 +${mapSpec.startGoldBonus}💰，擊殺金幣 +${Math.round((mapSpec.killGoldMult - 1) * 100)}%）`
        : '';
    if (msgText) {
        msgText.innerText = `已切換戰場【${mapSpec.name}】${bonusNote}，點擊「開始防守」開戰！`;
    }
    SoundEngine.playSpawn(1);
}

function recordTowerDamage(towerObj, damageAmount) {
    if (!towerObj || !Number.isFinite(damageAmount) || damageAmount <= 0) return;
    towerObj.totalDamage = (towerObj.totalDamage || 0) + damageAmount;
    totalTeamDamage += damageAmount;

    const cfg = ELEMENT_CONFIG[towerObj.type];
    if (!peakTowerSnapshot || towerObj.totalDamage >= peakTowerSnapshot.totalDamage) {
        peakTowerSnapshot = {
            uid: towerObj.uid,
            type: towerObj.type,
            tier: towerObj.tier,
            name: cfg ? cfg.name : towerObj.type,
            icon: cfg ? cfg.icon : '',
            totalDamage: towerObj.totalDamage
        };
    }
}

function updateTowerAimVisual(towerIndex, towerObj, towerPos, targetPos) {
    if (!towerObj || !towerPos || !targetPos) return;
    const dx = targetPos.left - towerPos.left;
    const dy = targetPos.top - towerPos.top;
    if (dx === 0 && dy === 0) return;

    const angleDeg = Math.round((Math.atan2(dy, dx) * 180 / Math.PI) + 90);
    towerObj.aimAngleDeg = angleDeg;

    const towerEl = towerElements[towerIndex];
    if (!towerEl) return;

    const rotator = towerEl.querySelector('.tower-head-rotator');
    if (rotator) {
        rotator.style.transform = `rotate(${angleDeg}deg)`;
    }

    const recoilEl = towerEl.querySelector('.tower-head-recoil');
    if (recoilEl) {
        const useB = recoilEl.classList.contains('recoil-a');
        recoilEl.classList.remove('recoil-a', 'recoil-b');
        recoilEl.classList.add(useB ? 'recoil-b' : 'recoil-a');
    }
}

function getMvpSummaryText() {
    let bestBoardTower = null;
    for (let i = 0; i < board.length; i++) {
        const t = board[i];
        if (!t || !(t.totalDamage > 0)) continue;
        if (!bestBoardTower || t.totalDamage > bestBoardTower.totalDamage) {
            bestBoardTower = t;
        }
    }

    let mvp = null;
    if (bestBoardTower && (!peakTowerSnapshot || bestBoardTower.totalDamage >= peakTowerSnapshot.totalDamage)) {
        const cfg = ELEMENT_CONFIG[bestBoardTower.type];
        mvp = {
            type: bestBoardTower.type,
            tier: bestBoardTower.tier,
            name: cfg ? cfg.name : bestBoardTower.type,
            icon: cfg ? cfg.icon : '',
            totalDamage: bestBoardTower.totalDamage
        };
    } else if (peakTowerSnapshot && peakTowerSnapshot.totalDamage > 0) {
        mvp = peakTowerSnapshot;
    }

    if (!mvp || mvp.totalDamage <= 0) {
        return '尚無輸出紀錄';
    }
    const sharePct = totalTeamDamage > 0 ? Math.round((mvp.totalDamage / totalTeamDamage) * 100) : 0;
    const prefix = mvp.icon ? `${mvp.icon} ` : '';
    return `${prefix}${mvp.name} ${getTierStars(mvp.tier)} — ${mvp.totalDamage.toLocaleString()} 傷害 (${sharePct}%)`;
}

function populateBattleRecap(mode) {
    const mapSpec = getCurrentMapSpec();
    const mvpText = getMvpSummaryText();

    if (mode === 'victory') {
        if (victoryMapTextEl) victoryMapTextEl.innerText = mapSpec.name;
        if (victoryKillsTextEl) victoryKillsTextEl.innerText = `${killsCount} 隻`;
        if (victoryHpTextEl) victoryHpTextEl.innerText = `${baseHp} / ${CONFIG.INITIAL_BASE_HP}`;
        if (victoryGoldTextEl) victoryGoldTextEl.innerText = `${currentGold} 💰`;
        if (victoryMvpTextEl) victoryMvpTextEl.innerText = mvpText;
        if (victoryGoldEarnedTextEl) victoryGoldEarnedTextEl.innerText = `${totalGoldEarned.toLocaleString()} 💰`;
        if (victoryFusionTextEl) victoryFusionTextEl.innerText = `${fusionCount} 次`;
        return;
    }

    if (gameoverMapTextEl) gameoverMapTextEl.innerText = mapSpec.name;
    if (finalWaveTextEl) {
        finalWaveTextEl.innerText = isEndlessMode
            ? `Wave ${currentWave} (無盡)`
            : `Wave ${currentWave} / ${CONFIG.VICTORY_WAVE}`;
    }
    if (finalBestTextEl) finalBestTextEl.innerText = `Wave ${bestWave}`;
    if (finalKillsTextEl) finalKillsTextEl.innerText = `${killsCount} 隻`;
    if (gameoverMvpTextEl) gameoverMvpTextEl.innerText = mvpText;
    if (gameoverGoldEarnedTextEl) gameoverGoldEarnedTextEl.innerText = `${totalGoldEarned.toLocaleString()} 💰`;
    if (gameoverFusionTextEl) gameoverFusionTextEl.innerText = `${fusionCount} 次`;
    if (gameoverBreakerRowEl && gameoverBreakerTextEl) {
        if (lastBreakerName) {
            gameoverBreakerTextEl.innerText = lastBreakerName;
            gameoverBreakerRowEl.classList.remove('hidden');
        } else {
            gameoverBreakerRowEl.classList.add('hidden');
        }
    }
}

function toggleCombatPause() {
    if (!isMatchPhaseActive()) return;
    if (waveState !== 'SPAWNING' && waveState !== 'CLEARING') return;

    isPaused = !isPaused;
    if (isPaused) {
        if (rafId !== null) {
            cancelAnimationFrame(rafId);
            rafId = null;
        }
        clearTouchDragVisuals();
        draggedIndex = null;
        hoveredIndex = null;
        updateRangeIndicator();
        if (msgText) msgText.innerText = '⏸️ 戰鬥已暫停（再按空白鍵 Space 繼續）';
        updateHUD();
    } else {
        if (msgText) msgText.innerText = '▶️ 戰鬥繼續！全力防禦！';
        updateHUD();
        startMainLoop();
    }
}

function loadMutedPref() {
    try {
        return localStorage.getItem(CONFIG.STORAGE_MUTE_KEY) === 'true';
    } catch (err) {
        return false;
    }
}

function saveMutedPref(muted) {
    try {
        localStorage.setItem(CONFIG.STORAGE_MUTE_KEY, muted ? 'true' : 'false');
    } catch (err) {
        // 受限瀏覽環境或隱私模式忽略
    }
}

/**
 * 純原生 Web Audio API 程式合成音效引擎（零外部音檔、離線可用）
 */
const SoundEngine = {
    ctx: null,
    isMuted: loadMutedPref(),
    lastGroupTime: {},

    ensureContext() {
        if (this.isMuted) return null;
        if (typeof window === 'undefined') return null;
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return null;
        if (!this.ctx) {
            try {
                this.ctx = new AudioCtx();
            } catch (err) {
                return null;
            }
        }
        if (this.ctx && this.ctx.state === 'suspended' && typeof this.ctx.resume === 'function') {
            this.ctx.resume().catch(() => { });
        }
        return this.ctx;
    },

    canPlayGroup(groupKey, minGapSec = 0.055) {
        if (!this.ctx) return false;
        const now = this.ctx.currentTime;
        const prev = this.lastGroupTime[groupKey] || 0;
        if (now - prev < minGapSec) return false;
        this.lastGroupTime[groupKey] = now;
        return true;
    },

    tone({ freq, freqEnd = null, type = 'sine', duration = 0.14, gain = 0.12, delay = 0 }) {
        const ctx = this.ensureContext();
        if (!ctx) return;

        const now = ctx.currentTime + delay;
        const peakGain = Math.max(CONFIG.SFX_VOLUME_MIN, Math.min(CONFIG.SFX_VOLUME_MAX, gain));
        const osc = ctx.createOscillator();
        const env = ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(Math.max(40, freq), now);
        if (freqEnd !== null && freqEnd > 0) {
            osc.frequency.exponentialRampToValueAtTime(Math.max(40, freqEnd), now + duration);
        }

        env.gain.setValueAtTime(0.0001, now);
        env.gain.linearRampToValueAtTime(peakGain, now + 0.012);
        env.gain.exponentialRampToValueAtTime(0.0001, now + duration);

        osc.connect(env);
        env.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + duration + 0.015);
    },

    playSpawn(tier = 1) {
        const base = tier >= 2 ? 523.25 : 440;
        this.tone({ freq: base, freqEnd: base * 1.12, type: 'triangle', duration: 0.09, gain: 0.11, delay: 0 });
        this.tone({ freq: base * 1.5, freqEnd: base * 1.55, type: 'sine', duration: 0.12, gain: 0.12, delay: 0.065 });
    },

    playMerge(tier = 2, isCrossElement = false) {
        const notes = tier >= 3 ? [523.25, 659.25, 783.99, 1046.5] : [440, 554.37, 659.25];
        if (isCrossElement) notes.push(tier >= 3 ? 1318.5 : 880);
        notes.forEach((f, idx) => {
            this.tone({ freq: f, type: isCrossElement ? 'triangle' : 'sine', duration: 0.16, gain: 0.12, delay: idx * 0.055 });
        });
    },

    playTowerShot(towerType) {
        const ctx = this.ensureContext();
        if (!ctx) return;
        if (towerType === 'fire' || towerType === 'steam') {
            if (!this.canPlayGroup('fire', 0.07)) return;
            this.tone({ freq: towerType === 'steam' ? 230 : 185, freqEnd: 62, type: 'triangle', duration: 0.13, gain: 0.14 });
        } else if (towerType === 'ice' || towerType === 'magnet') {
            if (!this.canPlayGroup('ice', 0.07)) return;
            this.tone({ freq: towerType === 'magnet' ? 1050 : 1240, freqEnd: 1580, type: 'sine', duration: 0.10, gain: 0.09 });
        } else {
            if (!this.canPlayGroup('thunder', 0.065)) return;
            this.tone({ freq: towerType === 'plasma' ? 1480 : 1280, freqEnd: 420, type: 'sawtooth', duration: 0.075, gain: 0.085 });
        }
    },

    playKill() {
        const ctx = this.ensureContext();
        if (!ctx || !this.canPlayGroup('kill', 0.05)) return;
        this.tone({ freq: 620, freqEnd: 920, type: 'sine', duration: 0.07, gain: 0.09, delay: 0 });
        this.tone({ freq: 1175, freqEnd: 1480, type: 'triangle', duration: 0.09, gain: 0.10, delay: 0.045 });
    },

    playMagic(kind = 'entangle') {
        const chord = kind === 'frenzy'
            ? [523.25, 659.25, 783.99, 1046.5]
            : (kind === 'blessing' ? [440, 554.37, 659.25, 880] : [349.23, 440, 523.25, 698.46]);
        chord.forEach((f, idx) => {
            this.tone({ freq: f, freqEnd: f * 1.04, type: 'sine', duration: 0.24, gain: 0.11, delay: idx * 0.05 });
        });
    },

    playOutcome(kind) {
        if (kind === 'treeHit') {
            this.tone({ freq: 175, freqEnd: 95, type: 'sawtooth', duration: 0.22, gain: 0.16, delay: 0 });
        } else if (kind === 'victory') {
            [523.25, 659.25, 783.99, 1046.5].forEach((f, idx) => {
                this.tone({ freq: f, type: 'triangle', duration: idx === 3 ? 0.36 : 0.16, gain: 0.15, delay: idx * 0.11 });
            });
        } else if (kind === 'gameover') {
            [392.0, 349.23, 311.13, 220.0].forEach((f, idx) => {
                this.tone({ freq: f, freqEnd: f * 0.94, type: 'triangle', duration: 0.24, gain: 0.14, delay: idx * 0.14 });
            });
        }
    },

    toggleMute() {
        this.isMuted = !this.isMuted;
        saveMutedPref(this.isMuted);
        if (!this.isMuted) {
            this.ensureContext();
            this.playSpawn(1);
        }
        updateSoundButtonUI();
    }
};

let currentMapId = 'forest';
let currentGold = CONFIG.INITIAL_GOLD;
let baseHp = CONFIG.INITIAL_BASE_HP;
let dewEnergy = CONFIG.DEW_INITIAL;
let entangleCdMs = 0;
let frenzyCdMs = 0;
let frenzyActiveMs = 0;
let activeBlessings = new Set();
let blessingGrantedWaves = new Set();
let blessingChoices = [];
let seedPityCount = 0;
let treeHitShakeTimer = null;
let bestWave = 1;
let currentWave = 1;
let killsCount = 0;
let towerUidCounter = 1;
let totalTeamDamage = 0;
let totalGoldEarned = 0;
let fusionCount = 0;
let peakTowerSnapshot = null;
let lastBreakerName = '';
let isPaused = false;
let isGameOver = false;
let isEndlessMode = false;
let isNewRecordThisRun = false;
let gameSpeed = 1;

// 先套用地圖預設設定與紀錄
applyMapConfig('forest');
bestWave = getMapBestWave(currentMapId);

let spawnCounts = {
    fire: 0,
    ice: 0,
    thunder: 0
};

// 棋盤與怪物陣列徹底解耦
let board = Array(CONFIG.BOARD_SIZE).fill(null);
let monsters = [];
let monsterIdCounter = 1;
const monsterDomMap = new Map();
const cellElements = [];
const towerElements = Array(CONFIG.BOARD_SIZE).fill(null);
let lastRenderedSelected = null;
let lastRenderedBuildTarget = null;

// 互動狀態
let draggedIndex = null;
let selectedIndex = null;
let buildTargetIndex = null;
let hoveredIndex = null;
let isTouchMode = false;
let touchDragState = null;
let lastTouchDragEndTime = 0;

// 波次、局部局數隔離 (sessionId) 與主迴圈狀態
let sessionId = 1;
const activeTimers = new Set();
let pendingBolts = [];
let towerPhaseSeq = 0;
let waveState = 'WAITING_START'; // 'WAITING_START' | 'PREP' | 'SPAWNING' | 'CLEARING' | 'INTERMISSION' | 'VICTORY' | 'GAMEOVER'
let waveTimerMs = CONFIG.INITIAL_PREP_MS;
let waveSpawnQueue = [];
let waveSpawnIntervalMs = WAVE_BALANCE.SPAWN_INTERVAL_BASE_MS;
let waveSpawnAccMs = 0;
let lastFrameTime = null;
let rafId = null;

// Canvas 2D 特效物件池（含世界樹螢光綠葉環境粒子）
const fxEntities = {
    projectiles: [],
    bolts: [],
    beams: [],
    rings: [],
    particles: [],
    flashes: [],
    leaves: []
};
let leafEmitAccMs = 0;
let frenzyFxAccMs = 0;

// 響應式棋盤像素幾何快取
const boardMetrics = {
    originX: 8,
    originY: 8,
    cellW: 34,
    cellH: 34,
    stepX: 37,
    stepY: 37,
    step: 37,
    stageW: 560,
    stageH: 380
};

// DOM 元素快取
const boardStageEl = document.getElementById('board-stage');
const boardElement = document.getElementById('grid-board');
const monsterLayerEl = document.getElementById('monster-layer');
const fxCanvasEl = document.getElementById('fx-canvas');
const fxCtx = fxCanvasEl && typeof fxCanvasEl.getContext === 'function'
    ? fxCanvasEl.getContext('2d')
    : null;
const floatingLayerEl = document.getElementById('floating-layer');
const bossStatusBarEl = document.getElementById('boss-status-bar');
const bossBannerTitleEl = document.getElementById('boss-banner-title');
const bossBannerHpTextEl = document.getElementById('boss-banner-hp-text');
const bossBannerHpFillEl = document.getElementById('boss-banner-hp-fill');
const rangeCircleEl = document.getElementById('range-circle');
const spawnerContainer = document.getElementById('element-spawner-container');

// 固定式防禦塔檢查列 DOM
const inspectorEmptyEl = document.getElementById('inspector-empty');
const inspectorActiveEl = document.getElementById('inspector-active');
const inspectorNameEl = document.getElementById('inspector-name');
const inspectorDpsEl = document.getElementById('inspector-dps');
const inspectorRangeEl = document.getElementById('inspector-range');
const inspectorTerrainEl = document.getElementById('inspector-terrain');
const inspectorTargetBtn = document.getElementById('inspector-target-btn');
const inspectorSellBtn = document.getElementById('inspector-sell-btn');

const codexBtn = document.getElementById('codex-btn');
const codexOverlayEl = document.getElementById('codex-overlay');
const codexCloseBtn = document.getElementById('codex-close-btn');

const blessingOverlayEl = document.getElementById('blessing-overlay');
const blessingWaveSubtitleEl = document.getElementById('blessing-wave-subtitle');
const blessingChoicesEl = document.getElementById('blessing-choices');

const skillEntangleBtn = document.getElementById('skill-entangle-btn');
const skillFrenzyBtn = document.getElementById('skill-frenzy-btn');
const soundBtn = document.getElementById('sound-btn');

const addGoldBtn = document.getElementById('add-gold-btn');
const clearGoldBtn = document.getElementById('clear-gold-btn');
const nextWaveBtn = document.getElementById('next-wave-btn');
const speedBtn = document.getElementById('speed-btn');

const goldDisplay = document.getElementById('gold-display');
const baseHpDisplay = document.getElementById('base-hp-display');
const dewDisplay = document.getElementById('dew-display');
const dewBarFillEl = document.getElementById('dew-bar-fill');
const waveDisplay = document.getElementById('wave-display');
const wavePhaseTagEl = document.getElementById('wave-phase-tag');
const bestWaveDisplay = document.getElementById('best-wave-display');
const msgText = document.getElementById('msg-text');

const startOverlayEl = document.getElementById('start-overlay');
const mapSelectorGridEl = document.getElementById('map-selector-grid');
const mapRecordForestEl = document.getElementById('map-record-forest');
const mapRecordLavaEl = document.getElementById('map-record-lava');
const startGameBtn = document.getElementById('start-game-btn');

const victoryOverlayEl = document.getElementById('victory-overlay');
const victoryStarsEl = document.getElementById('victory-stars');
const victoryRankTextEl = document.getElementById('victory-rank-text');
const victoryMapTextEl = document.getElementById('victory-map-text');
const victoryKillsTextEl = document.getElementById('victory-kills-text');
const victoryHpTextEl = document.getElementById('victory-hp-text');
const victoryGoldTextEl = document.getElementById('victory-gold-text');
const victoryMvpTextEl = document.getElementById('victory-mvp-text');
const victoryGoldEarnedTextEl = document.getElementById('victory-gold-earned-text');
const victoryFusionTextEl = document.getElementById('victory-fusion-text');
const victoryRestartBtn = document.getElementById('victory-restart-btn');
const endlessBtn = document.getElementById('endless-btn');

const gameOverOverlayEl = document.getElementById('game-over-overlay');
const gameoverMapTextEl = document.getElementById('gameover-map-text');
const finalWaveTextEl = document.getElementById('final-wave-text');
const finalBestTextEl = document.getElementById('final-best-text');
const finalKillsTextEl = document.getElementById('final-kills-text');
const gameoverMvpTextEl = document.getElementById('gameover-mvp-text');
const gameoverGoldEarnedTextEl = document.getElementById('gameover-gold-earned-text');
const gameoverFusionTextEl = document.getElementById('gameover-fusion-text');
const gameoverBreakerRowEl = document.getElementById('gameover-breaker-row');
const gameoverBreakerTextEl = document.getElementById('gameover-breaker-text');
const newRecordBadgeEl = document.getElementById('new-record-badge');
const restartBtn = document.getElementById('restart-btn');

function isCodexOpen() {
    return Boolean(codexOverlayEl && !codexOverlayEl.classList.contains('hidden'));
}

function isGameplayActive() {
    return !isGameOver
        && !isPaused
        && waveState !== 'WAITING_START'
        && waveState !== 'VICTORY'
        && waveState !== 'BLESSING_SELECT'
        && !isCodexOpen();
}

function isMatchPhaseActive() {
    return !isGameOver
        && waveState !== 'WAITING_START'
        && waveState !== 'VICTORY'
        && waveState !== 'BLESSING_SELECT'
        && !isCodexOpen();
}

function isRelocationFree() {
    return waveState === 'PREP' || waveState === 'INTERMISSION';
}

function scheduleGameTimeout(callback, delayMs) {
    const capturedSessionId = sessionId;
    const timerId = setTimeout(() => {
        activeTimers.delete(timerId);
        if (capturedSessionId !== sessionId) return;
        callback();
    }, Math.max(0, delayMs));
    activeTimers.add(timerId);
    return timerId;
}

function clearCanvasFXState() {
    fxEntities.projectiles.length = 0;
    fxEntities.bolts.length = 0;
    fxEntities.beams.length = 0;
    fxEntities.rings.length = 0;
    fxEntities.particles.length = 0;
    fxEntities.flashes.length = 0;
    fxEntities.leaves.length = 0;
    leafEmitAccMs = 0;
    frenzyFxAccMs = 0;
    if (fxCtx && fxCanvasEl) {
        fxCtx.clearRect(0, 0, fxCanvasEl.width || boardMetrics.stageW, fxCanvasEl.height || boardMetrics.stageH);
    }
}

function clearAllGameTimers() {
    activeTimers.forEach(timerId => clearTimeout(timerId));
    activeTimers.clear();
    pendingBolts = [];
    clearCanvasFXState();
}

function activateTouchMode() {
    isTouchMode = true;
    if (hoveredIndex !== null) {
        hoveredIndex = null;
        updateRangeIndicator();
    }
}

if (typeof document !== 'undefined') {
    document.addEventListener('pointerdown', (e) => {
        SoundEngine.ensureContext();
        if (e.pointerType === 'touch') {
            activateTouchMode();
        } else if (e.pointerType === 'mouse' && (!e.sourceCapabilities || !e.sourceCapabilities.firesTouchEvents)) {
            isTouchMode = false;
        }
    }, true);

    document.addEventListener('pointermove', (e) => {
        if (e.pointerType === 'mouse' && (!e.sourceCapabilities || !e.sourceCapabilities.firesTouchEvents)) {
            isTouchMode = false;
        }
    }, true);

    document.addEventListener('touchstart', () => {
        SoundEngine.ensureContext();
        activateTouchMode();
    }, { passive: true, capture: true });
}

function hasBlessing(blessingId) {
    return activeBlessings.has(blessingId);
}

function getIceLineageSlowParams(towerType, baseRate, baseDurationMs) {
    if (!ICE_LINEAGE_TYPES.includes(towerType)) {
        return { rate: baseRate, durationMs: baseDurationMs };
    }
    if (!hasBlessing('winter_bloodline')) {
        return { rate: baseRate, durationMs: baseDurationMs };
    }
    const rate = Math.min(CONFIG.BLESSING_WINTER_SLOW_CAP, baseRate + CONFIG.BLESSING_WINTER_SLOW_BONUS);
    const durationMs = baseDurationMs > 0
        ? baseDurationMs + CONFIG.BLESSING_WINTER_DURATION_BONUS_MS
        : CONFIG.BLESSING_WINTER_STEAM_CHILL_MS;
    return { rate, durationMs };
}

function getThunderChainBonus(towerType) {
    if (!THUNDER_LINEAGE_TYPES.includes(towerType) || !hasBlessing('thunder_conduction')) return 0;
    return CONFIG.BLESSING_THUNDER_EXTRA_TARGETS;
}

function getTierStars(tier) {
    return '★'.repeat(Math.max(1, Math.min(CONFIG.MAX_TIER, tier || 1)));
}

function getTerrainAt(index) {
    return TERRAIN_MAP.get(index) || null;
}

function getTowerEffectiveRangeCells(index, towerObj) {
    const cfg = ELEMENT_CONFIG[towerObj.type];
    const baseRange = cfg ? cfg.range : 2.0;
    const terrain = getTerrainAt(index);
    const mult = (terrain === 'highground') ? TERRAIN_CONFIG.highground.rangeMult : 1.0;
    return baseRange * mult;
}

function getTowerAttackInterval(towerOrType, index = null) {
    const type = typeof towerOrType === 'string' ? towerOrType : towerOrType.type;
    const cfg = ELEMENT_CONFIG[type];
    const baseInterval = (cfg && cfg.attackIntervalMs) || CONFIG.ATTACK_INTERVAL;

    let speedMult = 1.0;
    if (index !== null && getTerrainAt(index) === 'mana_vein') {
        speedMult *= TERRAIN_CONFIG.mana_vein.attackSpeedMult;
    }
    if (hasBlessing('thunder_conduction') && THUNDER_LINEAGE_TYPES.includes(type)) {
        speedMult *= (1 + CONFIG.BLESSING_THUNDER_SPEED_BONUS);
    }
    if (frenzyActiveMs > 0) {
        speedMult *= (1 + CONFIG.SKILL_FRENZY_SPEED_BONUS);
    }
    return Math.round(baseInterval / speedMult);
}

function getTowerTerrainDamageMult(index) {
    if (getTerrainAt(index) !== 'world_tree') return 1.0;
    const hpRatio = Math.max(0, Math.min(1, baseHp / CONFIG.INITIAL_BASE_HP));
    return 1 + TERRAIN_CONFIG.world_tree.maxDamageBonus * hpRatio;
}

function createTowerObj(type, tier, investedGold, initialAccMs = null, options = {}) {
    let accMs = initialAccMs;
    if (accMs === null) {
        // 若場上已有同屬性塔，施加小幅錯峰負延遲錯開齊射；首座同屬性塔則維持 0 基準
        const hasSameType = board.some(t => t && t.type === type);
        if (hasSameType) {
            const staggerStep = ((towerPhaseSeq++) % 3) + 1;
            accMs = -(staggerStep * 130);
        } else {
            accMs = 0;
        }
    }
    return {
        uid: options.uid || towerUidCounter++,
        type,
        tier,
        accMs,
        investedGold,
        targetMode: options.targetMode || 'first',
        totalDamage: Number.isFinite(options.totalDamage) ? options.totalDamage : 0,
        aimAngleDeg: Number.isFinite(options.aimAngleDeg) ? options.aimAngleDeg : 0,
        focusTargetId: null,
        focusStacks: 0
    };
}

function getFusionResult(fromTower, toTower) {
    if (!fromTower || !toTower) return null;
    if (fromTower.tier !== toTower.tier || toTower.tier >= CONFIG.MAX_TIER) return null;

    const newTier = toTower.tier + 1;
    // 同屬性（含基礎塔與跨元素融合塔）升階
    if (fromTower.type === toTower.type) {
        return { type: toTower.type, tier: newTier, isCrossElement: false };
    }

    // 不同基礎元素且同星級（★+★ ➔ ★★，★★+★★ ➔ ★★★）跨元素融合
    if (BASE_ELEMENT_TYPES.includes(fromTower.type) && BASE_ELEMENT_TYPES.includes(toTower.type)) {
        const pairKey = [fromTower.type, toTower.type].sort().join('+');
        const hybridType = FUSION_RECIPES[pairKey];
        if (hybridType) {
            return { type: hybridType, tier: newTier, isCrossElement: true };
        }
    }

    return null;
}

function getTowerSellRefund(towerObj) {
    if (!towerObj) return 0;
    const fallbackInvested = CONFIG.BASE_COST * Math.pow(2, Math.max(0, (towerObj.tier || 1) - 1));
    const invested = Number.isFinite(towerObj.investedGold) ? towerObj.investedGold : fallbackInvested;
    return Math.floor(invested * CONFIG.SELL_REFUND_RATE);
}

function getTowerInspectorStats(index, towerObj) {
    const dmgRow = TIER_DAMAGE_TABLE[towerObj.type];
    const baseDmg = (dmgRow && dmgRow[towerObj.tier]) || 10;
    const terrainDmgMult = getTowerTerrainDamageMult(index);
    const thornGlobalMult = hasBlessing('thorn_bulwark') ? (1 + CONFIG.BLESSING_THORN_GLOBAL_DMG) : 1.0;
    const intervalMs = getTowerAttackInterval(towerObj, index);
    const intervalSec = intervalMs / 1000;
    const rangeCells = getTowerEffectiveRangeCells(index, towerObj);

    let perAttackFactor = 1.0;
    if (towerObj.type === 'thunder') {
        perAttackFactor = (towerObj.tier >= CONFIG.MAX_TIER
            ? CONFIG.THUNDER_LV3_BOLT_COUNT
            : CONFIG.THUNDER_BOLT_COUNT) + getThunderChainBonus('thunder');
    } else if (towerObj.type === 'plasma') {
        perAttackFactor = 1 + (towerObj.focusStacks || 0) * CONFIG.PLASMA_STACK_BONUS;
    }

    const effectiveHitDmg = baseDmg * terrainDmgMult * thornGlobalMult * perAttackFactor;
    const dps = Math.round(effectiveHitDmg / intervalSec);

    return {
        dps,
        rangeStr: Number(rangeCells.toFixed(2)).toString(),
        terrainType: getTerrainAt(index)
    };
}

function updateTowerInspector() {
    if (!inspectorEmptyEl || !inspectorActiveEl) return;

    const hasTower = selectedIndex !== null
        && board[selectedIndex] !== null
        && !isGameOver
        && waveState !== 'VICTORY'
        && waveState !== 'BLESSING_SELECT';
    if (!hasTower) {
        inspectorActiveEl.classList.add('hidden');
        inspectorEmptyEl.classList.remove('hidden');

        if (buildTargetIndex !== null && board[buildTargetIndex] === null && !PATH_CELL_INDICES.has(buildTargetIndex)) {
            const c = indexToCoords(buildTargetIndex);
            const terrain = getTerrainAt(buildTargetIndex);
            const tTag = terrain ? `｜${TERRAIN_CONFIG[terrain].shortTag}` : '';
            inspectorEmptyEl.innerText = `📍 已指定建造格 (${c.x + 1},${c.y + 1})${tTag} — 點擊下方元素按鈕直接召喚於此`;
        } else {
            inspectorEmptyEl.innerText = '💡 點選防禦塔可檢視 DPS／切換索敵／出售；先點空白草地再召喚可指定落點';
        }
        return;
    }

    const towerObj = board[selectedIndex];
    const cfg = ELEMENT_CONFIG[towerObj.type];
    const stats = getTowerInspectorStats(selectedIndex, towerObj);
    const refund = getTowerSellRefund(towerObj);
    const mode = towerObj.targetMode || 'first';

    inspectorEmptyEl.classList.add('hidden');
    inspectorActiveEl.classList.remove('hidden');

    if (inspectorNameEl) {
        inspectorNameEl.innerText = `${cfg.icon} ${cfg.name} ${getTierStars(towerObj.tier)}`;
    }
    if (inspectorDpsEl) {
        let dpsLabel = `DPS ${stats.dps}`;
        if (towerObj.type === 'plasma') {
            dpsLabel += (towerObj.focusStacks > 0 ? ` (${towerObj.focusStacks}層)` : ' (蓄能)');
        }
        inspectorDpsEl.innerText = dpsLabel;
    }
    if (inspectorRangeEl) {
        inspectorRangeEl.innerText = `射程 ${stats.rangeStr}`;
    }
    if (inspectorTerrainEl) {
        if (stats.terrainType) {
            inspectorTerrainEl.classList.remove('hidden');
            inspectorTerrainEl.innerText = TERRAIN_CONFIG[stats.terrainType].shortTag;
        } else {
            inspectorTerrainEl.classList.add('hidden');
            inspectorTerrainEl.innerText = '';
        }
    }
    if (inspectorTargetBtn) {
        inspectorTargetBtn.innerText = `🎯 索敵：${TARGET_MODE_LABELS[mode] || '最前'}`;
    }
    if (inspectorSellBtn) {
        inspectorSellBtn.innerText = `💰 出售 (+${refund})`;
    }
}

function updateBossStatusBar() {
    if (!bossStatusBarEl) return;
    const activeBoss = monsters.find(m => m.isBoss && m.hp > 0);
    if (!activeBoss || isGameOver || waveState === 'WAITING_START' || waveState === 'VICTORY') {
        bossStatusBarEl.classList.add('hidden');
        bossStatusBarEl.classList.remove('weak-fire', 'weak-ice', 'weak-thunder');
        if (bossBannerTitleEl) bossBannerTitleEl.innerText = '';
        if (bossBannerHpTextEl) bossBannerHpTextEl.innerText = '';
        return;
    }

    const weakCfg = ELEMENT_CONFIG[activeBoss.weakness];
    const weakShort = weakCfg ? `${weakCfg.icon}${weakCfg.name.charAt(0)}` : activeBoss.weakness;
    const effArmor = Math.round(getMonsterEffectiveArmor(activeBoss));
    const armorLabel = activeBoss.armorShredTimer > 0
        ? `🔥${effArmor}/${activeBoss.armor}`
        : `🛡️${activeBoss.armor}`;

    bossStatusBarEl.classList.remove('hidden', 'weak-fire', 'weak-ice', 'weak-thunder');
    if (weakCfg) {
        bossStatusBarEl.classList.add(`weak-${activeBoss.weakness}`);
    }
    if (bossBannerTitleEl) {
        bossBannerTitleEl.innerText = `👑 ${activeBoss.name}｜弱 ${weakShort}｜${armorLabel}`;
    }
    if (bossBannerHpTextEl) {
        bossBannerHpTextEl.innerText = `${activeBoss.hp} / ${activeBoss.maxHp}`;
    }
    if (bossBannerHpFillEl) {
        const pct = Math.max(0, Math.min(100, (activeBoss.hp / activeBoss.maxHp) * 100));
        bossBannerHpFillEl.style.width = `${pct}%`;
    }
}

function applyDebugModeVisibility() {
    const displayMode = CONFIG.DEBUG_MODE ? 'inline-block' : 'none';
    if (addGoldBtn) addGoldBtn.style.display = displayMode;
    if (clearGoldBtn) clearGoldBtn.style.display = displayMode;
}

function updateSpeedButtonUI() {
    if (!speedBtn) return;
    speedBtn.classList.remove('speed-2x', 'speed-3x');
    if (gameSpeed === 2) {
        speedBtn.classList.add('speed-2x');
        speedBtn.innerText = '⏩ 2x';
    } else if (gameSpeed === 3) {
        speedBtn.classList.add('speed-3x');
        speedBtn.innerText = '🔥 3x';
    } else {
        speedBtn.innerText = '⏩ 1x';
    }
}

function updateSoundButtonUI() {
    if (!soundBtn) return;
    soundBtn.classList.toggle('muted', SoundEngine.isMuted);
    soundBtn.innerText = SoundEngine.isMuted ? '🔇 靜音' : '🔊 音效開';
}

function updateWorldTreeVisualState() {
    const treeCell = cellElements[END_CELL_INDEX];
    const hpHudEl = baseHpDisplay ? baseHpDisplay.closest('.hud-hp') : null;

    let stateClass = 'tree-critical';
    let hudClass = 'hp-critical';
    if (baseHp >= CONFIG.WORLD_TREE_HEALTHY_MIN) {
        stateClass = 'tree-healthy';
        hudClass = '';
    } else if (baseHp >= CONFIG.WORLD_TREE_WARNING_MIN) {
        stateClass = 'tree-warning';
        hudClass = 'hp-warning';
    }

    if (treeCell) {
        treeCell.classList.remove('tree-healthy', 'tree-warning', 'tree-critical');
        treeCell.classList.add(stateClass);
    }
    if (hpHudEl) {
        hpHudEl.classList.remove('hp-warning', 'hp-critical');
        if (hudClass) hpHudEl.classList.add(hudClass);
    }
}

function triggerWorldTreeShake() {
    if (!boardStageEl) return;
    boardStageEl.classList.remove('tree-hit-shake');
    void boardStageEl.offsetWidth;
    boardStageEl.classList.add('tree-hit-shake');
    if (treeHitShakeTimer) clearTimeout(treeHitShakeTimer);
    treeHitShakeTimer = scheduleGameTimeout(() => {
        if (boardStageEl) boardStageEl.classList.remove('tree-hit-shake');
        treeHitShakeTimer = null;
    }, 300);
}

function updateSkillButtonsUI() {
    if (dewDisplay) dewDisplay.innerText = `${dewEnergy}/${CONFIG.DEW_MAX}`;
    if (dewBarFillEl) {
        const pct = Math.max(0, Math.min(100, (dewEnergy / CONFIG.DEW_MAX) * 100));
        dewBarFillEl.style.width = `${pct}%`;
    }

    const activePlay = isGameplayActive();

    if (skillEntangleBtn) {
        const cdSec = Math.ceil(entangleCdMs / 1000);
        const cdPct = entangleCdMs > 0 ? Math.min(100, (entangleCdMs / CONFIG.SKILL_ENTANGLE_CD_MS) * 100) : 0;
        const maskEl = skillEntangleBtn.querySelector('.skill-cd-mask');
        const labelEl = skillEntangleBtn.querySelector('.skill-label');
        if (maskEl) maskEl.style.width = `${cdPct}%`;
        if (labelEl) {
            labelEl.innerText = entangleCdMs > 0 ? `🌿 纏繞 ${cdSec}s` : `🌿 根鬚纏繞 ${CONFIG.SKILL_ENTANGLE_COST}💧`;
        }
        skillEntangleBtn.disabled = !activePlay || entangleCdMs > 0 || dewEnergy < CONFIG.SKILL_ENTANGLE_COST;
    }

    if (skillFrenzyBtn) {
        const cdSec = Math.ceil(frenzyCdMs / 1000);
        const activeSec = Math.ceil(frenzyActiveMs / 1000);
        const cdPct = frenzyCdMs > 0 ? Math.min(100, (frenzyCdMs / CONFIG.SKILL_FRENZY_CD_MS) * 100) : 0;
        const maskEl = skillFrenzyBtn.querySelector('.skill-cd-mask');
        const labelEl = skillFrenzyBtn.querySelector('.skill-label');
        if (maskEl) maskEl.style.width = `${cdPct}%`;
        if (labelEl) {
            if (frenzyActiveMs > 0) {
                labelEl.innerText = `✨ 狂熱中 ${activeSec}s`;
            } else if (frenzyCdMs > 0) {
                labelEl.innerText = `✨ 狂熱 ${cdSec}s`;
            } else {
                labelEl.innerText = `✨ 自然狂熱 ${CONFIG.SKILL_FRENZY_COST}💧`;
            }
        }
        skillFrenzyBtn.classList.toggle('skill-active', frenzyActiveMs > 0);
        skillFrenzyBtn.disabled = !activePlay || frenzyActiveMs > 0 || frenzyCdMs > 0 || dewEnergy < CONFIG.SKILL_FRENZY_COST;
    }
}

function getAvailableBlessings() {
    return BLESSINGS_CATALOG.filter(b => !activeBlessings.has(b.id));
}

function pickBlessingChoices(count = 3) {
    const pool = getAvailableBlessings().slice();
    for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const tmp = pool[i];
        pool[i] = pool[j];
        pool[j] = tmp;
    }
    return pool.slice(0, Math.min(count, pool.length));
}

function renderBlessingModal() {
    if (!blessingChoicesEl) return;
    blessingChoicesEl.innerHTML = '';

    blessingChoices.forEach(blessing => {
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'blessing-choice-btn';
        card.dataset.blessingId = blessing.id;
        card.innerHTML = `
        <span class="blessing-choice-icon">${blessing.icon}</span>
        <span class="blessing-choice-title">${blessing.name}</span>
        <span class="blessing-choice-desc">${blessing.desc}</span>
    `;
        card.addEventListener('click', () => selectBlessing(blessing.id));
        blessingChoicesEl.appendChild(card);
    });
}

function triggerBlessingSelection(clearedWave) {
    const choices = pickBlessingChoices(3);
    if (choices.length === 0) return false;

    blessingGrantedWaves.add(clearedWave);
    blessingChoices = choices;
    isPaused = false;
    waveState = 'BLESSING_SELECT';

    if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
    }

    clearTouchDragVisuals();
    draggedIndex = null;
    hoveredIndex = null;
    updateRangeIndicator();

    if (blessingWaveSubtitleEl) {
        blessingWaveSubtitleEl.innerText = `第 ${clearedWave} 波捷報！世界樹賜予枝枒祝福，請擇一強化防線`;
    }
    renderBlessingModal();
    if (blessingOverlayEl) blessingOverlayEl.classList.remove('hidden');

    SoundEngine.playMagic('blessing');
    updateHUD();
    return true;
}

function selectBlessing(blessingId) {
    if (waveState !== 'BLESSING_SELECT') return;
    const picked = BLESSINGS_CATALOG.find(b => b.id === blessingId);
    if (!picked || activeBlessings.has(blessingId)) return;

    activeBlessings.add(blessingId);
    blessingChoices = [];

    if (blessingOverlayEl) blessingOverlayEl.classList.add('hidden');

    if (blessingId === 'abundant_seed') {
        seedPityCount = 0;
    } else if (blessingId === 'life_nectar') {
        baseHp = Math.min(CONFIG.INITIAL_BASE_HP, baseHp + CONFIG.BLESSING_LIFE_HEAL);
    }

    waveState = 'INTERMISSION';
    waveTimerMs = CONFIG.WAVE_INTERMISSION_MS;
    msgText.innerText = `🌳 已獲得祝福【${picked.icon} ${picked.name}】！下一波將於 ${Math.ceil(CONFIG.WAVE_INTERMISSION_MS / 1000)} 秒後到來！`;

    SoundEngine.playMagic('blessing');
    updateHUD();
    startMainLoop();
}

function castEntangleSkill() {
    if (!isGameplayActive()) return false;
    if (entangleCdMs > 0) return false;

    if (monsters.length === 0) {
        msgText.innerText = '⚠️ 場上目前沒有敵人，無需施放根鬚纏繞！';
        return false;
    }

    if (dewEnergy < CONFIG.SKILL_ENTANGLE_COST) {
        msgText.innerText = `❌ 靈露不足，需要 ${CONFIG.SKILL_ENTANGLE_COST} 💧 才能施放根鬚纏繞！`;
        return false;
    }

    dewEnergy -= CONFIG.SKILL_ENTANGLE_COST;
    entangleCdMs = CONFIG.SKILL_ENTANGLE_CD_MS;

    for (let i = 0; i < monsters.length; i++) {
        const m = monsters[i];
        if (m.hp <= 0) continue;
        m.rootTimer = Math.max(m.rootTimer || 0, CONFIG.SKILL_ENTANGLE_DUR_MS);
        m.rootVulnRate = Math.max(m.rootVulnRate || 0, CONFIG.SKILL_ENTANGLE_VULN_BONUS);
        emitParticleBurst(m.pixelX, m.pixelY, '#4ade80', 10, 95);
        fxEntities.rings.push({
            x: m.pixelX,
            y: m.pixelY,
            maxRadius: Math.max(18, boardMetrics.cellW * 0.72),
            color: '#22c55e',
            fillAlpha: 0.30,
            ageMs: 0,
            durationMs: 420
        });
    }

    const treePos = getCellCenter(WAYPOINTS[WAYPOINTS.length - 1].x, WAYPOINTS[WAYPOINTS.length - 1].y);
    fxEntities.rings.push({
        x: treePos.left,
        y: treePos.top,
        maxRadius: boardMetrics.step * 3.2,
        color: '#4ade80',
        fillAlpha: 0.18,
        ageMs: 0,
        durationMs: 480
    });

    SoundEngine.playMagic('entangle');
    msgText.innerText = '🌿 施放【根鬚纏繞】！全場敵人定身 2.5 秒且易傷 +20%！';
    renderMonsterLayer();
    updateHUD();
    return true;
}

function castFrenzySkill() {
    if (!isGameplayActive()) return false;
    if (frenzyActiveMs > 0) {
        msgText.innerText = '⚠️ 自然狂熱效果持續中，無法重複施放！';
        return false;
    }
    if (frenzyCdMs > 0) return false;
    if (dewEnergy < CONFIG.SKILL_FRENZY_COST) {
        msgText.innerText = `❌ 靈露不足，需要 ${CONFIG.SKILL_FRENZY_COST} 💧 才能施放自然狂熱！`;
        return false;
    }

    dewEnergy -= CONFIG.SKILL_FRENZY_COST;
    frenzyActiveMs = CONFIG.SKILL_FRENZY_DUR_MS;
    frenzyCdMs = CONFIG.SKILL_FRENZY_CD_MS;

    for (let idx = 0; idx < board.length; idx++) {
        if (!board[idx]) continue;
        const c = indexToCoords(idx);
        const pos = getCellCenter(c.x, c.y);
        emitParticleBurst(pos.left, pos.top, '#fde047', 8, 70);
        fxEntities.rings.push({
            x: pos.left,
            y: pos.top,
            maxRadius: Math.max(16, boardMetrics.cellW * 0.65),
            color: '#fbbf24',
            fillAlpha: 0.24,
            ageMs: 0,
            durationMs: 360
        });
        if (towerElements[idx]) towerElements[idx].classList.add('frenzy-active');
    }

    SoundEngine.playMagic('frenzy');
    msgText.innerText = '✨ 施放【自然狂熱】！全場防禦塔攻速大幅提升 +35%（5.0 秒）！';
    updateHUD();
    return true;
}

function cycleGameSpeed() {
    gameSpeed = (gameSpeed % 3) + 1;
    updateSpeedButtonUI();
}

// ==================== 3. 座標量測與數值公式 ====================
function resizeFxCanvas() {
    if (!fxCanvasEl || typeof fxCanvasEl.getContext !== 'function') return;
    const cssW = (boardStageEl && boardStageEl.clientWidth) || boardMetrics.stageW || 560;
    const cssH = (boardStageEl && boardStageEl.clientHeight) || boardMetrics.stageH || 380;
    boardMetrics.stageW = cssW;
    boardMetrics.stageH = cssH;

    const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) ? Math.min(2, window.devicePixelRatio) : 1;
    const targetW = Math.round(cssW * dpr);
    const targetH = Math.round(cssH * dpr);
    if (fxCanvasEl.width !== targetW || fxCanvasEl.height !== targetH) {
        fxCanvasEl.width = targetW;
        fxCanvasEl.height = targetH;
    }
    if (fxCtx && typeof fxCtx.setTransform === 'function') {
        fxCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
}

function measureBoardMetrics() {
    const cells = boardElement.children;
    if (!cells || cells.length < CONFIG.BOARD_COLS + 1) return;

    const firstCell = cells[0];
    const rightCell = cells[1];
    const belowCell = cells[CONFIG.BOARD_COLS];

    boardMetrics.originX = firstCell.offsetLeft;
    boardMetrics.originY = firstCell.offsetTop;
    boardMetrics.cellW = firstCell.offsetWidth || 34;
    boardMetrics.cellH = firstCell.offsetHeight || 34;
    boardMetrics.stepX = (rightCell.offsetLeft - firstCell.offsetLeft) || (boardMetrics.cellW + 3);
    boardMetrics.stepY = (belowCell.offsetTop - firstCell.offsetTop) || (boardMetrics.cellH + 3);
    boardMetrics.step = (boardMetrics.stepX + boardMetrics.stepY) / 2;

    resizeFxCanvas();
}

function getCellCenter(gridX, gridY) {
    return {
        left: boardMetrics.originX + gridX * boardMetrics.stepX + boardMetrics.cellW / 2,
        top: boardMetrics.originY + gridY * boardMetrics.stepY + boardMetrics.cellH / 2
    };
}

function getTowerRangePx(towerObj, index = null) {
    const rangeCells = index !== null
        ? getTowerEffectiveRangeCells(index, towerObj)
        : ((ELEMENT_CONFIG[towerObj.type] && ELEMENT_CONFIG[towerObj.type].range) || 2.0);
    return rangeCells * boardMetrics.step;
}

function getCost(type) {
    const count = spawnCounts[type] || 0;
    return Math.min(CONFIG.COST_MAX, CONFIG.BASE_COST + (count * CONFIG.COST_STEP));
}

function getEarlyWaveBonus(remainingMs = waveTimerMs) {
    const remainingSec = Math.max(0, remainingMs / 1000);
    return Math.min(15, 2 + Math.floor(1.5 * remainingSec));
}

function updateWavePhaseUI() {
    if (!wavePhaseTagEl) return;

    const isBossWave = isBossWaveNumber(currentWave);
    wavePhaseTagEl.classList.toggle('boss-wave', !isPaused && isBossWave && (waveState === 'SPAWNING' || waveState === 'CLEARING'));
    wavePhaseTagEl.classList.toggle('paused', isPaused);

    if (isPaused) {
        wavePhaseTagEl.innerText = '⏸️ 已暫停';
    } else if (waveState === 'WAITING_START') {
        wavePhaseTagEl.innerText = '等待開始';
    } else if (waveState === 'BLESSING_SELECT') {
        wavePhaseTagEl.innerText = '賜福選擇';
    } else if (waveState === 'PREP') {
        const sec = Math.max(1, Math.ceil(waveTimerMs / 1000));
        wavePhaseTagEl.innerText = `備戰 ${sec}s`;
    } else if (waveState === 'INTERMISSION') {
        const sec = Math.max(1, Math.ceil(waveTimerMs / 1000));
        wavePhaseTagEl.innerText = `下波 ${sec}s`;
    } else if (waveState === 'SPAWNING') {
        wavePhaseTagEl.innerText = isBossWave ? '魔王決戰' : '出怪中';
    } else if (waveState === 'CLEARING') {
        wavePhaseTagEl.innerText = isBossWave ? '魔王決戰' : '清場中';
    } else if (waveState === 'VICTORY') {
        wavePhaseTagEl.innerText = '通關勝利';
    } else {
        wavePhaseTagEl.innerText = '已結束';
    }

    if (nextWaveBtn) {
        const canSkip = isGameplayActive() && (waveState === 'PREP' || waveState === 'INTERMISSION');
        nextWaveBtn.disabled = !canSkip;
        if (canSkip) {
            const bonus = getEarlyWaveBonus();
            nextWaveBtn.innerText = waveState === 'PREP' ? `⚡ 立即開波 (+${bonus}💰)` : `⚡ 提前下波 (+${bonus}💰)`;
        } else {
            nextWaveBtn.innerText = '⚡ 立即開波';
        }
    }
}

function updateSeedPityUI() {
    const badge = document.getElementById('seed-pity-badge');
    if (!badge) return;
    if (!hasBlessing('abundant_seed')) {
        badge.classList.add('hidden');
        badge.classList.remove('pity-ready');
        return;
    }
    badge.classList.remove('hidden');
    badge.classList.toggle('pity-ready', seedPityCount === CONFIG.BLESSING_SEED_INTERVAL - 1);
    badge.innerText = `🌱 保底進度：${seedPityCount}/${CONFIG.BLESSING_SEED_INTERVAL}`;
}

function updateHUD() {
    if (goldDisplay) goldDisplay.innerText = currentGold;
    if (baseHpDisplay) baseHpDisplay.innerText = `${baseHp}/${CONFIG.INITIAL_BASE_HP}`;
    if (waveDisplay) {
        waveDisplay.innerText = isEndlessMode
            ? `Wave ${currentWave} (無盡)`
            : `Wave ${currentWave} / ${CONFIG.VICTORY_WAVE}`;
    }
    if (bestWaveDisplay) bestWaveDisplay.innerText = `Wave ${bestWave}`;

    updateWavePhaseUI();
    updateWorldTreeVisualState();
    updateSkillButtonsUI();
    updateSeedPityUI();
    updateTowerInspector();
    updateBossStatusBar();
    updateSoundButtonUI();

    Object.keys(ELEMENT_CONFIG).forEach(type => {
        const btn = document.getElementById(`spawn-btn-${type}`);
        if (!btn) return;

        const cost = getCost(type);
        const costEl = btn.querySelector('.btn-cost-val');
        if (costEl) costEl.innerText = `${cost} 💰`;

        if (!isGameplayActive() || currentGold < cost) {
            btn.classList.add('btn-disabled');
        } else {
            btn.classList.remove('btn-disabled');
        }
    });
}

// ==================== 4. 射程預覽指示器 ====================
function updateRangeIndicator() {
    if (!rangeCircleEl) return;

    if (isGameOver
        || waveState === 'WAITING_START'
        || waveState === 'VICTORY'
        || waveState === 'BLESSING_SELECT'
        || draggedIndex !== null
        || (touchDragState && touchDragState.isDragging)) {
        rangeCircleEl.className = '';
        return;
    }

    // 觸控模式下停用 hoveredIndex 懸停預覽，僅在明確選取塔時顯示射程圈
    let targetIdx = null;
    if (!isTouchMode && hoveredIndex !== null && board[hoveredIndex] !== null) {
        targetIdx = hoveredIndex;
    } else if (selectedIndex !== null && board[selectedIndex] !== null) {
        targetIdx = selectedIndex;
    }

    if (targetIdx === null) {
        rangeCircleEl.className = '';
        return;
    }

    const towerObj = board[targetIdx];
    const coords = indexToCoords(targetIdx);
    const center = getCellCenter(coords.x, coords.y);
    const radiusPx = getTowerRangePx(towerObj, targetIdx);

    rangeCircleEl.style.left = `${center.left}px`;
    rangeCircleEl.style.top = `${center.top}px`;
    rangeCircleEl.style.width = `${radiusPx * 2}px`;
    rangeCircleEl.style.height = `${radiusPx * 2}px`;
    rangeCircleEl.className = `visible range-${towerObj.type}`;
}

// ==================== 5. 智能優先選位召喚系統 ====================
function renderSpawnerButtons() {
    spawnerContainer.innerHTML = '';

    BASE_ELEMENT_TYPES.forEach(type => {
        const data = ELEMENT_CONFIG[type];
        const btn = document.createElement('button');
        btn.id = `spawn-btn-${type}`;
        btn.classList.add('spawn-card-btn', `btn-type-${type}`);

        btn.innerHTML = `
    <span>${data.icon} 召喚${data.name}</span>
    <span class="btn-sub-info">${data.roleTag}</span>
    <span class="btn-cost-val">${getCost(type)} 💰</span>
`;

        btn.addEventListener('click', () => handleSpawn(type, btn));
        spawnerContainer.appendChild(btn);
    });

    const pityBadge = document.createElement('div');
    pityBadge.id = 'seed-pity-badge';
    pityBadge.className = 'seed-pity-badge hidden';
    pityBadge.innerText = `🌱 保底進度：0/${CONFIG.BLESSING_SEED_INTERVAL}`;
    spawnerContainer.appendChild(pityBadge);
    updateSeedPityUI();
}

function pickSmartSpawnIndex() {
    // 1. 優先放置於玩家先點選的空白草地
    if (buildTargetIndex !== null
        && buildTargetIndex >= 0
        && buildTargetIndex < CONFIG.BOARD_SIZE
        && board[buildTargetIndex] === null
        && !PATH_CELL_INDICES.has(buildTargetIndex)) {
        return { index: buildTargetIndex, mode: 'targeted' };
    }

    // 2. 未指定時，優先從距離跑道 2 格內的空草地挑選
    const nearPathEmpty = [];
    const fallbackEmpty = [];
    for (let idx = 0; idx < CONFIG.BOARD_SIZE; idx++) {
        if (board[idx] !== null || PATH_CELL_INDICES.has(idx)) continue;
        if (CELL_PATH_DIST[idx] <= CONFIG.SUMMON_NEAR_PATH_RADIUS) {
            nearPathEmpty.push(idx);
        } else {
            fallbackEmpty.push(idx);
        }
    }

    const pool = nearPathEmpty.length > 0 ? nearPathEmpty : fallbackEmpty;
    if (pool.length === 0) return null;

    const chosen = pool[Math.floor(Math.random() * pool.length)];
    return { index: chosen, mode: nearPathEmpty.length > 0 ? 'near-path' : 'fallback' };
}

function handleSpawn(type, btnElement) {
    if (!isGameplayActive()) return;
    if (!BASE_ELEMENT_TYPES.includes(type)) return;

    const cost = getCost(type);

    if (currentGold < cost) {
        msgText.innerText = `❌ 金幣不足，無法召喚【${ELEMENT_CONFIG[type].name}】！需要 ${cost} 💰`;
        if (btnElement) {
            btnElement.classList.remove('shake-anim');
            void btnElement.offsetWidth;
            btnElement.classList.add('shake-anim');
        }
        return;
    }

    const pick = pickSmartSpawnIndex();
    if (!pick) {
        msgText.innerText = '⚠️ 可建造格子已經全滿，請先融合或出售騰出空間！';
        return;
    }

    currentGold -= cost;
    spawnCounts[type] = (spawnCounts[type] || 0) + 1;

    let spawnedTier = 1;
    let seedTriggered = false;
    if (hasBlessing('abundant_seed')) {
        seedPityCount++;
        if (seedPityCount >= CONFIG.BLESSING_SEED_INTERVAL) {
            seedPityCount = 0;
            spawnedTier = 2;
            seedTriggered = true;
        }
    }

    const targetIdx = pick.index;
    board[targetIdx] = createTowerObj(type, spawnedTier, cost);
    buildTargetIndex = null;

    const cfg = ELEMENT_CONFIG[type];
    const terrain = getTerrainAt(targetIdx);
    const terrainNote = terrain ? `（位於 ${TERRAIN_CONFIG[terrain].shortTag}）` : '';
    const coords = indexToCoords(targetIdx);
    const posNote = pick.mode === 'targeted' ? `於指定格 (${coords.x + 1},${coords.y + 1})` : '';
    const pityNote = seedTriggered ? '【🌱 豐饒種子保底 ★★！】' : '';

    SoundEngine.playSpawn(spawnedTier);
    msgText.innerText = `成功${posNote}召喚【${cfg.name} ${getTierStars(spawnedTier)}】${pityNote}${terrainNote}！花費 ${cost} 💰。`;

    renderBoard([targetIdx]);
    updateHUD();
}

// ==================== 6. 波次產生與機制怪物生成 ====================
function isBossWaveNumber(waveNum) {
    if (waveNum === 5) return true;
    if (!isEndlessMode && waveNum === CONFIG.VICTORY_WAVE) return true;
    return isEndlessMode && waveNum >= CONFIG.VICTORY_WAVE && waveNum % 5 === 0;
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
    if (waveNum === 1) return ['wood', 'lava', 'air'];
    if (waveNum === 2) return ['wood', 'lava', 'air', 'hound'];
    if (waveNum === 3) return ['wood', 'lava', 'air', 'hound', 'slime'];
    return ['wood', 'lava', 'air', 'hound', 'slime', 'golem'];
}

function buildWaveQueue(waveNum) {
    const pool = getWaveNormalPool(waveNum);
    const hasBoss = isBossWaveNumber(waveNum);

    let totalCount;
    if (!isEndlessMode && waveNum === CONFIG.VICTORY_WAVE) {
        totalCount = WAVE_BALANCE.FINAL_WAVE_ESCORT_COUNT;
    } else if (waveNum === 5) {
        totalCount = WAVE_BALANCE.WAVE5_ESCORT_COUNT;
    } else {
        totalCount = Math.min(
            WAVE_BALANCE.MAX_COUNT_PER_WAVE,
            WAVE_BALANCE.BASE_COUNT + waveNum * WAVE_BALANCE.COUNT_PER_WAVE
        );
    }

    // Wave 4 起怪物血量上調 1.4x ~ 1.5x（無盡模式延續高壓比例）
    const midLateFactor = waveNum >= 4
        ? (1.40 + Math.min(0.10, (waveNum - 4) * (0.10 / 6)))
        : 1.0;

    const baseHpScale = 1
        + (waveNum - 1) * WAVE_BALANCE.HP_GROWTH_LINEAR
        + Math.pow(waveNum - 1, 2) * WAVE_BALANCE.HP_GROWTH_QUAD;
    const wave5Mult = waveNum >= 5 ? CONFIG.WAVE5_PLUS_HP_MULT : 1.0;
    const hpScale = baseHpScale * midLateFactor * wave5Mult;

    const rewardBonus = Math.floor((waveNum - 1) / WAVE_BALANCE.REWARD_WAVE_STEP);

    const hasElites = waveNum >= WAVE_BALANCE.ELITE_START_WAVE;
    const eliteCount = hasElites
        ? Math.min(Math.floor(totalCount * 0.35), 1 + Math.floor((waveNum - WAVE_BALANCE.ELITE_START_WAVE) / 1.5))
        : 0;
    const eliteArmor = hasElites
        ? WAVE_BALANCE.ELITE_BASE_ARMOR + Math.floor((waveNum - WAVE_BALANCE.ELITE_START_WAVE) / WAVE_BALANCE.ELITE_ARMOR_GROWTH_STEP) * 2
        : 0;

    const eliteSlots = new Set();
    for (let e = 0; e < eliteCount; e++) {
        const slot = Math.min(
            totalCount - 1,
            Math.floor(((e + 1) * totalCount) / (eliteCount + 0.5))
        );
        eliteSlots.add(slot);
    }
    let idxCursor = totalCount - 1;
    while (eliteSlots.size < eliteCount && idxCursor >= 0) {
        eliteSlots.add(idxCursor);
        idxCursor--;
    }

    const queue = [];
    for (let i = 0; i < totalCount; i++) {
        const typeKey = pool[(i + waveNum - 1) % pool.length];
        const mCfg = MONSTER_DATABASE[typeKey];
        const isElite = eliteSlots.has(i);

        let armor = isElite ? eliteArmor : 0;
        if (typeKey === 'golem') {
            // 重裝魔像天生持有 15~20 護甲
            armor = Math.min(20, 15 + Math.max(0, waveNum - 4));
        }

        queue.push({
            typeKey,
            hpScale,
            rewardBonus,
            isElite,
            isBoss: false,
            armor
        });
    }

    let bossMeta = null;
    if (hasBoss) {
        const bossSpec = getBossSpecForWave(waveNum);
        queue.push({
            typeKey: bossSpec.typeKey,
            bossName: bossSpec.name,
            bossIcon: bossSpec.icon,
            hpScale: 1,
            rewardBonus,
            isElite: true,
            isBoss: true,
            armor: bossSpec.armor,
            bossHp: bossSpec.hp,
            bossBaseDamage: bossSpec.baseDamage,
            bossReward: bossSpec.reward
        });

        bossMeta = {
            name: bossSpec.name,
            weakness: bossSpec.weakness,
            armor: bossSpec.armor,
            hp: bossSpec.hp
        };
    }

    return {
        queue,
        eliteCount,
        eliteArmor,
        bossMeta,
        spawnIntervalMs: Math.max(
            WAVE_BALANCE.SPAWN_INTERVAL_MIN_MS,
            WAVE_BALANCE.SPAWN_INTERVAL_BASE_MS - (waveNum - 1) * WAVE_BALANCE.SPAWN_INTERVAL_DECAY_MS
        )
    };
}

function startWave(waveNum, earlyBonus = 0) {
    if (!isGameplayActive()) return;

    currentWave = waveNum;
    if (currentWave > bestWave) {
        bestWave = currentWave;
        saveMapRecord(currentMapId, bestWave);
        isNewRecordThisRun = true;
    }

    const plan = buildWaveQueue(waveNum);
    waveSpawnQueue = plan.queue;
    waveSpawnIntervalMs = plan.spawnIntervalMs;
    waveSpawnAccMs = waveSpawnIntervalMs; // 開波立即派出第一隻怪
    waveState = 'SPAWNING';

    const bonusMsg = earlyBonus > 0 ? `（⚡ 早鳥開波 +${earlyBonus} 💰）` : '';

    if (plan.bossMeta) {
        const weakIcon = ELEMENT_CONFIG[plan.bossMeta.weakness].icon + ELEMENT_CONFIG[plan.bossMeta.weakness].name.charAt(0);
        if (!isEndlessMode && waveNum === CONFIG.VICTORY_WAVE) {
            msgText.innerText = `⚠️ 最終決戰 Wave ${waveNum}/${CONFIG.VICTORY_WAVE}！${plan.bossMeta.name}（弱${weakIcon} · 🛡️${plan.bossMeta.armor} · ${plan.bossMeta.hp}HP）率軍來襲${bonusMsg}！`;
        } else {
            msgText.innerText = `⚠️ 魔王波 Wave ${waveNum}！${plan.bossMeta.name}（弱${weakIcon} · 🛡️${plan.bossMeta.armor}）強勢來襲${bonusMsg}！`;
        }
    } else if (plan.eliteCount > 0) {
        msgText.innerText = `🌊 第 ${waveNum} 波來襲！含高護甲菁英/機制怪，請善用火塔破甲或跨元素融合${bonusMsg}！`;
    } else {
        msgText.innerText = `🌊 第 ${waveNum} 波來襲！共 ${plan.queue.length} 隻怪物進攻中${bonusMsg}！`;
    }

    updateHUD();
}

function spawnMonsterFromEntry(entry) {
    const cfg = MONSTER_DATABASE[entry.typeKey];
    const startPos = getCellCenter(WAYPOINTS[0].x, WAYPOINTS[0].y);

    if (entry.isBoss) {
        const bossHp = entry.bossHp || 4200;
        const monster = {
            id: monsterIdCounter++,
            typeKey: entry.typeKey,
            name: entry.bossName || '腐朽古樹王',
            icon: entry.bossIcon || '👹',
            weakness: cfg.weakness,
            hp: bossHp,
            maxHp: bossHp,
            armor: entry.armor,
            isElite: true,
            isBoss: true,
            isSplitChild: false,
            splitsOnDeath: false,
            baseDamage: entry.bossBaseDamage || WAVE_BALANCE.BOSS_BASE_DAMAGE,
            reward: (entry.bossReward || WAVE_BALANCE.BOSS_REWARD) + entry.rewardBonus,
            wpIndex: 0,
            gridX: WAYPOINTS[0].x,
            gridY: WAYPOINTS[0].y,
            pixelX: startPos.left,
            pixelY: startPos.top,
            visualOffsetX: 0,
            visualOffsetY: 0,
            baseSpeed: CONFIG.MONSTER_BASE_SPEED * WAVE_BALANCE.BOSS_SPEED_MULT,
            slowTimer: 0,
            slowRate: 0,
            armorShredTimer: 0,
            armorShredRate: 0,
            rootTimer: 0,
            rootVulnRate: 0
        };

        monsters.push(monster);
        renderMonsterLayer();
        return;
    }

    const hpMult = entry.isElite ? WAVE_BALANCE.ELITE_HP_MULT : 1.0;
    const rewardMult = entry.isElite ? WAVE_BALANCE.ELITE_REWARD_MULT : 1.0;
    const speedMult = cfg.speedMult * (entry.isElite ? WAVE_BALANCE.ELITE_SPEED_MULT : 1.0);

    const maxHp = Math.max(10, Math.round(cfg.baseHp * entry.hpScale * hpMult));
    const reward = Math.max(1, Math.round((cfg.baseReward + entry.rewardBonus) * rewardMult));

    const monster = {
        id: monsterIdCounter++,
        typeKey: entry.typeKey,
        name: entry.isElite ? `菁英${cfg.name}` : cfg.name,
        icon: cfg.icon,
        weakness: cfg.weakness,
        hp: maxHp,
        maxHp: maxHp,
        armor: entry.armor || 0,
        isElite: Boolean(entry.isElite),
        isBoss: false,
        isSplitChild: false,
        splitsOnDeath: Boolean(cfg.splitsOnDeath),
        baseDamage: 1,
        reward: reward,
        wpIndex: 0,
        gridX: WAYPOINTS[0].x,
        gridY: WAYPOINTS[0].y,
        pixelX: startPos.left,
        pixelY: startPos.top,
        visualOffsetX: 0,
        visualOffsetY: 0,
        baseSpeed: CONFIG.MONSTER_BASE_SPEED * speedMult,
        slowTimer: 0,
        slowRate: 0,
        armorShredTimer: 0,
        armorShredRate: 0,
        rootTimer: 0,
        rootVulnRate: 0
    };

    monsters.push(monster);
    renderMonsterLayer();
}

function spawnSplitMiniSlimes(parent) {
    const childMaxHp = Math.max(1, Math.round(parent.maxHp * CONFIG.SLIME_SPLIT_HP_RATIO));
    const wpA = WAYPOINTS[Math.min(parent.wpIndex, WAYPOINTS.length - 1)];
    const wpB = WAYPOINTS[Math.min(parent.wpIndex + 1, WAYPOINTS.length - 1)];

    const segDx = wpB.x - wpA.x;
    const segDy = wpB.y - wpA.y;
    const segLen = Math.hypot(segDx, segDy) || 1;
    const ux = segDx / segLen;
    const uy = segDy / segLen;
    const proj = (parent.gridX - wpA.x) * ux + (parent.gridY - wpA.y) * uy;

    // 沿路徑前後與垂直微調錯開兩隻迷你史萊姆的位置
    const offsets = [
        { along: -0.22, vx: -5, vy: -4 },
        { along: +0.22, vx: +5, vy: +4 }
    ];

    for (let i = 0; i < CONFIG.SLIME_SPLIT_COUNT; i++) {
        const off = offsets[i];
        const clampedProj = Math.max(0, Math.min(segLen, proj + off.along));
        const gx = wpA.x + ux * clampedProj;
        const gy = wpA.y + uy * clampedProj;
        const center = getCellCenter(gx, gy);

        monsters.push({
            id: monsterIdCounter++,
            typeKey: parent.typeKey,
            name: '迷你史萊姆',
            icon: '🟢',
            weakness: parent.weakness,
            hp: childMaxHp,
            maxHp: childMaxHp,
            armor: 0,
            isElite: false,
            isBoss: false,
            isSplitChild: true,
            splitsOnDeath: false,
            baseDamage: 1,
            reward: 0, // 分裂體擊殺不額外掉落金幣
            wpIndex: parent.wpIndex,
            gridX: gx,
            gridY: gy,
            pixelX: center.left + off.vx,
            pixelY: center.top + off.vy,
            visualOffsetX: off.vx,
            visualOffsetY: off.vy,
            baseSpeed: parent.baseSpeed * 1.12,
            slowTimer: 0,
            slowRate: 0,
            armorShredTimer: 0,
            armorShredRate: 0,
            rootTimer: 0,
            rootVulnRate: 0
        });
    }
}

// ==================== 7. 戰鬥系統：獨立冷卻、雙曲線百分比護甲、跨元素融合與 Canvas FX ====================
function getMonsterProgress(monster) {
    const wpIdx = Math.min(monster.wpIndex, WAYPOINTS.length - 1);
    const wp = WAYPOINTS[wpIdx];
    return WAYPOINT_CUM_DIST[wpIdx] + Math.hypot(monster.gridX - wp.x, monster.gridY - wp.y);
}

function getMonsterEffectiveArmor(monster, armorPierce = 0) {
    const baseArmor = monster.armor || 0;
    const shredMult = monster.armorShredTimer > 0 ? (1 - (monster.armorShredRate || CONFIG.FIRE_SHRED_RATE)) : 1.0;
    const pierceMult = 1 - Math.max(0, Math.min(1, armorPierce));
    return Math.max(0, baseArmor * shredMult * pierceMult);
}

function isMonsterPreferred(candidate, currentBest, targetMode) {
    if (!currentBest) return true;
    if (targetMode === 'armor') {
        const armDiff = (candidate.armor || 0) - (currentBest.armor || 0);
        if (Math.abs(armDiff) > 0.01) return armDiff > 0;
    } else if (targetMode === 'lowhp') {
        if (candidate.hp !== currentBest.hp) return candidate.hp < currentBest.hp;
    }
    return getMonsterProgress(candidate) > getMonsterProgress(currentBest);
}

function findBestTargetInRange(towerIndex, towerObj, excludeIds = null) {
    if (monsters.length === 0) return null;

    const coords = indexToCoords(towerIndex);
    const towerPos = getCellCenter(coords.x, coords.y);
    const rangePx = getTowerRangePx(towerObj, towerIndex);
    const mode = towerObj.targetMode || 'first';

    let bestTarget = null;
    for (let i = 0; i < monsters.length; i++) {
        const m = monsters[i];
        if (m.hp <= 0) continue;
        if (excludeIds && excludeIds.has(m.id)) continue;

        const distPx = Math.hypot(m.pixelX - towerPos.left, m.pixelY - towerPos.top);
        if (distPx <= rangePx && isMonsterPreferred(m, bestTarget, mode)) {
            bestTarget = m;
        }
    }

    return bestTarget;
}

function calculateDamage(towerObj, monster, options = {}) {
    const dmgRow = TIER_DAMAGE_TABLE[towerObj.type];
    const baseDmg = ((dmgRow && dmgRow[towerObj.tier]) || 10);
    const damageScale = options.damageScale ?? 1.0;
    const terrainMult = options.terrainMult ?? 1.0;
    const extraMult = options.extraMult ?? 1.0;
    const thornGlobalMult = hasBlessing('thorn_bulwark') ? (1 + CONFIG.BLESSING_THORN_GLOBAL_DMG) : 1.0;

    // 基礎三元素對弱點目標觸發 200% 暴擊；融合塔以功能特化為主，弱點倍率維持 1.0
    const cfg = ELEMENT_CONFIG[towerObj.type];
    const isWeakness = (!cfg || !cfg.isHybrid) && (towerObj.type === monster.weakness);
    const weaknessMult = isWeakness ? CONFIG.WEAKNESS_MULTIPLIER : 1.0;

    // 根鬚纏繞易傷 (+20%) 與 荊棘壁壘世界樹附近 (+10%)
    let vulnMult = 1.0;
    if ((monster.rootTimer || 0) > 0 && (monster.rootVulnRate || 0) > 0) {
        vulnMult += monster.rootVulnRate;
    }
    if (hasBlessing('thorn_bulwark')) {
        const treeWp = WAYPOINTS[WAYPOINTS.length - 1];
        const mx = Number.isFinite(monster.gridX) ? monster.gridX : 0;
        const my = Number.isFinite(monster.gridY) ? monster.gridY : 0;
        if (Math.hypot(mx - treeWp.x, my - treeWp.y) <= CONFIG.BLESSING_THORN_TREE_RADIUS_CELLS) {
            vulnMult += CONFIG.BLESSING_THORN_NEAR_TREE_DMG;
        }
    }

    const rawDamage = baseDmg * thornGlobalMult * damageScale * terrainMult * extraMult * weaknessMult * vulnMult;
    const effectiveArmor = getMonsterEffectiveArmor(monster, options.armorPierce || 0);
    const armorFactor = CONFIG.ARMOR_HYPERBOLIC_K / (CONFIG.ARMOR_HYPERBOLIC_K + effectiveArmor);
    const finalDamage = Math.max(1, Math.round(rawDamage * armorFactor));

    return { damage: finalDamage, isWeakness };
}

function applySlowToMonster(monster, slowRate, durationMs) {
    if (!monster || monster.hp <= 0) return;
    const activeRate = monster.slowTimer > 0 ? (monster.slowRate || CONFIG.ICE_SLOW_RATE) : 0;
    if (slowRate >= activeRate) {
        monster.slowRate = slowRate;
        monster.slowTimer = Math.max(monster.slowTimer, durationMs);
    }
}

function applyArmorShred(monster, shredRate = CONFIG.FIRE_SHRED_RATE, durationMs = CONFIG.FIRE_SHRED_DURATION_MS) {
    if (!monster || monster.hp <= 0) return;
    const activeRate = monster.armorShredTimer > 0 ? (monster.armorShredRate || 0) : 0;
    if (shredRate >= activeRate) {
        monster.armorShredRate = shredRate;
        monster.armorShredTimer = Math.max(monster.armorShredTimer, durationMs);
    }
}

function spawnDamageNumber(amount, isWeakness, px, py, tagPrefix = '') {
    if (!floatingLayerEl) return;

    const dmgEl = document.createElement('div');
    dmgEl.classList.add('floating-dmg', isWeakness ? 'weakness' : 'normal');
    dmgEl.innerText = isWeakness ? `WEAK! -${amount}` : `${tagPrefix}-${amount}`;

    const randomOffsetX = (Math.random() - 0.5) * 18;
    const randomOffsetY = (Math.random() - 0.5) * 8;
    dmgEl.style.left = `${px + randomOffsetX}px`;
    dmgEl.style.top = `${py - 18 + randomOffsetY}px`;

    const durationMs = Math.round(720 / Math.max(1, gameSpeed * 0.75));
    dmgEl.style.animationDuration = `${durationMs}ms`;
    floatingLayerEl.appendChild(dmgEl);
    scheduleGameTimeout(() => dmgEl.remove(), durationMs);
}

// Canvas 2D 特效生成器（平滑彈道、閃電、聚焦光束、爆開粒子、受擊閃白）
function emitParticleBurst(x, y, color, count = 8, speedMax = 85) {
    for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
        const speed = speedMax * (0.45 + Math.random() * 0.55);
        fxEntities.particles.push({
            x,
            y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            radius: 1.8 + Math.random() * 2.0,
            color,
            ageMs: 0,
            durationMs: 240 + Math.random() * 120
        });
    }
}

function emitHitFlash(x, y, color = '#ffffff') {
    fxEntities.flashes.push({
        x,
        y,
        color,
        radius: Math.max(8, boardMetrics.cellW * 0.42),
        ageMs: 0,
        durationMs: 95
    });
}

function emitCanvasAttackFX(fxType, fromPos, toPos, options = {}) {
    const startX = fromPos.left;
    const startY = fromPos.top;
    const endX = toPos.left;
    const endY = toPos.top;

    if (fxType === 'thunder' || fxType === 'magnet-arc') {
        const isMagnet = fxType === 'magnet-arc';
        const segments = 4;
        const pts = [{ x: startX, y: startY }];
        for (let s = 1; s < segments; s++) {
            const t = s / segments;
            const jitter = isMagnet ? 10 : 13;
            pts.push({
                x: startX + (endX - startX) * t + (Math.random() - 0.5) * jitter * 2,
                y: startY + (endY - startY) * t + (Math.random() - 0.5) * jitter * 2
            });
        }
        pts.push({ x: endX, y: endY });

        fxEntities.bolts.push({
            points: pts,
            color: isMagnet ? '#38bdf8' : (options.isLv3 ? '#fef08a' : '#fde047'),
            coreColor: '#ffffff',
            width: isMagnet ? 2.4 : (options.isLv3 ? 3.0 : 2.4),
            ageMs: 0,
            durationMs: 210
        });
        emitParticleBurst(endX, endY, isMagnet ? '#67e8f9' : '#fde047', 6, 75);
        emitHitFlash(endX, endY, isMagnet ? '#bae6fd' : '#fef9c3');
        if (options.frostRadiusPx > 0) {
            fxEntities.rings.push({
                x: endX,
                y: endY,
                maxRadius: options.frostRadiusPx,
                color: '#38bdf8',
                fillAlpha: 0.22,
                ageMs: 0,
                durationMs: 280
            });
        }
        return;
    }

    if (fxType === 'plasma') {
        const stacks = options.stacks || 0;
        fxEntities.beams.push({
            x1: startX,
            y1: startY,
            x2: endX,
            y2: endY,
            width: 2.2 + stacks * 0.7,
            color: stacks >= 4 ? '#f97316' : '#facc15',
            coreColor: '#fffbeb',
            ageMs: 0,
            durationMs: 185
        });
        emitParticleBurst(endX, endY, stacks >= 4 ? '#fb923c' : '#fde047', 5 + stacks, 70);
        emitHitFlash(endX, endY, '#fef08a');
        return;
    }

    // 彈道軌跡（火球 / 冰錐 / 蒸氣爆裂彈）
    const colorMap = {
        fire: '#ff6b6b',
        ice: '#38bdf8',
        steam: '#7dd3fc'
    };
    const coreColor = colorMap[fxType] || '#ffffff';
    fxEntities.projectiles.push({
        fxType,
        x1: startX,
        y1: startY,
        x2: endX,
        y2: endY,
        color: coreColor,
        radius: fxType === 'fire' ? 4.4 : (fxType === 'steam' ? 4.8 : 3.6),
        ageMs: 0,
        durationMs: 135
    });

    const ringRadius = options.splashRadiusPx || options.frostRadiusPx || 0;
    if (ringRadius > 0) {
        fxEntities.rings.push({
            x: endX,
            y: endY,
            maxRadius: ringRadius,
            color: fxType === 'ice' ? '#38bdf8' : (fxType === 'steam' ? '#93c5fd' : '#fb923c'),
            fillAlpha: 0.24,
            ageMs: 0,
            durationMs: 280
        });
    }

    emitParticleBurst(endX, endY, coreColor, ringRadius > 0 ? 11 : 7, ringRadius > 0 ? 105 : 70);
    emitHitFlash(endX, endY, '#ffffff');
}

function updateAndRenderCanvasFX(dtMs) {
    const dtSec = dtMs / 1000;

    // 世界樹健康狀態（>= 14 生命）持續飄落螢光綠葉；自然狂熱啟動時全塔飄散金色靈能粒子
    if (isGameplayActive() && baseHp >= CONFIG.WORLD_TREE_HEALTHY_MIN) {
        leafEmitAccMs += dtMs;
        while (leafEmitAccMs >= 420) {
            leafEmitAccMs -= 420;
            const treeWp = WAYPOINTS[WAYPOINTS.length - 1];
            const treePos = getCellCenter(treeWp.x, treeWp.y);
            fxEntities.leaves.push({
                x: treePos.left + (Math.random() - 0.5) * boardMetrics.cellW * 0.65,
                y: treePos.top + (Math.random() - 0.5) * boardMetrics.cellH * 0.45,
                vx: -10 - Math.random() * 14,
                vy: -16 - Math.random() * 16,
                swayPhase: Math.random() * Math.PI * 2,
                size: 3.0 + Math.random() * 2.2,
                color: Math.random() < 0.5 ? '#4ade80' : '#86efac',
                ageMs: 0,
                durationMs: 1400 + Math.random() * 700
            });
        }
    }

    if (isGameplayActive() && frenzyActiveMs > 0) {
        frenzyFxAccMs += dtMs;
        while (frenzyFxAccMs >= 200) {
            frenzyFxAccMs -= 200;
            for (let idx = 0; idx < board.length; idx++) {
                if (!board[idx] || Math.random() > 0.48) continue;
                const c = indexToCoords(idx);
                const pos = getCellCenter(c.x, c.y);
                fxEntities.particles.push({
                    x: pos.left + (Math.random() - 0.5) * boardMetrics.cellW * 0.55,
                    y: pos.top + (Math.random() - 0.2) * boardMetrics.cellH * 0.4,
                    vx: (Math.random() - 0.5) * 14,
                    vy: -24 - Math.random() * 18,
                    radius: 1.7 + Math.random() * 1.4,
                    color: Math.random() < 0.5 ? '#fde047' : '#f59e0b',
                    ageMs: 0,
                    durationMs: 420 + Math.random() * 180
                });
            }
        }
    }

    // 推進所有特效生命週期（即使在 headless/無 2D context 下也正常消耗清理）
    for (let i = fxEntities.projectiles.length - 1; i >= 0; i--) {
        fxEntities.projectiles[i].ageMs += dtMs;
        if (fxEntities.projectiles[i].ageMs >= fxEntities.projectiles[i].durationMs) {
            fxEntities.projectiles.splice(i, 1);
        }
    }
    for (let i = fxEntities.bolts.length - 1; i >= 0; i--) {
        fxEntities.bolts[i].ageMs += dtMs;
        if (fxEntities.bolts[i].ageMs >= fxEntities.bolts[i].durationMs) {
            fxEntities.bolts.splice(i, 1);
        }
    }
    for (let i = fxEntities.beams.length - 1; i >= 0; i--) {
        fxEntities.beams[i].ageMs += dtMs;
        if (fxEntities.beams[i].ageMs >= fxEntities.beams[i].durationMs) {
            fxEntities.beams.splice(i, 1);
        }
    }
    for (let i = fxEntities.rings.length - 1; i >= 0; i--) {
        fxEntities.rings[i].ageMs += dtMs;
        if (fxEntities.rings[i].ageMs >= fxEntities.rings[i].durationMs) {
            fxEntities.rings.splice(i, 1);
        }
    }
    for (let i = fxEntities.particles.length - 1; i >= 0; i--) {
        const p = fxEntities.particles[i];
        p.ageMs += dtMs;
        p.x += p.vx * dtSec;
        p.y += p.vy * dtSec;
        p.vx *= 0.92;
        p.vy *= 0.92;
        if (p.ageMs >= p.durationMs) {
            fxEntities.particles.splice(i, 1);
        }
    }
    for (let i = fxEntities.flashes.length - 1; i >= 0; i--) {
        fxEntities.flashes[i].ageMs += dtMs;
        if (fxEntities.flashes[i].ageMs >= fxEntities.flashes[i].durationMs) {
            fxEntities.flashes.splice(i, 1);
        }
    }
    for (let i = fxEntities.leaves.length - 1; i >= 0; i--) {
        const lf = fxEntities.leaves[i];
        lf.ageMs += dtMs;
        lf.x += (lf.vx + Math.sin(lf.ageMs * 0.006 + lf.swayPhase) * 9) * dtSec;
        lf.y += lf.vy * dtSec;
        if (lf.ageMs >= lf.durationMs) {
            fxEntities.leaves.splice(i, 1);
        }
    }

    if (!fxCtx || !fxCanvasEl) return;
    fxCtx.clearRect(0, 0, boardMetrics.stageW, boardMetrics.stageH);

    // 1. 範圍擴散環（火濺射、冰霜、蒸氣、磁暴冰環）
    for (let i = 0; i < fxEntities.rings.length; i++) {
        const r = fxEntities.rings[i];
        const p = Math.min(1, r.ageMs / r.durationMs);
        const curRadius = Math.max(4, r.maxRadius * (0.35 + 0.65 * p));
        const alpha = 1 - p;

        fxCtx.save();
        fxCtx.globalAlpha = alpha * r.fillAlpha;
        fxCtx.fillStyle = r.color;
        fxCtx.beginPath();
        fxCtx.arc(r.x, r.y, curRadius, 0, Math.PI * 2);
        fxCtx.fill();

        fxCtx.globalAlpha = alpha * 0.85;
        fxCtx.strokeStyle = r.color;
        fxCtx.lineWidth = 2;
        fxCtx.beginPath();
        fxCtx.arc(r.x, r.y, curRadius, 0, Math.PI * 2);
        fxCtx.stroke();
        fxCtx.restore();
    }

    // 2. 飛行彈道與尾跡
    for (let i = 0; i < fxEntities.projectiles.length; i++) {
        const proj = fxEntities.projectiles[i];
        const p = Math.min(1, proj.ageMs / proj.durationMs);
        const curX = proj.x1 + (proj.x2 - proj.x1) * p;
        const curY = proj.y1 + (proj.y2 - proj.y1) * p;
        const tailP = Math.max(0, p - 0.35);
        const tailX = proj.x1 + (proj.x2 - proj.x1) * tailP;
        const tailY = proj.y1 + (proj.y2 - proj.y1) * tailP;

        fxCtx.save();
        fxCtx.globalAlpha = 1 - p * 0.25;
        fxCtx.strokeStyle = proj.color;
        fxCtx.lineWidth = proj.radius * 1.1;
        fxCtx.lineCap = 'round';
        fxCtx.beginPath();
        fxCtx.moveTo(tailX, tailY);
        fxCtx.lineTo(curX, curY);
        fxCtx.stroke();

        fxCtx.fillStyle = '#ffffff';
        fxCtx.beginPath();
        fxCtx.arc(curX, curY, proj.radius * 0.72, 0, Math.PI * 2);
        fxCtx.fill();
        fxCtx.restore();
    }

    // 3. 電漿聚焦持續雷射光束
    for (let i = 0; i < fxEntities.beams.length; i++) {
        const b = fxEntities.beams[i];
        const alpha = 1 - Math.min(1, b.ageMs / b.durationMs);

        fxCtx.save();
        fxCtx.globalAlpha = alpha * 0.65;
        fxCtx.strokeStyle = b.color;
        fxCtx.lineWidth = b.width * 2.1;
        fxCtx.lineCap = 'round';
        fxCtx.beginPath();
        fxCtx.moveTo(b.x1, b.y1);
        fxCtx.lineTo(b.x2, b.y2);
        fxCtx.stroke();

        fxCtx.globalAlpha = alpha;
        fxCtx.strokeStyle = b.coreColor;
        fxCtx.lineWidth = Math.max(1.2, b.width * 0.75);
        fxCtx.beginPath();
        fxCtx.moveTo(b.x1, b.y1);
        fxCtx.lineTo(b.x2, b.y2);
        fxCtx.stroke();
        fxCtx.restore();
    }

    // 4. 閃電與極地磁暴電弧
    for (let i = 0; i < fxEntities.bolts.length; i++) {
        const bolt = fxEntities.bolts[i];
        const alpha = 1 - Math.min(1, bolt.ageMs / bolt.durationMs);
        if (bolt.points.length < 2) continue;

        fxCtx.save();
        fxCtx.lineCap = 'round';
        fxCtx.lineJoin = 'round';

        fxCtx.globalAlpha = alpha * 0.6;
        fxCtx.strokeStyle = bolt.color;
        fxCtx.lineWidth = bolt.width * 2.1;
        fxCtx.beginPath();
        fxCtx.moveTo(bolt.points[0].x, bolt.points[0].y);
        for (let k = 1; k < bolt.points.length; k++) {
            fxCtx.lineTo(bolt.points[k].x, bolt.points[k].y);
        }
        fxCtx.stroke();

        fxCtx.globalAlpha = alpha;
        fxCtx.strokeStyle = bolt.coreColor;
        fxCtx.lineWidth = Math.max(1.2, bolt.width * 0.7);
        fxCtx.beginPath();
        fxCtx.moveTo(bolt.points[0].x, bolt.points[0].y);
        for (let k = 1; k < bolt.points.length; k++) {
            fxCtx.lineTo(bolt.points[k].x, bolt.points[k].y);
        }
        fxCtx.stroke();
        fxCtx.restore();
    }

    // 5. 命中爆開粒子
    for (let i = 0; i < fxEntities.particles.length; i++) {
        const pt = fxEntities.particles[i];
        const alpha = 1 - Math.min(1, pt.ageMs / pt.durationMs);

        fxCtx.save();
        fxCtx.globalAlpha = alpha;
        fxCtx.fillStyle = pt.color;
        fxCtx.beginPath();
        fxCtx.arc(pt.x, pt.y, pt.radius * alpha, 0, Math.PI * 2);
        fxCtx.fill();
        fxCtx.restore();
    }

    // 6. 怪物受擊閃白
    for (let i = 0; i < fxEntities.flashes.length; i++) {
        const fl = fxEntities.flashes[i];
        const alpha = (1 - Math.min(1, fl.ageMs / fl.durationMs)) * 0.65;

        fxCtx.save();
        fxCtx.globalAlpha = alpha;
        fxCtx.fillStyle = fl.color;
        fxCtx.beginPath();
        fxCtx.arc(fl.x, fl.y, fl.radius, 0, Math.PI * 2);
        fxCtx.fill();
        fxCtx.restore();
    }

    // 7. 世界樹螢光綠葉與根鬚定身視覺光環
    for (let i = 0; i < fxEntities.leaves.length; i++) {
        const lf = fxEntities.leaves[i];
        const p = Math.min(1, lf.ageMs / lf.durationMs);
        const alpha = Math.sin(p * Math.PI) * 0.88;
        if (alpha <= 0.01) continue;

        fxCtx.save();
        fxCtx.globalAlpha = alpha;
        fxCtx.fillStyle = lf.color;
        fxCtx.shadowColor = '#22c55e';
        fxCtx.shadowBlur = 6;
        fxCtx.translate(lf.x, lf.y);
        fxCtx.rotate(lf.swayPhase + p * 2.2);
        fxCtx.beginPath();
        fxCtx.ellipse(0, 0, lf.size, lf.size * 0.52, 0, 0, Math.PI * 2);
        fxCtx.fill();
        fxCtx.restore();
    }

    for (let i = 0; i < monsters.length; i++) {
        const m = monsters[i];
        if ((m.rootTimer || 0) <= 0) continue;
        fxCtx.save();
        fxCtx.strokeStyle = 'rgba(74, 222, 128, 0.85)';
        fxCtx.lineWidth = 2.2;
        fxCtx.setLineDash([4, 3]);
        fxCtx.beginPath();
        fxCtx.arc(m.pixelX, m.pixelY + 4, Math.max(12, boardMetrics.cellW * 0.42), 0, Math.PI * 2);
        fxCtx.stroke();
        fxCtx.restore();
    }
}

function computeKillDewGain(monster) {
    if (!monster || monster.isSplitChild) return 0;
    let baseDew = CONFIG.DEW_GAIN_NORMAL;
    if (monster.isBoss) {
        baseDew = CONFIG.DEW_GAIN_BOSS;
    } else if (monster.typeKey === 'hound' || monster.typeKey === 'slime' || monster.typeKey === 'golem') {
        baseDew = CONFIG.DEW_GAIN_SPECIAL;
    }
    if (hasBlessing('life_nectar')) {
        baseDew = Math.round(baseDew * (1 + CONFIG.BLESSING_DEW_GAIN_BONUS));
    }
    return baseDew;
}

function triggerEmberExplosion(originX, originY, killerTowerObj, killingDamage) {
    const emberDmg = Math.max(1, Math.round(killingDamage * CONFIG.BLESSING_EMBER_DAMAGE_RATIO));
    const emberRadiusPx = CONFIG.BLESSING_EMBER_RADIUS_CELLS * boardMetrics.step;

    fxEntities.rings.push({
        x: originX,
        y: originY,
        maxRadius: emberRadiusPx,
        color: '#f97316',
        fillAlpha: 0.28,
        ageMs: 0,
        durationMs: 260
    });
    emitParticleBurst(originX, originY, '#fb923c', 10, 95);

    const victims = monsters.filter(m =>
        m.hp > 0 && Math.hypot(m.pixelX - originX, m.pixelY - originY) <= emberRadiusPx
    );
    for (let i = 0; i < victims.length; i++) {
        const victim = victims[i];
        if (victim.hp <= 0) continue;
        const hpBefore = victim.hp;
        victim.hp = Math.max(0, hpBefore - emberDmg);
        recordTowerDamage(killerTowerObj, Math.min(hpBefore, emberDmg));
        spawnDamageNumber(emberDmg, false, victim.pixelX, victim.pixelY, '🔥');
        if (victim.hp <= 0) {
            handleMonsterKilled(victim, killerTowerObj, emberDmg, { isEmberSplash: true });
        }
    }
}

function handleMonsterKilled(monster, killerTowerObj, killingDamage, options = {}) {
    const mapSpec = getCurrentMapSpec();
    const killGold = monster.reward > 0
        ? Math.max(1, Math.round(monster.reward * (mapSpec.killGoldMult || 1.0)))
        : 0;
    currentGold += killGold;
    totalGoldEarned += killGold;
    killsCount++;

    const dewGain = computeKillDewGain(monster);
    if (dewGain > 0) {
        dewEnergy = Math.min(CONFIG.DEW_MAX, dewEnergy + dewGain);
    }

    const deadIdx = monsters.findIndex(m => m.id === monster.id);
    if (deadIdx !== -1) {
        monsters.splice(deadIdx, 1);
    }
    removeMonsterDom(monster.id);
    SoundEngine.playKill();

    if (monster.splitsOnDeath) {
        spawnSplitMiniSlimes(monster);
        msgText.innerText = `🟢 【${monster.name}】分裂成 ${CONFIG.SLIME_SPLIT_COUNT} 隻迷你史萊姆！`;
    } else if (killGold > 0 && !options.isEmberSplash) {
        const dewHint = dewGain > 0 ? `、+${dewGain} 💧` : '';
        msgText.innerText = `💥 擊殺【${monster.name}】！獲得 +${killGold} 💰${dewHint}！`;
    }

    if (
        !options.isEmberSplash
        && hasBlessing('searing_embers')
        && killerTowerObj
        && FIRE_LINEAGE_TYPES.includes(killerTowerObj.type)
        && killingDamage > 0
    ) {
        triggerEmberExplosion(monster.pixelX, monster.pixelY, killerTowerObj, killingDamage);
    }

    updateHUD();
}

function applyHitToMonster(towerIndex, towerObj, monster, options = {}) {
    if (!monster || monster.hp <= 0) return null;

    const terrainMult = options.terrainMult ?? getTowerTerrainDamageMult(towerIndex);
    const result = calculateDamage(towerObj, monster, {
        damageScale: options.damageScale ?? 1.0,
        terrainMult,
        extraMult: options.extraMult ?? 1.0,
        armorPierce: options.armorPierce ?? 0
    });

    const hpBefore = monster.hp;
    monster.hp = Math.max(0, hpBefore - result.damage);
    recordTowerDamage(towerObj, Math.min(hpBefore, result.damage));

    // 屬性負面狀態：火塔灼燒破甲 30% / 3s；冰塔緩速控場（融合凜冬血脈加成）
    if (towerObj.type === 'fire' && options.applyShred !== false) {
        applyArmorShred(monster, CONFIG.FIRE_SHRED_RATE, CONFIG.FIRE_SHRED_DURATION_MS);
    } else if (towerObj.type === 'ice' && options.applySlow !== false) {
        const isLv3 = towerObj.tier >= CONFIG.MAX_TIER;
        const baseRate = isLv3 ? CONFIG.ICE_LV3_SLOW_RATE : CONFIG.ICE_SLOW_RATE;
        const baseDur = isLv3 ? CONFIG.ICE_LV3_SLOW_DURATION_MS : CONFIG.ICE_SLOW_DURATION_MS;
        const iceSlow = getIceLineageSlowParams('ice', baseRate, baseDur);
        applySlowToMonster(monster, iceSlow.rate, iceSlow.durationMs);
    }

    spawnDamageNumber(result.damage, result.isWeakness, monster.pixelX, monster.pixelY);

    if (monster.hp <= 0) {
        handleMonsterKilled(monster, towerObj, result.damage);
    }

    return result;
}

function fireThunderBolt(towerIndex, towerObj) {
    if (!isGameplayActive() || monsters.length === 0) return false;
    if (board[towerIndex] !== towerObj) return false;

    const target = findBestTargetInRange(towerIndex, towerObj);
    if (!target) return false;

    const coords = indexToCoords(towerIndex);
    const towerPos = getCellCenter(coords.x, coords.y);
    const targetPos = { left: target.pixelX, top: target.pixelY };

    updateTowerAimVisual(towerIndex, towerObj, towerPos, targetPos);
    applyHitToMonster(towerIndex, towerObj, target);
    emitCanvasAttackFX('thunder', towerPos, targetPos, { isLv3: towerObj.tier >= CONFIG.MAX_TIER });
    SoundEngine.playTowerShot('thunder');
    return true;
}

function performTowerAttack(towerIndex, towerObj) {
    const coords = indexToCoords(towerIndex);
    const towerPos = getCellCenter(coords.x, coords.y);
    const isLv3 = towerObj.tier >= CONFIG.MAX_TIER;

    if (towerObj.type === 'thunder') {
        const boltCount = (isLv3 ? CONFIG.THUNDER_LV3_BOLT_COUNT : CONFIG.THUNDER_BOLT_COUNT) + getThunderChainBonus('thunder');
        if (!fireThunderBolt(towerIndex, towerObj)) return false;

        // 後續閃電在 90ms 後由主迴圈動態重新索敵與繪製，綁定 sessionId
        for (let bolt = 1; bolt < boltCount; bolt++) {
            pendingBolts.push({
                sessionId,
                towerIndex,
                towerObj,
                remainingMs: CONFIG.THUNDER_BOLT_DELAY_MS * bolt
            });
        }
        return true;
    }

    const target = findBestTargetInRange(towerIndex, towerObj);
    if (!target) return false;

    const targetPos = { left: target.pixelX, top: target.pixelY };
    updateTowerAimVisual(towerIndex, towerObj, towerPos, targetPos);

    // 跨元素融合塔 1：💨 蒸氣爆裂塔（1.3 格範圍濺射 + 無視 50% 護甲 + 凜冬血脈微弱寒冷）
    if (towerObj.type === 'steam') {
        const splashRadiusPx = CONFIG.STEAM_SPLASH_RADIUS_CELLS * boardMetrics.step;
        const steamSlow = getIceLineageSlowParams('steam', 0, 0);
        const splashTargets = monsters.filter(m =>
            m.id !== target.id
            && m.hp > 0
            && Math.hypot(m.pixelX - targetPos.left, m.pixelY - targetPos.top) <= splashRadiusPx
        );
        applyHitToMonster(towerIndex, towerObj, target, { armorPierce: CONFIG.STEAM_ARMOR_PIERCE });
        if (steamSlow.rate > 0 && target.hp > 0) {
            applySlowToMonster(target, steamSlow.rate, steamSlow.durationMs);
        }
        for (let i = 0; i < splashTargets.length; i++) {
            const spTarget = splashTargets[i];
            applyHitToMonster(towerIndex, towerObj, spTarget, {
                damageScale: CONFIG.STEAM_SPLASH_RATIO,
                armorPierce: CONFIG.STEAM_ARMOR_PIERCE
            });
            if (steamSlow.rate > 0 && spTarget.hp > 0) {
                applySlowToMonster(spTarget, steamSlow.rate, steamSlow.durationMs);
            }
        }
        emitCanvasAttackFX('steam', towerPos, targetPos, { splashRadiusPx });
        SoundEngine.playTowerShot('steam');
        return true;
    }

    // 跨元素融合塔 2：💠 極地磁暴塔（50% 感電冰環群體緩速 + 連鎖彈跳額外 2 名敵人，含祝福強化）
    if (towerObj.type === 'magnet') {
        const frostRadiusPx = CONFIG.MAGNET_AOE_RADIUS_CELLS * boardMetrics.step;
        const chainRadiusPx = CONFIG.MAGNET_CHAIN_RADIUS_CELLS * boardMetrics.step;
        const magSlow = getIceLineageSlowParams('magnet', CONFIG.MAGNET_SLOW_RATE, CONFIG.MAGNET_SLOW_DURATION_MS);
        const chainTargetsCount = CONFIG.MAGNET_CHAIN_EXTRA_TARGETS + getThunderChainBonus('magnet');

        applyHitToMonster(towerIndex, towerObj, target);
        if (target.hp > 0) {
            applySlowToMonster(target, magSlow.rate, magSlow.durationMs);
        }

        for (let i = 0; i < monsters.length; i++) {
            const m = monsters[i];
            if (m.hp <= 0) continue;
            if (Math.hypot(m.pixelX - targetPos.left, m.pixelY - targetPos.top) <= frostRadiusPx) {
                applySlowToMonster(m, magSlow.rate, magSlow.durationMs);
            }
        }
        emitCanvasAttackFX('magnet-arc', towerPos, targetPos, { frostRadiusPx });

        // 連鎖彈跳額外敵人（基礎 2 名，⚡雷鳴超導 +1 名）
        const visited = new Set([target.id]);
        let prevPos = targetPos;
        for (let bounce = 0; bounce < chainTargetsCount; bounce++) {
            let bestNext = null;
            let bestDist = Infinity;
            for (let i = 0; i < monsters.length; i++) {
                const candidate = monsters[i];
                if (candidate.hp <= 0 || visited.has(candidate.id)) continue;
                const d = Math.hypot(candidate.pixelX - prevPos.left, candidate.pixelY - prevPos.top);
                if (d <= chainRadiusPx && d < bestDist) {
                    bestDist = d;
                    bestNext = candidate;
                }
            }
            if (!bestNext) break;
            visited.add(bestNext.id);
            const nextPos = { left: bestNext.pixelX, top: bestNext.pixelY };
            applyHitToMonster(towerIndex, towerObj, bestNext, { damageScale: CONFIG.MAGNET_CHAIN_DAMAGE_RATIO });
            if (bestNext.hp > 0) {
                applySlowToMonster(bestNext, magSlow.rate, magSlow.durationMs);
            }
            emitCanvasAttackFX('magnet-arc', prevPos, nextPos);
            prevPos = nextPos;
        }
        SoundEngine.playTowerShot('magnet');
        return true;
    }

    // 跨元素融合塔 3：☄️ 電漿聚焦塔（連續鎖定同目標每次遞增 15%，最高 5 層）
    if (towerObj.type === 'plasma') {
        if (towerObj.focusTargetId === target.id) {
            towerObj.focusStacks = Math.min(CONFIG.PLASMA_MAX_STACKS, (towerObj.focusStacks || 0) + 1);
        } else {
            towerObj.focusTargetId = target.id;
            towerObj.focusStacks = 0;
        }
        const stackMult = 1 + towerObj.focusStacks * CONFIG.PLASMA_STACK_BONUS;
        applyHitToMonster(towerIndex, towerObj, target, { extraMult: stackMult });
        emitCanvasAttackFX('plasma', towerPos, targetPos, { stacks: towerObj.focusStacks });
        SoundEngine.playTowerShot('plasma');
        if (selectedIndex === towerIndex) {
            updateTowerInspector();
        }
        return true;
    }

    // 基礎火/冰塔（含 Lv.3 質變）
    if (towerObj.type === 'fire' && isLv3) {
        const splashRadiusPx = CONFIG.FIRE_LV3_SPLASH_RADIUS_CELLS * boardMetrics.step;
        const splashTargets = monsters.filter(m =>
            m.id !== target.id
            && m.hp > 0
            && Math.hypot(m.pixelX - targetPos.left, m.pixelY - targetPos.top) <= splashRadiusPx
        );
        applyHitToMonster(towerIndex, towerObj, target);
        for (let i = 0; i < splashTargets.length; i++) {
            applyHitToMonster(towerIndex, towerObj, splashTargets[i], {
                damageScale: CONFIG.FIRE_LV3_SPLASH_RATIO
            });
        }
        emitCanvasAttackFX('fire', towerPos, targetPos, { splashRadiusPx });
        SoundEngine.playTowerShot('fire');
        return true;
    }

    if (towerObj.type === 'ice' && isLv3) {
        const frostRadiusPx = CONFIG.ICE_LV3_AOE_RADIUS_CELLS * boardMetrics.step;
        const iceAoeSlow = getIceLineageSlowParams('ice', CONFIG.ICE_LV3_AOE_SLOW_RATE, CONFIG.ICE_LV3_AOE_SLOW_DURATION_MS);
        applyHitToMonster(towerIndex, towerObj, target);
        for (let i = 0; i < monsters.length; i++) {
            const m = monsters[i];
            if (m.id === target.id || m.hp <= 0) continue;
            if (Math.hypot(m.pixelX - targetPos.left, m.pixelY - targetPos.top) <= frostRadiusPx) {
                applySlowToMonster(m, iceAoeSlow.rate, iceAoeSlow.durationMs);
            }
        }
        emitCanvasAttackFX('ice', towerPos, targetPos, { frostRadiusPx });
        SoundEngine.playTowerShot('ice');
        return true;
    }

    applyHitToMonster(towerIndex, towerObj, target);
    emitCanvasAttackFX(towerObj.type, towerPos, targetPos);
    SoundEngine.playTowerShot(towerObj.type);
    return true;
}

function updateTowersCombat(dtMs) {
    if (!isGameplayActive()) return;

    let didCombatAct = false;

    // 先推進先前排程的延遲閃電連擊，避免剛排程的閃電在同一幀被扣光延遲
    if (pendingBolts.length > 0) {
        const prevQueue = pendingBolts;
        const remainingQueue = [];
        pendingBolts = [];
        for (let i = 0; i < prevQueue.length; i++) {
            const boltTask = prevQueue[i];
            if (boltTask.sessionId !== sessionId || !isGameplayActive()) continue;

            boltTask.remainingMs -= dtMs;
            if (boltTask.remainingMs <= 0) {
                if (fireThunderBolt(boltTask.towerIndex, boltTask.towerObj)) {
                    didCombatAct = true;
                }
            } else {
                remainingQueue.push(boltTask);
            }
        }
        pendingBolts = remainingQueue.concat(pendingBolts);
    }

    const isCombatPhase = monsters.length > 0 || waveState === 'SPAWNING';
    if (isCombatPhase) {
        for (let idx = 0; idx < board.length; idx++) {
            const towerObj = board[idx];
            if (towerObj === null) continue;

            if (!Number.isFinite(towerObj.accMs)) {
                towerObj.accMs = 0;
            }

            const intervalMs = getTowerAttackInterval(towerObj, idx);
            towerObj.accMs = Math.min(intervalMs, towerObj.accMs + dtMs);

            if (towerObj.accMs >= intervalMs && monsters.length > 0) {
                const fired = performTowerAttack(idx, towerObj);
                if (fired) {
                    towerObj.accMs -= intervalMs;
                    didCombatAct = true;
                }
            }
        }
    }

    if (didCombatAct) {
        renderMonsterLayer();
    }
}

// ==================== 8. 怪物移動與無閃爍 DOM 更新 ====================
function removeMonsterDom(monsterId) {
    const el = monsterDomMap.get(monsterId);
    if (el) {
        el.remove();
        monsterDomMap.delete(monsterId);
    }
}

function createMonsterSvgHtml(monster) {
    const shadow = '<ellipse cx="32" cy="57" rx="19" ry="5.5" fill="rgba(0,0,0,0.42)"/>';
    let body = '';

    if (monster.isBoss) {
        if (monster.typeKey === 'lava') {
            body = `
        <polygon points="10,44 16,18 27,22 32,12 37,22 48,18 54,44 45,54 19,54" fill="#29120b" stroke="#0c0503" stroke-width="2"/>
        <polygon points="16,18 9,8 22,15" fill="#7c2d12" stroke="#1c0803" stroke-width="1.5"/>
        <polygon points="48,18 55,8 42,15" fill="#7c2d12" stroke="#1c0803" stroke-width="1.5"/>
        <polygon points="21,26 32,20 43,26 45,42 32,50 19,42" fill="#451a03"/>
        <polygon points="25,31 32,27 39,31 36,42 32,46 28,42" fill="#f97316"/>
        <polygon points="28,33 32,30 36,33 32,40" fill="#fef08a"/>
        <polygon points="23,23 29,25 24,27" fill="#fef08a"/>
        <polygon points="41,23 35,25 40,27" fill="#fef08a"/>
    `;
        } else if (monster.typeKey === 'air') {
            body = `
        <polygon points="11,34 22,16 42,16 53,34 45,49 19,49" fill="#1e293b" stroke="#0f172a" stroke-width="2"/>
        <rect x="7" y="26" width="9" height="15" rx="3" fill="#475569" stroke="#0f172a" stroke-width="1.5"/>
        <rect x="48" y="26" width="9" height="15" rx="3" fill="#475569" stroke="#0f172a" stroke-width="1.5"/>
        <polygon points="20,17 44,17 48,29 16,29" fill="#334155"/>
        <circle cx="32" cy="34" r="9.5" fill="#0284c7" stroke="#bae6fd" stroke-width="1.8"/>
        <circle cx="32" cy="34" r="4.5" fill="#e0f2fe"/>
        <polygon points="26,46 32,54 38,46" fill="#38bdf8"/>
    `;
        } else {
            // 腐朽古樹王 (wood boss)
            body = `
        <polygon points="14,19 8,7 22,14 27,21" fill="#3f2b1d" stroke="#180f09" stroke-width="1.5"/>
        <polygon points="50,19 56,7 42,14 37,21" fill="#3f2b1d" stroke="#180f09" stroke-width="1.5"/>
        <polygon points="15,48 20,21 44,21 49,48 41,55 23,55" fill="#4b3423" stroke="#1a110b" stroke-width="2"/>
        <polygon points="19,21 32,12 45,21 38,28 26,28" fill="#166534" stroke="#052e16" stroke-width="1.4"/>
        <polygon points="27,34 32,29 37,34 34,43 30,43" fill="#a855f7" stroke="#f0abfc" stroke-width="1.2"/>
        <circle cx="25" cy="27" r="2.6" fill="#fde047"/>
        <circle cx="39" cy="27" r="2.6" fill="#fde047"/>
    `;
        }
    } else if (monster.isSplitChild) {
        body = `
    <path d="M16 46 Q16 25 32 23 Q48 25 48 46 Q48 54 32 54 Q16 54 16 46 Z" fill="#22c55e" stroke="#14532d" stroke-width="1.8"/>
    <path d="M21 33 Q24 27 31 27" fill="none" stroke="#bbf7d0" stroke-width="2.5" stroke-linecap="round"/>
    <circle cx="27" cy="40" r="2.4" fill="#052e16"/><circle cx="37" cy="40" r="2.4" fill="#052e16"/>
    <circle cx="27.8" cy="39" r="0.9" fill="#ffffff"/><circle cx="37.8" cy="39" r="0.9" fill="#ffffff"/>
`;
    } else if (monster.typeKey === 'lava') {
        body = `
    <polygon points="16,47 18,22 28,15 36,15 46,22 48,47 39,54 25,54" fill="#3b160c" stroke="#170804" stroke-width="1.8"/>
    <polygon points="21,23 32,17 43,23 41,34 23,34" fill="#7c2d12"/>
    <polygon points="27,32 32,27 37,32 35,44 29,44" fill="#f97316"/>
    <polygon points="30,33 34,33 32,40" fill="#fef08a"/>
    <rect x="23" y="25" width="5" height="3" rx="1" fill="#fde047"/>
    <rect x="36" y="25" width="5" height="3" rx="1" fill="#fde047"/>
`;
    } else if (monster.typeKey === 'air') {
        body = `
    <polygon points="10,36 22,28 42,28 54,36 42,46 22,46" fill="#0369a1" stroke="#082f49" stroke-width="1.8"/>
    <path d="M21 30 Q21 15 32 15 Q43 15 43 30 Z" fill="#7dd3fc" stroke="#0c4a6e" stroke-width="1.5"/>
    <ellipse cx="29" cy="21" rx="4" ry="2" fill="#ffffff" fill-opacity="0.7"/>
    <circle cx="23" cy="37" r="2.3" fill="#fde047"/><circle cx="32" cy="37" r="2.3" fill="#fde047"/><circle cx="41" cy="37" r="2.3" fill="#fde047"/>
    <polygon points="26,46 38,46 32,53" fill="#f97316"/>
`;
    } else if (monster.typeKey === 'hound') {
        body = `
    <polygon points="12,41 24,25 22,12 31,21 40,12 39,24 52,32 45,42 42,53 33,44 24,53 20,43" fill="#0891b2" stroke="#083344" stroke-width="1.8"/>
    <polygon points="24,27 39,24 47,32 35,36 21,36" fill="#67e8f9" fill-opacity="0.65"/>
    <polygon points="8,36 17,32 15,40" fill="#a5f3fc"/>
    <circle cx="40" cy="29" r="2.2" fill="#fef08a"/>
`;
    } else if (monster.typeKey === 'slime') {
        body = `
    <path d="M12 45 Q13 17 32 16 Q51 17 52 45 Q51 54 32 54 Q13 54 12 45 Z" fill="#16a34a" stroke="#052e16" stroke-width="1.8"/>
    <path d="M14 45 Q32 51 50 45 Q47 52 32 53 Q17 52 14 45 Z" fill="#15803d"/>
    <path d="M19 28 Q23 20 31 20" fill="none" stroke="#bbf7d0" stroke-width="3" stroke-linecap="round"/>
    <circle cx="25" cy="39" r="3" fill="#4ade80" fill-opacity="0.75"/>
    <circle cx="25" cy="34" r="3" fill="#052e16"/><circle cx="39" cy="34" r="3" fill="#052e16"/>
    <circle cx="26" cy="33" r="1.1" fill="#ffffff"/><circle cx="40" cy="33" r="1.1" fill="#ffffff"/>
`;
    } else if (monster.typeKey === 'golem') {
        body = `
    <polygon points="11,45 14,19 24,14 40,14 50,19 53,45 45,54 19,54" fill="#475569" stroke="#0f172a" stroke-width="2"/>
    <polygon points="17,19 47,19 44,33 20,33" fill="#94a3b8"/>
    <polygon points="21,21 43,21 40,28 24,28" fill="#cbd5e1" fill-opacity="0.6"/>
    <rect x="23" y="25" width="18" height="4.5" rx="2" fill="#0f172a"/>
    <rect x="25" y="26.2" width="14" height="2.2" rx="1" fill="#fb923c"/>
    <circle cx="17" cy="24" r="2" fill="#e2e8f0"/><circle cx="47" cy="24" r="2" fill="#e2e8f0"/>
`;
    } else {
        // wood: 蔓藤巨魔 (default)
        body = `
    <polygon points="15,47 18,22 46,22 49,47 41,54 23,54" fill="#5c4028" stroke="#1e130b" stroke-width="1.8"/>
    <polygon points="16,24 25,13 32,19 39,13 48,24 38,29 26,29" fill="#15803d" stroke="#052e16" stroke-width="1.4"/>
    <polygon points="23,35 32,31 41,35 37,46 27,46" fill="#22c55e" fill-opacity="0.5"/>
    <circle cx="25" cy="31" r="2.4" fill="#fde047"/><circle cx="39" cy="31" r="2.4" fill="#fde047"/>
`;
    }

    return `<svg class="m-svg" viewBox="0 0 64 64" aria-hidden="true">${shadow}${body}</svg>`;
}

function createMonsterDom(monster) {
    const el = document.createElement('div');
    el.classList.add('monster-unit');
    if (monster.isElite) el.classList.add('elite');
    if (monster.isBoss) el.classList.add('boss');
    if (monster.isSplitChild) el.classList.add('mini-slime');

    const armorHtml = monster.armor > 0
        ? `<span class="m-armor-badge">🛡️${monster.armor}</span>`
        : '';
    const weakCfg = ELEMENT_CONFIG[monster.weakness];
    const weakShort = weakCfg ? `${weakCfg.icon}${weakCfg.name.charAt(0)}` : '';
    const bossHtml = monster.isBoss
        ? `<span class="m-boss-badge weak-${monster.weakness}">👑弱${weakShort}</span>`
        : '';

    el.innerHTML = `
<span class="m-slow-badge">❄️</span>
${armorHtml}
<span class="m-icon">${createMonsterSvgHtml(monster)}</span>
<div class="m-hp-bar">
    <div class="m-hp-fill"></div>
</div>
${bossHtml}
`;

    monsterLayerEl.appendChild(el);
    monsterDomMap.set(monster.id, el);
    return el;
}

function renderMonsterLayer() {
    if (!monsterLayerEl) return;

    const activeIds = new Set(monsters.map(m => m.id));
    for (const [id, el] of monsterDomMap.entries()) {
        if (!activeIds.has(id)) {
            el.remove();
            monsterDomMap.delete(id);
        }
    }

    for (let i = 0; i < monsters.length; i++) {
        const m = monsters[i];
        const el = monsterDomMap.get(m.id) || createMonsterDom(m);

        el.style.left = `${m.pixelX}px`;
        el.style.top = `${m.pixelY}px`;
        el.classList.toggle('slowed', m.slowTimer > 0);
        el.classList.toggle('rooted', (m.rootTimer || 0) > 0);

        if (m.armor > 0) {
            const armorBadge = el.querySelector('.m-armor-badge');
            if (armorBadge) {
                const isShredded = m.armorShredTimer > 0;
                armorBadge.classList.toggle('shredded', isShredded);
                armorBadge.innerText = isShredded
                    ? `🔥${Math.round(getMonsterEffectiveArmor(m))}`
                    : `🛡️${m.armor}`;
            }
        }

        const hpPercent = Math.max(0, (m.hp / m.maxHp) * 100);
        const fillEl = el.querySelector('.m-hp-fill');
        if (fillEl) {
            fillEl.style.width = `${hpPercent}%`;
            if (hpPercent <= 25) {
                fillEl.style.backgroundColor = '#e74c3c';
            } else if (hpPercent <= 55) {
                fillEl.style.backgroundColor = '#f39c12';
            } else {
                fillEl.style.backgroundColor = '#2ecc71';
            }
        }
    }

    updateBossStatusBar();
}

function repositionAllMonsters() {
    for (let i = 0; i < monsters.length; i++) {
        const m = monsters[i];
        const pos = getCellCenter(m.gridX, m.gridY);
        m.pixelX = pos.left + (m.visualOffsetX || 0);
        m.pixelY = pos.top + (m.visualOffsetY || 0);
    }
    renderMonsterLayer();
}

function updateMonsters(dtMs) {
    const dtSec = dtMs / 1000;

    for (let i = monsters.length - 1; i >= 0; i--) {
        const m = monsters[i];

        if (m.slowTimer > 0) {
            m.slowTimer = Math.max(0, m.slowTimer - dtMs);
            if (m.slowTimer === 0) m.slowRate = 0;
        }
        if (m.armorShredTimer > 0) {
            m.armorShredTimer = Math.max(0, m.armorShredTimer - dtMs);
            if (m.armorShredTimer === 0) m.armorShredRate = 0;
        }
        if ((m.rootTimer || 0) > 0) {
            m.rootTimer = Math.max(0, m.rootTimer - dtMs);
            if (m.rootTimer === 0) m.rootVulnRate = 0;
        }

        const activeSlowRate = m.slowTimer > 0 ? (m.slowRate || CONFIG.ICE_SLOW_RATE) : 0;
        const slowMult = (m.rootTimer || 0) > 0 ? 0 : (1 - activeSlowRate);
        let remainingStep = m.baseSpeed * slowMult * dtSec;
        let reachedEnd = false;

        while (remainingStep > 0) {
            const targetWp = WAYPOINTS[m.wpIndex + 1];
            if (!targetWp) {
                reachedEnd = true;
                break;
            }

            const dx = targetWp.x - m.gridX;
            const dy = targetWp.y - m.gridY;
            const dist = Math.hypot(dx, dy);

            if (dist <= remainingStep) {
                m.gridX = targetWp.x;
                m.gridY = targetWp.y;
                m.wpIndex++;
                remainingStep -= dist;
                if (m.wpIndex >= WAYPOINTS.length - 1) {
                    reachedEnd = true;
                    break;
                }
            } else {
                m.gridX += (dx / dist) * remainingStep;
                m.gridY += (dy / dist) * remainingStep;
                remainingStep = 0;
            }
        }

        if (reachedEnd) {
            const leakDmg = m.baseDamage || 1;
            lastBreakerName = m.name || '';
            baseHp = Math.max(0, baseHp - leakDmg);
            msgText.innerText = m.isBoss
                ? `💥 【${m.name}】突破防線！🌳 世界樹遭受重創 -${leakDmg} 生命！`
                : `🚨 怪物【${m.name}】突破防線！🌳 世界樹受損 -${leakDmg} 生命！`;
            monsters.splice(i, 1);
            removeMonsterDom(m.id);
            triggerWorldTreeShake();
            SoundEngine.playOutcome('treeHit');
            updateHUD();

            if (baseHp <= 0) {
                triggerGameOver();
                return;
            }
            continue;
        }

        const pos = getCellCenter(m.gridX, m.gridY);
        m.pixelX = pos.left + (m.visualOffsetX || 0);
        m.pixelY = pos.top + (m.visualOffsetY || 0);
    }

    renderMonsterLayer();
}

// ==================== 9. 主遊戲迴圈與勝負結算（Victory / Game Over / 圖鑑暫停） ====================
function triggerVictory() {
    if (isGameOver || waveState === 'VICTORY') return;
    isPaused = false;
    waveState = 'VICTORY';

    if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
    }

    clearAllGameTimers();
    clearTouchDragVisuals();
    draggedIndex = null;
    hoveredIndex = null;
    updateRangeIndicator();

    let starsNum = 1;
    let stars = '⭐';
    let rankText = '驚險死守！於危急時刻擊退腐朽古樹王！';
    if (baseHp >= CONFIG.INITIAL_BASE_HP) {
        starsNum = 3;
        stars = '⭐⭐⭐';
        rankText = '完美防守！🌳 世界樹滿血守護通關第 10 波！';
    } else if (baseHp >= 10) {
        starsNum = 2;
        stars = '⭐⭐';
        rankText = '穩固防線！成功守護 🌳 世界樹擊敗腐朽古樹王！';
    }

    saveMapRecord(currentMapId, currentWave, starsNum);
    bestWave = Math.max(bestWave, currentWave);
    renderMapSelectorUI();
    updateHUD();
    SoundEngine.playOutcome('victory');

    if (victoryStarsEl) victoryStarsEl.innerText = stars;
    if (victoryRankTextEl) victoryRankTextEl.innerText = rankText;
    populateBattleRecap('victory');
    if (victoryOverlayEl) {
        victoryOverlayEl.classList.remove('hidden');
    }
}

function continueEndlessMode() {
    if (waveState !== 'VICTORY') return;
    isEndlessMode = true;
    isPaused = false;

    if (victoryOverlayEl) {
        victoryOverlayEl.classList.add('hidden');
    }

    waveState = 'INTERMISSION';
    waveTimerMs = CONFIG.WAVE_INTERMISSION_MS;
    msgText.innerText = '🔥 無盡模式開啟！已解除波數上限，繼續挑戰更高紀錄吧！';
    updateHUD();
    startMainLoop();
}

function startGame() {
    if (waveState !== 'WAITING_START') return;

    if (startOverlayEl) {
        startOverlayEl.classList.add('hidden');
    }

    const mapSpec = getCurrentMapSpec();
    isPaused = false;
    waveState = 'PREP';
    waveTimerMs = CONFIG.INITIAL_PREP_MS;
    msgText.innerText = `【${mapSpec.name}】備戰開始！先點空草地可指定落點，點擊或拖曳同星元素可跨階融合！`;
    updateHUD();
    startMainLoop();
}

function triggerGameOver() {
    if (isGameOver) return;
    isPaused = false;
    isGameOver = true;
    waveState = 'GAMEOVER';

    if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
    }

    clearAllGameTimers();
    clearTouchDragVisuals();
    draggedIndex = null;
    hoveredIndex = null;
    updateRangeIndicator();
    updateHUD();
    SoundEngine.playOutcome('gameover');

    if (finalWaveTextEl) {
        finalWaveTextEl.innerText = isEndlessMode
            ? `Wave ${currentWave} (無盡)`
            : `Wave ${currentWave} / ${CONFIG.VICTORY_WAVE}`;
    }
    if (finalBestTextEl) finalBestTextEl.innerText = `Wave ${bestWave}`;
    if (finalKillsTextEl) finalKillsTextEl.innerText = `${killsCount} 隻`;
    populateBattleRecap('gameover');
    if (newRecordBadgeEl) {
        newRecordBadgeEl.classList.toggle('hidden', !isNewRecordThisRun);
    }
    if (gameOverOverlayEl) {
        gameOverOverlayEl.classList.remove('hidden');
    }
}

function restartGame() {
    if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
    }

    // 遞增局數識別並清空上一局所有未執行計時器與 Canvas 特效
    sessionId++;
    clearAllGameTimers();

    const mapSpec = getCurrentMapSpec();
    currentGold = CONFIG.INITIAL_GOLD + (mapSpec.startGoldBonus || 0);
    baseHp = CONFIG.INITIAL_BASE_HP;
    dewEnergy = CONFIG.DEW_INITIAL;
    entangleCdMs = 0;
    frenzyCdMs = 0;
    frenzyActiveMs = 0;
    activeBlessings.clear();
    blessingGrantedWaves.clear();
    blessingChoices = [];
    seedPityCount = 0;
    leafEmitAccMs = 0;
    frenzyFxAccMs = 0;
    if (boardStageEl) boardStageEl.classList.remove('tree-hit-shake');
    if (treeHitShakeTimer) {
        clearTimeout(treeHitShakeTimer);
        treeHitShakeTimer = null;
    }
    bestWave = getMapBestWave(currentMapId);
    currentWave = 1;
    killsCount = 0;
    towerPhaseSeq = 0;
    towerUidCounter = 1;
    totalTeamDamage = 0;
    totalGoldEarned = 0;
    fusionCount = 0;
    peakTowerSnapshot = null;
    lastBreakerName = '';
    isPaused = false;
    isGameOver = false;
    isEndlessMode = false;
    isNewRecordThisRun = false;

    spawnCounts = { fire: 0, ice: 0, thunder: 0 };
    board = Array(CONFIG.BOARD_SIZE).fill(null);
    monsters = [];
    monsterIdCounter = 1;

    for (const el of monsterDomMap.values()) {
        el.remove();
    }
    monsterDomMap.clear();
    if (monsterLayerEl) monsterLayerEl.innerHTML = '';
    if (floatingLayerEl) floatingLayerEl.innerHTML = '';

    clearTouchDragVisuals();
    draggedIndex = null;
    selectedIndex = null;
    buildTargetIndex = null;
    hoveredIndex = null;

    waveState = 'PREP';
    waveTimerMs = CONFIG.INITIAL_PREP_MS;
    waveSpawnQueue = [];
    waveSpawnAccMs = 0;
    lastFrameTime = null;

    if (startOverlayEl) startOverlayEl.classList.add('hidden');
    if (victoryOverlayEl) victoryOverlayEl.classList.add('hidden');
    if (gameOverOverlayEl) gameOverOverlayEl.classList.add('hidden');
    if (codexOverlayEl) codexOverlayEl.classList.add('hidden');
    if (blessingOverlayEl) blessingOverlayEl.classList.add('hidden');

    msgText.innerText = `【${mapSpec.name}】開局可召喚元素塔並拖曳或點擊融合；點擊圖鑑按鈕或按 1/2/3/Q/W/Space 快速操作！`;
    renderBoard();
    updateHUD();
    updateSpeedButtonUI();
    startMainLoop();
}

function gameTick(timestamp) {
    if (!isGameplayActive()) return;

    if (lastFrameTime === null) {
        lastFrameTime = timestamp;
    }
    const rawDt = Math.min(0.1, Math.max(0, (timestamp - lastFrameTime) / 1000));
    lastFrameTime = timestamp;
    const dt = rawDt * gameSpeed;
    const dtMs = dt * 1000;

    // 0. 世界樹主動技能冷卻與持續時間推進
    entangleCdMs = Math.max(0, entangleCdMs - dtMs);
    frenzyCdMs = Math.max(0, frenzyCdMs - dtMs);
    const wasFrenzyActive = frenzyActiveMs > 0;
    frenzyActiveMs = Math.max(0, frenzyActiveMs - dtMs);
    if (wasFrenzyActive && frenzyActiveMs === 0) {
        for (let i = 0; i < towerElements.length; i++) {
            if (towerElements[i]) towerElements[i].classList.remove('frenzy-active');
        }
        updateTowerInspector();
    }
    if (entangleCdMs > 0 || frenzyCdMs > 0 || wasFrenzyActive) {
        updateSkillButtonsUI();
    }

    // 1. 波次狀態推進
    if (waveState === 'PREP' || waveState === 'INTERMISSION') {
        const prevSec = Math.ceil(waveTimerMs / 1000);
        waveTimerMs -= dtMs;
        const nextSec = Math.ceil(waveTimerMs / 1000);

        if (waveTimerMs <= 0) {
            const targetWave = waveState === 'PREP' ? 1 : currentWave + 1;
            startWave(targetWave);
        } else if (prevSec !== nextSec) {
            updateWavePhaseUI();
        }
    } else if (waveState === 'SPAWNING') {
        waveSpawnAccMs += dtMs;
        while (waveSpawnAccMs >= waveSpawnIntervalMs && waveSpawnQueue.length > 0) {
            waveSpawnAccMs -= waveSpawnIntervalMs;
            const nextEntry = waveSpawnQueue.shift();
            spawnMonsterFromEntry(nextEntry);
            if (waveSpawnQueue.length === 0) {
                waveState = 'CLEARING';
                updateWavePhaseUI();
            }
        }
    } else if (waveState === 'CLEARING') {
        if (monsters.length === 0) {
            if (!isEndlessMode && currentWave === CONFIG.VICTORY_WAVE) {
                triggerVictory();
                return;
            }

            if (
                currentWave % CONFIG.BLESSING_INTERVAL_WAVES === 0
                && !blessingGrantedWaves.has(currentWave)
                && triggerBlessingSelection(currentWave)
            ) {
                return;
            }

            waveState = 'INTERMISSION';
            waveTimerMs = CONFIG.WAVE_INTERMISSION_MS;
            msgText.innerText = `🎉 第 ${currentWave} 波防禦成功！下一波將於 ${Math.ceil(CONFIG.WAVE_INTERMISSION_MS / 1000)} 秒後出發！`;
            updateWavePhaseUI();
        }
    }

    // 2. 怪物移動更新
    if (monsters.length > 0) {
        updateMonsters(dtMs);
        if (isGameOver) return;
    }

    // 3. 防禦塔獨立冷卻與延遲閃電連擊
    updateTowersCombat(dtMs);

    // 4. Canvas 2D 特效與受擊閃白繪製
    updateAndRenderCanvasFX(dtMs);

    rafId = requestAnimationFrame(gameTick);
}

function startMainLoop() {
    if (rafId !== null) cancelAnimationFrame(rafId);
    lastFrameTime = null;
    rafId = requestAnimationFrame(gameTick);
}

// ==================== 10. 棋盤一次性初始化與局部增量渲染 ====================
function clearCellDragHighlights() {
    for (let i = 0; i < cellElements.length; i++) {
        cellElements[i].classList.remove('drag-over', 'drag-invalid');
    }
}

function clearTouchDragVisuals() {
    if (touchDragState && touchDragState.ghostEl) {
        touchDragState.ghostEl.remove();
    }
    clearCellDragHighlights();
    for (let i = 0; i < towerElements.length; i++) {
        if (towerElements[i]) towerElements[i].classList.remove('dragging');
    }
    touchDragState = null;
}

function createTowerSvgParts(type, tier) {
    const basePalette = {
        fire: { rune: '#f97316', glow: '#fde047' },
        ice: { rune: '#38bdf8', glow: '#e0f2fe' },
        thunder: { rune: '#a855f7', glow: '#f0abfc' },
        steam: { rune: '#fb923c', glow: '#7dd3fc' },
        magnet: { rune: '#22d3ee', glow: '#c084fc' },
        plasma: { rune: '#f472b6', glow: '#fef08a' }
    }[type] || { rune: '#cbd5e1', glow: '#f8fafc' };

    const crownTrim = tier >= 3
        ? '<polygon points="18,14 46,14 52,24 52,36 45,45 19,45 12,36 12,24" fill="none" stroke="#fbbf24" stroke-width="1.6"/>'
        : '';
    const cornerGems = tier >= 2
        ? `<circle cx="32" cy="17" r="2.2" fill="${basePalette.glow}"/>
   <circle cx="48" cy="30" r="2.2" fill="${basePalette.glow}"/>
   <circle cx="32" cy="42" r="2.2" fill="${basePalette.glow}"/>
   <circle cx="16" cy="30" r="2.2" fill="${basePalette.glow}"/>`
        : `<circle cx="20" cy="20" r="1.4" fill="#a89984"/>
   <circle cx="44" cy="20" r="1.4" fill="#a89984"/>
   <circle cx="20" cy="40" r="1.4" fill="#a89984"/>
   <circle cx="44" cy="40" r="1.4" fill="#a89984"/>`;

    const baseSvgHtml = `<svg class="tower-base-svg" viewBox="0 0 64 64" aria-hidden="true">
<ellipse cx="32" cy="53" rx="23" ry="8" fill="rgba(0,0,0,0.45)"/>
<polygon points="15,22 49,22 55,33 55,44 47,53 17,53 9,44 9,33" fill="#2c241f" stroke="#120e0b" stroke-width="2"/>
<polygon points="9,44 17,53 17,43 11,35" fill="#1e1815"/>
<polygon points="55,44 47,53 47,43 53,35" fill="#3a3029"/>
<polygon points="18,14 46,14 52,24 52,36 45,45 19,45 12,36 12,24" fill="#574a40" stroke="#756558" stroke-width="1.4"/>
<polyline points="14,24 19,15 45,15 50,24" fill="none" stroke="rgba(255,244,218,0.34)" stroke-width="1.5"/>
${crownTrim}
<circle cx="32" cy="30" r="14" fill="#211a16" stroke="#120d0b" stroke-width="1.5"/>
<circle cx="32" cy="30" r="11.5" fill="none" stroke="${basePalette.rune}" stroke-width="${tier >= 3 ? 2.4 : (tier === 2 ? 1.9 : 1.4)}" stroke-opacity="${tier === 1 ? 0.65 : 0.92}"/>
${cornerGems}
</svg>`;

    let headBody = '';
    if (type === 'fire') {
        const wingFins = tier >= 3
            ? '<polygon points="14,40 22,25 24,42" fill="#b91c1c" stroke="#450a0a" stroke-width="1.2"/><polygon points="50,40 42,25 40,42" fill="#b91c1c" stroke="#450a0a" stroke-width="1.2"/>'
            : '';
        const sidePods = tier >= 2
            ? '<rect x="16.5" y="30" width="5" height="11" rx="2" fill="#f59e0b" stroke="#451a03" stroke-width="1.2"/><rect x="42.5" y="30" width="5" height="11" rx="2" fill="#f59e0b" stroke="#451a03" stroke-width="1.2"/>'
            : '';
        headBody = `
    <ellipse cx="33" cy="35" rx="13" ry="12" fill="rgba(0,0,0,0.32)"/>
    ${wingFins}
    <polygon points="27,7 37,7 39,30 25,30" fill="#7c2d12" stroke="#270e05" stroke-width="1.6"/>
    <rect x="29" y="9" width="3" height="19" rx="1" fill="#fb923c" fill-opacity="0.55"/>
    <polygon points="24.5,6 39.5,6 37.5,12 26.5,12" fill="#f59e0b" stroke="#451a03" stroke-width="1.4"/>
    <ellipse cx="32" cy="7" rx="4.5" ry="2.2" fill="#fef08a"/>
    ${sidePods}
    <polygon points="22,26 42,26 45,38 38,46 26,46 19,38" fill="#dc2626" stroke="#450a0a" stroke-width="1.8"/>
    <polygon points="24,27 40,27 42,35 32,33 22,35" fill="#f87171" fill-opacity="0.45"/>
    <circle cx="32" cy="36" r="${tier >= 3 ? 6.4 : 5}" fill="#f97316" stroke="#7c2d12" stroke-width="1.3"/>
    <circle cx="31" cy="34.5" r="${tier >= 3 ? 3.2 : 2.3}" fill="#fef08a"/>
`;
    } else if (type === 'ice') {
        const sideShards = tier >= 2
            ? '<polygon points="18,16 24,28 19,38 14,32" fill="#38bdf8" stroke="#0c4a6e" stroke-width="1.3"/><polygon points="46,16 40,28 45,38 50,32" fill="#0284c7" stroke="#0c4a6e" stroke-width="1.3"/>'
            : '';
        const crownGold = tier >= 3
            ? '<polygon points="16,40 21,36 22,44" fill="#fbbf24"/><polygon points="48,40 43,36 42,44" fill="#fbbf24"/>'
            : '';
        headBody = `
    <ellipse cx="33" cy="35" rx="12" ry="12" fill="rgba(0,0,0,0.30)"/>
    ${sideShards}
    <polygon points="32,4 39,28 32,34 25,28" fill="#7dd3fc" stroke="#075985" stroke-width="1.6"/>
    <polygon points="32,4 32,34 25,28" fill="#e0f2fe" fill-opacity="0.72"/>
    ${crownGold}
    <polygon points="21,28 43,28 46,39 32,47 18,39" fill="#0369a1" stroke="#082f49" stroke-width="1.7"/>
    <polygon points="24,30 40,30 32,41" fill="#38bdf8" fill-opacity="0.5"/>
    <polygon points="32,29 38,36 32,43 26,36" fill="${tier >= 3 ? '#ffffff' : '#bae6fd'}" stroke="#0284c7" stroke-width="1.3"/>
`;
    } else if (type === 'thunder') {
        const lv3Orb = tier >= 3
            ? '<circle cx="32" cy="40" r="4.5" fill="#f0abfc" stroke="#ffffff" stroke-width="1.2"/>'
            : '';
        headBody = `
    <ellipse cx="33" cy="36" rx="13" ry="11" fill="rgba(0,0,0,0.32)"/>
    <polygon points="20,9 25,9 26,30 20,30" fill="#7e22ce" stroke="#2e1065" stroke-width="1.4"/>
    <polygon points="39,9 44,9 44,30 38,30" fill="#6b21a8" stroke="#2e1065" stroke-width="1.4"/>
    <circle cx="22.5" cy="9" r="3.4" fill="#fde047" stroke="#713f12" stroke-width="1.1"/>
    <circle cx="41.5" cy="9" r="3.4" fill="#fde047" stroke="#713f12" stroke-width="1.1"/>
    <polyline points="23,9 29,6 33,12 41,9" fill="none" stroke="#fef08a" stroke-width="${tier >= 3 ? 2.4 : 1.7}" stroke-linecap="round" stroke-linejoin="round"/>
    <polygon points="32,12 35,28 29,28" fill="#c084fc" stroke="#3b0764" stroke-width="1.2"/>
    <polygon points="19,28 45,28 47,40 39,47 25,47 17,40" fill="#581c87" stroke="#2e1065" stroke-width="1.8"/>
    <rect x="23" y="30" width="18" height="4" rx="2" fill="#f59e0b"/>
    <rect x="25" y="36" width="14" height="3.5" rx="1.5" fill="${tier >= 2 ? '#fde047' : '#d97706'}"/>
    ${lv3Orb}
`;
    } else if (type === 'steam') {
        headBody = `
    <ellipse cx="33" cy="36" rx="14" ry="11" fill="rgba(0,0,0,0.34)"/>
    <rect x="23" y="7" width="8" height="22" rx="2.5" fill="#9a3412" stroke="#270e05" stroke-width="1.4"/>
    <rect x="33" y="7" width="8" height="22" rx="2.5" fill="#0369a1" stroke="#082f49" stroke-width="1.4"/>
    <rect x="21" y="6" width="22" height="5" rx="2" fill="#cbd5e1" stroke="#334155" stroke-width="1.3"/>
    <circle cx="27" cy="8.5" r="2.1" fill="#fed7aa"/><circle cx="37" cy="8.5" r="2.1" fill="#e0f2fe"/>
    <polygon points="18,27 32,27 32,47 23,46 16,38" fill="#ea580c" stroke="#431407" stroke-width="1.6"/>
    <polygon points="32,27 46,27 48,38 41,46 32,47" fill="#0284c7" stroke="#082f49" stroke-width="1.6"/>
    <circle cx="32" cy="36" r="${tier >= 3 ? 6.4 : 5.4}" fill="#f8fafc" stroke="#334155" stroke-width="1.5"/>
    <circle cx="32" cy="36" r="2.8" fill="${tier >= 3 ? '#fbbf24' : '#fb7185'}"/>
`;
    } else if (type === 'magnet') {
        headBody = `
    <ellipse cx="33" cy="36" rx="14" ry="11" fill="rgba(0,0,0,0.32)"/>
    <polygon points="18,6 25,6 26,33 17,37" fill="#06b6d4" stroke="#164e63" stroke-width="1.5"/>
    <polygon points="46,6 39,6 38,33 47,37" fill="#7c3aed" stroke="#2e1065" stroke-width="1.5"/>
    <polygon points="20,8 23,8 23,28 20,28" fill="#a5f3fc" fill-opacity="0.72"/>
    <polygon points="41,8 44,8 44,28 41,28" fill="#ddd6fe" fill-opacity="0.72"/>
    <circle cx="32" cy="16" r="5" fill="#22d3ee" fill-opacity="0.85" stroke="#f0abfc" stroke-width="1.5"/>
    <circle cx="32" cy="16" r="2.2" fill="#ffffff"/>
    <polygon points="21,30 43,30 47,39 39,47 25,47 17,39" fill="#1e1b4b" stroke="#0ea5e9" stroke-width="1.6"/>
    <circle cx="32" cy="38" r="${tier >= 3 ? 6 : 5}" fill="#a855f7" stroke="#67e8f9" stroke-width="1.5"/>
`;
    } else {
        // plasma (電漿聚焦塔)
        headBody = `
    <ellipse cx="33" cy="36" rx="14" ry="11" fill="rgba(0,0,0,0.35)"/>
    <polygon points="14,34 25,21 26,41 18,43" fill="#be185d" stroke="#500724" stroke-width="1.4"/>
    <polygon points="50,34 39,21 38,41 46,43" fill="#be185d" stroke="#500724" stroke-width="1.4"/>
    <polygon points="32,5 37,27 27,27" fill="#fde047" stroke="#9d174d" stroke-width="1.5"/>
    <polygon points="32,8 34,26 30,26" fill="#ffffff" fill-opacity="0.82"/>
    <ellipse cx="32" cy="20" rx="8" ry="3.2" fill="none" stroke="#f472b6" stroke-width="2"/>
    <polygon points="22,27 42,27 44,39 32,48 20,39" fill="#831843" stroke="#fbbf24" stroke-width="1.6"/>
    <circle cx="32" cy="36" r="${tier >= 3 ? 6.4 : 5.2}" fill="#f43f5e" stroke="#fef08a" stroke-width="1.6"/>
    <circle cx="31.5" cy="35" r="2.4" fill="#ffffff"/>
`;
    }

    const headSvgHtml = `<svg class="tower-head-svg" viewBox="0 0 64 64" aria-hidden="true">${headBody}</svg>`;
    return { baseSvgHtml, headSvgHtml };
}

function createTowerElement(towerObj, index) {
    const cfg = ELEMENT_CONFIG[towerObj.type];
    const tower = document.createElement('div');
    tower.classList.add('tower', `type-${towerObj.type}`, `lv-${towerObj.tier}`);
    if (frenzyActiveMs > 0) tower.classList.add('frenzy-active');
    tower.setAttribute('draggable', true);

    tower.addEventListener('dragstart', () => {
        if (!isGameplayActive()) return;
        draggedIndex = index;
        selectedIndex = null;
        buildTargetIndex = null;
        tower.classList.add('dragging');
        updateRangeIndicator();
        updateTowerInspector();
        msgText.innerText = `抓起【${cfg.name} ${getTierStars(towerObj.tier)}】`;
    });

    tower.addEventListener('dragend', () => {
        tower.classList.remove('dragging');
        clearCellDragHighlights();
        draggedIndex = null;
        updateRangeIndicator();
    });

    tower.addEventListener('touchstart', (e) => {
        activateTouchMode();
        if (!isGameplayActive() || e.touches.length !== 1) return;
        const touch = e.touches[0];
        touchDragState = {
            sourceIndex: index,
            startX: touch.clientX,
            startY: touch.clientY,
            isDragging: false,
            ghostEl: null,
            towerEl: tower,
            cfg: cfg,
            tier: towerObj.tier
        };
    }, { passive: true });

    const { baseSvgHtml, headSvgHtml } = createTowerSvgParts(towerObj.type, towerObj.tier);

    const baseLayer = document.createElement('div');
    baseLayer.classList.add('tower-base-layer');
    baseLayer.innerHTML = baseSvgHtml;

    const headRotator = document.createElement('div');
    headRotator.classList.add('tower-head-rotator');
    headRotator.style.transform = `rotate(${towerObj.aimAngleDeg || 0}deg)`;

    const headRecoil = document.createElement('div');
    headRecoil.classList.add('tower-head-recoil');
    headRecoil.innerHTML = headSvgHtml;
    headRotator.appendChild(headRecoil);

    const name = document.createElement('div');
    name.classList.add('tower-name');
    name.innerText = getTierStars(towerObj.tier);

    tower.appendChild(baseLayer);
    tower.appendChild(headRotator);
    tower.appendChild(name);
    return tower;
}

function renderCellTower(index) {
    const cell = cellElements[index];
    if (!cell) return;

    const existingTowerEl = towerElements[index];
    if (existingTowerEl) {
        existingTowerEl.remove();
        towerElements[index] = null;
    }

    const towerObj = board[index];
    if (towerObj !== null) {
        const newTowerEl = createTowerElement(towerObj, index);
        towerElements[index] = newTowerEl;
        cell.appendChild(newTowerEl);
    }
}

function initBoard() {
    boardElement.innerHTML = '';
    cellElements.length = 0;
    towerElements.fill(null);
    lastRenderedSelected = null;
    lastRenderedBuildTarget = null;

    for (let index = 0; index < CONFIG.BOARD_SIZE; index++) {
        const cell = document.createElement('div');
        cell.classList.add('cell');
        cell.dataset.index = index;

        if (PATH_CELL_INDICES.has(index)) {
            cell.classList.add('path-cell');
            if (index === START_CELL_INDEX) cell.classList.add('path-start');
            if (index === END_CELL_INDEX) cell.classList.add('path-end');

            if (PATH_FLOW_ARROWS.has(index)) {
                const arrow = document.createElement('span');
                arrow.classList.add('path-arrow');
                arrow.style.transform = `rotate(${PATH_FLOW_ARROWS.get(index)}deg)`;
                arrow.innerText = '▸';
                cell.appendChild(arrow);
            }
        } else {
            const terrain = getTerrainAt(index);
            if (terrain) {
                const tCfg = TERRAIN_CONFIG[terrain];
                cell.classList.add(`terrain-${terrain}`);
                cell.setAttribute('title', tCfg.tooltip);

                const tag = document.createElement('span');
                tag.classList.add('terrain-tag');
                tag.innerText = tCfg.icon;
                cell.appendChild(tag);
            }
        }

        // 桌面滑鼠懸停顯示射程圈；觸控模式下完全停用懸停預覽
        cell.addEventListener('mouseenter', () => {
            if (isTouchMode) return;
            if (hoveredIndex !== index) {
                hoveredIndex = index;
                updateRangeIndicator();
            }
        });

        cell.addEventListener('mouseleave', () => {
            if (isTouchMode) return;
            if (hoveredIndex === index) {
                hoveredIndex = null;
                updateRangeIndicator();
            }
        });

        cell.addEventListener('dragover', (e) => {
            e.preventDefault();
            cell.classList.add(PATH_CELL_INDICES.has(index) ? 'drag-invalid' : 'drag-over');
        });

        cell.addEventListener('dragleave', () => {
            cell.classList.remove('drag-over', 'drag-invalid');
        });

        cell.addEventListener('drop', (e) => {
            e.preventDefault();
            cell.classList.remove('drag-over', 'drag-invalid');
            const fromIdx = draggedIndex;
            draggedIndex = null;
            handleAction(fromIdx, index);
        });

        cell.addEventListener('click', () => {
            if (performance.now() - lastTouchDragEndTime < 250) return;
            handleCellClick(index);
        });

        cellElements.push(cell);
        boardElement.appendChild(cell);
    }

    measureBoardMetrics();
}

function syncBoardSelectionClasses() {
    if (lastRenderedSelected !== null && lastRenderedSelected !== selectedIndex && cellElements[lastRenderedSelected]) {
        cellElements[lastRenderedSelected].classList.remove('selected');
    }
    if (selectedIndex !== null && cellElements[selectedIndex]) {
        cellElements[selectedIndex].classList.add('selected');
    }
    lastRenderedSelected = selectedIndex;

    if (lastRenderedBuildTarget !== null && lastRenderedBuildTarget !== buildTargetIndex && cellElements[lastRenderedBuildTarget]) {
        cellElements[lastRenderedBuildTarget].classList.remove('build-target');
    }
    if (buildTargetIndex !== null && cellElements[buildTargetIndex]) {
        cellElements[buildTargetIndex].classList.add('build-target');
    }
    lastRenderedBuildTarget = buildTargetIndex;
}

function renderBoard(dirtyIndices = null) {
    if (cellElements.length !== CONFIG.BOARD_SIZE || boardElement.children.length !== CONFIG.BOARD_SIZE) {
        initBoard();
    }

    syncBoardSelectionClasses();

    if (Array.isArray(dirtyIndices)) {
        const visited = new Set();
        for (let i = 0; i < dirtyIndices.length; i++) {
            const idx = dirtyIndices[i];
            if (idx >= 0 && idx < CONFIG.BOARD_SIZE && !visited.has(idx)) {
                visited.add(idx);
                renderCellTower(idx);
            }
        }
    } else {
        for (let idx = 0; idx < CONFIG.BOARD_SIZE; idx++) {
            renderCellTower(idx);
        }
        measureBoardMetrics();
    }

    updateRangeIndicator();
    updateTowerInspector();
}

// 全域觸控拖曳移動與放開處理
document.addEventListener('touchmove', (e) => {
    if (!touchDragState || e.touches.length !== 1) return;
    const touch = e.touches[0];
    const dist = Math.hypot(touch.clientX - touchDragState.startX, touch.clientY - touchDragState.startY);

    if (!touchDragState.isDragging && dist > 10) {
        touchDragState.isDragging = true;
        selectedIndex = null;
        buildTargetIndex = null;
        hoveredIndex = null;
        touchDragState.towerEl.classList.add('dragging');

        const ghost = touchDragState.towerEl.cloneNode(true);
        ghost.classList.remove('dragging');
        ghost.classList.add('touch-drag-ghost');
        ghost.style.width = `${touchDragState.towerEl.offsetWidth}px`;
        ghost.style.height = `${touchDragState.towerEl.offsetHeight}px`;
        document.body.appendChild(ghost);
        touchDragState.ghostEl = ghost;

        updateRangeIndicator();
        updateTowerInspector();
        msgText.innerText = `拖曳【${touchDragState.cfg.name} ${getTierStars(touchDragState.tier)}】至目標格`;
    }

    if (touchDragState.isDragging) {
        e.preventDefault();
        if (touchDragState.ghostEl) {
            touchDragState.ghostEl.style.left = `${touch.clientX}px`;
            touchDragState.ghostEl.style.top = `${touch.clientY}px`;
        }

        clearCellDragHighlights();
        const elUnder = document.elementFromPoint(touch.clientX, touch.clientY);
        const targetCell = elUnder ? elUnder.closest('.cell') : null;
        if (targetCell) {
            const targetIdx = Number(targetCell.dataset.index);
            targetCell.classList.add(PATH_CELL_INDICES.has(targetIdx) ? 'drag-invalid' : 'drag-over');
        }
    }
}, { passive: false });

document.addEventListener('touchend', (e) => {
    if (!touchDragState) return;
    const wasDragging = touchDragState.isDragging;
    const sourceIdx = touchDragState.sourceIndex;

    if (wasDragging) {
        const touch = e.changedTouches[0];
        const elUnder = touch ? document.elementFromPoint(touch.clientX, touch.clientY) : null;
        const targetCell = elUnder ? elUnder.closest('.cell') : null;

        clearTouchDragVisuals();
        lastTouchDragEndTime = performance.now();

        if (targetCell) {
            const targetIdx = Number(targetCell.dataset.index);
            handleAction(sourceIdx, targetIdx);
        } else {
            updateRangeIndicator();
        }
    } else {
        touchDragState = null;
    }
});

document.addEventListener('touchcancel', () => {
    if (!touchDragState) return;
    clearTouchDragVisuals();
    updateRangeIndicator();
});

function handleCellClick(index) {
    if (!isGameplayActive()) return;

    if (selectedIndex === null) {
        if (board[index] !== null) {
            selectedIndex = index;
            buildTargetIndex = null;
            const t = board[index];
            const cfg = ELEMENT_CONFIG[t.type];
            const terrain = getTerrainAt(index);
            const terrainMsg = terrain ? `｜地形：${TERRAIN_CONFIG[terrain].shortTag}` : '';
            msgText.innerText = `已選取【${cfg.name} ${getTierStars(t.tier)}】${terrainMsg}（可切換索敵、出售或點擊目標格融合/移動）`;
        } else if (!PATH_CELL_INDICES.has(index)) {
            selectedIndex = null;
            hoveredIndex = null;
            if (buildTargetIndex === index) {
                buildTargetIndex = null;
                msgText.innerText = '已取消指定建造位置。';
            } else {
                buildTargetIndex = index;
                const c = indexToCoords(index);
                const terrain = getTerrainAt(index);
                const tMsg = terrain ? `（${TERRAIN_CONFIG[terrain].shortTag}）` : '';
                msgText.innerText = `📍 已選定建造位置 (${c.x + 1},${c.y + 1})${tMsg}，請點擊下方元素召喚按鈕！`;
            }
        } else {
            selectedIndex = null;
            hoveredIndex = null;
            buildTargetIndex = null;
        }
    } else if (selectedIndex === index) {
        selectedIndex = null;
        hoveredIndex = null;
        buildTargetIndex = null;
        msgText.innerText = '已取消選取。';
    } else {
        const fromIdx = selectedIndex;
        selectedIndex = null;
        hoveredIndex = null;
        buildTargetIndex = null;
        handleAction(fromIdx, index);
        return;
    }

    renderBoard([]);
}

function handleAction(fromIndex, toIndex) {
    if (!isGameplayActive()) return;
    if (fromIndex === null || toIndex === null || fromIndex === toIndex) {
        renderBoard([]);
        return;
    }
    if (fromIndex < 0 || fromIndex >= CONFIG.BOARD_SIZE || toIndex < 0 || toIndex >= CONFIG.BOARD_SIZE) return;
    if (!board[fromIndex]) return;

    if (PATH_CELL_INDICES.has(toIndex)) {
        msgText.innerText = '⚠️ 該位置是怪物跑道，不能放置防禦塔！';
        renderBoard([]);
        return;
    }

    const fromTower = board[fromIndex];
    const toTower = board[toIndex];
    const dirtyCells = [];

    if (toTower === null) {
        // 備戰/休息期免費調度；戰鬥出怪/清場期間移動需花費 5 金幣
        if (!isRelocationFree()) {
            if (currentGold < CONFIG.COMBAT_MOVE_COST) {
                msgText.innerText = `⚠️ 戰鬥期間調度塔位需花費 ${CONFIG.COMBAT_MOVE_COST} 💰，金幣不足！`;
                renderBoard([]);
                return;
            }
            currentGold -= CONFIG.COMBAT_MOVE_COST;
            msgText.innerText = `🚚 戰術調度成功！花費 ${CONFIG.COMBAT_MOVE_COST} 💰。`;
        } else {
            msgText.innerText = '已免費移動塔的位置。';
        }
        board[toIndex] = fromTower;
        board[fromIndex] = null;
        dirtyCells.push(fromIndex, toIndex);
        renderBoard(dirtyCells);
        updateHUD();
        return;
    }

    const fusion = getFusionResult(fromTower, toTower);
    if (fusion) {
        const fromInvested = Number.isFinite(fromTower.investedGold)
            ? fromTower.investedGold
            : CONFIG.BASE_COST * Math.pow(2, fromTower.tier - 1);
        const toInvested = Number.isFinite(toTower.investedGold)
            ? toTower.investedGold
            : CONFIG.BASE_COST * Math.pow(2, toTower.tier - 1);
        const mergedInvested = fromInvested + toInvested;
        const mergedDamage = (fromTower.totalDamage || 0) + (toTower.totalDamage || 0);
        fusionCount++;
        const intervalMs = getTowerAttackInterval(fusion.type, toIndex);
        const carriedAcc = Math.max(0, Math.min(intervalMs - 120, Math.max(fromTower.accMs || 0, toTower.accMs || 0)));
        const inheritedMode = toTower.targetMode || fromTower.targetMode || 'first';

        const mergedTower = createTowerObj(fusion.type, fusion.tier, mergedInvested, carriedAcc, {
            targetMode: inheritedMode,
            totalDamage: mergedDamage
        });
        board[toIndex] = mergedTower;
        board[fromIndex] = null;
        dirtyCells.push(fromIndex, toIndex);

        if (mergedDamage > 0 && (!peakTowerSnapshot || mergedDamage >= peakTowerSnapshot.totalDamage)) {
            const fusedCfg = ELEMENT_CONFIG[fusion.type];
            peakTowerSnapshot = {
                uid: mergedTower.uid,
                type: mergedTower.type,
                tier: mergedTower.tier,
                name: fusedCfg ? fusedCfg.name : mergedTower.type,
                icon: fusedCfg ? fusedCfg.icon : '',
                totalDamage: mergedDamage
            };
        }

        const cfg = ELEMENT_CONFIG[fusion.type];
        let bonusHint = '';
        if (fusion.isCrossElement) {
            bonusHint = '【跨元素融合！】';
        } else if (fusion.tier === CONFIG.MAX_TIER) {
            if (fusion.type === 'fire') bonusHint = '【解鎖炎爆濺射 35%】';
            else if (fusion.type === 'ice') bonusHint = '【解鎖 60% 深度冰封＋群體寒霜】';
            else if (fusion.type === 'thunder') bonusHint = '【解鎖三連閃電】';
        }
        SoundEngine.playMerge(fusion.tier, fusion.isCrossElement);
        msgText.innerText = `✨ 融合成功！進化為【${cfg.name} ${getTierStars(fusion.tier)}】${bonusHint}`;
    } else if (fromTower.tier >= CONFIG.MAX_TIER || toTower.tier >= CONFIG.MAX_TIER) {
        msgText.innerText = `⚠️ ${getTierStars(CONFIG.MAX_TIER)} 已達最高星級，無法再融合！`;
    } else {
        msgText.innerText = '⚠️ 該組合無法融合（須同星級基礎元素，或相同元素/融合塔；詳見 📖 融合圖鑑）！';
    }

    renderBoard(dirtyCells);
}

// ==================== 11. 檢查列操作、融合圖鑑與按鈕監聽 ====================
function cycleSelectedTowerTargetMode() {
    if (!isGameplayActive() || selectedIndex === null || board[selectedIndex] === null) return;
    const t = board[selectedIndex];
    const curIdx = TARGET_MODE_CYCLE.indexOf(t.targetMode || 'first');
    t.targetMode = TARGET_MODE_CYCLE[(curIdx + 1) % TARGET_MODE_CYCLE.length];
    updateTowerInspector();
    msgText.innerText = `🎯 已將【${ELEMENT_CONFIG[t.type].name}】索敵優先級切換為：${TARGET_MODE_LABELS[t.targetMode]}`;
}

function sellSelectedTower() {
    if (!isGameplayActive() || selectedIndex === null || board[selectedIndex] === null) return;

    const sellIdx = selectedIndex;
    const t = board[sellIdx];
    const cfg = ELEMENT_CONFIG[t.type];
    const refund = getTowerSellRefund(t);

    currentGold += refund;
    board[sellIdx] = null;
    selectedIndex = null;
    hoveredIndex = null;
    buildTargetIndex = null;
    msgText.innerText = `💰 已出售【${cfg.name} ${getTierStars(t.tier)}】！退還 +${refund} 💰。`;

    renderBoard([sellIdx]);
    updateHUD();
}

function triggerEarlyNextWave() {
    if (!isGameplayActive()) return;
    if (waveState !== 'PREP' && waveState !== 'INTERMISSION') return;

    const bonus = getEarlyWaveBonus();
    currentGold += bonus;
    totalGoldEarned += bonus;
    const targetWave = waveState === 'PREP' ? 1 : currentWave + 1;
    startWave(targetWave, bonus);
}

function openCodex() {
    if (!codexOverlayEl) return;
    codexOverlayEl.classList.remove('hidden');
    if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
    }
}

function closeCodex() {
    if (!codexOverlayEl) return;
    codexOverlayEl.classList.add('hidden');
    if (isGameplayActive()) {
        startMainLoop();
    }
}

if (inspectorTargetBtn) inspectorTargetBtn.addEventListener('click', cycleSelectedTowerTargetMode);
if (inspectorSellBtn) inspectorSellBtn.addEventListener('click', sellSelectedTower);
if (nextWaveBtn) nextWaveBtn.addEventListener('click', triggerEarlyNextWave);
if (skillEntangleBtn) skillEntangleBtn.addEventListener('click', castEntangleSkill);
if (skillFrenzyBtn) skillFrenzyBtn.addEventListener('click', castFrenzySkill);
if (soundBtn) soundBtn.addEventListener('click', () => SoundEngine.toggleMute());
if (codexBtn) codexBtn.addEventListener('click', openCodex);
if (codexCloseBtn) codexCloseBtn.addEventListener('click', closeCodex);

if (addGoldBtn) {
    addGoldBtn.addEventListener('click', () => {
        if (!CONFIG.DEBUG_MODE || !isGameplayActive()) return;
        currentGold += 500;
        msgText.innerText = '🛠️ 已增加 500 💰！';
        updateHUD();
    });
}

if (clearGoldBtn) {
    clearGoldBtn.addEventListener('click', () => {
        if (!CONFIG.DEBUG_MODE || !isGameplayActive()) return;
        currentGold = 0;
        msgText.innerText = '🛠️ 金幣已歸零！';
        updateHUD();
    });
}

if (speedBtn) speedBtn.addEventListener('click', cycleGameSpeed);
if (startGameBtn) startGameBtn.addEventListener('click', startGame);
if (victoryRestartBtn) victoryRestartBtn.addEventListener('click', restartGame);
if (endlessBtn) endlessBtn.addEventListener('click', continueEndlessMode);
if (restartBtn) restartBtn.addEventListener('click', restartGame);

if (mapSelectorGridEl) {
    mapSelectorGridEl.addEventListener('click', (e) => {
        const card = e.target && e.target.closest ? e.target.closest('.map-card') : null;
        if (!card || !card.dataset.mapId) return;
        SoundEngine.ensureContext();
        selectMap(card.dataset.mapId);
    });
}

if (typeof document !== 'undefined') {
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        const targetEl = e.target;
        const tag = targetEl && targetEl.tagName ? targetEl.tagName.toUpperCase() : '';
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (targetEl && targetEl.isContentEditable)) {
            return;
        }

        const key = e.key || '';
        const lowerKey = key.toLowerCase();

        if (key === 'Escape') {
            if (isCodexOpen()) {
                e.preventDefault();
                closeCodex();
            } else if (isMatchPhaseActive() && (selectedIndex !== null || buildTargetIndex !== null)) {
                e.preventDefault();
                selectedIndex = null;
                buildTargetIndex = null;
                renderBoard([]);
                updateTowerInspector();
                updateRangeIndicator();
                if (msgText) msgText.innerText = '已取消選取格位。';
            }
            return;
        }

        if (!isMatchPhaseActive()) return;

        if (key === 'Tab' || lowerKey === 's') {
            e.preventDefault();
            SoundEngine.ensureContext();
            cycleGameSpeed();
            return;
        }

        if (key === ' ' || e.code === 'Space') {
            e.preventDefault();
            SoundEngine.ensureContext();
            if (waveState === 'PREP' || waveState === 'INTERMISSION') {
                if (!isPaused) triggerEarlyNextWave();
            } else if (waveState === 'SPAWNING' || waveState === 'CLEARING') {
                toggleCombatPause();
            }
            return;
        }

        if (!isGameplayActive()) return;

        if (key === '1' || e.code === 'Numpad1') {
            e.preventDefault();
            SoundEngine.ensureContext();
            handleSpawn('fire', document.getElementById('spawn-btn-fire'));
        } else if (key === '2' || e.code === 'Numpad2') {
            e.preventDefault();
            SoundEngine.ensureContext();
            handleSpawn('ice', document.getElementById('spawn-btn-ice'));
        } else if (key === '3' || e.code === 'Numpad3') {
            e.preventDefault();
            SoundEngine.ensureContext();
            handleSpawn('thunder', document.getElementById('spawn-btn-thunder'));
        } else if (lowerKey === 'q') {
            e.preventDefault();
            SoundEngine.ensureContext();
            castEntangleSkill();
        } else if (lowerKey === 'w') {
            e.preventDefault();
            SoundEngine.ensureContext();
            castFrenzySkill();
        }
    });
}

function handleBoardLayoutChange() {
    measureBoardMetrics();
    repositionAllMonsters();
    updateRangeIndicator();
}

window.addEventListener('resize', handleBoardLayoutChange);
if (typeof ResizeObserver !== 'undefined') {
    const ro = new ResizeObserver(handleBoardLayoutChange);
    ro.observe(boardElement);
}

// ==================== 12. 初始化啟動（保持 WAITING_START，待玩家按「開始防守」） ====================
applyDebugModeVisibility();
renderSpawnerButtons();
initBoard();
renderBoard();
renderMapSelectorUI();
updateHUD();
updateSpeedButtonUI();
updateSoundButtonUI();
