# Babylon Lite 1.31.1 M4 production acceptance — 2026-09-26

The M3 game candidate was released to `play.sparkify.dev` as Cloudflare Pages deployment `b0812424-5963-4a70-94fb-13f6f1e23bde`, from pushed commit `ff91340ff590ddd5b5182058db325b0842714a26`. The previous successful production deployment, recorded immediately before upload for rollback, was `6a174b2a-4885-42da-aa11-9991641858c2` (Lite 1.28.0). Production serves Pages bundle `ashenReach-CVCGzppf.js`; the normal local build of the same source had bundle `ashenReach-C6Ic5lIH.js` because Pages uses a staged public directory. `scripts/verify-pages.mjs` compared 346 selected deployed assets with the fresh Pages `dist`, including JavaScript, terrain/woodland and texture assets, and Havok WASM content/MIME: zero failures.

## Paired performance gate

Apple M1 Max, macOS arm64, uncapped headless Chromium 153.0.8010.54 WebGPU, actual 1280×720 canvas, seven enemies, active Havok, no recording. Each route ran for 12 seconds three times per version, then repeated with order reversed: 1.28.0 → 1.31.1 → 1.31.1 → 1.28.0. Every one of the 48 runs exceeded 178 FPS, with no vsync cap, recovery teleport, runtime error, or GPU error. Raw per-run reports and frame traces are in the local ignored `ve-capture/ashen-reach/lite1311/m4-performance/` directory.

| Route | Lite 1.28.0 median FPS | Lite 1.31.1 median FPS | Pooled p95 / p99 ms, old → new | Frames over 16.67 ms, old → new |
| --- | ---: | ---: | --- | ---: |
| Town | 179.39 | 179.60 | 11.1 / 12.1 → 11.3 / 12.2 | 2 → 0 |
| Bridge | 218.97 | 219.38 | 9.3 / 10.3 → 9.2 / 10.2 | 4 → 4 |
| Cathedral | 225.71 | 225.74 | 8.0 / 9.7 → 9.0 / 9.8 | 0 → 1 |
| Forest | 191.25 | 191.32 | 6.1 / 10.8 → 10.5 / 11.5 | 0 → 1 |

The worst individual frame was 96.1 ms on 1.28.0 and 60.5 ms on 1.31.1 at the bridge; cathedral and forest each had one new outlier above 16.67 ms. Run-level p99 timing was bimodal in both versions: the first pass favored 1.28.0 on three routes, while the reversed repeat favored 1.31.1 at the bridge and tied at the cathedral. Six-run median FPS changes stayed within +0.2%, and pooled p99 changes ranged from −1.0% to +6.5%. This supports release against the >120 FPS gate; the forest p95 rise and intermittent frame pacing warrant a later targeted investigation rather than a claimed frame-tail improvement.

## Production behavior and reviewed motion

- Exact Pages bundle smoke loaded seven enemies, active Havok and sun shadows, moved 14.01 m with normal keyboard input at 1280×720, with no recovery, failed request, runtime error, or GPU error.
- Cathedral exploration entered the nave on foot and returned to the courtyard with active Havok and no recovery. The full production route checker entered and returned from all eight destinations: east/west/south keeps, east/west/north towers, Hollowmere chapel, and Vaelmark.
- Forced mobile depth-bundle failure selected the fallback. Real touch events moved 40.48 m and survived capture loss, cancellation, modal interruption, and blur with no runtime/GPU errors. Desktop WebKit at a 322×550 mobile viewport visibly moved 16.18 m with Havok active and no runtime/GPU errors. These are desktop tests; physical iPhone acceptance remains separate.
- The production capture contains 1,251 timestamped frames over 15.048 seconds. Its encoded MP4 is 1280×720, square pixels, rotation 0. Reviewed frames show live gate, underpass, woodland, character, and UI motion; no missing world or black-frame failure was observed. The [VE production clip](https://ve.sparkify.dev/wow-clone/ashen-reach/lite1311-m4/2026-09-26-production-motion.mp4) returned HTTP 206 `video/mp4` with byte seeking; Chromium loaded 1280×720 metadata, sought to six seconds, and played. Telegram message **772** returned matching 1280×720 and 15.048-second metadata. Telegram desktop inline/fullscreen playback was not available locally; the user's earlier cathedral resend confirmed its proportions.

M0–M3 test and visual gates are recorded in their linked reports. Production passed this M4 release gate, so rollback was not used. Follow-up F1–F7 work remains a separate implementation and acceptance sequence; it was kept outside this deployed candidate.
