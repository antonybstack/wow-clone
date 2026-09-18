/**
 * Garment simulation — verlet cloth on coarse grids.
 *
 * Each garment is a closed tube of particles, `cols` around by `rows` down.
 * The grids are deliberately coarse (twenty by twelve for the robe) because the
 * render mesh does not use them directly: the vertex shader reconstructs a
 * smooth surface from them with Catmull-Rom, so tessellation and simulation cost
 * are completely decoupled. Doubling the visible smoothness costs nothing here.
 *
 * Every particle carries a bind-pose position and one bone. Its kinematic target
 * each frame is that bind position pushed through the bone's skinning matrix —
 * exactly what a rigidly-skinned vertex would do. A per-particle `pinRate`
 * decides how hard it is pulled toward that target, in units of 1/second:
 *
 *   Infinity   the waistband, the collar, the shoulder of a sleeve. Welded.
 *   10-60      follows the body closely, with a frame or two of give.
 *   1-5        follows loosely — this is where a garment starts to read as cloth.
 *   0.2-0.5    shape memory only. Stops a free hem from slowly collapsing into
 *              a rope without meaningfully resisting motion.
 *
 * Expressing the pull as a rate rather than a per-frame blend is not a detail:
 * a "0.05 blend" applied 165 times a second is a 12 ms time constant, which is
 * a weld. Anything time-based in a system that also has to survive a frame-rate
 * change has to be written as a rate.
 *
 * Wind is *apparent* wind — the field wind minus the character's own velocity —
 * with quadratic drag, so the robe whips back hard during a snow-surf run
 * without needing a special case for it.
 *
 * Allocation: none per frame. All state is typed arrays sized at construction.
 */

import { S } from "../core/settings.js";
import {
    B_ROOT, B_CHEST, B_UPPER_L, B_FORE_L, B_HAND_L,
    B_UPPER_R, B_FORE_R, B_HAND_R, B_NECK, B_SHIN_L, B_SHIN_R,
    B_THIGH_L, B_THIGH_R, B_FOOT_L, B_FOOT_R,
} from "./figure.js";
import { M_ROBE, M_MANTLE } from "./build.js";

/** Which body capsules a panel is allowed to collide against. */
const C_TORSO = 1;
const C_LEGS = 2;
const C_ARM_L = 4;
const C_ARM_R = 8;

export class ClothPanel {
    constructor(spec) {
        this.name = spec.name;
        this.cols = spec.cols;
        this.rows = spec.rows;
        this.matId = spec.matId;
        this.renderCols = spec.renderCols;
        this.renderRows = spec.renderRows;
        this.weaveU = spec.weaveU;
        this.weaveV = spec.weaveV;
        this.aoTop = spec.aoTop;
        this.aoBottom = spec.aoBottom;
        this.collide = spec.collide;
        /** Rows at the bottom that check the snow surface. */
        this.groundRows = spec.groundRows || 0;
        /** Row in the shared transform texture where this panel's grid starts. */
        this.nodeRow = 0;

        const n = this.cols * this.rows;
        this.count = n;
        this.bindPos = new Float32Array(n * 3);
        this.pos = new Float32Array(n * 3);
        this.prev = new Float32Array(n * 3);
        this.target = new Float32Array(n * 3);
        this.bone = new Int32Array(n);
        this.pinRate = new Float32Array(n);

        // Rest lengths: around the ring, down the panel, and the bending pair
        // two rows apart. Measured from the bind pose, so the garment's rest
        // shape *is* its authored shape.
        this.restU = new Float32Array(n);
        this.restV = new Float32Array(n);
        this.restB = new Float32Array(n);
    }

    /** Called once the bind positions are filled in. */
    finalise() {
        const { cols, rows, bindPos } = this;
        for (let j = 0; j < rows; j++) {
            for (let i = 0; i < cols; i++) {
                const a = (j * cols + i) * 3;
                const bu = (j * cols + ((i + 1) % cols)) * 3;
                this.restU[j * cols + i] = dist3(bindPos, a, bindPos, bu);
                if (j + 1 < rows) {
                    const bv = ((j + 1) * cols + i) * 3;
                    this.restV[j * cols + i] = dist3(bindPos, a, bindPos, bv);
                }
                if (j + 2 < rows) {
                    const bb = ((j + 2) * cols + i) * 3;
                    this.restB[j * cols + i] = dist3(bindPos, a, bindPos, bb);
                }
            }
        }
        this.pos.set(bindPos);
        this.prev.set(bindPos);
    }
}

