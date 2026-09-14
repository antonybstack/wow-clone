/**
 * Spell 3 — Bloom. Targeted eruption: column + burst at the aim point.
 */
import { createCylinder, createSphere, createTorus } from "@babylonjs/lite";

import {
    addHidden,
    clamp01,
    createVoidMaterial,
    setPos,
    setScale,
    show,
    smooth01,
    stampMesh,
} from "./vfx.js";

const LIFE = 1.7;
const HEIGHT = 3.6;
const DAMAGE = 420;

export class Bloom {
    /**
     * @param {import("@babylonjs/lite").EngineContext} engine
     * @param {import("@babylonjs/lite").SceneContext} scene
     */
    constructor(engine, scene) {
        const colMat = createVoidMaterial({
            color: [0.09, 0.02, 0.16],
            emissive: [0.72, 0.18, 1.15],
        });
        const coreMat = createVoidMaterial({
            color: [0.12, 0.04, 0.18],
            emissive: [1.05, 0.4, 1.25],
        });
        const ringMat = createVoidMaterial({
            color: [0.06, 0.01, 0.1],
            emissive: [0.5, 0.12, 0.95],
        });
        this.column = stampMesh(
            createCylinder(engine, {
                height: 1,
                diameterTop: 0.28,
                diameterBottom: 0.95,
                tessellation: 12,
            }),
            "SpellBloom",
            colMat,
        );
        this.core = stampMesh(
            createSphere(engine, { diameter: 0.7, segments: 10 }),
            "SpellBloomCore",
            coreMat,
        );
        this.ring = stampMesh(
            createTorus(engine, { diameter: 1.7, thickness: 0.14, tessellation: 18 }),
            "SpellBloomRing",
            ringMat,
        );
        addHidden(scene, this.column);
        addHidden(scene, this.core);
        addHidden(scene, this.ring);

        this.active = false;
        this.t = 0;
        this.x = 0;
        this.y = 0;
        this.z = 0;
        this._hit = false;
        this._target = null;
    }

    /**
     * @param {import("./spellSystem.js").SpellFrame} ctx
     * @param {number} x @param {number} y @param {number} z
     */
    trigger(ctx, x, y, z) {
        this.x = x;
        this.y = y;
        this.z = z;
        this.t = 0;
        this.active = true;
        this._hit = false;
        this._target = ctx.target;
        show(this.column, true);
        show(this.core, true);
        show(this.ring, true);
    }

    /** @param {number} dt @param {import("./spellSystem.js").SpellFrame} ctx */
    update(dt, ctx) {
        if (!this.active) {
            return;
        }
        this.t += dt;
        const u = this.t / LIFE;
        if (u >= 1) {
            this.cancel();
            return;
        }
        const rise = smooth01(this.t / 0.28);
        const fall = 1 - clamp01((u - 0.42) / 0.58);
        const env = rise * fall;
        const h = HEIGHT * env;
        setPos(this.column, this.x, this.y + h * 0.5 + 0.04, this.z);
        setScale(this.column, 0.85 + 0.2 * rise, Math.max(0.08, h), 0.85 + 0.2 * rise);

        const pulse = env * (1 + 0.25 * Math.sin(this.t * 22));
        setPos(this.core, this.x, this.y + 0.28, this.z);
        setScale(this.core, pulse, pulse * 0.85, pulse);

        const ringS = 0.55 + 1.15 * rise;
        setPos(this.ring, this.x, this.y + 0.06, this.z);
        setScale(this.ring, ringS, 0.6 + 0.5 * env, ringS);

        ctx.lights.add(this.x, this.y + 0.9 + h * 0.25, this.z, 3.6, 0.42, 0.14, 0.78, 0.34 * env);

        if (!this._hit && this._target && this.t > 0.08) {
            ctx.strike(this._target, DAMAGE);
            this._hit = true;
        }
    }

    cancel() {
        this.active = false;
        show(this.column, false);
        show(this.core, false);
        show(this.ring, false);
    }
}
