# M7 — the dye palette respent on separation (ashen-dye-v2)

**Delivered:** Telegram **848** (28.8 s, 896×504, SAR 1:1).
**Palette:** `src/ashen-reach/dye-palette.js`, `ashen-dye-v1` → `ashen-dye-v2`.
**Raw:** [`docs/baselines/character-mmo/m7/dye-live-v2.json`](../../../baselines/character-mmo/m7/dye-live-v2.json),
[`dye-gap.json`](../../../baselines/character-mmo/m7/dye-gap.json). v1's run is kept beside them
as `dye-live.json`.

## The earlier conclusion was wrong, and wrong in a specific way

[M7/1](m7-dye-mechanism-2026-10-03.md) ended with "a palette should spend its entries on
saturation, not lightness", drawn from each entry's distance from **undyed**: `bone` moved the
garment 2.84 units and `ash` 8.24, against oxblood's 11.29.

Two things were wrong with that.

**The metric measured the frame, not the garment.** Fitting the nine v1 entries against their
factors gives `rendered = 8.74·factor + 25.69` on red, with a maximum residual of **0.19 of
255** across all nine — so the crop's mean is almost perfectly linear in the dye, and only
**26%** of it responds to the dye at all. The other 74% is face, sky, meadow and trousers. A
direct measurement agrees: dyeing from undyed to `pitch` moves **53.5%** of the crop's pixels,
and those pixels are themselves only partly dye-driven. Every v1 separation was therefore
about four times smaller than what the garment actually did.

**Distance from undyed is not the player's question.** Two dyes both far from undyed and close
to each other are one dye and a wasted slot. Computing all 36 pairwise distances from v1's own
recorded means says so plainly:

| | v1 | v2 |
| --- | --- | --- |
| entries | 9 | **10** |
| min pairwise separation | **1.70** (slate/plum) | **3.80** (sage/ash) |
| median pairwise | 4.44 | 6.31 |
| min distance from undyed | 2.84 | 4.03 |
| capture drift (control) | 0.04 | 0.01 |
| min pairwise, garment only (masked) | not measured | 7.03 |

v1's eight dyed entries sat 8–11 units from undyed and **1.70–3.64 units from one another**.
The palette was not short of saturation — oxblood and rust were already at chroma 0.40 — it was
short of *spread*. It read as "undyed, or one of eight darker things".

## How v2 was chosen

Because the rendered mean is linear in the factor, pairwise separation is proportional to the
distance between factor vectors, which turns the design into a packing problem rather than a
matter of taste: maximise the minimum pairwise distance. Each constraint added below cost
something, and the cost is recorded rather than hidden.

| constraint | min pairwise (factor units) | why not this |
| --- | --- | --- |
| channels in [0.10, 0.92] only | 0.621 | answers primary magenta/cyan/yellow; wrecks the setting |
| + chroma ≤ 0.401, rust's own chroma | 0.579 | drops red from the palette entirely |
| + one entry per hue family | 0.454 | named a light grey "pitch"; nothing tied names to numbers |
| + both neutrals pinned at the lightness ends | **0.429** | shipped |

v1 is at **0.196** on the same measure, so the shipped palette is **2.19× better by
construction** and carries one more entry. The chroma ceiling is not a round number: it is the
chroma of the most chromatic dye v1 already shipped, so no v2 entry is louder than something
already in the game.

| | factor (linear RGB) | lightness | chroma |
| --- | --- | --- | --- |
| undyed | 1, 1, 1 | 1.00 | 0.000 |
| sage | 0.786, 0.906, 0.624 | 0.77 | 0.200 |
| heather | 0.852, 0.319, 0.753 | 0.64 | 0.401 |
| verdigris | 0.331, 0.753, 0.849 | 0.64 | 0.390 |
| ash | 0.550, 0.550, 0.540 | 0.55 | 0.008 |
| amber | 0.691, 0.516, 0.136 | 0.45 | 0.401 |
| indigo | 0.288, 0.141, 0.689 | 0.37 | 0.401 |
| moss | 0.131, 0.564, 0.226 | 0.31 | 0.322 |
| oxblood | 0.591, 0.100, 0.100 | 0.26 | 0.401 |
| pitch | 0.120, 0.120, 0.130 | 0.12 | 0.008 |

