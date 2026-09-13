/**
 * The figure — skeleton, bind pose, and the procedural locomotion that poses it.
 *
 * There is no rig file and no animation data. Everything here is solved from the
 * motion state the controller already produces. The one thing that buys has to
 * be paid for in exchange: **feet plant rather than slide**.
 *
 * Planting is not approximated. When a foot enters stance its world position is
 * recorded and then held absolutely fixed while the body travels over it; the
 * leg is solved by two-bone IK to reach that fixed point. A foot in this rig
 * cannot slide, because during stance nothing in the code is capable of moving
 * it. The gait phase itself is driven by distance travelled, not by a clock, so
 * the stride length and the ground speed are the same number by construction.
 *
 * Bone convention: a bone's local +Y runs from its own joint toward its child,
 * so a hanging arm has +Y pointing at the floor. Geometry is authored in
 * bind-pose world space and skinned by `world * inverseBind`.
 *
 * Allocation: none per frame. Everything lives in flat arrays sized at
 * construction.
 */

import { setFrameFromDir, invertRigid, mul, xformPoint } from "../core/mat4.js";

// --------------------------------------------------------------- bone indices
export const B_ROOT = 0;
export const B_SPINE = 1;
export const B_CHEST = 2;
export const B_NECK = 3;
export const B_HEAD = 4;
export const B_HOOD = 5;
export const B_UPPER_L = 6;
export const B_FORE_L = 7;
export const B_HAND_L = 8;
export const B_UPPER_R = 9;
export const B_FORE_R = 10;
export const B_HAND_R = 11;
export const B_THIGH_L = 12;
export const B_SHIN_L = 13;
export const B_FOOT_L = 14;
export const B_THIGH_R = 15;
export const B_SHIN_R = 16;
export const B_FOOT_R = 17;
export const BONE_COUNT = 18;

/**
 * Bind pose, nine floats per bone: joint position, bone direction, front
 * reference. A 1.79 m figure with the pelvis at 0.95 — deliberately a little
 * long in the leg and narrow in the shoulder, because the silhouette is read at
 * fifteen metres through a robe and slightly heroic proportions survive that
 * better than accurate ones.
 */
const BIND = new Float32Array([
    /* ROOT    */ 0, 0.95, 0, 0, 1, 0, 0, 0, 1,
    /* SPINE   */ 0, 1.06, 0, 0, 1, 0, 0, 0, 1,
    /* CHEST   */ 0, 1.26, 0, 0, 1, 0, 0, 0, 1,
    /* NECK    */ 0, 1.46, 0, 0, 1, 0, 0, 0, 1,
    /* HEAD    */ 0, 1.55, 0, 0, 1, 0, 0, 0, 1,
    /* HOOD    */ 0, 1.55, 0, 0, 1, 0, 0, 0, 1,

    /* UPPER_L */ -0.185, 1.400, 0.000, -0.16, -0.987, 0, 0, 0, 1,
    /* FORE_L  */ -0.230, 1.123, 0.000, -0.05, -0.997, 0.06, 0, 0, 1,
    /* HAND_L  */ -0.243, 0.866, 0.016, -0.02, -0.992, 0.12, 0, 0, 1,
    /* UPPER_R */ 0.185, 1.400, 0.000, 0.16, -0.987, 0, 0, 0, 1,
    /* FORE_R  */ 0.230, 1.123, 0.000, 0.05, -0.997, 0.06, 0, 0, 1,
    /* HAND_R  */ 0.243, 0.866, 0.016, 0.02, -0.992, 0.12, 0, 0, 1,

    /* THIGH_L */ -0.100, 0.900, 0, 0, -1, 0, 0, 0, 1,
    /* SHIN_L  */ -0.100, 0.460, 0, 0, -1, 0, 0, 0, 1,
    /* FOOT_L  */ -0.100, 0.090, 0, 0, 0, 1, 0, 1, 0,
    /* THIGH_R */ 0.100, 0.900, 0, 0, -1, 0, 0, 0, 1,
    /* SHIN_R  */ 0.100, 0.460, 0, 0, -1, 0, 0, 0, 1,
    /* FOOT_R  */ 0.100, 0.090, 0, 0, 0, 1, 0, 1, 0,
]);

/** Segment lengths implied by the bind table, metres. */
const THIGH_LEN = 0.44;
const SHIN_LEN = 0.37;
const UPPER_LEN = 0.28;
const FORE_LEN = 0.26;

/** Pelvis height above the feet in the bind pose. */
const HIP_HEIGHT = 0.95;

/** What a leg can actually span, hip joint to ankle joint. */
const LEG_REACH = (THIGH_LEN + SHIN_LEN) * 0.995;
/** Ankle height above the sole, from the bind table. */
const ANKLE_H = 0.09;
/** Half the distance between the feet — the stance width. */
const STANCE_HALF = 0.105;
/** Half the distance between the hip joints. Must match the bind table. */
const HIP_HALF = 0.10;
/** How low the pelvis solve may go, as a fraction of the bind-pose height. */
const HIP_FLOOR = 0.62;
/**
 * How fast an unreachable plant is dragged back into range, m/s.
 *
 * A walking pace: fast enough to recover inside a tenth of a second, slow
 * enough to read as a foot scuffing round rather than teleporting.
 */
const RESCUE_RATE = 2.5;

/**
 * The ankle's path over a fixed contact point: heel strike, flat, heel off.
 *
 * This is what pays for a long stride. The contact point never moves during
 * stance — that part of the rig is untouched — but the ankle above it rises and
 * pitches over the toe on the way out, and an ankle 13 cm higher is an ankle the
 * hip can be 24 cm further away from. Without it a 0.81 m leg under a 0.86 m hip
 * can only swing the foot ±13 cm before the IK gives out, which is what turned
 * the run into the splits.
 */
const HEEL_STRIKE_LIFT = 0.035;
const HEEL_OFF = 0.13;
/** Stance fraction where the foot is flat: heel down before it, rolling after. */
const FLAT_AT = 0.45;
/** Foot pitch, radians. Negative is toe-up. */
const TOE_UP = -0.20;
const TOE_OFF = 0.62;

