import {
  AcesToneMapping,
  addToScene,
  captureScreenshot,
  createArcRotateCamera,
  createCsmDirectionalShadowGenerator,
  createDirectionalLight,
  createEngine,
  createGround,
  createHemisphericLight,
  createPbrMaterial,
  createPlane,
  createSceneContext,
  enableErrorDecoding,
  enableMorphTargetShadows,
  enableSkeletonShadows,
  isGpuTimingSupported,
  loadHdrEnvironment,
  loadTexture2D,
  setMaxLights,
  onBeforeRender,
  registerSceneWithShadowSupport,
  setGpuTimingEnabled,
  setShadowTaskCasterMeshes,
  startEngine,
} from "@babylonjs/lite";
import { createFixtureCharacter } from "../adapters/lite-fixture.js";
import { FrameMetrics } from "../runtime/frame-metrics.js";
import "./style.css";

enableErrorDecoding();

const ui = document.getElementById("lab-ui");
ui.innerHTML = `
<header>
  <span>MOONWELL / CHARACTER SYSTEM</span>
  <h1>Deformation laboratory</h1>
  <p>M0 + M1 · Diagnostic garments, not finished character art</p>
</header>
<aside>
  <label>Animation
    <select id="clip">
      <option>Idle_Loop</option>
      <option>Spell_Simple_Idle_Loop</option>
      <option>Walk_Loop</option>
      <option>Sprint_Loop</option>
      <option>Crouch_Idle_Loop</option>
      <option>Jump_Start</option>
      <option>Jump_Loop</option>
      <option>Jump_Land</option>
      <option>Spell_Simple_Shoot</option>
    </select>
  </label>
  <label>Outfit
    <select id="outfit">
      <option value="full">Tunic + trousers + sleeve</option>
      <option value="tunic">Tunic only</option>
      <option value="trousers">Trousers only</option>
      <option value="sleeve">Sleeve only</option>
      <option value="body">Body only</option>
    </select>
  </label>
  <label>Body fullness
    <input id="shape" type="range" min="-1" max="1" step=".05" value="0">
  </label>
  <div class="views">
    <button data-view="front">Front</button>
    <button data-view="side">Side</button>
    <button data-view="back">Back</button>
    <button data-view="three-quarter">¾</button>
    <button data-view="hands">Hands</button>
  </div>
  <button id="pause">Pause motion</button>
  <button id="benchmark">Record 10 seconds</button>
  <p id="status">Loading shared-rig fixtures…</p>
</aside>
<footer>
  <span>LEFT · Active outfit and shape</span>
  <span>RIGHT · Independent instance / copper outfit</span>
</footer>`;

const reportError = (error) => {
  const el = document.getElementById("error");
  el.hidden = false;
  el.textContent = error.stack || error.message;
  console.error(error);
};

const VIEWS = {
  front: { alpha: -Math.PI / 2, beta: 1.34, radius: 7.5, target: { x: 0, y: 0.92, z: 0 } },
  back: { alpha: Math.PI / 2, beta: 1.34, radius: 7.5, target: { x: 0, y: 0.92, z: 0 } },
  side: { alpha: 0, beta: 1.34, radius: 7.8, target: { x: 0, y: 0.92, z: 0 } },
  "three-quarter": { alpha: -Math.PI / 2 + 0.58, beta: 1.28, radius: 7.2, target: { x: 0, y: 0.9, z: 0 } },
  hands: { alpha: -Math.PI / 2 + 0.4, beta: 1.08, radius: 2.05, target: { x: -1.55, y: 1.02, z: 0.08 } },
};

const WALL_GRAY = [0.84, 0.82, 0.78, 1];
const KNIT_SCALE = 8;

/** Inward-facing cyc box. Default plane is XY facing -Z. Orbit cameras stay inside. */
function addCyclorama(engine, scene, material) {
  const y = 6.4;
  const h = 16;
  const w = 36;
  const walls = [
    { name: "Lab cyc +X", width: w, height: h, pos: [6.4, y, 0], rot: [0, Math.PI / 2, 0] },
    { name: "Lab cyc -X", width: w, height: h, pos: [-7.4, y, 0], rot: [0, -Math.PI / 2, 0] },
    { name: "Lab cyc +Z", width: w, height: h, pos: [0, y, 7.4], rot: [0, 0, 0] },
    { name: "Lab cyc -Z", width: w, height: h, pos: [0, y, -7.4], rot: [0, Math.PI, 0] },
    { name: "Lab cyc ceiling", width: w, height: w, pos: [0, 11.2, 0], rot: [-Math.PI / 2, 0, 0] },
  ];
  for (const spec of walls) {
    const mesh = createPlane(engine, { width: spec.width, height: spec.height });
    mesh.name = spec.name;
    mesh.material = material;
    mesh.rotation.set(spec.rot[0], spec.rot[1], spec.rot[2]);
    mesh.position.set(spec.pos[0], spec.pos[1], spec.pos[2]);
    addToScene(scene, mesh);
  }
}

