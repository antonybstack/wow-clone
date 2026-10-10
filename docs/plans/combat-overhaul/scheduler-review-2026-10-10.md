# C02 source review — 2026-10-10

Bounded adversarial review of unimported C02 modules. No browser, no live gameplay, no product edits. Integration with C01 is pending; nothing here is a claim about the running game.

## Reviewed scope

Read and judged as of the second full pass (a live tree, not a frozen commit):

- `src/ashen-reach/combat/action-scheduler.js`
- `src/ashen-reach/combat/combat-clock.js`
- `src/ashen-reach/combat/input-intents.js`
- `src/ashen-reach/combat/presentation-events.js`
- `scripts/test-action-scheduler.mjs`
- `scripts/test-combat-presentation-events.mjs`
- Timing/action contract in `docs/plans/combat-overhaul/plan-2026-10-10.md` (that section only)

During the review the tree gained `receivedMs` metadata on `request()` / `action-input` (stored, unused for window or expiry) and two extra tests (`haste snapshots…`, `500 ms active time is retained…`). Those did not change GCD/queue/reservation/clock-step arithmetic. Timing behavior below is against that second-pass source.

Existing pure tests: **16 passed** (`node --test` on the two scripts). A first probe script (`/tmp/c02-probe.mjs`) ran against the same sources. A second probe file was written and **not executed**; anything that exists only there is an untested hypothesis.

## What held (not findings)

Queue window 301 ms refuse / 300 ms accept, last admissible press wins the slot, invalid/out-of-window/low-mana presses leave a valid queue, exact-ready starts immediately, 1 ms-early queues. Hitch: readyAt+110 ms after a 120 ms jump expires once; readyAt+70 ms executes once; `expiresAt = readyAt + 0.1` matches the contract’s 100 ms lateness cap. Target id+generation is snapshotted at press; death, despawn, and generation bump fail at start with the slot cleared. Off-GCD ward/quench run during an offensive GCD without clearing cast or queue and cannot spend reserved mana. Instant-only queued Lava does not become a stationary cast when the proc drops; a normal queued Lava may upgrade at start. Personal cooldown begins at release; same-spell queue accounts for the in-flight cooldown. Hard-cast interrupt refunds reservation, keeps elapsed GCD, starts no cooldown. Clock keeps a 500 ms active interval, drops boot/hidden/paused time, and pulses `pause: true` for `elapsed > 0.5`. Presentation isolation, when composed, does not block payment/release.

## Finding 1 — queued-to-queued replacement has no terminal event

**Question:** queue replacement / deadline / targetGeneration  
**Severity:** Medium (event-contract / HUD-trace). Slot gameplay is correct.  
**Status:** Proven.

`request()` last-wins by assignment (`queued = Object.freeze({...})`) and emits `action-queued` for the new id. It does not emit `queue-clear` (or reject/expire) for the displaced id. `queue-clear` exists only for disable, cancel/dispose, and `start()` of a *ready* GCD action.

Minimal reproducer:

```js
const f = fixture();
f.press('filler');
f.scheduler.advance(1.2);
f.press('filler');           // action 2 queued on a
f.press('filler', 'b');      // action 3 queued on b; action 2 vanished
// events: action-queued ×2, queue-clear ×0
// f.scheduler.queued.targetId === 'b'  (slot is right)
```

Probe `queue-replace-events`: `queueClearCount: 0`, `queuedEventCount: 2`, types end `action-queued:player:action:2:a` then `action-queued:player:action:3:b`. Replacement by a *ready* other GCD *does* emit `queue-clear` (`ready-gcd-replaces-queued-cd-spell`).

Deadline and generation: no gameplay defect found. Generation lock on the winning press was proven (`targetGeneration-lock-on-replace`: press b at gen 7, bump to 8, advance → `Target has changed`, first filler only).

**Fix:** before overwriting `queued`, emit `queue-clear` with the old action and reason `Replaced by later input` (same shape as the ready-start path). Keep last-wins and the 100 ms expiry rule.

## Finding 2 — `resource.free()` runs at queue acceptance

**Question:** resource atomicity / off-GCD / proc-variant race  
**Severity:** High if `free()` consumes a charge or proc; Medium as an API footgun if it is a pure peek.  
**Status:** Call sites proven. Charge-loss under a consuming `free()` not executed (see hypotheses).

Contract: queuing spends nothing; proc/charge consumption happens once at accepted execution, never at queue time. Cost is computed twice with the same hook:

- `request()` line 108, before writing `queued`
- `start()` line 41, at execution

Probe `free-called-at-queue`: filler start 1 call; queued cast +1; later `advance` start +1 (`queuedCostCalls: 1`, `startCalls: 1`). Existing tests never pass `resource.free`, so they do not catch this.

A peek-only `free()` used to know the queued cost is 0 is compatible with affordability checks. A consuming `free()` (or a global “next spell is free” bit) runs at queue time: the charge can disappear before start, and an off-GCD `request()` during a reserved cast can take it because off-GCD also goes through `start()`/`free()`. Variant selection itself is `resolveDefinition` at start, which is the right moment for instants; that path is tested.

**Fix:** split peek vs consume. Queue may read a pure `isFree` / preview cost. Consume only inside `start()` (instants) or `release()` (hard casts), after checks pass, once. Do not share that consume with off-GCD unless the definition is the intended consumer.

