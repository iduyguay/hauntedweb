const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync, mkdirSync } = require("node:fs");
const { chromium } = require("playwright");
let browser;
const phrase = "I have been waiting inside these words.";
const css = readFileSync("ghost.css", "utf8");
const script = readFileSync("content.js", "utf8").replace('mode: "closed"', 'mode: "open"');

before(async () => { browser = await chromium.launch({ headless: true, channel: process.env.HAUNT_BROWSER_CHANNEL || undefined }); });
after(async () => { await browser?.close(); });

async function setup(effect = "watchers", deferred = false, strictCsp = false, nativeVoice = false, fastJumps = false) {
  const page = await browser.newPage({ viewport: { width: 1100, height: 800 } });
  await page.route("https://haunted.test/**", route => route.fulfill({ contentType: "text/html", headers: strictCsp ? { "Content-Security-Policy": "default-src 'none'; style-src 'none'; script-src 'none'; connect-src https://extension.test" } : {}, body: `<!DOCTYPE html><html><head><style>body{font:18px Georgia;padding:45px;background:#f0eced}p{max-width:600px}input,textarea{display:block;margin:16px 0;padding:10px}button,a{display:inline-block;padding:12px;margin:15px}</style></head><body><h1>The forgotten archive</h1><h2>Stories from a quiet house</h2><p id="story">Every visitor leaves a memory behind in the archive.</p><p id="second">Nobody has opened this door for a hundred years.</p><button id="ordinary">Explore the archive</button><a id="link" href="#room">Enter another room</a><input id="site-url" type="url" aria-label="Website address"><input id="writing" type="text" placeholder="Write a story"><textarea id="notes"></textarea><input id="password" type="password"><input id="card" autocomplete="cc-number"><div id="rich" contenteditable="true"><b>Rich editor text</b></div><form id="form"><input id="formtext"><button id="submit" type="submit">Save</button></form><div data-haunted-ignore><p id="ignored">Leave these words alone forever.</p></div></body></html>` }));
  await page.goto("https://haunted.test/");
  if (fastJumps) await page.evaluate(() => {
    window.jumpDelays = [];
    const original = window.setTimeout.bind(window);
    window.setTimeout = (callback, delay, ...args) => {
      if (delay >= 12000 && delay <= 45000) { jumpDelays.push(delay); return original(callback, 200, ...args); }
      return original(callback, delay, ...args);
    };
  });
  await page.route("https://extension.test/ghost.css", route => route.fulfill({ contentType: "text/css", headers: { "Access-Control-Allow-Origin": "*" }, body: css }));
  await page.route("https://extension.test/ghost.png", route => route.fulfill({ contentType: "image/png", headers: { "Access-Control-Allow-Origin": "*" }, body: readFileSync("ghost.png") }));
  await page.evaluate(({ effect, phrase, deferred, nativeVoice }) => {
    window.originalStoryNode = document.getElementById("story").firstChild;
    window.messages = [];
    window.speechRequests = [];
    window.clicks = 0;
    window.submits = [];
    document.getElementById("ordinary").addEventListener("click", () => clicks++);
    document.getElementById("form").addEventListener("submit", event => { event.preventDefault(); submits.push(document.getElementById("formtext").value); });
    window.listeners = [];
    window.chrome = { runtime: {
      getURL: path => `https://extension.test/${path}`,
      onMessage: { addListener: fn => listeners.push(fn) },
      sendMessage: async message => {
        if (message.type === "HAUNT_VOICE_INFO") return { voice: nativeVoice ? { name: "Whisper", lang: "en-US" } : null };
        if (["HAUNT_SPEAK", "HAUNT_VOICE_STOP"].includes(message.type)) { speechRequests.push(message); return { accepted: true }; }
        if (message.type !== "HAUNT_PLAN") return {};
        messages.push(message);
        const plan = { target: 0, effect, message: phrase, duration: 7, delay: 2 };
        if (deferred) return await new Promise(resolve => { window.finishPlan = () => resolve({ plan }); });
        return { plan };
      }
    }};
  }, { effect, phrase, deferred, nativeVoice });
  await page.evaluate(script);
  await page.waitForFunction(() => window.messages.length > 0);
  if (!deferred) await page.waitForFunction(() => document.getElementById("haunted-web-root").shadowRoot.querySelector(".haunting"));
  return page;
}

function shadowCount(page, selector) {
  return page.evaluate(selector => document.getElementById("haunted-web-root").shadowRoot.querySelectorAll(selector).length, selector);
}

