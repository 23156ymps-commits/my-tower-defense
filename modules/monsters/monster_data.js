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
            traitDesc: '均衡推進的森林木系魔物，懼怕火屬性破甲與灼燒。',
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
            traitDesc: '高血量岩漿重步兵，受到冰系攻擊承受 175% 暴擊。',
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
            traitDesc: '敏捷推進的空中單位，容易被長射程雷塔攔截。',
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
            traitDesc: '極速突襲型魔物，必須靠冰系或磁環減速拖緩。',
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
            traitDesc: '死亡時分裂為 2 隻迷你史萊姆，宜用範圍濺射或連鎖清場。',
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
            traitDesc: '自帶高額原生岩石護甲，需火系破甲或蒸氣／電漿穿甲對付。',
            visual: {
                primaryColor: '#46544C',
                accentColor: '#D97724',
                shape: 'heavy_golem',
                sizeScale: 1.05
            }
        },
        guardian: {
            id: 'guardian',
            name: '符文護衛',
            icon: '🛡️',
            image: '',
            weakness: 'thunder',
            baseHp: 118,
            baseReward: 17,
            speedMult: 0.86,
            baseArmor: 6,
            shieldRatio: 0.45,
            minWave: 6,
            isSpecialMechanic: true,
            splitsOnDeath: false,
            traitDesc: '自帶 45% 最大生命藍色能量護盾；受雷／磁環／電漿破盾效率 +40%。',
            visual: {
                primaryColor: '#264352',
                accentColor: '#4A9EBF',
                shape: 'guardian',
                sizeScale: 1.04
            }
        },
        healer: {
            id: 'healer',
            name: '癒合花妖',
            icon: '🌸',
            image: '',
            weakness: 'fire',
            baseHp: 96,
            baseReward: 15,
            speedMult: 0.90,
            baseArmor: 0,
            healIntervalMs: 3000,
            healRadiusCells: 1.5,
            healMaxHpRatio: 0.06,
            minWave: 7,
            isSpecialMechanic: true,
            splitsOnDeath: false,
            traitDesc: '每 3.0 秒治療 1.5 格內友軍 6% 生命；受灼燒「重傷」時治療減半。',
            visual: {
                primaryColor: '#2F5E45',
                accentColor: '#E8A5B8',
                shape: 'healer',
                sizeScale: 0.98
            }
        },
        panther: {
            id: 'panther',
            name: '虛空影豹',
            icon: '💨',
            image: '',
            weakness: 'ice',
            baseHp: 88,
            baseReward: 16,
            speedMult: 1.32,
            baseArmor: 0,
            stealthThresholdPct: 0.50,
            stealthDurationMs: 2200,
            stealthSpeedBonus: 0.65,
            minWave: 8,
            isSpecialMechanic: true,
            splitsOnDeath: false,
            traitDesc: '血量首次低於 50% 隱身疾行 2.2s（移速 +65%），可被 AoE 與凍結打斷現形。',
            visual: {
                primaryColor: '#2A3338',
                accentColor: '#4A9EBF',
                shape: 'panther',
                sizeScale: 0.96
            }
        },
        bomber: {
            id: 'bomber',
            name: '熔核自爆蟲',
            icon: '🔥',
            image: '',
            weakness: 'ice',
            baseHp: 105,
            baseReward: 18,
            speedMult: 0.95,
            baseArmor: 4,
            empRadiusCells: 1.4,
            empDisableMs: 1500,
            minWave: 9,
            isSpecialMechanic: true,
            splitsOnDeath: false,
            traitDesc: '死亡時癱瘓 1.4 格內防禦塔 1.5s；於減速或凍結狀態擊殺則不會自爆。',
            visual: {
                primaryColor: '#592119',
                accentColor: '#D97724',
                shape: 'bomber',
                sizeScale: 1.02
            }
        }
    };

    // 4 階段機制 Boss 輪替序列（W5 熔岩巨獸王 -> W10 腐朽古樹王 -> W15 天穹堡壘艦 -> W20 虛空噬樹者）
    const BOSS_ROSTER = [
        {
            wave: 5,
            typeKey: 'lava',
            bossMechanic: 'hard_shell',
            shellHits: 12,
            shellReduction: 0.50,
            name: '熔岩巨獸王',
            icon: '🌋',
            weakness: 'ice',
            armorBase: 16,
            hpBase: 2800,
            traitDesc: '硬化外殼：受到前 12 次攻擊減傷 50%，需高攻速連擊破殼。'
        },
        {
            wave: 10,
            typeKey: 'wood',
            bossMechanic: 'treant_summon',
            summonIntervalMs: 8000,
            summonCount: 2,
            healPct: 0.05,
            name: '腐朽古樹王',
            icon: '👹',
            weakness: 'fire',
            armorBase: 22,
            hpBase: 9000,
            traitDesc: '古樹再生：每 8 秒召喚 2 隻蔓藤小怪並回復 5% 生命（重傷減半）。'
        },
        {
            wave: 15,
            typeKey: 'air',
            bossMechanic: 'shield_emp',
            shieldRatio: 0.50,
            empIntervalMs: 10000,
            empTargets: 2,
            empDisableMs: 1500,
            name: '天穹堡壘艦',
            icon: '🛸',
            weakness: 'thunder',
            armorBase: 26,
            hpBase: 22000,
            traitDesc: '天穹護盾：開局附帶 50% 護盾，每 10 秒 EMP 癱瘓最近 2 座塔 1.5s。'
        },
        {
            wave: 20,
            typeKey: 'void_boss',
            bossMechanic: 'void_shift',
            name: '虛空噬樹者',
            icon: '🕳️',
            weakness: 'thunder',
            armorBase: 32,
            hpBase: 48000,
            traitDesc: '虛空變相：每損失 25% 生命切換弱點屬性並淨化部分負面狀態。'
        }
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
