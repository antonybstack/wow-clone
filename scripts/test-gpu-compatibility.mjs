import test from 'node:test';
import assert from 'node:assert/strict';
import {configureGpuCompatibility, withDepthFragment} from '../src/ashen-reach/gpu-compatibility.js';

function device({rejectVertexOnly = false, rejectAll = false} = {}) {
  const events = {}, scopes = [], descriptors = [];
  let lose;
  return {
    events, descriptors,
    lost: new Promise(resolve => { lose = resolve; }),
    lose: info => lose(info),
    addEventListener: (name, fn) => { events[name] = fn; },
    createShaderModule: descriptor => ({...descriptor}),
    pushErrorScope: type => { assert.equal(type, 'validation'); scopes.push(null); },
    popErrorScope: async () => scopes.pop(),
    createRenderPipeline(descriptor) { descriptors.push(descriptor); return {descriptor}; },
    async createRenderPipelineAsync(descriptor) { descriptors.push(descriptor); return {descriptor}; },
    createRenderBundleEncoder() {
      return {
        setPipeline(p) { if (rejectAll || (rejectVertexOnly && !p.descriptor.fragment)) scopes[scopes.length - 1] = {message: 'rejected depth-only bundle'}; },
        draw() {}, finish() {},
      };
    },
  };
}

test('supported device retains native pipeline constructors', async () => {
  const d = device(), original = d.createRenderPipeline;
  const state = await configureGpuCompatibility(d);
  assert.equal(state.depthBundle, 'native');
  assert.equal(d.createRenderPipeline, original);
  assert.equal(state.probeError, null);
});

test('rejected depth-only bundles select a verified empty-fragment material mode', async () => {
  const d = device({rejectVertexOnly: true});
  const original = d.createRenderPipeline;
  const state = await configureGpuCompatibility(d);
  assert.equal(state.depthBundle, 'empty-fragment');
  assert.match(state.probeError, /rejected/);
  assert.equal(state.fallbackError, null);
  const descriptor = Object.freeze({vertex: {module: {}}, depthStencil: {format: 'depth32float'}});
  const compatible = withDepthFragment(descriptor, {});
  assert.deepEqual(compatible.fragment.targets, []);
  assert.equal(compatible.vertex, descriptor.vertex);
  assert.equal(compatible.depthStencil, descriptor.depthStencil);
  assert.equal(descriptor.fragment, undefined, 'caller descriptor is not mutated');
  assert.equal(d.createRenderPipeline, original, 'public material option avoids modifying GPU APIs');
});

test('existing fragments including alpha-tested depth passes and color pipelines are preserved', () => {
  const alphaDepth = {depthStencil: {}, fragment: {module: {}, targets: []}};
  const color = {fragment: {targets: [{format: 'bgra8unorm'}]}};
  assert.equal(withDepthFragment(alphaDepth, {}), alphaDepth);
  assert.equal(withDepthFragment(color, {}), color);
  const noDepth = {vertex: {}};
  assert.equal(withDepthFragment(noDepth, {}), noDepth);
});

test('failed fallback is reported without installing an unverified wrapper', async () => {
  const d = device({rejectAll: true}), original = d.createRenderPipeline;
  const state = await configureGpuCompatibility(d);
  assert.equal(state.depthBundle, 'unsupported');
  assert.equal(d.createRenderPipeline, original);
  assert.equal(state.errors.length, 1);
});

test('device loss and validation errors stay visible with bounded diagnostic storage', async () => {
  const d = device(), state = await configureGpuCompatibility(d);
  d.lose({reason: 'unknown', message: 'test loss'}); await Promise.resolve();
  assert.match(state.errors[0], /Device lost/);
  for (let i = 0; i < 30; i++) d.events.uncapturederror({error: {message: `error ${i}`}});
  assert.equal(state.errors.length, 20);
});
