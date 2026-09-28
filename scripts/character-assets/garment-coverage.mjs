/** How far the outward normal ray looks for cloth. */
export const COVER_M = 0.06;
const REJECT_SQ = 0.09;

/**
 * Garment coverage geometry, shared by the M005 fit measurement and the hem pass.
 *
 * A body vertex counts as *covered* by a garment when a short ray along its own outward
 * normal hits that garment's cloth. That single definition is what the measurement scores
 * and what the hem pass tries to satisfy, so they are the same question asked twice rather
 * than two approximations that might disagree.
 *
 * These helpers were measured into their current form against the neutral body, which is
 * the control: any rule that reports the shipped, visibly correct configuration as broken
 * is wrong. See the M005 result for the two rules that failed that control.
 */

/** Moller-Trumbore, two-sided: cloth shells are not reliably wound outward.
 *  https://dl.acm.org/doi/10.1080/10867651.1997.10487468 */
export function rayHitsTriangle(ox, oy, oz, dx, dy, dz, maxT, ax, ay, az, bx, by, bz, cx, cy, cz) {
    const e1x = bx - ax, e1y = by - ay, e1z = bz - az;
    const e2x = cx - ax, e2y = cy - ay, e2z = cz - az;
    const px = dy * e2z - dz * e2y, py = dz * e2x - dx * e2z, pz = dx * e2y - dy * e2x;
    const det = e1x * px + e1y * py + e1z * pz;
    if (Math.abs(det) < 1e-12) return false;
    const inv = 1 / det;
    const tx = ox - ax, ty = oy - ay, tz = oz - az;
    const u = (tx * px + ty * py + tz * pz) * inv;
    if (u < 0 || u > 1) return false;
    const qx = ty * e1z - tz * e1y, qy = tz * e1x - tx * e1z, qz = tx * e1y - ty * e1x;
    const v = (dx * qx + dy * qy + dz * qz) * inv;
    if (v < 0 || u + v > 1) return false;
    const t = (e2x * qx + e2y * qy + e2z * qz) * inv;
    return t > 1e-5 && t <= maxT;
}

/** Squared distance from a point to a triangle. Ericson, Real-Time Collision Detection 5.1.5. */
export function distanceToTriangle(px, py, pz, ax, ay, az, bx, by, bz, cx, cy, cz) {
    const abx = bx - ax, aby = by - ay, abz = bz - az;
    const acx = cx - ax, acy = cy - ay, acz = cz - az;
    const apx = px - ax, apy = py - ay, apz = pz - az;
    const d1 = abx * apx + aby * apy + abz * apz;
    const d2 = acx * apx + acy * apy + acz * apz;
    let qx, qy, qz;
    if (d1 <= 0 && d2 <= 0) { qx = ax; qy = ay; qz = az; }
    else {
        const bpx = px - bx, bpy = py - by, bpz = pz - bz;
        const d3 = abx * bpx + aby * bpy + abz * bpz;
        const d4 = acx * bpx + acy * bpy + acz * bpz;
        if (d3 >= 0 && d4 <= d3) { qx = bx; qy = by; qz = bz; }
        else {
            const vc = d1 * d4 - d3 * d2;
            if (vc <= 0 && d1 >= 0 && d3 <= 0) {
                const v = d1 / (d1 - d3);
                qx = ax + abx * v; qy = ay + aby * v; qz = az + abz * v;
            } else {
                const cpx = px - cx, cpy = py - cy, cpz = pz - cz;
                const d5 = abx * cpx + aby * cpy + abz * cpz;
                const d6 = acx * cpx + acy * cpy + acz * cpz;
                if (d6 >= 0 && d5 <= d6) { qx = cx; qy = cy; qz = cz; }
                else {
                    const vb = d5 * d2 - d1 * d6;
                    if (vb <= 0 && d2 >= 0 && d6 <= 0) {
                        const w = d2 / (d2 - d6);
                        qx = ax + acx * w; qy = ay + acy * w; qz = az + acz * w;
                    } else {
                        const va = d3 * d6 - d5 * d4;
                        if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) {
                            const w = (d4 - d3) / ((d4 - d3) + (d5 - d6));
                            qx = bx + (cx - bx) * w; qy = by + (cy - by) * w; qz = bz + (cz - bz) * w;
                        } else {
                            const denom = 1 / (va + vb + vc), v = vb * denom, w = vc * denom;
                            qx = ax + abx * v + acx * w; qy = ay + aby * v + acy * w; qz = az + abz * v + acz * w;
                        }
                    }
                }
            }
        }
    }
    const dx = px - qx, dy = py - qy, dz = pz - qz;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export function vertexNormals(positions, indices) {
    const n = new Float32Array(positions.length);
    for (let t = 0; t < indices.length; t += 3) {
        const a = indices[t] * 3, b = indices[t + 1] * 3, c = indices[t + 2] * 3;
        const ux = positions[b] - positions[a], uy = positions[b + 1] - positions[a + 1], uz = positions[b + 2] - positions[a + 2];
        const wx = positions[c] - positions[a], wy = positions[c + 1] - positions[a + 1], wz = positions[c + 2] - positions[a + 2];
        const fx = uy * wz - uz * wy, fy = uz * wx - ux * wz, fz = ux * wy - uy * wx;
        for (const o of [a, b, c]) { n[o] += fx; n[o + 1] += fy; n[o + 2] += fz; }
    }
    for (let i = 0; i < n.length; i += 3) {
        const m = Math.hypot(n[i], n[i + 1], n[i + 2]);
        if (m > 1e-9) { n[i] /= m; n[i + 1] /= m; n[i + 2] /= m; }
    }
    return n;
}

