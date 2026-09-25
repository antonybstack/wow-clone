import {renderFrame, resizeEngine, waitForGpuIdle, onSceneDispose} from '@babylonjs/lite';
import {createFrameScheduler} from './frame-scheduler.js';

/** Bound unacknowledged submissions so an uncapped CPU cannot flood the GPU queue. */
export function createRenderLoop(engine, scene, {onError = console.error} = {}) {
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
    if (disposed) return;
    dispose();
    if (info.reason !== 'destroyed') onError(new Error(`GPU device lost: ${info.message}`));
  });
  return {
    state: scheduler.state,
    start: scheduler.start,
    dispose,
    beginMeasurement() { measurement = []; },
    endMeasurement() { const result = measurement || []; measurement = null; return result; },
  };
}
