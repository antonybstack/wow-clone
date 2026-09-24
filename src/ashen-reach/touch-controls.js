/**
 * On-screen move, look, jump, and target for a phone.
 * The stick and buttons feed the same input object the keyboard uses.
 * A finger on the world still looks through the pointer path in input.js.
 */
import { input, setTouchJump, setTouchMove } from "../input.js";

const RADIUS = 46;

/** Stick offset from the pad center, in pixels, mapped to strafe and forward. */
export function stickAxes(dx, dy, radius = RADIUS) {
    const len = Math.hypot(dx, dy);
    if (len < radius * 0.16) return { x: 0, y: 0, active: false };
    const scale = Math.min(len, radius) / radius;
    return { x: (dx / len) * scale, y: (-dy / len) * scale, active: true };
}

export function touchControlsWanted() {
    const query = new URLSearchParams(location.search);
    if (query.has("touch")) return query.get("touch") !== "0";
    return window.matchMedia("(pointer: coarse)").matches;
}

export function installTouchControls() {
    if (!touchControlsWanted() || document.getElementById("touch-controls")) return;
    document.body.classList.add("touch-play");
    const style = document.createElement("style");
    style.textContent = `
body.touch-play{touch-action:none;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}
body.touch-play #help{display:none}
body.touch-play #touch-controls{position:fixed;inset:0;z-index:6;pointer-events:none}
body.touch-play .touch-menu,body.touch-play .touch-stick,body.touch-play .touch-actions button{pointer-events:auto;touch-action:manipulation}
body.touch-play .touch-menu{position:absolute;top:14px;left:96px;border:1px solid #766b4b;background:#171b16d9;color:#dcd1ad;font:12px Georgia,serif;padding:8px 12px;letter-spacing:.05em}
body.touch-play .touch-stick{position:absolute;left:calc(16px + env(safe-area-inset-left));bottom:calc(18px + env(safe-area-inset-bottom));width:118px;height:118px;border-radius:50%;border:1px solid #9b765088;background:#100e0c88;box-shadow:0 0 0 2px #17171488}
body.touch-play .touch-knob{position:absolute;left:50%;top:50%;width:52px;height:52px;margin:-26px 0 0 -26px;border-radius:50%;background:#181511ee;border:1px solid #9b7650;box-shadow:0 2px 8px #000}
body.touch-play .touch-actions{position:absolute;right:calc(16px + env(safe-area-inset-right));bottom:calc(16px + env(safe-area-inset-bottom));display:flex;gap:10px}
body.touch-play .touch-actions button{width:62px;height:62px;border:1px solid #9b7650;background:#181511ee;color:#ffe1a8;font:13px Georgia,serif;box-shadow:0 0 0 2px #171714,0 4px 14px #000}
body.touch-play .touch-attack{position:relative}
body.touch-play .touch-attack:after{content:"";position:absolute;inset:0;background:#080908c9;transform-origin:bottom;transform:scaleY(var(--cooldown,0));pointer-events:none}
body.touch-play .touch-attack strong{position:absolute;inset:0;display:grid;place-items:center;font:12px Georgia;pointer-events:none}
body.touch-play .touch-attack.attacking{border-color:#e7c27a;box-shadow:0 0 0 2px #171714,0 0 12px #c8923a88}
body.touch-play .attack-slot{display:none}
body.touch-play .player-plate{top:52px;left:calc(12px + env(safe-area-inset-left));bottom:auto;width:min(210px,52vw)}
body.touch-play #metrics-overlay{top:150px}
body.touch-play .spell-bar{left:auto;right:calc(16px + env(safe-area-inset-right));bottom:calc(96px + env(safe-area-inset-bottom));transform:none;grid-template-columns:repeat(3,68px);gap:8px}
body.touch-play .spell-bar button{width:64px;height:64px}
body.touch-play .spell-bar span{display:block;font-size:10px;line-height:1.1;color:#eee0bd;white-space:nowrap}
body.touch-play .sound-toggle{display:none}
body.touch-play .cast-progress,body.touch-play .combat-error{bottom:calc(188px + env(safe-area-inset-bottom))}
body.armory-open #touch-controls,body.game-menu-open #touch-controls{display:none}
@media(max-width:380px){
  body.touch-play .touch-stick{left:calc(8px + env(safe-area-inset-left));bottom:calc(12px + env(safe-area-inset-bottom));width:104px;height:104px}
  body.touch-play .touch-actions{right:calc(8px + env(safe-area-inset-right));bottom:calc(12px + env(safe-area-inset-bottom));gap:6px}
  body.touch-play .touch-actions button{width:56px;height:56px;font-size:12px}
  body.touch-play .spell-bar{right:calc(8px + env(safe-area-inset-right));bottom:calc(82px + env(safe-area-inset-bottom));grid-template-columns:repeat(3,58px);gap:6px}
  body.touch-play .spell-bar button{width:56px;height:56px}
}
`;
    document.head.append(style);

    const root = document.createElement("div");
    root.id = "touch-controls";
    root.innerHTML = `
<button type="button" class="touch-menu">Menu</button>
<div class="touch-stick" role="application" aria-label="Move"><div class="touch-knob"></div></div>
<div class="touch-actions">
  <button type="button" class="touch-attack" data-attack aria-pressed="false">Attack<strong></strong></button>
  <button type="button" class="touch-target">Target</button>
  <button type="button" class="touch-jump">Jump</button>
</div>`;
    document.body.append(root);

    const stick = root.querySelector(".touch-stick");
    const knob = root.querySelector(".touch-knob");
    let stickId = null;

    const placeKnob = (clientX, clientY) => {
        const rect = stick.getBoundingClientRect();
        const dx = clientX - (rect.left + rect.width / 2);
        const dy = clientY - (rect.top + rect.height / 2);
        const axes = stickAxes(dx, dy, RADIUS);
        const shown = Math.min(Math.hypot(dx, dy), RADIUS);
        const len = Math.hypot(dx, dy) || 1;
        knob.style.transform = `translate(${(dx / len) * shown}px, ${(dy / len) * shown}px)`;
        setTouchMove(axes.y, axes.x, axes.active);
    };
    const releaseStick = () => {
        stickId = null;
        knob.style.transform = "";
        setTouchMove(0, 0, false);
    };
    stick.addEventListener("pointerdown", (event) => {
        if (stickId !== null) return;
        stickId = event.pointerId;
        stick.setPointerCapture(event.pointerId);
        placeKnob(event.clientX, event.clientY);
        event.preventDefault();
    });
    stick.addEventListener("pointermove", (event) => {
        if (event.pointerId !== stickId) return;
        placeKnob(event.clientX, event.clientY);
    });
    const endStick = (event) => {
        if (event.pointerId !== stickId) return;
        releaseStick();
    };
    stick.addEventListener("pointerup", endStick);
    stick.addEventListener("pointercancel", endStick);

    const jump = root.querySelector(".touch-jump");
    const holdJump = (down) => (event) => {
        if (down) jump.setPointerCapture(event.pointerId);
        setTouchJump(down);
        event.preventDefault();
    };
    jump.addEventListener("pointerdown", holdJump(true));
    jump.addEventListener("pointerup", holdJump(false));
    jump.addEventListener("pointercancel", holdJump(false));

    root.querySelector(".touch-target").addEventListener("pointerup", (event) => {
        input.tabPressed = true;
        event.preventDefault();
    });
    root.querySelector(".touch-menu").addEventListener("pointerup", (event) => {
        event.preventDefault();
        const menu = globalThis.ASHEN?.menu;
        if (!menu) return;
        if (menu.isOpen) menu.close();
        else menu.open();
    });

    document.addEventListener("touchmove", (event) => {
        if (!document.body.classList.contains("touch-play")) return;
        if (event.target.closest("#game-menu, .armory-panel, #armory")) return;
        event.preventDefault();
    }, { passive: false });
}
