# G04 — Region map and useful destination guidance

**Complete on the sealed desktop preview. Product 9d5d4fe is committed/pushed.**
Ordinary **Esc/Menu → Region map** now opens a readable chart with all eight existing
landmarks, authored roads, central street/well detour, cathedral bridge, north and
current player position. The adjacent native button list gives every tower its
proper name. Select a destination to highlight its existing route and put a blue
entrance diamond on the minimap; Clear destination removes it. The gold watchman
chevron and objective state remain independent. Selection lasts for this page
session. The map guides from the existing central roads; it does not invent a
pathfinder, move the player or teleport. Developer jumps remain in Developer tools.

## Existing patterns and startup

The existing modal handles pause, focus, Back/Esc and canvas input restoration.
The early menu receives an already-ready provider from late combat. Chart DOM and
its 560² canvas are created only on first open. Static roads/buildings/labels are
cached once, following [MDN canvas guidance](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas);
the open chart repaints on open or selection and has no timer/frame-loop hook.
Guidance uses the existing combat minimap tick. Both views share pure drawing
primitives with independent coordinate transforms; opening the chart cannot change
minimap bounds. Equal X/Z scale removes slight old minimap stretching. The player
arrow now correctly turns east with positive world yaw, fixing the inherited
negative Canvas rotation. Distant diamonds clamp inside the minimap edge.

The chart covers the existing landmark circuit, not the entire outer cliff
footprint. Names are available in the textual list as well as the canvas; narrow
layout uses existing CSS responsiveness but physical mobile acceptance remains
deferred. No world/character texture, mesh, light, prepared packet, input shortcut,
asset authoring or extra rendering engine is added. The accepted four build flags
are preserved. Rounded build output: early boot 275.68→276.51 KB / gzip
101.62→101.82 KB; chart factory/painter strings are absent from that boot bundle.
The existing late combat bundle rises 49.29→53.04 KB / gzip18.36→19.88 KB.
This is bundle inspection, not a new universal one-second startup qualification.
[Build/CPU scope](checks.json).

## Actual native controls and motion

[Local final native check](local-ui.json) uses ordinary non-dev play, native
WASD turn/walk and menu buttons. All eight routes exist and highlight; menu pause,
first focus, Tab/Shift-Tab wrap, Back/Resume/Esc, retained/reopened selection,
clearing and restored walking pass. Watchman objective snapshots remain identical
through selection, with both distinct gold and blue minimap pixels present.
Havok stays active, Fly off, zero recoveries/runtime/GPU errors. A separate call to
the existing scene-disposal API removes chart/minimap and clears selection.

Root inspected [selected chart](map-vaelmark.png), [actual minimap pins](minimap-selected.png)
and [cleared chart](map-cleared.png), then actual native MP4 playback, including
ordinary walking after the eastward heading correction and its cleared-map ending.
[Capture manifest](capture-manifest.json) retains original 1280×720 viewport/canvas/
source frames and timestamps. Final MP4 11.320 s, H.264, square pixels, rotation0;
recording cost is separate from the settled performance gate.

## Independent review and adjudication

[Grok 4.6/high source review](source-review.md) assesses registry reuse, early-menu
imports, per-view transforms, event-only chart painting, focus/pause and abort
ownership. Its eight-turn pass capped after a report skeleton; a short report-only
resume wrote its findings and exited successfully. It did not run native tests,
benchmarks or inspect final served assets, and predates the heading correction.

Its two proposed Vaelmark blockers are invalid: `scene.js` assigns the cathedral
entry and route to that landmark at scene construction; prepared metadata retains
both. The final native receipt reads six Vaelmark route points and selects it
successfully; the actual screenshot shows the blue bridge/approach. The current
building-pad contract supplies the real well. Uniform projection is intentional
and visually checked. A potential generic post-disposal menu shell remains an
existing lifecycle limitation; the new provider refuses work after abort and
native disposal proves no late map/minimap access error. This review is preserved
with its honest unchecked areas, rather than relabelled an independent all-clear.

## Performance, preview and delivery

M1 Max, uncapped Chromium WebGPU, 1280×720/DPR1, seven enemies, three 12-second
runs per route, GPU queries/recording off, map closed and no selected guidance.
One owned game renderer only; build/capture/encoder/reviewer/media processes and
review tabs were closed first. [All raw intervals](settled-fps.json).

| Route | FPS range | Largest p99 | Worst interval |
| --- | ---: | ---: | ---: |
| Meadow | 198.6–198.7 | 6.5 ms | 10.0 ms |
| Town | 189.2–192.1 | 6.5 ms | 9.4 ms |
| Bridge | 228.0–228.0 | 5.6 ms | 8.3 ms |
| Cathedral | 218.3–218.6 | 6.0 ms | 7.3 ms |
| Forest | 199.8–207.9 | 6.3 ms | 8.4 ms |

37,464 raw intervals; zero >16.67 ms, full/rolling pacing flags, errors or recoveries. Local RAF throughput meets the 144 FPS target and >120 FPS floor; it is not a controlled production comparison or a new cold-start qualification. The selected-pin path is separately exercised by native UI, rather than represented as timed here.

[Sealed desktop preview](https://4f787280.fardel.pages.dev/?play&clean), source9d5d4fe,
passes [649 served checks / 323 declared cache policies](served-preview.json).
[Seal](preview-seal.json) b9e2e6f4… binds 646 files / 374,140,059 bytes; it was
created before the product commit and verified against committed inputs for upload.
[Public ordinary-play map check](public-ui.json) and [eighteen existing developer
control/destination gates](public-destinations.json) pass without runtime/GPU errors.
World geometry is unchanged from G03; this slice does not claim another full
connected-region tour.

Root-reviewed motion is **Telegram896** ([sanitized delivery](telegram-delivery.json));
API dimensions1280×720 match the original 11.320 s square-pixel/rotation0 clip.
[Public VE MP4](https://ve.sparkify.dev/wow-clone/ashen-reach/gothic-exploration/2026-10-09/map.mp4)
is HTTP200 / `video/mp4` / 2,071,613 bytes / exact SHA-256 c0fcf47e…; range206
returns the exact first1024 bytes ([receipt](ve-delivery.json)). Root also inspected
actual advancing direct VE playback at1280×720 with no media error. Telegram
application inline/fullscreen playback remains unverified.

Root Chrome46174/CDP10037, Vite46145+46169/5873 and compiled68584/7074 are stopped.
All native contexts close in `finally`; capture, encoder and Grok47535+61895 are
done. Owned review tabs1147996142/1147996146/1147996150 and media62853+71666/7077
are closed. User Edge15 existing tabs, Chrome NewTab, Orca and unrelated Vite4000
remain intact. [Fresh production metadata](production-state.json) confirms the
canonical production deployment is unchanged.

Production remains on the separately held 5723a4ab / 7d00c56 release. The earlier
219.9 ms readiness interval is still unexplained; a clean settled benchmark does
not resolve it. Mobile and Telegram application inline/fullscreen acceptance
are separate from desktop/native/API checks.
