import test from "node:test";
import assert from "node:assert/strict";
import { GravePulse, GRAVE_PULSE } from "../src/spells/grave-pulse.js";
import { manaCost, GRAVE_PULSE_MANA, FIRE_BLAST_MANA, LAVA_BALL_MANA } from "../src/ashen-reach/progression.js";

const dummy = (z = 0, hp = 400) => ({
  position: { x: 0, y: 1, z },
  hp,
  hpMax: 400,
  recover: true,
  hits: 0,
});
const shade = (x, z, hp = 360) => ({
  position: { x, y: 1, z },
  hp,
  hpMax: 360,
  recover: false,
  hits: 0,
});

test("rejects airborne, cooldown, and empty radius without consuming", () => {
  const s = new GravePulse();
  const hostiles = [dummy(0)];
  assert.equal(s.cast({ position: { x: 0, z: 0 }, grounded: false, hostiles }).ok, false);
  assert.equal(s.casts, 0);
  assert.equal(s.cast({ position: { x: 40, z: 40 }, grounded: true, hostiles }).ok, false);
  assert.equal(s.cooldown, 0);
  s.cast({ position: { x: 0, z: 0 }, grounded: true, hostiles });
  assert.equal(s.casts, 1);
  assert.equal(s.cast({ position: { x: 0, z: 0 }, grounded: true, hostiles }).ok, false);
});

test("hits every living hostile inside 8m and ignores those outside", () => {
  const s = new GravePulse();
  const near = dummy(4);
  const far = shade(0, 20);
  const mid = shade(6, 4);
  const result = s.cast({
    position: { x: 0, z: 0 },
    grounded: true,
    hostiles: [near, far, mid],
  });
  assert.equal(result.ok, true);
  assert.equal(result.hits.length, 2);
  assert.equal(near.hp, 400 - GRAVE_PULSE.damage);
  assert.equal(mid.hp, 360 - GRAVE_PULSE.damage);
  assert.equal(far.hp, 360);
  assert.equal(s.cooldown, GRAVE_PULSE.cooldown);
});

test("radius includes exactly 8m", () => {
  const s = new GravePulse();
  const edge = shade(0, GRAVE_PULSE.radius);
  assert.equal(s.cast({ position: { x: 0, z: 0 }, grounded: true, hostiles: [edge] }).ok, true);
});

test("lethal dummy recovers once; shades stay dead", () => {
  const s = new GravePulse();
  const d = dummy(0, 40);
  const e = shade(1, 0, 40);
  s.cast({ position: { x: 0, z: 0 }, grounded: true, hostiles: [d, e] });
  assert.equal(d.hp, 0);
  assert.equal(e.hp, 0);
  s.update(2.9);
  assert.equal(d.hp, 0);
  s.update(0.2);
  assert.equal(d.hp, 400);
  assert.equal(e.hp, 0);
});

test("mana costs stay distinct per slot", () => {
  assert.equal(manaCost(1), FIRE_BLAST_MANA);
  assert.equal(manaCost(2), LAVA_BALL_MANA);
  assert.equal(manaCost(3), GRAVE_PULSE_MANA);
});
