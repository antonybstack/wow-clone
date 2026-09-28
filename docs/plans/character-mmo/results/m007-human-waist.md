# M007 Human mixed-waist checkpoint

Status: **the active Human Pilgrim/Graveweaver waist breakthrough is corrected; M007 remains open** (2026-09-28). This follows the [close-fit review](m007-close-fit-and-orc-wrist.md). The M006 creator and final old-head art gates still prevent full extreme-shape acceptance.

## Cause and correction

The Graveweaver skirt asset contains a skinned `WayfarerTrousers` layer under its slit. In the mixed Pilgrim tunic + Graveweaver skirt loadout, its upper-hip triangles protruded through the tunic and skirt as brown patches, most visible on the short stout and tall slender diagnostic bodies. A native Lite visibility isolation showed that hiding the body did not remove the patches, while hiding this embedded trouser layer did. The isolation used the renderer's `setMeshVisible` API: assigning `.visible` alone did not invalidate Lite's cached opaque render bundle and gave misleading evidence.

The [active Human packer](../../../../scripts/ashen-reach/prepare-human-equipment.mjs) now keeps only embedded-trouser triangles entirely below local Y **0.8 m** for this one skirt. Its inner primitive falls from **2,260 to 1,200 triangles**. The Graveweaver skirt outer mesh, standalone Wayfarer trousers, bind, skin weights and morph targets remain intact. This is authored pack preparation, with no per-frame geometry editing or extra draw submission. An isolated pack rebuild changed only the skirt GLB. Its active file falls from **371,764 to 368,684 bytes**; SHA-256 `5a9b020c3e2ed0e7e099ba11caa2d86ebc11b036c4f03b0d1a0c9cfe9f818063`.

The full-pack and progressive startup manifests now agree on that file's hash, size and versioned URL. Rebuilding the equipment manifest alone initially caused the startup loader to reject the new file as an unexpected size because the startup character manifest mirrors late outfit entries. `node scripts/ashen-reach/prepare-starter-character.mjs` regenerated that mirror; no starter binary changed. The packer rotates a changed garment's HTTP cache key and retains the key on a byte-identical rebuild. The active asset census now resolves the request URL's pathname for local file inspection.

## Live review and performance

The exact active skirt was inspected at 1280×720 in the Lite/WebGPU armory, front/side/back, on neutral height 1, short stout 0.9 and tall slender 1.15. The extremes used the M004/M005 ignored shape/refit candidate; they are diagnostic, not advertised creator settings. All three loaded with zero page errors. A 14.968-second live gameplay capture showed the mixed Pilgrim tunic/skirt and full Graveweaver through orbit, walk, run, jump, landing and rapid torso swaps. I reviewed the close views and sampled frames; the prior waist patches are absent at those views. The [reviewed MP4](https://ve.sparkify.dev/wow-clone/ashen-reach/character-mmo/m007-human-waist-2026-09-28.mp4) is Telegram **808**, with matching 1280×720 dimensions and duration returned by Telegram. Its source and encoded tracks are 1280×720, square-pixel, zero-rotation; VE served `video/mp4` with HTTP 200/206 byte ranges and Chromium read 1280×720 with advancing playback and no media error. Native Telegram inline/fullscreen appearance was not inspected here.

The [separate FPS report](../../../baselines/character-mmo/m007/human-waist-fps.json) used an isolated uncapped Chrome 153 WebGPU renderer on M1 Max, actual 1280×720, seven enemies, full Graveweaver outfit, three 12-second runs per route, no recording. Havok remained active, movement exceeded 10 m per run, recoveries and page errors were zero, and no run was capped. These are `requestAnimationFrame` intervals, not a crowd benchmark or a paired old/new asset test.

| Route | Mean FPS | Worst run p99 | Worst sampled frame | Frames over 16.67 ms |
| --- | ---: | ---: | ---: | ---: |
| Meadow | 191.4 | 6.7 ms | 9.0 ms | 0 |
| Town | 194.4 | 11.4 ms | 12.0 ms | 0 |
| Bridge | 227.5 | 10.2 ms | 14.3 ms | 0 |
| Cathedral | 225.5 | 9.9 ms | 12.9 ms | 0 |
| Forest | 210.3 | 10.4 ms | 13.8 ms | 0 |

The mean passes the 144 FPS solo gate and the >120 FPS project goal. Some runs show 9–11 ms pacing tails despite low GPU mean time; the triangle reduction is too small to credit for an FPS gain. `npm run test:equipment` passed **71/71**, `npm run test:character` **87/87**, startup/active/F3 integrity tests **12/12**, and `ASHEN_PAGES=1 npm run build` passed. The streamed-asset test checks the embedded and standalone trousers, matching startup metadata, bind and hashes. The regenerated [M005 shape-family baseline](../../../baselines/character-mmo/m005/garment-shape-family.json) reflects this skirt's new topology; other item files are unchanged.

## Remaining gate

The M006 old/bald head still needs final source palette/UV seam, approved hood and age presentation, creator controls and persistence. M007 still needs the resulting creator extremes, long-hair/headwear combinations and broader close motion fit acceptance. This checkpoint does not complete M007 or begin M008. No production deployment was made.
