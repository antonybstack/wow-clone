/**
 * Procedural character geometry.
 *
 * Nothing here is authored in a DCC tool. Every surface is a lofted tube, a
 * swept ring or a Bezier-blended shell evaluated from the bind-pose skeleton, so
 * the whole figure is a few hundred lines of tables and a smooth-normal pass.
 *
 * Three meshes come out, because three different vertex programs drive them:
 *
 *   body   linearly blend-skinned to the bones — head, cowl, torso, arms,
 *          trousers, boots, belt.
 *   cloth  driven from the simulated garment grids, sampled with Catmull-Rom in
 *          the vertex shader so a 24x14 solve renders as a smooth surface.
 *   fur    shell fur: the same rim ring emitted N times, each pushed further
 *          along its normal, alpha-tested into strands.
 *
 * Normals are never derived analytically. Everything is built as positions plus
 * indices and then run through one area-weighted smooth-normal pass, which is
 * both less code and immune to the sign errors that analytic normals on a swept
 * surface invite. Closed rings share their seam vertex rather than duplicating
 * it, so the seam is smooth too.
 *
 * Build time only — none of this runs after load, and it allocates freely.
 */

import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import {
    B_ROOT, B_SPINE, B_CHEST, B_NECK, B_HEAD, B_HOOD,
    B_UPPER_L, B_FORE_L, B_HAND_L, B_UPPER_R, B_FORE_R, B_HAND_R,
    B_THIGH_L, B_SHIN_L, B_FOOT_L, B_THIGH_R, B_SHIN_R, B_FOOT_R,
} from "./figure.js";

// ------------------------------------------------------------- material slots
export const M_ROBE = 0;     // ember duskweave wool
export const M_MANTLE = 1;   // lighter russet over-mantle
export const M_TUNIC = 2;    // undyed linen under-layer
export const M_LEATHER = 3;  // belt, boots and hands
export const M_SKIN = 4;     // face, deep in shade
export const M_TRIM = 5;     // dark banding and face scarf
export const M_FUR = 6;      // hood and cuff trim

/** Segments around a limb. 14 is smooth at the distances this is seen from. */
const SEG = 14;

// -----------------------------------------------------------------------------

class Builder {
    constructor() {
        this.pos = [];
        this.nrm = [];
        this.uv = [];
        /** (matId, ao) on the body; (shellT, ao) on the fur. */
        this.aux = [];
        this.bi = [];       // bone indices, 4 per vertex
        this.bw = [];       // bone weights, 4 per vertex
        this.idx = [];
        /** Fur supplies its own normals; everything else has them derived. */
        this.explicitNormals = false;
    }

    /** @returns {number} the new vertex's index */
    vert(x, y, z, u, v, matId, ao, b0, w0, b1, w1) {
        this.pos.push(x, y, z);
        this.nrm.push(0, 0, 0);
        this.uv.push(u, v);
        this.aux.push(matId, ao);
        this.bi.push(b0, b1 || 0, 0, 0);
        this.bw.push(w0, w1 || 0, 0, 0);
        return this.pos.length / 3 - 1;
    }

    normal(vi, x, y, z) {
        this.nrm[vi * 3] = x;
        this.nrm[vi * 3 + 1] = y;
        this.nrm[vi * 3 + 2] = z;
    }

    tri(a, b, c) {
        this.idx.push(a, b, c);
    }

    quad(a, b, c, d) {
        // Both diagonals of every quad get used across the mesh, alternating is
        // not worth the bookkeeping on shapes this smooth.
        this.idx.push(a, b, c, a, c, d);
    }
}

/**
 * Area-weighted smooth normals.
 *
 * Area weighting rather than plain averaging: a long thin triangle at a cap
 * would otherwise pull the pole normal off toward its own plane.
 */
function computeNormals(pos, idx) {
    const n = new Float32Array(pos.length);
    for (let i = 0; i < idx.length; i += 3) {
        const a = idx[i] * 3, b = idx[i + 1] * 3, c = idx[i + 2] * 3;
        const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2];
        const vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
        // Un-normalised cross product: its length is twice the triangle area,
        // which is exactly the weight we want.
        const fx = uy * vz - uz * vy;
        const fy = uz * vx - ux * vz;
        const fz = ux * vy - uy * vx;
        n[a] += fx; n[a + 1] += fy; n[a + 2] += fz;
        n[b] += fx; n[b + 1] += fy; n[b + 2] += fz;
        n[c] += fx; n[c + 1] += fy; n[c + 2] += fz;
    }
    for (let i = 0; i < n.length; i += 3) {
        const l = Math.hypot(n[i], n[i + 1], n[i + 2]) || 1;
        n[i] /= l; n[i + 1] /= l; n[i + 2] /= l;
    }
    return n;
}

/**
 * Loft a closed tube through a list of rings.
 *
 * Each ring is `[cx, cy, cz, rx, rz, ao, b0, w0, b1, w1]` and the cross-section
 * plane is derived from the direction to the neighbouring rings, so a limb that
 * bends in the bind pose still gets circular sections rather than sheared ones.
 *
 * @param {Builder} B
 * @param {number[][]} rings
 * @param {number} matId
 * @param {[number,number,number]} ref reference axis the section frame avoids
 * @param {boolean} capStart
 * @param {boolean} capEnd
 * @param {{seg?: number, sculpt?: (p: number[]) => void}} [opts]
 *   `seg` overrides the ring segment count for parts that need more than a limb
 *   does. `sculpt` gets each vertex position in world space and may move it in
 *   place, before normals are derived — so a displaced surface still gets the
 *   normals of the shape it actually is, not of the tube it started as.
 */
