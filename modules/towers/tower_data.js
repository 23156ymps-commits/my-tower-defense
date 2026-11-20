/**
 * ============================================================================
 * 【檔案名稱】：modules/towers/tower_data.js
 * 【負責功能】：存放元素世界樹 21 節點（3 根芽 T1 → 6 主幹 T2 → 12 冠枝 T3）的名稱、
 *               色票 Token、攻擊樣式標籤（attackStyle）、單發傷害、攻速、射程與分支技能參數。
 * 【讀取資料】：無（本檔為純角色數值設定表，供 tower_attack_system.js、evolution_system.js、renderer.js 與商店讀取）。
 * 【常見修改入口】：
 *   1. 調整各節點傷害、射程或攻速：直接修改 WORLD_TREE_NODES.<節點ID> 內的 damage、range、attackIntervalMs。
 *   2. 調整護甲常數、純血相剋或共生親和倍率：修改 COMBAT_CONSTANTS。
 * ============================================================================
 */
(function (global) {
    'use strict';

    const GameApp = global.GameApp = global.GameApp || {};
    const CONFIG = GameApp.config || {};

    // 索敵優先級循環與顯示名稱
    const TARGET_MODE_CYCLE = ['first', 'armor', 'lowhp'];
    const TARGET_MODE_LABELS = {
        first: '最前',
        armor: '高護甲',
        lowhp: '殘血'
    };

    // 戰鬥傷害核心公式常數（含 Phase 2A 硬性上限鎖）
    const COMBAT_CONSTANTS = {
        ATTACK_INTERVAL: 1000,
        ARMOR_HYPERBOLIC_K: 35,             // 雙曲線百分比護甲常數：35 / (35 + effectiveArmor)
        WEAKNESS_MULTIPLIER: 1.75,          // 純元素相剋暴擊倍率 (175%)
        HYBRID_AFFINITY_MULTIPLIER: 1.35,   // 跨元素共生／冠枝命中任一父系弱點之親和倍率 (135%)
        VULN_ADDITIVE_CAP: 0.60,            // 易傷加法疊加上限 60%：M_vuln = 1 + min(0.60, totalVuln)
        SLOW_DIMINISH_SECOND_FACTOR: 0.25,  // 減速遞減：最高減速 + 次高減速 × 0.25
        SLOW_TOTAL_CAP: 0.70,               // 總減速上限 70%（移速下限 0.30）
        MIN_SPEED_FLOOR_RATIO: 0.30,        // 減速後移速下限比例 30%（定身/凍結除外）
        ATTACK_SPEED_MULT_CAP: 2.50,        // 攻速乘區上限 2.50x
        ATTACK_COOLDOWN_FLOOR_MS: 120       // 攻擊冷卻下限 120ms
    };

    const ROLE_TAG_PREFIXES = {
        fire: '破甲·中',
        ice: '緩速·中',
        thunder: '連電·長'
    };

    /**
     * 元素世界樹 21 節點完整定義表（3 根芽 T1 → 6 主幹 T2 → 12 冠枝 T3）
     * 成本嚴格守恒：T1 = 1x、T2 = 2x、T3 = 4x
     */
    const WORLD_TREE_NODES = {
        // ==================== Tier 1：3 根芽 (T1) ====================
        fire_bud: {
            id: 'fire_bud',
            shopKey: 'fire',
            name: '火芽',
            shortName: '🔥火芽',
            icon: '🔥',
            image: '',
            color: '#C94A38',
            palette: { rune: '#C94A38', glow: '#F4DFC8' },
            nodeTier: 1,
            costShare: 1,
            isHybrid: false,
            shopSpawnable: true,
            elementTag: 'fire',
            lineageTags: ['fire'],
            defaultLineagePath: ['🔥火芽'],
            attackStyle: 'burst_armor_break',
            range: 2.3,
            attacksPerSec: Number((1000 / 1200).toFixed(2)),
            attackIntervalMs: 1200,
            roleTagPrefix: '破甲·中',
            roleTag: '破甲 · 單發 25 · 2.3 格',
            shopRoleTag: '破甲 · 單發 25 · 2.3 格',
            roleSummary: '基礎灼燒破甲根芽',
            tooltipSummary: '25% 破甲（3.0s）· 單體重擊',
            damage: 25,
            tierDamage: [0, 25, 58, 185],
            badges: ['單發 25 · 1.20s', '射程 2.3 格', '25%破甲 3.0s'],
            effectParams: {
                shredRate: 0.25,
                shredDurationMs: 3000
            }
        },
        ice_bud: {
            id: 'ice_bud',
            shopKey: 'ice',
            name: '冰芽',
            shortName: '❄️冰芽',
            icon: '❄️',
            image: '',
            color: '#4A9EBF',
            palette: { rune: '#4A9EBF', glow: '#D6EEF7' },
            nodeTier: 1,
            costShare: 1,
            isHybrid: false,
            shopSpawnable: true,
            elementTag: 'ice',
            lineageTags: ['ice'],
            defaultLineagePath: ['❄️冰芽'],
            attackStyle: 'slow_control',
            range: 2.8,
            attacksPerSec: 1.00,
            attackIntervalMs: 1000,
            roleTagPrefix: '緩速·中',
            roleTag: '緩速 · 單發 15 · 2.8 格',
            shopRoleTag: '緩速 · 單發 15 · 2.8 格',
            roleSummary: '基礎寒霜減速根芽',
            tooltipSummary: '40% 緩速（2.0s）· 寒霜控場',
            damage: 15,
            tierDamage: [0, 15, 36, 82],
            badges: ['單發 15 · 1.00s', '射程 2.8 格', '40%減速 2.0s'],
            effectParams: {
                slowRate: 0.40,
                slowDurationMs: 2000
            }
        },
        thunder_bud: {
            id: 'thunder_bud',
            shopKey: 'thunder',
            name: '雷芽',
            shortName: '⚡雷芽',
            icon: '⚡',
            image: '',
            color: '#E0B43C',
            palette: { rune: '#E0B43C', glow: '#F7EAC0' },
            nodeTier: 1,
            costShare: 1,
            isHybrid: false,
            shopSpawnable: true,
            elementTag: 'thunder',
            lineageTags: ['thunder'],
            defaultLineagePath: ['⚡雷芽'],
            attackStyle: 'chain_lightning',
            range: 3.6,
            attacksPerSec: Number((1000 / 900).toFixed(2)),
            attackIntervalMs: 900,
            roleTagPrefix: '連電·長',
            roleTag: '連電 · 單發 13 · 3.6 格',
            shopRoleTag: '連電 · 單發 13 · 3.6 格',
            roleSummary: '真2體連鎖閃電根芽',
            tooltipSummary: '真·2 體連鎖（100%/55%）',
            damage: 13,
            tierDamage: [0, 13, 26, 52],
            badges: ['單發 13 · 0.90s', '射程 3.6 格', '真2體連鎖 100/55%'],
            effectParams: {
                boltCount: 2,
                chainRadiusCells: 2.6,
                chainScales: [1.0, 0.55]
            }
        },

        // ==================== Tier 1 異系轉職：3 新物種 (1★) ====================
        steam_bud: {
            id: 'steam_bud',
            family: 'steam',
            name: '蒸氣噴泉',
            shortName: '💨蒸氣',
            icon: '💨',
            image: '',
            color: '#D97724',
            palette: { rune: '#D97724', glow: '#4A9EBF' },
            nodeTier: 1,
            costShare: 2,
            isHybrid: true,
            isPureTrunk: false,
            shopSpawnable: false,
            elementTag: 'steam',
            lineageTags: ['fire', 'ice'],
            defaultLineagePath: ['🔥火芽+❄️冰芽', '💨蒸氣'],
            attackStyle: 'aoe_mist',
            range: 2.7,
            attacksPerSec: Number((1000 / 1100).toFixed(2)),
            attackIntervalMs: 1100,
            roleTagPrefix: '穿甲濺射·',
            roleTag: '穿甲濺射·2.7·1.10s',
            roleSummary: '火冰轉職穿甲範圍爆裂塔',
            tooltipSummary: '45% 穿甲 · 1.3 格 70% 濺射',
            damage: 46,
            tierDamage: [0, 46, 99, 110],
            badges: ['單發 46 · 1.10s', '無視 45% 護甲', '1.3 格 70% 濺射'],
            effectParams: {
                armorPierce: 0.45,
                splashRadiusCells: 1.3,
                splashRatio: 0.70
            }
        },
        magnet_bud: {
            id: 'magnet_bud',
            family: 'magnet',
            name: '極地磁環',
            shortName: '💠磁環',
            icon: '💠',
            image: '',
            color: '#4A9EBF',
            palette: { rune: '#4A9EBF', glow: '#E0B43C' },
            nodeTier: 1,
            costShare: 2,
            isHybrid: true,
            isPureTrunk: false,
            shopSpawnable: false,
            elementTag: 'magnet',
            lineageTags: ['ice', 'thunder'],
            defaultLineagePath: ['❄️冰芽+⚡雷芽', '💠磁環'],
            attackStyle: 'stun_pulse',
            range: 3.2,
            attacksPerSec: 1.00,
            attackIntervalMs: 1000,
            roleTagPrefix: '群緩連鎖·',
            roleTag: '群緩連鎖·3.2·1.00s',
            roleSummary: '冰雷轉職群體減速彈射塔',
            tooltipSummary: '45% 群體減速 · 2 次彈射（70%）',
            damage: 29,
            tierDamage: [0, 29, 62, 86],
            badges: ['單發 29 · 1.00s', '45% 群體減速', '2 次彈射（70%）'],
            effectParams: {
                slowRate: 0.45,
                slowDurationMs: 2200,
                aoeRadiusCells: 1.3,
                chainExtraTargets: 2,
                chainRadiusCells: 2.6,
                chainDamageRatio: 0.70
            }
        },
        plasma_bud: {
            id: 'plasma_bud',
            family: 'plasma',
            name: '電漿導管',
            shortName: '☄️電漿',
            icon: '☄️',
            image: '',
            color: '#E0B43C',
            palette: { rune: '#C94A38', glow: '#E0B43C' },
            nodeTier: 1,
            costShare: 2,
            isHybrid: true,
            isPureTrunk: false,
            shopSpawnable: false,
            elementTag: 'plasma',
            lineageTags: ['fire', 'thunder'],
            defaultLineagePath: ['🔥火芽+⚡雷芽', '☄️電漿'],
            attackStyle: 'pierce_beam',
            range: 3.6,
            attacksPerSec: Number((1000 / 450).toFixed(2)),
            attackIntervalMs: 450,
            roleTagPrefix: '疊傷光束·',
            roleTag: '疊傷光束·3.6·0.45s',
            roleSummary: '火雷轉職高頻穿甲聚焦塔',
            tooltipSummary: '15% 穿甲 · 鎖定疊 4 層（+12%/層）',
            damage: 13,
            tierDamage: [0, 13, 28, 32],
            badges: ['單發 13 · 0.45s', '無視 15% 護甲', '最高 4 層（+12%/層）'],
            effectParams: {
                armorPierce: 0.15,
                stackBonus: 0.12,
                maxStacks: 4
            }
        },

        // ==================== Tier 2：6 主幹 (3 基礎系 2★ + 3 轉職系 2★) ====================
        fire_trunk: {
            id: 'fire_trunk',
            family: 'fire',
            name: '炎核樹幹',
            shortName: '🔥炎核',
            icon: '🔥',
            image: '',
            color: '#C94A38',
            palette: { rune: '#C94A38', glow: '#F4DFC8' },
            nodeTier: 2,
            costShare: 2,
            isHybrid: false,
            isPureTrunk: true,
            shopSpawnable: false,
            elementTag: 'fire',
            lineageTags: ['fire'],
            defaultLineagePath: ['🔥火芽', '🔥炎核'],
            attackStyle: 'burst_armor_break',
            range: 2.5,
            attacksPerSec: Number((1000 / 1150).toFixed(2)),
            attackIntervalMs: 1150,
            roleTagPrefix: '破甲主幹·',
            roleTag: '破甲主幹·2.5·1.15s',
            roleSummary: '純血火系重擊破甲主幹',
            tooltipSummary: '35% 破甲（3.5s）· 單體重擊',
            damage: 58,
            tierDamage: [0, 25, 58, 185],
            badges: ['單發 58 · 1.15s', '射程 2.5 格', '35%破甲 3.5s'],
            effectParams: {
                shredRate: 0.35,
                shredDurationMs: 3500
            }
        },
        ice_trunk: {
            id: 'ice_trunk',
            family: 'ice',
            name: '霜晶樹幹',
            shortName: '❄️霜晶',
            icon: '❄️',
            image: '',
            color: '#4A9EBF',
            palette: { rune: '#4A9EBF', glow: '#D6EEF7' },
            nodeTier: 2,
            costShare: 2,
            isHybrid: false,
            isPureTrunk: true,
            shopSpawnable: false,
            elementTag: 'ice',
            lineageTags: ['ice'],
            defaultLineagePath: ['❄️冰芽', '❄️霜晶'],
            attackStyle: 'slow_control',
            range: 3.0,
            attacksPerSec: 1.00,
            attackIntervalMs: 1000,
            roleTagPrefix: '霜控主幹·',
            roleTag: '霜控主幹·3.0·1.00s',
            roleSummary: '純血冰系強效減速主幹',
            tooltipSummary: '50% 強效緩速（2.2s）',
            damage: 36,
            tierDamage: [0, 15, 36, 82],
            badges: ['單發 36 · 1.00s', '射程 3.0 格', '50%減速 2.2s'],
            effectParams: {
                slowRate: 0.50,
                slowDurationMs: 2200
            }
        },
        thunder_trunk: {
            id: 'thunder_trunk',
            family: 'thunder',
            name: '雷紋樹幹',
            shortName: '⚡雷紋',
            icon: '⚡',
            image: '',
            color: '#E0B43C',
            palette: { rune: '#E0B43C', glow: '#F7EAC0' },
            nodeTier: 2,
            costShare: 2,
            isHybrid: false,
            isPureTrunk: true,
            shopSpawnable: false,
            elementTag: 'thunder',
            lineageTags: ['thunder'],
            defaultLineagePath: ['⚡雷芽', '⚡雷紋'],
            attackStyle: 'chain_lightning',
            range: 3.8,
            attacksPerSec: Number((1000 / 850).toFixed(2)),
            attackIntervalMs: 850,
            roleTagPrefix: '連鎖主幹·',
            roleTag: '連鎖主幹·3.8·0.85s',
            roleSummary: '純血雷系真3體連鎖主幹',
            tooltipSummary: '真·3 體連鎖（100%/65%/45%）',
            damage: 26,
            tierDamage: [0, 13, 26, 52],
            badges: ['單發 26 · 0.85s', '射程 3.8 格', '真3體連鎖 100/65/45%'],
            effectParams: {
                boltCount: 3,
                chainRadiusCells: 2.6,
                chainScales: [1.0, 0.65, 0.45]
            }
        },
        steam_trunk: {
            id: 'steam_trunk',
            family: 'steam',
            name: '高階蒸氣',
            shortName: '💨高階蒸氣',
            icon: '💨',
            image: '',
            color: '#D97724',
            palette: { rune: '#D97724', glow: '#4A9EBF' },
            nodeTier: 2,
            costShare: 4,
            isHybrid: true,
            isPureTrunk: false,
            shopSpawnable: false,
            elementTag: 'steam',
            lineageTags: ['fire', 'ice'],
            defaultLineagePath: ['🔥火芽+❄️冰芽', '💨蒸氣', '💨高階蒸氣'],
            attackStyle: 'aoe_mist',
            range: 2.8,
            attacksPerSec: Number((1000 / 1100).toFixed(2)),
            attackIntervalMs: 1100,
            roleTagPrefix: '高階蒸氣·',
            roleTag: '高階蒸氣·2.8·1.10s',
            roleSummary: '高階火冰穿甲範圍爆裂（1★ 的 2.15×）',
            tooltipSummary: '45% 穿甲 · 1.3 格 70% 濺射',
            damage: 99,
            tierDamage: [0, 46, 99, 110],
            badges: ['單發 99 · 1.10s', '無視 45% 護甲', '1.3 格 70% 濺射'],
            effectParams: {
                armorPierce: 0.45,
                splashRadiusCells: 1.3,
                splashRatio: 0.70
            }
        },
        magnet_trunk: {
            id: 'magnet_trunk',
            family: 'magnet',
            name: '高階磁環',
            shortName: '💠高階磁環',
            icon: '💠',
            image: '',
            color: '#4A9EBF',
            palette: { rune: '#4A9EBF', glow: '#E0B43C' },
            nodeTier: 2,
            costShare: 4,
            isHybrid: true,
            isPureTrunk: false,
            shopSpawnable: false,
            elementTag: 'magnet',
            lineageTags: ['ice', 'thunder'],
            defaultLineagePath: ['❄️冰芽+⚡雷芽', '💠磁環', '💠高階磁環'],
            attackStyle: 'stun_pulse',
            range: 3.3,
            attacksPerSec: 1.00,
            attackIntervalMs: 1000,
            roleTagPrefix: '高階磁環·',
            roleTag: '高階磁環·3.3·1.00s',
            roleSummary: '高階冰雷群體減速彈射（1★ 的 2.15×）',
            tooltipSummary: '45% 群體減速 · 2 次彈射（70%）',
            damage: 62,
            tierDamage: [0, 29, 62, 86],
            badges: ['單發 62 · 1.00s', '45% 群體減速', '2 次彈射（70%）'],
            effectParams: {
                slowRate: 0.45,
                slowDurationMs: 2200,
                aoeRadiusCells: 1.3,
                chainExtraTargets: 2,
                chainRadiusCells: 2.6,
                chainDamageRatio: 0.70
            }
        },
        plasma_trunk: {
            id: 'plasma_trunk',
            family: 'plasma',
            name: '高階電漿',
            shortName: '☄️高階電漿',
            icon: '☄️',
            image: '',
            color: '#E0B43C',
            palette: { rune: '#C94A38', glow: '#E0B43C' },
            nodeTier: 2,
            costShare: 4,
            isHybrid: true,
            isPureTrunk: false,
            shopSpawnable: false,
            elementTag: 'plasma',
            lineageTags: ['fire', 'thunder'],
            defaultLineagePath: ['🔥火芽+⚡雷芽', '☄️電漿', '☄️高階電漿'],
            attackStyle: 'pierce_beam',
            range: 3.7,
            attacksPerSec: Number((1000 / 450).toFixed(2)),
            attackIntervalMs: 450,
            roleTagPrefix: '高階電漿·',
            roleTag: '高階電漿·3.7·0.45s',
            roleSummary: '高階火雷穿甲聚焦光束（1★ 的 2.15×）',
            tooltipSummary: '15% 穿甲 · 鎖定疊 4 層（+12%/層）',
            damage: 28,
            tierDamage: [0, 13, 28, 32],
            badges: ['單發 28 · 0.45s', '無視 15% 護甲', '最高 4 層（+12%/層）'],
            effectParams: {
                armorPierce: 0.15,
                stackBonus: 0.12,
                maxStacks: 4
            }
        },

        // ==================== Tier 3：12 冠枝 (每座主幹分為 Branch A / Branch B) ====================
        fire_A: {
            id: 'fire_A',
            family: 'fire',
            branchCode: 'A',
            parentTrunk: 'fire_trunk',
            name: '熔核轟擊樹',
            shortName: '🔥A 熔核轟擊',
            displayBadge: '🔥A 熔核轟擊樹',
            icon: '🔥',
            image: '',
            color: '#C94A38',
            palette: { rune: '#C94A38', glow: '#E0B43C' },
            nodeTier: 3,
            costShare: 4,
            isHybrid: false,
            shopSpawnable: false,
            elementTag: 'fire',
            lineageTags: ['fire'],
            defaultLineagePath: ['🔥火芽', '🔥炎核', '🔥A 熔核轟擊'],
            attackStyle: 'fire_A_mortar',
            range: 2.8,
            attacksPerSec: Number((1000 / 1350).toFixed(2)),
            attackIntervalMs: 1350,
            roleTagPrefix: '重砲群破·',
            roleTag: '重砲群破·2.8·1.35s',
            roleSummary: '大範圍重砲濺射＋45%群體破甲',
            tooltipSummary: '1.3 格 60% 濺射 · 45% 群體破甲',
            damage: 185,
            tierDamage: [0, 25, 58, 185],
            badges: ['單發 185 · 1.35s', '1.3格 60%濺射', '45%群體破甲 4s'],
            effectParams: {
                splashRadiusCells: 1.3,
                splashRatio: 0.60,
                shredRate: 0.45,
                shredDurationMs: 4000
            }
        },
        fire_B: {
            id: 'fire_B',
            family: 'fire',
            branchCode: 'B',
            parentTrunk: 'fire_trunk',
            name: '焚世餘燼樹',
            shortName: '🔥B 焚世餘燼',
            displayBadge: '🔥B 焚世餘燼樹',
            icon: '🔥',
            image: '',
            color: '#D97724',
            palette: { rune: '#C94A38', glow: '#D97724' },
            nodeTier: 3,
            costShare: 4,
            isHybrid: false,
            shopSpawnable: false,
            elementTag: 'fire',
            lineageTags: ['fire'],
            defaultLineagePath: ['🔥火芽', '🔥炎核', '🔥B 焚世餘燼'],
            attackStyle: 'fire_B_ember',
            range: 3.0,
            attacksPerSec: Number((1000 / 880).toFixed(2)),
            attackIntervalMs: 880,
            roleTagPrefix: '灼燒斬殺·',
            roleTag: '灼燒斬殺·3.0·0.88s',
            roleSummary: '5層灼燒瘟疫傳染＋重傷與12%斬殺',
            tooltipSummary: '5 層灼燒傳染 · 50% 重傷 · <12% 斬殺',
            damage: 100,
            tierDamage: [0, 25, 58, 100],
            badges: ['單發 100 · 射程3.0', '5層灼燒+2s傳染', '50%重傷 · <12%處決'],
            effectParams: {
                burnMaxStacks: 5,
                burnFlatDps: 8,
                burnPctMaxHp: 0.0035,
                burnBossCapPerStack: 35,
                burnDurationMs: 5000,
                burnSpreadIntervalMs: 2000,
                burnSpreadRadiusCells: 1.2,
                grievousRate: 0.50,
                grievousDurationMs: 5000,
                executeThresholdPct: 0.12
            }
        },
        ice_A: {
            id: 'ice_A',
            family: 'ice',
            branchCode: 'A',
            parentTrunk: 'ice_trunk',
            name: '永凍領域樹',
            shortName: '❄️A 永凍領域',
            displayBadge: '❄️A 永凍領域樹',
            icon: '❄️',
            image: '',
            color: '#4A9EBF',
            palette: { rune: '#4A9EBF', glow: '#F4F1EA' },
            nodeTier: 3,
            costShare: 4,
            isHybrid: false,
            shopSpawnable: false,
            elementTag: 'ice',
            lineageTags: ['ice'],
            defaultLineagePath: ['❄️冰芽', '❄️霜晶', '❄️A 永凍領域'],
            attackStyle: 'ice_A_permafrost',
            range: 3.2,
            attacksPerSec: Number((1000 / 1100).toFixed(2)),
            attackIntervalMs: 1100,
            roleTagPrefix: '永凍控場·',
            roleTag: '永凍控場·3.2·1.10s',
            roleSummary: '1.5格60%群緩＋每4擊觸發凍結定身',
            tooltipSummary: '1.5 格 60% 群緩 · 每 4 擊凍結 0.9s',
            damage: 82,
            tierDamage: [0, 15, 36, 82],
            badges: ['單發 82 · 1.10s', '1.5格 60%群緩', '4擊0.9s凍結(6s免疫)'],
            effectParams: {
                aoeRadiusCells: 1.5,
                slowRate: 0.60,
                slowDurationMs: 2500,
                hitsToFreeze: 4,
                freezeDurationMs: 900,
                bossFreezeMult: 0.50,
                freezeImmuneMs: 6000
            }
        },
        ice_B: {
            id: 'ice_B',
            family: 'ice',
            branchCode: 'B',
            parentTrunk: 'ice_trunk',
            name: '冰錐穿刺樹',
            shortName: '❄️B 冰錐穿刺',
            displayBadge: '❄️B 冰錐穿刺樹',
            icon: '❄️',
            image: '',
            color: '#4A9EBF',
            palette: { rune: '#4A9EBF', glow: '#E0B43C' },
            nodeTier: 3,
            costShare: 4,
            isHybrid: false,
            shopSpawnable: false,
            elementTag: 'ice',
            lineageTags: ['ice'],
            defaultLineagePath: ['❄️冰芽', '❄️霜晶', '❄️B 冰錐穿刺'],
            attackStyle: 'ice_B_icicle',
            range: 3.5,
            attacksPerSec: Number((1000 / 900).toFixed(2)),
            attackIntervalMs: 900,
            roleTagPrefix: '穿刺碎冰·',
            roleTag: '穿刺碎冰·3.5·0.90s',
            roleSummary: '直線雙體穿透＋對受控敵人+55%碎冰傷',
            tooltipSummary: '直線貫穿 2 體 · 受控目標 +55% 碎冰',
            damage: 68,
            tierDamage: [0, 15, 36, 68],
            badges: ['單發 68 · 0.90s', '直線穿透2體(60%)', '受控目標+55%碎冰'],
            effectParams: {
                pierceTargets: 2,
                secondTargetRatio: 0.60,
                pierceLineWidthCells: 0.90,
                pierceSearchRadiusCells: 2.3,
                shatterBonus: 0.55,
                slowRate: 0.40,
                slowDurationMs: 2000
            }
        },
        thunder_A: {
            id: 'thunder_A',
            family: 'thunder',
            branchCode: 'A',
            parentTrunk: 'thunder_trunk',
            name: '連鎖天雷樹',
            shortName: '⚡A 連鎖天雷',
            displayBadge: '⚡A 連鎖天雷樹',
            icon: '⚡',
            image: '',
            color: '#E0B43C',
            palette: { rune: '#E0B43C', glow: '#F4F1EA' },
            nodeTier: 3,
            costShare: 4,
            isHybrid: false,
            shopSpawnable: false,
            elementTag: 'thunder',
            lineageTags: ['thunder'],
            defaultLineagePath: ['⚡雷芽', '⚡雷紋', '⚡A 連鎖天雷'],
            attackStyle: 'chain_lightning',
            range: 4.0,
            attacksPerSec: Number((1000 / 850).toFixed(2)),
            attackIntervalMs: 850,
            roleTagPrefix: '四連天雷·',
            roleTag: '四連天雷·4.0·0.85s',
            roleSummary: '高頻真4體不同目標連鎖電網',
            tooltipSummary: '真·4 體連鎖（100%/75%/55%/40%）',
            damage: 52,
            tierDamage: [0, 13, 26, 52],
            badges: ['單發 52 · 0.85s', '射程 4.0 格', '真4體連鎖 100/75/55/40%'],
            effectParams: {
                boltCount: 4,
                chainRadiusCells: 2.6,
                chainScales: [1.0, 0.75, 0.55, 0.40]
            }
        },
        thunder_B: {
            id: 'thunder_B',
            family: 'thunder',
            branchCode: 'B',
            parentTrunk: 'thunder_trunk',
            name: '落雷審判樹',
            shortName: '⚡B 落雷審判',
            displayBadge: '⚡B 落雷審判樹',
            icon: '⚡',
            image: '',
            color: '#E0B43C',
            palette: { rune: '#E0B43C', glow: '#D97724' },
            nodeTier: 3,
            costShare: 4,
            isHybrid: false,
            shopSpawnable: false,
            elementTag: 'thunder',
            lineageTags: ['thunder'],
            defaultLineagePath: ['⚡雷芽', '⚡雷紋', '⚡B 落雷審判'],
            attackStyle: 'thunder_B_judgment',
            range: 4.8,
            attacksPerSec: Number((1000 / 1300).toFixed(2)),
            attackIntervalMs: 1300,
            roleTagPrefix: '天罰狙擊·',
            roleTag: '天罰狙擊·4.8·1.30s',
            roleSummary: '超遠距離狙擊＋每第3發2.2x穿甲天罰',
            tooltipSummary: '超遠狙擊 · 每 3 發 2.2x 穿甲天罰',
            damage: 105,
            tierDamage: [0, 13, 26, 105],
            badges: ['單發 105 · 射程4.8', '每第3發 2.2x天罰', '天罰無視40%護甲'],
            effectParams: {
                judgmentEveryN: 3,
                judgmentMult: 2.2,
                judgmentArmorPierce: 0.40
            }
        },
        steam_A: {
            id: 'steam_A',
            family: 'steam',
            branchCode: 'A',
            parentTrunk: 'steam_trunk',
            affinityBias: 'fire',
            name: '焦熱蒸壓樹',
            shortName: '💨A 焦熱蒸壓',
            displayBadge: '💨A 焦熱蒸壓樹',
            icon: '💨',
            image: '',
            color: '#D97724',
            palette: { rune: '#C94A38', glow: '#4A9EBF' },
            nodeTier: 3,
            costShare: 4,
            isHybrid: true,
            shopSpawnable: false,
            elementTag: 'steam',
            lineageTags: ['fire', 'ice'],
            defaultLineagePath: ['🔥火芽', '💨蒸氣', '💨A 焦熱蒸壓'],
            attackStyle: 'steam_A_pressure',
            range: 2.9,
            attacksPerSec: Number((1000 / 1100).toFixed(2)),
            attackIntervalMs: 1100,
            roleTagPrefix: '高壓蒸池·',
            roleTag: '高壓蒸池·2.9·1.10s',
            roleSummary: '65%高穿甲爆裂＋地面3s滾燙蒸氣池',
            tooltipSummary: '65% 穿甲濺射 · 3.0s 蒸氣池（28/s）',
            damage: 110,
            tierDamage: [0, 46, 99, 110],
            badges: ['單發 110 · 65%穿甲', '1.4格 65%濺射', '3s蒸氣池(28/s)'],
            effectParams: {
                armorPierce: 0.65,
                splashRadiusCells: 1.4,
                splashRatio: 0.65,
                poolDurationMs: 3000,
                poolDps: 28,
                poolRadiusCells: 1.3
            }
        },
        steam_B: {
            id: 'steam_B',
            family: 'steam',
            branchCode: 'B',
            parentTrunk: 'steam_trunk',
            affinityBias: 'ice',
            name: '霜霧迷宮樹',
            shortName: '💨B 霜霧迷宮',
            displayBadge: '💨B 霜霧迷宮樹',
            icon: '💨',
            image: '',
            color: '#4A9EBF',
            palette: { rune: '#4A9EBF', glow: '#D97724' },
            nodeTier: 3,
            costShare: 4,
            isHybrid: true,
            shopSpawnable: false,
            elementTag: 'steam',
            lineageTags: ['fire', 'ice'],
            defaultLineagePath: ['❄️冰芽', '💨蒸氣', '💨B 霜霧迷宮'],
            attackStyle: 'steam_B_fog',
            range: 3.1,
            attacksPerSec: Number((1000 / 1100).toFixed(2)),
            attackIntervalMs: 1100,
            roleTagPrefix: '霜霧易傷·',
            roleTag: '霜霧易傷·3.1·1.10s',
            roleSummary: '1.6格大範圍迷霧減速＋全隊+20%濕冷易傷',
            tooltipSummary: '1.6 格 35% 群緩 · +20% 全隊易傷',
            damage: 100,
            tierDamage: [0, 46, 99, 100],
            badges: ['單發 100 · 1.6格迷霧', '群體 35%減速', '+20%濕冷易傷 3s'],
            effectParams: {
                aoeRadiusCells: 1.6,
                slowRate: 0.35,
                slowDurationMs: 3000,
                vulnBonus: 0.20,
                vulnDurationMs: 3000
            }
        },
        magnet_A: {
            id: 'magnet_A',
            family: 'magnet',
            branchCode: 'A',
            parentTrunk: 'magnet_trunk',
            affinityBias: 'ice',
            name: '引力黑洞樹',
            shortName: '💠A 引力黑洞',
            displayBadge: '💠A 引力黑洞樹',
            icon: '💠',
            image: '',
            color: '#4A9EBF',
            palette: { rune: '#4A9EBF', glow: '#E0B43C' },
            nodeTier: 3,
            costShare: 4,
            isHybrid: true,
            shopSpawnable: false,
            elementTag: 'magnet',
            lineageTags: ['ice', 'thunder'],
            defaultLineagePath: ['❄️冰芽', '💠極地磁環', '💠A 引力黑洞'],
            attackStyle: 'magnet_A_singularity',
            range: 3.3,
            attacksPerSec: Number((1000 / 1250).toFixed(2)),
            attackIntervalMs: 1250,
            roleTagPrefix: '黑洞聚怪·',
            roleTag: '黑洞聚怪·3.3·1.25s',
            roleSummary: '1.5格45%群緩＋每第3擊將敵群沿路徑回拉0.45格',
            tooltipSummary: '1.5 格 45% 群緩 · 第 3 擊回拉 0.45 格',
            damage: 86,
            tierDamage: [0, 29, 62, 86],
            badges: ['單發 86 · 1.25s', '1.5格 45%群緩', '第3擊回拉0.45格'],
            effectParams: {
                aoeRadiusCells: 1.5,
                slowRate: 0.45,
                slowDurationMs: 2400,
                pullEveryN: 3,
                pullDistanceCells: 0.45
            }
        },
        magnet_B: {
            id: 'magnet_B',
            family: 'magnet',
            branchCode: 'B',
            parentTrunk: 'magnet_trunk',
            affinityBias: 'thunder',
            name: '電磁超載樹',
            shortName: '💠B 電磁超載',
            displayBadge: '💠B 電磁超載樹',
            icon: '💠',
            image: '',
            color: '#E0B43C',
            palette: { rune: '#E0B43C', glow: '#4A9EBF' },
            nodeTier: 3,
            costShare: 4,
            isHybrid: true,
            shopSpawnable: false,
            elementTag: 'magnet',
            lineageTags: ['ice', 'thunder'],
            defaultLineagePath: ['⚡雷芽', '💠極地磁環', '💠B 電磁超載'],
            attackStyle: 'magnet_B_overload',
            range: 3.5,
            attacksPerSec: Number((1000 / 950).toFixed(2)),
            attackIntervalMs: 950,
            roleTagPrefix: '感電超載·',
            roleTag: '感電超載·3.5·0.95s',
            roleSummary: '3目標不同單位彈射＋3.5s感電協同觸發+12雷傷',
            tooltipSummary: '3 目標彈射 · 3.5s 感電附傷（+12）',
            damage: 64,
            tierDamage: [0, 29, 62, 64],
            badges: ['單發 64 · 0.95s', '3目標不同怪彈射', '感電3.5s(+12附傷)'],
            effectParams: {
                chainTargets: 3,
                chainRadiusCells: 2.6,
                chainDamageRatio: 0.75,
                shockDurationMs: 3500,
                shockBonusDamage: 12,
                shockIcdMs: 350
            }
        },
        plasma_A: {
            id: 'plasma_A',
            family: 'plasma',
            branchCode: 'A',
            parentTrunk: 'plasma_trunk',
            affinityBias: 'fire',
            name: '聚變死光樹',
            shortName: '☄️A 聚變死光',
            displayBadge: '☄️A 聚變死光樹',
            icon: '☄️',
            image: '',
            color: '#C94A38',
            palette: { rune: '#C94A38', glow: '#E0B43C' },
            nodeTier: 3,
            costShare: 4,
            isHybrid: true,
            shopSpawnable: false,
            elementTag: 'plasma',
            lineageTags: ['fire', 'thunder'],
            defaultLineagePath: ['🔥火芽', '☄️電漿導管', '☄️A 聚變死光'],
            attackStyle: 'plasma_A_deathray',
            range: 3.9,
            attacksPerSec: 2.50,
            attackIntervalMs: 400,
            roleTagPrefix: '聚變死光·',
            roleTag: '聚變死光·3.9·0.40s',
            roleSummary: '8層高倍鎖定(2.44x)＋5層45%穿甲·換怪僅掉2層',
            tooltipSummary: '8 層鎖定（2.44x）· 5 層起 45% 穿甲',
            damage: 32,
            tierDamage: [0, 13, 28, 32],
            badges: ['單發 32 · 0.40s', '8層鎖定(+18%/層)', '>=5層45%穿甲·換怪-2層'],
            effectParams: {
                maxStacks: 8,
                stackBonus: 0.18,
                highStackThreshold: 5,
                highStackArmorPierce: 0.45,
                switchDropStacks: 2
            }
        },
        plasma_B: {
            id: 'plasma_B',
            family: 'plasma',
            branchCode: 'B',
            parentTrunk: 'plasma_trunk',
            affinityBias: 'thunder',
            name: '弧光折射樹',
            shortName: '☄️B 弧光折射',
            displayBadge: '☄️B 弧光折射樹',
            icon: '☄️',
            image: '',
            color: '#E0B43C',
            palette: { rune: '#E0B43C', glow: '#C94A38' },
            nodeTier: 3,
            costShare: 4,
            isHybrid: true,
            shopSpawnable: false,
            elementTag: 'plasma',
            lineageTags: ['fire', 'thunder'],
            defaultLineagePath: ['⚡雷芽', '☄️電漿導管', '☄️B 弧光折射'],
            attackStyle: 'plasma_B_refract',
            range: 3.9,
            attacksPerSec: 2.00,
            attackIntervalMs: 500,
            roleTagPrefix: '弧光折射·',
            roleTag: '弧光折射·3.9·0.50s',
            roleSummary: '主光束4層聚焦＋自動向2.4格內折射2道50%副光束',
            tooltipSummary: '主束 4 層聚焦 · 折射 2 道 50% 副束',
            damage: 34,
            tierDamage: [0, 13, 28, 34],
            badges: ['單發 34 · 0.50s', '主束4層(+15%/層)', '2.4格折射2副束(50%)'],
            effectParams: {
                maxStacks: 4,
                stackBonus: 0.15,
                refractTargets: 2,
                refractRadiusCells: 2.4,
                refractRatio: 0.50
            }
        }
    };

    // 建立包含 21 節點與舊版基礎鍵別名（fire/ice/thunder/steam/magnet/plasma）的 TOWERS 字典
    const TOWERS = Object.assign({}, WORLD_TREE_NODES, {
        fire: Object.assign({}, WORLD_TREE_NODES.fire_bud, {
            id: 'fire',
            canonicalId: 'fire_bud',
            isAlias: true,
            shopSpawnable: false,
            tierRange: [0, 2.3, 2.5, 2.8],
            tierDamage: [0, 25, 58, 185]
        }),
        ice: Object.assign({}, WORLD_TREE_NODES.ice_bud, {
            id: 'ice',
            canonicalId: 'ice_bud',
            isAlias: true,
            shopSpawnable: false,
            tierRange: [0, 2.8, 3.0, 3.2],
            tierDamage: [0, 15, 36, 82]
        }),
        thunder: Object.assign({}, WORLD_TREE_NODES.thunder_bud, {
            id: 'thunder',
            canonicalId: 'thunder_bud',
            isAlias: true,
            shopSpawnable: false,
            tierRange: [0, 3.6, 3.8, 4.0],
            tierDamage: [0, 13, 26, 52]
        }),
        steam: Object.assign({}, WORLD_TREE_NODES.steam_bud, {
            id: 'steam',
            canonicalId: 'steam_bud',
            isAlias: true,
            shopSpawnable: false,
            tierRange: [0, 2.7, 2.8, 2.9],
            tierDamage: [0, 46, 99, 110]
        }),
        magnet: Object.assign({}, WORLD_TREE_NODES.magnet_bud, {
            id: 'magnet',
            canonicalId: 'magnet_bud',
            isAlias: true,
            shopSpawnable: false,
            tierRange: [0, 3.2, 3.3, 3.3],
            tierDamage: [0, 29, 62, 86]
        }),
        plasma: Object.assign({}, WORLD_TREE_NODES.plasma_bud, {
            id: 'plasma',
            canonicalId: 'plasma_bud',
            isAlias: true,
            shopSpawnable: false,
            tierRange: [0, 3.6, 3.7, 3.9],
            tierDamage: [0, 13, 28, 32]
        })
    });

    /**
     * 將舊版或簡寫塔型別 + 星級 正規化為 24 節點標準 ID
     */
    function normalizeTowerType(type, tier = 1) {
        const raw = String(type || 'fire_bud');
        const t = Math.max(1, Math.min(3, Number(tier) || 1));
        if (raw === 'fire' || raw === 'fire_bud') {
            return t === 1 ? 'fire_bud' : (t === 2 ? 'fire_trunk' : 'fire_A');
        }
        if (raw === 'ice' || raw === 'ice_bud') {
            return t === 1 ? 'ice_bud' : (t === 2 ? 'ice_trunk' : 'ice_A');
        }
        if (raw === 'thunder' || raw === 'thunder_bud') {
            return t === 1 ? 'thunder_bud' : (t === 2 ? 'thunder_trunk' : 'thunder_A');
        }
        if (raw === 'steam' || raw === 'steam_bud') {
            return t === 1 ? 'steam_bud' : (t === 2 ? 'steam_trunk' : 'steam_A');
        }
        if (raw === 'magnet' || raw === 'magnet_bud') {
            return t === 1 ? 'magnet_bud' : (t === 2 ? 'magnet_trunk' : 'magnet_A');
        }
        if (raw === 'plasma' || raw === 'plasma_bud') {
            return t === 1 ? 'plasma_bud' : (t === 2 ? 'plasma_trunk' : 'plasma_A');
        }
        if (WORLD_TREE_NODES[raw]) return raw;
        return raw;
    }

    /**
     * 取得商店計價對應的基礎元素鍵（'fire' | 'ice' | 'thunder'）
     */
    function getBaseShopKey(type) {
        const raw = String(type || '');
        if (raw === 'fire' || raw === 'fire_bud' || raw === 'fire_trunk' || raw === 'fire_A' || raw === 'fire_B') return 'fire';
        if (raw === 'ice' || raw === 'ice_bud' || raw === 'ice_trunk' || raw === 'ice_A' || raw === 'ice_B') return 'ice';
        if (raw === 'thunder' || raw === 'thunder_bud' || raw === 'thunder_trunk' || raw === 'thunder_A' || raw === 'thunder_B') return 'thunder';
        const cfg = TOWERS[raw];
        return (cfg && (cfg.shopKey || cfg.elementTag)) || raw;
    }

    const TIER_DAMAGE_TABLE = {};
    const BASE_ELEMENT_TYPES = [];
    const ICE_LINEAGE_TYPES = [];
    const FIRE_LINEAGE_TYPES = [];
    const THUNDER_LINEAGE_TYPES = [];

    function syncLegacyAliases() {
        BASE_ELEMENT_TYPES.length = 0;
        ICE_LINEAGE_TYPES.length = 0;
        FIRE_LINEAGE_TYPES.length = 0;
        THUNDER_LINEAGE_TYPES.length = 0;

        // 同步別名與正規節點數值
        ['fire', 'ice', 'thunder'].forEach((baseKey) => {
            const bud = WORLD_TREE_NODES[`${baseKey}_bud`];
            const trunk = WORLD_TREE_NODES[`${baseKey}_trunk`];
            const branchA = WORLD_TREE_NODES[`${baseKey}_A`];
            if (bud && TOWERS[baseKey]) {
                TOWERS[baseKey].range = bud.range;
                TOWERS[baseKey].attackIntervalMs = bud.attackIntervalMs;
                TOWERS[baseKey].damage = bud.damage;
                TOWERS[baseKey].tierDamage = [0, bud.damage, trunk ? trunk.damage : bud.damage * 2, branchA ? branchA.damage : bud.damage * 4];
            }
        });

        Object.keys(TOWERS).forEach((key) => {
            const t = TOWERS[key];
            if (!t) return;
            if (Number.isFinite(t.damage)) {
                const d = t.damage;
                if (!Array.isArray(t.tierDamage) || !t.isAlias) {
                    t.tierDamage = [0, d, d, d];
                }
            }
            TIER_DAMAGE_TABLE[key] = Array.isArray(t.tierDamage) ? t.tierDamage : [0, 15, 36, 82];

            if (!t.isAlias && !t.isHybrid && t.shopSpawnable) {
                BASE_ELEMENT_TYPES.push(key);
            }
            const lineages = Array.isArray(t.lineageTags) ? t.lineageTags : [t.elementTag || key];
            if (lineages.includes('ice')) ICE_LINEAGE_TYPES.push(key);
            if (lineages.includes('fire')) FIRE_LINEAGE_TYPES.push(key);
            if (lineages.includes('thunder')) THUNDER_LINEAGE_TYPES.push(key);
        });
    }

    function getShopTowerTypes() {
        syncLegacyAliases();
        return Object.keys(WORLD_TREE_NODES).filter(key => {
            const t = WORLD_TREE_NODES[key];
            return Boolean(t && t.nodeTier === 1 && t.shopSpawnable !== false);
        });
    }

    syncLegacyAliases();

    Object.assign(CONFIG, {
        ATTACK_INTERVAL: COMBAT_CONSTANTS.ATTACK_INTERVAL,
        ARMOR_HYPERBOLIC_K: COMBAT_CONSTANTS.ARMOR_HYPERBOLIC_K,
        WEAKNESS_MULTIPLIER: COMBAT_CONSTANTS.WEAKNESS_MULTIPLIER,
        HYBRID_AFFINITY_MULTIPLIER: COMBAT_CONSTANTS.HYBRID_AFFINITY_MULTIPLIER,
        VULN_ADDITIVE_CAP: COMBAT_CONSTANTS.VULN_ADDITIVE_CAP,
        SLOW_TOTAL_CAP: COMBAT_CONSTANTS.SLOW_TOTAL_CAP,
        MIN_SPEED_FLOOR_RATIO: COMBAT_CONSTANTS.MIN_SPEED_FLOOR_RATIO,
        ATTACK_SPEED_MULT_CAP: COMBAT_CONSTANTS.ATTACK_SPEED_MULT_CAP,
        ATTACK_COOLDOWN_FLOOR_MS: COMBAT_CONSTANTS.ATTACK_COOLDOWN_FLOOR_MS
    });

    GameApp.data = GameApp.data || {};
    GameApp.data.towers = {
        WORLD_TREE_NODES,
        TOWERS,
        ELEMENT_CONFIG: TOWERS,
        ROLE_TAG_PREFIXES,
        BASE_ELEMENT_TYPES,
        ICE_LINEAGE_TYPES,
        FIRE_LINEAGE_TYPES,
        THUNDER_LINEAGE_TYPES,
        TARGET_MODE_CYCLE,
        TARGET_MODE_LABELS,
        TIER_DAMAGE_TABLE,
        COMBAT_CONSTANTS,
        normalizeTowerType,
        getBaseShopKey,
        getShopTowerTypes,
        syncLegacyAliases
    };

    if (global.GameConfig) {
        Object.assign(global.GameConfig, {
            WORLD_TREE_NODES,
            ELEMENT_CONFIG: TOWERS,
            ROLE_TAG_PREFIXES,
            BASE_ELEMENT_TYPES,
            ICE_LINEAGE_TYPES,
            FIRE_LINEAGE_TYPES,
            THUNDER_LINEAGE_TYPES,
            TARGET_MODE_CYCLE,
            TARGET_MODE_LABELS,
            TIER_DAMAGE_TABLE
        });
    }
})(window);
