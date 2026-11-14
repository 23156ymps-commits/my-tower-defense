// ==================== 1. 遊戲規格與平衡參數 ====================
const CONFIG = {
    INITIAL_GOLD: 40,
    INITIAL_BASE_HP: 20,
    BASE_COST: 10,
    COST_STEP: 10,
    MAX_TIER: 3,
    ATTACK_INTERVAL: 1000,       // 防禦塔基礎攻擊間隔 (ms)
    BOARD_COLS: 15,
    BOARD_ROWS: 10,
    BOARD_SIZE: 150,             // 15 寬 x 10 高 = 150 格
    MONSTER_BASE_SPEED: 2.6,     // 怪物基礎移動速度 (格/秒)
    ICE_SLOW_DURATION_MS: 2000,  // 冰塔緩速持續時間 (ms)
    ICE_SLOW_RATE: 0.45,         // 冰塔緩速幅度 (降速 45%)
    THUNDER_BOLT_COUNT: 2,       // 雷塔單次攻擊連射閃電數
    WEAKNESS_MULTIPLIER: 2.0,    // 弱點相剋暴擊倍率 (200%)
    INITIAL_PREP_MS: 3000,       // 開局備戰倒數 (ms)
    WAVE_INTERMISSION_MS: 4000,  // 波次間休息倒數 (ms)
    STORAGE_BEST_WAVE_KEY: 'merge_defense_best_wave'
};

const ELEMENT_CONFIG = {
    fire: {
        name: "火塔",
        icon: "🔥",
        range: 1.8,
        roleTag: "重砲·短1.8",
        color: "#e74c3c"
    },
    ice: {
        name: "冰塔",
        icon: "❄️",
        range: 2.8,
        roleTag: "緩速·中2.8",
        color: "#38bdf8"
    },
    thunder: {
        name: "雷塔",
        icon: "⚡",
        range: 4.2,
        roleTag: "連射·長4.2",
        color: "#f59e0b"
    }
};

// 超線性階級傷害查表 (Lv.2 > 2x Lv.1, Lv.3 > 2x Lv.2，確保合成收益永遠大於鋪低階塔)
const TIER_DAMAGE_TABLE = {
    fire: [0, 24, 54, 120],
    ice: [0, 14, 32, 72],
    thunder: [0, 10, 22, 50]
};

// 怪物弱點與基礎數值表
const MONSTER_DATABASE = {
    wood: {
        name: "蔓藤巨魔",
        icon: "🌿",
        weakness: "fire",
        baseHp: 68,
        baseReward: 10,
        speedMult: 1.0
    },
    lava: {
        name: "熔岩傀儡",
        icon: "🌋",
        weakness: "ice",
        baseHp: 78,
        baseReward: 11,
        speedMult: 0.92
    },
    air: {
        name: "機械飛艇",
        icon: "🛸",
        weakness: "thunder",
        baseHp: 60,
        baseReward: 10,
        speedMult: 1.15
    }
};

// 波次強度與固定減傷護甲菁英參數
const WAVE_BALANCE = {
    BASE_COUNT: 6,
    COUNT_PER_WAVE: 2,
    MAX_COUNT_PER_WAVE: 28,
    HP_GROWTH_LINEAR: 0.28,
    HP_GROWTH_QUAD: 0.03,
    REWARD_WAVE_STEP: 2,
    ELITE_START_WAVE: 4,
    ELITE_BASE_ARMOR: 6,
    ELITE_ARMOR_GROWTH_STEP: 3,
    ELITE_HP_MULT: 2.1,
    ELITE_REWARD_MULT: 2.2,
    ELITE_SPEED_MULT: 0.85,
    SPAWN_INTERVAL_BASE_MS: 1600,
    SPAWN_INTERVAL_DECAY_MS: 65,
    SPAWN_INTERVAL_MIN_MS: 750
};

// 15x10 地圖路徑點 (X: 0~14, Y: 0~9)
const WAYPOINTS = [
    { x: 0, y: 2 },
    { x: 12, y: 2 },
    { x: 12, y: 7 },
    { x: 2, y: 7 },
    { x: 2, y: 9 },
    { x: 14, y: 9 }
];

// 將座標 (x, y) 換算為 0~149 的格子編號
function coordsToIndex(x, y) {
    return y * CONFIG.BOARD_COLS + x;
}

function indexToCoords(index) {
    return {
        x: index % CONFIG.BOARD_COLS,
        y: Math.floor(index / CONFIG.BOARD_COLS)
    };
}

const START_CELL_INDEX = coordsToIndex(WAYPOINTS[0].x, WAYPOINTS[0].y);
const END_CELL_INDEX = coordsToIndex(WAYPOINTS[WAYPOINTS.length - 1].x, WAYPOINTS[WAYPOINTS.length - 1].y);

// 產生所有路徑經過的格子編號集合
const PATH_CELL_INDICES = new Set();
(function initPathIndices() {
    for (let i = 0; i < WAYPOINTS.length - 1; i++) {
        const p1 = WAYPOINTS[i];
        const p2 = WAYPOINTS[i + 1];

        let curX = p1.x;
        let curY = p1.y;
        PATH_CELL_INDICES.add(coordsToIndex(curX, curY));

        while (curX !== p2.x || curY !== p2.y) {
            if (curX < p2.x) curX++;
            else if (curX > p2.x) curX--;
            else if (curY < p2.y) curY++;
            else if (curY > p2.y) curY--;
            PATH_CELL_INDICES.add(coordsToIndex(curX, curY));
        }
    }
})();

// 預計算路徑點累積距離，供精確比較同段路徑上的怪物前後進度
const WAYPOINT_CUM_DIST = [0];
(function initWaypointDistances() {
    for (let i = 0; i < WAYPOINTS.length - 1; i++) {
        const dx = WAYPOINTS[i + 1].x - WAYPOINTS[i].x;
        const dy = WAYPOINTS[i + 1].y - WAYPOINTS[i].y;
        WAYPOINT_CUM_DIST.push(WAYPOINT_CUM_DIST[i] + Math.hypot(dx, dy));
    }
})();