function loft(B, rings, matId, ref, capStart, capEnd, opts) {
    const seg = opts?.seg ?? SEG;
    const sculpt = opts?.sculpt;
    const n = rings.length;
    const first = [];
    let prevRow = null;
    let vAcc = 0;

    for (let r = 0; r < n; r++) {
        const cur = rings[r];
        const prev = rings[Math.max(0, r - 1)];
        const next = rings[Math.min(n - 1, r + 1)];

        let ax = next[0] - prev[0], ay = next[1] - prev[1], az = next[2] - prev[2];
        let al = Math.hypot(ax, ay, az) || 1;
        ax /= al; ay /= al; az /= al;

        // U = axis x ref, W = axis x U — the two axes of the section plane.
        let ux = ay * ref[2] - az * ref[1];
        let uy = az * ref[0] - ax * ref[2];
        let uz = ax * ref[1] - ay * ref[0];
        let ul = Math.hypot(ux, uy, uz) || 1;
        ux /= ul; uy /= ul; uz /= ul;
        const wx = ay * uz - az * uy;
        const wy = az * ux - ax * uz;
        const wz = ax * uy - ay * ux;

        if (r > 0) {
            vAcc += Math.hypot(cur[0] - prev[0], cur[1] - prev[1], cur[2] - prev[2]);
        }

        // Texture coordinates are metres of surface, not normalised. Every
        // scale in the fabric shader — the weave, the yarn slub — is a physical
        // size, and normalised UVs would make each of them a different size on
        // every part of the body.
        const circ = Math.PI * (cur[3] + cur[4]);

        const row = [];
        for (let s = 0; s < seg; s++) {
            const a = (s / seg) * Math.PI * 2;
            const ca = Math.cos(a), sa = Math.sin(a);
            _lp[0] = cur[0] + ux * cur[3] * sa + wx * cur[4] * ca;
            _lp[1] = cur[1] + uy * cur[3] * sa + wy * cur[4] * ca;
            _lp[2] = cur[2] + uz * cur[3] * sa + wz * cur[4] * ca;
            _lpAo = 1;
            if (sculpt) sculpt(_lp);
            row.push(B.vert(
                _lp[0], _lp[1], _lp[2],
                (s / seg) * circ, vAcc,
                matId, cur[5] * _lpAo, cur[6], cur[7], cur[8], cur[9]
            ));
        }

        if (prevRow) {
            for (let s = 0; s < seg; s++) {
                const s2 = (s + 1) % seg;
                B.quad(prevRow[s], prevRow[s2], row[s2], row[s]);
            }
        }
        if (r === 0) first.push(...row);
        prevRow = row;
    }

    // Caps: a fan to a centre vertex placed on the ring's own axis.
    if (capStart) capRing(B, rings[0], rings[1], first, matId, true, seg, sculpt);
    if (capEnd) capRing(B, rings[n - 1], rings[n - 2], prevRow, matId, false, seg, sculpt);
}

const _lp = [0, 0, 0];
/**
 * Occlusion multiplier a sculpt callback may write for the vertex it was just
 * handed, on top of whatever its ring carries.
 *
 * A ring's AO is one number for the whole loop, which is all a limb needs and
 * nowhere near enough for a face: an eye is dark because it is a recess *and*
 * because what is in the recess is not skin, and neither of those is something
 * a horizontal slice of the skull can express. Geometry alone does not get
 * there either — a socket a centimetre deep only moves the shading by a few
 * percent under a fill this broad, which is why the sculpted face still read as
 * a bare egg.
 */
let _lpAo = 1;

function capRing(B, ring, neighbour, row, matId, isStart, seg, sculpt) {
    let ax = ring[0] - neighbour[0], ay = ring[1] - neighbour[1], az = ring[2] - neighbour[2];
    const al = Math.hypot(ax, ay, az) || 1;
    ax /= al; ay /= al; az /= al;
    const ext = Math.max(ring[3], ring[4]) * 0.7;
    _lp[0] = ring[0] + ax * ext;
    _lp[1] = ring[1] + ay * ext;
    _lp[2] = ring[2] + az * ext;
    _lpAo = 1;
    if (sculpt) sculpt(_lp);
    const c = B.vert(
        _lp[0], _lp[1], _lp[2],
        0.5, 0.5, matId, ring[5] * _lpAo, ring[6], ring[7], ring[8], ring[9]
    );
    for (let s = 0; s < seg; s++) {
        const s2 = (s + 1) % seg;
        if (isStart) B.tri(c, row[s2], row[s]);
        else B.tri(c, row[s], row[s2]);
    }
}

// ----------------------------------------------------------------- face sculpt
//
// Semi-axes of the bare skull, so the sculpt below can work in units of head
// rather than in metres and stay correct if the head is ever resized.
const HEAD_RX = 0.089;
const HEAD_RY = 0.105;
const HEAD_RZ = 0.096;

/** Unit-height Gaussian, `w` being its half-width. */
function bump(t, w) {
    const x = t / w;
    return Math.exp(-x * x);
}

