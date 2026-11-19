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

            // ==================== Tier 2：6 主幹 ====================
            fire_trunk: {
                title: '🔥 炎核樹幹',
                nodeTier: 2,
                family: 'fire',
                formula: '🔥 火芽 + 🔥 火芽（或豐饒種子 ★★ 保底）',
                mech: '射程 2.5 格｜攻速 1.15s｜單發 58｜命中施加 35% 破甲（持續 3.5s）。純血與定向共生升級核心。',
                synergy: '同系相融可選熔核或焚世；與蒸氣／電漿共生體融合可直接定向催熟 A 分支。',
                unlockRule: '於戰場合成「🔥 火芽 + 🔥 火芽」解鎖',
                defaultUnlocked: false,
                cardClass: 'codex-plasma'
            },
            ice_trunk: {
                title: '❄️ 霜晶樹幹',
                nodeTier: 2,
                family: 'ice',
                formula: '❄️ 冰芽 + ❄️ 冰芽（或豐饒種子 ★★ 保底）',
                mech: '射程 3.0 格｜攻速 1.00s｜單發 36｜命中施加 50% 強效緩速（持續 2.2s）。',
                synergy: '同系相融可選永凍或冰錐；與蒸氣／磁環融合可定向催熟霜霧迷宮或引力黑洞。',
                unlockRule: '於戰場合成「❄️ 冰芽 + ❄️ 冰芽」解鎖',
                defaultUnlocked: false,
                cardClass: 'codex-magnet'
            },
            thunder_trunk: {
                title: '⚡ 雷紋樹幹',
                nodeTier: 2,
                family: 'thunder',
                formula: '⚡ 雷芽 + ⚡ 雷芽（或豐饒種子 ★★ 保底）',
                mech: '射程 3.8 格｜攻速 0.85s｜單發 26｜真 3 體不重複閃電連鎖（100% / 65% / 45%）。',
                synergy: '同系相融可選連鎖天雷或落雷審判；與磁環／電漿融合可定向催熟 B 分支。',
                unlockRule: '於戰場合成「⚡ 雷芽 + ⚡ 雷芽」解鎖',
                defaultUnlocked: false,
                cardClass: 'codex-steam'
            },
            steam_trunk: {
                title: '💨 蒸氣噴泉',
                nodeTier: 2,
                family: 'steam',
                formula: '🔥 火芽 + ❄️ 冰芽',
                mech: '射程 2.7 格｜攻速 1.10s｜單發 48｜無視目標 45% 護甲並產生 1.3 格 70% 爆裂濺射（享火／冰 135% 親和增傷）。',
                synergy: '中期破甲清怪主力，依後續配合炎核或霜晶可定向開花焦熱蒸壓／霜霧迷宮。',
                unlockRule: '於戰場合成「🔥 火芽 + ❄️ 冰芽」解鎖',
                defaultUnlocked: false,
                cardClass: 'codex-steam'
            },
            magnet_trunk: {
                title: '💠 極地磁環',
                nodeTier: 2,
                family: 'magnet',
                formula: '❄️ 冰芽 + ⚡ 雷芽',
                mech: '射程 3.2 格｜攻速 1.00s｜單發 30｜對目標周圍 1.3 格施加 45% 群體緩速，並向 2 名不同敵人彈跳（70% 傷害）。',
                synergy: '兼顧群緩與連鎖的中堅樞紐，可進一步開花引力黑洞或電磁超載。',
                unlockRule: '於戰場合成「❄️ 冰芽 + ⚡ 雷芽」解鎖',
                defaultUnlocked: false,
                cardClass: 'codex-magnet'
            },
            plasma_trunk: {
                title: '☄️ 電漿導管',
                nodeTier: 2,
                family: 'plasma',
                formula: '🔥 火芽 + ⚡ 雷芽',
                mech: '射程 3.6 格｜攻速 0.45s｜單發 13｜無視 15% 護甲，鎖定同目標最高疊加 4 層（每層 +12% 傷害）。',
                synergy: '高頻單體輸出核心，部署於元素靈脈能顯著縮短疊傷暖機時間。',
                unlockRule: '於戰場合成「🔥 火芽 + ⚡ 雷芽」解鎖',
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
                mech: '射程 2.8 格｜攻速 1.35s｜單發 185｜1.3 格範圍 60% 爆裂濺射，同時對範圍敵軍施加 45% 群體破甲（持續 4.0s）。',
                synergy: '搭配 💠A 引力黑洞樹聚怪或 ❄️A 永凍領域樹定身後一砲重創，重裝魔像群剋星。',
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
                mech: '射程 3.0 格｜攻速 0.88s｜單發 100｜最高 5 層灼燒（每層 8 + 0.35% MaxHP/s，離射程仍燒滿 5s 且每 2s 向 1.2 格傳染 1 層），附 50% 重傷減療與 <12% 生命處決。',
                synergy: '適合前置點火讓灼燒瘟疫一路擴散，配合 💨B 霜霧迷宮樹易傷將持續傷害推向極限。',
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
                mech: '射程 3.2 格｜攻速 1.10s｜單發 82｜1.5 格範圍 60% 群體緩速；對緩速目標每第 4 擊觸發 0.9s 凍結（Boss 0.45s，解凍後 6s 冰凍免疫）。',
                synergy: '強控鎖門核心！配合 ❄️B 冰錐穿刺樹與 💨A 焦熱蒸壓樹蒸氣池可封鎖整條迴廊。',
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
                mech: '射程 3.5 格｜攻速 0.90s｜單發 68｜直線貫穿 2 名敵人（第 2 目標 60% 傷害），對緩速／凍結／定身敵人造成 +55% 碎冰暴擊傷害。',
                synergy: '置於直線長跑道末端效果最佳，配合 ❄️A 永凍領域或 💨B 霜霧迷宮全程觸發 55% 碎冰增傷。',
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
                mech: '射程 4.0 格｜攻速 0.85s｜單發 52｜真 4 體不重複閃電連鎖（100% / 75% / 55% / 40%），大範圍穩定削血與清場。',
                synergy: '搭配 💠B 電磁超載樹感電附傷或世界樹「超導雷網」祝福，迅速瓦解分裂史萊姆海。',
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
                mech: '射程 4.8 格｜攻速 1.30s｜單發 105｜超遠全場威懾，每第 3 發召喚 2.2x 審判落雷並無視 40% 目標護甲。',
                synergy: '佔領制高點可覆蓋近 6.2 格半徑，與 ☄️A 聚變死光樹合力瞬殺 Wave 5／10 領主魔王。',
                unlockRule: '合成兩座 ⚡ 雷紋樹幹並選擇分支 B 解鎖',
                defaultUnlocked: false,
                cardClass: 'codex-steam'
            },
            steam_A: {
                title: '💨A 焦熱蒸壓樹',
                nodeTier: 3,
                family: 'steam',
                branchCode: 'A',
                formula: '💨 蒸氣 + 🔥 炎核（定向）｜💨 蒸氣 × 2 或 🔥 炎核 + ❄️ 霜晶（選 A）',
                mech: '射程 2.9 格｜攻速 1.10s｜單發 110｜無視 65% 護甲 ＋ 1.4 格 65% 爆裂濺射，命中點留下 3.0s 滾燙蒸氣池（每秒 28 點持續傷害）。',
                synergy: '陣地型高穿甲火力核心！極度契合 💠A 引力黑洞樹或世界樹「根鬚纏繞」，將敵群留置蒸氣池內灼毀。',
                unlockRule: '透過火系蒸氣定向催熟或蒸氣分岔選 A 解鎖',
                defaultUnlocked: false,
                cardClass: 'codex-steam'
            },
            steam_B: {
                title: '💨B 霜霧迷宮樹',
                nodeTier: 3,
                family: 'steam',
                branchCode: 'B',
                formula: '💨 蒸氣 + ❄️ 霜晶（定向）｜💨 蒸氣 × 2 或 🔥 炎核 + ❄️ 霜晶（選 B）',
                mech: '射程 3.1 格｜攻速 1.10s｜單發 90｜1.6 格大範圍霜霧覆蓋，群體 35% 緩速並施加 +20% 濕冷易傷（持續 3.0s，全隊共享增益）。',
                synergy: '全遊戲最強團隊輔助節點之一，能同時放大 🔥B 焚世灼燒、☄️A 死光與 ❄️B 碎冰傷害。',
                unlockRule: '透過冰系蒸氣定向催熟或蒸氣分岔選 B 解鎖',
                defaultUnlocked: false,
                cardClass: 'codex-magnet'
            },
            magnet_A: {
                title: '💠A 引力黑洞樹',
                nodeTier: 3,
                family: 'magnet',
                branchCode: 'A',
                formula: '💠 磁環 + ❄️ 霜晶（定向）｜💠 磁環 × 2 或 ❄️ 霜晶 + ⚡ 雷紋（選 A）',
                mech: '射程 3.3 格｜攻速 1.25s｜單發 86｜1.5 格 45% 群體緩速，每第 3 次脈衝將範圍內非 Boss 敵人沿路徑往回拉扯 0.45 格（底線為起點）。',
                synergy: '控場引擎核心！把突防獵犬與史萊姆拉回 🔥A 熔核與 💨A 蒸氣池交火重疊區。',
                unlockRule: '透過冰系磁環定向催熟或磁環分岔選 A 解鎖',
                defaultUnlocked: false,
                cardClass: 'codex-magnet'
            },
            magnet_B: {
                title: '💠B 電磁超載樹',
                nodeTier: 3,
                family: 'magnet',
                branchCode: 'B',
                formula: '💠 磁環 + ⚡ 雷紋（定向）｜💠 磁環 × 2 或 ❄️ 霜晶 + ⚡ 雷紋（選 B）',
                mech: '射程 3.5 格｜攻速 0.95s｜單發 64｜3 目標不重複電磁彈跳（75%），施加 3.5s 感電：任何防禦塔命中感電怪皆額外觸發 +12 雷電附傷（0.35s 單體冷卻）。',
                synergy: '高攻速流派催化劑！搭配 ☄️ 雙電漿塔與 ⚡A 連鎖天雷可每秒連續引爆多輪感電火花。',
                unlockRule: '透過雷系磁環定向催熟或磁環分岔選 B 解鎖',
                defaultUnlocked: false,
                cardClass: 'codex-steam'
            },
            plasma_A: {
                title: '☄️A 聚變死光樹',
                nodeTier: 3,
                family: 'plasma',
                branchCode: 'A',
                formula: '☄️ 電漿 + 🔥 炎核（定向）｜☄️ 電漿 × 2 或 🔥 炎核 + ⚡ 雷紋（選 A）',
                mech: '射程 3.9 格｜攻速 0.40s｜單發 32｜鎖定單目標最高疊滿 8 層（每層 +18%，最高 2.44x），達 5 層以上附加 45% 穿甲，切換目標僅退 2 層。',
                synergy: '魔王與重甲魔像專武！置於元素靈脈或搭配「自然狂熱」狂飆攻速，迅速打穿高血量領主。',
                unlockRule: '透過火系電漿定向催熟或電漿分岔選 A 解鎖',
                defaultUnlocked: false,
                cardClass: 'codex-plasma'
            },
            plasma_B: {
                title: '☄️B 弧光折射樹',
                nodeTier: 3,
                family: 'plasma',
                branchCode: 'B',
                formula: '☄️ 電漿 + ⚡ 雷紋（定向）｜☄️ 電漿 × 2 或 🔥 炎核 + ⚡ 雷紋（選 B）',
                mech: '射程 3.9 格｜攻速 0.50s｜單發 34｜主光束最高 4 層聚焦（每層 +15%），射擊時自動向主目標 2.4 格內最多 2 名敵人折射 50% 副光束。',
                synergy: '兼顧蓄能打王與雙線散射，配合 💠B 電磁超載感電能同時對三名敵人觸發附傷。',
                unlockRule: '透過雷系電漿定向催熟或電漿分岔選 B 解鎖',
                defaultUnlocked: false,
                cardClass: 'codex-steam'
            }
        },
        monsters: {
            wood: {
                title: '🌿 蔓藤巨魔',
                subtitle: '弱點：🔥 火屬性（175% 暴擊）',
                desc: '森林常見的堅韌樹怪，移速均衡，部署火芽或焚世餘燼樹可迅速瓦解其防線。',
                unlockRule: 'Wave 1 起登場',
                defaultUnlocked: true
            },
            lava: {
                title: '🌋 熔岩傀儡',
                subtitle: '弱點：❄️ 冰屬性（175% 暴擊）',
                desc: '由熾熱岩漿凝聚而成的重步兵，血量偏高，懼怕寒霜緩速與永凍凍結。',
                unlockRule: 'Wave 1 起登場',
                defaultUnlocked: true
            },
            air: {
                title: '🛸 機械飛艇',
                subtitle: '弱點：⚡ 雷屬性（175% 暴擊）',
                desc: '高速推進的古代浮空艇，能迅速掠過前線，宜用長射程雷芽／落雷審判樹攔截。',
                unlockRule: 'Wave 1 起登場',
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
                title: '🪨 障礙地塊',
                subtitle: '地形限制：不可建造防禦塔',
                desc: '古老巨岩與崎嶇障礙，無法部署防禦塔，但不會阻擋遠程砲塔的彈道射線。',
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
        plasma_B_refract: '主束蓄能雙弧光折射'
    };

    /**
     * 為未在 codex_data.js 填寫文案的新增防禦塔自動生成預設圖鑑卡
     */
    function buildFallbackTowerCard(towerKey, towerCfg) {
        const tierNum = Number(towerCfg.nodeTier || towerCfg.tier) || 1;
        const dmgVal = Number.isFinite(towerCfg.damage)
            ? towerCfg.damage
            : (Array.isArray(towerCfg.tierDamage) ? towerCfg.tierDamage[tierNum] || towerCfg.tierDamage[1] : 25);
        const sec = Number(((towerCfg.attackIntervalMs || 1000) / 1000).toFixed(2));
        const styleText = ATTACK_STYLE_LABELS[towerCfg.attackStyle] || towerCfg.attackStyle || '元素打擊';
        const badgesText = Array.isArray(towerCfg.badges) && towerCfg.badges.length > 0
            ? towerCfg.badges.join(' · ')
            : styleText;
        const lineage = towerCfg.lineagePath || `${towerCfg.icon || '✨'} ${towerCfg.name || towerKey}`;
        return {
            title: `${towerCfg.icon || '✨'} ${towerCfg.name || towerKey}`,
            nodeTier: tierNum,
            family: towerCfg.family || towerCfg.elementTag || 'steam',
            branchCode: towerCfg.branchCode || null,
            formula: lineage,
            mech: `射程 ${towerCfg.range || 2.5} 格｜攻速 ${sec}s｜單發傷害 ${dmgVal}｜特性：${badgesText}。`,
            synergy: towerCfg.roleSummary || '可自由搭配減速或易傷節點放大輸出。',
            recipeText: `${towerCfg.icon || '✨'} <strong>${towerCfg.name || towerKey}</strong> <span class="num" style="font-size:12px;color:#B8C2BC;">｜${lineage}</span>`,
            lockedRecipeText: `<strong>？？？ · 未知世界樹節點</strong> <span class="num" style="font-size:12px;color:#B8C2BC;">｜${lineage}</span>`,
            desc: `射程 ${towerCfg.range || 2.5} 格｜攻速 ${sec}s｜單發傷害 ${dmgVal}｜特性：${badgesText}。`,
            unlockRule: towerCfg.isHybrid ? '於戰場中合成此共生節點後解鎖' : '於戰場中召喚或進化至此節點後解鎖',
            defaultUnlocked: tierNum <= 1 && !towerCfg.isHybrid,
            cardClass: 'codex-steam'
        };
    }

    /**
     * 為未在 codex_data.js 填寫文案的新增怪物自動生成預設圖鑑卡
     */
    function buildFallbackMonsterCard(monsterKey, mCfg) {
        const towersDict = (GameApp.data && GameApp.data.towers && GameApp.data.towers.TOWERS) || {};
        const wCfg = towersDict[mCfg.weakness];
        const weakName = wCfg ? `${wCfg.icon} ${wCfg.name}` : (mCfg.weakness || '無');
        const minW = Number(mCfg.minWave) || 1;
        return {
            title: `${mCfg.icon || '👾'} ${mCfg.name || monsterKey}`,
            subtitle: `弱點：${weakName}｜基礎血量 ${mCfg.baseHp || 70} · 護甲 ${mCfg.baseArmor || 0}`,
            desc: `移速倍率 ${mCfg.speedMult || 1.0}x，擊殺賞金 +${mCfg.baseReward || 10} 💰${mCfg.splitsOnDeath ? '（具備死亡分裂特性）' : ''}。`,
            unlockRule: `於戰場遭遇「${mCfg.name || monsterKey}」（Wave ${minW}+）後自動解鎖`,
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
