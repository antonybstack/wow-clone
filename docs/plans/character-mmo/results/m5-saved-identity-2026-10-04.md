# M5 saved Human identity — local checkpoint, 2026-10-04

The corrected approved faces now work on the ordinary game URL: save and reload,
choose an authored face/hair combination in Armory, and undo identity while keeping
later gear, colours and body changes. **M5 is still open.** The lossless selected
startup pilot misses one second; compact startup, complete fit/device gates and
production release follow. Public production stays M7 `4063f49` / Pages
`b3fdafd8-c343-4147-ae2e-760a155c8d06`; nothing from this checkpoint is deployed.

## Shipped to the local integration

- Four bounded choices: Original adventurer, Prime bald, Prime ponytail, Weathered
  bald. Prime and Weathered are distinct authored faces. They are not continuous
  age transformations; independent skin/hair colour and arbitrary head/hair pairs
  remain unavailable. Original uses `components:{}`.
- Local catalogue v6 with independently frozen v1–v5 migration profiles. Saved
  selections determine the body before the first playable frame. Unsaved/default
  starts keep the original startup graph; no new identity source is required.
- Three immutable connected-body packs and two head-specific fitted hoods, using
  the approved source pins. Exact canonical 65-joint bind/rest copying removes
  Blender roundoff without changing accepted mesh geometry, UVs, weights, morphs
  or any of the 57 source animation curves. The source remains connected at the
  neck. Geometry/animation fingerprints and strict skin checks guard publication.
- The existing native source/equipment transaction stages complete hidden bodies
  and clothing. Commit checks the logical actor generation and cancellation on
  the render boundary. Gear, dyes, shape, physics/camera scale, native animation
  state and socket/palette ownership are retained. Failed fetch/build keeps the
  current actor and storage; cancelled staging is disposed. Texture upgrades only
  affect the body/equipment captured by that job.
- One Face and hair select above Body, with Undo identity and Original face.
  Changing away from Human retires the editor; race return restores the parked
  Human identity. Orc/Undead recipes have no Human components.
- Existing remote publication tools regenerate v6 metadata after their native
  bounds sweep: **142,120,095 deformed points, zero escapes, all leases/reservations
  released**. All **45 binary hash/size tuples are unchanged**. Parked shared-region
  presence explicitly refuses new head identities because its renderer has no
  published identity fit. This checkpoint does not add multiplayer head support.

The independent Grok 4.6/high review found a missing coverage revision. Ordinary
first-play reproduced it before acceptance. The publisher now copies the accepted
revision and preparation, runtime loading and release verification all call the
existing `manifestBodyCoverage` adapter. No source pins were regenerated to fix
this. [Review and disposition](../../../reviews/character-mmo/m5-saved-identity-runtime-2026-10-04.md).

## Verification and motion

Character **191/191**, equipment **112/112**, presence **5/5**, startup-prefetch
**6/6**, selected-startup **3/3** pass. The selected-startup three are also included
in the character count. New sealed-pack tests verify each exact bind/57 curves/
geometry fingerprint and intentionally damage a rest transform and vertex;
provenance/descriptor negative controls also fail as expected. Release build and
eager-startup graph guards pass. All **340 served artifacts** match the verified
compressed local preview, including identity packs and remote v6 metadata.

Eight ordinary-route live cases pass on both development and that build:
four saved first-play choices (eyes/brows/hair/body/gear/shape/dyes/Havok checked),
actual select/undo/queued choices/reset, HTTP 500, corrupt source with retry, and
held-download editor disposal. Failure cases use fresh contexts, disable HTTP
cache and assert interception happened; a retry from speculative prefetch is
accounted for rather than silently claiming a vacuous injection passed.

The 81.616-second reviewed live film shows Weathered short/stout, Prime neutral,
and ponytail tall/slender; front/profile/back, face detail, fitted hood and hair
restoration, eight native inspection motions, actual identity change/undo and
normal Havok walk/jump/spell/attack. All three reports have no page/GPU errors or
recovery teleports. Timestamped captures encode as H.264, 1280×720, square pixels,
rotation zero; the concatenated duration differs from source elapsed time by
1.4 ms. This recording is separate from the performance benchmark.