test("watching eyes track the cursor and Escape removes the entire curse", async () => {
  const page = await setup();
  assert.equal(await shadowCount(page, ".watcher"), 1);
  await page.waitForFunction(() => document.getElementById("haunted-web-root").shadowRoot.querySelector(".watcher[data-ready=\"true\"]"));
  await page.mouse.move(30, 30);
  await page.waitForTimeout(50);
  const first = await page.evaluate(() => document.getElementById("haunted-web-root").shadowRoot.querySelector(".eye-canvas").style.getPropertyValue("--gaze-x"));
  await page.mouse.move(1000, 700);
  await page.waitForTimeout(50);
  const second = await page.evaluate(() => document.getElementById("haunted-web-root").shadowRoot.querySelector(".eye-canvas").style.getPropertyValue("--gaze-x"));
  assert.notEqual(first, second);
  await page.keyboard.press("Escape");
  assert.equal(await shadowCount(page, ".haunting"), 0);
  assert.equal(await page.evaluate(() => document.getElementById("haunted-web-root").shadowRoot.querySelector("button").hidden), true);
  await page.close();
});

test("scramble changes several real text nodes and restores their original identity and content", async () => {
  const page = await setup("scramble");
  assert.notEqual(await page.locator("#story").textContent(), "Every visitor leaves a memory behind in the archive.");
  assert.notEqual(await page.locator("#second").textContent(), "Nobody has opened this door for a hundred years.");
  assert.equal(await page.locator("#ignored").textContent(), "Leave these words alone forever.");
  assert.equal(await page.evaluate(() => document.getElementById("story").firstChild === originalStoryNode), true);
  await page.locator("#second").evaluate(node => { node.firstChild.data = "A new application render"; });
  await page.keyboard.press("Escape");
  assert.equal(await page.locator("#story").textContent(), "Every visitor leaves a memory behind in the archive.");
  assert.equal(await page.locator("#second").textContent(), "A new application render");
  await page.close();
});

test("typed words become the AI phrase, further typing restores the user's draft first", async () => {
  const page = await setup();
  await page.locator("#writing").fill("My actual story");
  await page.waitForFunction(phrase => document.getElementById("writing").value === phrase, phrase);
  await page.keyboard.type("!");
  await page.waitForFunction(() => document.getElementById("writing").value === "My actual story!");
  assert.equal(await page.locator("#writing").inputValue(), "My actual story!");
  await page.keyboard.press("Escape");
  assert.equal(await page.locator("#writing").inputValue(), "My actual story!");
  assert.equal(await page.evaluate(() => JSON.stringify(messages).includes("My actual story")), false);
  await page.close();
});

test("passwords and payment fields are never possessed", async () => {
  const page = await setup();
  await page.locator("#password").fill("privatepassword");
  await page.waitForTimeout(500);
  assert.equal(await page.locator("#password").inputValue(), "privatepassword");
  await page.locator("#card").fill("4111111111111111");
  await page.waitForTimeout(500);
  assert.equal(await page.locator("#card").inputValue(), "4111111111111111");
  await page.close();
});

test("the first ordinary click is refused and a retry succeeds", async () => {
  const page = await setup();
  await page.locator("#ordinary").click({ force: true });
  assert.equal(await page.evaluate(() => clicks), 0);
  assert.equal(await shadowCount(page, ".rejection"), 1);
  await page.waitForTimeout(800);
  await page.locator("#ordinary").click({ force: true });
  assert.equal(await page.evaluate(() => clicks), 1);
  await page.close();
});

test("ghost text cannot be submitted with Enter and the real draft is restored", async () => {
  const page = await setup();
  await page.locator("#formtext").fill("My original form text");
  await page.waitForFunction(phrase => document.getElementById("formtext").value === phrase, phrase);
  await page.keyboard.press("Enter");
  assert.deepEqual(await page.evaluate(() => submits), []);
  assert.equal(await page.locator("#formtext").inputValue(), "My original form text");
  await page.keyboard.press("Enter");
  assert.deepEqual(await page.evaluate(() => submits), ["My original form text"]);
  await page.close();
});

test("rich editors change their actual document and restore the original nested markup", async () => {
  const page = await setup();
  await page.locator("#rich").click();
  await page.keyboard.type("more text");
  await page.waitForFunction(phrase => document.getElementById("rich").textContent === phrase, phrase);
  assert.equal(await shadowCount(page, ".possessed-editor"), 0);
  await page.keyboard.press("Escape");
  assert.equal(await page.locator("#rich b").count(), 1);
  assert.ok((await page.locator("#rich").textContent()).includes("more text"));
  assert.equal(await shadowCount(page, ".possessed-editor"), 0);
  await page.close();
});

test("a paused page ignores an AI result that arrives late", async () => {
  const page = await setup("apparition", true);
  await page.keyboard.press("Escape");
  await page.evaluate(() => finishPlan());
  await page.waitForTimeout(100);
  assert.equal(await shadowCount(page, ".specter"), 0);
  await page.close();
});