/**
 * Push a brow, two eye sockets, a nose and cheekbones out of the front of the
 * skull, displacing along +Z (which `FACE_DIR` points along).
 *
 * The head was a bare ellipsoid, and under a hood with no key light that was
 * defensible — it read as a dark void. It does not survive a key light. With
 * the moon above the canopy the cowl's interior gets a real grazing beam, and
 * what it lit was a smooth egg: the single most artificial thing left on the
 * model, and unmistakably a mannequin at conversation distance.
 *
 * This is deliberately structure and not features. There are no eyeballs, no
 * lips, no nostrils — the scarf covers everything below the cheekbone anyway,
 * and the parts that would be hardest to get right are the parts it hides. What
 * is here is the set of planes that make a head read as a head in raking light:
 * a brow that casts down into the sockets, sockets deep enough for the curvature
 * occlusion in the fabric shader to find, a nose bridge to break the centre line,
 * and cheekbones to give the silhouette a corner. Millimetres, all of it — the
 * brow is 7.5 mm and the nose 13.5 mm, which on a 19 cm skull is life-size and
 * slightly over.
 *
 * Slightly over on purpose. A first pass at anatomically honest depths was
 * invisible: the face points away from the moon for most of the day, so it is
 * lit by cowl-filtered fill almost all the time, and fill has no terminator to
 * catch a 3 mm step. These depths are what it takes for the features to survive
 * being lit by nothing but a patch of sky.
 *
 * Displacement falls off with `lz`, so it is zero by the ears and nothing wraps
 * onto the back of the skull.
 */
function sculptFace(p) {
    const lx = (p[0] - HEAD_C[0]) / HEAD_RX;
    const ly = (p[1] - HEAD_C[1]) / HEAD_RY;
    const lz = (p[2] - HEAD_C[2]) / HEAD_RZ;
    if (lz <= 0) return;
    const ax = Math.abs(lx);

    // Every feature below is centred on a ring, and that is not cosmetic.
    //
    // The head is sixteen rings of a half-turn, so its rows land at ly of 0 and
    // ±0.195 and ±0.383 and nowhere in between. A feature centred off a row
    // never puts its peak on a vertex: the eyes were at 0.10, midway between the
    // row at 0 and the row at 0.195, and both rows sampled the mask at about 0.4
    // of full depth. Half strength, split across two rows, is a smudge — which
    // is exactly what the face came back as. Anatomy agrees anyway; eyes sit at
    // the vertical midpoint of a skull, which is the row at 0.

    // Brow ridge. Strongest over each eye and slightly relieved at the centre,
    // which is the glabella and the thing that stops a brow reading as a shelf.
    const brow = 0.0075 * bump(ly - 0.195, 0.16)
               * (0.58 + 0.42 * bump(ax - 0.40, 0.32));

    // Eye sockets, under the brow and inboard of the temples. These are the only
    // concave feature on the model, so they are also the only place the fold
    // occlusion term has anything to bite on above the shoulders.
    const socket = -0.0110 * bump(ly, 0.15)
                 * (bump(lx - 0.44, 0.25) + bump(lx + 0.44, 0.25));

    // Nose. Narrow at the bridge and wider toward the tip, and centred low
    // enough that the last third of it emerges over the top edge of the scarf.
    const noseW = 0.105 + 0.075 * Math.max(0, 0.20 - ly);
    const nose = 0.0135 * bump(lx, noseW) * bump(ly + 0.10, 0.26);

    // Cheekbones: the corner in the silhouette just below the sockets.
    const cheek = 0.0045 * bump(ly + 0.195, 0.20)
                * (bump(lx - 0.62, 0.27) + bump(lx + 0.62, 0.27));

    // Temple hollow, which is what keeps the brow from looking bolted on.
    const temple = -0.0030 * bump(ly - 0.195, 0.22) * bump(ax - 0.92, 0.26);

    const fade = Math.pow(lz, 0.8);
    p[2] += (brow + socket + nose + cheek + temple) * fade;

    // The eyes.
    //
    // Not modelled — baked, as occlusion, on a mask tighter than the socket that
    // carries it. A socket is a 4 cm dish and an eye is a 1.5 cm dark spot in
    // the top half of it, so the two cannot share a falloff: widen the dark part
    // to the socket's width and the face gets two bruises instead of two eyes.
    //
    // This is the one feature on the figure that is a cheat rather than a shape,
    // and it earns it. Everything else about the head can be carried by planes
    // catching a grazing beam, but an eye is defined by being darker than the
    // skin around it at every angle and in every light, which is a statement
    // about what is in the socket and not about how the socket is lit. Without
    // it the head is a mannequin at any distance, and at the distance the game
    // actually frames the figure it is the *only* facial feature large enough to
    // resolve — twenty pixels of head gets two dark marks and a nose shadow, and
    // that is enough for the eye to accept a face.
    // Narrow vertically — 0.13 of a head radius is 1.4 cm — so that the row it
    // sits on takes nearly all of it and the rows above and below take almost
    // none. A wider falloff spreads the same darkening over three rows and
    // reads as a blindfold rather than as two eyes.
    const eye = bump(ly, 0.13)
              * (bump(lx - 0.44, 0.17) + bump(lx + 0.44, 0.17));
    // A lash line: the upper lid sits proud of the eye and shades the top of it,
    // so the mark is heaviest just under the brow rather than centred.
    const lash = bump(ly - 0.195, 0.10)
               * (bump(lx - 0.44, 0.19) + bump(lx + 0.44, 0.19));
    _lpAo = 1 - (0.82 * Math.min(1, eye) + 0.22 * Math.min(1, lash)) * fade;
}

