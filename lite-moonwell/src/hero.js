/**
 * Cosmetic hooded-mage glTF parented to the physics capsule.
 * Capsule stays the collider; this mesh only poses and carries staff lights.
 */
import {
    addToScene,
    createPointLight,
    loadGltf,
    setParent,
} from "@babylonjs/lite";

import { createClipDirector } from "./anim.js";
import { heroUrl } from "./glb-meta.js";
import { input } from "./input.js";

const TARGET_HEIGHT = 1.79;

function meshList(scene) {
    return scene.meshes ?? [];
}

function isHeroMesh(mesh) {
    const name = mesh.name || "";
    return name.startsWith("Hero") || name.startsWith("A_") || name.includes("Hero");
}

const HEIGHT_IGNORE = /Staff|Flame|Band|Crystal|Bead|Charm|Tip|Wrap|Chain|Brooch|Pendant|Prong|Rag|Studio|LookPlate|Collision|Void/;

function isHeroBodyMesh(mesh) {
    if (!isHeroMesh(mesh)) {
        return false;
    }
    return !HEIGHT_IGNORE.test(mesh.name || "");
}

function localMinY(mesh) {
    const a = mesh.boundMin;
    if (!a) {
        return 0;
    }
    return a.y ?? a[1] ?? 0;
}

function localMaxY(mesh) {
    const b = mesh.boundMax;
    if (!b) {
        return 0;
    }
    return b.y ?? b[1] ?? 0;
}

function translation(matrix) {
    return { x: matrix[12], y: matrix[13], z: matrix[14] };
}

/**
 * @param {import("@babylonjs/lite").EngineContext} engine
 * @param {import("@babylonjs/lite").SceneContext} scene
 * @param {{ body: object, setOnPose?: Function }} player
 * @param {number} capsuleHeight
 */
export async function attachHero(engine, scene, player, capsuleHeight) {
    const asset = await loadGltf(engine, heroUrl);
    const director = createClipDirector(asset, engine);
    console.log("hero clips", director.names);
    addToScene(scene, asset);
    const root = asset.entities?.[0];
    if (!root) {
        console.warn("hero glTF has no root");
        return null;
    }
    root.name = "HeroRoot";

    player.body.visible = false;
    for (const mesh of meshList(scene)) {
        if (mesh.name === "Player" || mesh.name === "PlayerHead") {
            mesh.visible = false;
        }
    }

    let minY = Infinity;
    let maxY = -Infinity;
    for (const mesh of meshList(scene)) {
        if (isHeroMesh(mesh)) {
            mesh.receiveShadows = true;
        }
        if (!isHeroBodyMesh(mesh)) {
            continue;
        }
        minY = Math.min(minY, localMinY(mesh));
        maxY = Math.max(maxY, localMaxY(mesh));
    }
    if (!Number.isFinite(minY) || !Number.isFinite(maxY) || maxY - minY < 0.2) {
        minY = 0;
        maxY = TARGET_HEIGHT;
    }
    const visualHeight = maxY - minY;
    const scale = TARGET_HEIGHT / visualHeight;
    if ("scaling" in root) {
        root.scaling.x = scale;
        root.scaling.y = scale;
        root.scaling.z = scale;
    }

    setParent(root, player.body);
    root.position.x = 0;
    root.position.y = -(capsuleHeight * 0.5) - minY * scale;
    root.position.z = 0;

    const identityLocal = () => {
        if (root.rotation) {
            root.rotation.x = 0;
            root.rotation.y = 0;
            root.rotation.z = 0;
        }
        const q = root.rotationQuaternion;
        if (q) {
            q.x = 0;
            q.y = 0;
            q.z = 0;
            q.w = 1;
        }
    };
    identityLocal();

    const tip = meshList(scene).find((mesh) => {
        const name = mesh.name || "";
        return name.includes("StaffTip")
            || name.includes("HeroFlame")
            || name.includes("A_Flame")
            || name === "HeroFlame"
            || name === "A_Flame";
    });

    const staffLight = createPointLight([0, 1.7, 0], 0.16);
    staffLight.diffuse = [0.52, 0.22, 1.0];
    staffLight.specular = [0.4, 0.16, 0.85];
    staffLight.range = 1.0;
    addToScene(scene, staffLight);

    const ember = createPointLight([0, 0.2, 0], 0.10);
    ember.diffuse = [1.0, 0.42, 0.16];
    ember.specular = [0.55, 0.22, 0.08];
    ember.range = 0.7;
    addToScene(scene, ember);

    const syncLights = () => {
        identityLocal();
        const feet = player.body.position;
        ember.position.x = feet.x;
        ember.position.y = feet.y - capsuleHeight * 0.42;
        ember.position.z = feet.z;
        const wm = tip?.worldMatrix;
        // Skinned staff meshes report the capsule origin; only trust a raised matrix.
        if (wm && wm.length >= 16 && wm[13] > feet.y + 0.2) {
            const p = translation(wm);
            staffLight.position.x = p.x;
            staffLight.position.y = p.y;
            staffLight.position.z = p.z;
        } else {
            const yaw = player.getFacing();
            const fx = Math.sin(yaw);
            const fz = Math.cos(yaw);
            staffLight.position.x = feet.x + fx * 0.14 + Math.cos(yaw) * 0.34;
            staffLight.position.y = feet.y + 0.78;
            staffLight.position.z = feet.z + fz * 0.14 - Math.sin(yaw) * 0.34;
        }
    };

    player.setOnPose?.((dt) => {
        syncLights();
        const motion = player.getMotion?.() ?? {};
        director.update(motion, input, (dt || 1 / 60) * 1000);
    });
    syncLights();

    return {
        root,
        tip: tip || null,
        staffLight,
        ember,
        syncLights,
        director,
        animationGroups: asset.animationGroups ?? [],
    };
}
