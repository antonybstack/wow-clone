/**
 * Runtime playable body definitions (M3).
 * Asset URL, exact clip map, joint aliases, appearance/equipment capabilities.
 * Foundation for Orc/Undead — not a claim that all races fit legacy gear.
 */
import { BODY_PROFILES } from './body-profile.js';
import { HUMAN_V1_IMPORT_MAP } from './retarget-contract.js';

export const LEGACY_BODY_ID = 'legacy';
export const HUMAN_V1_BODY_ID = 'human-v1';
export const ORC_V1_BODY_ID = 'orc-v1';
export const UNDEAD_V1_BODY_ID = 'undead-v1';

export const REQUIRED_PLAYABLE_CLIPS = Object.freeze([
    'idle',
    'walk',
    'run',
    'jumpStart',
    'jumpLoop',
    'jumpLand',
    'cast',
]);

const AUTHORED_CLIPS = Object.freeze({
    idle: 'idle',
    walk: 'walk',
    run: 'run',
    jumpStart: 'jumpStart',
    jumpLoop: 'jumpLoop',
    jumpLand: 'jumpLand',
    cast: 'cast',
});

// Recovery comparison: original library clips on source/candidate visuals.
const SOURCE_CLIPS = Object.freeze({idle:'Idle_Loop',walk:'Walk_Loop',run:'Sprint_Loop',
    jumpStart:'Jump_Start',jumpLoop:'Jump_Loop',jumpLand:'Jump_Land',cast:'Spell_Simple_Shoot',
    spellEnter:'Spell_Simple_Enter',spellLoop:'Spell_Simple_Idle_Loop',spellExit:'Spell_Simple_Exit',
    twoHand:'Walk_Carry_Loop'});

const AUTHORED_PALMS = Object.freeze({
    mainHand: Object.freeze(['finger3-1.R', 'finger2-1.R', 'RightHandMiddle1']),
    offHand: Object.freeze(['finger3-1.L', 'finger2-1.L', 'LeftHandMiddle1']),
});

const CAP_LEGACY = Object.freeze({
    wipeTextures: true,
    mutateHeight: true,
    mutateSkin: true,
    hideBonesOnEquip: true,
    additiveCast: true,
    defaultLoadout: null,
    allowedItems: null,
});

const CAP_AUTHORED = Object.freeze({
    wipeTextures: false,
    mutateHeight: false,
    mutateSkin: false,
    hideBonesOnEquip: false,
    additiveCast: false,
    defaultLoadout: Object.freeze([Object.freeze(['mainHand', 'staff'])]),
    allowedItems: Object.freeze(['staff', 'staffEmber']),
});

function authoredBody(id, assetURL, meta) {
    return Object.freeze({
        id,
        assetURL,
        clipMode: 'exact',
        clips: AUTHORED_CLIPS,
        requiredClips: REQUIRED_PLAYABLE_CLIPS,
        jointAliases: HUMAN_V1_IMPORT_MAP,
        palmBones: AUTHORED_PALMS,
        grip: meta.grip,
        sole: meta.sole,
        capsule: meta.capsule,
        composeStarter: true,
        capabilities: CAP_AUTHORED,
    });
}

export const PLAYABLE_BODIES = Object.freeze({
    [LEGACY_BODY_ID]: Object.freeze({
        id: LEGACY_BODY_ID,
        assetURL: '/characters/base.glb',
        clipMode: 'fuzzy',
        clips: null,
        requiredClips: null,
        jointAliases: null,
        palmBones: Object.freeze({
            mainHand: Object.freeze(['mixamorig:RightHandMiddle1', 'mixamorig:RightHandIndex1', 'RightHandMiddle1']),
            offHand: Object.freeze(['mixamorig:LeftHandMiddle1', 'mixamorig:LeftHandIndex1', 'LeftHandMiddle1']),
        }),
        grip: null,
        composeStarter: false,
        capabilities: CAP_LEGACY,
    }),
    [HUMAN_V1_BODY_ID]: authoredBody(
        HUMAN_V1_BODY_ID,
        '/characters/bodies/human-animated-v1.glb',
        BODY_PROFILES['human-male-v1'],
    ),
    [ORC_V1_BODY_ID]: authoredBody(
        ORC_V1_BODY_ID,
        '/characters/bodies/orc-animated-v1.glb',
        BODY_PROFILES['orc-male-v1'],
    ),
    [UNDEAD_V1_BODY_ID]: authoredBody(
        UNDEAD_V1_BODY_ID,
        '/characters/bodies/undead-animated-v1.glb',
        BODY_PROFILES['undead-male-v1'],
    ),
});