function applyView(camera, name) {
  const view = VIEWS[name];
  if (!view) {
    throw new Error("Unknown view");
  }
  camera.alpha = view.alpha;
  camera.beta = view.beta;
  camera.radius = view.radius;
  if (camera.target) {
    camera.target.x = view.target.x;
    camera.target.y = view.target.y;
    camera.target.z = view.target.z;
  }
}

async function tryLabTexture(engine, url, opts = {}) {
  try {
    const tex = await loadTexture2D(engine, url, { mipMaps: true, srgb: opts.srgb ?? true, invertY: true });
    if (opts.uScale && tex) {
      tex.uScale = opts.uScale;
      tex.vScale = opts.vScale ?? opts.uScale;
    }
    return tex;
  } catch {
    return null;
  }
}

function dressCharacter(character, maps, palette = "indigo") {
  const copper = palette === "copper";
  const copperAlbedo = maps.copper || maps.trousers;
  for (const mesh of character.getMeshes()) {
    if (mesh.name === "Alpha_Surface") {
      mesh.material = createPbrMaterial({
        baseColorFactor: maps.skin ? [1, 0.96, 0.9, 1] : [0.78, 0.68, 0.54, 1],
        roughnessFactor: 0.68,
        metallicFactor: 0,
        baseColorTexture: maps.skin || undefined,
        normalTexture: maps.skinN || undefined,
        normalTextureScale: 0.4,
      });
    } else if (mesh.name === "Fixture_tunic" || mesh.name === "Fixture_sleeve") {
      mesh.material = createPbrMaterial({
        baseColorFactor: [1, 1, 1, 1],
        roughnessFactor: 0.8,
        metallicFactor: 0.02,
        baseColorTexture: (copper ? copperAlbedo : maps.tunic) || undefined,
        normalTexture: maps.fabricN || undefined,
        normalTextureScale: 0.7,
        doubleSided: false,
      });
    } else if (mesh.name === "Fixture_trousers") {
      mesh.material = createPbrMaterial({
        baseColorFactor: [1, 1, 1, 1],
        roughnessFactor: 0.86,
        metallicFactor: 0,
        baseColorTexture: (copper ? copperAlbedo : maps.trousers) || undefined,
        normalTexture: maps.fabricN || undefined,
        normalTextureScale: 0.7,
        doubleSided: false,
      });
    }
  }
}

