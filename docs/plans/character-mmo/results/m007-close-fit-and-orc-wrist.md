# M007 close-fit review and Orc wrist checkpoint

Status: **one Orc wrist defect corrected; full M007 fit acceptance remains open** (2026-09-28). Source base `11ef738`. This follows the [semantic coverage checkpoint](m007.md) and [active Undead bind correction](m007-undead-rebind.md).

## Review and finding

An owned 1280×720 Lite/WebGPU armory pass inspected three loadouts (Pilgrim torso with Graveweaver skirt/gloves, Graveweaver torso with Wayfarer trousers/no boots, and full Graveweaver) on Human short/stout (height 0.9, stout weight 1), Human tall/slender (height 1.15, slender weight 1), Orc and Undead. Each of the 12 states was captured from front, side and back, with zero page errors. The Human extreme candidates used the M004/M005 ignored shape/refit route; those assets remain diagnostic. Captures and the case report are ignored under `ve-capture/character-mmo/m007/close-fit-review/`.

The Orc exposed an irregular green forearm strip between the Graveweaver glove and both the Graveweaver and Pilgrim sleeves, including during walking. The glove's open proximal loop has 20 welded vertices per arm at roughly |x| 0.93–0.99 m; the Graveweaver sleeve loop is at roughly |x| 0.83–0.95 m. The existing glove has 2,596 vertices and 4,544 triangles. The mismatch is a real fit seam, independent of semantic body visibility. A separate [reviewed live defect clip](https://ve.sparkify.dev/wow-clone/ashen-reach/character-mmo/m007-close-fit-defects-2026-09-28.mp4) shows the full and mixed outfits through the walking clip. Telegram **805** returned matching 1280×720 dimensions. Direct VE served `video/mp4` with HTTP 200/206 and byte ranges; Chromium reported 1280×720, advancing playback and no media error.

Simple fixes were rejected in the live renderer: regenerating with the current registration fitter left the exposed strip; stretching proximal glove vertices made dark jagged faces protrude through the sleeve; extruding the open glove boundary preserved the jagged edge; and duplicating nearby skinned forearm triangles as a dark underlayer made a conspicuous blue irregular patch. None of those candidates changed the public pack.

## Accepted wrist repair

The Graveweaver glove now has a three-ring, 24-segment bracer on each wrist. The first and last rings tuck into the sleeve and glove; the middle ring crosses the visible gap. Each ring vertex takes the nearest original cuff sample's UV, joint indices and weights. [The authoring script](../../../../scripts/ashen-reach/add-orc-glove-cuff.mjs) appends 144 vertices and 192 triangles to the existing glTF primitive, using its original material and skin, so the glove still has **one primitive and no additional draw submission**. The script refuses a second application. The [Orc packer](../../../../scripts/ashen-reach/prepare-orc-equipment.mjs) now applies this step on future glove builds and can write isolated candidates using `--out-dir` and `--active-body`.

The public glove grows **228,812 → 238,056 bytes** (+9,244); its SHA-256 is `ae551225a6ceb06388b491342070e00a5c7ac2a377df1bac8ffcff13930331af`. The manifest and provenance match. No default Human startup asset or game JavaScript was changed. The current registration fitter recreates a glove with the same vertex count but positions up to 104 mm different from the pre-existing packed glove. That drift is an authoring reproducibility issue; the committed public correction was generated from the prior 228,812-byte pack, and a future full pack rebuild needs a paired visual comparison rather than blind overwrite.

I reviewed front/side/back screenshots and walking frames of the exact public GLB in full Graveweaver and the Pilgrim/Graveweaver mix. The former green strip is covered by a dark cuff through those frames. Exposed fingertips remain part of the short-glove design. The new bracer is visibly broad at close range; a later authored trim pass may improve its silhouette. [Reviewed live motion](https://ve.sparkify.dev/wow-clone/ashen-reach/character-mmo/m007-orc-wrist-cuff-2026-09-28.mp4) was encoded from 463 live frames over 11.658 seconds at 1280×720, square pixels, zero rotation, with zero page errors. Telegram **806** returned matching 1280×720 dimensions. Direct VE served `video/mp4` with HTTP 200/206 and byte ranges; Chromium reported 1280×720, advancing playback and no media error. Native Telegram inline/fullscreen was not inspected here. Video is fit evidence, not an FPS sample.

## Verification and remaining gates

`npm run test:equipment` passed 70/70, `npm run test:character` 87/87, `node --test scripts/test-active-character-assets.mjs scripts/test-f3-metadata-integrity.mjs` 8/8, and `ASHEN_PAGES=1 npm run build` passed. The Orc pack test checks the exact bind, hashes, one primitive and cuff marker. The active-asset census test had a stale expectation that the Undead hood remained bind-incompatible after M007's correction; its expected status was corrected to the current valid asset.

The [explicit-Orc Graveweaver measurement](../../../baselines/character-mmo/m007/orc-wrist-fps-summary.json) used M1 Max, Chrome 153 WebGPU, actual 1280×720, seven enemies, three separate 12-second runs per route, a single owned uncapped renderer, and no recording. Every run reported `vsyncCapped: false`, active Havok, zero recovery teleports and zero page errors. The numbers are `requestAnimationFrame` intervals; GPU mean timing is retained per run in the JSON. Power state was not independently logged. A preliminary Orc run without the changed glove was kept separate because it did not exercise this asset.

| Route | Mean FPS | Worst run p99 | Worst frame | Frames >16.67 ms |
| --- | ---: | ---: | ---: | ---: |
| Meadow | 197.4 | 6.3 ms | 9.2 ms | 0 |
| Town | 195.6 | 10.6 ms | 13.4 ms | 0 |
| Bridge | 232.1 | 5.8 ms | 8.7 ms | 0 |
| Cathedral | 231.7 | 5.8 ms | 9.7 ms | 0 |
| Forest | 218.1 | 6.1 ms | 8.7 ms | 0 |

This confirms the dressed Orc remains above the 144 mean-FPS solo gate on this machine. A separate paired town check used the same uncapped harness and full Graveweaver outfit, substituting only the prior glove manifest/GLB at load time: prior **186.59 FPS / 5.3600 ms**, cuff **186.64 FPS / 5.3586 ms** across three 12-second runs each. The **−0.027%** mean frame-time difference is below meaningful run noise. Worst run p99 was 6.6 → 6.5 ms; one cuff run had a 12.6 ms maximum versus the prior maximum 10.1 ms, with zero intervals over 16.67 ms. These are solo measurements, not a crowd-capacity claim. Default Human startup bytes are unchanged by this Orc-only asset, but no new cold-start percentile claim is drawn from that fact.

M007 remains open on creator-dependent Human extremes and hair/headwear, the Human mixed waist patches, more motion/clearance poses, and any fit defects the 12-case static matrix did not expose. M006's old/bald palette, rear UV seam, hood collision, age presentation, creator UI and persistence still block its own acceptance. This checkpoint does not begin M008 or authorize a production release.
