/**
 * Babylon Lite demo — create → add → register → start
 * https://doc.babylonjs.com/lite/01-getting-started/
 *
 * Loads the moonwell shrine GLB + runtime sidecar exported from Blender.
 */
import {
    AcesToneMapping,
    addToScene,
    createEngine,
    createHemisphericLight,
    createPcfDirectionalShadowGenerator,
    createSceneContext,
    decodeError,
    enableErrorDecoding,
    loadGltf,
    loadHdrEnvironment,
    onBeforeRender,
    registerSceneWithShadowSupport,
    setCameraLimits,
    setFog,
    setMaxLights,
    setShadowTaskCasterMeshes,
    startEngine,
} from "@babylonjs/lite";

import {
    createCameraFromRuntime,
    createLightsFromRuntime,
    fetchRuntime,
} from "./blender-runtime.js";
import { CameraRig } from "./camera-rig.js";
import { collectDummies, syncDummies } from "./dummy.js";
import { glbUrl, runtimeUrl } from "./glb-meta.js";
import { initInput, input } from "./input.js";
import { attachHero } from "./hero.js";
import { setupPlayer } from "./player.js";
import { createSpellSystem } from "./spells/spellSystem.js";
import { Targeting } from "./targeting.js";
import { Hud } from "./ui/hud.js";

enableErrorDecoding();
setMaxLights(20);

const canvas = document.getElementById("renderCanvas");
const errorEl = document.getElementById("error");

function showError(err) {
    console.error(err);
    if (!errorEl) {
        return;
    }
    errorEl.style.display = "block";
    const parts = [];
    try {
        parts.push(decodeError(err));
    } catch (decodeErr) {
        parts.push(`decodeError failed: ${decodeErr}`);
    }
    if (err && typeof err === "object") {
        parts.push(err.message, err.stack);
    }
    parts.push(String(err));
    errorEl.textContent = parts.filter(Boolean).join("\n\n");
}

