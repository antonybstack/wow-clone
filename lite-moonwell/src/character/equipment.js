/**
 * WoW paper-doll slots. Gear is NOT a second skeleton — each item is parented
 * to a socket TransformNode that copies one Mixamo joint each frame.
 *
 * Slots: head (cowl), back (cape), torso (robe), arms, forearms, feet, mainHand.
 * Head uses setBoneVisible(Head) so the Mixamo skull collapses while the cowl is on.
 */
import {
    addToScene,
    createCylinder,
    createDisc,
    createPbrMaterial,
    createRibbon,
    createSphere,
    createTransformNode,
    getBoneByName,
    getContainerMeshes,
    loadGltf,
    setBoneVisible,
    setParent,
    setSubtreeVisible,
} from "@babylonjs/lite";

import { input } from "../input.js";
import { DEFAULT_LOADOUT, ITEMS } from "./catalog.js";

export { ITEMS };

const SLOTS = [
    "head", "back", "torso", "mainHand", "offHand",
    "leftArm", "rightArm", "leftForeArm", "rightForeArm",
    "leftFoot", "rightFoot",
];

const LEG_BONES = ["mixamorig:LeftUpLeg", "mixamorig:RightUpLeg", "LeftUpLeg", "RightUpLeg"];

function v3(x, y, z) {
    return { x, y, z };
}

function clothMat(color) {
    return createPbrMaterial({
        baseColorFactor: [...color, 1],
        metallicFactor: 0.02,
        roughnessFactor: 0.88,
        doubleSided: true,
        environmentIntensity: 0.45,
        directIntensity: 0.85,
    });
}

function voidMat() {
    const mat = createPbrMaterial({
        baseColorFactor: [0.004, 0.002, 0.008, 1],
        metallicFactor: 0,
        roughnessFactor: 1,
        doubleSided: true,
        environmentIntensity: 0,
        directIntensity: 0,
    });
    if ("emissiveColor" in mat) {
        mat.emissiveColor = [0, 0, 0];
        mat.emissiveIntensity = 0;
    }
    return mat;
}

function woodMat() {
    return createPbrMaterial({
        baseColorFactor: [0.22, 0.12, 0.07, 1],
        metallicFactor: 0.04,
        roughnessFactor: 0.72,
    });
}

function gemMat() {
    const mat = createPbrMaterial({
        baseColorFactor: [0.38, 0.16, 0.72, 1],
        metallicFactor: 0.12,
        roughnessFactor: 0.28,
    });
    if ("emissiveColor" in mat) {
        mat.emissiveColor = [0.42, 0.14, 0.85];
        mat.emissiveIntensity = 0.7;
    }
    return mat;
}

function stamp(scene, mesh, name, material) {
    mesh.name = name;
    mesh.material = material;
    mesh.receiveShadows = true;
    addToScene(scene, mesh);
    return mesh;
}

function setTreeVisible(visual, visible) {
    if (visual?.root) {
        setSubtreeVisible(visual.root, visible);
    }
    for (const mesh of visual?.meshes ?? []) {
        mesh.visible = visible;
    }
}

/**
 * Mixamo Head/Spine2 sockets copy joint worlds whose local +Y is toward the
 * feet (bind Rx). Crown / cloak hem therefore live in -Y / +Y respectively.
 * +Z is the face / chest-front, so a front opening and a back cape use +Z / -Z.
 *
 * Rounded cowl with a wide face gape. Sized to read at spawn camera (~5 m),
 * not a funnel/pylon. Mixamo Head +Y is toward the feet.
 */
function cowlPaths() {
    const segs = 20;
    const openHalf = 0.72;
    const rings = [
        { y: 0.18, r: 0.32, z: -0.08, open: 0.1 },
        { y: 0.08, r: 0.3, z: -0.02, open: 0.2 },
        { y: 0.0, r: 0.28, z: 0.05, open: 0.5 },
        { y: -0.08, r: 0.27, z: 0.1, open: 1.1 },
        { y: -0.16, r: 0.26, z: 0.08, open: 1.15 },
        { y: -0.24, r: 0.22, z: 0.02, open: 0.45 },
        { y: -0.3, r: 0.16, z: -0.04, open: 0.12 },
    ];
    return rings.map((ring) => {
        const path = [];
        const a0 = openHalf * ring.open;
        const a1 = Math.PI * 2 - a0;
        for (let i = 0; i < segs; i++) {
            const a = a0 + (i / (segs - 1)) * (a1 - a0);
            path.push(v3(Math.sin(a) * ring.r, ring.y, Math.cos(a) * ring.r + ring.z));
        }
        return path;
    });
}

