# Ashen Reach clothing: live system and why Orc clothes fail

Saved from the 2026-09-19 explore pass. Game code was not changed.

## What shipped

Two packs, one logical catalogue. Human: MHCLO on hm08, six coverage partitions, streamed GLBs. Orc: print-sculpt `OrcV1Body` (one surface) plus shrink-fit of the same eight Human garments. Runtime: `equipment-stream.js` borrows the 65-joint GPU palette. FPS: 144 at 960×540, 46 draws dressed.

## Orc fitter (`fit-orc-sculpt-clothes.py`)

Uniform scale **2.10 / 1.80 = 1.1667**, then BVH push-off if signed distance < offset (boots 1.0 cm, gloves 8 mm). Human mixamorig weights reused. **Does not** grade per limb, enclose foot volume, lengthen gloves, or hide `OrcV1Body`.

Human WayfarerBoots rest Y −0.010…0.360 m; after scale the pair tops out ~0.42 m. Human GraveweaverGloves span **9.2 cm**; after scale+push ~16 cm at the wrist.

`packVisibility` only maps `OrcV1Hair←HumanHair` and `OrcV1Shorts←BodyUnderLegs`. `OrcV1Body` is always drawn. Boots/gloves/tunic cannot hide skin.

## Screenshot mapping

| Shot | Cause |
| --- | --- |
| Toes out of boot | Human last × 1.17; push-off does not grow leather around a larger foot |
| Calf uncovered | Human boot Y-max 0.36 m; print calf continues above that; no `BodyUnderBoots` |
| Glove as thin sleeve | Toigo short glove 9.2 cm; no `BodyHands` hide |

MHCLO cannot map print topology: barycentrics and helpers are hm08 vertex ids. Print-sculpt has no those indices.

## Lite-legal next step

Offline per-item GLBs that already cover print rest (limb-aware wrap or sculpt), identity 65-joint bind, then geoset-split `OrcV1Body` so covered skin is not drawn. Do not add a runtime wrap solver, second skeleton, or MHCLO-on-print.