/** Bone blend along the spine, by bind-pose height. */
function spineBones(y) {
    if (y < 1.06) {
        const t = Math.min(1, Math.max(0, (y - 0.88) / 0.18));
        return [B_ROOT, 1 - t * 0.5, B_SPINE, t * 0.5];
    }
    if (y < 1.26) {
        const t = (y - 1.06) / 0.20;
        return [B_SPINE, 1 - t, B_CHEST, t];
    }
    const t = Math.min(1, (y - 1.26) / 0.20);
    return [B_CHEST, 1 - t * 0.35, B_NECK, t * 0.35];
}

/** Ring helper: `[cx,cy,cz, rx,rz, ao, b0,w0,b1,w1]`. */
function ring(cx, cy, cz, rx, rz, ao, bones) {
    return [cx, cy, cz, rx, rz, ao, bones[0], bones[1], bones[2], bones[3]];
}

/** Rings along a straight bone segment, interpolating radius and bone weights. */
function limbRings(x0, y0, z0, x1, y1, z1, r0, r1, steps, boneA, boneB, ao, from, to) {
    const out = [];
    for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        // Weight ramps from boneA to boneB across the segment's lower half, so
        // the joint bends smoothly instead of creasing at one ring.
        const w = Math.min(1, Math.max(0, (t - from) / (to - from)));
        const r = r0 + (r1 - r0) * t;
        out.push(ring(
            x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, z0 + (z1 - z0) * t,
            r, r, ao, [boneA, 1 - w, boneB, w]
        ));
    }
    return out;
}

// -----------------------------------------------------------------------------
//  Body
// -----------------------------------------------------------------------------

/**
 * The figure under the garments: head, cowl, torso, arms, trousers, boots.
 *
 * Most of this is only seen in slivers — the robe covers the torso, the mantle
 * covers the shoulders. What is genuinely on screen is the hood silhouette, the
 * boots, and the forearms, so that is where the ring counts go.
 */