test("ghosts appear and cursor traces fade without intercepting page interaction", async () => {
  const page = await setup("apparition");
  assert.equal(await shadowCount(page, ".specter"), 1);
  await page.keyboard.press("Escape");
  await page.evaluate(() => listeners[0]({ type: "HAUNT_TOGGLE" }, {}, () => {}));
  await page.evaluate(() => { const old = chrome.runtime.sendMessage; chrome.runtime.sendMessage = async message => { const response = await old(message); response.plan.effect = "footprints"; return response; }; });
  await page.waitForFunction(() => document.getElementById("haunted-web-root").shadowRoot.querySelector('.haunting[data-effect="footprints"]'));
  await page.mouse.move(250, 250);
  assert.ok(await shadowCount(page, ".fingerprint") > 0);
  await page.keyboard.press("Escape");
  assert.equal(await shadowCount(page, ".fingerprint"), 0);
  await page.close();
});

test("single-page navigation restores scrambled content and discards old scenes", async () => {
  const page = await setup("scramble");
  await page.evaluate(() => {
    chrome.runtime.sendMessage = async message => { messages.push(message); return await new Promise(() => {}); };
    history.pushState({}, "", "/another-room");
  });
  await page.waitForTimeout(850);
  assert.equal(await page.locator("#story").textContent(), "Every visitor leaves a memory behind in the archive.");
  assert.equal(await shadowCount(page, ".haunting"), 0);
  await page.close();
});


test("styles, thick ghosts and readable messages survive a strict page style policy", async () => {
  const page = await setup("apparition", false, true);
  await page.waitForFunction(() => document.getElementById("haunted-web-root").shadowRoot.adoptedStyleSheets.length === 1);
  const metrics = await page.evaluate(() => {
    const root = document.getElementById("haunted-web-root").shadowRoot;
    const ghost = root.querySelector(".specter");
    const message = root.querySelector(".presence-dialogue");
    return { width: ghost.getBoundingClientRect().width, height: ghost.getBoundingClientRect().height, opacity: Number(getComputedStyle(ghost).opacity), messageSize: parseFloat(getComputedStyle(message).fontSize), message: root.querySelector(".presence-line.assistant").lastChild.textContent, ghostPaths: ghost.querySelectorAll("path").length, ghostCanvas: ghost.querySelectorAll("canvas").length };
  });
  assert.ok(metrics.width >= 160);
  assert.ok(metrics.height >= 250);
  assert.ok(metrics.opacity <= .66);
  assert.ok(metrics.messageSize >= 12 && metrics.messageSize <= 16);
  assert.equal(metrics.message, phrase);
  assert.equal(metrics.ghostCanvas, 1);
  if (process.env.HAUNT_SCREENSHOT_DIR) {
    mkdirSync(process.env.HAUNT_SCREENSHOT_DIR, { recursive: true });
    await page.waitForFunction(() => document.getElementById("haunted-web-root").shadowRoot.querySelector(".specter canvas"));
    await page.screenshot({ path: `${process.env.HAUNT_SCREENSHOT_DIR}/haunted-v4.png` });
  }
  await page.close();
});

test("continuous typing is possessed before the user stops and every keystroke is recovered", async () => {
  const page = await setup();
  await page.locator("#writing").focus();
  await page.keyboard.type("A story that keeps going", { delay: 55 });
  assert.equal(await page.locator("#writing").inputValue(), phrase);
  assert.equal(await shadowCount(page, ".possessed-editor"), 0);
  await page.keyboard.press("Escape");
  assert.equal(await page.locator("#writing").inputValue(), "A story that keeps going");
  await page.close();
});

test("new physical traces, shadows and wall writing render and clean up", async () => {
  for (const [effect, selector] of [["tracking", ".crt-atmosphere[data-burst]"], ["cracks", ".glass-crack"], ["shadow", ".passing-shadow"], ["wallwriting", ".wall-writing"]]) {
    const page = await setup(effect);
    assert.ok(await shadowCount(page, selector) > 0, effect);
    await page.keyboard.press("Escape");
    assert.equal(await shadowCount(page, selector), 0, effect);
    await page.close();
  }
});

test("ambient messages and a cursed tab title appear between AI scenes and are restored", async () => {
  const page = await setup();
  const original = await page.title();
  await page.waitForFunction(phrase => document.title === phrase, phrase);
  assert.ok(await shadowCount(page, ".opening-omen") > 0);
  await page.keyboard.press("Escape");
  assert.equal(await page.title(), original);
  assert.equal(await shadowCount(page, ".wall-message"), 0);
  await page.close();
});


test("typing possession works in open shadow-root inputs and survives field scrolling", async () => {
  const page = await setup();
  await page.evaluate(() => {
    const host = document.createElement("div");
    host.id = "component";
    const root = host.attachShadow({ mode: "open" });
    const input = document.createElement("input");
    input.id = "component-writing";
    input.style.width = "90px";
    root.append(input);
    document.body.prepend(host);
  });
  await page.locator("#component input").fill("My small shadow draft");
  await page.waitForFunction(phrase => document.getElementById("component").shadowRoot.querySelector("input").value === phrase, phrase);
  await page.locator("#component input").evaluate(input => { input.scrollLeft = 100; input.dispatchEvent(new Event("scroll")); });
  assert.equal(await shadowCount(page, ".possessed-editor"), 0);
  await page.keyboard.press("Escape");
  assert.equal(await page.locator("#component input").inputValue(), "My small shadow draft");
  await page.close();
});


