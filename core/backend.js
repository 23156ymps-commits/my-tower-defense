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
        GAME_ANALYTICS: {
            enabled: true,
            proxyEndpoint: 'https://green-cake-844e.23156ymps.workers.dev'
        }
    };

    function safeCloudStorageGet(key) {
        try {
            return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
        } catch (_) {
            return null;
        }
    }

    function safeCloudStorageSet(key, val) {
        try {
            if (typeof localStorage !== 'undefined') localStorage.setItem(key, val);
        } catch (_) {
            // 受限或隱私環境無聲降級
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
            skillCasts: { entangle: 0, frenzy: 0 },
            blessingsPicked: [],
            leaks: [],
            bossKillProgressList: [],
            subjectiveRating: '',
            eventsLog: [],
            progressionLog: [],
            designLog: []
        };
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
            } else if (eventKey.startsWith('Tree:BlessingPick')) {
                const bName = (meta && meta.blessingName) || eventKey.split(':')[2] || '';
                if (bName && !runTelemetry.blessingsPicked.includes(bName)) {
                    runTelemetry.blessingsPicked.push(bName);
                }
            } else if (eventKey.startsWith('Feel:Rating:')) {
                const label = eventKey.slice('Feel:Rating:'.length);
                runTelemetry.subjectiveRating = label;
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
            GameAnalyticsTracker.flush();
        } catch (_) {}
    }

    function generateBattleReportText(runtime, outcomeMode = 'victory') {
        try {
            const isEn = Boolean(GameApp.i18n && GameApp.i18n.isEnglish());
            const st = (runtime && runtime.state) || {};
            const routesData = (GameApp.data && GameApp.data.routes && GameApp.data.routes.MAPS_CONFIG) || {};
            const mapSpec = routesData[st.currentMapId] || { name: runTelemetry.mapName || (isEn ? '🌲 Sunlit Woods' : '🌲 晨光森林') };
            const victoryWave = CONFIG.VICTORY_WAVE || 10;
            const waveStr = isEn
                ? (outcomeMode === 'victory'
                    ? `Victory (Wave ${st.currentWave || victoryWave}/${victoryWave} · Remaining ❤️ ${st.baseHp || 0})`
                    : `Defeat (Fallen at Wave ${st.currentWave || 1}${st.isEndlessMode ? ' Endless' : `/${victoryWave}`})`)
                : (outcomeMode === 'victory'
                    ? `通關成功 (Wave ${st.currentWave || victoryWave}/${victoryWave} · 剩餘 ❤️ ${st.baseHp || 0})`
                    : `防線失守 (陣亡於 Wave ${st.currentWave || 1}${st.isEndlessMode ? ' 無盡模式' : `/${victoryWave}`})`);

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

            const lines = isEn ? [
                '[Elemental Frontline: Merge TD — Battle Telemetry Report]',
                `🗺️ Battlefield: ${mapSpec.name}`,
                `🏁 Outcome: ${waveStr}`,
                `🚨 Leaks: ${leakStr}`,
                `🏆 MVP Tower: ${mvpText}`,
                `⏱️ Pace: Avg Idle ${idlePct}% | 2x/3x Usage ${fastSpdPct}% | Early Starts ${runTelemetry.earlyStartCount}`,
                `🖐️ Drag Cancels: Shop ${runTelemetry.dragCancel.shop} | Board Move ${runTelemetry.dragCancel.board}`,
                `🔥 Summons: ${summonStr} (Merges ${st.fusionCount || 0} | Sells ${runTelemetry.sellCount})`,
                `📍 Placement Zones: ${zoneStr}`,
                `🌳 World Tree: Entangle ${runTelemetry.skillCasts.entangle || 0}, Frenzy ${runTelemetry.skillCasts.frenzy || 0} | Blessings: ${blessingStr}`,
                `💰 Economy: End Gold ${st.currentGold || 0} 💰 (Total Earned ${(st.totalGoldEarned || 0).toLocaleString()} 💰 · Kills ${st.killsCount || 0})`,
                `💬 Quick Rating: ${ratingStr}`
            ] : [
                '【元素陣線：合成塔防 — 單局試玩黑盒子戰報】',
                `🗺️ 戰場地圖：${mapSpec.name}`,
                `🏁 戰局結果：${waveStr}`,
                `🚨 漏怪明細：${leakStr}`,
                `🏆 本局 MVP：${mvpText}`,
                `⏱️ 體感節奏：平均發呆率 ${idlePct}% ｜ 2x/3x 倍速佔比 ${fastSpdPct}% ｜ 提前開波 ${runTelemetry.earlyStartCount} 次`,
                `🖐️ 拖拉取消：商店召喚取消 ${runTelemetry.dragCancel.shop} 次 ／ 棋盤移塔取消 ${runTelemetry.dragCancel.board} 次`,
                `🔥 召喚統計：${summonStr}（合成融合 ${st.fusionCount || 0} 次 ／ 賣塔 ${runTelemetry.sellCount} 次）`,
                `📍 佈陣熱區：${zoneStr}`,
                `🌳 世界樹互動：纏繞 ${runTelemetry.skillCasts.entangle || 0} 次、狂熱 ${runTelemetry.skillCasts.frenzy || 0} 次 ｜ 祝福：${blessingStr}`,
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
            frost: { bestWave: 1, bestStars: 0 }
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

    function loadCareerStats() {
        const records = loadMapRecords();
        const maxFromMaps = Math.max(
            (records.forest && records.forest.bestWave) || 1,
            (records.lava && records.lava.bestWave) || 1,
            (records.frost && records.frost.bestWave) || 1
        );
        const career = {
            bestWaveOverall: maxFromMaps,
            totalClears: 0,
            bestHonorScore: 0,
            bestContractCount: 0,
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
                    if (Number.isFinite(Number(parsed.bestContractCount))) {
                        career.bestContractCount = Math.max(0, Math.floor(Number(parsed.bestContractCount)));
                    }
                }
            }
        } catch (_) {}
        const clearedMapCount = Object.keys(records).filter(id => records[id] && (records[id].bestStars || 0) > 0).length;
        career.totalClears = Math.max(career.totalClears, clearedMapCount);
        return career;
    }

    function saveMapRecord(mapId, wave, stars = null, options = {}) {
        const records = loadMapRecords();
        const target = records[mapId] || { bestWave: 1, bestStars: 0 };
        if (Number.isFinite(wave) && wave > target.bestWave) target.bestWave = wave;
        if (Number.isFinite(stars) && stars > target.bestStars) target.bestStars = Math.min(3, Math.max(0, stars));
        records[mapId] = target;

        safeCloudStorageSet(CONFIG.STORAGE_MAP_RECORDS_KEY || 'merge_defense_map_records', JSON.stringify(records));
        const maxOverall = Math.max(
            (records.forest && records.forest.bestWave) || 1,
            (records.lava && records.lava.bestWave) || 1,
            (records.frost && records.frost.bestWave) || 1
        );
        safeCloudStorageSet(CONFIG.STORAGE_BEST_WAVE_KEY || 'merge_defense_best_wave', String(maxOverall));

        const career = loadCareerStats();
        career.bestWaveOverall = Math.max(career.bestWaveOverall || 1, maxOverall);
        if (options && options.isClear) {
            career.totalClears = (career.totalClears || 0) + 1;
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
            bestContractCount: career.bestContractCount
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
        resetRunTelemetry,
        recordPlayerAction,
        tickFeelMetrics,
        finalizeWaveFeel,
        finalizeRunFeel,
        getRunTelemetry: () => runTelemetry,
        generateBattleReportText,
        copyBattleReportToClipboard,
        loadMapRecords,
        loadCareerStats,
        saveMapRecord,
        getMapBestWave,
        init
    };

    GameApp.core = GameApp.core || {};
    GameApp.core.backend = BackendModule;
    GameApp.backend = BackendModule;
    global.GameBackend = BackendModule;
})(window);
