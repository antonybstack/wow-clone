/**
 * Client intent seam for a later SpacetimeDB C# module.
 *
 * The server will own truth. This process applies locally so the demo is
 * playable offline, and records every intent so a reducer can replay it.
 * Never send an authoritative world position over the wire.
 */

export type Intent =
    | { t: "move"; x: number; z: number; sprint: boolean }
    | { t: "look"; yaw: number; pitch: number }
    | { t: "jump" }
    | { t: "tab" }
    | { t: "select"; id: string | null }
    | { t: "equip"; itemId: string; slot: string }
    | { t: "unequip"; slot: string }
    | { t: "ability"; slot: number; targetId: string | null };

const MAX = 256;
const ring: Intent[] = [];
let head = 0;
let count = 0;

/** Last move intent, for the HUD / debug. */
export let lastMove: Intent | null = null;

export function emitIntent(intent: Intent): void {
    if (count < MAX) {
        ring[count++] = intent;
    } else {
        ring[head] = intent;
        head = (head + 1) % MAX;
    }
    if (intent.t === "move") lastMove = intent;
}

export function drainIntents(): Intent[] {
    const out: Intent[] = [];
    for (let i = 0; i < count; i++) out.push(ring[(head + i) % MAX]);
    return out;
}
