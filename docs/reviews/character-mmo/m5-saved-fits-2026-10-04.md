# M5 saved-route outfit/shape fits — independent source review

Date: 2026-10-04. Reviewer: Grok 4.6 / high, read-only. Cwd `/Users/antbly/dev/wow-clone`. Scope: `ASHEN_IDENTITY_SAVED` ordinary-root mode in `scripts/character-assets/check-human-identity-current-fits.mjs`, `src/character/appearance/human-identity.js`, `scripts/character-assets/build-human-identity-source.py` hair block 320–352, selected pack compiler/coverage as needed. No browser, game page, renderer, agents, Telegram, deployment, reset/stash/clean, or product edits. Unrelated native WoW is rendering; no FPS or load-time claim. Parent owns CDP 10037 / Vite 5873 / preview 7174. Preserve unrelated `AGENTS.md` and `__pycache__`.

Parent reports a 630-view pilot with no harness errors and is adding actual actor height/shape weights plus an inverted hair-visibility control before the final matrix. Green assertions and that pilot are not visual acceptance. Stills at paused idle are not a motion pass.

## Verdict

The saved seed and first-play compact URL can distinguish the three selected identities at boot. Two harness gaps can still accept the wrong **shape** or **hair visibility** after that boot. Authored ponytail weights are native glTF skin influences (Head / Neck / Spine2); there is no morph copy on that hair mesh in the source block. Do not add a runtime cloth system. Native Lite 1.31.1 glTF skin/morph ownership should stay as it is.

## Confirmed defects

### 1. Shape evidence reads bookkeeping weights, not the actor

- **File:** `scripts/character-assets/check-human-identity-current-fits.mjs:39`, `:91`, `:105–106`
- **What:** Snapshot uses `ASHEN.player.heightScale` and `ASHEN.humanShape?.weights`. Rows then require those to match the requested build/height. `ASHEN.creator.set('build'|'height')` goes through `applyProductionBody` (`src/ashen-reach/main.js:667–708`). When `humanFamilyReady` is already true, that path only calls `setHumanShapeLive` and `rememberAppearance`. Recipe `shape` / `components` can match while native morph influences and root scale stay at boot (neutral).
- **Why it matters:** The matrix is five released Human shapes. A silent no-op on the mesh would photograph the same body five times and still pass.
- **Minimal fix:** After each `creator.set`, read the live morph target weights on `HumanV1Body` (and capsule/root scale for height) and assert those. Parent follow-up named this; it is required before the final matrix is evidence.

### 2. Bald rows never forbid a visible ponytail

- **File:** `scripts/character-assets/check-human-identity-current-fits.mjs:77`, `:112–114`
- **What:** First play requires `HumanPonytail01` only for `prime-ponytail`. Later rows assert hide/restore only when `hasPonytail` is true (`label==='young-hair'` or `preset.id==='prime-ponytail'`). Weathered/prime bald can show `HumanPonytail01` after `setLoadout` and the row still passes. First-play seed is Wayfarer (`defaultAppearance()`), so the boot ponytail check is not hood-covered.
- **Why it matters:** Hair policy is the difference between the three selected identities. An inverted control (bald must stay bald; ponytail must hide iff `covers` includes `head.scalp`) is the missing half.
- **Minimal fix:** For every saved row, `visible.includes('HumanPonytail01') === (preset.id==='prime-ponytail' && !coversHair)`. Parent follow-up named this; land it before treating hide/restore as tested.

## Authored hair, materials, shoulders

### Weighting (source, rest pose)