export function buildBody(scene) {
    const B = new Builder();

    // ---- torso ------------------------------------------------------------
    const torso = [];
    const TORSO = [
        [0.88, 0.150, 0.120], [0.98, 0.142, 0.113], [1.06, 0.134, 0.106],
        [1.14, 0.140, 0.109], [1.22, 0.156, 0.118], [1.30, 0.172, 0.126],
        [1.38, 0.176, 0.126], [1.44, 0.160, 0.116],
    ];
    for (let i = 0; i < TORSO.length; i++) {
        const [y, rx, rz] = TORSO[i];
        torso.push(ring(0, y, 0, rx, rz, 0.72, spineBones(y)));
    }
    // The under-tunic, not the scarf material it used to share. It shows at the
    // mantle's notch and at the waist above the belt, and those are the two
    // places the eye needs a darker layer behind the robe to read depth.
    loft(B, torso, M_TUNIC, [0, 0, 1], true, false);

    // ---- belt -------------------------------------------------------------
    const belt = [
        ring(0, 0.955, 0, 0.153, 0.124, 0.62, spineBones(0.955)),
        ring(0, 0.995, 0, 0.160, 0.130, 0.70, spineBones(0.995)),
        ring(0, 1.035, 0, 0.152, 0.123, 0.62, spineBones(1.035)),
    ];
    loft(B, belt, M_LEATHER, [0, 0, 1], false, false);

    // ---- neck + head ------------------------------------------------------
    // The neck shares the skin slot with the head, so its occlusion has to stay
    // out of the band the fabric shader reads as an eye. It was at 0.28-0.35,
    // which is squarely inside it.
    const neck = [
        ring(0, 1.42, -0.005, 0.062, 0.058, 0.50, [B_NECK, 1, B_HEAD, 0]),
        ring(0, 1.50, 0.000, 0.058, 0.055, 0.47, [B_NECK, 0.5, B_HEAD, 0.5]),
        ring(0, 1.56, 0.002, 0.062, 0.060, 0.45, [B_HEAD, 1, 0, 0]),
    ];
    loft(B, neck, M_SKIN, [0, 0, 1], false, false);

    // The skull. Deliberately featureless: the face stays in shadow under the
    // cowl, and a half-finished face is far worse than a silhouette.
    //
    // The occlusion here went down to a tenth at one point, on the argument that
    // a cowl interior sees only a few percent of the sky. That is true of the
    // crown, and it was the wrong number to apply to a face: with the moon above
    // the canopy the face is lit mostly by the beam, which AO does not touch, so
    // all a tenth bought was a face whose *fill* was switched off — and fill is
    // the only thing lighting it whenever the figure turns away from the moon.
    // It rises toward the crown, which is genuinely deeper in the cowl than the
    // chin is.
    //
    // The other reason it cannot go that low is that `sculptFace` writes the
    // eyes into this same channel, and the fabric shader reads the bottom of the
    // range on skin as "this is not skin". Legitimate cowl occlusion has to stay
    // clear of that band or the crown starts reading as an eye socket.
    //
    // Sixteen rings and thirty segments, where the rest of the body runs on
    // nine and fourteen. A limb is a smooth tube and fourteen segments is more
    // than it needs; an eye socket is a 2 cm dish and at fourteen segments the
    // whole face spans five vertices, which is not enough to put a feature in.
    const HEAD_RINGS = 16;
    const head = [];
    for (let i = 0; i <= HEAD_RINGS; i++) {
        const a = (i / HEAD_RINGS) * Math.PI;
        const y = HEAD_C[1] - Math.cos(a) * HEAD_RY;
        const r = Math.sin(a);
        head.push(ring(
            0, y, HEAD_C[2] + r * 0.006,
            HEAD_RX * r + 0.004, HEAD_RZ * r + 0.004,
            // Face void: deep cowl occlusion so the opening reads as shadow,
            // not a lit mannequin head. Eye marks still live below ~0.35.
            0.38 - 0.22 * (i / HEAD_RINGS), [B_HEAD, 1, 0, 0]
        ));
    }
    loft(B, head, M_SKIN, [0, 0, 1], true, true, { seg: 30, sculpt: sculptFace });

    // Dark wrap across the lower face — fills the void without bright skin.
    const scarf = [
        ring(0, 1.560, 0.010, 0.086, 0.092, 0.10, [B_HEAD, 1, 0, 0]),
        ring(0, 1.600, 0.012, 0.094, 0.100, 0.12, [B_HEAD, 1, 0, 0]),
        ring(0, 1.638, 0.008, 0.092, 0.098, 0.09, [B_HEAD, 1, 0, 0]),
    ];
    loft(B, scarf, M_TRIM, [0, 0, 1], false, false);

    buildHood(B);

    // ---- arms -------------------------------------------------------------
    for (let a = 0; a < 2; a++) {
        const s = a === 0 ? -1 : 1;
        const up = a === 0 ? B_UPPER_L : B_UPPER_R;
        const fo = a === 0 ? B_FORE_L : B_FORE_R;
        const hd = a === 0 ? B_HAND_L : B_HAND_R;

        const upper = limbRings(
            s * 0.185, 1.400, 0, s * 0.230, 1.123, 0,
            0.064, 0.050, 4, up, fo, 0.55, 0.72, 1.0
        );
        loft(B, upper, M_ROBE, [0, 0, 1], true, false);

        const fore = limbRings(
            s * 0.230, 1.123, 0, s * 0.243, 0.866, 0.016,
            0.050, 0.042, 4, fo, hd, 0.62, 0.75, 1.0
        );
        loft(B, fore, M_ROBE, [0, 0, 1], false, false);

        // The hand is a mitt. Fingers at this distance are three pixels of
        // noise; a clean silhouette reads better and costs nothing.
        const hand = [
            ring(s * 0.243, 0.866, 0.016, 0.044, 0.038, 0.55, [hd, 1, 0, 0]),
            ring(s * 0.245, 0.820, 0.024, 0.050, 0.040, 0.55, [hd, 1, 0, 0]),
            ring(s * 0.247, 0.780, 0.032, 0.046, 0.036, 0.52, [hd, 1, 0, 0]),
            ring(s * 0.248, 0.752, 0.038, 0.030, 0.026, 0.50, [hd, 1, 0, 0]),
        ];
        loft(B, hand, M_LEATHER, [0, 0, 1], false, true);
    }

    // ---- legs and boots ---------------------------------------------------
    for (let l = 0; l < 2; l++) {
        const s = l === 0 ? -1 : 1;
        const th = l === 0 ? B_THIGH_L : B_THIGH_R;
        const sh = l === 0 ? B_SHIN_L : B_SHIN_R;
        const ft = l === 0 ? B_FOOT_L : B_FOOT_R;

        const thigh = limbRings(
            s * 0.100, 0.905, 0, s * 0.100, 0.460, 0,
            0.114, 0.086, 5, th, sh, 0.5, 0.74, 1.0
        );
        loft(B, thigh, M_ROBE, [0, 0, 1], true, false);

        // Trousers narrow to the ankle then flare into the boot shaft.
        const shin = [
            ring(s * 0.100, 0.460, 0, 0.086, 0.086, 0.55, [sh, 1, 0, 0]),
            ring(s * 0.100, 0.360, 0.004, 0.076, 0.076, 0.55, [sh, 1, 0, 0]),
            ring(s * 0.100, 0.270, 0.006, 0.070, 0.070, 0.52, [sh, 1, 0, 0]),
            ring(s * 0.100, 0.200, 0.006, 0.075, 0.076, 0.48, [sh, 0.6, ft, 0.4]),
            ring(s * 0.100, 0.140, 0.004, 0.080, 0.082, 0.44, [sh, 0.25, ft, 0.75]),
            ring(s * 0.100, 0.100, 0.000, 0.074, 0.078, 0.42, [ft, 1, 0, 0]),
        ];
        loft(B, shin, M_ROBE, [0, 0, 1], false, false);

        // The boot runs along the foot's own axis, so it swings with the ankle
        // roll rather than being a block bolted to the shin.
        const boot = [
            ring(s * 0.100, 0.055, -0.088, 0.046, 0.052, 0.35, [ft, 1, 0, 0]),
            ring(s * 0.100, 0.058, -0.050, 0.056, 0.066, 0.38, [ft, 1, 0, 0]),
            ring(s * 0.100, 0.054, 0.010, 0.058, 0.060, 0.42, [ft, 1, 0, 0]),
            ring(s * 0.100, 0.048, 0.078, 0.056, 0.050, 0.45, [ft, 1, 0, 0]),
            ring(s * 0.100, 0.043, 0.142, 0.050, 0.043, 0.48, [ft, 1, 0, 0]),
            ring(s * 0.100, 0.040, 0.190, 0.033, 0.031, 0.48, [ft, 1, 0, 0]),
        ];
        loft(B, boot, M_LEATHER, [0, 1, 0], true, true);
    }

    return finishSkinned(scene, "charBody", B);
}

/**
 * The cowl.
 *
 * Built as a swept Bezier: each strand runs from a point on the face-opening rim
 * to a point on the ring where the hood meets the shoulders, bowed outward by a
 * control point that is pushed furthest over the crown. That gives a genuinely
 * deep hood with a rolled opening, rather than a sphere with a hole in it.
 *
 * The rim curve this produces is reused verbatim by the fur trim, so the two can
 * never drift apart.
 */
