class HauntedJumpscares {
  constructor(shadow, media, audio, canRun, reducedMotion, onStart, onEnd) {
    this.audio = audio;
    this.canRun = canRun;
    this.reducedMotion = reducedMotion;
    this.onStart = onStart;
    this.onEnd = onEnd;
    this.generation = 0;
    this.stage = document.createElement("div");
    this.stage.className = "jump-stage";
    this.stage.hidden = true;
    this.stage.setAttribute("aria-hidden", "true");
    this.canvas = document.createElement("canvas");
    this.canvas.className = "jump-image";
    this.tear = document.createElement("canvas");
    this.tear.className = "tear";
    const grain = document.createElement("div");
    grain.className = "grain";
    this.stage.append(this.canvas, this.tear, grain);
    shadow.append(this.stage);
    this.loading = Promise.all([["face", "jumpscare-face"], ["entity", "jumpscare-entity"]].map(async ([name, file]) => {
      const bytes = Uint8Array.from(atob(media[file]), char => char.charCodeAt(0));
      return [name, await createImageBitmap(new Blob([bytes], { type: "image/png" }))];
    })).then(entries => { this.bitmaps = Object.fromEntries(entries); }).catch(() => { this.failed = true; });
  }

  get state() {
    return { active: !this.stage.hidden, variant: this.stage.hidden ? null : this.stage.dataset.variant, ready: Boolean(this.bitmaps), nextIn: this.nextAt ? Math.max(0, this.nextAt - performance.now()) : null, sound: "B / String shock" };
  }

  start() {
    if (this.timer || !this.stage.hidden || !this.canRun() || this.reducedMotion.matches) return;
    if (globalThis.__HAUNTED_PREVIEW__ && !globalThis.__HAUNTED_LIVE_PREVIEW__) return;
    const delay = this.hasPlayed ? 25000 + Math.random() * 20000 : 12000 + Math.random() * 8000;
    this.nextAt = performance.now() + delay;
    this.timer = setTimeout(() => { this.timer = undefined; this.nextAt = undefined; this.trigger(); }, delay);
  }

  paint(bitmap, target, contain = false) {
    target.width = Math.min(innerWidth, 1920);
    target.height = Math.round(target.width * innerHeight / innerWidth);
    const factor = (contain ? Math.min(target.width / bitmap.width, target.height / bitmap.height) * .9 : Math.max(target.width / bitmap.width, target.height / bitmap.height));
    target.getContext("2d").drawImage(bitmap, (target.width - bitmap.width * factor) / 2, (target.height - bitmap.height * factor) / 2, bitmap.width * factor, bitmap.height * factor);
  }

  async trigger(variant) {
    if (!this.canRun() || (!variant && this.reducedMotion.matches)) return false;
    if (variant && !["face", "entity"].includes(variant)) return false;
    this.stop(false);
    const generation = this.generation;
    await this.loading;
    if (generation !== this.generation || !this.canRun() || this.failed) return false;
    variant ||= ["face", "entity"][Math.floor(Math.random() * 2)];
    this.paint(this.bitmaps[variant], this.canvas, variant === "eyes");
    if (variant === "face") this.paint(this.bitmaps.face, this.tear);
    this.stage.dataset.variant = variant;
    this.stage.hidden = false;
    this.hasPlayed = true;
    this.onStart();
    const cueDelay = variant === "entity" ? 1430 : 50;
    this.cue = setTimeout(() => { if (generation === this.generation && this.canRun()) this.audio.jump(); }, cueDelay);
    const length = Math.max(variant === "entity" ? 2450 : 1100, cueDelay + 1850);
    this.finish = setTimeout(() => { if (generation === this.generation) this.stop(true); }, length);
    return true;
  }

  stop(reschedule = false) {
    this.generation++;
    clearTimeout(this.timer);
    clearTimeout(this.cue);
    clearTimeout(this.finish);
    this.timer = undefined;
    this.nextAt = undefined;
    const wasActive = !this.stage.hidden;
    this.stage.hidden = true;
    delete this.stage.dataset.variant;
    this.audio.cancelJump();
    if (wasActive) this.onEnd();
    if (reschedule) this.start();
  }
}
