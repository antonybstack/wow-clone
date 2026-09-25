import {
  enableMaterialPlugins, isPbrMaterial, markMaterialUboDirty,
  onBeforeRender, rebuildMaterial, setShadowCasterMaterial,
} from '@babylonjs/lite';
import { LOCAL_LIGHT_UNIFORMS, LOCAL_LIGHT_WGSL } from './local-light-shared.js';
import { LOCAL_SPECULAR_WGSL } from './local-specular.js';

const configuredScenes = new WeakMap();
const casterAliases = new WeakMap();
const NAME = 'ashen-local-light-v1';
// Native-only scalar: do not extend the shared 256-byte surface/fog light block.
const nativeUniforms = [...LOCAL_LIGHT_UNIFORMS, { name: 'localSpecularStrength', type: 'f32' }];
const samplers = Object.freeze([0, 1].map(index => Object.freeze({
  texture: `localShadow${index}`,
  sampler: `localShadow${index}Sampler`,
  // Lite 1.28's plugin declarations omit these types, but its runtime bridge
  // forwards them and shader-composer derives the correct depth/comparison BGL.
  textureType: 'texture_depth_2d',
  samplerType: 'sampler_comparison',
})));
const fragmentCode = Object.freeze({
  CUSTOM_FRAGMENT_DEFINITIONS: (LOCAL_LIGHT_WGSL + LOCAL_SPECULAR_WGSL).replaceAll('shaderUniforms.', 'material.'),
  CUSTOM_FRAGMENT_MAIN_BEGIN: 'var ashenLocalCompositionPass = 0u;',
  // Installed Lite 1.28 maps this hook to BOTH AI and NI. The IBL fragment
  // rebuilds color at AI. Add exactly once at NI, after that reconstruction
  // and before fog, the V13 linear capture, and native display conversion.
  // N/V, texture-adjusted roughness and colorF0 come from pbr-template.js.
  // Its surfaceAlbedo already contains (1-dielectricF0)*(1-metallic); preserve
  // the V15 diffuse baseline and its zero diffuse response for pure metals.
  CUSTOM_FRAGMENT_BEFORE_FINALCOLORCOMPOSITION: `
    ashenLocalCompositionPass += 1u;
    if (ashenLocalCompositionPass == 2u) {
      color += surfaceAlbedo * localIrradiance(input.worldPos, N);
      if (material.localSpecularStrength > 0.0) {
        color += material.localSpecularStrength * localSpecular(input.worldPos, N, V, roughness, colorF0);
      }
    }
  `,
});

/**
 * Two fixed receiver bindings owned by the controller. Changing texture handles
 * requires rebuilding attached materials; updating texture contents does not.
 * The controller must provide valid depth textures even for inactive slots.
 *
 * configureLocalLightMaterials also installs a plugin-free native caster alias.
 * Callers using this plugin alone must provide the equivalent caster override.
 */
export function createLocalLightPlugin(controller) {
  if (controller.slots?.length !== 2 || controller.slots.some(slot => !slot.texture)) {
    throw new Error('Local lighting requires two initialized shadow texture slots');
  }
  return {
    name: NAME,
    dynamic: true,
    getCustomCode(stage) { return stage === 'fragment' ? fragmentCode : null; },
    getUniforms() { return { ubo: nativeUniforms }; },
    getSamplers() { return samplers; },
    writeUbo(data, offsets) {
      for (const { name } of LOCAL_LIGHT_UNIFORMS) {
        const offset = offsets.get(name);
        if (offset !== undefined) data.set(controller.values[name], offset / 4);
      }
      const strengthOffset = offsets.get('localSpecularStrength');
      if (strengthOffset !== undefined) data[strengthOffset / 4] = +(controller.state.specular ?? true);
    },
    bindTextures(out) {
      for (const slot of controller.slots) out.push({ texture: slot.texture });
    },
    getActiveTextures(out) {
      for (const slot of controller.slots) out.push(slot.texture);
    },
  };
}

/**
 * Lite's no-color views inherit plugin bindings even without a lighting body.
 * Keep the native PBR family and source state, but give shadow rendering its own
 * empty plugin list/index so no local map is sampled while it is an attachment.
 * The original mesh still supplies its skeleton, morphs and vertex attributes.
 *
 * This is deliberately a prototype alias, not createMaterialView(source, ...):
 * no-color's createMaterialView flattens official views back to their source,
 * which would discard the plugin exclusion. Mask source for the same reason.
 * The terminal caster pointer MUST be owned here, or it would inherit the
 * original -> alias pointer after setShadowCasterMaterial and become a cycle.
 */
function prepareCasterMaterial(material) {
  const previous = casterAliases.get(material);
  if (material._shadowCasterMaterial) {
    // Preserve explicit world/deformation/alpha caster overrides. Our own alias
    // already inherits live material state and needs no per-frame replacement.
    return;
  }
  const alias = previous ?? Object.create(material, {
    source: { value: undefined },
    plugins: { value: Object.freeze([]) },
    _pi: { value: 0, writable: true },
    _shadowCasterMaterial: { value: undefined },
  });
  casterAliases.set(material, alias);
  setShadowCasterMaterial(material, alias);
}

/** Call at the existing prepareLinearMaterial boundary before scene entry. */
export function prepareLocalLightMaterial(scene, material) {
  if (!material) return 0;
  return configuredScenes.get(scene)?.attach(material) ?? 0;
}

/**
 * Configure before first material build. The synchronous prepare entry covers
 * streamed equipment and material replacements; the frame scan is a fallback.
 * Values are read when native PBR uploads its material UBO, so controller tasks
 * must publish current matrices/parameters before the scene color task executes.
 */
export function configureLocalLightMaterials(scene, controller) {
  const previous = configuredScenes.get(scene);
  if (previous) {
    if (previous.controller !== controller) {
      throw new Error('Local lighting is already configured with another controller');
    }
    return previous.attach;
  }
  const plugin = createLocalLightPlugin(controller);
  enableMaterialPlugins(scene);
  function attach(material) {
    const materials = material
      ? [material]
      : new Set(scene.meshes.map(mesh => mesh.material).filter(Boolean));
    let changed = 0;
    for (const mat of materials) {
      if (!isPbrMaterial(mat)) continue;
      if (!mat.plugins?.includes(plugin)) {
        mat.plugins = [...(mat.plugins ?? []), plugin];
        prepareCasterMaterial(mat);
        rebuildMaterial(scene, mat);
        changed++;
      } else {
        prepareCasterMaterial(mat);
      }
      // dynamic:true refreshes Standard plugins only in 1.28. PBR's writeUbo
      // runs when the material version changes, including during cached draws.
      markMaterialUboDirty(mat);
    }
    return changed;
  }
  configuredScenes.set(scene, { controller, attach });
  onBeforeRender(scene, () => { attach(); });
  attach();
  return attach;
}
