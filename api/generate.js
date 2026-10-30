const MAX_BODY = 24000;
let freeModel;

async function isFree(model) {
  if (freeModel?.id === model && freeModel.expires > Date.now()) return true;
  const response = await fetch('https://ai-gateway.vercel.sh/v1/models', { signal: AbortSignal.timeout(8000) });
  if (!response.ok) return false;
  const entry = (await response.json()).data?.find(item => item.id === model);
  if (!entry?.pricing || entry.pricing.varies_by_provider ||
      entry.pricing.input == null || entry.pricing.output == null ||
      Number(entry.pricing.input) !== 0 || Number(entry.pricing.output) !== 0) return false;
  freeModel = { id: model, expires: Date.now() + 60000 };
  return true;
}

module.exports = async function generate(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Use POST.' });
  }
  const origin = req.headers.origin;
  if (origin) {
    try {
      if (new URL(origin).host !== req.headers.host) return res.status(403).json({ error: 'This endpoint only serves this site.' });
    } catch { return res.status(403).json({ error: 'Invalid origin.' }); }
  }
  let body;
  try {
    if (Number(req.headers['content-length']) > MAX_BODY) return res.status(413).json({ error: 'Message is too long.' });
    const raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});
    if (Buffer.byteLength(raw) > MAX_BODY) return res.status(413).json({ error: 'Message is too long.' });
    body = JSON.parse(raw);
  } catch { return res.status(400).json({ error: 'Invalid request.' }); }
  if (!Array.isArray(body.messages) || !body.messages.length || body.messages.length > 16 ||
      body.messages.some(item => !item || !['system', 'user', 'assistant'].includes(item.role) || typeof item.content !== 'string')) {
    return res.status(400).json({ error: 'Invalid conversation.' });
  }
  let token = process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN;
  if (!token) {
    try { token = await require('@vercel/oidc').getVercelOidcToken(); } catch {}
  }
  const model = process.env.AI_GATEWAY_MODEL;
  if (!token || !model) return res.status(503).json({ error: 'SIGNAL cloud connection is not configured yet.' });
  const messages = body.messages.map(item => ({ role: item.role, content: item.content }));
  // Scene output is validated again by the existing background controller.
  if (body.format && typeof body.format === 'object') {
    messages.push({ role: 'user', content: `Return only a JSON object matching this scene schema: ${JSON.stringify(body.format)}` });
  }
  try {
    if (!await isFree(model)) return res.status(503).json({ error: 'The free SIGNAL model is unavailable. Paid models are disabled.' });
    const response = await fetch('https://ai-gateway.vercel.sh/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(30000),
      body: JSON.stringify({ model, messages, max_tokens: 220, temperature: 0.7, stream: false, reasoning: { effort: 'none' } })
    });
    if (!response.ok) {
      const error = response.status === 402 || response.status === 403
        ? 'SIGNAL needs its cloud credit or account verification completed.'
        : response.status === 429 ? 'SIGNAL is busy. Please try again shortly.'
        : 'SIGNAL cloud connection is unavailable. Please try again shortly.';
      return res.status(response.status === 429 ? 429 : 503).json({ error });
    }
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || !content.trim()) return res.status(502).json({ error: 'SIGNAL returned an empty response.' });
    return res.status(200).json({ message: { role: 'assistant', content } });
  } catch {
    return res.status(503).json({ error: 'SIGNAL connection timed out. Please try again shortly.' });
  }
};
