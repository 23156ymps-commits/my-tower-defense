/**
 * ============================================================================
 * 【檔案名稱】：modules/economy/economy_data.js
 * 【負責功能】：存放全遊戲金幣與經濟純數值表（開局金幣、召喚定價遞增、賣塔退費比、戰時移塔費與提前開波獎金）。
 * 【讀取資料】：無（本檔為純數值設定表，供 economy_system.js 讀取）。
 * 【常見修改入口】：
 *   1. 修改開局預設金幣：調整 ECONOMY_DATA.INITIAL_GOLD（預設 40）。
 *   2. 修改召喚塔起跳價、每次遞增與上限：調整 BASE_COST (10)、COST_STEP (10)、COST_MAX (60)。
 * ============================================================================
 */
(function (global) {
    'use strict';

    const GameApp = global.GameApp = global.GameApp || {};
    const CONFIG = GameApp.config || {};

    const ECONOMY_DATA = {
        INITIAL_GOLD: 40,                   // 基礎開局金幣
        BASE_COST: 10,                      // 各基礎元素首次召喚價格
        COST_STEP: 10,                      // 同元素每多召喚一次遞增金額
        COST_MAX: 60,                       // 單一元素召喚價格封頂上限
        SELL_REFUND_RATE: 0.70,             // 出售防禦塔退還累計投入金幣比例 (70%)
        COMBAT_MOVE_COST: 5,                // 戰鬥出怪/清場期間移塔戰術調度費 (5 金幣)
        EARLY_WAVE_BONUS: {                 // 備戰期／波次間提前開波獎金公式參數
            BASE_BONUS: 2,
            PER_SECOND_RATE: 1.5,
            MAX_BONUS: 15
        },
        ELEMENT_PRICE_OVERRIDES: {}         // 個別元素定價覆寫表（未填寫之新角色一律自動套用上方全局預設值）
    };

    // 同步至全域與舊版相容設定
    Object.assign(CONFIG, {
        INITIAL_GOLD: ECONOMY_DATA.INITIAL_GOLD,
        BASE_COST: ECONOMY_DATA.BASE_COST,
        COST_STEP: ECONOMY_DATA.COST_STEP,
        COST_MAX: ECONOMY_DATA.COST_MAX,
        SELL_REFUND_RATE: ECONOMY_DATA.SELL_REFUND_RATE,
        COMBAT_MOVE_COST: ECONOMY_DATA.COMBAT_MOVE_COST
    });

    GameApp.data = GameApp.data || {};
    GameApp.data.economy = ECONOMY_DATA;
})(window);
