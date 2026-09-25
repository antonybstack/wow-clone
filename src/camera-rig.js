/**
 * Third-person spring-arm — WoW framing on Lite ArcRotateCamera.
 *
 * Pivot is glued to the character. No attachControl, inertia 0.
 * LMB orbits without turning the body; RMB is mouselook.
 * Zoom and outward collision recovery are damped.
 * Lite's camera data, position helper and control split are documented at:
 * https://github.com/BabylonJS/Babylon-Lite/blob/master/docs/lite/architecture/02-camera.md
 * The WoW input and collision choices are explained in docs/camera-lite-audit.md.
 */
import { input } from "./input.js";
import { expDampFactor, getCameraPosition, setCameraLimits } from "@babylonjs/lite";

const PITCH_MIN = -0.72;
const PITCH_MAX = 1.15;
const DIST_MIN = 2.2;
const DIST_MAX = 42;
const PIVOT_HEIGHT = 0.55;
// Lite uses a half-life; preserve the existing 14/s zoom response.
const ZOOM_HALF_LIFE = Math.LN2 / 14;
const ARM_HALF_LIFE = 0.08;

function clamp(value, lo, hi) {
    return Math.min(hi, Math.max(lo, value));
}

/** Parent-facing yaw from ArcRotate alpha. Forward is (sin(yaw), 0, cos(yaw)). */
export function yawFromAlpha(alpha) {
    return Math.atan2(-Math.cos(alpha), -Math.sin(alpha));
}

export function alphaFromYaw(yaw) {
    return Math.atan2(-Math.cos(yaw), -Math.sin(yaw));
}

export class CameraRig {
    /**
     * @param {import("@babylonjs/lite").ArcRotateCamera} camera
     */
    constructor(camera) {
        this.camera = camera;
        camera.inertia = 0;
        camera.panningInertia = 0;
        camera.inertialAlphaOffset = 0;
        camera.inertialBetaOffset = 0;
        camera.inertialRadiusOffset = 0;
        camera.inertialPanningX = 0;
        camera.inertialPanningY = 0;

        this.yaw = yawFromAlpha(camera.alpha);
        this.pitch = clamp(Math.PI / 2 - camera.beta, PITCH_MIN, PITCH_MAX);
        this.distance = camera.radius;
        this.distanceTarget = camera.radius;
        this.pivotHeight = PIVOT_HEIGHT;
        this.trauma = 0;
        this.armDistance = camera.radius;
        setCameraLimits(camera, {
            lowerBetaLimit: Math.PI / 2 - PITCH_MAX,
            upperBetaLimit: Math.PI / 2 - PITCH_MIN,
            // Requested zoom stops at DIST_MIN; collision may bring the camera closer.
            lowerRadiusLimit: 0.05,
            upperRadiusLimit: DIST_MAX,
        });
    }

    /** Native Havok sweep installed by the owner of the player's physics world. */
    setCollisionSweep(sweep) { this.collisionSweep = sweep; }

    /** Add decaying view punch. Amount is metres of pivot travel. */
    impulse(amount) {
        this.trauma = Math.min(0.42, (this.trauma || 0) + amount);
    }

    /** Mouse look — call before locomotion so RMB facing matches this frame. */
    applyLook() {
        if (input.looking || input.lmb || input.rmb) {
            this.yaw += input.lookX;
            this.pitch = clamp(this.pitch + input.lookY, PITCH_MIN, PITCH_MAX);
        }
    }

    /**
     * @param {number} dt
     * @param {{ x: number, y: number, z: number }} feet
     */
    update(dt, feet) {
        this.distanceTarget = clamp(
            this.distanceTarget + input.zoomDelta * (this.distanceTarget * 0.35),
            DIST_MIN,
            DIST_MAX,
        );
        this.distance += (this.distanceTarget - this.distance) * expDampFactor(dt, ZOOM_HALF_LIFE);

        const camera = this.camera;
        camera.inertia = 0;
        camera.inertialAlphaOffset = 0;
        camera.inertialBetaOffset = 0;
        camera.inertialRadiusOffset = 0;
        camera.inertialPanningX = 0;
        camera.inertialPanningY = 0;

        let ox = 0, oy = 0, oz = 0;
        if (this.trauma > 0.001) {
            this.trauma *= Math.exp(-10 * dt);
            const t = performance.now() * 0.001;
            const a = this.trauma;
            ox = Math.sin(t * 73.1) * a;
            oy = Math.sin(t * 91.7) * a * 0.45;
            oz = Math.cos(t * 61.3) * a;
        } else {
            this.trauma = 0;
        }
        camera.target.x = feet.x + ox;
        camera.target.y = feet.y + this.pivotHeight + oy;
        camera.target.z = feet.z + oz;
        camera.alpha = alphaFromYaw(this.yaw);
        camera.beta = Math.PI / 2 - this.pitch;
        camera.radius = this.distance;
        const desiredRadius = camera.radius;
        // Lite computes the orbit endpoint, including its pitch limits.
        const hit = this.collisionSweep?.(camera.target, getCameraPosition(camera));
        const allowed = hit?.hasHit ? Math.max(0.05, desiredRadius * hit.fraction - 0.02) : desiredRadius;
        // Retract immediately; ease only the return after the obstruction clears.
        this.armDistance = dt <= 0 ? allowed : Math.min(allowed,
            this.armDistance + (allowed - this.armDistance) * expDampFactor(dt, ARM_HALF_LIFE));
        camera.radius = this.armDistance;
    }
}
