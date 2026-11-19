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

    // 1★ + 1★ 轉職／升星配方表（Key 為排序後的兩個 1★ 標準節點 ID）
    // - 異系基礎 1★ 相融 -> 1★ 新轉職物種（不升星）
    // - 同物種 1★ 相融 -> 2★ 高階主幹
    // - 同血脈基礎 1★ 灌注轉職 1★ -> 2★ 高階轉職主幹（需經過確認防手滑）
    const T1_RECIPES = {
        // 異系轉職 (1★ + 1★ -> 1★ 新物種)
        'fire_bud+ice_bud': { resultType: 'steam_bud', resultTier: 1, isCrossElement: true, mode: 'transfer_t1', requiresConfirmation: false },
        'ice_bud+thunder_bud': { resultType: 'magnet_bud', resultTier: 1, isCrossElement: true, mode: 'transfer_t1', requiresConfirmation: false },
        'fire_bud+thunder_bud': { resultType: 'plasma_bud', resultTier: 1, isCrossElement: true, mode: 'transfer_t1', requiresConfirmation: false },

        // 同物種升星 (1★ + 1★ -> 2★)
        'fire_bud+fire_bud': { resultType: 'fire_trunk', resultTier: 2, isCrossElement: false, mode: 'star_up_t2', requiresConfirmation: false },
        'ice_bud+ice_bud': { resultType: 'ice_trunk', resultTier: 2, isCrossElement: false, mode: 'star_up_t2', requiresConfirmation: false },
        'thunder_bud+thunder_bud': { resultType: 'thunder_trunk', resultTier: 2, isCrossElement: false, mode: 'star_up_t2', requiresConfirmation: false },
        'steam_bud+steam_bud': { resultType: 'steam_trunk', resultTier: 2, isCrossElement: true, mode: 'star_up_t2', requiresConfirmation: false },
        'magnet_bud+magnet_bud': { resultType: 'magnet_trunk', resultTier: 2, isCrossElement: true, mode: 'star_up_t2', requiresConfirmation: false },
        'plasma_bud+plasma_bud': { resultType: 'plasma_trunk', resultTier: 2, isCrossElement: true, mode: 'star_up_t2', requiresConfirmation: false },

        // 轉職系快捷元素灌注（同血脈基礎 1★ + 轉職 1★ -> 該轉職系 2★，需彈窗確認防手滑）
        'fire_bud+steam_bud': { resultType: 'steam_trunk', resultTier: 2, isCrossElement: true, mode: 'infusion_single', requiresConfirmation: true, title: '元素灌注升星 · 高階蒸氣' },
        'ice_bud+steam_bud': { resultType: 'steam_trunk', resultTier: 2, isCrossElement: true, mode: 'infusion_single', requiresConfirmation: true, title: '元素灌注升星 · 高階蒸氣' },
        'ice_bud+magnet_bud': { resultType: 'magnet_trunk', resultTier: 2, isCrossElement: true, mode: 'infusion_single', requiresConfirmation: true, title: '元素灌注升星 · 高階磁環' },
        'magnet_bud+thunder_bud': { resultType: 'magnet_trunk', resultTier: 2, isCrossElement: true, mode: 'infusion_single', requiresConfirmation: true, title: '元素灌注升星 · 高階磁環' },
        'fire_bud+plasma_bud': { resultType: 'plasma_trunk', resultTier: 2, isCrossElement: true, mode: 'infusion_single', requiresConfirmation: true, title: '元素灌注升星 · 高階電漿' },
        'plasma_bud+thunder_bud': { resultType: 'plasma_trunk', resultTier: 2, isCrossElement: true, mode: 'infusion_single', requiresConfirmation: true, title: '元素灌注升星 · 高階電漿' }
    };

    // 相容舊鍵別名
    const T1_TO_T2_RECIPES = T1_RECIPES;

    // 向下相容跨元素配方查表
    const FUSION_RECIPES = {
        'fire+ice': 'steam_bud',
        'ice+thunder': 'magnet_bud',
        'fire+thunder': 'plasma_bud',
        'fire_bud+ice_bud': 'steam_bud',
        'ice_bud+thunder_bud': 'magnet_bud',
        'fire_bud+thunder_bud': 'plasma_bud'
    };

    // 結構化融合配方清單（供圖鑑與合成系統自動掃描）
    const FUSION_RECIPE_LIST = [
        { ingredients: ['fire_bud', 'ice_bud'], resultType: 'steam_bud', trunkType: 'steam_trunk', recipeKey: 'fire_bud+ice_bud', branches: ['steam_A', 'steam_B'] },
        { ingredients: ['ice_bud', 'thunder_bud'], resultType: 'magnet_bud', trunkType: 'magnet_trunk', recipeKey: 'ice_bud+thunder_bud', branches: ['magnet_A', 'magnet_B'] },
        { ingredients: ['fire_bud', 'thunder_bud'], resultType: 'plasma_bud', trunkType: 'plasma_trunk', recipeKey: 'fire_bud+thunder_bud', branches: ['plasma_A', 'plasma_B'] }
    ];

    /**
     * T2 (2★) -> T3 (3★) 冠枝進化規則表（6 大物種各自「同物種 2★ + 2★」觸發雙分支輪盤）
     */
    const T2_TO_T3_RULES = {
        'fire_trunk+fire_trunk': {
            mode: 'dual_choice',
            family: 'fire',
            options: ['fire_A', 'fire_B'],
            title: '炎核樹幹 · 冠枝分岔開花',
            previewLabel: '🔥 冠枝進化 ▸ A 熔核轟擊 / B 焚世餘燼'
        },
        'ice_trunk+ice_trunk': {
            mode: 'dual_choice',
            family: 'ice',
            options: ['ice_A', 'ice_B'],
            title: '霜晶樹幹 · 冠枝分岔開花',
            previewLabel: '❄️ 冠枝進化 ▸ A 永凍領域 / B 冰錐穿刺'
        },
        'thunder_trunk+thunder_trunk': {
            mode: 'dual_choice',
            family: 'thunder',
            options: ['thunder_A', 'thunder_B'],
            title: '雷紋樹幹 · 冠枝分岔開花',
            previewLabel: '⚡ 冠枝進化 ▸ A 連鎖天雷 / B 落雷審判'
        },
        'steam_trunk+steam_trunk': {
            mode: 'dual_choice',
            family: 'steam',
            options: ['steam_A', 'steam_B'],
            title: '高階蒸氣 · 冠枝分岔開花',
            previewLabel: '💨 冠枝進化 ▸ A 焦熱蒸壓 / B 霜霧迷宮'
        },
        'magnet_trunk+magnet_trunk': {
            mode: 'dual_choice',
            family: 'magnet',
            options: ['magnet_A', 'magnet_B'],
            title: '高階磁環 · 冠枝分岔開花',
            previewLabel: '💠 冠枝進化 ▸ A 引力黑洞 / B 電磁超載'
        },
        'plasma_trunk+plasma_trunk': {
            mode: 'dual_choice',
            family: 'plasma',
            options: ['plasma_A', 'plasma_B'],
            title: '高階電漿 · 冠枝分岔開花',
            previewLabel: '☄️ 冠枝進化 ▸ A 聚變死光 / B 弧光折射'
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
        T1_RECIPES,
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
