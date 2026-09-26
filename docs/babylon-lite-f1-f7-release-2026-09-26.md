# Babylon Lite 1.31.1 follow-up release — 2026-09-26

The F1–F7 follow-ups are deployed to `https://play.sparkify.dev` as Cloudflare Pages deployment `ec4176ce-5f5a-43d4-a0a4-7f350c46b9b4`, sourced from pushed `52700a09bbf78723168b04f4efcc1506ac71111a`. The preceding successful production deployment for rollback is `b0812424-5963-4a70-94fb-13f6f1e23bde` (M4). The deployed game bundle is `ashenReach-Cb6x_hI8.js`; 347 checked Pages files match the staged release, including the bundle, terrain/woodland assets, textures and Havok WASM with its MIME type. Exact-bundle production smoke loaded seven enemies, active Havok and shadows, moved 14.06 m under keyboard input and reported no runtime, request or GPU error.

The migration follow-ups were completed sequentially:

| Checkpoint | Commit | Result |
| --- | --- | --- |
| [F1 device-loss recovery](babylon-lite-f1-device-loss-2026-09-26.md) | `423851e` | Visible reload dialog and scheduler/input stop on live device loss; reviewed motion. |
| [F2a lazy errors](babylon-lite-f2a-error-decoding-2026-09-26.md) | `6065f9d` | Lazy Lite error decoding and cause-preserving fallback; startup gzip saving measured. |
| [F2b HUD projection](babylon-lite-f2b-hud-projection-2026-09-26.md) | `a09e087` | Native world-to-screen projection, landscape/portrait live checks and reviewed motion. |
| [F3 chest-hit assets](babylon-lite-f3-chest-hit-inventory-2026-09-26.md) | `2a4ab2e` | Authored offline translation removal for Human, Orc and Undead; all-race live movement and hit review. |
| [F4 Orc colors](orc-vertex-color-cleanup-2026-09-26.md) | `689ee75` | Removed only redundant opaque white vertex colors; live outfits, movement and shadows; Telegram 776. |
| [F5 shadow bridge](babylon-lite-f5-shadow-trials-2026-09-26.md) | `b8ec23e` | Public enable/disable toggle adopted; native caster-retirement trial failed live and guarded bridge retained; Telegram 777. |
| [F6 late spell registration](babylon-lite-f6-late-features-2026-09-26.md) | `b3c05e5` | Public unregister/register lifecycle restores first-use Pyre layers and later Fire/Lava; Telegram 778. |
| [F7 sampled targets](babylon-lite-f7-render-target-facades-2026-09-26.md) | `52700a0` | Task-owned scene/contact targets expose resize-aware color/depth facades; contact/fog/HDR/mobile/WebKit; Telegram 779. |

The final local gate passed 77 character, 47 equipment and 15 focused migration tests, plus the production build. Performance was measured separately from recording on Apple M1 Max, uncapped Chromium 153 WebGPU, actual 1280×720 canvas, seven enemies, active Havok and three 12-second runs per route. Mean FPS: town **179.43**, bridge **218.88**, cathedral **225.53**, forest **191.68**. Every run exceeded 120 FPS and used normal movement with no recovery teleport or runtime/GPU error. The worst p99 across the three runs per route was **12.1 / 10.4 / 10.1 / 11.7 ms**, respectively. The worst frame was **12.8 / 16.9 / 15.1 / 12.2 ms**; one bridge frame exceeded 16.67 ms. Compared with the M4 1.31.1 route means of 179.86 / 219.48 / 226.25 / 191.62 FPS, the follow-up candidate is within 0.72 FPS on every route. Raw frame intervals and reports are in ignored `ve-capture/ashen-reach/lite1311/final-performance/`.

| Route | Run | FPS | Median ms | p95 ms | p99 ms | Worst ms | >8.33 ms | >16.67 ms |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Town | 1 | 180.27 | 4.20 | 11.20 | 12.10 | 12.80 | 541 | 0 |
| Town | 2 | 179.17 | 5.70 | 10.70 | 11.80 | 12.60 | 137 | 0 |
| Town | 3 | 178.85 | 5.80 | 6.30 | 7.10 | 7.50 | 0 | 0 |
| Bridge | 1 | 220.93 | 4.30 | 5.70 | 5.90 | 9.10 | 1 | 0 |
| Bridge | 2 | 216.98 | 4.30 | 5.80 | 8.30 | 16.90 | 26 | 1 |
| Bridge | 3 | 218.73 | 4.10 | 9.80 | 10.40 | 11.30 | 330 | 0 |
| Cathedral | 1 | 225.03 | 3.00 | 9.60 | 10.10 | 15.10 | 525 | 0 |
| Cathedral | 2 | 225.99 | 3.70 | 9.50 | 10.00 | 13.20 | 396 | 0 |
| Cathedral | 3 | 225.57 | 4.20 | 5.50 | 5.70 | 6.10 | 0 | 0 |
| Forest | 1 | 191.58 | 4.60 | 11.00 | 11.60 | 11.90 | 420 | 0 |
| Forest | 2 | 192.09 | 3.60 | 11.20 | 11.70 | 12.20 | 578 | 0 |
| Forest | 3 | 191.37 | 5.50 | 6.00 | 6.40 | 7.00 | 0 | 0 |

The p95/p99 patterns remain bimodal between runs despite nearly identical average FPS. One bridge frame exceeded 16.67 ms, so rare stalls are an open performance limit rather than a claimed improvement.

Production full-region traversal passed all eight registered destinations: east/west/south keeps, east/west/north towers, Hollowmere chapel and Vaelmark. Each route entered and returned under normal keyboard controls with Havok active and zero recovery teleports; the route probe reported no runtime or GPU errors. The cathedral probe separately passed both bell towers, both side chapels and the gallery/parapet circuit, with zero recovery teleports.

The production mobile probe injected the known WebGPU depth-bundle validation failure, selected the empty-fragment fallback and moved 23.40 m by native touch, including capture-loss, cancel, modal and blur input checks. Desktop WebKit moved 16.52 m by keyboard with Havok active; both probes loaded `ashenReach-Cb6x_hI8.js` without runtime or GPU errors. These checks use desktop browser engines and mobile emulation; a physical iPhone remains untested.

The [reviewed 16.689-second production MP4](https://ve.sparkify.dev/wow-clone/ashen-reach/lite1311-final/2026-09-26-production-motion.mp4) contains gate movement, equipment, chest hit, casting, cathedral entry and woodland. Its 1,380 timestamped frames encoded at 1280×720 with square pixels, rotation zero and elapsed time preserved. Capture and runtime reports recorded no failed request or runtime/GPU error. VE returned `video/mp4` and HTTP 206 byte ranges; direct Chromium playback advanced and sought to 9.30 seconds at 1280×720. Telegram message **780** returned matching dimensions and 16.689-second duration.

The migration deliberately retains narrow version-gated private CSM caster retirement and far/local PCF ownership, plus the bloom output display view; the tested public APIs do not yet replace those semantics. The half-resolution AO/fog targets still use ceil sizing, while Lite surface scaling uses floor sizing on odd dimensions. E1 CSM static caching and E2 async shader compilation remain optional experiments: the candidate clears the performance and first-use readiness gates, and neither change was introduced without a paired gain test. Compute-driven rendering and vertex animation texture experiments remain outside the current product scope. Physical iPhone acceptance remains separate from desktop mobile emulation.
