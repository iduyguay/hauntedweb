const fs = require('node:fs');
const path = require('node:path');
require('./build.cjs');
const output = path.join(__dirname, '..', 'dist');
fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output, { recursive: true });
for (const file of ['preview', 'assets', 'background.js', 'content.js', 'ghost.png']) {
  fs.cpSync(path.join(__dirname, '..', file), path.join(output, file), { recursive: true });
}
const index = path.join(output, 'preview/index.html');
fs.writeFileSync(index, fs.readFileSync(index, 'utf8').replace('Live local Gemma conversation and local Whisper voice. Use the SIGNAL panel to answer.', 'SIGNAL uses a cloud service; avoid sharing personal information. Voice availability depends on your browser and device.'));
const runtime = path.join(output, 'preview/runtime.js');
fs.writeFileSync(runtime, 'globalThis.__HAUNTED_HOSTED__ = true;\n' + fs.readFileSync(runtime, 'utf8'));
