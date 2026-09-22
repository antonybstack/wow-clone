/**
 * Procedural hood + cloak for churchyard shades.
 * Rigid meshes on the existing pose sockets (head / back) — no skinning.
 * Silhouette is a cowl (head), a shoulder shelf, then a tapering robe.
 */
import {
    addToScene,
    createMeshFromData,
    createPbrMaterial,
    createTransformNode,
    getBoneByName,
    setParent,
    setPbrEmissive,
    setBoneVisible,
    setMeshVisible,
} from "@babylonjs/lite";

export { setMeshVisible };
import { attachSockets } from "../character/sockets.js";
import { cross, norm, sub } from "./geometry.js";

/** Darker and dimmer than SHADE_TINT so the peat-mist body reads in the cowl. */
const CLOTH_COLOR = [0.04, 0.05, 0.032, 1];
const VOID_COLOR = [0.01, 0.012, 0.008, 1];

const clothMats = new Map();
let voidMat = null;

function clothMaterial(color = CLOTH_COLOR, emissive = [0.01, 0.014, 0.008]) {
    const key = color.join(",") + "|" + emissive.join(",");
    const cached = clothMats.get(key);
    if (cached) return cached;
    const mat = createPbrMaterial({
        baseColorFactor: color,
        roughnessFactor: 0.94,
        metallicFactor: 0,
        doubleSided: true,
        directIntensity: 0.55,
        environmentIntensity: 0.14,
        alpha: 1,
        alphaBlend: false,
    });
    setPbrEmissive(mat, emissive);
    clothMats.set(key, mat);
    return mat;
}

function voidMaterial() {
    if (voidMat) return voidMat;
    voidMat = createPbrMaterial({
        baseColorFactor: VOID_COLOR,
        roughnessFactor: 1,
        metallicFactor: 0,
        doubleSided: true,
        directIntensity: 0.06,
        environmentIntensity: 0.03,
        alpha: 1,
        alphaBlend: false,
    });
    setPbrEmissive(voidMat, [0.01, 0.014, 0.008]);
    return voidMat;
}

class Shell {
    constructor(name) {
        this.name = name;
        this.p = [];
        this.n = [];
        this.u = [];
        this.idx = [];
    }

    tri(a, b, c) {
        const n = norm(cross(sub(b, a), sub(c, a)));
        const base = this.p.length / 3;
        for (const v of [a, b, c]) {
            this.p.push(v[0], v[1], v[2]);
            this.n.push(n[0], n[1], n[2]);
            this.u.push(0, 0);
        }
        this.idx.push(base, base + 1, base + 2);
    }

    quad(a, b, c, d) {
        this.tri(a, b, c);
        this.tri(a, c, d);
    }

    get triangles() {
        return this.idx.length / 3;
    }

    commit(engine, scene, material) {
        if (!this.idx.length) return null;
        const mesh = createMeshFromData(
            engine,
            this.name,
            new Float32Array(this.p),
            new Float32Array(this.n),
            new Uint32Array(this.idx),
            new Float32Array(this.u),
        );
        mesh.material = material;
        mesh.pickable = false;
        mesh.receiveShadows = false;
        addToScene(scene, mesh);
        return mesh;
    }
}

/** Angle 0 is +Z (Mixamo face / character forward).
 *  `fold` is a 0–1 pleat amplitude; eight longitudinal ridges break the barrel. */
function ring(y, rx, rz, zOff, gap, segs, fold = 0) {
    const start = gap * Math.PI;
    const span = (2 - 2 * gap) * Math.PI;
    const pts = [];
    for (let i = 0; i <= segs; i++) {
        const a = start + (span * i) / segs;
        const pleat = 1 + fold * Math.sin(a * 8 + 0.35);
        pts.push([
            rx * Math.sin(a) * pleat,
            y,
            rz * Math.cos(a) * pleat + zOff,
        ]);
    }
    return pts;
}

function ringsFrom(rows, segs) {
    return rows.map((row) =>
        ring(
            row.y,
            row.rx ?? row.r,
            row.rz ?? row.r * 0.72,
            row.z,
            row.gap,
            segs,
            row.fold ?? 0,
        ),
    );
}

function stitch(shell, a, b, closeEnds = true) {
    const n = Math.min(a.length, b.length) - 1;
    for (let i = 0; i < n; i++) shell.quad(a[i], a[i + 1], b[i + 1], b[i]);
    if (closeEnds && a.length > 1 && b.length > 1) {
        shell.quad(a[0], b[0], b[b.length - 1], a[a.length - 1]);
    }
}

function cap(shell, pts, center, flip = false) {
    for (let i = 0; i < pts.length - 1; i++) {
        if (flip) shell.tri(center, pts[i + 1], pts[i]);
        else shell.tri(center, pts[i], pts[i + 1]);
    }
}

