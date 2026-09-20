# Lava Ball — 1.5-second charged projectile

Implemented in the Ashen Reach route after the request for an epic, dramatic 1.5-second lava spell. Here **1.5 seconds means cast time**; projectile travel is additional.

## Play and behavior

Open `http://127.0.0.1:5173/ashen-reach.html?play&clean`. Tab targets the training dummy. **1** remains Fire Blast; **2**, or its new clickable slot, casts Lava Ball. Press once rather than holding the key.

- Lava Ball takes **1.5 seconds** to charge, deals **240 damage on impact**, has **24m range**, travels at **12m/s**, and starts its **six-second cooldown at release**.
- The cast bar shows remaining charge time. Repeated presses and other spell requests cannot replace or restart an active charge. The brief body recovery completes before another spell animation can begin.
- Movement interrupts charging. Jumping, clearing/changing target or leaving the play view also interrupts. Cancellation consumes no damage or cooldown and fades the grounded cast animation over .16s. A cast cannot start while already moving.
- Target, grounded state, range, cooldown and Havok line of sight are checked before starting and at release. A blocked initial request produces no charge effect.
- Once launched, the projectile is independent of the caster. Moving or deselecting does not recall it. Its fixed launch trajectory is swept through the existing Havok collision world each frame; a solid collision ends flight, and only a target hit applies damage. Missing collision data fails closed. Cooldown stays consumed if a launched ball hits an obstacle.
- The dummy retains its shared 600 HP and three-second recovery after defeat. Fire Blast and Lava Ball can be combined. The explosion radius is visual; this first projectile does **single-target damage**, not area damage.

## Visual and motion direction

The caster gathers embers upward into a growing molten rock at the right hand. Its dark crust is divided into irregular glowing plates by a small quantized WGSL cell shader. Flame licks orbit the core without hiding it. A warm light builds across the character, ground and nearby scenery.

The ball launches with an authored torso strike and follows a fixed path, trailing fire and embers at their recorded world positions. Impact produces a larger burst, an expanding ground-level ember ring, ballistic sparks, rising dark smoke, stronger warm lighting and a heavier dummy recoil. The effect settles within 2.1 seconds after impact.

The existing CC0 Quaternius `Punch_Cross` and `Idle_Loop` remain the animation source. This is an offline adaptation: extended anticipation, open right-hand fingers, a quick push through the release at 1.5s, and eased recovery ending at 2.3s. It uses the same source-compatible skeleton, with no new runtime pose solver or classic Babylon animation API.

The original Julien Matthey CC0 Fireball recording supplies audio. A reversed, low-pass-filtered, faded 1.5s derivative provides the charge build. Lower-pitched playback of the original supplies release and impact. Playback, cancellation, mute and recording all use the existing Lite audio engine. Source/license/derivation are in `public/ashen-reach/fire-blast/AUDIO-SOURCES.md` and `lava-audio-provenance.json`.

## Implementation map

| File | Responsibility |
| --- | --- |
| `src/spells/lava-ball.js` | Projectile launch/flight/collision rules; inherits existing cooldown, validation, damage and dummy recovery behavior. |
| `src/spells/fire-blast.js` | Existing rules now accept a spell configuration and expose damage application separately from release. Fire Blast retains its original behavior. |
| `src/ashen-reach/combat.js` | Single pending cast, animation selection, interruption/revalidation, projectile update, coordinated impact and HUD. `combat.spell` remains Fire Blast; `combat.lava` is Lava Ball. |
| `src/ashen-reach/lava-ball-vfx.js` | One molten mesh, three fixed sprite pools (64 fire, 14 smoke, 96 sparks), one point light, preallocated trail slots. |
| `src/ashen-reach/materials.js` | Separate lava light uniforms so Fire Blast and Lava Ball do not overwrite each other's world lighting. |
| `src/ashen-reach/combat-hud.js`, `ashen-reach.html` | Second spell slot, independent cooldowns, accessible cast progress. |
| `src/ashen-reach/fire-blast-audio.js` | Shared Lite audio engine with charge cancellation and distinct launch/impact playback. |
| `src/character/runtime/body-visual.js`, `src/character/body.js` | Named cast profiles, native additive upper/lower layers, selected release marker, smooth cancellation. Existing character definitions remain on their previous path. |
| `scripts/ashen-reach/prepare-lava-cast.mjs` | Reproducible motion derivation, called by `prepare-wanderer.mjs` after Fire Blast preparation. |

