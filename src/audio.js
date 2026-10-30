class HauntedAudio {
  constructor(data, canPlay, onChange) {
    this.data = data;
    this.canPlay = canPlay;
    this.onChange = onChange;
    this.enabled = true;
    this.volume = .4;
    this.unlocked = false;
    this.sources = new Set();
    this.generation = 0;
    this.starting = false;
    this.lastAccent = -Infinity;
    this.accentUntil = 0;
  }

  get state() {
    const playing = Boolean(this.primary && this.context?.state === "running" && this.enabled && this.canPlay());
    let signalLevel = 0;
    if (playing && this.analyser) {
      const samples = new Float32Array(this.analyser.fftSize);
      this.analyser.getFloatTimeDomainData(samples);
      signalLevel = Math.sqrt(samples.reduce((sum, value) => sum + value * value, 0) / samples.length);
    }
    return {
      signalLevel,
      voiceActive: Boolean(this.voiceActive),
      jumpPlaying: Boolean(this.jumpSource),
      musicGain: this.piano?.gain.value ?? 0,
      lastGlassSoundAt: this.lastGlassSoundAt ?? null,
      enabled: this.enabled,
      volume: this.volume,
      playing,
      accentPlaying: playing && this.context.currentTime < this.accentUntil,
      takeoverPlaying: playing && this.context.currentTime < (this.takeoverUntil || 0),
      contextState: this.context?.state || "not-started",
      status: !this.enabled ? "Sound off" : !this.canPlay() ? "Sound paused" : playing ? "Piano on · Event layer ready" : this.error || "Browser waiting for page interaction"
    };
  }

  attemptAutoplay() {
    this.unlocked = true;
    this.start();
  }

  async unlock() {
    this.unlocked = true;
    await this.start();
  }

  async start() {
    if (!this.unlocked || !this.enabled || !this.canPlay()) return;
    let revision;
    try {
      if (!this.context) {
        this.context = new AudioContext();
        this.master = this.context.createGain();
        this.master.gain.value = 0;
        this.piano = this.context.createGain();
        this.piano.gain.value = .9;
        this.piano.connect(this.master);
        this.pressure = this.context.createGain();
        this.pressure.connect(this.master);
        const limiter = this.context.createDynamicsCompressor();
        limiter.threshold.value = -12;
        limiter.ratio.value = 4;
        limiter.attack.value = .01;
        limiter.release.value = .2;
        this.analyser = this.context.createAnalyser();
        this.analyser.fftSize = 256;
        this.master.connect(this.analyser);
        this.analyser.connect(limiter);
        limiter.connect(this.context.destination);
      }
      const resumed = this.context.resume();
      resumed.catch(() => {});
      if (this.primary || this.starting) return;
      this.starting = true;
      revision = ++this.generation;
      await resumed;
      if (!this.loading) {
        this.loading = Promise.all(["piano", "pressure", "jump"].map(async name => {
          const bytes = Uint8Array.from(atob(this.data[name]), character => character.charCodeAt(0));
          return this.context.decodeAudioData(bytes.buffer);
        }));
      }
      this.buffers = await this.loading;
      if (revision !== this.generation || !this.enabled || !this.canPlay() || this.context.state !== "running") return;
      const source = this.context.createBufferSource();
      source.buffer = this.buffers[0];
      source.loop = true;
      source.connect(this.piano);
      this.sources.add(source);
      this.primary = source;
      source.onended = () => this.sources.delete(source);
      source.start();
      this.master.gain.setTargetAtTime(this.volume, this.context.currentTime, .15);
      this.error = "";
    } catch {
      this.error = "Browser waiting for page interaction";
    } finally {
      if (revision === this.generation) this.starting = false;
      this.onChange();
    }
  }

  stop() {
    this.cancelJump();
    this.generation++;
    this.starting = false;
    this.lastAccent = -Infinity;
    this.accentUntil = 0;
    this.takeoverUntil = 0;
    if (this.context) {
      this.master.gain.cancelScheduledValues(this.context.currentTime);
      this.master.gain.setValueAtTime(0, this.context.currentTime);
      this.piano.gain.cancelScheduledValues(this.context.currentTime);
      this.piano.gain.setValueAtTime(.9, this.context.currentTime);
      for (const source of this.sources) {
        try { source.stop(); } catch {}
        source.disconnect();
      }
      this.context.suspend().catch(() => {});
    }
    this.sources.clear();
    this.primary = undefined;
    this.onChange();
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    if (enabled) this.start();
    else this.stop();
    this.onChange();
  }

  setVolume(volume) {
    if (!Number.isFinite(volume)) return;
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.context && this.primary) this.master.gain.setTargetAtTime(this.volume, this.context.currentTime, .06);
    this.onChange();
  }

  voiceActivity(active) {
    this.voiceActive = active;
    if (!this.context || this.jumpSource) return;
    const now = this.context.currentTime;
    this.piano.gain.cancelScheduledValues(now);
    this.piano.gain.setTargetAtTime(active ? .35 : .9, now, .2);
    this.pressure.gain.setTargetAtTime(active ? .4 : 1, now, .15);
  }

  jump() {
    if (!this.state.playing || !this.buffers?.[2]) return;
    this.cancelJump();
    const now = this.context.currentTime;
    this.piano.gain.cancelScheduledValues(now);
    this.pressure.gain.cancelScheduledValues(now);
    this.piano.gain.setValueAtTime(.18, now);
    this.pressure.gain.setValueAtTime(0, now);
    const source = this.context.createBufferSource();
    source.buffer = this.buffers[2];
    source.connect(this.master);
    this.jumpSource = source;
    this.sources.add(source);
    source.onended = () => { this.sources.delete(source); source.disconnect(); if (this.jumpSource === source) { this.jumpSource = undefined; this.restoreBed(); } };
    source.start();
  }

  restoreBed() {
    if (!this.context) return;
    const now = this.context.currentTime;
    this.piano.gain.setTargetAtTime(this.voiceActive ? .35 : .9, now, .12);
    this.pressure.gain.setTargetAtTime(this.voiceActive ? .4 : 1, now, .12);
  }

  cancelJump() {
    const source = this.jumpSource;
    if (!source) return;
    this.jumpSource = undefined;
    try { source.stop(); } catch {}
    source.disconnect();
    this.sources.delete(source);
    this.restoreBed();
  }

  takeover() {
    if (this.jumpSource) return;
    if (!this.enabled || !this.canPlay() || this.context?.state !== "running") return;
    const now = this.context.currentTime;
    if (now < (this.takeoverUntil || 0)) return;
    this.takeoverUntil = now + 4;
    const buffer = this.context.createBuffer(1, this.context.sampleRate * 4, this.context.sampleRate);
    const samples = buffer.getChannelData(0);
    for (let i = 0; i < samples.length; i++) {
      const t = i / this.context.sampleRate;
      samples[i] = (Math.random() * 2 - 1) * (.12 + .12 * Math.sin(t * 41)) + Math.sin(t * Math.PI * 2 * (48 - t * 5)) * .3;
    }
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    const filter = this.context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(4200, now);
    filter.frequency.exponentialRampToValueAtTime(180, now + 3.5);
    const gain = this.context.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(.55, now + 1.5);
    gain.gain.linearRampToValueAtTime(.35, now + 3);
    gain.gain.linearRampToValueAtTime(0, now + 4);
    source.connect(filter); filter.connect(gain); gain.connect(this.master);
    this.sources.add(source);
    source.onended = () => { this.sources.delete(source); source.disconnect(); filter.disconnect(); gain.disconnect(); };
    source.start(now);
  }

  crack() {
    if (this.jumpSource) return;
    if (!this.enabled || !this.canPlay() || this.context?.state !== "running") return;
    const now = this.context.currentTime;
    const buffer = this.context.createBuffer(1, Math.floor(this.context.sampleRate * .19), this.context.sampleRate);
    const samples = buffer.getChannelData(0);
    for (let index = 0; index < samples.length; index++) {
      const t = index / this.context.sampleRate;
      samples[index] = (Math.random() * 2 - 1) * Math.exp(-t * 37) * (t < .012 ? 1 : .45);
    }
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    const filter = this.context.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = 1700;
    const gain = this.context.createGain();
    gain.gain.value = .65;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    this.sources.add(source);
    source.onended = () => { this.sources.delete(source); source.disconnect(); filter.disconnect(); gain.disconnect(); };
    source.start(now);
    this.lastGlassSoundAt = performance.now();
  }

  accent(effect) {
    if (this.jumpSource) return;
    if (!["watchers", "apparition", "blackout", "shadow", "cracks", "tracking", "possess", "refusal"].includes(effect) || !this.state.playing || !this.buffers) return;
    const now = this.context.currentTime;
    if (now - this.lastAccent < 5.5) return;
    this.lastAccent = now;
    this.accentUntil = now + 3.8;
    const source = this.context.createBufferSource();
    source.buffer = this.buffers[1];
    const gain = this.context.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(.55, now + .3);
    gain.gain.setValueAtTime(.55, now + 2.4);
    gain.gain.linearRampToValueAtTime(0, now + 3.7);
    source.connect(gain);
    gain.connect(this.pressure);
    this.sources.add(source);
    source.onended = () => {
      this.sources.delete(source);
      source.disconnect();
      gain.disconnect();
    };
    this.piano.gain.cancelScheduledValues(now);
    this.piano.gain.setTargetAtTime(this.voiceActive ? .35 : .6, now, .15);
    this.piano.gain.setTargetAtTime(this.voiceActive ? .35 : .9, now + 3.6, .3);
    source.start(now);
    source.stop(now + 3.8);
    this.onChange();
  }
}
