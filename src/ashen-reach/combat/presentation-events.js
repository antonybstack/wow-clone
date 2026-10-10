/** Narrow, optional presentation owner, not gameplay authority or a global bus.
 * Events are values; no mesh/material/actor references cross this boundary.
 * A missing/failed presentation must never prevent release, damage or payment.
 */
export function createPresentationEvents({ reportError = () => {} } = {}) {
  let consumer = null, disposed = false, failures = 0;
  return {
    attach(next) {
      if (disposed) return () => {};
      consumer = next;
      return () => { if (consumer === next) consumer = null; };
    },
    emit(event) {
      if (!consumer || disposed) return;
      try { consumer(event); }
      catch (error) {
        failures++;
        // Retire a failed consumer; repeated failures must not flood every frame.
        consumer = null;
        try { reportError(error); } catch { /* Diagnostics cannot become damage authority. */ }
      }
    },
    get failures() { return failures; },
    dispose() { disposed = true; consumer = null; },
  };
}