/**
 * Back-only cloak. Meridians span the back hemisphere (front stays open, arms free).
 * +Y is world-down; cos(a)*r at a=π is -Z (back). Flares mid-cape, tapers at an
 * irregular hem so the silhouette is not a vertical quad.
 */
function capePaths(spread = 1, zBias = 0) {
    const cols = 11;
    const a0 = Math.PI * 0.58;
    const a1 = Math.PI * 1.42;
    const fold = [0, 0.04, 0.01, 0.06, 0.02, 0.07, 0.02, 0.06, 0.01, 0.04, 0];
    const hem = [0.05, 0.01, 0.07, 0.02, 0.09, 0.03, 0.08, 0.02, 0.06, 0.01, 0.04];
    const rows = [
        { y: -0.08, r: 0.13, zPush: 0.02 },
        { y: 0.1, r: 0.18, zPush: -0.04 },
        { y: 0.32, r: 0.26, zPush: -0.1 },
        { y: 0.52, r: 0.32, zPush: -0.16 },
        { y: 0.72, r: 0.3, zPush: -0.14 },
        { y: 0.92, r: 0.24, zPush: -0.08 },
    ];
    const last = rows.length - 1;
    const paths = [];
    for (let c = 0; c < cols; c++) {
        const t = c / (cols - 1);
        const a = a0 + t * (a1 - a0);
        const path = [];
        for (let ri = 0; ri < rows.length; ri++) {
            const row = rows[ri];
            const r = Math.max(0.08, (row.r - fold[c]) * spread);
            const y = row.y + hem[c] * (ri === last ? 1 : ri / last * 0.3);
            path.push(v3(Math.sin(a) * r, y, Math.cos(a) * r + row.zPush + zBias));
        }
        paths.push(path);
    }
    return paths;
}

function buildHood(engine, scene) {
    const cloth = clothMat([0.3, 0.34, 0.4]);
    const inner = voidMat();
    const root = createTransformNode("HoodRoot");

    const shell = stamp(scene, createRibbon(engine, { pathArray: cowlPaths() }), "HoodShell", cloth);
    setParent(shell, root);

    // Dark oval where the face is. Disc lies in XY (normal +Z = face).
    const voidDisc = stamp(scene, createDisc(engine, { radius: 0.12, tessellation: 24 }), "HoodVoid", inner);
    voidDisc.position.set(0, -0.06, 0.1);
    voidDisc.scaling.set(1.15, 1.35, 1);
    setParent(voidDisc, root);

    const voidWell = stamp(scene, createCylinder(engine, {
        height: 0.09,
        diameterTop: 0.18,
        diameterBottom: 0.14,
        tessellation: 20,
    }), "HoodVoidWell", inner);
    voidWell.rotation.x = Math.PI / 2;
    voidWell.position.set(0, -0.02, 0.03);
    setParent(voidWell, root);

    const voidFill = stamp(scene, createSphere(engine, { diameter: 0.14, segments: 10 }), "HoodVoidFill", inner);
    voidFill.position.set(0, -0.03, -0.04);
    setParent(voidFill, root);

    return { root, meshes: [shell, voidDisc, voidWell, voidFill] };
}

function buildStaff(engine, scene) {
    const root = createTransformNode("StaffRoot");
    // Socket inherits wrist rotation (catalog.local orients the shaft). Grip at origin.
    const shaft = stamp(scene, createCylinder(engine, {
        height: 1.24,
        diameter: 0.04,
        tessellation: 10,
    }), "StaffShaft", woodMat());
    shaft.position.set(0, 0.38, 0);
    setParent(shaft, root);

    const crystal = stamp(scene, createSphere(engine, { diameter: 0.11, segments: 10 }), "StaffCrystal", gemMat());
    crystal.position.set(0, 1.02, 0);
    setParent(crystal, root);

    return { root, meshes: [shaft, crystal], tip: crystal };
}

function leatherMat() {
    return createPbrMaterial({
        baseColorFactor: [0.12, 0.08, 0.06, 1],
        metallicFactor: 0.04,
        roughnessFactor: 0.78,
    });
}

function buildSleeve(engine, scene, name) {
    const cloth = clothMat([0.16, 0.2, 0.26]);
    const root = createTransformNode(name);
    // Mixamo arm +Y along the bone. Tube is outside the dummy upper arm.
    const tube = stamp(scene, createCylinder(engine, {
        height: 0.42,
        diameterTop: 0.22,
        diameterBottom: 0.17,
        tessellation: 12,
    }), `${name}Cloth`, cloth);
    tube.position.set(0, 0.16, 0);
    setParent(tube, root);
    return { root, meshes: [tube] };
}