`build-human-identity-source.py:335–346` is centimetres (`fit_scale = 100`, eye landmark `z=165.5`, neck cut `150`). Cap `z >= 160` is 100% `mixamorig:Head`. Below that, `phase = (160-z)/(160-bottom)` blends Head→Neck then Neck→`mixamorig:Spine2`. At most two positive influences, so glTF four-joint skins (`export_all_influences=False`) are enough. Weights are authored glTF skins ([Khronos skins](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#skins)); no runtime hair sim.

Neck weld is 150–151 cm. Any cap vertices in `(150, 160)` receive Neck. Rest-pose stills cannot show nape slide. Vertex occupancy in that band was not dumped.

The same block does not create or copy `slender`/`stout` morphs onto `HumanPonytail01`. Body keeps the M004 targets. If the published pack does not add them later, shape-extreme stills keep a bind-pose tail on a morphed scalp. That later pack step was not inspected.

### Tie / material

One `IdentityLongHair` PBR, `ponytail01_diffuse.png`, alpha clip 0.12, rough 0.72, specular 0.18, double-sided, export mask (`:348–350`). No separate tie mesh or material. Tie is atlas paint only. The PNG/mhclo were not opened.

### Shoulders

`EQUIPMENT_PRESETS` has seven keys including `revenant`. Saved outfits are `bare` + those seven + `mixed-hood` + `mixed-open`. `duskguard` and `mixed-hood` wear `wardenPauldrons`. Identity prepare clones published clothing except `body` and `graveweaverHood` (`prepare-production-human-identities.mjs:81`, `:118–119`), so pauldrons are the released Human-shape fits. Snapshot visible names are only `HumanV1Body`, `HumanTorsoCore`, `HumanIdentityEyes`, `HumanIdentityBrows`, `HumanPonytail01`. `state.equipment === loadout` does not prove `WardenPauldrons` is drawn. Coverage `bodySegments` is recorded and never compared to the loadout.

## Saved-route identity (what already holds)

Default labels `old` / `young` / `young-hair` map uniquely to `weathered-bald`, `prime-bald`, `prime-ponytail` (`human-identity.js:12–16`; `young-hair` is a different `sourceLabel` than `young`). Seed is `validateAppearance({...defaultAppearance(), components: preset.components})` with empty search (`:26`, `:51`). First play requires that identity’s `compactItems.body.url`, forbids `items.body.url`, requires eyes/brows, and requires the 22 playable clip names.

`applyProductionBody` on a cold `!humanFamilyReady` actor loads `preloadHumanShapePack` (starter family, `main.js:674–694`) while keeping recipe `components`. For these three presets the later `HumanIdentityEyes` assert would fail that swap. It is loud, not silent, **if** those asserts run.

Armory reopen after `setLoadout` (`:96–99`) is the right fix for the stale-controls pilot. Photographed `#armory [data-equipment]` must match the loadout.

## Limitations (not defects in this slice)

- 630 views match the script: 3 identities × 5 shapes × 10 outfits × 3 full-body angles = 450, plus head-and-shoulders only on `neutral` / `tall-slender` / `tall-stout` (3 × 3 × 10 × 2 = 180). `short-stout` and `short-slender` have no detail stills. `short-stout` is the historical hood/scalp worst case; this is a coverage limit, not a silent wrong-preset bug.
- Starter (`components: {}`) is not in the three selected identities.
- Inspection is paused idle at seek 0. No motion, no exhaustive mixed-loadout, no dye matrix.
- Revenant is hood+top+skirt only; that is the catalogue preset.

## Uninspected

- Published identity GLB morphs on `HumanPonytail01` after `prepare-human-identity-review` / paint / `prepare-production-human-identities`.
- Ponytail vertex z histogram vs the 160 cm cap floor.
- `ponytail01` atlas/mhclo tie islands.
- `equipment-stream` compact vs `fullManifest` piece fetch for `wardenPauldrons` and Duskguard.
- `setHumanShapeLive` / `installShapeWriters` writing the same values the snapshot reads.
- Live 630 PNGs as pictures. `report.json` was not used as visual pass.
- `applyProductionIdentity` live path (out of this harness).

## Native ownership

Keep Lite 1.31.1 packed morph accessors and copied source skins (`prepare-production-human-identities.mjs:69–71`, `:62`, `:85`). Hair stays glTF skin weights. No bespoke cloth runtime.

No FPS, cold-start, or production-identity acceptance from this review.

## Parent disposition and final evidence

The six-turn reviewer pass and two-turn report continuation hit their caps; the
report exists, but the uninspected list above remains meaningful. No live reviewer
instance was launched. Parent checked the omitted implementation rather than
accepting the suggestions as game defects:

- **Valid harness gaps, corrected:** final snapshots read native rendered root
  scale and each visible body's/garment's actual morph weights, not only creator
  bookkeeping. Every later bald row forbids the ponytail. Actual published body
  geosets are compared with the existing semantic resolver, and authored garment
  parts (including pauldrons and cuff exclusions) must really be drawn.
- **No confirmed gameplay no-op:** `main.js` `setHumanShapeLive` calls the bound
  native writer recursively, updates the visual root and Havok height owner. The
  final 630-view run verifies the actual mesh/root values at every full-body view.
- **Hair morphs already exist:** `assemble-human-identity-source.mjs:37–74` adds
  ordered slender/stout targets to `HumanPonytail01`, eyes and brows using the same
  measured native field. The publisher preserves these; the final visible hair
  weights are checked against the requested values. Do not introduce another
  morph or cloth implementation.
- **Tie description corrected:** the licensed proxy and its single atlas/material
  contain the tie. No separately named tie mesh, accessory or colour channel is
  published. The review did not inspect the source geometry/atlas closely enough
  to establish that the tie is paint alone, so that stronger claim is not adopted.
- **Scope limits retained:** the 630 captures are 450 full-body and 180 independent
  head/shoulder views. Short-body rows have full silhouettes; the same maximum
  build has separate head views at tall-stout. They are not a complete motion,
  mixed-loadout, dye, original-starter, device or performance matrix. Motion and
  delivery evidence are in the accompanying result; no static green gate closes
  M5's remaining release requirements.
