import {
  addToScene,
  attachControl,
  captureScreenshot,
  createArcRotateCamera,
  createEngine,
  createSceneContext,
  enableErrorDecoding,
  isGpuTimingSupported,
  AcesToneMapping,
  onBeforeRender,
  rebuildScenePbrPipelines,
  registerSceneWithShadowSupport,
  setGpuTimingEnabled,
  setMaxLights,
  startEngine,
} from "@babylonjs/lite";
import { createAuthoredBody } from "../adapters/authored-body.js";
import { FrameMetrics } from "../runtime/frame-metrics.js";
import { computeViews, resolveHandTarget, HANDS_RADIUS, VFOV_DEGREES, VFOV_RADIANS } from "./cameras.js";
import { measureGroundedSole } from "./sole.js";
import {
  BODY_ENV_INTENSITY,
  BOUNCE_INTENSITY,
  CYC_ENV_INTENSITY,
  FILL_INTENSITY,
  KEY_AZIMUTH_DEG,
  KEY_DIRECTION,
  KEY_ELEVATION_DEG,
  KEY_INTENSITY,
  KEY_WARMTH_KELVIN,
  RIM_INTENSITY,
  STUDIO_HDR_CREDIT,
  applyBodyEnvironmentIntensity,
  buildLighting,
  buildPostPipeline,
  buildStudioEnvironment,
} from "./studio.js";
import "./style.css";

enableErrorDecoding();

const HUMAN_SOURCE = "/characters/bodies/human-v1.glb";
const HUMAN_ANIMATED = "/characters/bodies/human-animated-v1.glb";
const ORC_ANIMATED = "/characters/bodies/orc-animated-v1.glb";
const UNDEAD_ANIMATED = "/characters/bodies/undead-animated-v1.glb";
const ANIMATED_CANDIDATES = [
  { id: "human", url: HUMAN_ANIMATED, label: "Human animated v1" },
  { id: "orc", url: ORC_ANIMATED, label: "Orc animated v1" },
  { id: "undead", url: UNDEAD_ANIMATED, label: "Undead animated v1" },
];
const VIEW_NAMES = ["front", "back", "side", "three-quarter", "face", "hands", "feet"];
/** Chest/abdomen sample height for skin-luminance measurement, as a fraction of body height. */
const SKIN_SAMPLE_HEIGHT_FRACTION = 0.62;
const SKIN_SAMPLE_HALF_PX = 18;

const ui = document.getElementById("preview-ui");
ui.innerHTML = `
<header>
  <span>MOONWELL / CHARACTER SYSTEM</span>
  <h1>Authored body preview</h1>
  <p>M2 · Human / Orc / Undead animated candidates + Human v1 source. Not Mixamo lab. Not production-approved.</p>
</header>
<aside>
  <label>Asset
    <select id="asset">
      <option value="${HUMAN_SOURCE}">Human v1 source</option>
      ${ANIMATED_CANDIDATES.map((c) => `<option value="${c.url}" disabled>${c.label} (checking…)</option>`).join("")}
    </select>
  </label>
  <p id="asset-note"></p>
  <label>Clip
    <select id="clip"></select>
  </label>
  <label>Scrub
    <input id="scrub" type="range" min="0" max="1" step="0.001" value="0" disabled>
  </label>
  <div class="views">
    <button data-view="front">Front</button>
    <button data-view="side">Side</button>
    <button data-view="back">Back</button>
    <button data-view="three-quarter">¾</button>
    <button data-view="face">Face</button>
    <button data-view="hands">Hands</button>
    <button data-view="feet">Feet</button>
  </div>
  <button id="pause">Pause</button>
  <p id="status">Loading Human source…</p>
</aside>`;

const reportError = (error) => {
  const el = document.getElementById("error");
  el.hidden = false;
  el.textContent = error.stack || error.message;
  console.error(error);
};

function applyView(camera, view) {
  if (!view) {
    throw new Error("Unknown view");
  }
  camera.alpha = view.alpha;
  camera.beta = view.beta;
  camera.radius = view.radius;
  camera.inertialAlphaOffset = 0;
  camera.inertialBetaOffset = 0;
  camera.inertialRadiusOffset = 0;
  camera.inertialPanningX = 0;
  camera.inertialPanningY = 0;
  if (camera.target) {
    camera.target.x = view.target.x;
    camera.target.y = view.target.y;
    camera.target.z = view.target.z;
  }
}

