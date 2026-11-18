/**
 * ============================================================================
 * 【檔案名稱】：modules/towers/tower_attack_system.js
 * 【負責功能】：防禦塔索敵優先級篩選（只鎖定射程內 isTargetable === true 之活體）、
 *               獨立冷卻計時、6 大攻擊樣式標籤（attackStyle）驅動開火與雙曲線護甲／弱點相剋傷害結算。
 * 【讀取資料】：讀取 modules/towers/tower_data.js、terrain_system.js 與 tree_system.js。
 * 【常見修改入口】：
 *   1. 修改索敵篩選與優先級比較邏輯：修改 findBestTargetInRange()、isMonsterPreferred()。
 *   2. 新增或調整攻擊樣式標籤行為：修改 ATTACK_STYLE_HANDLERS 內對應的處理函式。
 * ============================================================================
 */
(function (global) {
    'use strict';

    const GameApp = global.GameApp = global.GameApp || {};
    const CONFIG = GameApp.config || {};
    const { clampNumber, indexToCoords } = GameApp.helpers || {};

    let G = null;
    function bind(ctx) { G = ctx; }

    function getTowersData() {
        return (GameApp.data && GameApp.data.towers) || {};
    }

    function getTowerCfg(type) {
        const dict = getTowersData().TOWERS || {};
        return dict[type] || null;
    }

    function getMaxTier() {
        return (GameApp.data && GameApp.data.evolutions && GameApp.data.evolutions.MAX_TIER) || 3;
    }

    function getTowerEffectiveRangeCells(index, towerObj) {
        const cfg = getTowerCfg(towerObj.type);
        const baseRange = clampNumber(cfg ? cfg.range : 2.0, 0.5, 15.0, 2.0);
        const TerrainSys = GameApp.systems && GameApp.systems.terrain;
        const rangeMult = (TerrainSys && index !== null && index !== undefined)
            ? TerrainSys.getTerrainBonusesAt(index).rangeMult
            : 1.0;
        return baseRange * rangeMult;
    }

    function getTowerRangePx(towerObj, index = null) {
        const rangeCells = (index !== null && index !== undefined)
            ? getTowerEffectiveRangeCells(index, towerObj)
            : clampNumber(getTowerCfg(towerObj.type) && getTowerCfg(towerObj.type).range, 0.5, 15.0, 2.0);
        return rangeCells * G.boardMetrics.step;
    }

    function getTowerAttackInterval(towerOrType, index = null) {
        const type = typeof towerOrType === 'string' ? towerOrType : towerOrType.type;
        const cfg = getTowerCfg(type);
        const baseInterval = (cfg && cfg.attackIntervalMs) || CONFIG.ATTACK_INTERVAL || 1000;
        let speedMult = 1.0;

        const TerrainSys = GameApp.systems && GameApp.systems.terrain;
        if (TerrainSys && index !== null && index !== undefined) {
            speedMult *= TerrainSys.getTerrainBonusesAt(index).attackSpeedMult;
        }

        const TreeSys = GameApp.systems && GameApp.systems.tree;
        if (TreeSys) {
            speedMult *= TreeSys.getTowerBlessingSpeedMult(type);
        }

        if (G && G.state && G.state.frenzyActiveMs > 0) {
            const treeData = (GameApp.data && GameApp.data.tree) || {};
            const frenzyBonus = (treeData.ACTIVE_SKILLS && treeData.ACTIVE_SKILLS.frenzy && treeData.ACTIVE_SKILLS.frenzy.speedBonus)
                || CONFIG.SKILL_FRENZY_SPEED_BONUS || 0.35;
            speedMult *= (1 + frenzyBonus);
        }

        return Math.max(100, Math.round(baseInterval / Math.max(0.1, speedMult)));
    }

    function createTowerObj(type, tier, investedGold, initialAccMs = null, options = {}) {
        const st = G.state;
        const accMs = initialAccMs !== null ? initialAccMs
            : (st.board.some(t => t && t.type === type) ? -(((st.towerPhaseSeq++ % 3) + 1) * 130) : 0);
        return {
            uid: options.uid || st.towerUidCounter++,
            type,
            tier,
            accMs,
            investedGold,
            targetMode: options.targetMode || 'first',
            totalDamage: Number.isFinite(options.totalDamage) ? options.totalDamage : 0,
            aimAngleDeg: Number.isFinite(options.aimAngleDeg) ? options.aimAngleDeg : 0,
            focusTargetId: null,
            focusStacks: 0
        };
    }

    function recordTowerDamage(towerObj, damageAmount) {
        if (!towerObj || !Number.isFinite(damageAmount) || damageAmount <= 0) return;
        towerObj.totalDamage = (towerObj.totalDamage || 0) + damageAmount;
        G.state.totalTeamDamage += damageAmount;
        const cfg = getTowerCfg(towerObj.type);
        if (!G.state.peakTowerSnapshot || towerObj.totalDamage >= G.state.peakTowerSnapshot.totalDamage) {
            G.state.peakTowerSnapshot = {
                uid: towerObj.uid,
                type: towerObj.type,
                tier: towerObj.tier,
                name: cfg ? cfg.name : towerObj.type,
                icon: cfg ? cfg.icon : '',
                totalDamage: towerObj.totalDamage
            };
        }
    }

    function getTowerInspectorStats(index, towerObj) {
        const towersData = getTowersData();
        const cfg = getTowerCfg(towerObj.type) || {};
        const dmgRow = (towersData.TIER_DAMAGE_TABLE && towersData.TIER_DAMAGE_TABLE[towerObj.type]) || cfg.tierDamage;
        const baseDmg = (dmgRow && dmgRow[towerObj.tier]) || 10;
        const intervalSec = Math.max(0.1, getTowerAttackInterval(towerObj, index) / 1000);
        const fxParams = cfg.effectParams || {};
        const TreeSys = GameApp.systems && GameApp.systems.tree;
        const TerrainSys = GameApp.systems && GameApp.systems.terrain;

        let perAttackFactor = 1.0;
        if (cfg.attackStyle === 'chain_lightning') {
            const baseBolts = towerObj.tier >= getMaxTier() ? (fxParams.lv3BoltCount || 3) : (fxParams.boltCount || 2);
            const extraBolts = TreeSys ? TreeSys.getThunderChainBonus(towerObj.type) : 0;
            perAttackFactor = baseBolts + extraBolts;
        } else if (cfg.attackStyle === 'pierce_beam') {
            perAttackFactor = 1 + (towerObj.focusStacks || 0) * (fxParams.stackBonus || 0.15);
        }

        const terrainBonuses = TerrainSys ? TerrainSys.getTerrainBonusesAt(index) : { damageMult: 1.0, terrainType: null };
        const globalBlessMult = TreeSys ? TreeSys.getGlobalBlessingDamageMult() : 1.0;
        const hitDmg = baseDmg * terrainBonuses.damageMult * globalBlessMult * perAttackFactor;

        return {
            dps: Math.round(hitDmg / intervalSec),
            rangeStr: Number(getTowerEffectiveRangeCells(index, towerObj).toFixed(2)).toString(),
            terrainType: terrainBonuses.terrainType
        };
    }

    /**
     * 智慧尋找最佳空地（供快捷鍵 1/2/3 或指定建造格使用）
     */
    function pickSmartSpawnIndex(type = null) {
        const st = G.state, map = G.map;
        const boardSize = CONFIG.BOARD_SIZE || 150;
        const TerrainSys = GameApp.systems && GameApp.systems.terrain;
        const canPlace = (idx) => (TerrainSys ? TerrainSys.canBuildAt(idx) : !map.pathCellIndices.has(idx)) && st.board[idx] === null;

        if (st.buildTargetIndex !== null && st.buildTargetIndex >= 0 && st.buildTargetIndex < boardSize && canPlace(st.buildTargetIndex)) {
            return { index: st.buildTargetIndex, mode: 'targeted' };
        }
        const pathCoords = Array.from(map.pathCellIndices).map(indexToCoords);
        const towerProbe = { type: type || 'fire' };
        let bestCoverage = -1, bestPathDist = Infinity, bestPool = [];
        for (let idx = 0; idx < boardSize; idx++) {
            if (!canPlace(idx)) continue;
            const c = indexToCoords(idx);
            const rangeCells = getTowerEffectiveRangeCells(idx, towerProbe);
            let coverage = 0;
            for (let p = 0; p < pathCoords.length; p++) {
                if (Math.hypot(c.x - pathCoords[p].x, c.y - pathCoords[p].y) <= rangeCells + 0.001) coverage++;
            }
            const dist = map.cellPathDist[idx];
            if (coverage > bestCoverage || (coverage === bestCoverage && dist < bestPathDist - 1e-4)) {
                bestCoverage = coverage;
                bestPathDist = dist;
                bestPool = [idx];
            } else if (coverage === bestCoverage && Math.abs(dist - bestPathDist) <= 1e-4) {
                bestPool.push(idx);
            }
        }
        if (bestPool.length === 0) return null;
        return { index: bestPool[Math.floor(Math.random() * bestPool.length)], mode: bestCoverage > 0 ? 'near-path' : 'fallback' };
    }

    // ==================== 索敵優先級與標籤驅動傷害結算 ====================
    function isMonsterPreferred(cand, best, mode) {
        if (!best) return true;
        if (mode === 'armor' && Math.abs((cand.armor || 0) - (best.armor || 0)) > 0.01) return (cand.armor || 0) > (best.armor || 0);
        if (mode === 'lowhp' && cand.hp !== best.hp) return cand.hp < best.hp;
        const MonsterSys = GameApp.systems && GameApp.systems.monster;
        const pCand = MonsterSys ? MonsterSys.getMonsterProgress(cand) : 0;
        const pBest = MonsterSys ? MonsterSys.getMonsterProgress(best) : 0;
        return pCand > pBest;
    }

    /**
     * 篩選射程內且 isTargetable !== false 的活體怪物（禁止寫死任何怪物名稱）
     */
    function findBestTargetInRange(towerIndex, towerObj, excludeIds = null) {
        const monsters = G.state.monsters;
        if (monsters.length === 0) return null;
        const coords = indexToCoords(towerIndex), towerPos = GameApp.renderer.getCellCenter(coords.x, coords.y);
        const rangePx = getTowerRangePx(towerObj, towerIndex), mode = towerObj.targetMode || 'first';
        let bestTarget = null;
        for (let i = 0; i < monsters.length; i++) {
            const m = monsters[i];
            if (m.hp <= 0 || m.isTargetable === false || (excludeIds && excludeIds.has(m.id))) continue;
            if (Math.hypot(m.pixelX - towerPos.left, m.pixelY - towerPos.top) <= rangePx && isMonsterPreferred(m, bestTarget, mode)) {
                bestTarget = m;
            }
        }
        return bestTarget;
    }

    function calculateDamage(towerObj, monster, options = {}) {
        const towersData = getTowersData();
        const cfg = getTowerCfg(towerObj.type) || {};
        const dmgRow = (towersData.TIER_DAMAGE_TABLE && towersData.TIER_DAMAGE_TABLE[towerObj.type]) || cfg.tierDamage;
        const baseDmg = (dmgRow && dmgRow[towerObj.tier]) || 10;

        const TreeSys = GameApp.systems && GameApp.systems.tree;
        const MonsterSys = GameApp.systems && GameApp.systems.monster;

        const thornMult = TreeSys ? TreeSys.getGlobalBlessingDamageMult() : 1.0;
        const towerElementTag = cfg.elementTag || towerObj.type;
        const isWeakness = Boolean((!cfg.isHybrid) && monster.weakness && towerElementTag === monster.weakness);

        let vulnMult = 1.0 + ((monster.rootTimer || 0) > 0 && (monster.rootVulnRate || 0) > 0 ? monster.rootVulnRate : 0);
        if (TreeSys) {
            vulnMult += TreeSys.getNearTreeVulnerabilityBonus(monster);
        }

        const weakMult = isWeakness ? (towersData.COMBAT_CONSTANTS ? towersData.COMBAT_CONSTANTS.WEAKNESS_MULTIPLIER : 2.0) : 1.0;
        const raw = baseDmg * thornMult * (options.damageScale ?? 1.0) * (options.terrainMult ?? 1.0) * (options.extraMult ?? 1.0) * weakMult * vulnMult;
        const effArmor = MonsterSys ? MonsterSys.getMonsterEffectiveArmor(monster, options.armorPierce || 0) : (monster.armor || 0);
        const kVal = (towersData.COMBAT_CONSTANTS && towersData.COMBAT_CONSTANTS.ARMOR_HYPERBOLIC_K) || 30;
        return {
            damage: Math.max(1, Math.round(raw * (kVal / (kVal + effArmor)))),
            isWeakness
        };
    }

    function applyHitToMonster(towerIndex, towerObj, monster, options = {}) {
        if (!monster || monster.hp <= 0 || monster.isTargetable === false) return null;
        const TerrainSys = GameApp.systems && GameApp.systems.terrain;
        const MonsterSys = GameApp.systems && GameApp.systems.monster;
        const TreeSys = GameApp.systems && GameApp.systems.tree;
        const cfg = getTowerCfg(towerObj.type) || {};
        const fxParams = cfg.effectParams || {};

        const terrainMult = options.terrainMult ?? (TerrainSys ? TerrainSys.getTowerTerrainDamageMult(towerIndex) : 1.0);
        const result = calculateDamage(towerObj, monster, {
            damageScale: options.damageScale ?? 1.0,
            terrainMult,
            extraMult: options.extraMult ?? 1.0,
            armorPierce: options.armorPierce ?? 0
        });

        const hpBefore = monster.hp;
        monster.hp = Math.max(0, hpBefore - result.damage);
        recordTowerDamage(towerObj, Math.min(hpBefore, result.damage));

        // 依 attackStyle 標籤自動套用異常狀態
        if (cfg.attackStyle === 'burst_armor_break' && options.applyShred !== false && MonsterSys) {
            MonsterSys.applyArmorShred(
                monster,
                fxParams.shredRate ?? CONFIG.FIRE_SHRED_RATE ?? 0.30,
                fxParams.shredDurationMs ?? CONFIG.FIRE_SHRED_DURATION_MS ?? 3000
            );
        } else if (cfg.attackStyle === 'slow_control' && options.applySlow !== false && MonsterSys) {
            const isLv3 = towerObj.tier >= getMaxTier();
            const baseRate = isLv3 ? (fxParams.lv3SlowRate ?? CONFIG.ICE_LV3_SLOW_RATE ?? 0.60) : (fxParams.slowRate ?? CONFIG.ICE_SLOW_RATE ?? 0.45);
            const baseDur = isLv3 ? (fxParams.lv3SlowDurationMs ?? CONFIG.ICE_LV3_SLOW_DURATION_MS ?? 2500) : (fxParams.slowDurationMs ?? CONFIG.ICE_SLOW_DURATION_MS ?? 2000);
            const slowSpec = TreeSys ? TreeSys.getIceLineageSlowParams(towerObj.type, baseRate, baseDur) : { rate: baseRate, durationMs: baseDur };
            MonsterSys.applySlowToMonster(monster, slowSpec.rate, slowSpec.durationMs);
        }

        GameApp.renderer.spawnDamageNumber(result.damage, result.isWeakness, monster.pixelX, monster.pixelY);
        if (monster.hp <= 0 && MonsterSys) {
            MonsterSys.handleMonsterKilled(monster, towerObj, result.damage);
        }
        return result;
    }

    function applySplashDamage(towerIndex, towerObj, targetPos, radiusPx, excludeId, hitOptions, slowParams = null) {
        const MonsterSys = GameApp.systems && GameApp.systems.monster;
        const targets = G.state.monsters.filter(m =>
            m.id !== excludeId && m.hp > 0 && m.isTargetable !== false && Math.hypot(m.pixelX - targetPos.left, m.pixelY - targetPos.top) <= radiusPx
        );
        for (let i = 0; i < targets.length; i++) {
            applyHitToMonster(towerIndex, towerObj, targets[i], hitOptions);
            if (slowParams && slowParams.rate > 0 && targets[i].hp > 0 && MonsterSys) {
                MonsterSys.applySlowToMonster(targets[i], slowParams.rate, slowParams.durationMs);
            }
        }
    }

    function fireLightningBolt(towerIndex, towerObj) {
        const st = G.state;
        if (!G.callbacks.isGameplayActive() || st.monsters.length === 0 || st.board[towerIndex] !== towerObj) return false;
        const target = findBestTargetInRange(towerIndex, towerObj);
        if (!target) return false;
        const Renderer = GameApp.renderer, coords = indexToCoords(towerIndex);
        const towerPos = Renderer.getCellCenter(coords.x, coords.y), targetPos = { left: target.pixelX, top: target.pixelY };
        Renderer.updateTowerAimVisual(towerIndex, towerObj, towerPos, targetPos);
        applyHitToMonster(towerIndex, towerObj, target);
        Renderer.emitCanvasAttackFX(towerObj.type, towerPos, targetPos, { isLv3: towerObj.tier >= getMaxTier() });
        GameApp.audio.playTowerShot(towerObj.type);
        return true;
    }

    /**
     * 六大攻擊樣式標籤處理器（100% 標籤驅動，未來新增角色只需指定 attackStyle 即可自動交戰）
     */
    const ATTACK_STYLE_HANDLERS = {
        burst_armor_break(towerIndex, towerObj, cfg, target, towerPos, targetPos, isLv3) {
            const fxParams = cfg.effectParams || {};
            if (isLv3) {
                const splashCells = fxParams.lv3SplashRadiusCells ?? CONFIG.FIRE_LV3_SPLASH_RADIUS_CELLS ?? 1.0;
                const splashRatio = fxParams.lv3SplashRatio ?? CONFIG.FIRE_LV3_SPLASH_RATIO ?? 0.35;
                const splashRadiusPx = splashCells * G.boardMetrics.step;
                applyHitToMonster(towerIndex, towerObj, target);
                applySplashDamage(towerIndex, towerObj, targetPos, splashRadiusPx, target.id, { damageScale: splashRatio });
                GameApp.renderer.emitCanvasAttackFX(towerObj.type, towerPos, targetPos, { splashRadiusPx });
            } else {
                applyHitToMonster(towerIndex, towerObj, target);
                GameApp.renderer.emitCanvasAttackFX(towerObj.type, towerPos, targetPos);
            }
        },

        slow_control(towerIndex, towerObj, cfg, target, towerPos, targetPos, isLv3) {
            const fxParams = cfg.effectParams || {};
            const TreeSys = GameApp.systems && GameApp.systems.tree;
            const MonsterSys = GameApp.systems && GameApp.systems.monster;
            if (isLv3) {
                const aoeCells = fxParams.lv3AoeRadiusCells ?? CONFIG.ICE_LV3_AOE_RADIUS_CELLS ?? 1.2;
                const frostRadiusPx = aoeCells * G.boardMetrics.step;
                const aoeSlow = TreeSys
                    ? TreeSys.getIceLineageSlowParams(towerObj.type, fxParams.lv3AoeSlowRate ?? 0.30, fxParams.lv3AoeSlowDurationMs ?? 1500)
                    : { rate: 0.30, durationMs: 1500 };
                applyHitToMonster(towerIndex, towerObj, target);
                for (let i = 0; i < G.state.monsters.length; i++) {
                    const m = G.state.monsters[i];
                    if (m.id !== target.id && m.hp > 0 && m.isTargetable !== false && Math.hypot(m.pixelX - targetPos.left, m.pixelY - targetPos.top) <= frostRadiusPx && MonsterSys) {
                        MonsterSys.applySlowToMonster(m, aoeSlow.rate, aoeSlow.durationMs);
                    }
                }
                GameApp.renderer.emitCanvasAttackFX(towerObj.type, towerPos, targetPos, { frostRadiusPx });
            } else {
                applyHitToMonster(towerIndex, towerObj, target);
                GameApp.renderer.emitCanvasAttackFX(towerObj.type, towerPos, targetPos);
            }
        },

        aoe_mist(towerIndex, towerObj, cfg, target, towerPos, targetPos) {
            const fxParams = cfg.effectParams || {};
            const TreeSys = GameApp.systems && GameApp.systems.tree;
            const MonsterSys = GameApp.systems && GameApp.systems.monster;
            const splashRadiusPx = (fxParams.splashRadiusCells ?? CONFIG.STEAM_SPLASH_RADIUS_CELLS ?? 1.3) * G.boardMetrics.step;
            const splashRatio = fxParams.splashRatio ?? CONFIG.STEAM_SPLASH_RATIO ?? 0.75;
            const armorPierce = fxParams.armorPierce ?? CONFIG.STEAM_ARMOR_PIERCE ?? 0.50;
            const mistSlow = TreeSys ? TreeSys.getIceLineageSlowParams(towerObj.type, 0, 0) : { rate: 0, durationMs: 0 };

            applyHitToMonster(towerIndex, towerObj, target, { armorPierce });
            if (mistSlow.rate > 0 && target.hp > 0 && MonsterSys) {
                MonsterSys.applySlowToMonster(target, mistSlow.rate, mistSlow.durationMs);
            }
            applySplashDamage(towerIndex, towerObj, targetPos, splashRadiusPx, target.id, { damageScale: splashRatio, armorPierce }, mistSlow);
            GameApp.renderer.emitCanvasAttackFX(towerObj.type, towerPos, targetPos, { splashRadiusPx });
        },

        stun_pulse(towerIndex, towerObj, cfg, target, towerPos, targetPos) {
            const fxParams = cfg.effectParams || {};
            const TreeSys = GameApp.systems && GameApp.systems.tree;
            const MonsterSys = GameApp.systems && GameApp.systems.monster;
            const frostRadiusPx = (fxParams.aoeRadiusCells ?? CONFIG.MAGNET_AOE_RADIUS_CELLS ?? 1.3) * G.boardMetrics.step;
            const chainRadiusPx = (fxParams.chainRadiusCells ?? CONFIG.MAGNET_CHAIN_RADIUS_CELLS ?? 2.6) * G.boardMetrics.step;
            const pulseSlow = TreeSys
                ? TreeSys.getIceLineageSlowParams(towerObj.type, fxParams.slowRate ?? 0.50, fxParams.slowDurationMs ?? 2200)
                : { rate: 0.50, durationMs: 2200 };
            const chainCount = (fxParams.chainExtraTargets ?? 2) + (TreeSys ? TreeSys.getThunderChainBonus(towerObj.type) : 0);

            applyHitToMonster(towerIndex, towerObj, target);
            if (target.hp > 0 && MonsterSys) MonsterSys.applySlowToMonster(target, pulseSlow.rate, pulseSlow.durationMs);
            for (let i = 0; i < G.state.monsters.length; i++) {
                const m = G.state.monsters[i];
                if (m.hp > 0 && m.isTargetable !== false && Math.hypot(m.pixelX - targetPos.left, m.pixelY - targetPos.top) <= frostRadiusPx && MonsterSys) {
                    MonsterSys.applySlowToMonster(m, pulseSlow.rate, pulseSlow.durationMs);
                }
            }
            GameApp.renderer.emitCanvasAttackFX('magnet-arc', towerPos, targetPos, { frostRadiusPx });

            const visited = new Set([target.id]);
            let prevPos = targetPos;
            for (let bounce = 0; bounce < chainCount; bounce++) {
                let bestNext = null, bestDist = Infinity;
                for (let i = 0; i < G.state.monsters.length; i++) {
                    const cand = G.state.monsters[i];
                    if (cand.hp <= 0 || cand.isTargetable === false || visited.has(cand.id)) continue;
                    const d = Math.hypot(cand.pixelX - prevPos.left, cand.pixelY - prevPos.top);
                    if (d <= chainRadiusPx && d < bestDist) { bestDist = d; bestNext = cand; }
                }
                if (!bestNext) break;
                visited.add(bestNext.id);
                const nextPos = { left: bestNext.pixelX, top: bestNext.pixelY };
                applyHitToMonster(towerIndex, towerObj, bestNext, { damageScale: fxParams.chainDamageRatio ?? 0.75 });
                if (bestNext.hp > 0 && MonsterSys) MonsterSys.applySlowToMonster(bestNext, pulseSlow.rate, pulseSlow.durationMs);
                GameApp.renderer.emitCanvasAttackFX('magnet-arc', prevPos, nextPos);
                prevPos = nextPos;
            }
        },

        pierce_beam(towerIndex, towerObj, cfg, target, towerPos, targetPos) {
            const fxParams = cfg.effectParams || {};
            const maxStacks = fxParams.maxStacks ?? CONFIG.PLASMA_MAX_STACKS ?? 5;
            const stackBonus = fxParams.stackBonus ?? CONFIG.PLASMA_STACK_BONUS ?? 0.15;
            towerObj.focusStacks = towerObj.focusTargetId === target.id
                ? Math.min(maxStacks, (towerObj.focusStacks || 0) + 1)
                : 0;
            towerObj.focusTargetId = target.id;
            applyHitToMonster(towerIndex, towerObj, target, { extraMult: 1 + towerObj.focusStacks * stackBonus });
            GameApp.renderer.emitCanvasAttackFX(towerObj.type, towerPos, targetPos, { stacks: towerObj.focusStacks });
            if (G.state.selectedIndex === towerIndex) G.callbacks.updateTowerInspector();
        }
    };

    function performTowerAttack(towerIndex, towerObj) {
        const Renderer = GameApp.renderer, st = G.state, coords = indexToCoords(towerIndex);
        const towerPos = Renderer.getCellCenter(coords.x, coords.y);
        const isLv3 = towerObj.tier >= getMaxTier();
        const cfg = getTowerCfg(towerObj.type) || { attackStyle: 'burst_armor_break', effectParams: {} };
        const style = cfg.attackStyle || 'burst_armor_break';
        const fxParams = cfg.effectParams || {};

        if (style === 'chain_lightning') {
            const TreeSys = GameApp.systems && GameApp.systems.tree;
            const baseBolts = isLv3 ? (fxParams.lv3BoltCount ?? CONFIG.THUNDER_LV3_BOLT_COUNT ?? 3) : (fxParams.boltCount ?? CONFIG.THUNDER_BOLT_COUNT ?? 2);
            const boltCount = baseBolts + (TreeSys ? TreeSys.getThunderChainBonus(towerObj.type) : 0);
            const delayMs = fxParams.boltDelayMs ?? CONFIG.THUNDER_BOLT_DELAY_MS ?? 90;
            if (!fireLightningBolt(towerIndex, towerObj)) return false;
            for (let b = 1; b < boltCount; b++) {
                st.pendingBolts.push({ sessionId: st.sessionId, towerIndex, towerObj, remainingMs: delayMs * b });
            }
            return true;
        }

        const target = findBestTargetInRange(towerIndex, towerObj);
        if (!target) return false;
        const targetPos = { left: target.pixelX, top: target.pixelY };
        Renderer.updateTowerAimVisual(towerIndex, towerObj, towerPos, targetPos);

        const handler = ATTACK_STYLE_HANDLERS[style] || ATTACK_STYLE_HANDLERS.burst_armor_break;
        handler(towerIndex, towerObj, cfg, target, towerPos, targetPos, isLv3);

        GameApp.audio.playTowerShot(towerObj.type);
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
                if (bolt.remainingMs <= 0) {
                    if (fireLightningBolt(bolt.towerIndex, bolt.towerObj)) didCombatAct = true;
                } else {
                    remainingQueue.push(bolt);
                }
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
        if (didCombatAct) GameApp.renderer.renderMonsterLayer();
    }

    const TowerAttackSystem = {
        bind,
        getTowerEffectiveRangeCells,
        getTowerRangePx,
        getTowerAttackInterval,
        createTowerObj,
        recordTowerDamage,
        getTowerInspectorStats,
        pickSmartSpawnIndex,
        isMonsterPreferred,
        findBestTargetInRange,
        calculateDamage,
        applyHitToMonster,
        fireThunderBolt: fireLightningBolt,
        performTowerAttack,
        updateTowersCombat
    };

    GameApp.systems = GameApp.systems || {};
    GameApp.systems.towerAttack = TowerAttackSystem;
    GameApp.systems.towers = TowerAttackSystem;
})(window);
