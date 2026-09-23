import test from "node:test";
import assert from "node:assert/strict";
import {
    FACING_LIMIT,
    UNARMED,
    facingError,
    meleeDistance,
    stepAutoAttack,
    weaponProfile,
    yawTo,
} from "../src/ashen-reach/auto-attack.js";

const ready = { enabled: true, timer: 0, queued: false };
const ctx = {
    alive: true,
    dist: 2,
    range: 3.05,
    facingError: 0.2,
    speed: 2,
    casting: false,
    grounded: true,
    canTurn: true,
    blocked: false,
};

test("weapon profiles keep the sword faster than the greatstaff", () => {
    assert.equal(weaponProfile(null), UNARMED);
    assert.equal(weaponProfile("ironSword").damage, 38);
    assert.ok(weaponProfile("ironSword").speed < weaponProfile("graveweaverGreatstaff").speed);
    assert.equal(weaponProfile("unknown-blade").range, 3);
});

test("facing error wraps behind the character", () => {
    const from = { x: 0, z: 0 };
    const ahead = { x: 0, z: 4 };
    assert.ok(facingError(0, from, ahead) < 0.01);
    assert.ok(facingError(Math.PI, from, ahead) > 3);
    assert.ok(Math.abs(yawTo(from, { x: 2, z: 0 }) - Math.PI / 2) < 1e-6);
    assert.equal(meleeDistance(from, { x: 3, z: 4 }), 5);
});

test("a due swing connects in range and waits out the weapon speed", () => {
    const step = stepAutoAttack(ready, 0.016, ctx);
    assert.equal(step.action, "swing");
    assert.equal(step.timer, 2);
    assert.equal(step.queued, false);
    const wait = stepAutoAttack(step, 0.5, ctx);
    assert.equal(wait.action, "wait");
    assert.ok(Math.abs(wait.timer - 1.5) < 1e-6);
});

test("out of range, a blocked target, and the wrong facing do not swing", () => {
    assert.equal(stepAutoAttack(ready, 0.016, { ...ctx, dist: 6 }).action, "out-of-range");
    assert.equal(stepAutoAttack(ready, 0.016, { ...ctx, blocked: true }).action, "blocked");
    const turned = stepAutoAttack(ready, 0.016, { ...ctx, facingError: FACING_LIMIT + 0.2, canTurn: false });
    assert.equal(turned.action, "not-facing");
    assert.ok(turned.timer > 0 && turned.timer <= 0.4);
    const snapped = stepAutoAttack(ready, 0.016, { ...ctx, facingError: 1.2, canTurn: true });
    assert.equal(snapped.action, "swing");
    assert.equal(snapped.turn, true);
});

test("casts freeze the timer and a queued swing fires when the cast ends", () => {
    const mid = stepAutoAttack({ enabled: true, timer: 0.4, queued: false }, 0.016, { ...ctx, casting: true });
    assert.equal(mid.action, "paused");
    assert.equal(mid.timer, 0.4);
    const due = stepAutoAttack({ enabled: true, timer: 0, queued: false }, 0.016, { ...ctx, casting: true });
    assert.equal(due.queued, true);
    assert.equal(due.timer, 0);
    const after = stepAutoAttack(due, 0.016, ctx);
    assert.equal(after.action, "swing");
});

test("airborne and dead targets do not spend the swing", () => {
    assert.equal(stepAutoAttack(ready, 0.016, { ...ctx, grounded: false }).action, "air");
    assert.equal(stepAutoAttack(ready, 0.016, { ...ctx, alive: false }).action, "no-target");
    assert.equal(stepAutoAttack({ enabled: false, timer: 1, queued: true }, 0.016, ctx).action, "off");
});
