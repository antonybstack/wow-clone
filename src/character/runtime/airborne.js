// Presentation grace only: never changes collision, gravity, or coyote time.
// Real jump impulses animate immediately; brief contact seams keep locomotion.
// Slope-supported positive Y is grounded in player.hasGroundSupport, so this
// must not treat an incline ride as airborne.
export function shouldAnimateAirborne(motion) {
    return !motion.grounded && (motion.jumpInFlight || (motion.airTime ?? Infinity) >= 0.08);
}
