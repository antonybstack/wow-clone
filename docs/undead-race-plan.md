# Undead race implementation plan

Date: 2026-09-21. Status: in progress. Uncovered body is playable on the 65-joint source; revenant clothes are not fitted yet.

## Approved target

The user approved [this generated concept](references/undead-approved-concept.png). Preserve this exact image as the visual authority for the Undead. Front, side, and back studies may clarify hidden anatomy and clothing construction; they must retain its design.

An [unclothed body study](references/undead-body-reference-v1.png) was generated on 2026-09-20 for anatomy modeling: front, side, and rear views with a neutral pelvis and exposed hands and feet. This is a proposed interpretation of the concealed anatomy, pending user review. The side view's arm pose differs from the front/rear A-pose; reconcile that when modeling. Use the sheet as a visual reference, not a mechanically exact turnaround.

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