test("the Pinterest-style URL field is possessed without selection API errors", async () => {
  const page = await setup();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.locator("#site-url").fill("elma armut");
  await page.waitForFunction(phrase => document.getElementById("site-url").value === phrase, phrase);
  assert.equal(await shadowCount(page, ".possessed-editor"), 0);
  await page.keyboard.press("Escape");
  assert.equal(await page.locator("#site-url").inputValue(), "elma armut");
  assert.deepEqual(errors, []);
  await page.close();
});

test("the bundle works when all separate stylesheet and asset requests fail", async () => {
  const page = await setup();
  await page.route("https://extension.test/**", route => route.abort());
  const ready = await page.evaluate(() => {
    const root = document.getElementById("haunted-web-root").shadowRoot;
    return { sheets: root.adoptedStyleSheets.length, color: getComputedStyle(root.querySelector(".presence-dialogue")).color, background: getComputedStyle(root.querySelector(".presence-dialogue")).backgroundColor };
  });
  assert.equal(ready.sheets, 1);
  assert.equal(ready.color, "rgb(188, 182, 182)");
  assert.ok(ready.background.startsWith("rgba(7, 7, 6, 0.96"));
  await page.close();
});


test("native typing changes the real value without dispatching the ghost sentence to the app", async () => {
  const page = await setup();
  await page.evaluate(() => {
    window.observedInputs = [];
    document.getElementById("writing").addEventListener("input", event => observedInputs.push(event.target.value));
  });
  await page.locator("#writing").fill("My original sentence");
  await page.waitForFunction(phrase => document.getElementById("writing").value === phrase, phrase);
  assert.equal(await shadowCount(page, ".possessed-editor"), 0);
  assert.equal(await page.evaluate(phrase => observedInputs.includes(phrase), phrase), false);
  await page.keyboard.press("Escape");
  assert.equal(await page.locator("#writing").inputValue(), "My original sentence");
  await page.close();
});

test("the selected fonts load from bundled bytes and warnings stay bounded", async () => {
  const page = await setup("wallwriting");
  await page.waitForFunction(() => Array.from(document.fonts).some(font => font.family === "HauntTypewriter" && font.status === "loaded") && Array.from(document.fonts).some(font => font.family === "HauntHorror" && font.status === "loaded"));
  const values = await page.evaluate(() => {
    const root = document.getElementById("haunted-web-root").shadowRoot;
    const warning = root.querySelector(".wall-writing");
    return { font: getComputedStyle(warning).fontFamily, size: parseFloat(getComputedStyle(warning).fontSize), words: warning.textContent.split(/\s+/).length, duplicates: root.querySelectorAll(".wall-message").length };
  });
  assert.ok(values.font.includes("HauntHorror"));
  assert.ok(values.size <= 72);
  assert.ok(values.words <= 4);
  assert.equal(values.duplicates, 0);
  await page.close();
});

test("signal interruption fades once and reduced motion suppresses the blackout", async () => {
  const page = await setup("blackout");
  await page.waitForTimeout(900);
  const normal = await page.evaluate(() => {
    const root = document.getElementById("haunted-web-root").shadowRoot;
    return { opacity: Number(getComputedStyle(root.querySelector(".signal-loss")).opacity), eyes: root.querySelectorAll(".watcher").length };
  });
  assert.equal(normal.opacity, 1);
  assert.equal(await page.evaluate(() => document.getElementById("haunted-web-root").shadowRoot.querySelectorAll(".signal-loss span").length), 24);
  assert.equal(normal.eyes, 1);
  await page.emulateMedia({ reducedMotion: "reduce" });
  assert.equal(await page.evaluate(() => getComputedStyle(document.getElementById("haunted-web-root").shadowRoot.querySelector(".signal-loss")).display), "none");
  await page.close();
});

test("rich text keeps buffered keystrokes and never sends a ghost input event", async () => {
  const page = await setup();
  await page.evaluate(() => {
    window.richEvents = [];
    document.getElementById("rich").addEventListener("input", event => richEvents.push(event.target.textContent));
  });
  await page.locator("#rich").click();
  await page.keyboard.type("ABC");
  await page.waitForFunction(phrase => document.getElementById("rich").textContent === phrase, phrase);
  await page.keyboard.type("XYZ");
  assert.equal(await page.locator("#rich").textContent(), phrase);
  assert.equal(await page.evaluate(phrase => richEvents.includes(phrase), phrase), false);
  await page.keyboard.press("Escape");
  assert.ok((await page.locator("#rich").textContent()).includes("ABCXYZ"));
  assert.equal(await page.locator("#rich b").count(), 1);
  await page.close();
});

