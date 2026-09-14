/**
 * Spell 4 — Crystallise. Void shards around the aim; linger ~4s.
 */
import { createPolyhedron } from "@babylonjs/lite";

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

const COUNT = 5;
const STAND = 4.0;
const GROW = 0.45;
const FADE = 0.55;
const GOLDEN = 2.399963;
const DAMAGE = 40;
const TICK = 1;
const TICKS = 4;

export class Crystallize {
    /**
     * @param {import("@babylonjs/lite").EngineContext} engine
     * @param {import("@babylonjs/lite").SceneContext} scene
     */
    constructor(engine, scene) {
        const mat = createVoidMaterial({
            color: [0.08, 0.03, 0.16],
            emissive: [0.48, 0.16, 1.05],
        });
        /** @type {import("@babylonjs/lite").Mesh[]} */
        this.shards = [];
        for (let i = 0; i < COUNT; i++) {
            const mesh = stampMesh(
                createPolyhedron(engine, {
                    type: i % 2 === 0 ? 1 : 10,
                    sizeX: 0.22 + (i % 3) * 0.05,
                    sizeY: 0.48 + (i % 2) * 0.16,
                    sizeZ: 0.22 + ((i + 1) % 3) * 0.04,
                }),
                `SpellShard${i}`,
                mat,
            );
            addHidden(scene, mesh);
            this.shards.push(mesh);
        }
        this.active = false;
        this.t = 0;
        this.x = 0;
        this.y = 0;
        this.z = 0;
        this._seed = 0;
        this._ticks = 0;
        this._nextTick = 0;
        this._target = null;
        /** @type {{ x: number, y: number, z: number, yaw: number, spin: number }[]} */
        this._pose = [];
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
        this._seed = Math.random() * Math.PI * 2;
        this._ticks = 0;
        this._nextTick = 0.12;
        this._target = ctx.target;
        this._pose = [];
        for (let i = 0; i < COUNT; i++) {
            const a = this._seed + i * GOLDEN;
            const d = 0.45 + i * 0.22;
            this._pose.push({
                x: x + Math.cos(a) * d,
                y: y + 0.22 + (i % 3) * 0.18,
                z: z + Math.sin(a) * d,
                yaw: a,
                spin: 0.6 + i * 0.35,
            });
            show(this.shards[i], true);
        }
    }

    /** @param {number} dt @param {import("./spellSystem.js").SpellFrame} ctx */
    update(dt, ctx) {
        if (!this.active) {
            return;
        }
        this.t += dt;
        const total = GROW + STAND + FADE;
        if (this.t >= total) {
            this.cancel();
            return;
        }
        const grow = smooth01(this.t / GROW);
        const fade = 1 - clamp01((this.t - GROW - STAND) / FADE);
        const env = grow * fade;
        for (let i = 0; i < COUNT; i++) {
            const p = this._pose[i];
            const mesh = this.shards[i];
            const s = env * (0.85 + 0.2 * Math.sin(this.t * 3 + i));
            setPos(mesh, p.x, p.y + Math.sin(this.t * 2.1 + i) * 0.04, p.z);
            mesh.rotation.y = p.yaw + this.t * p.spin;
            mesh.rotation.z = 0.25 + i * 0.12;
            setScale(mesh, s, s * (1.15 + 0.1 * i), s);
        }
        ctx.lights.add(this.x, this.y + 0.55, this.z, 3.1, 0.34, 0.12, 0.72, 0.26 * env);

        while (this._target && this._ticks < TICKS && this.t >= this._nextTick) {
            ctx.strike(this._target, DAMAGE);
            this._ticks += 1;
            this._nextTick += TICK;
        }
    }

    cancel() {
        this.active = false;
        for (let i = 0; i < this.shards.length; i++) {
            show(this.shards[i], false);
        }
    }
}
