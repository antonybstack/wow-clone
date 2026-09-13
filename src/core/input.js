/**
 * WoW-style input. Pointer-lock mouselook, window-level capture.
 *
 * Keyboard (no RMB): W/S along facing, A/D turn, Q/E strafe, Space jump.
 * RMB held: lock + look + face the camera; A/D become strafe.
 * LMB drag: lock + orbit without turning. LMB / RMB click: select.
 * Both buttons: run forward. Tab / Shift+Tab: cycle hostiles.
 * Escape: close pane then clear target. NumLock / = / MMB: autorun.
 * Shift: walk.
 */

export const input = {
    /** W/S + both-buttons + autorun, -1..1 */
    forward: 0,
    /** A/D keyboard turn when not mouselook, -1..1 */
    turn: 0,
    /** Q/E always; A/D while RMB, -1..1 */
    strafe: 0,
    moveX: 0,
    moveZ: 0,
    moving: false,
    lookX: 0,
    lookY: 0,
    zoomDelta: 0,
    looking: false,
    lmb: false,
    rmb: false,
    /** True while LMB moved enough that release is not a click. */
    lmbDrag: false,
    rmbDrag: false,
    walk: false,
    /** Running — true unless Shift is held. Kept for the intent seam. */
    sprint: true,
    /** Space held. Impulse is applied only while grounded. */
    jump: false,
    /** 0 = none, else 1..5 — edge, cleared each frame */
    spellPressed: 0,
    spellHeld2: false,
    tabPressed: false,
    tabBack: false,
    toggleBag: false,
    togglePaper: false,
    escape: false,
    autorun: false,
    clickX: 0,
    clickY: 0,
    clicked: false,
    pointerLocked: false,
};

const keys = Object.create(null);
const LOOK_SCALE = 0.0036;
const CLICK_SLOP = 16;

let lmbTravel = 0;
let rmbTravel = 0;
/**
 * Set whenever the pointer-lock state flips. Entering lock warps the cursor to
 * the centre of the screen and leaving it warps back, and the browser reports
 * that warp as `movementX` on the next move — a whole half-screen of it. That
 * is not input, and applying it swings the camera the moment RMB goes down.
 */
let dropWarpMove = false;
/**
 * Which buttons belong to the UI for the duration of the current press.
 *
 * A press that lands on a widget stays the widget's until it is released, even
 * if the cursor slides off — the action bar buttons are 42 px, so sliding off
 * mid-click is normal, and without this the move handler's recovery below
 * adopts the still-held button as world mouselook and the view starts orbiting.
 */
let uiOwnsLmb = false;
let uiOwnsRmb = false;
/** Last pointer-lock attempt, ms. Chrome rejects a burst of requests. */
let lockAttemptAt = 0;
/** Cursor position at press, used for click-select after lock. */
let pressX = 0;
let pressY = 0;
/** @type {HTMLCanvasElement|null} */
let canvasEl = null;

/** @type {((e:{x:number,y:number})=>void)|null} */
let onToggleOverlay = null;

/**
 * @param {EventTarget|null} el
 */
function isHudChrome(el) {
    if (!el || !/** @type {Element} */ (el).closest) return false;
    const node = /** @type {Element} */ (el);
    // Action bar is handled by `isActionBar`, not here: right-drag over it
    // still has to look, so it cannot be chrome for every button.
    return !!node.closest("#hud .pane, #hud .item, #ov");
}

/**
 * The action bar. Left-click is a UI press that casts; right-drag still falls
 * through to mouselook, which is why this is separate from the chrome test.
 *
 * Matches the strip, not just the buttons: the six-pixel gaps between slots are
 * the bar itself, and a left-click that lands in one is still the player
 * reaching for an ability, not for the camera.
 * @param {EventTarget|null} el
 */
function isActionBar(el) {
    if (!el || !/** @type {Element} */ (el).closest) return false;
    return !!(/** @type {Element} */ (el).closest("#hud .bar"));
}

function syncLooking() {
    input.looking = input.rmb || input.lmb;
}

function ensurePointerLock() {
    if (!canvasEl) return;
    if (document.pointerLockElement === canvasEl) return;
    // Chrome rate-limits lock requests and rejects a burst outright with
    // NotAllowedError. Retrying into that rejection — which the old fallback
    // did unconditionally — is what kept it rejected, leaving the cursor
    // hidden and the look unlocked for the rest of the drag.
    const now = performance.now();
    if (now - lockAttemptAt < 350) return;
    lockAttemptAt = now;
    const req = canvasEl.requestPointerLock.bind(canvasEl);
    try {
        const p = req({ unadjustedMovement: true });
        if (p && typeof p.catch === "function") {
            p.catch((err) => {
                // `unadjustedMovement` is not supported everywhere, so a plain
                // request is the fallback — but only for a rejection that is
                // actually about the option.
                if (err && err.name === "NotAllowedError") return;
                try { req(); } catch { /* ignore */ }
            });
        }
    } catch {
        try { req(); } catch { /* ignore */ }
    }
}

