/** Mint the PROVISIONAL Undead equipment pack.
 *
 * The real Undead body is being authored in a separate milestone and
 * `public/ashen-reach/equipment-undead/` is owned by that work. This script produces a
 * stand-in under `public/ashen-reach/equipment-undead-provisional/` so the race plumbing
 * -- pack table, fit contract, streaming, armory, race switching -- can be built and
 * tested against a pack that really exists.
 *
 * What it is: the Human pack's geometry and 65-joint bind, with the hair geoset removed
 * (the approved Undead is a skull face), every texture stripped, and every material
 * retinted to a flat corpse palette. Flat colour is deliberate. The result is obviously
 * not finished art, so nobody can mistake it for the real body, and dropping the Human
 * skin/cloth textures takes the pack from ~34 MB to a couple of MB.
 *
 * What it is NOT: a Human fit wearing an Undead label. The manifest declares
 * `fitId: 'ashen-undead'` and every garment entry declares the real UNDEAD_EQUIPMENT_FIT.
 * That is the whole point -- if this pack declared a Human fit "just to make it load",
 * the no-silent-fallback test would pass vacuously. The geometry underneath is Human
 * shaped, and it is labelled as what it is: provisional.
 *
 * Replace this pack, do not extend it. When the real body lands, flip UNDEAD_PACK_DIR in
 * src/ashen-reach/main.js to 'equipment-undead' and delete this directory and script.
 *
 * Usage: node scripts/ashen-reach/prepare-undead-provisional.mjs
 */
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {prune, unpartition} from '@gltf-transform/functions';
import {BODY_REGIONS, EQUIPMENT_ITEMS, UNDEAD_BASE_VISIBLE_MESHES} from '../../src/ashen-reach/equipment-catalog.js';
import {UNDEAD_EQUIPMENT_FIT} from '../../src/ashen-reach/equipment-contract.js';

const SRC = 'public/ashen-reach/equipment';
const DIR = 'public/ashen-reach/equipment-undead-provisional';
const URL_BASE = '/ashen-reach/equipment-undead-provisional';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');

/** Flat stand-in palette, keyed by the Human material it replaces. */
const PALETTE = {
    HumanSkin: {name: 'UndeadProvisionalSkin', color: [.541, .565, .498], rough: .88, metal: 0},
    'Charcoal trousers': {color: [.196, .212, .200], rough: .92, metal: 0},
    'Worn dark leather': {color: [.106, .090, .071], rough: .80, metal: 0},
    WayfarerTunic: {color: [.318, .329, .290], rough: .90, metal: 0},
    PilgrimTunic: {color: [.376, .357, .310], rough: .94, metal: 0},
    WayfarerTrousers: {color: [.235, .243, .220], rough: .92, metal: 0},
    WayfarerBoots: {color: [.141, .118, .094], rough: .78, metal: 0},
    GraveweaverTop: {color: [.400, .435, .420], rough: .62, metal: .35},
    GraveweaverHood: {color: [.267, .282, .275], rough: .90, metal: 0},
    GraveweaverSkirt: {color: [.298, .310, .298], rough: .90, metal: 0},
    GraveweaverGloves: {color: [.169, .149, .125], rough: .82, metal: 0},
    'Aged bronze': {color: [.353, .275, .125], rough: .55, metal: .70},
    Amethyst: {color: [.278, .137, .388], rough: .30, metal: 0},
};
/** Anything the palette does not name: desaturate and darken toward the same corpse tone. */
function fallbackTint(factor) {
    const luma = .2126 * factor[0] + .7152 * factor[1] + .0722 * factor[2];
    const grey = Math.min(.55, luma * .55);
    return [grey * 1.02, grey * 1.06, grey * .95, factor[3] ?? 1];
}

const unknown = new Set();
/** Strip every texture and flatten the material to a single provisional colour. */
function retint(doc) {
    for (const material of doc.getRoot().listMaterials()) {
        const entry = PALETTE[material.getName()];
        if (!entry) unknown.add(material.getName());
        const [r, g, b, a = 1] = entry ? [...entry.color, 1] : fallbackTint(material.getBaseColorFactor());
        material.setBaseColorTexture(null);
        material.setMetallicRoughnessTexture(null);
        material.setNormalTexture(null);
        material.setOcclusionTexture(null);
        material.setEmissiveTexture(null);
        material.setEmissiveFactor([0, 0, 0]);
        material.setBaseColorFactor([r, g, b, a]);
        material.setRoughnessFactor(entry?.rough ?? .9);
        material.setMetallicFactor(entry?.metal ?? 0);
        if (entry?.name) material.setName(entry.name);
    }
    for (const texture of doc.getRoot().listTextures()) texture.dispose();
}

const rigOf = doc => {
    const skin = doc.getRoot().listSkins()[0];
    return {
        joints: skin.listJoints().map(n => [n.getName(), n.getWorldMatrix()]),
        inverseBind: Array.from(skin.getInverseBindMatrices().getArray()),
    };
};
const meshNodeNames = doc => doc.getRoot().listNodes().filter(n => n.getMesh()).map(n => n.getName());

await fs.mkdir(DIR, {recursive: true});

