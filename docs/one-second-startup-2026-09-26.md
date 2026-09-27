# One-second playable startup — implementation log (2026-09-26)

Implements [the investigation and plan](one-second-startup-investigation-2026-09-26.md) from
baseline `e60d64f`. Target: a visible, dressed, grounded, input-responsive character within one
second of navigating to the root URL, with the rest of the region arriving in the background.

One second is **unproven** until repeated fresh-profile measurements and reviewed live motion
establish it. Every number below is a measurement with its conditions attached, not a claim that
the target is met.

## P0 — measure actual playable readiness (this section is complete)

### What "ready" used to mean, and why it could not be measured

`ASHEN.ready` meant *all of it*: world, player, body, combat, hostiles, equipment, armory. There
was no name for the moment a player can walk, so the startup target had nothing to attach to. The
startup marks were also gated behind `?startupMarks`, and so was the completed-GPU fence — an
ordinary navigation had no completed-frame boundary at all, and a probe that forgot the flag got
plausible coarse numbers with no indication anything was missing.

Changes:

- **`src/ashen-reach/startup-trace.js`** (new) records marks unconditionally, keeps them in
  record order, and returns `null` rather than `0` for a missing span.
- **Three readiness boundaries** on `ASHEN`, as promises and flags:
  `whenPlayable`/`playableReady`, `whenCombat`/`combatReady`, `whenRegion`/`regionReady`, plus
  `whenFirstGpuFrame`. `ready` and `hostilesReady` keep their existing "all of it" meaning, so
  every existing suite still asserts on exactly what it asserted before.
- **Fine-grained marks** inside `buildChurchyard` (nine phases), around the GPU compatibility
  probe, and inside the Havok bring-up (runtime, world, colliders, controller). Marks are only
  ever added, never renamed: `measure-startup.mjs`, `probe-uncached-startup.mjs` and the
  committed baselines in `docs/baselines/` all read them by name.

### Where the time actually goes

M1 Max / Chromium 153 WebGPU / 1280×720 / dev server / fourth warm reload / `pixelRatio=1`.
Warm reloads, so this is CPU/GPU cost with the network mostly out of the picture — the point is
the shape of the critical path, not an absolute figure.

