import assert from 'node:assert/strict';
import test from 'node:test';
import { createPbrMaterial, createStandardMaterial, createSceneContext, setPbrAlphaCutoff, setShadowCasterMaterial } from '@babylonjs/lite';
import { configureLinearMaterials } from '../src/ashen-reach/linear-materials.js';
import {
  createLocalLightPlugin, configureLocalLightMaterials, prepareLocalLightMaterial,
} from '../src/ashen-reach/local-light-materials.js';
import { LOCAL_LIGHT_UNIFORMS } from '../src/ashen-reach/local-light-shared.js';
import { createPbrTemplate } from '../node_modules/@babylonjs/lite/lib/material/pbr/pbr-template.js';
import { composeShader } from '../node_modules/@babylonjs/lite/lib/shader/shader-composer.js';
import { buildPluginFragment } from '../node_modules/@babylonjs/lite/lib/material/plugin/plugin-bridge-shared.js';
import { createIblFragment } from '../node_modules/@babylonjs/lite/lib/material/pbr/fragments/ibl-fragment.js';
import { createPbrNoColorMaterialView } from '../node_modules/@babylonjs/lite/lib/material/pbr/no-color-view.js';
import { _computePbrMaterialFeatures } from '../node_modules/@babylonjs/lite/lib/material/pbr/pbr-material.js';
import { createPbrComposer } from '../node_modules/@babylonjs/lite/lib/material/pbr/pbr-compose.js';
import { PBR_HAS_ALPHA_BLEND } from '../node_modules/@babylonjs/lite/lib/material/pbr/pbr-flag-bits.js';
import { getNoColorView, preloadPcfShadowTaskState, resolveShadowCasterMaterial } from '../node_modules/@babylonjs/lite/lib/shadow/pcf-shadow-task-hooks.js';

function fixture() {
  const engine = { _currentDelta: 16, useFloatingOrigin: false };
  engine.engine = engine;
  return createSceneContext(engine, { defaultRenderTask: false });
}
function controller() {
  return {
    slots: [{ texture: { view: {}, sampler: {} } }, { texture: { view: {}, sampler: {} } }],
    values: Object.fromEntries(LOCAL_LIGHT_UNIFORMS.map(({ name, type }) =>
      [name, new Float32Array(type.startsWith('mat') ? 16 : 4)])),
    state: {},
  };
}

test('prepare is inert before configuration; attach preserves plugins and other material families', () => {
  const scene = fixture(), c = controller(), material = createPbrMaterial();
  const original = Object.freeze({ name: 'existing' });
  material.plugins = Object.freeze([original]);
  assert.equal(prepareLocalLightMaterial(scene, material), 0);
  assert.equal(scene._beforeRender.length, 0);
  const attach = configureLocalLightMaterials(scene, c);
  assert.equal(configureLocalLightMaterials(scene, c), attach);
  assert.throws(() => configureLocalLightMaterials(scene, controller()), /another controller/);
  assert.equal(prepareLocalLightMaterial(scene, material), 1);
  assert.equal(material.plugins[0], original);
  assert.equal(attach(material), 0);
  assert.equal(material.plugins.length, 2);
  assert.equal(attach(createStandardMaterial()), 0);
  assert.equal(prepareLocalLightMaterial(scene, null), 0);
});

test('PBR uniform version advances on frames and newly streamed materials attach', () => {
  const scene = fixture(), material = createPbrMaterial();
  configureLocalLightMaterials(scene, controller());
  scene.meshes.push({ material });
  scene._update();
  assert.equal(material.plugins.length, 1);
  assert.equal(material.plugins[0].dynamic, true);
  const version = material._uboVersion;
  scene._update();
  assert.ok(material._uboVersion > version);
  const streamed = createPbrMaterial();
  assert.equal(prepareLocalLightMaterial(scene, streamed), 1);
});

test('real Lite composition declares depth/comparison bindings and writes byte-addressed UBO values', () => {
  const c = controller(), plugin = createLocalLightPlugin(c);
  const composed = composeShader(createPbrTemplate({}), [buildPluginFragment([plugin], 1, false)._fragment]);
  const source = composed._fragmentWGSL;
  assert.match(source, /var localShadow0:texture_depth_2d/);
  assert.match(source, /var localShadow1Sampler:sampler_comparison/);
  assert.ok(!source.includes('shaderUniforms.'));
  assert.match(source, /material\.localMatrix0/);
  const entries = composed._meshBGLDescriptor.entries;
  assert.equal(entries.filter(e => e.texture?.sampleType === 'depth').length, 2);
  assert.equal(entries.filter(e => e.sampler?.type === 'comparison').length, 2);
  const spec = composed._materialUboSpec;
  const data = new Float32Array(spec._totalBytes / 4);
  c.values.localMatrix0[12] = 37;
  c.values.localColor1.set([1, 0.5, 0.25, 2]);
  plugin.writeUbo(data, spec._offsets);
  assert.equal(data[spec._offsets.get('localMatrix0') / 4 + 12], 37);
  assert.deepEqual(Array.from(data.subarray(spec._offsets.get('localColor1') / 4,
    spec._offsets.get('localColor1') / 4 + 4)), [1, 0.5, 0.25, 2]);
  const textures = [], bindings = [];
  plugin.getActiveTextures(textures);
  plugin.bindTextures(bindings);
  assert.deepEqual(textures, c.slots.map(s => s.texture));
  assert.deepEqual(bindings, c.slots.map(s => ({ texture: s.texture })));
});

