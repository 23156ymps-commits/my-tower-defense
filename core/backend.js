/**
 * ============================================================================
 * 【檔案名稱】：core/backend.js
 * 【負責功能】：Firebase Remote Config 雲端熱更（支援 Deep Merge 動態新增角色／怪物）、
 *               GameAnalytics 試玩感官數據追蹤（trackFeel 六大維度）與單局黑盒子戰報生成。
 * 【讀取資料】：讀取並深度更新 GameApp.data 內所有 *_data.js 資料表與本地 localStorage 紀錄。
 * 【常見修改入口】：
 *   1. 新增或調整雲端熱更映射欄位：修改 applyRemoteBalanceConfig()。
 *   2. 調整試玩感官追蹤與單局黑盒子戰報格式：修改 trackFeel() 與 generateBattleReportText()。
 * ============================================================================
 */
(function (global) {
    'use strict';

    const GameApp = global.GameApp = global.GameApp || {};
    const CONFIG = GameApp.config || {};
    const { clampNumber, deepMerge, isPlainObject } = GameApp.helpers || {};

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
            enabled: false
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

    function bytesToBase64(bytes) {
        let bin = '';
        for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
        return btoa(bin);
    }

    // 純 JS SHA-256 備援（供無 crypto.subtle 的 file:// 或單機桌面殼層環境使用）
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

    /**
     * 雲端平衡設定表深度合併（支援數值覆蓋與動態新增角色／新怪物）
     */
    function applyRemoteBalanceConfig(balance) {
        try {
            if (!balance || typeof balance !== 'object') return null;

            const monstersData = (GameApp.data && GameApp.data.monsters) || {};
            const monsterRules = monstersData.GLOBAL_MONSTER_RULES || {};
            const monsterDb = monstersData.MONSTER_DATABASE || {};
            const towersData = (GameApp.data && GameApp.data.towers) || {};
            const towersDict = towersData.TOWERS || {};
            const tierDamageTable = towersData.TIER_DAMAGE_TABLE || {};
            const rolePrefixes = towersData.ROLE_TAG_PREFIXES || {};

            const summary = {
                monster_speed_scale: monsterRules.MONSTER_SPEED_SCALE || CONFIG.MONSTER_SPEED_SCALE || 1.0,
                monster_hp_scale: monsterRules.MONSTER_HP_SCALE || CONFIG.MONSTER_HP_SCALE || 1.0,
                monster_armor_scale: monsterRules.MONSTER_ARMOR_SCALE || CONFIG.MONSTER_ARMOR_SCALE || 1.0,
                monster_armor_bonus: monsterRules.MONSTER_ARMOR_BONUS || 0,
                crown_t3_damage_scale: 1.0,
                crown_t3_speed_scale: 1.0,
                towers: {},
                monsters: {}
            };

            const spdScale = Number(balance.monster_speed_scale);
            if (Number.isFinite(spdScale) && spdScale > 0) {
                const clampedSpd = clampNumber(spdScale, 0.2, 5.0, summary.monster_speed_scale);
                monsterRules.MONSTER_SPEED_SCALE = clampedSpd;
                CONFIG.MONSTER_SPEED_SCALE = clampedSpd;
                summary.monster_speed_scale = clampedSpd;
            }

            const hpScale = Number(balance.monster_hp_scale);
            if (Number.isFinite(hpScale) && hpScale > 0) {
                const clampedHp = clampNumber(hpScale, 0.1, 20.0, summary.monster_hp_scale);
                monsterRules.MONSTER_HP_SCALE = clampedHp;
                CONFIG.MONSTER_HP_SCALE = clampedHp;
                summary.monster_hp_scale = clampedHp;
            }

            const armorScale = Number(balance.monster_armor_scale);
            if (Number.isFinite(armorScale) && armorScale > 0) {
                const clampedArmorScale = clampNumber(armorScale, 0.1, 5.0, summary.monster_armor_scale);
                monsterRules.MONSTER_ARMOR_SCALE = clampedArmorScale;
                CONFIG.MONSTER_ARMOR_SCALE = clampedArmorScale;
                summary.monster_armor_scale = clampedArmorScale;
            }

            const armorBonus = Number(balance.monster_armor_bonus);
            if (Number.isFinite(armorBonus)) {
                const clampedArmorBonus = Math.round(clampNumber(armorBonus, -20, 50, 0));
                monsterRules.MONSTER_ARMOR_BONUS = clampedArmorBonus;
                summary.monster_armor_bonus = clampedArmorBonus;
            }

            // 支援深度覆蓋或動態新增防禦塔
            const towersCfg = balance.towers;
            if (towersCfg && typeof towersCfg === 'object') {
                Object.keys(towersCfg).forEach((type) => {
                    const tCfg = towersCfg[type];
                    if (!tCfg || typeof tCfg !== 'object') return;

                    // 若雲端新增了本地不存在的新塔，自動建立預設結構並深度合併
                    if (!towersDict[type]) {
                        towersDict[type] = {
                            id: type,
                            name: tCfg.name || `新元素塔(${type})`,
                            icon: tCfg.icon || '✨',
                            color: tCfg.color || '#D97724',
                            range: Number(tCfg.range) || 2.5,
                            attackIntervalMs: 1000,
                            attackStyle: tCfg.attackStyle || 'burst_armor_break',
                            elementTag: tCfg.elementTag || type,
                            lineageTags: Array.isArray(tCfg.lineageTags) ? tCfg.lineageTags : [type],
                            isHybrid: Boolean(tCfg.isHybrid),
                            shopSpawnable: tCfg.shopSpawnable !== undefined ? Boolean(tCfg.shopSpawnable) : !tCfg.isHybrid,
                            tierDamage: [0, 18, 40, 90],
                            effectParams: {}
                        };
                        tierDamageTable[type] = towersDict[type].tierDamage;
                    }

                    const elCfg = towersDict[type];
                    deepMerge(elCfg, tCfg);

                    if (Array.isArray(tCfg.dmg) && tCfg.dmg.length >= 4) {
                        const baseArr = Array.isArray(elCfg.tierDamage) ? elCfg.tierDamage : [0, 15, 35, 80];
                        const nextDmg = [0, 1, 2, 3].map((idx) => {
                            const n = Number(tCfg.dmg[idx]);
                            return idx === 0 ? 0 : (Number.isFinite(n) && n > 0 ? n : baseArr[idx]);
                        });
                        elCfg.tierDamage = nextDmg;
                        tierDamageTable[type] = nextDmg;
                    } else if (Array.isArray(tCfg.tierDamage) && tCfg.tierDamage.length >= 4) {
                        tierDamageTable[type] = elCfg.tierDamage;
                    }

                    const aps = Number(tCfg.attacks_per_sec || tCfg.attacksPerSec);
                    if (Number.isFinite(aps) && aps > 0) {
                        elCfg.attackIntervalMs = Math.max(100, Math.round(1000 / aps));
                    }

                    const rng = Number(tCfg.range);
                    if (Number.isFinite(rng) && rng > 0) {
                        elCfg.range = clampNumber(rng, 0.5, 15.0, elCfg.range);
                    }

                    if (tCfg.bolts !== undefined) {
                        const bolts = Math.round(Number(tCfg.bolts));
                        if (Number.isFinite(bolts) && bolts >= 1) {
                            const clampedBolts = Math.round(clampNumber(bolts, 1, 10, 2));
                            elCfg.effectParams = elCfg.effectParams || {};
                            elCfg.effectParams.boltCount = clampedBolts;
                            elCfg.effectParams.lv3BoltCount = Math.max(clampedBolts + 1, 3);
                            if (type === 'thunder') {
                                CONFIG.THUNDER_BOLT_COUNT = clampedBolts;
                                CONFIG.THUNDER_LV3_BOLT_COUNT = Math.max(clampedBolts + 1, 3);
                            }
                        }
                    }

                    const secText = Number((elCfg.attackIntervalMs / 1000).toFixed(2));
                    const rngText = Number(elCfg.range.toFixed(2));
                    const prefix = elCfg.roleTagPrefix || rolePrefixes[type] || (elCfg.name ? `${elCfg.name}·` : '');
                    elCfg.roleTag = `${prefix}${rngText}·${secText}s`;

                    summary.towers[type] = {
                        dmg: (tierDamageTable[type] || elCfg.tierDamage || [0, 10, 20, 40]).slice(),
                        attacks_per_sec: Number((1000 / elCfg.attackIntervalMs).toFixed(2)),
                        cooldownMs: elCfg.attackIntervalMs,
                        range: elCfg.range
                    };
                });
            }

            // 支援深度覆蓋或動態新增怪物
            const monstersCfg = balance.monsters;
            if (monstersCfg && typeof monstersCfg === 'object') {
                Object.keys(monstersCfg).forEach((mKey) => {
                    const mPatch = monstersCfg[mKey];
                    if (!mPatch || typeof mPatch !== 'object') return;
                    if (!monsterDb[mKey]) {
                        monsterDb[mKey] = {
                            id: mKey,
                            name: mPatch.name || `未知魔物(${mKey})`,
                            icon: mPatch.icon || '👾',
                            weakness: mPatch.weakness || 'fire',
                            baseHp: Number(mPatch.baseHp) || 70,
                            baseReward: Number(mPatch.baseReward) || 10,
                            speedMult: Number(mPatch.speedMult) || 1.0,
                            baseArmor: Number(mPatch.baseArmor) || 0,
                            splitsOnDeath: Boolean(mPatch.splitsOnDeath),
                            minWave: Number(mPatch.minWave) || 1,
                            visual: {
                                primaryColor: '#523C2B',
                                accentColor: '#E0B43C',
                                shape: 'beast',
                                sizeScale: 1.0
                            }
                        };
                    }
                    deepMerge(monsterDb[mKey], mPatch);
                    summary.monsters[mKey] = monsterDb[mKey];
                });
            }

            // 支援其他資料區深度合併（economy / terrain / routes / evolutions / tree）
            ['economy', 'terrain', 'routes', 'evolutions', 'tree'].forEach((modKey) => {
                if (isPlainObject(balance[modKey]) && GameApp.data && isPlainObject(GameApp.data[modKey])) {
                    deepMerge(GameApp.data[modKey], balance[modKey]);
                }
            });

            // 支援 3★ 冠枝全局傷害／攻速倍率（來自 admin.html 或 game_balance_json）
            const t3DmgScale = Number(balance.crown_t3_damage_scale);
            const t3SpdScale = Number(balance.crown_t3_speed_scale);
            if ((Number.isFinite(t3DmgScale) && t3DmgScale > 0 && Math.abs(t3DmgScale - 1.0) > 1e-4)
                || (Number.isFinite(t3SpdScale) && t3SpdScale > 0 && Math.abs(t3SpdScale - 1.0) > 1e-4)) {
                const safeDmgScale = Number.isFinite(t3DmgScale) && t3DmgScale > 0 ? clampNumber(t3DmgScale, 0.2, 5.0, 1.0) : 1.0;
                const safeSpdScale = Number.isFinite(t3SpdScale) && t3SpdScale > 0 ? clampNumber(t3SpdScale, 0.2, 5.0, 1.0) : 1.0;
                summary.crown_t3_damage_scale = safeDmgScale;
                summary.crown_t3_speed_scale = safeSpdScale;
                Object.keys(towersDict).forEach((type) => {
                    const elCfg = towersDict[type];
                    if (!elCfg || elCfg.isAlias) return;
                    const tNum = Number(elCfg.nodeTier) || Number(elCfg.tier) || 1;
                    if (tNum !== 3) return;
                    if (safeDmgScale !== 1.0) {
                        if (Number.isFinite(elCfg.damage)) elCfg.damage = Math.max(1, Math.round(elCfg.damage * safeDmgScale));
                        if (Array.isArray(elCfg.tierDamage) && Number.isFinite(elCfg.tierDamage[3])) {
                            elCfg.tierDamage[3] = Math.max(1, Math.round(elCfg.tierDamage[3] * safeDmgScale));
                        }
                        if (Array.isArray(tierDamageTable[type]) && Number.isFinite(tierDamageTable[type][3])) {
                            tierDamageTable[type][3] = Math.max(1, Math.round(tierDamageTable[type][3] * safeDmgScale));
                        }
                    }
                    if (safeSpdScale !== 1.0 && Number.isFinite(elCfg.attackIntervalMs)) {
                        elCfg.attackIntervalMs = Math.max(120, Math.round(elCfg.attackIntervalMs / safeSpdScale));
                    }
                });
            }

            if (towersData && typeof towersData.syncLegacyAliases === 'function') {
                towersData.syncLegacyAliases();
            }

            if (typeof onBalanceAppliedHook === 'function') {
                try { onBalanceAppliedHook(summary); } catch (_) {}
            }

            return summary;
        } catch (_) {
            return null;
        }
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
        disabledOffline: true,
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
                sdk_version: 'local',
                os_version: this.env.osVersion,
                manufacturer: 'unknown',
                device: 'unknown',
                platform: this.env.platform
            };
        },

        async init() {
            this.initialized = true;
            this.enabled = false;
            this.disabledOffline = true;
            this.queue.length = 0;
            return false;
        },

        enqueue() {
            // 純前端環境停用外部 GameAnalytics 上報，僅由 trackFeel 安全記錄至本機 runTelemetry
        },

        async flush() {
            this.queue.length = 0;
        },

        trackProgression(status, waveNum, mapId, score = null) {
            try {
                this.ensureIdentity();
                if (!Array.isArray(runTelemetry.progressionLog)) {
                    runTelemetry.progressionLog = [];
                }
                const cleanMap = String(mapId || 'forest').replace(/[^A-Za-z0-9_.-]/g, '_');
                const entry = {
                    t: Date.now(),
                    category: 'progression',
                    event_id: `${status}:${cleanMap}:Wave_${waveNum}`,
                    attempt_num: 1
                };
                if (status !== 'Start' && Number.isFinite(score)) {
                    entry.score = Math.round(score);
                }
                runTelemetry.progressionLog.push(entry);
                if (runTelemetry.progressionLog.length > 100) runTelemetry.progressionLog.shift();
            } catch (_) {}
        },

        trackDesign(eventId, value = null) {
            try {
                // 已由 trackFeel 寫入 runTelemetry.eventsLog，此處保留相容介面不再外送請求
                void eventId;
                void value;
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
            eventsLog: []
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
                const waveNum = (meta && meta.wave) || parts[2] || 1;
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

    function applyLocalBalanceOverride() {
        try {
            const raw = safeCloudStorageGet(CONFIG.STORAGE_LOCAL_BALANCE_KEY || 'merge_defense_local_balance_override');
            if (!raw) return false;
            const parsed = JSON.parse(raw);
            return Boolean(applyRemoteBalanceConfig(parsed));
        } catch (_) {
            return false;
        }
    }

    function init(options = {}) {
        try {
            if (options && typeof options.onBalanceApplied === 'function') {
                onBalanceAppliedHook = options.onBalanceApplied;
            }
            // 本機 admin.html 預覽覆蓋（無論離線或連線皆優先檢查，確保測試平衡即時生效）
            const hasLocalOverride = applyLocalBalanceOverride();
            if (isNetworkOffline()) return;
            if (!hasLocalOverride) initRemoteConfigBalance();
            GameAnalyticsTracker.init();
        } catch (_) {}
    }

    const BackendModule = {
        CLOUD_CONFIG,
        applyRemoteBalanceConfig,
        applyLocalBalanceOverride,
        initRemoteConfigBalance,
        GameAnalyticsTracker,
        trackFeel,
        resetRunTelemetry,
        recordPlayerAction,
        tickFeelMetrics,
        finalizeWaveFeel,
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
