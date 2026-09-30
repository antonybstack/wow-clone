/**
 * M006 character creator, as a section of the Armory.
 *
 * It used to be a second panel that swapped the Armory's own out of the way and opened on
 * its own. There is one inspection surface, reached with **C**, and body adjustment belongs
 * in it next to equipment — the panel is already titled "Character & equipment".
 *
 * Lazily imported: `main.js` pulls this in when it builds the Armory, which happens in the
 * background pass after the game is playable, so nothing here is in the startup critical
 * path and `creator.js` stays its own chunk.
 *
 * The control list is not written here. It comes from `creatorControlsForRace`, which gates
 * every control on a verified capability, so this file cannot offer something the art has
 * not earned: unavailable controls are rendered disabled with the reason the contract gives.
 * See `src/character/creator/contract.js`.
 *
 * Driving the sliders needs a body that actually carries the M004 morph targets, which only
 * the `?creator=1` route loads — the shipped body has none. Without it the section still
 * appears, disabled, saying so, rather than vanishing and leaving no trace of why.
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
 * @param {string} options.race       race whose capabilities gate the controls
 * @param {object} options.armory     the live armory; opening and closing belong to it
 * @param {boolean} options.drivable  whether the loaded body carries the shape targets
 * @param {(state: object) => Promise<void>|void} options.applyShape  drives the live body
 */
