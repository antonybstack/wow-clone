/**
 * M006 character creator surface.
 *
 * Lazily imported: nothing here is in the startup graph, and `main.js` only imports it when
 * `?creator=1` asks for it, so the one-second playable startup gate is untouched.
 *
 * It reuses the Armory rather than building a second inspection view — same arc-rotate
 * camera, same two-point key/rim rig, same stage drag and zoom, same animation scrubber. The
 * creator swaps its own panel in for the equipment panel and hands the armory back unchanged
 * on close.
 *
 * The control list is not written here. It comes from `creatorControlsForRace`, which gates
 * every control on a verified capability, so this file cannot offer something the art has
 * not earned: unavailable controls are rendered disabled with the reason the contract gives.
 * See `src/character/creator/contract.js`.
 */
import {creatorControlsForRace} from '../character/creator/contract.js';
import {createCreatorSession} from '../character/creator/store.js';
import './creator.css';

const text = (tag, className, content) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (content != null) node.textContent = content;
    return node;
};

/**
 * @param {object} options
 * @param {string} options.race            race whose capabilities gate the controls
 * @param {object} options.armory          the live armory; its camera and stage are reused
 * @param {(state: object) => Promise<void>|void} options.applyShape  drives the live body
 */
export function createCreator({race, armory, applyShape, storage}) {
    const session = createCreatorSession(race, storage ? {storage} : {});
    const {available, unavailable} = creatorControlsForRace(race);
    const armoryElement = document.getElementById('armory');
    if (!armoryElement) throw new Error('The creator needs the armory to be mounted');
    const equipmentPanel = armoryElement.querySelector('.armory-panel');

    const panel = document.createElement('aside');
    panel.className = 'armory-panel creator-panel';
    panel.hidden = true;
    const head = text('div', 'armory-panel-title');
    head.append(text('span', null, 'Create your character'));
    const closeButton = text('button', null, '×');
    closeButton.setAttribute('aria-label', 'Close the creator');
    closeButton.dataset.creatorClose = '';
    head.append(closeButton);
    panel.append(head);

    const status = text('p', 'armory-note', '');
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    panel.append(status);

    const fields = text('div', 'creator-fields');
    panel.append(fields);
    const inputs = new Map();

    /** One labelled slider. Blend axes reuse this, one row per axis. */
    const slider = (id, axis, label, control, read) => {
        const field = text('label', 'creator-field');
        const name = text('span', null, label);
        const output = text('output', null, '');
        name.append(output);
        const input = document.createElement('input');
        input.type = 'range';
        input.min = String(control.min);
        input.max = String(control.max);
        input.step = String(control.step);
        input.setAttribute('aria-label', label);
        // `input` fires continuously for mouse, touch and keyboard alike, so a phone drag
        // and an arrow key both drive the body live without a separate touch path.
        input.addEventListener('input', () => {
            session.set(id, axis ? {[axis]: Number(input.value)} : Number(input.value));
            refresh({fromInput: true});
        });
        field.append(name, input);
        fields.append(field);
        inputs.set(axis ? `${id}.${axis}` : id, {input, output, read});
    };

    for (const control of available) {
        if (control.kind === 'range') {
            slider(control.id, null, control.label, control, s => s.controls[control.id]);
        } else if (control.kind === 'blend') {
            for (const axis of control.axes) {
                const label = `${control.label}: ${axis}`;
                slider(control.id, axis, label, control, s => s.controls[control.id][axis]);
            }
        } else {
            const field = text('label', 'creator-field');
            field.append(text('span', null, control.label));
            const select = document.createElement('select');
            for (const option of control.options) {
                const node = document.createElement('option');
                node.value = option;
                node.textContent = option;
                select.append(node);
            }
            select.addEventListener('change', () => { session.set(control.id, select.value); refresh({fromInput: true}); });
            field.append(select);
            fields.append(field);
            inputs.set(control.id, {input: select, output: null, read: s => s.controls[control.id]});
        }
    }

    if (!available.length) {
        fields.append(text('p', 'armory-note', `The ${race} has no verified body family, so there is nothing to adjust yet.`));
    }

    // Everything the creator is meant to offer but cannot yet, with the reason. Showing
    // these disabled is deliberate: it is the difference between "not built" and "not
    // accepted", and it stops the same control being proposed again next milestone.
    if (unavailable.length) {
        const pending = text('div', 'creator-pending');
        pending.append(text('h2', null, 'Not available yet'));
        for (const entry of unavailable) {
            const row = text('div', 'creator-pending-row');
            const label = text('span', null, entry.label);
            label.setAttribute('aria-disabled', 'true');
            row.append(label, text('small', null, entry.reason));
            pending.append(row);
        }
        panel.append(pending);
    }

    const actions = text('div', 'creator-actions');
    const undoButton = text('button', null, 'Undo');
    const resetButton = text('button', null, 'Reset');
    const playButton = text('button', 'creator-play', 'Save and play');
    actions.append(undoButton, resetButton, playButton);
    panel.append(actions);
    armoryElement.append(panel);

    let open = false, applying = null;

    /** Push the session state at the live body, serialising so a drag cannot interleave. */
    const drive = () => {
        const state = session.state;
        applying = Promise.resolve(applying)
            .then(() => applyShape(state))
            .catch(error => { status.textContent = `Could not apply that: ${error.message}`; });
        return applying;
    };

    function refresh({fromInput = false} = {}) {
        const state = session.state;
        for (const [key, {input, output, read}] of inputs) {
            const value = read(state);
            if (input.type === 'range') {
                if (!fromInput || document.activeElement !== input) input.value = String(value);
                if (output) output.textContent = ` ${Number(value).toFixed(2)}`;
            } else if (input.value !== value) {
                input.value = value;
            }
            void key;
        }
        undoButton.disabled = !session.canUndo;
        if (fromInput) drive();
    }

    /**
     * Session op, then redraw, then drive the body. Exposed as well as bound to the buttons:
     * calling `session.reset()` from outside changes the state and leaves the sliders and
     * the character showing the old one, which is a silent disagreement between what is
     * stored, what is drawn and what is on screen. Capture scripts and probes go through
     * these so they exercise the same path a person does.
     */
    const apply = op => { op(); refresh(); drive(); return session.state; };
    const undoAction = () => apply(() => session.undo());
    const resetAction = () => apply(() => {
        session.reset();
        status.textContent = 'Reset to the default character.';
    });
    undoButton.onclick = undoAction;
    resetButton.onclick = resetAction;
    playButton.onclick = () => { close(); };
    closeButton.onclick = () => { close(); };

    function show() {
        if (open) return;
        open = true;
        armory.open();
        if (equipmentPanel) equipmentPanel.hidden = true;
        panel.hidden = false;
        status.textContent = session.restored
            ? 'Restored your saved character.'
            : session.discarded
                ? `Started fresh; the saved character could not be read (${session.discarded}).`
                : 'Starting from the default character.';
        refresh();
        drive();
    }

    function close() {
        if (!open) return;
        open = false;
        const saved = session.save();
        status.textContent = saved ? 'Saved.' : 'Could not save; this character lasts for this session only.';
        panel.hidden = true;
        if (equipmentPanel) equipmentPanel.hidden = false;
        armory.close?.();
    }

    return {
        open: show,
        close,
        get isOpen() { return open; },
        get state() { return session.state; },
        undo: undoAction,
        reset: resetAction,
        /** Forget the saved character and return to the default, in storage and on screen. */
        clear: () => { session.clear(); return resetAction(); },
        set: (id, value) => apply(() => session.set(id, value)),
        refresh: () => { refresh(); drive(); },
        session,
        element: panel,
        /** Awaits any in-flight body update; capture scripts need a settled character. */
        settled: () => Promise.resolve(applying),
    };
}