// ==================== 2. 狀態管理與持久化紀錄 ====================
function loadBestWave() {
    try {
        const saved = parseInt(localStorage.getItem(CONFIG.STORAGE_BEST_WAVE_KEY), 10);
        return Number.isFinite(saved) && saved >= 1 ? saved : 1;
    } catch (err) {
        return 1;
    }
}

function saveBestWave(wave) {
    try {
        localStorage.setItem(CONFIG.STORAGE_BEST_WAVE_KEY, String(wave));
    } catch (err) {
        // 受限瀏覽環境或隱私模式可能無法寫入 localStorage，靜默忽略不中斷遊戲
    }
}

let currentGold = CONFIG.INITIAL_GOLD;
let baseHp = CONFIG.INITIAL_BASE_HP;
let bestWave = loadBestWave();
let currentWave = 1;
let killsCount = 0;
let isGameOver = false;
let isNewRecordThisRun = false;

let spawnCounts = {
    fire: 0,
    ice: 0,
    thunder: 0
};

// 棋盤與怪物陣列徹底解耦
let board = Array(CONFIG.BOARD_SIZE).fill(null);
let monsters = [];
let monsterIdCounter = 1;
const monsterDomMap = new Map();

// 互動狀態
let draggedIndex = null;
let selectedIndex = null;
let hoveredIndex = null;
let touchDragState = null;
let lastTouchDragEndTime = 0;

// 波次與主迴圈狀態
let waveState = 'PREP'; // 'PREP' | 'SPAWNING' | 'CLEARING' | 'INTERMISSION' | 'GAMEOVER'
let waveTimerMs = CONFIG.INITIAL_PREP_MS;
let waveSpawnQueue = [];
let waveSpawnIntervalMs = WAVE_BALANCE.SPAWN_INTERVAL_BASE_MS;
let waveSpawnAccMs = 0;
let attackAccMs = 0;
let lastFrameTime = null;
let rafId = null;

// 響應式棋盤像素幾何快取
const boardMetrics = {
    originX: 8,
    originY: 8,
    cellW: 34,
    cellH: 34,
    stepX: 37,
    stepY: 37,
    step: 37
};

// DOM 元素快取
const boardElement = document.getElementById('grid-board');
const monsterLayerEl = document.getElementById('monster-layer');
const fxLayerEl = document.getElementById('fx-layer');
const floatingLayerEl = document.getElementById('floating-layer');
const rangeCircleEl = document.getElementById('range-circle');
const spawnerContainer = document.getElementById('element-spawner-container');

const addGoldBtn = document.getElementById('add-gold-btn');
const clearGoldBtn = document.getElementById('clear-gold-btn');
const deleteTowerBtn = document.getElementById('delete-tower-btn');
const nextWaveBtn = document.getElementById('next-wave-btn');

const goldDisplay = document.getElementById('gold-display');
const baseHpDisplay = document.getElementById('base-hp-display');
const waveDisplay = document.getElementById('wave-display');
const wavePhaseTagEl = document.getElementById('wave-phase-tag');
const bestWaveDisplay = document.getElementById('best-wave-display');
const msgText = document.getElementById('msg-text');

const gameOverOverlayEl = document.getElementById('game-over-overlay');
const finalWaveTextEl = document.getElementById('final-wave-text');
const finalBestTextEl = document.getElementById('final-best-text');
const finalKillsTextEl = document.getElementById('final-kills-text');
const newRecordBadgeEl = document.getElementById('new-record-badge');
const restartBtn = document.getElementById('restart-btn');

// ==================== 3. 座標量測與數值公式 ====================
function measureBoardMetrics() {
    const cells = boardElement.children;
    if (!cells || cells.length < CONFIG.BOARD_COLS + 1) return;

    const firstCell = cells[0];
    const rightCell = cells[1];
    const belowCell = cells[CONFIG.BOARD_COLS];

    boardMetrics.originX = firstCell.offsetLeft;
    boardMetrics.originY = firstCell.offsetTop;
    boardMetrics.cellW = firstCell.offsetWidth || 34;
    boardMetrics.cellH = firstCell.offsetHeight || 34;
    boardMetrics.stepX = (rightCell.offsetLeft - firstCell.offsetLeft) || (boardMetrics.cellW + 3);
    boardMetrics.stepY = (belowCell.offsetTop - firstCell.offsetTop) || (boardMetrics.cellH + 3);
    boardMetrics.step = (boardMetrics.stepX + boardMetrics.stepY) / 2;
}

function getCellCenter(gridX, gridY) {
    return {
        left: boardMetrics.originX + gridX * boardMetrics.stepX + boardMetrics.cellW / 2,
        top: boardMetrics.originY + gridY * boardMetrics.stepY + boardMetrics.cellH / 2
    };
}

function getTowerRangePx(type) {
    const cfg = ELEMENT_CONFIG[type];
    const rangeCells = cfg ? cfg.range : 2.0;
    return rangeCells * boardMetrics.step;
}

function getCost(type) {
    const count = spawnCounts[type] || 0;
    return CONFIG.BASE_COST + (count * CONFIG.COST_STEP);
}

function updateWavePhaseUI() {
    if (!wavePhaseTagEl) return;

    if (waveState === 'PREP') {
        const sec = Math.max(1, Math.ceil(waveTimerMs / 1000));
        wavePhaseTagEl.innerText = `備戰 ${sec}s`;
    } else if (waveState === 'INTERMISSION') {
        const sec = Math.max(1, Math.ceil(waveTimerMs / 1000));
        wavePhaseTagEl.innerText = `下波 ${sec}s`;
    } else if (waveState === 'SPAWNING') {
        wavePhaseTagEl.innerText = `出怪中`;
    } else if (waveState === 'CLEARING') {
        wavePhaseTagEl.innerText = `清場中`;
    } else {
        wavePhaseTagEl.innerText = `已結束`;
    }

    if (nextWaveBtn) {
        const canSkip = !isGameOver && (waveState === 'PREP' || waveState === 'INTERMISSION');
        nextWaveBtn.disabled = !canSkip;
        nextWaveBtn.innerText = waveState === 'PREP' ? '⚡ 立即開波' : '⚡ 提前下波';
    }
}

