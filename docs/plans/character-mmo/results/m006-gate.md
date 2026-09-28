# M006 entry gate — the creator's asset dependencies

Status: **gate not met; two of the three required controls are blocked on source art, with the blockers measured rather than asserted** (2026-09-28 local time). Source base: `556f2d3`. This is the entry gate M006 defines, not the milestone: no creator surface, no persistence and no recipe migration was built, because the brief makes those depend on assets that do not exist and forbids substituting a capability flag for them.

M006 asks for height, body shape, adult age appearance, skin and hair colour, and at least long hair versus bald. Height and body shape are delivered and reviewed under M004 and M005. This report covers the three that were not: bald, long hair, and age.

## Bald: blocked, and the measurement says why

A hair **shell** — a cap over a complete scalp — can be collapsed onto that scalp by a morph target, which would preserve the vertex correspondence M004 and M005 both depend on. A hair **sculpt** — the skull's own outer surface with lock shapes cut into it — cannot, because there is nothing underneath to collapse onto.

[`measure-hair-separability.mjs`](../../../../scripts/character-assets/measure-hair-separability.mjs) settles which one this is: of the **333** head-driven vertices above the brow, only **75 (22.5%)** have any other head surface within 16 mm straight down their own normal. The hair is fused. [`hair-separability.json`](../../../baselines/character-mmo/m006/hair-separability.json) has the numbers.

Five collapse rules were tried against the asset before that measurement was written, and each failed in a way that pointed at it. The reviewed renders are under [`ve-capture/character-mmo/m006/hair/`](../../../../ve-capture/character-mmo/m006/hair/).

| Rule | Result |
| --- | --- |
| Move each hair vertex inward along its own normal | Flattened the cap on the back of the skull. Never classified the fringe at all: those locks jut forward over the brow, so the inward ray leaves the head. Their neighbours moved and tore them. |
| Project the detected set onto the scalp triangles | Fixed the cap, changed nothing about the fringe, which was still not in the set. |
| Classify and collapse by Laplacian smoothing, region rim pinned | Deflated the dome between the pins: the crown dropped 72 mm and 282 of 333 vertices were called hair. |
| The same with Taubin λ/μ smoothing, which does not shrink | Tore a hole through the crown. With no scalp beneath, the cap smoothed straight through the skull. |
| Project onto an ellipsoid dome fitted to the region | Well behaved — a projection onto a convex surface cannot self-intersect — and not bald. A dome loose enough to leave the skull alone leaves the fringe untouched; one tight enough to take the fringe cuts into the skull. |

**Next step:** re-author the head with hair as separate geometry. That changes the body mesh's vertex count, so it invalidates the correspondence the M004 shape family and the M005 garment refit are built on, and it needs its own body-source milestone rather than a slot inside the creator slice. A second basecolor is needed too: the shipped texture paints hair where the geometry would go, so even a perfect bald morph would read as shaved rather than smooth.

## Long hair: attempted twice, not accepted

M001 recorded no verified long-hair source for this head. The one staged candidate, `mhair02`, carries an **AGPL3** header in its own `.mhclo` despite a community CC0 listing, and `blender/characters/candidates/hair/mhair02/LICENSE-CONFLICT.md` says keep it staged. The CC0 `short02` is short hair. So the asset has to be authored.

Long hair is additive and therefore not blocked the way bald is: it is a separate mesh on the same 65-joint rig, exactly like the M005 plate, and asks nothing of the head. Two attempts are in [`build_long_hair.py`](../../../../scripts/character-assets/build_long_hair.py), and neither produced a usable asset. Renders are under [`ve-capture/character-mmo/m006/longhair/`](../../../../ve-capture/character-mmo/m006/longhair/).

- **Cut from the body's own scalp, then extruded down the back.** The sculpted locks fragment the region: the cap came out as **nine** disconnected pieces and fell as separate sheets with a gap down the back of the head. A connectivity check now fails the build rather than exporting that.
- **Generated as a parametric grid around a measured head ellipsoid.** One connected surface by construction, and the first version hung the entire mass in front of the face because `+Y` is behind the head in this asset's local space, not in front. Corrected, it sits behind the head and reads as a flared sleeve: it does not sit on the crown, does not part, and does not taper.

