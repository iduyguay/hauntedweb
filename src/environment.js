class HauntedEnvironment {
  constructor(shadow, reducedMotion, onBurst) {
    this.shadow = shadow;
    this.onBurst = onBurst;
    this.reducedMotion = reducedMotion;
    this.overrides = new Map();
    this.bursts = 0;
    this.sheet = new CSSStyleSheet();
    this.sheet.replaceSync(HAUNTED_PAGE_CSS);
  }

  start() {
    if (this.active) return;
    this.active = true;
    this.priorDark = document.documentElement.getAttribute("data-haunted-dark");
    this.priorTV = document.documentElement.getAttribute("data-haunted-tv");
    this.priorCurse = document.documentElement.getAttribute("data-haunted-curse");
    this.darkTimer = setTimeout(() => {
      if (!this.active) return;
      document.documentElement.setAttribute("data-haunted-dark", "");
      this.forceInline();
    }, 80);
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, this.sheet];
    this.layer = document.createElement("div");
    this.layer.className = "crt-atmosphere";
    this.layer.setAttribute("aria-hidden", "true");
    this.canvas = document.createElement("canvas");
    this.canvas.width = 240;
    this.canvas.height = 135;
    this.layer.append(this.canvas);
    const roll = document.createElement("div");
    roll.className = "crt-roll";
    this.layer.append(roll);
    this.shadow.prepend(this.layer);
    this.infection = document.createElement("div");
    this.infection.className = "autonomous-infection";
    for (let index = 0; index < 32; index++) {
      const band = document.createElement("i");
      band.style.setProperty("--infection-delay", `${Math.random() * 1.8}s`);
      band.style.setProperty("--infection-width", `${20 + Math.random() * 65}%`);
      this.infection.append(band);
    }
    this.layer.append(this.infection);
    this.infectionTimer = setTimeout(() => this.infect(), 350);
    this.observer = new MutationObserver(() => {
      if (this.scanTimer) return;
      this.scanTimer = setTimeout(() => { this.scanTimer = undefined; this.forceInline(); }, 600);
    });
    this.observer.observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ["style"] });
    const context = this.canvas.getContext("2d");
    const image = context.createImageData(240, 135);
    let previous = 0;
    const render = now => {
      if (!this.active) return;
      if (!this.reducedMotion.matches && now - previous > 100) {
        previous = now;
        for (let index = 0; index < image.data.length; index += 4) {
          const value = Math.random() * 130;
          image.data[index] = image.data[index + 1] = image.data[index + 2] = value;
          image.data[index + 3] = 255;
        }
        context.putImageData(image, 0, 0);
      }
      this.frame = requestAnimationFrame(render);
    };
    this.frame = requestAnimationFrame(render);
    this.timer = setInterval(() => this.burst(), 6000);
  }

  infect() {
    if (!this.active || document.hidden) return;
    this.infection.classList.remove("infecting");
    void this.infection.offsetWidth;
    this.infection.classList.add("infecting");
    this.onBurst?.("dropout");
  }

  forceInline() {
    if (!this.active) return;
    for (const element of [...document.querySelectorAll("body,[style]")].slice(0, 700)) {
      if (element.id === "haunted-web-root" || element.closest("[data-haunted-ignore]")) continue;
      const style = getComputedStyle(element);
      const background = style.backgroundColor.match(/[\d.]+/g)?.map(Number);
      const text = style.color.match(/[\d.]+/g)?.map(Number);
      for (const [property, needed, value] of [["background-color", background && (background[3] ?? 1) > .5 && Math.max(...background.slice(0, 3)) > 95, "rgb(8, 8, 7)"], ["color", text && Math.max(...text.slice(0, 3)) < 45, "rgb(168, 164, 164)"]]) {
        if (!needed) continue;
        let record = this.overrides.get(element);
        if (!record) { record = {}; this.overrides.set(element, record); }
        if (element.style.getPropertyValue(property) !== record[property]?.applied) record[property] = { original: element.style.getPropertyValue(property), priority: element.style.getPropertyPriority(property), applied: value };
        if (element.style.getPropertyValue(property) !== value || element.style.getPropertyPriority(property) !== "important") element.style.setProperty(property, value, "important");
      }
    }
  }

  burst() {
    if (!this.active || this.reducedMotion.matches) return;
    this.bursts++;
    if (this.bursts % 2 === 0) this.infect();
    this.layer.dataset.burst = this.bursts % 3 === 0 ? "dropout" : "tracking";
    this.onBurst?.(this.layer.dataset.burst);
    document.documentElement.setAttribute("data-haunted-tv", "");
    clearTimeout(this.burstTimer);
    this.burstTimer = setTimeout(() => {
      if (!this.active) return;
      delete this.layer.dataset.burst;
      document.documentElement.removeAttribute("data-haunted-tv");
    }, 3400);
  }

  curse(kind) {
    if (!this.active || !["tilt", "inkbleed", "image-decay"].includes(kind)) return;
    this.curseKind = kind;
    document.documentElement.setAttribute("data-haunted-curse", kind);
  }

  clearCurse() {
    if (!this.curseKind) return;
    if (document.documentElement.getAttribute("data-haunted-curse") === this.curseKind) {
      if (this.priorCurse === null) document.documentElement.removeAttribute("data-haunted-curse");
      else document.documentElement.setAttribute("data-haunted-curse", this.priorCurse);
    }
    this.curseKind = undefined;
  }

  stop() {
    if (!this.active) return;
    this.active = false;
    this.clearCurse();
    clearTimeout(this.darkTimer);
    clearTimeout(this.infectionTimer);
    this.observer.disconnect();
    clearTimeout(this.scanTimer);
    this.scanTimer = undefined;
    clearTimeout(this.burstTimer);
    clearInterval(this.timer);
    cancelAnimationFrame(this.frame);
    this.layer.remove();
    document.adoptedStyleSheets = document.adoptedStyleSheets.filter(sheet => sheet !== this.sheet);
    for (const [element, properties] of this.overrides) for (const [property, record] of Object.entries(properties)) {
      if (element.style.getPropertyValue(property) !== record.applied) continue;
      if (record.original) element.style.setProperty(property, record.original, record.priority);
      else element.style.removeProperty(property);
    }
    this.overrides.clear();
    for (const [attribute, prior] of [["data-haunted-dark", this.priorDark], ["data-haunted-tv", this.priorTV]]) {
      if (prior === null) document.documentElement.removeAttribute(attribute);
      else document.documentElement.setAttribute(attribute, prior);
    }
  }
}
