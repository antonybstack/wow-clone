# Native inline startup launcher trial — 2026-10-07

**Removed; no public cohort.** A bounded Vite/Rolldown helper places the existing
39-byte generated async ESM launcher in the HTML, using Vite's native AST parser
to resolve its sealed shared-module import. It preserves catalogue-before-execution,
validation, fetch promises, assets and every readiness gate. It is default-off
and refuses unexpected code/dependencies. Prototype sources/builds remain in cache.

Syntax, both builds and 31 focused checks pass. Six native lifecycle/default/maximum
controls, required helper abort and all three entry aliases pass. Root reviewed
actual default/maximum first-play captures without a persistent T-pose. Independent
Grok review finds no consequential defect, while explicitly leaving WebKit/phone
and runtime execution outside its read-only review. No new motion acceptance is claimed.

Twelve visits were declared before running, with three alternating pairs per outfit.
M1 Max, native Chromium WebGPU, 1280×720/DPR1, fresh process/profile, decimal
50 Mbit/s down/10 up/40 ms; initially empty cache with native preload reuse,
uncontrolled OS/driver caches, no tracing/forced shader-cache policy.

| Outfit | Pair | External | Inline | Change |
| --- | ---: | ---: | ---: | ---: |
| Default | 1 | 535.9 ms | 535.9 ms | 0.0 ms |
| Default | 2 | 536.4 ms | 532.7 ms | −3.7 ms |
| Default | 3 | 531.3 ms | 535.4 ms | +4.1 ms |
| Maximum | 1 | 776.9 ms | 769.5 ms | −7.4 ms |
| Maximum | 2 | 778.0 ms | 772.6 ms | −5.4 ms |
| Maximum | 3 | 780.4 ms | 776.3 ms | −4.1 ms |

All twelve actual identity/gear/physics/completed-GPU/input checks pass with zero
recorded errors. Both local delivery checks pass. In maximum pair 1, body discovery
advances **197.5 → 97.4 ms**, but transfer completion advances only **658.4 → 650.3 ms**.
Starting a request earlier does not establish a comparable improvement in completion
when other transfers overlap. The measured gain is too small to justify a new
production build path/public qualification cohort alone. Remove the prototype;
retain the evidence and do not repeat it until a material new byte/path change exists.

The next investigation is supported by code/data, not a promised gain: the world
preallocates **210,049,236 bytes** for 71 world meshes before play, while the required
packet fills only five of them (their full allocations total 16,259,292 bytes).
Use the existing native storage-mesh APIs to test delaying untouched allocations
until their first real block. Preserve exact final geometry, collision, woodland
visibility/hysteresis, shadow registration and disposal; measure rather than assume
that allocation size is CPU/GPU execution time.

[Tracked receipt](../../../baselines/character-mmo/startup-inline-facade-2026-10-07/receipt.json).
Raw `.cache/character-mmo/startup-inline-facade-2026-10-07/` retains code, builds,
commands, samples, captures and independent verdict. Native Chrome30284/GPU30290,
CDP10037/preview30283:7074 and timing previews39969:7074/39977:7075 are closed;
per-probe PIDs remain in ownership files. Final audit finds no owned renderer.
Edge12 user tabs contain no game; Orca0 tabs. Temporary media guard is removed
and prior Telegram/Shadowglass/X/X-other playback restored (3/1/1/0). CLI review
exhausted eight turns before a verdict; a bounded finish produced the review.
Native/timing runners each exited0 without repetition. Production is unchanged.

References: [async module execution](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/script#async),
[Vite HTML/plugin hooks](https://vite.dev/guide/api-plugin.html#transformindexhtml),
[native storage meshes](https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/packages/babylon-lite/src/mesh/mesh-from-storage.ts).