Related, not a separate finding: `release()` sets `active = null` (reservation gone) then `resource.spend`. Probe `release-spend-throw-drops-cast` (external `mana = 0` under a 40 reservation): throw `overspend`, `active === null`, events stop at `cast-start`, no `cast-cancel` / `action-release`. That spend throw needs an adapter that violates “all debits through this scheduler”; still, clear-then-spend is a brittle order. Spend then clear, or cancel on spend failure.

## Finding 3 — `pause: true` is a one-frame pulse; unlatched time resumes

**Question:** lifetime / pause clock semantics  
**Severity:** High for the pending C01 owner. In-module time freeze on the stall frame is correct.  
**Status:** Proven.

`createCombatClock` starts `suspended`. A finite `elapsed > 0.5` returns `{ dt: 0, time, pause: true }` and sets `suspended`. The next `step()` without `{ paused: true }` is the resume origin (`dt: 0`, `pause: false`). The frame after that adds elapsed combat time.

Probe `clock-unlatched-autoresume`:

- `step(.501)` → `{ dt: 0, time: 0.12, pause: true }`
- `step(.016)` → `{ dt: 0, time: 0.12, pause: false }`
- `step(.016)` → `{ dt: 0.016, time: 0.136, pause: false }`

The existing test latches `clock.step(4, { paused: true })` after the pulse, then treats the following unpaused `step` as Resume. If the owner misses that single `pause: true`, there is no visible pause, pending input is not held, and combat time continues after one skipped origin frame. The stall duration is not applied (no catch-up jump), which is the right time rule and the wrong UX rule (“enter a visible solo pause… Resume through the existing visible Resume action”).

Clock and FIFO are separate. Probe `clock-pause-pulse-then-intents-drain`: on the `pause: true` frame a naive `drain` + `request` released pending `ward` at frozen time. The clock does not and should not own the FIFO; the owner must `inputs.clear()` (and not drain into `request`) on that pulse. `inputAt` is trace-only; the queue window uses scheduler `now`, so a FIFO that survives a stall looks like a fresh press.

**Fix:** keep returning `{ pause: true, dt: 0 }` on every ready/unhidden step until the owner passes `{ paused: true }` (latched menu) or an explicit resume API. Document: on `pause: true`, clear `createInputIntents`, do not `scheduler.cancel` an in-flight cast (existing casts still resolve on combat time, which is frozen). Drive `scheduler.advance` from `clock.time` only.

## Adapter responsibilities (not module defects)

- Compose `clock.step` → `scheduler.advance(clock.time)`. The two clocks are independent `now`/`time` starting at 0.
- Always wrap `emit` with `createPresentationEvents`. Bare `emit` that throws on `action-input` aborts `request` before `start` (probe `emit-throw-without-wrapper`: error `bare emit`, mana unchanged, no start/release). Isolation is in the presentation module, not the scheduler.
- Route every mana debit through the scheduler while a cast is active; `available` is `get() - reserved`, and `get()` still includes reserved mana.
- `cast-cancel`’s `refunded` is reservation release. The pool was never debited. A consumer that credits `refunded` onto mana double-pays.
- `onStart` / `onRelease` / `onCancel` are gameplay callbacks. Do not call `request()` from them during `advance`.
- Off-GCD cannot be queued; a not-ready ward/quench is `Not ready`. Offensive queue only, per contract.

## Untested hypotheses (second probe never ran)

Do not treat these as defects:

- `onRelease` of a finishing hard cast calling `request()` of a now-ready GCD, then `advance` refusing the queued GCD (`gcdUntil` already moved).
- Consuming `free()` at queue with 0 mana: charge gone, start refuses.
- Off-GCD `request` during a reserved cast consuming a global free charge meant for the hard cast.
- `emit` throw on `action-start` after instant `spend` (cooldown set, `onRelease` skipped).
- `onStart` throw after instant `spend` (same).
- GCD-ready FIFO drain on the `pause: true` frame executing an extra offensive action.

## Verification state

**Verified:** 16 existing tests green; first probe outputs cited above.  
**Untested:** second probe; any C01 loop, browser, Havok, animation, or live fight.  
**Out of scope:** C05 aura/tick ordering, C06 Ember consume implementation, Escape/pointer-lock, menu focus.

No live gameplay claims.

## Root disposition

- Queue replacement event: agreed and fixed; a displaced action receives queue-clear before the replacement event. Regression test passes.
- Resource hook: actual adapter is a pure God-mode read, not a charge consumer. Renamed free to isCostExempt and documented purity. Proc-free variants remain ability-specific resolved definitions; later proc consumption belongs to accepted execution. No consuming hook has been integrated. The external resource mutation/throw example violates the single resource owner; it is not a demonstrated live defect.
- Pause pulse: agreed as worthwhile hardening. Clock now latches pause requests until the visible paused owner acknowledges them. Test proves repeated frames cannot silently resume. Prepared main-loop integration opens the existing menu synchronously and does not drain inputs on that frame. Menu input reset interrupts/refunds the in-flight cast and clears queue/intents; preserving a cast across arbitrary modal/equipment ownership is not adopted.
- Re-entrant gameplay callbacks and bare throwing emit remain adapter responsibilities; no production callback currently does either. Optional presentation has its own tested failure-isolation boundary.
- Review workflow missed the early report and reached its eight-turn cap. One report-only continuation recovered observations. Source-only findings do not establish C02 live acceptance.
