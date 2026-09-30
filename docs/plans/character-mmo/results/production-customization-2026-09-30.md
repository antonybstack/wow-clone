# Milestone 1 — production body customization

Bounded customization released and verified, 2026-09-30. Reliable one-second public startup remains an explicit performance follow-up. This result belongs to milestone 1 of the [reprioritized next ten](../next-ten.md); it does not close the older M006 art milestone or establish crowd capacity.

## Delivered scope

The normal Armory offers Human height **0.90–1.15** and a single signed build **−0.95–0.95**. Negative build drives only `slender`; positive build drives only `stout`. No simultaneous-axis blend or weight 1.0 is offered. The source body's neutral semantic geometry, 65-joint bind and 57 animation clips remain exact. Orc and Undead retain their neutral bodies and fitted equipment, with unavailable body controls explained in the interface. Hair, head, age, palette and Elf are later milestones.

Schema/catalog v2 describes race, fit, body shape and equipment in one validated committed appearance. Actor transactions serialize body, race and outfit changes. The editor's draft and undo history are separate from that committed identity. A failed body, garment or race request disposes hidden stages and retains the existing body, outfit, capsule, pose and recipe. Old garments release their borrowed palette before their body donor retires. Post-commit cleanup cannot dispose the newly committed outfit. Height changes use absolute values, so repeated edits do not accumulate camera or capsule scaling.

Valid v1 appearance and creator records migrate explicitly. Two nonzero legacy build axes, unknown versions, non-finite/out-of-domain values and unsupported controls are refused rather than guessed. Invalid records remain recoverable; overwriting a migrated record first preserves the legacy value. Blocked storage leaves play available and reports the save failure. Orc/Undead reloads retain the actual selected outfit, rather than substituting a preset. The Armory resynchronizes its race presentation with the actual equipped actor.

## Assets, reproduction and startup policy

`npm run prepare:human-shapes` derives the full body and eight fitted pieces from tracked canonical GLBs and the vendored CC0 MakeHuman girth measurements. It creates temporary authoring outputs and needs no pre-existing `.cache`. Tool versions, recursive source hashes, neutral identity, garment fit/hem reports and rights limitations live in the versioned manifest. Original Tripo/Mixamo body grant evidence is absent from the inherited M001 provenance; CC0 fitting measurements and garments do not confer a license on that body.

Use **Node 22.18.0**, pinned by `.nvmrc` (`nvm use`), and `npm ci`. A clean index export reproduced all nine full and nine compact decoded artifacts. Node 25.2.1 also reproduced decoded content, but its gzip output differed; the pinned Node reproduced the complete manifest byte for byte. Do not treat different gzip bytes as equivalent content-addressed publication. `verify-production-human-shapes.mjs`, invoked by the build, checks builder/input provenance, aggregate source identity, encoded content-address, decoded hash/size and full texture hashes.

Publication also supplies ten inherited runtime images that the previous checkout had only as ignored files: seven world textures and three fire sprites. A clean source build must contain them. Existing Orc wrist, Human skirt and Undead bind repairs remain in their canonical source packs.

An unsaved neutral Human loads the existing compact starter and fetches no shape family before play. The creator graph arrives after play; its first edit stages and atomically promotes the compatible family. A saved non-neutral shape or different outfit instead boots its selected compatible body and compact clothing before the first playable frame. Clothing is simplified with **glTF Transform / Meshoptimizer**, ratio 0.4, error 0.002 and locked boundaries; skin, base and morph attributes are remapped together. Full clothing and texture detail follow after play on the same appearance identity. Locked-boundary compact/full views were inspected at both build and height extremes. The first compact pass (ratio 0.5/error 0.001) had largest-outfit p95 1,007 ms in the final bundle, with 12/20 under one second; the revised pass saves 263 KB for that outfit and is measured separately. This failing result is retained. The body retains full geometry, bind and animation at startup. No entire-outfit Cartesian product is baked.

The full-pack strategy failed the largest-outfit startup gate and was rejected. Rounding morph deltas and resampling animation yielded negligible byte savings and were also rejected. Current binaries preserve the original float deltas and clips. Morph targets use separate/tightly packed accessors because the pinned Lite glTF feature ignores target `byteStride`; asset tests prevent reintroducing that rendering defect.

## Performance defect found and corrected

A first body edit initially reduced bridge throughput from about 235 to 212 FPS and cathedral from about 233 to 203 FPS. The culprit was **local lamp shadow selection**, not a duplicate world or a camera-height change: its unknown-deformation fallback included morphed meshes at any distance. Both lamp maps therefore redrew at the cathedral, adding approximately 96 draw submissions per frame.

The range selector now uses Lite's public retained morph targets/weights and `computeAabb`. It caches immutable delta extrema once, combines signed-weight extents, then applies the existing conservative bone/world-box union. Unknown/malformed deformation still stays included. It never uses gameplay-camera visibility to exclude a shadow caster. Native `enableMorphTargetShadows` composes morph bounds into the existing skeleton bounds on sun and local generators. A separate non-rendering scene primes the lazy native PBR/morph extension; the live scene stays registered during downloads. Runtime `addToScene` already requests the native PBR rebuild, so promotion avoids an extra explicit scene-wide request.