function buildForeSleeve(engine, scene, name) {
    const cloth = clothMat([0.16, 0.2, 0.26]);
    const root = createTransformNode(name);
    const tube = stamp(scene, createCylinder(engine, {
        height: 0.34,
        diameterTop: 0.19,
        diameterBottom: 0.15,
        tessellation: 12,
    }), `${name}Cloth`, cloth);
    tube.position.set(0, 0.12, 0);
    setParent(tube, root);
    return { root, meshes: [tube] };
}

function buildBoot(engine, scene, name) {
    const leather = leatherMat();
    const root = createTransformNode(name);
    // Mixamo foot +Y toward toes. Cuff along -Y (up the shin in bind).
    const cuff = stamp(scene, createCylinder(engine, {
        height: 0.22,
        diameterTop: 0.13,
        diameterBottom: 0.15,
        tessellation: 12,
    }), `${name}Cuff`, leather);
    cuff.position.set(0, -0.08, 0);
    setParent(cuff, root);
    const vamp = stamp(scene, createCylinder(engine, {
        height: 0.2,
        diameterTop: 0.08,
        diameterBottom: 0.15,
        tessellation: 12,
    }), `${name}Vamp`, leather);
    vamp.position.set(0, 0.1, 0.01);
    setParent(vamp, root);
    const sole = stamp(scene, createCylinder(engine, {
        height: 0.05,
        diameter: 0.16,
        tessellation: 12,
    }), `${name}Sole`, leather);
    sole.position.set(0, 0.08, 0);
    setParent(sole, root);
    return { root, meshes: [cuff, vamp, sole] };
}

function buildCape(engine, scene) {
    const outer = clothMat([0.27, 0.32, 0.38]);
    const root = createTransformNode("CapeRoot");
    const cloak = stamp(scene, createRibbon(engine, { pathArray: capePaths(1, 0) }), "CapeCloth", outer);
    setParent(cloak, root);
    return { root, meshes: [cloak] };
}

/**
 * Robe on Spine1: pecs through mid-thigh so the dummy is not nude below a tank top.
 * Back radius slightly smaller so the back-slot cape stays outside.
 */
function tunicPaths() {
    const cols = 18;
    const rows = [
        { y: -0.28, r: 0.22, z: 0.03 },
        { y: -0.12, r: 0.27, z: 0.05 },
        { y: 0.08, r: 0.26, z: 0.04 },
        { y: 0.32, r: 0.3, z: 0.03 },
        { y: 0.58, r: 0.34, z: 0.02 },
        { y: 0.84, r: 0.37, z: 0.01 },
        { y: 1.1, r: 0.38, z: 0.0 },
    ];
    const paths = [];
    for (let c = 0; c < cols; c++) {
        const a = (c / cols) * Math.PI * 2;
        const ca = Math.cos(a);
        const back = ca < 0 ? 0.72 : 1;
        const path = rows.map((row) => {
            const r = row.r * back;
            return v3(Math.sin(a) * r, row.y, ca * r + row.z);
        });
        paths.push(path);
    }
    paths.push(paths[0].map((p) => v3(p.x, p.y, p.z)));
    return paths;
}

function buildTunic(engine, scene) {
    const cloth = clothMat([0.16, 0.2, 0.26]);
    const root = createTransformNode("TunicRoot");
    const robe = stamp(scene, createRibbon(engine, { pathArray: tunicPaths() }), "TunicCloth", cloth);
    setParent(robe, root);
    return { root, meshes: [robe] };
}

const BUILDERS = {
    hood: buildHood,
    staff: buildStaff,
    cape: buildCape,
    tunic: buildTunic,
    sleeveL: (engine, scene) => buildSleeve(engine, scene, "SleeveL"),
    sleeveR: (engine, scene) => buildSleeve(engine, scene, "SleeveR"),
    sleeveForeL: (engine, scene) => buildForeSleeve(engine, scene, "SleeveForeL"),
    sleeveForeR: (engine, scene) => buildForeSleeve(engine, scene, "SleeveForeR"),
    bootL: (engine, scene) => buildBoot(engine, scene, "BootL"),
    bootR: (engine, scene) => buildBoot(engine, scene, "BootR"),
};

