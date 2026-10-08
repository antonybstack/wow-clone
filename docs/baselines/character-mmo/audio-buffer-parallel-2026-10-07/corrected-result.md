# Corrected native audio controls

Runtime parallel audio unchanged. Six declared comparison pairs not repeated. Functional only.

## Exits

| step | exit | pid |
|---|---|---|
| verify-baseline-build.py (vite pid) | 0 | 56057 |
| run-corrected-controls.mjs | 0 | 56438 |
| check-deferred-audio.mjs child | 0 | 56476 (`corrected-controls-child-exit.json`) |

## Baseline equality

Diagnostic Vite plugin rebuilt sequential-audio.js into `reproduced-baseline/` only. 202 JS/CSS/HTML/Havok files exact vs `sequential-dist`. mismatches `[]`. module sha256 `d0011098f2c9bc39…`. `passed: true`. Live source/dist not mutated.

Blind first `controls.json` (8955 bytes) preserved. New reports: `corrected-controls.json`, `corrected-controls.probe-controls.json`.

## Nine game cases (all passed)

| case | gainCount | gainsAfterClose | unhandled | contexts | physics |
|---|---|---|---|---|---|
| muted movement/cast; pointer sound; capture; remute/keyboard resume | 5 | 0 | [] | 1 | true |
| first request through keyboard activation | 4 | 0 | [] | 1 | true |
| first request through mobile menu touch activation | 4 | 0 | [] | 1 | true |
| explicit capture preparation shares one native engine | 4 | 0 | [] | 1 | true |
| construction failure disables sound; movement remains live | 0 | 0 | [] | 0 | true |
| dispose during held native sound fetch | 2 | 0 | [] | 1 | false |
| failed fireball-julien-matthey.wav decode with held sibling | 2 | 0 | [] | 1 | true |
| failed lava-charge.wav decode with held sibling | 2 | 0 | [] | 1 | true |
| dispose without any sound request creates nothing | 0 | 0 | [] | 0 | false |

GainNode proxy observed graphs (`gainCount >= 2` when a context exists). `unhandledrejection` empty on every game case.

## Native blank-page probes (`passed: true`)

- Closed-context `new GainNode(c)`: attempts 1, afterClose 1, constructorError null (attempt detected).
- Promise.all early+late: lateDone true, caught `controlled early`, allUnhandled `[]` (late rejection handled; review orphan claim not observed).
- Bare rejection detector: `controlled bare rejection` in negativeControlUnhandled.

## Cleanup

Owner grok-audio-corrected-controls: browser 56466 / GPU 56472 / server 56465 closed. Final lsof: 7074 / 10037 / 5173 free. No owned game helpers remain.

Constructor hitch, required-texture startup hold, original 14/60 362 ms, and iPhone exits remain open.