// ------------------------------------------------------- module-scope scratch
const _axes = new Float32Array(9);   // X, Y, Z of a composed basis
const _p = new Float32Array(6);      // IK: mid joint, then the reached end
const _knee = new Float32Array(6);
const _hip = new Float32Array(3);
const _sh = new Float32Array(3);

/**
 * Compose an orthonormal basis from yaw, then pitch about its own right axis,
 * then roll about its own forward axis. Writes X, Y, Z into `_axes`.
 *
 * Positive pitch leans forward, positive roll tips the head to the character's
 * right — which is the sign the controller's `lean` already uses.
 */
function composeBasis(yaw, pitch, roll) {
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    let xx = cy, xy = 0, xz = -sy;
    let yx = 0, yy = 1, yz = 0;
    let zx = sy, zy = 0, zz = cy;

    if (pitch !== 0) {
        const c = Math.cos(pitch), s = Math.sin(pitch);
        const nyx = yx * c + zx * s, nyy = yy * c + zy * s, nyz = yz * c + zz * s;
        const nzx = zx * c - yx * s, nzy = zy * c - yy * s, nzz = zz * c - yz * s;
        yx = nyx; yy = nyy; yz = nyz; zx = nzx; zy = nzy; zz = nzz;
    }
    if (roll !== 0) {
        const c = Math.cos(roll), s = Math.sin(roll);
        const nxx = xx * c - yx * s, nxy = xy * c - yy * s, nxz = xz * c - yz * s;
        const nyx = yx * c + xx * s, nyy = yy * c + xy * s, nyz = yz * c + xz * s;
        xx = nxx; xy = nxy; xz = nxz; yx = nyx; yy = nyy; yz = nyz;
    }

    _axes[0] = xx; _axes[1] = xy; _axes[2] = xz;
    _axes[3] = yx; _axes[4] = yy; _axes[5] = yz;
    _axes[6] = zx; _axes[7] = zy; _axes[8] = zz;
}

/**
 * Two-bone IK. Given a root joint, an end target and a pole direction, writes
 * the middle joint's world position into `out[0..2]` and the position the end
 * joint *actually* reached into `out[3..5]`.
 *
 * The target is pulled inside reach rather than clamped at it: a fully extended
 * leg reads as a stiff peg, and the last centimetre of reach is where all the
 * knee-lock artefacts live.
 *
 * Returning the reached point matters as much as the solve. Callers used to draw
 * the end bone at the *requested* target, so an out-of-reach ask left the boot
 * floating clear of the shin with the leg geometry smeared across the gap — a
 * quarter of a metre of it at a run. Nothing can ask for that now: the end bone
 * goes where the limb can put it.
 */
function solveTwoBone(rx, ry, rz, tx, ty, tz, px, py, pz, l1, l2, out) {
    let dx = tx - rx, dy = ty - ry, dz = tz - rz;
    let dist = Math.hypot(dx, dy, dz);
    const maxReach = (l1 + l2) * 0.995;
    // A two-bone chain cannot fold tighter than the difference of its segments
    // either. Inside that radius the cosine rule puts the middle joint *beyond*
    // the first segment's length and the limb comes apart: the cast pose can
    // collapse the trailing hand's target onto its own shoulder when the aim is
    // across the body, which stretched that upper arm from 0.28 m to 0.40 m.
    const minReach = Math.abs(l1 - l2) + 1e-3;
    if (dist < 1e-4) { dx = 0; dy = -1; dz = 0; dist = 1e-4; }
    if (dist > maxReach) dist = maxReach;
    else if (dist < minReach) dist = minReach;
    const inv = 1 / Math.hypot(dx, dy, dz);
    dx *= inv; dy *= inv; dz *= inv;

    // Cosine rule: how far along the root→target axis the middle joint projects.
    const a = (l1 * l1 - l2 * l2 + dist * dist) / (2 * dist);
    const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));

    // Pole, orthogonalised against the axis — this is what decides which way the
    // knee or elbow bends, and it has to be re-derived every frame because the
    // axis swings through it during a stride.
    const d = px * dx + py * dy + pz * dz;
    let ox = px - dx * d, oy = py - dy * d, oz = pz - dz * d;
    let ol = Math.hypot(ox, oy, oz);
    if (ol < 1e-5) { ox = 0; oy = 0; oz = 1; ol = 1; }
    ox /= ol; oy /= ol; oz /= ol;

    out[0] = rx + dx * a + ox * h;
    out[1] = ry + dy * a + oy * h;
    out[2] = rz + dz * a + oz * h;

    out[3] = rx + dx * dist;
    out[4] = ry + dy * dist;
    out[5] = rz + dz * dist;
}

/** Framerate-independent exponential approach. */
function damp(cur, target, rate, dt) {
    return target + (cur - target) * Math.exp(-rate * dt);
}

function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
}

/** Smoothstep on an already-normalised 0..1 input. */
function ease(t) {
    const x = t < 0 ? 0 : t > 1 ? 1 : t;
    return x * x * (3 - 2 * x);
}

