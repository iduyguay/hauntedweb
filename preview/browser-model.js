(() => {
  const button = document.getElementById('start-signal');
  const select = document.getElementById('signal-model');
  const status = document.getElementById('signal-download');
  if (!button || !select || !status) return;
  let engine;
  let worker;
  let loading = false;
  let cancelLoad;
  const announce = text => { status.textContent = text; };

  button.addEventListener('click', async () => {
    if (loading) { cancelLoad?.(); return; }
    if (engine) return;
    if (!navigator.gpu) {
      announce('Local chat needs WebGPU. Try a current desktop Chrome or Edge browser. Effects and music still work.');
      return;
    }
    loading = true;
    select.disabled = true;
    button.textContent = 'Cancel download';
    announce('Checking your device…');
    let timeout;
    try {
      const adapter = await navigator.gpu.requestAdapter();
      if (!adapter) throw new Error('No compatible GPU is available. Try desktop Chrome or Edge with hardware acceleration enabled.');
      const half = adapter.features.has('shader-f16');
      const model = select.value === 'gemma'
        ? `gemma-2-2b-it-q4f${half ? '16' : '32'}_1-MLC`
        : `SmolLM2-360M-Instruct-q4f${half ? '16' : '32'}_1-MLC`;
      const { CreateWebWorkerMLCEngine } = await import('https://esm.run/@mlc-ai/web-llm@0.2.87');
      worker = new Worker(new URL('model-worker.js', document.baseURI), { type: 'module' });
      const cancelled = new Promise((_, reject) => {
        cancelLoad = () => { worker?.terminate(); reject(new Error('Download cancelled. You can try again.')); };
        timeout = setTimeout(() => { worker?.terminate(); reject(new Error('Download timed out. Check your connection and try again.')); }, 600000);
        worker.onerror = () => { worker?.terminate(); reject(new Error('The model worker could not start. Check your connection and try again.')); };
      });
      const ready = await Promise.race([
        CreateWebWorkerMLCEngine(worker, model, { initProgressCallback: progress => announce(progress.text || `Loading ${Math.round(progress.progress * 100)}%`) }, { context_window_size: 4096 }),
        cancelled
      ]);
      engine = ready;
      button.textContent = 'SIGNAL is ready';
      button.disabled = true;
      announce(`${select.value === 'gemma' ? 'Gemma 2 2B' : 'SmolLM2 360M'} is running on your device. Reply in the SIGNAL panel. No cloud inference or API fees.`);
    } catch (error) {
      worker?.terminate();
      worker = undefined;
      button.textContent = 'Start free chat';
      select.disabled = false;
      announce(error.message || 'Could not load the model. Effects and music still work.');
    } finally {
      clearTimeout(timeout);
      loading = false;
      cancelLoad = undefined;
    }
  });

  globalThis.hauntedBrowserModel = {
    async complete(body, signal) {
      if (!engine) throw new Error(loading ? 'SIGNAL is downloading. Follow the progress above.' : 'Click Start free chat above to wake SIGNAL on your device.');
      signal?.throwIfAborted();
      const scene = body.format;
      const system = 'You are SIGNAL, a fictional ghost haunting a web browser. Answer the visitor briefly, in one or two sentences. Stay in character. You only know what the visitor types; never invent their name or private facts. Pressing Escape stops the haunting.\nExample:\nVisitor: Are you here?\nSIGNAL: Yes. I was here before the page finished loading.\nVisitor: Can you see me?\nSIGNAL: No. I only know the words you leave here.';
      const messages = scene
        ? [{ role: 'system', content: system }, { role: 'user', content: 'Say one brief eerie sentence about the words on this web page. Do not use a personal name.' }]
        : [{ role: 'system', content: system }, ...body.messages.filter(item => item.role !== 'system').slice(-6).map(item => ({ role: item.role, content: item.content.replace(/\n\[Respond to THIS message[\s\S]*$/, '').slice(0, 600) }))];
      let abort;
      const cancelled = new Promise((_, reject) => {
        abort = () => {
          engine.interruptGenerate();
          reject(new Error('SIGNAL was interrupted. You can send your message again.'));
        };
        signal?.addEventListener('abort', abort, { once: true });
      });
      try {
        const reply = await Promise.race([engine.chat.completions.create({ messages, temperature: .55, max_tokens: 64, stream: false }), cancelled]);
        signal?.throwIfAborted();
        let content = reply.choices?.[0]?.message?.content?.trim();
        if (!content) throw new Error('SIGNAL lost its words. Please try again.');
        if (scene) {
          const effects = scene.properties.effect.enum;
          content = JSON.stringify({ target: scene.properties.target.enum[0], effect: effects[Math.floor(Math.random() * effects.length)], message: content, duration: 5, delay: 4 });
        }
        return new Response(JSON.stringify({ message: { role: 'assistant', content } }), { headers: { 'Content-Type': 'application/json' } });
      } finally {
        signal?.removeEventListener('abort', abort);
      }
    }
  };
})();
