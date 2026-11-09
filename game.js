// ==================== 1. 遊戲規格與平衡參數 ====================
const CONFIG = {
    INITIAL_GOLD: 0,
    BASE_COST: 10,
    COST_STEP: 10,
    MAX_TIER: 3,
    ATTACK_INTERVAL: 1000,
    BOARD_SIZE: 150 // 15 寬 x 10 高 = 150 格
};

const ELEMENT_CONFIG = {
    fire: { name: "火塔", icon: "🔥", baseAtk: 30 },
    ice: { name: "冰塔", icon: "❄️", baseAtk: 20 },
    thunder: { name: "雷塔", icon: "⚡", baseAtk: 15 }
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
    return y * 15 + x;
}

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

// ==================== 自訂階級傷害查表 ====================
const TIER_DAMAGE_TABLE = {
    fire: [0, 30, 66, 135],
    ice: [0, 20, 44, 90],
    thunder: [0, 15, 33, 70]
};

const DUMMY_DATABASE = {
    wood: {
        name: "蔓藤巨魔",
        icon: "🌿",
        weakness: "fire",
        weaknessText: "弱點：🔥 火 (200%)",
        maxHp: 200,
        reward: 20
    },
    lava: {
        name: "熔岩傀儡",
        icon: "🌋",
        weakness: "ice",
        weaknessText: "弱點：❄️ 冰 (200%)",
        maxHp: 200,
        reward: 20
    },
    air: {
        name: "機械飛艇",
        icon: "💧",
        weakness: "thunder",
        weaknessText: "弱點：⚡ 雷 (200%)",
        maxHp: 200,
        reward: 20
    }
};

// ==================== 2. 狀態管理 ====================
let currentGold = CONFIG.INITIAL_GOLD;
let baseHp = 20;

let spawnCounts = {
    fire: 0,
    ice: 0,
    thunder: 0
};

let board = Array(CONFIG.BOARD_SIZE).fill(null);
let draggedIndex = null;
let selectedIndex = null;

let currentDummyKey = "wood";
let dummyCurrentHp = DUMMY_DATABASE.wood.maxHp;
let isDummyRespawning = false;

// 怪物實體列表
let monsters = [];
let monsterIdCounter = 1;

// DOM 元素快取
const boardElement = document.getElementById('grid-board');
const monsterLayerEl = document.getElementById('monster-layer');
const spawnerContainer = document.getElementById('element-spawner-container');
const addGoldBtn = document.getElementById('add-gold-btn');
const clearGoldBtn = document.getElementById('clear-gold-btn');
const deleteTowerBtn = document.getElementById('delete-tower-btn');
const goldDisplay = document.getElementById('gold-display');
const baseHpDisplay = document.getElementById('base-hp-display');
const msgText = document.getElementById('msg-text');

const dummyIconEl = document.getElementById('dummy-icon');
const dummyNameEl = document.getElementById('dummy-name');
const dummyWeaknessEl = document.getElementById('dummy-weakness-tag');
const hpBarFillEl = document.getElementById('hp-bar-fill');
const hpTextEl = document.getElementById('hp-text');
const dmgContainerEl = document.getElementById('damage-floating-container');
const dummyButtons = document.querySelectorAll('.dummy-btn');

// ==================== 3. 數值與定價公式 ====================
function getCost(type) {
    const count = spawnCounts[type] || 0;
    return CONFIG.BASE_COST + (count * CONFIG.COST_STEP);
}

function updateHUD() {
    goldDisplay.innerText = currentGold;
    if (baseHpDisplay) baseHpDisplay.innerText = baseHp;

    Object.keys(ELEMENT_CONFIG).forEach(type => {
        const btn = document.getElementById(`spawn-btn-${type}`);
        if (btn) {
            const cost = getCost(type);
            const costEl = btn.querySelector('.btn-cost-val');
            if (costEl) costEl.innerText = `${cost} 💰`;

            if (currentGold < cost) {
                btn.classList.add('btn-disabled');
            } else {
                btn.classList.remove('btn-disabled');
            }
        }
    });
}

