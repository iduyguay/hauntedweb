(() => {
  globalThis.__HAUNTED_PREVIEW__ = true;
  globalThis.__HAUNTED_LIVE_PREVIEW__ = true;
  const handlers = [];
  const originalFetch = fetch.bind(globalThis);
  const hosted = Boolean(globalThis.__HAUNTED_HOSTED__);
  globalThis.fetch = async (input, options) => {
    if (String(input) !== "http://localhost:11434/api/chat") return originalFetch(input, options);
    if (hosted) return globalThis.hauntedBrowserModel.complete(JSON.parse(options.body), options.signal);
    return originalFetch("/__haunt/generate", options);
  };
  let voice;
  let voiceContext;
  for (const event of ["pointerdown", "keydown"]) addEventListener(event, event => { if (event.isTrusted) voiceContext?.resume().catch(() => {}); }, { capture: true });
  globalThis.chrome = {
    runtime: {
      id: "preview", lastError: undefined,
      onMessage: { addListener: listener => handlers.push(listener) },
      sendMessage: message => new Promise(resolve => handlers[0](message, { id: "preview", tab: { id: 1 } }, resolve))
    },
    tabs: { sendMessage: async (tab, message) => handlers.at(-1)?.(message, { id: "preview" }, () => {}) },
    tts: {
      getVoices: callback => callback(hosted ? [] : [{ voiceName: "Whisper", lang: "en-US", remote: false }]),
      stop: () => {
        if (!voice) return;
        voice.controller.abort();
        try { voice.source?.stop(); } catch {}
        voice.options.onEvent({ type: "cancelled" });
        voice = undefined;
      },
      speak: (text, options, callback) => {
        const token = { controller: new AbortController(), options };
        voice = token;
        callback();
        originalFetch("/__haunt/voice", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }), signal: token.controller.signal }).then(async response => {
          if (!response.ok) throw new Error("Local voice unavailable");
          voiceContext ||= new AudioContext();
          const buffer = await voiceContext.decodeAudioData(await response.arrayBuffer());
          await voiceContext.resume();
          if (voice !== token) return;
          const source = voiceContext.createBufferSource();
          source.buffer = buffer;
          token.source = source;
          const gain = voiceContext.createGain();
          gain.gain.value = options.volume;
          source.connect(gain).connect(voiceContext.destination);
          source.onended = () => {
            if (voice !== token) return;
            voice = undefined;
            options.onEvent({ type: "end" });
          };
          options.onEvent({ type: "start" });
          source.start();
        }).catch(error => {
          if (voice !== token) return;
          voice = undefined;
          options.onEvent({ type: error.name === "AbortError" ? "cancelled" : "error" });
        });
      }
    }
  };
  globalThis.hauntPreviewMessage = (message, callback = () => {}) => handlers.at(-1)?.(message, { id: "preview" }, callback);
})();