async function main() {
  const canvas = document.getElementById("renderCanvas");
  const engine = await createEngine(canvas, { msaaSamples: 4, maxDevicePixelRatio: 1 });
  const scene = createSceneContext(engine);
  scene.clearColor = { r: WALL_GRAY[0], g: WALL_GRAY[1], b: WALL_GRAY[2], a: 1 };
  setMaxLights(6);

  const camera = createArcRotateCamera(-Math.PI / 2, 1.34, 7.5, { x: 0, y: 0.92, z: 0 });
  camera.fov = 0.52;
  camera.nearPlane = 0.05;
  camera.farPlane = 80;
  scene.camera = camera;

  const sun = createDirectionalLight([0.5, -0.55, -0.45], 1.55);
  sun.diffuse = [1, 0.98, 0.95];
  addToScene(scene, sun);
  const hemi = createHemisphericLight([0, 1, 0], 0.5);
  hemi.diffuseColor = [0.96, 0.94, 0.9];
  hemi.groundColor = [0.28, 0.26, 0.24];
  addToScene(scene, hemi);

  const floorAlbedo = await tryLabTexture(engine, "/characters/lab/floor-albedo.png", { srgb: true });
  const floorNormal = await tryLabTexture(engine, "/characters/lab/floor-normal.png", { srgb: false });
  const knitOpts = { srgb: true, uScale: KNIT_SCALE, vScale: KNIT_SCALE };
  const maps = {
    tunic:
      (await tryLabTexture(engine, "/characters/lab/knit-indigo.png", knitOpts)) ||
      (await tryLabTexture(engine, "/characters/lab/tunic-albedo.png", knitOpts)),
    trousers: await tryLabTexture(engine, "/characters/lab/trousers-albedo.png", knitOpts),
    copper: await tryLabTexture(engine, "/characters/lab/knit-copper.png", knitOpts),
    fabricN:
      (await tryLabTexture(engine, "/characters/lab/knit-normal.png", { srgb: false, uScale: KNIT_SCALE, vScale: KNIT_SCALE })) ||
      (await tryLabTexture(engine, "/characters/lab/fabric-normal.png", { srgb: false, uScale: KNIT_SCALE, vScale: KNIT_SCALE })),
    skin: await tryLabTexture(engine, "/characters/lab/skin-albedo.png", { srgb: true }),
    skinN: await tryLabTexture(engine, "/characters/lab/skin-normal.png", { srgb: false }),
  };
  const floor = createGround(engine, { width: 18, height: 18, subdivisions: 4, uvScale: [6, 6] });
  floor.position.y = 0;
  floor.name = "Lab floor";
  floor.material = createPbrMaterial({
    baseColorFactor: floorAlbedo ? [0.9, 0.91, 0.93, 1] : [0.22, 0.23, 0.25, 1],
    roughnessFactor: 0.44,
    metallicFactor: 0,
    baseColorTexture: floorAlbedo || undefined,
    normalTexture: floorNormal || undefined,
    normalTextureScale: 1.1,
  });
  floor.receiveShadows = true;
  addToScene(scene, floor);

  await loadHdrEnvironment(scene, "/ashen-reach/reach-sky.hdr", {
    faceSize: 128,
    useCubemapSkybox: false,
    skipSkybox: true,
    skipGround: true,
  });
  scene.imageProcessing.toneMappingEnabled = true;
  scene.imageProcessing.toneMapping = AcesToneMapping;
  scene.imageProcessing.exposure = 1.02;
  scene.imageProcessing.contrast = 1.04;
  const wallMat = createPbrMaterial({
    baseColorFactor: WALL_GRAY,
    roughnessFactor: 0.92,
    metallicFactor: 0,
    doubleSided: true,
  });
  addCyclorama(engine, scene, wallMat);

  const response = await fetch("/characters/base.glb");
  if (!response.ok) {
    throw new Error("Character source failed to load");
  }
  const source = await response.arrayBuffer();

  const left = await createFixtureCharacter({ engine, scene, source, x: -1.55 });
  const right = await createFixtureCharacter({ engine, scene, source, x: 1.55, palette: "copper" });
  dressCharacter(left, maps, "indigo");
  dressCharacter(right, maps, "copper");
  right.setPose("Walk_Loop", 0.45);
  right.setShape(0.15);

  const shadow = createCsmDirectionalShadowGenerator(engine, sun, {
    mapSize: 2048,
    numCascades: 2,
    shadowMaxZ: 24,
    stabilizeCascades: true,
    worldSpaceBias: 0.004,
    darkness: 0.62,
    lambda: 0.7,
  });
  sun.shadowGenerator = shadow;
  enableSkeletonShadows(shadow);
  enableMorphTargetShadows(shadow);
  const refreshCasters = () => setShadowTaskCasterMeshes(shadow, [...left.getMeshes(), ...right.getMeshes()]);
  refreshCasters();

  const metrics = new FrameMetrics();
  let lastUi = 0;
  let elapsed = 0;
  let paused = false;
  const status = document.getElementById("status");

  const lab = {
    ready: false,
    engine,
    scene,
    camera,
    left,
    right,
    metrics,
    view(name) {
      applyView(camera, name);
    },
    async outfit(value) {
      try {
        return await left.setOutfit(value);
      } finally {
        dressCharacter(left, maps, "indigo");
        refreshCasters();
        const sel = document.getElementById("outfit");
        if (sel) sel.value = value;
      }
    },
    async capture() {
      return captureScreenshot(engine);
    },
    diagnostics() {
      return {
        left: left.diagnostics(),
        right: right.diagnostics(),
        sceneMeshes: scene.meshes.length,
        sceneAnimations: scene.animationGroups?.length ?? 0,
        metrics: metrics.summary(),
        resolution: [canvas.width, canvas.height],
        gpuTimingSupported: isGpuTimingSupported(engine),
      };
    },
  };
  globalThis.CHARACTER_LAB = lab;
  lab.view("front");

  onBeforeRender(scene, (ms) => {
    elapsed += ms;
    left.update(ms / 1000);
    right.update(ms / 1000);
    metrics.record(ms, engine.drawCallCount, engine.gpuFrameTimeMs);
    if (elapsed - lastUi > 500) {
      lastUi = elapsed;
      const fps = metrics.fps ? metrics.fps.toFixed(0) : "—";
      status.textContent = `${fps} FPS · ${metrics.drawCalls} draws\nOne pose per character · Body + skinned garments + rigid staff`;
    }
  });

  document.getElementById("clip").onchange = (e) => left.setPose(e.target.value, 0, paused);
  document.getElementById("outfit").onchange = (e) => lab.outfit(e.target.value).catch(reportError);
  document.getElementById("shape").oninput = (e) => left.setShape(Number(e.target.value));
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.onclick = () => lab.view(button.dataset.view);
  });
  document.getElementById("pause").onclick = (e) => {
    paused = !paused;
    left.setPaused(paused);
    right.setPaused(paused);
    e.target.textContent = paused ? "Resume motion" : "Pause motion";
  };
  document.getElementById("benchmark").onclick = async (e) => {
    e.target.disabled = true;
    metrics.start({
      resolution: [canvas.width, canvas.height],
      dpr: devicePixelRatio,
      scene: "character-lab",
      visibility: document.visibilityState,
    });
    await new Promise((resolve) => setTimeout(resolve, 10000));
    lab.lastBenchmark = metrics.stop();
    e.target.disabled = false;
    console.info("Character benchmark", lab.lastBenchmark);
    status.textContent = `Benchmark ${lab.lastBenchmark.fps?.toFixed?.(1)} FPS · p95 ${lab.lastBenchmark.p95Ms?.toFixed?.(2)} ms`;
  };

  setGpuTimingEnabled(engine, true);
  await registerSceneWithShadowSupport(scene);
  await startEngine(engine);
  lab.ready = true;
}

main().catch(reportError);