function dist3(a, ia, b, ib) {
    return Math.hypot(a[ia] - b[ib], a[ia + 1] - b[ib + 1], a[ia + 2] - b[ib + 2]);
}

// -----------------------------------------------------------------------------
//  Garment shapes
// -----------------------------------------------------------------------------

/** Piecewise-linear lookup over a table of `[t, a, b]` control points. */
function curve(table, t) {
    let i = 0;
    while (i < table.length - 2 && t > table[i + 1][0]) i++;
    const A = table[i], Bb = table[i + 1];
    const s = Bb[0] > A[0] ? (t - A[0]) / (Bb[0] - A[0]) : 0;
    const k = Math.min(1, Math.max(0, s));
    return [A[1] + (Bb[1] - A[1]) * k, A[2] + (Bb[2] - A[2]) * k];
}

/**
 * Per-column rag depth, metres, in [0, RAG_MAX].
 *
 * The reference silhouette does not end at a hem — it dissolves. Four
 * incommensurate frequencies rectified to one side give lobes of very
 * different length with no repeat around the tube, and the sharp `pow` is what
 * separates them into hanging tongues instead of a gentle scallop.
 *
 * Frequencies stay under a quarter of the column count: the render surface is
 * reconstructed with Catmull-Rom, so anything finer than four columns per lobe
 * comes back as a wobble rather than a tear.
 */
function ragDepth(a) {
    const n =
        0.50 + 0.28 * Math.sin(a * 5 + 1.7) +
        0.24 * Math.sin(a * 8 + 4.1) +
        0.16 * Math.sin(a * 13 + 0.3) +
        0.10 * Math.sin(a * 3 - 2.2);
    return Math.pow(Math.min(1, Math.max(0, n)), 1.7);
}

/**
 * The robe: a long tube from the waist that flares to the floor and ends in
 * torn tongues of fabric rather than a hem.
 *
 * It is cut *below* the ground at the back on purpose. The bottom rows collide
 * with the snow, so the surplus does not sink — it pools, and a garment that
 * pools is the single strongest cue that the figure has weight.
 */
function makeRobe() {
    const p = new ClothPanel({
        // Thirty-six columns is set by the fold count, not by smoothness: nine
        // pleats need four samples each to survive the grid at all, and the
        // Catmull-Rom reconstruction turns four samples per fold into a clean
        // wave. Twenty columns aliased them into a wobble.
        name: "robe", cols: 36, rows: 17, matId: M_ROBE,
        renderCols: 72, renderRows: 46,
        // Metres of surface, so the shader's weave and slub scales are physical.
        weaveU: 1.75, weaveV: 1.62,
        // The hem bake goes almost black: the reference's lower half is a
        // silhouette, and the shader's value ramp finishes the job.
        aoTop: 0.55, aoBottom: 0.20,
        collide: C_TORSO | C_LEGS, groundRows: 5,
    });

    // The instinct with an extra four rows of fabric is to pin them even more
    // loosely than the short robe's hem, since the extra length is all below
    // the knee and wants to trail. That is wrong, and a run at seven metres a
    // second shows why: apparent wind scales with the *square* of speed and the
    // hem's leverage scales with its length, so a metre of near-free fabric
    // does not trail, it lifts — the whole garment came off the legs and read
    // as a flat wing with a figure in front of it.
    //
    // So the floor is held at shape-memory-plus, around 0.8. It is enough of a
    // restoring pull that the rest shape — a column — survives a sprint, and
    // still loose enough that the hem lags a turn by a visible beat. Heavy wool
    // is also simply what this is: a floor-length robe weighs several kilos and
    // does not behave like a cape.
    const RATE = [
        Infinity, 30, 10, 4, 2.0, 1.5, 1.2, 1.05,
        0.95, 0.90, 0.88, 0.86, 0.84, 0.82, 0.80, 0.80, 0.78,
    ];

    for (let j = 0; j < p.rows; j++) {
        const v = j / (p.rows - 1);
        for (let i = 0; i < p.cols; i++) {
            const a = (i / p.cols) * Math.PI * 2;
            const sa = Math.sin(a), ca = Math.cos(a);
            // The flare accelerates downward, and the back flares furthest —
            // that extra fabric is what becomes the train.
            const f = Math.pow(v, 1.25);

            // Pleats. A garment cut as a smooth cone stays a smooth cone: the
            // solver has nothing to break the symmetry with, and a robe with no
            // vertical folds reads as a traffic cone no matter how good the
            // shading is. Putting the folds in the *rest shape* means the
            // constraints preserve them, they deepen toward the hem where the
            // fabric is loose, and they travel with the garment rather than
            // sliding across it the way a normal map would.
            //
            // Three incommensurate frequencies, so no two folds are alike and
            // the pattern never repeats around the tube.
            const fold =
                0.118 * Math.sin(a * 7 + 0.6) +
                0.055 * Math.sin(a * 12 + 2.1) +
                0.026 * Math.sin(a * 19 + 4.4);
            const pleat = 1 + f * fold;

            // ca = +1 at the front, -1 at the back. The hem hangs *lowest* at
            // the crest of a fold, where there is most fabric to hang — in
            // phase with the pleat it produced a row of hard spikes instead.
            //
            // Floor length front and back now, with the rags reaching further
            // still. The boots are gone from the silhouette entirely, which is
            // what lets the figure read as a column rather than as legs.
            const hemY = 0.045 + 0.075 * ca - 0.030 * Math.sin(a * 7 + 0.6)
                - 0.26 * ragDepth(a);
            const y = 0.990 + (hemY - 0.990) * v;

            const rx = (0.158 + (0.412 - 0.158) * f) * pleat;
            const rz = (0.128 + (0.384 - 0.128) * f * (1 - 0.14 * ca)) * pleat;

            const o = (j * p.cols + i) * 3;
            p.bindPos[o] = rx * sa;
            p.bindPos[o + 1] = y;
            p.bindPos[o + 2] = rz * ca - 0.010 * v;
            p.bone[j * p.cols + i] = B_ROOT;
            p.pinRate[j * p.cols + i] = RATE[j];
        }
    }
    p.finalise();
    return p;
}