/** Garment pieces, each carrying its own per-shape positions when the file has targets. */

/** Per body vertex: nearest distance to the cloth, and whether the outward normal finds it. */
export function classifyCoverage(positions, normals, parts) {
    const count = positions.length / 3;
    const distance = new Float32Array(count).fill(Infinity);
    const covered = new Uint8Array(count);
    for (let v = 0; v < count; v++) {
        const px = positions[v * 3], py = positions[v * 3 + 1], pz = positions[v * 3 + 2];
        const nx = normals[v * 3], ny = normals[v * 3 + 1], nz = normals[v * 3 + 2];
        let best = Infinity, hit = false;
        for (const part of parts) {
            const gp = part.positions, gi = part.indices;
            for (let t = 0; t < gi.length; t += 3) {
                const a = gi[t] * 3, b = gi[t + 1] * 3, c = gi[t + 2] * 3;
                const rx = px - gp[a], ry = py - gp[a + 1], rz = pz - gp[a + 2];
                if (rx * rx + ry * ry + rz * rz > REJECT_SQ) continue;
                if (!hit && rayHitsTriangle(px, py, pz, nx, ny, nz, COVER_M,
                    gp[a], gp[a + 1], gp[a + 2], gp[b], gp[b + 1], gp[b + 2], gp[c], gp[c + 1], gp[c + 2])) hit = true;
                const d = distanceToTriangle(px, py, pz,
                    gp[a], gp[a + 1], gp[a + 2], gp[b], gp[b + 1], gp[b + 2], gp[c], gp[c + 1], gp[c + 2]);
                if (d < best) best = d;
            }
        }
        distance[v] = best;
        covered[v] = hit ? 1 : 0;
    }
    return {distance, covered};
}

/** Vertices on an edge used by exactly one triangle: the garment's hems, cuffs and openings. */
export function boundaryVertices(indices) {
    const seen = new Map();
    for (let t = 0; t < indices.length; t += 3) {
        for (const [i, j] of [[0, 1], [1, 2], [2, 0]]) {
            const a = indices[t + i], b = indices[t + j];
            const key = a < b ? `${a}_${b}` : `${b}_${a}`;
            seen.set(key, (seen.get(key) ?? 0) + 1);
        }
    }
    const out = new Set();
    for (const [key, count] of seen) {
        if (count !== 1) continue;
        const [a, b] = key.split('_').map(Number);
        out.add(a);
        out.add(b);
    }
    return out;
}

