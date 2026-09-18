/**
 * Extra Mixamo humans sharing public/characters/base.glb.
 * Each instance is its own loadGltf container (Lite does not share animation
 * groups across containers yet — L8 documents that). Idle only. Not hostile.
 *
 * https://doc.babylonjs.com/lite/architecture/07-animation/
 * https://doc.babylonjs.com/lite/architecture/13-skeleton/
 */
import {
    addAnimationGroups,
    addToScene,
    createAnimationManager,
    enableAnimationBlending,
    getContainerMeshes,
    loadGltf,
    playAnimation,
    setAnimationWeight,
    stopAnimation,
    updateAnimationManager,
} from "@babylonjs/lite";

import { BODY_URL } from "./body.js";

function findIdle(groups) {
    const named = groups ?? [];
    return named.find((g) => (g.name || "") === "Idle_Loop")
        || named.find((g) => /idle/i.test(g.name || "") && !/talk|torch|pistol|crouch/i.test(g.name || ""))
        || named[0]
        || null;
}

function hideNamed(scene, prefix) {
    for (const mesh of scene.meshes ?? []) {
        if ((mesh.name || "").startsWith(prefix)) {
            mesh.visible = false;
        }
    }
}

function greeterPose(scene) {
    for (const mesh of scene.meshes ?? []) {
        const name = mesh.name || "";
        if (name === "NpcGreeter" || name.startsWith("NpcGreeter.") || name.startsWith("NpcGreeter_")) {
            const m = mesh.worldMatrix;
            if (m && m.length >= 16) {
                return { x: m[12], y: 0, z: m[14], yaw: 0 };
            }
            const p = mesh.position;
            return { x: p?.x ?? 3.2, y: 0, z: p?.z ?? -1.4, yaw: 0 };
        }
    }
    return { x: 3.2, y: 0, z: -1.4, yaw: 0 };
}

/**
 * @param {import("@babylonjs/lite").EngineContext} engine
 * @param {import("@babylonjs/lite").SceneContext} scene
 * @param {{ x: number, y?: number, z: number, yaw?: number, name?: string }} pose
 */
export async function attachIdleHuman(engine, scene, pose) {
    const container = await loadGltf(engine, BODY_URL);
    addToScene(scene, container);
    const root = container.entities?.[0];
    if (!root) {
        throw new Error("npc glTF has no root");
    }
    root.name = pose.name || "NpcHuman";
    root.position.x = pose.x;
    root.position.y = pose.y ?? 0;
    root.position.z = pose.z;
    if (root.rotation) {
        root.rotation.y = pose.yaw ?? 0;
    }
    if (root.scaling) {
        root.scaling.x = -1;
        root.scaling.y = 1;
        root.scaling.z = 1;
    }
    for (const mesh of getContainerMeshes(container)) {
        mesh.receiveShadows = true;
    }

    const groups = container.animationGroups ?? [];
    const manager = createAnimationManager({ engine });
    if (groups.length) {
        addAnimationGroups(manager, groups);
        enableAnimationBlending(manager);
    }
    for (const group of groups) {
        group.loopAnimation = true;
        stopAnimation(group);
        setAnimationWeight(group, 0);
    }
    const idle = findIdle(groups);
    if (idle) {
        idle.loopAnimation = true;
        setAnimationWeight(idle, 1);
        playAnimation(idle);
    }
    if (groups.length) {
        updateAnimationManager(manager, 0);
    }

    return {
        root,
        container,
        skeleton: container.skeletons?.[0],
        manager,
        idle,
        update: (dt) => {
            if (groups.length) {
                updateAnimationManager(manager, (dt > 0 ? dt : 1 / 60) * 1000);
            }
        },
    };
}

/**
 * Replace the scenery greeter mesh with a Mixamo Idle instance.
 * @param {import("@babylonjs/lite").EngineContext} engine
 * @param {import("@babylonjs/lite").SceneContext} scene
 */
export async function attachGreeter(engine, scene) {
    const pose = greeterPose(scene);
    hideNamed(scene, "NpcGreeter");
    return attachIdleHuman(engine, scene, { ...pose, name: "NpcGreeterMixamo" });
}

/**
 * Ring of Idle Mixamo bodies around the well. Used by L8 crowd budget.
 * Each is a full loadGltf — not shared clips (see docs/character-ve.md).
 */
export async function attachCrowd(engine, scene, count = 8, radius = 6.4) {
    const n = Math.max(0, Math.min(12, count | 0));
    const out = [];
    for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + 0.4;
        const human = await attachIdleHuman(engine, scene, {
            x: Math.sin(a) * radius,
            y: 0,
            z: Math.cos(a) * radius,
            yaw: a + Math.PI,
            name: `Crowd_${i}`,
        });
        out.push(human);
    }
    return out;
}
