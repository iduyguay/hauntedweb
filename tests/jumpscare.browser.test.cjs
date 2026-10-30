const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");
let browser;
const root = process.cwd();
before(async () => { browser = await chromium.launch({ headless: true }); });
after(async () => { await browser?.close(); });

async function setup() {
  const page = await browser.newPage({ viewport: { width: 1280, height: 850 } });
  await page.route("https://jump.test/**", route => {
    const name = path.resolve(root, "." + new URL(route.request().url()).pathname);
    if (!name.startsWith(root + path.sep) || !fs.existsSync(name)) return route.abort();
    const type = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".wav": "audio/wav" }[path.extname(name)] || "application/octet-stream";
    return route.fulfill({ contentType: type, body: fs.readFileSync(name) });
  });
  await page.goto("https://jump.test/preview/jumpscare/index.html");
  await page.waitForFunction(() => globalThis.jumpAudition?.state.ready);
  return page;
}
const state = page => page.evaluate(() => jumpAudition.state);

test("the audition loads real images and sounds without automatically starting any scene", async () => {
  const page = await setup();
  assert.equal((await state(page)).automatic, false);
  assert.equal((await state(page)).variant, null);
  assert.equal((await state(page)).audioPlaying, false);
  const buffers = await page.evaluate(() => Object.values(jumpAudition.buffers).map(buffer => buffer.duration));
  assert.equal(buffers.length, 1);
  assert.ok(buffers[0] > 1.7 && buffers[0] < 1.9);
  await page.close();
});

test("each of the two visuals plays on request and restores the audition afterwards", async () => {
  const page = await setup();
  await page.selectOption("#sound", "sting");
  for (const variant of ["face", "entity"]) {
    await page.click(`[data-jump="${variant}"]`);
    await page.waitForFunction(variant => jumpAudition.state.variant === variant && document.getElementById("visual").naturalWidth > 0, variant);
    await page.waitForFunction(() => jumpAudition.state.variant === null);
    assert.equal((await state(page)).audioPlaying, false);
  }
  await page.close();
});

test("the approach delays its cue and Escape cancels both the image and pending sound", async () => {
  const page = await setup();
  await page.selectOption("#sound", "sting");
  await page.click('[data-jump="entity"]');
  await page.waitForTimeout(300);
  assert.equal((await state(page)).audioPlaying, false);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(1500);
  assert.equal((await state(page)).variant, null);
  assert.equal((await state(page)).audioPlaying, false);
  await page.close();
});

test("a new scene interrupts the old one without leaking its delayed cue", async () => {
  const page = await setup();
  await page.evaluate(() => { window.played = []; const original = jumpAudition.playBuffer.bind(jumpAudition); jumpAudition.playBuffer = name => { played.push(name); original(name); }; });
  await page.selectOption("#sound", "sting");
  await page.click('[data-jump="entity"]');
  await page.waitForTimeout(250);
  await page.selectOption("#sound", "sting");
  await page.click('[data-jump="face"]');
  await page.waitForTimeout(1700);
  assert.deepEqual(await page.evaluate(() => played), ["sting"]);
  await page.waitForFunction(() => jumpAudition.state.variant === null);
  await page.close();
});

test("real audio is audible at positive gain, silent at zero, and stops on tab hiding", async () => {
  const page = await setup();
  await page.evaluate(() => { window.audioMax = 0; window.audioSampler = setInterval(() => { const values = new Float32Array(jumpAudition.analyser.fftSize); jumpAudition.analyser.getFloatTimeDomainData(values); audioMax = Math.max(audioMax, ...values.map(Math.abs)); }, 10); });
  await page.click('[data-sound="sting"]');
  await page.waitForFunction(() => audioMax > .001, null, { polling: 50, timeout: 5000 });
  await page.evaluate(() => clearInterval(audioSampler));
  await page.evaluate(() => { document.getElementById("volume").value = "0"; document.getElementById("volume").dispatchEvent(new Event("input", { bubbles: true })); });
  assert.equal((await state(page)).volume, 0);
  await page.waitForTimeout(100);
  const level = await page.evaluate(() => { const values = new Float32Array(jumpAudition.analyser.fftSize); jumpAudition.analyser.getFloatTimeDomainData(values); return Math.max(...values.map(Math.abs)); });
  assert.ok(level < .001);
  await page.evaluate(() => { Object.defineProperty(document, "hidden", { configurable: true, value: true }); document.dispatchEvent(new Event("visibilitychange")); });
  assert.equal((await state(page)).audioPlaying, false);
  await page.close();
});

test("reduced motion removes approach scaling and random visuals use only the selected B sound", async () => {
  const page = await setup();
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (let index = 0; index < 5; index++) {
    await page.click('[data-jump="random"]');
    await page.waitForFunction(() => jumpAudition.state.variant !== null);
    const current = await state(page);
    assert.ok(["face", "entity"].includes(current.variant));
    assert.ok(current.sound === "sting");
    assert.equal(await page.locator("#visual").evaluate(node => getComputedStyle(node).animationName), "none");
    await page.keyboard.press("Escape");
  }
  await page.close();
});
