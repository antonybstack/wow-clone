# C05 combat integration review

Reviewer: Grok 4.6 high. Date: 2026-10-10. Scope: uncommitted C05 (working tree). Read-only; no tests, browser, build, or product edits. Parent owns implementation. Known already-fixed and not re-reported: expiry float / final-tick ordering; damage-number kind merging; player generation on rehearsal reset/restore. Legacy standalone spell `hit()` fallback is intentional. Lava single flight / 3 s personal cooldown retained until C06.

Source read: `src/ashen-reach/combat.js`, `combat/event-timeline.js`, `combat/damage-resolver.js`, `combat/aura-store.js`, `combat/action-scheduler.js`, `combat/ability-definitions.js`, `enemies.js`, `progression.js`, `src/spells/fire-blast.js`, `lava-ball.js`, `grave-pulse.js`, `scripts/test-combat-auras.mjs`, HEAD combat kill/recovery contrast. Not a live acceptance.

## Summary

The reducer, aura keying, and timeline comparator match the C05 contract for the paths that actually sit on the timeline. Brand ticks, Fire Blast / Pyre impacts, player melee, and enemy punches drain in timestamp → phase → sequence order; lethal resolve records the generation before `onKill`; dummy/enemy generation gates reject stale commands; `updateEnemies` no longer receives `onKill`, so XP is not awarded a second time from `tickEnemy`. One integration regression is source-confirmed: dummy recovery is consumed onto the timeline and then discarded while the player is dead, so the dummy never comes back.

## Issues

### 1 — Dummy recovery is consumed then dropped while the player is dead

- **Priority:** P1
- **Path:** `src/ashen-reach/combat.js:723-726` (consume `dummyRecoveryAt`, enqueue interrupt); `src/ashen-reach/combat.js:747-754` (`if (life.dead) { timeline.clear(); return; }` with no drain); recovery callback `src/ashen-reach/combat.js:725`; kill arm `src/ashen-reach/combat.js:268-272`
- **Scenario:** Lethal dummy hit (`deal` / Brand tick / melee) sets `dummyRecoveryAt = event.time + 3` and leaves `dummy.hp === 0` at the current generation. Player dies before that deadline and stays on the death veil until `life.time` passes it. Each dead frame still hits `dummyRecoveryAt <= life.time`, sets `dummyRecoveryAt = null`, and pushes the interrupt event, then `timeline.clear()` throws the event away. HP stays 0, generation is never incremented, `kills` still holds the dead generation. After Release spirit the dummy remains untargetable / “recovering” until a diagnostic scenario reset. HEAD recovered via `spell.update` `resetIn` and `meleeRecover` in `afterAnimation`, both of which still ran while dead. C05 `dealDamage` skips `resetIn` / `damagedTarget`, so that owner is inert in the game.
- **Minimal fix:** Do not clear `dummyRecoveryAt` until the interrupt callback actually runs. While `life.dead`, skip the enqueue (leave the timestamp). After rez, `dummyRecoveryAt <= life.time` recovers immediately. Alternative: apply the recovery callback before `timeline.clear()` on the dead return.

## Checked, no further defect to report

**Timestamp / phase order (periodic, release, contact, direct impact, expiry).** `COMBAT_PHASE` order in `event-timeline.js:5` and drain sort `event-timeline.js:17` are correct. Brand ticks are `periodic`; hard-cast release is stamped at `releaseAt` then queue drain at `life.time`; player melee and enemy punches are `contact`; Fire Blast / Pyre are `impact` added from `onRelease`. Same-time periodic-before-release is what `scripts/test-combat-auras.mjs` “periodic death before cast release” exercises, and integration uses the same phase split. Enemy `contactOffset` (`enemies.js:403,413`) reconstructs `prevTime + windup`; that is timestamp order, not a phase inversion. `auras.expire(life.time)` runs after drain (and after lava `advance`); complete ticks due at expiry already ran in `schedule`. Parent fixed the epsilon case.

**Lava projectile vs timeline.** Arrival still happens in `afterAnimation` via `lava.advance` (`combat.js:832-840`), not as `COMBAT_PHASE.impact`. Observed same-frame order is still periodic/contact/direct drain, then lava, then `expire`. `onKill` nulls `lava.flight` on the dead target (`combat.js:270`), and `advance` also drops hp/hidden/generation mismatch (`lava-ball.js:53-55`). No wrong HP/kill from that split was source-confirmed. Multi-flight / homing is C06.

**Resolver / aura idempotency / canceled ticks.** `kills` WeakMap plus generation (`damage-resolver.js:12,19`) blocks a second kill on the same incarnation; dummy recovery is the intended generation bump (`combat.js:725`). Tick callbacks no-op when `active.get(key) !== a` or `!valid(a)` (`aura-store.js:31-33`). Death, generation++, leash `return`, and source death are covered in `test-combat-auras.mjs`. Hitch catch-up that would schedule two Brand intervals in one drain and then refresh (new aura object, later tick dropped) needs a ≥2 s jump; C02 pause is 500 ms — not reported.

**Spell-path replacement / XP.** `spell` / `lava` / `pulse` `dealDamage` is `deal` → resolver (`combat.js:288-290`). Melee uses `deal` (`combat.js:304`). Brand ticks use `damage.resolve` (`combat.js:284-285`). `updateEnemies` is not passed `onKill` (`combat.js:728-736`); `tickEnemy` `ctx.onKill?.` (`enemies.js:327-329`) is a no-op. Dummy `recover` yields 0 XP (`progression.js` `xpForKill`). Standalone `FireBlast` / `GravePulse` `resetIn` recovery remains for tests without `dealDamage`.

## Not checked / unverified

Live dummy 90 s play, death-veil → dummy, native browser, FPS, pause/hitch 500 ms, churchyard objective kill credit, slot-4 bindings, Brand lesson / `localStorage`, HUD auras, VFX (`combat-vfx/`, `combat-presentation.js`), menu, `action-scheduler` beyond the `drainQueue` flag, production/Pages. Parent may have edited after these line numbers; they were current at the read.