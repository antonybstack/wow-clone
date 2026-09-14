/**
 * Shared lite VFX helpers — emissive PBR meshes, no custom WGSL.
 */
import {
    addToScene,
    createPbrMaterial,
    setMeshVisible,
    setPbrEmissive,
} from "@babylonjs/lite";

export function createVoidMaterial({
    color = [0.07, 0.02, 0.12],
    emissive = [0.55, 0.16, 1.05],
    alpha = 1,
} = {}) {
    const mat = createPbrMaterial({
        baseColorFactor: [color[0], color[1], color[2], alpha],
        metallicFactor: 0.08,
        roughnessFactor: 0.38,
        doubleSided: true,
        alpha,
        alphaBlend: alpha < 0.999,
        environmentIntensity: 0.12,
        directIntensity: 0.18,
    });
    setPbrEmissive(mat, emissive);
    return mat;
}

export function stampMesh(mesh, name, material) {
    mesh.name = name;
    mesh.material = material;
    mesh.receiveShadows = false;
    mesh.visible = false;
    return mesh;
}

export function addHidden(scene, mesh) {
    mesh.visible = false;
    addToScene(scene, mesh);
    return mesh;
}

export function show(mesh, visible) {
    if (mesh) {
        setMeshVisible(mesh, !!visible);
    }
}

export function setPos(mesh, x, y, z) {
    mesh.position.x = x;
    mesh.position.y = y;
    mesh.position.z = z;
}

export function setScale(mesh, x, y, z) {
    mesh.scaling.x = x;
    mesh.scaling.y = y;
    mesh.scaling.z = z;
}

export function setYaw(mesh, yaw) {
    mesh.rotation.y = yaw;
}

/** Align local +Y with a world direction. */
export function alignY(mesh, dx, dy, dz) {
    const len = Math.hypot(dx, dy, dz) || 1;
    dx /= len;
    dy /= len;
    dz /= len;
    const q = mesh.rotationQuaternion;
    const dot = dy;
    if (dot > 0.9995) {
        q.x = 0;
        q.y = 0;
        q.z = 0;
        q.w = 1;
        return;
    }
    if (dot < -0.9995) {
        q.x = 1;
        q.y = 0;
        q.z = 0;
        q.w = 0;
        return;
    }
    let qx = dz;
    let qy = 0;
    let qz = -dx;
    let qw = 1 + dot;
    const ql = Math.hypot(qx, qy, qz, qw) || 1;
    q.x = qx / ql;
    q.y = qy / ql;
    q.z = qz / ql;
    q.w = qw / ql;
}

export function clamp01(t) {
    return t < 0 ? 0 : t > 1 ? 1 : t;
}

export function smooth01(t) {
    t = clamp01(t);
    return t * t * (3 - 2 * t);
}

export function translation(matrix, out) {
    out.x = matrix[12];
    out.y = matrix[13];
    out.z = matrix[14];
    return out;
}

export function feetOf(player) {
    const p = player.body.position;
    return {
        x: p.x,
        y: p.y - player.capsuleHeight * 0.5,
        z: p.z,
    };
}

const _tip = { x: 0, y: 0, z: 0 };

/**
 * Staff tip in world space.
 * Skinned HeroStaffTip/HeroFlame nodes report the capsule origin as worldMatrix,
 * so only trust a matrix that sits above the chest; otherwise aim from the right hand.
 */
export function staffOrigin(hero, player, out = _tip) {
    const body = player.body.position;
    const yaw = player.getFacing();
    const fx = Math.sin(yaw);
    const fz = Math.cos(yaw);
    const rx = Math.cos(yaw);
    const rz = -Math.sin(yaw);
    const tip = hero?.tip;
    const m = tip?.worldMatrix;
    if (m && m.length >= 16 && m[13] > body.y + 0.2) {
        return translation(m, out);
    }
    out.x = body.x + fx * 0.14 + rx * 0.34;
    out.y = body.y + 0.78;
    out.z = body.z + fz * 0.14 + rz * 0.34;
    return out;
}
