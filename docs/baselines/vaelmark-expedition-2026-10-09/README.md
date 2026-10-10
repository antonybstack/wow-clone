# Vaelmark expedition execution evidence

Implementation of [G09–G18](../../plans/gothic-exploration/next-24-hours-2026-10-09.md),
started October 9, 2026, 19:55 PDT. This receipt grows only with actual results.

## G09 bounded diagnosis

Root inspected the current startup submission, registration, priming and frame
scheduler paths against the retained failures. Core loading starts after first
play; no supported new discriminator explains the failed queue-completion window.
No source change, diagnostic retry, cold-start acceptance retry or promotion ran.
Production remains 5723a4ab/source7d00c56 under its independent hold.

The [independent Grok review](g09-review.md) checked retained artifacts but reached
its six-turn cap before source inspection; its report-only resume preserves that
limit. Root completed the named source inspection. Successful traced starts cannot
attribute the earlier untraced misses. G09 ends at this bounded outcome; it is not
a startup fix. Reopen only for a source-backed, discriminating hypothesis.

## G10 memorial and journal

A nearby X/read button at the existing undercroft memorial records its inscription.
Menu → Journal shows the saved text, next direction and existing Vaelmark guide.
Developer tools offers labelled session-only rehearsal; the player's saved journal
is preserved. The episode is local cosmetic knowledge, separate from equipment,
XP, watchman progress and multiplayer authority. The bell/reliquary remain later
milestones; this result does not claim a complete expedition.

The late `createCombat` owner uses its existing tick, a candidate scan at most
5 Hz, activation-time self-filtered Havok clearance, floor-height/reach checks,
and state-change-only local storage writes. It removes its prompt, journal,
style and input-reset subscription through scene lifetime. Storage records are
bounded/versioned and validated; an unsupported original is backed up before
replacement, and a failed backup/write preserves it.

**Focused checks:** 20/20 state/storage, cathedral-guide and region-stream tests.
**Live checks:** [seven native cases](g10-native.json), Chromium WebGPU, 1280×720
canvas/viewport, DPR1, seven enemies, Havok active, God/Fly off for ordinary walking,
zero recorded runtime/GPU errors or recoveries. Diagnostic cases are labelled:
wall-ray origin, nave-above placement, controlled dead state and storage denial.
Ordinary checks include side-aisle walk, X/button, guide, focus, repeat, reload,
menu/Armory suppression and movement with denied journal storage. Scene disposal
removes owned UI and prevents a retained owner from resetting afterwards.

Preparation keeps required near geometry at **149,963 encoded bytes**; no new
geometry, texture or audio payload. Only authored memorial metadata/provenance
changes in the prepared world. Exploration/content/storage modules remain behind
late combat creation; early menu uses providers only. Final built boot-graph and
integration performance checks remain G17/G18 gates.