The generated GLB has **54 clips**: all 45 original curves, five previously imported directional motions, two Fire Blast layers and two Lava Ball layers. Both new lava layers partition 53 source channels (43 upper / 10 lower), start/end at the Idle reference, and use Lite's native additive evaluation over full-weight locomotion. Original joint binds and rest transforms remain intact. Asset hashes and the recipe are recorded in `lava-cast-provenance.json` and the main animation provenance.

No new library or GPU resource allocation per cast was introduced. Reused resources are the existing Kenney CC0 particle sprites, Quaternius authored motion, Julien Matthey audio, Babylon Lite mesh/shader/billboard/audio/animation APIs, and the Havok collision world. The procedural shader is effect geometry, not a replacement for the world's asset pipeline.

## Validation and reproduction

- **98 automated checks passed**: 75 character/rig/loadout tests plus 23 spell, projectile, gait and animation-asset checks. Projectile tests cover delayed damage, one hit, long-frame wall collision, contact points, fixed trajectories, missing physics, cooldown and mixed-spell dummy recovery.
- **49 browser checks passed**: 16 Lava Ball checks and all 33 Fire Blast/body/feedback checks. Tests use real keyboard and button input; cover charge timing, cast bar, spam, moving/jumping/target-clear interruption, flight independence, impact-only damage, audio, obstruction, separate spell cooldowns and recovery. No runtime/GPU errors were recorded.
- Production build passed. Original motion/bind comparisons remain exact.
- Foreground Chrome at **960×540 render resolution** averaged 144.00 FPS charging, 143.95 in flight, 143.99 at impact and 144.00 with overlapping Fire Blast/Lava Ball effects (246 overlap frames). Phase p95 was 7.9–8.1ms. Maximum 29 draw calls, idle 23. Four lava launches and one overlapping Fire Blast were exercised, without recording active. Full metrics are in `performance.json`.
- The first visual review found the explosion too similar in scale to Fire Blast. The final pass enlarges the burst and uses previously unused fire-pool slots for an expanding flame skirt. Charge licks sit outside the crust rather than being hidden inside the opaque core. The stronger pass is the one measured above.
- The earlier Lava Ball capture was reviewed in the live renderer and delivered through Telegram. Its local working frames and encoded file were removed during cleanup; the implementation and checks remain authoritative.

```sh
node --test scripts/test-lava-ball.mjs scripts/test-fire-blast.mjs scripts/test-ashen-animations.mjs scripts/test-gait-phase.mjs
npm run test:character
node scripts/ashen-reach/check-lava-ball.mjs
node scripts/ashen-reach/measure-lava-ball.mjs
node scripts/ashen-reach/record-lava-ball.mjs
npm run build
```

Browser harnesses use owned Chrome CDP **9337** and Vite **5173**. Capture output is ignored local working evidence. Recording reuses the existing CDP full-tab recorder and actual Lite audio mix; do not substitute staged sound.

## Boundaries and workflow learnings

- A cast timer, release and impact are separate events. Keep damage at impact and cooldown at release; cancellation before release should consume neither.
- A charge needs a cancellation path for body motion, audio, particles and HUD together. Clearing just the pending gameplay object leaves a misleading animation or glow.
- New spell profiles should reuse the current skeleton and animation manager. Use named clip pairs and release metadata rather than replacing the global Fire Blast clip or treating every number key as the same gesture.
- Shared input's key 2 historically means a held channel. Normal Ashen gameplay explicitly consumes/clears those legacy flags; `?animationLab` remains diagnostic mode.
- Separate light uniforms are necessary for overlapping effects on the custom world shader. A second effect writing Fire Blast's uniform names would erase the first effect's lighting.
- Flight uses a swept **centre ray**, not a finite-radius shape cast. This prevents centreline tunnelling across solids, but the visual ball's edges can graze geometry. Targets are currently stationary; this is not a moving-target homing or interception system.
- Ground-level ring placement samples terrain at impact centre. Highly uneven terrain would need per-fragment ground projection. No terrain deformation, lingering damage field or gameplay knockback is claimed.
- Keep single-caster, local-resolution measurements distinct from native-resolution or multi-actor performance. Static world counters do not include all dynamic spell geometry.
