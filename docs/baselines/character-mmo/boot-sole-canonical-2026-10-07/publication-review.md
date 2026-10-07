# Boot-sole local publication operator — independent review

2026-10-07. Read `scripts/character-assets/prepare-boot-sole.mjs`, `duskguard-armor.json` diff, `equipment-factory-contract` plan/execute, `publication-RlZYyq/` (including `publication.json`), `source-publication.log`, public Human/Undead packs, and packed readback of published greaves vs previous hashed plates and published soles. No rerun. Parent later reports five derived preparation commands exit 0; that is not this review’s acceptance of those stages.

## Verdict

No consequential defect in this operator or the Duskguard underlayer pin change for **local Human/Undead source packs**. Multi-step publication is not globally atomic; that is declared. This is not a sealed Pages release.

## What actually landed

`--publish` rebuilds soles twice under `.cache/character-mmo/boot-sole/publication-RlZYyq`; first/repeat bytes match (`84539c76…` 242712 B human, `d92d6e57…` 242372 B undead). `verifyFactoryEquipmentBind` + `assertAssetFit` run on those bytes. `executePublication(planPublication({id:'wayfarerBoots', mesh:'WayfarerBoots', …}))` writes hashed + canonical `.glb` then `equipment/manifest.json` / `equipment-undead/manifest.json` (temp+rename). Public canonical equals hashed equals the work-dir build.

`duskguard-armor.json` revision 2 pins those canonical hashes; Orc pin `800fc2b7…` is unchanged. `build-duskguard-armor.mjs human undead` then runs; report descriptor sha `a06ceccc…` matches the working-tree file. Operator captured **pre-publish** public greaves plates, asserts every plate semantic array equal, asserts `DuskguardBootUnderlayer` arrays equal the reviewed sole, meshopt-required rewrite, `EQUIPMENT_ITEMS.duskguardGreaves` mesh names, bind check, then a **second** `executePublication` of only Human/Undead greaves plus `boot-sole-provenance.json`.

Packed readback of `duskguardGreaves-1f6f014fb480.glb` / `117d0fc78bdb.glb` (canonical byte-identical): plate arrays exact vs previous hashed `ebcd55139ab6` / `65e92cf980bd`; underlayer arrays exact vs published soles; `EXT_meshopt_compression` required; 65 joints; meshes `DuskguardBootUnderlayer`, `DuskguardGreaves`. Log ends `localSourcePacksPublished:true`, `productionReleased:false`, remaining Human shapes / starter / coverage / identity / remote / live canonical / sealed release.

## Scope limits

A failure after the Wayfarer `executePublication` and before the greaves rename leaves new boots advertised and old greaves. Provenance records that. Coverage-v1 mtimes are later than the equipment manifests; this review did not verify shape, starter, coverage, identity, or remote artifacts. Orc packs were not in `races`. Live game and Pages seal remain parent-owned.
