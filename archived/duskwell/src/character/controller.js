/**
 * Character locomotion. Motion only — the figure reads this state.
 *
 * WoW keyboard: W/S along facing, A/D turn (camera follows unless LMB
 * is orbiting), Q/E strafe. RMB snaps facing to the camera and A/D strafe.
 * Start and stop are instant. Default is a run; Shift walks.
 * Space jumps; hold Space to hop again on landing. Gravity owns Y in the air.
 */

import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Scalar } from "@babylonjs/core/Maths/math.scalar";
import { input } from "../core/input.js";
import { expDamp } from "../core/camera.js";

const _wish = new Vector3();
const _fwd = new Vector3();
const _right = new Vector3();
const _tmp = new Vector3();
const _n = new Vector3();

const WALK_SPEED = 2.5;
const RUN_SPEED = 7.0;
const TURN_RATE = 2.55;
/**
 * Straight up. 6.6 m/s against this gravity is a 1.05 m apex over 0.63 s.
 *
 * Was 8.4, which is 1.70 m — a figure 1.79 m tall clearing its own shoulders,
 * and high enough that the legs had nothing to do for most of the arc.
 */
const JUMP_SPEED = 6.6;
const GRAVITY = 20.8;
const GROUND_SNAP = 0.06;

const SURF_MAX = 19.5;
const SURF_THRUST = 11.0;
const SURF_DRAG = 0.42;
const SURF_TURN = 2.35; // rad/s at full steer
const SURF_GRIP = 7.5;

/**
 * Gait: cadence in full stride cycles per second, at walking and running pace.
 *
 * Stride *length* is derived from cadence here rather than the other way round,
 * because cadence is what the eye actually reads. A fixed 1.55 m stride cycled
 * the legs 4.5 times a second at the 7 m/s run — nine footfalls a second, a
 * blur, and a step the legs could not physically reach. Between a stroll and a
 * hard run a real cadence barely doubles; it is the stride that stretches.
 */
const CADENCE_WALK = 1.18;
const CADENCE_RUN = 2.05;

/**
 * Duty factor: the fraction of a cycle each foot carries weight.
 *
 * A walk overlaps (both feet down through the middle of it), a run has a flight
 * phase and no overlap at all. This is also the lever that lets a run cover a
 * 3.4 m stride on a 0.81 m leg: the stance only has to reach across
 * `duty * stride`, and the rest of the ground is covered in the air.
 */
const DUTY_WALK = 0.62;
const DUTY_RUN = 0.30;

/** Shortest stride worth holding at a crawl, metres. */
const STRIDE_MIN = 0.85;

/** Share of the stance excursion that sits in front of the hip at touchdown. */
export const CONTACT_SHARE = 0.42;

/** How far along the travel direction the grade is measured, metres. */
const GRADE_PROBE = 0.7;

/**
 * How hard a grade shortens the stride.
 *
 * Tuned to the least that holds the leg together: at 1.0 a 37° face was costing
 * 43% of the stride and cycling the legs six times a second, where 0.5 covers
 * the same slope with reach to spare.
 */
const GRADE_COST = 0.5;

