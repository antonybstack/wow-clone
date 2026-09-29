# M006 — the character creator surface

Status: **implemented, measured and visually reviewed.** M006 as a whole is still open: the
creator is done, the source-art gate is not. See
[the neck albedo result](m006-old-head-neck-albedo.md).

Reviewed clip: Telegram 811 (1280x720, 17.37 s, verified).

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
