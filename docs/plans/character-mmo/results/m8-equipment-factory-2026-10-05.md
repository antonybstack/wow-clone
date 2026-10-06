# M8 — equipment factory and Bastion shoulders

Status: the bounded rigid-shoulder factory/content proof is accepted on production.
Source **5fba4d8a52069db845ccafa4fc05faf418850bf4**, Pages
**63b6e02b-c93f-4b85-aebf-f2ae79bfb8a6**. The broader M6 visual matrix,
cloth authoring, Elf and physical-device exits remain open.

The new `prepare:factory` entry point builds a real rigid shoulder item for Human,
Orc and Undead through the existing glTF Transform, Meshoptimizer, native Lite and
coverage tools. [Authoring instructions](../../../equipment-factory.md) explain
the descriptor, repeat build, integration command and current limits.

Bastion reuses the source-derived shoulder cap and adds project-authored crest
and lame geometry. Welding exported seam duplicates before Blender's exact
Boolean union preserves the cap and removes intersecting internal operands.
Earlier intersecting, non-deterministic and cap-destroying candidates are rejected
and retained in the task cache. Bind/rest pose/source animation remain unchanged.
The final neutral artifacts have 1,935 Human, 1,789 Orc and 814 Undead triangles.
The published shaped Human piece is 83,152 gzip bytes; its compact tier keeps the
same rigid geometry. The isolated factory shape proof has different bytes and
is not the shipped shape artifact.

Catalogue v7 appends the item while preserving frozen v1–v6 registries. Old saves
retain identity, shape, equipment and dyes. Generic garment selection now includes
registered authored items. The equipment-only identity refresh preserves accepted
body, head, hair and hood bytes and refuses a changed source body. Old immutable
identity descriptors remain available for outstanding requests.

A held-fetch check found an existing gameplay-wrapper defect: its actor queue
prevented the equipment loader from observing newer same-slot intent. Per-intent
revision checks now cancel an active obsolete fetch through that loader, while
different slots and partial loadout patches retain their order. Actor body/race
barriers remain in place. Native refusal checks also inspect all scene owners;
an invisible leaked mesh is not accepted as disposal.
The independent Opus review found no blocking regression and identified admission
ordering: an online/disposed call now refuses before cancelling admitted work.
Newer admitted same-slot intent supersedes older intent even when its item later
fails validation or transfer; the committed worn outfit remains unchanged.
Cross-key presets and legacy dye aliases retain their previous serialized behavior.

The source descriptor and inputs are pinned, raw export directories are exclusive,
and all four artifacts repeat byte-for-byte on this host. Full Blender build
information, platform/architecture, restricted environment and timeout are recorded.
Missing race fits and reused output directories are deliberately refused.
Local multi-race manifest replacement is not an atomic transaction; do not run
concurrent publishers. Material verification covers factors, with pinned builders
limiting the remaining policy. Cloth, arbitrary proportions, Elf, all mixed
outfits and physical-phone acceptance are outside this proof.

Evidence is under `.cache/character-mmo/m8-factory-2026-10-05`; the compact tracked
receipt will record final build, measurements, publication and motion delivery.
Failed harness controls remain distinct from product failures: native Lite mesh
visibility does not inherit an invisible player capsule; Shift walks; jump must
span a sampled input frame; diagnostics must serialize primitive values.

## Local verification

The final native Pages build passes all seven release gates: exact HTTP files
and cache policies; bridge and west bell return routes with Havok; eight saved
identity cases; eight mobile cases; eight injected depth-fallback cases; and
four Weathered WebKit cases. The new shoulder item is selected in the mobile,
fallback and WebKit saved recipes. The factory live checker passes 17 cases,
including seven real Armory fits, nine source motions with sword and greatstaff,
three adjacent torso boundaries, hood/hair restoration, dye, actual running,
turning, jump and Fire Blast, save/reload, failed/corrupt transfer and retry,
active/queued same-slot cancellation, independent slots and complete disposal.
The online-admission check injects only a local authority flag; it is not a
public multiplayer test.

Character/source verification passes 223 tests, equipment 114, and the factory,
v7 migration and presence catalogue checks 26. These are overlapping suites,
not an aggregate count of independent product guarantees. Neutral cold/resident
swaps have nine rows: cold 65.5–85.3 ms, warm 0.5–0.6 ms, worst interval 24.2 ms.
The three shaped hooded-Human rows have cold 68–71 ms, warm 0.6–5.4 ms, worst
21.3 ms. Every existing 200/60/33.33 ms and 917,504-byte limit passes. Swap
throttling uses the legacy 50 Mibit/s / 40 ms setting; startup uses decimal
50 Mbit/s. Transfer byte counts are decoded response bodies, not wire overhead.

The single integration command repeats all four factory artifacts exactly,
verifies three identity presets/43 assets after every downstream step, and finds
zero escaped native swept-bound vertices in the four fitted packs. Coverage
must publish before identity provenance is refreshed. The initial wrong-order
command is retained as a rejected provenance control. A missing Undead fit and
reuse of a nonempty raw build directory are deliberately refused.

Independent asset equivalence retains 258 existing files, with no missing or
changed existing binary. Twelve JSON manifests change and new item artifacts
are added. This permits reuse of M5's unchanged body/world/source checks;
current-build performance, new-item startup and public gates remain fresh.

## Final native performance

M1 Max, uncapped Chromium WebGPU, native 1280×720/DPR 1, seven enemies,
three 12-second runs per route, largest hooded ponytail/Bastion saved outfit.
Recording and encoding were stopped, all user reference media paused and only
one tracked game rendered. Every run exceeds the 144 FPS gate; there are no
recovery teleports, runtime/GPU errors or intervals above 16.7 ms.

