// ==================== 1. 遊戲主控與 UI 互動層：引用五大模組 ====================
const {
    CONFIG, ELEMENT_CONFIG, BASE_ELEMENT_TYPES, BLESSINGS_CATALOG,
    TARGET_MODE_CYCLE, TARGET_MODE_LABELS, TERRAIN_CONFIG, WAVE_BALANCE,
    MONSTER_DATABASE, MAPS_CONFIG, clampNumber, indexToCoords
} = window.GameConfig;

const SoundEngine = window.GameAudio;
const Backend = window.GameBackend;
const { GameAnalyticsTracker } = Backend;
const Renderer = window.GameRenderer;
const Combat = window.GameCombat;

// ==================== 2. DOM 快取與共享執行狀態 ====================
const DOM_ID_PAIRS = [
    ['boardStageEl', 'board-stage'], ['boardElement', 'grid-board'], ['monsterLayerEl', 'monster-layer'],
    ['fxCanvasEl', 'fx-canvas'], ['floatingLayerEl', 'floating-layer'], ['bossStatusBarEl', 'boss-status-bar'],
    ['bossBannerTitleEl', 'boss-banner-title'], ['bossBannerHpTextEl', 'boss-banner-hp-text'], ['bossBannerHpFillEl', 'boss-banner-hp-fill'],
    ['rangeCircleEl', 'range-circle'], ['spawnerContainer', 'element-spawner-container'],
    ['inspectorEmptyEl', 'inspector-empty'], ['inspectorActiveEl', 'inspector-active'], ['inspectorNameEl', 'inspector-name'],
    ['inspectorDpsEl', 'inspector-dps'], ['inspectorRangeEl', 'inspector-range'], ['inspectorTerrainEl', 'inspector-terrain'],
    ['inspectorTargetBtn', 'inspector-target-btn'], ['inspectorSellBtn', 'inspector-sell-btn'],
    ['codexBtn', 'codex-btn'], ['codexOverlayEl', 'codex-overlay'], ['codexCloseBtn', 'codex-close-btn'],
    ['blessingOverlayEl', 'blessing-overlay'], ['blessingWaveSubtitleEl', 'blessing-wave-subtitle'], ['blessingChoicesEl', 'blessing-choices'],
    ['skillEntangleBtn', 'skill-entangle-btn'], ['skillFrenzyBtn', 'skill-frenzy-btn'], ['pauseBtn', 'pause-btn'], ['soundBtn', 'sound-btn'],
    ['pauseBannerEl', 'pause-banner'],
    ['addGoldBtn', 'add-gold-btn'], ['clearGoldBtn', 'clear-gold-btn'], ['nextWaveBtn', 'next-wave-btn'], ['speedBtn', 'speed-btn'],
    ['goldDisplay', 'gold-display'], ['baseHpDisplay', 'base-hp-display'], ['dewDisplay', 'dew-display'], ['dewBarFillEl', 'dew-bar-fill'],
    ['waveDisplay', 'wave-display'], ['wavePhaseTagEl', 'wave-phase-tag'], ['bestWaveDisplay', 'best-wave-display'], ['msgText', 'msg-text'],
    ['startOverlayEl', 'start-overlay'], ['mapSelectorGridEl', 'map-selector-grid'], ['mapRecordForestEl', 'map-record-forest'],
    ['mapRecordLavaEl', 'map-record-lava'], ['startGameBtn', 'start-game-btn'],
    ['victoryOverlayEl', 'victory-overlay'], ['victoryStarsEl', 'victory-stars'], ['victoryRankTextEl', 'victory-rank-text'],
    ['victoryMapTextEl', 'victory-map-text'], ['victoryKillsTextEl', 'victory-kills-text'], ['victoryHpTextEl', 'victory-hp-text'],
    ['victoryGoldTextEl', 'victory-gold-text'], ['victoryMvpTextEl', 'victory-mvp-text'], ['victoryGoldEarnedTextEl', 'victory-gold-earned-text'],
    ['victoryFusionTextEl', 'victory-fusion-text'], ['victoryRestartBtn', 'victory-restart-btn'], ['victoryMenuBtn', 'victory-menu-btn'], ['endlessBtn', 'endless-btn'],
    ['gameOverOverlayEl', 'game-over-overlay'], ['gameoverMapTextEl', 'gameover-map-text'], ['finalWaveTextEl', 'final-wave-text'],
    ['finalBestTextEl', 'final-best-text'], ['finalKillsTextEl', 'final-kills-text'], ['gameoverMvpTextEl', 'gameover-mvp-text'],
    ['gameoverGoldEarnedTextEl', 'gameover-gold-earned-text'], ['gameoverFusionTextEl', 'gameover-fusion-text'],
    ['gameoverBreakerRowEl', 'gameover-breaker-row'], ['gameoverBreakerTextEl', 'gameover-breaker-text'],
    ['newRecordBadgeEl', 'new-record-badge'], ['restartBtn', 'restart-btn'], ['gameoverMenuBtn', 'gameover-menu-btn'],
    ['forecastCurrentHeaderEl', 'forecast-current-header'], ['forecastCurrentListEl', 'forecast-current-list'],
    ['forecastNextHeaderEl', 'forecast-next-header'], ['forecastNextListEl', 'forecast-next-list']
];

function buildDomCache() {
    const dom = {};
    for (let i = 0; i < DOM_ID_PAIRS.length; i++) {
        dom[DOM_ID_PAIRS[i][0]] = document.getElementById(DOM_ID_PAIRS[i][1]);
    }
    dom.fxCtx = dom.fxCanvasEl && typeof dom.fxCanvasEl.getContext === 'function' ? dom.fxCanvasEl.getContext('2d') : null;
    dom.hpHudEl = dom.baseHpDisplay ? dom.baseHpDisplay.closest('.hud-hp') : null;
    dom.skillEntangleMask = dom.skillEntangleBtn ? dom.skillEntangleBtn.querySelector('.skill-cd-mask') : null;
    dom.skillEntangleDewBar = dom.skillEntangleBtn ? dom.skillEntangleBtn.querySelector('.skill-dew-bar') : null;
    dom.skillEntangleLabel = dom.skillEntangleBtn ? dom.skillEntangleBtn.querySelector('.skill-label') : null;
    dom.skillEntangleSub = dom.skillEntangleBtn ? dom.skillEntangleBtn.querySelector('.skill-sub') : null;
    dom.skillFrenzyMask = dom.skillFrenzyBtn ? dom.skillFrenzyBtn.querySelector('.skill-cd-mask') : null;
    dom.skillFrenzyDewBar = dom.skillFrenzyBtn ? dom.skillFrenzyBtn.querySelector('.skill-dew-bar') : null;
    dom.skillFrenzyLabel = dom.skillFrenzyBtn ? dom.skillFrenzyBtn.querySelector('.skill-label') : null;
    dom.skillFrenzySub = dom.skillFrenzyBtn ? dom.skillFrenzyBtn.querySelector('.skill-sub') : null;
    dom.spawnerBtns = {};
    dom.seedPityBadgeEl = null;
    return dom;
}

function createInitialMatchState(mapId = 'forest', initialWaveState = 'WAITING_START', nextSessionId = 1, keepSpeed = 1) {
    const spec = MAPS_CONFIG[mapId] || MAPS_CONFIG.forest;
    return {
        currentMapId: spec.id,
        currentGold: CONFIG.INITIAL_GOLD + (spec.startGoldBonus || 0),
        baseHp: CONFIG.INITIAL_BASE_HP,
        dewEnergy: CONFIG.DEW_INITIAL,
        entangleCdMs: 0, frenzyCdMs: 0, frenzyActiveMs: 0,
        activeBlessings: new Set(), blessingGrantedWaves: new Set(), blessingChoices: [],
        seedPityCount: 0, treeHitShakeTimer: null,
        bestWave: Backend.getMapBestWave(spec.id), currentWave: 1, killsCount: 0,
        towerUidCounter: 1, totalTeamDamage: 0, totalGoldEarned: 0, fusionCount: 0,
        peakTowerSnapshot: null, lastBreakerName: '',
        isPaused: false, pausedBeforeCodex: false, isGameOver: false, isEndlessMode: false, isNewRecordThisRun: false,
        gameSpeed: keepSpeed,
        spawnCounts: { fire: 0, ice: 0, thunder: 0 },
        board: Array(CONFIG.BOARD_SIZE).fill(null), monsters: [], monsterIdCounter: 1,
        selectedIndex: null, buildTargetIndex: null, hoveredIndex: null, draggedIndex: null,
        lastRenderedSelected: null, lastRenderedBuildTarget: null,
        isTouchMode: false, touchDragState: null, lastTouchDragEndTime: 0,
        sessionId: nextSessionId, activeTimers: new Set(), pendingBolts: [], towerPhaseSeq: 0,
        waveState: initialWaveState, waveTimerMs: CONFIG.INITIAL_PREP_MS,
        waveSpawnQueue: [], waveSpawnIntervalMs: WAVE_BALANCE.SPAWN_INTERVAL_BASE_MS, waveSpawnAccMs: 0,
        lastFrameTime: null, rafId: null
    };
}