function eulerToQuat(x, y, z) {
    const cx = Math.cos(x * 0.5);
    const sx = Math.sin(x * 0.5);
    const cy = Math.cos(y * 0.5);
    const sy = Math.sin(y * 0.5);
    const cz = Math.cos(z * 0.5);
    const sz = Math.sin(z * 0.5);
    return {
        x: sx * cy * cz - cx * sy * sz,
        y: cx * sy * cz + sx * cy * sz,
        z: cx * cy * sz - sx * sy * cz,
        w: cx * cy * cz + sx * sy * sz,
    };
}

function applyLocal(node, local, glb) {
    const p = local?.position;
    const r = local?.rotation;
    node.position.set(p?.x ?? 0, p?.y ?? 0, p?.z ?? 0);
    if (node.rotation) {
        node.rotation.x = r?.x ?? 0;
        node.rotation.y = r?.y ?? 0;
        node.rotation.z = r?.z ?? 0;
    }
    const q = node.rotationQuaternion;
    if (q) {
        const eq = eulerToQuat(r?.x ?? 0, r?.y ?? 0, r?.z ?? 0);
        q.set(eq.x, eq.y, eq.z, eq.w);
    }
    if (node.scaling) {
        if (glb) {
            node.scaling.set(-1, 1, 1);
        } else {
            node.scaling.set(1, 1, 1);
        }
    }
}

function findTip(meshes) {
    return (meshes ?? []).find((mesh) => /crystal|tip|gem|flame/i.test(mesh.name || "")) ?? null;
}

function applyTint(visual, def) {
    const tint = def?.tint;
    const gem = def?.tintGem;
    if (!tint && !gem) {
        return;
    }
    for (const mesh of visual?.meshes ?? []) {
        const old = mesh.material;
        if (!old) {
            continue;
        }
        const name = `${mesh.name || ""} ${old.name || ""}`;
        if (gem && /crystal|gem|flame|tip/i.test(name)) {
            const gemMat = createPbrMaterial({
                baseColorFactor: [gem[0], gem[1], gem[2], 1],
                metallicFactor: 0.12,
                roughnessFactor: 0.28,
            });
            if ("emissiveColor" in gemMat) {
                gemMat.emissiveColor = gem;
            }
            if ("emissiveIntensity" in gemMat) {
                gemMat.emissiveIntensity = 2.2;
            }
            mesh.material = gemMat;
            continue;
        }
        if (tint && !/crystal|gem|metal|wood|void/i.test(name)) {
            mesh.material = createPbrMaterial({
                baseColorFactor: [tint[0], tint[1], tint[2], 1],
                metallicFactor: old.metallicFactor ?? 0.02,
                roughnessFactor: old.roughnessFactor ?? 0.86,
                doubleSided: true,
                baseColorTexture: old.baseColorTexture,
                normalTexture: old.normalTexture,
            });
        }
    }
}

function primitiveVisual(engine, scene, def) {
    const build = def.build || BUILDERS[def.id];
    if (!build) {
        throw new Error(`no primitive builder for ${def.id}`);
    }
    const visual = build(engine, scene);
    visual.source = "primitive";
    visual.tip = visual.tip ?? findTip(visual.meshes);
    return visual;
}

/**
 * loadGltf + addToScene + setParent onto a socket. Unskinned item GLBs are fine —
 * enableBoneControl already ran for the Mixamo body; this is not a second skeleton.
 * https://doc.babylonjs.com/lite/01-getting-started/
 * https://doc.babylonjs.com/lite/architecture/13-skeleton/
 */
async function loadVisual(engine, scene, def) {
    if (def.glb) {
        try {
            const container = await loadGltf(engine, def.glb);
            addToScene(scene, container);
            const root = container.entities?.[0];
            if (!root) {
                throw new Error("item glTF has no root");
            }
            root.name = `${def.id}Root`;
            const meshes = getContainerMeshes(container);
            for (const mesh of meshes) {
                mesh.receiveShadows = true;
            }
            const visual = {
                root,
                meshes,
                tip: findTip(meshes),
                source: "glb",
                container,
            };
            applyTint(visual, def);
            setTreeVisible(visual, false);
            return visual;
        } catch (err) {
            console.warn("item glb failed, primitive fallback", def.id, def.glb, err);
        }
    }
    const visual = primitiveVisual(engine, scene, def);
    setTreeVisible(visual, false);
    return visual;
}

/**
 * @param {{
 *   engine: object,
 *   scene: object,
 *   body: { skeleton?: object },
 *   sockets: { sockets: Record<string, { node: object, bone?: object }> },
 * }} opts
 */
