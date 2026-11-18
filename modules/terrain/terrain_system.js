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
                shortTag: '',
                tooltip: ''
            };
        }

        const rangeMult = Number.isFinite(tCfg.rangeMult) ? tCfg.rangeMult : 1.0;
        const attackSpeedMult = Number.isFinite(tCfg.attackSpeedMult) ? tCfg.attackSpeedMult : 1.0;
        let damageMult = 1.0;
        if (Number.isFinite(tCfg.maxDamageBonus) && tCfg.maxDamageBonus > 0) {
            const treeCfg = (GameApp.data && GameApp.data.tree && GameApp.data.tree.TREE_CONFIG) || {};
            const maxHp = treeCfg.INITIAL_BASE_HP || CONFIG.INITIAL_BASE_HP || 20;
            const curHp = (G && G.state && Number.isFinite(G.state.baseHp)) ? G.state.baseHp : maxHp;
            const hpRatio = Math.max(0, Math.min(1, curHp / Math.max(1, maxHp)));
            damageMult = 1.0 + tCfg.maxDamageBonus * hpRatio;
        }

        return {
            terrainType: terrainKey,
            rangeMult,
            attackSpeedMult,
            damageMult,
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

    const TerrainSystem = {
        bind,
        getTerrainAt,
        getEffectiveTerrainKey,
        canBuildAt,
        getTerrainBonusesAt,
        getTowerTerrainDamageMult,
        classifyBoardZone
    };

    GameApp.systems = GameApp.systems || {};
    GameApp.systems.terrain = TerrainSystem;
})(window);
