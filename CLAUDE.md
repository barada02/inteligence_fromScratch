# LLM from scratch — learning canvas

Purpose: an interactive, zoomable map for learning how LLMs work, built up over discussion sessions.
Open `index.html` directly in a browser (no server, no CDN — everything is local).

## Files
- `index.html`, `style.css`, `app.js` — the engine (pan/zoom SVG, drill-down scenes, side panel, tiny markdown renderer). Rarely needs changes.
- `scenes.js` — **the content**. A tree of scenes; each box may `child:` into a deeper scene. Notes are markdown in template literals (escape backticks as \`).
- `widgets.js` — interactive widgets mounted under notes via `widget: '<name>'` on a scene or node.
- `log.js` — session log, newest first.

## Conventions (keep these consistent)
- Box `kind`: `weights` (orange, has learned params) · `tensor` (blue) · `op` (green, no params) · `concept` (purple) · `group` (dashed container).
- Put tensor shapes in `sub:` e.g. `(T × d_model)`.
- `status` on a box is the progress tracker: `todo` (default) → `done` once actually discussed → `revisit` if the user was unsure. Update it during/after each session.
- After each session: append an entry to `log.js` and flip statuses in `scenes.js`.
- Prefer a live widget over a static picture when a slider/toggle would build intuition.
- Deep links: `index.html#model/block/attention` (scene ids joined by `/`).

## Checks
`node --check app.js` and validate scene data (every `child` and edge endpoint must exist). Headless screenshot:
`msedge --headless=new --screenshot=out.png --window-size=1600,900 file:///.../index.html#model`
