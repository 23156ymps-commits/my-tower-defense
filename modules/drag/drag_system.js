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
    let lastPointerEventTs = 0;
    let lastShopDragCompleteTs = 0;

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
        if (!canBuild || G.state.board[cellIndex] !== null) return false;
        const EconSys = GameApp.systems && GameApp.systems.economy;
        if (EconSys && activeDrag && activeDrag.dragSource === 'shop' && activeDrag.towerType) {
            return EconSys.canAffordSummon(activeDrag.towerType, null, null, cellIndex);
        }
        return true;
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

    /**
     * 判定萬能融合果實拖拉至目標格是否合法（場上 1★～4★ 防禦塔）
     */
    function isFruitDropValidAt(cellIndex) {
        if (cellIndex === null || cellIndex === undefined || !G || !G.state) return false;
        const tower = G.state.board[cellIndex];
        if (!tower) return false;
        const maxTier = (GameApp.data && GameApp.data.evolutions && GameApp.data.evolutions.MAX_TIER) || 5;
        return tower.tier >= 1 && tower.tier < maxTier;
    }

    function createFruitGhostElement() {
        const ghost = document.createElement('div');
        ghost.className = 'touch-drag-ghost fruit-drag-ghost';
        ghost.style.pointerEvents = 'none';
        ghost.style.width = '36px';
        ghost.style.height = '36px';
        ghost.style.borderRadius = '50%';
        ghost.style.backgroundColor = '#2C3530';
        ghost.style.border = '2px solid #D97724';
        ghost.style.display = 'flex';
        ghost.style.alignItems = 'center';
        ghost.style.justifyContent = 'center';
        ghost.style.color = '#F4F1EA';
        ghost.style.fontSize = '14px';
        ghost.style.fontWeight = '700';
        ghost.innerText = '★';
        document.body.appendChild(ghost);
        return ghost;
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
                G.state.leylinePreviewEdges = (valid && AttackSys && typeof AttackSys.previewLeylinesForPlacement === 'function')
                    ? AttackSys.previewLeylinesForPlacement(towerProbe, cellIndex, null).edges
                    : null;

                const coords = indexToCoords(cellIndex);
                const center = Renderer.getCellCenter(coords.x, coords.y);
                const radiusPx = AttackSys
                    ? AttackSys.getTowerRangePx(towerProbe, valid ? cellIndex : null)
                    : (2.0 * G.boardMetrics.step);
                Renderer.showDragRangePreview(center.left, center.top, radiusPx, activeDrag.towerType);
            } else {
                G.state.leylinePreviewEdges = null;
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

        if (activeDrag.dragSource === 'fruit') {
            const EvoSys = GameApp.systems && GameApp.systems.evolution;
            if (cellIndex !== null && G.cellElements[cellIndex]) {
                const valid = isFruitDropValidAt(cellIndex);
                const cellEl = G.cellElements[cellIndex];
                cellEl.classList.add(valid ? 'drag-valid-build' : 'drag-invalid');
                if (valid) cellEl.classList.add('drag-over');
                const dstTower = G.state.board[cellIndex];
                G.state.leylinePreviewEdges = null;
                if (dstTower && typeof Renderer.showDragEvolutionPreview === 'function') {
                    const preview = EvoSys && typeof EvoSys.getFruitUpgradePreview === 'function'
                        ? EvoSys.getFruitUpgradePreview(dstTower)
                        : null;
                    if (preview) {
                        Renderer.showDragEvolutionPreview(cellIndex, cellIndex, preview.previewLabel, true);
                    } else {
                        const isEn = Boolean(GameApp.i18n && GameApp.i18n.isEnglish());
                        Renderer.showDragEvolutionPreview(cellIndex, cellIndex, isEn ? 'Max 5★ reached' : '已達 5★ 上限', false);
                    }
                }
            } else if (typeof Renderer.clearDragEvolutionPreview === 'function') {
                Renderer.clearDragEvolutionPreview();
            }
            return;
        }

        if (activeDrag.dragSource === 'board') {
            const srcTower = G.state.board[activeDrag.sourceIndex];
            if (!srcTower) return;
            const EvoSys = GameApp.systems && GameApp.systems.evolution;
            if (cellIndex !== null && G.cellElements[cellIndex] && cellIndex !== activeDrag.sourceIndex) {
                const valid = isBoardDropValidAt(activeDrag.sourceIndex, cellIndex);
                const cellEl = G.cellElements[cellIndex];
                cellEl.classList.add(valid ? 'drag-valid-build' : 'drag-invalid');
                if (valid) cellEl.classList.add('drag-over');

                const dstTower = G.state.board[cellIndex];
                G.state.leylinePreviewEdges = null;
                if (dstTower && typeof Renderer.showDragEvolutionPreview === 'function') {
                    const isEn = Boolean(GameApp.i18n && GameApp.i18n.isEnglish());
                    const fusion = EvoSys && typeof EvoSys.getFusionResult === 'function' ? EvoSys.getFusionResult(srcTower, dstTower) : null;
                    if (fusion) {
                        Renderer.showDragEvolutionPreview(activeDrag.sourceIndex, cellIndex, fusion.previewLabel || (isEn ? 'Can Evolve' : '可融合進化'), true);
                    } else {
                        const reason = EvoSys && typeof EvoSys.getIncompatibilityReason === 'function'
                            ? EvoSys.getIncompatibilityReason(srcTower, dstTower)
                            : (isEn ? 'Incompatible lineage' : '血脈不相容');
                        Renderer.showDragEvolutionPreview(activeDrag.sourceIndex, cellIndex, `⚠️ ${reason}`, false);
                    }
                } else if (typeof Renderer.clearDragEvolutionPreview === 'function') {
                    Renderer.clearDragEvolutionPreview();
                }

                const coords = indexToCoords(cellIndex);
                const center = Renderer.getCellCenter(coords.x, coords.y);
                const radiusPx = AttackSys ? AttackSys.getTowerRangePx(srcTower, valid ? cellIndex : activeDrag.sourceIndex) : (2.0 * G.boardMetrics.step);
                Renderer.showDragRangePreview(center.left, center.top, radiusPx, srcTower.type);
            } else {
                G.state.leylinePreviewEdges = null;
                if (typeof Renderer.clearDragEvolutionPreview === 'function') {
                    Renderer.clearDragEvolutionPreview();
                }
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
                const isEn = Boolean(GameApp.i18n && GameApp.i18n.isEnglish());
                G.dom.msgText.innerText = isEn
                    ? `Insufficient Gold to summon ${tCfg.name} (${cost} 💰 needed).`
                    : `❌ 金幣不足，無法召喚【${tCfg.name}】！需要 ${cost} 💰`;
            }
            if (btnEl) {
                btnEl.classList.remove('shake-anim', 'insufficient-gold');
                void btnEl.offsetWidth;
                btnEl.classList.add('shake-anim', 'insufficient-gold');
                setTimeout(() => btnEl.classList.remove('insufficient-gold'), 450);
            }
            return false;
        }

        cancelActiveDrag({ silent: true, resetTimestamps: true });

        const TreeSys = GameApp.systems && GameApp.systems.tree;
        const seedInterval = (GameApp.data && GameApp.data.tree && GameApp.data.tree.TREE_CONFIG && GameApp.data.tree.TREE_CONFIG.BLESSING_SEED_INTERVAL) || 5;
        const nextTier = (TreeSys && TreeSys.hasBlessing('abundant_seed') && (G.state.seedPityCount + 1) >= seedInterval) ? 2 : 1;

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
            isDragging: false,
            handled: false,
            movedDistance: 0,
            hoveredCellIndex: null,
            ghostEl: null
        };
        return true;
    }

    function activateShopDragVisuals(clientX, clientY) {
        if (!activeDrag || activeDrag.dragSource !== 'shop' || activeDrag.isDragging || !G) return;
        const towersDict = getTowersDict();
        const tCfg = towersDict[activeDrag.towerType];
        const EconSys = GameApp.systems && GameApp.systems.economy;
        const cost = EconSys ? EconSys.getSummonCost(activeDrag.towerType) : 10;

        activeDrag.isDragging = true;
        G.state.selectedIndex = null;
        G.state.buildTargetIndex = null;
        G.state.pendingSpawnType = null;
        G.state.hoveredIndex = null;
        GameApp.renderer.renderBoard([]);

        activeDrag.ghostEl = createGhostElement(activeDrag.towerType, activeDrag.tier);
        positionGhostElement(activeDrag.ghostEl, clientX, clientY);
        if (activeDrag.btnEl) activeDrag.btnEl.classList.add('dragging-card');

        if (G.dom.msgText && tCfg) {
            const isEn = Boolean(GameApp.i18n && GameApp.i18n.isEnglish());
            G.dom.msgText.innerText = isEn
                ? `Drag ${tCfg.icon} ${tCfg.name} onto a valid tile to summon (${cost} 💰).`
                : `拖曳【${tCfg.icon} ${tCfg.name}】至棋盤可建格放開召喚（花費 ${cost} 💰）。`;
        }
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
            handled: false,
            movedDistance: 0,
            hoveredCellIndex: sourceIndex,
            ghostEl: null
        };
        return true;
    }

    function startFruitDrag(btnEl, clientX, clientY, pointerId = null) {
        if (!G || !G.state || (G.state.fusionFruitCount || 0) <= 0) return false;
        const canAct = G.callbacks && typeof G.callbacks.isMatchPhaseActive === 'function'
            ? G.callbacks.isMatchPhaseActive()
            : !G.state.isGameOver;
        if (!canAct) return false;
        cancelActiveDrag({ silent: true, resetTimestamps: true });
        activeDrag = {
            dragSource: 'fruit',
            pointerId,
            btnEl,
            startX: clientX,
            startY: clientY,
            currentX: clientX,
            currentY: clientY,
            isDragging: false,
            handled: false,
            movedDistance: 0,
            hoveredCellIndex: null,
            ghostEl: null
        };
        return true;
    }

    function handleMovePoint(clientX, clientY) {
        if (!activeDrag || activeDrag.handled || !G) return;
        activeDrag.currentX = clientX;
        activeDrag.currentY = clientY;
        activeDrag.movedDistance = Math.hypot(clientX - activeDrag.startX, clientY - activeDrag.startY);

        if (activeDrag.dragSource === 'fruit' && !activeDrag.isDragging) {
            if (activeDrag.movedDistance > 10 || resolveCellIndexAtPoint(clientX, clientY) !== null) {
                activeDrag.isDragging = true;
                activeDrag.ghostEl = createFruitGhostElement();
                positionGhostElement(activeDrag.ghostEl, clientX, clientY);
                if (activeDrag.btnEl) activeDrag.btnEl.classList.add('dragging-card');
            }
        }

        if (activeDrag.dragSource === 'shop' && !activeDrag.isDragging) {
            if (activeDrag.movedDistance > 10 || resolveCellIndexAtPoint(clientX, clientY) !== null) {
                activateShopDragVisuals(clientX, clientY);
            }
        }

        if (activeDrag.dragSource === 'board' && !activeDrag.isDragging && activeDrag.movedDistance > 6) {
            activeDrag.isDragging = true;
            G.state.draggedIndex = activeDrag.sourceIndex;
            G.state.selectedIndex = null;
            G.state.buildTargetIndex = null;
            G.state.pendingSpawnType = null;
            G.state.hoveredIndex = null;
            if (activeDrag.towerEl) activeDrag.towerEl.classList.add('dragging');
            activeDrag.ghostEl = createGhostElement(activeDrag.towerType, activeDrag.tier);
            const tCfg = getTowersDict()[activeDrag.towerType];
            if (G.dom.msgText && tCfg) {
                const isEn = Boolean(GameApp.i18n && GameApp.i18n.isEnglish());
                G.dom.msgText.innerText = isEn
                    ? `Moving ${tCfg.name} ${GameApp.renderer.getTierStars(activeDrag.tier)}: Drop on empty tile or merge with a compatible tower.`
                    : `移動【${tCfg.name} ${GameApp.renderer.getTierStars(activeDrag.tier)}】：放至空地移位，或拖向相容防禦塔融合。`;
            }
            G.callbacks.updateTowerInspector();
        }

        if (activeDrag.isDragging) {
            updateDragVisualFeedback(clientX, clientY);
        }
    }

    function finishActiveDrag(clientX, clientY) {
        if (!activeDrag || activeDrag.handled || !G) return;
        const drag = activeDrag;
        drag.handled = true;

        const finalX = Number.isFinite(clientX) ? clientX : drag.currentX;
        const finalY = Number.isFinite(clientY) ? clientY : drag.currentY;
        const dropDistance = Math.hypot(finalX - drag.startX, finalY - drag.startY);
        const targetIndex = resolveCellIndexAtPoint(finalX, finalY);

        if (drag.dragSource === 'fruit') {
            const wasDragGesture = Boolean(drag.isDragging || dropDistance > 10 || targetIndex !== null);
            const validDrop = wasDragGesture && isFruitDropValidAt(targetIndex);
            cancelActiveDrag({ silent: true });
            if (!wasDragGesture) return;
            lastShopDragCompleteTs = performance.now();
            G.state.lastTouchDragEndTime = lastShopDragCompleteTs;
            if (validDrop && G.callbacks && typeof G.callbacks.applyFusionFruitAtCell === 'function') {
                G.callbacks.applyFusionFruitAtCell(targetIndex);
            } else if (G.dom && G.dom.msgText) {
                const isEn = Boolean(GameApp.i18n && GameApp.i18n.isEnglish());
                G.dom.msgText.innerText = isEn
                    ? 'Drop Universal Fusion Fruit onto a 1★-4★ tower to star up or feed +4U.'
                    : '請將【萬能融合果實】拖曳至場上 1★ ～ 4★ 防禦塔上套用升星或 +4U 充能。';
            }
            return;
        }

        if (drag.dragSource === 'shop') {
            const wasDragGesture = Boolean(drag.isDragging || dropDistance > 10 || targetIndex !== null);
            const towerType = drag.towerType;
            const validDrop = wasDragGesture && isShopDropValidAt(targetIndex);
            cancelActiveDrag({ silent: true });

            if (!wasDragGesture) {
                // 未達拖曳門檻且放開在卡片本體上：視為點擊事件，交由 click listener 處理雙模式建塔
                return;
            }

            lastShopDragCompleteTs = performance.now();
            G.state.lastTouchDragEndTime = lastShopDragCompleteTs;

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
                    const isEn = Boolean(GameApp.i18n && GameApp.i18n.isEnglish());
                    if (targetIndex !== null) {
                        const isPath = G.map.pathCellIndices.has(targetIndex);
                        const hasTower = G.state.board[targetIndex] !== null;
                        const TerrainSys = GameApp.systems && GameApp.systems.terrain;
                        const canBuildCell = TerrainSys ? TerrainSys.canBuildAt(targetIndex) : !isPath;
                        const EconSysDrop = GameApp.systems && GameApp.systems.economy;
                        const exactCost = EconSysDrop ? EconSysDrop.getSummonCost(towerType, null, targetIndex) : 10;
                        if (canBuildCell && !hasTower && G.state.currentGold < exactCost) {
                            G.dom.msgText.innerText = isEn
                                ? `Need ${exactCost} 💰 at this tile (❄️ Snow +5 💰 on plain grass). Summon cancelled.`
                                : `此格召喚需 ${exactCost} 💰（❄️ 霜雪草地 +5 💰），金幣不足已取消。`;
                        } else {
                            G.dom.msgText.innerText = isPath
                                ? (isEn ? 'Cannot build on enemy path. Summon cancelled (no Gold spent).' : '怪物路徑不可建塔，已取消召喚（未扣金幣）。')
                                : (hasTower
                                    ? (isEn ? 'Drop on an open green tile to summon (no Gold spent).' : '商店召喚不可直接覆蓋場上防禦塔，請放置於空白地塊（未扣金幣）。')
                                    : (isEn ? 'Cannot build on this terrain. Summon cancelled (no Gold spent).' : '該地形不可建塔，已取消召喚（未扣金幣）。'));
                        }
                    } else {
                        G.dom.msgText.innerText = isEn ? 'Drag summon cancelled (no Gold spent).' : '已取消拖曳召喚（未扣金幣）。';
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
        if (options && options.resetTimestamps) {
            lastShopDragCompleteTs = 0;
        }
        if (!activeDrag) return;
        const drag = activeDrag;
        activeDrag = null;

        if (drag.ghostEl) drag.ghostEl.remove();
        if (drag.btnEl) drag.btnEl.classList.remove('dragging-card');
        if (drag.towerEl) drag.towerEl.classList.remove('dragging');
        if (G && G.state) {
            G.state.draggedIndex = null;
            G.state.leylinePreviewEdges = null;
        }

        if (GameApp.renderer) {
            if (typeof GameApp.renderer.clearDragEvolutionPreview === 'function') {
                GameApp.renderer.clearDragEvolutionPreview();
            }
            GameApp.renderer.clearCellDragHighlights();
            if (!options.silent) GameApp.renderer.updateRangeIndicator();
            else if (G && G.dom && G.dom.rangeCircleEl) G.dom.rangeCircleEl.className = '';
        }
    }

    /**
     * 綁定下方商店召喚卡片的拖拉召喚與點擊雙模式事件（支援 Pointer / Mouse / Touch，含防重複落點鎖）
     */
    function bindShopCardElement(btnEl, towerType, onCardClick = null) {
        if (!btnEl) return;
        btnEl.style.touchAction = 'none';
        btnEl.setAttribute('draggable', 'false');
        btnEl.addEventListener('dragstart', e => e.preventDefault());
        btnEl.addEventListener('drop', e => e.preventDefault());

        btnEl.addEventListener('pointerdown', (e) => {
            if (e.button !== undefined && e.button !== 0) return;
            const now = Date.now();
            lastPointerDownTs = now;
            lastPointerEventTs = now;
            if (e.pointerType === 'touch') G.callbacks.activateTouchMode();
            GameApp.audio.ensureContext();
            startShopDrag(towerType, btnEl, e.clientX, e.clientY, e.pointerId !== undefined ? e.pointerId : null);
        });

        btnEl.addEventListener('mousedown', (e) => {
            const now = Date.now();
            if (now - lastPointerDownTs < 250 || now - lastPointerEventTs < 250 || (e.button !== undefined && e.button !== 0)) return;
            if (activeDrag) return;
            GameApp.audio.ensureContext();
            startShopDrag(towerType, btnEl, e.clientX, e.clientY, null);
        });

        btnEl.addEventListener('touchstart', (e) => {
            const now = Date.now();
            if (now - lastPointerDownTs < 250 || now - lastPointerEventTs < 250 || e.touches.length !== 1) return;
            if (activeDrag) return;
            G.callbacks.activateTouchMode();
            const t = e.touches[0];
            GameApp.audio.ensureContext();
            startShopDrag(towerType, btnEl, t.clientX, t.clientY, null);
        }, { passive: true });

        btnEl.addEventListener('click', (e) => {
            if (performance.now() - lastShopDragCompleteTs < 180) {
                e.preventDefault();
                e.stopPropagation();
                return;
            }
            if (activeDrag && activeDrag.dragSource === 'shop' && !activeDrag.isDragging && !activeDrag.handled) {
                cancelActiveDrag({ silent: true });
            }
            if (activeDrag && activeDrag.isDragging) return;
            GameApp.audio.ensureContext();
            if (typeof onCardClick === 'function') {
                onCardClick(towerType, btnEl);
            }
        });
    }

    /**
     * 綁定棋盤上防禦塔元素的拖拉移位／融合事件
     */
    function bindBoardTowerElement(towerEl, index, towerObj) {
        if (!towerEl) return;
        towerEl.style.touchAction = 'none';
        towerEl.setAttribute('draggable', 'false');
        towerEl.addEventListener('dragstart', e => e.preventDefault());
        towerEl.addEventListener('drop', e => e.preventDefault());

        towerEl.addEventListener('pointerdown', (e) => {
            if (e.button !== undefined && e.button !== 0) return;
            const now = Date.now();
            lastPointerDownTs = now;
            lastPointerEventTs = now;
            if (e.pointerType === 'touch') G.callbacks.activateTouchMode();
            startBoardDrag(index, towerEl, towerObj, e.clientX, e.clientY, e.pointerId !== undefined ? e.pointerId : null);
        });

        towerEl.addEventListener('mousedown', (e) => {
            const now = Date.now();
            if (now - lastPointerDownTs < 250 || now - lastPointerEventTs < 250 || (e.button !== undefined && e.button !== 0)) return;
            if (activeDrag) return;
            startBoardDrag(index, towerEl, towerObj, e.clientX, e.clientY, null);
        });

        towerEl.addEventListener('touchstart', (e) => {
            const now = Date.now();
            if (now - lastPointerDownTs < 250 || now - lastPointerEventTs < 250 || e.touches.length !== 1) return;
            if (activeDrag) return;
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
        cellEl.addEventListener('drop', (e) => {
            e.preventDefault();
            cellEl.classList.remove('drag-over', 'drag-valid-build', 'drag-invalid');
        });
    }

    function bindGlobalPointerListeners() {
        if (globalListenersBound || typeof document === 'undefined') return;
        globalListenersBound = true;

        document.addEventListener('pointermove', (e) => {
            lastPointerEventTs = Date.now();
            if (!activeDrag || activeDrag.handled) return;
            if (activeDrag.pointerId !== null && e.pointerId !== undefined && e.pointerId !== activeDrag.pointerId) return;
            if (activeDrag.isDragging && e.cancelable) e.preventDefault();
            handleMovePoint(e.clientX, e.clientY);
        }, { passive: false });

        document.addEventListener('pointerup', (e) => {
            lastPointerEventTs = Date.now();
            if (!activeDrag || activeDrag.handled) return;
            if (activeDrag.pointerId !== null && e.pointerId !== undefined && e.pointerId !== activeDrag.pointerId) return;
            finishActiveDrag(e.clientX, e.clientY);
        });

        document.addEventListener('pointercancel', () => {
            lastPointerEventTs = Date.now();
            if (!activeDrag) return;
            const wasDragging = Boolean(activeDrag.isDragging);
            const src = activeDrag.dragSource;
            cancelActiveDrag();
            if (wasDragging && GameApp.backend && typeof GameApp.backend.trackFeel === 'function') {
                GameApp.backend.trackFeel(`Feel:DragCancel:${src}`, 1);
            }
        });

        // 傳統 Mouse / Touch 備援（嚴格排斥剛處理過 PointerEvent 的事件，杜絕雙重落點觸發）
        document.addEventListener('mousemove', (e) => {
            if (Date.now() - lastPointerEventTs < 250) return;
            if (!activeDrag || activeDrag.handled || activeDrag.pointerId !== null) return;
            handleMovePoint(e.clientX, e.clientY);
        });

        document.addEventListener('mouseup', (e) => {
            if (Date.now() - lastPointerEventTs < 250) return;
            if (!activeDrag || activeDrag.handled || activeDrag.pointerId !== null) return;
            finishActiveDrag(e.clientX, e.clientY);
        });

        document.addEventListener('touchmove', (e) => {
            if (Date.now() - lastPointerEventTs < 250) return;
            if (!activeDrag || activeDrag.handled || activeDrag.pointerId !== null || e.touches.length !== 1) return;
            if (activeDrag.isDragging && e.cancelable) e.preventDefault();
            const t = e.touches[0];
            handleMovePoint(t.clientX, t.clientY);
        }, { passive: false });

        document.addEventListener('touchend', (e) => {
            if (Date.now() - lastPointerEventTs < 250) return;
            if (!activeDrag || activeDrag.handled || activeDrag.pointerId !== null) return;
            const t = e.changedTouches && e.changedTouches[0];
            finishActiveDrag(t ? t.clientX : activeDrag.currentX, t ? t.clientY : activeDrag.currentY);
        });

        document.addEventListener('touchcancel', () => {
            if (!activeDrag) return;
            const wasDragging = Boolean(activeDrag.isDragging);
            const src = activeDrag.dragSource;
            cancelActiveDrag();
            if (wasDragging && GameApp.backend && typeof GameApp.backend.trackFeel === 'function') {
                GameApp.backend.trackFeel(`Feel:DragCancel:${src}`, 1);
            }
        });
    }

    function bindFusionFruitElement(btnEl, onFruitClick = null) {
        if (!btnEl) return;
        btnEl.style.touchAction = 'none';
        btnEl.setAttribute('draggable', 'false');
        btnEl.addEventListener('dragstart', e => e.preventDefault());
        btnEl.addEventListener('drop', e => e.preventDefault());

        btnEl.addEventListener('pointerdown', (e) => {
            if (e.button !== undefined && e.button !== 0) return;
            const now = Date.now();
            lastPointerDownTs = now;
            lastPointerEventTs = now;
            if (e.pointerType === 'touch') G.callbacks.activateTouchMode();
            GameApp.audio.ensureContext();
            startFruitDrag(btnEl, e.clientX, e.clientY, e.pointerId !== undefined ? e.pointerId : null);
        });

        btnEl.addEventListener('mousedown', (e) => {
            const now = Date.now();
            if (now - lastPointerDownTs < 250 || now - lastPointerEventTs < 250 || (e.button !== undefined && e.button !== 0)) return;
            if (activeDrag) return;
            GameApp.audio.ensureContext();
            startFruitDrag(btnEl, e.clientX, e.clientY, null);
        });

        btnEl.addEventListener('touchstart', (e) => {
            const now = Date.now();
            if (now - lastPointerDownTs < 250 || now - lastPointerEventTs < 250 || e.touches.length !== 1) return;
            if (activeDrag) return;
            G.callbacks.activateTouchMode();
            const t = e.touches[0];
            GameApp.audio.ensureContext();
            startFruitDrag(btnEl, t.clientX, t.clientY, null);
        }, { passive: true });

        btnEl.addEventListener('click', (e) => {
            if (performance.now() - lastShopDragCompleteTs < 180) {
                e.preventDefault();
                e.stopPropagation();
                return;
            }
            if (activeDrag && activeDrag.dragSource === 'fruit' && !activeDrag.isDragging && !activeDrag.handled) {
                cancelActiveDrag({ silent: true });
            }
            if (activeDrag && activeDrag.isDragging) return;
            GameApp.audio.ensureContext();
            if (typeof onFruitClick === 'function') {
                onFruitClick(btnEl);
            }
        });
    }

    const DragSystem = {
        bind,
        isDragging,
        getActiveDrag,
        resolveCellIndexAtPoint,
        isShopDropValidAt,
        isBoardDropValidAt,
        isFruitDropValidAt,
        startShopDrag,
        startBoardDrag,
        startFruitDrag,
        handleMovePoint,
        finishActiveDrag,
        cancelActiveDrag,
        bindShopCardElement,
        bindBoardTowerElement,
        bindBoardCellElement,
        bindFusionFruitElement
    };

    GameApp.systems = GameApp.systems || {};
    GameApp.systems.drag = DragSystem;
})(window);
