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

    function getMapVictoryWave(mapSpec = null) {
        const spec = mapSpec || (G && G.map && G.map.spec) || getCurrentMapSpec();
        return Math.max(1, Math.floor(Number((spec && spec.victoryWave) || CONFIG.VICTORY_WAVE) || 10));
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
        map.spec = spec;
        map.waypoints = spec.waypoints.map(pt => ({
            x: pt.x,
            y: pt.y,
            teleportToNext: Boolean(pt.teleportToNext)
        }));
        map.altWaypoints = Array.isArray(spec.altWaypoints)
            ? spec.altWaypoints.map(pt => ({ x: pt.x, y: pt.y, teleportToNext: Boolean(pt.teleportToNext) }))
            : null;
        map.teleportRift = (spec.teleportRift && spec.teleportRift.from && spec.teleportRift.to)
            ? {
                from: { x: spec.teleportRift.from.x, y: spec.teleportRift.from.y },
                to: { x: spec.teleportRift.to.x, y: spec.teleportRift.to.y },
                fromIndex: coordsToIndex(spec.teleportRift.from.x, spec.teleportRift.from.y),
                toIndex: coordsToIndex(spec.teleportRift.to.x, spec.teleportRift.to.y)
            }
            : null;
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
                const startIdx = coordsToIndex(p1.x, p1.y);
                map.pathCellIndices.add(startIdx);
                PATH_CELL_INDICES.add(startIdx);
                if (p1.teleportToNext) {
                    const destIdx = coordsToIndex(p2.x, p2.y);
                    map.pathCellIndices.add(destIdx);
                    PATH_CELL_INDICES.add(destIdx);
                    continue;
                }
                let cx = p1.x, cy = p1.y;
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
        map.chargedStoneIndices = [];
        if (spec.terrainLayout && typeof spec.terrainLayout === 'object') {
            Object.entries(spec.terrainLayout).forEach(([terrainType, coordsList]) => {
                if (!Array.isArray(coordsList)) return;
                for (let i = 0; i < coordsList.length; i++) {
                    const idx = coordsToIndex(coordsList[i][0], coordsList[i][1]);
                    if (!map.pathCellIndices.has(idx)) {
                        map.terrainMap.set(idx, terrainType);
                        if (terrainType === 'charged_stone') {
                            map.chargedStoneIndices.push(idx);
                        }
                    }
                }
            });
        }

        const buildCumDist = (wps) => {
            const arr = [0];
            for (let i = 0; i < wps.length - 1; i++) {
                if (wps[i].teleportToNext) {
                    arr.push(arr[i]);
                } else {
                    arr.push(arr[i] + Math.hypot(wps[i + 1].x - wps[i].x, wps[i + 1].y - wps[i].y));
                }
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
                if (p1.teleportToNext) continue;
                const sdx = Math.sign(p2.x - p1.x), sdy = Math.sign(p2.y - p1.y);
                const deg = sdx === 1 ? 0 : (sdy === 1 ? 90 : (sdx === -1 ? 180 : -90));
                let cx = p1.x, cy = p1.y;
                while (cx !== p2.x || cy !== p2.y) {
                    const idx = coordsToIndex(cx, cy);
                    if (!map.startCellIndices.has(idx) && idx !== map.endCellIndex && !map.pathFlowArrows.has(idx)
                        && (!map.teleportRift || (idx !== map.teleportRift.fromIndex && idx !== map.teleportRift.toIndex))
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
            document.body.classList.toggle('map-thunder', G.state.currentMapId === 'thunder_isles');
            document.body.classList.toggle('map-blackmarket', G.state.currentMapId === 'blackmarket');
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
        const w = Math.max(1, Math.floor(Number(waveNum) || 1));
        const victoryWave = getMapVictoryWave();
        const isEndless = Boolean(G && G.state && G.state.isEndlessMode);
        if (!isEndless && w > victoryWave) return false;
        if (!isEndless && w === victoryWave) return true;
        return w >= 5 && w % 5 === 0;
    }

    /**
     * 普通/精英雙段血量倍率曲線 M_hp(w)：
     *   1 <= w <= 10: 1 + 0.28 * (w - 1) + 0.062 * Math.pow(w - 1, 2)
     *   w > 10:       8.542 * Math.pow(1.128, w - 10)
     */
    function computeWaveHpScale(waveNum) {
        const wb = getRoutesData().WAVE_BALANCE || {};
        const w = Math.max(1, Number(waveNum) || 1);
        const linear = Number.isFinite(wb.HP_GROWTH_LINEAR) ? wb.HP_GROWTH_LINEAR : 0.28;
        const quad = Number.isFinite(wb.HP_GROWTH_QUAD) ? wb.HP_GROWTH_QUAD : 0.062;
        if (w <= 10) {
            return 1 + linear * (w - 1) + quad * Math.pow(w - 1, 2);
        }
        const baseW10 = Number.isFinite(wb.ENDLESS_HP_BASE_W10) ? wb.ENDLESS_HP_BASE_W10 : 8.542;
        const expBase = Number.isFinite(wb.ENDLESS_HP_EXP) ? wb.ENDLESS_HP_EXP : 1.128;
        return baseW10 * Math.pow(expBase, w - 10);
    }

    /**
     * 每 5 波 Boss 血量公式（m = w / 5）：
     *   H_boss(w) = Math.round(920 * M_hp(w) * (1 + 0.04 * m))
     */
    function computeBossHp(waveNum) {
        const wb = getRoutesData().WAVE_BALANCE || {};
        const w = Math.max(1, Number(waveNum) || 5);
        const m = w / 5;
        const baseCoeff = Number.isFinite(wb.BOSS_BASE_HP_COEFF) ? wb.BOSS_BASE_HP_COEFF : 920;
        const milestoneStep = Number.isFinite(wb.BOSS_MILESTONE_HP_STEP) ? wb.BOSS_MILESTONE_HP_STEP : 0.04;
        return Math.round(baseCoeff * computeWaveHpScale(w) * (1 + milestoneStep * m));
    }

    /**
     * 每 5 波 Boss 護甲公式（m = w / 5，硬封頂 36）：
     *   A_boss(w) = Math.min(36, 12 + Math.round(3.5 * m))
     */
    function computeBossArmor(waveNum) {
        const wb = getRoutesData().WAVE_BALANCE || {};
        const w = Math.max(1, Number(waveNum) || 5);
        const m = w / 5;
        const baseArmor = Number.isFinite(wb.BOSS_BASE_ARMOR) ? wb.BOSS_BASE_ARMOR : 12;
        const perMilestone = Number.isFinite(wb.BOSS_ARMOR_PER_MILESTONE) ? wb.BOSS_ARMOR_PER_MILESTONE : 3.5;
        const armorCap = Number.isFinite(wb.BOSS_ARMOR_CAP) ? wb.BOSS_ARMOR_CAP : 36;
        return Math.min(armorCap, baseArmor + Math.round(perMilestone * m));
    }

    function getEndlessEscalationInfo(waveNum) {
        const isEndless = Boolean(G && G.state && G.state.isEndlessMode);
        const w = Math.max(1, Math.floor(Number(waveNum) || 1));
        if (!isEndless || w < 20) {
            return { isDualAffix: false, isVanguardWave: false, isDualBossWave: false };
        }
        return {
            isDualAffix: w >= 20,
            isVanguardWave: w >= 25,
            isDualBossWave: w >= 30 && (w % 10 === 0)
        };
    }

    function getBossSpecForWave(waveNum, rosterOffset = 0) {
        const monstersData = (GameApp.data && GameApp.data.monsters) || {};
        const bossRoster = monstersData.BOSS_ROSTER || [];
        const monsterDb = monstersData.MONSTER_DATABASE || {};
        const wb = getRoutesData().WAVE_BALANCE || {};
        const victoryWave = getMapVictoryWave();

        const milestoneIdx = (waveNum === victoryWave && victoryWave === 12 && bossRoster.length >= 3)
            ? 2
            : Math.max(0, Math.floor(waveNum / 5) - 1);
        const rosterIdx = (milestoneIdx + Math.max(0, Math.floor(Number(rosterOffset) || 0))) % Math.max(1, bossRoster.length);
        const template = bossRoster[rosterIdx] || {
            typeKey: 'wood', name: '腐朽古樹王', icon: '👹', weakness: 'fire', armorBase: 19, hpBase: 8487
        };

        const bossHp = computeBossHp(waveNum);
        const bossArmor = computeBossArmor(waveNum);

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

    function getCrisisWaveSpec(waveNum) {
        const crisisMap = getRoutesData().CRISIS_WAVES || {};
        const w = Math.max(1, Math.floor(Number(waveNum) || 1));
        return crisisMap[w] || null;
    }

    function isTreasureThiefWave(waveNum) {
        const waves = getRoutesData().TREASURE_THIEF_WAVES || [3, 6, 9];
        const w = Math.max(1, Math.floor(Number(waveNum) || 1));
        return Array.isArray(waves) && waves.includes(w);
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
            if (!mCfg || mCfg.isBoss || mCfg.isSplitChild || mCfg.isTreasureThief) return;
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
        const TreeSys = GameApp.systems && GameApp.systems.tree;
        const victoryWave = getMapVictoryWave();
        const isEndless = G && G.state && G.state.isEndlessMode;

        const pool = getWaveNormalPool(waveNum);
        const crisisSpec = getCrisisWaveSpec(waveNum);
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

        const crisisSlots = new Set();
        if (crisisSpec && Array.isArray(crisisSpec.featuredMonsters) && crisisSpec.featuredMonsters.length > 0) {
            const focusCount = Math.min(totalCount, Math.max(1, Math.round(totalCount * (crisisSpec.focusRatio || 0.70))));
            for (let k = 0; k < focusCount; k++) {
                crisisSlots.add(Math.min(totalCount - 1, Math.floor((k * totalCount) / focusCount)));
            }
            for (let idxC = 0; crisisSlots.size < focusCount && idxC < totalCount; idxC++) {
                crisisSlots.add(idxC);
            }
        }

        const mapSpec = getCurrentMapSpec();
        const hasAltRoute = Boolean(mapSpec && Array.isArray(mapSpec.altWaypoints) && mapSpec.altWaypoints.length >= 2);
        const createRng = GameApp.helpers && GameApp.helpers.createSeededRng;
        const affixSeedKey = (G && G.state && (G.state.dailySeedCode || G.state.runSeedCode || G.state.sessionId)) || 1;
        const affixDict = (GameApp.data && GameApp.data.monsters && GameApp.data.monsters.ELITE_AFFIXES) || {};
        const eligibleAffixes = Object.keys(affixDict)
            .map((k) => affixDict[k])
            .filter((af) => af && (Number(af.minWave) || 6) <= waveNum);
        const affixPool = [];
        if (eligibleAffixes.length > 0) {
            for (let ai = 0; ai < eligibleAffixes.length; ai++) {
                const af = eligibleAffixes[ai];
                const weight = (waveNum >= 10 && (Number(af.minWave) || 6) >= 10) ? 2 : 1;
                for (let w = 0; w < weight; w++) affixPool.push(af.id);
            }
        } else {
            affixPool.push('bounty', 'frenzied', 'shield_regen');
        }
        const escalationInfo = getEndlessEscalationInfo(waveNum);
        const eliteAffixCounts = {};
        const queue = [];
        let crisisSeq = 0;
        for (let i = 0; i < totalCount; i++) {
            const typeKey = crisisSlots.has(i)
                ? crisisSpec.featuredMonsters[crisisSeq++ % crisisSpec.featuredMonsters.length]
                : pool[(i + waveNum - 1) % Math.max(1, pool.length)];
            const mCfg = monsterDb[typeKey] || {};
            const isElite = eliteSlots.has(i);
            let armor = Number(mCfg.baseArmor) || 0;
            if (armor > 0 && Number.isFinite(mCfg.armorGrowthPerWave)) {
                armor = Math.min(mCfg.maxArmor || 20, armor + Math.max(0, waveNum - (mCfg.minWave || 4)) * mCfg.armorGrowthPerWave);
            } else if (isElite) {
                armor = Math.max(armor, eliteArmor);
            }
            let eliteAffix = null;
            const eliteAffixes = [];
            if (waveNum >= 6 && isElite) {
                const affixRng = typeof createRng === 'function' ? createRng(`${affixSeedKey}:eliteAffix:${waveNum}:${i}`) : null;
                const roll = affixRng ? affixRng() : (((waveNum * 7 + i * 13) % 97) / 97);
                eliteAffix = affixPool[Math.floor(roll * affixPool.length) % affixPool.length];
                eliteAffixes.push(eliteAffix);
                eliteAffixCounts[eliteAffix] = (eliteAffixCounts[eliteAffix] || 0) + 1;

                // W20+ 無盡深層異變：菁英怪抽取 2 項不重複詞條
                if (escalationInfo.isDualAffix) {
                    const secondPool = affixPool.filter(afId => afId !== eliteAffix);
                    if (secondPool.length > 0) {
                        const roll2 = affixRng ? affixRng() : (((waveNum * 11 + i * 29 + 5) % 97) / 97);
                        const affix2 = secondPool[Math.floor(roll2 * secondPool.length) % secondPool.length];
                        eliteAffixes.push(affix2);
                        eliteAffixCounts[affix2] = (eliteAffixCounts[affix2] || 0) + 1;
                    }
                }
            }
            // W25+ 無盡先鋒號角：前 3 隻先鋒獲得「霸體先鋒」（常駐韌性＋1.8格內友軍移速 +15%）
            const isVanguard = Boolean(escalationInfo.isVanguardWave && i < 3);
            queue.push({
                typeKey,
                waveLevel: waveNum,
                hpScale,
                rewardBonus,
                isElite,
                eliteAffix,
                eliteAffixes,
                isVanguard,
                isBoss: false,
                armor,
                useAltRoute: hasAltRoute && (i % 2 === 1)
            });
        }

        let hasThief = false;
        const thiefUnlocked = TreeSys && typeof TreeSys.isMetaNodeUnlocked === 'function' ? TreeSys.isMetaNodeUnlocked('ancient_2') : false;
        if (thiefUnlocked && isTreasureThiefWave(waveNum) && monsterDb.thief) {
            const insertIdx = Math.max(1, Math.floor(queue.length * 0.45));
            queue.splice(insertIdx, 0, {
                typeKey: 'thief',
                waveLevel: waveNum,
                hpScale,
                rewardBonus: 0,
                isElite: false,
                isBoss: false,
                isTreasureThief: true,
                armor: 0,
                useAltRoute: false
            });
            hasThief = true;
        }

        let bossMeta = null;
        if (hasBoss) {
            const hpScaleGlobal = clampNumber(monsterRules.MONSTER_HP_SCALE ?? CONFIG.MONSTER_HP_SCALE ?? 1.0, 0.1, 20.0, 1.0);
            if (escalationInfo.isDualBossWave) {
                const bossSpec1 = getBossSpecForWave(waveNum, 0);
                const bossSpec2 = getBossSpecForWave(waveNum, 1);
                const hp1 = Math.max(10, Math.round(bossSpec1.hp * 0.62));
                const hp2 = Math.max(10, Math.round(bossSpec2.hp * 0.62));
                queue.push({
                    typeKey: bossSpec1.typeKey, waveLevel: waveNum, bossName: bossSpec1.name, bossIcon: bossSpec1.icon, hpScale: 1, rewardBonus,
                    isElite: true, isBoss: true, armor: bossSpec1.armor, bossHp: hp1, bossBaseDamage: bossSpec1.baseDamage, bossReward: bossSpec1.reward,
                    bossSpec: bossSpec1, useAltRoute: false, bossIndex: 1, bossTotal: 2
                });
                queue.push({
                    typeKey: bossSpec2.typeKey, waveLevel: waveNum, bossName: bossSpec2.name, bossIcon: bossSpec2.icon, hpScale: 1, rewardBonus,
                    isElite: true, isBoss: true, armor: bossSpec2.armor, bossHp: hp2, bossBaseDamage: bossSpec2.baseDamage, bossReward: bossSpec2.reward,
                    bossSpec: bossSpec2, useAltRoute: false, bossIndex: 2, bossTotal: 2, spawnDelayMs: 6000
                });
                const meta1 = { name: bossSpec1.name, weakness: bossSpec1.weakness, armor: bossSpec1.armor, hp: Math.max(10, Math.round(hp1 * hpScaleGlobal)) };
                const meta2 = { name: bossSpec2.name, weakness: bossSpec2.weakness, armor: bossSpec2.armor, hp: Math.max(10, Math.round(hp2 * hpScaleGlobal)) };
                bossMeta = {
                    isDualBoss: true,
                    bossCount: 2,
                    bossList: [meta1, meta2],
                    name: `${meta1.name} ＋ ${meta2.name}`,
                    weakness: meta1.weakness,
                    armor: meta1.armor,
                    hp: meta1.hp
                };
            } else {
                const bossSpec = getBossSpecForWave(waveNum, 0);
                queue.push({
                    typeKey: bossSpec.typeKey, waveLevel: waveNum, bossName: bossSpec.name, bossIcon: bossSpec.icon, hpScale: 1, rewardBonus,
                    isElite: true, isBoss: true, armor: bossSpec.armor, bossHp: bossSpec.hp, bossBaseDamage: bossSpec.baseDamage, bossReward: bossSpec.reward,
                    bossSpec, useAltRoute: false, bossIndex: 1, bossTotal: 1
                });
                bossMeta = {
                    isDualBoss: false,
                    bossCount: 1,
                    name: bossSpec.name,
                    weakness: bossSpec.weakness,
                    armor: bossSpec.armor,
                    hp: Math.max(10, Math.round(bossSpec.hp * hpScaleGlobal))
                };
            }
        }
        return {
            queue,
            eliteCount,
            eliteArmor,
            eliteAffixCounts,
            bossMeta,
            crisisSpec,
            escalationInfo,
            hasThief,
            spawnIntervalMs: Math.max(wb.SPAWN_INTERVAL_MIN_MS || 750, (wb.SPAWN_INTERVAL_BASE_MS || 1600) - (waveNum - 1) * (wb.SPAWN_INTERVAL_DECAY_MS || 65))
        };
    }

    const WaveSystem = {
        bind,
        PATH_CELL_INDICES,
        getCurrentMapSpec,
        getMapVictoryWave,
        applyMapConfig,
        rebuildRouteFromWaypoints,
        isBossWaveNumber,
        getCrisisWaveSpec,
        isTreasureThiefWave,
        computeWaveHpScale,
        M_hp: computeWaveHpScale,
        computeBossHp,
        H_boss: computeBossHp,
        computeBossArmor,
        A_boss: computeBossArmor,
        getEndlessEscalationInfo,
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
