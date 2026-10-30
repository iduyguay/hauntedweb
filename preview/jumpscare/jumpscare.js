const IMAGE_PATHS = {
  face: "../../assets/jumpscare-face.png",
  entity: "../../assets/jumpscare-entity.png"
};
const SOUND_PATHS = {
  sting: "../../assets/sound-audition/b-string-stab.wav"
};

class JumpAudition {
  constructor() {
    this.stage = document.getElementById("stage");
    this.visual = document.getElementById("visual");
    document.querySelector(".tear").style.backgroundImage = `url(${IMAGE_PATHS.face})`;
    this.status = document.getElementById("status");
    this.volume = .35;
    this.token = 0;
    this.sources = new Set();
    this.timers = new Set();
    this.buttons = [...document.querySelectorAll("[data-jump],[data-sound]")];
    this.buttons.forEach(button => { button.disabled = true; });
  }

  get state() {
    return { ready: this.ready, variant: this.stage.hidden ? null : this.stage.dataset.variant, sound: this.sound || null, audioPlaying: this.sources.size > 0, volume: this.volume, automatic: false };
  }

  async load() {
    this.context = new AudioContext();
    this.master = this.context.createGain();
    this.master.gain.value = 0;
    this.analyser = this.context.createAnalyser();
    this.analyser.fftSize = 256;
    const limiter = this.context.createDynamicsCompressor();
    limiter.threshold.value = -12;
    limiter.ratio.value = 4;
    this.master.connect(this.analyser);
    this.analyser.connect(limiter).connect(this.context.destination);
    const images = Object.values(IMAGE_PATHS).map(async src => {
      const image = new Image();
      image.src = src;
      await image.decode();
      return image;
    });
    this.buffers = Object.fromEntries(await Promise.all(Object.entries(SOUND_PATHS).map(async ([name, path]) => {
      const response = await fetch(path);
      if (!response.ok) throw new Error("Sound unavailable");
      return [name, await this.context.decodeAudioData(await response.arrayBuffer())];
    })));
    this.images = await Promise.all(images);
    this.ready = true;
    this.buttons.forEach(button => { button.disabled = false; });
    document.body.dataset.ready = "true";
    this.status.textContent = "Ready. Choose a scene or listen to a sound.";
  }

  later(callback, delay) {
    const timer = setTimeout(() => { this.timers.delete(timer); callback(); }, delay);
    this.timers.add(timer);
  }

  setVolume(value) {
    if (!Number.isFinite(value)) return;
    this.volume = Math.max(0, Math.min(.65, value));
    if (this.context && this.sources.size) this.master.gain.setTargetAtTime(this.volume, this.context.currentTime, .015);
  }

  playBuffer(name) {
    const source = this.context.createBufferSource();
    source.buffer = this.buffers[name];
    source.connect(this.master);
    this.sources.add(source);
    source.onended = () => { this.sources.delete(source); source.disconnect(); };
    this.master.gain.cancelScheduledValues(this.context.currentTime);
    this.master.gain.setValueAtTime(this.volume, this.context.currentTime);
    source.start();
  }

  async trigger(variant, requestedSound = "sting") {
    if (!this.ready) return;
    if (variant === "random") variant = ["face", "entity"][Math.floor(Math.random() * 2)];
    if (!Object.hasOwn(IMAGE_PATHS, variant)) return;
    const sound = requestedSound === "random" ? "sting" : requestedSound;
    if (!Object.hasOwn(SOUND_PATHS, sound)) return;
    this.stop(false);
    const token = this.token;
    await this.context.resume();
    if (token !== this.token || document.hidden) return;
    this.sound = sound;
    this.visual.src = IMAGE_PATHS[variant];
    try { await this.visual.decode(); }
    catch { if (token === this.token) this.stop(); return; }
    if (token !== this.token || document.hidden) return;
    this.stage.dataset.variant = variant;
    this.stage.hidden = false;
    this.status.textContent = `${variant === "entity" ? "Approaching presence" : variant === "face" ? "Distorted face" : "Eyes"} · Selected B / String shock`;
    const cueDelay = variant === "entity" ? 1430 : 50;
    const duration = Math.max(variant === "entity" ? 2450 : 1100, cueDelay + this.buffers.sting.duration * 1000 + 50);
    this.later(() => { if (token === this.token) this.playBuffer(sound); }, cueDelay);
    this.later(() => { if (token === this.token) this.stop(); }, duration);
  }

  async listen(sound) {
    if (!this.ready || !Object.hasOwn(SOUND_PATHS, sound)) return;
    this.stop(false);
    const token = this.token;
    await this.context.resume();
    if (token !== this.token || document.hidden) return;
    this.sound = sound;
    this.status.textContent = "Listening: selected B / String shock";
    this.playBuffer(sound);
    this.later(() => { if (token === this.token) this.stop(); }, this.buffers[sound].duration * 1000 + 70);
  }

  stop(announce = true) {
    this.token++;
    for (const timer of this.timers) clearTimeout(timer);
    this.timers.clear();
    if (this.context) {
      this.master.gain.cancelScheduledValues(this.context.currentTime);
      this.master.gain.setValueAtTime(0, this.context.currentTime);
    }
    for (const source of this.sources) { try { source.stop(); } catch {} source.disconnect(); }
    this.sources.clear();
    this.stage.hidden = true;
    this.visual.removeAttribute("src");
    delete this.stage.dataset.variant;
    this.sound = null;
    if (announce && this.ready) this.status.textContent = "Ready. Choose a scene or listen to a sound.";
  }
}

const audition = new JumpAudition();
globalThis.jumpAudition = audition;
audition.load().catch(() => { document.getElementById("status").textContent = "Could not load the audition. Reload this page to retry."; });
for (const button of document.querySelectorAll("[data-jump]")) button.addEventListener("click", () => audition.trigger(button.dataset.jump, document.getElementById("sound").value));
for (const button of document.querySelectorAll("[data-sound]")) button.addEventListener("click", () => audition.listen(button.dataset.sound));
document.getElementById("stop").addEventListener("click", () => audition.stop());
document.getElementById("volume").addEventListener("input", event => {
  const value = Number(event.target.value);
  audition.setVolume(value / 100);
  document.getElementById("volume-value").textContent = `${value}%`;
});
document.addEventListener("keydown", event => { if (event.key === "Escape") audition.stop(); });
document.addEventListener("visibilitychange", () => { if (document.hidden) audition.stop(); });
addEventListener("pagehide", () => audition.stop(false));
