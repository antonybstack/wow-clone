import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';

// Replace only Lite at the import boundary. The production modules, including
// their cleanup order and asynchronous continuations, run unchanged below.
const names = [
  'createCsmDirectionalShadowGenerator','createPcfDirectionalShadowGenerator',
  'createPcfSpotlightShadowGenerator','createDirectionalLight','createSpotLight',
  'createShaderMaterial','addTask','onSceneDispose','setShadowCasterMaterial',
  'setShadowTaskCasterMeshes','setShadowGeneratorEnabled','getCsmReceiverTexture','onCsmReceiverUpdate',
  'setShaderTexture','setShaderUniform','enableSkeletonShadows','getViewMatrix',
  'acquireTexture','releaseTexture','enableMaterialPlugins','isPbrMaterial',
  'markMaterialUboDirty','onBeforeRender','rebuildMaterial',
];
const mockUrl = version => `data:text/javascript,${encodeURIComponent([
  `export const VERSION=${JSON.stringify(version)};`,
  ...names.map(name => `export const ${name}=(...args)=>globalThis.__shadowLite.${name}(...args);`),
].join('\n'))}`;
registerHooks({resolve(specifier, context, nextResolve) {
  if (specifier === '@babylonjs/lite') return {url: mockUrl(globalThis.__mockLiteVersion || '1.28.0'), shortCircuit: true};
  return nextResolve(specifier, context);
}});
const {createSunShadows} = await import('../src/ashen-reach/sun-shadows.js');
const {createLocalLights} = await import('../src/ashen-reach/local-lights.js');

function fixture({badFar = false, badCsm = false, badLocalSlot = -1, deferredPreload = false} = {}) {
  const count = {acquire: 0, release: 0, rawDestroy: 0, uboDestroy: 0,
    taskDispose: 0, unsubscribe: 0};
  const generators = [];
  const pending = [];
  const scene = {meshes: [], tasks: [], disposals: [], beforeRender: []};
  const sun = {shadowGenerator: null};
  const queue = {onSubmittedWorkDone: () => Promise.resolve()};
  const engine = {_device: {queue}};
  const texture = () => ({createView: () => ({}), destroy: () => { count.rawDestroy++; }});
  const ubo = () => ({destroy: () => { count.uboDestroy++; }});
  const generator = (kind, invalid = false) => {
    const renderTask = {record() {}, dispose() { count.taskDispose++; }};
    const state = {_task: renderTask};
    const value = {
      kind, _depthTexture: texture(), _depthSampler: {}, _lightMatrix: new Float32Array(16),
      _shadowUBO: ubo(), _shadowParamsUBO: ubo(), _config: {}, _version: 0,
      _shadowTaskState: null,
      _preloadShadowTask: () => deferredPreload
        ? new Promise(resolve => pending.push(resolve)) : Promise.resolve(),
      _ensureShadowTaskState: () => state,
      _renderShadowMap: () => 0,
    };
    if (invalid) value._lightMatrix = null;
    if (kind === 'csm' && badCsm) value._depthTexture = null;
    generators.push(value);
    return value;
  };
  globalThis.__shadowLite = Object.fromEntries(names.map(name => [name, () => {}]));
  Object.assign(globalThis.__shadowLite, {
    createCsmDirectionalShadowGenerator: () => generator('csm'),
    createPcfDirectionalShadowGenerator: () => generator('far', badFar),
    createPcfSpotlightShadowGenerator: () => generator('local', generators.filter(g => g.kind === 'local').length === badLocalSlot),
    createDirectionalLight: () => ({position: {x: 0, y: 0, z: 0}}),
    createSpotLight: () => ({position: {x: 0, y: 0, z: 0}, range: 0}),
    createShaderMaterial: () => ({}),
    addTask: (target, task) => target.tasks.push(task),
    onSceneDispose: (target, dispose) => target.disposals.push(dispose),
    onBeforeRender: (target, callback) => target.beforeRender.push(callback),
    getCsmReceiverTexture: sg => {
      const wrapper = {texture: sg._depthTexture, view: {}, sampler: sg._depthSampler};
      globalThis.__shadowLite.acquireTexture(wrapper);
      return wrapper;
    },
    onCsmReceiverUpdate: () => () => { count.unsubscribe++; },
    acquireTexture: () => { count.acquire++; },
    releaseTexture: () => { count.release++; },
    getViewMatrix: () => new Float32Array(16),
    isPbrMaterial: () => false,
  });
  return {count, generators, pending, scene, sun, engine};
}

test('sun setup failure releases CSM owner and unacquired far depth once', () => {
  const f = fixture({badFar: true});
  assert.throws(() => createSunShadows(f.engine, f.scene, f.sun), /far PCF bridge unavailable/);
  assert.equal(f.count.acquire, 0);
  assert.equal(f.count.release, 0);
  assert.equal(f.count.rawDestroy, 2);
  assert.equal(f.count.uboDestroy, 4);
  assert.equal(f.sun.shadowGenerator, null);
  f.scene.disposals.forEach(dispose => dispose());
  assert.equal(f.count.rawDestroy, 2);
});

