# C03 independent source review — 2026-10-10

Scope: working diff of `src/ashen-reach/combat.js`, `combat/movement-policy.js`, `combat/ability-definitions.js`, `enemies.js`, `src/character/body.js`, `src/spells/fire-blast.js`, plus focused tests `scripts/test-combat-movement-policy.mjs`, `scripts/test-fire-blast.mjs`, `scripts/test-enemy-contact.mjs`. Given (not re-run): 54 CPU passes, 12 native passes, reviewed moving/airborne Fire clip. No product edits, no browser, no tests, no visual acceptance.

## Summary

C03 does the intended data cut: Fire Blast and Pyre `castTime: 0`, Pyre `groundOrigin`, no `CAST_MOVE_SCALE`, melee `casting` from `scheduler.active`, enemy punch split into windup then contact, Fire Blast `requiresGround: false`. Movement-policy unit tests match the plan’s air/run/stationary/turn split.

Three live defects sit in the new contact/gesture glue. Melee damage is now scheduled even when `playMelee` refuses. Instant recovery both blocks the swing clip and still lands that scheduled hit. Diagnostic reset never owns `combatGesture` or `attackWindup`. Gesture masks and per-ability movement rules look sound on the page; they were not re-checked live here.

## Issues

### Issue 1 — Severity: bug
- File: `src/ashen-reach/combat.js:587`
- Question: 1 (gesture / melee preemption) and 2 (authoritative contact)
- Description: Swing contact is no longer gated on a successful melee start. `tickAuto` always sets `auto.pendingHit` and `auto.contactAt = life.time + body.getState().meleeRelease` after `playMelee({ preemptCast: true })`. `getState().meleeRelease` is the constant `MELEE_RELEASE` even when no clip is playing. Previously contact required `body.playMelee?.()` to return true, and a failed start reset `auto.timer = 0.3`.
- Repro from source: auto-attack `step.action === "swing"` while `playMelee` returns false (`combatGesture`, `state.phase === "air"`, `state.channeling`, or missing clip/mask). `afterAnimation` at `combat.js:804` still calls `connectSwing` once `life.time >= auto.contactAt`.
- Suggestion: set `pendingHit` / `contactAt` / target generation only when `playMelee` returns true. On false, keep the old timer backoff (or equivalent) so a refused clip cannot deal damage.

### Issue 2 — Severity: bug
- File: `src/character/body.js:1265`
- Question: 1
- Description: Instant recovery owns the upper body and cannot be preempted by melee. `playMelee` returns false on `combatGesture` before the `preemptCast` block that would `stopCombatGesture()`. Plan C03: melee pauses through hard casts, not cosmetic recovery; recovery is interruptible. `casting = !!scheduler.active` (`combat.js:557`) already lets the swing timer run during a 0.42 s instant gesture, so Issue 1’s scheduled hit lands with no swing clip. `preemptCast` can still halt a leftover hard-cast `castingShoot` path; it never reaches an instant gesture.
- Repro from source: accept Fire Blast (`playCombatInstant` at `combat.js:416`, gesture duration `body.js:478`). While `combatGesture` is set, auto-attack emits `swing`. `playMelee` returns false; contact still fires if Issue 1 stands.
- Suggestion: if `preemptCast`, stop the gesture first, then play the swing. Keep the early return only when a hard scheduler cast is active (already expressed by `scheduler.active` in `tickAuto`). Do not let a cosmetic oneshot both suppress the clip and deal melee damage.

### Issue 3 — Severity: bug
- File: `src/ashen-reach/combat.js:601`
- Question: 3 (diagnostic restore)
- Description: Scenario reset stops melee and the scheduler, and assigns `{ enabled, timer, queued, pendingHit }`, but never stops `combatGesture`. `body.cancelCast()` (`combat.js:426`, used from `onCancel`) only arms `castCancelTime` when `state.castingShoot` (`body.js:1263`). Instants set `castingShoot = false` (`body.js:467`). `endInspection` does call `stopCombatGesture` (`body.js:1248`); combat reset does not. A Developer scenario restore mid-Fire/Pyre pose leaves the sampled release segment running on the restored body.
- Suggestion: export a `body.cancelCombatGesture()` (or call `playCombatInstant`’s stop path) from scenario `reset()`, death (`combat.js:300`), and `onCancel`. Clear `auto.contactAt` / `auto.targetId` / `auto.targetGeneration` in the same assign.

### Issue 4 — Severity: bug
- File: `src/ashen-reach/enemies.js:252`
- Question: 2 (death / cancellation) and 3 (restore)
- Description: C03 adds `attackWindup` and serializes it in `enemySnapshot` (`enemies.js:599`). `enter()` clears it only when leaving `attack` (`enemies.js:261`). `syncDiagnosticEnemy` plays idle and `syncRoot` and does not clear `attackWindup`. Combat `reset()` does not touch it. A mid-windup scenario reset, or a snapshot restore that writes `state` without `enter()`, leaves a non-null windup. The next `state === "attack"` tick takes the windup branch (`enemies.js:398`) and can emit `enemy-contact` / `onPlayerHit` without a new punch clip. Live death of the enemy is handled: `hp <= 0` calls `enter("dead")` (`enemies.js:323`) and the new contact test covers that path.
- Suggestion: `attackWindup = null` in `syncDiagnosticEnemy`, combat scenario `reset()`, and any snapshot apply. Treat missing `attackWindup` on old snapshots as null.

## Question notes (non-issues or later work)

### 1. Instant gesture lifecycle / masks / preemption

