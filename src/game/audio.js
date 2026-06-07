function now(ctx) {
  return ctx.currentTime;
}

function safeConnect(node, destination) {
  try {
    node.connect(destination);
  } catch {
    // Fire-and-forget nodes can already be disposed on some browsers.
  }
}

function safeCancel(param, t) {
  try {
    param.cancelScheduledValues(t);
  } catch {
    // Older Web Audio implementations can be fussy about cancelled params.
  }
}

export class GameAudio {
  constructor({ volume = 0.58, sfxEnabled = true, musicEnabled = true, musicUrl = null } = {}) {
    this.ctx = null;
    this.master = null;
    this.limiter = null;
    this.sfxGain = null;
    this.musicGain = null;
    this.sfxEnabled = sfxEnabled;
    this.musicEnabled = musicEnabled;
    this.volume = volume;
    this.musicVolume = 0.46;
    this.last = new Map();
    this.musicTimer = null;
    this.musicStep = 0;
    this.nextMusicTime = 0;
    const baseUrl = (import.meta.env?.BASE_URL || '/').replace(/\/?$/, '/');
    this.musicUrl = musicUrl || `${baseUrl}audio/mushroom-dance.ogg`;
    this.kidsYayUrl = `${baseUrl}audio/kids-yay.mp3`;
    this.bgm = null;
    this.kidsYay = null;
    this.bgmRequested = false;
    this.bgmReady = false;
    this.bgmError = false;
    this.musicSuppressed = false;
  }

  async unlock({ allowMusic = true } = {}) {
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;

    if (AudioContextCtor && !this.ctx) {
      this.ctx = new AudioContextCtor();
      this.master = this.ctx.createGain();
      this.limiter = this.ctx.createDynamicsCompressor();
      this.sfxGain = this.ctx.createGain();
      this.musicGain = this.ctx.createGain();

      this.master.gain.value = this.volume;
      this.sfxGain.gain.value = this.sfxEnabled ? 1 : 0;
      this.musicGain.gain.value = 0;
      this.limiter.threshold.value = -8;
      this.limiter.knee.value = 18;
      this.limiter.ratio.value = 5;
      this.limiter.attack.value = 0.003;
      this.limiter.release.value = 0.18;

      this.sfxGain.connect(this.master);
      this.musicGain.connect(this.master);
      this.master.connect(this.limiter);
      this.limiter.connect(this.ctx.destination);
    }

    if (this.ctx?.state === 'suspended') {
      try { await this.ctx.resume(); } catch { /* ignore */ }
    }

    // Do not create/preload sampled reward audio during Start. On lower-end
    // phones, media setup can block the first game frame. Procedural SFX will
    // work immediately; kids-yay is created lazily only when a reward needs it.
    if (allowMusic && this.musicEnabled && !this.musicSuppressed) this.startMusic();
  }

  setSfxEnabled(enabled) {
    this.sfxEnabled = Boolean(enabled);
    if (!this.sfxGain || !this.ctx) return;
    const t = now(this.ctx);
    safeCancel(this.sfxGain.gain, t);
    this.sfxGain.gain.setTargetAtTime(this.sfxEnabled ? 1 : 0, t, 0.025);
  }

  setMusicEnabled(enabled) {
    this.musicEnabled = Boolean(enabled);

    if (!this.musicEnabled || this.musicSuppressed) {
      this.stopMusicTimer();
      if (this.bgm) {
        this.bgm.muted = true;
        this.bgm.pause();
        this.bgm.volume = 0;
      }
      return;
    }

    if (this.bgm) this.bgm.volume = this.musicVolume;
    this.startMusic();
  }

  setMusicSuppressed(suppressed) {
    this.musicSuppressed = Boolean(suppressed);
    if (this.musicSuppressed) {
      this.pauseMusic(0);
      return;
    }
    this.resumeMusic();
  }

  forceStopMusic() {
    this.stopMusicTimer();
    this.musicSuppressed = true;
    if (!this.bgm) return;
    try {
      this.bgm.pause();
      this.bgm.muted = true;
      this.bgm.volume = 0;
    } catch {
      // HTML audio is best-effort. Quiz and SFX remain playable.
    }
  }

