(function (global) {
    'use strict';

    const {
        CONFIG,
        ELEMENT_CONFIG,
        ROLE_TAG_PREFIXES,
        BASE_ELEMENT_TYPES,
        TIER_DAMAGE_TABLE,
        clampNumber
    } = global.GameConfig;

    // ==================== 雲端遠端平衡 (Firebase Remote Config) 與數據追蹤 (GameAnalytics) ====================
    const CLOUD_CONFIG = {
        TIMEOUT_MS: 1500,
        STORAGE_FIS_FID_KEY: 'merge_defense_firebase_fid',
        STORAGE_FIS_TOKEN_KEY: 'merge_defense_firebase_fis_token',
        STORAGE_GA_UID_KEY: 'merge_defense_ga_uid',
        STORAGE_GA_SESSION_NUM_KEY: 'merge_defense_ga_session_num',
        FIREBASE: {
            apiKey: 'AIzaSyCfrYqexIifIO5QFPytg5I9as0mVfuz9Fg',
            authDomain: 'my-tower-defense-c3198.firebaseapp.com',
            projectId: 'my-tower-defense-c3198',
            storageBucket: 'my-tower-defense-c3198.firebasestorage.app',
            messagingSenderId: '456677714756',
            appId: '1:456677714756:web:5e019f31258e8e4c998511',
            measurementId: 'G-JS6XDZREKR'
        },
        GAME_ANALYTICS: {
            gameKey: '7207cb99b684a05881326b4cde399736',
            secretKey: '33917bdf4e38d8813453645b74e9bbdd420fc1a2',
            endpoint: 'https://api.gameanalytics.com/v2'
        }
    };

    let onBalanceAppliedHook = null;

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
            // 受限或隱私環境靜默略過
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

    function bytesToBase64(bytes) {
        let bin = '';
        for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
        return btoa(bin);
    }

    // 純 JS SHA-256 備援（供無 crypto.subtle 的 file:// 或單機殼層環境使用）
    function sha256BytesFallback(dataBytes) {
        const K = [
            0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
            0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
            0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
            0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
            0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
            0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
            0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
            0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
        ];
        const H = new Int32Array([
            0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
            0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
        ]);
        const rotr = (n, x) => (x >>> n) | (x << (32 - n));
        const bitLen = dataBytes.length * 8;
        const padLen = ((dataBytes.length + 9 + 63) >> 6) << 6;
        const padded = new Uint8Array(padLen);
        padded.set(dataBytes);
        padded[dataBytes.length] = 0x80;
        const view = new DataView(padded.buffer);
        view.setUint32(padLen - 4, bitLen >>> 0, false);
        view.setUint32(padLen - 8, Math.floor(bitLen / 0x100000000), false);

        const W = new Int32Array(64);
        for (let off = 0; off < padLen; off += 64) {
            for (let i = 0; i < 16; i++) W[i] = view.getInt32(off + i * 4, false);
            for (let i = 16; i < 64; i++) {
                const s0 = rotr(7, W[i - 15]) ^ rotr(18, W[i - 15]) ^ (W[i - 15] >>> 3);
                const s1 = rotr(17, W[i - 2]) ^ rotr(19, W[i - 2]) ^ (W[i - 2] >>> 10);
                W[i] = (W[i - 16] + s0 + W[i - 7] + s1) | 0;
            }
            let [a, b, c, d, e, f, g, h] = H;
            for (let i = 0; i < 64; i++) {
                const S1 = rotr(6, e) ^ rotr(11, e) ^ rotr(25, e);
                const ch = (e & f) ^ (~e & g);
                const t1 = (h + S1 + ch + K[i] + W[i]) | 0;
                const S0 = rotr(2, a) ^ rotr(13, a) ^ rotr(22, a);
                const maj = (a & b) ^ (a & c) ^ (b & c);
                const t2 = (S0 + maj) | 0;
                h = g; g = f; f = e; e = (d + t1) | 0;
                d = c; c = b; b = a; a = (t1 + t2) | 0;
            }
            H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0;
            H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
        }
        const out = new Uint8Array(32);
        const outView = new DataView(out.buffer);
        for (let i = 0; i < 8; i++) outView.setInt32(i * 4, H[i], false);
        return out;
    }

    async function hmacSha256Base64(secretStr, messageStr) {
        const enc = new TextEncoder();
        const keyBytes = enc.encode(secretStr);
        const msgBytes = enc.encode(messageStr);

        if (typeof crypto !== 'undefined' && crypto.subtle && typeof crypto.subtle.importKey === 'function') {
            try {
                const key = await crypto.subtle.importKey(
                    'raw',
                    keyBytes,
                    { name: 'HMAC', hash: 'SHA-256' },
                    false,
                    ['sign']
                );
                const sig = await crypto.subtle.sign('HMAC', key, msgBytes);
                return bytesToBase64(new Uint8Array(sig));
            } catch (_) {
                // 降級至純 JS 實作
            }
        }

        const blockKey = keyBytes.length > 64 ? sha256BytesFallback(keyBytes) : keyBytes;
        const oPad = new Uint8Array(64 + 32);
        const iPad = new Uint8Array(64 + msgBytes.length);
        for (let i = 0; i < 64; i++) {
            const kb = i < blockKey.length ? blockKey[i] : 0;
            oPad[i] = kb ^ 0x5c;
            iPad[i] = kb ^ 0x36;
        }
        iPad.set(msgBytes, 64);
        oPad.set(sha256BytesFallback(iPad), 64);
        return bytesToBase64(sha256BytesFallback(oPad));
    }

    function getOrCreateFirebaseFid() {
        const saved = safeCloudStorageGet(CLOUD_CONFIG.STORAGE_FIS_FID_KEY);
        if (saved && /^[A-Za-z0-9_-]{11,22}$/.test(saved)) return saved;

        const bytes = new Uint8Array(17);
        if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
            crypto.getRandomValues(bytes);
        } else {
            for (let i = 0; i < 17; i++) bytes[i] = Math.floor(Math.random() * 256);
        }
        bytes[0] = 0x70 | (bytes[0] & 0x0f);
        const fid = bytesToBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '').slice(0, 22);
        safeCloudStorageSet(CLOUD_CONFIG.STORAGE_FIS_FID_KEY, fid);
        return fid;
    }

    function applyRemoteBalanceConfig(balance) {
        if (!balance || typeof balance !== 'object') return null;

        const summary = {
            monster_speed_scale: CONFIG.MONSTER_SPEED_SCALE,
            monster_hp_scale: CONFIG.MONSTER_HP_SCALE,
            towers: {}
        };

        const spdScale = Number(balance.monster_speed_scale);
        if (Number.isFinite(spdScale) && spdScale > 0) {
            const clampedSpd = clampNumber(spdScale, 0.2, 5.0, CONFIG.MONSTER_SPEED_SCALE);
            CONFIG.MONSTER_SPEED_SCALE = clampedSpd;
            summary.monster_speed_scale = clampedSpd;
        }

        const hpScale = Number(balance.monster_hp_scale);
        if (Number.isFinite(hpScale) && hpScale > 0) {
            const clampedHp = clampNumber(hpScale, 0.1, 20.0, CONFIG.MONSTER_HP_SCALE);
            CONFIG.MONSTER_HP_SCALE = clampedHp;
            summary.monster_hp_scale = clampedHp;
        }

        const towersCfg = balance.towers;
        if (towersCfg && typeof towersCfg === 'object') {
            BASE_ELEMENT_TYPES.forEach((type) => {
                const tCfg = towersCfg[type];
                const elCfg = ELEMENT_CONFIG[type];
                if (!tCfg || typeof tCfg !== 'object' || !elCfg) return;

                if (Array.isArray(tCfg.dmg) && tCfg.dmg.length >= 4 && Array.isArray(TIER_DAMAGE_TABLE[type])) {
                    const nextDmg = [0, 1, 2, 3].map((idx) => {
                        const n = Number(tCfg.dmg[idx]);
                        return idx === 0 ? 0 : (Number.isFinite(n) && n > 0 ? n : TIER_DAMAGE_TABLE[type][idx]);
                    });
                    TIER_DAMAGE_TABLE[type] = nextDmg;
                }

                const aps = Number(tCfg.attacks_per_sec);
                if (Number.isFinite(aps) && aps > 0) {
                    elCfg.attackIntervalMs = Math.max(100, Math.round(1000 / aps));
                }

                const rng = Number(tCfg.range);
                if (Number.isFinite(rng) && rng > 0) {
                    elCfg.range = clampNumber(rng, 0.5, 15.0, elCfg.range);
                }

                if (type === 'thunder' && tCfg.bolts !== undefined) {
                    const bolts = Math.round(Number(tCfg.bolts));
                    if (Number.isFinite(bolts) && bolts >= 1) {
                        const clampedBolts = Math.round(clampNumber(bolts, 1, 10, CONFIG.THUNDER_BOLT_COUNT));
                        CONFIG.THUNDER_BOLT_COUNT = clampedBolts;
                        CONFIG.THUNDER_LV3_BOLT_COUNT = Math.max(clampedBolts + 1, 3);
                    }
                }

                const secText = Number((elCfg.attackIntervalMs / 1000).toFixed(2));
                const rngText = Number(elCfg.range.toFixed(2));
                elCfg.roleTag = `${ROLE_TAG_PREFIXES[type] || ''}${rngText}·${secText}s`;

                summary.towers[type] = {
                    dmg: TIER_DAMAGE_TABLE[type].slice(),
                    attacks_per_sec: Number.isFinite(aps) && aps > 0 ? aps : Number((1000 / elCfg.attackIntervalMs).toFixed(2)),
                    cooldownMs: elCfg.attackIntervalMs,
                    range: elCfg.range
                };
                if (type === 'thunder') {
                    summary.towers[type].bolts = CONFIG.THUNDER_BOLT_COUNT;
                }
            });
        }

        if (typeof onBalanceAppliedHook === 'function') {
            try { onBalanceAppliedHook(summary); } catch (_) {}
        }

        const fireStr = `火:${ELEMENT_CONFIG.fire.attackIntervalMs}ms 傷[${TIER_DAMAGE_TABLE.fire.slice(1).join('/')}] 距${ELEMENT_CONFIG.fire.range}`;
        const iceStr = `冰:${ELEMENT_CONFIG.ice.attackIntervalMs}ms 傷[${TIER_DAMAGE_TABLE.ice.slice(1).join('/')}] 距${ELEMENT_CONFIG.ice.range}`;
        const thunderStr = `雷:${ELEMENT_CONFIG.thunder.attackIntervalMs}ms 傷[${TIER_DAMAGE_TABLE.thunder.slice(1).join('/')}] 距${ELEMENT_CONFIG.thunder.range} (${CONFIG.THUNDER_BOLT_COUNT}連電)`;
        console.log(`[RemoteConfig] 已套用雲端平衡設定表｜怪速×${summary.monster_speed_scale} 怪血×${summary.monster_hp_scale}｜${fireStr}｜${iceStr}｜${thunderStr}`, summary);
        return summary;
    }

    async function initRemoteConfigBalance() {
        try {
            if (isNetworkOffline()) return false;
            const { apiKey, projectId, appId } = CLOUD_CONFIG.FIREBASE;
            const startedAt = Date.now();
            const remainingMs = () => Math.max(150, CLOUD_CONFIG.TIMEOUT_MS - (Date.now() - startedAt));
            const fid = getOrCreateFirebaseFid();

            let token = null;
            try {
                const cached = JSON.parse(safeCloudStorageGet(CLOUD_CONFIG.STORAGE_FIS_TOKEN_KEY) || 'null');
                if (cached && cached.token && cached.expiresAt > Date.now() + 60000) {
                    token = cached.token;
                }
            } catch (_) {}

            if (!token) {
                const fisRes = await fetchWithTimeout(
                    `https://firebaseinstallations.googleapis.com/v1/projects/${projectId}/installations`,
                    {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-Goog-Api-Key': apiKey
                        },
                        body: JSON.stringify({
                            fid,
                            appId,
                            authVersion: 'FIS_v2',
                            sdkVersion: 'w:0.6.4'
                        })
                    },
                    remainingMs()
                );
                if (!fisRes || !fisRes.ok) return false;
                const fisData = await fisRes.json();
                token = fisData && fisData.authToken && fisData.authToken.token;
                if (!token) return false;

                const ttlMs = (parseInt(fisData.authToken.expiresIn, 10) || 3600) * 1000;
                safeCloudStorageSet(CLOUD_CONFIG.STORAGE_FIS_TOKEN_KEY, JSON.stringify({
                    token,
                    expiresAt: Date.now() + ttlMs
                }));
            }

            if (Date.now() - startedAt >= CLOUD_CONFIG.TIMEOUT_MS) return false;

            const rcRes = await fetchWithTimeout(
                `https://firebaseremoteconfig.googleapis.com/v1/projects/${projectId}/namespaces/firebase:fetch?key=${apiKey}`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Goog-Firebase-Installations-Auth': token
                    },
                    body: JSON.stringify({
                        appInstanceId: fid,
                        appInstanceIdToken: token,
                        appId,
                        languageCode: 'zh-TW'
                    })
                },
                remainingMs()
            );
            if (!rcRes || !rcRes.ok) return false;

            const rcData = await rcRes.json();
            const rawJson = rcData && rcData.entries && rcData.entries.game_balance_json;
            if (!rawJson || typeof rawJson !== 'string') return false;

            const parsed = JSON.parse(rawJson);
            applyRemoteBalanceConfig(parsed);
            return true;
        } catch (_) {
            return false;
        }
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
        enabled: false,
        disabledOffline: false,
        initPromise: null,
        flushTimer: null,
        tsOffsetSec: 0,
        userId: '',
        sessionId: '',
        sessionNum: 1,
        env: { platform: 'windows', osVersion: 'windows 10' },
        queue: [],

        ensureIdentity() {
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

        async init() {
            if (this.initPromise) return this.initPromise;
            this.initPromise = (async () => {
                try {
                    if (isNetworkOffline()) {
                        this.disabledOffline = true;
                        this.queue.length = 0;
                        return false;
                    }
                    this.ensureIdentity();
                    const body = JSON.stringify({
                        platform: this.env.platform,
                        os_version: this.env.osVersion,
                        sdk_version: 'rest api v2'
                    });
                    const auth = await hmacSha256Base64(CLOUD_CONFIG.GAME_ANALYTICS.secretKey, body);
                    const res = await fetchWithTimeout(
                        `${CLOUD_CONFIG.GAME_ANALYTICS.endpoint}/${CLOUD_CONFIG.GAME_ANALYTICS.gameKey}/init`,
                        {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': auth
                            },
                            body
                        },
                        CLOUD_CONFIG.TIMEOUT_MS
                    );
                    if (!res || !res.ok) {
                        this.disabledOffline = true;
                        this.queue.length = 0;
                        return false;
                    }
                    const data = await res.json();
                    this.initialized = true;
                    this.enabled = Boolean(data && data.enabled);
                    if (data && Number.isFinite(data.server_ts)) {
                        this.tsOffsetSec = data.server_ts - Math.floor(Date.now() / 1000);
                    }
                    if (this.enabled) {
                        this.queue.unshift({ ...this.buildBaseEvent(), category: 'user' });
                        this.flush();
                    } else {
                        this.queue.length = 0;
                    }
                    return this.enabled;
                } catch (_) {
                    this.disabledOffline = true;
                    this.queue.length = 0;
                    return false;
                }
            })();
            return this.initPromise;
        },

        enqueue(payload) {
            try {
                if (this.disabledOffline || isNetworkOffline()) return;
                this.ensureIdentity();
                this.queue.push({ ...this.buildBaseEvent(), ...payload });
                if (this.queue.length > 50) this.queue.shift();
                if (!this.initialized) {
                    this.init();
                    return;
                }
                if (!this.enabled) return;
                if (!this.flushTimer) {
                    this.flushTimer = setTimeout(() => {
                        this.flushTimer = null;
                        this.flush();
                    }, 120);
                }
            } catch (_) {}
        },

        async flush() {
            try {
                if (!this.enabled || this.queue.length === 0 || isNetworkOffline()) return;
                const batch = this.queue.splice(0, 20);
                const body = JSON.stringify(batch);
                const auth = await hmacSha256Base64(CLOUD_CONFIG.GAME_ANALYTICS.secretKey, body);
                await fetchWithTimeout(
                    `${CLOUD_CONFIG.GAME_ANALYTICS.endpoint}/${CLOUD_CONFIG.GAME_ANALYTICS.gameKey}/events`,
                    {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': auth
                        },
                        body
                    },
                    CLOUD_CONFIG.TIMEOUT_MS
                );
            } catch (_) {}
        },

        trackProgression(status, waveNum, mapId, score = null) {
            const cleanMap = String(mapId || 'forest').replace(/[^A-Za-z0-9_.-]/g, '_');
            const payload = {
                category: 'progression',
                event_id: `${status}:${cleanMap}:Wave_${waveNum}`,
                attempt_num: 1
            };
            if (status !== 'Start' && Number.isFinite(score)) {
                payload.score = Math.round(score);
            }
            this.enqueue(payload);
        },

        trackDesign(eventId, value = null) {
            const payload = {
                category: 'design',
                event_id: eventId
            };
            if (Number.isFinite(value)) {
                payload.value = value;
            }
            this.enqueue(payload);
        }
    };

    // ==================== 本地持久化紀錄（Best Wave & Map Stars） ====================
    function loadMapRecords() {
        let legacyBest = 1;
        const savedLegacy = parseInt(safeCloudStorageGet(CONFIG.STORAGE_BEST_WAVE_KEY), 10);
        if (Number.isFinite(savedLegacy) && savedLegacy >= 1) legacyBest = savedLegacy;

        const defaults = {
            forest: { bestWave: legacyBest, bestStars: 0 },
            lava: { bestWave: 1, bestStars: 0 }
        };
        try {
            const raw = safeCloudStorageGet(CONFIG.STORAGE_MAP_RECORDS_KEY);
            if (!raw) return defaults;
            const parsed = JSON.parse(raw);
            if (!parsed || typeof parsed !== 'object') return defaults;
            ['forest', 'lava'].forEach(id => {
                const rec = parsed[id];
                if (!rec || typeof rec !== 'object') return;
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

    function saveMapRecord(mapId, wave, stars = null) {
        const records = loadMapRecords();
        const target = records[mapId] || { bestWave: 1, bestStars: 0 };
        if (Number.isFinite(wave) && wave > target.bestWave) target.bestWave = wave;
        if (Number.isFinite(stars) && stars > target.bestStars) target.bestStars = Math.min(3, Math.max(0, stars));
        records[mapId] = target;

        safeCloudStorageSet(CONFIG.STORAGE_MAP_RECORDS_KEY, JSON.stringify(records));
        const maxOverall = Math.max(records.forest.bestWave || 1, records.lava.bestWave || 1);
        safeCloudStorageSet(CONFIG.STORAGE_BEST_WAVE_KEY, String(maxOverall));
        return records;
    }

    function getMapBestWave(mapId) {
        const records = loadMapRecords();
        return (records[mapId] && records[mapId].bestWave) || 1;
    }

    function init(options = {}) {
        try {
            if (options && typeof options.onBalanceApplied === 'function') {
                onBalanceAppliedHook = options.onBalanceApplied;
            }
            if (isNetworkOffline()) return;
            initRemoteConfigBalance();
            GameAnalyticsTracker.init();
        } catch (_) {}
    }

    global.GameBackend = {
        CLOUD_CONFIG,
        applyRemoteBalanceConfig,
        initRemoteConfigBalance,
        GameAnalyticsTracker,
        loadMapRecords,
        saveMapRecord,
        getMapBestWave,
        init
    };
})(window);