| at (ms) | phase cost | mark |
|---:|---:|---|
| 129 | 129 | `begin` |
| 139 | 11 | `havok-runtime-available` |
| 146 | 7 | `engine-created`, `gpu-probe-end` |
| 335 | 176 | `world-terrain-end` (2 m earth grid, 0.5 m in the lamp corridor) |
| 393 | 58 | `world-churchyard-end` (46 tombs, trees, lych gate) |
| 413 | 20 | `world-town-end` (gate, 13 buildings, cobbles) |
| **2271** | **1858** | `world-far-end` (far earth + physical mountain terrain) |
| 2281 | 9 | `world-woodland-end` |
| 2407 | 126 | `world-scatter-end` (565 trees, 170 rocks, horizon materials) |
| 2550 | 143 | `world-region-end` (region structures, region world, cathedral) |
| **3378** | **829** | `world-commit-end` (GPU mesh commits) |
| 3393 | 15 | `world-effects-end` (shafts, motes, sky) |
| 3394 | 0 | `havok-runtime-start` → `havok-world-end` (runtime already compiled) |
| **4306** | **912** | `havok-colliders-end` (6 mesh + 678 box colliders) |
| 4338 | 31 | `body-end` (character decode; bytes already fetched) |
| 4362 | 24 | `register-end`, `first-render-return` |
| 5275 | 914 | `first-gpu-completed` (**see the correction below — this is not the frame's cost**) |
| 5426 | 151 | `combat-ready`, `late-register-end`, `hostiles-ready` |
| 5791 | 365 | `ready` = `playable` |

Nothing expensive is in the starting area: the churchyard the player actually stands in costs
58 ms, against **far terrain 1,858 ms**, **static colliders 912 ms** and **mesh commits 829 ms**.
That is the measurement justifying the plan's architecture — everything costly is content the
player cannot reach in the first second.

#### Correction: `first-gpu-completed` is not the first frame's cost

This log first reported the 914 ms between `first-render-return` and `first-gpu-completed` as a
fourth large cost, "the first frame actually finished". **That was wrong**, and it would have sent
the next phase after the wrong bottleneck.

`waitForGpuIdle`'s promise can only settle when the main thread is free to run the continuation,
and `main()` starts foliage plus seven dynamic imports on the line after `renderLoop.start()`
returns. A long-task observer over that exact window shows **886 of the 933 ms is main-thread long
task**, not a GPU wait. Awaiting the fence before any of that follow-on work puts the real number
at **79 ms** for the reduced world and **165 ms** for the full one.

So the mark measures "the GPU is idle *and* the main thread got around to noticing", which is a
useful boundary for "the page is responsive" and a misleading one for "the frame cost this much".
It is kept, under that reading. The corrected picture of what sits between the first frame and a
playable character is **feature loading**, roughly 1.2 s of foliage, dynamic imports, dummy, NPC
buffer, enemies, combat, late feature registration, townsfolk, equipment and armory — all of it
ahead of `setInputEnabled(true)`, and almost none of it needed to walk.

### Delays removed in P0

- **Havok's WASM now downloads during boot** instead of inside `setupPlayer`. `loadHavok()` in
  `src/player.js` memoises the factory; `main()` starts it beside the body GLB fetch and hands
  the promise to `setupPlayer` via `options.havok`. On the warm dev server the runtime is ready
  at 139 ms and `setupPlayer`'s own wait is 0 ms. `check-startup-entry.mjs` asserts exactly one
  `HavokPhysics.wasm` request per navigation, because a broken memoisation is invisible on a warm
  cache and costs a second 650 KB download on a cold one.
- **The root URL serves the game.** `/` used to meta-refresh and then `location.replace` to
  `/ashen-reach.html?play&clean`, a documented 181–247 ms hop whose only job was to name another
  document. Vite now rewrites `/` to the game page in dev, and the build copies the built
  `ashen-reach.html` over `dist/index.html`, so `/` is a real static file on Pages. `main()`
  reproduces the stub's exact rule: a root URL with no query gets `?play&clean`, a root URL with
  a query is taken at its word. `/ashen-reach.html` is unchanged.
- **The loader fade is off the input-critical path.** `finishLoading()` used to await the whole
  350 ms CSS exit transition before the caller enabled input. It now hands back control at the
  start of the fade — `#loading.leaving` is already `pointer-events:none`, so the only thing left
  holding input was our own capture-phase key blocker — and removes the overlay on `transitionend`
  with a timer fallback. The overlay is still visibly dissolving for up to 350 ms after
  `playable`, over live interactive frames.

### New probes

- **`scripts/ashen-reach/measure-input-response.mjs`** never reads a readiness flag. It holds a
  real key (and separately drags the on-screen stick under `?touch=1`), samples the player's world
  position once per animation frame, and reports the first frame in which the player has actually
  travelled, using the scene's own `onBeforeRender` frame counter so displacement without a
  rendered frame is detectable. It also records the largest single-frame hop and the delta in
  Havok's `recoveries` counter, so a recovery teleport or a coordinate clamp cannot hide.
- **`scripts/ashen-reach/check-startup-entry.mjs`** asserts the root URL, a root URL with a query,
  and the direct game URL each reach a physics-driven playable state in exactly one main-frame
  navigation with exactly one Havok WASM request.

### P0 gate

| gate | result |
|---|---|
| current full-ready assertions unchanged | `measure-startup.mjs` × 4 runs: 7 enemies, `usingPhysics`, 1280×720, no loader/error/GPU/console errors |
| root and direct URLs work | `check-startup-entry.mjs`: 3/3 entry points, 1 navigation each, `camera:play` and `clean` implied at bare `/` |
| no duplicate full Havok fetch | 1 `HavokPhysics.wasm` request on every entry point |
| timing probe measures actual input response | keyboard: first travel at **49 ms**, 5 rendered frames, 8.39 m in 1.2 s; touch stick: **84 ms**, 5 frames, 8.57 m; 0 recoveries, worst single-frame hop 0.31 m |
| suites | `test:character` 77/77, `test:equipment` 47/47, `ASHEN_PAGES=1 vite build` clean, `dist/index.html` byte-identical to `dist/ashen-reach.html` |

Playable readiness is **unchanged** by P0 on a warm dev server: 5,791 ms before, 5,730/5,481/5,472 ms
across the probe navigations after. That is expected — P0 removed the redirect hop and the fade
from the *input* path and moved the Havok fetch off the critical path, none of which shortens the
3.4 s world build or the 912 ms collider install that dominate the number. Those are P1–P4.

## Feasibility probe — is one second reachable at all?

Before building a build-time asset stage, a throwaway patch skipped the far-terrain and scatter
loops behind a `?slice` flag to price the rest of the path. Reverted after measuring; same
machine and dev server as above.

| | full world | `?slice` |
|---|---:|---:|
| world build | 3,234 ms | **730 ms** |
| mesh commits | 840 ms | 225 ms |
| static colliders | 975 ms | 206 ms |
| scene registration | 32 ms | 29 ms |
| first frame (fence awaited before follow-on work) | 165 ms | **79 ms** |
| triangles | 941,975 | 188,041 |
| **playable** | 5,834 ms | **2,549 ms** |

Two conclusions:

1. **The world build scales with content, and the starting area is a small fraction of it.** A
   tighter starting neighbourhood than `?slice`'s (which still built the full 2 m near grid over
   360 × 240 m, the region structures and the cathedral) should land well under 730 ms.
2. **After the first frame there is ~1.2 s of feature loading before input is enabled**, and it is
   the same 1.2 s whether the world has 188 k or 942 k triangles. Combat, enemies, townsfolk,
   armory, the training dummy, the NPC buffer and foliage are all ahead of `setInputEnabled(true)`
   and none of them is needed to walk. Starter equipment *is* needed — "dressed" is part of
   playable — and it currently loads after combat because it takes `combat.fx.sockets`.

