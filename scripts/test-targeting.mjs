import assert from "node:assert/strict";
import test from "node:test";
import { Targeting } from "../src/targeting.js";

const hostile = (id, x, z) => ({ id, hostile: true, hp: 100, position: { x, y: 0, z } });
const eye = { x: 0, y: 1, z: 0 };
const forward = { x: 0, z: 1 };

test("Target button selects the nearby hostile before a farther target behind it", () => {
    const targeting = new Targeting();
    targeting.list = [hostile("dummy", 0, 1.8), hostile("shade", 0, 0.8)];
    assert.equal(targeting.tab(eye, forward)?.id, "shade");
    assert.equal(targeting.tab(eye, forward)?.id, "dummy");
});

test("a hostile beside the player remains targetable at melee distance", () => {
    const targeting = new Targeting();
    targeting.list = [hostile("shade", -0.7, -0.3), hostile("far", 0, 5)];
    assert.equal(targeting.tab(eye, forward)?.id, "shade");
    assert.equal(targeting.click(eye, forward)?.id, "shade");
});

test("distant targets still need to be in the forward cone", () => {
    const targeting = new Targeting();
    targeting.list = [hostile("behind", 0, -5), hostile("ahead", 0, 5)];
    assert.equal(targeting.tab(eye, forward)?.id, "ahead");
});