export class Figure {
    /**
     * @param {{heightAt(x:number,z:number):number, normalAt(x:number,z:number,out:any):any}} terrain
     */
    constructor(terrain) {
        this.terrain = terrain;

        /** World matrix per bone. */
        this.world = new Float32Array(BONE_COUNT * 16);
        /** Bind-pose world matrix per bone. */
        this.bind = new Float32Array(BONE_COUNT * 16);
        /** Inverse of the above. */
        this.invBind = new Float32Array(BONE_COUNT * 16);
        /** `world * invBind` — the matrix geometry is actually skinned by. */
        this.skin = new Float32Array(BONE_COUNT * 16);

        /** World joint positions, three floats per bone. Cloth collision reads these. */
        this.joint = new Float32Array(BONE_COUNT * 3);

        for (let b = 0; b < BONE_COUNT; b++) {
            const o = b * 9;
            setFrameFromDir(
                this.bind, b * 16,
                BIND[o], BIND[o + 1], BIND[o + 2],
                BIND[o + 3], BIND[o + 4], BIND[o + 5],
                BIND[o + 6], BIND[o + 7], BIND[o + 8]
            );
            invertRigid(this.invBind, b * 16, this.bind, b * 16);
        }

        // ------------------------------------------------------------- gait
        /** Where each foot is planted, world. Frozen for the whole stance phase. */
        this.plant = new Float32Array(6);
        /**
         * Live sole position (equals `plant` during stance).
         *
         * This is the contact point, and the contact and deformation systems
         * read it — so it stays the sole, not the ankle, however the foot rolls.
         */
        this.footPos = new Float32Array(6);
        /** Ankle joint per foot — the point the leg IK is actually solved to. */
        this.ankle = new Float32Array(6);
        /** Foot pitch per foot, radians. Negative is toe-up. */
        this.footPitch = new Float32Array(2);
        /** Ground normal under each planted foot. */
        this.footNormal = new Float32Array([0, 1, 0, 0, 1, 0]);
        /** 1 while the foot carries weight, 0 mid-swing. Eased. */
        this.footWeight = new Float32Array([1, 1]);
        this._wasStance = [true, true];
        /** Set for one frame when a foot touches down. Drives spray and splats. */
        this.touchdown = [false, false];
        /**
         * The step axis each plant was made against, two floats per foot.
         *
         * A plant is only valid for the direction of travel it was made in. Turn
         * hard enough mid-stance and it is not somewhere the leg can reach any
         * more — see the re-plant in `_updateFeet`.
         */
        this.plantDir = new Float32Array([0, 1, 0, 1]);

        // ------------------------------------------------- smoothed pose state
        this.hipY = HIP_HEIGHT;
        this.pitch = 0;
        this.roll = 0;
        this.bob = 0;
        this.headYaw = 0;
        this.headPitch = 0;
        this.hoodYaw = 0;
        this.hoodPitch = 0;
        this.armPhase = 0;
        /** How far the figure has settled into the snow, metres. */
        this.sink = 0.04;

        this._t = 0;
        this._prevGait = 0;
        this._first = true;
    }

    /**
     * Foot / hip support height. In the air, hang under the body instead of
     * stretching down to the heightfield.
     * @param {import("./controller.js").CharacterController} ch
     */
    _supportY(ch, x, z) {
        if (!ch.grounded) return ch.position.y + 0.06;
        return this.terrain.heightAt(x, z) - this.sink * 0.7;
    }

