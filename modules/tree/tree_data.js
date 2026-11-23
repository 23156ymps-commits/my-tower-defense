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
        BLESSING_DEW_OVERCHARGE_CHANCE: 0.40,
        ROOT_MAX_LEVEL: 3,
        NON_COMBAT_GAIN_BASE: 22,
        NON_COMBAT_GAIN_PER_WAVE: 8
    };

    // 世界樹「聚寶根鬚（Lv.0 → Lv.3）」經營系統設定表（不占棋盤格）
    const TREASURE_ROOTS_LEVELS = {
        0: {
            level: 0,
            id: 'root_lv0',
            name: '未啟用',
            nameEn: 'Dormant Roots',
            cost: 0,
            fixedWaveGold: 0,
            interestRate: 0,
            interestCap: 0,
            sellRefundRate: 0.70,
            shortDesc: '波末額外 +0 💰 · 出售退費 70%',
            shortDescEn: 'Wave End +0 💰 · Sell Refund 70%',
            desc: '尚未升級聚寶根鬚，全場出售防禦塔退費率為 70%。',
            descEn: 'Treasure Roots not yet awakened. Tower sell refund rate is 70%.'
        },
        1: {
            level: 1,
            id: 'root_lv1',
            name: '汲取根鬚',
            nameEn: 'Siphon Roots',
            cost: 45,
            fixedWaveGold: 15,
            interestRate: 0,
            interestCap: 0,
            sellRefundRate: 0.70,
            shortDesc: '每清完 1 波固定額外獲得 +15 💰',
            shortDescEn: 'Each wave cleared grants +15 💰',
            desc: '每清完 1 波固定額外獲得 +15 💰。',
            descEn: 'Grants a fixed +15 💰 bonus after clearing each wave.'
        },
        2: {
            level: 2,
            id: 'root_lv2',
            name: '黃金根脈',
            nameEn: 'Golden Veins',
            cost: 75,
            fixedWaveGold: 32,
            interestRate: 0,
            interestCap: 0,
            sellRefundRate: 0.80,
            shortDesc: '每波 +32 💰 · 全場出售退費率 70% → 80%',
            shortDescEn: 'Wave End +32 💰 · Sell Refund 70% → 80%',
            desc: '每清完 1 波固定額外獲得 +32 💰，且全場出售防禦塔退費率從 70% 提升為 80%。',
            descEn: 'Grants +32 💰 per cleared wave and raises tower sell refund from 70% to 80%.'
        },
        3: {
            level: 3,
            id: 'root_lv3',
            name: '複利樹心',
            nameEn: 'Compound Heart',
            cost: 110,
            fixedWaveGold: 42,
            interestRate: 0.08,
            interestCap: 35,
            sellRefundRate: 0.80,
            shortDesc: '每波 +42 💰 ＋ 現金 8% 利息（上限 +35 💰，軟上限 22 + 8w）',
            shortDescEn: 'Wave End +42 💰 + 8% Interest (cap +35 💰, soft cap 22 + 8w)',
            desc: '每清完 1 波固定額外獲得 +42 💰 ＋ 當前持有現金的 8% 利息（單波利息部分上限 +35 💰，且受單波非戰鬥淨收益軟上限 22 + 8w 約束）。',
            descEn: 'Grants +42 💰 + 8% cash interest per wave (interest cap +35 💰, bound by wave soft cap 22 + 8w).'
        }
    };

    function getTreasureRootLevelSpec(level = 0) {
        const lv = Math.max(0, Math.min(3, Math.floor(Number(level) || 0)));
        return TREASURE_ROOTS_LEVELS[lv] || TREASURE_ROOTS_LEVELS[0];
    }

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
        },
        golden_harvest: {
            id: 'golden_harvest',
            name: '黃金豐收',
            nameEn: 'Golden Harvest',
            hotkey: 'E',
            cost: 50,
            cdMs: 14000,
            baseGold: 25,
            perWaveGold: 3
        }
    };

    // 第 4 階段：局外 12 節點「世界樹年輪（Meta Tree）」（3 條機制枝 × 4 節點，無純數值膨脹）
    const META_TREE_BRANCHES = [
        {
            id: 'wealth',
            name: '財富枝',
            nameEn: 'Wealth Branch',
            desc: '聚寶根鬚 · 元素股市 · 經濟底蘊',
            descEn: 'Treasure Roots · Element Stocks · Economy Core'
        },
        {
            id: 'fate',
            name: '命運枝',
            nameEn: 'Fate Branch',
            desc: '命運盲盒 · 波次對賭 · 賜福重抽',
            descEn: 'Blind Box · Wave Wagers · Blessing Reroll'
        },
        {
            id: 'ancient',
            name: '古樹枝',
            nameEn: 'Ancient Branch',
            desc: '靈脈灌注 · 靈脈竊賊 · 高階賜福 · 聖冠上限',
            descEn: 'Vein Infusion · Vein Thief · Mythic Blessings · Scion Cap'
        }
    ];

    const META_TREE_NODES = {
        wealth_1: {
            id: 'wealth_1',
            branch: 'wealth',
            tier: 1,
            requires: null,
            cost: 300,
            name: '解鎖聚寶根鬚',
            nameEn: 'Unlock Treasure Roots',
            desc: '於局內世界樹商會開放升級「聚寶根鬚 Lv.1 ～ Lv.3」。',
            descEn: 'Unlocks Treasure Roots Lv.1-Lv.3 in the Guild drawer.'
        },
        wealth_2: {
            id: 'wealth_2',
            branch: 'wealth',
            tier: 2,
            requires: 'wealth_1',
            cost: 600,
            name: '解鎖元素股市',
            nameEn: 'Unlock Element Stocks',
            desc: '開放火 / 冰 / 雷元素股市買賣與持倉戰力紅利（最高 +24%）。',
            descEn: 'Unlocks Fire / Ice / Thunder stock trading & +24% dividend cap.'
        },
        wealth_3: {
            id: 'wealth_3',
            branch: 'wealth',
            tier: 3,
            requires: 'wealth_2',
            cost: 1000,
            name: '低稅商道（手續費 5% → 2%）',
            nameEn: 'Low-Tax Trade (Fee 5% → 2%)',
            desc: '元素股市賣出股票的手續費從 5% 降低為 2%。',
            descEn: 'Reduces Element Stock sell fee from 5% to 2%.'
        },
        wealth_4: {
            id: 'wealth_4',
            branch: 'wealth',
            tier: 4,
            requires: 'wealth_3',
            cost: 1500,
            name: '創始股東（開局自帶 1 股）',
            nameEn: 'Founding Shareholder',
            desc: '每局開局自動獲得 1 股隨機元素股票（含對應元素戰力紅利）。',
            descEn: 'Starts every match with 1 random elemental stock share.'
        },
        fate_1: {
            id: 'fate_1',
            branch: 'fate',
            tier: 1,
            requires: null,
            cost: 300,
            name: '解鎖命運盲盒',
            nameEn: 'Unlock Fate Blind Box',
            desc: '開放「命運種子盲盒」抽取與萬能融合果實累積保底暴擊。',
            descEn: 'Unlocks Fate Seed Blind Box & team crit pity stack.'
        },
        fate_2: {
            id: 'fate_2',
            branch: 'fate',
            tier: 2,
            requires: 'fate_1',
            cost: 600,
            name: '解鎖波次對賭',
            nameEn: 'Unlock Wave Wagers',
            desc: '開放開波前「零封懸賞」與「魔潮加碼」高風險對賭選項。',
            descEn: 'Unlocks Zero-Leak Bounty and Monster Surge wagers.'
        },
        fate_3: {
            id: 'fate_3',
            branch: 'fate',
            tier: 3,
            requires: 'fate_2',
            cost: 1000,
            name: '命運加護（保底 4 → 3 抽）',
            nameEn: 'Fate Pity (4 → 3 Pulls)',
            desc: '命運盲盒 1★ 保底次數由第 4 抽必出提前至第 3 抽必出 2★ 以上。',
            descEn: 'Guarantees 2★+ on the 3rd blind box pull instead of the 4th.'
        },
        fate_4: {
            id: 'fate_4',
            branch: 'fate',
            tier: 4,
            requires: 'fate_3',
            cost: 1500,
            name: '賜福重鑄（每局免費重抽 1 次）',
            nameEn: 'Blessing Reroll (1/Run)',
            desc: '每局獲得 1 次免費重抽世界樹三選一賜福卡牌的機會。',
            descEn: 'Grants 1 free World Tree Blessing reroll per run.'
        },
        ancient_1: {
            id: 'ancient_1',
            branch: 'ancient',
            tier: 1,
            requires: null,
            cost: 350,
            name: '解鎖靈脈灌注',
            nameEn: 'Unlock Vein Infusion',
            desc: '為 5★ 世界樹神裔開放無盡靈脈灌注，可花費金幣強化 B_power 戰力桶。',
            descEn: 'Unlocks Endless Vein Infusion for 5★ World Tree Scions.'
        },
        ancient_2: {
            id: 'ancient_2',
            branch: 'ancient',
            tier: 2,
            requires: 'ancient_1',
            cost: 700,
            name: '解鎖靈脈竊賊出現',
            nameEn: 'Unlock Treasure Thieves',
            desc: 'W3 / W6 / W9 隨機出現「靈脈竊賊」，擊殺額外掉落 +60 金幣與股票／盲盒代幣。',
            descEn: 'Spawns a Treasure Thief in W3 / W6 / W9 (+60 💰 & random stock or token).'
        },
        ancient_3: {
            id: 'ancient_3',
            branch: 'ancient',
            tier: 3,
            requires: 'ancient_2',
            cost: 1100,
            name: '解鎖 4 項秘傳賜福',
            nameEn: 'Unlock 4 Mythic Blessings',
            desc: '於賜福池加入「貪婪之根、賭徒幸運葉、內線操盤、血契狂怒」。',
            descEn: 'Adds Greedy Roots, Gambler Leaf, Insider Trading & Blood Fury to blessings.'
        },
        ancient_4: {
            id: 'ancient_4',
            branch: 'ancient',
            tier: 4,
            requires: 'ancient_3',
            cost: 1600,
            name: '聖冠覺醒上限 2 → 3 座',
            nameEn: 'Scion Crown Limit 2 → 3',
            desc: '單局場上同時共存的「聖冠／5★ 世界樹神裔」上限由 2 座提升為 3 座。',
            descEn: 'Raises max simultaneous 5★ Scion Crown towers from 2 to 3.'
        }
    };

    const META_MAX_CROWN_BASE = 2;
    const META_MAX_CROWN_UPGRADED = 3;

    // 世界樹枝枒祝福卡牌池（6 張基礎 ＋ 4 張古樹枝秘傳賜福）
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
        },
        greedy_roots: {
            id: 'greedy_roots',
            icon: '💰',
            requiresMetaNode: 'ancient_3',
            name: '貪婪之根',
            desc: '每次清波結算時，場上每有 1 種不同元素血脈額外獲得 +5 💰（受單波非戰鬥淨收益軟上限約束）。'
        },
        gambler_lucky_leaf: {
            id: 'gambler_lucky_leaf',
            icon: '★',
            requiresMetaNode: 'ancient_3',
            name: '賭徒幸運葉',
            desc: '獲得時立即提升全隊 +8% 暴擊率，零封懸賞成功淨利額外 +10 💰，盲盒未出 2★+ 改疊加 +2% 暴擊。'
        },
        insider_trading: {
            id: 'insider_trading',
            icon: '📈',
            requiresMetaNode: 'ancient_3',
            name: '內線操盤',
            desc: '元素股市賣出免手續費（0%），且持股戰力紅利提升為每股 +3.0%（仍受單塔 +24% 上限約束）。'
        },
        blood_pact_fury: {
            id: 'blood_pact_fury',
            icon: '❤️',
            requiresMetaNode: 'ancient_3',
            name: '血契狂怒',
            desc: '世界樹每損失 1 點生命，全場塔獲得 +1.5% 戰力（併入賜福上限 30%）；自然狂熱持續時間延長 +1.5 秒。'
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
        TREASURE_ROOTS_LEVELS,
        getTreasureRootLevelSpec,
        META_TREE_BRANCHES,
        META_TREE_NODES,
        META_MAX_CROWN_BASE,
        META_MAX_CROWN_UPGRADED,
        BLESSINGS_MAP,
        BLESSINGS_CATALOG,
        getBlessingsCatalog
    };

    if (global.GameConfig) {
        global.GameConfig.BLESSINGS_CATALOG = BLESSINGS_CATALOG;
    }
})(window);
