/**
 * Action bar, unit frames, nameplates, bag, paper doll. DOM, not Babylon GUI.
 */

import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { ITEMS } from "../game/loadout";
import { input } from "../core/input.js";

const CSS = `
#hud { position:fixed; inset:0; pointer-events:none; z-index:40;
  font: 500 12px/1.35 ui-sans-serif, system-ui, sans-serif; color:#e6eef4; }
#hud * { box-sizing:border-box; }
#hud .bar {
  position:absolute; left:50%; bottom:22px; transform:translateX(-50%);
  display:flex; gap:6px; pointer-events:auto;
}
#hud .slot {
  width:42px; height:42px; border-radius:4px;
  background:rgba(8,14,18,0.72); border:1px solid rgba(160,200,180,0.28);
  display:flex; flex-direction:column; align-items:center; justify-content:center;
  letter-spacing:0.04em;
}
#hud .slot { cursor:pointer; user-select:none; }
#hud .slot:hover { border-color:rgba(190,230,210,0.5); }
#hud .slot.on { border-color:rgba(230,240,200,0.8); background:rgba(24,36,30,0.85); }
#hud .slot i { font-style:normal; font-size:9px; color:#8aa; }
#hud .slot b { font-weight:560; font-size:10px; }
#hud .stance {
  position:absolute; left:50%; bottom:74px; transform:translateX(-50%);
  font-size:11px; letter-spacing:0.06em; text-transform:uppercase; color:#9ec9b4;
  text-shadow:0 1px 10px #000;
}
#hud .plates { position:absolute; inset:0; pointer-events:none; }
#hud .plate {
  position:absolute; transform:translate(-50%,-120%);
  font-size:11px; letter-spacing:0.02em; white-space:nowrap;
  color:#c8e8d4; text-shadow:0 1px 6px #000;
}
#hud .plate.host { color:#f0d0c4; }
#hud .plate.tgt { color:#ffd2c4; font-weight:600; }
#hud .frames {
  position:absolute; top:16px; left:16px; display:flex; gap:8px;
}
#hud .unit {
  min-width:188px; padding:7px 10px;
  background:rgba(8,14,18,0.74); border:1px solid rgba(160,200,180,0.28);
  border-radius:3px;
}
#hud .unit.host { border-color:rgba(200,90,70,0.45); display:none; }
#hud .unit.host.on { display:block; }
#hud .unit .nm { font-size:13px; }
#hud .unit .sub { font-size:10px; color:#8aa; letter-spacing:0.06em; text-transform:uppercase; }
#hud .unit .hp { margin-top:5px; height:7px; background:#1a2a1c; border-radius:2px; overflow:hidden; }
#hud .unit .hp > i { display:block; height:100%; width:100%; background:#3d8a4a; }
#hud .unit.host .hp { background:#2a1512; }
#hud .unit.host .hp > i { background:#b44538; }
#hud .pane {
  position:absolute; top:72px; right:24px; width:280px; max-height:70vh; overflow:auto;
  background:rgba(8,12,16,0.88); border:1px solid rgba(160,200,180,0.22);
  border-radius:6px; padding:12px 14px; pointer-events:auto; display:none;
}
#hud .pane.on { display:block; }
#hud .pane h3 { margin:0 0 10px; font-size:11px; letter-spacing:0.16em; text-transform:uppercase; color:#8aa; }
#hud .row { display:flex; justify-content:space-between; gap:8px; padding:5px 0; border-bottom:1px solid rgba(255,255,255,0.05); }
#hud .row button, #hud .item {
  pointer-events:auto; cursor:pointer; background:transparent; color:#dbe6dc;
  border:0; font:inherit; text-align:left;
}
#hud .item:hover { color:#fff; }
`;

const PLATE_RANGE = 38;

