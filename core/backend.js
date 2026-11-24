/**
 * ============================================================================
 * 【檔案名稱】：core/backend.js
 * 【負責功能】：純單向數據收集模式（GameAnalytics 試玩感官與進度追蹤封裝、
 *               1.5 秒超時與離線單機優先防護、單局黑盒子戰報生成與本機戰績持久化）。
 * 【讀取資料】：讀取 GameApp.data 資料表名稱以格式化單局黑盒子戰報，讀寫本地 localStorage 戰績紀錄。
 * 【常見修改入口】：
 *   1. 調整試玩感官追蹤與單局黑盒子戰報格式：修改 trackFeel()、finalizeRunFeel() 與 generateBattleReportText()。
 *   2. 調整 GameAnalytics 追蹤封裝：修改 GameAnalyticsTracker。
 * ============================================================================
 */
(function (global) {
    'use strict';

    const GameApp = global.GameApp = global.GameApp || {};
    const CONFIG = GameApp.config || {};

    const CLOUD_CONFIG = {
        TIMEOUT_MS: 1500,
        STORAGE_GA_UID_KEY: 'merge_defense_ga_uid',
        STORAGE_GA_SESSION_NUM_KEY: 'merge_defense_ga_session_num',
        STORAGE_META_TREE_KEY: 'merge_defense_meta_tree',
        GAME_ANALYTICS: {
            enabled: true,
            proxyEndpoint: 'https://green-cake-844e.23156ymps.workers.dev'
        }
    };

    const memoryStorageFallback = {};

    function safeCloudStorageGet(key) {
        try {
            if (typeof localStorage !== 'undefined') {
                const raw = localStorage.getItem(key);
                if (raw !== null) return raw;
            }
        } catch (_) {
            // 受限或隱私環境改用記憶體快取降級
        }
        return Object.prototype.hasOwnProperty.call(memoryStorageFallback, key)
            ? memoryStorageFallback[key]
            : null;
    }

    function safeCloudStorageSet(key, val) {
        const strVal = String(val);
        memoryStorageFallback[key] = strVal;
        try {
            if (typeof localStorage !== 'undefined') localStorage.setItem(key, strVal);
        } catch (_) {
            // 受限或隱私環境無聲降級並保留於記憶體快取
        }
    }

    function isNetworkOffline() {
        return typeof navigator !== 'undefined' && navigator.onLine === false;
    }

    async function fetchWithTimeout(url, options = {}, timeoutMs = CLOUD_CONFIG.TIMEOUT_MS) {
        if (typeof fetch !== 'function' || isNetworkOffline()) return null;
        const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
        let timer = null;
        try {
            if (controller) {
                timer = setTimeout(() => {
                    try { controller.abort(); } catch (_) {}
                }, Math.max(100, timeoutMs));
            }
            return await fetch(url, {
                ...options,
                signal: controller ? controller.signal : options.signal
            });
        } catch (_) {
            return null;
        } finally {
            if (timer) clearTimeout(timer);
        }
    }

    function generateUuidV4() {
        if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
            return crypto.randomUUID();
        }
        const bytes = new Uint8Array(16);
        if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
            crypto.getRandomValues(bytes);
        } else {
            for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
        }
        bytes[6] = (bytes[6] & 0x0f) | 0x40;
        bytes[8] = (bytes[8] & 0x3f) | 0x80;
        const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
        return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    }

    function detectGaRuntimeEnv() {
        const ua = (typeof navigator !== 'undefined' && navigator.userAgent) ? navigator.userAgent : '';
        const plat = (typeof navigator !== 'undefined' && navigator.platform) ? navigator.platform.toLowerCase() : '';
        if (/android/i.test(ua)) return { platform: 'android', osVersion: 'android 13' };
        if (/iphone|ipad|ipod/i.test(ua)) return { platform: 'ios', osVersion: 'ios 17' };
        if (plat.includes('mac') || /macintosh/i.test(ua)) return { platform: 'mac', osVersion: 'mac 14' };
        if (plat.includes('linux') && !/android/i.test(ua)) return { platform: 'linux', osVersion: 'linux 5' };
        return { platform: 'windows', osVersion: 'windows 10' };
    }

    const GameAnalyticsTracker = {
        initialized: false,
        sessionStarted: false,
        enabled: true,
        proxyEndpoint: CLOUD_CONFIG.GAME_ANALYTICS.proxyEndpoint,
        disabledOffline: false,
        initPromise: null,
        flushTimer: null,
        isFlushing: false,
        tsOffsetSec: 0,
        userId: '',
        sessionId: '',
        sessionNum: 1,
        env: { platform: 'windows', osVersion: 'windows 10' },
        queue: [],

        ensureIdentity() {
            try {
                if (this.userId && this.sessionId) return;
                let uid = safeCloudStorageGet(CLOUD_CONFIG.STORAGE_GA_UID_KEY);
                if (!uid) {
                    uid = `ga_${generateUuidV4()}`;
                    safeCloudStorageSet(CLOUD_CONFIG.STORAGE_GA_UID_KEY, uid);
                }
                const prevNum = parseInt(safeCloudStorageGet(CLOUD_CONFIG.STORAGE_GA_SESSION_NUM_KEY), 10);
                const nextNum = Number.isFinite(prevNum) && prevNum >= 1 ? prevNum + 1 : 1;
                safeCloudStorageSet(CLOUD_CONFIG.STORAGE_GA_SESSION_NUM_KEY, String(nextNum));

                this.userId = uid;
                this.sessionId = generateUuidV4();
                this.sessionNum = nextNum;
                this.env = detectGaRuntimeEnv();
            } catch (_) {}
        },

        buildBaseEvent() {
            return {
                v: 2,
                user_id: this.userId,
                session_id: this.sessionId,
                session_num: this.sessionNum,
                client_ts: Math.floor(Date.now() / 1000) + this.tsOffsetSec,
                sdk_version: 'rest api v2',
                os_version: this.env.osVersion,
                manufacturer: 'unknown',
                device: 'unknown',
                platform: this.env.platform
            };
        },

        getEndpointUrl(path) {
            const base = String(this.proxyEndpoint || '').replace(/\/+$/, '');
            return base ? `${base}${path}` : '';
        },

        async init() {
            if (this.initPromise) return this.initPromise;
            this.initPromise = (async () => {
                try {
                    const gaCfg = CLOUD_CONFIG.GAME_ANALYTICS || {};
                    this.proxyEndpoint = String(gaCfg.proxyEndpoint || '').replace(/\/+$/, '');
                    this.enabled = Boolean(gaCfg.enabled && this.proxyEndpoint);
                    this.disabledOffline = isNetworkOffline();
                    this.ensureIdentity();

                    if (!this.enabled || this.disabledOffline) {
                        this.initialized = true;
                        this.sessionStarted = false;
                        return false;
                    }

                    const initUrl = this.getEndpointUrl('/init');
                    if (!initUrl) {
                        this.initialized = true;
                        this.sessionStarted = false;
                        return false;
                    }

                    const res = await fetchWithTimeout(
                        initUrl,
                        {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                platform: this.env.platform,
                                os_version: this.env.osVersion,
                                sdk_version: 'rest api v2'
                            })
                        },
                        CLOUD_CONFIG.TIMEOUT_MS
                    );

                    if (!res || !res.ok) {
                        this.initialized = true;
                        this.sessionStarted = false;
                        return false;
                    }

                    let data = null;
                    try { data = await res.json(); } catch (_) {}

                    if (data && data.enabled === false) {
                        this.enabled = false;
                        this.initialized = true;
                        this.sessionStarted = false;
                        return false;
                    }

                    const serverTs = Number(data && data.server_ts);
                    if (Number.isFinite(serverTs) && serverTs > 0) {
                        this.tsOffsetSec = Math.round(serverTs - Math.floor(Date.now() / 1000));
                    }

                    this.initialized = true;
                    this.sessionStarted = true;

                    // 開啟 GA session 並補送 init 完成前暫存的事件
                    this.queue.unshift({
                        ...this.buildBaseEvent(),
                        category: 'user'
                    });
                    if (this.queue.length > 200) this.queue.length = 200;
                    this.flush();
                    return true;
                } catch (_) {
                    this.initialized = true;
                    this.sessionStarted = false;
                    return false;
                }
            })();
            return this.initPromise;
        },

        scheduleFlush(delayMs = 800) {
            try {
                if (this.flushTimer) return;
                this.flushTimer = setTimeout(() => {
                    this.flushTimer = null;
                    this.flush();
                }, Math.max(50, delayMs));
            } catch (_) {}
        },

        enqueue(eventObj, immediate = false) {
            try {
                if (!this.enabled || !eventObj) return;
                this.queue.push(eventObj);
                if (this.queue.length > 200) this.queue.shift();
                if (immediate) {
                    if (this.flushTimer) {
                        clearTimeout(this.flushTimer);
                        this.flushTimer = null;
                    }
                    this.flush();
                } else {
                    this.scheduleFlush(800);
                }
            } catch (_) {}
        },

        async flush() {
            if (this.isFlushing) return false;
            this.isFlushing = true;
            try {
                if (!this.enabled || !this.proxyEndpoint || isNetworkOffline()) return false;
                if (!this.sessionStarted) {
                    if (this.initPromise) {
                        await this.initPromise;
                    }
                    if (!this.sessionStarted) return false;
                }
                if (this.queue.length === 0) return true;

                const eventsUrl = this.getEndpointUrl('/events');
                if (!eventsUrl) return false;

                const batch = this.queue.slice(0, 50).map((ev) => {
                    if (!ev || typeof ev !== 'object') return ev;
                    const copy = Object.assign({}, ev);
                    if (!Number.isFinite(copy.client_ts)) {
                        copy.client_ts = Math.floor(Date.now() / 1000) + this.tsOffsetSec;
                    }
                    return copy;
                });

                const res = await fetchWithTimeout(
                    eventsUrl,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(batch)
                    },
                    CLOUD_CONFIG.TIMEOUT_MS
                );

                if (!res || !res.ok) return false;
                this.queue.splice(0, batch.length);
                if (this.queue.length > 0) this.scheduleFlush(300);
                return true;
            } catch (_) {
                return false;
            } finally {
                this.isFlushing = false;
            }
        },

        trackProgression(status, waveNum, mapId, score = null) {
            try {
                if (!this.enabled) return;
                this.ensureIdentity();
                if (!Array.isArray(runTelemetry.progressionLog)) {
                    runTelemetry.progressionLog = [];
                }
                const cleanMap = String(mapId || 'forest').replace(/[^A-Za-z0-9_.-]/g, '_');
                const wavePad = String(Math.max(1, Number(waveNum) || 1)).padStart(2, '0');
                const gaEvent = {
                    ...this.buildBaseEvent(),
                    category: 'progression',
                    event_id: `${status}:${cleanMap}:Wave_${wavePad}`,
                    attempt_num: 1
                };
                if (status !== 'Start' && Number.isFinite(score)) {
                    gaEvent.score = Math.round(score);
                }
                runTelemetry.progressionLog.push(Object.assign({ t: Date.now() }, gaEvent));
                if (runTelemetry.progressionLog.length > 100) runTelemetry.progressionLog.shift();
                this.enqueue(gaEvent, status === 'Complete' || status === 'Fail');
            } catch (_) {}
        },

        trackDesign(eventId, value = null) {
            try {
                if (!this.enabled || !eventId) return;
                this.ensureIdentity();
                if (!Array.isArray(runTelemetry.designLog)) {
                    runTelemetry.designLog = [];
                }
                const gaEvent = {
                    ...this.buildBaseEvent(),
                    category: 'design',
                    event_id: String(eventId)
                };
                if (value !== null && value !== undefined && Number.isFinite(Number(value))) {
                    gaEvent.value = Number(value);
                }
                runTelemetry.designLog.push(Object.assign({ t: Date.now() }, gaEvent));
                if (runTelemetry.designLog.length > 200) runTelemetry.designLog.shift();
                const isImmediate = String(eventId).startsWith('Feel:Rating:') || String(eventId).startsWith('MVP:');
                this.enqueue(gaEvent, isImmediate);
            } catch (_) {}
        }
    };

    // ==================== 試玩感官數據追蹤與單局黑盒子 (Single-Run Blackbox) ====================
    function createEmptyRunTelemetry(mapId = 'forest', mapName = '🌲 晨光森林') {
        return {
            mapId,
            mapName,
            startedAt: Date.now(),
            lastActionAt: Date.now(),
            currentIdleRunMs: 0,
            waveCombatTotalMs: 0,
            waveCombatIdleMs: 0,
            totalCombatMs: 0,
            totalIdleMs: 0,
            waveIdleRatios: [],
            speedTimeMs: { 1: 0, 2: 0, 3: 0 },
            dragCancel: { shop: 0, board: 0 },
            earlyStartCount: 0,
            pauseCount: 0,
            codexOpenCount: 0,
            summons: {},
            fusions: {},
            zonePlacements: { front: 0, middle: 0, back: 0, special_terrain: 0 },
            sellCount: 0,
            skillCasts: { entangle: 0, frenzy: 0, golden_harvest: 0 },
            thiefKills: 0,
            thiefEscapes: 0,
            blessingRerollsUsed: 0,
            crisisWavesCleared: [],
            blessingsPicked: [],
            leaks: [],
            bossKillProgressList: [],
            damageByType: { single: 0, aoe: 0, dot: 0 },
            waveActions: {},
            subjectiveRating: '',
            eventsLog: [],
            progressionLog: [],
            designLog: []
        };
    }

    function recordDamageByType(category = 'single', amount = 0) {
        try {
            if (!Number.isFinite(amount) || amount <= 0) return;
            if (!runTelemetry.damageByType) {
                runTelemetry.damageByType = { single: 0, aoe: 0, dot: 0 };
            }
            const key = (category === 'aoe' || category === 'dot') ? category : 'single';
            runTelemetry.damageByType[key] = (runTelemetry.damageByType[key] || 0) + amount;
        } catch (_) {}
    }

    function getDamageTypeBreakdown() {
        const d = (runTelemetry && runTelemetry.damageByType) || { single: 0, aoe: 0, dot: 0 };
        const single = Math.max(0, Number(d.single) || 0);
        const aoe = Math.max(0, Number(d.aoe) || 0);
        const dot = Math.max(0, Number(d.dot) || 0);
        const total = single + aoe + dot;
        if (total <= 0) {
            return { single: 0, aoe: 0, dot: 0, total: 0, singlePct: 0, aoePct: 0, dotPct: 0 };
        }
        const singlePct = Math.round((single / total) * 100);
        const aoePct = Math.round((aoe / total) * 100);
        const dotPct = Math.max(0, 100 - singlePct - aoePct);
        return { single, aoe, dot, total, singlePct, aoePct, dotPct };
    }

    function getTopDamageTiles(runtime, limit = 3) {
        try {
            const st = (runtime && runtime.state) || (GameApp.runtime && GameApp.runtime.state) || {};
            const board = Array.isArray(st.board) ? st.board : [];
            const { indexToCoords } = GameApp.helpers || {};
            const towersDict = (GameApp.data && GameApp.data.towers && GameApp.data.towers.TOWERS) || {};
            const list = [];
            for (let idx = 0; idx < board.length; idx++) {
                const t = board[idx];
                if (!t || !Number.isFinite(t.totalDamage) || t.totalDamage <= 0) continue;
                const coords = typeof indexToCoords === 'function'
                    ? indexToCoords(idx)
                    : { x: idx % (CONFIG.BOARD_COLS || 15), y: Math.floor(idx / (CONFIG.BOARD_COLS || 15)) };
                const cfg = towersDict[t.type] || {};
                list.push({
                    cellIndex: idx,
                    x: coords.x,
                    y: coords.y,
                    type: t.type,
                    name: cfg.name || t.type,
                    tier: Number(t.tier) || (t.isCrowned ? 5 : 1),
                    isCrowned: Boolean(t.isCrowned),
                    totalDamage: Math.round(t.totalDamage)
                });
            }
            list.sort((a, b) => b.totalDamage - a.totalDamage);
            return list.slice(0, Math.max(1, limit));
        } catch (_) {
            return [];
        }
    }

    function getHighestTierOnBoard(runtime) {
        try {
            const st = (runtime && runtime.state) || (GameApp.runtime && GameApp.runtime.state) || {};
            const board = Array.isArray(st.board) ? st.board : [];
            let maxTier = 0;
            for (let i = 0; i < board.length; i++) {
                const t = board[i];
                if (!t) continue;
                const effTier = Math.max(Number(t.tier) || 1, t.isCrowned ? 5 : 1);
                if (effTier > maxTier) maxTier = effTier;
            }
            return maxTier;
        } catch (_) {
            return 0;
        }
    }

    let runTelemetry = createEmptyRunTelemetry();

    function resetRunTelemetry(mapId = 'forest', mapName = '🌲 晨光森林') {
        runTelemetry = createEmptyRunTelemetry(mapId, mapName);
        return runTelemetry;
    }

    function recordPlayerAction() {
        try {
            runTelemetry.lastActionAt = Date.now();
            runTelemetry.currentIdleRunMs = 0;
        } catch (_) {}
    }

    function tickFeelMetrics(rawDtMs, gameSpeed = 1, isCombatWave = false) {
        try {
            if (!Number.isFinite(rawDtMs) || rawDtMs <= 0) return;
            const spd = [1, 2, 3].includes(gameSpeed) ? gameSpeed : 1;
            runTelemetry.speedTimeMs[spd] = (runTelemetry.speedTimeMs[spd] || 0) + rawDtMs;

            if (isCombatWave) {
                runTelemetry.waveCombatTotalMs += rawDtMs;
                runTelemetry.totalCombatMs += rawDtMs;
                runTelemetry.currentIdleRunMs += rawDtMs;
                const threshold = CONFIG.FEEL_IDLE_THRESHOLD_MS || 4000;
                if (runTelemetry.currentIdleRunMs >= threshold) {
                    runTelemetry.waveCombatIdleMs += rawDtMs;
                    runTelemetry.totalIdleMs += rawDtMs;
                }
            }
        } catch (_) {}
    }

    function finalizeWaveFeel(waveNum) {
        try {
            if (runTelemetry.waveCombatTotalMs > 0) {
                const ratio = Math.round((runTelemetry.waveCombatIdleMs / runTelemetry.waveCombatTotalMs) * 100);
                runTelemetry.waveIdleRatios.push({ wave: waveNum, ratio });
                trackFeel(`Feel:IdleRatio:Wave_${waveNum}`, ratio);
            }
            runTelemetry.waveCombatTotalMs = 0;
            runTelemetry.waveCombatIdleMs = 0;

            const totalSpdMs = (runTelemetry.speedTimeMs[1] || 0) + (runTelemetry.speedTimeMs[2] || 0) + (runTelemetry.speedTimeMs[3] || 0);
            if (totalSpdMs > 0) {
                const fastRatio = Math.round((((runTelemetry.speedTimeMs[2] || 0) + (runTelemetry.speedTimeMs[3] || 0)) / totalSpdMs) * 100);
                trackFeel('Feel:SpeedUsage', fastRatio);
            }
        } catch (_) {}
    }

    /**
     * 統一感官數據追蹤介面 GameApp.backend.trackFeel(...)
     * 全程包裹於 try / catch 中，確保斷網或離線環境 100% 零報錯
     */
    function trackFeel(eventKey, value = null, meta = null) {
        try {
            if (!eventKey || typeof eventKey !== 'string') return;
            runTelemetry.eventsLog.push({
                t: Date.now(),
                eventKey,
                value,
                meta
            });
            if (runTelemetry.eventsLog.length > 200) runTelemetry.eventsLog.shift();

            // 同步統計至單局黑盒子
            if (eventKey.startsWith('Progression:')) {
                const parts = eventKey.split(':');
                const status = parts[1] || 'Start';
                const waveNum = (meta && meta.wave) || 1;
                const mapId = (meta && meta.mapId) || runTelemetry.mapId || 'forest';
                GameAnalyticsTracker.trackProgression(status, waveNum, mapId, value);
                return;
            }
            if (eventKey.startsWith('Leak:')) {
                const parts = eventKey.split(':');
                const monsterName = (meta && meta.monsterName) || parts[1] || '未知怪物';
                const parsedWave = parts[2] ? parseInt(String(parts[2]).replace(/^Wave_0*/i, ''), 10) : NaN;
                const waveNum = (meta && meta.wave) || (Number.isFinite(parsedWave) ? parsedWave : 1);
                runTelemetry.leaks.push({ monsterType: parts[1], monsterName, wave: waveNum });
            } else if (eventKey.startsWith('Boss:KillProgress')) {
                if (Number.isFinite(value)) runTelemetry.bossKillProgressList.push(Math.round(value));
            } else if (eventKey === 'Feel:DragCancel:shop') {
                runTelemetry.dragCancel.shop += (Number(value) || 1);
            } else if (eventKey === 'Feel:DragCancel:board') {
                runTelemetry.dragCancel.board += (Number(value) || 1);
            } else if (eventKey === 'Feel:EarlyStart') {
                runTelemetry.earlyStartCount += 1;
            } else if (eventKey === 'Feel:Pause') {
                runTelemetry.pauseCount += 1;
            } else if (eventKey === 'Feel:CodexOpen') {
                runTelemetry.codexOpenCount += 1;
            } else if (eventKey.startsWith('Tower:Summon')) {
                const tType = (meta && meta.towerType) || eventKey.split(':')[2] || 'unknown';
                runTelemetry.summons[tType] = (runTelemetry.summons[tType] || 0) + 1;
            } else if (eventKey.startsWith('Fusion:Create')) {
                const fType = (meta && meta.resultType) || eventKey.split(':')[2] || 'unknown';
                runTelemetry.fusions[fType] = (runTelemetry.fusions[fType] || 0) + 1;
            } else if (eventKey.startsWith('Map:ZoneUsage')) {
                const zone = (meta && meta.zone) || eventKey.split(':')[2] || 'middle';
                if (runTelemetry.zonePlacements[zone] !== undefined) {
                    runTelemetry.zonePlacements[zone] += 1;
                }
            } else if (eventKey === 'Economy:SellTower') {
                runTelemetry.sellCount += 1;
            } else if (eventKey.startsWith('Tree:SkillCast')) {
                const sk = (meta && meta.skillId) || eventKey.split(':')[2] || 'entangle';
                runTelemetry.skillCasts[sk] = (runTelemetry.skillCasts[sk] || 0) + 1;
            } else if (eventKey === 'Economy:ThiefKill') {
                runTelemetry.thiefKills = (runTelemetry.thiefKills || 0) + 1;
            } else if (eventKey === 'Economy:ThiefEscape') {
                runTelemetry.thiefEscapes = (runTelemetry.thiefEscapes || 0) + 1;
            } else if (eventKey === 'Tree:BlessingReroll') {
                runTelemetry.blessingRerollsUsed = (runTelemetry.blessingRerollsUsed || 0) + 1;
            } else if (eventKey.startsWith('Wave:CrisisClear:')) {
                const wId = (meta && meta.crisisId) || eventKey.split(':')[2] || '';
                if (wId && !runTelemetry.crisisWavesCleared.includes(wId)) {
                    runTelemetry.crisisWavesCleared.push(wId);
                }
            } else if (eventKey.startsWith('Tree:BlessingPick')) {
                const bName = (meta && meta.blessingName) || eventKey.split(':')[2] || '';
                if (bName && !runTelemetry.blessingsPicked.includes(bName)) {
                    runTelemetry.blessingsPicked.push(bName);
                }
            } else if (eventKey.startsWith('Feel:Rating:')) {
                const label = eventKey.slice('Feel:Rating:'.length);
                runTelemetry.subjectiveRating = label;
            }

            if (eventKey.startsWith('Tower:Summon')
                || eventKey.startsWith('Fusion:Create')
                || eventKey.startsWith('Tree:SkillCast')
                || eventKey === 'Feel:EarlyStart') {
                if (!runTelemetry.waveActions || typeof runTelemetry.waveActions !== 'object') {
                    runTelemetry.waveActions = {};
                }
                const liveWave = GameApp.runtime && GameApp.runtime.state && GameApp.runtime.state.currentWave;
                const waveIdx = Math.max(1, Number((meta && (meta.actionWave || meta.wave)) || liveWave || 1) || 1);
                runTelemetry.waveActions[waveIdx] = (runTelemetry.waveActions[waveIdx] || 0) + 1;
            }

            GameAnalyticsTracker.trackDesign(eventKey, value);
        } catch (_) {
            // 離線或阻擋器環境無聲保護
        }
    }

    function getAverageIdleRatio() {
        if (runTelemetry.totalCombatMs > 0) {
            return Math.round((runTelemetry.totalIdleMs / runTelemetry.totalCombatMs) * 100);
        }
        if (runTelemetry.waveIdleRatios.length > 0) {
            const sum = runTelemetry.waveIdleRatios.reduce((acc, item) => acc + item.ratio, 0);
            return Math.round(sum / runTelemetry.waveIdleRatios.length);
        }
        return 0;
    }

    function getFastSpeedRatio() {
        const s1 = runTelemetry.speedTimeMs[1] || 0;
        const s2 = runTelemetry.speedTimeMs[2] || 0;
        const s3 = runTelemetry.speedTimeMs[3] || 0;
        const total = s1 + s2 + s3;
        return total > 0 ? Math.round(((s2 + s3) / total) * 100) : 0;
    }

    function finalizeRunFeel(outcomeMode = 'victory', meta = null) {
        try {
            const rt = GameApp.runtime || {};
            const st = rt.state || {};
            const idleRatio = getAverageIdleRatio();
            const fastSpeedRatio = getFastSpeedRatio();
            const dragCancelShop = runTelemetry.dragCancel.shop || 0;
            const dragCancelBoard = runTelemetry.dragCancel.board || 0;
            const dragCancelTotal = dragCancelShop + dragCancelBoard;
            const earlyStarts = runTelemetry.earlyStartCount || 0;
            const codexOpens = runTelemetry.codexOpenCount || 0;
            const pauses = runTelemetry.pauseCount || 0;
            const baseMeta = Object.assign({ outcomeMode }, meta && typeof meta === 'object' ? meta : {});

            trackFeel('Feel:Run:IdleRatio', idleRatio, baseMeta);
            trackFeel('Feel:Run:SpeedUsage', fastSpeedRatio, baseMeta);
            trackFeel('Feel:Run:DragCancel', dragCancelTotal, Object.assign({ shop: dragCancelShop, board: dragCancelBoard }, baseMeta));
            trackFeel('Feel:Run:EarlyStart', earlyStarts, baseMeta);
            trackFeel('Feel:Run:CodexOpen', codexOpens, baseMeta);
            trackFeel('Feel:Run:Pause', pauses, baseMeta);

            // 1. 輸出流派佔比 (Build:DamageType)
            const dmgMix = getDamageTypeBreakdown();
            trackFeel('Build:DamageType:Single', dmgMix.singlePct, Object.assign({ damage: Math.round(dmgMix.single) }, baseMeta));
            trackFeel('Build:DamageType:AoE', dmgMix.aoePct, Object.assign({ damage: Math.round(dmgMix.aoe) }, baseMeta));
            trackFeel('Build:DamageType:DoT', dmgMix.dotPct, Object.assign({ damage: Math.round(dmgMix.dot) }, baseMeta));

            // 2. 黃金格座標熱區 (Map:TopTiles)
            const mapId = String((meta && meta.mapId) || st.currentMapId || runTelemetry.mapId || 'forest').replace(/[^A-Za-z0-9_.-]/g, '_');
            const topTiles = getTopDamageTiles(rt, 3);
            topTiles.forEach((tile, idx) => {
                trackFeel(`Map:TopTiles:${mapId}:Rank${idx + 1}:x${tile.x}_y${tile.y}`, tile.totalDamage, Object.assign({
                    rank: idx + 1,
                    x: tile.x,
                    y: tile.y,
                    towerType: tile.type
                }, baseMeta));
            });

            // 3. 分波操作活躍度 (Wave:Actions)
            const reachedWave = Math.max(1, Number((meta && meta.wave) || st.currentWave || 1) || 1);
            const waveActs = runTelemetry.waveActions || {};
            for (let w = 1; w <= reachedWave; w++) {
                const wavePad = String(w).padStart(2, '0');
                const cnt = Number(waveActs[w]) || 0;
                trackFeel(`Wave:Actions:Wave_${wavePad}`, cnt, Object.assign({ wave: w }, baseMeta));
            }

            // 4. 全場總經濟與最高合成階級 + 第 4 階段機制統計
            const totalGoldEarned = Math.round(Number(st.totalGoldEarned) || 0);
            const maxTier = getHighestTierOnBoard(rt);
            const metaState = loadMetaTreeState();
            trackFeel('Run:EconomySummary:TotalGold', totalGoldEarned, baseMeta);
            trackFeel('Run:EconomySummary:MaxTier', maxTier, baseMeta);
            trackFeel('Meta:TreeUnlockedCount', metaState.unlockedNodes.length, baseMeta);
            trackFeel('Economy:ThiefKillsSummary', runTelemetry.thiefKills || 0, baseMeta);

            GameAnalyticsTracker.flush();
        } catch (_) {}
    }

    function generateBattleReportText(runtime, outcomeMode = 'victory') {
        try {
            const isEn = Boolean(GameApp.i18n && GameApp.i18n.isEnglish());
            const st = (runtime && runtime.state) || {};
            const routesData = (GameApp.data && GameApp.data.routes && GameApp.data.routes.MAPS_CONFIG) || {};
            const WaveSys = GameApp.systems && GameApp.systems.wave;
            const fallbackMapNames = {
                forest: isEn ? 'Sunlit Woods' : '晨光森林',
                lava: isEn ? 'Magma Canyon' : '熔岩峽谷',
                frost: isEn ? 'Permafrost Rift' : '永凍裂谷',
                thunder_isles: isEn ? 'Thunder Float Isles' : '雷鳴浮島',
                blackmarket: isEn ? 'Barren Black Market' : '荒蕪黑市'
            };
            const mapSpec = routesData[st.currentMapId] || {
                name: fallbackMapNames[st.currentMapId] || fallbackMapNames.forest,
                victoryWave: st.currentMapId === 'thunder_isles' ? 12 : (st.currentMapId === 'blackmarket' ? 15 : 10)
            };
            const victoryWave = (WaveSys && typeof WaveSys.getMapVictoryWave === 'function')
                ? WaveSys.getMapVictoryWave(mapSpec)
                : (Number(mapSpec.victoryWave) || CONFIG.VICTORY_WAVE || 10);
            const modeTag = st.gameMode === 'daily'
                ? (isEn ? `[Daily Seed ${st.dailyDateKey || ''}${st.weatherType ? ` · ${st.weatherType}` : ''}] ` : `【每日種子 ${st.dailyDateKey || ''}${st.weatherType ? ` · ${st.weatherType}` : ''}】`)
                : (st.gameMode === 'puzzle'
                    ? (isEn ? `[Endgame Trial: ${st.puzzleId || ''}] ` : `【殘局試煉：${st.puzzleId || ''}】`)
                    : (st.isEndlessMode ? (isEn ? '[Endless] ' : '【無盡試煉】') : ''));
            const waveStr = isEn
                ? (outcomeMode === 'victory'
                    ? `${modeTag}Victory (Wave ${st.currentWave || victoryWave}/${st.gameMode === 'puzzle' ? (st.currentWave || 1) : victoryWave} · Remaining ❤️ ${st.baseHp || 0})`
                    : `${modeTag}Defeat (Fallen at Wave ${st.currentWave || 1}${st.isEndlessMode ? ' Endless' : `/${st.gameMode === 'puzzle' ? (st.currentWave || 1) : victoryWave}`})`)
                : (outcomeMode === 'victory'
                    ? `${modeTag}通關成功 (第 ${st.currentWave || victoryWave}/${st.gameMode === 'puzzle' ? (st.currentWave || 1) : victoryWave} 波 · 剩餘 ❤️ ${st.baseHp || 0})`
                    : `${modeTag}防線失守 (陣亡於第 ${st.currentWave || 1} 波${st.isEndlessMode ? ' 無盡模式' : ` / ${st.gameMode === 'puzzle' ? (st.currentWave || 1) : victoryWave} 波`})`);

            // 漏怪明細
            const monsterDb = (GameApp.data && GameApp.data.monsters && GameApp.data.monsters.MONSTER_DATABASE) || {};
            let leakStr = isEn ? '0 Leaks (Perfect Defense)' : '0 漏怪（完美防線）';
            if (runTelemetry.leaks.length > 0) {
                const leakCounts = {};
                runTelemetry.leaks.forEach((lk) => {
                    const mName = (lk.monsterType && monsterDb[lk.monsterType] && monsterDb[lk.monsterType].name) || lk.monsterName;
                    const key = `W${lk.wave}:${mName}`;
                    leakCounts[key] = (leakCounts[key] || 0) + 1;
                });
                leakStr = Object.entries(leakCounts).map(([k, v]) => `${k}×${v}`).join(isEn ? ', ' : '、');
            } else if (st.lastBreakerName) {
                leakStr = `W${st.currentWave || 1}:${st.lastBreakerName}`;
            }

            // MVP 輸出與佔比
            const mvpText = (GameApp.game && typeof GameApp.game.getMvpSummaryText === 'function')
                ? GameApp.game.getMvpSummaryText()
                : (isEn ? 'No damage dealt yet' : '尚無輸出紀錄');

            // 召喚與融合摘要
            const towersDict = (GameApp.data && GameApp.data.towers && GameApp.data.towers.TOWERS) || {};
            const summonParts = Object.entries(runTelemetry.summons).map(([k, cnt]) => {
                const tName = (towersDict[k] && towersDict[k].name) || k;
                return `${tName}×${cnt}`;
            });
            const summonStr = summonParts.length > 0 ? summonParts.join(' / ') : (isEn ? 'None' : '無');

            // 佈陣熱區
            const zp = runTelemetry.zonePlacements;
            const totalPlaced = (zp.front || 0) + (zp.middle || 0) + (zp.back || 0);
            const pct = (n) => (totalPlaced > 0 ? `${Math.round((n / totalPlaced) * 100)}%` : '0%');
            const zoneStr = isEn
                ? `Front ${pct(zp.front)} | Mid ${pct(zp.middle)} | Back ${pct(zp.back)} (Special Tiles: ${zp.special_terrain || 0})`
                : `前段 ${pct(zp.front)}｜中段 ${pct(zp.middle)}｜後段 ${pct(zp.back)}（特殊地形格 ${zp.special_terrain || 0} 次）`;

            const idlePct = getAverageIdleRatio();
            const fastSpdPct = getFastSpeedRatio();
            const ratingStr = runTelemetry.subjectiveRating || (isEn ? 'Not rated' : '尚未點選快評');
            const blessingStr = runTelemetry.blessingsPicked.length > 0
                ? runTelemetry.blessingsPicked.join(isEn ? ', ' : '、')
                : (isEn ? 'None' : '無');

            // 新增 4 項下一版設計決策情報摘要
            const dmgMix = getDamageTypeBreakdown();
            const dmgMixStr = isEn
                ? `Single ${dmgMix.singlePct}% | Chain/Splash AoE ${dmgMix.aoePct}% | Burn/Status ${dmgMix.dotPct}%`
                : `單體直傷 ${dmgMix.singlePct}%｜連鎖/濺射群傷 ${dmgMix.aoePct}%｜持續灼燒/狀態 ${dmgMix.dotPct}%`;

            const topTiles = getTopDamageTiles(runtime, 3);
            const topTilesStr = topTiles.length > 0
                ? topTiles.map((t, i) => `#${i + 1} (${t.x},${t.y}) ${t.name} ${t.totalDamage.toLocaleString()}`).join(isEn ? ' | ' : '｜')
                : (isEn ? 'No tower damage recorded' : '尚無防禦塔輸出紀錄');

            const reachedWave = Math.max(1, Number(st.currentWave) || 1);
            const waveActs = runTelemetry.waveActions || {};
            const waveActParts = [];
            for (let w = 1; w <= reachedWave; w++) {
                waveActParts.push(`W${w}:${Number(waveActs[w]) || 0}`);
            }
            const waveActionsStr = waveActParts.join(isEn ? ' | ' : '｜');

            const maxTier = getHighestTierOnBoard(runtime);
            const tierLabelZh = maxTier >= 5 ? '5★ 世界樹神裔' : (maxTier === 4 ? '4★ 古冠／雙生' : (maxTier === 3 ? '3★ 冠枝' : (maxTier === 2 ? '2★ 主幹' : (maxTier === 1 ? '1★ 根芽' : '無'))));
            const tierLabelEn = maxTier >= 5 ? '5★ World Scion' : (maxTier === 4 ? '4★ Crown / Twin' : (maxTier === 3 ? '3★ Crown' : (maxTier === 2 ? '2★ Trunk' : (maxTier === 1 ? '1★ Bud' : 'None'))));

            const lines = isEn ? [
                '[Elemental Frontline: Merge TD — Battle Telemetry Report]',
                `🗺️ Battlefield: ${mapSpec.name}`,
                `🏁 Outcome: ${waveStr}`,
                `🚨 Leaks: ${leakStr}`,
                `🏆 MVP Tower: ${mvpText}`,
                `⚔️ Damage Mix: ${dmgMixStr}`,
                `📌 Top 3 Tiles (x,y): ${topTilesStr}`,
                `🎮 Wave Actions: ${waveActionsStr}`,
                `🏛️ Economy & Peak: Total Earned ${(st.totalGoldEarned || 0).toLocaleString()} 💰 | Highest Tier on Board ${tierLabelEn}`,
                `⏱️ Pace: Avg Idle ${idlePct}% | 2x/3x Usage ${fastSpdPct}% | Early Starts ${runTelemetry.earlyStartCount}`,
                `🖐️ Drag Cancels: Shop ${runTelemetry.dragCancel.shop} | Board Move ${runTelemetry.dragCancel.board}`,
                `🔥 Summons: ${summonStr} (Merges ${st.fusionCount || 0} | Sells ${runTelemetry.sellCount})`,
                `📍 Placement Zones: ${zoneStr}`,
                `🌳 World Tree: Entangle ${runTelemetry.skillCasts.entangle || 0}, Frenzy ${runTelemetry.skillCasts.frenzy || 0}, Harvest ${runTelemetry.skillCasts.golden_harvest || 0} | Thief Kills ${runTelemetry.thiefKills || 0} | Blessings: ${blessingStr}`,
                `💰 Economy: End Gold ${st.currentGold || 0} 💰 (Total Earned ${(st.totalGoldEarned || 0).toLocaleString()} 💰 · Kills ${st.killsCount || 0})`,
                `💬 Quick Rating: ${ratingStr}`
            ] : [
                '【元素陣線：合成塔防 — 單局試玩黑盒子戰報】',
                `🗺️ 戰場地圖：${mapSpec.name}`,
                `🏁 戰局結果：${waveStr}`,
                `🚨 漏怪明細：${leakStr}`,
                `🏆 本局 MVP：${mvpText}`,
                `⚔️ 輸出流派：${dmgMixStr}`,
                `📌 黃金格 Top3 (x,y)：${topTilesStr}`,
                `🎮 分波操作數：${waveActionsStr}`,
                `🏛️ 經濟與成型：累計獲得 ${(st.totalGoldEarned || 0).toLocaleString()} 💰 ｜ 場上最高階級 ${tierLabelZh}`,
                `⏱️ 體感節奏：平均發呆率 ${idlePct}% ｜ 2x/3x 倍速佔比 ${fastSpdPct}% ｜ 提前開波 ${runTelemetry.earlyStartCount} 次`,
                `🖐️ 拖拉取消：商店召喚取消 ${runTelemetry.dragCancel.shop} 次 ／ 棋盤移塔取消 ${runTelemetry.dragCancel.board} 次`,
                `🔥 召喚統計：${summonStr}（合成融合 ${st.fusionCount || 0} 次 ／ 賣塔 ${runTelemetry.sellCount} 次）`,
                `📍 佈陣熱區：${zoneStr}`,
                `🌳 世界樹互動：纏繞 ${runTelemetry.skillCasts.entangle || 0} 次、狂熱 ${runTelemetry.skillCasts.frenzy || 0} 次、豐收 ${runTelemetry.skillCasts.golden_harvest || 0} 次 ｜ 竊賊擊殺 ${runTelemetry.thiefKills || 0} 隻 ｜ 祝福：${blessingStr}`,
                `💰 經濟結算：結餘 ${st.currentGold || 0} 💰（累計獲得 ${(st.totalGoldEarned || 0).toLocaleString()} 💰 · 總擊殺 ${st.killsCount || 0} 隻）`,
                `💬 主觀快評：${ratingStr}`
            ];
            return lines.join('\n');
        } catch (_) {
            return (GameApp.i18n && GameApp.i18n.isEnglish())
                ? '[Elemental Frontline] Battle Report ready.'
                : '【元素陣線：單局數據戰報】資料整理完成';
        }
    }

    function generateDailyShareCardText(runtime, outcomeMode = 'victory') {
        try {
            const isEn = Boolean(GameApp.i18n && GameApp.i18n.isEnglish());
            const st = (runtime && runtime.state) || (GameApp.runtime && GameApp.runtime.state) || {};
            const routesData = (GameApp.data && GameApp.data.routes && GameApp.data.routes.MAPS_CONFIG) || {};
            const WaveSys = GameApp.systems && GameApp.systems.wave;
            const mapSpec = routesData[st.currentMapId] || {};
            const victoryWave = (WaveSys && typeof WaveSys.getMapVictoryWave === 'function')
                ? WaveSys.getMapVictoryWave(mapSpec)
                : (Number(mapSpec.victoryWave) || CONFIG.VICTORY_WAVE || 10);
            const fallbackNames = {
                forest: isEn ? 'Sunlit Woods' : '晨光森林',
                lava: isEn ? 'Magma Canyon' : '熔岩峽谷',
                frost: isEn ? 'Permafrost Rift' : '永凍裂谷',
                thunder_isles: isEn ? 'Thunder Float Isles' : '雷鳴浮島',
                blackmarket: isEn ? 'Barren Black Market' : '荒蕪黑市'
            };
            const mapName = mapSpec.name || fallbackNames[st.currentMapId] || st.currentMapId || 'forest';
            const dateKey = st.dailyDateKey || (GameApp.helpers && typeof GameApp.helpers.getTodayDateKey === 'function' ? GameApp.helpers.getTodayDateKey() : '2026-01-01');
            const seedHex = Number(st.dailySeedCode || 0).toString(16).toUpperCase().padStart(8, '0');
            const wCat = (GameApp.data && GameApp.data.weather) || (CONFIG && CONFIG.WEATHER_CATALOG) || {};
            const wSpec = wCat[st.weatherType] || { icon: '☀️', nameZh: '熾陽季', nameEn: 'Sunlit Blaze' };
            const weatherStr = `${wSpec.icon || '☀️'} ${isEn ? (wSpec.nameEn || st.weatherType) : (wSpec.nameZh || st.weatherType)}`;
            const maxHp = Math.max(1, Number(st.maxBaseHp) || 20);
            const curHp = Math.max(0, Number(st.baseHp) || 0);
            const isWin = outcomeMode === 'victory';
            let starsNum = 0;
            if (isWin) {
                starsNum = curHp >= maxHp ? 3 : (curHp >= Math.ceil(maxHp * 0.5) ? 2 : 1);
            }
            const starsBadge = starsNum > 0 ? ' ' + '★'.repeat(starsNum) : '';
            const count = (st.activeContracts && st.activeContracts.size) || 0;
            const mult = 1 + count * (CONFIG.CONTRACT_SCORE_BONUS_PER_ITEM || 0.15);
            const baseScore = Math.max(0, (st.currentWave || 1) * 120 + (st.killsCount || 0) * 8 + curHp * 35);
            const honorScore = Math.round(baseScore * mult);
            const mvpText = (GameApp.game && typeof GameApp.game.getMvpSummaryText === 'function')
                ? GameApp.game.getMvpSummaryText()
                : (isEn ? 'None' : '無');

            if (isEn) {
                return [
                    `[Elemental Frontline · Daily Seed ${dateKey}]`,
                    `Seed #${seedHex} | ${mapName} | ${weatherStr}`,
                    `${isWin ? `Victory${starsBadge}` : 'Defeated'} · Wave ${st.currentWave || 1}/${victoryWave} · ❤️ ${curHp}/${maxHp} · Honor ${honorScore.toLocaleString()} ★`,
                    `Kills ${st.killsCount || 0} | MVP: ${mvpText}`
                ].join('\n');
            }
            return [
                `【元素陣線 · 每日種子 ${dateKey}】`,
                `種子 #${seedHex}｜${mapName}｜${weatherStr}`,
                `${isWin ? `防守成功${starsBadge}` : '防線失守'} · 第 ${st.currentWave || 1}/${victoryWave} 波 · ❤️ ${curHp}/${maxHp} · 榮譽 ${honorScore.toLocaleString()} ★`,
                `擊殺 ${st.killsCount || 0} 隻｜MVP：${mvpText}`
            ].join('\n');
        } catch (_) {
            return (GameApp.i18n && GameApp.i18n.isEnglish())
                ? '[Elemental Frontline · Daily Seed Scorecard]'
                : '【元素陣線 · 每日種子戰績卡】';
        }
    }

    async function copyDailyShareCardToClipboard(runtime, outcomeMode = 'victory') {
        const text = generateDailyShareCardText(runtime, outcomeMode);
        GameApp.lastCopiedDailyCard = text;
        try {
            if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
                await navigator.clipboard.writeText(text);
                return { ok: true, text };
            }
        } catch (_) {}
        try {
            if (typeof document !== 'undefined') {
                const ta = document.createElement('textarea');
                ta.value = text;
                ta.setAttribute('readonly', 'true');
                ta.style.position = 'fixed';
                ta.style.left = '-9999px';
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                ta.remove();
                return { ok: true, text };
            }
        } catch (_) {}
        return { ok: false, text };
    }

    async function copyBattleReportToClipboard(runtime, outcomeMode = 'victory') {
        const text = generateBattleReportText(runtime, outcomeMode);
        GameApp.lastCopiedReport = text;
        try {
            if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
                await navigator.clipboard.writeText(text);
                return { ok: true, text };
            }
        } catch (_) {
            // 降級至傳統複製方式
        }
        try {
            if (typeof document !== 'undefined') {
                const ta = document.createElement('textarea');
                ta.value = text;
                ta.setAttribute('readonly', 'true');
                ta.style.position = 'fixed';
                ta.style.left = '-9999px';
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                ta.remove();
                return { ok: true, text };
            }
        } catch (_) {}
        return { ok: false, text };
    }

    // ==================== 本地持久化紀錄（Best Wave & Map Stars） ====================
    function loadMapRecords() {
        let legacyBest = 1;
        const savedLegacy = parseInt(safeCloudStorageGet(CONFIG.STORAGE_BEST_WAVE_KEY || 'merge_defense_best_wave'), 10);
        if (Number.isFinite(savedLegacy) && savedLegacy >= 1) legacyBest = savedLegacy;

        const defaults = {
            forest: { bestWave: legacyBest, bestStars: 0 },
            lava: { bestWave: 1, bestStars: 0 },
            frost: { bestWave: 1, bestStars: 0 },
            thunder_isles: { bestWave: 1, bestStars: 0 },
            blackmarket: { bestWave: 1, bestStars: 0 }
        };
        try {
            const raw = safeCloudStorageGet(CONFIG.STORAGE_MAP_RECORDS_KEY || 'merge_defense_map_records');
            if (!raw) return defaults;
            const parsed = JSON.parse(raw);
            if (!parsed || typeof parsed !== 'object') return defaults;
            Object.keys(parsed).forEach(id => {
                const rec = parsed[id];
                if (!rec || typeof rec !== 'object') return;
                if (!defaults[id]) defaults[id] = { bestWave: 1, bestStars: 0 };
                const w = parseInt(rec.bestWave, 10);
                const s = parseInt(rec.bestStars, 10);
                if (Number.isFinite(w) && w >= 1) defaults[id].bestWave = id === 'forest' ? Math.max(w, legacyBest) : w;
                if (Number.isFinite(s) && s >= 0) defaults[id].bestStars = Math.min(3, s);
            });
            return defaults;
        } catch (_) {
            return defaults;
        }
    }

    function wasMapCleared(mapId) {
        if (!mapId) return false;
        const records = loadMapRecords();
        return Boolean(records[mapId] && (Number(records[mapId].bestStars) || 0) > 0);
    }

    function isEndlessUnlocked() {
        const career = loadCareerStats();
        if ((Number(career.totalClears) || 0) >= 1) return true;
        const records = loadMapRecords();
        return Object.keys(records).some(id => records[id] && (Number(records[id].bestStars) || 0) > 0);
    }

    function loadDailyRecords() {
        try {
            const raw = safeCloudStorageGet(CONFIG.STORAGE_DAILY_RECORDS_KEY || 'merge_defense_daily_records');
            if (!raw) return {};
            const parsed = JSON.parse(raw);
            return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
        } catch (_) {
            return {};
        }
    }

    function saveDailyRecord(dateKey, payload = {}) {
        if (!dateKey) return loadDailyRecords();
        const records = loadDailyRecords();
        const prev = records[dateKey] || {
            bestWave: 0,
            bestStars: 0,
            cleared: false,
            honorScore: 0,
            mapId: payload.mapId || 'forest',
            weather: payload.weather || 'sun'
        };
        const wave = Math.max(0, Math.floor(Number(payload.wave) || 0));
        const stars = Math.max(0, Math.min(3, Math.floor(Number(payload.stars) || 0)));
        const honor = Math.max(0, Math.round(Number(payload.honorScore) || 0));
        records[dateKey] = {
            bestWave: Math.max(prev.bestWave || 0, wave),
            bestStars: Math.max(prev.bestStars || 0, stars),
            cleared: Boolean(prev.cleared || payload.cleared),
            honorScore: Math.max(prev.honorScore || 0, honor),
            mapId: payload.mapId || prev.mapId || 'forest',
            weather: payload.weather || prev.weather || 'sun',
            updatedAt: Date.now()
        };
        safeCloudStorageSet(CONFIG.STORAGE_DAILY_RECORDS_KEY || 'merge_defense_daily_records', JSON.stringify(records));
        return records;
    }

    function loadPuzzleRecords() {
        try {
            const raw = safeCloudStorageGet(CONFIG.STORAGE_PUZZLE_RECORDS_KEY || 'merge_defense_puzzle_records');
            if (!raw) return {};
            const parsed = JSON.parse(raw);
            return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
        } catch (_) {
            return {};
        }
    }

    function savePuzzleClear(puzzleId, remainingGold = 0) {
        if (!puzzleId) return loadPuzzleRecords();
        const records = loadPuzzleRecords();
        const prev = records[puzzleId] || { cleared: false, clearCount: 0, bestRemainingGold: 0 };
        records[puzzleId] = {
            cleared: true,
            clearCount: (Number(prev.clearCount) || 0) + 1,
            bestRemainingGold: Math.max(Number(prev.bestRemainingGold) || 0, Math.max(0, Math.floor(Number(remainingGold) || 0))),
            updatedAt: Date.now()
        };
        safeCloudStorageSet(CONFIG.STORAGE_PUZZLE_RECORDS_KEY || 'merge_defense_puzzle_records', JSON.stringify(records));
        return records;
    }

    function loadCareerStats() {
        const records = loadMapRecords();
        const maxFromMaps = Math.max(
            1,
            ...Object.keys(records).map(id => (records[id] && records[id].bestWave) || 1)
        );
        const career = {
            bestWaveOverall: maxFromMaps,
            totalClears: 0,
            bestHonorScore: 0,
            totalHonorEarned: 0,
            bestContractCount: 0,
            endlessBestWave: 0,
            mapRecords: records
        };
        try {
            const raw = safeCloudStorageGet(CONFIG.STORAGE_CAREER_STATS_KEY || 'merge_defense_career_stats');
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed && typeof parsed === 'object') {
                    if (Number.isFinite(Number(parsed.bestWaveOverall))) {
                        career.bestWaveOverall = Math.max(maxFromMaps, Math.floor(Number(parsed.bestWaveOverall)));
                    }
                    if (Number.isFinite(Number(parsed.totalClears))) {
                        career.totalClears = Math.max(0, Math.floor(Number(parsed.totalClears)));
                    }
                    if (Number.isFinite(Number(parsed.bestHonorScore))) {
                        career.bestHonorScore = Math.max(0, Math.floor(Number(parsed.bestHonorScore)));
                    }
                    if (Number.isFinite(Number(parsed.totalHonorEarned))) {
                        career.totalHonorEarned = Math.max(0, Math.floor(Number(parsed.totalHonorEarned)));
                    } else {
                        career.totalHonorEarned = career.bestHonorScore;
                    }
                    if (Number.isFinite(Number(parsed.bestContractCount))) {
                        career.bestContractCount = Math.max(0, Math.floor(Number(parsed.bestContractCount)));
                    }
                    if (Number.isFinite(Number(parsed.endlessBestWave))) {
                        career.endlessBestWave = Math.max(0, Math.floor(Number(parsed.endlessBestWave)));
                    }
                }
            }
        } catch (_) {}
        const clearedMapCount = Object.keys(records).filter(id => records[id] && (records[id].bestStars || 0) > 0).length;
        career.totalClears = Math.max(career.totalClears, clearedMapCount);
        return career;
    }

    // ==================== 局外「世界樹年輪（Meta Tree）」持久化與安全合併 ====================
    function loadMetaTreeState() {
        const career = loadCareerStats();
        const fallbackHonor = Math.max(0, Number(career.totalHonorEarned) || Number(career.bestHonorScore) || 0);
        const defaults = {
            version: 1,
            honorPoints: fallbackHonor,
            totalHonorEarned: fallbackHonor,
            unlockedNodes: []
        };
        try {
            const raw = safeCloudStorageGet(CLOUD_CONFIG.STORAGE_META_TREE_KEY || 'merge_defense_meta_tree');
            if (!raw) return defaults;
            const parsed = JSON.parse(raw);
            if (!parsed || typeof parsed !== 'object') return defaults;
            const unlocked = Array.isArray(parsed.unlockedNodes)
                ? Array.from(new Set(parsed.unlockedNodes.filter(id => typeof id === 'string' && id.length > 0)))
                : [];
            return {
                version: 1,
                honorPoints: Math.max(0, Math.floor(Number(parsed.honorPoints) || 0)),
                totalHonorEarned: Math.max(fallbackHonor, Math.floor(Number(parsed.totalHonorEarned) || 0)),
                unlockedNodes: unlocked
            };
        } catch (_) {
            return defaults;
        }
    }

    function saveMetaTreeState(nextState) {
        const prev = loadMetaTreeState();
        const merged = {
            version: 1,
            honorPoints: Math.max(0, Math.floor(Number(nextState && nextState.honorPoints !== undefined ? nextState.honorPoints : prev.honorPoints) || 0)),
            totalHonorEarned: Math.max(0, Math.floor(Number(nextState && nextState.totalHonorEarned !== undefined ? nextState.totalHonorEarned : prev.totalHonorEarned) || 0)),
            unlockedNodes: Array.isArray(nextState && nextState.unlockedNodes)
                ? Array.from(new Set(nextState.unlockedNodes.filter(id => typeof id === 'string' && id.length > 0)))
                : prev.unlockedNodes
        };
        safeCloudStorageSet(CLOUD_CONFIG.STORAGE_META_TREE_KEY || 'merge_defense_meta_tree', JSON.stringify(merged));
        return merged;
    }

    function grantMetaHonorPoints(delta) {
        const add = Math.max(0, Math.round(Number(delta) || 0));
        const cur = loadMetaTreeState();
        if (add <= 0) return cur;
        return saveMetaTreeState({
            honorPoints: cur.honorPoints + add,
            totalHonorEarned: cur.totalHonorEarned + add,
            unlockedNodes: cur.unlockedNodes
        });
    }

    function getMetaTreeNodesCatalog() {
        return (GameApp.data && GameApp.data.tree && GameApp.data.tree.META_TREE_NODES) || {};
    }

    function purchaseMetaNode(nodeId) {
        const nodes = getMetaTreeNodesCatalog();
        const spec = nodes[nodeId];
        if (!spec) return { ok: false, reason: 'invalid_node' };
        const state = loadMetaTreeState();
        if (state.unlockedNodes.includes(nodeId)) {
            return { ok: false, reason: 'already_unlocked', state };
        }
        if (spec.requires && !state.unlockedNodes.includes(spec.requires)) {
            return { ok: false, reason: 'prerequisite_locked', requires: spec.requires, state };
        }
        const cost = Math.max(0, Math.round(Number(spec.cost) || 0));
        if (state.honorPoints < cost) {
            return { ok: false, reason: 'insufficient_honor', cost, honorPoints: state.honorPoints, state };
        }
        const nextUnlocked = state.unlockedNodes.concat([nodeId]);
        const nextState = saveMetaTreeState({
            honorPoints: state.honorPoints - cost,
            totalHonorEarned: state.totalHonorEarned,
            unlockedNodes: nextUnlocked
        });
        return { ok: true, node: spec, cost, state: nextState };
    }

    function resetMetaTreeNodes() {
        const state = loadMetaTreeState();
        const nodes = getMetaTreeNodesCatalog();
        let refund = 0;
        state.unlockedNodes.forEach((id) => {
            if (nodes[id] && Number.isFinite(nodes[id].cost)) {
                refund += Math.max(0, Math.round(nodes[id].cost));
            }
        });
        const nextState = saveMetaTreeState({
            honorPoints: state.honorPoints + refund,
            totalHonorEarned: Math.max(state.totalHonorEarned, state.honorPoints + refund),
            unlockedNodes: []
        });
        return { ok: true, refund, state: nextState };
    }

    function getUnlockableMetaNodes() {
        const state = loadMetaTreeState();
        const catalog = getMetaTreeNodesCatalog();
        const unlockedSet = new Set(state.unlockedNodes || []);
        const honorPoints = Math.max(0, Number(state.honorPoints) || 0);
        const allIds = Object.keys(catalog);
        const unlockableNodes = [];
        allIds.forEach((id) => {
            const spec = catalog[id];
            if (!spec || unlockedSet.has(id)) return;
            if (spec.requires && !unlockedSet.has(spec.requires)) return;
            const cost = Math.max(0, Math.round(Number(spec.cost) || 0));
            if (honorPoints >= cost) {
                unlockableNodes.push(spec);
            }
        });
        unlockableNodes.sort((a, b) => (a.cost - b.cost) || ((a.tier || 0) - (b.tier || 0)));
        return {
            honorPoints,
            unlockedCount: unlockedSet.size,
            totalNodes: allIds.length,
            unlockableNodes
        };
    }

    function saveMapRecord(mapId, wave, stars = null, options = {}) {
        const records = loadMapRecords();
        const target = records[mapId] || { bestWave: 1, bestStars: 0 };
        const wasClearedBefore = (Number(target.bestStars) || 0) > 0;
        if (Number.isFinite(wave) && wave > target.bestWave) target.bestWave = wave;
        if (Number.isFinite(stars) && stars > target.bestStars) target.bestStars = Math.min(3, Math.max(0, stars));
        records[mapId] = target;

        safeCloudStorageSet(CONFIG.STORAGE_MAP_RECORDS_KEY || 'merge_defense_map_records', JSON.stringify(records));
        const maxOverall = Math.max(
            1,
            ...Object.keys(records).map(id => (records[id] && records[id].bestWave) || 1)
        );
        safeCloudStorageSet(CONFIG.STORAGE_BEST_WAVE_KEY || 'merge_defense_best_wave', String(maxOverall));

        const career = loadCareerStats();
        career.bestWaveOverall = Math.max(career.bestWaveOverall || 1, maxOverall);
        if (options && (options.isEndless || options.gameMode === 'endless') && Number.isFinite(wave)) {
            career.endlessBestWave = Math.max(career.endlessBestWave || 0, Math.floor(wave));
        }
        if (options && options.isClear) {
            career.totalClears = (career.totalClears || 0) + 1;
        }
        const firstClearBonus = (options && options.isClear && options.awardHonor && !wasClearedBefore && options.awardFirstClearBonus !== false)
            ? (CONFIG.FIRST_CLEAR_HONOR_BONUS || 200)
            : 0;
        const earnedRunHonor = ((options && options.awardHonor && Number.isFinite(options.honorScore))
            ? Math.max(0, Math.round(options.honorScore))
            : 0) + firstClearBonus;
        if (earnedRunHonor > 0) {
            career.totalHonorEarned = (career.totalHonorEarned || 0) + earnedRunHonor;
            grantMetaHonorPoints(earnedRunHonor);
        }
        if (options && Number.isFinite(options.honorScore) && options.honorScore > (career.bestHonorScore || 0)) {
            career.bestHonorScore = Math.round(options.honorScore);
        }
        if (options && Number.isFinite(options.contractCount) && options.contractCount > (career.bestContractCount || 0)) {
            career.bestContractCount = Math.round(options.contractCount);
        }
        safeCloudStorageSet(CONFIG.STORAGE_CAREER_STATS_KEY || 'merge_defense_career_stats', JSON.stringify({
            bestWaveOverall: career.bestWaveOverall,
            totalClears: career.totalClears,
            bestHonorScore: career.bestHonorScore,
            totalHonorEarned: career.totalHonorEarned,
            bestContractCount: career.bestContractCount,
            endlessBestWave: career.endlessBestWave || 0
        }));
        return records;
    }

    function getMapBestWave(mapId) {
        const records = loadMapRecords();
        return (records[mapId] && records[mapId].bestWave) || 1;
    }

    function init() {
        try {
            GameAnalyticsTracker.init();
        } catch (_) {}
    }

    const BackendModule = {
        CLOUD_CONFIG,
        GameAnalyticsTracker,
        trackFeel,
        recordDamageByType,
        getDamageTypeBreakdown,
        getTopDamageTiles,
        getHighestTierOnBoard,
        resetRunTelemetry,
        recordPlayerAction,
        tickFeelMetrics,
        finalizeWaveFeel,
        finalizeRunFeel,
        getRunTelemetry: () => runTelemetry,
        generateBattleReportText,
        copyBattleReportToClipboard,
        generateDailyShareCardText,
        copyDailyShareCardToClipboard,
        loadMapRecords,
        wasMapCleared,
        isEndlessUnlocked,
        loadDailyRecords,
        saveDailyRecord,
        loadPuzzleRecords,
        savePuzzleClear,
        loadCareerStats,
        loadMetaTreeState,
        saveMetaTreeState,
        grantMetaHonorPoints,
        purchaseMetaNode,
        resetMetaTreeNodes,
        getUnlockableMetaNodes,
        saveMapRecord,
        getMapBestWave,
        init
    };

    GameApp.core = GameApp.core || {};
    GameApp.core.backend = BackendModule;
    GameApp.backend = BackendModule;
    global.GameBackend = BackendModule;
})(window);
