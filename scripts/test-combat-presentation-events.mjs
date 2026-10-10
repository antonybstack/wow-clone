import test from 'node:test';
import assert from 'node:assert/strict';
import { createPresentationEvents } from '../src/ashen-reach/combat/presentation-events.js';
import { createActionScheduler } from '../src/ashen-reach/combat/action-scheduler.js';
test('throwing/missing/disposed cosmetics never suppresses payment or gameplay release', () => {
  let damage = 0, mana = 10, reports = 0;
  const presentation = createPresentationEvents({ reportError: () => reports++ });
  const detach = presentation.attach(() => { throw Error('Missing atlas'); });
  const scheduler = createActionScheduler({ definitions: { hit: { id: 'hit', cost: 1, castTime: 0, gcd: 1.5, cooldown: 0 } },
    getTarget: () => null, resource: { get: () => mana, spend: n => mana -= n },
    emit: presentation.emit, onRelease: () => damage++ });
  scheduler.request({ abilityId: 'hit' });
  assert.equal(damage, 1); assert.equal(mana, 9); assert.equal(reports, 1);
  scheduler.advance(2); scheduler.request({ abilityId: 'hit' });
  assert.equal(damage, 2); assert.equal(reports, 1);
  detach(); presentation.dispose(); scheduler.advance(4); scheduler.request({ abilityId: 'hit' });
  assert.equal(damage, 3); assert.equal(mana, 7);
});