**Next step:** sculpt it in a Blender session against the actual head. Judging a silhouette from several angles and adjusting is what the parametric approach cannot do; driving arc, flare, drop and a cap falloff blind converged on a cone rather than a hairstyle. The rigging half is already settled and reusable — a three-bone blend down the length, Head at the crown through Neck to Spine2 at the tips, which is also the helmet and cape interaction policy the brief asks for: the strand tracks the spine, so a turn of the head sweeps the top and barely moves the tips, with no simulation.

## Age: cross-topology transfer not attempted

The CC0 `caucasian-male-{young,old}` targets exist and are vendored, but they are hm08 topology. M004 deliberately avoided cross-topology transfer and got its shape family from *measurements* of the CC0 bodies rather than their vertices, which works for girth because girth is a scalar per segment. Ageing is not: it is a face, and a face needs its deltas, not its dimensions.

Transferring those deltas onto the Tripo head by closest-point projection is the obvious candidate and is untried. It is listed here as the open question rather than guessed at.

### Whole-head source swap check (2026-09-28)

After the [licensed hair audition](m006-hair-audition.md), I tested a different shortcut for the old/bald example: cut the active Tripo head at **1.50 m**, fit the CC0 MakeHuman `caucasian-male-old.target` head and `old_lightskinned_male_diffuse.png` to its measured head bounds, and render front/side/back. The source skin is pinned in the [M006 manifest](../../../../blender/characters/candidates/hair/m006-provenance.json), and [`review-old-bald-head.py`](../../../../scripts/character-assets/review-old-bald-head.py) reproduces the test. Raw renders are local under ignored `ve-capture/character-mmo/m006/old-bald-fit/`.

The source is bald and visibly older, but the fit is **rejected**: the 1.50 m cut leaves a jagged, floating neck seam; the MakeHuman face has empty/reddish eye sockets without authored globes; its skin and facial identity differ sharply from the approved Human. The offline render is a source assessment, not live visual acceptance or a runtime option. Fixing it needs an authored head/neck/eyes asset or a face delta and texture transfer onto the existing head; the cross-topology age transfer described above remains untried. No gameplay asset or capability flag was changed.

## What this means for M006

Two of the five controls the milestone names are blocked on source art, and one is untried. Height and body shape are done. Skin and hair colour are material work and are not blocked by any of the above.

The brief is explicit that a capability flag is not a visual substitute, so the creator surface is not being built against assets that do not exist. The sequence that unblocks it:

1. A body-source milestone that re-authors the head with separable hair and a second basecolor. This also unblocks bald.
2. A sculpted long-hair asset, using the rigging and the three-bone blend already proven here.
3. An age transfer experiment, with the neutral head as its control the way the neutral body was M005's.

Only then are height, shape, age, colour and hair five controls the creator can honestly expose.

### Source search after this gate (2026-09-28)

The [MakeHuman system-asset index](https://static.makehumancommunity.org/assets/assetpacks/makehuman_system_assets.html) lists `long01` and `ponytail01` as **CC0**, and also lists old/middle-aged/young skin assets. The [MakeHuman license](https://github.com/makehumancommunity/makehuman/blob/master/makehuman/license.txt) distinguishes bundled CC0 assets from third-party repository assets; this matters because the staged `mhair02` file had an AGPL3 header despite its listing. These entries are **candidates**, not accepted assets: obtain the exact file, inspect its own header/license, pin its hash, fit it to the current head and source-65 bind, and review it in live motion before revising the long-hair blocker. The local session that found the listing had no outbound DNS, so no binary was fetched or silently substituted. It does not solve the fused bald head or the age transfer.

**Follow-up completed on 2026-09-28:** network access allowed the exact CC0 pack to be fetched, hashed, fitted and reviewed. [The source audition](m006-hair-audition.md) proves a tail-only ponytail in live game motion (Telegram **796**), while rejecting both full hair caps for intersection with the fused short hair. The licensed source gap is closed; the clean final fit, bald scalp and age controls remain open. The earlier DNS statement above describes the original gate session, not the current environment.

**Additional 2026-09-28 experiments:** [The head and age report](m006-source-experiments.md) records two rejected scalp cuts and the first cross-topology age-delta transfer. The latter changes the face while preserving its mesh and eyes, but does not yet read as an older version of this character. The ponytail atlas was reduced from 2048² to 1024² PNG with reviewed live motion; the candidate body is now 4.00 MB. The creator gate remains open.