    /**
     * Pose the skeleton for this frame.
     * @param {number} dt
     * @param {import("./controller.js").CharacterController} ch
     */
    update(dt, ch) {
        const h = Math.min(dt, 1 / 30);
        this._t += h;

        const surf = ch.surf;
        const speed = ch.speed;
        // The controller's own normalisation, against the real run speed. This
        // used to divide by 5.4 against a RUN_SPEED of 7.0, so everything keyed
        // off it — lean, crouch, arm swing, foot lift — saturated at four fifths
        // of a run and then stopped responding.
        const run = ch.run01;

        // ---------------------------------------------------------- footfalls
        // Stance/swing is derived from the same distance-driven phase the
        // controller uses to fire footfall events, so the visual plant and the
        // snow splat are the same instant by construction.
        this._updateFeet(h, ch);

        // -------------------------------------------------------- body attitude
        // Lean forward with speed, and *into* acceleration — the classic read
        // that a figure is pushing rather than being dragged.
        const fwdAcc =
            ch.acceleration.x * Math.sin(ch.facing) + ch.acceleration.z * Math.cos(ch.facing);
        // Clamped, because the accelerations at either end of a surf run are an
        // order of magnitude larger than anything walking produces: letting go at
        // top speed decelerates at 30 m/s^2, which unclamped throws the torso
        // twenty degrees backwards and reads as a fall rather than as a scrub.
        const air = ch.grounded ? 0 : clamp(ch.velocity.y, -10, 10) * 0.018;
        const pitchWant =
            0.10 * run
            + 0.012 * clamp(fwdAcc, -9, 22)
            + surf * (0.30 + 0.16 * ch.speed01)
            + air;
        this.pitch = damp(this.pitch, pitchWant, 7, h);

        const rollWant = ch.lean * (0.16 + 0.34 * surf);
        this.roll = damp(this.roll, rollWant, 8, h);

        // Vertical bob: the pelvis drops through each stance and rises over the
        // supporting leg, twice per stride. Suppressed while surfing, where the
        // stance is a static crouch.
        const bobWant = ch.grounded
            ? (1 - surf) * (-0.028 * run * (0.5 - 0.5 * Math.cos(4 * Math.PI * ch.gaitPhase)))
            : 0;
        this.bob = damp(this.bob, bobWant, 18, h);

        // Crouch: a little at running speed, a lot on the board, and a dip to
        // absorb a landing. Without the landing term the figure arrives from a
        // metre up with straight legs and stops dead, which reads as a dropped
        // prop rather than as a person.
        const absorb = ch.grounded
            ? 0.17 * ch.landImpact * Math.exp(-ch.landTime * 6.5)
            : 0;
        const crouch = 0.035 * run + surf * (0.13 + 0.05 * ch.speed01) + absorb;
        this.hipY = damp(this.hipY, HIP_HEIGHT - crouch, 9, h);

        // The figure settles into the snow it is standing on. Reading the real
        // depth would mean a GPU readback; this is the same number the contact
        // brushes are writing, held on the CPU.
        this.sink = damp(this.sink, 0.045 + surf * 0.055, 4, h);

        // ------------------------------------------------------------- spine
        const gx = ch.position.x;
        const gz = ch.position.z;

        composeBasis(ch.facing, this.pitch, this.roll);
        const rX = _axes[0], rY = _axes[1], rZ = _axes[2];
        const uX = _axes[3], uY = _axes[4], uZ = _axes[5];
        const fX = _axes[6], fY = _axes[7], fZ = _axes[8];

        this._capHipToReach(ch, gx, gz, rX, rY, rZ, uX, uY, uZ);

        // Controller owns world Y (ground snap + jump). Do not re-sample
        // the heightfield here or a jump lifts the camera and leaves the mesh.
        const rootY = ch.position.y - this.sink + this.hipY + this.bob;

        // Pelvis. Its yaw counter-rotates against the shoulders during a stride,
        // which is most of what stops a procedural walk reading as a shop dummy.
        const twist = (1 - surf) * 0.13 * run * Math.sin(2 * Math.PI * ch.gaitPhase);
        composeBasis(ch.facing + twist, this.pitch, this.roll);
        this._setBone(B_ROOT, gx, rootY, gz, _axes[3], _axes[4], _axes[5], _axes[6], _axes[7], _axes[8]);

        // Spine and chest lift along the pelvis up-axis, with the chest twisting
        // the opposite way and leaning a little further forward.
        const spineY = rootY + uY * 0.11;
        this._setBone(
            B_SPINE, gx + uX * 0.11, spineY, gz + uZ * 0.11,
            uX, uY, uZ, fX, fY, fZ
        );

        const chestTwist = -twist * 1.5;
        const chestPitch = this.pitch + 0.05 * run + surf * 0.10;
        composeBasis(ch.facing + chestTwist, chestPitch, this.roll * 1.15);
        const cUx = _axes[3], cUy = _axes[4], cUz = _axes[5];
        const cFx = _axes[6], cFy = _axes[7], cFz = _axes[8];
        const cRx = _axes[0], cRy = _axes[1], cRz = _axes[2];

        const chestX = gx + uX * 0.31, chestY = rootY + uY * 0.31, chestZ = gz + uZ * 0.31;
        this._setBone(B_CHEST, chestX, chestY, chestZ, cUx, cUy, cUz, cFx, cFy, cFz);

        const neckX = chestX + cUx * 0.20, neckY = chestY + cUy * 0.20, neckZ = chestZ + cUz * 0.20;
        this._setBone(B_NECK, neckX, neckY, neckZ, cUx, cUy, cUz, cFx, cFy, cFz);

        // ------------------------------------------------------------- head
        // Head stabilisation: the head stays much closer to level than the chest
        // it sits on. Real necks do this and it is very obvious when missing.
        this.headPitch = damp(this.headPitch, -chestPitch * 0.62 + surf * 0.10, 9, h);
        this.headYaw = damp(this.headYaw, ch.lean * -0.22, 6, h);
        composeBasis(ch.facing + chestTwist + this.headYaw, chestPitch + this.headPitch, this.roll * 0.5);
        const headX = neckX + cUx * 0.09, headY = neckY + cUy * 0.09, headZ = neckZ + cUz * 0.09;
        this._setBone(B_HEAD, headX, headY, headZ, _axes[3], _axes[4], _axes[5], _axes[6], _axes[7], _axes[8]);

        // The hood is a lagged copy. A hood that tracks the skull exactly reads
        // as a helmet; a few frames of lag reads as fabric.
        this.hoodYaw = damp(this.hoodYaw, ch.facing + chestTwist + this.headYaw, 11, h);
        this.hoodPitch = damp(this.hoodPitch, chestPitch + this.headPitch + 0.05, 9, h);
        composeBasis(this.hoodYaw, this.hoodPitch, this.roll * 0.5);
        this._setBone(B_HOOD, headX, headY, headZ, _axes[3], _axes[4], _axes[5], _axes[6], _axes[7], _axes[8]);

        // -------------------------------------------------------------- arms
        this._poseArms(h, ch, chestX, chestY, chestZ, cRx, cRy, cRz, cUx, cUy, cUz, cFx, cFy, cFz);

        // -------------------------------------------------------------- legs
        this._poseLeg(0, gx, rootY, gz, rX, rY, rZ, uX, uY, uZ, fX, fY, fZ);
        this._poseLeg(1, gx, rootY, gz, rX, rY, rZ, uX, uY, uZ, fX, fY, fZ);

        // ------------------------------------------------------------- skin
        for (let b = 0; b < BONE_COUNT; b++) {
            mul(this.skin, b * 16, this.world, b * 16, this.invBind, b * 16);
            this.joint[b * 3] = this.world[b * 16 + 12];
            this.joint[b * 3 + 1] = this.world[b * 16 + 13];
            this.joint[b * 3 + 2] = this.world[b * 16 + 14];
        }
    }

    /**
     * Lower the pelvis until both ankles are inside the legs' reach.
     *
     * Dropping the hips is what a person does when their feet are far apart, and
     * it is what lets this rig hold a 1.4 m stride on a 0.81 m leg. Without it
     * the IK simply ran out: at a run the hip was asking for an ankle 1.08 m
     * away, the solver clamped at 0.805, and the leg pointed at a boot it could
     * not reach.
     *
     * Applied to the damped height rather than to its target, so it holds on the
     * frame it is needed instead of a tenth of a second later. The pelvis then
     * bobbing twice a stride is not a separate effect — it is this, and a real
     * one falls out of the same geometry.
     */
    _capHipToReach(ch, gx, gz, rX, rY, rZ, uX, uY, uZ) {
        let cap = Infinity;
        for (let f = 0; f < 2; f++) {
            const side = f === 0 ? -HIP_HALF : HIP_HALF;
            const hx = gx + rX * side - uX * 0.05;
            const hz = gz + rZ * side - uZ * 0.05;
            const dx = this.ankle[f * 3] - hx;
            const dz = this.ankle[f * 3 + 2] - hz;
            const flat = Math.hypot(dx, dz);
            // The most vertical drop the leg has left once the horizontal
            // distance is paid for.
            const maxV = Math.sqrt(Math.max(0, LEG_REACH * LEG_REACH - flat * flat));
            const c = this.ankle[f * 3 + 1] + maxV - rY * side + uY * 0.05
                - ch.position.y + this.sink - this.bob;
            if (c < cap) cap = c;
        }
        // Floored: a foot planted somewhere genuinely impossible must not fold
        // the figure into the ground.
        if (this.hipY > cap) this.hipY = Math.max(cap, HIP_HEIGHT * HIP_FLOOR);
    }

