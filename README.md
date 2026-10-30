# Haunted Web

An interactive horror experience inhabiting ordinary websites. Version 6 forces the actual page dark, corrupts visible text heavily, introduces continuous CRT interference, and holds a real conversation through local Gemma and a local whisper voice.

## Run

1. Install Ollama, run `ollama pull gemma3:4b`, and start Ollama.
2. Open `chrome://extensions`, enable Developer mode, choose **Load unpacked**, and select this directory.
3. Copy the extension ID. Allow its origin in Ollama.
4. Reload the extension and the website. The popup should show version 6.6.0.

For the Ollama macOS app:

```sh
launchctl setenv OLLAMA_ORIGINS "chrome-extension://YOUR_EXTENSION_ID"
```

Fully quit and reopen Ollama afterward. For a terminal-managed server:

```sh
OLLAMA_ORIGINS="chrome-extension://YOUR_EXTENSION_ID" ollama serve
```

A 403 indicates an origin restriction; a 404 indicates a missing model. See the [Ollama FAQ](https://docs.ollama.com/faq).

## The presence

The SIGNAL panel is a real dialogue interface. Type a reply and press Enter. The last twelve user/assistant turns go to local Gemma through the chat API. The model generates original English replies, remembers conversation context and also chooses bounded page effects. There is no canned reply list. Scene context and dialogue are separated from untrusted page text. Replies remain text, never executable HTML or code.

A new user reply takes priority over a stale in-flight response. The AI continues addressing the visitor during quiet moments. Model latency depends on the local machine. If inference fails, the panel reports it rather than inventing a model response.

Speech uses Chrome's native extension TTS engine and local OS voices only. The macOS voice named Whisper is preferred; another local English voice is used if needed. The extension does not request microphone access or use remote speech engines. The preview server uses the same Mac system voice to create a local WAV. A new visitor reply can interrupt an old spoken line. Idle lines retain only the newest pending utterance.

## Visual behavior

- The actual website is forced to soot black, with subdued text and dimmed media. A constructed page stylesheet plus reversible handling of bright inline-important styles works without a remote stylesheet request.
- Scan lines and restrained noise remain visible. Tracking interference occurs about every 3.2 seconds; occasional short signal dropouts add darkness rather than repeated white flashing.
- One translucent pair of red horror-anime eyes opens only in a detected empty viewport area. Text, images, form controls and the dialogue panel are excluded; crowded pages skip the effect.
- The standing photographic person and hand stickers are removed. A blurred, faceless humanoid mass crosses the viewport with articulated walking motion and a maximum opacity of about 9%. It is deliberately difficult to identify.
- Up to twenty visible text nodes are corrupted in a pulse, and dedicated scramble scenes affect up to thirty. Original node identities remain intact. Website updates are preserved rather than overwritten during restoration.
- Fine branching glass fractures appear in place with a 190 ms local crack sound. Drifting words, cursor traces and short warnings continue at different locations. The dialogue panel is the primary voice of the haunting, rather than large floating text banners.

## Typing and clicks

Ordinary text, search and URL inputs, textareas and contenteditable documents briefly change their actual content into the presence's words. There is no fake typing overlay. Drafts and buffered printable keystrokes return after about 2.4 seconds, Escape, a non-printable edit, blur or a pointer interaction. Rich markup is held in a DocumentFragment and restored with node identities and selection when the site has not replaced it.

Ghost replacements do not dispatch synthetic input events. Restoration sends the user's words back to the application. Standard Enter and click submissions restore the real draft first. Application-specific autosave code or rich-editor mutation observers can still inspect DOM changes; universal isolation from every custom application is not promised.

Password, payment, authentication and other identified sensitive fields are excluded. The SIGNAL reply input is excluded from possession. Only explicit SIGNAL replies become AI conversation; ordinary field drafts are not included in prompts.

Ordinary links and buttons can refuse one interaction with a cooldown, then work on retry. Form controls and dialogs are excluded from click refusal.

## Sound and restoration

The approved score uses dark piano A as the looping bed. Analog pressure B fades in for short event accents and ducks back out. Speech lowers the music beneath the local voice.

Playback is attempted automatically, without a consent dialog. Chrome can suspend Web Audio until the first page interaction; the first click or key resumes it automatically. The in-page and popup controls mute sound, and the popup adjusts volume. Volume zero also silences speech.

**Escape** pauses the curse, restores the original page colors and text, stops TV effects and walking animation, and cancels owned speech and music. Tab hiding and page exit also stop active audio and effects. Resume through the popup. No new dialog approval is required for ordinary playback; browser autoplay policy still applies.

## Privacy and compatibility

The extension contacts one local Ollama endpoint. Prompts contain short excerpts of visible non-editable page text, coarse page activity and explicit SIGNAL conversation. Backups and dialogue stay in the current document's memory. Nothing is uploaded to a hosted AI or speech service.

Permissions are `activeTab` for popup controls and `tts` for local OS speech. Works on many normal HTTP/HTTPS pages without site-specific selectors. Browser internal pages, extension stores, PDF viewers, embedded frames, canvas-only applications and other closed shadow roots are not supported. Some complex editors or pages that replace injected nodes require further adaptation.

## Live local preview

```sh
python3 scripts/serve_preview.py
```

Open `http://127.0.0.1:4187/preview/`. This now uses genuine local Gemma dialogue and locally rendered Whisper audio, not a mock conversation. The server binds only to 127.0.0.1 and validates request origins. Voice rendering uses macOS `say` and `afconvert`. The installed Chrome extension uses native Chrome TTS and does not need this preview server.

The effect buttons are manual visual auditions; the SIGNAL panel remains the live conversation. Escape restores the example page.

## Development and checks

No runtime npm dependency or build step is needed to load the included bundle. After editing `src/*.js`, `ghost.css`, `page-dark.css`, fonts, or embedded assets, run:

```sh
npm run build
npm run check
npm test
```

Browser development tests:

```sh
npm install
npx playwright install chromium
npm run test:browser
npm run test:extension
```

The browser suite checks actual field mutation, restoration, conversation delivery, dark-theme rollback, TV cadence, faint walking motion, sound lifecycle and native voice cancellation. The extension suite loads real Manifest V3 isolated execution with blocked page resources. Live model and voice checks are separate from deterministic regression replies.

The eye art and fonts are bundled into the content script, preserving transparency. Asset notes and font licenses are in `assets/ART_DIRECTION.md` and `assets/fonts/`. The earlier human and hand artifacts remain on disk as unused source history and are not shipped in the active bundle.

## Version 6.3 behavior

Gemma 3 4B handles local scene direction and conversation. User messages interrupt older inference and speech. Name answers use explicit visitor declarations; unrelated replies never turn into a name disclaimer. Page context contains original text rather than the extension's temporary substitutions.

A featureless walking presence appears after 4.2 seconds independently of inference, then at 17-second intervals. The illustrated eyes remain a single small pair, tightly feathered into an unoccupied dark region. Text outside the conversation uses faded red pigment; conversation keeps its readable serif font. Blackouts spread in staggered bands with a matching four-second local interference cue. Escape clears both the visuals and their audio.

## Version 6.4 visual direction

Message infestation accumulates up to 34 overlapping fragments of the current AI message over four seconds and clears after seven seconds. Individual handwritten glyphs have varied height, lean and needle-like traces; conversation typography stays unchanged. Infestation never intercepts pointer input, and the conversation stays above it.

The passing presence crosses in 1.25 seconds at lower opacity. Glass impacts stay fixed through subsequent scenes, with up to three persistent impacts per page. Escape, navigation and reload clear them.

The AI scene schema now also supports `infestation`, `tilt`, `inkbleed` and `image-decay`. These alter the layout, spread dark stains or degrade pictures temporarily. Arbitrary model-generated HTML, CSS and JavaScript are not executed.

## Jumpscare audition

Open `/preview/jumpscare/` on the local preview server. This is a separate manual audition with eyes, a distorted face and an approaching humanoid, plus impact and scream-like sound options. Scene and sound selection can be randomized from a button. The volume defaults to 35%, and Escape, Stop or tab hiding cancels all current and delayed effects. The user selected B / String shock without any added scream. The extension now uses that unchanged cue for the three randomly selected visuals, with 60–120 seconds between scenes.

## Selected jumpscare sound

Version 6.5 embeds assets/sound-audition/b-string-stab.wav unchanged. The face and approaching presence share this single cue. No scream, pitch change or additional impact is added. The normal soundtrack and narration give way to the cue. Automatic scenes first wait 12–20 seconds and then 25–45 seconds, skip hidden pages and respect the reduced-motion preference. Escape, page hiding, navigation and pause cancel the active scene, pending cue and next timer. The standalone audition remains manually triggered.

## Version 6.6.0 event pacing

The live haunted page is `/preview/`. The old sound comparison URL now opens the full live experience. The archived comparison is at `/preview/jumpscare/sounds/comparison.html`; the standalone jumpscare audition remains manual. The main preview includes a pause/resume control, glass count and jumpscare countdown.

The approved A piano score loops continuously, remaining at a lower level during selected B's jumpscare cue. Automatic glass starts after 5–8 seconds, then adds fixed impacts at 11–21 second intervals; after twelve impacts, existing fractures gain more branches. The short glass crack sound remains enabled. The first random jumpscare arrives after 12–20 seconds, with 25–45 second gaps afterwards. Ambient text pulses run every 1.8 seconds; the passing presence repeats every 10 seconds. Hiding, Escape and pause cancel scheduled effects.

Eyes are ambient only and independently appear in available blank space every 6.5–10.5 seconds. They never trigger the jumpscare cue. Progressive darkening starts on load; staggered corruption bands recur every twelve seconds with interference audio. Audio attempts autoplay and resumes on the first ordinary page interaction if the browser blocks it. No extra permission dialog is shown.

## Hosted version on Vercel

The hosted site uses `/api/generate` to reach Vercel AI Gateway. Set `AI_GATEWAY_MODEL` to a free model from the live catalog and enable Vercel OIDC for the project. Credentials remain on the server. The endpoint checks catalog prices and refuses models with nonzero input or output prices; no paid fallback is configured. Model availability and account verification requirements can still prevent replies.

Hosted conversation and scene prompts are sent to the cloud provider, which may retain them; avoid personal information. The extension and Python preview continue to use local Ollama. Hosted speech uses available local English browser voices, preferring Whisper when installed, and does not use the macOS preview voice endpoint. Voice availability and tone depend on the device.

Run `node scripts/build-site.cjs` to create the static site in `dist/`. Vercel also deploys the root `api/generate.js` function. Run `node --test tests/hosted.test.cjs` for the hosted integration checks.