const G = {
    dom: buildDomCache(),
    state: createInitialMatchState('forest', 'WAITING_START', 1, 1),
    map: {
        waypoints: [], startCellIndex: 0, endCellIndex: CONFIG.BOARD_SIZE - 1,
        pathCellIndices: new Set(), cellPathDist: new Float32Array(CONFIG.BOARD_SIZE),
        terrainMap: new Map(), waypointCumDist: [0], pathFlowArrows: new Map()
    },
    boardMetrics: { originX: 8, originY: 8, cellW: 34, cellH: 34, stepX: 37, stepY: 37, step: 37, stageW: 560, stageH: 380 },
    cellElements: [],
    towerElements: Array(CONFIG.BOARD_SIZE).fill(null),
    monsterDomMap: new Map(),
    fxEntities: { projectiles: [], bolts: [], beams: [], rings: [], particles: [], flashes: [], leaves: [], leafEmitAccMs: 0, frenzyFxAccMs: 0 },
    callbacks: {}
};

// ==================== 3. 生命週期與跨局計時器隔離 ====================
function isOverlayVisible(el) { return Boolean(el && !el.classList.contains('hidden')); }
function isCodexOpen() { return isOverlayVisible(G.dom.codexOverlayEl); }
function isAnyModalOpen() {
    const dom = G.dom, st = G.state;
    return isOverlayVisible(dom.startOverlayEl)
        || isOverlayVisible(dom.codexOverlayEl)
        || isOverlayVisible(dom.blessingOverlayEl)
        || isOverlayVisible(dom.victoryOverlayEl)
        || isOverlayVisible(dom.gameOverOverlayEl)
        || st.waveState === 'WAITING_START'
        || st.waveState === 'BLESSING_SELECT'
        || st.waveState === 'VICTORY'
        || st.waveState === 'GAMEOVER'
        || st.isGameOver;
}
function isGameplayActive() {
    const st = G.state;
    return !st.isGameOver && !st.isPaused && st.waveState !== 'WAITING_START' && st.waveState !== 'VICTORY' && st.waveState !== 'BLESSING_SELECT' && !isCodexOpen();
}
function isMatchPhaseActive() {
    const st = G.state;
    return !st.isGameOver && st.waveState !== 'WAITING_START' && st.waveState !== 'VICTORY' && st.waveState !== 'BLESSING_SELECT' && !isCodexOpen();
}
function isRelocationFree() { return G.state.waveState === 'PREP' || G.state.waveState === 'INTERMISSION'; }

function scheduleGameTimeout(callback, delayMs) {
    const capturedSessionId = G.state.sessionId;
    const timerId = setTimeout(() => {
        G.state.activeTimers.delete(timerId);
        if (capturedSessionId !== G.state.sessionId) return;
        callback();
    }, Math.max(0, delayMs));
    G.state.activeTimers.add(timerId);
    return timerId;
}

function clearAllGameTimers() {
    const st = G.state;
    st.activeTimers.forEach(id => clearTimeout(id));
    st.activeTimers.clear();
    if (st.treeHitShakeTimer) { clearTimeout(st.treeHitShakeTimer); st.treeHitShakeTimer = null; }
    st.pendingBolts = [];
    Renderer.clearCanvasFXState();
}

function activateTouchMode() {
    G.state.isTouchMode = true;
    if (G.state.hoveredIndex !== null) { G.state.hoveredIndex = null; Renderer.updateRangeIndicator(); }
}

// ==================== 4. 地圖選擇與局末戰報 ====================
function renderMapSelectorUI() {
    const records = Backend.loadMapRecords();
    if (G.dom.mapSelectorGridEl) {
        G.dom.mapSelectorGridEl.querySelectorAll('.map-card').forEach(card => {
            const isSel = card.dataset.mapId === G.state.currentMapId;
            card.classList.toggle('selected', isSel);
            card.setAttribute('aria-pressed', isSel ? 'true' : 'false');
        });
    }
    const fmt = rec => `最高 Wave ${rec.bestWave} · ${rec.bestStars > 0 ? `通關 ${'★'.repeat(rec.bestStars)}` : '尚未通關'}`;
    if (G.dom.mapRecordForestEl) G.dom.mapRecordForestEl.innerText = fmt(records.forest);
    if (G.dom.mapRecordLavaEl) G.dom.mapRecordLavaEl.innerText = fmt(records.lava);
}

function selectMap(mapId) {
    const st = G.state;
    if (st.waveState !== 'WAITING_START' || !MAPS_CONFIG[mapId] || mapId === st.currentMapId) return;
    Combat.applyMapConfig(mapId);
    const mapSpec = Combat.getCurrentMapSpec();
    st.bestWave = Backend.getMapBestWave(st.currentMapId);
    st.currentGold = CONFIG.INITIAL_GOLD + (mapSpec.startGoldBonus || 0);
    st.selectedIndex = null; st.buildTargetIndex = null; st.hoveredIndex = null;
    Renderer.initBoard();
    Renderer.renderBoard();
    renderMapSelectorUI();
    updateHUD();
    const bonusNote = mapSpec.startGoldBonus > 0 ? `（起始 💰 +${mapSpec.startGoldBonus}，擊殺 💰 +${Math.round((mapSpec.killGoldMult - 1) * 100)}%）` : '';
    if (G.dom.msgText) G.dom.msgText.innerText = `已切換戰場【${mapSpec.name}】${bonusNote}，點擊「開始防守」開啟戰局。`;
    SoundEngine.playSpawn(1);
}

function getMvpSummaryText() {
    const st = G.state;
    let bestBoardTower = null;
    for (let i = 0; i < st.board.length; i++) {
        const t = st.board[i];
        if (t && t.totalDamage > 0 && (!bestBoardTower || t.totalDamage > bestBoardTower.totalDamage)) bestBoardTower = t;
    }
    let mvp = null;
    if (bestBoardTower && (!st.peakTowerSnapshot || bestBoardTower.totalDamage >= st.peakTowerSnapshot.totalDamage)) {
        const cfg = ELEMENT_CONFIG[bestBoardTower.type];
        mvp = { type: bestBoardTower.type, tier: bestBoardTower.tier, name: cfg ? cfg.name : bestBoardTower.type, icon: cfg ? cfg.icon : '', totalDamage: bestBoardTower.totalDamage };
    } else if (st.peakTowerSnapshot && st.peakTowerSnapshot.totalDamage > 0) {
        mvp = st.peakTowerSnapshot;
    }
    if (!mvp || mvp.totalDamage <= 0) return '尚無輸出紀錄';
    const pct = st.totalTeamDamage > 0 ? Math.round((mvp.totalDamage / st.totalTeamDamage) * 100) : 0;
    return `${mvp.icon ? mvp.icon + ' ' : ''}${mvp.name} ${Renderer.getTierStars(mvp.tier)} — ${mvp.totalDamage.toLocaleString()} 傷害 (${pct}%)`;
}

function setDomText(el, txt) { if (el) el.innerText = txt; }

function populateBattleRecap(mode) {
    const st = G.state, dom = G.dom, mapSpec = Combat.getCurrentMapSpec(), mvpText = getMvpSummaryText();
    if (mode === 'victory') {
        setDomText(dom.victoryMapTextEl, mapSpec.name);
        setDomText(dom.victoryKillsTextEl, `${st.killsCount} 隻`);
        setDomText(dom.victoryHpTextEl, `${st.baseHp} / ${CONFIG.INITIAL_BASE_HP}`);
        setDomText(dom.victoryGoldTextEl, `${st.currentGold} 💰`);
        setDomText(dom.victoryMvpTextEl, mvpText);
        setDomText(dom.victoryGoldEarnedTextEl, `${st.totalGoldEarned.toLocaleString()} 💰`);
        setDomText(dom.victoryFusionTextEl, `${st.fusionCount} 次`);
        return;
    }
    setDomText(dom.gameoverMapTextEl, mapSpec.name);
    setDomText(dom.finalWaveTextEl, st.isEndlessMode ? `Wave ${st.currentWave} (無盡)` : `Wave ${st.currentWave} / ${CONFIG.VICTORY_WAVE}`);
    setDomText(dom.finalBestTextEl, `Wave ${st.bestWave}`);
    setDomText(dom.finalKillsTextEl, `${st.killsCount} 隻`);
    setDomText(dom.gameoverMvpTextEl, mvpText);
    setDomText(dom.gameoverGoldEarnedTextEl, `${st.totalGoldEarned.toLocaleString()} 💰`);
    setDomText(dom.gameoverFusionTextEl, `${st.fusionCount} 次`);
    if (dom.gameoverBreakerRowEl) {
        dom.gameoverBreakerRowEl.classList.toggle('hidden', !st.lastBreakerName);
        if (st.lastBreakerName) setDomText(dom.gameoverBreakerTextEl, st.lastBreakerName);
    }
}

// ==================== 5. UI 更新（全面快取與查表） ====================
function getCost(type) { return Math.min(CONFIG.COST_MAX, CONFIG.BASE_COST + ((G.state.spawnCounts[type] || 0) * CONFIG.COST_STEP)); }
function getEarlyWaveBonus(ms = G.state.waveTimerMs) { return Math.min(15, 2 + Math.floor(1.5 * Math.max(0, ms / 1000))); }

