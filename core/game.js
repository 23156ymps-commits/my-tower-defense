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
        ['inspectorRangeEl', 'inspector-range'], ['inspectorTerrainEl', 'inspector-terrain'], ['inspectorGrowthBadgeEl', 'inspector-growth-badge'],
        ['inspectorInfuseBtn', 'inspector-infuse-btn'], ['inspectorInfuseTextEl', 'inspector-infuse-text'], ['inspectorTargetBtn', 'inspector-target-btn'], ['inspectorSellBtn', 'inspector-sell-btn'],
        ['evoConfirmOverlayEl', 'evo-confirm-overlay'], ['evoConfirmTitleEl', 'evo-confirm-title'],
        ['evoConfirmOptionsEl', 'evo-confirm-options'], ['evoCancelBtn', 'evo-cancel-btn'],
        ['codexBtn', 'codex-btn'], ['codexOverlayEl', 'codex-overlay'], ['codexCloseBtn', 'codex-close-btn'],
        ['blessingOverlayEl', 'blessing-overlay'], ['blessingWaveSubtitleEl', 'blessing-wave-subtitle'], ['blessingChoicesEl', 'blessing-choices'],
        ['skillEntangleBtn', 'skill-entangle-btn'], ['skillFrenzyBtn', 'skill-frenzy-btn'], ['skillHarvestBtn', 'skill-harvest-btn'], ['guildHarvestBtn', 'guild-harvest-btn'], ['blessingRerollBtn', 'blessing-reroll-btn'], ['metaTreeBtn', 'meta-tree-btn'], ['metaTreeOverlayEl', 'meta-tree-overlay'], ['metaTreeHonorBadgeEl', 'meta-tree-honor-badge'], ['metaTreeBranchesEl', 'meta-tree-branches-grid'], ['metaTreeResetBtn', 'meta-tree-reset-btn'], ['metaTreeCloseBtn', 'meta-tree-close-btn'], ['pauseBtn', 'pause-btn'], ['soundBtn', 'sound-btn'], ['langBtn', 'lang-btn'], ['langMenuEl', 'lang-menu'], ['startLangBtn', 'start-lang-btn'], ['startLangMenuEl', 'start-lang-menu'],
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
        ['victoryFeedbackToggle', 'victory-feedback-toggle'], ['victoryFeedbackBox', 'victory-feedback-box'],
        ['gameOverOverlayEl', 'game-over-overlay'], ['gameoverMapTextEl', 'gameover-map-text'], ['finalWaveTextEl', 'final-wave-text'],
        ['finalBestTextEl', 'final-best-text'], ['finalKillsTextEl', 'final-kills-text'], ['gameoverMvpTextEl', 'gameover-mvp-text'],
        ['gameoverGoldEarnedTextEl', 'gameover-gold-earned-text'], ['gameoverFusionTextEl', 'gameover-fusion-text'],
        ['gameoverBreakerRowEl', 'gameover-breaker-row'], ['gameoverBreakerTextEl', 'gameover-breaker-text'],
        ['newRecordBadgeEl', 'new-record-badge'], ['restartBtn', 'restart-btn'], ['gameoverMenuBtn', 'gameover-menu-btn'],
        ['gameoverRatingStatusEl', 'gameover-rating-status'], ['gameoverCopyReportBtn', 'gameover-copy-report-btn'],
        ['gameoverFeedbackToggle', 'gameover-feedback-toggle'], ['gameoverFeedbackBox', 'gameover-feedback-box'],
        ['helpBtn', 'help-btn'], ['guideOverlayEl', 'guide-overlay'], ['guideXBtn', 'guide-x-btn'], ['guideCloseBtn', 'guide-close-btn'], ['guideMenuBtn', 'guide-menu-btn'],
        ['terrainTooltipEl', 'terrain-tooltip'], ['towerTooltipEl', 'tower-tooltip'], ['waveForecastBarEl', 'wave-forecast-bar'],
        ['forecastToggleBtn', 'forecast-toggle-btn'], ['forecastBarTitleEl', 'forecast-bar-title'],
        ['forecastWeakChipsEl', 'forecast-weak-chips'],
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
        ['victoryContractsRowEl', 'victory-contracts-row'], ['gameoverContractsRowEl', 'gameover-contracts-row'],
        ['treeRootPanelEl', 'world-tree-root-panel'], ['treeRootTitleEl', 'tree-root-title'],
        ['treeRootLvBadgeEl', 'tree-root-lv-badge'], ['treeRootRefundBadgeEl', 'tree-root-refund-badge'],
        ['treeRootYieldBadgeEl', 'tree-root-yield-badge'], ['treeRootUpgradeBtn', 'tree-root-upgrade-btn'],
        ['treeRootTiersEl', 'tree-root-tiers'],
        ['guildPanelEl', 'world-tree-guild-panel'], ['guildToggleBtn', 'guild-drawer-toggle-btn'],
        ['guildTitleEl', 'guild-drawer-title'], ['guildChevronEl', 'guild-drawer-chevron'],
        ['guildRootSummaryBadgeEl', 'guild-root-summary-badge'],
        ['guildNonCombatBadgeEl', 'guild-noncombat-cap-badge'], ['guildCritBadgeEl', 'guild-crit-bonus-badge'],
        ['guildHoldTimerBtn', 'guild-hold-timer-btn'], ['guildBodyEl', 'guild-drawer-body'],
        ['guildCloseBtn', 'guild-drawer-close-btn'],
        ['guildTabBtnRoots', 'guild-tab-btn-roots'], ['guildTabBtnStocks', 'guild-tab-btn-stocks'], ['guildTabBtnFate', 'guild-tab-btn-fate'],
        ['guildTabRootsEl', 'guild-tab-roots'], ['guildTabStocksEl', 'guild-tab-stocks'], ['guildTabFateEl', 'guild-tab-fate'],
        ['guildStockSubEl', 'guild-stock-sub'], ['guildStockListEl', 'guild-stock-list'],
        ['stockPriceFireEl', 'stock-price-fire'], ['stockTrendFireEl', 'stock-trend-fire'], ['stockHoldFireEl', 'stock-hold-fire'],
        ['stockPriceIceEl', 'stock-price-ice'], ['stockTrendIceEl', 'stock-trend-ice'], ['stockHoldIceEl', 'stock-hold-ice'],
        ['stockPriceThunderEl', 'stock-price-thunder'], ['stockTrendThunderEl', 'stock-trend-thunder'], ['stockHoldThunderEl', 'stock-hold-thunder'],
        ['guildBoxTitleEl', 'guild-box-title'], ['guildBoxPityEl', 'guild-box-pity'], ['guildBoxDescEl', 'guild-box-desc'],
        ['blindBoxBuyBtn', 'blind-box-buy-btn'], ['fusionFruitSlotBtn', 'fusion-fruit-slot-btn'],
        ['guildWagerTitleEl', 'guild-wager-title'], ['guildWagerSubEl', 'guild-wager-sub'],
        ['wagerZeroLeakBtn', 'wager-zero-leak-btn'], ['wagerZeroTitleEl', 'wager-zero-title'], ['wagerZeroCostEl', 'wager-zero-cost'], ['wagerZeroDescEl', 'wager-zero-desc'],
        ['wagerSurgeBtn', 'wager-surge-btn'], ['wagerSurgeTitleEl', 'wager-surge-title'], ['wagerSurgeLimitEl', 'wager-surge-limit'], ['wagerSurgeDescEl', 'wager-surge-desc']
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
        dom.skillHarvestMask = dom.skillHarvestBtn ? dom.skillHarvestBtn.querySelector('.skill-cd-mask') : null;
        dom.skillHarvestDewBar = dom.skillHarvestBtn ? dom.skillHarvestBtn.querySelector('.skill-dew-bar') : null;
        dom.skillHarvestLabel = dom.skillHarvestBtn ? dom.skillHarvestBtn.querySelector('.skill-label') : null;
        dom.skillHarvestSub = dom.skillHarvestBtn ? dom.skillHarvestBtn.querySelector('.skill-sub') : null;
        dom.guildStockCardEl = typeof document !== 'undefined' ? document.querySelector('.guild-stock-card') : null;
        dom.guildBlindBoxCardEl = typeof document !== 'undefined' ? document.querySelector('.guild-blindbox-card') : null;
        dom.guildWagerCardEl = typeof document !== 'undefined' ? document.querySelector('.guild-wager-card') : null;
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
            rootLevel: 0,
            sellRefundRate: 0.70,
            infusionCount: 0,
            dividendBonus: 0,
            blessingPowerBonus: 0,
            waveNonCombatGold: 0,
            nonCombatLedgerWave: 1,
            lastRootWavePayout: null,
            stocks: EconSys && typeof EconSys.createInitialStockState === 'function'
                ? EconSys.createInitialStockState()
                : {
                    fire: { element: 'fire', price: 20, prevPrice: 20, lastDelta: 0, shares: 0, totalCost: 0, weaknessRatio: 1 / 3, muIntel: 0, trend: 'neutral' },
                    ice: { element: 'ice', price: 20, prevPrice: 20, lastDelta: 0, shares: 0, totalCost: 0, weaknessRatio: 1 / 3, muIntel: 0, trend: 'neutral' },
                    thunder: { element: 'thunder', price: 20, prevPrice: 20, lastDelta: 0, shares: 0, totalCost: 0, weaknessRatio: 1 / 3, muIntel: 0, trend: 'neutral' }
                },
            blindBox1StarStreak: 0,
            teamCritBonusRate: 0,
            fusionFruitCount: 0,
            isApplyingFusionFruit: false,
            activeWager: null,
            surgeWagerUsedCount: 0,
            waveLeakedCount: 0,
            lastWagerSettlement: null,
            guildDrawerOpen: false,
            guildActiveTab: 'roots',
            guildAutoHoldTimer: false,
            guildTimerHold: false,
            blindBoxTokens: 0,
            blessingRerollsLeft: (TreeSys && typeof TreeSys.isMetaNodeUnlocked === 'function' && TreeSys.isMetaNodeUnlocked('fate_4')) ? 1 : 0,
            entangleCdMs: 0, frenzyCdMs: 0, frenzyActiveMs: 0, harvestCdMs: 0, dewOverchargeMs: 0,
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
            groundHazards: [], dragTether: null, pendingEvolution: null, pendingBlessingWave: null,
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
            || isOverlayVisible(dom.evoConfirmOverlayEl)
            || Boolean(st.pendingEvolution)
            || isOverlayVisible(dom.blessingOverlayEl)
            || isOverlayVisible(dom.metaTreeOverlayEl)
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
        return !st.isGameOver && !st.isPaused && st.waveState !== 'WAITING_START' && st.waveState !== 'VICTORY' && st.waveState !== 'BLESSING_SELECT' && !isCodexOpen() && !isGuideOpen() && !isOverlayVisible(G.dom.evoConfirmOverlayEl) && !st.pendingEvolution;
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
        updateMetaTreeEntryUI();
    }

    function updateMetaTreeEntryUI() {
        const metaState = Backend && typeof Backend.loadMetaTreeState === 'function'
            ? Backend.loadMetaTreeState()
            : { honorPoints: 0, totalHonorEarned: 0, unlockedNodes: [] };
        const pts = Math.max(0, Math.round(Number(metaState.honorPoints) || 0));
        const cnt = Array.isArray(metaState.unlockedNodes) ? metaState.unlockedNodes.length : 0;
        if (G.dom.metaTreeBtn) {
            G.dom.metaTreeBtn.innerText = L(
                `世界樹年輪 (${cnt}/12) · 榮譽 ${pts} ★`,
                `Meta Rings (${cnt}/12) · ${pts} ★`
            );
        }
        if (G.dom.metaTreeHonorBadgeEl) {
            G.dom.metaTreeHonorBadgeEl.innerText = L(
                `可用榮譽 ${pts} ★`,
                `Honor ${pts} ★`
            );
        }
    }

    function renderMetaTreeModal() {
        updateMetaTreeEntryUI();
        if (!G.dom.metaTreeBranchesEl) return;
        const treeData = (GameApp.data && GameApp.data.tree) || {};
        const branches = Array.isArray(treeData.META_TREE_BRANCHES) ? treeData.META_TREE_BRANCHES : [];
        const nodesMap = treeData.META_TREE_NODES || {};
        const metaState = Backend && typeof Backend.loadMetaTreeState === 'function'
            ? Backend.loadMetaTreeState()
            : { honorPoints: 0, unlockedNodes: [] };
        const unlocked = new Set(metaState.unlockedNodes || []);

        G.dom.metaTreeBranchesEl.innerHTML = '';
        branches.forEach((branch) => {
            const col = document.createElement('div');
            col.className = 'meta-branch-col';
            const bTitle = L(branch.name, branch.nameEn || branch.name);
            const bSub = L(branch.desc, branch.descEn || branch.desc);
            col.innerHTML = `<div class="meta-branch-head"><span class="meta-branch-title">${bTitle}</span><span class="meta-branch-sub">${bSub}</span></div>`;
            const branchNodes = Object.keys(nodesMap)
                .map(k => nodesMap[k])
                .filter(n => n && n.branch === branch.id)
                .sort((a, b) => (a.tier || 0) - (b.tier || 0));
            branchNodes.forEach((node) => {
                const isUnlocked = unlocked.has(node.id);
                const reqMet = !node.requires || unlocked.has(node.requires);
                const canAfford = (metaState.honorPoints || 0) >= (node.cost || 0);
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.dataset.nodeId = node.id;
                btn.className = `meta-node-btn ${isUnlocked ? 'is-unlocked' : (reqMet ? 'is-next' : 'is-locked')}`;
                btn.disabled = isUnlocked || !reqMet || !canAfford;
                const costText = isUnlocked ? L('已解鎖', 'Unlocked') : `${node.cost} ★`;
                const nName = L(node.name, node.nameEn || node.name);
                const nDesc = L(node.desc, node.descEn || node.desc);
                btn.innerHTML = `<div class="meta-node-head"><span class="meta-node-name">${nName}</span><span class="meta-node-cost num">${costText}</span></div><div class="meta-node-desc num">${nDesc}</div>`;
                col.appendChild(btn);
            });
            G.dom.metaTreeBranchesEl.appendChild(col);
        });

        if (G.dom.metaTreeResetBtn) {
            G.dom.metaTreeResetBtn.disabled = unlocked.size === 0;
        }
    }

    function openMetaTreeModal() {
        SoundEngine.ensureContext();
        renderMetaTreeModal();
        if (G.dom.metaTreeOverlayEl) G.dom.metaTreeOverlayEl.classList.remove('hidden');
    }

    function closeMetaTreeModal() {
        if (G.dom.metaTreeOverlayEl) G.dom.metaTreeOverlayEl.classList.add('hidden');
        updateMetaTreeEntryUI();
    }

    function handleResetMetaTree() {
        SoundEngine.ensureContext();
        if (Backend && typeof Backend.resetMetaTreeNodes === 'function') {
            Backend.resetMetaTreeNodes();
            SoundEngine.playMagic('blessing');
            renderMetaTreeModal();
            updateHUD();
        }
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
        const bonusNote = mapSpec.startGoldBonus > 0 ? L(`（起始 💰 +${mapSpec.startGoldBonus}，擊殺 💰 +${Math.round((mapSpec.killGoldMult - 1) * 100)}%）`, ` (Start 💰 +${mapSpec.startGoldBonus}, Kill 💰 +${Math.round((mapSpec.killGoldMult - 1) * 100)}%)`) : '';
        setStatusMsg(
            `已切換戰場【${mapSpec.name}】${bonusNote}，點擊「開始防守」開啟戰局。`,
            `Switched to ${mapSpec.name}${bonusNote}. Click "Start Defense" to begin.`
        );
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
                isCrowned: Boolean(bestBoardTower.isCrowned),
                name: cfg ? cfg.name : bestBoardTower.type,
                icon: cfg ? cfg.icon : '',
                totalDamage: bestBoardTower.totalDamage
            };
        } else if (st.peakTowerSnapshot && st.peakTowerSnapshot.totalDamage > 0) {
            mvp = st.peakTowerSnapshot;
        }
        if (!mvp || mvp.totalDamage <= 0) return { mvp: null, pct: 0, text: L('尚無輸出紀錄', 'No damage dealt yet') };
        const pct = st.totalTeamDamage > 0 ? Math.round((mvp.totalDamage / st.totalTeamDamage) * 100) : 0;
        const liveCfg = towersDict[mvp.type] || {};
        const mvpName = liveCfg.name || mvp.name;
        let tierBadge = Renderer.getTierStars(mvp.tier);
        if (mvp.tier >= 5) {
            tierBadge = L('5★ 神裔', '5★ Scion');
        } else if (mvp.tier === 4) {
            const bCode = String(mvp.type || '').endsWith('_twin_AB') ? 'AB' : (String(mvp.type || '').endsWith('_crown_A') ? 'A' : 'B');
            tierBadge = `4★ ${bCode}`;
        }
        const text = `${mvp.icon ? mvp.icon + ' ' : ''}${mvpName} ${tierBadge} — ${mvp.totalDamage.toLocaleString()} ${L('傷害', 'DMG')} (${pct}%)`;
        return { mvp, pct, text };
    }

    function getMvpSummaryText() {
        return getMvpData().text;
    }

    function setDomText(el, txt) { if (el) el.innerText = txt; }

    function setStatusMsg(zhText, enText) {
        if (!G || !G.state) return;
        const textPair = {
            zh: zhText,
            en: enText !== undefined ? enText : zhText
        };
        G.state.lastStatusMsgPair = textPair;
        if (G.dom && G.dom.msgText) {
            G.dom.msgText.innerText = L(textPair.zh, textPair.en);
        }
    }

    function resetFeedbackUI() {
        document.querySelectorAll('.feel-rating-btn').forEach(btn => btn.classList.remove('selected'));
        [G.dom.victoryRatingStatusEl, G.dom.gameoverRatingStatusEl].forEach((el) => {
            if (!el) return;
            delete el.dataset.rated;
            el.innerText = L('點擊上方標籤一鍵回饋本局體感', 'Tap a tag above to submit instant feedback');
        });
        [
            [G.dom.victoryFeedbackToggle, G.dom.victoryFeedbackBox],
            [G.dom.gameoverFeedbackToggle, G.dom.gameoverFeedbackBox]
        ].forEach(([btn, box]) => {
            if (box) box.classList.add('hidden');
            if (btn) btn.setAttribute('aria-expanded', 'false');
        });
        if (G.dom.victoryCopyReportBtn) G.dom.victoryCopyReportBtn.innerText = L('複製本局數據戰報', 'Copy Battle Report');
        if (G.dom.gameoverCopyReportBtn) G.dom.gameoverCopyReportBtn.innerText = L('複製本局數據戰報', 'Copy Battle Report');
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
        const { text: mvpText } = getMvpData();
        const treeCfg = (GameApp.data && GameApp.data.tree && GameApp.data.tree.TREE_CONFIG) || {};
        const maxHp = st.maxBaseHp || treeCfg.INITIAL_BASE_HP || CONFIG.INITIAL_BASE_HP || 20;
        const honor = computeRunHonorSummary(st);
        const career = Backend.loadCareerStats ? Backend.loadCareerStats() : { totalClears: 0 };

        resetFeedbackUI();

        const contractSummaryHtml = honor.count > 0
            ? L(`榮譽積分 ${honor.honorScore.toLocaleString()}（+${honor.bonusPct}% 契約）· ${honor.names.join('、')}`, `Honor ${honor.honorScore.toLocaleString()} (+${honor.bonusPct}% Contracts) · ${honor.names.join(', ')}`)
            : L(`榮譽積分 ${honor.honorScore.toLocaleString()} · 累計通關 ${career.totalClears || 0} 次`, `Honor ${honor.honorScore.toLocaleString()} · Total Clears ${career.totalClears || 0}`);

        if (mode === 'victory') {
            setDomText(dom.victoryMapTextEl, mapSpec.name);
            setDomText(dom.victoryKillsTextEl, L(`${st.killsCount} 隻`, `${st.killsCount}`));
            setDomText(dom.victoryHpTextEl, `${st.baseHp} / ${maxHp}`);
            setDomText(dom.victoryGoldTextEl, `${st.currentGold} 💰`);
            setDomText(dom.victoryMvpTextEl, mvpText);
            setDomText(dom.victoryGoldEarnedTextEl, `${st.totalGoldEarned.toLocaleString()} 💰`);
            setDomText(dom.victoryFusionTextEl, L(`${st.fusionCount} 次`, `${st.fusionCount}`));
            if (dom.victoryContractsRowEl) {
                dom.victoryContractsRowEl.classList.remove('hidden');
                dom.victoryContractsRowEl.innerText = contractSummaryHtml;
            }
            return;
        }
        setDomText(dom.gameoverMapTextEl, mapSpec.name);
        setDomText(dom.finalWaveTextEl, st.isEndlessMode ? `Wave ${st.currentWave} (${L('無盡', 'Endless')})` : `Wave ${st.currentWave} / ${CONFIG.VICTORY_WAVE || 10}`);
        setDomText(dom.finalBestTextEl, `Wave ${st.bestWave}`);
        setDomText(dom.finalKillsTextEl, L(`${st.killsCount} 隻`, `${st.killsCount}`));
        setDomText(dom.gameoverMvpTextEl, mvpText);
        setDomText(dom.gameoverGoldEarnedTextEl, `${st.totalGoldEarned.toLocaleString()} 💰`);
        setDomText(dom.gameoverFusionTextEl, L(`${st.fusionCount} 次`, `${st.fusionCount}`));
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
    function getWeaknessShortName(weakKey) {
        if (GameApp.i18n && typeof GameApp.i18n.getWeaknessLabel === 'function') {
            return GameApp.i18n.getWeaknessLabel(weakKey);
        }
        const map = { fire: L('火', 'Fire'), ice: L('冰', 'Ice'), thunder: L('雷', 'Thunder') };
        return map[weakKey] || weakKey || L('無', 'None');
    }

    function formatMonsterInspectText(m) {
        if (!m) return '';
        const MonsterSys = GameApp.systems && GameApp.systems.monster;
        const towersDict = getTowersDict();
        const weakCfg = towersDict[m.weakness];
        const weakStr = weakCfg ? `${weakCfg.icon}${getWeaknessShortName(m.weakness)}` : getWeaknessShortName(m.weakness);
        const effArmor = Math.round(MonsterSys ? MonsterSys.getMonsterEffectiveArmor(m) : (m.armor || 0));
        const armorStr = m.armorShredTimer > 0 ? `🔥 ${effArmor}/${m.armor}` : `${effArmor}`;
        const status = [];
        if ((m.rootTimer || 0) > 0) status.push(`${L('纏繞', 'Root')} ${(m.rootTimer / 1000).toFixed(1)}s`);
        if (m.slowTimer > 0) status.push(`${L('緩速', 'Slow')} ${Math.round((m.slowRate || 0) * 100)}%`);
        if (m.armorShredTimer > 0) status.push(`${L('破甲', 'Shred')} ${Math.round((m.armorShredRate || 0.3) * 100)}%`);
        const sep = L('｜', ' | ');
        return `${m.icon || '👾'} ${m.name}${sep}HP ${m.hp}/${m.maxHp}${sep}${L('護甲', 'ARM')} ${armorStr}${sep}${L('弱點', 'Weak')} ${weakStr}${status.length ? `${sep}${status.join(' · ')}` : ''}`;
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
        if (st.isTouchMode) {
            lockTouchMonsterInspect(m);
            updateHUD();
            return true;
        }
        st.selectedIndex = null;
        st.buildTargetIndex = null;
        st.hoveredIndex = null;
        st.pendingSpawnType = null;
        st.inspectedMonsterId = m.id;
        const summary = formatMonsterInspectText(m);
        setDomText(G.dom.msgText, summary);
        Renderer.renderBoard([]);
        Renderer.updateRangeIndicator();
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
        if (m.isStealthed) list.push(`${L('隱身', 'Stealth')} (${((m.stealthTimerMs || 0) / 1000).toFixed(1)}s)`);
        const shellLeft = m.shellHitsLeft || m.hardShellHitsLeft || 0;
        if (shellLeft > 0) list.push(`${L('甲殼減傷', 'Shell')} ×${shellLeft}`);
        if ((m.rootTimer || 0) > 0) list.push(`${L('定身', 'Root')} ${(m.rootTimer / 1000).toFixed(1)}s`);
        if (MonsterSys && MonsterSys.isMonsterFrozen(m)) list.push(L('凍結', 'Frozen'));
        else if (MonsterSys && MonsterSys.isMonsterSlowed(m)) {
            const effSlow = Math.round(MonsterSys.getMonsterEffectiveSlowRate(m) * 100);
            list.push(`${L('緩速', 'Slow')} ${effSlow}%`);
        }
        if (st.burn && st.burn.stacks > 0 && st.burn.durationMs > 0) list.push(`${L('灼燒', 'Burn')} ${st.burn.stacks}${L('層', 'stk')}`);
        if (st.shock && st.shock.durationMs > 0) list.push(L('感電', 'Shock'));
        if (st.grievousWound && st.grievousWound.durationMs > 0) list.push(L('重傷 -50%治療', 'Wound -50% Heal'));
        if ((m.armorShredTimer || 0) > 0) list.push(`${L('破甲', 'Shred')} ${Math.round((m.armorShredRate || 0.3) * 100)}%`);
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
            if (st.isTouchMode) {
                clearMonsterHoverLock();
                return;
            }
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
        const weakStr = weakCfg ? `${weakCfg.icon}${getWeaknessShortName(m.weakness)}` : getWeaknessShortName(m.weakness);
        const armorStr = m.armorShredTimer > 0 ? `${m.effArmor}/${m.armor}` : `${m.effArmor}`;
        const tierBadge = m.isBoss ? 'Boss' : (m.isElite ? L('菁英', 'Elite') : L('敵軍', 'Foe'));
        const traitText = m.traitDesc || mCfg.traitDesc || (m.isBoss ? L('階段首領 · 留意頭像旁弱點屬性', 'Stage Boss · Check weakness icon') : L('沿路徑前進攻擊世界樹', 'Marches toward the World Tree'));

        if (dom.sideMonsterCardEl) {
            dom.sideMonsterCardEl.classList.remove('hidden');
            dom.sideMonsterCardEl.classList.toggle('is-killed', isKilledDisplay);
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
            const shieldBit = (m.shield || 0) > 0 ? ` · ${L('盾', 'Shd')} ${m.shield}` : '';
            const debuffs = m.debuffs || [];
            const debuffBit = (!isKilledDisplay && debuffs.length > 0) ? ` [${debuffs.slice(0, 2).join('/')}]` : '';
            const hpLabel = isKilledDisplay ? L('已擊殺', 'Slain') : `HP ${m.hp}/${m.maxHp}`;
            const barWidth = `${Math.max(0, Math.min(100, lockRatio * 100)).toFixed(1)}%`;
            dom.mobileMonsterCardEl.innerHTML = `<div class="mmc-top num"><span>${m.name} · ${hpLabel}${shieldBit} · ${L('甲', 'ARM')} ${armorStr} · ${L('弱', 'Weak')} ${weakStr}</span><span class="mmc-lock-tag">${lockHintText}</span></div><div class="mmc-sub">${traitText}${debuffBit}</div><div class="mmc-lock-track"><div class="mmc-lock-fill${isKilledDisplay ? ' is-killed' : ''}" style="width:${barWidth}"></div></div>`;
        }
    }

    function getTerrainShortTagForCell(index, tInfo, damageMultOverride = null) {
        if (!tInfo || !tInfo.shortTag) return '';
        if (tInfo.id === 'world_tree') {
            const mult = Number.isFinite(damageMultOverride)
                ? damageMultOverride
                : (TerrainSys && index !== null && index !== undefined ? TerrainSys.getTerrainBonusesAt(index).damageMult : 1.0);
            const bonusPct = Math.max(0, Math.round((mult - 1) * 100));
            return L(`🌿 庇護傷 +${bonusPct}%`, `🌿 Sanctuary +${bonusPct}%`);
        }
        const rawTag = String(tInfo.shortTag || '');
        if (tInfo.icon && !rawTag.startsWith(tInfo.icon)) {
            return `${tInfo.icon} ${rawTag}`;
        }
        return rawTag;
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
        const starsStr = Renderer.getTierStars(towerObj.tier);
        const tierSubTag = towerObj.tier >= 5
            ? L('神裔', 'Scion')
            : (cfg.isTwinCrown ? L('雙生 AB', 'Twin AB') : (towerObj.tier === 4 ? L('極意', 'Mastery') : ''));
        setDomText(dom.inspectorNameEl, `${cfg.icon} ${cfg.name} ${starsStr}${tierSubTag ? ` · ${tierSubTag}` : ''}`);
        if (dom.inspectorLineageEl) {
            const lineageText = EvoSys && typeof EvoSys.getTowerLineagePathText === 'function'
                ? EvoSys.getTowerLineagePathText(towerObj)
                : (cfg.lineagePath || `${cfg.icon} ${cfg.name}`);
            setDomText(dom.inspectorLineageEl, `${L('血脈：', 'Lineage: ')}${lineageText}`);
        }
        const isBeamStyle = cfg.attackStyle === 'pierce_beam' || cfg.attackStyle === 'plasma_A_deathray' || cfg.attackStyle === 'plasma_B_refract' || cfg.attackStyle === 'plasma_twin';
        setDomText(dom.inspectorDpsEl, `${L('單體 DPS', 'Single DPS')} ${stats.dps}${isBeamStyle ? (towerObj.focusStacks > 0 ? L(`(${towerObj.focusStacks}層)`, `(${towerObj.focusStacks}stk)`) : L('(蓄能)', '(Charging)')) : ''}`);
        if (dom.inspectorAoeDpsEl) {
            const hasAoe = Number.isFinite(stats.aoeDps) && stats.aoeDps > 0 && Boolean(stats.aoeLabel);
            dom.inspectorAoeDpsEl.classList.toggle('hidden', !hasAoe);
            if (hasAoe) setDomText(dom.inspectorAoeDpsEl, `${stats.aoeLabel} ${stats.aoeDps}`);
        }
        if (dom.inspectorTotalDmgEl) {
            setDomText(dom.inspectorTotalDmgEl, `${L('累計傷害', 'Total Dmg')} ${Math.round(towerObj.totalDamage || 0).toLocaleString()}`);
        }
        setDomText(dom.inspectorRangeEl, `${L('射程', 'Rng')} ${stats.rangeStr}`);
        if (dom.inspectorTerrainEl) {
            const terrainTag = getTerrainShortTagForCell(st.selectedIndex, tInfo, stats.damageMult);
            const auraSuffix = stats.hasScionAura ? L('神裔光環 +16% 速', 'Scion Aura +16% Spd') : '';
            const combinedTag = [terrainTag, auraSuffix].filter(Boolean).join(' · ');
            dom.inspectorTerrainEl.classList.toggle('hidden', !combinedTag);
            dom.inspectorTerrainEl.innerText = combinedTag;
        }
        if (dom.inspectorGrowthBadgeEl) {
            const curU = (EvoSys && typeof EvoSys.getTowerNutritionU === 'function')
                ? EvoSys.getTowerNutritionU(towerObj)
                : (Number(towerObj.nutritionU) || 1);
            const nextU = (EvoSys && typeof EvoSys.getNextStarTargetU === 'function')
                ? EvoSys.getNextStarTargetU(towerObj.tier)
                : null;
            const showGrowth = (towerObj.tier === 3 || towerObj.tier === 4) && Boolean(nextU);
            const showInfused = towerObj.tier >= 5 && (towerObj.infusionCount || 0) > 0;
            dom.inspectorGrowthBadgeEl.classList.toggle('hidden', !showGrowth && !showInfused);
            if (showGrowth) {
                dom.inspectorGrowthBadgeEl.innerText = L(
                    `充能 ${curU}/${nextU} U · 基礎 ${stats.baseDmg || ''}`,
                    `Feed ${curU}/${nextU} U · Base ${stats.baseDmg || ''}`
                );
            } else if (showInfused) {
                const infPct = Math.round((AttackSys.b_infusion ? AttackSys.b_infusion(towerObj.infusionCount) : 0) * 100);
                dom.inspectorGrowthBadgeEl.innerText = L(
                    `靈脈灌注 +${towerObj.infusionCount} (+${infPct}%)`,
                    `Infused +${towerObj.infusionCount} (+${infPct}%)`
                );
            }
        }
        if (dom.inspectorInfuseBtn) {
            const isScion = towerObj.tier >= 5;
            const infuseUnlocked = !TreeSys || typeof TreeSys.isMetaNodeUnlocked !== 'function' || TreeSys.isMetaNodeUnlocked('ancient_1');
            dom.inspectorInfuseBtn.classList.toggle('hidden', !isScion);
            if (isScion) {
                const curK = Math.max(0, Math.floor(Number(towerObj.infusionCount) || 0));
                const nextK = curK + 1;
                const cost = EconSys.getInfusionCost ? EconSys.getInfusionCost(nextK) : (150 + 75 * nextK);
                const stepPct = nextK <= 5 ? 12 : 7;
                const canAfford = st.currentGold >= cost;
                const labelEl = dom.inspectorInfuseTextEl || dom.inspectorInfuseBtn;
                if (!infuseUnlocked) {
                    labelEl.innerText = L('靈脈灌注（需年輪古樹 ①）', 'Vein Infuse (Need Ancient #1)');
                    dom.inspectorInfuseBtn.disabled = true;
                } else {
                    labelEl.innerText = L(
                        `靈脈灌注 #${nextK} (${cost} 💰 · +${stepPct}%)`,
                        `Vein Infuse #${nextK} (${cost} 💰 · +${stepPct}%)`
                    );
                    dom.inspectorInfuseBtn.disabled = !isGameplayActive() || !canAfford;
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
        const weakCfg = getTowersDict()[boss.weakness], weakShort = weakCfg ? `${weakCfg.icon}${getWeaknessShortName(boss.weakness)}` : getWeaknessShortName(boss.weakness);
        const armorLabel = boss.armorShredTimer > 0 ? `🔥 ${Math.round(MonsterSys.getMonsterEffectiveArmor(boss))}/${boss.armor}` : `${L('甲', 'ARM')} ${boss.armor}`;
        dom.bossStatusBarEl.classList.remove('hidden', 'weak-fire', 'weak-ice', 'weak-thunder');
        if (weakCfg) dom.bossStatusBarEl.classList.add(`weak-${boss.weakness}`);
        const bossSep = L('｜', ' | ');
        setDomText(dom.bossBannerTitleEl, `${boss.name}${bossSep}${L('弱', 'Weak')} ${weakShort}${bossSep}${armorLabel}`);
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
        if (dom.skillEntangleBtn || dom.skillFrenzyBtn || dom.skillHarvestBtn) {
            const ent = skills.entangle || { cost: 40, cdMs: 8000, name: L('根鬚纏繞', 'Root Entangle'), hotkey: 'Q' };
            const frz = skills.frenzy || { cost: 60, cdMs: 12000, name: L('自然狂熱', 'Nature Frenzy'), hotkey: 'W' };
            const hrv = skills.golden_harvest || { cost: 50, cdMs: 14000, name: L('黃金豐收', 'Golden Harvest'), hotkey: 'E' };

            setDomText(dom.dewDisplay, `${st.dewEnergy}/${dewMax}`);
            if (dom.dewBarFillEl) dom.dewBarFillEl.style.width = `${Math.max(0, Math.min(100, (st.dewEnergy / dewMax) * 100))}%`;
            updateSkillBtnVisual(dom.skillEntangleBtn, dom.skillEntangleMask, dom.skillEntangleDewBar, dom.skillEntangleLabel, dom.skillEntangleSub, st.entangleCdMs, ent.cdMs, 0, ent.cost, ent.name, ent.hotkey, null);
            updateSkillBtnVisual(dom.skillFrenzyBtn, dom.skillFrenzyMask, dom.skillFrenzyDewBar, dom.skillFrenzyLabel, dom.skillFrenzySub, st.frenzyCdMs, frz.cdMs, st.frenzyActiveMs, frz.cost, frz.name, frz.hotkey, L('狂熱中', 'Active'));
            updateSkillBtnVisual(dom.skillHarvestBtn, dom.skillHarvestMask, dom.skillHarvestDewBar, dom.skillHarvestLabel, dom.skillHarvestSub, st.harvestCdMs || 0, hrv.cdMs, 0, hrv.cost, hrv.name, hrv.hotkey, null);

            if (dom.guildHarvestBtn) {
                const hCd = st.harvestCdMs || 0;
                const hMissing = Math.max(0, hrv.cost - st.dewEnergy);
                if (hCd > 0) {
                    dom.guildHarvestBtn.innerText = `${hrv.name} (${L('冷卻', 'CD')} ${(hCd / 1000).toFixed(1)}s)`;
                } else if (hMissing > 0) {
                    dom.guildHarvestBtn.innerText = `${hrv.name} (${L(`還差 ${hMissing} 💧`, `Need ${hMissing} 💧`)})`;
                } else {
                    dom.guildHarvestBtn.innerText = `${hrv.name} (${hrv.cost} ${L('靈露', 'Dew')}) [${hrv.hotkey}]`;
                }
                dom.guildHarvestBtn.disabled = !isGameplayActive() || hCd > 0 || hMissing > 0;
            }
        }
    }

    const WAVE_STATE_TEXT = {
        WAITING_START: () => L('等待開始', 'Standby'), BLESSING_SELECT: () => L('賜福選擇', 'Blessing'),
        PREP: st => st.guildTimerHold ? L('備戰暫護', 'Prep Hold') : `${L('備戰', 'Prep')} ${Math.max(1, Math.ceil(st.waveTimerMs / 1000))}s`,
        INTERMISSION: st => st.guildTimerHold ? L('波間整備', 'Guild Hold') : `${L('下波', 'Next')} ${Math.max(1, Math.ceil(st.waveTimerMs / 1000))}s`,
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
            const labelText = canSkip
                ? (st.waveState === 'PREP' ? L('立即開波', 'Start Wave') : L('提前下波', 'Next Wave'))
                : L('立即開波', 'Start Wave');
            const labelEl = dom.nextWaveBtn.querySelector('#next-wave-label');
            const bonusEl = dom.nextWaveBtn.querySelector('#next-wave-bonus');
            if (labelEl && bonusEl) {
                labelEl.innerText = labelText;
                if (canSkip) {
                    bonusEl.classList.remove('hidden');
                    bonusEl.innerText = `(+${EconSys.getEarlyWaveBonus()} 💰)`;
                } else {
                    bonusEl.classList.add('hidden');
                    bonusEl.innerText = '';
                }
            } else {
                dom.nextWaveBtn.innerText = canSkip ? `${labelText} (+${EconSys.getEarlyWaveBonus()} 💰)` : labelText;
            }
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
                    ? L(
                        `✨ 豐饒種子已充能（${G.state.seedPityCount}/${seedInterval}）：下次召喚必出 ★★！`,
                        `✨ Abundant Seed Ready (${G.state.seedPityCount}/${seedInterval}): Next summon sprouts ★★!`
                    )
                    : L(
                        `豐饒種子保底進度：${G.state.seedPityCount}/${seedInterval}`,
                        `Abundant Seed Pity: ${G.state.seedPityCount}/${seedInterval}`
                    );
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
            parts.push(`${mCfg.name} ×${cnt}${wCfg ? ` (${L('弱', 'Weak: ')}${getWeaknessShortName(mCfg.weakness)})` : ''}`);
        });
        if (plan.bossMeta) {
            const bWeak = towersDict[plan.bossMeta.weakness];
            parts.push(`${L('王', 'Boss')} · ${plan.bossMeta.name}${bWeak ? ` (${L('弱', 'Weak: ')}${getWeaknessShortName(plan.bossMeta.weakness)})` : ''}`);
        } else if (plan.eliteCount > 0) {
            parts.push(`${L('菁英', 'Elite')} ×${plan.eliteCount}`);
        }
        const crisisPrefix = plan.crisisSpec ? `[⚠️ ${L(plan.crisisSpec.title, plan.crisisSpec.titleEn)}] ` : '';
        const thiefNote = plan.hasThief ? ` · ${L('含靈脈竊賊', 'Includes Thief')}` : '';
        return crisisPrefix + parts.join(' · ') + thiefNote;
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
        const crisisSuffix = plan.crisisSpec ? ` · ⚠️ ${L(plan.crisisSpec.title, plan.crisisSpec.titleEn)}` : '';
        headerEl.innerText = `${prefixLabel} · Wave ${waveNum}${crisisSuffix}`;
        const counts = new Map();
        let normalTotal = 0;
        for (let i = 0; i < plan.queue.length; i++) {
            const q = plan.queue[i];
            if (q.isBoss) continue;
            normalTotal++;
            counts.set(q.typeKey, (counts.get(q.typeKey) || 0) + 1);
        }
        const items = [];
        if (plan.crisisSpec) {
            items.push(`<li class="forecast-crisis-item">⚠️ ${L(plan.crisisSpec.title, plan.crisisSpec.titleEn)}：${L(plan.crisisSpec.hintZh, plan.crisisSpec.hintEn)}</li>`);
        }
        counts.forEach((cnt, key) => {
            const mCfg = monsterDb[key];
            if (!mCfg) return;
            const wCfg = towersDict[mCfg.weakness];
            const weakTag = wCfg ? `${L('弱 ', 'Weak: ')}${getWeaknessShortName(mCfg.weakness)}` : '';
            items.push(`<li class="forecast-item"><span>${mCfg.name} <span class="num">×${cnt}</span></span><span class="forecast-weak weak-${mCfg.weakness}">${weakTag}</span></li>`);
        });
        if (plan.eliteCount > 0) {
            items.push(`<li class="forecast-meta num">${L(`含 ${plan.eliteCount} 隻護甲菁英（甲 ${plan.eliteArmor}）`, `Includes ${plan.eliteCount} ${plan.eliteCount === 1 ? 'Armored Elite' : 'Armored Elites'} (ARM ${plan.eliteArmor})`)}</li>`);
        }
        if (plan.bossMeta) {
            const bWeak = towersDict[plan.bossMeta.weakness];
            const bWeakStr = bWeak ? `${L('弱 ', 'Weak: ')}${getWeaknessShortName(plan.bossMeta.weakness)}` : '';
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
            const peekCrisis = (WaveSys && typeof WaveSys.getCrisisWaveSpec === 'function')
                ? (WaveSys.getCrisisWaveSpec(targetWave) || WaveSys.getCrisisWaveSpec(targetWave + 1))
                : null;
            const crisisTag = peekCrisis
                ? (peekCrisis.wave === targetWave
                    ? ` · ⚠️ ${L(peekCrisis.title, peekCrisis.titleEn)}`
                    : ` · ⚠️ W${peekCrisis.wave} ${L(peekCrisis.title, peekCrisis.titleEn)}`)
                : '';
            dom.forecastBarTitleEl.innerText = isPrepPhase
                ? `${nextLabel} · W${targetWave}${crisisTag}`
                : `${L('情報', 'Intel')} · W${curWave}${crisisTag}`;
        }
        if (dom.forecastWeakChipsEl) {
            if (isFinalClear && !isPrepPhase) {
                dom.forecastWeakChipsEl.innerText = L('最終決戰', 'Final Wave');
            } else {
                const ratioWave = isPrepPhase ? targetWave : nextWave;
                const ratios = (EconSys && typeof EconSys.getWaveElementWeaknessRatios === 'function')
                    ? EconSys.getWaveElementWeaknessRatios(ratioWave)
                    : { fire: 1 / 3, ice: 1 / 3, thunder: 1 / 3 };
                const rPlan = WaveSys.buildWaveQueue(ratioWave);
                const fPct = Math.round((ratios.fire || 0) * 100);
                const iPct = Math.round((ratios.ice || 0) * 100);
                const tPct = Math.round((ratios.thunder || 0) * 100);
                const totalCnt = (rPlan && Array.isArray(rPlan.queue)) ? rPlan.queue.length : 0;
                dom.forecastWeakChipsEl.innerText = `🔥${fPct}% · ❄️${iPct}% · ⚡${tPct}% · ${L(`共 ${totalCnt} 隻`, `${totalCnt} Foes`)}`;
            }
        }
        if (dom.forecastInlineSummaryEl) {
            if (isPrepPhase) {
                const plan = WaveSys.buildWaveQueue(targetWave);
                dom.forecastInlineSummaryEl.innerText = summarizePlanInline(plan);
            } else {
                const nextPlan = !isFinalClear ? WaveSys.buildWaveQueue(nextWave) : null;
                dom.forecastInlineSummaryEl.innerText = nextPlan
                    ? `${L('下波', 'Next')} W${nextWave}${L('：', ': ')}${summarizePlanInline(nextPlan)}`
                    : L('最終魔王決戰進行中', 'Final Boss Battle in Progress');
            }
        }
        if (dom.waveForecastBarEl) {
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

    function formatCompactGold(amount) {
        const val = Math.max(0, Math.floor(Number(amount) || 0));
        if (val >= 10000) {
            return `${(val / 1000).toFixed(1).replace(/\.0$/, '')}k`;
        }
        return String(val);
    }

    function updateTreasureRootUI() {
        const dom = G.dom, st = G.state;
        if (!dom.treeRootPanelEl) return;

        const rootsUnlocked = !TreeSys || typeof TreeSys.isMetaNodeUnlocked !== 'function' || TreeSys.isMetaNodeUnlocked('wealth_1');
        dom.treeRootPanelEl.classList.toggle('is-meta-locked', !rootsUnlocked);
        const rootLv = TreeSys && typeof TreeSys.getTreasureRootLevel === 'function' ? TreeSys.getTreasureRootLevel() : (st.rootLevel || 0);
        const curSpec = TreeSys && typeof TreeSys.getTreasureRootSpec === 'function'
            ? TreeSys.getTreasureRootSpec(rootLv)
            : { level: rootLv, name: '未啟用', nameEn: 'Dormant', sellRefundRate: rootLv >= 2 ? 0.80 : 0.70 };
        const nextSpec = TreeSys && typeof TreeSys.getNextTreasureRootSpec === 'function'
            ? TreeSys.getNextTreasureRootSpec()
            : null;
        const refundRate = EconSys && typeof EconSys.getSellRefundRate === 'function'
            ? EconSys.getSellRefundRate(rootLv)
            : (rootLv >= 2 ? 0.80 : 0.70);
        const refundPct = Math.round(refundRate * 100);
        const curWave = Math.max(1, st.currentWave || 1);
        const estPayout = EconSys && typeof EconSys.computeRootWaveIncome === 'function'
            ? EconSys.computeRootWaveIncome(rootLv, st.currentGold, curWave)
            : { totalGain: 0, baseGain: 0, interestGain: 0, waveCap: 22 + 8 * curWave, isSoftCapped: false };

        if (dom.treeRootTitleEl) {
            dom.treeRootTitleEl.innerText = L('世界樹 · 聚寶根鬚', 'World Tree · Treasure Roots');
        }
        if (dom.guildRootSummaryBadgeEl) {
            dom.guildRootSummaryBadgeEl.innerText = rootsUnlocked
                ? L(`根鬚 Lv.${rootLv} (+${estPayout.totalGain} 💰)`, `Roots Lv.${rootLv} (+${estPayout.totalGain} 💰)`)
                : L('根鬚未解鎖', 'Roots Locked');
            dom.guildRootSummaryBadgeEl.classList.toggle('is-active', rootsUnlocked && rootLv > 0);
        }
        if (dom.treeRootLvBadgeEl) {
            const lvName = L(curSpec.name, curSpec.nameEn || curSpec.name);
            dom.treeRootLvBadgeEl.innerText = `Lv.${rootLv} / Lv.3 · ${lvName}`;
            dom.treeRootLvBadgeEl.classList.toggle('is-max', rootLv >= 3);
        }
        if (dom.treeRootRefundBadgeEl) {
            dom.treeRootRefundBadgeEl.innerText = L(`出售退費 ${refundPct}%`, `Sell Refund ${refundPct}%`);
            dom.treeRootRefundBadgeEl.classList.toggle('is-boosted', refundPct >= 80);
        }
        if (dom.treeRootYieldBadgeEl) {
            if (!rootsUnlocked) {
                dom.treeRootYieldBadgeEl.innerText = L(
                    '尚未解鎖 · 請於「世界樹年輪 · 財富枝 ①」解鎖',
                    'Locked · Unlock Meta Wealth Branch #1'
                );
            } else if (rootLv >= 3) {
                const capHintZh = estPayout.isSoftCapped ? `，已達軟上限 ${estPayout.waveCap} 💰` : `，軟上限 ${estPayout.waveCap} 💰`;
                const capHintEn = estPayout.isSoftCapped ? `, Capped ${estPayout.waveCap} 💰` : `, Cap ${estPayout.waveCap} 💰`;
                dom.treeRootYieldBadgeEl.innerText = L(
                    `本波預估 +${estPayout.totalGain} 💰（固定 +${estPayout.baseGain} ＋ 利息 +${estPayout.interestGain}${capHintZh}）`,
                    `Wave Est. +${estPayout.totalGain} 💰 (Fixed +${estPayout.baseGain} + Int +${estPayout.interestGain}${capHintEn})`
                );
            } else {
                dom.treeRootYieldBadgeEl.innerText = L(
                    `本波預估 +${estPayout.totalGain} 💰（單波軟上限 ${estPayout.waveCap} 💰）`,
                    `Wave Est. +${estPayout.totalGain} 💰 (Soft Cap ${estPayout.waveCap} 💰)`
                );
            }
        }

        const canAct = isMatchPhaseActive();
        if (dom.treeRootUpgradeBtn) {
            if (!rootsUnlocked) {
                dom.treeRootUpgradeBtn.innerText = L('需解鎖財富枝 ① (300 ★)', 'Locked: Meta Wealth #1');
                dom.treeRootUpgradeBtn.disabled = true;
            } else if (!nextSpec) {
                dom.treeRootUpgradeBtn.innerText = L('已達最高等級 Lv.3 複利樹心', 'Max Level Lv.3 Compound Heart');
                dom.treeRootUpgradeBtn.disabled = true;
            } else {
                const canAfford = st.currentGold >= nextSpec.cost;
                const nextName = L(nextSpec.name, nextSpec.nameEn || nextSpec.name);
                dom.treeRootUpgradeBtn.innerText = L(
                    `升級 Lv.${nextSpec.level} ${nextName} (${nextSpec.cost} 💰)`,
                    `Upgrade Lv.${nextSpec.level} ${nextName} (${nextSpec.cost} 💰)`
                );
                dom.treeRootUpgradeBtn.disabled = !canAct || !canAfford;
            }
        }

        if (dom.treeRootTiersEl) {
            const tierCards = dom.treeRootTiersEl.querySelectorAll('.tree-root-tier-card');
            tierCards.forEach((card) => {
                const tLv = Number(card.dataset.rootTier) || 1;
                const tSpec = TreeSys && typeof TreeSys.getTreasureRootSpec === 'function'
                    ? TreeSys.getTreasureRootSpec(tLv)
                    : { level: tLv, name: `Lv.${tLv}`, cost: 45, shortDesc: '' };
                const unlocked = rootLv >= tLv;
                const isNext = rootsUnlocked && rootLv + 1 === tLv;
                const locked = !rootsUnlocked || tLv > rootLv + 1;
                card.classList.toggle('is-unlocked', unlocked);
                card.classList.toggle('is-next', isNext);
                card.classList.toggle('is-locked', locked);
                card.disabled = !rootsUnlocked || !canAct || unlocked;

                const nameEl = card.querySelector('.root-tier-name');
                const costEl = card.querySelector('.root-tier-cost');
                const descEl = card.querySelector('.root-tier-desc');
                if (nameEl) {
                    nameEl.innerText = `Lv.${tLv} ${L(tSpec.name, tSpec.nameEn || tSpec.name)}`;
                }
                if (costEl) {
                    costEl.innerText = unlocked
                        ? L('已啟用', 'Active')
                        : `${tSpec.cost} 💰`;
                }
                if (descEl) {
                    descEl.innerText = L(tSpec.shortDesc || tSpec.desc || '', tSpec.shortDescEn || tSpec.descEn || '');
                }
            });
        }
    }

    function updateGuildDrawerUI() {
        const dom = G.dom, st = G.state;
        if (!dom.guildPanelEl) return;

        if (EconSys && typeof EconSys.refreshStockForecastSignals === 'function') {
            EconSys.refreshStockForecastSignals();
        }
        const canAct = isMatchPhaseActive();
        const isPrepOrInter = canAct && (st.waveState === 'PREP' || st.waveState === 'INTERMISSION');
        const curWave = Math.max(1, st.currentWave || 1);
        const waveCap = EconSys && typeof EconSys.maxNonCombatGain === 'function'
            ? EconSys.maxNonCombatGain(curWave)
            : (22 + 8 * curWave);
        if (EconSys && typeof EconSys.ensureWaveNonCombatLedger === 'function') {
            EconSys.ensureWaveNonCombatLedger(curWave);
        }
        const usedNonCombat = Math.max(0, Number(st.waveNonCombatGold) || 0);

        if (dom.guildTitleEl) {
            dom.guildTitleEl.innerText = st.guildDrawerOpen
                ? L('世界樹商會 [B] · 點擊收合', 'Guild [B] · Collapse')
                : L('世界樹商會 [B] · 點擊展開', 'Guild [B] · Expand');
        }
        if (dom.guildChevronEl) {
            dom.guildChevronEl.innerText = st.guildDrawerOpen ? '▾' : '▴';
        }
        if (dom.guildToggleBtn) {
            dom.guildToggleBtn.setAttribute('aria-expanded', st.guildDrawerOpen ? 'true' : 'false');
        }
        if (dom.guildBodyEl) {
            dom.guildBodyEl.classList.toggle('hidden', !st.guildDrawerOpen);
        }
        const activeTab = st.guildActiveTab || 'roots';
        if (dom.guildTabBtnRoots) {
            const isRoots = activeTab === 'roots';
            dom.guildTabBtnRoots.classList.toggle('is-active', isRoots);
            dom.guildTabBtnRoots.setAttribute('aria-selected', isRoots ? 'true' : 'false');
            dom.guildTabBtnRoots.innerText = L('聚寶根鬚', 'Treasure Roots');
        }
        if (dom.guildTabBtnStocks) {
            const isStocks = activeTab === 'stocks';
            dom.guildTabBtnStocks.classList.toggle('is-active', isStocks);
            dom.guildTabBtnStocks.setAttribute('aria-selected', isStocks ? 'true' : 'false');
            dom.guildTabBtnStocks.innerText = L('元素股市', 'Element Stocks');
        }
        if (dom.guildTabBtnFate) {
            const isFate = activeTab === 'fate';
            dom.guildTabBtnFate.classList.toggle('is-active', isFate);
            dom.guildTabBtnFate.setAttribute('aria-selected', isFate ? 'true' : 'false');
            dom.guildTabBtnFate.innerText = L('盲盒與對賭', 'Blind Box & Wager');
        }
        if (dom.guildCloseBtn) {
            dom.guildCloseBtn.innerText = L('收合 ×', 'Close ×');
        }
        if (dom.guildTabRootsEl) dom.guildTabRootsEl.classList.toggle('hidden', activeTab !== 'roots');
        if (dom.guildTabStocksEl) dom.guildTabStocksEl.classList.toggle('hidden', activeTab !== 'stocks');
        if (dom.guildTabFateEl) dom.guildTabFateEl.classList.toggle('hidden', activeTab !== 'fate');
        if (dom.guildNonCombatBadgeEl) {
            dom.guildNonCombatBadgeEl.innerText = L(
                `非戰鬥淨利 ${usedNonCombat} / ${waveCap} 💰`,
                `Non-Combat ${usedNonCombat} / ${waveCap} 💰`
            );
            dom.guildNonCombatBadgeEl.classList.toggle('is-active', usedNonCombat >= waveCap);
        }
        const critPct = ((Number(st.teamCritBonusRate) || 0) * 100).toFixed(1);
        if (dom.guildCritBadgeEl) {
            const fruitBit = (st.fusionFruitCount || 0) > 0 ? L(' · 果實 ★', ' · Fruit ★') : '';
            dom.guildCritBadgeEl.innerText = L(`盲盒暴擊 +${critPct}%${fruitBit}`, `Box Crit +${critPct}%${fruitBit}`);
            dom.guildCritBadgeEl.classList.toggle('is-active', (st.teamCritBonusRate || 0) > 0 || (st.fusionFruitCount || 0) > 0);
        }
        if (dom.guildHoldTimerBtn) {
            const holding = Boolean(st.guildTimerHold && isPrepOrInter);
            dom.guildHoldTimerBtn.classList.toggle('is-holding', holding);
            if (isPrepOrInter) {
                dom.guildHoldTimerBtn.innerText = holding
                    ? L('波間倒數：已暫停（點擊恢復）', 'Countdown: Held (Click to Resume)')
                    : L('波間暫停倒數', 'Hold Intermission Timer');
                dom.guildHoldTimerBtn.disabled = false;
            } else {
                dom.guildHoldTimerBtn.innerText = st.guildAutoHoldTimer
                    ? L('波間自動暫停：開', 'Auto-Hold Intermission: ON')
                    : L('波間自動暫停：關', 'Auto-Hold Intermission: OFF');
                dom.guildHoldTimerBtn.disabled = !canAct;
            }
        }

        // A. 元素股市 UI
        const stocksUnlocked = !EconSys || typeof EconSys.canTradeStocks !== 'function' || EconSys.canTradeStocks();
        const hasInsider = Boolean(TreeSys && typeof TreeSys.hasBlessing === 'function' && TreeSys.hasBlessing('insider_trading'));
        const perSharePctNum = hasInsider ? 3.0 : 2.4;
        const sellFeePct = Math.round(((EconSys && typeof EconSys.getStockSellFeeRate === 'function') ? EconSys.getStockSellFeeRate() : 0.05) * 100);
        if (dom.guildStockCardEl) dom.guildStockCardEl.classList.toggle('is-meta-locked', !stocksUnlocked);
        if (dom.guildStockSubEl) {
            dom.guildStockSubEl.innerText = stocksUnlocked
                ? L(`上限 10 股 · 單股 +${perSharePctNum.toFixed(1)}% · 賣出 ${sellFeePct}% 費`, `Max 10 · +${perSharePctNum.toFixed(1)}%/sh · ${sellFeePct}% fee`)
                : L('尚未解鎖 · 請於「世界樹年輪 · 財富枝 ②」解鎖', 'Locked · Unlock Meta Wealth #2');
        }
        const stocks = st.stocks || {};
        const stockMeta = [
            { key: 'fire', priceEl: dom.stockPriceFireEl, trendEl: dom.stockTrendFireEl, holdEl: dom.stockHoldFireEl },
            { key: 'ice', priceEl: dom.stockPriceIceEl, trendEl: dom.stockTrendIceEl, holdEl: dom.stockHoldIceEl },
            { key: 'thunder', priceEl: dom.stockPriceThunderEl, trendEl: dom.stockTrendThunderEl, holdEl: dom.stockHoldThunderEl }
        ];
        stockMeta.forEach(({ key, priceEl, trendEl, holdEl }) => {
            const rec = stocks[key] || { price: 20, shares: 0, weaknessRatio: 1 / 3, trend: 'neutral', lastDelta: 0 };
            const deltaStr = rec.lastDelta > 0 ? ` (+${rec.lastDelta})` : (rec.lastDelta < 0 ? ` (${rec.lastDelta})` : '');
            if (priceEl) priceEl.innerText = `${rec.price} 💰${deltaStr}`;
            if (trendEl) {
                const ratioPct = Math.round((rec.weaknessRatio ?? (1 / 3)) * 100);
                trendEl.classList.remove('trend-bull', 'trend-bear');
                if (rec.trend === 'bull') {
                    trendEl.classList.add('trend-bull');
                    trendEl.innerText = L(`看漲 ▲ ${ratioPct}%`, `Bull ▲ ${ratioPct}%`);
                } else if (rec.trend === 'bear') {
                    trendEl.classList.add('trend-bear');
                    trendEl.innerText = L(`看跌 ▼ ${ratioPct}%`, `Bear ▼ ${ratioPct}%`);
                } else {
                    trendEl.innerText = L(`持平 ${ratioPct}%`, `Flat ${ratioPct}%`);
                }
            }
            if (holdEl) {
                const divPct = Math.min(24, Math.round((rec.shares || 0) * perSharePctNum * 10) / 10);
                holdEl.innerText = `${rec.shares || 0}/10 (+${divPct}%)`;
                holdEl.classList.toggle('has-shares', (rec.shares || 0) > 0);
            }
        });
        if (dom.guildStockListEl) {
            dom.guildStockListEl.querySelectorAll('.stock-btn').forEach((btn) => {
                const act = btn.dataset.stockAction;
                const elKey = btn.dataset.stockEl;
                const rec = stocks[elKey] || { price: 20, shares: 0 };
                if (act === 'buy') {
                    btn.innerText = L('買入', 'Buy');
                    btn.disabled = !stocksUnlocked || !canAct || (rec.shares || 0) >= 10 || st.currentGold < (rec.price || 20);
                } else if (act === 'sell') {
                    btn.innerText = L('賣出', 'Sell');
                    btn.disabled = !stocksUnlocked || !canAct || (rec.shares || 0) <= 0;
                }
            });
        }

        // B. 命運種子盲盒 & 萬能融合果實 UI
        const boxUnlocked = !EconSys || typeof EconSys.canOpenBlindBox !== 'function' || EconSys.canOpenBlindBox();
        const freeTokens = Math.max(0, Number(st.blindBoxTokens) || 0);
        const boxCost = EconSys && typeof EconSys.getBlindBoxCost === 'function' ? EconSys.getBlindBoxCost() : 35;
        const streak = Math.max(0, Number(st.blindBox1StarStreak) || 0);
        const pityNeed = (EconSys && typeof EconSys.getBlindBoxPityThreshold === 'function') ? EconSys.getBlindBoxPityThreshold() : 3;
        const hasLeaf = Boolean(TreeSys && typeof TreeSys.hasBlessing === 'function' && TreeSys.hasBlessing('gambler_lucky_leaf'));
        const missCritLabel = hasLeaf ? '2.0%' : '1.5%';
        if (dom.guildBlindBoxCardEl) dom.guildBlindBoxCardEl.classList.toggle('is-meta-locked', !boxUnlocked && freeTokens <= 0);
        if (dom.guildBoxTitleEl) dom.guildBoxTitleEl.innerText = L('命運種子盲盒', 'Fate Seed Blind Box');
        if (dom.guildBoxPityEl) {
            dom.guildBoxPityEl.innerText = streak >= pityNeed
                ? L(`保底已滿 ${pityNeed} / ${pityNeed}（本抽必出 2★+）`, `Pity Ready ${pityNeed} / ${pityNeed} (2★+ Guaranteed)`)
                : L(`1★ 保底進度 ${streak} / ${pityNeed}（第 ${pityNeed + 1} 抽必出 2★+）`, `1★ Pity ${streak} / ${pityNeed} (Pull #${pityNeed + 1} 2★+)`);
        }
        if (dom.guildBoxDescEl) {
            dom.guildBoxDescEl.innerText = (!boxUnlocked && freeTokens <= 0)
                ? L('尚未解鎖 · 請於「世界樹年輪 · 命運枝 ①」解鎖（擊殺竊賊可獲免費代幣）', 'Locked · Unlock Meta Fate #1 (or Thief Free Token)')
                : L(
                    `1★ 48% · 2★ 32% · 萬能果實 12% · 3★ 8%（未出 2★+ 全隊暴擊 +${missCritLabel}，盲盒塔退費依實付價計）`,
                    `1★ 48% · 2★ 32% · Fruit 12% · 3★ 8% (Non-2★+ adds +${missCritLabel} crit; refund by paid cost)`
                );
        }
        if (dom.blindBoxBuyBtn) {
            if (freeTokens > 0) {
                dom.blindBoxBuyBtn.innerText = L(`免費開啟盲盒（代幣 ${freeTokens}）`, `Open Free Box (Token ${freeTokens})`);
                dom.blindBoxBuyBtn.disabled = !isGameplayActive();
            } else if (!boxUnlocked) {
                dom.blindBoxBuyBtn.innerText = L('需解鎖命運枝 ① (300 ★)', 'Locked: Meta Fate #1');
                dom.blindBoxBuyBtn.disabled = true;
            } else {
                dom.blindBoxBuyBtn.innerText = L(`開啟命運盲盒 (${boxCost} 💰)`, `Open Blind Box (${boxCost} 💰)`);
                dom.blindBoxBuyBtn.disabled = !isGameplayActive() || st.currentGold < boxCost;
            }
        }
        if (dom.fusionFruitSlotBtn) {
            const hasFruit = (st.fusionFruitCount || 0) > 0;
            dom.fusionFruitSlotBtn.classList.toggle('has-fruit', hasFruit);
            dom.fusionFruitSlotBtn.classList.toggle('is-applying', Boolean(hasFruit && st.isApplyingFusionFruit));
            dom.fusionFruitSlotBtn.disabled = !isGameplayActive() || !hasFruit;
            if (!hasFruit) {
                dom.fusionFruitSlotBtn.innerText = L('萬能融合果實 (0/1) · 暫無果實', 'Universal Fusion Fruit (0/1)');
            } else if (st.isApplyingFusionFruit) {
                dom.fusionFruitSlotBtn.innerText = L('萬能融合果實 (1/1) · 請點選場上 1★/2★ 塔（再點取消）', 'Fruit Active (1/1) · Click a 1★/2★ Tower');
            } else {
                dom.fusionFruitSlotBtn.innerText = L('萬能融合果實 (1/1) · 點選或拖曳至 1★/2★ 塔升星', 'Universal Fruit (1/1) · Click or Drag onto 1★/2★');
            }
        }

        // C. 波次對賭懸賞 UI
        const wagerUnlocked = !EconSys || typeof EconSys.canUseWager !== 'function' || EconSys.canUseWager();
        if (dom.guildWagerCardEl) dom.guildWagerCardEl.classList.toggle('is-meta-locked', !wagerUnlocked);
        const zeroReturn = 70 + (hasLeaf ? 10 : 0);
        const zeroNet = zeroReturn - 40;
        const activeWagerType = st.activeWager ? st.activeWager.type : null;
        const surgeUsed = st.surgeWagerUsedCount || 0;
        const surgeRemain = Math.max(0, 2 - surgeUsed);
        if (dom.guildWagerTitleEl) dom.guildWagerTitleEl.innerText = L('波次對賭懸賞', 'Wave Wager Bounty');
        if (dom.guildWagerSubEl) {
            if (!wagerUnlocked) {
                dom.guildWagerSubEl.innerText = L('尚未解鎖 · 請於「世界樹年輪 · 命運枝 ②」解鎖', 'Locked · Unlock Meta Fate #2');
            } else if (activeWagerType === 'zero_leak') {
                dom.guildWagerSubEl.innerText = L(`已選：零封懸賞（0 掉血返還 ${zeroReturn} 💰）`, `Active: Zero-Leak (${zeroReturn} 💰 on 0 leak)`);
            } else if (activeWagerType === 'monster_surge') {
                dom.guildWagerSubEl.innerText = L('已選：魔潮加碼（擊殺 ×1.45 ＋ 萬能果實）', 'Active: Monster Surge (×1.45 Kill Gold + Fruit)');
            } else {
                dom.guildWagerSubEl.innerText = L('開戰前二選一 · 不選則正常開波', 'Pick 1 before wave starts (optional)');
            }
        }
        if (dom.wagerZeroLeakBtn) {
            const isSel = activeWagerType === 'zero_leak';
            dom.wagerZeroLeakBtn.classList.toggle('is-selected', isSel);
            const canAffordZero = isSel || st.currentGold >= 40;
            dom.wagerZeroLeakBtn.disabled = !wagerUnlocked || !isPrepOrInter || !canAffordZero;
            if (dom.wagerZeroTitleEl) dom.wagerZeroTitleEl.innerText = L('零封懸賞', 'Zero-Leak Bounty');
            if (dom.wagerZeroCostEl) dom.wagerZeroCostEl.innerText = isSel ? L('已押注 40 💰（點擊取消）', 'Staked 40 💰 (Cancel)') : L('押注 40 💰', 'Stake 40 💰');
            if (dom.wagerZeroDescEl) {
                dom.wagerZeroDescEl.innerText = L(
                    `本波 0 掉血返還 ${zeroReturn} 💰（淨賺 +${zeroNet} 💰）；漏怪沒收押金並補償 +15 💧`,
                    `0 HP lost returns ${zeroReturn} 💰 (Net +${zeroNet} 💰); leak forfeits stake & grants +15 💧`
                );
            }
        }
        if (dom.wagerSurgeBtn) {
            const isSel = activeWagerType === 'monster_surge';
            dom.wagerSurgeBtn.classList.toggle('is-selected', isSel);
            dom.wagerSurgeBtn.disabled = !wagerUnlocked || !isPrepOrInter || (!isSel && surgeRemain <= 0);
            if (dom.wagerSurgeTitleEl) dom.wagerSurgeTitleEl.innerText = L('魔潮加碼', 'Monster Surge');
            if (dom.wagerSurgeLimitEl) {
                dom.wagerSurgeLimitEl.innerText = isSel
                    ? L(`已啟用（剩 ${surgeRemain}/2 次 · 點擊取消）`, `Active (${surgeRemain}/2 left · Cancel)`)
                    : L(`免押金 · 剩 ${surgeRemain}/2 次`, `Free · ${surgeRemain}/2 Left`);
            }
            if (dom.wagerSurgeDescEl) {
                dom.wagerSurgeDescEl.innerText = L(
                    '怪血量 +25% · 移速 +10%；守住後擊殺賞金 ×1.45 ＋ 1 顆萬能果實',
                    'Enemy HP +25% · Spd +10%; clear grants ×1.45 kill gold + 1 Universal Fruit'
                );
            }
        }
    }

    function updateHUD() {
        const dom = G.dom, st = G.state;
        const treeCfg = (GameApp.data && GameApp.data.tree && GameApp.data.tree.TREE_CONFIG) || {};
        const maxHp = st.maxBaseHp || treeCfg.INITIAL_BASE_HP || CONFIG.INITIAL_BASE_HP || 20;
        setDomText(dom.goldDisplay, formatCompactGold(st.currentGold));
        if (dom.goldDisplay) dom.goldDisplay.title = String(st.currentGold);
        setDomText(dom.baseHpDisplay, `${st.baseHp}/${maxHp}`);
        setDomText(dom.waveDisplay, st.isEndlessMode ? `Wave ${st.currentWave} (${L('無盡', 'Endless')})` : `Wave ${st.currentWave} / ${CONFIG.VICTORY_WAVE || 10}`);
        setDomText(dom.bestWaveDisplay, `W${st.bestWave}`);
        updateWavePhaseUI(); Renderer.updateWorldTreeVisualState(); updateSkillButtonsUI();
        updateSeedPityUI(); updateTreasureRootUI(); updateGuildDrawerUI(); updateTowerInspector(); updateBossStatusBar(); updateSoundButtonUI();
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
            const compactRoleMap = {
                fire_bud: L('破甲 25', 'Break 25'),
                ice_bud: L('緩速 15', 'Slow 15'),
                thunder_bud: L('連鎖 13', 'Chain 13')
            };
            const shortRoleLabel = compactRoleMap[type] || `${(roleLabel.split('·')[0] || '').trim()} ${data.damage || ''}`.trim();
            btn.innerHTML = `
                <span class="spawn-pity-tag hidden" aria-hidden="true">${L('✨ 下次必出 ★★', '✨ Next ★★')}</span>
                <span class="spawn-card-portrait">
                    <canvas class="spawn-portrait-canvas" width="36" height="36" data-size="36" aria-hidden="true"></canvas>
                </span>
                <span class="spawn-card-head"><span class="spawn-card-name">${data.icon} ${data.name}</span><span class="btn-cost-val num">${cost} 💰</span></span>
                <span class="spawn-card-role num"><span class="role-full">${roleLabel}</span><span class="role-short">${shortRoleLabel}</span></span>
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
            setStatusMsg(
                `❌ 金幣不足，無法召喚【${towersDict[type].name}】！需要 ${deduct.cost} 💰`,
                `Not enough Gold to summon ${towersDict[type].name} (${deduct.cost} 💰 required).`
            );
            if (btnElOrRef(btnRef)) {
                btnRef.btn.classList.remove('shake-anim', 'insufficient-gold');
                void btnRef.btn.offsetWidth;
                btnRef.btn.classList.add('shake-anim', 'insufficient-gold');
            }
            return false;
        }

        function btnElOrRef(r) { return Boolean(r && r.btn); }

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
        const elementKey = (cfg && (cfg.shopKey || cfg.elementTag)) || type;
        Backend.trackFeel(`Tower:Summon:${elementKey}`, deduct.cost, {
            towerType: type,
            element: elementKey,
            tier: spawnedTier,
            cost: deduct.cost,
            cellIndex: targetIndex
        });
        recordZonePlacementTelemetry(targetIndex);

        if (seedTriggered && Renderer && typeof Renderer.spawnFloatingNotice === 'function') {
            const cellCenter = Renderer.getCellCenter(coords.x, coords.y);
            Renderer.spawnFloatingNotice(L('🌿 豐饒種子觸發！直接獲得 ★★', '🌿 Abundant Seed! Instant ★★'), cellCenter.left, cellCenter.top, 'pity-seed');
        }

        const dynTerrainTag = getTerrainShortTagForCell(targetIndex, tInfo);
        const tagSuffixZh = dynTerrainTag ? `（${dynTerrainTag}）` : '';
        const tagSuffixEn = dynTerrainTag ? ` (${dynTerrainTag})` : '';
        if (seedTriggered) {
            setStatusMsg(
                `豐饒種子觸發：於 (${coords.x + 1},${coords.y + 1}) 召喚【${cfg.name} ★★】${tagSuffixZh}，花費 ${deduct.cost} 💰。`,
                `Abundant Seed triggered: Summoned ${cfg.name} ★★ at (${coords.x + 1},${coords.y + 1})${tagSuffixEn} for ${deduct.cost} 💰.`
            );
        } else {
            setStatusMsg(
                `已於 (${coords.x + 1},${coords.y + 1}) 召喚【${cfg.name} ${Renderer.getTierStars(spawnedTier)}】${tagSuffixZh}，花費 ${deduct.cost} 💰。`,
                `Summoned ${cfg.name} ${Renderer.getTierStars(spawnedTier)} at (${coords.x + 1},${coords.y + 1})${tagSuffixEn} for ${deduct.cost} 💰.`
            );
        }
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
            setStatusMsg(
                `金幣不足，召喚【${towersDict[type].name}】需要 ${cost} 💰。`,
                `Insufficient Gold: ${towersDict[type].name} costs ${cost} 💰.`
            );
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
            setStatusMsg('已取消待放置模式。', 'Cancelled placement mode.');
        } else {
            st.pendingSpawnType = type;
            st.buildTargetIndex = null;
            const cfg = towersDict[type];
            setStatusMsg(
                `已選取【${cfg.icon} ${cfg.name}】(${cost} 💰)，點選棋盤可建格放置（按 Esc 或再點卡片取消）。`,
                `Selected ${cfg.icon} ${cfg.name} (${cost} 💰). Click any valid green tile to build (Esc or click card to cancel).`
            );
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
            setStatusMsg(
                `金幣不足，召喚【${towersDict[type].name}】需要 ${cost} 💰。`,
                `Insufficient Gold: ${towersDict[type].name} costs ${cost} 💰.`
            );
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
            setStatusMsg('可建造地塊已滿，請先融合或出售騰出空間。', 'No buildable tiles left. Merge or sell towers first.');
            return;
        }
        spawnTowerAtCell(type, targetIdx);
    }

    function tryClearObstacleCell(index) {
        const st = G.state;
        const terrainsDict = (GameApp.data && GameApp.data.terrain && GameApp.data.terrain.TERRAIN_TYPES) || {};
        if (TerrainSys.getTerrainAt(index) !== 'obstacle' || typeof TerrainSys.clearObstacleAt !== 'function') return false;
        if (st.isTouchMode) clearMonsterHoverLock();
        st.pendingSpawnType = null;
        st.selectedIndex = null;
        st.hoveredIndex = null;
        st.buildTargetIndex = null;
        const clearRes = TerrainSys.clearObstacleAt(index);
        if (!clearRes.ok) {
            if (clearRes.reason === 'insufficient_gold') {
                setStatusMsg(
                    `爆破古代巨岩需花費 ${clearRes.cost} 💰，當前金幣不足。`,
                    `Clearing Ancient Boulder requires ${clearRes.cost} 💰 (insufficient Gold).`
                );
            }
            Renderer.renderBoard([]);
            return true;
        }
        if (typeof Renderer.refreshCellTerrain === 'function') Renderer.refreshCellTerrain(index);
        const c = indexToCoords(index);
        const center = Renderer.getCellCenter(c.x, c.y);
        Renderer.emitParticleBurst(center.left, center.top, '#D97724', 12, 95);
        SoundEngine.playMerge(2, true);
        const revInfo = clearRes.revealedTerrain ? terrainsDict[clearRes.revealedTerrain] : null;
        if (revInfo) {
            const revTag = getTerrainShortTagForCell(index, revInfo);
            setStatusMsg(
                `地脈拓荒完成（-${clearRes.cost} 💰）：岩層下發掘出【${revInfo.name} · ${revTag}】！`,
                `Boulder cleared (-${clearRes.cost} 💰): Unearthed ${revInfo.name} · ${revTag}!`
            );
        } else {
            setStatusMsg(
                `地脈拓荒完成（-${clearRes.cost} 💰）：已清除障礙，可在此座標建造防禦塔。`,
                `Boulder cleared (-${clearRes.cost} 💰): Tile is now buildable.`
            );
        }
        Renderer.renderBoard([index]);
        updateHUD();
        return true;
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
                    const cellTag = getTerrainShortTagForCell(index, tInfo);
                    setStatusMsg(
                        `暫停檢視：【${(towersDict[t.type] && towersDict[t.type].name) || t.type} ${Renderer.getTierStars(t.tier)}】${cellTag ? `｜${cellTag}` : ''}（可切換索敵，恢復後可移塔或融合）。`,
                        `Inspecting (Paused): ${(towersDict[t.type] && towersDict[t.type].name) || t.type} ${Renderer.getTierStars(t.tier)}${cellTag ? ` | ${cellTag}` : ''} (target mode adjustable).`
                    );
                } else {
                    const nearMon = findMonsterNearCell(index);
                    if (nearMon) {
                        if (st.isTouchMode) {
                            lockTouchMonsterInspect(nearMon);
                            return;
                        }
                        st.selectedIndex = null; st.hoveredIndex = null; st.buildTargetIndex = null;
                        st.inspectedMonsterId = nearMon.id;
                        if (G.dom.msgText) G.dom.msgText.innerText = formatMonsterInspectText(nearMon);
                    } else {
                        st.selectedIndex = null; st.hoveredIndex = null; st.buildTargetIndex = null;
                        if (st.isTouchMode) clearMonsterHoverLock();
                        if (st.board[index] === null) {
                            setStatusMsg('暫停中可點防禦塔／怪物檢視與切換索敵，按「繼續」或 Space 恢復操作。', 'Paused: click a tower/enemy to inspect, press Resume or Space to continue.');
                        } else {
                            setStatusMsg('已取消選取。', 'Selection cleared.');
                        }
                    }
                }
                Renderer.renderBoard([]);
                Renderer.updateRangeIndicator();
                updateTowerInspector();
            }
            return;
        }

        if (st.isApplyingFusionFruit && (st.fusionFruitCount || 0) > 0) {
            if (st.board[index] !== null) {
                applyFusionFruitAtCell(index);
                return;
            }
            st.isApplyingFusionFruit = false;
            setStatusMsg('已取消萬能融合果實套用模式。', 'Cancelled Universal Fusion Fruit mode.');
            Renderer.renderBoard([]);
            updateHUD();
            return;
        }

        if (st.pendingSpawnType) {
            const pendingType = st.pendingSpawnType;
            if (TerrainSys.canBuildAt(index) && st.board[index] === null) {
                spawnTowerAtCell(pendingType, index);
                return;
            }
            if (tryClearObstacleCell(index)) {
                return;
            }
            if (st.board[index] !== null) {
                st.pendingSpawnType = null;
                st.selectedIndex = index; st.buildTargetIndex = null;
                const t = st.board[index], terrain = TerrainSys.getTerrainAt(index);
                const tInfo = terrain ? terrainsDict[terrain] : null;
                const cellTag = getTerrainShortTagForCell(index, tInfo);
                setStatusMsg(
                    `已退出待放置並選取【${(towersDict[t.type] && towersDict[t.type].name) || t.type} ${Renderer.getTierStars(t.tier)}】${cellTag ? `｜地形：${cellTag}` : ''}。`,
                    `Selected ${(towersDict[t.type] && towersDict[t.type].name) || t.type} ${Renderer.getTierStars(t.tier)}${cellTag ? ` | ${cellTag}` : ''}.`
                );
                Renderer.renderBoard([]);
                updateHUD();
                return;
            }
            if (G.map.pathCellIndices.has(index)) {
                setStatusMsg('怪物路徑不可建塔，請點選可建地塊（按 Esc 取消）。', 'Cannot build on enemy path. Choose a buildable tile (Esc to cancel).');
            } else {
                setStatusMsg('該地形不可建塔，請點選可建地塊（按 Esc 取消）。', 'Cannot build on this terrain. Choose a buildable tile (Esc to cancel).');
            }
            return;
        }

        if (st.selectedIndex === null) {
            if (st.board[index] !== null) {
                if (st.isTouchMode) clearMonsterHoverLock();
                st.selectedIndex = index; st.buildTargetIndex = null;
                const t = st.board[index], terrain = TerrainSys.getTerrainAt(index);
                const tInfo = terrain ? terrainsDict[terrain] : null;
                const cellTag = getTerrainShortTagForCell(index, tInfo);
                setStatusMsg(
                    `已選取【${(towersDict[t.type] && towersDict[t.type].name) || t.type} ${Renderer.getTierStars(t.tier)}】${cellTag ? `｜地形：${cellTag}` : ''}（可切換索敵、出售或拖曳融合/移動）`,
                    `Selected ${(towersDict[t.type] && towersDict[t.type].name) || t.type} ${Renderer.getTierStars(t.tier)}${cellTag ? ` | ${cellTag}` : ''}`
                );
            } else if (TerrainSys.canBuildAt(index)) {
                if (st.isTouchMode) clearMonsterHoverLock();
                st.selectedIndex = null; st.hoveredIndex = null;
                if (st.buildTargetIndex === index) {
                    st.buildTargetIndex = null;
                    setStatusMsg('已取消指定建造位置。', 'Cleared target build tile.');
                } else {
                    st.buildTargetIndex = index;
                    const c = indexToCoords(index), terrain = TerrainSys.getTerrainAt(index);
                    const tInfo = terrain ? terrainsDict[terrain] : null;
                    const cellTag = getTerrainShortTagForCell(index, tInfo);
                    setStatusMsg(
                        `已選取空地 (${c.x + 1},${c.y + 1})${cellTag ? `（${cellTag}）` : ''}，點擊下方元素卡即可建塔。`,
                        `Selected tile (${c.x + 1},${c.y + 1})${cellTag ? ` (${cellTag})` : ''}. Click an element card below to build.`
                    );
                }
            } else if (tryClearObstacleCell(index)) {
                return;
            } else if (index === G.map.endCellIndex) {
                st.selectedIndex = null; st.hoveredIndex = null; st.buildTargetIndex = null;
                const rootLv = TreeSys && typeof TreeSys.getTreasureRootLevel === 'function' ? TreeSys.getTreasureRootLevel() : (st.rootLevel || 0);
                const curSpec = TreeSys && typeof TreeSys.getTreasureRootSpec === 'function' ? TreeSys.getTreasureRootSpec(rootLv) : { name: '未啟用' };
                const nextSpec = TreeSys && typeof TreeSys.getNextTreasureRootSpec === 'function' ? TreeSys.getNextTreasureRootSpec() : null;
                const estPayout = EconSys && typeof EconSys.computeRootWaveIncome === 'function'
                    ? EconSys.computeRootWaveIncome(rootLv, st.currentGold, st.currentWave)
                    : { totalGain: 0, waveCap: 22 + 8 * st.currentWave };
                const refundPct = Math.round(((EconSys && EconSys.getSellRefundRate ? EconSys.getSellRefundRate(rootLv) : 0.70)) * 100);
                setStatusMsg(
                    `世界樹【聚寶根鬚 Lv.${rootLv} ${curSpec.name}】｜本波預估產出 +${estPayout.totalGain} 💰（軟上限 ${estPayout.waveCap} 💰）｜出售退費 ${refundPct}%${nextSpec ? `｜下一級：Lv.${nextSpec.level} ${nextSpec.name} (${nextSpec.cost} 💰)` : '｜已達最高等級'}。`,
                    `World Tree [Treasure Roots Lv.${rootLv} ${curSpec.nameEn || curSpec.name}] | Est. +${estPayout.totalGain} 💰 (Cap ${estPayout.waveCap} 💰) | Sell Refund ${refundPct}%${nextSpec ? ` | Next: Lv.${nextSpec.level} (${nextSpec.cost} 💰)` : ' | Max Level'}.`
                );
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
            setStatusMsg('已取消選取。', 'Selection cleared.');
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
            if (G.map.pathCellIndices.has(toIndex)) {
                setStatusMsg('怪物路徑不可放置防禦塔。', 'Cannot place towers on enemy path.');
            } else {
                setStatusMsg('該地形不可放置防禦塔。', 'Cannot place towers on this terrain.');
            }
            Renderer.renderBoard([]);
            return false;
        }

        Backend.recordPlayerAction();
        const fromTower = st.board[fromIndex], toTower = st.board[toIndex];
        if (toTower === null) {
            const moveCost = EconSys.getCombatMoveCost();
            if (!isRelocationFree()) {
                if (st.currentGold < moveCost) {
                    setStatusMsg(
                        `戰鬥期間調度塔位需花費 ${moveCost} 💰，金幣不足。`,
                        `Relocating mid-wave costs ${moveCost} 💰 (insufficient Gold).`
                    );
                    Renderer.renderBoard([]);
                    return false;
                }
                st.currentGold -= moveCost;
                setStatusMsg(`戰術調度完成，花費 ${moveCost} 💰。`, `Relocated tower for ${moveCost} 💰.`);
            } else {
                setStatusMsg('已免費移動防禦塔位置。', 'Relocated tower (free during prep).');
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
            SoundEngine.playMerge(fusion.tier, fusion.isCrossElement || fusion.isTwinCrown || fusion.tier >= 5);
            const fedU = fusion.feedU || 1;
            const curU = fusion.nextNutritionU || (fusion.tier >= 5 ? 16 : (fusion.tier === 4 ? 8 : 4));
            const nextTargetU = fusion.tier === 3 ? 8 : 16;
            if (fusion.isFeedUpgrade && !fusion.isFeedEvolve) {
                setStatusMsg(
                    `吞噬充能：【${cfg.name} ${Renderer.getTierStars(fusion.tier)}】吸收 +${fedU}U ➔ ${curU}/${nextTargetU} U，攻擊力即時提升！`,
                    `Fed +${fedU}U to ${cfg.name} ${Renderer.getTierStars(fusion.tier)} (${curU}/${nextTargetU} U).`
                );
            } else if (fusion.isFeedUpgrade && fusion.isFeedEvolve) {
                setStatusMsg(
                    `充能達標突破：【${cfg.name} ${Renderer.getTierStars(fusion.tier)}】(${curU}U)${bonusHint || ''}！`,
                    `Feeding threshold reached: Evolved into ${cfg.name} ${Renderer.getTierStars(fusion.tier)} (${curU}U)${bonusHint || ''}!`
                );
            } else if (fusion.isTwinCrown) {
                setStatusMsg(
                    `雙生合體成功：【${cfg.name} ★★★★AB】同時掌握雙分支機制！${bonusHint || ''}`,
                    `Twin Crown Merge: ${cfg.name} ★★★★AB wields both A & B mechanics!${bonusHint || ''}`
                );
            } else if (fusion.tier >= 5) {
                setStatusMsg(
                    `神裔降臨：【${cfg.name} ★★★★★】已達世界樹頂點！周圍友軍光環與全圖神脈啟動${bonusHint || ''}。`,
                    `World Tree Scion Awakened: ${cfg.name} ★★★★★! Ally aura & map pulse active.`
                );
            } else {
                const actionVerb = fusion.mode === 'transfer_t1' ? L('轉職成功', 'Class Transfer') : L('升星成功', 'Star Up');
                setStatusMsg(
                    `${fusion.mode === 'transfer_t1' ? '轉職成功' : '升星成功'}：【${cfg.name} ${Renderer.getTierStars(fusion.tier)}】${bonusHint || ''}`,
                    `${actionVerb}: ${cfg.name} ${Renderer.getTierStars(fusion.tier)}${bonusHint ? ` ${bonusHint}` : ''}`
                );
            }
            Renderer.renderBoard([fromIndex, toIndex]);
            updateHUD();
            return true;
        }
        const maxTier = (GameApp.data && GameApp.data.evolutions && GameApp.data.evolutions.MAX_TIER) || 5;
        if (fromTower.tier >= maxTier || toTower.tier >= maxTier) {
            setStatusMsg(
                `${Renderer.getTierStars(maxTier)} 已達最高星級，無法繼續融合。`,
                `${Renderer.getTierStars(maxTier)} has reached max tier and cannot merge further.`
            );
        } else if (EvoSys && typeof EvoSys.getIncompatibilityReason === 'function') {
            const reason = EvoSys.getIncompatibilityReason(fromTower, toTower);
            setStatusMsg(`${reason}（詳見世界樹圖譜）。`, `${reason} (see World Tree Codex).`);
        } else {
            setStatusMsg(
                '該組合無法融合，請於「世界樹圖譜」確認轉職與升星規則。',
                'Incompatible pair. Check World Tree Codex for transfer & merge rules.'
            );
        }
        Renderer.renderBoard([]);
        return false;
    }

    // ==================== 5B. 世界樹商會（A. 元素股市 / B. 命運種子盲盒 / C. 波次對賭懸賞） ====================
    function holdIntermissionTimerIfPrep() {
        const st = G.state;
        if (st.waveState === 'PREP' || st.waveState === 'INTERMISSION') {
            st.guildTimerHold = true;
            updateWavePhaseUI();
        }
    }

    function toggleGuildDrawer(forceState = null) {
        const st = G.state;
        Backend.recordPlayerAction();
        st.guildDrawerOpen = typeof forceState === 'boolean' ? forceState : !st.guildDrawerOpen;
        if (st.guildDrawerOpen && (st.waveState === 'PREP' || st.waveState === 'INTERMISSION')) {
            st.guildTimerHold = true;
        } else if (!st.guildDrawerOpen && st.guildTimerHold) {
            st.guildTimerHold = false;
        }
        updateHUD();
    }

    function switchGuildTab(tabId) {
        const st = G.state;
        if (!['roots', 'stocks', 'fate'].includes(tabId)) return;
        Backend.recordPlayerAction();
        st.guildActiveTab = tabId;
        st.guildDrawerOpen = true;
        holdIntermissionTimerIfPrep();
        updateGuildDrawerUI();
    }

    function toggleGuildTimerHold() {
        const st = G.state;
        Backend.recordPlayerAction();
        if (st.waveState === 'PREP' || st.waveState === 'INTERMISSION') {
            st.guildTimerHold = !st.guildTimerHold;
            st.guildAutoHoldTimer = st.guildTimerHold;
            setStatusMsg(
                st.guildTimerHold
                    ? '已暫停波間休整倒數，完成股市、盲盒或懸賞配置後可點「立即開波」或再次點擊恢復倒數。'
                    : '已恢復波間倒數計時。',
                st.guildTimerHold
                    ? 'Intermission countdown held. Click "Start Wave" or click again to resume countdown.'
                    : 'Intermission countdown resumed.'
            );
        } else {
            st.guildAutoHoldTimer = !st.guildAutoHoldTimer;
            setStatusMsg(
                st.guildAutoHoldTimer ? '已開啟「波間休整自動暫停倒數」。' : '已關閉「波間休整自動暫停倒數」。',
                st.guildAutoHoldTimer ? 'Auto-Hold Intermission Timer enabled.' : 'Auto-Hold Intermission Timer disabled.'
            );
        }
        updateHUD();
    }

    function handleStockTrade(action, elementKey) {
        const st = G.state;
        if (!isMatchPhaseActive() || !EconSys) return { ok: false, reason: 'inactive' };
        if (EconSys.canTradeStocks && !EconSys.canTradeStocks()) {
            setStatusMsg(
                '【元素股市】需於主選單「世界樹年輪・財富枝 ②」解鎖後才可交易。',
                'Element Stocks require Wealth Branch #2 in the World Tree Meta panel.'
            );
            updateHUD();
            return { ok: false, reason: 'meta_locked' };
        }
        Backend.recordPlayerAction();
        holdIntermissionTimerIfPrep();

        const elNames = {
            fire: L('🔥 火股', '🔥 Fire Stock'),
            ice: L('❄️ 冰股', '❄️ Ice Stock'),
            thunder: L('⚡ 雷股', '⚡ Thunder Stock')
        };
        const label = elNames[elementKey] || elementKey;

        if (action === 'buy') {
            const res = EconSys.buyStock(elementKey);
            if (!res.ok) {
                if (res.reason === 'max_shares') {
                    setStatusMsg(`【${label}】已達持倉上限 10 股。`, `${label} reached max position (10 shares).`);
                } else if (res.reason === 'insufficient_gold') {
                    setStatusMsg(`金幣不足，買入【${label}】需要 ${res.price} 💰。`, `Not enough Gold: ${label} costs ${res.price} 💰.`);
                }
                updateHUD();
                return res;
            }
            SoundEngine.playSpawn(1);
            const divPct = Math.round(res.dividendBonus * 1000) / 10;
            setStatusMsg(
                `買入 1 股【${label}】（-${res.price} 💰），當前持倉 ${res.shares}/10 股（對應元素塔戰力桶 +${divPct}%）。`,
                `Bought 1 ${label} (-${res.price} 💰). Holding ${res.shares}/10 (+${divPct}% element tower power).`
            );
            updateHUD();
            return res;
        }

        if (action === 'sell') {
            const res = EconSys.sellStock(elementKey, st.currentWave);
            if (!res.ok) {
                setStatusMsg(`目前未持有【${label}】，無法賣出。`, `No ${label} shares to sell.`);
                updateHUD();
                return res;
            }
            SoundEngine.playSpawn(1);
            const divPct = Math.round(res.dividendBonus * 1000) / 10;
            const feePct = Math.round((EconSys.getStockSellFeeRate ? EconSys.getStockSellFeeRate() : 0.05) * 100);
            const capNoteZh = res.isSoftCapped ? '（淨利部分已受單波軟上限約束）' : '';
            const capNoteEn = res.isSoftCapped ? ' (net profit capped by wave soft cap)' : '';
            setStatusMsg(
                `賣出 1 股【${label}】（扣除 ${feePct}% 手續費 ${res.fee} 💰，實拿 +${res.payout} 💰${capNoteZh}），剩餘 ${res.shares}/10 股（+${divPct}%）。`,
                `Sold 1 ${label} (${feePct}% fee ${res.fee} 💰, received +${res.payout} 💰${capNoteEn}). Remaining ${res.shares}/10 (+${divPct}%).`
            );
            updateHUD();
            return res;
        }
        return { ok: false, reason: 'invalid_action' };
    }

    function openBlindBox(options = {}) {
        const st = G.state;
        const towersDict = getTowersDict();
        if (!isGameplayActive() || !EconSys) return { ok: false, reason: 'inactive' };
        const canBox = !EconSys.canOpenBlindBox || EconSys.canOpenBlindBox();
        const useFreeToken = (st.blindBoxTokens || 0) > 0 && !Number.isFinite(options.costOverride);
        if (!canBox && !useFreeToken) {
            setStatusMsg(
                '【命運種子盲盒】需於主選單「世界樹年輪・命運枝 ①」解鎖（或擊殺靈脈竊賊取得免費代幣）。',
                'Fate Seed Blind Box requires Fate Branch #1 (or a free token from Vein Thief).'
            );
            return { ok: false, reason: 'meta_locked' };
        }
        Backend.recordPlayerAction();
        holdIntermissionTimerIfPrep();

        const boxCost = useFreeToken ? 0 : (Number.isFinite(options.costOverride) ? options.costOverride : EconSys.getBlindBoxCost());
        if (st.currentGold < boxCost) {
            setStatusMsg(
                `金幣不足，開啟【命運種子盲盒】需要 ${boxCost} 💰。`,
                `Not enough Gold: Fate Seed Blind Box costs ${boxCost} 💰.`
            );
            return { ok: false, reason: 'insufficient_gold', boxCost };
        }

        const spot = AttackSys.pickSmartSpawnIndex('fire_bud');
        if (!spot && options.forceOutcome !== 'fruit') {
            setStatusMsg(
                '棋盤可建造地塊已滿，請先融合或出售防禦塔騰出空間後再開啟盲盒。',
                'No buildable tiles available. Merge or sell towers before opening a Blind Box.'
            );
            return { ok: false, reason: 'board_full', boxCost };
        }

        if (useFreeToken) {
            st.blindBoxTokens = Math.max(0, (st.blindBoxTokens || 0) - 1);
        } else {
            st.currentGold -= boxCost;
        }
        const roll = EconSys.rollBlindBoxOutcome(options);
        const critPct = ((st.teamCritBonusRate || 0) * 100).toFixed(1);

        if (roll.kind === 'fruit') {
            st.fusionFruitCount = 1;
            SoundEngine.playMerge(2, true);
            const costLabel = useFreeToken ? L('盲盒代幣', 'Box Token') : `-${boxCost} 💰`;
            setStatusMsg(
                `命運盲盒（${costLabel}）開出【萬能融合果實 ★】！已存入槽位 (1/1)，全隊暴擊加成 +${critPct}%。`,
                `Blind Box (${costLabel}) yielded [Universal Fusion Fruit ★]! Stored (1/1), Team Crit +${critPct}%.`
            );
            updateHUD();
            return { ok: true, kind: 'fruit', boxCost, roll };
        }

        const targetIndex = (options.targetIndex !== undefined && options.targetIndex !== null && TerrainSys.canBuildAt(options.targetIndex) && st.board[options.targetIndex] === null)
            ? options.targetIndex
            : (spot ? spot.index : 0);
        const towerType = roll.towerType || (roll.tier === 3 ? 'fire_A' : (roll.tier === 2 ? 'fire_trunk' : 'fire_bud'));
        // 防刷錢鎖：investedGold 嚴格記錄實付 boxCost
        const spawnedTower = AttackSys.createTowerObj(towerType, roll.tier, boxCost, null, {
            fromBlindBox: true,
            keepRawType: true
        });
        spawnedTower.investedGold = boxCost;
        st.board[targetIndex] = spawnedTower;
        st.selectedIndex = targetIndex;
        st.buildTargetIndex = null;
        st.pendingSpawnType = null;

        const cfg = towersDict[spawnedTower.type] || { icon: '🔥', name: spawnedTower.type };
        const coords = indexToCoords(targetIndex);
        SoundEngine.playMerge(roll.tier, roll.tier >= 2);
        if (CodexSys && typeof CodexSys.unlockEntry === 'function') {
            CodexSys.unlockEntry(`tower:${spawnedTower.type}`);
        }
        if (Renderer && typeof Renderer.spawnFloatingNotice === 'function') {
            const center = Renderer.getCellCenter(coords.x, coords.y);
            Renderer.spawnFloatingNotice(
                L(`盲盒 ${cfg.name} ${Renderer.getTierStars(roll.tier)}`, `Box ${cfg.name} ${Renderer.getTierStars(roll.tier)}`),
                center.left,
                center.top,
                'pity-seed'
            );
        }

        const pityPullCount = (EconSys.getBlindBoxPityThreshold ? EconSys.getBlindBoxPityThreshold() : 3) + 1;
        const pityNoteZh = roll.isPityTriggered ? `（觸發第 ${pityPullCount} 抽 2★+ 保底）` : '';
        const pityNoteEn = roll.isPityTriggered ? ` (${pityPullCount}th-pull 2★+ Pity!)` : '';
        const costTagZh = boxCost > 0 ? `-${boxCost} 💰` : '免費代幣';
        const costTagEn = boxCost > 0 ? `-${boxCost} 💰` : 'Free Token';
        const refundPreview = EconSys.getTowerSellRefund(spawnedTower);
        setStatusMsg(
            `命運盲盒（${costTagZh}）${pityNoteZh}於 (${coords.x + 1},${coords.y + 1}) 開出【${cfg.icon} ${cfg.name} ${Renderer.getTierStars(roll.tier)}】（實付鎖定 ${boxCost} 💰，出售退還 ${refundPreview} 💰｜全隊暴擊 +${critPct}%）。`,
            `Blind Box (${costTagEn})${pityNoteEn} spawned ${cfg.icon} ${cfg.name} ${Renderer.getTierStars(roll.tier)} at (${coords.x + 1},${coords.y + 1}) (Invested ${boxCost} 💰, Refund ${refundPreview} 💰 | Team Crit +${critPct}%).`
        );
        Renderer.renderBoard([targetIndex]);
        updateHUD();
        return {
            ok: true,
            kind: 'tower',
            boxCost,
            tower: spawnedTower,
            cellIndex: targetIndex,
            roll
        };
    }

    function applyFusionFruitAtCell(cellIndex, chosenBranchType = null) {
        const st = G.state;
        const towersDict = getTowersDict();
        if (!isGameplayActive() || (st.fusionFruitCount || 0) <= 0) {
            return { ok: false, reason: 'no_fruit' };
        }
        const targetTower = st.board[cellIndex];
        if (!targetTower) {
            return { ok: false, reason: 'empty_cell' };
        }
        const preview = EvoSys && typeof EvoSys.getFruitUpgradePreview === 'function'
            ? EvoSys.getFruitUpgradePreview(targetTower)
            : null;
        if (!preview) {
            setStatusMsg(
                '該防禦塔已達 5★ 最高階級，無法套用萬能融合果實。',
                'Tower is already at max 5★ tier; cannot apply Universal Fusion Fruit.'
            );
            return { ok: false, reason: 'max_tier' };
        }

        holdIntermissionTimerIfPrep();
        // 若為 2★ 塔且未指定分支，開啟 3★ 冠枝雙分岔選擇輪盤
        if (preview.requiresConfirmation && !chosenBranchType) {
            st.isApplyingFusionFruit = false;
            openEvolutionConfirmModal(cellIndex, cellIndex, preview);
            Renderer.renderBoard([]);
            updateHUD();
            return { ok: true, pendingConfirmation: true, preview };
        }

        const res = EvoSys.executeFruitUpgrade(cellIndex, chosenBranchType);
        if (!res) return { ok: false, reason: 'upgrade_failed' };

        st.selectedIndex = cellIndex;
        const cfg = towersDict[res.fusion.type] || { icon: '🔥', name: res.fusion.type };
        SoundEngine.playMerge(res.fusion.tier, true);
        if (res.fusion.isFeedChargeOnly || (res.fusion.isFeedUpgrade && !res.fusion.isFeedEvolve)) {
            const fedU = res.fusion.feedU || 4;
            const curU = res.fusion.nextNutritionU || (res.mergedTower && res.mergedTower.nutritionU) || 12;
            const nextTargetU = res.fusion.tier === 3 ? 8 : 16;
            setStatusMsg(
                `已套用萬能融合果實：【${cfg.icon} ${cfg.name} ${Renderer.getTierStars(res.fusion.tier)}】充能 +${fedU}U（${curU}/${nextTargetU} U）！`,
                `Universal Fusion Fruit applied: +${fedU}U fed to ${cfg.icon} ${cfg.name} (${curU}/${nextTargetU} U)!`
            );
        } else {
            setStatusMsg(
                `已套用萬能融合果實：【${cfg.icon} ${cfg.name} ${Renderer.getTierStars(res.fusion.tier)}】進化完成${res.bonusHint || ''}！`,
                `Universal Fusion Fruit applied: Evolved to ${cfg.icon} ${cfg.name} ${Renderer.getTierStars(res.fusion.tier)}${res.bonusHint || ''}!`
            );
        }
        Renderer.renderBoard([cellIndex]);
        updateHUD();
        return { ok: true, result: res };
    }

    function handleFusionFruitSlotClick() {
        const st = G.state;
        const maxTier = (GameApp.data && GameApp.data.evolutions && GameApp.data.evolutions.MAX_TIER) || 5;
        if (!isGameplayActive() || (st.fusionFruitCount || 0) <= 0) return false;
        Backend.recordPlayerAction();
        holdIntermissionTimerIfPrep();

        // 若目前已選取場上 1★～4★ 防禦塔，直接一鍵套用升星或 +4U 充能！
        if (st.selectedIndex !== null && st.board[st.selectedIndex] !== null) {
            const selTower = st.board[st.selectedIndex];
            if (selTower.tier >= 1 && selTower.tier < maxTier) {
                applyFusionFruitAtCell(st.selectedIndex);
                return true;
            }
        }

        st.isApplyingFusionFruit = !st.isApplyingFusionFruit;
        st.pendingSpawnType = null;
        if (st.isApplyingFusionFruit) {
            setStatusMsg(
                '已啟動萬能融合果實：請點選場上 1★ ～ 4★ 防禦塔直接升星或充能 +4U（按 Esc 或再點槽位取消）。',
                'Universal Fusion Fruit active: Click any 1★-4★ tower to star up or feed +4U (Esc to cancel).'
            );
        } else {
            setStatusMsg('已取消萬能融合果實待套用狀態。', 'Cancelled Universal Fusion Fruit placement.');
        }
        Renderer.renderBoard([]);
        updateHUD();
        return true;
    }

    function handleWagerSelect(wagerType) {
        if (!EconSys || typeof EconSys.selectWaveWager !== 'function') return { ok: false };
        Backend.recordPlayerAction();
        holdIntermissionTimerIfPrep();

        const res = EconSys.selectWaveWager(wagerType);
        if (!res.ok) {
            if (res.reason === 'meta_locked') {
                setStatusMsg(
                    '【波次對賭懸賞】需於主選單「世界樹年輪・命運枝 ②」解鎖後才可使用。',
                    'Wave Wager Bounties require Fate Branch #2 unlocked in the World Tree Meta panel.'
                );
            } else if (res.reason === 'insufficient_gold') {
                setStatusMsg(
                    `金幣不足，押注【零封懸賞】需要 ${res.stake || 40} 💰。`,
                    `Not enough Gold: Zero-Leak Bounty requires ${res.stake || 40} 💰.`
                );
            } else if (res.reason === 'max_uses_reached') {
                setStatusMsg(
                    '本局【魔潮加碼】已達觸發上限（2 / 2 次）。',
                    'Monster Surge limit reached for this run (2 / 2 uses).'
                );
            } else if (res.reason === 'not_in_prep_phase') {
                setStatusMsg(
                    '波次對賭懸賞僅能於開戰前（備戰或波間休整期）選擇。',
                    'Wave Wager Bounties can only be selected before a wave starts.'
                );
            }
            updateHUD();
            return res;
        }

        SoundEngine.playSpawn(2);
        if (res.cancelledType) {
            setStatusMsg(
                res.refundedStake > 0
                    ? `已取消本波對賭懸賞，退還押金 +${res.refundedStake} 💰。`
                    : '已取消本波【魔潮加碼】懸賞。',
                res.refundedStake > 0
                    ? `Cancelled Wave Wager and refunded +${res.refundedStake} 💰.`
                    : 'Cancelled Monster Surge wager.'
            );
        } else if (res.type === 'zero_leak') {
            setStatusMsg(
                '已啟用【零封懸賞】（押注 40 💰）：本波世界樹 0 掉血將於波末返還 70 💰（淨賺 +30 💰）；若掉血則沒收押金並補償 +15 💧。',
                'Activated [Zero-Leak Bounty] (-40 💰 stake): 0 HP lost returns 70 💰 (+30 💰 net); leak forfeits stake & grants +15 💧.'
            );
        } else if (res.type === 'monster_surge') {
            setStatusMsg(
                `已啟用【魔潮加碼】（剩餘 ${res.remainingUses}/2 次）：本波怪血量 +25%、移速 +10%，守住後擊殺賞金 ×1.45 並獲得 1 顆萬能融合果實！`,
                `Activated [Monster Surge] (${res.remainingUses}/2 left): Enemy HP +25%, Spd +10%; clear grants ×1.45 kill gold + 1 Universal Fruit!`
            );
        }
        updateHUD();
        return res;
    }

    function openEvolutionConfirmModal(fromIndex, toIndex, fusionPreview) {
        const st = G.state, dom = G.dom;
        if (!fusionPreview || !Array.isArray(fusionPreview.options) || fusionPreview.options.length === 0) return false;
        const fromTower = st.board[fromIndex], toTower = st.board[toIndex];
        if (!fromTower || !toTower) return false;

        st.pendingEvolution = {
            fromIndex,
            toIndex,
            isFruitUpgrade: Boolean(fusionPreview.isFruitUpgrade),
            tier: fusionPreview.tier || 3,
            mode: fusionPreview.mode,
            options: fusionPreview.options.slice(),
            previewLabel: fusionPreview.previewLabel || ''
        };

        if (typeof Renderer.showDragEvolutionPreview === 'function') {
            Renderer.showDragEvolutionPreview(fromIndex, toIndex, fusionPreview.previewLabel || L('世界樹進化確認', 'Confirm Evolution'), true);
        }

        const towersDict = getTowersDict();
        const isSingle = fusionPreview.options.length === 1;
        const isInfusion = fusionPreview.mode === 'infusion_single' || (fusionPreview.tier === 2 && isSingle);
        if (dom.evoConfirmTitleEl) {
            dom.evoConfirmTitleEl.innerText = isInfusion
                ? (fusionPreview.title || L('元素灌注升星確認（0.15x 子彈時間）', 'Confirm Elemental Infusion (0.15x Bullet Time)'))
                : (isSingle ? L('定向冠枝開花確認（0.15x 子彈時間）', 'Confirm Crown Evolution (0.15x Bullet Time)') : L('世界樹冠枝雙分岔選擇（0.15x 子彈時間）', 'Crown Branch Choice (0.15x Bullet Time)'));
        }
        const evoBulletTagEl = document.getElementById('evo-bullet-tag');
        if (evoBulletTagEl) evoBulletTagEl.innerText = L('0.15x 子彈時間', '0.15x Bullet Time');
        if (dom.evoConfirmOptionsEl) {
            dom.evoConfirmOptionsEl.innerHTML = '';
            dom.evoConfirmOptionsEl.classList.toggle('single-branch', isSingle);
            fusionPreview.options.forEach((optType, idx) => {
                const cfg = towersDict[optType] || { icon: '✨', name: optType, badges: [], defaultLineagePath: [] };
                const targetTier = cfg.nodeTier || fusionPreview.tier || 3;
                const targetStars = Renderer.getTierStars(targetTier);
                const lineageText = (EvoSys && typeof EvoSys.getTowerLineagePathText === 'function')
                    ? EvoSys.getTowerLineagePathText({ type: optType, tier: targetTier })
                    : L(
                        Array.isArray(cfg.defaultLineagePath) ? cfg.defaultLineagePath.join(' ▸ ') : (cfg.lineagePath || ''),
                        cfg.lineagePath || (Array.isArray(cfg.defaultLineagePath) ? cfg.defaultLineagePath.join(' ▸ ') : '')
                    );
                const card = document.createElement('button');
                card.type = 'button';
                card.className = 'evo-branch-card';
                card.dataset.branchType = optType;
                const badgeChips = (!GameApp.i18n?.isEnglish() && Array.isArray(cfg.badges))
                    ? cfg.badges.slice(0, 3).map(b => `<span class="evo-badge-chip">${b}</span>`).join('')
                    : (cfg.tooltipSummary ? `<span class="evo-badge-chip">${cfg.tooltipSummary}</span>` : '');
                const hotkeyLabel = isInfusion
                    ? L('確認灌注升星 [Enter]', 'Confirm Infusion [Enter]')
                    : (isSingle ? L('確認開花 [Enter]', 'Confirm Blossom [Enter]') : (idx === 0 ? L('選擇 A 分支 [A / 1]', 'Choose Branch A [A / 1]') : L('選擇 B 分支 [D / 2]', 'Choose Branch B [D / 2]')));
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
        if (st.rafId !== null) {
            cancelAnimationFrame(st.rafId);
            st.rafId = null;
        }
        if (isInfusion) {
            setStatusMsg(
                `${fusionPreview.previewLabel}：點擊「確認灌注升星」或按 [Enter] 完成升星，按 [Esc] 取消。`,
                `${fusionPreview.previewLabel}: Click Confirm Infusion or press [Enter] ([Esc] to cancel).`
            );
        } else if (isSingle) {
            setStatusMsg(
                `${fusionPreview.previewLabel}：點擊「確認開花」或按 [Enter] 完成進化，按 [Esc] 取消。`,
                `${fusionPreview.previewLabel}: Click Confirm Blossom or press [Enter] ([Esc] to cancel).`
            );
        } else {
            setStatusMsg(
                `${fusionPreview.previewLabel}：請選擇 A 或 B 冠枝（熱鍵 [A]/[D]），或按 [Esc] 取消。`,
                `${fusionPreview.previewLabel}: Choose Branch A or B ([A]/[D], [Esc] to cancel).`
            );
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

        const res = pending.isFruitUpgrade
            ? EvoSys.executeFruitUpgrade(pending.toIndex, branchType)
            : EvoSys.executeTowerFusion(pending.fromIndex, pending.toIndex, branchType);
        if (res) {
            const { fusion, bonusHint } = res;
            const cfg = getTowersDict()[fusion.type] || { name: fusion.type };
            st.selectedIndex = pending.toIndex;
            SoundEngine.playMerge(fusion.tier, fusion.isCrossElement);
            setStatusMsg(
                `${fusion.tier === 2 ? '元素灌注升星完成' : '冠枝開花完成'}：【${cfg.icon || ''} ${cfg.name} ${Renderer.getTierStars(fusion.tier)}】${bonusHint || ''}`,
                `${fusion.tier === 2 ? 'Elemental Infusion complete' : 'Crown Blossom complete'}: ${cfg.icon || ''} ${cfg.name} ${Renderer.getTierStars(fusion.tier)}${bonusHint ? ` ${bonusHint}` : ''}`
            );
            Renderer.renderBoard([pending.fromIndex, pending.toIndex]);
            updateHUD();
            if (st.pendingBlessingWave !== null) {
                const queuedWave = st.pendingBlessingWave;
                st.pendingBlessingWave = null;
                if (!st.blessingGrantedWaves.has(queuedWave)) {
                    TreeSys.triggerBlessingSelection(queuedWave);
                }
            }
            if (isGameplayActive()) startMainLoop();
            return true;
        }
        Renderer.renderBoard([]);
        updateHUD();
        if (st.pendingBlessingWave !== null) {
            const queuedWave = st.pendingBlessingWave;
            st.pendingBlessingWave = null;
            if (!st.blessingGrantedWaves.has(queuedWave)) {
                TreeSys.triggerBlessingSelection(queuedWave);
            }
        }
        if (isGameplayActive()) startMainLoop();
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
        setStatusMsg('已取消進化確認，防禦塔維持原位且未消耗。', 'Evolution cancelled; towers remain unchanged.');
        Renderer.renderBoard([fromIndex, toIndex]);
        updateHUD();
        if (st.pendingBlessingWave !== null) {
            const queuedWave = st.pendingBlessingWave;
            st.pendingBlessingWave = null;
            if (!st.blessingGrantedWaves.has(queuedWave)) {
                TreeSys.triggerBlessingSelection(queuedWave);
            }
        }
        if (isGameplayActive()) startMainLoop();
        return true;
    }

    // ==================== 6. 波次、勝負結算與主迴圈 ====================
    function startWave(waveNum, earlyBonus = 0) {
        if (!isGameplayActive()) return;
        const st = G.state;
        const victoryWave = CONFIG.VICTORY_WAVE || 10;
        const towersDict = getTowersDict();
        st.currentWave = waveNum;
        st.waveNonCombatGold = 0;
        st.nonCombatLedgerWave = waveNum;
        st.waveLeakedCount = 0;
        st.guildTimerHold = false;
        st.isApplyingFusionFruit = false;
        if (st.activeWager && st.activeWager.type === 'zero_leak') {
            st.activeWager.leakedThisWave = false;
            st.activeWager.startBaseHp = st.baseHp;
        }
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
        st.guildDrawerOpen = false;

        const bonusMsgZh = earlyBonus > 0 ? `（⚡ 早鳥開波 +${earlyBonus} 💰）` : '';
        const bonusMsgEn = earlyBonus > 0 ? ` (⚡ Early Start +${earlyBonus} 💰)` : '';
        if (plan.crisisSpec) {
            const thiefSuffixZh = plan.hasThief ? '｜⚠️ 偵測到「🦊 靈脈竊賊」潛入！' : '';
            const thiefSuffixEn = plan.hasThief ? ' | ⚠️ Vein Thief detected!' : '';
            setStatusMsg(
                `⚠️ 危機波 Wave ${waveNum}【${plan.crisisSpec.title}】來襲：${plan.crisisSpec.hintZh}${thiefSuffixZh}${bonusMsgZh}`,
                `⚠️ Crisis Wave ${waveNum} [${plan.crisisSpec.titleEn}]: ${plan.crisisSpec.hintEn}${thiefSuffixEn}${bonusMsgEn}`
            );
            Backend.trackFeel(`Wave:CrisisStart:${plan.crisisSpec.id}`, waveNum, { wave: waveNum, crisisId: plan.crisisSpec.id });
        } else if (plan.bossMeta) {
            const bWeak = towersDict[plan.bossMeta.weakness] || { icon: '🔥', name: '火' };
            const weakIcon = bWeak.icon + getWeaknessShortName(plan.bossMeta.weakness);
            if (!st.isEndlessMode && waveNum === victoryWave) {
                setStatusMsg(
                    `最終決戰 Wave ${waveNum}/${victoryWave}：${plan.bossMeta.name}（弱 ${weakIcon} · 甲 ${plan.bossMeta.armor} · ${plan.bossMeta.hp} HP）來襲${bonusMsgZh}。`,
                    `Final Wave ${waveNum}/${victoryWave}: ${plan.bossMeta.name} (Weak ${weakIcon} · ARM ${plan.bossMeta.armor} · ${plan.bossMeta.hp} HP) incoming${bonusMsgEn}!`
                );
            } else {
                setStatusMsg(
                    `魔王波 Wave ${waveNum}：${plan.bossMeta.name}（弱 ${weakIcon} · 甲 ${plan.bossMeta.armor}）來襲${bonusMsgZh}。`,
                    `Boss Wave ${waveNum}: ${plan.bossMeta.name} (Weak ${weakIcon} · ARM ${plan.bossMeta.armor}) incoming${bonusMsgEn}!`
                );
            }
        } else if (plan.eliteCount > 0) {
            setStatusMsg(
                `第 ${waveNum} 波來襲：含高護甲菁英與機制怪，可善用火塔破甲或跨元素融合${bonusMsgZh}。`,
                `Wave ${waveNum} incoming: Includes armored elites & special foes. Use Fire shred or hybrid fusions${bonusMsgEn}.`
            );
        } else {
            const thiefSuffixZh = plan.hasThief ? '（偵測到 🦊 靈脈竊賊，擊殺掉厚獎！）' : '';
            const thiefSuffixEn = plan.hasThief ? ' (Vein Thief spotted—slay for treasure!)' : '';
            setStatusMsg(
                `第 ${waveNum} 波來襲：共 ${plan.queue.length} 隻敵軍進攻中${thiefSuffixZh}${bonusMsgZh}。`,
                `Wave ${waveNum} incoming: ${plan.queue.length} enemies marching${thiefSuffixEn}${bonusMsgEn}.`
            );
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
        let starsNum = 1, stars = '★', rankText = L('驚險死守，於危急時刻擊退腐朽古樹王。', 'Close victory—repelled the Blighted Treant King.');
        if (st.baseHp >= maxHp) { starsNum = 3; stars = '★★★'; rankText = L('完美防守，世界樹滿血守護通關第 10 波。', 'Flawless defense—cleared Wave 10 with full World Tree HP.'); }
        else if (st.baseHp >= Math.ceil(maxHp * 0.5)) { starsNum = 2; stars = '★★'; rankText = L('穩固防線，成功守護世界樹擊敗腐朽古樹王。', 'Solid defense—World Tree protected and Treant King defeated.'); }

        const honor = computeRunHonorSummary(st);
        Backend.finalizeWaveFeel(st.currentWave);
        Backend.saveMapRecord(st.currentMapId, st.currentWave, starsNum, {
            isClear: true,
            honorScore: honor.honorScore,
            contractCount: honor.count,
            awardHonor: true
        });
        st.bestWave = Math.max(st.bestWave, st.currentWave);
        renderMapSelectorUI();
        finalizeOutcomeScreen('VICTORY', 'victory');
        Backend.trackFeel('Progression:Complete', st.currentGold, { wave: st.currentWave, mapId: st.currentMapId, contracts: honor.count });
        Backend.trackFeel(`Run:Victory:${st.currentMapId}:Wave_${st.currentWave}`, st.baseHp);
        const mvpData = getMvpData();
        if (mvpData.mvp) {
            Backend.trackFeel(`MVP:${mvpData.mvp.type}`, mvpData.pct, { mvpType: mvpData.mvp.type, sharePct: mvpData.pct, mode: 'victory' });
        }
        Backend.trackFeel('Economy:EndGold', st.currentGold, { endGold: st.currentGold, mode: 'victory' });
        if (typeof Backend.finalizeRunFeel === 'function') {
            Backend.finalizeRunFeel('victory', { wave: st.currentWave, mapId: st.currentMapId, contracts: honor.count });
        }
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
            contractCount: honor.count,
            awardHonor: true
        });
        renderMapSelectorUI();
        ['startOverlayEl', 'victoryOverlayEl', 'codexOverlayEl', 'guideOverlayEl', 'blessingOverlayEl', 'metaTreeOverlayEl', 'evoConfirmOverlayEl'].forEach(k => {
            if (G.dom[k]) G.dom[k].classList.add('hidden');
        });
        finalizeOutcomeScreen('GAMEOVER', 'gameover');
        Backend.trackFeel('Progression:Fail', st.killsCount, { wave: st.currentWave, mapId: st.currentMapId, contracts: honor.count });
        Backend.trackFeel(`Run:Fail:${st.currentMapId}:Wave_${st.currentWave}`, st.killsCount);
        const mvpData = getMvpData();
        if (mvpData.mvp) {
            Backend.trackFeel(`MVP:${mvpData.mvp.type}`, mvpData.pct, { mvpType: mvpData.mvp.type, sharePct: mvpData.pct, mode: 'gameover' });
        }
        Backend.trackFeel('Economy:EndGold', st.currentGold, { endGold: st.currentGold, mode: 'gameover' });
        if (typeof Backend.finalizeRunFeel === 'function') {
            Backend.finalizeRunFeel('gameover', { wave: st.currentWave, mapId: st.currentMapId, contracts: honor.count });
        }
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
        if (TreeSys && typeof TreeSys.resetTreasureRoots === 'function') {
            TreeSys.resetTreasureRoots();
        }
        const mapSpec = WaveSys.getCurrentMapSpec();
        Backend.resetRunTelemetry(G.state.currentMapId, mapSpec.name);
        ['startOverlayEl', 'victoryOverlayEl', 'gameOverOverlayEl', 'codexOverlayEl', 'guideOverlayEl', 'blessingOverlayEl', 'metaTreeOverlayEl', 'evoConfirmOverlayEl'].forEach(k => {
            if (G.dom[k]) G.dom[k].classList.add('hidden');
        });
        syncPauseUI();
        updateSeedPityUI();
    }

    function applyStartingMetaPerks(st) {
        if (!st) return;
        st.blessingRerollsLeft = (TreeSys && typeof TreeSys.isMetaNodeUnlocked === 'function' && TreeSys.isMetaNodeUnlocked('fate_4')) ? 1 : 0;
        if (TreeSys && typeof TreeSys.isMetaNodeUnlocked === 'function' && TreeSys.isMetaNodeUnlocked('wealth_4')
            && EconSys && typeof EconSys.grantRandomStockShare === 'function') {
            EconSys.grantRandomStockShare();
        }
    }

    function restartGame() {
        resetMatchSession('PREP', 1);
        applyStartingMetaPerks(G.state);
        const mapSpec = WaveSys.getCurrentMapSpec();
        setStatusMsg(
            `【${mapSpec.name}】拖曳下方元素卡至棋盤可建格召喚，或按 1/2/3/Q/W/E/B/Space 快速操作。`,
            `[${mapSpec.name}] Drag element cards onto green tiles to build, or press 1/2/3/Q/W/E/B/Space.`
        );
        Renderer.renderBoard(); updateHUD(); updateSpeedButtonUI(); startMainLoop();
    }

    function returnToMainMenu() {
        resetMatchSession('WAITING_START', 1);
        WaveSys.applyMapConfig(G.state.currentMapId);
        renderMapSelectorUI();
        renderContractSelectorUI();
        if (G.dom.startOverlayEl) G.dom.startOverlayEl.classList.remove('hidden');
        setStatusMsg('請選擇戰場地圖，點擊「開始防守」進入第 1 波備戰。', 'Select a battlefield map and click "Start Defense" to begin.');
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
        if (TreeSys && typeof TreeSys.resetTreasureRoots === 'function') {
            TreeSys.resetTreasureRoots();
        }
        applyStartingMetaPerks(st);
        if (CodexSys && typeof CodexSys.resetRunCodex === 'function') {
            CodexSys.resetRunCodex();
        }
        Backend.resetRunTelemetry(st.currentMapId, mapSpec.name);
        if (G.dom.startOverlayEl) G.dom.startOverlayEl.classList.add('hidden');
        const basePrepMs = CONFIG.INITIAL_PREP_MS || 6000;
        st.waveState = 'PREP';
        st.waveTimerMs = st.activeContracts.has('rapid_waves') ? Math.round(basePrepMs * 0.5) : basePrepMs;
        const contractTagZh = st.activeContracts.size > 0 ? `（契約 ×${st.activeContracts.size}）` : '';
        const contractTagEn = st.activeContracts.size > 0 ? ` (Contracts ×${st.activeContracts.size})` : '';
        setStatusMsg(
            `【${mapSpec.name}】${contractTagZh}第 1 波備戰開始，拖曳下方元素卡至空地佈置防線。`,
            `[${mapSpec.name}]${contractTagEn} Wave 1 prep started. Drag element cards onto open tiles to build.`
        );
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
        setStatusMsg('無盡挑戰模式已開啟，波數上限解除。', 'Endless Mode unlocked! Wave cap lifted.');
        setPauseState(false, { silent: true });
    }

    function gameTick(timestamp) {
        const st = G.state, tickSessionId = st.sessionId;
        st.rafId = null;
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
        st.harvestCdMs = Math.max(0, (st.harvestCdMs || 0) - dtMs);
        st.dewOverchargeMs = Math.max(0, (st.dewOverchargeMs || 0) - dtMs);
        const wasFrenzy = st.frenzyActiveMs > 0;
        st.frenzyActiveMs = Math.max(0, st.frenzyActiveMs - dtMs);
        if (wasFrenzy && st.frenzyActiveMs === 0) {
            for (let i = 0; i < G.towerElements.length; i++) if (G.towerElements[i]) G.towerElements[i].classList.remove('frenzy-active');
            updateTowerInspector();
        }
        if (st.entangleCdMs > 0 || st.frenzyCdMs > 0 || (st.harvestCdMs || 0) > 0 || wasFrenzy) updateSkillButtonsUI();

        const victoryWave = CONFIG.VICTORY_WAVE || 10;
        const blessingInterval = (GameApp.data && GameApp.data.tree && GameApp.data.tree.TREE_CONFIG && GameApp.data.tree.TREE_CONFIG.BLESSING_INTERVAL_WAVES) || 3;
        const baseInterMs = CONFIG.WAVE_INTERMISSION_MS || 4000;
        const intermissionMs = (st.activeContracts && st.activeContracts.has('rapid_waves')) ? Math.round(baseInterMs * 0.5) : baseInterMs;

        if (st.waveState === 'PREP' || st.waveState === 'INTERMISSION') {
            if (!st.guildTimerHold) {
                const prevSec = Math.ceil(st.waveTimerMs / 1000);
                st.waveTimerMs -= dtMs;
                if (st.waveTimerMs <= 0) startWave(st.waveState === 'PREP' ? 1 : st.currentWave + 1);
                else if (prevSec !== Math.ceil(st.waveTimerMs / 1000)) updateWavePhaseUI();
            }
        } else if (st.waveState === 'SPAWNING') {
            st.waveSpawnAccMs += dtMs;
            while (st.waveSpawnAccMs >= st.waveSpawnIntervalMs && st.waveSpawnQueue.length > 0) {
                st.waveSpawnAccMs -= st.waveSpawnIntervalMs;
                MonsterSys.spawnMonsterFromEntry(st.waveSpawnQueue.shift());
                if (st.waveSpawnQueue.length === 0) { st.waveState = 'CLEARING'; updateWavePhaseUI(); }
            }
        } else if (st.waveState === 'CLEARING' && st.monsters.length === 0) {
            const clearedCrisis = (WaveSys && typeof WaveSys.getCrisisWaveSpec === 'function')
                ? WaveSys.getCrisisWaveSpec(st.currentWave)
                : null;
            if (clearedCrisis && typeof Backend.trackFeel === 'function') {
                Backend.trackFeel(`Wave:CrisisClear:${clearedCrisis.id}`, st.currentWave, { wave: st.currentWave, crisisId: clearedCrisis.id });
            }
            const wagerResult = (EconSys && typeof EconSys.settleWaveWager === 'function')
                ? EconSys.settleWaveWager(st.currentWave)
                : null;
            st.lastWagerSettlement = wagerResult;
            const rootPayout = (TreeSys && typeof TreeSys.settleWaveRootIncome === 'function')
                ? TreeSys.settleWaveRootIncome(st.currentWave)
                : null;
            if (EconSys && typeof EconSys.settleWaveStocks === 'function') {
                EconSys.settleWaveStocks(st.currentWave + 1);
            }
            const extraSummariesZh = [];
            const extraSummariesEn = [];
            if (rootPayout) {
                extraSummariesZh.push(rootPayout.summaryZh);
                extraSummariesEn.push(rootPayout.summaryEn);
            }
            if (wagerResult) {
                extraSummariesZh.push(wagerResult.summaryZh);
                extraSummariesEn.push(wagerResult.summaryEn);
            }
            const rootMsgZh = extraSummariesZh.length > 0 ? `（${extraSummariesZh.join('｜')}）` : '';
            const rootMsgEn = extraSummariesEn.length > 0 ? ` (${extraSummariesEn.join(' | ')})` : '';
            if (!st.isEndlessMode && st.currentWave === victoryWave) {
                if (rootMsgZh) {
                    setStatusMsg(
                        `第 ${st.currentWave} 波最終防禦完成${rootMsgZh}！`,
                        `Final Wave ${st.currentWave} cleared${rootMsgEn}!`
                    );
                }
                triggerVictory();
                return;
            }
            Backend.finalizeWaveFeel(st.currentWave);
            Backend.trackFeel('Progression:Complete', st.currentGold, { wave: st.currentWave, mapId: st.currentMapId });
            if (st.currentWave % blessingInterval === 0 && !st.blessingGrantedWaves.has(st.currentWave)) {
                if (st.pendingEvolution || isOverlayVisible(G.dom.evoConfirmOverlayEl)) {
                    st.pendingBlessingWave = st.currentWave;
                    st.waveState = 'INTERMISSION'; st.waveTimerMs = intermissionMs;
                    st.guildTimerHold = Boolean(st.guildAutoHoldTimer);
                    setStatusMsg(
                        `第 ${st.currentWave} 波防禦完成${rootMsgZh}，完成進化選擇後將開啟枝枒祝福。`,
                        `Wave ${st.currentWave} cleared${rootMsgEn}! Blessing selection opens after evolution.`
                    );
                    updateHUD();
                    return;
                }
                if (TreeSys.triggerBlessingSelection(st.currentWave)) {
                    setStatusMsg(
                        `第 ${st.currentWave} 波防禦完成${rootMsgZh}，請擇一項世界樹枝枒祝福。`,
                        `Wave ${st.currentWave} cleared${rootMsgEn}! Choose a World Tree Blessing.`
                    );
                    return;
                }
            }
            st.waveState = 'INTERMISSION'; st.waveTimerMs = intermissionMs;
            st.guildTimerHold = Boolean(st.guildAutoHoldTimer);
            setStatusMsg(
                `第 ${st.currentWave} 波防禦完成${rootMsgZh}，下一波將於 ${Math.ceil(intermissionMs / 1000)} 秒後開始。`,
                `Wave ${st.currentWave} cleared${rootMsgEn}! Next wave begins in ${Math.ceil(intermissionMs / 1000)}s.`
            );
            updateHUD();
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
                setStatusMsg(
                    '遊戲已暫停（可點防禦塔檢視資訊，按「繼續」或 Space 恢復）。',
                    'Game Paused (Click a tower to inspect, press Resume or Space to continue).'
                );
            }
            updateHUD();
        } else {
            if (!silent && isMatchPhaseActive()) {
                setStatusMsg('遊戲繼續，守護世界樹防線。', 'Game resumed. Defend the World Tree!');
            }
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
        const labels = towersData.TARGET_MODE_LABELS || { first: L('最前', 'First'), armor: L('高護甲', 'Armor'), lowhp: L('殘血', 'Low HP') };
        t.targetMode = cycle[(cycle.indexOf(t.targetMode || 'first') + 1) % cycle.length];
        updateTowerInspector();
        const cfg = getTowersDict()[t.type] || { name: t.type };
        setStatusMsg(
            `已將【${cfg.name}】索敵優先級切換為：${labels[t.targetMode]}。`,
            `Set ${cfg.name} target priority to: ${labels[t.targetMode]}.`
        );
    }

    function sellSelectedTower() {
        const st = G.state;
        if (!isGameplayActive() || st.selectedIndex === null || st.board[st.selectedIndex] === null) return;
        Backend.recordPlayerAction();
        const sellIdx = st.selectedIndex, t = st.board[sellIdx], refund = EconSys.getTowerSellRefund(t);
        const cfg = getTowersDict()[t.type] || { name: t.type };
        if (t.isCrowned) {
            st.crownedUsedCount = Math.max(0, (st.crownedUsedCount || 0) - 1);
        }
        st.currentGold += refund; st.board[sellIdx] = null;
        st.selectedIndex = null; st.hoveredIndex = null; st.buildTargetIndex = null;
        Backend.trackFeel('Economy:SellTower', refund, { towerType: t.type, tier: t.tier, refund });
        setStatusMsg(
            `已出售【${cfg.name} ${Renderer.getTierStars(t.tier)}】，退還 +${refund} 💰。`,
            `Sold ${cfg.name} ${Renderer.getTierStars(t.tier)} for +${refund} 💰.`
        );
        Renderer.renderBoard([sellIdx]); updateHUD();
    }

    function infuseSelectedScionTower() {
        const st = G.state;
        if (!isGameplayActive() || st.selectedIndex === null) return false;
        if (TreeSys && typeof TreeSys.isMetaNodeUnlocked === 'function' && !TreeSys.isMetaNodeUnlocked('ancient_1')) {
            setStatusMsg(
                '【無盡靈脈灌注】需於主選單「世界樹年輪・古樹枝 ①」解鎖後才可使用。',
                'Vein Infusion requires Ancient Branch #1 unlocked in the World Tree Meta panel.'
            );
            return false;
        }
        const towerObj = st.board[st.selectedIndex];
        if (!towerObj || (Number(towerObj.tier) || 1) < 5) return false;

        const nextK = Math.max(0, Math.floor(Number(towerObj.infusionCount) || 0)) + 1;
        const cost = EconSys.getInfusionCost ? EconSys.getInfusionCost(nextK) : (150 + 75 * nextK);
        if (st.currentGold < cost) {
            setStatusMsg(
                `靈脈灌注第 ${nextK} 次需花費 ${cost} 💰，金幣不足。`,
                `Vein Infusion #${nextK} requires ${cost} 💰 (insufficient Gold).`
            );
            return false;
        }
        Backend.recordPlayerAction();
        st.currentGold -= cost;
        towerObj.infusionCount = nextK;
        towerObj.investedGold = (towerObj.investedGold || 0) + cost;

        const c = indexToCoords(st.selectedIndex);
        const center = Renderer.getCellCenter(c.x, c.y);
        Renderer.emitRingFX(center.left, center.top, G.boardMetrics.step * 1.35, '#D97724', 0.28, 340);
        Renderer.emitParticleBurst(center.left, center.top, '#E0B43C', 10, 95);
        SoundEngine.playMerge(5, true);

        const cfg = getTowersDict()[towerObj.type] || { name: towerObj.type };
        const totalBonusPct = Math.round((AttackSys.b_infusion ? AttackSys.b_infusion(nextK) : 0) * 100);
        setStatusMsg(
            `【${cfg.name} ★★★★★】完成第 ${nextK} 次靈脈灌注（-${cost} 💰），自身戰力桶灌注加成達 +${totalBonusPct}%！`,
            `${cfg.name} ★★★★★ Vein Infusion #${nextK} (-${cost} 💰): +${totalBonusPct}% power bucket bonus!`
        );
        Renderer.renderCellTower(st.selectedIndex);
        Renderer.renderBoard([]);
        updateHUD();
        return true;
    }

    function triggerEarlyNextWave() {
        const st = G.state;
        if (!isGameplayActive() || (st.waveState !== 'PREP' && st.waveState !== 'INTERMISSION')) return;
        Backend.recordPlayerAction();
        const bonus = EconSys.getEarlyWaveBonus();
        const targetWave = st.waveState === 'PREP' ? 1 : st.currentWave + 1;
        st.currentGold += bonus; st.totalGoldEarned += bonus;
        Backend.trackFeel('Feel:EarlyStart', bonus, { wave: st.currentWave, actionWave: targetWave, bonus });
        startWave(targetWave, bonus);
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
                const tag = btn.innerText.trim() || btn.dataset.ratingTag;
                Backend.trackFeel(`Feel:Rating:${tag}`, 1, { rating: tag });
                const parentGroup = btn.closest('.feel-rating-bar');
                if (parentGroup) {
                    parentGroup.querySelectorAll('.feel-rating-btn').forEach(b => b.classList.remove('selected'));
                }
                btn.classList.add('selected');
                [G.dom.victoryRatingStatusEl, G.dom.gameoverRatingStatusEl].forEach((el) => {
                    if (!el) return;
                    el.dataset.rated = '1';
                    el.innerText = L(`感謝回饋！（已記錄：${tag}）`, `Thanks for the feedback! (${tag})`);
                });
            });
        });

        [
            [G.dom.victoryFeedbackToggle, G.dom.victoryFeedbackBox],
            [G.dom.gameoverFeedbackToggle, G.dom.gameoverFeedbackBox]
        ].forEach(([btn, box]) => {
            if (!btn || !box) return;
            btn.addEventListener('click', () => {
                const nowHidden = box.classList.toggle('hidden');
                btn.setAttribute('aria-expanded', nowHidden ? 'false' : 'true');
            });
        });

        if (G.dom.victoryCopyReportBtn) {
            G.dom.victoryCopyReportBtn.addEventListener('click', async () => {
                const res = await Backend.copyBattleReportToClipboard(G, 'victory');
                G.dom.victoryCopyReportBtn.innerText = L('已複製本局數據戰報', 'Battle Report Copied');
                if (G.dom.victoryRatingStatusEl) {
                    G.dom.victoryRatingStatusEl.dataset.rated = '1';
                    G.dom.victoryRatingStatusEl.innerText = L('戰報已複製至剪貼簿，可直接貼上分享。', 'Report copied to clipboard.');
                }
                return res;
            });
        }

        if (G.dom.gameoverCopyReportBtn) {
            G.dom.gameoverCopyReportBtn.addEventListener('click', async () => {
                const res = await Backend.copyBattleReportToClipboard(G, 'gameover');
                G.dom.gameoverCopyReportBtn.innerText = L('已複製本局數據戰報', 'Battle Report Copied');
                if (G.dom.gameoverRatingStatusEl) {
                    G.dom.gameoverRatingStatusEl.dataset.rated = '1';
                    G.dom.gameoverRatingStatusEl.innerText = L('戰報已複製至剪貼簿，可直接貼上分享。', 'Report copied to clipboard.');
                }
                return res;
            });
        }
    }

    function setLangMenuOpen(open, targetWhich = 'all') {
        const isOpen = Boolean(open);
        [
            ['hud', G.dom.langMenuEl, G.dom.langBtn],
            ['start', G.dom.startLangMenuEl, G.dom.startLangBtn]
        ].forEach(([key, menuEl, btnEl]) => {
            const showThis = isOpen && (targetWhich === 'all' || targetWhich === key);
            if (menuEl) menuEl.classList.toggle('hidden', !showThis);
            if (btnEl) btnEl.setAttribute('aria-expanded', showThis ? 'true' : 'false');
        });
    }

    [
        ['inspectorInfuseBtn', infuseSelectedScionTower], ['inspectorTargetBtn', cycleSelectedTowerTargetMode], ['inspectorSellBtn', sellSelectedTower], ['nextWaveBtn', triggerEarlyNextWave],
        ['skillEntangleBtn', () => TreeSys.castEntangleSkill()], ['skillFrenzyBtn', () => TreeSys.castFrenzySkill()],
        ['skillHarvestBtn', () => TreeSys.castGoldenHarvestSkill()], ['guildHarvestBtn', () => TreeSys.castGoldenHarvestSkill()],
        ['blessingRerollBtn', () => { SoundEngine.ensureContext(); if (TreeSys && typeof TreeSys.rerollBlessingChoices === 'function') TreeSys.rerollBlessingChoices(); }],
        ['metaTreeBtn', openMetaTreeModal], ['metaTreeCloseBtn', closeMetaTreeModal], ['metaTreeResetBtn', handleResetMetaTree],
        ['pauseBtn', toggleCombatPause], ['pauseResumeBtn', () => { if (G.state.isPaused) setPauseState(false); }],
        ['pauseMenuBtn', returnToMainMenu], ['soundBtn', () => SoundEngine.toggleMute()],
        ['langBtn', (e) => {
            if (e && e.stopPropagation) e.stopPropagation();
            SoundEngine.ensureContext();
            const isCurrentlyHidden = !G.dom.langMenuEl || G.dom.langMenuEl.classList.contains('hidden');
            setLangMenuOpen(isCurrentlyHidden, 'hud');
        }],
        ['startLangBtn', (e) => {
            if (e && e.stopPropagation) e.stopPropagation();
            SoundEngine.ensureContext();
            const isCurrentlyHidden = !G.dom.startLangMenuEl || G.dom.startLangMenuEl.classList.contains('hidden');
            setLangMenuOpen(isCurrentlyHidden, 'start');
        }],
        ['codexBtn', () => CodexSys.openCodex()], ['codexCloseBtn', () => CodexSys.closeCodex()],
        ['helpBtn', () => { if (isGuideOpen()) closeGuide(); else openGuide(); }], ['guideXBtn', closeGuide], ['guideCloseBtn', closeGuide], ['guideMenuBtn', () => { closeGuide(); returnToMainMenu(); }],
        ['forecastToggleBtn', toggleForecastDrawer], ['speedBtn', cycleGameSpeed], ['startGameBtn', startGame],
        ['victoryRestartBtn', restartGame], ['victoryMenuBtn', returnToMainMenu], ['endlessBtn', continueEndlessMode],
        ['restartBtn', restartGame], ['gameoverMenuBtn', returnToMainMenu],
        ['evoCancelBtn', cancelPendingEvolution],
        ['treeRootUpgradeBtn', () => {
            SoundEngine.ensureContext();
            if (TreeSys && typeof TreeSys.upgradeTreasureRoot === 'function') {
                TreeSys.upgradeTreasureRoot();
            }
        }],
        ['guildToggleBtn', () => { SoundEngine.ensureContext(); toggleGuildDrawer(); }],
        ['guildCloseBtn', () => { SoundEngine.ensureContext(); toggleGuildDrawer(false); }],
        ['guildTabBtnRoots', () => { SoundEngine.ensureContext(); switchGuildTab('roots'); }],
        ['guildTabBtnStocks', () => { SoundEngine.ensureContext(); switchGuildTab('stocks'); }],
        ['guildTabBtnFate', () => { SoundEngine.ensureContext(); switchGuildTab('fate'); }],
        ['guildHoldTimerBtn', () => { SoundEngine.ensureContext(); toggleGuildTimerHold(); }],
        ['blindBoxBuyBtn', () => { SoundEngine.ensureContext(); openBlindBox(); }],
        ['wagerZeroLeakBtn', () => { SoundEngine.ensureContext(); handleWagerSelect('zero_leak'); }],
        ['wagerSurgeBtn', () => { SoundEngine.ensureContext(); handleWagerSelect('monster_surge'); }],
        ['addGoldBtn', () => { if (CONFIG.DEBUG_MODE && isGameplayActive()) { G.state.currentGold += 500; setStatusMsg('已增加 500 💰。', 'Added 500 💰.'); updateHUD(); } }],
        ['clearGoldBtn', () => { if (CONFIG.DEBUG_MODE && isGameplayActive()) { G.state.currentGold = 0; setStatusMsg('金幣已歸零。', 'Gold cleared to 0.'); updateHUD(); } }]
    ].forEach(([domKey, fn]) => { if (G.dom[domKey] && typeof fn === 'function') G.dom[domKey].addEventListener('click', fn); });

    if (G.dom.guildStockListEl) {
        G.dom.guildStockListEl.addEventListener('click', (e) => {
            const btn = e && e.target && e.target.closest ? e.target.closest('.stock-btn') : null;
            if (!btn) return;
            SoundEngine.ensureContext();
            const action = btn.dataset.stockAction;
            const elKey = btn.dataset.stockEl;
            if (action && elKey) {
                handleStockTrade(action, elKey);
            }
        });
    }

    if (G.dom.fusionFruitSlotBtn && DragSys && typeof DragSys.bindFusionFruitElement === 'function') {
        DragSys.bindFusionFruitElement(G.dom.fusionFruitSlotBtn, handleFusionFruitSlotClick);
    } else if (G.dom.fusionFruitSlotBtn) {
        G.dom.fusionFruitSlotBtn.addEventListener('click', () => {
            SoundEngine.ensureContext();
            handleFusionFruitSlotClick();
        });
    }

    if (G.dom.treeRootTiersEl) {
        G.dom.treeRootTiersEl.addEventListener('click', (e) => {
            const card = e && e.target && e.target.closest ? e.target.closest('.tree-root-tier-card') : null;
            if (!card) return;
            SoundEngine.ensureContext();
            const targetLv = Number(card.dataset.rootTier) || null;
            if (TreeSys && typeof TreeSys.upgradeTreasureRoot === 'function') {
                TreeSys.upgradeTreasureRoot(targetLv);
            }
        });
    }

    if (G.dom.guideOverlayEl) {
        G.dom.guideOverlayEl.addEventListener('click', (e) => {
            if (e && e.target === G.dom.guideOverlayEl) closeGuide();
        });
    }

    if (G.dom.metaTreeOverlayEl) {
        G.dom.metaTreeOverlayEl.addEventListener('click', (e) => {
            if (e && e.target === G.dom.metaTreeOverlayEl) closeMetaTreeModal();
        });
    }

    if (G.dom.metaTreeBranchesEl) {
        G.dom.metaTreeBranchesEl.addEventListener('click', (e) => {
            const btn = e && e.target && e.target.closest ? e.target.closest('.meta-node-btn') : null;
            if (!btn || btn.disabled || !btn.dataset.nodeId) return;
            SoundEngine.ensureContext();
            if (Backend && typeof Backend.purchaseMetaNode === 'function') {
                const res = Backend.purchaseMetaNode(btn.dataset.nodeId);
                if (res && res.ok) {
                    SoundEngine.playMerge(3, true);
                    renderMetaTreeModal();
                    updateHUD();
                }
            }
        });
    }

    [G.dom.langMenuEl, G.dom.startLangMenuEl].forEach((menuEl) => {
        if (!menuEl) return;
        menuEl.addEventListener('click', (e) => {
            const opt = e && e.target && e.target.closest ? e.target.closest('.lang-option') : null;
            if (!opt) return;
            if (e.stopPropagation) e.stopPropagation();
            SoundEngine.ensureContext();
            const targetLang = opt.dataset.lang;
            setLangMenuOpen(false, 'all');
            if (GameApp.i18n && (targetLang === 'en' || targetLang === 'zh-TW')) {
                GameApp.i18n.setLang(targetLang);
            }
        });
    });

    if (typeof document !== 'undefined') {
        document.addEventListener('click', (e) => {
            const target = e && e.target;
            if (target && target.closest && (target.closest('#lang-dropdown') || target.closest('#start-lang-dropdown'))) return;
            setLangMenuOpen(false);
        });
    }

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
            const tgt = e.target;
            const hudLangOpen = G.dom.langMenuEl && !G.dom.langMenuEl.classList.contains('hidden');
            const startLangOpen = G.dom.startLangMenuEl && !G.dom.startLangMenuEl.classList.contains('hidden');
            if (hudLangOpen || startLangOpen) {
                if (!tgt || !tgt.closest || (!tgt.closest('#lang-dropdown') && !tgt.closest('#start-lang-dropdown'))) {
                    setLangMenuOpen(false);
                }
            }
            if (G.state.forecastDrawerOpen && (!tgt || !tgt.closest || !tgt.closest('#wave-forecast-bar'))) {
                G.state.forecastDrawerOpen = false;
                updateWaveForecastUI();
            }
            if (G.state.guildDrawerOpen && (!tgt || !tgt.closest || (!tgt.closest('#world-tree-guild-panel') && !tgt.closest('#grid-board')))) {
                toggleGuildDrawer(false);
            }
            if (e.pointerType === 'touch') {
                activateTouchMode();
                if (tgt && typeof tgt.closest === 'function'
                    && !tgt.closest('#grid-board') && !tgt.closest('#tower-inspector') && !tgt.closest('#evo-confirm-overlay')) {
                    if (G.state.selectedIndex !== null || G.state.buildTargetIndex !== null || G.state.hoveredIndex !== null) {
                        G.state.selectedIndex = null;
                        G.state.buildTargetIndex = null;
                        G.state.hoveredIndex = null;
                        Renderer.renderBoard([]);
                        Renderer.updateRangeIndicator();
                    }
                    if (typeof Renderer.hideTerrainTooltip === 'function') Renderer.hideTerrainTooltip();
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
                if (key === 'Tab' || e.code === 'Space' || key === ' ') {
                    e.preventDefault();
                    return;
                }
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
                const hudLangOpen = G.dom.langMenuEl && !G.dom.langMenuEl.classList.contains('hidden');
                const startLangOpen = G.dom.startLangMenuEl && !G.dom.startLangMenuEl.classList.contains('hidden');
                if (hudLangOpen || startLangOpen) { e.preventDefault(); setLangMenuOpen(false); return; }
                if (isOverlayVisible(G.dom.metaTreeOverlayEl)) { e.preventDefault(); closeMetaTreeModal(); return; }
                if (DragSys.isDragging()) { e.preventDefault(); DragSys.cancelActiveDrag(); }
                else if (isCodexOpen()) { e.preventDefault(); CodexSys.closeCodex(); }
                else if (isGuideOpen()) { e.preventDefault(); closeGuide(); }
                else if (st.guildDrawerOpen) { e.preventDefault(); toggleGuildDrawer(false); }
                else if (st.forecastDrawerOpen) { e.preventDefault(); st.forecastDrawerOpen = false; updateWaveForecastUI(); }
                else if (isMatchPhaseActive() && (st.selectedIndex !== null || st.buildTargetIndex !== null || st.pendingSpawnType !== null || st.isApplyingFusionFruit || st.inspectedMonsterId !== null)) {
                    e.preventDefault(); st.selectedIndex = null; st.buildTargetIndex = null; st.pendingSpawnType = null; st.isApplyingFusionFruit = false; st.inspectedMonsterId = null;
                    Renderer.renderBoard([]); updateHUD();
                    setStatusMsg('已取消選取與待放置狀態。', 'Selection and placement cancelled.');
                }
                return;
            }
            if (isAnyModalOpen()) {
                if (key === 'Tab' || e.code === 'Space' || key === ' ') {
                    e.preventDefault();
                    return;
                }
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
            if (lowerKey === 'b' && !e.repeat) { e.preventDefault(); SoundEngine.ensureContext(); toggleGuildDrawer(); return; }
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
            } else if (lowerKey === 'e') {
                e.preventDefault(); SoundEngine.ensureContext(); TreeSys.castGoldenHarvestSkill();
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
        handleStockTrade,
        openBlindBox,
        applyFusionFruitAtCell,
        handleFusionFruitSlotClick,
        infuseSelectedScionTower,
        handleWagerSelect,
        toggleGuildDrawer,
        switchGuildTab,
        toggleGuildTimerHold,
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
            const st = G.state;
            renderSpawnerButtons();
            Renderer.initBoard();
            Renderer.renderBoard();
            Renderer.renderMonsterLayer();
            renderMapSelectorUI();
            renderContractSelectorUI();
            if (CodexSys && typeof CodexSys.isCodexOpen === 'function' && CodexSys.isCodexOpen()) {
                CodexSys.renderCodexModal();
            }
            if (st.waveState === 'BLESSING_SELECT' && G.dom.blessingChoicesEl && st.blessingChoices) {
                const bMap = (GameApp.data && GameApp.data.tree && GameApp.data.tree.BLESSINGS_MAP) || {};
                if (G.dom.blessingWaveSubtitleEl) {
                    G.dom.blessingWaveSubtitleEl.innerText = L(
                        `第 ${st.currentWave} 波捷報！世界樹賜予枝枒祝福，請擇一強化防線`,
                        `Wave ${st.currentWave} cleared! Choose a World Tree Blessing to empower your defense.`
                    );
                }
                G.dom.blessingChoicesEl.querySelectorAll('.blessing-choice-btn').forEach((card) => {
                    const b = bMap[card.dataset.blessingId];
                    if (!b) return;
                    const tEl = card.querySelector('.blessing-choice-title');
                    const dEl = card.querySelector('.blessing-choice-desc');
                    if (tEl) tEl.innerText = b.name;
                    if (dEl) dEl.innerText = b.desc;
                });
                if (G.dom.blessingRerollBtn) {
                    const left = Math.max(0, Number(st.blessingRerollsLeft) || 0);
                    G.dom.blessingRerollBtn.innerText = left > 0
                        ? L(`重抽賜福（免費剩 ${left} 次）`, `Reroll Blessings (${left} Free)`)
                        : L('免費重抽已使用 (0/1)', 'Free Reroll Used (0/1)');
                }
            }
            if (isOverlayVisible(G.dom.metaTreeOverlayEl)) {
                renderMetaTreeModal();
            }
            if (st.waveState === 'VICTORY') populateBattleRecap('victory');
            if (st.isGameOver || st.waveState === 'GAMEOVER') populateBattleRecap('gameover');
            if (Array.isArray(st.monsters) && st.monsters.length > 0) {
                const isEnNow = Boolean(GameApp.i18n && GameApp.i18n.isEnglish());
                const mDb = (GameApp.data && GameApp.data.monsters && GameApp.data.monsters.MONSTER_DATABASE) || {};
                const bosses = (GameApp.data && GameApp.data.monsters && GameApp.data.monsters.BOSS_ROSTER) || [];
                st.monsters.forEach((m) => {
                    if (!m) return;
                    if (m.isBoss) {
                        const bCfg = bosses.find(b => b.typeKey === m.typeKey) || mDb[m.typeKey];
                        if (bCfg) {
                            m.name = bCfg.name || m.name;
                            m.traitDesc = bCfg.traitDesc || m.traitDesc;
                        }
                    } else if (m.isSplitChild) {
                        m.name = isEnNow ? (m.typeKey === 'slime' ? 'Mini Slime' : 'Ancient Sapling') : (m.typeKey === 'slime' ? '迷你史萊姆' : '古樹幼苗');
                    } else if (mDb[m.typeKey]) {
                        const baseM = mDb[m.typeKey];
                        m.name = m.isElite ? (isEnNow ? `Elite ${baseM.name}` : `菁英${baseM.name}`) : baseM.name;
                        m.traitDesc = baseM.traitDesc || m.traitDesc;
                    }
                });
            }
            if (st.hoveredMonsterId !== null) updateMonsterHoverCardUI();

            // 同步更新底部狀態文字（含暫停、待機或最近一筆雙語訊息）
            if (st.isPaused && isMatchPhaseActive()) {
                setStatusMsg(
                    '遊戲已暫停（可點防禦塔檢視資訊，按「繼續」或 Space 恢復）。',
                    'Game Paused (Click a tower to inspect, press Resume or Space to continue).'
                );
            } else if (st.waveState === 'WAITING_START') {
                setStatusMsg(
                    '點擊「開始防守」開啟戰局，準備第 1 波防線佈置。',
                    'Click "Start Defense" to begin and prepare Wave 1 defenses.'
                );
            } else if (st.lastStatusMsgPair) {
                setStatusMsg(st.lastStatusMsgPair.zh, st.lastStatusMsgPair.en);
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

    Backend.init();
    updateMetaTreeEntryUI();

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
        handleStockTrade,
        openBlindBox,
        applyFusionFruitAtCell,
        handleFusionFruitSlotClick,
        infuseSelectedScionTower,
        handleWagerSelect,
        toggleGuildDrawer,
        switchGuildTab,
        toggleGuildTimerHold,
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
