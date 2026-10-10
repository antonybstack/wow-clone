import test from 'node:test';
import assert from 'node:assert/strict';
import { createCombatTrace } from '../src/ashen-reach/combat/combat-trace.js';
import { createCombatScenarios } from '../src/ashen-reach/combat/combat-scenarios.js';

test('trace stays bounded, chronological, copied and inert outside dev', () => {
  let enabled = false, wall = 0;
  const trace = createCombatTrace({ enabled: () => enabled, wallTime: () => ++wall });
  trace.record('ignored', 0); assert.equal(trace.size, 0); assert.equal(wall, 0);
  enabled = true;
  for (let i = 0; i < 700; i++) trace.record('input', i, { slot: i % 3 + 1 });
  const events = trace.snapshot();
  assert.equal(events.length, 512); assert.equal(trace.dropped, 188);
  assert.equal(events[0].sequence, 188); assert.equal(events.at(-1).sequence, 699);
  events[0].type = 'tamper'; assert.equal(trace.snapshot()[0].type, 'input');
  trace.clear(); assert.equal(trace.size, 0); assert.equal(trace.dropped, 0);
});
function fixture() {
  const makeEnemy = id => ({ id, position: { x: 10, y: 2, z: 12 }, spawn: { x: 10, z: 12 }, hp: 123, hpMax: 360, hidden: false, state: 'patrol', hostile: true });
  const dummy = makeEnemy('dummy'), enemies = [0, 1, 2].map(makeEnemy);
  const position = { x: 1, y: 2, z: 3 }; let facing = 1, enabled = true, ready = true;
  const player = { body: { position }, capsuleHeight: 2, getFacing: () => facing,
    setFacing: value => facing = value, setWorldPos: (x, y, z) => Object.assign(position, { x, y, z }) };
  const dev = { god: true, flying: true }, life = { hp: 52, hpMax: 100, time: 100, dead: false, inCombat: true, combatUntil: 105 };
  const progress = { mana: 23, manaMax: 100, xp: 10, get xpToNext() { return 100; } };
  const rig = { yaw: 1, pitch: .1, distance: 6 };
  let resets = 0;
  const scenarios = createCombatScenarios({ enabled: () => enabled, ready: () => ready,
    player, rig, life, progress, dummy, enemies, dev, destinations: () => [], groundHeight: () => 2,
    reset: () => resets++, syncEnemy() {}, setModes: (god, flying) => Object.assign(dev, { god, flying }) });
  return { scenarios, player, dev, life, progress, enemies, rig, block: () => { enabled = false; }, unready: () => { ready = false; }, resets: () => resets };
}
test('rehearsal fixtures restore actors, modes, position and resources without copying getters', () => {
  const f = fixture();
  const before = JSON.stringify({ position: f.player.body.position, dev: f.dev, life: f.life, progress: f.progress, enemies: f.enemies, rig: f.rig });
  assert.equal(f.scenarios.start('pack'), true);
  assert.equal(f.scenarios.active, 'pack'); assert.equal(f.dev.god, false); assert.equal(f.dev.flying, false);
  assert.equal(f.life.hp, 100); assert.equal(f.progress.mana, 100);
  assert.deepEqual(f.enemies.map(e => e.state), ['diagnostic', 'diagnostic', 'diagnostic']);
  f.enemies[0].hp = 0; f.life.hp = 12; f.progress.mana = 4;
  assert.equal(f.scenarios.start('dummy'), true); // Switching restores the original snapshot first.
  assert.equal(f.scenarios.restore(), true);
  assert.equal(JSON.stringify({ position: f.player.body.position, dev: f.dev, life: f.life, progress: f.progress, enemies: f.enemies, rig: f.rig }), before);
  assert.equal(f.scenarios.restore(), false);
});
test('unready, non-dev and invalid scenarios cannot mutate the game', () => {
  const f = fixture();
  assert.equal(f.scenarios.start('bogus'), false);
  assert.equal(f.scenarios.start('cathedral'), false); // Missing authored floors.
  f.unready(); assert.equal(f.scenarios.start('dummy'), false);
  f.block(); assert.equal(f.scenarios.start('pack'), false);
  assert.equal(f.resets(), 0); assert.equal(f.progress.mana, 23);
});

test('restoring a saved rehearsal cannot rewind a newer player generation',()=>{
 const f=fixture();f.life.generation=4;assert(f.scenarios.start('dummy'));
 f.life.generation=8;assert(f.scenarios.restore());assert.equal(f.life.generation,8);
});
