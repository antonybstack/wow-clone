# Source-motion recovery implementation — 2026-09-17

This report records the source-compatible Human foundation and root-route comparison. The active Ashen integration and current spell/motion state are in [CURRENT.md](CURRENT.md). Its old milestone wording is descriptive evidence, not a task queue.

## Result and scope of this pass

A playable Human candidate uses the original character-lab animation curves on
an anatomically fitted source-compatible rig. This is our Human mesh, hair,
eyes, brows, skin textures and shorts, not a recolored mannequin.

Open `http://127.0.0.1:5173/?character=human-source` for the candidate, or
`?character=source-reference` for the original mannequin with identical clip
selection. Both use the real starting zone, existing Havok movement and Lite
animation manager. The default Human mage is not replaced yet: its garments
require new compatible fits for this different skeleton.

Milestone 1 has a working reference in gameplay. Milestone 2 has a source-driven
Human candidate and the first live comparison. This is an integration milestone,
not final character art acceptance. Equipment, hand contact, more exhaustive
skin deformation review, directional movement and jump/cast transition polish
remain. Orc/Undead have not been migrated.

## What we tested and rejected

The existing MIT reference project retargeter was tested directly without
modifying that project. `scripts/experiments/retarget-source-human.mjs` reproduces
the second trial. Exact tested upstream file hashes are recorded in
`.cache/source-motion/retarget-r2.json`; this rejected experiment still requires
the external reference checkout. Its diagnostic output is `human-retarget-r2.glb`; it does not overwrite the
source-binding candidate.

1. R1 automatic mapping selected MH `spine01`/`spine02` for the wrong source
   levels and omitted all 30 finger rotation tracks. It also applied centimetre
   root displacement as metres, moving the Human below the ground.
2. R2 supplied explicit aliases from the existing bone map and an animation-only
   metre-unit input. All 45 clips then had all 53 channels, with original times.
   But source sprint at 0.166667 s leaned 33.2 degrees versus Human 56.1;
   source idle at 0.5 s leaned 0.3 versus Human 18.7. Matched screenshots showed
   the same systematic posture mismatch. The retargeter also has a virtual
   T-pose path independent of its AUTO_APOSE_CORRECTION toggle; zero sliders
   do not mean no automatic rest-pose treatment.
3. Per the recovery plan, retarget tuning stopped after that mapping correction.
   No new full-body retarget solver or procedural gait was added.

Rejected trial evidence was previously stored under `ve-capture/source-motion/r2/`; that local capture directory was removed during cleanup. R1/R2 GLBs remain in `.cache/source-motion/`. Their successful file export was not visual acceptance.

## Implemented pipeline

Pinned authoring dependencies: glTF Transform core/extensions/functions 4.4.2,
gl-matrix 3.4.4. These are dev dependencies, not browser imports. Blender performs
the rest-mesh deformation; glTF Transform assembles the resulting asset.