`bone`, `slate`, `rust` and `plum` are gone; `sage`, `heather`, `verdigris`, `amber` and
`pitch` are new.

## The prediction, made before the measurement

The fitted model predicted v1's own minimum at **1.72** against a measured 1.70, so it was used
to state v2's expected result *before* the live run: **3.76 ± 0.3, closest pair amber/oxblood**.

Measured: **3.80**, closest pair sage/ash. The magnitude is right to 0.04; the named pair is
not, because sage/ash, amber/oxblood and undyed/sage finish at 3.80, 3.83 and 4.03 — a
three-way tie the model could not resolve and did not claim to.

Cost is unchanged to slightly better: **7.5 ms median, 22.8 ms worst** against v1's 12 / 19.7,
with zero GPU or console errors across all ten entries.

## Two findings that are not about the palette

**Later 2026-10-04 correction:** the missing-garment interval below was a defect of that implementation, rather than a necessary property of recolouring. [Saved colours and atomic recolouring](m7-saved-colours-2026-10-04.md) retain the old owner through native preparation: forty changes now have zero gaps. The original measurement is retained here.

**A dye change un-renders the piece for up to three frames.** The first review cut opened on a
bare torso, because its first frame landed inside the first dye's rebuild. One frame cannot
tell a sub-frame swap from a visible flicker, so
[`measure-dye-gap.mjs`](../../../../scripts/character-assets/measure-dye-gap.mjs) samples scene
membership every animation frame across 40 dye changes: **24 gaps, median 1 frame, longest 3**
(≈50 ms at 60 Hz), on 60% of changes. The idle control reported **0 gaps in 180 frames**, so
the sampler is not inventing them. This is inherent to the chosen rebuild mechanism and is
unaffected by which colours the palette holds; it belongs to M7/1, not here. Note the probe
needs *both* absence from `scene.meshes` and `visible === false`: a dye rebuild disposes and
re-appends the mesh (its index moved 77 → 137), while the scene's mesh count stays at 138
whether the torso is worn or bare.

**sage/ash is only just distinguishable.** It is the designed minimum, so this is the expected
place for the palette to be weakest, but at this scene's light level the difference reads as
just-noticeable rather than obvious. Visible in the clip at 10–13 s. Raising it means either
relaxing the chroma ceiling or dropping an entry.

## What changed

* `src/ashen-reach/dye-palette.js` — v2 entries, plus a load-time guard that throws if any pair
  falls under `MIN_PAIRWISE_FACTOR_DISTANCE`. The clustering is not visible by reading the
  numbers, so it is checked where the channel bound is already checked.
* `scripts/test-dye-palette.mjs` — two new tests: the pairwise floor, and that the hue sectors
  and lightness are actually spread. 164 character / 110 equipment tests and the build pass.
* `scripts/character-assets/check-dye-live.mjs` — a mask-restricted mean alongside the
  whole-crop mean, a pairwise floor assertion against characterised noise, and an assertion
  that the mask covers more than 15% of the crop so a mis-framed crop fails instead of
  returning a quiet zero.
* `scripts/character-assets/measure-dye-gap.mjs`, `inspect-dye-crop.mjs`,
  `record-dye-palette.mjs` — new.

The review clip took five cuts. The first held `KeyW` through the whole palette, so the
character walked out of the meadow and every entry was judged at a different size under
different light; the next three each had the camera pulled inside the character by collision or
by walking at the lens. Framing has to be pinned before colours can be compared, and pinning it
once is not enough when the rig re-applies its own follow every frame.
