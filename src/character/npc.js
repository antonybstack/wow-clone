import {prepareLinearMaterial} from '../ashen-reach/linear-materials.js';
/**
 * Extra Mixamo humans sharing public/characters/base.glb.
 * Each instance is its own loadGltf container (Lite does not share animation
 * groups across containers yet — L8 documents that).
 *
 * https://doc.babylonjs.com/lite/architecture/07-animation/
 * https://doc.babylonjs.com/lite/architecture/13-skeleton/
 */
import {
    addAnimationGroups,
    addToScene,
    createAnimationManager,
    createPbrMaterial,
    enableAnimationBlending,
    getContainerMeshes,
    loadGltf,
    playAnimation,
    setAnimationWeight,
    setMeshVisible,
    setPbrEmissive,
    stopAnimation,
    updateAnimationManager,
} from "@babylonjs/lite";

import { BODY_URL } from "./body.js";

const BLEND_SPEED = 4;
const shadeMaterials = new Map();

function meshName(mesh) {
    return (mesh.name || "").toLowerCase();
}

function isJointMesh(mesh) {
    const name = meshName(mesh);
    if (name.includes("surface")) return false;
    return name.includes("joint");
}

function tintKey(tint) {
    const color = Array.isArray(tint)
        ? [tint[0], tint[1], tint[2], tint[3] ?? 1]
        : [0.46, 0.58, 0.62, 0.58];
    const emissive = tint?.emissive;
    return JSON.stringify({
        color,
        roughness: Number.isFinite(tint?.roughness) ? tint.roughness : 0.94,
        metallic: Number.isFinite(tint?.metallic) ? tint.metallic : 0,
        direct: Number.isFinite(tint?.directIntensity) ? tint.directIntensity : 0.38,
        env: Number.isFinite(tint?.environmentIntensity) ? tint.environmentIntensity : 0.2,
        emissive: Array.isArray(emissive) ? emissive : [color[0] * 0.28, color[1] * 0.28, color[2] * 0.28],
    });
}

function shadeMaterial(tint) {
    const key = tintKey(tint);
    const cached = shadeMaterials.get(key);
    if (cached) return cached;
    const parsed = JSON.parse(key);
    const [r, g, b, alpha] = parsed.color;
    const mat = createPbrMaterial({
        baseColorFactor: [r, g, b, 1],
        roughnessFactor: parsed.roughness,
        metallicFactor: parsed.metallic,
        doubleSided: true,
        directIntensity: parsed.direct,
        environmentIntensity: parsed.env,
        alpha,
        alphaBlend: alpha < 0.999,
    });
    if (parsed.emissive) setPbrEmissive(mat, parsed.emissive);
    shadeMaterials.set(key, mat);
    return mat;
}

function applyShadeLook(mesh, tint, hideJoints, scene) {
    if (hideJoints && isJointMesh(mesh)) {
        setMeshVisible(mesh, false);
        mesh.visible = false;
        mesh.receiveShadows = false;
        return;
    }
    if (!tint) {
        mesh.receiveShadows = true;
        return;
    }
    mesh.receiveShadows = true;
    const material = shadeMaterial(tint);
    prepareLinearMaterial(scene, material);
    mesh.material = material;
}

function findNamed(groups, exact, extra = [], exclude = []) {
    const named = groups ?? [];
    const skip = exclude.map((token) => token.toLowerCase());
    const allowed = named.filter((group) => {
        const name = (group.name || "").toLowerCase();
        return !skip.some((token) => name.includes(token));
    });
    const hit = allowed.find((group) => (group.name || "") === exact);
    if (hit) return hit;
    for (const token of extra) {
        const lower = token.toLowerCase();
        const match = allowed.find((group) => (group.name || "").toLowerCase().includes(lower));
        if (match) return match;
    }
    return null;
}

