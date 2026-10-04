/** The authored dye palette: linear-RGB factors multiplied over a piece's base-colour texture.
 *
 * This is the channel the designs already use. The Graveweaver top is the Wayfarer tunic's
 * texture under `0.78, 0.86, 0.83` and the Lector coat the same texture under
 * `0.37, 0.48, 0.64`, so a dye is that authored factor driven from outside rather than fixed
 * at authoring time. See the mechanism note for why nothing here can be applied by mutating a
 * live material: docs/plans/character-mmo/results/m7-dye-mechanism-2026-10-03.md
 *
 * It lives beside equipment-catalog.js rather than under src/character/appearance/ because the
 * default startup graph is gated against reaching that directory, and the loader needs this
 * vocabulary eagerly when it builds a piece's material.
 *
 * Every factor is at most 1 in each channel, because `baseColorFactor` multiplies. A dye can
 * darken and tint; it cannot brighten. A palette entry brighter than the texture it sits on is
 * not expressible, so these are tints of a light base rather than colours in their own right.
 * https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#materials
 */
export const DYE_PALETTE_VERSION = 'ashen-dye-v1';

/** Linear RGB. Names are the player-facing labels. */
const ENTRIES = {
    undyed:  { name: 'Undyed',   factor: [1, 1, 1] },
    bone:    { name: 'Bone',     factor: [0.88, 0.84, 0.74] },
    ash:     { name: 'Ash',      factor: [0.46, 0.47, 0.45] },
    slate:   { name: 'Slate',    factor: [0.30, 0.36, 0.42] },
    indigo:  { name: 'Indigo',   factor: [0.22, 0.28, 0.58] },
    moss:    { name: 'Moss',     factor: [0.26, 0.42, 0.20] },
    oxblood: { name: 'Oxblood',  factor: [0.62, 0.14, 0.12] },
    rust:    { name: 'Rust',     factor: [0.70, 0.34, 0.14] },
    plum:    { name: 'Plum',     factor: [0.38, 0.18, 0.44] },
};

for (const [id, entry] of Object.entries(ENTRIES)) {
    if (entry.factor.length !== 3) throw Error(`Dye ${id} needs three channels`);
    for (const channel of entry.factor) {
        if (!Number.isFinite(channel) || channel < 0 || channel > 1) {
            throw Error(`Dye ${id} has a channel outside 0..1; baseColorFactor cannot brighten`);
        }
    }
    Object.freeze(entry.factor);
    Object.freeze(entry);
}

export const DYE_PALETTE = Object.freeze(ENTRIES);
export const DYE_IDS = Object.freeze(Object.keys(ENTRIES));

/** The multiplied factor for a dye id, or null when the id is not in the palette.
 *  Returns null rather than a neutral factor: a silent fallback to undyed would hide a typo. */
export function dyeFactor(id) {
    if (id === null || id === undefined) return null;
    const entry = Object.hasOwn(ENTRIES, id) ? ENTRIES[id] : null;
    return entry ? [...entry.factor, 1] : null;
}

export function isDyeId(id) {
    return typeof id === 'string' && Object.hasOwn(ENTRIES, id);
}
