# Undead race implementation plan

Date: 2026-09-20. Status: planned; implementation has not started.

## Approved target

The user approved [this generated concept](references/undead-approved-concept.png). Preserve this exact image as the visual authority for the Undead. Front, side, and back studies may clarify hidden anatomy and clothing construction; they must retain its design.

The defining features are a tall, gaunt humanoid; a dry skull face with a retained jaw and small amber eyes; long bony hands; a torn hood and wrapped neck; asymmetric rusted shoulder armor; crossed leather straps; layered burial cloth; wrapped limbs; and battered boots. Keep the upright, composed stance and narrow silhouette. The outfit leaves the face and hands readable.

Translate the image's detail into Ashen Reach's textured game art. Preserve silhouette, proportions, material separation, and facial landmarks at the ordinary gameplay camera. The image's churchyard supplies context; this task covers the character and equipment.

## Intended result

A selectable Undead in the active `ashen-reach.html` game, wearing a modular outfit that matches the concept, using the existing movement, spells, equipment sockets, and source animations. Complete one convincing equipped character before expanding catalogue coverage. The final race release also supports the current shared equipment catalogue and race switching without losing loadout or pose continuity.

## 1. Establish the body and asset source

- Inspect the old `public/characters/bodies/undead-v1.glb`, its Blender source, and provenance. Its older 163-joint rig is incompatible with the active pipeline; assess geometry and licensing separately from rig reuse.
- Conduct a bounded search for a licensed anatomical source only if existing geometry cannot support the approved skull and hands. Record the selected source and derivation. Otherwise author the missing forms in an isolated Blender file.
- Build the skull, jaw, neck, ribs beneath retained skin, forearms, hands, legs, and feet. Retain enough body beneath removable clothes to support unequipping. Keep hood, armor, and cloth separate from anatomy.
- Review front, side, back, and face views against the approved image. Resolve skull shape, fingers, limb proportions, and silhouette before surface polish. Budget geometry where it affects those forms; bake small detail from a detailed source when useful.

Acceptance: the uncovered body reads as the same undead character; its face and hands remain convincing without clothing or lighting concealing them.

## 2. Bind and prove movement

- Bind to the active source-compatible 65-joint architecture, preserving source animation curves and unit conventions. Reuse the current animation inventory, verifying it from the assets at implementation time.
- Establish an explicit Undead body, rig, bind, and shape version. Validate joint order, inverse binds, mesh weights, scale, normals, and exported materials.
- Audition idle, walk, run, backpedal, strafe, turns, jump, landing, both spells, and transitions in Babylon Lite. Check feet, narrow shoulders, elbows, wrists, finger bends, and jaw stability.
- Keep Havok responsible for movement and heading. Introduce race-specific motion only if live review establishes a visible need and a compatible authored clip is available.

Acceptance: a playable uncovered Undead maintains ground contact and readable anatomy throughout the existing movement and spell set.

## 3. Build the approved outfit

- Author a working “Revenant” preset: hood and neck wrap; torso cloth, straps and asymmetric shoulder armor; torn lower cloth; boots; and forearm wraps that preserve exposed fingers.
- Map pieces to the existing equipment slots. Skin soft cloth and wraps to the shared evaluated pose; author rigid armor with suitable bone weighting or supported attachments. Start with skinned cloth motion.
- Model the prominent hem tears and hanging strips. Test any alpha cutouts for sorting and overdraw. Preserve a coherent rear silhouette for the gameplay camera.
- Use matte bone, dry skin, faded cloth, worn leather, and oxidized iron. Keep amber eye emission restrained and readable under the actual churchyard lighting.
- Split body coverage to suit removable garments. Where cloth has holes, retain the underlying anatomy or an appropriate lining rather than exposing empty space through a broad coverage mask.

Acceptance: the dressed character matches the approved silhouette and material hierarchy in live front, side, rear, and moving views. Removing each item exposes a complete body without gaps.

## 4. Integrate the race and shared equipment

- Add the Undead pack and fit contract to `src/ashen-reach/main.js`, `equipment-contract.js`, and `equipment-catalog.js`; export a streamed body, garments, and manifest under `public/ashen-reach/equipment-undead/`.
- Replace the Human/Orc assumptions in `equipment-stream.js` with explicit race and fit selection. Extend body visibility mapping and fit validation for Undead.
- Enable Undead in `armory.js`, with suitable camera framing. Preserve loadouts, animated pose, sockets, and recovery after failed loads when switching races. Verify the preloaded equipment path explicitly.
- Fit existing catalogue garments to the new anatomy using the established registration and skin-transfer workflow where it produces acceptable results. Inspect narrow wrists, neck openings, cuffs, boots, and layered skirts; correct failed fits individually.
- Review sword, staff, book, and greatstaff grips on the bony hands. Preserve spell stow and return behavior. Add measured Undead grip offsets only where needed.

