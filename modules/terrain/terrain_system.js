/**
 * ============================================================================
 * 【檔案名稱】：modules/terrain/terrain_system.js
 * 【負責功能】：判斷指定棋盤格是否允許建造防禦塔、計算該格對防禦塔的射程／攻速／傷害增益倍率，
 *               並提供佈陣熱區分類（前段入口／中段轉角／後段世界樹／特殊地形格）。
 * 【讀取資料】：讀取 modules/terrain/terrain_data.js 與當前地圖跑道集合 PATH_CELL_INDICES。
 * 【常見修改入口】：
 *   1. 修改建塔合法性判定：修改 canBuildAt()。
 *   2. 修改特殊地形對防禦塔的三維加成計算：修改 getTerrainBonusesAt()。
 * ============================================================================
 */
(function (global) {
    'use strict';

    const GameApp = global.GameApp = global.GameApp || {};
    const CONFIG = GameApp.config || {};
    const { indexToCoords } = GameApp.helpers || {};

    let G = null;
    function bind(ctx) { G = ctx; }

    function getTerrainsDict() {
        return (GameApp.data && GameApp.data.terrain && GameApp.data.terrain.TERRAIN_TYPES) || {};
    }

    function getTerrainAt(index) {
        if (!G || !G.map || !G.map.terrainMap) return null;
        return G.map.terrainMap.get(index) || null;
    }

    function getChargedStoneIndices() {
        return (G && G.map && Array.isArray(G.map.chargedStoneIndices)) ? G.map.chargedStoneIndices : [];
    }

    function getActiveChargedStoneIndex(waveNum = null) {
        const list = getChargedStoneIndices();
        if (list.length === 0) return -1;
        const rawWave = waveNum !== null && waveNum !== undefined
            ? waveNum
            : (G && G.state ? G.state.currentWave : 1);
        const w = Math.max(1, Math.floor(Number(rawWave) || 1));
        const slot = Math.floor((w - 1) / 2) % list.length;
        return list[slot];
    }

    function isChargedStoneActiveAt(index, waveNum = null) {
        if (!Number.isFinite(index) || index < 0) return false;
        if (getTerrainAt(index) !== 'charged_stone') return false;
        return index === getActiveChargedStoneIndex(waveNum);
    }

    function getEffectiveTerrainKey(index) {
        if (!G || !G.map) return 'grass';
        if (G.map.pathCellIndices && G.map.pathCellIndices.has(index)) return 'path';
        return G.map.terrainMap.get(index) || 'grass';
    }

    /**
     * 判斷指定格子是否可建塔（排除越界、跑道格與 buildable === false 的障礙地塊）
     */
    function canBuildAt(index) {
        const boardSize = CONFIG.BOARD_SIZE || 150;
        if (!Number.isFinite(index) || index < 0 || index >= boardSize) return false;
        if (G && G.map && G.map.pathCellIndices && G.map.pathCellIndices.has(index)) return false;

        const WaveSys = GameApp.systems && GameApp.systems.wave;
        if (WaveSys && WaveSys.PATH_CELL_INDICES && WaveSys.PATH_CELL_INDICES.has(index)) return false;

        const terrainKey = getTerrainAt(index);
        if (!terrainKey) return true;
        const tCfg = getTerrainsDict()[terrainKey];
        return tCfg ? tCfg.buildable !== false : true;
    }

    /**
     * 回傳指定格子的射程倍率、攻速倍率與傷害倍率
     */
    function getTerrainBonusesAt(index) {
        const terrainKey = getTerrainAt(index);
        const tCfg = terrainKey ? getTerrainsDict()[terrainKey] : null;
        if (!tCfg) {
            return {
                terrainType: null,
                rangeMult: 1.0,
                attackSpeedMult: 1.0,
                damageMult: 1.0,
                isActiveChargedStone: false,
                shortTag: '',
                tooltip: ''
            };
        }

        const rangeMult = Number.isFinite(tCfg.rangeMult) ? tCfg.rangeMult : 1.0;
        const attackSpeedMult = Number.isFinite(tCfg.attackSpeedMult) ? tCfg.attackSpeedMult : 1.0;
        let damageMult = 1.0;
        let isActiveChargedStone = false;

        if (terrainKey === 'charged_stone') {
            isActiveChargedStone = isChargedStoneActiveAt(index);
            damageMult = isActiveChargedStone ? (Number.isFinite(tCfg.damageMult) ? tCfg.damageMult : 1.40) : 1.0;
        } else if (Number.isFinite(tCfg.maxDamageBonus) && tCfg.maxDamageBonus > 0) {
            const treeCfg = (GameApp.data && GameApp.data.tree && GameApp.data.tree.TREE_CONFIG) || {};
            const maxHp = (G && G.state && G.state.maxBaseHp) || treeCfg.INITIAL_BASE_HP || CONFIG.INITIAL_BASE_HP || 20;
            const curHp = (G && G.state && Number.isFinite(G.state.baseHp)) ? G.state.baseHp : maxHp;
            const hpRatio = Math.max(0, Math.min(1, curHp / Math.max(1, maxHp)));
            damageMult = 1.0 + tCfg.maxDamageBonus * hpRatio;
        }

        return {
            terrainType: terrainKey,
            rangeMult,
            attackSpeedMult,
            damageMult,
            isActiveChargedStone,
            shortTag: tCfg.shortTag || '',
            tooltip: tCfg.tooltip || ''
        };
    }

    function getTowerTerrainDamageMult(index) {
        return getTerrainBonusesAt(index).damageMult;
    }

    /**
     * 根據棋盤位置與地形分類佈陣熱區（供 GameAnalytics 與單局黑盒子統計 Map:ZoneUsage）
     */
    function classifyBoardZone(index) {
        const terrainKey = getTerrainAt(index);
        const tCfg = terrainKey ? getTerrainsDict()[terrainKey] : null;
        const isSpecialTerrain = Boolean(tCfg && tCfg.isSpecial);

        const coords = indexToCoords ? indexToCoords(index) : { x: index % 15, y: Math.floor(index / 15) };
        let region = 'middle';
        if (coords.y <= 3 && coords.x <= 8) {
            region = 'front';
        } else if (coords.y >= 7 && coords.x >= 9) {
            region = 'back';
        }
        return {
            region,
            isSpecialTerrain,
            terrainKey: terrainKey || 'grass'
        };
    }

    /**
     * 地脈拓荒與黑市開採：花費 45 金幣清除障礙巨岩，或開採「藏寶巨石」獲得金幣（軟上限）／果實／2★ 塔
     */
    function clearObstacleAt(index) {
        const terrainKey = getTerrainAt(index);
        if (!G || !G.state || !G.map || (terrainKey !== 'obstacle' && terrainKey !== 'treasure_rock')) {
            return { ok: false, reason: 'invalid_obstacle' };
        }
        const tCfg = getTerrainsDict()[terrainKey] || {};
        const EconSys = GameApp.systems && GameApp.systems.economy;
        const AttackSys = GameApp.systems && GameApp.systems.towerAttack;
        const CodexSys = GameApp.systems && GameApp.systems.codex;
        const nextRand = (GameApp.helpers && typeof GameApp.helpers.nextRunRandom === 'function')
            ? GameApp.helpers.nextRunRandom
            : Math.random;
        const cost = Number.isFinite(tCfg.clearCost)
            ? tCfg.clearCost
            : (EconSys && typeof EconSys.getObstacleClearCost === 'function' ? EconSys.getObstacleClearCost() : 45);
        if (G.state.currentGold < cost) {
            return { ok: false, reason: 'insufficient_gold', cost, isTreasureRock: terrainKey === 'treasure_rock' };
        }
        G.state.currentGold -= cost;
        G.map.terrainMap.delete(index);
        if (!G.state.clearedObstacles || typeof G.state.clearedObstacles !== 'object') {
            G.state.clearedObstacles = {};
        }

        if (terrainKey === 'treasure_rock') {
            G.state.clearedObstacles[index] = null;
            const roll = nextRand();
            if (roll < 0.40) {
                const rawNetBonus = 30;
                let grantedNet = rawNetBonus;
                let isSoftCapped = false;
                if (EconSys && typeof EconSys.recordNonCombatNetGain === 'function') {
                    const capRes = EconSys.recordNonCombatNetGain(rawNetBonus, G.state.currentWave);
                    grantedNet = capRes.granted || 0;
                    isSoftCapped = Boolean(capRes.isSoftCapped);
                }
                const totalPayout = cost + grantedNet;
                G.state.currentGold += totalPayout;
                G.state.totalGoldEarned = (G.state.totalGoldEarned || 0) + grantedNet;
                return {
                    ok: true,
                    cost,
                    isTreasureRock: true,
                    treasureType: 'gold',
                    totalPayout,
                    netGain: grantedNet,
                    isSoftCapped,
                    revealedTerrain: null
                };
            }
            if (roll < 0.70) {
                const fruitRes = (EconSys && typeof EconSys.grantFusionFruit === 'function')
                    ? EconSys.grantFusionFruit(1)
                    : { storedCount: 1, overflowCount: 0, compensationGold: 0, count: 1, maxSlots: 3 };
                if (fruitRes.overflowCount > 0) {
                    return {
                        ok: true,
                        cost,
                        isTreasureRock: true,
                        treasureType: 'fruit_overflow',
                        compensationGold: fruitRes.compensationGold,
                        fruitCount: fruitRes.count,
                        maxFruitSlots: fruitRes.maxSlots,
                        revealedTerrain: null
                    };
                }
                return {
                    ok: true,
                    cost,
                    isTreasureRock: true,
                    treasureType: 'fruit',
                    fruitCount: fruitRes.count,
                    maxFruitSlots: fruitRes.maxSlots,
                    revealedTerrain: null
                };
            }
            const capReached = (G.callbacks && typeof G.callbacks.isTowerCapReached === 'function')
                ? G.callbacks.isTowerCapReached()
                : false;
            if (capReached) {
                const compGold = cost + 30;
                G.state.currentGold += compGold;
                G.state.totalGoldEarned = (G.state.totalGoldEarned || 0) + compGold;
                return {
                    ok: true,
                    cost,
                    isTreasureRock: true,
                    treasureType: 'tower_cap_gold',
                    totalPayout: compGold,
                    revealedTerrain: null
                };
            }
            const pool = ['fire_trunk', 'ice_trunk', 'thunder_trunk'];
            const pickedType = pool[Math.floor(nextRand() * pool.length)] || 'fire_trunk';
            if (AttackSys && typeof AttackSys.createTowerObj === 'function' && (!G.state.board[index])) {
                const towerObj = AttackSys.createTowerObj(pickedType, 2, cost, null, { keepRawType: true });
                towerObj.investedGold = cost;
                G.state.board[index] = towerObj;
                if (CodexSys && typeof CodexSys.unlockEntry === 'function') {
                    CodexSys.unlockEntry(`tower:${towerObj.type}`);
                }
                if (typeof AttackSys.recalculateLeylines === 'function') {
                    AttackSys.recalculateLeylines();
                }
                return {
                    ok: true,
                    cost,
                    isTreasureRock: true,
                    treasureType: 'tower',
                    spawnedTowerType: towerObj.type,
                    tower: towerObj,
                    revealedTerrain: null
                };
            }
            return { ok: true, cost, isTreasureRock: true, treasureType: 'gold', totalPayout: cost, netGain: 0, isSoftCapped: false, revealedTerrain: null };
        }

        const roll = nextRand();
        let revealedTerrain = null;
        if (roll < 0.45) {
            revealedTerrain = 'mana_vein';
        } else if (roll < 0.85) {
            revealedTerrain = 'highground';
        }
        if (revealedTerrain) {
            G.map.terrainMap.set(index, revealedTerrain);
        }
        G.state.clearedObstacles[index] = revealedTerrain || null;
        return { ok: true, cost, isTreasureRock: false, revealedTerrain };
    }

    const TerrainSystem = {
        bind,
        getTerrainAt,
        getChargedStoneIndices,
        getActiveChargedStoneIndex,
        isChargedStoneActiveAt,
        getEffectiveTerrainKey,
        canBuildAt,
        getTerrainBonusesAt,
        getTowerTerrainDamageMult,
        classifyBoardZone,
        clearObstacleAt
    };

    GameApp.systems = GameApp.systems || {};
    GameApp.systems.terrain = TerrainSystem;
})(window);