| Route | Final FPS range | Worst p99 | Worst interval | Mean change vs Warden control |
| --- | --- | --- | --- | --- |
| meadow | 210.1–210.3 | 6.2 ms | 9.3 ms | -0.45% |
| town | 209.8–210.6 | 6.1 ms | 11.4 ms | -0.12% |
| bridge | 244.7–245.7 | 5.5 ms | 9.2 ms | +0.50% |
| cathedral | 244.6–245.1 | 5.3 ms | 9.2 ms | +0.76% |
| forest | 225.2–232.7 | 5.6 ms | 9.3 ms | +0.16% |

The Warden control precedes the final admission guard; the unchanged geometry,
scheduler and normal idle render path support that comparison. A separate
pre-guard Bastion cohort gives the same conclusion: no repeatable >5% loss.
The unchanged pacing detector retains three full-window statistical hints.
Six same-cohort runs exceed 242.4 FPS, falsifying a hard 240 ceiling with >1%
margin. Native callback attribution counts 630 callbacks/576 submissions over
3.002 seconds, with no completion-only submissions; M5's calibrated capped
control and unchanged RAF-only scheduler remain applicable. These are isolated
browser measurements, not a claim about physical display refresh or iPhone FPS.

Final cache-disabled native startup has 40 fresh processes: new hooded ponytail
p95 **886.3 ms**, maximum **890.3 ms**; new original largest outfit p95
**812.3 ms**, maximum **817.1 ms**. There are no misses or validation failures.
Conditions are decimal 50 Mbit/s down / 10 up / 40 ms latency at native
1280×720/DPR 1. OS/GPU-driver caches are not reset. The final sealed build has
537 files; its accepted production exit is recorded below.

## Retained public loading observation

The first public saved checker completes the four restored presets and actual
UI/undo case, then times out waiting for full readiness on a fresh ordinary
boot before failure injection. It records `TypeError: Failed to fetch` without
a failed URL. An isolated ordinary-load diagnostic subsequently reaches playable
and complete readiness with Havok, with no failed request, HTTP, runtime or GPU
error. One bounded full saved confirmation passes all eight cases. The original
five-case report/timeout remain retained. The exact cause is unconfirmed;
no source change or timing-gate relaxation is used to obtain that confirmation.

## Production and motion delivery

The same sealed 537-file build is uploaded without rebuilding. All 536 served
files match; public bridge and west bell return routes, saved eight, mobile eight,
depth-fallback eight and WebKit four pass in the final gate set. The initial
saved-check fetch timeout is retained above. Rollback is accepted M5 source
`6934292`, Pages `f82f8e2e-0b77-4fff-a5bf-a8e2544aac0b`; no rollback was needed.

Sixty fresh-process/cache-disabled public starts meet the prescribed p95 gate:
**818.6 ms** default, **900.2 ms** original largest/Warden, **998.4 ms** new hooded
Bastion. The hooded cohort has **one miss: run 11, 1,037.9 ms**. There are no
validation failures. Its p95 margin is only 1.6 ms; this is not a guarantee that
every start takes less than one second. All rows remain retained, with no lucky
rerun. Improve largest-outfit headroom before expanding the startup payload.

Telegram **863** returns matching 1280×720 dimensions (its duration field rounds
up to 57 seconds). The actual file is 56.553714 seconds, SAR 1:1, rotation zero;
1,379 native 1280×720 frames preserve 56.554413 seconds of capture timestamps.
[VE video/mp4](https://ve.sparkify.dev/wow-clone/ashen-reach/character-mmo/m8-bastion-factory-2026-10-05-7d1e3393cb1c.mp4)
returns exact SHA-256 bytes, `video/mp4` and HTTP 206 ranges. Reviewed encoded
motion and Telegram Web A inline, expanded and actual VIDEO fullscreen keep
16:9 proportions with contain scaling. VE-hosted normal, full-window and actual
VIDEO fullscreen also pass. Bring the owned tab to the foreground before native
fullscreen; the earlier not-granted attempts remain tooling controls. Telegram
Desktop remains unavailable.

The [tracked receipt](../../../baselines/character-mmo/m8/factory-2026-10-05/receipt.json)
records exact hashes, measurements, reused evidence, retained failures and scope.
Chrome/CDP 10037, Vite 5873 and Pages 7175 are stopped, with no remaining owned
process or game tab. Only the two originally playing user references are restored;
Telegram and the other X reference stay paused. Temporary media guards are removed.

## Largest-outfit startup headroom

Retained traces already narrow the 1,037.9 ms hood miss. M8 run 11 spends
202.5 ms in world setup and 223.8 ms waiting for the Havok runtime, compared with
M8 cohort medians 111.1 / 183.35 ms. Body import (20.7 ms), equipment (15.1 ms),
registration (22.5 ms) and supported GPU completion (97.6 ms) are close to their
cohort medians 20.6 / 15.5 / 22.5 / 95.8 ms. Bastion's 83,152-byte resource completes
at 463.2 ms, well before body import starts at 839.6 ms; Havok completes transfer
at 780.5 ms. This supports investigating the shared world/Havok delivery tail,
not calling new armor parsing or shader compilation the demonstrated bottleneck.

The accepted M5/Warden hood median is 928.55 ms; new M8/Bastion is 949.05 ms.
These separately timed cohorts are not a randomized item-only experiment. They
cannot establish that the item caused the 20.5 ms median difference. Reduced
item bytes could reduce network contention, but that benefit is unproven here.
Next: compare Warden and Bastion saves on the same frozen v7 build/quiet machine,
inspect request/response phases and use existing preload/priority/compact tools
for one attributed candidate. Preserve visibly dressed, GPU-completed first play
and report all misses. Do not repeat cohorts solely for a lower p95.
