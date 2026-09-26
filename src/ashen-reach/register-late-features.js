/** Build feature renderables added after the scene's initial registration. */
export async function registerLateFeatures(scene, prepareMaterials, unregisterScene, registerSceneWithShadowSupport) {
  // Lite drains deferred feature builders when a scene is registered again.
  // https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/docs/lite/architecture/01-scene.md
  unregisterScene(scene);
  prepareMaterials();
  await registerSceneWithShadowSupport(scene);
}
