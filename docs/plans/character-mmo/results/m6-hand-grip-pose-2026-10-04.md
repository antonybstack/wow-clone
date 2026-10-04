# The distorted hand was a canned pose, not the mesh

**2026-10-04.** Reported from gameplay at close range — the hand looked distorted both open and
gripping. Source-only fix; nothing here is behind the republish decision.
Reviewed live motion: Telegram **847**.

## What it was

The body is 3,274 vertices with **582 weighted to finger joints**, about 291 per hand across
five fingers — low, but the geometry is not the defect.

Rendered at 2560×1440 so the subject is geometry rather than an upscaled crop, and A/B'd against
the same build with `visual.handGrips` cleared: **the fingers that come straight out of the
animation clip look right.** The canned override is what splayed and flattened them.

Two separate mistakes, both in how the override was applied:

1. **Empty hands were posed at all.** `installEquipmentGrips` returned `'relaxed'` for a hand
   holding nothing. That pose blends only 12–22% from the sample rest toward a fist and
   **replaces** the clip's finger rotations rather than adding to them, so a hand the animator
   had already curled came out straighter and splayed. The override exists to close fingers
   around a weapon; with nothing held there is nothing to close around.
2. **The override was all-or-nothing across both hands.** `evaluateHandAnimation` masked every
   finger bone out of every clip whenever any grip was active, so drawing a sword in the right
   hand also splayed the left.

## The fix

* A hand holding nothing is left `undefined` rather than given `'relaxed'`, and the provider
  returns `null` when both hands are empty.
* The evaluator now overrides **only the hands that have a kind**: it writes deferred poses for
  those bones alone, and the clip masks it rewrites exclude only those names, so an idle hand
  keeps the animation's own fingers.
* The mask cache is keyed by which hands are overridden as well as by the source mask, since the
  filtered result now depends on both.
* The `holdWeapon` branch is untouched: casting and melee still close both hands deliberately, so
  the slam does not play open spell fingers.

Verified at 2560×1440 across empty, one-handed sword and two-handed greatstaff. 162 character /
110 equipment / 5 presence tests and the build pass.

## What this does not fix

The grip **position** is unchanged: the hilt still sits low in the fist, because the measured
+60 mm that seats the crossguard is a catalogue change and sits in the republish batch
([note](m6-review-defects-2026-10-03.md)). Finger pose and weapon placement were always two
defects; this closes one of them.