function updateTowerInspector() {
    const dom = G.dom, st = G.state;
    if (!dom.inspectorEmptyEl || !dom.inspectorActiveEl) return;
    const hasTower = st.selectedIndex !== null && st.board[st.selectedIndex] !== null && !st.isGameOver && st.waveState !== 'VICTORY' && st.waveState !== 'BLESSING_SELECT';
    if (!hasTower) {
        dom.inspectorActiveEl.classList.add('hidden');
        dom.inspectorEmptyEl.classList.remove('hidden');
        if (st.buildTargetIndex !== null && st.board[st.buildTargetIndex] === null && !G.map.pathCellIndices.has(st.buildTargetIndex)) {
            const c = indexToCoords(st.buildTargetIndex), terrain = Combat.getTerrainAt(st.buildTargetIndex);
            dom.inspectorEmptyEl.innerText = `已指定建造格 (${c.x + 1},${c.y + 1})${terrain ? `｜${TERRAIN_CONFIG[terrain].shortTag}` : ''} — 點擊下方元素卡召喚`;
        } else {
            dom.inspectorEmptyEl.innerText = '點選防禦塔可檢視 DPS、切換索敵或出售；先點空白草地再召喚可指定落點';
        }
        return;
    }

    const towerObj = st.board[st.selectedIndex], cfg = ELEMENT_CONFIG[towerObj.type];
    const stats = Combat.getTowerInspectorStats(st.selectedIndex, towerObj), mode = towerObj.targetMode || 'first';
    dom.inspectorEmptyEl.classList.add('hidden');
    dom.inspectorActiveEl.classList.remove('hidden');
    setDomText(dom.inspectorNameEl, `${cfg.icon} ${cfg.name} ${Renderer.getTierStars(towerObj.tier)}`);
    setDomText(dom.inspectorDpsEl, `DPS ${stats.dps}${towerObj.type === 'plasma' ? (towerObj.focusStacks > 0 ? ` (${towerObj.focusStacks} 層)` : ' (蓄能)') : ''}`);
    setDomText(dom.inspectorRangeEl, `射程 ${stats.rangeStr}`);
    if (dom.inspectorTerrainEl) {
        dom.inspectorTerrainEl.classList.toggle('hidden', !stats.terrainType);
        dom.inspectorTerrainEl.innerText = stats.terrainType ? TERRAIN_CONFIG[stats.terrainType].shortTag : '';
    }
    setDomText(dom.inspectorTargetBtn, `索敵：${TARGET_MODE_LABELS[mode] || '最前'}`);
    setDomText(dom.inspectorSellBtn, `出售 (+${Combat.getTowerSellRefund(towerObj)} 💰)`);
}

function updateBossStatusBar() {
    const dom = G.dom, st = G.state;
    if (!dom.bossStatusBarEl) return;
    const boss = st.monsters.find(m => m.isBoss && m.hp > 0);
    if (!boss || st.isGameOver || st.waveState === 'WAITING_START' || st.waveState === 'VICTORY') {
        dom.bossStatusBarEl.classList.add('hidden');
        dom.bossStatusBarEl.classList.remove('weak-fire', 'weak-ice', 'weak-thunder');
        setDomText(dom.bossBannerTitleEl, ''); setDomText(dom.bossBannerHpTextEl, '');
        return;
    }
    const weakCfg = ELEMENT_CONFIG[boss.weakness], weakShort = weakCfg ? `${weakCfg.icon}${weakCfg.name.charAt(0)}` : boss.weakness;
    const armorLabel = boss.armorShredTimer > 0 ? `🔥 ${Math.round(Combat.getMonsterEffectiveArmor(boss))}/${boss.armor}` : `甲 ${boss.armor}`;
    dom.bossStatusBarEl.classList.remove('hidden', 'weak-fire', 'weak-ice', 'weak-thunder');
    if (weakCfg) dom.bossStatusBarEl.classList.add(`weak-${boss.weakness}`);
    setDomText(dom.bossBannerTitleEl, `${boss.name}｜弱 ${weakShort}｜${armorLabel}`);
    setDomText(dom.bossBannerHpTextEl, `${boss.hp} / ${boss.maxHp}`);
    if (dom.bossBannerHpFillEl) dom.bossBannerHpFillEl.style.width = `${Math.max(0, Math.min(100, (boss.hp / boss.maxHp) * 100))}%`;
}

function updateSkillBtnVisual(btn, maskEl, dewBarEl, labelEl, subEl, cdMs, maxCdMs, activeMs, cost, skillName, hotkey, activePrefix) {
    if (!btn) return;
    if (maskEl) maskEl.style.width = `${cdMs > 0 ? Math.min(100, (cdMs / maxCdMs) * 100) : 0}%`;
    if (dewBarEl) dewBarEl.style.width = `${Math.max(0, Math.min(100, (G.state.dewEnergy / Math.max(1, cost)) * 100))}%`;
    const missingDew = Math.max(0, cost - G.state.dewEnergy);
    const isCooling = activeMs <= 0 && cdMs > 0;
    const isLowDew = activeMs <= 0 && cdMs <= 0 && missingDew > 0;
    if (labelEl) {
        labelEl.innerText = `${skillName} (${cost} 靈露)`;
    }
    if (subEl) {
        if (activeMs > 0 && activePrefix) subEl.innerText = `${activePrefix} ${(activeMs / 1000).toFixed(1)}s`;
        else if (isCooling) subEl.innerText = `冷卻 ${(cdMs / 1000).toFixed(1)}s`;
        else if (isLowDew) subEl.innerText = `還差 ${missingDew} 靈露`;
        else subEl.innerText = `就緒 · [${hotkey}]`;
    }
    if (activePrefix) btn.classList.toggle('skill-active', activeMs > 0);
    btn.classList.toggle('skill-cooling', isCooling);
    btn.classList.toggle('skill-low-dew', isLowDew);
    btn.title = isCooling ? `冷卻中，剩餘 ${(cdMs / 1000).toFixed(1)} 秒` : (isLowDew ? `靈露不足，需 ${cost} 靈露（還差 ${missingDew} 靈露）` : `消耗 ${cost} 靈露立即施放`);
    btn.disabled = !isGameplayActive() || activeMs > 0 || isCooling || isLowDew;
}

function updateSkillButtonsUI() {
    const dom = G.dom, st = G.state;
    setDomText(dom.dewDisplay, `${st.dewEnergy}/${CONFIG.DEW_MAX}`);
    if (dom.dewBarFillEl) dom.dewBarFillEl.style.width = `${Math.max(0, Math.min(100, (st.dewEnergy / CONFIG.DEW_MAX) * 100))}%`;
    updateSkillBtnVisual(dom.skillEntangleBtn, dom.skillEntangleMask, dom.skillEntangleDewBar, dom.skillEntangleLabel, dom.skillEntangleSub, st.entangleCdMs, CONFIG.SKILL_ENTANGLE_CD_MS, 0, CONFIG.SKILL_ENTANGLE_COST, '根鬚纏繞', 'Q', null);
    updateSkillBtnVisual(dom.skillFrenzyBtn, dom.skillFrenzyMask, dom.skillFrenzyDewBar, dom.skillFrenzyLabel, dom.skillFrenzySub, st.frenzyCdMs, CONFIG.SKILL_FRENZY_CD_MS, st.frenzyActiveMs, CONFIG.SKILL_FRENZY_COST, '自然狂熱', 'W', '狂熱中');
}

const WAVE_STATE_TEXT = {
    WAITING_START: () => '等待開始', BLESSING_SELECT: () => '賜福選擇',
    PREP: st => `備戰 ${Math.max(1, Math.ceil(st.waveTimerMs / 1000))}s`,
    INTERMISSION: st => `下波 ${Math.max(1, Math.ceil(st.waveTimerMs / 1000))}s`,
    SPAWNING: (_, b) => (b ? '魔王決戰' : '出怪中'), CLEARING: (_, b) => (b ? '魔王決戰' : '清場中'),
    VICTORY: () => '通關勝利'
};

function syncPauseUI() {
    const dom = G.dom, st = G.state;
    const canPause = isMatchPhaseActive();
    const showPaused = Boolean(st.isPaused && canPause);
    if (dom.pauseBtn) {
        dom.pauseBtn.disabled = !canPause;
        dom.pauseBtn.classList.toggle('is-paused', showPaused);
        dom.pauseBtn.innerText = showPaused ? '繼續' : '暫停';
    }
    if (dom.pauseBannerEl) {
        dom.pauseBannerEl.classList.toggle('hidden', !showPaused);
    }
}

function updateWavePhaseUI() {
    const dom = G.dom, st = G.state;
    if (!dom.wavePhaseTagEl) return;
    const isBoss = Combat.isBossWaveNumber(st.currentWave);
    dom.wavePhaseTagEl.classList.toggle('boss-wave', !st.isPaused && isBoss && (st.waveState === 'SPAWNING' || st.waveState === 'CLEARING'));
    dom.wavePhaseTagEl.classList.toggle('paused', st.isPaused);
    dom.wavePhaseTagEl.innerText = st.isPaused ? '已暫停' : ((WAVE_STATE_TEXT[st.waveState] && WAVE_STATE_TEXT[st.waveState](st, isBoss)) || '已結束');
    syncPauseUI();
    if (dom.nextWaveBtn) {
        const canSkip = isGameplayActive() && (st.waveState === 'PREP' || st.waveState === 'INTERMISSION');
        dom.nextWaveBtn.disabled = !canSkip;
        dom.nextWaveBtn.innerText = canSkip ? `${st.waveState === 'PREP' ? '立即開波' : '提前下波'} (+${getEarlyWaveBonus()} 💰)` : '立即開波';
    }
}

