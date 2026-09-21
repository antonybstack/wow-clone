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
| Smooth-egg cranium | The normal bake was a no-op by construction — the "high-poly" cage was a copy of the same surfaces in the same place, so it exported a uniform (128,128,255) image at 15,960 bytes. | Normal bake dropped (there is no higher-resolution source to bake from); the cranium is **still a smooth egg**. Carried. |
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
- Skull/neck colour boundary reads as a painted line, not a transition.
- Shoulder mass overhangs the torso as a soft shelf; the arm/torso junction is mushy.
- Rib banding is effectively invisible at the new palette's compressed range.
- AO contributes very little — the surfaces are smooth convex lofts with little to occlude.
- The motion audition across the M4 state set has not been done; only `Idle_Loop` has been reviewed.
- Feet read planted but thin, with no malleolus at the ankle.

Nothing here is accepted. The branch is staged for review.