const HOOD_COLS = 34;
const HOOD_ROWS = 11;
const HEAD_C = [0, 1.655, 0.005];
const FACE_DIR = (() => {
    // More forward than the old cowl — the opening sits ahead of the skull so
    // the face falls into a real cavity (warlock plate: face void).
    const v = [0, -0.18, 0.98];
    const l = Math.hypot(v[0], v[1], v[2]);
    return [v[0] / l, v[1] / l, v[2] / l];
})();

/** Face-opening rim point at parameter `s` (0 = crown, 0.5 = under the chin). */
export function hoodRimPoint(s, out) {
    const a = s * Math.PI * 2;
    // U spans the rim horizontally, W vertically, both perpendicular to FACE_DIR.
    const ux = 1, uy = 0, uz = 0;
    const wx = FACE_DIR[1] * uz - FACE_DIR[2] * uy;
    const wy = FACE_DIR[2] * ux - FACE_DIR[0] * uz;
    const wz = FACE_DIR[0] * uy - FACE_DIR[1] * ux;
    // Rim sits only slightly ahead of the skull — deep cowl, not a funnel.
    const cx = HEAD_C[0] + FACE_DIR[0] * 0.042;
    const cy = HEAD_C[1] + FACE_DIR[1] * 0.042;
    const cz = HEAD_C[2] + FACE_DIR[2] * 0.042;
    // Narrower opening than the old plush rim — pointed warlock hood.
    out[0] = cx + ux * 0.128 * Math.sin(a) + wx * 0.148 * Math.cos(a);
    out[1] = cy + uy * 0.128 * Math.sin(a) + wy * 0.148 * Math.cos(a);
    out[2] = cz + uz * 0.128 * Math.sin(a) + wz * 0.148 * Math.cos(a);
    return out;
}

function hoodBasePoint(s, out) {
    const a = s * Math.PI * 2;
    out[0] = 0.225 * Math.sin(a);
    out[1] = 1.340;
    out[2] = -0.020 - 0.195 * Math.cos(a);
    return out;
}

function buildHood(B) {
    const rim = [0, 0, 0];
    const base = [0, 0, 0];
    let prevRow = null;

    for (let r = 0; r <= HOOD_ROWS; r++) {
        const t = r / HOOD_ROWS;
        const row = [];
        for (let c = 0; c < HOOD_COLS; c++) {
            const s = c / HOOD_COLS;
            hoodRimPoint(s, rim);
            hoodBasePoint(s, base);

            const a = s * Math.PI * 2;
            const sa = Math.sin(a), ca = Math.cos(a);
            // Pointed crown: push the peak up and back harder at s≈0.
            let nx = sa * 1.0;
            let ny = ca * 0.95 + 0.52 * Math.max(0, ca);
            let nz = ca * -0.62;
            const nl = Math.hypot(nx, ny, nz) || 1;
            nx /= nl; ny /= nl; nz /= nl;
            // Tall peak over the crown, tight throat. The extra height is doing
            // proportion work, not decoration: the skeleton is a fixed 1.55 m to
            // the crown, and lengthening the cowl above it and the robe below it
            // is how the figure gets the drawn-out, top-heavy read of the
            // reference without touching the rig the gait solve depends on.
            //
            // Height goes in the lift, not the radius. Widening the crown to
            // raise it is what produced the bulb the last pass ended up with: a
            // cone is a cone because its base is narrow, and a control point
            // pushed 18 cm outboard over the skull rounds the whole thing off
            // however far up it goes.
            const rad = 0.186 + 0.062 * Math.max(0, ca) + 0.028 * ca;
            const mx = HEAD_C[0] + nx * rad;
            const my = HEAD_C[1] + ny * rad + 0.215 * Math.max(0, ca);
            // The peak tips forward over the face rather than standing straight
            // up — a vertical cone reads as a party hat.
            const mz = HEAD_C[2] + nz * rad + 0.052 * Math.max(0, ca);

            const it = 1 - t;
            const px = it * it * rim[0] + 2 * it * t * mx + t * t * base[0];
            const py = it * it * rim[1] + 2 * it * t * my + t * t * base[1];
            const pz = it * it * rim[2] + 2 * it * t * mz + t * t * base[2];

            // Deep cowl interior — almost no sky reaches the face plane.
            const ao = 0.22 + 0.58 * Math.min(1, t * 2.0);
            row.push(B.vert(px, py, pz, s * 1.02, t * 0.45, M_ROBE, ao, B_HOOD, 1, 0, 0));
        }
        if (prevRow) {
            for (let c = 0; c < HOOD_COLS; c++) {
                const c2 = (c + 1) % HOOD_COLS;
                B.quad(prevRow[c], prevRow[c2], row[c2], row[c]);
            }
        }
        prevRow = row;
    }
}

// -----------------------------------------------------------------------------
//  Fur
// -----------------------------------------------------------------------------

/**
 * Shells per band. Below about 18 the layering is visible as banding — which is
 * exactly what the cowl fringe wants and exactly what a cuff does not.
 */
const HOOD_SHELLS = 10;
const CUFF_SHELLS = 18;

