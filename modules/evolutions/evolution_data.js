/**
 * ============================================================================
 * 【檔案名稱】：modules/evolutions/evolution_data.js
 * 【負責功能】：存放元素世界樹 5 星金字塔（MAX_TIER = 5，最高 16U）、營養與濃縮效率階梯、
 *               T1→T2 純血與共生主幹配方、T2→T3 完整 12 冠枝分岔、T3→T4 極意古冠／雙生神冠 AB、
 *               以及 T4→T5 六大血脈世界樹神裔進化規則表。
 * 【讀取資料】：無（本檔為純進化與融合配方表，供 evolution_system.js 與 codex_system.js 讀取）。
 * 【常見修改入口】：
 *   1. 修改 T1→T2 / T2→T3 / T3→T4 / T4→T5 規則：調整對應配方表。
 *   2. 修改星級營養門檻或濃縮效率 E(star)：調整 STAR_NUTRITION_U 與 STAR_CONCENTRATION_EFFICIENCY。
 * ============================================================================
 */
(function (global) {
    'use strict';

    const GameApp = global.GameApp = global.GameApp || {};
    const CONFIG = GameApp.config || {};

    const MAX_TIER = 5;

    // 5 星世界樹金字塔（最高 16U 營養單位）
    const STAR_NUTRITION_U = {
        1: 1,
        2: 2,
        3: 4,
        4: 8,
        5: 16
    };

    // 單位濃縮效率係數 E(star)
    const STAR_CONCENTRATION_EFFICIENCY = {
        1: 1.00,
        2: 1.075,
        3: 1.15,
        4: 1.20,
        5: 1.24
    };

    const LINEAGE_FAMILIES = ['fire', 'steam', 'ice', 'magnet', 'thunder', 'plasma'];
    const HYBRID_FAMILIES = ['steam', 'magnet', 'plasma'];
    const TRI_ELEMENT_FAMILIES = ['storm_tri', 'starforge_tri', 'prism_tri'];
    const PARENT_LINEAGE_MAP = {
        steam: ['fire', 'ice'],
        magnet: ['ice', 'thunder'],
        plasma: ['fire', 'thunder']
    };

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
        thunder_B: '【第3發2.5x天罰穿甲】',
        steam_A: '【65%穿甲濺射＋滾燙蒸氣池】',
        steam_B: '【1.6格霜霧減速＋20%易傷】',
        magnet_A: '【群緩＋第3擊路徑回拉聚攏】',
        magnet_B: '【3體彈射＋3.5s感電附傷】',
        plasma_A: '【8層聚變死光＋45%穿甲】',
        plasma_B: '【4層主束＋雙副束折射】'
    };

    // T3 (3★, 4U) -> T4 (4★, 8U)：同分支進化為極意古冠，異分支融合為雙生神冠 AB
    const T3_TO_T4_FAMILY_TITLES = {
        fire: { crownA: '🔥4★ 極意·熾陽熔爐古冠', crownB: '🔥4★ 極意·永劫餘燼古冠', twinAB: '🔥4★AB 雙生·熾燼神冠', scion: '🔥5★ 世界樹神裔·炎煌' },
        ice: { crownA: '❄️4★ 極意·極晝冰獄古冠', crownB: '❄️4★ 極意·碎界冰槍古冠', twinAB: '❄️4★AB 雙生·霜鋒神冠', scion: '❄️5★ 世界樹神裔·極霜' },
        thunder: { crownA: '⚡4★ 極意·滅界天網古冠', crownB: '⚡4★ 極意·終焉聖裁古冠', twinAB: '⚡4★AB 雙生·霄霆神冠', scion: '⚡5★ 世界樹神裔·雷極' },
        steam: { crownA: '💨4★ 極意·深淵鍋爐古冠', crownB: '💨4★ 極意·永霧蝕骨古冠', twinAB: '💨4★AB 雙生·蒸霖神冠', scion: '💨5★ 世界樹神裔·蒼霧' },
        magnet: { crownA: '💠4★ 極意·奇點坍縮古冠', crownB: '💠4★ 極意·超頻雷網古冠', twinAB: '💠4★AB 雙生·磁穹神冠', scion: '💠5★ 世界樹神裔·星磁' },
        plasma: { crownA: '☄️4★ 極意·恆星湮滅古冠', crownB: '☄️4★ 極意·萬象稜鏡古冠', twinAB: '☄️4★AB 雙生·穹光神冠', scion: '☄️5★ 世界樹神裔·曜漿' }
    };

    const T3_TO_T4_RULES = {};
    const T4_TO_T5_RULES = {};
    const LV4_ASCENSION_HINTS = {};
    const LV5_ASCENSION_HINTS = {};

    LINEAGE_FAMILIES.forEach((fam) => {
        const titles = T3_TO_T4_FAMILY_TITLES[fam] || {};
        const aId = `${fam}_A`;
        const bId = `${fam}_B`;
        const crownAId = `${fam}_crown_A`;
        const crownBId = `${fam}_crown_B`;
        const twinId = `${fam}_twin_AB`;
        const scionId = `${fam}_scion`;

        T3_TO_T4_RULES[`${aId}+${aId}`] = {
            mode: 'crown_mastery_t4',
            family: fam,
            isTwin: false,
            resultType: crownAId,
            options: [crownAId],
            tier: 4,
            previewLabel: `極意進化 ▸ ${titles.crownA || crownAId}`
        };
        T3_TO_T4_RULES[`${bId}+${bId}`] = {
            mode: 'crown_mastery_t4',
            family: fam,
            isTwin: false,
            resultType: crownBId,
            options: [crownBId],
            tier: 4,
            previewLabel: `極意進化 ▸ ${titles.crownB || crownBId}`
        };
        T3_TO_T4_RULES[`${aId}+${bId}`] = {
            mode: 'twin_crown_t4',
            family: fam,
            isTwin: true,
            resultType: twinId,
            options: [twinId],
            tier: 4,
            previewLabel: `雙生合體 ▸ ${titles.twinAB || twinId}（A+B 雙機制共存）`
        };

        const t4Forms = [crownAId, crownBId, twinId];
        for (let i = 0; i < t4Forms.length; i++) {
            for (let j = i; j < t4Forms.length; j++) {
                const pair = [t4Forms[i], t4Forms[j]].sort().join('+');
                T4_TO_T5_RULES[pair] = {
                    mode: 'world_scion_t5',
                    family: fam,
                    resultType: scionId,
                    options: [scionId],
                    tier: 5,
                    previewLabel: `神裔降臨 ▸ ${titles.scion || scionId}（16U 友軍光環＋全圖脈動）`
                };
            }
        }

        LV4_ASCENSION_HINTS[crownAId] = '【4★ 極意古冠 · A 分支特化強化＋攻速與射程飛躍】';
        LV4_ASCENSION_HINTS[crownBId] = '【4★ 極意古冠 · B 分支特化強化＋攻速與射程飛躍】';
        LV4_ASCENSION_HINTS[twinId] = '【4★ 雙生神冠 AB · 同時繼承 A 與 B 雙核心機制】';
        LV5_ASCENSION_HINTS[scionId] = '【5★ 世界樹神裔 16U · 雙核心完全體＋2.2 格友軍光環＋6s 全圖脈動】';
    });

    // ==================== Stage 2：三元素創世融合配方 (4U / 8U) 與唯一 5★ 原初之核 (16U) ====================
    const TRI_RECIPES_T2_TO_T3 = {
        'steam_trunk+thunder_trunk': {
            resultType: 'storm_tri',
            family: 'storm_tri',
            tier: 3,
            mode: 'tri_genesis_t3',
            title: '三元創世 · 天災風暴樹',
            previewLabel: '⛈️ 三元融合 ▸ 天災風暴樹 ★★★ (4U · 全場 1.26x)'
        },
        'fire_trunk+magnet_trunk': {
            resultType: 'starforge_tri',
            family: 'starforge_tri',
            tier: 3,
            mode: 'tri_genesis_t3',
            title: '三元創世 · 星界熔爐樹',
            previewLabel: '🌋 三元融合 ▸ 星界熔爐樹 ★★★ (4U · 全場 1.26x)'
        },
        'ice_trunk+plasma_trunk': {
            resultType: 'prism_tri',
            family: 'prism_tri',
            tier: 3,
            mode: 'tri_genesis_t3',
            title: '三元創世 · 絕對零度稜鏡',
            previewLabel: '❄️ 三元融合 ▸ 絕對零度稜鏡 ★★★ (4U · 全場 1.26x)'
        }
    };

    const TRI_RECIPES_T3_TO_T4 = {
        'storm_tri+storm_tri': { resultType: 'storm_tri_4', family: 'storm_tri', tier: 4, mode: 'tri_ascend_t4' },
        'starforge_tri+starforge_tri': { resultType: 'starforge_tri_4', family: 'starforge_tri', tier: 4, mode: 'tri_ascend_t4' },
        'prism_tri+prism_tri': { resultType: 'prism_tri_4', family: 'prism_tri', tier: 4, mode: 'tri_ascend_t4' }
    };
    ['steam_A', 'steam_B'].forEach((sId) => {
        ['thunder_A', 'thunder_B'].forEach((tId) => {
            const k = [sId, tId].sort().join('+');
            TRI_RECIPES_T3_TO_T4[k] = {
                resultType: 'storm_tri_4',
                family: 'storm_tri',
                tier: 4,
                mode: 'tri_genesis_t4'
            };
        });
    });
    ['magnet_A', 'magnet_B'].forEach((mId) => {
        ['fire_A', 'fire_B'].forEach((fId) => {
            const k = [mId, fId].sort().join('+');
            TRI_RECIPES_T3_TO_T4[k] = {
                resultType: 'starforge_tri_4',
                family: 'starforge_tri',
                tier: 4,
                mode: 'tri_genesis_t4'
            };
        });
    });
    ['plasma_A', 'plasma_B'].forEach((pId) => {
        ['ice_A', 'ice_B'].forEach((iId) => {
            const k = [pId, iId].sort().join('+');
            TRI_RECIPES_T3_TO_T4[k] = {
                resultType: 'prism_tri_4',
                family: 'prism_tri',
                tier: 4,
                mode: 'tri_genesis_t4'
            };
        });
    });

    const PRIMAL_RECIPES_T4_TO_T5 = {};
    const TRI_T4_FORMS = ['storm_tri_4', 'starforge_tri_4', 'prism_tri_4'];
    for (let i = 0; i < TRI_T4_FORMS.length; i++) {
        for (let j = i; j < TRI_T4_FORMS.length; j++) {
            const pair = [TRI_T4_FORMS[i], TRI_T4_FORMS[j]].sort().join('+');
            PRIMAL_RECIPES_T4_TO_T5[pair] = {
                mode: 'primal_core_t5',
                family: 'primal_core',
                resultType: 'primal_core',
                options: ['primal_core'],
                tier: 5,
                isPrimalCore: true,
                previewLabel: '🌳 創世唯一覺醒 ▸ 原初之核 ★★★★★ (全圖限 1 座)'
            };
        }
    }

    Object.assign(LV3_ASCENSION_HINTS, {
        storm_tri: '【三元融合 3★ · 1.26x 全親和 · 2.2 格熾凍雷雲 (45% 穿甲) ＋ 雲內死亡 15% 殉爆】',
        starforge_tri: '【三元融合 3★ · 1.26x 全親和 · 1.8 格聚怪凍結 0.5s ＋ 40% 破甲超新星】',
        prism_tri: '【三元融合 3★ · 1.26x 全親和 · 3 光束折射 ＋ 5 層脆化 2.0x 碎晶冰封】'
    });
    Object.assign(LV4_ASCENSION_HINTS, {
        storm_tri_4: '【4★ 三元古冠 · 強化熾凍雷雲＋全場 1.26x 親和】',
        starforge_tri_4: '【4★ 三元古冠 · 強化超新星聚怪凍結＋全場 1.26x 親和】',
        prism_tri_4: '【4★ 三元古冠 · 強化三束零度折射＋全場 1.26x 親和】'
    });
    LV5_ASCENSION_HINTS.primal_core = '【5★ 創世世界樹·原初之核（全圖限 1 座）· 周圍 8 格靈脈連線＋5s 創世脈動】';

    CONFIG.MAX_TIER = MAX_TIER;

    GameApp.data = GameApp.data || {};
    GameApp.data.evolutions = {
        MAX_TIER,
        STAR_NUTRITION_U,
        STAR_CONCENTRATION_EFFICIENCY,
        LINEAGE_FAMILIES,
        HYBRID_FAMILIES,
        TRI_ELEMENT_FAMILIES,
        PARENT_LINEAGE_MAP,
        T1_RECIPES,
        T1_TO_T2_RECIPES,
        T2_TO_T3_RULES,
        T3_TO_T4_RULES,
        T4_TO_T5_RULES,
        TRI_RECIPES_T2_TO_T3,
        TRI_RECIPES_T3_TO_T4,
        PRIMAL_RECIPES_T4_TO_T5,
        FUSION_RECIPES,
        FUSION_RECIPE_LIST,
        LV3_ASCENSION_HINTS,
        LV4_ASCENSION_HINTS,
        LV5_ASCENSION_HINTS
    };

    if (global.GameConfig) {
        global.GameConfig.FUSION_RECIPES = FUSION_RECIPES;
        global.GameConfig.T2_TO_T3_RULES = T2_TO_T3_RULES;
        global.GameConfig.T3_TO_T4_RULES = T3_TO_T4_RULES;
        global.GameConfig.T4_TO_T5_RULES = T4_TO_T5_RULES;
        global.GameConfig.TRI_RECIPES_T2_TO_T3 = TRI_RECIPES_T2_TO_T3;
        global.GameConfig.TRI_RECIPES_T3_TO_T4 = TRI_RECIPES_T3_TO_T4;
        global.GameConfig.PRIMAL_RECIPES_T4_TO_T5 = PRIMAL_RECIPES_T4_TO_T5;
    }
})(window);