test('sun failure after CSM receiver acquisition releases only acquired owners', () => {
  const f = fixture({badCsm: true});
  assert.throws(() => createSunShadows(f.engine, f.scene, f.sun), /CSM bridge unavailable/);
  assert.equal(f.count.acquire, 2);
  assert.equal(f.count.release, 2);
  assert.equal(f.count.rawDestroy, 0);
  assert.equal(f.count.uboDestroy, 4);
  f.scene.disposals.forEach(dispose => dispose());
  assert.equal(f.count.release, 2);
});

test('sun CSM retirement and far task disposal remain once-only after scene disposal', async () => {
  const f = fixture();
  const shadows = createSunShadows(f.engine, f.scene, f.sun);
  const previous = {_task: {dispose() { f.count.taskDispose++; }}};
  shadows.csm._shadowTaskState = previous;
  shadows.update(true);
  const farTask = f.scene.tasks[0];
  farTask.record();
  farTask.dispose();
  farTask.dispose();
  f.scene.disposals.forEach(dispose => dispose());
  f.scene.disposals.forEach(dispose => dispose());
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.count.taskDispose, 2); // previous CSM + current far PCF
  assert.equal(f.count.release, 2); // far owner + CSM generator-owner exception
  assert.equal(f.count.uboDestroy, 4);
  assert.equal(f.count.unsubscribe, 1);
  assert.equal(f.sun.shadowGenerator, null);
  shadows.update(true);
  assert.equal(f.count.taskDispose, 2);
});

test('local partial setup and pending preload dispose every owned resource once', async () => {
  const bad = fixture({badLocalSlot: 1});
  assert.throws(() => createLocalLights(bad.engine, bad.scene, {casters: [], dynamicCasters: []}),
    /local PCF bridge unavailable/);
  assert.equal(bad.count.acquire, 1);
  assert.equal(bad.count.release, 1);
  assert.equal(bad.count.rawDestroy, 1);
  assert.equal(bad.count.uboDestroy, 4);
  bad.scene.disposals.forEach(dispose => dispose());
  assert.equal(bad.count.release, 1);

  const f = fixture({deferredPreload: true});
  const mesh = {visible: true, material: {}};
  const local = createLocalLights(f.engine, f.scene, {casters: [mesh], dynamicCasters: []});
  local.update(.1, {x: 0, z: 0});
  f.scene.disposals.forEach(dispose => dispose());
  f.scene.disposals.forEach(dispose => dispose());
  f.pending.forEach(resolve => resolve());
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(local.state.disposed, true);
  assert.deepEqual(local.casters, []);
  assert.equal(f.count.acquire, 2);
  assert.equal(f.count.release, 2);
  assert.equal(f.count.uboDestroy, 4);
});

test('local frame-graph task disposal is once-only across repeated teardown', async () => {
  const f = fixture();
  const mesh = {visible: true, material: {}};
  const local = createLocalLights(f.engine, f.scene, {casters: [mesh], dynamicCasters: []});
  local.update(.1, {x: 0, z: 0});
  await new Promise(resolve => setImmediate(resolve));
  for (const task of f.scene.tasks) {
    task.record();
    task.dispose();
    task.dispose();
  }
  f.scene.disposals.forEach(dispose => dispose());
  f.scene.disposals.forEach(dispose => dispose());
  assert.equal(f.count.taskDispose, 2);
  assert.equal(f.count.release, 2);
});

test('private layout guard admits exact 1.31.1 and rejects unreviewed versions', async () => {
  globalThis.__mockLiteVersion = '1.31.1';
  const candidateSun = await import('../src/ashen-reach/sun-shadows.js?bridge-version=1311');
  const candidateLocal = await import('../src/ashen-reach/local-lights.js?bridge-version=1311');
  const f = fixture();
  candidateSun.createSunShadows(f.engine, f.scene, f.sun);
  candidateLocal.createLocalLights(f.engine, f.scene, {casters: [], dynamicCasters: []});
  f.scene.disposals.forEach(dispose => dispose());
  assert.equal(f.count.release, 4); // CSM, far PCF and both local PCF maps

  globalThis.__mockLiteVersion = '1.30.0';
  const unsupportedSun = await import('../src/ashen-reach/sun-shadows.js?bridge-version=1300');
  const unsupportedLocal = await import('../src/ashen-reach/local-lights.js?bridge-version=1300');
  const g = fixture();
  assert.throws(() => unsupportedSun.createSunShadows(g.engine, g.scene, g.sun), /Unsupported Lite shadow bridge version/);
  assert.throws(() => unsupportedLocal.createLocalLights(g.engine, g.scene, {casters: [], dynamicCasters: []}), /Unsupported Lite local PCF bridge version/);
  assert.equal(g.generators.length, 0);
  delete globalThis.__mockLiteVersion;
});
