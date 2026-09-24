# V5 — Readable play views

Continues the [world vista repair milestones](world-vista-repair-plan-2026-09-23.md) after [V4 lighting balance](world-atmosphere-v4-plan-2026-09-23.md).

## Baseline and acceptance

Live baseline captures at `ve-capture/ashen-reach/play-views/v5-baseline-2026-09-23/` show the ordinary 1280×720 desktop play view and a 390×844 touch view. The desktop help text is small and crosses bright branches; spell labels are dim and small. Metrics are visible in ordinary play. The phone's basic touch layout fits, but spell names are hidden, leaving only numbered icons.

1. Make ordinary-play desktop controls and action labels readable without hiding the scene. Keep development controls visually separate and only show diagnostics when requested.
2. Give phone spells visible names and verify the HUD at common short and tall phone viewports, including safe-area offsets and menu use.
3. Exercise real movement, target selection, auto attack, a cast, menu/armory flow, and `?dev` flight. Capture live stills and a reviewed motion clip. Check for page errors and control overlap.
4. Run relevant tests and build, measure frame time without recording, and deliver the reviewed live MP4 on Telegram. Keep the >120 FPS goal with measurement conditions stated.

V2 distant ground cover and the smooth southern hill remain a separate visual acceptance item.

## Implemented and reviewed — 2026-09-23

- Desktop help now sits on a compact dark panel with clear movement, targeting, spell, menu, and armory shortcuts. Spell buttons and labels are larger and brighter. The performance overlay defaults off during ordinary play; `?dev`, `?metrics`, or the menu can show it.
- Phone spell names are visible. Controls fit without overlap at 390×844, 375×667, and 320×568 CSS pixels. Direct touch entry opens the playable view. The menu presents touch instructions on touch devices and keyboard instructions on desktop.
- The running developer tools now follow the menu toggle. Dev mode no longer consumes normal click targeting while flight is off. A second touch no longer releases an active world drag or creates a stray click; cancelling the primary touch does not select. The menu suspends combat until resumed.
- Live checks exercised forward movement, click and Tab targeting, Fire Blast, auto attack, menu pause/resume, dev flight on/off, touch targeting and casting, and multi-touch ownership with no page errors. `scripts/ashen-reach/check-play-views.mjs` repeats these checks. Nine focused targeting, touch-stick, and spell-visibility tests passed; `npm run build` and `git diff --check` passed.

Reviewed live clips: [desktop movement/combat/menu/flight](../ve-capture/ashen-reach/play-views/video-v5-desktop-2026-09-23/desktop-play-views.mp4) and [touch target/cast/movement/menu](../ve-capture/ashen-reach/play-views/video-v5-touch-2026-09-23/touch-play-views.mp4). They were delivered on Telegram as messages 736 and 735, respectively. Matched baseline and first-pass stills are in `ve-capture/ashen-reach/play-views/`.

Separate no-recording, no-enemy performance run: 1280×720 viewport, 960×540 internal buffer, 208 samples, 60.001 FPS, 16.6663 ms mean, 16.7 ms p95, 82 draw calls, 175,005 world triangles. The browser was capped at 60 Hz, so this does not establish the >120 FPS goal. V2's distant ground cover and southern hill remain open; mobile browser hardware testing is still useful beyond this Chrome touch-size run.
