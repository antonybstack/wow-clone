/** Eased hand<->back prop travel. The prop stays parented to the destination
 * socket so ownership is immediate; only its local transform animates. */
export const PROP_TRANSITION_SECONDS = .35;
const ease = x => x * x * (3 - 2 * x);

function slerp(a, b, t) {
    let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
    let to = b;
    if (d < 0) { d = -d; to = [-b[0], -b[1], -b[2], -b[3]]; }
    if (d > .9995) return a.map((v, i) => v + (to[i] - v) * t);
    const th = Math.acos(Math.max(-1, Math.min(1, d))), s = Math.sin(th);
    const w1 = Math.sin((1 - t) * th) / s, w2 = Math.sin(t * th) / s;
    return a.map((v, i) => v * w1 + to[i] * w2);
}

export function beginPropTransition(prop, fromPosition, fromRotation, target) {
    prop.transition = {
        fromPosition, fromRotation,
        targetPosition: target.position, targetRotation: target.rotation,
        elapsed: 0, duration: PROP_TRANSITION_SECONDS,
    };
}

/** Returns true while the transform is still animating. */
export function advancePropTransition(prop, dt) {
    const tr = prop.transition;
    if (!tr) return false;
    tr.elapsed += Math.max(0, dt);
    const t = Math.min(1, tr.elapsed / tr.duration), e = ease(t);
    const p = tr.fromPosition, tp = tr.targetPosition;
    prop.root.position.set(p[0] + (tp[0] - p[0]) * e, p[1] + (tp[1] - p[1]) * e, p[2] + (tp[2] - p[2]) * e);
    const r = slerp(tr.fromRotation, tr.targetRotation, e);
    prop.root.rotationQuaternion.set(r[0], r[1], r[2], r[3]);
    prop.root.scaling.set(1, 1, 1);
    if (t >= 1) prop.transition = null;
    return true;
}
