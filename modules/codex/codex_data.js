/**
 * ============================================================================
 * 【檔案名稱】：modules/codex/codex_data.js
 * 【負責功能】：獨立存放元素世界樹 21 節點（3 根芽 T1 → 6 主幹 T2 → 12 冠枝 T3）、入侵怪物與戰術地形的
 *               完整圖鑑百科文案（合成公式、核心機制、推薦搭配與預設解鎖規則），供世界樹 SVG 圖譜讀取。
 * 【讀取資料】：輔助讀取 GameApp.data.towers / monsters（無強制依賴）。
 * 【常見修改入口】：
 *   1. 修改 21 節點、怪物或地形的百科文案與推薦流派：調整 CODEX_ENTRIES。
 *   2. 修改圖鑑分頁標籤：調整 CODEX_CATEGORIES。
 * ============================================================================
 */
(function (global) {
    'use strict';

    const GameApp = global.GameApp = global.GameApp || {};

    const CODEX_CATEGORIES = [
        { id: 'fusion', label: '世界樹演化圖譜' },
        { id: 'monsters', label: '入侵魔物' },
        { id: 'terrain', label: '戰術地形' }
    ];

    /**
     * 完整 21 節點 ＋ 怪物 ＋ 地形百科條目
     */
    const CODEX_ENTRIES = {
        towers: {
            // ==================== Tier 1：3 根芽 ====================
            fire_bud: {
                title: '🔥 火芽',
                nodeTier: 1,
                family: 'fire',
                formula: '商店拖曳或快捷鍵 [1] 召喚（初始 10 💰）',
                mech: '射程 2.3 格｜攻速 1.20s｜單發 25｜命中附帶 25% 破甲（持續 3.0s）；對蔓藤巨魔／分裂史萊姆享 175% 相剋暴擊。',
                synergy: '前期抗衡高甲與木系怪核心，兩座可融為炎核主幹，或與冰芽／雷芽共生。',
                unlockRule: '開局預設解鎖',
                defaultUnlocked: true,
                cardClass: 'codex-plasma'
            },
            ice_bud: {
                title: '❄️ 冰芽',
                nodeTier: 1,
                family: 'ice',
                formula: '商店拖曳或快捷鍵 [2] 召喚（初始 10 💰）',
                mech: '射程 2.8 格｜攻速 1.00s｜單發 15｜命中施加 40% 緩速（持續 2.0s）；對熔岩傀儡／疾風獵犬享 175% 相剋暴擊。',
                synergy: '適合部署於路徑轉角拖緩敵陣，讓短射程火芽／蒸氣塔穩定輸出。',
                unlockRule: '開局預設解鎖',
                defaultUnlocked: true,
                cardClass: 'codex-magnet'
            },
            thunder_bud: {
                title: '⚡ 雷芽',
                nodeTier: 1,
                family: 'thunder',
                formula: '商店拖曳或快捷鍵 [3] 召喚（初始 10 💰）',
                mech: '射程 3.6 格｜攻速 0.90s｜單發 13｜真 2 體不重複閃電連鎖（100% / 55%，跳躍半徑 2.6 格）。',
                synergy: '適合制高點遠距覆蓋多條直線通道，專剋機械飛艇與重裝魔像。',
                unlockRule: '開局預設解鎖',
                defaultUnlocked: true,
                cardClass: 'codex-steam'
            },

            // ==================== Tier 1 異系轉職：3 新物種 (1★) ====================
            steam_bud: {
                title: '💨 蒸氣噴泉',
                nodeTier: 1,
                family: 'steam',
                formula: '🔥 火芽 (1★) + ❄️ 冰芽 (1★) 異系轉職（維持 1★）',
                mech: '射程 2.7 格｜攻速 1.10s｜單發 46｜無視目標 45% 護甲並產生 1.3 格 70% 濺射（享火／冰 135% 親和增傷）。',
                synergy: '一合成即具備高穿甲範圍爆裂火力；可再與另座蒸氣噴泉 (1★) 或火芽／冰芽灌注升為 2★。',
                unlockRule: '於戰場合成「🔥 火芽 + ❄️ 冰芽」解鎖',
                defaultUnlocked: false,
                cardClass: 'codex-steam'
            },
            magnet_bud: {
                title: '💠 極地磁環',
                nodeTier: 1,
                family: 'magnet',
                formula: '❄️ 冰芽 (1★) + ⚡ 雷芽 (1★) 異系轉職（維持 1★）',
                mech: '射程 3.2 格｜攻速 1.00s｜單發 29｜對目標周圍 1.3 格施加 45% 群體緩速，並向 2 名不同敵人彈射（70% 傷害）。',
                synergy: '兼顧群緩與彈射的 1★ 轉職中樞；可與同物種或冰芽／雷芽灌注升為 2★ 高階磁環。',
                unlockRule: '於戰場合成「❄️ 冰芽 + ⚡ 雷芽」解鎖',
                defaultUnlocked: false,
                cardClass: 'codex-magnet'
            },
            plasma_bud: {
                title: '☄️ 電漿導管',
                nodeTier: 1,
                family: 'plasma',
                formula: '🔥 火芽 (1★) + ⚡ 雷芽 (1★) 異系轉職（維持 1★）',
                mech: '射程 3.6 格｜攻速 0.45s｜單發 13｜無視 15% 護甲，連續鎖定同目標最高疊加 4 層（每層 +12% 傷害）。',
                synergy: '高頻單體輸出轉職塔；可與同物種或火芽／雷芽灌注升為 2★ 高階電漿。',
                unlockRule: '於戰場合成「🔥 火芽 + ⚡ 雷芽」解鎖',
                defaultUnlocked: false,
                cardClass: 'codex-plasma'
            },

            // ==================== Tier 2：6 進階主幹 (2★) ====================
            fire_trunk: {
                title: '🔥 炎核樹幹',
                nodeTier: 2,
                family: 'fire',
                formula: '🔥 火芽 (1★) + 🔥 火芽 (1★)（或豐饒種子 ★★ 保底）',
                mech: '射程 2.5 格｜攻速 1.15s｜單發 54｜命中施加 35% 破甲（持續 3.5s）。',
                synergy: '兩座炎核樹幹 (2★) 相融可觸發冠枝分岔（A 熔核轟擊 / B 焚世餘燼）。',
                unlockRule: '於戰場合成「🔥 火芽 + 🔥 火芽」解鎖',
                defaultUnlocked: false,
                cardClass: 'codex-plasma'
            },
            ice_trunk: {
                title: '❄️ 霜晶樹幹',
                nodeTier: 2,
                family: 'ice',
                formula: '❄️ 冰芽 (1★) + ❄️ 冰芽 (1★)（或豐饒種子 ★★ 保底）',
                mech: '射程 3.0 格｜攻速 1.00s｜單發 32｜命中施加 50% 強效緩速（持續 2.2s）。',
                synergy: '兩座霜晶樹幹 (2★) 相融可觸發冠枝分岔（A 永凍領域 / B 冰錐穿刺）。',
                unlockRule: '於戰場合成「❄️ 冰芽 + ❄️ 冰芽」解鎖',
                defaultUnlocked: false,
                cardClass: 'codex-magnet'
            },
            thunder_trunk: {
                title: '⚡ 雷紋樹幹',
                nodeTier: 2,
                family: 'thunder',
                formula: '⚡ 雷芽 (1★) + ⚡ 雷芽 (1★)（或豐饒種子 ★★ 保底）',
                mech: '射程 3.8 格｜攻速 0.85s｜單發 28｜真 3 體不重複閃電連鎖（100% / 65% / 45%）。',
                synergy: '兩座雷紋樹幹 (2★) 相融可觸發冠枝分岔（A 連鎖天雷 / B 落雷審判）。',
                unlockRule: '於戰場合成「⚡ 雷芽 + ⚡ 雷芽」解鎖',
                defaultUnlocked: false,
                cardClass: 'codex-steam'
            },
            steam_trunk: {
                title: '💨 高階蒸氣',
                nodeTier: 2,
                family: 'steam',
                formula: '💨 蒸氣噴泉 (1★) × 2｜或 💨 蒸氣 (1★) + 🔥 火芽／❄️ 冰芽灌注',
                mech: '射程 2.8 格｜攻速 1.10s｜單發 74（3U）｜無視 45% 護甲並產生 1.3 格 70% 濺射。',
                synergy: '兩座高階蒸氣 (2★) 相融可觸發冠枝分岔（A 焦熱蒸壓 / B 霜霧迷宮）。',
                unlockRule: '將兩座蒸氣噴泉 (1★) 升星或以火／冰芽灌注解鎖',
                defaultUnlocked: false,
                cardClass: 'codex-steam'
            },
            magnet_trunk: {
                title: '💠 高階磁環',
                nodeTier: 2,
                family: 'magnet',
                formula: '💠 極地磁環 (1★) × 2｜或 💠 磁環 (1★) + ❄️ 冰芽／⚡ 雷芽灌注',
                mech: '射程 3.3 格｜攻速 1.00s｜單發 48（3U）｜1.3 格 45% 群緩並彈射 2 名敵人（70%）。',
                synergy: '兩座高階磁環 (2★) 相融可觸發冠枝分岔（A 引力黑洞 / B 電磁超載）。',
                unlockRule: '將兩座極地磁環 (1★) 升星或以冰／雷芽灌注解鎖',
                defaultUnlocked: false,
                cardClass: 'codex-magnet'
            },
            plasma_trunk: {
                title: '☄️ 高階電漿',
                nodeTier: 2,
                family: 'plasma',
                formula: '☄️ 電漿導管 (1★) × 2｜或 ☄️ 電漿 (1★) + 🔥 火芽／⚡ 雷芽灌注',
                mech: '射程 3.7 格｜攻速 0.45s｜單發 21（3U）｜無視 15% 護甲，鎖定疊滿 4 層（+12%/層）。',
                synergy: '兩座高階電漿 (2★) 相融可觸發冠枝分岔（A 聚變死光 / B 弧光折射）。',
                unlockRule: '將兩座電漿導管 (1★) 升星或以火／雷芽灌注解鎖',
                defaultUnlocked: false,
                cardClass: 'codex-plasma'
            },

            // ==================== Tier 3：12 冠枝 ====================
            fire_A: {
                title: '🔥A 熔核轟擊樹',
                nodeTier: 3,
                family: 'fire',
                branchCode: 'A',
                formula: '🔥 炎核樹幹 × 2（選擇分支 A）',
                mech: '射程 2.8 格｜攻速 1.25s｜單發 115（4U）｜1.3 格範圍 60% 爆裂濺射，同時對範圍敵軍施加 45% 群體破甲（持續 4.0s）。',
                synergy: '搭配 💠A 引力黑洞樹聚怪或 ❄️A 永凍領域樹定身後一砲重創；可再融合或吞噬升至 4★ 極意／雙生。',
                unlockRule: '合成兩座 🔥 炎核樹幹並選擇分支 A 解鎖',
                defaultUnlocked: false,
                cardClass: 'codex-plasma'
            },
            fire_B: {
                title: '🔥B 焚世餘燼樹',
                nodeTier: 3,
                family: 'fire',
                branchCode: 'B',
                formula: '🔥 炎核樹幹 × 2（選擇分支 B）',
                mech: '射程 3.0 格｜攻速 0.88s｜單發 115（4U）｜最高 5 層灼燒（每層 8 + 0.35% MaxHP/s，每 2s 傳染 1 層），附 50% 重傷減療與 <12% 生命處決。',
                synergy: '適合前置點火讓灼燒瘟疫擴散；與 🔥A 相融可合體為 4★ 雙生神冠。',
                unlockRule: '合成兩座 🔥 炎核樹幹並選擇分支 B 解鎖',
                defaultUnlocked: false,
                cardClass: 'codex-plasma'
            },
            ice_A: {
                title: '❄️A 永凍領域樹',
                nodeTier: 3,
                family: 'ice',
                branchCode: 'A',
                formula: '❄️ 霜晶樹幹 × 2（選擇分支 A）',
                mech: '射程 3.2 格｜攻速 1.10s｜單發 69（4U）｜1.5 格範圍 60% 群體緩速；第 4 擊觸發 0.9s 凍結並額外爆出 1.5× 冰爆傷害。',
                synergy: '強控鎖門核心！配合 ❄️B 冰錐穿刺或兩者合體為 4★ 雙生寒獄同時兼顧凍結與碎冰暴擊。',
                unlockRule: '合成兩座 ❄️ 霜晶樹幹並選擇分支 A 解鎖',
                defaultUnlocked: false,
                cardClass: 'codex-magnet'
            },
            ice_B: {
                title: '❄️B 冰錐穿刺樹',
                nodeTier: 3,
                family: 'ice',
                branchCode: 'B',
                formula: '❄️ 霜晶樹幹 × 2（選擇分支 B）',
                mech: '射程 3.5 格｜攻速 0.90s｜單發 69（4U）｜直線貫穿 2 名敵人（第 2 目標 60%），對緩速／凍結／定身敵人造成 +55% 碎冰暴擊。',
                synergy: '置於直線長跑道效果最佳；可餵養同血脈低星芽或萬能果實逐步充能至 8U 升 4★。',
                unlockRule: '合成兩座 ❄️ 霜晶樹幹並選擇分支 B 解鎖',
                defaultUnlocked: false,
                cardClass: 'codex-magnet'
            },
            thunder_A: {
                title: '⚡A 連鎖天雷樹',
                nodeTier: 3,
                family: 'thunder',
                branchCode: 'A',
                formula: '⚡ 雷紋樹幹 × 2（選擇分支 A）',
                mech: '射程 4.0 格｜攻速 0.85s｜單發 60（4U）｜真 4 體不重複閃電連鎖（100% / 75% / 55% / 40%），大範圍穩定削血與清場。',
                synergy: '搭配 💠B 電磁超載感電或與 ⚡B 相融合體為雙生天殛。',
                unlockRule: '合成兩座 ⚡ 雷紋樹幹並選擇分支 A 解鎖',
                defaultUnlocked: false,
                cardClass: 'codex-steam'
            },
            thunder_B: {
                title: '⚡B 落雷審判樹',
                nodeTier: 3,
                family: 'thunder',
                branchCode: 'B',
                formula: '⚡ 雷紋樹幹 × 2（選擇分支 B）',
                mech: '射程 4.8 格｜攻速 1.05s｜單發 60（4U）｜超遠全場威懾，每第 3 發召喚 2.5x 審判落雷並無視 40% 目標護甲。',
                synergy: '佔領制高點覆蓋全場，與 ☄️A 聚變死光合力迅速擊潰領主。',
                unlockRule: '合成兩座 ⚡ 雷紋樹幹並選擇分支 B 解鎖',
                defaultUnlocked: false,
                cardClass: 'codex-steam'
            },
            steam_A: {
                title: '💨A 焦熱蒸壓樹',
                nodeTier: 3,
                family: 'steam',
                branchCode: 'A',
                formula: '💨 高階蒸氣 (2★) × 2（選擇分支 A）',
                mech: '射程 2.9 格｜攻速 1.10s｜單發 106（4U）｜無視 65% 護甲 ＋ 1.4 格 65% 爆裂濺射，落點留下 3.0s 滾燙蒸氣池（28/s）。',
                synergy: '陣地高穿甲火力核心！可與 💨B 合體為雙生蒸霧或繼續充能至 16U 成為世界樹神裔。',
                unlockRule: '合成兩座 💨 高階蒸氣 (2★) 並選擇分支 A 解鎖',
                defaultUnlocked: false,
                cardClass: 'codex-steam'
            },
            steam_B: {
                title: '💨B 霜霧迷宮樹',
                nodeTier: 3,
                family: 'steam',
                branchCode: 'B',
                formula: '💨 高階蒸氣 (2★) × 2（選擇分支 B）',
                mech: '射程 3.1 格｜攻速 1.10s｜單發 106（4U）｜1.6 格霜霧 35% 緩速與 +20% 易傷，範圍內敵人擊殺額外 +15% 金幣（受單波軟上限約束）。',
                synergy: '全隊核心輔助節點，同時放大 🔥B 焚世灼燒、☄️A 死光與 ❄️B 碎冰傷害。',
                unlockRule: '合成兩座 💨 高階蒸氣 (2★) 並選擇分支 B 解鎖',
                defaultUnlocked: false,
                cardClass: 'codex-magnet'
            },
            magnet_A: {
                title: '💠A 引力黑洞樹',
                nodeTier: 3,
                family: 'magnet',
                branchCode: 'A',
                formula: '💠 高階磁環 (2★) × 2（選擇分支 A）',
                mech: '射程 3.3 格｜攻速 1.25s｜單發 69（4U）｜1.5 格 45% 群體緩速，每第 3 次脈衝將範圍非 Boss 敵人沿路徑回拉 0.45 格。',
                synergy: '控場聚怪引擎，與 💠B 合體可兼具引力拉扯與 3 目標感電彈跳。',
                unlockRule: '合成兩座 💠 高階磁環 (2★) 並選擇分支 A 解鎖',
                defaultUnlocked: false,
                cardClass: 'codex-magnet'
            },
            magnet_B: {
                title: '💠B 電磁超載樹',
                nodeTier: 3,
                family: 'magnet',
                branchCode: 'B',
                formula: '💠 高階磁環 (2★) × 2（選擇分支 B）',
                mech: '射程 3.5 格｜攻速 0.95s｜單發 69（4U）｜3 目標不重複彈跳（75%），施加 3.5s 感電：任何塔命中觸發 +（10 + 2.5 × 波數）雷傷。',
                synergy: '高攻速流派催化劑！搭配 ☄️ 雙電漿與 ⚡A 連鎖天雷連續引爆感電火花。',
                unlockRule: '合成兩座 💠 高階磁環 (2★) 並選擇分支 B 解鎖',
                defaultUnlocked: false,
                cardClass: 'codex-steam'
            },
            plasma_A: {
                title: '☄️A 聚變死光樹',
                nodeTier: 3,
                family: 'plasma',
                branchCode: 'A',
                formula: '☄️ 高階電漿 (2★) × 2（選擇分支 A）',
                mech: '射程 3.9 格｜攻速 0.40s｜單發 30（4U）｜鎖定單目標最高疊滿 8 層（每層 +18%），達 5 層附加 45% 穿甲，換怪僅退 2 層。',
                synergy: '重裝魔像與魔王剋星；充能至 5★ 神裔後疊層上限更可突破至 12 層。',
                unlockRule: '合成兩座 ☄️ 高階電漿 (2★) 並選擇分支 A 解鎖',
                defaultUnlocked: false,
                cardClass: 'codex-plasma'
            },
            plasma_B: {
                title: '☄️B 弧光折射樹',
                nodeTier: 3,
                family: 'plasma',
                branchCode: 'B',
                formula: '☄️ 高階電漿 (2★) × 2（選擇分支 B）',
                mech: '射程 3.9 格｜攻速 0.50s｜單發 30（4U）｜主光束最高 4 層聚焦（每層 +15%），自動向 2.4 格內最多 2 名敵人折射 50% 副光束。',
                synergy: '兼顧蓄能與雙線散射，與 ☄️A 合體成為終極聚變雙生冠。',
                unlockRule: '合成兩座 ☄️ 高階電漿 (2★) 並選擇分支 B 解鎖',
                defaultUnlocked: false,
                cardClass: 'codex-steam'
            },
            storm_tri: {
                title: '⛈️ 天災風暴樹',
                nodeTier: 3,
                family: 'storm_tri',
                branchCode: '三',
                formula: '💨 高階蒸氣 (2★) ＋ ⚡ 雷紋 (2★)（共 4U，三元融合）',
                mech: '射程 3.5 格｜攻速 1.00s｜主炮 110 ＋雲傷 60.3/s（4U，多目標 291 DPS）｜全體恆享 1.26× 親和｜生成 2.2 格漂移熾凍雷雲（45% 穿甲＋35% 緩速），雲內死亡觸發 15% 最大生命殉爆。',
                synergy: '融合蒸氣破甲與雷雲持續群傷，對 100% 怪物（含無盡輪換魔王）無屬性盲區。',
                unlockRule: '以任意 2★ 蒸氣 ＋ 2★ 雷紋拖拉融合解鎖（3★／4U）',
                defaultUnlocked: false,
                cardClass: 'codex-thunder'
            },
            storm_tri_4: {
                title: '⛈️ 太古天災風暴樹',
                nodeTier: 4,
                family: 'storm_tri',
                branchCode: '4★',
                formula: '💨 蒸氣冠枝 (3★) ＋ ⚡ 雷冠枝 (3★) 或餵滿 8U',
                mech: '射程 3.8 格｜攻速 0.90s｜主炮 230 ＋雲傷 115/s（8U）｜全體 1.26× 親和｜2.2 格熾凍雷雲 45% 穿甲與 42% 緩速，雲內擊殺持續引發 15% 殉爆。',
                synergy: '餵滿 16U 或與另一座異種 4★ 三元塔互合可覺醒唯一 5★ 原初之核。',
                unlockRule: '3★ 蒸氣冠枝 ＋ 3★ 雷冠枝融合，或將天災風暴樹餵滿 8U 解鎖',
                defaultUnlocked: false,
                cardClass: 'codex-thunder'
            },
            starforge_tri: {
                title: '🌋 星界熔爐樹',
                nodeTier: 3,
                family: 'starforge_tri',
                branchCode: '三',
                formula: '💠 高階磁環 (2★) ＋ 🔥 炎核 (2★)（共 4U，三元融合）',
                mech: '射程 3.4 格｜攻速 1.15s｜單發 101（4U）｜全體恆享 1.26× 親和｜超新星爆發：1.8 格引力聚怪＋0.5s 凍結（受首領減半與冷卻免疫約束）＋40% 破甲＋50% 重傷。',
                synergy: '強控聚怪兼重裝破防核心，大幅放大群攻陣線的清場效率。',
                unlockRule: '以任意 2★ 磁環 ＋ 2★ 炎核拖拉融合解鎖（3★／4U）',
                defaultUnlocked: false,
                cardClass: 'codex-fire'
            },
            starforge_tri_4: {
                title: '🌋 太古星界熔爐樹',
                nodeTier: 4,
                family: 'starforge_tri',
                branchCode: '4★',
                formula: '💠 磁環冠枝 (3★) ＋ 🔥 火冠枝 (3★) 或餵滿 8U',
                mech: '射程 3.7 格｜攻速 1.00s｜單發 211（8U）｜全體 1.26× 親和｜2.0 格超新星聚怪＋0.55s 凍結＋48% 破甲＋55% 重傷。',
                synergy: '餵滿 16U 或與另一座異種 4★ 三元塔互合可覺醒唯一 5★ 原初之核。',
                unlockRule: '3★ 磁環冠枝 ＋ 3★ 火冠枝融合，或將星界熔爐樹餵滿 8U 解鎖',
                defaultUnlocked: false,
                cardClass: 'codex-fire'
            },
            prism_tri: {
                title: '❄️ 絕對零度稜鏡',
                nodeTier: 3,
                family: 'prism_tri',
                branchCode: '三',
                formula: '☄️ 高階電漿 (2★) ＋ ❄️ 霜晶 (2★)（共 4U，三元融合）',
                mech: '射程 3.9 格｜攻速 0.40s｜單束 38（4U，單體 95 / 3 束 199 DPS）｜全體恆享 1.26× 親和｜1 主＋2 副折射光束，疊滿 5 層熱脹冷縮脆化觸發 2.0× 碎晶爆發並冰封 0.8s。',
                synergy: '兼顧多線連擊與週期冰封爆發，對高護甲或高機動突圍單位俱佳。',
                unlockRule: '以任意 2★ 電漿 ＋ 2★ 霜晶拖拉融合解鎖（3★／4U）',
                defaultUnlocked: false,
                cardClass: 'codex-ice'
            },
            prism_tri_4: {
                title: '❄️ 太古絕對零度稜鏡',
                nodeTier: 4,
                family: 'prism_tri',
                branchCode: '4★',
                formula: '☄️ 電漿冠枝 (3★) ＋ ❄️ 冰冠枝 (3★) 或餵滿 8U',
                mech: '射程 4.2 格｜攻速 0.36s｜單束 79（8U）｜全體 1.26× 親和｜3 光束 62% 折射疊層加速，滿 5 層觸發 2.25× 碎晶爆發與 0.9s 冰封。',
                synergy: '餵滿 16U 或與另一座異種 4★ 三元塔互合可覺醒唯一 5★ 原初之核。',
                unlockRule: '3★ 電漿冠枝 ＋ 3★ 冰冠枝融合，或將絕對零度稜鏡餵滿 8U 解鎖',
                defaultUnlocked: false,
                cardClass: 'codex-ice'
            },
            primal_core: {
                title: '✦ 創世世界樹·原初之核',
                nodeTier: 5,
                family: 'primal_core',
                branchCode: '核',
                formula: '任意三元塔餵滿 16U，或兩座不同 4★ 三元塔互合（全圖唯一限 1 座）',
                mech: '射程 4.6 格｜攻速 0.85s｜單發 476（16U，30% 穿甲＋1.6 格 72% 濺射）｜全體恆享 1.26× 親和｜牽引周圍 8 格友塔金色靈脈，每 5 秒彙整全元素釋放一次創世脈動。',
                synergy: '戰場中樞唯一奇觀！場上已存在 1 座時，系統將禁止再合成或升級第 2 座原初之核。',
                unlockRule: '將任意三元塔充能至 16U，或兩座不同 4★ 三元塔融合覺醒',
                defaultUnlocked: false,
                cardClass: 'codex-plasma'
            }
        },
        monsters: {
            wood: {
                title: '🌿 蔓藤巨魔',
                subtitle: '弱點：🔥 火屬性（175% 暴擊）',
                desc: '森林常見的堅韌樹怪，移速均衡，部署火芽或焚世餘燼樹可迅速瓦解其防線。',
                unlockRule: '第 1 波起登場',
                defaultUnlocked: true
            },
            lava: {
                title: '🌋 熔岩傀儡',
                subtitle: '弱點：❄️ 冰屬性（175% 暴擊）',
                desc: '由熾熱岩漿凝聚而成的重步兵，血量偏高，懼怕寒霜緩速與永凍凍結。',
                unlockRule: '第 1 波起登場',
                defaultUnlocked: true
            },
            air: {
                title: '🛸 機械飛艇',
                subtitle: '弱點：⚡ 雷屬性（175% 暴擊）',
                desc: '高速推進的古代浮空艇，能迅速掠過前線，宜用長射程雷芽／落雷審判樹攔截。',
                unlockRule: '第 1 波起登場',
                defaultUnlocked: true
            },
            hound: {
                title: '🐺 疾風獵犬',
                subtitle: '弱點：❄️ 冰屬性｜特殊機制：極速突襲',
                desc: '移動速度高達 1.65 倍的敏捷獵犬，務必配置冰芽、霜霧迷宮或引力黑洞控場。',
                unlockRule: '推進至第 2 波遭遇「疾風獵犬」後自動解鎖',
                defaultUnlocked: false
            },
            slime: {
                title: '🟢 分裂史萊姆',
                subtitle: '弱點：🔥 火屬性｜特殊機制：死亡分裂',
                desc: '被擊殺時會就地分裂為 2 隻迷你史萊姆，適合以蒸氣濺射或連鎖天雷清場。',
                unlockRule: '推進至第 3 波遭遇「分裂史萊姆」後自動解鎖',
                defaultUnlocked: false
            },
            golem: {
                title: '🗿 重裝魔像',
                subtitle: '弱點：⚡ 雷屬性｜特殊機制：高額原生護甲',
                desc: '自帶厚重岩石護甲的巨型魔像，需依靠破甲火系、高穿甲蒸氣或聚變死光貫穿。',
                unlockRule: '推進至第 4 波遭遇「重裝魔像」後自動解鎖',
                defaultUnlocked: false
            },
            guardian: {
                title: '🛡️ 護盾守衛',
                subtitle: '弱點：⚡ 雷屬性｜特殊機制：45% 最大生命能量護盾',
                desc: '進場附帶 45% 最大生命護盾的重衛單位，雷、極地磁環與電漿對護盾造成 1.4× 破盾效率。',
                unlockRule: '推進至第 6 波遭遇「護盾守衛」後自動解鎖',
                defaultUnlocked: false
            },
            healer: {
                title: '🌿 癒合花妖',
                subtitle: '弱點：🔥 火屬性｜特殊機制：3s 群體治療 6% 生命',
                desc: '每 3.0 秒為周圍 1.5 格友軍恢復 6% 最大生命；極懼🔥B 焚世餘燼樹的 50% 重傷效果。',
                unlockRule: '推進至第 7 波遭遇「癒合花妖」後自動解鎖',
                defaultUnlocked: false
            },
            panther: {
                title: '🐾 虛空影豹',
                subtitle: '弱點：❄️ 冰屬性｜特殊機制：半血隱身疾行',
                desc: '首次血量低於 50% 時進入 2.2 秒隱身 (+65% 移速) 並免疫單體鎖定；範圍 AoE 與冰凍可使其破隱現形。',
                unlockRule: '推進至第 8 波遭遇「虛空影豹」後自動解鎖',
                defaultUnlocked: false
            },
            bomber: {
                title: '💣 自爆蟲王',
                subtitle: '弱點：❄️ 冰屬性｜特殊機制：死亡震爆癱瘓塔基',
                desc: '若未在減速或凍結狀態下擊殺，死亡時將震爆並癱瘓周圍 1.4 格防禦塔 1.5 秒。',
                unlockRule: '推進至第 9 波遭遇「自爆蟲王」後自動解鎖',
                defaultUnlocked: false
            },
            thief: {
                title: '🦊 靈脈竊賊',
                subtitle: '弱點：⚡ 雷屬性｜經濟驚喜怪（不扣世界樹生命）',
                desc: '於 W3 / W6 / W9 沿跑道高速逃竄（高血量無護甲）；逃出終點不會扣血，擊殺可獲 +60 金幣與隨機 1 股或盲盒代幣（受單波軟上限約束）。',
                unlockRule: '於世界樹年輪解鎖「古樹枝 ②」並在 W3 / W6 / W9 遭遇後解鎖',
                defaultUnlocked: false
            }
        },
        terrain: {
            highground: {
                title: '⛰️ 制高點',
                subtitle: '戰術增益：攻擊射程 +30%',
                desc: '視野遼闊的隆起高台，適合部署短射程火芽／蒸壓塔或極限放大落雷審判樹覆蓋半徑。',
                defaultUnlocked: true
            },
            mana_vein: {
                title: '✨ 元素靈脈',
                subtitle: '戰術增益：攻擊速度 +25%',
                desc: '湧動古代魔力的晶石地脈，能大幅提升永凍疊擊與聚變死光蓄能效率。',
                defaultUnlocked: true
            },
            world_tree: {
                title: '🌿 世界樹庇護所',
                subtitle: '戰術增益：依基地血量最高 +20% 傷害',
                desc: '受世界樹根系祝福的聖地，基地保持高血量時可為主力 T3 冠枝提供終局火力加成。',
                defaultUnlocked: true
            },
            obstacle: {
                title: '🪨 古代巨岩障礙',
                subtitle: '地脈拓荒：花費 45 💰 爆破開採',
                desc: '初期阻礙建塔的古代岩石，點擊可花費 45 金爆破移除，有機率挖掘出✨ 元素靈脈或⛰️ 制高點。',
                defaultUnlocked: true
            },
            leyline_links: {
                title: '🔗 鄰格靈脈陣法',
                subtitle: '上限鎖：單塔最多 2 連線 · 增傷總計 +18% 上限（併入 B_power）',
                desc: '相鄰（上下左右）不同元素塔自動激活共鳴：🔥+❄️冷熱對流（10%破甲+10%緩速）、❄️+⚡超導寒流（攻速+10%）、🔥+⚡高壓過載（暴擊+10%）、🔺火冰雷三元陣法（傷害+15% ＋ 擊殺額外+1💧，冷卻1.5s/每波上限12）。',
                defaultUnlocked: true
            },
            weather_sun: {
                title: '☀️ 熾陽季（動態天象）',
                subtitle: '每 3 波輪換 · 火股看漲 +10%',
                desc: '火系射程 +0.4、灼燒傷害 +25%，但冰緩效力 -15%；🔥 火股波末結算趨勢獲得 +10% 利多。',
                defaultUnlocked: true
            },
            weather_snow: {
                title: '❄️ 霜雪季（動態天象）',
                subtitle: '每 3 波輪換 · 冰股看漲 +10%',
                desc: '全場敵軍移速 -10%、冰系暴擊 +15%，無特殊地形草地建塔 +5 💰（高台／靈脈／庇護所免加價）；❄️ 冰股獲 +10% 利多。',
                defaultUnlocked: true
            },
            weather_storm: {
                title: '⛈️ 雷暴季（動態天象）',
                subtitle: '每 3 波輪換 · 雷股波動率 ×2',
                desc: '戰鬥每 6 秒降下天雷劈擊最高血量敵軍並連鎖彈跳；⚡ 雷股波動率翻倍（仍受 [10, 60] 價格鎖約束）。',
                defaultUnlocked: true
            },
            weather_eclipse: {
                title: '🌑 蝕月黑潮（魔王天象）',
                subtitle: 'W10 / W15 / W20 降臨 · 高壓高賞金',
                desc: '敵軍獲得 15% 減傷護盾，但擊殺賞金 +30%（受 22+8w 軟上限約束）、靈露 +30%、盲盒 3★ 機率翻倍。',
                defaultUnlocked: true
            }
        }
    };

    const ATTACK_STYLE_LABELS = {
        burst_armor_break: '灼燒破甲爆發',
        fire_A_mortar: '範圍濺射破甲重砲',
        fire_B_ember: '5 層灼燒傳染與斬殺',
        slow_control: '寒霜緩速控場',
        ice_A_permafrost: '範圍寒霜與 4 擊冰凍',
        ice_B_icicle: '直線穿透與碎冰增傷',
        chain_lightning: '多目標不重複連鎖',
        thunder_B_judgment: '遠程狙擊與落雷審判',
        aoe_mist: '穿甲範圍爆裂蒸氣',
        steam_A_pressure: '高穿甲蒸氣池灼燒',
        steam_B_fog: '濕冷迷霧群緩易傷',
        stun_pulse: '感電冰環群緩彈跳',
        magnet_A_singularity: '引力黑洞退路拉扯',
        magnet_B_overload: '3 目標彈跳與感電引爆',
        pierce_beam: '高頻聚焦疊傷光束',
        plasma_A_deathray: '8 層超載聚變死光',
        plasma_B_refract: '主束蓄能雙弧光折射',
        fire_twin: '重砲群破＋焚世灼燒斬殺雙極',
        ice_twin: '永凍領域凍結＋貫穿碎冰雙極',
        thunder_twin: '連鎖天雷電網＋2.4x 穿甲落雷雙極',
        steam_twin: '高壓蒸氣池＋霜霧群緩易傷雙極',
        magnet_twin: '奇點回拉聚怪＋電磁感電超載雙極',
        plasma_twin: '8 層聚變死光＋雙副束折射雙極',
        tri_storm_cloud: '2.2 格漂移熾凍雷雲＋45% 穿甲＋15% 殉爆',
        tri_starforge_nova: '1.8 格聚怪凍結＋40% 破甲超新星＋重傷',
        tri_prism_zero: '3 束折射＋5 層脆化碎晶爆發冰封',
        primal_genesis: '8 鄰金色靈脈＋5s 全元素創世脈動'
    };

    const ATTACK_STYLE_LABELS_EN = {
        burst_armor_break: 'Armor-Shredding Burst',
        fire_A_mortar: 'AoE Splash + Armor Shred Mortar',
        fire_B_ember: '5-Stack Contagious Burn & Execute',
        slow_control: 'Frost Slow Control',
        ice_A_permafrost: 'AoE Slow & 4-Hit Permafrost Freeze',
        ice_B_icicle: 'Linear Pierce & Shatter Bonus',
        chain_lightning: 'Multi-Target Non-Repeating Chain',
        thunder_B_judgment: 'Long-Range Snipe & Sky Judgment',
        aoe_mist: 'Armor-Piercing Steam Splash',
        steam_A_pressure: 'High-Pierce Steam Pool Burn',
        steam_B_fog: 'Chilling Mist AoE Slow & Vuln',
        stun_pulse: 'AoE Slow + Shock Bounces',
        magnet_A_singularity: 'Gravity Well Path Pull-Back',
        magnet_B_overload: '3-Target Bounce + Heavy Shock',
        pierce_beam: 'High-Frequency Focus Beam',
        plasma_A_deathray: '8-Stack Overcharged Deathray',
        plasma_B_refract: 'Primary Beam + Twin Refract Arcs',
        fire_twin: 'Dual Mortar Shred + Burn Execute',
        ice_twin: 'Dual Permafrost Freeze + Icicle Pierce',
        thunder_twin: 'Dual Chain Grid + 2.4x Verdict',
        steam_twin: 'Dual Steam Pool + Chilling Fog Vuln',
        magnet_twin: 'Dual Gravity Pull + Shock Overload',
        plasma_twin: 'Dual 8-Stack Deathray + Refract Beams',
        tri_storm_cloud: '2.2-Cell Storm Cloud + 45% Pierce + 15% Martyr Burst',
        tri_starforge_nova: '1.8-Cell Vortex Freeze + 40% Shred Nova + Wound',
        tri_prism_zero: '3-Beam Refract + 5-Stack Shatter Freeze',
        primal_genesis: '8-Neighbor Ley-Lines + 5s Genesis Pulse'
    };

    /**
     * 為未在 codex_data.js 填寫文案的新增防禦塔（含 4★ 極意／雙生與 5★ 世界樹神裔）自動生成完整圖鑑卡
     */
    function buildFallbackTowerCard(towerKey, towerCfg) {
        const isEn = Boolean(GameApp.i18n && typeof GameApp.i18n.isEnglish === 'function' && GameApp.i18n.isEnglish());
        const tierNum = Number(towerCfg.nodeTier || towerCfg.tier) || 1;
        const dmgVal = Number.isFinite(towerCfg.damage)
            ? towerCfg.damage
            : (Array.isArray(towerCfg.tierDamage) ? towerCfg.tierDamage[tierNum] || towerCfg.tierDamage[1] : 25);
        const sec = Number(((towerCfg.attackIntervalMs || 1000) / 1000).toFixed(2));
        const styleText = isEn
            ? (ATTACK_STYLE_LABELS_EN[towerCfg.attackStyle] || towerCfg.attackStyle || 'Elemental Strike')
            : (ATTACK_STYLE_LABELS[towerCfg.attackStyle] || towerCfg.attackStyle || '元素打擊');
        const badgesText = isEn
            ? (towerCfg.tooltipSummary || towerCfg.roleSummary || styleText)
            : (Array.isArray(towerCfg.badges) && towerCfg.badges.length > 0 ? towerCfg.badges.join(' · ') : styleText);
        const lineage = isEn
            ? (towerCfg.lineagePath || `${towerCfg.icon || '🔥'} ${towerCfg.name || towerKey}`)
            : (Array.isArray(towerCfg.defaultLineagePath)
                ? towerCfg.defaultLineagePath.join(' ▸ ')
                : (towerCfg.lineagePath || `${towerCfg.icon || '🔥'} ${towerCfg.name || towerKey}`));
        let formulaText = lineage;
        let synergyText = towerCfg.roleSummary || (isEn
            ? 'Pairs cleanly with slow or vulnerability nodes to amplify DPS.'
            : '可自由搭配減速或易傷節點放大輸出。');
        let unlockText = isEn
            ? (towerCfg.isHybrid ? 'Synthesize this hybrid node in battle to unlock.' : 'Summon or evolve into this node in battle to unlock.')
            : (towerCfg.isHybrid ? '於戰場中合成此共生節點後解鎖' : '於戰場中召喚或進化至此節點後解鎖');
        if (tierNum === 4) {
            if (isEn) {
                const bCode = towerCfg.branchCode || '';
                formulaText = towerCfg.isTwinCrown
                    ? 'Same-lineage 3★ A + 3★ B Twin Fusion (or feed to 8U)'
                    : `Same-lineage 3★ ${bCode} × 2 Mastery Evolution (or feed to 8U)`;
                unlockText = towerCfg.isTwinCrown
                    ? 'Merge same-lineage 3★ A + 3★ B in battle to unlock Twin Crown.'
                    : `Merge same-lineage 3★ ${bCode} × 2 or feed to 8U to unlock.`;
            } else {
                formulaText = towerCfg.isTwinCrown
                    ? '同血脈 3★ A + 3★ B 雙生合體（或餵養充滿 8U）'
                    : `同血脈 3★ ${towerCfg.branchCode || ''} × 2 極意進化（或餵養充滿 8U）`;
                unlockText = towerCfg.isTwinCrown
                    ? '於戰場合成同血脈異分支「3★ A + 3★ B」解鎖雙生神冠'
                    : `於戰場合成同血脈同分支「3★ ${towerCfg.branchCode || ''} × 2」或餵養滿 8U 解鎖`;
            }
        } else if (tierNum === 5) {
            if (isEn) {
                formulaText = 'Any same-lineage 4★ × 2 (or feed 4★ to 16U)';
                synergyText = 'Projects a 2.2-cell Ally Aura (+16% ATK Spd · +0.3 Rng) and 6.0s World Pulse; supports Endless Vein Infusion when selected.';
                unlockText = 'Ascend same-lineage dual 4★ or feed a 4★ tower to 16U in battle to unlock World Tree Scion.';
            } else {
                formulaText = '同血脈任意 4★ × 2（或 4★ 餵養充能滿 16U）';
                synergyText = '整合周圍 2.2 格友軍光環（攻速 +16% · 射程 +0.3 格）與 6.0s 全圖神樹脈動；選取後可進行無盡靈脈灌注。';
                unlockText = '於戰場晉升同血脈雙 4★ 或漸進吞噬達 16U 解鎖世界樹神裔';
            }
        }
        const mechText = isEn
            ? `Rng ${towerCfg.range || 2.5} | CD ${sec}s | DMG ${dmgVal} | ${badgesText}.`
            : `射程 ${towerCfg.range || 2.5} 格｜攻速 ${sec}s｜單發 ${dmgVal}｜特性：${badgesText}。`;
        return {
            title: `${towerCfg.icon || '🔥'} ${towerCfg.name || towerKey}`,
            nodeTier: tierNum,
            family: towerCfg.family || towerCfg.elementTag || 'steam',
            branchCode: towerCfg.branchCode || null,
            formula: formulaText,
            mech: mechText,
            synergy: synergyText,
            recipeText: `${towerCfg.icon || '🔥'} <strong>${towerCfg.name || towerKey}</strong> <span class="num" style="font-size:12px;color:#B8C2BC;">｜${formulaText}</span>`,
            lockedRecipeText: `<strong>${isEn ? '??? · Unknown World Tree Node' : '？？？ · 未知世界樹節點'}</strong> <span class="num" style="font-size:12px;color:#B8C2BC;">｜${formulaText}</span>`,
            desc: mechText,
            unlockRule: unlockText,
            defaultUnlocked: tierNum <= 1 && !towerCfg.isHybrid,
            cardClass: 'codex-steam'
        };
    }

    /**
     * 為未在 codex_data.js 填寫文案的新增怪物自動生成預設圖鑑卡
     */
    function buildFallbackMonsterCard(monsterKey, mCfg) {
        const isEn = Boolean(GameApp.i18n && typeof GameApp.i18n.isEnglish === 'function' && GameApp.i18n.isEnglish());
        const towersDict = (GameApp.data && GameApp.data.towers && GameApp.data.towers.TOWERS) || {};
        const wCfg = towersDict[mCfg.weakness];
        const weakLabel = (GameApp.i18n && typeof GameApp.i18n.getWeaknessLabel === 'function')
            ? GameApp.i18n.getWeaknessLabel(mCfg.weakness)
            : (wCfg ? wCfg.name : (mCfg.weakness || (isEn ? 'None' : '無')));
        const weakName = wCfg ? `${wCfg.icon} ${weakLabel}` : weakLabel;
        const minW = Number(mCfg.minWave) || 1;
        return {
            title: `${mCfg.icon || '👾'} ${mCfg.name || monsterKey}`,
            subtitle: isEn
                ? `Weak: ${weakName} | Base HP ${mCfg.baseHp || 70} · ARM ${mCfg.baseArmor || 0}`
                : `弱點：${weakName}｜基礎血量 ${mCfg.baseHp || 70} · 護甲 ${mCfg.baseArmor || 0}`,
            desc: isEn
                ? `Speed ${mCfg.speedMult || 1.0}x, Kill bounty +${mCfg.baseReward || 10} 💰${mCfg.splitsOnDeath ? ' (Splits on death)' : ''}.`
                : `移速倍率 ${mCfg.speedMult || 1.0}x，擊殺賞金 +${mCfg.baseReward || 10} 💰${mCfg.splitsOnDeath ? '（具備死亡分裂特性）' : ''}。`,
            unlockRule: isEn
                ? `Unlocks upon encountering ${mCfg.name || monsterKey} (Wave ${minW}+).`
                : `於戰場遭遇「${mCfg.name || monsterKey}」（第 ${minW} 波起）後自動解鎖`,
            defaultUnlocked: minW <= 1
        };
    }

    GameApp.data = GameApp.data || {};
    GameApp.data.codex = {
        CODEX_CATEGORIES,
        CODEX_ENTRIES,
        ATTACK_STYLE_LABELS,
        buildFallbackTowerCard,
        buildFallbackMonsterCard
    };
})(window);
