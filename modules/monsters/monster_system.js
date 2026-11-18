/**
 * ============================================================================
 * 【檔案名稱】：modules/monsters/monster_system.js
 * 【負責功能】：統一管理戰場活體怪物名單（isTargetable 狀態）、怪物生成、沿 waypoints 轉彎移動、
 *               緩速／破甲／定身狀態倒數、分裂死亡事件與突破防線扣血結算。
 * 【讀取資料】：讀取 modules/monsters/monster_data.js、economy_system.js 與 tree_system.js。
 * 【常見修改入口】：
 *   1. 修改怪物沿路徑點移動或緩速保底規則：修改 updateMonsters()。
 *   2. 修改擊殺獎勵、分裂生成或餘燼爆炸：修改 handleMonsterKilled()、spawnSplitMiniSlimes()。
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

    function makeMonsterRecord(fields) {
        return {
            isTargetable: true,
            slowTimer: 0,
            slowRate: 0,
            armorShredTimer: 0,
            armorShredRate: 0,
            rootTimer: 0,
            rootVulnRate: 0,
            ...fields
        };
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

        // 自動解鎖怪物圖鑑
        if (GameApp.systems && GameApp.systems.codex && typeof GameApp.systems.codex.unlockEntry === 'function') {
            GameApp.systems.codex.unlockEntry(`monster:${entry.typeKey}`);
        }

        if (entry.isBoss) {
            const bossHp = Math.max(10, Math.round((entry.bossHp || 4200) * hpGlobal));
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
        const wps = G.map.waypoints;
        if (!wps || wps.length === 0) return 0;
        const wpIdx = Math.min(monster.wpIndex, wps.length - 1), wp = wps[wpIdx];
        return (G.map.waypointCumDist[wpIdx] || 0) + Math.hypot(monster.gridX - wp.x, monster.gridY - wp.y);
    }

    function getMonsterProgressRatio(monster) {
        const cum = G && G.map && G.map.waypointCumDist;
        const totalDist = (cum && cum.length > 0) ? cum[cum.length - 1] : 1;
        if (totalDist <= 0) return 0;
        return Math.max(0, Math.min(1, getMonsterProgress(monster) / totalDist));
    }

    function getMonsterEffectiveArmor(monster, armorPierce = 0) {
        const shredMult = monster.armorShredTimer > 0 ? (1 - (monster.armorShredRate || 0.30)) : 1.0;
        return Math.max(0, (monster.armor || 0) * shredMult * (1 - Math.max(0, Math.min(1, armorPierce))));
    }

    function applySlowToMonster(monster, slowRate, durationMs) {
        if (!monster || monster.hp <= 0 || monster.isTargetable === false) return;
        const rules = getRules();
        const maxSlowRate = 1 - (rules.MIN_SPEED_RATIO ?? 0.20);
        const clampedRate = Math.min(maxSlowRate, Math.max(0, slowRate));
        if (clampedRate >= (monster.slowTimer > 0 ? (monster.slowRate || 0.45) : 0)) {
            monster.slowRate = clampedRate;
            monster.slowTimer = Math.max(monster.slowTimer, durationMs);
        }
    }

    function applyArmorShred(monster, shredRate = 0.30, durationMs = 3000) {
        if (!monster || monster.hp <= 0 || monster.isTargetable === false) return;
        if (shredRate >= (monster.armorShredTimer > 0 ? (monster.armorShredRate || 0) : 0)) {
            monster.armorShredRate = shredRate;
            monster.armorShredTimer = Math.max(monster.armorShredTimer, durationMs);
        }
    }

    function handleMonsterKilled(monster, killerTowerObj, killingDamage, options = {}) {
        const st = G.state;
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

        // 若為魔王擊殺，記錄 Boss:KillProgress 路徑推進百分比
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
        } else if (killGold > 0 && !options.isEmberSplash) {
            G.dom.msgText.innerText = `💥 擊殺【${monster.name}】！獲得 +${killGold} 💰${dewGain > 0 ? `、+${dewGain} 💧` : ''}！`;
        }

        if (!options.isEmberSplash && TreeSys && typeof TreeSys.tryTriggerEmberExplosion === 'function') {
            TreeSys.tryTriggerEmberExplosion(monster.pixelX, monster.pixelY, killerTowerObj, killingDamage);
        }
        G.callbacks.updateHUD();
    }

    function updateMonsters(dtMs) {
        const dtSec = dtMs / 1000, st = G.state, wps = G.map.waypoints, Renderer = GameApp.renderer;
        const rules = getRules();
        if (st.isGameOver) return;
        if (st.baseHp <= 0) { G.callbacks.triggerGameOver(); return; }

        const minSpeedRatio = rules.MIN_SPEED_RATIO ?? 0.20;
        const baseSpd = rules.MONSTER_BASE_SPEED ?? CONFIG.MONSTER_BASE_SPEED ?? 2.6;

        for (let i = st.monsters.length - 1; i >= 0; i--) {
            const m = st.monsters[i];
            if (m.slowTimer > 0 && (m.slowTimer = Math.max(0, m.slowTimer - dtMs)) === 0) m.slowRate = 0;
            if (m.armorShredTimer > 0 && (m.armorShredTimer = Math.max(0, m.armorShredTimer - dtMs)) === 0) m.armorShredRate = 0;
            if ((m.rootTimer || 0) > 0 && (m.rootTimer = Math.max(0, m.rootTimer - dtMs)) === 0) m.rootVulnRate = 0;

            const slowMult = (m.rootTimer || 0) > 0
                ? 0
                : Math.max(minSpeedRatio, 1 - (m.slowTimer > 0 ? (m.slowRate || 0.45) : 0));
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
        makeMonsterRecord,
        spawnMonsterFromEntry,
        spawnSplitMiniSlimes,
        getMonsterProgress,
        getMonsterProgressRatio,
        getMonsterEffectiveArmor,
        applySlowToMonster,
        applyArmorShred,
        handleMonsterKilled,
        updateMonsters
    };

    GameApp.systems = GameApp.systems || {};
    GameApp.systems.monster = MonsterSystem;
    GameApp.systems.monsters = MonsterSystem;
})(window);
