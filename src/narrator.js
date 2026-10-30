class HauntedNarrator {
  constructor(canSpeak, volume, activity) {
    this.canSpeak = canSpeak;
    this.volume = volume;
    this.activity = activity;
    this.pending = "";
    this.enabled = true;
    this.refresh = () => {
      const voices = globalThis.speechSynthesis?.getVoices() || [];
      const local = voices.filter(voice => voice.localService && /^en/i.test(voice.lang));
      this.voice = local.find(voice => /whisper/i.test(voice.name)) || local.find(voice => /daniel|alex|samantha/i.test(voice.name)) || local[0];
    };
    this.refresh();
    chrome.runtime.sendMessage({ type: "HAUNT_VOICE_INFO" }).then(result => {
      this.nativeVoice = result?.voice;
      this.flush();
    }).catch(() => {});
    globalThis.speechSynthesis?.addEventListener("voiceschanged", () => { this.refresh(); this.flush(); });
  }

  get state() {
    return { available: Boolean(this.nativeVoice || this.voice), enabled: this.enabled, speaking: Boolean(this.utterance), voice: this.nativeVoice?.name || this.voice?.name || "No local English voice" };
  }

  say(text, priority = false) {
    this.pending = text;
    if (priority && this.utterance) this.stop(false);
    this.flush();
  }

  flush() {
    this.refresh();
    if (!this.pending || this.utterance || (!this.nativeVoice && !this.voice) || !this.enabled || !this.canSpeak()) return;
    const text = this.pending;
    this.pending = "";
    if (this.nativeVoice) {
      const token = { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, native: true };
      this.utterance = token;
      chrome.runtime.sendMessage({ type: "HAUNT_SPEAK", id: token.id, text, volume: Math.min(.8, this.volume() * 1.65) }).then(result => {
        if (this.utterance !== token || !result?.error) return;
        this.utterance = undefined;
        this.nativeVoice = undefined;
        this.pending = text;
        this.activity(false);
        this.flush();
      }).catch(() => {
        if (this.utterance === token) { this.utterance = undefined; this.activity(false); }
      });
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    this.utterance = utterance;
    utterance.voice = this.voice;
    utterance.lang = "en-US";
    utterance.pitch = .3;
    utterance.rate = /whisper/i.test(this.voice.name) ? .9 : .78;
    utterance.volume = Math.min(.8, this.volume() * 1.65);
    utterance.onstart = () => this.activity(true);
    const finish = event => {
      if (this.utterance !== utterance) return;
      this.utterance = undefined;
      this.activity(false);
      if (event?.error === "not-allowed") { this.pending = text; return; }
      this.flush();
    };
    utterance.onend = finish;
    utterance.onerror = finish;
    speechSynthesis.speak(utterance);
  }

  handle(message) {
    if (!this.utterance?.native || this.utterance.id !== message.id) return;
    if (message.event === "start") this.activity(true);
    if (["end", "error", "interrupted", "cancelled"].includes(message.event)) {
      this.utterance = undefined;
      this.activity(false);
      this.flush();
    }
  }

  stop(clear = true) {
    const own = this.utterance;
    this.utterance = undefined;
    if (clear) this.pending = "";
    if (own?.native) chrome.runtime.sendMessage({ type: "HAUNT_VOICE_STOP", id: own.id }).catch(() => {});
    else if (own) speechSynthesis.cancel();
    this.activity(false);
  }
}
