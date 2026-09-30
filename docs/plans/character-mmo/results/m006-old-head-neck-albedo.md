# M006 — old/bald Human head: neck albedo at the y=1.5 m cut

Status: **improved and measured; M006 not accepted.** The join is materially better but
still legible at close range, and the other M006 defects are untouched.

Reviewed clips: Telegram 810 (first correction) and **813** (the corrected parameter, which
supersedes it). Both 1280x720, verified.

## The defect

The old/bald Human candidate is the shipped M004 shape body cut at y=1.5 m with a separate
head and eyes mesh. Body and head carry **two different atlases** (`basecolor` and
`old_lightskinned_male_diffuse`), so their skin tones have to be reconciled in art; there is
no shared texture to fix. Materials are effectively identical and are not the cause:

| material | metallic | roughness | normal / MR / AO | baseColorFactor |
|---|---|---|---|---|
| `HumanV1Body` | 0 | 0.82 | none | 1,1,1,1 |
| `OldSkinDiagnostic` | 0 | 0.70 | none | 1,1,1,1 |

## What the earlier metric got wrong

`audit-old-head-seam.mjs` samples a 4 mm rim band at y=1.5 on both meshes. Fitting the head
to the body in full CIELAB against that band drove its reported rim delta from 67 to **0** —
and made the rendered seam **worse**. The band's body statistics (sd 42–53 sRGB over the
wider neck) are not what actually shades; the offset that zeroes the band moved the whole
head down about 67 sRGB in luminance, producing a dark ashen mask on a pale body.

An atlas-space delta of 0 alongside a *worse* rendered seam is the whole lesson here: the
fitted quantity was not the visible one.

## The second measurement was also wrong, and it chose the shipped parameter

The first sweep searched each build for its **own** largest tonal step within the neck band.
That works on the uncorrected head, where the join *is* the largest step. It stops working
the moment the correction lands: the join drops below the brow and the edge of the search
window, the search scores those instead, and the number is no longer the seam. The tell was
visible and ignored — the reported row moved from 446 on the control to 469 and 520 on the
corrected builds, and 520 is the window boundary.

The camera and the pose are pinned, so the join sits at the same screen row in every build.
Pinning that row from the control and re-sweeping gives the real numbers — worst per-channel
step across the seam, front-quarter / back:

| build | front-quarter | back | worst | hue break (R−B) |
|---|---|---|---|---|
| uncorrected | 21.7 | 33.2 | 33.2 | 40.6 / 52.3 |
| **chroma only, L=0 (accepted)** | **8.3** | **7.5** | **8.3** | **6.0 / 13.5** |
| chroma + 10% L | 4.2 | 9.6 | 9.6 | 6.9 / 14.6 |
| chroma + 20% L (previously shipped) | 4.7 | 13.7 | 13.7 | 7.4 / 15.3 |
| chroma + 30% L | 7.6 | 16.8 | 16.8 | 8.3 / 16.0 |
| chroma + 40% L | 12.1 | 17.6 | 17.6 | 8.8 / 17.0 |

`L_MATCH` was 0.20 for one day on the strength of the bad sweep. A seam is judged by where it
is worst, not by the average of two views, so **0 wins**: 8.3 against 9.6 for the next best.
It is also the value the physical argument predicts, since head and body differ in hue far
more than in lightness. The correction now removes **62%** of the join step at the
front-quarter and **77%** at the back.

## A rejected alternative: diffusing the correction over the mesh graph

One affine cannot follow a mismatch that varies around the neck, and the measured rim
correction does vary — mean CIELAB distance 14.3, max 28.0 across 82 rim nodes. So
`scripts/character-assets/diffuse-neck-seam.mjs` solves a *local* correction instead: the
body's colour at each matching rim position minus the head's own, carried over the head by
Dijkstra on real edge lengths with a cosine falloff, smoothed on the graph, and rasterised
barycentrically into the atlas.

It merges head vertices **by 3D position** (4,265 vertices into 4,089 nodes, 176 UV splits),
which is exactly what the earlier spatial taper got wrong: a weight smooth in 3D is a step in
texture space, and that step is what put the pale patch on the nape. Geodesic distance rather
than Euclidean, because the chin is near the throat through the air and far across the skin.

It measured **5.8 / 14.2** against the affine's 8.3 / 7.5 — no better, and worse at the back.
Recorded as a negative result and not shipped; the script is kept because the machinery is
correct and a future two-atlas seam may need it.

## The correction

`scripts/character-assets/match-old-head-atlas.mjs` rewrites the head's **atlas image** —
deliberately not one of the four previously rejected render-time routes (material factor,
vertex-colour fade, per-vertex rim ratio, UV remap). It fits a per-channel affine in CIELAB
from the head's rim band to the body's, then applies **chroma in full and none of the
lightness offset**. Head and body differ in hue far more than in lightness, so matching
chroma closes the break while leaving the head's own shading and pore detail intact.

