const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { mkdirSync } = require("node:fs");
const { chromium } = require("playwright");

function collect(node, className, result = []) {
  const attributes = node.attributes || [];
  const index = attributes.indexOf("class");
  if (index >= 0 && attributes[index + 1].split(/\s+/).includes(className)) result.push(node);
  for (const child of [...(node.children || []), ...(node.shadowRoots || [])]) collect(child, className, result);
  return result;
}

async function states(worker) {
  return worker.evaluate(async () => {
    const tabs = await chrome.tabs.query({});
    return (await Promise.all(tabs.map(tab => chrome.tabs.sendMessage(tab.id, { type: "HAUNT_STATUS" }).catch(() => null)))).filter(Boolean);
  });
}

test("real MV3 isolation: bundled visuals, URL possession and actual text mutation work with every page resource blocked", { timeout: 45000 }, async () => {
  const extension = path.resolve(".");
  const context = await chromium.launchPersistentContext("", {
    headless: true,
    channel: "chromium",
    viewport: { width: 1200, height: 850 },
    args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`]
  });
  try {
    let modelRequests = 0;
    await context.route("http://localhost:11434/api/chat", async route => {
      modelRequests++;
      const schema = route.request().postDataJSON().format;
      await route.fulfill({ contentType: "application/json", body: JSON.stringify({ done: true, response: JSON.stringify({ target: 0, effect: schema.properties.effect.enum.includes("apparition") ? "apparition" : schema.properties.effect.enum[0], message: "You reached the dark room. What are you looking for?", duration: 7, delay: 2 }) }) });
    });
    await context.route("https://haunted.integration.test/**", route => route.fulfill({
      contentType: "text/html",
      headers: { "Content-Security-Policy": "default-src 'none'; script-src 'none'; style-src 'none'; connect-src 'none'; img-src 'none'" },
      body: '<!DOCTYPE html><html><head><title>Integration archive</title></head><body><h1 id="heading">Media library is now available</h1><h2>The business center</h2><p>Every visitor leaves a memory behind in this archive.</p><p>There is something watching from the empty space.</p><form><label>Your website <input id="website" type="url" aria-label="Website address"></label><button type="submit">Submit</button></form><textarea id="writing"></textarea><button id="explore">Explore</button></body></html>'
    }));
    const worker = context.serviceWorkers()[0] || await context.waitForEvent("serviceworker");
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto("https://haunted.integration.test/");
    let state;
    for (let attempt = 0; attempt < 60; attempt++) {
      state = (await states(worker)).find(item => item.version === "6.6.0");
      if (state?.activeEffect) break;
      await page.waitForTimeout(150);
    }
    assert.equal(state?.stylesReady, true);
    assert.ok(state.activeEffect);
    assert.equal(state.ghostCount, 1);
    assert.equal(state.voice.available, true);
    assert.match(state.voice.voice, /whisper|fısılt/i);
    assert.ok(modelRequests > 0, "The actual service worker must use the test model bridge");
    assert.equal(await page.evaluate(() => typeof globalThis.__hauntedWeb), "undefined", "The engine must run in an isolated extension world");
    assert.equal(await page.evaluate(() => document.getElementById("haunted-web-root").shadowRoot), null);
    const cdp = await context.newCDPSession(page);
    await cdp.send("DOM.enable");
    await cdp.send("CSS.enable");
    let tree = await cdp.send("DOM.getDocument", { depth: -1, pierce: true });
    const message = collect(tree.root, "presence-dialogue")[0];
    assert.ok(message, "The real extension must display a message");
    const computed = await cdp.send("CSS.getComputedStyleForNode", { nodeId: message.nodeId });
    const value = name => computed.computedStyle.find(item => item.name === name)?.value;
    assert.equal(value("color"), "rgb(188, 182, 182)");
    assert.equal(await page.evaluate(() => getComputedStyle(document.body).backgroundColor), "rgb(8, 8, 7)");
    assert.equal(value("position"), "fixed");
    assert.ok(value("background-color").startsWith("rgba(7, 7, 6, 0.96"));
    await page.evaluate(() => { window.renderLoop = setInterval(() => { document.getElementById("heading").textContent = "A fresh application render"; }, 50); });
    tree = await cdp.send("DOM.getDocument", { depth: -1, pierce: true });
    assert.equal(collect(tree.root, "text-echo").length, 0);
    assert.ok(state.textChanges > 0);
    if (process.env.HAUNT_SCREENSHOT_DIR) {
      mkdirSync(process.env.HAUNT_SCREENSHOT_DIR, { recursive: true });
      await page.screenshot({ path: path.join(process.env.HAUNT_SCREENSHOT_DIR, "real-extension.png") });
    }
    assert.equal(state.dark, true);
    await page.locator("#heading").click();
    for (let attempt = 0; attempt < 60; attempt++) {
      state = (await states(worker)).find(item => item.version === "6.6.0");
      if (state.sound.playing && state.sound.signalLevel > .00001) break;
      await page.waitForTimeout(100);
    }
    assert.equal(state.sound.playing, true);
    assert.ok(state.sound.signalLevel > .00001, "The actual audio graph must contain a nonzero signal");
    await page.locator("#explore").click({ force: true });
    state = (await states(worker)).find(item => item.version === "6.6.0");
    assert.equal(state.sound.accentPlaying, true);
    await page.locator("#website").fill("elma armut");
    await page.waitForFunction(() => document.getElementById("website").value === "You reached the dark room. What are you looking for?");
    state = (await states(worker)).find(item => item.version === "6.6.0");
    assert.equal(state.possessedFields, 1);
    await page.keyboard.press("Escape");
    assert.equal(await page.locator("#website").inputValue(), "elma armut");
    assert.equal((await states(worker))[0].enabled, false);
    assert.equal((await states(worker))[0].sound.playing, false);
    assert.equal((await states(worker))[0].sound.signalLevel, 0);
    assert.equal(await page.evaluate(() => document.documentElement.hasAttribute("data-haunted-dark")), false);
    await page.waitForTimeout(80);
    assert.equal(await page.locator("#heading").textContent(), "A fresh application render");
    assert.deepEqual(errors, []);
    await page.evaluate(() => clearInterval(renderLoop));
  } finally {
    await context.close();
  }
});