/**
 * The over-mantle: the heavy cloak that carries the whole silhouette.
 *
 * This is the lightest-valued thing on the figure and the widest, so it is what
 * the eye reads first: a broad wedge of grey-lavender over the shoulders that
 * falls past the hips and tears out into tongues over a near-black robe. The
 * value split between the two layers is the design — a mantle the same value as
 * the robe collapses the figure into one dark mass no matter how it is cut.
 *
 * It stays clear of the forearms so the staff arm still reads, but it is long
 * enough now that its rags overlap the robe's, which is what makes the two
 * layers look like one ruined garment rather than two costume pieces.
 */
function makeMantle() {
    const p = new ClothPanel({
        // Forty-four columns, where the old short cape ran on twenty-eight.
        // The count is set by the fold count and the fold count by the drawing:
        // eleven narrow folds around a cloak, not four broad ones, and eleven
        // folds need four columns each to survive the grid. Twenty-eight
        // columns cannot carry eleven folds at any amplitude — they alias into
        // a slow wobble, which is exactly what the pale satin sheet was.
        name: "mantle", cols: 44, rows: 11, matId: M_MANTLE,
        renderCols: 88, renderRows: 34,
        weaveU: 1.55, weaveV: 1.20,
        aoTop: 0.92, aoBottom: 0.34,
        // The streamers reach the floor, so the bottom rows have to ride the
        // snow like the robe's do.
        collide: C_TORSO | C_ARM_L | C_ARM_R, groundRows: 3,
    });

    // Held to the same floor as the robe's, and for the same reason — see the
    // note there. The streamers hang to the knee, which is more leverage than
    // anything else on the figure has.
    const RATE = [
        Infinity, 40, 12, 4, 1.8, 1.3, 1.05, 0.95, 0.88, 0.84, 0.80,
    ];
    // The collar has to clear the torso it sits on: start it inside the
    // shoulders (0.176 across) and the top of the mantle only emerges at the
    // shoulder line, which reads as a flat plate bolted to the chest.
    //
    // Past the shoulders it keeps widening. The reference's cloak is markedly
    // wider than the body at the hip — that overhang is what makes the figure
    // read as tall, because it narrows the apparent waist by comparison.
    const RAD = [
        [0.00, 0.176, 0.148],
        [0.18, 0.226, 0.180],
        [0.45, 0.262, 0.222],
        [0.72, 0.300, 0.262],
        [1.00, 0.332, 0.296],
    ];
    const YT = [
        [0.00, 1.442, 0],
        [0.18, 1.348, 0],
        [0.45, 1.180, 0],
        [0.72, 0.980, 0],
        [1.00, 0.000, 0], // filled per column below
    ];

    for (let j = 0; j < p.rows; j++) {
        const v = j / (p.rows - 1);
        const [rx, rz] = curve(RAD, v);
        for (let i = 0; i < p.cols; i++) {
            const a = (i / p.cols) * Math.PI * 2;
            const sa = Math.sin(a), ca = Math.cos(a);
            // Front hangs shorter than the back, and the edge tears out into
            // the same rag field the robe uses — one storm, one garment.
            // Streamers. A hem that tears evenly all the way round reads as a
            // fringe; the reference has two or three narrow tongues hanging far
            // below the rest, and those are what sell "ruined" over "trimmed".
            // Rectified low-frequency lobes, so most of the tube is untouched
            // and a couple of places drop most of a metre.
            const streamer = 0.62 * Math.pow(
                Math.max(0, Math.sin(a * 2 + 0.9)), 6
            ) + 0.44 * Math.pow(Math.max(0, Math.sin(a * 3 - 1.8)), 8);
            YT[4][1] = 0.700 + 0.130 * ca + 0.030 * Math.sin(a * 7 + 1.4)
                - 0.30 * ragDepth(a + 1.1) - streamer;
            const y = curve(YT, v)[0];
            // Folds twice as deep as the old short cape carried, and three
            // times as many. The cloak is now the lightest large surface on the
            // figure, and a light surface with shallow folds is the one
            // combination that reads as moulded plastic: enough light on it to
            // see the shape, not enough shape to see.
            //
            // The 0.055 term is not scaled by `v`. Everything else here fades
            // out at the collar, which is right for a hem fold and wrong for the
            // shoulder — a cloak gathers where it is fastened, and leaving the
            // top perfectly round is what made the shoulders read as a moulded
            // yoke with cloth hanging off it.
            const pleat = 1
                + 0.055 * Math.sin(a * 11 + 1.4)
                + v * (0.125 * Math.sin(a * 11 + 1.4) + 0.068 * Math.sin(a * 7 - 0.6));
            // There is no cloth-cloth collision, so a streamer that hangs to
            // the knee has to be cut *outside* the robe's flare or it spends
            // half its life inside it. Widening only the streamer columns keeps
            // the rest of the mantle where it belongs.
            const flare = 1 + v * streamer * 0.58;

            const o = (j * p.cols + i) * 3;
            p.bindPos[o] = rx * sa * pleat * flare;
            p.bindPos[o + 1] = y;
            p.bindPos[o + 2] = rz * ca * pleat * flare - 0.012;
            p.bone[j * p.cols + i] = B_CHEST;
            p.pinRate[j * p.cols + i] = RATE[j];
        }
    }
    p.finalise();
    return p;
}