function updateSeedPityUI() {
    const badge = G.dom.seedPityBadgeEl;
    if (!badge) return;
    if (!Combat.hasBlessing('abundant_seed')) { badge.classList.add('hidden'); badge.classList.remove('pity-ready'); return; }
    badge.classList.remove('hidden');
    badge.classList.toggle('pity-ready', G.state.seedPityCount === CONFIG.BLESSING_SEED_INTERVAL - 1);
    badge.innerText = `豐饒種子保底進度：${G.state.seedPityCount}/${CONFIG.BLESSING_SEED_INTERVAL}`;
}

function updateSpeedButtonUI() {
    const btn = G.dom.speedBtn;
    if (!btn) return;
    btn.classList.remove('speed-2x', 'speed-3x');
    if (G.state.gameSpeed === 2) { btn.classList.add('speed-2x'); btn.innerText = '倍速 2x'; }
    else if (G.state.gameSpeed === 3) { btn.classList.add('speed-3x'); btn.innerText = '倍速 3x'; }
    else btn.innerText = '倍速 1x';
}

function updateSoundButtonUI() {
    if (!G.dom.soundBtn) return;
    G.dom.soundBtn.classList.toggle('muted', SoundEngine.isMuted);
    G.dom.soundBtn.innerText = SoundEngine.isMuted ? '音效：靜音' : '音效：開';
}

function renderForecastListInto(headerEl, listEl, waveNum, prefixLabel, isFinalClear = false) {
    if (!headerEl || !listEl) return;
    if (isFinalClear) {
        headerEl.innerText = `${prefixLabel} · 已達最終波`;
        listEl.innerHTML = '<li class="forecast-item forecast-boss">守住第 10 波即可通關</li>';
        return;
    }
    const plan = Combat.buildWaveQueue(waveNum);
    headerEl.innerText = `${prefixLabel} · Wave ${waveNum}`;
    const counts = new Map();
    let normalTotal = 0;
    for (let i = 0; i < plan.queue.length; i++) {
        const q = plan.queue[i];
        if (q.isBoss) continue;
        normalTotal++;
        counts.set(q.typeKey, (counts.get(q.typeKey) || 0) + 1);
    }
    const items = [];
    counts.forEach((cnt, key) => {
        const mCfg = MONSTER_DATABASE[key];
        if (!mCfg) return;
        const wCfg = ELEMENT_CONFIG[mCfg.weakness];
        const weakTag = wCfg ? `弱${wCfg.name.charAt(0)}` : '';
        items.push(`<li class="forecast-item"><span>${mCfg.name} <span class="num">×${cnt}</span></span><span class="forecast-weak weak-${mCfg.weakness}">${weakTag}</span></li>`);
    });
    if (plan.eliteCount > 0) {
        items.push(`<li class="forecast-meta num">含 ${plan.eliteCount} 隻護甲菁英（甲 ${plan.eliteArmor}）</li>`);
    }
    if (plan.bossMeta) {
        const bWeak = ELEMENT_CONFIG[plan.bossMeta.weakness];
        const bWeakStr = bWeak ? `弱${bWeak.name.charAt(0)}` : '';
        items.push(`<li class="forecast-item forecast-boss"><span>王 · ${plan.bossMeta.name}</span><span class="forecast-weak weak-${plan.bossMeta.weakness} num">${bWeakStr} · 甲 ${plan.bossMeta.armor}</span></li>`);
    } else if (normalTotal > 0 && plan.eliteCount === 0) {
        items.push(`<li class="forecast-meta num">共 ${normalTotal} 隻敵軍進攻</li>`);
    }
    listEl.innerHTML = items.join('');
}

function updateWaveForecastUI() {
    const dom = G.dom, st = G.state;
    const curWave = Math.max(1, st.currentWave || 1);
    const nextWave = curWave + 1;
    const isFinalClear = !st.isEndlessMode && curWave >= CONFIG.VICTORY_WAVE;
    renderForecastListInto(dom.forecastCurrentHeaderEl, dom.forecastCurrentListEl, curWave, '本波情報');
    renderForecastListInto(dom.forecastNextHeaderEl, dom.forecastNextListEl, nextWave, '下波預告', isFinalClear);
}

function updateHUD() {
    const dom = G.dom, st = G.state;
    setDomText(dom.goldDisplay, st.currentGold);
    setDomText(dom.baseHpDisplay, `${st.baseHp}/${CONFIG.INITIAL_BASE_HP}`);
    setDomText(dom.waveDisplay, st.isEndlessMode ? `Wave ${st.currentWave} (無盡)` : `Wave ${st.currentWave} / ${CONFIG.VICTORY_WAVE}`);
    setDomText(dom.bestWaveDisplay, `Wave ${st.bestWave}`);
    updateWavePhaseUI(); Renderer.updateWorldTreeVisualState(); updateSkillButtonsUI();
    updateSeedPityUI(); updateTowerInspector(); updateBossStatusBar(); updateSoundButtonUI();
    updateWaveForecastUI();

    const activePlay = isGameplayActive();
    for (let i = 0; i < BASE_ELEMENT_TYPES.length; i++) {
        const type = BASE_ELEMENT_TYPES[i], ref = dom.spawnerBtns[type];
        if (!ref) continue;
        const cost = getCost(type);
        if (ref.costEl) ref.costEl.innerText = `${cost} 💰`;
        ref.btn.classList.toggle('btn-disabled', !activePlay || st.currentGold < cost);
    }
}

function renderSpawnerButtons() {
    const container = G.dom.spawnerContainer;
    container.innerHTML = '';
    G.dom.spawnerBtns = {};
    BASE_ELEMENT_TYPES.forEach(type => {
        const data = ELEMENT_CONFIG[type], btn = document.createElement('button');
        btn.id = `spawn-btn-${type}`;
        btn.classList.add('spawn-card-btn', `btn-type-${type}`);
        btn.innerHTML = `<span class="spawn-card-top"><span class="spawn-card-name">${data.icon} ${data.name}</span><span class="btn-cost-val num">${getCost(type)} 💰</span></span><span class="btn-sub-info num">${data.roleTag}</span>`;
        btn.addEventListener('click', () => handleSpawn(type, btn));
        container.appendChild(btn);
        G.dom.spawnerBtns[type] = { btn, costEl: btn.querySelector('.btn-cost-val') };
    });
    const pityBadge = document.createElement('div');
    pityBadge.id = 'seed-pity-badge'; pityBadge.className = 'seed-pity-badge hidden';
    pityBadge.innerText = `豐饒種子保底進度：0/${CONFIG.BLESSING_SEED_INTERVAL}`;
    container.appendChild(pityBadge);
    G.dom.seedPityBadgeEl = pityBadge;
    updateSeedPityUI();
}

// ==================== 6. 世界樹主動技、祝福、召喚與操作 ====================
function triggerBlessingSelection(clearedWave) {
    const pool = BLESSINGS_CATALOG.filter(b => !G.state.activeBlessings.has(b.id));
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    const choices = pool.slice(0, Math.min(3, pool.length));
    if (choices.length === 0) return false;

    const st = G.state;
    st.blessingGrantedWaves.add(clearedWave); st.blessingChoices = choices; st.isPaused = false; st.waveState = 'BLESSING_SELECT';
    if (st.rafId !== null) { cancelAnimationFrame(st.rafId); st.rafId = null; }
    Renderer.clearTouchDragVisuals(); st.draggedIndex = null; st.hoveredIndex = null; Renderer.updateRangeIndicator();

    setDomText(G.dom.blessingWaveSubtitleEl, `第 ${clearedWave} 波捷報！世界樹賜予枝枒祝福，請擇一強化防線`);
    if (G.dom.blessingChoicesEl) {
        G.dom.blessingChoicesEl.innerHTML = '';
        choices.forEach(b => {
            const card = document.createElement('button');
            card.type = 'button'; card.className = 'blessing-choice-btn'; card.dataset.blessingId = b.id;
            card.innerHTML = `<span class="blessing-choice-icon">${b.icon}</span><span class="blessing-choice-title">${b.name}</span><span class="blessing-choice-desc">${b.desc}</span>`;
            card.addEventListener('click', () => selectBlessing(b.id));
            G.dom.blessingChoicesEl.appendChild(card);
        });
    }
    if (G.dom.blessingOverlayEl) G.dom.blessingOverlayEl.classList.remove('hidden');
    SoundEngine.playMagic('blessing'); updateHUD();
    return true;
}

