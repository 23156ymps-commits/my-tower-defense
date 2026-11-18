/**
 * ============================================================================
 * 【檔案名稱】：modules/tree/tree_system.js
 * 【負責功能】：處理靈露能量累積、世界樹主動技能施放（根鬚纏繞／自然狂熱）、
 *               每 3 波動態掃描祝福卡池三選一抽取，以及全局被動祝福增益計算。
 * 【讀取資料】：讀取 modules/tree/tree_data.js 與 modules/towers/tower_data.js。
 * 【常見修改入口】：
 *   1. 修改主動技能效果：修改 castEntangleSkill()、castFrenzySkill()。
 *   2. 修改三選一祝福抽卡與套用邏輯：修改 triggerBlessingSelection()、selectBlessing()。
 * ============================================================================
 */
(function (global) {
    'use strict';

    const GameApp = global.GameApp = global.GameApp || {};
    const { indexToCoords } = GameApp.helpers || {};

    let G = null;
    function bind(ctx) { G = ctx; }

    function getTreeData() {
        return (GameApp.data && GameApp.data.tree) || {};
    }

    function getTreeConfig() {
        return getTreeData().TREE_CONFIG || {};
    }

    function getTowersDict() {
        return (GameApp.data && GameApp.data.towers && GameApp.data.towers.TOWERS) || {};
    }

    function hasBlessing(blessingId) {
        return Boolean(G && G.state && G.state.activeBlessings && G.state.activeBlessings.has(blessingId));
    }

    function towerHasLineage(towerType, lineageTag) {
        const tCfg = getTowersDict()[towerType];
        if (!tCfg) return towerType === lineageTag;
        if (Array.isArray(tCfg.lineageTags)) return tCfg.lineageTags.includes(lineageTag);
        return tCfg.elementTag === lineageTag || towerType === lineageTag;
    }

    function getIceLineageSlowParams(towerType, baseRate, baseDurationMs) {
        const tc = getTreeConfig();
        if (!towerHasLineage(towerType, 'ice') || !hasBlessing('winter_bloodline')) {
            return { rate: baseRate, durationMs: baseDurationMs };
        }
        return {
            rate: Math.min(tc.BLESSING_WINTER_SLOW_CAP || 0.75, baseRate + (tc.BLESSING_WINTER_SLOW_BONUS || 0.12)),
            durationMs: baseDurationMs > 0
                ? baseDurationMs + (tc.BLESSING_WINTER_DURATION_BONUS_MS || 500)
                : (tc.BLESSING_WINTER_STEAM_CHILL_MS || 2000)
        };
    }

    function getThunderChainBonus(towerType) {
        const tc = getTreeConfig();
        return (towerHasLineage(towerType, 'thunder') && hasBlessing('thunder_conduction'))
            ? (tc.BLESSING_THUNDER_EXTRA_TARGETS || 1)
            : 0;
    }

    function getTowerBlessingSpeedMult(towerType) {
        const tc = getTreeConfig();
        if (hasBlessing('thunder_conduction') && towerHasLineage(towerType, 'thunder')) {
            return 1 + (tc.BLESSING_THUNDER_SPEED_BONUS || 0.15);
        }
        return 1.0;
    }

    function getGlobalBlessingDamageMult() {
        const tc = getTreeConfig();
        return hasBlessing('thorn_bulwark') ? (1 + (tc.BLESSING_THORN_GLOBAL_DMG || 0.12)) : 1.0;
    }

    function getNearTreeVulnerabilityBonus(monster) {
        if (!hasBlessing('thorn_bulwark') || !G || !G.map || !G.map.waypoints.length) return 0;
        const tc = getTreeConfig();
        const treeWp = G.map.waypoints[G.map.waypoints.length - 1];
        const dist = Math.hypot((Number.isFinite(monster.gridX) ? monster.gridX : 0) - treeWp.x, (Number.isFinite(monster.gridY) ? monster.gridY : 0) - treeWp.y);
        return dist <= (tc.BLESSING_THORN_TREE_RADIUS_CELLS || 2.5) ? (tc.BLESSING_THORN_NEAR_TREE_DMG || 0.10) : 0;
    }

    function computeKillDewGain(monster) {
        if (!monster || monster.isSplitChild) return 0;
        const tc = getTreeConfig();
        const monsterDb = (GameApp.data && GameApp.data.monsters && GameApp.data.monsters.MONSTER_DATABASE) || {};
        const mCfg = monsterDb[monster.typeKey] || {};
        const isSpec = Boolean(mCfg.isSpecialMechanic);

        let dew = monster.isBoss
            ? (tc.DEW_GAIN_BOSS || 30)
            : (isSpec ? (tc.DEW_GAIN_SPECIAL || 8) : (tc.DEW_GAIN_NORMAL || 4));
        if (hasBlessing('life_nectar')) {
            dew = Math.round(dew * (1 + (tc.BLESSING_DEW_GAIN_BONUS || 0.25)));
        }
        return dew;
    }

    function tryTriggerEmberExplosion(originX, originY, killerTowerObj, killingDamage) {
        if (!hasBlessing('searing_embers') || !killerTowerObj || !towerHasLineage(killerTowerObj.type, 'fire') || killingDamage <= 0) {
            return;
        }
        const tc = getTreeConfig();
        const Renderer = GameApp.renderer;
        const AttackSys = GameApp.systems && GameApp.systems.towerAttack;
        const MonsterSys = GameApp.systems && GameApp.systems.monster;

        const emberDmg = Math.max(1, Math.round(killingDamage * (tc.BLESSING_EMBER_DAMAGE_RATIO || 0.25)));
        const emberRadiusPx = (tc.BLESSING_EMBER_RADIUS_CELLS || 1.0) * G.boardMetrics.step;
        Renderer.emitRingFX(originX, originY, emberRadiusPx, '#f97316', 0.28, 260);
        Renderer.emitParticleBurst(originX, originY, '#fb923c', 10, 95);

        const victims = G.state.monsters.filter(m =>
            m.hp > 0 && m.isTargetable !== false && Math.hypot(m.pixelX - originX, m.pixelY - originY) <= emberRadiusPx
        );
        for (let i = 0; i < victims.length; i++) {
            const v = victims[i];
            if (v.hp <= 0) continue;
            const hpBefore = v.hp;
            v.hp = Math.max(0, hpBefore - emberDmg);
            if (AttackSys) AttackSys.recordTowerDamage(killerTowerObj, Math.min(hpBefore, emberDmg));
            Renderer.spawnDamageNumber(emberDmg, false, v.pixelX, v.pixelY, '🔥');
            if (v.hp <= 0 && MonsterSys) {
                MonsterSys.handleMonsterKilled(v, killerTowerObj, emberDmg, { isEmberSplash: true });
            }
        }
    }

    /**
     * 主動技能 1：根鬚纏繞（全場敵人定身 2.5s + 易傷 20%）
     */
    function castEntangleSkill() {
        const st = G.state;
        const skills = getTreeData().ACTIVE_SKILLS || {};
        const entCfg = skills.entangle || { cost: 40, cdMs: 8000, durationMs: 2500, vulnBonus: 0.20 };
        if (!G.callbacks.isGameplayActive() || st.entangleCdMs > 0) return false;
        if (st.monsters.length === 0) {
            G.dom.msgText.innerText = '場上目前沒有敵人，無需施放根鬚纏繞。';
            return false;
        }
        if (st.dewEnergy < entCfg.cost) {
            G.dom.msgText.innerText = `靈露不足，需要 ${entCfg.cost} 靈露才能施放根鬚纏繞。`;
            return false;
        }
        st.dewEnergy -= entCfg.cost;
        st.entangleCdMs = entCfg.cdMs;

        const Renderer = GameApp.renderer;
        for (let i = 0; i < st.monsters.length; i++) {
            const m = st.monsters[i];
            if (m.hp <= 0) continue;
            m.rootTimer = Math.max(m.rootTimer || 0, entCfg.durationMs);
            m.rootVulnRate = Math.max(m.rootVulnRate || 0, entCfg.vulnBonus);
            Renderer.emitParticleBurst(m.pixelX, m.pixelY, '#4E9A68', 10, 95);
            Renderer.emitRingFX(m.pixelX, m.pixelY, Math.max(18, G.boardMetrics.cellW * 0.72), '#4E9A68', 0.28, 420);
        }
        const lastWp = G.map.waypoints[G.map.waypoints.length - 1];
        const tp = Renderer.getCellCenter(lastWp.x, lastWp.y);
        Renderer.emitRingFX(tp.left, tp.top, G.boardMetrics.step * 3.2, '#4E9A68', 0.18, 480);

        GameApp.audio.playMagic('entangle');
        G.dom.msgText.innerText = '施放「根鬚纏繞」：全場敵人定身 2.5 秒且易傷 +20%。';
        if (GameApp.backend && typeof GameApp.backend.trackFeel === 'function') {
            GameApp.backend.recordPlayerAction();
            GameApp.backend.trackFeel('Tree:SkillCast:entangle', st.currentWave, { skillId: 'entangle', wave: st.currentWave });
        }
        Renderer.renderMonsterLayer();
        G.callbacks.updateHUD();
        return true;
    }

    /**
     * 主動技能 2：自然狂熱（全場防禦塔攻速 +35% 持續 5s）
     */
    function castFrenzySkill() {
        const st = G.state;
        const skills = getTreeData().ACTIVE_SKILLS || {};
        const frzCfg = skills.frenzy || { cost: 60, cdMs: 12000, durationMs: 5000, speedBonus: 0.35 };
        if (!G.callbacks.isGameplayActive()) return false;
        if (st.frenzyActiveMs > 0) {
            G.dom.msgText.innerText = '自然狂熱效果持續中，無法重複施放。';
            return false;
        }
        if (st.frenzyCdMs > 0) return false;
        if (st.dewEnergy < frzCfg.cost) {
            G.dom.msgText.innerText = `靈露不足，需要 ${frzCfg.cost} 靈露才能施放自然狂熱。`;
            return false;
        }
        st.dewEnergy -= frzCfg.cost;
        st.frenzyActiveMs = frzCfg.durationMs;
        st.frenzyCdMs = frzCfg.cdMs;

        const Renderer = GameApp.renderer;
        for (let idx = 0; idx < st.board.length; idx++) {
            if (!st.board[idx]) continue;
            const c = indexToCoords(idx), pos = Renderer.getCellCenter(c.x, c.y);
            Renderer.emitParticleBurst(pos.left, pos.top, '#E0B43C', 8, 70);
            Renderer.emitRingFX(pos.left, pos.top, Math.max(16, G.boardMetrics.cellW * 0.65), '#D97724', 0.24, 360);
            if (G.towerElements[idx]) G.towerElements[idx].classList.add('frenzy-active');
        }
        GameApp.audio.playMagic('frenzy');
        G.dom.msgText.innerText = '施放「自然狂熱」：全場防禦塔攻速提升 +35%，持續 5.0 秒。';
        if (GameApp.backend && typeof GameApp.backend.trackFeel === 'function') {
            GameApp.backend.recordPlayerAction();
            GameApp.backend.trackFeel('Tree:SkillCast:frenzy', st.currentWave, { skillId: 'frenzy', wave: st.currentWave });
        }
        G.callbacks.updateHUD();
        return true;
    }

    /**
     * 透過 Object.keys() 動態掃描 BLESSINGS_MAP 抽取 3 張未獲得的祝福卡
     */
    function triggerBlessingSelection(clearedWave) {
        const blessingsMap = getTreeData().BLESSINGS_MAP || {};
        const allKeys = Object.keys(blessingsMap);
        const pool = allKeys
            .map(k => blessingsMap[k])
            .filter(b => b && !G.state.activeBlessings.has(b.id));

        for (let i = pool.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [pool[i], pool[j]] = [pool[j], pool[i]];
        }
        const choices = pool.slice(0, Math.min(3, pool.length));
        if (choices.length === 0) return false;

        const st = G.state;
        st.blessingGrantedWaves.add(clearedWave);
        st.blessingChoices = choices;
        st.isPaused = false;
        st.waveState = 'BLESSING_SELECT';
        if (st.rafId !== null) { cancelAnimationFrame(st.rafId); st.rafId = null; }
        GameApp.renderer.clearTouchDragVisuals();
        st.draggedIndex = null;
        st.hoveredIndex = null;
        GameApp.renderer.updateRangeIndicator();

        if (G.dom.blessingWaveSubtitleEl) {
            G.dom.blessingWaveSubtitleEl.innerText = `第 ${clearedWave} 波捷報！世界樹賜予枝枒祝福，請擇一強化防線`;
        }
        if (G.dom.blessingChoicesEl) {
            G.dom.blessingChoicesEl.innerHTML = '';
            choices.forEach(b => {
                const card = document.createElement('button');
                card.type = 'button';
                card.className = 'blessing-choice-btn';
                card.dataset.blessingId = b.id;
                card.innerHTML = `<span class="blessing-choice-icon">${b.icon}</span><span class="blessing-choice-title">${b.name}</span><span class="blessing-choice-desc">${b.desc}</span>`;
                card.addEventListener('click', () => selectBlessing(b.id));
                G.dom.blessingChoicesEl.appendChild(card);
            });
        }
        if (G.dom.blessingOverlayEl) G.dom.blessingOverlayEl.classList.remove('hidden');
        GameApp.audio.playMagic('blessing');
        G.callbacks.updateHUD();
        return true;
    }

    function selectBlessing(blessingId) {
        const st = G.state;
        if (st.waveState !== 'BLESSING_SELECT') return;
        const blessingsMap = getTreeData().BLESSINGS_MAP || {};
        const picked = blessingsMap[blessingId];
        if (!picked || st.activeBlessings.has(blessingId)) return;

        const tc = getTreeConfig();
        const intermissionMs = (GameApp.config && GameApp.config.WAVE_INTERMISSION_MS) || 4000;
        st.activeBlessings.add(blessingId);
        st.blessingChoices = [];
        if (G.dom.blessingOverlayEl) G.dom.blessingOverlayEl.classList.add('hidden');

        if (blessingId === 'abundant_seed') {
            st.seedPityCount = 0;
        } else if (blessingId === 'life_nectar') {
            st.baseHp = Math.min(tc.INITIAL_BASE_HP || 20, st.baseHp + (tc.BLESSING_LIFE_HEAL || 4));
        }

        if (GameApp.backend && typeof GameApp.backend.trackFeel === 'function') {
            GameApp.backend.recordPlayerAction();
            GameApp.backend.trackFeel(`Tree:BlessingPick:${blessingId}`, st.currentWave, {
                blessingId,
                blessingName: picked.name,
                wave: st.currentWave
            });
        }

        st.waveState = 'INTERMISSION';
        st.waveTimerMs = intermissionMs;
        G.dom.msgText.innerText = `🌳 已獲得祝福【${picked.icon} ${picked.name}】！下一波將於 ${Math.ceil(intermissionMs / 1000)} 秒後到來！`;
        GameApp.audio.playMagic('blessing');
        G.callbacks.updateHUD();
        G.callbacks.startMainLoop();
    }

    const TreeSystem = {
        bind,
        hasBlessing,
        towerHasLineage,
        getIceLineageSlowParams,
        getThunderChainBonus,
        getTowerBlessingSpeedMult,
        getGlobalBlessingDamageMult,
        getNearTreeVulnerabilityBonus,
        computeKillDewGain,
        tryTriggerEmberExplosion,
        castEntangleSkill,
        castFrenzySkill,
        triggerBlessingSelection,
        selectBlessing
    };

    GameApp.systems = GameApp.systems || {};
    GameApp.systems.tree = TreeSystem;
})(window);