Sources and API boundaries are linked beside the relevant code. The morph extent rule follows the [pinned native implementation](https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/packages/babylon-lite/src/shadow/enable-morph-target-shadows.ts); glTF Transform's [simplification](https://gltf-transform.dev/modules/functions/functions/simplify) supplies the compact remapping. No Classic Babylon runtime or second asset loader was introduced.

## Verification and limits

Reports and raw interval samples are in the [evidence directory](../../../baselines/character-mmo/production-customization-2026-09-30/). Larger runtime PNGs and source recording frames remain in ignored task capture storage.

The paired full-detail comparison uses M1 Max, uncapped Chromium WebGPU, actual 1280×720/device scale 1, seven enemies, three 12-second runs per route, isolated and without recording. Baseline source is `434a9a6`. Mean throughput:

| Route | Baseline FPS | Neutral candidate FPS | Tall stout candidate FPS |
| --- | ---: | ---: | ---: |
| Meadow | 197.4 | 197.3 | 195.6 |
| Town | 197.9 | 198.1 | 198.2 |
| Bridge | 235.8 | 235.8 | 233.4 |
| Cathedral | 233.5 | 233.6 | 228.6 |
| Forest | 219.1 | 219.1 | 217.1 |

The shaped cost is approximately 0.9–2.2% in mean frame time on the affected routes. All samples stayed below 16.67 ms; the shaped maximum was 13.5 ms. Raw files report p95/p99 and counts above 6.94/8.33/16.67/33.33 ms. The original neutral candidate had larger meadow/town tails despite unchanged mean/draw cost. Follow-up confirmation retained both pacing bands: baseline meadow p95 5.9–10.3 ms, candidate 10.7 ms; baseline town 9.8–10.7 ms, candidate 5.9–10.7 ms. Earlier baseline meadow also measured p95 10.9 ms. This is variable uncapped browser pacing, not a per-frame 144 Hz guarantee; candidate meadow used the longer band more consistently. No rows were replaced to improve the headline.

First live family promotion is measured separately: three transactions completed in 91/99/103 ms, with maximum rendering intervals 19.4/17.3/20.5 ms, p99 9.3–9.8 ms, no interval above 33.33 ms and no runtime/GPU errors. Network/cache conditions are in `promotion-final.json`; this is not an empty-cache end-to-end appearance latency claim.

Automated checks passed: 141 character, 71 equipment and 23 startup/local-bounds cases. Live checks cover exposed end and intermediate builds (−0.95/−0.5/0/0.5/0.95), both height endpoints, coherent body/outfit reloads, actual race capabilities, failed body/garment/race/return downloads, palette ownership, and delayed texture refinement during a race change. Failed race and Human-return requests preserve the exact body root, committed recipe and scene mesh count. Saved Orc and Undead retain their selected outfits and boot before the render loop without a commit deadlock.

Cold-start gate: 20 fresh Chrome processes per profile, compressed exact Pages build (`ASHEN_PAGES=1`), M1 Max, 1280×720, 50 Mbit/s / 40 ms CDP throttling. Every profile retained all rows and passed p95 <=1,000 ms:

| First-playable identity | p95 ms | Maximum ms | <=1 second |
| --- | ---: | ---: | ---: |
| Unsaved default | 835.0 | 839.4 | 20/20 |
| Short slender, largest outfit (Pilgrim/hood/skirt/boots/gloves/staff/book) | 943.8 | 944.8 | 20/20 |
| Tall stout Wayfarer | 833.6 | 835.8 | 20/20 |
| Saved neutral Wayfarer | 840.7 | 840.8 | 20/20 |

The boundary checks actual saved height/build, race and complete outfit, grounded Havok support, dressed completed GPU frame, removed loading overlay, enabled input and a subsequent movement response. Browser profiles/cache are fresh; OS/driver caches are uncontrolled. These are local transport/CPU results, not promises for every network or phone. Ordinary multi-entry preflights (`cold-*-accepted.json`) are retained separately; they include diagnostic pages and are not the final release gate. First full-clothing p95 1,098.9 ms/max 1,482.6 ms and the later first compact-pass p95 1,007 ms/max 1,010.9 ms remain recorded as failures.

Final **exact Pages package** (`fps-pages-*`) repeated three 12-second runs per route in the same isolated conditions:

| Route | Neutral mean FPS | Tall stout mean FPS |
| --- | ---: | ---: |
| Meadow | 197.3 | 195.5 |
| Town | 197.8 | 198.3 |
| Bridge | 235.7 | 233.4 |
| Cathedral | 233.3 | 228.6 |
| Forest | 218.9 | 217.2 |

