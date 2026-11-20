/**
 * ============================================================================
 * 【檔案名稱】：modules/routes/wave_system.js
 * 【負責功能】：路線三合一即時重算（根據 waypoints 自動更新地面石磚、行軍路線與禁建格 PATH_CELL_INDICES）、
 *               波次倒數、出怪佇列生成與過波結算。
 * 【讀取資料】：讀取 modules/routes/route_data.js 與 modules/monsters/monster_data.js。
 * 【常見修改入口】：
 *   1. 修改路線點轉跑道格重算邏輯：修改 applyMapConfig() / rebuildRouteFromWaypoints()。
 *   2. 修改各波次出怪組成與魔王登場判定：修改 buildWaveQueue()、isBossWaveNumber()。
 * ============================================================================
 */
(function (global) {
    'use strict';

    const GameApp = global.GameApp = global.GameApp || {};
    const CONFIG = GameApp.config || {};
    const { clampNumber, coordsToIndex, indexToCoords } = GameApp.helpers || {};

    let G = null;
    const PATH_CELL_INDICES = new Set();

    function bind(ctx) { G = ctx; }

    function getRoutesData() {
        return (GameApp.data && GameApp.data.routes) || {};
    }

    function getCurrentMapSpec() {
        const maps = getRoutesData().MAPS_CONFIG || {};
        const curId = (G && G.state && G.state.currentMapId) || 'forest';
        return maps[curId] || maps.forest;
    }

    /**
     * 根據指定地圖的 waypoints 即時重算 PATH_CELL_INDICES、方向箭頭與地形分佈
     * 實現「地面石磚外觀」、「怪物行軍路線」與「拖拉禁止建塔區域」三合一自動連動
     */
    function applyMapConfig(mapId, options = {}) {
        const maps = getRoutesData().MAPS_CONFIG || {};
        const spec = maps[mapId] || maps.forest;
        if (!spec || !G || !G.map) return;

        const map = G.map;
        const boardSize = CONFIG.BOARD_SIZE || 150;
        G.state.currentMapId = spec.id;
        map.waypoints = spec.waypoints.map(pt => ({ x: pt.x, y: pt.y }));
        map.altWaypoints = Array.isArray(spec.altWaypoints) ? spec.altWaypoints.map(pt => ({ x: pt.x, y: pt.y })) : null;
        map.startCellIndex = coordsToIndex(map.waypoints[0].x, map.waypoints[0].y);
        map.altStartCellIndex = map.altWaypoints ? coordsToIndex(map.altWaypoints[0].x, map.altWaypoints[0].y) : null;
        map.startCellIndices = new Set([map.startCellIndex]);
        if (map.altStartCellIndex !== null) map.startCellIndices.add(map.altStartCellIndex);
        map.endCellIndex = coordsToIndex(map.waypoints[map.waypoints.length - 1].x, map.waypoints[map.waypoints.length - 1].y);

        map.pathCellIndices.clear();
        PATH_CELL_INDICES.clear();

        const traceWaypoints = (wps) => {
            if (!Array.isArray(wps) || wps.length === 0) return;
            for (let i = 0; i < wps.length - 1; i++) {
                const p1 = wps[i], p2 = wps[i + 1];
                let cx = p1.x, cy = p1.y;
                const startIdx = coordsToIndex(cx, cy);
                map.pathCellIndices.add(startIdx);
                PATH_CELL_INDICES.add(startIdx);
                while (cx !== p2.x || cy !== p2.y) {
                    if (cx < p2.x) cx++; else if (cx > p2.x) cx--; else if (cy < p2.y) cy++; else cy--;
                    const stepIdx = coordsToIndex(cx, cy);
                    map.pathCellIndices.add(stepIdx);
                    PATH_CELL_INDICES.add(stepIdx);
                }
            }
        };
        traceWaypoints(map.waypoints);
        if (map.altWaypoints) traceWaypoints(map.altWaypoints);

        const pathCoords = Array.from(map.pathCellIndices).map(indexToCoords);
        for (let idx = 0; idx < boardSize; idx++) {
            if (map.pathCellIndices.has(idx)) { map.cellPathDist[idx] = 0; continue; }
            const c = indexToCoords(idx);
            let minDist = Infinity;
            for (let p = 0; p < pathCoords.length; p++) {
                const d = Math.hypot(c.x - pathCoords[p].x, c.y - pathCoords[p].y);
                if (d < minDist) minDist = d;
            }
            map.cellPathDist[idx] = minDist;
        }

        map.terrainMap.clear();
        if (spec.terrainLayout && typeof spec.terrainLayout === 'object') {
            Object.entries(spec.terrainLayout).forEach(([terrainType, coordsList]) => {
                if (!Array.isArray(coordsList)) return;
                for (let i = 0; i < coordsList.length; i++) {
                    const idx = coordsToIndex(coordsList[i][0], coordsList[i][1]);
                    if (!map.pathCellIndices.has(idx)) map.terrainMap.set(idx, terrainType);
                }
            });
        }

        const buildCumDist = (wps) => {
            const arr = [0];
            for (let i = 0; i < wps.length - 1; i++) {
                arr.push(arr[i] + Math.hypot(wps[i + 1].x - wps[i].x, wps[i + 1].y - wps[i].y));
            }
            return arr;
        };
        map.waypointCumDist = buildCumDist(map.waypoints);
        map.altWaypointCumDist = map.altWaypoints ? buildCumDist(map.altWaypoints) : null;

        map.pathFlowArrows.clear();
        const traceArrows = (wps) => {
            let step = 0;
            for (let i = 0; i < wps.length - 1; i++) {
                const p1 = wps[i], p2 = wps[i + 1];
                const sdx = Math.sign(p2.x - p1.x), sdy = Math.sign(p2.y - p1.y);
                const deg = sdx === 1 ? 0 : (sdy === 1 ? 90 : (sdx === -1 ? 180 : -90));
                let cx = p1.x, cy = p1.y;
                while (cx !== p2.x || cy !== p2.y) {
                    const idx = coordsToIndex(cx, cy);
                    if (!map.startCellIndices.has(idx) && idx !== map.endCellIndex && !map.pathFlowArrows.has(idx)
                        && ((cx === p1.x && cy === p1.y && i > 0) || step % 2 === 1)) {
                        map.pathFlowArrows.set(idx, deg);
                    }
                    cx += sdx; cy += sdy; step++;
                }
            }
        };
        traceArrows(map.waypoints);
        if (map.altWaypoints) traceArrows(map.altWaypoints);

        if (typeof document !== 'undefined' && document.body) {
            document.body.classList.toggle('map-lava', G.state.currentMapId === 'lava');
            document.body.classList.toggle('map-frost', G.state.currentMapId === 'frost');
        }

        // 若開啟 syncRender，立即刷新地面石磚與棋盤狀態
        if (options.syncRender && GameApp.renderer && G.dom && G.dom.boardElement) {
            GameApp.renderer.initBoard();
            GameApp.renderer.renderBoard();
        }
    }

    function rebuildRouteFromWaypoints(mapId = null) {
        const targetId = mapId || (G && G.state && G.state.currentMapId) || 'forest';
        applyMapConfig(targetId, { syncRender: true });
        return PATH_CELL_INDICES;
    }

    function isBossWaveNumber(waveNum) {
        const victoryWave = CONFIG.VICTORY_WAVE || 10;
        if (waveNum === 5) return true;
        const isEndless = G && G.state && G.state.isEndlessMode;
        if (!isEndless && waveNum === victoryWave) return true;
        return Boolean(isEndless && waveNum >= victoryWave && waveNum % 5 === 0);
    }

    function computeWaveHpScale(waveNum) {
        const wb = getRoutesData().WAVE_BALANCE || {};
        const w = Math.max(1, Number(waveNum) || 1);
        const linear = Number.isFinite(wb.HP_GROWTH_LINEAR) ? wb.HP_GROWTH_LINEAR : 0.30;
        const quad = Number.isFinite(wb.HP_GROWTH_QUAD) ? wb.HP_GROWTH_QUAD : 0.068;
        if (w <= 10) {
            return 1 + linear * (w - 1) + quad * Math.pow(w - 1, 2);
        }
        const baseW10 = Number.isFinite(wb.ENDLESS_HP_BASE_W10) ? wb.ENDLESS_HP_BASE_W10 : 9.21;
        const expBase = Number.isFinite(wb.ENDLESS_HP_EXP) ? wb.ENDLESS_HP_EXP : 1.20;
        return baseW10 * Math.pow(expBase, w - 10);
    }

    function getBossSpecForWave(waveNum) {
        const monstersData = (GameApp.data && GameApp.data.monsters) || {};
        const bossRoster = monstersData.BOSS_ROSTER || [];
        const monsterDb = monstersData.MONSTER_DATABASE || {};
        const wb = getRoutesData().WAVE_BALANCE || {};
        const victoryWave = CONFIG.VICTORY_WAVE || 10;

        const milestoneIdx = Math.max(0, Math.floor(waveNum / 5) - 1);
        const template = bossRoster[milestoneIdx % Math.max(1, bossRoster.length)] || {
            typeKey: 'wood', name: '腐朽古樹王', icon: '👹', weakness: 'fire', armorBase: 22, hpBase: 9000
        };

        let bossHp;
        let bossArmor;
        if (bossRoster.length > 0 && milestoneIdx < bossRoster.length) {
            bossHp = Number(template.hpBase) || 2800;
            bossArmor = Number(template.armorBase) || 16;
        } else {
            const lastBoss = bossRoster[Math.max(0, bossRoster.length - 1)] || template;
            const stepsBeyond = Math.max(1, milestoneIdx - Math.max(0, bossRoster.length - 1));
            const hpStepMult = Number.isFinite(wb.ENDLESS_BOSS_HP_MULT) ? wb.ENDLESS_BOSS_HP_MULT : 2.364;
            const armorStep = Number.isFinite(wb.ENDLESS_BOSS_ARMOR_STEP) ? wb.ENDLESS_BOSS_ARMOR_STEP : 6;
            const rawHp = (Number(lastBoss.hpBase) || 22000) * Math.pow(hpStepMult, stepsBeyond);
            bossHp = Math.round(rawHp / 100) * 100;
            bossArmor = (Number(lastBoss.armorBase) || 26) + stepsBeyond * armorStep;
        }

        const bossBaseDamage = waveNum === victoryWave
            ? (wb.BOSS_BASE_DAMAGE || 20)
            : (waveNum === 5 ? (wb.MID_BOSS_BASE_DAMAGE || 8) : (wb.ENDLESS_BOSS_BASE_DAMAGE || 10));

        const refMonster = monsterDb[template.typeKey] || {};
        return {
            typeKey: template.typeKey,
            name: template.name,
            icon: template.icon,
            weakness: template.weakness || refMonster.weakness || 'fire',
            armor: bossArmor,
            hp: bossHp,
            baseDamage: bossBaseDamage,
            reward: waveNum === 5 ? (wb.MID_BOSS_REWARD || 75) : (wb.BOSS_REWARD || 120),
            bossMechanic: template.bossMechanic || '',
            shellHits: template.shellHits || 0,
            shellReduction: template.shellReduction || 0,
            summonIntervalMs: template.summonIntervalMs || 0,
            summonCount: template.summonCount || 0,
            healPct: template.healPct || 0,
            shieldRatio: template.shieldRatio || 0,
            empIntervalMs: template.empIntervalMs || 0,
            empTargets: template.empTargets || 0,
            empDisableMs: template.empDisableMs || 0,
            traitDesc: template.traitDesc || ''
        };
    }

    /**
     * 取得指定波次的出怪池：除讀取 route_data.js 預設池外，自動掃描 monster_data.js 動態新增之怪物
     */
    function getWaveNormalPool(waveNum) {
        const wavesCfg = getRoutesData().WAVES || { pools: [] };
        let baseList = ['wood', 'lava', 'air'];
        for (let i = 0; i < wavesCfg.pools.length; i++) {
            if (waveNum <= wavesCfg.pools[i].maxWave) {
                baseList = wavesCfg.pools[i].monsters.slice();
                break;
            }
        }

        const monsterDb = (GameApp.data && GameApp.data.monsters && GameApp.data.monsters.MONSTER_DATABASE) || {};
        Object.keys(monsterDb).forEach((mKey) => {
            const mCfg = monsterDb[mKey];
            if (!mCfg || mCfg.isBoss || mCfg.isSplitChild) return;
            const minWave = Number.isFinite(mCfg.minWave) ? mCfg.minWave : 1;
            if (waveNum >= minWave && !baseList.includes(mKey)) {
                baseList.push(mKey);
            }
        });

        return baseList.filter(k => Boolean(monsterDb[k]));
    }

    function buildWaveQueue(waveNum) {
        const wb = getRoutesData().WAVE_BALANCE || {};
        const monsterDb = (GameApp.data && GameApp.data.monsters && GameApp.data.monsters.MONSTER_DATABASE) || {};
        const monsterRules = (GameApp.data && GameApp.data.monsters && GameApp.data.monsters.GLOBAL_MONSTER_RULES) || {};
        const victoryWave = CONFIG.VICTORY_WAVE || 10;
        const isEndless = G && G.state && G.state.isEndlessMode;

        const pool = getWaveNormalPool(waveNum);
        const hasBoss = isBossWaveNumber(waveNum);
        const totalCount = (!isEndless && waveNum === victoryWave)
            ? (wb.FINAL_WAVE_ESCORT_COUNT || 14)
            : (waveNum === 5 ? (wb.WAVE5_ESCORT_COUNT || 10) : Math.min(wb.MAX_COUNT_PER_WAVE || 28, (wb.BASE_COUNT || 6) + waveNum * (wb.COUNT_PER_WAVE || 2)));

        const hpScale = computeWaveHpScale(waveNum);
        const rewardBonus = Math.floor((waveNum - 1) / (wb.REWARD_WAVE_STEP || 2));
        const eliteStart = wb.ELITE_START_WAVE || 4;
        const hasElites = waveNum >= eliteStart;
        const eliteCount = hasElites ? Math.min(Math.floor(totalCount * 0.35), 1 + Math.floor((waveNum - eliteStart) / 1.5)) : 0;
        const eliteArmor = hasElites ? (wb.ELITE_BASE_ARMOR || 6) + Math.floor((waveNum - eliteStart) / (wb.ELITE_ARMOR_GROWTH_STEP || 3)) * 2 : 0;

        const eliteSlots = new Set();
        for (let e = 0; e < eliteCount; e++) eliteSlots.add(Math.min(totalCount - 1, Math.floor(((e + 1) * totalCount) / (eliteCount + 0.5))));
        for (let idxC = totalCount - 1; eliteSlots.size < eliteCount && idxC >= 0; idxC--) eliteSlots.add(idxC);

        const mapSpec = getCurrentMapSpec();
        const hasAltRoute = Boolean(mapSpec && Array.isArray(mapSpec.altWaypoints) && mapSpec.altWaypoints.length >= 2);
        const queue = [];
        for (let i = 0; i < totalCount; i++) {
            const typeKey = pool[(i + waveNum - 1) % Math.max(1, pool.length)];
            const mCfg = monsterDb[typeKey] || {};
            const isElite = eliteSlots.has(i);
            let armor = Number(mCfg.baseArmor) || 0;
            if (armor > 0 && Number.isFinite(mCfg.armorGrowthPerWave)) {
                armor = Math.min(mCfg.maxArmor || 20, armor + Math.max(0, waveNum - (mCfg.minWave || 4)) * mCfg.armorGrowthPerWave);
            } else if (isElite) {
                armor = Math.max(armor, eliteArmor);
            }
            queue.push({ typeKey, hpScale, rewardBonus, isElite, isBoss: false, armor, useAltRoute: hasAltRoute && (i % 2 === 1) });
        }

        let bossMeta = null;
        if (hasBoss) {
            const bossSpec = getBossSpecForWave(waveNum);
            const hpScaleGlobal = clampNumber(monsterRules.MONSTER_HP_SCALE ?? CONFIG.MONSTER_HP_SCALE ?? 1.0, 0.1, 20.0, 1.0);
            queue.push({
                typeKey: bossSpec.typeKey, bossName: bossSpec.name, bossIcon: bossSpec.icon, hpScale: 1, rewardBonus,
                isElite: true, isBoss: true, armor: bossSpec.armor, bossHp: bossSpec.hp, bossBaseDamage: bossSpec.baseDamage, bossReward: bossSpec.reward,
                bossSpec, useAltRoute: false
            });
            bossMeta = { name: bossSpec.name, weakness: bossSpec.weakness, armor: bossSpec.armor, hp: Math.max(10, Math.round(bossSpec.hp * hpScaleGlobal)) };
        }
        return {
            queue,
            eliteCount,
            eliteArmor,
            bossMeta,
            spawnIntervalMs: Math.max(wb.SPAWN_INTERVAL_MIN_MS || 750, (wb.SPAWN_INTERVAL_BASE_MS || 1600) - (waveNum - 1) * (wb.SPAWN_INTERVAL_DECAY_MS || 65))
        };
    }

    const WaveSystem = {
        bind,
        PATH_CELL_INDICES,
        getCurrentMapSpec,
        applyMapConfig,
        rebuildRouteFromWaypoints,
        isBossWaveNumber,
        computeWaveHpScale,
        getBossSpecForWave,
        getWaveNormalPool,
        buildWaveQueue
    };

    GameApp.systems = GameApp.systems || {};
    GameApp.systems.wave = WaveSystem;
    GameApp.systems.routes = WaveSystem;

    if (global.GameConfig) {
        global.GameConfig.getBossSpecForWave = getBossSpecForWave;
        global.GameConfig.getWaveNormalPool = getWaveNormalPool;
    }
})(window);
