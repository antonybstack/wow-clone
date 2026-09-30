# M006 — the character creator surface

Status: **implemented, measured and visually reviewed.** M006 as a whole is still open: the
creator is done, the source-art gate is not. See
[the neck albedo result](m006-old-head-neck-albedo.md).

Reviewed clips: Telegram 811 (the original surface), **815** (saved/restored visual
equivalence) and **817** (merged into the Armory, which supersedes 811's layout). All
1280x720, verified.

## The rule the surface enforces

A control is offered only when the capability behind it has been verified.

M004 verified two things on the Human: a two-target shape family over the shipped body, and
a uniform height the gameplay capsule already accepts. Everything else the creator is
eventually meant to offer is an open art gate, and `HUMAN_SHAPE_CAPABILITIES` already says
so — `faceOrAge: false`, `dyes: false`, `hair: false`. `creatorControlsForRace` reads those
flags rather than restating them, so when a gate closes the control appears with no change
to the creator.

Unverified controls are **declared and shown disabled with the reason**, not dropped and not
offered anyway:

| control | state | why |
|---|---|---|
| Height | offered | M004; clamped to the `player.setHeightScale` range 0.90–1.15 |
| Build (slender/stout) | offered | M004 morph targets over the shipped body |
| Adult age | disabled | not distinct enough on the candidate head |
| Skin tone | disabled | no accepted dye channel |
| Hair | disabled | the long-hair candidate is fused to the scalp, 22.5% of above-brow vertices |
| Hair colour | disabled | needs both an accepted hair mesh and a dye channel |

Orc and Undead have no verified body family, so every control reports unavailable and
`defaultCreatorState` for them is empty. An unknown race is an error, not an empty creator.

## What was proved live

`scripts/character-assets/check-creator-live.mjs`, on one owned harness slot:

| claim | result |
|---|---|
| only verified controls reachable | sliders `Height`, `Build: slender`, `Build: stout`; no choice controls; 4 disabled with reasons |
| two distinct Humans | A slender 0.85 / height 0.93 / capsule 1.626 m; B stout 0.95 / height 1.15 / capsule 2.010 m |
| they actually look different | **41.9%** of pixels differ between the two screenshots |
| both proof outfits, both characters | Wayfarer and Graveweaver applied to A and to B |
| state survives a reload | restored `true`, height 0.93, and applied to the body, not just held |
| undo | returns the previous height **and** drives the body and redraws the slider |
| touch input | 33.6 px slider at 390x844; a drag moved height 1.00 → 1.15 |
| default cold start unchanged | no creator, no panel, `ASHEN.humanShape` null |
| page errors | none |
| **saved/restored visual equivalence** | cross-reload **13.1%** of pixels against a same-run floor of **14.0%**; two different characters differ by 42% |
| **visible loading/errors** | a forced 500 on the body asset surfaces an error and reports the game not playable |

Shape is proved by pixels as well as by state, because a weight vector in `ASHEN.humanShape`
only says the game was *told* to reshape. Morph deltas compose before skinning, so bounding
info does not move and cannot be used for this.

19 contract tests cover the pure surface, including that a hand-written saved record cannot
smuggle in an unverified control, that prototype pollution in storage is rejected, that a
record from another schema version or another race is discarded rather than reinterpreted,
and that blocked storage never prevents a cold start.

## Lazy loading

Confirmed from the build output rather than from the import syntax: `creator.js` compiles to
its own 5.5 KB chunk and appears in none of the ten entry scripts of `ashen-reach.html`.
`?creator=1` is what triggers the import.

The creator does load the M004 candidate body even at weight 0, because the shipped body has
no morph targets and cannot be reshaped afterwards, and it takes the M005 refitted garment
pack so the outfit follows the body. Both are developer assets under `.cache/`, so the
creator route is a developer route; the default route is untouched.

## Design notes

`setHumanShapeLive` was added beside `applyHumanShape`. The existing one is a one-shot: it
multiplies the camera pivot by the height scale, which is correct once and compounds if it
is called again, so a slider dragged back and forth would not return to where it started.
The live setter derives every value from the neutral baseline and drives the capsule through
`player.setHeightScale`, so collision never disagrees with what is drawn.

`creator.undo()`, `.reset()`, `.clear()` and `.set()` are exposed and do the session change,
the redraw and the body update together. Calling `session.reset()` directly changed the
state and left the sliders and the character showing the old one — a silent disagreement
between what is stored, what is drawn and what is on screen. The first recording caught it:
the clip opened on the previous character while the status line said it had been reset.

The phone breakpoint is `(pointer: coarse), (max-width: 760px)`. The width clause is there
because a coarse pointer is not reported in every remote-controlled browser, which would
have left the phone layout permanently untested; 760px is the breakpoint the armory already
uses.

## Not done

- The one-second playable startup gate has **not** been re-measured on a production build
  this session. The creator is code-split out of every entry chunk and the default route is
  unchanged, so no regression is expected, but expected is not measured.
- Solo FPS has not been re-measured either.
- The appearance recipe (M002 schema 1) still advertises an empty `shape` object. The
  creator persists its own versioned record instead; folding shape into the recipe needs the
  migration fixtures that contract asks for, and is not part of this surface.


## Closing the last two exit criteria

M006's exit is "saved/restored **visual** equivalence and input/device usability, **not merely
working sliders**", plus "visible loading/errors". State equality and applied weights were
already proved; pixels and error surfacing were not, so both were added to the live check.

**Visual equivalence** compares a character before saving against the same character after a
full page reload, in the armory with the animation paused and the player reset to spawn. The
claim is not "the frames are identical" — the churchyard is not deterministic — but that
reloading changes the picture no more than re-posing the same character already does:

| comparison | pixels differing |
|---|---|
| same character, re-posed in one run (the floor) | 14.0% |
| saved then restored across a reload | **13.1%** |
| two *different* characters | 42.0% |

The floor took three corrections before it meant anything, each found by looking at the
frames rather than trusting the number:

1. The armory camera targets the player's feet, so where the character settled on the terrain
   framed the shot. Two runs settle differently, which alone moved 13% of pixels and read as
   a restore failure. Fixed by resetting to spawn first.
2. Foliage was still streaming during the first posing and not the second. Fixed by waiting
   for `ASHEN.ready`.
3. `ASHEN.reset()` switches to the reference camera, and `armory.open()` returns early when
   the armory is already open — so the second posing left the reference camera active with
   the panel showing and **no character in frame**. That was the 68% "noise floor": an empty
   frame. Fixed by closing the armory before resetting.

A difference mask was what exposed the first of these: the differing pixels were grass, with
the character's silhouette standing out as *unchanged* black against it.

**Loading and errors**: the body asset is forced to 500 and the check asserts that an error
reaches the DOM and that `ASHEN.playableReady` stays false. Falling back quietly to the
default character would be the worst outcome, because it looks exactly like the saved
character was lost.


## Merged into the Armory

The first version was a second panel that hid the Armory's equipment panel while it was open
and opened itself on the `?creator=1` route. Two inspection surfaces for one character is one
too many, so the controls now live in the Armory's own panel as a `BODY` section: Race, then
Height and Build, then Equipment.

What changed with the merge:

- **No separate open/close.** `C` opens the Armory, `Esc` closes it. `creator.open()` and
  `close()` remain and delegate, so existing probes and capture scripts keep working.
- **No Save button.** A change persists when the slider is released — `change` rather than
  `input`, so a drag writes to storage once instead of once per frame — and on undo and reset.
- **The unaccepted controls collapse** into `Not available yet (4)`. They still carry their
  reasons; they just no longer crowd the equipment list they now share a panel with.
- **The status line only appears when it says something.** A permanent "Starting from the
  default character." costs a row to state what the sliders already show. Reset says nothing
  either, for the same reason: the sliders visibly jump.
- **The section appears on every route**, not only `?creator=1`. The sliders can only move a
  body that carries the M004 morph targets, so on the default route they render disabled with
  a line explaining how to enable them. Vanishing entirely would leave no trace of why.

That last point changes a test. The cold-start check used to assert `ASHEN.creator` was null
and no panel existed; it now asserts the section is present, every control is disabled,
`drivable` is false, the note names the flag, and — unchanged, and the part that actually
matters — the default route applies no shape. Offering live sliders over a body that cannot
move is exactly the fake capability this surface exists to avoid.

The Armory panel already had `overflow: auto`, so the taller content scrolls; the equipment
slots below the fold and the return button remain reachable.
