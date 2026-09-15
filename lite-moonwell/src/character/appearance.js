/**
 * Player look: height (uniform visual-root scale), skin tint, weight.
 * Height does not retune the Havok capsule this pass.
 *
 * Weight via setBoneScaling is a no-op on this Mixamo clip set: every joint has
 * a baked scale track, and Lite reapplies clip scale after bone overrides
 * (see setBoneScaling JSDoc). We keep the API and skip the bone scale.
 */
import { getBoneByName, markMaterialUboDirty, rebuildMaterial, setBoneScaling } from "@babylonjs/lite";

import { input } from "../input.js";

export const HEIGHT_MIN = 0.9;
export const HEIGHT_MAX = 1.15;
export const WEIGHT_MIN = 0.9;
export const WEIGHT_MAX = 1.15;

export const SKINS = [
    [0.93, 0.72, 0.56, 1],
    [0.78, 0.52, 0.36, 1],
    [0.52, 0.32, 0.22, 1],
    [0.32, 0.20, 0.14, 1],
];

const HEIGHT_STEP = 0.05;
const SPINE = ["mixamorig:Spine1", "mixamorig:Spine", "Spine1", "Spine"];

function clamp(value, lo, hi) {
    return Math.min(hi, Math.max(lo, value));
}

function parseQuery() {
    const q = new URLSearchParams(typeof location !== "undefined" ? location.search : "");
    const h = Number.parseFloat(q.get("h") ?? "");
    const w = Number.parseFloat(q.get("w") ?? "");
    const s = Number.parseInt(q.get("skin") ?? "", 10);
    return {
        height: Number.isFinite(h) ? clamp(h, HEIGHT_MIN, HEIGHT_MAX) : 1,
        weight: Number.isFinite(w) ? clamp(w, WEIGHT_MIN, WEIGHT_MAX) : 1,
        skin: Number.isFinite(s) ? ((s % SKINS.length) + SKINS.length) % SKINS.length : 1,
    };
}

function bodyMeshes(root, scene) {
    const out = [];
    const take = (mesh) => {
        const name = mesh?.name || "";
        // Skin tint is Alpha_Surface only — never cloth, crystal, or joint chrome.
        if (name !== "Alpha_Surface" && !/skin|body/i.test(name)) {
            return;
        }
        if (/joint|staff|crystal|cloth|cape|hood|robe|boot|sleeve/i.test(name)) {
            return;
        }
        if (mesh.material) {
            out.push(mesh);
        }
    };
    const walk = (node) => {
        take(node);
        for (const child of node?.children ?? []) {
            walk(child);
        }
    };
    walk(root);
    if (out.length === 0) {
        for (const mesh of scene?.meshes ?? []) {
            take(mesh);
        }
    }
    return out;
}

/**
 * @param {{
 *   scene: object,
 *   body: { root?: object, skeleton?: object },
 *   player?: { setHeightScale?: Function, capsuleHeight?: number },
 * }} opts
 */
export function createAppearance(opts) {
    const root = opts.body?.root;
    const skeleton = opts.body?.skeleton;
    const player = opts.player;
    const meshes = bodyMeshes(root, opts.scene);
    const query = parseQuery();
    const state = {
        height: query.height,
        weight: query.weight,
        skin: query.skin,
        weightBone: false,
    };

    const applyScale = () => {
        if (!root?.scaling) {
            return;
        }
        const h = state.height;
        root.scaling.x = -h;
        root.scaling.y = h;
        root.scaling.z = h;
        const cap = player?.setHeightScale?.(h) ?? player?.capsuleHeight;
        if (Number.isFinite(cap) && root.position) {
            root.position.y = -cap * 0.5;
        }
    };

    const applySkin = () => {
        const color = SKINS[state.skin] || SKINS[0];
        for (const mesh of meshes) {
            const mat = mesh.material;
            if (!mat || (mesh.name || "").startsWith("Staff")) {
                continue;
            }
            const joints = (mesh.name || "").includes("Joints");
            const t = joints ? 0.78 : 1;
            mat.baseColorTexture = undefined;
            mat.emissiveTexture = undefined;
            mat.baseColorFactor = [color[0] * t, color[1] * t, color[2] * t, 1];
            if ("emissiveColor" in mat) {
                mat.emissiveColor = [0, 0, 0];
            }
            if ("emissiveIntensity" in mat) {
                mat.emissiveIntensity = 0;
            }
            if (opts.scene) {
                try {
                    rebuildMaterial(opts.scene, mat);
                } catch {
                    markMaterialUboDirty(mat);
                }
            } else {
                markMaterialUboDirty(mat);
            }
        }
    };

    const spine = skeleton && SPINE.map((n) => getBoneByName(skeleton, n)).find(Boolean);
    if (skeleton && spine && state.weight !== 1) {
        // Mixamo Idle/Walking bake scale on every joint; this is overwritten next tick.
        setBoneScaling(skeleton, spine, state.weight, 1, state.weight);
        state.weightBone = false;
    }

    applyScale();
    applySkin();

    const label = () =>
        `h ${state.height.toFixed(2)}  skin ${state.skin} (Alpha_Surface)  [ ] height · P skin`;

    const update = () => {
        let dirty = false;
        if (input.heightUp) {
            state.height = clamp(Math.round((state.height + HEIGHT_STEP) * 100) / 100, HEIGHT_MIN, HEIGHT_MAX);
            input.heightUp = false;
            dirty = true;
        }
        if (input.heightDown) {
            state.height = clamp(Math.round((state.height - HEIGHT_STEP) * 100) / 100, HEIGHT_MIN, HEIGHT_MAX);
            input.heightDown = false;
            dirty = true;
        }
        if (input.cycleSkin) {
            state.skin = (state.skin + 1) % SKINS.length;
            input.cycleSkin = false;
            dirty = true;
        }
        if (dirty) {
            applyScale();
            applySkin();
        }
    };

    console.log("appearance", { ...state, meshes: meshes.map((m) => m.name), spine: spine?.name ?? null });

    return {
        state,
        meshes,
        label,
        update,
        applyScale,
        applySkin,
    };
}
