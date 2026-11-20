/**
 * ============================================================================
 * 【檔案名稱】：modules/routes/route_data.js
 * 【負責功能】：存放 15×10 棋盤尺寸、三地圖（晨光森林／熔岩峽谷／永凍裂谷）轉彎路徑點 waypoints、
 *               特殊地形座標佈局，以及 Wave 1～10 與無盡模式出怪節奏與數量成長表。
 * 【讀取資料】：無（本檔為純路線與波次設定表，供 wave_system.js 讀取）。
 * 【常見修改入口】：
 *   1. 修改地圖轉彎路線或特殊地形格位置：調整 MAPS_CONFIG.forest / lava 的 waypoints 與 terrainLayout。
 *   2. 修改每波怪量、菁英出現波次與出怪間隔：調整 WAVE_BALANCE 與 WAVES.pools。
 * ============================================================================
 */
(function (global) {
    'use strict';

    const GameApp = global.GameApp = global.GameApp || {};
    const CONFIG = GameApp.config || {};

    const BOARD_DIMENSIONS = {
        BOARD_COLS: 15,
        BOARD_ROWS: 10,
        BOARD_SIZE: 150,
        VICTORY_WAVE: 10,
        SUMMON_NEAR_PATH_RADIUS: 2.0
    };

    // 波次強度與魔王參數（統一平滑血量公式 + 無盡遞推）
    const WAVE_BALANCE = {
        BASE_COUNT: 6,
        COUNT_PER_WAVE: 2,
        MAX_COUNT_PER_WAVE: 28,
        HP_GROWTH_LINEAR: 0.30,
        HP_GROWTH_QUAD: 0.068,
        ENDLESS_HP_BASE_W10: 9.21,
        ENDLESS_HP_EXP: 1.20,
        ENDLESS_BOSS_HP_MULT: 2.364,
        ENDLESS_BOSS_ARMOR_STEP: 6,
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

    // 三地圖關卡與路徑點（WAYPOINTS）設定（🌲 晨光森林 / 🔥 熔岩峽谷 / ❄️ 永凍裂谷）
    const MAPS_CONFIG = {
        forest: {
            id: 'forest',
            name: '🌲 晨光森林',
            diffLabel: '標準難度',
            diffClass: 'diff-std',
            desc: '41 格蜿蜒長徑 · 經典穩定防線',
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
                ],
                obstacle: [
                    [5, 3], [9, 4], [7, 6], [11, 5]
                ]
            }
        },
        lava: {
            id: 'lava',
            name: '🔥 熔岩峽谷',
            diffLabel: '進階挑戰',
            diffClass: 'diff-hard',
            desc: '31 格雙折短徑 · 初始 +10 💰',
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
                ],
                obstacle: [
                    [2, 3], [6, 2], [9, 3], [9, 6]
                ]
            }
        },
        frost: {
            id: 'frost',
            name: '❄️ 永凍裂谷',
            diffLabel: '專家挑戰',
            diffClass: 'diff-hard',
            desc: '36 格雙岔匯流 · 初始 +15 💰 · 寒霜靈脈冰傷 +20%',
            startGoldBonus: 15,
            killGoldMult: 1.20,
            iceDamageBonus: 0.20,
            waypoints: [
                { x: 0, y: 1 },
                { x: 5, y: 1 },
                { x: 5, y: 5 },
                { x: 9, y: 5 },
                { x: 9, y: 2 },
                { x: 13, y: 2 },
                { x: 13, y: 8 },
                { x: 14, y: 8 }
            ],
            altWaypoints: [
                { x: 0, y: 8 },
                { x: 5, y: 8 },
                { x: 5, y: 5 },
                { x: 9, y: 5 },
                { x: 9, y: 2 },
                { x: 13, y: 2 },
                { x: 13, y: 8 },
                { x: 14, y: 8 }
            ],
            terrainLayout: {
                highground: [
                    [4, 3], [6, 4], [8, 3], [11, 3], [12, 5]
                ],
                mana_vein: [
                    [6, 6], [7, 4], [8, 4], [10, 4], [11, 5], [12, 6]
                ],
                world_tree: [
                    [14, 6], [14, 7], [12, 8], [14, 9]
                ],
                obstacle: [
                    [3, 4], [4, 6], [7, 2], [11, 7]
                ]
            }
        }
    };

    // Wave 1~10 與無盡模式出怪怪池配置（亦支援自動併入 monster_data.js 動態新增之怪物）
    const WAVES = {
        pools: [
            { maxWave: 1, monsters: ['wood', 'lava', 'air'] },
            { maxWave: 2, monsters: ['wood', 'lava', 'air', 'hound'] },
            { maxWave: 3, monsters: ['wood', 'lava', 'air', 'hound', 'slime'] },
            { maxWave: 5, monsters: ['wood', 'lava', 'air', 'hound', 'slime', 'golem'] },
            { maxWave: 6, monsters: ['wood', 'lava', 'air', 'hound', 'slime', 'golem', 'guardian'] },
            { maxWave: 7, monsters: ['wood', 'lava', 'air', 'hound', 'slime', 'golem', 'guardian', 'healer'] },
            { maxWave: 8, monsters: ['wood', 'lava', 'air', 'hound', 'slime', 'golem', 'guardian', 'healer', 'panther'] },
            { maxWave: Infinity, monsters: ['wood', 'lava', 'air', 'hound', 'slime', 'golem', 'guardian', 'healer', 'panther', 'bomber'] }
        ]
    };

    Object.assign(CONFIG, {
        BOARD_COLS: BOARD_DIMENSIONS.BOARD_COLS,
        BOARD_ROWS: BOARD_DIMENSIONS.BOARD_ROWS,
        BOARD_SIZE: BOARD_DIMENSIONS.BOARD_SIZE,
        VICTORY_WAVE: BOARD_DIMENSIONS.VICTORY_WAVE,
        SUMMON_NEAR_PATH_RADIUS: BOARD_DIMENSIONS.SUMMON_NEAR_PATH_RADIUS
    });

    GameApp.data = GameApp.data || {};
    GameApp.data.routes = {
        BOARD_DIMENSIONS,
        WAVE_BALANCE,
        MAPS_CONFIG,
        WAVES
    };

    if (global.GameConfig) {
        global.GameConfig.WAVE_BALANCE = WAVE_BALANCE;
        global.GameConfig.MAPS_CONFIG = MAPS_CONFIG;
        global.GameConfig.WAVES = WAVES;
    }
})(window);
