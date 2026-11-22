/**
 * ============================================================================
 * 【檔案名稱】：modules/economy/economy_data.js
 * 【負責功能】：存放全遊戲金幣與經濟純數值表（開局金幣、召喚定價遞增、賣塔退費比、戰時移塔費與提前開波獎金）。
 * 【讀取資料】：無（本檔為純數值設定表，供 economy_system.js 讀取）。
 * 【常見修改入口】：
 *   1. 修改開局預設金幣：調整 ECONOMY_DATA.INITIAL_GOLD（預設 40）。
 *   2. 修改召喚塔階梯定價曲線與上限：調整 SUMMON_COST_STEPS 與 COST_MAX (80)。
 * ============================================================================
 */
(function (global) {
    'use strict';

    const GameApp = global.GameApp = global.GameApp || {};
    const CONFIG = GameApp.config || {};

    const ECONOMY_DATA = {
        INITIAL_GOLD: 40,                   // 基礎開局金幣
        BASE_COST: 10,                      // 各基礎元素首次召喚價格
        COST_STEP: 8,                       // 無階梯陣列時之備用線性步長
        COST_MAX: 80,                       // 單一元素召喚價格封頂上限 (80 金幣)
        SUMMON_COST_STEPS: [10, 18, 26, 35, 45, 55, 68, 80], // 平滑友善階梯定價曲線
        OBSTACLE_CLEAR_COST: 45,            // 地脈拓荒（爆破岩石障礙）固定花費
        CROWN_AWAKEN_GOLD_COST: 220,        // 無盡模式 T4 世界樹聖冠覺醒金幣消耗
        CROWN_AWAKEN_DEW_COST: 60,          // 無盡模式 T4 世界樹聖冠覺醒靈露消耗
        SELL_REFUND_RATE: 0.70,             // 出售防禦塔預設退還累計投入金幣比例 (70%)
        SELL_REFUND_RATE_LV2: 0.80,         // 聚寶根鬚 Lv.2 黃金根脈起出售防禦塔退費比例 (80%)
        COMBAT_MOVE_COST: 5,                // 戰鬥出怪/清場期間移塔戰術調度費 (5 金幣)
        NON_COMBAT_GAIN_BASE: 22,           // 單波非戰鬥淨收益軟上限基礎值：maxNonCombatGain(w) = 22 + 8 * w
        NON_COMBAT_GAIN_PER_WAVE: 8,        // 單波非戰鬥淨收益軟上限每波成長值：8 * w
        INFUSION_BASE_COST: 150,            // 無盡靈脈灌注第 k 次費用基礎值：150 + 75 * k
        INFUSION_STEP_COST: 75,             // 無盡靈脈灌注第 k 次費用步長：75 * k
        TREASURE_ROOTS_COSTS: [0, 45, 75, 110],
        TREASURE_ROOTS_FIXED_GAIN: [0, 15, 32, 42],
        TREASURE_ROOTS_LV3_INTEREST_RATE: 0.08,
        TREASURE_ROOTS_LV3_INTEREST_CAP: 35,
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
        OBSTACLE_CLEAR_COST: ECONOMY_DATA.OBSTACLE_CLEAR_COST,
        CROWN_AWAKEN_GOLD_COST: ECONOMY_DATA.CROWN_AWAKEN_GOLD_COST,
        CROWN_AWAKEN_DEW_COST: ECONOMY_DATA.CROWN_AWAKEN_DEW_COST,
        SELL_REFUND_RATE: ECONOMY_DATA.SELL_REFUND_RATE,
        COMBAT_MOVE_COST: ECONOMY_DATA.COMBAT_MOVE_COST
    });

    GameApp.data = GameApp.data || {};
    GameApp.data.economy = ECONOMY_DATA;
})(window);
