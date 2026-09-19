# Character authoring and motion — current contracts

Use for actual rig, mesh, garment or animation work. Start with [current direction](../../../../docs/CURRENT.md) and [character contracts](../../../../docs/character-system-north-star.md). The old mage/procedural-motion and judge-loop recipes have been removed.

## Preserve the compatible source foundation

- Ashen uses the fitted Human on the original 65-joint source bind, with 45 original animation clips. Directional imports and split spell clips extend it; current asset count is in CURRENT.md. Do not substitute the old 163-joint Human/Orc/Undead assets without a compatible fit/animation plan.
- Inspect license, source rig and units before using an asset. Audition authored clips on the actual skinned character at comparable phases. A plausible clip name is not proof of useful movement.
- For new body/garment geometry, use a credible anatomical/skin pipeline. Do not auto-weight a lathe/cloak cone as a body, hide deformation with oversized garments, or reuse incompatible inverse binds. The playable Orc is the print-sculpt collapse in [the sculpt pipeline](../../../../docs/orc-sculpt-pipeline.md): keep the FBX as a bake cage, collapse (do not voxel) the print head so eyelid slits survive, export tangent normals, and do not park dummy spheres on the brow. Do not warp a MakeHuman mesh with ellipsoid muscle tables. `mesh.fill()` on the loincloth becomes a cone; skip it.
- One evaluated pose drives compatible body/garments. Rigid gear uses evaluated sockets; soft garments require skinning. Joint scene-node parenting does not automatically follow Lite's evaluated skin pose.

## Unit and binding pitfalls

The source rig stores centimetre joints under a .01 root. Directional pelvis translations copied out of a normalized retarget hierarchy became 100 times too small. Convert through the source parent world transform and back through the retained target parent inverse transform. The existing upstream retargeter supplies rotations; do not write another solver without evidence it is necessary.

Original joint names alone do not establish bind compatibility. Check order, rest hierarchy, inverse binds and mesh transforms. A source pelvis pivot is not automatically the anatomical hip centre. Blender import/export timing uses scene FPS; preserve seconds or actual importer FPS instead of assuming 24.

A valid joint trace does not prove mesh quality. Inspect the actual mesh at matched phases and in real input-driven motion. Controller grounded state and ankle/socket origins are not visual sole-contact measurements.

## Cast layers and timing

- Fire Blast and Lava Ball adapt compatible authored `Punch_Cross` / `Idle_Loop` motion offline. Preserve original curves/binds and record the derivation, release marker and license.
- Split upper/lower joint channels with a shared reference pose; use native Lite additive evaluation over full-weight locomotion. Fractional ordinary weights can shrink translation/scale contributions toward zero.
- Moving Fire Blast retains the gait; after travel/turn suppresses the stance, keep it suppressed through recovery. Exclude automatic target alignment on the first cast frame from the travel test.
- Lava Ball charges while stationary. Cancellation must coordinate body easing, charge sound, particles and HUD. Release starts cooldown; projectile collision applies damage. Clearing target after launch does not recall flight.
- View anticipation, release and recovery from rear and side/front. Keep caster and target framed for projectile review; effects can conceal a poor pose.

## Tools and evidence

Blender is useful for authoring/rebinding; it is not required to reuse glTF animation curves or build effects. Keep character work isolated from the live shrine. The actual Lite game is the visual authority. Reuse relevant rig/asset tests, then play and inspect video; do not substitute a validator or Blender still for gameplay quality.

Detailed evidence: [source recovery](../../../../docs/source-motion-recovery-implementation-2026-09-17.md), [gait/contact](../../../../docs/gait-contact-and-landing-2026-09-17.md), [Fire Blast](../../../../docs/fire-blast-body-animation-2026-09-17.md), [Lava Ball](../../../../docs/lava-ball-first-spell-2026-09-17.md).
