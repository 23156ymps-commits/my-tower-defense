(function (global) {
    'use strict';

    const { CONFIG } = global.GameConfig;

    function loadMutedPref() {
        try {
            return localStorage.getItem(CONFIG.STORAGE_MUTE_KEY) === 'true';
        } catch (err) {
            return false;
        }
    }

    function saveMutedPref(muted) {
        try {
            localStorage.setItem(CONFIG.STORAGE_MUTE_KEY, muted ? 'true' : 'false');
        } catch (err) {
            // 受限瀏覽環境或隱私模式忽略
        }
    }

    /**
     * 純原生 Web Audio API 程式合成音效引擎（零外部音檔、離線可用）
     */
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
                } catch (err) {
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
            const peakGain = Math.max(CONFIG.SFX_VOLUME_MIN, Math.min(CONFIG.SFX_VOLUME_MAX, gain));
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

        playTowerShot(towerType) {
            const ctx = this.ensureContext();
            if (!ctx) return;
            if (towerType === 'fire' || towerType === 'steam') {
                if (!this.canPlayGroup('fire', 0.07)) return;
                this.tone({ freq: towerType === 'steam' ? 230 : 185, freqEnd: 62, type: 'triangle', duration: 0.13, gain: 0.14 });
            } else if (towerType === 'ice' || towerType === 'magnet') {
                if (!this.canPlayGroup('ice', 0.07)) return;
                this.tone({ freq: towerType === 'magnet' ? 1050 : 1240, freqEnd: 1580, type: 'sine', duration: 0.10, gain: 0.09 });
            } else {
                if (!this.canPlayGroup('thunder', 0.065)) return;
                this.tone({ freq: towerType === 'plasma' ? 1480 : 1280, freqEnd: 420, type: 'sawtooth', duration: 0.075, gain: 0.085 });
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

    global.GameAudio = SoundEngine;
})(window);
