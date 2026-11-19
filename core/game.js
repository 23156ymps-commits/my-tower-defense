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
    const L = (zh, en) => (GameApp.i18n && GameApp.i18n.isEnglish()) ? en : zh;

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
        ['inspectorLineageEl', 'inspector-lineage'],
        ['inspectorDpsEl', 'inspector-dps'], ['inspectorAoeDpsEl', 'inspector-aoe-dps'], ['inspectorTotalDmgEl', 'inspector-total-dmg'],
        ['inspectorRangeEl', 'inspector-range'], ['inspectorTerrainEl', 'inspector-terrain'],
        ['inspectorAwakenBtn', 'inspector-awaken-btn'], ['inspectorTargetBtn', 'inspector-target-btn'], ['inspectorSellBtn', 'inspector-sell-btn'],
        ['evoConfirmOverlayEl', 'evo-confirm-overlay'], ['evoConfirmTitleEl', 'evo-confirm-title'],
        ['evoConfirmOptionsEl', 'evo-confirm-options'], ['evoCancelBtn', 'evo-cancel-btn'],
        ['codexBtn', 'codex-btn'], ['codexOverlayEl', 'codex-overlay'], ['codexCloseBtn', 'codex-close-btn'],
        ['blessingOverlayEl', 'blessing-overlay'], ['blessingWaveSubtitleEl', 'blessing-wave-subtitle'], ['blessingChoicesEl', 'blessing-choices'],
        ['skillEntangleBtn', 'skill-entangle-btn'], ['skillFrenzyBtn', 'skill-frenzy-btn'], ['pauseBtn', 'pause-btn'], ['soundBtn', 'sound-btn'], ['langBtn', 'lang-btn'],
        ['pauseBannerEl', 'pause-banner'], ['pauseResumeBtn', 'pause-resume-btn'], ['pauseMenuBtn', 'pause-menu-btn'],
        ['addGoldBtn', 'add-gold-btn'], ['clearGoldBtn', 'clear-gold-btn'], ['nextWaveBtn', 'next-wave-btn'], ['speedBtn', 'speed-btn'],
        ['goldDisplay', 'gold-display'], ['baseHpDisplay', 'base-hp-display'], ['dewDisplay', 'dew-display'], ['dewBarFillEl', 'dew-bar-fill'],
        ['waveDisplay', 'wave-display'], ['wavePhaseTagEl', 'wave-phase-tag'], ['bestWaveDisplay', 'best-wave-display'], ['msgText', 'msg-text'],
        ['startOverlayEl', 'start-overlay'], ['mapSelectorGridEl', 'map-selector-grid'], ['mapRecordForestEl', 'map-record-forest'],
        ['mapRecordLavaEl', 'map-record-lava'], ['mapRecordFrostEl', 'map-record-frost'], ['startGameBtn', 'start-game-btn'],
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
        ['forecastNextHeaderEl', 'forecast-next-header'], ['forecastNextListEl', 'forecast-next-list'],
        ['sideCurrentHeaderEl', 'side-current-header'], ['sideCurrentListEl', 'side-current-list'],
        ['sideNextHeaderEl', 'side-next-header'], ['sideNextListEl', 'side-next-list'],
        ['sideMonsterCardEl', 'side-monster-card'], ['sideWaveCurrentSectionEl', 'side-wave-current-section'],
        ['sideMonsterPortraitEl', 'side-monster-portrait'], ['sideMonsterNameEl', 'side-monster-name'],
        ['sideMonsterHpEl', 'side-monster-hp'], ['sideMonsterShieldEl', 'side-monster-shield'],
        ['sideMonsterStatsEl', 'side-monster-stats'], ['sideMonsterDebuffsEl', 'side-monster-debuffs'],
        ['sideMonsterTraitEl', 'side-monster-trait'], ['mobileMonsterCardEl', 'mobile-monster-card'],
        ['sideMonsterLockTagEl', 'side-monster-lock-tag'], ['sideMonsterLockTrackEl', 'side-monster-lock-track'],
        ['sideMonsterLockFillEl', 'side-monster-lock-fill'], ['startCareerBannerEl', 'start-career-banner'],
        ['contractsGridEl', 'contracts-grid'], ['contractsSummaryBadgeEl', 'contracts-summary-badge'],
        ['victoryContractsRowEl', 'victory-contracts-row'], ['gameoverContractsRowEl', 'gameover-contracts-row']
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

    const selectedContracts = new Set();

    function createInitialMatchState(mapId = 'forest', initialWaveState = 'WAITING_START', nextSessionId = 1, keepSpeed = 1, contractsOverride = null) {
        const maps = getMapsConfig();
        const spec = maps[mapId] || maps.forest || { id: 'forest', name: '🌲 晨光森林', startGoldBonus: 0 };
        const treeCfg = (GameApp.data && GameApp.data.tree && GameApp.data.tree.TREE_CONFIG) || {};
        const wb = (GameApp.data && GameApp.data.routes && GameApp.data.routes.WAVE_BALANCE) || {};
        const activeContracts = new Set(contractsOverride || selectedContracts);
        const maxBaseHp = activeContracts.has('fragile_heart') ? 12 : (treeCfg.INITIAL_BASE_HP || CONFIG.INITIAL_BASE_HP || 20);
        const initDew = activeContracts.has('dew_drought') ? 0 : (treeCfg.DEW_INITIAL || CONFIG.DEW_INITIAL || 20);
        const basePrepMs = CONFIG.INITIAL_PREP_MS || 6000;
        const initPrepMs = activeContracts.has('rapid_waves') ? Math.round(basePrepMs * 0.5) : basePrepMs;

        const spawnCounts = { fire: 0, ice: 0, thunder: 0 };
        getShopTowerTypes().forEach(tKey => { spawnCounts[tKey] = 0; });

        return {
            currentMapId: spec.id,
            activeContracts,
            currentGold: EconSys ? EconSys.getInitialGold(spec, activeContracts) : Math.max(10, 40 + (spec.startGoldBonus || 0) - (activeContracts.has('budget_crunch') ? 15 : 0)),
            maxBaseHp,
            baseHp: maxBaseHp,
            dewEnergy: initDew,
            entangleCdMs: 0, frenzyCdMs: 0, frenzyActiveMs: 0, dewOverchargeMs: 0,
            activeBlessings: new Set(), blessingGrantedWaves: new Set(), blessingChoices: [],
            seedPityCount: 0, treeHitShakeTimer: null,
            bestWave: Backend.getMapBestWave(spec.id), currentWave: 1, killsCount: 0,
            towerUidCounter: 1, totalTeamDamage: 0, totalGoldEarned: 0, fusionCount: 0,
            crownedUsedCount: 0, elapsedPlayMs: 0,
            peakTowerSnapshot: null, lastBreakerName: '',
            isPaused: false, pausedBeforeCodex: false, pausedBeforeGuide: false, forecastDrawerOpen: false,
            isGameOver: false, isEndlessMode: false, isNewRecordThisRun: false,
            gameSpeed: keepSpeed,
            spawnCounts,
            board: Array(CONFIG.BOARD_SIZE || 150).fill(null), monsters: [], monsterIdCounter: 1,
            groundHazards: [], dragTether: null, pendingEvolution: null,
            selectedIndex: null, buildTargetIndex: null, pendingSpawnType: null, hoveredIndex: null,
            hoveredMonsterId: null, hoverLockMonster: null, isCursorOnHoveredMonster: false,
            hoverStickUntilPerfMs: 0, hoverKillUntilPerfMs: 0,
            draggedIndex: null, inspectedMonsterId: null,
            lastRenderedSelected: null, lastRenderedBuildTarget: null, lastRenderedPendingSpawn: null,
            isTouchMode: false, touchDragState: null, lastTouchDragEndTime: 0,
            sessionId: nextSessionId, activeTimers: new Set(), pendingBolts: [], pendingOverchargeShots: [], towerPhaseSeq: 0,
            waveState: initialWaveState, waveTimerMs: initPrepMs,
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
        st.pendingOverchargeShots = [];
        Renderer.clearCanvasFXState();
    }

    function activateTouchMode() {
        const st = G.state;
        st.isTouchMode = true;
        if (st.hoveredIndex !== null) st.hoveredIndex = null;
        if (G.dom.towerTooltipEl) G.dom.towerTooltipEl.classList.add('hidden');
        if (G.dom.terrainTooltipEl) G.dom.terrainTooltipEl.classList.add('hidden');
        Renderer.updateRangeIndicator();
    }

    // ==================== 3. 地圖選擇、難度契約與局末戰報 ====================
    function renderContractSelectorUI() {
        const list = Array.isArray(CONFIG.DIFFICULTY_CONTRACTS) ? CONFIG.DIFFICULTY_CONTRACTS : [];
        const bonusPerItem = Math.round((CONFIG.CONTRACT_SCORE_BONUS_PER_ITEM || 0.15) * 100);
        const count = selectedContracts.size;
        if (G.dom.contractsSummaryBadgeEl) {
            G.dom.contractsSummaryBadgeEl.innerText = count > 0
                ? L(`已啟用 ${count} 項 · 榮譽 +${count * bonusPerItem}%`, `${count} Active · Honor +${count * bonusPerItem}%`)
                : L('未啟用契約 · 榮譽 +0%', 'No Contracts · Honor +0%');
            G.dom.contractsSummaryBadgeEl.classList.toggle('has-contracts', count > 0);
        }
        if (!G.dom.contractsGridEl) return;
        G.dom.contractsGridEl.innerHTML = '';
        list.forEach((c) => {
            const active = selectedContracts.has(c.id);
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = `contract-chip${active ? ' is-selected' : ''}`;
            btn.dataset.contractId = c.id;
            btn.setAttribute('aria-pressed', active ? 'true' : 'false');
            btn.innerHTML = `<div class="contract-chip-top"><span class="contract-code num">${c.code}</span><span class="contract-name">${c.name}</span></div><div class="contract-desc num">${c.desc}</div>`;
            btn.addEventListener('click', () => {
                if (G.state.waveState !== 'WAITING_START') return;
                SoundEngine.ensureContext();
                if (selectedContracts.has(c.id)) selectedContracts.delete(c.id);
                else selectedContracts.add(c.id);

                // 即時預覽契約對開局初始金幣、生命上限與靈露的調整
                const mapSpec = WaveSys.getCurrentMapSpec();
                const treeCfg = (GameApp.data && GameApp.data.tree && GameApp.data.tree.TREE_CONFIG) || {};
                G.state.activeContracts = new Set(selectedContracts);
                G.state.maxBaseHp = selectedContracts.has('fragile_heart') ? 12 : (treeCfg.INITIAL_BASE_HP || 20);
                G.state.baseHp = G.state.maxBaseHp;
                G.state.dewEnergy = selectedContracts.has('dew_drought') ? 0 : (treeCfg.DEW_INITIAL || CONFIG.DEW_INITIAL || 20);
                G.state.currentGold = EconSys.getInitialGold(mapSpec, G.state.activeContracts);
                renderContractSelectorUI();
                updateHUD();
            });
            G.dom.contractsGridEl.appendChild(btn);
        });
    }

    function renderMapSelectorUI() {
        const records = Backend.loadMapRecords();
        const career = Backend.loadCareerStats ? Backend.loadCareerStats() : { bestWaveOverall: 1, totalClears: 0 };
        if (G.dom.startCareerBannerEl) {
            G.dom.startCareerBannerEl.innerText = L(
                `全圖最高 Wave ${career.bestWaveOverall || 1} · 累計通關 ${career.totalClears || 0} 次`,
                `Best Wave ${career.bestWaveOverall || 1} · Total Clears ${career.totalClears || 0}`
            );
        }
        if (G.dom.mapSelectorGridEl) {
            G.dom.mapSelectorGridEl.querySelectorAll('.map-card').forEach(card => {
                const isSel = card.dataset.mapId === G.state.currentMapId;
                card.classList.toggle('selected', isSel);
                card.setAttribute('aria-pressed', isSel ? 'true' : 'false');
            });
        }
        const fmt = rec => L(
            `最高 Wave ${(rec && rec.bestWave) || 1} · ${(rec && rec.bestStars > 0) ? `通關 ${'★'.repeat(rec.bestStars)}` : '尚未通關'}`,
            `Best Wave ${(rec && rec.bestWave) || 1} · ${(rec && rec.bestStars > 0) ? `Cleared ${'★'.repeat(rec.bestStars)}` : 'Uncleared'}`
        );
        if (G.dom.mapRecordForestEl) G.dom.mapRecordForestEl.innerText = fmt(records.forest);
        if (G.dom.mapRecordLavaEl) G.dom.mapRecordLavaEl.innerText = fmt(records.lava);
        if (G.dom.mapRecordFrostEl) G.dom.mapRecordFrostEl.innerText = fmt(records.frost);
    }

    function selectMap(mapId) {
        const st = G.state;
        const maps = getMapsConfig();
        if (st.waveState !== 'WAITING_START' || !maps[mapId] || mapId === st.currentMapId) return;
        WaveSys.applyMapConfig(mapId);
        const mapSpec = WaveSys.getCurrentMapSpec();
        st.bestWave = Backend.getMapBestWave(st.currentMapId);
        st.activeContracts = new Set(selectedContracts);
        st.currentGold = EconSys.getInitialGold(mapSpec, st.activeContracts);
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
        if (G.dom.victoryCopyReportBtn) G.dom.victoryCopyReportBtn.innerText = '複製本局數據戰報';
        if (G.dom.gameoverCopyReportBtn) G.dom.gameoverCopyReportBtn.innerText = '複製本局數據戰報';
    }

    function computeRunHonorSummary(st) {
        const count = (st.activeContracts && st.activeContracts.size) || 0;
        const perBonus = CONFIG.CONTRACT_SCORE_BONUS_PER_ITEM || 0.15;
        const mult = 1 + count * perBonus;
        const baseScore = Math.max(0, (st.currentWave || 1) * 120 + (st.killsCount || 0) * 8 + (st.baseHp || 0) * 35);
        const honorScore = Math.round(baseScore * mult);
        const defs = Array.isArray(CONFIG.DIFFICULTY_CONTRACTS) ? CONFIG.DIFFICULTY_CONTRACTS : [];
        const names = defs.filter(d => st.activeContracts && st.activeContracts.has(d.id)).map(d => `${d.code}·${d.name}`);
        return { count, bonusPct: Math.round(count * perBonus * 100), honorScore, names };
    }

    function populateBattleRecap(mode) {
        const st = G.state, dom = G.dom, mapSpec = WaveSys.getCurrentMapSpec();
        const { mvp, pct, text: mvpText } = getMvpData();
        const treeCfg = (GameApp.data && GameApp.data.tree && GameApp.data.tree.TREE_CONFIG) || {};
        const maxHp = st.maxBaseHp || treeCfg.INITIAL_BASE_HP || CONFIG.INITIAL_BASE_HP || 20;
        const honor = computeRunHonorSummary(st);
        const career = Backend.loadCareerStats ? Backend.loadCareerStats() : { totalClears: 0 };

        if (mvp) {
            Backend.trackFeel(`MVP:DamageShare:${mvp.type}`, pct, { mvpType: mvp.type, sharePct: pct });
        }
        Backend.trackFeel('Economy:EndGold', st.currentGold, { endGold: st.currentGold, mode });

        resetFeedbackUI();

        const contractSummaryHtml = honor.count > 0
            ? `榮譽積分 ${honor.honorScore.toLocaleString()}（+${honor.bonusPct}% 契約）· ${honor.names.join('、')}`
            : `榮譽積分 ${honor.honorScore.toLocaleString()} · 累計通關 ${career.totalClears || 0} 次`;

        if (mode === 'victory') {
            setDomText(dom.victoryMapTextEl, mapSpec.name);
            setDomText(dom.victoryKillsTextEl, `${st.killsCount} 隻`);
            setDomText(dom.victoryHpTextEl, `${st.baseHp} / ${maxHp}`);
            setDomText(dom.victoryGoldTextEl, `${st.currentGold} 💰`);
            setDomText(dom.victoryMvpTextEl, mvpText);
            setDomText(dom.victoryGoldEarnedTextEl, `${st.totalGoldEarned.toLocaleString()} 💰`);
            setDomText(dom.victoryFusionTextEl, `${st.fusionCount} 次`);
            if (dom.victoryContractsRowEl) {
                dom.victoryContractsRowEl.classList.remove('hidden');
                dom.victoryContractsRowEl.innerText = contractSummaryHtml;
            }
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
        if (dom.gameoverContractsRowEl) {
            dom.gameoverContractsRowEl.classList.remove('hidden');
            dom.gameoverContractsRowEl.innerText = contractSummaryHtml;
        }
    }

    // ==================== 4. UI 更新與動態自動掃描 ====================
    function formatMonsterInspectText(m) {
        if (!m) return '';
        const MonsterSys = GameApp.systems && GameApp.systems.monster;
        const towersDict = getTowersDict();
        const weakCfg = towersDict[m.weakness];
        const weakStr = weakCfg ? `${weakCfg.icon}${weakCfg.name.charAt(0)}` : (m.weakness || '無');
        const effArmor = Math.round(MonsterSys ? MonsterSys.getMonsterEffectiveArmor(m) : (m.armor || 0));
        const armorStr = m.armorShredTimer > 0 ? `🔥 ${effArmor}/${m.armor}` : `${effArmor}`;
        const status = [];
        if ((m.rootTimer || 0) > 0) status.push(`纏繞 ${(m.rootTimer / 1000).toFixed(1)}s`);
        if (m.slowTimer > 0) status.push(`緩速 ${Math.round((m.slowRate || 0) * 100)}%`);
        if (m.armorShredTimer > 0) status.push(`破甲 ${Math.round((m.armorShredRate || 0.3) * 100)}%`);
        return `${m.icon || '👾'} ${m.name}｜HP ${m.hp}/${m.maxHp}｜護甲 ${armorStr}｜弱點 ${weakStr}${status.length ? `｜${status.join(' · ')}` : ''}`;
    }

    function findMonsterNearCell(index) {
        const monsters = G.state.monsters;
        if (!monsters || monsters.length === 0) return null;
        const c = indexToCoords(index);
        let best = null;
        let bestDist = Infinity;
        for (let i = 0; i < monsters.length; i++) {
            const m = monsters[i];
            if (m.hp <= 0) continue;
            const d = Math.hypot((m.gridX ?? 0) - c.x, (m.gridY ?? 0) - c.y);
            if (d <= 0.92 && d < bestDist) {
                bestDist = d;
                best = m;
            }
        }
        return best;
    }

    function lockTouchMonsterInspect(m) {
        const st = G.state;
        if (!m || m.hp <= 0) return;
        st.selectedIndex = null;
        st.buildTargetIndex = null;
        st.hoveredIndex = null;
        st.inspectedMonsterId = m.id;
        st.hoveredMonsterId = m.id;
        st.isCursorOnHoveredMonster = true;
        st.hoverStickUntilPerfMs = 0;
        st.hoverKillUntilPerfMs = 0;
        updateMonsterHoverCardUI();
        Renderer.renderBoard([]);
        Renderer.updateRangeIndicator();
        if (G.dom.msgText) G.dom.msgText.innerText = formatMonsterInspectText(m);
    }

    function onMonsterLeaked(monsterId) {
        if (G.state && G.state.hoveredMonsterId === monsterId) {
            clearMonsterHoverLock();
        }
    }

    function inspectMonsterById(monsterId) {
        const st = G.state;
        const m = st.monsters.find(item => item.id === monsterId && item.hp > 0);
        if (!m) return false;
        st.selectedIndex = null;
        st.buildTargetIndex = null;
        st.pendingSpawnType = null;
        st.inspectedMonsterId = m.id;
        const summary = formatMonsterInspectText(m);
        setDomText(G.dom.msgText, summary);
        Renderer.renderBoard([]);
        updateHUD();
        return true;
    }

    let lastHoverPortraitKey = '';
    let hoverStickyTickInterval = null;
    const MONSTER_HOVER_STICK_MS = 2800;
    const MONSTER_HOVER_KILL_MS = 1000;

    function stopHoverStickyTicker() {
        if (hoverStickyTickInterval !== null) {
            clearInterval(hoverStickyTickInterval);
            hoverStickyTickInterval = null;
        }
    }

    function ensureHoverStickyTicker() {
        if (hoverStickyTickInterval !== null) return;
        hoverStickyTickInterval = setInterval(() => {
            if (!G || !G.state || G.state.hoveredMonsterId === null) {
                stopHoverStickyTicker();
                return;
            }
            updateMonsterHoverCardUI();
        }, 80);
    }

    function clearMonsterHoverLock() {
        const st = G && G.state;
        const dom = G && G.dom;
        if (st) {
            st.hoveredMonsterId = null;
            st.hoverLockMonster = null;
            st.isCursorOnHoveredMonster = false;
            st.hoverStickUntilPerfMs = 0;
            st.hoverKillUntilPerfMs = 0;
        }
        stopHoverStickyTicker();
        lastHoverPortraitKey = '';
        if (dom && dom.boardStageEl) dom.boardStageEl.classList.remove('monster-hovering');
        if (dom && dom.sideMonsterCardEl) dom.sideMonsterCardEl.classList.add('hidden');
        if (dom && dom.sideWaveCurrentSectionEl) dom.sideWaveCurrentSectionEl.classList.remove('hidden');
        if (dom && dom.mobileMonsterCardEl) dom.mobileMonsterCardEl.classList.add('hidden');
    }

    function buildMonsterActiveDebuffList(m) {
        const list = [];
        const st = m.status || {};
        if (m.isStealthed) list.push(`隱身 (${((m.stealthTimerMs || 0) / 1000).toFixed(1)}s)`);
        const shellLeft = m.shellHitsLeft || m.hardShellHitsLeft || 0;
        if (shellLeft > 0) list.push(`甲殼減傷 ×${shellLeft}`);
        if ((m.rootTimer || 0) > 0) list.push(`定身 ${(m.rootTimer / 1000).toFixed(1)}s`);
        if (MonsterSys && MonsterSys.isMonsterFrozen(m)) list.push('凍結');
        else if (MonsterSys && MonsterSys.isMonsterSlowed(m)) {
            const effSlow = Math.round(MonsterSys.getMonsterEffectiveSlowRate(m) * 100);
            list.push(`緩速 ${effSlow}%`);
        }
        if (st.burn && st.burn.stacks > 0 && st.burn.durationMs > 0) list.push(`灼燒 ${st.burn.stacks}層`);
        if (st.shock && st.shock.durationMs > 0) list.push('感電');
        if (st.grievousWound && st.grievousWound.durationMs > 0) list.push('重傷 -50%治療');
        if ((m.armorShredTimer || 0) > 0) list.push(`破甲 ${Math.round((m.armorShredRate || 0.3) * 100)}%`);
        return list;
    }

    function updateMonsterHoverCardUI() {
        const dom = G.dom, st = G.state;
        if (!st || st.isGameOver || st.waveState === 'WAITING_START' || st.waveState === 'VICTORY') {
            clearMonsterHoverLock();
            return;
        }
        if (st.hoveredMonsterId === null) {
            clearMonsterHoverLock();
            return;
        }

        const nowPerf = typeof performance !== 'undefined' ? performance.now() : Date.now();
        const liveM = st.monsters.find(item => item.id === st.hoveredMonsterId && item.hp > 0) || null;
        let isKilledDisplay = false;

        if (liveM) {
            const slowFactor = MonsterSys ? (1 - MonsterSys.getMonsterEffectiveSlowRate(liveM)) : 1;
            const effSpeed = (MonsterSys && (MonsterSys.isMonsterFrozen(liveM) || (liveM.rootTimer || 0) > 0))
                ? 0
                : Math.round((liveM.speed || 40) * (liveM.isStealthed ? 1.65 : 1.0) * slowFactor);
            st.hoverLockMonster = {
                id: liveM.id,
                typeKey: liveM.typeKey,
                name: liveM.name,
                hp: liveM.hp,
                maxHp: liveM.maxHp,
                shield: liveM.shield || 0,
                maxShield: liveM.maxShield || 0,
                armor: liveM.armor || 0,
                effArmor: Math.round(MonsterSys ? MonsterSys.getMonsterEffectiveArmor(liveM) : (liveM.armor || 0)),
                armorShredTimer: liveM.armorShredTimer || 0,
                weakness: liveM.weakness,
                effSpeed,
                isBoss: Boolean(liveM.isBoss),
                isElite: Boolean(liveM.isElite),
                bossMechanic: liveM.bossMechanic || '',
                traitDesc: liveM.traitDesc || '',
                debuffs: buildMonsterActiveDebuffList(liveM)
            };
        } else if (st.hoverLockMonster) {
            isKilledDisplay = true;
            st.isCursorOnHoveredMonster = false;
            if (st.hoverKillUntilPerfMs <= 0) {
                st.hoverKillUntilPerfMs = nowPerf + MONSTER_HOVER_KILL_MS;
                st.hoverStickUntilPerfMs = 0;
                ensureHoverStickyTicker();
            }
            if (nowPerf >= st.hoverKillUntilPerfMs) {
                clearMonsterHoverLock();
                return;
            }
            st.hoverLockMonster.hp = 0;
            st.hoverLockMonster.shield = 0;
            st.hoverLockMonster.effSpeed = 0;
        } else {
            clearMonsterHoverLock();
            return;
        }

        let lockRatio = 1;
        let lockHintText = '';
        if (isKilledDisplay) {
            const remKill = Math.max(0, st.hoverKillUntilPerfMs - nowPerf);
            lockRatio = remKill / MONSTER_HOVER_KILL_MS;
            lockHintText = L('已擊殺', 'Slain');
        } else if (!st.isCursorOnHoveredMonster) {
            if (st.hoverStickUntilPerfMs <= 0) {
                st.hoverStickUntilPerfMs = nowPerf + MONSTER_HOVER_STICK_MS;
                ensureHoverStickyTicker();
            }
            const remStick = Math.max(0, st.hoverStickUntilPerfMs - nowPerf);
            if (remStick <= 0) {
                clearMonsterHoverLock();
                return;
            }
            lockRatio = remStick / MONSTER_HOVER_STICK_MS;
            lockHintText = L(`鎖定檢視 ${(remStick / 1000).toFixed(1)}s`, `Locked ${(remStick / 1000).toFixed(1)}s`);
        } else {
            stopHoverStickyTicker();
            lockHintText = L('鎖定檢視', 'Locked');
        }

        const m = st.hoverLockMonster;
        if (dom.boardStageEl) dom.boardStageEl.classList.toggle('monster-hovering', Boolean(liveM && st.isCursorOnHoveredMonster));

        const towersDict = getTowersDict();
        const monsterDb = (GameApp.data && GameApp.data.monsters && GameApp.data.monsters.MONSTER_DATABASE) || {};
        const mCfg = monsterDb[m.typeKey] || {};
        const weakCfg = towersDict[m.weakness];
        const weakStr = weakCfg ? `${weakCfg.icon}${L(weakCfg.name.charAt(0), weakCfg.name.split(' ')[0])}` : (m.weakness || L('無', 'None'));
        const armorStr = m.armorShredTimer > 0 ? `${m.effArmor}/${m.armor}` : `${m.effArmor}`;
        const tierBadge = m.isBoss ? 'Boss' : (m.isElite ? L('菁英', 'Elite') : L('敵軍', 'Foe'));
        const traitText = m.traitDesc || mCfg.traitDesc || (m.isBoss ? L('階段首領 · 留意頭像旁弱點屬性', 'Stage Boss · Check weakness icon') : L('沿路徑前進攻擊世界樹', 'Marches toward the World Tree'));

        if (dom.sideMonsterCardEl && dom.sideWaveCurrentSectionEl) {
            dom.sideMonsterCardEl.classList.remove('hidden');
            dom.sideMonsterCardEl.classList.toggle('is-killed', isKilledDisplay);
            dom.sideWaveCurrentSectionEl.classList.add('hidden');
            const portraitKey = m.bossMechanic === 'void_shift' ? 'void_boss' : m.typeKey;
            if (dom.sideMonsterPortraitEl && lastHoverPortraitKey !== portraitKey && Renderer && typeof Renderer.drawPortrait === 'function') {
                lastHoverPortraitKey = portraitKey;
                Renderer.drawPortrait(dom.sideMonsterPortraitEl, 'monster', portraitKey, { size: 44 });
            }
            if (dom.sideMonsterLockTagEl) {
                dom.sideMonsterLockTagEl.classList.toggle('hidden', !lockHintText);
                dom.sideMonsterLockTagEl.classList.toggle('is-killed', isKilledDisplay);
                dom.sideMonsterLockTagEl.innerText = lockHintText;
            }
            if (dom.sideMonsterLockTrackEl && dom.sideMonsterLockFillEl) {
                const showBar = isKilledDisplay || (!st.isCursorOnHoveredMonster && st.hoverStickUntilPerfMs > 0);
                dom.sideMonsterLockTrackEl.classList.toggle('hidden', !showBar);
                dom.sideMonsterLockFillEl.style.width = `${Math.max(0, Math.min(100, lockRatio * 100)).toFixed(1)}%`;
                dom.sideMonsterLockFillEl.classList.toggle('is-killed', isKilledDisplay);
            }
            setDomText(dom.sideMonsterNameEl, `${m.name} (${tierBadge})`);
            setDomText(dom.sideMonsterHpEl, isKilledDisplay ? `HP 0 / ${m.maxHp} · ${L('已擊殺', 'Slain')}` : `HP ${m.hp} / ${m.maxHp}`);
            if (dom.sideMonsterShieldEl) {
                const hasShield = (m.shield || 0) > 0;
                dom.sideMonsterShieldEl.classList.toggle('hidden', !hasShield);
                if (hasShield) dom.sideMonsterShieldEl.innerText = `${L('護盾', 'Shield')} ${m.shield} / ${m.maxShield || m.shield}`;
            }
            setDomText(dom.sideMonsterStatsEl, L(`甲 ${armorStr} · 弱 ${weakStr} · 速 ${m.effSpeed}`, `ARM ${armorStr} · Weak ${weakStr} · Spd ${m.effSpeed}`));
            if (dom.sideMonsterDebuffsEl) {
                const debuffs = m.debuffs || [];
                dom.sideMonsterDebuffsEl.classList.toggle('hidden', isKilledDisplay || debuffs.length === 0);
                if (!isKilledDisplay && debuffs.length > 0) dom.sideMonsterDebuffsEl.innerText = debuffs.join(' · ');
            }
            setDomText(dom.sideMonsterTraitEl, traitText);
        }

        if (dom.mobileMonsterCardEl) {
            dom.mobileMonsterCardEl.classList.remove('hidden');
            dom.mobileMonsterCardEl.classList.toggle('is-killed', isKilledDisplay);
            const shieldBit = (m.shield || 0) > 0 ? ` · 盾 ${m.shield}` : '';
            const debuffs = m.debuffs || [];
            const debuffBit = (!isKilledDisplay && debuffs.length > 0) ? ` [${debuffs.slice(0, 2).join('/')}]` : '';
            const hpLabel = isKilledDisplay ? '已擊殺' : `HP ${m.hp}/${m.maxHp}`;
            const barWidth = `${Math.max(0, Math.min(100, lockRatio * 100)).toFixed(1)}%`;
            dom.mobileMonsterCardEl.innerHTML = `<div class="mmc-top num"><span>${m.name} · ${hpLabel}${shieldBit} · 甲 ${armorStr} · 弱 ${weakStr}</span><span class="mmc-lock-tag">${lockHintText}</span></div><div class="mmc-sub">${traitText}${debuffBit}</div><div class="mmc-lock-track"><div class="mmc-lock-fill${isKilledDisplay ? ' is-killed' : ''}" style="width:${barWidth}"></div></div>`;
        }
    }

    function updateTowerInspector() {
        const dom = G.dom, st = G.state;
        if (!dom.inspectorEmptyEl || !dom.inspectorActiveEl) return;
        const terrainsDict = (GameApp.data && GameApp.data.terrain && GameApp.data.terrain.TERRAIN_TYPES) || {};
        const targetLabels = (GameApp.data && GameApp.data.towers && GameApp.data.towers.TARGET_MODE_LABELS) || { first: '最前', armor: '高護甲', lowhp: '殘血' };

        const hasTower = st.selectedIndex !== null && st.board[st.selectedIndex] !== null && !st.isGameOver && st.waveState !== 'VICTORY' && st.waveState !== 'BLESSING_SELECT';
        if (!hasTower) {
            dom.inspectorActiveEl.classList.add('hidden');
            dom.inspectorEmptyEl.classList.remove('hidden');
            if (dom.inspectorAwakenBtn) dom.inspectorAwakenBtn.classList.add('hidden');
            const inspectedMonster = st.inspectedMonsterId !== null ? st.monsters.find(m => m.id === st.inspectedMonsterId && m.hp > 0) : null;
            if (inspectedMonster) {
                dom.inspectorEmptyEl.innerText = formatMonsterInspectText(inspectedMonster);
            } else {
                dom.inspectorEmptyEl.innerText = L('點選場上防禦塔、古代巨岩 (45 金爆破) 或懸停敵軍檢視情報', 'Select a tower, Boulder (45g clear), or hover a monster');
            }
            return;
        }

        const towerObj = st.board[st.selectedIndex], cfg = getTowersDict()[towerObj.type] || { icon: '✨', name: towerObj.type };
        const stats = AttackSys.getTowerInspectorStats(st.selectedIndex, towerObj), mode = towerObj.targetMode || 'first';
        const tInfo = stats.terrainType ? terrainsDict[stats.terrainType] : null;
        dom.inspectorEmptyEl.classList.add('hidden');
        dom.inspectorActiveEl.classList.remove('hidden');
        const nameTierTag = towerObj.isCrowned ? L('👑 T4 聖冠', '👑 T4 Crown') : Renderer.getTierStars(towerObj.tier);
        setDomText(dom.inspectorNameEl, `${cfg.icon} ${cfg.name} ${nameTierTag}`);
        if (dom.inspectorLineageEl) {
            const lineageText = EvoSys && typeof EvoSys.getTowerLineagePathText === 'function'
                ? EvoSys.getTowerLineagePathText(towerObj)
                : (cfg.lineagePath || `${cfg.icon} ${cfg.name}`);
            setDomText(dom.inspectorLineageEl, `${L('血脈：', 'Lineage: ')}${lineageText}`);
        }
        const isBeamStyle = cfg.attackStyle === 'pierce_beam' || cfg.attackStyle === 'plasma_A_deathray' || cfg.attackStyle === 'plasma_B_refract';
        setDomText(dom.inspectorDpsEl, `${L('單體 DPS', 'Single DPS')} ${stats.dps}${isBeamStyle ? (towerObj.focusStacks > 0 ? L(`(${towerObj.focusStacks}層)`, `(${towerObj.focusStacks}stk)`) : L('(蓄能)', '(Charging)')) : ''}`);
        if (dom.inspectorAoeDpsEl) {
            const hasAoe = Number.isFinite(stats.aoeDps) && stats.aoeDps > 0 && Boolean(stats.aoeLabel);
            dom.inspectorAoeDpsEl.classList.toggle('hidden', !hasAoe);
            if (hasAoe) setDomText(dom.inspectorAoeDpsEl, `${L('預估群傷 DPS', 'AoE DPS')} ${stats.aoeDps}`);
        }
        if (dom.inspectorTotalDmgEl) {
            setDomText(dom.inspectorTotalDmgEl, `${L('累計傷害', 'Total Dmg')} ${Math.round(towerObj.totalDamage || 0).toLocaleString()}`);
        }
        setDomText(dom.inspectorRangeEl, `${L('射程', 'Rng')} ${stats.rangeStr}`);
        if (dom.inspectorTerrainEl) {
            dom.inspectorTerrainEl.classList.toggle('hidden', !tInfo || !tInfo.shortTag);
            dom.inspectorTerrainEl.innerText = (tInfo && tInfo.shortTag) ? tInfo.shortTag : '';
        }
        if (dom.inspectorAwakenBtn) {
            const canShowAwaken = Boolean(st.isEndlessMode && towerObj.tier >= 3 && !towerObj.isCrowned);
            dom.inspectorAwakenBtn.classList.toggle('hidden', !canShowAwaken);
            if (canShowAwaken) {
                const costSpec = EconSys.getCrownAwakenCost ? EconSys.getCrownAwakenCost() : { gold: 220, dew: 60 };
                const maxCrowns = 2;
                const usedCrowns = st.crownedUsedCount || 0;
                const remainCrowns = Math.max(0, maxCrowns - usedCrowns);
                const canAfford = EconSys.canAffordCrownAwaken ? EconSys.canAffordCrownAwaken() : (st.currentGold >= costSpec.gold && st.dewEnergy >= costSpec.dew);
                if (remainCrowns <= 0) {
                    dom.inspectorAwakenBtn.innerText = L(`👑 聖冠已滿 (${usedCrowns}/${maxCrowns})`, `👑 Max Crowns (${usedCrowns}/${maxCrowns})`);
                    dom.inspectorAwakenBtn.disabled = true;
                } else {
                    dom.inspectorAwakenBtn.innerText = L(`👑 覺醒聖冠 (${costSpec.gold} 💰 · ${costSpec.dew} 💧 · ${remainCrowns}/2)`, `👑 Awaken (${costSpec.gold} 💰 · ${costSpec.dew} 💧 · ${remainCrowns}/2)`);
                    dom.inspectorAwakenBtn.disabled = !isGameplayActive() || !canAfford;
                }
            }
        }
        setDomText(dom.inspectorTargetBtn, `${L('索敵：', 'Target: ')}${targetLabels[mode] || L('最前', 'First')}`);
        if (dom.inspectorTargetBtn) dom.inspectorTargetBtn.disabled = !isMatchPhaseActive();
        setDomText(dom.inspectorSellBtn, `${L('出售', 'Sell')} (+${EconSys.getTowerSellRefund(towerObj)} 💰)`);
        if (dom.inspectorSellBtn) dom.inspectorSellBtn.disabled = !isGameplayActive();
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
        if (labelEl) labelEl.innerText = `${skillName} (${cost} ${L('靈露', 'Dew')})`;
        if (subEl) {
            if (activeMs > 0 && activePrefix) subEl.innerText = `${activePrefix} ${(activeMs / 1000).toFixed(1)}s`;
            else if (isCooling) subEl.innerText = `${L('冷卻', 'CD')} ${(cdMs / 1000).toFixed(1)}s`;
            else if (isLowDew) subEl.innerText = L(`還差 ${missingDew} 靈露`, `Need ${missingDew} Dew`);
            else subEl.innerText = `${L('就緒', 'Ready')} · [${hotkey}]`;
        }
        if (activePrefix) btn.classList.toggle('skill-active', activeMs > 0);
        btn.classList.toggle('skill-cooling', isCooling);
        btn.classList.toggle('skill-low-dew', isLowDew);
        btn.title = isCooling ? L(`冷卻中，剩餘 ${(cdMs / 1000).toFixed(1)} 秒`, `Cooldown ${(cdMs / 1000).toFixed(1)}s`) : (isLowDew ? L(`靈露不足，需 ${cost} 靈露（還差 ${missingDew} 靈露）`, `Requires ${cost} Dew (${missingDew} needed)`) : L(`消耗 ${cost} 靈露立即施放`, `Spend ${cost} Dew to cast`));
        btn.disabled = !isGameplayActive() || activeMs > 0 || isCooling || isLowDew;
    }

    function updateSkillButtonsUI() {
        const dom = G.dom, st = G.state;
        const treeData = (GameApp.data && GameApp.data.tree) || {};
        const tc = treeData.TREE_CONFIG || {};
        const skills = treeData.ACTIVE_SKILLS || {};
        const dewMax = tc.DEW_MAX || 100;
        const ent = skills.entangle || { cost: 40, cdMs: 8000, name: L('根鬚纏繞', 'Root Entangle'), hotkey: 'Q' };
        const frz = skills.frenzy || { cost: 60, cdMs: 12000, name: L('自然狂熱', 'Nature Frenzy'), hotkey: 'W' };

        setDomText(dom.dewDisplay, `${st.dewEnergy}/${dewMax}`);
        if (dom.dewBarFillEl) dom.dewBarFillEl.style.width = `${Math.max(0, Math.min(100, (st.dewEnergy / dewMax) * 100))}%`;
        updateSkillBtnVisual(dom.skillEntangleBtn, dom.skillEntangleMask, dom.skillEntangleDewBar, dom.skillEntangleLabel, dom.skillEntangleSub, st.entangleCdMs, ent.cdMs, 0, ent.cost, ent.name, ent.hotkey, null);
        updateSkillBtnVisual(dom.skillFrenzyBtn, dom.skillFrenzyMask, dom.skillFrenzyDewBar, dom.skillFrenzyLabel, dom.skillFrenzySub, st.frenzyCdMs, frz.cdMs, st.frenzyActiveMs, frz.cost, frz.name, frz.hotkey, L('狂熱中', 'Active'));
    }

    const WAVE_STATE_TEXT = {
        WAITING_START: () => L('等待開始', 'Standby'), BLESSING_SELECT: () => L('賜福選擇', 'Blessing'),
        PREP: st => `${L('備戰', 'Prep')} ${Math.max(1, Math.ceil(st.waveTimerMs / 1000))}s`,
        INTERMISSION: st => `${L('下波', 'Next')} ${Math.max(1, Math.ceil(st.waveTimerMs / 1000))}s`,
        SPAWNING: (_, b) => (b ? L('魔王決戰', 'Boss Wave') : L('出怪中', 'Spawning')), CLEARING: (_, b) => (b ? L('魔王決戰', 'Boss Wave') : L('清場中', 'Clearing')),
        VICTORY: () => L('通關勝利', 'Victory')
    };

    function syncPauseUI() {
        const dom = G.dom, st = G.state;
        const canPause = isMatchPhaseActive();
        const showPaused = Boolean(st.isPaused && canPause);
        if (dom.pauseBtn) {
            dom.pauseBtn.disabled = !canPause;
            dom.pauseBtn.classList.toggle('is-paused', showPaused);
            dom.pauseBtn.innerText = showPaused ? L('繼續', 'Resume') : L('暫停', 'Pause');
        }
        if (dom.pauseBannerEl) {
            dom.pauseBannerEl.classList.toggle('hidden', !showPaused);
        }
        if (dom.boardStageEl) {
            dom.boardStageEl.classList.toggle('is-paused', showPaused);
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
        dom.wavePhaseTagEl.innerText = st.isPaused ? L('已暫停', 'Paused') : ((WAVE_STATE_TEXT[st.waveState] && WAVE_STATE_TEXT[st.waveState](st, isBoss)) || L('已結束', 'Ended'));
        syncPauseUI();
        if (dom.nextWaveBtn) {
            const canSkip = isGameplayActive() && (st.waveState === 'PREP' || st.waveState === 'INTERMISSION');
            dom.nextWaveBtn.disabled = !canSkip;
            dom.nextWaveBtn.innerText = canSkip ? `${st.waveState === 'PREP' ? L('立即開波', 'Start Wave') : L('提前下波', 'Next Wave')} (+${EconSys.getEarlyWaveBonus()} 💰)` : L('立即開波', 'Start Wave');
        }
    }

    function updateSeedPityUI() {
        const badge = G.dom.seedPityBadgeEl;
        const seedInterval = (GameApp.data && GameApp.data.tree && GameApp.data.tree.TREE_CONFIG && GameApp.data.tree.TREE_CONFIG.BLESSING_SEED_INTERVAL) || 5;
        const hasSeed = TreeSys.hasBlessing('abundant_seed');
        const pityReady = Boolean(hasSeed && (G.state.seedPityCount + 1) >= seedInterval);

        if (badge) {
            if (!hasSeed) {
                badge.classList.add('hidden');
                badge.classList.remove('pity-ready');
            } else {
                badge.classList.remove('hidden');
                badge.classList.toggle('pity-ready', pityReady);
                badge.innerText = pityReady
                    ? `✨ 豐饒種子已充能（${G.state.seedPityCount}/${seedInterval}）：下次召喚必出 ★★！`
                    : `豐饒種子保底進度：${G.state.seedPityCount}/${seedInterval}`;
            }
        }

        const spawnerBtns = G.dom.spawnerBtns || {};
        Object.keys(spawnerBtns).forEach((key) => {
            const ref = spawnerBtns[key];
            if (!ref || !ref.btn) return;
            ref.btn.classList.toggle('is-pity-next', pityReady);
            if (ref.pityTagEl) {
                ref.pityTagEl.classList.toggle('hidden', !pityReady);
            }
        });
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
        G.dom.soundBtn.innerText = SoundEngine.isMuted ? L('靜音', 'Muted') : L('音效', 'Audio');
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
            headerEl.innerText = `${prefixLabel} · ${L('已達最終波', 'Final Wave')}`;
            listEl.innerHTML = `<li class="forecast-item forecast-boss">${L('守住第 10 波即可通關', 'Hold Wave 10 to win')}</li>`;
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
            const weakTag = wCfg ? `${L('弱', 'Weak ')}${L(wCfg.name.charAt(0), wCfg.name.split(' ')[0])}` : '';
            items.push(`<li class="forecast-item"><span>${mCfg.name} <span class="num">×${cnt}</span></span><span class="forecast-weak weak-${mCfg.weakness}">${weakTag}</span></li>`);
        });
        if (plan.eliteCount > 0) {
            items.push(`<li class="forecast-meta num">${L(`含 ${plan.eliteCount} 隻護甲菁英（甲 ${plan.eliteArmor}）`, `Includes ${plan.eliteCount} Armored Elites (ARM ${plan.eliteArmor})`)}</li>`);
        }
        if (plan.bossMeta) {
            const bWeak = towersDict[plan.bossMeta.weakness];
            const bWeakStr = bWeak ? `${L('弱', 'Weak ')}${L(bWeak.name.charAt(0), bWeak.name.split(' ')[0])}` : '';
            items.push(`<li class="forecast-item forecast-boss"><span>${L('王', 'Boss')} · ${plan.bossMeta.name}</span><span class="forecast-weak weak-${plan.bossMeta.weakness} num">${bWeakStr} · ${L('甲', 'ARM')} ${plan.bossMeta.armor}</span></li>`);
        } else if (normalTotal > 0 && plan.eliteCount === 0) {
            items.push(`<li class="forecast-meta num">${L(`共 ${normalTotal} 隻敵軍進攻`, `${normalTotal} enemies incoming`)}</li>`);
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

        const curLabel = L('本波情報', 'Current');
        const nextLabel = L('下波預告', 'Next');
        renderForecastListInto(dom.forecastCurrentHeaderEl, dom.forecastCurrentListEl, curWave, curLabel);
        renderForecastListInto(dom.forecastNextHeaderEl, dom.forecastNextListEl, nextWave, nextLabel, isFinalClear);
        renderForecastListInto(dom.sideCurrentHeaderEl, dom.sideCurrentListEl, curWave, curLabel);
        renderForecastListInto(dom.sideNextHeaderEl, dom.sideNextListEl, nextWave, nextLabel, isFinalClear);

        if (dom.forecastBarTitleEl) {
            dom.forecastBarTitleEl.innerText = isPrepPhase ? `${nextLabel} · Wave ${targetWave}` : `${L('戰況預告', 'Intel')} · Wave ${curWave}`;
        }
        if (dom.forecastInlineSummaryEl) {
            if (isPrepPhase) {
                const plan = WaveSys.buildWaveQueue(targetWave);
                dom.forecastInlineSummaryEl.innerText = summarizePlanInline(plan);
            } else {
                const nextPlan = !isFinalClear ? WaveSys.buildWaveQueue(nextWave) : null;
                dom.forecastInlineSummaryEl.innerText = nextPlan
                    ? `${L('下波', 'Next')} W${nextWave}：${summarizePlanInline(nextPlan)}`
                    : L('最終魔王決戰進行中', 'Final Boss Battle in Progress');
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
        const treeCfg = (GameApp.data && GameApp.data.tree && GameApp.data.tree.TREE_CONFIG) || {};
        const maxHp = st.maxBaseHp || treeCfg.INITIAL_BASE_HP || CONFIG.INITIAL_BASE_HP || 20;
        setDomText(dom.goldDisplay, st.currentGold);
        setDomText(dom.baseHpDisplay, `${st.baseHp}/${maxHp}`);
        setDomText(dom.waveDisplay, st.isEndlessMode ? `Wave ${st.currentWave} (無盡)` : `Wave ${st.currentWave} / ${CONFIG.VICTORY_WAVE || 10}`);
        setDomText(dom.bestWaveDisplay, `Wave ${st.bestWave}`);
        updateWavePhaseUI(); Renderer.updateWorldTreeVisualState(); updateSkillButtonsUI();
        updateSeedPityUI(); updateTowerInspector(); updateBossStatusBar(); updateSoundButtonUI();
        updateWaveForecastUI(); updateMonsterHoverCardUI();

        const activePlay = isGameplayActive();
        const shopTypes = getShopTowerTypes();
        if (!activePlay && st.pendingSpawnType) {
            st.pendingSpawnType = null;
        }
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
            ref.btn.classList.toggle('is-pending-spawn', Boolean(activePlay && !isLowGold && st.pendingSpawnType === type));
        }
    }

    /**
     * 透過 Object.keys() 動態掃描 tower_data.js 基礎角色，生成下方「44x44 圖片 ＋ 名字 ＋ 價錢」三段式召喚卡片
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
            const shopKey = data.shopKey || type;
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.id = `spawn-btn-${shopKey}`;
            btn.dataset.towerType = type;
            btn.dataset.shopKey = shopKey;
            btn.classList.add('spawn-card-btn', `btn-type-${shopKey}`, `btn-type-${type}`);
            if (data.color && !['fire', 'ice', 'thunder'].includes(shopKey)) {
                btn.style.borderLeftColor = data.color;
            }
            const cost = EconSys.getSummonCost(type);
            const roleLabel = data.shopRoleTag || data.roleTag || '';
            btn.innerHTML = `
                <span class="spawn-pity-tag hidden" aria-hidden="true">✨ 下次必出 ★★</span>
                <span class="spawn-card-portrait">
                    <canvas class="spawn-portrait-canvas" width="36" height="36" data-size="36" aria-hidden="true"></canvas>
                </span>
                <span class="spawn-card-head">${data.icon} ${data.name} · <span class="btn-cost-val num">${cost} 💰</span></span>
                <span class="spawn-card-role num">${roleLabel}</span>
            `;
            const canvasEl = btn.querySelector('.spawn-portrait-canvas');
            if (canvasEl && Renderer && typeof Renderer.drawPortrait === 'function') {
                Renderer.drawPortrait(canvasEl, 'tower', type, { tier: 1, size: 36 });
            }
            DragSys.bindShopCardElement(btn, type, handleShopCardClick);
            container.appendChild(btn);
            const ref = {
                btn,
                costEl: btn.querySelector('.btn-cost-val'),
                canvasEl,
                pityTagEl: btn.querySelector('.spawn-pity-tag')
            };
            G.dom.spawnerBtns[type] = ref;
            G.dom.spawnerBtns[shopKey] = ref;
        });

        G.dom.seedPityBadgeEl = null;
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

        const placedTower = AttackSys.createTowerObj(type, spawnedTier, deduct.cost);
        st.board[targetIndex] = placedTower;
        st.buildTargetIndex = null;
        st.pendingSpawnType = null;
        st.inspectedMonsterId = null;

        const cfg = towersDict[placedTower.type] || towersDict[type];
        const terrainKey = TerrainSys.getTerrainAt(targetIndex);
        const terrainsDict = (GameApp.data && GameApp.data.terrain && GameApp.data.terrain.TERRAIN_TYPES) || {};
        const tInfo = terrainKey ? terrainsDict[terrainKey] : null;
        const coords = indexToCoords(targetIndex);

        SoundEngine.playSpawn(spawnedTier);
        CodexSys.unlockEntry(`tower:${placedTower.type}`);
        Backend.recordPlayerAction();
        Backend.trackFeel(`Tower:Summon:${type}`, deduct.cost, {
            towerType: type,
            tier: spawnedTier,
            cost: deduct.cost,
            cellIndex: targetIndex
        });
        recordZonePlacementTelemetry(targetIndex);

        if (seedTriggered && Renderer && typeof Renderer.spawnFloatingNotice === 'function') {
            const cellCenter = Renderer.getCellCenter(coords.x, coords.y);
            Renderer.spawnFloatingNotice('🌿 豐饒種子觸發！直接獲得 ★★', cellCenter.left, cellCenter.top, 'pity-seed');
        }

        G.dom.msgText.innerText = seedTriggered
            ? `豐饒種子觸發：於 (${coords.x + 1},${coords.y + 1}) 召喚【${cfg.name} ★★】${tInfo && tInfo.shortTag ? `（${tInfo.shortTag}）` : ''}，花費 ${deduct.cost} 💰。`
            : `已於 (${coords.x + 1},${coords.y + 1}) 召喚【${cfg.name} ${Renderer.getTierStars(spawnedTier)}】${tInfo && tInfo.shortTag ? `（${tInfo.shortTag}）` : ''}，花費 ${deduct.cost} 💰。`;
        Renderer.renderBoard([targetIndex]);
        updateHUD();
        return true;
    }

    /**
     * 點擊商店元素卡（雙模式建塔）：
     *   1. 若已選中合法空白草地格 -> 直接於該格扣款建塔
     *   2. 若尚未選中空格 -> 進入/取消「待放置狀態」（高亮全部可建造空地）
     */
    function handleShopCardClick(type) {
        const st = G.state;
        const towersDict = getTowersDict();
        if (!isGameplayActive() || !towersDict[type]) return false;

        Backend.recordPlayerAction();
        const cost = EconSys.getSummonCost(type);
        const btnEl = G.dom.spawnerBtns[type] && G.dom.spawnerBtns[type].btn;
        if (!EconSys.canAffordSummon(type)) {
            st.pendingSpawnType = null;
            G.dom.msgText.innerText = `金幣不足，召喚【${towersDict[type].name}】需要 ${cost} 💰。`;
            if (btnEl) {
                btnEl.classList.remove('shake-anim', 'insufficient-gold');
                void btnEl.offsetWidth;
                btnEl.classList.add('shake-anim', 'insufficient-gold');
            }
            Renderer.renderBoard([]);
            updateHUD();
            return false;
        }

        if (st.buildTargetIndex !== null && st.board[st.buildTargetIndex] === null && TerrainSys.canBuildAt(st.buildTargetIndex)) {
            return spawnTowerAtCell(type, st.buildTargetIndex);
        }

        st.selectedIndex = null;
        st.inspectedMonsterId = null;
        if (st.pendingSpawnType === type) {
            st.pendingSpawnType = null;
            G.dom.msgText.innerText = '已取消待放置模式。';
        } else {
            st.pendingSpawnType = type;
            st.buildTargetIndex = null;
            const cfg = towersDict[type];
            G.dom.msgText.innerText = `已選取【${cfg.icon} ${cfg.name}】(${cost} 💰)，點選棋盤可建格放置（按 Esc 或再點卡片取消）。`;
        }
        Renderer.renderBoard([]);
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
            G.dom.msgText.innerText = `金幣不足，召喚【${towersDict[type].name}】需要 ${cost} 💰。`;
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
            G.dom.msgText.innerText = '可建造地塊已滿，請先融合或出售騰出空間。';
            return;
        }
        spawnTowerAtCell(type, targetIdx);
    }

    function handleCellClick(index) {
        const st = G.state;
        const towersDict = getTowersDict();
        const terrainsDict = (GameApp.data && GameApp.data.terrain && GameApp.data.terrain.TERRAIN_TYPES) || {};
        Backend.recordPlayerAction();
        st.inspectedMonsterId = null;

        if (!isGameplayActive()) {
            if (st.isPaused && isMatchPhaseActive()) {
                if (st.board[index] !== null && st.selectedIndex !== index) {
                    st.selectedIndex = index; st.buildTargetIndex = null; st.pendingSpawnType = null;
                    const t = st.board[index], terrain = TerrainSys.getTerrainAt(index);
                    const tInfo = terrain ? terrainsDict[terrain] : null;
                    G.dom.msgText.innerText = `暫停檢視：【${(towersDict[t.type] && towersDict[t.type].name) || t.type} ${Renderer.getTierStars(t.tier)}】${tInfo && tInfo.shortTag ? `｜${tInfo.shortTag}` : ''}（可切換索敵，恢復後可移塔或融合）。`;
                } else {
                    const nearMon = findMonsterNearCell(index);
                    if (nearMon) {
                        st.selectedIndex = null; st.hoveredIndex = null; st.buildTargetIndex = null;
                        st.inspectedMonsterId = nearMon.id;
                        G.dom.msgText.innerText = formatMonsterInspectText(nearMon);
                    } else {
                        st.selectedIndex = null; st.hoveredIndex = null; st.buildTargetIndex = null;
                        G.dom.msgText.innerText = st.board[index] === null ? '暫停中可點防禦塔／怪物檢視與切換索敵，按「繼續」或 Space 恢復操作。' : '已取消選取。';
                    }
                }
                Renderer.renderBoard([]);
                updateTowerInspector();
            }
            return;
        }

        if (st.pendingSpawnType) {
            const pendingType = st.pendingSpawnType;
            if (TerrainSys.canBuildAt(index) && st.board[index] === null) {
                spawnTowerAtCell(pendingType, index);
                return;
            }
            if (st.board[index] !== null) {
                st.pendingSpawnType = null;
                st.selectedIndex = index; st.buildTargetIndex = null;
                const t = st.board[index], terrain = TerrainSys.getTerrainAt(index);
                const tInfo = terrain ? terrainsDict[terrain] : null;
                G.dom.msgText.innerText = `已退出待放置並選取【${(towersDict[t.type] && towersDict[t.type].name) || t.type} ${Renderer.getTierStars(t.tier)}】${tInfo && tInfo.shortTag ? `｜地形：${tInfo.shortTag}` : ''}。`;
                Renderer.renderBoard([]);
                updateHUD();
                return;
            }
            G.dom.msgText.innerText = G.map.pathCellIndices.has(index)
                ? '怪物路徑不可建塔，請點選可建地塊（按 Esc 取消）。'
                : '該地形不可建塔，請點選可建地塊（按 Esc 取消）。';
            return;
        }

        if (st.selectedIndex === null) {
            if (st.board[index] !== null) {
                if (st.isTouchMode) clearMonsterHoverLock();
                st.selectedIndex = index; st.buildTargetIndex = null;
                const t = st.board[index], terrain = TerrainSys.getTerrainAt(index);
                const tInfo = terrain ? terrainsDict[terrain] : null;
                G.dom.msgText.innerText = `已選取【${(towersDict[t.type] && towersDict[t.type].name) || t.type} ${Renderer.getTierStars(t.tier)}】${tInfo && tInfo.shortTag ? `｜地形：${tInfo.shortTag}` : ''}（可切換索敵、出售或拖曳融合/移動）`;
            } else if (TerrainSys.canBuildAt(index)) {
                if (st.isTouchMode) clearMonsterHoverLock();
                st.selectedIndex = null; st.hoveredIndex = null;
                if (st.buildTargetIndex === index) {
                    st.buildTargetIndex = null;
                    G.dom.msgText.innerText = '已取消指定建造位置。';
                } else {
                    st.buildTargetIndex = index;
                    const c = indexToCoords(index), terrain = TerrainSys.getTerrainAt(index);
                    const tInfo = terrain ? terrainsDict[terrain] : null;
                    G.dom.msgText.innerText = `已選取空地 (${c.x + 1},${c.y + 1})${tInfo && tInfo.shortTag ? `（${tInfo.shortTag}）` : ''}，點擊下方元素卡即可建塔。`;
                }
            } else if (TerrainSys.getTerrainAt(index) === 'obstacle' && typeof TerrainSys.clearObstacleAt === 'function') {
                if (st.isTouchMode) clearMonsterHoverLock();
                st.selectedIndex = null; st.hoveredIndex = null; st.buildTargetIndex = null;
                const clearRes = TerrainSys.clearObstacleAt(index);
                if (!clearRes.ok) {
                    if (clearRes.reason === 'insufficient_gold') {
                        G.dom.msgText.innerText = `爆破古代巨岩需花費 ${clearRes.cost} 💰，當前金幣不足。`;
                    }
                    Renderer.renderBoard([]);
                    return;
                }
                if (typeof Renderer.refreshCellTerrain === 'function') Renderer.refreshCellTerrain(index);
                const c = indexToCoords(index);
                const center = Renderer.getCellCenter(c.x, c.y);
                Renderer.emitParticleBurst(center.left, center.top, '#D97724', 12, 95);
                SoundEngine.playMerge(2, true);
                const revInfo = clearRes.revealedTerrain ? terrainsDict[clearRes.revealedTerrain] : null;
                G.dom.msgText.innerText = revInfo
                    ? `地脈拓荒完成（-${clearRes.cost} 💰）：岩層下發掘出【${revInfo.name} · ${revInfo.shortTag}】！`
                    : `地脈拓荒完成（-${clearRes.cost} 💰）：已清除障礙，可在此座標建造防禦塔。`;
                Renderer.renderBoard([index]);
                updateHUD();
                return;
            } else {
                st.selectedIndex = null; st.hoveredIndex = null; st.buildTargetIndex = null;
                const nearMon = findMonsterNearCell(index);
                if (nearMon) {
                    lockTouchMonsterInspect(nearMon);
                    return;
                } else if (st.isTouchMode) {
                    clearMonsterHoverLock();
                }
            }
        } else if (st.selectedIndex === index) {
            st.selectedIndex = null; st.hoveredIndex = null; st.buildTargetIndex = null;
            if (st.isTouchMode) clearMonsterHoverLock();
            G.dom.msgText.innerText = '已取消選取。';
        } else {
            const fromIdx = st.selectedIndex;
            if (st.isTouchMode && G.map.pathCellIndices.has(index)) {
                const nearMon = findMonsterNearCell(index);
                if (nearMon) {
                    lockTouchMonsterInspect(nearMon);
                    return;
                }
                st.selectedIndex = null; st.hoveredIndex = null; st.buildTargetIndex = null;
                clearMonsterHoverLock();
                Renderer.renderBoard([]);
                Renderer.updateRangeIndicator();
                return;
            }
            st.selectedIndex = null; st.hoveredIndex = null; st.buildTargetIndex = null;
            handleAction(fromIdx, index);
            return;
        }
        Renderer.renderBoard([]);
        Renderer.updateRangeIndicator();
    }

    function handleAction(fromIndex, toIndex) {
        const st = G.state;
        const boardSize = CONFIG.BOARD_SIZE || 150;
        if (!isGameplayActive()) return false;
        if (fromIndex === null || toIndex === null || fromIndex === toIndex) { Renderer.renderBoard([]); return false; }
        if (fromIndex < 0 || fromIndex >= boardSize || toIndex < 0 || toIndex >= boardSize || !st.board[fromIndex]) return false;
        if (!TerrainSys.canBuildAt(toIndex)) {
            G.dom.msgText.innerText = G.map.pathCellIndices.has(toIndex)
                ? '怪物路徑不可放置防禦塔。'
                : '該地形不可放置防禦塔。';
            Renderer.renderBoard([]);
            return false;
        }

        Backend.recordPlayerAction();
        const fromTower = st.board[fromIndex], toTower = st.board[toIndex];
        if (toTower === null) {
            const moveCost = EconSys.getCombatMoveCost();
            if (!isRelocationFree()) {
                if (st.currentGold < moveCost) {
                    G.dom.msgText.innerText = `戰鬥期間調度塔位需花費 ${moveCost} 💰，金幣不足。`;
                    Renderer.renderBoard([]);
                    return false;
                }
                st.currentGold -= moveCost;
                G.dom.msgText.innerText = `戰術調度完成，花費 ${moveCost} 💰。`;
            } else {
                G.dom.msgText.innerText = '已免費移動防禦塔位置。';
            }
            st.board[toIndex] = fromTower;
            st.board[fromIndex] = null;
            recordZonePlacementTelemetry(toIndex);
            Renderer.renderBoard([fromIndex, toIndex]);
            updateHUD();
            return true;
        }

        const fusionPreview = EvoSys.getFusionResult(fromTower, toTower);
        if (fusionPreview && fusionPreview.requiresConfirmation) {
            openEvolutionConfirmModal(fromIndex, toIndex, fusionPreview);
            return true;
        }

        const res = EvoSys.executeTowerFusion(fromIndex, toIndex);
        if (res) {
            const { fusion, bonusHint } = res;
            const cfg = getTowersDict()[fusion.type] || { name: fusion.type };
            SoundEngine.playMerge(fusion.tier, fusion.isCrossElement);
            const actionVerb = fusion.mode === 'transfer_t1' ? '轉職成功' : '升星成功';
            G.dom.msgText.innerText = `${actionVerb}：【${cfg.name} ${Renderer.getTierStars(fusion.tier)}】${bonusHint || ''}`;
            Renderer.renderBoard([fromIndex, toIndex]);
            updateHUD();
            return true;
        }
        const maxTier = (GameApp.data && GameApp.data.evolutions && GameApp.data.evolutions.MAX_TIER) || 3;
        if (fromTower.tier >= maxTier || toTower.tier >= maxTier) {
            G.dom.msgText.innerText = `${Renderer.getTierStars(maxTier)} 已達最高星級，無法繼續融合。`;
        } else if (EvoSys && typeof EvoSys.getIncompatibilityReason === 'function') {
            G.dom.msgText.innerText = `${EvoSys.getIncompatibilityReason(fromTower, toTower)}（詳見世界樹圖譜）。`;
        } else {
            G.dom.msgText.innerText = '該組合無法融合，請於「世界樹圖譜」確認轉職與升星規則。';
        }
        Renderer.renderBoard([]);
        return false;
    }

    function openEvolutionConfirmModal(fromIndex, toIndex, fusionPreview) {
        const st = G.state, dom = G.dom;
        if (!fusionPreview || !Array.isArray(fusionPreview.options) || fusionPreview.options.length === 0) return false;
        const fromTower = st.board[fromIndex], toTower = st.board[toIndex];
        if (!fromTower || !toTower) return false;

        st.pendingEvolution = {
            fromIndex,
            toIndex,
            tier: fusionPreview.tier || 3,
            mode: fusionPreview.mode,
            options: fusionPreview.options.slice(),
            previewLabel: fusionPreview.previewLabel || ''
        };

        if (typeof Renderer.showDragEvolutionPreview === 'function') {
            Renderer.showDragEvolutionPreview(fromIndex, toIndex, fusionPreview.previewLabel || '世界樹進化確認', true);
        }

        const towersDict = getTowersDict();
        const isSingle = fusionPreview.options.length === 1;
        const isInfusion = fusionPreview.mode === 'infusion_single' || (fusionPreview.tier === 2 && isSingle);
        if (dom.evoConfirmTitleEl) {
            dom.evoConfirmTitleEl.innerText = isInfusion
                ? (fusionPreview.title || '元素灌注升星確認（0.15x 子彈時間）')
                : (isSingle ? '定向冠枝開花確認（0.15x 子彈時間）' : '世界樹冠枝雙分岔選擇（0.15x 子彈時間）');
        }
        if (dom.evoConfirmOptionsEl) {
            dom.evoConfirmOptionsEl.innerHTML = '';
            dom.evoConfirmOptionsEl.classList.toggle('single-branch', isSingle);
            fusionPreview.options.forEach((optType, idx) => {
                const cfg = towersDict[optType] || { icon: '✨', name: optType, badges: [], defaultLineagePath: [] };
                const targetTier = cfg.nodeTier || fusionPreview.tier || 3;
                const targetStars = Renderer.getTierStars(targetTier);
                const lineageText = Array.isArray(cfg.defaultLineagePath) ? cfg.defaultLineagePath.join(' ▸ ') : (cfg.lineagePath || '');
                const card = document.createElement('button');
                card.type = 'button';
                card.className = 'evo-branch-card';
                card.dataset.branchType = optType;
                const badgeChips = Array.isArray(cfg.badges)
                    ? cfg.badges.slice(0, 3).map(b => `<span class="evo-badge-chip">${b}</span>`).join('')
                    : '';
                const hotkeyLabel = isInfusion
                    ? '確認灌注升星 [Enter]'
                    : (isSingle ? '確認開花 [Enter]' : (idx === 0 ? '選擇 A 分支 [A / 1]' : '選擇 B 分支 [D / 2]'));
                card.innerHTML = `
                    <div class="evo-branch-top">
                        <canvas class="evo-branch-portrait" width="44" height="44" aria-hidden="true"></canvas>
                        <div class="evo-branch-meta">
                            <span class="evo-branch-name">${cfg.icon} ${cfg.name} ${targetStars}</span>
                            <span class="evo-branch-lineage">${lineageText}</span>
                        </div>
                    </div>
                    <div class="evo-badge-list">${badgeChips}</div>
                    <div class="evo-branch-cta">${hotkeyLabel}</div>
                `;
                const canvasEl = card.querySelector('.evo-branch-portrait');
                if (canvasEl && Renderer && typeof Renderer.drawPortrait === 'function') {
                    Renderer.drawPortrait(canvasEl, 'tower', optType, { tier: targetTier, size: 44 });
                }
                card.addEventListener('click', () => {
                    confirmPendingEvolution(optType);
                });
                dom.evoConfirmOptionsEl.appendChild(card);
            });
        }
        if (dom.evoConfirmOverlayEl) {
            dom.evoConfirmOverlayEl.classList.remove('hidden');
        }
        if (dom.msgText) {
            dom.msgText.innerText = isInfusion
                ? `${fusionPreview.previewLabel}：點擊「確認灌注升星」或按 [Enter] 完成升星，按 [Esc] 取消。`
                : (isSingle
                    ? `${fusionPreview.previewLabel}：點擊「確認開花」或按 [Enter] 完成進化，按 [Esc] 取消。`
                    : `${fusionPreview.previewLabel}：請選擇 A 或 B 冠枝（熱鍵 [A]/[D]），或按 [Esc] 取消。`);
        }
        return true;
    }

    function confirmPendingEvolution(chosenBranchType = null) {
        const st = G.state, dom = G.dom;
        const pending = st.pendingEvolution;
        if (!pending) return false;
        const branchType = chosenBranchType || pending.options[0];
        if (!branchType || !pending.options.includes(branchType)) return false;

        st.pendingEvolution = null;
        if (dom.evoConfirmOverlayEl) dom.evoConfirmOverlayEl.classList.add('hidden');
        if (typeof Renderer.clearDragEvolutionPreview === 'function') {
            Renderer.clearDragEvolutionPreview();
        }

        const res = EvoSys.executeTowerFusion(pending.fromIndex, pending.toIndex, branchType);
        if (res) {
            const { fusion, bonusHint } = res;
            const cfg = getTowersDict()[fusion.type] || { name: fusion.type };
            st.selectedIndex = pending.toIndex;
            SoundEngine.playMerge(fusion.tier, fusion.isCrossElement);
            if (dom.msgText) {
                const verb = fusion.tier === 2 ? '元素灌注升星完成' : '冠枝開花完成';
                dom.msgText.innerText = `${verb}：【${cfg.icon || ''} ${cfg.name} ${Renderer.getTierStars(fusion.tier)}】${bonusHint || ''}`;
            }
            Renderer.renderBoard([pending.fromIndex, pending.toIndex]);
            updateHUD();
            return true;
        }
        Renderer.renderBoard([]);
        updateHUD();
        return false;
    }

    function cancelPendingEvolution() {
        const st = G.state, dom = G.dom;
        if (!st.pendingEvolution) return false;
        const { fromIndex, toIndex } = st.pendingEvolution;
        st.pendingEvolution = null;
        if (dom.evoConfirmOverlayEl) dom.evoConfirmOverlayEl.classList.add('hidden');
        if (typeof Renderer.clearDragEvolutionPreview === 'function') {
            Renderer.clearDragEvolutionPreview();
        }
        if (dom.msgText) {
            dom.msgText.innerText = '已取消進化確認，防禦塔維持原位且未消耗。';
        }
        Renderer.renderBoard([fromIndex, toIndex]);
        updateHUD();
        return true;
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
        const treeCfg = (GameApp.data && GameApp.data.tree && GameApp.data.tree.TREE_CONFIG) || {};
        const maxHp = st.maxBaseHp || treeCfg.INITIAL_BASE_HP || CONFIG.INITIAL_BASE_HP || 20;
        let starsNum = 1, stars = '★', rankText = '驚險死守，於危急時刻擊退腐朽古樹王。';
        if (st.baseHp >= maxHp) { starsNum = 3; stars = '★★★'; rankText = '完美防守，世界樹滿血守護通關第 10 波。'; }
        else if (st.baseHp >= Math.ceil(maxHp * 0.5)) { starsNum = 2; stars = '★★'; rankText = '穩固防線，成功守護世界樹擊敗腐朽古樹王。'; }

        const honor = computeRunHonorSummary(st);
        Backend.finalizeWaveFeel(st.currentWave);
        Backend.saveMapRecord(st.currentMapId, st.currentWave, starsNum, {
            isClear: true,
            honorScore: honor.honorScore,
            contractCount: honor.count
        });
        st.bestWave = Math.max(st.bestWave, st.currentWave);
        renderMapSelectorUI();
        finalizeOutcomeScreen('VICTORY', 'victory');
        Backend.trackFeel('Progression:Complete', st.currentGold, { wave: st.currentWave, mapId: st.currentMapId, contracts: honor.count });
        Backend.trackFeel(`Run:Victory:${st.currentMapId}:Wave_${st.currentWave}`, st.baseHp);
        setDomText(G.dom.victoryStarsEl, stars); setDomText(G.dom.victoryRankTextEl, rankText);
        populateBattleRecap('victory');
        if (G.dom.victoryOverlayEl) G.dom.victoryOverlayEl.classList.remove('hidden');
    }

    function triggerGameOver() {
        const st = G.state;
        if (st.isGameOver && st.waveState === 'GAMEOVER') return;
        st.isGameOver = true;
        const honor = computeRunHonorSummary(st);
        Backend.finalizeWaveFeel(st.currentWave);
        Backend.saveMapRecord(st.currentMapId, st.currentWave, null, {
            isClear: false,
            honorScore: honor.honorScore,
            contractCount: honor.count
        });
        renderMapSelectorUI();
        ['startOverlayEl', 'victoryOverlayEl', 'codexOverlayEl', 'guideOverlayEl', 'blessingOverlayEl', 'evoConfirmOverlayEl'].forEach(k => {
            if (G.dom[k]) G.dom[k].classList.add('hidden');
        });
        finalizeOutcomeScreen('GAMEOVER', 'gameover');
        Backend.trackFeel('Progression:Fail', st.killsCount, { wave: st.currentWave, mapId: st.currentMapId, contracts: honor.count });
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
        clearMonsterHoverLock();
        if (DragSys && typeof DragSys.cancelActiveDrag === 'function') {
            DragSys.cancelActiveDrag({ silent: true, resetTimestamps: true });
        }
        if (G.dom.boardStageEl) G.dom.boardStageEl.classList.remove('tree-hit-shake', 'is-paused');
        for (const rec of G.monsterDomMap.values()) rec.el.remove();
        G.monsterDomMap.clear();
        if (G.dom.monsterLayerEl) G.dom.monsterLayerEl.innerHTML = '';
        if (G.dom.floatingLayerEl) G.dom.floatingLayerEl.innerHTML = '';
        Renderer.clearTouchDragVisuals();

        // Phase 5：每局開始／重新開始時重置本局世界樹演化圖譜（保留本地歷史戰績）
        if (CodexSys && typeof CodexSys.resetRunCodex === 'function') {
            CodexSys.resetRunCodex();
        }

        G.state = createInitialMatchState(prev.currentMapId, initialWaveState, nextSession, resetSpeed, selectedContracts);
        G.state.isTouchMode = prev.isTouchMode;
        const mapSpec = WaveSys.getCurrentMapSpec();
        Backend.resetRunTelemetry(G.state.currentMapId, mapSpec.name);
        ['startOverlayEl', 'victoryOverlayEl', 'gameOverOverlayEl', 'codexOverlayEl', 'guideOverlayEl', 'blessingOverlayEl', 'evoConfirmOverlayEl'].forEach(k => {
            if (G.dom[k]) G.dom[k].classList.add('hidden');
        });
        syncPauseUI();
        updateSeedPityUI();
    }

    function restartGame() {
        resetMatchSession('PREP', 1);
        G.dom.msgText.innerText = `【${WaveSys.getCurrentMapSpec().name}】拖曳下方元素卡至棋盤可建格召喚，或按 1/2/3/Q/W/Space 快速操作。`;
        Renderer.renderBoard(); updateHUD(); updateSpeedButtonUI(); startMainLoop();
    }

    function returnToMainMenu() {
        resetMatchSession('WAITING_START', 1);
        WaveSys.applyMapConfig(G.state.currentMapId);
        renderMapSelectorUI();
        renderContractSelectorUI();
        if (G.dom.startOverlayEl) G.dom.startOverlayEl.classList.remove('hidden');
        G.dom.msgText.innerText = '請選擇戰場地圖，點擊「開始防守」進入第 1 波備戰。';
        Renderer.initBoard(); Renderer.renderBoard(); updateHUD(); updateSpeedButtonUI();
    }

    function startGame() {
        const st = G.state;
        if (st.waveState !== 'WAITING_START') return;
        const mapSpec = WaveSys.getCurrentMapSpec();
        st.activeContracts = new Set(selectedContracts);
        const treeCfg = (GameApp.data && GameApp.data.tree && GameApp.data.tree.TREE_CONFIG) || {};
        st.maxBaseHp = st.activeContracts.has('fragile_heart') ? 12 : (treeCfg.INITIAL_BASE_HP || CONFIG.INITIAL_BASE_HP || 20);
        st.baseHp = st.maxBaseHp;
        st.dewEnergy = st.activeContracts.has('dew_drought') ? 0 : (treeCfg.DEW_INITIAL || CONFIG.DEW_INITIAL || 20);
        st.currentGold = EconSys ? EconSys.getInitialGold(mapSpec, st.activeContracts) : st.currentGold;
        if (CodexSys && typeof CodexSys.resetRunCodex === 'function') {
            CodexSys.resetRunCodex();
        }
        Backend.resetRunTelemetry(st.currentMapId, mapSpec.name);
        if (G.dom.startOverlayEl) G.dom.startOverlayEl.classList.add('hidden');
        const basePrepMs = CONFIG.INITIAL_PREP_MS || 6000;
        st.waveState = 'PREP';
        st.waveTimerMs = st.activeContracts.has('rapid_waves') ? Math.round(basePrepMs * 0.5) : basePrepMs;
        const contractTag = st.activeContracts.size > 0 ? `（契約 ×${st.activeContracts.size}）` : '';
        G.dom.msgText.innerText = `【${mapSpec.name}】${contractTag}第 1 波備戰開始，拖曳下方元素卡至空地佈置防線。`;
        setPauseState(false, { silent: true });
    }

    function continueEndlessMode() {
        const st = G.state;
        if (st.waveState !== 'VICTORY') return;
        st.isEndlessMode = true;
        if (G.dom.victoryOverlayEl) G.dom.victoryOverlayEl.classList.add('hidden');
        const baseInterMs = CONFIG.WAVE_INTERMISSION_MS || 4000;
        st.waveState = 'INTERMISSION';
        st.waveTimerMs = (st.activeContracts && st.activeContracts.has('rapid_waves')) ? Math.round(baseInterMs * 0.5) : baseInterMs;
        G.dom.msgText.innerText = '無盡挑戰模式已開啟，波數上限解除。';
        setPauseState(false, { silent: true });
    }

    function gameTick(timestamp) {
        const st = G.state, tickSessionId = st.sessionId;
        if (st.baseHp <= 0 && !st.isGameOver) { triggerGameOver(); return; }
        if (!isGameplayActive()) return;
        if (st.lastFrameTime === null) st.lastFrameTime = timestamp;
        const rawDt = Math.min(0.1, Math.max(0, (timestamp - st.lastFrameTime) / 1000));
        st.lastFrameTime = timestamp;
        const effSpeed = st.pendingEvolution ? 0.15 : clampNumber(st.gameSpeed, 1, 5, 1);
        const dtMs = rawDt * effSpeed * 1000;
        st.elapsedPlayMs = (st.elapsedPlayMs || 0) + dtMs;

        const isCombatWave = st.waveState === 'SPAWNING' || st.waveState === 'CLEARING';
        Backend.tickFeelMetrics(rawDt * 1000, effSpeed, isCombatWave);

        st.entangleCdMs = Math.max(0, st.entangleCdMs - dtMs);
        st.frenzyCdMs = Math.max(0, st.frenzyCdMs - dtMs);
        st.dewOverchargeMs = Math.max(0, (st.dewOverchargeMs || 0) - dtMs);
        const wasFrenzy = st.frenzyActiveMs > 0;
        st.frenzyActiveMs = Math.max(0, st.frenzyActiveMs - dtMs);
        if (wasFrenzy && st.frenzyActiveMs === 0) {
            for (let i = 0; i < G.towerElements.length; i++) if (G.towerElements[i]) G.towerElements[i].classList.remove('frenzy-active');
            updateTowerInspector();
        }
        if (st.entangleCdMs > 0 || st.frenzyCdMs > 0 || wasFrenzy) updateSkillButtonsUI();

        const victoryWave = CONFIG.VICTORY_WAVE || 10;
        const blessingInterval = (GameApp.data && GameApp.data.tree && GameApp.data.tree.TREE_CONFIG && GameApp.data.tree.TREE_CONFIG.BLESSING_INTERVAL_WAVES) || 3;
        const baseInterMs = CONFIG.WAVE_INTERMISSION_MS || 4000;
        const intermissionMs = (st.activeContracts && st.activeContracts.has('rapid_waves')) ? Math.round(baseInterMs * 0.5) : baseInterMs;

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
            G.dom.msgText.innerText = `第 ${st.currentWave} 波防禦完成，下一波將於 ${Math.ceil(intermissionMs / 1000)} 秒後開始。`;
            updateWavePhaseUI();
        }

        if (st.monsters.length > 0) {
            MonsterSys.updateMonsters(dtMs);
            if (st.isGameOver || tickSessionId !== st.sessionId) return;
        } else if (st.groundHazards && st.groundHazards.length > 0 && MonsterSys && typeof MonsterSys.updateGroundHazards === 'function') {
            MonsterSys.updateGroundHazards(dtMs);
        }
        AttackSys.updateTowersCombat(dtMs);
        if (st.hoveredMonsterId !== null) updateMonsterHoverCardUI();
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
        if (!isMatchPhaseActive() || st.selectedIndex === null || st.board[st.selectedIndex] === null) return;
        Backend.recordPlayerAction();
        const t = st.board[st.selectedIndex];
        const towersData = (GameApp.data && GameApp.data.towers) || {};
        const cycle = towersData.TARGET_MODE_CYCLE || ['first', 'armor', 'lowhp'];
        const labels = towersData.TARGET_MODE_LABELS || { first: '最前', armor: '高護甲', lowhp: '殘血' };
        t.targetMode = cycle[(cycle.indexOf(t.targetMode || 'first') + 1) % cycle.length];
        updateTowerInspector();
        const cfg = getTowersDict()[t.type] || { name: t.type };
        G.dom.msgText.innerText = `已將【${cfg.name}】索敵優先級切換為：${labels[t.targetMode]}。`;
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
        G.dom.msgText.innerText = `已出售【${cfg.name} ${Renderer.getTierStars(t.tier)}】，退還 +${refund} 💰。`;
        Renderer.renderBoard([sellIdx]); updateHUD();
    }

    function awakenSelectedTowerCrown() {
        const st = G.state;
        if (!isGameplayActive() || !st.isEndlessMode || st.selectedIndex === null) return false;
        const towerObj = st.board[st.selectedIndex];
        if (!towerObj || towerObj.tier < 3 || towerObj.isCrowned) return false;
        const maxCrowns = 2;
        if ((st.crownedUsedCount || 0) >= maxCrowns) {
            if (G.dom.msgText) G.dom.msgText.innerText = '每局無盡模式最多僅能覺醒 2 座 T4 聖冠防禦塔。';
            return false;
        }
        const costSpec = EconSys.getCrownAwakenCost ? EconSys.getCrownAwakenCost() : { gold: 220, dew: 60 };
        if (st.currentGold < costSpec.gold || st.dewEnergy < costSpec.dew) {
            if (G.dom.msgText) G.dom.msgText.innerText = `聖冠覺醒需 ${costSpec.gold} 💰 與 ${costSpec.dew} 💧，資源不足。`;
            return false;
        }
        Backend.recordPlayerAction();
        st.currentGold -= costSpec.gold;
        st.dewEnergy -= costSpec.dew;
        towerObj.isCrowned = true;
        st.crownedUsedCount = (st.crownedUsedCount || 0) + 1;

        const c = indexToCoords(st.selectedIndex);
        const center = Renderer.getCellCenter(c.x, c.y);
        Renderer.emitRingFX(center.left, center.top, G.boardMetrics.step * 1.45, '#E0B43C', 0.30, 380);
        Renderer.emitParticleBurst(center.left, center.top, '#E0B43C', 14, 110);
        SoundEngine.playMerge(3, true);

        const cfg = getTowersDict()[towerObj.type] || { name: towerObj.type };
        if (G.dom.msgText) {
            G.dom.msgText.innerText = `👑 【${cfg.name}】聖冠覺醒成功！基礎傷害 ×2.2、攻速 +25%、射程 +0.5 格並啟用血脈專屬聖冠被動。`;
        }
        Renderer.renderCellTower(st.selectedIndex);
        Renderer.renderBoard([]);
        Renderer.updateRangeIndicator();
        updateHUD();
        return true;
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
                G.dom.victoryCopyReportBtn.innerText = '已複製本局數據戰報';
                setDomText(G.dom.victoryRatingStatusEl, '戰報已複製至剪貼簿，可直接貼上分享。');
                return res;
            });
        }

        if (G.dom.gameoverCopyReportBtn) {
            G.dom.gameoverCopyReportBtn.addEventListener('click', async () => {
                const res = await Backend.copyBattleReportToClipboard(G, 'gameover');
                G.dom.gameoverCopyReportBtn.innerText = '已複製本局數據戰報';
                setDomText(G.dom.gameoverRatingStatusEl, '戰報已複製至剪貼簿，可直接貼上分享。');
                return res;
            });
        }
    }

    [
        ['inspectorAwakenBtn', awakenSelectedTowerCrown], ['inspectorTargetBtn', cycleSelectedTowerTargetMode], ['inspectorSellBtn', sellSelectedTower], ['nextWaveBtn', triggerEarlyNextWave],
        ['skillEntangleBtn', () => TreeSys.castEntangleSkill()], ['skillFrenzyBtn', () => TreeSys.castFrenzySkill()],
        ['pauseBtn', toggleCombatPause], ['pauseResumeBtn', () => { if (G.state.isPaused) setPauseState(false); }],
        ['pauseMenuBtn', returnToMainMenu], ['soundBtn', () => SoundEngine.toggleMute()],
        ['langBtn', () => { if (GameApp.i18n) { SoundEngine.ensureContext(); GameApp.i18n.toggleLang(); } }],
        ['codexBtn', () => CodexSys.openCodex()], ['codexCloseBtn', () => CodexSys.closeCodex()],
        ['helpBtn', openGuide], ['guideCloseBtn', closeGuide], ['guideMenuBtn', () => { closeGuide(); returnToMainMenu(); }],
        ['forecastToggleBtn', toggleForecastDrawer], ['speedBtn', cycleGameSpeed], ['startGameBtn', startGame],
        ['victoryRestartBtn', restartGame], ['victoryMenuBtn', returnToMainMenu], ['endlessBtn', continueEndlessMode],
        ['restartBtn', restartGame], ['gameoverMenuBtn', returnToMainMenu],
        ['evoCancelBtn', cancelPendingEvolution],
        ['addGoldBtn', () => { if (CONFIG.DEBUG_MODE && isGameplayActive()) { G.state.currentGold += 500; if (G.dom.msgText) G.dom.msgText.innerText = '已增加 500 💰。'; updateHUD(); } }],
        ['clearGoldBtn', () => { if (CONFIG.DEBUG_MODE && isGameplayActive()) { G.state.currentGold = 0; if (G.dom.msgText) G.dom.msgText.innerText = '金幣已歸零。'; updateHUD(); } }]
    ].forEach(([domKey, fn]) => { if (G.dom[domKey] && typeof fn === 'function') G.dom[domKey].addEventListener('click', fn); });

    if (G.dom.mapSelectorGridEl) {
        G.dom.mapSelectorGridEl.addEventListener('click', (e) => {
            const card = e.target && e.target.closest ? e.target.closest('.map-card') : null;
            if (card && card.dataset.mapId) { SoundEngine.ensureContext(); selectMap(card.dataset.mapId); }
        });
    }

    if (G.dom.boardStageEl) {
        G.dom.boardStageEl.addEventListener('mousemove', (e) => {
            const st = G.state;
            if (st.isTouchMode || DragSys.isDragging() || !isMatchPhaseActive()) {
                return;
            }
            const rect = G.dom.boardStageEl.getBoundingClientRect();
            const mx = e.clientX - rect.left;
            const my = e.clientY - rect.top;
            const hitRadius = Math.max(18, (G.boardMetrics && G.boardMetrics.cellW ? G.boardMetrics.cellW * 0.65 : 24));
            let best = null;
            let bestDist = hitRadius;
            for (let i = 0; i < st.monsters.length; i++) {
                const m = st.monsters[i];
                if (!m || m.hp <= 0) continue;
                const d = Math.hypot((m.pixelX || 0) - mx, (m.pixelY || 0) - my);
                if (d < bestDist) {
                    bestDist = d;
                    best = m;
                }
            }
            if (best) {
                const switchedMonster = st.hoveredMonsterId !== best.id || st.hoverKillUntilPerfMs > 0;
                st.hoveredMonsterId = best.id;
                st.isCursorOnHoveredMonster = true;
                st.hoverStickUntilPerfMs = 0;
                if (switchedMonster) st.hoverKillUntilPerfMs = 0;
                updateMonsterHoverCardUI();
            } else if (st.hoveredMonsterId !== null && st.isCursorOnHoveredMonster) {
                st.isCursorOnHoveredMonster = false;
                st.hoverStickUntilPerfMs = (typeof performance !== 'undefined' ? performance.now() : Date.now()) + MONSTER_HOVER_STICK_MS;
                ensureHoverStickyTicker();
                updateMonsterHoverCardUI();
            }
        });

        G.dom.boardStageEl.addEventListener('mouseleave', () => {
            const st = G.state;
            if (st.hoveredMonsterId !== null && st.isCursorOnHoveredMonster) {
                st.isCursorOnHoveredMonster = false;
                st.hoverStickUntilPerfMs = (typeof performance !== 'undefined' ? performance.now() : Date.now()) + MONSTER_HOVER_STICK_MS;
                ensureHoverStickyTicker();
                updateMonsterHoverCardUI();
            }
        });
    }

    if (typeof document !== 'undefined') {
        document.addEventListener('pointerdown', (e) => {
            SoundEngine.ensureContext();
            if (e.pointerType === 'touch') {
                activateTouchMode();
                const tgt = e.target;
                if (tgt && typeof tgt.closest === 'function'
                    && !tgt.closest('#grid-board') && !tgt.closest('#tower-inspector') && !tgt.closest('#evo-confirm-overlay')) {
                    if (G.state.selectedIndex !== null) {
                        G.state.selectedIndex = null;
                        G.state.buildTargetIndex = null;
                        Renderer.renderBoard([]);
                        Renderer.updateRangeIndicator();
                    }
                    clearMonsterHoverLock();
                }
            }
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
            if (st.pendingEvolution) {
                if (key === 'Escape') { e.preventDefault(); cancelPendingEvolution(); return; }
                if ((key === 'Enter' || lowerKey === 'a' || key === '1') && st.pendingEvolution.options[0]) {
                    e.preventDefault();
                    confirmPendingEvolution(st.pendingEvolution.options[0]);
                    return;
                }
                if ((lowerKey === 'd' || key === '2') && st.pendingEvolution.options[1]) {
                    e.preventDefault();
                    confirmPendingEvolution(st.pendingEvolution.options[1]);
                    return;
                }
                return;
            }
            if (key === 'Escape') {
                if (DragSys.isDragging()) { e.preventDefault(); DragSys.cancelActiveDrag(); }
                else if (isCodexOpen()) { e.preventDefault(); CodexSys.closeCodex(); }
                else if (isGuideOpen()) { e.preventDefault(); closeGuide(); }
                else if (st.forecastDrawerOpen) { e.preventDefault(); st.forecastDrawerOpen = false; updateWaveForecastUI(); }
                else if (isMatchPhaseActive() && (st.selectedIndex !== null || st.buildTargetIndex !== null || st.pendingSpawnType !== null || st.inspectedMonsterId !== null)) {
                    e.preventDefault(); st.selectedIndex = null; st.buildTargetIndex = null; st.pendingSpawnType = null; st.inspectedMonsterId = null;
                    Renderer.renderBoard([]); updateHUD();
                    setDomText(G.dom.msgText, '已取消選取與待放置狀態。');
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
            if (lowerKey === 't' && !e.repeat) {
                if (isCodexOpen()) {
                    e.preventDefault();
                    CodexSys.closeCodex();
                    return;
                }
                const blockingOverlay = isOverlayVisible(G.dom.startOverlayEl)
                    || isOverlayVisible(G.dom.blessingOverlayEl)
                    || isOverlayVisible(G.dom.victoryOverlayEl)
                    || isOverlayVisible(G.dom.gameOverOverlayEl);
                if (!blockingOverlay && st.waveState !== 'BLESSING_SELECT' && !st.isGameOver) {
                    e.preventDefault();
                    SoundEngine.ensureContext();
                    CodexSys.openCodex();
                    return;
                }
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
        handleShopCardClick,
        inspectMonsterById,
        onMonsterLeaked,
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

    if (GameApp.i18n) {
        GameApp.i18n.onChange(() => {
            renderSpawnerButtons();
            Renderer.initBoard();
            Renderer.renderBoard();
            renderMapSelectorUI();
            renderContractSelectorUI();
            if (CodexSys && typeof CodexSys.isCodexOpen === 'function' && CodexSys.isCodexOpen()) {
                CodexSys.renderCodexModal();
            }
            updateHUD();
            updateSpeedButtonUI();
            updateSoundButtonUI();
            Renderer.updateRangeIndicator();
        });
        GameApp.i18n.applyLanguage();
    }

    renderSpawnerButtons();
    Renderer.initBoard();
    Renderer.renderBoard();
    renderMapSelectorUI();
    renderContractSelectorUI();
    updateHUD();
    updateSpeedButtonUI();
    updateSoundButtonUI();

    Backend.init({
        onBalanceApplied: () => {
            if (G.state.waveState === 'WAITING_START') {
                const mapSpec = WaveSys.getCurrentMapSpec();
                const treeCfg = (GameApp.data && GameApp.data.tree && GameApp.data.tree.TREE_CONFIG) || {};
                G.state.maxBaseHp = G.state.activeContracts.has('fragile_heart') ? 12 : (treeCfg.INITIAL_BASE_HP || CONFIG.INITIAL_BASE_HP || 20);
                G.state.baseHp = G.state.maxBaseHp;
                G.state.dewEnergy = G.state.activeContracts.has('dew_drought') ? 0 : (treeCfg.DEW_INITIAL || CONFIG.DEW_INITIAL || 20);
                G.state.currentGold = EconSys.getInitialGold(mapSpec, G.state.activeContracts);
            }
            if (GameApp.i18n && typeof GameApp.i18n.applyLanguage === 'function') {
                GameApp.i18n.applyLanguage();
            }
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
        openEvolutionConfirmModal,
        confirmPendingEvolution,
        cancelPendingEvolution,
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
