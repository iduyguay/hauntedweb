for (const button of document.querySelectorAll("[data-scene]")) {
  button.addEventListener("click", () => {
    for (const item of document.querySelectorAll("[data-scene]")) item.classList.toggle("active", item === button);
    hauntPreviewMessage({ type: "HAUNT_PREVIEW", effect: button.dataset.scene }, () => {});
  });
}
document.getElementById("resume").addEventListener("click", () => hauntPreviewMessage({ type: "HAUNT_STATUS" }, state => {
  if (!state.enabled) hauntPreviewMessage({ type: "HAUNT_TOGGLE" }, () => {});
}));
document.getElementById("clear").addEventListener("click", () => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
for (const audio of document.querySelectorAll("audio")) audio.addEventListener("play", () => {
  hauntPreviewMessage({ type: "HAUNT_SOUND", enabled: false }, () => {});
  for (const other of document.querySelectorAll("audio")) if (other !== audio) other.pause();
});

let mixPlaying = false;
let mixEnabled = true;
document.getElementById("mix").addEventListener("click", () => {
  for (const audio of document.querySelectorAll("audio")) audio.pause();
  hauntPreviewMessage({ type: "HAUNT_SOUND", enabled: !mixEnabled, start: !mixEnabled }, () => {});
});
setInterval(() => hauntPreviewMessage({ type: "HAUNT_STATUS" }, state => {
  document.getElementById("activity-status").textContent = !state.enabled ? "Paused. Resume the curse to restart automatic events." : `Glass impacts: ${state.glassCount || 0} · ${state.jumpscares?.active ? "Jumpscare active" : state.jumpscares?.nextIn != null ? `Next jumpscare in ${Math.ceil(state.jumpscares.nextIn / 1000)}s` : "Jumpscare is preparing"}`;
  mixPlaying = Boolean(state.sound?.playing);
  mixEnabled = state.sound?.enabled ?? true;
  document.getElementById("mix").textContent = mixEnabled ? "Mute audio" : "Unmute audio";
  document.getElementById("mix-status").textContent = state.sound?.accentPlaying ? "A + B · Event pressure is playing" : state.sound?.status || "Sound ready";
}), 600);