function selectBlessing(blessingId) {
    const st = G.state;
    if (st.waveState !== 'BLESSING_SELECT') return;
    const picked = BLESSINGS_CATALOG.find(b => b.id === blessingId);
    if (!picked || st.activeBlessings.has(blessingId)) return;
    st.activeBlessings.add(blessingId); st.blessingChoices = [];
    if (G.dom.blessingOverlayEl) G.dom.blessingOverlayEl.classList.add('hidden');
    if (blessingId === 'abundant_seed') st.seedPityCount = 0;
    else if (blessingId === 'life_nectar') {
        st.baseHp = Math.min(CONFIG.INITIAL_BASE_HP, st.baseHp + CONFIG.BLESSING_LIFE_HEAL);
    }
    st.waveState = 'INTERMISSION'; st.waveTimerMs = CONFIG.WAVE_INTERMISSION_MS;
    G.dom.msgText.innerText = `🌳 已獲得祝福【${picked.icon} ${picked.name}】！下一波將於 ${Math.ceil(CONFIG.WAVE_INTERMISSION_MS / 1000)} 秒後到來！`;
    SoundEngine.playMagic('blessing'); updateHUD(); startMainLoop();
}

function castEntangleSkill() {
    const st = G.state;
    if (!isGameplayActive() || st.entangleCdMs > 0) return false;
    if (st.monsters.length === 0) { G.dom.msgText.innerText = '場上目前沒有敵人，無需施放根鬚纏繞。'; return false; }
    if (st.dewEnergy < CONFIG.SKILL_ENTANGLE_COST) { G.dom.msgText.innerText = `靈露不足，需要 ${CONFIG.SKILL_ENTANGLE_COST} 靈露才能施放根鬚纏繞。`; return false; }
    st.dewEnergy -= CONFIG.SKILL_ENTANGLE_COST; st.entangleCdMs = CONFIG.SKILL_ENTANGLE_CD_MS;
    for (let i = 0; i < st.monsters.length; i++) {
        const m = st.monsters[i]; if (m.hp <= 0) continue;
        m.rootTimer = Math.max(m.rootTimer || 0, CONFIG.SKILL_ENTANGLE_DUR_MS);
        m.rootVulnRate = Math.max(m.rootVulnRate || 0, CONFIG.SKILL_ENTANGLE_VULN_BONUS);
        Renderer.emitParticleBurst(m.pixelX, m.pixelY, '#4E9A68', 10, 95);
        Renderer.emitRingFX(m.pixelX, m.pixelY, Math.max(18, G.boardMetrics.cellW * 0.72), '#4E9A68', 0.28, 420);
    }
    const lastWp = G.map.waypoints[G.map.waypoints.length - 1], tp = Renderer.getCellCenter(lastWp.x, lastWp.y);
    Renderer.emitRingFX(tp.left, tp.top, G.boardMetrics.step * 3.2, '#4E9A68', 0.18, 480);
    SoundEngine.playMagic('entangle'); G.dom.msgText.innerText = '施放「根鬚纏繞」：全場敵人定身 2.5 秒且易傷 +20%。';
    Renderer.renderMonsterLayer(); updateHUD();
    return true;
}

function castFrenzySkill() {
    const st = G.state;
    if (!isGameplayActive()) return false;
    if (st.frenzyActiveMs > 0) { G.dom.msgText.innerText = '自然狂熱效果持續中，無法重複施放。'; return false; }
    if (st.frenzyCdMs > 0) return false;
    if (st.dewEnergy < CONFIG.SKILL_FRENZY_COST) { G.dom.msgText.innerText = `靈露不足，需要 ${CONFIG.SKILL_FRENZY_COST} 靈露才能施放自然狂熱。`; return false; }
    st.dewEnergy -= CONFIG.SKILL_FRENZY_COST; st.frenzyActiveMs = CONFIG.SKILL_FRENZY_DUR_MS; st.frenzyCdMs = CONFIG.SKILL_FRENZY_CD_MS;
    for (let idx = 0; idx < st.board.length; idx++) {
        if (!st.board[idx]) continue;
        const c = indexToCoords(idx), pos = Renderer.getCellCenter(c.x, c.y);
        Renderer.emitParticleBurst(pos.left, pos.top, '#E0B43C', 8, 70);
        Renderer.emitRingFX(pos.left, pos.top, Math.max(16, G.boardMetrics.cellW * 0.65), '#D97724', 0.24, 360);
        if (G.towerElements[idx]) G.towerElements[idx].classList.add('frenzy-active');
    }
    SoundEngine.playMagic('frenzy'); G.dom.msgText.innerText = '施放「自然狂熱」：全場防禦塔攻速提升 +35%，持續 5.0 秒。';
    updateHUD();
    return true;
}

function handleSpawn(type, btnElement) {
    const st = G.state;
    if (!isGameplayActive() || !BASE_ELEMENT_TYPES.includes(type)) return;
    const cost = getCost(type);
    if (st.currentGold < cost) {
        G.dom.msgText.innerText = `❌ 金幣不足，無法召喚【${ELEMENT_CONFIG[type].name}】！需要 ${cost} 💰`;
        if (btnElement) { btnElement.classList.remove('shake-anim'); void btnElement.offsetWidth; btnElement.classList.add('shake-anim'); }
        return;
    }
    const pick = Combat.pickSmartSpawnIndex(type);
    if (!pick) { G.dom.msgText.innerText = '⚠️ 可建造格子已經全滿，請先融合或出售騰出空間！'; return; }

    st.currentGold -= cost; st.spawnCounts[type] = (st.spawnCounts[type] || 0) + 1;
    let spawnedTier = 1, seedTriggered = false;
    if (Combat.hasBlessing('abundant_seed') && ++st.seedPityCount >= CONFIG.BLESSING_SEED_INTERVAL) {
        st.seedPityCount = 0; spawnedTier = 2; seedTriggered = true;
    }
    st.board[pick.index] = Combat.createTowerObj(type, spawnedTier, cost);
    st.buildTargetIndex = null;

    const cfg = ELEMENT_CONFIG[type], terrain = Combat.getTerrainAt(pick.index), coords = indexToCoords(pick.index);
    SoundEngine.playSpawn(spawnedTier);
    G.dom.msgText.innerText = `成功${pick.mode === 'targeted' ? `於指定格 (${coords.x + 1},${coords.y + 1})` : ''}召喚【${cfg.name} ${Renderer.getTierStars(spawnedTier)}】${seedTriggered ? '【🌱 豐饒種子保底 ★★！】' : ''}${terrain ? `（位於 ${TERRAIN_CONFIG[terrain].shortTag}）` : ''}！花費 ${cost} 💰。`;
    Renderer.renderBoard([pick.index]); updateHUD();
}

function handleCellClick(index) {
    const st = G.state;
    if (!isGameplayActive()) {
        if (st.isPaused && isMatchPhaseActive()) {
            if (st.board[index] !== null && st.selectedIndex !== index) {
                st.selectedIndex = index; st.buildTargetIndex = null;
                const t = st.board[index], terrain = Combat.getTerrainAt(index);
                G.dom.msgText.innerText = `⏸️ 暫停檢視：【${ELEMENT_CONFIG[t.type].name} ${Renderer.getTierStars(t.tier)}】${terrain ? `｜地形：${TERRAIN_CONFIG[terrain].shortTag}` : ''}（恢復後可移動、融合或切換索敵）`;
            } else {
                st.selectedIndex = null; st.hoveredIndex = null; st.buildTargetIndex = null;
                G.dom.msgText.innerText = st.board[index] === null ? '暫停中僅供點擊防禦塔檢視資訊，按「繼續」或 Space 即可恢復操作。' : '已取消選取。';
            }
            Renderer.renderBoard([]);
            updateTowerInspector();
        }
        return;
    }
    if (st.selectedIndex === null) {
        if (st.board[index] !== null) {
            st.selectedIndex = index; st.buildTargetIndex = null;
            const t = st.board[index], terrain = Combat.getTerrainAt(index);
            G.dom.msgText.innerText = `已選取【${ELEMENT_CONFIG[t.type].name} ${Renderer.getTierStars(t.tier)}】${terrain ? `｜地形：${TERRAIN_CONFIG[terrain].shortTag}` : ''}（可切換索敵、出售或點擊目標格融合/移動）`;
        } else if (!G.map.pathCellIndices.has(index)) {
            st.selectedIndex = null; st.hoveredIndex = null;
            if (st.buildTargetIndex === index) { st.buildTargetIndex = null; G.dom.msgText.innerText = '已取消指定建造位置。'; }
            else {
                st.buildTargetIndex = index;
                const c = indexToCoords(index), terrain = Combat.getTerrainAt(index);
                G.dom.msgText.innerText = `📍 已選定建造位置 (${c.x + 1},${c.y + 1})${terrain ? `（${TERRAIN_CONFIG[terrain].shortTag}）` : ''}，請點擊下方元素召喚按鈕！`;
            }
        } else { st.selectedIndex = null; st.hoveredIndex = null; st.buildTargetIndex = null; }
    } else if (st.selectedIndex === index) {
        st.selectedIndex = null; st.hoveredIndex = null; st.buildTargetIndex = null; G.dom.msgText.innerText = '已取消選取。';
    } else {
        const fromIdx = st.selectedIndex;
        st.selectedIndex = null; st.hoveredIndex = null; st.buildTargetIndex = null;
        handleAction(fromIdx, index);
        return;
    }
    Renderer.renderBoard([]);
}

