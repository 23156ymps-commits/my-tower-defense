/**
 * ============================================================================
 * 【檔案名稱】：core/game.js
 * 【負責功能】：全遊戲總指揮官（主心跳迴圈 gameTick、頂部 HUD 與固定式塔檢查列更新、
 *               動態商店召喚區生成、結算彈窗 5 秒體感快評與複製戰報綁定、快捷鍵控制）。
 * 【讀取資料】：整合讀取 GameApp.config、GameApp.data.* 與 GameApp.systems.* 全部九大模組。
 * 【常見修改入口】：
 *   1. 修改每幀主迴圈推進邏輯：修改 gameTick()。
 *   2. 修改召喚落地、移位合成或結算視窗顯示：修改 spawnTowerAtCell()、handleAction()、populateBattleRecap()。
 * ============================================================================
 */
(function (global) {
    'use strict';

    const GameApp = global.GameApp = global.GameApp || {};
    const CONFIG = GameApp.config || {};
    const { clampNumber, indexToCoords } = GameApp.helpers || {};

    const SoundEngine = GameApp.audio;
    const Backend = GameApp.backend;
    const Renderer = GameApp.renderer;

    const EconSys = GameApp.systems.economy;
    const TerrainSys = GameApp.systems.terrain;
    const WaveSys = GameApp.systems.wave;
    const AttackSys = GameApp.systems.towerAttack;
    const EvoSys = GameApp.systems.evolution;
    const MonsterSys = GameApp.systems.monster;
    const TreeSys = GameApp.systems.tree;
    const CodexSys = GameApp.systems.codex;
    const DragSys = GameApp.systems.drag;

    // 向下相容橋接物件 window.GameCombat
    global.GameCombat = Object.assign({}, WaveSys, TerrainSys, AttackSys, EvoSys, MonsterSys, TreeSys, EconSys);

    // ==================== 1. DOM 快取與共享執行狀態 ====================
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
        ['pauseBannerEl', 'pause-banner'], ['pauseResumeBtn', 'pause-resume-btn'], ['pauseMenuBtn', 'pause-menu-btn'],
        ['addGoldBtn', 'add-gold-btn'], ['clearGoldBtn', 'clear-gold-btn'], ['nextWaveBtn', 'next-wave-btn'], ['speedBtn', 'speed-btn'],
        ['goldDisplay', 'gold-display'], ['baseHpDisplay', 'base-hp-display'], ['dewDisplay', 'dew-display'], ['dewBarFillEl', 'dew-bar-fill'],
        ['waveDisplay', 'wave-display'], ['wavePhaseTagEl', 'wave-phase-tag'], ['bestWaveDisplay', 'best-wave-display'], ['msgText', 'msg-text'],
        ['startOverlayEl', 'start-overlay'], ['mapSelectorGridEl', 'map-selector-grid'], ['mapRecordForestEl', 'map-record-forest'],
        ['mapRecordLavaEl', 'map-record-lava'], ['startGameBtn', 'start-game-btn'],
        ['victoryOverlayEl', 'victory-overlay'], ['victoryStarsEl', 'victory-stars'], ['victoryRankTextEl', 'victory-rank-text'],
        ['victoryMapTextEl', 'victory-map-text'], ['victoryKillsTextEl', 'victory-kills-text'], ['victoryHpTextEl', 'victory-hp-text'],
        ['victoryGoldTextEl', 'victory-gold-text'], ['victoryMvpTextEl', 'victory-mvp-text'], ['victoryGoldEarnedTextEl', 'victory-gold-earned-text'],
        ['victoryFusionTextEl', 'victory-fusion-text'], ['victoryRestartBtn', 'victory-restart-btn'], ['victoryMenuBtn', 'victory-menu-btn'], ['endlessBtn', 'endless-btn'],
        ['victoryRatingStatusEl', 'victory-rating-status'], ['victoryCopyReportBtn', 'victory-copy-report-btn'],
        ['gameOverOverlayEl', 'game-over-overlay'], ['gameoverMapTextEl', 'gameover-map-text'], ['finalWaveTextEl', 'final-wave-text'],
        ['finalBestTextEl', 'final-best-text'], ['finalKillsTextEl', 'final-kills-text'], ['gameoverMvpTextEl', 'gameover-mvp-text'],
        ['gameoverGoldEarnedTextEl', 'gameover-gold-earned-text'], ['gameoverFusionTextEl', 'gameover-fusion-text'],
        ['gameoverBreakerRowEl', 'gameover-breaker-row'], ['gameoverBreakerTextEl', 'gameover-breaker-text'],
        ['newRecordBadgeEl', 'new-record-badge'], ['restartBtn', 'restart-btn'], ['gameoverMenuBtn', 'gameover-menu-btn'],
        ['gameoverRatingStatusEl', 'gameover-rating-status'], ['gameoverCopyReportBtn', 'gameover-copy-report-btn'],
        ['helpBtn', 'help-btn'], ['guideOverlayEl', 'guide-overlay'], ['guideCloseBtn', 'guide-close-btn'], ['guideMenuBtn', 'guide-menu-btn'],
        ['terrainTooltipEl', 'terrain-tooltip'], ['towerTooltipEl', 'tower-tooltip'], ['waveForecastBarEl', 'wave-forecast-bar'],
        ['forecastToggleBtn', 'forecast-toggle-btn'], ['forecastBarTitleEl', 'forecast-bar-title'],
        ['forecastToggleIndicatorEl', 'forecast-toggle-indicator'], ['forecastInlineSummaryEl', 'forecast-inline-summary'],
        ['forecastDetailDrawerEl', 'forecast-detail-drawer'],
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

    function getMapsConfig() {
        return (GameApp.data && GameApp.data.routes && GameApp.data.routes.MAPS_CONFIG) || {};
    }

    function getTowersDict() {
        return (GameApp.data && GameApp.data.towers && GameApp.data.towers.TOWERS) || {};
    }

    function getShopTowerTypes() {
        if (GameApp.data && GameApp.data.towers && typeof GameApp.data.towers.getShopTowerTypes === 'function') {
            return GameApp.data.towers.getShopTowerTypes();
        }
        return Object.keys(getTowersDict()).filter(k => !getTowersDict()[k].isHybrid);
    }

    function createInitialMatchState(mapId = 'forest', initialWaveState = 'WAITING_START', nextSessionId = 1, keepSpeed = 1) {
        const maps = getMapsConfig();
        const spec = maps[mapId] || maps.forest || { id: 'forest', name: '🌲 晨光森林', startGoldBonus: 0 };
        const treeCfg = (GameApp.data && GameApp.data.tree && GameApp.data.tree.TREE_CONFIG) || {};
        const wb = (GameApp.data && GameApp.data.routes && GameApp.data.routes.WAVE_BALANCE) || {};

        const spawnCounts = {};
        getShopTowerTypes().forEach(tKey => { spawnCounts[tKey] = 0; });

        return {
            currentMapId: spec.id,
            currentGold: EconSys ? EconSys.getInitialGold(spec) : (40 + (spec.startGoldBonus || 0)),
            baseHp: treeCfg.INITIAL_BASE_HP || CONFIG.INITIAL_BASE_HP || 20,
            dewEnergy: treeCfg.DEW_INITIAL || CONFIG.DEW_INITIAL || 20,
            entangleCdMs: 0, frenzyCdMs: 0, frenzyActiveMs: 0,
            activeBlessings: new Set(), blessingGrantedWaves: new Set(), blessingChoices: [],
            seedPityCount: 0, treeHitShakeTimer: null,
            bestWave: Backend.getMapBestWave(spec.id), currentWave: 1, killsCount: 0,
            towerUidCounter: 1, totalTeamDamage: 0, totalGoldEarned: 0, fusionCount: 0,
            peakTowerSnapshot: null, lastBreakerName: '',
            isPaused: false, pausedBeforeCodex: false, pausedBeforeGuide: false, forecastDrawerOpen: false,
            isGameOver: false, isEndlessMode: false, isNewRecordThisRun: false,
            gameSpeed: keepSpeed,
            spawnCounts,
            board: Array(CONFIG.BOARD_SIZE || 150).fill(null), monsters: [], monsterIdCounter: 1,
            selectedIndex: null, buildTargetIndex: null, hoveredIndex: null, draggedIndex: null,
            lastRenderedSelected: null, lastRenderedBuildTarget: null,
            isTouchMode: false, touchDragState: null, lastTouchDragEndTime: 0,
            sessionId: nextSessionId, activeTimers: new Set(), pendingBolts: [], towerPhaseSeq: 0,
            waveState: initialWaveState, waveTimerMs: CONFIG.INITIAL_PREP_MS || 6000,
            waveSpawnQueue: [], waveSpawnIntervalMs: wb.SPAWN_INTERVAL_BASE_MS || 1600, waveSpawnAccMs: 0,
            lastFrameTime: null, rafId: null
        };
    }

    const G = {
        dom: buildDomCache(),
        state: createInitialMatchState('forest', 'WAITING_START', 1, 1),
        map: {
            waypoints: [], startCellIndex: 0, endCellIndex: (CONFIG.BOARD_SIZE || 150) - 1,
            pathCellIndices: new Set(), cellPathDist: new Float32Array(CONFIG.BOARD_SIZE || 150),
            terrainMap: new Map(), waypointCumDist: [0], pathFlowArrows: new Map()
        },
        boardMetrics: { originX: 8, originY: 8, cellW: 34, cellH: 34, stepX: 37, stepY: 37, step: 37, stageW: 560, stageH: 380 },
        cellElements: [],
        towerElements: Array(CONFIG.BOARD_SIZE || 150).fill(null),
        monsterDomMap: new Map(),
        fxEntities: { projectiles: [], bolts: [], beams: [], rings: [], particles: [], flashes: [], leaves: [], leafEmitAccMs: 0, frenzyFxAccMs: 0 },
        callbacks: {}
    };

    GameApp.runtime = G;

    // ==================== 2. 生命週期與跨局計時器隔離 ====================
    function isOverlayVisible(el) { return Boolean(el && !el.classList.contains('hidden')); }
    function isCodexOpen() { return CodexSys ? CodexSys.isCodexOpen() : isOverlayVisible(G.dom.codexOverlayEl); }
    function isGuideOpen() { return isOverlayVisible(G.dom.guideOverlayEl); }
    function isAnyModalOpen() {
        const dom = G.dom, st = G.state;
        return isOverlayVisible(dom.startOverlayEl)
            || isCodexOpen()
            || isGuideOpen()
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
        return !st.isGameOver && !st.isPaused && st.waveState !== 'WAITING_START' && st.waveState !== 'VICTORY' && st.waveState !== 'BLESSING_SELECT' && !isCodexOpen() && !isGuideOpen();
    }
    function isMatchPhaseActive() {
        const st = G.state;
        return !st.isGameOver && st.waveState !== 'WAITING_START' && st.waveState !== 'VICTORY' && st.waveState !== 'BLESSING_SELECT' && !isCodexOpen() && !isGuideOpen();
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

    // ==================== 3. 地圖選擇與局末戰報 ====================
    function renderMapSelectorUI() {
        const records = Backend.loadMapRecords();
        if (G.dom.mapSelectorGridEl) {
            G.dom.mapSelectorGridEl.querySelectorAll('.map-card').forEach(card => {
                const isSel = card.dataset.mapId === G.state.currentMapId;
                card.classList.toggle('selected', isSel);
                card.setAttribute('aria-pressed', isSel ? 'true' : 'false');
            });
        }
        const fmt = rec => `最高 Wave ${(rec && rec.bestWave) || 1} · ${(rec && rec.bestStars > 0) ? `通關 ${'★'.repeat(rec.bestStars)}` : '尚未通關'}`;
        if (G.dom.mapRecordForestEl) G.dom.mapRecordForestEl.innerText = fmt(records.forest);
        if (G.dom.mapRecordLavaEl) G.dom.mapRecordLavaEl.innerText = fmt(records.lava);
    }

    function selectMap(mapId) {
        const st = G.state;
        const maps = getMapsConfig();
        if (st.waveState !== 'WAITING_START' || !maps[mapId] || mapId === st.currentMapId) return;
        WaveSys.applyMapConfig(mapId);
        const mapSpec = WaveSys.getCurrentMapSpec();
        st.bestWave = Backend.getMapBestWave(st.currentMapId);
        st.currentGold = EconSys.getInitialGold(mapSpec);
        st.selectedIndex = null; st.buildTargetIndex = null; st.hoveredIndex = null;
        Renderer.initBoard();
        Renderer.renderBoard();
        renderMapSelectorUI();
        updateHUD();
        const bonusNote = mapSpec.startGoldBonus > 0 ? `（起始 💰 +${mapSpec.startGoldBonus}，擊殺 💰 +${Math.round((mapSpec.killGoldMult - 1) * 100)}%）` : '';
        if (G.dom.msgText) G.dom.msgText.innerText = `已切換戰場【${mapSpec.name}】${bonusNote}，點擊「開始防守」開啟戰局。`;
        SoundEngine.playSpawn(1);
    }

    function getMvpData() {
        const st = G.state;
        const towersDict = getTowersDict();
        let bestBoardTower = null;
        for (let i = 0; i < st.board.length; i++) {
            const t = st.board[i];
            if (t && t.totalDamage > 0 && (!bestBoardTower || t.totalDamage > bestBoardTower.totalDamage)) bestBoardTower = t;
        }
        let mvp = null;
        if (bestBoardTower && (!st.peakTowerSnapshot || bestBoardTower.totalDamage >= st.peakTowerSnapshot.totalDamage)) {
            const cfg = towersDict[bestBoardTower.type];
            mvp = {
                type: bestBoardTower.type,
                tier: bestBoardTower.tier,
                name: cfg ? cfg.name : bestBoardTower.type,
                icon: cfg ? cfg.icon : '',
                totalDamage: bestBoardTower.totalDamage
            };
        } else if (st.peakTowerSnapshot && st.peakTowerSnapshot.totalDamage > 0) {
            mvp = st.peakTowerSnapshot;
        }
        if (!mvp || mvp.totalDamage <= 0) return { mvp: null, pct: 0, text: '尚無輸出紀錄' };
        const pct = st.totalTeamDamage > 0 ? Math.round((mvp.totalDamage / st.totalTeamDamage) * 100) : 0;
        const text = `${mvp.icon ? mvp.icon + ' ' : ''}${mvp.name} ${Renderer.getTierStars(mvp.tier)} — ${mvp.totalDamage.toLocaleString()} 傷害 (${pct}%)`;
        return { mvp, pct, text };
    }

    function getMvpSummaryText() {
        return getMvpData().text;
    }

    function setDomText(el, txt) { if (el) el.innerText = txt; }

    function resetFeedbackUI() {
        document.querySelectorAll('.feel-rating-btn').forEach(btn => btn.classList.remove('selected'));
        setDomText(G.dom.victoryRatingStatusEl, '點擊上方標籤一鍵回饋本局體感');
        setDomText(G.dom.gameoverRatingStatusEl, '點擊上方標籤一鍵回饋本局體感');
        if (G.dom.victoryCopyReportBtn) G.dom.victoryCopyReportBtn.innerText = '📋 複製本局數據戰報';
        if (G.dom.gameoverCopyReportBtn) G.dom.gameoverCopyReportBtn.innerText = '📋 複製本局數據戰報';
    }

    function populateBattleRecap(mode) {
        const st = G.state, dom = G.dom, mapSpec = WaveSys.getCurrentMapSpec();
        const { mvp, pct, text: mvpText } = getMvpData();
        const maxHp = (GameApp.data && GameApp.data.tree && GameApp.data.tree.TREE_CONFIG && GameApp.data.tree.TREE_CONFIG.INITIAL_BASE_HP) || CONFIG.INITIAL_BASE_HP || 20;

        if (mvp) {
            Backend.trackFeel(`MVP:DamageShare:${mvp.type}`, pct, { mvpType: mvp.type, sharePct: pct });
        }
        Backend.trackFeel('Economy:EndGold', st.currentGold, { endGold: st.currentGold, mode });

        resetFeedbackUI();

        if (mode === 'victory') {
            setDomText(dom.victoryMapTextEl, mapSpec.name);
            setDomText(dom.victoryKillsTextEl, `${st.killsCount} 隻`);
            setDomText(dom.victoryHpTextEl, `${st.baseHp} / ${maxHp}`);
            setDomText(dom.victoryGoldTextEl, `${st.currentGold} 💰`);
            setDomText(dom.victoryMvpTextEl, mvpText);
            setDomText(dom.victoryGoldEarnedTextEl, `${st.totalGoldEarned.toLocaleString()} 💰`);
            setDomText(dom.victoryFusionTextEl, `${st.fusionCount} 次`);
            return;
        }
        setDomText(dom.gameoverMapTextEl, mapSpec.name);
        setDomText(dom.finalWaveTextEl, st.isEndlessMode ? `Wave ${st.currentWave} (無盡)` : `Wave ${st.currentWave} / ${CONFIG.VICTORY_WAVE || 10}`);
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

    // ==================== 4. UI 更新與動態自動掃描 ====================
    function updateTowerInspector() {
        const dom = G.dom, st = G.state;
        if (!dom.inspectorEmptyEl || !dom.inspectorActiveEl) return;
        const terrainsDict = (GameApp.data && GameApp.data.terrain && GameApp.data.terrain.TERRAIN_TYPES) || {};
        const targetLabels = (GameApp.data && GameApp.data.towers && GameApp.data.towers.TARGET_MODE_LABELS) || { first: '最前', armor: '高護甲', lowhp: '殘血' };

        const hasTower = st.selectedIndex !== null && st.board[st.selectedIndex] !== null && !st.isGameOver && st.waveState !== 'VICTORY' && st.waveState !== 'BLESSING_SELECT';
        if (!hasTower) {
            dom.inspectorActiveEl.classList.add('hidden');
            dom.inspectorEmptyEl.classList.remove('hidden');
            if (st.buildTargetIndex !== null && st.board[st.buildTargetIndex] === null && TerrainSys.canBuildAt(st.buildTargetIndex)) {
                const c = indexToCoords(st.buildTargetIndex), terrain = TerrainSys.getTerrainAt(st.buildTargetIndex);
                const tInfo = terrain && terrainsDict[terrain];
                dom.inspectorEmptyEl.innerText = `已指定建造格 (${c.x + 1},${c.y + 1})${tInfo && tInfo.shortTag ? `｜${tInfo.shortTag}` : ''} — 按住下方元素卡拖曳至棋盤指定格即可召喚`;
            } else {
                dom.inspectorEmptyEl.innerText = '按住下方元素卡拖入棋盤空地可指定格召喚；點選場上防禦塔可檢視 DPS、切換索敵或出售';
            }
            return;
        }

        const towerObj = st.board[st.selectedIndex], cfg = getTowersDict()[towerObj.type] || { icon: '✨', name: towerObj.type };
        const stats = AttackSys.getTowerInspectorStats(st.selectedIndex, towerObj), mode = towerObj.targetMode || 'first';
        const tInfo = stats.terrainType ? terrainsDict[stats.terrainType] : null;
        dom.inspectorEmptyEl.classList.add('hidden');
        dom.inspectorActiveEl.classList.remove('hidden');
        setDomText(dom.inspectorNameEl, `${cfg.icon} ${cfg.name} ${Renderer.getTierStars(towerObj.tier)}`);
        setDomText(dom.inspectorDpsEl, `DPS ${stats.dps}${cfg.attackStyle === 'pierce_beam' ? (towerObj.focusStacks > 0 ? ` (${towerObj.focusStacks} 層)` : ' (蓄能)') : ''}`);
        setDomText(dom.inspectorRangeEl, `射程 ${stats.rangeStr}`);
        if (dom.inspectorTerrainEl) {
            dom.inspectorTerrainEl.classList.toggle('hidden', !tInfo || !tInfo.shortTag);
            dom.inspectorTerrainEl.innerText = (tInfo && tInfo.shortTag) ? tInfo.shortTag : '';
        }
        setDomText(dom.inspectorTargetBtn, `索敵：${targetLabels[mode] || '最前'}`);
        setDomText(dom.inspectorSellBtn, `出售 (+${EconSys.getTowerSellRefund(towerObj)} 💰)`);
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
        const weakCfg = getTowersDict()[boss.weakness], weakShort = weakCfg ? `${weakCfg.icon}${weakCfg.name.charAt(0)}` : boss.weakness;
        const armorLabel = boss.armorShredTimer > 0 ? `🔥 ${Math.round(MonsterSys.getMonsterEffectiveArmor(boss))}/${boss.armor}` : `甲 ${boss.armor}`;
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
        if (labelEl) labelEl.innerText = `${skillName} (${cost} 靈露)`;
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
        const treeData = (GameApp.data && GameApp.data.tree) || {};
        const tc = treeData.TREE_CONFIG || {};
        const skills = treeData.ACTIVE_SKILLS || {};
        const dewMax = tc.DEW_MAX || 100;
        const ent = skills.entangle || { cost: 40, cdMs: 8000, name: '根鬚纏繞', hotkey: 'Q' };
        const frz = skills.frenzy || { cost: 60, cdMs: 12000, name: '自然狂熱', hotkey: 'W' };

        setDomText(dom.dewDisplay, `${st.dewEnergy}/${dewMax}`);
        if (dom.dewBarFillEl) dom.dewBarFillEl.style.width = `${Math.max(0, Math.min(100, (st.dewEnergy / dewMax) * 100))}%`;
        updateSkillBtnVisual(dom.skillEntangleBtn, dom.skillEntangleMask, dom.skillEntangleDewBar, dom.skillEntangleLabel, dom.skillEntangleSub, st.entangleCdMs, ent.cdMs, 0, ent.cost, ent.name, ent.hotkey, null);
        updateSkillBtnVisual(dom.skillFrenzyBtn, dom.skillFrenzyMask, dom.skillFrenzyDewBar, dom.skillFrenzyLabel, dom.skillFrenzySub, st.frenzyCdMs, frz.cdMs, st.frenzyActiveMs, frz.cost, frz.name, frz.hotkey, '狂熱中');
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
        if (dom.waveForecastBarEl) {
            dom.waveForecastBarEl.classList.toggle('hidden-by-pause', showPaused);
        }
    }

    function updateWavePhaseUI() {
        const dom = G.dom, st = G.state;
        if (!dom.wavePhaseTagEl) return;
        const isBoss = WaveSys.isBossWaveNumber(st.currentWave);
        dom.wavePhaseTagEl.classList.toggle('boss-wave', !st.isPaused && isBoss && (st.waveState === 'SPAWNING' || st.waveState === 'CLEARING'));
        dom.wavePhaseTagEl.classList.toggle('paused', st.isPaused);
        dom.wavePhaseTagEl.innerText = st.isPaused ? '已暫停' : ((WAVE_STATE_TEXT[st.waveState] && WAVE_STATE_TEXT[st.waveState](st, isBoss)) || '已結束');
        syncPauseUI();
        if (dom.nextWaveBtn) {
            const canSkip = isGameplayActive() && (st.waveState === 'PREP' || st.waveState === 'INTERMISSION');
            dom.nextWaveBtn.disabled = !canSkip;
            dom.nextWaveBtn.innerText = canSkip ? `${st.waveState === 'PREP' ? '立即開波' : '提前下波'} (+${EconSys.getEarlyWaveBonus()} 💰)` : '立即開波';
        }
    }

    function updateSeedPityUI() {
        const badge = G.dom.seedPityBadgeEl;
        if (!badge) return;
        const seedInterval = (GameApp.data && GameApp.data.tree && GameApp.data.tree.TREE_CONFIG && GameApp.data.tree.TREE_CONFIG.BLESSING_SEED_INTERVAL) || 5;
        if (!TreeSys.hasBlessing('abundant_seed')) { badge.classList.add('hidden'); badge.classList.remove('pity-ready'); return; }
        badge.classList.remove('hidden');
        badge.classList.toggle('pity-ready', G.state.seedPityCount === seedInterval - 1);
        badge.innerText = `豐饒種子保底進度：${G.state.seedPityCount}/${seedInterval}`;
    }

    function updateSpeedButtonUI() {
        const btn = G.dom.speedBtn;
        if (!btn) return;
        btn.classList.remove('speed-2x', 'speed-3x');
        if (G.state.gameSpeed === 2) { btn.classList.add('speed-2x'); btn.innerText = '2x'; }
        else if (G.state.gameSpeed === 3) { btn.classList.add('speed-3x'); btn.innerText = '3x'; }
        else btn.innerText = '1x';
    }

    function updateSoundButtonUI() {
        if (!G.dom.soundBtn) return;
        G.dom.soundBtn.classList.toggle('muted', SoundEngine.isMuted);
        G.dom.soundBtn.innerText = SoundEngine.isMuted ? '靜音' : '音效';
    }

    function summarizePlanInline(plan) {
        const monsterDb = (GameApp.data && GameApp.data.monsters && GameApp.data.monsters.MONSTER_DATABASE) || {};
        const towersDict = getTowersDict();
        const counts = new Map();
        for (let i = 0; i < plan.queue.length; i++) {
            const q = plan.queue[i];
            if (!q.isBoss) counts.set(q.typeKey, (counts.get(q.typeKey) || 0) + 1);
        }
        const parts = [];
        counts.forEach((cnt, key) => {
            const mCfg = monsterDb[key];
            if (!mCfg) return;
            const wCfg = towersDict[mCfg.weakness];
            parts.push(`${mCfg.name} ×${cnt}${wCfg ? `(弱${wCfg.name.charAt(0)})` : ''}`);
        });
        if (plan.bossMeta) {
            const bWeak = towersDict[plan.bossMeta.weakness];
            parts.push(`王·${plan.bossMeta.name}${bWeak ? `(弱${bWeak.name.charAt(0)})` : ''}`);
        } else if (plan.eliteCount > 0) {
            parts.push(`菁英 ×${plan.eliteCount}`);
        }
        return parts.join(' · ');
    }

    function renderForecastListInto(headerEl, listEl, waveNum, prefixLabel, isFinalClear = false) {
        if (!headerEl || !listEl) return;
        if (isFinalClear) {
            headerEl.innerText = `${prefixLabel} · 已達最終波`;
            listEl.innerHTML = '<li class="forecast-item forecast-boss">守住第 10 波即可通關</li>';
            return;
        }
        const monsterDb = (GameApp.data && GameApp.data.monsters && GameApp.data.monsters.MONSTER_DATABASE) || {};
        const towersDict = getTowersDict();
        const plan = WaveSys.buildWaveQueue(waveNum);
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
            const mCfg = monsterDb[key];
            if (!mCfg) return;
            const wCfg = towersDict[mCfg.weakness];
            const weakTag = wCfg ? `弱${wCfg.name.charAt(0)}` : '';
            items.push(`<li class="forecast-item"><span>${mCfg.name} <span class="num">×${cnt}</span></span><span class="forecast-weak weak-${mCfg.weakness}">${weakTag}</span></li>`);
        });
        if (plan.eliteCount > 0) {
            items.push(`<li class="forecast-meta num">含 ${plan.eliteCount} 隻護甲菁英（甲 ${plan.eliteArmor}）</li>`);
        }
        if (plan.bossMeta) {
            const bWeak = towersDict[plan.bossMeta.weakness];
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
        const isPrepPhase = st.waveState === 'PREP' || st.waveState === 'INTERMISSION' || st.waveState === 'WAITING_START';
        const targetWave = st.waveState === 'INTERMISSION' ? curWave + 1 : curWave;
        const nextWave = curWave + 1;
        const isFinalClear = !st.isEndlessMode && curWave >= (CONFIG.VICTORY_WAVE || 10);

        renderForecastListInto(dom.forecastCurrentHeaderEl, dom.forecastCurrentListEl, curWave, '本波情報');
        renderForecastListInto(dom.forecastNextHeaderEl, dom.forecastNextListEl, nextWave, '下波預告', isFinalClear);

        if (dom.forecastBarTitleEl) {
            dom.forecastBarTitleEl.innerText = isPrepPhase ? `下波預告 · Wave ${targetWave}` : `戰況預告 · Wave ${curWave}`;
        }
        if (dom.forecastInlineSummaryEl) {
            if (isPrepPhase) {
                const plan = WaveSys.buildWaveQueue(targetWave);
                dom.forecastInlineSummaryEl.innerText = summarizePlanInline(plan);
            } else {
                const nextPlan = !isFinalClear ? WaveSys.buildWaveQueue(nextWave) : null;
                dom.forecastInlineSummaryEl.innerText = nextPlan
                    ? `下波 W${nextWave}：${summarizePlanInline(nextPlan)}`
                    : '最終魔王決戰進行中';
            }
        }
        if (dom.waveForecastBarEl) {
            dom.waveForecastBarEl.classList.toggle('is-combat-collapsed', !isPrepPhase && !st.forecastDrawerOpen);
            dom.waveForecastBarEl.classList.toggle('drawer-open', Boolean(st.forecastDrawerOpen));
        }
        if (dom.forecastToggleBtn) {
            dom.forecastToggleBtn.setAttribute('aria-expanded', st.forecastDrawerOpen ? 'true' : 'false');
        }
        if (dom.forecastToggleIndicatorEl) {
            dom.forecastToggleIndicatorEl.innerText = st.forecastDrawerOpen ? '▴' : '▾';
        }
    }

    function toggleForecastDrawer() {
        const st = G.state;
        Backend.recordPlayerAction();
        st.forecastDrawerOpen = !st.forecastDrawerOpen;
        updateWaveForecastUI();
    }

    function updateHUD() {
        const dom = G.dom, st = G.state;
        const maxHp = (GameApp.data && GameApp.data.tree && GameApp.data.tree.TREE_CONFIG && GameApp.data.tree.TREE_CONFIG.INITIAL_BASE_HP) || 20;
        setDomText(dom.goldDisplay, st.currentGold);
        setDomText(dom.baseHpDisplay, `${st.baseHp}/${maxHp}`);
        setDomText(dom.waveDisplay, st.isEndlessMode ? `Wave ${st.currentWave} (無盡)` : `Wave ${st.currentWave} / ${CONFIG.VICTORY_WAVE || 10}`);
        setDomText(dom.bestWaveDisplay, `Wave ${st.bestWave}`);
        updateWavePhaseUI(); Renderer.updateWorldTreeVisualState(); updateSkillButtonsUI();
        updateSeedPityUI(); updateTowerInspector(); updateBossStatusBar(); updateSoundButtonUI();
        updateWaveForecastUI();

        const activePlay = isGameplayActive();
        const shopTypes = getShopTowerTypes();
        for (let i = 0; i < shopTypes.length; i++) {
            const type = shopTypes[i], ref = dom.spawnerBtns[type];
            if (!ref) continue;
            const cost = EconSys.getSummonCost(type);
            const isLowGold = st.currentGold < cost;
            if (ref.costEl) {
                ref.costEl.innerText = `${cost} 💰`;
                ref.costEl.classList.toggle('cost-insufficient', isLowGold);
            }
            ref.btn.classList.toggle('btn-low-gold', isLowGold);
            ref.btn.classList.toggle('btn-disabled', !activePlay || isLowGold);
        }
    }

    /**
     * 透過 Object.keys() 動態掃描 tower_data.js 基礎角色，生成下方「44x44 圖片 ＋ 名字 ＋ 價錢」三段式拖拉召喚卡片
     */
    function renderSpawnerButtons() {
        const container = G.dom.spawnerContainer;
        if (!container) return;
        container.innerHTML = '';
        G.dom.spawnerBtns = {};
        const towersDict = getTowersDict();
        const shopTypes = getShopTowerTypes();
        container.style.gridTemplateColumns = `repeat(${Math.max(1, shopTypes.length)}, 1fr)`;

        shopTypes.forEach(type => {
            const data = towersDict[type];
            if (!data) return;
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.id = `spawn-btn-${type}`;
            btn.dataset.towerType = type;
            btn.classList.add('spawn-card-btn', `btn-type-${type}`);
            if (data.color && !['fire', 'ice', 'thunder'].includes(type)) {
                btn.style.borderLeftColor = data.color;
            }
            const cost = EconSys.getSummonCost(type);
            btn.innerHTML = `
                <span class="spawn-card-portrait">
                    <canvas class="spawn-portrait-canvas" width="44" height="44" data-size="44" aria-hidden="true"></canvas>
                </span>
                <span class="spawn-card-name">${data.icon} ${data.name}</span>
                <span class="btn-cost-val num">${cost} 💰</span>
            `;
            const canvasEl = btn.querySelector('.spawn-portrait-canvas');
            if (canvasEl && Renderer && typeof Renderer.drawPortrait === 'function') {
                Renderer.drawPortrait(canvasEl, 'tower', type, { tier: 1, size: 44 });
            }
            DragSys.bindShopCardElement(btn, type);
            container.appendChild(btn);
            G.dom.spawnerBtns[type] = { btn, costEl: btn.querySelector('.btn-cost-val'), canvasEl };
        });

        const pityBadge = document.createElement('div');
        pityBadge.id = 'seed-pity-badge';
        pityBadge.className = 'seed-pity-badge hidden';
        pityBadge.innerText = '豐饒種子保底進度：0/5';
        container.appendChild(pityBadge);
        G.dom.seedPityBadgeEl = pityBadge;
        updateSeedPityUI();
    }

    // ==================== 5. 拖拉指定召喚與棋盤操作 ====================
    function recordZonePlacementTelemetry(cellIndex) {
        if (!TerrainSys || !Backend) return;
        const zoneInfo = TerrainSys.classifyBoardZone(cellIndex);
        Backend.trackFeel(`Map:ZoneUsage:${zoneInfo.region}`, 1, { zone: zoneInfo.region, cellIndex });
        if (zoneInfo.isSpecialTerrain) {
            Backend.trackFeel('Map:ZoneUsage:special_terrain', 1, {
                zone: 'special_terrain',
                terrainKey: zoneInfo.terrainKey,
                cellIndex
            });
        }
    }

    /**
     * 在指定合法空格完成扣款與生成防禦塔（由拖拉式指定召喚或快捷鍵觸發）
     */
    function spawnTowerAtCell(type, targetIndex) {
        const st = G.state;
        const towersDict = getTowersDict();
        if (!isGameplayActive() || !towersDict[type]) return false;
        if (!TerrainSys.canBuildAt(targetIndex) || st.board[targetIndex] !== null) return false;

        const deduct = EconSys.deductSummonCost(type);
        if (!deduct.ok) {
            const btnRef = G.dom.spawnerBtns[type];
            if (G.dom.msgText) {
                G.dom.msgText.innerText = `❌ 金幣不足，無法召喚【${towersDict[type].name}】！需要 ${deduct.cost} 💰`;
            }
            if (btnRef && btnRef.btn) {
                btnRef.btn.classList.remove('shake-anim', 'insufficient-gold');
                void btnRef.btn.offsetWidth;
                btnRef.btn.classList.add('shake-anim', 'insufficient-gold');
            }
            return false;
        }

        const seedInterval = (GameApp.data && GameApp.data.tree && GameApp.data.tree.TREE_CONFIG && GameApp.data.tree.TREE_CONFIG.BLESSING_SEED_INTERVAL) || 5;
        let spawnedTier = 1, seedTriggered = false;
        if (TreeSys.hasBlessing('abundant_seed') && ++st.seedPityCount >= seedInterval) {
            st.seedPityCount = 0;
            spawnedTier = 2;
            seedTriggered = true;
        }

        st.board[targetIndex] = AttackSys.createTowerObj(type, spawnedTier, deduct.cost);
        st.buildTargetIndex = null;

        const cfg = towersDict[type];
        const terrainKey = TerrainSys.getTerrainAt(targetIndex);
        const terrainsDict = (GameApp.data && GameApp.data.terrain && GameApp.data.terrain.TERRAIN_TYPES) || {};
        const tInfo = terrainKey ? terrainsDict[terrainKey] : null;
        const coords = indexToCoords(targetIndex);

        SoundEngine.playSpawn(spawnedTier);
        CodexSys.unlockEntry(`tower:${type}`);
        Backend.recordPlayerAction();
        Backend.trackFeel(`Tower:Summon:${type}`, deduct.cost, {
            towerType: type,
            tier: spawnedTier,
            cost: deduct.cost,
            cellIndex: targetIndex
        });
        recordZonePlacementTelemetry(targetIndex);

        G.dom.msgText.innerText = `成功於指定格 (${coords.x + 1},${coords.y + 1}) 召喚【${cfg.name} ${Renderer.getTierStars(spawnedTier)}】${seedTriggered ? '【🌱 豐饒種子保底 ★★！】' : ''}${tInfo && tInfo.shortTag ? `（位於 ${tInfo.shortTag}）` : ''}！花費 ${deduct.cost} 💰。`;
        Renderer.renderBoard([targetIndex]);
        updateHUD();
        return true;
    }

    function handleHotkeySpawn(type) {
        const st = G.state;
        const towersDict = getTowersDict();
        if (!isGameplayActive() || !towersDict[type]) return;
        const cost = EconSys.getSummonCost(type);
        const btnEl = G.dom.spawnerBtns[type] && G.dom.spawnerBtns[type].btn;
        if (!EconSys.canAffordSummon(type)) {
            G.dom.msgText.innerText = `❌ 金幣不足，無法召喚【${towersDict[type].name}】！需要 ${cost} 💰`;
            if (btnEl) { btnEl.classList.remove('shake-anim', 'insufficient-gold'); void btnEl.offsetWidth; btnEl.classList.add('shake-anim', 'insufficient-gold'); }
            return;
        }
        let targetIdx = null;
        if (st.hoveredIndex !== null && TerrainSys.canBuildAt(st.hoveredIndex) && st.board[st.hoveredIndex] === null) {
            targetIdx = st.hoveredIndex;
        } else {
            const pick = AttackSys.pickSmartSpawnIndex(type);
            if (pick) targetIdx = pick.index;
        }
        if (targetIdx === null) {
            G.dom.msgText.innerText = '⚠️ 可建造格子已經全滿，請先融合或出售騰出空間！';
            return;
        }
        spawnTowerAtCell(type, targetIdx);
    }

    function handleCellClick(index) {
        const st = G.state;
        const towersDict = getTowersDict();
        const terrainsDict = (GameApp.data && GameApp.data.terrain && GameApp.data.terrain.TERRAIN_TYPES) || {};
        Backend.recordPlayerAction();

        if (!isGameplayActive()) {
            if (st.isPaused && isMatchPhaseActive()) {
                if (st.board[index] !== null && st.selectedIndex !== index) {
                    st.selectedIndex = index; st.buildTargetIndex = null;
                    const t = st.board[index], terrain = TerrainSys.getTerrainAt(index);
                    const tInfo = terrain ? terrainsDict[terrain] : null;
                    G.dom.msgText.innerText = `⏸️ 暫停檢視：【${(towersDict[t.type] && towersDict[t.type].name) || t.type} ${Renderer.getTierStars(t.tier)}】${tInfo && tInfo.shortTag ? `｜地形：${tInfo.shortTag}` : ''}（恢復後可移動、融合或切換索敵）`;
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
                const t = st.board[index], terrain = TerrainSys.getTerrainAt(index);
                const tInfo = terrain ? terrainsDict[terrain] : null;
                G.dom.msgText.innerText = `已選取【${(towersDict[t.type] && towersDict[t.type].name) || t.type} ${Renderer.getTierStars(t.tier)}】${tInfo && tInfo.shortTag ? `｜地形：${tInfo.shortTag}` : ''}（可切換索敵、出售或拖曳融合/移動）`;
            } else if (TerrainSys.canBuildAt(index)) {
                st.selectedIndex = null; st.hoveredIndex = null;
                if (st.buildTargetIndex === index) {
                    st.buildTargetIndex = null;
                    G.dom.msgText.innerText = '已取消指定建造位置。';
                } else {
                    st.buildTargetIndex = index;
                    const c = indexToCoords(index), terrain = TerrainSys.getTerrainAt(index);
                    const tInfo = terrain ? terrainsDict[terrain] : null;
                    G.dom.msgText.innerText = `📍 已標記位置 (${c.x + 1},${c.y + 1})${tInfo && tInfo.shortTag ? `（${tInfo.shortTag}）` : ''}，可按住下方元素卡拖曳至此格召喚！`;
                }
            } else {
                st.selectedIndex = null; st.hoveredIndex = null; st.buildTargetIndex = null;
            }
        } else if (st.selectedIndex === index) {
            st.selectedIndex = null; st.hoveredIndex = null; st.buildTargetIndex = null;
            G.dom.msgText.innerText = '已取消選取。';
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
        const boardSize = CONFIG.BOARD_SIZE || 150;
        if (!isGameplayActive()) return false;
        if (fromIndex === null || toIndex === null || fromIndex === toIndex) { Renderer.renderBoard([]); return false; }
        if (fromIndex < 0 || fromIndex >= boardSize || toIndex < 0 || toIndex >= boardSize || !st.board[fromIndex]) return false;
        if (!TerrainSys.canBuildAt(toIndex)) {
            G.dom.msgText.innerText = G.map.pathCellIndices.has(toIndex)
                ? '⚠️ 該位置是怪物跑道，不能放置防禦塔！'
                : '⚠️ 該位置是障礙地形，不能放置防禦塔！';
            Renderer.renderBoard([]);
            return false;
        }

        Backend.recordPlayerAction();
        const fromTower = st.board[fromIndex], toTower = st.board[toIndex];
        if (toTower === null) {
            const moveCost = EconSys.getCombatMoveCost();
            if (!isRelocationFree()) {
                if (st.currentGold < moveCost) {
                    G.dom.msgText.innerText = `⚠️ 戰鬥期間調度塔位需花費 ${moveCost} 💰，金幣不足！`;
                    Renderer.renderBoard([]);
                    return false;
                }
                st.currentGold -= moveCost;
                G.dom.msgText.innerText = `🚚 戰術調度成功！花費 ${moveCost} 💰。`;
            } else {
                G.dom.msgText.innerText = '已免費移動塔的位置。';
            }
            st.board[toIndex] = fromTower;
            st.board[fromIndex] = null;
            recordZonePlacementTelemetry(toIndex);
            Renderer.renderBoard([fromIndex, toIndex]);
            updateHUD();
            return true;
        }

        const res = EvoSys.executeTowerFusion(fromIndex, toIndex);
        if (res) {
            const { fusion, bonusHint } = res;
            const cfg = getTowersDict()[fusion.type] || { name: fusion.type };
            SoundEngine.playMerge(fusion.tier, fusion.isCrossElement);
            G.dom.msgText.innerText = `✨ 融合成功！進化為【${cfg.name} ${Renderer.getTierStars(fusion.tier)}】${bonusHint || ''}`;
            Renderer.renderBoard([fromIndex, toIndex]);
            updateHUD();
            return true;
        }
        const maxTier = (GameApp.data && GameApp.data.evolutions && GameApp.data.evolutions.MAX_TIER) || 3;
        G.dom.msgText.innerText = (fromTower.tier >= maxTier || toTower.tier >= maxTier)
            ? `⚠️ ${Renderer.getTierStars(maxTier)} 已達最高星級，無法再融合！`
            : '⚠️ 該組合無法融合（須同星級基礎元素，或相同元素/融合塔；詳見 📖 融合圖鑑）！';
        Renderer.renderBoard([]);
        return false;
    }

    // ==================== 6. 波次、勝負結算與主迴圈 ====================
    function startWave(waveNum, earlyBonus = 0) {
        if (!isGameplayActive()) return;
        const st = G.state;
        const victoryWave = CONFIG.VICTORY_WAVE || 10;
        const towersDict = getTowersDict();
        st.currentWave = waveNum;
        if (st.currentWave > st.bestWave) {
            st.bestWave = st.currentWave;
            Backend.saveMapRecord(st.currentMapId, st.bestWave);
            st.isNewRecordThisRun = true;
        }

        const plan = WaveSys.buildWaveQueue(waveNum);
        st.waveSpawnQueue = plan.queue;
        st.waveSpawnIntervalMs = plan.spawnIntervalMs;
        st.waveSpawnAccMs = plan.spawnIntervalMs;
        st.waveState = 'SPAWNING';
        st.forecastDrawerOpen = false;

        const bonusMsg = earlyBonus > 0 ? `（⚡ 早鳥開波 +${earlyBonus} 💰）` : '';
        if (plan.bossMeta) {
            const bWeak = towersDict[plan.bossMeta.weakness] || { icon: '🔥', name: '火' };
            const weakIcon = bWeak.icon + bWeak.name.charAt(0);
            G.dom.msgText.innerText = (!st.isEndlessMode && waveNum === victoryWave)
                ? `最終決戰 Wave ${waveNum}/${victoryWave}：${plan.bossMeta.name}（弱 ${weakIcon} · 甲 ${plan.bossMeta.armor} · ${plan.bossMeta.hp} HP）來襲${bonusMsg}。`
                : `魔王波 Wave ${waveNum}：${plan.bossMeta.name}（弱 ${weakIcon} · 甲 ${plan.bossMeta.armor}）來襲${bonusMsg}。`;
        } else if (plan.eliteCount > 0) {
            G.dom.msgText.innerText = `第 ${waveNum} 波來襲：含高護甲菁英與機制怪，可善用火塔破甲或跨元素融合${bonusMsg}。`;
        } else {
            G.dom.msgText.innerText = `第 ${waveNum} 波來襲：共 ${plan.queue.length} 隻敵軍進攻中${bonusMsg}。`;
        }
        updateHUD();
        Backend.trackFeel('Progression:Start', null, { wave: waveNum, mapId: st.currentMapId });
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
        const maxHp = (GameApp.data && GameApp.data.tree && GameApp.data.tree.TREE_CONFIG && GameApp.data.tree.TREE_CONFIG.INITIAL_BASE_HP) || 20;
        let starsNum = 1, stars = '★', rankText = '驚險死守，於危急時刻擊退腐朽古樹王。';
        if (st.baseHp >= maxHp) { starsNum = 3; stars = '★★★'; rankText = '完美防守，世界樹滿血守護通關第 10 波。'; }
        else if (st.baseHp >= 10) { starsNum = 2; stars = '★★'; rankText = '穩固防線，成功守護世界樹擊敗腐朽古樹王。'; }

        Backend.finalizeWaveFeel(st.currentWave);
        Backend.saveMapRecord(st.currentMapId, st.currentWave, starsNum);
        st.bestWave = Math.max(st.bestWave, st.currentWave);
        renderMapSelectorUI();
        finalizeOutcomeScreen('VICTORY', 'victory');
        Backend.trackFeel('Progression:Complete', st.currentGold, { wave: st.currentWave, mapId: st.currentMapId });
        Backend.trackFeel(`Run:Victory:${st.currentMapId}:Wave_${st.currentWave}`, st.baseHp);
        setDomText(G.dom.victoryStarsEl, stars); setDomText(G.dom.victoryRankTextEl, rankText);
        populateBattleRecap('victory');
        if (G.dom.victoryOverlayEl) G.dom.victoryOverlayEl.classList.remove('hidden');
    }

    function triggerGameOver() {
        const st = G.state;
        if (st.isGameOver && st.waveState === 'GAMEOVER') return;
        st.isGameOver = true;
        Backend.finalizeWaveFeel(st.currentWave);
        ['startOverlayEl', 'victoryOverlayEl', 'codexOverlayEl', 'guideOverlayEl', 'blessingOverlayEl'].forEach(k => {
            if (G.dom[k]) G.dom[k].classList.add('hidden');
        });
        finalizeOutcomeScreen('GAMEOVER', 'gameover');
        Backend.trackFeel('Progression:Fail', st.killsCount, { wave: st.currentWave, mapId: st.currentMapId });
        Backend.trackFeel(`Run:Fail:${st.currentMapId}:Wave_${st.currentWave}`, st.killsCount);
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
        const mapSpec = WaveSys.getCurrentMapSpec();
        Backend.resetRunTelemetry(G.state.currentMapId, mapSpec.name);
        ['startOverlayEl', 'victoryOverlayEl', 'gameOverOverlayEl', 'codexOverlayEl', 'guideOverlayEl', 'blessingOverlayEl'].forEach(k => {
            if (G.dom[k]) G.dom[k].classList.add('hidden');
        });
        syncPauseUI();
    }

    function restartGame() {
        resetMatchSession('PREP', 1);
        G.dom.msgText.innerText = `【${WaveSys.getCurrentMapSpec().name}】按住下方元素卡拖曳至棋盤空地可指定格召喚；點擊圖鑑或按 1/2/3/Q/W/Space 快速操作！`;
        Renderer.renderBoard(); updateHUD(); updateSpeedButtonUI(); startMainLoop();
    }

    function returnToMainMenu() {
        resetMatchSession('WAITING_START', 1);
        WaveSys.applyMapConfig(G.state.currentMapId);
        renderMapSelectorUI();
        if (G.dom.startOverlayEl) G.dom.startOverlayEl.classList.remove('hidden');
        G.dom.msgText.innerText = '已回到主選單！請選擇戰場地圖，點擊「開始防守」隨時開戰！';
        Renderer.initBoard(); Renderer.renderBoard(); updateHUD(); updateSpeedButtonUI();
    }

    function startGame() {
        const st = G.state;
        if (st.waveState !== 'WAITING_START') return;
        const mapSpec = WaveSys.getCurrentMapSpec();
        Backend.resetRunTelemetry(st.currentMapId, mapSpec.name);
        if (G.dom.startOverlayEl) G.dom.startOverlayEl.classList.add('hidden');
        st.waveState = 'PREP'; st.waveTimerMs = CONFIG.INITIAL_PREP_MS || 6000;
        G.dom.msgText.innerText = `【${mapSpec.name}】備戰開始！按住下方元素卡拖入棋盤綠色空地即可指定位置召喚！`;
        setPauseState(false, { silent: true });
    }

    function continueEndlessMode() {
        const st = G.state;
        if (st.waveState !== 'VICTORY') return;
        st.isEndlessMode = true;
        if (G.dom.victoryOverlayEl) G.dom.victoryOverlayEl.classList.add('hidden');
        st.waveState = 'INTERMISSION'; st.waveTimerMs = CONFIG.WAVE_INTERMISSION_MS || 4000;
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

        const isCombatWave = st.waveState === 'SPAWNING' || st.waveState === 'CLEARING';
        Backend.tickFeelMetrics(rawDt * 1000, st.gameSpeed, isCombatWave);

        st.entangleCdMs = Math.max(0, st.entangleCdMs - dtMs);
        st.frenzyCdMs = Math.max(0, st.frenzyCdMs - dtMs);
        const wasFrenzy = st.frenzyActiveMs > 0;
        st.frenzyActiveMs = Math.max(0, st.frenzyActiveMs - dtMs);
        if (wasFrenzy && st.frenzyActiveMs === 0) {
            for (let i = 0; i < G.towerElements.length; i++) if (G.towerElements[i]) G.towerElements[i].classList.remove('frenzy-active');
            updateTowerInspector();
        }
        if (st.entangleCdMs > 0 || st.frenzyCdMs > 0 || wasFrenzy) updateSkillButtonsUI();

        const victoryWave = CONFIG.VICTORY_WAVE || 10;
        const blessingInterval = (GameApp.data && GameApp.data.tree && GameApp.data.tree.TREE_CONFIG && GameApp.data.tree.TREE_CONFIG.BLESSING_INTERVAL_WAVES) || 3;
        const intermissionMs = CONFIG.WAVE_INTERMISSION_MS || 4000;

        if (st.waveState === 'PREP' || st.waveState === 'INTERMISSION') {
            const prevSec = Math.ceil(st.waveTimerMs / 1000);
            st.waveTimerMs -= dtMs;
            if (st.waveTimerMs <= 0) startWave(st.waveState === 'PREP' ? 1 : st.currentWave + 1);
            else if (prevSec !== Math.ceil(st.waveTimerMs / 1000)) updateWavePhaseUI();
        } else if (st.waveState === 'SPAWNING') {
            st.waveSpawnAccMs += dtMs;
            while (st.waveSpawnAccMs >= st.waveSpawnIntervalMs && st.waveSpawnQueue.length > 0) {
                st.waveSpawnAccMs -= st.waveSpawnIntervalMs;
                MonsterSys.spawnMonsterFromEntry(st.waveSpawnQueue.shift());
                if (st.waveSpawnQueue.length === 0) { st.waveState = 'CLEARING'; updateWavePhaseUI(); }
            }
        } else if (st.waveState === 'CLEARING' && st.monsters.length === 0) {
            if (!st.isEndlessMode && st.currentWave === victoryWave) { triggerVictory(); return; }
            Backend.finalizeWaveFeel(st.currentWave);
            Backend.trackFeel('Progression:Complete', st.currentGold, { wave: st.currentWave, mapId: st.currentMapId });
            if (st.currentWave % blessingInterval === 0 && !st.blessingGrantedWaves.has(st.currentWave) && TreeSys.triggerBlessingSelection(st.currentWave)) return;
            st.waveState = 'INTERMISSION'; st.waveTimerMs = intermissionMs;
            G.dom.msgText.innerText = `🎉 第 ${st.currentWave} 波防禦成功！下一波將於 ${Math.ceil(intermissionMs / 1000)} 秒後出發！`;
            updateWavePhaseUI();
        }

        if (st.monsters.length > 0) { MonsterSys.updateMonsters(dtMs); if (st.isGameOver || tickSessionId !== st.sessionId) return; }
        AttackSys.updateTowersCombat(dtMs);
        Renderer.updateAndRenderCanvasFX(dtMs);
        if (tickSessionId === st.sessionId && isGameplayActive()) st.rafId = requestAnimationFrame(gameTick);
    }

    function startMainLoop() {
        if (G.state.rafId !== null) cancelAnimationFrame(G.state.rafId);
        G.state.lastFrameTime = null; G.state.rafId = requestAnimationFrame(gameTick);
    }

    // ==================== 7. 操作事件綁定、結算回饋工具與快捷鍵 ====================
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
            st.forecastDrawerOpen = false;
            if (st.rafId !== null) { cancelAnimationFrame(st.rafId); st.rafId = null; }
            Renderer.clearTouchDragVisuals(); st.draggedIndex = null; st.hoveredIndex = null; Renderer.updateRangeIndicator();
            if (!silent) {
                Backend.recordPlayerAction();
                Backend.trackFeel('Feel:Pause', 1, { wave: st.currentWave });
                setDomText(G.dom.msgText, '遊戲已暫停（可點防禦塔檢視資訊，按「繼續」或 Space 恢復）。');
            }
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
        Backend.recordPlayerAction();
        const t = st.board[st.selectedIndex];
        const towersData = (GameApp.data && GameApp.data.towers) || {};
        const cycle = towersData.TARGET_MODE_CYCLE || ['first', 'armor', 'lowhp'];
        const labels = towersData.TARGET_MODE_LABELS || { first: '最前', armor: '高護甲', lowhp: '殘血' };
        t.targetMode = cycle[(cycle.indexOf(t.targetMode || 'first') + 1) % cycle.length];
        updateTowerInspector();
        const cfg = getTowersDict()[t.type] || { name: t.type };
        G.dom.msgText.innerText = `🎯 已將【${cfg.name}】索敵優先級切換為：${labels[t.targetMode]}`;
    }

    function sellSelectedTower() {
        const st = G.state;
        if (!isGameplayActive() || st.selectedIndex === null || st.board[st.selectedIndex] === null) return;
        Backend.recordPlayerAction();
        const sellIdx = st.selectedIndex, t = st.board[sellIdx], refund = EconSys.getTowerSellRefund(t);
        const cfg = getTowersDict()[t.type] || { name: t.type };
        st.currentGold += refund; st.board[sellIdx] = null;
        st.selectedIndex = null; st.hoveredIndex = null; st.buildTargetIndex = null;
        Backend.trackFeel('Economy:SellTower', refund, { towerType: t.type, tier: t.tier, refund });
        G.dom.msgText.innerText = `💰 已出售【${cfg.name} ${Renderer.getTierStars(t.tier)}】！退還 +${refund} 💰。`;
        Renderer.renderBoard([sellIdx]); updateHUD();
    }

    function triggerEarlyNextWave() {
        const st = G.state;
        if (!isGameplayActive() || (st.waveState !== 'PREP' && st.waveState !== 'INTERMISSION')) return;
        Backend.recordPlayerAction();
        const bonus = EconSys.getEarlyWaveBonus();
        st.currentGold += bonus; st.totalGoldEarned += bonus;
        Backend.trackFeel('Feel:EarlyStart', bonus, { wave: st.currentWave, bonus });
        startWave(st.waveState === 'PREP' ? 1 : st.currentWave + 1, bonus);
    }

    function cycleGameSpeed() {
        Backend.recordPlayerAction();
        G.state.gameSpeed = (G.state.gameSpeed % 3) + 1;
        updateSpeedButtonUI();
    }

    function openGuide() {
        if (!G.dom.guideOverlayEl || isGuideOpen()) return;
        Backend.recordPlayerAction();
        const st = G.state;
        const wasCodexOpen = isCodexOpen();
        if (wasCodexOpen && G.dom.codexOverlayEl) {
            G.dom.codexOverlayEl.classList.add('hidden');
        }
        const activeMatch = isMatchPhaseActive();
        st.pausedBeforeGuide = wasCodexOpen ? st.pausedBeforeCodex : st.isPaused;
        st.pausedBeforeCodex = false;
        if (activeMatch) st.isPaused = true;
        if (G.dom.guideMenuBtn) G.dom.guideMenuBtn.classList.toggle('hidden', !activeMatch);
        G.dom.guideOverlayEl.classList.remove('hidden');
        if (G.dom.helpBtn) G.dom.helpBtn.setAttribute('aria-expanded', 'true');
        if (st.rafId !== null) { cancelAnimationFrame(st.rafId); st.rafId = null; }
        if (activeMatch) updateHUD();
    }

    function closeGuide() {
        if (!G.dom.guideOverlayEl || !isGuideOpen()) return;
        const st = G.state;
        const restorePaused = Boolean(st.pausedBeforeGuide);
        st.pausedBeforeGuide = false;
        G.dom.guideOverlayEl.classList.add('hidden');
        if (G.dom.helpBtn) G.dom.helpBtn.setAttribute('aria-expanded', 'false');
        if (isMatchPhaseActive()) {
            setPauseState(restorePaused, { silent: true });
        } else {
            updateHUD();
        }
    }

    // 綁定結算視窗 5 秒體感快評與複製戰報按鈕
    function bindOutcomeFeedbackTools() {
        if (typeof document === 'undefined') return;
        document.querySelectorAll('.feel-rating-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const tag = btn.dataset.ratingTag || btn.innerText.trim();
                Backend.trackFeel(`Feel:Rating:${tag}`, 1, { rating: tag });
                const parentGroup = btn.closest('.feel-rating-bar');
                if (parentGroup) {
                    parentGroup.querySelectorAll('.feel-rating-btn').forEach(b => b.classList.remove('selected'));
                }
                btn.classList.add('selected');
                setDomText(G.dom.victoryRatingStatusEl, `感謝回饋！（已記錄：${tag}）`);
                setDomText(G.dom.gameoverRatingStatusEl, `感謝回饋！（已記錄：${tag}）`);
            });
        });

        if (G.dom.victoryCopyReportBtn) {
            G.dom.victoryCopyReportBtn.addEventListener('click', async () => {
                const res = await Backend.copyBattleReportToClipboard(G, 'victory');
                G.dom.victoryCopyReportBtn.innerText = '✅ 已複製本局數據戰報！';
                setDomText(G.dom.victoryRatingStatusEl, '戰報已複製至剪貼簿，可直接貼上分享！');
                return res;
            });
        }

        if (G.dom.gameoverCopyReportBtn) {
            G.dom.gameoverCopyReportBtn.addEventListener('click', async () => {
                const res = await Backend.copyBattleReportToClipboard(G, 'gameover');
                G.dom.gameoverCopyReportBtn.innerText = '✅ 已複製本局數據戰報！';
                setDomText(G.dom.gameoverRatingStatusEl, '戰報已複製至剪貼簿，可直接貼上分享！');
                return res;
            });
        }
    }

    [
        ['inspectorTargetBtn', cycleSelectedTowerTargetMode], ['inspectorSellBtn', sellSelectedTower], ['nextWaveBtn', triggerEarlyNextWave],
        ['skillEntangleBtn', () => TreeSys.castEntangleSkill()], ['skillFrenzyBtn', () => TreeSys.castFrenzySkill()],
        ['pauseBtn', toggleCombatPause], ['pauseResumeBtn', () => { if (G.state.isPaused) setPauseState(false); }],
        ['pauseMenuBtn', returnToMainMenu], ['soundBtn', () => SoundEngine.toggleMute()],
        ['codexBtn', () => CodexSys.openCodex()], ['codexCloseBtn', () => CodexSys.closeCodex()],
        ['helpBtn', openGuide], ['guideCloseBtn', closeGuide], ['guideMenuBtn', () => { closeGuide(); returnToMainMenu(); }],
        ['forecastToggleBtn', toggleForecastDrawer], ['speedBtn', cycleGameSpeed], ['startGameBtn', startGame],
        ['victoryRestartBtn', restartGame], ['victoryMenuBtn', returnToMainMenu], ['endlessBtn', continueEndlessMode],
        ['restartBtn', restartGame], ['gameoverMenuBtn', returnToMainMenu],
        ['addGoldBtn', () => { if (CONFIG.DEBUG_MODE && isGameplayActive()) { G.state.currentGold += 500; G.dom.msgText.innerText = '已增加 500 💰。'; updateHUD(); } }],
        ['clearGoldBtn', () => { if (CONFIG.DEBUG_MODE && isGameplayActive()) { G.state.currentGold = 0; G.dom.msgText.innerText = '金幣已歸零。'; updateHUD(); } }]
    ].forEach(([domKey, fn]) => { if (G.dom[domKey]) G.dom[domKey].addEventListener('click', fn); });

    if (G.dom.mapSelectorGridEl) {
        G.dom.mapSelectorGridEl.addEventListener('click', (e) => {
            const card = e.target && e.target.closest ? e.target.closest('.map-card') : null;
            if (card && card.dataset.mapId) { SoundEngine.ensureContext(); selectMap(card.dataset.mapId); }
        });
    }

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

        window.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey || e.altKey) return;
            const t = e.target, tag = t && t.tagName ? t.tagName.toUpperCase() : '';
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (t && t.isContentEditable)) return;

            const key = e.key || '', lowerKey = key.toLowerCase(), st = G.state;
            if (key === 'Escape') {
                if (DragSys.isDragging()) { e.preventDefault(); DragSys.cancelActiveDrag(); }
                else if (isCodexOpen()) { e.preventDefault(); CodexSys.closeCodex(); }
                else if (isGuideOpen()) { e.preventDefault(); closeGuide(); }
                else if (st.forecastDrawerOpen) { e.preventDefault(); st.forecastDrawerOpen = false; updateWaveForecastUI(); }
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

            const shopTypes = getShopTowerTypes();
            const numIdx = ['1', '2', '3', '4', '5'].indexOf(key) !== -1
                ? ['1', '2', '3', '4', '5'].indexOf(key)
                : ['Numpad1', 'Numpad2', 'Numpad3', 'Numpad4', 'Numpad5'].indexOf(e.code);
            if (numIdx !== -1 && shopTypes[numIdx]) {
                e.preventDefault();
                SoundEngine.ensureContext();
                handleHotkeySpawn(shopTypes[numIdx]);
            } else if (lowerKey === 'q') {
                e.preventDefault(); SoundEngine.ensureContext(); TreeSys.castEntangleSkill();
            } else if (lowerKey === 'w') {
                e.preventDefault(); SoundEngine.ensureContext(); TreeSys.castFrenzySkill();
            }
        });
    }

    function handleBoardLayoutChange() {
        Renderer.measureBoardMetrics();
        Renderer.repositionAllMonsters();
        Renderer.updateRangeIndicator();
    }
    window.addEventListener('resize', handleBoardLayoutChange);
    if (typeof ResizeObserver !== 'undefined' && G.dom.boardElement) new ResizeObserver(handleBoardLayoutChange).observe(G.dom.boardElement);

    G.callbacks = {
        isGameplayActive,
        isMatchPhaseActive,
        isRelocationFree,
        setPauseState,
        scheduleTimeout: scheduleGameTimeout,
        updateHUD,
        updateTowerInspector,
        updateBossStatusBar,
        triggerGameOver,
        triggerVictory,
        handleCellClick,
        handleAction,
        spawnTowerAtCell,
        activateTouchMode,
        startMainLoop,
        recordTowerDamage: AttackSys.recordTowerDamage
    };

    // 綁定所有子系統
    Renderer.bind(G);
    EconSys.bind(G);
    TerrainSys.bind(G);
    WaveSys.bind(G);
    AttackSys.bind(G);
    EvoSys.bind(G);
    MonsterSys.bind(G);
    TreeSys.bind(G);
    DragSys.bind(G);
    CodexSys.bind(G);
    bindOutcomeFeedbackTools();

    WaveSys.applyMapConfig('forest');
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
            if (CodexSys && typeof CodexSys.renderCodexModal === 'function') CodexSys.renderCodexModal('fusion');
            updateHUD();
            updateTowerInspector();
            Renderer.updateRangeIndicator();
        }
    });

    const GameController = {
        runtime: G,
        selectMap,
        startGame,
        restartGame,
        returnToMainMenu,
        continueEndlessMode,
        spawnTowerAtCell,
        handleAction,
        handleCellClick,
        renderSpawnerButtons,
        updateHUD,
        triggerVictory,
        triggerGameOver,
        getMvpSummaryText
    };

    GameApp.core = GameApp.core || {};
    GameApp.core.game = GameController;
    GameApp.game = GameController;
})(window);
