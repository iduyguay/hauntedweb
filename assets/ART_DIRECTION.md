# Visual assets and typography

## Images

- `watching-eyes.png`: transparent red eye illustration used by the ambient effect.
- `jumpscare-face.png`: face image used by the jumpscare effect.
- `jumpscare-entity.png`: approaching figure used by the jumpscare effect.
- `hidden-presence.png` and `hand-trace.png`: unused reference assets, excluded from the production bundle.

## Typography

Ghastly Panic by Chad Savage is used for on-page warnings and messages. Special Elite is used for click-refusal text. Conversation uses Georgia. Original font licenses and author notices are preserved in `fonts/`.

## Audio

The looping piano and analog pressure tracks are rendered by `scripts/render_audio_previews.py`. The jumpscare uses `sound-audition/b-string-stab.wav`. Source credits are preserved in `sound-audition/CREDITS.md`.

## Behavior

Eyes appear in empty viewport areas. The walking presence is drawn on canvas. Glass fractures persist during the experience. Escape restores the page and cancels visual and audio effects.
