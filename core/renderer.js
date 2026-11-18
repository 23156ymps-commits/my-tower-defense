/**
 * ============================================================================
 * 【檔案名稱】：core/renderer.js
 * 【負責功能】：參數化 2.5D 雙層砲塔與 3D 向量怪物外觀生成、棋盤 DOM 渲染、
 *               射程預覽圈控制，以及 <canvas id="fx-canvas"> 彈道與粒子特效繪製。
 * 【讀取資料】：動態讀取 tower_data.js、monster_data.js、terrain_data.js 的顏色與外觀參數。
 * 【常見修改入口】：
 *   1. 修改砲塔或怪物的參數化 2.5D 幾何外觀：修改 createTowerSvgParts()、createMonsterSvgHtml()。
 *   2. 修改攻擊彈道、閃電鏈、雷射光束與爆炸粒子特效：修改 emitCanvasAttackFX()。
 * ============================================================================
 */
(function (global) {
    'use strict';

    const GameApp = global.GameApp = global.GameApp || {};
    const CONFIG = GameApp.config || {};
    const { clampNumber, indexToCoords } = GameApp.helpers || {};

    let G = null;
    function bind(ctx) { G = ctx; }

    function getMaxTier() {
        return (GameApp.data && GameApp.data.evolutions && GameApp.data.evolutions.MAX_TIER) || CONFIG.MAX_TIER || 3;
    }

    function getTierStars(tier) {
        return '★'.repeat(Math.max(1, Math.min(getMaxTier(), tier || 1)));
    }

    function getTowersDict() {
        return (GameApp.data && GameApp.data.towers && GameApp.data.towers.TOWERS) || {};
    }

    function getTerrainsDict() {
        return (GameApp.data && GameApp.data.terrain && GameApp.data.terrain.TERRAIN_TYPES) || {};
    }

    function getMonstersDict() {
        return (GameApp.data && GameApp.data.monsters && GameApp.data.monsters.MONSTER_DATABASE) || {};
    }

    const DEFAULT_TOKENS = {
        bgCanvas: '#1B211E',
        bgGridElevated: '#242C28',
        bgSurface: '#2C3530',
        borderSubtle: '#46544C',
        textPrimary: '#F4F1EA',
        textSecondary: '#B8C2BC',
        accentCta: '#D97724',
        elFire: '#C94A38',
        elIce: '#4A9EBF',
        elLightning: '#E0B43C'
    };

    function getThemeTokens() {
        if (typeof getComputedStyle === 'undefined' || typeof document === 'undefined' || !document.documentElement) {
            return DEFAULT_TOKENS;
        }
        const cs = getComputedStyle(document.documentElement);
        const pick = (varName, fallback) => {
            const val = cs.getPropertyValue(varName);
            return val && val.trim() ? val.trim() : fallback;
        };
        return {
            bgCanvas: pick('--bg-canvas', DEFAULT_TOKENS.bgCanvas),
            bgGridElevated: pick('--bg-grid-elevated', DEFAULT_TOKENS.bgGridElevated),
            bgSurface: pick('--bg-surface', DEFAULT_TOKENS.bgSurface),
            borderSubtle: pick('--border-subtle', DEFAULT_TOKENS.borderSubtle),
            textPrimary: pick('--text-primary', DEFAULT_TOKENS.textPrimary),
            textSecondary: pick('--text-secondary', DEFAULT_TOKENS.textSecondary),
            accentCta: pick('--accent-cta', DEFAULT_TOKENS.accentCta),
            elFire: pick('--el-fire', DEFAULT_TOKENS.elFire),
            elIce: pick('--el-ice', DEFAULT_TOKENS.elIce),
            elLightning: pick('--el-lightning', DEFAULT_TOKENS.elLightning)
        };
    }

    // ==================== 2.5D 雙層砲塔與 3D 向量怪物參數化 SVG 生成 ====================
    function getTowerPaletteForType(type, tk) {
        const defaults = {
            fire: { rune: tk.elFire, glow: '#F4DFC8' },
            ice: { rune: tk.elIce, glow: '#D6EEF7' },
            thunder: { rune: tk.elLightning, glow: '#F7EAC0' },
            steam: { rune: tk.accentCta, glow: tk.elIce },
            magnet: { rune: tk.elIce, glow: tk.elLightning },
            plasma: { rune: tk.elFire, glow: tk.elLightning }
        };
        if (defaults[type]) return defaults[type];
        const tCfg = getTowersDict()[type];
        if (tCfg && tCfg.palette) return tCfg.palette;
        const mainColor = (tCfg && tCfg.color) || tk.accentCta;
        return { rune: mainColor, glow: tk.textPrimary };
    }

    const TOWER_HEAD_TEMPLATES = {
        fire: (tier, tk) => {
            const fins = tier >= 3 ? `<polygon points="14,40 22,25 24,42" fill="${tk.elFire}" stroke="#2B1410" stroke-width="1.5"/><polygon points="50,40 42,25 40,42" fill="#8C2F23" stroke="#2B1410" stroke-width="1.5"/>` : '';
            const pods = tier >= 2 ? `<rect x="16.5" y="30" width="5" height="11" rx="2" fill="${tk.accentCta}" stroke="#2B1410" stroke-width="1.5"/><rect x="42.5" y="30" width="5" height="11" rx="2" fill="#9E5214" stroke="#2B1410" stroke-width="1.5"/>` : '';
            return `<ellipse cx="33" cy="36" rx="13" ry="11" fill="rgba(0,0,0,0.30)"/>${fins}<polygon points="27,7 37,7 39,30 25,30" fill="#6E281E" stroke="#2B1410" stroke-width="1.5"/><rect x="29" y="9" width="3" height="19" rx="1" fill="${tk.elFire}" fill-opacity="0.7"/><polygon points="24.5,6 39.5,6 37.5,12 26.5,12" fill="${tk.accentCta}" stroke="#2B1410" stroke-width="1.5"/><ellipse cx="32" cy="7" rx="4.5" ry="2.2" fill="${tk.elLightning}"/><polygon points="22,26 42,26 45,38 38,46 26,46 19,38" fill="${tk.elFire}" stroke="#2B1410" stroke-width="1.5"/>${pods}<polygon points="22,26 36,26 32,35 20,37" fill="rgba(244,241,234,0.22)"/><circle cx="32" cy="36" r="${tier >= 3 ? 6.2 : 5}" fill="${tk.accentCta}" stroke="#2B1410" stroke-width="1.5"/><circle cx="31" cy="34.5" r="${tier >= 3 ? 2.8 : 2.1}" fill="${tk.textPrimary}"/>`;
        },
        ice: (tier, tk) => {
            const shards = tier >= 2 ? `<polygon points="18,16 24,28 19,38 14,32" fill="${tk.elIce}" stroke="#143240" stroke-width="1.5"/><polygon points="46,16 40,28 45,38 50,32" fill="#2E6F8A" stroke="#143240" stroke-width="1.5"/>` : '';
            const crest = tier >= 3 ? `<polygon points="16,40 21,36 22,44" fill="${tk.elLightning}"/><polygon points="48,40 43,36 42,44" fill="${tk.elLightning}"/>` : '';
            return `<ellipse cx="33" cy="36" rx="12" ry="11" fill="rgba(0,0,0,0.30)"/>${shards}<polygon points="32,4 39,28 32,34 25,28" fill="${tk.elIce}" stroke="#143240" stroke-width="1.5"/><polygon points="32,4 32,34 25,28" fill="rgba(244,241,234,0.36)"/>${crest}<polygon points="21,28 43,28 46,39 32,47 18,39" fill="#2B6780" stroke="#143240" stroke-width="1.5"/><polygon points="21,28 34,28 31,41 19,38" fill="rgba(244,241,234,0.18)"/><polygon points="32,29 38,36 32,43 26,36" fill="${tier >= 3 ? tk.textPrimary : '#A6D7EA'}" stroke="#143240" stroke-width="1.5"/>`;
        },
        thunder: (tier, tk) => {
            const orb = tier >= 3 ? `<circle cx="32" cy="40" r="4.2" fill="${tk.elLightning}" stroke="#2B2410" stroke-width="1.5"/>` : '';
            return `<ellipse cx="33" cy="36" rx="13" ry="11" fill="rgba(0,0,0,0.30)"/><polygon points="20,9 25,9 26,30 20,30" fill="#5A4B22" stroke="#241F10" stroke-width="1.5"/><polygon points="39,9 44,9 44,30 38,30" fill="#463A1A" stroke="#241F10" stroke-width="1.5"/><circle cx="22.5" cy="9" r="3.4" fill="${tk.elLightning}" stroke="#241F10" stroke-width="1.5"/><circle cx="41.5" cy="9" r="3.4" fill="${tk.elLightning}" stroke="#241F10" stroke-width="1.5"/><polyline points="23,9 29,6 33,12 41,9" fill="none" stroke="${tk.elLightning}" stroke-width="${tier >= 3 ? 2.2 : 1.6}" stroke-linecap="round" stroke-linejoin="round"/><polygon points="32,12 35,28 29,28" fill="${tk.elLightning}" stroke="#241F10" stroke-width="1.5"/><polygon points="19,28 45,28 47,40 39,47 25,47 17,40" fill="#3D341E" stroke="#241F10" stroke-width="1.5"/><polygon points="19,28 34,28 30,43 18,39" fill="rgba(244,241,234,0.16)"/><rect x="23" y="30" width="18" height="4" rx="2" fill="${tk.accentCta}"/><rect x="25" y="36" width="14" height="3.5" rx="1.5" fill="${tier >= 2 ? tk.elLightning : tk.accentCta}"/>${orb}`;
        },
        steam: (tier, tk) => `<ellipse cx="33" cy="36" rx="14" ry="11" fill="rgba(0,0,0,0.32)"/><rect x="23" y="7" width="8" height="22" rx="2" fill="#8C3326" stroke="#1E1814" stroke-width="1.5"/><rect x="33" y="7" width="8" height="22" rx="2" fill="#2D6A82" stroke="#1E1814" stroke-width="1.5"/><rect x="21" y="6" width="22" height="5" rx="2" fill="${tk.textSecondary}" stroke="#1E1814" stroke-width="1.5"/><circle cx="27" cy="8.5" r="2.1" fill="${tk.elFire}"/><circle cx="37" cy="8.5" r="2.1" fill="${tk.elIce}"/><polygon points="18,27 32,27 32,47 23,46 16,38" fill="${tk.elFire}" stroke="#1E1814" stroke-width="1.5"/><polygon points="32,27 46,27 48,38 41,46 32,47" fill="${tk.elIce}" stroke="#1E1814" stroke-width="1.5"/><circle cx="32" cy="36" r="${tier >= 3 ? 6.2 : 5.2}" fill="${tk.textPrimary}" stroke="#1E1814" stroke-width="1.5"/><circle cx="32" cy="36" r="2.6" fill="${tier >= 3 ? tk.elLightning : tk.accentCta}"/>`,
        magnet: (tier, tk) => `<ellipse cx="33" cy="36" rx="14" ry="11" fill="rgba(0,0,0,0.30)"/><polygon points="18,6 25,6 26,33 17,37" fill="${tk.elIce}" stroke="#142C36" stroke-width="1.5"/><polygon points="46,6 39,6 38,33 47,37" fill="#9E7E26" stroke="#241F10" stroke-width="1.5"/><polygon points="20,8 23,8 23,28 20,28" fill="rgba(244,241,234,0.45)"/><polygon points="41,8 44,8 44,28 41,28" fill="rgba(244,241,234,0.35)"/><circle cx="32" cy="16" r="5" fill="${tk.elIce}" stroke="${tk.elLightning}" stroke-width="1.5"/><circle cx="32" cy="16" r="2" fill="${tk.textPrimary}"/><polygon points="21,30 43,30 47,39 39,47 25,47 17,39" fill="${tk.bgSurface}" stroke="${tk.elIce}" stroke-width="1.5"/><circle cx="32" cy="38" r="${tier >= 3 ? 6 : 5}" fill="${tk.elLightning}" stroke="#142C36" stroke-width="1.5"/>`,
        plasma: (tier, tk) => `<ellipse cx="33" cy="36" rx="14" ry="11" fill="rgba(0,0,0,0.32)"/><polygon points="14,34 25,21 26,41 18,43" fill="${tk.elFire}" stroke="#2B1410" stroke-width="1.5"/><polygon points="50,34 39,21 38,41 46,43" fill="#8C2F23" stroke="#2B1410" stroke-width="1.5"/><polygon points="32,5 37,27 27,27" fill="${tk.elLightning}" stroke="#2B1410" stroke-width="1.5"/><polygon points="32,8 34,26 30,26" fill="rgba(244,241,234,0.6)"/><ellipse cx="32" cy="20" rx="8" ry="3.2" fill="none" stroke="${tk.accentCta}" stroke-width="1.5"/><polygon points="22,27 42,27 44,39 32,48 20,39" fill="#7D2B1F" stroke="${tk.elLightning}" stroke-width="1.5"/><circle cx="32" cy="36" r="${tier >= 3 ? 6.2 : 5}" fill="${tk.accentCta}" stroke="${tk.elLightning}" stroke-width="1.5"/><circle cx="31.5" cy="35" r="2.2" fill="${tk.textPrimary}"/>`
    };

    /**
     * 參數化自動生成新角色砲塔頭（當後台或 tower_data.js 動態新增未知 ID 角色時自動渲染）
     */
    function buildParametricTowerHeadSvg(type, tier, tk) {
        const tCfg = getTowersDict()[type] || {};
        const primary = tCfg.color || tk.accentCta;
        const accent = (tCfg.palette && tCfg.palette.glow) || tk.elLightning;
        const wings = tier >= 2
            ? `<polygon points="15,36 22,24 23,41" fill="${primary}" stroke="#1B211E" stroke-width="1.5"/><polygon points="49,36 42,24 41,41" fill="${primary}" stroke="#1B211E" stroke-width="1.5"/>`
            : '';
        const crown = tier >= 3
            ? `<circle cx="32" cy="14" r="4" fill="${accent}" stroke="#1B211E" stroke-width="1.5"/>`
            : '';
        return `<ellipse cx="33" cy="36" rx="13" ry="11" fill="rgba(0,0,0,0.30)"/>${wings}<polygon points="27,7 37,7 39,29 25,29" fill="${primary}" stroke="#1B211E" stroke-width="1.5"/>${crown}<polygon points="21,27 43,27 46,39 38,47 26,47 18,39" fill="${primary}" stroke="#1B211E" stroke-width="1.5"/><circle cx="32" cy="36" r="${tier >= 3 ? 6 : 4.8}" fill="${accent}" stroke="#1B211E" stroke-width="1.5"/>`;
    }

    function createTowerSvgParts(type, tier = 1) {
        const tk = getThemeTokens();
        const pal = getTowerPaletteForType(type, tk);
        const crownTrim = tier >= 3 ? `<polygon points="18,14 46,14 52,24 52,36 45,45 19,45 12,36 12,24" fill="none" stroke="${tk.elLightning}" stroke-width="1.5"/>` : '';
        const gemCoords = tier >= 2 ? [[32, 17], [48, 30], [32, 42], [16, 30]] : [[20, 20], [44, 20], [20, 40], [44, 40]];
        const cornerGems = gemCoords.map(([cx, cy]) => `<circle cx="${cx}" cy="${cy}" r="${tier >= 2 ? 2.1 : 1.4}" fill="${tier >= 2 ? pal.glow : tk.textSecondary}"/>`).join('');

        const baseSvgHtml = `<svg class="tower-base-svg" viewBox="0 0 64 64" aria-hidden="true"><ellipse cx="32" cy="53" rx="23" ry="8" fill="rgba(0,0,0,0.40)"/><polygon points="15,22 49,22 55,33 55,44 47,53 17,53 9,44 9,33" fill="${tk.bgGridElevated}" stroke="${tk.bgCanvas}" stroke-width="2"/><polygon points="9,44 17,53 17,43 11,35" fill="rgba(244,241,234,0.08)"/><polygon points="55,44 47,53 47,43 53,35" fill="rgba(0,0,0,0.25)"/><polygon points="18,14 46,14 52,24 52,36 45,45 19,45 12,36 12,24" fill="#3B453F" stroke="${tk.borderSubtle}" stroke-width="1.5"/><polyline points="14,24 19,15 45,15 50,24" fill="none" stroke="rgba(244,241,234,0.28)" stroke-width="1.5"/>${crownTrim}<circle cx="32" cy="30" r="14" fill="${tk.bgCanvas}" stroke="${tk.bgCanvas}" stroke-width="1.5"/><circle cx="32" cy="30" r="11.5" fill="none" stroke="${pal.rune}" stroke-width="${tier >= 3 ? 2 : 1.5}" stroke-opacity="${tier === 1 ? 0.72 : 0.95}"/>${cornerGems}</svg>`;
        const headBuilder = TOWER_HEAD_TEMPLATES[type] || ((t, tokens) => buildParametricTowerHeadSvg(type, t, tokens));
        return { baseSvgHtml, headSvgHtml: `<svg class="tower-head-svg" viewBox="0 0 64 64" aria-hidden="true">${headBuilder(tier, tk)}</svg>` };
    }

    const BOSS_SVG_BY_TYPE = {
        lava: '<polygon points="10,44 16,18 27,22 32,12 37,22 48,18 54,44 45,54 19,54" fill="#3A1D18" stroke="#180D0B" stroke-width="2"/><polygon points="16,18 9,8 22,15" fill="#7D2B1F" stroke="#180D0B" stroke-width="1.5"/><polygon points="48,18 55,8 42,15" fill="#7D2B1F" stroke="#180D0B" stroke-width="1.5"/><polygon points="21,26 32,20 43,26 45,42 32,50 19,42" fill="#542119"/><polygon points="25,31 32,27 39,31 36,42 32,46 28,42" fill="#C94A38"/><polygon points="28,33 32,30 36,33 32,40" fill="#E0B43C"/><polygon points="23,23 29,25 24,27" fill="#F4F1EA"/><polygon points="41,23 35,25 40,27" fill="#F4F1EA"/>',
        air: '<polygon points="11,34 22,16 42,16 53,34 45,49 19,49" fill="#233036" stroke="#12191C" stroke-width="2"/><rect x="7" y="26" width="9" height="15" rx="3" fill="#3E5059" stroke="#12191C" stroke-width="1.5"/><rect x="48" y="26" width="9" height="15" rx="3" fill="#3E5059" stroke="#12191C" stroke-width="1.5"/><polygon points="20,17 44,17 48,29 16,29" fill="#33424A"/><circle cx="32" cy="34" r="9.5" fill="#4A9EBF" stroke="#F4F1EA" stroke-width="1.5"/><circle cx="32" cy="34" r="4.5" fill="#F4F1EA"/><polygon points="26,46 32,54 38,46" fill="#E0B43C"/>',
        wood: '<polygon points="14,19 8,7 22,14 27,21" fill="#3D3126" stroke="#18130E" stroke-width="1.5"/><polygon points="50,19 56,7 42,14 37,21" fill="#3D3126" stroke="#18130E" stroke-width="1.5"/><polygon points="15,48 20,21 44,21 49,48 41,55 23,55" fill="#4B3B2D" stroke="#18130E" stroke-width="2"/><polygon points="19,21 32,12 45,21 38,28 26,28" fill="#2D5A3D" stroke="#132A1B" stroke-width="1.5"/><polygon points="27,34 32,29 37,34 34,43 30,43" fill="#D97724" stroke="#E0B43C" stroke-width="1.5"/><circle cx="25" cy="27" r="2.6" fill="#E0B43C"/><circle cx="39" cy="27" r="2.6" fill="#E0B43C"/>'
    };

    const MONSTER_SVG_BY_KEY = {
        mini: '<path d="M16 46 Q16 25 32 23 Q48 25 48 46 Q48 54 32 54 Q16 54 16 46 Z" fill="#488B5A" stroke="#1B3823" stroke-width="1.5"/><path d="M21 33 Q24 27 31 27" fill="none" stroke="#B7E4C7" stroke-width="2" stroke-linecap="round"/><circle cx="27" cy="40" r="2.4" fill="#1B211E"/><circle cx="37" cy="40" r="2.4" fill="#1B211E"/><circle cx="27.8" cy="39" r="0.9" fill="#F4F1EA"/><circle cx="37.8" cy="39" r="0.9" fill="#F4F1EA"/>',
        lava: '<polygon points="16,47 18,22 28,15 36,15 46,22 48,47 39,54 25,54" fill="#46201A" stroke="#1B0D0A" stroke-width="1.5"/><polygon points="21,23 32,17 43,23 41,34 23,34" fill="#7D2B1F"/><polygon points="27,32 32,27 37,32 35,44 29,44" fill="#C94A38"/><polygon points="30,33 34,33 32,40" fill="#E0B43C"/><rect x="23" y="25" width="5" height="3" rx="1" fill="#E0B43C"/><rect x="36" y="25" width="5" height="3" rx="1" fill="#E0B43C"/>',
        air: '<polygon points="10,36 22,28 42,28 54,36 42,46 22,46" fill="#2F6A82" stroke="#142C36" stroke-width="1.5"/><path d="M21 30 Q21 15 32 15 Q43 15 43 30 Z" fill="#4A9EBF" stroke="#142C36" stroke-width="1.5"/><ellipse cx="29" cy="21" rx="4" ry="2" fill="rgba(244,241,234,0.55)"/><circle cx="23" cy="37" r="2.2" fill="#E0B43C"/><circle cx="32" cy="37" r="2.2" fill="#E0B43C"/><circle cx="41" cy="37" r="2.2" fill="#E0B43C"/><polygon points="26,46 38,46 32,53" fill="#D97724"/>',
        hound: '<polygon points="12,41 24,25 22,12 31,21 40,12 39,24 52,32 45,42 42,53 33,44 24,53 20,43" fill="#357690" stroke="#142C36" stroke-width="1.5"/><polygon points="24,27 39,24 47,32 35,36 21,36" fill="rgba(244,241,234,0.28)"/><polygon points="8,36 17,32 15,40" fill="#82BDD4"/><circle cx="40" cy="29" r="2.2" fill="#E0B43C"/>',
        slime: '<path d="M12 45 Q13 17 32 16 Q51 17 52 45 Q51 54 32 54 Q13 54 12 45 Z" fill="#3B7A4D" stroke="#16301D" stroke-width="1.5"/><path d="M14 45 Q32 51 50 45 Q47 52 32 53 Q17 52 14 45 Z" fill="#2A5B38"/><path d="M19 28 Q23 20 31 20" fill="none" stroke="#B7E4C7" stroke-width="2" stroke-linecap="round"/><circle cx="25" cy="34" r="3" fill="#1B211E"/><circle cx="39" cy="34" r="3" fill="#1B211E"/><circle cx="26" cy="33" r="1.1" fill="#F4F1EA"/><circle cx="40" cy="33" r="1.1" fill="#F4F1EA"/>',
        golem: '<polygon points="11,45 14,19 24,14 40,14 50,19 53,45 45,54 19,54" fill="#46544C" stroke="#1B211E" stroke-width="2"/><polygon points="17,19 47,19 44,33 20,33" fill="#708077"/><polygon points="21,21 43,21 40,28 24,28" fill="rgba(244,241,234,0.28)"/><rect x="23" y="25" width="18" height="4.5" rx="2" fill="#1B211E"/><rect x="25" y="26.2" width="14" height="2.2" rx="1" fill="#D97724"/><circle cx="17" cy="24" r="1.8" fill="#B8C2BC"/><circle cx="47" cy="24" r="1.8" fill="#B8C2BC"/>',
        wood: '<polygon points="15,47 18,22 46,22 49,47 41,54 23,54" fill="#523C2B" stroke="#1E1711" stroke-width="1.5"/><polygon points="16,24 25,13 32,19 39,13 48,24 38,29 26,29" fill="#326B46" stroke="#142C1D" stroke-width="1.5"/><polygon points="23,35 32,31 41,35 37,46 27,46" fill="rgba(74,222,128,0.28)"/><circle cx="25" cy="31" r="2.2" fill="#E0B43C"/><circle cx="39" cy="31" r="2.2" fill="#E0B43C"/>'
    };

    /**
     * 參數化自動生成新怪物外觀（當 monster_data.js 或雲端後台新增條目時自動繪製幾何立體外觀）
     */
    function buildParametricMonsterSvg(monster) {
        const mCfg = getMonstersDict()[monster.typeKey] || {};
        const vis = mCfg.visual || {};
        const primary = vis.primaryColor || mCfg.color || '#6D4C41';
        const accent = vis.accentColor || '#E0B43C';
        return `<polygon points="14,46 18,20 32,13 46,20 50,46 41,54 23,54" fill="${primary}" stroke="#1B211E" stroke-width="1.6"/><polygon points="22,24 32,18 42,24 39,42 25,42" fill="rgba(244,241,234,0.18)"/><circle cx="25" cy="29" r="2.5" fill="${accent}"/><circle cx="39" cy="29" r="2.5" fill="${accent}"/><polygon points="28,37 36,37 32,45" fill="${accent}"/>`;
    }

    function createMonsterSvgHtml(monster) {
        let body = null;
        if (monster.isBoss) {
            body = BOSS_SVG_BY_TYPE[monster.typeKey] || buildParametricMonsterSvg(monster);
        } else if (monster.isSplitChild) {
            body = MONSTER_SVG_BY_KEY.mini;
        } else {
            body = MONSTER_SVG_BY_KEY[monster.typeKey] || buildParametricMonsterSvg(monster);
        }
        return `<svg class="m-svg" viewBox="0 0 64 64" aria-hidden="true"><ellipse cx="32" cy="57" rx="19" ry="5.5" fill="rgba(0,0,0,0.38)"/>${body}</svg>`;
    }

    // ==================== 棋盤量測與 HiDPI Canvas 2D 特效層 ====================
    function resizeFxCanvas() {
        if (!G || !G.dom) return;
        const { fxCanvasEl, fxCtx, boardStageEl } = G.dom;
        if (!fxCanvasEl || typeof fxCanvasEl.getContext !== 'function') return;
        const m = G.boardMetrics;
        const cssW = (boardStageEl && boardStageEl.clientWidth) || m.stageW || 560;
        const cssH = (boardStageEl && boardStageEl.clientHeight) || m.stageH || 380;
        m.stageW = cssW; m.stageH = cssH;

        const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) ? Math.min(2, window.devicePixelRatio) : 1;
        const tw = Math.round(cssW * dpr), th = Math.round(cssH * dpr);
        if (fxCanvasEl.width !== tw || fxCanvasEl.height !== th) { fxCanvasEl.width = tw; fxCanvasEl.height = th; }
        if (fxCtx && typeof fxCtx.setTransform === 'function') {
            fxCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
            fxCtx.font = '600 12px "Plus Jakarta Sans", "Noto Sans TC", sans-serif';
        }
    }

    function measureBoardMetrics() {
        if (!G || !G.dom) return;
        const cells = G.dom.boardElement ? G.dom.boardElement.children : null;
        const cols = CONFIG.BOARD_COLS || 15;
        if (!cells || cells.length < cols + 1) return;
        const c0 = cells[0], c1 = cells[1], cBelow = cells[cols], m = G.boardMetrics;
        m.originX = c0.offsetLeft; m.originY = c0.offsetTop;
        m.cellW = c0.offsetWidth || 34; m.cellH = c0.offsetHeight || 34;
        m.stepX = (c1.offsetLeft - c0.offsetLeft) || (m.cellW + 3);
        m.stepY = (cBelow.offsetTop - c0.offsetTop) || (m.cellH + 3);
        m.step = (m.stepX + m.stepY) / 2;
        resizeFxCanvas();
    }

    function getCellCenter(gridX, gridY) {
        const m = G.boardMetrics;
        return { left: m.originX + gridX * m.stepX + m.cellW / 2, top: m.originY + gridY * m.stepY + m.cellH / 2 };
    }

    function clearCanvasFXState() {
        if (!G) return;
        const fx = G.fxEntities;
        fx.projectiles.length = fx.bolts.length = fx.beams.length = fx.rings.length = fx.particles.length = fx.flashes.length = fx.leaves.length = 0;
        fx.leafEmitAccMs = 0; fx.frenzyFxAccMs = 0;
        const { fxCtx, fxCanvasEl } = G.dom;
        if (fxCtx && fxCanvasEl) fxCtx.clearRect(0, 0, fxCanvasEl.width || G.boardMetrics.stageW, fxCanvasEl.height || G.boardMetrics.stageH);
    }

    function emitParticleBurst(x, y, color, count = 8, speedMax = 85) {
        for (let i = 0; i < count; i++) {
            const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
            const speed = speedMax * (0.45 + Math.random() * 0.55);
            G.fxEntities.particles.push({
                x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
                radius: 1.8 + Math.random() * 2.0, color, ageMs: 0, durationMs: 240 + Math.random() * 120
            });
        }
    }

    function emitHitFlash(x, y, color = '#ffffff') {
        G.fxEntities.flashes.push({ x, y, color, radius: Math.max(8, G.boardMetrics.cellW * 0.42), ageMs: 0, durationMs: 95 });
    }

    function emitRingFX(x, y, maxRadius, color, fillAlpha, durationMs) {
        G.fxEntities.rings.push({ x, y, maxRadius, color, fillAlpha, ageMs: 0, durationMs });
    }

    function spawnDamageNumber(amount, isWeakness, px, py, tagPrefix = '') {
        const layer = G.dom.floatingLayerEl;
        if (!layer) return;
        const dmgEl = document.createElement('div');
        dmgEl.classList.add('floating-dmg', isWeakness ? 'weakness' : 'normal');
        dmgEl.innerText = isWeakness ? `WEAK! -${amount}` : `${tagPrefix}-${amount}`;
        dmgEl.style.left = `${px + (Math.random() - 0.5) * 18}px`;
        dmgEl.style.top = `${py - 18 + (Math.random() - 0.5) * 8}px`;
        const durationMs = Math.round(720 / Math.max(1, clampNumber(G.state.gameSpeed, 1, 5, 1) * 0.75));
        dmgEl.style.animationDuration = `${durationMs}ms`;
        layer.appendChild(dmgEl);
        G.callbacks.scheduleTimeout(() => dmgEl.remove(), durationMs);
    }

    function emitCanvasAttackFX(fxType, fromPos, toPos, options = {}) {
        const sx = fromPos.left, sy = fromPos.top, ex = toPos.left, ey = toPos.top;
        const fx = G.fxEntities;
        const tk = getThemeTokens();
        const tCfg = getTowersDict()[fxType];
        const style = (tCfg && tCfg.attackStyle) || fxType;

        if (fxType === 'thunder' || fxType === 'magnet-arc' || style === 'chain_lightning' || style === 'stun_pulse') {
            const isMagnet = fxType === 'magnet-arc' || style === 'stun_pulse';
            const jitter = isMagnet ? 10 : 13;
            const pts = [{ x: sx, y: sy }];
            for (let s = 1; s < 4; s++) {
                const t = s / 4;
                pts.push({ x: sx + (ex - sx) * t + (Math.random() - 0.5) * jitter * 2, y: sy + (ey - sy) * t + (Math.random() - 0.5) * jitter * 2 });
            }
            pts.push({ x: ex, y: ey });
            const boltColor = isMagnet ? tk.elIce : ((tCfg && tCfg.color) || tk.elLightning);
            fx.bolts.push({ points: pts, color: boltColor, coreColor: tk.textPrimary, width: isMagnet ? 1.8 : (options.isLv3 ? 2.2 : 1.8), ageMs: 0, durationMs: 210 });
            emitParticleBurst(ex, ey, boltColor, 6, 75);
            emitHitFlash(ex, ey, tk.textPrimary);
            if (options.frostRadiusPx > 0) emitRingFX(ex, ey, options.frostRadiusPx, tk.elIce, 0.20, 280);
            return;
        }
        if (fxType === 'plasma' || style === 'pierce_beam') {
            const stacks = options.stacks || 0;
            const beamColor = stacks >= 4 ? tk.accentCta : ((tCfg && tCfg.color) || tk.elLightning);
            fx.beams.push({ x1: sx, y1: sy, x2: ex, y2: ey, width: 1.8 + stacks * 0.5, color: beamColor, coreColor: tk.textPrimary, ageMs: 0, durationMs: 185 });
            emitParticleBurst(ex, ey, stacks >= 4 ? tk.elFire : beamColor, 5 + stacks, 70);
            emitHitFlash(ex, ey, beamColor);
            return;
        }
        const coreColor = ({ fire: tk.elFire, ice: tk.elIce, steam: tk.accentCta })[fxType] || (tCfg && tCfg.color) || tk.textPrimary;
        fx.projectiles.push({ fxType, x1: sx, y1: sy, x2: ex, y2: ey, color: coreColor, radius: style === 'burst_armor_break' ? 4.2 : (style === 'aoe_mist' ? 4.6 : 3.6), ageMs: 0, durationMs: 135 });
        const ringRadius = options.splashRadiusPx || options.frostRadiusPx || 0;
        if (ringRadius > 0) emitRingFX(ex, ey, ringRadius, style === 'slow_control' || style === 'aoe_mist' ? tk.elIce : coreColor, 0.22, 280);
        emitParticleBurst(ex, ey, coreColor, ringRadius > 0 ? 11 : 7, ringRadius > 0 ? 105 : 70);
        emitHitFlash(ex, ey, tk.textPrimary);
    }

    function advanceFxPool(arr, dtMs, stepFn = null) {
        for (let i = arr.length - 1; i >= 0; i--) {
            const item = arr[i];
            item.ageMs += dtMs;
            if (stepFn) stepFn(item);
            if (item.ageMs >= item.durationMs) arr.splice(i, 1);
        }
    }

    function strokeLine2D(ctx, x1, y1, x2, y2, color, width, alpha) {
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
    }

    function fillCircle2D(ctx, x, y, radius, color, alpha) {
        ctx.globalAlpha = alpha;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
    }

    function updateAndRenderCanvasFX(dtMs) {
        const dtSec = dtMs / 1000, fx = G.fxEntities, st = G.state, m = G.boardMetrics, tk = getThemeTokens();
        const treeCfg = (GameApp.data && GameApp.data.tree && GameApp.data.tree.TREE_CONFIG) || {};
        const healthyMin = treeCfg.WORLD_TREE_HEALTHY_MIN || 14;

        if (G.callbacks.isGameplayActive() && st.baseHp >= healthyMin && G.map.waypoints.length > 0) {
            fx.leafEmitAccMs += dtMs;
            while (fx.leafEmitAccMs >= 420) {
                fx.leafEmitAccMs -= 420;
                const treeWp = G.map.waypoints[G.map.waypoints.length - 1];
                const tp = getCellCenter(treeWp.x, treeWp.y);
                fx.leaves.push({
                    x: tp.left + (Math.random() - 0.5) * m.cellW * 0.65, y: tp.top + (Math.random() - 0.5) * m.cellH * 0.45,
                    vx: -10 - Math.random() * 14, vy: -16 - Math.random() * 16, swayPhase: Math.random() * Math.PI * 2,
                    size: 3.0 + Math.random() * 2.2, color: Math.random() < 0.5 ? '#4E9A68' : '#74B88A',
                    ageMs: 0, durationMs: 1400 + Math.random() * 700
                });
            }
        }
        if (G.callbacks.isGameplayActive() && st.frenzyActiveMs > 0) {
            fx.frenzyFxAccMs += dtMs;
            while (fx.frenzyFxAccMs >= 200) {
                fx.frenzyFxAccMs -= 200;
                for (let idx = 0; idx < st.board.length; idx++) {
                    if (!st.board[idx] || Math.random() > 0.48) continue;
                    const c = indexToCoords(idx), pos = getCellCenter(c.x, c.y);
                    fx.particles.push({
                        x: pos.left + (Math.random() - 0.5) * m.cellW * 0.55, y: pos.top + (Math.random() - 0.2) * m.cellH * 0.4,
                        vx: (Math.random() - 0.5) * 14, vy: -24 - Math.random() * 18, radius: 1.7 + Math.random() * 1.4,
                        color: Math.random() < 0.5 ? tk.elLightning : tk.accentCta, ageMs: 0, durationMs: 420 + Math.random() * 180
                    });
                }
            }
        }

        advanceFxPool(fx.projectiles, dtMs);
        advanceFxPool(fx.bolts, dtMs);
        advanceFxPool(fx.beams, dtMs);
        advanceFxPool(fx.rings, dtMs);
        advanceFxPool(fx.flashes, dtMs);
        advanceFxPool(fx.particles, dtMs, p => { p.x += p.vx * dtSec; p.y += p.vy * dtSec; p.vx *= 0.92; p.vy *= 0.92; });
        advanceFxPool(fx.leaves, dtMs, lf => { lf.x += (lf.vx + Math.sin(lf.ageMs * 0.006 + lf.swayPhase) * 9) * dtSec; lf.y += lf.vy * dtSec; });

        const { fxCtx, fxCanvasEl } = G.dom;
        if (!fxCtx || !fxCanvasEl) return;
        fxCtx.clearRect(0, 0, m.stageW, m.stageH);

        for (let i = 0; i < fx.rings.length; i++) {
            const r = fx.rings[i], p = Math.min(1, r.ageMs / r.durationMs), rad = Math.max(4, r.maxRadius * (0.35 + 0.65 * p)), alpha = 1 - p;
            fxCtx.save();
            fillCircle2D(fxCtx, r.x, r.y, rad, r.color, alpha * r.fillAlpha);
            fxCtx.globalAlpha = alpha * 0.85; fxCtx.strokeStyle = r.color; fxCtx.lineWidth = 1.5;
            fxCtx.beginPath(); fxCtx.arc(r.x, r.y, rad, 0, Math.PI * 2); fxCtx.stroke();
            fxCtx.restore();
        }
        for (let i = 0; i < fx.projectiles.length; i++) {
            const pr = fx.projectiles[i], p = Math.min(1, pr.ageMs / pr.durationMs), tp = Math.max(0, p - 0.35);
            const cx = pr.x1 + (pr.x2 - pr.x1) * p, cy = pr.y1 + (pr.y2 - pr.y1) * p;
            fxCtx.save(); fxCtx.lineCap = 'round';
            strokeLine2D(fxCtx, pr.x1 + (pr.x2 - pr.x1) * tp, pr.y1 + (pr.y2 - pr.y1) * tp, cx, cy, pr.color, pr.radius, 1 - p * 0.25);
            fillCircle2D(fxCtx, cx, cy, pr.radius * 0.7, tk.textPrimary, 1 - p * 0.25);
            fxCtx.restore();
        }
        for (let i = 0; i < fx.beams.length; i++) {
            const b = fx.beams[i], a = 1 - Math.min(1, b.ageMs / b.durationMs);
            fxCtx.save(); fxCtx.lineCap = 'round';
            strokeLine2D(fxCtx, b.x1, b.y1, b.x2, b.y2, b.color, b.width * 2, a * 0.65);
            strokeLine2D(fxCtx, b.x1, b.y1, b.x2, b.y2, b.coreColor, Math.max(1.5, b.width * 0.75), a);
            fxCtx.restore();
        }
        for (let i = 0; i < fx.bolts.length; i++) {
            const bl = fx.bolts[i], a = 1 - Math.min(1, bl.ageMs / bl.durationMs);
            if (bl.points.length < 2) continue;
            fxCtx.save(); fxCtx.lineCap = 'round'; fxCtx.lineJoin = 'round';
            const trace = (color, w, alpha) => {
                fxCtx.globalAlpha = alpha; fxCtx.strokeStyle = color; fxCtx.lineWidth = w;
                fxCtx.beginPath(); fxCtx.moveTo(bl.points[0].x, bl.points[0].y);
                for (let k = 1; k < bl.points.length; k++) fxCtx.lineTo(bl.points[k].x, bl.points[k].y);
                fxCtx.stroke();
            };
            trace(bl.color, Math.max(2, bl.width * 1.8), a * 0.65);
            trace(bl.coreColor, 1.5, a);
            fxCtx.restore();
        }
        for (let i = 0; i < fx.particles.length; i++) {
            const pt = fx.particles[i], a = 1 - Math.min(1, pt.ageMs / pt.durationMs);
            fxCtx.save(); fillCircle2D(fxCtx, pt.x, pt.y, pt.radius * a, pt.color, a); fxCtx.restore();
        }
        for (let i = 0; i < fx.flashes.length; i++) {
            const fl = fx.flashes[i], a = (1 - Math.min(1, fl.ageMs / fl.durationMs)) * 0.6;
            fxCtx.save(); fillCircle2D(fxCtx, fl.x, fl.y, fl.radius, fl.color, a); fxCtx.restore();
        }
        for (let i = 0; i < fx.leaves.length; i++) {
            const lf = fx.leaves[i], p = Math.min(1, lf.ageMs / lf.durationMs), alpha = Math.sin(p * Math.PI) * 0.85;
            if (alpha <= 0.01) continue;
            fxCtx.save(); fxCtx.globalAlpha = alpha; fxCtx.fillStyle = lf.color;
            fxCtx.translate(lf.x, lf.y); fxCtx.rotate(lf.swayPhase + p * 2.2);
            fxCtx.beginPath(); fxCtx.ellipse(0, 0, lf.size, lf.size * 0.52, 0, 0, Math.PI * 2); fxCtx.fill(); fxCtx.restore();
        }
        for (let i = 0; i < st.monsters.length; i++) {
            const mon = st.monsters[i];
            if ((mon.rootTimer || 0) <= 0) continue;
            fxCtx.save(); fxCtx.strokeStyle = 'rgba(78, 154, 104, 0.85)'; fxCtx.lineWidth = 2; fxCtx.setLineDash([4, 3]);
            fxCtx.beginPath(); fxCtx.arc(mon.pixelX, mon.pixelY + 4, Math.max(12, m.cellW * 0.42), 0, Math.PI * 2); fxCtx.stroke(); fxCtx.restore();
        }
    }

    // ==================== 砲塔 / 怪物 / 棋盤 DOM 渲染與快取 ====================
    function updateTowerAimVisual(towerIndex, towerObj, towerPos, targetPos) {
        if (!towerObj || !towerPos || !targetPos) return;
        const dx = targetPos.left - towerPos.left, dy = targetPos.top - towerPos.top;
        if (dx === 0 && dy === 0) return;
        const angleDeg = Math.round((Math.atan2(dy, dx) * 180 / Math.PI) + 90);
        towerObj.aimAngleDeg = angleDeg;

        const towerEl = G.towerElements[towerIndex];
        if (!towerEl) return;
        const rotator = towerEl._rotator || towerEl.querySelector('.tower-head-rotator');
        if (rotator) rotator.style.transform = `rotate(${angleDeg}deg)`;
        const recoilEl = towerEl._recoilEl || towerEl.querySelector('.tower-head-recoil');
        if (recoilEl) {
            const useB = recoilEl.classList.contains('recoil-a');
            recoilEl.classList.remove('recoil-a', 'recoil-b');
            recoilEl.classList.add(useB ? 'recoil-b' : 'recoil-a');
        }
    }

    function createMonsterDom(monster) {
        const el = document.createElement('div');
        el.classList.add('monster-unit');
        if (monster.isElite) el.classList.add('elite');
        if (monster.isBoss) el.classList.add('boss');
        if (monster.isSplitChild) el.classList.add('mini-slime');

        const armorHtml = monster.armor > 0 ? `<span class="m-armor-badge num">甲 ${monster.armor}</span>` : '';
        const weakCfg = getTowersDict()[monster.weakness];
        const weakShort = weakCfg ? `${weakCfg.icon}${weakCfg.name.charAt(0)}` : (monster.weakness || '');
        const bossHtml = monster.isBoss ? `<span class="m-boss-badge weak-${monster.weakness}">王·弱${weakShort}</span>` : '';
        el.innerHTML = `<span class="m-slow-badge">❄️</span>${armorHtml}<span class="m-icon">${createMonsterSvgHtml(monster)}</span><div class="m-hp-bar"><div class="m-hp-fill"></div></div>${bossHtml}`;
        G.dom.monsterLayerEl.appendChild(el);
        const rec = { el, hpFillEl: el.querySelector('.m-hp-fill'), armorBadgeEl: el.querySelector('.m-armor-badge') };
        G.monsterDomMap.set(monster.id, rec);
        return rec;
    }

    function removeMonsterDom(monsterId) {
        const rec = G.monsterDomMap.get(monsterId);
        if (rec) { rec.el.remove(); G.monsterDomMap.delete(monsterId); }
    }

    function renderMonsterLayer() {
        if (!G || !G.dom || !G.dom.monsterLayerEl) return;
        const monsters = G.state.monsters;
        const activeIds = new Set();
        for (let i = 0; i < monsters.length; i++) activeIds.add(monsters[i].id);
        for (const [id, rec] of G.monsterDomMap.entries()) {
            if (!activeIds.has(id)) { rec.el.remove(); G.monsterDomMap.delete(id); }
        }

        const MonsterSys = GameApp.systems && GameApp.systems.monster;
        for (let i = 0; i < monsters.length; i++) {
            const m = monsters[i];
            const rec = G.monsterDomMap.get(m.id) || createMonsterDom(m);
            rec.el.style.left = `${m.pixelX}px`;
            rec.el.style.top = `${m.pixelY}px`;
            rec.el.classList.toggle('slowed', m.slowTimer > 0);
            rec.el.classList.toggle('rooted', (m.rootTimer || 0) > 0);
            if (m.armor > 0 && rec.armorBadgeEl) {
                const isShredded = m.armorShredTimer > 0;
                rec.armorBadgeEl.classList.toggle('shredded', isShredded);
                const effArmor = MonsterSys ? MonsterSys.getMonsterEffectiveArmor(m) : m.armor;
                rec.armorBadgeEl.innerText = isShredded ? `🔥${Math.round(effArmor)}` : `甲 ${m.armor}`;
            }
            const hpPct = Math.max(0, (m.hp / m.maxHp) * 100);
            if (rec.hpFillEl) {
                rec.hpFillEl.style.width = `${hpPct}%`;
                rec.hpFillEl.style.backgroundColor = hpPct <= 25 ? '#C94A38' : (hpPct <= 55 ? '#D97724' : '#4E9A68');
            }
        }
        G.callbacks.updateBossStatusBar();
    }

    function repositionAllMonsters() {
        if (!G || !G.state) return;
        for (let i = 0; i < G.state.monsters.length; i++) {
            const m = G.state.monsters[i], pos = getCellCenter(m.gridX, m.gridY);
            m.pixelX = pos.left + (m.visualOffsetX || 0);
            m.pixelY = pos.top + (m.visualOffsetY || 0);
        }
        renderMonsterLayer();
    }

    function clearCellDragHighlights() {
        if (!G || !G.cellElements) return;
        for (let i = 0; i < G.cellElements.length; i++) {
            G.cellElements[i].classList.remove('drag-over', 'drag-valid-build', 'drag-invalid');
        }
    }

    function clearTouchDragVisuals() {
        if (GameApp.systems && GameApp.systems.drag && typeof GameApp.systems.drag.cancelActiveDrag === 'function') {
            GameApp.systems.drag.cancelActiveDrag({ silent: true });
        }
        clearCellDragHighlights();
        if (G && G.towerElements) {
            for (let i = 0; i < G.towerElements.length; i++) {
                if (G.towerElements[i]) G.towerElements[i].classList.remove('dragging');
            }
        }
    }

    function createTowerElement(towerObj, index) {
        const st = G.state;
        const tower = document.createElement('div');
        tower.classList.add('tower', `type-${towerObj.type}`, `lv-${towerObj.tier}`);
        tower.dataset.towerIndex = String(index);
        if (st.frenzyActiveMs > 0) tower.classList.add('frenzy-active');

        const { baseSvgHtml, headSvgHtml } = createTowerSvgParts(towerObj.type, towerObj.tier);
        const baseLayer = document.createElement('div'); baseLayer.classList.add('tower-base-layer'); baseLayer.innerHTML = baseSvgHtml;
        const headRotator = document.createElement('div'); headRotator.classList.add('tower-head-rotator'); headRotator.style.transform = `rotate(${towerObj.aimAngleDeg || 0}deg)`;
        const headRecoil = document.createElement('div'); headRecoil.classList.add('tower-head-recoil'); headRecoil.innerHTML = headSvgHtml;
        headRotator.appendChild(headRecoil);
        const name = document.createElement('div'); name.classList.add('tower-name'); name.innerText = getTierStars(towerObj.tier);

        tower._rotator = headRotator;
        tower._recoilEl = headRecoil;
        tower.appendChild(baseLayer); tower.appendChild(headRotator); tower.appendChild(name);

        if (GameApp.systems && GameApp.systems.drag && typeof GameApp.systems.drag.bindBoardTowerElement === 'function') {
            GameApp.systems.drag.bindBoardTowerElement(tower, index, towerObj);
        }
        return tower;
    }

    function renderCellTower(index) {
        const cell = G.cellElements[index];
        if (!cell) return;
        if (G.towerElements[index]) { G.towerElements[index].remove(); G.towerElements[index] = null; }
        const towerObj = G.state.board[index];
        if (towerObj !== null) {
            const el = createTowerElement(towerObj, index);
            G.towerElements[index] = el;
            cell.appendChild(el);
        }
    }

    const TERRAIN_SVG_BY_TYPE = {
        highground: '<svg class="terrain-svg" viewBox="0 0 64 64" aria-hidden="true"><defs><pattern id="hgHatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><line x1="0" y1="0" x2="0" y2="8" stroke="rgba(224,180,60,0.16)" stroke-width="1.5"/></pattern></defs><rect x="2" y="2" width="60" height="60" rx="4" fill="url(#hgHatch)"/><polygon points="12,50 25,20 35,34 45,16 52,50" fill="rgba(224,180,60,0.10)" stroke="rgba(224,180,60,0.38)" stroke-width="1.5" stroke-linejoin="round"/><polyline points="18,44 27,28 35,38 43,25 48,44" fill="none" stroke="rgba(244,241,234,0.20)" stroke-width="1.5" stroke-linejoin="round"/></svg>',
        mana_vein: '<svg class="terrain-svg" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="22" fill="rgba(74,158,191,0.08)" stroke="rgba(74,158,191,0.38)" stroke-width="1.5" stroke-dasharray="5 3"/><circle cx="32" cy="32" r="14" fill="none" stroke="rgba(74,158,191,0.42)" stroke-width="1.5"/><polygon points="32,14 46,32 32,50 18,32" fill="rgba(74,158,191,0.10)" stroke="rgba(184,194,188,0.36)" stroke-width="1.5"/><circle cx="32" cy="32" r="4" fill="rgba(74,158,191,0.45)"/></svg>',
        world_tree: '<svg class="terrain-svg" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="22" fill="rgba(78,154,104,0.08)" stroke="rgba(78,154,104,0.36)" stroke-width="1.5"/><path d="M32 12 C43 20 47 32 32 52 C17 32 21 20 32 12 Z" fill="rgba(78,154,104,0.12)" stroke="rgba(184,194,188,0.38)" stroke-width="1.5"/><line x1="32" y1="16" x2="32" y2="50" stroke="rgba(184,194,188,0.36)" stroke-width="1.5"/><path d="M32 25 L40 20 M32 33 L41 28 M32 25 L24 20 M32 33 L23 28" stroke="rgba(184,194,188,0.32)" stroke-width="1.5" stroke-linecap="round"/></svg>',
        obstacle: '<svg class="terrain-svg" viewBox="0 0 64 64" aria-hidden="true"><polygon points="10,48 18,22 33,16 48,24 54,48 40,54 20,54" fill="rgba(70,84,76,0.55)" stroke="rgba(184,194,188,0.45)" stroke-width="1.5"/><polyline points="18,22 31,34 48,24" fill="none" stroke="rgba(244,241,234,0.22)" stroke-width="1.5"/></svg>'
    };

    const PATH_ARROW_SVG = '<svg class="path-arrow-svg" viewBox="0 0 16 16" aria-hidden="true"><polyline points="6,3 11,8 6,13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    const START_CELL_SVG = '<svg class="cell-marker-svg" viewBox="0 0 32 32" aria-hidden="true"><path d="M8 26 V12 A8 8 0 0 1 24 12 V26" fill="rgba(244,241,234,0.12)" stroke="#B8C2BC" stroke-width="1.8"/><line x1="6" y1="26" x2="26" y2="26" stroke="#B8C2BC" stroke-width="1.8" stroke-linecap="round"/><polyline points="13,13 18,17 13,21" fill="none" stroke="#F4F1EA" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    const TREE_CELL_SVG = '<svg class="cell-marker-svg" viewBox="0 0 32 32" aria-hidden="true"><path d="M16 5 C23 11 25 18 16 24 C7 18 9 11 16 5 Z" fill="rgba(78,154,104,0.42)" stroke="#B8C2BC" stroke-width="1.6"/><rect x="14" y="22" width="4" height="6" rx="1" fill="#8C6A4A"/></svg>';

    function initBoard() {
        const boardEl = G.dom.boardElement, st = G.state, map = G.map;
        const boardSize = CONFIG.BOARD_SIZE || 150;
        const terrainsDict = getTerrainsDict();
        boardEl.innerHTML = ''; G.cellElements.length = 0; G.towerElements.fill(null);
        st.lastRenderedSelected = null; st.lastRenderedBuildTarget = null;

        for (let index = 0; index < boardSize; index++) {
            const cell = document.createElement('div');
            cell.classList.add('cell');
            cell.dataset.index = index;
            if (map.pathCellIndices.has(index)) {
                cell.classList.add('path-cell');
                if (index === map.startCellIndex) {
                    cell.classList.add('path-start');
                    const marker = document.createElement('span');
                    marker.classList.add('cell-marker');
                    marker.innerHTML = START_CELL_SVG;
                    cell.appendChild(marker);
                } else if (index === map.endCellIndex) {
                    cell.classList.add('path-end');
                    const marker = document.createElement('span');
                    marker.classList.add('cell-marker');
                    marker.innerHTML = TREE_CELL_SVG;
                    cell.appendChild(marker);
                } else if (map.pathFlowArrows.has(index)) {
                    const arrow = document.createElement('span');
                    arrow.classList.add('path-arrow');
                    arrow.style.transform = `rotate(${map.pathFlowArrows.get(index)}deg)`;
                    arrow.innerHTML = PATH_ARROW_SVG;
                    cell.appendChild(arrow);
                }
            } else {
                const terrain = map.terrainMap.get(index) || null;
                if (terrain && terrainsDict[terrain]) {
                    const tCfg = terrainsDict[terrain];
                    cell.classList.add(`terrain-${terrain}`);
                    if (tCfg.buildable === false) cell.classList.add('obstacle-cell');
                    if (tCfg.tooltip) cell.setAttribute('title', tCfg.tooltip);
                    const art = document.createElement('div');
                    art.classList.add('terrain-art');
                    art.setAttribute('aria-hidden', 'true');
                    art.innerHTML = TERRAIN_SVG_BY_TYPE[terrain] || '';
                    cell.appendChild(art);
                }
            }
            cell.addEventListener('mouseenter', () => {
                if (!st.isTouchMode && st.hoveredIndex !== index) {
                    st.hoveredIndex = index;
                    updateRangeIndicator();
                }
            });
            cell.addEventListener('mouseleave', () => {
                if (!st.isTouchMode && st.hoveredIndex === index) {
                    st.hoveredIndex = null;
                    updateRangeIndicator();
                }
            });
            if (GameApp.systems && GameApp.systems.drag && typeof GameApp.systems.drag.bindBoardCellElement === 'function') {
                GameApp.systems.drag.bindBoardCellElement(cell, index);
            }
            cell.addEventListener('click', () => {
                if (performance.now() - (st.lastTouchDragEndTime || 0) >= 220) {
                    G.callbacks.handleCellClick(index);
                }
            });
            G.cellElements.push(cell);
            boardEl.appendChild(cell);
        }
        measureBoardMetrics();
    }

    function renderBoard(dirtyIndices = null) {
        const boardEl = G.dom.boardElement, st = G.state, cells = G.cellElements;
        const boardSize = CONFIG.BOARD_SIZE || 150;
        if (cells.length !== boardSize || boardEl.children.length !== boardSize) initBoard();

        if (st.lastRenderedSelected !== null && st.lastRenderedSelected !== st.selectedIndex && cells[st.lastRenderedSelected]) cells[st.lastRenderedSelected].classList.remove('selected');
        if (st.selectedIndex !== null && cells[st.selectedIndex]) cells[st.selectedIndex].classList.add('selected');
        st.lastRenderedSelected = st.selectedIndex;
        if (st.lastRenderedBuildTarget !== null && st.lastRenderedBuildTarget !== st.buildTargetIndex && cells[st.lastRenderedBuildTarget]) cells[st.lastRenderedBuildTarget].classList.remove('build-target');
        if (st.buildTargetIndex !== null && cells[st.buildTargetIndex]) cells[st.buildTargetIndex].classList.add('build-target');
        st.lastRenderedBuildTarget = st.buildTargetIndex;

        if (Array.isArray(dirtyIndices)) {
            const visited = new Set();
            for (let i = 0; i < dirtyIndices.length; i++) {
                const idx = dirtyIndices[i];
                if (idx >= 0 && idx < boardSize && !visited.has(idx)) { visited.add(idx); renderCellTower(idx); }
            }
        } else {
            for (let idx = 0; idx < boardSize; idx++) renderCellTower(idx);
            measureBoardMetrics();
        }
        updateRangeIndicator();
        G.callbacks.updateTowerInspector();
    }

    function updateTerrainTooltip() {
        const tipEl = G.dom.terrainTooltipEl, st = G.state;
        if (!tipEl) return;
        const isDraggingNow = GameApp.systems && GameApp.systems.drag && GameApp.systems.drag.isDragging();
        if (st.isGameOver || st.waveState === 'WAITING_START' || st.waveState === 'VICTORY'
            || st.waveState === 'BLESSING_SELECT' || isDraggingNow) {
            tipEl.classList.add('hidden');
            return;
        }
        const idx = (!st.isTouchMode && st.hoveredIndex !== null)
            ? st.hoveredIndex
            : (st.buildTargetIndex !== null ? st.buildTargetIndex : st.selectedIndex);
        const terrainKey = idx !== null ? G.map.terrainMap.get(idx) : null;
        const tCfg = terrainKey ? getTerrainsDict()[terrainKey] : null;
        if (!tCfg || !tCfg.shortTag) {
            tipEl.classList.add('hidden');
            return;
        }
        const coords = indexToCoords(idx), center = getCellCenter(coords.x, coords.y), m = G.boardMetrics;
        const clampedX = Math.max(76, Math.min((m.stageW || 600) - 76, center.left));
        const topPx = coords.y <= 1 ? (center.top + m.cellH * 0.65) : (center.top - m.cellH * 0.72);
        tipEl.innerText = `${tCfg.name} · ${tCfg.shortTag}`;
        tipEl.style.left = `${clampedX}px`;
        tipEl.style.top = `${topPx}px`;
        tipEl.classList.remove('hidden');
    }

    /**
     * 顯示拖曳期間的即時射程預覽圈（支援商店拖拉指定召喚與棋盤拖拉移塔）
     */
    function showDragRangePreview(leftPx, topPx, radiusPx, towerType) {
        const el = G && G.dom && G.dom.rangeCircleEl;
        if (!el) return;
        el.style.left = `${leftPx}px`;
        el.style.top = `${topPx}px`;
        el.style.width = `${radiusPx * 2}px`;
        el.style.height = `${radiusPx * 2}px`;
        el.className = `visible range-${towerType || 'fire'}`;
    }

    function updateRangeIndicator() {
        const el = G.dom.rangeCircleEl, st = G.state;
        updateTerrainTooltip();
        if (!el) return;
        const isDraggingNow = GameApp.systems && GameApp.systems.drag && GameApp.systems.drag.isDragging();
        if (isDraggingNow) return;
        if (st.isGameOver || st.waveState === 'WAITING_START' || st.waveState === 'VICTORY'
            || st.waveState === 'BLESSING_SELECT') {
            el.className = '';
            return;
        }
        const targetIdx = (!st.isTouchMode && st.hoveredIndex !== null && st.board[st.hoveredIndex] !== null)
            ? st.hoveredIndex : ((st.selectedIndex !== null && st.board[st.selectedIndex] !== null) ? st.selectedIndex : null);
        if (targetIdx === null) { el.className = ''; return; }

        const towerObj = st.board[targetIdx], coords = indexToCoords(targetIdx), center = getCellCenter(coords.x, coords.y);
        const AttackSys = GameApp.systems && GameApp.systems.towerAttack;
        const radiusPx = AttackSys ? AttackSys.getTowerRangePx(towerObj, targetIdx) : (2.0 * G.boardMetrics.step);
        el.style.left = `${center.left}px`; el.style.top = `${center.top}px`;
        el.style.width = `${radiusPx * 2}px`; el.style.height = `${radiusPx * 2}px`;
        el.className = `visible range-${towerObj.type}`;
    }

    function updateWorldTreeVisualState() {
        const st = G.state, treeCell = G.cellElements[G.map.endCellIndex], hpHudEl = G.dom.hpHudEl;
        const treeCfg = (GameApp.data && GameApp.data.tree && GameApp.data.tree.TREE_CONFIG) || {};
        const healthyMin = treeCfg.WORLD_TREE_HEALTHY_MIN || 14;
        const warningMin = treeCfg.WORLD_TREE_WARNING_MIN || 7;
        const isHealthy = st.baseHp >= healthyMin, isWarn = st.baseHp >= warningMin;
        const stateClass = isHealthy ? 'tree-healthy' : (isWarn ? 'tree-warning' : 'tree-critical');
        const hudClass = isHealthy ? '' : (isWarn ? 'hp-warning' : 'hp-critical');
        if (treeCell) { treeCell.classList.remove('tree-healthy', 'tree-warning', 'tree-critical'); treeCell.classList.add(stateClass); }
        if (hpHudEl) { hpHudEl.classList.remove('hp-warning', 'hp-critical'); if (hudClass) hpHudEl.classList.add(hudClass); }
    }

    function triggerWorldTreeShake() {
        const stage = G.dom.boardStageEl, st = G.state;
        if (!stage) return;
        stage.classList.remove('tree-hit-shake');
        void stage.offsetWidth;
        stage.classList.add('tree-hit-shake');
        if (st.treeHitShakeTimer) clearTimeout(st.treeHitShakeTimer);
        st.treeHitShakeTimer = G.callbacks.scheduleTimeout(() => {
            if (G.dom.boardStageEl) G.dom.boardStageEl.classList.remove('tree-hit-shake');
            st.treeHitShakeTimer = null;
        }, 300);
    }

    const RendererModule = {
        bind,
        getTierStars,
        createTowerSvgParts,
        createMonsterSvgHtml,
        resizeFxCanvas,
        measureBoardMetrics,
        getCellCenter,
        clearCanvasFXState,
        emitParticleBurst,
        emitHitFlash,
        emitRingFX,
        spawnDamageNumber,
        emitCanvasAttackFX,
        updateAndRenderCanvasFX,
        updateTowerAimVisual,
        createMonsterDom,
        removeMonsterDom,
        renderMonsterLayer,
        repositionAllMonsters,
        clearCellDragHighlights,
        clearTouchDragVisuals,
        createTowerElement,
        renderCellTower,
        initBoard,
        renderBoard,
        showDragRangePreview,
        updateRangeIndicator,
        updateWorldTreeVisualState,
        triggerWorldTreeShake
    };

    GameApp.core = GameApp.core || {};
    GameApp.core.renderer = RendererModule;
    GameApp.renderer = RendererModule;
    global.GameRenderer = RendererModule;
})(window);
