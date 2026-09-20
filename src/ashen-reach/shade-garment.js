/**
 * Procedural hood + cloak for churchyard shades.
 * Rigid meshes on the existing pose sockets (head / back) — no skinning.
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
} from "@babylonjs/lite";
import { attachSockets } from "../character/sockets.js";
import { cross, norm, sub } from "./geometry.js";

const CLOTH_COLOR = [0.20, 0.24, 0.15, 1];
const VOID_COLOR = [0.025, 0.03, 0.022, 1];

let clothMat = null;
let voidMat = null;

function clothMaterial() {
    if (clothMat) return clothMat;
    clothMat = createPbrMaterial({
        baseColorFactor: CLOTH_COLOR,
        roughnessFactor: 0.97,
        metallicFactor: 0,
        doubleSided: true,
        directIntensity: 0.38,
        environmentIntensity: 0.14,
        alpha: 0.92,
        alphaBlend: true,
    });
    setPbrEmissive(clothMat, [0.03, 0.042, 0.022]);
    return clothMat;
}

function voidMaterial() {
    if (voidMat) return voidMat;
    voidMat = createPbrMaterial({
        baseColorFactor: VOID_COLOR,
        roughnessFactor: 1,
        metallicFactor: 0,
        doubleSided: true,
        directIntensity: 0.08,
        environmentIntensity: 0.04,
        alpha: 0.97,
        alphaBlend: true,
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

/** Angle 0 is +Z (Mixamo face / character forward). */
function ring(y, radius, zOff, gap, segs) {
    const start = gap * Math.PI;
    const span = (2 - 2 * gap) * Math.PI;
    const pts = [];
    for (let i = 0; i <= segs; i++) {
        const a = start + (span * i) / segs;
        pts.push([
            radius * Math.sin(a),
            y,
            radius * Math.cos(a) + zOff,
        ]);
    }
    return pts;
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
 * Inner lining is the same shell, inset, so the opening reads as a dark cavity.
 */
function buildHood(engine, scene) {
    const segs = 10;
    const outerRings = [
        { y: -0.10, r: 0.15, z: 0.00, gap: 0.18 },
        { y: -0.02, r: 0.13, z: 0.03, gap: 0.38 },
        { y: 0.07, r: 0.135, z: 0.05, gap: 0.52 },
        { y: 0.15, r: 0.12, z: 0.055, gap: 0.42 },
        { y: 0.22, r: 0.07, z: 0.045, gap: 0.12 },
        { y: 0.255, r: 0.0, z: 0.035, gap: 0.0 },
    ];
    const outer = outerRings.map((row) => ring(row.y, row.r, row.z, row.gap, segs));
    const inner = outerRings.map((row) =>
        ring(row.y + 0.008, Math.max(0, row.r - 0.018), row.z - 0.006, row.gap, segs),
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
            cloth.commit(engine, scene, clothMaterial()),
            lining.commit(engine, scene, voidMaterial()),
        ].filter(Boolean),
        triangles: cloth.triangles + lining.triangles,
    };
}

/**
 * Cloak + long robe in Mixamo Spine2 space: +Y up the spine, +Z forward.
 * Front stays open at the chest so a punch can read; the hem wraps and tapers
 * so the mannequin feet never become the silhouette.
 */
function buildCloak(engine, scene) {
    const segs = 12;
    const rows = [
        { y: 0.22, r: 0.15, z: -0.02, gap: 0.20 },
        { y: 0.10, r: 0.26, z: -0.05, gap: 0.30 },
        { y: -0.06, r: 0.27, z: -0.06, gap: 0.34 },
        { y: -0.32, r: 0.29, z: -0.04, gap: 0.16 },
        { y: -0.62, r: 0.30, z: -0.03, gap: 0.10 },
        { y: -0.92, r: 0.24, z: -0.02, gap: 0.08 },
        { y: -1.18, r: 0.14, z: 0.00, gap: 0.14 },
        { y: -1.36, r: 0.03, z: 0.00, gap: 0.22 },
    ];
    const rings = rows.map((row) => ring(row.y, row.r, row.z, row.gap, segs));
    const cloth = new Shell("ShadeCloak");
    for (let i = 0; i < rings.length - 1; i++) stitch(cloth, rings[i], rings[i + 1], false);
    const hem = rings[rings.length - 1];
    cap(cloth, hem, [0, rows[rows.length - 1].y - 0.02, 0], true);
    return {
        meshes: [cloth.commit(engine, scene, clothMaterial())].filter(Boolean),
        triangles: cloth.triangles,
    };
}

function park(mesh, socket, offset) {
    setParent(mesh, socket);
    mesh.position.set(offset[0], offset[1], offset[2]);
    if (mesh.rotationQuaternion) mesh.rotationQuaternion.set(0, 0, 0, 1);
    if (mesh.rotation) mesh.rotation.set(0, 0, 0);
    mesh.scaling.set(1, 1, 1);
}

const HIDDEN_BONES = [
    "mixamorig:LeftLeg",
    "mixamorig:RightLeg",
    "mixamorig:LeftFoot",
    "mixamorig:RightFoot",
    "mixamorig:LeftToeBase",
    "mixamorig:RightToeBase",
];

function hideLowerLegs(actor) {
    const skeletons = actor.container?.skeletons?.length
        ? actor.container.skeletons
        : [actor.skeleton];
    const hidden = [];
    for (const skeleton of skeletons) {
        if (!skeleton) continue;
        for (const name of HIDDEN_BONES) {
            const bone = getBoneByName(skeleton, name);
            if (!bone) continue;
            setBoneVisible(skeleton, bone, false);
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
export function attachShadeSilhouette(engine, scene, actor, { scale = 1 } = {}) {
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

    const hood = buildHood(engine, scene);
    const cloak = buildCloak(engine, scene);
    for (const mesh of hood.meshes) park(mesh, sockets.sockets.head.node, [0, 0.01, 0.02]);
    for (const mesh of cloak.meshes) park(mesh, sockets.sockets.back.node, [0, -0.04, -0.02]);
    const hiddenBones = hideLowerLegs(actor);
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
