/**
 * ============================================================================
 * 【檔案名稱】：modules/evolutions/evolution_system.js
 * 【負責功能】：判定兩座世界樹防禦塔能否進行 T1→T2 主幹融合或 T2→T3 冠枝分岔／同血脈定向催熟，
 *               執行合成轉換，並嚴格守恒繼承雙方累計投入金幣（investedGold）、成本權重（1x/2x/4x）、
 *               累計傷害（totalDamage）與血脈成長路徑（lineagePath）。
 * 【讀取資料】：讀取 modules/evolutions/evolution_data.js 與 modules/towers/tower_data.js。
 * 【常見修改入口】：
 *   1. 修改能否合成與分岔規則判定：修改 getFusionResult()、getIncompatibilityReason()。
 *   2. 修改合成後的金幣、傷害與血脈成長紀錄繼承：修改 executeTowerFusion()。
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

    /**
     * 檢查兩座塔若不可合成，其具體不相容原因
     */
    function getIncompatibilityReason(fromTower, toTower) {
        const evo = getEvoData();
        const maxTier = evo.MAX_TIER || 3;
        if (!fromTower || !toTower) return L('無效的防禦塔', 'Invalid tower');
        if (fromTower.tier >= maxTier || toTower.tier >= maxTier) {
            return L('已達 3★ 冠枝最高階級，無法繼續融合', 'Already at max 3★ Crown tier');
        }
        if (fromTower.tier !== toTower.tier) {
            return L('兩座防禦塔星級不同（須同為 1★ 或同為 2★）', 'Towers must be the same star tier (1★ or 2★)');
        }
        if (fromTower.tier === 1 && toTower.tier === 1) {
            return L('僅同物種 1★、異系基礎芽轉職，或同血脈基礎芽灌注轉職 1★ 可融合', 'Requires matching 1★ pair, distinct base buds, or matching lineage infusion');
        }
        if (fromTower.tier === 2 && toTower.tier === 2) {
            return L('須兩座同物種 2★ 塔才能觸發冠枝分岔進化', 'Requires two matching 2★ trunks for Crown evolution');
        }
        return L('該組合無法進行融合', 'Incompatible merge pair');
    }

    /**
     * 判定兩座防禦塔能否進行：
     *   - 1★ + 1★：異系轉職成 1★ 新物種 / 同物種升為 2★ / 同血脈基礎芽灌注轉職 1★ 升為 2★（需彈窗確認）
     *   - 2★ + 2★：同物種升為 3★ 冠枝（0.15x 子彈時間分岔輪盤）
     */
    function getFusionResult(fromTower, toTower) {
        const evo = getEvoData();
        const maxTier = evo.MAX_TIER || 3;
        if (!fromTower || !toTower || fromTower.tier !== toTower.tier || toTower.tier >= maxTier) {
            return null;
        }
        const towersDict = getTowersDict();

        // ==================== 1★ + 1★（異系轉職 1★ / 同物種升 2★ / 元素灌注升 2★） ====================
        if (toTower.tier === 1) {
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
                    previewLabel = `${L('轉職', 'Transfer')} ▸ ${resCfg.icon} ${resCfg.name} ★`;
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

        // ==================== 2★ + 2★ -> 3★ 冠枝（同物種分岔確認輪盤） ====================
        if (toTower.tier === 2) {
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

        return null;
    }

    function canCombineTowers(fromTower, toTower) {
        return Boolean(getFusionResult(fromTower, toTower));
    }

    function getAscensionHint(fusion, chosenType = null) {
        if (!fusion) return '';
        const targetType = chosenType || fusion.type;
        const evo = getEvoData();
        if (fusion.tier === (evo.MAX_TIER || 3)) {
            if (GameApp.i18n && GameApp.i18n.isEnglish()) {
                const tCfg = getTowersDict()[targetType];
                return (tCfg && tCfg.roleSummary) ? ` [${tCfg.roleSummary}]` : ' [3★ Crown Blossomed]';
            }
            return (evo.LV3_ASCENSION_HINTS && evo.LV3_ASCENSION_HINTS[targetType]) || '【3★ 冠枝盛開】';
        }
        if (fusion.mode === 'transfer_t1') return L('【異系轉職為 1★ 新物種】', ' [Transferred to 1★ Hybrid]');
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

        // 3★ 冠枝：保留完整脈絡並接上 3★ 分支
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
     * 執行合成轉換並嚴格守恒繼承雙方累計投入金幣（investedGold）、成本權重與累計傷害（totalDamage）
     */
    function executeTowerFusion(fromIndex, toIndex, chosenBranchType = null) {
        if (!G || !G.state) return null;
        const st = G.state;
        const fromTower = st.board[fromIndex];
        const toTower = st.board[toIndex];
        const fusion = getFusionResult(fromTower, toTower);
        if (!fusion) return null;

        const targetType = (chosenBranchType && fusion.options.includes(chosenBranchType))
            ? chosenBranchType
            : fusion.type;

        const baseCost = (GameApp.data && GameApp.data.economy && GameApp.data.economy.BASE_COST) || 10;
        const fromInv = Number.isFinite(fromTower.investedGold)
            ? fromTower.investedGold
            : baseCost * Math.pow(2, fromTower.tier - 1);
        const toInv = Number.isFinite(toTower.investedGold)
            ? toTower.investedGold
            : baseCost * Math.pow(2, toTower.tier - 1);
        const fromShare = Number.isFinite(fromTower.costShare) ? fromTower.costShare : Math.pow(2, fromTower.tier - 1);
        const toShare = Number.isFinite(toTower.costShare) ? toTower.costShare : Math.pow(2, toTower.tier - 1);
        const mergedDamage = (fromTower.totalDamage || 0) + (toTower.totalDamage || 0);
        const lineagePath = buildMergedLineagePath(fromTower, toTower, targetType, fusion.tier, fusion.mode);
        const lineageIds = buildMergedLineageIds(fromTower, toTower, targetType, fusion.tier, fusion.mode);
        st.fusionCount++;

        const AttackSys = GameApp.systems && GameApp.systems.towerAttack;
        const intervalMs = AttackSys ? AttackSys.getTowerAttackInterval(targetType, toIndex) : 1000;
        const carriedAcc = Math.max(0, Math.min(intervalMs - 120, Math.max(fromTower.accMs || 0, toTower.accMs || 0)));

        const mergedTower = AttackSys.createTowerObj(targetType, fusion.tier, fromInv + toInv, carriedAcc, {
            targetMode: toTower.targetMode || fromTower.targetMode || 'first',
            totalDamage: mergedDamage,
            costShare: fromShare + toShare,
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
     * 取得萬能融合果實（Universal Fusion Fruit）對單座防禦塔的升星預覽：
     *   - 1★ 塔：直接升為同物種 2★ 主幹
     *   - 2★ 塔：觸發 3★ 冠枝 A/B 雙分岔選擇輪盤
     */
    function getFruitUpgradePreview(towerObj) {
        const evo = getEvoData();
        const maxTier = evo.MAX_TIER || 3;
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
                isCrossElement: Boolean(towersDict[validOptions[0]] && towersDict[validOptions[0]].isHybrid),
                mode: 'fruit_dual_choice_t3',
                family: rule.family || '',
                requiresConfirmation: true,
                title: L(`${rule.title || '世界樹冠枝開花'}（萬能融合果實）`, 'Crown Branch Evolution (Universal Fruit)'),
                previewLabel: L(rule.previewLabel || `萬能果實冠枝進化 ▸ ${getShortNodeLabel(validOptions[0])}`, `Fruit Crown Evolution ▸ ${getShortNodeLabel(validOptions[0])}`)
            };
        }

        return null;
    }

    /**
     * 執行萬能融合果實升星（1★ -> 2★ 或 2★ -> 3★ 分岔確認後），消耗 1 顆萬能果實並保持原塔 investedGold（防刷錢膨脹）
     */
    function executeFruitUpgrade(cellIndex, chosenBranchType = null) {
        if (!G || !G.state) return null;
        const st = G.state;
        if ((st.fusionFruitCount || 0) <= 0) return null;
        const towerObj = st.board[cellIndex];
        const preview = getFruitUpgradePreview(towerObj);
        if (!preview) return null;

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

        st.fusionFruitCount = Math.max(0, (st.fusionFruitCount || 0) - 1);
        st.isApplyingFusionFruit = false;
        st.fusionCount++;

        const AttackSys = GameApp.systems && GameApp.systems.towerAttack;
        const intervalMs = AttackSys ? AttackSys.getTowerAttackInterval(targetType, cellIndex) : 1000;
        const carriedAcc = Math.max(0, Math.min(intervalMs - 120, towerObj.accMs || 0));

        const upgradedTower = AttackSys.createTowerObj(targetType, preview.tier, keptInvestedGold, carriedAcc, {
            targetMode: towerObj.targetMode || 'first',
            totalDamage: keptDamage,
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
