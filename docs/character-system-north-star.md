# Character contracts and long-term direction

Current state: [CURRENT](CURRENT.md). Active vision: [100 milestones](plans/character-mmo/vision-roadmap.md), [next ten](plans/character-mmo/next-ten.md), [architecture](plans/character-mmo/architecture.md).

## Direction selected 2026-09-27

Support distinct Human appearances including tall/slender/young/long-haired and short/stout/old/bald adults; retain Human/Orc/Undead and enable a future Elf family. Target 30 mixable armor sets and repeatable quarterly content. Use authored/generated source art normalized into compatible templates, procedural fitting/assembly, and budgeted crowd representations. Hundreds/thousands present does not imply identical high detail or one full physics/animation controller per remote actor.

## Current boundary

The main route uses the actual source-compatible Human/Orc/Undead packs in `src/ashen-reach/main.js`, progressive starter assets, native Lite animation and Havok movement. Equipment fit IDs, coverage, occupancy and streaming already exist. Their exact current source/bind/shape inventory is M001's deliverable. Older MakeHuman-only descriptions and 163-joint diagnostic profiles are historical, not interchangeable with the current source-65 runtime assets.

A Human height/build creator and fitted morph candidates exist on an explicit developer route, with local persistence. Ordinary production play has no accepted body editing or crowd renderer yet. The next milestone publishes a bounded body family and one appearance recipe; later milestones add source identity art, real crowd integration and authoritative multiplayer. Do not treat native morph/baked-animation primitives as a complete wardrobe.

## Contracts to preserve

- One evaluated pose drives body and compatible garments. Validate joint order, rest hierarchy, inverse binds, mesh transforms and geometry fit; equal names/counts are insufficient.
- Soft garments use skinning/deformation. Weapons, shields and appropriate rigid armor use evaluated attachments. Do not parent a whole robe to a chest socket.
- Fit identity is semantic and versioned separately from source byte hashes or animation additions. Different races may reuse animation without sharing a literal bind or garment mesh.
- Body controls and equipped garments change coherently; height has camera/grip/foot/collision implications. Preserve current movement authority until a new physical contract is explicitly implemented and verified.
- Union body coverage over selected items, define seam/layer precedence, and reject unsupported fits. Hiding geometry must not expose holes at garment boundaries.
- Preserve authored animation curves, units and source provenance. Reuse native Lite features and existing upstream tools; do not substitute a procedural gait or arbitrary anatomy deformation.
- Appearance changes preserve pose continuity, ownership and cancellation/failure recovery. Shared GPU resources have explicit final-owner disposal.
- Exact nearby appearance and approximate distant representation are separate contracts. Resource and population limits must be measured with real varied outfits and body families.
- Tests prove contracts; reviewed live motion proves observable tailoring/contact within the tested matrix. Report limits honestly.

## Supporting evidence

[Source/asset provenance](complete/character-asset-provenance.md), [equipment authoring](ashen-equipment-authoring.md), [Orc pipeline](orc-sculpt-pipeline.md), and [historical armory plan](archive/plans/armory-and-equipment-plan.md) retain lineage. The [previous architecture document](archive/state/character-system-north-star-before-character-vision-2026-09-27.md) records earlier assumptions. Their historical milestone IDs do not refer to the new M001–M100 roadmap.