function updateHUD() {
    if (goldDisplay) goldDisplay.innerText = currentGold;
    if (baseHpDisplay) baseHpDisplay.innerText = baseHp;
    if (waveDisplay) waveDisplay.innerText = `Wave ${currentWave}`;
    if (bestWaveDisplay) bestWaveDisplay.innerText = `Wave ${bestWave}`;

    updateWavePhaseUI();

    Object.keys(ELEMENT_CONFIG).forEach(type => {
        const btn = document.getElementById(`spawn-btn-${type}`);
        if (!btn) return;

        const cost = getCost(type);
        const costEl = btn.querySelector('.btn-cost-val');
        if (costEl) costEl.innerText = `${cost} 💰`;

        if (isGameOver || currentGold < cost) {
            btn.classList.add('btn-disabled');
        } else {
            btn.classList.remove('btn-disabled');
        }
    });
}

// ==================== 4. 射程預覽指示器 ====================
function updateRangeIndicator() {
    if (!rangeCircleEl) return;

    if (isGameOver || draggedIndex !== null || (touchDragState && touchDragState.isDragging)) {
        rangeCircleEl.className = '';
        return;
    }

    let targetIdx = null;
    if (hoveredIndex !== null && board[hoveredIndex] !== null) {
        targetIdx = hoveredIndex;
    } else if (selectedIndex !== null && board[selectedIndex] !== null) {
        targetIdx = selectedIndex;
    }

    if (targetIdx === null) {
        rangeCircleEl.className = '';
        return;
    }

    const towerObj = board[targetIdx];
    const coords = indexToCoords(targetIdx);
    const center = getCellCenter(coords.x, coords.y);
    const radiusPx = getTowerRangePx(towerObj.type);

    rangeCircleEl.style.left = `${center.left}px`;
    rangeCircleEl.style.top = `${center.top}px`;
    rangeCircleEl.style.width = `${radiusPx * 2}px`;
    rangeCircleEl.style.height = `${radiusPx * 2}px`;
    rangeCircleEl.className = `visible range-${towerObj.type}`;
}

// ==================== 5. 召喚按鈕控制 ====================
function renderSpawnerButtons() {
    spawnerContainer.innerHTML = '';

    Object.entries(ELEMENT_CONFIG).forEach(([type, data]) => {
        const btn = document.createElement('button');
        btn.id = `spawn-btn-${type}`;
        btn.classList.add('spawn-card-btn', `btn-type-${type}`);

        btn.innerHTML = `
            <span>${data.icon} 召喚${data.name}</span>
            <span class="btn-sub-info">${data.roleTag}</span>
            <span class="btn-cost-val">${getCost(type)} 💰</span>
        `;

        btn.addEventListener('click', () => handleSpawn(type, btn));
        spawnerContainer.appendChild(btn);
    });
}

function handleSpawn(type, btnElement) {
    if (isGameOver) return;

    const cost = getCost(type);

    if (currentGold < cost) {
        msgText.innerText = `❌ 金幣不足，無法召喚【${ELEMENT_CONFIG[type].name}】！需要 ${cost} 💰`;
        btnElement.classList.remove('shake-anim');
        void btnElement.offsetWidth;
        btnElement.classList.add('shake-anim');
        return;
    }

    const emptyIndices = [];
    board.forEach((val, idx) => {
        if (val === null && !PATH_CELL_INDICES.has(idx)) {
            emptyIndices.push(idx);
        }
    });

    if (emptyIndices.length === 0) {
        msgText.innerText = '⚠️ 可建造格子已經全滿，請先融合騰出空間！';
        return;
    }

    currentGold -= cost;
    spawnCounts[type] = (spawnCounts[type] || 0) + 1;

    const randomIdx = emptyIndices[Math.floor(Math.random() * emptyIndices.length)];
    board[randomIdx] = { type: type, tier: 1 };

    const cfg = ELEMENT_CONFIG[type];
    msgText.innerText = `成功召喚【${cfg.name} Lv.1】（射程 ${cfg.range} 格）！花費 ${cost} 💰。`;

    renderBoard();
    updateHUD();
}

// ==================== 6. 波次產生與怪物生成 ====================
function buildWaveQueue(waveNum) {
    const typeKeys = Object.keys(MONSTER_DATABASE);
    const totalCount = Math.min(
        WAVE_BALANCE.MAX_COUNT_PER_WAVE,
        WAVE_BALANCE.BASE_COUNT + waveNum * WAVE_BALANCE.COUNT_PER_WAVE
    );

    const hpScale = 1
        + (waveNum - 1) * WAVE_BALANCE.HP_GROWTH_LINEAR
        + Math.pow(waveNum - 1, 2) * WAVE_BALANCE.HP_GROWTH_QUAD;
    const rewardBonus = Math.floor((waveNum - 1) / WAVE_BALANCE.REWARD_WAVE_STEP);

    const hasElites = waveNum >= WAVE_BALANCE.ELITE_START_WAVE;
    const eliteCount = hasElites
        ? Math.min(Math.floor(totalCount * 0.35), 1 + Math.floor((waveNum - WAVE_BALANCE.ELITE_START_WAVE) / 1.5))
        : 0;
    const eliteArmor = hasElites
        ? WAVE_BALANCE.ELITE_BASE_ARMOR + Math.floor((waveNum - WAVE_BALANCE.ELITE_START_WAVE) / WAVE_BALANCE.ELITE_ARMOR_GROWTH_STEP) * 2
        : 0;

    // 決定哪些順位派出高護甲菁英怪（均勻分布於波次中後段）
    const eliteSlots = new Set();
    for (let e = 0; e < eliteCount; e++) {
        const slot = Math.min(
            totalCount - 1,
            Math.floor(((e + 1) * totalCount) / (eliteCount + 0.5))
        );
        eliteSlots.add(slot);
    }
    // 確保當數量足夠時不遺漏最後一隻或被覆蓋
    let idxCursor = totalCount - 1;
    while (eliteSlots.size < eliteCount && idxCursor >= 0) {
        eliteSlots.add(idxCursor);
        idxCursor--;
    }

    const queue = [];
    for (let i = 0; i < totalCount; i++) {
        const typeKey = typeKeys[(i + waveNum - 1) % typeKeys.length];
        const isElite = eliteSlots.has(i);
        queue.push({
            typeKey,
            hpScale,
            rewardBonus,
            isElite,
            armor: isElite ? eliteArmor : 0
        });
    }

    return {
        queue,
        eliteCount,
        eliteArmor,
        spawnIntervalMs: Math.max(
            WAVE_BALANCE.SPAWN_INTERVAL_MIN_MS,
            WAVE_BALANCE.SPAWN_INTERVAL_BASE_MS - (waveNum - 1) * WAVE_BALANCE.SPAWN_INTERVAL_DECAY_MS
        )
    };
}