function findIdle(groups) {
    return findNamed(groups, "Idle_Loop", ["idle"], ["talk", "torch", "pistol", "crouch"])
        || (groups ?? [])[0]
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
 * @param {{ x: number, y?: number, z: number, yaw?: number, name?: string,
 *           scale?: number,
 *           tint?: number[]|{0:number,1:number,2:number,3?:number,roughness?:number,metallic?:number,
 *                            emissive?: number[], directIntensity?: number, environmentIntensity?: number},
 *           hideJoints?: boolean }} pose
 */
let npcBufferPromise = null;
export function prefetchNpcBuffer() {
    npcBufferPromise ??= fetch(BODY_URL).then((response) => {
        if (!response.ok) throw new Error(`fetch ${BODY_URL} ${response.status}`);
        return response.arrayBuffer();
    });
    return npcBufferPromise;
}

export async function attachAnimatedHuman(engine, scene, pose) {
    const source = pose.buffer ? pose.buffer.slice(0) : BODY_URL;
    const container = await loadGltf(engine, source);
    for (const mesh of getContainerMeshes(container)) prepareLinearMaterial(scene, mesh.material);
    addToScene(scene, container);
    const root = container.entities?.[0];
    if (!root) {
        throw new Error("npc glTF has no root");
    }
    const scale = Number.isFinite(pose.scale) && pose.scale > 0 ? pose.scale : 1;
    root.name = pose.name || "NpcHuman";
    root.position.x = pose.x;
    root.position.y = pose.y ?? 0;
    root.position.z = pose.z;
    if (root.rotation) {
        root.rotation.y = pose.yaw ?? 0;
    }
    if (root.scaling) {
        root.scaling.x = -scale;
        root.scaling.y = scale;
        root.scaling.z = scale;
    }
    const meshes = getContainerMeshes(container);
    for (const mesh of meshes) {
        applyShadeLook(mesh, pose.tint, !!pose.hideJoints, scene);
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
    const clips = {
        idle: findIdle(groups),
        walk: findNamed(groups, "Walk_Loop", ["walk"], ["back", "formal", "crouch"]),
        jog: findNamed(groups, "Jog_Fwd_Loop", ["jog"]),
        run: findNamed(groups, "Sprint_Loop", ["sprint"]),
        punch: findNamed(groups, "Punch_Cross", ["punch"]),
        death: findNamed(groups, "Death01", ["death"]),
    };
    const used = Object.values(clips).filter(Boolean);
    const unique = [...new Set(used)];
    let active = null;
    let target = null;
    let oneshot = false;

    const play = (name, options = {}) => {
        const clip = clips[name] || null;
        if (!clip) return null;
        const speed = Number.isFinite(options.speed) ? options.speed : 1;
        const loop = options.loop !== false && !options.oneshot;
        clip.speedRatio = speed;
        clip.loopAnimation = loop;
        if (target === clip && clip.isPlaying) {
            oneshot = !!options.oneshot;
            return clip;
        }
        target = clip;
        oneshot = !!options.oneshot;
        if (!clip.isPlaying) {
            clip.currentTime = 0;
            playAnimation(clip);
        }
        return clip;
    };

    const idle = clips.idle;
    if (idle) play("idle");
    if (groups.length) {
        updateAnimationManager(manager, 0);
    }

    const actor = {
        root,
        container,
        meshes,
        skeleton: container.skeletons?.[0],
        manager,
        idle,
        clips,
        get active() { return target; },
        get clipName() { return target?.name || null; },
        play,
        setVisible(visible) {
            setMeshVisible(root, visible);
            for (const mesh of meshes) {
                if (pose.hideJoints && isJointMesh(mesh)) {
                    setMeshVisible(mesh, false);
                    mesh.visible = false;
                    continue;
                }
                setMeshVisible(mesh, visible);
                mesh.visible = visible;
            }
        },
        update: (dt) => {
            if (!groups.length) return;
            const step = Math.max(0, dt);
            if (oneshot && target && target.duration > 0
                && target.currentTime >= target.duration - 0.04) {
                oneshot = false;
                if (clips.idle && target !== clips.death) play("idle");
            }
            for (const clip of unique) {
                const want = clip === target ? 1 : 0;
                const next = clip.weight + (want - clip.weight) * Math.min(1, BLEND_SPEED * (step || 1 / 60));
                setAnimationWeight(clip, next);
                if (want > 0 && !clip.isPlaying) playAnimation(clip);
                if (want === 0 && next < 0.02 && clip.isPlaying && clip !== target) stopAnimation(clip);
            }
            active = target;
            updateAnimationManager(manager, (step > 0 ? step : 1 / 60) * 1000);
            actor.silhouette?.sync();
        },
    };

    return actor;
}

/**
 * @param {import("@babylonjs/lite").EngineContext} engine
 * @param {import("@babylonjs/lite").SceneContext} scene
 * @param {{ x: number, y?: number, z: number, yaw?: number, name?: string }} pose
 */
export async function attachIdleHuman(engine, scene, pose) {
    const human = await attachAnimatedHuman(engine, scene, pose);
    return {
        root: human.root,
        container: human.container,
        skeleton: human.skeleton,
        manager: human.manager,
        idle: human.idle,
        update: human.update,
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