// ==================== 4. 生成召喚按鈕 ====================
function renderSpawnerButtons() {
    spawnerContainer.innerHTML = '';

    Object.entries(ELEMENT_CONFIG).forEach(([type, data]) => {
        const btn = document.createElement('button');
        btn.id = `spawn-btn-${type}`;
        btn.classList.add('spawn-card-btn', `btn-type-${type}`);

        btn.innerHTML = `
          <span>${data.icon} 召喚${data.name}</span>
          <span class="btn-cost-val">${getCost(type)} 💰</span>
        `;

        btn.addEventListener('click', () => handleSpawn(type, btn));
        spawnerContainer.appendChild(btn);
    });
}

function handleSpawn(type, btnElement) {
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

    msgText.innerText = `成功召喚【${ELEMENT_CONFIG[type].name} Lv.1】！花費了 ${cost} 💰。`;

    renderBoard();
    updateHUD();
}

// ==================== 5. 戰鬥系統與數值公式 ====================
function calculateDamage(towerObj, monster) {
    // 讀取你在 TIER_DAMAGE_TABLE 裡的數值
    const baseDmg = (TIER_DAMAGE_TABLE[towerObj.type] && TIER_DAMAGE_TABLE[towerObj.type][towerObj.tier]) || 10;
    // 比對走在路上的怪物弱點 (維持 2.0 倍相剋)
    const isWeakness = (towerObj.type === monster.weakness);
    const multiplier = isWeakness ? 2.0 : 1.0;

    const finalDmg = Math.round(baseDmg * multiplier);
    return { damage: finalDmg, isWeakness: isWeakness };
}

function spawnDamageNumber(amount, isWeakness, px, py) {
    const dmgEl = document.createElement('div');
    dmgEl.classList.add('floating-dmg', isWeakness ? 'weakness' : 'normal');
    dmgEl.innerText = isWeakness ? `WEAK! -${amount}` : `-${amount}`;

    // 直接彈在怪物實體頭頂上方
    const randomOffsetX = (Math.random() - 0.5) * 20;
    dmgEl.style.left = `${px + randomOffsetX}px`;
    dmgEl.style.top = `${py - 18}px`;

    boardElement.appendChild(dmgEl);
    setTimeout(() => dmgEl.remove(), 750);
}

function triggerHitFlash() {
    dummyIconEl.classList.remove('hit-flash');
    void dummyIconEl.offsetWidth;
    dummyIconEl.classList.add('hit-flash');
}

function handleDummyDeath() {
    const dummyCfg = DUMMY_DATABASE[currentDummyKey];
    isDummyRespawning = true;

    currentGold += dummyCfg.reward;
    msgText.innerText = `💥 成功擊倒【${dummyCfg.name}】！獲得 +${dummyCfg.reward} 💰！`;
    updateHUD();

    setTimeout(() => {
        dummyCurrentHp = dummyCfg.maxHp;
        isDummyRespawning = false;
        updateDummyUI();
    }, 450);
}

function updateDummyUI() {
    const dummyCfg = DUMMY_DATABASE[currentDummyKey];
    dummyIconEl.innerText = dummyCfg.icon;
    dummyNameEl.innerText = dummyCfg.name;
    dummyWeaknessEl.innerText = dummyCfg.weaknessText;

    const percent = Math.max(0, (dummyCurrentHp / dummyCfg.maxHp) * 100);
    hpBarFillEl.style.width = `${percent}%`;
    hpTextEl.innerText = `${dummyCurrentHp} / ${dummyCfg.maxHp}`;

    if (percent <= 30) {
        hpBarFillEl.style.background = 'linear-gradient(90deg, #e74c3c, #c0392b)';
    } else {
        hpBarFillEl.style.background = 'linear-gradient(90deg, #2ecc71, #27ae60)';
    }
}

