/** Owns one composition worker per character; never owns scene objects. */
export function createFixtureComposer(source) {
  const worker = new Worker(new URL('./fixture-worker.js', import.meta.url), { type: 'module' });
  const pending = new Map();
  let sequence = 0, stopped = false;
  function request(data) {
    if (stopped) return Promise.reject(new Error('Fixture composer disposed'));
    return new Promise((resolve, reject) => {
      const id = ++sequence;
      pending.set(id, { resolve, reject });
      try { worker.postMessage({ id, ...data }); }
      catch (error) { pending.delete(id); reject(error); }
    });
  }
  function dispose(reason = new Error('Fixture composer disposed')) {
    if (stopped) return;
    stopped = true;
    worker.terminate();
    for (const job of pending.values()) job.reject(reason);
    pending.clear();
  }
  worker.onmessage = ({ data: { id, result, error } }) => {
    const job = pending.get(id);
    if (!job) return;
    pending.delete(id);
    if (error) job.reject(new Error(error)); else job.resolve(result);
  };
  worker.onerror = event => dispose(new Error(event.message || 'Fixture worker failed'));
  worker.onmessageerror = () => dispose(new Error('Fixture worker returned an unreadable message'));
  // Clone once into the worker; the caller's source buffer remains usable.
  const ready = request({ source });
  return {
    async compose(options) { await ready; return request({ options }); },
    dispose,
  };
}
