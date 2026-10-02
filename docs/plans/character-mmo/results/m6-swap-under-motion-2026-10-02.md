# Milestone 6, task 1 — every slot swapped under every motion

**2026-10-02.** Game source `8ae4c2d`, one owned rendering client, functional only. No FPS,
capacity or production claim; nothing released and no asset changed.

Milestone 6 exists because armor swapping *works* and is *under-evidenced*. What had actually
been checked before this was torso changes during walking, plus a rule-level enumeration of all
768 catalogue combinations. This closes the first of its six tasks: **every slot, during every
motion in the source set, on every published race.**

## Result

**168 of 168 rows pass** — 8 slots × 7 motions × 3 races — with zero console errors, zero GPU
errors and no pose discontinuity.
[Matrix data](../../../baselines/character-mmo/m6/swap-motion.json) ·
[check](../../../../scripts/character-assets/check-armor-swap-motion.mjs) ·
[recorder](../../../../scripts/character-assets/record-armor-swap-motion.mjs).

Reviewed live motion: **Telegram 841**, 1280×720, 20.2 s — torso, legs and shoulders changing
mid-stride, boots during a sprint, the weapon in mid-air, helmet and gloves during a Fire
Blast, the grimoire during a sword swing. Every swap in the clip records the animation label
on both sides of the change and they are identical.

| Slot | n | median ms | p95 | max | min |
| --- | --- | --- | --- | --- | --- |
| helmet | 21 | 16.1 | 27.0 | 32.3 | 7.1 |
| torso | 21 | 26.2 | 38.5 | 40.7 | 18.7 |
| legs | 21 | 26.1 | 37.3 | 38.7 | 13.3 |
| boots | 21 | 21.4 | 28.7 | 32.6 | 4.8 |
| gloves | 21 | 21.4 | 32.2 | 48.6 | 9.7 |
| mainHand | 21 | 12.5 | 20.3 | 22.1 | 6.8 |
| offHand | 21 | 11.6 | 20.0 | 20.3 | 4.7 |
| shoulders | 21 | 13.0 | 16.7 | 21.5 | 4.6 |
| **all** | **168** | **18.8** | **32.8** | **48.6** | **4.6** |

Motion makes no material difference: medians run 13.3 ms (landing) to 21.4 ms (melee), and the
three races sit within 1.7 ms of each other (Human 18.3, Orc 20.0, Undead 19.0). The worst
frame in any swap window is **14.9 ms**; **no row exceeded 16.67 ms**, let alone the 33.33 ms
gate. The single slowest swap, 48.6 ms, was a glove change in mid-air on the Undead.

These are *not* the 66.8–78.4 ms figures the milestone brief quotes. Those were measured on the
**remote per-piece renderer** that dresses presence actors; this is the local player's own
streamed equipment path, which had never been timed. The two are different code and should not
be compared.

Nor are they first-download costs. `getStatus().cached` is a bounded residency cache that
disposes idle pieces, and 119 of the 120 equip rows found the target piece **not resident**, so
almost every row rebuilt the piece — but from bytes a local dev server had already served. **No
cold-network swap cost is measured here**, and the swap budget task still needs one.

## How a pose reset is detected, and proof that it is

Comparing clip time before and after a swap does not work on its own: an idle clip that looped
once reads *lower* afterwards than it did before, so a real reset and a legitimate wrap look
alike. Each swap therefore records the wall clock across it and asserts every clip playing on
both sides advanced by that elapsed time times its speed ratio, modulo its own duration, in two
windows — immediately (median 18.8 ms) and after a further 220 ms, because a reset could land
on the material build a frame or two late.

Wrap-aware distance alone is still not enough. A control that restarted the clips mid-window
was caught on `Walk_Carry_Loop` at 0.893 s off but **missed on `Sprint_Loop`**, whose 0.667 s
duration let the restart land within 1.4 ms of where the loop would legitimately have wrapped.
So each clip also reports whether a wrap was available at all; when it was not, the clip time
going backwards is a restart with no second reading.

Run against a same-build control, the detector fires on **6 of 6** injected restarts in the
short window and stays clean on **9 of 9** untouched windows. Across the matrix, **533 clip
comparisons over 10 distinct clips** show a maximum drift of **17.2 ms — one frame** — against
the 140–890 ms an injected restart produces. Zero restarts flagged.

## What else the matrix asserts

* The request answers `applied` and the slot holds the requested piece.
* The phase is legal for that motion, and a swap during a jump never grounds the pose. A swap
  during a sprint may legitimately be ungrounded, because sprinting over uneven ground leaves
  the character briefly airborne inside `loco`; only `air -> grounded loco` is a failure.
* The new piece is a `scene.meshes` member *and* renders. A visible flag alone proves nothing
  here: an evicted mesh keeps `visible:true`.
* The replaced piece stops rendering — except for meshes the new piece also claims. Pieces share
  parts on purpose: the Graveweaver skirt is worn over the Wayfarer trousers and declares that
  mesh as one of its own, so a skirt → trousers swap must keep it.
* 48 of the 168 rows remove a piece rather than replace one, since taking armor off is a swap a
  player makes as often as putting it on.
* The resolver's own side effects are recorded rather than forbidden: 6 rows changed a second
  slot, all of them the two-handed greatstaff and the off-hand grimoire displacing each other.

## Corrections made while building this

Four of the first failures were defects in the test, not the product, and are recorded because
each one would have produced a false result in the other direction:

1. The render proof guessed the item id as a mesh name, so every correct swap failed. Garments
   declare `parts[].mesh`; factory props are named with the factory as a prefix, and
   `startsWith` is needed to keep `greatstaffWood` out of the staff's set.
2. "The replaced piece must stop rendering" failed on skirt → trousers, which is shared geometry
   working correctly.
3. The cast phase named the training dummy as its target. Tab cycles every hostile and the
   matrix walks the character away over 168 rows, so cast rows began failing for reasons that
   were not swaps. Each row now returns to spawn first and seeks a castable target.
4. `loco && !grounded` was treated as illegal, which a sprint over uneven ground produces
   normally.

The review clip was also re-shot twice. The first cut's own labels showed `Idle_Loop` through
the whole "casting" section — a cast section with no cast in it, because it pressed the key once
and swapped regardless. The second was framed from the gameplay default after a reset, too far
out to read a helmet changing.

## What this does not close

* **Task 3, the visual matrix, has not started.** 768 combinations validate by rule; twelve have
  been looked at, and this clip adds one outfit progression. Rule agreement is not review.
* **Task 4, shape extremes beyond the Human**, is untouched. Only the Human has a verified shape
  family, so Orc and Undead were swapped at neutral.
* **Task 6, the swap budget**, needs a cold-network measurement this run does not have.
* `ironSword` stowed at the hip puts its hilt inside the garment from the front. A pinned-camera
  comparison across all five Human torsos shows it **identical in every one**, so it is the stow
  transform and not a conflict with any piece. I first read it in the moving clip as a
  Duskguard-specific clash and that was wrong; the like-for-like says otherwise. Whether the
  stow pose is authored intent or a defect is a review judgement for task 3.
* An apparent left/right boot mismatch in a walking frame **did not survive** a pinned camera
  and a frozen pose: the legs are symmetric. It was pose and lighting in a moving capture.
* The `?creator=1` route cannot be used for this work. Its DEV garment-fit manifest carries
  nine items and no shoulders, Lector or Duskguard fit, so five of the eighteen catalogue items
  are unreachable there and `equip('shoulders', …)` answers `No human fit`. The default
  production route serves all fifteen garment entries and all eight slots. Nothing is wrong with
  the published packs; the candidate manifest is simply older.
