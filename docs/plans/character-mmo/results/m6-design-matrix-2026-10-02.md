# Milestone 6, task 3 — the five designs reviewed on the three races

**2026-10-02.** Game source `8ae4c2d`, one owned rendering client, stills only. No FPS or
production claim; nothing released and no asset changed.

Task 3 asks for each design to be reviewed against each race at front, side and back, with
every exception recorded as data. **This closes the design-by-race half of it.** The mixed
combinations — most of the 768 the resolver validates — are not reviewed, and the task stays
open until they are.

## What was captured

**45 stills**: 5 designs (Wayfarer, Graveweaver, Pilgrim, Lector, Duskguard) × 3 races ×
front/side/back. One pinned camera for all of them — yaw per view, pitch 0.02, distance 2.45 —
and the idle clip frozen at time 0, so a difference between two stills is the garment rather
than the frame the gait happened to be on. The gameplay camera pivots on the feet, so a taller
body reframes the shot and two stills stop being comparable; that is why the framing is pinned
rather than driven.

[Data](../../../baselines/character-mmo/m6/design-matrix.json) ·
[capture](../../../../scripts/character-assets/review-design-matrix.mjs) · contact sheet on
Telegram **842**.

**Every declared piece renders in all 45 stills**, with no GPU errors and no console errors.
Each still also asserts the preset actually took: what the body wears is compared slot by slot
against the preset's loadout rather than trusting the request's status.

## Three things to judge rather than measure

These are review judgements, recorded so they are not rediscovered as surprises:

1. **The Duskguard cuirass reads as glossy quilted padding rather than plate** — rounded
   horizontal bands with strong specular highlights. It is identical on all three races, which
   is itself useful: it corroborates the earlier retraction that the Orc cuirass was defective.
   It is a material and authoring question, not a fit one.
2. **The lilac staff head and grimoire are flat and unlit** next to the garments around them.
   Consistent across all three races.
3. **The Human Graveweaver hood bulges at the crown.** That is the fused scalp hair pushing the
   hood out, which milestone 5 owns; the Orc and Undead hoods sit flat.

The Human hood also puts the eyes in deep shadow while the Orc and Undead faces stay lit under
theirs. That reads as the brim shadowing a fleshed face rather than a defect, and is noted only
because the three races differ.

## A false alarm, corrected

From the front, the Human Lector showed two flat lilac shapes — one at the shoulder, a larger
one at the hip — that read as untextured geometry. **They are not.** The side and back views
show the hip shape is the Graveweaver grimoire, gold cross on its cover and pages visible, and
the shoulder shape is the greatstaff's head seen edge-on.

That is the second time in this milestone that a front-only read at small scale suggested a
defect another view dissolved; the first was an apparent left/right boot mismatch in a walking
frame that did not survive a pinned camera. Both are recorded in the method rather than the
findings: **a single view at small scale is not enough to report a visual defect.**

## A correctness detail worth keeping

The first capture reported a missing part in all 45 rows. The parts were `WayfarerTrousersCuffs`
and `DuskguardTrouserCuffs`, which carry `hideWhenSlots: ['boots']` and are supposed to vanish
once boots are on — and every design wears boots. The expected-mesh set now excludes a part
whose hide condition is met, so the report names only genuine absences, of which there are none.

## What this does not close

* The mixed combinations. 768 validate by rule; this reviews 5 designs, not the mixtures.
* Shape extremes: all stills are at the neutral body. Only the Human has a verified shape
  family, so Orc and Undead have no extremes to review.
* Motion. These are frozen poses; the swapping clip (Telegram **841**) is the motion evidence.