    _setBone(b, px, py, pz, yx, yy, yz, zx, zy, zz) {
        // X = Y x Z, completing the frame from the bone axis and its front
        // reference. Both are already orthonormal at every call site.
        setFrameFromDir(this.world, b * 16, px, py, pz, yx, yy, yz, zx, zy, zz);
    }

    /**
     * Advance the stance/swing state machine and place both ankles.
     *
     * Stance is the whole point. `plant` is written on touchdown and read
     * unchanged for the rest of the stance, so no amount of body motion, camera
     * motion or frame-rate variation can move a planted foot. The three
     * exceptions all announce themselves below: standing squares the feet up
     * under the hips, a hard change of direction re-plants outright, and a plant
     * the leg cannot reach scuffs in rather than tearing the boot off the shin.
     */
    _updateFeet(h, ch) {
        const surf = ch.surf;
        const speed = ch.speed;
        const run = ch.run01;

        const fwdX = Math.sin(ch.facing), fwdZ = Math.cos(ch.facing);
        const rgtX = Math.cos(ch.facing), rgtZ = -Math.sin(ch.facing);

        // Feet start under the character rather than at the world origin, so the
        // pelvis solve below is not handed an impossible first frame.
        if (this._first) {
            this._first = false;
            for (let f = 0; f < 2; f++) {
                const o = f * 3;
                const side = f === 0 ? -STANCE_HALF : STANCE_HALF;
                const x = ch.position.x + rgtX * side;
                const z = ch.position.z + rgtZ * side;
                const y = this._supportY(ch, x, z);
                this.plant[o] = x; this.plant[o + 1] = y; this.plant[o + 2] = z;
                this.footPos[o] = x; this.footPos[o + 1] = y; this.footPos[o + 2] = z;
                this.ankle[o] = x; this.ankle[o + 1] = y + ANKLE_H; this.ankle[o + 2] = z;
                this.plantDir[f * 2] = fwdX;
                this.plantDir[f * 2 + 1] = fwdZ;
            }
        }

        // Airborne legs are their own problem — see below.
        if (!ch.grounded && surf <= 0.001) {
            this._airFeet(h, ch, fwdX, fwdZ, rgtX, rgtZ);
            return;
        }

        // Step geometry, straight from the controller. Re-deriving either of
        // these here is how the offset a foot is aimed at and the phase that
        // decides when to aim there end up disagreeing.
        const duty = ch.duty;
        const half = ch.stepAhead;

        // ---- the step axis is the direction of travel, not the facing -------
        //
        // Stepping along the facing while the body moved sideways stranded the
        // planted foot up to a full excursion — a metre at speed — out to the
        // side of its hip, and the pelvis solve then dropped the hips to their
        // floor trying to keep the leg in reach. That is why a strafe crouched
        // continuously and never stood back up.
        const stepX = ch.moveDirX, stepZ = ch.moveDirZ;
        // Stance width straddles the travel line. For forward motion this is
        // exactly the body's right axis as before; for a side-step it puts one
        // foot ahead of the other rather than both on the same line, where the
        // legs would have to pass through each other.
        const perpX = stepZ, perpZ = -stepX;
        // How much of the travel is actually forward. The heel-to-toe roll is
        // only meaningful when it is: side-stepping onto a pointed toe looks
        // like a ballet step, so the pitch fades out while the lift — which is
        // what buys the reach — stays.
        const along01 = clamp(stepX * fwdX + stepZ * fwdZ, 0, 1);
        // The excursion belongs to the leg, so it is centred under that leg's
        // hip rather than under the body. Walking forward the hips sit square
        // across the step axis and this is exactly zero; side-stepping they sit
        // along it, and without this the trailing leg pays for both its own
        // excursion and the 20 cm between the hips while the leading one pays
        // for neither.
        const hipAlong = rgtX * stepX + rgtZ * stepZ;
        // How far the body travels while a foot is down, and therefore the
        // offset behind the hip that the foot pushes off from.
        const excursion = duty * ch.stride;
        const liftAlong = half - excursion;
        /** Ankle height at toe-off — where the swing has to start from. */
        const toeOffH = HEEL_OFF * (0.55 + 0.45 * run);
        // The controller owns this decision — see `stepping` there. Re-deriving
        // it from `surf` here is how the feet and the footprints end up
        // disagreeing about whether the character is walking.
        const moving = speed > 0.2 && ch.stepping;

        for (let f = 0; f < 2; f++) {
            const o = f * 3;
            const side = f === 0 ? -STANCE_HALF : STANCE_HALF;
            const shift = hipAlong * (f === 0 ? -HIP_HALF : HIP_HALF);
            // Left foot leads; the right is half a cycle behind.
            const ph = (ch.gaitPhase + (f === 0 ? 0 : 0.5)) % 1;
            const stance = !moving || ph < duty;

            // Where this foot would land if it touched down right now.
            const nx = ch.position.x + stepX * (half + shift) + perpX * side;
            const nz = ch.position.z + stepZ * (half + shift) + perpZ * side;

            if (stance) {
                // A plant only makes sense for the direction it was made in.
                // Reverse at a run — 7 m/s one way to 7 m/s the other, which the
                // controller does in a single frame — and the foot behind you is
                // suddenly the foot in front of you, half a metre past anything
                // the leg can span, with the gap growing faster than any scuff
                // can close it. So the stance ends: the foot picks up and plants
                // again in the new frame, which is what a person does when they
                // change their mind at speed.
                const stale = moving
                    && stepX * this.plantDir[f * 2] + stepZ * this.plantDir[f * 2 + 1] < 0;

                if (!this._wasStance[f] || stale) {
                    // Touchdown.
                    this.plant[f * 3] = nx;
                    this.plant[f * 3 + 1] = this._supportY(ch, nx, nz);
                    this.plant[f * 3 + 2] = nz;
                    this.plantDir[f * 2] = stepX;
                    this.plantDir[f * 2 + 1] = stepZ;
                    this.touchdown[f] = true;
                } else {
                    this.touchdown[f] = false;
                }
                if (!moving) {
                    // Standing: ease the feet back under the hips rather than
                    // leaving them wherever the last stride dropped them.
                    // Squared up on the body's own axes, not the travel ones,
                    // which are stale by definition once it has stopped.
                    const sx = ch.position.x + rgtX * side + fwdX * 0.02;
                    const sz = ch.position.z + rgtZ * side + fwdZ * 0.02;
                    this.plant[f * 3] = damp(this.plant[f * 3], sx, 7, h);
                    this.plant[f * 3 + 2] = damp(this.plant[f * 3 + 2], sz, 7, h);
                    this.plant[f * 3 + 1] = damp(
                        this.plant[f * 3 + 1],
                        this._supportY(ch, this.plant[f * 3], this.plant[f * 3 + 2]),
                        7, h
                    );
                }
                // Rescue. Turning hard mid-stance leaves a foot planted for a
                // direction of travel the body has already abandoned, and no
                // amount of dropping the hips can reach it — a run that cut
                // from forward to a pure side-step left the boot 14 cm off the
                // end of the shin. So the plant scuffs in toward its hip, at a
                // bounded rate, until it is back inside the leg's envelope.
                //
                // This is the only place a plant moves during a stance, and it
                // only moves when the alternative is a detached leg.
                const hipSide = f === 0 ? -HIP_HALF : HIP_HALF;
                const hx = ch.position.x + rgtX * hipSide;
                const hz = ch.position.z + rgtZ * hipSide;
                const dx = this.plant[o] - hx;
                const dz = this.plant[o + 2] - hz;
                const flat = Math.hypot(dx, dz);
                if (flat > 1e-4) {
                    // Measured against the lowest the pelvis is allowed to go,
                    // so this only fires once the pelvis solve has run out too.
                    const vert = ch.position.y - this.sink + HIP_HEIGHT * HIP_FLOOR - 0.05
                        - (this.plant[o + 1] + ANKLE_H);
                    const maxFlat = Math.sqrt(Math.max(0, LEG_REACH * LEG_REACH - vert * vert));
                    if (flat > maxFlat) {
                        const pull = Math.min(flat - maxFlat, RESCUE_RATE * h) / flat;
                        this.plant[o] -= dx * pull;
                        this.plant[o + 2] -= dz * pull;
                        this.plant[o + 1] = this._supportY(ch, this.plant[o], this.plant[o + 2]);
                    }
                }

                this.footPos[f * 3] = this.plant[f * 3];
                this.footPos[f * 3 + 1] = this.plant[f * 3 + 1];
                this.footPos[f * 3 + 2] = this.plant[f * 3 + 2];
                this.footWeight[f] = damp(this.footWeight[f], 1, 22, h);

                // Heel strike, flat, then the heel lifts and the foot pivots on
                // the toe. The sole stays exactly where it was planted for the
                // whole stance — only the ankle above it moves, which is a pivot
                // and not a slide.
                const s = moving ? clamp(ph / duty, 0, 1) : FLAT_AT;
                let lift, pitch;
                if (s < FLAT_AT) {
                    const k = 1 - s / FLAT_AT;
                    lift = HEEL_STRIKE_LIFT * k;
                    pitch = TOE_UP * k * (0.35 + 0.65 * run);
                } else {
                    const k = ease((s - FLAT_AT) / (1 - FLAT_AT));
                    lift = HEEL_OFF * k * (0.55 + 0.45 * run);
                    pitch = TOE_OFF * k;
                }
                this.ankle[o] = this.footPos[o] + stepX * lift * 0.45;
                this.ankle[o + 1] = this.footPos[o + 1] + ANKLE_H + lift;
                this.ankle[o + 2] = this.footPos[o + 2] + stepZ * lift * 0.45;
                this.footPitch[f] = damp(this.footPitch[f], pitch * along01, 20, h);
            } else {
                this.touchdown[f] = false;
                // Swing, measured against the body rather than between two fixed
                // world points: the foot travels from the offset it pushed off
                // at, behind the hip, to the one it will touch down at, in front
                // of it.
                //
                // Easing a world-space gap instead let the body outrun the
                // swing. At 7 m/s the foot was still 0.92 m behind the hip a
                // third of the way through — 17 cm past anything a 0.81 m leg
                // can span — and the pelvis solve bottomed out trying to cover
                // it. A foot in the air is the one thing in this rig that is
                // *allowed* to move with the body, and this is why.
                const s = (ph - duty) / (1 - duty);
                const e = ease(s);
                // Both ends are continuous with the stance either side of them:
                // it leaves pitched up over the toe at the heel-off height, and
                // arrives with the heel a little high, ready to strike.
                const fade = 1 - ease(s / 0.35);
                const along = liftAlong + toeOffH * 0.45 * fade + (half - liftAlong) * e;
                const lift = toeOffH * fade
                    + HEEL_STRIKE_LIFT * ease((s - 0.6) / 0.4)
                    + Math.sin(Math.PI * s) * (0.055 + 0.12 * run);

                const sx = ch.position.x + stepX * (along + shift) + perpX * side;
                const sz = ch.position.z + stepZ * (along + shift) + perpZ * side;
                this.footPos[o] = sx;
                this.footPos[o + 1] = this._supportY(ch, sx, sz) + lift;
                this.footPos[o + 2] = sz;
                this.footWeight[f] = damp(this.footWeight[f], 0, 22, h);

                // Out of the push-off toe-down, rolling back through neutral to
                // toe-up in time for the next heel strike.
                const pitch = s < 0.5
                    ? TOE_OFF * (1 - s / 0.5) * 0.8
                    : TOE_UP * ease((s - 0.5) / 0.5) * (0.35 + 0.65 * run);
                this.footPitch[f] = damp(this.footPitch[f], pitch * along01, 14, h);
                this.ankle[o] = this.footPos[o];
                this.ankle[o + 1] = this.footPos[o + 1] + ANKLE_H;
                this.ankle[o + 2] = this.footPos[o + 2];
            }

            this._wasStance[f] = stance;
        }

        // Surfing: both feet ride the board, offset along the body's long axis
        // and rotated across the direction of travel. Blended in, never snapped.
        if (surf > 0.001) {
            for (let f = 0; f < 2; f++) {
                // Wide and staggered: feet apart across the direction of travel
                // for lateral stability, with the leading foot a little ahead.
                const lateral = f === 0 ? -0.17 : 0.17;
                const along = f === 0 ? 0.11 : -0.11;
                const sx = ch.position.x + fwdX * along + rgtX * lateral;
                const sz = ch.position.z + fwdZ * along + rgtZ * lateral;
                const sy = this._supportY(ch, sx, sz);
                const o = f * 3;
                this.footPos[o] += (sx - this.footPos[o]) * surf;
                this.footPos[o + 1] += (sy - this.footPos[o + 1]) * surf;
                this.footPos[o + 2] += (sz - this.footPos[o + 2]) * surf;
                this.footWeight[f] = Math.max(this.footWeight[f], surf);
                // Flat on the board, and the ankle follows the blended sole.
                this.ankle[o] = this.footPos[o];
                this.ankle[o + 1] = this.footPos[o + 1] + ANKLE_H;
                this.ankle[o + 2] = this.footPos[o + 2];
                this.footPitch[f] *= 1 - surf;
            }
        }
    }

