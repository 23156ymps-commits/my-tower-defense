/**
 * ============================================================================
 * 【檔案名稱】：core/audio.js
 * 【負責功能】：純原生 Web Audio API 程式合成音效引擎（零外部音檔、離線可執行）與靜音切換控制。
 * 【讀取資料】：讀取 config.js 的音量範圍設定，並動態讀取 modules/towers/tower_data.js 的攻擊樣式標籤。
 * 【常見修改入口】：
 *   1. 調整召喚、合成、擊殺音高與長度：修改 playSpawn()、playMerge()、playKill()。
 *   2. 調整各攻擊樣式開火音效：修改 playTowerShot() 內的頻率與波形參數。
 * ============================================================================
 */
(function (global) {
    'use strict';

    const GameApp = global.GameApp = global.GameApp || {};
    const CONFIG = GameApp.config || {};

    function loadMutedPref() {
        try {
            return localStorage.getItem(CONFIG.STORAGE_MUTE_KEY || 'merge_defense_muted') === 'true';
        } catch (_) {
            return false;
        }
    }

    function saveMutedPref(muted) {
        try {
            localStorage.setItem(CONFIG.STORAGE_MUTE_KEY || 'merge_defense_muted', muted ? 'true' : 'false');
        } catch (_) {
            // 受限瀏覽環境或隱私模式無聲忽略
        }
    }

    const SoundEngine = {
        ctx: null,
        isMuted: loadMutedPref(),
        lastGroupTime: {},
        onToggleCallback: null,

        setOnToggle(fn) {
            this.onToggleCallback = typeof fn === 'function' ? fn : null;
        },

        ensureContext() {
            if (this.isMuted) return null;
            if (typeof window === 'undefined') return null;
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) return null;
            if (!this.ctx) {
                try {
                    this.ctx = new AudioCtx();
                } catch (_) {
                    return null;
                }
            }
            if (this.ctx && this.ctx.state === 'suspended' && typeof this.ctx.resume === 'function') {
                this.ctx.resume().catch(() => { });
            }
            return this.ctx;
        },

        canPlayGroup(groupKey, minGapSec = 0.055) {
            if (!this.ctx) return false;
            const now = this.ctx.currentTime;
            const prev = this.lastGroupTime[groupKey] || 0;
            if (now - prev < minGapSec) return false;
            this.lastGroupTime[groupKey] = now;
            return true;
        },

        tone({ freq, freqEnd = null, type = 'sine', duration = 0.14, gain = 0.12, delay = 0 }) {
            const ctx = this.ensureContext();
            if (!ctx) return;

            const now = ctx.currentTime + delay;
            const minVol = CONFIG.SFX_VOLUME_MIN || 0.08;
            const maxVol = CONFIG.SFX_VOLUME_MAX || 0.18;
            const peakGain = Math.max(minVol, Math.min(maxVol, gain));
            const osc = ctx.createOscillator();
            const env = ctx.createGain();

            osc.type = type;
            osc.frequency.setValueAtTime(Math.max(40, freq), now);
            if (freqEnd !== null && freqEnd > 0) {
                osc.frequency.exponentialRampToValueAtTime(Math.max(40, freqEnd), now + duration);
            }

            env.gain.setValueAtTime(0.0001, now);
            env.gain.linearRampToValueAtTime(peakGain, now + 0.012);
            env.gain.exponentialRampToValueAtTime(0.0001, now + duration);

            osc.connect(env);
            env.connect(ctx.destination);
            osc.start(now);
            osc.stop(now + duration + 0.015);
        },

        playSpawn(tier = 1) {
            const base = tier >= 2 ? 523.25 : 440;
            this.tone({ freq: base, freqEnd: base * 1.12, type: 'triangle', duration: 0.09, gain: 0.11, delay: 0 });
            this.tone({ freq: base * 1.5, freqEnd: base * 1.55, type: 'sine', duration: 0.12, gain: 0.12, delay: 0.065 });
        },

        playMerge(tier = 2, isCrossElement = false) {
            const notes = tier >= 3 ? [523.25, 659.25, 783.99, 1046.5] : [440, 554.37, 659.25];
            if (isCrossElement) notes.push(tier >= 3 ? 1318.5 : 880);
            notes.forEach((f, idx) => {
                this.tone({ freq: f, type: isCrossElement ? 'triangle' : 'sine', duration: 0.16, gain: 0.12, delay: idx * 0.055 });
            });
        },

        /**
         * 標籤驅動砲塔射擊音效：自動讀取 tower_data.js 中的 attackStyle，新角色無須改此處即可發聲
         */
        playTowerShot(towerType) {
            const ctx = this.ensureContext();
            if (!ctx) return;

            const towersDict = GameApp.data && GameApp.data.towers && GameApp.data.towers.TOWERS;
            const towerCfg = towersDict && towersDict[towerType];
            const style = (towerCfg && towerCfg.attackStyle) || '';

            if (style === 'burst_armor_break' || style === 'aoe_mist' || towerType === 'fire' || towerType === 'steam') {
                if (!this.canPlayGroup('burst', 0.07)) return;
                this.tone({ freq: style === 'aoe_mist' ? 230 : 185, freqEnd: 62, type: 'triangle', duration: 0.13, gain: 0.14 });
            } else if (style === 'slow_control' || style === 'stun_pulse' || towerType === 'ice' || towerType === 'magnet') {
                if (!this.canPlayGroup('frost', 0.07)) return;
                this.tone({ freq: style === 'stun_pulse' ? 1050 : 1240, freqEnd: 1580, type: 'sine', duration: 0.10, gain: 0.09 });
            } else {
                if (!this.canPlayGroup('beam_bolt', 0.065)) return;
                this.tone({ freq: style === 'pierce_beam' ? 1480 : 1280, freqEnd: 420, type: 'sawtooth', duration: 0.075, gain: 0.085 });
            }
        },

        playKill() {
            const ctx = this.ensureContext();
            if (!ctx || !this.canPlayGroup('kill', 0.05)) return;
            this.tone({ freq: 620, freqEnd: 920, type: 'sine', duration: 0.07, gain: 0.09, delay: 0 });
            this.tone({ freq: 1175, freqEnd: 1480, type: 'triangle', duration: 0.09, gain: 0.10, delay: 0.045 });
        },

        playMagic(kind = 'entangle') {
            const chord = kind === 'frenzy'
                ? [523.25, 659.25, 783.99, 1046.5]
                : (kind === 'blessing' ? [440, 554.37, 659.25, 880] : [349.23, 440, 523.25, 698.46]);
            chord.forEach((f, idx) => {
                this.tone({ freq: f, freqEnd: f * 1.04, type: 'sine', duration: 0.24, gain: 0.11, delay: idx * 0.05 });
            });
        },

        playOutcome(kind) {
            if (kind === 'treeHit') {
                this.tone({ freq: 175, freqEnd: 95, type: 'sawtooth', duration: 0.22, gain: 0.16, delay: 0 });
            } else if (kind === 'victory') {
                [523.25, 659.25, 783.99, 1046.5].forEach((f, idx) => {
                    this.tone({ freq: f, type: 'triangle', duration: idx === 3 ? 0.36 : 0.16, gain: 0.15, delay: idx * 0.11 });
                });
            } else if (kind === 'gameover') {
                [392.0, 349.23, 311.13, 220.0].forEach((f, idx) => {
                    this.tone({ freq: f, freqEnd: f * 0.94, type: 'triangle', duration: 0.24, gain: 0.14, delay: idx * 0.14 });
                });
            }
        },

        playBossHorn() {
            if (!this.ensureContext()) return;
            if (!this.canPlayGroup('bossHorn', 0.4)) return;
            // 低沉戰鼓衝擊 + 古林銅角低鳴
            this.tone({ freq: 110, freqEnd: 52, type: 'triangle', duration: 0.28, gain: 0.17, delay: 0 });
            this.tone({ freq: 82, freqEnd: 46, type: 'sine', duration: 0.34, gain: 0.18, delay: 0.12 });
            this.tone({ freq: 146.83, freqEnd: 130.81, type: 'sawtooth', duration: 0.42, gain: 0.10, delay: 0.16 });
        },

        playAscendChord(tier = 4) {
            if (!this.ensureContext()) return;
            if (!this.canPlayGroup('ascendChord', 0.12)) return;
            const isTier5 = Number(tier) >= 5;
            const notes = isTier5
                ? [392.00, 493.88, 587.33, 783.99, 987.77]
                : [329.63, 440.00, 523.25, 659.25];
            notes.forEach((f, idx) => {
                this.tone({
                    freq: f,
                    freqEnd: f * 1.01,
                    type: idx === notes.length - 1 ? 'triangle' : 'sine',
                    duration: idx === notes.length - 1 ? 0.30 : 0.18,
                    gain: isTier5 ? 0.12 : 0.10,
                    delay: idx * 0.055
                });
            });
        },

        toggleMute() {
            this.isMuted = !this.isMuted;
            saveMutedPref(this.isMuted);
            if (!this.isMuted) {
                this.ensureContext();
                this.playSpawn(1);
            }
            if (this.onToggleCallback) {
                this.onToggleCallback(this.isMuted);
            }
        }
    };

    GameApp.core = GameApp.core || {};
    GameApp.core.audio = SoundEngine;
    GameApp.audio = SoundEngine;
    global.GameAudio = SoundEngine;
})(window);
