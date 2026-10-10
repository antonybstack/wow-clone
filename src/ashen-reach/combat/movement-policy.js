/** Per-action movement rules. Havok remains the movement authority; this policy
 * only accepts/cancels actions and never changes velocity or camera direction.
 * docs/plans/combat-overhaul/plan-2026-10-10.md#timing-and-action-contract
 */
export function translating({ speed = 0, forward = 0, strafe = 0 } = {}) {
  return speed > .15 || Math.abs(forward) > .01 || Math.abs(strafe) > .01;
}

export function movementRefusal(definition, motion) {
  const hardCast = definition.castTime > 0;
  if ((hardCast || definition.groundOrigin) && (!motion.grounded || motion.jump)) return 'Land before casting';
  if (hardCast && translating(motion)) return 'Stand still to cast';
  return '';
}

export function canAutoFace(motion, input) {
  return !translating(motion) && !input.turn && !input.rmb && !input.faceCamera && !input.looking;
}

export function facingRefusal({ targeted }, angle, autoFace) {
  return targeted && !autoFace && angle > Math.PI / 2 + 1e-8 ? 'Face your target' : '';
}

/** Contact checks use feet, not the capsule centre, so slopes/steps remain
 * forgiving while actors on separate cathedral floors cannot hit each other.
 */
export function inContactRange(from, to, range, verticalLimit = 1.8) {
  return Math.abs(from.y - to.y) <= verticalLimit && Math.hypot(from.x - to.x, from.z - to.z) <= range;
}