function startWave(waveNum) {
    if (isGameOver) return;

    currentWave = waveNum;
    if (currentWave > bestWave) {
        bestWave = currentWave;
        saveBestWave(bestWave);
        isNewRecordThisRun = true;
    }

    const plan = buildWaveQueue(waveNum);
    waveSpawnQueue = plan.queue;
    waveSpawnIntervalMs = plan.spawnIntervalMs;
    waveSpawnAccMs = waveSpawnIntervalMs; // 開波立即派出第一隻怪
    waveState = 'SPAWNING';

    if (plan.eliteCount > 0) {
        msgText.innerText = `🌊 第 ${waveNum} 波來襲！含 ${plan.eliteCount} 隻固定減傷 🛡️${plan.eliteArmor} 護甲菁英怪，請善用火塔或弱點破防！`;
    } else {
        msgText.innerText = `🌊 第 ${waveNum} 波來襲！共 ${plan.queue.length} 隻混合屬性怪物進攻中！`;
    }

    updateHUD();
}

function spawnMonsterFromEntry(entry) {
    const cfg = MONSTER_DATABASE[entry.typeKey];
    const startPos = getCellCenter(WAYPOINTS[0].x, WAYPOINTS[0].y);

    const hpMult = entry.isElite ? WAVE_BALANCE.ELITE_HP_MULT : 1.0;
    const rewardMult = entry.isElite ? WAVE_BALANCE.ELITE_REWARD_MULT : 1.0;
    const speedMult = cfg.speedMult * (entry.isElite ? WAVE_BALANCE.ELITE_SPEED_MULT : 1.0);

    const maxHp = Math.max(10, Math.round(cfg.baseHp * entry.hpScale * hpMult));
    const reward = Math.max(1, Math.round((cfg.baseReward + entry.rewardBonus) * rewardMult));

    const monster = {
        id: monsterIdCounter++,
        typeKey: entry.typeKey,
        name: entry.isElite ? `護甲${cfg.name}` : cfg.name,
        icon: cfg.icon,
        weakness: cfg.weakness,
        hp: maxHp,
        maxHp: maxHp,
        armor: entry.armor,
        isElite: entry.isElite,
        reward: reward,
        wpIndex: 0,
        gridX: WAYPOINTS[0].x,
        gridY: WAYPOINTS[0].y,
        pixelX: startPos.left,
        pixelY: startPos.top,
        baseSpeed: CONFIG.MONSTER_BASE_SPEED * speedMult,
        slowTimer: 0
    };

    monsters.push(monster);
    renderMonsterLayer();
}

// ==================== 7. 戰鬥系統：獨立射程、差異化機制、護甲計算 ====================
function getMonsterProgress(monster) {
    const wpIdx = Math.min(monster.wpIndex, WAYPOINTS.length - 1);
    const wp = WAYPOINTS[wpIdx];
    return WAYPOINT_CUM_DIST[wpIdx] + Math.hypot(monster.gridX - wp.x, monster.gridY - wp.y);
}

function findBestTargetInRange(towerIndex, towerObj) {
    if (monsters.length === 0) return null;

    const coords = indexToCoords(towerIndex);
    const towerPos = getCellCenter(coords.x, coords.y);
    const rangePx = getTowerRangePx(towerObj.type);

    let bestTarget = null;
    let bestProgress = -1;

    for (let i = 0; i < monsters.length; i++) {
        const m = monsters[i];
        if (m.hp <= 0) continue;

        const distPx = Math.hypot(m.pixelX - towerPos.left, m.pixelY - towerPos.top);
        if (distPx <= rangePx) {
            const progress = getMonsterProgress(m);
            if (progress > bestProgress) {
                bestProgress = progress;
                bestTarget = m;
            }
        }
    }

    return bestTarget;
}

function calculateDamage(towerObj, monster) {
    const dmgRow = TIER_DAMAGE_TABLE[towerObj.type];
    const baseDmg = (dmgRow && dmgRow[towerObj.tier]) || 10;
    const isWeakness = (towerObj.type === monster.weakness);
    const multiplier = isWeakness ? CONFIG.WEAKNESS_MULTIPLIER : 1.0;

    const rawDamage = Math.round(baseDmg * multiplier);
    const armor = monster.armor || 0;
    // 固定減傷護甲：每次受擊減免 armor 點傷害，最低扣 1 滴
    const finalDamage = Math.max(1, rawDamage - armor);

    return { damage: finalDamage, isWeakness };
}

function spawnDamageNumber(amount, isWeakness, px, py) {
    if (!floatingLayerEl) return;

    const dmgEl = document.createElement('div');
    dmgEl.classList.add('floating-dmg', isWeakness ? 'weakness' : 'normal');
    dmgEl.innerText = isWeakness ? `WEAK! -${amount}` : `-${amount}`;

    const randomOffsetX = (Math.random() - 0.5) * 18;
    const randomOffsetY = (Math.random() - 0.5) * 8;
    dmgEl.style.left = `${px + randomOffsetX}px`;
    dmgEl.style.top = `${py - 18 + randomOffsetY}px`;

    floatingLayerEl.appendChild(dmgEl);
    setTimeout(() => dmgEl.remove(), 720);
}

