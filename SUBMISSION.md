# Haunted Web: A Browser Ghost You Can Run Yourself

*This is a submission for the [Hacktoberfest Open-Source AI Challenge Week 4: Ghost in the Machine](https://dev.to/challenges/hacktoberfest-week4-2026-10-26)*

## What I Built

Haunted Web turns ordinary websites into a horror experience. Words change while you read them. Glass fractures spread across the screen. Eyes appear in empty spaces, and a faint figure crosses your peripheral vision. Sometimes the words you are typing briefly become someone else's.

Inside the disturbance is **SIGNAL**, a presence you can talk to. The local browser extension uses Gemma 3 4B through Ollama to generate replies and select constrained page effects.

My interpretation of “Ghost in the Machine” was literal: something appears to inhabit an interface you already trust. The browser itself becomes the setting.

## Demo

[Open Haunted Web](https://hauntedweb.vercel.app/preview/)

Effects and music start without downloading a model. Click the page if your browser blocks audio, and press **Escape** to pause and restore the page.

For conversation, choose a model and click **Start free chat**. The hosted version uses WebLLM to run an open-weight model on your device: SmolLM2 360M is the smaller default, with Gemma 2 2B available as a larger option. No inference API key or payment card is needed.

The first model download can take several minutes and requires a WebGPU-compatible browser with enough GPU memory. Unsupported devices can still explore the effects and music. The repository also includes the original Ollama-based extension and local preview.

## Code

{% github https://github.com/iduyguay/hauntedweb %}

Project code is MIT-licensed. Bundled third-party fonts and audio retain their original licenses and credits; downloaded models retain their own terms.

## How I Built It

The extension uses JavaScript, CSS, Canvas, and browser audio APIs. Gemma 3 4B runs locally through Ollama. It receives explicit SIGNAL messages and limited page context, then returns dialogue or a scene with an allowed effect, a target, and bounded timing values. Generated HTML, CSS, and JavaScript are never executed.

Ambient events run independently of inference so a slow model does not freeze the atmosphere. The typing effect temporarily changes editable content and restores the visitor's draft. Password and other identified sensitive fields are excluded, and ordinary drafts are not sent to the model.

Publishing revealed a useful constraint: a hosted page cannot use my laptop's Ollama server or macOS voice renderer. I first tried a free cloud model, but the gateway required account verification. I did not enable paid usage. Instead, I added browser inference using WebLLM in a worker, with visible download progress, caching, cancellation, and an explicit start button.

In the hosted version, the model generates the words while application code selects a bounded visual effect. The original Gemma/Ollama version lets the model select the scene too. Browser speech uses available local English voices and prefers Whisper when installed. Whisper here means the macOS system voice, not a speech-recognition model.

Small browser models have clear limitations: replies can be less coherent, downloads are substantial, and GPU support varies. Those tradeoffs are visible rather than hidden behind a simulated conversation.

## Why Does Open Innovation Matter?

Open-weight models made two different versions possible: a Gemma-powered extension using local inference, and a hosted experience that downloads a model and runs it on the visitor's device.

I can change the instructions, inspect the application logic, and swap models without rebuilding the project around a single remote API. Conversation inference does not require paying for each generated response.

The deployment problem made that independence concrete. When cloud account requirements blocked the hosted conversation, moving inference into the browser provided another path. That comes with download and hardware costs, but it removes the need for a paid inference service.

## The Spirit of It

The detail I kept returning to was how little the ghost needed to show itself: a faint shape at the edge of the page, eyes in an empty patch of darkness, a familiar sentence that changes before you finish reading it.

The jumpscares provide sudden interruptions. The quieter effects establish the feeling I wanted: you are browsing a website, and something else seems to be browsing it with you.

## Prize Categories

**Best Use of Gemma** — Gemma 3 4B powers conversation and constrained scene selection in the local Ollama version. The hosted version also offers Gemma 2 2B through WebLLM on supported devices.

---

*AI assistance was used during development and in preparing this write-up.*
