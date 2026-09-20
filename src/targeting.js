/**
 * Tab-target. Nearest hostile in front of the camera, then cycle.
 * Positions are sampled from mesh world translation.
 */

const MIN_DIST = 1.2;
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
        if (dist < MIN_DIST || dist > MAX_DIST) {
            continue;
        }
        const dot = (dx / dist) * forward.x + (dz / dist) * forward.z;
        if (dot < MIN_DOT) {
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
}