From the repository root:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --python scripts/character-assets/bind_source_human.py
node scripts/experiments/bind-source-human.mjs
node --test scripts/test-source-motion.mjs
```

`bind_source_human.py`:

- Imports the canonical animated Human so the current corrected body weights
  are retained; clears animation state and evaluates the rest pose.
- Reposes Human A-pose arms into the source rest-arm directions using Blender's
  existing pose evaluation and armature modifier. This changes the bind mesh,
  not the source animation.
- Retains Human hip socket, knee, ankle, shoulder, elbow, wrist and finger centres.
- Uses the midpoint between Human hip sockets as the new pelvis centre. The old
  MH Hips point is a posterior rig pivot; treating it as the source pelvis
  introduced a constant torso tilt in the first binding trial.
- Fits the source torso rest curve between anatomical pelvis and neck height.
  Preserves source spine curvature rather than identifying its levels by MH
  spineNN names. Retains Human head height.
- Collapses MH helper/face influences into supported source ancestors. The MH
  spine chain has an explicit mapping: Spine/spine04 → source Spine;
  Spine2/spine02 → source Spine1; spine01 → source Spine2. This is rig binding,
  not replacement motion. Fine face bones are not present in this first 65-joint
  candidate; a future face rig must remain subordinate to the deformation rig.
- Exports five Human surfaces, with UVs/materials and mapped normalized weights,
  plus fitted joint centres into `.cache/source-motion/`.

`bind-source-human.mjs`:

- Starts from `public/characters/base.glb` and removes mannequin geometry.
- Keeps the original 65-joint hierarchy and local rotation frames.
- Fits joint translations, recomputes inverse binds, attaches Human surfaces and
  remaps their skin palette by exact source names.
- Copies every original animation rotation key, input timestamp and interpolation
  unchanged. Hips translation gets only a constant rest-origin offset; its
  animated displacement remains identical to the source in source units.
- Writes `public/characters/candidates/human-source-v1.glb`. No runtime retarget,
  procedural locomotion replacement or new physics controller is introduced.

The first binding trial still leaned because it retained the MH posterior Hips
pivot. The second binding fit uses anatomical hip centres and the source torso
rest shape. Captures are labelled `bind-v1` and `bind-v2`; these are iteration
labels, not separate production body profile IDs.

## Fidelity evidence

The former `ve-capture/source-motion/bind-v2/` directory contained matched screenshots, joint traces
and a continuous video for each visual. `scripts/experiments/review-source-motion.mjs`
reproduces the comparison in owned Chrome CDP 9337. It uses the same Lite module
graph as Vite, pauses the normal body update for matched-time screenshots, then
reloads and drives real keyboard gameplay.

| Clip/time | Source torso lean | Human torso lean |
| --- | ---: | ---: |
| Idle / 0.5 s | 0.3° | 0.3° |
| Walk / 0.333333 s | 4.5° | 4.5° |
| Sprint / 0.166667 s | 33.2° | 33.2° |
| Sprint / 0.333333 s | 30.1° | 30.1° |
| Jump start / 0.15 s | 12.5° | 12.5° |
| Jump loop / 0.15 s | 1.0° | 1.0° |
| Landing / 0.15 s | 24.7° | 24.7° |
| Cast / 0.3 s | 2.0° | 2.0° |

These measure Hips→Neck in capsule space and demonstrate preserved skeletal
coordination at the sampled poses. They are not a claim that skin surfaces,
contact or the whole animation have been visually perfected.

`test-source-motion.mjs` checks all 45 clips, exact rotation arrays and timing,
constant-only hip displacement offset, fitted inverse-bind consistency, skin
palette/weight validity, Human surface identity and exact runtime clip selection.
The relevant regression batch passed **53 tests**, and `npm run build` passed.

Actual keyboard evidence was captured under the former `ve-capture/source-motion/play/` directory. All eight checks passed: run, walk, left turn, right turn, jump,
land, target, and all five spells hitting the dummy. No page errors were recorded.
The screenshot and video were sent to Telegram (messages 504 and 505). This proves functional spell use, not a finished armed pose.

The first terrain run recorded an unexpected real jump impulse during W-only
travel. Its input origin was not captured, so it is retained as failed evidence,
not silently discarded. The harness also initially counted only lowercase
`jump*` clip names and missed source `Jump_*` blends. After making that check
case-insensitive and adding key-event logging, the repeat passed all **seven**
checks: downhill/uphill without false air entries, standing/moving/repeated jumps,
ledge fall and visible animation crossfades. The repeat key trace contains only
the intended W events during terrain travel. See
the former terrain-jump-repeat report; physics code was not
changed to make the repeat pass.

## Original timing discrepancy diagnosed

The previous Blender retarget pipeline sets scene FPS to 30 before importing the
source, but later hardcodes `fps_src = 24`. A fresh isolated import confirms source
ranges Idle 0–75, Walk 0–40, Sprint 0–20 at scene FPS 30. Interpreting those frame
ranges as 24 FPS stretches duration by 25%, before subsequent bake/export endpoint
rounding. This explains the main timing drift. The exact contribution of the old
endpoint handling to the final 3.166667/1.7/.866667-second outputs was not separately
isolated. The new pipeline retains the source 2.5/1.333333/.666667-second durations
without Blender animation re-export.

## Short performance sample

The former source-motion performance report recorded all frame intervals
for 19.24 seconds at 1440×900 after 15 seconds of warm-up, without video capture.
The route includes idle, sprint, turning and walking. It measured **141.98 FPS**
unfiltered average, 6.9 ms median, 7.7 ms p95, 13.8 ms p99 and 14.7 ms maximum;
40 of 2732 frames exceeded 8.333 ms. The cadence is consistent with a 144 Hz
refresh limit. This demonstrates >120 FPS average for this short body-only route,
not uncapped headroom, every-frame >120 FPS, a full performance gate, or final
clothed/race performance. The normal interactive candidate remains open in
owned Chrome 9337 at the starting zone.

## Remaining work and next handoff

1. Finish the focused Human deformation review in motion, especially shoulders,
   wrists/fingers, hips, knees and planted feet. Preserve original gait curves.
2. Add a versioned Human source-rig profile and compatible garment fit manifests;
   rebind/repose the existing coat, trousers and boots through this pipeline.
   The old 163-joint garment binds cannot be used on the new 65-joint candidate.
   Do not bypass fit signatures or socket-parent garments.
3. Use existing weapon-ready and channel clips already in the 45-clip library.
   Current exact mapping exposes the simple shoot clip, but channel pose support
   is still absent. Hand-grip correction must remain narrow and must not replace
   body locomotion. Staff socket offsets from the old Human rig are not reused.
4. Review actual jump timing against Havok. Source Jump_Start is 1.333333 s,
   longer than the gameplay ascent; current state machine changes to Jump_Loop
   near apex and limits stationary landing recovery to 450 ms. Coordinate the
   existing clips with events, keeping the original curves as the reference.
5. Promote a clothed, reviewed Human only after these checks, then migrate Orc
   and Undead using the same source-compatible conventions with distinct binds.
6. Measure representative performance without recording/other active scenes.
   No uncapped >120 FPS claim is made from video captures.

Keep the accepted support-plane, airborne-grace and Lite mixer fixes. Do not
resume mage_motion.py gait tuning. Preserve old candidates and capture labels;
make improvements against this source reference, not arbitrary ideal angles.