  pauseMusic(fadeMs = 160) {
    this.stopMusicTimer();
    if (!this.bgm) return;
    const audio = this.bgm;
    const startVolume = audio.volume || 0;
    if (fadeMs <= 0 || startVolume <= 0.01) {
      audio.muted = true;
      audio.pause();
      audio.volume = 0;
      return;
    }
    const started = performance.now();
    const tick = () => {
      const t = Math.min(1, (performance.now() - started) / fadeMs);
      audio.volume = startVolume * (1 - t);
      if (t < 1 && !audio.paused) window.requestAnimationFrame(tick);
      else {
        audio.pause();
        audio.volume = 0;
      }
    };
    window.requestAnimationFrame(tick);
  }

  resumeMusic() {
    if (!this.musicEnabled || this.musicSuppressed) return;
    this.startMusic();
  }

  stopAll() {
    this.stopMusicTimer();
    if (this.bgm) {
      this.bgm.pause();
      this.bgm.src = '';
      this.bgm.load?.();
      this.bgm = null;
    }
    if (this.kidsYay) {
      this.kidsYay.pause();
      this.kidsYay.src = '';
      this.kidsYay.load?.();
      this.kidsYay = null;
    }
    if (this.ctx && this.ctx.state === 'running') {
      try { this.ctx.suspend(); } catch { /* ignore */ }
    }
  }

  stopMusicTimer() {
    if (this.musicTimer) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }

  _ensureBgm() {
    if (this.bgm || typeof window === 'undefined') return this.bgm;
    const audio = new Audio();
    audio.src = this.musicUrl;
    audio.loop = true;
    audio.preload = 'none';
    audio.volume = this.musicEnabled ? this.musicVolume : 0;
    audio.addEventListener('canplaythrough', () => { this.bgmReady = true; }, { once: true });
    audio.addEventListener('play', () => {
      if (this.musicSuppressed || !this.musicEnabled) {
        audio.muted = true;
        audio.pause();
        audio.volume = 0;
      }
    });
    audio.addEventListener('error', () => { this.bgmError = true; }, { once: true });
    this.bgm = audio;
    return this.bgm;
  }

  _ensureKidsYay() {
    if (this.kidsYay || typeof window === 'undefined') return this.kidsYay;
    const audio = new Audio();
    audio.src = this.kidsYayUrl;
    audio.loop = false;
    audio.preload = 'none';
    audio.volume = 0;
    this.kidsYay = audio;
    return this.kidsYay;
  }

  _cooldown(key, ms) {
    const t = performance.now();
    if ((this.last.get(key) || 0) + ms > t) return false;
    this.last.set(key, t);
    return true;
  }

  _bus(bus) {
    if (!this.ctx || !this.master || this.ctx.state !== 'running') return null;
    if (bus === 'music') {
      if (!this.musicEnabled || !this.musicGain) return null;
      return this.musicGain;
    }
    if (!this.sfxEnabled || !this.sfxGain) return null;
    return this.sfxGain;
  }

