import assert from "node:assert/strict";
import test from "node:test";
import { spellLineOfSight } from "../src/ashen-reach/spell-visibility.js";

const target = { id: "dummy", position: { x: 2, y: 0, z: 4 } };
const obstacle = { hasHit: true, body: { node: { name: "Collision_grave" } } };
const player = (raycast) => ({ body: { position: { x: 0, y: 1, z: 0 } }, raycast });

test("an upper-body view clears a grave grazing the lower ray", () => {
  const rays = [];
  const result = spellLineOfSight(player((from, to) => {
    rays.push({ from, to });
    return rays.length === 1 ? obstacle : { hasHit: false };
  }), target);
  assert.deepEqual(result, { clear: true, obstacle: null });
  assert.deepEqual(rays.map((r) => [r.from.y, r.to.y]), [[1.35, 1.1], [1.55, 1.45]]);
});

test("a solid wall blocking both sight lines remains blocked", () => {
  assert.deepEqual(spellLineOfSight(player(() => obstacle), target), {
    clear: false, obstacle: "Collision_grave",
  });
});

test("a hit on the target clears without another ray", () => {
  let calls = 0;
  const own = { hasHit: true, body: { node: { metadata: { colliderId: target.id } } } };
  assert.deepEqual(spellLineOfSight(player(() => { calls++; return own; }), target), {
    clear: true, obstacle: null,
  });
  assert.equal(calls, 1);
});

test("an unavailable collision query does not grant sight", () => {
  assert.deepEqual(spellLineOfSight(player(() => null), target), {
    clear: false, obstacle: "Collision world unavailable",
  });
});