/**
 * A sleeve. Pinned tightly along the arm and genuinely loose only past the
 * wrist, where the cuff drapes. A fully free sleeve looks wonderful for about
 * four seconds and then slides off the elbow.
 */
function makeSleeve(side) {
    const s = side === 0 ? -1 : 1;
    const p = new ClothPanel({
        name: "sleeve" + side, cols: 10, rows: 8, matId: M_ROBE,
        renderCols: 26, renderRows: 20,
        weaveU: 0.46, weaveV: 0.66,
        aoTop: 0.6, aoBottom: 0.5,
        collide: side === 0 ? C_ARM_L : C_ARM_R,
    });

    const UP = [s * 0.185, 1.400, 0.000];
    const EL = [s * 0.230, 1.123, 0.000];
    const WR = [s * 0.243, 0.866, 0.016];

    // Beyond the wrist, continuing the forearm's direction.
    let dx = WR[0] - EL[0], dy = WR[1] - EL[1], dz = WR[2] - EL[2];
    const dl = Math.hypot(dx, dy, dz);
    dx /= dl; dy /= dl; dz /= dl;

    // (segment, t, radius) per row. Segment 0 = upper arm, 1 = forearm,
    // 2 = past the wrist.
    const ROWS = [
        [0, 0.00, 0.084], [0, 0.45, 0.076], [0, 1.00, 0.072],
        [1, 0.40, 0.068], [1, 0.75, 0.064], [1, 1.00, 0.061],
        [2, 0.045, 0.072], [2, 0.125, 0.098],
    ];
    const BONE = [
        B_UPPER_L, B_UPPER_L, B_UPPER_L,
        B_FORE_L, B_FORE_L, B_FORE_L, B_FORE_L, B_HAND_L,
    ];
    const BONE_R = [
        B_UPPER_R, B_UPPER_R, B_UPPER_R,
        B_FORE_R, B_FORE_R, B_FORE_R, B_FORE_R, B_HAND_R,
    ];
    const RATE = [Infinity, 50, 26, 40, 18, 9, 5, 1.2];

    for (let j = 0; j < p.rows; j++) {
        const [seg, t, r] = ROWS[j];
        let cx, cy, cz;
        if (seg === 0) {
            cx = UP[0] + (EL[0] - UP[0]) * t;
            cy = UP[1] + (EL[1] - UP[1]) * t;
            cz = UP[2] + (EL[2] - UP[2]) * t;
        } else if (seg === 1) {
            cx = EL[0] + (WR[0] - EL[0]) * t;
            cy = EL[1] + (WR[1] - EL[1]) * t;
            cz = EL[2] + (WR[2] - EL[2]) * t;
        } else {
            cx = WR[0] + dx * t; cy = WR[1] + dy * t; cz = WR[2] + dz * t;
        }
        for (let i = 0; i < p.cols; i++) {
            const a = (i / p.cols) * Math.PI * 2;
            const o = (j * p.cols + i) * 3;
            // The arm is near-vertical in the bind pose, so the ring lies in XZ.
            p.bindPos[o] = cx + Math.sin(a) * r;
            p.bindPos[o + 1] = cy;
            p.bindPos[o + 2] = cz + Math.cos(a) * r;
            p.bone[j * p.cols + i] = (side === 0 ? BONE : BONE_R)[j];
            p.pinRate[j * p.cols + i] = RATE[j];
        }
    }
    p.finalise();
    return p;
}

