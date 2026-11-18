/**
 * ============================================================================
 * 【檔案名稱】：modules/evolutions/evolution_data.js
 * 【負責功能】：存放角色升星最高階級上限（MAX_TIER = 3）、跨元素融合配方表（FUSION_RECIPES）與升階質變說明。
 * 【讀取資料】：無（本檔為純進化與融合配方表，供 evolution_system.js 與 codex_system.js 讀取）。
 * 【常見修改入口】：
 *   1. 新增或修改跨元素融合配方：在 FUSION_RECIPES 新增「元素A+元素B: 目標塔ID」（Key 請依字母排序）。
 *   2. 修改滿星質變文字提示：調整 LV3_ASCENSION_HINTS。
 * ============================================================================
 */
(function (global) {
    'use strict';

    const GameApp = global.GameApp = global.GameApp || {};
    const CONFIG = GameApp.config || {};

    const MAX_TIER = 3;

    // 跨元素融合配方表（Key 為排序後的基礎元素組合，Value 為融合目標塔 ID）
    const FUSION_RECIPES = {
        'fire+ice': 'steam',
        'ice+thunder': 'magnet',
        'fire+thunder': 'plasma'
    };

    // 結構化融合配方清單（供圖鑑與合成系統自動掃描）
    const FUSION_RECIPE_LIST = [
        { ingredients: ['fire', 'ice'], resultType: 'steam', recipeKey: 'fire+ice' },
        { ingredients: ['ice', 'thunder'], resultType: 'magnet', recipeKey: 'ice+thunder' },
        { ingredients: ['fire', 'thunder'], resultType: 'plasma', recipeKey: 'fire+thunder' }
    ];

    const LV3_ASCENSION_HINTS = {
        fire: '【解鎖炎爆濺射 35%】',
        ice: '【解鎖 60% 深度冰封＋群體寒霜】',
        thunder: '【解鎖三連閃電】',
        steam: '【滿星高壓爆裂蒸氣】',
        magnet: '【滿星超載極地磁暴】',
        plasma: '【滿星毀滅聚焦電漿】'
    };

    CONFIG.MAX_TIER = MAX_TIER;

    GameApp.data = GameApp.data || {};
    GameApp.data.evolutions = {
        MAX_TIER,
        FUSION_RECIPES,
        FUSION_RECIPE_LIST,
        LV3_ASCENSION_HINTS
    };

    if (global.GameConfig) {
        global.GameConfig.FUSION_RECIPES = FUSION_RECIPES;
    }
})(window);
