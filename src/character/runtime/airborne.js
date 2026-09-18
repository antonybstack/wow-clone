// Presentation grace only: never changes collision, gravity, or coyote time.
// Real jump impulses animate immediately; brief contact seams keep locomotion.
export function shouldAnimateAirborne(motion) {
    return !motion.grounded && (motion.jumpInFlight || (motion.airTime ?? Infinity) >= 0.08);
}
