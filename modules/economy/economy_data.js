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
        // ==================== 第 3 階段：5 星世界樹金字塔與漸進式吞噬充能 ====================
        FRUIT_FEED_NUTRITION_U: 4,          // 萬能融合果實用於 3★/4★ 塔時直接提供 +4U 營養
        SCION_AURA_RADIUS_CELLS: 2.2,       // 5★ 世界樹神裔周圍友軍光環半徑 (2.2 格)
        SCION_AURA_SPEED_BONUS: 0.16,       // 5★ 光環友軍攻速加成 (+16%，仍受 2.50x 上限約束)
        SCION_AURA_RANGE_BONUS: 0.30,       // 5★ 光環友軍射程加成 (+0.30 格)
        SCION_AURA_POWER_BONUS: 0.08,       // 5★ 光環併入 b_blessing 加法桶 (+0.08，受 0.30 上限約束)
        SCION_PULSE_INTERVAL_MS: 6000,      // 5★ 週期性全圖神樹脈動間隔 (6.0 秒)
        SCION_PULSE_DAMAGE_RATIO: 0.40,     // 5★ 全圖神樹脈動傷害係數 (0.40 * D_tier)
        SELL_REFUND_RATE: 0.70,             // 出售防禦塔預設退還累計投入金幣比例 (70%)
        SELL_REFUND_RATE_LV2: 0.80,         // 聚寶根鬚 Lv.2 黃金根脈起出售防禦塔退費比例 (80%)
        COMBAT_MOVE_COST: 5,                // 戰鬥出怪/清場期間移塔戰術調度費 (5 金幣)
        NON_COMBAT_GAIN_BASE: 22,           // 單波非戰鬥淨收益軟上限基礎值：maxNonCombatGain(w) = 22 + 8 * w
        NON_COMBAT_GAIN_PER_WAVE: 8,        // 單波非戰鬥淨收益軟上限每波成長值：8 * w
        INFUSION_BASE_COST: 150,            // 無盡靈脈灌注第 k 次費用基礎值：150 + 75 * k
        INFUSION_STEP_COST: 75,             // 無盡靈脈灌注第 k 次費用步長：75 * k
        TREASURE_ROOTS_FIXED_GAIN: [0, 15, 32, 42],
        TREASURE_ROOTS_LV3_INTEREST_RATE: 0.08,
        TREASURE_ROOTS_LV3_INTEREST_CAP: 35,
        BASE_TOWER_CAP: 16,                 // 棋盤精兵人口基礎上限 (16 座)
        TOWER_CAP_STEP: 2,                  // 每次擴充 +2 塔位槽
        TOWER_CAP_EXPANSION_COSTS: [200, 350, 550], // 16 → 18 → 20 → 22 擴充費用
        ENDLESS_GOLD_SINK_MIN_WAVE: 11,     // 無盡 W11+ 金幣回收池解鎖波數
        GLOBAL_TREE_BOOST_BASE_COST: 300,   // 世界樹全局靈脈強化費用：300 + 150 * n
        GLOBAL_TREE_BOOST_STEP_COST: 150,
        GLOBAL_TREE_BOOST_EARLY_RATE: 0.08, // Lv.1 ~ Lv.5 每級全場 B_power +8%
        GLOBAL_TREE_BOOST_LATE_RATE: 0.05,  // Lv.6 起每級全場 B_power +5%
        CROWN_REFINE_COSTS: [250, 400, 550],// 4★ 古冠精煉 1~3 階費用
        CROWN_REFINE_BONUS_PER_LEVEL: 0.10, // 每階併入 B_power +10%
        CROWN_REFINE_MAX_LEVEL: 3,
        // ==================== 第 2 階段：元素股市、命運種子盲盒與波次對賭懸賞 ====================
        STOCK_INITIAL_PRICE: 20,            // 三元素股初始價格 (20 金)
        STOCK_MIN_PRICE: 10,                // 股價下限 (10 金)
        STOCK_MAX_PRICE: 60,                // 股價上限 (60 金)
        STOCK_MAX_SHARES: 10,               // 單一元素最多持倉股數 (10 股)
        STOCK_SELL_FEE: 0.05,               // 賣出股票手續費 (5%)
        STOCK_SELL_FEE_META: 0.02,          // 世界樹年輪「財富枝 ③」降為 2% 手續費
        STOCK_INTEL_COEFF: 0.24,            // 下波預告內線趨勢係數：mu_intel = 0.24 * (r_e - 1/3)
        STOCK_NOISE_AMP: 0.025,             // 溫和隨機波動幅度（不反轉顯著預告訊號）
        STOCK_DIVIDEND_PER_SHARE: 0.024,    // 每持有 1 股提供對應元素塔 b_dividend +0.024
        STOCK_DIVIDEND_CAP: 0.24,           // 持滿 10 股最高 b_dividend +0.24 (+24%)
        THIEF_KILL_GOLD_BONUS: 60,          // 靈脈竊賊擊殺額外金幣 (60 金，受單波非戰鬥軟上限約束)
        STEAM_B_MIST_GOLD_BONUS_RATE: 0.15, // 霜霧迷宮樹範圍內擊殺金幣額外 +15%（受單波非戰鬥軟上限約束）
        BLIND_BOX_COST_MULT: 1.15,          // 盲盒定價係數：round(1.15 * avgShopCost)
        BLIND_BOX_MIN_COST: 35,             // 盲盒最低價格 (35 金)
        BLIND_BOX_MAX_COST: 85,             // 盲盒最高價格 (85 金)
        BLIND_BOX_PROBS: {                  // 盲盒機率分布：1★ 48%、2★ 32%、萬能果實 12%、3★ 8%
            TIER_1: 0.48,
            TIER_2: 0.32,
            FRUIT: 0.12,
            TIER_3: 0.08
        },
        BLIND_BOX_PITY_STREAK: 3,           // 連續 3 次只開出 1★ 時，第 4 次必出 2★ 以上
        BLIND_BOX_PITY_STREAK_META: 2,      // 世界樹年輪「命運枝 ③」保底降為連續 2 次（第 3 抽必出）
        BLIND_BOX_PITY_TIER3_CHANCE: 0.25,  // 第 4 抽保底觸發時，25% 機率直出 3★（75% 出 2★）
        BLIND_BOX_CRIT_BONUS_STEP: 0.015,   // 每次未出 2★ 以上為全隊疊加 +1.5% 暴擊率
        BLIND_BOX_CRIT_BONUS_CAP: 0.15,     // 全隊盲盒保底暴擊率上限 +15%
        FUSION_FRUIT_MAX_SLOTS: 3,          // 萬能融合果實庫存上限 (3 顆)
        FUSION_FRUIT_OVERFLOW_GOLD: 80,     // 滿 3/3 顆時溢出自動折現補償 (+80 💰，不受軟上限截斷)
        WAGER_ZERO_LEAK_STAKE: 40,          // 零封懸賞押注金幣 (40 金)
        WAGER_ZERO_LEAK_NET_PROFIT: 30,     // 零封懸賞成功淨利 (+30 金，受單波非戰鬥軟上限約束)
        WAGER_ZERO_LEAK_FAIL_DEW: 15,       // 零封懸賞失敗補償靈露 (+15 靈露)
        WAGER_SURGE_HP_MULT: 1.25,          // 魔潮加碼：本波怪物血量 +25%
        WAGER_SURGE_SPEED_MULT: 1.10,       // 魔潮加碼：本波怪物移速 +10%
        WAGER_SURGE_KILL_GOLD_MULT: 1.45,   // 魔潮加碼：本波擊殺賞金 ×1.45
        WAGER_SURGE_MAX_PER_RUN: 2,         // 魔潮加碼：每局限觸發 2 次
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
        SELL_REFUND_RATE: ECONOMY_DATA.SELL_REFUND_RATE,
        COMBAT_MOVE_COST: ECONOMY_DATA.COMBAT_MOVE_COST
    });

    GameApp.data = GameApp.data || {};
    GameApp.data.economy = ECONOMY_DATA;
})(window);
