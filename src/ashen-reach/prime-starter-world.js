import {registerSceneWithShadowSupport, resizeEngine, renderFrame, waitForGpuIdle, rebuildScenePbrPipelines} from '@babylonjs/lite';

/** Stop an app continuation on scene disposal even if its fetch/queue fence is pending.
 * No retry or alternate readiness boundary. The original work stays observed by Promise.race.
 * https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/throwIfAborted
 */
export async function waitForSceneWork(work, signal) {
  signal.throwIfAborted();
  let abort;
  const cancelled = new Promise((_, reject) => {
    abort = () => reject(signal.reason);
    signal.addEventListener('abort', abort, {once: true});
  });
  try {
    const result = await Promise.race([work, cancelled]);
    signal.throwIfAborted();
    return result;
  } finally {
    signal.removeEventListener('abort', abort);
  }
}

/** One exact-world frame behind the opaque loader, with no RAF loop or play signal.
 * Lite registration drains builders/material swaps; renderFrame submits synchronously.
 * Body installation can proceed while this existing queue fence completes. The caller
 * must register added character features again before its dressed/grounded play fence.
 * https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/packages/babylon-lite/src/engine/engine.ts
 * https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/packages/babylon-lite/src/scene/scene-core.ts
 */
export async function primeStarterWorld({engine, scene, signal, prepare, mark}) {
  signal.throwIfAborted();
  mark('prime-world-start');
  prepare();
  await waitForSceneWork(registerSceneWithShadowSupport(scene), signal);
  mark('prime-world-registered');
  resizeEngine(engine);
  renderFrame(engine, 0);
  mark('prime-world-submitted');
  const completion = waitForGpuIdle(engine);
  // Observe immediately, but return an object so async return does not await the fence.
  completion.then(() => {if (!signal.aborted) mark('prime-world-completed');}, () => {});
  return {completion,
    // The world-only PBR composer has no skin feature. Re-registration alone
    // reuses it; rescan with Lite's native group rebuild after character install.
    // https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/packages/babylon-lite/src/scene/scene-rebuild.ts
    rebuildCharacter: () => rebuildScenePbrPipelines(scene),
  };
}
