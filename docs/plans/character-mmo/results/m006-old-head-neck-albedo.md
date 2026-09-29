# M006 — old/bald Human head: neck albedo at the y=1.5 m cut

Status: **improved and measured; M006 not accepted.** The join is materially better but
still legible at close range, and the other M006 defects are untouched.

Reviewed clip: Telegram 810 (1280x720, 17.23 s, verified).

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

Measured at the rendered join, worst per-channel step:

| build | front-quarter | back | hue break (R−B) |
|---|---|---|---|
| uncorrected | 23.0 | 32.9 | 41 / 44 |
| full CIELAB fit | 27.7 | — | 15 |
| chroma only (L=0) | 11.9 | 21.7 | 4.9 / 8.0 |
| **chroma + 20% L (accepted)** | **10.9** | **16.1** | **4.5 / 9.2** |
| chroma + 40% L | 12.1 | 13.6 * | 7.8 / 0.9 |

\* the 40% back sample landed on row 520, the edge of the search window, so it is not trusted.

An atlas-space delta of 0 alongside a *worse* rendered seam is the whole lesson here: the
fitted quantity was not the visible one.

## The correction

`scripts/character-assets/match-old-head-atlas.mjs` rewrites the head's **atlas image** —
deliberately not one of the four previously rejected render-time routes (material factor,
vertex-colour fade, per-vertex rim ratio, UV remap). It fits a per-channel affine in CIELAB
from the head's rim band to the body's, then applies **chroma in full and only 20% of the
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
   will not remove it; it needs a blend band or overlapping geometry at the cut.
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
