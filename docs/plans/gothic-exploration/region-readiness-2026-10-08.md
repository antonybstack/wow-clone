# Why developer navigation waits for region collision

Diagnosis on **2026-10-08**, source **1d4404c**. The user asks why the
Developer tools screen waits so long before allowing cathedral jumps.
The diagnosis below is preserved. Implementation and bounded local comparisons
now exist in the [region readiness result](../../baselines/region-readiness-2026-10-09/README.md).
Navigation is separate from optional details; the compatibility worker splits
geometry/grass, and prepared exact geometry streams through the existing install
path. The initial buffered prototype regressed and was rejected. Final native
stream navigation is 20.3–22.5% faster in three declared 50 Mbit/s local pairs.
The sealed desktop preview and delivery gates are complete for the declared desktop scope; production has not been promoted.

## Current explanation — 2026-10-09

The developer gate waits for **the whole region's visible structures and physical
surfaces**, rather than only the selected destination. It prevents a jump onto a
roof, road or floor whose Havok collision is not installed yet. Ordinary starting
area play is available while the wider region loads. Installation yields between
bounded batches to preserve input/rendering responsiveness, increasing elapsed
time even when the actual collider calls are short.

The latest prepared wider-region geometry is about **22.4 MB HTTP-Brotli encoded /
158 MB decoded**, in over 1,000 blocks. At decimal 50 Mbit/s, transferring 22.4 MB
alone has a roughly **3.6-second ideal lower bound**, excluding latency, contention,
decoding and installation. This is arithmetic, not a measured CDN prediction.
The implemented native stream observed 5.91–6.07 seconds to safe navigation in
the declared local pairs. Production remains on the independently held older
release; those local timings do not describe the user's current production wait.

An offline follow-on audit found a candidate before destination-specific streaming:
load all physical/visible surfaces and reduced trees before full woodland detail.
It reduces the first candidate packet to 14.4 MB, but increases total transfer
11.7%; no runtime speedup or safety qualification is established.
[Concrete experiment and acceptance gates](region-navigation-core-2026-10-09.md).
Earlier destination-only jumps additionally require qualifying local collision,
terrain and safe exits; the starting-area fence does not protect a remote player.
Neither proposal is implemented or permits unsafe jumps.
The old 18.3-second observation below and its 0.55 seconds of synchronous
collider calls are overlapping wall-clock/CPU measurements, not additive phases.

## Original findings — 2026-10-08

1. **The label covers more than collision.** `dev-tools.js` and `menu.js`
   gate jumping/click teleport on `ASHEN.regionReady`. In `main.js`, that flag
   resolves after `world.startRegion`, nearby/full foliage, texture upgrades,
   townsfolk, town enemies and late scene registration. The temporary physical
   fence already opens when `startRegion` completes. Independent rendering and
   network work can therefore delay developer navigation after routes are solid.
2. **The main delay is the progressive region pipeline.** `world-worker.js`
   calls `buildChurchyard(..., {dataOnly:true})` and `partitionWorld` on every
   visit. It rebuilds the entire region before sending its header/first chunk.
   `world-partition.js` chunks collision at 512 triangles and rendering at
   4,096 triangles. Collision and visible mesh uploads share the same ordered
   worker/main-thread pipeline. Eight transfer credits bound outstanding data.
3. **Small slices trade total load time for responsiveness.**
   `starter-world.js` installs work for roughly 1 ms, then awaits
   `yieldToFrame()`. That gives rendering, input and GPU completion a turn,
   but spreads installation over many animation frames. Frame cadence,
   background scheduling and rendering affect elapsed readiness. CPU install
   time alone cannot explain or predict the full wait.
4. **Grass preparation precedes final box collision.** The worker sends
   `done` only after generating/transferring foliage placements. The main
   loader then installs the remaining box colliders and removes the fence.
   Collision readiness is consequently coupled to unrelated grass generation.

## One bounded native observation

[Raw receipt](../../baselines/region-wait-2026-10-08/receipt.json),
[waiting screen](../../baselines/region-wait-2026-10-08/waiting.jpg) and
[ready screen](../../baselines/region-wait-2026-10-08/ready.jpg).

| Observed phase | Elapsed |
| --- | ---: |
| Existing playable boundary, relative to game boot | 285.2 ms |
| Worker creation → header/first region chunk | 3,733.4 ms |
| Header → last chunk acknowledgement | 12,953.5 ms |
| Last acknowledgement → worker done (includes foliage preparation/delivery) | 788.7 ms |
| Worker done → `startRegion` completion (includes final boxes/fence cleanup/yields) | 94.9 ms |
| `startRegion` completion → full `region-ready` mark | 416.3 ms |
| Full region readiness, relative to game boot | 18,275.4 ms |
| Timed synchronous static-collider installation calls | 544.8 ms |
| Existing geometry install timer, including collision/render packing/uploads | 974.8 ms |

The last two rows overlap and **must not be added** to the phase rows. The
collider wrapper includes temporary gates and any parallel static installs;
it excludes initial player/Havok setup. The worker interval includes imports,
authoring and partitioning; it is not a pure CPU profile. Transfer/install
elapsed time includes scheduling and uploads; GPU execution is not isolated.
The final region has 1,032 transferred chunks, 1,459,479 render triangles and
366,984 collision triangles. The source's 71 allocated world records reserve
211,151,988 bytes in this dev configuration; the current production build's
lazy-allocation flag differs. These are observations, not a memory regression
claim or grounds to change approved geometry.

