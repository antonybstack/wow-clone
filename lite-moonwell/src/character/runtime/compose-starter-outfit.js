/**
 * Authored starter outfit: body-derived skinned shells in one GLB.
 * Each race uses its own mesh, skin index, IBMs, and joint rest positions.
 * Not composeFixture (Mixamo diagnostic).
 */
import { glbWriter, parseGlb, readAccessor } from './glb.js';
import {
    dilate,
    dominantJoint,
    keepLargeComponents,
    thickenTube,
} from './compose-fixture.js';

export const STARTER_PROFILE = 'human-v1';
export const STARTER_OUTFITS = Object.freeze(['starter', 'body']);
export const STARTER_COMPONENTS = Object.freeze(['shirt', 'trousers', 'boots']);

/** Registered compose targets. Bind data is always read from the selected source GLB. */
export const STARTER_PROFILES = Object.freeze({
    'human-v1': Object.freeze({ id: 'human-v1', bodyMesh: 'HumanBody', shortsNode: 'HumanShorts' }),
    'orc-v1': Object.freeze({ id: 'orc-v1', bodyMesh: 'OrcV1Body', shortsNode: 'OrcV1Shorts' }),
    'undead-v1': Object.freeze({ id: 'undead-v1', bodyMesh: 'UndeadV1Body', shortsNode: 'UndeadV1Shorts' }),
});

const SHELL = Object.freeze({
    shirt: 0.02,
    trousers: 0.018,
    boots: 0.012,
});

const COLORS = Object.freeze({
    shirt: [0.06, 0.10, 0.20, 1],
    belt: [0.07, 0.04, 0.025, 1],
    trousers: [0.035, 0.038, 0.045, 1],
    boots: [0.16, 0.08, 0.04, 1],
});

function clothMat(name, color, roughness) {
    return {
        name,
        pbrMetallicRoughness: {
            baseColorFactor: color,
            metallicFactor: 0,
            roughnessFactor: roughness,
        },
    };
}

function jointRole(name) {
    const n = (name || '').toLowerCase();
    if (/head|jaw|neck|oris|tongue|levator|temporal|special0|eye/.test(n)) return 'head';
    if (/hand|finger|metacarpal/.test(n)) return 'hand';
    if (/foot|toe/.test(n)) return 'foot';
    if (/(shoulder|upperarm|lowerarm|forearm|^leftarm$|^rightarm$|arm\.)/.test(n) && !/leg/.test(n)) return 'arm';
    if (/(upleg|upperleg|lowerleg|pelvis|(^leftleg$)|(^rightleg$))/.test(n)) return 'leg';
    if (/hip|spine|breast/.test(n)) return 'torso';
    return 'other';
}

function ibmOrigin(ibm, jointIndex) {
    const o = jointIndex * 16;
    const r00 = ibm[o]; const r01 = ibm[o + 4]; const r02 = ibm[o + 8];
    const r10 = ibm[o + 1]; const r11 = ibm[o + 5]; const r12 = ibm[o + 9];
    const r20 = ibm[o + 2]; const r21 = ibm[o + 6]; const r22 = ibm[o + 10];
    const tx = ibm[o + 12]; const ty = ibm[o + 13]; const tz = ibm[o + 14];
    return {
        x: -(r00 * tx + r10 * ty + r20 * tz),
        y: -(r01 * tx + r11 * ty + r21 * tz),
        z: -(r02 * tx + r12 * ty + r22 * tz),
    };
}

function meanY(positions, indices, offset) {
    return (
        positions[indices[offset] * 3 + 1]
        + positions[indices[offset + 1] * 3 + 1]
        + positions[indices[offset + 2] * 3 + 1]
    ) / 3;
}

function selectRegion(indices, joints, weights, roles, positions, pred) {
    const selected = [];
    for (let i = 0; i < indices.length; i += 3) {
        const r0 = roles[dominantJoint(joints, weights, indices[i])];
        const r1 = roles[dominantJoint(joints, weights, indices[i + 1])];
        const r2 = roles[dominantJoint(joints, weights, indices[i + 2])];
        const y = meanY(positions, indices, i);
        if (pred(r0, r1, r2, y)) selected.push(i);
    }
    return selected;
}

function anyRole(a, b, c, role) {
    return a === role || b === role || c === role;
}

