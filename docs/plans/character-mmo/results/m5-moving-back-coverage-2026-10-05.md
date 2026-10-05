# M5 saved Human back coverage

**Local correction verified and delivered; M5 remains open and unreleased.** The light upper-back patch in Telegram 857 is exposed body
geometry during normal sprint. The corrected publisher moves 32 original back
triangles into the existing torso geoset on each saved identity. No vertex,
animation, texture or runtime deformation change is needed.

## Reproduction and decision

The actual saved recipe in the clip is Prime ponytail, **tall/stout** (height
1.15, build +0.95), Pilgrim tunic over Graveweaver skirt, Wayfarer boots,
Graveweaver gloves, one-handed staff/book and Warden shoulders. It is not the
tall/slender example. Ordinary W input plays native `Sprint_Loop`; there is no
two-handed carry overlay for this staff. Static walk controls therefore sampled
the wrong pose.

Freeze the reproduced native sprint at 0.58 seconds and retain its actual skin
palette. Hiding hair or gloves leaves the patch; hiding `HumanV1Body` removes
it. Native detailed GPU picking identifies five body faces (2203, 2205, 2207,
2214 and 2216 in this Prime asset). The body-hide comparison changes 149 pixels
in the measured back region. Native CPU ray picking only returns the bounding
box here and cannot identify the surface triangle.

[Lite's native picking documentation](https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/docs/lite/architecture/18-picking.md)
supports the diagnostic. Picking and frozen-pose controls remain in the owned
test context; none is added to gameplay.

The picked vertices are inside the measured torso interval but carry only
0.596–0.972 torso influence because their source shoulder/arm weights also
contribute. The old 98% torso threshold leaves these faces exposed. Influence
weights are not anatomical region labels.

## Narrow index repair and preservation

Keep the old strict core and collar/waist bounds. Add an all-vertex back region
with torso influence over 50%, inside the closer upper-arm root minus 25 mm,
and behind the hips by 20 mm, all scaled to the actual mesh-space rig. The
initial central slab added 99 triangles and also changed front coverage; it
was rejected after Grok review. The final back-only policy adds **32**.

The helper restores the old exposed/core **index union**, then reuses
`partitionCoverageMesh`. Original position, normal, UV, skin and morph
accessors remain shared. The publisher verifies the old partition against the
pinned unsplit painted source, normalizes the same canonical bind, verifies
the written repair independently, and checks separate eyes, brows and ponytail
geometry before native animation compaction. Accepted source pins stay intact.

| Identity | Original body triangles | Hidden core before / after | Compact encoded body bytes |
| --- | ---: | ---: | ---: |
| Prime bald | 13,086 | 414 / 446 | 815,709 |
| Prime ponytail | 13,086 | 414 / 446 | 1,115,445 |
| Weathered bald | 13,206 | 414 / 446 | 820,934 |

Every written original triangle occurs exactly once with its winding intact;
attributes, morphs, 65-joint skin, mesh frames and all 57 source animations
match the independent reference. Compact bodies retain the same 22 native
playable clips. Removing torso clothing draws both body geosets, restoring
the complete body.

New bodies and per-identity manifests have new content-addressed URLs. The
existing adapter revision still describes the same mesh names and coverage
semantics. The separate `human-medial-back-v1` receipt records the changed
partition. Recursive compiler provenance includes the repair helper, and
publication refuses any count other than the reviewed 32 added triangles.

No new draw, native skin evaluation, custom mixer or geometry rebuild occurs
during play. The implementation uses
[glTF Transform primitives](https://gltf-transform.dev/modules/core/classes/Primitive)
and the existing [glTF skin/morph contract](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#meshes).
Code comments retain those links.

## Verification and delivery

- Character **205/205**, equipment **112/112**, and the native Pages staging
  build pass.
- The independent native candidate at the same reproduced pose has zero
  body-hide difference pixels and zero picked body faces in the measured back
  patch. Its reviewed whole live frame shows the tunic intact.
- Actual Pages staging verifies **513/513 served artifacts**, 20 identity and
  five region cache policies; the separate build seal contains 514 files
  including `_headers`.
- The ordinary-route pose matrix passes **3,150 live views**: three identities
  × five body cases × ten loadouts × seven sampled native motions × three
  angles, without interception. Actual UI selection, paused phase, root/morph
  values, gear/body visibility, storage, hair coverage, Havok and errors are
  asserted. Errors and recoveries are zero. This is seven sampled phases and
  ten loadouts, not every pose or mixed combination.
- Native Pages prefetch **10/10**, saved integration **8/8** (including actual
  UI, independent undo, failed/corrupt downloads, retry and cancellation), and
  mobile Chromium's **8/8**, depth fallback **8/8** and desktop WebKit **4/4**
  pass. Depth fallback's deliberately triggered probe error is handled; no
  unexpected runtime or GPU errors occur. These are desktop checks.

The parent reviewed matched close native captures and representative front/back/
side screenshot subsets, not all 3,150 images individually. The continuous final
Pages clip uses ordinary W input with Havok, traverses **70.43 m** and records
zero recovery teleports/errors. Diagnostic god mode protects from damage; it is
not flying or teleport traversal. The capture is **1280×720**, H.264, SAR **1:1**,
rotation **0**, **19.458259 s**, SHA-256
`edcd54cd0daf7bfba8f5d75a881590d46495b47bb08088b792fa6ca93f1463d2`.
The back remains covered through reviewed running frames.

Reviewed motion is Telegram **858** / [VE video/mp4](https://ve.sparkify.dev/wow-clone/ashen-reach/character-mmo/m5-back-coverage-2026-10-05-edcd54cd0daf.mp4).
Telegram returns the exact **1280×720** and rounded duration 20 s. Actual Web A
inline, expanded and full-window playback retain proportions through `contain`
letterboxing. Native OS fullscreen and Telegram Desktop remain unverified.
All four loaded Telegram videos are paused at the final media audit; the viewer
stays open because closing it can restart inline autoplay. VE returns HTTP 200
with exact bytes/hash and a correct 206 range; actual browser play and seek pass.
The owned VE tab is closed.

[Compact receipts and reviewed captures](../../../baselines/character-mmo/m5/moving-fit-2026-10-05/)
retain exact scope, build/HTTP seals, sampled matrix and media evidence.

These are local correctness and visual checks, not new startup/FPS acceptance.
The preceding startup-package cohorts remain dated evidence of their own
ordinary build; the repaired Pages build needs its final quiet-machine/public
gates after the remaining valid boot changes.

## Review disposition and continuation

Grok 4.6 / high independently reviewed the compiler and publisher, then
re-reviewed the narrowed policy. Its valid front-coverage concern produced the
back-only bound. Its numeric-gate concern produced the explicit 32-triangle
publisher assertion. The alleged bare-body hole and stable-adapter cache defect
were withdrawn on re-review. The named missing test path was a prompt typo:
the actual fixture is `scripts/test-identity-torso-coverage.mjs`; it passes.
Claims the reviewer did not execute remain parent-verified, not independent
test results.

The repair currently applies to the **three saved identity packs**. The shared
default Human compiler retains the older threshold and needs the same
reproduced-defect check in M6. Boot sole shape, inherited sampling speckles,
remaining mixed-loadout review and production acceptance stay explicit.
Telegram 857 documents the pre-fix observation; Telegram 858 delivers this
correction. The immediate order is the [focused 12-hour plan](../next-12-hours-2026-10-05.md). Physical iPhone, native OS fullscreen and Telegram Desktop
acceptance remain separate unverified states.
