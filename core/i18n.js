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
        if (saved === 'en' || saved === 'zh-TW') currentLang = saved;
    } catch (_) {}

    const EN_TOWERS = {
        fire_bud: {
            name: 'Fire Bud', shortName: 'Fire 1★',
            shopRoleTag: 'Armor Break · 25 DMG · 2.3 Rng',
            roleSummary: 'Single Armor Shred (25%)',
            tooltipSummary: 'Hits shred 25% target armor for 3.0s',
            lineagePath: '🔥 Fire Bud'
        },
        ice_bud: {
            name: 'Ice Bud', shortName: 'Ice 1★',
            shopRoleTag: 'Slow · 15 DMG · 2.8 Rng',
            roleSummary: 'Slow Control (40%)',
            tooltipSummary: 'Slows target by 40% for 2.0s',
            lineagePath: '❄️ Ice Bud'
        },
        thunder_bud: {
            name: 'Thunder Bud', shortName: 'Thunder 1★',
            shopRoleTag: 'Chain · 13 DMG · 3.6 Rng',
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
            roleSummary: '3-Target Chain Bolt',
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
            roleSummary: '1.5-Cell 60% Slow + 4-Hit Freeze',
            tooltipSummary: '1.5-cell 60% slow; every 4th hit freezes 0.9s',
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
            tooltipSummary: 'Every 3rd bolt deals 2.2x dmg, ignores 40% armor',
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
            roleSummary: '1.6-Cell Mist + 20% Team Vuln',
            tooltipSummary: '1.6-cell mist slow 35% + +20% all dmg taken (3s)',
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
            roleSummary: '3-Bounce + 3.5s Shock Synergy',
            tooltipSummary: '3 bounces + 3.5s Shock (+12 bolt on ally hit)',
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
        }
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
        bomber: { name: 'Molten Bomber', traitDesc: 'On death stuns 1.4-cell towers for 1.5s unless killed Slowed/Frozen.' }
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
        dew_overcharge: { name: 'Dew Overcharge', desc: 'Casting a World Tree skill grants all towers 40% double-shot chance for 3s.' }
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
        forest: { name: '🌲 Sunlit Woods', desc: '41-cell winding path · Balanced classic defense' },
        lava: { name: '🌋 Magma Canyon', desc: '31-cell short canyon · Start +10 💰 · Kill Gold +20%' },
        frost: { name: '❄️ Permafrost Rift', desc: '36-cell dual-lane converge · Ice Lineage DMG +20%' }
    };

    const EN_TERRAINS = {
        highground: { name: '⛰️ Highground', shortTag: '⛰️ Highground Range +30%', tooltip: 'Highground: Tower Attack Range +30%' },
        mana_vein: { name: '✨ Mana Vein', shortTag: '✨ Mana Vein Spd +25%', tooltip: 'Mana Vein: Tower Attack Speed +25%' },
        world_tree: { name: '🌿 Tree Sanctuary', shortTag: '🌿 Sanctuary Max DMG +20%', tooltip: 'Sanctuary: Up to +20% DMG based on Tree HP' },
        obstacle: { name: '🪨 Ancient Boulder', shortTag: '🪨 Boulder (45 💰 Clear)', tooltip: 'Ancient Boulder: Click to clear for 45 💰 and unearth terrain' }
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
                    ? { first: 'First', armor: 'Armor', lowhp: 'Low HP' }
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

        const langBtn = document.getElementById('lang-btn');
        if (langBtn) {
            langBtn.innerText = isEn ? '繁中' : 'EN';
            langBtn.title = isEn ? '切換回繁體中文介面' : 'Switch to English UI';
        }

        // 頂部左側 HUD 標籤節點
        const dewLabelNode = document.querySelector('.hud-dew');
        if (dewLabelNode && dewLabelNode.firstChild && dewLabelNode.firstChild.nodeType === 3) {
            dewLabelNode.firstChild.nodeValue = isEn ? 'Dew ' : '靈露 ';
        }
        const bestLabelNode = document.querySelector('.hud-best');
        if (bestLabelNode && bestLabelNode.firstChild && bestLabelNode.firstChild.nodeType === 3) {
            bestLabelNode.firstChild.nodeValue = isEn ? 'Best ' : '最高 ';
        }

        // 左右側欄靜態標題
        const leftTitles = document.querySelectorAll('#side-panel-left .side-panel-title');
        if (leftTitles[0]) leftTitles[0].innerText = isEn ? 'Elemental Counters' : '元素相剋速查';
        if (leftTitles[1]) leftTitles[1].innerText = isEn ? 'Terrain Bonuses' : '戰術地形加成';
        if (leftTitles[2]) leftTitles[2].innerText = isEn ? 'Evolution Tiers' : '轉職與升星';

        const leftList = document.querySelectorAll('#side-panel-left .side-panel-list');
        if (leftList[0]) {
            const rows = leftList[0].querySelectorAll('.side-panel-row');
            const zh0 = [['🔥 火 ▸ 蔓藤 / 史萊姆', '175%'], ['❄️ 冰 ▸ 熔岩 / 獵犬', '175%'], ['⚡ 雷 ▸ 飛艇 / 魔像', '175%'], ['✨ 轉職 ▸ 親和弱點', '135%']];
            const en0 = [['🔥 Fire ▸ Vine / Slime', '175%'], ['❄️ Ice ▸ Lava / Hound', '175%'], ['⚡ Bolt ▸ Air / Golem', '175%'], ['✨ Hybrid ▸ Affinity', '135%']];
            (isEn ? en0 : zh0).forEach((pair, idx) => {
                if (!rows[idx] || !rows[idx].children[0] || !rows[idx].children[1]) return;
                rows[idx].children[0].innerText = pair[0];
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
            const zh2 = [['異系 1★ + 1★', '轉職 1★'], ['同種 / 灌注 1★', '升星 2★'], ['同種 2★ + 2★', '冠枝 3★']];
            const en2 = [['Cross 1★ + 1★', 'Job 1★'], ['Same / Infuse 1★', 'Star 2★'], ['Same 2★ + 2★', 'Crown 3★']];
            (isEn ? en2 : zh2).forEach((pair, idx) => {
                if (!rows[idx] || !rows[idx].children[0] || !rows[idx].children[1]) return;
                rows[idx].children[0].innerText = pair[0];
                rows[idx].children[1].innerText = pair[1];
            });
        }

        // 底部與彈窗固定鈕
        setElText('codex-btn', isEn ? 'World Tree' : '世界樹圖譜');
        setElText('next-wave-btn', isEn ? 'Start Wave' : '立即開波');
        setElText('pause-resume-btn', isEn ? 'Resume' : '繼續');
        setElText('pause-menu-btn', isEn ? 'Change Map' : '切換地圖');
        setElText('evo-confirm-title', isEn ? 'Crown Branch Evolution' : '世界樹冠枝開花選擇');
        setElText('evo-cancel-btn', isEn ? 'Cancel [Esc]' : '取消退回原位 [Esc]');
        setElText('codex-title', isEn ? 'Elemental World Tree Codex' : '元素世界樹演化圖譜');
        setElText('codex-close-btn', isEn ? 'Close [Esc]' : '關閉 [Esc]');
        setElText('blessing-title', isEn ? 'World Tree Blessings' : '世界樹枝枒祝福');
        setElText('start-title', isEn ? 'Elemental Frontline: Merge TD' : '元素陣線：合成塔防');
        setElText('start-game-btn', isEn ? 'Start Defense' : '開始防守');
        setElText('guide-title', isEn ? 'Tactical Field Guide' : '戰術手冊與地形速查');
        setElText('guide-close-btn', isEn ? 'Back to Battle' : '返回戰場');
        setElText('guide-menu-btn', isEn ? 'Change Map / Main Menu' : '切換地圖 / 返回封面');
        setElText('victory-title', isEn ? 'Victory · World Tree Protected' : '防守成功 · 世界樹安然無恙');
        setElText('victory-restart-btn', isEn ? 'Restart' : '重新開始');
        setElText('endless-btn', isEn ? 'Endless Mode' : '繼續無盡挑戰');
        setElText('victory-menu-btn', isEn ? 'Change Map / Menu' : '切換地圖 / 主選單');
        setElText('game-over-title', isEn ? 'Defense Fallen' : '防線失守');
        setElText('restart-btn', isEn ? 'Restart' : '重新開始');
        setElText('gameover-menu-btn', isEn ? 'Change Map / Menu' : '切換地圖 / 主選單');

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
                if (descEl) descEl.innerText = isEn ? '36-cell dual-lane · Ice DMG +20%' : '36 格雙線匯流 · 冰脈傷害 +20%';
            }
        });

        const contractsLabel = document.querySelector('#contracts-drawer .contracts-summary span:first-child');
        if (contractsLabel) contractsLabel.innerText = isEn ? 'Difficulty Contracts (Optional)' : '難度契約（選填挑戰）';

        const pauseBannerText = document.querySelector('#pause-banner .pause-banner-text');
        if (pauseBannerText) pauseBannerText.innerText = isEn ? 'Game Paused — Click Resume or press [Space]' : '遊戲已暫停 — 點擊繼續或按 [Space] 恢復';

        const smcTitle = document.querySelector('#side-monster-card .side-panel-title');
        if (smcTitle) smcTitle.innerText = isEn ? 'Target Enemy Info' : '目標敵軍情報';
    }

    function applyLanguage() {
        translateDataCatalogs(currentLang);
        applyStaticDom(currentLang);
        subscribers.forEach((fn) => {
            try { fn(currentLang); } catch (_) {}
        });
    }

    function setLang(lang) {
        const next = lang === 'en' ? 'en' : 'zh-TW';
        currentLang = next;
        try {
            if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, next);
        } catch (_) {}
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
        onChange,
        applyLanguage
    };
})(window);