function spawnAttackEffect(type, fromPos, toPos) {
    if (!fxLayerEl) return;

    const svgNS = 'http://www.w3.org/2000/svg';
    const group = document.createElementNS(svgNS, 'g');
    group.classList.add('fx-fade');

    if (type === 'thunder') {
        const midX = (fromPos.left + toPos.left) / 2 + (Math.random() - 0.5) * 18;
        const midY = (fromPos.top + toPos.top) / 2 + (Math.random() - 0.5) * 18;
        const bolt = document.createElementNS(svgNS, 'polyline');
        bolt.setAttribute('points', `${fromPos.left},${fromPos.top} ${midX},${midY} ${toPos.left},${toPos.top}`);
        bolt.setAttribute('fill', 'none');
        bolt.setAttribute('stroke', '#fde047');
        bolt.setAttribute('stroke-width', '2.6');
        bolt.setAttribute('stroke-linecap', 'round');
        bolt.setAttribute('stroke-linejoin', 'round');
        group.appendChild(bolt);
    } else {
        const line = document.createElementNS(svgNS, 'line');
        line.setAttribute('x1', fromPos.left);
        line.setAttribute('y1', fromPos.top);
        line.setAttribute('x2', toPos.left);
        line.setAttribute('y2', toPos.top);
        line.setAttribute('stroke', type === 'fire' ? '#ff7675' : '#38bdf8');
        line.setAttribute('stroke-width', type === 'fire' ? '3.2' : '2.2');
        line.setAttribute('stroke-linecap', 'round');
        group.appendChild(line);

        const hitRing = document.createElementNS(svgNS, 'circle');
        hitRing.setAttribute('cx', toPos.left);
        hitRing.setAttribute('cy', toPos.top);
        hitRing.setAttribute('r', type === 'fire' ? '8' : '7');
        hitRing.setAttribute('fill', type === 'fire' ? 'rgba(231,76,60,0.4)' : 'rgba(56,189,248,0.35)');
        hitRing.setAttribute('stroke', type === 'fire' ? '#fab1a0' : '#bae6fd');
        hitRing.setAttribute('stroke-width', '1.5');
        group.appendChild(hitRing);
    }

    fxLayerEl.appendChild(group);
    setTimeout(() => group.remove(), 200);
}

function applyHitToMonster(towerObj, monster) {
    const result = calculateDamage(towerObj, monster);
    monster.hp = Math.max(0, monster.hp - result.damage);

    // 冰塔命中附加 2000ms 緩速控場
    if (towerObj.type === 'ice') {
        monster.slowTimer = CONFIG.ICE_SLOW_DURATION_MS;
    }

    spawnDamageNumber(result.damage, result.isWeakness, monster.pixelX, monster.pixelY);

    if (monster.hp <= 0) {
        currentGold += monster.reward;
        killsCount++;
        msgText.innerText = `💥 擊殺【${monster.name}】！獲得 +${monster.reward} 💰！`;

        const deadIdx = monsters.findIndex(m => m.id === monster.id);
        if (deadIdx !== -1) {
            monsters.splice(deadIdx, 1);
        }
        removeMonsterDom(monster.id);
        updateHUD();
    }
}

function performTowerAttack(towerIndex, towerObj) {
    const coords = indexToCoords(towerIndex);
    const towerPos = getCellCenter(coords.x, coords.y);

    if (towerObj.type === 'thunder') {
        // 雷塔每次發射 2 道閃電，每道開火前皆動態索敵（第一道擊殺後第二道自動轉火）
        for (let bolt = 0; bolt < CONFIG.THUNDER_BOLT_COUNT; bolt++) {
            const target = findBestTargetInRange(towerIndex, towerObj);
            if (!target) break;

            const targetPos = { left: target.pixelX, top: target.pixelY };
            applyHitToMonster(towerObj, target);

            if (bolt === 0) {
                spawnAttackEffect('thunder', towerPos, targetPos);
            } else {
                setTimeout(() => {
                    if (!isGameOver) {
                        spawnAttackEffect('thunder', towerPos, targetPos);
                    }
                }, 90);
            }
        }
        return;
    }

    const target = findBestTargetInRange(towerIndex, towerObj);
    if (!target) return;

    const targetPos = { left: target.pixelX, top: target.pixelY };
    applyHitToMonster(towerObj, target);
    spawnAttackEffect(towerObj.type, towerPos, targetPos);
}

function runTowerAttacks() {
    if (isGameOver || monsters.length === 0) return;

    for (let idx = 0; idx < board.length; idx++) {
        const towerObj = board[idx];
        if (towerObj === null) continue;
        performTowerAttack(idx, towerObj);
    }

    renderMonsterLayer();
}

// ==================== 8. 怪物移動與無閃爍 DOM 更新 ====================
function removeMonsterDom(monsterId) {
    const el = monsterDomMap.get(monsterId);
    if (el) {
        el.remove();
        monsterDomMap.delete(monsterId);
    }
}

function createMonsterDom(monster) {
    const el = document.createElement('div');
    el.classList.add('monster-unit');
    if (monster.isElite) {
        el.classList.add('elite');
    }

    const armorHtml = monster.armor > 0
        ? `<span class="m-armor-badge">🛡️${monster.armor}</span>`
        : '';

    el.innerHTML = `
        <span class="m-slow-badge">❄️</span>
        ${armorHtml}
        <span class="m-icon">${monster.icon}</span>
        <div class="m-hp-bar">
            <div class="m-hp-fill"></div>
        </div>
    `;

    monsterLayerEl.appendChild(el);
    monsterDomMap.set(monster.id, el);
    return el;
}

function renderMonsterLayer() {
    if (!monsterLayerEl) return;

    const activeIds = new Set(monsters.map(m => m.id));
    for (const [id, el] of monsterDomMap.entries()) {
        if (!activeIds.has(id)) {
            el.remove();
            monsterDomMap.delete(id);
        }
    }

    for (let i = 0; i < monsters.length; i++) {
        const m = monsters[i];
        const el = monsterDomMap.get(m.id) || createMonsterDom(m);

        el.style.left = `${m.pixelX}px`;
        el.style.top = `${m.pixelY}px`;
        el.classList.toggle('slowed', m.slowTimer > 0);

        const hpPercent = Math.max(0, (m.hp / m.maxHp) * 100);
        const fillEl = el.querySelector('.m-hp-fill');
        if (fillEl) {
            fillEl.style.width = `${hpPercent}%`;
            if (hpPercent <= 25) {
                fillEl.style.backgroundColor = '#e74c3c';
            } else if (hpPercent <= 55) {
                fillEl.style.backgroundColor = '#f39c12';
            } else {
                fillEl.style.backgroundColor = '#2ecc71';
            }
        }
    }
}

