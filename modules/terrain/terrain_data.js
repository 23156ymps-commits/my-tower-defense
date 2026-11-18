/**
 * ============================================================================
 * 【檔案名稱】：modules/terrain/terrain_data.js
 * 【負責功能】：存放所有戰術地形與基礎地塊定義表（普通草地、怪物跑道、障礙地塊、制高點、元素靈脈、世界樹庇護所）。
 * 【讀取資料】：無（本檔為純數值與視覺標籤設定表，供 terrain_system.js 與 renderer.js 讀取）。
 * 【常見修改入口】：
 *   1. 修改特殊地形增益倍率：調整 TERRAIN_TYPES 內的 rangeMult / attackSpeedMult / maxDamageBonus。
 *   2. 新增自訂特殊地形：於 TERRAIN_TYPES 新增一筆物件並設定 buildable 與增益屬性。
 * ============================================================================
 */
(function (global) {
    'use strict';

    const GameApp = global.GameApp = global.GameApp || {};

    const TERRAIN_TYPES = {
        grass: {
            id: 'grass',
            name: '普通草地',
            icon: '🌱',
            buildable: true,
            isSpecial: false,
            shortTag: '',
            tooltip: '🌱 普通草地：可自由部署防禦塔',
            swatchClass: 'swatch-grass',
            rangeMult: 1.0,
            attackSpeedMult: 1.0,
            maxDamageBonus: 0
        },
        path: {
            id: 'path',
            name: '怪物跑道',
            icon: '🛤️',
            buildable: false,
            isSpecial: false,
            shortTag: '🛤️ 怪物行軍路線',
            tooltip: '🛤️ 怪物跑道：敵軍行進路線，禁止建造防禦塔',
            swatchClass: 'swatch-path',
            rangeMult: 1.0,
            attackSpeedMult: 1.0,
            maxDamageBonus: 0
        },
        obstacle: {
            id: 'obstacle',
            name: '障礙地塊',
            icon: '🪨',
            buildable: false,
            isSpecial: false,
            shortTag: '🪨 障礙禁建',
            tooltip: '🪨 障礙地塊：地形崎嶇阻擋，無法建造防禦塔',
            swatchClass: 'swatch-obstacle',
            rangeMult: 1.0,
            attackSpeedMult: 1.0,
            maxDamageBonus: 0
        },
        highground: {
            id: 'highground',
            name: '制高點',
            icon: '⛰️',
            buildable: true,
            isSpecial: true,
            shortTag: '⛰️ 射程+30%',
            tooltip: '⛰️ 制高點：放置於此的塔射程 +30%',
            swatchClass: 'swatch-highground',
            rangeMult: 1.30,
            attackSpeedMult: 1.0,
            maxDamageBonus: 0
        },
        mana_vein: {
            id: 'mana_vein',
            name: '元素靈脈',
            icon: '✨',
            buildable: true,
            isSpecial: true,
            shortTag: '✨ 攻速+25%',
            tooltip: '✨ 元素靈脈：放置於此的塔攻速 +25%',
            swatchClass: 'swatch-mana',
            rangeMult: 1.0,
            attackSpeedMult: 1.25,
            maxDamageBonus: 0
        },
        world_tree: {
            id: 'world_tree',
            name: '世界樹庇護所',
            icon: '🌿',
            buildable: true,
            isSpecial: true,
            shortTag: '🌿 滿血傷+20%',
            tooltip: '🌿 世界樹庇護所：依基地血量比例提供最高 +20% 傷害加成',
            swatchClass: 'swatch-tree',
            rangeMult: 1.0,
            attackSpeedMult: 1.0,
            maxDamageBonus: 0.20
        }
    };

    // 供舊版相容讀取之特殊戰術地形子集
    const TERRAIN_CONFIG = {
        highground: TERRAIN_TYPES.highground,
        mana_vein: TERRAIN_TYPES.mana_vein,
        world_tree: TERRAIN_TYPES.world_tree,
        obstacle: TERRAIN_TYPES.obstacle
    };

    GameApp.data = GameApp.data || {};
    GameApp.data.terrain = {
        TERRAIN_TYPES,
        TERRAIN_CONFIG
    };

    if (global.GameConfig) {
        global.GameConfig.TERRAIN_CONFIG = TERRAIN_CONFIG;
    }
})(window);