A spatial taper of the correction (full at the cut, easing to `FACE_STRENGTH` above it) was
built and **rejected**: it restored face warmth but put a hard-edged pale patch across the
nape, because the weight changes sharply where two UV islands meet there, so a smooth weight
in 3D is a step in texture space. Six passes of weight dilation did not remove it, which is
how we know the step is in the islands and not in un-rasterised texels. It remains reachable
through `ASHEN_FACE_STRENGTH` and is off by default.

Preserved: source-65 rig, 65 joints, 57 clips, M004 slender/stout morph correspondence on
both body and head, M005 garment fit. `headOpenEdgesBeyondNeck` is 0.

## Measuring it

`scripts/character-assets/probe-old-head-join.mjs` replaces frame-index sampling of the
review orbit. That orbit is driven by `requestAnimationFrame`, so a frame index does not pin
a camera pose and the same index lands on a different yaw between runs — two builds compared
that way are not comparable, and the first sweep produced "insufficient skin" on half its
samples for exactly that reason. The probe sets exact armory camera angles and takes a still,
and it **locates the join row itself** as the largest horizontal step in skin tone within the
neck band, rather than assuming a row. The band matters: once corrected, the join stops being
the largest step in the frame (the brow takes over at row 301), and an unconstrained search
silently starts measuring a different edge on each build.

## Running it

```sh
node scripts/character-assets/match-old-head-atlas.mjs
node scripts/harness/up.mjs --slot 7 --headless
env ASHEN_CDP_PORT=10037 ASHEN_URL="http://127.0.0.1:5873/ashen-reach.html?play&clean" \
    ASHEN_JOIN_LABEL=candidate node scripts/character-assets/probe-old-head-join.mjs
```

In the game the candidate is behind `?humanHead=old-bald`, served from `.cache/` by a
dev-only Vite middleware. It is not a released asset and is not in the Pages bundle. The
candidate's body ends at the neck, so the coverage contract moves both head segments off
`HumanV1Body` and onto the head and eyes meshes — the split the Undead body already uses.

## What still reads wrong

1. At close range the join is a **thin straight horizontal line** under the jaw. It is no
   longer a tonal block, but it is geometrically straight and catches the eye. Colour alone
   will not remove it — the diffused variant above confirms that a better colour field does
   not help. Two meshes butted at a cut, carrying two atlases, need to become one mesh on one
   atlas with a gradient-domain blend across the former seam. That is re-authoring, and it is
   the actual remaining M006 art gate.
2. The stubble stops in a **hard horizontal cut at the nape** instead of fading.
3. The rear-scalp UV discontinuities are untouched, and are **not a visible defect** — see
   below. They should come off the M006 blocker list.
4. Ear edge in the diagnostic 35 mm hood fit, weak adult-age distinction and the long-hair
   tie/colour policy are all untouched.

At gameplay distance, with the collar over the join, the head reads as one piece with the
body. That is not sufficient for M006 acceptance.


## The rear-scalp UV seams are latent, not visible

The audit reports 13 coincident-position vertices on the back centreline whose two UV islands
sample texels up to 167 sRGB apart. Three things were checked, in order.

**They are not a sampling artifact.** The audit samples at the vertex UV, which sits exactly
on an island boundary, and the GPU never samples there — interpolated UVs stay strictly inside
the triangle. Re-sampling each vertex nudged toward the centroid of every triangle that uses
it, which is what actually shades, still flags all 13; several get worse (up to 167). The
hypothesis that this was a measurement artifact was wrong.

**They are not masked by the stubble.** Natural texel-to-texel variation in the scalp region
of the head atlas, at the 3-texel separation comparable to the seam's two-sided gap, is p50 5,
p90 20, p95 34, p99 69 sRGB. The seam spreads of 67–167 sit at or above p99.

**They are larger in number than the audit suggests.** Across the whole head there are 172
UV-split vertex groups; 50 disagree by >=40 sRGB and 21 exceed the stubble's own p99. They
span y 1.500–1.760, not just the nape — the audit's window (|x|<0.005, z<-0.10, y>1.55)
sees 14 of them.

**And none of it renders as a seam.** The seam's position on screen could not be found by eye,
so its texels were painted magenta and cyan and a 16-step camera sweep was run to find where
they appear: alpha 1.5*pi, a 26 x 190 px vertical strip up the back centreline. Compared at
that exact camera, neither the uncorrected nor the corrected build shows any line there. The
flagged vertices are scattered and isolated rather than forming a run of adjacent vertices
disagreeing in the same direction, so each produces a small interpolated blob a few triangles
wide, indistinguishable from stubble, instead of an edge.

This is a latent authoring defect. Fixing it means re-welding or re-painting the head's UV
islands, which puts the M004 morph correspondence at risk for no visible gain. Recommend
leaving it and treating the visible join (defects 1 and 2 above) as the actual M006 art gate.