export async function createEquipment(opts) {
    const { engine, scene, body, sockets } = opts;
    const worn = {
        head: null,
        back: null,
        torso: null,
        mainHand: null,
        offHand: null,
        leftArm: null,
        rightArm: null,
        leftForeArm: null,
        rightForeArm: null,
        leftFoot: null,
        rightFoot: null,
    };
    const cache = new Map();
    const loading = new Map();

    const hideHead = (on) => {
        const bone = sockets?.sockets?.head?.bone;
        if (body?.skeleton && bone) {
            setBoneVisible(body.skeleton, bone, !on);
        }
    };

    const hideLegs = (on) => {
        if (!body?.skeleton) {
            return;
        }
        for (const name of LEG_BONES) {
            const bone = getBoneByName(body.skeleton, name);
            if (bone) {
                setBoneVisible(body.skeleton, bone, !on);
            }
        }
    };

    const ensureVisual = (def) => {
        const hit = cache.get(def.id);
        if (hit) {
            return Promise.resolve(hit);
        }
        const pending = loading.get(def.id);
        if (pending) {
            return pending;
        }
        const job = loadVisual(engine, scene, def).then((visual) => {
            cache.set(def.id, visual);
            loading.delete(def.id);
            return visual;
        });
        loading.set(def.id, job);
        return job;
    };

    const attach = (slot, def, visual) => {
        const sock = sockets?.sockets?.[slot];
        if (!sock?.node || !visual?.root) {
            return null;
        }
        setParent(visual.root, sock.node);
        applyLocal(visual.root, def.local, visual.source === "glb");
        setTreeVisible(visual, true);
        worn[slot] = { item: def, visual };
        if (slot === "head") {
            hideHead(true);
        }
        if (slot === "torso") {
            hideLegs(true);
        }
        return worn[slot];
    };

    const unequip = (slot) => {
        const cur = worn[slot];
        if (!cur) {
            return null;
        }
        if (cur.visual) {
            setTreeVisible(cur.visual, false);
        }
        if (slot === "head") {
            hideHead(false);
        }
        if (slot === "torso") {
            hideLegs(false);
        }
        worn[slot] = null;
        return cur.item.id;
    };

    const equip = (slot, itemId) => {
        if (!SLOTS.includes(slot)) {
            return null;
        }
        const def = ITEMS[itemId];
        if (!def || def.slot !== slot) {
            return null;
        }
        const sock = sockets?.sockets?.[slot];
        if (!sock?.node) {
            return null;
        }
        if (worn[slot]?.item.id === itemId) {
            if (worn[slot].visual) {
                setTreeVisible(worn[slot].visual, true);
            }
            if (slot === "head") {
                hideHead(true);
            }
            if (slot === "torso") {
                hideLegs(true);
            }
            return worn[slot];
        }
        unequip(slot);
        const visual = cache.get(itemId);
        if (visual) {
            return attach(slot, def, visual);
        }
        worn[slot] = { item: def, visual: null };
        ensureVisual(def).then((loaded) => {
            if (worn[slot]?.item.id !== itemId) {
                setTreeVisible(loaded, false);
                return;
            }
            attach(slot, def, loaded);
        });
        return worn[slot];
    };

    const toggle = (slot, itemId) => {
        if (worn[slot]?.item.id === itemId) {
            unequip(slot);
            return null;
        }
        return equip(slot, itemId);
    };

    const label = () => {
        const helm = worn.head ? worn.head.item.name : "—";
        return `helm ${helm}  N toggle · U off`;
    };

    const wornMap = () => {
        const out = {};
        for (const slot of SLOTS) {
            out[slot] = worn[slot]?.item.id ?? null;
        }
        return out;
    };

    const sources = () => {
        const out = {};
        for (const [id, visual] of cache) {
            out[id] = visual.source;
        }
        return out;
    };

    await Promise.all(DEFAULT_LOADOUT.map(([, id]) => ensureVisual(ITEMS[id])));
    for (const [slot, id] of DEFAULT_LOADOUT) {
        equip(slot, id);
    }

    const update = () => {
        if (input.toggleHelm) {
            input.toggleHelm = false;
            toggle("head", "hood");
        }
        if (input.unequipHelm) {
            input.unequipHelm = false;
            unequip("head");
        }
    };

    console.log("equipment", { worn: wornMap(), sources: sources(), headHidden: !!worn.head });

    return {
        worn,
        items: ITEMS,
        slots: SLOTS,
        equip,
        unequip,
        toggle,
        update,
        label,
        wornMap,
        sources,
        get tip() {
            return worn.mainHand?.visual?.tip ?? null;
        },
        capeOk: false,
    };
}
