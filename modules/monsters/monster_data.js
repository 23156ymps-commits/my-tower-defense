/**
 * ============================================================================
 * 【檔案名稱】：modules/monsters/monster_data.js
 * 【負責功能】：存放全局怪物血量／移速倍率、走路整體規則（轉彎平滑度、最低保底移速比例），
 *               以及所有一般怪、特殊機制怪與領主魔王的血量、護甲、移速、弱點與幾何外觀參數。
 * 【讀取資料】：無（本檔為純怪物數值與標籤表，供 monster_system.js、wave_system.js、renderer.js 讀取）。
 * 【常見修改入口】：
 *   1. 調整全體怪物移動速度或血量倍率：修改 GLOBAL_MONSTER_RULES。
 *   2. 新增全新怪物：於 MONSTER_DATABASE 新增一筆物件並設定 weakness 與 baseHp，出怪系統與防禦塔即自動識別。
 * ============================================================================
 */
(function (global) {
    'use strict';

    const GameApp = global.GameApp = global.GameApp || {};
    const CONFIG = GameApp.config || {};

    // 怪物全局數值與走路整體規則
    const GLOBAL_MONSTER_RULES = {
        MONSTER_BASE_SPEED: 2.6,            // 怪物基礎移動速度 (格/秒)
        MONSTER_SPEED_SCALE: 1.0,           // 全局移動速度倍率（可由雲端 Remote Config 動態覆寫）
        MONSTER_HP_SCALE: 1.0,              // 全局最大血量倍率（可由雲端 Remote Config 動態覆寫）
        MIN_SPEED_RATIO: 0.30,              // 最低保底緩速後殘餘移速比例（30%，與 70% 總減速上限對齊，定身／凍結除外）
        SLIME_SPLIT_COUNT: 2,               // 分裂型怪物死亡時預設分裂數量
        SLIME_SPLIT_HP_RATIO: 0.30          // 分裂子體繼承母體最大血量比例 (30%)
    };

    // 各類怪物基礎數值、行為標籤與參數化幾何外觀定義（image 欄位可填自訂圖片路徑，未填時自動繪製 2.5D 肖像）
    const MONSTER_DATABASE = {
        wood: {
            id: 'wood',
            name: '蔓藤巨魔',
            icon: '🌿',
            image: '',
            weakness: 'fire',
            baseHp: 68,
            baseReward: 10,
            speedMult: 1.0,
            baseArmor: 0,
            minWave: 1,
            isSpecialMechanic: false,
            splitsOnDeath: false,
            traitDesc: '均衡推進的森林木系魔物，懼怕火屬性破甲與灼燒。',
            visual: {
                primaryColor: '#523C2B',
                accentColor: '#326B46',
                shape: 'treant',
                sizeScale: 1.0
            }
        },
        lava: {
            id: 'lava',
            name: '熔岩傀儡',
            icon: '🌋',
            image: '',
            weakness: 'ice',
            baseHp: 78,
            baseReward: 11,
            speedMult: 0.92,
            baseArmor: 0,
            minWave: 1,
            isSpecialMechanic: false,
            splitsOnDeath: false,
            traitDesc: '高血量岩漿重步兵，受到冰系攻擊承受 175% 暴擊。',
            visual: {
                primaryColor: '#46201A',
                accentColor: '#C94A38',
                shape: 'golem',
                sizeScale: 1.0
            }
        },
        air: {
            id: 'air',
            name: '機械飛艇',
            icon: '🛸',
            image: '',
            weakness: 'thunder',
            baseHp: 60,
            baseReward: 10,
            speedMult: 1.15,
            baseArmor: 0,
            minWave: 1,
            isSpecialMechanic: false,
            splitsOnDeath: false,
            traitDesc: '敏捷推進的空中單位，容易被長射程雷塔攔截。',
            visual: {
                primaryColor: '#2F6A82',
                accentColor: '#4A9EBF',
                shape: 'airship',
                sizeScale: 1.0
            }
        },
        hound: {
            id: 'hound',
            name: '疾風獵犬',
            icon: '🐺',
            image: '',
            weakness: 'ice',
            baseHp: 44,
            baseReward: 9,
            speedMult: 1.65,
            baseArmor: 0,
            minWave: 2,
            isSpecialMechanic: true,
            splitsOnDeath: false,
            traitDesc: '極速突襲型魔物，必須靠冰系或磁環減速拖緩。',
            visual: {
                primaryColor: '#357690',
                accentColor: '#82BDD4',
                shape: 'beast',
                sizeScale: 0.95
            }
        },
        slime: {
            id: 'slime',
            name: '分裂史萊姆',
            icon: '🟢',
            image: '',
            weakness: 'fire',
            baseHp: 90,
            baseReward: 13,
            speedMult: 0.88,
            baseArmor: 0,
            minWave: 3,
            isSpecialMechanic: true,
            splitsOnDeath: true,
            splitCount: 2,
            splitHpRatio: 0.30,
            splitChildName: '迷你史萊姆',
            splitChildIcon: '🟢',
            traitDesc: '死亡時分裂為 2 隻迷你史萊姆，宜用範圍濺射或連鎖清場。',
            visual: {
                primaryColor: '#3B7A4D',
                accentColor: '#B7E4C7',
                shape: 'slime',
                sizeScale: 1.0
            }
        },
        golem: {
            id: 'golem',
            name: '重裝魔像',
            icon: '🗿',
            image: '',
            weakness: 'thunder',
            baseHp: 112,
            baseReward: 16,
            speedMult: 0.72,
            baseArmor: 15,
            armorGrowthPerWave: 1,
            maxArmor: 20,
            minWave: 4,
            isSpecialMechanic: true,
            splitsOnDeath: false,
            traitDesc: '自帶高額原生岩石護甲，需火系破甲或蒸氣／電漿穿甲對付。',
            visual: {
                primaryColor: '#46544C',
                accentColor: '#D97724',
                shape: 'heavy_golem',
                sizeScale: 1.05
            }
        },
        guardian: {
            id: 'guardian',
            name: '符文護衛',
            icon: '🛡️',
            image: '',
            weakness: 'thunder',
            baseHp: 118,
            baseReward: 17,
            speedMult: 0.86,
            baseArmor: 6,
            shieldRatio: 0.45,
            minWave: 6,
            isSpecialMechanic: true,
            splitsOnDeath: false,
            traitDesc: '自帶 45% 最大生命藍色能量護盾；受雷／磁環／電漿破盾效率 +40%。',
            visual: {
                primaryColor: '#264352',
                accentColor: '#4A9EBF',
                shape: 'guardian',
                sizeScale: 1.04
            }
        },
        healer: {
            id: 'healer',
            name: '癒合花妖',
            icon: '🌸',
            image: '',
            weakness: 'fire',
            baseHp: 96,
            baseReward: 15,
            speedMult: 0.90,
            baseArmor: 0,
            healIntervalMs: 3000,
            healRadiusCells: 1.5,
            healMaxHpRatio: 0.06,
            minWave: 7,
            isSpecialMechanic: true,
            splitsOnDeath: false,
            traitDesc: '每 3.0 秒治療 1.5 格內友軍 6% 生命；受灼燒「重傷」時治療減半。',
            visual: {
                primaryColor: '#2F5E45',
                accentColor: '#E8A5B8',
                shape: 'healer',
                sizeScale: 0.98
            }
        },
        panther: {
            id: 'panther',
            name: '虛空影豹',
            icon: '💨',
            image: '',
            weakness: 'ice',
            baseHp: 88,
            baseReward: 16,
            speedMult: 1.32,
            baseArmor: 0,
            stealthThresholdPct: 0.50,
            stealthDurationMs: 2200,
            stealthSpeedBonus: 0.65,
            minWave: 8,
            isSpecialMechanic: true,
            splitsOnDeath: false,
            traitDesc: '血量首次低於 50% 隱身疾行 2.2s（移速 +65%），可被 AoE 與凍結打斷現形。',
            visual: {
                primaryColor: '#2A3338',
                accentColor: '#4A9EBF',
                shape: 'panther',
                sizeScale: 0.96
            }
        },
        bomber: {
            id: 'bomber',
            name: '熔核自爆蟲',
            icon: '🔥',
            image: '',
            weakness: 'ice',
            baseHp: 105,
            baseReward: 18,
            speedMult: 0.95,
            baseArmor: 4,
            empRadiusCells: 1.4,
            empDisableMs: 1500,
            minWave: 9,
            isSpecialMechanic: true,
            splitsOnDeath: false,
            traitDesc: '死亡時癱瘓 1.4 格內防禦塔 1.5s；於減速或凍結狀態擊殺則不會自爆。',
            visual: {
                primaryColor: '#592119',
                accentColor: '#D97724',
                shape: 'bomber',
                sizeScale: 1.02
            }
        },
        thief: {
            id: 'thief',
            name: '靈脈竊賊',
            icon: '🦊',
            image: '',
            weakness: 'thunder',
            baseHp: 175,
            baseReward: 0,
            speedMult: 1.55,
            baseArmor: 0,
            minWave: 999,
            isSpecialMechanic: true,
            isTreasureThief: true,
            noBaseDamage: true,
            splitsOnDeath: false,
            traitDesc: '高速逃竄的經濟驚喜怪，逃脫不扣除世界樹生命；擊殺額外獲得 +60 金幣與隨機 1 股或盲盒代幣。',
            visual: {
                primaryColor: '#7A421D',
                accentColor: '#E0B43C',
                shape: 'beast',
                sizeScale: 0.96
            }
        }
    };

    // 4 階段機制 Boss 輪替序列（每 5 波 m = w / 5：H_boss(w) = round(920 * M_hp(w) * (1 + 0.04 * m))，A_boss(w) = min(36, 12 + round(3.5 * m))）
    const BOSS_ROSTER = [
        {
            wave: 5,
            typeKey: 'lava',
            bossMechanic: 'hard_shell',
            shellHits: 12,
            shellReduction: 0.50,
            name: '熔岩巨獸王',
            icon: '🌋',
            weakness: 'ice',
            armorBase: 16,
            hpBase: 2978,
            traitDesc: '硬化外殼：受到前 12 次攻擊減傷 50%，需高攻速連擊破殼。'
        },
        {
            wave: 10,
            typeKey: 'wood',
            bossMechanic: 'treant_summon',
            summonIntervalMs: 8000,
            summonCount: 2,
            healPct: 0.05,
            name: '腐朽古樹王',
            icon: '👹',
            weakness: 'fire',
            armorBase: 19,
            hpBase: 8487,
            traitDesc: '古樹再生：每 8 秒召喚 2 隻蔓藤小怪並回復 5% 生命（重傷減半）。'
        },
        {
            wave: 15,
            typeKey: 'air',
            bossMechanic: 'shield_emp',
            shieldRatio: 0.50,
            empIntervalMs: 10000,
            empTargets: 2,
            empDisableMs: 1500,
            name: '天穹堡壘艦',
            icon: '🛸',
            weakness: 'thunder',
            armorBase: 23,
            hpBase: 17323,
            traitDesc: '天穹護盾：開局附帶 50% 護盾，每 10 秒 EMP 癱瘓最近 2 座塔 1.5s。'
        },
        {
            wave: 20,
            typeKey: 'void_boss',
            bossMechanic: 'void_shift',
            name: '虛空噬樹者',
            icon: '🕳️',
            weakness: 'thunder',
            armorBase: 26,
            hpBase: 35313,
            traitDesc: '虛空變相：每損失 25% 生命切換弱點屬性並淨化部分負面狀態。'
        }
    ];

    // W5+ 既有怪物波次階段機制表（不新增怪物種類／圖鑑條目，隨波次解鎖策略反制點）
    const WAVE_STAGE_TRAITS = {
        wood: {
            id: 'bark_regen',
            minWave: 5,
            name: '再生樹皮',
            nameEn: 'Bark Regen',
            activeLabel: '🌿回血中',
            activeLabelEn: '🌿Regen Active',
            counteredLabel: '🔥回血中斷',
            counteredLabelEn: '🔥Regen Halted',
            regenIntervalMs: 2500,
            regenRatio: 0.035,
            fireSuppressMs: 3500,
            desc: 'W5+ 每 2.5 秒回復 3.5% 最大生命；受到火系命中、灼燒或重傷時暫停回血。',
            descEn: 'W5+: Restores 3.5% MaxHP every 2.5s; paused by Fire hits, Burn, or Grievous Wound.'
        },
        healer: {
            id: 'bloom_surge',
            minWave: 8,
            name: '盛放湧泉',
            nameEn: 'Bloom Surge',
            activeLabel: '💚盛放強化',
            activeLabelEn: '💚Surge Active',
            counteredLabel: '🔥治療中斷',
            counteredLabelEn: '🔥Heal Halted',
            bonusHealRatio: 0.025,
            bonusRadiusCells: 0.25,
            fireSuppressMs: 3500,
            desc: 'W8+ 治療脈衝強化至 8.5% 最大生命（範圍 +0.25 格）；受火系、灼燒或重傷時暫停施放治療。',
            descEn: 'W8+: Boosts heal pulse to 8.5% MaxHP (+0.25 range); paused by Fire hits, Burn, or Wound.'
        },
        hound: {
            id: 'pack_tailwind',
            minWave: 5,
            name: '疾風領跑',
            nameEn: 'Pack Tailwind',
            activeLabel: '💨加速光環',
            activeLabelEn: '💨Haste Aura',
            counteredLabel: '❄️光環中斷',
            counteredLabelEn: '❄️Aura Disrupted',
            auraRadiusCells: 1.6,
            speedBonus: 0.16,
            desc: 'W5+ 賦予 1.6 格內友軍 +16% 移速光環（不疊加）；自身受減速、凍結或定身時立即中斷。',
            descEn: 'W5+: Grants +16% speed aura to allies within 1.6 cells (non-stacking); disrupted by Slow/Freeze/Root.'
        },
        air: {
            id: 'jetstream_aura',
            minWave: 6,
            name: '噴射氣流',
            nameEn: 'Jetstream Aura',
            activeLabel: '🌪️氣流加速',
            activeLabelEn: '🌪️Jetstream',
            counteredLabel: '❄️氣流中斷',
            counteredLabelEn: '❄️Stream Halted',
            auraRadiusCells: 1.5,
            speedBonus: 0.14,
            desc: 'W6+ 展開 1.5 格氣流光環使友軍 +14% 移速（不疊加）；自身受減速、凍結或定身時立即中斷。',
            descEn: 'W6+: Projects a 1.5-cell +14% speed aura (non-stacking); disrupted by Slow/Freeze/Root.'
        },
        lava: {
            id: 'magma_crust',
            minWave: 5,
            name: '熔核硬殼',
            nameEn: 'Magma Crust',
            activeLabel: '🪨硬殼 +6甲',
            activeLabelEn: '🪨Crust +6 ARM',
            counteredLabel: '❄️硬殼碎裂',
            counteredLabelEn: '❄️Crust Cracked',
            bonusArmor: 6,
            desc: 'W5+ 常駐 +6 熔岩護甲（遵循 K=35）；受減速或冰凍冷卻時立即碎裂失去額外護甲。',
            descEn: 'W5+: Gains +6 magma armor (K=35); shatters immediately while Slowed or Frozen.'
        },
        golem: {
            id: 'reactive_plating',
            minWave: 5,
            name: '複合重甲',
            nameEn: 'Reactive Plating',
            activeLabel: '🛡️重甲 -20%',
            activeLabelEn: '🛡️Plating -20%',
            counteredLabel: '💔重甲擊穿',
            counteredLabelEn: '💔Plating Broken',
            unshreddedDr: 0.20,
            desc: 'W5+ 未受破甲、穿甲或感電時額外減傷 20%；任一破甲／穿甲攻擊或感電即可完全擊穿。',
            descEn: 'W5+: -20% damage taken while un-shredded/un-pierced; fully bypassed by Armor Shred, Pierce, or Shock.'
        },
        guardian: {
            id: 'rune_capacitor',
            minWave: 7,
            name: '符文電容盾',
            nameEn: 'Rune Capacitor',
            activeLabel: '⚡電容持盾',
            activeLabelEn: '⚡Capacitor Active',
            counteredLabel: '⚡護盾已破',
            counteredLabelEn: '⚡Shield Broken',
            nonThunderShieldDr: 0.22,
            thunderShieldMult: 1.65,
            breakShredRate: 0.20,
            breakShredMs: 3500,
            desc: 'W7+ 持盾時非雷／三元傷害 -22%；雷系（雷／磁／電漿）或三元破盾倍率提升至 1.65x，破盾時附加 20% 破甲。',
            descEn: 'W7+: While shielded, non-Thunder/Tri hits deal -22% DMG; Thunder-lineage/Tri breaks shield at 1.65x and inflicts 20% Shred.'
        }
    };

    const ELITE_AFFIXES = {
        bounty: {
            id: 'bounty',
            minWave: 6,
            name: '賞金首',
            nameEn: 'Bounty',
            shortBadge: '💰賞金',
            shortBadgeEn: '💰Bounty',
            goldRate: 0.85,
            goldFlat: 12,
            desc: '擊殺額外掉落豐厚賞金（併入單波非戰鬥淨收益軟上限控管）。',
            descEn: 'Grants bonus gold on kill (governed by wave non-combat soft cap).'
        },
        frenzied: {
            id: 'frenzied',
            minWave: 6,
            name: '狂躁',
            nameEn: 'Frenzied',
            shortBadge: '⚡狂躁',
            shortBadgeEn: '⚡Frenzied',
            speedMult: 1.22,
            lowHpBonus: 0.15,
            desc: '基礎移速 +22%，血量低於 50% 時額外狂暴加速 +15%。',
            descEn: '+22% base speed, plus +15% extra speed below 50% HP.'
        },
        shield_regen: {
            id: 'shield_regen',
            minWave: 6,
            name: '護盾再生',
            nameEn: 'Shield Regen',
            shortBadge: '🛡️再生',
            shortBadgeEn: '🛡️Regen',
            shieldRatio: 0.30,
            extraShieldRatio: 0.20,
            regenIntervalMs: 2500,
            regenRatio: 0.04,
            desc: '進場附帶能量護盾，每 2.5 秒回復 4% 最大護盾（受灼燒重傷減半）。',
            descEn: 'Spawns with energy shield; regenerates 4% max shield every 2.5s (halved by Grievous Wound).'
        },
        resonance_link: {
            id: 'resonance_link',
            minWave: 6,
            name: '群體共振',
            nameEn: 'Resonance Link',
            shortBadge: '🔗共振',
            shortBadgeEn: '🔗Link',
            linkRadiusCells: 1.8,
            maxLinks: 2,
            shareRatio: 0.30,
            aoeBonusRate: 0.15,
            desc: '連結 1.8 格內至多 2 名非王友軍分攤 30% 單體傷害；範圍／連鎖攻擊改為 +15% 增傷，凍結／暈眩／定身會中斷連結。',
            descEn: 'Links up to 2 non-Boss allies within 1.8 cells to split 30% single-target DMG; AoE/Chain deals +15% bonus DMG, and Freeze/Stun/Root severs the link.'
        },
        bulwark_aura: {
            id: 'bulwark_aura',
            minWave: 10,
            name: '戰陣庇護',
            nameEn: 'Vanguard Aegis',
            shortBadge: '🛡️庇護',
            shortBadgeEn: '🛡️Aegis',
            auraRadiusCells: 1.6,
            auraDr: 0.18,
            desc: 'W10+ 詞條：使 1.6 格內周圍非王友軍承傷 -18%（不疊加）；對本體施加破甲或易傷將立即關閉庇護。',
            descEn: 'W10+ Affix: Grants nearby non-Boss allies within 1.6 cells -18% DMG taken (non-stacking); disabled immediately by Shred or Vulnerability.'
        },
        prismatic_ward: {
            id: 'prismatic_ward',
            minWave: 10,
            name: '稜鏡護膜',
            nameEn: 'Prismatic Ward',
            shortBadge: '🌈稜鏡',
            shortBadgeEn: '🌈Prism',
            singleElemResist: 0.25,
            affinityWeakBonus: 0.20,
            desc: 'W10+ 詞條：非弱點單元素攻擊承傷 -25%；元素弱點、複合親和或三元融合塔命中時改為 +20% 增傷。',
            descEn: 'W10+ Affix: -25% DMG taken from non-weakness single-element hits; takes +20% bonus DMG from Weakness, Hybrid Affinity, or Tri-Element towers.'
        }
    };

    const SPECIAL_MECHANIC_MONSTERS = new Set(
        Object.keys(MONSTER_DATABASE).filter(k => Boolean(MONSTER_DATABASE[k] && MONSTER_DATABASE[k].isSpecialMechanic))
    );

    Object.assign(CONFIG, {
        MONSTER_BASE_SPEED: GLOBAL_MONSTER_RULES.MONSTER_BASE_SPEED,
        MONSTER_SPEED_SCALE: GLOBAL_MONSTER_RULES.MONSTER_SPEED_SCALE,
        MONSTER_HP_SCALE: GLOBAL_MONSTER_RULES.MONSTER_HP_SCALE,
        MIN_SPEED_RATIO: GLOBAL_MONSTER_RULES.MIN_SPEED_RATIO,
        SLIME_SPLIT_COUNT: GLOBAL_MONSTER_RULES.SLIME_SPLIT_COUNT,
        SLIME_SPLIT_HP_RATIO: GLOBAL_MONSTER_RULES.SLIME_SPLIT_HP_RATIO
    });

    GameApp.data = GameApp.data || {};
    GameApp.data.monsters = {
        GLOBAL_MONSTER_RULES,
        MONSTER_DATABASE,
        BOSS_ROSTER,
        WAVE_STAGE_TRAITS,
        ELITE_AFFIXES,
        SPECIAL_MECHANIC_MONSTERS
    };

    if (global.GameConfig) {
        Object.assign(global.GameConfig, {
            MONSTER_DATABASE,
            BOSS_ROSTER,
            WAVE_STAGE_TRAITS,
            ELITE_AFFIXES,
            SPECIAL_MECHANIC_MONSTERS
        });
    }
})(window);
