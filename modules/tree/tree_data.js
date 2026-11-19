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
        DEW_MAX: 120,
        DEW_GAIN_NORMAL: 4,
        DEW_GAIN_SPECIAL: 8,
        DEW_GAIN_BOSS: 30,
        BLESSING_INTERVAL_WAVES: 3,
        BLESSING_SEED_INTERVAL: 5,
        BLESSING_RESONANCE_DMG_BONUS: 0.25,
        BLESSING_RESONANCE_WINDOW_MS: 2500,
        BLESSING_CHAIN_STORM_EXTRA_BOUNCES: 2,
        BLESSING_CHAIN_STORM_RADIUS_CELLS: 2.6,
        BLESSING_GLACIAL_SHATTER_HP_PCT: 0.15,
        BLESSING_SCORCH_DURATION_MS: 2500,
        BLESSING_SCORCH_DPS: 22,
        BLESSING_SCORCH_RADIUS_CELLS: 0.75,
        BLESSING_DEW_OVERCHARGE_DUR_MS: 3000,
        BLESSING_DEW_OVERCHARGE_CHANCE: 0.40
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

    // 世界樹枝枒祝福卡牌池（6 張機制質變卡，Key-Value 結構供 Object.keys 動態掃描抽卡）
    const BLESSINGS_MAP = {
        abundant_seed: {
            id: 'abundant_seed',
            icon: '🌱',
            name: '豐饒種子',
            desc: '每累計召喚 5 次防禦塔，第 5 座必定直接為 ★★ 階級（商店卡片右上角顯示「下次必出 ★★」預告）。'
        },
        elemental_resonance: {
            id: 'elemental_resonance',
            icon: '🔮',
            name: '元素共鳴',
            desc: '場上只要同時有 2 種以上不同元素在攻擊同一名敵人，該敵人受到的所有傷害額外 +25%。'
        },
        chain_storm: {
            id: 'chain_storm',
            icon: '⚡',
            name: '連鎖風暴',
            desc: '連鎖閃電或彈射攻擊只要擊殺敵人，立刻免費向周圍 2.6 格內額外多彈跳 2 次。'
        },
        glacial_shatter: {
            id: 'glacial_shatter',
            icon: '❄️',
            name: '極寒碎冰',
            desc: '處於減速或凍結狀態的敵人血量低於 15% 時，受到任何冰系／蒸氣／磁環攻擊直接碎裂處決。'
        },
        scorched_brand: {
            id: 'scorched_brand',
            icon: '🔥',
            name: '焦土烙印',
            desc: '火系與蒸氣塔每次觸發破甲或暴擊時，在目標腳下留下持續 2.5 秒的燃燒路徑，每秒造成 22 點火焰傷害。'
        },
        dew_overcharge: {
            id: 'dew_overcharge',
            icon: '💧',
            name: '靈露超載',
            desc: '施放任一世界樹主動技能後的 3 秒內，全場防禦塔有 40% 機率連續發動雙重射擊。'
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
        BLESSING_RESONANCE_DMG_BONUS: TREE_CONFIG.BLESSING_RESONANCE_DMG_BONUS,
        BLESSING_RESONANCE_WINDOW_MS: TREE_CONFIG.BLESSING_RESONANCE_WINDOW_MS,
        BLESSING_CHAIN_STORM_EXTRA_BOUNCES: TREE_CONFIG.BLESSING_CHAIN_STORM_EXTRA_BOUNCES,
        BLESSING_CHAIN_STORM_RADIUS_CELLS: TREE_CONFIG.BLESSING_CHAIN_STORM_RADIUS_CELLS,
        BLESSING_GLACIAL_SHATTER_HP_PCT: TREE_CONFIG.BLESSING_GLACIAL_SHATTER_HP_PCT,
        BLESSING_SCORCH_DURATION_MS: TREE_CONFIG.BLESSING_SCORCH_DURATION_MS,
        BLESSING_SCORCH_DPS: TREE_CONFIG.BLESSING_SCORCH_DPS,
        BLESSING_SCORCH_RADIUS_CELLS: TREE_CONFIG.BLESSING_SCORCH_RADIUS_CELLS,
        BLESSING_DEW_OVERCHARGE_DUR_MS: TREE_CONFIG.BLESSING_DEW_OVERCHARGE_DUR_MS,
        BLESSING_DEW_OVERCHARGE_CHANCE: TREE_CONFIG.BLESSING_DEW_OVERCHARGE_CHANCE
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
