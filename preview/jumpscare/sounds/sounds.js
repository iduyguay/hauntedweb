const players = [...document.querySelectorAll("audio")];
for (const player of players) {
  player.volume = .35;
  player.addEventListener("play", () => {
    for (const other of players) if (other !== player) { other.pause(); other.currentTime = 0; }
  });
}
function stopAll() {
  for (const player of players) { player.pause(); player.currentTime = 0; }
}
document.getElementById("stop").addEventListener("click", stopAll);
document.addEventListener("keydown", event => { if (event.key === "Escape") stopAll(); });
document.addEventListener("visibilitychange", () => { if (document.hidden) stopAll(); });
addEventListener("pagehide", stopAll);
