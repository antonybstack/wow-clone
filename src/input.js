/**
 * WoW-style input for Lite. Pointer-lock mouselook, window-level capture.
 *
 * Keyboard (no RMB): W/S along facing, A/D turn, Q/E strafe, Space jump.
 * RMB held: lock + look + face the camera; A/D become strafe.
 * LMB drag: lock + orbit without turning the body.
 * LMB / RMB click (travel < CLICK_SLOP): select. Tab / Shift+Tab: cycle hostiles.
 * Esc: unlock pointer, then clear target. Both buttons: run forward. Shift walks.
 * 1/3/4/5: instant void spells (edge). 2: held channel. Tab / Esc unchanged.
 * B bag · C character pane · H help (HUD chrome; look still hits the canvas).
 */

export const input = {
    forward: 0,
    turn: 0,
    strafe: 0,
    lookX: 0,
    lookY: 0,
    zoomDelta: 0,
    looking: false,
    lmb: false,
    rmb: false,
    lmbDrag: false,
    rmbDrag: false,
    walk: false,
    jump: false,
    autorun: false,
    pointerLocked: false,
    castInstant: false,
    castHold: false,
    /** 0 = none, else 1..5 — edge, consumed by the spell system. */
    spellPressed: 0,
    spellHeld2: false,
    tabPressed: false,
    tabBack: false,
    toggleBag: false,
    togglePaper: false,
    toggleHint: false,
    heightUp: false,
    heightDown: false,
    cycleSkin: false,
    toggleHelm: false,
    unequipHelm: false,
    escape: false,
    clicked: false,
    clickX: 0,
    clickY: 0,
};

const SPELL_KEYS = {
    Digit1: 1,
    Digit2: 2,
    Digit3: 3,
    Digit4: 4,
    Digit5: 5,
    Numpad1: 1,
    Numpad2: 2,
    Numpad3: 3,
    Numpad4: 4,
    Numpad5: 5,
};

const keys = Object.create(null);
let inputEnabled = true;

/** Modal game tools release held input on both entry and exit. */
export function setInputEnabled(enabled) {
    inputEnabled = !!enabled;
    for (const code of Object.keys(keys)) delete keys[code];
    for (const key of Object.keys(input)) {
        if (typeof input[key] === 'boolean') input[key] = false;
        else if (typeof input[key] === 'number') input[key] = 0;
    }
    input.castSpell = null;
    releaseButtons();
    exitPointerLock();
}

const LOOK_SCALE = 0.0036;
export const CLICK_SLOP = 16;

let lmbTravel = 0;
let rmbTravel = 0;
/** Drop the lock-enter cursor warp so RMB-down does not yank the camera. */
let dropWarpMove = false;
let lockAttemptAt = 0;
/** @type {HTMLCanvasElement|null} */
let canvasEl = null;
/** Cursor position at press, used for click-select after lock. */
let pressX = 0;
let pressY = 0;
/** Ignore the Esc that just left pointer lock so unlock does not also clear target. */
let unlockedAt = 0;

function isHudWidget(el) {
    if (!el || !/** @type {Element} */ (el).closest) {
        return false;
    }
    return !!(/** @type {Element} */ (el).closest(
        "#hud-paper, #hud-hint, #hud-bag, #hud-bar, #hud-actions, #hud .action-bar, #hud .simple-pane, #hud .help-pane, #hud .hud-actions, #hud button, #hud select, #hud input, #hud textarea, #hud label",
    ));
}

function isFormControl(el) {
    if (!el || el === document.body || el === document.documentElement) {
        return false;
    }
    const tag = el.tagName;
    return tag === "SELECT" || tag === "TEXTAREA" || tag === "INPUT" || tag === "BUTTON" || tag === "OPTION" || !!el.isContentEditable;
}

function syncLooking() {
    input.looking = input.rmb || input.lmb;
}

function ensurePointerLock() {
    if (!canvasEl) {
        return;
    }
    if (document.pointerLockElement === canvasEl) {
        return;
    }
    const now = performance.now();
    if (now - lockAttemptAt < 350) {
        return;
    }
    lockAttemptAt = now;
    const req = canvasEl.requestPointerLock.bind(canvasEl);
    try {
        const pending = req({ unadjustedMovement: true });
        if (pending && typeof pending.catch === "function") {
            pending.catch((err) => {
                if (err && err.name === "NotAllowedError") {
                    return;
                }
                try {
                    req();
                } catch {
                    /* ignore */
                }
            });
        }
    } catch {
        try {
            req();
        } catch {
            /* ignore */
        }
    }
}

