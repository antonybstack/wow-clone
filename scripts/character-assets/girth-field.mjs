/**
 * The M004 girth field, shared by the body and by the garments that hang on it.
 *
 * All the Human assets - the body and all eight garments - are skinned to the same
 * 65-joint rest skeleton in the same metre space, verified by the M001 census. That is
 * what makes one field usable for all of them: the deformation is defined in bone space,
 * so a garment vertex 2 cm outside the chest moves exactly as the chest under it does.
 *
 * Two modes, because cloth and plate do not behave alike:
 *
 *  * `softDeltas` scales each vertex's offset from its bone axis, blended by the mesh's own
 *    skin weights. Continuous, seam-free, and correct for anything that drapes.
 *  * `rigidDeltas` computes one translation per *piece* from the same field and applies it
 *    whole, so a plate moves outward over a thicker torso without its own shape changing.
 *    A plate that scaled radially like cloth would bend, which is the thing M005 forbids.
 *
 * Neither mode moves a joint centre or a bone length: only the components perpendicular to
 * each bone axis are touched, so the bind, the inverse binds and every clip stay valid.
 *
 * glTF morph targets are additive displacement sets over the base attributes:
 * https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#morph-targets
 */
import {mat4} from 'gl-matrix';

/** Segment axis on this rig: joint -> the child joint whose rest direction is the axis. */
export const AXIS_TO = Object.freeze({
    'mixamorig:Hips': 'mixamorig:Spine',
    'mixamorig:Spine': 'mixamorig:Spine1',
    'mixamorig:Spine1': 'mixamorig:Spine2',
    'mixamorig:Spine2': 'mixamorig:Neck',
    'mixamorig:Neck': 'mixamorig:Head',
    'mixamorig:Head': 'mixamorig:HeadTop_End',
    'mixamorig:LeftShoulder': 'mixamorig:LeftArm',
    'mixamorig:RightShoulder': 'mixamorig:RightArm',
    'mixamorig:LeftArm': 'mixamorig:LeftForeArm',
    'mixamorig:RightArm': 'mixamorig:RightForeArm',
    'mixamorig:LeftForeArm': 'mixamorig:LeftHand',
    'mixamorig:RightForeArm': 'mixamorig:RightHand',
    'mixamorig:LeftHand': 'mixamorig:LeftHandMiddle1',
    'mixamorig:RightHand': 'mixamorig:RightHandMiddle1',
    'mixamorig:LeftUpLeg': 'mixamorig:LeftLeg',
    'mixamorig:RightUpLeg': 'mixamorig:RightLeg',
    'mixamorig:LeftLeg': 'mixamorig:LeftFoot',
    'mixamorig:RightLeg': 'mixamorig:RightFoot',
    'mixamorig:LeftFoot': 'mixamorig:LeftToeBase',
    'mixamorig:RightFoot': 'mixamorig:RightToeBase',
});

export function unit(v) {
    const n = Math.hypot(v[0], v[1], v[2]);
    return n > 1e-9 ? [v[0] / n, v[1] / n, v[2] / n] : null;
}

