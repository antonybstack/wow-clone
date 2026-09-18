# Fire Blast: authored body motion and synchronized release

The subsequent [Lava Ball implementation](lava-ball-first-spell-2026-09-17.md) adds a separate charged cast profile and smooth cancellation while preserving Fire Blast's gesture and timing.

This report covers the Fire Blast body-motion pass. The requested improvement was a more convincing, dramatic body gesture instead of a stiff, choppy arm.

## What changed

Fire Blast now has a **1.1-second** open-hand strike: anticipation, torso rotation, a braced lower body when stationary, release, and eased recovery. A small hand ignition builds during the **0.28-second wind-up**. Damage, cooldown, sound, the main flame burst and dummy recoil start together at the release marker. Range remains 20m, damage 120 and cooldown three seconds, measured from release.

The fire follows the **right/main-hand socket**, matching the new striking arm. Walking remains responsive: its normal leg animation continues while the upper body casts. Starting movement or turning during a standing cast fades out the braced lower-body contribution; stopping again does not restore that stance halfway through recovery. Automatic target alignment at cast start is excluded from that movement test.

Jumping or clearing the target before release cancels the pending damage, cooldown, sound and ignition. The existing jump animation interrupts the gesture; clearing the target lets the gesture finish recovering. Target validity, range, grounded state, cooldown and physics line of sight are checked both before animation starts and again at release. Repeated input during anticipation cannot restart the animation or release twice.

## Existing motion research and choice