**Motion:** root reviewed actual browser playback and the prompt, readable journal
and guide transition in a 9.510139 s timestamp-preserving live MP4. Source/viewport/
canvas 1280×720, square pixels, zero rotation; no capture-derived FPS claim.
[Direct VE MP4](https://ve.sparkify.dev/wow-clone/ashen-reach/gothic-exploration/2026-10-09/memorial-journal.mp4).
Public copy SHA-256 matches the local encoded file; `video/mp4`, advancing decoded playback and seeking pass ([receipt](g10-public-video.json)). Telegram **904** returns matching 1280×720 dimensions and an integer 10 s duration for the 9.510 s encoded file. Telegram application inline/fullscreen proportions remain unverified. [Independent source review](g10-review.md) finds no actionable defect in the paths checked. The six-turn pass ended without a report; a single report-only continuation preserved its observations and unchecked areas. It reviewed G10 working files before commit 87b7b66; it does not review subsequent G11 changes.
Local raw evidence is `.cache/vaelmark-expedition-2026-10-09/g10-readable/`;
`check-vaelmark-expedition.mjs` recreates its native checks and timestamp manifest.

## Execution-start interior baseline

[Raw six windows](interior-baseline.json.gz), [closed ownership](interior-ownership.json).
M1 Max, uncapped Chromium WebGPU, core loader, native 1280×720/DPR1, seven enemies,
three 12-second stationary windows at each existing developer landing; mortal,
Havok active, Fly off, no recording/GPU timestamps/build/encoder/Grok worker.
G10 logic is installed; this precedes G11/G12 visual changes.

| Location | FPS (three windows) | Largest p99 | Worst | >16.67 ms |
| --- | --- | --- | --- | --- |
| Undercroft | 179.21 /179.31 /179.27 |6.40 ms |9.30 ms |0 |
| West bell landing |241.30 /241.34 /241.47 |5.10 ms |11.00 ms |0 |

15,147 raw intervals; all six native physics/resolution/enemy/pacing/error/recovery
checks pass. Exact camera, location and appearance remain in each raw row. This
is a new interior baseline, not a measured improvement, traversing/cold-streaming
tail or production result. Compare final matching interior conditions at G17.

## G11 West bell mechanism

The existing west bell now has a pull rope and swinging clapper. X/the nearby
button activates it; a pre-inscription ring moves it without credit, and the
inscription stage advances once to `bell-rung`. A two-second cooldown limits
repeat triggers. No bell collision, staircase or route changes.

[Six native cases](g11-native.json) pass at 1280×720/DPR1, WebGPU/Havok, mortal
walking with Fly off and no recoveries/runtime/GPU errors. The complete existing
24-flight ascent, pre-inscription ring and descent use ordinary keyboard controls.
Separate labelled diagnostic landing/audio cases cover native master sound/mute,
journal/reload, optional-cue decode failure, held-cue departure and disposal.
Shared spell audio survives cue failure. Two existing local shadow slots remain;
the 184 decorative triangles are excluded from sun/local caster lists. No new
shadow map, texture or collision triangle. Original 158,804-byte bell WAV is
optional and fetched only after Sound is enabled and near the landing. Required
near geometry remains 149,963 encoded bytes.

Twelve focused state/guide checks pass. [Grok source review](g11-review.md)
finds no consequential defect in its three scoped questions, with unchecked
areas recorded. Eight-turn cap ended the worker after it wrote the report.
The review inspected working files before this milestone commit.

Root reviewed actual browser replay and opposite clapper swings plus the saved
journal in a 7.896726-second [native live MP4](https://ve.sparkify.dev/wow-clone/ashen-reach/gothic-exploration/2026-10-09/west-bell.mp4).
The movie uses a diagnostic top-landing setup, ordinary RMB camera look and
actual Lite master-mix capture; it is not the connected route proof or an FPS
measurement. Original source/viewport/canvas 1280×720, square pixels, rotation
zero, elapsed timestamps preserved; AAC mux copies video unchanged.
[Manifest](g11-capture.json), [AV receipt](g11-av.json). Final integration
performance and sealed preview remain G17/G18; production is held independently.

Retained operator failures: first route fixture read nonexistent motion-facing;
second boot fixture referenced ASHEN before creation; a camera-only seeded fixture
then reset its save on reload. Corrected helpers use native `getFacing`, guarded
`globalThis.ASHEN`, and a once-per-context seed. Original failures are preserved
in ignored raw evidence; none is presented as a product pass. Final full native
run passes six cases, followed by two passing camera-only replay/reload cases.
Reproduce with `check-vaelmark-bell.mjs`; optional `ASHEN_BELL_CAPTURE_ONLY=1`
labels the diagnostic capture separately. Raw evidence lives in
`.cache/vaelmark-expedition-2026-10-09/g11-{final,reviewed}/`.

Public MP4 exact bytes/hash, `video/mp4`, decoded playback and seek pass
([receipt](g11-public-video.json)). Telegram **905** returns matching 1280×720 and integer 8 s duration for the
7.897 s encoded file; application inline/fullscreen remains unverified.

## G12 Memorial reliquary and remembrance

The answered bell opens a small hinged box on the unchanged memorial cap. Its
bronze seal is revealed before a separate Claim action, and the journal records
an original remembrance emblem once. The reward points to Hollowmere; no XP,
equipment entitlement, watchman progress or new chamber is added. A fresh live
transition waits for the player to return to the crypt before revealing. Saved
`bell-rung` restores an open box/relic directly; later phases restore an empty,
open box without replay. Developer rehearsal resets the box and leaves the save
alone. The lid and relic remain decorative, with no new walkable surface.

[Four final native cases](g12-native.json) pass: connected fresh-journal inscription
→ west-bell ascent/ring/descent → reliquary claim → both memorial aisles → nave
return, then three labelled saved-phase reloads. Initial Developer nave placement
is explicit; all subsequent travel uses ordinary keyboard controls, God/Fly off,
Havok active, with zero recoveries or recorded runtime/GPU errors. Claim/repeat
and original journal emblem pass. XP/watchman snapshot is unchanged. Tomb contact
remains outside the x=-8.25 stone edge, with feet on the crypt floor. New bell +
reliquary total **512 render triangles, zero collision triangles**; both are
excluded from sun/local caster lists. Two existing local shadow slots remain.
Required near geometry and all existing packet bytes remain unchanged; authoring
adds only two prop-location metadata vectors. Twelve focused state/guide checks
pass. Final integration/FPS/sealed-public game acceptance remains G17/G18.

[Grok source review and root adjudication](g12-review.md): the single alleged null
exception was rejected after executing the actual continuous optional chain and
confirming JavaScript's documented semantics. The reviewer grouped a chain that
source does not group. Other checked paths had no accepted consequential defect;
its unchecked areas are retained. No runtime acceptance is inferred from prose.

Raw attempts are retained under `.cache/vaelmark-expedition-2026-10-09/`.
The first four-case run passes but default framing hides the small box behind
the actor. Two subsequent camera passes stop at an over-tight -8.60 contact
assertion; a recorded contact x=-8.5404 is still outside the unchanged edge,
with feet on the floor. The final helper requires x<-8.50 and floor agreement,
asserts facing before contact and uses one ordinary LMB orbit rather than
accumulating it. The final four-case run passes at x=-8.5650. This was a fixture
correction, with no product collision change. The earlier failures are not passes.
Future captures should audition their ordinary camera before a long traversal;
contact assertions must derive from authored boundaries and native tolerances.

**Motion:** root reviewed actual browser replay/seek, closed/open/relic/journal/empty
poses and ordinary descent/return in the continuous 160.956094-second native
[VE MP4](https://ve.sparkify.dev/wow-clone/ashen-reach/gothic-exploration/2026-10-09/reliquary-expedition.mp4).
Source/viewport/canvas1280×720, square pixels, zero rotation; encoded elapsed
160.955093s. [Timestamp manifest](g12-capture.json). Exact public 39,902,383 bytes/
SHA-256, `video/mp4`, decoded playback and journal seek pass
([receipt](g12-public-video.json)). Telegram **906** returns1280×720 and integer
161s for the160.955s file ([sanitized receipt](g12-telegram.json)). Application
inline/fullscreen remains unverified. No recording-derived FPS claim.

## G13 Walking-camera readability

Two observed gaps are corrected: the west stair mouth now has a restrained warm
light cue, and the opened reliquary/seal is visible beside the actor from its
ordinary interaction position. The existing west-chapel fixture moves from
z335 to z330.5; the middle-descent fixture stays at z342. Its emission point sits
0.4 m below the opaque housing/bracket, fixing a reproduced self-shadow defect
without increasing light strength or the two-map budget. A strength-only audition
did not repair that obstruction. The small box shifts 1.3 m along the solid
memorial cap; its hinge offset, barrier, aisles and interaction anchor are unchanged.

[Before entrance](g13-stair-mouth-before.png) · [After entrance](g13-stair-mouth-after.png)
· [Before memorial](g13-memorial-before.png) · [After memorial](g13-memorial-after.png).
These are original renderer captures from the same authored waypoints, native
1280×720/DPR1, saved bell-rung phase, default walking camera (pitch .04/radius 3.5),
and unchanged daylight. Native solver/input variation leaves 1.1/1.3/3.8/10.4 cm
XZ differences across entrance/turn/memorial/return; they are matched viewpoints,
not pixel-identical physics or idle animation. [Native receipt](g13-native.json.gz).

Before and final ordinary crypt circuits pass with Havok active, God/Fly disabled
through Developer tools, zero recoveries and no recorded runtime/GPU errors. The
final circuit claims the seal and returns to the nave without Developer UI. Initial
Developer nave placement and a labelled saved bell phase are setup fixtures, not
the fresh whole-episode acceptance (G12/G17). 27 affected geometry/state/guide
checks pass; the rendered-world shadow-ray case reproduces the prior housing
obstruction and verifies the corrected emission path. [Packet receipt](g13-packets.json)
confirms zero added render/collision triangles, near geometry/hash unchanged at
149,963 bytes; the moved fixture changes skyline +341 bytes and region/index
compression. Provenance is verified. No new light, shader, texture or loop.

[Bounded Grok source review](g13-review.md) finds no consequential scoped
clearance/slot/hinge defect. Its five-turn pass left a checkpoint; one three-turn
report-only resume completed the report. Parent corrected its minor compass
comment finding and independently diagnosed the later self-shadow fix, which was
not in that review. The 2.5 cm inner-cap overhang remains fully inside the broader
solid trim cap and does not justify a collision or walking change.

Root reviewed actual advancing browser playback, descent/return and the threshold/seal
seeks in the 35.264023-second [native live MP4](https://ve.sparkify.dev/wow-clone/ashen-reach/gothic-exploration/2026-10-09/undercroft-readability.mp4).
[Manifest](g13-capture.json), [public-video receipt](g13-public-video.json):
1280×720, square pixels, rotation zero, source elapsed 35.264240 s retained,
10,903,494 exact public bytes, `video/mp4`, native decoded playback/seek and HTTP 206
range pass. Python SimpleHTTPServer’s local MP4 origin reset seek to zero; the
verified VE origin seeks correctly. Use the existing Vite `@fs` origin (HTTP 206)
for local media review rather than reimplementing a server. Telegram **907** returns matching 1280×720; its integer 36 s duration covers the
35.264023 s file ([delivery receipt](g13-telegram.json)). Telegram application
inline/fullscreen verification remains distinct and unclaimed.
Captures are not FPS evidence;
final isolated matching performance and sealed game preview remain G17/G18.
Raw auditions and intermediate recordings remain under ignored
`.cache/vaelmark-expedition-2026-10-09/g13-*`; reproduce with
`ASHEN_CDP_PORT=10037 ASHEN_CAPTURE_DIR=<directory> ASHEN_READABILITY_CAPTURE=1
node scripts/ashen-reach/check-vaelmark-readability.mjs`.
