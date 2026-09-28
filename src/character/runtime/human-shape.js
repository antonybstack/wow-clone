/**
 * M004 Human shape family: the declared capability surface for the canonical Human template.
 *
 * Pure data and pure functions. Nothing here imports the engine, fetches an
 * asset or touches the default play route; `resolveHumanShape` answers `null`
 * unless a query explicitly asks for a non-default body, so the shipped
 * character and its startup path are unchanged.
 *
 * The family is two glTF morph targets over the *current* body — same 3,274
 * vertices in the same order, same 65-joint bind, same inverse binds, same 57
 * clips — plus a uniform height scale. Weight 0 on both targets is the shipped
 * character exactly; `build-human-shape-family.mjs` proves that by hashing the
 * base attributes and the bind rather than the file.
 *
 * What this does *not* declare: per-instance arbitrary sliders, garment
 * refitting, face or age variation, and any crowd/VAT compatibility. Morph
 * weights are per mesh, and Lite's baked-animation path drops the live skeleton
 * when it attaches, so a shape family and a VAT crowd tier are separate
 * questions that M009 owns. Garments do not follow these targets yet; M005 owns
 * that. The M002 appearance recipe still advertises an empty `shape` object on
 * purpose — extending schema 1 needs the migration fixtures M006 requires, not
 * a silent field.
 *
 * Height authority: the gameplay capsule stays the collision truth. `player.setHeightScale`
 * already clamps to [0.9, 1.15] of the 1.748 m profile capsule and reshapes the Havok
 * controller through `setShapeOptions`; this module reuses that range rather than
 * introducing a second one, so a visual height can never outrun what physics accepts.
 */

/** Fit-profile version for the shape family. Bump when the targets or the base body change. */
export const HUMAN_SHAPE_FIT = 'ashen-human-shape-v1';

/** Morph target order in the candidate GLB. Index is the weight slot. */
export const HUMAN_SHAPE_TARGETS = Object.freeze(['slender', 'stout']);

/** The three named bodies M004 delivers. */
export const HUMAN_SHAPE_NAMES = Object.freeze(['neutral', 'slender', 'stout']);

/**
 * Developer candidate only. Served from `.cache/character-mmo/m004/` by a Vite
 * middleware, absent from `public/` and from the Pages bundle.
 */
export const HUMAN_SHAPE_ASSET = '/__human_shape__/human-shape-family-v1.glb';

/**
 * M005 refitted garment pack. Same eight catalogue items, same fit identity, same meshes;
 * each carries the shape targets that let it follow the body. Developer candidate, served
 * from `.cache/character-mmo/m005/`, absent from `public/` and from the Pages bundle.
 */
export const HUMAN_GARMENT_FIT_MANIFEST = '/__garment_fit__/manifest.json';

/**
 * Uniform height. `scale` multiplies both the gameplay capsule and the visual root;
 * `capsuleM`/`visualM` are the measured metre values of the unscaled Human.
 */
export const HUMAN_HEIGHT = Object.freeze({
    min: 0.9,
    max: 1.15,
    default: 1,
    capsuleM: 1.748,
    visualM: 1.76,
});

export const HUMAN_SHAPE_CAPABILITIES = Object.freeze({
    fit: HUMAN_SHAPE_FIT,
    bodyShapes: HUMAN_SHAPE_NAMES,
    blendable: true,
    uniformHeight: {min: HUMAN_HEIGHT.min, max: HUMAN_HEIGHT.max},
    garmentsFollowShape: 'candidate',
    faceOrAge: false,
    hair: false,
    dyes: false,
    crowdTiers: false,
    appearanceRecipeField: null,
});

export function clampHeightScale(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return HUMAN_HEIGHT.default;
    return Math.min(HUMAN_HEIGHT.max, Math.max(HUMAN_HEIGHT.min, n));
}

/** Metres of visual stature for a height scale. */
export function humanVisualHeightM(scale) {
    return HUMAN_HEIGHT.visualM * clampHeightScale(scale);
}