function handleAction(fromIndex, toIndex) {
    const st = G.state;
    if (!isGameplayActive()) return;
    if (fromIndex === null || toIndex === null || fromIndex === toIndex) { Renderer.renderBoard([]); return; }
    if (fromIndex < 0 || fromIndex >= CONFIG.BOARD_SIZE || toIndex < 0 || toIndex >= CONFIG.BOARD_SIZE || !st.board[fromIndex]) return;
    if (G.map.pathCellIndices.has(toIndex)) { G.dom.msgText.innerText = '⚠️ 該位置是怪物跑道，不能放置防禦塔！'; Renderer.renderBoard([]); return; }

    const fromTower = st.board[fromIndex], toTower = st.board[toIndex];
    if (toTower === null) {
        if (!isRelocationFree()) {
            if (st.currentGold < CONFIG.COMBAT_MOVE_COST) { G.dom.msgText.innerText = `⚠️ 戰鬥期間調度塔位需花費 ${CONFIG.COMBAT_MOVE_COST} 💰，金幣不足！`; Renderer.renderBoard([]); return; }
            st.currentGold -= CONFIG.COMBAT_MOVE_COST;
            G.dom.msgText.innerText = `🚚 戰術調度成功！花費 ${CONFIG.COMBAT_MOVE_COST} 💰。`;
        } else { G.dom.msgText.innerText = '已免費移動塔的位置。'; }
        st.board[toIndex] = fromTower; st.board[fromIndex] = null;
        Renderer.renderBoard([fromIndex, toIndex]); updateHUD();
        return;
    }

    const res = Combat.executeTowerFusion(fromIndex, toIndex);
    if (res) {
        const { fusion } = res, cfg = ELEMENT_CONFIG[fusion.type];
        let bonusHint = '';
        if (fusion.isCrossElement) {
            bonusHint = '【跨元素融合！】';
            GameAnalyticsTracker.trackDesign(`Fusion:CrossElement:${st.currentMapId}:${fusion.type}:Tier_${fusion.tier}`, st.fusionCount);
        } else if (fusion.tier === CONFIG.MAX_TIER) {
            bonusHint = ({ fire: '【解鎖炎爆濺射 35%】', ice: '【解鎖 60% 深度冰封＋群體寒霜】', thunder: '【解鎖三連閃電】' })[fusion.type] || '';
        }
        SoundEngine.playMerge(fusion.tier, fusion.isCrossElement);
        G.dom.msgText.innerText = `✨ 融合成功！進化為【${cfg.name} ${Renderer.getTierStars(fusion.tier)}】${bonusHint}`;
        Renderer.renderBoard([fromIndex, toIndex]);
        return;
    }
    G.dom.msgText.innerText = (fromTower.tier >= CONFIG.MAX_TIER || toTower.tier >= CONFIG.MAX_TIER)
        ? `⚠️ ${Renderer.getTierStars(CONFIG.MAX_TIER)} 已達最高星級，無法再融合！`
        : '⚠️ 該組合無法融合（須同星級基礎元素，或相同元素/融合塔；詳見 📖 融合圖鑑）！';
    Renderer.renderBoard([]);
}

// ==================== 7. 波次、勝負結算與主迴圈 ====================
function startWave(waveNum, earlyBonus = 0) {
    if (!isGameplayActive()) return;
    const st = G.state;
    st.currentWave = waveNum;
    if (st.currentWave > st.bestWave) { st.bestWave = st.currentWave; Backend.saveMapRecord(st.currentMapId, st.bestWave); st.isNewRecordThisRun = true; }

    const plan = Combat.buildWaveQueue(waveNum);
    st.waveSpawnQueue = plan.queue; st.waveSpawnIntervalMs = plan.spawnIntervalMs;
    st.waveSpawnAccMs = plan.spawnIntervalMs; st.waveState = 'SPAWNING';

    const bonusMsg = earlyBonus > 0 ? `（⚡ 早鳥開波 +${earlyBonus} 💰）` : '';
    if (plan.bossMeta) {
        const bWeak = ELEMENT_CONFIG[plan.bossMeta.weakness], weakIcon = bWeak.icon + bWeak.name.charAt(0);
        G.dom.msgText.innerText = (!st.isEndlessMode && waveNum === CONFIG.VICTORY_WAVE)
            ? `最終決戰 Wave ${waveNum}/${CONFIG.VICTORY_WAVE}：${plan.bossMeta.name}（弱 ${weakIcon} · 甲 ${plan.bossMeta.armor} · ${plan.bossMeta.hp} HP）來襲${bonusMsg}。`
            : `魔王波 Wave ${waveNum}：${plan.bossMeta.name}（弱 ${weakIcon} · 甲 ${plan.bossMeta.armor}）來襲${bonusMsg}。`;
    } else if (plan.eliteCount > 0) {
        G.dom.msgText.innerText = `第 ${waveNum} 波來襲：含高護甲菁英與機制怪，可善用火塔破甲或跨元素融合${bonusMsg}。`;
    } else {
        G.dom.msgText.innerText = `第 ${waveNum} 波來襲：共 ${plan.queue.length} 隻敵軍進攻中${bonusMsg}。`;
    }
    updateHUD();
    GameAnalyticsTracker.trackProgression('Start', waveNum, st.currentMapId);
}

function finalizeOutcomeScreen(nextWaveState, soundKind) {
    const st = G.state;
    st.isPaused = false; st.waveState = nextWaveState;
    if (st.rafId !== null) { cancelAnimationFrame(st.rafId); st.rafId = null; }
    clearAllGameTimers(); Renderer.clearTouchDragVisuals();
    st.draggedIndex = null; st.hoveredIndex = null;
    Renderer.updateRangeIndicator(); updateHUD(); SoundEngine.playOutcome(soundKind);
}

function triggerVictory() {
    const st = G.state;
    if (st.isGameOver || st.waveState === 'VICTORY') return;
    let starsNum = 1, stars = '★', rankText = '驚險死守，於危急時刻擊退腐朽古樹王。';
    if (st.baseHp >= CONFIG.INITIAL_BASE_HP) { starsNum = 3; stars = '★★★'; rankText = '完美防守，世界樹滿血守護通關第 10 波。'; }
    else if (st.baseHp >= 10) { starsNum = 2; stars = '★★'; rankText = '穩固防線，成功守護世界樹擊敗腐朽古樹王。'; }

    Backend.saveMapRecord(st.currentMapId, st.currentWave, starsNum);
    st.bestWave = Math.max(st.bestWave, st.currentWave);
    renderMapSelectorUI();
    finalizeOutcomeScreen('VICTORY', 'victory');
    GameAnalyticsTracker.trackProgression('Complete', st.currentWave, st.currentMapId, st.currentGold);
    GameAnalyticsTracker.trackDesign(`Run:Victory:${st.currentMapId}:Wave_${st.currentWave}`, st.baseHp);
    setDomText(G.dom.victoryStarsEl, stars); setDomText(G.dom.victoryRankTextEl, rankText);
    populateBattleRecap('victory');
    if (G.dom.victoryOverlayEl) G.dom.victoryOverlayEl.classList.remove('hidden');
}

function triggerGameOver() {
    const st = G.state;
    if (st.isGameOver && st.waveState === 'GAMEOVER') return;
    st.isGameOver = true;
    ['startOverlayEl', 'victoryOverlayEl', 'codexOverlayEl', 'blessingOverlayEl'].forEach(k => {
        if (G.dom[k]) G.dom[k].classList.add('hidden');
    });
    finalizeOutcomeScreen('GAMEOVER', 'gameover');
    GameAnalyticsTracker.trackProgression('Fail', st.currentWave, st.currentMapId, st.killsCount);
    GameAnalyticsTracker.trackDesign(`Run:Fail:${st.currentMapId}:Wave_${st.currentWave}`, st.killsCount);
    populateBattleRecap('gameover');
    if (G.dom.newRecordBadgeEl) G.dom.newRecordBadgeEl.classList.toggle('hidden', !st.isNewRecordThisRun);
    if (G.dom.gameOverOverlayEl) G.dom.gameOverOverlayEl.classList.remove('hidden');
}

function resetMatchSession(initialWaveState, resetSpeed = 1) {
    const prev = G.state;
    if (prev.rafId !== null) cancelAnimationFrame(prev.rafId);
    const nextSession = prev.sessionId + 1;
    clearAllGameTimers();
    if (G.dom.boardStageEl) G.dom.boardStageEl.classList.remove('tree-hit-shake');
    for (const rec of G.monsterDomMap.values()) rec.el.remove();
    G.monsterDomMap.clear();
    if (G.dom.monsterLayerEl) G.dom.monsterLayerEl.innerHTML = '';
    if (G.dom.floatingLayerEl) G.dom.floatingLayerEl.innerHTML = '';
    Renderer.clearTouchDragVisuals();

    G.state = createInitialMatchState(prev.currentMapId, initialWaveState, nextSession, resetSpeed);
    G.state.isTouchMode = prev.isTouchMode;
    ['startOverlayEl', 'victoryOverlayEl', 'gameOverOverlayEl', 'codexOverlayEl', 'blessingOverlayEl'].forEach(k => {
        if (G.dom[k]) G.dom[k].classList.add('hidden');
    });
    syncPauseUI();
}