// ==================== 防禦塔戰鬥輪詢 (集火跑在最前面的怪物) ====================
setInterval(() => {
    // 如果場上完全沒有怪在走動，防禦塔待機不開火
    if (monsters.length === 0) return;

    // 索敵規則：鎖定「走在最前面」的怪物 (wpIndex 越大代表走得越前面)
    let leadingMonster = monsters[0];
    for (let i = 1; i < monsters.length; i++) {
        if (monsters[i].wpIndex > leadingMonster.wpIndex) {
            leadingMonster = monsters[i];
        }
    }

    // 遍歷盤面上所有的塔進行開火攻擊
    board.forEach((towerObj) => {
        if (towerObj !== null && leadingMonster && leadingMonster.hp > 0) {
            const result = calculateDamage(towerObj, leadingMonster);
            leadingMonster.hp = Math.max(0, leadingMonster.hp - result.damage);

            // 在怪物頭頂跳出傷害數字
            spawnDamageNumber(result.damage, result.isWeakness, leadingMonster.pixelX, leadingMonster.pixelY);

            // 怪物血量歸零：擊殺結算並掉落金幣
            if (leadingMonster.hp <= 0) {
                currentGold += leadingMonster.reward;
                msgText.innerText = `💥 擊殺【${leadingMonster.name}】！獲得 +${leadingMonster.reward} 💰！`;
                updateHUD();

                // 從活體陣列中移除
                const deadIdx = monsters.findIndex(m => m.id === leadingMonster.id);
                if (deadIdx !== -1) {
                    monsters.splice(deadIdx, 1);
                }
                leadingMonster = null; // 本輪目標已死，停止後續多餘射擊
            }
        }
    });

    // 立即更新怪物的血條長度
    renderMonsterLayer();
}, CONFIG.ATTACK_INTERVAL);
// ==================== 怪物實體移動邏輯 ====================
function getCellCenter(gridX, gridY) {
    const cellSize = 34;
    const gap = 3;
    const padding = 8;
    const left = padding + gridX * (cellSize + gap) + cellSize / 2;
    const top = padding + gridY * (cellSize + gap) + cellSize / 2;
    return { left, top };
}

function spawnMonster(typeKey = 'wood') {
    const dummyCfg = DUMMY_DATABASE[typeKey];
    const startPos = getCellCenter(WAYPOINTS[0].x, WAYPOINTS[0].y);

    const monster = {
        id: monsterIdCounter++,
        typeKey: typeKey,
        name: dummyCfg.name,
        icon: dummyCfg.icon,
        weakness: dummyCfg.weakness,
        hp: dummyCfg.maxHp,
        maxHp: dummyCfg.maxHp,
        reward: dummyCfg.reward,
        wpIndex: 0,
        gridX: WAYPOINTS[0].x,
        gridY: WAYPOINTS[0].y,
        pixelX: startPos.left,
        pixelY: startPos.top,
        speed: 0.15
    };

    monsters.push(monster);
}

function updateMonsters() {
    for (let i = monsters.length - 1; i >= 0; i--) {
        const m = monsters[i];
        const targetWp = WAYPOINTS[m.wpIndex + 1];

        if (!targetWp) {
            baseHp = Math.max(0, baseHp - 1);
            if (baseHpDisplay) baseHpDisplay.innerText = baseHp;
            msgText.innerText = `🚨 怪物【${m.name}】突破防線！基地扣 1 點生命！`;
            monsters.splice(i, 1);
            continue;
        }

        const dx = targetWp.x - m.gridX;
        const dy = targetWp.y - m.gridY;
        const dist = Math.hypot(dx, dy);

        if (dist <= m.speed) {
            m.gridX = targetWp.x;
            m.gridY = targetWp.y;
            m.wpIndex++;
        } else {
            m.gridX += (dx / dist) * m.speed;
            m.gridY += (dy / dist) * m.speed;
        }

        const pos = getCellCenter(m.gridX, m.gridY);
        m.pixelX = pos.left;
        m.pixelY = pos.top;
    }

    renderMonsterLayer();
}

function renderMonsterLayer() {
    const layer = document.getElementById('monster-layer');
    if (!layer) return;
    layer.innerHTML = '';

    monsters.forEach(m => {
        const el = document.createElement('div');
        el.classList.add('monster-unit');
        el.style.left = `${m.pixelX}px`;
        el.style.top = `${m.pixelY}px`;

        const hpPercent = Math.max(0, (m.hp / m.maxHp) * 100);

        el.innerHTML = `
          <span class="m-icon">${m.icon}</span>
          <div class="m-hp-bar">
            <div class="m-hp-fill" style="width: ${hpPercent}%;"></div>
          </div>
        `;

        layer.appendChild(el);
    });
}

// 啟動怪物走動計時器 (每 50 毫秒更新移動)
setInterval(updateMonsters, 50);

// 每 3.5 秒在跑道起點自動生成一隻怪
setInterval(() => {
    spawnMonster(currentDummyKey);
}, 3500);

