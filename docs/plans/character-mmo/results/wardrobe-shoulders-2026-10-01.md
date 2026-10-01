# Wardrobe factory — independent shoulder checkpoint

Source checkpoint: **`2358d7b`**, committed and pushed.

Status: locally implemented and verified, **unreleased; milestone 6 remains open**. Implements the first slice of the [factory execution plan](../wardrobe-factory-implementation.md) on the accepted M1 bodies. M5's new head source remains a separate fit gate. Production is still source `8ae4c2d`, Pages `0c2f92c1-a4f8-43ab-838f-45c0f622df4b`.

## Implemented behavior

Armory has a real eighth `shoulders` slot, independently streamed and persisted. `wardenPauldrons` has its own accepted Human, Orc and Undead assets; it is not baked into a torso outfit. Open shoulder caps hide no body regions. Each rigid half has weight 1 to its actual upper-arm joint. Human morph targets reuse `trackBodyRigid` and preserve a per-arm similarity; the tiny rigid piece uses identical full/compact geometry.

Outer appearance schema stays 2 and catalogue becomes `appearance-catalog-v3`. Exact frozen seven-slot v1/v2 registries migrate known saved recipes by adding `shoulders:null`, preserving all other identity/body/equipment fields. Unknown/corrupt records retain recovery behavior. Prepared older crowd recipes use the same strict bounded migration. Existing presence fits explicitly require `shoulders:null`; remote armor is unavailable until real assets are prepared and admitted. The historical preloaded diagnostic rejects armor before mutating selection.

Default boot makes no optional plate or Human-family request. The four starter binaries and eight existing garment source binaries are unchanged. Starter manifest advertises the optional plate for early selection without adding it to default fetches. Historical cloth/combined-pack builders consume the frozen original catalogue; armor has its own compiler.

## Reproduction and native reuse

`blender/characters/wardrobe/warden-pauldrons.json` declares slot/layer/occupancy, deformation, material/detail/corrective revisions, accepted fit interfaces and SHA-256-pinned source bodies. The compiler rejects catalogue/fit/material mismatch and a Blender version other than 5.2.1. It uses isolated processes with `--python-exit-code 1`, restores each actual ordered 65-joint bind/rest palette, rejects copied animation and non-rigid weights, and writes immutable binaries before advertising manifests. Provenance pins the descriptor and compiler/helper sources.

```sh
node scripts/character-assets/prepare-warden-pauldrons.mjs
npm run prepare:human-shapes
npm run prepare:startup
npm run test:equipment
```

These commands operate on the current pinned bodies. A changed source requires deliberate descriptor revision and renewed fit acceptance. Never run historical cloth builders merely to rebuild this armor; their source family and output ownership differ.

