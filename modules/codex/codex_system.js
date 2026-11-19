/**
 * ============================================================================
 * 【檔案名稱】：modules/codex/codex_system.js
 * 【負責功能】：圖鑑解鎖紀錄持久化（localStorage）、透過 Object.keys() 動態掃描角色／怪物／地形資料表，
 *               並為每張圖鑑卡渲染左側 64×64 專屬肖像（已解鎖彩色 2.5D 圖案 vs. 未解鎖純黑神秘剪影）。
 * 【讀取資料】：讀取 codex_data.js、tower_data.js、evolution_data.js、monster_data.js、terrain_data.js。
 * 【常見修改入口】：
 *   1. 修改圖鑑卡片 64×64 圖片框或鎖定剪影顯示邏輯：修改 renderCodexModal()、createCodexCardElement()。
 *   2. 修改圖鑑解鎖存檔邏輯：修改 unlockEntry()、isEntryUnlocked()。
 * ============================================================================
 */
(function (global) {
    'use strict';

    const GameApp = global.GameApp = global.GameApp || {};
    const CONFIG = GameApp.config || {};

    let G = null;
    let currentCategory = 'fusion';
    const unlockedSet = loadUnlockedSet();

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
     * 建立單張圖鑑卡片 DOM（左側 64x64 Canvas 肖像框 ＋ 右側標題／說明／解鎖狀態）
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
        const evoData = (GameApp.data && GameApp.data.evolutions) || {};
        const monstersDict = (GameApp.data && GameApp.data.monsters && GameApp.data.monsters.MONSTER_DATABASE) || {};
        const terrainsDict = (GameApp.data && GameApp.data.terrain && GameApp.data.terrain.TERRAIN_TYPES) || {};

        if (category === 'fusion') {
            const hybridKeys = Object.keys(towersDict).filter(k => Boolean(towersDict[k] && towersDict[k].isHybrid));
            hybridKeys.forEach((key) => {
                const tCfg = towersDict[key];
                const custom = (entries.towers && entries.towers[key]) || codexData.buildFallbackTowerCard(key, tCfg);
                const unlocked = isEntryUnlocked(`tower:${key}`, Boolean(custom.defaultUnlocked));

                let recipeHtml = custom.recipeText;
                if (!entries.towers || !entries.towers[key]) {
                    const recipes = evoData.FUSION_RECIPES || {};
                    const foundPair = Object.keys(recipes).find(rk => recipes[rk] === key);
                    if (foundPair) {
                        const [a, b] = foundPair.split('+');
                        const ta = towersDict[a], tb = towersDict[b];
                        if (ta && tb) {
                            recipeHtml = `${ta.icon} ${ta.name.replace('塔', '')} + ${tb.icon} ${tb.name.replace('塔', '')} = <strong>${tCfg.name}</strong>`;
                        }
                    }
                }
                const statusBadge = unlocked
                    ? '<span class="codex-status-badge unlocked">✅ 已解鎖</span>'
                    : '<span class="codex-status-badge locked">🔒 未解鎖</span>';
                const headerHtml = unlocked
                    ? `${recipeHtml} ${statusBadge}`
                    : `${custom.lockedRecipeText || recipeHtml} ${statusBadge}`;
                const descHtml = unlocked
                    ? custom.desc
                    : `🔒 解鎖條件：${custom.unlockRule || '於戰場中成功合成此融合塔即可解鎖完整圖鑑與彩圖。'}`;

                listEl.appendChild(createCodexCardElement({
                    portraitCat: 'tower',
                    itemKey: key,
                    tier: 2,
                    unlocked,
                    cardClass: custom.cardClass || 'codex-steam',
                    headerHtml,
                    descHtml
                }));
            });
            return;
        }

        if (category === 'towers') {
            const baseKeys = Object.keys(towersDict).filter(k => Boolean(towersDict[k] && !towersDict[k].isHybrid));
            baseKeys.forEach((key) => {
                const tCfg = towersDict[key];
                const card = (entries.towers && entries.towers[key]) || codexData.buildFallbackTowerCard(key, tCfg);
                const unlocked = isEntryUnlocked(`tower:${key}`, card.defaultUnlocked !== false);
                const statusBadge = unlocked
                    ? '<span class="codex-status-badge unlocked">✅ 已解鎖</span>'
                    : '<span class="codex-status-badge locked">🔒 未解鎖</span>';
                const headerHtml = unlocked
                    ? `${card.recipeText || `<strong>${card.title}</strong>`} ${statusBadge}`
                    : `<strong>？？？ · 未知防禦塔</strong> ${statusBadge}`;
                const descHtml = unlocked ? card.desc : `🔒 解鎖條件：${card.unlockRule || '召喚此防禦塔即可解鎖'}`;

                listEl.appendChild(createCodexCardElement({
                    portraitCat: 'tower',
                    itemKey: key,
                    tier: 1,
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
                const headerHtml = `<strong>${card.title}</strong> <span class="num" style="font-size:12px;color:#9BD3E8;">｜${card.subtitle || ''}</span>`;

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
            if (listEl) {
                cardEl.insertBefore(tabsEl, listEl);
            }
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
            { id: 'fusion', label: '跨元素融合' },
            { id: 'towers', label: '基礎防禦塔' },
            { id: 'monsters', label: '入侵魔物' },
            { id: 'terrain', label: '戰術地形' }
        ];

        const tabsEl = cardEl.querySelector('.codex-tabs');
        if (tabsEl) {
            tabsEl.innerHTML = '';
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

        const listEl = cardEl.querySelector('.codex-list');
        if (listEl) {
            renderCategoryItemsInto(listEl, currentCategory);
        }
    }

    function isCodexOpen() {
        return Boolean(G && G.dom && G.dom.codexOverlayEl && !G.dom.codexOverlayEl.classList.contains('hidden'));
    }

    function openCodex() {
        if (!G || !G.dom || !G.dom.codexOverlayEl || isCodexOpen()) return;
        const st = G.state, activeMatch = G.callbacks.isMatchPhaseActive();
        st.pausedBeforeCodex = st.isPaused;
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
        renderCodexModal
    };

    GameApp.systems = GameApp.systems || {};
    GameApp.systems.codex = CodexSystem;
})(window);
