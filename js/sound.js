/**
 * Sound Manager for Pixel Shooting Range
 * Synthesizes retro 16-bit gunshot sounds using Web Audio API
 */

const SoundManager = {
    ctx: null,
    muted: false,

    init() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    },

    _loadMutedState() {
        this.muted = sessionStorage.getItem(STORAGE_KEYS.SOUND_MUTED) === 'true';
        return this.muted;
    },

    toggle() {
        this.muted = !this.muted;
        if (this.muted) {
            sessionStorage.setItem(STORAGE_KEYS.SOUND_MUTED, 'true');
        } else {
            sessionStorage.removeItem(STORAGE_KEYS.SOUND_MUTED);
        }
        return this.muted;
    },

    isMuted() {
        return this.muted;
    },

    playGunshot() {
        if (this.muted) return;
        
        if (!this.ctx) this.init();
        if (this.ctx.state === 'suspended') this.ctx.resume();

        this._playNoiseBurst();
        this._playImpact();
    },

    _playNoiseBurst() {
        const duration = 0.08;
        const sampleRate = this.ctx.sampleRate;
        const bufferSize = sampleRate * duration;
        const buffer = this.ctx.createBuffer(1, bufferSize, sampleRate);
        const data = buffer.getChannelData(0);

        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noiseSource = this.ctx.createBufferSource();
        noiseSource.buffer = buffer;

        const noiseGain = this.ctx.createGain();
        const now = this.ctx.currentTime;

        noiseGain.gain.setValueAtTime(0.3, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, now + duration);

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = 1000;

        noiseSource.connect(filter);
        filter.connect(noiseGain);
        noiseGain.connect(this.ctx.destination);

        noiseSource.start(now);
        noiseSource.stop(now + duration);
    },

    _playImpact() {
        const duration = 0.05;
        const now = this.ctx.currentTime;

        const oscillator = this.ctx.createOscillator();
        oscillator.type = 'square';
        oscillator.frequency.setValueAtTime(150, now);
        oscillator.frequency.exponentialRampToValueAtTime(50, now + duration);

        const gainNode = this.ctx.createGain();
        gainNode.gain.setValueAtTime(0.25, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + duration);

        oscillator.connect(gainNode);
        gainNode.connect(this.ctx.destination);

        oscillator.start(now);
        oscillator.stop(now + duration);
    }
};
