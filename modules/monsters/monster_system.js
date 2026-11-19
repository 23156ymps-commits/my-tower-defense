/**
 * ============================================================================
 * 【檔案名稱】：modules/monsters/monster_system.js
 * 【負責功能】：統一管理戰場活體怪物名單（isTargetable 狀態）、怪物生成、沿 waypoints 轉彎移動與路徑回拉、
 *               Phase 2A 通用異常狀態機（burn 灼燒疊層與傳染、grievousWound 重傷減療、freeze 凍結與 6s 免疫、
 *               shock 感電協同附傷、vuln 易傷來源表、slow 遞減減速來源表）、地面蒸氣池持續傷害與突破防線結算。
 * 【讀取資料】：讀取 modules/monsters/monster_data.js、tower_data.js、economy_system.js 與 tree_system.js。
 * 【常見修改入口】：
 *   1. 修改通用異常狀態更新、灼燒傳染或減速／易傷上限：修改 updateMonsters()、getMonsterEffectiveSlowRate()、getMonsterVulnerabilityMultiplier()。
 *   2. 修改路徑回拉、凍結免疫或感電附傷：修改 pullMonsterAlongPath()、registerPermafrostHitAndTryFreeze()、tryTriggerShockBonusDamage()。
 * ============================================================================
 */
