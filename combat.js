(function (global) {
    'use strict';

    const {
        CONFIG, ELEMENT_CONFIG, BASE_ELEMENT_TYPES, ICE_LINEAGE_TYPES, FIRE_LINEAGE_TYPES,
        THUNDER_LINEAGE_TYPES, SPECIAL_MECHANIC_MONSTERS, FUSION_RECIPES, TIER_DAMAGE_TABLE,
        TERRAIN_CONFIG, MONSTER_DATABASE, WAVE_BALANCE, MAPS_CONFIG, clampNumber,
        coordsToIndex, indexToCoords, getBossSpecForWave, getWaveNormalPool
    } = global.GameConfig;

    const SoundEngine = global.GameAudio;
    let G = null;
    function bind(ctx) { G = ctx; }

    // ==================== 地圖路徑與地形幾何 ====================
    function getCurrentMapSpec() { return MAPS_CONFIG[G.state.currentMapId] || MAPS_CONFIG.forest; }
    function getTerrainAt(index) { return G.map.terrainMap.get(index) || null; }

    function applyMapConfig(mapId) {
        const spec = MAPS_CONFIG[mapId] || MAPS_CONFIG.forest, map = G.map;
        G.state.currentMapId = spec.id;
        map.waypoints = spec.waypoints.map(pt => ({ x: pt.x, y: pt.y }));
        map.startCellIndex = coordsToIndex(map.waypoints[0].x, map.waypoints[0].y);
        map.endCellIndex = coordsToIndex(map.waypoints[map.waypoints.length - 1].x, map.waypoints[map.waypoints.length - 1].y);

        map.pathCellIndices.clear();
        for (let i = 0; i < map.waypoints.length - 1; i++) {
            const p1 = map.waypoints[i], p2 = map.waypoints[i + 1];
            let cx = p1.x, cy = p1.y;
            map.pathCellIndices.add(coordsToIndex(cx, cy));
            while (cx !== p2.x || cy !== p2.y) {
                if (cx < p2.x) cx++; else if (cx > p2.x) cx--; else if (cy < p2.y) cy++; else cy--;
                map.pathCellIndices.add(coordsToIndex(cx, cy));
            }
        }

        const pathCoords = Array.from(map.pathCellIndices).map(indexToCoords);
        for (let idx = 0; idx < CONFIG.BOARD_SIZE; idx++) {
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
        Object.entries(spec.terrainLayout).forEach(([terrainType, coordsList]) => {
            for (let i = 0; i < coordsList.length; i++) {
                const idx = coordsToIndex(coordsList[i][0], coordsList[i][1]);
                if (!map.pathCellIndices.has(idx)) map.terrainMap.set(idx, terrainType);
            }
        });

        map.waypointCumDist = [0];
        for (let i = 0; i < map.waypoints.length - 1; i++) {
            map.waypointCumDist.push(map.waypointCumDist[i] + Math.hypot(map.waypoints[i + 1].x - map.waypoints[i].x, map.waypoints[i + 1].y - map.waypoints[i].y));
        }

        map.pathFlowArrows.clear();
        let step = 0;
        for (let i = 0; i < map.waypoints.length - 1; i++) {
            const p1 = map.waypoints[i], p2 = map.waypoints[i + 1];
            const sdx = Math.sign(p2.x - p1.x), sdy = Math.sign(p2.y - p1.y);
            const deg = sdx === 1 ? 0 : (sdy === 1 ? 90 : (sdx === -1 ? 180 : -90));
            let cx = p1.x, cy = p1.y;
            while (cx !== p2.x || cy !== p2.y) {
                const idx = coordsToIndex(cx, cy);
                if (idx !== map.startCellIndex && idx !== map.endCellIndex && ((cx === p1.x && cy === p1.y && i > 0) || step % 2 === 1)) {
                    map.pathFlowArrows.set(idx, deg);
                }
                cx += sdx; cy += sdy; step++;
            }
        }
        if (typeof document !== 'undefined' && document.body) document.body.classList.toggle('map-lava', G.state.currentMapId === 'lava');
    }

    // ==================== 祝福加成、防禦塔數值、智能選位與融合 ====================
    function hasBlessing(blessingId) { return G.state.activeBlessings.has(blessingId); }

    function getIceLineageSlowParams(towerType, baseRate, baseDurationMs) {
        if (!ICE_LINEAGE_TYPES.includes(towerType) || !hasBlessing('winter_bloodline')) return { rate: baseRate, durationMs: baseDurationMs };
        return {
            rate: Math.min(CONFIG.BLESSING_WINTER_SLOW_CAP, baseRate + CONFIG.BLESSING_WINTER_SLOW_BONUS),
            durationMs: baseDurationMs > 0 ? baseDurationMs + CONFIG.BLESSING_WINTER_DURATION_BONUS_MS : CONFIG.BLESSING_WINTER_STEAM_CHILL_MS
        };
    }

    function getThunderChainBonus(towerType) {
        return (THUNDER_LINEAGE_TYPES.includes(towerType) && hasBlessing('thunder_conduction')) ? CONFIG.BLESSING_THUNDER_EXTRA_TARGETS : 0;
    }

    function getTowerEffectiveRangeCells(index, towerObj) {
        const cfg = ELEMENT_CONFIG[towerObj.type];
        const baseRange = clampNumber(cfg ? cfg.range : 2.0, 0.5, 15.0, 2.0);
        return baseRange * (getTerrainAt(index) === 'highground' ? TERRAIN_CONFIG.highground.rangeMult : 1.0);
    }

    function getTowerRangePx(towerObj, index = null) {
        const rangeCells = index !== null ? getTowerEffectiveRangeCells(index, towerObj)
            : clampNumber(ELEMENT_CONFIG[towerObj.type] && ELEMENT_CONFIG[towerObj.type].range, 0.5, 15.0, 2.0);
        return rangeCells * G.boardMetrics.step;
    }

    function getTowerAttackInterval(towerOrType, index = null) {
        const type = typeof towerOrType === 'string' ? towerOrType : towerOrType.type;
        const baseInterval = (ELEMENT_CONFIG[type] && ELEMENT_CONFIG[type].attackIntervalMs) || CONFIG.ATTACK_INTERVAL;
        let speedMult = 1.0;
        if (index !== null && getTerrainAt(index) === 'mana_vein') speedMult *= TERRAIN_CONFIG.mana_vein.attackSpeedMult;
        if (hasBlessing('thunder_conduction') && THUNDER_LINEAGE_TYPES.includes(type)) speedMult *= (1 + CONFIG.BLESSING_THUNDER_SPEED_BONUS);
        if (G.state.frenzyActiveMs > 0) speedMult *= (1 + CONFIG.SKILL_FRENZY_SPEED_BONUS);
        return Math.max(100, Math.round(baseInterval / Math.max(0.1, speedMult)));
    }

    function getTowerTerrainDamageMult(index) {
        if (getTerrainAt(index) !== 'world_tree') return 1.0;
        return 1 + TERRAIN_CONFIG.world_tree.maxDamageBonus * Math.max(0, Math.min(1, G.state.baseHp / CONFIG.INITIAL_BASE_HP));
    }

    function createTowerObj(type, tier, investedGold, initialAccMs = null, options = {}) {
        const st = G.state;
        const accMs = initialAccMs !== null ? initialAccMs
            : (st.board.some(t => t && t.type === type) ? -(((st.towerPhaseSeq++ % 3) + 1) * 130) : 0);
        return {
            uid: options.uid || st.towerUidCounter++, type, tier, accMs, investedGold,
            targetMode: options.targetMode || 'first',
            totalDamage: Number.isFinite(options.totalDamage) ? options.totalDamage : 0,
            aimAngleDeg: Number.isFinite(options.aimAngleDeg) ? options.aimAngleDeg : 0,
            focusTargetId: null, focusStacks: 0
        };
    }

    function recordTowerDamage(towerObj, damageAmount) {
        if (!towerObj || !Number.isFinite(damageAmount) || damageAmount <= 0) return;
        towerObj.totalDamage = (towerObj.totalDamage || 0) + damageAmount;
        G.state.totalTeamDamage += damageAmount;
        const cfg = ELEMENT_CONFIG[towerObj.type];
        if (!G.state.peakTowerSnapshot || towerObj.totalDamage >= G.state.peakTowerSnapshot.totalDamage) {
            G.state.peakTowerSnapshot = {
                uid: towerObj.uid, type: towerObj.type, tier: towerObj.tier,
                name: cfg ? cfg.name : towerObj.type, icon: cfg ? cfg.icon : '', totalDamage: towerObj.totalDamage
            };
        }
    }

    function getFusionResult(fromTower, toTower) {
        if (!fromTower || !toTower || fromTower.tier !== toTower.tier || toTower.tier >= CONFIG.MAX_TIER) return null;
        const newTier = toTower.tier + 1;
        if (fromTower.type === toTower.type) return { type: toTower.type, tier: newTier, isCrossElement: false };
        if (BASE_ELEMENT_TYPES.includes(fromTower.type) && BASE_ELEMENT_TYPES.includes(toTower.type)) {
            const hybridType = FUSION_RECIPES[[fromTower.type, toTower.type].sort().join('+')];
            if (hybridType) return { type: hybridType, tier: newTier, isCrossElement: true };
        }
        return null;
    }

    function executeTowerFusion(fromIndex, toIndex) {
        const st = G.state, fromTower = st.board[fromIndex], toTower = st.board[toIndex];
        const fusion = getFusionResult(fromTower, toTower);
        if (!fusion) return null;

        const fromInv = Number.isFinite(fromTower.investedGold) ? fromTower.investedGold : CONFIG.BASE_COST * Math.pow(2, fromTower.tier - 1);
        const toInv = Number.isFinite(toTower.investedGold) ? toTower.investedGold : CONFIG.BASE_COST * Math.pow(2, toTower.tier - 1);
        const mergedDamage = (fromTower.totalDamage || 0) + (toTower.totalDamage || 0);
        st.fusionCount++;
        const intervalMs = getTowerAttackInterval(fusion.type, toIndex);
        const carriedAcc = Math.max(0, Math.min(intervalMs - 120, Math.max(fromTower.accMs || 0, toTower.accMs || 0)));

        const mergedTower = createTowerObj(fusion.type, fusion.tier, fromInv + toInv, carriedAcc, {
            targetMode: toTower.targetMode || fromTower.targetMode || 'first',
            totalDamage: mergedDamage
        });
        st.board[toIndex] = mergedTower;
        st.board[fromIndex] = null;

        if (mergedDamage > 0 && (!st.peakTowerSnapshot || mergedDamage >= st.peakTowerSnapshot.totalDamage)) {
            const fusedCfg = ELEMENT_CONFIG[fusion.type];
            st.peakTowerSnapshot = {
                uid: mergedTower.uid, type: mergedTower.type, tier: mergedTower.tier,
                name: fusedCfg ? fusedCfg.name : mergedTower.type, icon: fusedCfg ? fusedCfg.icon : '', totalDamage: mergedDamage
            };
        }
        return { fusion, mergedTower };
    }

    function pickSmartSpawnIndex() {
        const st = G.state, map = G.map;
        if (st.buildTargetIndex !== null && st.buildTargetIndex >= 0 && st.buildTargetIndex < CONFIG.BOARD_SIZE
            && st.board[st.buildTargetIndex] === null && !map.pathCellIndices.has(st.buildTargetIndex)) {
            return { index: st.buildTargetIndex, mode: 'targeted' };
        }
        const nearPathEmpty = [], fallbackEmpty = [];
        for (let idx = 0; idx < CONFIG.BOARD_SIZE; idx++) {
            if (st.board[idx] !== null || map.pathCellIndices.has(idx)) continue;
            if (map.cellPathDist[idx] <= CONFIG.SUMMON_NEAR_PATH_RADIUS) nearPathEmpty.push(idx);
            else fallbackEmpty.push(idx);
        }
        const pool = nearPathEmpty.length > 0 ? nearPathEmpty : fallbackEmpty;
        if (pool.length === 0) return null;
        return { index: pool[Math.floor(Math.random() * pool.length)], mode: nearPathEmpty.length > 0 ? 'near-path' : 'fallback' };
    }

    function getTowerSellRefund(towerObj) {
        if (!towerObj) return 0;
        const fallback = CONFIG.BASE_COST * Math.pow(2, Math.max(0, (towerObj.tier || 1) - 1));
        return Math.floor((Number.isFinite(towerObj.investedGold) ? towerObj.investedGold : fallback) * CONFIG.SELL_REFUND_RATE);
    }

    function getTowerInspectorStats(index, towerObj) {
        const dmgRow = TIER_DAMAGE_TABLE[towerObj.type];
        const baseDmg = (dmgRow && dmgRow[towerObj.tier]) || 10;
        const intervalSec = Math.max(0.1, getTowerAttackInterval(towerObj, index) / 1000);
        let perAttackFactor = 1.0;
        if (towerObj.type === 'thunder') {
            perAttackFactor = (towerObj.tier >= CONFIG.MAX_TIER ? CONFIG.THUNDER_LV3_BOLT_COUNT : CONFIG.THUNDER_BOLT_COUNT) + getThunderChainBonus('thunder');
        } else if (towerObj.type === 'plasma') {
            perAttackFactor = 1 + (towerObj.focusStacks || 0) * CONFIG.PLASMA_STACK_BONUS;
        }
        const hitDmg = baseDmg * getTowerTerrainDamageMult(index) * (hasBlessing('thorn_bulwark') ? (1 + CONFIG.BLESSING_THORN_GLOBAL_DMG) : 1.0) * perAttackFactor;
        return {
            dps: Math.round(hitDmg / intervalSec),
            rangeStr: Number(getTowerEffectiveRangeCells(index, towerObj).toFixed(2)).toString(),
            terrainType: getTerrainAt(index)
        };
    }

    // ==================== 波次產生與怪物生成 ====================
    function isBossWaveNumber(waveNum) {
        if (waveNum === 5) return true;
        if (!G.state.isEndlessMode && waveNum === CONFIG.VICTORY_WAVE) return true;
        return G.state.isEndlessMode && waveNum >= CONFIG.VICTORY_WAVE && waveNum % 5 === 0;
    }

    function buildWaveQueue(waveNum) {
        const pool = getWaveNormalPool(waveNum), hasBoss = isBossWaveNumber(waveNum);
        const totalCount = (!G.state.isEndlessMode && waveNum === CONFIG.VICTORY_WAVE)
            ? WAVE_BALANCE.FINAL_WAVE_ESCORT_COUNT
            : (waveNum === 5 ? WAVE_BALANCE.WAVE5_ESCORT_COUNT : Math.min(WAVE_BALANCE.MAX_COUNT_PER_WAVE, WAVE_BALANCE.BASE_COUNT + waveNum * WAVE_BALANCE.COUNT_PER_WAVE));

        const midLate = waveNum >= 4 ? (1.40 + Math.min(0.10, (waveNum - 4) * (0.10 / 6))) : 1.0;
        const hpScale = (1 + (waveNum - 1) * WAVE_BALANCE.HP_GROWTH_LINEAR + Math.pow(waveNum - 1, 2) * WAVE_BALANCE.HP_GROWTH_QUAD) * midLate * (waveNum >= 5 ? CONFIG.WAVE5_PLUS_HP_MULT : 1.0);
        const rewardBonus = Math.floor((waveNum - 1) / WAVE_BALANCE.REWARD_WAVE_STEP);
        const hasElites = waveNum >= WAVE_BALANCE.ELITE_START_WAVE;
        const eliteCount = hasElites ? Math.min(Math.floor(totalCount * 0.35), 1 + Math.floor((waveNum - WAVE_BALANCE.ELITE_START_WAVE) / 1.5)) : 0;
        const eliteArmor = hasElites ? WAVE_BALANCE.ELITE_BASE_ARMOR + Math.floor((waveNum - WAVE_BALANCE.ELITE_START_WAVE) / WAVE_BALANCE.ELITE_ARMOR_GROWTH_STEP) * 2 : 0;

        const eliteSlots = new Set();
        for (let e = 0; e < eliteCount; e++) eliteSlots.add(Math.min(totalCount - 1, Math.floor(((e + 1) * totalCount) / (eliteCount + 0.5))));
        for (let idxC = totalCount - 1; eliteSlots.size < eliteCount && idxC >= 0; idxC--) eliteSlots.add(idxC);

        const queue = [];
        for (let i = 0; i < totalCount; i++) {
            const typeKey = pool[(i + waveNum - 1) % pool.length], isElite = eliteSlots.has(i);
            const armor = typeKey === 'golem' ? Math.min(20, 15 + Math.max(0, waveNum - 4)) : (isElite ? eliteArmor : 0);
            queue.push({ typeKey, hpScale, rewardBonus, isElite, isBoss: false, armor });
        }

        let bossMeta = null;
        if (hasBoss) {
            const bossSpec = getBossSpecForWave(waveNum), hpScaleGlobal = clampNumber(CONFIG.MONSTER_HP_SCALE, 0.1, 20.0, 1.0);
            queue.push({
                typeKey: bossSpec.typeKey, bossName: bossSpec.name, bossIcon: bossSpec.icon, hpScale: 1, rewardBonus,
                isElite: true, isBoss: true, armor: bossSpec.armor, bossHp: bossSpec.hp, bossBaseDamage: bossSpec.baseDamage, bossReward: bossSpec.reward
            });
            bossMeta = { name: bossSpec.name, weakness: bossSpec.weakness, armor: bossSpec.armor, hp: Math.max(10, Math.round(bossSpec.hp * hpScaleGlobal)) };
        }
        return {
            queue, eliteCount, eliteArmor, bossMeta,
            spawnIntervalMs: Math.max(WAVE_BALANCE.SPAWN_INTERVAL_MIN_MS, WAVE_BALANCE.SPAWN_INTERVAL_BASE_MS - (waveNum - 1) * WAVE_BALANCE.SPAWN_INTERVAL_DECAY_MS)
        };
    }

    function makeMonsterRecord(fields) {
        return { slowTimer: 0, slowRate: 0, armorShredTimer: 0, armorShredRate: 0, rootTimer: 0, rootVulnRate: 0, ...fields };
    }

    function spawnMonsterFromEntry(entry) {
        const Renderer = global.GameRenderer, st = G.state, cfg = MONSTER_DATABASE[entry.typeKey], wp0 = G.map.waypoints[0];
        const startPos = Renderer.getCellCenter(wp0.x, wp0.y);
        const spdGlobal = clampNumber(CONFIG.MONSTER_SPEED_SCALE, 0.2, 5.0, 1.0), hpGlobal = clampNumber(CONFIG.MONSTER_HP_SCALE, 0.1, 20.0, 1.0);

        if (entry.isBoss) {
            const bossHp = Math.max(10, Math.round((entry.bossHp || 4200) * hpGlobal));
            st.monsters.push(makeMonsterRecord({
                id: st.monsterIdCounter++, sessionId: st.sessionId, typeKey: entry.typeKey, name: entry.bossName || '腐朽古樹王', icon: entry.bossIcon || '👹',
                weakness: cfg.weakness, hp: bossHp, maxHp: bossHp, armor: entry.armor, isElite: true, isBoss: true, isSplitChild: false, splitsOnDeath: false,
                baseDamage: entry.bossBaseDamage || WAVE_BALANCE.BOSS_BASE_DAMAGE, reward: (entry.bossReward || WAVE_BALANCE.BOSS_REWARD) + entry.rewardBonus,
                wpIndex: 0, gridX: wp0.x, gridY: wp0.y, pixelX: startPos.left, pixelY: startPos.top, visualOffsetX: 0, visualOffsetY: 0,
                baseSpeed: CONFIG.MONSTER_BASE_SPEED * WAVE_BALANCE.BOSS_SPEED_MULT * spdGlobal
            }));
            Renderer.renderMonsterLayer();
            return;
        }

        const hpMult = entry.isElite ? WAVE_BALANCE.ELITE_HP_MULT : 1.0;
        const speedMult = cfg.speedMult * (entry.isElite ? WAVE_BALANCE.ELITE_SPEED_MULT : 1.0);
        const maxHp = Math.max(10, Math.round(cfg.baseHp * entry.hpScale * hpMult * hpGlobal));
        const reward = Math.max(1, Math.round((cfg.baseReward + entry.rewardBonus) * (entry.isElite ? WAVE_BALANCE.ELITE_REWARD_MULT : 1.0)));

        st.monsters.push(makeMonsterRecord({
            id: st.monsterIdCounter++, sessionId: st.sessionId, typeKey: entry.typeKey, name: entry.isElite ? `菁英${cfg.name}` : cfg.name, icon: cfg.icon,
            weakness: cfg.weakness, hp: maxHp, maxHp, armor: entry.armor || 0, isElite: Boolean(entry.isElite), isBoss: false, isSplitChild: false,
            splitsOnDeath: Boolean(cfg.splitsOnDeath), baseDamage: 1, reward, wpIndex: 0, gridX: wp0.x, gridY: wp0.y,
            pixelX: startPos.left, pixelY: startPos.top, visualOffsetX: 0, visualOffsetY: 0,
            baseSpeed: CONFIG.MONSTER_BASE_SPEED * speedMult * spdGlobal
        }));
        Renderer.renderMonsterLayer();
    }

    function spawnSplitMiniSlimes(parent) {
        const st = G.state;
        if (!parent || parent.sessionId !== st.sessionId || !G.callbacks.isGameplayActive()) return;
        const Renderer = global.GameRenderer, wps = G.map.waypoints;
        const childMaxHp = Math.max(1, Math.round(parent.maxHp * CONFIG.SLIME_SPLIT_HP_RATIO));
        const wpA = wps[Math.min(parent.wpIndex, wps.length - 1)], wpB = wps[Math.min(parent.wpIndex + 1, wps.length - 1)];
        const segDx = wpB.x - wpA.x, segDy = wpB.y - wpA.y, segLen = Math.hypot(segDx, segDy) || 1;
        const ux = segDx / segLen, uy = segDy / segLen, proj = (parent.gridX - wpA.x) * ux + (parent.gridY - wpA.y) * uy;

        [{ along: -0.22, vx: -5, vy: -4 }, { along: +0.22, vx: +5, vy: +4 }].forEach(off => {
            const cProj = Math.max(0, Math.min(segLen, proj + off.along)), gx = wpA.x + ux * cProj, gy = wpA.y + uy * cProj;
            const center = Renderer.getCellCenter(gx, gy);
            st.monsters.push(makeMonsterRecord({
                id: st.monsterIdCounter++, sessionId: st.sessionId, typeKey: parent.typeKey, name: '迷你史萊姆', icon: '🟢',
                weakness: parent.weakness, hp: childMaxHp, maxHp: childMaxHp, armor: 0, isElite: false, isBoss: false, isSplitChild: true,
                splitsOnDeath: false, baseDamage: 1, reward: 0, wpIndex: parent.wpIndex, gridX: gx, gridY: gy,
                pixelX: center.left + off.vx, pixelY: center.top + off.vy, visualOffsetX: off.vx, visualOffsetY: off.vy, baseSpeed: parent.baseSpeed * 1.12
            }));
        });
    }

    // ==================== 索敵、護甲傷公式與戰鬥結算 ====================
    function getMonsterProgress(monster) {
        const wps = G.map.waypoints, wpIdx = Math.min(monster.wpIndex, wps.length - 1), wp = wps[wpIdx];
        return G.map.waypointCumDist[wpIdx] + Math.hypot(monster.gridX - wp.x, monster.gridY - wp.y);
    }

    function getMonsterEffectiveArmor(monster, armorPierce = 0) {
        const shredMult = monster.armorShredTimer > 0 ? (1 - (monster.armorShredRate || CONFIG.FIRE_SHRED_RATE)) : 1.0;
        return Math.max(0, (monster.armor || 0) * shredMult * (1 - Math.max(0, Math.min(1, armorPierce))));
    }

    function isMonsterPreferred(cand, best, mode) {
        if (!best) return true;
        if (mode === 'armor' && Math.abs((cand.armor || 0) - (best.armor || 0)) > 0.01) return (cand.armor || 0) > (best.armor || 0);
        if (mode === 'lowhp' && cand.hp !== best.hp) return cand.hp < best.hp;
        return getMonsterProgress(cand) > getMonsterProgress(best);
    }

    function findBestTargetInRange(towerIndex, towerObj, excludeIds = null) {
        const monsters = G.state.monsters;
        if (monsters.length === 0) return null;
        const coords = indexToCoords(towerIndex), towerPos = global.GameRenderer.getCellCenter(coords.x, coords.y);
        const rangePx = getTowerRangePx(towerObj, towerIndex), mode = towerObj.targetMode || 'first';
        let bestTarget = null;
        for (let i = 0; i < monsters.length; i++) {
            const m = monsters[i];
            if (m.hp <= 0 || (excludeIds && excludeIds.has(m.id))) continue;
            if (Math.hypot(m.pixelX - towerPos.left, m.pixelY - towerPos.top) <= rangePx && isMonsterPreferred(m, bestTarget, mode)) bestTarget = m;
        }
        return bestTarget;
    }

    function calculateDamage(towerObj, monster, options = {}) {
        const dmgRow = TIER_DAMAGE_TABLE[towerObj.type], baseDmg = (dmgRow && dmgRow[towerObj.tier]) || 10;
        const thornMult = hasBlessing('thorn_bulwark') ? (1 + CONFIG.BLESSING_THORN_GLOBAL_DMG) : 1.0;
        const cfg = ELEMENT_CONFIG[towerObj.type], isWeakness = (!cfg || !cfg.isHybrid) && (towerObj.type === monster.weakness);

        let vulnMult = 1.0 + ((monster.rootTimer || 0) > 0 && (monster.rootVulnRate || 0) > 0 ? monster.rootVulnRate : 0);
        if (hasBlessing('thorn_bulwark')) {
            const treeWp = G.map.waypoints[G.map.waypoints.length - 1];
            if (Math.hypot((Number.isFinite(monster.gridX) ? monster.gridX : 0) - treeWp.x, (Number.isFinite(monster.gridY) ? monster.gridY : 0) - treeWp.y) <= CONFIG.BLESSING_THORN_TREE_RADIUS_CELLS) {
                vulnMult += CONFIG.BLESSING_THORN_NEAR_TREE_DMG;
            }
        }
        const raw = baseDmg * thornMult * (options.damageScale ?? 1.0) * (options.terrainMult ?? 1.0) * (options.extraMult ?? 1.0) * (isWeakness ? CONFIG.WEAKNESS_MULTIPLIER : 1.0) * vulnMult;
        const effArmor = getMonsterEffectiveArmor(monster, options.armorPierce || 0);
        return { damage: Math.max(1, Math.round(raw * (CONFIG.ARMOR_HYPERBOLIC_K / (CONFIG.ARMOR_HYPERBOLIC_K + effArmor)))), isWeakness };
    }

    function applySlowToMonster(monster, slowRate, durationMs) {
        if (!monster || monster.hp <= 0) return;
        if (slowRate >= (monster.slowTimer > 0 ? (monster.slowRate || CONFIG.ICE_SLOW_RATE) : 0)) {
            monster.slowRate = slowRate; monster.slowTimer = Math.max(monster.slowTimer, durationMs);
        }
    }

    function applyArmorShred(monster, shredRate = CONFIG.FIRE_SHRED_RATE, durationMs = CONFIG.FIRE_SHRED_DURATION_MS) {
        if (!monster || monster.hp <= 0) return;
        if (shredRate >= (monster.armorShredTimer > 0 ? (monster.armorShredRate || 0) : 0)) {
            monster.armorShredRate = shredRate; monster.armorShredTimer = Math.max(monster.armorShredTimer, durationMs);
        }
    }

    function computeKillDewGain(monster) {
        if (!monster || monster.isSplitChild) return 0;
        let dew = monster.isBoss ? CONFIG.DEW_GAIN_BOSS : (SPECIAL_MECHANIC_MONSTERS.has(monster.typeKey) ? CONFIG.DEW_GAIN_SPECIAL : CONFIG.DEW_GAIN_NORMAL);
        if (hasBlessing('life_nectar')) dew = Math.round(dew * (1 + CONFIG.BLESSING_DEW_GAIN_BONUS));
        return dew;
    }

    function triggerEmberExplosion(originX, originY, killerTowerObj, killingDamage) {
        const Renderer = global.GameRenderer;
        const emberDmg = Math.max(1, Math.round(killingDamage * CONFIG.BLESSING_EMBER_DAMAGE_RATIO));
        const emberRadiusPx = CONFIG.BLESSING_EMBER_RADIUS_CELLS * G.boardMetrics.step;
        Renderer.emitRingFX(originX, originY, emberRadiusPx, '#f97316', 0.28, 260);
        Renderer.emitParticleBurst(originX, originY, '#fb923c', 10, 95);

        const victims = G.state.monsters.filter(m => m.hp > 0 && Math.hypot(m.pixelX - originX, m.pixelY - originY) <= emberRadiusPx);
        for (let i = 0; i < victims.length; i++) {
            const v = victims[i];
            if (v.hp <= 0) continue;
            const hpBefore = v.hp;
            v.hp = Math.max(0, hpBefore - emberDmg);
            recordTowerDamage(killerTowerObj, Math.min(hpBefore, emberDmg));
            Renderer.spawnDamageNumber(emberDmg, false, v.pixelX, v.pixelY, '🔥');
            if (v.hp <= 0) handleMonsterKilled(v, killerTowerObj, emberDmg, { isEmberSplash: true });
        }
    }

    function handleMonsterKilled(monster, killerTowerObj, killingDamage, options = {}) {
        const st = G.state, mapSpec = getCurrentMapSpec();
        const killGold = monster.reward > 0 ? Math.max(1, Math.round(monster.reward * (mapSpec.killGoldMult || 1.0))) : 0;
        st.currentGold += killGold; st.totalGoldEarned += killGold; st.killsCount++;
        const dewGain = computeKillDewGain(monster);
        if (dewGain > 0) st.dewEnergy = Math.min(CONFIG.DEW_MAX, st.dewEnergy + dewGain);

        const deadIdx = st.monsters.findIndex(m => m.id === monster.id);
        if (deadIdx !== -1) st.monsters.splice(deadIdx, 1);
        global.GameRenderer.removeMonsterDom(monster.id);
        SoundEngine.playKill();

        if (monster.splitsOnDeath) {
            spawnSplitMiniSlimes(monster);
            G.dom.msgText.innerText = `🟢 【${monster.name}】分裂成 ${CONFIG.SLIME_SPLIT_COUNT} 隻迷你史萊姆！`;
        } else if (killGold > 0 && !options.isEmberSplash) {
            G.dom.msgText.innerText = `💥 擊殺【${monster.name}】！獲得 +${killGold} 💰${dewGain > 0 ? `、+${dewGain} 💧` : ''}！`;
        }
        if (!options.isEmberSplash && hasBlessing('searing_embers') && killerTowerObj && FIRE_LINEAGE_TYPES.includes(killerTowerObj.type) && killingDamage > 0) {
            triggerEmberExplosion(monster.pixelX, monster.pixelY, killerTowerObj, killingDamage);
        }
        G.callbacks.updateHUD();
    }

    function applyHitToMonster(towerIndex, towerObj, monster, options = {}) {
        if (!monster || monster.hp <= 0) return null;
        const result = calculateDamage(towerObj, monster, {
            damageScale: options.damageScale ?? 1.0,
            terrainMult: options.terrainMult ?? getTowerTerrainDamageMult(towerIndex),
            extraMult: options.extraMult ?? 1.0,
            armorPierce: options.armorPierce ?? 0
        });
        const hpBefore = monster.hp;
        monster.hp = Math.max(0, hpBefore - result.damage);
        recordTowerDamage(towerObj, Math.min(hpBefore, result.damage));

        if (towerObj.type === 'fire' && options.applyShred !== false) {
            applyArmorShred(monster, CONFIG.FIRE_SHRED_RATE, CONFIG.FIRE_SHRED_DURATION_MS);
        } else if (towerObj.type === 'ice' && options.applySlow !== false) {
            const isLv3 = towerObj.tier >= CONFIG.MAX_TIER;
            const iceSlow = getIceLineageSlowParams('ice', isLv3 ? CONFIG.ICE_LV3_SLOW_RATE : CONFIG.ICE_SLOW_RATE, isLv3 ? CONFIG.ICE_LV3_SLOW_DURATION_MS : CONFIG.ICE_SLOW_DURATION_MS);
            applySlowToMonster(monster, iceSlow.rate, iceSlow.durationMs);
        }
        global.GameRenderer.spawnDamageNumber(result.damage, result.isWeakness, monster.pixelX, monster.pixelY);
        if (monster.hp <= 0) handleMonsterKilled(monster, towerObj, result.damage);
        return result;
    }

    function applySplashDamage(towerIndex, towerObj, targetPos, radiusPx, excludeId, hitOptions, slowParams = null) {
        const targets = G.state.monsters.filter(m =>
            m.id !== excludeId && m.hp > 0 && Math.hypot(m.pixelX - targetPos.left, m.pixelY - targetPos.top) <= radiusPx
        );
        for (let i = 0; i < targets.length; i++) {
            applyHitToMonster(towerIndex, towerObj, targets[i], hitOptions);
            if (slowParams && slowParams.rate > 0 && targets[i].hp > 0) applySlowToMonster(targets[i], slowParams.rate, slowParams.durationMs);
        }
    }

    function fireThunderBolt(towerIndex, towerObj) {
        const st = G.state;
        if (!G.callbacks.isGameplayActive() || st.monsters.length === 0 || st.board[towerIndex] !== towerObj) return false;
        const target = findBestTargetInRange(towerIndex, towerObj);
        if (!target) return false;
        const Renderer = global.GameRenderer, coords = indexToCoords(towerIndex);
        const towerPos = Renderer.getCellCenter(coords.x, coords.y), targetPos = { left: target.pixelX, top: target.pixelY };
        Renderer.updateTowerAimVisual(towerIndex, towerObj, towerPos, targetPos);
        applyHitToMonster(towerIndex, towerObj, target);
        Renderer.emitCanvasAttackFX('thunder', towerPos, targetPos, { isLv3: towerObj.tier >= CONFIG.MAX_TIER });
        SoundEngine.playTowerShot('thunder');
        return true;
    }

    function performTowerAttack(towerIndex, towerObj) {
        const Renderer = global.GameRenderer, st = G.state, coords = indexToCoords(towerIndex);
        const towerPos = Renderer.getCellCenter(coords.x, coords.y), isLv3 = towerObj.tier >= CONFIG.MAX_TIER;

        if (towerObj.type === 'thunder') {
            const boltCount = (isLv3 ? CONFIG.THUNDER_LV3_BOLT_COUNT : CONFIG.THUNDER_BOLT_COUNT) + getThunderChainBonus('thunder');
            if (!fireThunderBolt(towerIndex, towerObj)) return false;
            for (let b = 1; b < boltCount; b++) {
                st.pendingBolts.push({ sessionId: st.sessionId, towerIndex, towerObj, remainingMs: CONFIG.THUNDER_BOLT_DELAY_MS * b });
            }
            return true;
        }

        const target = findBestTargetInRange(towerIndex, towerObj);
        if (!target) return false;
        const targetPos = { left: target.pixelX, top: target.pixelY };
        Renderer.updateTowerAimVisual(towerIndex, towerObj, towerPos, targetPos);

        if (towerObj.type === 'steam') {
            const splashRadiusPx = CONFIG.STEAM_SPLASH_RADIUS_CELLS * G.boardMetrics.step;
            const steamSlow = getIceLineageSlowParams('steam', 0, 0);
            applyHitToMonster(towerIndex, towerObj, target, { armorPierce: CONFIG.STEAM_ARMOR_PIERCE });
            if (steamSlow.rate > 0 && target.hp > 0) applySlowToMonster(target, steamSlow.rate, steamSlow.durationMs);
            applySplashDamage(towerIndex, towerObj, targetPos, splashRadiusPx, target.id, { damageScale: CONFIG.STEAM_SPLASH_RATIO, armorPierce: CONFIG.STEAM_ARMOR_PIERCE }, steamSlow);
            Renderer.emitCanvasAttackFX('steam', towerPos, targetPos, { splashRadiusPx });
        } else if (towerObj.type === 'magnet') {
            const frostRadiusPx = CONFIG.MAGNET_AOE_RADIUS_CELLS * G.boardMetrics.step, chainRadiusPx = CONFIG.MAGNET_CHAIN_RADIUS_CELLS * G.boardMetrics.step;
            const magSlow = getIceLineageSlowParams('magnet', CONFIG.MAGNET_SLOW_RATE, CONFIG.MAGNET_SLOW_DURATION_MS);
            const chainCount = CONFIG.MAGNET_CHAIN_EXTRA_TARGETS + getThunderChainBonus('magnet');
            applyHitToMonster(towerIndex, towerObj, target);
            if (target.hp > 0) applySlowToMonster(target, magSlow.rate, magSlow.durationMs);
            for (let i = 0; i < st.monsters.length; i++) {
                const m = st.monsters[i];
                if (m.hp > 0 && Math.hypot(m.pixelX - targetPos.left, m.pixelY - targetPos.top) <= frostRadiusPx) applySlowToMonster(m, magSlow.rate, magSlow.durationMs);
            }
            Renderer.emitCanvasAttackFX('magnet-arc', towerPos, targetPos, { frostRadiusPx });

            const visited = new Set([target.id]);
            let prevPos = targetPos;
            for (let bounce = 0; bounce < chainCount; bounce++) {
                let bestNext = null, bestDist = Infinity;
                for (let i = 0; i < st.monsters.length; i++) {
                    const cand = st.monsters[i];
                    if (cand.hp <= 0 || visited.has(cand.id)) continue;
                    const d = Math.hypot(cand.pixelX - prevPos.left, cand.pixelY - prevPos.top);
                    if (d <= chainRadiusPx && d < bestDist) { bestDist = d; bestNext = cand; }
                }
                if (!bestNext) break;
                visited.add(bestNext.id);
                const nextPos = { left: bestNext.pixelX, top: bestNext.pixelY };
                applyHitToMonster(towerIndex, towerObj, bestNext, { damageScale: CONFIG.MAGNET_CHAIN_DAMAGE_RATIO });
                if (bestNext.hp > 0) applySlowToMonster(bestNext, magSlow.rate, magSlow.durationMs);
                Renderer.emitCanvasAttackFX('magnet-arc', prevPos, nextPos);
                prevPos = nextPos;
            }
        } else if (towerObj.type === 'plasma') {
            towerObj.focusStacks = towerObj.focusTargetId === target.id ? Math.min(CONFIG.PLASMA_MAX_STACKS, (towerObj.focusStacks || 0) + 1) : 0;
            towerObj.focusTargetId = target.id;
            applyHitToMonster(towerIndex, towerObj, target, { extraMult: 1 + towerObj.focusStacks * CONFIG.PLASMA_STACK_BONUS });
            Renderer.emitCanvasAttackFX('plasma', towerPos, targetPos, { stacks: towerObj.focusStacks });
            if (st.selectedIndex === towerIndex) G.callbacks.updateTowerInspector();
        } else if (towerObj.type === 'fire' && isLv3) {
            const splashRadiusPx = CONFIG.FIRE_LV3_SPLASH_RADIUS_CELLS * G.boardMetrics.step;
            applyHitToMonster(towerIndex, towerObj, target);
            applySplashDamage(towerIndex, towerObj, targetPos, splashRadiusPx, target.id, { damageScale: CONFIG.FIRE_LV3_SPLASH_RATIO });
            Renderer.emitCanvasAttackFX('fire', towerPos, targetPos, { splashRadiusPx });
        } else if (towerObj.type === 'ice' && isLv3) {
            const frostRadiusPx = CONFIG.ICE_LV3_AOE_RADIUS_CELLS * G.boardMetrics.step;
            const iceAoeSlow = getIceLineageSlowParams('ice', CONFIG.ICE_LV3_AOE_SLOW_RATE, CONFIG.ICE_LV3_AOE_SLOW_DURATION_MS);
            applyHitToMonster(towerIndex, towerObj, target);
            for (let i = 0; i < st.monsters.length; i++) {
                const m = st.monsters[i];
                if (m.id !== target.id && m.hp > 0 && Math.hypot(m.pixelX - targetPos.left, m.pixelY - targetPos.top) <= frostRadiusPx) applySlowToMonster(m, iceAoeSlow.rate, iceAoeSlow.durationMs);
            }
            Renderer.emitCanvasAttackFX('ice', towerPos, targetPos, { frostRadiusPx });
        } else {
            applyHitToMonster(towerIndex, towerObj, target);
            Renderer.emitCanvasAttackFX(towerObj.type, towerPos, targetPos);
        }

        SoundEngine.playTowerShot(towerObj.type);
        return true;
    }

    function updateTowersCombat(dtMs) {
        if (!G.callbacks.isGameplayActive()) return;
        const st = G.state;
        let didCombatAct = false;

        if (st.pendingBolts.length > 0) {
            const prevQueue = st.pendingBolts, remainingQueue = [];
            st.pendingBolts = [];
            for (let i = 0; i < prevQueue.length; i++) {
                const bolt = prevQueue[i];
                if (bolt.sessionId !== st.sessionId || !G.callbacks.isGameplayActive()) continue;
                bolt.remainingMs -= dtMs;
                if (bolt.remainingMs <= 0) { if (fireThunderBolt(bolt.towerIndex, bolt.towerObj)) didCombatAct = true; }
                else remainingQueue.push(bolt);
            }
            st.pendingBolts = remainingQueue.concat(st.pendingBolts);
        }

        if (st.monsters.length > 0 || st.waveState === 'SPAWNING') {
            for (let idx = 0; idx < st.board.length; idx++) {
                const towerObj = st.board[idx];
                if (towerObj === null) continue;
                if (!Number.isFinite(towerObj.accMs)) towerObj.accMs = 0;
                const intervalMs = getTowerAttackInterval(towerObj, idx);
                towerObj.accMs = Math.min(intervalMs, towerObj.accMs + dtMs);
                if (towerObj.accMs >= intervalMs && st.monsters.length > 0 && performTowerAttack(idx, towerObj)) {
                    towerObj.accMs -= intervalMs;
                    didCombatAct = true;
                }
            }
        }
        if (didCombatAct) global.GameRenderer.renderMonsterLayer();
    }

    function updateMonsters(dtMs) {
        const dtSec = dtMs / 1000, st = G.state, wps = G.map.waypoints, Renderer = global.GameRenderer;
        for (let i = st.monsters.length - 1; i >= 0; i--) {
            const m = st.monsters[i];
            if (m.slowTimer > 0 && (m.slowTimer = Math.max(0, m.slowTimer - dtMs)) === 0) m.slowRate = 0;
            if (m.armorShredTimer > 0 && (m.armorShredTimer = Math.max(0, m.armorShredTimer - dtMs)) === 0) m.armorShredRate = 0;
            if ((m.rootTimer || 0) > 0 && (m.rootTimer = Math.max(0, m.rootTimer - dtMs)) === 0) m.rootVulnRate = 0;

            const slowMult = (m.rootTimer || 0) > 0 ? 0 : (1 - (m.slowTimer > 0 ? (m.slowRate || CONFIG.ICE_SLOW_RATE) : 0));
            const safeSpeed = clampNumber(m.baseSpeed, 0.2, CONFIG.MONSTER_BASE_SPEED * 10, CONFIG.MONSTER_BASE_SPEED);
            let step = safeSpeed * slowMult * dtSec, reachedEnd = false;

            while (step > 0) {
                const targetWp = wps[m.wpIndex + 1];
                if (!targetWp) { reachedEnd = true; break; }
                const dx = targetWp.x - m.gridX, dy = targetWp.y - m.gridY, dist = Math.hypot(dx, dy);
                if (dist <= step) {
                    m.gridX = targetWp.x; m.gridY = targetWp.y; m.wpIndex++; step -= dist;
                    if (m.wpIndex >= wps.length - 1) { reachedEnd = true; break; }
                } else {
                    m.gridX += (dx / dist) * step; m.gridY += (dy / dist) * step; step = 0;
                }
            }

            if (reachedEnd) {
                const leakDmg = m.baseDamage || 1;
                st.lastBreakerName = m.name || '';
                st.baseHp = Math.max(0, st.baseHp - leakDmg);
                G.dom.msgText.innerText = m.isBoss ? `💥 【${m.name}】突破防線！🌳 世界樹遭受重創 -${leakDmg} 生命！` : `🚨 怪物【${m.name}】突破防線！🌳 世界樹受損 -${leakDmg} 生命！`;
                st.monsters.splice(i, 1);
                Renderer.removeMonsterDom(m.id);
                Renderer.triggerWorldTreeShake();
                SoundEngine.playOutcome('treeHit');
                G.callbacks.updateHUD();
                if (st.baseHp <= 0) { G.callbacks.triggerGameOver(); return; }
                continue;
            }
            const pos = Renderer.getCellCenter(m.gridX, m.gridY);
            m.pixelX = pos.left + (m.visualOffsetX || 0); m.pixelY = pos.top + (m.visualOffsetY || 0);
        }
        Renderer.renderMonsterLayer();
    }

    global.GameCombat = {
        bind, getCurrentMapSpec, applyMapConfig, getTerrainAt, hasBlessing, getIceLineageSlowParams, getThunderChainBonus,
        getTowerEffectiveRangeCells, getTowerRangePx, getTowerAttackInterval, getTowerTerrainDamageMult, createTowerObj,
        recordTowerDamage, getFusionResult, executeTowerFusion, pickSmartSpawnIndex, getTowerSellRefund, getTowerInspectorStats,
        isBossWaveNumber, buildWaveQueue, spawnMonsterFromEntry, spawnSplitMiniSlimes, getMonsterProgress, getMonsterEffectiveArmor,
        isMonsterPreferred, findBestTargetInRange, calculateDamage, applySlowToMonster, applyArmorShred, computeKillDewGain,
        triggerEmberExplosion, handleMonsterKilled, applyHitToMonster, fireThunderBolt, performTowerAttack, updateTowersCombat, updateMonsters
    };
})(window);