export const AUTHORED_BODY_IDS = Object.freeze([HUMAN_V1_BODY_ID, ORC_V1_BODY_ID, UNDEAD_V1_BODY_ID]);

export function isAuthoredPlayable(definition) {
    return !!definition?.composeStarter;
}

export function resolvePlayableOutfit(search) {
    const raw = search ?? (typeof location !== 'undefined' ? location.search : '');
    const q = new URLSearchParams(raw.startsWith('?') ? raw.slice(1) : raw);
    const outfit = q.get('outfit');
    if (!outfit || outfit === 'starter') return 'starter';
    if (outfit === 'body') return 'body';
    if (outfit === 'mage') return 'mage';
    console.warn(`Unknown outfit '${outfit}', using body`);
    return 'body';
}

function authoredWithOutfit(id, search) {
    const def = PLAYABLE_BODIES[id];
    if (!def) return null;
    const query = new URLSearchParams(search);
    let outfit = resolvePlayableOutfit(search);
    if (!query.has('outfit') && id === HUMAN_V1_BODY_ID) outfit = 'mage';
    if (outfit === 'mage' && id !== HUMAN_V1_BODY_ID) outfit = 'starter';
    return { ...def, outfit };
}

/**
 * @param {string} [search]
 */
export function resolvePlayableBody(search) {
    const raw = search ?? (typeof location !== 'undefined' ? location.search : '');
    const q = new URLSearchParams(raw.startsWith('?') ? raw.slice(1) : raw);
    const id = q.get('character');
    if (id === 'source-reference' || id === 'human-source') {
        return { ...PLAYABLE_BODIES[HUMAN_V1_BODY_ID], id,
            assetURL: id === 'source-reference' ? '/characters/base.glb' : '/characters/candidates/human-source-v1.glb',
            composeStarter: false, outfit: 'body', clips: SOURCE_CLIPS,
            jointAliases: null, palmBones: PLAYABLE_BODIES[LEGACY_BODY_ID].palmBones, grip: null,
        };
    }
    if (!id) {
        return authoredWithOutfit(HUMAN_V1_BODY_ID, raw);
    }
    if (id === LEGACY_BODY_ID) {
        return PLAYABLE_BODIES[LEGACY_BODY_ID];
    }
    if (Object.hasOwn(PLAYABLE_BODIES, id) && PLAYABLE_BODIES[id].composeStarter) {
        return authoredWithOutfit(id, raw);
    }
    console.warn(`Unknown character '${id}', using legacy Mixamo`);
    return PLAYABLE_BODIES[LEGACY_BODY_ID];
}

/**
 * Exact semantic → clip name. Throws if a required clip is missing.
 * Does not substitute idle for run/cast.
 * @param {string[]} groupNames
 * @param {{ id?: string, clipMode?: string, clips?: Record<string, string>, requiredClips?: readonly string[] }} definition
 */