/**
 * Hood in Mixamo Head space: +Y through the crown, +Z out the face.
 * Skull-sized cowl with a face cavity — not a shoulder-width cap.
 * Inner lining is the same shell, inset, so the opening reads as a dark hole.
 */
function buildHood(engine, scene, robe) {
    const segs = 10;
    const outerRings = [
        { y: -0.12, rx: 0.10, rz: 0.09, z: 0.00, gap: 0.22, fold: 0.04 },
        { y: -0.03, rx: 0.12, rz: 0.11, z: 0.04, gap: 0.38, fold: 0.05 },
        { y: 0.05, rx: 0.11, rz: 0.10, z: 0.06, gap: 0.52, fold: 0.04 },
        { y: 0.11, rx: 0.09, rz: 0.08, z: 0.04, gap: 0.28, fold: 0.03 },
        { y: 0.155, rx: 0.05, rz: 0.045, z: 0.02, gap: 0.08, fold: 0.0 },
        { y: 0.17, rx: 0.012, rz: 0.012, z: 0.01, gap: 0.0, fold: 0.0 },
    ];
    const outer = ringsFrom(outerRings, segs);
    const inner = outerRings.map((row) =>
        ring(
            row.y + 0.008,
            Math.max(0, row.rx - 0.016),
            Math.max(0, row.rz - 0.014),
            row.z - 0.006,
            row.gap,
            segs,
            row.fold ?? 0,
        ),
    );

    const cloth = new Shell("ShadeHood");
    for (let i = 0; i < outer.length - 1; i++) stitch(cloth, outer[i], outer[i + 1], false);
    for (let i = 0; i < segs; i++) {
        cloth.quad(outer[0][i], inner[0][i], inner[0][i + 1], outer[0][i + 1]);
    }
    for (let i = 0; i < outer.length - 1; i++) {
        const k = outer[i].length - 1;
        cloth.quad(outer[i][0], inner[i][0], inner[i + 1][0], outer[i + 1][0]);
        cloth.quad(inner[i][k], outer[i][k], outer[i + 1][k], inner[i + 1][k]);
    }

    const lining = new Shell("ShadeHoodVoid");
    for (let i = 0; i < inner.length - 1; i++) stitch(lining, inner[i + 1], inner[i], false);
    cap(lining, inner[inner.length - 2], inner[inner.length - 1][0], true);
    const voidCenter = [0, 0.08, 0.01];
    cap(lining, inner[2], voidCenter, false);

    return {
        meshes: [
            cloth.commit(engine, scene, robe),
            lining.commit(engine, scene, voidMaterial()),
        ].filter(Boolean),
        triangles: cloth.triangles + lining.triangles,
    };
}

/**
 * Cloak + long robe in Mixamo Spine2 space: +Y up the spine, +Z forward.
 * Collar sits under the cowl; the shoulder ring is the widest station, then
 * the robe tapers. Same 8×12 topology as round 1 (180 tris).
 */
function buildCloak(engine, scene, robe) {
    const segs = 12;
    const rows = [
        { y: 0.08, rx: 0.12, rz: 0.08, z: -0.01, gap: 0.22, fold: 0.04 },
        { y: 0.00, rx: 0.24, rz: 0.10, z: -0.03, gap: 0.16, fold: 0.08 },
        { y: -0.18, rx: 0.19, rz: 0.11, z: -0.03, gap: 0.12, fold: 0.12 },
        { y: -0.42, rx: 0.17, rz: 0.11, z: -0.02, gap: 0.10, fold: 0.14 },
        { y: -0.68, rx: 0.15, rz: 0.10, z: -0.01, gap: 0.08, fold: 0.12 },
        { y: -0.92, rx: 0.13, rz: 0.09, z: 0.00, gap: 0.08, fold: 0.09 },
        { y: -1.10, rx: 0.09, rz: 0.07, z: 0.00, gap: 0.10, fold: 0.06 },
        { y: -1.16, rx: 0.05, rz: 0.04, z: 0.00, gap: 0.14, fold: 0.03 },
    ];
    const rings = ringsFrom(rows, segs);
    const cloth = new Shell("ShadeCloak");
    for (let i = 0; i < rings.length - 1; i++) stitch(cloth, rings[i], rings[i + 1], false);
    const hem = rings[rings.length - 1];
    cap(cloth, hem, [0, rows[rows.length - 1].y - 0.02, 0], true);
    return {
        meshes: [cloth.commit(engine, scene, robe)].filter(Boolean),
        triangles: cloth.triangles,
    };
}

