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
            shopRoleTag: '25% Shred · 25',
            roleSummary: 'Single Armor Shred (25%)',
            tooltipSummary: 'Hits shred 25% target armor for 3.0s',
            lineagePath: '🔥 Fire Bud'
        },
        ice_bud: {
            name: 'Ice Bud', shortName: 'Ice 1★',
            shopRoleTag: '40% Slow · 15',
            roleSummary: 'Slow Control (40%)',
            tooltipSummary: 'Slows target by 40% for 2.0s',
            lineagePath: '❄️ Ice Bud'
        },
        thunder_bud: {
            name: 'Thunder Bud', shortName: 'Thunder 1★',
            shopRoleTag: 'Chain ×2 · 13',
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
            roleSummary: 'Every 3rd Hit 2.2x + 40% Pierce',
            tooltipSummary: 'Every 3rd thunder hit deals 2.2x dmg, ignores 40% armor',
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
            tooltipSummary: '1.6-cell mist slow 35% + +20% dmg taken + +15% kill gold',
            lineagePath: '💨 Hi-Steam 2★ ▸ B Frostmist Maze'
        },
        magnet_A: {
            name: 'Gravity Well', shortName: 'A Blackhole',
            roleSummary: 'AoE Slow + Pull Every 3rd Pulse',
            tooltipSummary: '1.5-cell 45% slow; 3rd pulse pulls foes 0.45 cells',
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
            roleSummary: '8-Stack Lock (+18%/stk) + 45% Pierce',
            tooltipSummary: 'Up to 8 focus stacks; drops only 2 on retarget',
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
            tooltipSummary: '1.6-cell 72% splash + 55% shred (4.5s) · Faster ATK',
            lineagePath: '🔥 Ember 2★ ▸ A Core Bombardier ▸ Solar Forge 4★'
        },
        fire_crown_B: {
            name: 'Eternal Cinder Crown', shortName: '🔥B Mastery',
            roleSummary: '7-Stack Burn + 60% Wound + <16% Exec (4★ Mastery)',
            tooltipSummary: '7-stack contagious burn + 60% wound + <16% exec · Faster ATK',
            lineagePath: '🔥 Ember 2★ ▸ B Cinder Sovereign ▸ Eternal Cinder 4★'
        },
        fire_twin_AB: {
            name: 'Twin Cinderforge Crown', shortName: '🔥AB Twin Crown',
            roleSummary: '1.4 Splash Shred (45%) + 5-Stack Burn (<14% Exec)',
            tooltipSummary: '1.4-cell 65% splash shred (45%) + 5-stack burn (<14% exec)',
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
            roleSummary: '1.8 Slow 65% + 3-Hit Freeze (4★ Mastery)',
            tooltipSummary: '1.8-cell 65% slow · 3rd hit freezes 1.1s · Faster ATK',
            lineagePath: '❄️ Frost 2★ ▸ A Permafrost Domain ▸ Whiteout 4★'
        },
        ice_crown_B: {
            name: 'Worldpierce Ice Crown', shortName: '❄️B Mastery',
            roleSummary: '3-Target Pierce +75% Shatter (4★ Mastery)',
            tooltipSummary: 'Pierces 3 targets · +75% shatter vs slow/freeze · Faster ATK',
            lineagePath: '❄️ Frost 2★ ▸ B Icicle Piercer ▸ Worldpierce 4★'
        },
        ice_twin_AB: {
            name: 'Twin Frostedge Crown', shortName: '❄️AB Twin Crown',
            roleSummary: '1.6 Slow 60% Freeze + 2-Pierce (+60% Shatter)',
            tooltipSummary: '1.6-cell 60% slow (4-hit freeze) + 2-pierce (+60% shatter)',
            lineagePath: '❄️ Permafrost + Icicle ▸ Twin Frostedge 4★'
        },
        ice_scion: {
            name: 'Absolutefrost Scion', shortName: '❄️World Scion',
            roleSummary: 'Full Freeze + Pierce Scion · +15% Brittle · 2.2 Aura + Pulse',
            tooltipSummary: 'Full Freeze + Pierce Scion · +15% Brittle · 2.2 Aura + Pulse',
            lineagePath: '❄️ Ice 2★ ▸ Twin Frostedge 4★ ▸ Absolutefrost Scion 5★'
        },
        thunder_crown_A: {
            name: 'Skynet Tempest Crown', shortName: '⚡A Mastery',
            roleSummary: '5-Target Chain Lightning (4★ Mastery)',
            tooltipSummary: '5-target chain lightning (3.0-cell arc) · Faster ATK',
            lineagePath: '⚡ Volt 2★ ▸ A Tempest Chain ▸ Skynet 4★'
        },
        thunder_crown_B: {
            name: 'Doomsday Verdict Crown', shortName: '⚡B Mastery',
            roleSummary: '3rd Hit 2.8x + 55% Armor Pierce (4★ Mastery)',
            tooltipSummary: 'Every 3rd thunder hit 2.8x DMG + 55% pierce · Faster ATK',
            lineagePath: '⚡ Volt 2★ ▸ B Sky Judgment ▸ Verdict 4★'
        },
        thunder_twin_AB: {
            name: 'Twin Skybolt Crown', shortName: '⚡AB Twin Crown',
            roleSummary: '4-Target Chain + Every 3rd Hit 2.4x Pierce',
            tooltipSummary: '4-target lightning chain + every 3rd hit 2.4x pierce judgment',
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
            tooltipSummary: '75% pierce + 1.65 splash + 3.6s steam pool (52/s) · Faster ATK',
            lineagePath: '💨 Hi-Steam 2★ ▸ A Pressure ▸ Abyssal Boiler 4★'
        },
        steam_crown_B: {
            name: 'Eternal Bonefog Crown', shortName: '💨B Mastery',
            roleSummary: '1.9 Mist 45% Slow +30% Vuln +15% Gold (4★ Mastery)',
            tooltipSummary: '1.9-cell fog 45% slow + 30% vuln + 15% kill gold · Faster ATK',
            lineagePath: '💨 Hi-Steam 2★ ▸ B Frostmist ▸ Eternal Bonefog 4★'
        },
        steam_twin_AB: {
            name: 'Twin Steammist Crown', shortName: '💨AB Twin Crown',
            roleSummary: '65% Pierce Splash + 36/s Pool + 1.6 Fog (+22% Vuln)',
            tooltipSummary: '65% pierce splash + 36/s steam pool + 1.6 mist (+22% vuln)',
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
            roleSummary: '1.8 Slow 52% + Pull Every 2nd Hit (4★ Mastery)',
            tooltipSummary: '1.8-cell 52% slow · 2nd pulse pulls 0.55 cells · Faster ATK',
            lineagePath: '💠 Hi-Magnet 2★ ▸ A Gravity ▸ Singularity 4★'
        },
        magnet_crown_B: {
            name: 'Overclock Grid Crown', shortName: '💠B Mastery',
            roleSummary: '4-Bounce + 4.2s Heavy Shock (4★ Mastery)',
            tooltipSummary: '4 bounces (82%) + 4.2s heavy Shock aura · Faster ATK',
            lineagePath: '💠 Hi-Magnet 2★ ▸ B Overload ▸ Overclock Grid 4★'
        },
        magnet_twin_AB: {
            name: 'Twin Fluxdome Crown', shortName: '💠AB Twin Crown',
            roleSummary: '1.6 Slow + 0.5 Pull + 3-Target Shock (10+2.5*W)',
            tooltipSummary: '1.6-cell slow + 0.5-cell pull + 3-target Shock (10+2.5*Wave)',
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
            roleSummary: '10-Stack Focus (+20%/stk) + 55% Pierce (4★ Mastery)',
            tooltipSummary: '10 focus stacks (+20%/stk) + 55% pierce (≥4 stk) · Faster ATK',
            lineagePath: '☄️ Hi-Plasma 2★ ▸ A Deathray ▸ Starburst 4★'
        },
        plasma_crown_B: {
            name: 'Prismatic Horizon Crown', shortName: '☄️B Mastery',
            roleSummary: '5-Stack Focus + 3 Refract Beams (4★ Mastery)',
            tooltipSummary: '5 focus stacks (+18%/stk) + 3 refract beams (62%) · Faster ATK',
            lineagePath: '☄️ Hi-Plasma 2★ ▸ B Prism ▸ Prismatic 4★'
        },
        plasma_twin_AB: {
            name: 'Twin Arcprism Crown', shortName: '☄️AB Twin Crown',
            roleSummary: '8-Stack Focus (≥5 Stk 45% Pierce) + 2 Refract Beams',
            tooltipSummary: '8-stack focus (45% pierce) + 2 refract beams (55% dmg)',
            lineagePath: '☄️ Deathray + Prism ▸ Twin Arcprism 4★'
        },
        plasma_scion: {
            name: 'Radiantbeam Scion', shortName: '☄️World Scion',
            roleSummary: 'Full Beam + Prism Scion (Max 12 Stacks) · 2.2 Aura + Pulse',
            tooltipSummary: 'Full Beam + Prism Scion (Max 12 Stacks) · 2.2 Aura + Pulse',
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
            roleSummary: '1.8-Cell Vortex Pull + 0.5s Freeze + 40% Shred Nova + Grievous Wound',
            tooltipSummary: '1.8-Cell Pull + 0.5s Freeze + 40% Shred + Wound · 1.26x Affinity',
            lineagePath: '💠 Magnet 2★ + 🔥 Fire 2★ ▸ 🌋 Astral Forged Tree 3★ (4U)'
        },
        starforge_tri_4: {
            name: 'Ancient Astral Forged Tree', shortName: '🌋Forge 4★',
            roleSummary: 'Ascended 1.8-Cell Vortex Pull + 0.5s Freeze + 40% Shred Nova + Wound',
            tooltipSummary: 'Ascended Vortex Pull + 0.5s Freeze + 40% Shred + Wound · 1.26x Affinity',
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
            roleSummary: 'Ascended 3-Beam Refraction · 5-Stack Thermal Brittle -> Shatter Burst + 0.8s Freeze',
            tooltipSummary: 'Ascended 3-Beam · 5-Stack Thermal Brittle Shatter + 0.8s Freeze · 1.26x Affinity',
            lineagePath: '☄️ Plasma 3★ + ❄️ Ice 3★ (or 8U) ▸ ❄️ Ancient Zero Prism 4★'
        },
        primal_core: {
            name: 'Genesis World Tree: Primal Core', shortName: '✦Primal Core',
            roleSummary: 'Board Unique (Max 1) · Links 8 Adjacent Allies + 5s Full-Element Genesis Pulse',
            tooltipSummary: 'Unique 5★ Core · 8-Neighbor Golden Ley-Lines + 5s Genesis Pulse · 1.26x Affinity',
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
        frost: { name: 'Permafrost Rift', desc: '36-cell dual-lane · Start +15 💰 · Ice DMG +20%' }
    };

    const EN_TERRAINS = {
        grass: { name: 'Grassland', shortTag: '', tooltip: '🌱 Grassland: Buildable tile for towers' },
        path: { name: 'Enemy Path', shortTag: '🛤️ Enemy March Route', tooltip: '🛤️ Enemy Path: Cannot build towers here' },
        highground: { name: '⛰️ Highground', shortTag: 'Range +30%', tooltip: 'Highground: Tower Attack Range +30%' },
        mana_vein: { name: '✨ Mana Vein', shortTag: 'Spd +25%', tooltip: 'Mana Vein: Tower Attack Speed +25%' },
        world_tree: { name: '🌿 Tree Sanctuary', shortTag: 'DMG +20% max', tooltip: 'Sanctuary: Up to +20% DMG based on Tree HP' },
        obstacle: { name: '🪨 Ancient Boulder', shortTag: '45 💰 Clear', tooltip: 'Ancient Boulder: Click to clear for 45 💰 and unearth terrain' }
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
                    cm[k].title = en.name;
                    cm[k].subtitle = 'Invasion Unit';
                    cm[k].desc = en.traitDesc;
                    cm[k].unlockRule = `Unlocks in-run upon encountering ${en.name}`;
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
            if (pauseBtnEl) pauseBtnEl.title = isEn ? 'Pause or Resume [Space]' : '暫停或繼續 [Space]';
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
                    ['Cross 1★ + 1★', 'Job 1★'],
                    ['Same / Infuse 1★', 'Star 2★'],
                    ['Same 2★ + 2★', 'Crown 3★'],
                    ['Same 3★ / Feed', 'Crown·Twin 4★'],
                    ['Same 4★ / 16U', 'Scion 5★']
                ];
                (isEn ? en2 : zh2).forEach((pair, idx) => {
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
                ? 'Conquer Sunlit, Magma & Frost lanes across 10 waves for ★ ratings and +200 ★ first-clear bonus.'
                : '推進晨光、熔岩與永凍三線戰場，挑戰 10 波魔王並贏取星級與首通 +200 ★ 榮譽。');
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
            setElText('mode-enter-daily', isEn ? 'Briefing ▸' : '查看簡報 ▸');
            setElText('mode-title-puzzle', isEn ? 'World Tree Trials' : '世界樹殘局試煉');
            setElText('mode-badge-puzzle', isEn ? '5 Tactile Trials' : '單波解謎');
            setElText('mode-desc-puzzle', isEn
                ? '5 fixed-gold single-wave tactical puzzles. Solve elemental counters and high-tier merges to clear.'
                : '5 道固定資金與極端怪潮殘局，唯有算準元素相剋與轉職合成方能一次破局。');
            setElText('mode-enter-puzzle', isEn ? 'Enter Trials ▸' : '挑戰殘局 ▸');
            setElText('lobby-setup-back-btn', isEn ? '← Back to Lobby' : '← 返回模式大廳');
            setElText('daily-brief-date-k', isEn ? 'Challenge Date' : '挑戰日期');
            setElText('daily-brief-seed-k', isEn ? 'Deterministic Seed' : '確定性種子碼');
            setElText('daily-brief-map-k', isEn ? 'Fixed Battlefield' : '固定戰場');
            setElText('daily-brief-weather-k', isEn ? 'Forest Weather' : '今日林相天氣');
            setElText('daily-brief-status-k', isEn ? 'Daily Record' : '今日戰績');
            setElText('daily-rule-note', isEn
                ? 'All daily randomness (Blind Box, Stock noise, Blessings, Thief loot) uses today’s fixed seed. Wins & losses stamp a dated scorecard.'
                : '今日所有波動（盲盒、股市雜訊、賜福抽卡、靈脈竊賊掉落）均鎖定同一種子序列，通關與敗陣結算皆會產生日期戰績卡。');
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
            setElText('victory-rank-text', isEn
                ? 'Protected the World Tree and repelled the Wave 10 Blighted Treant King.'
                : '成功守護世界樹，擊退第 10 波腐朽古樹王。');
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
            if (startSub) startSub.innerText = isEn ? '15×10 Woodland Front · Defend 10 Waves' : '15×10 古林戰線 · 守護世界樹抵禦 10 波攻勢';

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
                }
            });

            const contractsLabel = document.querySelector('#contracts-drawer .contracts-summary span:first-child');
            if (contractsLabel) contractsLabel.innerText = isEn ? 'Difficulty Contracts (Optional)' : '難度契約（選填挑戰）';

            const pauseBannerText = document.querySelector('#pause-banner .pause-banner-text');
            if (pauseBannerText) pauseBannerText.innerText = isEn ? 'Game Paused — Click Resume or press [Space]' : '遊戲已暫停 — 點擊繼續或按 [Space] 恢復';

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

            // 戰術手冊彈窗 (#guide-overlay)
            const guideSub = document.querySelector('#guide-overlay .modal-subtitle');
            if (guideSub) guideSub.innerText = isEn ? 'Master elemental counters and tactical terrains to defend the World Tree.' : '掌握屬性相剋與特殊地形加成，穩固世界樹防線。';
            const guideTitles = document.querySelectorAll('#guide-overlay .guide-section-title');
            if (guideTitles[0]) guideTitles[0].innerText = isEn ? 'Elemental Counters' : '元素相剋速查';
            if (guideTitles[1]) guideTitles[1].innerText = isEn ? 'Terrain Bonuses (Hover tile on board)' : '戰術地形加成（懸停棋盤特殊格可檢視）';
            if (guideTitles[2]) guideTitles[2].innerText = isEn ? 'Evolution Pyramid (1★ → 5★ 16U)' : '轉職與升星金字塔（1★ → 5★ 16U）';
            if (guideTitles[3]) guideTitles[3].innerText = isEn ? 'Summary & Hotkeys' : '防線紀要與快捷鍵';
            const guideRows = document.querySelectorAll('#guide-overlay .panel-row');
            const zhGuideRows = [
                ['🔥 火塔 ▸ 蔓藤巨魔 / 史萊姆', '175% 暴擊 · 破甲 30%'],
                ['❄️ 冰塔 ▸ 熔岩傀儡 / 疾風獵犬', '175% 暴擊 · 緩速 45%'],
                ['⚡ 雷塔 ▸ 機械飛艇 / 重裝魔像', '175% 暴擊 · 連鎖彈跳'],
                ['✨ 跨元素融合塔 ▸ 任一親和弱點', '135% 親和增傷'],
                ['制高點', '射程 +30%'],
                ['元素靈脈', '攻速 +25%'],
                ['世界樹庇護所', '依血量最高 +20% 傷害']
            ];
            const enGuideRows = [
                ['🔥 Fire ▸ Vine / Slime', '175% Crit · 30% Shred'],
                ['❄️ Ice ▸ Lava / Hound', '175% Crit · 45% Slow'],
                ['⚡ Thunder ▸ Airship / Golem', '175% Crit · Chain Arc'],
                ['✨ Hybrid ▸ Affinity Weak', '135% Affinity DMG'],
                ['Highground', 'Range +30%'],
                ['Mana Vein', 'ATK Spd +25%'],
                ['Tree Sanctuary', 'Up to +20% DMG by HP']
            ];
            (isEn ? enGuideRows : zhGuideRows).forEach((pair, idx) => {
                const row = guideRows[idx];
                if (!row) return;
                const kEl = row.querySelector('.panel-key');
                const vEl = row.querySelector('.panel-val');
                if (kEl) kEl.innerText = pair[0];
                if (vEl) vEl.innerText = pair[1];
            });
            const guideEvoNote = document.getElementById('guide-evo-note');
            if (guideEvoNote) guideEvoNote.innerHTML = isEn
                ? 'Cross 1★+1★ ▸ Hybrid 1★ (2U) | Same 1★+1★ ▸ Trunk 2★ | Same 2★+2★ ▸ Crown A/B 3★ (4U)<br>Same-Lineage 3★+3★ (or 8U) ▸ Twin 4★ | Hybrid 2★/3★ + Missing Pure 2★/3★ ▸ Tri Legend 3★/4★ | Tri 16U ▸ Unique 5★ Primal Core'
                : '異系 1★+1★ ▸ 雙元 1★ (2U) ｜ 同種 1★+1★ ▸ 靈木主幹 2★ ｜ 同種 2★+2★ ▸ 冠枝 A/B 3★ (4U)<br>同脈 3★+3★（或 8U）▸ 雙生 4★ ｜ 雙元 2★/3★ ＋ 缺口純系 ▸ 三元傳奇 3★/4★ ｜ 三元 16U ▸ 全圖唯一 5★ 原初之核';
            const guideNote = document.getElementById('guide-hotkey-note') || document.querySelector('#guide-overlay .codex-note');
            if (guideNote) guideNote.innerHTML = isEn
                ? 'Choose a World Tree Blessing every 3 waves; Bosses arrive on Wave 5 &amp; 10.<br>Hotkeys: <b>[1/2/3]</b> Summon | <b>[Q/W/E]</b> Skills | <b>[B]</b> Guild | <b>[T]</b> World Tree | <b>[Space]</b> Pause | <b>[Tab/S]</b> Speed | <b>[Esc]</b> Cancel'
                : '每通過 3 波可獲世界樹枝枒祝福；第 5 與第 10 波迎戰領主魔王。<br>熱鍵：<b>[1/2/3]</b> 召喚 ｜ <b>[Q/W/E]</b> 技能 ｜ <b>[B]</b> 商會 ｜ <b>[T]</b> 世界樹圖譜 ｜ <b>[Space]</b> 暫停 ｜ <b>[Tab/S]</b> 倍速 ｜ <b>[Esc]</b> 取消';

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
