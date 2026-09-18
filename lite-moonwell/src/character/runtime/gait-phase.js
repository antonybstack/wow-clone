// Normalized cycle clock for authored clips. No bone manipulation or IK.
export const wrapPhase = value => ((value % 1) + 1) % 1;

export function advanceGaitPhase(phase, dt, cyclesPerSecond) {
    return wrapPhase(phase + Math.max(0, dt) * Math.max(0, cyclesPerSecond));
}

export function gaitTime(phase, duration, contactPhase) {
    return wrapPhase(phase + contactPhase) * duration;
}

export function landingWeight(elapsed, duration, peak) {
    const attack = Math.min(1, Math.max(0, elapsed / 0.05));
    const t = Math.min(1, Math.max(0, (elapsed - 0.09) / Math.max(0.01, duration - 0.09)));
    return peak * attack * (1 - t * t * (3 - 2 * t));
}
