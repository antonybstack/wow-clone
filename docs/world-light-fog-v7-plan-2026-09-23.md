# V7 lighting and fog balance — 2026-09-23

Goal: reduce the sunward wash in the churchyard and the oversized yellow pool at the town gate while retaining the dusk sky, cool distance, and warm street landmarks. The approved world composition and atmospheric height layers stay in place.

## Milestones

1. Capture the existing scene from the twelve fixed environment cameras. Inspect the churchyard, town gate, main street, north overlook, and outer ridge. Completed in `ve-capture/ashen-reach/env-lighting/v7-light-fog-before/`.
2. Tune the sources that create those highlights. The sky's solar core and skirt, aerial forward scattering, and ground-mist solar term are now narrower/dimmer in `src/ashen-reach/atmosphere.js`. Street-lamp shafts and fixture-sized ground pools are lower in `src/ashen-reach/scene.js`. The global fog density, valley mist profile, color grading, and broad gate halo were kept at their current values. Completed and recaptured in `v7-light-fog-final/`.
3. Verify the live game, performance, and motion. `npm run build` passed; shader/pipeline check reported no errors. The fixed churchyard sunward region changed from mean luminance 114.4 to 105.6, and the gate foreground from 102.1 to 96.0 (8-bit screenshot samples at the same camera and crop). At 1280×720 internal resolution in isolated uncapped headless Chrome with seven enemies, two 600-sample runs averaged 390.9 FPS; p95 was 4.0/4.6 ms and p99 37.2/20.4 ms. This meets the average >120 FPS target in that setup but the occasional stalls remain. The 27.2-second, 60 FPS live town flythrough was reviewed, had no page errors, and was delivered on Telegram as message 739. Completed.

The live review still shows geometric edges on some close lamp shafts and bright memorial faces. Any further pass should compare those against fresh gameplay references before changing the established lighting balance.