test('AI/NI evaluates local irradiance once after IBL and before V13 linear capture', () => {
  const scene = fixture(), c = controller(), material = createPbrMaterial();
  configureLinearMaterials(scene)(material);
  configureLocalLightMaterials(scene, c)(material);
  const template = createPbrTemplate({
    _hasIbl: true, _hasTonemap: true,
    _toneMappingCall: scene.imageProcessing.toneMapping.callWGSL,
  });
  const source = composeShader(template, [
    createIblFragment(false), buildPluginFragment(material.plugins, 2, false)._fragment,
  ])._fragmentWGSL;
  const additions = [...source.matchAll(/color \+= surfaceAlbedo \* localIrradiance/g)].map(m => m.index);
  assert.equal(additions.length, 2, 'installed hook occurs at AI and NI');
  assert.ok(additions[1] > source.indexOf('color=finalIrradiance+'));
  assert.ok(additions[1] < source.indexOf('var ashenLinearRadiance = color;'));
  assert.ok(source.indexOf('color = ashenLinearRadiance;') > source.indexOf('color=clamp(color'));
  const code = createLocalLightPlugin(c).getCustomCode('fragment');
  // This injection uses only scalar control flow/arithmetic. Execute that flow
  // twice, with the native IBL color reconstruction between the two slots.
  const js = code.CUSTOM_FRAGMENT_BEFORE_FINALCOLORCOMPOSITION.replace(/(\d+)u\b/g, '$1');
  const run = new Function(`
    let ashenLocalCompositionPass=0, color=0, calls=0;
    const surfaceAlbedo=0.5, input={worldPos:0}, N=0;
    const localIrradiance=()=>{calls++;return 4;};
    ${js}
    color=10;
    ${js}
    return {color,calls};
  `);
  assert.deepEqual(run(), { color: 12, calls: 1 });
});

test('native no-color views inherit receiver bindings: caster override is required', () => {
  const material = createPbrMaterial();
  material.plugins = [createLocalLightPlugin(controller())];
  const view = createPbrNoColorMaterialView(material);
  assert.equal(view.plugins, material.plugins);
  const compiled = composeShader(createPbrTemplate({ _noColorOutput: true }), [
    buildPluginFragment(view.plugins, 3, false)._fragment,
  ]);
  assert.ok(!compiled._fragmentWGSL.includes('color += surfaceAlbedo'));
  assert.equal(compiled._meshBGLDescriptor.entries.filter(e => e.texture?.sampleType === 'depth').length, 2);
});

test('caster alias retains native material state, but native no-color composition has no receiver bindings', async () => {
  const scene = fixture(), c = controller(), material = createPbrMaterial({
    alpha: 0.7, alphaBlend: true, doubleSided: true, baseColorTexture: {},
  });
  configureLinearMaterials(scene)(material);
  const attach = configureLocalLightMaterials(scene, c);
  attach(material);
  setPbrAlphaCutoff(material, 0.52);
  material._renderFeatures = _computePbrMaterialFeatures(material);
  assert.notEqual(material._pi, 0, 'source has a native plugin pipeline index');
  const alias = material._shadowCasterMaterial;
  assert.equal(Object.getPrototypeOf(alias), material);
  assert.equal(alias._shadowCasterMaterial, undefined);
  assert.equal(resolveShadowCasterMaterial(material), alias, 'caster chain terminates');
  assert.equal(alias._pi, 0);
  assert.deepEqual(alias.plugins, []);
  assert.equal(alias._buildGroup, material._buildGroup, 'native PBR mesh/skeleton builder retained');
  // Exercise the actual shared PCF/CSM override resolver and async preloader.
  await preloadPcfShadowTaskState([{ material }]);
  const view = getNoColorView(material, new Map());
  assert.equal(view.source, alias, 'no-color view does not flatten back to receiver');
  assert.equal(view.baseColorTexture, material.baseColorTexture);
  assert.equal(view.doubleSided, true);
  assert.equal(view.alpha, 0.7);
  assert.equal(view._renderFeatures.features, material._renderFeatures.features & ~PBR_HAS_ALPHA_BLEND);
  material.alpha = 0.4;
  material._alphaCutOff = 0.52;
  material._csmGen = 8;
  assert.equal(view.alpha, 0.4);
  assert.equal(view._alphaCutOff, 0.52);
  assert.equal(alias._csmGen, 8, 'caster material invalidation still propagates');
  const composed = createPbrComposer({})(
    view._renderFeatures.features, view._renderFeatures.features2,
    0, 0, 0, '', '', undefined, '', 0, view._pi,
  );
  assert.ok(!composed._fragmentWGSL.includes('localShadow'));
  assert.ok(!composed._fragmentWGSL.includes('localIrradiance'));
  assert.ok(!composed._fragmentWGSL.includes('ashenLinearRadiance'));
  assert.ok(composed._fragmentWGSL.includes('discard'), 'native alpha-test survives the caster alias');
  assert.equal(composed._meshBGLDescriptor.entries.filter(e => e.texture?.sampleType === 'depth').length, 0);
  attach(material);
  assert.equal(material._shadowCasterMaterial, alias, 'stable alias across frames');
});

test('existing explicit caster overrides are preserved', () => {
  const scene = fixture(), material = createPbrMaterial(), explicit = createPbrMaterial();
  setShadowCasterMaterial(material, explicit);
  configureLocalLightMaterials(scene, controller())(material);
  assert.equal(material._shadowCasterMaterial, explicit);
});