Reuse: native [Blender Solidify](https://docs.blender.org/manual/en/latest/modeling/modifiers/generate/solidify.html), [BMesh convex hull](https://docs.blender.org/api/current/bmesh.ops.html#bmesh.ops.convex_hull) on the isolated Orc/Undead deltoid envelope, existing bind normalization, [glTF skins/morphs](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#skins), native glTF Transform and Meshoptimizer. No new engine, animation clock or runtime fitting solver. Small Metal-style PBR material replaces neither the actor nor cloth.

| Fit | Vertices | Triangles | Neutral GLB bytes | SHA-256 prefix |
| --- | ---: | ---: | ---: | --- |
| Human | 236 | 464 | 33,512 | `30914318b15c` |
| Orc | 198 | 388 | 31,032 | `0eeed07f0db4` |
| Undead | 140 | 264 | 26,888 | `48130ebf8564` |

Human encoded shape artifact is 19,909 bytes, full and compact identical. A complete second three-race compilation reproduced all binaries byte-for-byte. Existing Tripo/Mixamo source-grant provenance limitations remain; deriving armor does not relicense those bodies.

Rejected source passes: the imported Blender bone tail was not a valid arm-length ruler; native joint-head distance fixes cap radius. Orc shoulder triangles live across `BodyExposed` and `BodyUnderTunic`, so both actual skin regions are used. Direct dense deltoid shells and a voxel-remesh attempt retained jagged plate silhouettes; the native convex cap with inward closure removed passes the reviewed continuous-shell silhouette. Unused rejected immutable prototypes were removed before staging.

## Verification and performance

145 character, 76 equipment, 36 actor/streaming/direct-count and 8 presence/startup tests pass. Normal and Pages builds pass sequentially. An accidental overlapping build attempt failed while both writers emptied `dist`; those failure logs were retained and both builds were rerun separately before subsequent native checks. This was a verification-process error, not a deployed release.

Live checks cover three races, Human ±0.95 build / 0.90 and 1.15 height, three existing outfits, front/side/back and native run/jump/land/fire/lava diagnostic playback, plus normal Havok run/turn/jump. Saved slot reload, HTTP 503 retaining the prior appearance, rapid supersession and race return pass, with no GPU/runtime errors or recovery teleports. The final recorder uses actual outfit buttons and asserts that every displayed item selection matches committed equipment; API-only diagnostic captures had stale outfit control labels.

M1 Max, isolated uncapped Chromium WebGPU, 1280×720, seven enemies, no recording, three 12-second runs on five routes:

| Workload | Mean FPS across runs | Worst interval | Largest p99 interval |
| --- | ---: | ---: | ---: |
| Neutral, first 15 runs | 197.8–236.2 | 12.6 ms | 11.2 ms |
| Largest Human / Graveweaver / armor, first 15 runs | **120.9–228.8** | 15.4 ms | 13.8 ms |
| Same body/outfit without armor, three town controls | 181.8–191.3 | 13.8 ms | 11.9 ms |
| Armor, three repeated town runs | 181.6–190.7 | 14.4 ms | 11.1 ms |
| Armor, complete final 15-run repeat | 188.9–229.2 | 13.6 ms | 11.8 ms |

All retained samples have zero intervals >16.67 ms. The first armor batch includes town means 120.9/128.0 FPS. Paired controls/repeats do not reproduce that slowdown; its cause is **unexplained**, not a proved fix or a universal 144 FPS claim. GPU means in the slow rows remained ~1.1 ms. Town paths vary slightly under real AI/collision, so these are repeated representative routes, not identical frame traces. Native renderer ownership was audited; extra owned game pages were closed. Browser PID 3959 / GPU helper 3976 / CDP 9837 served the owned checks; no game recording or asset compiler ran during settled benchmarks.

Fresh process/profile each row, 50 Mbit/s download / 40 ms latency, 1280×720, grounded/dressed/GPU-completed/input-ready boundary:

| Cohort | Runs <=1 second | p95 | Maximum |
| --- | ---: | ---: | ---: |
| Compressed preview default | 20/20 | 837.2 ms | 847.2 ms |
| Largest saved payload plus shoulders | 20/20 | 952.1 ms | 955.9 ms |
| Existing saved catalogue v2, migrated before play | 20/20 | 944.1 ms | 947.7 ms |
| Uncompressed Vite-preview transport control | 0/20 | 1,086.3 ms | 1,086.9 ms |

The transport control downloads uncompressed WASM and is not comparable to Pages. All rows remain in [baselines](../../../baselines/character-mmo/wardrobe-shoulders-2026-10-01/). OS/CDN/GPU-driver caches are uncontrolled; the previously deferred multi-second first-use GPU tail remains open. A two-run negative navigation control verifies that failed startup rows are retained and browsers close; no failed first run is discarded or retried under the same number.

Saved armor passes native Chromium touch/body edits, capture-loss/cancel/modal/blur recovery, injected real depth-bundle fallback and desktop WebKit movement/display checks. These use the existing mobile rendering policy at 322×550; they are not native-resolution FPS or physical-phone acceptance. Normal spawn movement and cathedral entry/return with armor pass at all four accepted Human build/height endpoint combinations, Havok active and no recovery teleports. No new physical iPhone test was performed.

## Visual evidence and remaining work

The fixed native 0.48-second Fire Blast pose confirms two pale stout-Pilgrim abdomen patches are skin: they disappear when the body is hidden and also exist without armor. This is an inherited clothing breach, not accepted tailoring or a shoulder regression. The diagnostic screenshot controls were stale after direct API outfit changes; actual rendered mesh state identifies `PilgrimTunic`. Other race/cloth crossings seen in the broad captures still need separate body-hidden diagnosis and correction. Hood/head-family clearance remains an M5 blocker.

Reviewed initial motion: [VE original](https://ve.sparkify.dev/wow-clone/ashen-reach/character-mmo/wardrobe-shoulders-2026-10-01.mp4), Telegram **827**. Both encode variants preserve 107.243115 seconds, 1280×720, SAR 1:1 and rotation 0. Telegram returned matching dimensions/duration for the 39 MiB bounded encode; the original 164 MiB send was rejected with HTTP/API code 413. VE direct playback, seeking, fullscreen and `video/mp4`/206 responses pass. Telegram client presentation is not independently inspected. Final actual-button motion: [VE v3](https://ve.sparkify.dev/wow-clone/ashen-reach/character-mmo/wardrobe-shoulders-v3-2026-10-01.mp4), Telegram **828**, 105.219360 seconds with matching 1280×720/SAR/rotation/delivery metadata. Final VE playback/seek/fullscreen and HTTP content/range checks pass.

A read-only Grok 4.6/high review is retained with this baseline. Valid preloaded-state, rigid compact and tool-pin findings were corrected. The alleged missing starter manifest was stale relative to regenerated outputs; actual early slot selection and default request exclusion are verified. Restricting Orc to `BodyExposed` alone would omit its deltoid; the two measured skin regions are retained. The final read-only recheck substantiated no further consequential checkpoint defect; its retired provisional Undead catalogue footgun was also scoped to legacy inputs. This review did not establish visual or milestone acceptance.

Remaining M6 exits: two new distinct complete cloth/rigid designs, permitted mixes and source-action fit corrections, remote per-piece catalogue integration, measured authoring/corrective cost and 30-set budget, independent content publication and accepted production verification. A shoulder item or extra dye preset does not count as a new complete design. The suits03 wizard source was investigated and not imported: its pack page says CC-BY while its MHCLO says AGPL3, with the author page unavailable. The source audit records that conflict; no unsupported license claim is made. Continue through clearly licensed source tailoring or original authoring.