// --- body ------------------------------------------------------------------------------
const bodyDoc = await io.read(`${SRC}/body.glb`);
const clips = bodyDoc.getRoot().listAnimations().length;
// The approved Undead has a skull face and no hair, so the Human hair geoset is dropped
// rather than retinted. UNDEAD_BASE_VISIBLE_MESHES omits it to match.
for (const node of bodyDoc.getRoot().listNodes()) {
    if (node.getName() === 'HumanHair') {
        node.setMesh(null);
        node.dispose();
    }
}
for (const mesh of bodyDoc.getRoot().listMeshes()) {
    if (mesh.getName() === 'HumanHair') mesh.dispose();
}
retint(bodyDoc);
await bodyDoc.transform(unpartition(), prune({keepLeaves: true}));

const bodyMeshes = meshNodeNames(bodyDoc);
for (const name of UNDEAD_BASE_VISIBLE_MESHES) {
    if (!bodyMeshes.includes(name)) throw Error(`Provisional Undead body missing ${name}`);
}
if (bodyMeshes.includes('HumanHair')) throw Error('HumanHair survived into the Undead body');
if (bodyDoc.getRoot().listAnimations().length !== clips) throw Error('Animation clips lost');
if (bodyDoc.getRoot().listSkins()[0].listJoints().length !== 65) throw Error('Not the 65-joint source bind');

await io.write(`${DIR}/body.glb`, bodyDoc);
const bodyBytes = await fs.readFile(`${DIR}/body.glb`);
const bodyHash = sha(bodyBytes);
const bodyRig = rigOf(bodyDoc);

const manifest = {
    schema: 1,
    // Declared, not inferred. equipment-stream.js refuses a pack whose fitId is not the
    // fit its pack-table entry asked for.
    fitId: UNDEAD_EQUIPMENT_FIT.body,
    sourceSha256: bodyHash,
    profileId: 'undead-provisional-v1',
    provisional: true,
    garments: true,
    items: {
        body: {
            url: `${URL_BASE}/body.glb`,
            bytes: bodyBytes.byteLength,
            sha256: bodyHash,
            meshes: [...UNDEAD_BASE_VISIBLE_MESHES],
        },
    },
    bindSha256: sha(JSON.stringify(bodyRig)),
};

// --- garments --------------------------------------------------------------------------
const report = [];
for (const [id, item] of Object.entries(EQUIPMENT_ITEMS).filter(([, i]) => i.parts)) {
    const names = item.parts.map(p => p.mesh);
    const doc = await io.read(`${SRC}/${id}.glb`);
    retint(doc);
    // The Human garment GLBs carry thousands of orphaned animation-sampler accessors from
    // the split; they are ~90% of each file and nothing references them.
    await doc.transform(unpartition(), prune({keepLeaves: true}));
    const present = meshNodeNames(doc);
    const missing = names.filter(name => !present.includes(name));
    if (missing.length) throw Error(`${id} missing meshes: ${missing}`);
    if (doc.getRoot().listAnimations().length) throw Error(`${id} must not carry clips`);
    if (JSON.stringify(rigOf(doc)) !== JSON.stringify(bodyRig)) {
        throw Error(`${id} skin does not match the provisional Undead body bind`);
    }
    const output = await io.writeBinary(doc);
    await fs.writeFile(`${DIR}/${id}.glb`, output);
    manifest.items[id] = {
        url: `${URL_BASE}/${id}.glb`,
        bytes: output.byteLength,
        sha256: sha(output),
        meshes: names,
        // The real Undead fit. A Human or Orc fit here would make the acceptance test vacuous.
        fit: {...item.fits.undead},
    };
    report.push({id, bytes: output.byteLength, meshes: names});
}

if (unknown.size) console.log('materials tinted by fallback rule:', [...unknown].join(', '));

await fs.writeFile(`${DIR}/manifest.json`, JSON.stringify(manifest, null, 4) + '\n');
await fs.writeFile(`${DIR}/provenance.json`, JSON.stringify({
    pipeline: 'provisional Undead stand-in pack',
    provisional: true,
    source: SRC,
    note: 'PLACEHOLDER. Human geometry on the 65-joint source bind, hair geoset removed, all '
        + 'textures stripped and materials flattened to a corpse palette so it cannot be '
        + 'mistaken for finished art. It declares the real ashen-undead fit because the point '
        + 'of the milestone is that an Undead request never silently receives a Human fit; '
        + 'the geometry is a stand-in, the fit label is not. Replace wholesale when the '
        + 'authored Undead body lands, then flip UNDEAD_PACK_DIR in src/ashen-reach/main.js.',
    regenerate: 'node scripts/ashen-reach/prepare-undead-provisional.mjs',
    fit: {...UNDEAD_EQUIPMENT_FIT},
    bodyRegions: [...BODY_REGIONS],
    hashes: {[`${DIR}/body.glb`]: bodyHash},
    garments: report,
}, null, 2) + '\n');

const total = bodyBytes.byteLength + report.reduce((n, g) => n + g.bytes, 0);
console.log(JSON.stringify({
    body: bodyBytes.byteLength, clips, meshes: bodyMeshes, garments: report.length,
    totalMB: +(total / 1048576).toFixed(2),
}, null, 2));