export function makePanels() {
    return [makeRobe(), makeMantle(), makeSleeve(0), makeSleeve(1)];
}

// -----------------------------------------------------------------------------
//  Solver
// -----------------------------------------------------------------------------

/** Constraint relaxation iterations. Six is where the robe stops looking rubbery. */
const ITERATIONS = 6;

/** Capsule table: [boneA, boneB, radius, mask]. Rebuilt from joints each frame. */
export const BODY_CAPSULES = [
    [B_ROOT, B_NECK, 0.175, C_TORSO],
    [B_THIGH_L, B_SHIN_L, 0.125, C_LEGS],
    [B_SHIN_L, B_FOOT_L, 0.098, C_LEGS],
    [B_THIGH_R, B_SHIN_R, 0.125, C_LEGS],
    [B_SHIN_R, B_FOOT_R, 0.098, C_LEGS],
    [B_UPPER_L, B_FORE_L, 0.078, C_ARM_L],
    [B_FORE_L, B_HAND_L, 0.068, C_ARM_L],
    [B_UPPER_R, B_FORE_R, 0.078, C_ARM_R],
    [B_FORE_R, B_HAND_R, 0.068, C_ARM_R],
];

export class ClothSolver {
    /**
     * @param {ClothPanel[]} panels
     * @param {{heightAt(x:number,z:number):number}} terrain
     */
    constructor(panels, terrain) {
        this.panels = panels;
        this.terrain = terrain;
        this._wind = new Float32Array(3);
        this._acc = new Float32Array(3);
        this._t = 0;
    }

    /**
     * @param {number} dt
     * @param {import("./figure.js").Figure} fig
     * @param {import("./controller.js").CharacterController} ch
     */
    update(dt, fig, ch) {
        // Two sub-steps at 30 Hz and below. Verlet with hard pins is stable but
        // a long step lets the hem overshoot through the legs before the
        // collision pass sees it.
        let h = Math.min(dt, 1 / 30);
        let steps = 1;
        if (h > 1 / 55) { steps = 2; h *= 0.5; }
        this._t += dt;

        // ---- apparent wind ----------------------------------------------
        const a = (S.windDirection * Math.PI) / 180;
        const ws = 3.2 * S.windStrength;
        // Gusts, so a standing figure's robe is never dead still.
        const gust = 1 + 0.35 * Math.sin(this._t * 0.7) + 0.18 * Math.sin(this._t * 2.3 + 1.1);
        this._wind[0] = Math.sin(a) * ws * gust - ch.velocity.x;
        this._wind[1] = 0.35 * Math.sin(this._t * 1.9);
        this._wind[2] = Math.cos(a) * ws * gust - ch.velocity.z;

        for (let s = 0; s < steps; s++) {
            for (let i = 0; i < this.panels.length; i++) {
                this._step(this.panels[i], h, fig, ch.grounded);
            }
        }
    }

