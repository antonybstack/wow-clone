import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';

const names = [
  'createRenderTarget', 'createSurfaceRenderTargetTexture', 'disposeRenderTargetTexture', 'createEffectWrapper',
  'createEffectRenderTask', 'createScreenSpaceContactShadowsPostProcessTask',
  'setEffectTexture', 'setEffectUniforms', 'disposeEffectWrapper',
  'getViewProjectionMatrix', 'invertMat4', 'getCameraPosition',
];
const mockUrl = `data:text/javascript,${encodeURIComponent(names.map(name =>
  `export const ${name}=(...args)=>globalThis.__contactLite.${name}(...args);`).join('\n'))}`;
registerHooks({resolve(specifier, context, nextResolve) {
  if (specifier === '@babylonjs/lite') return {url: mockUrl, shortCircuit: true};
  return nextResolve(specifier, context);
}});
const {createContactOcclusion} = await import('../src/ashen-reach/contact-occlusion.js');

test('contact composite uses one task-owned, resize-aware sampled facade', () => {
  const engine = {canvas: {width: 1280, height: 720}};
  const scene = {camera: {}};
  const sourceRT = {
    _width: 1280, _height: 720, _colorView: {},
    _depthTexture: {createView: () => ({})},
  };
  const calls = {facades: [], textures: [], targetDisposals: [], setupDisposals: [], effectDisposals: 0};
  let compositeResult;
  let failCompositeSetup = false;
  globalThis.__contactLite = {
    createRenderTarget: descriptor => ({_descriptor: descriptor, _colorView: {}}),
    createSurfaceRenderTargetTexture: (owner, descriptor) => {
      assert.equal(owner, engine);
      assert.equal(descriptor.size, engine);
      assert.equal(descriptor.samples, 1);
      const texture = {view: {}, width: engine.canvas.width, height: engine.canvas.height};
      const rt = {_descriptor: descriptor, _width: texture.width, _height: texture.height, _colorView: texture.view};
      compositeResult = {rt, texture};
      calls.facades.push(compositeResult);
      return compositeResult;
    },
    disposeRenderTargetTexture: result => calls.setupDisposals.push(result),
    createEffectWrapper: (_, config) => ({name: config.name}),
    createEffectRenderTask: config => {
      if (failCompositeSetup && config.name === 'ashen-contact-composite') throw Error('task setup failed');
      return {
      name: config.name, target: config.target,
      record() {
        if (config.target === compositeResult?.rt) {
          compositeResult.texture.width = engine.canvas.width;
          compositeResult.texture.height = engine.canvas.height;
          config.target._width = engine.canvas.width;
          config.target._height = engine.canvas.height;
        }
      },
      execute() {},
      dispose() {calls.targetDisposals.push(config.target);},
      };
    },
    createScreenSpaceContactShadowsPostProcessTask: () => ({
      shadowTexture: {_colorView: {}}, execute() {}, dispose() {}, resetVersion: 0,
    }),
    setEffectTexture: (effect, name, texture) => calls.textures.push({effect: effect.name, name, texture}),
    setEffectUniforms() {},
    disposeEffectWrapper: () => calls.effectDisposals++,
    getViewProjectionMatrix: () => new Float32Array(16),
    invertMat4: () => new Float32Array(16),
    getCameraPosition: () => ({x: 0, y: 0, z: 0}),
  };

  const contact = createContactOcclusion(engine, scene, sourceRT);
  assert.equal(calls.facades.length, 1);
  assert.equal(contact.output, compositeResult.rt);
  assert.equal(contact.outputTexture, compositeResult.texture);
  assert.equal(contact.compositeTask.target, compositeResult.rt);
  contact.aoTask.record();
  contact.compositeTask.record();
  assert.deepEqual(contact.state.aoResolution, [640, 360]);

  engine.canvas.width = sourceRT._width = 913;
  engine.canvas.height = sourceRT._height = 517;
  contact.aoTask.record();
  contact.compositeTask.record();
  assert.deepEqual(contact.state.aoResolution, [457, 259]);
  assert.equal(contact.outputTexture, compositeResult.texture);
  assert.deepEqual([contact.outputTexture.width, contact.outputTexture.height], [913, 517]);

  contact.compositeTask.dispose();
  assert.deepEqual(calls.targetDisposals, [compositeResult.rt]);
  assert.equal(calls.effectDisposals, 1);
  assert.deepEqual(calls.setupDisposals, [], 'task disposal owns the successful target');

  failCompositeSetup = true;
  assert.throws(() => createContactOcclusion(engine, scene, sourceRT), /task setup failed/);
  assert.deepEqual(calls.setupDisposals, [compositeResult], 'setup failure releases unowned facade');
});
