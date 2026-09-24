/**
 * Tab-target. Nearest hostile in front of the camera, then cycle.
 * Positions are sampled from mesh world translation.
 */

const CLOSE_DIST = 2.2;
const MAX_DIST = 42;
const MIN_DOT = 0.15;

function inFront(list, eye, forward) {
    const front = [];
    for (let i = 0; i < list.length; i++) {
        const t = list[i];
        if (!t.hostile) {
            continue;
        }
        if (t.hp <= 0 && !t.recover) {
            continue;
        }
        const dx = t.position.x - eye.x;
        const dz = t.position.z - eye.z;
        const dist = Math.hypot(dx, dz);
        if (dist > MAX_DIST) {
            continue;
        }
        const dot = dist > 0.001
            ? (dx / dist) * forward.x + (dz / dist) * forward.z
            : 1;
        // A hostile in melee range stays targetable even when it reaches the
        // player's side or back. The camera cone still limits distant picks.
        if (dist > CLOSE_DIST && dot < MIN_DOT) {
            continue;
        }
        front.push(t);
    }
    front.sort((a, b) => {
        const da = Math.hypot(a.position.x - eye.x, a.position.z - eye.z);
        const db = Math.hypot(b.position.x - eye.x, b.position.z - eye.z);
        return da - db;
    });
    return front;
}

export class Targeting {
    list = [];
    current = null;
    /** Index into the last-built front list, for Tab cycling. */
    _cycle = -1;

    clear() {
        this.current = null;
        this._cycle = -1;
    }

    select(id) {
        if (!id) {
            this.clear();
            return;
        }
        const t = this.list.find((x) => x.id === id) || null;
        this.current = t;
        if (!t) {
            this._cycle = -1;
        }
    }

    /**
     * @param {{ x: number, y: number, z: number }} eye
     * @param {{ x: number, z: number }} forward flattened camera forward
     * @param {boolean} [reverse] Shift+Tab
     */
    tab(eye, forward, reverse = false) {
        const front = inFront(this.list, eye, forward);
        if (front.length === 0) {
            this.clear();
            return null;
        }
        if (this._cycle >= front.length) {
            this._cycle = -1;
        }
        if (this._cycle < 0) {
            this._cycle = reverse ? front.length - 1 : 0;
        } else {
            this._cycle = reverse
                ? (this._cycle - 1 + front.length) % front.length
                : (this._cycle + 1) % front.length;
        }
        this.current = front[this._cycle];
        return this.current;
    }

    /**
     * LMB click without a pick API: nearest hostile in the Tab cone.
     * @param {{ x: number, y: number, z: number }} eye
     * @param {{ x: number, z: number }} forward
     */
    click(eye, forward) {
        const front = inFront(this.list, eye, forward);
        if (front.length === 0) {
            return null;
        }
        this.current = front[0];
        this._cycle = 0;
        return this.current;
    }

    /**
     * Click a hostile under the cursor (WoW left/right click). `project` maps a
     * world point to CSS pixels inside the canvas, same space as clickX/clickY.
     * @param {number} clickX
     * @param {number} clickY
     * @param {(position:{x:number,y:number,z:number}, y:number) => [number,number]|null} project
     */
    clickAt(clickX, clickY, project) {
        let best = null;
        let bestDist = 56;
        for (const t of this.list) {
            if (!t || t.hostile === false || t.hidden) continue;
            if (t.hp <= 0 && !t.recover) continue;
            const p = project(t.position, (t.position.y ?? 0) + 1.05);
            if (!p) continue;
            const dist = Math.hypot(p[0] - clickX, p[1] - clickY);
            if (dist < bestDist) {
                bestDist = dist;
                best = t;
            }
        }
        if (!best) return null;
        this.current = best;
        this._cycle = 0;
        return best;
    }
}
