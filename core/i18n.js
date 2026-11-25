/**
 * ============================================================================
 * 【檔案名稱】：core/i18n.js
 * 【負責功能】：全站純原生離線雙語字典（繁體中文 zh-TW / 英文 EN）與即時切換引擎。
 *               掛載於 window.GameApp.i18n，記憶語系至 localStorage，不影響任何戰鬥與經濟數值。
 * ============================================================================
 */
(function (global) {
    'use strict';

    const GameApp = global.GameApp = global.GameApp || {};
    const STORAGE_KEY = 'merge_defense_lang';
    const subscribers = new Set();

    let currentLang = 'zh-TW';
    try {
        const saved = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
        if (saved === 'en' || saved === 'zh-TW') {
            currentLang = saved;
        } else if (typeof navigator !== 'undefined') {
            const navLang = navigator.language || (Array.isArray(navigator.languages) && navigator.languages[0]) || '';
            currentLang = String(navLang).toLowerCase().includes('zh') ? 'zh-TW' : 'en';
        }
    } catch (_) { }

    const EN_TOWERS = {
        fire_bud: {
            name: 'Fire Bud', shortName: 'Fire 1★',
            shopRoleTag: 'ATK 25 · 25% Shred',
            roleSummary: 'Single Armor Shred (25%)',
            tooltipSummary: 'Hits shred 25% target armor for 3.0s',
            lineagePath: '🔥 Fire Bud'
        },
        ice_bud: {
            name: 'Ice Bud', shortName: 'Ice 1★',
            shopRoleTag: 'ATK 15 · 40% Slow',
            roleSummary: 'Slow Control (40%)',
            tooltipSummary: 'Slows target by 40% for 2.0s',
            lineagePath: '❄️ Ice Bud'
        },
        thunder_bud: {
            name: 'Thunder Bud', shortName: 'Thunder 1★',
            shopRoleTag: 'ATK 13 · Chain ×2',
            roleSummary: '2-Target Lightning Chain',
            tooltipSummary: 'Arcs to 2 targets; +30% vs Air/Armor',
            lineagePath: '⚡ Thunder Bud'
        },
        steam_bud: {
            name: 'Steam Geyser', shortName: 'Steam 1★',
            shopRoleTag: 'Pierce 45% · 1.3 AoE Splash',
            roleSummary: 'Ignores 45% Armor + 70% Splash',
            tooltipSummary: 'Ignores 45% armor + 1.3-cell 70% splash',
            lineagePath: '🔥 Fire + ❄️ Ice ▸ 💨 Steam 1★'
        },
        magnet_bud: {
            name: 'Polar Magnet', shortName: 'Magnet 1★',
            shopRoleTag: '45% AoE Slow + 2 Ricochets',
            roleSummary: 'AoE Slow + 2 Ricochets (70%)',
            tooltipSummary: '45% AoE slow + 2 different target bounces',
            lineagePath: '❄️ Ice + ⚡ Thunder ▸ 💠 Magnet 1★'
        },
        plasma_bud: {
            name: 'Plasma Conduit', shortName: 'Plasma 1★',
            shopRoleTag: 'Lock Stacks +12% · 3.6 Rng',
            roleSummary: '4-Stack Focus (+12%/stk)',
            tooltipSummary: 'Ignores 15% armor; up to 4 focus stacks (+12%)',
            lineagePath: '🔥 Fire + ⚡ Thunder ▸ ☄️ Plasma 1★'
        },
        fire_trunk: {
            name: 'Ember Trunk', shortName: 'Ember 2★',
            roleSummary: 'Heavy Burst + 35% Armor Shred',
            tooltipSummary: 'Heavy single burst + 35% shred for 3.5s',
            lineagePath: '🔥 Fire 1★ ▸ Ember 2★'
        },
        ice_trunk: {
            name: 'Frost Trunk', shortName: 'Frost 2★',
            roleSummary: '48% Deep Slow Control',
            tooltipSummary: 'Slows target by 48% for 2.4s',
            lineagePath: '❄️ Ice 1★ ▸ Frost 2★'
        },
        thunder_trunk: {
            name: 'Volt Trunk', shortName: 'Volt 2★',
            roleSummary: '3-Target Thunder Chain',
            tooltipSummary: '3-target lightning chain (65%/45%)',
            lineagePath: '⚡ Thunder 1★ ▸ Volt 2★'
        },
        steam_trunk: {
            name: 'Hi-Steam Geyser', shortName: 'Steam 2★',
            roleSummary: 'Ignores 50% Armor + 1.4 Splash',
            tooltipSummary: 'Ignores 50% armor + 1.4-cell 72% splash',
            lineagePath: '💨 Steam 1★ ▸ Hi-Steam 2★'
        },
        magnet_trunk: {
            name: 'Hi-Polar Magnet', shortName: 'Magnet 2★',
            roleSummary: '50% AoE Slow + 2 Bounces (72%)',
            tooltipSummary: '50% AoE slow + 2 bounces (72% dmg)',
            lineagePath: '💠 Magnet 1★ ▸ Hi-Magnet 2★'
        },
        plasma_trunk: {
            name: 'Hi-Plasma Beam', shortName: 'Plasma 2★',
            roleSummary: '4-Stack Focus (+14%) + 20% Pierce',
            tooltipSummary: 'Ignores 20% armor; 4 focus stacks (+14%/stk)',
            lineagePath: '☄️ Plasma 1★ ▸ Hi-Plasma 2★'
        },
        fire_A: {
            name: 'Core Bombardier', shortName: 'A Bombard',
            roleSummary: '1.3-Cell 60% Splash + 45% Shred',
            tooltipSummary: '1.3-cell 60% splash + 45% AoE shred (4s)',
            lineagePath: '🔥 Ember 2★ ▸ A Core Bombardier'
        },
        fire_B: {
            name: 'Cinder Sovereign', shortName: 'B Cinder',
            roleSummary: '5-Stack Burn + 50% Grievous + <12% Exec',
            tooltipSummary: '5-stack contagious burn + 50% wound + <12% exec',
            lineagePath: '🔥 Ember 2★ ▸ B Cinder Sovereign'
        },
        ice_A: {
            name: 'Permafrost Domain', shortName: 'A Permafrost',
            roleSummary: '1.5-Cell 60% Slow + 1.5x Freeze Burst',
            tooltipSummary: '1.5-cell 60% slow; 4th hit freezes 0.9s + 1.5x Ice Burst',
            lineagePath: '❄️ Frost 2★ ▸ A Permafrost Domain'
        },
        ice_B: {
            name: 'Icicle Piercer', shortName: 'B Icicle',
            roleSummary: '2-Target Pierce +55% Shatter',
            tooltipSummary: 'Pierces 2 targets; +55% dmg vs slowed/frozen',
            lineagePath: '❄️ Frost 2★ ▸ B Icicle Piercer'
        },
        thunder_A: {
            name: 'Tempest Chain', shortName: 'A Tempest',
            roleSummary: '4-Bounce Lightning (Upgraded Scales)',
            tooltipSummary: '4 lightning bounces (75%/55%/40%)',
            lineagePath: '⚡ Volt 2★ ▸ A Tempest Chain'
        },
        thunder_B: {
            name: 'Sky Judgment', shortName: 'B Judgment',
            roleSummary: 'Every 3rd Hit 2.6x + 45% Pierce · Kill -45% CD',
            tooltipSummary: 'Every 3rd thunder hit deals 2.6x DMG (45% pierce); kills refund 45% CD + charge',
            lineagePath: '⚡ Volt 2★ ▸ B Sky Judgment'
        },
        steam_A: {
            name: 'Scorch Pressure', shortName: 'A Pressure',
            roleSummary: '65% Pierce + 3s Steam Pool',
            tooltipSummary: 'Ignores 65% armor + 1.4 splash + 3s steam pool',
            lineagePath: '💨 Hi-Steam 2★ ▸ A Scorch Pressure'
        },
        steam_B: {
            name: 'Frostmist Maze', shortName: 'B Frostmist',
            roleSummary: 'Mist +20% Vuln +15% Kill Gold',
            tooltipSummary: '1.6-cell mist slow 35%, +20% dmg taken, +15% kill gold',
            lineagePath: '💨 Hi-Steam 2★ ▸ B Frostmist Maze'
        },
        magnet_A: {
            name: 'Gravity Well', shortName: 'A Blackhole',
            roleSummary: '1.65-Cell 50% Slow + 2nd Pulse Pull 0.65 & +12% Vuln',
            tooltipSummary: '1.65-cell 50% slow; every 2nd pulse deals 1.25x, +12% vuln & pulls 0.65 cells',
            lineagePath: '💠 Hi-Magnet 2★ ▸ A Gravity Well'
        },
        magnet_B: {
            name: 'Volt Overload', shortName: 'B Overload',
            roleSummary: '3-Bounce + Scaling Shock',
            tooltipSummary: '3 bounces + 3.5s Shock (10+2.5*Wave Thunder on ally hit)',
            lineagePath: '💠 Hi-Magnet 2★ ▸ B Volt Overload'
        },
        plasma_A: {
            name: 'Fusion Deathray', shortName: 'A Deathray',
            roleSummary: '8-Stack Lock (+16%/stk) + 45% Pierce',
            tooltipSummary: 'Up to 8 focus stacks (+16%/stk); ≥5 stk 45% pierce, drops 2 on retarget',
            lineagePath: '☄️ Hi-Plasma 2★ ▸ A Fusion Deathray'
        },
        plasma_B: {
            name: 'Prism Refractor', shortName: 'B Prism',
            roleSummary: '4-Stack Main + 2 Refract Beams',
            tooltipSummary: 'Focus main target + refracts 50% beam to 2 foes',
            lineagePath: '☄️ Hi-Plasma 2★ ▸ B Prism Refractor'
        },
        // ==================== Tier 4（18 座極意古冠／雙生神冠，8U）與 Tier 5（6 座世界樹神裔，16U） ====================
        fire_crown_A: {
            name: 'Solar Forge Crown', shortName: '🔥A Mastery',
            roleSummary: '1.6 Splash + 55% AoE Shred (4★ Mastery)',
            tooltipSummary: '1.6-cell 72% splash + 55% shred (4.5s) · Peak Bombard',
            lineagePath: '🔥 Ember 2★ ▸ A Core Bombardier ▸ Solar Forge 4★'
        },
        fire_crown_B: {
            name: 'Eternal Cinder Crown', shortName: '🔥B Mastery',
            roleSummary: '7-Stack Burn + 60% Wound + <16% Exec (4★ Mastery)',
            tooltipSummary: '7-stack contagious burn + 60% wound + <16% exec · Peak Burn',
            lineagePath: '🔥 Ember 2★ ▸ B Cinder Sovereign ▸ Eternal Cinder 4★'
        },
        fire_twin_AB: {
            name: 'Twin Cinderforge Crown', shortName: '🔥AB Twin Crown',
            roleSummary: '1.4 Splash Shred (42%) + 5-Stack Burn (<12% Exec)',
            tooltipSummary: '1.4-cell 58% splash shred (42%) + 5-stack burn (<12% exec)',
            lineagePath: '🔥 Bombardier + Cinder ▸ Twin Cinderforge 4★'
        },
        fire_scion: {
            name: 'Blazeking Scion', shortName: '🔥World Scion',
            roleSummary: 'Full Mortar + Burn Scion · 1.5% True DMG · 2.2 Aura + Pulse',
            tooltipSummary: 'Full Mortar + Burn Scion · 1.5% True DMG · 2.2 Aura + Pulse',
            lineagePath: '🔥 Fire 2★ ▸ Twin Cinderforge 4★ ▸ Blazeking Scion 5★'
        },
        ice_crown_A: {
            name: 'Whiteout Prison Crown', shortName: '❄️A Mastery',
            roleSummary: '1.8 Slow 65% + 3-Hit Freeze 1.75x Burst (4★ Mastery)',
            tooltipSummary: '1.8-cell 65% slow · 3rd hit freezes 1.1s + 1.75x Ice Burst',
            lineagePath: '❄️ Frost 2★ ▸ A Permafrost Domain ▸ Whiteout 4★'
        },
        ice_crown_B: {
            name: 'Worldpierce Ice Crown', shortName: '❄️B Mastery',
            roleSummary: '3-Target Pierce +70% Shatter (4★ Mastery)',
            tooltipSummary: 'Pierces 3 targets (68%/45%) · +70% shatter vs controlled',
            lineagePath: '❄️ Frost 2★ ▸ B Icicle Piercer ▸ Worldpierce 4★'
        },
        ice_twin_AB: {
            name: 'Twin Frostedge Crown', shortName: '❄️AB Twin Crown',
            roleSummary: '1.55 Slow 55% Freeze + 2-Pierce (+50% Shatter)',
            tooltipSummary: '1.55-cell 55% slow (4-hit freeze) + 2-pierce (+50% shatter)',
            lineagePath: '❄️ Permafrost + Icicle ▸ Twin Frostedge 4★'
        },
        ice_scion: {
            name: 'Absolutefrost Scion', shortName: '❄️World Scion',
            roleSummary: 'Full Freeze + 3-Pierce Scion · +15% Brittle · 2.2 Aura + Pulse',
            tooltipSummary: 'Full Freeze + 3-Pierce Scion · +15% Brittle · 2.2 Aura + Pulse',
            lineagePath: '❄️ Ice 2★ ▸ Twin Frostedge 4★ ▸ Absolutefrost Scion 5★'
        },
        thunder_crown_A: {
            name: 'Skynet Tempest Crown', shortName: '⚡A Mastery',
            roleSummary: '5-Target Chain Lightning (4★ Mastery)',
            tooltipSummary: '5-target chain lightning (3.0-cell arc) · Peak Chain',
            lineagePath: '⚡ Volt 2★ ▸ A Tempest Chain ▸ Skynet 4★'
        },
        thunder_crown_B: {
            name: 'Doomsday Verdict Crown', shortName: '⚡B Mastery',
            roleSummary: '3rd Hit 2.9x + 60% Pierce · Kill -55% CD (4★ Mastery)',
            tooltipSummary: 'Every 3rd hit 2.9x DMG + 60% pierce · Kills refund 55% CD + charge',
            lineagePath: '⚡ Volt 2★ ▸ B Sky Judgment ▸ Verdict 4★'
        },
        thunder_twin_AB: {
            name: 'Twin Skybolt Crown', shortName: '⚡AB Twin Crown',
            roleSummary: '4-Target Chain + Every 3rd Hit 2.2x Pierce',
            tooltipSummary: '4-target lightning chain + every 3rd hit 2.2x pierce + kill -25% CD',
            lineagePath: '⚡ Tempest + Judgment ▸ Twin Skybolt 4★'
        },
        thunder_scion: {
            name: 'Apexbolt Scion', shortName: '⚡World Scion',
            roleSummary: 'Full Tempest + Verdict Scion · <10% Exec · 2.2 Aura + Pulse',
            tooltipSummary: 'Full Tempest + Verdict Scion · <10% Exec · 2.2 Aura + Pulse',
            lineagePath: '⚡ Volt 2★ ▸ Twin Skybolt 4★ ▸ Apexbolt Scion 5★'
        },
        steam_crown_A: {
            name: 'Abyssal Boiler Crown', shortName: '💨A Mastery',
            roleSummary: '75% Pierce Splash + 3.6s Steam Pool (4★ Mastery)',
            tooltipSummary: '75% pierce + 1.65 splash + 3.6s steam pool (52/s)',
            lineagePath: '💨 Hi-Steam 2★ ▸ A Pressure ▸ Abyssal Boiler 4★'
        },
        steam_crown_B: {
            name: 'Eternal Bonefog Crown', shortName: '💨B Mastery',
            roleSummary: '1.9 Mist 45% Slow +30% Vuln +15% Gold (4★ Mastery)',
            tooltipSummary: '1.9-cell fog 45% slow + 30% vuln + 15% kill gold',
            lineagePath: '💨 Hi-Steam 2★ ▸ B Frostmist ▸ Eternal Bonefog 4★'
        },
        steam_twin_AB: {
            name: 'Twin Steammist Crown', shortName: '💨AB Twin Crown',
            roleSummary: '60% Pierce Splash + 34/s Pool + 1.6 Fog (+20% Vuln)',
            tooltipSummary: '60% pierce splash + 34/s steam pool + 1.6 mist (+20% vuln)',
            lineagePath: '💨 Pressure + Frostmist ▸ Twin Steammist 4★'
        },
        steam_scion: {
            name: 'Palemist Scion', shortName: '💨World Scion',
            roleSummary: 'Full Pressure + Fog Scion · +25% Pierce +0.4 Spread · Aura + Pulse',
            tooltipSummary: 'Full Pressure + Fog Scion · +25% Pierce +0.4 Spread · Aura + Pulse',
            lineagePath: '💨 Steam 2★ ▸ Twin Steammist 4★ ▸ Palemist Scion 5★'
        },
        magnet_crown_A: {
            name: 'Singularity Crown', shortName: '💠A Mastery',
            roleSummary: '1.9 Slow 58% + Pull 0.85 & +18% Vuln (4★ Mastery)',
            tooltipSummary: '1.9-cell 58% slow · 2nd pulse 1.35x, +18% vuln & pulls 0.85 cells',
            lineagePath: '💠 Hi-Magnet 2★ ▸ A Gravity ▸ Singularity 4★'
        },
        magnet_crown_B: {
            name: 'Overclock Grid Crown', shortName: '💠B Mastery',
            roleSummary: '4-Bounce + 4.2s Heavy Shock (4★ Mastery)',
            tooltipSummary: '4 bounces (82%) + 4.2s heavy Shock aura (16+3.2*W)',
            lineagePath: '💠 Hi-Magnet 2★ ▸ B Overload ▸ Overclock Grid 4★'
        },
        magnet_twin_AB: {
            name: 'Twin Fluxdome Crown', shortName: '💠AB Twin Crown',
            roleSummary: '1.55 Slow + 0.45 Pull + 3-Target Shock (10+2.5*W)',
            tooltipSummary: '1.55-cell slow + 0.45-cell pull + 3-target Shock (10+2.5*Wave)',
            lineagePath: '💠 Gravity + Overload ▸ Twin Fluxdome 4★'
        },
        magnet_scion: {
            name: 'Starmagnet Scion', shortName: '💠World Scion',
            roleSummary: 'Full Flux + Shock Scion · Periodic Root · 2.2 Aura + Pulse',
            tooltipSummary: 'Full Flux + Shock Scion · Periodic Root · 2.2 Aura + Pulse',
            lineagePath: '💠 Magnet 2★ ▸ Twin Fluxdome 4★ ▸ Starmagnet Scion 5★'
        },
        plasma_crown_A: {
            name: 'Starburst Annihilation Crown', shortName: '☄️A Mastery',
            roleSummary: '10-Stack Focus (+16%/stk) + 55% Pierce (4★ Mastery)',
            tooltipSummary: '10 focus stacks (+16%/stk, 2.60x) + 55% pierce (≥4 stk)',
            lineagePath: '☄️ Hi-Plasma 2★ ▸ A Deathray ▸ Starburst 4★'
        },
        plasma_crown_B: {
            name: 'Prismatic Horizon Crown', shortName: '☄️B Mastery',
            roleSummary: '5-Stack Focus + 3 Refract Beams (4★ Mastery)',
            tooltipSummary: '5 focus stacks (+15%/stk) + 3 refract beams (58%)',
            lineagePath: '☄️ Hi-Plasma 2★ ▸ B Prism ▸ Prismatic 4★'
        },
        plasma_twin_AB: {
            name: 'Twin Arcprism Crown', shortName: '☄️AB Twin Crown',
            roleSummary: '6-Stack Focus (≥4 Stk 38% Pierce) + 2 Refract Beams',
            tooltipSummary: '6-stack focus (38% pierce) + 2 refract beams (48% dmg)',
            lineagePath: '☄️ Deathray + Prism ▸ Twin Arcprism 4★'
        },
        plasma_scion: {
            name: 'Radiantbeam Scion', shortName: '☄️World Scion',
            roleSummary: 'Full Beam + Prism Scion (Max 9 Stacks) · 2.2 Aura + Pulse',
            tooltipSummary: 'Full Beam + Prism Scion (Max 9 Stacks + 2 Refract) · 2.2 Aura + Pulse',
            lineagePath: '☄️ Plasma 2★ ▸ Twin Arcprism 4★ ▸ Radiantbeam Scion 5★'
        },
        storm_tri: {
            name: 'Cataclysm Stormtree', shortName: '⛈️Stormtree',
            roleSummary: '2.2-Cell Drifting Storm Cloud · 45% Armor Pierce + 15% MaxHP Martyr Burst',
            tooltipSummary: '2.2-Cell Drifting Storm Cloud · 45% Pierce + 15% Martyr Burst · 1.26x Affinity',
            lineagePath: '💨 Steam 2★ + ⚡ Thunder 2★ ▸ ⛈️ Cataclysm Stormtree 3★ (4U)'
        },
        storm_tri_4: {
            name: 'Ancient Cataclysm Stormtree', shortName: '⛈️Storm 4★',
            roleSummary: 'Ascended 2.2-Cell Drifting Storm Cloud · 45% Pierce + 15% Martyr Burst',
            tooltipSummary: 'Ascended Storm Cloud · 45% Pierce + 15% Martyr Burst · 1.26x Affinity',
            lineagePath: '💨 Steam 3★ + ⚡ Thunder 3★ (or 8U) ▸ ⛈️ Ancient Stormtree 4★'
        },
        starforge_tri: {
            name: 'Astral Forged Tree', shortName: '🌋Starforge',
            roleSummary: '1.85-Cell Vortex Pull + Freeze + 42% Shred + 2.8s Aftershock Field',
            tooltipSummary: '1.85-Cell Pull + 0.55s Freeze + 42% Shred + 2.8s Molten Aftershock · 1.26x Affinity',
            lineagePath: '💠 Magnet 2★ + 🔥 Fire 2★ ▸ 🌋 Astral Forged Tree 3★ (4U)'
        },
        starforge_tri_4: {
            name: 'Ancient Astral Forged Tree', shortName: '🌋Forge 4★',
            roleSummary: '2.05-Cell Vortex Pull + Freeze + 50% Shred + 3.2s Aftershock Field',
            tooltipSummary: '2.05-Cell Pull + 0.6s Freeze + 50% Shred + 3.2s Molten Aftershock · 1.26x Affinity',
            lineagePath: '💠 Magnet 3★ + 🔥 Fire 3★ (or 8U) ▸ 🌋 Ancient Starforge 4★'
        },
        prism_tri: {
            name: 'Absolute Zero Prism', shortName: '❄️Zero Prism',
            roleSummary: '1 Main + 2 Refract Beams · 5-Stack Thermal Brittle -> Shatter Burst + 0.8s Freeze',
            tooltipSummary: '3-Beam Refraction · 5-Stack Thermal Brittle Shatter + 0.8s Freeze · 1.26x Affinity',
            lineagePath: '☄️ Plasma 2★ + ❄️ Ice 2★ ▸ ❄️ Absolute Zero Prism 3★ (4U)'
        },
        prism_tri_4: {
            name: 'Ancient Zero Prism', shortName: '❄️Zero 4★',
            roleSummary: 'Ascended 3-Beam Refraction · 5-Stack Thermal Brittle -> Shatter Burst + 0.9s Freeze',
            tooltipSummary: 'Ascended 3-Beam · 5-Stack Thermal Brittle Shatter + 0.9s Freeze · 1.26x Affinity',
            lineagePath: '☄️ Plasma 3★ + ❄️ Ice 3★ (or 8U) ▸ ❄️ Ancient Zero Prism 4★'
        },
        primal_core: {
            name: 'Genesis World Tree: Primal Core', shortName: '✦Primal Core',
            roleSummary: 'Board Unique (Max 1) · Up to 6 Linked Allies + 5s Genesis Pulse',
            tooltipSummary: 'Unique 5★ Core · Links up to 6 Neighbors + 5s Genesis Pulse · 1.26x Affinity',
            lineagePath: 'Any Tri-Element 4★ (16U) or 2 Distinct Tri 4★ ▸ ✦ Primal Core 5★'
        }
    };
    // 兼容 fire / ice / thunder / steam / magnet / plasma 舊鍵別名（供怪物弱點標籤與相剋查詢同步顯示英文）
    EN_TOWERS.fire = EN_TOWERS.fire_bud;
    EN_TOWERS.ice = EN_TOWERS.ice_bud;
    EN_TOWERS.thunder = EN_TOWERS.thunder_bud;
    EN_TOWERS.steam = EN_TOWERS.steam_bud;
    EN_TOWERS.magnet = EN_TOWERS.magnet_bud;
    EN_TOWERS.plasma = EN_TOWERS.plasma_bud;

    const WEAKNESS_NAMES = {
        fire: { zh: '火', en: 'Fire' },
        ice: { zh: '冰', en: 'Ice' },
        thunder: { zh: '雷', en: 'Thunder' }
    };

    const EN_MONSTERS = {
        wood: { name: 'Vine Troll', traitDesc: 'Balanced forest vanguard; weak to Fire.' },
        lava: { name: 'Lava Golem', traitDesc: 'Molten armored unit; weak to Ice.' },
        air: { name: 'Sky Airship', traitDesc: 'Fast aerial craft; weak to Thunder.' },
        hound: { name: 'Gale Hound', traitDesc: 'High-speed rusher; counter with Ice slow.' },
        slime: { name: 'Split Slime', traitDesc: 'Splits into 2 Mini Slimes upon death.' },
        golem: { name: 'Heavy Golem', traitDesc: 'High stone armor; counter with Shred/Pierce.' },
        guardian: { name: 'Rune Guardian', traitDesc: '45% MaxHP blue shield; +40% shield break from Thunder/Magnet/Plasma.' },
        healer: { name: 'Bloom Healer', traitDesc: 'Heals 1.5-cell allies 6% MaxHP every 3s; halved by Grievous Wound.' },
        panther: { name: 'Shadow Panther', traitDesc: 'At <50% HP gains 2.2s Stealth (+65% spd); revealed by AoE or Freeze.' },
        bomber: { name: 'Molten Bomber', traitDesc: 'On death stuns 1.4-cell towers for 1.5s unless killed Slowed/Frozen.' },
        thief: { name: 'Vein Thief', traitDesc: 'Fast treasure carrier; escaping deals 0 Tree DMG. Drops +60 💰 + Stock/Box Token on kill.' }
    };

    const EN_BOSSES = {
        5: { name: 'Magma Titan King', traitDesc: 'Hard Shell: 50% damage reduction on first 12 hits.' },
        10: { name: 'Blighted Treant King', traitDesc: 'Regen: Every 8s spawns 2 Vine escorts & heals 5% HP (halved by Wound).' },
        15: { name: 'Sky Citadel', traitDesc: 'Sky Shield: Starts with 50% shield; every 10s EMPs 2 closest towers 1.5s.' },
        20: { name: 'Void Devourer', traitDesc: 'Phase Shift: Every 25% HP lost rotates weakness & cleanses partial debuffs.' }
    };

    const EN_BLESSINGS = {
        abundant_seed: { name: 'Abundant Seed', desc: 'Every 5th basic summon is guaranteed to sprout at ★★ directly.' },
        elemental_resonance: { name: 'Elemental Resonance', desc: 'Foes hit by 2+ distinct elements within 2.5s take +25% bonus damage.' },
        chain_storm: { name: 'Chain Storm', desc: 'Lightning/Magnet bounces that kill a target gain +1 extra chain bounce (+1 cell range).' },
        glacial_shatter: { name: 'Glacial Shatter', desc: 'Ice/Steam/Magnet instantly shatter slowed/frozen targets below 15% HP.' },
        scorched_brand: { name: 'Scorched Brand', desc: 'Fire/Steam shred or crit hits leave a 2.5s burning trail (22 DPS).' },
        dew_overcharge: { name: 'Dew Overcharge', desc: 'Casting a World Tree skill grants all towers 40% double-shot chance for 3s.' },
        greedy_roots: { name: 'Greedy Roots', desc: 'On wave clear, gain +5 💰 per distinct tower bloodline on the board (subject to wave non-combat soft cap).' },
        gambler_lucky_leaf: { name: 'Gambler Lucky Leaf', desc: 'Grants +8% team Crit immediately; Zero-Leak bounty nets +10 💰 extra; Blind Box 1★ miss grants +2% Crit.' },
        insider_trading: { name: 'Insider Trading', desc: '0% Element Stock sell fee; Stock dividend scales to +3.0%/share (single-tower +24% cap still applies).' },
        blood_pact_fury: { name: 'Blood Pact Fury', desc: 'Each 1 World Tree HP lost grants +1.5% team power (inside 30% blessing cap); Nature Frenzy lasts +1.5s longer.' }
    };

    const EN_CONTRACTS = {
        fast_tide: { code: 'Contract I', name: 'Swift Tide', desc: 'All enemies move +15% faster' },
        iron_armor: { code: 'Contract II', name: 'Iron Bastion', desc: 'All enemies gain +4 base Armor' },
        frenzied_hp: { code: 'Contract III', name: 'Frenzied Vitality', desc: 'All enemies gain +20% Max HP' },
        dew_drought: { code: 'Contract IV', name: 'Dew Drought', desc: 'Start with 0 Dew; Dew gain -20%' },
        budget_crunch: { code: 'Contract V', name: 'Tight Budget', desc: 'Starting Gold reduced by -15' },
        fragile_heart: { code: 'Contract VI', name: 'Fragile Heart', desc: 'World Tree Max HP reduced to 12' },
        rapid_waves: { code: 'Contract VII', name: 'Rapid Waves', desc: 'Prep & intermission timers halved (early bonus intact)' },
        boss_tyranny: { code: 'Contract VIII', name: 'Boss Tyranny', desc: 'All Bosses gain +30% extra Max HP' }
    };

    const EN_MAPS = {
        forest: { name: 'Sunlit Woods', desc: '41-cell winding path · Balanced classic defense' },
        lava: { name: 'Magma Canyon', desc: '31-cell short canyon · Start +10 💰 · Kill Gold +15%' },
        frost: { name: 'Permafrost Rift', desc: '36-cell dual-lane · Start +15 💰 · Ice DMG +20%' },
        thunder_isles: { name: 'Thunder Float Isles', desc: 'One-way Rift A → B · 3 Floatstones (+40% DMG cycle) · 12 Waves' },
        blackmarket: { name: 'Barren Black Market', desc: '1 Free Blind Box/wave · 8 Treasure Rocks · 15 Waves' }
    };

    const EN_ELITE_AFFIXES = {
        bounty: {
            name: 'Bounty',
            shortBadge: '💰Bounty',
            desc: 'Grants extra bounty gold on kill (governed by wave soft cap).'
        },
        frenzied: {
            name: 'Frenzied',
            shortBadge: '⚡Frenzied',
            desc: '+22% base speed, plus +15% extra speed below 50% HP.'
        },
        shield_regen: {
            name: 'Shield Regen',
            shortBadge: '🛡️Regen',
            desc: 'Spawns with energy shield; restores 4% max shield every 2.5s (halved by Wound).'
        },
        resonance_link: {
            name: 'Resonance Link',
            shortBadge: '🔗Link',
            desc: 'Links up to 2 non-Boss allies within 1.8 cells to split 30% single-target DMG; AoE/Chain deals +15% bonus DMG, and Freeze/Stun/Root severs the link.'
        },
        bulwark_aura: {
            name: 'Vanguard Aegis',
            shortBadge: '🛡️Aegis',
            desc: 'W10+ Affix: Grants nearby non-Boss allies within 1.6 cells -18% DMG taken (non-stacking); disabled immediately by Shred or Vulnerability.'
        },
        prismatic_ward: {
            name: 'Prismatic Ward',
            shortBadge: '🌈Prism',
            desc: 'W10+ Affix: -25% DMG taken from non-weakness single-element hits; takes +20% bonus DMG from Weakness, Hybrid Affinity, or Tri-Element towers.'
        }
    };

    const EN_WAVE_STAGE_TRAITS = {
        wood: {
            name: 'Bark Regen',
            activeLabel: '🌿Regen Active',
            counteredLabel: '🔥Regen Halted',
            desc: 'W5+: Restores 3.5% MaxHP every 2.5s; paused by Fire hits, Burn, or Grievous Wound.'
        },
        healer: {
            name: 'Bloom Surge',
            activeLabel: '💚Surge Active',
            counteredLabel: '🔥Heal Halted',
            desc: 'W8+: Boosts heal pulse to 8.5% MaxHP (+0.25 range); paused by Fire hits, Burn, or Wound.'
        },
        hound: {
            name: 'Pack Tailwind',
            activeLabel: '💨Haste Aura',
            counteredLabel: '❄️Aura Disrupted',
            desc: 'W5+: Grants +16% speed aura to allies within 1.6 cells (non-stacking); disrupted by Slow/Freeze/Root.'
        },
        air: {
            name: 'Jetstream Aura',
            activeLabel: '🌪️Jetstream',
            counteredLabel: '❄️Stream Halted',
            desc: 'W6+: Projects a 1.5-cell +14% speed aura (non-stacking); disrupted by Slow/Freeze/Root.'
        },
        lava: {
            name: 'Magma Crust',
            activeLabel: '🪨Crust +6 ARM',
            counteredLabel: '❄️Crust Cracked',
            desc: 'W5+: Gains +6 magma armor (K=35); shatters immediately while Slowed or Frozen.'
        },
        golem: {
            name: 'Reactive Plating',
            activeLabel: '🛡️Plating -20%',
            counteredLabel: '💔Plating Broken',
            desc: 'W5+: -20% damage taken while un-shredded/un-pierced; fully bypassed by Armor Shred, Pierce, or Shock.'
        },
        guardian: {
            name: 'Rune Capacitor',
            activeLabel: '⚡Capacitor Active',
            counteredLabel: '⚡Shield Broken',
            desc: 'W7+: While shielded, non-Thunder/Tri hits deal -22% DMG; Thunder-lineage/Tri breaks shield at 1.65x and inflicts 20% Shred.'
        }
    };

    const EN_TERRAINS = {
        grass: { name: 'Grassland', shortTag: '', tooltip: '🌱 Grassland: Buildable tile for towers' },
        path: { name: 'Enemy Path', shortTag: '🛤️ Enemy March Route', tooltip: '🛤️ Enemy Path: Cannot build towers here' },
        highground: { name: '⛰️ Highground', shortTag: 'Range +30%', tooltip: 'Highground: Tower Attack Range +30%' },
        mana_vein: { name: '✨ Mana Vein', shortTag: 'Spd +25%', tooltip: 'Mana Vein: Tower Attack Speed +25%' },
        world_tree: { name: '🌿 Tree Sanctuary', shortTag: 'DMG +20% max', tooltip: 'Sanctuary: Up to +20% DMG based on Tree HP' },
        obstacle: { name: '🪨 Ancient Boulder', shortTag: '45 💰 Clear', tooltip: 'Ancient Boulder: Click to clear for 45 💰 and unearth terrain' },
        charged_stone: { name: '⚡ Charging Floatstone', shortTag: '+40% DMG Cycle', tooltip: 'Rotates 1 glowing stone every 2 waves: tower on glowing stone gains +40% DMG (Base Power Bonus).' },
        treasure_rock: { name: '🪨 Treasure Boulder', shortTag: '45 💰 Mine', tooltip: 'Click to mine for 45 💰: yields Gold (soft-capped), Universal Fruit, or a random 2★ tower.' },
        teleport_rift: { name: '🌀 One-Way Teleport Rift (A → B)', shortTag: 'Thunder Isles Rift', tooltip: 'Enemies stepping onto Entry A warp straight to Exit B along the second island.' },
        elite_affixes: { name: '🔱 W6+ / W10+ Elite Affixes', shortTag: 'Bounty · Frenzied · Regen · Link · Aegis · Prism', tooltip: 'W6+ Elites roll Bounty, Frenzied, Shield Regen, or Resonance Link (AoE counter); W10+/Endless adds Vanguard Aegis (Shred/Vuln shuts down) and Prismatic Ward (Weakness/Hybrid/Tri bonus DMG).' },
        leyline_links: {
            name: '🔗 Adjacent Leyline Links',
            shortTag: 'Max 2 Links · +18% Cap',
            tooltip: 'Adjacent (4-dir) cross-element links: 🔥+❄️ Convection (10% Shred+Slow), ❄️+⚡ Superconduct (+10% Spd), 🔥+⚡ Overload (+10% Crit), 🔺 Tri-Formation: +15% DMG (Base Power Bonus) + 1💧/1.5s (cap 12/wave). Max 2 links & +18% DMG per tower.'
        },
        weather_sun: {
            name: '☀️ Sunlit Blaze',
            shortTag: 'Fire+ · 🔥Stock+10%',
            tooltip: 'Rotates every 3 waves: Fire Range +0.4, Burn +25%, Ice Slow -15%; 🔥 Fire Stock gains +10% bullish bias.'
        },
        weather_snow: {
            name: '❄️ Frost Drift',
            shortTag: 'Slow+ · ❄️Stock+10%',
            tooltip: 'Rotates every 3 waves: Monster Spd -10%, Ice Crit +15%, plain Grass summon +5 💰; ❄️ Ice Stock gains +10% bullish bias.'
        },
        weather_storm: {
            name: '⛈️ Tempest Surge',
            shortTag: '6s Bolt · ⚡Vol×2',
            tooltip: 'Rotates every 3 waves: Sky lightning strikes highest-HP foe every 6s; ⚡ Thunder Stock volatility ×2.'
        },
        weather_eclipse: {
            name: '🌑 Eclipse Tide',
            shortTag: 'W10/15/20 Boss Weather',
            tooltip: 'W10/15/20 Threat: Foes gain 15% DMG reduction, while Kill Gold +30% (soft-capped), Dew +30%, and Blind Box 3★ odds ×2.'
        }
    };

    const EN_CODEX_CATS = {
        fusion: 'World Tree Codex',
        monsters: 'Enemy Bestiary',
        terrain: 'Tactical Terrain'
    };

    const snapshots = {
        towers: null,
        monsters: null,
        bosses: null,
        eliteAffixes: null,
        waveStageTraits: null,
        blessings: null,
        skills: null,
        contracts: null,
        maps: null,
        terrains: null,
        codexCats: null,
        codexTowers: null,
        codexMonsters: null,
        codexTerrains: null,
        targetLabels: null
    };

    function captureZhSnapshots() {
        const d = GameApp.data || {};
        if (!snapshots.towers && d.towers && d.towers.TOWERS) {
            snapshots.towers = {};
            Object.keys(d.towers.TOWERS).forEach((k) => {
                const t = d.towers.TOWERS[k];
                if (!t) return;
                snapshots.towers[k] = {
                    name: t.name, shortName: t.shortName, shopRoleTag: t.shopRoleTag,
                    roleSummary: t.roleSummary, tooltipSummary: t.tooltipSummary, lineagePath: t.lineagePath
                };
            });
            snapshots.targetLabels = Object.assign({}, d.towers.TARGET_MODE_LABELS || {});
        }
        if (!snapshots.monsters && d.monsters && d.monsters.MONSTER_DATABASE) {
            snapshots.monsters = {};
            Object.keys(d.monsters.MONSTER_DATABASE).forEach((k) => {
                const m = d.monsters.MONSTER_DATABASE[k];
                if (m) snapshots.monsters[k] = { name: m.name, traitDesc: m.traitDesc };
            });
            snapshots.bosses = {};
            (d.monsters.BOSS_ROSTER || []).forEach((b) => {
                snapshots.bosses[b.wave] = { name: b.name, traitDesc: b.traitDesc };
            });
            snapshots.eliteAffixes = {};
            Object.keys(d.monsters.ELITE_AFFIXES || {}).forEach((k) => {
                const af = d.monsters.ELITE_AFFIXES[k];
                if (af) snapshots.eliteAffixes[k] = { name: af.name, desc: af.desc, shortBadge: af.shortBadge };
            });
            snapshots.waveStageTraits = {};
            Object.keys(d.monsters.WAVE_STAGE_TRAITS || {}).forEach((k) => {
                const st = d.monsters.WAVE_STAGE_TRAITS[k];
                if (st) snapshots.waveStageTraits[k] = { name: st.name, desc: st.desc, activeLabel: st.activeLabel, counteredLabel: st.counteredLabel };
            });
        }
        if (!snapshots.blessings && d.tree && d.tree.BLESSINGS_MAP) {
            snapshots.blessings = {};
            Object.keys(d.tree.BLESSINGS_MAP).forEach((k) => {
                const b = d.tree.BLESSINGS_MAP[k];
                if (b) snapshots.blessings[k] = { name: b.name, desc: b.desc };
            });
            snapshots.skills = {};
            Object.keys(d.tree.ACTIVE_SKILLS || {}).forEach((k) => {
                const s = d.tree.ACTIVE_SKILLS[k];
                if (s) snapshots.skills[k] = { name: s.name };
            });
        }
        if (!snapshots.contracts && Array.isArray(GameApp.config && GameApp.config.DIFFICULTY_CONTRACTS)) {
            snapshots.contracts = {};
            GameApp.config.DIFFICULTY_CONTRACTS.forEach((c) => {
                snapshots.contracts[c.id] = { code: c.code, name: c.name, desc: c.desc };
            });
        }
        if (!snapshots.maps && d.routes && d.routes.MAPS_CONFIG) {
            snapshots.maps = {};
            Object.keys(d.routes.MAPS_CONFIG).forEach((k) => {
                const m = d.routes.MAPS_CONFIG[k];
                if (m) snapshots.maps[k] = { name: m.name, desc: m.desc };
            });
        }
        if (!snapshots.terrains && d.terrain && d.terrain.TERRAIN_TYPES) {
            snapshots.terrains = {};
            Object.keys(d.terrain.TERRAIN_TYPES).forEach((k) => {
                const tr = d.terrain.TERRAIN_TYPES[k];
                if (tr) snapshots.terrains[k] = { name: tr.name, shortTag: tr.shortTag, tooltip: tr.tooltip };
            });
        }
        if (!snapshots.codexCats && d.codex) {
            snapshots.codexCats = {};
            (d.codex.CODEX_CATEGORIES || []).forEach((c) => { snapshots.codexCats[c.id] = c.label; });
            snapshots.codexMonsters = {};
            const cm = (d.codex.CODEX_ENTRIES && d.codex.CODEX_ENTRIES.monsters) || {};
            Object.keys(cm).forEach((k) => {
                snapshots.codexMonsters[k] = { title: cm[k].title, subtitle: cm[k].subtitle, desc: cm[k].desc, unlockRule: cm[k].unlockRule };
            });
            snapshots.codexTerrains = {};
            const ct = (d.codex.CODEX_ENTRIES && d.codex.CODEX_ENTRIES.terrain) || {};
            Object.keys(ct).forEach((k) => {
                snapshots.codexTerrains[k] = { title: ct[k].title, subtitle: ct[k].subtitle, desc: ct[k].desc };
            });
            snapshots.codexTowers = {};
            const ctw = (d.codex.CODEX_ENTRIES && d.codex.CODEX_ENTRIES.towers) || {};
            Object.keys(ctw).forEach((k) => {
                snapshots.codexTowers[k] = {
                    title: ctw[k].title, formula: ctw[k].formula, mech: ctw[k].mech,
                    synergy: ctw[k].synergy, unlockRule: ctw[k].unlockRule
                };
            });
        }
    }

    function translateDataCatalogs(lang) {
        captureZhSnapshots();
        const isEn = lang === 'en';
        const d = GameApp.data || {};

        if (d.towers && d.towers.TOWERS && snapshots.towers) {
            Object.keys(snapshots.towers).forEach((k) => {
                const tgt = d.towers.TOWERS[k];
                const src = (isEn ? EN_TOWERS[k] : null) || snapshots.towers[k];
                const zh = snapshots.towers[k];
                if (!tgt || !zh) return;
                tgt.name = src.name || zh.name;
                if (src.shortName || zh.shortName) tgt.shortName = src.shortName || zh.shortName;
                if (src.shopRoleTag || zh.shopRoleTag) tgt.shopRoleTag = src.shopRoleTag || zh.shopRoleTag;
                if (src.roleSummary || zh.roleSummary) tgt.roleSummary = src.roleSummary || zh.roleSummary;
                if (src.tooltipSummary || zh.tooltipSummary) tgt.tooltipSummary = src.tooltipSummary || zh.tooltipSummary;
                if (src.lineagePath || zh.lineagePath) tgt.lineagePath = src.lineagePath || zh.lineagePath;
            });
            if (typeof d.towers.syncLegacyAliases === 'function') d.towers.syncLegacyAliases();
            if (d.towers.TARGET_MODE_LABELS) {
                Object.assign(d.towers.TARGET_MODE_LABELS, isEn
                    ? { first: 'First', armor: 'Armor', lowhp: 'LowHP' }
                    : snapshots.targetLabels);
            }
        }

        if (d.monsters && d.monsters.MONSTER_DATABASE && snapshots.monsters) {
            Object.keys(snapshots.monsters).forEach((k) => {
                const m = d.monsters.MONSTER_DATABASE[k];
                const src = (isEn ? EN_MONSTERS[k] : null) || snapshots.monsters[k];
                if (m && src) {
                    m.name = src.name;
                    if (src.traitDesc) m.traitDesc = src.traitDesc;
                }
            });
            (d.monsters.BOSS_ROSTER || []).forEach((b) => {
                const src = (isEn ? EN_BOSSES[b.wave] : null) || (snapshots.bosses && snapshots.bosses[b.wave]);
                if (src) {
                    b.name = src.name;
                    b.traitDesc = src.traitDesc;
                }
            });
            Object.keys(snapshots.eliteAffixes || {}).forEach((k) => {
                const af = d.monsters.ELITE_AFFIXES && d.monsters.ELITE_AFFIXES[k];
                const src = (isEn ? EN_ELITE_AFFIXES[k] : null) || snapshots.eliteAffixes[k];
                if (af && src) {
                    af.name = src.name;
                    af.desc = src.desc;
                    af.shortBadge = src.shortBadge;
                }
            });
            Object.keys(snapshots.waveStageTraits || {}).forEach((k) => {
                const st = d.monsters.WAVE_STAGE_TRAITS && d.monsters.WAVE_STAGE_TRAITS[k];
                const src = (isEn ? EN_WAVE_STAGE_TRAITS[k] : null) || snapshots.waveStageTraits[k];
                if (st && src) {
                    st.name = src.name;
                    st.desc = src.desc;
                    st.activeLabel = src.activeLabel;
                    st.counteredLabel = src.counteredLabel;
                }
            });
        }

        if (d.tree && d.tree.BLESSINGS_MAP && snapshots.blessings) {
            Object.keys(snapshots.blessings).forEach((k) => {
                const b = d.tree.BLESSINGS_MAP[k];
                const src = (isEn ? EN_BLESSINGS[k] : null) || snapshots.blessings[k];
                if (b && src) { b.name = src.name; b.desc = src.desc; }
            });
            if (d.tree.ACTIVE_SKILLS && snapshots.skills) {
                if (d.tree.ACTIVE_SKILLS.entangle) d.tree.ACTIVE_SKILLS.entangle.name = isEn ? 'Root Entangle' : snapshots.skills.entangle.name;
                if (d.tree.ACTIVE_SKILLS.frenzy) d.tree.ACTIVE_SKILLS.frenzy.name = isEn ? 'Nature Frenzy' : snapshots.skills.frenzy.name;
                if (d.tree.ACTIVE_SKILLS.golden_harvest) d.tree.ACTIVE_SKILLS.golden_harvest.name = isEn ? 'Golden Harvest' : snapshots.skills.golden_harvest.name;
            }
        }

        if (snapshots.contracts && Array.isArray(GameApp.config && GameApp.config.DIFFICULTY_CONTRACTS)) {
            GameApp.config.DIFFICULTY_CONTRACTS.forEach((c) => {
                const src = (isEn ? EN_CONTRACTS[c.id] : null) || snapshots.contracts[c.id];
                if (src) { c.code = src.code; c.name = src.name; c.desc = src.desc; }
            });
        }

        if (d.routes && d.routes.MAPS_CONFIG && snapshots.maps) {
            Object.keys(snapshots.maps).forEach((k) => {
                const m = d.routes.MAPS_CONFIG[k];
                const src = (isEn ? EN_MAPS[k] : null) || snapshots.maps[k];
                if (m && src) { m.name = src.name; m.desc = src.desc; }
            });
        }

        if (d.terrain && d.terrain.TERRAIN_TYPES && snapshots.terrains) {
            Object.keys(snapshots.terrains).forEach((k) => {
                const tr = d.terrain.TERRAIN_TYPES[k];
                const src = (isEn ? EN_TERRAINS[k] : null) || snapshots.terrains[k];
                if (tr && src) { tr.name = src.name; tr.shortTag = src.shortTag; tr.tooltip = src.tooltip; }
            });
        }

        if (d.codex && snapshots.codexCats) {
            (d.codex.CODEX_CATEGORIES || []).forEach((c) => {
                c.label = isEn ? (EN_CODEX_CATS[c.id] || snapshots.codexCats[c.id]) : snapshots.codexCats[c.id];
            });
            const cm = (d.codex.CODEX_ENTRIES && d.codex.CODEX_ENTRIES.monsters) || {};
            Object.keys(snapshots.codexMonsters || {}).forEach((k) => {
                const zh = snapshots.codexMonsters[k];
                const en = EN_MONSTERS[k];
                if (!cm[k] || !zh) return;
                if (isEn && en) {
                    const mDbEntry = d.monsters && d.monsters.MONSTER_DATABASE && d.monsters.MONSTER_DATABASE[k];
                    const iconPrefix = mDbEntry && mDbEntry.icon ? `${mDbEntry.icon} ` : '';
                    const minW = mDbEntry && mDbEntry.minWave ? Number(mDbEntry.minWave) : 0;
                    const weakName = mDbEntry && mDbEntry.weakness ? getWeaknessLabel(mDbEntry.weakness) : '';
                    const wTower = mDbEntry && mDbEntry.weakness && d.towers && d.towers.TOWERS && d.towers.TOWERS[mDbEntry.weakness];
                    const weakIcon = wTower && wTower.icon ? `${wTower.icon} ` : '';
                    cm[k].title = (iconPrefix && !en.name.startsWith(iconPrefix)) ? `${iconPrefix}${en.name}` : en.name;
                    cm[k].subtitle = weakName ? `Weak: ${weakIcon}${weakName}` : 'Invasion Unit';
                    cm[k].desc = en.traitDesc;
                    cm[k].unlockRule = minW > 1
                        ? `Unlocks in-run upon encountering this enemy (Wave ${minW}+).`
                        : 'Unlocks in-run upon encountering this enemy.';
                } else {
                    Object.assign(cm[k], zh);
                }
            });
            const ct = (d.codex.CODEX_ENTRIES && d.codex.CODEX_ENTRIES.terrain) || {};
            Object.keys(snapshots.codexTerrains || {}).forEach((k) => {
                const zh = snapshots.codexTerrains[k];
                const en = EN_TERRAINS[k];
                if (!ct[k] || !zh) return;
                if (isEn && en) {
                    ct[k].title = en.name;
                    ct[k].subtitle = en.shortTag;
                    ct[k].desc = en.tooltip;
                } else {
                    Object.assign(ct[k], zh);
                }
            });
            const ctw = (d.codex.CODEX_ENTRIES && d.codex.CODEX_ENTRIES.towers) || {};
            Object.keys(snapshots.codexTowers || {}).forEach((k) => {
                const zh = snapshots.codexTowers[k];
                const en = EN_TOWERS[k];
                if (!ctw[k] || !zh) return;
                if (isEn && en) {
                    ctw[k].title = en.name;
                    ctw[k].formula = en.lineagePath;
                    ctw[k].mech = en.tooltipSummary;
                    ctw[k].synergy = en.roleSummary;
                    ctw[k].unlockRule = `Synthesize ${en.name} on the board to unlock for this run`;
                } else {
                    Object.assign(ctw[k], zh);
                }
            });
        }
    }

    function setElText(id, text) {
        if (typeof document === 'undefined') return;
        const el = document.getElementById(id);
        if (el) el.innerText = text;
    }

    function applyStaticDom(lang) {
        if (typeof document === 'undefined') return;
        const isEn = lang === 'en';
        document.documentElement.lang = isEn ? 'en' : 'zh-TW';
        document.title = isEn ? 'Elemental Frontline: Merge TD' : '元素陣線：合成塔防';

        const langBtn = document.getElementById('lang-btn');
        if (langBtn) {
            langBtn.title = isEn ? 'Switch Language / 切換語言' : '切換語言 / Switch Language';
            langBtn.setAttribute('aria-label', isEn ? 'Switch Language' : '切換語言');
            const lbl = document.getElementById('lang-btn-label') || langBtn.querySelector('span');
            if (lbl) lbl.innerText = isEn ? 'Lang ▾' : '語言 ▾';
        }
        const startLangBtn = document.getElementById('start-lang-btn');
        if (startLangBtn) {
            startLangBtn.title = isEn ? 'Switch Language / 切換語言' : '切換語言 / Switch Language';
            startLangBtn.setAttribute('aria-label', isEn ? 'Switch Language' : '切換語言');
            const lbl = document.getElementById('start-lang-btn-label') || startLangBtn.querySelector('span');
            if (lbl) lbl.innerText = isEn ? 'Language ▾' : '語言 ▾';
        }
        document.querySelectorAll('.lang-option').forEach((opt) => {
            const active = opt.dataset.lang === (isEn ? 'en' : 'zh-TW');
            opt.classList.toggle('is-active', active);
            opt.setAttribute('aria-checked', active ? 'true' : 'false');
        });

        const sideLeftEl = document.getElementById('side-panel-left');
        if (sideLeftEl) sideLeftEl.setAttribute('aria-label', isEn ? 'Elemental Counters & Terrain Quick Reference' : '元素相剋與地形加成速查');
        const sideRightEl = document.getElementById('side-panel-right');
        if (sideRightEl) sideRightEl.setAttribute('aria-label', isEn ? 'Current and Next Wave Details' : '本波與下波出怪詳情');
        const guildPanelEl = document.getElementById('world-tree-guild-panel');
        if (guildPanelEl) guildPanelEl.setAttribute('aria-label', isEn ? 'World Tree Guild Drawer' : '世界樹商會波間抽屜');
        const guildTabsBarEl = document.querySelector('.guild-tabs-bar');
        if (guildTabsBarEl) guildTabsBarEl.setAttribute('aria-label', isEn ? 'World Tree Guild Tabs' : '世界樹商會分頁');
        const rootPanelEl = document.getElementById('world-tree-root-panel');
        if (rootPanelEl) rootPanelEl.setAttribute('aria-label', isEn ? 'Treasure Roots Management System' : '世界樹聚寶根鬚經營系統');
        const guildCloseBtn = document.getElementById('guild-drawer-close-btn');
        if (guildCloseBtn) {
            guildCloseBtn.title = isEn ? 'Collapse Guild Drawer [B / Esc]' : '收合商會抽屜 [B / Esc]';
            guildCloseBtn.setAttribute('aria-label', isEn ? 'Collapse Guild Drawer' : '收合商會抽屜');
        }
        const metaResetBtn = document.getElementById('meta-tree-reset-btn');
        if (metaResetBtn) metaResetBtn.setAttribute('aria-label', isEn ? 'Reset Meta Rings' : '重置年輪');
        const metaCloseBtn = document.getElementById('meta-tree-close-btn');
        if (metaCloseBtn) metaCloseBtn.setAttribute('aria-label', isEn ? 'Close World Tree Meta Rings' : '關閉世界樹年輪');
        const metaGridEl = document.getElementById('meta-tree-branches-grid');
        if (metaGridEl) metaGridEl.setAttribute('aria-label', isEn ? 'World Tree Meta Ring Branches' : '世界樹年輪天賦分支');
        const codexCloseBtn = document.getElementById('codex-close-btn');
        if (codexCloseBtn) codexCloseBtn.setAttribute('aria-label', isEn ? 'Close Codex' : '關閉圖鑑');
        const lobbyStepHubEl = document.getElementById('lobby-step-hub');
        if (lobbyStepHubEl) lobbyStepHubEl.setAttribute('aria-label', isEn ? 'Game Mode Lobby' : '遊戲模式選擇大廳');
        const lobbyStepSetupEl = document.getElementById('lobby-step-setup');
        if (lobbyStepSetupEl) lobbyStepSetupEl.setAttribute('aria-label', isEn ? 'Battlefield Setup' : '出戰戰場與條件配置');
        const lobbyBottomBarEl = document.querySelector('.lobby-bottom-bar');
        if (lobbyBottomBarEl) lobbyBottomBarEl.setAttribute('aria-label', isEn ? 'Codex & Field Guide' : '遊戲百科與戰術手冊');
        const onboardingToastEl = document.getElementById('onboarding-toast');
        if (onboardingToastEl) onboardingToastEl.setAttribute('aria-label', isEn ? 'Commander Onboarding Hint' : '新手引導提示');
        const onboardingCloseBtn = document.getElementById('onboarding-close-btn');
        if (onboardingCloseBtn) {
            onboardingCloseBtn.title = isEn ? 'Dismiss Onboarding Hints' : '略過新手提示';
            onboardingCloseBtn.setAttribute('aria-label', isEn ? 'Dismiss Onboarding Hints' : '略過新手提示');
        }
        const victoryStarsEl = document.getElementById('victory-stars');
        if (victoryStarsEl) victoryStarsEl.setAttribute('aria-label', isEn ? 'Clear Stars' : '通關星級');
        const guideXBtn = document.getElementById('guide-x-btn');
        if (guideXBtn) guideXBtn.setAttribute('aria-label', isEn ? 'Close Tactical Field Guide' : '關閉戰術手冊');
        setElText('guild-stock-title', isEn ? 'Element Stocks' : '元素股市');
        document.querySelectorAll('#guild-stock-list .stock-row').forEach((row) => {
            const elKey = row.dataset ? row.dataset.stockElement : '';
            const nameEl = row.querySelector('.stock-name');
            if (nameEl) {
                if (elKey === 'fire') nameEl.innerText = isEn ? '🔥 Fire Stock' : '🔥 火股';
                else if (elKey === 'ice') nameEl.innerText = isEn ? '❄️ Ice Stock' : '❄️ 冰股';
                else if (elKey === 'thunder') nameEl.innerText = isEn ? '⚡ Thunder Stock' : '⚡ 雷股';
            }
            const buyBtn = row.querySelector('.stock-buy-btn');
            if (buyBtn) buyBtn.innerText = isEn ? 'Buy' : '買入';
            const sellBtn = row.querySelector('.stock-sell-btn');
            if (sellBtn) sellBtn.innerText = isEn ? 'Sell' : '賣出';
        });

        // 頂部左側 HUD 標籤節點
        const hpItem = document.querySelector('.hud-hp');
        if (hpItem) hpItem.title = isEn ? 'World Tree HP' : '世界樹生命';
        const goldItem = document.querySelector('.hud-gold');
        if (goldItem) goldItem.title = isEn ? 'Current Gold' : '當前金幣';
        const dewLabelNode = document.querySelector('.hud-dew');
            setElText('hud-dew-label', isEn ? 'Dew' : '靈露');
            if (dewLabelNode) dewLabelNode.title = isEn ? 'Slay enemies to gather Dew for World Tree active skills' : '擊殺敵人累積靈露，用於施放世界樹主動技能';
            const helpBtnEl = document.getElementById('help-btn');
            if (helpBtnEl) {
                helpBtnEl.title = isEn ? 'Tactical Field Guide & Counters' : '開啟戰術手冊與屬性地形速查';
                helpBtnEl.setAttribute('aria-label', isEn ? 'Open Tactical Field Guide' : '開啟戰術手冊');
            }
            setElText('hud-best-label', isEn ? 'Best' : '最高');
            const bestItem = document.querySelector('.hud-best');
            if (bestItem) bestItem.title = isEn ? 'Map Best Record' : '本圖最高紀錄';
            const speedBtnEl = document.getElementById('speed-btn');
            if (speedBtnEl) speedBtnEl.title = isEn ? 'Toggle Game Speed [Tab/S]' : '切換遊戲倍速 [Tab/S]';
            const pauseBtnEl = document.getElementById('pause-btn');
            if (pauseBtnEl) pauseBtnEl.title = isEn ? 'Tactical Pause / Resume [Space]' : '戰術暫停 / 恢復 [Space]';
            const sysMenuBtnEl = document.getElementById('system-menu-btn');
            if (sysMenuBtnEl) {
                sysMenuBtnEl.innerText = isEn ? '☰ Menu' : '☰ 選單';
                sysMenuBtnEl.title = isEn ? 'Open System Menu [Esc]' : '開啟系統選單 [Esc]';
            }
            const sysMenuXEl = document.getElementById('system-menu-x-btn');
            if (sysMenuXEl) sysMenuXEl.setAttribute('aria-label', isEn ? 'Close System Menu' : '關閉系統選單');
            setElText('system-menu-title', isEn ? 'System Menu' : '系統選單');
            setElText('system-menu-subtitle', isEn
                ? 'Battle paused & background locked. Choose a system action.'
                : '戰局已暫停並鎖定背景操作，請選擇系統功能。');
            setElText('sysmenu-resume-btn', isEn ? 'Resume Game' : '繼續遊戲');
            setElText('sysmenu-restart-btn', isEn ? 'Restart Match' : '重新開始本局');
            setElText('sysmenu-mainmenu-btn', isEn ? 'Change Map / Main Menu' : '切換地圖 / 回主大廳');
            setElText('guide-replay-tutorial-btn', isEn ? 'Replay Tutorial' : '重新開啟新手引導');
            const soundBtnEl = document.getElementById('sound-btn');
            if (soundBtnEl) soundBtnEl.title = isEn ? 'Toggle Audio' : '切換音效';

            // 預告條右側簡易圖例
            const legendEl = document.getElementById('info-legend');
            if (legendEl) {
                const texts = legendEl.querySelectorAll('.legend-text');
                if (texts[0]) texts[0].innerText = isEn ? 'Fire ▸ Vine' : '火 ▸ 蔓藤';
                if (texts[1]) texts[1].innerText = isEn ? 'Ice ▸ Lava' : '冰 ▸ 熔岩';
                if (texts[2]) texts[2].innerText = isEn ? 'Thunder ▸ Air' : '雷 ▸ 機械';
            }

            setElText('side-tracker-title', isEn ? '📌 Recipe Tracker' : '📌 配方追蹤');
            setElText('side-tracker-open-btn', isEn ? 'Tree' : '圖譜');
            const trackerClearLbl = isEn ? 'Clear tracked recipe' : '取消配方追蹤';
            const sideClearBtn = document.getElementById('side-tracker-clear-btn');
            if (sideClearBtn) {
                sideClearBtn.title = trackerClearLbl;
                sideClearBtn.setAttribute('aria-label', trackerClearLbl);
            }
            const pillClearBtn = document.getElementById('recipe-tracker-pill-clear');
            if (pillClearBtn) {
                pillClearBtn.title = trackerClearLbl;
                pillClearBtn.setAttribute('aria-label', trackerClearLbl);
            }

            // 左右側欄靜態標題
            const leftTitles = document.querySelectorAll('#side-panel-left .side-panel-title');
            if (leftTitles[0]) leftTitles[0].innerText = isEn ? 'Elemental Counters' : '元素相剋速查';
            if (leftTitles[1]) leftTitles[1].innerText = isEn ? 'Terrain Bonuses' : '戰術地形加成';
            if (leftTitles[2]) leftTitles[2].innerText = isEn ? 'Evolution Tiers' : '轉職與升星';

            const leftList = document.querySelectorAll('#side-panel-left .side-panel-list');
            if (leftList[0]) {
                const rows = leftList[0].querySelectorAll('.side-panel-row');
                const zh0 = [['火 ▸ 蔓藤 / 史萊姆', '175%'], ['冰 ▸ 熔岩 / 獵犬', '175%'], ['雷 ▸ 飛艇 / 魔像', '175%'], ['✨ 轉職 ▸ 親和弱點', '135%']];
                const en0 = [['Fire ▸ Vine / Slime', '175%'], ['Ice ▸ Lava / Hound', '175%'], ['Thunder ▸ Air / Golem', '175%'], ['✨ Hybrid ▸ Affinity', '135%']];
                (isEn ? en0 : zh0).forEach((pair, idx) => {
                    if (!rows[idx] || !rows[idx].children[0] || !rows[idx].children[1]) return;
                    const textEl = rows[idx].querySelector('.el-counter-text');
                    if (textEl) textEl.innerText = pair[0];
                    else rows[idx].children[0].innerText = pair[0];
                    rows[idx].children[1].innerText = pair[1];
                });
            }
            if (leftList[1]) {
                const rows = leftList[1].querySelectorAll('.side-panel-row');
                const zh1 = [['制高點', '射程 +30%'], ['元素靈脈', '攻速 +25%'], ['世界樹庇護', '傷 +20%']];
                const en1 = [['Highground', 'Rng +30%'], ['Mana Vein', 'Spd +25%'], ['Sanctuary', 'DMG +20%']];
                (isEn ? en1 : zh1).forEach((pair, idx) => {
                    if (!rows[idx] || !rows[idx].children[1] || !rows[idx].children[2]) return;
                    rows[idx].children[1].innerText = pair[0];
                    rows[idx].children[2].innerText = pair[1];
                });
            }
            if (leftList[2]) {
                const rows = leftList[2].querySelectorAll('.side-panel-row');
                const zh2 = [
                    ['異系 1★ + 1★', '轉職 1★'],
                    ['同種 / 灌注 1★', '升星 2★'],
                    ['同種 2★ + 2★', '冠枝 3★'],
                    ['同脈 3★ / 餵養', '古冠·雙生 4★'],
                    ['同脈 4★ / 16U', '神裔 5★']
                ];
                const en2 = [
                    ['Cross 1★+1★', 'Hybrid 1★'],
                    ['Same / Infuse 1★', 'Trunk 2★'],
                    ['Same 2★+2★', 'Crown 3★'],
                    ['3★ Pair / Feed', '4★ Crown/Twin'],
                    ['4★ Pair / 16U', '5★ Scion']
                ];
                (isEn ? en2 : zh2).forEach((pair, idx) => {
                    if (!rows[idx] || !rows[idx].children[0] || !rows[idx].children[1]) return;
                    rows[idx].children[0].innerText = pair[0];
                    rows[idx].children[1].innerText = pair[1];
                });
            }
            setElText('side-tri-title', isEn ? 'Tri-Element 3★ Fusions' : '三元 3★ 創世融合');
            const sideTriList = document.getElementById('side-tri-list');
            if (sideTriList) {
                const rows = sideTriList.querySelectorAll('.side-panel-row');
                const zhTri = [['蒸氣 2★ + ⚡雷 2★', '風暴 3★'], ['🔥火 2★ + 磁環 2★', '熔爐 3★'], ['❄️冰 2★ + 電漿 2★', '稜鏡 3★']];
                const enTri = [['Steam 2★ + ⚡Bolt 2★', 'Storm 3★'], ['🔥Fire 2★ + Magnet 2★', 'Starforge 3★'], ['❄️Ice 2★ + Plasma 2★', 'Prism 3★']];
                (isEn ? enTri : zhTri).forEach((pair, idx) => {
                    if (!rows[idx] || !rows[idx].children[0] || !rows[idx].children[1]) return;
                    rows[idx].children[0].innerText = pair[0];
                    rows[idx].children[1].innerText = pair[1];
                });
            }

            const qRefBtn = document.getElementById('quick-ref-btn');
            if (qRefBtn) {
                qRefBtn.innerText = isEn ? 'Ref' : '速查';
                qRefBtn.title = isEn ? 'Quick Reference: Counters, Terrain & Tri-Element Recipes' : '元素相剋、地形加成與三元素配方速查';
                qRefBtn.setAttribute('aria-label', qRefBtn.title);
            }
            const qRefPop = document.getElementById('quick-ref-popover');
            if (qRefPop) qRefPop.setAttribute('aria-label', isEn ? 'Quick Reference Panel' : '速查面板');
            setElText('qref-counters-title', isEn ? 'Elemental Counters' : '元素相剋速查');
            setElText('qref-terrain-title', isEn ? 'Terrain Bonuses' : '戰術地形加成');
            setElText('qref-tri-title', isEn ? 'Tri-Element 3★ Fusions' : '三元 3★ 創世融合');
            const qRefCounters = document.getElementById('qref-counters-list');
            if (qRefCounters) {
                const rows = qRefCounters.querySelectorAll('.qref-row');
                const zhQ0 = [['🔥 火 ▸ 蔓藤 / 史萊姆', '175%'], ['❄️ 冰 ▸ 熔岩 / 獵犬', '175%'], ['⚡ 雷 ▸ 飛艇 / 魔像', '175%'], ['轉職 ▸ 親和 / 三元全親和', '135% / 126%']];
                const enQ0 = [['🔥 Fire ▸ Vine / Slime', '175%'], ['❄️ Ice ▸ Lava / Hound', '175%'], ['⚡ Thunder ▸ Air / Golem', '175%'], ['Hybrid / Tri-Element', '135% / 126%']];
                (isEn ? enQ0 : zhQ0).forEach((pair, idx) => {
                    if (!rows[idx] || !rows[idx].children[0] || !rows[idx].children[1]) return;
                    rows[idx].children[0].innerText = pair[0];
                    rows[idx].children[1].innerText = pair[1];
                });
            }
            const qRefTerrain = document.getElementById('qref-terrain-list');
            if (qRefTerrain) {
                const rows = qRefTerrain.querySelectorAll('.qref-row');
                const zhQ1 = [['制高點', '射程 +30%'], ['元素靈脈', '攻速 +25%'], ['世界樹庇護', '傷 +20%']];
                const enQ1 = [['Highground', 'Rng +30%'], ['Mana Vein', 'Spd +25%'], ['Sanctuary', 'DMG +20%']];
                (isEn ? enQ1 : zhQ1).forEach((pair, idx) => {
                    if (!rows[idx] || !rows[idx].children[0] || !rows[idx].children[1]) return;
                    const labelSpan = rows[idx].children[0].querySelector('span:last-child');
                    if (labelSpan) labelSpan.innerText = pair[0];
                    rows[idx].children[1].innerText = pair[1];
                });
            }
            const qRefTri = document.getElementById('qref-tri-list');
            if (qRefTri) {
                const rows = qRefTri.querySelectorAll('.qref-row');
                const zhQ2 = [['蒸氣 2★ + ⚡雷 2★', '天災風暴 3★'], ['🔥火 2★ + 磁環 2★', '星界熔爐 3★'], ['❄️冰 2★ + 電漿 2★', '零度稜鏡 3★']];
                const enQ2 = [['Steam 2★ + ⚡Bolt 2★', 'Stormtree 3★'], ['🔥Fire 2★ + Magnet 2★', 'Starforge 3★'], ['❄️Ice 2★ + Plasma 2★', 'Zero Prism 3★']];
                (isEn ? enQ2 : zhQ2).forEach((pair, idx) => {
                    if (!rows[idx] || !rows[idx].children[0] || !rows[idx].children[1]) return;
                    rows[idx].children[0].innerText = pair[0];
                    rows[idx].children[1].innerText = pair[1];
                });
            }

            // 底部與彈窗固定鈕
            setElText('codex-btn', isEn ? 'World Tree' : '世界樹圖譜');
            setElText('help-btn-label', isEn ? 'Guide' : '戰術手冊');
            setElText('guide-evo-title', isEn ? 'Evolution Pyramid (1★ → 5★ 16U)' : '轉職與升星金字塔（1★ → 5★ 16U）');
            const nextWaveLabelEl = document.getElementById('next-wave-label');
            if (nextWaveLabelEl) nextWaveLabelEl.innerText = isEn ? 'Start Wave' : '立即開波';
            else setElText('next-wave-btn', isEn ? 'Start Wave' : '立即開波');
            setElText('pause-resume-btn', isEn ? 'Resume' : '繼續');
            setElText('pause-menu-btn', isEn ? 'Change Map' : '切換地圖');
            setElText('evo-confirm-title', isEn ? 'Crown Branch Evolution' : '世界樹冠枝開花選擇');
            setElText('evo-bullet-tag', isEn ? '0.15x Bullet Time' : '0.15x 子彈時間');
            setElText('evo-cancel-btn', isEn ? 'Cancel [Esc]' : '取消退回原位 [Esc]');
            setElText('codex-title', isEn ? 'Elemental World Tree Codex' : '元素世界樹演化圖譜');
            setElText('codex-close-btn', isEn ? 'Close [Esc]' : '關閉 [Esc]');
            setElText('blessing-title', isEn ? 'World Tree Blessings' : '世界樹枝枒祝福');
            setElText('blessing-wave-subtitle', isEn
                ? 'Wave cleared! Choose one World Tree Blessing (unique per run).'
                : '防線捷報，請擇一項世界樹賜福（每局唯一，不重複出現）。');
            setElText('boss-banner-title', isEn ? 'Final Boss' : '終極魔王');
            setElText('side-monster-lock-tag', isEn ? 'Locked' : '鎖定檢視');
            setElText('start-title', isEn ? 'Elemental Frontline: Merge TD' : '元素陣線：合成塔防');
            setElText('start-game-btn', isEn ? 'Start Defense' : '開始防守');
            setElText('mode-title-campaign', isEn ? 'Campaign' : '戰役關卡');
            setElText('mode-badge-campaign', isEn ? 'Story Maps' : '主線推進');
            setElText('mode-desc-campaign', isEn
                ? 'Conquer 5 elemental battlefields across 10-15 waves for ★ ratings and +200 ★ first-clear bonus.'
                : '推進五大元素戰場，挑戰 10～15 波魔王並贏取星級與首通 +200 ★ 榮譽。');
            setElText('mode-enter-campaign', isEn ? 'Select Map ▸' : '選擇戰場 ▸');
            setElText('mode-title-endless', isEn ? 'Endless Trial' : '無盡試煉');
            setElText('mode-badge-endless', isEn ? 'Infinite Waves' : '極限生存');
            setElText('mode-desc-endless', isEn
                ? 'Enter straight at Wave 1 against endless scaling waves. Test 5★ Scion builds & vein infusions.'
                : '由第 1 波起直面無止盡升壓攻勢，驗證 5★ 神裔與無限靈脈灌注構築極限。');
            setElText('mode-title-daily', isEn ? 'Daily Seed' : '每日種子挑戰');
            setElText('mode-badge-daily', isEn ? 'Daily Sync' : '同題競速');
            setElText('mode-desc-daily', isEn
                ? 'Deterministic daily map, weather, stock noise, blind box & blessing seed for fair score runs.'
                : '以今日日期固定生成地圖、天氣、股市波動、盲盒與枝枒賜福序列，公平一戰。');
            setElText('mode-std-daily', isEn ? 'Standardized (No Meta Rings)' : '標準環境（無年輪）');
            setElText('mode-enter-daily', isEn ? 'Briefing ▸' : '查看簡報 ▸');
            setElText('mode-title-puzzle', isEn ? 'World Tree Trials' : '世界樹殘局試煉');
            setElText('mode-badge-puzzle', isEn ? '5 Tactical Trials' : '單波解謎');
            setElText('mode-desc-puzzle', isEn
                ? '5 fixed-gold single-wave tactical puzzles. Solve elemental counters and high-tier merges to clear.'
                : '5 道固定資金與極端怪潮殘局，唯有算準元素相剋與轉職合成方能一次破局。');
            setElText('mode-std-puzzle', isEn ? 'Standardized (No Meta Rings)' : '標準環境（無年輪）');
            setElText('mode-enter-puzzle', isEn ? 'Enter Trials ▸' : '挑戰殘局 ▸');
            setElText('std-mode-pill', isEn ? 'Standard (No Meta)' : '標準環境（無年輪）');
            setElText('daily-std-notice', isEn
                ? 'Standardized (No Meta Rings) · Base Stock (5% Fee) & 4-Pull Box Pity'
                : '標準環境（無年輪）· 開放基礎股市 (5% 手續費) 與 4 抽盲盒保底');
            setElText('puzzle-std-notice', isEn
                ? 'Standardized (No Meta Rings) · Pure Fixed-Gold Tactical Solve'
                : '標準環境（無年輪）· 禁用所有局外年輪，純粹考驗單波資源算術');
            setElText('lobby-setup-back-btn', isEn ? '← Back to Lobby' : '← 返回模式大廳');
            setElText('daily-brief-date-k', isEn ? 'Challenge Date' : '挑戰日期');
            setElText('daily-brief-seed-k', isEn ? 'Deterministic Seed' : '確定性種子碼');
            setElText('daily-brief-map-k', isEn ? 'Fixed Battlefield' : '固定戰場');
            setElText('daily-brief-weather-k', isEn ? 'Forest Weather' : '今日林相天氣');
            setElText('daily-brief-status-k', isEn ? 'Daily Record' : '今日戰績');
            setElText('daily-rule-note', isEn
                ? "Meta Tree Rings are disabled (Standardized). All daily randomness (Blind Box, Stock noise, Blessings) uses today's fixed seed. Wins & losses stamp a dated scorecard."
                : '本模式鎖定為「標準環境（無年輪）」，今日所有隨機波動（盲盒、股市雜訊、賜福抽卡）均使用同一固定種子；通關與敗陣結算皆會產生日期戰績卡。');
            setElText('lobby-codex-btn', isEn ? 'World Tree Codex' : '世界樹圖譜');
            setElText('lobby-guide-btn', isEn ? 'Field Guide' : '戰術手冊');
            setElText('boss-entrance-kicker', isEn ? 'Boss Warning' : '領主警示');
            setElText('meta-tree-title', isEn ? 'World Tree Meta Rings' : '世界樹年輪');
            setElText('meta-tree-subtitle', isEn
                ? 'Spend Honor ★ earned across runs to permanently expand Guild systems, Fate Blind Box perks & Scion cap (saved offline).'
                : '消耗對局累積的榮譽點數 ★ 永久擴展商會職能、盲盒命運與神裔上限（離線存檔）。');
            setElText('meta-tree-reset-btn', isEn ? 'Reset Rings' : '重置年輪');
            setElText('meta-tree-close-btn', isEn ? 'Close' : '關閉');
            setElText('guide-title', isEn ? 'Tactical Field Guide' : '戰術手冊與地形速查');
            setElText('guide-close-btn', isEn ? 'Back to Battle' : '返回戰場');
            setElText('guide-menu-btn', isEn ? 'Change Map / Main Menu' : '切換地圖 / 返回封面');
            setElText('victory-title', isEn ? 'Victory · World Tree Protected' : '防守成功 · 世界樹安然無恙');
            const rtWaveSys = GameApp.systems && GameApp.systems.wave;
            const rtState = GameApp.runtime && GameApp.runtime.state;
            const dynVWave = (rtWaveSys && typeof rtWaveSys.getMapVictoryWave === 'function') ? rtWaveSys.getMapVictoryWave() : 10;
            const dynBoss = (rtWaveSys && typeof rtWaveSys.getBossSpecForWave === 'function') ? rtWaveSys.getBossSpecForWave(dynVWave) : null;
            const dynBossName = (dynBoss && dynBoss.name) || (isEn ? 'Final Wave Boss' : '最終波魔王');
            if (!(rtState && rtState.gameMode === 'puzzle')) {
                setElText('victory-rank-text', isEn
                    ? `Protected the World Tree and repelled the Wave ${dynVWave} ${dynBossName}.`
                    : `成功守護世界樹，擊退第 ${dynVWave} 波${dynBossName}。`);
            }
            setElText('victory-next-puzzle-btn', isEn ? 'Next Trial ▸' : '挑戰下一試煉 ▸');
            setElText('victory-restart-btn', isEn ? 'Restart' : '重新開始');
            setElText('endless-btn', isEn ? 'Endless Mode' : '繼續無盡挑戰');
            setElText('victory-menu-btn', isEn ? 'Change Map / Menu' : '切換地圖 / 主選單');
            setElText('victory-feedback-toggle', isEn ? 'Report & Feedback' : '戰報與回饋');
            setElText('game-over-title', isEn ? 'Defense Fallen' : '防線失守');
            setElText('restart-btn', isEn ? 'Restart' : '重新開始');
            setElText('gameover-menu-btn', isEn ? 'Change Map / Menu' : '切換地圖 / 主選單');
            setElText('gameover-feedback-toggle', isEn ? 'Report & Feedback' : '戰報與回饋');

            const mapSecHead = document.querySelector('.map-selector-header');
            if (mapSecHead) mapSecHead.innerText = isEn ? 'Select Battlefield' : '選擇戰場地圖';

            const startSub = document.querySelector('#start-overlay .modal-subtitle');
            if (startSub) startSub.innerText = isEn ? '15×10 Woodland Front · Defend 10–15 Waves' : '15×10 古林戰線 · 守護世界樹抵禦 10～15 波攻勢';

            const mapCards = document.querySelectorAll('#map-selector-grid .map-card');
            mapCards.forEach((card) => {
                const id = card.dataset.mapId;
                const nameEl = card.querySelector('.map-card-name');
                const badgeEl = card.querySelector('.map-diff-badge');
                const descEl = card.querySelector('.map-card-desc');
                if (id === 'forest') {
                    if (nameEl) nameEl.innerText = isEn ? 'Sunlit Woods' : '晨光森林';
                    if (badgeEl) badgeEl.innerText = isEn ? 'Standard' : '標準難度';
                    if (descEl) descEl.innerText = isEn ? '41-cell winding path · Classic defense' : '41 格蜿蜒長徑 · 經典穩定防線';
                } else if (id === 'lava') {
                    if (nameEl) nameEl.innerText = isEn ? 'Magma Canyon' : '熔岩峽谷';
                    if (badgeEl) badgeEl.innerText = isEn ? 'Hard' : '進階挑戰';
                    if (descEl) descEl.innerText = isEn ? '31-cell short path · Start +10 💰' : '31 格雙折短徑 · 初始 +10 💰';
                } else if (id === 'frost') {
                    if (nameEl) nameEl.innerText = isEn ? 'Permafrost Rift' : '永凍裂谷';
                    if (badgeEl) badgeEl.innerText = isEn ? 'Dual-Lane' : '雙路分線';
                    if (descEl) descEl.innerText = isEn ? '36-cell dual-lane · Start +15 💰 · Ice DMG +20%' : '36 格雙線匯流 · 初始 +15 💰 · 冰脈傷害 +20%';
                } else if (id === 'thunder_isles') {
                    if (nameEl) nameEl.innerText = isEn ? 'Thunder Float Isles' : '雷鳴浮島';
                    if (badgeEl) badgeEl.innerText = isEn ? 'Rift +40%' : '浮島裂隙';
                    if (descEl) descEl.innerText = isEn ? 'Rift A→B · 3 Floatstones +40% DMG · 12 Waves' : '單向裂隙 A→B · 3 浮石輪充 +40% 傷 · 12 波';
                } else if (id === 'blackmarket') {
                    if (nameEl) nameEl.innerText = isEn ? 'Barren Black Market' : '荒蕪黑市';
                    if (badgeEl) badgeEl.innerText = isEn ? '15 Waves' : '極限 15 波';
                    if (descEl) descEl.innerText = isEn ? '1 Free Box/wave · 8 Treasure Rocks · 15 Waves' : '每波 1 免費盲盒 · 8 藏寶巨石 · 15 波';
                }
            });

            const contractsLabel = document.querySelector('#contracts-drawer .contracts-summary span:first-child');
            if (contractsLabel) contractsLabel.innerText = isEn ? 'Difficulty Contracts (Optional)' : '難度契約（選填挑戰）';

            setElText('pause-resume-btn', isEn
                ? '⏸ Tactical Pause · Click to Resume [Space]'
                : '⏸ 戰術部署中 · 點擊恢復 [Space]');

            const smcTitle = document.querySelector('#side-monster-card .side-panel-title');
            if (smcTitle) smcTitle.innerText = isEn ? 'Target Enemy Info' : '目標敵軍情報';

            setElText('start-quick-tip', isEn
                ? 'Drag cards to build · Cross-merge transfers / Same-merge stars up · [Q/W/E] Tree skills · [B] Guild'
                : '拖曳元素卡建塔 · 異系轉職／同系升星 · [Q/W/E] 世界樹技能 · [B] 商會');

            // 圖鑑副標題與祝福副標題
            const codexSub = document.querySelector('#codex-overlay .codex-subtitle');
            if (codexSub) codexSub.innerText = isEn
                ? 'Grows from Core: 3 Base + 3 Hybrid ➔ 6 Trunks ➔ 12 Crowns + 3 Tri Legends ➔ Unique Primal Core 5★ ([T] pauses & inspects).'
                : '由世界樹原核向上生長：3 基礎 ＋ 3 雙元 ➔ 6 主幹 ➔ 12 冠枝 ＋ 3 三元傳奇 ➔ 唯一 5★ 原初之核（按 [T] 隨時暫停檢視）。';

            // 戰術指南 3 頁籤雙語 (#guide-overlay)
            setElText('guide-title', isEn ? 'Tactical Field Guide' : '戰術指南');
            setElText('guide-subtitle', isEn ? 'Master elemental counters, merge ladders, and Guild economy to protect the World Tree.' : '掌握元素相剋、合成階梯與商會機制，穩固世界樹防線。');
            setElText('guide-tab-btn-elements', isEn ? 'Elements & Terrain' : '元素相剋與地形');
            setElText('guide-tab-btn-merge', isEn ? 'Merge & Controls' : '合成階梯與操作');
            setElText('guide-tab-btn-endless', isEn ? 'Dew, Guild & Endless' : '靈露、商會與無盡');
            setElText('guide-t1-elem-title', isEn ? 'Elemental Counters & Crit Scaling' : '元素相剋與暴擊倍率');
            setElText('guide-el-fire-k', isEn ? '🔥 Fire ▸ Vine / Slime / Healer' : '🔥 火系 ▸ 蔓藤巨魔 / 史萊姆 / 花妖');
            setElText('guide-el-fire-v', isEn ? '1.75× Weakness (1.25× Semi-Crit) · Armor Shred & Anti-Heal' : '1.75× 弱點 (暴擊 1.25×) · 破甲抑療');
            setElText('guide-el-ice-k', isEn ? '❄️ Ice ▸ Lava / Hound / Panther' : '❄️ 冰系 ▸ 熔岩傀儡 / 獵犬 / 影豹');
            setElText('guide-el-ice-v', isEn ? '1.75× Weakness (1.25× Semi-Crit) · Slow & Freeze (-25% Heal)' : '1.75× 弱點 (暴擊 1.25×) · 緩速冰封 (-25% 治療)');
            setElText('guide-el-thunder-k', isEn ? '⚡ Thunder ▸ Airship / Golem / Guardian' : '⚡ 雷系 ▸ 機械飛艇 / 魔像 / 聖盾');
            setElText('guide-el-thunder-v', isEn ? '1.75× Weakness (1.25× Semi-Crit) · Chain Arc & Shield Break' : '1.75× 弱點 (暴擊 1.25×) · 連鎖破盾');
            setElText('guide-el-multi-k', isEn ? '✨ Dual Hybrid / 🔺 Tri-Element & Primal Core' : '✨ 雙元融合 / 🔺 三元與原初之核');
            setElText('guide-el-multi-v', isEn ? 'Dual 1.35× Affinity · Tri/Primal 1.26× Full Affinity' : '雙元 1.35× 親和 · 三元全親和 1.26×');
            setElText('guide-t1-terrain-title', isEn ? 'Tactical Terrain & Boulder Mining' : '戰術地形與岩石開採');
            setElText('guide-tr-hg-k', isEn ? '⛰️ Highground' : '⛰️ 制高點');
            setElText('guide-tr-hg-v', isEn ? 'Range +30%' : '射程 +30%');
            setElText('guide-tr-mana-k', isEn ? '✨ Mana Vein' : '✨ 元素靈脈');
            setElText('guide-tr-mana-v', isEn ? 'Attack Speed +25%' : '攻速 +25%');
            setElText('guide-tr-tree-k', isEn ? '🌿 Tree Sanctuary' : '🌿 世界樹庇護所');
            setElText('guide-tr-tree-v', isEn ? 'Up to +20% DMG by Tree HP' : '依世界樹血量最高 +20% 傷害');
            setElText('guide-tr-stone-k', isEn ? '⚡ Floatstones / 🪨 Boulders & Treasure Rocks' : '⚡ 充能浮石 / 🪨 巨岩與藏寶石');
            setElText('guide-tr-stone-v', isEn ? '+40% DMG Cycle · Click Rock & Mine 45 💰' : '輪充 +40% 傷 · 先選點開採 45 💰');
            setElText('guide-t1-weather-title', isEn ? 'Four Dynamic Weathers (Rotates Every 3 Waves)' : '四大動態天象（每 3 波輪替 / 每 5 波蝕月）');
            setElText('guide-wt-sun-k', isEn ? '☀️ Sunlit Blaze' : '☀️ 熾陽天象');
            setElText('guide-wt-sun-v', isEn ? 'Fire Range +0.4 / Burn +25% · 🔥 Stock +Bias' : '火射程 +0.4 / 灼燒 +25% · 🔥股看漲');
            setElText('guide-wt-snow-k', isEn ? '❄️ Frost Drift' : '❄️ 霜雪天象');
            setElText('guide-wt-snow-v', isEn ? 'Enemy Spd -10% / Ice Crit +15% · ❄️ Stock +Bias' : '敵速 -10% / 冰暴 +15% · ❄️股看漲');
            setElText('guide-wt-storm-k', isEn ? '⛈️ Tempest Surge' : '⛈️ 雷暴天象');
            setElText('guide-wt-storm-v', isEn ? '6s Sky Bolt on Top-HP Foe · ⚡ Vol ×2' : '每 6s 天雷劈最高血 · ⚡股高波動');
            setElText('guide-wt-eclipse-k', isEn ? '🌑 Eclipse Tide' : '🌑 蝕月黑潮');
            setElText('guide-wt-eclipse-v', isEn ? 'Kill Gold & Dew +30% · Box 3★ Odds ×2' : '賞金與靈露 +30% · 盲盒 3★ 翻倍');

            setElText('guide-t2-ladder-title', isEn ? '1★ → 5★ Merge Ladder & Tri Recipes' : '1★ → 5★ 合成階梯與創世配方');
            setElText('guide-mg-1to2-k', isEn ? '1★ + 1★ (Same Star-Up / Cross Transfer)' : '1★ + 1★（同系升星 / 異色轉職）');
            setElText('guide-mg-1to2-v', isEn ? 'Same-element merges into 2★ Trunk; cross-element creates 1★ Dual Hybrid (feed another 1★ to reach 2★).' : '同色進化 2★ 主幹；異色融合 1★ 雙元（後續 1★ 可直接灌注升 2★）。');
            setElText('guide-mg-2to4-k', isEn ? '2★ + 2★ (A/B Crown Choice) & 3★/4★ Feeding' : '2★ + 2★（A/B 冠枝）與 3★/4★ 餵養');
            setElText('guide-mg-2to4-v', isEn ? 'Merge same 2★ to pick Branch A or B 3★; 3★ & 4★ towers can absorb lower-star towers for Star Units.' : '同種 2★ 合成可選 A/B 分支 3★；3★ 與 4★ 可直接吞噬低星充能累積星級單位。');
            const triGuideV = document.getElementById('guide-mg-tri-v');
            if (triGuideV) {
                triGuideV.innerHTML = isEn
                    ? '💨Steam 2★ + ⚡Thunder 2★ ▸ ⛈️Storm<br>🔥Fire 2★ + 💠Magnet 2★ ▸ 🌋Starforge<br>❄️Ice 2★ + ☄️Plasma 2★ ▸ ❄️Prism'
                    : '💨蒸氣 2★ + ⚡雷 2★ ▸ ⛈️風暴<br>🔥火 2★ + 💠磁環 2★ ▸ 🌋熔爐<br>❄️冰 2★ + ☄️電漿 2★ ▸ ❄️稜鏡';
            }
            setElText('guide-mg-tri-k', isEn ? '3 Tri-Element 3★ Genesis Recipes' : '3 組三元素 3★ 創世融合配方');
            setElText('guide-mg-5star-k', isEn ? '5★ Scions & Unique Primal Core' : '5★ 神裔與全圖唯一「原初之核」');
            setElText('guide-mg-5star-v', isEn ? 'Ascend Tri-Element to 16U for unique Primal Core (limit 1); Scions share a board cap of 2 (3 with Meta Ring).' : '三元 16U 升華為全圖限 1 座 5★ 原初之核；其餘 5★ 神裔全場上限 2 座（年輪可擴至 3 座）。');
            setElText('guide-t2-ctrl-title', isEn ? 'Tactical Controls & Safety Guards' : '戰術操作與防呆規則');
            setElText('guide-ct-pause-k', isEn ? '[Space] Tactical Pause / [Esc] Menu' : '[Space] 戰術暫停 / [Esc] 選單');
            setElText('guide-ct-pause-v', isEn ? 'Build, merge, swap & use Guild freely while paused' : '暫停中可建塔、合成、換位與開商會');
            setElText('guide-ct-swap-k', isEn ? 'Drag Non-Merge Towers to Swap' : '非合成雙塔拖曳互換（Swap）');
            setElText('guide-ct-swap-v', isEn ? 'Exchange positions directly; free during Prep/Break' : '非合成配方直接對調座標，休整期免費');
            setElText('guide-ct-sell-k', isEn ? '3★+ Two-Step Sell Confirmation' : '3★ 以上兩段式賣塔防呆');
            setElText('guide-ct-sell-v', isEn ? 'Click Sell twice within 2.5s · 70%/80% Gold refund' : '2.5 秒內雙擊出售確認；保留 70%/80% 退費');
            setElText('guide-ct-keys-k', isEn ? 'Hotkeys: [1/2/3] Summon · [B] Guild · [T] Codex · [Tab/S] Speed' : '快捷鍵：[1/2/3] 召喚 · [B] 商會 · [T] 圖譜 · [Tab/S] 倍速');
            setElText('guide-ct-keys-v', isEn ? 'Wave 1 waits for your 1st tower before starting timer' : '首波放下第 1 座塔前不倒數，亦可手動開波');

            setElText('guide-t3-dew-title', isEn ? 'World Tree Dew Skills & Blessings' : '世界樹靈露技能與祝福');
            setElText('guide-dw-q-k', isEn ? '[Q] Root Entangle (40 💧)' : '[Q] 根鬚纏繞（40 💧）');
            setElText('guide-dw-q-v', isEn ? 'Roots all enemies 2.5s + +20% DMG taken' : '定身全場敵軍 2.5s ＋ 易傷 +20%');
            setElText('guide-dw-w-k', isEn ? '[W] Nature Frenzy (60 💧)' : '[W] 自然狂熱（60 💧）');
            setElText('guide-dw-w-v', isEn ? '+35% Attack Speed to all towers for 5s' : '全場防禦塔攻速 +35%（持續 5s）');
            setElText('guide-dw-e-k', isEn ? '[E] Golden Harvest (50 💧)' : '[E] 黃金豐收（50 💧）');
            setElText('guide-dw-e-v', isEn ? 'Instant Wave Gold + reset all tower cooldowns' : '即時採收波次金幣並重置全塔冷卻');
            setElText('guide-dw-b-k', isEn ? 'Blessings Every 3 Waves & Leylines' : '每 3 波世界樹枝枒祝福');
            setElText('guide-dw-b-v', isEn ? 'Unique 1-of-3 picks + Adjacent Leyline (+18% DMG cap)' : '每局不重複三選一；另有鄰格靈脈陣法（+18% 上限）');
            setElText('guide-t3-guild-title', isEn ? 'World Tree Guild & Endless W11+' : '世界樹商會與精兵上限');
            setElText('guide-gd-roots-k', isEn ? '🌱 Treasure Roots (55 / 90 / 125 💰)' : '🌱 聚寶根鬚（55 / 90 / 125 💰）');
            setElText('guide-gd-roots-v', isEn ? 'Pays fixed Gold + Lv.3 8% interest (cap +35 💰) independently of the non-combat soft cap.' : '波末獨立結算固定產出與 Lv.3 8% 利息（上限 +35 💰），不佔單波非戰鬥軟上限。');
            setElText('guide-gd-stock-k', isEn ? '📈 Element Stocks & Wave Wagers' : '📈 元素股市與波次對賭');
            setElText('guide-gd-stock-v', isEn ? 'Shares boost element power & track weather trends; Wagers award extra Gold & Universal Fruits.' : '持股提供對應元素增傷並聯動天象；「零封懸賞 / 魔潮加碼」可贏額外金幣與果實。');
            setElText('guide-gd-box-k', isEn ? '🎁 Blind Box & Universal Fruit (3 Slots)' : '🎁 命運盲盒與萬能果實（上限 3 顆）');
            setElText('guide-gd-box-v', isEn ? '4th-pull 2★+ pity (3rd with Meta Ring); Fruits convert to +80 💰 automatically when all 3 slots are full.' : '盲盒第 4 抽保底 2★+（年輪可縮至 3 抽）；果實滿 3 顆再獲得時自動折現 +80 💰。');
            setElText('guide-gd-endless-k', isEn ? '🗼 Tower Cap (16→22) & Endless W11+' : '🗼 精兵上限（16→22）與無盡 W11+');
            setElText('guide-gd-endless-v', isEn ? 'Expand board cap 3 times up to 22; Endless W11+ unlocks Global Leyline Boost & 4★ Crown Refine ◆1-◆3.' : 'HUD 可擴充 3 次上限至 22 座；無盡 W11+ 開放「全局靈脈強化」與「4★ 古冠精煉 ◆1–◆3」。');

            // 勝敗結算彈窗靜態欄位 (#victory-overlay & #game-over-overlay)
            const goSub = document.querySelector('#game-over-overlay .modal-subtitle');
            if (goSub) goSub.innerText = isEn ? 'The World Tree has fallen. Campaign ended.' : '世界樹生命枯竭，本局戰役結束。';
            setElText('new-record-badge', isEn ? 'New Best Wave Record!' : '刷新歷史最高波數紀錄');

            const vStatLabels = document.querySelectorAll('#victory-overlay .stat-row span');
            if (vStatLabels[0]) vStatLabels[0].innerText = isEn ? 'Battlefield' : '戰場地圖';
            if (vStatLabels[1]) vStatLabels[1].innerText = isEn ? 'Remaining Tree HP' : '剩餘世界樹生命';
            if (vStatLabels[2]) vStatLabels[2].innerText = isEn ? 'Remaining Gold' : '剩餘金幣';

            const gStatLabels = document.querySelectorAll('#game-over-overlay .stat-row span');
            if (gStatLabels[0]) gStatLabels[0].innerText = isEn ? 'Battlefield' : '戰場地圖';
            if (gStatLabels[1]) gStatLabels[1].innerText = isEn ? 'Wave Reached' : '抵達波數';
            if (gStatLabels[2]) gStatLabels[2].innerText = isEn ? 'Best Record' : '歷史最高紀錄';

            document.querySelectorAll('.recap-title').forEach(el => { el.innerText = isEn ? 'Battle Recap' : '本局數據戰報'; });
            document.querySelectorAll('.recap-mvp-label').forEach(el => { el.innerText = isEn ? 'MVP Tower' : '本局 MVP 砲塔'; });
            document.querySelectorAll('.recap-grid').forEach(grid => {
                const labels = grid.querySelectorAll('.recap-cell span');
                if (labels[0]) labels[0].innerText = isEn ? 'Total Kills' : '總擊殺數';
                if (labels[1]) labels[1].innerText = isEn ? 'Gold Earned' : '累計獲得金幣';
                if (labels[2]) labels[2].innerText = isEn ? 'Total Merges' : '合成融合次數';
            });
            const breakerLabel = document.querySelector('#gameover-breaker-row span');
            if (breakerLabel) breakerLabel.innerText = isEn ? 'Fatal Breaker' : '致命突破敵人';

            document.querySelectorAll('.feel-rating-header').forEach(el => { el.innerText = isEn ? '5s Quick Playtest Rating' : '5 秒試玩體感快評'; });
            const ratingMap = [
                ['爽快好玩', 'Fun & Crisp'],
                ['中間有點無聊', 'Slow Midgame'],
                ['難度太高卡關', 'Too Hard'],
                ['拖拉操作卡手', 'Clunky Drag']
            ];
            document.querySelectorAll('.feel-rating-bar').forEach(bar => {
                bar.querySelectorAll('.feel-rating-btn').forEach((btn, idx) => {
                    if (ratingMap[idx]) btn.innerText = isEn ? ratingMap[idx][1] : ratingMap[idx][0];
                });
            });
            document.querySelectorAll('.feel-rating-status').forEach(el => {
                if (!el.dataset.rated) el.innerText = isEn ? 'Tap a tag above to submit instant feedback' : '點擊上方標籤一鍵回饋本局體感';
            });
            setElText('victory-copy-report-btn', isEn ? 'Copy Battle Report' : '複製本局數據戰報');
            setElText('gameover-copy-report-btn', isEn ? 'Copy Battle Report' : '複製本局數據戰報');
            setElText('victory-daily-share-title', isEn ? 'Daily Seed Scorecard' : '每日種子戰績卡');
            setElText('gameover-daily-share-title', isEn ? 'Daily Seed Scorecard' : '每日種子戰績卡');
            setElText('victory-daily-copy-btn', isEn ? 'Copy Scorecard' : '複製日期戰績卡');
            setElText('gameover-daily-copy-btn', isEn ? 'Copy Scorecard' : '複製日期戰績卡');
        }

        function getWeaknessLabel(weakness) {
            const w = WEAKNESS_NAMES[weakness];
            if (w) return currentLang === 'en' ? w.en : w.zh;
            return weakness || (currentLang === 'en' ? 'None' : '無');
        }

        function applyLanguage() {
            translateDataCatalogs(currentLang);
            applyStaticDom(currentLang);
            subscribers.forEach((fn) => {
                try { fn(currentLang); } catch (_) { }
            });
        }

        function setLang(lang) {
            const next = lang === 'en' ? 'en' : 'zh-TW';
            currentLang = next;
            try {
                if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, next);
            } catch (_) { }
            applyLanguage();
            return currentLang;
        }

        function toggleLang() {
            return setLang(currentLang === 'en' ? 'zh-TW' : 'en');
        }

        function getLang() {
            return currentLang;
        }

        function isEnglish() {
            return currentLang === 'en';
        }

        function pick(zhStr, enStr) {
            return currentLang === 'en' ? enStr : zhStr;
        }

        function onChange(fn) {
            if (typeof fn === 'function') subscribers.add(fn);
        }

        GameApp.i18n = {
            getLang,
            setLang,
            toggleLang,
            isEnglish,
            pick,
            getWeaknessLabel,
            onChange,
            applyLanguage
        };
    }) (window);