async function soundState(page) {
  return page.evaluate(() => {
    let state;
    listeners[0]({ type: "HAUNT_STATUS" }, {}, result => { state = result.sound; });
    return state;
  });
}

async function waitForSound(page, playing = true) {
  await page.waitForFunction(playing => {
    let state;
    listeners[0]({ type: "HAUNT_STATUS" }, {}, result => { state = result.sound; });
    return state.playing === playing;
  }, playing);
}

test("the score attempts autoplay, then supports volume, mute and resume", async () => {
  const page = await setup();
  assert.ok(["suspended", "running"].includes((await soundState(page)).contextState));
  await page.locator("h1").click();
  await waitForSound(page);
  assert.equal((await soundState(page)).contextState, "running");
  await page.evaluate(() => listeners[0]({ type: "HAUNT_SOUND", volume: .23 }, {}, () => {}));
  assert.equal((await soundState(page)).volume, .23);
  await page.evaluate(() => listeners[0]({ type: "HAUNT_SOUND", enabled: false }, {}, () => {}));
  await waitForSound(page, false);
  assert.equal((await soundState(page)).enabled, false);
  await page.evaluate(() => listeners[0]({ type: "HAUNT_SOUND", enabled: true }, {}, () => {}));
  await waitForSound(page);
  await page.keyboard.press("Escape");
  await waitForSound(page, false);
  await page.close();
});

test("B enters for a refusal and fades while A keeps playing", async () => {
  const page = await setup("scramble");
  await page.locator("h1").click();
  await waitForSound(page);
  await page.locator("#ordinary").click({ force: true });
  assert.equal((await soundState(page)).accentPlaying, true);
  await page.waitForTimeout(4100);
  assert.equal((await soundState(page)).accentPlaying, false);
  assert.equal((await soundState(page)).playing, true);
  await page.keyboard.press("Escape");
  assert.equal((await soundState(page)).playing, false);
  await page.close();
});

test("Escape cancels in-flight audio startup and hiding the page stops the soundtrack", async () => {
  const page = await setup();
  await page.locator("h1").click();
  await page.keyboard.press("Escape");
  await page.waitForTimeout(350);
  assert.equal((await soundState(page)).playing, false);
  await page.evaluate(() => listeners[0]({ type: "HAUNT_TOGGLE" }, {}, () => {}));
  await page.locator("h1").click();
  await waitForSound(page);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await waitForSound(page, false);
  assert.equal((await soundState(page)).accentPlaying, false);
  await page.close();
});

test("forced dark overrides inline white and Escape restores the exact original styles", async () => {
  const page = await setup();
  await page.locator("#story").evaluate(node => { node.style.setProperty("background-color", "white", "important"); });
  await page.waitForFunction(() => getComputedStyle(document.getElementById("story")).backgroundColor === "rgb(8, 8, 7)");
  assert.equal(await page.evaluate(() => getComputedStyle(document.body).backgroundColor), "rgb(8, 8, 7)");
  await page.keyboard.press("Escape");
  assert.equal(await page.locator("#story").evaluate(node => node.style.getPropertyValue("background-color")), "white");
  assert.equal(await page.locator("#story").evaluate(node => node.style.getPropertyPriority("background-color")), "important");
  assert.equal(await page.evaluate(() => document.documentElement.hasAttribute("data-haunted-dark")), false);
  await page.close();
});

test("the faint humanoid changes pose while crossing and no hand stickers remain", async () => {
  const page = await setup("shadow");
  const before = await page.evaluate(() => {
    const node = document.getElementById("haunted-web-root").shadowRoot.querySelector(".walking-shadow");
    return { left: node.getBoundingClientRect().left, pose: node.querySelector("canvas").dataset.pose };
  });
  await page.waitForTimeout(500);
  const after = await page.evaluate(() => {
    const root = document.getElementById("haunted-web-root").shadowRoot;
    const node = root.querySelector(".walking-shadow");
    return { left: node.getBoundingClientRect().left, pose: node.querySelector("canvas").dataset.pose, opacity: Number(getComputedStyle(node).opacity), hands: root.querySelectorAll(".handprint").length };
  });
  assert.ok(after.left > before.left + 20);
  assert.notEqual(after.pose, before.pose);
  assert.ok(after.opacity <= .66);
  assert.equal(after.hands, 0);
  await page.close();
});

test("TV tracking repeats independently of model timing and respects reduced motion", async () => {
  const page = await setup();
  await page.waitForFunction(() => {
    let state;
    listeners[0]({ type: "HAUNT_STATUS" }, {}, value => { state = value; });
    return state.tvBursts >= 2;
  });
  await page.keyboard.press("Escape");
  assert.equal(await shadowCount(page, ".crt-atmosphere"), 0);
  await page.close();
});

