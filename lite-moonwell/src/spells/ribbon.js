/**
 * Spell 2 — Ribbon. Held beam from the staff tip to the aim; release kills it.
 */
import { createCylinder, createSphere } from "@babylonjs/lite";

import {
    addHidden,
    alignY,
    createVoidMaterial,
    setPos,
    setScale,
    show,
    stampMesh,
} from "./vfx.js";

const UNTARGETED = 8.2;
const THICK = 0.16;
const ORBS = 5;
const DAMAGE = 55;
const TICK = 1;

export class Ribbon {
    /**
     * @param {import("@babylonjs/lite").EngineContext} engine
     * @param {import("@babylonjs/lite").SceneContext} scene
     */
    constructor(engine, scene) {
        const mat = createVoidMaterial({
            color: [0.08, 0.02, 0.14],
            emissive: [0.85, 0.28, 1.2],
        });
        const orbMat = createVoidMaterial({
            color: [0.1, 0.03, 0.16],
            emissive: [1.05, 0.38, 1.3],
        });
        this.beam = stampMesh(
            createCylinder(engine, {
                height: 1,
                diameterTop: 0.05,
                diameterBottom: 0.14,
                tessellation: 10,
            }),
            "SpellRibbon",
            mat,
        );
        addHidden(scene, this.beam);
        /** @type {import("@babylonjs/lite").Mesh[]} */
        this.orbs = [];
        for (let i = 0; i < ORBS; i++) {
            const orb = stampMesh(
                createSphere(engine, { diameter: 0.22, segments: 8 }),
                `SpellRibbonOrb${i}`,
                orbMat,
            );
            addHidden(scene, orb);
            this.orbs.push(orb);
        }
        this.active = false;
        this.held = false;
        this._tickAcc = 0;
        this._target = null;
    }

    /** @param {import("./spellSystem.js").SpellFrame} ctx */
    trigger(ctx) {
        this.held = true;
        this.active = true;
        this._tickAcc = TICK;
        this._target = ctx.target;
        show(this.beam, true);
        for (let i = 0; i < this.orbs.length; i++) {
            show(this.orbs[i], true);
        }
        this._place(ctx);
    }

    release() {
        this.held = false;
        this.active = false;
        this._target = null;
        show(this.beam, false);
        for (let i = 0; i < this.orbs.length; i++) {
            show(this.orbs[i], false);
        }
    }

    /** @param {number} dt @param {import("./spellSystem.js").SpellFrame} ctx */
    update(dt, ctx) {
        if (!this.active || !this.held) {
            return;
        }
        this._place(ctx);
        const dummy = ctx.target;
        if (!dummy) {
            this._tickAcc = TICK;
            return;
        }
        this._tickAcc += dt;
        while (this._tickAcc >= TICK) {
            ctx.strike(dummy, DAMAGE);
            this._tickAcc -= TICK;
        }
    }

    /** @param {import("./spellSystem.js").SpellFrame} ctx */
    _place(ctx) {
        const o = ctx.origin;
        const dummy = ctx.target;
        let tx;
        let ty;
        let tz;
        if (dummy) {
            tx = dummy.position.x;
            ty = dummy.position.y + 0.85;
            tz = dummy.position.z;
        } else {
            tx = o.x + ctx.aimX * UNTARGETED;
            ty = o.y - 0.25;
            tz = o.z + ctx.aimZ * UNTARGETED;
        }
        const dx = tx - o.x;
        const dy = ty - o.y;
        const dz = tz - o.z;
        const len = Math.hypot(dx, dy, dz) || 0.05;
        setPos(this.beam, (o.x + tx) * 0.5, (o.y + ty) * 0.5, (o.z + tz) * 0.5);
        alignY(this.beam, dx, dy, dz);
        setScale(this.beam, THICK / 0.08, len, THICK / 0.08);
        for (let i = 0; i < this.orbs.length; i++) {
            const u = (i + 1) / (this.orbs.length + 1);
            setPos(this.orbs[i], o.x + dx * u, o.y + dy * u, o.z + dz * u);
        }
        ctx.lights.add(
            (o.x + tx) * 0.5,
            (o.y + ty) * 0.5,
            (o.z + tz) * 0.5,
            2.4,
            0.4,
            0.14,
            0.72,
            0.22,
        );
    }

    cancel() {
        this.release();
    }
}