function copyBuffer(source) {
    if (source instanceof ArrayBuffer) return source.slice(0);
    const bytes = new Uint8Array(source);
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

function hideNodeKeepIndex(json, name) {
    const idx = json.nodes.findIndex((n) => n.name === name);
    if (idx < 0) return false;
    for (const node of json.nodes) {
        if (!node.children?.includes(idx)) continue;
        node.children = node.children.filter((c) => c !== idx);
        return true;
    }
    return false;
}

function splitBelt(tube, y0, y1) {
    const pos = tube.positions;
    const idx = tube.indices;
    const cloth = [];
    const belt = [];
    for (let i = 0; i < idx.length; i += 3) {
        const y = (pos[idx[i] * 3 + 1] + pos[idx[i + 1] * 3 + 1] + pos[idx[i + 2] * 3 + 1]) / 3;
        if (y >= y0 && y <= y1) belt.push(idx[i], idx[i + 1], idx[i + 2]);
        else cloth.push(idx[i], idx[i + 1], idx[i + 2]);
    }
    return {
        cloth: new Uint32Array(cloth),
        belt: new Uint32Array(belt),
    };
}

function addSkinnedMesh(json, writer, parent, sourceNode, skinIndex, name, tube, materials) {
    const meshIndex = json.meshes.length;
    const attributes = {
        POSITION: writer.append(tube.positions, 'VEC3', true),
        NORMAL: writer.append(tube.normals, 'VEC3'),
        TEXCOORD_0: writer.append(tube.uvs, 'VEC2'),
        JOINTS_0: writer.append(tube.joints, 'VEC4'),
        WEIGHTS_0: writer.append(tube.weights, 'VEC4'),
    };
    const primitives = materials.map((mat) => {
        const material = json.materials.length;
        json.materials.push(mat.def);
        return {
            attributes,
            indices: writer.append(mat.indices, 'SCALAR'),
            material,
        };
    });
    json.meshes.push({ name, primitives });
    const node = { ...structuredClone(sourceNode), name, mesh: meshIndex, skin: skinIndex };
    const nodeIndex = json.nodes.length;
    parent.children.push(nodeIndex);
    json.nodes.push(node);
    return { meshIndex, nodeIndex, triangles: materials.reduce((n, m) => n + m.indices.length / 3, 0) };
}

/**
 * Body-derived starter shells for one playable profile. Does not mutate source bytes.
 * @param {ArrayBuffer|Uint8Array} sourceArrayBuffer
 * @param {{ profile?: string }} [opts]
 */
export function selectStarterComponents(sourceArrayBuffer, { profile = STARTER_PROFILE } = {}) {
    const fit = STARTER_PROFILES[profile];
    if (!fit) {
        throw new Error(`Unsupported fit profile: ${profile}`);
    }
    const { json, binary } = parseGlb(sourceArrayBuffer);
    const bodyNodeIndex = json.nodes.findIndex((n) => n.name === fit.bodyMesh);
    const bodyNode = bodyNodeIndex >= 0 ? json.nodes[bodyNodeIndex] : null;
    if (!bodyNode || bodyNode.mesh == null) throw new Error(`Missing ${fit.bodyMesh}`);
    const skinIndex = bodyNode.skin;
    if (skinIndex == null || !json.skins?.[skinIndex]) {
        throw new Error(`${fit.bodyMesh} has no skin`);
    }
    const skin = json.skins[skinIndex];
    const parentIndex = json.nodes.findIndex((n) => n.children?.includes(bodyNodeIndex));
    if (parentIndex < 0) throw new Error(`${fit.bodyMesh} must have an explicit parent`);

    const primitive = json.meshes[bodyNode.mesh].primitives[0];
    const positions = readAccessor(json, binary, primitive.attributes.POSITION);
    const normals = readAccessor(json, binary, primitive.attributes.NORMAL);
    const indices = readAccessor(json, binary, primitive.indices);
    const jointsAttr = readAccessor(json, binary, primitive.attributes.JOINTS_0);
    const weightsAttr = readAccessor(json, binary, primitive.attributes.WEIGHTS_0);
    const ibm = readAccessor(json, binary, skin.inverseBindMatrices);
    const jointNames = skin.joints.map((i) => json.nodes[i]?.name || '');
    const roles = jointNames.map(jointRole);

    const originByName = (name) => {
        const ji = jointNames.indexOf(name);
        return ji >= 0 ? ibmOrigin(ibm, ji) : null;
    };
    const hips = originByName('Hips');
    const neck = originByName('Neck');
    const ankle = originByName('lowerleg02.L') || originByName('LeftLeg');
    if (!hips || !neck || !ankle) {
        throw new Error(`${fit.bodyMesh} missing Hips/Neck/ankle joints for bind-space fit`);
    }
    let bboxY0 = Infinity;
    let bboxY1 = -Infinity;
    for (let i = 1; i < positions.length; i += 3) {
        const y = positions[i];
        if (y < bboxY0) bboxY0 = y;
        if (y > bboxY1) bboxY1 = y;
    }
    if (!(hips.y > bboxY0 && hips.y < bboxY1) || !(neck.y > hips.y)) {
        throw new Error(`${fit.bodyMesh} IBM joint origins failed mesh-space sanity`);
    }

    const shirtY0 = hips.y - 0.07;
    const shirtY1 = neck.y - 0.05;
    const trouserY0 = ankle.y - 0.04;
    const trouserY1 = hips.y + 0.06;
    const bootY1 = ankle.y * 0.72;

    let shirt = selectRegion(indices, jointsAttr, weightsAttr, roles, positions, (a, b, c, y) => {
        if (anyRole(a, b, c, 'head') || anyRole(a, b, c, 'hand') || anyRole(a, b, c, 'foot')) return false;
        if (anyRole(a, b, c, 'arm')) return true;
        if (anyRole(a, b, c, 'torso') || anyRole(a, b, c, 'leg')) return y >= shirtY0 && y <= shirtY1 && !anyRole(a, b, c, 'leg');
        return y >= shirtY0 && y <= shirtY1;
    });
    let trousers = selectRegion(indices, jointsAttr, weightsAttr, roles, positions, (a, b, c, y) => {
        if (anyRole(a, b, c, 'head') || anyRole(a, b, c, 'hand') || anyRole(a, b, c, 'arm')) return false;
        if (anyRole(a, b, c, 'foot')) return false;
        return y >= trouserY0 && y <= trouserY1;
    });
    let boots = selectRegion(indices, jointsAttr, weightsAttr, roles, positions, (a, b, c, y) => {
        if (anyRole(a, b, c, 'head') || anyRole(a, b, c, 'hand') || anyRole(a, b, c, 'arm')) return false;
        return anyRole(a, b, c, 'foot') || y <= bootY1;
    });

    const forbidden = (v) => {
        const r = roles[dominantJoint(jointsAttr, weightsAttr, v)];
        return r === 'head' || r === 'hand';
    };
    shirt = keepLargeComponents(indices, dilate(indices, keepLargeComponents(indices, shirt), forbidden));
    trousers = keepLargeComponents(indices, dilate(indices, keepLargeComponents(indices, trousers), (v) => {
        const r = roles[dominantJoint(jointsAttr, weightsAttr, v)];
        return r === 'head' || r === 'hand' || r === 'arm';
    }));
    boots = keepLargeComponents(indices, dilate(indices, keepLargeComponents(indices, boots), (v) => {
        const r = roles[dominantJoint(jointsAttr, weightsAttr, v)];
        return r === 'head' || r === 'hand' || r === 'arm';
    }));

    if (!shirt.length || !trousers.length || !boots.length) {
        throw new Error(`Empty starter garment shirt=${shirt.length} trousers=${trousers.length} boots=${boots.length}`);
    }

    const shirtTube = thickenTube(positions, normals, jointsAttr, weightsAttr, indices, shirt, SHELL.shirt, 'shirt');
    const beltSplit = splitBelt(shirtTube, hips.y - 0.03, hips.y + 0.07);
    const shirtMats = [{ def: clothMat('StarterIndigo', COLORS.shirt, 0.82), indices: beltSplit.cloth.length ? beltSplit.cloth : shirtTube.indices }];
    if (beltSplit.belt.length > 12) {
        shirtMats.push({ def: clothMat('StarterBelt', COLORS.belt, 0.78), indices: beltSplit.belt });
    }
    const trouserTube = thickenTube(positions, normals, jointsAttr, weightsAttr, indices, trousers, SHELL.trousers, 'trousers');
    const bootTube = thickenTube(positions, normals, jointsAttr, weightsAttr, indices, boots, SHELL.boots, 'boots');

    return {
        profile,
        fit,
        json,
        binary,
        bodyNode,
        bodyNodeIndex,
        parentIndex,
        skin,
        skinIndex,
        jointNames,
        ibm,
        positions,
        normals,
        indices,
        joints: jointsAttr,
        weights: weightsAttr,
        primitive,
        indexCount: indices.length,
        components: {
            shirt: {
                id: 'shirt',
                meshName: 'StarterShirt',
                coverageOffsets: shirt,
                tube: shirtTube,
                materials: shirtMats,
            },
            trousers: {
                id: 'trousers',
                meshName: 'StarterTrousers',
                coverageOffsets: trousers,
                tube: trouserTube,
                materials: [{ def: clothMat('StarterTrousers', COLORS.trousers, 0.86), indices: trouserTube.indices }],
            },
            boots: {
                id: 'boots',
                meshName: 'StarterBoots',
                coverageOffsets: boots,
                tube: bootTube,
                materials: [{ def: clothMat('StarterBoots', COLORS.boots, 0.8), indices: bootTube.indices }],
            },
        },
    };
}

/**
 * @param {ArrayBuffer} sourceArrayBuffer
 * @param {{ profile?: string, outfit?: string }} [opts]
 */
export function composeStarterOutfit(sourceArrayBuffer, { profile = STARTER_PROFILE, outfit = 'starter' } = {}) {
    const fit = STARTER_PROFILES[profile];
    if (!fit) {
        throw new Error(`Unsupported fit profile: ${profile}`);
    }
    if (!STARTER_OUTFITS.includes(outfit)) {
        throw new Error(`Unsupported outfit: ${outfit}`);
    }

    if (outfit === 'body') {
        const { json } = parseGlb(sourceArrayBuffer);
        const bodyNode = json.nodes.find((n) => n.name === fit.bodyMesh);
        if (!bodyNode || bodyNode.mesh == null) throw new Error(`Missing ${fit.bodyMesh}`);
        return {
            buffer: copyBuffer(sourceArrayBuffer),
            manifest: {
                profile,
                outfit,
                components: [],
                sourceMesh: fit.bodyMesh,
                sourceSkin: bodyNode.skin,
                coveredTriangles: [],
                shortsHidden: false,
            },
        };
    }

    const selected = selectStarterComponents(sourceArrayBuffer, { profile });
    const { json, binary } = parseGlb(sourceArrayBuffer);
    const bodyNode = json.nodes.find((n) => n.name === fit.bodyMesh);
    const skinIndex = bodyNode.skin;
    const bodyNodeIndex = json.nodes.indexOf(bodyNode);
    const parent = json.nodes.find((n) => n.children?.includes(bodyNodeIndex));
    const primitive = json.meshes[bodyNode.mesh].primitives[0];
    const indices = selected.indices;

    const writer = glbWriter(json, binary);
    const shirt = selected.components.shirt;
    const trousers = selected.components.trousers;
    const boots = selected.components.boots;
    const covered = new Set([...shirt.coverageOffsets, ...trousers.coverageOffsets, ...boots.coverageOffsets]);
    const components = [];

    const shirtPlaced = addSkinnedMesh(json, writer, parent, bodyNode, skinIndex, shirt.meshName, shirt.tube, shirt.materials);
    components.push({ id: 'shirt', mesh: shirt.meshName, node: shirtPlaced.nodeIndex, triangles: shirtPlaced.triangles, sourceTriangles: shirt.coverageOffsets.length });

    const trouserPlaced = addSkinnedMesh(json, writer, parent, bodyNode, skinIndex, trousers.meshName, trousers.tube, trousers.materials);
    components.push({ id: 'trousers', mesh: trousers.meshName, node: trouserPlaced.nodeIndex, triangles: trouserPlaced.triangles, sourceTriangles: trousers.coverageOffsets.length });

    const bootPlaced = addSkinnedMesh(json, writer, parent, bodyNode, skinIndex, boots.meshName, boots.tube, boots.materials);
    components.push({ id: 'boots', mesh: boots.meshName, node: bootPlaced.nodeIndex, triangles: bootPlaced.triangles, sourceTriangles: boots.coverageOffsets.length });

    const remaining = [];
    for (let i = 0; i < indices.length; i += 3) {
        if (!covered.has(i)) remaining.push(indices[i], indices[i + 1], indices[i + 2]);
    }
    if (!remaining.length) throw new Error(`Coverage hid ${fit.bodyMesh}`);
    primitive.indices = writer.append(new Uint32Array(remaining), 'SCALAR');

    const shortsHidden = hideNodeKeepIndex(json, fit.shortsNode);
    json.asset = json.asset || {};
    json.asset.extras = { ...(json.asset.extras || {}), starterOutfit: { profile, outfit } };

    return {
        buffer: writer.finish(),
        manifest: {
            profile,
            outfit,
            components,
            sourceMesh: fit.bodyMesh,
            sourceSkin: skinIndex,
            coveredTriangles: [...covered],
            coveredCount: covered.size,
            remainingCount: remaining.length / 3,
            shortsHidden,
            jointNames: selected.jointNames,
        },
    };
}

/**
 * One-shot worker: compose off the main thread, then terminate.
 * @param {ArrayBuffer} source
 * @param {{ profile?: string, outfit?: string }} [options]
 */
export function composeStarterOutfitAsync(source, options) {
    const worker = new Worker(new URL('./starter-outfit-worker.js', import.meta.url), { type: 'module' });
    return new Promise((resolve, reject) => {
        const fail = (err) => {
            worker.terminate();
            reject(err instanceof Error ? err : new Error(String(err)));
        };
        worker.onmessage = ({ data }) => {
            worker.terminate();
            if (data?.error) reject(new Error(data.error));
            else resolve(data.result);
        };
        worker.onerror = (event) => fail(event.message || 'starter outfit worker failed');
        worker.onmessageerror = () => fail('starter outfit worker returned an unreadable message');
        try {
            worker.postMessage({ source, options });
        } catch (error) {
            fail(error);
        }
    });
}