test("the presence receives explicit replies, retains model conversation and excludes chat input from possession", async () => {
  const page = await setup();
  const input = page.locator("#haunted-web-root .presence-reply input");
  await input.fill("Who are you? My name is Mira.");
  await input.press("Enter");
  await page.waitForFunction(() => messages.some(message => message.conversation?.some(item => item.role === "user" && item.content.includes("Mira"))));
  assert.equal(await input.inputValue(), "");
  assert.ok(await shadowCount(page, ".presence-line.user") >= 1);
  await input.fill("Do you remember my name?");
  await page.waitForTimeout(350);
  assert.equal(await input.inputValue(), "Do you remember my name?");
  await page.keyboard.press("Escape");
  await page.close();
});

test("local Whisper requests and events duck music and Escape cancels the owned voice", async () => {
  const page = await setup("watchers", false, false, true);
  await page.waitForFunction(() => speechRequests.some(message => message.type === "HAUNT_SPEAK"));
  const id = await page.evaluate(() => speechRequests.find(message => message.type === "HAUNT_SPEAK").id);
  await page.evaluate(id => listeners[0]({ type: "HAUNT_VOICE_EVENT", id, event: "start" }, {}, () => {}), id);
  assert.equal((await soundState(page)).voiceActive, true);
  assert.equal(await page.evaluate(() => speechRequests.find(message => message.type === "HAUNT_SPEAK").text), phrase);
  await page.keyboard.press("Escape");
  assert.equal(await page.evaluate(id => speechRequests.some(message => message.type === "HAUNT_VOICE_STOP" && message.id === id), id), true);
  assert.equal((await soundState(page)).voiceActive, false);
  await page.close();
});


test("one translucent eye pair occupies empty space without covering the dialogue", async () => {
  const page = await setup("watchers");
  await page.waitForTimeout(800);
  const result = await page.evaluate(() => {
    const root = document.getElementById("haunted-web-root").shadowRoot;
    const eye = root.querySelector(".watcher");
    const e = eye.getBoundingClientRect();
    const d = root.querySelector(".presence-dialogue").getBoundingClientRect();
    return { count: root.querySelectorAll(".watcher").length, opacity: Number(getComputedStyle(eye).opacity), overlap: e.left < d.right && e.right > d.left && e.top < d.bottom && e.bottom > d.top };
  });
  assert.equal(result.count, 1);
  assert.ok(result.opacity <= .55);
  assert.equal(result.overlap, false);
  await page.close();
});

test("glass fractures use fine branching paths and stay fixed to the viewport", async () => {
  const page = await setup("cracks");
  const result = await page.evaluate(() => {
    const root = document.getElementById("haunted-web-root").shadowRoot;
    const glass = root.querySelector(".glass-crack");
    return { paths: glass.querySelectorAll("path").length, width: glass.getBoundingClientRect().width, stroke: parseFloat(getComputedStyle(glass.querySelector("path")).strokeWidth), transform: getComputedStyle(glass).transform };
  });
  assert.ok(result.paths > 15);
  assert.equal(result.width, 1100);
  assert.ok(result.stroke < 1);
  assert.equal(result.transform, "none");
  await page.close();
});


test("the opening warning stays at the top and the eyes blink inside a feathered mask", async () => {
  const page = await setup("watchers");
  await page.waitForTimeout(650);
  const before = await page.evaluate(() => {
    const root = document.getElementById("haunted-web-root").shadowRoot;
    const omen = root.querySelector(".opening-omen");
    const eye = root.querySelector(".eye-canvas");
    return { text: omen.textContent, top: omen.getBoundingClientRect().top, mask: getComputedStyle(eye).maskImage, lid: eye.dataset.lid };
  });
  assert.equal(before.text, "IT’S WATCHING YOU");
  assert.equal(before.top, 12);
  assert.match(before.mask, /radial-gradient/);
  await page.waitForFunction(() => Number(document.getElementById("haunted-web-root").shadowRoot.querySelector(".eye-canvas").dataset.lid) < .5);
  await page.keyboard.press("Escape");
  assert.equal(await page.evaluate(() => document.getElementById("haunted-web-root").shadowRoot.querySelector(".opening-omen").hidden), true);
  await page.close();
});


test("a passing presence appears without waiting for the AI to finish", async () => {
  const page = await setup("watchers", true);
  await page.waitForSelector("#haunted-web-root .walking-shadow", { timeout: 7000 });
  const result = await page.evaluate(() => {
    const root = document.getElementById("haunted-web-root").shadowRoot;
    return { count: root.querySelectorAll(".walking-shadow").length, unanswered: root.querySelectorAll(".presence-line.assistant").length };
  });
  assert.equal(result.count, 1);
  assert.equal(result.unanswered, 0);
  await page.keyboard.press("Escape");
  assert.equal(await shadowCount(page, ".walking-shadow"), 0);
  await page.close();
});

