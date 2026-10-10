/** C03 ability timing. Gameplay instants do not wait for cosmetic gestures.
 * Policy: docs/plans/combat-overhaul/plan-2026-10-10.md#timing-and-action-contract
 * Stable identifiers belong to gameplay; numbered slots belong to input/UI.
 */
export const ABILITIES = Object.freeze({
  'fire-blast': Object.freeze({ id: 'fire-blast', slot: 1, name: 'Fire Blast', castTime: 0, gcd: 1.5, cooldown: 1, cost: 20, range: 20, targeted: true }),
  'lava-ball': Object.freeze({ id: 'lava-ball', slot: 2, name: 'Lava Ball', castTime: 1.5, gcd: 1.5, cooldown: 3, cost: 40, range: 24, targeted: true }),
  'pyre-burst': Object.freeze({ id: 'pyre-burst', slot: 3, name: 'Pyre Burst', castTime: 0, groundOrigin: true, gcd: 1.5, cooldown: 6, cost: 30, radius: 8, targeted: false }),
});
export const ABILITY_SLOTS = Object.freeze(Object.fromEntries(Object.values(ABILITIES).map(a => [a.slot, a.id])));
