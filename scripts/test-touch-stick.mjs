import assert from "node:assert/strict";
import test from "node:test";
import { stickAxes } from "../src/ashen-reach/touch-controls.js";

test("a centered stick does not move", () => {
  assert.deepEqual(stickAxes(0, 0), { x: 0, y: 0, active: false });
  assert.equal(stickAxes(4, 3).active, false);
});

test("the stick points forward, back, and sideways inside the pad", () => {
  const up = stickAxes(0, -40);
  assert.ok(up.active);
  assert.ok(up.y > 0.8);
  assert.ok(Math.abs(up.x) < 0.05);
  const down = stickAxes(0, 40);
  assert.ok(down.y < -0.8);
  const right = stickAxes(40, 0);
  assert.ok(right.x > 0.8);
  const past = stickAxes(200, 0);
  assert.ok(past.x <= 1);
  assert.ok(past.x > 0.99);
});
