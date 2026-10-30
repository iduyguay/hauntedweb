const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const handler = require('../api/generate.js');

function response() {
  return { code: 200, headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
}
const request = body => ({ method: 'POST', headers: { host: 'haunted.test', origin: 'https://haunted.test' }, body });

test('hosted endpoint validates requests before contacting a provider', async () => {
  for (const [req, expected] of [
    [{ method: 'GET', headers: {} }, 405],
    [{ ...request({}), headers: { host: 'haunted.test', origin: 'https://elsewhere.test' } }, 403],
    [request({ messages: [{ role: 'tool', content: 'test' }] }), 400],
    [request({ messages: [{ role: 'user', content: 'x'.repeat(25000) }] }), 413]
  ]) {
    const res = response();
    await handler(req, res);
    assert.equal(res.code, expected);
  }
});

test('hosted endpoint adapts cloud replies and keeps credentials on the server', async () => {
  const original = { fetch: global.fetch, model: process.env.AI_GATEWAY_MODEL, token: process.env.VERCEL_OIDC_TOKEN, key: process.env.AI_GATEWAY_API_KEY };
  process.env.AI_GATEWAY_MODEL = 'test/model';
  process.env.VERCEL_OIDC_TOKEN = 'test-token';
  delete process.env.AI_GATEWAY_API_KEY;
  let sent;
  global.fetch = async (url, options) => {
    if (url.endsWith('/models')) return { ok: true, json: async () => ({ data: [{ id: 'test/model', pricing: { input: '0', output: '0' } }] }) };
    sent = { url, options, body: JSON.parse(options.body) };
    return { ok: true, json: async () => ({ choices: [{ message: { content: 'I heard you.' } }] }) };
  };
  try {
    const res = response();
    await handler(request({ model: 'untrusted/model', messages: [{ role: 'user', content: 'Hello' }], options: { num_predict: 999999 } }), res);
    assert.equal(res.code, 200);
    assert.equal(res.body.message.content, 'I heard you.');
    assert.equal(sent.body.model, 'test/model');
    assert.equal(sent.body.max_tokens, 220);
    assert.equal(sent.options.headers.Authorization, 'Bearer test-token');
    assert.ok(!JSON.stringify(res.body).includes('test-token'));
    global.fetch = async () => ({ ok: false, status: 402, json: async () => ({ error: { code: 'insufficient_funds' } }) });
    const unavailable = response();
    await handler(request({ messages: [{ role: 'user', content: 'Hello' }] }), unavailable);
    assert.equal(unavailable.code, 503);
    assert.match(unavailable.body.error, /credit/);
    assert.equal(unavailable.body.reason, 'insufficient_funds');
  } finally {
    global.fetch = original.fetch;
    for (const [key, value] of Object.entries({ AI_GATEWAY_MODEL: original.model, VERCEL_OIDC_TOKEN: original.token, AI_GATEWAY_API_KEY: original.key })) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});

test('hosted runtime routes chat to the cloud and lets the narrator select browser voices', async () => {
  for (const hosted of [false, true]) {
    const calls = [];
    const context = vm.createContext({ __HAUNTED_HOSTED__: hosted, fetch: async url => { calls.push(url); return { ok: true }; }, addEventListener() {} });
    vm.runInContext(fs.readFileSync('preview/runtime.js', 'utf8'), context);
    await context.fetch('http://localhost:11434/api/chat', {});
    assert.equal(calls[0], hosted ? '/api/generate' : '/__haunt/generate');
    let voices;
    context.chrome.tts.getVoices(result => { voices = result; });
    assert.equal(voices.length, hosted ? 0 : 1);
  }
});
