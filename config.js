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

    GameApp.config = GLOBAL_CONFIG;
    GameApp.helpers = {
        clampNumber,
        coordsToIndex,
        indexToCoords,
        isPlainObject,
        deepMerge
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
