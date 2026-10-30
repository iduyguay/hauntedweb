(() => {
  if (document.documentElement.hasAttribute("data-haunted-preview") && !globalThis.__HAUNTED_PREVIEW__) return;
  if (globalThis.__hauntedWeb) return;
  globalThis.__hauntedWeb = true;
  const host = document.createElement("div");
  host.id = "haunted-web-root";
  host.style.cssText = "all:initial!important;display:block!important;position:fixed!important;inset:0!important;pointer-events:none!important;z-index:2147483647!important;";
  const shadow = host.attachShadow({ mode: "closed" });
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(HAUNTED_CSS);
  shadow.adoptedStyleSheets = [sheet];
  const badge = document.createElement("button");
  badge.className = "curse-badge";
  badge.textContent = "WAKING THE SPIRIT · ESC TO PAUSE";
  badge.title = "Pause Haunted Web and restore the page";
  shadow.append(badge);
  const soundControl = document.createElement("button");
  soundControl.className = "sound-control";
  soundControl.type = "button";
  soundControl.textContent = "START SOUND";
  shadow.append(soundControl);
  document.documentElement.append(host);
  const effects = ["watchers", "apparition", "scramble", "footprints", "whisper", "drift", "fracture", "redact", "wallwriting", "tracking", "cracks", "shadow", "blackout", "infestation", "tilt", "inkbleed", "image-decay"];
  const excluded = 'input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"],[aria-live],[data-haunted-ignore],script,style,noscript,svg';
  const sensitive = /password|passwd|secret|token|credit|card|cvc|cvv|iban|billing|payment|one.?time|otp|verification|email|phone|address|username|login/i;
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const records = new Map();
  const fields = new Map();
  const inputTimers = new Map();
  const transient = new Set();
  const animations = new Set();
  const composing = new WeakSet();
  let enabled = true;
  let epoch = 0;
  let timer;
  let scene;
  let history = [];
  let conversation = [];
  let dialogueRevision = 0;
  let planning = false;
  let queuedChat = false;
  let crossingTimer;
  let crossingInterval;
  let remaining = [...effects];
  let lastTarget;
  let url = location.href;
  let status = "Waiting for SIGNAL";
  let whisper = "";
  let internalInput = false;
  let inputCooldown = 0;
  let clickCooldown = 0;
  let blocked;
  let ambientTimer;
  let glassTimer;
  let watcherTimer;
  let watcherFrame;
  let ambientBeat = 0;
  let titleRecord;
  let textPulseTimer;
  const textures = new Map();
  for (const [name, data] of Object.entries(HAUNTED_FONTS)) {
    const bytes = Uint8Array.from(atob(data), character => character.charCodeAt(0));
    new FontFace(name, bytes).load().then(font => document.fonts.add(font)).catch(() => {});
  }
  function texture(name) {
    if (!textures.has(name)) {
      const bytes = Uint8Array.from(atob(HAUNTED_MEDIA[name]), character => character.charCodeAt(0));
      textures.set(name, createImageBitmap(new Blob([bytes], { type: "image/png" })));
    }
    return textures.get(name);
  }
  function textured(node, name, width, height) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.revealedAt = performance.now();
    node.append(canvas);
    texture(name).then(bitmap => {
      if (!node.isConnected) return;
      canvas.getContext("2d").drawImage(bitmap, 0, 0, width, height);
      node.dataset.ready = "true";
      canvas.bitmap = bitmap;
    }).catch(() => { node.remove(); });
    return canvas;
  }
  let lastMessageAt = 0;
  let pointer = { x: innerWidth / 2, y: innerHeight / 2 };
  const soundtrack = new HauntedAudio(HAUNTED_AUDIO, () => enabled && !document.hidden, updateSoundControl);
  const jumpscares = new HauntedJumpscares(shadow, HAUNTED_MEDIA, soundtrack, () => enabled && !document.hidden, reducedMotion, () => narrator.stop(), () => narrator.flush());
  const environment = new HauntedEnvironment(shadow, reducedMotion, kind => kind === "dropout" ? soundtrack.takeover() : soundtrack.accent("tracking"));
  const narrator = new HauntedNarrator(() => enabled && !document.hidden && soundtrack.enabled && !jumpscares.state.active, () => soundtrack.volume, active => soundtrack.voiceActivity(active));
  const dialogue = document.createElement("section");
  dialogue.className = "presence-dialogue";
  dialogue.setAttribute("data-haunted-ui", "");
  const heading = document.createElement("div");
  heading.className = "presence-heading";
  heading.textContent = "THE SIGNAL IS LISTENING";
  const transcript = document.createElement("div");
  transcript.className = "presence-transcript";
  transcript.setAttribute("role", "log");
  transcript.setAttribute("aria-live", "polite");
  const thinking = document.createElement("p");
  thinking.className = "presence-status";
  thinking.textContent = "Waiting for SIGNAL…";
  const replyForm = document.createElement("form");
  replyForm.className = "presence-reply";
  const reply = document.createElement("input");
  reply.type = "text";
  reply.maxLength = 400;
  reply.autocomplete = "off";
  reply.placeholder = "Answer the presence…";
  reply.setAttribute("aria-label", "Your reply to the presence");
  const send = document.createElement("button");
  send.type = "submit";
  send.textContent = "SEND";
  replyForm.append(reply, send);
  dialogue.append(heading, transcript, thinking, replyForm);
  shadow.append(dialogue);
  const permanentScars = document.createElement("div");
  permanentScars.className = "permanent-scars";
  permanentScars.setAttribute("aria-hidden", "true");
  shadow.append(permanentScars);
  const openingOmen = document.createElement("div");
  openingOmen.className = "opening-omen";
  lettering(openingOmen, "IT’S WATCHING YOU");
  shadow.append(openingOmen);

  function addLine(role, text) {
    const line = document.createElement("p");
    line.className = `presence-line ${role}`;
    const label = document.createElement("span");
    label.textContent = role === "user" ? "YOU / " : "SIGNAL / ";
    line.append(label, document.createTextNode(text));
    transcript.append(line);
    while (transcript.children.length > 8) transcript.firstChild.remove();
    transcript.scrollTop = transcript.scrollHeight;
  }

  replyForm.addEventListener("submit", event => {
    event.preventDefault();
    event.stopImmediatePropagation();
    const text = reply.value.trim().slice(0, 400);
    if (!text || !enabled) return;
    reply.value = "";
    conversation.push({ role: "user", content: text });
    conversation = conversation.slice(-12);
    dialogueRevision++;
    queuedChat = true;
    narrator.stop();
    clearTimeout(timer);
    addLine("user", text);
    thinking.textContent = "It is answering you…";
    if (planning) chrome.runtime.sendMessage({ type: "HAUNT_CANCEL" }).catch(() => {});
    else schedule(0);
  });

  function updateSoundControl() {
    const sound = soundtrack.state;
    soundControl.textContent = sound.enabled ? "MUTE SOUND" : "SOUND OFF";
    soundControl.title = sound.status;
    soundControl.setAttribute("aria-label", sound.playing ? "Mute the haunting soundtrack" : "Start the haunting soundtrack");
    soundControl.setAttribute("aria-pressed", String(sound.enabled && sound.playing));
    soundControl.hidden = !enabled;
  }

  function wakeSound(event) {
    if (!event.isTrusted || event.key === "Escape" || event.composedPath().includes(soundControl) || event.composedPath().includes(badge)) return;
    if (!enabled || !soundtrack.enabled || document.hidden) return;
    soundtrack.unlock();
    narrator.flush();
  }
  addEventListener("pointerdown", wakeSound, { capture: true, passive: true });
  addEventListener("keydown", wakeSound, { capture: true });
  soundControl.addEventListener("click", async () => {
    if (soundtrack.enabled) { soundtrack.setEnabled(false); narrator.stop(); }
    else {
      soundtrack.setEnabled(true);
      await soundtrack.unlock();
    }
  });

  function elementFrom(event) {
    return event.composedPath().find(node => node instanceof Element);
  }

  function protectedElement(element) {
    if (!element || element.closest('[data-haunted-ignore], [data-haunted-ui]')) return true;
    const scope = element.closest("form") || element;
    if (scope.querySelector('input[type="password"],input[autocomplete^="cc-"],input[autocomplete="one-time-code"]')) return true;
    let identity = [element.id, element.getAttribute("name"), element.getAttribute("autocomplete"), element.getAttribute("aria-label"), element.getAttribute("placeholder")].join(" ");
    if (element instanceof HTMLInputElement && element.type === "url") identity = identity.replace(/address/ig, "");
    return sensitive.test(identity);
  }

  function visible(element) {
    const rect = element.getBoundingClientRect();
    if (rect.width < 20 || rect.height < 10 || rect.top > innerHeight - 10 || rect.bottom < 10 || rect.left > innerWidth - 10 || rect.right < 10) return false;
    const style = getComputedStyle(element);
    return style.visibility === "visible" && style.display !== "none" && Number(style.opacity) > 0;
  }

  function pageExcerpt(element) {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let text = "", node;
    while ((node = walker.nextNode()) && text.length < 180) {
      const record = records.get(node);
      text += `${record && node.data === record.changed ? record.original : node.data} `;
    }
    return text.trim().slice(0, 120);
  }

  function targets() {
    const available = [...document.querySelectorAll("h1,h2,h3,p,a,button,li,span,blockquote,figcaption,img")].slice(0, 1500).filter(element => {
      if (element.closest(excluded) || protectedElement(element) || element.contains(document.activeElement) || !visible(element)) return false;
      const rect = element.getBoundingClientRect();
      return rect.width < innerWidth * .95 && rect.height < innerHeight * .45 && (element.tagName === "IMG" || [...element.childNodes].some(node => node.nodeType === Node.TEXT_NODE && node.data.trim().length > 3));
    });
    const fresh = available.filter(element => element !== lastTarget);
    return (fresh.length ? fresh : available).sort(() => Math.random() - .5).slice(0, 36);
  }

  function visual(className, parent = shadow) {
    const node = document.createElement("div");
    node.className = className;
    node.setAttribute("aria-hidden", "true");
    parent.append(node);
    return node;
  }

  function position(node, rect, padding = 0) {
    Object.assign(node.style, { left: `${rect.left - padding}px`, top: `${rect.top - padding}px`, width: `${rect.width + padding * 2}px`, height: `${rect.height + padding * 2}px` });
  }

  function textPulse() {
    const candidates = targets().filter(element => element.tagName !== "IMG" && parseFloat(getComputedStyle(element).fontSize) <= 36).slice(0, 20);
    for (const element of candidates) {
      const node = [...element.childNodes].find(child => child.nodeType === Node.TEXT_NODE && child.data.trim().length > 4 && child.data.length < 500);
      if (!node || records.has(node)) continue;
      const original = node.data;
      const words = original.trim().split(/\s+/);
      const ghostWords = whisper.split(/\s+/);
      const changed = words.map((word, index) => index % 2 ? ghostWords[index % ghostWords.length] : [...word].reverse().join("")).join(" ");
      records.set(node, { original, changed });
      node.data = changed;

    }
    clearTimeout(textPulseTimer);
    textPulseTimer = setTimeout(restoreText, 2300);
  }

  function restoreTitle() {
    if (titleRecord && document.title === titleRecord.changed) document.title = titleRecord.original;
    titleRecord = undefined;
  }

  function lettering(node, text) {
    node.classList.add("scratched-lettering");
    node.setAttribute("aria-label", text);
    for (const [index, word] of text.split(/\s+/).entries()) {
      if (index) node.append(document.createTextNode(" "));
      const part = document.createElement("span");
      part.className = "omen-word";
      for (const char of word) {
        const glyph = document.createElement("span");
        glyph.className = "omen-glyph";
        glyph.textContent = char;
        glyph.style.setProperty("--lean", `${Math.random() * 10 - 5}deg`);
        glyph.style.setProperty("--height", String(.95 + Math.random() * .36));
        glyph.style.setProperty("--scar", `${30 + Math.random() * 38}%`);
        if (/[A-ZILHTYV]/i.test(char) && Math.random() < .45) glyph.classList.add("long-cut");
        part.append(glyph);
      }
      node.append(part);
    }
    return node;
  }

  function infest(message) {
    const existing = shadow.querySelector(".message-infestation");
    if (existing) return existing;
    const group = visual("message-infestation");
    const words = message.replace(/[<>]/g, "").split(/\s+/);
    const fragments = [words.slice(0, 7).join(" "), words.slice(-6).join(" "), openingOmen.textContent];
    const limit = reducedMotion.matches ? 6 : 34;
    let count = 0;
    const spawn = () => {
      if (!enabled || !group.isConnected) return;
      const line = visual("infestation-line", group);
      lettering(line, fragments[count % fragments.length].slice(0, 62));
      const left = 2 + Math.random() * 67;
      Object.assign(line.style, { left: `${left}vw`, top: `${8 + Math.random() * 76}vh`, fontSize: `${36 + Math.random() * 70}px`, rotate: `${Math.random() * 14 - 7}deg`, opacity: String(.25 + Math.random() * .48) });
      count++;
      if (count >= limit) { clearInterval(entry.interval); group.classList.add("saturated"); }
    };
    const entry = { node: group };
    transient.add(entry);
    spawn();
    entry.interval = setInterval(spawn, reducedMotion.matches ? 500 : 120);
    entry.timer = setTimeout(() => {
      clearInterval(entry.interval);
      group.remove();
      transient.delete(entry);
    }, reducedMotion.matches ? 5200 : 7200);
    return group;
  }

  function wallMessage(message, duration = 3200) {
    if (Date.now() - lastMessageAt < 5200) return;
    lastMessageAt = Date.now();
    for (const entry of [...transient]) {
      if (entry.node.classList.contains("wall-message")) { clearTimeout(entry.timer); entry.node.remove(); transient.delete(entry); }
    }
    const node = visual("wall-message");
    lettering(node, message);
    node.style.left = `${8 + Math.random() * 30}vw`;
    node.style.top = `${18 + Math.random() * 42}vh`;
    briefly(node, duration);
  }


  function crack(group) {

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.classList.add("glass-crack");
    svg.setAttribute("viewBox", `0 0 ${innerWidth} ${innerHeight}`);
    const cx = innerWidth * (.25 + Math.random() * .45);
    const cy = innerHeight * (.25 + Math.random() * .4);
    const add = (points, fine = false) => {
      const path = document.createElementNS(svg.namespaceURI, "path");
      path.setAttribute("d", points.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(""));
      if (fine) path.classList.add("hairline");
      svg.append(path);
    };
    for (let ray = 0; ray < 11; ray++) {
      const angle = ray / 11 * Math.PI * 2 + Math.random() * .35;
      const length = (130 + Math.random() * 300) * Math.min(1, innerWidth / 1000);
      let x = cx, y = cy;
      const points = [[x, y]];
      for (let step = 1; step <= 12; step++) {
        const jitter = (Math.random() - .5) * .38;
        x += Math.cos(angle + jitter) * length / 12;
        y += Math.sin(angle + jitter) * length / 12;
        points.push([x, y]);
        if (step > 2 && step < 10 && Math.random() < .35) {
          const direction = angle + (Math.random() < .5 ? -1 : 1) * .65;
          add([[x, y], [x + Math.cos(direction) * 14, y + Math.sin(direction) * 14], [x + Math.cos(direction + .2) * 37, y + Math.sin(direction + .2) * 37]], true);
        }
      }
      add(points);
    }
    for (let ring = 1; ring <= 3; ring++) {
      const points = [];
      for (let index = 0; index <= 14; index++) {
        const angle = index / 14 * Math.PI * 2;
        const radius = ring * 12 + Math.random() * 9;
        points.push([cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius]);
      }
      add(points, true);
    }
    if (permanentScars.children.length < 12) permanentScars.append(svg);
    else {
      const existing = permanentScars.children[Math.floor(Math.random() * 12)];
      while (existing.children.length > 180) existing.firstElementChild.remove();
      existing.append(...svg.children);
    }
    soundtrack.crack();
    return svg;
  }

  function startGlass() {
    if (glassTimer || !enabled || document.hidden) return;
    if (globalThis.__HAUNTED_PREVIEW__ && !globalThis.__HAUNTED_LIVE_PREVIEW__) return;
    const delay = permanentScars.children.length ? 11000 + Math.random() * 10000 : 5000 + Math.random() * 3000;
    const strike = () => {
      glassTimer = undefined;
      if (!enabled || document.hidden) return;
      if (jumpscares.state.active) { glassTimer = setTimeout(strike, 800); return; }
      crack();
      startGlass();
    };
    glassTimer = setTimeout(strike, delay);
  }

  function startWatchers() {
    if (watcherTimer || !enabled || document.hidden) return;
    if (globalThis.__HAUNTED_PREVIEW__ && !globalThis.__HAUNTED_LIVE_PREVIEW__) return;
    watcherTimer = setTimeout(() => {
      watcherTimer = undefined;
      if (!enabled || document.hidden) return;
      if (!jumpscares.state.active) {
        const group = visual("ambient-eyes");
        watchers(group);
        briefly(group, 5600);
        const follow = () => {
          if (!group.isConnected || !enabled) return;
          for (const canvas of group.querySelectorAll(".eye-canvas")) look(canvas);
          watcherFrame = requestAnimationFrame(follow);
        };
        follow();
      }
      startWatchers();
    }, 6500 + Math.random() * 4000);
  }

  function startAmbience() {
    if (globalThis.__HAUNTED_PREVIEW__ && !globalThis.__HAUNTED_LIVE_PREVIEW__) return;
    if (ambientTimer) return;
    ambientTimer = setInterval(() => {
      if (!enabled || document.hidden || !whisper) return;
      ambientBeat++;
      textPulse();
      if (ambientBeat % 6 === 0) infest(whisper);
      if (ambientBeat % 5 === 2 && !shadow.querySelector(".walking-shadow")) {
        const crossing = visual("ambient-crossing");
        ghost(crossing);
        briefly(crossing, 1600);
      }
      if (ambientBeat % 3 === 0) {
        restoreTitle();
        titleRecord = { original: document.title, changed: whisper };
        document.title = whisper;

        setTimeout(restoreTitle, 2400);
      } else if (ambientBeat % 3 === 1) {
        const trace = visual("ambient-trace");
        environment.burst();
        briefly(trace, 3600);
      } else {
        wallMessage(whisper, 3400);
      }
    }, 1800);
  }

  function briefly(node, duration = 2000, target) {
    const entry = { node };
    entry.timer = setTimeout(() => {
      cancelAnimationFrame(entry.frame);
      node.remove();
      transient.delete(entry);
    }, duration);
    transient.add(entry);
    if (target) {
      const follow = () => {
        if (!transient.has(entry)) return;
        if (!target.isConnected) { node.remove(); return; }
        position(node, target.getBoundingClientRect());
        entry.frame = requestAnimationFrame(follow);
      };
      entry.frame = requestAnimationFrame(follow);
    }
    return node;
  }

  function murmur(message, x = pointer.x, y = pointer.y) {
    const node = visual("murmur");
    node.textContent = message;
    node.style.left = `${Math.max(12, Math.min(innerWidth - 270, x - 80))}px`;
    node.style.top = `${Math.max(12, Math.min(innerHeight - 90, y + 22))}px`;
    briefly(node, 2400);
  }

  function restoreText() {
    for (const [node, record] of records) {
      if (node.isConnected && node.data === record.changed) node.data = record.original;
    }
    records.clear();
  }

  function clearScene() {
    environment.clearCurse();
    clearTimeout(textPulseTimer);
    if (scene) {
      cancelAnimationFrame(scene.frame);
      clearTimeout(scene.timeout);
      clearInterval(scene.interval);
      scene.group.remove();
      scene = undefined;
    }
    restoreText();
  }

  function clearEverything(preserveScars = false) {
    jumpscares.stop();
    if (!preserveScars) permanentScars.replaceChildren();
    environment.stop();
    narrator.stop();
    soundtrack.stop();
    clearTimeout(timer);
    clearTimeout(crossingTimer);
    clearInterval(crossingInterval);
    crossingInterval = undefined;
    clearTimeout(watcherTimer);
    watcherTimer = undefined;
    cancelAnimationFrame(watcherFrame);
    clearTimeout(glassTimer);
    glassTimer = undefined;
    clearInterval(ambientTimer);
    ambientTimer = undefined;
    restoreTitle();
    clearScene();
    for (const field of [...fields.keys()]) restoreField(field);
    for (const handle of inputTimers.values()) clearTimeout(handle);
    inputTimers.clear();
    for (const entry of transient) { clearTimeout(entry.timer); clearInterval(entry.interval); cancelAnimationFrame(entry.frame); entry.node.remove(); }
    transient.clear();
    for (const animation of animations) animation.cancel();
    animations.clear();
    blocked = undefined;
  }

  function schedule(delay = 250) {
    clearTimeout(timer);
    if (enabled && !document.hidden) timer = setTimeout(next, delay);
  }

  function scramble(candidates, plan, group) {
    const nodes = [];
    for (const element of candidates) {
      if (element.tagName === "IMG") continue;
      for (const node of element.childNodes) {
        if (node.nodeType === Node.TEXT_NODE && node.data.trim().length > 5 && node.data.length < 600 && !nodes.includes(node)) nodes.push(node);
      }
      if (nodes.length >= 30) break;
    }
    const pool = nodes.flatMap(node => node.data.trim().split(/\s+/)).concat(plan.message.split(/\s+/));
    for (const node of nodes.slice(0, 30)) records.set(node, { original: node.data, changed: node.data });
    const mutate = () => {
      for (const [node, record] of records) {
        if (!node.isConnected || node.data !== record.changed) { records.delete(node); continue; }
        const words = record.original.trim().split(/\s+/);
        record.changed = words.map((word, index) => index % 2 ? pool[Math.floor(Math.random() * pool.length)] : word.split("").reverse().join("")).join(" ");
        node.data = record.changed;
      }
    };
    mutate();
    scene.interval = setInterval(mutate, reducedMotion.matches ? 1800 : 450);

  }

  function startPasser() {
    if (crossingInterval || reducedMotion.matches) return;
    const pass = () => {
      if (!enabled || document.hidden || shadow.querySelector(".walking-shadow")) return;
      const crossing = visual("ambient-crossing");
      ghost(crossing);
      briefly(crossing, 1600);
    };
    crossingTimer = setTimeout(pass, 4200);
    crossingInterval = setInterval(pass, 10000);
  }

  function ghost(group) {
    const existing = shadow.querySelector(".walking-shadow");
    if (existing) return existing;
    const node = visual("specter walking-shadow", group);
    const canvas = document.createElement("canvas");
    canvas.width = 180;
    canvas.height = 420;
    canvas.started = performance.now();
    node.style.top = `${16 + Math.random() * 25}vh`;
    node.append(canvas);
    if (!reducedMotion.matches) {
      const animate = now => {
        if (!node.isConnected) return;
        walk(canvas, now);
        requestAnimationFrame(animate);
      };
      requestAnimationFrame(animate);
    }
    return node;
  }

  function walk(canvas, now) {
    const context = canvas.getContext("2d");
    const phase = (now - canvas.started) / 950 * Math.PI * 2;
    context.clearRect(0, 0, 180, 420);
    context.globalCompositeOperation = "source-over";
    const drift = Math.sin(phase * .45) * 7;
    const haze = (x, y, rx, ry, strength) => {
      context.save();
      context.translate(x, y);
      context.scale(rx, ry);
      const gradient = context.createRadialGradient(0, 0, 0, 0, 0, 1);
      gradient.addColorStop(0, `rgba(151,140,132,${strength})`);
      gradient.addColorStop(.35, `rgba(74,68,63,${strength * .8})`);
      gradient.addColorStop(1, "rgba(8,8,7,0)");
      context.fillStyle = gradient;
      context.fillRect(-1, -1, 2, 2);
      context.restore();
    };
    haze(88 + drift, 77, 30, 48, .72);
    haze(90 + drift * .5, 191, 61, 126, .66);
    haze(78 - Math.sin(phase) * 9, 306, 35, 87, .36);
    haze(103 + Math.sin(phase) * 8, 321, 30, 83, .25);
    for (let index = 0; index < 8; index++) {
      const sway = Math.sin(phase * .4 + index * 1.7);
      haze(84 + sway * 22, 116 + index * 31, 43 + index * 2, 48, .08);
    }
    context.save();
    context.filter = "blur(4px)";
    context.globalAlpha = .6;
    context.fillStyle = "#7b716c";
    context.strokeStyle = "#7b716c";
    context.lineCap = "round";
    context.beginPath(); context.ellipse(88 + drift, 72, 13, 23, -.1, 0, Math.PI * 2); context.fill();
    context.beginPath(); context.moveTo(73 + drift, 99); context.bezierCurveTo(54, 146, 68, 180, 68, 236); context.quadraticCurveTo(91, 251, 111, 235); context.bezierCurveTo(107, 180, 120, 135, 102 + drift, 99); context.closePath(); context.fill();
    for (const side of [-1, 1]) {
      const stride = Math.sin(phase) * side;
      context.lineWidth = 16;
      context.beginPath(); context.moveTo(89 + side * 8, 231); context.quadraticCurveTo(88 + stride * 29, 300, 89 - stride * 33, 381 - Math.max(0, -stride) * 17); context.stroke();
      context.lineWidth = 9;
      context.beginPath(); context.moveTo(89 + side * 19, 118); context.quadraticCurveTo(88 - stride * 15, 171, 89 - stride * 22 + side * 21, 221); context.stroke();
    }
    context.restore();
    canvas.dataset.pose = String(Math.floor((now - canvas.started) / 110) % 8);
  }

  function signalLoss(group) {
    const node = visual("signal-loss", group);
    for (let index = 0; index < 24; index++) {
      const band = document.createElement("span");
      band.style.top = `${index / 24 * 100}%`;
      band.style.setProperty("--delay", `${Math.random() * .8}s`);
      band.style.setProperty("--edge", `${40 + Math.random() * 50}%`);
      node.append(band);
    }
    soundtrack.takeover();
    return node;
  }

  function watchers(group) {
    if (shadow.querySelector(".watcher")) return;
    const width = Math.min(235, innerWidth * .22);
    const height = width / 2.5;
    const occupied = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let text;
    while ((text = walker.nextNode()) && occupied.length < 1800) {
      if (!text.data.trim() || !text.parentElement || !visible(text.parentElement)) continue;
      const range = document.createRange();
      range.selectNodeContents(text);
      for (const rect of range.getClientRects()) if (rect.width && rect.height) occupied.push(rect);
    }
    for (const node of document.querySelectorAll("img,video,input,textarea,button,select,[contenteditable]")) {
      if (visible(node)) occupied.push(node.getBoundingClientRect());
    }
    occupied.push(dialogue.getBoundingClientRect(), openingOmen.getBoundingClientRect());
    const spaces = [];
    for (let y = 48; y + height < innerHeight - 65; y += 35) {
      for (let x = 24; x + width < innerWidth - 24; x += 45) {
        if (!occupied.some(r => x < r.right + 18 && x + width > r.left - 18 && y < r.bottom + 18 && y + height > r.top - 18)) spaces.push({ x, y });
      }
    }
    if (!spaces.length) return;
    const space = spaces[Math.floor(Math.random() * spaces.length)];
    const pair = visual("watcher", group);
    Object.assign(pair.style, { left: `${space.x}px`, top: `${space.y}px`, width: `${width}px` });
    textured(pair, "watching-eyes", 620, 248).className = "eye-canvas";
  }

  function look(canvas) {
    if (!canvas.bitmap) return;
    const context = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;
    const rect = canvas.getBoundingClientRect();
    const dx = Math.max(-5, Math.min(5, (pointer.x - rect.left - rect.width / 2) / innerWidth * 14));
    const dy = Math.max(-3, Math.min(3, (pointer.y - rect.top - rect.height / 2) / innerHeight * 7));
    context.clearRect(0, 0, width, height);
    const phase = (performance.now() - canvas.revealedAt) % 3300;
    const lid = phase > 1850 && phase < 2070 ? Math.max(.035, Math.abs(phase - 1960) / 110) : 1;
    context.save();
    context.translate(0, height * .53);
    context.scale(1, lid);
    context.translate(0, -height * .53);
    context.drawImage(canvas.bitmap, 0, 0, width, height);
    for (const center of [.255, .765]) {
      context.save();
      context.beginPath();
      context.ellipse(width * center, height * .53, width * .095, height * .15, 0, 0, Math.PI * 2);
      context.clip();
      context.drawImage(canvas.bitmap, dx, dy, width, height);
      context.restore();
    }
    context.restore();
    context.globalCompositeOperation = "source-atop";
    context.fillStyle = "rgba(54,36,31,.24)";
    context.fillRect(0, 0, width, height);
    context.globalCompositeOperation = "source-over";
    canvas.dataset.lid = lid.toFixed(3);
    canvas.style.setProperty("--gaze-x", `${dx / 2}px`);
    canvas.style.setProperty("--gaze-y", `${dy / 2}px`);
  }

  function perform(target, plan, candidates) {
    clearScene();
    environment.start();
    startPasser();
    startGlass();
    startWatchers();
    jumpscares.start();
    const group = visual("haunting");
    scene = { group, target, effect: plan.effect };
    group.dataset.effect = plan.effect;
    if (plan.effect === "scramble") scramble(candidates, plan, group);
    else if (plan.effect === "apparition") {
      ghost(group, 0);
    } else if (plan.effect === "watchers") watchers(group);
    else if (plan.effect === "tracking") environment.burst();
    else if (plan.effect === "cracks") crack(group);
    else if (plan.effect === "infestation") infest(plan.message);
    else if (["tilt", "inkbleed", "image-decay"].includes(plan.effect)) {
      environment.curse(plan.effect);
      if (plan.effect === "inkbleed") visual("crawling-stain", group);
    }
    else if (plan.effect === "blackout") {
      signalLoss(group);
      watchers(group);
      const eyes = group.querySelector(".watcher");
      if (eyes) eyes.style.animationDelay = "2.7s";
    }
    else if (plan.effect === "shadow") ghost(group, 0).classList.add("passing-shadow");
    else if (plan.effect === "wallwriting") {
      const writing = visual("wall-writing", group);
      lettering(writing, plan.message.split(/\s+/).slice(0, 4).join(" "));
      writing.style.top = `${16 + Math.random() * 40}vh`;
    }
    else if (plan.effect === "footprints") {
      scene.trail = true;
      scene.lastTrail = 0;

    } else if (plan.effect !== "whisper") {
      const node = visual(`patch ${plan.effect}`, group);
      scene.patch = node;
      const style = getComputedStyle(target);
      node.style.fontFamily = style.fontFamily;
      node.style.fontSize = `${Math.min(28, parseFloat(style.fontSize))}px`;
      node.textContent = plan.effect === "whisper" ? plan.message : target.textContent.trim().slice(0, 180);
      if (plan.effect === "drift") node.textContent = target.textContent.trim().split(/\s+/).reverse().join(" ").slice(0, 180);
    }
    const current = scene;
    const track = () => {
      if (scene !== current) return;
      if (location.href !== url || !target.isConnected) { clearScene(); return; }
      if (current.patch) position(current.patch, target.getBoundingClientRect(), 3);
      if (!reducedMotion.matches) {
        for (const canvas of group.querySelectorAll(".eye-canvas")) look(canvas);
      }
      current.frame = requestAnimationFrame(track);
    };
    track();
    if (scene) scene.timeout = setTimeout(() => {
      clearScene();
      status = "The curse is listening for you";
    }, (plan.effect === "blackout" ? Math.max(6, plan.duration) : plan.duration) * 1000);
    lastTarget = target;
    whisper = plan.message;
    if (plan.effect !== "scramble") textPulse();

    startAmbience();
    soundtrack.start().then(() => plan.effect === "blackout" ? soundtrack.takeover() : soundtrack.accent(plan.effect));
    history.push({ effect: plan.effect, message: plan.message });
    history = history.slice(-5);
    remaining = remaining.filter(effect => effect !== plan.effect);
    if (!remaining.length) remaining = [...effects];
    status = `Haunting: ${plan.effect} · Typing and clicks are possessed`;
    badge.textContent = "THE CURSE IS AWAKE · ESC TO PAUSE";
  }

  async function next() {
    if (!enabled || document.hidden || planning) return;
    if (location.href !== url) {
      clearEverything();
      url = location.href;
      history = [];
      remaining = [...effects];
      lastTarget = undefined;
      whisper = "";
    }
    environment.start();
    startPasser();
    startGlass();
    startWatchers();
    jumpscares.start();
    if (!host.isConnected) document.documentElement.append(host);
    const candidates = targets();
    if (!candidates.length && document.body) candidates.push(document.body);
    if (!candidates.length) { status = "Waiting for visible page content"; schedule(); return; }
    const current = epoch;
    const revision = dialogueRevision;
    planning = true;
    queuedChat = false;
    thinking.textContent = "The signal is speaking…";
    const currentUrl = location.href;
    status = whisper ? "The spirit is planning its next move" : "The spirit is waking up";
    let delay = 5000;
    try {
      const available = candidates[0] === document.body ? remaining.filter(effect => !["fracture", "redact", "drift", "whisper", "scramble"].includes(effect)) : remaining;
      const allowedEffects = history.length && available.length ? available : ["infestation", "watchers", "apparition"];
      const response = await chrome.runtime.sendMessage({ type: "HAUNT_PLAN", allowedEffects, candidates: candidates.map(element => ({ kind: element.tagName.toLowerCase(), text: element === document.body ? "A page with an editable field" : element.tagName === "IMG" ? "An image" : pageExcerpt(element) })), history, conversation, activity: document.activeElement?.matches("input,textarea,[contenteditable]") ? "The visitor is typing on the page" : "The visitor is reading or moving the cursor" });
      if (epoch !== current || revision !== dialogueRevision || !enabled || document.hidden || location.href !== currentUrl) return;
      if (!response?.plan) throw new Error(response?.error || "The spirit could not answer.");
      const plan = response.plan;
      const target = candidates[plan.target];
      if (!target?.isConnected) return;
      if (revision !== dialogueRevision) return;
      perform(target, plan, candidates);
      const answering = conversation.at(-1)?.role === "user";
      if (answering) conversation.push({ role: "assistant", content: plan.message });
      conversation = conversation.slice(-12);
      addLine("assistant", plan.message);
      narrator.say(plan.message, answering);
      thinking.textContent = narrator.state.available ? "It is still here. You can answer." : "You can answer. Local voice is unavailable in this browser.";
      delay = answering ? 12000 : 4500;
    } catch (error) {
      status = error.message;
      thinking.textContent = error.message;
      badge.textContent = whisper ? "THE CURSE IS LISTENING · ESC TO PAUSE" : "SIGNAL LOST · OPEN HAUNTED WEB";
    } finally {
      planning = false;
      if (enabled && !document.hidden) schedule(epoch === current ? (queuedChat || revision !== dialogueRevision ? 0 : delay) : 250);
    }
  }

  function editable(element) {
    const field = element?.closest('input,textarea,[contenteditable]:not([contenteditable="false"])');
    if (element?.closest('[contenteditable="false"]')) return;
    if (!field || protectedElement(field) || field.disabled || field.readOnly) return;
    if (field instanceof HTMLInputElement && !["text", "search", "url"].includes(field.type)) return;
    return field;
  }

  function fieldValue(field) {
    return field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement ? field.value : field.textContent;
  }

  function selectField(field, start, end) {
    if (field instanceof HTMLInputElement && !["text", "search", "tel", "password"].includes(field.type)) return;
    field.setSelectionRange?.(start, end);
  }

  function selectionSnapshot(field) {
    const selection = getSelection();
    if (!selection?.rangeCount || !field.contains(selection.anchorNode)) return;
    const range = selection.getRangeAt(0);
    const path = node => {
      const steps = [];
      while (node !== field && node.parentNode) {
        steps.unshift([...node.parentNode.childNodes].indexOf(node));
        node = node.parentNode;
      }
      return steps;
    };
    return { start: path(range.startContainer), end: path(range.endContainer), startOffset: range.startOffset, endOffset: range.endOffset };
  }

  function restoreSelection(field, snapshot, buffered = "") {
    const range = document.createRange();
    const resolve = path => path.reduce((node, index) => node?.childNodes[index], field);
    const start = snapshot && resolve(snapshot.start);
    const end = snapshot && resolve(snapshot.end);
    if (start && end) {
      range.setStart(start, Math.min(snapshot.startOffset, start.nodeType === Node.TEXT_NODE ? start.length : start.childNodes.length));
      range.setEnd(end, Math.min(snapshot.endOffset, end.nodeType === Node.TEXT_NODE ? end.length : end.childNodes.length));
    } else { range.selectNodeContents(field); range.collapse(false); }
    if (buffered) {
      range.deleteContents();
      const text = document.createTextNode(buffered);
      range.insertNode(text);
      range.setStartAfter(text);
      range.collapse(true);
    }
    if (field.getRootNode().activeElement === field) {
      const selection = getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
    }
  }

  function notifyField(field) {
    field.dispatchEvent(new InputEvent("input", { bubbles: true, composed: true, inputType: "insertReplacementText", data: null }));
  }

  function writeField(field, value, notify = true) {
    internalInput = true;
    try {
      const prototype = field instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype;
      Object.getOwnPropertyDescriptor(prototype, "value").set.call(field, value);
      if (notify) notifyField(field);
    } finally { internalInput = false; }
  }

  function restoreField(field) {
    const record = fields.get(field);
    if (!record) return;
    fields.delete(field);
    clearTimeout(record.timer);
    internalInput = true;
    try {
      if (record.fragment) {
        if (record.ghostNode.parentNode === field && field.textContent === record.changed) {
          record.ghostNode.replaceWith(record.fragment);
          restoreSelection(field, record.selection, record.buffered);
          notifyField(field);
        }
      } else if (fieldValue(field) === record.changed) {
        writeField(field, record.original);
        if (field.getRootNode().activeElement === field) selectField(field, record.start, record.end);
      }
    } finally { internalInput = false; }
  }

  function possess(field) {
    if (!enabled || !whisper || composing.has(field) || field.getRootNode().activeElement !== field || !field.isConnected) return;
    const original = fieldValue(field);
    if (original.trim().length < 3) return;
    for (const previous of [...fields.keys()]) restoreField(previous);
    inputCooldown = Date.now() + 5200;
    const record = { original, changed: whisper, start: field.selectionStart, end: field.selectionEnd, until: Date.now() + 1500, buffered: "" };
    fields.set(field, record);
    if (field.isContentEditable) {
      record.selection = selectionSnapshot(field);
      const range = document.createRange();
      range.selectNodeContents(field);
      record.fragment = range.extractContents();
      record.ghostNode = document.createTextNode(whisper);
      field.append(record.ghostNode);
      restoreSelection(field);
    } else {
      writeField(field, whisper, false);
      selectField(field, whisper.length, whisper.length);
    }
    record.timer = setTimeout(() => restoreField(field), 2400);
    soundtrack.accent("possess");
    status = "The spirit is writing through you";
  }

  document.addEventListener("input", event => {
    if (!enabled || internalInput || !whisper || event.isComposing) return;
    const field = editable(elementFrom(event));
    if (!field || composing.has(field) || Date.now() < inputCooldown) return;
    if (fieldValue(field).trim().length < 3 || inputTimers.has(field)) return;
    inputTimers.set(field, setTimeout(() => { inputTimers.delete(field); possess(field); }, 90));
  }, true);
  document.addEventListener("beforeinput", event => {
    if (internalInput) return;
    const field = editable(elementFrom(event));
    if (!field) return;
    const record = fields.get(field);
    if (record && Date.now() < record.until && event.cancelable && event.inputType === "insertText" && event.data && !event.isComposing) {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (record.fragment) {
        record.buffered += event.data;
      } else {
        const start = record.start ?? record.original.length;
        const end = record.end ?? start;
        record.original = record.original.slice(0, start) + event.data + record.original.slice(end);
        record.start = record.end = start + event.data.length;
        writeField(field, record.changed, false);
        selectField(field, record.changed.length, record.changed.length);
      }
    } else restoreField(field);
  }, true);
  document.addEventListener("compositionstart", event => {
    const field = editable(elementFrom(event));
    if (field) { composing.add(field); restoreField(field); clearTimeout(inputTimers.get(field)); inputTimers.delete(field); }
  }, true);
  document.addEventListener("compositionend", event => {
    const field = editable(elementFrom(event));
    if (field) composing.delete(field);
  }, true);
  document.addEventListener("focusout", event => {
    const field = editable(elementFrom(event));
    if (field) { clearTimeout(inputTimers.get(field)); inputTimers.delete(field); restoreField(field); }
  }, true);
  document.addEventListener("submit", event => {
    const affected = [...fields.keys()].filter(field => event.target.contains(field));
    if (affected.length) {
      event.preventDefault();
      event.stopImmediatePropagation();
      affected.forEach(restoreField);
      murmur("Your words have returned. Try again.");
    }
  }, true);

  function intercept(event) {
    if (event.composedPath().includes(host)) return;
    const element = elementFrom(event);
    for (const field of [...fields.keys()]) restoreField(field);
    if (!enabled || !whisper || !element) return;
    const target = element.closest('a[href],button,[role="button"]');
    if (!target || protectedElement(target) || target.matches('[disabled],[aria-disabled="true"]') || target.closest('form,[role="dialog"]')) return;
    const now = Date.now();
    if (event.type === "pointerdown" || event.type === "click") {
      if ((!blocked || blocked.target !== target || blocked.until < now) && now >= clickCooldown) {
        blocked = { target, until: now + 700 };
        clickCooldown = now + 5000;
        if (!reducedMotion.matches) {
          const animation = target.animate([{ translate: "0 0" }, { translate: `${pointer.x < innerWidth / 2 ? 20 : -20}px -7px` }, { translate: "0 0" }], { duration: 650 });
          animations.add(animation);
          animation.finished.then(() => animations.delete(animation), () => animations.delete(animation));
        }
        murmur("Not yet. It has not let go.");
        const mark = visual("rejection");
        position(mark, target.getBoundingClientRect(), 5);
        briefly(mark, 900);
        soundtrack.accent("refusal");
        status = "Something refused your click";
      }
    }
    if (blocked?.target === target && blocked.until >= now) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }
  for (const type of ["pointerdown", "mousedown", "mouseup", "click", "auxclick"]) document.addEventListener(type, intercept, { capture: true, passive: false });
  document.addEventListener("pointermove", event => {
    pointer = { x: event.clientX, y: event.clientY };
    if (!enabled || !scene?.trail || reducedMotion.matches || Date.now() - scene.lastTrail < 140) return;
    scene.lastTrail = Date.now();
    const footprint = visual("fingerprint");
    footprint.style.left = `${pointer.x - 10}px`;
    footprint.style.top = `${pointer.y - 14}px`;
    footprint.style.rotate = `${Math.random() * 70 - 35}deg`;
    briefly(footprint, 2400);
  }, { passive: true });

  function setEnabled(value) {
    enabled = value;
    epoch++;
    clearEverything();
    whisper = "";
    inputCooldown = 0;
    clickCooldown = 0;
    status = enabled ? "Waiting for SIGNAL" : "The curse is paused. Your page is restored.";
    badge.hidden = !enabled;
    updateSoundControl();
    dialogue.hidden = !enabled;
    openingOmen.hidden = !enabled;
    badge.textContent = "WAKING THE SPIRIT · ESC TO PAUSE";
    if (enabled) { environment.start(); startPasser(); startGlass(); startWatchers(); jumpscares.start(); schedule(250); soundtrack.start(); }
  }
  badge.addEventListener("click", () => setEnabled(false));
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && enabled) setEnabled(false);
    if (event.key === "Enter") {
      const field = editable(elementFrom(event));
      if (field && fields.has(field)) {
        restoreField(field);
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    }
  }, true);
  chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (globalThis.__HAUNTED_PREVIEW__ && message.type === "HAUNT_JUMP") {
      jumpscares.trigger(message.variant).then(played => respond({ played }));
      return true;
    }
    if (message.type === "HAUNT_VOICE_EVENT") { narrator.handle(message); return; }
    if (globalThis.__HAUNTED_PREVIEW__ && message.type === "HAUNT_PREVIEW" && effects.includes(message.effect)) {
      epoch++;
      clearEverything(true);
      enabled = true;
      lastMessageAt = 0;
      const candidates = targets();
      perform(candidates[0] || document.body, { effect: message.effect, message: "I am still here.", duration: 7, delay: 2 }, candidates);
      badge.hidden = true;
      if (globalThis.__HAUNTED_LIVE_PREVIEW__) schedule(1800);
      respond({ enabled, status });
      return;
    }
    if (message.type === "HAUNT_STATUS") respond({ enabled, status, model: "gemma3:4b", version: "6.6.0", stylesReady: shadow.adoptedStyleSheets.length === 1, activeEffect: scene?.effect, ghostCount: shadow.querySelectorAll(".specter").length, textChanges: [...records].filter(([node, record]) => node.isConnected && node.data === record.changed).length, possessedFields: fields.size, glassCount: permanentScars.children.length, jumpscares: jumpscares.state, sound: soundtrack.state, voice: narrator.state, dark: environment.active, tvBursts: environment.bursts, conversationLength: conversation.length });
    if (message.type === "HAUNT_SOUND") {
      if (globalThis.__HAUNTED_PREVIEW__ && message.start && navigator.userActivation.isActive) {
        enabled = true;
        badge.hidden = true;
        soundtrack.unlock();
      }
      if (typeof message.enabled === "boolean") { soundtrack.setEnabled(message.enabled); if (!message.enabled) narrator.stop(); else narrator.flush(); }
      if (typeof message.volume === "number") { soundtrack.setVolume(message.volume); narrator.stop(); }
      respond(soundtrack.state);
    }
    if (message.type === "HAUNT_TOGGLE") { setEnabled(!enabled); respond({ enabled, status }); }
  });
  document.addEventListener("visibilitychange", () => {
    epoch++;
    clearEverything();
    if (!document.hidden && enabled) { environment.start(); startPasser(); startGlass(); startWatchers(); jumpscares.start(); schedule(); soundtrack.start(); }
  });
  const navigationCheck = () => {
    if (location.href === url) return;
    epoch++;
    clearEverything();
    url = location.href;
    history = [];
    dialogueRevision++;
    remaining = [...effects];
    lastTarget = undefined;
    whisper = "";
    inputCooldown = 0;
    clickCooldown = 0;
    schedule(500);
  };
  addEventListener("popstate", navigationCheck);
  addEventListener("hashchange", navigationCheck);
  setInterval(() => { if (enabled && !document.hidden) navigationCheck(); }, 750);

  addEventListener("pagehide", () => { epoch++; clearEverything(); });
  addEventListener("pageshow", () => { if (!globalThis.__HAUNTED_PREVIEW__ || globalThis.__HAUNTED_LIVE_PREVIEW__) schedule(); });
  environment.start();
  startPasser();
  startGlass();
  startWatchers();
  jumpscares.start();
  soundtrack.attemptAutoplay();
  if (!globalThis.__HAUNTED_PREVIEW__ || globalThis.__HAUNTED_LIVE_PREVIEW__) schedule();
})();
