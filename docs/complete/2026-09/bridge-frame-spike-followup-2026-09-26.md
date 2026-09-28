Historical scoped report: this records the pass described below, including its stated limitations. It is not an active task queue. See [current state](../../CURRENT.md) and [the new roadmap](../../plans/character-mmo/vision-roadmap.md).

# Bridge frame interval follow-up — 2026-09-26

The 22.1 ms bridge sample from the Babylon Lite review follow-up is **not a repeatable bridge stall in the available evidence**. No rendering or world code was changed for this sample.

## Comparable measurements

All sets used an M1 Max, uncapped Chromium 153 WebGPU, a 1280×720 canvas, seven enemies, Havok movement, three unrecorded 12-second walks per route, and the same `scripts/ashen-reach/measure-region.mjs` probe. The measurements are render-loop callback intervals, not isolated CPU or GPU task times. Raw reports for the first and repeat runs, plus all 7,992 bridge frame intervals from the repeat, are preserved in [the baseline directory](../../baselines/lite-1.31.1-bridge-spike-2026-09-26).

| Set | Bridge mean FPS | Highest bridge p99 | Worst bridge interval | Intervals over 16.67 ms |
| --- | ---: | ---: | ---: | ---: |
| F1–F7 release candidate | 218.88 | 10.4 ms | 16.9 ms | 1 in 3 runs |
| Review follow-up release | 220.83 | 10.5 ms | 22.1 ms | 1 in 3 runs |
| Fresh isolated repeat, same code | 221.85 | 10.4 ms | 11.3 ms | **0 in 3 runs** |

The 22.1 ms interval appeared 7.265 seconds into bridge run 3 without a p99 increase. The older 16.9 ms interval appeared at 9.927 seconds in a different run, so the two samples do not point to one fixed route transition. In the repeat, the three bridge runs had 2,681, 2,655, and 2,656 intervals; their maxima were 11.0, 11.3, and 11.2 ms. All 12 repeat route runs were uncapped, exceeded 120 FPS, kept Havok active with zero recoveries, and reported no runtime or GPU errors. Repeat town / cathedral / forest means were 180.81 / 228.00 / 192.30 FPS.

The single 22.1 ms interval could reflect browser scheduling, garbage collection, GPU queue waiting, or other host work. This probe cannot distinguish those causes. A targeted code change would be speculative without a recurring hitch or a trace that assigns the time to a game task. If bridge hitches become visible or repeat samples cluster above 16.67 ms, capture a Chrome performance/GPU trace around the affected frames and fix the attributed work.

The user reports the game works on a physical **iPhone 14 Pro Max at approximately 60 FPS**. This is a device observation, not an instrumented frame-time trace; it does not validate the M1 Max interval tail directly.