Acceptance: Human → Orc → Undead → Human works during motion; catalogue swaps, unequipping, mixed outfits, and failed requests preserve a coherent visible character. Unsupported combinations must never silently receive a Human fit.

## 5. Verify and deliver

- Run the relevant character, equipment, streamed-asset checks, and production build. Extend checks for Undead fit identity, coverage, and race switching where existing checks do not cover them.
- Play the active route with actual inputs. Review ordinary gameplay and close views for body deformation, cloth penetration, exposed gaps, grip contact, moving Fire Blast, stationary Lava Ball, interruption, and recovery. Correct visible defects and repeat affected checks.
- Measure the same scene before and after, without recording. Target more than 120 FPS; report render resolution, device, actor count, duration, frame times, and any remaining limitations. Profile garment geometry, materials, alpha overdraw, and retained assets if performance regresses.
- Capture and review a live MP4 showing race selection, movement, outfit swaps, and both spells. Deliver through authorized Telegram using `tg file`; include a verified VE `video/mp4` URL when publication is authorized.
- Record sources, reproducible export commands, asset contracts, reviewed evidence, and remaining defects. Update `docs/CURRENT.md` after implementation reflects the delivered state.

## Execution order

Body and source decision → compatible moving body → approved outfit in game → complete race and catalogue integration → performance and motion review → delivery.

The first implementation milestone is the recognizable Undead body with the approved outfit moving in the churchyard. Broad appearance customization, new racial abilities, additional enemy types, and further outfit families are future work.

## M11a body defect pass (2026-09-20, commits `0f9c7d7` and `499600c`)

Taken over by hand from the agent that built `undead-source-v1`. Worktree
`.claude/worktrees/m11a`, harness slot 1 (Vite 5273 / CDP 9437). Stills at
`ve-capture/m11a/fix1`, `fix2`, `fix3`, all at the gameplay camera with
`--clip Idle_Loop`; `takeover-orcctl` is the Orc control at the same camera.

### What was wrong, and what it actually was

| Reported defect | Root cause | Status |
| --- | --- | --- |
| Whole body a uniform dark olive | `bake_vertex_colours` wrote linear vertex colours straight into an 8-bit sRGB atlas. `images.new()` without `float_buffer` gives a byte buffer, and assigning `.pixels` to one stores `value*255` with no colour management, so FLESH 0.352 shipped as byte 90 and glTF decoded it back to 0.102 linear — a third of the authored brightness, everywhere. | Fixed: explicit linear→sRGB encode. Atlas dominant colour (90,88,79) → (160,158,151), median luma 88 → 158. |
| Black-void neck | Same encoding bug (0.176 → byte 45), plus a colour that was a hole rather than a shadow even corrected. | Fixed: encode + neck 0.176 → 0.093 (byte 86). |
| Garbled dark bands across the upper back | Rib banding had no normal gate, so it wrapped right around the torso; at 62 rad/m against ~2 cm vertex spacing it also aliased into chevrons. | Fixed: gated on surface normal, 46 rad/m. Gone in `fix3/…-back-…png`. |
| Eyes white, not amber | Exporter writes `emissiveFactor [1, 0.457, 0.065]` with `KHR_materials_emissive_strength`, which Lite honours; at strength 7.5 both R and G clipped past 1.0. | Fixed: redder AMBER, strength 1.1. `fix3` reads orange. |
| Smooth-egg cranium | The normal bake was a no-op by construction — the "high-poly" cage was a copy of the same surfaces in the same place, so it exported a uniform (128,128,255) image at 15,960 bytes. | Normal bake dropped (there is no higher-resolution source to bake from). Curvature shading tried next (`adbbf75`) and it does not reach the dome either — see below. The cranium is **still a smooth egg**. Carried. |
| Feet not touching the ground | Not root height. `sweep-foot-gap.mjs` across Idle_Loop: Undead lowest vertex 0.0142–0.0178 m, Orc 0.0231–0.0287 m, same curve shape, never crossing — the Orc floats *more* and reads planted. It was silhouette: a 52 mm heel stub meant the leg met the floor at the back edge of a forward-pointing paddle. | Fixed: heel, arch, ball and toe lofted as one continuous sole. Lengthening the stub first (`fix2`) produced a hard T with a notch and was reverted. |
| Floor reflection shows only the head | **Does not reproduce.** Reported off a downscaled thumbnail. On the full-resolution front still the bottom 500 rows span 7 code values of luma (174–181), maximum channel spread 27 at the vignetted left edge, zero warm-saturated pixels. There is no reflection system in the preview studio — `src/character/preview/studio.js` builds a roughness-0.74 PBR disc and nothing else. | Withdrawn. |

