// ==================== 1. 遊戲規格與平衡參數 ====================
const CONFIG = {
    INITIAL_GOLD: 0,
    BASE_COST: 10,
    COST_STEP: 10,
    MAX_TIER: 3,
    ATTACK_INTERVAL: 1000
};

const ELEMENT_CONFIG = {
    fire: { name: "火塔", icon: "🔥", baseAtk: 30 },
    ice: { name: "冰塔", icon: "❄️", baseAtk: 20 },
    thunder: { name: "雷塔", icon: "⚡", baseAtk: 15 }
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

let spawnCounts = {
    fire: 0,
    ice: 0,
    thunder: 0
};

let board = Array(9).fill(null);
let draggedIndex = null;
let selectedIndex = null;

let currentDummyKey = "wood";
let dummyCurrentHp = DUMMY_DATABASE.wood.maxHp;
let isDummyRespawning = false;

// DOM 元素快取
const boardElement = document.getElementById('grid-board');
const spawnerContainer = document.getElementById('element-spawner-container');
const addGoldBtn = document.getElementById('add-gold-btn');
const clearGoldBtn = document.getElementById('clear-gold-btn');
const deleteTowerBtn = document.getElementById('delete-tower-btn');
const goldDisplay = document.getElementById('gold-display');
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
        if (val === null) emptyIndices.push(idx);
    });

    if (emptyIndices.length === 0) {
        msgText.innerText = '⚠️ 格子已經全滿，請先融合騰出空間！';
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
function calculateDamage(towerObj) {
    const cfg = ELEMENT_CONFIG[towerObj.type];
    const dummyCfg = DUMMY_DATABASE[currentDummyKey];

    const tierScale = Math.pow(2, towerObj.tier - 1);
    const baseDmg = cfg.baseAtk * tierScale;

    const isWeakness = (towerObj.type === dummyCfg.weakness);
    const multiplier = isWeakness ? 2.0 : 1.0;

    const finalDmg = Math.round(baseDmg * multiplier);
    return { damage: finalDmg, isWeakness: isWeakness };
}

function spawnDamageNumber(amount, isWeakness) {
    const dmgEl = document.createElement('div');
    dmgEl.classList.add('floating-dmg', isWeakness ? 'weakness' : 'normal');
    dmgEl.innerText = isWeakness ? `WEAK! -${amount}` : `-${amount}`;

    const randomOffsetX = (Math.random() - 0.5) * 60;
    dmgEl.style.left = `calc(50% + ${randomOffsetX}px)`;
    dmgEl.style.top = `15px`;

    dmgContainerEl.appendChild(dmgEl);
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

setInterval(() => {
    if (isDummyRespawning) return;

    let totalHits = 0;
    board.forEach((towerObj) => {
        if (towerObj !== null && dummyCurrentHp > 0) {
            const result = calculateDamage(towerObj);
            dummyCurrentHp = Math.max(0, dummyCurrentHp - result.damage);
            spawnDamageNumber(result.damage, result.isWeakness);
            totalHits++;
        }
    });

    if (totalHits > 0) {
        triggerHitFlash();
        updateDummyUI();
        if (dummyCurrentHp <= 0) handleDummyDeath();
    }
}, CONFIG.ATTACK_INTERVAL);

dummyButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        const targetType = btn.dataset.type;
        if (currentDummyKey === targetType) return;

        dummyButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        currentDummyKey = targetType;
        dummyCurrentHp = DUMMY_DATABASE[currentDummyKey].maxHp;
        isDummyRespawning = false;
        updateDummyUI();

        const cfg = DUMMY_DATABASE[currentDummyKey];
        msgText.innerText = `已切換目標為【${cfg.name}】！${cfg.weaknessText}`;
    });
});

// ==================== 6. 畫面渲染與棋盤交互 ====================
function renderBoard() {
    boardElement.innerHTML = '';

    board.forEach((towerObj, index) => {
        const cell = document.createElement('div');
        cell.classList.add('cell');
        cell.dataset.index = index;

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
    if (fromIndex === null || fromIndex === toIndex) return;

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
// 確定清除按鈕邏輯
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