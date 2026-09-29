/**
 * Offline glTF animation sampling and linear blend skinning.
 *
 * Why this exists: every fit metric in this repo so far measures the **rest pose**, and
 * `measure-shape-garment-fit.mjs` says so in its own header — a clean rest-pose result does
 * not prove a clean walk cycle. M007's open gate is fit under motion at body extremes, and
 * judging that from video frames is a visual call. This makes it a measurement.
 *
 * Skinning follows the glTF specification exactly: a vertex is transformed by the weighted
 * sum over its joints of `globalJointTransform * inverseBindMatrix`, with the mesh's own
 * global transform applied by the caller if it is not identity.
 * https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#skinning
 *
 * Deformation order matches the renderer: morph targets are composed into the position
 * *before* skinning, which is what Lite does (`MORPH_PRE_SKINNING` in
 * `lib/shader/fragments/morph-fragment-core.js`). Measuring them the other way round would
 * report a body the game never draws.
 *
 * Interpolation covers STEP, LINEAR and CUBICSPLINE. Rotations are slerped, and cubic
 * rotation output is normalised, as the specification requires.
 * https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#animations
 */
import {mat4, quat, vec3} from 'gl-matrix';

/** Local TRS of a node, as authored. */
function nodeTRS(node) {
    return {
        t: vec3.clone(node.getTranslation()),
        r: quat.clone(node.getRotation()),
        s: vec3.clone(node.getScale()),
    };
}

const lerpVec = (out, a, b, k) => vec3.lerp(out, a, b, k);

/** Sample one animation channel's output at `time`, honouring its interpolation. */
function sampleChannel(sampler, time, isRotation) {
    const input = sampler.getInput().getArray();
    const output = sampler.getOutput().getArray();
    const stride = output.length / input.length;
    const mode = sampler.getInterpolation();
    const components = mode === 'CUBICSPLINE' ? stride / 3 : stride;
    const read = (frame, block = 0) => {
        const base = frame * stride + (mode === 'CUBICSPLINE' ? block * components : 0);
        return Array.from(output.subarray(base, base + components));
    };
    const last = input.length - 1;
    if (time <= input[0]) return read(0, mode === 'CUBICSPLINE' ? 1 : 0);
    if (time >= input[last]) return read(last, mode === 'CUBICSPLINE' ? 1 : 0);
    let i = 0;
    while (i < last && input[i + 1] < time) i++;
    const t0 = input[i], t1 = input[i + 1], dt = t1 - t0;
    const k = dt > 0 ? (time - t0) / dt : 0;
    if (mode === 'STEP') return read(i, mode === 'CUBICSPLINE' ? 1 : 0);
    if (mode === 'CUBICSPLINE') {
        // p(k) = (2k^3-3k^2+1)v0 + dt(k^3-2k^2+k)b0 + (-2k^3+3k^2)v1 + dt(k^3-k^2)a1
        const v0 = read(i, 1), b0 = read(i, 2), a1 = read(i + 1, 0), v1 = read(i + 1, 1);
        const k2 = k * k, k3 = k2 * k;
        const out = v0.map((_, c) =>
            (2 * k3 - 3 * k2 + 1) * v0[c] + dt * (k3 - 2 * k2 + k) * b0[c]
            + (-2 * k3 + 3 * k2) * v1[c] + dt * (k3 - k2) * a1[c]);
        if (isRotation) quat.normalize(out, out);
        return out;
    }
    const a = read(i), b = read(i + 1);
    if (isRotation) {
        const out = quat.create();
        quat.slerp(out, a, b, k);
        return Array.from(out);
    }
    const out = vec3.create();
    lerpVec(out, a, b, k);
    return Array.from(out);
}

/**
 * Local TRS for every node, with `animation` applied at `time`.
 * Nodes the animation does not touch keep their authored transform.
 */
export function poseNodes(root, animation, time) {
    const pose = new Map();
    for (const node of root.listNodes()) pose.set(node, nodeTRS(node));
    if (!animation) return pose;
    for (const channel of animation.listChannels()) {
        const node = channel.getTargetNode();
        const sampler = channel.getSampler();
        if (!node || !sampler || !pose.has(node)) continue;
        const path = channel.getTargetPath();
        const value = sampleChannel(sampler, time, path === 'rotation');
        const entry = pose.get(node);
        if (path === 'translation') entry.t = vec3.fromValues(...value);
        else if (path === 'rotation') entry.r = quat.fromValues(...value);
        else if (path === 'scale') entry.s = vec3.fromValues(...value);
        // `weights` (morph animation) is deliberately ignored: these clips do not carry it,
        // and the shape weights under test are set by the creator, not by a clip.
    }
    return pose;
}

/** Duration of an animation, in seconds. */
export function animationDuration(animation) {
    let end = 0;
    for (const channel of animation.listChannels()) {
        const input = channel.getSampler()?.getInput()?.getArray();
        if (input?.length) end = Math.max(end, input[input.length - 1]);
    }
    return end;
}

/** Global matrix per node, resolved through the scene hierarchy. */
export function globalMatrices(root, pose) {
    const global = new Map();
    const local = node => {
        const {t, r, s} = pose.get(node);
        return mat4.fromRotationTranslationScale(mat4.create(), r, t, s);
    };
    const visit = (node, parent) => {
        const m = mat4.multiply(mat4.create(), parent, local(node));
        global.set(node, m);
        for (const child of node.listChildren()) visit(child, m);
    };
    for (const scene of root.listScenes()) for (const node of scene.listChildren()) visit(node, mat4.create());
    // Nodes outside any scene still need a matrix; treat them as roots.
    for (const node of root.listNodes()) if (!global.has(node)) visit(node, mat4.create());
    return global;
}

