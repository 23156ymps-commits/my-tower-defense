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

    function resolveTowerFamily(towerType) {
        const tCfg = getTowersDict()[towerType];
        if (tCfg) return tCfg.family || tCfg.elementTag || towerType;
        return String(towerType || '').replace(/_(bud|trunk|A|B)$/, '');
    }

    function getIceLineageSlowParams(towerType, baseRate, baseDurationMs) {
        return { rate: baseRate, durationMs: baseDurationMs };
    }

    function getThunderChainBonus() {
        return 0;
    }

    function getTowerBlessingSpeedMult() {
        return 1.0;
    }

    function getGlobalBlessingDamageMult() {
        return 1.0;
    }

    function getNearTreeVulnerabilityBonus() {
        return 0;
    }

    function computeKillDewGain(monster) {
        if (!monster || monster.isSplitChild) return 0;
        const tc = getTreeConfig();
        const monsterDb = (GameApp.data && GameApp.data.monsters && GameApp.data.monsters.MONSTER_DATABASE) || {};
        const mCfg = monsterDb[monster.typeKey] || {};
        const isSpec = Boolean(mCfg.isSpecialMechanic);

        const rawGain = monster.isBoss
            ? (tc.DEW_GAIN_BOSS || 30)
            : (isSpec ? (tc.DEW_GAIN_SPECIAL || 8) : (tc.DEW_GAIN_NORMAL || 4));
        const hasDrought = Boolean(G && G.state && G.state.activeContracts && G.state.activeContracts.has('dew_drought'));
        return hasDrought ? Math.max(1, Math.round(rawGain * 0.80)) : rawGain;
    }

    /**
     * 🔮 元素共鳴：記錄攻擊元素並檢查目標身上是否同時有 >= 2 種不同元素攻擊，若是回傳 1.25x
     */
    function registerResonanceHit(towerObj, monster) {
        if (!towerObj || !monster || monster.hp <= 0) return;
        const MonsterSys = GameApp.systems && GameApp.systems.monster;
        const status = MonsterSys && typeof MonsterSys.ensureMonsterStatus === 'function'
            ? MonsterSys.ensureMonsterStatus(monster)
            : monster.status;
        if (!status) return;
        if (!status.resonanceElements) status.resonanceElements = {};
        const tc = getTreeConfig();
        const elemKey = resolveTowerFamily(towerObj.type);
        status.resonanceElements[elemKey] = tc.BLESSING_RESONANCE_WINDOW_MS || 2500;
    }

    function getElementalResonanceMult(towerObj, monster) {
        if (!hasBlessing('elemental_resonance') || !monster || !monster.status || !monster.status.resonanceElements) {
            return 1.0;
        }
        const tc = getTreeConfig();
        const elemMap = monster.status.resonanceElements;
        let activeCount = 0;
        const keys = Object.keys(elemMap);
        for (let i = 0; i < keys.length; i++) {
            if (elemMap[keys[i]] > 0) activeCount++;
        }
        if (towerObj) {
            const incoming = resolveTowerFamily(towerObj.type);
            if (!elemMap[incoming] || elemMap[incoming] <= 0) {
                activeCount++;
            }
        }
        return activeCount >= 2 ? (1 + (tc.BLESSING_RESONANCE_DMG_BONUS || 0.25)) : 1.0;
    }

    /**
     * ⚡ 連鎖風暴：連鎖閃電或彈射擊殺敵人時，額外多彈跳 2 次
     */
    function getChainStormExtraBounces() {
        if (!hasBlessing('chain_storm')) return 0;
        const tc = getTreeConfig();
        return tc.BLESSING_CHAIN_STORM_EXTRA_BOUNCES || 2;
    }

    function getChainStormRadiusCells() {
        const tc = getTreeConfig();
        return tc.BLESSING_CHAIN_STORM_RADIUS_CELLS || 2.6;
    }

    /**
     * ❄️ 極寒碎冰：減速或凍結目標血量低於 15% 時，受到冰系／蒸氣／磁環攻擊直接碎裂處決
     */
    function shouldGlacialShatter(towerObj, monster) {
        if (!hasBlessing('glacial_shatter') || !towerObj || !monster || monster.hp <= 0) return false;
        const family = resolveTowerFamily(towerObj.type);
        if (family !== 'ice' && family !== 'steam' && family !== 'magnet') return false;
        const MonsterSys = GameApp.systems && GameApp.systems.monster;
        const isSlowedOrFrozen = MonsterSys
            ? (MonsterSys.isMonsterSlowed(monster) || MonsterSys.isMonsterFrozen(monster))
            : ((monster.slowTimer || 0) > 0);
        if (!isSlowedOrFrozen) return false;
        const tc = getTreeConfig();
        const threshold = tc.BLESSING_GLACIAL_SHATTER_HP_PCT || 0.15;
        return (monster.hp / Math.max(1, monster.maxHp)) < threshold;
    }

    /**
     * 🔥 焦土烙印：火系與蒸氣塔觸發破甲或暴擊時，在目標腳下留下 2.5 秒燃燒路徑 (22 點/秒)
     */
    function trySpawnScorchedBrand(towerObj, monster, didShredOrCrit) {
        if (!hasBlessing('scorched_brand') || !towerObj || !monster || !didShredOrCrit) return false;
        const family = resolveTowerFamily(towerObj.type);
        if (family !== 'fire' && family !== 'steam') return false;
        if ((monster._scorchBrandIcdMs || 0) > 0) return false;

        const MonsterSys = GameApp.systems && GameApp.systems.monster;
        if (!MonsterSys || typeof MonsterSys.spawnGroundHazard !== 'function' || !G || !G.boardMetrics) return false;

        const tc = getTreeConfig();
        monster._scorchBrandIcdMs = 350;
        if (Array.isArray(G.state.groundHazards) && G.state.groundHazards.length >= 28) {
            const oldIdx = G.state.groundHazards.findIndex(h => h.type === 'scorch_trail');
            if (oldIdx !== -1) G.state.groundHazards.splice(oldIdx, 1);
        }
        MonsterSys.spawnGroundHazard({
            type: 'scorch_trail',
            x: monster.pixelX,
            y: monster.pixelY,
            radiusPx: (tc.BLESSING_SCORCH_RADIUS_CELLS || 0.75) * G.boardMetrics.step,
            dps: tc.BLESSING_SCORCH_DPS || 22,
            durationMs: tc.BLESSING_SCORCH_DURATION_MS || 2500,
            sourceTower: towerObj
        });
        return true;
    }

    /**
     * 💧 靈露超載：施放世界樹主動技能後 3 秒內，全場防禦塔 40% 機率雙重射擊
     */
    function activateDewOverchargeIfUnlocked() {
        if (!G || !G.state || !hasBlessing('dew_overcharge')) return false;
        const tc = getTreeConfig();
        G.state.dewOverchargeMs = tc.BLESSING_DEW_OVERCHARGE_DUR_MS || 3000;
        return true;
    }

    function shouldTriggerDewOvercharge() {
        if (!G || !G.state || G.state.dewOverchargeMs <= 0 || !hasBlessing('dew_overcharge')) return false;
        const tc = getTreeConfig();
        return Math.random() < (tc.BLESSING_DEW_OVERCHARGE_CHANCE || 0.40);
    }

    function tryTriggerEmberExplosion() {
        return;
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
        const overcharged = activateDewOverchargeIfUnlocked();
        G.dom.msgText.innerText = overcharged
            ? '施放「根鬚纏繞」：全場敵人定身 2.5 秒且易傷 +20%，並觸發 3 秒靈露超載。'
            : '施放「根鬚纏繞」：全場敵人定身 2.5 秒且易傷 +20%。';
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
        const overcharged = activateDewOverchargeIfUnlocked();
        G.dom.msgText.innerText = overcharged
            ? '施放「自然狂熱」：全場攻速 +35% 持續 5.0 秒，並觸發 3 秒靈露超載。'
            : '施放「自然狂熱」：全場防禦塔攻速提升 +35%，持續 5.0 秒。';
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
        const baseIntermissionMs = (GameApp.config && GameApp.config.WAVE_INTERMISSION_MS) || 4000;
        const intermissionMs = (st.activeContracts && st.activeContracts.has('rapid_waves'))
            ? Math.round(baseIntermissionMs * 0.5)
            : baseIntermissionMs;
        st.activeBlessings.add(blessingId);
        st.blessingChoices = [];
        if (G.dom.blessingOverlayEl) G.dom.blessingOverlayEl.classList.add('hidden');

        if (blessingId === 'abundant_seed') {
            st.seedPityCount = 0;
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
        G.dom.msgText.innerText = `已獲得祝福【${picked.icon} ${picked.name}】，下一波將於 ${Math.ceil(intermissionMs / 1000)} 秒後到來。`;
        GameApp.audio.playMagic('blessing');
        G.callbacks.updateHUD();
        G.callbacks.startMainLoop();
    }

    const TreeSystem = {
        bind,
        hasBlessing,
        towerHasLineage,
        resolveTowerFamily,
        getIceLineageSlowParams,
        getThunderChainBonus,
        getTowerBlessingSpeedMult,
        getGlobalBlessingDamageMult,
        getNearTreeVulnerabilityBonus,
        computeKillDewGain,
        registerResonanceHit,
        getElementalResonanceMult,
        getChainStormExtraBounces,
        getChainStormRadiusCells,
        shouldGlacialShatter,
        trySpawnScorchedBrand,
        activateDewOverchargeIfUnlocked,
        shouldTriggerDewOvercharge,
        tryTriggerEmberExplosion,
        castEntangleSkill,
        castFrenzySkill,
        triggerBlessingSelection,
        selectBlessing
    };

    GameApp.systems = GameApp.systems || {};
    GameApp.systems.tree = TreeSystem;
})(window);
