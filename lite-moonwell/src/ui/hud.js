/**
 * Action bar, unit frames, nameplates, bag, paper doll. DOM, not Babylon GUI.
 */

import { getViewProjectionMatrix } from "@babylonjs/lite";

import { input } from "../input.js";

const PLAYER_NAME = "Duskweaver";
const SPELL_NAMES = ["Crescent", "Beam", "Eruption", "Shards", "Swirl"];
const GCD = 1;
const PLATE_RANGE = 38;
const PLATE_Y = 1.65;

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
  letter-spacing:0.04em; position:relative; overflow:hidden;
  cursor:pointer; user-select:none;
}
#hud .slot:hover { border-color:rgba(190,230,210,0.5); }
#hud .slot.on { border-color:rgba(230,240,200,0.8); background:rgba(24,36,30,0.85); }
#hud .slot.held { border-color:rgba(210,170,255,0.9); background:rgba(36,22,48,0.88);
  box-shadow:0 0 10px rgba(150,80,220,0.4); }
#hud .slot i { font-style:normal; font-size:9px; color:#8aa; position:relative; z-index:1; }
#hud .slot b { font-weight:560; font-size:10px; position:relative; z-index:1; }
#hud .slot .swipe {
  position:absolute; inset:0; background:rgba(4,10,14,0.62);
  transform:scaleY(0); transform-origin:top center; pointer-events:none;
}
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
  min-width:220px; padding:7px 10px; position:relative;
  background:rgba(8,14,18,0.74); border:1px solid rgba(160,200,180,0.28);
  border-radius:3px;
}
#hud .unit.host { border-color:rgba(200,90,70,0.45); display:none; }
#hud .unit.host.on { display:block; }
#hud .unit .hd {
  display:flex; align-items:baseline; justify-content:space-between; gap:12px;
}
#hud .unit .nm {
  font-size:13px; min-width:0; overflow:hidden;
  text-overflow:ellipsis; white-space:nowrap;
}
#hud .unit .sub { font-size:10px; color:#8aa; letter-spacing:0.06em; text-transform:uppercase; }
#hud .unit .hpn {
  flex:0 0 auto; font-size:10px; color:#c8e8d4;
  font-variant-numeric:tabular-nums; white-space:nowrap;
}
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
#hud .hint {
  position:absolute; left:16px; bottom:16px; max-width:46vw;
  font-size:11px; color:#9ec9b4; text-shadow:0 1px 8px #000; opacity:0.82;
}
#hud .hint.off { display:none; }
`;

const _scr = { x: 0, y: 0 };

function hpPct(cur, max) {
    const m = max > 0 ? max : 1;
    const n = typeof cur === "number" ? cur : m;
    return Math.max(0, Math.min(1, n / m));
}

function hpLabel(cur, max) {
    const m = typeof max === "number" ? max : 0;
    const n = typeof cur === "number" ? cur : m;
    return Math.ceil(n) + " / " + Math.ceil(m);
}

/**
 * @param {import("@babylonjs/lite").ArcRotateCamera} camera
 * @param {HTMLCanvasElement} canvas
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @param {{x:number,y:number}} out
 */
function project(camera, canvas, x, y, z, out) {
    const w = canvas.clientWidth || canvas.width;
    const h = canvas.clientHeight || canvas.height;
    if (!w || !h || !camera) {
        return false;
    }
    let vp;
    try {
        vp = getViewProjectionMatrix(camera, w / h);
    } catch {
        return false;
    }
    const cx = vp[0] * x + vp[4] * y + vp[8] * z + vp[12];
    const cy = vp[1] * x + vp[5] * y + vp[9] * z + vp[13];
    const cw = vp[3] * x + vp[7] * y + vp[11] * z + vp[15];
    if (cw <= 1e-5) {
        return false;
    }
    const ndcX = cx / cw;
    const ndcY = cy / cw;
    out.x = (ndcX * 0.5 + 0.5) * w;
    out.y = (1 - (ndcY * 0.5 + 0.5)) * h;
    return out.x > -40 && out.x < w + 40 && out.y > -40 && out.y < h + 40;
}

export class Hud {
    /**
     * @param {{
     *   player: { hp?: number, hpMax?: number, body?: { position?: { x:number, z:number } } },
     *   targeting: { current: object|null, list: object[] },
     *   spells: { gcdLeft: number, ribbon?: { held?: boolean } },
     *   camera: object,
     *   canvas: HTMLCanvasElement,
     * }} opts
     */
    constructor(opts) {
        this.player = opts.player;
        this.targeting = opts.targeting;
        this.spells = opts.spells;
        this.camera = opts.camera;
        this.canvas = opts.canvas;

        const style = document.createElement("style");
        style.textContent = CSS;
        document.head.appendChild(style);

        const el = document.createElement("div");
        el.id = "hud";
        document.body.appendChild(el);
        this.el = el;

        this.frames = document.createElement("div");
        this.frames.className = "frames";
        el.appendChild(this.frames);

        this.playerEl = document.createElement("div");
        this.playerEl.className = "unit player";
        this.playerEl.id = "hud-player";
        this.playerEl.innerHTML =
            "<div class='hd'><div class='nm'></div><div class='hpn'></div></div>" +
            "<div class='sub'></div><div class='hp'><i></i></div>";
        this.frames.appendChild(this.playerEl);
        this.playerName = this.playerEl.querySelector(".nm");
        this.playerSub = this.playerEl.querySelector(".sub");
        this.playerHpN = this.playerEl.querySelector(".hpn");
        this.playerHp = this.playerEl.querySelector(".hp > i");
        this.playerName.textContent = PLAYER_NAME;
        this.playerSub.textContent = "Seer";

        this.tgt = document.createElement("div");
        this.tgt.className = "unit host";
        this.tgt.id = "hud-target";
        this.tgt.innerHTML =
            "<div class='hd'><div class='nm'></div><div class='hpn'></div></div>" +
            "<div class='hp'><i></i></div>";
        this.frames.appendChild(this.tgt);
        this.tgtName = this.tgt.querySelector(".nm");
        this.tgtHpN = this.tgt.querySelector(".hpn");
        this.tgtHp = this.tgt.querySelector(".hp > i");

        this.stanceEl = document.createElement("div");
        this.stanceEl.className = "stance";
        el.appendChild(this.stanceEl);

        this.bar = document.createElement("div");
        this.bar.className = "bar";
        this.bar.id = "hud-bar";
        el.appendChild(this.bar);
        this.slots = [];
        this.swipes = [];
        /** True while slot 2 is held by the mouse rather than by the key. */
        this._heldBySlot = false;
        for (let i = 0; i < 5; i++) {
            const s = document.createElement("div");
            s.className = "slot";
            s.dataset.slot = String(i + 1);
            s.innerHTML = "<span class='swipe'></span><i>" + (i + 1) + "</i><b>" + SPELL_NAMES[i] + "</b>";
            const n = i + 1;
            s.addEventListener("pointerdown", (e) => {
                if (e.button !== 0) {
                    return;
                }
                e.preventDefault();
                input.spellPressed = n;
                if (n === 2) {
                    input.spellHeld2 = true;
                    input.castHold = true;
                    this._heldBySlot = true;
                } else {
                    input.castInstant = true;
                }
                s.classList.add("on");
            });
            this.bar.appendChild(s);
            this.slots.push(s);
            this.swipes.push(s.querySelector(".swipe"));
        }
        window.addEventListener("pointerup", () => {
            if (this._heldBySlot) {
                input.spellHeld2 = false;
                input.castHold = false;
                this._heldBySlot = false;
            }
            for (let i = 0; i < this.slots.length; i++) {
                this.slots[i].classList.remove("on");
            }
        });

        this.bag = document.createElement("div");
        this.bag.className = "pane";
        this.bag.id = "hud-bag";
        this.bag.innerHTML = "<h3>Bag</h3><div class='row'><span>Empty</span></div>";
        el.appendChild(this.bag);

        this.paper = document.createElement("div");
        this.paper.className = "pane";
        this.paper.id = "hud-paper";
        this.paper.style.right = "320px";
        this.paper.innerHTML =
            "<h3>Character</h3>" +
            "<div class='row'><span>" + PLAYER_NAME + "</span><span>Seer</span></div>" +
            "<div class='row'><span>Worn</span><span>—</span></div>";
        el.appendChild(this.paper);

        this.hint = document.createElement("div");
        this.hint.className = "hint";
        this.hint.id = "hud-hint";
        this.hint.textContent = "WASD move · RMB look · 1–5 spells · Tab target · B bag · C character · H hint";
        el.appendChild(this.hint);

        this.plates = document.createElement("div");
        this.plates.className = "plates";
        this.plates.id = "hud-plates";
        el.appendChild(this.plates);

        this._hintOn = true;
    }

    toggleBag() {
        this.bag.classList.toggle("on");
    }

    togglePaper() {
        this.paper.classList.toggle("on");
    }

    toggleHint() {
        this._hintOn = !this._hintOn;
        this.hint.classList.toggle("off", !this._hintOn);
    }

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

    update() {
        if (input.toggleBag) {
            this.toggleBag();
            input.toggleBag = false;
        }
        if (input.togglePaper) {
            this.togglePaper();
            input.togglePaper = false;
        }
        if (input.toggleHint) {
            this.toggleHint();
            input.toggleHint = false;
        }

        this.stanceEl.textContent = input.autorun ? "Autorun" : "";

        const p = this.player;
        const pMax = p?.hpMax || 100;
        const pHp = typeof p?.hp === "number" ? p.hp : pMax;
        this.playerHp.style.width = (hpPct(pHp, pMax) * 100).toFixed(1) + "%";
        this.playerHpN.textContent = hpLabel(pHp, pMax);
        this.playerEl.dataset.hp = String(Math.ceil(pHp));

        const t = this.targeting.current;
        if (!t) {
            this.tgt.classList.remove("on");
            this.tgt.dataset.hp = "";
        } else {
            this.tgt.classList.add("on");
            this.tgtName.textContent = t.name || "Training Dummy";
            const max = t.hpMax || 10000;
            const hp = typeof t.hp === "number" ? t.hp : max;
            this.tgtHp.style.width = (hpPct(hp, max) * 100).toFixed(1) + "%";
            this.tgtHpN.textContent = hpLabel(hp, max);
            this.tgt.dataset.hp = String(Math.ceil(hp));
        }

        const gcd = Math.max(0, Math.min(1, (this.spells.gcdLeft || 0) / GCD));
        this.bar.style.setProperty("--gcd", String(gcd));
        this.bar.dataset.gcd = gcd.toFixed(3);
        for (let i = 0; i < this.swipes.length; i++) {
            this.swipes[i].style.transform = "scaleY(" + gcd + ")";
        }

        const held = !!(input.spellHeld2 || this.spells.ribbon?.held);
        this.slots[1].classList.toggle("held", held);
        this.slots[1].dataset.held = held ? "1" : "0";

        this._updatePlates();
    }

    _updatePlates() {
        const list = this.targeting.list;
        const eye = this.player?.body?.position;
        const cur = this.targeting.current;
        if (!list || !list.length || !eye) {
            this.plates.innerHTML = "";
            return;
        }
        let html = "";
        for (let i = 0; i < list.length; i++) {
            const n = list[i];
            const pos = n.position;
            if (!pos) {
                continue;
            }
            const dx = pos.x - eye.x;
            const dz = pos.z - eye.z;
            if (dx * dx + dz * dz > PLATE_RANGE * PLATE_RANGE) {
                continue;
            }
            if (!project(this.camera, this.canvas, pos.x, pos.y + PLATE_Y, pos.z, _scr)) {
                continue;
            }
            const isTgt = !!(cur && cur.id === n.id);
            const cls = "plate" + (n.hostile ? " host" : "") + (isTgt ? " tgt" : "");
            html += "<div class='" + cls + "' style='left:" +
                _scr.x.toFixed(1) + "px;top:" + _scr.y.toFixed(1) + "px'>" +
                (n.name || "Training Dummy") + "</div>";
        }
        this.plates.innerHTML = html;
    }
}