Every route passes >144 mean FPS. The final maximum is 13.1 ms, with zero intervals >16.67 or >33.33 ms. Final raw files retain all quantiles, intervals and rolling/full cap diagnostics. An intermediate preflight stopped because its last 600 HUD samples resembled 240 Hz, while the full cathedral window was 228.55 FPS and uncapped. The benchmark now judges the complete 12-second sample, retaining the rolling hint; no runtime cap heuristic was weakened.

Reviewed live motion is [VE MP4](https://ve.sparkify.dev/wow-clone/ashen-reach/character-mmo/production-customization-2026-09-30.mp4), Telegram **818**. The silent 176.909-second, 44.3 MB H.264 attachment uses 1280×720, square pixels and zero rotation; source elapsed is 176.912 seconds. All 6,485 recorded frames retained fixed dimensions. The bitrate cap limits attachment size without resizing or retiming. Encoded chronological samples were reviewed for all 20 combinations, compact movement/refinement and race changes; no newly exposed tearing or major clipping was observed. Fixture resets near the real training dummy are pose setup, not continuous traversal proof. Both spell windups were asserted against the actual targeting/cast state.

VE returned `video/mp4`, matching content length and a correct 206 byte range. Chromium played and sought the public clip in fullscreen at 1280×720 with advancing time and no video errors. Telegram returned matching 1280×720 dimensions and duration. Telegram client inline/fullscreen presentation was not independently inspected in this environment; earlier user confirmation applies to the separate cathedral clip, not this new attachment.

Production game source **`59c08daac18c07c3fc2b56bc28f871f71374b37f`**, Cloudflare Pages **`378af1f5-609a-416e-ad3d-5636dbf13c2b`**, [play.sparkify.dev](https://play.sparkify.dev). Rollback is **`72fd1e3d-7d8d-4108-8f0f-d8eb9a42cbfe`** (`76e3c41`). The rollback identity was re-read immediately before release; rollback was not needed. Deployment uses the existing Pages workflow; 251 executable/critical resources match the resulting build, including the shape family, woodland data, images and Havok binary.

Production passed spawn movement and cathedral entry/return at all four build/height endpoint pairs, with Havok active and no recovery increment. Tests place fixtures before each route, then use normal keyboard movement; successful traversal uses no flying or recovery teleports. All 33 appearance checks passed again on the deployed URL, including negative download controls and saved race outfits. Chromium native touch and interrupted-input checks passed with the deliberately injected depth-only bundle failure recovering through the native empty-fragment fallback. Desktop WebKit 26.6 passed body-slider touch, composited-pixel and movement checks. Both use 430×734 CSS/DPR 3, existing 322×550 internal rendering. These are functional checks, not phone FPS measurements; narrow portrait Armory framing retains its existing partially obscured stage.

## Public startup qualification and next priority

An additional **unthrottled public-URL** experiment was extended from five to twenty fresh processes per identity after its initial outliers appeared. The initial rows were retained; fifteen continuation rows were appended, without replacements:

| Public native profile | p95 ms | Maximum ms | <=1 second |
| --- | ---: | ---: | ---: |
| Default | 1,012.4 | 8,291.1 | 18/20 |
| Largest saved outfit | 1,030.9 | 1,455.2 | 16/20 |

These public results **miss the reliable one-second target**, despite the prescribed local 50 Mbit/s/40 ms Pages-build gate passing. They must not be presented as universal one-second acceptance. In default run 1, the supported frame was submitted at about 735 ms, but first GPU completion arrived at about 8,287 ms; the largest first run similarly spent about 722 ms between submission and completion. The probe reported no long tasks or GPU validation errors. M001 recorded a similar 9,149 ms first-GPU-completion outlier; that establishes prior occurrence, not a proven common cause. Production input observation also has background-loading tails: maximum response upper bound 1,898 ms in the default outlier and 236 ms for the largest cohort. Settled throughput and first appearance promotion are separate measurements above.

**Next performance work:** isolate first-frame GPU completion versus shader/pipeline readiness and browser/driver state, compare a fresh paired baseline on the same public transport, and recover public startup margin while preserving the saved silhouette and completed-GPU/input boundary. Do not weaken that boundary, drop the first run, or enable the previously rejected shader/shadow trials without a new measured path. Crowd correctness remains milestone 2 after this priority is addressed. The released subset is functional; the public load-time limitation remains open.

Owned Chrome/CDP 10137 (PID 41806), harness Vite 5973 and compressed previews 7174/7274 were tracked throughout. Cold-browser and WebKit processes/contexts were closed after each run. Final teardown is recorded in the ownership report; no worker started an additional renderer.

Independent Grok 4.6/high design and implementation reviews were completed. Valid feedback addressed post-commit disposal, borrowed palette ordering, native container access, separate editor draft/undo, provenance validation and coherent saved-outfit startup. Workers started no game renderer. The subsequent local-light regression was attributed through per-task live draw instrumentation and corrected directly.

The inherited representative fit still has measured hem exceptions; publication does not claim arbitrary sliders, every animation frame or artifact-free AAA tailoring. Physical iPhone startup/customization acceptance, process/GPU memory attribution and crowd scalability remain unmeasured here. Desktop touch and WebKit are distinct from a physical phone.