The official [Quaternius Universal Animation Library](https://quaternius.itch.io/universal-animation-library) supplies the CC0 source motion already embedded in the source-human asset. The [second library](https://quaternius.com/packs/universalanimationlibrary2.html) and [official animation viewer](https://quaternius.com/animviewer.html) were also investigated. No paid animation, new account, or uncertain-license download was needed.

The existing character contains `Spell_Simple_Enter`, `Spell_Simple_Shoot`, `Spell_Simple_Exit`, and `Punch_Cross`. I auditioned these on the actual skinned character at four phases with masks disabled. Evidence is in `ve-capture/ashen-reach/cast-motion/audition/`; `review.jpg` is the comparison sheet. The basic spell clips mainly raise, hold and lower an extended arm. `Punch_Cross` contains a stronger weight shift, bent knees, torso rotation and return, making it a better source for a forceful palm blast. The cached free UAL1 Core file used for directional locomotion did not contain an additional spell clip worth importing.

This implementation is an **adaptation of existing authored motion**, not newly captured motion or a hand-authored Blender performance. The offline recipe retimes `Punch_Cross`, opens the striking fingers using their original bind rotations, and eases into/out of `Idle_Loop`. Original joint transforms, inverse bind matrices and all 45 original clips remain unchanged. Five previously imported directional clips also remain.

## Implementation contract

- `scripts/ashen-reach/prepare-fire-cast.mjs` derives two clips: `FireBlast_Upper` (43 channels) and `FireBlast_Lower` (10 channels). They partition all 53 authored channels without overlap. Both last 1.1 seconds, sampled at 60Hz, and begin/end at the same Idle reference pose.
- Output/source time knots are `(0,0), (.12,.08), (.28,.33), (.5,.6), (.8,1), (1.1,1)`. Entry easing lasts .12s; return-to-idle blending runs from .72s to 1.1s. These are asset authoring decisions; the runtime does not procedurally pose individual joints.
- `prepare-wanderer.mjs` calls the derivation after directional imports, so a full asset rebuild includes the cast. `public/ashen-reach/fire-cast-provenance.json` records source clips, changes, CC0 license, output hash, layer counts and release marker. The main animation provenance also includes this recipe.
- `src/ashen-reach/main.js` opts this character into `castMotion`, naming the lower clip, release time and hand. Other character definitions retain their existing behavior.
- `src/character/runtime/body-visual.js` uses installed **Babylon Lite `setAnimationAdditive` with referenceTime 0**. Base locomotion stays at normal weight. Each new layer contains only its own joint channels; full-skeleton masks are unnecessary for these layers.
- `src/character/body.js` applies eased additive weights: .09s entry, .18s exit, plus lower-body suppression during travel/turn. It exposes elapsed time and the configured release marker. Existing jump/spell cleanup handles both layers.
- `src/ashen-reach/combat.js` owns one pending cast, validating before animation and committing the spell after the body update reaches the marker. `src/spells/fire-blast.js` exposes side-effect-free validation; its existing immediate `cast()` operation is now called at release.
- `src/ashen-reach/fire-blast-vfx.js` primes five existing fire sprites and the existing hand light. All final effects still use the same 100 sprites, three billboard systems and two lights. No new per-cast GPU resources or animation framework were added.

Do not replace the additive layers with fractional ordinary clip weights without checking Lite's evaluator: partially weighted translation/scale channels can collapse toward zero when their normal weight sum is below one. Keeping the full base locomotion and adding reference-pose deltas avoids that failure. The original source-authored spell-mask policy remains applicable to characters without this profile.

## Verification

- **89 automated checks passed:** 75 character/rig/loadout tests, six spell tests, three gait tests and five animation asset tests. The asset tests compare all 45 original motion curves and bind/rest transforms, validate imported motion and verify the derived layers' disjoint channels, finite keys and matching endpoints.
- **33 real-browser checks passed:** nine new cast-motion checks, 14 existing spell checks and ten feedback/LOS/audio checks. These cover anticipation, duplicate input, one release, stationary bracing, moving casts, stopping during recovery, jump cancellation, target-clear cancellation, cooldown, range, dummy recovery, solid obstruction, sound, mute and the clickable slot. No runtime/GPU errors were recorded.
- `npm run build` passed after the final runtime change.
- Foreground Chrome without recording: **143.97 FPS** during 1,108 active-effect frames, mean 6.95ms, p95 7.9ms, maximum 8.7ms. Idle averaged 144.20 FPS. Maximum 25 draws (22 idle), at **960×540 render resolution**. This is a local single-caster measurement, not native-resolution or multiplayer performance.
- `ve-capture/ashen-reach/cast-motion/fire-blast-body-motion.mp4` contains 14.7 seconds / 367 captured frames, with standing and walking casts, a camera orbit to the front/side, repeat-input rejection, and actual engine audio. No runtime errors during recording. `standing-final.jpg` and `side-final.jpg` were reviewed across anticipation, release and recovery; `body-release.png` is a still. The reference-camera orbit briefly passes a foreground prop, but the final side-view casts are visible. Captured audio peaks at -5.0dBFS (not clipped). Video and release still sent to Telegram as messages 539 and 540.
- Browser interaction uses real keyboard events on owned Chrome CDP 9337. Jump is held across several render frames; a synthetic zero-duration key press can occur entirely between frames and does not reliably exercise this game's held-key input.

Reproduce from `lite-moonwell` with the development server on 5180 and owned Chrome on 9337:

```sh
node scripts/ashen-reach/check-cast-motion.mjs
FIRE_BLAST_CAPTURE_DIR=ve-capture/ashen-reach/cast-motion node scripts/ashen-reach/check-fire-blast-play.mjs
FIRE_BLAST_CAPTURE_DIR=ve-capture/ashen-reach/cast-motion node scripts/ashen-reach/check-fire-blast-polish.mjs
FIRE_BLAST_CAPTURE_DIR=ve-capture/ashen-reach/cast-motion node scripts/ashen-reach/measure-fire-blast.mjs
FIRE_BLAST_ORBIT=2.1 FIRE_BLAST_CAPTURE_DIR=ve-capture/ashen-reach/cast-motion node scripts/ashen-reach/record-fire-blast.mjs
```

Recording captures actual keyboard-controlled play, DOM combat HUD and Lite's real audio mix. The recorder writes timestamped JPEG frames, `frames.ffconcat`, `audio.webm` and `recording.json`; align audio with the recorded `audioOffset` when encoding H.264/AAC. Measure performance separately from recording.

## Learnings and limits

1. Audition candidate clips unmasked on the actual character before choosing one. A promising name such as “spell shoot” does not imply useful torso or leg motion.
2. Animation source quality and runtime blending are separate problems. The old half-second clip began at full weight and excluded hips/legs; a new clip alone would retain abrupt transitions and lose its weight transfer.
3. Reuse a strong compatible performance, then adapt it offline. Keep source curves and skeleton contracts intact and record the exact derivation.
4. A release marker must coordinate gameplay, sound and particles. Delaying only the visual burst leaves damage and recoil visibly early.
5. Test automatic facing separately from player turning. Both alter yaw, but auto-facing on the first cast frame must not disable the entire stationary lower-body performance.
6. Once locomotion takes over during a cast, keep it through recovery. Restoring the stance immediately when input stops makes the feet pop back into a stale pose.
7. This remains a stylized strike adaptation, not bespoke cinematic acting. There is no terrain-aware foot IK, finger contact solver, or arbitrary-direction upper-body aim. The full-body source stance works best on ordinary ground. Physics/capsule movement remains authoritative and unchanged.

The next meaningful judgement is the user's review of the recorded gesture's strength and timing. Do not build a new animation framework or pursue tiny pose changes without an identified visual problem.