(function (global) {
    'use strict';

    const GameApp = global.GameApp = global.GameApp || {};
    const CONFIG = GameApp.config || {};
    const { clampNumber } = GameApp.helpers || {};

    let G = null;
    function bind(ctx) { G = ctx; }

    function getMonstersData() {
        return (GameApp.data && GameApp.data.monsters) || {};
    }

    function getRules() {
        return getMonstersData().GLOBAL_MONSTER_RULES || {};
    }

    function getMonsterDb() {
        return getMonstersData().MONSTER_DATABASE || {};
    }

    function getCombatConstants() {
        return (GameApp.data && GameApp.data.towers && GameApp.data.towers.COMBAT_CONSTANTS) || {};
    }

    function createInitialStatusState() {
        return {
            burn: {
                stacks: 0,
                maxStacks: 5,
                flatDps: 8,
                pctMaxHp: 0.0035,
                bossCapPerStack: 35,
                durationMs: 0,
                spreadTimerMs: 0,
                spreadIntervalMs: 2000,
                spreadRadiusCells: 1.2,
                tickAccMs: 0,
                sourceTower: null
            },
            grievousWound: {
                active: false,
                rate: 0.50,
                durationMs: 0
            },
            freeze: {
                durationMs: 0,
                immuneMs: 0,
                pendingImmuneMs: 6000,
                hitCountsByTower: {}
            },
            shock: {
                durationMs: 0,
                bonusDamage: 12,
                icdMs: 0,
                icdMaxMs: 350,
                sourceTower: null
            },
            vuln: {},
            slow: {},
            resonanceElements: {}
        };
    }

    function ensureMonsterStatus(monster) {
        if (!monster) return null;
        if (!monster.status) {
            monster.status = createInitialStatusState();
        }
        return monster.status;
    }

    function makeMonsterRecord(fields) {
        const rec = {
            isTargetable: true,
            wpIndex: 0,
            gridX: 0,
            gridY: 0,
            pixelX: 0,
            pixelY: 0,
            slowTimer: 0,
            slowRate: 0,
            armorShredTimer: 0,
            armorShredRate: 0,
            rootTimer: 0,
            rootVulnRate: 0,
            status: createInitialStatusState(),
            ...fields
        };
        if (!rec.status) rec.status = createInitialStatusState();
        return rec;
    }

    function spawnMonsterFromEntry(entry) {
        const Renderer = GameApp.renderer, st = G.state;
        const db = getMonsterDb();
        const rules = getRules();
        const wb = (GameApp.data && GameApp.data.routes && GameApp.data.routes.WAVE_BALANCE) || {};
        const cfg = db[entry.typeKey] || {
            name: entry.typeKey || '未知魔物',
            icon: '👾',
            weakness: 'fire',
            baseHp: 68,
            baseReward: 10,
            speedMult: 1.0,
            baseArmor: 0,
            splitsOnDeath: false
        };
        const wp0 = G.map.waypoints[0];
        const startPos = Renderer.getCellCenter(wp0.x, wp0.y);
        const spdGlobal = clampNumber(rules.MONSTER_SPEED_SCALE ?? CONFIG.MONSTER_SPEED_SCALE ?? 1.0, 0.2, 5.0, 1.0);
        const hpGlobal = clampNumber(rules.MONSTER_HP_SCALE ?? CONFIG.MONSTER_HP_SCALE ?? 1.0, 0.1, 20.0, 1.0);
        const baseSpeedConst = rules.MONSTER_BASE_SPEED ?? CONFIG.MONSTER_BASE_SPEED ?? 2.6;

        if (GameApp.systems && GameApp.systems.codex && typeof GameApp.systems.codex.unlockEntry === 'function') {
            GameApp.systems.codex.unlockEntry(`monster:${entry.typeKey}`);
        }

        if (entry.isBoss) {
            const bossHp = Math.max(10, Math.round((entry.bossHp || 2800) * hpGlobal));
            st.monsters.push(makeMonsterRecord({
                id: st.monsterIdCounter++,
                sessionId: st.sessionId,
                typeKey: entry.typeKey,
                name: entry.bossName || '腐朽古樹王',
                icon: entry.bossIcon || '👹',
                weakness: cfg.weakness || 'fire',
                hp: bossHp,
                maxHp: bossHp,
                armor: entry.armor || 0,
                isElite: true,
                isBoss: true,
                isSplitChild: false,
                splitsOnDeath: false,
                baseDamage: entry.bossBaseDamage || wb.BOSS_BASE_DAMAGE || 20,
                reward: (entry.bossReward || wb.BOSS_REWARD || 120) + (entry.rewardBonus || 0),
                wpIndex: 0,
                gridX: wp0.x,
                gridY: wp0.y,
                pixelX: startPos.left,
                pixelY: startPos.top,
                visualOffsetX: 0,
                visualOffsetY: 0,
                baseSpeed: baseSpeedConst * (wb.BOSS_SPEED_MULT || 0.55) * spdGlobal
            }));
            Renderer.renderMonsterLayer();
            return;
        }

        const hpMult = entry.isElite ? (wb.ELITE_HP_MULT || 2.1) : 1.0;
        const speedMult = (cfg.speedMult || 1.0) * (entry.isElite ? (wb.ELITE_SPEED_MULT || 0.85) : 1.0);
        const maxHp = Math.max(10, Math.round((cfg.baseHp || 68) * (entry.hpScale || 1) * hpMult * hpGlobal));
        const reward = Math.max(1, Math.round(((cfg.baseReward || 10) + (entry.rewardBonus || 0)) * (entry.isElite ? (wb.ELITE_REWARD_MULT || 2.2) : 1.0)));

        st.monsters.push(makeMonsterRecord({
            id: st.monsterIdCounter++,
            sessionId: st.sessionId,
            typeKey: entry.typeKey,
            name: entry.isElite ? `菁英${cfg.name}` : cfg.name,
            icon: cfg.icon || '👾',
            weakness: cfg.weakness || 'fire',
            hp: maxHp,
            maxHp,
            armor: entry.armor || 0,
            isElite: Boolean(entry.isElite),
            isBoss: false,
            isSplitChild: false,
            splitsOnDeath: Boolean(cfg.splitsOnDeath),
            splitCount: cfg.splitCount,
            splitHpRatio: cfg.splitHpRatio,
            splitChildName: cfg.splitChildName,
            splitChildIcon: cfg.splitChildIcon,
            baseDamage: 1,
            reward,
            wpIndex: 0,
            gridX: wp0.x,
            gridY: wp0.y,
            pixelX: startPos.left,
            pixelY: startPos.top,
            visualOffsetX: 0,
            visualOffsetY: 0,
            baseSpeed: baseSpeedConst * speedMult * spdGlobal
        }));
        Renderer.renderMonsterLayer();
    }

    function spawnSplitMiniSlimes(parent) {
        const st = G.state;
        if (!parent || parent.sessionId !== st.sessionId || !G.callbacks.isGameplayActive()) return;
        const Renderer = GameApp.renderer, wps = G.map.waypoints;
        const rules = getRules();
        const splitRatio = parent.splitHpRatio ?? rules.SLIME_SPLIT_HP_RATIO ?? 0.30;
        const splitCount = parent.splitCount ?? rules.SLIME_SPLIT_COUNT ?? 2;
        const childMaxHp = Math.max(1, Math.round(parent.maxHp * splitRatio));
        const wpA = wps[Math.min(parent.wpIndex, wps.length - 1)], wpB = wps[Math.min(parent.wpIndex + 1, wps.length - 1)];
        const segDx = wpB.x - wpA.x, segDy = wpB.y - wpA.y, segLen = Math.hypot(segDx, segDy) || 1;
        const ux = segDx / segLen, uy = segDy / segLen, proj = (parent.gridX - wpA.x) * ux + (parent.gridY - wpA.y) * uy;

        const offsets = splitCount === 2
            ? [{ along: -0.22, vx: -5, vy: -4 }, { along: +0.22, vx: +5, vy: +4 }]
            : Array.from({ length: splitCount }, (_, idx) => ({
                along: (idx - (splitCount - 1) / 2) * 0.22,
                vx: (idx % 2 === 0 ? -5 : 5),
                vy: (idx % 2 === 0 ? -4 : 4)
            }));

        offsets.forEach(off => {
            const cProj = Math.max(0, Math.min(segLen, proj + off.along)), gx = wpA.x + ux * cProj, gy = wpA.y + uy * cProj;
            const center = Renderer.getCellCenter(gx, gy);
            st.monsters.push(makeMonsterRecord({
                id: st.monsterIdCounter++,
                sessionId: st.sessionId,
                typeKey: parent.typeKey,
                name: parent.splitChildName || '迷你史萊姆',
                icon: parent.splitChildIcon || '🟢',
                weakness: parent.weakness,
                hp: childMaxHp,
                maxHp: childMaxHp,
                armor: 0,
                isElite: false,
                isBoss: false,
                isSplitChild: true,
                splitsOnDeath: false,
                baseDamage: 1,
                reward: 0,
                wpIndex: parent.wpIndex,
                gridX: gx,
                gridY: gy,
                pixelX: center.left + off.vx,
                pixelY: center.top + off.vy,
                visualOffsetX: off.vx,
                visualOffsetY: off.vy,
                baseSpeed: parent.baseSpeed * 1.12
            }));
        });
    }

    function getMonsterProgress(monster) {
        const wps = G && G.map && G.map.waypoints;
        if (!wps || wps.length === 0 || !monster) return 0;
        const wpIdx = Math.max(0, Math.min(Number(monster.wpIndex) || 0, wps.length - 1));
        const wp = wps[wpIdx];
        if (!wp) return 0;
        return (G.map.waypointCumDist[wpIdx] || 0) + Math.hypot((monster.gridX || 0) - wp.x, (monster.gridY || 0) - wp.y);
    }

    function getMonsterProgressRatio(monster) {
        const cum = G && G.map && G.map.waypointCumDist;
        const totalDist = (cum && cum.length > 0) ? cum[cum.length - 1] : 1;
        if (totalDist <= 0) return 0;
        return Math.max(0, Math.min(1, getMonsterProgress(monster) / totalDist));
    }

    /**
     * 將非 Boss 怪物沿路徑往起點方向回拉指定格數（引力黑洞樹 magnet_A 專用，不低於起點 0）
     */
    function pullMonsterAlongPath(monster, distanceCells = 0.45) {
        if (!monster || monster.isBoss || monster.hp <= 0 || monster.isTargetable === false) return false;
        const wps = G && G.map && G.map.waypoints;
        const cum = G && G.map && G.map.waypointCumDist;
        if (!wps || wps.length < 2 || !cum || cum.length < 2) return false;

        const curDist = getMonsterProgress(monster);
        const targetDist = Math.max(0, curDist - Math.max(0, Number(distanceCells) || 0.45));

        let segIdx = 0;
        for (let i = 0; i < cum.length - 1; i++) {
            if (targetDist >= cum[i] && targetDist <= cum[i + 1]) {
                segIdx = i;
                break;
            }
        }
        const wpA = wps[segIdx];
        const wpB = wps[Math.min(segIdx + 1, wps.length - 1)];
        const segLen = Math.max(1e-5, (cum[segIdx + 1] || 0) - (cum[segIdx] || 0));
        const ratio = Math.max(0, Math.min(1, (targetDist - (cum[segIdx] || 0)) / segLen));

        monster.wpIndex = segIdx;
        monster.gridX = wpA.x + (wpB.x - wpA.x) * ratio;
        monster.gridY = wpA.y + (wpB.y - wpA.y) * ratio;
        if (GameApp.renderer && typeof GameApp.renderer.getCellCenter === 'function') {
            const pos = GameApp.renderer.getCellCenter(monster.gridX, monster.gridY);
            monster.pixelX = pos.left + (monster.visualOffsetX || 0);
            monster.pixelY = pos.top + (monster.visualOffsetY || 0);
        }
        return true;
    }

    function getMonsterEffectiveArmor(monster, armorPierce = 0) {
        const shred = monster.armorShredTimer > 0 ? Math.max(0, Math.min(1, Number(monster.armorShredRate) || 0.30)) : 0;
        const pierce = Math.max(0, Math.min(1, Number(armorPierce) || 0));
        return Math.max(0, (Number(monster.armor) || 0) * (1 - shred) * (1 - pierce));
    }

    // ==================== Phase 2A 通用異常狀態機與上限鎖 ====================
    /**
     * 計算減速遞減與 70% 硬上限：取「最高減速 + 次高減速 × 0.25」，上限 0.70（移速下限 0.30）
     */
    function getMonsterEffectiveSlowRate(monster) {
        if (!monster) return 0;
        const st = ensureMonsterStatus(monster);
        const cc = getCombatConstants();
        const secondFactor = Number.isFinite(cc.SLOW_DIMINISH_SECOND_FACTOR) ? cc.SLOW_DIMINISH_SECOND_FACTOR : 0.25;
        const slowCap = Number.isFinite(cc.SLOW_TOTAL_CAP) ? cc.SLOW_TOTAL_CAP : 0.70;

        const rates = [];
        const slowMap = st.slow || {};
        Object.keys(slowMap).forEach((k) => {
            const entry = slowMap[k];
            if (entry && entry.durationMs > 0 && entry.rate > 0) {
                rates.push(Math.min(slowCap, entry.rate));
            }
        });
        if ( rates.length === 0 && monster.slowTimer > 0 && monster.slowRate > 0) {
            rates.push(Math.min(slowCap, monster.slowRate));
        }
        if (rates.length === 0) return 0;
        rates.sort((a, b) => b - a);
        const highest = rates[0] || 0;
        const second = rates[1] || 0;
        return Math.min(slowCap, highest + second * secondFactor);
    }

    function syncLegacySlowFields(monster) {
        if (!monster) return;
        const st = ensureMonsterStatus(monster);
        let maxDur = 0;
        Object.keys(st.slow).forEach((k) => {
            if (st.slow[k] && st.slow[k].durationMs > maxDur) {
                maxDur = st.slow[k].durationMs;
            }
        });
        monster.slowTimer = maxDur;
        monster.slowRate = maxDur > 0 ? getMonsterEffectiveSlowRate(monster) : 0;
    }

    function applySlowToMonster(monster, slowRate, durationMs, sourceId = 'ice_primary') {
        if (!monster || monster.hp <= 0 || monster.isTargetable === false) return;
        const st = ensureMonsterStatus(monster);
        const cc = getCombatConstants();
        const slowCap = Number.isFinite(cc.SLOW_TOTAL_CAP) ? cc.SLOW_TOTAL_CAP : 0.70;
        const clampedRate = Math.min(slowCap, Math.max(0, Number(slowRate) || 0));
        const dur = Math.max(0, Number(durationMs) || 0);
        if (clampedRate <= 0 || dur <= 0) return;

        const key = String(sourceId || 'ice_primary');
        const prev = st.slow[key];
        if (!prev || clampedRate >= prev.rate || prev.durationMs <= 0) {
            st.slow[key] = {
                rate: clampedRate,
                durationMs: Math.max(prev ? prev.durationMs : 0, dur)
            };
        } else {
            prev.durationMs = Math.max(prev.durationMs, dur);
        }
        syncLegacySlowFields(monster);
    }

    function isMonsterSlowed(monster) {
        if (!monster) return false;
        return getMonsterEffectiveSlowRate(monster) > 0 || (monster.slowTimer || 0) > 0;
    }

    function isMonsterFrozen(monster) {
        if (!monster || !monster.status || !monster.status.freeze) return false;
        return monster.status.freeze.durationMs > 0;
    }

    function isMonsterControlled(monster) {
        if (!monster) return false;
        return isMonsterSlowed(monster) || isMonsterFrozen(monster) || (monster.rootTimer || 0) > 0;
    }

    /**
     * 永凍領域樹 (ice_A) 專用：每命中已減速目標第 4 次觸發 0.9s 凍結（Boss 減半，解凍後 6s 免疫）
     */
    function registerPermafrostHitAndTryFreeze(monster, towerObj, freezeParams = {}) {
        if (!monster || monster.hp <= 0 || monster.isTargetable === false) return false;
        const st = ensureMonsterStatus(monster);
        const fz = st.freeze;
        if (!isMonsterSlowed(monster)) return false;

        const towerKey = (towerObj && towerObj.uid) ? `t_${towerObj.uid}` : 'ice_A';
        fz.hitCountsByTower[towerKey] = (fz.hitCountsByTower[towerKey] || 0) + 1;
        const hitsNeeded = Math.max(1, Number(freezeParams.hitsToFreeze) || 4);

        if (fz.hitCountsByTower[towerKey] % hitsNeeded !== 0) return false;
        if (fz.immuneMs > 0 || fz.durationMs > 0) return false;

        const baseDur = Number(freezeParams.freezeDurationMs) || 900;
        const bossMult = Number.isFinite(freezeParams.bossFreezeMult) ? freezeParams.bossFreezeMult : 0.50;
        const dur = monster.isBoss ? Math.max(100, Math.round(baseDur * bossMult)) : baseDur;
        fz.durationMs = dur;
        fz.pendingImmuneMs = Number(freezeParams.freezeImmuneMs) || 6000;

        if (GameApp.renderer && typeof GameApp.renderer.spawnFloatingNotice === 'function') {
            GameApp.renderer.spawnFloatingNotice('❄️ 永凍凍結', monster.pixelX, monster.pixelY, 'pity-seed');
        }
        return true;
    }

    /**
     * 施加灼燒疊層（焚世餘燼樹 fire_B：最高 5 層，每層 8 + 0.35% maxHP/s，Boss 單層上限 35/s，持續 5s 並每 2s 傳染）
     */
    function applyBurnToMonster(monster, burnParams = {}, sourceTower = null) {
        if (!monster || monster.hp <= 0 || monster.isTargetable === false) return;
        const st = ensureMonsterStatus(monster);
        const b = st.burn;
        const maxStacks = Number(burnParams.burnMaxStacks) || b.maxStacks || 5;
        const addStacks = Math.max(1, Number(burnParams.addStacks) || 1);

        b.maxStacks = maxStacks;
        b.stacks = Math.min(maxStacks, (b.durationMs > 0 ? b.stacks : 0) + addStacks);
        b.flatDps = Number(burnParams.burnFlatDps) || 8;
        b.pctMaxHp = Number(burnParams.burnPctMaxHp) || 0.0035;
        b.bossCapPerStack = Number(burnParams.burnBossCapPerStack) || 35;
        b.durationMs = Math.max(b.durationMs || 0, Number(burnParams.burnDurationMs) || 5000);
        b.spreadIntervalMs = Number(burnParams.burnSpreadIntervalMs) || 2000;
        b.spreadRadiusCells = Number(burnParams.burnSpreadRadiusCells) || 1.2;
        if (sourceTower) b.sourceTower = sourceTower;
    }

    function getMonsterBurnDps(monster) {
        if (!monster || !monster.status || !monster.status.burn) return 0;
        const b = monster.status.burn;
        if (b.stacks <= 0 || b.durationMs <= 0) return 0;
        let perStack = (b.flatDps || 8) + (b.pctMaxHp || 0.0035) * (monster.maxHp || 100);
        if (monster.isBoss) {
            perStack = Math.min(b.bossCapPerStack || 35, perStack);
        }
        return b.stacks * perStack;
    }

    function applyGrievousWound(monster, rate = 0.50, durationMs = 5000) {
        if (!monster || monster.hp <= 0 || monster.isTargetable === false) return;
        const st = ensureMonsterStatus(monster);
        st.grievousWound.active = true;
        st.grievousWound.rate = Math.max(st.grievousWound.rate || 0, Math.min(0.90, Number(rate) || 0.50));
        st.grievousWound.durationMs = Math.max(st.grievousWound.durationMs || 0, Number(durationMs) || 5000);
    }

    function applyHealToMonster(monster, rawHeal) {
        if (!monster || monster.hp <= 0 || !Number.isFinite(rawHeal) || rawHeal <= 0) return 0;
        const st = ensureMonsterStatus(monster);
        const gw = st.grievousWound;
        const mult = (gw && gw.durationMs > 0) ? (1 - (gw.rate || 0.50)) : 1.0;
        const heal = Math.max(0, Math.round(rawHeal * mult));
        const before = monster.hp;
        monster.hp = Math.min(monster.maxHp, monster.hp + heal);
        return monster.hp - before;
    }

    function applyShockToMonster(monster, shockParams = {}, sourceTower = null) {
        if (!monster || monster.hp <= 0 || monster.isTargetable === false) return;
        const st = ensureMonsterStatus(monster);
        const sh = st.shock;
        sh.durationMs = Math.max(sh.durationMs || 0, Number(shockParams.shockDurationMs) || 3500);
        sh.bonusDamage = Number(shockParams.shockBonusDamage) || 12;
        sh.icdMaxMs = Number(shockParams.shockIcdMs) || 350;
        if (sourceTower) sh.sourceTower = sourceTower;
    }

    /**
     * 任何防禦塔命中感電怪時，觸發 +12 雷電附加傷（單怪 0.35s 內置冷卻）
     */
    function tryTriggerShockBonusDamage(monster, attackerTower = null) {
        if (!monster || monster.hp <= 0 || monster.isTargetable === false) return 0;
        const st = ensureMonsterStatus(monster);
        const sh = st.shock;
        if (!sh || sh.durationMs <= 0 || sh.icdMs > 0) return 0;

        const bonusDmg = Math.max(1, Math.round(sh.bonusDamage || 12));
        sh.icdMs = sh.icdMaxMs || 350;

        const hpBefore = monster.hp;
        monster.hp = Math.max(0, hpBefore - bonusDmg);
        const creditTower = sh.sourceTower || attackerTower;
        const AttackSys = GameApp.systems && GameApp.systems.towerAttack;
        if (AttackSys && creditTower) {
            AttackSys.recordTowerDamage(creditTower, Math.min(hpBefore, bonusDmg));
        }
        if (GameApp.renderer && typeof GameApp.renderer.spawnDamageNumber === 'function') {
            GameApp.renderer.spawnDamageNumber(bonusDmg, false, monster.pixelX, monster.pixelY, '⚡');
        }
        if (monster.hp <= 0) {
            handleMonsterKilled(monster, creditTower, bonusDmg);
        }
        return bonusDmg;
    }

    function applyVulnerabilityToMonster(monster, vulnBonus, durationMs, sourceId = 'mist_fog') {
        if (!monster || monster.hp <= 0 || monster.isTargetable === false) return;
        const st = ensureMonsterStatus(monster);
        const bonus = Math.max(0, Number(vulnBonus) || 0);
        const dur = Math.max(0, Number(durationMs) || 0);
        if (bonus <= 0 || dur <= 0) return;

        const key = String(sourceId || 'mist_fog');
        const prev = st.vuln[key];
        st.vuln[key] = {
            bonus: Math.max(prev && prev.durationMs > 0 ? prev.bonus : 0, bonus),
            durationMs: Math.max(prev ? prev.durationMs : 0, dur)
        };
    }

    /**
     * 計算怪物總易傷倍率（含世界樹纏繞、霜霧迷宮濕冷易傷、世界樹荊棘近樹易傷，硬性上限 +60%）
     * M_vuln = 1 + Math.min(0.60, totalVuln)
     */
    function getMonsterVulnerabilityMultiplier(monster) {
        if (!monster) return 1.0;
        const st = ensureMonsterStatus(monster);
        const cc = getCombatConstants();
        const cap = Number.isFinite(cc.VULN_ADDITIVE_CAP) ? cc.VULN_ADDITIVE_CAP : 0.60;

        let totalVuln = 0;
        if ((monster.rootTimer || 0) > 0 && (monster.rootVulnRate || 0) > 0) {
            totalVuln += monster.rootVulnRate;
        }
        Object.keys(st.vuln).forEach((k) => {
            const v = st.vuln[k];
            if (v && v.durationMs > 0 && v.bonus > 0) {
                totalVuln += v.bonus;
            }
        });
        const TreeSys = GameApp.systems && GameApp.systems.tree;
        if (TreeSys && typeof TreeSys.getNearTreeVulnerabilityBonus === 'function') {
            totalVuln += TreeSys.getNearTreeVulnerabilityBonus(monster);
        }
        return 1.0 + Math.min(cap, Math.max(0, totalVuln));
    }

    function applyArmorShred(monster, shredRate = 0.30, durationMs = 3000) {
        if (!monster || monster.hp <= 0 || monster.isTargetable === false) return;
        if (shredRate >= (monster.armorShredTimer > 0 ? (monster.armorShredRate || 0) : 0)) {
            monster.armorShredRate = shredRate;
            monster.armorShredTimer = Math.max(monster.armorShredTimer, durationMs);
        }
    }

    /**
     * 新增地面持續傷害區域（如焦熱蒸壓樹 steam_A 的 3s 滾燙蒸氣池，每秒 28 點傷害）
     */
    function spawnGroundHazard(spec = {}) {
        if (!G || !G.state) return null;
        if (!Array.isArray(G.state.groundHazards)) G.state.groundHazards = [];
        const hazard = {
            type: spec.type || 'steam_pool',
            x: Number(spec.x) || 0,
            y: Number(spec.y) || 0,
            radiusPx: Number(spec.radiusPx) || (1.3 * G.boardMetrics.step),
            dps: Number(spec.dps) || 28,
            remainingMs: Number(spec.durationMs) || 3000,
            maxDurationMs: Number(spec.durationMs) || 3000,
            tickAccMs: 0,
            dmgCarry: 0,
            sourceTower: spec.sourceTower || null
        };
        G.state.groundHazards.push(hazard);
        return hazard;
    }

    function handleMonsterKilled(monster, killerTowerObj, killingDamage, options = {}) {
        const st = G.state;
        if (!monster || monster._killHandled) return;
        monster._killHandled = true;
        monster.isTargetable = false;

        const WaveSys = GameApp.systems && GameApp.systems.wave;
        const EconSys = GameApp.systems && GameApp.systems.economy;
        const TreeSys = GameApp.systems && GameApp.systems.tree;
        const mapSpec = WaveSys ? WaveSys.getCurrentMapSpec() : { killGoldMult: 1.0 };

        const killGold = EconSys
            ? EconSys.computeKillGold(monster.reward, mapSpec)
            : (monster.reward > 0 ? Math.max(1, Math.round(monster.reward * (mapSpec.killGoldMult || 1.0))) : 0);
        st.currentGold += killGold;
        st.totalGoldEarned += killGold;
        st.killsCount++;

        const dewGain = TreeSys ? TreeSys.computeKillDewGain(monster) : 0;
        const dewMax = (GameApp.data && GameApp.data.tree && GameApp.data.tree.TREE_CONFIG && GameApp.data.tree.TREE_CONFIG.DEW_MAX) || 100;
        if (dewGain > 0) st.dewEnergy = Math.min(dewMax, st.dewEnergy + dewGain);

        if (monster.isBoss && GameApp.backend && typeof GameApp.backend.trackFeel === 'function') {
            const progPct = Math.round(getMonsterProgressRatio(monster) * 100);
            GameApp.backend.trackFeel(`Boss:KillProgress:Wave_${st.currentWave}`, progPct, {
                bossName: monster.name,
                wave: st.currentWave,
                progressPct: progPct
            });
        }

        const deadIdx = st.monsters.findIndex(m => m.id === monster.id);
        if (deadIdx !== -1) st.monsters.splice(deadIdx, 1);
        GameApp.renderer.removeMonsterDom(monster.id);
        GameApp.audio.playKill();

        if (monster.splitsOnDeath) {
            spawnSplitMiniSlimes(monster);
            const splitCnt = monster.splitCount || getRules().SLIME_SPLIT_COUNT || 2;
            G.dom.msgText.innerText = `🟢 【${monster.name}】分裂成 ${splitCnt} 隻${monster.splitChildName || '迷你史萊姆'}！`;
        } else if (killGold > 0 && !options.isEmberSplash && !options.isDotKill) {
            G.dom.msgText.innerText = `💥 擊殺【${monster.name}】！獲得 +${killGold} 💰${dewGain > 0 ? `、+${dewGain} 💧` : ''}！`;
        }

        if (!options.isEmberSplash && TreeSys && typeof TreeSys.tryTriggerEmberExplosion === 'function') {
            TreeSys.tryTriggerEmberExplosion(monster.pixelX, monster.pixelY, killerTowerObj, killingDamage);
        }
        G.callbacks.updateHUD();
    }

    function updateGroundHazards(dtMs) {
        const st = G.state;
        if (!Array.isArray(st.groundHazards) || st.groundHazards.length === 0) return;
        const AttackSys = GameApp.systems && GameApp.systems.towerAttack;

        for (let i = st.groundHazards.length - 1; i >= 0; i--) {
            const hz = st.groundHazards[i];
            hz.remainingMs -= dtMs;
            hz.tickAccMs += dtMs;

            while (hz.tickAccMs >= 250) {
                hz.tickAccMs -= 250;
                const rawTick = (hz.dps || 28) * 0.25 + (hz.dmgCarry || 0);
                const tickDmg = Math.max(1, Math.floor(rawTick));
                hz.dmgCarry = Math.max(0, rawTick - tickDmg);
                const dmgIcon = hz.type === 'scorch_trail' ? '🔥' : '💨';
                const victims = st.monsters.filter(m =>
                    m.hp > 0 && m.isTargetable !== false && Math.hypot(m.pixelX - hz.x, m.pixelY - hz.y) <= hz.radiusPx
                );
                for (let v = 0; v < victims.length; v++) {
                    const m = victims[v];
                    if (m.hp <= 0) continue;
                    const before = m.hp;
                    m.hp = Math.max(0, before - tickDmg);
                    if (AttackSys && hz.sourceTower) {
                        AttackSys.recordTowerDamage(hz.sourceTower, Math.min(before, tickDmg));
                    }
                    if (GameApp.renderer) {
                        GameApp.renderer.spawnDamageNumber(tickDmg, false, m.pixelX, m.pixelY, dmgIcon);
                    }
                    if (m.hp <= 0) {
                        handleMonsterKilled(m, hz.sourceTower, tickDmg, { isDotKill: true });
                    }
                }
            }

            if (hz.remainingMs <= 0) {
                st.groundHazards.splice(i, 1);
            }
        }
    }

    function tickMonsterStatusEffects(m, dtMs) {
        const st = ensureMonsterStatus(m);
        const AttackSys = GameApp.systems && GameApp.systems.towerAttack;

        // 1. 緩速來源表倒數
        Object.keys(st.slow).forEach((k) => {
            const s = st.slow[k];
            if (!s) return;
            s.durationMs = Math.max(0, s.durationMs - dtMs);
            if (s.durationMs === 0) delete st.slow[k];
        });
        if (m.slowTimer > 0 && Object.keys(st.slow).length === 0) {
            m.slowTimer = Math.max(0, m.slowTimer - dtMs);
            if (m.slowTimer === 0) m.slowRate = 0;
        } else {
            syncLegacySlowFields(m);
        }

        // 2. 易傷來源表與元素共鳴倒數
        Object.keys(st.vuln).forEach((k) => {
            const v = st.vuln[k];
            if (!v) return;
            v.durationMs = Math.max(0, v.durationMs - dtMs);
            if (v.durationMs === 0) delete st.vuln[k];
        });
        if (st.resonanceElements) {
            Object.keys(st.resonanceElements).forEach((elKey) => {
                st.resonanceElements[elKey] = Math.max(0, st.resonanceElements[elKey] - dtMs);
                if (st.resonanceElements[elKey] === 0) delete st.resonanceElements[elKey];
            });
        }
        if ((m._scorchBrandIcdMs || 0) > 0) {
            m._scorchBrandIcdMs = Math.max(0, m._scorchBrandIcdMs - dtMs);
        }

        // 3. 破甲與纏繞倒數
        if (m.armorShredTimer > 0 && (m.armorShredTimer = Math.max(0, m.armorShredTimer - dtMs)) === 0) m.armorShredRate = 0;
        if ((m.rootTimer || 0) > 0 && (m.rootTimer = Math.max(0, m.rootTimer - dtMs)) === 0) m.rootVulnRate = 0;

        // 4. 重傷倒數
        if (st.grievousWound.durationMs > 0) {
            st.grievousWound.durationMs = Math.max(0, st.grievousWound.durationMs - dtMs);
            if (st.grievousWound.durationMs === 0) st.grievousWound.active = false;
        }

        // 5. 凍結與解凍後 6s 免疫倒數
        if (st.freeze.immuneMs > 0) {
            st.freeze.immuneMs = Math.max(0, st.freeze.immuneMs - dtMs);
        }
        if (st.freeze.durationMs > 0) {
            st.freeze.durationMs = Math.max(0, st.freeze.durationMs - dtMs);
            if (st.freeze.durationMs === 0) {
                st.freeze.immuneMs = st.freeze.pendingImmuneMs || 6000;
            }
        }

        // 6. 感電與 0.35s 內置冷卻倒數
        if (st.shock.icdMs > 0) {
            st.shock.icdMs = Math.max(0, st.shock.icdMs - dtMs);
        }
        if (st.shock.durationMs > 0) {
            st.shock.durationMs = Math.max(0, st.shock.durationMs - dtMs);
        }

        // 7. 灼燒持續傷害與每 2s 鄰近傳染
        const b = st.burn;
        if (b.stacks > 0 && b.durationMs > 0) {
            b.durationMs = Math.max(0, b.durationMs - dtMs);
            b.tickAccMs += dtMs;
            b.spreadTimerMs += dtMs;

            // 每 2s 向 1.2 格內鄰近敵人傳染 1 層灼燒
            const spreadInterval = b.spreadIntervalMs || 2000;
            while (b.spreadTimerMs >= spreadInterval && b.durationMs > 0) {
                b.spreadTimerMs -= spreadInterval;
                const spreadRadiusPx = (b.spreadRadiusCells || 1.2) * G.boardMetrics.step;
                for (let j = 0; j < G.state.monsters.length; j++) {
                    const neighbor = G.state.monsters[j];
                    if (neighbor.id === m.id || neighbor.hp <= 0 || neighbor.isTargetable === false) continue;
                    if (Math.hypot(neighbor.pixelX - m.pixelX, neighbor.pixelY - m.pixelY) <= spreadRadiusPx) {
                        applyBurnToMonster(neighbor, {
                            addStacks: 1,
                            burnMaxStacks: b.maxStacks,
                            burnFlatDps: b.flatDps,
                            burnPctMaxHp: b.pctMaxHp,
                            burnBossCapPerStack: b.bossCapPerStack,
                            burnDurationMs: 5000,
                            burnSpreadIntervalMs: b.spreadIntervalMs,
                            burnSpreadRadiusCells: b.spreadRadiusCells
                        }, b.sourceTower);
                    }
                }
            }

            while (b.tickAccMs >= 250 && m.hp > 0) {
                b.tickAccMs -= 250;
                const totalDps = getMonsterBurnDps(m);
                const tickDmg = Math.max(1, Math.round(totalDps * 0.25));
                const hpBefore = m.hp;
                m.hp = Math.max(0, hpBefore - tickDmg);
                if (AttackSys && b.sourceTower) {
                    AttackSys.recordTowerDamage(b.sourceTower, Math.min(hpBefore, tickDmg));
                }
                if (GameApp.renderer) {
                    GameApp.renderer.spawnDamageNumber(tickDmg, false, m.pixelX, m.pixelY, '🔥');
                }
                if (m.hp <= 0) {
                    handleMonsterKilled(m, b.sourceTower, tickDmg, { isDotKill: true });
                    return true; // 已死亡移除
                }
            }

            if (b.durationMs === 0) {
                b.stacks = 0;
                b.tickAccMs = 0;
                b.spreadTimerMs = 0;
            }
        }
        return false;
    }

    function updateMonsters(dtMs) {
        const dtSec = dtMs / 1000, st = G.state, wps = G.map.waypoints, Renderer = GameApp.renderer;
        const rules = getRules();
        const cc = getCombatConstants();
        if (st.isGameOver) return;
        if (st.baseHp <= 0) { G.callbacks.triggerGameOver(); return; }

        updateGroundHazards(dtMs);

        // 減速後移速下限鎖定為 0.30（總減速上限 70%）
        const minSpeedRatio = Number.isFinite(cc.MIN_SPEED_FLOOR_RATIO) ? cc.MIN_SPEED_FLOOR_RATIO : 0.30;
        const baseSpd = rules.MONSTER_BASE_SPEED ?? CONFIG.MONSTER_BASE_SPEED ?? 2.6;

        for (let i = st.monsters.length - 1; i >= 0; i--) {
            const m = st.monsters[i];
            if (!m || m.hp <= 0) continue;

            const killedByDot = tickMonsterStatusEffects(m, dtMs);
            if (killedByDot || m.hp <= 0) continue;

            const isRootedOrFrozen = (m.rootTimer || 0) > 0 || isMonsterFrozen(m);
            const effSlowRate = getMonsterEffectiveSlowRate(m);
            const slowMult = isRootedOrFrozen
                ? 0
                : Math.max(minSpeedRatio, 1 - effSlowRate);
            const safeSpeed = clampNumber(m.baseSpeed, 0.2, baseSpd * 10, baseSpd);
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
                m.isTargetable = false;
                const leakDmg = Math.max(1, m.baseDamage || 1);
                st.lastBreakerName = m.name || '';
                st.baseHp = Math.max(0, st.baseHp - leakDmg);

                if (GameApp.backend && typeof GameApp.backend.trackFeel === 'function') {
                    GameApp.backend.trackFeel(`Leak:${m.typeKey}:Wave_${st.currentWave}`, leakDmg, {
                        monsterType: m.typeKey,
                        monsterName: m.name,
                        wave: st.currentWave,
                        damage: leakDmg
                    });
                }

                if (G.dom.msgText) {
                    G.dom.msgText.innerText = m.isBoss
                        ? `💥 【${m.name}】突破防線！🌳 世界樹遭受重創 -${leakDmg} 生命！`
                        : `🚨 怪物【${m.name}】突破防線！🌳 世界樹受損 -${leakDmg} 生命！`;
                }
                st.monsters.splice(i, 1);
                Renderer.removeMonsterDom(m.id);
                if (st.baseHp <= 0) {
                    G.callbacks.triggerGameOver();
                    return;
                }
                Renderer.triggerWorldTreeShake();
                GameApp.audio.playOutcome('treeHit');
                G.callbacks.updateHUD();
                continue;
            }
            const pos = Renderer.getCellCenter(m.gridX, m.gridY);
            m.pixelX = pos.left + (m.visualOffsetX || 0);
            m.pixelY = pos.top + (m.visualOffsetY || 0);
        }
        Renderer.renderMonsterLayer();
    }

    const MonsterSystem = {
        bind,
        createInitialStatusState,
        ensureMonsterStatus,
        makeMonsterRecord,
        spawnMonsterFromEntry,
        spawnSplitMiniSlimes,
        getMonsterProgress,
        getMonsterProgressRatio,
        pullMonsterAlongPath,
        getMonsterEffectiveArmor,
        getMonsterEffectiveSlowRate,
        applySlowToMonster,
        isMonsterSlowed,
        isMonsterFrozen,
        isMonsterControlled,
        registerPermafrostHitAndTryFreeze,
        applyBurnToMonster,
        getMonsterBurnDps,
        applyGrievousWound,
        applyHealToMonster,
        applyShockToMonster,
        tryTriggerShockBonusDamage,
        applyVulnerabilityToMonster,
        getMonsterVulnerabilityMultiplier,
        applyArmorShred,
        spawnGroundHazard,
        updateGroundHazards,
        handleMonsterKilled,
        updateMonsters
    };

    GameApp.systems = GameApp.systems || {};
    GameApp.systems.monster = MonsterSystem;
    GameApp.systems.monsters = MonsterSystem;
})(window);