Telegram **852** returned matching dimensions/duration. Real Telegram Web inline
video renders at **737×414.5625** and its viewer at **1280×720**, both with `contain`
and correct proportions against the original frames. Fullscreen activation did
not occur (`document.fullscreenElement` remained absent); Telegram Desktop is
unavailable. Do not label either fullscreen surface accepted. The
[VE MP4](https://ve.sparkify.dev/wow-clone/ashen-reach/character-mmo/m5-saved-identity-2026-10-04.mp4)
serves HTTP 200 / `video/mp4`, byte ranges return 206, and real direct playback
advances and seeks to the ponytail/hood segment at correct 1280×720 dimensions.

## Settled performance, measured separately

Apple M1 Max; uncapped Chromium 154 WebGPU; actual 1280×720, DPR 1; seven enemies;
GPU timestamps available; three 12-second runs per five routes; one owned active
game page and no other observed game renderer. Default and selected comparison
uses the same build, tallest/slender shape and largest mixed dyed outfit. The
ponytail is hidden under its hood; these rows do **not** prove exposed-hair cost.

Route FPS below is 1000 divided by the mean of three full-window mean frame times.

| Route | Original face | Selected first cohort | Selected repeat | Repeat mean frame cost vs original |
| --- | ---: | ---: | ---: | ---: |
| Meadow | 212.2 | 201.3 | 210.3 | +0.90% |
| Town | 213.7 | 194.5 | 207.7 | +2.91% |
| Bridge | 243.7 | 225.2 | 233.7 | +4.28% |
| Cathedral | 249.4 | 238.7 | 241.9 | +3.11% |
| Forest | 233.3 | 223.8 | 228.4 | +2.16% |

Every individual run mean exceeds 144 FPS. The first selected cohort has pacing
bursts and changes over 5%; it remains recorded. They did not repeat, so no cause
or performance fix is inferred. Its per-run p99 is 8.2–11.6 ms, worst **16.1 ms**.
Repeat p99 is 5.5–8.1 ms, worst **11.6 ms**. Across all three cohorts,
**120,946 intervals, zero above 16.67 ms**. Repeat cathedral has a near-240 Hz flag
in all three runs; original forest also flags one run, and rolling flags remain in
raw data. These limit ceiling claims even though the browser launched uncapped.

## Cold pilot — failed one-second target

Fresh Chromium process/profile and HTTP cache per run; compressed build;
50 Mbit/s / 40 ms; 1280×720 DPR 1; no CPU throttling; OS/GPU-driver caches remain
uncontrolled. The selected Prime ponytail, tallest/slender body and largest dyed
outfit are dressed and grounded with a completed GPU frame/input at first play.
**2502.6 / 1198.0 / 1149.4 ms: 0/3 within one second.** Three pilots are not the
required 20-run cohort and no p95 acceptance is claimed.

The repeated startup cost follows the body/gear payload; selected lossless bodies
are 1,241,379 / 1,541,329 / 1,246,743 encoded bytes, compared with released 991,320.
The new full fitted hoods are 376,208 / 379,232 bytes versus compact release
211,307. Initial compact and full identity body/hood descriptors currently refer
to the same lossless meshes. Embedded maps are bounded 256-pixel previews with
separate full maps; clothing outside body/hood reuses released compact descriptors.
The first run separately retains a GPU first-use completion tail. Do not attribute
that outlier to transfer or claim the previously deferred driver issue fixed.

Next, reduce the fitted hood with the existing native compact tools, inspect
payload/decode/upload deltas and pilot again. Protect approved face geometry and
full source curves. If a compact connected-body representation is needed, use
the existing native body/gear promotion after play with current-owner, shape,
outfit/dye and phase guards; never boot a different identity. Then finish default,
saved endpoints and largest-outfit 20-run cohorts, unhooded/Weathered settled
checks, all required fit motions, touch/WebKit, final live delivery and production
release/rollback verification before closing M5 or moving to M6.

## Evidence and ownership

[Machine-readable checkpoint](../../../baselines/character-mmo/m5/saved-identity-2026-10-04/runtime-checkpoint.json)
links the raw live/FPS/cold reports, manifests, source fingerprints and motion hash.
Authoring failed attempts remain in ignored local logs; accepted measurements are
committed separately. Capture source frames/manifests remain under ignored
`ve-capture/character-mmo/m5-saved-identity-2026-10-04`.

Root owned Chrome 73967 / CDP 10037 / Vite 5873 and compressed preview 86449 /
7174. Every live/record/FPS context and every fresh cold-process browser closes
after its job. The direct VE tab is closed. The existing user Telegram tab is
retained with its viewer paused and **zero playing videos**; closing the viewer
resumes inline autoplay, so it stays paused during the final ownership audit.
Harness/preview are stopped at this checkpoint's handoff. User Vites 5173/4000,
Edge research tabs and the unrelated AGENTS edit remain intact.
