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

    // 總控開關與基礎棋盤常數（其餘專屬數值將由各功能夾 *_data.js 自動掛載匯入）
    const GLOBAL_CONFIG = {
        DEBUG_MODE: false,                  // 試玩模式預設隱藏測試作弊按鈕；改為 true 可開啟開發測試工具
        VICTORY_WAVE: 10,                   // 正式版總關卡波數（第 10 波為最終魔王戰）
        BOARD_COLS: 15,
        BOARD_ROWS: 10,
        BOARD_SIZE: 150,                    // 15 寬 x 10 高 = 150 格
        INITIAL_PREP_MS: 6000,              // 開局備戰倒數 (ms)
        WAVE_INTERMISSION_MS: 4000,         // 波次間休息倒數 (ms)
        FEEL_IDLE_THRESHOLD_MS: 4000,       // 試玩體感追蹤：超過 4 秒無任何操作視為發呆
        STORAGE_BEST_WAVE_KEY: 'merge_defense_best_wave',
        STORAGE_MAP_RECORDS_KEY: 'merge_defense_map_records',
        STORAGE_MUTE_KEY: 'merge_defense_muted',
        STORAGE_CODEX_KEY: 'merge_defense_codex_unlocked',
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