function repositionAllMonsters() {
    for (let i = 0; i < monsters.length; i++) {
        const m = monsters[i];
        const pos = getCellCenter(m.gridX, m.gridY);
        m.pixelX = pos.left;
        m.pixelY = pos.top;
    }
    renderMonsterLayer();
}

function updateMonsters(dtMs) {
    const dtSec = dtMs / 1000;

    for (let i = monsters.length - 1; i >= 0; i--) {
        const m = monsters[i];

        if (m.slowTimer > 0) {
            m.slowTimer = Math.max(0, m.slowTimer - dtMs);
        }

        const slowMult = m.slowTimer > 0 ? (1 - CONFIG.ICE_SLOW_RATE) : 1.0;
        let remainingStep = m.baseSpeed * slowMult * dtSec;
        let reachedEnd = false;

        while (remainingStep > 0) {
            const targetWp = WAYPOINTS[m.wpIndex + 1];
            if (!targetWp) {
                reachedEnd = true;
                break;
            }

            const dx = targetWp.x - m.gridX;
            const dy = targetWp.y - m.gridY;
            const dist = Math.hypot(dx, dy);

            if (dist <= remainingStep) {
                m.gridX = targetWp.x;
                m.gridY = targetWp.y;
                m.wpIndex++;
                remainingStep -= dist;
                if (m.wpIndex >= WAYPOINTS.length - 1) {
                    reachedEnd = true;
                    break;
                }
            } else {
                m.gridX += (dx / dist) * remainingStep;
                m.gridY += (dy / dist) * remainingStep;
                remainingStep = 0;
            }
        }

        if (reachedEnd) {
            baseHp = Math.max(0, baseHp - 1);
            msgText.innerText = `🚨 怪物【${m.name}】突破防線！基地扣 1 點生命！`;
            monsters.splice(i, 1);
            removeMonsterDom(m.id);
            updateHUD();

            if (baseHp <= 0) {
                triggerGameOver();
                return;
            }
            continue;
        }

        const pos = getCellCenter(m.gridX, m.gridY);
        m.pixelX = pos.left;
        m.pixelY = pos.top;
    }

    renderMonsterLayer();
}

// ==================== 9. 主遊戲迴圈與 Game Over 結算 ====================
function triggerGameOver() {
    if (isGameOver) return;
    isGameOver = true;
    waveState = 'GAMEOVER';

    if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
    }

    clearTouchDragVisuals();
    draggedIndex = null;
    hoveredIndex = null;
    updateRangeIndicator();
    updateHUD();

    if (finalWaveTextEl) finalWaveTextEl.innerText = `Wave ${currentWave}`;
    if (finalBestTextEl) finalBestTextEl.innerText = `Wave ${bestWave}`;
    if (finalKillsTextEl) finalKillsTextEl.innerText = `${killsCount} 隻`;
    if (newRecordBadgeEl) {
        newRecordBadgeEl.classList.toggle('hidden', !isNewRecordThisRun);
    }
    if (gameOverOverlayEl) {
        gameOverOverlayEl.classList.remove('hidden');
    }
}

function restartGame() {
    if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
    }

    currentGold = CONFIG.INITIAL_GOLD;
    baseHp = CONFIG.INITIAL_BASE_HP;
    currentWave = 1;
    killsCount = 0;
    isGameOver = false;
    isNewRecordThisRun = false;

    spawnCounts = { fire: 0, ice: 0, thunder: 0 };
    board = Array(CONFIG.BOARD_SIZE).fill(null);
    monsters = [];
    monsterIdCounter = 1;

    for (const el of monsterDomMap.values()) {
        el.remove();
    }
    monsterDomMap.clear();
    if (monsterLayerEl) monsterLayerEl.innerHTML = '';
    if (fxLayerEl) fxLayerEl.innerHTML = '';
    if (floatingLayerEl) floatingLayerEl.innerHTML = '';

    clearTouchDragVisuals();
    draggedIndex = null;
    selectedIndex = null;
    hoveredIndex = null;

    waveState = 'PREP';
    waveTimerMs = CONFIG.INITIAL_PREP_MS;
    waveSpawnQueue = [];
    waveSpawnAccMs = 0;
    attackAccMs = 0;
    lastFrameTime = null;

    if (gameOverOverlayEl) {
        gameOverOverlayEl.classList.add('hidden');
    }

    msgText.innerText = '開局可召喚元素塔並拖曳或點擊合成；懸停或點選塔可預覽攻擊射程！';
    renderBoard();
    updateHUD();
    startMainLoop();
}

function gameTick(timestamp) {
    if (isGameOver) return;

    if (lastFrameTime === null) {
        lastFrameTime = timestamp;
    }
    // 限制單幀最大步長，避免切換分頁後怪物瞬間瞬移
    const dtMs = Math.min(100, Math.max(0, timestamp - lastFrameTime));
    lastFrameTime = timestamp;

    // 1. 波次狀態推進
    if (waveState === 'PREP' || waveState === 'INTERMISSION') {
        const prevSec = Math.ceil(waveTimerMs / 1000);
        waveTimerMs -= dtMs;
        const nextSec = Math.ceil(waveTimerMs / 1000);

        if (waveTimerMs <= 0) {
            const targetWave = waveState === 'PREP' ? 1 : currentWave + 1;
            startWave(targetWave);
        } else if (prevSec !== nextSec) {
            updateWavePhaseUI();
        }
    } else if (waveState === 'SPAWNING') {
        waveSpawnAccMs += dtMs;
        if (waveSpawnAccMs >= waveSpawnIntervalMs && waveSpawnQueue.length > 0) {
            waveSpawnAccMs -= waveSpawnIntervalMs;
            const nextEntry = waveSpawnQueue.shift();
            spawnMonsterFromEntry(nextEntry);
            if (waveSpawnQueue.length === 0) {
                waveState = 'CLEARING';
                updateWavePhaseUI();
            }
        }
    } else if (waveState === 'CLEARING') {
        if (monsters.length === 0) {
            waveState = 'INTERMISSION';
            waveTimerMs = CONFIG.WAVE_INTERMISSION_MS;
            msgText.innerText = `🎉 第 ${currentWave} 波防禦成功！下一波將於 ${Math.ceil(CONFIG.WAVE_INTERMISSION_MS / 1000)} 秒後出發！`;
            updateWavePhaseUI();
        }
    }

    // 2. 怪物移動更新
    if (monsters.length > 0) {
        updateMonsters(dtMs);
        if (isGameOver) return;
    }

    // 3. 防禦塔攻擊排程
    attackAccMs += dtMs;
    if (attackAccMs >= CONFIG.ATTACK_INTERVAL) {
        attackAccMs -= CONFIG.ATTACK_INTERVAL;
        runTowerAttacks();
    }

    rafId = requestAnimationFrame(gameTick);
}

