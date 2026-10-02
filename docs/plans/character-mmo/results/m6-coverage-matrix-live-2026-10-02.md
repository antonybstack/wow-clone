# Milestone 6, task 5 — the coverage contract checked against the running engine

**2026-10-02.** Game source `8ae4c2d`, one owned rendering client, functional only. The only
source change is a read-only accessor added for this check; nothing visual, nothing released.

The coverage contract decides which body meshes a garment may hide. Until now it was verified
**exhaustively offline** and **on eight hand-picked loadouts live** — the wrong way round, since
a resolver agreeing with itself says nothing about what the player sees. Those eight cases were
also chosen before the shoulders slot, the Lector coat and the four Duskguard pieces existed.

## Result

**2,592 of 2,592 live combinations agree with the resolver** — 864 garment combinations × 3
races — with zero refusals and zero GPU or console errors.
[Data](../../../baselines/character-mmo/m6/coverage-matrix-live.json) ·
[check](../../../../scripts/character-assets/check-coverage-matrix-live.mjs).

| Race | Body meshes driving visibility | Distinct predicted hidden sets | Combinations | Disagreements |
| --- | --- | --- | --- | --- |
| Human | HumanV1Body, **HumanTorsoCore** | 2 | 864 | 0 |
| Orc | 10 meshes | 32 | 864 | 0 |
| Undead | UndeadV1Body, UndeadV1Eyes, **UndeadTorsoCore** | 2 | 864 | 0 |

Hand slots are excluded because no hand item claims a body segment. That is **asserted** at
startup from the catalogue rather than assumed, so if a hand item ever gains coverage the sweep
fails instead of silently narrowing.

## The first version of this check was vacuous, and the control is why that is known

Run against `RACE_BODY_SEGMENTS`, the sweep reported 864 Human rows passing in 3.8 seconds.
It was comparing `[]` with `[]` every time. That constant lists one body mesh for the Human and
two for the Undead, so `resolveCoverage` could not hide anything on either race — **0 of 864
loadouts produced a non-empty prediction**, and only the Orc, whose body is ten meshes, had any
teeth at all.

The constant is a fallback. `equipment-stream.js` replaces it with
`publishedCoverage.bodySegments` whenever a published coverage manifest exists, and the running
game carries `HumanTorsoCore` and `UndeadTorsoCore` — the conservative geosets — which the
constant does not list. The sweep now reads the map the engine is actually driving, through a
new read-only `getBodySegments()` on the equipment facade, and both races go from 1 distinct
predicted hidden set to 2.

`ASHEN_CONTROL=1` inverts the prediction against the same build. Under it the sweep reports
**2,592 disagreements — every row on every race**; the real run reports 0. The comparison
discriminates, demonstrated rather than asserted.

## The 768 figure was stale and is corrected

"All 768 catalogue combinations validate by rule" was carried into the current plan. Re-running
`measure-coverage-matrix.mjs` against today's catalogue gives:

| | Committed baseline | Today |
| --- | --- | --- |
| Catalogue items | 8 | **14** |
| Combinations enumerated | 768 | **6,912** |
| Valid | 672 | **6,048** |
| Rejected by the validator | 96 | **864** |
| Distinct pairs / triples | 24 / 34 | **63 / 143** |
| Coverage exceptions | 146 | **652** |
| Occupancy disagreements | 0 | **0** |

Nobody had re-run it since the Lector, Duskguard and Warden pieces were added. The reassuring
part survives unchanged: the validator still agrees with the occupancy rule on every one of the
6,912. The regenerated baseline is committed.

The 6,912 and the 864 measure different things and both are correct: 6,912 is every combination
including the two hand slots, and 864 is the garment-only space this live sweep drives, since
hand props carry no coverage.

## What this does not close

* The 652 coverage exceptions are mostly facts about the bodies — a race whose body is one mesh
  cannot have part of it hidden — not defects. They are recorded, not triaged.
* This proves the engine hides what the resolver says. It does **not** prove the result looks
  right: a correctly hidden mesh can still leave a visible gap at a seam. That is task 3's
  remaining half.
* Shape extremes are untouched; every combination here is at the neutral body.
