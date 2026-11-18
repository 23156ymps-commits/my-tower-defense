/**
 * ============================================================================
 * 【檔案名稱】：modules/drag/drag_system.js
 * 【負責功能】：統一管理滑鼠與手機觸控 Pointer 拖曳行為，嚴格區分：
 *               1. dragSource: 'shop'（從下方商店卡片拖拉至指定棋盤格召喚，含半透明預覽、射程圈與綠/紅框判定）
 *               2. dragSource: 'board'（棋盤上現有防禦塔拖拉移位或合成融合）
 *               並防止手機觸控拖曳時誤觸瀏覽器捲動。
 * 【讀取資料】：讀取 economy_system.js、terrain_system.js、evolution_system.js、tower_data.js。
 * 【常見修改入口】：
 *   1. 修改商店拖拉指定召喚預覽與放開規則：修改 startShopDrag()、updateShopDrag()、finishShopDrag()。
 *   2. 修改棋盤防禦塔拖曳移位／融合判定：修改 startBoardDrag()、updateBoardDrag()、finishBoardDrag()。
 * ============================================================================
 */
(function (global) {
    'use strict';

    const GameApp = global.GameApp = global.GameApp || {};
    const CONFIG = GameApp.config || {};
    const { coordsToIndex, indexToCoords } = GameApp.helpers || {};

    let G = null;
    let activeDrag = null;
    let globalListenersBound = false;
    let lastPointerDownTs = 0;

    function bind(ctx) {
        G = ctx;
        bindGlobalPointerListeners();
    }

    function isDragging() {
        return Boolean(activeDrag && activeDrag.isDragging);
    }

    function getActiveDrag() {
        return activeDrag;
    }

    function getTowersDict() {
        return (GameApp.data && GameApp.data.towers && GameApp.data.towers.TOWERS) || {};
    }

    /**
     * 建立半透明 2.5D 砲塔拖曳預覽 Ghost 元素
     */
    function createGhostElement(towerType, tier = 1) {
        const Renderer = GameApp.renderer;
        const ghost = document.createElement('div');
        ghost.className = `tower type-${towerType} lv-${tier} touch-drag-ghost shop-drag-ghost`;
        ghost.style.pointerEvents = 'none';
        const cellW = (G && G.boardMetrics && G.boardMetrics.cellW) || 36;
        ghost.style.width = `${Math.round(cellW * 0.96)}px`;
        ghost.style.height = `${Math.round(cellW * 0.96)}px`;

        if (Renderer && typeof Renderer.createTowerSvgParts === 'function') {
            const { baseSvgHtml, headSvgHtml } = Renderer.createTowerSvgParts(towerType, tier);
            ghost.innerHTML = `<div class="tower-base-layer">${baseSvgHtml}</div><div class="tower-head-rotator"><div class="tower-head-recoil">${headSvgHtml}</div></div><div class="tower-name">${Renderer.getTierStars(tier)}</div>`;
        }
        document.body.appendChild(ghost);
        return ghost;
    }

    function positionGhostElement(ghostEl, clientX, clientY) {
        if (!ghostEl) return;
        ghostEl.style.left = `${clientX}px`;
        ghostEl.style.top = `${clientY}px`;
    }

    /**
     * 根據螢幕座標 (clientX, clientY) 解析對應的 15x10 棋盤格索引（若在棋盤外則回傳 null）
     */
    function resolveCellIndexAtPoint(clientX, clientY) {
        if (!Number.isFinite(clientX) || !Number.isFinite(clientY) || !G || !G.dom) return null;

        if (typeof document !== 'undefined' && typeof document.elementFromPoint === 'function') {
            const el = document.elementFromPoint(clientX, clientY);
            const cell = el && el.closest ? el.closest('.cell') : null;
            if (cell && cell.dataset && cell.dataset.index !== undefined) {
                const idx = Number(cell.dataset.index);
                if (Number.isFinite(idx) && idx >= 0 && idx < (CONFIG.BOARD_SIZE || 150)) {
                    return idx;
                }
            }
        }

        // 若指標剛好落在棋盤格間 4px 空隙內，使用棋盤幾何矩形精準換算格子
        const boardEl = G.dom.boardElement;
        if (!boardEl || typeof boardEl.getBoundingClientRect !== 'function') return null;
        const rect = boardEl.getBoundingClientRect();
        if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) {
            return null;
        }
        const cols = CONFIG.BOARD_COLS || 15;
        const rows = CONFIG.BOARD_ROWS || 10;
        const relX = (clientX - rect.left) / Math.max(1, rect.width);
        const relY = (clientY - rect.top) / Math.max(1, rect.height);
        const gx = Math.min(cols - 1, Math.max(0, Math.floor(relX * cols)));
        const gy = Math.min(rows - 1, Math.max(0, Math.floor(relY * rows)));
        return coordsToIndex(gx, gy);
    }

    /**
     * 判定商店拖拉召喚在指定格子是否合法（須為可建塔地形且該格無塔）
     */
    function isShopDropValidAt(cellIndex) {
        if (cellIndex === null || cellIndex === undefined || !G || !G.state) return false;
        const TerrainSys = GameApp.systems && GameApp.systems.terrain;
        const canBuild = TerrainSys ? TerrainSys.canBuildAt(cellIndex) : !G.map.pathCellIndices.has(cellIndex);
        return Boolean(canBuild && G.state.board[cellIndex] === null);
    }

    /**
     * 判定棋盤現有防禦塔拖拉至目標格是否合法（合法移位或合法同星合成）
     */
    function isBoardDropValidAt(sourceIndex, targetIndex) {
        if (targetIndex === null || targetIndex === undefined || sourceIndex === targetIndex || !G || !G.state) return false;
        const st = G.state;
        const fromTower = st.board[sourceIndex];
        if (!fromTower) return false;

        const TerrainSys = GameApp.systems && GameApp.systems.terrain;
        const canBuild = TerrainSys ? TerrainSys.canBuildAt(targetIndex) : !G.map.pathCellIndices.has(targetIndex);
        if (!canBuild) return false;

        const toTower = st.board[targetIndex];
        if (toTower === null) {
            const EconSys = GameApp.systems && GameApp.systems.economy;
            const freeMove = G.callbacks.isRelocationFree();
            return EconSys ? EconSys.canAffordCombatMove(freeMove) : (freeMove || st.currentGold >= 5);
        }

        const EvoSys = GameApp.systems && GameApp.systems.evolution;
        return EvoSys ? EvoSys.canCombineTowers(fromTower, toTower) : false;
    }

    function updateDragVisualFeedback(clientX, clientY) {
        if (!activeDrag || !G) return;
        const Renderer = GameApp.renderer;
        const AttackSys = GameApp.systems && GameApp.systems.towerAttack;

        positionGhostElement(activeDrag.ghostEl, clientX, clientY);
        Renderer.clearCellDragHighlights();

        const cellIndex = resolveCellIndexAtPoint(clientX, clientY);
        activeDrag.hoveredCellIndex = cellIndex;

        if (activeDrag.dragSource === 'shop') {
            const towerProbe = { type: activeDrag.towerType, tier: activeDrag.tier || 1 };
            if (cellIndex !== null && G.cellElements[cellIndex]) {
                const valid = isShopDropValidAt(cellIndex);
                const cellEl = G.cellElements[cellIndex];
                cellEl.classList.add(valid ? 'drag-valid-build' : 'drag-invalid');
                if (valid) cellEl.classList.add('drag-over');

                const coords = indexToCoords(cellIndex);
                const center = Renderer.getCellCenter(coords.x, coords.y);
                const radiusPx = AttackSys
                    ? AttackSys.getTowerRangePx(towerProbe, valid ? cellIndex : null)
                    : (2.0 * G.boardMetrics.step);
                Renderer.showDragRangePreview(center.left, center.top, radiusPx, activeDrag.towerType);
            } else {
                const stageEl = G.dom.boardStageEl;
                const rect = stageEl && typeof stageEl.getBoundingClientRect === 'function' ? stageEl.getBoundingClientRect() : null;
                if (rect && clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom) {
                    const radiusPx = AttackSys ? AttackSys.getTowerRangePx(towerProbe, null) : (2.0 * G.boardMetrics.step);
                    Renderer.showDragRangePreview(clientX - rect.left, clientY - rect.top, radiusPx, activeDrag.towerType);
                } else if (G.dom.rangeCircleEl) {
                    G.dom.rangeCircleEl.className = '';
                }
            }
            return;
        }

        if (activeDrag.dragSource === 'board') {
            const srcTower = G.state.board[activeDrag.sourceIndex];
            if (!srcTower) return;
            if (cellIndex !== null && G.cellElements[cellIndex] && cellIndex !== activeDrag.sourceIndex) {
                const valid = isBoardDropValidAt(activeDrag.sourceIndex, cellIndex);
                const cellEl = G.cellElements[cellIndex];
                cellEl.classList.add(valid ? 'drag-valid-build' : 'drag-invalid');
                if (valid) cellEl.classList.add('drag-over');

                const coords = indexToCoords(cellIndex);
                const center = Renderer.getCellCenter(coords.x, coords.y);
                const radiusPx = AttackSys ? AttackSys.getTowerRangePx(srcTower, valid ? cellIndex : activeDrag.sourceIndex) : (2.0 * G.boardMetrics.step);
                Renderer.showDragRangePreview(center.left, center.top, radiusPx, srcTower.type);
            } else {
                const coords = indexToCoords(activeDrag.sourceIndex);
                const center = Renderer.getCellCenter(coords.x, coords.y);
                const radiusPx = AttackSys ? AttackSys.getTowerRangePx(srcTower, activeDrag.sourceIndex) : (2.0 * G.boardMetrics.step);
                Renderer.showDragRangePreview(center.left, center.top, radiusPx, srcTower.type);
            }
        }
    }

    /**
     * 啟動商店卡片拖拉指定召喚（dragSource: 'shop'）
     */
    function startShopDrag(towerType, btnEl, clientX, clientY, pointerId = null) {
        if (!G || !G.callbacks.isGameplayActive()) return false;
        const towersDict = getTowersDict();
        const tCfg = towersDict[towerType];
        if (!tCfg) return false;

        if (GameApp.backend && typeof GameApp.backend.recordPlayerAction === 'function') {
            GameApp.backend.recordPlayerAction();
        }

        const EconSys = GameApp.systems && GameApp.systems.economy;
        const cost = EconSys ? EconSys.getSummonCost(towerType) : 10;
        if (!EconSys || !EconSys.canAffordSummon(towerType)) {
            if (G.dom.msgText) {
                G.dom.msgText.innerText = `❌ 金幣不足，無法召喚【${tCfg.name}】！需要 ${cost} 💰`;
            }
            if (btnEl) {
                btnEl.classList.remove('shake-anim', 'insufficient-gold');
                void btnEl.offsetWidth;
                btnEl.classList.add('shake-anim', 'insufficient-gold');
                setTimeout(() => btnEl.classList.remove('insufficient-gold'), 450);
            }
            return false;
        }

        cancelActiveDrag({ silent: true });

        const TreeSys = GameApp.systems && GameApp.systems.tree;
        const seedInterval = (GameApp.data && GameApp.data.tree && GameApp.data.tree.TREE_CONFIG && GameApp.data.tree.TREE_CONFIG.BLESSING_SEED_INTERVAL) || 5;
        const nextTier = (TreeSys && TreeSys.hasBlessing('abundant_seed') && (G.state.seedPityCount + 1) >= seedInterval) ? 2 : 1;

        G.state.selectedIndex = null;
        G.state.buildTargetIndex = null;
        G.state.hoveredIndex = null;
        GameApp.renderer.renderBoard([]);

        const ghostEl = createGhostElement(towerType, nextTier);
        positionGhostElement(ghostEl, clientX, clientY);
        if (btnEl) btnEl.classList.add('dragging-card');

        activeDrag = {
            dragSource: 'shop',
            pointerId,
            towerType,
            tier: nextTier,
            btnEl,
            startX: clientX,
            startY: clientY,
            currentX: clientX,
            currentY: clientY,
            isDragging: true,
            movedDistance: 0,
            hoveredCellIndex: null,
            ghostEl
        };

        if (G.dom.msgText) {
            G.dom.msgText.innerText = `🎯 拖曳【${tCfg.icon} ${tCfg.name}】至棋盤綠色空地放開即可召喚（花費 ${cost} 💰）`;
        }
        updateDragVisualFeedback(clientX, clientY);
        return true;
    }

    /**
     * 啟動棋盤防禦塔拖拉移位或合成（dragSource: 'board'）
     */
    function startBoardDrag(sourceIndex, towerEl, towerObj, clientX, clientY, pointerId = null) {
        if (!G || !G.callbacks.isGameplayActive() || !towerObj) return false;
        if (GameApp.backend && typeof GameApp.backend.recordPlayerAction === 'function') {
            GameApp.backend.recordPlayerAction();
        }
        cancelActiveDrag({ silent: true });

        activeDrag = {
            dragSource: 'board',
            pointerId,
            sourceIndex,
            towerEl,
            towerObj,
            towerType: towerObj.type,
            tier: towerObj.tier,
            startX: clientX,
            startY: clientY,
            currentX: clientX,
            currentY: clientY,
            isDragging: false,
            movedDistance: 0,
            hoveredCellIndex: sourceIndex,
            ghostEl: null
        };
        return true;
    }

    function handleMovePoint(clientX, clientY) {
        if (!activeDrag || !G) return;
        activeDrag.currentX = clientX;
        activeDrag.currentY = clientY;
        activeDrag.movedDistance = Math.hypot(clientX - activeDrag.startX, clientY - activeDrag.startY);

        if (activeDrag.dragSource === 'board' && !activeDrag.isDragging && activeDrag.movedDistance > 6) {
            activeDrag.isDragging = true;
            G.state.draggedIndex = activeDrag.sourceIndex;
            G.state.selectedIndex = null;
            G.state.buildTargetIndex = null;
            G.state.hoveredIndex = null;
            if (activeDrag.towerEl) activeDrag.towerEl.classList.add('dragging');
            activeDrag.ghostEl = createGhostElement(activeDrag.towerType, activeDrag.tier);
            const tCfg = getTowersDict()[activeDrag.towerType];
            if (G.dom.msgText && tCfg) {
                G.dom.msgText.innerText = `抓起【${tCfg.name} ${GameApp.renderer.getTierStars(activeDrag.tier)}】— 拖至空地移位或同星塔合成`;
            }
            G.callbacks.updateTowerInspector();
        }

        if (activeDrag.isDragging) {
            updateDragVisualFeedback(clientX, clientY);
        }
    }

    function finishActiveDrag(clientX, clientY) {
        if (!activeDrag || !G) return;
        const drag = activeDrag;
        const finalX = Number.isFinite(clientX) ? clientX : drag.currentX;
        const finalY = Number.isFinite(clientY) ? clientY : drag.currentY;
        const targetIndex = resolveCellIndexAtPoint(finalX, finalY);

        if (drag.dragSource === 'shop') {
            const towerType = drag.towerType;
            const validDrop = isShopDropValidAt(targetIndex);
            cancelActiveDrag({ silent: true });
            G.state.lastTouchDragEndTime = performance.now();

            if (validDrop) {
                G.callbacks.spawnTowerAtCell(towerType, targetIndex);
            } else {
                if (GameApp.backend && typeof GameApp.backend.trackFeel === 'function') {
                    GameApp.backend.trackFeel('Feel:DragCancel:shop', 1, {
                        towerType,
                        targetIndex
                    });
                }
                if (G.dom.msgText) {
                    if (targetIndex !== null) {
                        const isPath = G.map.pathCellIndices.has(targetIndex);
                        const hasTower = G.state.board[targetIndex] !== null;
                        G.dom.msgText.innerText = isPath
                            ? '⚠️ 怪物跑道禁止建塔，已取消召喚（未扣金幣）。'
                            : (hasTower ? '⚠️ 該格已有防禦塔，請拖曳至空白草地召喚（未扣金幣）。' : '⚠️ 該地形禁止建塔，已取消召喚（未扣金幣）。');
                    } else {
                        G.dom.msgText.innerText = '已取消拖曳召喚（未扣金幣）。';
                    }
                }
                GameApp.renderer.updateRangeIndicator();
            }
            return;
        }

        if (drag.dragSource === 'board') {
            const wasDragging = drag.isDragging;
            const sourceIndex = drag.sourceIndex;
            cancelActiveDrag({ silent: true });
            if (wasDragging) {
                G.state.lastTouchDragEndTime = performance.now();
                if (targetIndex !== null && targetIndex !== sourceIndex && isBoardDropValidAt(sourceIndex, targetIndex)) {
                    G.callbacks.handleAction(sourceIndex, targetIndex);
                } else {
                    if (GameApp.backend && typeof GameApp.backend.trackFeel === 'function') {
                        GameApp.backend.trackFeel('Feel:DragCancel:board', 1, {
                            sourceIndex,
                            targetIndex
                        });
                    }
                    if (targetIndex !== null && targetIndex !== sourceIndex) {
                        G.callbacks.handleAction(sourceIndex, targetIndex);
                    } else {
                        GameApp.renderer.updateRangeIndicator();
                    }
                }
            }
        }
    }

    function cancelActiveDrag(options = {}) {
        if (!activeDrag) return;
        const drag = activeDrag;
        activeDrag = null;

        if (drag.ghostEl) drag.ghostEl.remove();
        if (drag.btnEl) drag.btnEl.classList.remove('dragging-card');
        if (drag.towerEl) drag.towerEl.classList.remove('dragging');
        if (G && G.state) G.state.draggedIndex = null;

        if (GameApp.renderer) {
            GameApp.renderer.clearCellDragHighlights();
            if (!options.silent) GameApp.renderer.updateRangeIndicator();
            else if (G && G.dom && G.dom.rangeCircleEl) G.dom.rangeCircleEl.className = '';
        }
    }

    /**
     * 綁定下方商店召喚卡片的拖拉召喚事件（支援 Pointer / Mouse / Touch）
     */
    function bindShopCardElement(btnEl, towerType) {
        if (!btnEl) return;
        btnEl.style.touchAction = 'none';
        btnEl.setAttribute('draggable', 'false');
        btnEl.addEventListener('dragstart', e => e.preventDefault());

        btnEl.addEventListener('pointerdown', (e) => {
            if (e.button !== undefined && e.button !== 0) return;
            lastPointerDownTs = Date.now();
            if (e.pointerType === 'touch') G.callbacks.activateTouchMode();
            e.preventDefault();
            GameApp.audio.ensureContext();
            startShopDrag(towerType, btnEl, e.clientX, e.clientY, e.pointerId);
        });

        btnEl.addEventListener('mousedown', (e) => {
            if (Date.now() - lastPointerDownTs < 80 || (e.button !== undefined && e.button !== 0)) return;
            e.preventDefault();
            GameApp.audio.ensureContext();
            startShopDrag(towerType, btnEl, e.clientX, e.clientY, null);
        });

        btnEl.addEventListener('touchstart', (e) => {
            if (Date.now() - lastPointerDownTs < 80 || e.touches.length !== 1) return;
            G.callbacks.activateTouchMode();
            const t = e.touches[0];
            GameApp.audio.ensureContext();
            if (startShopDrag(towerType, btnEl, t.clientX, t.clientY, null)) {
                e.preventDefault();
            }
        }, { passive: false });
    }

    /**
     * 綁定棋盤上防禦塔元素的拖拉移位／融合事件
     */
    function bindBoardTowerElement(towerEl, index, towerObj) {
        if (!towerEl) return;
        towerEl.style.touchAction = 'none';
        towerEl.setAttribute('draggable', 'false');
        towerEl.addEventListener('dragstart', e => e.preventDefault());

        towerEl.addEventListener('pointerdown', (e) => {
            if (e.button !== undefined && e.button !== 0) return;
            lastPointerDownTs = Date.now();
            if (e.pointerType === 'touch') G.callbacks.activateTouchMode();
            startBoardDrag(index, towerEl, towerObj, e.clientX, e.clientY, e.pointerId);
        });

        towerEl.addEventListener('mousedown', (e) => {
            if (Date.now() - lastPointerDownTs < 80 || (e.button !== undefined && e.button !== 0)) return;
            startBoardDrag(index, towerEl, towerObj, e.clientX, e.clientY, null);
        });

        towerEl.addEventListener('touchstart', (e) => {
            if (Date.now() - lastPointerDownTs < 80 || e.touches.length !== 1) return;
            G.callbacks.activateTouchMode();
            const t = e.touches[0];
            startBoardDrag(index, towerEl, towerObj, t.clientX, t.clientY, null);
        }, { passive: true });
    }

    function bindBoardCellElement(cellEl, index) {
        if (!cellEl) return;
        cellEl.addEventListener('dragover', (e) => {
            e.preventDefault();
            const TerrainSys = GameApp.systems && GameApp.systems.terrain;
            const valid = TerrainSys ? TerrainSys.canBuildAt(index) : !G.map.pathCellIndices.has(index);
            cellEl.classList.add(valid ? 'drag-over' : 'drag-invalid');
        });
        cellEl.addEventListener('dragleave', () => cellEl.classList.remove('drag-over', 'drag-valid-build', 'drag-invalid'));
    }

    function bindGlobalPointerListeners() {
        if (globalListenersBound || typeof document === 'undefined') return;
        globalListenersBound = true;

        document.addEventListener('pointermove', (e) => {
            if (!activeDrag) return;
            if (activeDrag.pointerId !== null && e.pointerId !== undefined && e.pointerId !== activeDrag.pointerId) return;
            if (activeDrag.isDragging && e.cancelable) e.preventDefault();
            handleMovePoint(e.clientX, e.clientY);
        }, { passive: false });

        document.addEventListener('pointerup', (e) => {
            if (!activeDrag) return;
            if (activeDrag.pointerId !== null && e.pointerId !== undefined && e.pointerId !== activeDrag.pointerId) return;
            finishActiveDrag(e.clientX, e.clientY);
        });

        document.addEventListener('pointercancel', () => {
            if (!activeDrag) return;
            const src = activeDrag.dragSource;
            cancelActiveDrag();
            if (GameApp.backend && typeof GameApp.backend.trackFeel === 'function') {
                GameApp.backend.trackFeel(`Feel:DragCancel:${src}`, 1);
            }
        });

        // 傳統 Mouse / Touch 備援（供不發送 PointerEvent 的測試環境或舊裝置使用）
        document.addEventListener('mousemove', (e) => {
            if (!activeDrag || activeDrag.pointerId !== null) return;
            handleMovePoint(e.clientX, e.clientY);
        });

        document.addEventListener('mouseup', (e) => {
            if (!activeDrag || activeDrag.pointerId !== null) return;
            finishActiveDrag(e.clientX, e.clientY);
        });

        document.addEventListener('touchmove', (e) => {
            if (!activeDrag || e.touches.length !== 1) return;
            if (activeDrag.isDragging && e.cancelable) e.preventDefault();
            const t = e.touches[0];
            handleMovePoint(t.clientX, t.clientY);
        }, { passive: false });

        document.addEventListener('touchend', (e) => {
            if (!activeDrag || activeDrag.pointerId !== null) return;
            const t = e.changedTouches && e.changedTouches[0];
            finishActiveDrag(t ? t.clientX : activeDrag.currentX, t ? t.clientY : activeDrag.currentY);
        });

        document.addEventListener('touchcancel', () => {
            if (activeDrag) cancelActiveDrag();
        });
    }

    const DragSystem = {
        bind,
        isDragging,
        getActiveDrag,
        resolveCellIndexAtPoint,
        isShopDropValidAt,
        isBoardDropValidAt,
        startShopDrag,
        startBoardDrag,
        handleMovePoint,
        finishActiveDrag,
        cancelActiveDrag,
        bindShopCardElement,
        bindBoardTowerElement,
        bindBoardCellElement
    };

    GameApp.systems = GameApp.systems || {};
    GameApp.systems.drag = DragSystem;
})(window);
