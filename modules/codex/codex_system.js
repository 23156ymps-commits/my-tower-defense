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
    // Phase 5：圖鑑改為單局重置（僅保存於本局記憶體，開新局或重開一律重置為尚未合成）
    const unlockedSet = new Set();

    const EN_TREE_NODE_LABELS = {
        world_core: 'World Tree Core',
        fire_bud: 'Fire 1★', ice_bud: 'Ice 1★', thunder_bud: 'Bolt 1★',
        steam_bud: 'Steam 1★', magnet_bud: 'Magnet 1★', plasma_bud: 'Plasma 1★',
        fire_trunk: 'Ember 2★', steam_trunk: 'Hi-Steam', ice_trunk: 'Frost 2★',
        magnet_trunk: 'Hi-Magnet', thunder_trunk: 'Volt 2★', plasma_trunk: 'Hi-Plasma',
        fire_A: 'A Bombard', fire_B: 'B Cinder', steam_A: 'A Pressure', steam_B: 'B Frostmist',
        ice_A: 'A Permafrost', ice_B: 'B Icicle', magnet_A: 'A Gravity', magnet_B: 'B Overload',
        thunder_A: 'A Tempest', thunder_B: 'B Judgment', plasma_A: 'A Deathray', plasma_B: 'B Prism'
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

    // SVG 世界樹演化圖譜畫布與扇形樹冠座標拓撲（1320 × 680，自底向上：原核 → 3 基礎 1★ → 3 轉職 1★ → 6 主幹 2★ → 12 冠枝 3★）
    const TREE_VIEW_W = 1320;
    const TREE_VIEW_H = 680;

    const WORLD_TREE_LAYOUT = {
        // Row 4 (Bottom): 世界樹原核
        world_core: { x: 660, y: 602, tier: 0, family: 'core', label: '世界樹原核' },

        // Row 3: 3 基礎根芽 (1★)
        fire_bud: { x: 220, y: 472, tier: 1, family: 'fire', label: '火芽 1★' },
        ice_bud: { x: 660, y: 472, tier: 1, family: 'ice', label: '冰芽 1★' },
        thunder_bud: { x: 1100, y: 472, tier: 1, family: 'thunder', label: '雷芽 1★' },

        // Row 2: 3 異系轉職物種 (1★)
        steam_bud: { x: 342, y: 340, tier: 1, family: 'steam', isTransfer: true, label: '蒸氣 1★' },
        magnet_bud: { x: 768, y: 340, tier: 1, family: 'magnet', isTransfer: true, label: '磁環 1★' },
        plasma_bud: { x: 1188, y: 340, tier: 1, family: 'plasma', isTransfer: true, label: '電漿 1★' },

        // Row 1: 6 進階主幹 (2★)
        fire_trunk: { x: 132, y: 210, tier: 2, family: 'fire', label: '炎核 2★' },
        steam_trunk: { x: 342, y: 210, tier: 2, family: 'steam', label: '高階蒸氣' },
        ice_trunk: { x: 552, y: 210, tier: 2, family: 'ice', label: '霜晶 2★' },
        magnet_trunk: { x: 768, y: 210, tier: 2, family: 'magnet', label: '高階磁環' },
        thunder_trunk: { x: 978, y: 210, tier: 2, family: 'thunder', label: '雷紋 2★' },
        plasma_trunk: { x: 1188, y: 210, tier: 2, family: 'plasma', label: '高階電漿' },

        // Row 0 (Top Canopy): 12 終極冠枝 (3★ A / B)
        fire_A: { x: 80, y: 78, tier: 3, family: 'fire', branch: 'A', label: 'A 熔核' },
        fire_B: { x: 185, y: 78, tier: 3, family: 'fire', branch: 'B', label: 'B 焚世' },
        steam_A: { x: 290, y: 78, tier: 3, family: 'steam', branch: 'A', label: 'A 蒸壓' },
        steam_B: { x: 395, y: 78, tier: 3, family: 'steam', branch: 'B', label: 'B 霜霧' },
        ice_A: { x: 500, y: 78, tier: 3, family: 'ice', branch: 'A', label: 'A 永凍' },
        ice_B: { x: 605, y: 78, tier: 3, family: 'ice', branch: 'B', label: 'B 冰錐' },
        magnet_A: { x: 715, y: 78, tier: 3, family: 'magnet', branch: 'A', label: 'A 黑洞' },
        magnet_B: { x: 820, y: 78, tier: 3, family: 'magnet', branch: 'B', label: 'B 電磁' },
        thunder_A: { x: 925, y: 78, tier: 3, family: 'thunder', branch: 'A', label: 'A 連鎖' },
        thunder_B: { x: 1030, y: 78, tier: 3, family: 'thunder', branch: 'B', label: 'B 審判' },
        plasma_A: { x: 1135, y: 78, tier: 3, family: 'plasma', branch: 'A', label: 'A 死光' },
        plasma_B: { x: 1240, y: 78, tier: 3, family: 'plasma', branch: 'B', label: 'B 折射' }
    };

    // 樹枝連線定義：core / sym (1★ 異系轉職) / primary (同物種升星與冠枝) / directed (基礎芽元素灌注轉職 1★ 升 2★)
    const WORLD_TREE_EDGES = [
        // 原核 -> 3 基礎根芽 (1★)
        { from: 'world_core', to: 'fire_bud', family: 'fire', kind: 'core' },
        { from: 'world_core', to: 'ice_bud', family: 'ice', kind: 'core' },
        { from: 'world_core', to: 'thunder_bud', family: 'thunder', kind: 'core' },

        // 3 基礎根芽 (1★) 交叉轉職 -> 3 轉職新物種 (1★)
        { from: 'fire_bud', to: 'steam_bud', family: 'steam', kind: 'sym' },
        { from: 'ice_bud', to: 'steam_bud', family: 'steam', kind: 'sym' },
        { from: 'ice_bud', to: 'magnet_bud', family: 'magnet', kind: 'sym' },
        { from: 'thunder_bud', to: 'magnet_bud', family: 'magnet', kind: 'sym' },
        { from: 'fire_bud', to: 'plasma_bud', family: 'plasma', kind: 'sym', arcOffsetY: 115 },
        { from: 'thunder_bud', to: 'plasma_bud', family: 'plasma', kind: 'sym' },

        // 6 大物種 1★ -> 2★ 同物種升星
        { from: 'fire_bud', to: 'fire_trunk', family: 'fire', kind: 'primary' },
        { from: 'steam_bud', to: 'steam_trunk', family: 'steam', kind: 'primary' },
        { from: 'ice_bud', to: 'ice_trunk', family: 'ice', kind: 'primary' },
        { from: 'magnet_bud', to: 'magnet_trunk', family: 'magnet', kind: 'primary' },
        { from: 'thunder_bud', to: 'thunder_trunk', family: 'thunder', kind: 'primary' },
        { from: 'plasma_bud', to: 'plasma_trunk', family: 'plasma', kind: 'primary' },

        // 基礎 1★ 芽快捷灌注轉職 1★ -> 2★（虛線輔助脈絡）
        { from: 'fire_bud', to: 'steam_trunk', family: 'fire', kind: 'directed' },
        { from: 'ice_bud', to: 'steam_trunk', family: 'ice', kind: 'directed' },
        { from: 'ice_bud', to: 'magnet_trunk', family: 'ice', kind: 'directed' },
        { from: 'thunder_bud', to: 'magnet_trunk', family: 'thunder', kind: 'directed' },
        { from: 'fire_bud', to: 'plasma_trunk', family: 'fire', kind: 'directed', arcOffsetY: -45 },
        { from: 'thunder_bud', to: 'plasma_trunk', family: 'thunder', kind: 'directed' },

        // 6 大物種 2★ -> 12 冠枝 3★ (A / B)
        { from: 'fire_trunk', to: 'fire_A', family: 'fire', kind: 'primary' },
        { from: 'fire_trunk', to: 'fire_B', family: 'fire', kind: 'primary' },
        { from: 'steam_trunk', to: 'steam_A', family: 'steam', kind: 'primary' },
        { from: 'steam_trunk', to: 'steam_B', family: 'steam', kind: 'primary' },
        { from: 'ice_trunk', to: 'ice_A', family: 'ice', kind: 'primary' },
        { from: 'ice_trunk', to: 'ice_B', family: 'ice', kind: 'primary' },
        { from: 'magnet_trunk', to: 'magnet_A', family: 'magnet', kind: 'primary' },
        { from: 'magnet_trunk', to: 'magnet_B', family: 'magnet', kind: 'primary' },
        { from: 'thunder_trunk', to: 'thunder_A', family: 'thunder', kind: 'primary' },
        { from: 'thunder_trunk', to: 'thunder_B', family: 'thunder', kind: 'primary' },
        { from: 'plasma_trunk', to: 'plasma_A', family: 'plasma', kind: 'primary' },
        { from: 'plasma_trunk', to: 'plasma_B', family: 'plasma', kind: 'primary' }
    ];

    const FAMILY_STROKE_COLORS = {
        core: '#B8C2BC',
        fire: '#C94A38',
        ice: '#4A9EBF',
        thunder: '#E0B43C',
        steam: '#D97724',
        magnet: '#4A9EBF',
        plasma: '#D97724'
    };

    function bind(ctx) {
        G = ctx;
        syncDefaultUnlockedEntries();
        initCodexModalDom();
    }

    function syncDefaultUnlockedEntries() {
        const entries = getCodexData().CODEX_ENTRIES || {};
        if (entries.towers) {
            Object.keys(entries.towers).forEach(k => {
                if (entries.towers[k] && entries.towers[k].defaultUnlocked) unlockedSet.add(`tower:${k}`);
            });
        }
        // 相容舊版 fire/ice/thunder 解鎖映射到 *_bud
        ['fire', 'ice', 'thunder'].forEach(k => {
            unlockedSet.add(`tower:${k}_bud`);
        });
        if (entries.monsters) {
            Object.keys(entries.monsters).forEach(k => {
                if (entries.monsters[k] && entries.monsters[k].defaultUnlocked) unlockedSet.add(`monster:${k}`);
            });
        }
        if (entries.terrain) {
            Object.keys(entries.terrain).forEach(k => {
                if (entries.terrain[k] && entries.terrain[k].defaultUnlocked !== false) unlockedSet.add(`terrain:${k}`);
            });
        }
    }

    function resetRunCodex() {
        unlockedSet.clear();
        selectedTreeNodeId = 'fire_bud';
        syncDefaultUnlockedEntries();
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
        if (wasLocked && isCodexOpen()) {
            renderCodexModal(currentCategory);
        }
    }

    function getCodexData() {
        return (GameApp.data && GameApp.data.codex) || {};
    }

    /**
     * 掃描目前棋盤上的 1★ 與 2★ 塔，判斷哪些轉職 1★／進階 2★／終極 3★ 已被「部分滿足」或「雙素材就緒」
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

        Object.keys(t1Rules).forEach((ruleKey) => {
            const rule = t1Rules[ruleKey];
            if (!rule || !rule.resultType) return;
            const [ingA, ingB] = ruleKey.split('+');
            const cntA = boardNodeCounts[ingA] || 0;
            const cntB = boardNodeCounts[ingB] || 0;
            const isFullReady = ingA === ingB ? cntA >= 2 : (cntA >= 1 && cntB >= 1);
            if (isFullReady) {
                craftableNodeSet.add(rule.resultType);
                readyNowNodeSet.add(rule.resultType);
            }
        });

        Object.keys(t2Rules).forEach((ruleKey) => {
            const rule = t2Rules[ruleKey];
            if (!rule || !Array.isArray(rule.options)) return;
            const [ingA, ingB] = ruleKey.split('+');
            const cntA = boardNodeCounts[ingA] || 0;
            const cntB = boardNodeCounts[ingB] || 0;
            const hasPartial = cntA > 0 || cntB > 0;
            const isFullReady = ingA === ingB ? cntA >= 2 : (cntA >= 1 && cntB >= 1);

            if (hasPartial) {
                rule.options.forEach((optId) => {
                    craftableNodeSet.add(optId);
                    if (isFullReady) readyNowNodeSet.add(optId);
                });
            }
        });

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
            detailEl.className = 'wt-detail-card is-core';
            detailEl.innerHTML = `
                <div class="wt-detail-portrait core-emblem" aria-hidden="true">🌳</div>
                <div class="wt-detail-body">
                    <div class="wt-detail-top">
                        <span class="wt-detail-title">${L('世界樹原核', 'World Tree Core')}</span>
                        <span class="wt-detail-tag num">${L(`已喚醒枝脈：${totalUnlocked} / 24`, `Awakened Nodes: ${totalUnlocked} / 24`)}</span>
                    </div>
                    <div class="wt-detail-row">${L('<strong>轉職與升星脈絡：</strong>基礎 1★ 異系轉職 ➔ 轉職 1★ 新物種；同物種 1★ + 1★（或基礎芽灌注轉職 1★）➔ 2★ 主幹 ➔ 3★ 冠枝分岔', '<strong>Evolution Lineage:</strong> Cross 1★ buds ➔ Hybrid 1★; same species 1★+1★ (or bud infusion) ➔ 2★ Trunk ➔ 3★ Crown Branch')}</div>
                    <div class="wt-detail-row">${L('<strong>戰術指引：</strong>點擊上方任一節點可檢視合成路徑與數值；場上素材就緒或可進化方向將以琥珀金框提示。', '<strong>Tactical Guide:</strong> Click any node above to inspect recipes & stats. Craftable nodes glow with an amber outline.')}</div>
                </div>
            `;
            return;
        }

        const tCfg = towersDict[nodeId] || {};
        const custom = (entries.towers && entries.towers[nodeId]) || codexData.buildFallbackTowerCard(nodeId, tCfg);
        const unlocked = isEntryUnlocked(`tower:${nodeId}`, Boolean(custom.defaultUnlocked));
        const isReadyNow = scanState.readyNowNodeSet.has(nodeId);
        const isCraftable = scanState.craftableNodeSet.has(nodeId);
        const tierNum = nodeMeta.tier || Number(tCfg.nodeTier) || 1;
        const costMult = tCfg.costShare ? `${tCfg.costShare}x` : (tierNum === 1 ? '1x' : (tierNum === 2 ? '2x' : '4x'));
        const starStr = tierNum === 1 ? '★' : (tierNum === 2 ? '★★' : '★★★');

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

        const bodyEl = document.createElement('div');
        bodyEl.className = 'wt-detail-body';
        if (unlocked) {
            bodyEl.innerHTML = `
                <div class="wt-detail-top">
                    <span class="wt-detail-title">${custom.title || tCfg.name || nodeId} <span class="num">${starStr}</span></span>
                    <span class="wt-detail-tag num">Tier ${tierNum} · ${L('成本', 'Cost')} ${costMult}</span>
                    ${statusBadge}${craftBadge}
                </div>
                <div class="wt-detail-row"><strong>${L('進化合成路徑：', 'Recipe: ')}</strong><span class="num">${custom.formula || tCfg.lineagePath || L('基礎召喚', 'Base Summon')}</span></div>
                <div class="wt-detail-row"><strong>${L('核心機制：', 'Mechanic: ')}</strong><span class="num">${custom.mech || custom.desc || ''}</span></div>
                <div class="wt-detail-row"><strong>${L('推薦搭配：', 'Synergy: ')}</strong>${custom.synergy || ''}</div>
            `;
        } else {
            bodyEl.innerHTML = `
                <div class="wt-detail-top">
                    <span class="wt-detail-title">${L('？？？ · 未知世界樹節點', '??? · Unknown Node')} <span class="num">${starStr}</span></span>
                    <span class="wt-detail-tag num">Tier ${tierNum} · ${L('成本', 'Cost')} ${costMult}</span>
                    ${statusBadge}${craftBadge}
                </div>
                <div class="wt-detail-row"><strong>${L('解鎖條件：', 'Unlock Rule: ')}</strong>${custom.unlockRule || L('於戰場合成此防禦塔即可點亮枝脈。', 'Synthesize this tower in battle to unlock.')}</div>
                <div class="wt-detail-row">${isCraftable ? L('⚡ 戰術提醒：當前場上已持有可通往此冠枝的素材，於棋盤拖曳合成即可於本局點亮！', '⚡ Ready: You already have matching towers on board—merge them to unlock!') : L('每局開局圖譜皆重新探索；本局成功合成該防禦塔後即立刻點亮。', 'Codex resets each run; synthesize this tower to illuminate the node.')}</div>
            `;
        }

        detailEl.innerHTML = '';
        detailEl.appendChild(portraitWrap);
        detailEl.appendChild(bodyEl);

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
            bannerEl.innerText = L('拖曳平移、滾輪縮放視角；點擊或懸停節點高亮完整進化血脈與詳細數值。', 'Drag to pan, scroll to zoom; click or hover a node to inspect its full lineage.');
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
                    selectedTreeNodeId === nodeId ? 'is-selected' : ''
                ].filter(Boolean).join(' ');

                const canvasWrap = document.createElement('span');
                canvasWrap.className = 'wt-node-icon-box';
                const cSize = meta.tier === 3 ? 34 : 38;
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

                const cap = document.createElement('span');
                cap.className = 'wt-node-caption num';
                cap.innerText = unlocked ? getTreeNodeLabel(nodeId, meta) : (meta.branch ? `${meta.branch} ???` : '???');

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

        // 平移與縮放視窗狀態（支援滑鼠拖曳、觸控拖曳與滾輪 0.75x ~ 1.45x）
        const viewState = { scale: 0.75, panX: 0, panY: 0, dragging: false, startX: 0, startY: 0, origPanX: 0, origPanY: 0 };

        const clampView = () => {
            const vpW = viewportEl.clientWidth || 860;
            const vpH = viewportEl.clientHeight || 420;
            const contentW = TREE_VIEW_W * viewState.scale;
            const contentH = TREE_VIEW_H * viewState.scale;
            const pad = 48;

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

        const resetView = () => {
            const vpW = viewportEl.clientWidth || 860;
            const vpH = viewportEl.clientHeight || 420;
            const fitScale = Math.min(vpW / TREE_VIEW_W, vpH / TREE_VIEW_H);
            viewState.scale = Math.max(0.75, Math.min(1.45, fitScale));
            viewState.panX = (vpW - TREE_VIEW_W * viewState.scale) * 0.5;
            viewState.panY = (vpH - TREE_VIEW_H * viewState.scale) * 0.5;
            applyViewTransform();
        };

        resetViewBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            resetView();
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
            if (!viewState.dragging) return;
            viewState.dragging = false;
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
            if (e.touches.length !== 1 || e.target === resetViewBtn) return;
            const t = e.touches[0];
            viewState.dragging = true;
            viewState.startX = t.clientX;
            viewState.startY = t.clientY;
            viewState.origPanX = viewState.panX;
            viewState.origPanY = viewState.panY;
            suppressNodeClick = false;
        }, { passive: true });

        viewportEl.addEventListener('touchmove', (e) => {
            if (!viewState.dragging || e.touches.length !== 1) return;
            const t = e.touches[0];
            handlePanMove(t.clientX, t.clientY);
        }, { passive: true });

        viewportEl.addEventListener('touchend', endPan);

        viewportEl.addEventListener('wheel', (e) => {
            e.preventDefault();
            const rect = viewportEl.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            const prevScale = viewState.scale;
            const factor = e.deltaY < 0 ? 1.1 : 0.9;
            const nextScale = Math.max(0.75, Math.min(1.45, prevScale * factor));
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

        // 預設預選場上素材已就緒或可進化的目標節點，讓玩家一打開即可看到戰術建議
        const autoPickSet = scanState.readyNowNodeSet.size > 0 ? scanState.readyNowNodeSet : scanState.craftableNodeSet;
        if (autoPickSet.size > 0 && !autoPickSet.has(selectedTreeNodeId)) {
            selectedTreeNodeId = Array.from(autoPickSet)[0];
            nodeButtons.forEach(el => el.classList.toggle('is-selected', el.dataset.nodeId === selectedTreeNodeId));
        }

        renderWorldTreeDetail(detailEl, selectedTreeNodeId, scanState);
        treeShellEl.appendChild(detailEl);

        if (typeof requestAnimationFrame === 'function') {
            requestAnimationFrame(resetView);
        } else {
            resetView();
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
                    ? `<span class="codex-status-badge unlocked">${L('✅ 已解鎖', '✅ Unlocked')}</span>`
                    : `<span class="codex-status-badge locked">${L('🔒 未解鎖', '🔒 Locked')}</span>`;
                const headerHtml = unlocked
                    ? `<strong>${card.title}</strong> ${statusBadge}`
                    : `<strong>${L('？？？ · 未知節點', '??? · Unknown Node')}</strong> ${statusBadge}`;
                const descHtml = unlocked ? (card.mech || card.desc) : `${L('🔒 解鎖條件：', '🔒 Unlock: ')}${card.unlockRule || L('於戰場召喚或合成解鎖', 'Summon or merge to unlock')}`;

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
                    ? `<span class="codex-status-badge unlocked">${L('✅ 已解鎖', '✅ Unlocked')}</span>`
                    : `<span class="codex-status-badge locked">${L('🔒 未解鎖', '🔒 Locked')}</span>`;
                const headerHtml = unlocked
                    ? `<strong>${card.title}</strong> <span class="num" style="font-size:12px;color:#E0B43C;">｜${card.subtitle || ''}</span> ${statusBadge}`
                    : `<strong>${L('？？？ · 未知魔物', '??? · Unknown Enemy')}</strong> ${statusBadge}`;
                const descHtml = unlocked
                    ? card.desc
                    : `${L('🔒 解鎖條件：', '🔒 Unlock: ')}${card.unlockRule || L('於戰場遭遇此魔物後自動解鎖彩圖與弱點情報。', 'Unlocks upon encountering this enemy in battle.')}`;

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
                const headerHtml = `<strong>${card.title}</strong> <span class="num" style="font-size:12px;color:#4A9EBF;">｜${card.subtitle || ''}</span>`;

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

    function openCodex() {
        if (!G || !G.dom || !G.dom.codexOverlayEl || isCodexOpen()) return;
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
        renderCodexModal(currentCategory || 'fusion');
        G.dom.codexOverlayEl.classList.remove('hidden');
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
        isEntryUnlocked,
        unlockEntry,
        isCodexOpen,
        openCodex,
        closeCodex,
        renderCodexModal,
        scanBoardCraftableState
    };

    GameApp.systems = GameApp.systems || {};
    GameApp.systems.codex = CodexSystem;
})(window);