function startMainLoop() {
    if (rafId !== null) cancelAnimationFrame(rafId);
    lastFrameTime = null;
    rafId = requestAnimationFrame(gameTick);
}

// ==================== 10. 棋盤渲染與雙軌互動（滑鼠/觸控拖曳 + 點擊 A 再點擊 B） ====================
function clearCellDragHighlights() {
    boardElement.querySelectorAll('.cell').forEach(c => {
        c.classList.remove('drag-over', 'drag-invalid');
    });
}

function clearTouchDragVisuals() {
    if (touchDragState && touchDragState.ghostEl) {
        touchDragState.ghostEl.remove();
    }
    clearCellDragHighlights();
    boardElement.querySelectorAll('.tower.dragging').forEach(t => t.classList.remove('dragging'));
    touchDragState = null;
}

function renderBoard() {
    // 只重建 #grid-board 內的 150 格，不觸碰同級的 #monster-layer，徹底根除怪物閃爍
    boardElement.innerHTML = '';

    board.forEach((towerObj, index) => {
        const cell = document.createElement('div');
        cell.classList.add('cell');
        cell.dataset.index = index;

        if (PATH_CELL_INDICES.has(index)) {
            cell.classList.add('path-cell');
            if (index === START_CELL_INDEX) cell.classList.add('path-start');
            if (index === END_CELL_INDEX) cell.classList.add('path-end');
        }

        if (selectedIndex === index) {
            cell.classList.add('selected');
        }

        // 桌面滑鼠懸停顯示射程圈
        cell.addEventListener('mouseenter', () => {
            if (hoveredIndex !== index) {
                hoveredIndex = index;
                updateRangeIndicator();
            }
        });

        cell.addEventListener('mouseleave', () => {
            if (hoveredIndex === index) {
                hoveredIndex = null;
                updateRangeIndicator();
            }
        });

        // HTML5 拖放事件
        cell.addEventListener('dragover', (e) => {
            e.preventDefault();
            cell.classList.add(PATH_CELL_INDICES.has(index) ? 'drag-invalid' : 'drag-over');
        });

        cell.addEventListener('dragleave', () => {
            cell.classList.remove('drag-over', 'drag-invalid');
        });

        cell.addEventListener('drop', (e) => {
            e.preventDefault();
            cell.classList.remove('drag-over', 'drag-invalid');
            const fromIdx = draggedIndex;
            draggedIndex = null;
            handleAction(fromIdx, index);
        });

        // 點擊 A 再點擊 B
        cell.addEventListener('click', () => {
            if (performance.now() - lastTouchDragEndTime < 250) return;
            handleCellClick(index);
        });

        if (towerObj !== null) {
            const cfg = ELEMENT_CONFIG[towerObj.type];
            const tower = document.createElement('div');
            tower.classList.add('tower', `type-${towerObj.type}`, `lv-${towerObj.tier}`);
            tower.setAttribute('draggable', true);

            tower.addEventListener('dragstart', () => {
                if (isGameOver) return;
                draggedIndex = index;
                selectedIndex = null;
                tower.classList.add('dragging');
                updateRangeIndicator();
                msgText.innerText = `抓起【${cfg.name} Lv.${towerObj.tier}】`;
            });

            tower.addEventListener('dragend', () => {
                tower.classList.remove('dragging');
                clearCellDragHighlights();
                draggedIndex = null;
                updateRangeIndicator();
            });

            // 觸控裝置拖曳支援
            tower.addEventListener('touchstart', (e) => {
                if (isGameOver || e.touches.length !== 1) return;
                const touch = e.touches[0];
                touchDragState = {
                    sourceIndex: index,
                    startX: touch.clientX,
                    startY: touch.clientY,
                    isDragging: false,
                    ghostEl: null,
                    towerEl: tower,
                    cfg: cfg,
                    tier: towerObj.tier
                };
            }, { passive: true });

            const icon = document.createElement('div');
            icon.classList.add('tower-icon');
            icon.innerText = cfg.icon;

            const name = document.createElement('div');
            name.classList.add('tower-name');
            name.innerText = `Lv.${towerObj.tier}`;

            tower.appendChild(icon);
            tower.appendChild(name);
            cell.appendChild(tower);
        }

        boardElement.appendChild(cell);
    });

    measureBoardMetrics();
    updateRangeIndicator();
}

