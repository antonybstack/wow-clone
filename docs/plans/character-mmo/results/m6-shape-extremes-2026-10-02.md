# Milestone 6, task 4 — the garment matrix at the body extremes

**2026-10-02.** Game source `8ae4c2d`, one owned rendering client at a time, functional only.
No source change, nothing released.

Every combination checked so far has been at the neutral body. This runs the whole garment
matrix at the four corners of the released Human shape domain, with the neutral body as a
control.

## Result

**4,320 live combinations agree with the coverage resolver** — 864 garment loadouts × 5 shapes
— with zero disagreements, zero refusals and zero console errors.
[Data](../../../baselines/character-mmo/m6/shape-extremes.json) ·
[check](../../../../scripts/character-assets/check-shape-extremes.mjs) · contact sheet on
Telegram **843**.

| Shape | height / build | Applied | Combinations | Disagreements |
| --- | --- | --- | --- | --- |
| neutral (control) | 1 / 0 | no shape family — see below | 864 | 0 |
| tall-slender | 1.15 / −0.95 | weights [0.95, 0], height 1.15 | 864 | 0 |
| tall-stout | 1.15 / +0.95 | weights [0, 0.95], height 1.15 | 864 | 0 |
| short-slender | 0.90 / −0.95 | weights [0.95, 0], height 0.90 | 864 | 0 |
| short-stout | 0.90 / +0.95 | weights [0, 0.95], height 0.90 | 864 | 0 |

Fifty stills were captured — five designs × five shapes × front and back. At this framing no
skin breach is visible at either extreme. That is a review at this framing, not a proof that
none exists.

## The supported domain, stated rather than implied

**Only the Human has a verified shape family.** The task asked to either sweep the other races'
extremes or state the domain; this states it:

| Race | Supported body domain |
| --- | --- |
| Human | height 0.90–1.15 × build −0.95…+0.95, the released production range |
| Orc | **neutral only** — no verified shape family |
| Undead | **neutral only** — no verified shape family |

Sweeping an Orc "extreme" would mean sweeping the neutral body five times and reporting it as
coverage of a range that does not exist.

## Two traps this check had to avoid

**The shape has to actually apply.** It is reached the way a player reaches it — a saved
appearance in storage, which is what makes the production route load the shape family at all —
and the applied shape is then read back from the running game and asserted against the request.
Without that, a seed that silently failed would boot the neutral body and all 864 rows would
pass at a shape that was never applied.

**The neutral control legitimately has no shape family.** `usesHumanShapeStarter` only treats a
saved appearance as a shape start when it departs from the default, so a neutral appearance with
default gear loads no family and `ASHEN.humanShape` is `null`. The first version of this check
asserted a shape was applied for every row and failed on its own control. It now requires that
the neutral row is *not some other shape* rather than that it carries one.

## An unreproduced transient, recorded rather than closed

One run of this sweep reported **20 GPU errors** on a shaped body and aborted. It has not
reproduced since:

* an 864-loadout probe at tall-slender, specifically looking for it — none;
* two subsequent full 4,320-combination sweeps — none.

Nothing was changed between those runs that would explain it; the only edits were to the
assertion's message and to the neutral-control handling. **It is not fixed and is not dismissed**
— it is a transient seen once that I could not reproduce. If it returns, the sweep now prints the
first two error strings with the loadout and shape that produced them.

## What this does not close

* Motion at the extremes. These are frozen poses; the offline posed-fit matrix covers motion for
  a few outfits with a worst case of 24 exposed vertices of 3,274.
* The mixed-combination visual review, which is still task 3's remaining half — this adds 50
  stills at five shapes, not a review of the 6,048 valid loadouts.
