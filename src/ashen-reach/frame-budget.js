/**
 * Give the renderer the main thread back in the middle of a long build.
 *
 * Background loading that runs as one synchronous block is indistinguishable, from the
 * player's side, from a freeze: the render loop's animation-frame callback cannot run, so
 * input is not polled and physics does not step. Measured here, one uncut foliage pass held
 * the thread for 899 ms immediately after input was enabled -- the player pressed W and
 * nothing moved for a second.
 *
 * The yield is an animation frame, not `scheduler.yield()` and not `setTimeout(0)`.
 *
 * `scheduler.yield()` is the usual advice, and it was tried first here. It made the long
 * tasks disappear and the game still did not render: `ASHEN.gpu.frames` stayed at 4 for
 * 920 ms while the foliage built. Four is `createFrameScheduler`'s `maxPending`. Its
 * completion fence (`waitForGpuIdle`) resolves on a queued task, and a build that yields
 * with `scheduler.yield()` resumes ahead of that queue, so the fences never settled, the
 * scheduler stayed at its pending ceiling and stopped issuing frames. A long-task profile
 * said everything was fine; the frame counter said the player was looking at a still image.
 * Counting frames, not tasks, is what caught it.
 *
 * Awaiting an animation frame is self-limiting in the way that matters: the render loop
 * registers its own callback first, so by the time this one resumes the frame has been
 * rendered and its fence has had a turn. One slice per frame.
 * https://developer.mozilla.org/en-US/docs/Web/API/Scheduler/yield
 * https://web.dev/articles/optimize-long-tasks
 */
const yieldToFrame = () => new Promise(resolve => requestAnimationFrame(() => resolve()));

export {yieldToFrame};

/**
 * A stopwatch that says when to hand the frame back, and how much to take next time.
 *
 * A fixed slice cannot be right for both halves of the problem. Two milliseconds keeps
 * frames intact but stretched one foliage build to 6.3 s of background trickle; eight
 * finishes quickly and eats a 120 Hz frame budget on a machine that had no room.
 *
 * So the slice is a *share* of the frame rather than an absolute: at most `shareOfFrame` of
 * the interval the machine is actually achieving, clamped to [minMs, maxMs]. An absolute
 * ceiling was tried first and turned out to be untestable -- headless Chromium runs its
 * frames near 14 ms, which is already past any 120 FPS ceiling, so a ceiling rule pinned the
 * slice at its floor forever and adapted to nothing. A share is meaningful on both: whatever
 * a frame costs, background loading takes a known fraction of it and leaves the rest.
 */
export function createFrameBudget(minMs = 2, {maxMs = 8, shareOfFrame = 0.25} = {}) {
  let slice = minMs;
  let since = performance.now();
  let frameStart = since;
  return {
    get sliceMs() { return slice; },
    /** Yield if this slice is used up; returns whether it actually yielded. */
    async spend() {
      const now = performance.now();
      if (now - since < slice) return false;
      await yieldToFrame();
      const resumed = performance.now();
      // The interval includes our own slice, the render, and everything else the page did,
      // which is the point: the share is of the real frame, not of the render alone.
      const interval = resumed - frameStart;
      slice = Math.min(maxMs, Math.max(minMs, interval * shareOfFrame));
      frameStart = resumed;
      since = resumed;
      return true;
    },
    reset() { since = frameStart = performance.now(); },
  };
}
