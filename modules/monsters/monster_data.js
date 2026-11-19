/**
 * ============================================================================
 * 【檔案名稱】：modules/monsters/monster_data.js
 * 【負責功能】：存放全局怪物血量／移速倍率、走路整體規則（轉彎平滑度、最低保底移速比例），
 *               以及所有一般怪、特殊機制怪與領主魔王的血量、護甲、移速、弱點與幾何外觀參數。
 * 【讀取資料】：無（本檔為純怪物數值與標籤表，供 monster_system.js、wave_system.js、renderer.js 讀取）。
 * 【常見修改入口】：
 *   1. 調整全體怪物移動速度或血量倍率：修改 GLOBAL_MONSTER_RULES。
 *   2. 新增全新怪物：於 MONSTER_DATABASE 新增一筆物件並設定 weakness 與 baseHp，出怪系統與防禦塔即自動識別。
 * ============================================================================
 */
(function (global) {
    'use strict';

    const GameApp = global.GameApp = global.GameApp || {};
    const CONFIG = GameApp.config || {};

    // 怪物全局數值與走路整體規則
    const GLOBAL_MONSTER_RULES = {
        MONSTER_BASE_SPEED: 2.6,            // 怪物基礎移動速度 (格/秒)
        MONSTER_SPEED_SCALE: 1.0,           // 全局移動速度倍率（可由雲端 Remote Config 動態覆寫）
        MONSTER_HP_SCALE: 1.0,              // 全局最大血量倍率（可由雲端 Remote Config 動態覆寫）
        MIN_SPEED_RATIO: 0.20,              // 最低保底緩速後殘餘移速比例（20%，定身狀態除外）
        CORNER_SMOOTHING: 1.0,              // 路徑轉彎切角平滑係數
        SLIME_SPLIT_COUNT: 2,               // 分裂型怪物死亡時預設分裂數量
        SLIME_SPLIT_HP_RATIO: 0.30          // 分裂子體繼承母體最大血量比例 (30%)
    };

    // 各類怪物基礎數值、行為標籤與參數化幾何外觀定義（image 欄位可填自訂圖片路徑，未填時自動繪製 2.5D 肖像）
    const MONSTER_DATABASE = {
        wood: {
            id: 'wood',
            name: '蔓藤巨魔',
            icon: '🌿',
            image: '',
            weakness: 'fire',
            baseHp: 68,
            baseReward: 10,
            speedMult: 1.0,
            baseArmor: 0,
            minWave: 1,
            isSpecialMechanic: false,
            splitsOnDeath: false,
            visual: {
                primaryColor: '#523C2B',
                accentColor: '#326B46',
                shape: 'treant',
                sizeScale: 1.0
            }
        },
        lava: {
            id: 'lava',
            name: '熔岩傀儡',
            icon: '🌋',
            image: '',
            weakness: 'ice',
            baseHp: 78,
            baseReward: 11,
            speedMult: 0.92,
            baseArmor: 0,
            minWave: 1,
            isSpecialMechanic: false,
            splitsOnDeath: false,
            visual: {
                primaryColor: '#46201A',
                accentColor: '#C94A38',
                shape: 'golem',
                sizeScale: 1.0
            }
        },
        air: {
            id: 'air',
            name: '機械飛艇',
            icon: '🛸',
            image: '',
            weakness: 'thunder',
            baseHp: 60,
            baseReward: 10,
            speedMult: 1.15,
            baseArmor: 0,
            minWave: 1,
            isSpecialMechanic: false,
            splitsOnDeath: false,
            visual: {
                primaryColor: '#2F6A82',
                accentColor: '#4A9EBF',
                shape: 'airship',
                sizeScale: 1.0
            }
        },
        hound: {
            id: 'hound',
            name: '疾風獵犬',
            icon: '🐺',
            image: '',
            weakness: 'ice',
            baseHp: 44,
            baseReward: 9,
            speedMult: 1.65,
            baseArmor: 0,
            minWave: 2,
            isSpecialMechanic: true,
            splitsOnDeath: false,
            visual: {
                primaryColor: '#357690',
                accentColor: '#82BDD4',
                shape: 'beast',
                sizeScale: 0.95
            }
        },
        slime: {
            id: 'slime',
            name: '分裂史萊姆',
            icon: '🟢',
            image: '',
            weakness: 'fire',
            baseHp: 90,
            baseReward: 13,
            speedMult: 0.88,
            baseArmor: 0,
            minWave: 3,
            isSpecialMechanic: true,
            splitsOnDeath: true,
            splitCount: 2,
            splitHpRatio: 0.30,
            splitChildName: '迷你史萊姆',
            splitChildIcon: '🟢',
            visual: {
                primaryColor: '#3B7A4D',
                accentColor: '#B7E4C7',
                shape: 'slime',
                sizeScale: 1.0
            }
        },
        golem: {
            id: 'golem',
            name: '重裝魔像',
            icon: '🗿',
            image: '',
            weakness: 'thunder',
            baseHp: 112,
            baseReward: 16,
            speedMult: 0.72,
            baseArmor: 15,
            armorGrowthPerWave: 1,
            maxArmor: 20,
            minWave: 4,
            isSpecialMechanic: true,
            splitsOnDeath: false,
            visual: {
                primaryColor: '#46544C',
                accentColor: '#D97724',
                shape: 'heavy_golem',
                sizeScale: 1.05
            }
        }
    };

    // 魔王輪替序列（Wave 5 弱冰 -> Wave 10 弱火腐朽古樹王 -> Wave 15 弱雷）
    const BOSS_ROSTER = [
        { typeKey: 'lava', name: '熔岩巨獸王', icon: '🌋', weakness: 'ice', armorBase: 12, hpBase: 1950 },
        { typeKey: 'wood', name: '腐朽古樹王', icon: '👹', weakness: 'fire', armorBase: 15, hpBase: 4200 },
        { typeKey: 'air', name: '風暴領主王', icon: '🛸', weakness: 'thunder', armorBase: 17, hpBase: 5600 }
    ];

    const SPECIAL_MECHANIC_MONSTERS = new Set(
        Object.keys(MONSTER_DATABASE).filter(k => Boolean(MONSTER_DATABASE[k] && MONSTER_DATABASE[k].isSpecialMechanic))
    );

    Object.assign(CONFIG, {
        MONSTER_BASE_SPEED: GLOBAL_MONSTER_RULES.MONSTER_BASE_SPEED,
        MONSTER_SPEED_SCALE: GLOBAL_MONSTER_RULES.MONSTER_SPEED_SCALE,
        MONSTER_HP_SCALE: GLOBAL_MONSTER_RULES.MONSTER_HP_SCALE,
        SLIME_SPLIT_COUNT: GLOBAL_MONSTER_RULES.SLIME_SPLIT_COUNT,
        SLIME_SPLIT_HP_RATIO: GLOBAL_MONSTER_RULES.SLIME_SPLIT_HP_RATIO
    });

    GameApp.data = GameApp.data || {};
    GameApp.data.monsters = {
        GLOBAL_MONSTER_RULES,
        MONSTER_DATABASE,
        BOSS_ROSTER,
        SPECIAL_MECHANIC_MONSTERS
    };

    if (global.GameConfig) {
        Object.assign(global.GameConfig, {
            MONSTER_DATABASE,
            BOSS_ROSTER,
            SPECIAL_MECHANIC_MONSTERS
        });
    }
})(window);