function fillClipSelect(clips) {
  const sel = document.getElementById("clip");
  const scrub = document.getElementById("scrub");
  sel.innerHTML = "";
  if (!clips.length) {
    const opt = document.createElement("option");
    opt.textContent = "No exported clips";
    opt.disabled = true;
    opt.selected = true;
    sel.appendChild(opt);
    sel.disabled = true;
    scrub.disabled = true;
    return;
  }
  sel.disabled = false;
  for (const clip of clips) {
    const opt = document.createElement("option");
    opt.value = clip.name;
    opt.textContent = `${clip.name} (${clip.duration.toFixed(2)}s)`;
    sel.appendChild(opt);
  }
  scrub.disabled = false;
  scrub.max = String(clips[0].duration || 1);
}

async function probeUrl(url) {
  try {
    const head = await fetch(url, { method: "HEAD" });
    if (head.ok) return true;
    if (head.status === 405) {
      const get = await fetch(url, { method: "GET" });
      if (get.ok) return true;
    }
  } catch {
    /* unavailable */
  }
  return false;
}

async function probeAnimatedCandidates() {
  const note = document.getElementById("asset-note");
  const available = { human: false, orc: false, undead: false };
  const present = [];
  for (const candidate of ANIMATED_CANDIDATES) {
    const option = document.querySelector(`#asset option[value="${candidate.url}"]`);
    const ok = await probeUrl(candidate.url);
    available[candidate.id] = ok;
    if (!option) continue;
    option.disabled = !ok;
    option.textContent = ok ? candidate.label : `${candidate.label} (unavailable)`;
    if (ok) present.push(candidate.label.replace(" animated v1", ""));
  }
  note.textContent = present.length
    ? `Animated candidates: ${present.join(" / ")}.`
    : "Animated candidates unavailable.";
  return available;
}

