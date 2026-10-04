# Milestone 7, task 4 — a dye changes colour and nothing else

**2026-10-03.** Game source `8ae4c2d`, one owned rendering client, functional only. No source
change: the dye channel landed in the previous package and this is its gate.

A dye is a `baseColorFactor`, so it should leave geometry, coverage and mesh membership
untouched. That is a claim about the running game, and this tests it against the game rather
than against itself.

## Result

**54 of 54 rows pass** — 6 dyeable slots × 2 dyes × 3 races, plus a plateau check per slot — with
zero console errors. [Data](../../../baselines/character-mmo/m7/dye-neutrality.json) ·
[check](../../../../scripts/character-assets/check-dye-neutrality.mjs).

Every row asserts, on the dyed body:

* the piece is still worn and the dye is recorded;
* the **visible mesh set** is unchanged;
* the **triangle count** is unchanged — true in all 36 dye rows;
* **coverage still agrees with the resolver**, recomputed against the engine's own segment map;
* no GPU errors;
* and, crucially, that the render **actually moved**.

The 18 plateau rows cycle six dyes per slot and require the scene mesh count to settle: **every
one is flat**, so the forget-and-rebuild path does not accumulate meshes.

## The colour assertion is what stops this passing trivially

Without it, a neutrality check passes perfectly whenever the dye silently fails to apply —
everything is unchanged, which is exactly what it was asserting. So each row measures the shift
and requires it to clear a floor set by the capture noise. Margins over that floor: **minimum
1.94×, median 5.57×, maximum 25.15×**. The thinnest is the Human pauldrons, the smallest piece
in the set.

## Choosing the metric by measuring it, after two wrong ones

Two metrics were tried and discarded before the third was chosen on evidence rather than taste.

1. **Mean sRGB of a whole-body crop with an absolute 0.5 floor.** Ten of twelve rows failed. The
   shift is real but a pauldron is a few hundred pixels of a 240×320 frame, so a whole-body mean
   moves by 0.27 while the piece itself changes completely. The floor was a whole-body figure
   that no small piece can reach.
2. **Share of pixels that changed.** Size-independent, but the scene's motes and grass keep
   moving, so two identical captures already differ in **3.4–3.9%** of pixels against a dye's
   5–9%. Signal under 2× noise.
3. **Mean sRGB, thresholded relative to measured noise.** Chosen after measuring all three on the
   weakest case — a dyed pauldron:

| metric | control | dyed | separation |
| --- | --- | --- | --- |
| mean absolute delta | 1.025 | 1.293 | 1.26× |
| changed-pixel share (>8) | 3.57% | 4.67% | 1.31× |
| changed-pixel share (>24) | 1.27% | 1.61% | 1.27× |
| 95th-percentile delta | 5 | 8 | 1.6× |
| **mean sRGB shift** | **0.021** | **0.286** | **13.6×** |

The mean wins because the scene's noise is *symmetric* — motes brighten and darken pixels about
equally and average to nothing — while a dye shifts a whole region in one direction. The mean
survives the piece being small; counting pixels does not.

**The threshold then had to be characterised, not sampled.** A single noise pair lands anywhere
between 0.003 and 0.08 depending on what the motes did in that half second, and a bar built on
one sample failed six rows with the dye plainly applied. Each row now takes the worst of four
noise pairs and requires the shift to clear `max(noise × 2.5, 0.12)`.

## What this does not cover

* Only two dyes per slot — the two the palette measurement showed separate most strongly. A dye
  that reads weakly, such as `bone`, would need a different gate than "did the render move".
* Motion, extremes and the mixed-combination matrix are not re-run under dye; this covers one
  piece per slot at the neutral body.
* The dye still does not persist, so none of this is reachable by a player yet.
