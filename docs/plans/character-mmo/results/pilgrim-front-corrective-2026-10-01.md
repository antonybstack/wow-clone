# Human Pilgrim front fit correction — 2026-10-01

This is a bounded wardrobe-factory correction on the accepted M1 Human. M5/M6 remain open. Production remains the verified M4 Pages deployment `0c2f92c1-a4f8-43ab-838f-45c0f622df4b`; this checkpoint is not a milestone release.

## Problem and implemented correction

The stout Pilgrim tunic exposed two abdomen skin patches at the real layered Fire Blast inspection pose, 0.48 seconds. Removing the body removed the patches. Removing shoulder armor did not: this was inherited garment fit, not a shoulder regression.

The original MakeHuman garment weights survived fitting onto the current Tripo-derived body. A full native Blender Data Transfer improved the front but introduced a rear skin stripe, including neutral; hiding the body confirmed it. A wraparound lower-torso mask reduced that stripe but still failed. Both candidates were rejected. The accepted correction uses **native Data Transfer with a front-abdomen vertex-group mask**, retains the authored back/cape/sleeve/loose-hem weights and preserves original geometry. The tiny neutral rear mark remains present in the identical baseline and candidate; it is not closed by this correction. No full wardrobe-fit acceptance is claimed.

The mask uses actual Hips/Spine/Spine1/Spine2 landmarks: lower fade starts at 0.9625 m, upper fade ends at 1.2616 m; the front fade uses the source's glTF +Z axis and an 80 mm transition. These are explicit artist corrective parameters for this pinned source, not a universal cloth fitting rule. Four normalized influences are retained, matching the current pipeline. Discarded interpolated mass is recorded: maximum 5.08%, mean 1.13% over active native rows. Grok suggested nearest-vertex copying as an alternative; that is a hypothesis, and was not substituted for the smoother native face interpolation without evidence.

Blender emits correspondence/weights only. NodeIO copies the weights into the original garment document, preserving UV splits, ordering, materials, topology, palette and bind. **2,412 of 8,960 vertex weight rows change; 6,548 remain exactly unchanged.** Original POSITION/NORMAL/UV/index arrays, textures, inverse binds, transforms and joint order compare identically after the candidate roundtrip. Maximum source/native correspondence distance is 0.869 micrometres; maximum weight-sum error is 1.28e-7. The body and all 57 source curves remain untouched.