async function main() {
    const engine = await createEngine(canvas, { msaaSamples: 4 });
    const scene = createSceneContext(engine);
    scene.clearColor = { r: 0.004, g: 0.006, b: 0.012, a: 1 };
    scene.imageProcessing.exposure = 0.88;
    scene.imageProcessing.contrast = 1.18;
    scene.imageProcessing.toneMappingEnabled = true;
    scene.imageProcessing.toneMapping = AcesToneMapping;

    const [shrine, runtime] = await Promise.all([
        loadGltf(engine, glbUrl),
        fetchRuntime(runtimeUrl).catch(() => ({ lights: [], camera: null, fireflyPrefix: "Firefly" })),
    ]);
    addToScene(scene, shrine);
    for (const mesh of scene.meshes ?? []) {
        const mat = mesh.material;
        if (mat?.subsurface?.refraction) {
            delete mat.subsurface.refraction;
        }
        const name = mesh.name || "";
        if (name === "Moon" || mat?.name === "Moon") {
            mesh.visible = false;
        }
        if (name.startsWith("FenceWall")) {
            mesh.visible = false;
        }
    }

    const hemi = createHemisphericLight([0.2, 1, 0.15], 0.08);
    hemi.diffuseColor = [0.35, 0.48, 0.75];
    hemi.groundColor = [0.03, 0.04, 0.02];
    addToScene(scene, hemi);

    let moon;
    for (const light of createLightsFromRuntime(runtime)) {
        addToScene(scene, light);
        if (light.lightType === "directional") {
            moon = light;
        }
    }

    try {
        await loadHdrEnvironment(scene, "/env/dikhololo_night_2k.hdr", {
            faceSize: 512,
            useCubemapSkybox: true,
            skipGround: true,
            skyboxSize: 120,
        });
    } catch (err) {
        console.warn("HDRI failed, continuing without IBL", err);
    }

    setFog(scene, {
        mode: 3,
        density: 0.022,
        start: 12,
        end: 48,
        color: [0.015, 0.02, 0.035],
    });

    if (moon) {
        const shadows = createPcfDirectionalShadowGenerator(engine, moon, {
            mapSize: 2048,
            bias: 0.003,
            normalBias: 0.02,
            darkness: 0.62,
        });
        moon.shadowGenerator = shadows;
        const casters = (scene.meshes ?? []).filter((mesh) => {
            const name = mesh.name || "";
            return !name.startsWith("Firefly") && name !== "Moon";
        });
        setShadowTaskCasterMeshes(shadows, casters);
        for (const mesh of scene.meshes ?? []) {
            mesh.receiveShadows = true;
        }
    }

    const camera = createCameraFromRuntime(runtime);
    camera.fov = 0.85;
    camera.nearPlane = 0.08;
    camera.farPlane = 90;
    camera.wheelPrecision = 40;
    camera.radius = 5.2;
    camera.inertia = 0;
    camera.panningInertia = 0;
    scene.camera = camera;
    setCameraLimits(camera, {
        lowerRadiusLimit: 2.2,
        upperRadiusLimit: 24,
        lowerBetaLimit: 0.35,
        upperBetaLimit: 2.29,
    });

    const rig = new CameraRig(camera);
    rig.pitch = 0.22;
    rig.distance = 5.4;
    rig.distanceTarget = 5.4;
    initInput(canvas);

    const player = await setupPlayer(engine, scene, rig);
    const hero = await attachHero(engine, scene, player, player.capsuleHeight).catch((err) => {
        console.warn("hero glTF failed", err);
        player.body.visible = true;
        return null;
    });
    if (moon) {
        const casters = (scene.meshes ?? []).filter((mesh) => {
            const name = mesh.name || "";
            return !name.startsWith("Firefly")
                && name !== "Moon"
                && name !== "Player"
                && name !== "PlayerHead"
                && name !== "WalkSlab"
                && name !== "HamletRing"
                && !name.startsWith("FenceWall");
        });
        const shadows = moon.shadowGenerator;
        if (shadows) {
            setShadowTaskCasterMeshes(shadows, casters);
        }
        player.body.receiveShadows = true;
    }

    const prefix = runtime.fireflyPrefix || "Firefly";
    const fireflies = (scene.meshes ?? []).filter((mesh) => (mesh.name || "").startsWith(prefix));
    const fireflyY = fireflies.map((mesh) => mesh.position.y);

    const targeting = new Targeting();
    targeting.list = collectDummies(scene);
    const spells = createSpellSystem({ engine, scene, player, hero, targeting, rig });
    const hud = new Hud({ player, targeting, spells, camera, canvas });
    const camForward = { x: 0, y: 0, z: 1 };

    const processTargeting = () => {
        syncDummies(targeting.list);
        const eye = player.body.position;
        camForward.x = Math.sin(rig.yaw);
        camForward.z = Math.cos(rig.yaw);
        if (input.tabPressed || input.tabBack) {
            targeting.tab(eye, camForward, input.tabBack);
            input.tabPressed = false;
            input.tabBack = false;
        }
        if (input.clicked) {
            targeting.click(eye, camForward);
            input.clicked = false;
        }
        if (input.escape) {
            if (!hud.closeTop()) {
                targeting.clear();
            }
            input.escape = false;
        }
    };

    onBeforeRender(scene, (deltaMs) => {
        const dt = deltaMs / 1000;
        player.kinematicStep(dt);
        hero?.syncLights?.();
        processTargeting();
        spells.update(dt);
        hud.update();
        const t = performance.now() * 0.001;
        for (let i = 0; i < fireflies.length; i++) {
            fireflies[i].position.y = fireflyY[i] + Math.sin(t * 1.8 + i * 0.7) * 0.1;
        }
    });

    globalThis.MOONWELL = {
        player,
        rig,
        camera,
        scene,
        input,
        hero,
        targeting,
        spells,
        hud,
        dummy: targeting.list[0] || null,
    };

    await registerSceneWithShadowSupport(scene);
    await startEngine(engine);
}

main().catch(showError);