test("the blackout grows in staggered bands and its matching sound stops on Escape", async () => {
  const page = await setup("blackout");
  const bands = page.locator("#haunted-web-root .signal-loss span");
  assert.equal(await bands.count(), 24);
  const first = await bands.first().evaluate(n => ({ opacity: Number(getComputedStyle(n).opacity), clip: getComputedStyle(n).clipPath }));
  await page.waitForTimeout(1500);
  const later = await bands.first().evaluate(n => ({ opacity: Number(getComputedStyle(n).opacity), clip: getComputedStyle(n).clipPath }));
  assert.ok(later.opacity > first.opacity);
  assert.notEqual(later.clip, first.clip);
  await page.locator("h1").click();
  await waitForSound(page);
  await page.evaluate(() => { window.__HAUNTED_PREVIEW__ = true; listeners[0]({ type: "HAUNT_PREVIEW", effect: "blackout" }, {}, () => {}); });
  await page.waitForFunction(() => { let state; listeners[0]({ type: "HAUNT_STATUS" }, {}, value => { state = value; }); return state.sound.takeoverPlaying; });
  await page.keyboard.press("Escape");
  assert.equal((await soundState(page)).takeoverPlaying, false);
  assert.equal(await shadowCount(page, ".signal-loss"), 0);
  await page.close();
});


test("AI infestation builds overlapping messages with separate letterforms and leaves chat readable", async () => {
  const page = await setup("infestation");
  const first = await shadowCount(page, ".infestation-line");
  await page.waitForTimeout(1900);
  const result = await page.evaluate(() => {
    const root = document.getElementById("haunted-web-root").shadowRoot;
    const group = root.querySelector(".message-infestation");
    return { count: group.children.length, glyphs: group.querySelectorAll(".omen-glyph").length, chatFont: getComputedStyle(root.querySelector(".presence-line.assistant")).fontFamily, pointerEvents: getComputedStyle(group).pointerEvents };
  });
  assert.ok(result.count > first + 8);
  assert.ok(result.count <= 34);
  assert.ok(result.glyphs > 100);
  assert.match(result.chatFont, /Georgia/);
  assert.equal(result.pointerEvents, "none");
  await page.keyboard.press("Escape");
  assert.equal(await shadowCount(page, ".message-infestation"), 0);
  await page.waitForTimeout(300);
  assert.equal(await shadowCount(page, ".infestation-line"), 0);
  await page.close();
});

test("glass remains fixed after its scene and after another scene starts", async () => {
  const page = await setup("cracks");
  await page.evaluate(() => { window.savedCrack = document.getElementById("haunted-web-root").shadowRoot.querySelector(".glass-crack"); });
  await page.waitForTimeout(3100);
  assert.ok(await page.evaluate(() => Number(getComputedStyle(savedCrack).opacity)) > .5);
  await page.evaluate(() => { window.__HAUNTED_PREVIEW__ = true; listeners[0]({ type: "HAUNT_PREVIEW", effect: "infestation" }, {}, () => {}); });
  assert.equal(await page.evaluate(() => savedCrack.isConnected), true);
  assert.ok(await shadowCount(page, ".permanent-scars .glass-crack") >= 1);
  await page.keyboard.press("Escape");
  assert.equal(await page.evaluate(() => savedCrack.isConnected), false);
  await page.close();
});

test("the director can bend the layout, stain edges and decay images, with complete restoration", async () => {
  for (const effect of ["tilt", "inkbleed", "image-decay"]) {
    const page = await setup(effect);
    assert.equal(await page.evaluate(() => document.documentElement.getAttribute("data-haunted-curse")), effect);
    if (effect === "inkbleed") assert.equal(await shadowCount(page, ".crawling-stain"), 1);
    await page.keyboard.press("Escape");
    assert.equal(await page.evaluate(() => document.documentElement.hasAttribute("data-haunted-curse")), false);
    await page.close();
  }
});


test("automatic jumpscares use the approved random delay and stop completely on Escape", async () => {
  const page = await setup("watchers", false, false, false, true);
  await page.waitForFunction(() => { let state; listeners[0]({ type: "HAUNT_STATUS" }, {}, value => { state = value; }); return state.jumpscares.active; });
  assert.equal(await page.evaluate(() => jumpDelays.every(delay => delay >= 12000 && delay <= 45000)), true);
  const variant = await page.locator("#haunted-web-root .jump-stage").getAttribute("data-variant");
  assert.ok(["face", "entity"].includes(variant));
  await page.keyboard.press("Escape");
  await page.waitForTimeout(1600);
  const result = await page.evaluate(() => { let state; listeners[0]({ type: "HAUNT_STATUS" }, {}, value => { state = value; }); return state; });
  assert.equal(result.jumpscares.active, false);
  assert.equal(result.jumpscares.nextIn, null);
  assert.equal(result.sound.jumpPlaying, false);
  await page.close();
});

