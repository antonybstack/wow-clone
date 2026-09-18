/**
 * M2g studio environment: seamless cyc backdrop, key/fill/rim lighting, and
 * the post-process chain (screen-space contact shadows, SMAA) for the
 * body-preview page. Public @babylonjs/lite exports only.
 */
import {
  addToScene,
  addTask,
  addTaskAfter,
  createCsmDirectionalShadowGenerator,
  createDirectionalLight,
  createHemisphericLight,
  createPbrMaterial,
  createRenderTarget,
  createRenderTask,
  createCopyToTextureTask,
  createRibbon,
  createScreenSpaceContactShadowsPostProcessTask,
  createSmaaPostProcessTask,
  enableMorphTargetShadows,
  enableSkeletonShadows,
  loadHdrEnvironment,
  setEnvironmentBlur,
  setEnvironmentRotation,
  setShadowTaskCasterMeshes,
} from "@babylonjs/lite";

/** Poly Haven "Studio Small 08" - CC0, by Sergej Majboroda. Soft octabox/softbox studio IBL. */
export const STUDIO_HDR_URL = "/env/studio_small_08_1k.hdr";
export const STUDIO_HDR_CREDIT = {
  name: "Studio Small 08",
  url: "https://polyhaven.com/a/studio_small_08",
  author: "Sergej Majboroda",
  license: "CC0 1.0 (Poly Haven)",
  resolution: "1k",
};

/**
 * Direct-light vs IBL/hemi ratios. Key travel is 35° camera-left of the
 * front camera (camera at −Z looking +Z). Elevation is high so the CSM
 * umbra dies within about a foot-length of each heel (r3 was 25° → sundial).
 * Fill is 1:3 of key. IBL on the body is kept well below the key so pecs /
 * ribs / inner thigh / neck read darker than the key plane.
 */
export const KEY_INTENSITY = 3.05;
export const FILL_INTENSITY = KEY_INTENSITY / 3;
export const RIM_INTENSITY = 1.25;
export const BOUNCE_INTENSITY = 0.14;
export const BODY_ENV_INTENSITY = 0.11;
export const CYC_ENV_INTENSITY = 0.38;
/** Key warmth vs D65, kelvin (judge: ~400 K). */
export const KEY_WARMTH_KELVIN = 400;
/** Degrees camera-left of the front camera's look axis. */
export const KEY_AZIMUTH_DEG = 35;
/** Degrees above the horizon. 25° threw a full-body sundial. */
export const KEY_ELEVATION_DEG = 78;

/**
 * World-space direction the key travels. Azimuth 0 = from −Z (camera),
 * positive = camera-left (−X). Elevation is above the XZ plane.
 */
export function directionalFromAzimuthElevation(azimuthDeg, elevationDeg) {
  const az = (azimuthDeg * Math.PI) / 180;
  const el = (elevationDeg * Math.PI) / 180;
  const cosEl = Math.cos(el);
  const fromX = -Math.sin(az) * cosEl;
  const fromY = Math.sin(el);
  const fromZ = -Math.cos(az) * cosEl;
  return [-fromX, -fromY, -fromZ];
}

export const KEY_DIRECTION = directionalFromAzimuthElevation(KEY_AZIMUTH_DEG, KEY_ELEVATION_DEG);