function restartGame() {
    resetMatchSession('PREP', 1);
    G.dom.msgText.innerText = `【${Combat.getCurrentMapSpec().name}】開局可召喚元素塔並拖曳或點擊融合；點擊圖鑑按鈕或按 1/2/3/Q/W/Space 快速操作！`;
    Renderer.renderBoard(); updateHUD(); updateSpeedButtonUI(); startMainLoop();
}

function returnToMainMenu() {
    resetMatchSession('WAITING_START', 1);
    Combat.applyMapConfig(G.state.currentMapId);
    renderMapSelectorUI();
    if (G.dom.startOverlayEl) G.dom.startOverlayEl.classList.remove('hidden');
    G.dom.msgText.innerText = '已回到主選單！請選擇戰場地圖，點擊「開始防守」隨時開戰！';
    Renderer.initBoard(); Renderer.renderBoard(); updateHUD(); updateSpeedButtonUI();
}

function startGame() {
    const st = G.state;
    if (st.waveState !== 'WAITING_START') return;
    if (G.dom.startOverlayEl) G.dom.startOverlayEl.classList.add('hidden');
    st.waveState = 'PREP'; st.waveTimerMs = CONFIG.INITIAL_PREP_MS;
    G.dom.msgText.innerText = `【${Combat.getCurrentMapSpec().name}】備戰開始！先點空草地可指定落點，點擊或拖曳同星元素可跨階融合！`;
    setPauseState(false, { silent: true });
}

function continueEndlessMode() {
    const st = G.state;
    if (st.waveState !== 'VICTORY') return;
    st.isEndlessMode = true;
    if (G.dom.victoryOverlayEl) G.dom.victoryOverlayEl.classList.add('hidden');
    st.waveState = 'INTERMISSION'; st.waveTimerMs = CONFIG.WAVE_INTERMISSION_MS;
    G.dom.msgText.innerText = '🔥 無盡模式開啟！已解除波數上限，繼續挑戰更高紀錄吧！';
    setPauseState(false, { silent: true });
}

function gameTick(timestamp) {
    const st = G.state, tickSessionId = st.sessionId;
    if (st.baseHp <= 0 && !st.isGameOver) { triggerGameOver(); return; }
    if (!isGameplayActive()) return;
    if (st.lastFrameTime === null) st.lastFrameTime = timestamp;
    const rawDt = Math.min(0.1, Math.max(0, (timestamp - st.lastFrameTime) / 1000));
    st.lastFrameTime = timestamp;
    const dtMs = rawDt * clampNumber(st.gameSpeed, 1, 5, 1) * 1000;

    st.entangleCdMs = Math.max(0, st.entangleCdMs - dtMs);
    st.frenzyCdMs = Math.max(0, st.frenzyCdMs - dtMs);
    const wasFrenzy = st.frenzyActiveMs > 0;
    st.frenzyActiveMs = Math.max(0, st.frenzyActiveMs - dtMs);
    if (wasFrenzy && st.frenzyActiveMs === 0) {
        for (let i = 0; i < G.towerElements.length; i++) if (G.towerElements[i]) G.towerElements[i].classList.remove('frenzy-active');
        updateTowerInspector();
    }
    if (st.entangleCdMs > 0 || st.frenzyCdMs > 0 || wasFrenzy) updateSkillButtonsUI();

    if (st.waveState === 'PREP' || st.waveState === 'INTERMISSION') {
        const prevSec = Math.ceil(st.waveTimerMs / 1000);
        st.waveTimerMs -= dtMs;
        if (st.waveTimerMs <= 0) startWave(st.waveState === 'PREP' ? 1 : st.currentWave + 1);
        else if (prevSec !== Math.ceil(st.waveTimerMs / 1000)) updateWavePhaseUI();
    } else if (st.waveState === 'SPAWNING') {
        st.waveSpawnAccMs += dtMs;
        while (st.waveSpawnAccMs >= st.waveSpawnIntervalMs && st.waveSpawnQueue.length > 0) {
            st.waveSpawnAccMs -= st.waveSpawnIntervalMs;
            Combat.spawnMonsterFromEntry(st.waveSpawnQueue.shift());
            if (st.waveSpawnQueue.length === 0) { st.waveState = 'CLEARING'; updateWavePhaseUI(); }
        }
    } else if (st.waveState === 'CLEARING' && st.monsters.length === 0) {
        if (!st.isEndlessMode && st.currentWave === CONFIG.VICTORY_WAVE) { triggerVictory(); return; }
        GameAnalyticsTracker.trackProgression('Complete', st.currentWave, st.currentMapId, st.currentGold);
        if (st.currentWave % CONFIG.BLESSING_INTERVAL_WAVES === 0 && !st.blessingGrantedWaves.has(st.currentWave) && triggerBlessingSelection(st.currentWave)) return;
        st.waveState = 'INTERMISSION'; st.waveTimerMs = CONFIG.WAVE_INTERMISSION_MS;
        G.dom.msgText.innerText = `🎉 第 ${st.currentWave} 波防禦成功！下一波將於 ${Math.ceil(CONFIG.WAVE_INTERMISSION_MS / 1000)} 秒後出發！`;
        updateWavePhaseUI();
    }

    if (st.monsters.length > 0) { Combat.updateMonsters(dtMs); if (st.isGameOver || tickSessionId !== st.sessionId) return; }
    Combat.updateTowersCombat(dtMs);
    Renderer.updateAndRenderCanvasFX(dtMs);
    if (tickSessionId === st.sessionId && isGameplayActive()) st.rafId = requestAnimationFrame(gameTick);
}

function startMainLoop() {
    if (G.state.rafId !== null) cancelAnimationFrame(G.state.rafId);
    G.state.lastFrameTime = null; G.state.rafId = requestAnimationFrame(gameTick);
}

// ==================== 8. 操作事件綁定、快捷鍵與啟動 ====================
function setPauseState(paused, options = {}) {
    const st = G.state;
    const silent = Boolean(options && options.silent);
    const nextPaused = Boolean(paused);
    if (nextPaused && !isMatchPhaseActive()) {
        st.isPaused = false;
        syncPauseUI();
        return false;
    }
    st.isPaused = nextPaused;
    if (st.isPaused) {
        if (st.rafId !== null) { cancelAnimationFrame(st.rafId); st.rafId = null; }
        Renderer.clearTouchDragVisuals(); st.draggedIndex = null; st.hoveredIndex = null; Renderer.updateRangeIndicator();
        if (!silent) setDomText(G.dom.msgText, '遊戲已暫停（可點防禦塔檢視資訊，按「繼續」或 Space 恢復）。');
        updateHUD();
    } else {
        if (!silent && isMatchPhaseActive()) setDomText(G.dom.msgText, '遊戲繼續，守護世界樹防線。');
        updateHUD();
        if (isGameplayActive()) startMainLoop();
    }
    return true;
}

function toggleCombatPause() {
    if (!isMatchPhaseActive()) return;
    setPauseState(!G.state.isPaused);
}

function cycleSelectedTowerTargetMode() {
    const st = G.state;
    if (!isGameplayActive() || st.selectedIndex === null || st.board[st.selectedIndex] === null) return;
    const t = st.board[st.selectedIndex];
    t.targetMode = TARGET_MODE_CYCLE[(TARGET_MODE_CYCLE.indexOf(t.targetMode || 'first') + 1) % TARGET_MODE_CYCLE.length];
    updateTowerInspector();
    G.dom.msgText.innerText = `🎯 已將【${ELEMENT_CONFIG[t.type].name}】索敵優先級切換為：${TARGET_MODE_LABELS[t.targetMode]}`;
}

function sellSelectedTower() {
    const st = G.state;
    if (!isGameplayActive() || st.selectedIndex === null || st.board[st.selectedIndex] === null) return;
    const sellIdx = st.selectedIndex, t = st.board[sellIdx], refund = Combat.getTowerSellRefund(t);
    st.currentGold += refund; st.board[sellIdx] = null;
    st.selectedIndex = null; st.hoveredIndex = null; st.buildTargetIndex = null;
    G.dom.msgText.innerText = `💰 已出售【${ELEMENT_CONFIG[t.type].name} ${Renderer.getTierStars(t.tier)}】！退還 +${refund} 💰。`;
    Renderer.renderBoard([sellIdx]); updateHUD();
}

function triggerEarlyNextWave() {
    const st = G.state;
    if (!isGameplayActive() || (st.waveState !== 'PREP' && st.waveState !== 'INTERMISSION')) return;
    const bonus = getEarlyWaveBonus();
    st.currentGold += bonus; st.totalGoldEarned += bonus;
    startWave(st.waveState === 'PREP' ? 1 : st.currentWave + 1, bonus);
}

function cycleGameSpeed() { G.state.gameSpeed = (G.state.gameSpeed % 3) + 1; updateSpeedButtonUI(); }
function openCodex() {
    if (!G.dom.codexOverlayEl || isCodexOpen()) return;
    const st = G.state, activeMatch = isMatchPhaseActive();
    st.pausedBeforeCodex = st.isPaused;
    if (activeMatch) st.isPaused = true;
    G.dom.codexOverlayEl.classList.remove('hidden');
    if (st.rafId !== null) { cancelAnimationFrame(st.rafId); st.rafId = null; }
    if (activeMatch) updateHUD();
}