/**
 * Shell fur.
 *
 * A trim band is modelled as a partial torus around the edge it decorates: a
 * ring of cross-sections, each an arc of directions pointing away from the
 * garment. That surface is then emitted once per shell, each copy pushed
 * further along its own direction, and the fragment shader alpha-tests a hashed
 * strand field whose threshold rises with the shell parameter — so strands
 * taper, end at different lengths, and the band reads as fur rather than as a
 * smooth sausage.
 *
 * Bone-bound rather than cloth-bound, deliberately: the hood rim rides the hood
 * bone and the cuffs ride the forearms, both of which are rigid. Binding fur to
 * a simulated surface would need the shell direction to come out of the cloth
 * solve — a second vertex program, for very little visible gain.
 */
export function buildFur(scene) {
    const B = new Builder();
    B.explicitNormals = true;
    const p = [0, 0, 0];

    // ---- hood rim ---------------------------------------------------------
    // The band's outward direction is the rim's own bisector: away from the
    // skull, tilted along the face direction so the trim frames the opening.
    const cols = 26;
    const bases = new Float32Array(cols * 3);
    const outs = new Float32Array(cols * 3);
    for (let c = 0; c < cols; c++) {
        hoodRimPoint(c / cols, p);
        bases[c * 3] = p[0]; bases[c * 3 + 1] = p[1]; bases[c * 3 + 2] = p[2];
        let dx = p[0] - HEAD_C[0], dy = p[1] - HEAD_C[1], dz = p[2] - HEAD_C[2];
        const dl = Math.hypot(dx, dy, dz) || 1;
        dx = dx / dl + FACE_DIR[0] * 0.45;
        dy = dy / dl + FACE_DIR[1] * 0.45;
        dz = dz / dl + FACE_DIR[2] * 0.45;
        const l2 = Math.hypot(dx, dy, dz) || 1;
        outs[c * 3] = dx / l2; outs[c * 3 + 1] = dy / l2; outs[c * 3 + 2] = dz / l2;
    }
    // Not fur any more — a frayed thread fringe. The reference has no trim on
    // the cowl, but a rim that ends on a hard geometric edge reads as moulded
    // plastic. Ten sparse shells of longer, thinner strands give the edge the
    // broken-up terminator of worn cloth; the gaps between shells are the
    // point, not an artefact of running out of them.
    emitFurBand(B, cols, bases, outs, 0.008, 0.030, HOOD_SHELLS, B_HOOD, 0.30);

    // ---- cuffs ------------------------------------------------------------
    for (let a = 0; a < 2; a++) {
        const s = a === 0 ? -1 : 1;
        const bone = a === 0 ? B_FORE_L : B_FORE_R;
        const n = 12;
        const cb = new Float32Array(n * 3);
        const co = new Float32Array(n * 3);
        // The forearm runs almost straight down in the bind pose, so the band's
        // ring sits in the XZ plane around it and its outward is radial.
        for (let c = 0; c < n; c++) {
            const ang = (c / n) * Math.PI * 2;
            const rx = Math.sin(ang), rz = Math.cos(ang);
            // Sits on the sleeve at the wrist, just above the loose cuff rows,
            // where the garment is pinned hard enough that a bone-bound band
            // cannot visibly separate from it.
            cb[c * 3] = s * 0.240 + rx * 0.066;
            cb[c * 3 + 1] = 0.900;
            cb[c * 3 + 2] = 0.012 + rz * 0.064;
            co[c * 3] = rx; co[c * 3 + 1] = 0; co[c * 3 + 2] = rz;
        }
        emitFurBand(B, n, cb, co, 0.013, 0.020, CUFF_SHELLS, bone, 0.44);
    }

    return finishSkinned(scene, "charFur", B, true);
}

/** Cross-section steps across a fur band, and the arc they cover. */
const FUR_ARC_STEPS = 4;
const FUR_ARC = 2.1; // radians, centred on the outward direction

/**
 * One fur band.
 *
 * @param {Builder} B
 * @param {number} cols positions around the ring
 * @param {Float32Array} bases ring positions, 3 floats each
 * @param {Float32Array} outs unit outward direction per ring position
 * @param {number} r0 radius of the band's core, metres
 * @param {number} len strand length beyond the core, metres
 * @param {number} shells
 * @param {number} bone
 * @param {number} ao
 */
