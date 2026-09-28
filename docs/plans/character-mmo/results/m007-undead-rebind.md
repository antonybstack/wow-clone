# M007 active Undead garment bind correction

Status: **verified defect correction; full M007 remains open** (2026-09-28). Source base `0e84638`. This changes the active Undead garment pack, not the default Human startup pack or its JavaScript.

The M001 census found that all eight active Undead garments had the Human catalogue's rest pose and inverse bind even though their vertices had already been fitted to the Undead rest surface. The streamed loader shares the active body's live bone palette, so matching 65 joint names without matching inverse binds was an invalid deformation contract. The [glTF skin specification](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#skins) defines the inverse bind's role. `prepare-undead-equipment.mjs` now remaps garment joint indices by name, bakes any mesh-node transform, attaches the fitted mesh to the Undead body's actual skin, strips the unused animation resources, and checks the complete rest pose and inverse-bind arrays before writing each asset. The manifest declares the resulting bind hash. All eight active assets now pass the same exact asset-level contract already used for Human and Orc; the provisional historical pack is unchanged.

The eight garment files total **2,186,424 bytes**, down from **2,828,688 bytes** (642,264 bytes, **22.7%**), chiefly because the unused Human motion accessors are pruned. The body file, 57 clips and default Human startup assets are byte-identical. The active asset census now reports **36 assets, zero errors**. The new `test-undead-race.mjs` case opens every active file and verifies body rig, joint order, inverse binds, mesh names, fit declarations, bytes and manifest hashes. Equipment tests **69/69**, character tests **87/87**, and the Pages-mode build passed. The main built game chunk remained `ashenReach-Cp655D5h.js` at 246.46 kB raw / 88.72 kB gzip.

I reviewed the [34.44-second live mixed-outfit motion clip](https://ve.sparkify.dev/wow-clone/ashen-reach/character-mmo/undead-rebind-2026-09-28.mp4) (Telegram **797**). It covers five mixed states and rapid torso swaps while the Undead orbits, walks, runs, jumps and lands. Capture was 1280×720 throughout, square pixels, no rotation, with zero page errors; Telegram returned matching dimensions. VE served the exact 37,113,638-byte `video/mp4` and a 206 byte range. Normal-camera motion shows attached garments without gross deformation. Fine seam penetration and the full creator-extreme matrix remain M007 gates. Telegram client inline/fullscreen appearance was not independently inspected.

The isolated M1 Max, AC-powered macOS 26.6.2 / Chrome 153 WebGPU check used 1280×720, seven enemies, one owned game renderer, no recording, three 12-second runs per route after settling, and an explicit `switchRace('undead')` assertion. The earlier URL-only attempt accidentally measured Human and was discarded; `measure-region-fps.mjs` now requires an explicit selected race. These are Vite-dev measurements of the candidate, not a paired production baseline or physical-device result. One of three bridge runs tripped the 240 Hz cap heuristic and is retained as **suspect throughput evidence**. All runs had Havok active, movement over 10 m, seven enemies and zero recoveries or errors.

| Route | Three-run mean FPS | Worst run p99 | Worst sampled interval | Suspect cap runs |
| --- | ---: | ---: | ---: | ---: |
| Meadow | 214.3 | 10.7 ms | 13.5 ms | 0 |
| Town | 216.0 | 6.2 ms | 9.2 ms | 0 |
| Bridge | 248.9 | 8.5 ms | 12.5 ms | 1 |
| Cathedral | 246.2 | 8.6 ms | 12.5 ms | 0 |
| Forest | 234.0 | 6.1 ms | 12.4 ms | 0 |

No run sampled an interval above 16.67 ms. The raw reports and motion source frames are retained locally under ignored `.cache/character-mmo/m007/` and `ve-capture/character-mmo/m007/undead-rebind/` respectively. Owned slot 7 used Vite **5873**, Chrome PID **15970**, CDP **10037**; its game page was closed and the slot stopped. The separate user-owned Chrome PID **3538** / CDP **9337** contained only `about:blank` pages and was left untouched.

The correction removes the exact-bind blocker for future Undead pose grouping. M006 head art, the full M007 close-seam and extreme-shape review, and M008–M010 remain open. No production deployment was made from this checkpoint.
