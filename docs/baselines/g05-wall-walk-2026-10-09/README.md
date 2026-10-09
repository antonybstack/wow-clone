# G05 — Eastwatch stair and guarded wall walk

**Complete on the sealed desktop preview; product c3419d4 is committed/pushed.**
Eastwatch now has a visible courtyard stair and a guarded U-shaped route along its
right, rear and left curtain walls. Ordinary controls ascend, visit the raised
hall window and return through the stairs/gate. **?dev → Menu → Developer tools →
Eastwatch — wall walk** uses the existing jump handler and shareable spawn link.
[Desktop preview](https://ae9f12cc.fardel.pages.dev/?dev&play&at=east-keep-wall-walk).

## Construction and unchanged startup

The 16 m flight rises 5.2 m, about 18°, with 33 visible treads (≤16 cm) and the
existing cathedral smooth Havok ramp pattern. The route is 2.4 m nominal width;
trim/cap clearance is conservatively 2.06 m. Inner masonry guards protect 1.1 m
above the floor, existing outer walls/caps remain, and corbels support the slabs.
The landing starts exactly at the ramp end; inner parapets stop before the rear
turn squares. Ground gate/hall lanes, roof, skyline and landmark datums remain.
All solids share visible/physical occupancy except the documented tread/ramp
representation. Existing batching, texture/material/shadow and Havok paths are reused;
no new light, renderer, physics policy or geometry rebuilding during play.
[Plan and documentation references](../../plans/gothic-exploration/g05-wall-walk-2026-10-09.md).

Structures total **11,172 render / 10,788 collision triangles**, below 13,000.
The 384 difference is the actual 396 tread triangles replacing the 12-triangle
collision ramp. [Sixty CPU checks](checks.tap) pass, including floors, joins,
headroom, supported turn squares, guards, window/gate clearance and winding.
The accepted four-flag Pages build passes. [Prepared receipt](geometry.json):
required near geometry remains exact at 149,963 encoded bytes; foliage is exact.
Optional skyline grows 958 encoded bytes; region grows 161,280 decoded bytes but
compresses 21,723 bytes smaller. Final region: 22,390,143 encoded / 158,041,760
decoded bytes, 1,037 blocks. No new universal cold-start qualification is claimed.

## Native play and review

[Local native traversal](local-wall-walk.json) records 37 supported samples across
the full climb/upper route/return and a second climb for three guard contacts.
Havok stays active, Fly off, zero recoveries/runtime/GPU errors. Inward/outward
right guards stop at local u12.870/u14.312; the rear inner guard stops at d16.875.
The public build also passes [this traversal](public-wall-walk.json),
[nineteen developer destinations](public-destinations.json),
[six surface-teleport controls](public-surfaces.json) and
[ordinary map selection/pause/focus/disposal](public-map.json).
[The connected public tour](public-region.json) enters/returns from all eight
registry destinations and returns to the initial bridge: nine connecting legs,
527 supported movement samples, Havok active/Fly off/zero recoveries or errors.
One ordinary Fire Blast clearance removes chapel doorway hostiles; God mode grants
invulnerability, without bypassing physical enemy contact or architectural collision.

Root inspected the actual courtyard, [landing](stair-landing.png),
[raised-window view](window-view.png), [gate return](gate-return.png), sampled
original motion frames and actual MP4 playback. Existing spring-arm collision
retracts against walls and can omit the nearby actor; its framing policy is retained.
[Capture manifest](capture-manifest.json): 1,119 timestamped frames, unchanged
1280×720 viewport/canvas/source dimensions; encoded duration 45.322 s, H.264,
square pixels, rotation 0. Capture cost is separate from the performance gate.

[Grok 4.6/high review](source-review.md) completed named source reads and a CPU ray
probe, with no consequential construction defect observed. Its report describes
unused turns/forced closure inaccurately: CLI receipts show the first pass capped
at eight (`cancelled`), followed by one report-only continuation (`end_turn`, three
reported turns). Native play, packets, visual quality and performance were not its
acceptance. Its wider chest-height span omits overhanging trim/cap restrictions;
the 2.06 m metadata remains conservative. Full root checks and native guard contacts
support the travel lane. No clean independent end-to-end review is claimed.

## Separate performance

M1 Max, uncapped Chromium WebGPU, 1280×720/DPR1, seven enemies, three 12-second
runs each, no recording/GPU queries; map closed/no selection. One owned game only;
build, reviewer, encoder, media and review tabs closed before sampling.
[All 37,619 raw intervals](settled-fps.json), [compact conditions/results](fps-summary.json).

| Route | FPS range | Largest p99 | Worst interval |
| --- | ---: | ---: | ---: |
| Meadow | 199.6–199.9 | 6.4 ms | 9.6 ms |
| Town | 189.9–192.2 | 6.5 ms | 9.9 ms |
| Bridge | 228.9–229.0 | 5.6 ms | 9.0 ms |
| Cathedral | 219.0–219.3 | 6.0 ms | 8.5 ms |
| Forest | 201.2–208.5 | 6.2 ms | 9.0 ms |

Zero intervals >16.67 ms, full/rolling pacing flags, errors or recoveries. Local RAF
throughput meets 144 FPS and >120 FPS targets; it is not a production comparison,
physical mobile acceptance or a timed wall-walk/capture result.

## Public delivery and remaining limits

[Seal](preview-seal.json) 13cd5b76… binds 646 files / 374,122,401 bytes to committed
product c3419d4. [Served preview](served-preview.json): 649 matching checks and
323 checked cache policies. The first surface-check invocation omitted `?dev`;
its ordinary-menu screenshot/failed receipt is retained locally separately. The
correct invocation passes; no product correction/rebuild was needed for that error.

Reviewed motion is Telegram **897**; returned 1280×720 matches the file.
[VE MP4](https://ve.sparkify.dev/wow-clone/ashen-reach/gothic-exploration/2026-10-09/wall-walk.mp4)
is HTTP 200 / video/mp4 / 22,955,032 bytes, exact SHA-256 c7a7eef9…; range 206
returns the exact first 1,024 bytes ([receipt](ve-delivery.json)). Actual direct
VE playback advances from 0.164 to 45.322 s without media error. Telegram application
inline/fullscreen remains unverified. [Fresh production metadata](production-state.json)
confirms unchanged 5723a4ab / 7d00c56 production. Its independent startup hold,
physical mobile device loss and the earlier 219.9 ms readiness interval remain open.

All native contexts close in `finally`. Root Chrome2789/CDP10037, Vite2740+2784/5873
and compiled35177/7074 are stopped. Grok18482+44458, capture, encoder and delivery
commands are done; media42091/7077 and review tabs1147996154/1147996158 are closed.
No owned game renderer remains. User Edge fifteen existing tabs, regular Chrome
New Tab, Orca and unrelated Vite4000 are preserved. Next proposed slice is the
[connected upper hall balcony](../../plans/gothic-exploration/g06-hall-balcony-2026-10-09.md).