### Correction to an earlier entry of mine

I recorded, before any rebuild, that the coincident bake cage made AO read fully
occluded everywhere and that this was what crushed the albedo. That was wrong.
Rebuilding with the cage removed moved the atlas by less than one code value
(dominant stayed (90,88,79), median luma 88 → 88), and it was that null result
that exposed the encoding bug. The cage is still gone, because the rest of the
reasoning held: it was a copy of the same surfaces, so the normal bake could not
have produced detail. AO is now a genuine self-occlusion bake at 0.25 m ray
length and logs `min/mean/max` so it cannot silently go flat again.

### Carried defects

- Cranium has no relief: the scan's detail is all in the face, the dome is bare.
  **Tried and ruled out for derived signals, not untried.** AO returns 1 on a convex
  dome; the normal bake had no higher-resolution source; and the curvature term added
  in `adbbf75` moves the dome by a mean of 0.86 of 255 against 2.82 over the skull as
  a whole, with what little it gets confined to the lower edge where the dome meets
  the temporal region. More gain will not help — there is no concavity up there to
  find. This needs authored geometry (parietal and occipital planes, a sagittal ridge,
  suture lines) or an authored gradient.
- Skull/neck colour boundary reads as a painted line, not a transition. Most
  prominent defect on the gameplay face still: the neck reads as a dark collar
  under a bright skull.
- ~~Shoulder mass overhangs the torso as a soft shelf.~~ **Fixed** in `c65f202`:
  radii reversed so the yoke buries itself in the trapezius and swells into a
  deltoid, path sagged so the shoulder line slopes. The arm/torso junction is
  still mushy under a raised arm — see the audition note below.
- Rib banding is effectively invisible at the new palette's compressed range.
- AO contributes very little — the surfaces are smooth convex lofts with little to occlude.
- ~~The motion audition has not been done.~~ **Done** — see below. No surface
  holes in any state. What it did surface: the yoke reads as a separate rigid
  band laid across the chest when the arm is raised, and the feet read as flat
  skis in every state.
- Feet read planted but thin, with no malleolus at the ankle. The motion
  audition makes this worse than it looked at idle: at full stride the sole is a
  flat ski with no toe box and no ankle bone, and it is the most obvious
  remaining silhouette defect after the shoulder. *Addressed across `d092e67`
  (heel, toe box, first malleolus) and `7b5dd80` (malleolus reprofiled so it
  stops reading as a collar) -- see the two pass entries below. The ankle and
  toe box now read; the arch is still out of reach for a convex loft, and the
  stride silhouette wants a re-check because the still it was judged on is
  unreliable.*

### Curvature shading pass (2026-09-20, commit `adbbf75`)

`paint()` now derives a per-vertex cavity term from the edge neighbourhood and
darkens towards `BONE_DEEP` / `FLESH_DARK` where it is positive. The amplified
`fix3`→`fix5` difference is confined to anatomically correct places: orbit rims,
nasal aperture margins, maxillary and temporal fossae, under the zygomatic
arches, tooth gaps.

| Region (gameplay face still, 1280×1600) | mean abs diff | max | px > 4 |
| --- | --- | --- | --- |
| Skull, x 520–730 y 690–1010 | 2.82 | 61 | 10762 / 67200 (16.0%) |
| Dome only, above the orbits | 0.86 | 61 | — |

Doubling `CAVITY_GAIN` 6 → 12 doubled the skull mean 1.43 → 2.82. That is the
control: a live-scene pixel diff on this project otherwise sits inside a
2.751-mean noise floor and carries no signal, so an effect that tracks the gain
linearly is the term and not the animation.

Kept on its own merits. It is a refinement of the close read, not a silhouette
fix — at the gameplay camera the head is about 250 px tall and the change is
subtle. It does not resolve the cranium, for the reason recorded above.

### Motion audition (2026-09-20)

Six states captured at the gameplay camera, front and side, `t=0.35`:
`Walk_Loop`, `Jog_Fwd_Loop`, `Sprint_Loop`, `Jump_Loop`, `Sword_Attack`,
`Death01` (`ve-capture/m11a/motion`). Previously only `Idle_Loop` had ever been
looked at.

The check that matters for a rig is whether extreme poses tear the surface
open. Counting pixels below luma 30 over the whole frame — the darkest
legitimate flesh shading on the clean idle front measures 42, and the shoulder
gap fixed in `c65f202` measured 46 pixels down to 13 — across all twelve
captures:

| | worst count | darkest |
| --- | --- | --- |
| all 12 motion captures | 3 px | 23 |

So nothing opens. The new deltoid in particular holds under `Sword_Attack`'s
fully extended arm and under `Sprint_Loop`'s drive, neither of which existed as
test cases when it was shaped.

