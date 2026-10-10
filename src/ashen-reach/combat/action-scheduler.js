const EPSILON = 1e-8;
const rejectResult = reason => ({ ok: false, reason });
/** One owner for cast/GCD deadlines, one offensive queue and one reservation.
 * No Babylon objects, DOM, timers or animation callbacks participate in timing.
 * See docs/plans/combat-overhaul/plan-2026-10-10.md#timing-and-action-contract.
 * Events are delivered synchronously in order; consumers must not mutate actions.
 */
export function createActionScheduler({ definitions, getTarget, resource, validate = () => '',
  resolveDefinition = definition => definition, onStart = () => {}, onRelease = () => {},
  onCancel = () => {}, emit = () => {}, sourceId = 'player', queueWindow = .3 }) {
  let now = 0, sequence = 0, eventSequence = 0, gcdUntil = 0, active = null, queued = null, disposed = false;
  const cooldowns = new Map();
  // isCostExempt is a pure preview (developer God mode), never a proc consumer.
  // Ability-specific free variants are resolved by resolveDefinition; their
  // charges are consumed by the gameplay onStart callback after acceptance.
  const targetFor = action => action.targetId == null ? null : getTarget(action.targetId);
  const reserved = () => active?.cost ?? 0;
  const available = () => Math.max(0, resource.get() - reserved());
  function event(type, action, extra = {}, time = now) {
    emit(Object.freeze({ eventId: `${sourceId}:event:${++eventSequence}`, actionId: action?.actionId ?? null,
      sourceId, targetId: action?.targetId ?? null, targetGeneration: action?.targetGeneration ?? null,
      time, abilityId: action?.abilityId ?? null, variant: action?.definition?.variant ?? 'normal',
      type, ...extra }));
  }
  function refuse(action, reason) { event('action-rejected', action, { reason }); return rejectResult(reason); }
  function definitionFor(action) {
    const base = definitions[action.abilityId];
    return base && resolveDefinition(base, action, now);
  }
  function check(action, definition, phase) {
    if (!definition) return 'Unknown ability';
    if (action.instantOnly && definition.castTime > 0) return 'Instant opportunity expired';
    if (definition.targeted) {
      const target = targetFor(action);
      if (!target || target.hp <= 0 || target.hidden || !target.hostile) return 'Target is unavailable';
      if ((target.generation ?? 0) !== action.targetGeneration) return 'Target has changed';
    }
    return validate(action, definition, phase, now) || '';
  }
  function start(action) {
    const definition = definitionFor(action);
    const reason = check(action, definition, 'start');
    if (reason) return refuse(action, reason);
    const cost = resource.isCostExempt?.() ? 0 : definition.cost;
    if (cost > available() + EPSILON) return refuse(action, 'Not enough mana');
    if (!definition.gcd && definition.castTime > 0) return refuse(action, 'Off-cooldown actions must be instant');
    if (definition.gcd && queued) { event('queue-clear', queued, { reason: 'Replaced by ready action' }); queued = null; }
    const haste = Math.max(0, definition.haste ?? 0);
    action = Object.freeze({ ...action, definition, cost, startedAt: now,
      releaseAt: now + definition.castTime / (1 + haste) });
    if (definition.gcd) gcdUntil = now + Math.max(1, definition.gcd / (1 + haste));
    if (definition.castTime > 0) {
      active = action;
      event('cast-start', action, { releaseAt: action.releaseAt, reserved: cost });
      onStart(action);
    } else {
      resource.spend(cost);
      cooldowns.set(action.abilityId, now + definition.cooldown);
      event('action-start', action);
      onStart(action);
      event('action-release', action);
      onRelease(action, now);
    }
    return { ok: true, queued: false, actionId: action.actionId };
  }
  function release() {
    const action = active;
    const reason = check(action, action.definition, 'release');
    active = null;
    if (reason) {
      event('cast-cancel', action, { reason, refunded: action.cost });
      onCancel(action, reason);
      return;
    }
    // Reservation prevents off-GCD consumers from spending this amount. The
    // owner must route all debits through this scheduler while a cast is active.
    resource.spend(action.cost);
    cooldowns.set(action.abilityId, action.releaseAt + action.definition.cooldown);
    event('action-release', action, {}, action.releaseAt);
    onRelease(action, action.releaseAt);
  }
  const api = {
    get now() { return now; },
    get active() { return active; },
    get queued() { return queued; },
    get reserved() { return reserved(); },
    get available() { return available(); },
    get gcdRemaining() { return Math.max(0, gcdUntil - now); },
    get queueWindow() { return queueWindow; },
    cooldown(id) { return Math.max(0, (cooldowns.get(id) ?? 0) - now); },
    setQueueWindow(value) {
      if (value !== 0 && (!Number.isFinite(value) || value < .1 || value > .4)) throw new RangeError('Queue window must be Off or 100–400 ms');
      queueWindow = value;
      if (!value && queued) { event('queue-clear', queued, { reason: 'Queue disabled' }); queued = null; }
    },
    preview({ abilityId, targetId = null }) {
      const target=targetId==null?null:getTarget(targetId);
      const action={abilityId,targetId,targetGeneration:target?.generation??0};
      const definition=definitionFor(action);
      const reason=check(action,definition,'preview');
      const cost=resource.isCostExempt?.()?0:definition?.cost??0;
      return {reason:reason||(cost>available()+EPSILON?'Not enough mana':''),cost,
        readyIn:Math.max(api.cooldown(abilityId),definition?.gcd?Math.max(api.gcdRemaining,(active?.releaseAt??now)-now):0)};
    },
    request({ abilityId, targetId = null, targetGeneration, inputAt = now, receivedMs = null, instantOnly = false }) {
      if (disposed) return rejectResult('Combat disposed');
      const target = targetId == null ? null : getTarget(targetId);
      const action = { actionId: `${sourceId}:action:${++sequence}`, sequence, abilityId, targetId,
        targetGeneration: targetGeneration ?? target?.generation ?? 0, inputAt, receivedMs, instantOnly };
      event('action-input', action, { inputAt, receivedMs });
      const definition = definitionFor(action);
      const reason = check(action, definition, 'queue');
      if (reason) return refuse(action, reason);
      const readyAt = Math.max(cooldowns.get(abilityId) ?? 0,
        definition.gcd ? Math.max(gcdUntil, active?.releaseAt ?? 0, active?.abilityId === abilityId ? active.releaseAt + active.definition.cooldown : 0) : 0);
      if (readyAt <= now + EPSILON) {
        return start(action);
      }
      if (!definition.gcd || !queueWindow || readyAt - now > queueWindow + EPSILON) return refuse(action, 'Not ready');
      const cost = resource.isCostExempt?.() ? 0 : definition.cost;
      if (cost > available() + EPSILON) return refuse(action, 'Not enough mana');
      if (queued) event('queue-clear', queued, { reason: 'Replaced by later input' });
      queued = Object.freeze({ ...action, readyAt, expiresAt: readyAt + .1 });
      event('action-queued', queued, { readyAt, expiresAt: queued.expiresAt });
      return { ok: true, queued: true, actionId: action.actionId };
    },
    advance(time) {
      if (disposed) return;
      if (!Number.isFinite(time) || time < now) throw new RangeError('Combat time must be monotonic');
      now = time;
      if (active && active.releaseAt <= now + EPSILON) release();
      if (queued && queued.readyAt <= now + EPSILON) {
        const next = queued; queued = null;
        if (now > next.expiresAt + EPSILON) event('queue-expired', next, { reason: 'Input expired after a late frame' });
        else {
          const definition = definitionFor(next);
          // A shared cooldown may have changed after the request was queued.
          if ((cooldowns.get(next.abilityId) ?? 0) > now + EPSILON ||
              (definition?.gcd && (gcdUntil > now + EPSILON || active))) refuse(next, 'Not ready');
          else start(next);
        }
      }
    },
    cancel(reason = 'Cast stopped') {
      const hadQueue = !!queued;
      if (queued) { event('queue-clear', queued, { reason }); queued = null; }
      if (!active) return hadQueue;
      const cancelled = active; active = null;
      event('cast-cancel', cancelled, { reason, refunded: cancelled.cost });
      onCancel(cancelled, reason);
      return true;
    },
    reset(reason = 'Combat reset') {
      api.cancel(reason); cooldowns.clear(); gcdUntil = now;
    },
    dispose() { api.cancel('Combat disposed'); disposed = true; },
  };
  api.setQueueWindow(queueWindow);
  return api;
}
