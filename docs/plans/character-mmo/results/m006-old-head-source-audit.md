# M006 old-head source seam and headwear audit

Status: **the old/bald alternate remains a diagnostic candidate; M006 is open** (2026-09-28). No production character asset or creator control changed in this pass.

The [neck morph checkpoint](m006-neck-and-headwear.md) closed the shape-dependent dark gap, but it did not establish a continuous material or headwear fit. The reproducible [`audit-old-head-seam.mjs`](../../../../scripts/character-assets/audit-old-head-seam.mjs) samples the actual candidate GLB's basecolor UVs at the 1.50 m cut. The 41 body-rim vertices average **RGB 162/141/130**, while the 89 old-head rim vertices average **229/179/143** in source sRGB texels. This is a sampled albedo comparison, not a display-space color metric: light, normals, baked shading and texture filtering still affect the visible join. The old head has **zero open welded-position edges above its intended neck boundary**, so its scalp stripe is not an open mesh crack. At **13 coincident positions** along the rear center, the two UV sides sample texels separated by at least 40 sRGB values in one channel; the largest red-channel spread is 138. The source head atlas has a different palette and baked-lighting character from the existing Human body's atlas.

I checked four bounded fixes against the live 1280×720 game, each kept under ignored `.cache/character-mmo/m006/` and **rejected**:

| Diagnostic | Reviewed result |
| --- | --- |
| Whole-head PBR basecolor factor derived from rim mean | Darkened the old face and left the neck band. |
| Vertex-color factor fading from the rim toward the face | Added dark marks and still left a visible band. |
| Per-vertex rim color ratio using the nearest body-rim texel | Made the lower face gray without removing the bright cut. |
| Remap 13 bright UV-side vertices to their coincident dark-side UVs | Turned the rear scalp line into a wider pale streak. |

These failures distinguish the source art problem from a missing material multiplier. The head and body have different painted shadows and skin detail, so a single factor or narrow UV substitution cannot make the seam coherent. A fresh authored head/body palette and UV seam treatment must be reviewed live before promoting this alternate. No generated texture was accepted or placed in the project.

The first second-outfit check exposed a separate fit failure. In a short stout Human at height **0.9**, the Graveweaver hood allows the old head's scalp/ears to protrude at the side and rear. The same hood on the native shape-family head covers the rear cleanly in the matching live comparison. The old alternate is a separate head mesh whose fit and semantic coverage have not been authored for this hood; the current shape-candidate interception does not make that mesh a production headwear adapter. Reviewed [live orbit, walk/run/jump and hood motion](https://ve.sparkify.dev/wow-clone/ashen-reach/character-mmo/m006-old-bald-graveweaver-defect-2026-09-28.mp4) was delivered as Telegram **804**. The capture had 398 ordered 1280×720 frames over 13.236 seconds, zero page errors, square pixels and zero rotation. Telegram returned matching dimensions. VE returned `video/mp4`, 33,147,367 bytes, HTTP 206 range; Chromium's video element reported 1280×720 and advanced from 0.021 to 1.223 seconds without an error. Recording was active, so this clip is not an FPS measurement.

The next source pass needs a consistent head/body material, a closed scalp UV seam, and either a separate hideable scalp region or a hood fitted to the old head while keeping the face visible. Check both bare-neck and Graveweaver views at neutral/slender/stout and both height endpoints, in motion. The accepted result must also preserve the 65-joint active palette, 57 clips, two body/head shape targets, and the default Human startup path.