export class Hud {
    /**
     * @param {import("../game/loadout.ts").Loadout} loadout
     * @param {import("../game/targeting.ts").Targeting} targeting
     * @param {() => void} onChange
     * @param {(pos: {x:number,y:number,z:number}, out: {x:number,y:number,z:number}) => boolean} [project]
     */
    constructor(loadout, targeting, onChange, project) {
        const style = document.createElement("style");
        style.textContent = CSS;
        document.head.appendChild(style);
        const el = document.createElement("div");
        el.id = "hud";
        document.body.appendChild(el);
        this.el = el;
        this.loadout = loadout;
        this.targeting = targeting;
        this.onChange = onChange;
        this.project = project || null;
        this._scr = new Vector3();
        this._world = new Vector3();

        this.frames = document.createElement("div");
        this.frames.className = "frames";
        el.appendChild(this.frames);

        this.player = document.createElement("div");
        this.player.className = "unit";
        this.player.innerHTML =
            "<div class='nm'>You</div><div class='sub'></div><div class='hp'><i></i></div>";
        this.frames.appendChild(this.player);

        this.tgt = document.createElement("div");
        this.tgt.className = "unit host";
        this.tgt.innerHTML = "<div class='nm'></div><div class='hp'><i></i></div>";
        this.frames.appendChild(this.tgt);

        this.stanceEl = document.createElement("div");
        this.stanceEl.className = "stance";
        el.appendChild(this.stanceEl);

        this.bar = document.createElement("div");
        this.bar.className = "bar";
        el.appendChild(this.bar);
        this.slots = [];
        /** True while slot 2 is held by the mouse rather than by the key. */
        this._heldBySlot = false;
        for (let i = 0; i < 5; i++) {
            const s = document.createElement("div");
            s.className = "slot";
            s.innerHTML = "<i>" + (i + 1) + "</i><b>—</b>";
            const n = i + 1;
            // Writes the same one-frame edge the keyboard writes, cleared by
            // `endFrame`, so a clicked ability and a pressed key reach the
            // spell system by one path. Input deliberately ignores left-clicks
            // on a slot, so this never starts mouselook.
            s.addEventListener("pointerdown", (e) => {
                if (e.button !== 0) return;
                e.preventDefault();
                input.spellPressed = n;
                if (n === 2) {
                    input.spellHeld2 = true;
                    this._heldBySlot = true;
                }
                s.classList.add("on");
            });
            this.bar.appendChild(s);
            this.slots.push(s);
        }
        // Release anywhere: the cursor is free to leave the button mid-hold.
        window.addEventListener("pointerup", () => {
            if (this._heldBySlot) {
                input.spellHeld2 = false;
                this._heldBySlot = false;
            }
            for (let i = 0; i < this.slots.length; i++) {
                this.slots[i].classList.remove("on");
            }
        });

        this.bag = document.createElement("div");
        this.bag.className = "pane";
        el.appendChild(this.bag);
        this.paper = document.createElement("div");
        this.paper.className = "pane";
        this.paper.style.right = "320px";
        el.appendChild(this.paper);

        this.plates = document.createElement("div");
        this.plates.className = "plates";
        el.appendChild(this.plates);

        this.refresh();
    }

    toggleBag() { this.bag.classList.toggle("on"); this.refresh(); }
    togglePaper() { this.paper.classList.toggle("on"); this.refresh(); }

    /** Close the topmost pane. Returns true if something closed. */
    closeTop() {
        if (this.bag.classList.contains("on")) {
            this.bag.classList.remove("on");
            return true;
        }
        if (this.paper.classList.contains("on")) {
            this.paper.classList.remove("on");
            return true;
        }
        return false;
    }

    refresh() {
        this.player.querySelector(".sub").textContent = this.loadout.stance();
        const names = this.loadout.bar();
        for (let i = 0; i < 5; i++) {
            this.slots[i].querySelector("b").textContent = names[i];
        }

        const L = this.loadout;
        this.paper.innerHTML = "<h3>Worn — " + L.stance() + "</h3>";
        for (const slot of Object.keys(L.equipped)) {
            const id = L.equipped[slot];
            const row = document.createElement("div");
            row.className = "row";
            const lab = document.createElement("span");
            lab.textContent = slot;
            const btn = document.createElement("button");
            btn.textContent = id ? ITEMS[id].name : "—";
            btn.onclick = () => {
                if (id) {
                    L.unequip(/** @type {any} */ (slot));
                    this.onChange();
                    this.refresh();
                }
            };
            row.appendChild(lab);
            row.appendChild(btn);
            this.paper.appendChild(row);
        }

        this.bag.innerHTML = "<h3>Bag</h3>";
        for (const id of L.bag) {
            const it = ITEMS[id];
            const b = document.createElement("div");
            b.className = "item";
            b.textContent = it.name + "  (" + it.slot + ")";
            b.onclick = () => {
                L.equip(id);
                this.onChange();
                this.refresh();
            };
            this.bag.appendChild(b);
        }
    }

    /**
     * @param {{x:number,z:number}} [eye]
     */
    update(eye) {
        this.stanceEl.textContent = input.autorun
            ? "Autorun"
            : this.loadout.stance();

        const t = this.targeting.current;
        if (!t) this.tgt.classList.remove("on");
        else {
            this.tgt.classList.add("on");
            this.tgt.querySelector(".nm").textContent = t.name;
        }

        if (!this.project || !eye) return;
        const list = this.targeting.list;
        let html = "";
        for (let i = 0; i < list.length; i++) {
            const n = list[i];
            const dx = n.position.x - eye.x;
            const dz = n.position.z - eye.z;
            if (dx * dx + dz * dz > PLATE_RANGE * PLATE_RANGE) continue;
            this._world.copyFrom(n.position);
            this._world.y += n.plateY || 1.75;
            if (!this.project(this._world, this._scr)) continue;
            const isTgt = t && t.id === n.id;
            const cls = "plate" + (n.hostile ? " host" : "") + (isTgt ? " tgt" : "");
            html += "<div class='" + cls + "' style='left:" +
                this._scr.x.toFixed(1) + "px;top:" + this._scr.y.toFixed(1) + "px'>" +
                n.name + "</div>";
        }
        this.plates.innerHTML = html;
    }
}