  _tone({ type = 'sine', frequency = 440, endFrequency = frequency, duration = 0.12, gain = 0.12, attack = 0.006, decay = 0.09, delay = 0, detune = 0, bus = 'sfx', at = null }) {
    const target = this._bus(bus);
    if (!target) return;
    const t0 = at ?? (now(this.ctx) + delay);
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(20, frequency), t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), t0 + Math.max(0.01, duration));
    osc.detune.value = detune;
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t0 + attack);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + duration + decay);
    safeConnect(osc, env);
    safeConnect(env, target);
    osc.start(t0);
    osc.stop(t0 + duration + decay + 0.04);
  }

  _noise({ duration = 0.18, gain = 0.08, frequency = 900, delay = 0, type = 'lowpass', bus = 'sfx', at = null } = {}) {
    const target = this._bus(bus);
    if (!target) return;
    const t0 = at ?? (now(this.ctx) + delay);
    const length = Math.max(1, Math.floor(this.ctx.sampleRate * duration));
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) {
      const fade = 1 - i / length;
      data[i] = (Math.random() * 2 - 1) * (0.28 + fade * 0.72);
    }
    const src = this.ctx.createBufferSource();
    const filter = this.ctx.createBiquadFilter();
    const env = this.ctx.createGain();
    src.buffer = buffer;
    filter.type = type;
    filter.frequency.setValueAtTime(frequency, t0);
    filter.Q.value = type === 'bandpass' ? 2.6 : 0.8;
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    safeConnect(src, filter);
    safeConnect(filter, env);
    safeConnect(env, target);
    src.start(t0);
    src.stop(t0 + duration + 0.03);
  }

  startMusic() {
    if (!this.musicEnabled || this.musicSuppressed || this.bgmError) return;
    const bgm = this._ensureBgm();
    if (!bgm) return;

    this.bgmRequested = true;
    if (this.musicSuppressed || !this.musicEnabled) {
      bgm.muted = true;
      bgm.pause();
      bgm.volume = 0;
      return;
    }

    bgm.muted = false;
    bgm.volume = this.musicVolume;

    // HTMLAudioElement streams the supplied OGG lazily. Gameplay never waits for this promise.
    const playPromise = bgm.play();
    if (playPromise?.then) {
      playPromise.then(() => {
        if (this.musicSuppressed || !this.musicEnabled) this.forceStopMusic();
      }).catch(() => {
        // Browser autoplay can still block playback until the next trusted tap/key press.
      });
    }
  }

  _musicScheduler() {
    if (!this.musicEnabled || !this.ctx || this.ctx.state !== 'running') return;
    const scheduleAhead = 0.48;
    const stepSeconds = 0.18;
    while (this.nextMusicTime < now(this.ctx) + scheduleAhead) {
      this._scheduleMusicStep(this.nextMusicTime, this.musicStep);
      this.nextMusicTime += stepSeconds;
      this.musicStep = (this.musicStep + 1) % 64;
    }
  }

  _scheduleMusicStep(t, step) {
    const scale = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25];
    const melodyPattern = [0, 2, 4, 2, 5, 4, 2, 0, 1, 3, 5, 6, 5, 3, 2, 0];
    const bassPattern = [0, 0, 5, 5, 3, 3, 4, 4];
    const beat = step % 4 === 0;
    const backBeat = step % 8 === 4;
    const melodyIndex = melodyPattern[step % melodyPattern.length];
    const melody = scale[melodyIndex];
    const bass = scale[bassPattern[Math.floor(step / 2) % bassPattern.length]] / 2;

    if (step % 2 === 0) {
      this._tone({ bus: 'music', at: t, type: 'triangle', frequency: melody, endFrequency: melody * 1.006, duration: beat ? 0.18 : 0.12, gain: beat ? 0.075 : 0.052, attack: 0.01, decay: 0.18 });
      this._tone({ bus: 'music', at: t + 0.012, type: 'sine', frequency: melody * 2, endFrequency: melody * 1.96, duration: 0.06, gain: 0.018, attack: 0.004, decay: 0.05 });
    }

    if (beat) {
      this._tone({ bus: 'music', at: t, type: 'sine', frequency: bass, endFrequency: bass * 0.995, duration: 0.42, gain: 0.075, attack: 0.018, decay: 0.34 });
      this._tone({ bus: 'music', at: t + 0.015, type: 'triangle', frequency: bass * 1.5, endFrequency: bass * 1.49, duration: 0.32, gain: 0.026, attack: 0.02, decay: 0.28 });
    }

    if (step % 4 === 2) {
      this._tone({ bus: 'music', at: t, type: 'triangle', frequency: melody * 1.5, endFrequency: melody * 1.49, duration: 0.11, gain: 0.032, attack: 0.008, decay: 0.12 });
    }

    if (beat) {
      this._noise({ bus: 'music', at: t, duration: 0.045, gain: 0.03, frequency: 1600, type: 'lowpass' });
    }
    if (backBeat) {
      this._noise({ bus: 'music', at: t, duration: 0.055, gain: 0.022, frequency: 3000, type: 'bandpass' });
    }
  }


  nearMiss() {
    if (!this._cooldown('near-miss', 650)) return;
    this._noise({ duration: 0.11, gain: 0.048, frequency: 2600, type: 'highpass' });
    this._tone({ type: 'triangle', frequency: 640, endFrequency: 980, duration: 0.08, gain: 0.038, attack: 0.004, decay: 0.055, delay: 0.015 });
    this._tone({ type: 'sine', frequency: 980, endFrequency: 760, duration: 0.09, gain: 0.03, attack: 0.004, decay: 0.055, delay: 0.08 });
  }

  jump() {
    if (!this._cooldown('jump', 55)) return;
    this._tone({ type: 'square', frequency: 380, endFrequency: 720, duration: 0.075, gain: 0.065, decay: 0.05 });
    this._tone({ type: 'sine', frequency: 740, endFrequency: 520, duration: 0.055, gain: 0.032, delay: 0.018, decay: 0.035 });
  }

  carHorn() {
    if (!this._cooldown('horn', 620)) return;
    // Short dual-tone car horn: two close square-wave notes, slight tremolo bite, fast attack.
    this._tone({ type: 'square', frequency: 372, endFrequency: 368, duration: 0.18, gain: 0.15, attack: 0.0015, decay: 0.035 });
    this._tone({ type: 'square', frequency: 468, endFrequency: 462, duration: 0.18, gain: 0.13, attack: 0.0015, decay: 0.035, delay: 0.002 });
    this._tone({ type: 'sawtooth', frequency: 186, endFrequency: 180, duration: 0.16, gain: 0.035, attack: 0.003, decay: 0.04 });
    this._noise({ duration: 0.038, gain: 0.018, frequency: 1800, type: 'bandpass', delay: 0.006 });
    this._tone({ type: 'square', frequency: 372, endFrequency: 366, duration: 0.09, gain: 0.09, attack: 0.0015, decay: 0.03, delay: 0.22 });
    this._tone({ type: 'square', frequency: 468, endFrequency: 460, duration: 0.09, gain: 0.075, attack: 0.0015, decay: 0.03, delay: 0.222 });
  }

  trainHorn() {
    if (!this._cooldown('train-horn', 1900)) return;
    this._tone({ type: 'sawtooth', frequency: 148, endFrequency: 132, duration: 1.06, gain: 0.105, attack: 0.055, decay: 0.42 });
    this._tone({ type: 'sawtooth', frequency: 185, endFrequency: 166, duration: 1.08, gain: 0.088, attack: 0.06, decay: 0.42, delay: 0.04 });
    this._tone({ type: 'triangle', frequency: 230, endFrequency: 214, duration: 0.94, gain: 0.06, attack: 0.06, decay: 0.36, delay: 0.08 });
  }

  trainPass(isBullet = false) {
    if (!this._cooldown(isBullet ? 'bullet' : 'train', isBullet ? 1150 : 1600)) return;
    this._noise({ duration: isBullet ? 0.68 : 0.84, gain: isBullet ? 0.15 : 0.11, frequency: isBullet ? 1900 : 760, type: isBullet ? 'highpass' : 'lowpass' });
    this._tone({ type: 'sawtooth', frequency: isBullet ? 190 : 92, endFrequency: isBullet ? 70 : 62, duration: isBullet ? 0.48 : 0.72, gain: isBullet ? 0.05 : 0.052, decay: 0.14 });
    if (!isBullet) this.trainHorn();
  }

  hit(reason = 'traffic') {
    if (!this._cooldown(`hit-${reason}`, 520)) return;
    if (reason === 'water') {
      this.splash();
      return;
    }
    this._noise({ duration: reason === 'train' ? 0.32 : 0.22, gain: reason === 'train' ? 0.17 : 0.13, frequency: reason === 'train' ? 520 : 880, type: 'lowpass' });
    this._tone({ type: 'sawtooth', frequency: reason === 'train' ? 92 : 160, endFrequency: 44, duration: 0.23, gain: reason === 'train' ? 0.1 : 0.08, decay: 0.16 });
    this._tone({ type: 'square', frequency: 55, endFrequency: 42, duration: 0.17, gain: 0.045, delay: 0.03, decay: 0.16 });
  }

  splash() {
    if (!this._cooldown('splash', 460)) return;
    this._noise({ duration: 0.12, gain: 0.22, frequency: 3400, type: 'bandpass' });
    this._noise({ duration: 0.52, gain: 0.13, frequency: 820, type: 'lowpass', delay: 0.035 });
    this._tone({ type: 'sine', frequency: 360, endFrequency: 82, duration: 0.24, gain: 0.058, delay: 0.02, decay: 0.16 });
    this._tone({ type: 'triangle', frequency: 760, endFrequency: 390, duration: 0.08, gain: 0.032, delay: 0.06, decay: 0.08 });
  }


  quizCorrect() {
    if (!this._cooldown('quiz-correct', 160)) return;
    this._tone({ type: 'sine', frequency: 523.25, endFrequency: 783.99, duration: 0.11, gain: 0.072, attack: 0.004, decay: 0.07 });
    this._tone({ type: 'triangle', frequency: 659.25, endFrequency: 1046.5, duration: 0.14, gain: 0.056, attack: 0.004, decay: 0.08, delay: 0.08 });
    this._tone({ type: 'sine', frequency: 1046.5, endFrequency: 1567.98, duration: 0.12, gain: 0.05, attack: 0.004, decay: 0.09, delay: 0.18 });
    this._noise({ duration: 0.11, gain: 0.034, frequency: 5200, type: 'highpass', delay: 0.035 });
  }

  quizWrong() {
    if (!this._cooldown('quiz-wrong', 190)) return;
    this._tone({ type: 'sawtooth', frequency: 220, endFrequency: 150, duration: 0.12, gain: 0.062, attack: 0.006, decay: 0.08 });
    this._tone({ type: 'triangle', frequency: 164, endFrequency: 116, duration: 0.16, gain: 0.052, attack: 0.006, decay: 0.1, delay: 0.08 });
    this._noise({ duration: 0.08, gain: 0.032, frequency: 900, type: 'bandpass', delay: 0.02 });
  }

  quizComplete(correctCount = 0) {
    if (!this._cooldown('quiz-complete', 700)) return;
    const strong = correctCount >= 4;
    this._tone({ type: 'triangle', frequency: 392, endFrequency: 523.25, duration: 0.13, gain: 0.055, decay: 0.07 });
    this._tone({ type: 'triangle', frequency: 523.25, endFrequency: 659.25, duration: 0.13, gain: 0.058, delay: 0.11, decay: 0.07 });
    this._tone({ type: 'triangle', frequency: 659.25, endFrequency: strong ? 1046.5 : 783.99, duration: 0.18, gain: 0.066, delay: 0.23, decay: 0.1 });
    this._noise({ duration: 0.18, gain: strong ? 0.042 : 0.028, frequency: 4600, type: 'highpass', delay: 0.18 });
  }

  kidsYayReward(stars = 3) {
    if (!this.sfxEnabled || !this._cooldown(`kids-yay-${stars}`, 1200)) return;
    const audio = this._ensureKidsYay();
    if (!audio) return;
    const volume = stars >= 3 ? 0.34 : stars >= 2 ? 0.2 : 0.16;
    try {
      audio.pause();
      audio.currentTime = 0;
      audio.volume = volume;
      const playPromise = audio.play();
      playPromise?.catch?.(() => {
        // Browser can block media until a trusted interaction; procedural reward tones still play.
      });
    } catch {
      // The game remains playable even if media playback is unavailable.
    }
  }

  rewardStar(index = 0) {
    const key = `reward-star-${index}`;
    if (!this._cooldown(key, 90)) return;
    const base = 523.25 * (1 + index * 0.125);
    this._tone({ type: 'sine', frequency: base, endFrequency: base * 1.7, duration: 0.12, gain: 0.06, attack: 0.006, decay: 0.08 });
    this._tone({ type: 'triangle', frequency: base * 1.5, endFrequency: base * 2.0, duration: 0.10, gain: 0.04, attack: 0.004, decay: 0.06, delay: 0.04 });
    this._noise({ duration: 0.1, gain: 0.03, frequency: 4200, type: 'highpass', delay: 0.02 });
  }

  rewardComplete() {
    if (!this._cooldown('reward-complete', 700)) return;
    this._tone({ type: 'triangle', frequency: 392, endFrequency: 587, duration: 0.16, gain: 0.055, decay: 0.08 });
    this._tone({ type: 'triangle', frequency: 523, endFrequency: 784, duration: 0.18, gain: 0.06, delay: 0.11, decay: 0.08 });
    this._tone({ type: 'sine', frequency: 784, endFrequency: 1174, duration: 0.22, gain: 0.07, delay: 0.24, decay: 0.12 });
  }
}