    _step(p, h, fig, grounded) {
        const n = p.count;
        const pos = p.pos;
        const prev = p.prev;
        const target = p.target;
        const skin = fig.skin;

        // ---- kinematic targets, from the skeleton -------------------------
        for (let k = 0; k < n; k++) {
            const b = p.bone[k] * 16;
            const o = k * 3;
            const x = p.bindPos[o], y = p.bindPos[o + 1], z = p.bindPos[o + 2];
            target[o] = skin[b] * x + skin[b + 4] * y + skin[b + 8] * z + skin[b + 12];
            target[o + 1] = skin[b + 1] * x + skin[b + 5] * y + skin[b + 9] * z + skin[b + 13];
            target[o + 2] = skin[b + 2] * x + skin[b + 6] * y + skin[b + 10] * z + skin[b + 14];
        }

        // ---- integrate ----------------------------------------------------
        // Quadratic drag against the apparent wind. At walking pace this is a
        // fraction of gravity; at nineteen metres a second it is four times it,
        // which is what lays the robe out flat behind a surf run with no special
        // case anywhere.
        const wx = this._wind[0], wy = this._wind[1], wz = this._wind[2];
        const wmag = Math.hypot(wx, wy, wz);
        // Drag per unit of apparent wind, so the force below is quadratic in it.
        // Down from 0.085, which was tuned when the garments were a knee-length
        // robe and a shoulder cape. Both are now floor-length heavy wool, and
        // the coefficient here stands in for area over mass — which went the
        // wrong way for the old number when the mass tripled.
        const drag = 0.055 * wmag;
        const damp = Math.pow(0.90, h * 60);
        const h2 = h * h;

        for (let k = 0; k < n; k++) {
            if (!isFinite(p.pinRate[k])) continue; // welded; skip the integrator
            const o = k * 3;
            // Turbulence, hashed off the particle index so it does not pulse in
            // unison across the garment.
            const ph = k * 1.7 + this._t * 4.5;
            const tx = Math.sin(ph) * 0.9;
            const ty = Math.sin(ph * 1.31 + 2.1) * 0.7;
            const tz = Math.cos(ph * 0.87 + 0.4) * 0.9;

            const ax = wx * drag + tx * drag * 0.25;
            const ay = wy * drag - 9.81 + ty * drag * 0.25;
            const az = wz * drag + tz * drag * 0.25;

            const vx = (pos[o] - prev[o]) * damp;
            const vy = (pos[o + 1] - prev[o + 1]) * damp;
            const vz = (pos[o + 2] - prev[o + 2]) * damp;

            prev[o] = pos[o]; prev[o + 1] = pos[o + 1]; prev[o + 2] = pos[o + 2];
            pos[o] += vx + ax * h2;
            pos[o + 1] += vy + ay * h2;
            pos[o + 2] += vz + az * h2;
        }

        // ---- constraints ---------------------------------------------------
        for (let it = 0; it < ITERATIONS; it++) {
            this._anchors(p, h);
            this._distance(p, it);
        }
        this._collide(p, fig, grounded);
    }

    /** Pull each particle toward its skinned target at its own rate. */
    _anchors(p, h) {
        const n = p.count;
        const pos = p.pos;
        const target = p.target;
        for (let k = 0; k < n; k++) {
            const rate = p.pinRate[k];
            const o = k * 3;
            if (!isFinite(rate)) {
                pos[o] = target[o];
                pos[o + 1] = target[o + 1];
                pos[o + 2] = target[o + 2];
                continue;
            }
            if (rate <= 0) continue;
            // Divided by the iteration count so the total pull over one frame is
            // the rate the table asks for, not six times it.
            const w = (1 - Math.exp(-rate * h)) / ITERATIONS;
            pos[o] += (target[o] - pos[o]) * w;
            pos[o + 1] += (target[o + 1] - pos[o + 1]) * w;
            pos[o + 2] += (target[o + 2] - pos[o + 2]) * w;
        }
    }

