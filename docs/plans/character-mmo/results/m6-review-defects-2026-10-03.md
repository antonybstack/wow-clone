# Three defects found by review, and what measurement says about each

**2026-10-03.** Game source `8ae4c2d`. Reported from gameplay screenshots; reproduced here at a
pinned camera and, where possible, measured rather than argued about.

My own milestone 6 review missed all three. The design matrix looked at 45 stills cropped to the
torso and silhouette, and the 4,320-combination sweeps asserted coverage and continuity — none of
which looks at a hand, a sole, or the gap between a foot and the ground. **A framing that cannot
show a defect is not evidence that it is absent**, and the review gates are recorded as having
that blind spot.

## 1. The character stands about 10 cm above the ground — measured

This is the largest finding and it is not about the boots.

The capsule reports `grounded: true` and rests on the Havok collision world. The grass and
terrain the player looks at are the visual heightfield. Those are two different surfaces.
Dropping the player at a 121-point grid over 60 × 60 m and letting physics settle:

| | gap (capsule bottom − visual terrain) |
| --- | --- |
| median | **102.7 mm** |
| p95 | 141.9 mm |
| max | 153.1 mm |
| min | −10.0 mm |
| points above 10 mm | **117 of 120** |
| points above 50 mm | **103 of 120** |

[Data](../../../baselines/character-mmo/m6/ground-contact.json) ·
[measurement](../../../../scripts/character-assets/measure-ground-contact.mjs).

It is region-wide, not a bad spot. Of the gap, **35 mm is deliberate**: `player.js` sets
`controller.keepDistance = 0.035` on the Havok character controller. The remaining ~68 mm is a
disagreement between the collision world the capsule rests on and the heightfield that is drawn.
The non-physics fallback path in the same file clamps to `groundHeight(x, z) + height/2`, which
would place the capsule exactly on the visual ground — so the two paths do not agree either.

**The garment assets are not at fault.** Posed offline with the existing LBS evaluator, in the
body's own space where the ground is y = 0:

| Clip | Body foot lowest | WayfarerBoots lowest | DuskguardGreaves lowest |
| --- | --- | --- | --- |
| Idle_Loop | +3.9 mm | **−14.3 mm** | +172.3 mm |
| Walk_Loop | −2.6 mm | −12.7 mm | +177.5 mm |
| Sprint_Loop | +34.1 mm | +24.1 mm | +216.2 mm |

[Data](../../../baselines/character-mmo/m6/foot-contact.json) ·
[measurement](../../../../scripts/character-assets/measure-foot-contact.mjs). The boot is authored
to sit 14 mm *into* the ground at idle. The float is entirely the runtime's.

## 2. The soles read as too bulky — largely a consequence of 1

With the character 10 cm up, the sole's **underside** is visible from an ordinary camera angle.
It is a flat plate in a different, redder material from the upper, and seen from below and edge-on
it reads as a thick slab. A planted foot would never show that face.

This is a judgement that the measurement supports rather than proves: close the 10 cm gap and the
same geometry will read differently. Whether the sole is still too large after that is an art
question that should be asked again afterwards, not before.

## 3. Speckled artifacts along the boot seam — reproduced, cause not yet measured

Scattered bright single pixels run along the instep and ankle line. Reproduced at a pinned camera
with a frozen pose, and present on **both** `wayfarerBoots` and `duskguardGreaves` in the same
place — so it is not one asset's seam.

What is established: the Human body is a single mesh that the coverage contract cannot partially
hide, so the body's foot is always drawn inside the boot; and `WayfarerBoots` is
`doubleSided: true` while the body is not. Two nearly coincident surfaces along that seam is the
expected cause of scattered bright pixels, but **this is a hypothesis, not a measurement** — the
exposed-vertex comparison between the posed foot and the boot shell has not been run.

One hypothesis was tested and **refuted**: that the reddish sole plate was the bare foot showing
through. A same-build control at an identical camera — boots on, boots off, bare legs, greaves —
shows the bare foot is skin-coloured and sits flat on the ground, while the sole slab is
boot-coloured. The sole is boot geometry.

## 4. The sword is held beside the hilt, not around it — reproduced, not measured

At close range the fingers curl into a generic fist while the grip and crossguard pass alongside
the hand rather than inside it. The weapon sits in the palm's vicinity rather than in its grasp.

The pieces involved are the catalogue's per-item `gripPosition` / `gripRotation` / `gripPose`,
the per-race overrides in `grips`, and the canned finger closure in
`src/character/runtime/source-hand-poses.json`. Which of those is wrong is not established; the
defect is reproduced and framed, no more.

## What changes in the review gates

* Every visual review from here frames hands and feet explicitly, at a crop where a finger and a
  sole are legible, not only torso and silhouette.
* Ground contact gets a numeric gate — capsule bottom against the visual heightfield — because no
  existing gate compared them, and a 10 cm error survived every one of them.
