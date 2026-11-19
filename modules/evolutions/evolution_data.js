/**
 * ============================================================================
 * 【檔案名稱】：modules/evolutions/evolution_data.js
 * 【負責功能】：存放元素世界樹進化階級上限（MAX_TIER = 3）、T1→T2 純血與共生主幹配方、
 *               以及 T2→T3 完整 12 冠枝分岔與「同血脈定向催熟」規則表。
 * 【讀取資料】：無（本檔為純進化與融合配方表，供 evolution_system.js 與 codex_system.js 讀取）。
 * 【常見修改入口】：
 *   1. 修改 T1→T2 主幹合成對應：調整 T1_TO_T2_RECIPES。
 *   2. 修改 T2→T3 雙分支或同血脈催熟規則：調整 T2_TO_T3_RULES。
 * ============================================================================
 */
(function (global) {
    'use strict';

    const GameApp = global.GameApp = global.GameApp || {};
    const CONFIG = GameApp.config || {};

    const MAX_TIER = 3;

    // T1 根芽 -> T2 主幹 配方表（Key 為排序後的基礎元素鍵）
    const T1_TO_T2_RECIPES = {
        'fire+fire': { resultType: 'fire_trunk', isCrossElement: false },
        'ice+ice': { resultType: 'ice_trunk', isCrossElement: false },
        'thunder+thunder': { resultType: 'thunder_trunk', isCrossElement: false },
        'fire+ice': { resultType: 'steam_trunk', isCrossElement: true },
        'ice+thunder': { resultType: 'magnet_trunk', isCrossElement: true },
        'fire+thunder': { resultType: 'plasma_trunk', isCrossElement: true }
    };

    // 向下相容跨元素配方查表
    const FUSION_RECIPES = {
        'fire+ice': 'steam_trunk',
        'ice+thunder': 'magnet_trunk',
        'fire+thunder': 'plasma_trunk',
        'fire_bud+ice_bud': 'steam_trunk',
        'ice_bud+thunder_bud': 'magnet_trunk',
        'fire_bud+thunder_bud': 'plasma_trunk'
    };

    // 結構化融合配方清單（供圖鑑與合成系統自動掃描）
    const FUSION_RECIPE_LIST = [
        { ingredients: ['fire_bud', 'ice_bud'], resultType: 'steam_trunk', recipeKey: 'fire+ice', branches: ['steam_A', 'steam_B'] },
        { ingredients: ['ice_bud', 'thunder_bud'], resultType: 'magnet_trunk', recipeKey: 'ice+thunder', branches: ['magnet_A', 'magnet_B'] },
        { ingredients: ['fire_bud', 'thunder_bud'], resultType: 'plasma_trunk', recipeKey: 'fire+thunder', branches: ['plasma_A', 'plasma_B'] }
    ];

    /**
     * T2 主幹 -> T3 冠枝 進化規則表（Key 為字母排序後的兩座 T2 主幹標準 ID）
     * - mode: 'dual_choice'（雙分支二選一輪盤 [A / B]）
     * - mode: 'directed_single'（同血脈定向催熟單一確認卡）
     * 未列於表內的 T2 組合（如 steam_trunk + thunder_trunk）皆屬「血脈不相容」禁止合成
     */
    const T2_TO_T3_RULES = {
        // 1. 純血主幹 + 同系純血主幹 -> 該純血系 A / B 二選一
        'fire_trunk+fire_trunk': {
            mode: 'dual_choice',
            family: 'fire',
            options: ['fire_A', 'fire_B'],
            title: '炎核主幹 · 冠枝分岔開花',
            previewLabel: '🔥 分岔進化 ▸ A 熔核轟擊 / B 焚世餘燼'
        },
        'ice_trunk+ice_trunk': {
            mode: 'dual_choice',
            family: 'ice',
            options: ['ice_A', 'ice_B'],
            title: '霜晶主幹 · 冠枝分岔開花',
            previewLabel: '❄️ 分岔進化 ▸ A 永凍領域 / B 冰錐穿刺'
        },
        'thunder_trunk+thunder_trunk': {
            mode: 'dual_choice',
            family: 'thunder',
            options: ['thunder_A', 'thunder_B'],
            title: '雷紋主幹 · 冠枝分岔開花',
            previewLabel: '⚡ 分岔進化 ▸ A 連鎖天雷 / B 落雷審判'
        },

        // 2. 共生主幹 + 同血脈純血主幹 -> 同血脈定向催熟（單一分支確認）
        'fire_trunk+steam_trunk': {
            mode: 'directed_single',
            family: 'steam',
            options: ['steam_A'],
            title: '同血脈定向催熟 · 火系蒸壓',
            previewLabel: '💨A 焦熱蒸壓樹（火血脈定向催熟）'
        },
        'ice_trunk+steam_trunk': {
            mode: 'directed_single',
            family: 'steam',
            options: ['steam_B'],
            title: '同血脈定向催熟 · 冰系霜霧',
            previewLabel: '💨B 霜霧迷宮樹（冰血脈定向催熟）'
        },
        'ice_trunk+magnet_trunk': {
            mode: 'directed_single',
            family: 'magnet',
            options: ['magnet_A'],
            title: '同血脈定向催熟 · 冰系黑洞',
            previewLabel: '💠A 引力黑洞樹（冰血脈定向催熟）'
        },
        'magnet_trunk+thunder_trunk': {
            mode: 'directed_single',
            family: 'magnet',
            options: ['magnet_B'],
            title: '同血脈定向催熟 · 雷系超載',
            previewLabel: '💠B 電磁超載樹（雷血脈定向催熟）'
        },
        'fire_trunk+plasma_trunk': {
            mode: 'directed_single',
            family: 'plasma',
            options: ['plasma_A'],
            title: '同血脈定向催熟 · 火系死光',
            previewLabel: '☄️A 聚變死光樹（火血脈定向催熟）'
        },
        'plasma_trunk+thunder_trunk': {
            mode: 'directed_single',
            family: 'plasma',
            options: ['plasma_B'],
            title: '同血脈定向催熟 · 雷系折射',
            previewLabel: '☄️B 弧光折射樹（雷血脈定向催熟）'
        },

        // 3. 雙同系共生主幹 或 異系純血主幹相融 -> 該共生系 A / B 二選一
        'steam_trunk+steam_trunk': {
            mode: 'dual_choice',
            family: 'steam',
            options: ['steam_A', 'steam_B'],
            title: '蒸氣噴泉 · 冠枝分岔開花',
            previewLabel: '💨 分岔進化 ▸ A 焦熱蒸壓 / B 霜霧迷宮'
        },
        'fire_trunk+ice_trunk': {
            mode: 'dual_choice',
            family: 'steam',
            options: ['steam_A', 'steam_B'],
            title: '火冰交融 · 蒸氣冠枝分岔',
            previewLabel: '💨 分岔進化 ▸ A 焦熱蒸壓 / B 霜霧迷宮'
        },
        'magnet_trunk+magnet_trunk': {
            mode: 'dual_choice',
            family: 'magnet',
            options: ['magnet_A', 'magnet_B'],
            title: '極地磁環 · 冠枝分岔開花',
            previewLabel: '💠 分岔進化 ▸ A 引力黑洞 / B 電磁超載'
        },
        'ice_trunk+thunder_trunk': {
            mode: 'dual_choice',
            family: 'magnet',
            options: ['magnet_A', 'magnet_B'],
            title: '冰雷交融 · 磁暴冠枝分岔',
            previewLabel: '💠 分岔進化 ▸ A 引力黑洞 / B 電磁超載'
        },
        'plasma_trunk+plasma_trunk': {
            mode: 'dual_choice',
            family: 'plasma',
            options: ['plasma_A', 'plasma_B'],
            title: '電漿導管 · 冠枝分岔開花',
            previewLabel: '☄️ 分岔進化 ▸ A 聚變死光 / B 弧光折射'
        },
        'fire_trunk+thunder_trunk': {
            mode: 'dual_choice',
            family: 'plasma',
            options: ['plasma_A', 'plasma_B'],
            title: '火雷交融 · 電漿冠枝分岔',
            previewLabel: '☄️ 分岔進化 ▸ A 聚變死光 / B 弧光折射'
        }
    };

    const LV3_ASCENSION_HINTS = {
        fire_A: '【重砲濺射＋45%群體破甲】',
        fire_B: '【5層灼燒傳染＋重傷處決】',
        ice_A: '【1.5格60%群緩＋4擊永凍】',
        ice_B: '【直線穿透2體＋55%碎冰】',
        thunder_A: '【真4體連鎖天雷】',
        thunder_B: '【第3發2.2x天罰穿甲】',
        steam_A: '【65%穿甲濺射＋滾燙蒸氣池】',
        steam_B: '【1.6格霜霧減速＋20%易傷】',
        magnet_A: '【群緩＋第3擊路徑回拉聚攏】',
        magnet_B: '【3體彈射＋3.5s感電附傷】',
        plasma_A: '【8層聚變死光＋45%穿甲】',
        plasma_B: '【4層主束＋雙副束折射】'
    };

    CONFIG.MAX_TIER = MAX_TIER;

    GameApp.data = GameApp.data || {};
    GameApp.data.evolutions = {
        MAX_TIER,
        T1_TO_T2_RECIPES,
        T2_TO_T3_RULES,
        FUSION_RECIPES,
        FUSION_RECIPE_LIST,
        LV3_ASCENSION_HINTS
    };

    if (global.GameConfig) {
        global.GameConfig.FUSION_RECIPES = FUSION_RECIPES;
        global.GameConfig.T2_TO_T3_RULES = T2_TO_T3_RULES;
    }
})(window);
