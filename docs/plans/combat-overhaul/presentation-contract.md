# Combat presentation boundary — version 1

Root owns damage, timers, inputs, actors, source-rig animation and shared HUD. Opus owns this optional VFX consumer. Gameplay never waits for it; cosmetic exceptions retire the consumer without changing damage/payment (combat/presentation-events.js). C02 pure tests cover that failure path. This interface is ready for implementation; C02/C10 are not yet accepted.

## Interface

Export createCombatPresentation({engine, scene, world, player, body, sockets, audio, signal, getActor}) from src/ashen-reach/combat-presentation.js. Optional late initialization may be asynchronous. Return handle(event), update(dt), setReducedMotion(enabled), snapshot() and dispose(). Root calls update through the existing render owner after gameplay/body animation. No additional frame loop or intervals. Scene cancellation owns asynchronous completion and disposal. getActor(id, generation) returns a read-only render locator or null; never use it to resurrect an actor. World positions are {x,y,z} in meters.

handle consumes immutable value events:

- Required envelope: eventId string, actionId string or null, sourceId string, targetId string or null, targetGeneration number or null, time in simulation seconds, abilityId string or null, variant (normal or surge initially), type string.
- Optional values: position (hit/target world point), origin (source world point), amount, damageType (fire/physical), flags (critical, periodic, hostile, blocked, interruptible), releaseAt, expiresAt, remaining, radius, reason, projectileId, auraId. Missing optional fields are normal. Wall time never owns gameplay meaning.
- Input/queue events: action-input, action-queued, action-rejected, queue-clear, queue-expired. Root HUD owns them; VFX may ignore them.
- Accepted presentation: cast-start (windup), action-start (instant), action-release, cast-cancel.
- Damage/lifetime: projectile-spawn, projectile-move, projectile-end, damage, aura-apply, aura-refresh, aura-expire, proc-ready, proc-consume, ward-break, enemy-windup, enemy-contact, enemy-interrupt, actor-reset, combat-reset.
- Stable ability IDs: fire-blast, lava-ball, pyre-burst, ashen-brand, cinder-ward, quench, kindle. Enemy IDs may be shade-melee, cultist-bolt, elite-sweep.

A release is not a hit. Projectile cosmetics follow gameplay projectile-move positions and retire on projectile-end, without collision/damage calculations. Independent projectileId slots support eight local gameplay flights. Cosmetic exhaustion reduces decoration and never removes/rejects gameplay flights. Present hits on damage, never infer them from release/animation. Duplicate eventIds must not replay effects; bounded deduplication is sufficient. actor-reset invalidates attached effects for that generation. combat-reset cancels all transient presentation. Mandatory hostile windups need reserved, non-stealable readability; do not cull an actionable telegraph solely by distance.

## First implementation pass

Only new src/ashen-reach/combat-presentation.js and new helpers in src/ashen-reach/combat-vfx/ are delegated. Existing VFX/audio/assets/body/HUD stay frozen during C01 evidence. Reuse their patterns and installed Lite 1.31.1 APIs. First implement simultaneous direct impacts/projectiles and handle/update/dispose/reduced-motion contracts. Other event types can be recognized but must be reported pending until authored. Do not mark all C10 complete after this pass.

No early main-entry import, dependency upgrade, new shadows, permanent lights, per-target material clones or unbounded resources. Do not default to 1024 sprites. State a smaller provisional cap and expose occupancy/high-water/dropped-decoration counters. Hostile mechanics outrank own decoration, then ally decoration. Instants have no intentional 100–150 ms delay; root supplies accepting-frame release. Use original Ashen art, not copied Warcraft assets.

Link native API boundary comments to pinned documentation such as [Lite animation](https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/docs/lite/architecture/07-animation.md). Installed node_modules/@babylonjs/lite/index.d.ts is the callable authority. Live motion, reduced-motion playback, isolated performance, disposal and 1/8/32 effect stress are later acceptance gates, never inferred from source tests.
