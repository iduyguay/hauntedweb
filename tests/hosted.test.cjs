const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const runtime = fs.readFileSync('preview/runtime.js', 'utf8');

test('hosted runtime performs inference on-device without a cloud request', async () => {
  const calls = [];
  const signal = new AbortController().signal;
  const context = vm.createContext({ __HAUNTED_HOSTED__: true, fetch: async () => { throw new Error('Unexpected cloud fetch'); }, addEventListener() {}, hauntedBrowserModel: { complete: async (body, signal) => { calls.push({ body, signal }); return { ok: true }; } } });
  vm.runInContext(runtime, context);
  await context.fetch('http://localhost:11434/api/chat', { body: '{"messages":[]}', signal });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].signal, signal);
  let voices;
  context.chrome.tts.getVoices(result => { voices = result; });
  assert.equal(voices.length, 0);
});

test('local preview preserves Ollama proxy and Whisper voice', async () => {
  const calls = [];
  const context = vm.createContext({ fetch: async url => { calls.push(url); return { ok: true }; }, addEventListener() {} });
  vm.runInContext(runtime, context);
  await context.fetch('http://localhost:11434/api/chat', { body: '{}' });
  assert.equal(calls[0], '/__haunt/generate');
  let voices;
  context.chrome.tts.getVoices(result => { voices = result; });
  assert.equal(voices[0].voiceName, 'Whisper');
});

test('hosted build includes model controls and the model worker', () => {
  const html = fs.readFileSync('dist/preview/index.html', 'utf8');
  assert.ok(html.includes('id="start-signal"'));
  assert.ok(html.indexOf('browser-model.js') < html.indexOf('runtime.js'));
  assert.ok(fs.existsSync('dist/preview/model-worker.js'));
  assert.ok(fs.existsSync('dist/LICENSE'));
  assert.ok(!fs.existsSync('api/generate.js'));
});