export function createCreator({race, armory, applyShape, drivable = true, storage}) {
    const session = createCreatorSession(race, storage ? {storage} : {});
    const {available, unavailable} = creatorControlsForRace(race);
    const panel = document.querySelector('#armory .armory-panel');
    if (!panel) throw new Error('The creator section needs the armory panel to be mounted');

    const section = text('section', 'creator-section');
    section.append(text('h2', null, 'Body'));
    const status = text('p', 'armory-note', '');
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    section.append(status);

    const fields = text('div', 'creator-fields');
    section.append(fields);
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
        input.disabled = !drivable;
        input.setAttribute('aria-label', label);
        // `input` fires continuously for mouse, touch and keyboard alike, so a phone drag and
        // an arrow key both drive the body live. `change` fires once at the end of a drag,
        // which is where the save goes: persisting every intermediate value would write to
        // storage dozens of times per drag for no benefit.
        input.addEventListener('input', () => {
            session.set(id, axis ? {[axis]: Number(input.value)} : Number(input.value));
            refresh({fromInput: true});
        });
        input.addEventListener('change', () => persist());
        field.append(name, input);
        fields.append(field);
        inputs.set(axis ? `${id}.${axis}` : id, {input, output, read});
    };

    for (const control of available) {
        if (control.kind === 'range') {
            slider(control.id, null, control.label, control, s => s.controls[control.id]);
        } else if (control.kind === 'blend') {
            for (const axis of control.axes) {
                slider(control.id, axis, `${control.label}: ${axis}`, control, s => s.controls[control.id][axis]);
            }
        } else {
            const field = text('label', 'creator-field');
            field.append(text('span', null, control.label));
            const select = document.createElement('select');
            select.disabled = !drivable;
            for (const option of control.options) {
                const node = document.createElement('option');
                node.value = option;
                node.textContent = option;
                select.append(node);
            }
            select.addEventListener('change', () => { session.set(control.id, select.value); refresh({fromInput: true}); persist(); });
            field.append(select);
            fields.append(field);
            inputs.set(control.id, {input: select, output: null, read: s => s.controls[control.id]});
        }
    }

    if (!available.length) {
        fields.append(text('p', 'armory-note', `The ${race} has no verified body family, so there is nothing to adjust yet.`));
    }

    // Everything the creator is meant to offer but cannot yet, with the reason. Showing these
    // disabled is deliberate: it is the difference between "not built" and "not accepted",
    // and it stops the same control being proposed again next milestone. Collapsed, because
    // this now shares a panel with the equipment list.
    if (unavailable.length) {
        const pending = document.createElement('details');
        pending.className = 'creator-pending';
        pending.append(text('summary', null, `Not available yet (${unavailable.length})`));
        for (const entry of unavailable) {
            const row = text('div', 'creator-pending-row');
            const label = text('span', null, entry.label);
            label.setAttribute('aria-disabled', 'true');
            row.append(label, text('small', null, entry.reason));
            pending.append(row);
        }
        section.append(pending);
    }

    const actions = text('div', 'creator-actions');
    const undoButton = text('button', null, 'Undo');
    const resetButton = text('button', null, 'Reset');
    undoButton.disabled = !drivable;
    resetButton.disabled = !drivable;
    actions.append(undoButton, resetButton);
    section.append(actions);

    // Before the equipment heading, so the panel reads body then clothes.
    const equipmentHeading = panel.querySelector('h2');
    if (equipmentHeading) panel.insertBefore(section, equipmentHeading);
    else panel.append(section);

    let applying = null;
    /** Only say something when there is something to say: this section shares a panel with
     *  the equipment list, and a permanent status line costs a row to say nothing. */
    const setStatus = message => { status.textContent = message ?? ''; status.hidden = !message; };

    const persist = () => {
        if (!drivable) return false;
        const saved = session.save();
        if (!saved) setStatus('Could not save; this character lasts for this session only.');
        return saved;
    };

    /** Push the session state at the live body, serialising so a drag cannot interleave. */
    const drive = () => {
        if (!drivable) return Promise.resolve();
        const state = session.state;
        applying = Promise.resolve(applying)
            .then(() => applyShape(state))
            .catch(error => { setStatus(`Could not apply that: ${error.message}`); });
        return applying;
    };

    function refresh({fromInput = false} = {}) {
        const state = session.state;
        for (const [, {input, output, read}] of inputs) {
            const value = read(state);
            if (input.type === 'range') {
                if (!fromInput || document.activeElement !== input) input.value = String(value);
                if (output) output.textContent = ` ${Number(value).toFixed(2)}`;
            } else if (input.value !== value) {
                input.value = value;
            }
        }
        undoButton.disabled = !drivable || !session.canUndo;
        if (fromInput) drive();
    }

    /**
     * Session op, then redraw, then drive the body, then save. Exposed as well as bound to
     * the buttons: calling `session.reset()` from outside changes the state and leaves the
     * sliders and the character showing the old one, which is a silent disagreement between
     * what is stored, what is drawn and what is on screen. Capture scripts and probes go
     * through these so they exercise the same path a person does.
     */
    const apply = op => { op(); refresh(); drive(); persist(); return session.state; };
    const undoAction = () => apply(() => session.undo());
    // No status on reset: the sliders visibly jump to the default, and a line that says so
    // would then sit there for the rest of the session saying nothing.
    const resetAction = () => apply(() => session.reset());
    undoButton.onclick = undoAction;
    resetButton.onclick = resetAction;

    setStatus(!drivable
        ? 'Add ?creator=1 to the URL to adjust the body; the shipped body carries no shape targets.'
        : session.restored
            ? 'Restored your saved character.'
            : session.discarded
                ? `Started fresh; the saved character could not be read (${session.discarded}).`
                : null);
    refresh();
    drive();

    return {
        /** Opening and closing is the Armory's job now; these delegate so probes still work. */
        open: () => armory.open(),
        close: () => { persist(); armory.close?.(); },
        get isOpen() { return armory.isOpen; },
        get state() { return session.state; },
        get drivable() { return drivable; },
        undo: undoAction,
        reset: resetAction,
        /** Forget the saved character and return to the default, in storage and on screen. */
        clear: () => { session.clear(); return resetAction(); },
        set: (id, value) => apply(() => session.set(id, value)),
        refresh: () => { refresh(); drive(); },
        save: persist,
        session,
        element: section,
        /** Awaits any in-flight body update; capture scripts need a settled character. */
        settled: () => Promise.resolve(applying),
    };
}