function srgbToLinear(c) {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}
function hexToLinear(hex, scale = 1) {
  const n = parseInt(hex.replace("#", ""), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  return [srgbToLinear(r) * scale, srgbToLinear(g) * scale, srgbToLinear(b) * scale, 1];
}

// Wall: warmer beige, less mustard/green than r3 #D6C4A2. Floor 15% darker + cooler.
const WALL_COLOR = hexToLinear("#E6D0BE");
const FLOOR_COLOR = [WALL_COLOR[0] * 0.74, WALL_COLOR[1] * 0.75, WALL_COLOR[2] * 0.86, 1];

// Cyc: large flat floor so three-quarter never sees a finite floor-edge
// diagonal. Camera radius is ~5.1 m; 20 m disc keeps the cove outside the
// 22° frustum at every body azimuth.
const CYC_FLOOR_RADIUS = 20;
const COVE_RADIUS = 2.4;
const WALL_RADIUS = CYC_FLOOR_RADIUS + COVE_RADIUS;
const WALL_TOP = 18;
const RADIAL_SEGMENTS = 64;
const COVE_STEPS = 12;

function revolve(engine, profile, radialSegments) {
  const paths = [];
  for (let i = 0; i <= radialSegments; i++) {
    const theta = (i / radialSegments) * Math.PI * 2;
    const cos = Math.cos(theta);
    const sin = Math.sin(theta);
    paths.push(profile.map(([r, y]) => ({ x: r * cos, y, z: r * sin })));
  }
  return createRibbon(engine, { pathArray: paths, closePath: false, closeArray: false });
}

function buildCycFloor(engine) {
  const mesh = revolve(engine, [[0, 0], [CYC_FLOOR_RADIUS, 0]], RADIAL_SEGMENTS);
  mesh.name = "Cyc floor";
  mesh.material = createPbrMaterial({
    baseColorFactor: FLOOR_COLOR,
    roughnessFactor: 0.74,
    metallicFactor: 0,
    environmentIntensity: CYC_ENV_INTENSITY,
    doubleSided: true,
  });
  mesh.receiveShadows = true;
  return mesh;
}

function buildCycWall(engine) {
  const profile = [[CYC_FLOOR_RADIUS, 0]];
  for (let i = 1; i <= COVE_STEPS; i++) {
    const t = i / COVE_STEPS;
    const r = CYC_FLOOR_RADIUS + COVE_RADIUS * Math.sin((t * Math.PI) / 2);
    const y = COVE_RADIUS * (1 - Math.cos((t * Math.PI) / 2));
    profile.push([r, y]);
  }
  profile.push([WALL_RADIUS, WALL_TOP]);
  const mesh = revolve(engine, profile, RADIAL_SEGMENTS);
  mesh.name = "Cyc cove+wall";
  mesh.material = createPbrMaterial({
    baseColorFactor: WALL_COLOR,
    roughnessFactor: 0.88,
    metallicFactor: 0,
    environmentIntensity: CYC_ENV_INTENSITY,
    doubleSided: true,
  });
  mesh.receiveShadows = true;
  return mesh;
}

/** Builds the cyc backdrop + loads the studio IBL. Call before creating the body actor. */
export async function buildStudioEnvironment(engine, scene) {
  addToScene(scene, buildCycFloor(engine));
  addToScene(scene, buildCycWall(engine));

  let hdrLoaded = false;
  let hdrError = null;
  try {
    await loadHdrEnvironment(scene, STUDIO_HDR_URL, {
      faceSize: 128,
      useCubemapSkybox: false,
      skipSkybox: true,
      skipGround: true,
    });
    setEnvironmentBlur(scene, 0.55);
    setEnvironmentRotation(scene, 0.7);
    hdrLoaded = true;
  } catch (error) {
    hdrError = error.message || String(error);
  }
  return { hdrLoaded, hdrError };
}

/** Drop IBL on authored-body materials so the key/fill ratio can read on clay. */
export function applyBodyEnvironmentIntensity(meshes, intensity = BODY_ENV_INTENSITY) {
  for (const mesh of meshes ?? []) {
    const mat = mesh.material;
    if (mat && "environmentIntensity" in mat) {
      mat.environmentIntensity = intensity;
    }
  }
}

/** Key (shadow-casting) + fill + rim + floor-bounce lighting. */
export function buildLighting(engine, scene) {
  // Front camera sits at −Z looking +Z. Camera-left is −X. Key travel is from
  // (−X, +Y, −Z) toward the figure so the contact/CSM shadow falls slightly
  // behind the heels (+Z), not a long camera-right sundial.
  const key = createDirectionalLight(KEY_DIRECTION, KEY_INTENSITY);
  key.diffuse = [1, 0.89, 0.74];
  addToScene(scene, key);

  const fill = createDirectionalLight([-0.62, -0.28, 0.48], FILL_INTENSITY);
  fill.diffuse = [0.94, 0.96, 1];
  addToScene(scene, fill);

  const rim = createDirectionalLight([-0.06, -0.48, -0.88], RIM_INTENSITY);
  rim.diffuse = [1, 0.97, 0.9];
  addToScene(scene, rim);

  const bounce = createHemisphericLight([0, 1, 0], BOUNCE_INTENSITY);
  bounce.diffuseColor = [0.96, 0.9, 0.8];
  bounce.groundColor = [0.28, 0.26, 0.24];
  addToScene(scene, bounce);

  const shadow = createCsmDirectionalShadowGenerator(engine, key, {
    mapSize: 2048,
    numCascades: 2,
    shadowMaxZ: 16,
    stabilizeCascades: true,
    worldSpaceBias: 0.0014,
    darkness: 0.62,
    lambda: 0.72,
  });
  key.shadowGenerator = shadow;
  enableSkeletonShadows(shadow);
  enableMorphTargetShadows(shadow);

  return { key, fill, rim, bounce, shadow };
}

/**
 * Custom frame-graph pipeline: scene -> screen-space contact shadows ->
 * SMAA -> swapchain. SSGI stays out (Lite additive-only, ~50 FPS).
 */
export function buildPostPipeline(engine, scene, camera, key) {
  const status = { contactShadows: false, smaa: false, notes: [] };

  const sceneRT = createRenderTarget({
    lbl: "studio-scene",
    format: engine.format,
    dFormat: "depth24plus-stencil8",
    samples: 1,
    size: engine,
  });
  const sceneTask = createRenderTask({ name: "scene", rt: sceneRT }, engine, scene);
  addTask(scene, sceneTask);

  let source = sceneRT;
  let lastTask = sceneTask;

  try {
    const csTarget = createRenderTarget({ lbl: "studio-contact-shadow", format: engine.format, samples: 1, size: engine });
    const csTask = createScreenSpaceContactShadowsPostProcessTask(
      {
        name: "studio-contact-shadows",
        sourceTexture: source,
        depthTexture: sceneRT,
        targetTexture: csTarget,
        camera,
        lightDirection: key.direction,
        // Tight heel patch: short march, small spatial blur, high weight.
        // High normalBias so face/clavicle same-surface hits do not stain.
        intensity: 1.7,
        tint: [0.05, 0.055, 0.06],
        maxDistance: 0.14,
        thickness: 0.07,
        stepCount: 18,
        resolutionScale: 0.75,
        bias: 0.006,
        normalBias: 0.18,
        spatialRadius: 0.18,
      },
      engine,
      scene,
    );
    addTaskAfter(scene, csTask, lastTask);
    source = csTarget;
    lastTask = csTask;
    status.contactShadows = true;
  } catch (error) {
    status.notes.push(`screen-space contact shadows disabled: ${error.message || error}`);
  }

  try {
    const smaaTask = createSmaaPostProcessTask(
      {
        name: "studio-smaa",
        sourceTexture: source,
        targetTexture: engine.scRT,
        cornerDetection: true,
        diagonalDetection: true,
      },
      engine,
      scene,
    );
    addTaskAfter(scene, smaaTask, lastTask);
    status.smaa = true;
  } catch (error) {
    status.notes.push(`SMAA disabled: ${error.message || error}`);
    const presentTask = createCopyToTextureTask({ name: "studio-present", sourceTexture: source, targetTexture: engine.scRT }, engine, scene);
    addTaskAfter(scene, presentTask, lastTask);
  }

  return { status, sceneTask, refreshCasters: (meshes) => setShadowTaskCasterMeshes(key.shadowGenerator, meshes) };
}
