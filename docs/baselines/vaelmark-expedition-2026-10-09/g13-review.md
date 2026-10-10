# G13 source review — west fixture, descent handoff, reliquary z327.7

**Parent adjudication:** Source review found no consequential clearance/slot/hinge defect. The case extends 2.5 cm beyond the smaller inner cap but remains within the broader solid trim cap; no walking or structural change is justified. Corrected the misleading compass word in the comment. Parent later proved a separate live lighting defect: the spotlight inside the opaque chapel housing shadows itself. Moving only its emission point 0.4 m down fixes the entrance pool at unchanged strength; actual rendered-geometry rays reproduce the old obstruction and pass after the change. That later correction was not reviewed independently by this worker. Native motion and final performance remain parent acceptance.

**Worker verdict: no consequential defect on the three questions.** Working-tree diffs are only `cathedral-exploration.js` and `cathedral-undercroft.js`. West chapel lamp moves to the undercroft lip with the same beam root and >1.9 m clearance. The undercroft descent lamp is unchanged and still covers the mid-flight after the chapel lamp leaves the 8 m range. The box translation keeps the native lid offset; it sits on the tomb, clear of aisles, 2.5 cm from the south end post and 2.5 cm past the inner cap’s south edge. That 2.5 cm miss is recorded under Q3; it does not block walking or the hinge.

No tests, browser, renderer, build, source edits, commit, deploy, or user message. Parent records motion and adjudicates. This report does not claim visual acceptance. A checkpoint was written after the first batched read.

`box()` in `geometry.js:182` treats size as full width (`±size/2` from center). Undercroft memorial `wall`/`box` extents match that convention: body z `329±2.2` lands on the end-post centers `326.8` and `331.2`.

## Questions

### 1. Moved west fixture: support and 1.9 m walking clearance

**Yes on the authored geometry.**

West (`side<0`) lamp: `[-14.4, fy+3.2, 330.5]`. East stays at z `335`. Glow box `[.28,.65,.28]`; stone beam from `[-12.8, fy+3, 330.5]` to the lamp, radius `0.13`. Same x/y and length as before (`√(1.6²+0.2²)=1.612` m); only z moves with both ends.

Opening `x∈[-16,-13]`, `z∈[330,348]`. Lamp x/z sits over the hole. Beam root x `-12.8` is `0.2` m east of the east lip (`x=-13`), on the slab. East jamb post `[-12.78, fy+1.45, 329.65]`, size `[.38,2.9,.62]`: top `fy+2.9`, north face `z=329.96`. Beam center is `0.1` m above that top and `0.54` m north of that face. Pointed doorway arch maps through `[stairX+u, fy+h, 329.65+d]` with height `2.9`. The original z `335` beam was the same cantilever from `x=-12.8` with no jamb nearby; z `330.5` is closer to the east post/arch, not farther from masonry.

Lowest visual: beam `fy+3-0.13=fy+2.87` (lamp bottom `fy+3.2-0.325=fy+2.875`). Chapel floor clearance `2.87` m. On the descent, surface y at z `330.5` is `fy-5.6×0.5/17=fy-0.165`; clearance `3.035` m. West chapel gallery stair is centered at `x=-18`, width `2.4` (`x∈[-19.2,-16.8]`); lamp at `x=-14.4` is `2.4` m east of that edge. Beam is `beam(stone,…)`, not `collisionBatch`. `stand`/`interact` and undercroft colliders are unchanged.

### 2. Original middle-descent lamp and two-slot handoff

**Yes on the slot contract and fixture positions.**

Undercroft lamps are unchanged: descent `[-14.5, fy-2.0, 342]`, turn `[-10.75, fy-2.1, 348.5]`, door `[-7, fy-2.1, 337]`, memorial `[-7, fy-2.1, 325]` (`y=fy-5.6`). Two slots (`LOCAL_LIGHT_COUNT=2`), downward spots, `range`/`localPosition.w=8`. `desiredLocalLights` uses world hypot including y when `position.y` is finite (`main.js` passes `player.body.position`). Attenuation is zero at d≥8.

Feet along `x=-14.5`, `y=fy-5.6×(z-330)/17`:

| z | chapel-west d | descent d | chapel in 8 m | descent in 8 m |
| --- | --- | --- | --- | --- |
| 330 (mouth) | 3.24 | 12.17 | yes | no |
| 334.1 | ~6.9 | ~7.93 | yes | yes |
| 336.5 | ~8.03 | 5.50 | edge | yes |
| 338.5 (mid) | 10.00 | 3.60 | no | yes |
| 347 (bottom) | — | 5.68; turn 4.80 | no | yes |

Chapel and descent overlap in-range for about `z=334–336.5`. After the chapel lamp drops out, descent remains inside 8 m through the bottom, with the turn lamp joining there. Crypt west wall at `x=-12`, `z=331±8.25` sits between the stair and the door lamp, so that door fixture is a poor mid-flight substitute.

Moving the lower descent lamp toward the mouth would leave the lower half to the turn lamp and the walled-off door lamp. Keeping descent at z `342` is what fills that span. Slot fade is the existing `advanceLocalSlots` step (`min(0.05,dt)×3`). Lamp count is unchanged (two chapel + four undercroft). This is not a lighting-budget change.

### 3. z327.7 box: cap, posts, aisles, native lid hinge

**Mostly yes.** Hinge offset, aisles, and post clearance hold. The case south face is `0.025` m past the inner cap.

