/**
 * Lite spell dispatch — five void abilities matching parent roles, mesh+light VFX.
 *
 * @typedef {{
 *   dt: number,
 *   time: number,
 *   player: object,
 *   hero: object|null,
 *   targeting: object,
 *   rig: object,
 *   origin: { x: number, y: number, z: number },
 *   feet: { x: number, y: number, z: number },
 *   target: object|null,
 *   aimX: number,
 *   aimZ: number,
 *   aimPoint: { x: number, y: number, z: number },
 *   lights: ReturnType<import("./lights.js").createLightPool>,
 *   strike: (dummy: object, amount?: number) => void,
 * }} SpellFrame
 */

import { input } from "../input.js";
import { Bloom } from "./bloom.js";
import { Crystallize } from "./crystallize.js";
import { createLightPool } from "./lights.js";
import { Ribbon } from "./ribbon.js";
import { Sweep } from "./sweep.js";
import { Vortex } from "./vortex.js";
import { feetOf, staffOrigin } from "./vfx.js";

const AIM_RANGE = 9.2;
const CAST_HOLD = 0.55;
const GCD = 1;
const SPELL_RANGE = 28;
const DUMMY_HP_MAX = 10000;

function expDamp(cur, target, rate, dt) {
    return target + (cur - target) * Math.exp(-rate * dt);
}

function strike(dummy, amount = 1) {
    if (!dummy) {
        return;
    }
    dummy.hits = (dummy.hits || 0) + 1;
    dummy.stubDamage = (dummy.stubDamage || 0) + amount;
    const max = dummy.hpMax || DUMMY_HP_MAX;
    if (typeof dummy.hp !== "number") {
        dummy.hp = max;
        dummy.hpMax = max;
    }
    dummy.hp -= amount;
    if (dummy.hp < 1) {
        dummy.hp = max;
    }
}

function inSpellRange(dummy, feet) {
    if (!dummy?.position || !feet) {
        return false;
    }
    return Math.hypot(dummy.position.x - feet.x, dummy.position.z - feet.z) <= SPELL_RANGE;
}

export class SpellSystem {
    /**
     * @param {{
     *   engine: import("@babylonjs/lite").EngineContext,
     *   scene: import("@babylonjs/lite").SceneContext,
     *   player: object,
     *   hero: object|null,
     *   targeting: object,
     *   rig: object,
     * }} opts
     */
    constructor(opts) {
        this.engine = opts.engine;
        this.scene = opts.scene;
        this.player = opts.player;
        this.hero = opts.hero || null;
        this.targeting = opts.targeting;
        this.rig = opts.rig;

        this.lights = createLightPool(opts.scene);
        this.sweep = new Sweep(opts.engine, opts.scene);
        this.ribbon = new Ribbon(opts.engine, opts.scene);
        this.bloom = new Bloom(opts.engine, opts.scene);
        this.crystallize = new Crystallize(opts.engine, opts.scene);
        this.vortex = new Vortex(opts.engine, opts.scene);
        this.spells = [this.sweep, this.ribbon, this.bloom, this.crystallize, this.vortex];

        this.castBlend = 0;
        this.debugRibbon = false;
        this.lastCast = -99;
        this.gcdLeft = 0;
        this.range = SPELL_RANGE;
        this._channelLock = false;
        this._time = 0;
        this._origin = { x: 0, y: 0, z: 0 };
        this._aimPoint = { x: 0, y: 0, z: 0 };
        this._frame = null;
    }

    _syncGcd() {
        this.gcdLeft = Math.max(0, GCD - (this._time - this.lastCast));
        return this.gcdLeft;
    }

    /** @param {number} dt */
    update(dt) {
        this._time += dt;
        this._syncGcd();
        const ctx = this._frame = this._buildFrame(dt);

        this.lights.begin();
        const key = input.spellPressed;
        if (key && key !== 2) {
            this.cast(key);
        } else {
            this._holdRibbon(input.spellHeld2 || this.debugRibbon);
        }
        input.spellPressed = 0;

        for (let i = 0; i < this.spells.length; i++) {
            this.spells[i].update(dt, ctx);
        }
        this.lights.end();

        const casting = this.ribbon.held || this._time - this.lastCast < CAST_HOLD ? 1 : 0;
        this.castBlend = expDamp(this.castBlend, casting, casting ? 7 : 3.2, dt);
        this.player.setCastBlend?.(this.castBlend);
    }

