/**
 * ============================================================================
 * 【檔案名稱】：config.js
 * 【負責功能】：全遊戲總控開關（如測試模式 DEBUG_MODE）、全域命名空間 window.GameApp 初始化，
 *               以及通用座標換算、數值夾限與深度合併（Deep Merge）工具函式。
 * 【讀取資料】：無（本檔為最底層第 1 順位載入之基礎設定檔）。
 * 【常見修改入口】：
 *   1. 修改 GLOBAL_CONFIG.DEBUG_MODE = true 可開啟畫面下方「+500 金幣 / 清空金幣」測試鈕。
 *   2. 修改 GLOBAL_CONFIG.VICTORY_WAVE 可調整正式通關波數（預設第 10 波為最終魔王戰）。
 * ============================================================================
 */
(function (global) {
    'use strict';

    // 初始化全域公開總部命名空間 window.GameApp
    const GameApp = global.GameApp || {
        config: {},
        data: {},
        systems: {},
        core: {},
        helpers: {},
        runtime: null,
        lastCopiedReport: ''
    };
    global.GameApp = GameApp;

    // ==================== 發佈總控開關（對外公開版請維持 DEBUG_MODE: false） ====================
    const GLOBAL_CONFIG = {
        DEBUG_MODE: false,                  // 發佈總控開關：false = 正式公開版（隱藏測試加錢鈕）；true = 開發測試版
        VICTORY_WAVE: 10,                   // 正式版總關卡波數（第 10 波為最終魔王戰）
        BOARD_COLS: 15,
        BOARD_ROWS: 10,
        BOARD_SIZE: 150,                    // 15 寬 x 10 高 = 150 格
        INITIAL_PREP_MS: 6000,              // 開局備戰倒數 (ms)
        WAVE_INTERMISSION_MS: 4000,         // 波次間休息倒數 (ms)
        FEEL_IDLE_THRESHOLD_MS: 4000,       // 試玩體感追蹤：超過 4 秒無任何操作視為發呆
        STORAGE_BEST_WAVE_KEY: 'merge_defense_best_wave',
        STORAGE_MAP_RECORDS_KEY: 'merge_defense_map_records',
        STORAGE_CAREER_STATS_KEY: 'merge_defense_career_stats',
        STORAGE_LOCAL_BALANCE_KEY: 'merge_defense_local_balance_override',
        STORAGE_MUTE_KEY: 'merge_defense_muted',
        STORAGE_CODEX_KEY: 'merge_defense_codex_unlocked',
        STORAGE_DAILY_RECORDS_KEY: 'merge_defense_daily_records',
        STORAGE_PUZZLE_RECORDS_KEY: 'merge_defense_puzzle_records',
        FIRST_CLEAR_HONOR_BONUS: 200,
        WEATHER_TYPES: ['sun', 'snow', 'storm', 'eclipse'],
        WEATHER_CATALOG: {
            sun: {
                id: 'sun',
                icon: '☀️',
                nameZh: '熾陽季',
                nameEn: 'Sunlit Blaze',
                shortZh: '火程+0.4 · 灼傷+25% · 冰緩-15% · 🔥股+10%',
                shortEn: 'Fire Rng+0.4 · Burn+25% · Ice Slow-15% · 🔥Stock+10%',
                stockElement: 'fire',
                stockBias: 0.10,
                stockVolMult: 1.0,
                fireRangeBonus: 0.4,
                burnMult: 1.25,
                iceSlowMult: 0.85
            },
            snow: {
                id: 'snow',
                icon: '❄️',
                nameZh: '霜雪季',
                nameEn: 'Frost Drift',
                shortZh: '怪速-10% · 冰暴+15% · 草地+5💰 · ❄️股+10%',
                shortEn: 'Foe Spd-10% · Ice Crit+15% · Grass+5💰 · ❄️Stock+10%',
                stockElement: 'ice',
                stockBias: 0.10,
                stockVolMult: 1.0,
                monsterSpeedMult: 0.90,
                iceCritBonus: 0.15,
                grassBuildSurcharge: 5
            },
            storm: {
                id: 'storm',
                icon: '⛈️',
                nameZh: '雷暴季',
                nameEn: 'Tempest Surge',
                shortZh: '6s 天雷劈最高血怪 · ⚡股波動×2',
                shortEn: '6s Sky Bolt vs Highest HP · ⚡Stock Vol ×2',
                stockElement: 'thunder',
                stockBias: 0,
                stockVolMult: 2.0,
                skyBoltIntervalMs: 6000
            },
            eclipse: {
                id: 'eclipse',
                icon: '🌑',
                nameZh: '蝕月黑潮',
                nameEn: 'Eclipse Tide',
                shortZh: '怪減傷15% · 賞金靈露+30% · 盲盒3★×2',
                shortEn: 'Foe -15% DMG · Gold/Dew+30% · Box 3★ ×2',
                stockElement: null,
                stockBias: 0,
                stockVolMult: 1.5,
                monsterDmgReduction: 0.15,
                killGoldBonusRate: 0.30,
                killDewMult: 1.30,
                blindBoxTier3Mult: 2.0
            }
        },
        PUZZLE_TRIALS: [
            {
                id: 'puzzle_armor_breach',
                order: 1,
                mapId: 'lava',
                wave: 5,
                startGold: 185,
                startLives: 1,
                titleZh: '殘局 I：黑曜破甲陣',
                titleEn: 'Trial I: Obsidian Breach',
                descZh: '高護甲重裝魔像沿火山狹道逼近，運用火系破甲或蒸氣穿甲擊潰防線。',
                descEn: 'Heavy armored golems march down the caldera lane. Use Fire shatter or Steam pierce.',
                hintZh: '建議優先構築 🔥火 / ♨️蒸氣 穿透高護甲目標',
                hintEn: 'Tip: Prioritize 🔥 Fire or ♨️ Steam to melt heavy armor',
                queueSpecs: [
                    { type: 'wood', count: 4, intervalMs: 750, waveLevel: 4 },
                    { type: 'golem', count: 4, intervalMs: 1100, waveLevel: 5 }
                ]
            },
            {
                id: 'puzzle_frost_halt',
                order: 2,
                mapId: 'frost',
                wave: 6,
                startGold: 195,
                startLives: 1,
                titleZh: '殘局 II：極速獵犬衝線',
                titleEn: 'Trial II: Gale Hound Rush',
                descZh: '雙路線同時湧出極速疾風獵犬與虛空影豹，只有 1 點生命容錯，務必以緩速與凍結截停！',
                descEn: 'Gale Hounds & Shadow Panthers sprint down twin lanes with 1 ❤️. Lock them down with Chill & Slow!',
                hintZh: '建議配置 ❄️冰塔與 🧲磁環 觸發減速＋定身控制',
                hintEn: 'Tip: Combine ❄️ Ice slow and 🧲 Magnet snare to break stealth & speed',
                queueSpecs: [
                    { type: 'hound', count: 10, intervalMs: 560, waveLevel: 5 },
                    { type: 'panther', count: 3, intervalMs: 1050, waveLevel: 6 }
                ]
            },
            {
                id: 'puzzle_shield_breaker',
                order: 3,
                mapId: 'thunder_isles',
                wave: 7,
                startGold: 220,
                startLives: 1,
                titleZh: '殘局 III：浮島裂隙破盾',
                titleEn: 'Trial III: Skyrift Shatter',
                descZh: '機械飛艇護航符文護衛經單向裂隙突襲！善用發光充能浮石 (+40% 傷) 與雷／磁環瓦解藍盾！',
                descEn: 'Airships & Shielded Guardians warp via A → B rift! Use active Floatstone (+40% DMG) & ⚡/🧲!',
                hintZh: '建議將 ⚡雷 / 🧲磁環 部署於發光 ⚡ 充能浮石觸發高效破盾',
                hintEn: 'Tip: Place ⚡ Thunder or 🧲 Magnet on glowing Floatstones for fast shield break',
                queueSpecs: [
                    { type: 'air', count: 5, intervalMs: 700, waveLevel: 6 },
                    { type: 'guardian', count: 4, intervalMs: 1050, waveLevel: 7 }
                ]
            },
            {
                id: 'puzzle_split_purge',
                order: 4,
                mapId: 'blackmarket',
                wave: 8,
                startGold: 240,
                startLives: 1,
                titleZh: '殘局 IV：黑市裂殖疫潮',
                titleEn: 'Trial IV: Market Fission Tide',
                descZh: '癒合花妖為分裂史萊姆持續回血！靈活開採場上藏寶巨石或直接構築 🔥灼燒重傷與 ♨️濺射防線。',
                descEn: 'Healer dryads sustain Splitting Slimes! Mine Treasure Rocks or build 🔥 Wound + ♨️ AoE.',
                hintZh: '建議以 🔥灼燒重傷 抑制治療並搭配 ♨️蒸氣範圍清場',
                hintEn: 'Tip: Inflict 🔥 Burn grievous wounds to halve healing and splash splits',
                queueSpecs: [
                    { type: 'slime', count: 5, intervalMs: 850, waveLevel: 7 },
                    { type: 'healer', count: 3, intervalMs: 1150, waveLevel: 8 }
                ]
            },
            {
                id: 'puzzle_boss_trial',
                order: 5,
                mapId: 'frost',
                wave: 9,
                startGold: 360,
                startLives: 1,
                titleZh: '殘局 V：高甲三王極限斬首',
                titleEn: 'Trial V: Triple Boss Execution',
                descZh: '熔岩巨獸王、腐朽古樹王與天穹堡壘艦接踵壓境！精算高階雙元／三元融合一舉擊破三巨頭。',
                descEn: 'Three armored Stage Bosses march in sequence! Forge 3★/4★ merged towers to execute all three.',
                hintZh: '建議運用火系破甲 ＋ 冰雷破盾高階融合壓制三王弱點',
                hintEn: 'Tip: Combine Fire shred + Ice/Thunder burst to counter all 3 Boss weaknesses',
                queueSpecs: [
                    { type: 'golem', count: 2, intervalMs: 950, waveLevel: 8 },
                    { type: 'lava', count: 1, intervalMs: 1400, waveLevel: 5, bossWaveRef: 5, bossHpScale: 0.45, isBoss: true },
                    { type: 'wood', count: 1, intervalMs: 1500, waveLevel: 10, bossWaveRef: 10, bossHpScale: 0.30, isBoss: true },
                    { type: 'air', count: 1, intervalMs: 1600, waveLevel: 15, bossWaveRef: 15, bossHpScale: 0.22, isBoss: true }
                ]
            }
        ],
        CONTRACT_SCORE_BONUS_PER_ITEM: 0.15,
        DIFFICULTY_CONTRACTS: [
            { id: 'fast_tide', code: '契約 I', name: '疾行魔潮', desc: '全體敵軍移動速度 +15%' },
            { id: 'iron_armor', code: '契約 II', name: '鐵壁重甲', desc: '全體敵軍基礎護甲 +4' },
            { id: 'frenzied_hp', code: '契約 III', name: '狂暴生命', desc: '全體敵軍最大生命值 +20%' },
            { id: 'dew_drought', code: '契約 IV', name: '靈露枯竭', desc: '初始靈露降為 0，回復速度 -20%' },
            { id: 'budget_crunch', code: '契約 V', name: '軍費緊縮', desc: '開局初始金幣 -15' },
            { id: 'fragile_heart', code: '契約 VI', name: '脆弱樹心', desc: '世界樹初始生命上限降為 12' },
            { id: 'rapid_waves', code: '契約 VII', name: '急速波次', desc: '波間休息準備時間減半（早鳥獎金照常計算）' },
            { id: 'boss_tyranny', code: '契約 VIII', name: '霸主威壓', desc: '所有波次 Boss 生命值額外 +30%' }
        ],
        SFX_VOLUME_MIN: 0.08,
        SFX_VOLUME_MAX: 0.18
    };

    function clampNumber(val, min, max, fallback) {
        const n = Number(val);
        if (!Number.isFinite(n)) return fallback;
        return Math.min(max, Math.max(min, n));
    }

    function coordsToIndex(x, y) {
        return y * GLOBAL_CONFIG.BOARD_COLS + x;
    }

    function indexToCoords(index) {
        return {
            x: index % GLOBAL_CONFIG.BOARD_COLS,
            y: Math.floor(index / GLOBAL_CONFIG.BOARD_COLS)
        };
    }

    function isPlainObject(obj) {
        return Boolean(obj && typeof obj === 'object' && !Array.isArray(obj));
    }

    /**
     * 深度合併工具（供雲端 Remote Config 或動態擴充角色／怪物資料時安全覆蓋與新增）
     */
    function deepMerge(target, source) {
        if (!isPlainObject(target) || !isPlainObject(source)) return target;
        Object.keys(source).forEach((key) => {
            if (key === '__proto__' || key === 'constructor' || key === 'prototype') return;
            const srcVal = source[key];
            const tgtVal = target[key];
            if (Array.isArray(srcVal)) {
                target[key] = srcVal.slice();
            } else if (isPlainObject(srcVal)) {
                if (!isPlainObject(tgtVal)) target[key] = {};
                deepMerge(target[key], srcVal);
            } else if (srcVal !== undefined) {
                target[key] = srcVal;
            }
        });
        return target;
    }

    function hashSeedString(seedStr) {
        const str = String(seedStr || 'default-seed');
        let h = 2166136261 >>> 0;
        for (let i = 0; i < str.length; i++) {
            h ^= str.charCodeAt(i);
            h = Math.imul(h, 16777619);
        }
        return h >>> 0;
    }

    function createSeededRng(seedInput) {
        let a = typeof seedInput === 'number' ? (seedInput >>> 0) : hashSeedString(seedInput);
        if (a === 0) a = 0x9e3779b9;
        return function mulberry32() {
            a = (a + 0x6d2b79f5) >>> 0;
            let t = Math.imul(a ^ (a >>> 15), 1 | a);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    function getTodayDateKey(dateObj) {
        const d = dateObj instanceof Date ? dateObj : new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }

    function resolveWeatherForWave(waveNum, mapId = 'forest', seedOffset = 0) {
        const w = Math.max(1, Math.floor(Number(waveNum) || 1));
        if (w >= 10 && w % 5 === 0) return 'eclipse';
        const cycle = ['sun', 'snow', 'storm'];
        const baseIdx = mapId === 'frost' ? 1 : ((mapId === 'lava' || mapId === 'thunder_isles') ? 2 : 0);
        const offset = ((Math.floor(Number(seedOffset) || 0) % 3) + 3) % 3;
        const block = Math.floor((w - 1) / 3);
        return cycle[(baseIdx + offset + block) % 3];
    }

    function getDailyChallengeSpec(dateKey) {
        const key = String(dateKey || getTodayDateKey());
        const rng = createSeededRng(`daily:${key}`);
        const maps = ['forest', 'lava', 'frost', 'thunder_isles', 'blackmarket'];
        const weathers = ['sun', 'snow', 'storm'];
        const mapId = maps[Math.floor(rng() * maps.length)];
        const weatherIdx = Math.floor(rng() * weathers.length);
        const weather = weathers[weatherIdx];
        const baseIdx = mapId === 'frost' ? 1 : ((mapId === 'lava' || mapId === 'thunder_isles') ? 2 : 0);
        const weatherSeedOffset = (weatherIdx - baseIdx + 3) % 3;
        const seedCode = hashSeedString(`daily:${key}`);
        return {
            dateKey: key,
            seedString: `daily:${key}`,
            seedCode,
            mapId,
            weather,
            weatherSeedOffset,
            contracts: []
        };
    }

    let activeRunRng = null;

    function setActiveRunRng(seedInput) {
        if (seedInput === null || seedInput === undefined || seedInput === '') {
            activeRunRng = null;
            return null;
        }
        activeRunRng = typeof seedInput === 'function' ? seedInput : createSeededRng(seedInput);
        return activeRunRng;
    }

    function nextRunRandom() {
        return typeof activeRunRng === 'function' ? activeRunRng() : Math.random();
    }

    GameApp.data = GameApp.data || {};
    GameApp.data.weather = GLOBAL_CONFIG.WEATHER_CATALOG;
    GameApp.config = GLOBAL_CONFIG;
    GameApp.helpers = {
        clampNumber,
        coordsToIndex,
        indexToCoords,
        isPlainObject,
        deepMerge,
        hashSeedString,
        createSeededRng,
        getTodayDateKey,
        getDailyChallengeSpec,
        resolveWeatherForWave,
        setActiveRunRng,
        nextRunRandom
    };

    // 保留舊版相容橋接物件，各模組載入時會自動將資料同步掛載至此
    global.GameConfig = {
        CONFIG: GLOBAL_CONFIG,
        clampNumber,
        coordsToIndex,
        indexToCoords,
        deepMerge
    };
})(window);
