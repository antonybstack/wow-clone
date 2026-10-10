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
Public copy SHA-256 matches the local encoded file; `video/mp4`, advancing decoded playback and seeking pass ([receipt](g10-public-video.json)). Telegram **904** returns matching 1280×720 dimensions and 9.510 s duration. Telegram application inline/fullscreen proportions remain unverified. [Independent source review](g10-review.md) finds no actionable defect in the paths checked. The six-turn pass ended without a report; a single report-only continuation preserved its observations and unchecked areas. It reviewed G10 working files before commit 87b7b66; it does not review subsequent G11 changes.
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
([receipt](g11-public-video.json)). Telegram **905** returns matching 1280×720/
7.897s; application inline/fullscreen remains unverified.
