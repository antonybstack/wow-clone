import assert from 'node:assert/strict';
import test from 'node:test';
import { createPbrMaterial, createStandardMaterial, createSceneContext, setPbrUnlit } from '@babylonjs/lite';
import { configureLinearMaterials, prepareLinearMaterial } from '../src/ashen-reach/linear-materials.js';
import { createPbrTemplate } from '../node_modules/@babylonjs/lite/lib/material/pbr/pbr-template.js';
import { composeShader } from '../node_modules/@babylonjs/lite/lib/shader/shader-composer.js';
import { buildPluginFragment } from '../node_modules/@babylonjs/lite/lib/material/plugin/plugin-bridge-shared.js';
import { createUnlitFragment } from '../node_modules/@babylonjs/lite/lib/material/pbr/fragments/unlit-fragment.js';
import { createIblFragment } from '../node_modules/@babylonjs/lite/lib/material/pbr/fragments/ibl-fragment.js';
import { _computePbrMaterialFeatures } from '../node_modules/@babylonjs/lite/lib/material/pbr/pbr-material.js';
import { createPbrComposer } from '../node_modules/@babylonjs/lite/lib/material/pbr/pbr-compose.js';
import { PBR_HAS_TONEMAP } from '../node_modules/@babylonjs/lite/lib/material/pbr/pbr-flag-bits.js';

// Real Lite scene scheduling and shader composition, with no GPU/browser.
function sceneFixture() {
  const engine = { _currentDelta: 16, useFloatingOrigin: false };
  engine.engine = engine;
  return createSceneContext(engine, { defaultRenderTask: false });
}

function compiledSource(scene, material) {
  const { features, features2 } = _computePbrMaterialFeatures(material);
  const compose = createPbrComposer({ _tm: scene.imageProcessing.toneMapping });
  return compose(features, features2, 0, PBR_HAS_TONEMAP, 0, '', '',
    undefined, '', 0, material._pi)._fragmentWGSL;
}

function assertLinearOutput(source) {
  const capture = source.indexOf('var ashenLinearRadiance = color;');
  const gamma = source.indexOf('color=pow(color,vec3<f32>(1.0/2.2))');
  const clamp = source.indexOf('color=clamp(color');
  const restore = source.indexOf('color = ashenLinearRadiance;');
  const output = source.lastIndexOf('return vec4<f32>(color,');
  assert.ok(capture >= 0);
  assert.ok(capture < gamma && gamma < clamp && clamp < restore && restore < output,
    'radiance must be restored after display processing and before native alpha output');
  assert.equal(source.split('var ashenLinearRadiance = color;').length - 1, 1);
  assert.ok(!source.includes('var ashenLinearRadiance: vec3<f32>;'));
  assert.ok(!source.includes('color*=scene.vImageInfos.x'), 'native exposure must be bypassed');
  assert.ok(!source.includes('1.0-exp2(-1.590579*color)'), 'native tone curve must be replaced');
}

test('configuration is per scene, idempotent and preserves material plugins', () => {
  const scene = sceneFixture();
  const existing = { name: 'existing-plugin', getCustomCode: () => null };
  const material = createPbrMaterial({ plugins: Object.freeze([existing]) });
  scene.meshes.push({ material });
  const push = scene.meshes.push;
  const builder = material._buildGroup;
  const attach = configureLinearMaterials(scene);
  const callbackCount = scene._beforeRender.length;
  assert.equal(configureLinearMaterials(scene), attach);
  assert.equal(scene._beforeRender.length, callbackCount);
  assert.equal(scene.meshes.push, push);
  assert.equal(material._buildGroup, builder);
  assert.equal(material.plugins[0], existing);
  assert.equal(material.plugins.length, 2);
  assert.equal(attach(), 0);
  assert.equal(scene.imageProcessing.toneMappingEnabled, true);
  assert.equal(scene.imageProcessing.exposure, 1);
  assert.equal(scene.imageProcessing.contrast, 1);
  assertLinearOutput(compiledSource(scene, material));
});

test('ordinary, unlit and blended native materials all restore radiance', () => {
  const scene = sceneFixture();
  const attach = configureLinearMaterials(scene);
  for (const unlit of [false, true]) {
    for (const alphaBlend of [false, true]) {
      const material = createPbrMaterial({ alphaBlend, alpha: alphaBlend ? 0.4 : 1 });
      if (unlit) setPbrUnlit(material);
      assert.equal(attach(material), 1);
      const source = compiledSource(scene, material);
      assertLinearOutput(source);
      if (unlit) assert.ok(source.indexOf('color=baseColor*material.unlitColor;') <
        source.indexOf('ashenLinearRadiance = color;'));
      assert.ok(source.includes(alphaBlend
        ? 'return vec4<f32>(color,finalAlpha);'
        : 'return vec4<f32>(color,alpha*material.materialAlpha);'));
    }
  }
});

