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
    captureScreenshot,
    createSceneContext,
    decodeError,
    enableErrorDecoding,
    enableBoneControl,
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
import { createAppearance } from "./character/appearance.js";
import { attachBody } from "./character/body.js";
import { createEquipment } from "./character/equipment.js";
import { attachCrowd, attachGreeter } from "./character/npc.js";
import { attachSockets } from "./character/sockets.js";
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
    scene.clearColor = { r: 0.07, g: 0.09, b: 0.10, a: 1 };
    scene.imageProcessing.exposure = 1.05;
    scene.imageProcessing.contrast = 1.12;
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
        if (/ramp_/i.test(name) || name.startsWith("EldenRamp")) {
            mesh.visible = false;
        }
    }

    const hemi = createHemisphericLight([0.18, 1, 0.22], 0.11);
    hemi.diffuseColor = [0.32, 0.40, 0.58];
    hemi.groundColor = [0.04, 0.05, 0.06];
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
            useCubemapSkybox: false,
            skipGround: true,
            skyboxSize: 480,
        });
    } catch (err) {
        console.warn("HDRI failed, continuing without IBL", err);
    }

    setFog(scene, {
        mode: 1,
        density: 0.008,
        start: 40,
        end: 140,
        color: [0.08, 0.11, 0.12],
    });

    if (moon) {
        const shadows = createPcfDirectionalShadowGenerator(engine, moon, {
            mapSize: 2048,
            bias: 0.003,
            normalBias: 0.02,
            darkness: 0.42,
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
    camera.nearPlane = 0.15;
    camera.farPlane = 420;
    camera.inertia = 0;
    camera.panningInertia = 0;
    scene.camera = camera;
    setCameraLimits(camera, {
        lowerRadiusLimit: 2.2,
        upperRadiusLimit: 42,
        lowerBetaLimit: 0.35,
        upperBetaLimit: 2.29,
    });

    const rig = new CameraRig(camera);
    rig.pitch = 0.22;
    rig.distance = 5.4;
    rig.distanceTarget = 5.4;
    initInput(canvas);

    const player = await setupPlayer(engine, scene, rig);
    enableBoneControl();
    const body = await attachBody(engine, scene, player, player.capsuleHeight).catch((err) => {
        console.warn("character glTF failed", err);
        player.body.visible = true;
        return null;
    });
    const sockets = body ? attachSockets(engine, scene, player, body) : null;
    const appearance = body ? createAppearance({ scene, body, player }) : null;
    const equipment = body && sockets
        ? await createEquipment({ engine, scene, player, body, sockets })
        : null;
    const hero = equipment ? { tip: equipment.tip } : null;
    const greeter = await attachGreeter(engine, scene).catch((err) => {
        console.warn("greeter Mixamo failed", err);
        return null;
    });
    const crowdCount = Number.parseInt(new URLSearchParams(location.search).get("crowd") ?? "", 10);
    const crowd = Number.isFinite(crowdCount) && crowdCount > 0
        ? await attachCrowd(engine, scene, crowdCount).catch((err) => {
            console.warn("crowd failed", err);
            return [];
        })
        : [];
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
    const hud = new Hud({ player, targeting, spells, camera, canvas, appearance, equipment, body });
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
        body?.update?.(dt);
        greeter?.update?.(dt);
        for (let i = 0; i < crowd.length; i++) {
            crowd[i].update?.(dt);
        }
        sockets?.sync?.();
        appearance?.update?.();
        equipment?.update?.();
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
        body,
        sockets,
        appearance,
        equipment,
        targeting,
        spells,
        hud,
        dummy: targeting.list[0] || null,
        greeter,
        crowd,
        capture: () => captureScreenshot(engine),
    };

    await registerSceneWithShadowSupport(scene);
    await startEngine(engine);
}

main().catch(showError);
