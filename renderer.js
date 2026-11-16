(function (global) {
    'use strict';

    const { CONFIG, ELEMENT_CONFIG, TERRAIN_CONFIG, clampNumber, indexToCoords } = global.GameConfig;

    let G = null;
    function bind(ctx) { G = ctx; }
    function getTierStars(tier) { return '★'.repeat(Math.max(1, Math.min(CONFIG.MAX_TIER, tier || 1))); }

    // ==================== 2.5D 雙層砲塔與 3D 向量怪物 SVG 生成 ====================
    const TOWER_PALETTE = {
        fire: { rune: '#f97316', glow: '#fde047' },
        ice: { rune: '#38bdf8', glow: '#e0f2fe' },
        thunder: { rune: '#a855f7', glow: '#f0abfc' },
        steam: { rune: '#fb923c', glow: '#7dd3fc' },
        magnet: { rune: '#22d3ee', glow: '#c084fc' },
        plasma: { rune: '#f472b6', glow: '#fef08a' }
    };

    const TOWER_HEAD_TEMPLATES = {
        fire: (tier) => {
            const fins = tier >= 3 ? '<polygon points="14,40 22,25 24,42" fill="#b91c1c" stroke="#450a0a" stroke-width="1.2"/><polygon points="50,40 42,25 40,42" fill="#b91c1c" stroke="#450a0a" stroke-width="1.2"/>' : '';
            const pods = tier >= 2 ? '<rect x="16.5" y="30" width="5" height="11" rx="2" fill="#f59e0b" stroke="#451a03" stroke-width="1.2"/><rect x="42.5" y="30" width="5" height="11" rx="2" fill="#f59e0b" stroke="#451a03" stroke-width="1.2"/>' : '';
            return `<ellipse cx="33" cy="35" rx="13" ry="12" fill="rgba(0,0,0,0.32)"/>${fins}<polygon points="27,7 37,7 39,30 25,30" fill="#7c2d12" stroke="#270e05" stroke-width="1.6"/><rect x="29" y="9" width="3" height="19" rx="1" fill="#fb923c" fill-opacity="0.55"/><polygon points="24.5,6 39.5,6 37.5,12 26.5,12" fill="#f59e0b" stroke="#451a03" stroke-width="1.4"/><ellipse cx="32" cy="7" rx="4.5" ry="2.2" fill="#fef08a"/>${pods}<polygon points="22,26 42,26 45,38 38,46 26,46 19,38" fill="#dc2626" stroke="#450a0a" stroke-width="1.8"/><polygon points="24,27 40,27 42,35 32,33 22,35" fill="#f87171" fill-opacity="0.45"/><circle cx="32" cy="36" r="${tier >= 3 ? 6.4 : 5}" fill="#f97316" stroke="#7c2d12" stroke-width="1.3"/><circle cx="31" cy="34.5" r="${tier >= 3 ? 3.2 : 2.3}" fill="#fef08a"/>`;
        },
        ice: (tier) => {
            const shards = tier >= 2 ? '<polygon points="18,16 24,28 19,38 14,32" fill="#38bdf8" stroke="#0c4a6e" stroke-width="1.3"/><polygon points="46,16 40,28 45,38 50,32" fill="#0284c7" stroke="#0c4a6e" stroke-width="1.3"/>' : '';
            const gold = tier >= 3 ? '<polygon points="16,40 21,36 22,44" fill="#fbbf24"/><polygon points="48,40 43,36 42,44" fill="#fbbf24"/>' : '';
            return `<ellipse cx="33" cy="35" rx="12" ry="12" fill="rgba(0,0,0,0.30)"/>${shards}<polygon points="32,4 39,28 32,34 25,28" fill="#7dd3fc" stroke="#075985" stroke-width="1.6"/><polygon points="32,4 32,34 25,28" fill="#e0f2fe" fill-opacity="0.72"/>${gold}<polygon points="21,28 43,28 46,39 32,47 18,39" fill="#0369a1" stroke="#082f49" stroke-width="1.7"/><polygon points="24,30 40,30 32,41" fill="#38bdf8" fill-opacity="0.5"/><polygon points="32,29 38,36 32,43 26,36" fill="${tier >= 3 ? '#ffffff' : '#bae6fd'}" stroke="#0284c7" stroke-width="1.3"/>`;
        },
        thunder: (tier) => {
            const orb = tier >= 3 ? '<circle cx="32" cy="40" r="4.5" fill="#f0abfc" stroke="#ffffff" stroke-width="1.2"/>' : '';
            return `<ellipse cx="33" cy="36" rx="13" ry="11" fill="rgba(0,0,0,0.32)"/><polygon points="20,9 25,9 26,30 20,30" fill="#7e22ce" stroke="#2e1065" stroke-width="1.4"/><polygon points="39,9 44,9 44,30 38,30" fill="#6b21a8" stroke="#2e1065" stroke-width="1.4"/><circle cx="22.5" cy="9" r="3.4" fill="#fde047" stroke="#713f12" stroke-width="1.1"/><circle cx="41.5" cy="9" r="3.4" fill="#fde047" stroke="#713f12" stroke-width="1.1"/><polyline points="23,9 29,6 33,12 41,9" fill="none" stroke="#fef08a" stroke-width="${tier >= 3 ? 2.4 : 1.7}" stroke-linecap="round" stroke-linejoin="round"/><polygon points="32,12 35,28 29,28" fill="#c084fc" stroke="#3b0764" stroke-width="1.2"/><polygon points="19,28 45,28 47,40 39,47 25,47 17,40" fill="#581c87" stroke="#2e1065" stroke-width="1.8"/><rect x="23" y="30" width="18" height="4" rx="2" fill="#f59e0b"/><rect x="25" y="36" width="14" height="3.5" rx="1.5" fill="${tier >= 2 ? '#fde047' : '#d97706'}"/>${orb}`;
        },
        steam: (tier) => `<ellipse cx="33" cy="36" rx="14" ry="11" fill="rgba(0,0,0,0.34)"/><rect x="23" y="7" width="8" height="22" rx="2.5" fill="#9a3412" stroke="#270e05" stroke-width="1.4"/><rect x="33" y="7" width="8" height="22" rx="2.5" fill="#0369a1" stroke="#082f49" stroke-width="1.4"/><rect x="21" y="6" width="22" height="5" rx="2" fill="#cbd5e1" stroke="#334155" stroke-width="1.3"/><circle cx="27" cy="8.5" r="2.1" fill="#fed7aa"/><circle cx="37" cy="8.5" r="2.1" fill="#e0f2fe"/><polygon points="18,27 32,27 32,47 23,46 16,38" fill="#ea580c" stroke="#431407" stroke-width="1.6"/><polygon points="32,27 46,27 48,38 41,46 32,47" fill="#0284c7" stroke="#082f49" stroke-width="1.6"/><circle cx="32" cy="36" r="${tier >= 3 ? 6.4 : 5.4}" fill="#f8fafc" stroke="#334155" stroke-width="1.5"/><circle cx="32" cy="36" r="2.8" fill="${tier >= 3 ? '#fbbf24' : '#fb7185'}"/>`,
        magnet: (tier) => `<ellipse cx="33" cy="36" rx="14" ry="11" fill="rgba(0,0,0,0.32)"/><polygon points="18,6 25,6 26,33 17,37" fill="#06b6d4" stroke="#164e63" stroke-width="1.5"/><polygon points="46,6 39,6 38,33 47,37" fill="#7c3aed" stroke="#2e1065" stroke-width="1.5"/><polygon points="20,8 23,8 23,28 20,28" fill="#a5f3fc" fill-opacity="0.72"/><polygon points="41,8 44,8 44,28 41,28" fill="#ddd6fe" fill-opacity="0.72"/><circle cx="32" cy="16" r="5" fill="#22d3ee" fill-opacity="0.85" stroke="#f0abfc" stroke-width="1.5"/><circle cx="32" cy="16" r="2.2" fill="#ffffff"/><polygon points="21,30 43,30 47,39 39,47 25,47 17,39" fill="#1e1b4b" stroke="#0ea5e9" stroke-width="1.6"/><circle cx="32" cy="38" r="${tier >= 3 ? 6 : 5}" fill="#a855f7" stroke="#67e8f9" stroke-width="1.5"/>`,
        plasma: (tier) => `<ellipse cx="33" cy="36" rx="14" ry="11" fill="rgba(0,0,0,0.35)"/><polygon points="14,34 25,21 26,41 18,43" fill="#be185d" stroke="#500724" stroke-width="1.4"/><polygon points="50,34 39,21 38,41 46,43" fill="#be185d" stroke="#500724" stroke-width="1.4"/><polygon points="32,5 37,27 27,27" fill="#fde047" stroke="#9d174d" stroke-width="1.5"/><polygon points="32,8 34,26 30,26" fill="#ffffff" fill-opacity="0.82"/><ellipse cx="32" cy="20" rx="8" ry="3.2" fill="none" stroke="#f472b6" stroke-width="2"/><polygon points="22,27 42,27 44,39 32,48 20,39" fill="#831843" stroke="#fbbf24" stroke-width="1.6"/><circle cx="32" cy="36" r="${tier >= 3 ? 6.4 : 5.2}" fill="#f43f5e" stroke="#fef08a" stroke-width="1.6"/><circle cx="31.5" cy="35" r="2.4" fill="#ffffff"/>`
    };

    function createTowerSvgParts(type, tier) {
        const pal = TOWER_PALETTE[type] || { rune: '#cbd5e1', glow: '#f8fafc' };
        const crownTrim = tier >= 3 ? '<polygon points="18,14 46,14 52,24 52,36 45,45 19,45 12,36 12,24" fill="none" stroke="#fbbf24" stroke-width="1.6"/>' : '';
        const gemCoords = tier >= 2 ? [[32, 17], [48, 30], [32, 42], [16, 30]] : [[20, 20], [44, 20], [20, 40], [44, 40]];
        const cornerGems = gemCoords.map(([cx, cy]) => `<circle cx="${cx}" cy="${cy}" r="${tier >= 2 ? 2.2 : 1.4}" fill="${tier >= 2 ? pal.glow : '#a89984'}"/>`).join('');

        const baseSvgHtml = `<svg class="tower-base-svg" viewBox="0 0 64 64" aria-hidden="true"><ellipse cx="32" cy="53" rx="23" ry="8" fill="rgba(0,0,0,0.45)"/><polygon points="15,22 49,22 55,33 55,44 47,53 17,53 9,44 9,33" fill="#2c241f" stroke="#120e0b" stroke-width="2"/><polygon points="9,44 17,53 17,43 11,35" fill="#1e1815"/><polygon points="55,44 47,53 47,43 53,35" fill="#3a3029"/><polygon points="18,14 46,14 52,24 52,36 45,45 19,45 12,36 12,24" fill="#574a40" stroke="#756558" stroke-width="1.4"/><polyline points="14,24 19,15 45,15 50,24" fill="none" stroke="rgba(255,244,218,0.34)" stroke-width="1.5"/>${crownTrim}<circle cx="32" cy="30" r="14" fill="#211a16" stroke="#120d0b" stroke-width="1.5"/><circle cx="32" cy="30" r="11.5" fill="none" stroke="${pal.rune}" stroke-width="${tier >= 3 ? 2.4 : (tier === 2 ? 1.9 : 1.4)}" stroke-opacity="${tier === 1 ? 0.65 : 0.92}"/>${cornerGems}</svg>`;
        const headBuilder = TOWER_HEAD_TEMPLATES[type] || TOWER_HEAD_TEMPLATES.plasma;
        return { baseSvgHtml, headSvgHtml: `<svg class="tower-head-svg" viewBox="0 0 64 64" aria-hidden="true">${headBuilder(tier)}</svg>` };
    }

    const BOSS_SVG_BY_TYPE = {
        lava: '<polygon points="10,44 16,18 27,22 32,12 37,22 48,18 54,44 45,54 19,54" fill="#29120b" stroke="#0c0503" stroke-width="2"/><polygon points="16,18 9,8 22,15" fill="#7c2d12" stroke="#1c0803" stroke-width="1.5"/><polygon points="48,18 55,8 42,15" fill="#7c2d12" stroke="#1c0803" stroke-width="1.5"/><polygon points="21,26 32,20 43,26 45,42 32,50 19,42" fill="#451a03"/><polygon points="25,31 32,27 39,31 36,42 32,46 28,42" fill="#f97316"/><polygon points="28,33 32,30 36,33 32,40" fill="#fef08a"/><polygon points="23,23 29,25 24,27" fill="#fef08a"/><polygon points="41,23 35,25 40,27" fill="#fef08a"/>',
        air: '<polygon points="11,34 22,16 42,16 53,34 45,49 19,49" fill="#1e293b" stroke="#0f172a" stroke-width="2"/><rect x="7" y="26" width="9" height="15" rx="3" fill="#475569" stroke="#0f172a" stroke-width="1.5"/><rect x="48" y="26" width="9" height="15" rx="3" fill="#475569" stroke="#0f172a" stroke-width="1.5"/><polygon points="20,17 44,17 48,29 16,29" fill="#334155"/><circle cx="32" cy="34" r="9.5" fill="#0284c7" stroke="#bae6fd" stroke-width="1.8"/><circle cx="32" cy="34" r="4.5" fill="#e0f2fe"/><polygon points="26,46 32,54 38,46" fill="#38bdf8"/>',
        wood: '<polygon points="14,19 8,7 22,14 27,21" fill="#3f2b1d" stroke="#180f09" stroke-width="1.5"/><polygon points="50,19 56,7 42,14 37,21" fill="#3f2b1d" stroke="#180f09" stroke-width="1.5"/><polygon points="15,48 20,21 44,21 49,48 41,55 23,55" fill="#4b3423" stroke="#1a110b" stroke-width="2"/><polygon points="19,21 32,12 45,21 38,28 26,28" fill="#166534" stroke="#052e16" stroke-width="1.4"/><polygon points="27,34 32,29 37,34 34,43 30,43" fill="#a855f7" stroke="#f0abfc" stroke-width="1.2"/><circle cx="25" cy="27" r="2.6" fill="#fde047"/><circle cx="39" cy="27" r="2.6" fill="#fde047"/>'
    };

    const MONSTER_SVG_BY_KEY = {
        mini: '<path d="M16 46 Q16 25 32 23 Q48 25 48 46 Q48 54 32 54 Q16 54 16 46 Z" fill="#22c55e" stroke="#14532d" stroke-width="1.8"/><path d="M21 33 Q24 27 31 27" fill="none" stroke="#bbf7d0" stroke-width="2.5" stroke-linecap="round"/><circle cx="27" cy="40" r="2.4" fill="#052e16"/><circle cx="37" cy="40" r="2.4" fill="#052e16"/><circle cx="27.8" cy="39" r="0.9" fill="#ffffff"/><circle cx="37.8" cy="39" r="0.9" fill="#ffffff"/>',
        lava: '<polygon points="16,47 18,22 28,15 36,15 46,22 48,47 39,54 25,54" fill="#3b160c" stroke="#170804" stroke-width="1.8"/><polygon points="21,23 32,17 43,23 41,34 23,34" fill="#7c2d12"/><polygon points="27,32 32,27 37,32 35,44 29,44" fill="#f97316"/><polygon points="30,33 34,33 32,40" fill="#fef08a"/><rect x="23" y="25" width="5" height="3" rx="1" fill="#fde047"/><rect x="36" y="25" width="5" height="3" rx="1" fill="#fde047"/>',
        air: '<polygon points="10,36 22,28 42,28 54,36 42,46 22,46" fill="#0369a1" stroke="#082f49" stroke-width="1.8"/><path d="M21 30 Q21 15 32 15 Q43 15 43 30 Z" fill="#7dd3fc" stroke="#0c4a6e" stroke-width="1.5"/><ellipse cx="29" cy="21" rx="4" ry="2" fill="#ffffff" fill-opacity="0.7"/><circle cx="23" cy="37" r="2.3" fill="#fde047"/><circle cx="32" cy="37" r="2.3" fill="#fde047"/><circle cx="41" cy="37" r="2.3" fill="#fde047"/><polygon points="26,46 38,46 32,53" fill="#f97316"/>',
        hound: '<polygon points="12,41 24,25 22,12 31,21 40,12 39,24 52,32 45,42 42,53 33,44 24,53 20,43" fill="#0891b2" stroke="#083344" stroke-width="1.8"/><polygon points="24,27 39,24 47,32 35,36 21,36" fill="#67e8f9" fill-opacity="0.65"/><polygon points="8,36 17,32 15,40" fill="#a5f3fc"/><circle cx="40" cy="29" r="2.2" fill="#fef08a"/>',
        slime: '<path d="M12 45 Q13 17 32 16 Q51 17 52 45 Q51 54 32 54 Q13 54 12 45 Z" fill="#16a34a" stroke="#052e16" stroke-width="1.8"/><path d="M14 45 Q32 51 50 45 Q47 52 32 53 Q17 52 14 45 Z" fill="#15803d"/><path d="M19 28 Q23 20 31 20" fill="none" stroke="#bbf7d0" stroke-width="3" stroke-linecap="round"/><circle cx="25" cy="39" r="3" fill="#4ade80" fill-opacity="0.75"/><circle cx="25" cy="34" r="3" fill="#052e16"/><circle cx="39" cy="34" r="3" fill="#052e16"/><circle cx="26" cy="33" r="1.1" fill="#ffffff"/><circle cx="40" cy="33" r="1.1" fill="#ffffff"/>',
        golem: '<polygon points="11,45 14,19 24,14 40,14 50,19 53,45 45,54 19,54" fill="#475569" stroke="#0f172a" stroke-width="2"/><polygon points="17,19 47,19 44,33 20,33" fill="#94a3b8"/><polygon points="21,21 43,21 40,28 24,28" fill="#cbd5e1" fill-opacity="0.6"/><rect x="23" y="25" width="18" height="4.5" rx="2" fill="#0f172a"/><rect x="25" y="26.2" width="14" height="2.2" rx="1" fill="#fb923c"/><circle cx="17" cy="24" r="2" fill="#e2e8f0"/><circle cx="47" cy="24" r="2" fill="#e2e8f0"/>',
        wood: '<polygon points="15,47 18,22 46,22 49,47 41,54 23,54" fill="#5c4028" stroke="#1e130b" stroke-width="1.8"/><polygon points="16,24 25,13 32,19 39,13 48,24 38,29 26,29" fill="#15803d" stroke="#052e16" stroke-width="1.4"/><polygon points="23,35 32,31 41,35 37,46 27,46" fill="#22c55e" fill-opacity="0.5"/><circle cx="25" cy="31" r="2.4" fill="#fde047"/><circle cx="39" cy="31" r="2.4" fill="#fde047"/>'
    };

    function createMonsterSvgHtml(monster) {
        const body = monster.isBoss
            ? (BOSS_SVG_BY_TYPE[monster.typeKey] || BOSS_SVG_BY_TYPE.wood)
            : (monster.isSplitChild ? MONSTER_SVG_BY_KEY.mini : (MONSTER_SVG_BY_KEY[monster.typeKey] || MONSTER_SVG_BY_KEY.wood));
        return `<svg class="m-svg" viewBox="0 0 64 64" aria-hidden="true"><ellipse cx="32" cy="57" rx="19" ry="5.5" fill="rgba(0,0,0,0.42)"/>${body}</svg>`;
    }

    // ==================== 棋盤量測與 Canvas 2D 特效層 ====================
    function resizeFxCanvas() {
        const { fxCanvasEl, fxCtx, boardStageEl } = G.dom;
        if (!fxCanvasEl || typeof fxCanvasEl.getContext !== 'function') return;
        const m = G.boardMetrics;
        const cssW = (boardStageEl && boardStageEl.clientWidth) || m.stageW || 560;
        const cssH = (boardStageEl && boardStageEl.clientHeight) || m.stageH || 380;
        m.stageW = cssW; m.stageH = cssH;

        const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) ? Math.min(2, window.devicePixelRatio) : 1;
        const tw = Math.round(cssW * dpr), th = Math.round(cssH * dpr);
        if (fxCanvasEl.width !== tw || fxCanvasEl.height !== th) { fxCanvasEl.width = tw; fxCanvasEl.height = th; }
        if (fxCtx && typeof fxCtx.setTransform === 'function') fxCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function measureBoardMetrics() {
        const cells = G.dom.boardElement ? G.dom.boardElement.children : null;
        if (!cells || cells.length < CONFIG.BOARD_COLS + 1) return;
        const c0 = cells[0], c1 = cells[1], cBelow = cells[CONFIG.BOARD_COLS], m = G.boardMetrics;
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

        if (fxType === 'thunder' || fxType === 'magnet-arc') {
            const isMagnet = fxType === 'magnet-arc';
            const jitter = isMagnet ? 10 : 13;
            const pts = [{ x: sx, y: sy }];
            for (let s = 1; s < 4; s++) {
                const t = s / 4;
                pts.push({ x: sx + (ex - sx) * t + (Math.random() - 0.5) * jitter * 2, y: sy + (ey - sy) * t + (Math.random() - 0.5) * jitter * 2 });
            }
            pts.push({ x: ex, y: ey });
            fx.bolts.push({ points: pts, color: isMagnet ? '#38bdf8' : (options.isLv3 ? '#fef08a' : '#fde047'), coreColor: '#ffffff', width: isMagnet ? 2.4 : (options.isLv3 ? 3.0 : 2.4), ageMs: 0, durationMs: 210 });
            emitParticleBurst(ex, ey, isMagnet ? '#67e8f9' : '#fde047', 6, 75);
            emitHitFlash(ex, ey, isMagnet ? '#bae6fd' : '#fef9c3');
            if (options.frostRadiusPx > 0) emitRingFX(ex, ey, options.frostRadiusPx, '#38bdf8', 0.22, 280);
            return;
        }
        if (fxType === 'plasma') {
            const stacks = options.stacks || 0;
            fx.beams.push({ x1: sx, y1: sy, x2: ex, y2: ey, width: 2.2 + stacks * 0.7, color: stacks >= 4 ? '#f97316' : '#facc15', coreColor: '#fffbeb', ageMs: 0, durationMs: 185 });
            emitParticleBurst(ex, ey, stacks >= 4 ? '#fb923c' : '#fde047', 5 + stacks, 70);
            emitHitFlash(ex, ey, '#fef08a');
            return;
        }
        const coreColor = ({ fire: '#ff6b6b', ice: '#38bdf8', steam: '#7dd3fc' })[fxType] || '#ffffff';
        fx.projectiles.push({ fxType, x1: sx, y1: sy, x2: ex, y2: ey, color: coreColor, radius: fxType === 'fire' ? 4.4 : (fxType === 'steam' ? 4.8 : 3.6), ageMs: 0, durationMs: 135 });
        const ringRadius = options.splashRadiusPx || options.frostRadiusPx || 0;
        if (ringRadius > 0) emitRingFX(ex, ey, ringRadius, fxType === 'ice' ? '#38bdf8' : (fxType === 'steam' ? '#93c5fd' : '#fb923c'), 0.24, 280);
        emitParticleBurst(ex, ey, coreColor, ringRadius > 0 ? 11 : 7, ringRadius > 0 ? 105 : 70);
        emitHitFlash(ex, ey, '#ffffff');
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
        const dtSec = dtMs / 1000, fx = G.fxEntities, st = G.state, m = G.boardMetrics;
        if (G.callbacks.isGameplayActive() && st.baseHp >= CONFIG.WORLD_TREE_HEALTHY_MIN) {
            fx.leafEmitAccMs += dtMs;
            while (fx.leafEmitAccMs >= 420) {
                fx.leafEmitAccMs -= 420;
                const treeWp = G.map.waypoints[G.map.waypoints.length - 1];
                const tp = getCellCenter(treeWp.x, treeWp.y);
                fx.leaves.push({
                    x: tp.left + (Math.random() - 0.5) * m.cellW * 0.65, y: tp.top + (Math.random() - 0.5) * m.cellH * 0.45,
                    vx: -10 - Math.random() * 14, vy: -16 - Math.random() * 16, swayPhase: Math.random() * Math.PI * 2,
                    size: 3.0 + Math.random() * 2.2, color: Math.random() < 0.5 ? '#4ade80' : '#86efac',
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
                        color: Math.random() < 0.5 ? '#fde047' : '#f59e0b', ageMs: 0, durationMs: 420 + Math.random() * 180
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
            fxCtx.globalAlpha = alpha * 0.85; fxCtx.strokeStyle = r.color; fxCtx.lineWidth = 2;
            fxCtx.beginPath(); fxCtx.arc(r.x, r.y, rad, 0, Math.PI * 2); fxCtx.stroke();
            fxCtx.restore();
        }
        for (let i = 0; i < fx.projectiles.length; i++) {
            const pr = fx.projectiles[i], p = Math.min(1, pr.ageMs / pr.durationMs), tp = Math.max(0, p - 0.35);
            const cx = pr.x1 + (pr.x2 - pr.x1) * p, cy = pr.y1 + (pr.y2 - pr.y1) * p;
            fxCtx.save(); fxCtx.lineCap = 'round';
            strokeLine2D(fxCtx, pr.x1 + (pr.x2 - pr.x1) * tp, pr.y1 + (pr.y2 - pr.y1) * tp, cx, cy, pr.color, pr.radius * 1.1, 1 - p * 0.25);
            fillCircle2D(fxCtx, cx, cy, pr.radius * 0.72, '#ffffff', 1 - p * 0.25);
            fxCtx.restore();
        }
        for (let i = 0; i < fx.beams.length; i++) {
            const b = fx.beams[i], a = 1 - Math.min(1, b.ageMs / b.durationMs);
            fxCtx.save(); fxCtx.lineCap = 'round';
            strokeLine2D(fxCtx, b.x1, b.y1, b.x2, b.y2, b.color, b.width * 2.1, a * 0.65);
            strokeLine2D(fxCtx, b.x1, b.y1, b.x2, b.y2, b.coreColor, Math.max(1.2, b.width * 0.75), a);
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
            trace(bl.color, bl.width * 2.1, a * 0.6);
            trace(bl.coreColor, Math.max(1.2, bl.width * 0.7), a);
            fxCtx.restore();
        }
        for (let i = 0; i < fx.particles.length; i++) {
            const pt = fx.particles[i], a = 1 - Math.min(1, pt.ageMs / pt.durationMs);
            fxCtx.save(); fillCircle2D(fxCtx, pt.x, pt.y, pt.radius * a, pt.color, a); fxCtx.restore();
        }
        for (let i = 0; i < fx.flashes.length; i++) {
            const fl = fx.flashes[i], a = (1 - Math.min(1, fl.ageMs / fl.durationMs)) * 0.65;
            fxCtx.save(); fillCircle2D(fxCtx, fl.x, fl.y, fl.radius, fl.color, a); fxCtx.restore();
        }
        for (let i = 0; i < fx.leaves.length; i++) {
            const lf = fx.leaves[i], p = Math.min(1, lf.ageMs / lf.durationMs), alpha = Math.sin(p * Math.PI) * 0.88;
            if (alpha <= 0.01) continue;
            fxCtx.save(); fxCtx.globalAlpha = alpha; fxCtx.fillStyle = lf.color; fxCtx.shadowColor = '#22c55e'; fxCtx.shadowBlur = 6;
            fxCtx.translate(lf.x, lf.y); fxCtx.rotate(lf.swayPhase + p * 2.2);
            fxCtx.beginPath(); fxCtx.ellipse(0, 0, lf.size, lf.size * 0.52, 0, 0, Math.PI * 2); fxCtx.fill(); fxCtx.restore();
        }
        for (let i = 0; i < st.monsters.length; i++) {
            const mon = st.monsters[i];
            if ((mon.rootTimer || 0) <= 0) continue;
            fxCtx.save(); fxCtx.strokeStyle = 'rgba(74, 222, 128, 0.85)'; fxCtx.lineWidth = 2.2; fxCtx.setLineDash([4, 3]);
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

        const armorHtml = monster.armor > 0 ? `<span class="m-armor-badge">🛡️${monster.armor}</span>` : '';
        const weakCfg = ELEMENT_CONFIG[monster.weakness];
        const weakShort = weakCfg ? `${weakCfg.icon}${weakCfg.name.charAt(0)}` : '';
        const bossHtml = monster.isBoss ? `<span class="m-boss-badge weak-${monster.weakness}">👑弱${weakShort}</span>` : '';
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
        if (!G.dom.monsterLayerEl) return;
        const monsters = G.state.monsters;
        const activeIds = new Set();
        for (let i = 0; i < monsters.length; i++) activeIds.add(monsters[i].id);
        for (const [id, rec] of G.monsterDomMap.entries()) {
            if (!activeIds.has(id)) { rec.el.remove(); G.monsterDomMap.delete(id); }
        }

        const Combat = global.GameCombat;
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
                rec.armorBadgeEl.innerText = isShredded ? `🔥${Math.round(Combat ? Combat.getMonsterEffectiveArmor(m) : m.armor)}` : `🛡️${m.armor}`;
            }
            const hpPct = Math.max(0, (m.hp / m.maxHp) * 100);
            if (rec.hpFillEl) {
                rec.hpFillEl.style.width = `${hpPct}%`;
                rec.hpFillEl.style.backgroundColor = hpPct <= 25 ? '#e74c3c' : (hpPct <= 55 ? '#f39c12' : '#2ecc71');
            }
        }
        G.callbacks.updateBossStatusBar();
    }

    function repositionAllMonsters() {
        for (let i = 0; i < G.state.monsters.length; i++) {
            const m = G.state.monsters[i], pos = getCellCenter(m.gridX, m.gridY);
            m.pixelX = pos.left + (m.visualOffsetX || 0);
            m.pixelY = pos.top + (m.visualOffsetY || 0);
        }
        renderMonsterLayer();
    }

    function clearCellDragHighlights() {
        for (let i = 0; i < G.cellElements.length; i++) G.cellElements[i].classList.remove('drag-over', 'drag-invalid');
    }

    function clearTouchDragVisuals() {
        const st = G.state;
        if (st.touchDragState && st.touchDragState.ghostEl) st.touchDragState.ghostEl.remove();
        clearCellDragHighlights();
        for (let i = 0; i < G.towerElements.length; i++) {
            if (G.towerElements[i]) G.towerElements[i].classList.remove('dragging');
        }
        st.touchDragState = null;
    }

    function createTowerElement(towerObj, index) {
        const cfg = ELEMENT_CONFIG[towerObj.type], st = G.state;
        const tower = document.createElement('div');
        tower.classList.add('tower', `type-${towerObj.type}`, `lv-${towerObj.tier}`);
        if (st.frenzyActiveMs > 0) tower.classList.add('frenzy-active');
        tower.setAttribute('draggable', true);

        tower.addEventListener('dragstart', () => {
            if (!G.callbacks.isGameplayActive()) return;
            st.draggedIndex = index; st.selectedIndex = null; st.buildTargetIndex = null;
            tower.classList.add('dragging');
            updateRangeIndicator(); G.callbacks.updateTowerInspector();
            G.dom.msgText.innerText = `抓起【${cfg.name} ${getTierStars(towerObj.tier)}】`;
        });
        tower.addEventListener('dragend', () => {
            tower.classList.remove('dragging'); clearCellDragHighlights(); st.draggedIndex = null; updateRangeIndicator();
        });
        tower.addEventListener('touchstart', (e) => {
            G.callbacks.activateTouchMode();
            if (!G.callbacks.isGameplayActive() || e.touches.length !== 1) return;
            const touch = e.touches[0];
            st.touchDragState = { sourceIndex: index, startX: touch.clientX, startY: touch.clientY, isDragging: false, ghostEl: null, towerEl: tower, cfg, tier: towerObj.tier };
        }, { passive: true });

        const { baseSvgHtml, headSvgHtml } = createTowerSvgParts(towerObj.type, towerObj.tier);
        const baseLayer = document.createElement('div'); baseLayer.classList.add('tower-base-layer'); baseLayer.innerHTML = baseSvgHtml;
        const headRotator = document.createElement('div'); headRotator.classList.add('tower-head-rotator'); headRotator.style.transform = `rotate(${towerObj.aimAngleDeg || 0}deg)`;
        const headRecoil = document.createElement('div'); headRecoil.classList.add('tower-head-recoil'); headRecoil.innerHTML = headSvgHtml;
        headRotator.appendChild(headRecoil);
        const name = document.createElement('div'); name.classList.add('tower-name'); name.innerText = getTierStars(towerObj.tier);

        tower._rotator = headRotator;
        tower._recoilEl = headRecoil;
        tower.appendChild(baseLayer); tower.appendChild(headRotator); tower.appendChild(name);
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
        highground: '<svg class="terrain-svg" viewBox="0 0 64 64" aria-hidden="true"><defs><pattern id="hgHatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><line x1="0" y1="0" x2="0" y2="8" stroke="rgba(251,191,36,0.22)" stroke-width="1.6"/></pattern></defs><rect x="2" y="2" width="60" height="60" rx="6" fill="url(#hgHatch)"/><polygon points="10,50 24,18 35,32 45,14 54,50" fill="rgba(245,158,11,0.16)" stroke="rgba(253,224,71,0.58)" stroke-width="1.6" stroke-linejoin="round"/><polyline points="16,44 26,26 35,38 44,23 50,44" fill="none" stroke="rgba(254,240,138,0.42)" stroke-width="1.2" stroke-linejoin="round"/><path d="M8 15 V8 H15 M49 8 H56 V15 M8 49 V56 H15 M49 56 H56 V49" fill="none" stroke="rgba(251,191,36,0.75)" stroke-width="1.8" stroke-linecap="round"/></svg>',
        mana_vein: '<svg class="terrain-svg" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="24" fill="rgba(14,165,233,0.12)" stroke="rgba(56,189,248,0.58)" stroke-width="1.5" stroke-dasharray="5 3"/><circle cx="32" cy="32" r="16" fill="none" stroke="rgba(125,211,252,0.72)" stroke-width="1.4"/><polygon points="32,12 48,32 32,52 16,32" fill="rgba(56,189,248,0.14)" stroke="rgba(186,230,253,0.62)" stroke-width="1.3"/><line x1="32" y1="6" x2="32" y2="14" stroke="#7dd3fc" stroke-width="1.6"/><line x1="32" y1="50" x2="32" y2="58" stroke="#7dd3fc" stroke-width="1.6"/><line x1="6" y1="32" x2="14" y2="32" stroke="#7dd3fc" stroke-width="1.6"/><line x1="50" y1="32" x2="58" y2="32" stroke="#7dd3fc" stroke-width="1.6"/><circle cx="32" cy="32" r="5" fill="#38bdf8" fill-opacity="0.72" stroke="#e0f2fe" stroke-width="1.3"/></svg>',
        world_tree: '<svg class="terrain-svg" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="24" fill="rgba(34,197,94,0.12)" stroke="rgba(74,222,128,0.55)" stroke-width="1.5"/><path d="M32 10 C45 18 50 32 32 54 C14 32 19 18 32 10 Z" fill="rgba(74,222,128,0.18)" stroke="rgba(134,239,172,0.75)" stroke-width="1.6"/><line x1="32" y1="14" x2="32" y2="52" stroke="rgba(187,247,208,0.75)" stroke-width="1.5"/><path d="M32 24 L41 19 M32 32 L43 26 M32 40 L40 35 M32 24 L23 19 M32 32 L21 26 M32 40 L24 35" stroke="rgba(187,247,208,0.65)" stroke-width="1.3" stroke-linecap="round"/></svg>'
    };

    function initBoard() {
        const boardEl = G.dom.boardElement, st = G.state, map = G.map;
        boardEl.innerHTML = ''; G.cellElements.length = 0; G.towerElements.fill(null);
        st.lastRenderedSelected = null; st.lastRenderedBuildTarget = null;

        for (let index = 0; index < CONFIG.BOARD_SIZE; index++) {
            const cell = document.createElement('div');
            cell.classList.add('cell');
            cell.dataset.index = index;
            if (map.pathCellIndices.has(index)) {
                cell.classList.add('path-cell');
                if (index === map.startCellIndex) cell.classList.add('path-start');
                if (index === map.endCellIndex) cell.classList.add('path-end');
                if (map.pathFlowArrows.has(index)) {
                    const arrow = document.createElement('span');
                    arrow.classList.add('path-arrow');
                    arrow.style.transform = `rotate(${map.pathFlowArrows.get(index)}deg)`;
                    arrow.innerText = '▸';
                    cell.appendChild(arrow);
                }
            } else {
                const terrain = map.terrainMap.get(index) || null;
                if (terrain) {
                    const tCfg = TERRAIN_CONFIG[terrain];
                    cell.classList.add(`terrain-${terrain}`);
                    cell.setAttribute('title', tCfg.tooltip);
                    const art = document.createElement('div');
                    art.classList.add('terrain-art');
                    art.setAttribute('aria-hidden', 'true');
                    art.innerHTML = TERRAIN_SVG_BY_TYPE[terrain] || '';
                    cell.appendChild(art);
                }
            }
            cell.addEventListener('mouseenter', () => { if (!st.isTouchMode && st.hoveredIndex !== index) { st.hoveredIndex = index; updateRangeIndicator(); } });
            cell.addEventListener('mouseleave', () => { if (!st.isTouchMode && st.hoveredIndex === index) { st.hoveredIndex = null; updateRangeIndicator(); } });
            cell.addEventListener('dragover', (e) => { e.preventDefault(); cell.classList.add(map.pathCellIndices.has(index) ? 'drag-invalid' : 'drag-over'); });
            cell.addEventListener('dragleave', () => cell.classList.remove('drag-over', 'drag-invalid'));
            cell.addEventListener('drop', (e) => {
                e.preventDefault(); cell.classList.remove('drag-over', 'drag-invalid');
                const fromIdx = st.draggedIndex; st.draggedIndex = null; G.callbacks.handleAction(fromIdx, index);
            });
            cell.addEventListener('click', () => { if (performance.now() - st.lastTouchDragEndTime >= 250) G.callbacks.handleCellClick(index); });
            G.cellElements.push(cell);
            boardEl.appendChild(cell);
        }
        measureBoardMetrics();
    }

    function renderBoard(dirtyIndices = null) {
        const boardEl = G.dom.boardElement, st = G.state, cells = G.cellElements;
        if (cells.length !== CONFIG.BOARD_SIZE || boardEl.children.length !== CONFIG.BOARD_SIZE) initBoard();

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
                if (idx >= 0 && idx < CONFIG.BOARD_SIZE && !visited.has(idx)) { visited.add(idx); renderCellTower(idx); }
            }
        } else {
            for (let idx = 0; idx < CONFIG.BOARD_SIZE; idx++) renderCellTower(idx);
            measureBoardMetrics();
        }
        updateRangeIndicator();
        G.callbacks.updateTowerInspector();
    }

    function updateRangeIndicator() {
        const el = G.dom.rangeCircleEl, st = G.state;
        if (!el) return;
        if (st.isGameOver || st.waveState === 'WAITING_START' || st.waveState === 'VICTORY'
            || st.waveState === 'BLESSING_SELECT' || st.draggedIndex !== null || (st.touchDragState && st.touchDragState.isDragging)) {
            el.className = ''; return;
        }
        const targetIdx = (!st.isTouchMode && st.hoveredIndex !== null && st.board[st.hoveredIndex] !== null)
            ? st.hoveredIndex : ((st.selectedIndex !== null && st.board[st.selectedIndex] !== null) ? st.selectedIndex : null);
        if (targetIdx === null) { el.className = ''; return; }

        const towerObj = st.board[targetIdx], coords = indexToCoords(targetIdx), center = getCellCenter(coords.x, coords.y);
        const radiusPx = global.GameCombat.getTowerRangePx(towerObj, targetIdx);
        el.style.left = `${center.left}px`; el.style.top = `${center.top}px`;
        el.style.width = `${radiusPx * 2}px`; el.style.height = `${radiusPx * 2}px`;
        el.className = `visible range-${towerObj.type}`;
    }

    function updateWorldTreeVisualState() {
        const st = G.state, treeCell = G.cellElements[G.map.endCellIndex], hpHudEl = G.dom.hpHudEl;
        const isHealthy = st.baseHp >= CONFIG.WORLD_TREE_HEALTHY_MIN, isWarn = st.baseHp >= CONFIG.WORLD_TREE_WARNING_MIN;
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

    global.GameRenderer = {
        bind, getTierStars, createTowerSvgParts, createMonsterSvgHtml, resizeFxCanvas, measureBoardMetrics,
        getCellCenter, clearCanvasFXState, emitParticleBurst, emitHitFlash, emitRingFX, spawnDamageNumber,
        emitCanvasAttackFX, updateAndRenderCanvasFX, updateTowerAimVisual, createMonsterDom, removeMonsterDom,
        renderMonsterLayer, repositionAllMonsters, clearCellDragHighlights, clearTouchDragVisuals,
        createTowerElement, renderCellTower, initBoard, renderBoard, updateRangeIndicator,
        updateWorldTreeVisualState, triggerWorldTreeShake
    };
})(window);