/**
 * `globalJointTransform * inverseBindMatrix` for a skin whose joints are posed by **another
 * file's** skeleton, matched by joint name.
 *
 * The refitted garments carry their own 65-joint skin and their own inverse binds but no
 * animation at all: at runtime the equipment loader hangs them on the body's skeleton. Posing
 * a garment with its own (unanimated) nodes while the body moves leaves the cloth in the rest
 * pose, which reports a body sliding out of a stationary garment as a fit defect. The joint
 * names are the shared contract between the two files, so they are what the lookup uses.
 *
 * @param {Map<string, mat4>} globalByName posed global matrices from the body
 */
export function jointMatricesFromNamed(skin, globalByName) {
    const joints = skin.listJoints();
    const ibm = skin.getInverseBindMatrices().getArray();
    const out = new Float32Array(joints.length * 16);
    const inverse = mat4.create(), product = mat4.create();
    const missing = [];
    for (let j = 0; j < joints.length; j++) {
        const name = joints[j].getName();
        const global = globalByName.get(name);
        if (!global) { missing.push(name); continue; }
        for (let c = 0; c < 16; c++) inverse[c] = ibm[j * 16 + c];
        mat4.multiply(product, global, inverse);
        out.set(product, j * 16);
    }
    if (missing.length) throw Error(`Garment joints absent from the body skeleton: ${missing.slice(0, 5).join(', ')}`);
    return out;
}

/** Posed global matrices keyed by node name, for driving another file's skin. */
export function globalMatricesByName(root, pose) {
    const byNode = globalMatrices(root, pose);
    const byName = new Map();
    for (const [node, m] of byNode) byName.set(node.getName(), m);
    return byName;
}

/** `globalJointTransform * inverseBindMatrix` for each joint, flattened. */
export function jointMatrices(skin, global) {
    const joints = skin.listJoints();
    const ibm = skin.getInverseBindMatrices().getArray();
    const out = new Float32Array(joints.length * 16);
    const inverse = mat4.create(), product = mat4.create();
    for (let j = 0; j < joints.length; j++) {
        for (let c = 0; c < 16; c++) inverse[c] = ibm[j * 16 + c];
        mat4.multiply(product, global.get(joints[j]) ?? mat4.create(), inverse);
        out.set(product, j * 16);
    }
    return out;
}

/**
 * Linear blend skinning. `positions` must already carry any morph displacement.
 * Weights are renormalised per vertex; an unweighted vertex keeps its position, which is
 * what the specification's default of joint 0 at weight 0 amounts to in practice.
 */
export function skinPositions(positions, jointsArr, weightsArr, matrices) {
    const count = positions.length / 3;
    const out = new Float32Array(positions.length);
    for (let v = 0; v < count; v++) {
        const x = positions[v * 3], y = positions[v * 3 + 1], z = positions[v * 3 + 2];
        let sx = 0, sy = 0, sz = 0, total = 0;
        for (let i = 0; i < 4; i++) {
            const w = weightsArr[v * 4 + i];
            if (!(w > 0)) continue;
            const m = jointsArr[v * 4 + i] * 16;
            sx += w * (matrices[m] * x + matrices[m + 4] * y + matrices[m + 8] * z + matrices[m + 12]);
            sy += w * (matrices[m + 1] * x + matrices[m + 5] * y + matrices[m + 9] * z + matrices[m + 13]);
            sz += w * (matrices[m + 2] * x + matrices[m + 6] * y + matrices[m + 10] * z + matrices[m + 14]);
            total += w;
        }
        if (total > 0) { out[v * 3] = sx / total; out[v * 3 + 1] = sy / total; out[v * 3 + 2] = sz / total; }
        else { out[v * 3] = x; out[v * 3 + 1] = y; out[v * 3 + 2] = z; }
    }
    return out;
}

/** Morph displacement applied before skinning, matching the renderer's order. */
export function applyMorph(positions, targets, weights) {
    const out = Float32Array.from(positions);
    targets.forEach((target, i) => {
        const w = weights[i];
        if (!w) return;
        const delta = target.getAttribute('POSITION')?.getArray();
        if (!delta) return;
        for (let c = 0; c < out.length; c++) out[c] += delta[c] * w;
    });
    return out;
}

/**
 * Self-check: skinning at the bind pose must reproduce the mesh exactly, because
 * `globalJointTransform * inverseBindMatrix` is the identity there. Any error in the
 * hierarchy walk, the joint order or the matrix convention shows up here rather than as a
 * plausible-looking wrong answer downstream.
 * @returns {number} the largest per-component deviation, in metres
 */
export function bindPoseResidual(root, skin, positions, jointsArr, weightsArr) {
    const matrices = jointMatrices(skin, globalMatrices(root, poseNodes(root, null, 0)));
    const skinned = skinPositions(positions, jointsArr, weightsArr, matrices);
    let worst = 0;
    for (let i = 0; i < positions.length; i++) worst = Math.max(worst, Math.abs(skinned[i] - positions[i]));
    return worst;
}