function emitFurBand(B, cols, bases, outs, r0, len, shells, bone, ao) {
    const dir = new Float32Array((cols * (FUR_ARC_STEPS + 1)) * 3);

    // Precompute the cross-section directions once: each is the outward vector
    // rotated about the ring's own tangent.
    for (let c = 0; c < cols; c++) {
        const cn = (c + 1) % cols;
        const cp = (c - 1 + cols) % cols;
        let tx = bases[cn * 3] - bases[cp * 3];
        let ty = bases[cn * 3 + 1] - bases[cp * 3 + 1];
        let tz = bases[cn * 3 + 2] - bases[cp * 3 + 2];
        const tl = Math.hypot(tx, ty, tz) || 1;
        tx /= tl; ty /= tl; tz /= tl;

        const ox = outs[c * 3], oy = outs[c * 3 + 1], oz = outs[c * 3 + 2];
        // Third axis of the cross-section plane.
        const ax = ty * oz - tz * oy;
        const ay = tz * ox - tx * oz;
        const az = tx * oy - ty * ox;

        for (let k = 0; k <= FUR_ARC_STEPS; k++) {
            const phi = (k / FUR_ARC_STEPS - 0.5) * FUR_ARC;
            const cs = Math.cos(phi), sn = Math.sin(phi);
            const o = (c * (FUR_ARC_STEPS + 1) + k) * 3;
            dir[o] = ox * cs + ax * sn;
            dir[o + 1] = oy * cs + ay * sn;
            dir[o + 2] = oz * cs + az * sn;
        }
    }

    // Arc length around the ring, so the strand field has a uniform pitch in
    // metres regardless of how big the band is. The shader multiplies this by a
    // density in cells per metre; anything else makes hood fur and cuff fur
    // come out at different scales.
    const arc = new Float32Array(cols + 1);
    for (let c = 1; c <= cols; c++) {
        const a = ((c - 1) % cols) * 3;
        const b = (c % cols) * 3;
        arc[c] = arc[c - 1] + Math.hypot(
            bases[b] - bases[a], bases[b + 1] - bases[a + 1], bases[b + 2] - bases[a + 2]
        );
    }

    const stride = FUR_ARC_STEPS + 1;
    for (let s = 0; s < shells; s++) {
        const t = s / (shells - 1);
        const rowBase = B.pos.length / 3;

        for (let c = 0; c <= cols; c++) {
            const ci = c % cols;
            for (let k = 0; k <= FUR_ARC_STEPS; k++) {
                const o = (ci * stride + k) * 3;
                const dx = dir[o], dy = dir[o + 1], dz = dir[o + 2];
                const rad = r0 + len * t;
                const across = (k / FUR_ARC_STEPS - 0.5) * FUR_ARC * r0;
                const vi = B.vert(
                    bases[ci * 3] + dx * rad,
                    bases[ci * 3 + 1] + dy * rad,
                    bases[ci * 3 + 2] + dz * rad,
                    arc[c], across,
                    t, ao, bone, 1, 0, 0
                );
                B.normal(vi, dx, dy, dz);
            }
        }

        // Shells are independent sheets: each is stitched only to itself, never
        // to its neighbours. That is the whole idea — the gaps between them are
        // where you see through to the shell behind.
        for (let c = 0; c < cols; c++) {
            for (let k = 0; k < FUR_ARC_STEPS; k++) {
                const a = rowBase + c * stride + k;
                B.quad(a, a + 1, a + stride + 1, a + stride);
            }
        }
    }
}

// -----------------------------------------------------------------------------

function finishSkinned(scene, name, B, isFur) {
    const pos = new Float32Array(B.pos);
    const idx = new Uint32Array(B.idx);
    const nrm = B.explicitNormals ? new Float32Array(B.nrm) : computeNormals(pos, idx);

    const mesh = new Mesh(name, scene);
    const vd = new VertexData();
    vd.positions = pos;
    vd.indices = idx;
    vd.normals = nrm;
    vd.uvs = new Float32Array(B.uv);
    vd.applyToMesh(mesh, false);

    mesh.setVerticesData("aux", new Float32Array(B.aux), false, 2);
    mesh.setVerticesData("boneIdx", new Float32Array(B.bi), false, 4);
    mesh.setVerticesData("boneWt", new Float32Array(B.bw), false, 4);

    // The mesh is placed entirely by the vertex shader from bone matrices, so
    // its world matrix is the identity for ever and its bounding box is a lie.
    mesh.alwaysSelectAsActiveMesh = true;
    mesh.isPickable = false;
    mesh.freezeWorldMatrix();
    mesh.doNotSyncBoundingInfo = true;
    mesh.metadata = { triangles: idx.length / 3, vertices: pos.length / 3, fur: !!isFur };
    return mesh;
}

// -----------------------------------------------------------------------------
//  Cloth render mesh
// -----------------------------------------------------------------------------

/**
 * The render mesh for the simulated garments.
 *
 * It carries no positions of its own — `position` is `(u, v, panelIndex)` and
 * the vertex shader reconstructs the surface by Catmull-Rom interpolation of the
 * panel's simulated node grid. That decoupling is what lets a 24x14 verlet solve
 * render as a smooth 48x28 surface, and it means the sim cost is independent of
 * how finely the garment is tessellated.
 *
 * @param {import("./cloth.js").ClothPanel[]} panels
 */
export function buildClothMesh(scene, panels) {
    const pos = [];
    const uv = [];
    const aux = [];
    const idx = [];

    for (let pi = 0; pi < panels.length; pi++) {
        const p = panels[pi];
        const cu = p.renderCols;
        const cv = p.renderRows;
        const base = pos.length / 3;

        for (let j = 0; j <= cv; j++) {
            const v = j / cv;
            for (let i = 0; i <= cu; i++) {
                const u = i / cu;
                pos.push(u, v, pi);
                uv.push(u * p.weaveU, v * p.weaveV);
                // (matId, ao). Garments darken toward the hem, where they sit in
                // their own folds and close to the ground.
                aux.push(p.matId, p.aoTop + (p.aoBottom - p.aoTop) * v);
            }
        }

        const stride = cu + 1;
        for (let j = 0; j < cv; j++) {
            for (let i = 0; i < cu; i++) {
                const a = base + j * stride + i;
                const b = a + 1;
                const c = a + stride;
                const d = c + 1;
                idx.push(a, b, d, a, d, c);
            }
        }
    }

    const mesh = new Mesh("charCloth", scene);
    const vd = new VertexData();
    vd.positions = new Float32Array(pos);
    vd.indices = new Uint32Array(idx);
    vd.uvs = new Float32Array(uv);
    vd.applyToMesh(mesh, false);
    mesh.setVerticesData("aux", new Float32Array(aux), false, 2);

    mesh.alwaysSelectAsActiveMesh = true;
    mesh.isPickable = false;
    mesh.freezeWorldMatrix();
    mesh.doNotSyncBoundingInfo = true;
    mesh.metadata = { triangles: idx.length / 3, vertices: pos.length / 3 };
    return mesh;
}