test('operator declares its own variable even before a late NPC receives the plugin', () => {
  const scene = sceneFixture();
  const attach = configureLinearMaterials(scene);
  for (const unlit of [false, true]) {
    for (const alphaBlend of [false, true]) {
      const material = createPbrMaterial({ alphaBlend, alpha: alphaBlend ? 0.4 : 1 });
      if (unlit) setPbrUnlit(material);
      const before = compiledSource(scene, material);
      assert.equal(before.match(/\bashenLinearRadiance\b/g)?.length, 1,
        'before attachment the sole reference must be the self-contained declaration');
      assert.ok(before.includes('var ashenLinearRadiance = color;'));
      assert.ok(!before.includes('color = ashenLinearRadiance;'),
        'without the plugin output is still encoded; this is only compilation safety');
      attach(material);
      assert.equal(material.plugins[0].getCustomCode('fragment').CUSTOM_FRAGMENT_MAIN_BEGIN, undefined);
      assertLinearOutput(compiledSource(scene, material));
    }
  }
});

test('synchronous attachment before scene entry covers the first streamed shader', () => {
  const scene = sceneFixture();
  configureLinearMaterials(scene);
  for (const kind of ['NPC tint', 'shade garment', 'race body', 'streamed equipment']) {
    const material = createPbrMaterial({ name: kind });
    assert.equal(prepareLinearMaterial(scene, material), 1);
    scene.meshes.push({ material });
    // Deliberately compile BEFORE any onBeforeRender callback.
    assertLinearOutput(compiledSource(scene, material));
    assert.equal(prepareLinearMaterial(scene, material), 0);
  }
});

test('preparation is a no-op in an unconfigured scene and installs no callbacks', () => {
  const scene = sceneFixture();
  const material = createPbrMaterial();
  const callbacks = scene._beforeRender.length;
  const imageProcessing = { ...scene.imageProcessing };
  assert.equal(prepareLinearMaterial(scene, material), 0);
  assert.equal(prepareLinearMaterial(scene, null), 0);
  assert.equal(material.plugins, undefined);
  assert.equal(scene._beforeRender.length, callbacks);
  assert.deepEqual(scene.imageProcessing, imageProcessing);
  configureLinearMaterials(scene);
  const configuredCallbacks = scene._beforeRender.length;
  assert.equal(prepareLinearMaterial(scene, material), 1);
  assert.equal(prepareLinearMaterial(scene, null), 0);
  assert.equal(prepareLinearMaterial(scene, createStandardMaterial()), 0);
  assert.equal(scene._beforeRender.length, configuredCallbacks);
  assertLinearOutput(compiledSource(scene, material));
});

test('environment lighting and unlit overrides precede the captured radiance', () => {
  const scene = sceneFixture();
  const material = createPbrMaterial();
  configureLinearMaterials(scene)(material);
  for (const unlit of [false, true]) {
    for (const alphaBlend of [false, true]) {
      const template = createPbrTemplate({
        _hasIbl: true, _hasAlphaBlend: alphaBlend, _hasTonemap: true,
        _toneMappingCall: scene.imageProcessing.toneMapping.callWGSL,
      });
      const fragments = [createIblFragment(false),
        buildPluginFragment(material.plugins, 1, false)._fragment];
      if (unlit) fragments.push(createUnlitFragment(true));
      const source = composeShader(template, fragments)._fragmentWGSL;
      assertLinearOutput(source);
      assert.ok(source.indexOf('color=finalIrradiance+') < source.indexOf('ashenLinearRadiance = color;'));
      if (unlit) assert.ok(source.indexOf('color=baseColor*material.unlitColor;') <
        source.indexOf('ashenLinearRadiance = color;'));
    }
  }
});

test('late garments and material replacements attach before the frame build boundary', () => {
  const scene = sceneFixture();
  const attach = configureLinearMaterials(scene);
  const garment = createPbrMaterial();
  garment._renderFeatures = _computePbrMaterialFeatures(garment);
  const mesh = { material: garment };
  scene.meshes.push(mesh);
  // Real scene._update runs onBeforeRender callbacks before its swap queue.
  scene._update();
  assert.equal(garment._renderFeatures, undefined);
  assert.equal(garment.plugins.length, 1);
  assertLinearOutput(compiledSource(scene, garment));
  mesh.material = createPbrMaterial();
  scene._update();
  assertLinearOutput(compiledSource(scene, mesh.material));
  assert.equal(attach(), 0);
  // Explicit attach is the required boundary for manual registration/flushes.
  const extra = createPbrMaterial();
  scene.meshes.push({ material: extra });
  assert.equal(attach(), 1);
  assertLinearOutput(compiledSource(scene, extra));
});

test('StandardMaterial, custom shaders and other scenes are not assigned the PBR plugin', () => {
  const scene = sceneFixture();
  const standard = createStandardMaterial();
  const custom = { _buildGroup: Object.assign(() => {}, { _materialFamily: 'shader' }) };
  const otherScene = sceneFixture();
  const otherMaterial = createPbrMaterial();
  otherScene.meshes.push({ material: otherMaterial });
  scene.meshes.push({ material: standard }, { material: custom });
  const attach = configureLinearMaterials(scene);
  scene._update();
  assert.equal(attach(), 0);
  assert.equal(standard.plugins, undefined);
  assert.equal(custom.plugins, undefined);
  assert.equal(otherMaterial.plugins, undefined);
  assert.equal(otherScene.imageProcessing.toneMappingEnabled, false);
});