function park(mesh, socket, offset) {
    setParent(mesh, socket);
    mesh.position.set(offset[0], offset[1], offset[2]);
    // Head/back sockets arrive with a half-turn about Z (RH_TO_LH on the Mixamo
    // joint). Counter-rotate so authored +Y stays world-up and the cloak falls.
    // 180° about X = 180° Z (socket RH_TO_LH, so authored +Y falls) then
    // 180° Y (hood opening faces character forward, not the back of the skull).
    if (mesh.rotationQuaternion) mesh.rotationQuaternion.set(1, 0, 0, 0);
    if (mesh.rotation) mesh.rotation.set(Math.PI, 0, 0);
    mesh.scaling.set(1, 1, 1);
}

const HIDDEN_BONES = [
    "mixamorig:LeftArm",
    "mixamorig:RightArm",
    "mixamorig:LeftForeArm",
    "mixamorig:RightForeArm",
    "mixamorig:LeftHand",
    "mixamorig:RightHand",
    "mixamorig:LeftLeg",
    "mixamorig:RightLeg",
    "mixamorig:LeftFoot",
    "mixamorig:RightFoot",
    "mixamorig:LeftToeBase",
    "mixamorig:RightToeBase",
];

/**
 * Collapse limbs the rigid robe covers. Mixamo base.glb is two skins
 * (Alpha_Surface + Alpha_Joints), so container.skeletons has two handles.
 * setBoneVisible is asset-wide and re-bakes every skin, but each handle
 * still lists the same six/twelve names — record each name once.
 *
 * Arms are hidden rather than sleeved: the garment is a socket mesh, so a
 * sleeve cannot follow Punch_Cross, and a wider drape still leaked the idle
 * swing. Spine2 still turns with the punch, which is the cloak's motion.
 */
function hideCoveredLimbs(actor) {
    const skeletons = actor.container?.skeletons?.length
        ? actor.container.skeletons
        : [actor.skeleton];
    const hidden = [];
    const seen = new Set();
    for (const skeleton of skeletons) {
        if (!skeleton) continue;
        for (const name of HIDDEN_BONES) {
            const bone = getBoneByName(skeleton, name);
            if (!bone) continue;
            setBoneVisible(skeleton, bone, false);
            if (seen.has(name)) continue;
            seen.add(name);
            hidden.push(name);
        }
    }
    return hidden;
}

function yawQuaternion(yaw) {
    return [0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)];
}

/**
 * Reparent the Mixamo root under an unscaled-identity host that carries the
 * enemy's world pose, then hang a hood and cloak on attachSockets. Root local
 * scale stays (-1, 1, 1) so socket sync does not double-apply enemy scale.
 */
export function attachShadeSilhouette(engine, scene, actor, { scale = 1, cloth } = {}) {
    const root = actor.root;
    const yaw = root.rotation?.y ?? 0;
    const [qx, qy, qz, qw] = yawQuaternion(yaw);
    const host = createTransformNode(
        `${root.name}Anchor`,
        root.position.x,
        root.position.y,
        root.position.z,
        qx,
        qy,
        qz,
        qw,
        scale,
        scale,
        scale,
    );
    addToScene(scene, host);
    setParent(root, host);
    root.position.set(0, 0, 0);
    if (root.rotation) root.rotation.set(0, 0, 0);
    if (root.rotationQuaternion) root.rotationQuaternion.set(0, 0, 0, 1);
    root.scaling.set(-1, 1, 1);

    const sockets = attachSockets(
        engine,
        scene,
        { body: host, capsuleHeight: 1.68 },
        {
            skeleton: actor.skeleton,
            root,
            animationGroups: actor.container.animationGroups,
        },
    );

    const bound = {
        head: sockets.sockets.head?.bone?.name || null,
        back: sockets.sockets.back?.bone?.name || null,
        skinned: sockets.skinned?.name || null,
    };
    if (!bound.head || !bound.back) {
        console.warn("shade silhouette: sockets did not bind", bound);
        return {
            host,
            sockets,
            meshes: [],
            triangles: 0,
            bound,
            hiddenBones: [],
            sync() {
                sockets.sync();
            },
        };
    }

    const robe = clothMaterial(cloth?.color, cloth?.emissive);
    const hood = buildHood(engine, scene, robe);
    const cloak = buildCloak(engine, scene, robe);
    for (const mesh of hood.meshes) park(mesh, sockets.sockets.head.node, [0, 0.0, 0.01]);
    for (const mesh of cloak.meshes) park(mesh, sockets.sockets.back.node, [0, -0.06, -0.03]);
    const hiddenBones = hideCoveredLimbs(actor);
    sockets.sync();

    const meshes = [...hood.meshes, ...cloak.meshes];
    return {
        host,
        sockets,
        meshes,
        triangles: hood.triangles + cloak.triangles,
        bound,
        hiddenBones,
        sync() {
            sockets.sync();
        },
    };
}
