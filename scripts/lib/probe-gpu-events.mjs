/** Optional probe instrumentation, installed before navigation. API-call duration is
 * CPU time; a queue promise includes browser callback delivery, not GPU timestamps.
 * https://developer.mozilla.org/en-US/docs/Web/API/GPUQueue/onSubmittedWorkDone
 * https://developer.mozilla.org/en-US/docs/Web/API/GPUDevice/createRenderPipelineAsync
 * Keep this out of the game bundle and collect official gates without it.
 */
export function installGpuEventProbe() {
  const log = globalThis.__startupGpuEvents = {devices: [], pipelines: [], shaders: [], queues: [], animationFrames: []};
  const modules = new WeakMap();
  let submitted = 0;
  const active = () => !globalThis.__stopGpuEventProbe;
  function wrap(prototype, name, invoke) {
    const original = prototype[name];
    if (typeof original !== 'function') return;
    prototype[name] = function (...args) { return invoke.call(this, original, args); };
  }
  for (const [prototype, method] of [[GPU.prototype, 'requestAdapter'], [GPUAdapter.prototype, 'requestDevice']]) {
    wrap(prototype, method, function (original, args) {
      const row={method,start:performance.now()},result=original.apply(this,args);
      if(active()) {log.devices.push(row);result.then(()=>{row.ready=performance.now();},error=>{row.error=String(error);});}
      return result;
    });
  }
  wrap(GPUDevice.prototype, 'createShaderModule', function (original, args) {
    const start = performance.now(), module = original.apply(this, args);
    if (active()) {
      const row = {id: log.shaders.length + 1, label: args[0]?.label ?? '', length: args[0]?.code?.length, start, end: performance.now()};
      modules.set(module, row.id); log.shaders.push(row);
    }
    return module;
  });
  for (const method of ['createRenderPipeline', 'createRenderPipelineAsync', 'createComputePipeline', 'createComputePipelineAsync']) {
    wrap(GPUDevice.prototype, method, function (original, args) {
      const descriptor = args[0], start = performance.now();
      const result = original.apply(this, args);
      if (active()) {
        const row = {method, label: descriptor?.label ?? '', start, callEnd: performance.now(), vertex: modules.get(descriptor?.vertex?.module), fragment: modules.get(descriptor?.fragment?.module), compute: modules.get(descriptor?.compute?.module)};
        log.pipelines.push(row);
        if (method.endsWith('Async')) result.then(() => {row.ready = performance.now();}, error => {row.error = String(error);});
      }
      return result;
    });
  }
  wrap(GPUQueue.prototype, 'submit', function (original, args) {
    const start = performance.now(), result = original.apply(this, args);
    submitted++;
    if (active() && log.queues.length < 512) log.queues.push({method: 'submit', serial: submitted, start, callEnd: performance.now(), buffers: args[0]?.length});
    return result;
  });
  wrap(GPUQueue.prototype, 'onSubmittedWorkDone', function (original, args) {
    const row = {method: 'onSubmittedWorkDone', serial: submitted, start: performance.now()}, result = original.apply(this, args);
    if (active() && log.queues.length < 512) {
      log.queues.push(row);
      result.then(() => {row.ready = performance.now();}, error => {row.error = String(error);});
    }
    return result;
  });
  const raf = globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame = function (callback) {
    return raf.call(this, timestamp => {
      const start = performance.now();
      try {return callback(timestamp);} finally {
        if (active() && log.animationFrames.length < 512) log.animationFrames.push({start, end: performance.now()});
      }
    });
  };
}