Use the native [Data Transfer modifier](https://docs.blender.org/manual/en/latest/modeling/modifiers/modify/data_transfer.html), [glTF skin attributes](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#skinned-mesh-attributes) and [glTF Transform Meshopt compression](https://gltf-transform.dev/modules/extensions/classes/EXTMeshoptCompression). Links are also in the implementation comments. The Blender documentation fetch returned HTTP 402 here; behavior was checked against pinned Blender 5.2.1 and the actual output. No new runtime solver, renderer, animation path or procedural gait was added.

## Reproduction and publication

`blender/characters/wardrobe/pilgrim-front-corrective.json` pins the original frozen garment, accepted body, mask, tool version and reviewed neutral candidate hash. Its source is retained under `blender/characters/wardrobe/sources/`, preventing repeated corrective compilation from accumulating deformation on an already corrected artifact. Existing source rights/grant limitations remain explicit.

```sh
node scripts/character-assets/prepare-pilgrim-front-corrective.mjs
npm run prepare:human-shapes
npm run prepare:startup
```

The native compiler verifies geometry/bind/weights before publishing the immutable Human piece and switching its manifest. Two runs reproduce the same compressed artifact: `pilgrimTunic-3e3d45a4b03a.glb`, SHA-256 `3e3d45a4b03a6207ec0fa9b4d46cec50596816960c5cf19dc7aa71ca70bbf445`, **479,428 bytes** (348 fewer than the original); compile/verify/compress takes approximately **1.8 seconds** on this machine. Full/compact Human family gzip payloads are **672,999 / 315,468 bytes**, changes of +303 / +94 bytes. Existing default four starter artifacts remain byte-identical. Orc/Undead artifacts are unchanged. Future broader remote/catalogue integration remains M6 work.

The shape builder supports explicitly bounded `.cache` source/item auditions using the existing shape/hem pass; source/output/report guards reject escaping the isolated directory. The posed-fit diagnostic now includes Pilgrim, accepts scoped sources/outfits/times, labels metric revision 2 and writes new default output under `.cache`, preserving the original M007 baseline.

## Review and verification

Grok 4.6/high independently reviewed the initial producer and rejected the full transfer. Valid findings about whole-garment transfer, shape-relative metrics, sample counts and accessor hashing were addressed. Four paired **80-row** matrices retain baseline/full/lower-torso/front-only results, eight source clips × five times × two shape extremes. The metric compares shape with neutral in the same candidate, so it cannot accept candidate-vs-original fit: the front-only worst remains 19 exposed vertices, like baseline, despite closing the confirmed front patches. A garment triangle's unrelated index no longer causes a false skip in the self-occlusion test. Quick earlier four-time reports are retained separately and lack the later revision field; do not merge them into the revised matrix.

Reviewed live evidence uses real source playback and normal Havok movement: neutral, slender −0.95/height 0.90, stout +0.95/height 1.15; front/side/back; idle/run/jump/land/Fire Blast/Lava Ball. Each recorded source cycle covers its actual duration, followed by the fixed 0.48 s comparison. Outfit selection uses real DOM controls and asserts the displayed selections against committed equipment. Diagnostic source casts do not deal damage. Normal run/turn/jump checks retain Havok and zero recoveries. No runtime/GPU errors occurred.

Motion: Telegram **829**, matching returned 1280×720 dimensions and duration; [VE MP4](https://ve.sparkify.dev/wow-clone/ashen-reach/character-mmo/pilgrim-front-weights-2026-10-01.mp4), **116.733757 seconds**, square pixels, rotation 0. Direct browser playback, seeking/fullscreen, `video/mp4` and HTTP 206 pass. Telegram Web A on Edge was independently inspected: inline is 464×261 and expanded viewer is 1280×720, both `object-fit:contain` with natural 1280×720 video and correct proportions. Its fullscreen control did not enter document fullscreen through native or DOM input, so Telegram fullscreen remains unverified; desktop app/phone presentation is also unverified. The owned playback tab was closed and the user's existing tab was untouched. Earlier rejected full-transfer captures remain under `ve-capture/character-mmo/pilgrim-native-weights-2026-10-01/` and were not presented as successful correction.

All **145 character / 76 equipment tests** and sequential normal/Pages builds pass. Final built-preview performance is **195.3–232.8 FPS** across 15 runs: M1 Max, uncapped native Chromium WebGPU, 1280×720, seven enemies, five routes × three 12-second runs, no recording/compiler/other active game. Largest p99 interval **11.4 ms**, maximum **14.1 ms**, zero intervals >16.67 ms. This is a solo-character throughput result, not a per-frame 144 Hz guarantee or crowd-capacity result. The previous checkpoint's unexplained town slowdown remains recorded; it is not retroactively fixed by this result.

Fresh-process/profile compressed built-preview startup at 50 Mbit/s/40 ms retains all 40 rows: default **20/20 <=1 second**, p95 **841.8 ms**, maximum **847.5 ms**; largest saved mixed outfit with shoulders **20/20**, p95 **945.4 ms**, maximum **946.0 ms**. This uses the completed-GPU, grounded, dressed, input-ready boundary; OS/driver cache state is uncontrolled.

Spawn movement and cathedral entry/return pass at all four build/height endpoints with Havok and zero recovery teleports. Native touch/depth-bundle fallback and desktop WebKit both advance simulation and visible world, with zero runtime/GPU errors. Their actual portrait captures were inspected. These are desktop mobile emulation, not physical iPhone acceptance. Physical-phone startup, public presence hosting, wider fit domains and first-use GPU tails remain pending.

[Retained baseline evidence](../../../baselines/character-mmo/pilgrim-front-corrective-2026-10-01/) includes all frame/startup rows, paired matrices, bind verification, reviewed motion manifest, Grok review, movement, mobile/WebKit and sanitized playback dimensions. Production is unchanged.

## Continue

Complete M6's two actual new outfit designs, per-piece/race fits, mixed boundaries and remote preparation. Use this correction as evidence that native transfer needs authored masks; do not apply it indiscriminately to hanging cloth or armor. Human/Undead unified bodies still cannot hide covered torso regions without also hiding exposed face/hands; their semantic resolver reports this limitation. A future body-region split must preserve the source palette, curves, morph correspondence and union of original triangles, and pass startup/FPS gates. Geometry/coverage authoring remains necessary for residual breaches and the M5 new head/hood family.