// 全域觸控拖曳移動與放開處理
document.addEventListener('touchmove', (e) => {
    if (!touchDragState || e.touches.length !== 1) return;
    const touch = e.touches[0];
    const dist = Math.hypot(touch.clientX - touchDragState.startX, touch.clientY - touchDragState.startY);

    if (!touchDragState.isDragging && dist > 10) {
        touchDragState.isDragging = true;
        selectedIndex = null;
        touchDragState.towerEl.classList.add('dragging');

        const ghost = touchDragState.towerEl.cloneNode(true);
        ghost.classList.remove('dragging');
        ghost.classList.add('touch-drag-ghost');
        ghost.style.width = `${touchDragState.towerEl.offsetWidth}px`;
        ghost.style.height = `${touchDragState.towerEl.offsetHeight}px`;
        document.body.appendChild(ghost);
        touchDragState.ghostEl = ghost;

        updateRangeIndicator();
        msgText.innerText = `拖曳【${touchDragState.cfg.name} Lv.${touchDragState.tier}】至目標格`;
    }

    if (touchDragState.isDragging) {
        e.preventDefault();
        if (touchDragState.ghostEl) {
            touchDragState.ghostEl.style.left = `${touch.clientX}px`;
            touchDragState.ghostEl.style.top = `${touch.clientY}px`;
        }

        clearCellDragHighlights();
        const elUnder = document.elementFromPoint(touch.clientX, touch.clientY);
        const targetCell = elUnder ? elUnder.closest('.cell') : null;
        if (targetCell) {
            const targetIdx = Number(targetCell.dataset.index);
            targetCell.classList.add(PATH_CELL_INDICES.has(targetIdx) ? 'drag-invalid' : 'drag-over');
        }
    }
}, { passive: false });

document.addEventListener('touchend', (e) => {
    if (!touchDragState) return;
    const wasDragging = touchDragState.isDragging;
    const sourceIdx = touchDragState.sourceIndex;

    if (wasDragging) {
        const touch = e.changedTouches[0];
        const elUnder = touch ? document.elementFromPoint(touch.clientX, touch.clientY) : null;
        const targetCell = elUnder ? elUnder.closest('.cell') : null;

        clearTouchDragVisuals();
        lastTouchDragEndTime = performance.now();

        if (targetCell) {
            const targetIdx = Number(targetCell.dataset.index);
            handleAction(sourceIdx, targetIdx);
        } else {
            updateRangeIndicator();
        }
    } else {
        touchDragState = null;
    }
});

document.addEventListener('touchcancel', () => {
    if (!touchDragState) return;
    clearTouchDragVisuals();
    updateRangeIndicator();
});

function handleCellClick(index) {
    if (isGameOver) return;

    if (selectedIndex === null) {
        if (board[index] !== null) {
            selectedIndex = index;
            const t = board[index];
            const cfg = ELEMENT_CONFIG[t.type];
            const dmg = TIER_DAMAGE_TABLE[t.type][t.tier];
            msgText.innerText = `已選取【${cfg.name} Lv.${t.tier}】｜傷害 ${dmg}${t.type === 'thunder' ? '×2' : ''}｜射程 ${cfg.range} 格（可點目標格融合或按「確定清除」）`;
        }
    } else if (selectedIndex === index) {
        selectedIndex = null;
        msgText.innerText = '已取消選取。';
    } else {
        const fromIdx = selectedIndex;
        selectedIndex = null;
        handleAction(fromIdx, index);
        return;
    }

    renderBoard();
}

function handleAction(fromIndex, toIndex) {
    if (isGameOver) return;
    if (fromIndex === null || toIndex === null || fromIndex === toIndex) {
        renderBoard();
        return;
    }
    if (fromIndex < 0 || fromIndex >= CONFIG.BOARD_SIZE || toIndex < 0 || toIndex >= CONFIG.BOARD_SIZE) return;
    if (!board[fromIndex]) return;

    if (PATH_CELL_INDICES.has(toIndex)) {
        msgText.innerText = '⚠️ 該位置是怪物跑道，不能建造防禦塔！';
        renderBoard();
        return;
    }

    const fromTower = board[fromIndex];
    const toTower = board[toIndex];

    if (toTower === null) {
        board[toIndex] = fromTower;
        board[fromIndex] = null;
        msgText.innerText = '已移動塔的位置。';
    } else if (fromTower.type === toTower.type && fromTower.tier === toTower.tier) {
        if (toTower.tier >= CONFIG.MAX_TIER) {
            msgText.innerText = `⚠️ 該塔已達到上限 Lv.${CONFIG.MAX_TIER}，無法再融合！兩座塔維持原樣。`;
        } else {
            board[toIndex] = {
                type: toTower.type,
                tier: toTower.tier + 1
            };
            board[fromIndex] = null;

            const cfg = ELEMENT_CONFIG[board[toIndex].type];
            msgText.innerText = `✨ 融合成功！升級為【${cfg.name} Lv.${board[toIndex].tier}】！`;
        }
    } else {
        msgText.innerText = '⚠️ 屬性或等級不同，無法融合！';
    }

    renderBoard();
}

// ==================== 11. 按鈕事件與視窗自適應監聽 ====================
deleteTowerBtn.addEventListener('click', () => {
    if (isGameOver) return;

    if (selectedIndex === null || board[selectedIndex] === null) {
        msgText.innerText = '⚠️ 請先在棋盤上「點選」想要清除的塔！';
        return;
    }

    const t = board[selectedIndex];
    const cfg = ELEMENT_CONFIG[t.type];
    board[selectedIndex] = null;
    msgText.innerText = `🗑️ 已成功清除【${cfg.name} Lv.${t.tier}】！騰出了一格空間。`;
    selectedIndex = null;

    renderBoard();
});

nextWaveBtn.addEventListener('click', () => {
    if (isGameOver) return;
    if (waveState === 'PREP') {
        startWave(1);
    } else if (waveState === 'INTERMISSION') {
        startWave(currentWave + 1);
    }
});

addGoldBtn.addEventListener('click', () => {
    if (isGameOver) return;
    currentGold += 500;
    msgText.innerText = '🛠️ 已增加 500 💰！按鈕已解鎖。';
    updateHUD();
});

clearGoldBtn.addEventListener('click', () => {
    if (isGameOver) return;
    currentGold = 0;
    msgText.innerText = '🛠️ 金幣已歸零！按鈕變灰，請點擊測試抖動反饋。';
    updateHUD();
});

restartBtn.addEventListener('click', restartGame);

function handleBoardLayoutChange() {
    measureBoardMetrics();
    repositionAllMonsters();
    updateRangeIndicator();
}

window.addEventListener('resize', handleBoardLayoutChange);
if (typeof ResizeObserver !== 'undefined') {
    const ro = new ResizeObserver(handleBoardLayoutChange);
    ro.observe(boardElement);
}

// ==================== 12. 初始化啟動 ====================
renderSpawnerButtons();
renderBoard();
updateHUD();
startMainLoop();
