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
    const unlockedSet = loadUnlockedSet();

    // SVG 世界樹演化圖譜畫布與節點座標拓撲（820 × 310，自底向上生長）
    const TREE_VIEW_W = 820;
    const TREE_VIEW_H = 310;

    const WORLD_TREE_LAYOUT = {
        // Row 3 (Bottom): 世界樹原核
        world_core: { x: 410, y: 278, tier: 0, family: 'core', label: '世界樹原核' },

        // Row 2: 3 根芽 (T1)
        fire_bud: { x: 142, y: 214, tier: 1, family: 'fire', label: '火芽' },
        ice_bud: { x: 410, y: 214, tier: 1, family: 'ice', label: '冰芽' },
        thunder_bud: { x: 678, y: 214, tier: 1, family: 'thunder', label: '雷芽' },

        // Row 1: 6 主幹 (T2)
        fire_trunk: { x: 74, y: 128, tier: 2, family: 'fire', label: '炎核' },
        steam_trunk: { x: 208, y: 128, tier: 2, family: 'steam', label: '蒸氣' },
        ice_trunk: { x: 342, y: 128, tier: 2, family: 'ice', label: '霜晶' },
        magnet_trunk: { x: 478, y: 128, tier: 2, family: 'magnet', label: '磁環' },
        thunder_trunk: { x: 612, y: 128, tier: 2, family: 'thunder', label: '雷紋' },
        plasma_trunk: { x: 746, y: 128, tier: 2, family: 'plasma', label: '電漿' },

        // Row 0 (Top): 12 冠枝 (T3)
        fire_A: { x: 40, y: 40, tier: 3, family: 'fire', branch: 'A', label: 'A 熔核' },
        fire_B: { x: 108, y: 40, tier: 3, family: 'fire', branch: 'B', label: 'B 焚世' },
        steam_A: { x: 174, y: 40, tier: 3, family: 'steam', branch: 'A', label: 'A 蒸壓' },
        steam_B: { x: 242, y: 40, tier: 3, family: 'steam', branch: 'B', label: 'B 霜霧' },
        ice_A: { x: 308, y: 40, tier: 3, family: 'ice', branch: 'A', label: 'A 永凍' },
        ice_B: { x: 376, y: 40, tier: 3, family: 'ice', branch: 'B', label: 'B 冰錐' },
        magnet_A: { x: 444, y: 40, tier: 3, family: 'magnet', branch: 'A', label: 'A 黑洞' },
        magnet_B: { x: 512, y: 40, tier: 3, family: 'magnet', branch: 'B', label: 'B 電磁' },
        thunder_A: { x: 578, y: 40, tier: 3, family: 'thunder', branch: 'A', label: 'A 連鎖' },
        thunder_B: { x: 646, y: 40, tier: 3, family: 'thunder', branch: 'B', label: 'B 審判' },
        plasma_A: { x: 712, y: 40, tier: 3, family: 'plasma', branch: 'A', label: 'A 死光' },
        plasma_B: { x: 780, y: 40, tier: 3, family: 'plasma', branch: 'B', label: 'B 折射' }
    };

    // 樹枝連線定義：primary（主生脈）與 directed（同血脈定向催熟副脈）
    const WORLD_TREE_EDGES = [
        // 原核 -> 3 根芽
        { from: 'world_core', to: 'fire_bud', family: 'fire', kind: 'core' },
        { from: 'world_core', to: 'ice_bud', family: 'ice', kind: 'core' },
        { from: 'world_core', to: 'thunder_bud', family: 'thunder', kind: 'core' },

        // 3 根芽 -> 3 純血主幹 + 3 共生主幹（含火雷遠距弧線）
        { from: 'fire_bud', to: 'fire_trunk', family: 'fire', kind: 'primary' },
        { from: 'fire_bud', to: 'steam_trunk', family: 'steam', kind: 'sym' },
        { from: 'ice_bud', to: 'steam_trunk', family: 'steam', kind: 'sym' },
        { from: 'ice_bud', to: 'ice_trunk', family: 'ice', kind: 'primary' },
        { from: 'ice_bud', to: 'magnet_trunk', family: 'magnet', kind: 'sym' },
        { from: 'thunder_bud', to: 'magnet_trunk', family: 'magnet', kind: 'sym' },
        { from: 'thunder_bud', to: 'thunder_trunk', family: 'thunder', kind: 'primary' },
        { from: 'fire_bud', to: 'plasma_trunk', family: 'plasma', kind: 'sym', arcOffsetY: 54 },
        { from: 'thunder_bud', to: 'plasma_trunk', family: 'plasma', kind: 'sym' },

        // 6 主幹 -> 12 冠枝 (A / B)
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
        { from: 'plasma_trunk', to: 'plasma_B', family: 'plasma', kind: 'primary' },

        // 純血主幹 -> 共生冠枝同血脈定向催熟連線
        { from: 'fire_trunk', to: 'steam_A', family: 'fire', kind: 'directed' },
        { from: 'ice_trunk', to: 'steam_B', family: 'ice', kind: 'directed' },
        { from: 'ice_trunk', to: 'magnet_A', family: 'ice', kind: 'directed' },
        { from: 'thunder_trunk', to: 'magnet_B', family: 'thunder', kind: 'directed' },
        { from: 'fire_trunk', to: 'plasma_A', family: 'fire', kind: 'directed', arcOffsetY: -22 },
        { from: 'thunder_trunk', to: 'plasma_B', family: 'thunder', kind: 'directed' }
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

    function loadUnlockedSet() {
        const set = new Set();
        try {
            const raw = typeof localStorage !== 'undefined'
                ? localStorage.getItem(CONFIG.STORAGE_CODEX_KEY || 'merge_defense_codex_unlocked')
                : null;
            if (raw) {
                const arr = JSON.parse(raw);
                if (Array.isArray(arr)) arr.forEach(item => set.add(String(item)));
            }
        } catch (_) {}
        return set;
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

    function saveUnlockedSet() {
        try {
            if (typeof localStorage !== 'undefined') {
                localStorage.setItem(
                    CONFIG.STORAGE_CODEX_KEY || 'merge_defense_codex_unlocked',
                    JSON.stringify(Array.from(unlockedSet))
                );
            }
        } catch (_) {}
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
        if (wasLocked) {
            saveUnlockedSet();
            if (isCodexOpen()) renderCodexModal(currentCategory);
        }
    }

    function getCodexData() {
        return (GameApp.data && GameApp.data.codex) || {};
    }

    /**
     * 掃描目前棋盤上的 T2 塔，判斷哪些 T3 冠枝已被「部分滿足」或「雙素材就緒」
     */
    function scanBoardCraftableState() {
        const boardT2Counts = {};
        const craftableT3Set = new Set();
        const readyNowT3Set = new Set();
        const presentT2Set = new Set();

        const st = G && G.state;
        const EvoSys = GameApp.systems && GameApp.systems.evolution;
        const evoData = (GameApp.data && GameApp.data.evolutions) || {};
        const rules = evoData.T2_TO_T3_RULES || {};

        if (st && Array.isArray(st.board) && !st.isGameOver && st.waveState !== 'WAITING_START') {
            for (let i = 0; i < st.board.length; i++) {
                const tower = st.board[i];
                if (!tower) continue;
                const canonicalId = (EvoSys && typeof EvoSys.normalizeNodeId === 'function')
                    ? EvoSys.normalizeNodeId(tower)
                    : tower.type;
                if (tower.tier === 2) {
                    boardT2Counts[canonicalId] = (boardT2Counts[canonicalId] || 0) + 1;
                    presentT2Set.add(canonicalId);
                }
            }
        }

        Object.keys(rules).forEach((ruleKey) => {
            const rule = rules[ruleKey];
            if (!rule || !Array.isArray(rule.options)) return;
            const [ingA, ingB] = ruleKey.split('+');
            const cntA = boardT2Counts[ingA] || 0;
            const cntB = boardT2Counts[ingB] || 0;
            const hasPartial = cntA > 0 || cntB > 0;
            const isFullReady = ingA === ingB ? cntA >= 2 : (cntA >= 1 && cntB >= 1);

            if (hasPartial) {
                rule.options.forEach((optId) => {
                    craftableT3Set.add(optId);
                    if (isFullReady) readyNowT3Set.add(optId);
                });
            }
        });

        return { boardT2Counts, presentT2Set, craftableT3Set, readyNowT3Set };
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
                        <span class="wt-detail-title">世界樹原核</span>
                        <span class="wt-detail-tag num">已喚醒枝脈：${totalUnlocked} / 21</span>
                    </div>
                    <div class="wt-detail-row"><strong>進化脈絡：</strong>根芽 (1x) ➔ 主幹 (2x 純血 / 異系共生) ➔ 冠枝 (4x 分岔或同血脈定向催熟)</div>
                    <div class="wt-detail-row"><strong>戰術指引：</strong>點擊上方任一節點可檢視合成路徑、機制與搭配；場上已有對應 T2 主幹時，可進化冠枝將以琥珀金框提示。</div>
                </div>
            `;
            return;
        }

        const tCfg = towersDict[nodeId] || {};
        const custom = (entries.towers && entries.towers[nodeId]) || codexData.buildFallbackTowerCard(nodeId, tCfg);
        const unlocked = isEntryUnlocked(`tower:${nodeId}`, Boolean(custom.defaultUnlocked));
        const isReadyNow = scanState.readyNowT3Set.has(nodeId);
        const isCraftable = scanState.craftableT3Set.has(nodeId);
        const tierNum = nodeMeta.tier || Number(tCfg.nodeTier) || 1;
        const costMult = tierNum === 1 ? '1x' : (tierNum === 2 ? '2x' : '4x');
        const starStr = tierNum === 1 ? '★' : (tierNum === 2 ? '★★' : '★★★');

        detailEl.className = `wt-detail-card family-${nodeMeta.family}${unlocked ? '' : ' is-locked'}${isCraftable ? ' is-craftable' : ''}`;

        const statusBadge = unlocked
            ? '<span class="codex-status-badge unlocked">✅ 已解鎖</span>'
            : '<span class="codex-status-badge locked">🔒 未解鎖</span>';
        const craftBadge = isReadyNow
            ? '<span class="wt-detail-craft-badge ready">雙素材就緒·可直接融合</span>'
            : (isCraftable ? '<span class="wt-detail-craft-badge">場上已有 T2 素材·可進化方向</span>' : '');

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
                    <span class="wt-detail-tag num">Tier ${tierNum} · 成本 ${costMult}</span>
                    ${statusBadge}${craftBadge}
                </div>
                <div class="wt-detail-row"><strong>進化合成路徑：</strong><span class="num">${custom.formula || tCfg.lineagePath || '基礎召喚'}</span></div>
                <div class="wt-detail-row"><strong>核心機制：</strong><span class="num">${custom.mech || custom.desc || ''}</span></div>
                <div class="wt-detail-row"><strong>推薦搭配：</strong>${custom.synergy || ''}</div>
            `;
        } else {
            bodyEl.innerHTML = `
                <div class="wt-detail-top">
                    <span class="wt-detail-title">？？？ · 未知世界樹節點 <span class="num">${starStr}</span></span>
                    <span class="wt-detail-tag num">Tier ${tierNum} · 成本 ${costMult}</span>
                    ${statusBadge}${craftBadge}
                </div>
                <div class="wt-detail-row"><strong>解鎖條件：</strong>${custom.unlockRule || '於戰場合成此防禦塔即可點亮枝脈。'}</div>
                <div class="wt-detail-row">${isCraftable ? '⚡ 戰術提醒：當前場上已持有可通往此冠枝的 T2 主幹素材，於棋盤拖曳相容主幹即可解鎖！' : '合成並喚醒該節點後，即永久記錄於圖鑑與本機存檔。'}</div>
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
     * 渲染互動式 SVG 世界樹演化圖譜（底部原核 -> 3 根芽 -> 6 主幹 -> 12 冠枝）
     */
    function renderWorldTreeCodex(treeShellEl) {
        if (!treeShellEl) return;
        treeShellEl.innerHTML = '';

        const scanState = scanBoardCraftableState();
        const craftableNames = Array.from(scanState.craftableT3Set)
            .map(id => WORLD_TREE_LAYOUT[id] ? WORLD_TREE_LAYOUT[id].label : id);

        const bannerEl = document.createElement('div');
        bannerEl.className = `wt-tactical-banner${scanState.craftableT3Set.size > 0 ? ' has-matches' : ''}`;
        if (scanState.craftableT3Set.size > 0) {
            bannerEl.innerHTML = `<span class="wt-banner-dot"></span><span class="num">場上 T2 素材偵測：可朝 <strong>${craftableNames.join('、')}</strong> 方向進化（琥珀金框標示）</span>`;
        } else {
            bannerEl.innerText = '點擊世界樹任一節點可檢視合成路徑與數值；戰局中場上出現 T2 主幹時將自動高亮可進化冠枝。';
        }
        treeShellEl.appendChild(bannerEl);

        const stageEl = document.createElement('div');
        stageEl.className = 'world-tree-stage';

        // 建立 SVG 樹枝層
        const svgNS = 'http://www.w3.org/2000/svg';
        const svgEl = document.createElementNS(svgNS, 'svg');
        svgEl.setAttribute('class', 'wt-edge-svg');
        svgEl.setAttribute('viewBox', `0 0 ${TREE_VIEW_W} ${TREE_VIEW_H}`);
        svgEl.setAttribute('preserveAspectRatio', 'none');
        svgEl.setAttribute('aria-hidden', 'true');

        // 繪製三層階級微弱橫向參考線（T3 / T2 / T1）
        [40, 128, 214].forEach((rowY) => {
            const guide = document.createElementNS(svgNS, 'line');
            guide.setAttribute('x1', '16');
            guide.setAttribute('x2', String(TREE_VIEW_W - 16));
            guide.setAttribute('y1', String(rowY));
            guide.setAttribute('y2', String(rowY));
            guide.setAttribute('class', 'wt-tier-guide');
            svgEl.appendChild(guide);
        });

        // 先繪製暗色枝脈與定向虛線，再繪製已點亮／場上可進化枝脈以確保層級清晰
        const orderedEdges = WORLD_TREE_EDGES.slice().sort((a, b) => {
            const score = (e) => {
                if (scanState.craftableT3Set.has(e.to)) return 3;
                if (isEntryUnlocked(`tower:${e.to}`, e.to.endsWith('_bud'))) return 2;
                return e.kind === 'directed' ? 0 : 1;
            };
            return score(a) - score(b);
        });

        orderedEdges.forEach((edge) => {
            const toMeta = WORLD_TREE_LAYOUT[edge.to];
            const toUnlocked = toMeta && (toMeta.tier === 1 || isEntryUnlocked(`tower:${edge.to}`, false));
            const isCraftEdge = scanState.craftableT3Set.has(edge.to)
                && (scanState.presentT2Set.has(edge.from) || edge.from === 'world_core');
            const isSelectedEdge = edge.to === selectedTreeNodeId || edge.from === selectedTreeNodeId;

            const pathEl = document.createElementNS(svgNS, 'path');
            pathEl.setAttribute('d', buildTreeEdgePathD(edge));
            let strokeColor = '#46544C';
            let strokeWidth = edge.kind === 'directed' ? 1.4 : 1.8;
            let opacity = edge.kind === 'directed' ? '0.52' : '0.88';

            if (isCraftEdge) {
                strokeColor = '#D97724';
                strokeWidth = 2.6;
                opacity = '1';
            } else if (toUnlocked && edge.kind !== 'directed') {
                strokeColor = FAMILY_STROKE_COLORS[edge.family] || '#B8C2BC';
                strokeWidth = 2.3;
                opacity = '0.95';
            } else if (isSelectedEdge && edge.kind === 'directed') {
                strokeColor = '#D97724';
                strokeWidth = 2.0;
                opacity = '0.9';
            }

            pathEl.setAttribute('fill', 'none');
            pathEl.setAttribute('stroke', strokeColor);
            pathEl.setAttribute('stroke-width', String(strokeWidth));
            pathEl.setAttribute('stroke-opacity', opacity);
            pathEl.setAttribute('stroke-linecap', 'round');
            if (edge.kind === 'directed') {
                pathEl.setAttribute('stroke-dasharray', '4 4');
            }
            svgEl.appendChild(pathEl);
        });
        stageEl.appendChild(svgEl);

        // 建立左側階級標籤
        const tierMarks = [
            { y: 40, text: 'T3 冠枝' },
            { y: 128, text: 'T2 主幹' },
            { y: 214, text: 'T1 根芽' },
            { y: 278, text: '原核' }
        ];
        tierMarks.forEach((tm) => {
            const badge = document.createElement('span');
            badge.className = 'wt-tier-label';
            badge.style.top = `${(tm.y / TREE_VIEW_H) * 100}%`;
            badge.innerText = tm.text;
            stageEl.appendChild(badge);
        });

        // 建立 22 個可點擊節點（1 原核 + 21 世界樹節點）
        const nodesLayer = document.createElement('div');
        nodesLayer.className = 'wt-nodes-layer';

        const detailEl = document.createElement('div');
        detailEl.className = 'wt-detail-card';

        const codexEntries = (getCodexData().CODEX_ENTRIES && getCodexData().CODEX_ENTRIES.towers) || {};

        Object.keys(WORLD_TREE_LAYOUT).forEach((nodeId) => {
            const meta = WORLD_TREE_LAYOUT[nodeId];
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.dataset.nodeId = nodeId;
            btn.style.left = `${(meta.x / TREE_VIEW_W) * 100}%`;
            btn.style.top = `${(meta.y / TREE_VIEW_H) * 100}%`;

            if (nodeId === 'world_core') {
                btn.className = `wt-node wt-node-core${selectedTreeNodeId === 'world_core' ? ' is-selected' : ''}`;
                btn.innerHTML = `<span class="wt-core-icon">🌳</span><span class="wt-node-caption">世界樹原核</span>`;
                btn.addEventListener('click', () => {
                    selectedTreeNodeId = 'world_core';
                    nodesLayer.querySelectorAll('.wt-node').forEach(el => el.classList.toggle('is-selected', el.dataset.nodeId === selectedTreeNodeId));
                    renderWorldTreeDetail(detailEl, selectedTreeNodeId, scanState);
                });
                nodesLayer.appendChild(btn);
                return;
            }

            const entryInfo = codexEntries[nodeId] || {};
            const unlocked = isEntryUnlocked(`tower:${nodeId}`, Boolean(entryInfo.defaultUnlocked) || meta.tier === 1);
            const isCraftable = scanState.craftableT3Set.has(nodeId);
            const isReadyNow = scanState.readyNowT3Set.has(nodeId);
            const isPresentT2 = scanState.presentT2Set.has(nodeId);

            btn.className = [
                'wt-node',
                `wt-tier-${meta.tier}`,
                `wt-family-${meta.family}`,
                unlocked ? 'is-unlocked' : 'is-locked',
                isCraftable ? 'wt-craftable' : '',
                isReadyNow ? 'wt-ready-now' : '',
                isPresentT2 ? 'wt-on-board' : '',
                selectedTreeNodeId === nodeId ? 'is-selected' : ''
            ].filter(Boolean).join(' ');

            const canvasWrap = document.createElement('span');
            canvasWrap.className = 'wt-node-icon-box';
            const cSize = meta.tier === 3 ? 28 : 32;
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
            if (isPresentT2) {
                const bTag = document.createElement('span');
                bTag.className = 'wt-board-pip num';
                bTag.innerText = String(scanState.boardT2Counts[nodeId] || 1);
                bTag.title = '當前棋盤持有數量';
                canvasWrap.appendChild(bTag);
            }

            const cap = document.createElement('span');
            cap.className = 'wt-node-caption num';
            cap.innerText = unlocked ? meta.label : (meta.branch ? `${meta.branch} ???` : '???');

            btn.appendChild(canvasWrap);
            btn.appendChild(cap);

            if (GameApp.renderer && typeof GameApp.renderer.drawPortrait === 'function') {
                GameApp.renderer.drawPortrait(canvasEl, 'tower', nodeId, {
                    size: cSize,
                    tier: meta.tier,
                    silhouette: !unlocked
                });
            }

            btn.addEventListener('click', () => {
                selectedTreeNodeId = nodeId;
                nodesLayer.querySelectorAll('.wt-node').forEach(el => el.classList.toggle('is-selected', el.dataset.nodeId === selectedTreeNodeId));
                renderWorldTreeDetail(detailEl, selectedTreeNodeId, scanState);
            });
            nodesLayer.appendChild(btn);
        });

        stageEl.appendChild(nodesLayer);
        treeShellEl.appendChild(stageEl);

        // 預設預選場上第一個可進化冠枝，讓玩家一打開即可看到戰術建議
        if (scanState.craftableT3Set.size > 0 && !scanState.craftableT3Set.has(selectedTreeNodeId)) {
            selectedTreeNodeId = Array.from(scanState.craftableT3Set)[0];
            nodesLayer.querySelectorAll('.wt-node').forEach(el => el.classList.toggle('is-selected', el.dataset.nodeId === selectedTreeNodeId));
        }

        renderWorldTreeDetail(detailEl, selectedTreeNodeId, scanState);
        treeShellEl.appendChild(detailEl);
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
                    ? '<span class="codex-status-badge unlocked">✅ 已解鎖</span>'
                    : '<span class="codex-status-badge locked">🔒 未解鎖</span>';
                const headerHtml = unlocked
                    ? `<strong>${card.title}</strong> ${statusBadge}`
                    : `<strong>？？？ · 未知節點</strong> ${statusBadge}`;
                const descHtml = unlocked ? (card.mech || card.desc) : `🔒 解鎖條件：${card.unlockRule || '於戰場召喚或合成解鎖'}`;

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
                    ? '<span class="codex-status-badge unlocked">✅ 已解鎖</span>'
                    : '<span class="codex-status-badge locked">🔒 未解鎖</span>';
                const headerHtml = unlocked
                    ? `<strong>${card.title}</strong> <span class="num" style="font-size:12px;color:#E0B43C;">｜${card.subtitle || ''}</span> ${statusBadge}`
                    : `<strong>？？？ · 未知魔物</strong> ${statusBadge}`;
                const descHtml = unlocked
                    ? card.desc
                    : `🔒 解鎖條件：${card.unlockRule || '於戰場遭遇此魔物後自動解鎖彩圖與弱點情報。'}`;

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
            { id: 'fusion', label: '世界樹演化圖譜' },
            { id: 'monsters', label: '入侵魔物' },
            { id: 'terrain', label: '戰術地形' }
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