export function resolvePlayableClips(groupNames, definition) {
    if (!definition || definition.clipMode !== 'exact') {
        return { mode: 'fuzzy', clips: null, missing: [] };
    }
    const have = new Set(groupNames.filter(Boolean));
    const clips = {};
    const missing = [];
    for (const semantic of definition.requiredClips || REQUIRED_PLAYABLE_CLIPS) {
        const want = definition.clips?.[semantic];
        if (!want || !have.has(want)) {
            missing.push(want || semantic);
            continue;
        }
        clips[semantic] = want;
    }
    if (missing.length) {
        throw new Error(
            `playable body ${definition.id || '?'} missing required clips: ${missing.join(', ')}. Have: ${groupNames.join(', ')}`,
        );
    }
    // Additional declared capabilities are optional. Never infer them from a
    // fuzzy name match, or make the seven-clip authored bodies require them.
    for (const [semantic, name] of Object.entries(definition.clips || {})) {
        if (have.has(name)) clips[semantic] = name;
    }
    if (clips.run && clips.idle && clips.run === clips.idle) {
        throw new Error(`playable body ${definition.id || '?'} run must not resolve to idle`);
    }
    if (clips.cast && clips.idle && clips.cast === clips.idle) {
        throw new Error(`playable body ${definition.id || '?'} cast must not resolve to idle`);
    }
    return { mode: 'exact', clips, missing: [] };
}

/**
 * Leg/hip joint names from the loaded rig so a cast overlay can leave locomotion on the legs.
 * @param {string[]} boneNames
 * @param {{ jointAliases?: Record<string, string[]> }} [definition]
 */
export function deriveLegBoneNames(boneNames, definition) {
    const names = (boneNames || []).filter(Boolean);
    const aliases = definition?.jointAliases;
    const extra = [];
    if (aliases) {
        for (const key of ['pelvis', 'upperLegL', 'lowerLegL', 'footL', 'toeL', 'upperLegR', 'lowerLegR', 'footR', 'toeR']) {
            for (const alias of aliases[key] || []) {
                extra.push(alias);
            }
        }
    }
    const extraSet = new Set(extra);
    const out = [];
    for (const name of names) {
        if (extraSet.has(name)) {
            out.push(name);
            continue;
        }
        const lower = name.toLowerCase().replace(/^mixamorig:/, '');
        if (lower === 'hips' || lower.startsWith('pelvis')) {
            out.push(name);
            continue;
        }
        if (/^(left|right)(upleg|leg|foot|toebase)/.test(lower)) {
            out.push(name);
            continue;
        }
        if (lower.startsWith('upperleg') || lower.startsWith('lowerleg') || lower.startsWith('toe')) {
            out.push(name);
        }
    }
    return out;
}

export function appearancePolicy(definition) {
    const cap = definition?.capabilities;
    return {
        wipeTextures: cap?.wipeTextures !== false,
        mutateHeight: cap?.mutateHeight !== false,
        mutateSkin: cap?.mutateSkin !== false,
    };
}

export function itemAllowedOnBody(itemId, definition) {
    const allowed = definition?.capabilities?.allowedItems;
    if (!allowed) {
        return true;
    }
    return allowed.includes(itemId);
}

export function defaultLoadoutFor(definition) {
    return definition?.capabilities?.defaultLoadout ?? null;
}

export function canHideBonesOnEquip(definition) {
    return definition?.capabilities?.hideBonesOnEquip !== false;
}

export function usesAdditiveCast(definition) {
    return definition?.capabilities?.additiveCast !== false;
}

/**
 * Authored palm-space grip translation, or null to keep the Mixamo local push.
 * @param {object} [definition]
 * @param {string} slot
 */
export function gripOffsetForSlot(definition, slot) {
    const grip = definition?.grip;
    if (!grip) {
        return null;
    }
    const hand = slot === 'mainHand' ? grip.rightHand : slot === 'offHand' ? grip.leftHand : null;
    const t = hand?.translation;
    if (!t || t.length < 3) {
        return null;
    }
    return { x: t[0], y: t[1], z: t[2] };
}

export function palmBoneNames(definition, slot, fallback) {
    return definition?.palmBones?.[slot] ?? fallback;
}