test("the embedded jumpscare cue is byte-for-byte the selected B recording", () => {
  const embedded = JSON.parse(script.match(/const HAUNTED_AUDIO = (\{[^\n]+\});/)[1]);
  assert.equal(embedded.jump, readFileSync("assets/sound-audition/b-string-stab.wav").toString("base64"));
});

test("production scenes all play selected B and a cancelled approach cannot play a late cue", async () => {
  const page = await setup();
  await page.locator("h1").click();
  await waitForSound(page);
  await page.evaluate(() => {
    window.jumpEvidence = [];
    const start = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function(...args) {
      if (this.buffer?.duration > 1.7 && this.buffer.duration < 1.9) {
        let state; listeners[0]({ type: "HAUNT_STATUS" }, {}, value => { state = value; });
        jumpEvidence.push({ variant: state.jumpscares.variant, music: state.sound.playing, gain: state.sound.musicGain });
      }
      return start.apply(this, args);
    };
  });
  for (const variant of ["face", "entity"]) {
    const played = await page.evaluate(variant => new Promise(resolve => { window.__HAUNTED_PREVIEW__ = true; window.__HAUNTED_LIVE_PREVIEW__ = true; listeners[0]({ type: "HAUNT_JUMP", variant }, {}, result => resolve(result.played)); }), variant);
    assert.equal(played, true);
    await page.waitForFunction(variant => jumpEvidence.some(item => item.variant === variant && item.music && item.gain > 0), variant);
    await page.waitForFunction(() => { let state; listeners[0]({ type: "HAUNT_STATUS" }, {}, value => { state = value; }); return !state.jumpscares.active; });
  }
  await page.evaluate(() => {
    listeners[0]({ type: "HAUNT_JUMP", variant: "entity" }, {}, () => { document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); });
  });
  await page.waitForTimeout(1600);
  assert.equal((await soundState(page)).jumpPlaying, false);
  await page.close();
});


test("automatic glass appears and makes its crack sound even while the AI is still waiting", async () => {
  const page = await setup("watchers", true);
  await page.locator("h1").click();
  await waitForSound(page);
  await page.waitForFunction(() => {
    let state; listeners[0]({ type: "HAUNT_STATUS" }, {}, value => { state = value; });
    return state.glassCount > 0 && state.sound.lastGlassSoundAt !== null;
  }, null, { timeout: 15000 });
  const result = await page.evaluate(() => { let state; listeners[0]({ type: "HAUNT_STATUS" }, {}, value => { state = value; }); return { state, answers: document.getElementById("haunted-web-root").shadowRoot.querySelectorAll(".presence-line.assistant").length }; });
  assert.equal(result.answers, 0);
  assert.equal(result.state.sound.playing, true);
  assert.ok(result.state.sound.musicGain > 0);
  await page.keyboard.press("Escape");
  assert.equal(await shadowCount(page, ".glass-crack"), 0);
  assert.equal((await soundState(page)).playing, false);
  await page.close();
});


test("ambient eyes and progressive infection run without an AI scene and eyes cannot jumpscare", async () => {
  const page = await setup("watchers", true);
  await page.locator("h1").click();
  await waitForSound(page);
  await page.waitForFunction(() => document.getElementById("haunted-web-root").shadowRoot.querySelector(".autonomous-infection.infecting"));
  assert.equal(await shadowCount(page, ".autonomous-infection i"), 32);
  await page.waitForFunction(() => document.getElementById("haunted-web-root").shadowRoot.querySelector(".ambient-eyes .watcher"), null, { timeout: 12000 });
  assert.ok(await shadowCount(page, ".watcher") <= 1);
  await page.evaluate(() => { window.__HAUNTED_PREVIEW__ = true; });
  const result = await page.evaluate(() => new Promise(resolve => listeners[0]({ type: "HAUNT_JUMP", variant: "eyes" }, {}, resolve)));
  assert.equal(result.played, false);
  await page.keyboard.press("Escape");
  assert.equal(await shadowCount(page, ".ambient-eyes"), 0);
  assert.equal(await shadowCount(page, ".autonomous-infection"), 0);
  await page.close();
});

test("new glass impacts accumulate beyond three without removing earlier cracks", async () => {
  const page = await setup("cracks");
  await page.evaluate(() => { window.firstScar = document.getElementById("haunted-web-root").shadowRoot.querySelector(".glass-crack"); window.__HAUNTED_PREVIEW__ = true; });
  for (let index = 0; index < 4; index++) await page.evaluate(() => listeners[0]({ type: "HAUNT_PREVIEW", effect: "cracks" }, {}, () => {}));
  assert.ok(await shadowCount(page, ".permanent-scars .glass-crack") >= 5);
  assert.equal(await page.evaluate(() => firstScar.isConnected), true);
  await page.keyboard.press("Escape");
  assert.equal(await shadowCount(page, ".glass-crack"), 0);
  await page.close();
});