export class CharacterController {
    /**
     * @param {{ heightAt(x:number,z:number):number, normalAt(x:number,z:number,out:Vector3):Vector3 }} terrain
     */
    constructor(terrain) {
        this.terrain = terrain;

        this.position = new Vector3(0, 0, 0);
        this.velocity = new Vector3(0, 0, 0);
        this.prevVelocity = new Vector3(0, 0, 0);
        this.acceleration = new Vector3(0, 0, 0);

        this.facing = 0; // yaw, radians
        this.speed = 0;
        this.speed01 = 0; // normalised against SURF_MAX, for FOV/wind

        /** 0 = walking, 1 = fully surfing. Eased. */
        this.surf = 0;
        this.surfActive = false;

        /**
         * 0 = not casting, 1 = fully in the bending stance. Written by the spell
         * system, read by the figure.
         *
         * It lives here rather than on the spell system because the figure
         * already reads the controller for everything else it poses from, and a
         * second source of "what is this character doing" is how the arms and the
         * legs end up disagreeing about which frame it is.
         */
        this.cast = 0;
        this.castAimX = 0;
        this.castAimY = 0;
        this.castAimZ = 1;

        /** Signed lean, -1..1 (right positive), from lateral acceleration. */
        this.lean = 0;
        /** Signed carve amount for wake shaping. Positive = turning right. */
        this.carve = 0;
        /**
         * 0..1, how hard the screen-space speed streaks should read. Deadbanded
         * well above walking pace: streaks at a jog make the demo feel cheap.
         */
        this.streak01 = 0;

        // ------------------------------------------------------------- gait
        this.gaitPhase = 0;
        /** Speed as a fraction of a full run. The figure poses off this. */
        this.run01 = 0;
        /**
         * Metres of travel per full stride cycle, and the fraction of that
         * cycle a foot is down.
         *
         * Published rather than re-derived in the figure: the phase that decides
         * *when* a foot plants and the offset that decides *where* have to come
         * out of the same two numbers, or the feet skate.
         */
        this.stride = STRIDE_MIN;
        this.duty = DUTY_WALK;
        /** Damped grade along the direction of travel, rise over run. */
        this.grade = 0;
        /** How far ahead of the body a foot touches down, metres. */
        this.stepAhead = 0;
        /**
         * Unit direction of travel — the axis the gait steps along.
         *
         * Not the same thing as the facing, and the difference is the whole of
         * strafing and backpedalling. Falls back to the facing when stopped.
         */
        this.moveDirX = 0;
        this.moveDirZ = 1;
        /**
         * True when the legs should be running a gait at all.
         *
         * One flag, read by the figure and by the contact system, because three
         * copies of "is this character walking" is three chances for the feet to
         * disagree with the footprints.
         */
        this.stepping = true;
        /** Set true for exactly one frame when a foot plants. */
        this.footfall = false;
        /** 0 = left foot, 1 = right foot — which foot just planted. */
        this.footIndex = 0;
        /** World position of the foot that just planted. */
        this.footPos = new Vector3();
        /** Impact strength 0..1, scales spray and deformation depth. */
        this.footImpact = 0;

        this.groundY = 0;
        this.groundNormal = new Vector3(0, 1, 0);
        this.grounded = true;

        /** Seconds airborne, and seconds since the last landing. */
        this.airTime = 0;
        this.landTime = 10;
        /** 0..1 how hard the last landing was, from the vertical speed at contact. */
        this.landImpact = 0;

        this._prevSpeed = 0;
    }

    /**
     * @param {number} dt
     * @param {import("../core/camera.js").CameraRig} rig
     */
    update(dt, rig) {
        const h = Math.min(dt, 1 / 30);

        this.prevVelocity.copyFrom(this.velocity);
        this.surfActive = false;
        this.surf = 0;

        this._walkStep(h, rig);

        // ---------------------------------------------------- integrate + snap
        this.position.x += this.velocity.x * h;
        this.position.z += this.velocity.z * h;

        this.groundY = this.terrain.heightAt(this.position.x, this.position.z);
        this.terrain.normalAt(this.position.x, this.position.z, this.groundNormal);
        this._vertical(h);

        // --------------------------------------------------------- bookkeeping
        this.speed = Math.hypot(this.velocity.x, this.velocity.z);
        this.speed01 = Scalar.Clamp(this.speed / SURF_MAX, 0, 1);

        this.acceleration.x = (this.velocity.x - this.prevVelocity.x) / h;
        this.acceleration.z = (this.velocity.z - this.prevVelocity.z) / h;

        this.lean = expDamp(this.lean, 0, 10, h);
        this.carve = 0;

        this.streak01 = this.surf * Scalar.Clamp((this.speed - 7) / 11, 0, 1);

        this._gait(h);
    }

    _walkStep(h, rig) {
        if (input.rmb) {
            // The rig already took `input.lookX` this frame, so taking the same
            // delta turns the body and the camera in lockstep.
            //
            // Assigning `facing = rig.yaw` instead snapped the character on the
            // frame RMB went down, by whatever gap an earlier LMB orbit had
            // opened between the two — which reads as the view jerking sideways
            // the instant you press the button. Any residual gap is closed by
            // the damp below rather than in one frame.
            this.facing += input.lookX;
            this.facing = angleDamp(this.facing, rig.yaw, 9, h);
        } else if (input.turn !== 0) {
            const d = input.turn * TURN_RATE * h;
            this.facing += d;
            // Keyboard turn yaws the camera too, unless LMB is orbiting.
            if (!input.lmb) rig.yaw += d;
        }

        const maxSpeed = input.walk ? WALK_SPEED : RUN_SPEED;
        const fx = Math.sin(this.facing);
        const fz = Math.cos(this.facing);
        const rx = Math.cos(this.facing);
        const rz = -Math.sin(this.facing);

        _wish.set(
            fx * input.forward + rx * input.strafe,
            0,
            fz * input.forward + rz * input.strafe
        );

        const wishLen = Math.hypot(_wish.x, _wish.z);
        if (wishLen > 0.001) {
            this.velocity.x = (_wish.x / wishLen) * maxSpeed;
            this.velocity.z = (_wish.z / wishLen) * maxSpeed;
        } else {
            this.velocity.x = 0;
            this.velocity.z = 0;
        }
    }

