/**
 * ============================================================================
 * 【檔案名稱】：modules/evolutions/evolution_system.js
 * 【負責功能】：判定兩座防禦塔能否進行同階升星或跨元素融合、執行合成轉換，
 *               並完整繼承雙方累計投入金幣（investedGold）與累計輸出傷害（totalDamage）。
 * 【讀取資料】：讀取 modules/evolutions/evolution_data.js 與 modules/towers/tower_data.js。
 * 【常見修改入口】：
 *   1. 修改能否合成之判定條件：修改 getFusionResult()、canCombineTowers()。
 *   2. 修改合成後的金幣與傷害繼承邏輯：修改 executeTowerFusion()。
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

    function getTowersDict() {
        return (GameApp.data && GameApp.data.towers && GameApp.data.towers.TOWERS) || {};
    }

    function getRecipeKey(typeA, typeB) {
        return [String(typeA || ''), String(typeB || '')].sort().join('+');
    }

    /**
     * 判定兩座防禦塔能否進行同屬性升星或跨元素融合
     */
    function getFusionResult(fromTower, toTower) {
        const evo = getEvoData();
        const maxTier = evo.MAX_TIER || 3;
        if (!fromTower || !toTower || fromTower.tier !== toTower.tier || toTower.tier >= maxTier) {
            return null;
        }
        const newTier = toTower.tier + 1;
        if (fromTower.type === toTower.type) {
            return { type: toTower.type, tier: newTier, isCrossElement: false };
        }

        const towersDict = getTowersDict();
        const fromCfg = towersDict[fromTower.type];
        const toCfg = towersDict[toTower.type];
        const isFromBase = fromCfg ? !fromCfg.isHybrid : true;
        const isToBase = toCfg ? !toCfg.isHybrid : true;

        if (isFromBase && isToBase) {
            const recipes = evo.FUSION_RECIPES || {};
            const hybridType = recipes[getRecipeKey(fromTower.type, toTower.type)];
            if (hybridType && towersDict[hybridType]) {
                return { type: hybridType, tier: newTier, isCrossElement: true };
            }
        }
        return null;
    }

    function canCombineTowers(fromTower, toTower) {
        return Boolean(getFusionResult(fromTower, toTower));
    }

    function getAscensionHint(fusion) {
        if (!fusion) return '';
        if (fusion.isCrossElement) return '【跨元素融合！】';
        const evo = getEvoData();
        if (fusion.tier === (evo.MAX_TIER || 3)) {
            return (evo.LV3_ASCENSION_HINTS && evo.LV3_ASCENSION_HINTS[fusion.type]) || '';
        }
        return '';
    }

    /**
     * 執行合成轉換並繼承雙方累計投入金幣（investedGold）與累計傷害（totalDamage）
     */
    function executeTowerFusion(fromIndex, toIndex) {
        if (!G || !G.state) return null;
        const st = G.state;
        const fromTower = st.board[fromIndex];
        const toTower = st.board[toIndex];
        const fusion = getFusionResult(fromTower, toTower);
        if (!fusion) return null;

        const baseCost = (GameApp.data && GameApp.data.economy && GameApp.data.economy.BASE_COST) || 10;
        const fromInv = Number.isFinite(fromTower.investedGold)
            ? fromTower.investedGold
            : baseCost * Math.pow(2, fromTower.tier - 1);
        const toInv = Number.isFinite(toTower.investedGold)
            ? toTower.investedGold
            : baseCost * Math.pow(2, toTower.tier - 1);
        const mergedDamage = (fromTower.totalDamage || 0) + (toTower.totalDamage || 0);
        st.fusionCount++;

        const AttackSys = GameApp.systems && GameApp.systems.towerAttack;
        const intervalMs = AttackSys ? AttackSys.getTowerAttackInterval(fusion.type, toIndex) : 1000;
        const carriedAcc = Math.max(0, Math.min(intervalMs - 120, Math.max(fromTower.accMs || 0, toTower.accMs || 0)));

        const mergedTower = AttackSys.createTowerObj(fusion.type, fusion.tier, fromInv + toInv, carriedAcc, {
            targetMode: toTower.targetMode || fromTower.targetMode || 'first',
            totalDamage: mergedDamage
        });
        st.board[toIndex] = mergedTower;
        st.board[fromIndex] = null;

        if (mergedDamage > 0 && (!st.peakTowerSnapshot || mergedDamage >= st.peakTowerSnapshot.totalDamage)) {
            const fusedCfg = getTowersDict()[fusion.type];
            st.peakTowerSnapshot = {
                uid: mergedTower.uid,
                type: mergedTower.type,
                tier: mergedTower.tier,
                name: fusedCfg ? fusedCfg.name : mergedTower.type,
                icon: fusedCfg ? fusedCfg.icon : '',
                totalDamage: mergedDamage
            };
        }

        // 圖鑑解鎖與試玩感官數據追蹤
        if (GameApp.systems && GameApp.systems.codex && typeof GameApp.systems.codex.unlockEntry === 'function') {
            GameApp.systems.codex.unlockEntry(`tower:${fusion.type}`);
        }
        if (GameApp.backend && typeof GameApp.backend.trackFeel === 'function') {
            GameApp.backend.trackFeel(`Fusion:Create:${fusion.type}:Tier_${fusion.tier}`, st.fusionCount, {
                resultType: fusion.type,
                tier: fusion.tier,
                isCrossElement: fusion.isCrossElement,
                mapId: st.currentMapId
            });
        }

        return { fusion, mergedTower, bonusHint: getAscensionHint(fusion) };
    }

    const EvolutionSystem = {
        bind,
        getRecipeKey,
        getFusionResult,
        canCombineTowers,
        getAscensionHint,
        executeTowerFusion
    };

    GameApp.systems = GameApp.systems || {};
    GameApp.systems.evolution = EvolutionSystem;
})(window);
