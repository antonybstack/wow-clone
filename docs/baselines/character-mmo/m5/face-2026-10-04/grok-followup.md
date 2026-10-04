# Face correction follow-up — 2026-10-04

Read-only. No renderer, Blender, tests, commit, or delivery. Parent owns the single game instance. This is not user aesthetic approval.

Compared: rejected `accepted-fits/{young,old}-neutral-bare-{front,side}.png` from the prior review vs current `docs/baselines/character-mmo/m5/face-2026-10-04/final-fits/` of the same rows, plus `young-hair-neutral-wayfarer-front.png` and `old-neutral-warden-front.png`. Source: `human_identity_recipe.py`, current `build-human-identity-source.py` fit, `proportions.json`.

## The named skull / age offset is corrected

Uniform eye-landmark similarity (`fit_scale = 100`, `eye_anchor = (0, -8, 165.5)` cm) plus per-age source, not `(z-1.5)*119` and not `x*133`.

| | width cm | crown cm | eye centroid Y cm |
|---|---|---|---|
| Canonical M004 | 18.66 | 176.00 | — |
| Rejected young | 23.50 | 179.53 | 166.59 |
| Rejected old | 22.59 | 175.97 | 162.39 |
| Current young | 17.67 | 175.67 | 165.49 |
| Current old | 16.99 | 176.22 | 165.49 |

Young and old eyes now share the 165.5 cm landmark (Δ 0.04 mm). The 4.1 cm old-socket drop is gone. Crowns sit on 176 cm. Width is under the 8% oversize gate (`proportions.json` `passed: true`, `issues: []`).

Live Front/Side stills match that: heads sit on the Mixamo shoulders instead of a pumpkin; old face is no longer welded into the neck. Warden crown follows the smaller skull. Ponytail cap sits on the vault instead of a balloon. 95% globe + original `brown_eye.png` (rough 0.38) reads as sclera and iris at this camera; the 0.83/lid-wrap slit is not in these frames.

## At most three remaining consequent defects

### 1. Art — brow cards

`eyebrow001.mhclo` Shrinkwrap at `offset = 0.15` (1.5 mm on the centimetre rig), dark `eyebrow001.png`, double-sided alpha clip. Front stills, loudest on **old-neutral-bare-front** and **old-neutral-warden-front**: two graphic dark strips sitting on the ridge, pigment of a young brow on a bald aged head. Young Front shows the same cards, softer on younger skin. Profile is a dark tick. This is the first thing that still reads as a separate mesh at the camera that rejected the last head.

Licensed next step is a paler/grey old albedo or `eyebrows-trans-down.target` on the same proxy — not another lid wrap.

### 2. Geometry residual — old skull still 9% narrower than canonical

Uniform ×100 keeps MakeHuman old’s narrower head (16.99 cm vs 18.66 cm canonical, vs young 17.67 cm). Front: old bald looks a bit petite on the heroic delts. This is the leftover of locking eyes and preserving MH width; it is not the 26% pumpkin coming back. If the Mixamo box is the width authority, scale both ages’ *width* to 18.66 after the eye landmark, and leave Z on the landmark.

### 3. Art — young-hair frontal coverage

`young-hair-neutral-bare-front.png` and `young-hair-neutral-wayfarer-front.png`: ponytail01 cap leaves a large bald forehead and temples. Side attachment is plausible; Front is a receding island on a now-correct skull. The previous “tiny hair on a giant head” is gone. What remains is the licensed cap’s coverage, which this audition row still presents as the young-hair identity.

Warden opening: crown oversize is gone; a dark stand-off around the cheeks remains and is milder than (1)–(3).

Neck 8× smooth and 6 cm colour fade are not the read at Front/Side. Do not resume `measure-neck-circ-incr` at 25% (flared wings already rejected).

DEV audition only. Parent still owns live motion and any user call.
