/** Small FIFO between browser event receipt and the next simulation update.
 * Reject newest on overflow so previously acknowledged actions keep their order.
 * This is not the scheduler's replaceable, one-slot offensive queue.
 */
export function createInputIntents(capacity = 16) {
  const pending = [];
  let rejected = 0;
  return {
    push(intent) {
      if (pending.length >= capacity) { rejected++; return false; }
      pending.push(Object.freeze({ ...intent })); return true;
    },
    drain(accept) { while (pending.length) accept(pending.shift()); },
    clear() { pending.length = 0; },
    get size() { return pending.length; },
    get rejected() { return rejected; },
  };
}