async function main() {
  const canvas = document.getElementById("renderCanvas");
  const uiRoot = document.getElementById("preview-ui");
  const params = new URLSearchParams(location.search);
  const chromeHidden = params.has("m2f-audit") || params.has("m2-motion");
  if (chromeHidden) document.body.classList.add("audit");
  // msaaSamples: 1 - anti-aliasing is handled by the SMAA post-process task
  // (studio.js) so the main color target stays sampleable for the
  // screen-space contact-shadow pass, which requires samples === 1.
  const engine = await createEngine(canvas, { msaaSamples: 1, maxDevicePixelRatio: 1 });
  const scene = createSceneContext(engine, { defaultRenderTask: false });
  setMaxLights(6);

  const camera = createArcRotateCamera(-Math.PI / 2, Math.PI / 2, 3.2, { x: 0, y: 0.9, z: 0 });
  camera.fov = VFOV_RADIANS; // 22 deg vertical - long lens, judge round 1 flagged wide-angle distortion.
  camera.nearPlane = 0.05;
  camera.farPlane = 40;
  scene.camera = camera;
  attachControl(camera, canvas, scene);

  const { hdrLoaded, hdrError } = await buildStudioEnvironment(engine, scene);
  const lights = buildLighting(engine, scene);

  scene.imageProcessing.toneMappingEnabled = true;
  scene.imageProcessing.toneMapping = AcesToneMapping;
  // Tuned so front-view lit skin midtones measure ~55-65% luma; see
  // docs/handoffs/m2g-preview-studio-result.md for the measured value.
  scene.imageProcessing.exposure = 0.86;
  scene.imageProcessing.contrast = 1.1;

  const animatedCandidates = await probeAnimatedCandidates();
  const animatedAvailable = !!animatedCandidates.human;
  const actor = await createAuthoredBody({ engine, scene, url: HUMAN_SOURCE });
  applyBodyEnvironmentIntensity(actor.getMeshes());
  await rebuildScenePbrPipelines(scene);

  let currentViews = {};
  let handTarget = { resolved: false };
  function recomputeViews() {
    handTarget = resolveHandTarget(actor.extents, actor.getMeshes());
    currentViews = computeViews(actor.extents, handTarget);
  }
  recomputeViews();
  applyView(camera, currentViews.front);
  fillClipSelect(actor.clips);

  const { status: postPipelineStatus, refreshCasters } = buildPostPipeline(engine, scene, camera, lights.key);
  refreshCasters(actor.getMeshes());

  const metrics = new FrameMetrics();
  let lastUi = 0;
  let elapsed = 0;
  let paused = false;
  const status = document.getElementById("status");

  function writeStatus() {
    const fps = metrics.fps ? metrics.fps.toFixed(0) : "—";
    const clipLine = actor.clipNames.length
      ? `${actor.currentClip} ${((actor.currentTime ?? 0)).toFixed(2)}s`
      : "No exported clips";
    status.textContent = `${fps} FPS · ${metrics.drawCalls} draws\n${clipLine}\n${actor.url}`;
  }

  const preview = {
    ready: false,
    engine,
    scene,
    camera,
    metrics,
    animatedAvailable,
    animatedCandidates,
    get selectedUrl() {
      return actor.url;
    },
    get clipNames() {
      return actor.clipNames;
    },
    view(name) {
      const v = currentViews[name];
      if (!v) {
        throw new Error(`Unknown view: ${name}`);
      }
      applyView(camera, v);
    },
    setClip(name, time = 0, freeze = false) {
      actor.setClip(name, time, freeze);
      const sel = document.getElementById("clip");
      if (sel && name) sel.value = name;
    },
    seek(time) {
      actor.seek(time);
    },
    pause(value = true) {
      paused = !!value;
      actor.setPaused(paused);
    },
    samplePalette() {
      return actor.samplePalette();
    },
    measureGroundedSole() {
      return measureGroundedSole(actor.getMeshes());
    },
    setYaw(value) {
      actor.setYaw(value);
    },
    async load(url) {
      status.textContent = `Loading ${url}…`;
      const result = await actor.load(url);
      if (result?.stale) return result;
      fillClipSelect(actor.clips);
      const clipSel = document.getElementById("clip");
      if (clipSel && actor.currentClip) clipSel.value = actor.currentClip;
      recomputeViews();
      applyView(camera, currentViews.front);
      applyBodyEnvironmentIntensity(actor.getMeshes());
      await rebuildScenePbrPipelines(scene);
      refreshCasters(actor.getMeshes());
      const sel = document.getElementById("asset");
      if (sel && [...sel.options].some((o) => o.value === url)) sel.value = url;
      writeStatus();
      return result;
    },
    async capture() {
      return captureScreenshot(engine);
    },
    setChromeVisible(visible) {
      document.body.classList.toggle("audit", !visible);
      if (uiRoot) uiRoot.hidden = !visible;
    },
    /** Analytic camera-framing numbers for `name` (front/back/side/three-quarter/face/feet). */
    viewParams(name) {
      const v = currentViews[name];
      if (!v) return null;
      return {
        alpha: v.alpha,
        beta: v.beta,
        radius: v.radius,
        target: { ...v.target },
        frameHeight: v.frameHeight ?? null,
        fillFraction: v.fillFraction ?? null,
        bottomMarginFraction: v.bottomMarginFraction ?? null,
        topMarginFraction: v.topMarginFraction ?? null,
      };
    },
    /**
     * Samples the current framebuffer around the analytically-projected
     * chest/abdomen point for the "front" view and returns Rec.709 luma.
     * Caller should call view("front") first.
     */
    async measureSkinLuminance() {
      const view = currentViews.front;
      const shot = await captureScreenshot(engine);
      const chestY = (actor.extents?.height ?? 1.75) * SKIN_SAMPLE_HEIGHT_FRACTION;
      const halfFrame = view.frameHeight / 2;
      const ndcY = (chestY - view.target.y) / halfFrame;
      const row = Math.round(((1 - ndcY) / 2) * shot.height);
      const col = Math.round(shot.width / 2);
      let rSum = 0;
      let gSum = 0;
      let bSum = 0;
      let n = 0;
      for (let y = row - SKIN_SAMPLE_HALF_PX; y <= row + SKIN_SAMPLE_HALF_PX; y++) {
        if (y < 0 || y >= shot.height) continue;
        for (let x = col - SKIN_SAMPLE_HALF_PX; x <= col + SKIN_SAMPLE_HALF_PX; x++) {
          if (x < 0 || x >= shot.width) continue;
          const idx = (y * shot.width + x) * 4;
          rSum += shot.data[idx];
          gSum += shot.data[idx + 1];
          bSum += shot.data[idx + 2];
          n++;
        }
      }
      const r = n ? rSum / n / 255 : 0;
      const g = n ? gSum / n / 255 : 0;
      const b = n ? bSum / n / 255 : 0;
      const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      return { luminance, luminancePercent: luminance * 100, rgb: [r, g, b], pixel: { row, col }, samples: n };
    },
    diagnostics() {
      const d = actor.diagnostics();
      return {
        ...d,
        selectedUrl: d.url,
        sceneMeshes: scene.meshes.length,
        sceneAnimations: scene.animationGroups?.length ?? 0,
        metrics: metrics.summary(),
        resolution: [canvas.width, canvas.height],
        dpr: devicePixelRatio,
        gpuTimingSupported: isGpuTimingSupported(engine),
        gpuMs: metrics.gpuMs,
        animatedAvailable,
        animatedCandidates,
        studio: {
          fovDegrees: VFOV_DEGREES,
          hdr: { ...STUDIO_HDR_CREDIT, loaded: hdrLoaded, error: hdrError },
          postPipeline: postPipelineStatus,
          hands: {
            resolved: handTarget.resolved,
            source: handTarget.source,
            missingApi: handTarget.missingApi ?? null,
            radius: HANDS_RADIUS,
            target: { x: handTarget.x, y: handTarget.y, z: handTarget.z },
          },
          lights: {
            keyIntensity: KEY_INTENSITY,
            fillIntensity: FILL_INTENSITY,
            rimIntensity: RIM_INTENSITY,
            bounceIntensity: BOUNCE_INTENSITY,
            bodyEnvIntensity: BODY_ENV_INTENSITY,
            cycEnvIntensity: CYC_ENV_INTENSITY,
            keyWarmthKelvin: KEY_WARMTH_KELVIN,
            keyAzimuthDeg: KEY_AZIMUTH_DEG,
            keyElevationDeg: KEY_ELEVATION_DEG,
            keyDirection: [...KEY_DIRECTION],
            fillRatio: KEY_INTENSITY / FILL_INTENSITY,
          },
          canvas: { width: canvas.width, height: canvas.height, clip: "viewport" },
          views: Object.fromEntries(VIEW_NAMES.map((name) => [name, preview.viewParams(name)])),
        },
      };
    },
  };
  globalThis.BODY_PREVIEW = preview;
  writeStatus();

  onBeforeRender(scene, (ms) => {
    elapsed += ms;
    actor.update(ms / 1000);
    metrics.record(ms, engine.drawCallCount, engine.gpuFrameTimeMs);
    const active = actor.clips.find((c) => c.name === actor.currentClip);
    const scrub = document.getElementById("scrub");
    if (active && scrub && document.activeElement !== scrub) {
      scrub.max = String(active.duration || 1);
      scrub.value = String(actor.currentTime ?? 0);
    }
    if (elapsed - lastUi > 500) {
      lastUi = elapsed;
      writeStatus();
    }
  });

  document.getElementById("asset").onchange = (e) => {
    preview.load(e.target.value).catch((err) => {
      document.getElementById("status").textContent = `Load failed: ${err.message}`;
    });
  };
  document.getElementById("clip").onchange = (e) => {
    preview.setClip(e.target.value, 0, paused);
    const clip = actor.clips.find((c) => c.name === e.target.value);
    const scrub = document.getElementById("scrub");
    if (clip && scrub) {
      scrub.max = String(clip.duration || 1);
      scrub.value = "0";
    }
  };
  document.getElementById("scrub").oninput = (e) => {
    preview.pause(true);
    preview.seek(Number(e.target.value));
    document.getElementById("pause").textContent = "Resume";
  };
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.onclick = () => preview.view(button.dataset.view);
  });
  document.getElementById("pause").onclick = (e) => {
    paused = !paused;
    preview.pause(paused);
    e.target.textContent = paused ? "Resume" : "Pause";
  };

  setGpuTimingEnabled(engine, true);
  await registerSceneWithShadowSupport(scene);
  await startEngine(engine);
  metrics.start({ surface: "body-preview", resolution: [canvas.width, canvas.height] });
  writeStatus();
  preview.ready = true;
}

main().catch(reportError);
