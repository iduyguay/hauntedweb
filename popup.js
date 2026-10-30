const statusNode = document.getElementById("status");
const toggle = document.getElementById("toggle");
const soundToggle = document.getElementById("sound-toggle");
const soundStatus = document.getElementById("sound-status");
const volume = document.getElementById("volume");
const volumeValue = document.getElementById("volume-value");
let tabId;
let soundEnabled = true;

async function refresh() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    tabId = tab.id;
    const state = await chrome.tabs.sendMessage(tabId, { type: "HAUNT_STATUS" });
    statusNode.textContent = state.status;
    document.getElementById("voice-status").textContent = state.voice?.available ? "Local whisper voice ready" : "Local English voice unavailable";
    document.getElementById("engine").textContent = state.version === "6.5.1" && state.stylesReady ? "Page updated · Visuals ready" : "Reload this page to activate version 6.5.1";
    toggle.textContent = state.enabled ? "Pause the curse" : "Release the spirit";
    toggle.disabled = false;
    soundEnabled = state.sound?.enabled ?? true;
    soundToggle.disabled = !state.sound;
    soundToggle.textContent = soundEnabled ? "Mute soundtrack" : "Enable soundtrack";
    soundStatus.textContent = state.sound?.status || "Reload the page for sound controls";
    volume.disabled = !state.sound;
    if (document.activeElement !== volume) {
      volume.value = Math.round((state.sound?.volume ?? .4) * 100);
      volumeValue.textContent = `${volume.value}%`;
    }
  } catch {
    statusNode.textContent = "Open a regular website and reload it to invite the spirit.";
    toggle.disabled = true;
    soundToggle.disabled = true;
    volume.disabled = true;
    soundStatus.textContent = "Open a website to use sound controls";
    toggle.textContent = "No spirit on this page";
  }
}

toggle.addEventListener("click", async () => {
  toggle.disabled = true;
  try {
    await chrome.tabs.sendMessage(tabId, { type: "HAUNT_TOGGLE" });
  } finally {
    await refresh();
  }
});
soundToggle.addEventListener("click", async () => {
  try { await chrome.tabs.sendMessage(tabId, { type: "HAUNT_SOUND", enabled: !soundEnabled }); }
  finally { await refresh(); }
});
volume.addEventListener("input", async () => {
  volumeValue.textContent = `${volume.value}%`;
  try { await chrome.tabs.sendMessage(tabId, { type: "HAUNT_SOUND", volume: Number(volume.value) / 100 }); }
  catch { await refresh(); }
});
refresh();
setInterval(refresh, 1500);
