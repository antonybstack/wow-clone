/**
 * Spell 5 — Vortex. Self shadow swirl (helix + ring). Hits the dummy if in range.
 */
import { createTorus, createTube } from "@babylonjs/lite";

import {
    addHidden,
    clamp01,
    createVoidMaterial,
    setPos,
    setScale,
    setYaw,
    show,
    smooth01,
    stampMesh,
} from "./vfx.js";

const HELICES = 3;
const HOLD = 1.55;
const RAMP = 0.35;
const FADE = 0.9;
const HIT_RANGE = 4.4;
const DAMAGE = 90;
const TURNS = 1.35;
const TOP = 2.55;

function helixPath(phase) {
    const path = [];
    const n = 18;
    for (let i = 0; i < n; i++) {
        const u = i / (n - 1);
        const ang = phase + u * TURNS * Math.PI * 2;
        const r = 1.15 - 0.4 * u;
        path.push({
            x: Math.cos(ang) * r,
            y: 0.12 + TOP * u,
            z: Math.sin(ang) * r,
        });
    }
    return path;
}

export class Vortex {
    /**
     * @param {import("@babylonjs/lite").EngineContext} engine
     * @param {import("@babylonjs/lite").SceneContext} scene
     */
    constructor(engine, scene) {
        const mat = createVoidMaterial({
            color: [0.05, 0.01, 0.1],
            emissive: [0.4, 0.12, 0.88],
        });
        const ringMat = createVoidMaterial({
            color: [0.06, 0.02, 0.12],
            emissive: [0.55, 0.16, 1.0],
        });
        this.ring = stampMesh(
            createTorus(engine, { diameter: 2.15, thickness: 0.09, tessellation: 22 }),
            "SpellVortexRing",
            ringMat,
        );
        addHidden(scene, this.ring);
        /** @type {import("@babylonjs/lite").Mesh[]} */
        this.helices = [];
        for (let i = 0; i < HELICES; i++) {
            const mesh = stampMesh(
                createTube(engine, {
                    path: helixPath((i / HELICES) * Math.PI * 2),
                    radius: 0.055,
                    tessellation: 6,
                }),
                `SpellVortexHelix${i}`,
                mat,
            );
            addHidden(scene, mesh);
            this.helices.push(mesh);
        }
        this.active = false;
        this.t = 0;
        this.spin = 0;
        this._hit = false;
    }

    trigger() {
        this.t = 0;
        this.spin = 0;
        this.active = true;
        this._hit = false;
        show(this.ring, true);
        for (let i = 0; i < this.helices.length; i++) {
            show(this.helices[i], true);
        }
    }

    /** @param {number} dt @param {import("./spellSystem.js").SpellFrame} ctx */
    update(dt, ctx) {
        if (!this.active) {
            return;
        }
        this.t += dt;
        const total = RAMP + HOLD + FADE;
        if (this.t >= total) {
            this.cancel();
            return;
        }
        const env = smooth01(this.t / RAMP) * (1 - smooth01((this.t - RAMP - HOLD) / FADE));
        this.spin += dt * (4.6 + 2.2 * env);
        const feet = ctx.feet;
        const x = feet.x;
        const y = feet.y;
        const z = feet.z;

        setPos(this.ring, x, y + 0.72, z);
        setYaw(this.ring, this.spin * 0.65);
        setScale(this.ring, 0.85 + 0.2 * env, 0.7 + 0.4 * env, 0.85 + 0.2 * env);

        for (let i = 0; i < this.helices.length; i++) {
            const mesh = this.helices[i];
            setPos(mesh, x, y, z);
            setYaw(mesh, this.spin);
            setScale(mesh, 1, env, 1);
        }

        // High and dim — chroma is on the meshes, not a purple flood on the robe.
        ctx.lights.add(x, y + 2.05, z, 1.7, 0.32, 0.14, 0.58, 0.14 * env);

        if (!this._hit && ctx.target) {
            const dx = ctx.target.position.x - x;
            const dz = ctx.target.position.z - z;
            if (Math.hypot(dx, dz) <= HIT_RANGE) {
                ctx.strike(ctx.target, DAMAGE);
                this._hit = true;
            }
        }
    }

    cancel() {
        this.active = false;
        show(this.ring, false);
        for (let i = 0; i < this.helices.length; i++) {
            show(this.helices[i], false);
        }
    }
}
