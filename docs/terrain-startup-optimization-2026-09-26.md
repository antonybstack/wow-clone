# Terrain startup optimization — 2026-09-26

The first implementation from [the rendering investigation](rendering-performance-investigation-2026-09-26.md) reuses each sampled outer-terrain corner across adjacent grid cells. The two-row cache exists only while `buildChurchyard` creates the mesh. It retains the original height, normal, UV, color, material selection, collision, and mesh packing functions. Legacy terrain height is evaluated lazily where the mountain classification uses it. Startup marks are available with `?startupMarks` for repeatable stage measurements; they use Babylon Lite's public [`waitForGpuIdle` API](https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/packages/babylon-lite/src/index.ts) for a completed-GPU boundary.

## Paired local measurements

Apple M1 Max, Chromium 153 WebGPU, 1280×720 actual canvas, seven enemies, Havok active. Baseline was source `c250197`; candidate was that commit plus the terrain and instrumentation diff. Vite served both. Four serial startup navigations per variant used a new browser context for the first run and the same context with HTTP cache allowed for three reloads. Browser process, operating-system, and driver caches were not reset. These are local measurements, not a production cold-load or physical iPhone claim.

| Startup metric | Baseline warm median | Candidate warm median | Change |
| --- | ---: | ---: | ---: |
| Playable ready | 10,477.8 ms | 5,739.3 ms | −45.2% |
| World construction | 7,898.0 ms | 3,193.7 ms | −59.6% |
| First completed GPU queue | 9,883.9 ms | 5,162.6 ms | −47.8% |
| Worst startup long task | 6,734 ms | 2,085 ms | −69.0% |

First new-context ready was 11,450.5 → 6,305.7 ms. The measurement script records stage marks, navigation/network data, long tasks, dimensions, enemies, physics state, and console/GPU errors in the [baseline](baselines/terrain-startup-2026-09-26/startup-baseline.json) and [candidate](baselines/terrain-startup-2026-09-26/startup-candidate.json) reports. An initial baseline probe had the default 960×540 internal canvas and was rejected before this four-run series; both reports use `pixelRatio=1` and assert 1280×720.

Separate uncapped 12-second movement runs, three per route, with no recording:

| Route | Baseline FPS | Candidate FPS | Worst per-run p99, baseline → candidate | Candidate frames >16.67 ms |
| --- | ---: | ---: | ---: | ---: |
| Town | 179.35 | 178.24 | 12.2 → 12.8 ms | 0 |
| Bridge | 219.00 | 220.03 | 10.6 → 10.6 ms | 0 |
| Cathedral | 225.52 | 226.12 | 10.1 → 9.9 ms | 0 |
| Forest | 191.35 | 191.42 | 6.6 → 6.6 ms | 0 |

All 12 candidate runs exceeded 120 FPS, moved with Havok, and had no recovery teleport, runtime error, or GPU error. The baseline bridge had three intervals over 16.67 ms in its first run, worst 39 ms; the candidate had none. The small throughput differences should not be attributed to the optimization because browser/GPU work was not fully isolated. A development candidate pass was interrupted by Vite reload after a source edit and excluded; the complete final candidate series was rerun. [Raw aggregate reports](baselines/terrain-startup-2026-09-26/) retain frame tails and conditions.

The `Far earth` and `Physical mountain terrain` meshes had exactly matching SHA-256 digests and lengths for their CPU position, normal, UV, and index buffers before and after. The full grid test also compared height, normal, and mountain classification. CPU color buffers are not retained after upload, so exact color-buffer hashes are unavailable; the unchanged color calculation receives the same inputs. Live screenshots and motion remain the visual acceptance evidence.

## Follow-up decision

A fresh [candidate CPU profile](baselines/terrain-startup-2026-09-26/candidate-profile-summary.json) after P1 sampled 5,448 stacks (1 ms interval). Its largest JavaScript self-time groups were `bakeLamp` 757 ms, `applyRegionRoutes` 478 ms, `regionalRidgeCrest` 450 ms, and `legacyHeight` 405 ms. The single profiled ready time was 6,474 ms; profiler overhead and cache state make it unsuitable as a paired load comparison. The terrain normal work has stopped dominating startup. Central-difference offsets are mostly distinct coordinates, so a sample cache would need a separate duplication count and exact-output experiment before adoption. Lamp baking is now the clearest next candidate, but any pass must preserve the existing windowed-light profile and demonstrate that repeated vertex work is actually avoidable. The profile is evidence for a bounded next experiment, not a reason to extend this release with an unmeasured refactor.

Shadow caching stays disabled: the earlier isolated CSM experiment reduced moving-route throughput by 4.1–5.1%, and the fixed sun provides no drift updates to distribute. Async ShaderMaterial compilation stays disabled after eight previous load trials showed no readiness gain. The independent camera invalidation question and async first-use trial remain conditional research, not release dependencies for this measured terrain improvement.

## Verification and release

The focused terrain, regional world, composition, and cathedral suites passed, as did `npm run build`. Local live keyboard traversal entered and returned from all eight registered destinations with active Havok, zero recovery teleports, and no runtime/GPU errors. Mobile viewport/touch input with injected depth-bundle failure passed the fallback path, and desktop WebKit passed keyboard movement. Cathedral bridge-to-nave-and-return motion captured 4,103 frames over 43.085 seconds at 1280×720 with an invariant capture manifest; sampled bridge, facade, and portal frames were reviewed in the real renderer. Production verification and delivery are recorded after release.
