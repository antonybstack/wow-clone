/**
 * Tab-target. Nearest hostile in front of the camera, then cycle.
 * Positions are sampled; the server will later own who is legal.
 */

import { Vector3 } from "@babylonjs/core/Maths/math.vector";

export type Targetable = {
    id: string;
    name: string;
    hostile: boolean;
    position: Vector3;
    plateY?: number;
};

const _to = new Vector3();

export class Targeting {
    list: Targetable[] = [];
    current: Targetable | null = null;
    /** Index into the last-built front list, for Tab cycling. */
    _cycle = -1;

    clear(): void {
        this.current = null;
        this._cycle = -1;
    }

    select(id: string | null): void {
        if (!id) {
            this.clear();
            return;
        }
        const t = this.list.find((x) => x.id === id) || null;
        this.current = t;
    }

    /**
     * @param {Vector3} eye
     * @param {Vector3} forward flattened camera forward
     * @param {boolean} [reverse] Shift+Tab
     */
    tab(eye: Vector3, forward: Vector3, reverse = false): Targetable | null {
        const front: Targetable[] = [];
        for (let i = 0; i < this.list.length; i++) {
            const t = this.list[i];
            if (!t.hostile) continue;
            _to.copyFrom(t.position).subtractInPlace(eye);
            const dist = Math.hypot(_to.x, _to.z);
            if (dist < 1.2 || dist > 42) continue;
            const nx = _to.x / dist;
            const nz = _to.z / dist;
            const dot = nx * forward.x + nz * forward.z;
            if (dot < 0.15) continue;
            front.push(t);
        }
        front.sort((a, b) => {
            const da = Math.hypot(a.position.x - eye.x, a.position.z - eye.z);
            const db = Math.hypot(b.position.x - eye.x, b.position.z - eye.z);
            return da - db;
        });
        if (front.length === 0) {
            this.clear();
            return null;
        }
        if (this._cycle >= front.length) this._cycle = -1;
        if (this._cycle < 0) this._cycle = reverse ? front.length - 1 : 0;
        else {
            this._cycle = reverse
                ? (this._cycle - 1 + front.length) % front.length
                : (this._cycle + 1) % front.length;
        }
        this.current = front[this._cycle];
        return this.current;
    }
}