    /**
     * Distance and bending constraints, Gauss-Seidel.
     *
     * Welded particles have infinite mass: they take none of the correction, so
     * a hem cannot drag the waistband off the hips.
     */
    _distance(p, iteration) {
        const { cols, rows, pos, restU, restV, restB, pinRate } = p;
        // Bending is solved softly and only on the later iterations. Solved hard
        // it fights the distance constraints and the garment goes stiff.
        const bendK = iteration >= ITERATIONS - 3 ? 0.22 : 0;

        for (let j = 0; j < rows; j++) {
            for (let i = 0; i < cols; i++) {
                const k = j * cols + i;

                // around the ring
                solveLink(pos, k, j * cols + ((i + 1) % cols), restU[k], pinRate, 1);
                // down the panel
                if (j + 1 < rows) {
                    solveLink(pos, k, (j + 1) * cols + i, restV[k], pinRate, 1);
                }
                // bending, two rows apart
                if (bendK > 0 && j + 2 < rows) {
                    solveLink(pos, k, (j + 2) * cols + i, restB[k], pinRate, bendK);
                }
            }
        }
    }

    /** Push particles out of the body capsules and off the snow. */
    _collide(p, fig, grounded) {
        const n = p.count;
        const pos = p.pos;
        const joint = fig.joint;

        for (let c = 0; c < BODY_CAPSULES.length; c++) {
            const cap = BODY_CAPSULES[c];
            if ((p.collide & cap[3]) === 0) continue;
            const a = cap[0] * 3, b = cap[1] * 3;
            const ax = joint[a], ay = joint[a + 1], az = joint[a + 2];
            const bx = joint[b], by = joint[b + 1], bz = joint[b + 2];
            const ex = bx - ax, ey = by - ay, ez = bz - az;
            const elen2 = ex * ex + ey * ey + ez * ez || 1e-6;
            const r = cap[2];

            for (let k = 0; k < n; k++) {
                if (!isFinite(p.pinRate[k])) continue;
                const o = k * 3;
                let t = ((pos[o] - ax) * ex + (pos[o + 1] - ay) * ey + (pos[o + 2] - az) * ez) / elen2;
                t = t < 0 ? 0 : t > 1 ? 1 : t;
                const cx = ax + ex * t, cy = ay + ey * t, cz = az + ez * t;
                let dx = pos[o] - cx, dy = pos[o + 1] - cy, dz = pos[o + 2] - cz;
                const d = Math.hypot(dx, dy, dz);
                if (d >= r || d < 1e-6) continue;
                const push = (r - d) / d;
                pos[o] += dx * push;
                pos[o + 1] += dy * push;
                pos[o + 2] += dz * push;
            }
        }

        // The hem rides on the snow rather than through it. Only the bottom rows
        // check, because that is the only place it can happen and `heightAt` is
        // a filtered lookup, not free.
        if (p.groundRows > 0 && grounded !== false) {
            const start = (p.rows - p.groundRows) * p.cols;
            for (let k = start; k < n; k++) {
                const o = k * 3;
                const g = this.terrain.heightAt(pos[o], pos[o + 2]) + 0.012;
                if (pos[o + 1] < g) pos[o + 1] = g;
            }
        }
    }
}

/**
 * One distance constraint. Mass weighting is binary — a welded particle does not
 * move at all — which is both correct and much cheaper than carrying inverse
 * masses through the inner loop.
 */
function solveLink(pos, ka, kb, rest, pinRate, stiffness) {
    const a = ka * 3, b = kb * 3;
    const dx = pos[b] - pos[a];
    const dy = pos[b + 1] - pos[a + 1];
    const dz = pos[b + 2] - pos[a + 2];
    const d = Math.hypot(dx, dy, dz);
    if (d < 1e-7) return;
    const diff = ((d - rest) / d) * stiffness;

    const fa = isFinite(pinRate[ka]);
    const fb = isFinite(pinRate[kb]);
    if (fa && fb) {
        const h = diff * 0.5;
        pos[a] += dx * h; pos[a + 1] += dy * h; pos[a + 2] += dz * h;
        pos[b] -= dx * h; pos[b + 1] -= dy * h; pos[b + 2] -= dz * h;
    } else if (fa) {
        pos[a] += dx * diff; pos[a + 1] += dy * diff; pos[a + 2] += dz * diff;
    } else if (fb) {
        pos[b] -= dx * diff; pos[b + 1] -= dy * diff; pos[b + 2] -= dz * diff;
    }
}