    /**
     * Legs in the air: tuck on the way up, reach for the ground on the way down.
     *
     * Written straight rather than damped toward. The old path left the feet on
     * the ground state machine, easing them under the hips at a fixed rate while
     * the body climbed at 6 m/s — so they hung 13 cm below where the legs could
     * reach and the limbs stretched for the whole ascent. A jump is also the one
     * moment the legs are fully visible, so a tuck is worth having.
     */
    _airFeet(h, ch, fwdX, fwdZ, rgtX, rgtZ) {
        const vy = clamp(ch.velocity.y, -9, 9);
        // Rising: knees come up. Falling: the legs extend to meet the ground.
        const tuck = clamp(vy * 0.032, -0.05, 0.26);
        // And they split fore and aft, so it is a stride in the air rather than
        // a pair of scissors closed on the centreline.
        const split = clamp(vy * 0.016, -0.10, 0.10);

        for (let f = 0; f < 2; f++) {
            const o = f * 3;
            const side = f === 0 ? -STANCE_HALF : STANCE_HALF;
            const lead = f === 0 ? 1 : -0.75;
            const along = split * lead + 0.02;
            const up = tuck * (f === 0 ? 1 : 0.62);

            const x = ch.position.x + rgtX * side + fwdX * along;
            const z = ch.position.z + rgtZ * side + fwdZ * along;
            this.footPos[o] = x;
            this.footPos[o + 1] = ch.position.y + 0.02 + up;
            this.footPos[o + 2] = z;
            this.ankle[o] = x;
            this.ankle[o + 1] = this.footPos[o + 1] + ANKLE_H;
            this.ankle[o + 2] = z;

            // Toes pointed, a little more so on the tucked leg.
            this.footPitch[f] = damp(this.footPitch[f], 0.30 + up * 0.9, 10, h);
            this.footWeight[f] = damp(this.footWeight[f], 0, 14, h);
            this.touchdown[f] = false;
            // So the first ground frame after landing reads as a touchdown.
            this._wasStance[f] = false;
            this.plant[o] = x;
            this.plant[o + 1] = this.footPos[o + 1];
            this.plant[o + 2] = z;
            this.plantDir[f * 2] = ch.moveDirX;
            this.plantDir[f * 2 + 1] = ch.moveDirZ;
        }
    }