export function cross(a, b) {
    return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

/** The two unit axes of the plane perpendicular to `axis`: cross-width, then depth.
 *  Identical rule and ordering as `measure-makehuman-girth.py`, so ratio index 0 and 1
 *  always mean the same thing on both meshes. */
export function perpFrame(axis) {
    const along = axis[2];
    const residual = [-along * axis[0], -along * axis[1], 1 - along * axis[2]];
    const magnitude = Math.hypot(...residual);
    if (magnitude <= 0.25) return null;
    const e2 = unit(residual);
    return {e1: unit(cross(e2, axis)), e2, zResidual: magnitude};
}

/** Rest world transforms keyed by node name, in the mesh's own space.
 *  The skeleton sits under a 0.01-scaled RootNode while POSITION is already in metres,
 *  so the traversal has to include that scale for axes and vertices to share one space. */
export function restWorld(root) {
    const world = new Map();
    const visit = (node, parent) => {
        const local = mat4.fromRotationTranslationScale(mat4.create(),
            node.getRotation(), node.getTranslation(), node.getScale());
        const w = mat4.multiply(mat4.create(), parent, local);
        world.set(node.getName(), w);
        for (const child of node.listChildren()) visit(child, w);
    };
    for (const sceneChild of root.listScenes()[0].listChildren()) visit(sceneChild, mat4.create());
    return world;
}

/**
 * Per skin-joint-index: origin, axis, perpendicular frame and the measured ratios.
 * Joints with no measured segment get `null` and therefore contribute exactly zero,
 * which is what leaves fingers, toes, eyes and the head tip untouched.
 */
export function buildSegments(joints, world, girth) {
    const originOf = name => {
        const w = world.get(name);
        return w ? [w[12], w[13], w[14]] : null;
    };
    const segments = new Array(joints.length).fill(null);
    const used = [];
    joints.forEach((joint, index) => {
        const name = joint.getName();
        const row = girth.segments[name];
        const toName = AXIS_TO[name];
        if (!row || !toName) return;
        const from = originOf(name);
        const to = originOf(toName);
        if (!from || !to) throw Error(`Missing rest transform for ${name} -> ${toName}`);
        const axis = unit([to[0] - from[0], to[1] - from[1], to[2] - from[2]]);
        if (!axis) throw Error(`Degenerate rest axis for ${name}`);
        const frame = perpFrame(axis);
        if (!frame) throw Error(`No perpendicular frame for ${name}`);
        // A segment that drifted near world Z would silently rotate e1/e2 against the
        // measured axes, so fail loudly instead of applying width ratios to depth.
        if (frame.zResidual <= 0.4) {
            throw Error(`${name} runs too close to world Z (residual ${frame.zResidual.toFixed(3)})`);
        }
        segments[index] = {
            name, axisTo: toName, origin: from, axis, ...frame,
            ratios: {slender: row.slenderAxes, stout: row.stoutAxes},
        };
        used.push(name);
    });
    if (!used.length) throw Error('No measured segment matched a skin joint');
    return {segments, used};
}

/** Displacement of one point under one segment's ratios, ignoring blend weight. */
function segmentDisplacement(seg, target, px, py, pz) {
    const [r1, r2] = seg.ratios[target];
    const o = seg.origin;
    const rel = [px - o[0], py - o[1], pz - o[2]];
    const along = rel[0] * seg.axis[0] + rel[1] * seg.axis[1] + rel[2] * seg.axis[2];
    const perp = [rel[0] - along * seg.axis[0], rel[1] - along * seg.axis[1], rel[2] - along * seg.axis[2]];
    const c1 = perp[0] * seg.e1[0] + perp[1] * seg.e1[1] + perp[2] * seg.e1[2];
    const c2 = perp[0] * seg.e2[0] + perp[1] * seg.e2[1] + perp[2] * seg.e2[2];
    // Scaling only the two perpendicular components leaves the along-axis position
    // untouched, so segment lengths and every joint centre hold.
    const s1 = c1 * (r1 - 1), s2 = c2 * (r2 - 1);
    return [
        s1 * seg.e1[0] + s2 * seg.e2[0],
        s1 * seg.e1[1] + s2 * seg.e2[1],
        s1 * seg.e1[2] + s2 * seg.e2[2],
    ];
}

/** Cloth. Per-vertex displacement blended by the mesh's own skin weights. */
export function softShape(positions, jointsArr, weightsArr, segments, target) {
    const count = positions.length / 3;
    const shaped = Float32Array.from(positions);
    let moved = 0, maxDelta = 0, sumDelta = 0;
    for (let v = 0; v < count; v++) {
        const px = positions[v * 3], py = positions[v * 3 + 1], pz = positions[v * 3 + 2];
        let wsum = 0;
        for (let k = 0; k < 4; k++) wsum += weightsArr[v * 4 + k];
        if (wsum <= 0) continue;
        let dx = 0, dy = 0, dz = 0;
        for (let k = 0; k < 4; k++) {
            const w = weightsArr[v * 4 + k] / wsum;
            if (w <= 0) continue;
            const seg = segments[jointsArr[v * 4 + k]];
            if (!seg) continue;
            const d = segmentDisplacement(seg, target, px, py, pz);
            dx += w * d[0]; dy += w * d[1]; dz += w * d[2];
        }
        shaped[v * 3] += dx;
        shaped[v * 3 + 1] += dy;
        shaped[v * 3 + 2] += dz;
        const m = Math.hypot(dx, dy, dz);
        if (m > 1e-6) moved++;
        sumDelta += m;
        if (m > maxDelta) maxDelta = m;
    }
    return {shaped, moved, maxDelta, meanDelta: sumDelta / count};
}

/**
 * Plate. One rigid translation for the whole piece, taken as the skin-weighted mean of the
 * displacement its own vertices would have received. The piece therefore follows a thicker
 * or thinner body outward without changing its own shape: no bending, no shear, no scale.
 */
export function rigidShape(positions, jointsArr, weightsArr, segments, target) {
    const count = positions.length / 3;
    let ax = 0, ay = 0, az = 0, total = 0;
    for (let v = 0; v < count; v++) {
        const px = positions[v * 3], py = positions[v * 3 + 1], pz = positions[v * 3 + 2];
        let wsum = 0;
        for (let k = 0; k < 4; k++) wsum += weightsArr[v * 4 + k];
        if (wsum <= 0) continue;
        for (let k = 0; k < 4; k++) {
            const w = weightsArr[v * 4 + k] / wsum;
            if (w <= 0) continue;
            const seg = segments[jointsArr[v * 4 + k]];
            if (!seg) continue;
            const d = segmentDisplacement(seg, target, px, py, pz);
            ax += w * d[0]; ay += w * d[1]; az += w * d[2];
            total += w;
        }
    }
    const offset = total > 0 ? [ax / total, ay / total, az / total] : [0, 0, 0];
    const shaped = Float32Array.from(positions);
    for (let v = 0; v < count; v++) {
        shaped[v * 3] += offset[0];
        shaped[v * 3 + 1] += offset[1];
        shaped[v * 3 + 2] += offset[2];
    }
    const m = Math.hypot(...offset);
    return {shaped, moved: m > 1e-6 ? count : 0, maxDelta: m, meanDelta: m, offset};
}

export function recomputeNormals(positions, indices, count) {
    const normals = new Float32Array(count * 3);
    for (let t = 0; t < indices.length; t += 3) {
        const a = indices[t] * 3, b = indices[t + 1] * 3, c = indices[t + 2] * 3;
        const ux = positions[b] - positions[a], uy = positions[b + 1] - positions[a + 1], uz = positions[b + 2] - positions[a + 2];
        const vx = positions[c] - positions[a], vy = positions[c + 1] - positions[a + 1], vz = positions[c + 2] - positions[a + 2];
        const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
        for (const o of [a, b, c]) {
            normals[o] += nx; normals[o + 1] += ny; normals[o + 2] += nz;
        }
    }
    for (let i = 0; i < normals.length; i += 3) {
        const n = Math.hypot(normals[i], normals[i + 1], normals[i + 2]);
        if (n > 1e-9) { normals[i] /= n; normals[i + 1] /= n; normals[i + 2] /= n; }
    }
    return normals;
}

/**
 * Reference fit: move a garment by the body's displacement, not by its own.
 *
 * Applying the girth field directly to a garment scales that vertex's own offset from the
 * bone axis, and a garment sits at a larger radius than the skin under it. Stout therefore
 * pushes the cloth further out than the body moves, which is harmless, but slender pulls it
 * in further than the body recedes, which drives the cloth *into* the skin. Measured on the
 * Wayfarer trousers, the direct field turned 11 newly uncovered body vertices into 24.
 *
 * Tracking instead moves each garment vertex by the displacement of the body surface
 * beneath it, so the standoff distance the garment was authored with is preserved in both
 * directions. The body sample is the inverse-distance-weighted mean of the `k` nearest body
 * vertices, which keeps the field smooth across the garment rather than faceted per source
 * vertex.
 *
 * It is a fit, not a simulation: it preserves standoff, and it does not resolve a garment
 * that was already intersecting or add slack where a shape needs new material.
 */
export function trackBodyShape(positions, bodyPositions, bodyDeltas, {k = 8} = {}) {
    const count = positions.length / 3;
    const bodyCount = bodyPositions.length / 3;
    const shaped = Float32Array.from(positions);
    const bestIdx = new Int32Array(k);
    const bestSq = new Float64Array(k);
    let moved = 0, maxDelta = 0, sumDelta = 0;
    for (let v = 0; v < count; v++) {
        const px = positions[v * 3], py = positions[v * 3 + 1], pz = positions[v * 3 + 2];
        bestSq.fill(Infinity);
        bestIdx.fill(-1);
        for (let b = 0; b < bodyCount; b++) {
            const dx = px - bodyPositions[b * 3];
            const dy = py - bodyPositions[b * 3 + 1];
            const dz = pz - bodyPositions[b * 3 + 2];
            const d2 = dx * dx + dy * dy + dz * dz;
            if (d2 >= bestSq[k - 1]) continue;
            let i = k - 1;
            while (i > 0 && bestSq[i - 1] > d2) { bestSq[i] = bestSq[i - 1]; bestIdx[i] = bestIdx[i - 1]; i--; }
            bestSq[i] = d2;
            bestIdx[i] = b;
        }
        let wx = 0, wy = 0, wz = 0, total = 0;
        for (let i = 0; i < k; i++) {
            const b = bestIdx[i];
            if (b < 0) continue;
            // Inverse distance, floored so a garment vertex sitting on a body vertex does
            // not take that one sample alone and produce a visible facet.
            const w = 1 / Math.max(1e-4, Math.sqrt(bestSq[i]));
            wx += w * bodyDeltas[b * 3];
            wy += w * bodyDeltas[b * 3 + 1];
            wz += w * bodyDeltas[b * 3 + 2];
            total += w;
        }
        if (total <= 0) continue;
        const dx = wx / total, dy = wy / total, dz = wz / total;
        shaped[v * 3] += dx;
        shaped[v * 3 + 1] += dy;
        shaped[v * 3 + 2] += dz;
        const m = Math.hypot(dx, dy, dz);
        if (m > 1e-6) moved++;
        sumDelta += m;
        if (m > maxDelta) maxDelta = m;
    }
    return {shaped, moved, maxDelta, meanDelta: sumDelta / count};
}

/**
 * Rigid pieces under a reference fit: one uniform scale and translation per piece.
 *
 * Two earlier versions were wrong and the render showed it. A single *translation* for the
 * whole mesh sank the pauldrons into the stout shoulder, because one offset vector cannot
 * keep a cap-shaped plate clear of flesh inflating by up to 34% in every direction. Fitting
 * a single *similarity* to the whole mesh was no better: a left and a right pauldron move
 * in opposite directions along X, so one transform can only express the part of the motion
 * they share, and the fit came back as a 3.5% scale and a vertical shift.
 *
 * Each rigidly weighted piece is its own rigid body, so each gets its own transform.
 * Grouping by the vertex's primary joint is exact for this weighting -- a rigid piece is
 * defined by having one bone at full weight -- and needs no connectivity walk.
 *
 * A similarity is still rigid in the sense that matters: every angle is preserved and no
 * part of a piece bends relative to any other. It is the same plate at a different size,
 * which is what armour sizing is. Only non-uniform deformation would be cloth behaviour.
 *
 * With centred points p and tracked targets q, s = sum(p . q) / sum(p . p) and
 * t = mean(q) - s * mean(p).
 */
export function trackBodyRigid(positions, bodyPositions, bodyDeltas, {jointsArr, weightsArr, ...options} = {}) {
    const tracked = trackBodyShape(positions, bodyPositions, bodyDeltas, options);
    const count = positions.length / 3;

    // Group by primary joint: one group per rigid piece.
    const groups = new Map();
    for (let v = 0; v < count; v++) {
        let primary = -1, best = -1;
        for (let k = 0; k < 4; k++) {
            const w = weightsArr ? weightsArr[v * 4 + k] : (k === 0 ? 1 : 0);
            if (w > best) { best = w; primary = jointsArr ? jointsArr[v * 4 + k] : 0; }
        }
        const key = primary;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(v);
    }

    const shaped = Float32Array.from(positions);
    const fits = [];
    let maxDelta = 0, sumDelta = 0, moved = 0;
    for (const [joint, members] of groups) {
        let px = 0, py = 0, pz = 0, qx = 0, qy = 0, qz = 0;
        for (const v of members) {
            px += positions[v * 3]; py += positions[v * 3 + 1]; pz += positions[v * 3 + 2];
            qx += tracked.shaped[v * 3]; qy += tracked.shaped[v * 3 + 1]; qz += tracked.shaped[v * 3 + 2];
        }
        const n = members.length;
        px /= n; py /= n; pz /= n; qx /= n; qy /= n; qz /= n;
        let dot = 0, norm = 0;
        for (const v of members) {
            const ax = positions[v * 3] - px, ay = positions[v * 3 + 1] - py, az = positions[v * 3 + 2] - pz;
            const bx = tracked.shaped[v * 3] - qx, by = tracked.shaped[v * 3 + 1] - qy, bz = tracked.shaped[v * 3 + 2] - qz;
            dot += ax * bx + ay * by + az * bz;
            norm += ax * ax + ay * ay + az * az;
        }
        const scale = norm > 1e-12 ? dot / norm : 1;
        const offset = [qx - scale * px, qy - scale * py, qz - scale * pz];
        for (const v of members) {
            for (let a = 0; a < 3; a++) shaped[v * 3 + a] = scale * positions[v * 3 + a] + offset[a];
            const m = Math.hypot(shaped[v * 3] - positions[v * 3],
                shaped[v * 3 + 1] - positions[v * 3 + 1],
                shaped[v * 3 + 2] - positions[v * 3 + 2]);
            if (m > 1e-6) moved++;
            sumDelta += m;
            if (m > maxDelta) maxDelta = m;
        }
        fits.push({joint, vertices: n, scale: Number(scale.toFixed(6)), offset: offset.map(v => Number(v.toFixed(6)))});
    }
    return {shaped, moved, maxDelta, meanDelta: sumDelta / count, fits};
}
