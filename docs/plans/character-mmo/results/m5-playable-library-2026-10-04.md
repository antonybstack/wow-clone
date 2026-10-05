# M5 selected startup — native playable animation library

Local implementation, functional verification and reviewed motion are delivered.
**M5 remains open and unreleased.** Production is still M7 source `4063f49` / Pages
`b3fdafd8-c343-4147-ae2e-760a155c8d06`. This follows the
[first compact checkpoint](m5-compact-identity-startup-2026-10-04.md).

## Native implementation and exact invariants

The lossless body census found 1,248,560 decoded animation-accessor bytes and
756,891 meshopt-compressed bytes across three shared animation buffer views.
Individual clips share those views: their compressed view sizes cannot be added
or attributed as independently encodable clip bytes. The committed census records
per-clip accessor costs and actual native serialized pilots separately.

`ASHEN_PLAYABLE_MOTION` now owns the ordinary runtime's exact clip selection,
gait contacts, landing and cast profiles. The same contract derives all 22 required
startup motions, including directional gaits, turns, channel transitions, carry,
hit and all three spell pairs. Melee imports its name from this contract as well.
No animation timing, masks or playback behavior changes.

The native glTF Transform compiler disposes only unused library Animation
channels/samplers and prunes only orphaned accessors/buffers. It never prunes
nodes, attributes, morphs, skins or materials. Comments link the official
[Animation](https://gltf-transform.dev/modules/core/classes/Animation),
[prune](https://gltf-transform.dev/modules/functions/functions/prune) and
[pinned Lite animation architecture](https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/docs/lite/architecture/07-animation.md).
The latter documentation URL was checked successfully.

Full body, clothing, hood and texture descriptors are **byte-identical to `03274d4`**;
all 57 original full-body curves remain available. Compact bodies retain the exact
approved face/body/hair geometry, normals, UVs, skin weights, both ordered morphs,
canonical 65-joint rest/bind, coverage and all playable samples/interpolation/times.
No geometry simplification, quantization, resampling or custom runtime loader is
introduced. The release guard checks declared clips and geometry/coverage equality;
native decoded asset tests verify the actual curves and bind with defect controls.

| Identity | Full encoded body bytes | Playable encoded body bytes | Saved bytes | Reduction |
| --- | ---: | ---: | ---: | ---: |
| Prime bald | 1,215,036 | 815,696 | 399,340 | 32.9% |
| Prime ponytail | 1,514,649 | 1,115,427 | 399,222 | 26.4% |
| Weathered bald | 1,220,349 | 820,921 | 399,428 | 32.7% |

GLB JSON shrinks from about 694–698 KB to 256–261 KB, before HTTP/file compression.
These are representation costs, **not measured load-time or FPS improvements**.

The approved visual is already complete and every currently playable motion is
resident, so clothing refinement keeps the actual actor and native group objects.
It does not download or stage a second body merely to restore unused library clips.
The full pack remains the optional identity-edit/source path. Default and Original
identity requests and all shared clothing remain unchanged. This refines checkpoint
D's earlier full-promotion proposal: promotion is needed if visual/motion behavior
is reduced, not for omitting an unused library while preserving the complete
playable contract.

## Checks and reviewed motion

Character **200/200**, sealed-pack **16/16**, focused startup **14/14** and the final
build pass. Sealed-pack checks include a missing required Lava lower clip, altered
sample time, changed geometry, changed bind/rest, stale authoring input and modified
embedded descriptor. The final focused repeat is **30/30** (sealed plus startup).
Equipment/presence code is unchanged; their prior checkpoint results are retained,
not reported as newly run.

**11 dev refinement cases** pass: all three identities at neutral/short-stout/
tall-slender, failed full hood and identity queued during refinement. They prove
the compact body request, actual native 22-group set, complete selected first-play
identity and absence of a full-library body request. Clothing refinement preserves
the actual container/group objects/paused times; failures retain the compact actor.
**8 built saved-route cases** pass: four first-play choices, race return, actual
UI/independent undo/queue/reset, source HTTP/corrupt failure/retry and cancellation.

Three additional final-build cases run **30 native operations**: ordinary backward
movement, both strafes and turns; actor hit/melee API diagnostics; and generic
channel enter/loop/exit on the existing `?animationLab` route. The normal game
uses 2 for Lava Ball. These diagnostic API calls do not claim combat-damage
acceptance. Each test checks actual playing native groups, Havok, no recoveries,
zero page/GPU errors and retained recipe.

**Three final desktop mobile checks** pass on the tall/slender ponytail recipe:
Chromium 154 native touch, WebKit 26.6 and real injected Chromium depth-bundle failure
with the existing empty-fragment fallback. Identity/select/save/independent undo,
body/dye controls and displayed movement pass. Chromium also checks capture loss,
cancel, modal and blur. WebKit travel is keyboard and controls are touch taps.
430×734 CSS / DPR3 / 322×550 actual buffer; no phone-FPS claim. WebKit ownership now
records its actual macOS Playwright launcher PID rather than null.

The portrait controls work, but the inherited narrow preview leaves part of the
face behind the side pane, and Shared region overlaps the Armory heading. These
are concrete device-layout follow-ups; the functional result is not visual phone
acceptance. Complete the broader outfit/motion matrix and device-layout review.

Local native Wrangler Pages verifies **848 served artifacts**, **20 identity**
and five region cache policies. Mutable index revalidation and immutable new
body URLs pass. This is a local Pages check, **not a production deployment**.
The [independent Grok source review](../../../reviews/character-mmo/m5-playable-library-2026-10-04.md)
found no current highest-consequence defect; melee-name drift and missing live
operations were addressed and checked by the parent.

Reviewed motion: Telegram **854** /
[VE MP4](https://ve.sparkify.dev/wow-clone/ashen-reach/character-mmo/m5-playable-library-2026-10-04.mp4).
Three live recordings contain 833/788/821 source frames. Actual encoded samples
and live published playback show compact motion, unchanged-actor clothing
refinement, full native walk/run/jump/land/fire/lava/pulse/carry, hair restoration
and ordinary Havok controls. H.264, 1280×720, square pixels, zero rotation,
**61.915974 seconds**, **33,051,418 bytes**; encoded/source elapsed difference
−1.206 ms. SHA256 `b1d718679e74f14bd4001c2cf71f581c63d140621102db96ae73149c886bdc1e`.

Telegram returns matching 1280×720 / 61.916 seconds. Web inline element is 737×414.5625,
expanded 1280×720, both `contain`; motion was reviewed in the expanded player.
Inline motion, actual fullscreen and Telegram Desktop remain unverified this
pass. VE returns 200 `video/mp4`,206 ranges, and real 1280×720 playback. Native
scrubber click seeks backward37.401→30.908 seconds; a focused Left key seeks
54.359→53.802 seconds while playing. The owned VE tab is closed, all five Telegram
videos are paused, and the user review tab remains open in viewer 854.

## Limits, lessons and next work

The user-owned native WoW client 92396 remained active (about 33–162% CPU samples).
No new cold cohort, single-run timing or settled-FPS acceptance was attempted.
Previous uncontaminated results remain historical evidence; the one-second target
and selected-body route budgets still need isolated measurement on this build.
All owned browsers, contexts, servers and reviewer processes are stopped.
Unrelated user game, Grok, Edge tabs and Vite 5173/4000 remain intact.

The useful optimization here is content selection through existing native tools,
with exact active-curve proof. A large source library need not all be a first-play
dependency. Sharing runtime/compiler names prevents drift without adding another
loader, mixer or a transient duplicate skinned actor. Count shared animation
buffer views once; use actually serialized files to compare compact candidates.
Native video scrubber focus/click works where a DOM locator or setValue failed.

Continue ordinary outfit/motion fits and mobile preview layout, then isolated
20-run startup and paired settled route cohorts. Retain all tails and failures.
Release only after the remaining M5 gates and exact production verification;
physical-phone acceptance stays distinct. The native autonomous goal stays active.

[Verification, payload census, live reports and capture manifests](../../../baselines/character-mmo/m5/playable-library-2026-10-04/checkpoint.json).
Ignored source frames are under `ve-capture/character-mmo/m5-playable-library-2026-10-04`;
the public MP4 above is the recovery artifact.