Memorial (center + full size):

| piece | center | size | z span |
| --- | --- | --- | --- |
| body | `[-7,y+.32,329]` | `[2.5,.64,4.4]` | `[326.8, 331.2]` |
| trim cap | `[-7,y+.71,329]` | `[2.8,.14,4.7]` | `[326.65, 331.35]` |
| inner cap | `[-7,y+.84,329]` | `[2.1,.12,3.9]` | `[327.05, 330.95]` |
| south post | `[-7,y+.98,326.8]` | `[.45,.25,.4]` | `[326.6, 327.0]` (north face `327.0`) |
| north post | `[-7,y+.98,331.2]` | `[.45,.25,.4]` | `[331.0, 331.4]` |

`reliquaryBase` `[-7, y+.92, 327.7]`, `reliquaryHinge` `[-7, y+1.22, 328.375]`. Δ from base is `[0, 0.30, 0.675]`, identical to the previous `[329]` / `[329.675]` pair.

Case floor `casework.box([0,.025,0],[1.7,.05,1.35])` in base space: world z `327.7±0.675=[327.025, 328.375]`, x `[-7.85,-6.15]`. Inner cap x `[-8.05,-5.95]` contains that. Trim cap contains that. Inner-cap south `327.05`; case south `327.025`; **overhang `0.025` m**. South-post north face `327.0`; case south `327.025`; **gap `0.025` m**. North post is `2.625` m beyond the case.

Aisles: tomb x `[-8.25,-5.75]`; chamber inner faces near `x=-11.75` and `x=-2.25`; side passages stay ~3.5 m. South passage is the body/post at `326.8` versus the south wall inner face, not the box. The box is on the tomb, narrower than the body, and does not enter the walking lanes. `stand` `[-9.6,y,329]` and `interact` `[-8.65,y+1.15,329]` are unchanged.

Lid is parented to the hinge with identity TRS (`exploration-props.js:63`). Lid local center `[0,.0375,-.675]`, size `[1.74,.075,1.39]`: closed lid occupies hinge-local z `[-1.37, 0.02]`, i.e. south of the +z rim. `pose` is `rotationQuaternion.set(sin(θ/2),0,0,cos(θ/2))` about X, θ up to `1.35` rad — the same native open as G12, only translated `Δz=-1.3` with the base. `exploration-props.js` has no G13 diff.

Comment text says “offset toward the north end”; z `327.7` is toward the south post (`326.8`) and the south wall (`323`). Coordinate intent is the camera offset; the cardinal in the comment is wrong. Not filed as a product defect.

## Actionable issues

None at a severity that justifies a source change from this review. Parent owns live motion.

## Speculative (not filed)

- Inner-cap south overhang / post gap of `0.025` m (`reliquaryBase` z `327.7`). Case south `327.025` versus inner cap `327.05` and post north face `327.0`. Trim cap still contains the case (`326.65`). Collision metadata is unchanged; the box is not a walkable surface. If a flush inset is wanted: base z `327.73` and hinge z `328.405` (keep `Δz=0.675`).
- Slot stickiness (`-2` m) can keep the chapel lamp assigned for a short span after d>8, with zero energy from that slot. Existing fade; descent still in range.
- Open-lid vault clearance is the G12 pose translated `1.3` m south; not re-derived against the rib/arch equations.

## Checked

| File | What was read |
| --- | --- |
| `src/ashen-reach/cathedral-exploration.js` | Full. West `lampZ=330.5`; east `335`; beam/glow; chapel stair at `x=±18`. |
| `src/ashen-reach/cathedral-undercroft.js` | Full. Opening, posts, arch, memorial stack, four crypt lamps, reliquary metadata. |
| `src/ashen-reach/local-lights.js` | Two downward spots, range 8, `update(dt, position)`. No G13 diff. |
| `src/ashen-reach/local-light-shared.js` | `LOCAL_LIGHT_COUNT=2`, 3D `desiredLocalLights`, fade. No G13 diff. |
| `src/ashen-reach/exploration-props.js` | Reliquary case `1.35` m depth, lid local `-0.675`, hinge X quaternion. No G13 diff. |
| `src/ashen-reach/geometry.js:182` | `box` full-size convention. |
| `scripts/test-gothic-cathedral.mjs` | Grep only: 1.9 m headroom on chapel paths and undercroft route. |
| `scripts/test-local-lights.mjs` | Grep only: stacked chapel/crypt selection fixture. |
| G13 plan / execution note | Threshold/fixture intent; two shadow slots; memorial box hidden behind the actor. |

## Unchecked

- `wall()` / `arch()` / `beam()` bodies in `gothic-cathedral.js` (extents inferred from `box` and the memorial/post alignment).
- Full bodies of `test-gothic-cathedral.mjs` and `test-local-lights.mjs` (not executed).
- Other `world.localLights` (street, lych-gate) as slot competitors at the west lip.
- Nave arcade masonry at `x≈-12.8`, z `330.5` (beam root is on-slab in plan; vertical wall at that point unread).
- Capsule-center versus feet for slot distance (body y is center; overlap still exists).
- Runtime play, Havok, shadows through the crypt west wall, camera framing of the offset box.
- Lite `createSpotLight` / `createTransformNode` implementation bodies.

Optional chaining is not in this diff. Unparenthesized `reliquary?.snapshot().open` short-circuits; that G12 claim stays rejected.