    /**
     * Fire one spell by key. Console-safe (`MOONWELL.spells.cast(3)`).
     * @param {number} key 1..5
     */
    cast(key) {
        if (key === 2) {
            this.debugRibbon = true;
            this._channelLock = false;
            this._holdRibbon(true);
            return;
        }
        if (key !== 1 && key !== 3 && key !== 4 && key !== 5) {
            return;
        }
        if (this._syncGcd() > 0) {
            return;
        }
        const ctx = this._frame = this._buildFrame(this._frame?.dt || 0);
        if (ctx.target && !inSpellRange(ctx.target, ctx.feet)) {
            return;
        }

        this.debugRibbon = false;
        this._channelLock = false;
        if (this.ribbon.held) {
            this.ribbon.release();
        }
        if (!input.spellPressed) {
            input.castInstant = true;
        }
        this.lastCast = this._time;
        this._syncGcd();
        this._faceTarget(ctx);

        if (key === 1) {
            this.sweep.trigger(ctx, ctx.aimX, ctx.aimZ);
            return;
        }
        if (key === 3) {
            this.bloom.trigger(ctx, ctx.aimPoint.x, ctx.aimPoint.y, ctx.aimPoint.z);
            return;
        }
        if (key === 4) {
            this.crystallize.trigger(ctx, ctx.aimPoint.x, ctx.aimPoint.y, ctx.aimPoint.z);
            return;
        }
        this.vortex.trigger();
    }

    /** @param {boolean} held */
    holdRibbon(held) {
        this.debugRibbon = !!held;
        if (held) {
            this._channelLock = false;
        }
        this._holdRibbon(held || input.spellHeld2);
    }

    /** @param {boolean} held */
    _holdRibbon(held) {
        if (!held) {
            this._channelLock = false;
            if (this.ribbon.held) {
                this.ribbon.release();
            }
            return;
        }
        if (this._channelLock) {
            return;
        }

        const ctx = this._frame = this._buildFrame(this._frame?.dt || 0);
        const backing = input.forward < 0;
        const dummy = ctx.target || this.ribbon._target;
        const oor = !!(dummy && !inSpellRange(dummy, ctx.feet));

        if (this.ribbon.held) {
            if (backing || oor) {
                this.ribbon.release();
                this.debugRibbon = false;
                this._channelLock = true;
            }
            return;
        }

        if (this._syncGcd() > 0 || backing || oor) {
            return;
        }
        this._faceTarget(ctx);
        this.ribbon.trigger(ctx);
        this.lastCast = this._time;
        this._syncGcd();
    }

    /** @param {SpellFrame} ctx */
    _faceTarget(ctx) {
        const dummy = ctx.target;
        if (!dummy) {
            return;
        }
        const dx = dummy.position.x - ctx.feet.x;
        const dz = dummy.position.z - ctx.feet.z;
        if (Math.hypot(dx, dz) < 0.05) {
            return;
        }
        this.player.setFacing?.(Math.atan2(dx, dz));
    }

    /** @param {number} dt */
    _buildFrame(dt) {
        const feet = feetOf(this.player);
        const origin = staffOrigin(this.hero, this.player, this._origin);
        const dummy = this.targeting?.current || null;
        let aimX;
        let aimZ;
        if (dummy) {
            aimX = dummy.position.x - feet.x;
            aimZ = dummy.position.z - feet.z;
            const fl = Math.hypot(aimX, aimZ) || 1;
            aimX /= fl;
            aimZ /= fl;
            this._aimPoint.x = dummy.position.x;
            this._aimPoint.y = feet.y;
            this._aimPoint.z = dummy.position.z;
        } else {
            const yaw = this.rig.yaw;
            aimX = Math.sin(yaw);
            aimZ = Math.cos(yaw);
            this._aimPoint.x = feet.x + aimX * AIM_RANGE;
            this._aimPoint.y = feet.y;
            this._aimPoint.z = feet.z + aimZ * AIM_RANGE;
        }
        return {
            dt,
            time: this._time,
            player: this.player,
            hero: this.hero,
            targeting: this.targeting,
            rig: this.rig,
            origin,
            feet,
            target: dummy,
            aimX,
            aimZ,
            aimPoint: this._aimPoint,
            lights: this.lights,
            strike,
        };
    }

    get activeCount() {
        let n = 0;
        for (let i = 0; i < this.spells.length; i++) {
            if (this.spells[i].active) {
                n++;
            }
        }
        return n;
    }

    cancelAll() {
        for (let i = 0; i < this.spells.length; i++) {
            this.spells[i].cancel();
        }
        this.debugRibbon = false;
        this._channelLock = false;
        this._holdRibbon(false);
        this.lights.begin();
        this.lights.end();
    }
}

/**
 * @param {{
 *   engine: import("@babylonjs/lite").EngineContext,
 *   scene: import("@babylonjs/lite").SceneContext,
 *   player: object,
 *   hero: object|null,
 *   targeting: object,
 *   rig: object,
 * }} opts
 */
export function createSpellSystem(opts) {
    return new SpellSystem(opts);
}
