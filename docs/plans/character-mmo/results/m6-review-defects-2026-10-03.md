# Three defects found by review, and what measurement says about each

**2026-10-03.** Game source `8ae4c2d`. Reported from gameplay screenshots; reproduced here at a
pinned camera and, where possible, measured rather than argued about.

My own milestone 6 review missed all three. The design matrix looked at 45 stills cropped to the
torso and silhouette, and the 4,320-combination sweeps asserted coverage and continuity — none of
which looks at a hand, a sole, or the gap between a foot and the ground. **A framing that cannot
show a defect is not evidence that it is absent**, and the review gates are recorded as having
that blind spot.

## 1. The character floats, and the float grows as you walk — fixed

**Two statements in the first version of this document were wrong and are corrected here.**

The first version reported a **constant 102.7 mm offset**, measured by dropping the capsule from
1.5 m at a 121-point grid and comparing against `height(x, z)`. Both choices inflated it: a
dropped capsule keeps residual clearance, and a fresh walk immediately afterwards measured
**8.7 mm**. The figure was an artefact of the method.

The real behaviour is a **ratchet during locomotion**. Walking out from spawn along a fixed
turning route, the gap to the terrain grows and never sheds:

| leg | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| gap (mm) | 33 | 61 | 96 | 131 | 109 | 145 | 141 | 113 | 143 | 129 |

It plateaus near 145 mm, which is where `checkSupport` finally stops reporting SUPPORTED and
gravity takes over again. Placed exactly on the ground the capsule stays there (gap ≈ 0), so the
collision surface and the heightfield agree — nothing was ever pulling the capsule back down.

**Cause.** A grounded frame sets vertical velocity from the support slope alone:

```js
state.vy = surfaceVerticalSpeed(velocity.x, velocity.z, support?.averageSurfaceNormal, …);
```

which is zero when standing still, and gravity is applied only in the `else` branch, when not
grounded. `checkSupport` reports SUPPORTED while the surface is merely within its probe
distance, so a hovering capsule counts as grounded and holds its altitude indefinitely.

**The fix is positional, not a velocity.** A downward velocity bias was tried first and did
nothing: Havok projects velocity onto the support plane while SUPPORTED, so the term was
cancelled before it moved anything — `vy` read −0.9 while the gap stayed at 82–137 mm. The
correction instead moves the capsule down, bounded, and only where its bottom is clearly above
`groundHeight(x, z)`, so standing on a path slab, a step or a prop — all legitimately above that
function — is left alone. The solver resolves the contact, so it can only remove clearance.

| | before | after |
| --- | --- | --- |
| median gap over the route | 128.7 mm | **16.6 mm** |
| max | 145.0 mm | **26.1 mm** |
| accumulation over distance | yes | **none** |
| standing jitter (peak-to-peak) | — | **0.00000 m** |

Traversal passes with zero recoveries, including the cathedral entry and return at both shape
endpoints; 157 character / 106 equipment / 4 player-physics tests and the build pass. Reviewed
live motion is Telegram **844**.

[Measurement](../../../../scripts/character-assets/measure-ground-contact.mjs) ·
[recorder](../../../../scripts/character-assets/record-ground-contact.mjs). The grid baseline is
retained as the record of the method that misled me, not as the characterisation.

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

## 2. The soles read as too bulky — **not** a consequence of 1, as I first claimed

The first version of this document said the bulky sole was largely downstream of the float, and
that closing the gap would make the same geometry read differently. **That is wrong.** With the
fix in place and the gap at 18 mm, the sole's underside is still visible as a flat orange plate,
and the sole still oversails the upper on every side.

It is an asset question: the sole is a separate, wider slab in a different material from the
boot shell. Open, and unaffected by the grounding fix.

## 3. Speckled artifacts along the boot seam — reproduced, cause not yet measured

Scattered bright single pixels run along the instep and ankle line. Reproduced at a pinned camera
with a frozen pose, and present on **both** `wayfarerBoots` and `duskguardGreaves` in the same
place — so it is not one asset's seam. **Unchanged by the grounding fix**, so it is independent
of it.

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

---

## Update, same day — the grip investigated and a fix identified but not shipped

**Measured.** Perpendicular distance from each posed finger joint to the weapon's own grip axis,
at a frozen idle, selecting the handle part by smallest cross-section and requiring it to be the
*visible* mesh of the equipped item.
[Data](../../../baselines/character-mmo/m6/weapon-grip.json) ·
[measurement](../../../../scripts/character-assets/measure-weapon-grip.mjs).

For the Human with `ironSword` against a grip of radius **19 mm**:

| joint | Index | Middle | Ring | Pinky | Thumb |
| --- | --- | --- | --- | --- | --- |
| segment 1 | 34.0 | 37.6 | 36.8 | 33.2 | 69.7 |
| segment 2 | 25.2 | 23.1 | 14.4 | 11.1 | 47.3 |
| segment 3 (tip) | **15.2** | **22.4** | **15.1** | **17.7** | **23.5** |

All distances in mm. **This rules out the obvious explanation**: the fingertips sit within a few
millimetres of a 19 mm grip surface, and so does the thumb tip. The weapon is not placed away
from the hand.

**What is actually wrong** is visible once the camera is close enough: the hilt reads as passing
*across* the hand, with the crossguard standing about a fist's width clear of the knuckles — the
hand grips the lower part of the handle and leaves bare grip showing above it.

**Two experiments.**

1. *Tighter fingers.* Raising `hand-grip.js` closure from `shaft: [.58, .72, .60]` to
   `[.80, .92, .86]` (thumb `[.8,.5,.3]` to `[.85,.80,.62]`) produced **no visible change** at a
   close framing. Reverted.
2. *Sliding the weapon along its own axis.* Nudging the prop by +30, +60 and −30 mm, **+60 mm
   seats the crossguard directly on the fist** and brings the pommel in behind it. Confirmed
   against the unmodified build at an identical camera. That is a one-line catalogue change:
   `ironSword.gripPosition` y from `-.080` to `-.020`, and the Orc override `-.092` to `-.032`.

**It is not shipped, and the reason matters.** The catalogue is sealed twice. The appearance
fixture records a sha256 of `equipment-catalog.js`, and the Vite build refuses outright — *Stale
Human family: src/ashen-reach/equipment-catalog.js. Run npm run prepare:human-shapes* — because
the catalogue is an input to the **prepared, published** Human shape family. Shipping a 60 mm
grip tweak therefore means regenerating `public/ashen-reach/human-shape-v1/` in full: body and
garment GLBs rebuilt, meshopt re-encoded, compact textures repacked. That is a release-shaped
operation on protected production assets, and disproportionate to the change, so it waits for a
decision rather than being done unilaterally.

**Still not explained** even with the fix applied: the hand does not read as *wrapping* the grip,
only as being adjacent to it with the crossguard now seated. That is the hand's rotation relative
to the grip rather than its position, and it is art judgement, not a measurement.
