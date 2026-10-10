import test from 'node:test';
import assert from 'node:assert/strict';
import { createActionScheduler } from '../src/ashen-reach/combat/action-scheduler.js';
import { createCombatClock } from '../src/ashen-reach/combat/combat-clock.js';
import { createInputIntents } from '../src/ashen-reach/combat/input-intents.js';
const definitions = {
  filler: { id: 'filler', targeted: true, cost: 0, castTime: 0, gcd: 1.5, cooldown: 0 },
  cast: { id: 'cast', targeted: true, cost: 40, castTime: 1.5, gcd: 1.5, cooldown: 0 },
  ward: { id: 'ward', targeted: false, cost: 15, castTime: 0, gcd: 0, cooldown: 25 },
};
function fixture(options = {}) {
  const targets = new Map(['a', 'b'].map(id => [id, { id, hp: 1000, generation: 1, hostile: true }]));
  const events = [], starts = [], releases = [], cancellations = [];
  let mana = 100;
  const scheduler = createActionScheduler({ definitions, getTarget: id => targets.get(id),
    resource: { get: () => mana, spend: cost => { assert.ok(mana >= cost); mana -= cost; } },
    emit: e => events.push(e), onStart: a => starts.push(a), onRelease: (a, time) => releases.push({ ...a, releasedAt: time }),
    onCancel: a => cancellations.push(a), ...options });
  return { scheduler, targets, events, starts, releases, cancellations, mana: () => mana,
    setMana: n => mana = n, press: (abilityId, targetId = 'a', extra = {}) => scheduler.request({ abilityId, targetId, ...extra }) };
}
test('instants release on acceptance; hard casts reserve and commit exactly once', () => {
  const f = fixture(); f.press('cast');
  assert.equal(f.mana(), 100); assert.equal(f.scheduler.available, 60); assert.equal(f.scheduler.reserved, 40);
  f.scheduler.advance(1.5); f.scheduler.advance(1.6);
  assert.equal(f.mana(), 60); assert.equal(f.releases.length, 1); assert.equal(f.releases[0].releasedAt, 1.5);
  f.press('filler'); assert.equal(f.releases.length, 2); assert.equal(f.scheduler.reserved, 0);
});
test('repress never cancels; interrupt refunds reservation and retains GCD', () => {
  const f = fixture(); f.press('cast'); f.scheduler.advance(.2);
  assert.equal(f.press('cast').ok, false); assert.ok(f.scheduler.active);
  assert.equal(f.scheduler.cancel(), true); assert.equal(f.scheduler.cancel(), false);
  assert.equal(f.mana(), 100); assert.equal(f.scheduler.reserved, 0); assert.equal(f.scheduler.gcdRemaining, 1.3);
  f.scheduler.advance(2); assert.equal(f.releases.length, 0);
});
test('queue boundaries, replacement and invalid input preserve an existing valid queue', () => {
  const f = fixture(); f.press('filler'); f.scheduler.advance(1.199);
  assert.equal(f.press('filler').ok, false); assert.equal(f.scheduler.queued, null);
  f.scheduler.advance(1.2); assert.equal(f.press('filler').queued, true);
  const old = f.scheduler.queued;
  f.press('filler', 'missing'); assert.equal(f.scheduler.queued, old);
  f.setMana(0); f.press('cast'); assert.equal(f.scheduler.queued, old);
  f.press('filler', 'b'); assert.equal(f.scheduler.queued.targetId, 'b');
  f.scheduler.advance(1.5); assert.equal(f.releases.at(-1).targetId, 'b');
  assert.equal(f.releases.length, 2);
});
test('queued target identity survives selection changes but rejects death, despawn and generation reuse', () => {
  for (const invalidate of [f => { f.targets.get('a').hp = 0; }, f => f.targets.delete('a'), f => f.targets.get('a').generation++]) {
    const f = fixture(); f.press('filler'); f.scheduler.advance(1.3); f.press('filler'); invalidate(f);
    f.scheduler.advance(1.5); assert.equal(f.releases.length, 1); assert.equal(f.scheduler.queued, null);
  }
});
test('120 ms hitch expires 110 ms late queue but executes 70 ms late queue once', () => {
  for (const [prior, expected] of [[1.49, 1], [1.45, 2]]) {
    const f = fixture(); f.press('filler'); f.scheduler.advance(1.3); f.press('filler');
    f.scheduler.advance(prior); f.scheduler.advance(prior + .12); f.scheduler.advance(prior + .13);
    assert.equal(f.releases.length, expected);
  }
});
test('off-GCD utility neither overwrites cast/queue nor spends reserved mana', () => {
  const f = fixture(); f.setMana(50); f.press('cast'); f.scheduler.advance(1.3); f.press('filler');
  const cast = f.scheduler.active, queued = f.scheduler.queued;
  assert.equal(f.press('ward').ok, false); assert.equal(f.scheduler.active, cast); assert.equal(f.scheduler.queued, queued);
  f.setMana(60); assert.equal(f.press('ward').ok, true); assert.equal(f.mana(), 45);
  assert.equal(f.scheduler.active, cast); assert.equal(f.scheduler.queued, queued);
  f.scheduler.advance(1.5); assert.equal(f.mana(), 5); assert.equal(f.releases.length, 3);
});
test('a normally queued cast upgrades to proc; instant-only input cannot downgrade', () => {
  let proc = false;
  const f = fixture({ resolveDefinition: def => def.id === 'cast' && proc ? { ...def, castTime: 0, cost: 0, variant: 'surge' } : def });
  f.press('filler'); f.scheduler.advance(1.3); f.press('cast'); proc = true; f.scheduler.advance(1.5);
  assert.equal(f.releases.at(-1).definition.variant, 'surge'); assert.equal(f.mana(), 100);
  f.scheduler.advance(2.8); f.press('cast', 'a', { instantOnly: true }); proc = false; f.scheduler.advance(3);
  assert.equal(f.releases.length, 2); assert.equal(f.scheduler.active, null);
});
test('100 chained eligible inputs execute once at 30, 60 and 144 Hz', () => {
  for (const hz of [30, 60, 144]) {
    const f = fixture(); f.press('filler');
    let accepted = 1;
    for (let frame = 1; accepted < 100 || f.scheduler.queued; frame++) {
      f.scheduler.advance(frame / hz);
      if (accepted < 100 && !f.scheduler.queued && f.scheduler.gcdRemaining <= .25) {
        assert.equal(f.press('filler').ok, true); accepted++;
      }
    }
    assert.equal(f.releases.length, 100); assert.equal(new Set(f.releases.map(a => a.actionId)).size, 100);
  }
});
test('queue off, reset and disposal clear actions without late execution', () => {
  const f = fixture(); f.press('cast'); f.scheduler.advance(1.3); f.press('filler'); f.scheduler.setQueueWindow(0);
  assert.equal(f.scheduler.queued, null); assert.equal(f.press('filler').ok, false);
  f.scheduler.dispose(); f.scheduler.advance(10); assert.equal(f.releases.length, 0); assert.equal(f.mana(), 100);
  assert.equal(f.press('filler').ok, false);
});
test('combat clock retains normal hitch time, excludes pause and requests visible pause for >500ms', () => {
  const clock = createCombatClock(); clock.step(.016);
  assert.equal(clock.step(.12).dt, .12); assert.equal(clock.time, .12);
  assert.equal(clock.step(.501).pause, true); assert.equal(clock.time, .12);
  clock.step(4, { paused: true }); assert.equal(clock.step(8).dt, 0);
  clock.step(.02); assert.ok(Math.abs(clock.time - .14) < 1e-12);
  clock.step(2, { hidden: true }); assert.equal(clock.step(2).dt, 0);
});
test('input FIFO retains simultaneous offense/utility, rejects newest overflow and clears on takeover', () => {
  const inputs = createInputIntents(2), consumed = [];
  assert.equal(inputs.push({ abilityId: 'cast' }), true); assert.equal(inputs.push({ abilityId: 'ward' }), true);
  assert.equal(inputs.push({ abilityId: 'filler' }), false); assert.equal(inputs.rejected, 1);
  inputs.drain(a => consumed.push(a.abilityId)); assert.deepEqual(consumed, ['cast', 'ward']);
  inputs.push({ abilityId: 'cast' }); inputs.clear(); inputs.drain(a => consumed.push(a.abilityId)); assert.equal(consumed.length, 2);
});

