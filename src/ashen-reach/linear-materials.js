import {
  enableMaterialPlugins, isPbrMaterial, onBeforeRender, rebuildMaterial,
} from '@babylonjs/lite';

const configuredScenes = new WeakMap();
const NAME = 'ashen-linear-output-v1';
const fragmentCode = Object.freeze({
  CUSTOM_FRAGMENT_BEFORE_FRAGCOLOR: 'color = ashenLinearRadiance;',
});
const plugin = Object.freeze({
  name: NAME,
  getCustomCode(stage) { return stage === 'fragment' ? fragmentCode : null; },
});
const operator = Object.freeze({
  id: NAME,
  helpersWGSL: '',
  // The PBR template calls this after lighting/unlit/fog, before its mandatory
  // gamma, clamp and contrast. Restore below, retaining native alpha handling.
  // Exposure belongs exclusively to our final display pass.
  // Declare here, not in the plugin: an async native group build can see a
  // newly added material before the frame callback attaches its plugin.
  // Such a shader must still compile; synchronous attach before scene entry
  // remains necessary to guarantee its FIRST visible draw is linear.
  callWGSL: 'var ashenLinearRadiance = color;',
});

/**
 * Synchronous first-build boundary for shared loaders/factories. Call before
 * addToScene or assigning mesh.material. Unconfigured preview/lab scenes are
 * untouched; this never enables plugins or installs callbacks on its own.
 * Returns 1 when attached, otherwise 0 (including absent/non-PBR materials).
 */
export function prepareLinearMaterial(scene, material) {
  if (!material) return 0;
  return configuredScenes.get(scene)?.(material) ?? 0;
}

/**
 * Configure a fresh scene BEFORE its first material build.
 *
 * Lite 1.28 has no public before-build observer. Call the returned attach()
 * immediately before registerScene[WithShadowSupport] or manually draining
 * deferred builders. The onBeforeRender scan covers streamed meshes and
 * material replacements: Lite drains its material-swap queue AFTER these
 * callbacks. This scan is a fallback, not a first-draw guarantee: an already
 * running asynchronous group build can discover meshes between callbacks.
 * Call attach(material) BEFORE addToScene or mesh.material assignment for
 * streamed materials, NPC tint/garment factories and race replacements.
 * Code that starts a build directly must call attach() first.
 *
 * StandardMaterial has no native display conversion, and billboard particles
 * emit sampled color * tint directly; neither receives this PBR-only plugin.
 * No builder, mesh-array or global prototype is replaced.
 */
export function configureLinearMaterials(scene) {
  const previous = configuredScenes.get(scene);
  if (previous) return previous;

  enableMaterialPlugins(scene);
  scene.imageProcessing.toneMappingEnabled = true;
  scene.imageProcessing.toneMapping = operator;
  scene.imageProcessing.exposure = 1;
  scene.imageProcessing.contrast = 1;

  function attach(material) {
    const materials = material
      ? [material]
      : new Set(scene.meshes.map(mesh => mesh.material).filter(Boolean));
    let changed = 0;
    for (const mat of materials) {
      if (!isPbrMaterial(mat) || mat.plugins?.includes(plugin)) continue;
      // Preserve other plugins and avoid mutating a shared/frozen array.
      mat.plugins = [...(mat.plugins ?? []), plugin];
      // Public invalidation also handles a cached feature signature, shared
      // materials and already-built meshes. Fresh deferred groups only have
      // their signature invalidated; Lite's normal build remains responsible.
      rebuildMaterial(scene, mat);
      changed++;
    }
    return changed;
  }

  configuredScenes.set(scene, attach);
  onBeforeRender(scene, () => { attach(); });
  attach();
  return attach;
}