    _vertical(h) {
        if (this.grounded) {
            this.landTime += h;
            this.airTime = 0;
            if (input.jump) {
                this.velocity.y = JUMP_SPEED;
                this.grounded = false;
                this.position.y = this.groundY;
                return;
            }
            this.velocity.y = 0;
            this.position.y = expDamp(this.position.y, this.groundY, 26, h);
            if (this.position.y <= this.groundY + GROUND_SNAP) {
                this.position.y = this.groundY;
            }
            return;
        }

        this.airTime += h;
        this.velocity.y -= GRAVITY * h;
        this.position.y += this.velocity.y * h;
        if (this.position.y <= this.groundY && this.velocity.y <= 0) {
            // Landing. The figure reads `landImpact` and `landTime` to absorb
            // through the knees instead of arriving rigid.
            this.landImpact = Scalar.Clamp(-this.velocity.y / JUMP_SPEED, 0, 1.2);
            this.landTime = 0;
            this.position.y = this.groundY;
            this.velocity.y = 0;
            this.grounded = true;
        }
    }

    _surfStep(h, rig) {
        // Steer from the mouse (camera yaw drift) plus explicit A/D.
        const steer = Scalar.Clamp(
            input.moveX * 0.85 + angleDelta(this.facing, rig.yaw) * 1.25,
            -1,
            1
        );
        this.facing += steer * SURF_TURN * h;

        // Camera shake, and only from the one thing that earns it: an edge
        // loaded up at speed. Added as a rate rather than as an impulse, so it
        // reaches an equilibrium against the rig's own decay — hard carve at top
        // speed settles around 0.4 trauma, which is a couple of centimetres of
        // rig movement. Anything you can consciously see here is too much.
        const load = Math.abs(steer) * (this.speed / SURF_MAX);
        if (load > 0.25) rig.addTrauma((load - 0.25) * 1.35 * h);

        const fx = Math.sin(this.facing);
        const fz = Math.cos(this.facing);

        // Slope: heading downhill adds speed, uphill scrubs it.
        this.terrain.normalAt(this.position.x, this.position.z, _n);
        const slopeAssist = -(_n.x * fx + _n.z * fz) * 26;

        let thrust = SURF_THRUST + slopeAssist;
        if (input.moveZ < 0) thrust -= 14; // pull back to scrub speed

        this.velocity.x += fx * thrust * h;
        this.velocity.z += fz * thrust * h;

        // Lateral grip: kill sideways velocity, but not entirely — the residual
        // is what reads as a drift when you overcook the turn.
        const rx = Math.cos(this.facing);
        const rz = -Math.sin(this.facing);
        const lat = this.velocity.x * rx + this.velocity.z * rz;
        const grip = Math.min(1, SURF_GRIP * h);
        this.velocity.x -= rx * lat * grip;
        this.velocity.z -= rz * lat * grip;

        // Quadratic drag → a natural terminal speed.
        const s = Math.hypot(this.velocity.x, this.velocity.z);
        if (s > 0.0001) {
            const drag = SURF_DRAG * s * s * 0.02 + 0.9;
            const k = Math.max(0, s - drag * h) / s;
            this.velocity.x *= k;
            this.velocity.z *= k;
        }
        if (s > SURF_MAX) {
            const k = SURF_MAX / s;
            this.velocity.x *= k;
            this.velocity.z *= k;
        }
    }

