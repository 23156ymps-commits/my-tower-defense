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
        if (Array.isArray(towerObj.lineagePath) && towerObj.lineagePath.length > 0) {
            return towerObj.lineagePath.join(' ▸ ');
        }
        if (cfg && Array.isArray(cfg.defaultLineagePath) && cfg.defaultLineagePath.length > 0) {
            return cfg.defaultLineagePath.join(' ▸ ');
        }
        return getShortNodeLabel(nodeId);
    }

    /**
     * 檢查兩座同星塔若不可合成，其具體不相容原因
     */
    function getIncompatibilityReason(fromTower, toTower) {
        const evo = getEvoData();
        const maxTier = evo.MAX_TIER || 3;
        if (!fromTower || !toTower) return '無效的防禦塔';
        if (fromTower.tier >= maxTier || toTower.tier >= maxTier) {
            return '已達 T3 冠枝最高階級，無法繼續融合';
        }
        if (fromTower.tier !== toTower.tier) {
            return '兩座防禦塔階級不同（須同為 ★ 根芽或同為 ★★ 主幹）';
        }
        if (fromTower.tier === 2 && toTower.tier === 2) {
            return '血脈不相容：該兩座 T2 主幹無共同父系血脈，無法催熟或融合';
        }
        return '該組合無法進行融合';
    }

    /**
     * 判定兩座防禦塔能否進行 T1→T2 主幹合成 或 T2→T3 冠枝分岔／同血脈定向催熟
     */
    function getFusionResult(fromTower, toTower) {
        const evo = getEvoData();
        const maxTier = evo.MAX_TIER || 3;
        if (!fromTower || !toTower || fromTower.tier !== toTower.tier || toTower.tier >= maxTier) {
            return null;
        }
        const towersDict = getTowersDict();
        const newTier = toTower.tier + 1;

        // ==================== T1 + T1 -> T2 主幹（立即合成） ====================
        if (toTower.tier === 1) {
            const baseA = resolveBaseElement(fromTower);
            const baseB = resolveBaseElement(toTower);
            const pairKey = getRecipeKey(baseA, baseB);
            const t1Recipes = evo.T1_TO_T2_RECIPES || {};
            const matched = t1Recipes[pairKey];
            if (matched && towersDict[matched.resultType]) {
                const resCfg = towersDict[matched.resultType];
                return {
                    type: matched.resultType,
                    options: [matched.resultType],
                    tier: 2,
                    isCrossElement: Boolean(matched.isCrossElement),
                    mode: 'instant_t2',
                    requiresConfirmation: false,
                    title: `${resCfg.icon} ${resCfg.name}`,
                    previewLabel: `進化 ▸ ${resCfg.icon} ${resCfg.name}`
                };
            }
            return null;
        }

        // ==================== T2 + T2 -> T3 冠枝（0.15x 子彈時間確認輪盤） ====================
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
                tier: newTier,
                isCrossElement: true,
                mode: rule.mode || (validOptions.length > 1 ? 'dual_choice' : 'directed_single'),
                family: rule.family || '',
                requiresConfirmation: true,
                title: rule.title || '世界樹冠枝開花',
                previewLabel: rule.previewLabel || `進化 ▸ ${getShortNodeLabel(validOptions[0])}`
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
            return (evo.LV3_ASCENSION_HINTS && evo.LV3_ASCENSION_HINTS[targetType]) || '【T3 冠枝盛開！】';
        }
        if (fusion.isCrossElement) return '【跨元素共生主幹！】';
        return '【純血主幹進階！】';
    }

    function buildMergedLineagePath(fromTower, toTower, resultNodeId, resultTier) {
        const fromId = normalizeNodeId(fromTower);
        const toId = normalizeNodeId(toTower);
        const fromShort = getShortNodeLabel(fromId);
        const toShort = getShortNodeLabel(toId);
        const resShort = getShortNodeLabel(resultNodeId);

        if (resultTier === 2) {
            const step1 = fromId === toId ? fromShort : `${fromShort}+${toShort}`;
            return [step1, resShort];
        }

        // T3 冠枝：保留根芽起點 -> T2 主幹組合 -> T3 冠枝
        const toPath = Array.isArray(toTower.lineagePath) && toTower.lineagePath.length > 0
            ? toTower.lineagePath
            : (getTowersDict()[toId] && getTowersDict()[toId].defaultLineagePath) || [toShort];
        const rootStep = toPath[0] || fromShort;
        const trunkStep = fromId === toId ? toShort : `${toShort}+${fromShort}`;
        return [rootStep, trunkStep, resShort];
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
        const lineagePath = buildMergedLineagePath(fromTower, toTower, targetType, fusion.tier);
        st.fusionCount++;

        const AttackSys = GameApp.systems && GameApp.systems.towerAttack;
        const intervalMs = AttackSys ? AttackSys.getTowerAttackInterval(targetType, toIndex) : 1000;
        const carriedAcc = Math.max(0, Math.min(intervalMs - 120, Math.max(fromTower.accMs || 0, toTower.accMs || 0)));

        const mergedTower = AttackSys.createTowerObj(targetType, fusion.tier, fromInv + toInv, carriedAcc, {
            targetMode: toTower.targetMode || fromTower.targetMode || 'first',
            totalDamage: mergedDamage,
            costShare: fromShare + toShare,
            lineagePath
        });
        st.board[toIndex] = mergedTower;
        st.board[fromIndex] = null;

        if (mergedDamage > 0 && (!st.peakTowerSnapshot || mergedDamage >= st.peakTowerSnapshot.totalDamage)) {
            const fusedCfg = getTowersDict()[targetType];
            st.peakTowerSnapshot = {
                uid: mergedTower.uid,
                type: mergedTower.type,
                tier: mergedTower.tier,
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
            GameApp.backend.trackFeel(`Fusion:Create:${targetType}:Tier_${fusion.tier}`, st.fusionCount, {
                resultType: targetType,
                tier: fusion.tier,
                mode: fusion.mode,
                isCrossElement: fusion.isCrossElement,
                mapId: st.currentMapId
            });
        }

        return { fusion: appliedFusion, mergedTower, bonusHint: getAscensionHint(appliedFusion, targetType) };
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
        executeTowerFusion
    };

    GameApp.systems = GameApp.systems || {};
    GameApp.systems.evolution = EvolutionSystem;
})(window);