/** Metres of gameplay capsule for a height scale. Mirrors `player.setHeightScale`. */
export function humanCapsuleHeightM(scale) {
    return HUMAN_HEIGHT.capsuleM * clampHeightScale(scale);
}

/**
 * Weight vector for the GLB's target order.
 * Accepts a preset name or an explicit `{slender, stout}` blend.
 * @returns {number[]} one weight per entry of HUMAN_SHAPE_TARGETS
 */
export function humanShapeWeights(shape) {
    if (shape == null || shape === 'neutral') return HUMAN_SHAPE_TARGETS.map(() => 0);
    if (typeof shape === 'string') {
        const index = HUMAN_SHAPE_TARGETS.indexOf(shape);
        if (index < 0) throw new Error(`Unknown Human shape '${shape}'; have ${['neutral', ...HUMAN_SHAPE_TARGETS].join(', ')}`);
        return HUMAN_SHAPE_TARGETS.map((_, i) => (i === index ? 1 : 0));
    }
    if (typeof shape !== 'object') throw new Error('Human shape must be a name or a blend object');
    for (const key of Object.keys(shape)) {
        if (!HUMAN_SHAPE_TARGETS.includes(key)) throw new Error(`Unknown Human shape control '${key}'`);
    }
    return HUMAN_SHAPE_TARGETS.map((name) => {
        const value = Number(shape[name] ?? 0);
        if (!Number.isFinite(value) || value < 0 || value > 1) {
            throw new Error(`Human shape control '${name}' must be within 0..1`);
        }
        return value;
    });
}

/**
 * Read a shape request from a query string.
 * Answers `null` when no shape control is present, which is the default play route.
 * `?humanShape=slender|stout|neutral` or `?humanShape=slender:0.6,stout:0.2`,
 * and `?humanHeight=<scale>`.
 * @param {string|URLSearchParams} search
 */
export function resolveHumanShape(search) {
    const q = search instanceof URLSearchParams
        ? search
        : new URLSearchParams(String(search ?? '').replace(/^\?/, ''));
    const rawShape = q.get('humanShape');
    const rawHeight = q.get('humanHeight');
    const rawGarments = q.get('garmentFit');
    if (rawShape == null && rawHeight == null && rawGarments == null) return null;
    if (rawGarments != null && rawGarments !== 'refit' && rawGarments !== 'shipped') {
        throw new Error(`Unknown garmentFit '${rawGarments}'; expected 'refit' or 'shipped'`);
    }

    let shape = 'neutral';
    if (rawShape) {
        shape = rawShape.includes(':')
            ? Object.fromEntries(rawShape.split(',').map((part) => {
                const [name, value] = part.split(':');
                return [name.trim(), Number(value)];
            }))
            : rawShape.trim();
    }
    const weights = humanShapeWeights(shape);
    const requested = rawHeight == null ? HUMAN_HEIGHT.default : Number(rawHeight);
    const heightScale = clampHeightScale(requested);
    return {
        fit: HUMAN_SHAPE_FIT,
        shape,
        weights,
        heightScale,
        heightClamped: Number.isFinite(requested) && Math.abs(requested - heightScale) > 1e-6,
        // Weight 0 on every target is the shipped body, so the candidate GLB is only
        // needed when a target is actually driven.
        assetURL: weights.some((w) => w > 0) ? HUMAN_SHAPE_ASSET : null,
        // Refitted garments only matter when a target is actually driven; at weight 0 they
        // are the shipped garments in every semantic accessor anyway.
        garmentFit: rawGarments === 'refit' ? 'refit' : 'shipped',
        garmentManifestURL: rawGarments === 'refit' && weights.some((w) => w > 0)
            ? HUMAN_GARMENT_FIT_MANIFEST
            : null,
        visualHeightM: humanVisualHeightM(heightScale),
        capsuleHeightM: humanCapsuleHeightM(heightScale),
    };
}