function closeCodex() {
    if (!G.dom.codexOverlayEl || !isCodexOpen()) return;
    const st = G.state;
    const restorePaused = Boolean(st.pausedBeforeCodex);
    st.pausedBeforeCodex = false;
    G.dom.codexOverlayEl.classList.add('hidden');
    if (isMatchPhaseActive()) {
        setPauseState(restorePaused, { silent: true });
    } else {
        updateHUD();
    }
}

[
    ['inspectorTargetBtn', cycleSelectedTowerTargetMode], ['inspectorSellBtn', sellSelectedTower], ['nextWaveBtn', triggerEarlyNextWave],
    ['skillEntangleBtn', castEntangleSkill], ['skillFrenzyBtn', castFrenzySkill], ['pauseBtn', toggleCombatPause], ['soundBtn', () => SoundEngine.toggleMute()],
    ['codexBtn', openCodex], ['codexCloseBtn', closeCodex], ['speedBtn', cycleGameSpeed], ['startGameBtn', startGame],
    ['victoryRestartBtn', restartGame], ['victoryMenuBtn', returnToMainMenu], ['endlessBtn', continueEndlessMode],
    ['restartBtn', restartGame], ['gameoverMenuBtn', returnToMainMenu],
    ['addGoldBtn', () => { if (CONFIG.DEBUG_MODE && isGameplayActive()) { G.state.currentGold += 500; G.dom.msgText.innerText = '🛠️ 已增加 500 💰！'; updateHUD(); } }],
    ['clearGoldBtn', () => { if (CONFIG.DEBUG_MODE && isGameplayActive()) { G.state.currentGold = 0; G.dom.msgText.innerText = '🛠️ 金幣已歸零！'; updateHUD(); } }]
].forEach(([domKey, fn]) => { if (G.dom[domKey]) G.dom[domKey].addEventListener('click', fn); });

if (G.dom.mapSelectorGridEl) {
    G.dom.mapSelectorGridEl.addEventListener('click', (e) => {
        const card = e.target && e.target.closest ? e.target.closest('.map-card') : null;
        if (card && card.dataset.mapId) { SoundEngine.ensureContext(); selectMap(card.dataset.mapId); }
    });
}

const SPAWN_HOTKEY_MAP = { '1': 'fire', Numpad1: 'fire', '2': 'ice', Numpad2: 'ice', '3': 'thunder', Numpad3: 'thunder' };

if (typeof document !== 'undefined') {
    document.addEventListener('pointerdown', (e) => {
        SoundEngine.ensureContext();
        if (e.pointerType === 'touch') activateTouchMode();
        else if (e.pointerType === 'mouse' && (!e.sourceCapabilities || !e.sourceCapabilities.firesTouchEvents)) G.state.isTouchMode = false;
    }, true);
    document.addEventListener('pointermove', (e) => {
        if (e.pointerType === 'mouse' && (!e.sourceCapabilities || !e.sourceCapabilities.firesTouchEvents)) G.state.isTouchMode = false;
    }, true);
    document.addEventListener('touchstart', () => { SoundEngine.ensureContext(); activateTouchMode(); }, { passive: true, capture: true });

    document.addEventListener('touchmove', (e) => {
        const st = G.state;
        if (!st.touchDragState || e.touches.length !== 1) return;
        const touch = e.touches[0];
        if (!st.touchDragState.isDragging && Math.hypot(touch.clientX - st.touchDragState.startX, touch.clientY - st.touchDragState.startY) > 10) {
            st.touchDragState.isDragging = true; st.selectedIndex = null; st.buildTargetIndex = null; st.hoveredIndex = null;
            st.touchDragState.towerEl.classList.add('dragging');
            const ghost = st.touchDragState.towerEl.cloneNode(true);
            ghost.classList.remove('dragging'); ghost.classList.add('touch-drag-ghost');
            ghost.style.width = `${st.touchDragState.towerEl.offsetWidth}px`; ghost.style.height = `${st.touchDragState.towerEl.offsetHeight}px`;
            document.body.appendChild(ghost); st.touchDragState.ghostEl = ghost;
            Renderer.updateRangeIndicator(); updateTowerInspector();
            G.dom.msgText.innerText = `拖曳【${st.touchDragState.cfg.name} ${Renderer.getTierStars(st.touchDragState.tier)}】至目標格`;
        }
        if (st.touchDragState.isDragging) {
            e.preventDefault();
            if (st.touchDragState.ghostEl) { st.touchDragState.ghostEl.style.left = `${touch.clientX}px`; st.touchDragState.ghostEl.style.top = `${touch.clientY}px`; }
            Renderer.clearCellDragHighlights();
            const under = document.elementFromPoint(touch.clientX, touch.clientY), cell = under ? under.closest('.cell') : null;
            if (cell) cell.classList.add(G.map.pathCellIndices.has(Number(cell.dataset.index)) ? 'drag-invalid' : 'drag-over');
        }
    }, { passive: false });

    document.addEventListener('touchend', (e) => {
        const st = G.state;
        if (!st.touchDragState) return;
        if (st.touchDragState.isDragging) {
            const touch = e.changedTouches[0], under = touch ? document.elementFromPoint(touch.clientX, touch.clientY) : null, cell = under ? under.closest('.cell') : null;
            const sourceIdx = st.touchDragState.sourceIndex;
            Renderer.clearTouchDragVisuals(); st.lastTouchDragEndTime = performance.now();
            if (cell) handleAction(sourceIdx, Number(cell.dataset.index)); else Renderer.updateRangeIndicator();
        } else { st.touchDragState = null; }
    });
    document.addEventListener('touchcancel', () => { if (G.state.touchDragState) { Renderer.clearTouchDragVisuals(); Renderer.updateRangeIndicator(); } });

    window.addEventListener('keydown', (e) => {
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        const t = e.target, tag = t && t.tagName ? t.tagName.toUpperCase() : '';
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (t && t.isContentEditable)) return;

        const key = e.key || '', lowerKey = key.toLowerCase(), st = G.state;
        if (key === 'Escape') {
            if (isCodexOpen()) { e.preventDefault(); closeCodex(); }
            else if (isMatchPhaseActive() && (st.selectedIndex !== null || st.buildTargetIndex !== null)) {
                e.preventDefault(); st.selectedIndex = null; st.buildTargetIndex = null; Renderer.renderBoard([]);
                setDomText(G.dom.msgText, '已取消選取格位。');
            }
            return;
        }
        if (e.code === 'Space' || key === ' ') {
            if (!isAnyModalOpen() && isMatchPhaseActive()) {
                e.preventDefault();
                if (e.repeat) return;
                if (t && typeof t.blur === 'function' && tag === 'BUTTON') t.blur();
                SoundEngine.ensureContext();
                setPauseState(!st.isPaused);
            }
            return;
        }
        if (isAnyModalOpen() || !isMatchPhaseActive()) return;
        if (key === 'Tab' || lowerKey === 's') { e.preventDefault(); SoundEngine.ensureContext(); cycleGameSpeed(); return; }
        if (!isGameplayActive()) return;
        const spawnType = SPAWN_HOTKEY_MAP[key] || SPAWN_HOTKEY_MAP[e.code];
        if (spawnType) { e.preventDefault(); SoundEngine.ensureContext(); handleSpawn(spawnType, G.dom.spawnerBtns[spawnType] && G.dom.spawnerBtns[spawnType].btn); }
        else if (lowerKey === 'q') { e.preventDefault(); SoundEngine.ensureContext(); castEntangleSkill(); }
        else if (lowerKey === 'w') { e.preventDefault(); SoundEngine.ensureContext(); castFrenzySkill(); }
    });
}

function handleBoardLayoutChange() { Renderer.measureBoardMetrics(); Renderer.repositionAllMonsters(); Renderer.updateRangeIndicator(); }
window.addEventListener('resize', handleBoardLayoutChange);
if (typeof ResizeObserver !== 'undefined' && G.dom.boardElement) new ResizeObserver(handleBoardLayoutChange).observe(G.dom.boardElement);

G.callbacks = {
    isGameplayActive, isMatchPhaseActive, setPauseState, scheduleTimeout: scheduleGameTimeout, updateHUD,
    updateTowerInspector, updateBossStatusBar, triggerGameOver, handleCellClick, handleAction,
    activateTouchMode, recordTowerDamage: Combat.recordTowerDamage
};

Renderer.bind(G);
Combat.bind(G);
Combat.applyMapConfig('forest');
G.state.bestWave = Backend.getMapBestWave(G.state.currentMapId);
SoundEngine.setOnToggle(updateSoundButtonUI);

const dbgMode = CONFIG.DEBUG_MODE ? 'inline-block' : 'none';
if (G.dom.addGoldBtn) G.dom.addGoldBtn.style.display = dbgMode;
if (G.dom.clearGoldBtn) G.dom.clearGoldBtn.style.display = dbgMode;

renderSpawnerButtons();
Renderer.initBoard();
Renderer.renderBoard();
renderMapSelectorUI();
updateHUD();
updateSpeedButtonUI();
updateSoundButtonUI();

Backend.init({
    onBalanceApplied: () => {
        if (G.dom.spawnerContainer) renderSpawnerButtons();
        updateHUD(); updateTowerInspector(); Renderer.updateRangeIndicator();
    }
});
