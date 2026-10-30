const fs = require("node:fs");
const css = fs.readFileSync("ghost.css", "utf8") + "\n" + fs.readFileSync("src/jumpscare.css", "utf8");
const jumpEngine = fs.readFileSync("src/jumpscare.js", "utf8");
const engine = fs.readFileSync("src/engine.js", "utf8");
const environment = fs.readFileSync("src/environment.js", "utf8");
const narrator = fs.readFileSync("src/narrator.js", "utf8");
const pageCss = fs.readFileSync("page-dark.css", "utf8");
const audioEngine = fs.readFileSync("src/audio.js", "utf8");
const audio = Object.fromEntries([["piano", "a-dark-piano.wav"], ["pressure", "b-analog-pressure.wav"]].map(([name, file]) => [name, fs.readFileSync(`assets/previews/${file}`).toString("base64")]));
audio.jump = fs.readFileSync("assets/sound-audition/b-string-stab.wav").toString("base64");
const media = Object.fromEntries(["watching-eyes", "jumpscare-face", "jumpscare-entity"].map(name => [name, fs.readFileSync(`assets/${name}.png`).toString("base64")]));
const fonts = Object.fromEntries([["HauntTypewriter", "SpecialElite-Regular.ttf"], ["HauntBrush", "RoadRage-Regular.ttf"], ["HauntHorror", "GhastlyPanic.ttf"]].map(([name, file]) => [name, fs.readFileSync(`assets/fonts/${file}`).toString("base64")]));
const output = `const HAUNTED_CSS = ${JSON.stringify(css)};\nconst HAUNTED_MEDIA = ${JSON.stringify(media)};\nconst HAUNTED_FONTS = ${JSON.stringify(fonts)};\nconst HAUNTED_AUDIO = ${JSON.stringify(audio)};\nconst HAUNTED_PAGE_CSS = ${JSON.stringify(pageCss)};\n${audioEngine}\n${environment}\n${narrator}\n${jumpEngine}\n${engine}`;
if (process.argv.includes("--check")) {
  if (fs.readFileSync("content.js", "utf8") !== output) throw new Error("content.js is out of date. Run npm run build.");
} else fs.writeFileSync("content.js", output);
