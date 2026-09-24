# Backlit mountain fog — 2026-09-23

Goal: make the low northern sun visible through mist in the mountain basin. From the churchyard and Hollowmere, the valley should carry a localized warm glow and a few soft rays should extend above the ridge. The citadel, treeline, and cloud shapes must remain readable.

## Milestones

1. Record the starting composition from the twelve fixed environment cameras, with the lych gate, main street, and well plaza as primary views. Review anti-sun rim views for unwanted warmth. Baseline: `ve-capture/ashen-reach/env-lighting/v8-backlit-fog-before/`.
2. Add height- and distance-gated solar scattering to the existing ground mist in `atmosphere.js`. Keep the near playable area and other compass directions on the established V7 balance.
3. Add soft angular light rays to the sky material, attenuated by cloud cover and hidden by mountain geometry through the existing depth pass. Keep the effect stable as the camera moves and avoid a large full-screen bloom.
4. Compare the same cameras, correct any blown silhouettes or conspicuous stripes, then run shader/build checks and an uncapped performance measurement. Review a live gameplay flythrough and deliver its MP4 on Telegram.

Acceptance: the sunward basin has a focal glow, the ridge and citadel still read as solid forms, anti-sun views stay cool, and average uncapped performance remains above the 120 FPS goal at the stated test resolution.

## Result

All four milestones are complete locally. The final matched captures are in `ve-capture/ashen-reach/env-lighting/v8-backlit-fog-f/`. At the fixed well-plaza view, the northern basin crop changed from mean RGB `93.2, 82.2, 69.6` to `100.9, 87.8, 73.1`; the south-facing basin crop remained `81.3, 80.8, 72.4`. The citadel silhouette and nearby tree line remained distinct in the reviewed stills and moving elevated view.

The ground mist receives bounded directional sunlight only in the distant northern basin. Broad angular rays in the cloud shader are depth-occluded by the mountain and softened by cloud cover. This is a stylized scattering treatment; it does not compute volumetric shadow maps or project cloud shadows onto the ground.

`npm run build` and the shader/pipeline check passed. A live WASD check confirmed Havok movement and no page errors. In isolated uncapped headless Chrome, a 1280×720 internal buffer with seven enemies averaged 410 FPS across 600 samples (p95 3.4 ms, p99 20.4 ms). The 18.9-second, 1280×720, 60 FPS citadel flythrough had no recorded page errors, was reviewed, and was delivered on Telegram as message 740. The average exceeds the >120 FPS goal in those conditions; frame-time stalls and higher resolutions remain separate checks.