    /**
     * Solve one leg. `f` is 0 for left, 1 for right.
     *
     * The knee pole tilts outward as well as forward, because a knee that bends
     * in a perfectly sagittal plane looks mechanical — real legs track slightly
     * wide of the hip.
     */
    _poseLeg(f, rootX, rootY, rootZ, rX, rY, rZ, uX, uY, uZ, fX, fY, fZ) {
        const side = f === 0 ? -HIP_HALF : HIP_HALF;
        const hipB = f === 0 ? B_THIGH_L : B_THIGH_R;
        const shinB = f === 0 ? B_SHIN_L : B_SHIN_R;
        const footB = f === 0 ? B_FOOT_L : B_FOOT_R;

        // Hip joint, carried by the pelvis frame.
        _hip[0] = rootX + rX * side - uX * 0.05;
        _hip[1] = rootY + rY * side - uY * 0.05;
        _hip[2] = rootZ + rZ * side - uZ * 0.05;

        const ax = this.ankle[f * 3];
        const ay = this.ankle[f * 3 + 1];
        const az = this.ankle[f * 3 + 2];

        const outward = f === 0 ? -0.22 : 0.22;
        solveTwoBone(
            _hip[0], _hip[1], _hip[2], ax, ay, az,
            fX + rX * outward, fY + rY * outward, fZ + rZ * outward,
            THIGH_LEN, SHIN_LEN, _knee
        );
        // Where the ankle actually ended up. The pelvis solve above keeps this
        // equal to the target in every normal frame; on the rare one where it
        // cannot, the leg stays whole and the foot gives a little instead.
        const ex = _knee[3], ey = _knee[4], ez = _knee[5];

        this._setBone(
            hipB, _hip[0], _hip[1], _hip[2],
            _knee[0] - _hip[0], _knee[1] - _hip[1], _knee[2] - _hip[2],
            fX, fY, fZ
        );
        this._setBone(
            shinB, _knee[0], _knee[1], _knee[2],
            ex - _knee[0], ey - _knee[1], ez - _knee[2],
            fX, fY, fZ
        );

        // The foot carries the pitch the gait solved for it: toe-up into a heel
        // strike, flat under load, toe-down over the push-off and the swing.
        const pitch = this.footPitch[f];
        const c = Math.cos(pitch), s = Math.sin(pitch);
        // Rotate the foot's forward axis down about the body's right axis.
        const dx = fX * c - uX * s, dy = fY * c - uY * s, dz = fZ * c - uZ * s;
        this._setBone(footB, ex, ey, ez, dx, dy, dz, uX, uY, uZ);
    }

