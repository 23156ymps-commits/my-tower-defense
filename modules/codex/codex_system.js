/**
 * ============================================================================
 * 【檔案名稱】：modules/codex/codex_system.js
 * 【負責功能】：圖鑑解鎖紀錄持久化（localStorage）、透過 Object.keys() 動態掃描角色／怪物／地形資料表，
 *               並支援圖鑑彈窗分類頁籤切換與自動預設卡片渲染。
 * 【讀取資料】：讀取 codex_data.js、tower_data.js、evolution_data.js、monster_data.js、terrain_data.js。
 * 【常見修改入口】：
 *   1. 修改圖鑑彈窗 HTML 渲染結構或預設分頁：修改 renderCodexModal()。
 *   2. 修改圖鑑解鎖存檔邏輯：修改 unlockEntry()、loadUnlockedSet()。
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
        initCodexModalDom();
    }

    function loadUnlockedSet() {
        const set = new Set(['tower:fire', 'tower:ice', 'tower:thunder', 'tower:steam', 'tower:magnet', 'tower:plasma']);
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

    function unlockEntry(entryId) {
        if (!entryId || unlockedSet.has(entryId)) return;
        unlockedSet.add(entryId);
        saveUnlockedSet();
    }

    function getCodexData() {
        return (GameApp.data && GameApp.data.codex) || {};
    }

    function buildCategoryItemsHtml(category) {
        const codexData = getCodexData();
        const entries = codexData.CODEX_ENTRIES || { towers: {}, monsters: {}, terrain: {} };
        const towersDict = (GameApp.data && GameApp.data.towers && GameApp.data.towers.TOWERS) || {};
        const evoData = (GameApp.data && GameApp.data.evolutions) || {};
        const monstersDict = (GameApp.data && GameApp.data.monsters && GameApp.data.monsters.MONSTER_DATABASE) || {};
        const terrainsDict = (GameApp.data && GameApp.data.terrain && GameApp.data.terrain.TERRAIN_TYPES) || {};

        if (category === 'fusion') {
            const hybridKeys = Object.keys(towersDict).filter(k => Boolean(towersDict[k] && towersDict[k].isHybrid));
            return hybridKeys.map((key) => {
                const tCfg = towersDict[key];
                const custom = (entries.towers && entries.towers[key]) || codexData.buildFallbackTowerCard(key, tCfg);
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
                return `<div class="codex-item ${custom.cardClass || 'codex-steam'}">
                    <div class="codex-recipe">${recipeHtml}</div>
                    <div class="codex-desc">${custom.desc}</div>
                </div>`;
            }).join('');
        }

        if (category === 'towers') {
            const baseKeys = Object.keys(towersDict).filter(k => Boolean(towersDict[k] && !towersDict[k].isHybrid));
            return baseKeys.map((key) => {
                const tCfg = towersDict[key];
                const card = (entries.towers && entries.towers[key]) || codexData.buildFallbackTowerCard(key, tCfg);
                return `<div class="codex-item ${card.cardClass || 'codex-steam'}">
                    <div class="codex-recipe">${card.recipeText || `<strong>${card.title}</strong>`}</div>
                    <div class="codex-desc">${card.desc}</div>
                </div>`;
            }).join('');
        }

        if (category === 'monsters') {
            const monsterKeys = Object.keys(monstersDict);
            return monsterKeys.map((key) => {
                const mCfg = monstersDict[key];
                const card = (entries.monsters && entries.monsters[key]) || codexData.buildFallbackMonsterCard(key, mCfg);
                return `<div class="codex-item codex-steam">
                    <div class="codex-recipe"><strong>${card.title}</strong> <span class="num" style="font-size:12px;color:#E0B43C;">｜${card.subtitle || ''}</span></div>
                    <div class="codex-desc">${card.desc}</div>
                </div>`;
            }).join('');
        }

        if (category === 'terrain') {
            const terrainKeys = Object.keys(terrainsDict).filter(k => k !== 'grass' && k !== 'path');
            return terrainKeys.map((key) => {
                const tCfg = terrainsDict[key];
                const card = (entries.terrain && entries.terrain[key]) || {
                    title: `${tCfg.icon || '🗺️'} ${tCfg.name || key}`,
                    subtitle: tCfg.shortTag || '',
                    desc: tCfg.tooltip || ''
                };
                return `<div class="codex-item codex-magnet">
                    <div class="codex-recipe"><strong>${card.title}</strong> <span class="num" style="font-size:12px;color:#9BD3E8;">｜${card.subtitle || ''}</span></div>
                    <div class="codex-desc">${card.desc}</div>
                </div>`;
            }).join('');
        }

        return '';
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
            listEl.innerHTML = buildCategoryItemsHtml(currentCategory);
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
        unlockEntry,
        isCodexOpen,
        openCodex,
        closeCodex,
        renderCodexModal
    };

    GameApp.systems = GameApp.systems || {};
    GameApp.systems.codex = CodexSystem;
})(window);
