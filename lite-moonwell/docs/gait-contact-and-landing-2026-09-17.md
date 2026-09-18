# Gait contact, phase and landing pass — 2026-09-17

Scope: Ashen Reach's source-compatible Human. Keep authored motion, Babylon Lite's mixer and Havok movement. No new retarget solver, gait generator or IK system.

## Findings and changes

### Corrected a translation-unit bug in our previous import adapter

The previous directional import retained the original centimetre-based skeleton beneath its .01 parent scale, but copied pelvis translation values from the community retargeter's normalized output hierarchy. Directional pelvis displacement was approximately 100 times too small. The wider gameplay shots in the previous review did not expose this clearly enough.

`append-directions.mjs` now transforms the original source pelvis samples through their source-parent world matrix, subtracts the source rest position, adds the target rest position and converts back through the original target-parent inverse matrix. This uses gl-matrix's existing transform operations. The upstream retargeter still supplies rotations; its code is unchanged. The original 45 clips, mesh and inverse binds remain intact.

Measured with the actual Lite evaluator, before and after:

| Clip | Minimum left/right ankle height before | After |
| --- | --- | --- |
| Backward jog | .220 / .219 m | .117 / .115 m |
| Left jog | .177 / .148 m | .097 / .108 m |
| Right jog | .137 / .158 m | .115 / .096 m |

These are joint heights in the asset frame, not sole/terrain penetration measurements. The corrected directional pelvis excursion is approximately .16–.20 m, instead of .0016–.002 m. A regression test now requires the expected physical excursion under the retained centimetre rig; checking finite values and channel counts was insufficient.

### Shared gait phase

`gait-phase.js` supplies a normalized cycle clock. Ashen Reach's body definition holds measured left-ankle low-point phases for walk, sprint and directional jogs. Active locomotion clips are evaluated at the same contact-relative phase even when they have different durations. Desired primary/lateral clip cadence determines the shared cycle rate; blending no longer lets their clocks drift apart. The existing mixer continues to interpolate authored poses.

The runtime does not calculate a new bone pose, pin a foot, alter controls, or change physics speed. The contact markers are samples from this fitted asset, not universal markers for every race. Stop/restart and changes in direction preserve the phase clock. Idle and stepping-turn clips are not forced into the travel cycle.

### Lighter landing layer

The old moving landing skipped `Jump_Land`; the standing landing played its deep crouch at full weight and then stopped it early. Ashen Reach now keeps idle or locomotion as the base and layers the authored impact for .42 seconds. Peak weights are .40 standing and .23 moving, with a short attack and smooth release. Outgoing airborne poses still crossfade; landing weights stay normalized. The underlying authored landing reaches its recovery rather than freezing at the deepest crouch.

Input, velocity, gravity, support detection and the intentional-jump guard are unchanged. Other body profiles keep their previous landing behavior unless they explicitly declare this configuration. The wide airborne arm pose remains authored asset debt.

## Reproduction and evidence

```sh
node scripts/ashen-reach/prepare-wanderer.mjs
node scripts/ashen-reach/audit-gaits.mjs ve-capture/ashen-reach/<pass>/corrected
node scripts/ashen-reach/check-gait-play.mjs
ANIMATION_CAPTURE_DIR=ve-capture/ashen-reach/<pass>/play ANIMATION_EXTENDED=1 node scripts/ashen-reach/record-animations.mjs
node scripts/ashen-reach/check-animation-recording.mjs ve-capture/ashen-reach/<pass>/play
```

- `authored-gaits.json` and `corrected/authored-gaits.json`: before/after evaluation of 121 sample times for ten clips using the existing Lite mixer and joint-transform utility. The audit temporarily pauses body animation updates, restores the page afterward, and does not change game files.
- `gait-play.json`: real keyboard tests of all four diagonals and moving/standing jumps. **7/7 checks passed**. 242 samples had multiple contributing gait clips; worst contact-relative phase disagreement was approximately 2.22e-16 cycles. All 34 sampled landing frames passed weight checks, and moving landing was observed above 6 m/s with an active impact clip.
- `play/animations.mp4`: approximately 31.4 seconds of real gameplay, 960×540, 30 fps; reviewed decoded strafe, backward/diagonal and jump/landing frames. The feet sit lower in directional motion, and the standing recovery no longer drops into the full authored crouch. Foliage still obscures some contact points.
- The existing recorded gameplay checks remain **16/16 passing**, including channel enter/loop/exit, movement, jump interruption and release/repress behavior. No page errors were recorded.
- `performance.json`: uncaptured local steady view, **144.01 FPS**, mean 6.94 ms, p95 8.00 ms, 600 frames, 18 draws at 960×540. Not a native-resolution or every-action benchmark.
- Full character suite **75/75**, targeted motion/asset/phase tests **13/13**, and production build passed.

## Limits and next work

This improves foot height and temporal consistency. It does not establish zero sliding or terrain-aware sole contact. Clip stride lengths still differ from controller travel speeds, and lateral jogs are not authored slow lateral walks. Contact alignment uses one ankle marker; it does not guarantee both feet match perfectly when mixing different gait types. Inspect close front/side movement on clear ground before adding more procedural corrections. Prefer compatible authored walking and jump variants if they meet the desired posture better; evaluate an existing IK solution only if residual terrain contact warrants that work.

## Workflow learnings

- When retaining the target hierarchy from an original GLB, never assume translation channels from a normalized retarget output use the same units. Test displacement in metres, not just channel validity.
- A pose screenshot can hide a nearly frozen pelvis. Sample a full cycle and compare joint excursions.
- Matching durations alone does not align contact. Align a named contact event and share normalized phase through every blend.
- Use an authored impact as a controlled layer over travel. A full-body deep landing crouch is not required for every small jump.
