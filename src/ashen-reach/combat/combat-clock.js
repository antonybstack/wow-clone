/** Active combat time shares the render owner but not Havok's movement clamp.
 * Hidden/modal time is excluded. A long active stall requests the solo pause UI.
 */
export function createCombatClock() {
  let time = 0, suspended = true, pauseRequested = false;
  return {
    get time() { return time; },
    step(elapsedSeconds, { ready = true, paused = false, hidden = false } = {}) {
      if (paused) { pauseRequested = false; suspended = true; return { dt: 0, time, pause: false }; }
      if (!ready || hidden) { suspended = true; return { dt: 0, time, pause: false }; }
      if (pauseRequested) return { dt: 0, time, pause: true };
      if (suspended) { suspended = false; return { dt: 0, time, pause: false }; }
      if (!Number.isFinite(elapsedSeconds) || elapsedSeconds < 0 || elapsedSeconds > .5) {
        suspended = true; pauseRequested = true;
        return { dt: 0, time, pause: true };
      }
      time += elapsedSeconds;
      return { dt: elapsedSeconds, time, pause: false };
    },
    suspend() { suspended = true; },
  };
}
