/**
 * Third-person spring-arm — WoW framing on Lite ArcRotateCamera.
 *
 * Pivot is glued to the character. No attachControl, inertia 0.
 * LMB orbits without turning the body; RMB is mouselook.
 * Only zoom is damped.
 */
import { input } from "./input.js";

const PITCH_MIN = -0.72;
const PITCH_MAX = 1.15;
const DIST_MIN = 2.2;
const DIST_MAX = 42;
const PIVOT_HEIGHT = 0.55;
const ZOOM_DAMP = 14;

function clamp(value, lo, hi) {
    return Math.min(hi, Math.max(lo, value));
}

function expDamp(cur, target, rate, dt) {
    return target + (cur - target) * Math.exp(-rate * dt);
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
    }

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
        this.distance = expDamp(this.distance, this.distanceTarget, ZOOM_DAMP, dt);

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
        camera.beta = clamp(Math.PI / 2 - this.pitch, 0.35, 2.29);
        camera.radius = this.distance;
    }
}
