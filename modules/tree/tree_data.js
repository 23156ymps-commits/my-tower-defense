/**
 * ============================================================================
 * 【檔案名稱】：modules/tree/tree_data.js
 * 【負責功能】：存放世界樹最大生命、靈露能量上限與擊殺獲取量、主動救場技能（根鬚纏繞／自然狂熱）參數，
 *               以及每 3 波三選一世界樹枝枒祝福卡牌池（BLESSINGS_MAP）。
 * 【讀取資料】：無（本檔為純世界樹與祝福設定表，供 tree_system.js 讀取）。
 * 【常見修改入口】：
 *   1. 修改世界樹初始生命或靈露消耗：調整 TREE_CONFIG、ACTIVE_SKILLS。
 *   2. 新增或調整世界樹祝福卡：於 BLESSINGS_MAP 新增一筆物件，抽卡系統將透過 Object.keys() 自動納入池中。
 * ============================================================================
 */
(function (global) {
    'use strict';

    const GameApp = global.GameApp = global.GameApp || {};
    const CONFIG = GameApp.config || {};

    const TREE_CONFIG = {
        INITIAL_BASE_HP: 20,
        WORLD_TREE_HEALTHY_MIN: 14,
        WORLD_TREE_WARNING_MIN: 7,
        DEW_INITIAL: 20,
        DEW_MAX: 100,
        DEW_GAIN_NORMAL: 4,
        DEW_GAIN_SPECIAL: 8,
        DEW_GAIN_BOSS: 30,
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
        BLESSING_THORN_NEAR_TREE_DMG: 0.10
    };

    const ACTIVE_SKILLS = {
        entangle: {
            id: 'entangle',
            name: '根鬚纏繞',
            hotkey: 'Q',
            cost: 40,
            cdMs: 8000,
            durationMs: 2500,
            vulnBonus: 0.20
        },
        frenzy: {
            id: 'frenzy',
            name: '自然狂熱',
            hotkey: 'W',
            cost: 60,
            cdMs: 12000,
            durationMs: 5000,
            speedBonus: 0.35
        }
    };

    // 世界樹枝枒祝福卡牌池（Key-Value 結構，供 Object.keys 動態掃描抽卡）
    const BLESSINGS_MAP = {
        abundant_seed: {
            id: 'abundant_seed',
            icon: '🌱',
            name: '豐饒種子',
            desc: '每累計召喚 5 座塔，第 5 座直接進階為 ★★（Lv.2），召喚區顯示保底進度。'
        },
        winter_bloodline: {
            id: 'winter_bloodline',
            icon: '❄️',
            name: '凜冬血脈',
            desc: '冰／蒸氣／磁暴塔緩速效果額外 +12%（最高 75%），緩速時間 +0.5 秒。'
        },
        searing_embers: {
            id: 'searing_embers',
            icon: '🔥',
            name: '熾熱餘燼',
            desc: '火／蒸氣／電漿塔擊殺敵人時，引發 1.0 格餘燼爆裂，造成致命一擊 25% 傷害。'
        },
        life_nectar: {
            id: 'life_nectar',
            icon: '💧',
            name: '生命甘露',
            desc: `🌳 世界樹立即回復 ${TREE_CONFIG.BLESSING_LIFE_HEAL} 點生命（不超過 ${TREE_CONFIG.INITIAL_BASE_HP}），且今後擊殺獲得靈露能量 +${Math.round(TREE_CONFIG.BLESSING_DEW_GAIN_BONUS * 100)}%。`
        },
        thunder_conduction: {
            id: 'thunder_conduction',
            icon: '⚡',
            name: '雷鳴超導',
            desc: '雷／磁暴／電漿塔攻速提升 15%，且閃電／磁暴連鎖目標數額外 +1。'
        },
        thorn_bulwark: {
            id: 'thorn_bulwark',
            icon: '🌿',
            name: '荊棘壁壘',
            desc: '全場防禦塔基礎傷害 +12%，且距離世界樹 2.5 格內的敵人再受額外 +10% 傷害。'
        }
    };

    function getBlessingsCatalog() {
        return Object.keys(BLESSINGS_MAP).map(k => BLESSINGS_MAP[k]);
    }

    const BLESSINGS_CATALOG = getBlessingsCatalog();

    Object.assign(CONFIG, {
        INITIAL_BASE_HP: TREE_CONFIG.INITIAL_BASE_HP,
        WORLD_TREE_HEALTHY_MIN: TREE_CONFIG.WORLD_TREE_HEALTHY_MIN,
        WORLD_TREE_WARNING_MIN: TREE_CONFIG.WORLD_TREE_WARNING_MIN,
        DEW_INITIAL: TREE_CONFIG.DEW_INITIAL,
        DEW_MAX: TREE_CONFIG.DEW_MAX,
        DEW_GAIN_NORMAL: TREE_CONFIG.DEW_GAIN_NORMAL,
        DEW_GAIN_SPECIAL: TREE_CONFIG.DEW_GAIN_SPECIAL,
        DEW_GAIN_BOSS: TREE_CONFIG.DEW_GAIN_BOSS,
        SKILL_ENTANGLE_COST: ACTIVE_SKILLS.entangle.cost,
        SKILL_ENTANGLE_CD_MS: ACTIVE_SKILLS.entangle.cdMs,
        SKILL_ENTANGLE_DUR_MS: ACTIVE_SKILLS.entangle.durationMs,
        SKILL_ENTANGLE_VULN_BONUS: ACTIVE_SKILLS.entangle.vulnBonus,
        SKILL_FRENZY_COST: ACTIVE_SKILLS.frenzy.cost,
        SKILL_FRENZY_CD_MS: ACTIVE_SKILLS.frenzy.cdMs,
        SKILL_FRENZY_DUR_MS: ACTIVE_SKILLS.frenzy.durationMs,
        SKILL_FRENZY_SPEED_BONUS: ACTIVE_SKILLS.frenzy.speedBonus,
        BLESSING_INTERVAL_WAVES: TREE_CONFIG.BLESSING_INTERVAL_WAVES,
        BLESSING_SEED_INTERVAL: TREE_CONFIG.BLESSING_SEED_INTERVAL,
        BLESSING_WINTER_SLOW_BONUS: TREE_CONFIG.BLESSING_WINTER_SLOW_BONUS,
        BLESSING_WINTER_SLOW_CAP: TREE_CONFIG.BLESSING_WINTER_SLOW_CAP,
        BLESSING_WINTER_DURATION_BONUS_MS: TREE_CONFIG.BLESSING_WINTER_DURATION_BONUS_MS,
        BLESSING_WINTER_STEAM_CHILL_MS: TREE_CONFIG.BLESSING_WINTER_STEAM_CHILL_MS,
        BLESSING_EMBER_RADIUS_CELLS: TREE_CONFIG.BLESSING_EMBER_RADIUS_CELLS,
        BLESSING_EMBER_DAMAGE_RATIO: TREE_CONFIG.BLESSING_EMBER_DAMAGE_RATIO,
        BLESSING_LIFE_HEAL: TREE_CONFIG.BLESSING_LIFE_HEAL,
        BLESSING_DEW_GAIN_BONUS: TREE_CONFIG.BLESSING_DEW_GAIN_BONUS,
        BLESSING_THUNDER_SPEED_BONUS: TREE_CONFIG.BLESSING_THUNDER_SPEED_BONUS,
        BLESSING_THUNDER_EXTRA_TARGETS: TREE_CONFIG.BLESSING_THUNDER_EXTRA_TARGETS,
        BLESSING_THORN_GLOBAL_DMG: TREE_CONFIG.BLESSING_THORN_GLOBAL_DMG,
        BLESSING_THORN_TREE_RADIUS_CELLS: TREE_CONFIG.BLESSING_THORN_TREE_RADIUS_CELLS,
        BLESSING_THORN_NEAR_TREE_DMG: TREE_CONFIG.BLESSING_THORN_NEAR_TREE_DMG
    });

    GameApp.data = GameApp.data || {};
    GameApp.data.tree = {
        TREE_CONFIG,
        ACTIVE_SKILLS,
        BLESSINGS_MAP,
        BLESSINGS_CATALOG,
        getBlessingsCatalog
    };

    if (global.GameConfig) {
        global.GameConfig.BLESSINGS_CATALOG = BLESSINGS_CATALOG;
    }
})(window);