Conditions: local Vite 5873, system Chromium/WebGPU, headless **with normal
frame pacing**, 1280×720/DPR1, explicit `fastStart`, seven enemies; no throttling
or recording. A fresh browser context followed the harness's bootstrap visit;
HTTP cache remained at its default, Vite/OS/profile caches were uncontrolled.
Developer tools was opened after play became available, so the existing menu
paused simulation while rendering/background work continued. User Edge/Chrome
and unrelated Vite 4000 were preserved. This single instrumented observation
is **not** an isolated cold-start benchmark, a production timing claim, an FPS
measurement or a prediction of the user's device. It demonstrates phase ordering
and the large difference between synchronous installation and wall-clock wait.
No runtime/GPU errors were observed. Havok remained active and grounded with
zero recovery teleports; no new traversal acceptance is claimed.

## Proposed implementation sequence

### 1. Correct the readiness contract and reporting

- Add a separately named collision/navigation-ready promise, flag and startup
  mark. Reach it only after `startRegion` has installed all route collision,
  its corresponding visible geometry and the remaining boxes, removed the
  temporary fence and refreshed world/shadow registration. The diagnostic
  full-world route must establish the equivalent safe boundary.
- Gate dev Jump, click teleport and `?dev&at=…` on that promise instead of
  the entire region's foliage/texture/NPC completion. Keep `ready`,
  `regionReady`, `whenRegion`, first playable and combat meanings intact.
- Keep the actual UI accurate: show navigation readiness and optional details
  loading separately. Do not label an NPC/texture wait as collision loading.
  Attach tools early enough that combat setup cannot become an unintended
  navigation dependency; inspect the existing combat/HUD relationship first.
- Observe rejections immediately and preserve retry, scene disposal and device
  loss guards. A failed/disposed collision pass must never unlock navigation.
- Verify actual menu controls refuse early jumps, enable after collision,
  support named cathedral/link jumps and physical surface clicks while an
  optional texture/foliage response is deliberately delayed, and remain safe
  on collision failure. Check ordinary grounded movement and zero recoveries.

**Expected benefit:** removes unnecessary optional waits; about 416 ms in
this local observation. Network-limited detail loading could add more, but
that benefit has not been measured. This alone will not eliminate the main wait.

### 2. Remove foliage from the collision completion path

- Give the existing worker protocol a distinct geometry-complete event before
  grass generation. Drain every pending geometry chunk before installing final
  boxes and opening the navigation boundary.
- Keep the worker alive for its later foliage result and preserve the existing
  full-region/foliage completion promise. Do not terminate it at the early event
  or resolve complete-region readiness prematurely.
- Verify slow/missing foliage does not block safe navigation, partial/retried
  installation cannot duplicate Havok bodies, and disposal cancels both phases.

**Expected benefit:** removes the observed roughly 789 ms foliage/delivery
dependency. It does not remove generation or geometry-install frame waits.

### 3. Shorten region preparation and prioritize useful routes

- Investigate emitting deterministic full-region chunks at **build time**, using
  the existing `partitionWorld`, starter manifest, native compressed delivery,
  provenance checks and `install()` path. Reuse prepared asset tooling and Lite
  storage buffers rather than adding a second scene/physics implementation.
- Fetch optional region data after the existing playable fence. Measure decoded
  size/network cost before replacing the worker: a large packet can move the
  bottleneck to bandwidth and compete with the first playable assets.
- Group collision with the matching visible walkable/structural geometry and
  prioritize cathedral approach/destinations. Final box collision must arrive
  with the corresponding route. Do not open a destination just because its
  invisible floor exists while walls/railings or render data are absent.
- Preserve bounded frame work. Change budgets only with evidence; removing RAF
  yields or cooking giant Havok meshes synchronously risks the old input freeze.
  The existing `frame-budget.js` explains the rejected scheduler-yield approach.
- Compare equivalent cached and uncached builds with only the intended renderer
  active, then verify >120 FPS and frame tails separately from recording. Preserve
  first playable ≤1 second, exact geometry, route collision and shadow behavior.
- Review live motion, commit/push and publish a sealed desktop preview under the
  existing release procedure. The independent production startup hold remains.

This third slice targets the dominant observed worker/installation wait. The
measurement is not evidence that batching, networking or budget changes will
automatically improve it; each change needs a controlled before/after result.

## Evidence and ownership

Root-owned Chrome **76169** / GPU helper **76175**, CDP **10037**, Vite launcher
**76120** / listener **76144**, URL recorded in the receipt. Its bootstrap page
was blanked before the one diagnostic context. The context closed in `finally`,
and `scripts/harness/down.mjs --slot 7` stopped browser/server; PID audit confirms
all three owned browser/server processes exited. User sessions were left intact.
No source, prepared assets, production or visual design changed in this task.

[Independent Grok 4.6/high source review](../../baselines/region-wait-2026-10-08/source-review.md)
confirms the readiness/worker/foliage ordering. Root corrected its render-picking
assumption: current click teleport uses Havok, so matching visible geometry is
a navigation/readability requirement rather than a render-mesh pickability gate.
The reviewer ran no browser and is finished; timing interpretation above belongs
to the parent and the recorded native observation.
