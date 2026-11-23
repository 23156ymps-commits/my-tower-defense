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
        return (GameApp.data && GameApp.data.evolutions && GameApp.data.evolutions.MAX_TIER) || CONFIG.MAX_TIER || 5;
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
    function resolveTowerVisualFamily(type) {
        const raw = String(type || 'fire_bud');
        const tCfg = getTowersDict()[raw] || {};
        let branchCode = tCfg.branchCode || null;
        if (!branchCode) {
            const isEnBranch = Boolean(GameApp.i18n && typeof GameApp.i18n.isEnglish === 'function' && GameApp.i18n.isEnglish());
            if (raw.endsWith('_twin_AB')) branchCode = 'AB';
            else if (raw.endsWith('_scion')) branchCode = isEnBranch ? 'S' : '神';
            else if (raw === 'primal_core') branchCode = isEnBranch ? 'C' : '核';
            else if (raw.endsWith('_4')) branchCode = '4★';
            else if (raw.endsWith('_crown_A') || raw.endsWith('_A')) branchCode = 'A';
            else if (raw.endsWith('_crown_B') || raw.endsWith('_B')) branchCode = 'B';
        }
        const fam = tCfg.family || tCfg.elementTag || raw.replace(/_(bud|trunk|crown_A|crown_B|twin_AB|scion|A|B|4)$/, '');
        const allowedFams = ['fire', 'ice', 'thunder', 'steam', 'magnet', 'plasma', 'storm_tri', 'starforge_tri', 'prism_tri', 'primal_core'];
        const family = allowedFams.includes(fam) ? fam : 'fire';
        return {
            family,
            branchCode,
            nodeTier: tCfg.nodeTier || 1,
            isTwinCrown: Boolean(tCfg.isTwinCrown || raw.endsWith('_twin_AB')),
            isScion: Boolean(tCfg.isScion || raw.endsWith('_scion') || raw === 'primal_core'),
            isTriElement: Boolean(tCfg.isTriElement),
            isPrimalCore: Boolean(tCfg.isPrimalCore || raw === 'primal_core')
        };
    }

    function resolveTowerHeadStyleKey(type, family, branchCode) {
        const raw = String(type || 'fire_bud');
        if (TOWER_HEAD_TEMPLATES[raw]) return raw;
        if (TOWER_HEAD_TEMPLATES[family]) return family;
        if (raw.endsWith('_crown_B') && TOWER_HEAD_TEMPLATES[`${family}_B`]) return `${family}_B`;
        if ((raw.endsWith('_crown_A') || raw.endsWith('_twin_AB') || raw.endsWith('_scion')) && TOWER_HEAD_TEMPLATES[`${family}_A`]) {
            return `${family}_A`;
        }
        if (branchCode === 'B' && TOWER_HEAD_TEMPLATES[`${family}_B`]) return `${family}_B`;
        if (branchCode === 'A' && TOWER_HEAD_TEMPLATES[`${family}_A`]) return `${family}_A`;
        return family;
    }

    function getTowerPaletteForType(type, tk) {
        const tCfg = getTowersDict()[type];
        if (tCfg && tCfg.palette) return tCfg.palette;
        const { family } = resolveTowerVisualFamily(type);
        const defaults = {
            fire: { rune: tk.elFire, glow: '#F4DFC8' },
            ice: { rune: tk.elIce, glow: '#D6EEF7' },
            thunder: { rune: tk.elLightning, glow: '#F7EAC0' },
            steam: { rune: tk.accentCta, glow: tk.elIce },
            magnet: { rune: tk.elIce, glow: tk.elLightning },
            plasma: { rune: tk.elFire, glow: tk.elLightning },
            storm_tri: { rune: tk.elIce, glow: tk.elLightning },
            starforge_tri: { rune: tk.elFire, glow: tk.elIce },
            prism_tri: { rune: tk.elIce, glow: '#F4F1EA' },
            primal_core: { rune: tk.elLightning, glow: '#F4F1EA' }
        };
        if (defaults[family]) return defaults[family];
        const mainColor = (tCfg && tCfg.color) || tk.accentCta;
        return { rune: mainColor, glow: tk.textPrimary };
    }

    /**
     * 依血脈繪製 2.5D 樹幹底座（純火深赤岩裂紋／純冰六角晶柱／純雷黃銅線圈／共生雙色交織藤蔓）
     */
    function buildLineageBaseSvg(family, pal, effTier, branchCode, tk) {
        const gemCoords = effTier >= 2 ? [[32, 17], [48, 30], [32, 42], [16, 30]] : [[20, 20], [44, 20], [20, 40], [44, 40]];
        const cornerGems = gemCoords.map(([cx, cy]) => `<circle cx="${cx}" cy="${cy}" r="${effTier >= 2 ? 2.1 : 1.4}" fill="${effTier >= 2 ? pal.glow : tk.textSecondary}"/>`).join('');
        const crownOutline = effTier >= 3
            ? (branchCode === 'B'
                ? `<polygon points="32,10 52,22 47,46 17,46 12,22" fill="none" stroke="${tk.elLightning}" stroke-width="1.5"/>`
                : `<polygon points="15,13 49,13 55,24 55,37 46,46 18,46 9,37 9,24" fill="none" stroke="${tk.elLightning}" stroke-width="1.7"/>`)
            : '';

        // 1. 純冰血脈：寒霜六角晶柱底座
        if (family === 'ice') {
            const innerRim = `<polygon points="32,14 48,23 48,39 32,48 16,39 16,23" fill="#214657" stroke="${tk.elIce}" stroke-width="1.5"/><polygon points="32,14 48,23 32,30 16,23" fill="rgba(244,241,234,0.16)"/><polygon points="16,23 32,30 32,48 16,39" fill="rgba(74,158,191,0.18)"/>`;
            return `<svg class="tower-base-svg" viewBox="0 0 64 64" aria-hidden="true"><ellipse cx="32" cy="54" rx="22" ry="7.5" fill="rgba(0,0,0,0.40)"/><polygon points="32,11 53,22 53,43 32,54 11,43 11,22" fill="#172B36" stroke="${tk.bgCanvas}" stroke-width="2"/><polygon points="11,43 32,54 32,47 16,38" fill="rgba(74,158,191,0.22)"/>${innerRim}${crownOutline}<circle cx="32" cy="30" r="12.5" fill="${tk.bgCanvas}" stroke="${tk.elIce}" stroke-width="${effTier >= 3 ? 2 : 1.4}"/>${cornerGems}</svg>`;
        }

        // 2. 純雷血脈：黃銅琥珀線圈底座
        if (family === 'thunder') {
            const coils = `<circle cx="32" cy="30" r="17" fill="none" stroke="#9E7E26" stroke-width="2.2" stroke-dasharray="6 3"/><circle cx="32" cy="30" r="13" fill="${tk.bgCanvas}" stroke="${tk.elLightning}" stroke-width="${effTier >= 3 ? 2.1 : 1.5}"/><rect x="12" y="28" width="5" height="5" rx="1" fill="#D97724" stroke="#1B211E" stroke-width="1.2"/><rect x="47" y="28" width="5" height="5" rx="1" fill="#D97724" stroke="#1B211E" stroke-width="1.2"/>`;
            return `<svg class="tower-base-svg" viewBox="0 0 64 64" aria-hidden="true"><ellipse cx="32" cy="53" rx="23" ry="8" fill="rgba(0,0,0,0.42)"/><polygon points="15,21 49,21 55,32 55,44 47,53 17,53 9,44 9,32" fill="#322A16" stroke="${tk.bgCanvas}" stroke-width="2"/><polygon points="18,14 46,14 52,24 52,36 45,45 19,45 12,36 12,24" fill="#463A1B" stroke="#9E7E26" stroke-width="1.5"/>${crownOutline}${coils}${cornerGems}</svg>`;
        }

        // 3. 共生血脈與三元創世／原初之核底座
        if (family === 'primal_core') {
            const triVines = `<path d="M11,36 Q32,12 53,36" fill="none" stroke="${tk.elFire}" stroke-width="2"/><path d="M11,28 Q32,52 53,28" fill="none" stroke="${tk.elIce}" stroke-width="2"/><circle cx="32" cy="30" r="18" fill="none" stroke="${tk.elLightning}" stroke-width="2" stroke-dasharray="5 3"/>`;
            return `<svg class="tower-base-svg" viewBox="0 0 64 64" aria-hidden="true"><ellipse cx="32" cy="53" rx="24" ry="8.5" fill="rgba(0,0,0,0.46)"/><polygon points="15,20 49,20 56,32 56,44 47,53 17,53 8,44 8,32" fill="#232D26" stroke="#E0B43C" stroke-width="2"/><polygon points="18,12 46,12 52,24 52,36 45,45 19,45 12,36 12,24" fill="#2F3D34" stroke="#D97724" stroke-width="1.6"/>${triVines}<circle cx="32" cy="30" r="12.5" fill="#1B211E" stroke="#E0B43C" stroke-width="2"/>${cornerGems}</svg>`;
        }
        if (family === 'steam' || family === 'magnet' || family === 'plasma' || family === 'storm_tri' || family === 'starforge_tri' || family === 'prism_tri') {
            const vineA = family === 'magnet' ? tk.elIce : tk.elFire;
            const vineB = family === 'steam' ? tk.elIce : tk.elLightning;
            const vines = `<path d="M11,38 Q16,18 32,16 Q48,18 53,38" fill="none" stroke="${vineA}" stroke-width="2.4" stroke-linecap="round"/><path d="M12,26 Q22,47 32,48 Q42,47 52,26" fill="none" stroke="${vineB}" stroke-width="2.4" stroke-linecap="round"/><path d="M15,44 L22,39 M49,44 L42,39" stroke="${vineA}" stroke-width="1.6" stroke-linecap="round"/>`;
            return `<svg class="tower-base-svg" viewBox="0 0 64 64" aria-hidden="true"><ellipse cx="32" cy="53" rx="23" ry="8" fill="rgba(0,0,0,0.42)"/><polygon points="15,22 49,22 55,33 55,44 47,53 17,53 9,44 9,33" fill="#202B25" stroke="${tk.bgCanvas}" stroke-width="2"/><polygon points="18,14 46,14 52,24 52,36 45,45 19,45 12,36 12,24" fill="#2C3A32" stroke="${tk.borderSubtle}" stroke-width="1.5"/>${vines}${crownOutline}<circle cx="32" cy="30" r="12.5" fill="${tk.bgCanvas}" stroke="${pal.rune}" stroke-width="1.8"/>${cornerGems}</svg>`;
        }

        // 4. 純火血脈：深赤岩八角座＋熔岩裂紋
        const cracks = `<polyline points="14,34 21,30 19,22" fill="none" stroke="${tk.elFire}" stroke-width="1.8" stroke-linecap="round"/><polyline points="50,34 43,30 46,22" fill="none" stroke="${tk.accentCta}" stroke-width="1.8" stroke-linecap="round"/><polyline points="32,49 32,42 36,39" fill="none" stroke="${tk.elFire}" stroke-width="1.8" stroke-linecap="round"/>`;
        return `<svg class="tower-base-svg" viewBox="0 0 64 64" aria-hidden="true"><ellipse cx="32" cy="53" rx="23" ry="8" fill="rgba(0,0,0,0.42)"/><polygon points="15,22 49,22 55,33 55,44 47,53 17,53 9,44 9,33" fill="#2A1715" stroke="${tk.bgCanvas}" stroke-width="2"/><polygon points="18,14 46,14 52,24 52,36 45,45 19,45 12,36 12,24" fill="#3D201C" stroke="#6E281E" stroke-width="1.5"/>${cracks}${crownOutline}<circle cx="32" cy="30" r="13.5" fill="${tk.bgCanvas}" stroke="${pal.rune}" stroke-width="${effTier >= 3 ? 2 : 1.5}"/>${cornerGems}</svg>`;
    }

    const TOWER_HEAD_TEMPLATES = {
        // ---------- Tier 1 / 2 基礎家族造型 ----------
        fire: (tier, tk) => {
            const pods = tier >= 2 ? `<rect x="16.5" y="30" width="5" height="11" rx="2" fill="${tk.accentCta}" stroke="#2B1410" stroke-width="1.5"/><rect x="42.5" y="30" width="5" height="11" rx="2" fill="#9E5214" stroke="#2B1410" stroke-width="1.5"/>` : '';
            return `<ellipse cx="33" cy="36" rx="13" ry="11" fill="rgba(0,0,0,0.30)"/><polygon points="27,7 37,7 39,30 25,30" fill="#6E281E" stroke="#2B1410" stroke-width="1.5"/><rect x="29" y="9" width="3" height="19" rx="1" fill="${tk.elFire}" fill-opacity="0.7"/><polygon points="24.5,6 39.5,6 37.5,12 26.5,12" fill="${tk.accentCta}" stroke="#2B1410" stroke-width="1.5"/><ellipse cx="32" cy="7" rx="4.5" ry="2.2" fill="${tk.elLightning}"/><polygon points="22,26 42,26 45,38 38,46 26,46 19,38" fill="${tk.elFire}" stroke="#2B1410" stroke-width="1.5"/>${pods}<circle cx="32" cy="36" r="5" fill="${tk.accentCta}" stroke="#2B1410" stroke-width="1.5"/><circle cx="31" cy="34.5" r="2.1" fill="${tk.textPrimary}"/>`;
        },
        ice: (tier, tk) => {
            const shards = tier >= 2 ? `<polygon points="18,16 24,28 19,38 14,32" fill="${tk.elIce}" stroke="#143240" stroke-width="1.5"/><polygon points="46,16 40,28 45,38 50,32" fill="#2E6F8A" stroke="#143240" stroke-width="1.5"/>` : '';
            return `<ellipse cx="33" cy="36" rx="12" ry="11" fill="rgba(0,0,0,0.30)"/>${shards}<polygon points="32,4 39,28 32,34 25,28" fill="${tk.elIce}" stroke="#143240" stroke-width="1.5"/><polygon points="32,4 32,34 25,28" fill="rgba(244,241,234,0.36)"/><polygon points="21,28 43,28 46,39 32,47 18,39" fill="#2B6780" stroke="#143240" stroke-width="1.5"/><polygon points="32,29 38,36 32,43 26,36" fill="#A6D7EA" stroke="#143240" stroke-width="1.5"/>`;
        },
        thunder: (tier, tk) => `<ellipse cx="33" cy="36" rx="13" ry="11" fill="rgba(0,0,0,0.30)"/><polygon points="20,9 25,9 26,30 20,30" fill="#5A4B22" stroke="#241F10" stroke-width="1.5"/><polygon points="39,9 44,9 44,30 38,30" fill="#463A1A" stroke="#241F10" stroke-width="1.5"/><circle cx="22.5" cy="9" r="3.4" fill="${tk.elLightning}" stroke="#241F10" stroke-width="1.5"/><circle cx="41.5" cy="9" r="3.4" fill="${tk.elLightning}" stroke="#241F10" stroke-width="1.5"/><polyline points="23,9 29,6 33,12 41,9" fill="none" stroke="${tk.elLightning}" stroke-width="1.7" stroke-linecap="round"/><polygon points="19,28 45,28 47,40 39,47 25,47 17,40" fill="#3D341E" stroke="#241F10" stroke-width="1.5"/><rect x="23" y="30" width="18" height="4" rx="2" fill="${tk.accentCta}"/><rect x="25" y="36" width="14" height="3.5" rx="1.5" fill="${tier >= 2 ? tk.elLightning : tk.accentCta}"/>`,
        steam: (_, tk) => `<ellipse cx="33" cy="36" rx="14" ry="11" fill="rgba(0,0,0,0.32)"/><rect x="23" y="7" width="8" height="22" rx="2" fill="#8C3326" stroke="#1E1814" stroke-width="1.5"/><rect x="33" y="7" width="8" height="22" rx="2" fill="#2D6A82" stroke="#1E1814" stroke-width="1.5"/><rect x="21" y="6" width="22" height="5" rx="2" fill="${tk.textSecondary}" stroke="#1E1814" stroke-width="1.5"/><polygon points="18,27 32,27 32,47 23,46 16,38" fill="${tk.elFire}" stroke="#1E1814" stroke-width="1.5"/><polygon points="32,27 46,27 48,38 41,46 32,47" fill="${tk.elIce}" stroke="#1E1814" stroke-width="1.5"/><circle cx="32" cy="36" r="5.2" fill="${tk.textPrimary}" stroke="#1E1814" stroke-width="1.5"/><circle cx="32" cy="36" r="2.6" fill="${tk.accentCta}"/>`,
        magnet: (_, tk) => `<ellipse cx="33" cy="36" rx="14" ry="11" fill="rgba(0,0,0,0.30)"/><polygon points="18,6 25,6 26,33 17,37" fill="${tk.elIce}" stroke="#142C36" stroke-width="1.5"/><polygon points="46,6 39,6 38,33 47,37" fill="#9E7E26" stroke="#241F10" stroke-width="1.5"/><circle cx="32" cy="16" r="5" fill="${tk.elIce}" stroke="${tk.elLightning}" stroke-width="1.5"/><polygon points="21,30 43,30 47,39 39,47 25,47 17,39" fill="${tk.bgSurface}" stroke="${tk.elIce}" stroke-width="1.5"/><circle cx="32" cy="38" r="5" fill="${tk.elLightning}" stroke="#142C36" stroke-width="1.5"/>`,
        plasma: (_, tk) => `<ellipse cx="33" cy="36" rx="14" ry="11" fill="rgba(0,0,0,0.32)"/><polygon points="14,34 25,21 26,41 18,43" fill="${tk.elFire}" stroke="#2B1410" stroke-width="1.5"/><polygon points="50,34 39,21 38,41 46,43" fill="#8C2F23" stroke="#2B1410" stroke-width="1.5"/><polygon points="32,5 37,27 27,27" fill="${tk.elLightning}" stroke="#2B1410" stroke-width="1.5"/><ellipse cx="32" cy="20" rx="8" ry="3.2" fill="none" stroke="${tk.accentCta}" stroke-width="1.5"/><polygon points="22,27 42,27 44,39 32,48 20,39" fill="#7D2B1F" stroke="${tk.elLightning}" stroke-width="1.5"/><circle cx="32" cy="36" r="5" fill="${tk.accentCta}" stroke="${tk.elLightning}" stroke-width="1.5"/>`,

        // ---------- Tier 3：12 座冠枝專屬幾何（Branch A 寬闊重裝 vs Branch B 尖銳高頻） ----------
        fire_A: (_, tk) => // 寬口熔爐砲
            `<ellipse cx="32" cy="37" rx="16" ry="12" fill="rgba(0,0,0,0.35)"/><polygon points="8,36 18,22 21,45 10,44" fill="#8C2F23" stroke="#1B211E" stroke-width="1.6"/><polygon points="56,36 46,22 43,45 54,44" fill="#8C2F23" stroke="#1B211E" stroke-width="1.6"/><polygon points="21,6 43,6 45,29 19,29" fill="#591F17" stroke="#1B211E" stroke-width="1.8"/><rect x="19" y="5" width="26" height="6.5" rx="2" fill="${tk.accentCta}" stroke="#1B211E" stroke-width="1.6"/><ellipse cx="32" cy="6.5" rx="8.5" ry="2.6" fill="${tk.elLightning}"/><polygon points="18,27 46,27 49,40 40,48 24,48 15,40" fill="${tk.elFire}" stroke="#1B211E" stroke-width="1.8"/><circle cx="32" cy="37" r="6.8" fill="${tk.accentCta}" stroke="#1B211E" stroke-width="1.6"/><circle cx="32" cy="37" r="3" fill="${tk.textPrimary}"/>`,

        fire_B: (_, tk) => // 懸浮三火羽
            `<ellipse cx="32" cy="38" rx="14" ry="11" fill="rgba(0,0,0,0.32)"/><path d="M12,31 Q14,13 22,19 Q19,29 16,35 Z" fill="${tk.accentCta}" stroke="#1B211E" stroke-width="1.5"/><path d="M52,31 Q50,13 42,19 Q45,29 48,35 Z" fill="${tk.elFire}" stroke="#1B211E" stroke-width="1.5"/><path d="M32,1 Q39,14 35,28 L29,28 Q25,14 32,1 Z" fill="${tk.elLightning}" stroke="#1B211E" stroke-width="1.5"/><polygon points="24,25 40,25 42,38 32,48 22,38" fill="${tk.elFire}" stroke="#1B211E" stroke-width="1.7"/><circle cx="32" cy="35" r="4.8" fill="${tk.elLightning}" stroke="#1B211E" stroke-width="1.4"/><circle cx="32" cy="35" r="2.1" fill="${tk.textPrimary}"/>`,

        ice_A: (_, tk) => // 六角冰環冠
            `<ellipse cx="32" cy="37" rx="16" ry="11.5" fill="rgba(0,0,0,0.32)"/><polygon points="32,8 52,19 52,41 32,52 12,41 12,19" fill="none" stroke="${tk.elIce}" stroke-width="3.6"/><polygon points="32,8 52,19 52,41 32,52 12,41 12,19" fill="none" stroke="${tk.textPrimary}" stroke-width="1.2"/><polygon points="25,6 39,6 41,25 23,25" fill="#2B6780" stroke="#143240" stroke-width="1.6"/><polygon points="20,24 44,24 46,38 32,47 18,38" fill="${tk.elIce}" stroke="#143240" stroke-width="1.7"/><circle cx="12" cy="19" r="2.5" fill="${tk.textPrimary}"/><circle cx="52" cy="19" r="2.5" fill="${tk.textPrimary}"/><circle cx="32" cy="8" r="2.6" fill="${tk.elLightning}"/><polygon points="32,27 38,35 32,43 26,35" fill="${tk.textPrimary}" stroke="#143240" stroke-width="1.4"/>`,

        ice_B: (_, tk) => // 三棱尖冰矛
            `<ellipse cx="32" cy="38" rx="13" ry="10.5" fill="rgba(0,0,0,0.30)"/><polygon points="13,12 24,25 20,38 11,31" fill="${tk.elIce}" stroke="#143240" stroke-width="1.5"/><polygon points="51,12 40,25 44,38 53,31" fill="#2E6F8A" stroke="#143240" stroke-width="1.5"/><polygon points="32,1 37.5,27 32,33 26.5,27" fill="${tk.textPrimary}" stroke="#143240" stroke-width="1.6"/><polygon points="32,1 32,33 26.5,27" fill="${tk.elIce}"/><polygon points="22,28 42,28 44,39 32,48 20,39" fill="#21556B" stroke="#143240" stroke-width="1.6"/><polygon points="32,29 36,36 32,43 28,36" fill="${tk.elLightning}" stroke="#143240" stroke-width="1.2"/>`,

        thunder_A: (_, tk) => // 雙弧導雷環
            `<ellipse cx="32" cy="37" rx="16" ry="11" fill="rgba(0,0,0,0.32)"/><path d="M11,22 A13,15 0 0,0 11,42" fill="none" stroke="${tk.elLightning}" stroke-width="3.2" stroke-linecap="round"/><path d="M53,22 A13,15 0 0,1 53,42" fill="none" stroke="${tk.elLightning}" stroke-width="3.2" stroke-linecap="round"/><polyline points="13,18 22,12 32,17 42,12 51,18" fill="none" stroke="${tk.textPrimary}" stroke-width="2" stroke-linejoin="round"/><rect x="17" y="13" width="6" height="22" rx="2" fill="#463A1A" stroke="#1B211E" stroke-width="1.5"/><rect x="41" y="13" width="6" height="22" rx="2" fill="#463A1A" stroke="#1B211E" stroke-width="1.5"/><polygon points="19,27 45,27 47,40 39,47 25,47 17,40" fill="#3D341E" stroke="#1B211E" stroke-width="1.7"/><circle cx="32" cy="36" r="6" fill="${tk.elLightning}" stroke="#1B211E" stroke-width="1.5"/>`,

        thunder_B: (_, tk) => // 高聳避雷尖塔
            `<ellipse cx="32" cy="38" rx="14" ry="10.5" fill="rgba(0,0,0,0.30)"/><polygon points="32,1 35.5,26 28.5,26" fill="${tk.elLightning}" stroke="#1B211E" stroke-width="1.6"/><rect x="24" y="11" width="16" height="3.5" rx="1.5" fill="${tk.accentCta}" stroke="#1B211E" stroke-width="1.3"/><rect x="21" y="18" width="22" height="3.8" rx="1.5" fill="${tk.elLightning}" stroke="#1B211E" stroke-width="1.3"/><polygon points="21,26 43,26 45,39 38,47 26,47 19,39" fill="#3D341E" stroke="#1B211E" stroke-width="1.7"/><polygon points="32,28 36,36 32,44 28,36" fill="${tk.textPrimary}" stroke="#1B211E" stroke-width="1.3"/>`,

        steam_A: (_, tk) => // 雙噴口蒸壓鍋
            `<ellipse cx="32" cy="37" rx="16" ry="12" fill="rgba(0,0,0,0.34)"/><rect x="11" y="25" width="7" height="17" rx="2" fill="${tk.accentCta}" stroke="#1B211E" stroke-width="1.5"/><rect x="46" y="25" width="7" height="17" rx="2" fill="#2D6A82" stroke="#1B211E" stroke-width="1.5"/><rect x="20" y="6" width="9" height="22" rx="2" fill="#8C3326" stroke="#1B211E" stroke-width="1.6"/><rect x="35" y="6" width="9" height="22" rx="2" fill="#2D6A82" stroke="#1B211E" stroke-width="1.6"/><rect x="18" y="5" width="13" height="5" rx="1.5" fill="${tk.accentCta}" stroke="#1B211E" stroke-width="1.4"/><rect x="33" y="5" width="13" height="5" rx="1.5" fill="${tk.elIce}" stroke="#1B211E" stroke-width="1.4"/><polygon points="16,25 48,25 50,39 42,47 22,47 14,39" fill="#5E2D24" stroke="#1B211E" stroke-width="1.7"/><circle cx="32" cy="36" r="6.4" fill="${tk.textPrimary}" stroke="#1B211E" stroke-width="1.5"/><circle cx="32" cy="36" r="3" fill="${tk.elFire}"/>`,

        steam_B: (_, tk) => // 擴散霧晶冠
            `<ellipse cx="32" cy="37" rx="14" ry="11" fill="rgba(0,0,0,0.30)"/><polygon points="32,2 38,16 32,22 26,16" fill="${tk.elIce}" stroke="#143240" stroke-width="1.5"/><polygon points="12,17 25,22 22,31 11,26" fill="${tk.textPrimary}" stroke="#143240" stroke-width="1.4"/><polygon points="52,17 39,22 42,31 53,26" fill="${tk.accentCta}" stroke="#1B211E" stroke-width="1.4"/><polygon points="21,26 43,26 46,38 32,47 18,38" fill="#2D6A82" stroke="#1B211E" stroke-width="1.6"/><polygon points="32,27 39,35 32,44 25,35" fill="${tk.elIce}" stroke="#1B211E" stroke-width="1.4"/>`,

        magnet_A: (_, tk) => // 暗核引力環
            `<ellipse cx="32" cy="37" rx="16" ry="11.5" fill="rgba(0,0,0,0.36)"/><circle cx="32" cy="30" r="18" fill="none" stroke="${tk.elIce}" stroke-width="3"/><circle cx="32" cy="30" r="13" fill="none" stroke="${tk.elLightning}" stroke-width="1.8" stroke-dasharray="6 3"/><polygon points="12,18 22,22 20,38 11,36" fill="#2D6A82" stroke="#1B211E" stroke-width="1.5"/><polygon points="52,18 42,22 44,38 53,36" fill="#9E7E26" stroke="#1B211E" stroke-width="1.5"/><circle cx="32" cy="30" r="8" fill="${tk.bgCanvas}" stroke="${tk.elIce}" stroke-width="2"/><circle cx="32" cy="30" r="3.2" fill="${tk.textPrimary}"/>`,

        magnet_B: (_, tk) => // 三極磁針冠
            `<ellipse cx="32" cy="37" rx="14" ry="11" fill="rgba(0,0,0,0.32)"/><polygon points="32,1 36,24 28,24" fill="${tk.elLightning}" stroke="#1B211E" stroke-width="1.5"/><polygon points="10,16 25,25 19,32" fill="${tk.elIce}" stroke="#1B211E" stroke-width="1.5"/><polygon points="54,16 39,25 45,32" fill="${tk.elIce}" stroke="#1B211E" stroke-width="1.5"/><polygon points="21,26 43,26 46,39 38,47 26,47 18,39" fill="${tk.bgSurface}" stroke="${tk.elLightning}" stroke-width="1.7"/><circle cx="32" cy="36" r="5.6" fill="${tk.elLightning}" stroke="#1B211E" stroke-width="1.5"/><circle cx="32" cy="36" r="2.2" fill="${tk.elIce}"/>`,

        plasma_A: (_, tk) => // 粗束聚能砲
            `<ellipse cx="32" cy="37" rx="16" ry="12" fill="rgba(0,0,0,0.34)"/><polygon points="10,33 21,18 23,43 12,44" fill="#8C2F23" stroke="#1B211E" stroke-width="1.6"/><polygon points="54,33 43,18 41,43 52,44" fill="#8C2F23" stroke="#1B211E" stroke-width="1.6"/><polygon points="25,4 39,4 41,28 23,28" fill="${tk.elFire}" stroke="#1B211E" stroke-width="1.7"/><rect x="28" y="4" width="8" height="23" fill="${tk.elLightning}"/><ellipse cx="32" cy="14" rx="10" ry="3.4" fill="none" stroke="${tk.elLightning}" stroke-width="1.8"/><polygon points="20,26 44,26 46,40 32,48 18,40" fill="#6E281E" stroke="${tk.elLightning}" stroke-width="1.7"/><circle cx="32" cy="36" r="6.4" fill="${tk.accentCta}" stroke="${tk.elLightning}" stroke-width="1.5"/>`,

        plasma_B: (_, tk) => // 多面折射稜鏡
            `<ellipse cx="32" cy="38" rx="14" ry="11" fill="rgba(0,0,0,0.32)"/><polygon points="32,1 38,17 32,26 26,17" fill="${tk.textPrimary}" stroke="#1B211E" stroke-width="1.5"/><polygon points="11,19 25,20 23,31 12,28" fill="${tk.elLightning}" stroke="#1B211E" stroke-width="1.5"/><polygon points="53,19 39,20 41,31 52,28" fill="${tk.elFire}" stroke="#1B211E" stroke-width="1.5"/><polygon points="22,26 42,26 44,39 32,48 20,39" fill="#7D2B1F" stroke="${tk.elLightning}" stroke-width="1.6"/><polygon points="32,27 38,36 32,44 26,36" fill="${tk.elLightning}" stroke="#1B211E" stroke-width="1.3"/>`,

        // ---------- Stage 2：三元創世傳奇 & 唯一 5★ 原初之核 ----------
        storm_tri: (_, tk) => // ⛈️ 天災風暴樹（蒸氣＋雷）
            `<ellipse cx="32" cy="38" rx="16" ry="12" fill="rgba(0,0,0,0.36)"/><path d="M12,25 Q22,12 32,17 Q42,12 52,25 Q54,37 42,41 L22,41 Q10,37 12,25 Z" fill="#234857" stroke="${tk.elIce}" stroke-width="1.7"/><polyline points="19,12 29,22 24,25 35,36" fill="none" stroke="${tk.elLightning}" stroke-width="2.2" stroke-linecap="round"/><polyline points="45,12 37,22 41,25 32,35" fill="none" stroke="${tk.accentCta}" stroke-width="2" stroke-linecap="round"/><circle cx="32" cy="36" r="6" fill="${tk.elIce}" stroke="${tk.elLightning}" stroke-width="1.6"/><circle cx="32" cy="36" r="2.6" fill="#F4F1EA"/>`,

        starforge_tri: (_, tk) => // 🌋 星界熔爐樹（磁暴＋火）
            `<ellipse cx="32" cy="38" rx="16" ry="12" fill="rgba(0,0,0,0.36)"/><circle cx="32" cy="32" r="19" fill="none" stroke="${tk.elIce}" stroke-width="2.2" stroke-dasharray="6 3"/><polygon points="15,24 32,8 49,24 44,44 20,44" fill="#6E281E" stroke="${tk.accentCta}" stroke-width="1.8"/><polygon points="24,18 32,4 40,18 32,27" fill="${tk.elFire}" stroke="${tk.elLightning}" stroke-width="1.5"/><circle cx="32" cy="34" r="6.8" fill="${tk.elLightning}" stroke="#1B211E" stroke-width="1.5"/><circle cx="32" cy="34" r="3" fill="${tk.elIce}"/>`,

        prism_tri: (_, tk) => // ❄️ 絕對零度稜鏡（電漿＋冰）
            `<ellipse cx="32" cy="38" rx="15" ry="11.5" fill="rgba(0,0,0,0.34)"/><polygon points="32,2 44,22 32,46 20,22" fill="#D6EEF7" stroke="${tk.elIce}" stroke-width="1.7"/><polygon points="32,2 32,46 20,22" fill="#4A9EBF" fill-opacity="0.55"/><polygon points="10,18 22,25 18,36 9,30" fill="${tk.elFire}" stroke="#1B211E" stroke-width="1.4"/><polygon points="54,18 42,25 46,36 55,30" fill="${tk.elLightning}" stroke="#1B211E" stroke-width="1.4"/><circle cx="32" cy="24" r="4.6" fill="#F4F1EA" stroke="#1B211E" stroke-width="1.4"/>`,

        primal_core: (_, tk) => // 🌳 創世世界樹·原初之核
            `<ellipse cx="32" cy="38" rx="17" ry="12" fill="rgba(0,0,0,0.38)"/><circle cx="32" cy="28" r="20" fill="none" stroke="#E0B43C" stroke-width="2"/><path d="M22,46 Q25,28 32,12 Q39,28 42,46 Z" fill="#2D5A3D" stroke="#E0B43C" stroke-width="1.6"/><circle cx="32" cy="21" r="7.5" fill="#E0B43C" stroke="#1B211E" stroke-width="1.5"/><circle cx="21" cy="29" r="3.6" fill="${tk.elFire}" stroke="#1B211E" stroke-width="1.2"/><circle cx="43" cy="29" r="3.6" fill="${tk.elIce}" stroke="#1B211E" stroke-width="1.2"/><circle cx="32" cy="38" r="3.8" fill="${tk.elLightning}" stroke="#1B211E" stroke-width="1.2"/>`
    };

    function createTowerSvgParts(type, tier = 1) {
        const tk = getThemeTokens();
        const pal = getTowerPaletteForType(type, tk);
        const { family, branchCode, nodeTier, isTwinCrown, isScion } = resolveTowerVisualFamily(type);
        const effTier = Math.max(tier || 1, nodeTier || 1);
        const baseSvgHtml = buildLineageBaseSvg(family, pal, effTier, branchCode, tk);
        const headKey = resolveTowerHeadStyleKey(type, family, branchCode);
        const headBuilder = TOWER_HEAD_TEMPLATES[headKey] || TOWER_HEAD_TEMPLATES[family] || ((t, tokens) => buildParametricTowerHeadSvg(type, t, tokens));
        const crestSvg = effTier >= 5 || isScion
            ? `<circle cx="32" cy="32" r="28" fill="none" stroke="#E0B43C" stroke-width="1.6" stroke-dasharray="6 3"/><polygon points="24,8 28,13 32,4 36,13 40,8 38,16 26,16" fill="#E0B43C" stroke="#1B211E" stroke-width="1.2"/>`
            : (effTier >= 4
                ? `<circle cx="32" cy="32" r="27" fill="none" stroke="${isTwinCrown ? '#D97724' : '#E0B43C'}" stroke-width="1.3" stroke-dasharray="${isTwinCrown ? '4 2' : '8 3'}"/>`
                : '');
        return { baseSvgHtml, headSvgHtml: `<svg class="tower-head-svg" viewBox="0 0 64 64" aria-hidden="true">${headBuilder(effTier, tk, branchCode)}${crestSvg}</svg>` };
    }

    const BOSS_SVG_BY_TYPE = {
        lava: '<polygon points="10,44 16,18 27,22 32,12 37,22 48,18 54,44 45,54 19,54" fill="#3A1D18" stroke="#180D0B" stroke-width="2"/><polygon points="16,18 9,8 22,15" fill="#7D2B1F" stroke="#180D0B" stroke-width="1.5"/><polygon points="48,18 55,8 42,15" fill="#7D2B1F" stroke="#180D0B" stroke-width="1.5"/><polygon points="21,26 32,20 43,26 45,42 32,50 19,42" fill="#542119"/><polygon points="25,31 32,27 39,31 36,42 32,46 28,42" fill="#C94A38"/><polygon points="28,33 32,30 36,33 32,40" fill="#E0B43C"/><polygon points="23,23 29,25 24,27" fill="#F4F1EA"/><polygon points="41,23 35,25 40,27" fill="#F4F1EA"/>',
        air: '<polygon points="11,34 22,16 42,16 53,34 45,49 19,49" fill="#233036" stroke="#12191C" stroke-width="2"/><rect x="7" y="26" width="9" height="15" rx="3" fill="#3E5059" stroke="#12191C" stroke-width="1.5"/><rect x="48" y="26" width="9" height="15" rx="3" fill="#3E5059" stroke="#12191C" stroke-width="1.5"/><polygon points="20,17 44,17 48,29 16,29" fill="#33424A"/><circle cx="32" cy="34" r="9.5" fill="#4A9EBF" stroke="#F4F1EA" stroke-width="1.5"/><circle cx="32" cy="34" r="4.5" fill="#F4F1EA"/><polygon points="26,46 32,54 38,46" fill="#E0B43C"/>',
        wood: '<polygon points="14,19 8,7 22,14 27,21" fill="#3D3126" stroke="#18130E" stroke-width="1.5"/><polygon points="50,19 56,7 42,14 37,21" fill="#3D3126" stroke="#18130E" stroke-width="1.5"/><polygon points="15,48 20,21 44,21 49,48 41,55 23,55" fill="#4B3B2D" stroke="#18130E" stroke-width="2"/><polygon points="19,21 32,12 45,21 38,28 26,28" fill="#2D5A3D" stroke="#132A1B" stroke-width="1.5"/><polygon points="27,34 32,29 37,34 34,43 30,43" fill="#D97724" stroke="#E0B43C" stroke-width="1.5"/><circle cx="25" cy="27" r="2.6" fill="#E0B43C"/><circle cx="39" cy="27" r="2.6" fill="#E0B43C"/>',
        thief: '<path d="M16,24 L12,10 L26,18 L38,18 L52,10 L48,24 Z" fill="#C97324" stroke="#1E1710" stroke-width="1.6"/><ellipse cx="32" cy="34" rx="16" ry="13" fill="#D97724" stroke="#1E1710" stroke-width="1.8"/><polygon points="22,30 32,33 27,36" fill="#F4F1EA"/><polygon points="42,30 32,33 37,36" fill="#F4F1EA"/><circle cx="26" cy="31" r="2.2" fill="#1B211E"/><circle cx="38" cy="31" r="2.2" fill="#1B211E"/><polygon points="24,42 40,42 44,54 20,54" fill="#2C3530" stroke="#E0B43C" stroke-width="1.6"/><circle cx="32" cy="48" r="3.2" fill="#E0B43C"/>',
        void_boss: '<polygon points="11,45 15,17 26,12 32,6 38,12 49,17 53,45 43,55 21,55" fill="#1E2723" stroke="#E0B43C" stroke-width="2"/><polygon points="19,22 32,15 45,22 43,43 32,50 21,43" fill="#2C3530" stroke="#46544C" stroke-width="1.4"/><polygon points="32,19 40,32 32,45 24,32" fill="#D97724" stroke="#E0B43C" stroke-width="1.6"/><circle cx="23" cy="28" r="2.6" fill="#E0B43C"/><circle cx="41" cy="28" r="2.6" fill="#E0B43C"/><circle cx="32" cy="32" r="3.4" fill="#F4F1EA"/>'
    };

    const MONSTER_SVG_BY_KEY = {
        mini: '<path d="M16 46 Q16 25 32 23 Q48 25 48 46 Q48 54 32 54 Q16 54 16 46 Z" fill="#488B5A" stroke="#1B3823" stroke-width="1.5"/><path d="M21 33 Q24 27 31 27" fill="none" stroke="#B7E4C7" stroke-width="2" stroke-linecap="round"/><circle cx="27" cy="40" r="2.4" fill="#1B211E"/><circle cx="37" cy="40" r="2.4" fill="#1B211E"/><circle cx="27.8" cy="39" r="0.9" fill="#F4F1EA"/><circle cx="37.8" cy="39" r="0.9" fill="#F4F1EA"/>',
        lava: '<polygon points="16,47 18,22 28,15 36,15 46,22 48,47 39,54 25,54" fill="#46201A" stroke="#1B0D0A" stroke-width="1.5"/><polygon points="21,23 32,17 43,23 41,34 23,34" fill="#7D2B1F"/><polygon points="27,32 32,27 37,32 35,44 29,44" fill="#C94A38"/><polygon points="30,33 34,33 32,40" fill="#E0B43C"/><rect x="23" y="25" width="5" height="3" rx="1" fill="#E0B43C"/><rect x="36" y="25" width="5" height="3" rx="1" fill="#E0B43C"/>',
        air: '<polygon points="10,36 22,28 42,28 54,36 42,46 22,46" fill="#2F6A82" stroke="#142C36" stroke-width="1.5"/><path d="M21 30 Q21 15 32 15 Q43 15 43 30 Z" fill="#4A9EBF" stroke="#142C36" stroke-width="1.5"/><ellipse cx="29" cy="21" rx="4" ry="2" fill="rgba(244,241,234,0.55)"/><circle cx="23" cy="37" r="2.2" fill="#E0B43C"/><circle cx="32" cy="37" r="2.2" fill="#E0B43C"/><circle cx="41" cy="37" r="2.2" fill="#E0B43C"/><polygon points="26,46 38,46 32,53" fill="#D97724"/>',
        hound: '<polygon points="12,41 24,25 22,12 31,21 40,12 39,24 52,32 45,42 42,53 33,44 24,53 20,43" fill="#357690" stroke="#142C36" stroke-width="1.5"/><polygon points="24,27 39,24 47,32 35,36 21,36" fill="rgba(244,241,234,0.28)"/><polygon points="8,36 17,32 15,40" fill="#82BDD4"/><circle cx="40" cy="29" r="2.2" fill="#E0B43C"/>',
        slime: '<path d="M12 45 Q13 17 32 16 Q51 17 52 45 Q51 54 32 54 Q13 54 12 45 Z" fill="#3B7A4D" stroke="#16301D" stroke-width="1.5"/><path d="M14 45 Q32 51 50 45 Q47 52 32 53 Q17 52 14 45 Z" fill="#2A5B38"/><path d="M19 28 Q23 20 31 20" fill="none" stroke="#B7E4C7" stroke-width="2" stroke-linecap="round"/><circle cx="25" cy="34" r="3" fill="#1B211E"/><circle cx="39" cy="34" r="3" fill="#1B211E"/><circle cx="26" cy="33" r="1.1" fill="#F4F1EA"/><circle cx="40" cy="33" r="1.1" fill="#F4F1EA"/>',
        golem: '<polygon points="11,45 14,19 24,14 40,14 50,19 53,45 45,54 19,54" fill="#46544C" stroke="#1B211E" stroke-width="2"/><polygon points="17,19 47,19 44,33 20,33" fill="#708077"/><polygon points="21,21 43,21 40,28 24,28" fill="rgba(244,241,234,0.28)"/><rect x="23" y="25" width="18" height="4.5" rx="2" fill="#1B211E"/><rect x="25" y="26.2" width="14" height="2.2" rx="1" fill="#D97724"/><circle cx="17" cy="24" r="1.8" fill="#B8C2BC"/><circle cx="47" cy="24" r="1.8" fill="#B8C2BC"/>',
        wood: '<polygon points="15,47 18,22 46,22 49,47 41,54 23,54" fill="#523C2B" stroke="#1E1711" stroke-width="1.5"/><polygon points="16,24 25,13 32,19 39,13 48,24 38,29 26,29" fill="#326B46" stroke="#142C1D" stroke-width="1.5"/><polygon points="23,35 32,31 41,35 37,46 27,46" fill="rgba(74,222,128,0.28)"/><circle cx="25" cy="31" r="2.2" fill="#E0B43C"/><circle cx="39" cy="31" r="2.2" fill="#E0B43C"/>',
        guardian: '<polygon points="14,16 50,16 46,44 32,55 18,44" fill="#234656" stroke="#4A9EBF" stroke-width="2"/><polygon points="21,22 43,22 40,40 32,48 24,40" fill="#172B36" stroke="#82BDD4" stroke-width="1.4"/><line x1="32" y1="20" x2="32" y2="48" stroke="#4A9EBF" stroke-width="1.6"/><circle cx="26" cy="30" r="2.2" fill="#F4F1EA"/><circle cx="38" cy="30" r="2.2" fill="#F4F1EA"/>',
        healer: '<circle cx="32" cy="34" r="15" fill="#2D5A3D" stroke="#16301D" stroke-width="1.6"/><path d="M32 10 L38 22 L50 20 L40 30 L45 42 L32 36 L19 42 L24 30 L14 20 L26 22 Z" fill="#4E9A68" stroke="#16301D" stroke-width="1.4"/><rect x="29.5" y="27" width="5" height="14" rx="1.2" fill="#F4F1EA"/><rect x="25" y="31.5" width="14" height="5" rx="1.2" fill="#F4F1EA"/>',
        panther: '<polygon points="12,38 23,22 25,11 32,20 40,11 42,23 53,33 44,44 36,52 24,49" fill="#273238" stroke="#46544C" stroke-width="1.6"/><polygon points="25,25 39,24 46,32 34,37 22,34" fill="#35444C"/><circle cx="38" cy="28" r="2.3" fill="#4A9EBF"/><circle cx="29" cy="28" r="2.1" fill="#4A9EBF"/><polygon points="9,34 19,32 16,40" fill="#4A9EBF"/>',
        bomber: '<circle cx="32" cy="36" r="16" fill="#4A211B" stroke="#1B0D0A" stroke-width="1.8"/><rect x="28" y="13" width="8" height="7" rx="2" fill="#6E281E" stroke="#1B0D0A" stroke-width="1.4"/><polygon points="32,5 36,12 28,12" fill="#E0B43C"/><circle cx="32" cy="37" r="7.5" fill="#C94A38" stroke="#E0B43C" stroke-width="1.6"/><circle cx="32" cy="37" r="3" fill="#E0B43C"/>'
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

    // ==================== 共用角色／怪物／地形 2.5D 高解析度 Canvas 肖像繪製器 ====================
    const imageCache = new Map();

    function poly2D(ctx, pts, fill, stroke = null, lineWidth = 1.5) {
        if (!pts || pts.length < 2) return;
        ctx.beginPath();
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
        ctx.closePath();
        if (fill) { ctx.fillStyle = fill; ctx.fill(); }
        if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lineWidth; ctx.lineJoin = 'round'; ctx.stroke(); }
    }

    function circle2D(ctx, cx, cy, r, fill, stroke = null, lineWidth = 1.5) {
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        if (fill) { ctx.fillStyle = fill; ctx.fill(); }
        if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lineWidth; ctx.stroke(); }
    }

    function ellipse2D(ctx, cx, cy, rx, ry, fill, stroke = null, lineWidth = 1.5) {
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        if (fill) { ctx.fillStyle = fill; ctx.fill(); }
        if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lineWidth; ctx.stroke(); }
    }

    function rect2D(ctx, x, y, w, h, fill, stroke = null, lineWidth = 1.5) {
        ctx.beginPath();
        ctx.rect(x, y, w, h);
        if (fill) { ctx.fillStyle = fill; ctx.fill(); }
        if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lineWidth; ctx.stroke(); }
    }

    function drawTowerPortrait2D(ctx, type, tier, tk) {
        const pal = getTowerPaletteForType(type, tk);
        const { family, branchCode, nodeTier, isTwinCrown, isScion } = resolveTowerVisualFamily(type);
        const effTier = Math.max(tier || 1, nodeTier || 1);
        const visualType = resolveTowerHeadStyleKey(type, family, branchCode);

        // 1. 樹幹底座（依血脈區分：純冰六角晶柱 / 純雷黃銅線圈 / 共生雙色藤蔓 / 純火熔岩裂紋）
        ellipse2D(ctx, 32, 53, 23, 8, 'rgba(0,0,0,0.42)');
        if (family === 'ice') {
            poly2D(ctx, [[32, 11], [53, 22], [53, 43], [32, 54], [11, 43], [11, 22]], '#172B36', tk.bgCanvas, 2);
            poly2D(ctx, [[32, 14], [48, 23], [48, 39], [32, 48], [16, 39], [16, 23]], '#214657', tk.elIce, 1.5);
            circle2D(ctx, 32, 30, 12.5, tk.bgCanvas, tk.elIce, effTier >= 3 ? 2 : 1.5);
        } else if (family === 'thunder') {
            poly2D(ctx, [[15, 21], [49, 21], [55, 32], [55, 44], [47, 53], [17, 53], [9, 44], [9, 32]], '#322A16', tk.bgCanvas, 2);
            poly2D(ctx, [[18, 14], [46, 14], [52, 24], [52, 36], [45, 45], [19, 45], [12, 36], [12, 24]], '#463A1B', '#9E7E26', 1.5);
            circle2D(ctx, 32, 30, 17, null, '#9E7E26', 2);
            circle2D(ctx, 32, 30, 13, tk.bgCanvas, tk.elLightning, effTier >= 3 ? 2.1 : 1.5);
        } else if (family === 'steam' || family === 'magnet' || family === 'plasma' || family === 'storm_tri' || family === 'starforge_tri' || family === 'prism_tri' || family === 'primal_core') {
            poly2D(ctx, [[15, 22], [49, 22], [55, 33], [55, 44], [47, 53], [17, 53], [9, 44], [9, 33]], '#202B25', tk.bgCanvas, 2);
            poly2D(ctx, [[18, 14], [46, 14], [52, 24], [52, 36], [45, 45], [19, 45], [12, 36], [12, 24]], '#2C3A32', tk.borderSubtle, 1.5);
            ctx.beginPath(); ctx.moveTo(11, 38); ctx.quadraticCurveTo(32, 14, 53, 38);
            ctx.strokeStyle = family === 'magnet' ? tk.elIce : tk.elFire; ctx.lineWidth = 2.2; ctx.stroke();
            ctx.beginPath(); ctx.moveTo(12, 26); ctx.quadraticCurveTo(32, 50, 52, 26);
            ctx.strokeStyle = family === 'steam' ? tk.elIce : tk.elLightning; ctx.lineWidth = 2.2; ctx.stroke();
            circle2D(ctx, 32, 30, 12.5, tk.bgCanvas, pal.rune, 1.8);
        } else {
            poly2D(ctx, [[15, 22], [49, 22], [55, 33], [55, 44], [47, 53], [17, 53], [9, 44], [9, 33]], '#2A1715', tk.bgCanvas, 2);
            poly2D(ctx, [[18, 14], [46, 14], [52, 24], [52, 36], [45, 45], [19, 45], [12, 36], [12, 24]], '#3D201C', '#6E281E', 1.5);
            circle2D(ctx, 32, 30, 13.5, tk.bgCanvas, pal.rune, effTier >= 3 ? 2 : 1.5);
        }

        const gemCoords = effTier >= 2 ? [[32, 17], [48, 30], [32, 42], [16, 30]] : [[20, 20], [44, 20], [20, 40], [44, 40]];
        gemCoords.forEach(([gx, gy]) => circle2D(ctx, gx, gy, effTier >= 2 ? 2.1 : 1.5, effTier >= 2 ? pal.glow : tk.textSecondary));

        // 2. 砲塔樹冠結構（12 座 T3 冠枝與 T4/T5 高階外觀一致）
        if (visualType === 'fire_A') {
            poly2D(ctx, [[8, 36], [18, 22], [21, 45], [10, 44]], '#8C2F23', '#1B211E', 1.5);
            poly2D(ctx, [[56, 36], [46, 22], [43, 45], [54, 44]], '#8C2F23', '#1B211E', 1.5);
            poly2D(ctx, [[21, 6], [43, 6], [45, 29], [19, 29]], '#591F17', '#1B211E', 1.7);
            rect2D(ctx, 19, 5, 26, 6.5, tk.accentCta, '#1B211E', 1.5);
            ellipse2D(ctx, 32, 6.5, 8.5, 2.5, tk.elLightning);
            poly2D(ctx, [[18, 27], [46, 27], [49, 40], [40, 48], [24, 48], [15, 40]], tk.elFire, '#1B211E', 1.7);
            circle2D(ctx, 32, 37, 6.5, tk.accentCta, '#1B211E', 1.5);
            circle2D(ctx, 32, 37, 2.8, tk.textPrimary);
        } else if (visualType === 'fire_B') {
            poly2D(ctx, [[12, 31], [17, 15], [22, 22], [16, 35]], tk.accentCta, '#1B211E', 1.4);
            poly2D(ctx, [[52, 31], [47, 15], [42, 22], [48, 35]], tk.elFire, '#1B211E', 1.4);
            poly2D(ctx, [[32, 2], [37, 18], [35, 28], [29, 28], [27, 18]], tk.elLightning, '#1B211E', 1.5);
            poly2D(ctx, [[24, 25], [40, 25], [42, 38], [32, 48], [22, 38]], tk.elFire, '#1B211E', 1.6);
            circle2D(ctx, 32, 35, 4.6, tk.elLightning, '#1B211E', 1.3);
        } else if (visualType === 'ice_A') {
            poly2D(ctx, [[32, 8], [52, 19], [52, 41], [32, 52], [12, 41], [12, 19]], null, tk.elIce, 3.2);
            poly2D(ctx, [[25, 6], [39, 6], [41, 25], [23, 25]], '#2B6780', '#143240', 1.5);
            poly2D(ctx, [[20, 24], [44, 24], [46, 38], [32, 47], [18, 38]], tk.elIce, '#143240', 1.6);
            poly2D(ctx, [[32, 27], [38, 35], [32, 43], [26, 35]], tk.textPrimary, '#143240', 1.3);
        } else if (visualType === 'ice_B') {
            poly2D(ctx, [[13, 12], [24, 25], [20, 38], [11, 31]], tk.elIce, '#143240', 1.5);
            poly2D(ctx, [[51, 12], [40, 25], [44, 38], [53, 31]], '#2E6F8A', '#143240', 1.5);
            poly2D(ctx, [[32, 1], [37.5, 27], [32, 33], [26.5, 27]], tk.textPrimary, '#143240', 1.6);
            poly2D(ctx, [[22, 28], [42, 28], [44, 39], [32, 48], [20, 39]], '#21556B', '#143240', 1.6);
            poly2D(ctx, [[32, 29], [36, 36], [32, 43], [28, 36]], tk.elLightning, '#143240', 1.2);
        } else if (visualType === 'thunder_A') {
            circle2D(ctx, 32, 32, 19, null, tk.elLightning, 2.4);
            rect2D(ctx, 17, 13, 6, 22, '#463A1A', '#1B211E', 1.4);
            rect2D(ctx, 41, 13, 6, 22, '#463A1A', '#1B211E', 1.4);
            poly2D(ctx, [[19, 27], [45, 27], [47, 40], [39, 47], [25, 47], [17, 40]], '#3D341E', '#1B211E', 1.6);
            circle2D(ctx, 32, 36, 5.8, tk.elLightning, '#1B211E', 1.5);
        } else if (visualType === 'thunder_B') {
            poly2D(ctx, [[32, 1], [36, 26], [28, 26]], tk.elLightning, '#1B211E', 1.5);
            rect2D(ctx, 24, 11, 16, 3.5, tk.accentCta, '#1B211E', 1.2);
            rect2D(ctx, 21, 18, 22, 3.8, tk.elLightning, '#1B211E', 1.2);
            poly2D(ctx, [[21, 26], [43, 26], [45, 39], [38, 47], [26, 47], [19, 39]], '#3D341E', '#1B211E', 1.6);
            poly2D(ctx, [[32, 28], [36, 36], [32, 44], [28, 36]], tk.textPrimary, '#1B211E', 1.2);
        } else if (visualType === 'steam_A') {
            rect2D(ctx, 11, 25, 7, 17, tk.accentCta, '#1B211E', 1.4);
            rect2D(ctx, 46, 25, 7, 17, '#2D6A82', '#1B211E', 1.4);
            rect2D(ctx, 20, 6, 9, 22, '#8C3326', '#1B211E', 1.5);
            rect2D(ctx, 35, 6, 9, 22, '#2D6A82', '#1B211E', 1.5);
            poly2D(ctx, [[16, 25], [48, 25], [50, 39], [42, 47], [22, 47], [14, 39]], '#5E2D24', '#1B211E', 1.6);
            circle2D(ctx, 32, 36, 6, tk.textPrimary, '#1B211E', 1.4);
            circle2D(ctx, 32, 36, 2.8, tk.elFire);
        } else if (visualType === 'steam_B') {
            poly2D(ctx, [[32, 2], [38, 16], [32, 22], [26, 16]], tk.elIce, '#143240', 1.4);
            poly2D(ctx, [[12, 17], [25, 22], [22, 31], [11, 26]], tk.textPrimary, '#143240', 1.4);
            poly2D(ctx, [[52, 17], [39, 22], [42, 31], [53, 26]], tk.accentCta, '#1B211E', 1.4);
            poly2D(ctx, [[21, 26], [43, 26], [46, 38], [32, 47], [18, 38]], '#2D6A82', '#1B211E', 1.5);
            poly2D(ctx, [[32, 27], [39, 35], [32, 44], [25, 35]], tk.elIce, '#1B211E', 1.3);
        } else if (visualType === 'magnet_A') {
            circle2D(ctx, 32, 30, 18, null, tk.elIce, 2.8);
            circle2D(ctx, 32, 30, 13, null, tk.elLightning, 1.6);
            poly2D(ctx, [[12, 18], [22, 22], [20, 38], [11, 36]], '#2D6A82', '#1B211E', 1.4);
            poly2D(ctx, [[52, 18], [42, 22], [44, 38], [53, 36]], '#9E7E26', '#1B211E', 1.4);
            circle2D(ctx, 32, 30, 8, tk.bgCanvas, tk.elIce, 2);
            circle2D(ctx, 32, 30, 3, tk.textPrimary);
        } else if (visualType === 'magnet_B') {
            poly2D(ctx, [[32, 1], [36, 24], [28, 24]], tk.elLightning, '#1B211E', 1.4);
            poly2D(ctx, [[10, 16], [25, 25], [19, 32]], tk.elIce, '#1B211E', 1.4);
            poly2D(ctx, [[54, 16], [39, 25], [45, 32]], tk.elIce, '#1B211E', 1.4);
            poly2D(ctx, [[21, 26], [43, 26], [46, 39], [38, 47], [26, 47], [18, 39]], tk.bgSurface, tk.elLightning, 1.6);
            circle2D(ctx, 32, 36, 5.4, tk.elLightning, '#1B211E', 1.4);
        } else if (visualType === 'plasma_A') {
            poly2D(ctx, [[10, 33], [21, 18], [23, 43], [12, 44]], '#8C2F23', '#1B211E', 1.5);
            poly2D(ctx, [[54, 33], [43, 18], [41, 43], [52, 44]], '#8C2F23', '#1B211E', 1.5);
            poly2D(ctx, [[25, 4], [39, 4], [41, 28], [23, 28]], tk.elFire, '#1B211E', 1.6);
            rect2D(ctx, 28.5, 4, 7, 23, tk.elLightning);
            ellipse2D(ctx, 32, 14, 10, 3.2, null, tk.elLightning, 1.6);
            poly2D(ctx, [[20, 26], [44, 26], [46, 40], [32, 48], [18, 40]], '#6E281E', tk.elLightning, 1.6);
            circle2D(ctx, 32, 36, 6, tk.accentCta, tk.elLightning, 1.4);
        } else if (visualType === 'plasma_B') {
            poly2D(ctx, [[32, 1], [38, 17], [32, 26], [26, 17]], tk.textPrimary, '#1B211E', 1.4);
            poly2D(ctx, [[11, 19], [25, 20], [23, 31], [12, 28]], tk.elLightning, '#1B211E', 1.4);
            poly2D(ctx, [[53, 19], [39, 20], [41, 31], [52, 28]], tk.elFire, '#1B211E', 1.4);
            poly2D(ctx, [[22, 26], [42, 26], [44, 39], [32, 48], [20, 39]], '#7D2B1F', tk.elLightning, 1.5);
            poly2D(ctx, [[32, 27], [38, 36], [32, 44], [26, 36]], tk.elLightning, '#1B211E', 1.2);
        } else if (family === 'fire') {
            poly2D(ctx, [[27, 7], [37, 7], [39, 30], [25, 30]], '#6E281E', '#2B1410', 1.5);
            poly2D(ctx, [[24.5, 6], [39.5, 6], [37.5, 12], [26.5, 12]], tk.accentCta, '#2B1410', 1.5);
            ellipse2D(ctx, 32, 7, 4.5, 2.2, tk.elLightning);
            poly2D(ctx, [[22, 26], [42, 26], [45, 38], [38, 46], [26, 46], [19, 38]], tk.elFire, '#2B1410', 1.5);
            circle2D(ctx, 32, 36, 5, tk.accentCta, '#2B1410', 1.5);
            circle2D(ctx, 31, 34.5, 2.2, tk.textPrimary);
        } else if (family === 'ice') {
            poly2D(ctx, [[18, 16], [24, 28], [19, 38], [14, 32]], tk.elIce, '#143240', 1.5);
            poly2D(ctx, [[46, 16], [40, 28], [45, 38], [50, 32]], '#2E6F8A', '#143240', 1.5);
            poly2D(ctx, [[32, 4], [39, 28], [32, 34], [25, 28]], tk.elIce, '#143240', 1.5);
            poly2D(ctx, [[21, 28], [43, 28], [46, 39], [32, 47], [18, 39]], '#2B6780', '#143240', 1.5);
            poly2D(ctx, [[32, 29], [38, 36], [32, 43], [26, 36]], '#A6D7EA', '#143240', 1.5);
        } else if (family === 'thunder') {
            poly2D(ctx, [[20, 9], [25, 9], [26, 30], [20, 30]], '#5A4B22', '#241F10', 1.5);
            poly2D(ctx, [[39, 9], [44, 9], [44, 30], [38, 30]], '#463A1A', '#241F10', 1.5);
            circle2D(ctx, 22.5, 9, 3.4, tk.elLightning, '#241F10', 1.5);
            circle2D(ctx, 41.5, 9, 3.4, tk.elLightning, '#241F10', 1.5);
            poly2D(ctx, [[19, 28], [45, 28], [47, 40], [39, 47], [25, 47], [17, 40]], '#3D341E', '#241F10', 1.5);
            rect2D(ctx, 23, 30, 18, 4, tk.accentCta);
            rect2D(ctx, 25, 36, 14, 3.5, tk.elLightning);
        } else if (family === 'steam') {
            rect2D(ctx, 23, 7, 8, 22, '#8C3326', '#1E1814', 1.5);
            rect2D(ctx, 33, 7, 8, 22, '#2D6A82', '#1E1814', 1.5);
            rect2D(ctx, 21, 6, 22, 5, tk.textSecondary, '#1E1814', 1.5);
            poly2D(ctx, [[18, 27], [32, 27], [32, 47], [23, 46], [16, 38]], tk.elFire, '#1E1814', 1.5);
            poly2D(ctx, [[32, 27], [46, 27], [48, 38], [41, 46], [32, 47]], tk.elIce, '#1E1814', 1.5);
            circle2D(ctx, 32, 36, 5.5, tk.textPrimary, '#1E1814', 1.5);
            circle2D(ctx, 32, 36, 2.6, tk.accentCta);
        } else if (family === 'magnet') {
            poly2D(ctx, [[18, 6], [25, 6], [26, 33], [17, 37]], tk.elIce, '#142C36', 1.5);
            poly2D(ctx, [[46, 6], [39, 6], [38, 33], [47, 37]], '#9E7E26', '#241F10', 1.5);
            circle2D(ctx, 32, 16, 5, tk.elIce, tk.elLightning, 1.5);
            poly2D(ctx, [[21, 30], [43, 30], [47, 39], [39, 47], [25, 47], [17, 39]], tk.bgSurface, tk.elIce, 1.5);
            circle2D(ctx, 32, 38, 5.2, tk.elLightning, '#142C36', 1.5);
        } else if (visualType === 'storm_tri') {
            circle2D(ctx, 32, 31, 15, '#234857', tk.elIce, 1.8);
            circle2D(ctx, 32, 33, 6.5, tk.elLightning, '#1B211E', 1.5);
            circle2D(ctx, 32, 33, 2.8, '#F4F1EA');
        } else if (visualType === 'starforge_tri') {
            circle2D(ctx, 32, 32, 18.5, null, tk.elIce, 2);
            poly2D(ctx, [[15, 24], [32, 7], [49, 24], [44, 44], [20, 44]], '#6E281E', tk.accentCta, 1.7);
            circle2D(ctx, 32, 33, 6.5, tk.elLightning, '#1B211E', 1.4);
            circle2D(ctx, 32, 33, 3, tk.elIce);
        } else if (visualType === 'prism_tri') {
            poly2D(ctx, [[32, 2], [44, 22], [32, 46], [20, 22]], '#D6EEF7', tk.elIce, 1.7);
            poly2D(ctx, [[10, 18], [22, 25], [18, 36], [9, 30]], tk.elFire, '#1B211E', 1.3);
            poly2D(ctx, [[54, 18], [42, 25], [46, 36], [55, 30]], tk.elLightning, '#1B211E', 1.3);
            circle2D(ctx, 32, 24, 4.5, '#F4F1EA', '#1B211E', 1.3);
        } else if (visualType === 'primal_core') {
            circle2D(ctx, 32, 28, 19, null, '#E0B43C', 2);
            poly2D(ctx, [[22, 46], [32, 10], [42, 46]], '#2D5A3D', '#E0B43C', 1.6);
            circle2D(ctx, 32, 21, 7.2, '#E0B43C', '#1B211E', 1.4);
            circle2D(ctx, 21, 29, 3.4, tk.elFire, '#1B211E', 1.2);
            circle2D(ctx, 43, 29, 3.4, tk.elIce, '#1B211E', 1.2);
            circle2D(ctx, 32, 38, 3.6, tk.elLightning, '#1B211E', 1.2);
        } else {
            poly2D(ctx, [[14, 34], [25, 21], [26, 41], [18, 43]], tk.elFire, '#2B1410', 1.5);
            poly2D(ctx, [[50, 34], [39, 21], [38, 41], [46, 43]], '#8C2F23', '#2B1410', 1.5);
            poly2D(ctx, [[32, 5], [37, 27], [27, 27]], tk.elLightning, '#2B1410', 1.5);
            ellipse2D(ctx, 32, 20, 8, 3.2, null, tk.accentCta, 1.5);
            poly2D(ctx, [[22, 27], [42, 27], [44, 39], [32, 48], [20, 39]], '#7D2B1F', tk.elLightning, 1.5);
            circle2D(ctx, 32, 36, 5.2, tk.accentCta, tk.elLightning, 1.5);
        }

        if (effTier >= 4) {
            circle2D(ctx, 32, 32, 27.5, null, (effTier >= 5 || isScion) ? '#E0B43C' : (isTwinCrown ? '#D97724' : '#B8C2BC'), effTier >= 5 ? 2.2 : 1.5);
            if (effTier >= 5 || isScion) {
                poly2D(ctx, [[23, 8], [28, 13], [32, 4], [36, 13], [41, 8], [39, 16], [25, 16]], '#E0B43C', '#1B211E', 1.2);
            }
        }
    }

    function drawMonsterPortrait2D(ctx, id, tk) {
        ellipse2D(ctx, 32, 57, 19, 5.5, 'rgba(0,0,0,0.40)');
        if (id === 'wood') {
            poly2D(ctx, [[15, 47], [18, 22], [46, 22], [49, 47], [41, 54], [23, 54]], '#523C2B', '#1E1711', 1.5);
            poly2D(ctx, [[16, 24], [25, 13], [32, 19], [39, 13], [48, 24], [38, 29], [26, 29]], '#326B46', '#142C1D', 1.5);
            poly2D(ctx, [[23, 35], [32, 31], [41, 35], [37, 46], [27, 46]], 'rgba(74,222,128,0.28)');
            circle2D(ctx, 25, 31, 2.3, tk.elLightning);
            circle2D(ctx, 39, 31, 2.3, tk.elLightning);
        } else if (id === 'lava') {
            poly2D(ctx, [[16, 47], [18, 22], [28, 15], [36, 15], [46, 22], [48, 47], [39, 54], [25, 54]], '#46201A', '#1B0D0A', 1.5);
            poly2D(ctx, [[21, 23], [32, 17], [43, 23], [41, 34], [23, 34]], '#7D2B1F');
            poly2D(ctx, [[27, 32], [32, 27], [37, 32], [35, 44], [29, 44]], '#C94A38');
            poly2D(ctx, [[30, 33], [34, 33], [32, 40]], tk.elLightning);
            rect2D(ctx, 23, 25, 5, 3, tk.elLightning);
            rect2D(ctx, 36, 25, 5, 3, tk.elLightning);
        } else if (id === 'air') {
            poly2D(ctx, [[10, 36], [22, 28], [42, 28], [54, 36], [42, 46], [22, 46]], '#2F6A82', '#142C36', 1.5);
            circle2D(ctx, 32, 28, 11, '#4A9EBF', '#142C36', 1.5);
            circle2D(ctx, 23, 37, 2.2, tk.elLightning);
            circle2D(ctx, 32, 37, 2.2, tk.elLightning);
            circle2D(ctx, 41, 37, 2.2, tk.elLightning);
            poly2D(ctx, [[26, 46], [38, 46], [32, 53]], '#D97724');
        } else if (id === 'hound') {
            poly2D(ctx, [[12, 41], [24, 25], [22, 12], [31, 21], [40, 12], [39, 24], [52, 32], [45, 42], [42, 53], [33, 44], [24, 53], [20, 43]], '#357690', '#142C36', 1.5);
            poly2D(ctx, [[24, 27], [39, 24], [47, 32], [35, 36], [21, 36]], 'rgba(244,241,234,0.28)');
            poly2D(ctx, [[8, 36], [17, 32], [15, 40]], '#82BDD4');
            circle2D(ctx, 40, 29, 2.3, tk.elLightning);
        } else if (id === 'slime') {
            ellipse2D(ctx, 32, 37, 20, 17, '#3B7A4D', '#16301D', 1.5);
            ellipse2D(ctx, 26, 26, 6, 3, 'rgba(183,228,199,0.55)');
            circle2D(ctx, 25, 35, 3.2, '#1B211E');
            circle2D(ctx, 39, 35, 3.2, '#1B211E');
            circle2D(ctx, 26, 34, 1.2, '#F4F1EA');
            circle2D(ctx, 40, 34, 1.2, '#F4F1EA');
        } else if (id === 'golem') {
            poly2D(ctx, [[11, 45], [14, 19], [24, 14], [40, 14], [50, 19], [53, 45], [45, 54], [19, 54]], '#46544C', '#1B211E', 2);
            poly2D(ctx, [[17, 19], [47, 19], [44, 33], [20, 33]], '#708077');
            rect2D(ctx, 23, 25, 18, 4.5, '#1B211E');
            rect2D(ctx, 25, 26.2, 14, 2.2, '#D97724');
        } else if (id === 'guardian') {
            poly2D(ctx, [[14, 16], [50, 16], [46, 44], [32, 55], [18, 44]], '#234656', tk.elIce, 2);
            poly2D(ctx, [[21, 22], [43, 22], [40, 40], [32, 48], [24, 40]], '#172B36', '#82BDD4', 1.4);
            circle2D(ctx, 26, 30, 2.3, '#F4F1EA');
            circle2D(ctx, 38, 30, 2.3, '#F4F1EA');
        } else if (id === 'healer') {
            circle2D(ctx, 32, 34, 15, '#2D5A3D', '#16301D', 1.6);
            poly2D(ctx, [[32, 10], [38, 22], [50, 20], [40, 30], [45, 42], [32, 36], [19, 42], [24, 30], [14, 20], [26, 22]], '#4E9A68', '#16301D', 1.4);
            rect2D(ctx, 29.5, 27, 5, 14, '#F4F1EA');
            rect2D(ctx, 25, 31.5, 14, 5, '#F4F1EA');
        } else if (id === 'panther') {
            poly2D(ctx, [[12, 38], [23, 22], [25, 11], [32, 20], [40, 11], [42, 23], [53, 33], [44, 44], [36, 52], [24, 49]], '#273238', '#46544C', 1.6);
            poly2D(ctx, [[25, 25], [39, 24], [46, 32], [34, 37], [22, 34]], '#35444C');
            circle2D(ctx, 38, 28, 2.3, tk.elIce);
            circle2D(ctx, 29, 28, 2.1, tk.elIce);
        } else if (id === 'bomber') {
            circle2D(ctx, 32, 36, 16, '#4A211B', '#1B0D0A', 1.8);
            rect2D(ctx, 28, 13, 8, 7, '#6E281E', '#1B0D0A', 1.4);
            poly2D(ctx, [[32, 5], [36, 12], [28, 12]], tk.elLightning);
            circle2D(ctx, 32, 37, 7.5, tk.elFire, tk.elLightning, 1.6);
            circle2D(ctx, 32, 37, 3, tk.elLightning);
        } else if (id === 'thief') {
            const cx = 32;
            const cy = 32;
            const s = 58;
            ctx.fillStyle = '#D97724';
            ctx.strokeStyle = '#1E1710';
            ctx.lineWidth = Math.max(1.5, s * 0.035);
            ctx.beginPath();
            ctx.moveTo(cx - s * 0.28, cy - s * 0.14);
            ctx.lineTo(cx - s * 0.34, cy - s * 0.38);
            ctx.lineTo(cx - s * 0.10, cy - s * 0.22);
            ctx.lineTo(cx + s * 0.10, cy - s * 0.22);
            ctx.lineTo(cx + s * 0.34, cy - s * 0.38);
            ctx.lineTo(cx + s * 0.28, cy - s * 0.14);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = '#E08B35';
            ctx.beginPath();
            ctx.ellipse(cx, cy - s * 0.02, s * 0.26, s * 0.20, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = '#F4F1EA';
            ctx.beginPath();
            ctx.arc(cx - s * 0.10, cy - s * 0.04, s * 0.055, 0, Math.PI * 2);
            ctx.arc(cx + s * 0.10, cy - s * 0.04, s * 0.055, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#1B211E';
            ctx.beginPath();
            ctx.arc(cx - s * 0.09, cy - s * 0.04, s * 0.026, 0, Math.PI * 2);
            ctx.arc(cx + s * 0.09, cy - s * 0.04, s * 0.026, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#2C3530';
            ctx.strokeStyle = '#E0B43C';
            ctx.beginPath();
            if (typeof ctx.roundRect === 'function') {
                ctx.roundRect(cx - s * 0.18, cy + s * 0.14, s * 0.36, s * 0.22, s * 0.06);
            } else {
                ctx.rect(cx - s * 0.18, cy + s * 0.14, s * 0.36, s * 0.22);
            }
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = '#E0B43C';
            ctx.beginPath();
            ctx.arc(cx, cy + s * 0.25, s * 0.06, 0, Math.PI * 2);
            ctx.fill();
        } else if (id === 'void_boss') {
            poly2D(ctx, [[11, 45], [15, 17], [26, 12], [32, 6], [38, 12], [49, 17], [53, 45], [43, 55], [21, 55]], '#1E2723', tk.elLightning, 2);
            poly2D(ctx, [[32, 19], [40, 32], [32, 45], [24, 32]], tk.accentCta, tk.elLightning, 1.6);
            circle2D(ctx, 23, 28, 2.5, tk.elLightning);
            circle2D(ctx, 41, 28, 2.5, tk.elLightning);
        } else {
            const mCfg = getMonstersDict()[id] || {};
            const vis = mCfg.visual || {};
            const primary = vis.primaryColor || mCfg.color || '#6D4C41';
            const accent = vis.accentColor || tk.elLightning;
            poly2D(ctx, [[14, 46], [18, 20], [32, 13], [46, 20], [50, 46], [41, 54], [23, 54]], primary, '#1B211E', 1.6);
            poly2D(ctx, [[22, 24], [32, 18], [42, 24], [39, 42], [25, 42]], 'rgba(244,241,234,0.18)');
            circle2D(ctx, 25, 29, 2.6, accent);
            circle2D(ctx, 39, 29, 2.6, accent);
            poly2D(ctx, [[28, 37], [36, 37], [32, 45]], accent);
        }
    }

    function drawTerrainPortrait2D(ctx, id, tk) {
        if (id === 'highground') {
            poly2D(ctx, [[8, 52], [24, 16], [35, 32], [46, 12], [56, 52]], '#3B3524', tk.elLightning, 2);
            poly2D(ctx, [[16, 46], [26, 25], [35, 36], [44, 22], [50, 46]], 'rgba(224,180,60,0.28)');
        } else if (id === 'mana_vein') {
            circle2D(ctx, 32, 32, 22, 'rgba(74,158,191,0.18)', tk.elIce, 1.8);
            poly2D(ctx, [[32, 10], [48, 32], [32, 54], [16, 32]], '#233840', tk.elIce, 2);
            circle2D(ctx, 32, 32, 5.5, tk.elIce);
        } else if (id === 'world_tree') {
            circle2D(ctx, 32, 32, 22, 'rgba(78,154,104,0.18)', '#4E9A68', 1.8);
            poly2D(ctx, [[32, 10], [48, 26], [42, 46], [32, 54], [22, 46], [16, 26]], '#233C2E', '#4E9A68', 2);
            rect2D(ctx, 30.5, 18, 3, 30, '#A8D5B5');
        } else {
            poly2D(ctx, [[10, 48], [18, 22], [33, 16], [48, 24], [54, 48], [40, 54], [20, 54]], '#46544C', '#B8C2BC', 1.8);
        }
    }

    function applySilhouettePass(canvasEl, ctx) {
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalCompositeOperation = 'source-in';
        ctx.fillStyle = '#0B0E0D';
        ctx.fillRect(0, 0, canvasEl.width, canvasEl.height);
        ctx.restore();
    }

    /**
     * 統一角色／怪物／地形肖像繪製器
     * @param {HTMLCanvasElement} canvasEl 目標 Canvas 元素
     * @param {'tower'|'monster'|'terrain'} category 類別
     * @param {string} id 條目 ID
     * @param {Object} options { tier, size, silhouette, image }
     */
    function drawPortrait(canvasEl, category, id, options = {}) {
        if (!canvasEl || typeof canvasEl.getContext !== 'function') return false;
        const cssSize = Number(options.size) || Number(canvasEl.dataset && canvasEl.dataset.size) || canvasEl.clientWidth || canvasEl.width || 64;
        const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) ? Math.min(2, window.devicePixelRatio) : 1;
        const pxSize = Math.max(16, Math.round(cssSize * dpr));

        if (canvasEl.width !== pxSize || canvasEl.height !== pxSize) {
            canvasEl.width = pxSize;
            canvasEl.height = pxSize;
        }
        const ctx = canvasEl.getContext('2d');
        if (!ctx) return false;

        const isSilhouette = Boolean(options.silhouette);
        canvasEl.dataset.portraitCategory = String(category || 'tower');
        canvasEl.dataset.portraitId = String(id || '');
        canvasEl.dataset.silhouette = isSilhouette ? 'true' : 'false';

        // 查找對應資料物件，檢查是否配置了自訂圖片路徑 image
        let dataObj = null;
        if (category === 'tower') dataObj = getTowersDict()[id];
        else if (category === 'monster') dataObj = getMonstersDict()[id];
        else if (category === 'terrain') dataObj = getTerrainsDict()[id];

        const customImageSrc = options.image || (dataObj && dataObj.image) || '';
        const tk = getThemeTokens();
        const scale = pxSize / 64;

        // 先同步繪製 2.5D 幾何肖像（確保離線、未填圖片或圖片載入中皆立即呈現完整畫面）
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, pxSize, pxSize);
        ctx.scale(scale, scale);

        if (category === 'tower') {
            const defaultTier = (dataObj && dataObj.isHybrid) ? 2 : 1;
            drawTowerPortrait2D(ctx, id, options.tier || defaultTier, tk);
        } else if (category === 'monster') {
            drawMonsterPortrait2D(ctx, id, tk);
        } else if (category === 'terrain') {
            drawTerrainPortrait2D(ctx, id, tk);
        }
        ctx.restore();

        if (isSilhouette) {
            applySilhouettePass(canvasEl, ctx);
        }

        // 若資料表有填寫自訂圖片路徑（如 'assets/fire.png'），優先載入並覆蓋繪製
        if (customImageSrc && typeof Image !== 'undefined') {
            const renderLoadedImg = (img) => {
                ctx.save();
                ctx.setTransform(1, 0, 0, 1, 0, 0);
                ctx.clearRect(0, 0, pxSize, pxSize);
                ctx.drawImage(img, 0, 0, pxSize, pxSize);
                ctx.restore();
                if (isSilhouette) applySilhouettePass(canvasEl, ctx);
            };
            const cached = imageCache.get(customImageSrc);
            if (cached && cached.complete && cached.naturalWidth > 0) {
                renderLoadedImg(cached);
            } else if (!cached) {
                const img = new Image();
                imageCache.set(customImageSrc, img);
                img.onload = () => {
                    if (img.naturalWidth > 0) renderLoadedImg(img);
                };
                img.onerror = () => {
                    imageCache.delete(customImageSrc);
                };
                img.src = customImageSrc;
            }
        }
        return true;
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

    /**
     * 格子內 Canvas 文字限寬繪製工具：依 cellWidth - 8 自動縮放字級並以 fillText(..., maxWidth) 防溢出
     */
    function fillCellClampedText(ctx, text, x, y, cellWidth, baseFontSize = 11, options = {}) {
        if (!ctx || text === undefined || text === null) return;
        const str = String(text);
        const maxWidth = Math.max(8, (Number(cellWidth) || (G && G.boardMetrics && G.boardMetrics.cellW) || 34) - 8);
        const weight = options.fontWeight || '700';
        const family = options.fontFamily || '"Noto Sans TC", "Plus Jakarta Sans", sans-serif';
        let fontSize = Math.max(8, Number(baseFontSize) || 11);

        ctx.save();
        ctx.font = `${weight} ${fontSize}px ${family}`;
        while (fontSize > 8 && ctx.measureText(str).width > maxWidth) {
            fontSize -= 0.5;
            ctx.font = `${weight} ${fontSize}px ${family}`;
        }
        if (options.align) ctx.textAlign = options.align;
        if (options.baseline) ctx.textBaseline = options.baseline;
        if (options.fillStyle) ctx.fillStyle = options.fillStyle;
        ctx.fillText(str, x, y, maxWidth);
        ctx.restore();
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
        if (Array.isArray(fx.weatherParticles)) fx.weatherParticles.length = 0;
        fx.stormFlashMs = 0;
        fx.stormFlashCdMs = 5200;
        fx.leafEmitAccMs = 0; fx.frenzyFxAccMs = 0;
        const { fxCtx, fxCanvasEl } = G.dom;
        if (fxCtx && fxCanvasEl) fxCtx.clearRect(0, 0, fxCanvasEl.width || G.boardMetrics.stageW, fxCanvasEl.height || G.boardMetrics.stageH);
    }

    function pushCanvasParticle(particle) {
        const particles = G && G.fxEntities && G.fxEntities.particles;
        if (!particles) return;
        if (particles.length >= 200) {
            particles.splice(0, particles.length - 199);
        }
        particles.push(particle);
    }

    function emitParticleBurst(x, y, color, count = 8, speedMax = 85) {
        for (let i = 0; i < count; i++) {
            const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
            const speed = speedMax * (0.45 + Math.random() * 0.55);
                pushCanvasParticle({
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

    function spawnDamageNumber(amount, isWeakness, px, py, tagPrefix = '', isAffinity = false) {
        const layer = G.dom.floatingLayerEl;
        if (!layer) return;
        const activeDmg = layer.getElementsByClassName('floating-dmg');
        while (activeDmg.length >= 40 && activeDmg[0]) {
            activeDmg[0].remove();
        }
        const dmgEl = document.createElement('div');
        const toneClass = isWeakness ? 'weakness' : (isAffinity ? 'affinity' : 'normal');
        dmgEl.classList.add('floating-dmg', toneClass);
        const weakLabel = (GameApp.i18n && typeof GameApp.i18n.pick === 'function') ? GameApp.i18n.pick('弱點!', 'WEAK!') : '弱點!';
        const affinityLabel = (GameApp.i18n && typeof GameApp.i18n.pick === 'function') ? GameApp.i18n.pick('親和', 'Affinity') : '親和';
        dmgEl.innerText = isWeakness ? `${weakLabel} -${amount}` : (isAffinity ? `${affinityLabel} -${amount}` : `${tagPrefix}-${amount}`);
        dmgEl.style.left = `${px + (Math.random() - 0.5) * 18}px`;
        dmgEl.style.top = `${py - 18 + (Math.random() - 0.5) * 8}px`;
        const durationMs = Math.round(720 / Math.max(1, clampNumber(G.state.gameSpeed, 1, 5, 1) * 0.75));
        dmgEl.style.animationDuration = `${durationMs}ms`;
        layer.appendChild(dmgEl);
        G.callbacks.scheduleTimeout(() => dmgEl.remove(), durationMs);
    }

    function spawnFloatingNotice(text, px, py, toneClass = 'pity-seed') {
        const layer = G && G.dom && G.dom.floatingLayerEl;
        if (!layer || !text) return;
        const noteEl = document.createElement('div');
        noteEl.classList.add('floating-notice', toneClass || 'pity-seed');
        noteEl.innerText = text;
        const stageW = (G.boardMetrics && G.boardMetrics.stageW) || 560;
        const clampedLeft = Math.max(92, Math.min(stageW - 92, Number(px) || stageW / 2));
        const safeTop = Math.max(22, (Number(py) || 40) - 18);
        noteEl.style.left = `${clampedLeft}px`;
        noteEl.style.top = `${safeTop}px`;
        layer.appendChild(noteEl);
        if (G.callbacks && typeof G.callbacks.scheduleTimeout === 'function') {
            G.callbacks.scheduleTimeout(() => noteEl.remove(), 1450);
        } else {
            setTimeout(() => noteEl.remove(), 1450);
        }
    }

    function emitCanvasAttackFX(fxType, fromPos, toPos, options = {}) {
        const sx = fromPos.left, sy = fromPos.top, ex = toPos.left, ey = toPos.top;
        const fx = G.fxEntities;
        const tk = getThemeTokens();
        const tCfg = getTowersDict()[fxType];
        const style = (tCfg && tCfg.attackStyle) || fxType;

        if (fxType === 'storm_tri') {
            const pts = [{ x: sx, y: sy }];
            for (let s = 1; s < 4; s++) {
                const t = s / 4;
                pts.push({ x: sx + (ex - sx) * t + (Math.random() - 0.5) * 22, y: sy + (ey - sy) * t + (Math.random() - 0.5) * 22 });
            }
            pts.push({ x: ex, y: ey });
            fx.bolts.push({ points: pts, color: tk.elIce, coreColor: tk.elLightning, width: 2.3, ageMs: 0, durationMs: 220 });
            if (options.frostRadiusPx > 0) emitRingFX(ex, ey, options.frostRadiusPx, tk.elIce, 0.16, 300);
            emitParticleBurst(ex, ey, tk.elLightning, 7, 80);
            emitHitFlash(ex, ey, tk.textPrimary);
            return;
        }
        if (fxType === 'starforge_tri') {
            fx.projectiles.push({ fxType, x1: sx, y1: sy, x2: ex, y2: ey, color: tk.accentCta, radius: 5.0, ageMs: 0, durationMs: 140 });
            const rad = options.splashRadiusPx || (G.boardMetrics.step * 1.8);
            emitRingFX(ex, ey, rad, tk.elFire, 0.25, 320);
            emitRingFX(ex, ey, rad * 0.65, tk.elIce, 0.22, 280);
            emitParticleBurst(ex, ey, tk.elLightning, 12, 110);
            emitHitFlash(ex, ey, tk.elLightning);
            return;
        }
        if (fxType === 'prism_tri') {
            fx.beams.push({ x1: sx, y1: sy, x2: ex, y2: ey, width: 2.6, color: '#8EE8FF', coreColor: tk.textPrimary, ageMs: 0, durationMs: 185 });
            emitParticleBurst(ex, ey, '#8EE8FF', 6, 72);
            emitHitFlash(ex, ey, tk.textPrimary);
            return;
        }
        if (fxType === 'primal_core') {
            fx.beams.push({ x1: sx, y1: sy, x2: ex, y2: ey, width: 3.2, color: '#E0B43C', coreColor: '#F4F1EA', ageMs: 0, durationMs: 210 });
            if (options.splashRadiusPx > 0) emitRingFX(ex, ey, options.splashRadiusPx, '#E0B43C', 0.26, 320);
            emitParticleBurst(ex, ey, '#E0B43C', 11, 100);
            emitHitFlash(ex, ey, '#F4F1EA');
            return;
        }
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
                        pushCanvasParticle({
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

        // 地面持續傷害區域（steam_A 蒸氣池、scorched_brand 焦土烙印、storm_tri 熾凍雷雲）
        if (Array.isArray(st.groundHazards)) {
            for (let i = 0; i < st.groundHazards.length; i++) {
                const hz = st.groundHazards[i];
                const alpha = Math.max(0.18, Math.min(0.88, (hz.remainingMs || 0) / (hz.maxDurationMs || 3000)));
                if (hz.type === 'storm_cloud') {
                    fxCtx.save();
                    fillCircle2D(fxCtx, hz.x, hz.y, hz.radiusPx, '#264352', alpha * 0.26);
                    fxCtx.globalAlpha = alpha * 0.78;
                    fxCtx.strokeStyle = tk.elIce;
                    fxCtx.lineWidth = 1.6;
                    fxCtx.setLineDash([7, 4]);
                    fxCtx.beginPath();
                    fxCtx.arc(hz.x, hz.y, hz.radiusPx, 0, Math.PI * 2);
                    fxCtx.stroke();
                    fxCtx.strokeStyle = tk.elLightning;
                    fxCtx.lineWidth = 1.1;
                    fxCtx.setLineDash([3, 5]);
                    fxCtx.beginPath();
                    fxCtx.arc(hz.x, hz.y, hz.radiusPx * 0.62, 0, Math.PI * 2);
                    fxCtx.stroke();
                    fxCtx.restore();
                    continue;
                }
                const isScorch = hz.type === 'scorch_trail';
                fxCtx.save();
                fillCircle2D(fxCtx, hz.x, hz.y, hz.radiusPx, isScorch ? tk.elFire : tk.accentCta, alpha * (isScorch ? 0.28 : 0.22));
                fxCtx.globalAlpha = alpha * 0.82;
                fxCtx.strokeStyle = isScorch ? tk.accentCta : tk.elFire;
                fxCtx.lineWidth = isScorch ? 1.4 : 1.6;
                fxCtx.setLineDash(isScorch ? [3, 3] : [5, 3]);
                fxCtx.beginPath();
                fxCtx.arc(hz.x, hz.y, hz.radiusPx, 0, Math.PI * 2);
                fxCtx.stroke();
                fxCtx.restore();
            }
        }

        // 唯一 5★ 創世世界樹·原初之核：周圍 8 格友軍金色靈脈連線
        const AttackSysLey = GameApp.systems && GameApp.systems.towerAttack;
        if (G.callbacks.isGameplayActive() && Array.isArray(st.board) && AttackSysLey && typeof AttackSysLey.getPrimalCoreLinkedNeighbors === 'function') {
            for (let idx = 0; idx < st.board.length; idx++) {
                const t = st.board[idx];
                if (!t || t.type !== 'primal_core') continue;
                const linkedNeighbors = AttackSysLey.getPrimalCoreLinkedNeighbors(idx);
                if (linkedNeighbors.length === 0) continue;
                const cCore = indexToCoords(idx);
                const pCore = getCellCenter(cCore.x, cCore.y);
                const flowPhase = ((st.elapsedPlayMs || 0) % 1400) / 1400;
                fxCtx.save();
                for (let ni = 0; ni < linkedNeighbors.length; ni++) {
                    const nIdx = linkedNeighbors[ni];
                    const cn = indexToCoords(nIdx);
                    const pn = getCellCenter(cn.x, cn.y);
                    strokeLine2D(fxCtx, pCore.left, pCore.top, pn.left, pn.top, '#E0B43C', 2.4, 0.56);
                    strokeLine2D(fxCtx, pCore.left, pCore.top, pn.left, pn.top, '#F4F1EA', 1.0, 0.72);
                    const bx = pCore.left + (pn.left - pCore.left) * flowPhase;
                    const by = pCore.top + (pn.top - pCore.top) * flowPhase;
                    fillCircle2D(fxCtx, bx, by, 2.6, '#E0B43C', 0.92);
                }
                fxCtx.restore();
            }
        }

        // 拖曳合成懸停／子彈時間進化確認期間的金色血脈連線
        const tether = st.dragTether || (st.pendingEvolution
            ? { fromIndex: st.pendingEvolution.fromIndex, toIndex: st.pendingEvolution.toIndex, isValid: true }
            : null);
        if (tether && Number.isFinite(tether.fromIndex) && Number.isFinite(tether.toIndex)) {
            const cFrom = indexToCoords(tether.fromIndex), cTo = indexToCoords(tether.toIndex);
            const pFrom = getCellCenter(cFrom.x, cFrom.y), pTo = getCellCenter(cTo.x, cTo.y);
            const lineColor = tether.isValid === false ? tk.elFire : tk.elLightning;
            fxCtx.save();
            fxCtx.strokeStyle = lineColor;
            fxCtx.lineWidth = 2.4;
            fxCtx.setLineDash([6, 4]);
            fxCtx.beginPath();
            fxCtx.moveTo(pFrom.left, pFrom.top);
            fxCtx.lineTo(pTo.left, pTo.top);
            fxCtx.stroke();
            fillCircle2D(fxCtx, pFrom.left, pFrom.top, 4.5, lineColor, 0.9);
            fillCircle2D(fxCtx, pTo.left, pTo.top, 5.5, lineColor, 0.95);
            fxCtx.restore();
        }

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

        // 動態天氣環境粒子與偶發雷暴 80ms 微閃（僅視覺裝飾，不影響戰鬥隨機數）
        const weather = st.weatherType;
        if (G.callbacks.isGameplayActive() && weather && m.stageW > 0 && m.stageH > 0) {
            if (!Array.isArray(fx.weatherParticles)) fx.weatherParticles = [];
            const targetCount = weather === 'storm' ? 28 : (weather === 'snow' ? 22 : 16);
            while (fx.weatherParticles.length < targetCount) {
                fx.weatherParticles.push({
                    x: Math.random() * m.stageW,
                    y: Math.random() * m.stageH,
                    phase: Math.random() * Math.PI * 2,
                    scale: 0.7 + Math.random() * 0.7
                });
            }
            if (fx.weatherParticles.length > targetCount) {
                fx.weatherParticles.length = targetCount;
            }
            fxCtx.save();
            for (let i = 0; i < fx.weatherParticles.length; i++) {
                const wp = fx.weatherParticles[i];
                if (weather === 'snow') {
                    wp.x += (Math.sin((st.elapsedPlayMs || 0) * 0.002 + wp.phase) * 14 - 8) * dtSec;
                    wp.y += (24 * wp.scale) * dtSec;
                    if (wp.y > m.stageH + 4) { wp.y = -4; wp.x = Math.random() * m.stageW; }
                    if (wp.x < -4) wp.x = m.stageW + 4;
                    if (wp.x > m.stageW + 4) wp.x = -4;
                    fillCircle2D(fxCtx, wp.x, wp.y, 1.8 * wp.scale, '#DCECF2', 0.44);
                } else if (weather === 'storm') {
                    wp.x -= (78 * wp.scale) * dtSec;
                    wp.y += (175 * wp.scale) * dtSec;
                    if (wp.y > m.stageH + 10 || wp.x < -10) {
                        wp.y = -10;
                        wp.x = Math.random() * (m.stageW + 60);
                    }
                    strokeLine2D(fxCtx, wp.x, wp.y, wp.x + 5, wp.y - 12, '#B6CFD9', 1.1, 0.28);
                } else {
                    wp.x += Math.sin((st.elapsedPlayMs || 0) * 0.0018 + wp.phase) * 9 * dtSec;
                    wp.y -= (14 * wp.scale) * dtSec;
                    if (wp.y < -6) { wp.y = m.stageH + 6; wp.x = Math.random() * m.stageW; }
                    fillCircle2D(fxCtx, wp.x, wp.y, 1.9 * wp.scale, '#E0B43C', 0.30);
                }
            }
            if (weather === 'storm') {
                fx.stormFlashCdMs = (fx.stormFlashCdMs ?? 5200) - dtMs;
                if (fx.stormFlashCdMs <= 0) {
                    fx.stormFlashMs = 80;
                    fx.stormFlashCdMs = 5200 + Math.random() * 4200;
                }
                if ((fx.stormFlashMs || 0) > 0) {
                    const flashAlpha = Math.max(0, Math.min(0.14, (fx.stormFlashMs / 80) * 0.14));
                    fx.stormFlashMs = Math.max(0, fx.stormFlashMs - dtMs);
                    fxCtx.globalAlpha = flashAlpha;
                    fxCtx.fillStyle = '#E6F1F5';
                    fxCtx.fillRect(0, 0, m.stageW, m.stageH);
                }
            }
            fxCtx.restore();
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
        el.dataset.monsterId = String(monster.id);
        if (monster.isElite) el.classList.add('elite');
        if (monster.isBoss) el.classList.add('boss');
        if (monster.isSplitChild) el.classList.add('mini-slime');
        el.addEventListener('click', (e) => {
            if (G && G.state && G.state.isPaused && G.callbacks && typeof G.callbacks.inspectMonsterById === 'function') {
                e.stopPropagation();
                G.callbacks.inspectMonsterById(monster.id);
            }
        });

        const isEn = Boolean(GameApp.i18n && GameApp.i18n.isEnglish());
        const armorPrefix = isEn ? 'ARM ' : '甲 ';
        const armorHtml = monster.armor > 0 ? `<span class="m-armor-badge num">${armorPrefix}${monster.armor}</span>` : '';
        const weakCfg = getTowersDict()[monster.weakness];
        const weakText = (GameApp.i18n && typeof GameApp.i18n.getWeaknessLabel === 'function')
            ? GameApp.i18n.getWeaknessLabel(monster.weakness)
            : (weakCfg ? weakCfg.name.charAt(0) : (monster.weakness || ''));
        const weakShort = weakCfg ? `${weakCfg.icon}${weakText}` : weakText;
        const bossHtml = monster.isBoss ? `<span class="m-boss-badge weak-${monster.weakness}">${isEn ? 'B·' : '王·弱'}${weakShort}</span>` : '';
        el.innerHTML = `<div class="m-hud-stack" aria-hidden="true"><div class="m-debuff-strip"></div><div class="m-shield-bar hidden"><div class="m-shield-fill"></div></div><div class="m-hp-bar"><div class="m-hp-fill"></div></div></div>${armorHtml}<span class="m-icon">${createMonsterSvgHtml(monster)}</span>${bossHtml}`;
        G.dom.monsterLayerEl.appendChild(el);
        const rec = {
            el,
            hpFillEl: el.querySelector('.m-hp-fill'),
            shieldBarEl: el.querySelector('.m-shield-bar'),
            shieldFillEl: el.querySelector('.m-shield-fill'),
            armorBadgeEl: el.querySelector('.m-armor-badge'),
            bossBadgeEl: el.querySelector('.m-boss-badge'),
            debuffStripEl: el.querySelector('.m-debuff-strip'),
            lastDebuffHtml: '',
            lastWeakness: monster.weakness,
            lastLang: isEn ? 'en' : 'zh-TW'
        };
        G.monsterDomMap.set(monster.id, rec);
        return rec;
    }

    function removeMonsterDom(monsterId) {
        const rec = G.monsterDomMap.get(monsterId);
        if (rec) { rec.el.remove(); G.monsterDomMap.delete(monsterId); }
    }

    function buildMonsterDebuffMicroHtml(m, MonsterSys) {
        const st = m.status;
        if (!st && (m.armorShredTimer || 0) <= 0 && (m.slowTimer || 0) <= 0) return '';
        const isEn = Boolean(GameApp.i18n && GameApp.i18n.isEnglish());
        const tags = [];
        if (st && st.burn && st.burn.stacks > 0 && st.burn.durationMs > 0) {
            tags.push(`<span class="m-debuff-tag debuff-burn num">🔥${st.burn.stacks}${isEn ? '' : '層'}</span>`);
        }
        const frozen = MonsterSys && typeof MonsterSys.isMonsterFrozen === 'function' && MonsterSys.isMonsterFrozen(m);
        const slowed = MonsterSys && typeof MonsterSys.isMonsterSlowed === 'function' ? MonsterSys.isMonsterSlowed(m) : (m.slowTimer > 0);
        if (frozen || slowed) {
            tags.push('<span class="m-debuff-tag debuff-ice">❄️</span>');
        }
        if (st && st.shock && st.shock.durationMs > 0) {
            tags.push('<span class="m-debuff-tag debuff-shock">⚡</span>');
        }
        const hasShred = (m.armorShredTimer || 0) > 0;
        const hasGrievous = Boolean(st && st.grievousWound && st.grievousWound.durationMs > 0);
        const hasVuln = MonsterSys && typeof MonsterSys.getMonsterVulnerabilityMultiplier === 'function' && MonsterSys.getMonsterVulnerabilityMultiplier(m) > 1.01;
        if (hasShred || hasGrievous || hasVuln) {
            tags.push('<span class="m-debuff-tag debuff-wound">💔</span>');
        }
        return tags.join('');
    }

    function triggerMonsterHitFlash(monsterId) {
        const rec = G && G.monsterDomMap ? G.monsterDomMap.get(monsterId) : null;
        if (!rec || !rec.el) return;
        const useB = rec.el.classList.contains('hit-flash-a');
        rec.el.classList.remove('hit-flash-a', 'hit-flash-b');
        rec.el.classList.add(useB ? 'hit-flash-b' : 'hit-flash-a');
    }

    function renderMonsterLayer() {
        if (!G || !G.dom || !G.dom.monsterLayerEl) return;
        const monsters = G.state.monsters;
        const activeIds = new Set();
        for (let i = 0; i < monsters.length; i++) {
            const m = monsters[i];
            if (m && m.hp > 0 && !m._killHandled && !m._dead) activeIds.add(m.id);
        }
        for (const [id, rec] of G.monsterDomMap.entries()) {
            if (!activeIds.has(id)) { rec.el.remove(); G.monsterDomMap.delete(id); }
        }

        const MonsterSys = GameApp.systems && GameApp.systems.monster;
        const isEnNow = Boolean(GameApp.i18n && GameApp.i18n.isEnglish());
        const curLang = isEnNow ? 'en' : 'zh-TW';
        for (let i = 0; i < monsters.length; i++) {
            const m = monsters[i];
            if (!m || m.hp <= 0 || m._killHandled || m._dead) continue;
            const rec = G.monsterDomMap.get(m.id) || createMonsterDom(m);
            rec.el.style.left = `${m.pixelX}px`;
            rec.el.style.top = `${m.pixelY}px`;
            const isSlowed = MonsterSys && typeof MonsterSys.isMonsterSlowed === 'function' ? MonsterSys.isMonsterSlowed(m) : (m.slowTimer > 0);
            const isFrozen = MonsterSys && typeof MonsterSys.isMonsterFrozen === 'function' ? MonsterSys.isMonsterFrozen(m) : false;
            rec.el.classList.toggle('slowed', isSlowed || isFrozen);
            rec.el.classList.toggle('frozen', isFrozen);
            rec.el.classList.toggle('rooted', (m.rootTimer || 0) > 0);
            rec.el.classList.toggle('stealthed', Boolean(m.isStealthed));
            if (m.isBoss && rec.bossBadgeEl && (rec.lastWeakness !== m.weakness || rec.lastLang !== curLang)) {
                rec.lastWeakness = m.weakness;
                rec.lastLang = curLang;
                const weakCfg = getTowersDict()[m.weakness];
                const weakText = (GameApp.i18n && typeof GameApp.i18n.getWeaknessLabel === 'function')
                    ? GameApp.i18n.getWeaknessLabel(m.weakness)
                    : (weakCfg ? weakCfg.name.charAt(0) : (m.weakness || ''));
                const weakShort = weakCfg ? `${weakCfg.icon}${weakText}` : weakText;
                rec.bossBadgeEl.className = `m-boss-badge weak-${m.weakness}`;
                rec.bossBadgeEl.innerText = `${isEnNow ? 'B·' : '王·弱'}${weakShort}`;
            }
            if (rec.debuffStripEl) {
                const debuffHtml = buildMonsterDebuffMicroHtml(m, MonsterSys);
                if (rec.lastDebuffHtml !== debuffHtml) {
                    rec.debuffStripEl.innerHTML = debuffHtml;
                    rec.lastDebuffHtml = debuffHtml;
                }
            }
            if (rec.shieldBarEl && rec.shieldFillEl) {
                const hasShield = (m.shield || 0) > 0 && (m.maxShield || 0) > 0;
                rec.shieldBarEl.classList.toggle('hidden', !hasShield);
                if (hasShield) {
                    rec.shieldFillEl.style.width = `${Math.max(0, Math.min(100, (m.shield / m.maxShield) * 100))}%`;
                }
            }
            if (m.armor > 0 && rec.armorBadgeEl) {
                const isEn = Boolean(GameApp.i18n && GameApp.i18n.isEnglish());
                const isShredded = m.armorShredTimer > 0;
                rec.armorBadgeEl.classList.toggle('shredded', isShredded);
                const effArmor = MonsterSys ? MonsterSys.getMonsterEffectiveArmor(m) : m.armor;
                rec.armorBadgeEl.innerText = isShredded ? `🔥${Math.round(effArmor)}` : `${isEn ? 'ARM ' : '甲 '}${m.armor}`;
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
        if (G && G.dom && G.dom.rangeCircleEl && G.state && G.state.selectedIndex === null) {
            G.dom.rangeCircleEl.className = '';
            G.dom.rangeCircleEl.style.width = '';
            G.dom.rangeCircleEl.style.height = '';
        }
        updateRangeIndicator();
    }

    function createTowerElement(towerObj, index) {
        const st = G.state;
        const { family, branchCode, isTwinCrown, isTriElement, isPrimalCore } = resolveTowerVisualFamily(towerObj.type);
        const AttackSys = GameApp.systems && GameApp.systems.towerAttack;
        const EvoSys = GameApp.systems && GameApp.systems.evolution;
        const scionAura = (AttackSys && typeof AttackSys.getScionAuraAtCell === 'function')
            ? AttackSys.getScionAuraAtCell(index)
            : { active: false };
        const tower = document.createElement('div');
        tower.classList.add('tower', `type-${family}`, `node-${towerObj.type}`, `lv-${towerObj.tier}`);
        tower.dataset.towerIndex = String(index);
        if (st.frenzyActiveMs > 0) tower.classList.add('frenzy-active');
        if (towerObj.isCrowned) tower.classList.add('is-crowned');
        if (towerObj.tier >= 5) tower.classList.add('is-scion');
        if (isTwinCrown) tower.classList.add('is-twin-crown');
        if (isTriElement) tower.classList.add('is-tri-element');
        if (isPrimalCore) tower.classList.add('is-primal-core');
        if (scionAura && scionAura.active) tower.classList.add('has-scion-aura');
        if ((towerObj.stunnedMs || 0) > 0) tower.classList.add('stunned');

        const palTier = getTowerPaletteForType(towerObj.type, getThemeTokens());
        if (towerObj.tier === 3 || towerObj.tier === 4) {
            const tierRing = document.createElement('div');
            tierRing.className = `tower-tier-ring tier-ring-${towerObj.tier}${isTwinCrown ? ' is-twin' : ''}`;
            tierRing.setAttribute('aria-hidden', 'true');
            tierRing.style.setProperty('--tier-ring-color', (palTier && palTier.rune) || '#D97724');
            tierRing.style.setProperty('--tier-ring-secondary', (palTier && palTier.glow) || '#E0B43C');
            tower.appendChild(tierRing);
        }
        if (towerObj.tier >= 5) {
            const scionCircle = document.createElement('div');
            scionCircle.className = 'tower-scion-circle';
            scionCircle.setAttribute('aria-hidden', 'true');
            scionCircle.innerHTML = '<svg viewBox="0 0 80 80"><circle cx="40" cy="40" r="37" fill="none" stroke="#E0B43C" stroke-width="1.3" stroke-dasharray="5 3"/><circle cx="40" cy="40" r="30" fill="none" stroke="#D97724" stroke-width="1.1" opacity="0.85"/><polygon points="40,5 48,32 75,40 48,48 40,75 32,48 5,40 32,32" fill="none" stroke="#E0B43C" stroke-width="1.1" opacity="0.72"/><polygon points="16,16 40,26 64,16 54,40 64,64 40,54 16,64 26,40" fill="none" stroke="#D97724" stroke-width="1" opacity="0.6"/></svg>';
            tower.appendChild(scionCircle);
        }

        const { baseSvgHtml, headSvgHtml } = createTowerSvgParts(towerObj.type, towerObj.tier);
        const baseLayer = document.createElement('div'); baseLayer.classList.add('tower-base-layer'); baseLayer.innerHTML = baseSvgHtml;
        if (towerObj.isCrowned || towerObj.tier >= 5) {
            const haloEl = document.createElement('div');
            haloEl.className = 'tower-crown-halo';
            haloEl.setAttribute('aria-hidden', 'true');
            haloEl.innerHTML = '<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="29" fill="none" stroke="#E0B43C" stroke-width="2" stroke-dasharray="6 3"/><polygon points="24,9 28,15 32,6 36,15 40,9 38,18 26,18" fill="#E0B43C" stroke="#1B211E" stroke-width="1.2"/></svg>';
            tower.appendChild(haloEl);
        }

        // 3★→4★ 與 4★→5★ 漸進式吞噬充能進度環
        if (towerObj.tier === 3 || towerObj.tier === 4) {
            const baseU = towerObj.tier === 3 ? 4 : 8;
            const targetU = towerObj.tier === 3 ? 8 : 16;
            const curU = (EvoSys && typeof EvoSys.getTowerNutritionU === 'function')
                ? EvoSys.getTowerNutritionU(towerObj)
                : (Number(towerObj.nutritionU) || baseU);
            const ratio = Math.max(0, Math.min(1, (curU - baseU) / Math.max(1, targetU - baseU)));
            const circumference = 176;
            const dashOffset = Number((circumference * (1 - ratio)).toFixed(2));
            const growthRing = document.createElement('div');
            growthRing.className = 'tower-growth-ring';
            growthRing.setAttribute('aria-hidden', 'true');
            growthRing.innerHTML = `<svg viewBox="0 0 64 64"><circle class="growth-track" cx="32" cy="32" r="28" fill="none" stroke="#1B211E" stroke-opacity="0.82" stroke-width="3.4"/><circle class="growth-fill" cx="32" cy="32" r="28" fill="none" stroke="#D97724" stroke-width="3.4" stroke-linecap="round" stroke-dasharray="${circumference}" stroke-dashoffset="${dashOffset}" transform="rotate(-90 32 32)"/></svg>`;
            tower.appendChild(growthRing);
        }

        const headRotator = document.createElement('div'); headRotator.classList.add('tower-head-rotator'); headRotator.style.transform = `rotate(${towerObj.aimAngleDeg || 0}deg)`;
        const headRecoil = document.createElement('div'); headRecoil.classList.add('tower-head-recoil'); headRecoil.innerHTML = headSvgHtml;
        headRotator.appendChild(headRecoil);
        const elDot = document.createElement('span');
        elDot.className = 'tower-el-dot';
        elDot.setAttribute('aria-hidden', 'true');
        const name = document.createElement('div'); name.classList.add('tower-name');
        let labelText = '';
        const isEnBadge = Boolean(GameApp.i18n && typeof GameApp.i18n.isEnglish === 'function' && GameApp.i18n.isEnglish());
        if (isPrimalCore) {
            labelText = isEnBadge ? '5★C' : '5★核';
        } else if (towerObj.tier >= 5) {
            labelText = isEnBadge ? '5★S' : '5★神';
        } else if (isTriElement && towerObj.tier === 4) {
            labelText = isEnBadge ? 'Tri4★' : '三4★';
        } else if (towerObj.tier === 4) {
            labelText = `${branchCode || ''}4★`;
        } else {
            const starLabel = getTierStars(towerObj.tier);
            labelText = branchCode ? `${branchCode}${starLabel}` : starLabel;
        }
        name.innerText = labelText;
        const cellW = (G && G.boardMetrics && G.boardMetrics.cellW) || 34;
        if (name.innerText.length >= 4 || towerObj.tier >= 4 || cellW <= 32) {
            name.classList.add('is-compact');
        }
        name.style.maxWidth = `${Math.max(14, cellW - 2)}px`;

        tower._rotator = headRotator;
        tower._recoilEl = headRecoil;
        tower.appendChild(elDot); tower.appendChild(baseLayer); tower.appendChild(headRotator); tower.appendChild(name);

        if ((towerObj.infusionCount || 0) > 0) {
            const infBadge = document.createElement('span');
            infBadge.className = 'tower-infusion-badge num';
            infBadge.innerText = `+${towerObj.infusionCount}`;
            tower.appendChild(infBadge);
        }

        if (GameApp.systems && GameApp.systems.drag && typeof GameApp.systems.drag.bindBoardTowerElement === 'function') {
            GameApp.systems.drag.bindBoardTowerElement(tower, index, towerObj);
        }
        return tower;
    }

    function setTowerStunnedVisual(index, isStunned) {
        const el = G && G.towerElements ? G.towerElements[index] : null;
        if (el) el.classList.toggle('stunned', Boolean(isStunned));
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
        highground: '<svg class="terrain-svg" viewBox="0 0 64 64" aria-hidden="true"><defs><pattern id="hgHatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><line x1="0" y1="0" x2="0" y2="8" stroke="rgba(224,180,60,0.28)" stroke-width="1.6"/></pattern></defs><rect x="2" y="2" width="60" height="60" rx="4" fill="url(#hgHatch)"/><polygon points="12,50 25,20 35,34 45,16 52,50" fill="rgba(224,180,60,0.24)" stroke="rgba(242,208,96,0.78)" stroke-width="1.8" stroke-linejoin="round"/><polyline points="18,44 27,28 35,38 43,25 48,44" fill="none" stroke="rgba(244,241,234,0.48)" stroke-width="1.8" stroke-linejoin="round"/></svg>',
        mana_vein: '<svg class="terrain-svg" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="22" fill="rgba(74,158,191,0.18)" stroke="rgba(118,200,232,0.76)" stroke-width="1.8" stroke-dasharray="5 3"/><circle cx="32" cy="32" r="14" fill="none" stroke="rgba(118,200,232,0.72)" stroke-width="1.6"/><polygon points="32,14 46,32 32,50 18,32" fill="rgba(74,158,191,0.26)" stroke="rgba(214,238,247,0.72)" stroke-width="1.6"/><circle cx="32" cy="32" r="4.5" fill="rgba(155,211,232,0.88)"/></svg>',
        world_tree: '<svg class="terrain-svg" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="22" fill="rgba(78,154,104,0.18)" stroke="rgba(116,196,144,0.78)" stroke-width="1.8"/><path d="M32 12 C43 20 47 32 32 52 C17 32 21 20 32 12 Z" fill="rgba(78,154,104,0.28)" stroke="rgba(184,224,196,0.74)" stroke-width="1.6"/><line x1="32" y1="16" x2="32" y2="50" stroke="rgba(220,242,226,0.68)" stroke-width="1.6"/><path d="M32 25 L40 20 M32 33 L41 28 M32 25 L24 20 M32 33 L23 28" stroke="rgba(220,242,226,0.62)" stroke-width="1.6" stroke-linecap="round"/></svg>',
        obstacle: '<svg class="terrain-svg" viewBox="0 0 64 64" aria-hidden="true"><polygon points="10,48 18,22 33,16 48,24 54,48 40,54 20,54" fill="rgba(82,98,90,0.70)" stroke="rgba(200,211,204,0.68)" stroke-width="1.8"/><polyline points="18,22 31,34 48,24" fill="none" stroke="rgba(244,241,234,0.40)" stroke-width="1.6"/></svg>'
    };

    const PATH_ARROW_SVG = '<svg class="path-arrow-svg" viewBox="0 0 16 16" aria-hidden="true"><polyline points="5.5,3 11,8 5.5,13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    const START_CELL_SVG = '<svg class="cell-marker-svg" viewBox="0 0 32 32" aria-hidden="true"><path d="M8 26 V12 A8 8 0 0 1 24 12 V26" fill="rgba(244,241,234,0.12)" stroke="#B8C2BC" stroke-width="1.8"/><line x1="6" y1="26" x2="26" y2="26" stroke="#B8C2BC" stroke-width="1.8" stroke-linecap="round"/><polyline points="13,13 18,17 13,21" fill="none" stroke="#F4F1EA" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    const TREE_CELL_SVG = '<svg class="cell-marker-svg" viewBox="0 0 32 32" aria-hidden="true"><path d="M16 5 C23 11 25 18 16 24 C7 18 9 11 16 5 Z" fill="rgba(78,154,104,0.42)" stroke="#B8C2BC" stroke-width="1.6"/><rect x="14" y="22" width="4" height="6" rx="1" fill="#8C6A4A"/></svg>';

    function initBoard() {
        const boardEl = G.dom.boardElement, st = G.state, map = G.map;
        const boardSize = CONFIG.BOARD_SIZE || 150;
        const terrainsDict = getTerrainsDict();
        boardEl.innerHTML = ''; G.cellElements.length = 0; G.towerElements.fill(null);
        st.lastRenderedSelected = null; st.lastRenderedBuildTarget = null; st.lastRenderedPendingSpawn = null;

        const startSet = (map.startCellIndices instanceof Set && map.startCellIndices.size > 0)
            ? map.startCellIndices
            : new Set([map.startCellIndex]);

        for (let index = 0; index < boardSize; index++) {
            const cell = document.createElement('div');
            cell.classList.add('cell');
            cell.dataset.index = index;
            if (map.pathCellIndices.has(index)) {
                cell.classList.add('path-cell');
                if (startSet.has(index)) {
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
            const onHoverEnterOrMove = () => {
                const curSt = G.state;
                if (!curSt.isTouchMode && curSt.hoveredIndex !== index) {
                    curSt.hoveredIndex = index;
                    updateRangeIndicator();
                }
            };
            cell.addEventListener('mouseenter', onHoverEnterOrMove);
            cell.addEventListener('mousemove', onHoverEnterOrMove);
            cell.addEventListener('mouseleave', () => {
                const curSt = G.state;
                if (!curSt.isTouchMode && curSt.hoveredIndex === index) {
                    curSt.hoveredIndex = null;
                    updateRangeIndicator();
                }
            });
            if (GameApp.systems && GameApp.systems.drag && typeof GameApp.systems.drag.bindBoardCellElement === 'function') {
                GameApp.systems.drag.bindBoardCellElement(cell, index);
            }
            cell.addEventListener('click', () => {
                const curSt = G.state;
                if (performance.now() - (curSt.lastTouchDragEndTime || 0) >= 220) {
                    G.callbacks.handleCellClick(index);
                }
            });
            G.cellElements.push(cell);
            boardEl.appendChild(cell);
        }
        measureBoardMetrics();
    }

    function refreshCellTerrain(index) {
        const cell = G && G.cellElements ? G.cellElements[index] : null;
        if (!cell) return;
        const terrainsDict = getTerrainsDict();
        cell.classList.remove('terrain-highground', 'terrain-mana_vein', 'terrain-world_tree', 'terrain-obstacle', 'obstacle-cell');
        cell.removeAttribute('title');
        const oldArt = cell.querySelector('.terrain-art');
        if (oldArt) oldArt.remove();

        const terrain = G.map && G.map.terrainMap ? G.map.terrainMap.get(index) : null;
        if (terrain && terrainsDict[terrain]) {
            const tCfg = terrainsDict[terrain];
            cell.classList.add(`terrain-${terrain}`);
            if (tCfg.buildable === false) cell.classList.add('obstacle-cell');
            if (tCfg.tooltip) cell.setAttribute('title', tCfg.tooltip);
            if (TERRAIN_SVG_BY_TYPE[terrain]) {
                const art = document.createElement('div');
                art.classList.add('terrain-art');
                art.setAttribute('aria-hidden', 'true');
                art.innerHTML = TERRAIN_SVG_BY_TYPE[terrain];
                cell.appendChild(art);
            }
        }
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

        const TerrainSys = GameApp.systems && GameApp.systems.terrain;
        const hasPendingSpawn = Boolean(st.pendingSpawnType);
        const hasPendingFruit = Boolean(st.isApplyingFusionFruit && (st.fusionFruitCount || 0) > 0);
        const pendingKey = hasPendingFruit ? 'FRUIT' : (st.pendingSpawnType || null);
        if (Boolean(pendingKey) !== Boolean(st.lastRenderedPendingSpawn) || !Array.isArray(dirtyIndices) || Boolean(pendingKey)) {
            const maxTier = getMaxTier();
            for (let idx = 0; idx < boardSize; idx++) {
                if (!cells[idx]) continue;
                const canPlaceHere = hasPendingSpawn
                    && st.board[idx] === null
                    && (TerrainSys ? TerrainSys.canBuildAt(idx) : !G.map.pathCellIndices.has(idx));
                const canFruitHere = hasPendingFruit
                    && st.board[idx] !== null
                    && st.board[idx].tier >= 1
                    && st.board[idx].tier < maxTier;
                cells[idx].classList.toggle('pending-spawn-valid', canPlaceHere || canFruitHere);
            }
            st.lastRenderedPendingSpawn = pendingKey;
        }

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

    function positionBoardTooltip(tipEl, coords, isInvalid = false) {
        if (!tipEl || !coords) return;
        const center = getCellCenter(coords.x, coords.y), m = G.boardMetrics;
        const isTopRow = coords.y <= 1;
        tipEl.classList.toggle('tooltip-below', isTopRow);
        tipEl.classList.toggle('tooltip-invalid', Boolean(isInvalid));
        tipEl.classList.remove('hidden');

        const tipW = tipEl.offsetWidth || 184;
        const halfW = Math.ceil(tipW / 2) + 6;
        const stageW = m.stageW || 600;
        const clampedX = Math.max(halfW, Math.min(Math.max(halfW, stageW - halfW), center.left));
        const topPx = isTopRow ? (center.top + m.cellH * 0.56) : (center.top - m.cellH * 0.56);

        tipEl.style.left = `${clampedX}px`;
        tipEl.style.top = `${topPx}px`;
    }

    function showDragEvolutionPreview(fromIndex, toIndex, labelText, isValid = true) {
        if (!G || !G.state) return;
        G.state.dragTether = { fromIndex, toIndex, labelText: labelText || '', isValid: Boolean(isValid) };
        const towerTipEl = G.dom.towerTooltipEl || (typeof document !== 'undefined' ? document.getElementById('tower-tooltip') : null);
        if (towerTipEl && labelText && Number.isFinite(toIndex)) {
            towerTipEl.classList.remove('is-detail-card');
            towerTipEl.innerText = labelText;
            positionBoardTooltip(towerTipEl, indexToCoords(toIndex), !isValid);
        }
        updateAndRenderCanvasFX(0);
    }

    function clearDragEvolutionPreview() {
        if (!G || !G.state) return;
        const hadTether = Boolean(G.state.dragTether);
        G.state.dragTether = null;
        if (G.dom && G.dom.towerTooltipEl) {
            G.dom.towerTooltipEl.classList.remove('tooltip-invalid', 'is-detail-card');
        }
        if (hadTether) updateAndRenderCanvasFX(0);
    }

    function updateTowerHoverTooltip() {
        if (!G || !G.dom) return;
        const towerTipEl = G.dom.towerTooltipEl || (typeof document !== 'undefined' ? document.getElementById('tower-tooltip') : null);
        if (!towerTipEl) return;
        G.dom.towerTooltipEl = towerTipEl;

        const st = G.state;
        if (st.dragTether && st.dragTether.labelText) {
            return;
        }
        towerTipEl.classList.remove('tooltip-invalid');
        const isDraggingNow = GameApp.systems && GameApp.systems.drag && GameApp.systems.drag.isDragging();
        if (st.isGameOver || st.waveState === 'WAITING_START' || st.waveState === 'VICTORY'
            || st.waveState === 'BLESSING_SELECT' || isDraggingNow || st.isTouchMode
            || st.hoveredIndex === null || !st.board[st.hoveredIndex]) {
            towerTipEl.classList.add('hidden');
            return;
        }

        const idx = st.hoveredIndex;
        const towerObj = st.board[idx];
        const AttackSys = GameApp.systems && GameApp.systems.towerAttack;
        const tipData = (AttackSys && typeof AttackSys.getTowerHoverTooltipData === 'function')
            ? AttackSys.getTowerHoverTooltipData(idx, towerObj)
            : null;

        if (tipData) {
            towerTipEl.classList.add('is-detail-card');
            towerTipEl.innerHTML = '';
            const line1 = document.createElement('div');
            line1.className = 'tt-header';
            line1.innerText = tipData.nameLine;
            const line2 = document.createElement('div');
            line2.className = 'tt-stats num';
            line2.innerText = tipData.statsLine;
            const line3 = document.createElement('div');
            line3.className = 'tt-desc';
            line3.innerText = tipData.descLine;
            towerTipEl.appendChild(line1);
            towerTipEl.appendChild(line2);
            towerTipEl.appendChild(line3);
        } else {
            const tCfg = getTowersDict()[towerObj.type] || { icon: '✨', name: towerObj.type };
            towerTipEl.classList.remove('is-detail-card');
            towerTipEl.innerText = `${tCfg.icon} ${tCfg.name} · ${getTierStars(towerObj.tier)}`;
        }

        positionBoardTooltip(towerTipEl, indexToCoords(idx), false);
    }

    let terrainTipAutoHideTimer = null;

    function hideTerrainTooltip() {
        if (terrainTipAutoHideTimer !== null) {
            clearTimeout(terrainTipAutoHideTimer);
            terrainTipAutoHideTimer = null;
        }
        const tipEl = G && G.dom ? G.dom.terrainTooltipEl : null;
        if (tipEl) tipEl.classList.add('hidden');
    }

    function updateTerrainTooltip() {
        const tipEl = G.dom.terrainTooltipEl, st = G.state;
        updateTowerHoverTooltip();
        if (!tipEl) return;
        const isDraggingNow = GameApp.systems && GameApp.systems.drag && GameApp.systems.drag.isDragging();
        if (st.isGameOver || st.waveState === 'WAITING_START' || st.waveState === 'VICTORY'
            || st.waveState === 'BLESSING_SELECT' || isDraggingNow) {
            hideTerrainTooltip();
            return;
        }
        // 若滑鼠懸停在已有防禦塔的格子上，優先顯示乾淨的角色名牌，避免雙重提示重疊
        if (!st.isTouchMode && st.hoveredIndex !== null && st.board[st.hoveredIndex] !== null) {
            hideTerrainTooltip();
            return;
        }
        const idx = (!st.isTouchMode && st.hoveredIndex !== null)
            ? st.hoveredIndex
            : (st.buildTargetIndex !== null ? st.buildTargetIndex : st.selectedIndex);
        const terrainKey = idx !== null ? G.map.terrainMap.get(idx) : null;
        const tCfg = terrainKey ? getTerrainsDict()[terrainKey] : null;
        if (!tCfg || !tCfg.shortTag) {
            hideTerrainTooltip();
            return;
        }
        if (terrainKey === 'world_tree') {
            const TerrainSys = GameApp.systems && GameApp.systems.terrain;
            const bonusMult = TerrainSys ? TerrainSys.getTerrainBonusesAt(idx).damageMult : 1.0;
            const bonusPct = Math.max(0, Math.round((bonusMult - 1) * 100));
            const isEn = Boolean(GameApp.i18n && GameApp.i18n.isEnglish());
            tipEl.innerText = isEn
                ? `${tCfg.name} · DMG +${bonusPct}%`
                : `${tCfg.name} · 當前傷 +${bonusPct}%`;
        } else {
            tipEl.innerText = `${tCfg.name} · ${tCfg.shortTag}`;
        }
        if (st.isTouchMode) {
            tipEl.classList.add('touch-top-edge');
            tipEl.style.left = '';
            tipEl.style.top = '';
            tipEl.classList.remove('hidden');
            if (terrainTipAutoHideTimer !== null) clearTimeout(terrainTipAutoHideTimer);
            terrainTipAutoHideTimer = setTimeout(() => {
                terrainTipAutoHideTimer = null;
                if (G && G.dom && G.dom.terrainTooltipEl) {
                    G.dom.terrainTooltipEl.classList.add('hidden');
                }
            }, 1800);
        } else {
            tipEl.classList.remove('touch-top-edge');
            if (terrainTipAutoHideTimer !== null) {
                clearTimeout(terrainTipAutoHideTimer);
                terrainTipAutoHideTimer = null;
            }
            const coords = indexToCoords(idx), center = getCellCenter(coords.x, coords.y), m = G.boardMetrics;
            const clampedX = Math.max(76, Math.min((m.stageW || 600) - 76, center.left));
            const topPx = coords.y <= 1 ? (center.top + m.cellH * 0.65) : (center.top - m.cellH * 0.72);
            tipEl.style.left = `${clampedX}px`;
            tipEl.style.top = `${topPx}px`;
            tipEl.classList.remove('hidden');
        }
    }

    /**
     * 顯示拖曳期間的即時射程預覽圈（支援商店拖拉指定召喚與棋盤拖拉移塔）
     */
    function showDragRangePreview(leftPx, topPx, radiusPx, towerType) {
        updateTowerHoverTooltip();
        const el = G && G.dom && G.dom.rangeCircleEl;
        if (!el) return;
        const { family } = resolveTowerVisualFamily(towerType);
        el.style.left = `${leftPx}px`;
        el.style.top = `${topPx}px`;
        el.style.width = `${radiusPx * 2}px`;
        el.style.height = `${radiusPx * 2}px`;
        el.className = `visible range-${family || 'fire'}`;
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
            el.style.width = '';
            el.style.height = '';
            return;
        }
        const targetIdx = (!st.isTouchMode && st.hoveredIndex !== null && st.board[st.hoveredIndex] !== null)
            ? st.hoveredIndex : ((st.selectedIndex !== null && st.board[st.selectedIndex] !== null) ? st.selectedIndex : null);
        if (targetIdx === null) {
            el.className = '';
            el.style.width = '';
            el.style.height = '';
            return;
        }

        const towerObj = st.board[targetIdx], coords = indexToCoords(targetIdx), center = getCellCenter(coords.x, coords.y);
        const AttackSys = GameApp.systems && GameApp.systems.towerAttack;
        const radiusPx = AttackSys ? AttackSys.getTowerRangePx(towerObj, targetIdx) : (2.0 * G.boardMetrics.step);
        const { family } = resolveTowerVisualFamily(towerObj.type);
        el.style.left = `${center.left}px`; el.style.top = `${center.top}px`;
        el.style.width = `${radiusPx * 2}px`; el.style.height = `${radiusPx * 2}px`;
        el.className = `visible range-${family || 'fire'}`;
    }

    function updateWorldTreeVisualState() {
        const st = G.state, treeCell = G.cellElements[G.map.endCellIndex], hpHudEl = G.dom.hpHudEl;
        const treeCfg = (GameApp.data && GameApp.data.tree && GameApp.data.tree.TREE_CONFIG) || {};
        const baseMax = treeCfg.INITIAL_BASE_HP || CONFIG.INITIAL_BASE_HP || 20;
        const maxHp = st.maxBaseHp || baseMax;
        const scale = maxHp / Math.max(1, baseMax);
        const healthyMin = Math.round((treeCfg.WORLD_TREE_HEALTHY_MIN || 14) * scale);
        const warningMin = Math.round((treeCfg.WORLD_TREE_WARNING_MIN || 7) * scale);
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
        }, 160);
    }

    function emitAscendRuneFX(cellIndex, tier = 4) {
        if (!G || !Number.isFinite(cellIndex)) return;
        const c = indexToCoords(cellIndex);
        const pos = getCellCenter(c.x, c.y);
        const m = G.boardMetrics || { cellW: 36 };
        const isTier5 = Number(tier) >= 5;
        const radiusOuter = Math.max(30, m.cellW * (isTier5 ? 1.55 : 1.25));
        const radiusInner = Math.max(18, m.cellW * (isTier5 ? 0.95 : 0.78));
        emitRingFX(pos.left, pos.top, radiusOuter, '#E0B43C', 0.34, isTier5 ? 520 : 400);
        emitRingFX(pos.left, pos.top, radiusInner, '#F4F1EA', 0.25, isTier5 ? 380 : 300);
        emitParticleBurst(pos.left, pos.top, '#E0B43C', isTier5 ? 24 : 16, isTier5 ? 140 : 105);
        emitHitFlash(pos.left, pos.top, '#E0B43C');
        const stage = G.dom.boardStageEl;
        if (stage) {
            stage.classList.remove('ascend-shake');
            void stage.offsetWidth;
            stage.classList.add('ascend-shake');
            if (G.callbacks && typeof G.callbacks.scheduleTimeout === 'function') {
                G.callbacks.scheduleTimeout(() => {
                    if (G.dom.boardStageEl) G.dom.boardStageEl.classList.remove('ascend-shake');
                }, 120);
            } else {
                setTimeout(() => { if (stage) stage.classList.remove('ascend-shake'); }, 120);
            }
        }
    }

    let bossBannerTimer = null;
    function triggerBossEntranceBanner(bossMeta, waveNum) {
        if (!G || !G.dom || !G.dom.bossEntranceBannerEl || !bossMeta) return;
        const banner = G.dom.bossEntranceBannerEl;
        const isEn = Boolean(GameApp.i18n && typeof GameApp.i18n.isEnglish === 'function' && GameApp.i18n.isEnglish());
        if (G.dom.bossEntranceKickerEl) {
            G.dom.bossEntranceKickerEl.innerText = isEn
                ? `Wave ${waveNum} Boss Warning`
                : `第 ${waveNum} 波 領主降臨`;
        }
        if (G.dom.bossEntranceTitleEl) {
            G.dom.bossEntranceTitleEl.innerText = bossMeta.name || (isEn ? 'Apex Boss' : '領主魔王');
        }
        if (G.dom.bossEntranceSubEl) {
            const weakLabel = (GameApp.i18n && typeof GameApp.i18n.getWeaknessLabel === 'function')
                ? GameApp.i18n.getWeaknessLabel(bossMeta.weakness)
                : (bossMeta.weakness || '');
            G.dom.bossEntranceSubEl.innerText = isEn
                ? `Weak: ${weakLabel} · ARM ${bossMeta.armor || 0} · HP ${bossMeta.hp || 0}`
                : `弱點：${weakLabel} · 護甲 ${bossMeta.armor || 0} · 生命 ${bossMeta.hp || 0}`;
        }
        banner.classList.remove('hidden', 'is-showing', 'weak-fire', 'weak-ice', 'weak-thunder');
        if (bossMeta.weakness) banner.classList.add(`weak-${bossMeta.weakness}`);
        void banner.offsetWidth;
        banner.classList.add('is-showing');
        if (bossBannerTimer) clearTimeout(bossBannerTimer);
        const scheduleFn = (G.callbacks && typeof G.callbacks.scheduleTimeout === 'function')
            ? G.callbacks.scheduleTimeout
            : setTimeout;
        bossBannerTimer = scheduleFn(() => {
            if (G.dom.bossEntranceBannerEl) {
                G.dom.bossEntranceBannerEl.classList.remove('is-showing');
                G.dom.bossEntranceBannerEl.classList.add('hidden');
            }
            bossBannerTimer = null;
        }, 820);
    }

    function applyWeatherVisualClass(weatherType) {
        if (!G || !G.dom || !G.dom.boardStageEl) return;
        const stage = G.dom.boardStageEl;
        stage.classList.remove('weather-sun', 'weather-snow', 'weather-storm');
        if (weatherType === 'sun' || weatherType === 'snow' || weatherType === 'storm') {
            stage.classList.add(`weather-${weatherType}`);
        }
    }

    let lobbyBgRafId = null;
    let lobbyAmbientParticles = null;
    function stopLobbyAmbientCanvas() {
        if (lobbyBgRafId !== null) {
            cancelAnimationFrame(lobbyBgRafId);
            lobbyBgRafId = null;
        }
    }

    function startLobbyAmbientCanvas() {
        if (typeof document === 'undefined') return;
        const canvas = document.getElementById('lobby-bg-canvas');
        if (!canvas || !canvas.getContext) return;
        stopLobbyAmbientCanvas();
        if (!lobbyAmbientParticles) {
            lobbyAmbientParticles = Array.from({ length: 34 }, (_, i) => ({
                x: Math.random(),
                y: Math.random(),
                vx: (Math.random() - 0.5) * 0.018,
                vy: i % 3 === 0 ? -(0.012 + Math.random() * 0.014) : (0.014 + Math.random() * 0.016),
                phase: Math.random() * Math.PI * 2,
                size: 2.2 + Math.random() * 3.0,
                isSpore: i % 3 === 0
            }));
        }
        let prevTs = 0;
        const renderFrame = (ts) => {
            if (!G || !G.dom || !G.dom.startOverlayEl || G.dom.startOverlayEl.classList.contains('hidden')) {
                lobbyBgRafId = null;
                return;
            }
            const rect = canvas.getBoundingClientRect();
            const w = Math.max(320, Math.round(rect.width || window.innerWidth || 1280));
            const h = Math.max(240, Math.round(rect.height || window.innerHeight || 720));
            if (canvas.width !== w || canvas.height !== h) {
                canvas.width = w;
                canvas.height = h;
            }
            const dt = prevTs ? Math.min(0.08, (ts - prevTs) / 1000) : 0.016;
            prevTs = ts;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            ctx.clearRect(0, 0, w, h);
            const pulse = 0.5 + 0.5 * Math.sin(ts * 0.0014);
            const cx = w * 0.5;
            const cy = h * 0.44;
            const canopyR = Math.min(w, h) * 0.34;

            // 世界樹樹冠呼吸暖光與剪影
            const halo = ctx.createRadialGradient(cx, cy, canopyR * 0.08, cx, cy, canopyR * 1.15);
            halo.addColorStop(0, `rgba(217, 119, 36, ${0.14 + pulse * 0.08})`);
            halo.addColorStop(0.5, `rgba(46, 86, 62, ${0.18 + pulse * 0.06})`);
            halo.addColorStop(1, 'rgba(27, 33, 30, 0)');
            ctx.fillStyle = halo;
            ctx.fillRect(0, 0, w, h);

            ctx.save();
            ctx.translate(cx, h * 0.86);
            const treeH = Math.min(h * 0.62, 420);
            ctx.fillStyle = 'rgba(20, 28, 24, 0.72)';
            ctx.beginPath();
            ctx.moveTo(-treeH * 0.24, 0);
            ctx.quadraticCurveTo(-treeH * 0.08, -treeH * 0.26, -treeH * 0.06, -treeH * 0.62);
            ctx.lineTo(-treeH * 0.26, -treeH * 0.84);
            ctx.lineTo(-treeH * 0.09, -treeH * 0.78);
            ctx.lineTo(0, -treeH);
            ctx.lineTo(treeH * 0.09, -treeH * 0.78);
            ctx.lineTo(treeH * 0.26, -treeH * 0.84);
            ctx.lineTo(treeH * 0.06, -treeH * 0.62);
            ctx.quadraticCurveTo(treeH * 0.08, -treeH * 0.26, treeH * 0.24, 0);
            ctx.closePath();
            ctx.fill();

            // 呼吸樹冠葉群
            ctx.fillStyle = `rgba(42, 74, 54, ${0.34 + pulse * 0.08})`;
            const lobes = [
                [-0.22, -0.78, 0.24], [0.22, -0.78, 0.24],
                [-0.12, -0.92, 0.26], [0.12, -0.92, 0.26],
                [0, -0.84, 0.30]
            ];
            for (let i = 0; i < lobes.length; i++) {
                ctx.beginPath();
                ctx.arc(treeH * lobes[i][0], treeH * lobes[i][1], treeH * lobes[i][2], 0, Math.PI * 2);
                ctx.fill();
            }

            // 年輪核心微光點
            ctx.fillStyle = `rgba(224, 180, 60, ${0.42 + pulse * 0.32})`;
            ctx.beginPath();
            ctx.arc(0, -treeH * 0.52, 5 + pulse * 2.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();

            // 飄落林葉與金孢子粒子
            ctx.save();
            for (let i = 0; i < lobbyAmbientParticles.length; i++) {
                const pt = lobbyAmbientParticles[i];
                pt.x += (pt.vx + Math.sin(ts * 0.0012 + pt.phase) * 0.008) * dt;
                pt.y += pt.vy * dt;
                if (pt.y > 1.06) { pt.y = -0.05; pt.x = Math.random(); }
                if (pt.y < -0.06) { pt.y = 1.05; pt.x = Math.random(); }
                if (pt.x < -0.05) pt.x = 1.04;
                if (pt.x > 1.05) pt.x = -0.04;
                const px = pt.x * w;
                const py = pt.y * h;
                ctx.save();
                if (pt.isSpore) {
                    ctx.globalAlpha = 0.45 + 0.3 * Math.sin(ts * 0.004 + pt.phase);
                    ctx.fillStyle = '#E0B43C';
                    ctx.beginPath();
                    ctx.arc(px, py, pt.size * 0.65, 0, Math.PI * 2);
                    ctx.fill();
                } else {
                    ctx.globalAlpha = 0.38;
                    ctx.fillStyle = i % 2 === 0 ? '#4E9A68' : '#74B88A';
                    ctx.translate(px, py);
                    ctx.rotate(pt.phase + ts * 0.0008);
                    ctx.beginPath();
                    ctx.ellipse(0, 0, pt.size, pt.size * 0.48, 0, 0, Math.PI * 2);
                    ctx.fill();
                }
                ctx.restore();
            }
            ctx.restore();
            lobbyBgRafId = requestAnimationFrame(renderFrame);
        };
        lobbyBgRafId = requestAnimationFrame(renderFrame);
    }

    const RendererModule = {
    bind,
    getTierStars,
    createTowerSvgParts,
    createMonsterSvgHtml,
    drawPortrait,
    showDragEvolutionPreview,
    clearDragEvolutionPreview,
    updateTowerHoverTooltip,
    hideTerrainTooltip,
    resizeFxCanvas,
    measureBoardMetrics,
    fillCellClampedText,
    getCellCenter,
    clearCanvasFXState,
    emitParticleBurst,
    emitHitFlash,
    emitRingFX,
    spawnDamageNumber,
    spawnFloatingNotice,
    emitCanvasAttackFX,
    updateAndRenderCanvasFX,
    updateTowerAimVisual,
    triggerMonsterHitFlash,
    createMonsterDom,
    removeMonsterDom,
    renderMonsterLayer,
    repositionAllMonsters,
    clearCellDragHighlights,
    clearTouchDragVisuals,
    createTowerElement,
    setTowerStunnedVisual,
    renderCellTower,
    initBoard,
    refreshCellTerrain,
    renderBoard,
    showDragRangePreview,
    updateRangeIndicator,
    updateWorldTreeVisualState,
    triggerWorldTreeShake,
    emitAscendRuneFX,
    triggerBossEntranceBanner,
    applyWeatherVisualClass,
    startLobbyAmbientCanvas,
    stopLobbyAmbientCanvas
};

GameApp.core = GameApp.core || {};
GameApp.core.renderer = RendererModule;
GameApp.renderer = RendererModule;
global.GameRenderer = RendererModule;
}) (window);