// ==================== 6. 畫面渲染與棋盤交互 ====================
function renderBoard() {
    boardElement.innerHTML = '';

    // 重新塞回怪物層容器
    const layer = document.createElement('div');
    layer.id = 'monster-layer';
    boardElement.appendChild(layer);

    board.forEach((towerObj, index) => {
        const cell = document.createElement('div');
        cell.classList.add('cell');
        cell.dataset.index = index;

        if (PATH_CELL_INDICES.has(index)) {
            cell.classList.add('path-cell');
        }

        if (selectedIndex === index) {
            cell.classList.add('selected');
        }

        cell.addEventListener('dragover', (e) => {
            e.preventDefault();
            cell.classList.add('drag-over');
        });

        cell.addEventListener('dragleave', () => {
            cell.classList.remove('drag-over');
        });

        cell.addEventListener('drop', (e) => {
            e.preventDefault();
            cell.classList.remove('drag-over');
            handleAction(draggedIndex, index);
        });

        cell.addEventListener('click', () => {
            handleCellClick(index);
        });

        if (towerObj !== null) {
            const cfg = ELEMENT_CONFIG[towerObj.type];
            const tower = document.createElement('div');
            tower.classList.add('tower', `type-${towerObj.type}`, `lv-${towerObj.tier}`);
            tower.setAttribute('draggable', true);

            tower.addEventListener('dragstart', () => {
                draggedIndex = index;
                selectedIndex = null;
                tower.classList.add('dragging');
                msgText.innerText = `抓起【${cfg.name} Lv.${towerObj.tier}】`;
            });

            tower.addEventListener('dragend', () => {
                tower.classList.remove('dragging');
                document.querySelectorAll('.cell').forEach(c => c.classList.remove('drag-over'));
                draggedIndex = null;
            });

            const icon = document.createElement('div');
            icon.classList.add('tower-icon');
            icon.innerText = cfg.icon;

            const name = document.createElement('div');
            name.classList.add('tower-name');
            name.innerText = `${cfg.name} Lv.${towerObj.tier}`;

            tower.appendChild(icon);
            tower.appendChild(name);
            cell.appendChild(tower);
        }

        boardElement.appendChild(cell);
    });
}

function handleCellClick(index) {
    if (selectedIndex === null) {
        if (board[index] !== null) {
            selectedIndex = index;
            const t = board[index];
            const cfg = ELEMENT_CONFIG[t.type];
            msgText.innerText = `選取了【${cfg.name} Lv.${t.tier}】（可點目標格融合，或按「確定清除」拔除）`;
        }
    } else if (selectedIndex === index) {
        selectedIndex = null;
        msgText.innerText = '已取消選取。';
    } else {
        handleAction(selectedIndex, index);
        selectedIndex = null;
    }
    renderBoard();
}

function handleAction(fromIndex, toIndex) {
    if (fromIndex === null || toIndex === null || fromIndex === toIndex) return;
    if (fromIndex < 0 || fromIndex >= CONFIG.BOARD_SIZE || toIndex < 0 || toIndex >= CONFIG.BOARD_SIZE) return;
    if (!board[fromIndex]) return;

    if (PATH_CELL_INDICES.has(toIndex)) {
        msgText.innerText = '⚠️ 該位置是怪物跑道，不能建造防禦塔！';
        return;
    }

    const fromTower = board[fromIndex];
    const toTower = board[toIndex];

    if (toTower === null) {
        board[toIndex] = fromTower;
        board[fromIndex] = null;
        msgText.innerText = '已移動塔的位置。';
    } else {
        if (fromTower.type === toTower.type && fromTower.tier === toTower.tier) {
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
            msgText.innerText = '屬性或等級不同，無法融合！';
        }
    }

    renderBoard();
}

// ==================== 7. 工具按鈕事件 ====================
deleteTowerBtn.addEventListener('click', () => {
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

addGoldBtn.addEventListener('click', () => {
    currentGold += 500;
    msgText.innerText = '🛠️ 已增加 500 💰！按鈕已解鎖。';
    updateHUD();
});

clearGoldBtn.addEventListener('click', () => {
    currentGold = 0;
    msgText.innerText = '🛠️ 金幣已歸零！按鈕變灰，請點擊測試抖動反饋。';
    updateHUD();
});

// ==================== 8. 初始化啟動 ====================
renderSpawnerButtons();
renderBoard();
updateHUD();
updateDummyUI();