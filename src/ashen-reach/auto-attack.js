/**
 * Melee swing timer. The body plays the swing; this only decides when a
 * swing is allowed. A cast freezes the timer. A swing that comes due during
 * a cast waits, then resolves on the first frame the cast is over.
 */

export const FACING_LIMIT = 1.35;

export const WEAPON_PROFILES = {
    ironSword: { id: "ironSword", name: "Iron arming sword", speed: 2.05, damage: 38, range: 3.05 },
    graveweaverStaff: { id: "graveweaverStaff", name: "Graveweaver staff", speed: 2.4, damage: 30, range: 3.25 },
    graveweaverGreatstaff: { id: "graveweaverGreatstaff", name: "Graveweaver greatstaff", speed: 2.85, damage: 56, range: 3.5 },
};

export const UNARMED = { id: null, name: "Fists", speed: 1.65, damage: 12, range: 2.3 };

export function weaponProfile(mainHand) {
    if (!mainHand) return UNARMED;
    return WEAPON_PROFILES[mainHand] || { id: mainHand, name: "Weapon", speed: 2.1, damage: 24, range: 3 };
}

export function meleeDistance(from, to) {
    return Math.hypot((to?.x || 0) - (from?.x || 0), (to?.z || 0) - (from?.z || 0));
}

export function yawTo(from, to) {
    return Math.atan2((to?.x || 0) - (from?.x || 0), (to?.z || 0) - (from?.z || 0));
}

/** Absolute yaw error in radians, wrapped to 0..pi. */
export function facingError(facing, from, to) {
    const aim = yawTo(from, to);
    return Math.abs(Math.atan2(Math.sin(aim - facing), Math.cos(aim - facing)));
}

export function stepAutoAttack(state, dt, ctx) {
    if (!state.enabled) return { enabled: false, timer: 0, queued: false, action: "off" };
    if (!ctx.alive) return { enabled: true, timer: 0, queued: false, action: "no-target" };
    const speed = ctx.speed > 0 ? ctx.speed : 2;
    if (ctx.casting) {
        const due = !!(state.queued || state.timer <= 0);
        return { enabled: true, timer: due ? 0 : state.timer, queued: due, action: "paused" };
    }
    const timer = state.queued ? 0 : state.timer - dt;
    if (timer > 0) return { enabled: true, timer, queued: false, action: "wait" };
    if (!ctx.grounded) return { enabled: true, timer: 0, queued: true, action: "air" };
    if (ctx.dist > ctx.range) return { enabled: true, timer: speed, queued: false, action: "out-of-range" };
    if (ctx.blocked) return { enabled: true, timer: speed, queued: false, action: "blocked" };
    if (ctx.facingError > FACING_LIMIT && !ctx.canTurn) {
        return { enabled: true, timer: Math.min(0.4, speed * 0.2), queued: false, action: "not-facing" };
    }
    return {
        enabled: true,
        timer: speed,
        queued: false,
        action: "swing",
        turn: ctx.facingError > 0.12 && !!ctx.canTurn,
    };
}
