# Starting-world/Havok scheduling trial — 2026-10-07

**Rejected and removed.** Moving the opt-in world frame before awaiting Havok
regresses every one of six local pairs. The checkout's `main.js` is restored
exactly to 865cf7d (SHA `1de3121f7751377734fba5824b9a7ca537b3e5240cc2fb32f9ee49deb3265078`).
No public cohort or production change follows this result. Existing world
preparation and early helper discovery remain default-off.

## Implementation and native controls

The prototype submits the existing Lite starting-world/post/shadow frame before
calling `setupPlayer`, then awaits the existing Havok load/collision/controller
and body promises. Its preparatory fence, native PBR skin/morph rescan, later
registration and dressed/grounded/completed-GPU/input boundary remain intact.
It adds scene-lifetime guards around the required physics wait. No asset, shader,
quality setting, animation sample or readiness gate is changed.

Prototype main SHA `7cf52f32a7ef912bb9035eefc008f07b52fa6287c6a5734e20f7e5dd9d3ddf31`;
helper/vite unchanged. Syntax, 20 relevant checks and flag-1/flag-0 plain Vite
builds pass. All eleven native controls pass:

- Held body/release, HTTP-200 corrupt gzip, scene disposal and asynchronous
  device loss retain the opaque/inert loading state and refuse late play/retry.
- Normal default and maximum saved outfits reach the full region and walk with
  Havok, correct skins/gear and no unexpected runtime/GPU errors or recoveries.
- Three new controls hold the **actual Havok WASM response and body**. World
  submission precedes physics setup. Releasing only the body keeps play blocked;
  releasing physics permits grounded dressed movement (5.24 m). Disposal or
  device loss during that pending physics wait prevents controller/body/play
  continuation after both responses are released. The stopped scheduler refuses
  restart.
- Required helper import abort reports its original native cause, with no retry;
  flag 0 makes no helper request and retains normal grounded movement.

Root reviewed actual first-play/default/maximum/Havok-held-release captures.
The reviewed stills show dressed arms-down idle and a running pose, without the
old persistent T-pose. This hidden scheduling experiment makes no new art or
live-motion acceptance claim; no new MP4/Telegram delivery is attributed to it.

## Declared comparison

Twelve visits declared before execution: three alternating pairs per outfit,
orders BEFORE/OVERLAP, OVERLAP/BEFORE, BEFORE/OVERLAP. BEFORE is the immutable
865cf7d early-import build; OVERLAP is the frozen prototype. Both local builds
pass 349/349 delivery checks. Every visit passes actual selected-identity,
equipment, Havok support, completed GPU frame, canvas, input and error checks.

M1 Max, native Chromium WebGPU, **1280×720/DPR1**, fresh process/profile, decimal
50 Mbit/s down / 10 up / 40 ms. Initially empty HTTP cache with native preload
reuse; no tracing or forced shader-cache policy; OS/driver caches uncontrolled.
Local conditions do not replace the cache-disabled public qualification policy.

| Outfit | Pair | Before | Prototype | Regression |
| --- | ---: | ---: | ---: | ---: |
| Default | 1 | 535.1 ms | 558.1 ms | 23.0 ms |
| Default | 2 | 533.4 ms | 550.5 ms | 17.1 ms |
| Default | 3 | 536.9 ms | 552.2 ms | 15.3 ms |
| Maximum | 1 | 778.0 ms | 796.1 ms | 18.1 ms |
| Maximum | 2 | 781.7 ms | 797.0 ms | 15.3 ms |
| Maximum | 3 | 780.2 ms | 795.6 ms | 15.4 ms |

Default median rises **535.1 → 552.2 ms**; maximum **780.2 → 796.1 ms**.
The preparatory submission advances roughly 10–19 ms, and its completion is
already before dressed registration in both variants. Physics setup is delayed
by the new ordering. Maximum's registration-end → first-render-return window
grows from 4.2–4.6 ms to 17.2–17.6 ms; default grows from 4.1–4.2 to 11.9–12.1 ms.
These navigation-relative callback windows do not isolate GPU execution or prove
shader-compilation cost. Three pairs are sufficient to reject this candidate;
they do not establish a causal timing model for every public tail.

Next bounded path: preserve native avatar/physics initialization ordering while
allowing a still-pending Havok promise and world preparation to overlap. Start
and immediately observe the original physics promise, then await it before body
attachment. Do not repeat this sequential pre-Havok prototype or publish from
the current unfavorable result. Use retained document/fence tails to decide
whether a further change merits measurement, with all original exit gates intact.

Native references: [engine submission/fence](https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/packages/babylon-lite/src/engine/engine.ts),
[scene registration](https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/packages/babylon-lite/src/scene/scene-core.ts),
[physics](https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/docs/lite/architecture/42-physics.md).

## Evidence and ownership

[Tracked receipt](../../../baselines/character-mmo/startup-prime-overlap-2026-10-07/receipt.json)
retains source hashes, command exits, native controls and all twelve samples.
Raw scripts/builds/reports/captures:
`.cache/character-mmo/startup-prime-overlap-2026-10-07/`.

Native owner: Grok, browser **52934**, GPU **52960**, CDP **10037**, preview
**52933** then flag-0 **54431**, port **7074**. Timing previews **61184:7074** and
**61221:7075**; individual fresh browser/GPU PIDs are in each probe ownership
receipt. All are closed; final process/listener audit is empty. Orca inventory
contains zero tabs. Edge's twelve user tabs contain no game. User Edge2931 and
Orca98938 are preserved.

Temporary Telegram/Shadowglass/X media guard is removed, with prior connected
playback restored (3/1/1/0 playing). The Shadowglass YouTube player was paused.
Timing contains one sequential game renderer and excludes recording, encoding
and builds. Grok CLI caps can end after the prepared commands have finished;
acceptance here uses actual script exits and retained artifacts, not CLI prose.