Two defects the audition found that idle did not show:

- **The yoke reads as a separate rigid band** laid over the chest once the arm
  is raised (`Sword_Attack`, front). It is skinned to Shoulder/Arm and slides
  over the torso as a unit rather than blending into it. Not a hole, but it
  reads as a stuck-on piece.
- **The feet are flat skis.** At full stride (`Sprint_Loop`, side) the sole has
  no toe box, no arch break and no malleolus, and it is long enough to read as
  a ski rather than a foot. Worse in motion than at idle, where the pose hid it.

Nothing here is accepted. The branch is staged for review.

### Foot + atlas pass (2026-09-21, uncommitted then `fix12`)

Claude's session died while locating 4 new luma<30 pixels on Idle side after the
malleolus/toe-box rebuild (`fix11`). They were atlas leaks, not holes:

| still | px | where |
| --- | --- | --- |
| fix11 idle side | 4 | 599,337 (jaw) and a 3-px slit at 689,695–697 (torso) |
| fix11 sprint side | 3 | torso specks |

`smart_project` re-packs whenever the foot gains verts, so a 1-px island gap
sampled the unfilled (black) atlas. Fix: seed the albedo with authored `FLESH`,
raise `island_margin` 0.006 → 0.012, dilate 4 → 8. Also shortened the heel
72 mm → 48 mm behind the ankle so the sole is less of a ski.

| still | luma<30 |
| --- | --- |
| fix12 idle side | 0 |
| fix12 sprint side | 0 |
| fix12 idle/sprint front | 4–7 px in the orbits/teeth, same region as fix9 |

Feet still read as paddles at stride. The arch remains out of reach of this
loft (convex tube). Yoke-as-band, smooth cranium, and skull/neck collar are
unchanged. Evidence: `ve-capture/m11a/fix12`.

### Ankle pass (2026-09-21, `fix13`, commit 7b5dd80)

The malleolus from `fix12` was built the wrong way round. `tube()`
implements `over_start` by extending the first ring along its own axis *at
that ring's radius*, so a 0.041 top ring buried 40 mm into a shin that ends
at 0.033 is a wider sleeve slid over a narrower bone. It rendered as a hard
seam ring with a flat band under it -- a collar, not an ankle. Four rings
now, swell moved *below* the junction where a malleolus actually sits, top
ring undercutting the shin. The junction crease is gone; the bulge is
subtler than `fix12`, which is the trade for losing the step.

| check | result |
| --- | --- |
| luma<30, side Idle / side Sprint / front Idle | 0 |
| luma<30, front Sprint | 1 px at (664,303), inside the eye orbit -- authored `BONE_DEEP` beside the emissive eye, not a gap |
| `measureGroundedSole`, Idle_Loop t=0..1.2 | 0.0135-0.0172 m against 0.0142-0.0178 m before the foot pass: unchanged |
| `npm run test:character` | 75 pass, 0 fail |

**Correction to the entry above, and a caution about the stored stills.**
`fix12`'s own side-Sprint PNG is not a reliable frame. Three fresh captures
of the *same* build (`ctrlS1/2/3`, taken before the `fix13` rebuild) agree
with each other to 0.01 % of pixels and max channel delta 3, but disagree
with `fix12`'s stored Sprint still by 6.8 % and max 407 -- a visibly
different leg pose. I could not find the cause, so I do not know which
invocation misbehaved; I only know the stored one is the outlier. The
"feet still read paddles at stride" note above rests on that still and
should be re-checked rather than trusted. The `fix13` before/after was
taken against `ctrlS1`, re-shot by hand, for this reason.

Two related instrument notes, both found by running a same-binary control
first rather than after:

* The capture itself *is* deterministic when it behaves -- 0.01 % between
  runs -- so a single-digit luma<30 count is meaningful. But a count taken
  from a still whose build or frame is not pinned is not. `fix11`'s 4 px
  were captured at 20:50 against a GLB that was rewritten at 21:12; that
  still describes the pre-`d092e67` build, not the one shipped.
* The gameplay camera pivots on the feet, so a foot-geometry change shifts
  the whole body in frame. A fixed-pixel crop is not a matched framing
  across a foot change; locate the feature in each still instead.

`scripts/character-assets/measure-foot-gap.mjs` hangs indefinitely when run
standalone and dies with "Execution context was destroyed" when anything
else drives the same CDP browser. The numbers above came from
`BODY_PREVIEW.measureGroundedSole()` directly. The script needs repair
before it is trusted again.

Still carried: yoke-as-band when the arm is raised, smooth cranial dome,
rib banding invisible at the compressed palette, AO contributing little on
smooth convex lofts, and the arch (out of reach for a convex loft). Nothing
here is accepted; the branch is staged for review.
