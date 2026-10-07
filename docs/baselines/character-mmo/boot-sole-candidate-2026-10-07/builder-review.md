# Boot-sole builder — independent review

2026-10-07. Read-only: `scripts/character-assets/build-boot-sole.mjs`, `blender/characters/wardrobe/boot-sole.json`, the two pinned fit masters plus authored catalogue pin, and `reproduction-proof.json`. No builder rerun, browser, or product write. Foot geoset compiler is out of scope.

## Verdict

No consequential defect in this candidate-only generator on its pinned inputs. Offline-only; no runtime fitter. Publication and live MP4 acceptance remain parent-owned. Descriptor `status` is `candidate; live acceptance and publication pending`.

## Pins and proof

Descriptor sha `ec033fdc…` matches the reproduced report. All five pins hash-match:

- authored `blender/characters/sources/human-catalogue/wayfarerBoots.glb` `0f4091ff…`
- human boots `a55a9e4c…` / body `585f916e…` (`HumanV1Body`)
- undead boots `ce99e04c…` / body `0564b7b3…` (`UndeadV1Body`)

`reproduction-proof.json`: human 242712 B, undead 242372 B. `reproduced-sole` vs `reproduced-sole-repeat` are byte-identical (`84539c76…` / `d92d6e57…`) → `pinnedHostByteRepeat` holds on this host. Live `candidate/*/wayfarerBoots.glb` containers differ (242676 / 242336; live extras empty, repro has `deformation:'soft-skin'`). Decoded POSITION/NORMAL/TEXCOORD_0/JOINTS_0/WEIGHTS_0/indices are `===` for both races → `liveGeometryAndAttributesExact` holds. Texture PNG 85131 B sha `feb2ba6d8d36` unchanged.

## What the builder actually does

Writes only under `.cache` (`path.relative` must stay inside). One mesh `WayfarerBoots`, one primitive, no animations. Left/right by authored `x>0` / `x<0`; height from that side’s authored floor, body floor (`x` same sign and `y<0.12` on primitive 0), `belowFootM` 0.006, `authoredHeightScale` 1.2, smoothstep fade `0.018→0.025`. XZ frozen; verts with authored `y>=0.025` frozen. Normals replaced with `vertexNormals` (exact match on live/repro, zero zero-normals). Skin/inverse-bind/joint order untouched; `verifyFactoryEquipmentBind` reports 65 joints, `worstPaletteDelta` 0, `inverseBindExact`.

Pinned geometry: 3530 verts / 6320 tris; indices, UVs, joints, and weights identical across catalogue and both fits; **zero** `x===0` verts (1765 per side); both bodies one primitive, no morphs. Authored Y bands: 670 full / 105 fade / 2755 upper. Human floors −6.9e-6 / −2.3e-7; Undead 2.9e-7 / 6.6e-6.

## Pinned-input assumptions (not general-purpose)

x-sign sides, first body primitive, and `y<0.12` foot band are valid on these masters (body ymin is the chosen floor). They are not a general mesh fitter. Human shape morphs and Duskguard copies stay with their compilers. Orc is outside the descriptor. Host meshopt container bytes are proven repeatable here; live vs repro containers are not byte-identical.
