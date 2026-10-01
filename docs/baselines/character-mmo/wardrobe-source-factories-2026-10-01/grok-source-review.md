# Duskguard source review — bounded candidate only

Read-only adversarial review of factory scripts, `blender/characters/wardrobe/duskguard-armor.json`, `.cache/character-mmo/wardrobe-v1/duskguard/report.json`, assembled/shaped GLBs, and live audition stills in `ve-capture/character-mmo/duskguard-audition-v3-2026-10-01`. Requested frames: Human stout back fire, Human stout front run, Orc side run, Undead front lava. No browser, game, product edit, message, or agent.

**Verdict:** Safe to keep as an isolated `.cache` source candidate under temporary audition aliases. Bind, palette, mixed Human morph, material pins, and plate rigidity hold on the written files. This is a source-only checkpoint, not M6 completion, catalogue release, or AAA/MMO acceptance. Live stills show hollow open-band cuirass interiors, strongest on Orc side and Undead lava. If a compact Human family is ever built, rigid plate primitives must be stored full-detail.

## Confirmed issues

### 1 — Visual: open-ended hollow torso bands

`scripts/character-assets/author-duskguard-plates.py` builds each cuirass band as a convex hull, deletes faces with `|normal.z| > 0.75`, bisects to a height clip, then Solidifies. The written steel/brass primitives are `doubleSided: true`. The result is overlapping open shells whose inner faces read as dark cavities in motion.

Evidence:
- `orc-0-1-side-run.png`: large dark void at the rib/waist side between breastplate and fauld; the side of the torso is not a closed plate wall.
- `undead-0-1-front-lava.png`: dark triangular cavity in the overlapping fauld/waist, with the inner shell visible during the lava pose.
- `human-0.95-1.15-front-run.png`: the same recess at the stout waist, milder than Orc/Undead.

This is the authored envelope, not a 100× frame or palette failure. It is the main live visual limit of this candidate.

### 2 — Publication: mixed rigid plates must not be meshopt-simplified

Current candidate bytes are not simplified. Human raw vs shaped `graveweaverTop` keep 3776/211/714/516 vertices; assembled Human cuirass rigid counts stay 714+516. Factory assembly is `copyToDocument` + `unpartition` only.

`scripts/character-assets/prepare-production-human-shapes.mjs` still compact-simplifies every non-body item unless `EQUIPMENT_ITEMS[id].deformation === 'rigid-bone'`. Duskguard slots are mixed cloth+plate with per-primitive `deformation`. An item-level skip would not protect the plate primitives. Compact publication of this family has to keep rigid-bone primitives at full vertex/weight identity, the same constraint recorded for Warden pauldrons.

## Hypotheses (unconfirmed)

- Orc gussets (1100 native verts from every `Body*` mesh) may stack under-tunic/waist shells at the armpit. The Orc side void is explained by the open bands; extra gusset layers were not isolated.
- Stout cuirass hem `lostAfter: 11` may leave tiny uncovered body verts. Requested stout stills do not show a clear skin breach; the brown at the stout rear hip reads as trousers.
- Front-only greaves (Orc 30/36 source verts after Solidify) will keep reading as small shin caps. Design of `front_only=True`, not a bind defect.

## Mixed cloth/rigid Human morph

Audition shape pass uses per-primitive extras, not item-level `rigid`. Shaped Human top:

| primitive | verts | deformation | stout max Δ |
|---|---|---|---|
| undercoat | 3776 | soft-skin | 51.3 mm |
| gussets | 211 | soft-skin | 30.7 mm |
| steel plates | 714 | rigid-bone | 25.4 mm, 4 bones |
| brass rims | 516 | rigid-bone | 22.2 mm, 4 bones |

`measure-plate-rigidity.mjs` on those plate groups: every vertex weight-1 to one bone; stout/slender `worstDeviationMm` 0.0001 (pure similarity). Cloth takes `trackBodyShape` plus the hem pass; plates take per-bone `trackBodyRigid`. Live slender front run vs stout front/side/back run: plates resize with the belly, sleeves and dark wool gussets stay cloth, no shattered morph. Neutral factory artifacts correctly carry zero morphs; the Human audition copies carry two named targets.

## Checked and not raised

- Independent `verifyFactoryEquipmentBind` on all twelve assembled GLBs: 65 joints, `worstPaletteDelta: 0`, exact inverse bind, identity mesh world (column lengths 1, translation 0). Human and Orc cuirass joint names match the body; IBM max abs delta 0.
- Raw Blender gusset export still sits under the armature `0.01` parent; assembled files do not. The historical 100× palette is corrected on the written candidate.
- Rigid cuirass bones are the intended set: Spine2, Spine1, Spine, Hips. Tassets Left/RightUpLeg, greaves Left/RightLeg, vambraces Left/RightForeArm.
- Soft gussets exist (Human 211, wool `metallic: 0` / `roughness: 0.95`) and show as dark underarm fabric on stout side run and stout back fire.
- Material pins match descriptor revision 1 on written steel, brass, and wool (float32 rounding only).
- Blender 5.2.1 LTS logs: only `Warning: No mesh data to join` on the single-object gusset join. No 4-influence / stronger export warning. `export_all_influences=False` is set; plates are one influence.
- Descriptor sha256 `659a3ebe52140d44a63a9e73dbaa73f9fd55e1201cda9612eb26dbb02c580068` matches the report. Status remains `candidate-only; not advertised`. Audition aliases are labeled in the live view.
- Capture report: `runtimePassed: true`, `errors: []`, `visualAcceptance: requires parent review`.

## Bounds of this verdict

Isolated wardrobe-v1 candidate plus temporary Graveweaver/Wayfarer aliases. Three accepted bodies, Human slender/stout at the captured endpoints, stills not a motion clip. Not a catalogue identity, not a compact-startup artifact, not remote/streaming, not FPS, not M6 factory completion.
