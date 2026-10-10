/** Bounded diagnostic evidence. Disabled gameplay pays no allocation cost.
 * Wall time is monotonic; simulation time is supplied by the combat owner.
 * https://developer.mozilla.org/en-US/docs/Web/API/Performance/now
 */
export function createCombatTrace({ enabled = () => false, wallTime = () => performance.now(), capacity = 512 } = {}) {
  if (!Number.isInteger(capacity) || capacity < 1) throw new RangeError('Invalid trace capacity');
  const ring = new Array(capacity);
  let sequence = 0, size = 0;
  return {
    record(type, time, detail = {}) {
      if (!enabled()) return;
      const event = Object.freeze({ ...detail, sequence: sequence++, type, time, wallMs: wallTime() });
      ring[event.sequence % capacity] = event;
      size = Math.min(size + 1, capacity);
    },
    snapshot() {
      return Array.from({ length: size }, (_, i) => ({ ...ring[(sequence - size + i) % capacity] }));
    },
    clear() { ring.fill(undefined); sequence = size = 0; },
    get size() { return size; },
    get dropped() { return sequence - size; },
  };
}