function exitPointerLock() {
    if (document.pointerLockElement) {
        try {
            document.exitPointerLock();
        } catch {
            /* ignore */
        }
    }
}

function releaseButtons() {
    input.lmb = input.rmb = input.looking = false;
    input.lmbDrag = input.rmbDrag = false;
    lmbTravel = rmbTravel = 0;
    if (canvasEl) {
        canvasEl.style.cursor = "";
    }
}

/**
 * @param {HTMLCanvasElement} canvas
 */
export function initInput(canvas) {
    canvasEl = canvas;

    const blockMenu = (event) => event.preventDefault();
    window.addEventListener("contextmenu", blockMenu, true);
    canvas.addEventListener("contextmenu", blockMenu);
    window.addEventListener("auxclick", (event) => {
        if (event.button === 1) {
            event.preventDefault();
        }
    }, true);

    const down = (event) => {
        // Action bar / panes own the press; #hud itself is pointer-events:none
        // so empty chrome never eats look.
        if (!inputEnabled || isHudWidget(event.target) || event.target !== canvas) {
            return;
        }
        if (event.button !== 0 && event.button !== 1 && event.button !== 2) {
            return;
        }
        pressX = event.clientX;
        pressY = event.clientY;
        if (event.button === 1) {
            event.preventDefault();
            input.autorun = !input.autorun;
            return;
        }
        if (event.button === 0) {
            input.lmb = true;
            input.lmbDrag = false;
            lmbTravel = 0;
        }
        if (event.button === 2) {
            event.preventDefault();
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

    const up = (event) => {
        if (event.button === 0) {
            if (input.lmb && !input.rmb && !input.lmbDrag && lmbTravel <= CLICK_SLOP) {
                input.clicked = true;
                input.clickX = pressX;
                input.clickY = pressY;
            }
            input.lmb = false;
            input.lmbDrag = false;
            lmbTravel = 0;
        }
        if (event.button === 2) {
            if (input.rmb && !input.lmb && !input.rmbDrag && rmbTravel <= CLICK_SLOP) {
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

    const move = (event) => {
        if (!inputEnabled) return;
        let healed = false;
        if (!(event.buttons & 1) && input.lmb) {
            input.lmb = false;
            input.lmbDrag = false;
            lmbTravel = 0;
            healed = true;
        }
        if (!(event.buttons & 2) && input.rmb) {
            input.rmb = false;
            input.rmbDrag = false;
            rmbTravel = 0;
            healed = true;
        }
        if (healed) {
            syncLooking();
            if (!input.looking) {
                canvas.style.cursor = "";
                exitPointerLock();
            }
        }

        const dx = event.movementX || 0;
        const dy = event.movementY || 0;
        if (dropWarpMove) {
            dropWarpMove = false;
            return;
        }
        if (input.lmb && !input.rmb) {
            lmbTravel += Math.abs(dx) + Math.abs(dy);
            if (lmbTravel > CLICK_SLOP) {
                input.lmbDrag = true;
            }
        }
        if (input.rmb) {
            rmbTravel += Math.abs(dx) + Math.abs(dy);
            if (rmbTravel > CLICK_SLOP) {
                input.rmbDrag = true;
            }
        }
        if (!input.looking) {
            return;
        }
        input.lookX += dx * LOOK_SCALE;
        input.lookY += dy * LOOK_SCALE;
    };

    window.addEventListener("pointerdown", down, true);
    window.addEventListener("pointerup", up, true);
    window.addEventListener("pointermove", move, true);

    document.addEventListener("pointerlockchange", () => {
        input.pointerLocked = document.pointerLockElement === canvas;
        dropWarpMove = true;
        if (!input.pointerLocked) {
            unlockedAt = performance.now();
            if (!input.lmb && !input.rmb) {
                input.looking = false;
                canvas.style.cursor = "";
            }
        }
    });

    canvas.addEventListener(
        "wheel",
        (event) => {
            event.preventDefault();
            if (inputEnabled) input.zoomDelta += event.deltaY * 0.0016;
        },
        { passive: false },
    );

    window.addEventListener("keydown", (event) => {
        if (!inputEnabled) return;
        if (event.code === "Escape") {
            if (document.pointerLockElement) {
                exitPointerLock();
                return;
            }
            if (performance.now() - unlockedAt < 200) {
                return;
            }
            if (!event.repeat) {
                input.escape = true;
            }
            return;
        }
        if (isFormControl(document.activeElement)) {
            return;
        }
        if (event.code === "Tab") {
            event.preventDefault();
            if (!event.repeat) {
                if (event.shiftKey) {
                    input.tabBack = true;
                } else {
                    input.tabPressed = true;
                }
            }
            return;
        }
        if (event.code === "Space") {
            event.preventDefault();
        }
        if (event.code === "NumLock" || event.code === "Equal") {
            event.preventDefault();
            if (!event.repeat) {
                input.autorun = !input.autorun;
            }
            return;
        }
        if (event.repeat) {
            return;
        }
        keys[event.code] = true;
        if (!event.ctrlKey && !event.metaKey && !event.altKey) {
            if (event.code === "KeyB") {
                input.toggleBag = true;
            }
            if (event.code === "KeyC") {
                input.togglePaper = true;
            }
            if (event.code === "KeyH") {
                input.toggleHint = true;
            }
            if (event.code === "BracketRight") {
                input.heightUp = true;
            }
            if (event.code === "BracketLeft") {
                input.heightDown = true;
            }
            if (event.code === "KeyP") {
                input.cycleSkin = true;
            }
            if (event.code === "KeyN") {
                input.toggleHelm = true;
            }
            if (event.code === "KeyU") {
                input.unequipHelm = true;
            }
        }
        const n = SPELL_KEYS[event.code];
        if (n) {
            input.spellPressed = n;
            if (n === 2) {
                input.spellHeld2 = true;
                input.castHold = true;
            } else {
                input.castInstant = true;
            }
        }
    });

    window.addEventListener("keyup", (event) => {
        keys[event.code] = false;
        if (SPELL_KEYS[event.code] === 2) {
            input.spellHeld2 = false;
            input.castHold = false;
        }
    });

    window.addEventListener("pointercancel", releaseButtons, true);
    window.addEventListener("blur", () => {
        for (const code in keys) {
            keys[code] = false;
        }
        input.jump = false;
        input.spellHeld2 = false;
        input.castHold = false;
        releaseButtons();
        exitPointerLock();
    });
}

export function pollInput() {
    if (!inputEnabled) return;
    let forward = 0;
    let turn = 0;
    let strafe = 0;

    if (keys.KeyW || keys.ArrowUp) {
        forward += 1;
    }
    if (keys.KeyS || keys.ArrowDown) {
        forward -= 1;
        input.autorun = false;
    }
    if (input.lmb && input.rmb) {
        forward += 1;
    }
    if (keys.KeyQ) {
        strafe -= 1;
    }
    if (keys.KeyE) {
        strafe += 1;
    }

    if (input.rmb) {
        if (keys.KeyA || keys.ArrowLeft) {
            strafe -= 1;
        }
        if (keys.KeyD || keys.ArrowRight) {
            strafe += 1;
        }
    } else {
        if (keys.KeyA || keys.ArrowLeft) {
            turn -= 1;
        }
        if (keys.KeyD || keys.ArrowRight) {
            turn += 1;
        }
    }

    if (input.autorun && forward >= 0) {
        forward = Math.max(forward, 1);
    }

    const len = Math.sqrt(forward * forward + strafe * strafe);
    if (len > 1) {
        forward /= len;
        strafe /= len;
    }

    input.forward = forward;
    input.turn = turn;
    input.strafe = strafe;
    input.walk = !!(keys.ShiftLeft || keys.ShiftRight);
    input.jump = !!keys.Space;
    input.castHold = !!(keys.Digit2 || keys.Numpad2 || input.spellHeld2);
}

export function endFrame() {
    input.lookX = 0;
    input.lookY = 0;
    input.zoomDelta = 0;
}