/**
 * Give a shaped garment the reach a bigger body needs, inside the shape target only.
 *
 * A reference fit preserves the standoff a garment was authored with. It cannot invent
 * length, so a heavier silhouette runs past where the garment ends and the last band of
 * skin above a hem is left bare. M005 measured 33 such body vertices across the tunic,
 * trousers and boots at the shape extremes, all of them at hems.
 *
 * This stretches the last band of the existing hem outward along the hem's own direction,
 * far enough to cover what the shape uncovered, with a linear falloff back into the
 * garment so the cloth stretches instead of shearing at one edge. It adds no polygons: the
 * band's texels stretch with it, which is visible under close inspection and is the price
 * of doing this as a fit rather than as authoring.
 *
 * Only the neutral-covered-but-now-uncovered vertices drive it, so a neck opening or a
 * sleeve end -- uncovered by design at every shape -- never pulls the hem over it.
 *
 * The displacement direction is tangent to the body: the component along the nearest body
 * normal is removed, so the hem slides down the skin instead of lifting off it.
 *
 * Applied to the shape targets alone, so at weight 0 the garment is the shipped garment.
 */
export function extendHems(parts, neutralParts, bodyShaped, bodyShapedNormals, bodyNeutral, bodyNeutralNormals, options = {}) {
    // Bounds, all of them learned from a first version that had none. With an 80 mm search
    // radius, a free accumulation across directions and every boundary loop competing, the
    // gloves stretched 166 mm -- their finger openings and their cuff each pulling -- which
    // is not a hem extension, it is a garment coming apart. A hem reaches a little way past
    // its own edge or not at all.
    const {margin = 0.008, falloff = 0.045, searchRadius = 0.050, maxExtension = 0.045, passes = 2} = options;
    const neutral = classifyCoverage(bodyNeutral, bodyNeutralNormals, neutralParts);
    const bodyCount = bodyShaped.length / 3;
    const applied = [];

    for (let pass = 0; pass < passes; pass++) {
        const shaped = classifyCoverage(bodyShaped, bodyShapedNormals, parts);
        const lost = [];
        for (let v = 0; v < bodyCount; v++) {
            if (neutral.covered[v] && !shaped.covered[v]) lost.push(v);
        }
        if (!lost.length) break;

        let moved = 0, worst = 0;
        for (const part of parts) {
            const positions = part.positions;
            const count = positions.length / 3;
            const boundary = part.boundary ?? (part.boundary = boundaryVertices(part.indices));
            if (!boundary.size) continue;

            // Hem direction and required reach, per boundary vertex.
            const dirs = new Map();
            const reach = new Map();
            for (const g of boundary) {
                const gx = positions[g * 3], gy = positions[g * 3 + 1], gz = positions[g * 3 + 2];
                let cx = 0, cy = 0, cz = 0, n = 0;
                for (let v = 0; v < count; v++) {
                    const dx = positions[v * 3] - gx, dy = positions[v * 3 + 1] - gy, dz = positions[v * 3 + 2] - gz;
                    if (dx * dx + dy * dy + dz * dz > falloff * falloff) continue;
                    cx += positions[v * 3]; cy += positions[v * 3 + 1]; cz += positions[v * 3 + 2]; n++;
                }
                if (!n) continue;
                let dx = gx - cx / n, dy = gy - cy / n, dz = gz - cz / n;
                // Project onto the tangent plane of the nearest body vertex so the hem
                // travels along the skin rather than away from it.
                let nearest = -1, nearestSq = Infinity;
                for (let b = 0; b < bodyCount; b++) {
                    const ex = gx - bodyShaped[b * 3], ey = gy - bodyShaped[b * 3 + 1], ez = gz - bodyShaped[b * 3 + 2];
                    const sq = ex * ex + ey * ey + ez * ez;
                    if (sq < nearestSq) { nearestSq = sq; nearest = b; }
                }
                if (nearest >= 0) {
                    const nx = bodyShapedNormals[nearest * 3], ny = bodyShapedNormals[nearest * 3 + 1], nz = bodyShapedNormals[nearest * 3 + 2];
                    const along = dx * nx + dy * ny + dz * nz;
                    dx -= along * nx; dy -= along * ny; dz -= along * nz;
                }
                const length = Math.hypot(dx, dy, dz);
                if (length < 1e-6) continue;
                dx /= length; dy /= length; dz /= length;

                let needed = 0;
                for (const b of lost) {
                    const ex = bodyShaped[b * 3] - gx, ey = bodyShaped[b * 3 + 1] - gy, ez = bodyShaped[b * 3 + 2] - gz;
                    if (ex * ex + ey * ey + ez * ez > searchRadius * searchRadius) continue;
                    const past = ex * dx + ey * dy + ez * dz;
                    // Only skin that lies *beyond* this edge, in the edge's own direction,
                    // is something this hem can reach. Skin behind the edge is somebody
                    // else's problem, and reaching backwards folds the cloth over itself.
                    if (past <= 0.002) continue;
                    const reachNeeded = past + margin;
                    if (reachNeeded > needed) needed = reachNeeded;
                }
                if (needed <= 0) continue;
                dirs.set(g, [dx, dy, dz]);
                reach.set(g, Math.min(maxExtension, needed));
            }
            if (!reach.size) continue;

            // Stretch the band behind each extended hem vertex, linearly to zero at
            // `falloff`. Each band vertex travels along *its own* outward direction and
            // takes only the strongest single claim on it. Borrowing the boundary vertex's
            // direction instead moved a whole band one way, which pulled the cloth off the
            // far side of the limb as fast as it covered the near side: the stout trousers
            // went from 14 uncovered body vertices to 18.
            const delta = new Float32Array(positions.length);
            const strength = new Float32Array(count);
            const localDir = new Map();
            const directionAt = (v) => {
                if (localDir.has(v)) return localDir.get(v);
                const vx = positions[v * 3], vy = positions[v * 3 + 1], vz = positions[v * 3 + 2];
                let cx = 0, cy = 0, cz = 0, n = 0;
                for (let u = 0; u < count; u++) {
                    const ex = positions[u * 3] - vx, ey = positions[u * 3 + 1] - vy, ez = positions[u * 3 + 2] - vz;
                    if (ex * ex + ey * ey + ez * ez > falloff * falloff) continue;
                    cx += positions[u * 3]; cy += positions[u * 3 + 1]; cz += positions[u * 3 + 2]; n++;
                }
                let out = null;
                if (n) {
                    let dx = vx - cx / n, dy = vy - cy / n, dz = vz - cz / n;
                    const length = Math.hypot(dx, dy, dz);
                    if (length > 1e-6) out = [dx / length, dy / length, dz / length];
                }
                localDir.set(v, out);
                return out;
            };
            for (const [g, amount] of reach) {
                const gx = positions[g * 3], gy = positions[g * 3 + 1], gz = positions[g * 3 + 2];
                for (let v = 0; v < count; v++) {
                    const ex = positions[v * 3] - gx, ey = positions[v * 3 + 1] - gy, ez = positions[v * 3 + 2] - gz;
                    const d = Math.hypot(ex, ey, ez);
                    if (d > falloff) continue;
                    const scale = amount * (1 - d / falloff);
                    if (scale <= strength[v]) continue;
                    const dir = directionAt(v);
                    if (!dir) continue;
                    strength[v] = scale;
                    delta[v * 3] = scale * dir[0]; delta[v * 3 + 1] = scale * dir[1]; delta[v * 3 + 2] = scale * dir[2];
                }
            }
            for (let i = 0; i < positions.length; i++) positions[i] += delta[i];
            for (let v = 0; v < count; v++) {
                const m = Math.hypot(delta[v * 3], delta[v * 3 + 1], delta[v * 3 + 2]);
                if (m > 1e-6) moved++;
                if (m > worst) worst = m;
            }
        }
        applied.push({pass: pass + 1, lostBefore: lost.length, verticesMoved: moved, worstExtensionM: Number(worst.toFixed(6))});
        if (!moved) break;
    }
    const final = classifyCoverage(bodyShaped, bodyShapedNormals, parts);
    let lostAfter = 0;
    for (let v = 0; v < bodyCount; v++) if (neutral.covered[v] && !final.covered[v]) lostAfter++;
    return {passes: applied, lostAfter};
}
