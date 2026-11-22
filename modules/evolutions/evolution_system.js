/**
 * ============================================================================
 * 【檔案名稱】：modules/evolutions/evolution_system.js
 * 【負責功能】：判定兩座世界樹防禦塔能否進行 1★～5★ 進化（T1→T2、T2→T3 雙分支、
 *               T3→T4 極意古冠／雙生神冠 AB、T4→T5 世界樹神裔）與漸進式吞噬充能（+1U/+2U/+3U/+4U），
 *               執行合成轉換與萬能融合果實升級，並嚴格守恒繼承雙方累計投入金幣（investedGold）。
 * 【讀取資料】：讀取 modules/evolutions/evolution_data.js 與 modules/towers/tower_data.js。
 * 【常見修改入口】：
 *   1. 修改能否合成、雙生合體或漸進式吞噬判定：修改 getFusionResult()、canFeedTower()、getIncompatibilityReason()。
 *   2. 修改合成／餵養後的金幣、營養 U 數與血脈成長紀錄繼承：修改 executeTowerFusion()、executeFruitUpgrade()。
 * ============================================================================
 */
(function (global) {
    'use strict';

    const GameApp = global.GameApp = global.GameApp || {};
    let G = null;

    function bind(ctx) { G = ctx; }

    function getEvoData() {
        return (GameApp.data && GameApp.data.evolutions) || {};
    }

    function getTowersData() {
        return (GameApp.data && GameApp.data.towers) || {};
    }

    function getTowersDict() {
        return getTowersData().TOWERS || {};
    }

    function getRecipeKey(typeA, typeB) {
        return [String(typeA || ''), String(typeB || '')].sort().join('+');
    }

    function normalizeNodeId(towerObj) {
        if (!towerObj) return '';
        const td = getTowersData();
        if (typeof td.normalizeTowerType === 'function') {
            return td.normalizeTowerType(towerObj.type, towerObj.tier || 1);
        }
        return String(towerObj.type || '');
    }

    function resolveBaseElement(towerObj) {
        const nodeId = normalizeNodeId(towerObj);
        const cfg = getTowersDict()[nodeId];
        if (cfg && cfg.shopKey) return cfg.shopKey;
        if (cfg && cfg.elementTag && ['fire', 'ice', 'thunder'].includes(cfg.elementTag)) return cfg.elementTag;
        if (nodeId.startsWith('fire')) return 'fire';
        if (nodeId.startsWith('ice')) return 'ice';
        if (nodeId.startsWith('thunder')) return 'thunder';
        return nodeId;
    }

    function getShortNodeLabel(nodeId) {
        const cfg = getTowersDict()[nodeId];
        if (!cfg) return String(nodeId || '');
        return cfg.shortName || `${cfg.icon || ''}${cfg.name || nodeId}`;
    }

    /**
     * 取得防禦塔的血脈成長路徑文字（例如：🔥火芽 ▸ 💨蒸氣 ▸ 💨A 焦熱蒸壓）
     */
    function getTowerLineagePathText(towerObj) {
        if (!towerObj) return '';
        const nodeId = normalizeNodeId(towerObj);
        const cfg = getTowersDict()[nodeId];
        const isEn = Boolean(GameApp.i18n && GameApp.i18n.isEnglish());
        if (Array.isArray(towerObj.lineageIds) && towerObj.lineageIds.length > 0) {
            return towerObj.lineageIds.map((step) => Array.isArray(step) ? step.map(getShortNodeLabel).join('+') : getShortNodeLabel(step)).join(' ▸ ');
        }
        if (isEn) {
            if (cfg && cfg.lineagePath) return cfg.lineagePath;
            return getShortNodeLabel(nodeId);
        }
        if (Array.isArray(towerObj.lineagePath) && towerObj.lineagePath.length > 0) {
            return towerObj.lineagePath.join(' ▸ ');
        }
        if (cfg && Array.isArray(cfg.defaultLineagePath) && cfg.defaultLineagePath.length > 0) {
            return cfg.defaultLineagePath.join(' ▸ ');
        }
        return getShortNodeLabel(nodeId);
    }

    function L(zh, en) {
        return (GameApp.i18n && typeof GameApp.i18n.pick === 'function') ? GameApp.i18n.pick(zh, en) : zh;
    }

    function resolveTowerFamily(towerOrType) {
        const nodeId = typeof towerOrType === 'string' ? towerOrType : normalizeNodeId(towerOrType);
        const cfg = getTowersDict()[nodeId];
        if (cfg && cfg.family) return cfg.family;
        if (cfg && cfg.elementTag) return cfg.elementTag;
        return String(nodeId || '').replace(/_(bud|trunk|A|B|crown_A|crown_B|twin_AB|scion)$/, '');
    }

    function getDefaultNutritionU(towerObj) {
        if (!towerObj) return 1;
        const tier = Math.max(1, Math.min(5, Number(towerObj.tier) || 1));
        const nodeId = normalizeNodeId(towerObj);
        const cfg = getTowersDict()[nodeId] || {};
        if (tier === 1) return cfg.isHybrid ? 2 : 1;
        if (tier === 2) return cfg.isHybrid ? 3 : 2;
        if (tier === 3) return 4;
        if (tier === 4) return 8;
        return 16;
    }

    function getTowerNutritionU(towerObj) {
        if (!towerObj) return 0;
        const tier = Math.max(1, Math.min(5, Number(towerObj.tier) || 1));
        const minU = getDefaultNutritionU(towerObj);
        if (Number.isFinite(towerObj.nutritionU)) {
            return Math.max(minU, Math.min(16, Math.round(towerObj.nutritionU)));
        }
        return minU;
    }

    function getFeedNutritionValue(fodderTower) {
        if (!fodderTower) return 0;
        const tier = Math.max(1, Math.min(5, Number(fodderTower.tier) || 1));
        const nodeId = normalizeNodeId(fodderTower);
        const cfg = getTowersDict()[nodeId] || {};
        if (tier === 1) return cfg.isHybrid ? 2 : 1;
        if (tier === 2) return cfg.isHybrid ? 3 : 2;
        if (Number.isFinite(fodderTower.nutritionU)) {
            return Math.max(tier === 3 ? 4 : 8, Math.min(16, Math.round(fodderTower.nutritionU)));
        }
        return tier === 3 ? 4 : (tier === 4 ? 8 : 16);
    }

    function getNextStarTargetU(tier) {
        if (tier === 3) return 8;
        if (tier === 4) return 16;
        return null;
    }

    function getBoardScionCount() {
        const board = G && G.state && G.state.board;
        if (!Array.isArray(board)) return 0;
        let count = 0;
        for (let i = 0; i < board.length; i++) {
            const t = board[i];
            if (t && ((Number(t.tier) || 1) >= 5 || t.isCrowned)) count++;
        }
        return count;
    }

    function getScionCrownLimit() {
        const TreeSys = GameApp.systems && GameApp.systems.tree;
        if (TreeSys && typeof TreeSys.getMaxScionCrownLimit === 'function') {
            return TreeSys.getMaxScionCrownLimit();
        }
        return 2;
    }

    function isScionCrownCapReached() {
        return getBoardScionCount() >= getScionCrownLimit();
    }

    function isSameBloodlineForFeeding(fromTower, toTower) {
        if (!fromTower || !toTower) return false;
        const fromFam = resolveTowerFamily(fromTower);
        const toFam = resolveTowerFamily(toTower);
        if (!fromFam || !toFam) return false;
        if (fromFam === toFam) return true;
        const evo = getEvoData();
        const parentMap = evo.PARENT_LINEAGE_MAP || {
            steam: ['fire', 'ice'],
            magnet: ['ice', 'thunder'],
            plasma: ['fire', 'thunder']
        };
        const parents = parentMap[toFam];
        return Boolean(Array.isArray(parents) && (fromTower.tier || 1) <= 2 && parents.includes(fromFam));
    }

    function canFeedTower(fromTower, toTower) {
        if (!fromTower || !toTower) return false;
        const evo = getEvoData();
        const maxTier = evo.MAX_TIER || 5;
        const fromTier = Number(fromTower.tier) || 1;
        const toTier = Number(toTower.tier) || 1;
        if (toTier !== 3 && toTier !== 4) return false;
        if (toTier >= maxTier || fromTier >= toTier) return false;
        const curU = getTowerNutritionU(toTower);
        if (curU >= 16) return false;
        if (toTier === 4 && curU >= 15 && isScionCrownCapReached()) return false;
        return isSameBloodlineForFeeding(fromTower, toTower);
    }

    function resolveEvolved3To4Type(toTower, addedBranch = null) {
        const fam = resolveTowerFamily(toTower);
        const cfg = getTowersDict()[normalizeNodeId(toTower)] || {};
        const curBranch = cfg.branchCode || (toTower.type.endsWith('_B') ? 'B' : 'A');
        const hasA = curBranch === 'A' || addedBranch === 'A' || Boolean(toTower.hasFedBranchA);
        const hasB = curBranch === 'B' || addedBranch === 'B' || Boolean(toTower.hasFedBranchB);
        if (hasA && hasB) return `${fam}_twin_AB`;
        return `${fam}_crown_${curBranch === 'B' ? 'B' : 'A'}`;
    }

    /**
     * 檢查兩座塔若不可合成，其具體不相容原因
     */
    function getIncompatibilityReason(fromTower, toTower) {
        const evo = getEvoData();
        const maxTier = evo.MAX_TIER || 5;
        if (!fromTower || !toTower) return L('無效的防禦塔', 'Invalid tower');
        if (toTower.tier >= maxTier) {
            return L('目標已達 5★ 世界樹神裔（16U 滿載），無法再吸收融合', 'Target is already max 5★ World Tree Scion (16U)');
        }
        if (fromTower.tier >= maxTier) {
            return L('5★ 世界樹神裔無法作為素材被吞噬', '5★ Scion cannot be sacrificed as material');
        }
        const isScionCapBlocked = (
            (fromTower.tier === 4 && toTower.tier === 4 && resolveTowerFamily(fromTower) === resolveTowerFamily(toTower))
            || (toTower.tier === 4 && fromTower.tier < toTower.tier && isSameBloodlineForFeeding(fromTower, toTower) && getTowerNutritionU(toTower) >= 15)
        ) && isScionCrownCapReached();
        if (isScionCapBlocked) {
            const cnt = getBoardScionCount();
            const lim = getScionCrownLimit();
            return L(
                `場上 5★ 神裔已達上限 (${cnt}/${lim})，請於年輪「古樹枝 ④」解鎖上限 3 座`,
                `5★ Scion board limit reached (${cnt}/${lim}). Unlock Ancient Branch #4 in Meta Tree for 3.`
            );
        }
        if (toTower.tier >= 3 && fromTower.tier < toTower.tier && !isSameBloodlineForFeeding(fromTower, toTower)) {
            return L('漸進吞噬僅限同血脈防禦塔（含共生父系 1★/2★）', 'Feeding requires matching bloodline tower');
        }
        if (fromTower.tier !== toTower.tier) {
            return L('僅可同星級相融，或將低星同血脈塔餵養給 3★/4★ 主力塔', 'Requires same star tier or lower-star matching bloodline fodder for 3★/4★');
        }
        if (fromTower.tier === 1 && toTower.tier === 1) {
            return L('僅同物種 1★、異系基礎芽轉職，或同血脈基礎芽灌注轉職 1★ 可融合', 'Requires matching 1★ pair, distinct base buds, or matching lineage infusion');
        }
        if (fromTower.tier === 2 && toTower.tier === 2) {
            return L('須兩座同物種 2★ 塔才能觸發冠枝分岔進化', 'Requires two matching 2★ trunks for Crown evolution');
        }
        return L('須同血脈防禦塔方可進階或餵養充能', 'Requires matching bloodline towers to evolve or feed');
    }

    /**
     * 判定兩座防禦塔能否進行：
     *   - 1★ + 1★：異系轉職成 1★ 新物種（2U）/ 同物種升為 2★ / 同血脈灌注升為 2★
     *   - 2★ + 2★：同物種升為 3★ A/B 冠枝（4U，0.15x 子彈時間分岔輪盤）
     *   - 3★ + 3★：同血脈同分支 -> 4★ 極意古冠（8U）；同血脈異分支 -> 4★ 雙生神冠 AB（8U）
     *   - 4★ + 4★：同血脈相融 -> 5★ 世界樹神裔（16U）
     *   - 漸進式吞噬充能：低星同血脈塔（1★/2★/3★）拖曳餵養 3★/4★ 主力塔，達標自動升星
     */
    function getFusionResult(fromTower, toTower) {
        const evo = getEvoData();
        const maxTier = evo.MAX_TIER || 5;
        if (!fromTower || !toTower || toTower.tier >= maxTier) {
            return null;
        }
        const towersDict = getTowersDict();

        // ==================== 1★ + 1★（異系轉職 1★ / 同物種升 2★ / 元素灌注升 2★） ====================
        if (fromTower.tier === 1 && toTower.tier === 1) {
            const idA = normalizeNodeId(fromTower);
            const idB = normalizeNodeId(toTower);
            const pairKey = getRecipeKey(idA, idB);
            const t1Recipes = evo.T1_RECIPES || evo.T1_TO_T2_RECIPES || {};
            const matched = t1Recipes[pairKey];
            if (matched && towersDict[matched.resultType]) {
                const resCfg = towersDict[matched.resultType];
                const resTier = Number.isFinite(matched.resultTier) ? matched.resultTier : (resCfg.nodeTier || 2);
                const requiresConf = Boolean(matched.requiresConfirmation);
                const mode = matched.mode || (resTier === 1 ? 'transfer_t1' : 'star_up_t2');
                let previewLabel = `${L('升星', 'Star Up')} ▸ ${resCfg.icon} ${resCfg.name} ★★`;
                if (mode === 'transfer_t1') {
                    previewLabel = `${L('轉職', 'Transfer')} ▸ ${resCfg.icon} ${resCfg.name} ★ (2U)`;
                } else if (mode === 'infusion_single') {
                    previewLabel = `${L('元素灌注', 'Infusion')} ▸ ${resCfg.icon} ${resCfg.name} ★★`;
                }
                return {
                    type: matched.resultType,
                    options: [matched.resultType],
                    tier: resTier,
                    isCrossElement: Boolean(matched.isCrossElement),
                    mode,
                    requiresConfirmation: requiresConf,
                    title: mode === 'infusion_single'
                        ? L('元素灌注升星確認（0.15x 子彈時間）', 'Confirm Elemental Infusion (0.15x Bullet Time)')
                        : `${resCfg.icon} ${resCfg.name}`,
                    previewLabel
                };
            }
            return null;
        }

        // ==================== 2★ + 2★ -> 3★ 冠枝 (4U) ====================
        if (fromTower.tier === 2 && toTower.tier === 2) {
            const trunkA = normalizeNodeId(fromTower);
            const trunkB = normalizeNodeId(toTower);
            const pairKey = getRecipeKey(trunkA, trunkB);
            const t2Rules = evo.T2_TO_T3_RULES || {};
            const rule = t2Rules[pairKey];
            if (!rule || !Array.isArray(rule.options) || rule.options.length === 0) {
                return null;
            }
            const validOptions = rule.options.filter(optId => Boolean(towersDict[optId]));
            if (validOptions.length === 0) return null;

            return {
                type: validOptions[0],
                options: validOptions,
                tier: 3,
                isCrossElement: Boolean(towersDict[validOptions[0]] && towersDict[validOptions[0]].isHybrid),
                mode: rule.mode || (validOptions.length > 1 ? 'dual_choice' : 'directed_single'),
                family: rule.family || '',
                requiresConfirmation: true,
                title: L(rule.title || '世界樹冠枝開花', 'Crown Branch Evolution'),
                previewLabel: L(rule.previewLabel || `冠枝進化 ▸ ${getShortNodeLabel(validOptions[0])}`, `Crown Evolution ▸ ${getShortNodeLabel(validOptions[0])}`)
            };
        }

        // ==================== 3★ + 3★ -> 4★ 極意古冠 / 雙生神冠 AB (8U) ====================
        if (fromTower.tier === 3 && toTower.tier === 3) {
            const idA = normalizeNodeId(fromTower);
            const idB = normalizeNodeId(toTower);
            const pairKey = getRecipeKey(idA, idB);
            const t3Rules = evo.T3_TO_T4_RULES || {};
            const rule = t3Rules[pairKey];
            if (!rule || !rule.resultType || !towersDict[rule.resultType]) {
                return null;
            }
            const resCfg = towersDict[rule.resultType];
            const nextU = Math.min(16, getTowerNutritionU(toTower) + getFeedNutritionValue(fromTower));
            return {
                type: rule.resultType,
                options: [rule.resultType],
                tier: 4,
                nextNutritionU: Math.max(8, nextU),
                isTwinCrown: Boolean(rule.isTwin),
                isCrossElement: Boolean(resCfg.isHybrid),
                mode: rule.mode || (rule.isTwin ? 'twin_crown_t4' : 'crown_mastery_t4'),
                family: rule.family || resolveTowerFamily(toTower),
                requiresConfirmation: false,
                title: `${resCfg.icon} ${resCfg.name}`,
                previewLabel: rule.isTwin
                    ? L(`✨ 雙生合體 ▸ ${resCfg.name} ★★★★（A+B 雙機制共存）`, `✨ Twin Fusion ▸ ${resCfg.name} ★★★★ (Dual A+B)`)
                    : L(`✨ 極意古冠 ▸ ${resCfg.name} ★★★★（特化強化）`, `✨ Mastery Crown ▸ ${resCfg.name} ★★★★`)
            };
        }

        // ==================== 4★ + 4★ -> 5★ 世界樹神裔 (16U) ====================
        if (fromTower.tier === 4 && toTower.tier === 4) {
            if (isScionCrownCapReached()) {
                return null;
            }
            const idA = normalizeNodeId(fromTower);
            const idB = normalizeNodeId(toTower);
            const pairKey = getRecipeKey(idA, idB);
            const t4Rules = evo.T4_TO_T5_RULES || {};
            const rule = t4Rules[pairKey];
            if (!rule || !rule.resultType || !towersDict[rule.resultType]) {
                return null;
            }
            const resCfg = towersDict[rule.resultType];
            return {
                type: rule.resultType,
                options: [rule.resultType],
                tier: 5,
                nextNutritionU: 16,
                isScion: true,
                isCrossElement: Boolean(resCfg.isHybrid),
                mode: 'world_scion_t5',
                family: rule.family || resolveTowerFamily(toTower),
                requiresConfirmation: false,
                title: `${resCfg.icon} ${resCfg.name}`,
                previewLabel: L(`🌳 神裔降臨 ▸ ${resCfg.name} ★★★★★（16U 光環＋全圖脈動）`, `🌳 Scion Ascension ▸ ${resCfg.name} ★★★★★ (16U Aura + Pulse)`)
            };
        }

        // ==================== 漸進式吞噬充能（同血脈低星塔餵養 3★ / 4★ 主力塔） ====================
        if (canFeedTower(fromTower, toTower)) {
            const feedU = getFeedNutritionValue(fromTower);
            const curU = getTowerNutritionU(toTower);
            let nextU = Math.min(16, curU + feedU);
            if (toTower.tier === 4 && nextU >= 16 && isScionCrownCapReached()) {
                if (curU >= 15) return null;
                nextU = 15;
            }
            const fromNode = normalizeNodeId(fromTower);
            const fromCfg = towersDict[fromNode] || {};
            const addedBranch = (fromTower.tier === 3 && (fromCfg.branchCode === 'A' || fromCfg.branchCode === 'B')) ? fromCfg.branchCode : null;

            if (toTower.tier === 3 && nextU >= 8) {
                const targetType = resolveEvolved3To4Type(toTower, addedBranch);
                const resCfg = towersDict[targetType] || {};
                const isTwin = Boolean(resCfg.isTwinCrown);
                return {
                    type: targetType,
                    options: [targetType],
                    tier: 4,
                    isFeedUpgrade: true,
                    isFeedEvolve: true,
                    feedU,
                    nextNutritionU: nextU,
                    isTwinCrown: isTwin,
                    isCrossElement: Boolean(resCfg.isHybrid),
                    mode: isTwin ? 'feed_twin_t4' : 'feed_evolve_t4',
                    family: resolveTowerFamily(toTower),
                    requiresConfirmation: false,
                    title: `${resCfg.icon || ''} ${resCfg.name || targetType}`,
                    previewLabel: isTwin
                        ? L(`✨ 雙生合體充能 +${feedU}U ▸ ${resCfg.name} ★★★★ (${nextU}U)`, `✨ Twin Feed +${feedU}U ▸ ${resCfg.name} ★★★★ (${nextU}U)`)
                        : L(`⚡ 充能滿溢進化 +${feedU}U ▸ ${resCfg.name} ★★★★ (${nextU}/16U)`, `⚡ Full Charge +${feedU}U ▸ ${resCfg.name} ★★★★ (${nextU}/16U)`)
                };
            }

            if (toTower.tier === 4 && nextU >= 16) {
                const fam = resolveTowerFamily(toTower);
                const targetType = `${fam}_scion`;
                const resCfg = towersDict[targetType] || {};
                return {
                    type: targetType,
                    options: [targetType],
                    tier: 5,
                    isFeedUpgrade: true,
                    isFeedEvolve: true,
                    feedU,
                    nextNutritionU: 16,
                    isScion: true,
                    isCrossElement: Boolean(resCfg.isHybrid),
                    mode: 'feed_evolve_t5',
                    family: fam,
                    requiresConfirmation: false,
                    title: `${resCfg.icon || ''} ${resCfg.name || targetType}`,
                    previewLabel: L(`🌳 神裔充能覺醒 +${feedU}U ▸ ${resCfg.name} ★★★★★ (16U)`, `🌳 Scion Charge +${feedU}U ▸ ${resCfg.name} ★★★★★ (16U)`)
                };
            }

            const targetU = getNextStarTargetU(toTower.tier) || (toTower.tier === 3 ? 8 : 16);
            const dstCfg = towersDict[normalizeNodeId(toTower)] || {};
            return {
                type: normalizeNodeId(toTower),
                options: [normalizeNodeId(toTower)],
                tier: toTower.tier,
                isFeedUpgrade: true,
                isFeedEvolve: false,
                feedU,
                nextNutritionU: nextU,
                isCrossElement: Boolean(dstCfg.isHybrid),
                mode: 'feed_charge',
                family: resolveTowerFamily(toTower),
                requiresConfirmation: false,
                title: `${dstCfg.icon || ''} ${dstCfg.name || toTower.type}`,
                previewLabel: L(
                    `吞噬充能 +${feedU}U ▸ ${nextU} / ${targetU} U（攻擊力即時提升）`,
                    `Feed +${feedU}U ▸ ${nextU} / ${targetU} U (DMG scales live)`
                )
            };
        }

        return null;
    }

    function canCombineTowers(fromTower, toTower) {
        return Boolean(getFusionResult(fromTower, toTower));
    }

    function getAscensionHint(fusion, chosenType = null) {
        if (!fusion) return '';
        const targetType = chosenType || fusion.type;
        const evo = getEvoData();
        if (fusion.mode === 'feed_charge') {
            return L('【吞噬充能完成，攻擊力已即時提升】', ' [Fed +U, ATK Increased]');
        }
        if (fusion.tier === 5) {
            if (GameApp.i18n && GameApp.i18n.isEnglish()) {
                const tCfg = getTowersDict()[targetType];
                return (tCfg && tCfg.roleSummary) ? ` [${tCfg.roleSummary}]` : ' [5★ World Tree Scion]';
            }
            return (evo.LV5_ASCENSION_HINTS && evo.LV5_ASCENSION_HINTS[targetType]) || '【5★ 世界樹神裔降臨】';
        }
        if (fusion.tier === 4) {
            if (GameApp.i18n && GameApp.i18n.isEnglish()) {
                const tCfg = getTowersDict()[targetType];
                return (tCfg && tCfg.roleSummary) ? ` [${tCfg.roleSummary}]` : (fusion.isTwinCrown ? ' [4★ Twin Crown]' : ' [4★ Mastery Crown]');
            }
            return (evo.LV4_ASCENSION_HINTS && evo.LV4_ASCENSION_HINTS[targetType]) || (fusion.isTwinCrown ? '【4★ 雙生神冠覺醒】' : '【4★ 極意古冠覺醒】');
        }
        if (fusion.tier === 3) {
            if (GameApp.i18n && GameApp.i18n.isEnglish()) {
                const tCfg = getTowersDict()[targetType];
                return (tCfg && tCfg.roleSummary) ? ` [${tCfg.roleSummary}]` : ' [3★ Crown Blossomed]';
            }
            return (evo.LV3_ASCENSION_HINTS && evo.LV3_ASCENSION_HINTS[targetType]) || '【3★ 冠枝盛開】';
        }
        if (fusion.mode === 'transfer_t1') return L('【異系轉職為 1★ 新物種 (2U)】', ' [Transferred to 1★ Hybrid (2U)]');
        if (fusion.mode === 'infusion_single') return L('【元素灌注升為 2★】', ' [Infused to 2★]');
        return L('【同物種升為 2★】', ' [Starred Up to 2★]');
    }

    function buildMergedLineagePath(fromTower, toTower, resultNodeId, resultTier, mode = '') {
        const fromId = normalizeNodeId(fromTower);
        const toId = normalizeNodeId(toTower);
        const fromShort = getShortNodeLabel(fromId);
        const toShort = getShortNodeLabel(toId);
        const resShort = getShortNodeLabel(resultNodeId);

        if (resultTier === 1 || mode === 'transfer_t1') {
            return [`${fromShort}+${toShort}`, resShort];
        }

        if (resultTier === 2) {
            if (mode === 'infusion_single') {
                return [`${toShort}+${fromShort}`, resShort];
            }
            const basePath = Array.isArray(toTower.lineagePath) && toTower.lineagePath.length > 0
                ? toTower.lineagePath.slice()
                : [toShort];
            if (basePath[basePath.length - 1] !== resShort) {
                basePath.push(resShort);
            }
            return basePath;
        }

        // 3★ ~ 5★：保留完整脈絡並接上進化節點
        const toPath = Array.isArray(toTower.lineagePath) && toTower.lineagePath.length > 0
            ? toTower.lineagePath.slice()
            : ((getTowersDict()[toId] && getTowersDict()[toId].defaultLineagePath) || [toShort]).slice();
        if (toPath[toPath.length - 1] !== resShort) {
            toPath.push(resShort);
        }
        return toPath;
    }

    function buildMergedLineageIds(fromTower, toTower, resultNodeId, resultTier, mode = '') {
        const fromId = normalizeNodeId(fromTower);
        const toId = normalizeNodeId(toTower);
        if (resultTier === 1 || mode === 'transfer_t1') {
            return [[fromId, toId], resultNodeId];
        }
        if (resultTier === 2) {
            if (mode === 'infusion_single') {
                return [[toId, fromId], resultNodeId];
            }
            const baseIds = Array.isArray(toTower.lineageIds) && toTower.lineageIds.length > 0
                ? toTower.lineageIds.slice()
                : [toId];
            if (baseIds[baseIds.length - 1] !== resultNodeId) baseIds.push(resultNodeId);
            return baseIds;
        }
        const toIds = Array.isArray(toTower.lineageIds) && toTower.lineageIds.length > 0
            ? toTower.lineageIds.slice()
            : [toId];
        if (toIds[toIds.length - 1] !== resultNodeId) toIds.push(resultNodeId);
        return toIds;
    }

    /**
     * 執行合成轉換或漸進式吞噬充能，嚴格守恒繼承雙方累計投入金幣（investedGold）、營養 U 數與累計傷害
     */
    function executeTowerFusion(fromIndex, toIndex, chosenBranchType = null) {
        if (!G || !G.state) return null;
        const st = G.state;
        const fromTower = st.board[fromIndex];
        const toTower = st.board[toIndex];
        const fusion = getFusionResult(fromTower, toTower);
        if (!fusion) return null;

        const baseCost = (GameApp.data && GameApp.data.economy && GameApp.data.economy.BASE_COST) || 10;
        const fromInv = Number.isFinite(fromTower.investedGold)
            ? fromTower.investedGold
            : baseCost * Math.pow(2, Math.max(0, (fromTower.tier || 1) - 1));
        const toInv = Number.isFinite(toTower.investedGold)
            ? toTower.investedGold
            : baseCost * Math.pow(2, Math.max(0, (toTower.tier || 1) - 1));
        const fromShare = Number.isFinite(fromTower.costShare) ? fromTower.costShare : Math.pow(2, Math.max(0, (fromTower.tier || 1) - 1));
        const toShare = Number.isFinite(toTower.costShare) ? toTower.costShare : Math.pow(2, Math.max(0, (toTower.tier || 1) - 1));
        const mergedDamage = (fromTower.totalDamage || 0) + (toTower.totalDamage || 0);
        const fromCfg = getTowersDict()[normalizeNodeId(fromTower)] || {};
        const fedBranch = (fromTower.tier === 3 && (fromCfg.branchCode === 'A' || fromCfg.branchCode === 'B')) ? fromCfg.branchCode : null;

        // 漸進式吞噬充能（尚未達進化門檻時，原塔保留原位、即時更新 U 與投資金並釋放素材格）
        if (fusion.isFeedUpgrade && !fusion.isFeedEvolve) {
            toTower.investedGold = fromInv + toInv;
            toTower.costShare = fromShare + toShare;
            toTower.totalDamage = mergedDamage;
            toTower.nutritionU = fusion.nextNutritionU;
            if (fedBranch === 'A') toTower.hasFedBranchA = true;
            if (fedBranch === 'B') toTower.hasFedBranchB = true;
            if (fromTower.infusionCount) {
                toTower.infusionCount = (toTower.infusionCount || 0) + fromTower.infusionCount;
            }
            st.board[fromIndex] = null;
            st.fusionCount++;

            if (mergedDamage > 0 && (!st.peakTowerSnapshot || mergedDamage >= st.peakTowerSnapshot.totalDamage)) {
                const keepCfg = getTowersDict()[toTower.type];
                st.peakTowerSnapshot = {
                    uid: toTower.uid,
                    type: toTower.type,
                    tier: toTower.tier,
                    isCrowned: Boolean(toTower.isCrowned),
                    name: keepCfg ? keepCfg.name : toTower.type,
                    icon: keepCfg ? keepCfg.icon : '',
                    totalDamage: mergedDamage
                };
            }
            return { fusion, mergedTower: toTower, bonusHint: getAscensionHint(fusion, toTower.type) };
        }

        const targetType = (chosenBranchType && fusion.options.includes(chosenBranchType))
            ? chosenBranchType
            : fusion.type;
        const lineagePath = buildMergedLineagePath(fromTower, toTower, targetType, fusion.tier, fusion.mode);
        const lineageIds = buildMergedLineageIds(fromTower, toTower, targetType, fusion.tier, fusion.mode);
        st.fusionCount++;

        const AttackSys = GameApp.systems && GameApp.systems.towerAttack;
        const intervalMs = AttackSys ? AttackSys.getTowerAttackInterval(targetType, toIndex) : 1000;
        const carriedAcc = Math.max(0, Math.min(intervalMs - 120, Math.max(fromTower.accMs || 0, toTower.accMs || 0)));

        const targetCfg = getTowersDict()[targetType] || {};
        const defaultTargetU = getDefaultNutritionU({ type: targetType, tier: fusion.tier });
        const nextNutritionU = Number.isFinite(fusion.nextNutritionU)
            ? Math.max(defaultTargetU, Math.min(16, fusion.nextNutritionU))
            : defaultTargetU;

        const mergedTower = AttackSys.createTowerObj(targetType, fusion.tier, fromInv + toInv, carriedAcc, {
            targetMode: toTower.targetMode || fromTower.targetMode || 'first',
            totalDamage: mergedDamage,
            costShare: fromShare + toShare,
            nutritionU: nextNutritionU,
            isCrowned: Boolean(fusion.tier >= 5 || targetCfg.isScion),
            infusionCount: (toTower.infusionCount || 0) + (fromTower.infusionCount || 0),
            lineagePath,
            lineageIds
        });
        st.board[toIndex] = mergedTower;
        st.board[fromIndex] = null;

        if (mergedDamage > 0 && (!st.peakTowerSnapshot || mergedDamage >= st.peakTowerSnapshot.totalDamage)) {
            const fusedCfg = getTowersDict()[targetType];
            st.peakTowerSnapshot = {
                uid: mergedTower.uid,
                type: mergedTower.type,
                tier: mergedTower.tier,
                isCrowned: Boolean(mergedTower.isCrowned),
                name: fusedCfg ? fusedCfg.name : mergedTower.type,
                icon: fusedCfg ? fusedCfg.icon : '',
                totalDamage: mergedDamage
            };
        }

        const appliedFusion = Object.assign({}, fusion, { type: targetType });

        // 圖鑑解鎖與試玩感官數據追蹤
        if (GameApp.systems && GameApp.systems.codex && typeof GameApp.systems.codex.unlockEntry === 'function') {
            GameApp.systems.codex.unlockEntry(`tower:${targetType}`);
        }
        if (GameApp.backend && typeof GameApp.backend.trackFeel === 'function') {
            GameApp.backend.trackFeel(`Fusion:Create:${targetType}`, st.fusionCount, {
                resultType: targetType,
                tier: fusion.tier,
                mode: fusion.mode,
                isCrossElement: fusion.isCrossElement,
                mapId: st.currentMapId
            });
        }

        return { fusion: appliedFusion, mergedTower, bonusHint: getAscensionHint(appliedFusion, targetType) };
    }

    /**
     * 取得萬能融合果實（Universal Fusion Fruit）對單座防禦塔的升星／充能預覽：
     *   - 1★ 塔：直接升為同物種 2★ 主幹
     *   - 2★ 塔：觸發 3★ 冠枝 A/B 雙分岔選擇輪盤
     *   - 3★ / 4★ 塔：直接提供 +4U 營養充能，達 8U 或 16U 時自動進化
     */
    function getFruitUpgradePreview(towerObj) {
        const evo = getEvoData();
        const maxTier = evo.MAX_TIER || 5;
        if (!towerObj || towerObj.tier >= maxTier) return null;
        const towersDict = getTowersDict();
        const nodeId = normalizeNodeId(towerObj);

        if (towerObj.tier === 1) {
            const pairKey = getRecipeKey(nodeId, nodeId);
            const t1Recipes = evo.T1_RECIPES || evo.T1_TO_T2_RECIPES || {};
            const matched = t1Recipes[pairKey];
            const resultType = (matched && matched.resultType) || `${nodeId.replace(/_bud$/, '')}_trunk`;
            const resCfg = towersDict[resultType];
            if (!resCfg) return null;
            return {
                isFruitUpgrade: true,
                type: resultType,
                options: [resultType],
                tier: 2,
                nextNutritionU: getDefaultNutritionU({ type: resultType, tier: 2 }),
                isCrossElement: Boolean(resCfg.isHybrid),
                mode: 'fruit_star_up_t2',
                requiresConfirmation: false,
                title: `${resCfg.icon} ${resCfg.name}`,
                previewLabel: `${L('萬能果實升星', 'Fruit Star Up')} ▸ ${resCfg.icon} ${resCfg.name} ★★`
            };
        }

        if (towerObj.tier === 2) {
            const pairKey = getRecipeKey(nodeId, nodeId);
            const t2Rules = evo.T2_TO_T3_RULES || {};
            const rule = t2Rules[pairKey];
            if (!rule || !Array.isArray(rule.options) || rule.options.length === 0) return null;
            const validOptions = rule.options.filter(optId => Boolean(towersDict[optId]));
            if (validOptions.length === 0) return null;
            return {
                isFruitUpgrade: true,
                type: validOptions[0],
                options: validOptions,
                tier: 3,
                nextNutritionU: 4,
                isCrossElement: Boolean(towersDict[validOptions[0]] && towersDict[validOptions[0]].isHybrid),
                mode: 'fruit_dual_choice_t3',
                family: rule.family || '',
                requiresConfirmation: true,
                title: L(`${rule.title || '世界樹冠枝開花'}（萬能融合果實）`, 'Crown Branch Evolution (Universal Fruit)'),
                previewLabel: L(rule.previewLabel || `萬能果實冠枝進化 ▸ ${getShortNodeLabel(validOptions[0])}`, `Fruit Crown Evolution ▸ ${getShortNodeLabel(validOptions[0])}`)
            };
        }

        const fruitFeedU = (GameApp.data && GameApp.data.economy && Number(GameApp.data.economy.FRUIT_FEED_NUTRITION_U)) || 4;
        const curU = getTowerNutritionU(towerObj);
        const nextU = Math.min(16, curU + fruitFeedU);

        if (towerObj.tier === 3) {
            const targetType = resolveEvolved3To4Type(towerObj, null);
            const resCfg = towersDict[targetType] || {};
            const isTwin = Boolean(resCfg.isTwinCrown);
            return {
                isFruitUpgrade: true,
                type: targetType,
                options: [targetType],
                tier: 4,
                feedU: fruitFeedU,
                nextNutritionU: Math.max(8, nextU),
                isTwinCrown: isTwin,
                isCrossElement: Boolean(resCfg.isHybrid),
                mode: 'fruit_feed_evolve_t4',
                family: resolveTowerFamily(towerObj),
                requiresConfirmation: false,
                title: `${resCfg.icon || ''} ${resCfg.name || targetType}`,
                previewLabel: L(
                    `萬能果實 +${fruitFeedU}U ▸ ${resCfg.name || targetType} ★★★★ (${nextU}U)`,
                    `Fruit +${fruitFeedU}U ▸ ${resCfg.name || targetType} ★★★★ (${nextU}U)`
                )
            };
        }

        if (towerObj.tier === 4) {
            const fam = resolveTowerFamily(towerObj);
            if (nextU >= 16) {
                if (isScionCrownCapReached()) {
                    if (curU >= 15) return null;
                    const cappedU = 15;
                    const curCfg = towersDict[nodeId] || {};
                    return {
                        isFruitUpgrade: true,
                        isFeedChargeOnly: true,
                        type: nodeId,
                        options: [nodeId],
                        tier: 4,
                        feedU: Math.max(1, cappedU - curU),
                        nextNutritionU: cappedU,
                        isCrossElement: Boolean(curCfg.isHybrid),
                        mode: 'fruit_feed_charge_t4',
                        family: fam,
                        requiresConfirmation: false,
                        title: `${curCfg.icon || ''} ${curCfg.name || nodeId}`,
                        previewLabel: L(
                            `神裔上限已滿 · 充能鎖定 ${cappedU} / 16 U`,
                            `Scion Cap Reached · Locked at ${cappedU} / 16 U`
                        )
                    };
                }
                const scionType = `${fam}_scion`;
                const resCfg = towersDict[scionType] || {};
                return {
                    isFruitUpgrade: true,
                    type: scionType,
                    options: [scionType],
                    tier: 5,
                    feedU: fruitFeedU,
                    nextNutritionU: 16,
                    isScion: true,
                    isCrossElement: Boolean(resCfg.isHybrid),
                    mode: 'fruit_feed_evolve_t5',
                    family: fam,
                    requiresConfirmation: false,
                    title: `${resCfg.icon || ''} ${resCfg.name || scionType}`,
                    previewLabel: L(
                        `萬能果實 +${fruitFeedU}U ▸ ${resCfg.name || scionType} ★★★★★ (16U)`,
                        `Fruit +${fruitFeedU}U ▸ ${resCfg.name || scionType} ★★★★★ (16U)`
                    )
                };
            }
            const curCfg = towersDict[nodeId] || {};
            return {
                isFruitUpgrade: true,
                isFeedChargeOnly: true,
                type: nodeId,
                options: [nodeId],
                tier: 4,
                feedU: fruitFeedU,
                nextNutritionU: nextU,
                isCrossElement: Boolean(curCfg.isHybrid),
                mode: 'fruit_feed_charge_t4',
                family: fam,
                requiresConfirmation: false,
                title: `${curCfg.icon || ''} ${curCfg.name || nodeId}`,
                previewLabel: L(
                    `萬能果實充能 +${fruitFeedU}U ▸ ${nextU} / 16 U（攻擊即時提升）`,
                    `Fruit Charge +${fruitFeedU}U ▸ ${nextU} / 16 U (DMG scales live)`
                )
            };
        }

        return null;
    }

    /**
     * 執行萬能融合果實升星／+4U 充能，消耗 1 顆萬能果實並保持原塔 investedGold（防刷錢膨脹）
     */
    function executeFruitUpgrade(cellIndex, chosenBranchType = null) {
        if (!G || !G.state) return null;
        const st = G.state;
        if ((st.fusionFruitCount || 0) <= 0) return null;
        const towerObj = st.board[cellIndex];
        const preview = getFruitUpgradePreview(towerObj);
        if (!preview) return null;

        st.fusionFruitCount = Math.max(0, (st.fusionFruitCount || 0) - 1);
        st.isApplyingFusionFruit = false;
        st.fusionCount++;

        if (preview.isFeedChargeOnly) {
            towerObj.nutritionU = preview.nextNutritionU;
            return {
                fusion: preview,
                mergedTower: towerObj,
                bonusHint: L(`【萬能果實 +${preview.feedU || 4}U，目前 ${preview.nextNutritionU}/16 U】`, ` [Fruit +${preview.feedU || 4}U, now ${preview.nextNutritionU}/16 U]`)
            };
        }

        const targetType = (chosenBranchType && preview.options.includes(chosenBranchType))
            ? chosenBranchType
            : preview.type;

        const baseCost = (GameApp.data && GameApp.data.economy && GameApp.data.economy.BASE_COST) || 10;
        const keptInvestedGold = Number.isFinite(towerObj.investedGold)
            ? towerObj.investedGold
            : baseCost * Math.pow(2, Math.max(0, (towerObj.tier || 1) - 1));
        const keptDamage = towerObj.totalDamage || 0;
        const resShort = getShortNodeLabel(targetType);
        const prevPath = Array.isArray(towerObj.lineagePath) && towerObj.lineagePath.length > 0
            ? towerObj.lineagePath.slice()
            : [getShortNodeLabel(normalizeNodeId(towerObj))];
        if (prevPath[prevPath.length - 1] !== resShort) prevPath.push(resShort);

        const prevIds = Array.isArray(towerObj.lineageIds) && towerObj.lineageIds.length > 0
            ? towerObj.lineageIds.slice()
            : [normalizeNodeId(towerObj)];
        if (prevIds[prevIds.length - 1] !== targetType) prevIds.push(targetType);

        const AttackSys = GameApp.systems && GameApp.systems.towerAttack;
        const intervalMs = AttackSys ? AttackSys.getTowerAttackInterval(targetType, cellIndex) : 1000;
        const carriedAcc = Math.max(0, Math.min(intervalMs - 120, towerObj.accMs || 0));

        const targetCfg = getTowersDict()[targetType] || {};
        const upgradedTower = AttackSys.createTowerObj(targetType, preview.tier, keptInvestedGold, carriedAcc, {
            targetMode: towerObj.targetMode || 'first',
            totalDamage: keptDamage,
            costShare: towerObj.costShare,
            nutritionU: preview.nextNutritionU || getDefaultNutritionU({ type: targetType, tier: preview.tier }),
            isCrowned: Boolean(preview.tier >= 5 || targetCfg.isScion),
            infusionCount: towerObj.infusionCount || 0,
            lineagePath: prevPath,
            lineageIds: prevIds
        });
        st.board[cellIndex] = upgradedTower;

        if (keptDamage > 0 && (!st.peakTowerSnapshot || keptDamage >= st.peakTowerSnapshot.totalDamage)) {
            const fusedCfg = getTowersDict()[targetType];
            st.peakTowerSnapshot = {
                uid: upgradedTower.uid,
                type: upgradedTower.type,
                tier: upgradedTower.tier,
                isCrowned: Boolean(upgradedTower.isCrowned),
                name: fusedCfg ? fusedCfg.name : upgradedTower.type,
                icon: fusedCfg ? fusedCfg.icon : '',
                totalDamage: keptDamage
            };
        }

        const appliedFusion = Object.assign({}, preview, { type: targetType });
        if (GameApp.systems && GameApp.systems.codex && typeof GameApp.systems.codex.unlockEntry === 'function') {
            GameApp.systems.codex.unlockEntry(`tower:${targetType}`);
        }
        return {
            fusion: appliedFusion,
            mergedTower: upgradedTower,
            bonusHint: getAscensionHint(appliedFusion, targetType)
        };
    }

    const EvolutionSystem = {
        bind,
        getRecipeKey,
        normalizeNodeId,
        resolveBaseElement,
        resolveTowerFamily,
        getTowerNutritionU,
        getFeedNutritionValue,
        getNextStarTargetU,
        isSameBloodlineForFeeding,
        canFeedTower,
        getShortNodeLabel,
        getTowerLineagePathText,
        getIncompatibilityReason,
        getFusionResult,
        canCombineTowers,
        getAscensionHint,
        executeTowerFusion,
        getFruitUpgradePreview,
        executeFruitUpgrade
    };

    GameApp.systems = GameApp.systems || {};
    GameApp.systems.evolution = EvolutionSystem;
})(window);