    /**
     * Distance-driven gait. Phase advances with ground travelled, not with time,
     * which is what keeps feet planted instead of sliding.
     */
    _gait(h) {
        this.footfall = false;
        this.run01 = Scalar.Clamp(this.speed / RUN_SPEED, 0, 1);

        if (this.speed > 0.05) {
            this.moveDirX = this.velocity.x / this.speed;
            this.moveDirZ = this.velocity.z / this.speed;
        } else {
            this.moveDirX = Math.sin(this.facing);
            this.moveDirZ = Math.cos(this.facing);
        }

        // Cadence rises with pace, duty falls, and the stride is whatever
        // distance those two imply. Kept outside the `stepping` gate below so
        // the figure always has a sane pair of numbers to pose from.
        const cadence = CADENCE_WALK + (CADENCE_RUN - CADENCE_WALK) * this.run01;
        this.duty = DUTY_WALK + (DUTY_RUN - DUTY_WALK) * this.run01;
        // Shorter steps on a grade — what a person does, and what the leg can
        // afford. The stance excursion runs along the direction of travel, so a
        // slope along that direction costs the leg `grade * excursion` of
        // vertical span on top of the horizontal reach it already owes. Left to
        // its full length, a stride taken downhill put the trailing foot half a
        // metre below the hip and the leg simply could not span it.
        //
        // Damped, because this is a single point sample of a noisy heightfield
        // and the stride it feeds sets the rate the gait phase advances at — an
        // undamped grade pops the cadence frame to frame. Flat ground leaves
        // this at exactly 1.
        const probeX = this.position.x + this.moveDirX * GRADE_PROBE;
        const probeZ = this.position.z + this.moveDirZ * GRADE_PROBE;
        const sample = Math.abs(this.terrain.heightAt(probeX, probeZ) - this.groundY) / GRADE_PROBE;
        this.grade = expDamp(this.grade, sample, 6, h);
        this.stride = Math.max(STRIDE_MIN, this.speed / cadence / (1 + GRADE_COST * this.grade));
        // The body travels `duty * stride` while a foot is down, so that is how
        // far the foot must travel backwards relative to the hip. Splitting it
        // slightly behind-heavy puts contact ahead of the hip and toe-off well
        // behind it, which is where a real foot spends its stance.
        this.stepAhead = this.duty * this.stride * CONTACT_SHARE;

        // Feet stay on the board while surfing — and for the run-out afterwards.
        //
        // The surf blend eases to zero in a fifth of a second, but the momentum
        // takes two thirds of one to bleed off, and in between the character is
        // travelling at nineteen metres a second. The gait is distance-driven, so
        // it answered that with a twelve-hertz cadence and the legs blurred. A
        // sprint is the fastest thing anyone walks at; above it, glide.
        this.stepping = this.grounded && this.surf <= 0.5 && this.speed <= RUN_SPEED * 1.2;
        if (!this.stepping) {
            this.gaitPhase = 0;
            return;
        }

        const dist = this.speed * h;
        const prev = this.gaitPhase;
        this.gaitPhase = (this.gaitPhase + dist / this.stride) % 1;

        if (this.speed < 0.15) return;

        // Two plants per cycle, at phase 0.0 and 0.5.
        const crossed =
            (prev < 0.5 && this.gaitPhase >= 0.5) || this.gaitPhase < prev;
        if (!crossed) return;

        this.footfall = true;
        this.footIndex = this.gaitPhase < 0.5 ? 0 : 1;
        this.footImpact = Scalar.Clamp(0.35 + this.speed / RUN_SPEED, 0, 1.3);

        // Where the foot actually lands: `stepAhead` along the direction of
        // travel, offset to the correct side of it. Placing this under the body
        // left the footprints trailing the boots by most of a step at a run.
        //
        // Both terms use the travel frame, matching the figure — see the step
        // axis note in `_updateFeet` there.
        const side = this.footIndex === 0 ? -0.105 : 0.105;
        // Centred under the stepping hip, matching the figure.
        const hipAlong = Math.cos(this.facing) * this.moveDirX - Math.sin(this.facing) * this.moveDirZ;
        const ahead = this.stepAhead + hipAlong * (this.footIndex === 0 ? -0.10 : 0.10);
        this.footPos.set(
            this.position.x + this.moveDirX * ahead + this.moveDirZ * side,
            this.position.y,
            this.position.z + this.moveDirZ * ahead - this.moveDirX * side
        );
    }
}

// ------------------------------------------------------------------ helpers

/** Shortest signed delta from a to b, wrapped to [-PI, PI]. */
export function angleDelta(a, b) {
    let d = b - a;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return d;
}

/** Framerate-independent easing across the shortest arc. */
export function angleDamp(cur, target, rate, dt) {
    return cur + angleDelta(cur, target) * (1 - Math.exp(-rate * dt));
}
