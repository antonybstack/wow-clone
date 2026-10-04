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
 *
 * v2 respends the palette on separation. v1's measured conclusion -- "spend entries on
 * saturation, not lightness" -- came from each entry's distance from *undyed*, on a crop where
 * the dye drives only 26% of the signal. In pairwise terms the diagnosis was wrong: v1 was
 * already saturated (oxblood and rust sat at chroma 0.40), and its real fault was that all
 * eight dyes sat at nearly the same lightness, so they were 8-11 units from undyed but only
 * 1.7-3.6 units from each other. The palette read as "undyed, or one of eight darker things".
 *
 * Because the rendered mean is linear in the factor (max residual 0.19 of 255 across nine
 * entries), pairwise separation is proportional to the distance between factor vectors, and
 * the design is a packing problem rather than a matter of taste: maximise the minimum pairwise
 * distance. v2 does that under three stated constraints -- no entry more chromatic than the
 * most chromatic dye v1 already shipped (rust, 0.401 from the neutral axis), one entry per hue
 * family so the set stays legible, and the two neutrals pinned at the ends of the lightness
 * range where a player expects a black and a grey dye. Min pairwise distance goes from 0.196
 * to 0.429, a 2.19x improvement, while carrying one more entry than v1.
 * docs/plans/character-mmo/results/m7-dye-palette-2026-10-04.md
 */
export const DYE_PALETTE_VERSION = 'ashen-dye-v2';

/** Linear RGB. Names are the player-facing labels, and they follow the numbers: an earlier
 *  draft optimised the values first and left a light grey called "pitch". */
const ENTRIES = {
    undyed:    { name: 'Undyed',    factor: [1, 1, 1] },
    sage:      { name: 'Sage',      factor: [0.786, 0.906, 0.624] },
    heather:   { name: 'Heather',   factor: [0.852, 0.319, 0.753] },
    verdigris: { name: 'Verdigris', factor: [0.331, 0.753, 0.849] },
    ash:       { name: 'Ash',       factor: [0.550, 0.550, 0.540] },
    amber:     { name: 'Amber',     factor: [0.691, 0.516, 0.136] },
    indigo:    { name: 'Indigo',    factor: [0.288, 0.141, 0.689] },
    moss:      { name: 'Moss',      factor: [0.131, 0.564, 0.226] },
    oxblood:   { name: 'Oxblood',   factor: [0.591, 0.100, 0.100] },
    pitch:     { name: 'Pitch',     factor: [0.120, 0.120, 0.130] },
};

/** The separation the palette was designed for, asserted below so a later edit that reverts it
 *  fails loudly instead of quietly shipping a palette whose entries cannot be told apart. */
export const MIN_PAIRWISE_FACTOR_DISTANCE = 0.429;

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

// Two entries a player cannot tell apart are one entry and a wasted slot, which is the fault
// v2 exists to fix. Checked at module load, in the same place as the channel bound, because
// the palette is edited by hand and the clustering is not visible by reading the numbers.
{
    const ids = Object.keys(ENTRIES);
    for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
            const a = ENTRIES[ids[i]].factor, b = ENTRIES[ids[j]].factor;
            const gap = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
            if (gap < MIN_PAIRWISE_FACTOR_DISTANCE - 1e-6) {
                throw Error(`Dyes ${ids[i]} and ${ids[j]} are ${gap.toFixed(3)} apart, `
                    + `under the designed ${MIN_PAIRWISE_FACTOR_DISTANCE}`);
            }
        }
    }
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
