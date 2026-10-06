# M8 — equipment factory and Bastion shoulders

Status: factory, actual item and local functional gates pass; final performance
and production release gates are in progress. The accepted production
release remains M5 until the content release passes its public checks.

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
537 files; production verification and delivery are still pending.
