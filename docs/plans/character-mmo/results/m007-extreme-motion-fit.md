# M007 — mixed-outfit fit at body extremes, under motion

Status: **measured and visually confirmed clean.** This closes the extreme-motion half of
M007's fit gate. The mixed-fit matrix at neutral was already covered by the
[close-fit follow-up](m007-close-fit-and-orc-wrist.md).

Reviewed clip: Telegram 812 (1280x720, 17.53 s, verified).

## Why a new measurement

Every fit metric in this repo measured the **rest pose**.
`measure-shape-garment-fit.mjs` says so in its own header: a clean rest-pose result would
not prove a clean walk cycle. M007's remaining gate is fit under motion at body extremes,
and judging that from video frames is a visual call, not a measurement.

`scripts/character-assets/pose-skin.mjs` samples the actual glTF animation channels
(STEP/LINEAR/CUBICSPLINE, slerped rotations) and does linear blend skinning per the
specification. `measure-posed-garment-fit.mjs` uses it to pose body and garments through the
real clips and run the existing coverage classification at sampled instants.

Two things make the result trustworthy rather than merely new:

1. **Bind-pose residual 1.19e-7 m.** Skinning at the bind pose must reproduce the mesh
   exactly, because `globalJointTransform * inverseBindMatrix` is the identity there. Any
   error in the hierarchy walk, joint order or matrix convention would show up here instead
   of as a plausible-looking wrong answer downstream. The check runs before every
   measurement.
2. **It reproduces the accepted rest-pose numbers.** At the unanimated bind pose it reports
   14 newly uncovered with a 42.5 mm worst gap, against M005's accepted 14 and 42.46 mm.

The control is the **neutral body in the same pose at the same instant**, not the rest pose.
A crouch exposes the small of the back on any body; only the difference against neutral at
that instant is something the shape broke. Both body and garments carry the same shape
weights, as the runtime always applies one weight vector to both.

## Four corrections the raw number needed

The raw "newly uncovered" count peaks at **45** across the matrix and is mostly artifact. Each
correction below was forced by evidence, not chosen for a nicer number.

| # | Finding | Effect |
|---|---|---|
| 1 | The refitted garments carry **no animation at all** — at runtime they hang on the body's skeleton. Posing each with its own unanimated nodes left the cloth at rest while the body moved. | `coveredByGarment` 567 → 2040; counts roughly halved |
| 2 | Body vertices cross a garment hem as the torso turns. The exchange is near-symmetric: across 600 rows the mean of `newlyUncovered - newlyCovered` is **-3.0**, i.e. slightly more skin goes *under* the cloth than comes out. | ~20% of the count |
| 3 | Coverage along the 60 mm vertex normal is **not** visibility. The Graveweaver skirt flares, so a hip vertex fails the ray while sitting behind cloth from every direction. On the worst stout row, 113 flagged and **109 hidden from all eight directions**. | order of magnitude |
| 4 | With no gloves or helmet equipped, hands and head are bare in *every* configuration and can never be something a shape broke. They register only because the 60 mm ray reaches a trouser leg next to a hanging hand on one body and not the other. On the worst slender row this was **the entire result**: all 80 flagged vertices were skinned by `mixamorig:*Hand*` and finger joints. | 1,249 of 3,274 vertices excluded |

Correction 3 is the third metric in this lineage to fail that way; the header of
`measure-shape-garment-fit.mjs` records the first two.

## Result

600 rows: 4 outfits × slender/stout × 15 clips × 5 samples per clip.

| outfit / shape | worst exposed | at | raw newly-uncovered peak |
|---|---|---|---|
| wayfarer / slender | 3 | Jump_Start@0.333s | 10 |
| wayfarer / stout | 20 | Jump_Land@0.317s | 43 |
| graveweaver / slender | 5 | Crouch_Fwd_Loop@0.5s | 27 |
| graveweaver / stout | 9 | FireBlast_Upper@0.35s | 40 |
| mixed-top-wayfarer / slender | 5 | Crouch_Idle_Loop@0s | 22 |
| mixed-top-wayfarer / stout | 8 | FireBlast_Upper@0.7s | 45 |
| mixed-top-graveweaver / slender | 4 | Roll@0s | 12 |
| **mixed-top-graveweaver / stout** | **24** | **Sword_Attack@0.383s** | 45 |

Worst overall: **24 of 3,274 body vertices**, stout, Graveweaver top over Wayfarer trousers,
mid sword swing. `exposedToCamera` is zero in **240 of 600** rows and averages 3.13.

## Visual confirmation

The numeric peak was driven in the live game rather than assumed: stout 0.95 with that exact
outfit, through orbit, walk, hard turns both ways (which is what plays `Turn90_L`/`Turn90_R`),
sprint, jump, land, cast, then a drawn sword and four swings. Inspected at 2× on the hip and
upper thigh — the region the measurement names, via the dominant skinning joints
`LeftUpLeg`/`RightUpLeg` — the top's hem, the belt and the trousers meet with no skin in any
frame.

One correction worth recording: an earlier pass read a band of bare thigh on the slender body
from a downscaled contact sheet. It was the Wayfarer trousers' own tan leather. A
neutral/slender/stout comparison at the same camera showed the trousers covering the hip in
all three, and the corrected metric puts slender at ≤5 exposed everywhere.

## What this does not cover

- Only `slender` and `stout` at weight 0.95. Intermediate blends are interpolations of the
  same field but were not sampled.
- Height is not swept: it is a uniform scale on the visual root and the garments hang from
  that same root, so body and cloth scale together and no coverage relationship changes.
- Five samples per clip. A defect confined to a window narrower than a fifth of a clip could
  be missed.
- The Orc and Undead have no verified shape family, so there are no body extremes to test.