- Fire Blast `castTime: 0` and Pyre `castTime: 0` in `ability-definitions.js:6–9`. Scheduler spends, `onStart`, and `onRelease` on the same `start()` (`action-scheduler.js:56–62`). Gameplay does not wait on the 0.42 s gesture.
- `playCombatInstant(null)` for Fire Blast uses `visual.spellShoot` and `def.castMotion.releaseTime` (0.55), offset `release - 0.06` (`body.js:469–478`). Lava/Pyre pass `'lava'` / `'pulse'` and use `castMotions`. Missing clip returns false and does not veto the spell.
- Mask is `visual.spellMask` (exclude legs, `body-visual.js:203–206`). `applyLocoOverlay` stays off because `castingShoot` is false (`body.js:960–965`). Legs stay on locomotion; that is the right structure for running/jumping Fire. Additive setup is pre-existing on authored cast clips. **Not visually re-checked.**
- Instant→hard cast: `beginShoot` calls `stopCombatGesture` (`body.js:494`). Hard Lava still uses `input.castInstant` / `castSpell` (`combat.js:413`). Instant→instant: `playCombatInstant` stops the previous gesture first (`body.js:465`).
- Pyre still `pulseFx.begin()` + `audio.lavaCharge()` on start (`combat.js:419–420`) even though it is instant. Presentation only; **C10**.

### 2. Movement / facing / contact / death / generation / cancel

- `movement-policy.js` matches the plan and `test-combat-movement-policy.mjs`: instants run and fly; `groundOrigin` (Pyre) needs actual ground; hard Lava refuses translation (`speed > 0.15` or forward/strafe) and jump; turning is allowed; idle auto-face is off while translating/turn/RMB/look; 90° facing cone is inclusive at π/2.
- `CAST_MOVE_SCALE` removed. Lava cancel is `movementRefusal` on the active definition each update (`combat.js:775–776`). Reservation refund is C02 `cancel`. Fired lava flight is independent (`combat.js:787`).
- Hostile knockback that leaves `speed > 0.15` will cancel Lava as residual movement. Plan asked for an explicit interrupt event for hostile displacement. **C08** unless residual Havok slide after a stop is already eating casts in play.
- Running Fire Blast does not `setFacing` (`combat.js:410`). Off-cone while translating refuses `'Face your target'` instead of yawing. Intended.
- Player melee locks `targetId` + `generation` at swing (`combat.js:590`, consume at `266`). Dummy recover increments generation (`combat.js:810`). Dead/hidden/wrong generation miss. Fail-closed LOS (`combat.js:273`) matches the plan; collision-unavailable melee is a miss.
- Enemy punch: cooldown + windup at start (`enemies.js:411–418`); damage only at windup 0 (`enemies.js:400–409`) after `inContactRange` + LOS. Player death during windup `enter("return")` (`enemies.js:396`). Enemy death covered by tests. LOS fail-closed (`enemies.js:190, 199`) matches the plan.
- Pyre `onRelease` passes `grounded: player.getGrounded()` (`combat.js:443`) while scheduler validate uses `getGrounded() && phase !== 'air'` (`combat.js:369–370, 398`). Same-tick instant hides it today. Latent contract split, not a C03 repro.

### 3. Diagnostic restore / source animation

- `endInspection` stops the gesture; combat scenario reset does not (Issue 3).
- `enemySnapshot` gained `attackWindup` without a restore owner (Issue 4).
- `setMoveScale(1)` on cancel/release is still correct after removing the 0.4 scale.
- Instant sampling of `spellShoot` leaves `group.mask = visual.spellMask` after halt. Authored `beginShoot` currently sets `spellShoot.mask = undefined` for `castMotion` (`body.js:517`). Animation-lab / inspection Fire Blast using that same group could keep the exclude-legs mask. **Not checked**; lab is outside the six-file play path.
- Mixamo-only / missing-clip fallback is implemented. Human/Orc silhouettes and feet slide were not source-proven beyond mask construction. **Not checked; not visual acceptance.**

## Tests in scope

- `test-combat-movement-policy.mjs`: policy table only; does not exercise `combat.js` `tickAuto` / `playMelee` gating.
- `test-fire-blast.mjs`: airborne Fire Blast and `requiresGround: true` override. Lava still requires ground via missing `requiresGround` on `LAVA_BALL` (`requiresGround !== false`).
- `test-enemy-contact.mjs`: windup-then-hit, wall/floor/range/null raycast miss, enemy death cancel. No scenario restore, no player-death-during-windup (that path exists in `tickEnemy` but is untested here), no melee-vs-gesture test.

`test-lava-ball.mjs` only swaps a hardcoded cooldown 6 for `LAVA_BALL.cooldown`. Not a C03 contact test.

## Later milestones (do not treat as C03 blockers)

- C06 proc Lava instant / air variant (policy already allows `castTime: 0` without `groundOrigin`).
- C07 Pyre area query, vertical interval, five-target cap.
- C08 enemy telegraphs, interruptible cultist cast, stun cancel beyond death/leash/range, explicit knockback interrupt.
- C10 VFX: `beginWindup` / `pulseFx.begin` on instants, charge audio on Pyre, punch clip vs 0.32/`PUNCH_SPEED` deadline, gesture weight 80/140 ms vs 80–120 ms trial.

## Not checked

CPU 54 / native 12 / moving-airborne Fire clip were taken as given. No browser, no capture review, no FPS, no restore click-through, no `playMelee` failure case in tests. This file is source review only.
