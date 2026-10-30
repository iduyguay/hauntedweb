const fs = require("node:fs");
const { chromium } = require("playwright");

(async () => {
  const root = "assets/sound-audition";
  const files = ["high_pitch_scream.mp3", "abyss.ogg", "piano-sting.mp3"];
  const data = Object.fromEntries(files.map(name => [name, fs.readFileSync(`${root}/sources/${name}`).toString("base64")]));
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const results = await page.evaluate(async input => {
      const rate = 44100;
      const context = new OfflineAudioContext(2, 1, rate);
      const decoded = {};
      for (const [name, base64] of Object.entries(input)) {
        const bytes = Uint8Array.from(atob(base64), char => char.charCodeAt(0));
        const buffer = await context.decodeAudioData(bytes.buffer);
        const channels = [buffer.getChannelData(0), buffer.getChannelData(Math.min(1, buffer.numberOfChannels - 1))];
        let peak = 0;
        for (const channel of channels) for (const value of channel) peak = Math.max(peak, Math.abs(value));
        let onset = channels[0].findIndex(value => Math.abs(value) > peak * .18);
        onset = Math.max(0, onset - Math.round(rate * .012));
        decoded[name] = { channels, onset, duration: buffer.duration };
      }
      const sample = (name, channel, seconds, speed = 1) => {
        if (seconds < 0) return 0;
        const item = decoded[name], values = item.channels[channel];
        const position = item.onset + seconds * rate * speed;
        const left = Math.floor(position), mix = position - left;
        return (values[left] || 0) * (1 - mix) + (values[left + 1] || 0) * mix;
      };
      const render = (name, duration, signal) => {
        const channels = [new Float32Array(Math.round(rate * duration)), new Float32Array(Math.round(rate * duration))];
        let peak = 0;
        for (let channel = 0; channel < 2; channel++) for (let i = 0; i < channels[channel].length; i++) {
          const t = i / rate;
          const fade = Math.min(1, t / .003) * Math.min(1, (duration - t) / .16);
          const value = Math.tanh(signal(t, channel) * 1.45) * fade;
          channels[channel][i] = value;
          peak = Math.max(peak, Math.abs(value));
        }
        const bytes = new ArrayBuffer(44 + channels[0].length * 4), view = new DataView(bytes);
        const text = (offset, value) => { for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i)); };
        text(0, "RIFF"); view.setUint32(4, bytes.byteLength - 8, true); text(8, "WAVE"); text(12, "fmt ");
        view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 2, true); view.setUint32(24, rate, true);
        view.setUint32(28, rate * 4, true); view.setUint16(32, 4, true); view.setUint16(34, 16, true); text(36, "data"); view.setUint32(40, bytes.byteLength - 44, true);
        let offset = 44;
        for (let i = 0; i < channels[0].length; i++) for (let channel = 0; channel < 2; channel++) { view.setInt16(offset, Math.round(channels[channel][i] / Math.max(peak, .00001) * .42 * 32767), true); offset += 2; }
        const values = new Uint8Array(bytes);
        let binary = "";
        for (let start = 0; start < values.length; start += 8192) binary += String.fromCharCode(...values.subarray(start, start + 8192));
        return { name, duration, base64: btoa(binary) };
      };
      return {
        sources: Object.fromEntries(Object.entries(decoded).map(([name, item]) => [name, { duration: item.duration, onset: item.onset / rate }])),
        clips: [
          render("a-vocal-shriek", 1.65, (t, ch) => .8 * sample("high_pitch_scream.mp3", ch, t, .84) + .21 * sample("high_pitch_scream.mp3", 1 - ch, t - .014, 1.03)),
          render("b-string-stab", 1.8, (t, ch) => sample("abyss.ogg", ch, t, .92)),
          render("c-layered-attack", 2.15, (t, ch) => {
            const lead = t < .18 ? sample("abyss.ogg", ch, .7 - t * 2, 1) * t / .18 * .2 : 0;
            const hit = sample("piano-sting.mp3", ch, t - .18, .72) * .8;
            const tail = sample("high_pitch_scream.mp3", 1 - ch, t - .23, .61) * .38;
            const edge = sample("abyss.ogg", ch, t - .18, 1.05) * .3;
            return lead + hit + tail + edge;
          })
        ]
      };
    }, data);
    for (const clip of results.clips) { fs.writeFileSync(`${root}/${clip.name}.wav`, Buffer.from(clip.base64, "base64")); console.log(`${clip.name}: ${clip.duration}s, peak 0.42`); }
    console.log(JSON.stringify(results.sources));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