    /**
     * Arms. Counter-swing against the legs while walking, and a wide, low
     * bending stance while surfing — hands out and forward, which is the
     * Water Tribe pose in the reference and also just what a person does at
     * twenty metres a second.
     */
    _poseArms(h, ch, cx, cy, cz, rX, rY, rZ, uX, uY, uZ, fX, fY, fZ) {
        const surf = ch.surf;
        const run = ch.run01;
        const swing = Math.sin(2 * Math.PI * ch.gaitPhase) * (0.20 + 0.42 * run) * (1 - surf);
        // Slow idle drift so a standing figure is never perfectly still.
        const idle = Math.sin(this._t * 0.9) * 0.02 + Math.sin(this._t * 1.7 + 1.3) * 0.012;

        for (let a = 0; a < 2; a++) {
            const sgn = a === 0 ? -1 : 1;
            const upperB = a === 0 ? B_UPPER_L : B_UPPER_R;
            const foreB = a === 0 ? B_FORE_L : B_FORE_R;
            const handB = a === 0 ? B_HAND_L : B_HAND_R;

            // Shoulder, on the chest frame.
            _sh[0] = cx + rX * (sgn * 0.185) + uX * 0.14;
            _sh[1] = cy + rY * (sgn * 0.185) + uY * 0.14;
            _sh[2] = cz + rZ * (sgn * 0.185) + uZ * 0.14;

            // ---- walk target: hand swings fore and aft below the hip --------
            //
            // Every offset here is kept comfortably inside the arm's 0.54 m
            // reach. Put the target at or past full extension and the IK solver
            // does exactly what it is told — locks the elbow — and the figure
            // walks around with two straight poles for arms.
            const sw = swing * -sgn;
            let tx = _sh[0] + fX * (sw * 0.38) - uX * 0.43 + rX * (sgn * 0.11);
            let ty = _sh[1] + fY * (sw * 0.38) - uY * 0.43 + rY * (sgn * 0.11);
            let tz = _sh[2] + fZ * (sw * 0.38) - uZ * 0.43 + rZ * (sgn * 0.11);
            ty += idle * sgn;

            // ---- cast target: both hands up and out along the aim -----------
            //
            // A wide base, the leading hand extended along the flow and the
            // trailing hand drawn back across the body, so the arms describe the
            // arc the water is about to take. The right hand leads because that
            // is the hand the ribbon is emitted from.
            //
            // Blended, not switched, and it composes with the walk swing rather
            // than replacing it — a character casting while walking still walks.
            const cast = ch.cast;
            if (cast > 0.001) {
                const ax = ch.castAimX, ay = ch.castAimY, az = ch.castAimZ;
                // The leading hand reaches along the aim; the trailing one sits
                // low and inboard, cocked back.
                const lead = a === 1 ? 1 : 0;
                const outward = lead ? 0.30 : -0.16;
                const along = lead ? 0.52 : 0.16;
                const lift = lead ? 0.26 : 0.02;
                const cx = _sh[0] + rX * (sgn * 0.30 + outward * sgn) + ax * along + uX * lift;
                const cy = _sh[1] + rY * (sgn * 0.30) + ay * along + uY * lift + lift * 0.6;
                const cz = _sh[2] + rZ * (sgn * 0.30 + outward * sgn) + az * along + uZ * lift;
                tx += (cx - tx) * cast;
                ty += (cy - ty) * cast;
                tz += (cz - tz) * cast;
            }

            // ---- surf target: out, forward and a little down ----------------
            if (surf > 0.001) {
                const carve = ch.carve;
                // Trailing arm rises, leading arm drops into the turn — the
                // same asymmetry a snowboarder holds through a carve.
                const rise = 0.02 + carve * sgn * 0.22;
                const sx = _sh[0] + rX * (sgn * 0.33) + fX * 0.24 + uX * rise;
                const sy = _sh[1] + rY * (sgn * 0.33) + fY * 0.24 + uY * rise;
                const sz = _sh[2] + rZ * (sgn * 0.33) + fZ * 0.24 + uZ * rise;
                tx += (sx - tx) * surf;
                ty += (sy - ty) * surf;
                tz += (sz - tz) * surf;
            }

            // Elbows point back and out.
            const px = -fX + rX * (sgn * 0.55), py = -fY + rY * (sgn * 0.55) - 0.35, pz = -fZ + rZ * (sgn * 0.55);
            solveTwoBone(
                _sh[0], _sh[1], _sh[2], tx, ty, tz, px, py, pz,
                UPPER_LEN, FORE_LEN, _p
            );

            // Where the wrist actually reached. The cast target sits a good
            // 30 cm past full extension on purpose — it is an aim, not a
            // position — so drawing the hand at it tore the hand off the
            // forearm for the whole cast.
            const wx = _p[3], wy = _p[4], wz = _p[5];

            this._setBone(
                upperB, _sh[0], _sh[1], _sh[2],
                _p[0] - _sh[0], _p[1] - _sh[1], _p[2] - _sh[2],
                fX, fY, fZ
            );
            this._setBone(
                foreB, _p[0], _p[1], _p[2],
                wx - _p[0], wy - _p[1], wz - _p[2],
                fX, fY, fZ
            );
            // The hand continues the forearm, rolled palm-inward.
            let hx = wx - _p[0], hy = wy - _p[1], hz = wz - _p[2];
            const hl = Math.hypot(hx, hy, hz) || 1;
            hx /= hl; hy /= hl; hz /= hl;
            this._setBone(handB, wx, wy, wz, hx, hy, hz, fX, fY, fZ);
        }
    }

    /** World position of a hand, for spell emitters. Writes 3 floats to `out`. */
    handPosition(which, out, od) {
        const b = which === 0 ? B_HAND_L : B_HAND_R;
        xformPoint(this.world, b * 16, 0, 0.09, 0, out, od);
    }
}

export { HIP_HEIGHT };
