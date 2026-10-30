const fs = require('node:fs');
const path = require('node:path');
require('./build.cjs');
const output = path.join(__dirname, '..', 'dist');
fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output, { recursive: true });
for (const file of ['preview', 'assets', 'background.js', 'content.js', 'ghost.png', 'LICENSE']) {
  fs.cpSync(path.join(__dirname, '..', file), path.join(output, file), { recursive: true });
}
const index = path.join(output, 'preview/index.html');
fs.writeFileSync(index, fs.readFileSync(index, 'utf8')
  .replace('<script src="runtime.js" defer>', '<script src="browser-model.js" defer></script>\n  <script src="runtime.js" defer>')
  .replace('<nav aria-label="Effect previews">', `<section class="local-signal" aria-label="Local conversation">
    <label for="signal-model">Wake SIGNAL on your device — no account or paid API</label>
    <select id="signal-model"><option value="small">Lightweight · SmolLM2 360M · roughly 200–300 MB download</option><option value="gemma">Gemma 2 2B · roughly 1.5–2 GB download</option></select>
    <button id="start-signal" type="button">Start free chat</button>
    <p id="signal-download" class="small" role="status">Optional download. Requires WebGPU and enough device memory. Model files are cached by your browser; messages are processed on your device.</p>
  </section><nav aria-label="Effect previews">`)
  .replace('Live local Gemma conversation and local Whisper voice. Use the SIGNAL panel to answer.', 'Conversation runs on your device after the optional model download. Voice availability depends on your browser and device.'));
const runtime = path.join(output, 'preview/runtime.js');
fs.writeFileSync(runtime, 'globalThis.__HAUNTED_HOSTED__ = true;\n' + fs.readFileSync(runtime, 'utf8'));
