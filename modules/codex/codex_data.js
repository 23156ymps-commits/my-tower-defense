/**
 * ============================================================================
 * 【檔案名稱】：modules/codex/codex_data.js
 * 【負責功能】：獨立存放基礎塔、跨元素融合塔、入侵怪物與戰術地形的圖鑑分類、背景說明與解鎖條件，
 *               並提供未填寫文案的新增角色／怪物自動生成預設圖鑑卡之模板函式。
 * 【讀取資料】：無（本檔為純圖鑑文字與分類設定表，供 codex_system.js 讀取）。
 * 【常見修改入口】：
 *   1. 修改各防禦塔、怪物或地形的圖鑑介紹文字與預設解鎖狀態：調整 CODEX_ENTRIES。
 *   2. 修改新增角色或怪物的自動預設圖鑑卡格式：調整 buildFallbackTowerCard()、buildFallbackMonsterCard()。
 * ============================================================================
 */
(function (global) {
    'use strict';

    const GameApp = global.GameApp = global.GameApp || {};

    const CODEX_CATEGORIES = [
        { id: 'fusion', label: '跨元素融合' },
        { id: 'towers', label: '基礎防禦塔' },
        { id: 'monsters', label: '入侵魔物' },
        { id: 'terrain', label: '戰術地形' }
    ];

    const CODEX_ENTRIES = {
        towers: {
            fire: {
                title: '🔥 火塔（基礎元素）',
                recipeText: '商店拖曳召喚｜🔥 火系基礎塔',
                desc: '射程 2.3~2.8 格｜攻速 1.30s｜命中灼燒破甲 30%（持續 3 秒）；升至 ★★★ 解鎖 1.0 格 35% 炎爆範圍濺射。',
                unlockRule: '開局預設解鎖',
                defaultUnlocked: true,
                cardClass: 'codex-plasma'
            },
            ice: {
                title: '❄️ 冰塔（基礎元素）',
                recipeText: '商店拖曳召喚｜❄️ 冰系基礎塔',
                desc: '射程 2.8 格｜攻速 1.00s｜命中緩速 45%（持續 2 秒）；升至 ★★★ 緩速提升至 60% 並附帶 1.2 格寒霜群緩。',
                unlockRule: '開局預設解鎖',
                defaultUnlocked: true,
                cardClass: 'codex-magnet'
            },
            thunder: {
                title: '⚡ 雷塔（基礎元素）',
                recipeText: '商店拖曳召喚｜⚡ 雷系基礎塔',
                desc: '射程 3.6~4.0 格｜攻速 0.65s｜閃電連鎖彈跳（2.6 格內不重複目標）：Lv.1 連鎖 2 體（100%/55%）、Lv.2 3 體（100%/65%/45%）、Lv.3 4 體（100%/75%/55%/40%）。',
                unlockRule: '開局預設解鎖',
                defaultUnlocked: true,
                cardClass: 'codex-steam'
            },
            steam: {
                title: '💨 蒸氣爆裂塔',
                recipeText: '🔥 火 + ❄️ 冰 = <strong>蒸氣爆裂塔</strong>',
                lockedRecipeText: '🔥 火 + ❄️ 冰 = <strong>？？？</strong>',
                desc: '射程 2.5 格｜攻速 1.15s｜命中產生 1.3 格爆裂濺射，<strong>無視目標 50% 護甲</strong>，並享有火／冰雙親和 135% 增傷。',
                unlockRule: '於戰場中將同星級「火塔 ＋ 冰塔」合成即可解鎖',
                defaultUnlocked: false,
                cardClass: 'codex-steam'
            },
            magnet: {
                title: '💠 極地磁暴塔',
                recipeText: '❄️ 冰 + ⚡ 雷 = <strong>極地磁暴塔</strong>',
                lockedRecipeText: '❄️ 冰 + ⚡ 雷 = <strong>？？？</strong>',
                desc: '射程 3.2 格｜攻速 0.95s｜釋放感電冰環<strong>群體緩速 50%</strong>、彈跳 2 名敵人，並享有冰／雷雙親和 135% 增傷。',
                unlockRule: '於戰場中將同星級「冰塔 ＋ 雷塔」合成即可解鎖',
                defaultUnlocked: false,
                cardClass: 'codex-magnet'
            },
            plasma: {
                title: '☄️ 電漿聚焦塔',
                recipeText: '🔥 火 + ⚡ 雷 = <strong>電漿聚焦塔</strong>',
                lockedRecipeText: '🔥 火 + ⚡ 雷 = <strong>？？？</strong>',
                desc: '射程 3.8 格｜攻速 0.45s｜高頻聚焦光束，鎖定同一目標<strong>遞增 15% 傷害</strong>（最高 5 層），並享有火／雷雙親和 135% 增傷。',
                unlockRule: '於戰場中將同星級「火塔 ＋ 雷塔」合成即可解鎖',
                defaultUnlocked: false,
                cardClass: 'codex-plasma'
            }
        },
        monsters: {
            wood: {
                title: '🌿 蔓藤巨魔',
                subtitle: '弱點：🔥 火屬性（175% 暴擊）',
                desc: '森林常見的堅韌樹怪，移速均衡，部署火塔可迅速瓦解其防線。',
                unlockRule: 'Wave 1 起登場',
                defaultUnlocked: true
            },
            lava: {
                title: '🌋 熔岩傀儡',
                subtitle: '弱點：❄️ 冰屬性（175% 暴擊）',
                desc: '由熾熱岩漿凝聚而成的重步兵，血量偏高，懼怕寒冰緩速與凍結。',
                unlockRule: 'Wave 1 起登場',
                defaultUnlocked: true
            },
            air: {
                title: '🛸 機械飛艇',
                subtitle: '弱點：⚡ 雷屬性（175% 暴擊）',
                desc: '高速推進的古代浮空艇，能迅速掠過前線，宜用長射程雷塔攔截。',
                unlockRule: 'Wave 1 起登場',
                defaultUnlocked: true
            },
            hound: {
                title: '🐺 疾風獵犬',
                subtitle: '弱點：❄️ 冰屬性｜特殊機制：極速突襲',
                desc: '移動速度高達 1.65 倍的敏捷獵犬，務必配置冰塔或磁暴塔進行減速控場。',
                unlockRule: '推進至第 2 波遭遇「疾風獵犬」後自動解鎖',
                defaultUnlocked: false
            },
            slime: {
                title: '🟢 分裂史萊姆',
                subtitle: '弱點：🔥 火屬性｜特殊機制：死亡分裂',
                desc: '被擊殺時會就地分裂為 2 隻迷你史萊姆，適合以範圍濺射或連發雷電清場。',
                unlockRule: '推進至第 3 波遭遇「分裂史萊姆」後自動解鎖',
                defaultUnlocked: false
            },
            golem: {
                title: '🗿 重裝魔像',
                subtitle: '弱點：⚡ 雷屬性｜特殊機制：高額原生護甲',
                desc: '自帶厚重岩石護甲的巨型魔像，需依靠火塔破甲、蒸氣穿甲或雷塔高頻打擊。',
                unlockRule: '推進至第 4 波遭遇「重裝魔像」後自動解鎖',
                defaultUnlocked: false
            }
        },
        terrain: {
            highground: {
                title: '⛰️ 制高點',
                subtitle: '戰術增益：攻擊射程 +30%',
                desc: '視野遼闊的隆起高台，適合部署短射程高爆發的火塔或蒸氣爆裂塔。',
                defaultUnlocked: true
            },
            mana_vein: {
                title: '✨ 元素靈脈',
                subtitle: '戰術增益：攻擊速度 +25%',
                desc: '湧動古代魔力的晶石地脈，能大幅提升防禦塔開火頻率與疊傷效率。',
                defaultUnlocked: true
            },
            world_tree: {
                title: '🌿 世界樹庇護所',
                subtitle: '戰術增益：依基地血量最高 +20% 傷害',
                desc: '受世界樹根系祝福的聖地，基地保持高血量時可提供強大終局火力加成。',
                defaultUnlocked: true
            },
            obstacle: {
                title: '🪨 障礙地塊',
                subtitle: '地形限制：不可建造防禦塔',
                desc: '古老巨岩與崎嶇障礙，無法部署防禦塔，但不會阻擋遠程砲塔的彈道射線。',
                defaultUnlocked: true
            }
        }
    };

    const ATTACK_STYLE_LABELS = {
        burst_armor_break: '灼燒破甲爆發',
        fire_A_mortar: '範圍濺射破甲重砲',
        fire_B_ember: '5層灼燒傳染與斬殺',
        slow_control: '寒霜緩速控場',
        ice_A_permafrost: '範圍寒霜與4擊冰凍',
        ice_B_icicle: '直線穿透與碎冰增傷',
        chain_lightning: '多目標不重複連鎖',
        thunder_B_judgment: '遠程狙擊與落雷審判',
        aoe_mist: '穿甲範圍爆裂蒸氣',
        steam_A_pressure: '高穿甲蒸氣池灼燒',
        steam_B_fog: '濕冷迷霧群緩易傷',
        stun_pulse: '感電冰環群緩彈跳',
        magnet_A_singularity: '引力黑洞退路拉扯',
        magnet_B_overload: '3目標彈跳與感電引爆',
        pierce_beam: '高頻聚焦疊傷光束',
        plasma_A_deathray: '8層超載聚變死光',
        plasma_B_refract: '主束蓄能雙弧光折射'
    };

    /**
     * 為未在 codex_data.js 填寫文案的新增防禦塔自動生成預設圖鑑卡
     */
    function buildFallbackTowerCard(towerKey, towerCfg) {
        const tierNum = Number(towerCfg.tier) || 1;
        const dmgVal = Number.isFinite(towerCfg.damage)
            ? towerCfg.damage
            : (Array.isArray(towerCfg.tierDamage) ? towerCfg.tierDamage[tierNum] || towerCfg.tierDamage[1] : 25);
        const sec = Number(((towerCfg.attackIntervalMs || 1000) / 1000).toFixed(2));
        const styleText = ATTACK_STYLE_LABELS[towerCfg.attackStyle] || towerCfg.attackStyle || '元素打擊';
        const badgesText = Array.isArray(towerCfg.badges) && towerCfg.badges.length > 0
            ? towerCfg.badges.join(' · ')
            : styleText;
        const lineage = towerCfg.lineagePath || `${towerCfg.icon || '✨'} ${towerCfg.name || towerKey}`;
        return {
            title: `${towerCfg.icon || '✨'} ${towerCfg.name || towerKey}`,
            recipeText: `${towerCfg.icon || '✨'} <strong>${towerCfg.name || towerKey}</strong> <span class="num" style="font-size:12px;color:#B8C2BC;">｜${lineage}</span>`,
            lockedRecipeText: `<strong>？？？ · 未知世界樹節點</strong> <span class="num" style="font-size:12px;color:#B8C2BC;">｜${lineage}</span>`,
            desc: `射程 ${towerCfg.range || 2.5} 格｜攻速 ${sec}s｜單發傷害 ${dmgVal}｜特性：${badgesText}。`,
            unlockRule: towerCfg.isHybrid ? '於戰場中合成此共生節點後解鎖' : '於戰場中召喚或進化至此節點後解鎖',
            defaultUnlocked: tierNum <= 1 && !towerCfg.isHybrid,
            cardClass: 'codex-steam'
        };
    }

    /**
     * 為未在 codex_data.js 填寫文案的新增怪物自動生成預設圖鑑卡
     */
    function buildFallbackMonsterCard(monsterKey, mCfg) {
        const towersDict = (GameApp.data && GameApp.data.towers && GameApp.data.towers.TOWERS) || {};
        const wCfg = towersDict[mCfg.weakness];
        const weakName = wCfg ? `${wCfg.icon} ${wCfg.name}` : (mCfg.weakness || '無');
        const minW = Number(mCfg.minWave) || 1;
        return {
            title: `${mCfg.icon || '👾'} ${mCfg.name || monsterKey}`,
            subtitle: `弱點：${weakName}｜基礎血量 ${mCfg.baseHp || 70} · 護甲 ${mCfg.baseArmor || 0}`,
            desc: `移速倍率 ${mCfg.speedMult || 1.0}x，擊殺賞金 +${mCfg.baseReward || 10} 💰${mCfg.splitsOnDeath ? '（具備死亡分裂特性）' : ''}。`,
            unlockRule: `於戰場遭遇「${mCfg.name || monsterKey}」（Wave ${minW}+）後自動解鎖`,
            defaultUnlocked: minW <= 1
        };
    }

    GameApp.data = GameApp.data || {};
    GameApp.data.codex = {
        CODEX_CATEGORIES,
        CODEX_ENTRIES,
        ATTACK_STYLE_LABELS,
        buildFallbackTowerCard,
        buildFallbackMonsterCard
    };
})(window);
