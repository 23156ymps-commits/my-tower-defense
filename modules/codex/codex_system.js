/**
 * ============================================================================
 * 【檔案名稱】：modules/codex/codex_system.js
 * 【負責功能】：圖鑑解鎖紀錄持久化（localStorage）、互動式「元素世界樹」SVG 演化圖譜渲染
 *               （世界樹原核 → 3 根芽 → 6 主幹 → 12 冠枝）、局內棋盤 T2 素材戰術聯動高亮，
 *               以及入侵魔物與戰術地形百科分頁。
 * 【讀取資料】：讀取 codex_data.js、tower_data.js、evolution_data.js、monster_data.js、terrain_data.js。
 * 【常見修改入口】：
 *   1. 修改世界樹圖譜節點座標與連線拓撲：調整 WORLD_TREE_LAYOUT、WORLD_TREE_EDGES。
 *   2. 修改節點點擊詳情與場上素材掃描規則：修改 scanBoardCraftableState()、renderWorldTreeDetail()。
 * ============================================================================
 */
(function (global) {
    'use strict';

    const GameApp = global.GameApp = global.GameApp || {};
    const CONFIG = GameApp.config || {};

    let G = null;
    let currentCategory = 'fusion';
    let selectedTreeNodeId = 'fire_bud';
    let trackedRecipeNodeId = null;
    let preserveTreeSelectionOnce = false;
    let activeTreeFitFn = null;
    let treeResizeBound = false;
    const CODEX_DISCOVERY_STORAGE_KEY = 'merge_defense_codex_discovered_v1';
    // Phase 5：圖鑑改為單局重置（僅保存於本局記憶體，開新局或重開一律重置為尚未合成）；另於本地記錄首次探索以驅動結算正回饋
    const unlockedSet = new Set();
    const defaultEntryIdSet = new Set();
    const lifetimeDiscoveredSet = new Set();
    const runFirstUnlockedSet = new Set();
    let runFirstUnlockedIds = [];

    const EN_TREE_NODE_LABELS = {
        world_core: 'World Tree Core',
        fire_bud: 'Fire 1★', ice_bud: 'Ice 1★', thunder_bud: 'Bolt 1★',
        steam_bud: 'Steam 1★', magnet_bud: 'Magnet 1★', plasma_bud: 'Plasma 1★',
        fire_trunk: 'Ember 2★', steam_trunk: 'Hi-Steam', ice_trunk: 'Frost 2★',
        magnet_trunk: 'Hi-Magnet', thunder_trunk: 'Volt 2★', plasma_trunk: 'Hi-Plasma',
        fire_A: 'A Bombard', fire_B: 'B Cinder', steam_A: 'A Pressure', steam_B: 'B Frostmist',
        ice_A: 'A Permafrost', ice_B: 'B Icicle', magnet_A: 'A Gravity', magnet_B: 'B Overload',
        thunder_A: 'A Tempest', thunder_B: 'B Judgment', plasma_A: 'A Deathray', plasma_B: 'B Prism',
        fire_crown_A: '4★ A', fire_crown_B: '4★ B', fire_twin_AB: '4★ Twin', fire_scion: 'Blazeking 5★',
        steam_crown_A: '4★ A', steam_crown_B: '4★ B', steam_twin_AB: '4★ Twin', steam_scion: 'Palemist 5★',
        ice_crown_A: '4★ A', ice_crown_B: '4★ B', ice_twin_AB: '4★ Twin', ice_scion: 'Frostking 5★',
        magnet_crown_A: '4★ A', magnet_crown_B: '4★ B', magnet_twin_AB: '4★ Twin', magnet_scion: 'Starmagnet 5★',
        thunder_crown_A: '4★ A', thunder_crown_B: '4★ B', thunder_twin_AB: '4★ Twin', thunder_scion: 'Apexbolt 5★',
        plasma_crown_A: '4★ A', plasma_crown_B: '4★ B', plasma_twin_AB: '4★ Twin', plasma_scion: 'Radiant 5★',
        storm_tri: 'Storm 3★', storm_tri_4: 'Storm 4★',
        starforge_tri: 'Starforge 3★', starforge_tri_4: 'Forge 4★',
        prism_tri: 'ZeroPrism 3★', prism_tri_4: 'Prism 4★',
        primal_core: 'Primal Core 5★'
    };

    function L(zh, en) {
        return (GameApp.i18n && typeof GameApp.i18n.pick === 'function') ? GameApp.i18n.pick(zh, en) : zh;
    }

    function getTreeNodeLabel(nodeId, meta) {
        if (GameApp.i18n && GameApp.i18n.isEnglish() && EN_TREE_NODE_LABELS[nodeId]) {
            return EN_TREE_NODE_LABELS[nodeId];
        }
        return (meta && meta.label) || nodeId;
    }

    // SVG 世界樹演化圖譜畫布與扇形樹冠座標拓撲（1760 × 1300，自底向上：原核 → 1★ → 2★ → 3★ → 4★ 極意/雙生 → 5★ 神裔 → 三元傳奇 → 唯一 5★ 原初之核）
    const TREE_VIEW_W = 1760;
    const TREE_VIEW_H = 1300;

    const FAMILY_TREE_COLUMNS = [
        { family: 'fire', x: 165, branchA: '熔核', branchB: '焚世', twinLabel: '雙生4★', scionLabel: '炎燼神裔' },
        { family: 'steam', x: 455, branchA: '蒸壓', branchB: '霜霧', twinLabel: '雙生4★', scionLabel: '霧湧神裔' },
        { family: 'ice', x: 745, branchA: '永凍', branchB: '冰錐', twinLabel: '雙生4★', scionLabel: '永霜神裔' },
        { family: 'magnet', x: 1035, branchA: '黑洞', branchB: '電磁', twinLabel: '雙生4★', scionLabel: '星磁神裔' },
        { family: 'thunder', x: 1325, branchA: '連鎖', branchB: '審判', twinLabel: '雙生4★', scionLabel: '天穹神裔' },
        { family: 'plasma', x: 1605, branchA: '死光', branchB: '折射', twinLabel: '雙生4★', scionLabel: '聚變神裔' }
    ];

    const WORLD_TREE_LAYOUT = {
        world_core: { x: 880, y: 1220, tier: 0, family: 'core', label: '世界樹原核' },

        fire_bud: { x: 290, y: 1100, tier: 1, family: 'fire', label: '火芽 1★' },
        ice_bud: { x: 880, y: 1100, tier: 1, family: 'ice', label: '冰芽 1★' },
        thunder_bud: { x: 1470, y: 1100, tier: 1, family: 'thunder', label: '雷芽 1★' },

        steam_bud: { x: 455, y: 978, tier: 1, family: 'steam', isTransfer: true, label: '蒸氣 1★' },
        magnet_bud: { x: 1035, y: 978, tier: 1, family: 'magnet', isTransfer: true, label: '磁環 1★' },
        plasma_bud: { x: 1605, y: 978, tier: 1, family: 'plasma', isTransfer: true, label: '電漿 1★' },

        fire_trunk: { x: 165, y: 855, tier: 2, family: 'fire', label: '炎核 2★' },
        steam_trunk: { x: 455, y: 855, tier: 2, family: 'steam', label: '高階蒸氣' },
        ice_trunk: { x: 745, y: 855, tier: 2, family: 'ice', label: '霜晶 2★' },
        magnet_trunk: { x: 1035, y: 855, tier: 2, family: 'magnet', label: '高階磁環' },
        thunder_trunk: { x: 1325, y: 855, tier: 2, family: 'thunder', label: '雷紋 2★' },
        plasma_trunk: { x: 1605, y: 855, tier: 2, family: 'plasma', label: '高階電漿' },

        storm_tri: { x: 455, y: 295, tier: 3, family: 'storm_tri', branch: '三', label: '天災風暴 3★' },
        starforge_tri: { x: 880, y: 295, tier: 3, family: 'starforge_tri', branch: '三', label: '星界熔爐 3★' },
        prism_tri: { x: 1325, y: 295, tier: 3, family: 'prism_tri', branch: '三', label: '絕對零度 3★' },

        storm_tri_4: { x: 455, y: 185, tier: 4, family: 'storm_tri', branch: '4★', label: '天災風暴 4★' },
        starforge_tri_4: { x: 880, y: 185, tier: 4, family: 'starforge_tri', branch: '4★', label: '星界熔爐 4★' },
        prism_tri_4: { x: 1325, y: 185, tier: 4, family: 'prism_tri', branch: '4★', label: '絕對零度 4★' },

        primal_core: { x: 880, y: 72, tier: 5, family: 'primal_core', branch: '核', label: '原初之核 5★' }
    };

    const WORLD_TREE_EDGES = [
        { from: 'world_core', to: 'fire_bud', family: 'fire', kind: 'core' },
        { from: 'world_core', to: 'ice_bud', family: 'ice', kind: 'core' },
        { from: 'world_core', to: 'thunder_bud', family: 'thunder', kind: 'core' },

        { from: 'fire_bud', to: 'steam_bud', family: 'steam', kind: 'sym' },
        { from: 'ice_bud', to: 'steam_bud', family: 'steam', kind: 'sym' },
        { from: 'ice_bud', to: 'magnet_bud', family: 'magnet', kind: 'sym' },
        { from: 'thunder_bud', to: 'magnet_bud', family: 'magnet', kind: 'sym' },
        { from: 'fire_bud', to: 'plasma_bud', family: 'plasma', kind: 'sym', arcOffsetY: 130 },
        { from: 'thunder_bud', to: 'plasma_bud', family: 'plasma', kind: 'sym' },

        { from: 'fire_bud', to: 'fire_trunk', family: 'fire', kind: 'primary' },
        { from: 'steam_bud', to: 'steam_trunk', family: 'steam', kind: 'primary' },
        { from: 'ice_bud', to: 'ice_trunk', family: 'ice', kind: 'primary' },
        { from: 'magnet_bud', to: 'magnet_trunk', family: 'magnet', kind: 'primary' },
        { from: 'thunder_bud', to: 'thunder_trunk', family: 'thunder', kind: 'primary' },
        { from: 'plasma_bud', to: 'plasma_trunk', family: 'plasma', kind: 'primary' },

        { from: 'fire_bud', to: 'steam_trunk', family: 'fire', kind: 'directed' },
        { from: 'ice_bud', to: 'steam_trunk', family: 'ice', kind: 'directed' },
        { from: 'ice_bud', to: 'magnet_trunk', family: 'ice', kind: 'directed' },
        { from: 'thunder_bud', to: 'magnet_trunk', family: 'thunder', kind: 'directed' },
        { from: 'fire_bud', to: 'plasma_trunk', family: 'fire', kind: 'directed', arcOffsetY: -45 },
        { from: 'thunder_bud', to: 'plasma_trunk', family: 'thunder', kind: 'directed' },

        { from: 'steam_trunk', to: 'storm_tri', family: 'storm_tri', kind: 'sym' },
        { from: 'thunder_trunk', to: 'storm_tri', family: 'thunder', kind: 'sym', arcOffsetY: -65 },
        { from: 'magnet_trunk', to: 'starforge_tri', family: 'starforge_tri', kind: 'sym' },
        { from: 'fire_trunk', to: 'starforge_tri', family: 'fire', kind: 'sym', arcOffsetY: -80 },
        { from: 'plasma_trunk', to: 'prism_tri', family: 'prism_tri', kind: 'sym' },
        { from: 'ice_trunk', to: 'prism_tri', family: 'ice', kind: 'sym', arcOffsetY: -65 },

        { from: 'storm_tri', to: 'storm_tri_4', family: 'storm_tri', kind: 'primary' },
        { from: 'starforge_tri', to: 'starforge_tri_4', family: 'starforge_tri', kind: 'primary' },
        { from: 'prism_tri', to: 'prism_tri_4', family: 'prism_tri', kind: 'primary' },

        { from: 'storm_tri_4', to: 'primal_core', family: 'primal_core', kind: 'sym' },
        { from: 'starforge_tri_4', to: 'primal_core', family: 'primal_core', kind: 'primary' },
        { from: 'prism_tri_4', to: 'primal_core', family: 'primal_core', kind: 'sym' }
    ];

    FAMILY_TREE_COLUMNS.forEach((col) => {
        const fam = col.family;
        WORLD_TREE_LAYOUT[`${fam}_A`] = { x: col.x - 62, y: 718, tier: 3, family: fam, branch: 'A', label: `A ${col.branchA}` };
        WORLD_TREE_LAYOUT[`${fam}_B`] = { x: col.x + 62, y: 718, tier: 3, family: fam, branch: 'B', label: `B ${col.branchB}` };
        WORLD_TREE_LAYOUT[`${fam}_crown_A`] = { x: col.x - 88, y: 570, tier: 4, family: fam, branch: 'A', label: `4★A` };
        WORLD_TREE_LAYOUT[`${fam}_twin_AB`] = { x: col.x, y: 570, tier: 4, family: fam, branch: 'AB', label: col.twinLabel };
        WORLD_TREE_LAYOUT[`${fam}_crown_B`] = { x: col.x + 88, y: 570, tier: 4, family: fam, branch: 'B', label: `4★B` };
        WORLD_TREE_LAYOUT[`${fam}_scion`] = { x: col.x, y: 428, tier: 5, family: fam, branch: '神', label: col.scionLabel };

        WORLD_TREE_EDGES.push(
            { from: `${fam}_trunk`, to: `${fam}_A`, family: fam, kind: 'primary' },
            { from: `${fam}_trunk`, to: `${fam}_B`, family: fam, kind: 'primary' },
            { from: `${fam}_A`, to: `${fam}_crown_A`, family: fam, kind: 'primary' },
            { from: `${fam}_B`, to: `${fam}_crown_B`, family: fam, kind: 'primary' },
            { from: `${fam}_A`, to: `${fam}_twin_AB`, family: fam, kind: 'sym' },
            { from: `${fam}_B`, to: `${fam}_twin_AB`, family: fam, kind: 'sym' },
            { from: `${fam}_crown_A`, to: `${fam}_scion`, family: fam, kind: 'primary' },
            { from: `${fam}_twin_AB`, to: `${fam}_scion`, family: fam, kind: 'sym' },
            { from: `${fam}_crown_B`, to: `${fam}_scion`, family: fam, kind: 'primary' }
        );
    });

    const FAMILY_STROKE_COLORS = {
        core: '#B8C2BC',
        fire: '#C94A38',
        ice: '#4A9EBF',
        thunder: '#E0B43C',
        steam: '#D97724',
        magnet: '#4A9EBF',
        plasma: '#D97724',
        storm_tri: '#4A9EBF',
        starforge_tri: '#D97724',
        prism_tri: '#E0B43C',
        primal_core: '#E0B43C'
    };

    function loadLifetimeDiscovered() {
        try {
            if (typeof localStorage === 'undefined') return;
            const raw = localStorage.getItem(CODEX_DISCOVERY_STORAGE_KEY);
            if (!raw) return;
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
                parsed.forEach((id) => {
                    if (typeof id === 'string' && id.length > 0) lifetimeDiscoveredSet.add(id);
                });
            }
        } catch (_) {}
    }

    function saveLifetimeDiscovered() {
        try {
            if (typeof localStorage === 'undefined') return;
            localStorage.setItem(CODEX_DISCOVERY_STORAGE_KEY, JSON.stringify(Array.from(lifetimeDiscoveredSet)));
        } catch (_) {}
    }

    function bind(ctx) {
        G = ctx;
        loadLifetimeDiscovered();
        syncDefaultUnlockedEntries();
        initCodexModalDom();
        if (!treeResizeBound && typeof window !== 'undefined') {
            treeResizeBound = true;
            window.addEventListener('resize', () => {
                if (isCodexOpen() && currentCategory === 'fusion' && typeof activeTreeFitFn === 'function') {
                    activeTreeFitFn();
                }
            });
        }
    }

    function syncDefaultUnlockedEntries() {
        const entries = getCodexData().CODEX_ENTRIES || {};
        if (entries.towers) {
            Object.keys(entries.towers).forEach(k => {
                if (entries.towers[k] && entries.towers[k].defaultUnlocked) {
                    const eid = `tower:${k}`;
                    unlockedSet.add(eid);
                    defaultEntryIdSet.add(eid);
                    lifetimeDiscoveredSet.add(eid);
                }
            });
        }
        // 相容舊版 fire/ice/thunder 解鎖映射到 *_bud
        ['fire', 'ice', 'thunder'].forEach(k => {
            const eid = `tower:${k}_bud`;
            unlockedSet.add(eid);
            defaultEntryIdSet.add(eid);
            lifetimeDiscoveredSet.add(eid);
        });
        if (entries.monsters) {
            Object.keys(entries.monsters).forEach(k => {
                if (entries.monsters[k] && entries.monsters[k].defaultUnlocked) {
                    const eid = `monster:${k}`;
                    unlockedSet.add(eid);
                    defaultEntryIdSet.add(eid);
                    lifetimeDiscoveredSet.add(eid);
                }
            });
        }
        if (entries.terrain) {
            Object.keys(entries.terrain).forEach(k => {
                if (entries.terrain[k] && entries.terrain[k].defaultUnlocked !== false) {
                    const eid = `terrain:${k}`;
                    unlockedSet.add(eid);
                    defaultEntryIdSet.add(eid);
                }
            });
        }
    }

    function resetRunCodex() {
        unlockedSet.clear();
        runFirstUnlockedSet.clear();
        runFirstUnlockedIds = [];
        trackedRecipeNodeId = null;
        selectedTreeNodeId = 'fire_bud';
        syncDefaultUnlockedEntries();
        updateRecipeTrackerUI();
        if (isCodexOpen()) renderCodexModal(currentCategory);
    }

    function exportRunCodexState() {
        return {
            unlocked: Array.from(unlockedSet),
            firstUnlocked: runFirstUnlockedIds.slice(),
            trackedRecipeId: trackedRecipeNodeId || null
        };
    }

    function restoreRunCodexState(snap = null) {
        unlockedSet.clear();
        runFirstUnlockedSet.clear();
        runFirstUnlockedIds = [];
        trackedRecipeNodeId = null;
        syncDefaultUnlockedEntries();
        if (snap && typeof snap === 'object') {
            if (Array.isArray(snap.unlocked)) {
                snap.unlocked.forEach((eid) => {
                    if (typeof eid === 'string' && eid) unlockedSet.add(eid);
                });
            }
            if (Array.isArray(snap.firstUnlocked)) {
                snap.firstUnlocked.forEach((eid) => {
                    if (typeof eid === 'string' && eid && !runFirstUnlockedSet.has(eid)) {
                        runFirstUnlockedSet.add(eid);
                        runFirstUnlockedIds.push(eid);
                    }
                });
            }
            if (typeof snap.trackedRecipeId === 'string' && snap.trackedRecipeId) {
                trackedRecipeNodeId = snap.trackedRecipeId;
            }
        }
        updateRecipeTrackerUI();
        if (isCodexOpen()) renderCodexModal(currentCategory);
    }

    function isEntryUnlocked(entryId, defaultUnlocked = false) {
        if (entryId === 'world_core') return true;
        if (unlockedSet.has(entryId)) return true;
        if (defaultUnlocked) {
            unlockedSet.add(entryId);
            return true;
        }
        return false;
    }

    function unlockEntry(entryId) {
        if (!entryId) return;
        const wasLocked = !unlockedSet.has(entryId);
        unlockedSet.add(entryId);
        const isTrackableType = entryId.startsWith('tower:') || entryId.startsWith('monster:');
        if (isTrackableType && !defaultEntryIdSet.has(entryId) && !lifetimeDiscoveredSet.has(entryId)) {
            lifetimeDiscoveredSet.add(entryId);
            saveLifetimeDiscovered();
            if (!runFirstUnlockedSet.has(entryId)) {
                runFirstUnlockedSet.add(entryId);
                runFirstUnlockedIds.push(entryId);
            }
        }
        if (trackedRecipeNodeId && entryId.startsWith('tower:')) {
            updateRecipeTrackerUI();
        }
        if (wasLocked && isCodexOpen()) {
            renderCodexModal(currentCategory);
        }
    }

    function getEntryDisplayLabel(entryId) {
        if (!entryId) return '';
        const [kind, key] = String(entryId).split(':');
        if (kind === 'tower') {
            const dict = (GameApp.data && GameApp.data.towers && GameApp.data.towers.TOWERS) || {};
            const cfg = dict[key];
            if (cfg) return `${cfg.icon || ''}${cfg.name || key}`.trim();
        } else if (kind === 'monster') {
            const mDict = (GameApp.data && GameApp.data.monsters && GameApp.data.monsters.MONSTER_DATABASE) || {};
            const mCfg = mDict[key];
            if (mCfg) return `${mCfg.icon || ''}${mCfg.name || key}`.trim();
        }
        return key || entryId;
    }

    function getRunUnlockSummary() {
        return {
            firstTimeIds: runFirstUnlockedIds.slice(),
            firstTimeCount: runFirstUnlockedIds.length,
            firstTimeLabels: runFirstUnlockedIds.map(getEntryDisplayLabel)
        };
    }

    function getCodexData() {
        return (GameApp.data && GameApp.data.codex) || {};
    }

    /**
     * 掃描目前棋盤上的 1★～4★ 塔，判斷 1★～5★ 節點哪些已被「部分滿足」或「素材就緒」
     */
    function scanBoardCraftableState() {
        const boardNodeCounts = {};
        const craftableNodeSet = new Set();
        const readyNowNodeSet = new Set();
        const presentNodeSet = new Set();

        const st = G && G.state;
        const EvoSys = GameApp.systems && GameApp.systems.evolution;
        const evoData = (GameApp.data && GameApp.data.evolutions) || {};
        const t1Rules = evoData.T1_RECIPES || evoData.T1_TO_T2_RECIPES || {};
        const t2Rules = evoData.T2_TO_T3_RULES || {};
        const t3Rules = evoData.T3_TO_T4_RULES || {};
        const t4Rules = evoData.T4_TO_T5_RULES || {};
        const tri2Rules = evoData.TRI_RECIPES_T2_TO_T3 || {};
        const tri3Rules = evoData.TRI_RECIPES_T3_TO_T4 || {};
        const primalRules = evoData.PRIMAL_RECIPES_T4_TO_T5 || {};

        if (st && Array.isArray(st.board) && !st.isGameOver && st.waveState !== 'WAITING_START') {
            for (let i = 0; i < st.board.length; i++) {
                const tower = st.board[i];
                if (!tower) continue;
                const canonicalId = (EvoSys && typeof EvoSys.normalizeNodeId === 'function')
                    ? EvoSys.normalizeNodeId(tower)
                    : tower.type;
                boardNodeCounts[canonicalId] = (boardNodeCounts[canonicalId] || 0) + 1;
                presentNodeSet.add(canonicalId);
            }
        }

        const scanPairRules = (rulesDict, isMultiOption = false) => {
            Object.keys(rulesDict).forEach((ruleKey) => {
                const rule = rulesDict[ruleKey];
                const targets = isMultiOption ? (rule && rule.options) : (rule && rule.resultType ? [rule.resultType] : null);
                if (!Array.isArray(targets) || targets.length === 0) return;
                const [ingA, ingB] = ruleKey.split('+');
                const cntA = boardNodeCounts[ingA] || 0;
                const cntB = boardNodeCounts[ingB] || 0;
                const hasPartial = cntA > 0 || cntB > 0;
                const isFullReady = ingA === ingB ? cntA >= 2 : (cntA >= 1 && cntB >= 1);
                if (isMultiOption ? hasPartial : (isFullReady || hasPartial)) {
                    targets.forEach((tid) => {
                        if (isMultiOption || hasPartial) craftableNodeSet.add(tid);
                        if (isFullReady) readyNowNodeSet.add(tid);
                    });
                }
            });
        };

        scanPairRules(t1Rules, false);
        scanPairRules(t2Rules, true);
        scanPairRules(t3Rules, false);
        scanPairRules(t4Rules, false);
        scanPairRules(tri2Rules, false);
        scanPairRules(tri3Rules, false);
        if (!(EvoSys && typeof EvoSys.hasPrimalCoreOnBoard === 'function' && EvoSys.hasPrimalCoreOnBoard())) {
            scanPairRules(primalRules, false);
        }

        return {
            boardNodeCounts,
            presentNodeSet,
            craftableNodeSet,
            readyNowNodeSet,
            boardT2Counts: boardNodeCounts,
            presentT2Set: presentNodeSet,
            craftableT3Set: craftableNodeSet,
            readyNowT3Set: readyNowNodeSet
        };
    }

    function getTrackedRecipeId() {
        return trackedRecipeNodeId;
    }

    function getIngredientDisplayName(nodeId) {
        const meta = WORLD_TREE_LAYOUT[nodeId];
        const dict = (GameApp.data && GameApp.data.towers && GameApp.data.towers.TOWERS) || {};
        const cfg = dict[nodeId] || {};
        const baseName = (GameApp.i18n && GameApp.i18n.isEnglish())
            ? getTreeNodeLabel(nodeId, meta)
            : (cfg.name || (meta && meta.label) || nodeId);
        return cfg.icon ? `${cfg.icon} ${baseName}` : baseName;
    }

    function getIngredientSubHint(nodeId) {
        const subMap = {
            steam_bud: L('🔥+❄️', 'Fire+Ice'),
            magnet_bud: L('❄️+⚡', 'Ice+Bolt'),
            plasma_bud: L('🔥+⚡', 'Fire+Bolt')
        };
        if (subMap[nodeId]) return subMap[nodeId];
        const evoData = (GameApp.data && GameApp.data.evolutions) || {};
        const t1Rules = evoData.T1_RECIPES || {};
        const pairKey = Object.keys(t1Rules).find(k => t1Rules[k] && t1Rules[k].resultType === nodeId && t1Rules[k].mode !== 'infusion_single');
        if (pairKey) {
            const [a, b] = pairKey.split('+');
            if (a === b) return `${getIngredientDisplayName(a)} ×2`;
            return `${getIngredientDisplayName(a)}+${getIngredientDisplayName(b)}`;
        }
        return '';
    }

    function findDirectRecipesForNode(targetNodeId) {
        const evoData = (GameApp.data && GameApp.data.evolutions) || {};
        const candidates = [];
        const addDict = (rules, isMultiOption = false, resolvePriority = null) => {
            if (!rules) return;
            Object.keys(rules).forEach((ruleKey) => {
                const rule = rules[ruleKey];
                if (!rule) return;
                const matched = isMultiOption
                    ? (Array.isArray(rule.options) && rule.options.includes(targetNodeId))
                    : (rule.resultType === targetNodeId);
                if (!matched) return;
                const parts = ruleKey.split('+');
                if (parts.length !== 2) return;
                const priority = typeof resolvePriority === 'function' ? resolvePriority(rule, parts) : 2;
                candidates.push({ ingredients: parts, priority, mode: rule.mode || '' });
            });
        };
        addDict(evoData.T1_RECIPES || evoData.T1_TO_T2_RECIPES, false, (r) => (r.mode === 'infusion_single' ? 0 : 3));
        addDict(evoData.T2_TO_T3_RULES, true, () => 2);
        addDict(evoData.TRI_RECIPES_T2_TO_T3, false, () => 3);
        addDict(evoData.T3_TO_T4_RULES, false, () => 2);
        addDict(evoData.TRI_RECIPES_T3_TO_T4, false, (r) => (r.mode === 'tri_ascend_t4' ? 3 : 2));
        addDict(evoData.T4_TO_T5_RULES, false, (_r, parts) => (parts[0] === parts[1] ? 3 : 2));
        addDict(evoData.PRIMAL_RECIPES_T4_TO_T5, false, (_r, parts) => (parts[0] === parts[1] ? 3 : 2));
        return candidates;
    }

    function computeRecipeTrackerStatus(targetNodeId = trackedRecipeNodeId) {
        if (!targetNodeId || !WORLD_TREE_LAYOUT[targetNodeId] || targetNodeId === 'world_core') return null;
        const meta = WORLD_TREE_LAYOUT[targetNodeId];
        const codexData = getCodexData();
        const custom = (codexData.CODEX_ENTRIES && codexData.CODEX_ENTRIES.towers && codexData.CODEX_ENTRIES.towers[targetNodeId]) || {};
        const dict = (GameApp.data && GameApp.data.towers && GameApp.data.towers.TOWERS) || {};
        const tCfg = dict[targetNodeId] || {};
        const unlocked = isEntryUnlocked(`tower:${targetNodeId}`, Boolean(custom.defaultUnlocked));
        const tierNum = meta.tier || Number(tCfg.nodeTier) || 1;
        const starStr = '★'.repeat(Math.max(1, Math.min(5, tierNum)));
        const branchEnMap = { '神': '5★ Scion', '三': 'Tri', '核': 'Core' };
        const lockedBranch = meta.branch ? L(meta.branch, branchEnMap[meta.branch] || meta.branch) : '';
        const lockedLabel = lockedBranch ? `${lockedBranch} ??? (${starStr})` : `??? (${starStr})`;
        const displayTargetName = unlocked
            ? `${tCfg.icon ? `${tCfg.icon} ` : ''}${getTreeNodeLabel(targetNodeId, meta)}`
            : lockedLabel;

        const scanState = scanBoardCraftableState();
        const boardCounts = scanState.boardNodeCounts || {};
        const isBaseBud = ['fire_bud', 'ice_bud', 'thunder_bud'].includes(targetNodeId);
        if ((boardCounts[targetNodeId] || 0) > 0) {
            return {
                targetNodeId,
                displayTargetName,
                unlocked,
                status: 'completed',
                haveItems: [{ id: targetNodeId, label: getIngredientDisplayName(targetNodeId), have: boardCounts[targetNodeId], need: 1 }],
                missingItems: [],
                summaryZh: `場上已持有 ${boardCounts[targetNodeId]} 座，可直接實戰或繼續升階`,
                summaryEn: `${boardCounts[targetNodeId]} on board · Ready`
            };
        }
        if (targetNodeId === 'primal_core') {
            const EvoSys = GameApp.systems && GameApp.systems.evolution;
            if (EvoSys && typeof EvoSys.hasPrimalCoreOnBoard === 'function' && EvoSys.hasPrimalCoreOnBoard()) {
                return {
                    targetNodeId,
                    displayTargetName,
                    unlocked,
                    status: 'completed',
                    haveItems: [],
                    missingItems: [],
                    summaryZh: '場上已有唯一 5★ 原初之核',
                    summaryEn: 'Primal Core already on board'
                };
            }
        }
        if (isBaseBud) {
            return {
                targetNodeId,
                displayTargetName,
                unlocked,
                status: 'shop',
                haveItems: [],
                missingItems: [{ id: targetNodeId, label: getIngredientDisplayName(targetNodeId), need: 1, have: 0, subHint: '' }],
                summaryZh: `從下方商店召喚 ${getIngredientDisplayName(targetNodeId)}`,
                summaryEn: `Summon ${getIngredientDisplayName(targetNodeId)} from shop`
            };
        }

        const candidates = findDirectRecipesForNode(targetNodeId);
        if (candidates.length === 0) return null;

        let bestPlan = null;
        candidates.forEach((cand) => {
            const [ingA, ingB] = cand.ingredients;
            const needCounts = {};
            needCounts[ingA] = (needCounts[ingA] || 0) + 1;
            needCounts[ingB] = (needCounts[ingB] || 0) + 1;
            const haveItems = [];
            const missingItems = [];
            let totalNeed = 0;
            let totalHave = 0;
            Object.keys(needCounts).forEach((id) => {
                const need = needCounts[id];
                const have = Math.min(need, boardCounts[id] || 0);
                totalNeed += need;
                totalHave += have;
                const label = getIngredientDisplayName(id);
                if (have > 0) haveItems.push({ id, label, have, need });
                if (have < need) missingItems.push({ id, label, have, need, missing: need - have, subHint: getIngredientSubHint(id) });
            });
            const missingTotal = Math.max(0, totalNeed - totalHave);
            const score = -missingTotal * 100 + cand.priority * 10 + totalHave;
            if (!bestPlan || score > bestPlan.score) {
                bestPlan = { score, haveItems, missingItems, missingTotal, ingredients: cand.ingredients };
            }
        });

        if (!bestPlan) return null;
        if (bestPlan.missingTotal === 0) {
            return {
                targetNodeId,
                displayTargetName,
                unlocked,
                status: 'ready',
                haveItems: bestPlan.haveItems,
                missingItems: [],
                summaryZh: '素材已齊全！拖曳場上兩塔即可融合',
                summaryEn: 'Materials ready! Drag & merge on board'
            };
        }

        const missingText = bestPlan.missingItems.map((it) => {
            const qty = it.missing > 1 ? ` ×${it.missing}` : '';
            return `${it.label}${qty}`;
        }).join(' + ');
        return {
            targetNodeId,
            displayTargetName,
            unlocked,
            status: 'missing',
            haveItems: bestPlan.haveItems,
            missingItems: bestPlan.missingItems,
            summaryZh: `還缺：${missingText}`,
            summaryEn: `Need: ${missingText}`
        };
    }

    function updateRecipeTrackerUI() {
        if (typeof document === 'undefined') return;
        const sideBox = document.getElementById('side-recipe-tracker');
        const sideTargetEl = document.getElementById('side-tracker-target');
        const sideMissingEl = document.getElementById('side-tracker-missing');
        const pillBox = document.getElementById('recipe-tracker-pill');
        const pillOpenBtn = document.getElementById('recipe-tracker-pill-open');

        const st = G && G.state;
        const activeMatch = Boolean(st && st.waveState !== 'WAITING_START' && !st.isGameOver);
        const status = (activeMatch && trackedRecipeNodeId) ? computeRecipeTrackerStatus(trackedRecipeNodeId) : null;

        if (!status) {
            if (sideBox) sideBox.classList.add('hidden');
            if (pillBox) pillBox.classList.add('hidden');
            return;
        }

        const isReady = status.status === 'ready' || status.status === 'completed';
        if (sideBox) {
            sideBox.classList.remove('hidden');
            sideBox.classList.toggle('is-ready', isReady);
        }
        if (sideTargetEl) {
            sideTargetEl.innerText = status.displayTargetName;
        }
        if (sideMissingEl) {
            sideMissingEl.innerHTML = '';
            status.haveItems.forEach((it) => {
                const chip = document.createElement('span');
                chip.className = 'side-tracker-chip is-have';
                chip.innerText = `✓ ${it.label}${it.have > 1 ? ` ×${it.have}` : ''}`;
                sideMissingEl.appendChild(chip);
            });
            if (status.status === 'ready') {
                const chip = document.createElement('span');
                chip.className = 'side-tracker-chip is-ready';
                chip.innerText = L('✨ 拖曳兩塔即可合成！', '✨ Ready to merge!');
                sideMissingEl.appendChild(chip);
            } else if (status.status === 'completed') {
                const chip = document.createElement('span');
                chip.className = 'side-tracker-chip is-ready';
                chip.innerText = L(status.summaryZh, status.summaryEn);
                sideMissingEl.appendChild(chip);
            } else {
                status.missingItems.forEach((it) => {
                    const chip = document.createElement('span');
                    chip.className = 'side-tracker-chip is-missing';
                    const qty = it.missing > 1 ? ` ×${it.missing}` : '';
                    const hint = it.subHint ? ` (${it.subHint})` : '';
                    chip.innerText = `${L('缺 ', 'Need ')}${it.label}${qty}${hint}`;
                    sideMissingEl.appendChild(chip);
                });
            }
        }
        if (pillBox) {
            pillBox.classList.remove('hidden');
            pillBox.classList.toggle('is-ready', isReady);
        }
        if (pillOpenBtn) {
            const msg = L(status.summaryZh, status.summaryEn);
            pillOpenBtn.innerText = `📌 ${status.displayTargetName} · ${msg}`;
            pillOpenBtn.title = `${status.displayTargetName} — ${msg}`;
        }
    }

    function setTrackedRecipe(nodeId = null) {
        if (!nodeId || nodeId === 'world_core' || !WORLD_TREE_LAYOUT[nodeId] || trackedRecipeNodeId === nodeId) {
            trackedRecipeNodeId = null;
            if (nodeId && WORLD_TREE_LAYOUT[nodeId]) {
                selectedTreeNodeId = nodeId;
                preserveTreeSelectionOnce = true;
            }
        } else {
            trackedRecipeNodeId = nodeId;
            selectedTreeNodeId = nodeId;
            preserveTreeSelectionOnce = true;
        }
        updateRecipeTrackerUI();
        if (isCodexOpen() && currentCategory === 'fusion') {
            renderCodexModal('fusion');
        }
        return trackedRecipeNodeId;
    }

    /**
     * 繪製單條 World Tree Bezier SVG 路徑
     */
    function buildTreeEdgePathD(edge) {
        const p1 = WORLD_TREE_LAYOUT[edge.from];
        const p2 = WORLD_TREE_LAYOUT[edge.to];
        if (!p1 || !p2) return '';

        if (edge.arcOffsetY) {
            const mx = (p1.x + p2.x) * 0.5;
            const my = (p1.y + p2.y) * 0.5 + edge.arcOffsetY;
            return `M ${p1.x} ${p1.y} Q ${mx} ${my} ${p2.x} ${p2.y}`;
        }

        const midY = (p1.y + p2.y) * 0.5;
        return `M ${p1.x} ${p1.y} C ${p1.x} ${midY} ${p2.x} ${midY} ${p2.x} ${p2.y}`;
    }

    /**
     * 更新世界樹詳情區（底部固定高度資訊面板）
     */
    function renderWorldTreeDetail(detailEl, nodeId, scanState) {
        if (!detailEl) return;
        const codexData = getCodexData();
        const entries = codexData.CODEX_ENTRIES || {};
        const towersDict = (GameApp.data && GameApp.data.towers && GameApp.data.towers.TOWERS) || {};
        const nodeMeta = WORLD_TREE_LAYOUT[nodeId];

        if (!nodeMeta || nodeId === 'world_core') {
            const totalUnlocked = Object.keys(WORLD_TREE_LAYOUT).filter(id => id !== 'world_core' && isEntryUnlocked(`tower:${id}`, false)).length;
            const TreeSys = GameApp.systems && GameApp.systems.tree;
            const EconSys = GameApp.systems && GameApp.systems.economy;
            const rootLv = TreeSys && typeof TreeSys.getTreasureRootLevel === 'function' ? TreeSys.getTreasureRootLevel() : 0;
            const curRootSpec = TreeSys && typeof TreeSys.getTreasureRootSpec === 'function'
                ? TreeSys.getTreasureRootSpec(rootLv)
                : { level: 0, name: '未啟用', nameEn: 'Dormant', sellRefundRate: 0.70 };
            const nextRootSpec = TreeSys && typeof TreeSys.getNextTreasureRootSpec === 'function' ? TreeSys.getNextTreasureRootSpec() : null;
            const curWave = (G && G.state && G.state.currentWave) || 1;
            const curGold = (G && G.state && G.state.currentGold) || 0;
            const estIncome = EconSys && typeof EconSys.computeRootWaveIncome === 'function'
                ? EconSys.computeRootWaveIncome(rootLv, curGold, curWave)
                : { totalGain: 0, waveCap: 22 + 8 * curWave };
            const refundPct = Math.round((curRootSpec.sellRefundRate || 0.70) * 100);
            const canUpgradeNow = Boolean(nextRootSpec && curGold >= nextRootSpec.cost && G && G.callbacks && G.callbacks.isMatchPhaseActive());

            detailEl.className = 'wt-detail-card is-core';
            detailEl.innerHTML = `
                <div class="wt-detail-portrait core-emblem" aria-hidden="true">🌳</div>
                <div class="wt-detail-body">
                    <div class="wt-detail-top">
                        <span class="wt-detail-title">${L('世界樹原核 · 聚寶根鬚', 'World Tree Core · Treasure Roots')}</span>
                        <span class="wt-detail-tag num">${L(`聚寶根鬚 Lv.${rootLv} / Lv.3`, `Treasure Roots Lv.${rootLv} / Lv.3`)}</span>
                        <span class="wt-detail-tag num">${L(`出售退費 ${refundPct}%`, `Sell Refund ${refundPct}%`)}</span>
                        <span class="wt-detail-tag num">${L(`本波預估 +${estIncome.totalGain} 💰（軟上限 ${estIncome.waveCap} 💰）`, `Est. +${estIncome.totalGain} 💰 (Cap ${estIncome.waveCap} 💰)`)}</span>
                        <span class="wt-detail-tag num">${L(`已喚醒枝脈：${totalUnlocked} / 55`, `Awakened Nodes: ${totalUnlocked} / 55`)}</span>
                    </div>
                    <div class="wt-detail-row">${L(
                        '<strong>聚寶根鬚（Lv.0 → Lv.3）：</strong>Lv.1 汲取根鬚（45 💰 ➔ 每波 +15 💰）｜Lv.2 黃金根脈（75 💰 ➔ 每波 +32 💰 · 退費 80%）｜Lv.3 複利樹心（110 💰 ➔ 每波 +42 💰 ＋ 8% 利息，上限 +35 💰，單波軟上限 22 + 8w）',
                        '<strong>Treasure Roots (Lv.0 → Lv.3):</strong> Lv.1 Siphon (45 💰 ➔ +15 💰/wave) | Lv.2 Golden (75 💰 ➔ +32 💰/wave · 80% refund) | Lv.3 Compound (110 💰 ➔ +42 💰 + 8% interest, cap +35 💰, wave cap 22 + 8w)'
                    )}</div>
                    <div class="wt-detail-row">
                        <button type="button" id="wt-core-root-upgrade-btn" class="tree-root-upgrade-btn num" ${canUpgradeNow ? '' : 'disabled'}>
                            ${nextRootSpec
                                ? L(`升級 Lv.${nextRootSpec.level} ${nextRootSpec.name} (${nextRootSpec.cost} 💰)`, `Upgrade Lv.${nextRootSpec.level} ${nextRootSpec.nameEn || nextRootSpec.name} (${nextRootSpec.cost} 💰)`)
                                : L('已達最高等級 Lv.3 複利樹心', 'Max Level Reached (Lv.3)')}
                        </button>
                    </div>
                </div>
            `;
            const upBtn = detailEl.querySelector('#wt-core-root-upgrade-btn');
            if (upBtn && TreeSys && typeof TreeSys.upgradeTreasureRoot === 'function') {
                upBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const res = TreeSys.upgradeTreasureRoot();
                    if (res && res.ok) {
                        renderWorldTreeDetail(detailEl, 'world_core', scanState);
                    }
                });
            }
            return;
        }

        const tCfg = towersDict[nodeId] || {};
        const custom = (entries.towers && entries.towers[nodeId]) || codexData.buildFallbackTowerCard(nodeId, tCfg);
        const unlocked = isEntryUnlocked(`tower:${nodeId}`, Boolean(custom.defaultUnlocked));
        const isReadyNow = scanState.readyNowNodeSet.has(nodeId);
        const isCraftable = scanState.craftableNodeSet.has(nodeId);
        const tierNum = nodeMeta.tier || Number(tCfg.nodeTier) || 1;
        const defaultShares = [1, 1, 2, 4, 8, 16];
        const costMult = tCfg.costShare ? `${tCfg.costShare}U` : `${defaultShares[tierNum] || 1}U`;
        const starStr = '★'.repeat(Math.max(1, Math.min(5, tierNum)));

        detailEl.className = `wt-detail-card family-${nodeMeta.family}${unlocked ? '' : ' is-locked'}${isCraftable ? ' is-craftable' : ''}`;

        const statusBadge = unlocked
            ? `<span class="codex-status-badge unlocked">${L('已解鎖', 'Unlocked')}</span>`
            : `<span class="codex-status-badge locked">${L('未解鎖', 'Locked')}</span>`;
        const craftBadge = isReadyNow
            ? `<span class="wt-detail-craft-badge ready">${L('素材就緒 · 可直接融合', 'Materials Ready · Craftable')}</span>`
            : (isCraftable ? `<span class="wt-detail-craft-badge">${L('場上已有素材 · 可進化方向', 'Materials on Board')}</span>` : '');

        const portraitWrap = document.createElement('div');
        portraitWrap.className = 'wt-detail-portrait';
        const canvasEl = document.createElement('canvas');
        canvasEl.width = 64;
        canvasEl.height = 64;
        canvasEl.dataset.size = '64';
        canvasEl.setAttribute('aria-hidden', 'true');
        portraitWrap.appendChild(canvasEl);
        if (!unlocked) {
            const qMark = document.createElement('span');
            qMark.className = 'wt-detail-q';
            qMark.innerText = '?';
            portraitWrap.appendChild(qMark);
        }

        const isTracked = trackedRecipeNodeId === nodeId;
        const trackBtnLabel = isTracked ? L('📌 追蹤中 ✓', '📌 Tracking ✓') : L('📌 追蹤配方', '📌 Track Recipe');
        const trackerInfo = computeRecipeTrackerStatus(nodeId);
        const trackerHintText = trackerInfo
            ? L(trackerInfo.summaryZh, trackerInfo.summaryEn)
            : L('點擊追蹤配方，戰鬥時將顯示還缺少的素材。', 'Track this recipe to see missing materials during battle.');
        const trackActionHtml = `<button type="button" id="wt-track-recipe-btn" class="wt-track-btn${isTracked ? ' is-tracking' : ''}" aria-pressed="${isTracked ? 'true' : 'false'}">${trackBtnLabel}</button>`;
        const trackerRowHtml = `<div class="wt-detail-row wt-detail-tracker-row${trackerInfo && trackerInfo.status === 'ready' ? ' is-ready' : ''}"><strong>${L('素材追蹤：', 'Materials: ')}</strong><span class="num">${trackerHintText}</span></div>`;

        const bodyEl = document.createElement('div');
        bodyEl.className = 'wt-detail-body';
        if (unlocked) {
            bodyEl.innerHTML = `
                <div class="wt-detail-top">
                    <span class="wt-detail-title">${custom.title || tCfg.name || nodeId} <span class="num">${starStr}</span></span>
                    <span class="wt-detail-tag num">Tier ${tierNum} · ${L('成本', 'Cost')} ${costMult}</span>
                    ${statusBadge}${craftBadge}${trackActionHtml}
                </div>
                ${trackerRowHtml}
                <div class="wt-detail-row"><strong>${L('進化合成路徑：', 'Recipe: ')}</strong><span class="num">${custom.formula || tCfg.lineagePath || L('基礎召喚', 'Base Summon')}</span></div>
                <div class="wt-detail-row"><strong>${L('核心機制：', 'Mechanic: ')}</strong><span class="num">${custom.mech || custom.desc || ''}</span></div>
                <div class="wt-detail-row"><strong>${L('推薦搭配：', 'Synergy: ')}</strong>${custom.synergy || ''}</div>
            `;
        } else {
            bodyEl.innerHTML = `
                <div class="wt-detail-top">
                    <span class="wt-detail-title">${L('？？？ · 未知世界樹節點', '??? · Unknown Node')} <span class="num">${starStr}</span></span>
                    <span class="wt-detail-tag num">Tier ${tierNum} · ${L('成本', 'Cost')} ${costMult}</span>
                    ${statusBadge}${craftBadge}${trackActionHtml}
                </div>
                ${trackerRowHtml}
                <div class="wt-detail-row"><strong>${L('解鎖條件：', 'Unlock Rule: ')}</strong>${custom.unlockRule || L('於戰場合成此防禦塔即可點亮枝脈。', 'Synthesize this tower in battle to unlock.')}</div>
                <div class="wt-detail-row">${isCraftable ? L('⚡ 戰術提醒：當前場上已持有可通往此冠枝的素材，於棋盤拖曳合成即可於本局點亮！', '⚡ Ready: You already have matching towers on board—merge them to unlock!') : L('每局開局圖譜皆重新探索；本局成功合成該防禦塔後即立刻點亮。', 'Codex resets each run; synthesize this tower to illuminate the node.')}</div>
            `;
        }

        detailEl.innerHTML = '';
        detailEl.appendChild(portraitWrap);
        detailEl.appendChild(bodyEl);

        const trackBtn = detailEl.querySelector('#wt-track-recipe-btn');
        if (trackBtn) {
            trackBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                setTrackedRecipe(nodeId);
            });
        }

        if (GameApp.renderer && typeof GameApp.renderer.drawPortrait === 'function') {
            GameApp.renderer.drawPortrait(canvasEl, 'tower', nodeId, {
                size: 64,
                tier: tierNum,
                silhouette: !unlocked
            });
        }
    }

    /**
     * 預計算世界樹每個節點的完整祖先與後代血脈集合（供懸停／點擊聯動高亮）
     */
    function collectBloodlineSet(targetId) {
        const set = new Set();
        if (!targetId) return set;
        set.add(targetId);

        const upQueue = [targetId];
        while (upQueue.length > 0) {
            const cur = upQueue.shift();
            for (let i = 0; i < WORLD_TREE_EDGES.length; i++) {
                const e = WORLD_TREE_EDGES[i];
                if (e.to === cur && !set.has(e.from)) {
                    set.add(e.from);
                    upQueue.push(e.from);
                }
            }
        }

        const downQueue = [targetId];
        while (downQueue.length > 0) {
            const cur = downQueue.shift();
            for (let i = 0; i < WORLD_TREE_EDGES.length; i++) {
                const e = WORLD_TREE_EDGES[i];
                if (e.from === cur && !set.has(e.to)) {
                    set.add(e.to);
                    downQueue.push(e.to);
                }
            }
        }
        return set;
    }

    /**
     * 渲染動態可拖曳／縮放「元素世界樹演化圖譜」(#tree-viewport 1320×680 扇形樹冠)
     */
    function renderWorldTreeCodex(treeShellEl) {
        if (!treeShellEl) return;
        treeShellEl.innerHTML = '';

        const scanState = scanBoardCraftableState();
        const craftableNames = Array.from(scanState.craftableNodeSet)
            .map(id => getTreeNodeLabel(id, WORLD_TREE_LAYOUT[id]));

        const bannerEl = document.createElement('div');
        bannerEl.className = `wt-tactical-banner${scanState.craftableNodeSet.size > 0 ? ' has-matches' : ''}`;
        if (scanState.craftableNodeSet.size > 0) {
            bannerEl.innerHTML = L(
                `<span class="wt-banner-dot"></span><span class="num">場上素材偵測：可朝 <strong>${craftableNames.join('、')}</strong> 方向融合（琥珀金框標示）</span>`,
                `<span class="wt-banner-dot"></span><span class="num">Craftable paths detected: <strong>${craftableNames.join(', ')}</strong> (highlighted in amber)</span>`
            );
        } else {
            bannerEl.innerText = L('點擊或懸停節點，高亮完整進化血脈與詳細數值。', 'Tap or hover a node to inspect its full lineage and stats.');
        }
        treeShellEl.appendChild(bannerEl);

        const viewportEl = document.createElement('div');
        viewportEl.id = 'tree-viewport';
        viewportEl.className = 'tree-viewport';

        const worldCanvasEl = document.createElement('div');
        worldCanvasEl.className = 'tree-world-canvas';
        worldCanvasEl.style.width = `${TREE_VIEW_W}px`;
        worldCanvasEl.style.height = `${TREE_VIEW_H}px`;

        const controlsEl = document.createElement('div');
        controlsEl.className = 'wt-viewport-controls';
        const zoomBadgeEl = document.createElement('span');
        zoomBadgeEl.className = 'wt-zoom-badge num';
        zoomBadgeEl.innerText = '100%';
        const resetViewBtn = document.createElement('button');
        resetViewBtn.type = 'button';
        resetViewBtn.id = 'wt-reset-view-btn';
        resetViewBtn.className = 'wt-reset-view-btn';
        resetViewBtn.innerText = L('重置視角', 'Reset View');
        controlsEl.appendChild(zoomBadgeEl);
        controlsEl.appendChild(resetViewBtn);
        viewportEl.appendChild(controlsEl);

        // 建立 SVG 樹枝層（移除舊版格線，保留乾淨石板畫布與扇形有機枝脈）
        const svgNS = 'http://www.w3.org/2000/svg';
        const svgEl = document.createElementNS(svgNS, 'svg');
        svgEl.setAttribute('class', 'wt-edge-svg');
        svgEl.setAttribute('viewBox', `0 0 ${TREE_VIEW_W} ${TREE_VIEW_H}`);
        svgEl.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        svgEl.setAttribute('aria-hidden', 'true');

        const orderedEdges = WORLD_TREE_EDGES.slice().sort((a, b) => {
            const score = (e) => {
                if (scanState.craftableNodeSet.has(e.to)) return 3;
                if (isEntryUnlocked(`tower:${e.to}`, ['fire_bud', 'ice_bud', 'thunder_bud'].includes(e.to))) return 2;
                return e.kind === 'directed' ? 0 : 1;
            };
            return score(a) - score(b);
        });

        const edgeRecords = [];
        orderedEdges.forEach((edge, idx) => {
            const toMeta = WORLD_TREE_LAYOUT[edge.to];
            const isBaseBud = ['fire_bud', 'ice_bud', 'thunder_bud'].includes(edge.to);
            const toUnlocked = Boolean(toMeta && (isBaseBud || isEntryUnlocked(`tower:${edge.to}`, false)));
            const isCraftEdge = scanState.craftableNodeSet.has(edge.to)
                && (scanState.presentNodeSet.has(edge.from) || edge.from === 'world_core');

            const pathD = buildTreeEdgePathD(edge);
            let strokeColor = '#46544C';
            let strokeWidth = edge.kind === 'directed' ? 1.8 : 2.6;
            let opacity = edge.kind === 'directed' ? '0.45' : '0.86';

            if (isCraftEdge) {
                strokeColor = '#D97724';
                strokeWidth = 3.6;
                opacity = '1';
            } else if (toUnlocked && edge.kind !== 'directed') {
                strokeColor = FAMILY_STROKE_COLORS[edge.family] || '#B8C2BC';
                strokeWidth = 3.0;
                opacity = '0.94';
            }

            const edgeGroup = document.createElementNS(svgNS, 'g');
            edgeGroup.setAttribute('class', `wt-edge-group${toUnlocked ? ' is-unlocked' : ''}${isCraftEdge ? ' is-craftable' : ''}`);
            edgeGroup.dataset.edgeFrom = edge.from;
            edgeGroup.dataset.edgeTo = edge.to;

            const pathEl = document.createElementNS(svgNS, 'path');
            pathEl.setAttribute('d', pathD);
            pathEl.setAttribute('fill', 'none');
            pathEl.setAttribute('stroke', strokeColor);
            pathEl.setAttribute('stroke-width', String(strokeWidth));
            pathEl.setAttribute('stroke-opacity', opacity);
            pathEl.setAttribute('stroke-linecap', 'round');
            if (edge.kind === 'directed') {
                pathEl.setAttribute('stroke-dasharray', '6 6');
                pathEl.setAttribute('class', 'wt-edge-path wt-edge-directed');
            } else {
                pathEl.setAttribute('pathLength', '100');
                pathEl.setAttribute('class', 'wt-edge-path wt-edge-grow');
                pathEl.style.animationDelay = `${Math.min(280, idx * 14)}ms`;
            }
            edgeGroup.appendChild(pathEl);

            // 已點亮或可進化主幹上疊加向上流動靈液虛線光流
            if (edge.kind !== 'directed' && (toUnlocked || isCraftEdge)) {
                const sapEl = document.createElementNS(svgNS, 'path');
                sapEl.setAttribute('d', pathD);
                sapEl.setAttribute('fill', 'none');
                sapEl.setAttribute('stroke', isCraftEdge ? '#F4F1EA' : strokeColor);
                sapEl.setAttribute('stroke-width', isCraftEdge ? '2.2' : '1.8');
                sapEl.setAttribute('stroke-linecap', 'round');
                sapEl.setAttribute('class', 'wt-sap-flow');
                edgeGroup.appendChild(sapEl);
            }

            svgEl.appendChild(edgeGroup);
            edgeRecords.push({ edge, edgeGroup });
        });
        worldCanvasEl.appendChild(svgEl);

        const nodesLayer = document.createElement('div');
        nodesLayer.className = 'wt-nodes-layer';

        const detailEl = document.createElement('div');
        detailEl.className = 'wt-detail-card';

        const codexEntries = (getCodexData().CODEX_ENTRIES && getCodexData().CODEX_ENTRIES.towers) || {};
        const nodeButtons = [];

        let bloodlineFocusId = null;
        const applyBloodlineHighlight = (activeId) => {
            if (!activeId) {
                nodeButtons.forEach((btn) => btn.classList.remove('is-bloodline', 'is-dimmed'));
                edgeRecords.forEach(({ edgeGroup }) => edgeGroup.classList.remove('is-bloodline', 'is-dimmed'));
                return;
            }
            const lineageSet = collectBloodlineSet(activeId);
            nodeButtons.forEach((btn) => {
                const inLineage = lineageSet.has(btn.dataset.nodeId);
                btn.classList.toggle('is-bloodline', inLineage);
                btn.classList.toggle('is-dimmed', !inLineage);
            });
            edgeRecords.forEach(({ edge, edgeGroup }) => {
                const inLineage = lineageSet.has(edge.from) && lineageSet.has(edge.to);
                edgeGroup.classList.toggle('is-bloodline', inLineage);
                edgeGroup.classList.toggle('is-dimmed', !inLineage);
            });
        };

        let suppressNodeClick = false;

        Object.keys(WORLD_TREE_LAYOUT).forEach((nodeId) => {
            const meta = WORLD_TREE_LAYOUT[nodeId];
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.dataset.nodeId = nodeId;
            btn.style.left = `${(meta.x / TREE_VIEW_W) * 100}%`;
            btn.style.top = `${(meta.y / TREE_VIEW_H) * 100}%`;
            btn.style.animationDelay = `${(meta.tier || 0) * 55}ms`;

            if (nodeId === 'world_core') {
                btn.className = `wt-node wt-node-core wt-node-pop${selectedTreeNodeId === 'world_core' ? ' is-selected' : ''}`;
                btn.innerHTML = `<span class="wt-core-icon">🌳</span><span class="wt-node-caption">${getTreeNodeLabel('world_core', meta)}</span>`;
            } else {
                const entryInfo = codexEntries[nodeId] || {};
                const isBaseBud = ['fire_bud', 'ice_bud', 'thunder_bud'].includes(nodeId);
                const unlocked = isEntryUnlocked(`tower:${nodeId}`, Boolean(entryInfo.defaultUnlocked) || isBaseBud);
                const isCraftable = scanState.craftableNodeSet.has(nodeId);
                const isReadyNow = scanState.readyNowNodeSet.has(nodeId);
                const isPresentOnBoard = scanState.presentNodeSet.has(nodeId);

                btn.className = [
                    'wt-node',
                    'wt-node-pop',
                    `wt-tier-${meta.tier}`,
                    meta.isTransfer ? 'wt-transfer-bud' : '',
                    `wt-family-${meta.family}`,
                    unlocked ? 'is-unlocked' : 'is-locked',
                    isCraftable ? 'wt-craftable' : '',
                    isReadyNow ? 'wt-ready-now' : '',
                    isPresentOnBoard ? 'wt-on-board' : '',
                    trackedRecipeNodeId === nodeId ? 'is-tracked' : '',
                    selectedTreeNodeId === nodeId ? 'is-selected' : ''
                ].filter(Boolean).join(' ');

                const canvasWrap = document.createElement('span');
                canvasWrap.className = 'wt-node-icon-box';
                const cSize = meta.tier >= 3 ? 34 : 38;
                const canvasEl = document.createElement('canvas');
                canvasEl.width = cSize;
                canvasEl.height = cSize;
                canvasEl.dataset.size = String(cSize);
                canvasEl.setAttribute('aria-hidden', 'true');
                canvasWrap.appendChild(canvasEl);

                if (!unlocked) {
                    const qSpan = document.createElement('span');
                    qSpan.className = 'wt-locked-q';
                    qSpan.innerText = '?';
                    canvasWrap.appendChild(qSpan);
                }
                if (isPresentOnBoard && !isBaseBud) {
                    const bTag = document.createElement('span');
                    bTag.className = 'wt-board-pip num';
                    bTag.innerText = String(scanState.boardNodeCounts[nodeId] || 1);
                    bTag.title = L('當前棋盤持有數量', 'Count on board');
                    canvasWrap.appendChild(bTag);
                }
                if (trackedRecipeNodeId === nodeId) {
                    const pinTag = document.createElement('span');
                    pinTag.className = 'wt-track-pin';
                    pinTag.setAttribute('aria-hidden', 'true');
                    pinTag.innerText = '📌';
                    canvasWrap.appendChild(pinTag);
                }

                const cap = document.createElement('span');
                cap.className = 'wt-node-caption num';
                const branchEnMap = { '神': '5★ Scion', '三': 'Tri', '核': 'Core' };
                const branchLabel = meta.branch ? L(meta.branch, branchEnMap[meta.branch] || meta.branch) : '';
                const displayNodeLabel = unlocked ? getTreeNodeLabel(nodeId, meta) : (branchLabel ? `${branchLabel} ???` : '???');
                cap.innerText = displayNodeLabel;
                btn.setAttribute('aria-label', unlocked
                    ? `${(codexEntries[nodeId] && codexEntries[nodeId].title) || displayNodeLabel}`
                    : `${L('未解鎖節點', 'Locked Node')} · ${displayNodeLabel}`);

                btn.appendChild(canvasWrap);
                btn.appendChild(cap);

                if (GameApp.renderer && typeof GameApp.renderer.drawPortrait === 'function') {
                    GameApp.renderer.drawPortrait(canvasEl, 'tower', nodeId, {
                        size: cSize,
                        tier: meta.tier,
                        silhouette: !unlocked
                    });
                }
            }

            btn.addEventListener('mouseenter', () => applyBloodlineHighlight(nodeId));
            btn.addEventListener('mouseleave', () => applyBloodlineHighlight(bloodlineFocusId));
            btn.addEventListener('click', (e) => {
                if (suppressNodeClick) {
                    e.preventDefault();
                    return;
                }
                e.stopPropagation();
                selectedTreeNodeId = nodeId;
                bloodlineFocusId = bloodlineFocusId === nodeId ? null : nodeId;
                nodeButtons.forEach(el => el.classList.toggle('is-selected', el.dataset.nodeId === selectedTreeNodeId));
                applyBloodlineHighlight(bloodlineFocusId);
                renderWorldTreeDetail(detailEl, selectedTreeNodeId, scanState);
            });

            nodesLayer.appendChild(btn);
            nodeButtons.push(btn);
        });

        worldCanvasEl.appendChild(nodesLayer);
        viewportEl.appendChild(worldCanvasEl);
        treeShellEl.appendChild(viewportEl);

        const gestureHintEl = document.createElement('div');
        gestureHintEl.className = 'wt-gesture-hint';
        gestureHintEl.innerText = L('支援拖曳平移、雙指縮放查看完整樹狀圖', 'Drag to pan · Pinch or zoom to view full tree');
        treeShellEl.appendChild(gestureHintEl);

        // 平移與縮放視窗狀態（支援滑鼠拖曳、觸控平移／雙指縮放與滾輪縮放）
        const viewState = {
            scale: 0.55, panX: 0, panY: 0,
            dragging: false, startX: 0, startY: 0, origPanX: 0, origPanY: 0,
            pinching: false, pinchDist: 0, pinchScale: 0.55, pinchMidX: 0, pinchMidY: 0
        };

        const getMinScale = (vpW, vpH = 380) => {
            const fit = Math.min((Math.max(240, vpW) - 24) / TREE_VIEW_W, (Math.max(180, vpH) - 24) / TREE_VIEW_H);
            return Math.max(0.18, Math.min(0.45, fit * 0.85));
        };

        const clampView = () => {
            const vpW = viewportEl.clientWidth || 860;
            const vpH = viewportEl.clientHeight || 420;
            const contentW = TREE_VIEW_W * viewState.scale;
            const contentH = TREE_VIEW_H * viewState.scale;
            const pad = vpW < 640 ? 28 : 48;

            if (contentW <= vpW) {
                viewState.panX = (vpW - contentW) * 0.5;
            } else {
                viewState.panX = Math.max(vpW - contentW - pad, Math.min(pad, viewState.panX));
            }
            if (contentH <= vpH) {
                viewState.panY = (vpH - contentH) * 0.5;
            } else {
                viewState.panY = Math.max(vpH - contentH - pad, Math.min(pad, viewState.panY));
            }
        };

        const applyViewTransform = () => {
            clampView();
            worldCanvasEl.style.transform = `translate3d(${Math.round(viewState.panX)}px, ${Math.round(viewState.panY)}px, 0) scale(${viewState.scale.toFixed(3)})`;
            zoomBadgeEl.innerText = `${Math.round(viewState.scale * 100)}%`;
        };

        const fitToViewport = () => {
            const vpW = viewportEl.clientWidth;
            const vpH = viewportEl.clientHeight;
            if (!vpW || !vpH) {
                if (typeof requestAnimationFrame === 'function') requestAnimationFrame(fitToViewport);
                return;
            }
            const padX = vpW < 640 ? 16 : 28;
            const padY = vpW < 640 ? 16 : 24;
            const fitScale = Math.min((vpW - padX) / TREE_VIEW_W, (vpH - padY) / TREE_VIEW_H);
            viewState.scale = Math.max(0.18, Math.min(1.25, fitScale));
            viewState.panX = (vpW - TREE_VIEW_W * viewState.scale) * 0.5;
            viewState.panY = (vpH - TREE_VIEW_H * viewState.scale) * 0.5;
            applyViewTransform();
        };
        activeTreeFitFn = fitToViewport;

        resetViewBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            fitToViewport();
        });

        const handlePanMove = (clientX, clientY) => {
            if (!viewState.dragging) return;
            const dx = clientX - viewState.startX;
            const dy = clientY - viewState.startY;
            if (Math.hypot(dx, dy) > 5) suppressNodeClick = true;
            viewState.panX = viewState.origPanX + dx;
            viewState.panY = viewState.origPanY + dy;
            applyViewTransform();
        };

        const onWindowMouseMove = (e) => handlePanMove(e.clientX, e.clientY);
        const endPan = () => {
            if (!viewState.dragging && !viewState.pinching) return;
            viewState.dragging = false;
            viewState.pinching = false;
            viewportEl.classList.remove('is-panning');
            window.removeEventListener('mousemove', onWindowMouseMove);
            window.removeEventListener('mouseup', endPan);
            setTimeout(() => { suppressNodeClick = false; }, 30);
        };

        viewportEl.addEventListener('mousedown', (e) => {
            if (e.button !== 0 || e.target === resetViewBtn) return;
            viewState.dragging = true;
            viewState.startX = e.clientX;
            viewState.startY = e.clientY;
            viewState.origPanX = viewState.panX;
            viewState.origPanY = viewState.panY;
            suppressNodeClick = false;
            viewportEl.classList.add('is-panning');
            window.addEventListener('mousemove', onWindowMouseMove);
            window.addEventListener('mouseup', endPan);
        });

        viewportEl.addEventListener('touchstart', (e) => {
            if (e.target === resetViewBtn) return;
            if (e.touches.length === 2) {
                const t0 = e.touches[0], t1 = e.touches[1];
                const rect = viewportEl.getBoundingClientRect();
                viewState.dragging = false;
                viewState.pinching = true;
                viewState.pinchDist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY) || 1;
                viewState.pinchScale = viewState.scale;
                viewState.pinchMidX = ((t0.clientX + t1.clientX) * 0.5) - rect.left;
                viewState.pinchMidY = ((t0.clientY + t1.clientY) * 0.5) - rect.top;
                suppressNodeClick = true;
                return;
            }
            if (e.touches.length !== 1) return;
            const t = e.touches[0];
            viewState.pinching = false;
            viewState.dragging = true;
            viewState.startX = t.clientX;
            viewState.startY = t.clientY;
            viewState.origPanX = viewState.panX;
            viewState.origPanY = viewState.panY;
            suppressNodeClick = false;
        }, { passive: true });

        viewportEl.addEventListener('touchmove', (e) => {
            if (viewState.pinching && e.touches.length === 2) {
                e.preventDefault();
                const t0 = e.touches[0], t1 = e.touches[1];
                const rect = viewportEl.getBoundingClientRect();
                const dist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY) || 1;
                const prevScale = viewState.scale;
                const minScale = getMinScale(viewportEl.clientWidth || 860, viewportEl.clientHeight || 380);
                const nextScale = Math.max(minScale, Math.min(1.45, viewState.pinchScale * (dist / viewState.pinchDist)));
                const midX = ((t0.clientX + t1.clientX) * 0.5) - rect.left;
                const midY = ((t0.clientY + t1.clientY) * 0.5) - rect.top;
                const worldX = (viewState.pinchMidX - viewState.panX) / prevScale;
                const worldY = (viewState.pinchMidY - viewState.panY) / prevScale;
                viewState.scale = nextScale;
                viewState.panX = midX - worldX * nextScale;
                viewState.panY = midY - worldY * nextScale;
                viewState.pinchMidX = midX;
                viewState.pinchMidY = midY;
                applyViewTransform();
                return;
            }
            if (!viewState.dragging || e.touches.length !== 1) return;
            const t = e.touches[0];
            handlePanMove(t.clientX, t.clientY);
        }, { passive: false });

        viewportEl.addEventListener('touchend', endPan);

        viewportEl.addEventListener('wheel', (e) => {
            e.preventDefault();
            const rect = viewportEl.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            const prevScale = viewState.scale;
            const minScale = getMinScale(viewportEl.clientWidth || 860);
            const factor = e.deltaY < 0 ? 1.1 : 0.9;
            const nextScale = Math.max(minScale, Math.min(1.45, prevScale * factor));
            if (Math.abs(nextScale - prevScale) < 1e-4) return;
            const worldX = (mouseX - viewState.panX) / prevScale;
            const worldY = (mouseY - viewState.panY) / prevScale;
            viewState.scale = nextScale;
            viewState.panX = mouseX - worldX * nextScale;
            viewState.panY = mouseY - worldY * nextScale;
            applyViewTransform();
        }, { passive: false });

        viewportEl.addEventListener('click', (e) => {
            if (suppressNodeClick) return;
            if (!e.target.closest('.wt-node') && !e.target.closest('.wt-viewport-controls')) {
                bloodlineFocusId = null;
                applyBloodlineHighlight(null);
            }
        });

        // 若指定聚焦節點或已追蹤配方則優先保留，其餘情況預設預選場上素材已就緒或可進化的目標節點
        const shouldAutoPick = !preserveTreeSelectionOnce && (!trackedRecipeNodeId || selectedTreeNodeId !== trackedRecipeNodeId);
        preserveTreeSelectionOnce = false;
        const autoPickSet = scanState.readyNowNodeSet.size > 0 ? scanState.readyNowNodeSet : scanState.craftableNodeSet;
        if (shouldAutoPick && autoPickSet.size > 0 && !autoPickSet.has(selectedTreeNodeId)) {
            selectedTreeNodeId = Array.from(autoPickSet)[0];
            nodeButtons.forEach(el => el.classList.toggle('is-selected', el.dataset.nodeId === selectedTreeNodeId));
        }

        renderWorldTreeDetail(detailEl, selectedTreeNodeId, scanState);
        treeShellEl.appendChild(detailEl);

        if (typeof requestAnimationFrame === 'function') {
            requestAnimationFrame(fitToViewport);
        } else {
            fitToViewport();
        }
    }

    /**
     * 建立單張怪物／地形圖鑑卡片 DOM
     */
    function createCodexCardElement({ portraitCat, itemKey, tier = 1, unlocked, cardClass, headerHtml, descHtml }) {
        const itemEl = document.createElement('div');
        itemEl.className = `codex-item ${cardClass || 'codex-steam'}${unlocked ? ' is-unlocked' : ' is-locked'}`;
        itemEl.dataset.entryId = `${portraitCat}:${itemKey}`;
        itemEl.dataset.unlocked = unlocked ? 'true' : 'false';

        const frameEl = document.createElement('div');
        frameEl.className = 'codex-portrait-frame';
        const canvasEl = document.createElement('canvas');
        canvasEl.className = 'codex-portrait-canvas';
        canvasEl.width = 64;
        canvasEl.height = 64;
        canvasEl.dataset.size = '64';
        canvasEl.setAttribute('aria-hidden', 'true');
        frameEl.appendChild(canvasEl);

        if (!unlocked) {
            const qBadge = document.createElement('span');
            qBadge.className = 'codex-silhouette-mark';
            qBadge.innerText = '?';
            frameEl.appendChild(qBadge);
        }

        const infoCol = document.createElement('div');
        infoCol.className = 'codex-info-col';
        infoCol.innerHTML = `<div class="codex-recipe">${headerHtml}</div><div class="codex-desc">${descHtml}</div>`;

        itemEl.appendChild(frameEl);
        itemEl.appendChild(infoCol);

        if (GameApp.renderer && typeof GameApp.renderer.drawPortrait === 'function') {
            GameApp.renderer.drawPortrait(canvasEl, portraitCat, itemKey, {
                size: 64,
                tier,
                silhouette: !unlocked
            });
        }
        return itemEl;
    }

    function renderCategoryItemsInto(listEl, category) {
        if (!listEl) return;
        listEl.innerHTML = '';

        const codexData = getCodexData();
        const entries = codexData.CODEX_ENTRIES || { towers: {}, monsters: {}, terrain: {} };
        const towersDict = (GameApp.data && GameApp.data.towers && GameApp.data.towers.TOWERS) || {};
        const monstersDict = (GameApp.data && GameApp.data.monsters && GameApp.data.monsters.MONSTER_DATABASE) || {};
        const terrainsDict = (GameApp.data && GameApp.data.terrain && GameApp.data.terrain.TERRAIN_TYPES) || {};

        if (category === 'towers') {
            const nodeKeys = Object.keys(towersDict).filter(k => Boolean(towersDict[k] && !towersDict[k].isAlias));
            nodeKeys.forEach((key) => {
                const tCfg = towersDict[key];
                const card = (entries.towers && entries.towers[key]) || codexData.buildFallbackTowerCard(key, tCfg);
                const unlocked = isEntryUnlocked(`tower:${key}`, Boolean(card.defaultUnlocked));
                const statusBadge = unlocked
                    ? `<span class="codex-status-badge unlocked">${L('已解鎖', 'Unlocked')}</span>`
                    : `<span class="codex-status-badge locked">${L('未解鎖', 'Locked')}</span>`;
                const headerHtml = unlocked
                    ? `<strong>${card.title}</strong> ${statusBadge}`
                    : `<strong>${L('？？？ · 未知節點', '??? · Unknown Node')}</strong> ${statusBadge}`;
                const descHtml = unlocked ? (card.mech || card.desc) : `${L('解鎖條件：', 'Unlock: ')}${card.unlockRule || L('於戰場召喚或合成解鎖', 'Summon or merge to unlock')}`;

                listEl.appendChild(createCodexCardElement({
                    portraitCat: 'tower',
                    itemKey: key,
                    tier: Number(tCfg.nodeTier || tCfg.tier) || 1,
                    unlocked,
                    cardClass: card.cardClass || 'codex-steam',
                    headerHtml,
                    descHtml
                }));
            });
            return;
        }

        if (category === 'monsters') {
            const monsterKeys = Object.keys(monstersDict);
            monsterKeys.forEach((key) => {
                const mCfg = monstersDict[key];
                const card = (entries.monsters && entries.monsters[key]) || codexData.buildFallbackMonsterCard(key, mCfg);
                const unlocked = isEntryUnlocked(`monster:${key}`, Boolean(card.defaultUnlocked));
                const statusBadge = unlocked
                    ? `<span class="codex-status-badge unlocked">${L('已解鎖', 'Unlocked')}</span>`
                    : `<span class="codex-status-badge locked">${L('未解鎖', 'Locked')}</span>`;
                const headerHtml = unlocked
                    ? `<strong>${card.title}</strong> <span class="num" style="font-size:12px;color:#E0B43C;">${L('｜', ' | ')}${card.subtitle || ''}</span> ${statusBadge}`
                    : `<strong>${L('？？？ · 未知魔物', '??? · Unknown Enemy')}</strong> ${statusBadge}`;
                const descHtml = unlocked
                    ? card.desc
                    : `${L('解鎖條件：', 'Unlock: ')}${card.unlockRule || L('於戰場遭遇此魔物後自動解鎖彩圖與弱點情報。', 'Unlocks upon encountering this enemy in battle.')}`;

                listEl.appendChild(createCodexCardElement({
                    portraitCat: 'monster',
                    itemKey: key,
                    tier: 1,
                    unlocked,
                    cardClass: 'codex-steam',
                    headerHtml,
                    descHtml
                }));
            });
            return;
        }

        if (category === 'terrain') {
            const terrainKeys = Object.keys(terrainsDict).filter(k => k !== 'grass' && k !== 'path');
            terrainKeys.forEach((key) => {
                const tCfg = terrainsDict[key];
                const card = (entries.terrain && entries.terrain[key]) || {
                    title: `${tCfg.icon || '🗺️'} ${tCfg.name || key}`,
                    subtitle: tCfg.shortTag || '',
                    desc: tCfg.tooltip || '',
                    defaultUnlocked: true
                };
                const unlocked = isEntryUnlocked(`terrain:${key}`, card.defaultUnlocked !== false);
                const headerHtml = `<strong>${card.title}</strong> <span class="num" style="font-size:12px;color:#4A9EBF;">${L('｜', ' | ')}${card.subtitle || ''}</span>`;

                listEl.appendChild(createCodexCardElement({
                    portraitCat: 'terrain',
                    itemKey: key,
                    tier: 1,
                    unlocked,
                    cardClass: 'codex-magnet',
                    headerHtml,
                    descHtml: card.desc
                }));
            });
        }
    }

    function initCodexModalDom() {
        if (!G || !G.dom || !G.dom.codexOverlayEl) return;
        const cardEl = G.dom.codexOverlayEl.querySelector('.codex-card');
        if (!cardEl) return;

        let tabsEl = cardEl.querySelector('.codex-tabs');
        if (!tabsEl) {
            tabsEl = document.createElement('div');
            tabsEl.className = 'codex-tabs';
            const listEl = cardEl.querySelector('.codex-list');
            if (listEl) cardEl.insertBefore(tabsEl, listEl);
        }
        renderCodexModal(currentCategory);
    }

    function renderCodexModal(category = 'fusion') {
        currentCategory = category;
        syncDefaultUnlockedEntries();
        if (!G || !G.dom || !G.dom.codexOverlayEl) return;
        const cardEl = G.dom.codexOverlayEl.querySelector('.codex-card');
        if (!cardEl) return;

        const categories = getCodexData().CODEX_CATEGORIES || [
            { id: 'fusion', label: L('世界樹演化圖譜', 'World Tree Codex') },
            { id: 'monsters', label: L('入侵魔物', 'Enemy Bestiary') },
            { id: 'terrain', label: L('戰術地形', 'Tactical Terrain') }
        ];

        const tabsEl = cardEl.querySelector('.codex-tabs');
        if (tabsEl) {
            tabsEl.innerHTML = '';
            tabsEl.style.gridTemplateColumns = `repeat(${categories.length}, 1fr)`;
            categories.forEach((cat) => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = `codex-tab-btn${cat.id === currentCategory ? ' active' : ''}`;
                btn.dataset.codexCat = cat.id;
                btn.innerText = cat.label;
                btn.addEventListener('click', () => renderCodexModal(cat.id));
                tabsEl.appendChild(btn);
            });
        }

        const treeShellEl = cardEl.querySelector('#codex-tree-shell');
        const listEl = cardEl.querySelector('.codex-list');
        const showTree = currentCategory === 'fusion';

        if (treeShellEl) {
            treeShellEl.classList.toggle('hidden', !showTree);
            if (showTree) renderWorldTreeCodex(treeShellEl);
        }
        if (listEl) {
            listEl.classList.toggle('hidden', showTree);
            if (!showTree) renderCategoryItemsInto(listEl, currentCategory);
        }
    }

    function isCodexOpen() {
        return Boolean(G && G.dom && G.dom.codexOverlayEl && !G.dom.codexOverlayEl.classList.contains('hidden'));
    }

    function openCodex(focusNodeId = null) {
        if (!G || !G.dom || !G.dom.codexOverlayEl || isCodexOpen()) return;
        if (focusNodeId && WORLD_TREE_LAYOUT[focusNodeId]) {
            selectedTreeNodeId = focusNodeId;
            preserveTreeSelectionOnce = true;
            currentCategory = 'fusion';
        } else if (trackedRecipeNodeId && WORLD_TREE_LAYOUT[trackedRecipeNodeId]) {
            selectedTreeNodeId = trackedRecipeNodeId;
            preserveTreeSelectionOnce = true;
        }
        const st = G.state;
        const guideEl = G.dom.guideOverlayEl;
        const wasGuideOpen = Boolean(guideEl && !guideEl.classList.contains('hidden'));
        if (wasGuideOpen) {
            guideEl.classList.add('hidden');
            if (G.dom.helpBtn) G.dom.helpBtn.setAttribute('aria-expanded', 'false');
        }
        const activeMatch = G.callbacks.isMatchPhaseActive();
        st.pausedBeforeCodex = wasGuideOpen ? st.pausedBeforeGuide : st.isPaused;
        st.pausedBeforeGuide = false;
        if (activeMatch) st.isPaused = true;
        G.dom.codexOverlayEl.classList.remove('hidden');
        renderCodexModal(currentCategory || 'fusion');
        if (typeof requestAnimationFrame === 'function' && currentCategory === 'fusion') {
            requestAnimationFrame(() => {
                if (typeof activeTreeFitFn === 'function') activeTreeFitFn();
            });
        }
        if (st.rafId !== null) { cancelAnimationFrame(st.rafId); st.rafId = null; }
        if (GameApp.backend && typeof GameApp.backend.trackFeel === 'function') {
            GameApp.backend.recordPlayerAction();
            GameApp.backend.trackFeel('Feel:CodexOpen', 1);
        }
        if (activeMatch) G.callbacks.updateHUD();
    }

    function closeCodex() {
        if (!G || !G.dom || !G.dom.codexOverlayEl || !isCodexOpen()) return;
        const st = G.state;
        const restorePaused = Boolean(st.pausedBeforeCodex);
        st.pausedBeforeCodex = false;
        G.dom.codexOverlayEl.classList.add('hidden');
        if (G.callbacks.isMatchPhaseActive()) {
            G.callbacks.setPauseState(restorePaused, { silent: true });
        } else {
            G.callbacks.updateHUD();
        }
    }

    const CodexSystem = {
        bind,
        resetRunCodex,
        exportRunCodexState,
        restoreRunCodexState,
        isEntryUnlocked,
        unlockEntry,
        isCodexOpen,
        openCodex,
        closeCodex,
        renderCodexModal,
        scanBoardCraftableState,
        setTrackedRecipe,
        getTrackedRecipeId,
        computeRecipeTrackerStatus,
        updateRecipeTrackerUI,
        getRunUnlockSummary,
        fitToViewport: () => { if (typeof activeTreeFitFn === 'function') activeTreeFitFn(); }
    };

    GameApp.systems = GameApp.systems || {};
    GameApp.systems.codex = CodexSystem;
})(window);