function exitPointerLock() {
    if (document.pointerLockElement) {
        try { document.exitPointerLock(); } catch { /* ignore */ }
    }
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {{ onToggleOverlay?: () => void }} [hooks]
 */
export function initInput(canvas, hooks) {
    onToggleOverlay = hooks?.onToggleOverlay ?? null;
    canvasEl = canvas;

    const blockMenu = (e) => {
        if (isHudChrome(e.target)) return;
        e.preventDefault();
    };
    window.addEventListener("contextmenu", blockMenu, true);
    canvas.addEventListener("contextmenu", blockMenu);
    window.addEventListener("auxclick", (e) => {
        if (e.button === 1 && !isHudChrome(e.target)) e.preventDefault();
    }, true);

    const down = (e) => {
        if (isHudChrome(e.target)) {
            if (e.button === 0) uiOwnsLmb = true;
            if (e.button === 2) uiOwnsRmb = true;
            return;
        }
        // Clicking an ability is a button press, not a grab for the camera.
        // Starting mouselook and pointer lock here meant a click on the bar
        // drifted the camera yaw and left the body behind, and the next RMB
        // drag then swung the view to catch up.
        if (e.button === 0 && isActionBar(e.target)) {
            uiOwnsLmb = true;
            return;
        }
        if (e.button !== 0 && e.button !== 1 && e.button !== 2) return;

        pressX = e.clientX;
        pressY = e.clientY;

        if (e.button === 1) {
            e.preventDefault();
            input.autorun = !input.autorun;
            return;
        }

        if (e.button === 0) {
            input.lmb = true;
            input.lmbDrag = false;
            lmbTravel = 0;
        }
        if (e.button === 2) {
            e.preventDefault();
            input.rmb = true;
            input.rmbDrag = false;
            rmbTravel = 0;
        }
        syncLooking();
        if (input.looking) {
            canvas.style.cursor = "none";
            ensurePointerLock();
        }
    };

    const up = (e) => {
        if (e.button === 0) uiOwnsLmb = false;
        if (e.button === 2) uiOwnsRmb = false;
        if (e.button === 0) {
            // Only a press the world actually received counts as a click.
            // Without the `input.lmb` test, releasing over the bag or the
            // action bar retargeted whatever was behind the cursor.
            if (input.lmb && !input.rmb && !input.lmbDrag) {
                input.clicked = true;
                input.clickX = pressX;
                input.clickY = pressY;
            }
            input.lmb = false;
            input.lmbDrag = false;
            lmbTravel = 0;
        }
        if (e.button === 2) {
            if (input.rmb && !input.lmb && !input.rmbDrag) {
                input.clicked = true;
                input.clickX = pressX;
                input.clickY = pressY;
            }
            input.rmb = false;
            input.rmbDrag = false;
            rmbTravel = 0;
        }
        syncLooking();
        if (!input.looking) {
            canvas.style.cursor = "";
            exitPointerLock();
        }
    };

    const move = (e) => {
        // `e.buttons` is the truth about what is held, so reconcile against it
        // first. A `pointerup` that never arrives — released outside the
        // window, eaten by a native menu, cancelled by the OS — otherwise
        // leaves the button latched, and then every later mouse move turns the
        // camera with nothing held down at all.
        let healed = false;
        if (!(e.buttons & 1)) {
            uiOwnsLmb = false;
            if (input.lmb) {
                input.lmb = false;
                input.lmbDrag = false;
                lmbTravel = 0;
                healed = true;
            }
        }
        if (!(e.buttons & 2)) {
            uiOwnsRmb = false;
            if (input.rmb) {
                input.rmb = false;
                input.rmbDrag = false;
                rmbTravel = 0;
                healed = true;
            }
        }
        if (healed) {
            syncLooking();
            if (!input.looking) {
                canvas.style.cursor = "";
                exitPointerLock();
            }
        }

        // Recover if pointerdown was swallowed but the button is held. A press
        // the UI already owns is never adopted here.
        if (!isHudChrome(e.target) && !input.looking) {
            if (e.buttons & 1 && !uiOwnsLmb && !isActionBar(e.target)) {
                input.lmb = true;
                lmbTravel = 0;
            }
            if (e.buttons & 2 && !uiOwnsRmb) {
                input.rmb = true;
                rmbTravel = 0;
            }
            if (input.lmb || input.rmb) {
                syncLooking();
                canvas.style.cursor = "none";
            }
        }

        const dx = e.movementX || 0;
        const dy = e.movementY || 0;

        if (dropWarpMove) {
            dropWarpMove = false;
            return;
        }

        if (input.lmb && !input.rmb) {
            lmbTravel += Math.abs(dx) + Math.abs(dy);
            if (lmbTravel > CLICK_SLOP) input.lmbDrag = true;
        }
        if (input.rmb) {
            rmbTravel += Math.abs(dx) + Math.abs(dy);
            if (rmbTravel > CLICK_SLOP) input.rmbDrag = true;
        }

        if (!input.looking) return;
        input.lookX += dx * LOOK_SCALE;
        input.lookY += dy * LOOK_SCALE;
    };

    // Capture phase so a full-screen HUD / overlay cannot eat the press.
    window.addEventListener("pointerdown", down, true);
    window.addEventListener("pointerup", up, true);
    window.addEventListener("pointermove", move, true);

    document.addEventListener("pointerlockchange", () => {
        input.pointerLocked = document.pointerLockElement === canvas;
        dropWarpMove = true;
        if (!input.pointerLocked && !input.lmb && !input.rmb) {
            input.looking = false;
            canvas.style.cursor = "";
        }
    });

    canvas.addEventListener(
        "wheel",
        (e) => {
            e.preventDefault();
            input.zoomDelta += e.deltaY * 0.0016;
        },
        { passive: false }
    );

    window.addEventListener("keydown", (e) => {
        if (e.code === "F1" || e.code === "Backquote") {
            e.preventDefault();
            onToggleOverlay?.();
            return;
        }
        if (e.code === "Tab") {
            e.preventDefault();
            if (!e.repeat) {
                if (e.shiftKey) input.tabBack = true;
                else input.tabPressed = true;
            }
            return;
        }
        if (e.code === "Escape") {
            if (document.pointerLockElement) {
                exitPointerLock();
            }
            if (!e.repeat) input.escape = true;
            return;
        }
        if (e.code === "Space") {
            e.preventDefault();
        }
        if (e.code === "NumLock" || e.code === "Equal") {
            e.preventDefault();
            if (!e.repeat) input.autorun = !input.autorun;
            return;
        }
        if (e.repeat) return;
        keys[e.code] = true;
        if (e.code === "KeyB") input.toggleBag = true;
        if (e.code === "KeyC") input.togglePaper = true;
        const n = SPELL_KEYS[e.code];
        if (n) {
            input.spellPressed = n;
            if (n === 2) input.spellHeld2 = true;
        }
    });

    window.addEventListener("keyup", (e) => {
        keys[e.code] = false;
        if (SPELL_KEYS[e.code] === 2) input.spellHeld2 = false;
    });

    const release = () => {
        input.lmb = input.rmb = input.looking = false;
        input.lmbDrag = input.rmbDrag = false;
        uiOwnsLmb = uiOwnsRmb = false;
        lmbTravel = rmbTravel = 0;
        canvas.style.cursor = "";
    };

    // A cancelled pointer never delivers `pointerup`, so without this the
    // button stays latched and the camera keeps turning on every move.
    window.addEventListener("pointercancel", release, true);

    window.addEventListener("blur", () => {
        for (const k in keys) keys[k] = false;
        input.spellHeld2 = false;
        input.jump = false;
        release();
        exitPointerLock();
    });
}

const SPELL_KEYS = {
    Digit1: 1,
    Digit2: 2,
    Digit3: 3,
    Digit4: 4,
    Digit5: 5,
};

export function pollInput() {
    let forward = 0;
    let turn = 0;
    let strafe = 0;

    if (keys.KeyW || keys.ArrowUp) forward += 1;
    if (keys.KeyS || keys.ArrowDown) {
        forward -= 1;
        input.autorun = false;
    }
    if (input.lmb && input.rmb) forward += 1;
    if (keys.KeyQ) strafe -= 1;
    if (keys.KeyE) strafe += 1;

    if (input.rmb) {
        if (keys.KeyA || keys.ArrowLeft) strafe -= 1;
        if (keys.KeyD || keys.ArrowRight) strafe += 1;
    } else {
        if (keys.KeyA || keys.ArrowLeft) turn -= 1;
        if (keys.KeyD || keys.ArrowRight) turn += 1;
    }

    if (input.autorun && forward >= 0) forward = Math.max(forward, 1);

    const len = Math.sqrt(forward * forward + strafe * strafe);
    if (len > 1) {
        forward /= len;
        strafe /= len;
    }

    input.forward = forward;
    input.turn = turn;
    input.strafe = strafe;
    input.moveX = strafe;
    input.moveZ = forward;
    input.moving = len > 0.001 || Math.abs(turn) > 0.001;
    input.walk = !!(keys.ShiftLeft || keys.ShiftRight);
    input.sprint = !input.walk;
    input.jump = !!keys.Space;
}

export function endFrame() {
    input.lookX = 0;
    input.lookY = 0;
    input.zoomDelta = 0;
    input.spellPressed = 0;
    input.tabPressed = false;
    input.tabBack = false;
    input.toggleBag = false;
    input.togglePaper = false;
    input.escape = false;
    input.clicked = false;
}

export function isDown(code) {
    return !!keys[code];
}