Adding up what must remain ahead of a first playable frame — module load, engine, a tight starting
area, near colliders, the body, scene registration, the first frame and starter garments — one
second is plausible but not comfortable. The next phase is therefore ordering, not baking: build
the starting area first, install only near collision, dress the character, enable input, and move
everything else behind that boundary. Whether a build-time baked starting-area package is also
needed is a question to re-ask once that ordering exists, because it only competes with the
remaining starting-area CPU cost.

## M1 — playable-first ordering

The feasibility probe said the ~1.2 s between the first frame and input being enabled was
feature loading, not world building. This phase moves that work behind the boundary.

- **Sockets are created with the body, not with combat.** `attachSockets` needs the player
  capsule and the body's skeleton and nothing else, so `main()` creates the one socket host
  right after `attachBody` and hands it to both the equipment stream and, later, the spell
  VFX (`createFireBlastVfx` takes an optional `sockets`). Two hosts on one skeleton would
  each bake and drive the same bones.
- **Starter garments load before the boundary**, because a dressed character is in the
  acceptance criteria. Everything else — foliage, the seven feature modules, the training
  dummy, the NPC buffer, churchyard and town hostiles, combat, late feature registration,
  townsfolk and the armory — moves into `ASHEN.whenRest`, which runs while the player walks.
- **`ready` and `hostilesReady` keep meaning "all of it"** and are set at the end of that
  background chain, so the existing suites assert on exactly what they asserted before.

### Background work must yield to *frames*, not to tasks

Moving the work behind the boundary made it worse before it made it better: input went live
and then froze for 1,053 ms. One uncut foliage pass held the main thread for 899 ms starting
43 ms after `playable`.

The first fix was `scheduler.yield()`, the standard advice for
[breaking up long tasks](https://web.dev/articles/optimize-long-tasks). It worked, by the
metric: **zero long tasks after `playable`**. The game still did not render —
`ASHEN.gpu.frames` sat at **4** for 920 ms. Four is `createFrameScheduler`'s `maxPending`.
Its completion fence resolves on a queued task, and a build that resumes via
`scheduler.yield()` runs ahead of that queue, so the fences never settled, the scheduler
stayed at its ceiling and stopped issuing frames. A long-task profile said everything was
fine while the player looked at a still image.

`src/ashen-reach/frame-budget.js` therefore yields to an animation frame. The render loop
registers its callback first, so the resumed build knows a frame was drawn and its fence had
a turn. The slice is a **share of the frame** (25%, clamped to 2–8 ms) rather than an
absolute budget: an absolute 120 FPS ceiling was tried first and proved untestable, because
headless Chromium runs frames near 14 ms and pinned the slice at its floor forever.

### One real bug this exposed

Yielding inside `createFoliage` let a frame render between `commitProto` (mesh in the scene,
vertex layout declaring `world0..world3`) and `makePool` (thin-instance buffers attached).
Pipeline creation fails outright in that gap — `struct member world0 not found`, then an
invalid render bundle for the rest of the frame. Hiding the meshes does not help; the
pipeline is built from the registered mesh regardless of visibility. The fix is to commit the
prototypes in the same uninterrupted task as the pools that buffer them. `measure-startup.mjs`
caught this through its GPU-error assertion; nothing else did.

### M1 results

M1 Max / Chromium 153 WebGPU / 1280×720 / dev server / `pixelRatio=1`.

| | before M1 | after M1 |
|---|---:|---:|
| playable | 5,791 ms | **4,441–4,568 ms** |
| combat ready | at `playable` | playable + 400 ms |
| hostiles ready | at `playable` | playable + 582 ms |
| foliage complete | at `playable` | playable + 3,100 ms |
| full `ready` | 5,791 ms | 7,624–7,859 ms |
| keyboard first travel | 49 ms / 5 frames | 111 ms / 14 frames |
| touch first travel | 84 ms / 5 frames | 128 ms / 26 frames |
| long tasks after `playable` | — | none |
| recovery teleports | 0 | 0 |

Checks: `check-shader-errors.mjs` clean, `check-startup-entry.mjs` 3/3, `measure-startup.mjs`
2 runs with 7 enemies and no GPU or console errors, `test:character` 77/77,
`test:equipment` 47/47.

### Disclosed defects carried into the next phase

1. **The starting area is bare ground for about three seconds while the player runs through
   it.** Foliage builds in seed order over the whole region rather than nearest-first, so the
   grass arrives everywhere at once at roughly `playable` + 3.1 s instead of under the player
   first. Visible in the delivered clip. The plan's P4 ordering — adjacent traversable
   surfaces first — is the fix.
2. **Full `ready` regressed from 5.7 s to 7.7 s.** Deliberate: foliage is now sliced to a
   quarter of a frame so it cannot freeze input, and `ready` still waits for it. Nothing a
   player waits on, but it is a number this repo has tracked and it moved the wrong way.
3. **The world build is untouched.** 3.3 s of `buildChurchyard`, of which far terrain is 1.9 s,
   still runs before the first frame. That is the whole remaining gap to one second.

## Remaining phases

P1 build-time starting-area package · P2 compact dressed starter character · P3 minimal playable
prototype with a ≤1,000 ms stop/go gate · P4 bounded background region loading · P5 validation,
release and reviewed live motion.
