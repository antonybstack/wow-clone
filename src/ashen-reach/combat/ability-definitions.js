/** C05 kit tuning; Lava retains its personal cooldown until C06 adds bounded flights.
 * Ability timing. Gameplay instants do not wait for cosmetic gestures.
 * Policy: docs/plans/combat-overhaul/plan-2026-10-10.md#timing-and-action-contract
 * Stable identifiers belong to gameplay; numbered slots belong to input/UI.
 */
export const ABILITIES = Object.freeze({
  'fire-blast': Object.freeze({ id: 'fire-blast', slot: 1, name: 'Fire Blast', castTime: 0, gcd: 1.5, cooldown: 0, cost: 0, range: 30, targeted: true }),
  'lava-ball': Object.freeze({ id: 'lava-ball', slot: 2, name: 'Lava Ball', castTime: 1.5, gcd: 1.5, cooldown: 3, cost: 12, range: 30, targeted: true }),
  'pyre-burst': Object.freeze({ id: 'pyre-burst', slot: 3, name: 'Pyre Burst', castTime: 0, groundOrigin: true, gcd: 1.5, cooldown: 8, cost: 20, radius: 8, targeted: false }),
  'ashen-brand': Object.freeze({ id: 'ashen-brand', slot: 4, name: 'Ashen Brand', castTime: 0, gcd: 1.5, cooldown: 0, cost: 8, range: 30, targeted: true }),
});
export const ABILITY_SLOTS = Object.freeze(Object.fromEntries(Object.values(ABILITIES).map(a => [a.slot, a.id])));
