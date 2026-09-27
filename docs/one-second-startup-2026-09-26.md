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
| **5275** | **914** | `first-gpu-completed` (first frame actually finished) |
| 5426 | 151 | `combat-ready`, `late-register-end`, `hostiles-ready` |
| 5791 | 365 | `ready` = `playable` |

Four costs account for 4.5 of the 5.8 seconds, and none of them is the starting area:
**far terrain 1,858 ms**, **first GPU frame 914 ms**, **static colliders 912 ms**, **mesh commits
829 ms**. The churchyard the player actually stands in costs 58 ms. This is the measurement that
justifies the plan's architecture: the starting area is nearly free, and everything expensive is
content the player cannot reach in the first second.

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

## Remaining phases

P1 build-time starting-area package · P2 compact dressed starter character · P3 minimal playable
prototype with a ≤1,000 ms stop/go gate · P4 bounded background region loading · P5 validation,
release and reviewed live motion.
