/**
 * Spell 1 — Sweep. Short-lived shadow crescent along the ground toward the aim.
 */
import { createBox, createRibbon } from "@babylonjs/lite";

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

const COLS = 16;
const CURVE = 4.4;
const ARC = 0.82;
const LIFE = 1.15;
const UNTARGETED = 9.5;
const DAMAGE = 180;

function crescentPaths() {
    const top = [];
    const bot = [];
    for (let i = 0; i < COLS; i++) {
        const u = i / (COLS - 1);
        const th = (u - 0.5) * 2 * ARC;
        const px = Math.sin(th) * CURVE;
        const pz = -CURVE + Math.cos(th) * CURVE;
        const horn = 1 - (th / ARC) * (th / ARC);
        top.push({ x: px, y: 0.16 + 0.82 * horn, z: pz });
        bot.push({ x: px, y: 0.03, z: pz });
    }
    return [bot, top];
}

export class Sweep {
    /**
     * @param {import("@babylonjs/lite").EngineContext} engine
     * @param {import("@babylonjs/lite").SceneContext} scene
     */
    constructor(engine, scene) {
        const mat = createVoidMaterial({
            color: [0.04, 0.01, 0.08],
            emissive: [0.42, 0.1, 0.92],
        });
        const crestMat = createVoidMaterial({
            color: [0.08, 0.02, 0.12],
            emissive: [0.95, 0.28, 1.25],
        });
        this.sheet = stampMesh(
            createRibbon(engine, { pathArray: crescentPaths() }),
            "SpellSweep",
            mat,
        );
        this.crest = stampMesh(
            createBox(engine, { width: 2.6, height: 0.55, depth: 0.28 }),
            "SpellSweepCrest",
            crestMat,
        );
        addHidden(scene, this.sheet);
        addHidden(scene, this.crest);

        this.active = false;
        this.t = 0;
        this.ox = 0;
        this.oy = 0;
        this.oz = 0;
        this.dx = 0;
        this.dz = 1;
        this.range = UNTARGETED;
        this.yaw = 0;
        this._hit = false;
        this._target = null;
    }

    /**
     * @param {import("./spellSystem.js").SpellFrame} ctx
     * @param {number} ax
     * @param {number} az
     */
    trigger(ctx, ax, az) {
        const fl = Math.hypot(ax, az) || 1;
        this.dx = ax / fl;
        this.dz = az / fl;
        this.yaw = Math.atan2(this.dx, this.dz);
        const feet = ctx.feet;
        this.ox = feet.x + this.dx * 1.15;
        this.oy = feet.y + 0.04;
        this.oz = feet.z + this.dz * 1.15;
        const dummy = ctx.target;
        if (dummy) {
            const dist = Math.hypot(dummy.position.x - this.ox, dummy.position.z - this.oz);
            this.range = Math.max(2.4, dist);
            this._target = dummy;
        } else {
            this.range = UNTARGETED;
            this._target = null;
        }
        this.t = 0;
        this._hit = false;
        this.active = true;
        show(this.sheet, true);
        show(this.crest, true);
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
        const env = smooth01(this.t / 0.16) * (1 - clamp01((u - 0.58) / 0.42));
        const reach = 0.4 + (this.range - 0.4) * smooth01(u / 0.72);
        const x = this.ox + this.dx * reach;
        const z = this.oz + this.dz * reach;
        const y = this.oy;
        setPos(this.sheet, x, y, z);
        setYaw(this.sheet, this.yaw);
        setScale(this.sheet, 1, env, 1);
        setPos(this.crest, x + this.dx * 0.18, y + 0.22 * env, z + this.dz * 0.18);
        setYaw(this.crest, this.yaw);
        setScale(this.crest, 0.85 + 0.25 * env, env, 1);

        ctx.lights.add(x, y + 0.45, z, 3.2, 0.36, 0.12, 0.7, 0.28 * env);

        if (!this._hit && this._target && reach > this.range - 0.85) {
            ctx.strike(this._target, DAMAGE);
            this._hit = true;
        }
    }

    cancel() {
        this.active = false;
        show(this.sheet, false);
        show(this.crest, false);
    }
}
