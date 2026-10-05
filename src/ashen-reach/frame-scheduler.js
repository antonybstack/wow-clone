/** Inject synchronous render, asynchronous RAF-style scheduling, and completion promises.
 * stop/dispose is terminal; visibility uses setHidden. Pending counts acknowledgements,
 * not GPU execution depth. maxPending is the configured budget; waits counts saturation.
 * Every render, including after a completion frees a slot, runs from a requestFrame callback:
 * requestAnimationFrame is one-shot and its callback frequency generally matches the display
 * refresh rate, which is the pacing this loop must keep. Rendering directly from a completion
 * bypassed it (a GPU-completion-driven loop, ~4x the RAF rate in standard Chrome).
 * https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame
 */
export function createFrameScheduler({render, waitForCompletion, requestFrame, cancelFrame,
 now = () => performance.now(), maxPending = 8, hidden = false, onError = () => {}}) {
 if (!Number.isSafeInteger(maxPending) || maxPending < 1) throw new RangeError('Invalid frame budget');
 const state = {pending: 0, maxPending, rendered: 0, waits: 0, error: null};
 let running = false, stopped = false, waiting = false, rendering = false;
 let frame = null, lastTime = null, generation = 0, resolveFirst, rejectFirst;
 const firstFrame = new Promise((resolve, reject) => { resolveFirst = resolve; rejectFirst = reject; });
 firstFrame.catch(() => {}); // Stopping before first render must never leak a rejection.
 function stop(reason) {
  if (stopped) return;
  stopped = true; running = false; waiting = false; generation++;
  if (frame !== null) cancelFrame(frame);
  frame = null; lastTime = null;
  const error = reason ?? Object.assign(new Error('Frame scheduler stopped'), {name: 'AbortError'});
  rejectFirst(error);
 }
 function fail(error) {
  if (stopped) return;
  state.error = error; stop(error);
  try { onError(error); } catch { /* Error reporting must not reject completion handlers. */ }
 }
 function schedule() {
  if (!running || stopped || hidden || rendering || frame !== null) return;
  if (state.pending >= maxPending) {
   if (!waiting) state.waits++;
   waiting = true;
   return;
  }
  waiting = false;
  const token = generation;
  try {
   frame = requestFrame(() => {
    if (token !== generation) return;
    frame = null;
    renderNow();
   });
  } catch (error) { fail(error); }
 }
 function complete(token, error, rejected = false) {
  state.pending--;
  if (token !== generation || stopped) return;
  if (rejected) { fail(error); return; }
  // Released budget only requests (at most one) frame; it never renders directly.
  schedule();
 }
 function renderNow() {
  if (rendering || !running || stopped || hidden) return;
  if (state.pending >= maxPending) { schedule(); return; }
  rendering = true; waiting = false;
  const token = generation;
  let reserved = false;
  try {
   const time = now(), delta = lastTime === null ? 0 : Math.max(0, time - lastTime);
   lastTime = time;
   state.pending++; reserved = true;
   render(delta);
   state.rendered++; resolveFirst();
   if (stopped) { state.pending--; reserved = false; return; }
   const completion = waitForCompletion();
   Promise.resolve(completion).then(() => complete(token), error => complete(token, error, true));
   reserved = false;
  } catch (error) {
   if (reserved) state.pending--;
   fail(error);
  } finally { rendering = false; }
  schedule();
 }
 return {
  state,
  start() {
   if (stopped) {
    const rejected = Promise.reject(state.error ?? new Error('Frame scheduler is terminal'));
    rejected.catch(() => {}); return rejected;
   }
   running = true; schedule(); return firstFrame;
  },
  stop: () => stop(), dispose: () => stop(),
  setHidden(value) {
   value = !!value;
   if (stopped || hidden === value) return;
   hidden = value; lastTime = null; waiting = false;
   if (hidden && frame !== null) { cancelFrame(frame); frame = null; }
   if (!hidden) schedule();
  },
 };
}
