import {renderFrame, resizeEngine, waitForGpuIdle, onSceneDispose} from '@babylonjs/lite';
import {createFrameScheduler} from './frame-scheduler.js';

/** Bound unacknowledged submissions so an uncapped CPU cannot flood the GPU queue. */
export function createRenderLoop(engine, scene, {onError = console.error, onDeviceLost = onError} = {}) {
  let measurement = null, disposed = false;
  const scheduler = createFrameScheduler({
    maxPending: 4,
    hidden: document.hidden,
    requestFrame: callback => requestAnimationFrame(callback),
    cancelFrame: id => cancelAnimationFrame(id),
    waitForCompletion: () => waitForGpuIdle(engine),
    render(delta) {
      if (measurement && delta > 0) measurement.push(delta);
      resizeEngine(engine);
      renderFrame(engine, delta);
    },
    onError,
  });
  const visibility = () => scheduler.setHidden(document.hidden);
  function dispose() {
    if (disposed) return;
    disposed = true;
    scheduler.dispose();
    measurement = null;
    document.removeEventListener('visibilitychange', visibility);
  }
  document.addEventListener('visibilitychange', visibility);
  onSceneDispose(scene, dispose);
  engine._device.lost.then(info => {
    // An explicit disposal is silent; an active device loss needs a full-page
    // recovery even when WebGPU reports `destroyed` (our live test uses destroy()).
    // Lite's scene recovery cannot rebuild our PCF/CSM shadows yet:
    // https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/docs/lite/architecture/50-device-lost-recovery.md
    if (disposed) return;
    dispose();
    onDeviceLost(new Error(`GPU device lost: ${info.message || info.reason}`, {cause: info}), info);
  });
  return {
    state: scheduler.state,
    start: scheduler.start,
    dispose,
    beginMeasurement() { measurement = []; },
    endMeasurement() { const result = measurement || []; measurement = null; return result; },
  };
}
