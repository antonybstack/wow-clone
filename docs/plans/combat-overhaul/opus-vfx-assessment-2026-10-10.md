> Advisory source assessment; see [root decisions and corrections](plan-2026-10-10.md#opus-vfx-assessment-and-root-decisions) before implementation.

# Combat VFX/audio/animation overhaul: assessment and plan (planning only)

## Scope and how this was produced

- **Who wrote this:** Claude Opus 5.5 (`claude-opus-5-5`), effort high as requested. I could not
  verify the effective effort setting.
- **Source:** frozen at `a7df082`. Planning only: nothing was rendered, built, tested,
  benchmarked or edited, and this file is my only write.
- **Evidence labels:**
  - **[S]** source-inferred: read in code at a7df082.
  - **[A]** API presence checked: `import('@babylonjs/lite')` in the installed `node_modules`,
    which is version **1.31.1**.
  - **[D]** docs only: the Lite docs MCP serves **1.32.0**, so behaviour on 1.31.1 is unverified.
  - **[V]** visually observed: **none**. Nothing in this document is visually observed.
- **Ownership:** Root owns the overall combat plan. Grok owns deployment and the live browser.

## 1. Current evidence (all [S])

| Area | File | What exists |
|---|---|---|
| Combat orchestration | `src/ashen-reach/combat.js` (817 lines) | See notes below. |
| Spell rules | `src/spells/fire-blast.js`, `lava-ball.js`, `grave-pulse.js` | See notes below. |
| Fire Blast VFX | `src/ashen-reach/fire-blast-vfx.js` | See notes below. |
| Lava Ball VFX | `src/ashen-reach/lava-ball-vfx.js` | See notes below. |
| Pyre Burst VFX | `src/ashen-reach/grave-pulse-vfx.js` | 218 sprites (`FIRE_COUNT`, `SPARKS` and `SMOKE` constants), 3 lights, 1 mesh. Charge lasts 1.1 s and the burst 1.7 s. |
| Audio | `src/ashen-reach/fire-blast-audio.js` | See notes below. |
| Animation | `src/character/runtime/ashen-playable-motion.js`, `src/character/body.js` | See notes below. |
| HUD | `src/ashen-reach/combat-hud.js` | See notes below. |
| Melee | `src/ashen-reach/auto-attack.js` | Swing timer, weapon profiles, and the hit resolved at `meleeRelease`. |
| Enemies | `src/ashen-reach/enemies.js` | A state machine. No hit-reaction, flinch or flash path was found. |
| Accessibility | (all of `src/`) | `prefers-reduced-motion` appears only in `loading-screen.css`. The combat JS has no reduced-motion path. |
| Post | `src/ashen-reach/post.js` | Lite `createBloomPostProcessTask` is already in the HDR chain. |
| Assets | `public/ashen-reach/fire-blast/` | `fire_01`, `smoke_01` and `spark_05` (one 512 px cell each), `fireball-julien-matthey.wav`, `lava-charge.wav`, plus provenance files. |

**combat.js**
- Constants: `GCD = 1.5`, `CAST_MOVE_SCALE = 0.4`.
- `beginSpell` / `cancel` / `impact`, with a hardcoded `key === 1|2|3` branch.
- `queuedCast` is accepted only within 20 ms of release, and never for key 2.
- The HUD cast times (1.5 and 1.1) are duplicated literals.

**Spell rules**
- Fire Blast: 120 damage, 20 m range, 1 s cooldown, applied at release.
- Lava Ball: 1.5 s cast, 20 m/s, swept through `raycast`, with a single `this.flight`.
- Pyre Burst: 8 m radius, 1.1 s cast, 6 s cooldown.
- There are no auras, DoTs, procs, buffs, crits or a spell registry.

**Fire Blast VFX**
- 3 `createFacingBillboardSystem` pools of 42 fire, 8 smoke and 50 spark sprites (100 total), plus
  2 point lights.
- It uses custom `paintLitUniform` fire, handFire and lava uniforms on every world material.
- `trigger()` resets the whole pool, so only one concurrent effect can play.

**Lava Ball VFX**
- 174 sprites, a molten WGSL `createShaderMaterial` sphere and 1 light.
- Its stages are charge, flight and impact, all on a single instance.

**Audio**
- Lite `createAudioEngineAsync`, `createSoundBufferAsync` and `createSoundAsync`.
- Two WAVs serve every spell, with pitch and volume variants (Pyre Burst layers three pitches of
  the same file).
- Audio is muted by default and lazily created. It is non-spatial and has no buses.

**Animation**
- Release times: Fire Blast `.55`, Lava `1.5`, Pulse `1.1`.
- Lower and upper clips use masks and additive layers.
- `cancelCast` applies a 0.16 s fade.
- The melee clip reuses `PyreBurst_Upper`. `playHit` uses `Hit_Chest`.

**HUD**
- **One** damage number slot (`hit()` overwrites it, `damageTime = .95`).
- A cooldown sweep shows `max(cd, gcd/1.5)`.
- The cast bar is driven by `castElapsed`.

## 2. Five highest-impact gaps

1. **There is no ability or aura model [S]**, which blocks DoTs, procs, buffs and AoE variety.
   - Spells are three classes plus a hardcoded branch, and nothing represents a timed effect on an
     actor.
   - Every requested feature (procs, DoTs, buffs) needs a data-driven `AbilityDef` plus an
     `AuraInstance` list on each actor, with tick scheduling.
   - This is gameplay, so root owns it. VFX is blocked on its **event stream**.
2. **"Instant" is not instant [S].**
   - Fire Blast commits the GCD on press but applies damage and impact only at
     `castReleaseTime = .55` s.
   - Movement is slowed to 0.4× and a re-press cancels it. The spell queue window is 20 ms.
   - WoW-like feel needs effect at ~0–150 ms after press, full movement for instants, and a
     ~400 ms queue window.
3. **VFX are per-spell singletons, not pooled emitters [S].**
   - Each spell owns fixed pools that one `trigger()` resets. A second Fire Blast during a 1.65 s
     effect, two Lava Balls in flight, or effects on several targets all truncate or teleport.
   - DoT ticks and procs on N enemies are impossible without a shared, slot-allocated emitter
     service.
4. **Weak hit confirmation [S].**
   - One overwriting damage number, no crit or tick styling, and no enemy flinch or flash.
   - Only the training dummy tilts. One shared impact WAV, with no tick or proc sounds.
   - This is the main source of "satisfying"; it is cheap to fix.
5. **No reduced-motion or many-actor budget contract [S].**
   - No reduced-motion path exists. Camera `impulse(.34)` and the full-screen flashes are unguarded.
   - Lights are added per effect (6 combat lights). Every material gets fire, handFire and lava
     uniforms painted every frame.
   - Nothing limits remote or other-caster effects.

## 3. Ashen fire kit: original visual grammar (proposal)

The theme is **ash → ember → flame → white-hot**. Names and identity are original; do not reuse
WoW spell names or iconography.

- **Temperature ladder:**
  - ash grey `#2a2622`, alpha smoke
  - ember red `[1.0, .18, .02]`
  - flame orange `[2.4, .6, .06]`
  - white-gold hot `[3, 2.2, 1.2]`, used **only** for crit, proc and empowered states
- **Shape language per role:**

| Role | Shape | Lifetime | Example (keep or rename) |
|---|---|---|---|
| Instant direct | a sharp streak or cone, with a brief impact petal burst | ≤0.45 s | **Fire Blast** (keep; shorten the cone) |
| Cast nuke / projectile | a dense **mass**: cracked molten core with a trailing ember ribbon | flight + 0.8 s impact | **Lava Ball** (keep the molten shader) |
| AoE (self or ground) | a **ring** on the ground: expanding skirt plus vertical pillars | ≤1.0 s burst | **Pyre Burst** (keep) |
| DoT | **smoulder**: low ash smoke plus rising ember flecks on the target, and a small flare per tick | duration (e.g. 12 s, 3 s ticks) | new **Cinderbrand** |
| Proc | **hand halo** (white-gold), a palm flare and a single bright HUD glint | until consumed or 10 s | new **Kindling**: next Lava Ball is instant |
| Buff | slow **orbiting cinders** around the torso, low count and no light | duration | new **Ashen Mantle** (e.g. haste or ward) |

- **Rules:**
  - Hot colours only at the moment of damage.
  - Persistent states (DoT, buff) stay dim and ash-toned, so they never compete with impacts.
  - Each role has a unique silhouette (streak, sphere, ring, column, halo, orbit) so it reads at
    distance and in reduced motion.

## 4. Timing contracts

Proposed numbers to be ratified by root. t0 is the frame when `beforeAnimation` consumes the key.

| Event | Contract |
|---|---|
| Input acceptance | The key is consumed on the next sim frame (≤1 frame, ~16.7 ms at 60 Hz). Refusal text shows on the same frame. |
| Queue window | A press within **400 ms** of GCD or cast end is queued (one slot, last-wins) and fires on the frame it clears. |
| GCD | Starts at t0 and lasts 1.5 s; spells declare `onGcd`. The HUD sweep is driven from the same value. |
| Instant (hit-scan) | State commits at t0. Visual release (hand flare and streak) at **t0 + 0.10–0.15 s**, with damage, number and sound at that moment. Animation is cosmetic (upper-body only, no move slow). Damage never waits on a clip. |
| Instant (projectile) | Spawn at t0 + 0.10–0.15 s. Impact and damage at arrival. |
| Cast | Cast bar runs t0 → castTime. Release equals the commit point. The interrupt rules (move, target change, jump) are unchanged. Lower body may blend to walk only if root allows. |
| Travel | Speed-defined. VFX position is read from the sim flight each frame. Damage resolves only on the sim impact, so the VFX never decides a hit. |
| Impact | Same frame as damage: impact burst, floating number, sound, target flinch, and on-hit proc evaluation. |
| Proc | Evaluated in the damage-resolution step. Aura applied, halo, HUD glint and sound on that frame. Consumed on the next qualifying `commit`. A consumed proc cannot also be refunded. |
| DoT tick | Ticks at application + k·interval (no tick at 0). A refresh keeps the remaining partial tick, then extends by the duration (a pandemic-style cap is root's choice). Each tick: small flare, tick number in dim style, quiet sizzle. |
| Buff | On apply: ≤0.4 s flourish. While active: an ambient loop within budget. On expiry: ≤0.3 s fade. Within the last 3 s: blink the HUD icon, not the 3D effect. |

- Every event should carry `{abilityId, sourceId, targetId, t, crit, kind}`.
- The VFX and audio layers subscribe to these events only; they never read spell internals.

## 5. Reusing existing Lite 1.31.1 APIs and project systems

**Keep [S/A]:**
- `createFacingBillboardSystem`, `addBillboardSprite` and `updateBillboardSprite` pools. These are
  the proven path.
- `createPointLight` plus the existing `paintLitUniform` slots (fire, handFire, lava).
- The `createShaderMaterial` molten sphere.
- `sockets.toCapsule` / `handPosition` for hand anchors. `sockets.js` already defines `mainHand`
  and `offHand`.
- The Lite animation groups with masks, `setAnimationWeight` / `setAnimationAdditive`, and
  `fadeAnimationWeight` [A].
- `createBloomPostProcessTask`, already in `post.js`.
- The Lite audio engine, buffers and sounds, with `maxInstances`.

**Available but unverified in this repo [A present, D behaviour]:**
- `playBillboardSpriteAnimation` / `playBillboardSpriteIndexAnimation`, for flipbook flames. They
  need multi-cell atlases; the current PNGs are single cells.
- `createRibbon`, for the Lava Ball and streak trails. Whether it supports dynamic updates is
  unverified.
- `addThinInstance` / `setThinInstanceColor` / `setThinInstanceMatrix`, for ground rings, DoT
  markers and decal-like scorch quads. There is no decal API: `createDecal*` is absent.
- `createAudioBusAsync` / `setBusVolume`, for SFX and UI buses.
- `enableSpatial` / `setSpatialPosition` / `attachSpatialTarget`, for positional impacts on
  other actors.
- `createLineSystem`, for beams.

**Particles [A, D]:**
- Lite 1.31.1 exports the data-oriented **Node Particle (NPE)** path:
  - `parseNodeParticleSetFromSnippet` and `buildNodeParticleSet`
  - `startParticleSystem`, `stopParticleSystem` and `animateParticleSystem`
  - `createParticleBillboard`
- It does **not** export a classic `ParticleSystem` constructor, `createParticleSystem` or a GPU
  particle system. Classic Babylon `new ParticleSystem()` / `GPUParticleSystem` patterns do not
  apply.
- **Recommendation:** stay on billboard pools for this overhaul. Treat NPE as an optional,
  isolated spike only after the event bus exists.

**Animation gaps [S]:**
- There is no separate melee clip.
- There is no instant-cast "flick" clip (FireBlast_Upper has a .55 s release). Phase B needs a
  short (≤0.25 s to release) upper-body clip, or a sped-up existing clip with
  `speedRatio`. Root decides on new motion sources.
- Animation provenance is tracked in `public/ashen-reach/ANIMATION-SOURCES.md`.

## 6. Reduced motion and the many-actor budget

**Reduced motion:**
- One flag: `matchMedia('(prefers-reduced-motion: reduce)')` OR an in-game setting.
- When it is on:
  - Disable camera impulse and screen-space flashes.
  - Sprite counts drop 60%, with no spark showers.
  - Keep the role silhouettes (ring, halo, column) static or slow.
  - Keep numbers, but drift them rather than bounce them.
  - Audio is unchanged.
- Tests assert the config table, not the pixels.

**Budget (proposed; verify with uncapped measurement):**
- One shared combat sprite service: e.g. **512 fire + 128 smoke + 384 spark** slots across the
  3 existing atlases (about 1.0k sprites, versus about 490 today across 9 systems).
- Allocate per event with priority:
  1. own impact
  2. own cast
  3. target DoT and proc
  4. other actors
- Steal the oldest of the lowest priority when full.
- Each effect declares `{sprites, maxConcurrent, lod}`.
- **Lights:** at most 2 dynamic combat lights in total (own hand and own latest impact), reusing
  the existing uniform slots. Every other effect is emissive-only. This avoids growth in
  `paintLitUniform` cost per material.
- **Remote and other casters:**
  - Beyond 25 m, use the "role silhouette only" LOD.
  - Beyond 40 m, or past 8 concurrent remote effects, show no 3D effect at all.
  - DoT smoulder is capped at 6 visible targets; the others show a nameplate icon only.
- **Floating numbers:** a pool of 24 DOM nodes reusing `hud-projection.js`, merging ticks for the
  same target within 100 ms.
- **Audio:**
  - `maxInstances` per cue: impact 4, tick 3, proc 1.
  - At most 1 cue per type per frame per source.
  - Remote sounds go on a quieter spatial bus.
- **Acceptance:** uncapped FPS with matched placement before and after (memory: 144/60 vsync caps
  mean nothing). p99 must not exceed the baseline by more than 0.5 ms with 7 enemies, 3 DoTs,
  1 proc and a 5-cast chain.

## 7. Phased tasks

| Phase | Task | Depends on | Owner | Testable acceptance |
|---|---|---|---|---|
| A0 | `AbilityDef` registry (cast, instant, projectile, AoE, DoT, buff, proc fields) plus `AuraInstance` per actor, with tick scheduler and combat **event bus** | none | **root** (gameplay) | CPU tests cover the following; see the A0 notes below the table. |
| A1 | Queue window (400 ms) plus decoupling instants from clip release (commit at t0, release +0.10–0.15 s, no move slow) | A0 | root | Tests: queued press fires on the clearing frame; instant damage ≤0.15 s after t0 with a mocked clock; cancel semantics unchanged for casts. |
| B1 | Shared `combat-fx` sprite service (slot alloc, priority steal, LOD, reduced-motion table), reusing the 3 atlases and lights | A0 events | VFX implementer (delegate) | Unit tests cover the following; see the B1 notes below the table. |
| B2 | Port Fire Blast, Lava Ball and Pyre Burst onto B1, keeping their current look | B1 | VFX | Tests: N concurrent effects don't reset each other; same/larger total budget (asserted in stats). Live: root/Grok side-by-side clip of old vs new looks. |
| B3 | Hit confirmation: pooled floating numbers (normal, crit, tick, heal styles), enemy flinch via a material emissive pulse plus `Hit_Chest`-style additive where rigs allow, target nameplate flash | A0, B1 | VFX + HUD | Tests: 24-node pool, merge rule, flinch for any hostile (not only the dummy). Live clip of a 5-cast chain. |
| B4 | New kit effects: Cinderbrand DoT smoulder and tick flare, Kindling hand halo, Ashen Mantle orbit | A0 auras, B1 | VFX | Tests: effect lifetimes are bound to aura apply/expire events; no leaks after 100 apply/expire cycles (slot count returns to 0). |
| C1 | Audio: SFX/UI buses, per-role cues (instant crack, cast loop, projectile whoosh, impact, tick sizzle, proc chime, buff on/off), spatial for non-self, sourced with provenance | A0 events | audio delegate; root approves the sources | Tests: cue mapping table, maxInstances, mute respected, no engine creation while muted (existing invariant). Provenance file updated. |
| C2 | Animation: short instant-cast upper clip (or `speedRatio` on the existing one), a separate melee clip, cast-while-moving lower blend policy | A1 | **root** (motion) | Tests: release times read from `AbilityDef`, not literals. Live clip reviewed by root. |
| D1 | Budget and reduced-motion verification: uncapped matched-placement benchmark, plus a live review with reduced motion | B2–C2 | Grok (live) / root | See §6 acceptance. Live clip on Telegram per CLAUDE.md, owned by root and Grok. |

**A0 test notes**
- DoT tick times (no tick at 0, refresh rule).
- Proc trigger and single consumption.
- GCD start at t0.
- Event ordering: commit → release → impact → proc.

**B1 test notes**
- Allocation and steal ordering.
- Reduced motion cuts counts by ≥60%.
- The light cap is 2.
- A zero-allocation steady state after warm-up, checked by counting `addBillboardSprite` calls.

**Delegation notes:**
- B1–B4 and C1 are cleanly separable once A0's event schema is frozen. Do not start them before
  that schema is frozen.
- Live visual review and benchmark are Grok's and root's.
- Remove the duplicated literals (HUD cast times 1.5 and 1.1, motion release times) as part of A0
  and C2.

## 8. Unverified and open items

- **Not observed:** all visual quality judgements here are from source. Nothing was observed.
- **Unconfirmed on 1.31.1:** `createRibbon` dynamic updates, billboard flipbooks with these
  atlases, NPE particles and spatial audio. The docs consulted are for 1.32.0.
- **Open decision:** whether instants may play while moving at full speed (WoW: yes). The current
  0.4× slow applies to all three spells.
- **Not checked:** whether `enemies.js` rigs support `Hit_Chest`-style additive hits (no hit
  path found).