test('personal cooldown begins at release; a same-spell queue accounts for the future cooldown', () => {
  const f = fixture({ definitions: { ...definitions, cast: { ...definitions.cast, cooldown: 3 } } });
  f.press('cast'); assert.equal(f.scheduler.cooldown('cast'), 0);
  f.scheduler.advance(1.3); assert.equal(f.press('cast').ok, false);
  f.scheduler.advance(1.5); assert.equal(f.scheduler.cooldown('cast'), 3);
  f.scheduler.advance(4.3); assert.equal(f.press('cast').queued, true);
  f.scheduler.advance(4.5); assert.equal(f.starts.length, 2);
});
test('release revalidation cancels and refunds exactly once without starting cooldown', () => {
  let blocked = false;
  const f = fixture({ validate: () => blocked ? 'Target is blocked' : '' });
  f.press('cast'); blocked = true; f.scheduler.advance(1.5); f.scheduler.advance(2);
  assert.equal(f.releases.length, 0); assert.equal(f.cancellations.length, 1);
  assert.equal(f.mana(), 100); assert.equal(f.scheduler.cooldown('cast'), 0); assert.equal(f.scheduler.reserved, 0);
});
test('haste snapshots cast duration and floors GCD without shortening personal cooldown', () => {
  let haste = .5;
  const f = fixture({ resolveDefinition: def => ({ ...def, haste }) });
  f.press('cast'); assert.equal(f.scheduler.active.releaseAt, 1); assert.equal(f.scheduler.gcdRemaining, 1);
  haste = 0; f.scheduler.advance(.9); assert.equal(f.releases.length, 0);
  f.scheduler.advance(1); assert.equal(f.releases.length, 1);
  f.press('ward'); assert.equal(f.scheduler.cooldown('ward'), 25);
});
test('500 ms active time is retained; boot and hidden time never produce catch-up', () => {
  const clock = createCombatClock();
  clock.step(30, { ready: false }); assert.equal(clock.step(30).pause, false);
  assert.equal(clock.step(.5).dt, .5); assert.equal(clock.time, .5);
  clock.step(30, { hidden: true }); clock.step(30); assert.equal(clock.time, .5);
});
test('replacement emits a terminal queue event for the displaced action', () => {
  const f = fixture(); f.press('filler'); f.scheduler.advance(1.3);
  const first = f.press('filler'); f.press('filler', 'b');
  const cleared = f.events.filter(e=>e.type==='queue-clear');
  assert.equal(cleared.length, 1); assert.equal(cleared[0].actionId, first.actionId);
  assert.equal(f.scheduler.queued.targetId, 'b');
});
test('long-stall pause remains latched until the visible menu acknowledges it', () => {
  const clock = createCombatClock(); clock.step(.016); clock.step(.12);
  assert.equal(clock.step(.6).pause, true);
  for(let i=0;i<3;i++){ assert.equal(clock.step(.016).pause, true); assert.equal(clock.time,.12); }
  clock.step(10,{paused:true}); assert.equal(clock.step(10).dt,0);
  assert.equal(clock.step(.1).dt,.1);
});

test('HUD preview honors reservation and cooldown without events or mutation',()=>{
 const f=fixture();f.setMana(50);f.press('cast');f.scheduler.advance(.2);
 const active=f.scheduler.active,count=f.events.length;
 assert.equal(f.scheduler.preview({abilityId:'ward'}).reason,'Not enough mana');
 assert.equal(f.scheduler.preview({abilityId:'filler',targetId:'a'}).readyIn,1.3);
 assert.equal(f.scheduler.preview({abilityId:'filler',targetId:'missing'}).reason,'Target is unavailable');
 assert.equal(f.scheduler.active,active);assert.equal(f.scheduler.reserved,40);assert.equal(f.mana(),50);assert.equal(f.events.length,count);
});
