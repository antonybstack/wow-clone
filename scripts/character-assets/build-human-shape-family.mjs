/**
 * Build the M004 Human shape family: slender and stout morph targets on the active body.
 *
 * Inputs
 * ------
 *  * `public/ashen-reach/equipment/body.glb` — the body the game actually loads
 *    (`HumanV1Body`, 3,274 vertices, 65 joints, 57 clips, meshopt-compressed).
 *  * `docs/baselines/character-mmo/m004/makehuman-girth.json` — per-segment girth
 *    ratios measured from the CC0 MakeHuman source by
 *    `scripts/character-assets/measure-makehuman-girth.py`.
 *
 * What it does
 * ------------
 * Nothing about the skeleton, the bind, the joint order, the inverse binds, the
 * UVs, the weights or the clips changes. The only addition is two glTF morph
 * targets holding POSITION and NORMAL deltas, so the neutral shape is the
 * shipped body byte-for-byte in every semantic accessor and weight 0 is the
 * current character. glTF morph targets are additive displacement sets over the
 * base attributes: https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#morph-targets
 *
 * The deltas are a girth field in bone space. For every vertex, for each joint
 * that actually skins it, the vertex's offset from that joint's rest axis is
 * split into the two axes of the plane perpendicular to the axis and scaled by
 * that segment's measured ratios; the per-joint results are blended with the
 * mesh's own skin weights. Using the skin weights as the blend means the field
 * is continuous wherever the deformation already is, with no seam handling, and
 * that joints with no measured segment (fingers, toes, eyes, head tip) receive
 * exactly zero — so hand grip contact and foot placement are untouched.
 *
 * This is a girth field, not an anatomical resculpt. It widens and narrows
 * segments; it does not move fat or muscle mass within a segment, and it does
 * not re-tailor garments. Garment refitting is M005.
 *
 * Lite composes morph deltas before skinning (`MORPH_PRE_SKINNING` writes
 * `morphedPos`/`morphedNorm` into the vertex `VR` slot in
 * `node_modules/@babylonjs/lite/lib/shader/fragments/morph-fragment-core.js`),
 * and its glTF loader reads POSITION and NORMAL targets only — TANGENT targets
 * would be dropped, so none are emitted and the base tangents are kept.
 *
 * Output is a developer candidate under `.cache/`, never `public/`: it is not in
 * the Pages bundle and the game loads it only behind an explicit query.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {NodeIO, VertexLayout} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {MeshoptDecoder, MeshoptEncoder} from 'meshoptimizer';
import {buildSegments, recomputeNormals, restWorld, softShape} from './girth-field.mjs';

const BODY = 'public/ashen-reach/equipment/body.glb';
const GIRTH = 'docs/baselines/character-mmo/m004/makehuman-girth.json';
const OUT_GLB = '.cache/character-mmo/m004/human-shape-family-v1.glb';
const OUT_REPORT = 'docs/baselines/character-mmo/m004/shape-family.json';
const MESH_NAME = 'HumanV1Body';
const TARGET_NAMES = ['slender', 'stout'];

const sha = bytes => createHash('sha256').update(bytes).digest('hex');

async function main() {
    await MeshoptDecoder.ready;
    await MeshoptEncoder.ready;
    // Non-interleaved vertex data, deliberately. Lite's glTF morph feature resolves each
    // target accessor with `resolveAccessor`, which builds a tightly packed typed array from
    // the buffer view offset and ignores `bufferView.byteStride`
    // (`lib/loader-gltf/gltf-parser.js`). glTF Transform interleaves by default, which is
    // legal glTF, and the result is that Lite reads POSITION, NORMAL, POSITION, ... as one
    // run of positions: the character renders as shattered triangles. Writing every accessor
    // into its own tightly packed buffer view keeps the asset inside what Lite 1.31.1 reads.
    const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
        'meshopt.decoder': MeshoptDecoder,
        'meshopt.encoder': MeshoptEncoder,
    }).setVertexLayout(VertexLayout.SEPARATE);

    const bodyBytes = await fs.readFile(BODY);
    const girth = JSON.parse(await fs.readFile(GIRTH, 'utf8'));
    const doc = await io.read(BODY);
    const root = doc.getRoot();

    const mesh = root.listMeshes().find(m => m.getName() === MESH_NAME);
    if (!mesh) throw Error(`Missing mesh ${MESH_NAME}`);
    const prims = mesh.listPrimitives();
    if (prims.length !== 1) throw Error(`Expected 1 primitive, have ${prims.length}`);
    const prim = prims[0];
    if (prim.listTargets().length) throw Error('Base body already declares morph targets');

    const skin = root.listSkins()[0];
    const joints = skin.listJoints();
    if (joints.length !== 65) throw Error(`Expected 65 joints, have ${joints.length}`);

    // Rest transforms, segment axes and the measured ratios all come from the shared
    // field module, so the body and the M005 garments cannot drift apart.
    const {segments, used} = buildSegments(joints, restWorld(root), girth);

    const positions = prim.getAttribute('POSITION').getArray();
    const count = prim.getAttribute('POSITION').getCount();
    const jointsArr = prim.getAttribute('JOINTS_0').getArray();
    const weightsArr = prim.getAttribute('WEIGHTS_0').getArray();
    const indices = prim.getIndices().getArray();
    const baseNormals = prim.getAttribute('NORMAL').getArray();

    const shapes = {};
    for (const target of TARGET_NAMES) {
        const result = softShape(positions, jointsArr, weightsArr, segments, target);
        const shaped = result.shaped;
        const shapedNormals = recomputeNormals(shaped, indices, count);
        const posDelta = new Float32Array(count * 3);
        const normDelta = new Float32Array(count * 3);
        for (let i = 0; i < count * 3; i++) {
            posDelta[i] = shaped[i] - positions[i];
            normDelta[i] = shapedNormals[i] - baseNormals[i];
        }
        let minY = Infinity, maxY = -Infinity, minX = Infinity, maxX = -Infinity;
        for (let v = 0; v < count; v++) {
            minY = Math.min(minY, shaped[v * 3 + 1]); maxY = Math.max(maxY, shaped[v * 3 + 1]);
            minX = Math.min(minX, shaped[v * 3]); maxX = Math.max(maxX, shaped[v * 3]);
        }
        shapes[target] = {
            posDelta, normDelta,
            stats: {
                movedVertices: result.moved,
                maxDisplacementM: Number(result.maxDelta.toFixed(6)),
                meanDisplacementM: Number(result.meanDelta.toFixed(6)),
                shapedHeightM: Number((maxY - minY).toFixed(6)),
                shapedSpanXM: Number((maxX - minX).toFixed(6)),
            },
        };
    }

    // Emit the targets. Accessors are plain float VEC3 in a new buffer view; dropping the
    // meshopt extension keeps the candidate free of the quantisation and vertex reordering
    // that previously broke shared skinned accessors on this character.
    for (const ext of root.listExtensionsUsed()) {
        if (ext.extensionName === 'EXT_meshopt_compression') ext.dispose();
    }
    const buffer = root.listBuffers()[0];
    for (const name of TARGET_NAMES) {
        const {posDelta, normDelta} = shapes[name];
        const target = doc.createPrimitiveTarget(name)
            .setAttribute('POSITION', doc.createAccessor(`${name}_POSITION`)
                .setType('VEC3').setArray(posDelta).setBuffer(buffer))
            .setAttribute('NORMAL', doc.createAccessor(`${name}_NORMAL`)
                .setType('VEC3').setArray(normDelta).setBuffer(buffer));
        prim.addTarget(target);
    }
    mesh.setWeights(TARGET_NAMES.map(() => 0));
    mesh.setExtras({...(mesh.getExtras() || {}), targetNames: [...TARGET_NAMES]});

    await fs.mkdir(path.dirname(OUT_GLB), {recursive: true});
    const outBytes = await io.writeBinary(doc);
    await fs.writeFile(OUT_GLB, outBytes);

    // Prove neutral identity: re-read the written file and compare the base attributes,
    // joint order and inverse binds against the shipped body, not the file hash.
    const check = await io.read(OUT_GLB);
    const cRoot = check.getRoot();
    const cPrim = cRoot.listMeshes().find(m => m.getName() === MESH_NAME).listPrimitives()[0];
    const semantic = (p, sk) => {
        const h = createHash('sha256');
        for (const key of ['POSITION', 'NORMAL', 'TEXCOORD_0', 'TANGENT', 'JOINTS_0', 'WEIGHTS_0']) {
            const acc = p.getAttribute(key);
            h.update(key);
            h.update(Buffer.from(acc.getArray().buffer, acc.getArray().byteOffset, acc.getArray().byteLength));
        }
        h.update(Buffer.from(p.getIndices().getArray().buffer));
        h.update(sk.listJoints().map(j => j.getName()).join('|'));
        const ibm = sk.getInverseBindMatrices().getArray();
        h.update(Buffer.from(ibm.buffer, ibm.byteOffset, ibm.byteLength));
        return h.digest('hex');
    };
    const before = semantic(prim, skin);
    const after = semantic(cPrim, cRoot.listSkins()[0]);
    if (before !== after) throw Error('Neutral identity check failed: base attributes or bind changed');
    if (cPrim.listTargets().length !== TARGET_NAMES.length) throw Error('Written targets did not survive the round trip');
    const clipsBefore = root.listAnimations().map(a => a.getName());
    const clipsAfter = cRoot.listAnimations().map(a => a.getName());
    if (clipsBefore.join('|') !== clipsAfter.join('|')) throw Error('Animation set changed');

    const report = {
        schema: 1,
        generatedBy: 'scripts/character-assets/build-human-shape-family.mjs',
        fitProfile: 'ashen-human-shape-v1',
        targetNames: [...TARGET_NAMES],
        base: {path: BODY, sha256: sha(bodyBytes), vertices: count, triangles: indices.length / 3, joints: joints.length},
        girthSource: {path: GIRTH, sha256: sha(await fs.readFile(GIRTH))},
        output: {path: OUT_GLB, sha256: sha(outBytes), bytes: outBytes.byteLength, compression: null},
        neutralIdentity: {
            method: 'sha256 over POSITION/NORMAL/TEXCOORD_0/TANGENT/JOINTS_0/WEIGHTS_0/indices/joint order/inverse binds',
            sha256: after,
            matchesShippedBody: true,
        },
        clips: clipsAfter.length,
        segments: used,
        unmeasuredJoints: joints.map(j => j.getName()).filter(n => !used.includes(n)),
        shapes: Object.fromEntries(TARGET_NAMES.map(n => [n, shapes[n].stats])),
    };
    await fs.mkdir(path.dirname(OUT_REPORT), {recursive: true});
    await fs.writeFile(OUT_REPORT, `${JSON.stringify(report, null, 1)}\n`);

    console.log(`wrote ${OUT_GLB} (${outBytes.byteLength} bytes, sha256 ${report.output.sha256.slice(0, 12)})`);
    console.log(`neutral identity ${after.slice(0, 16)} matches the shipped body`);
    for (const n of TARGET_NAMES) console.log(` ${n}:`, JSON.stringify(shapes[n].stats));
    console.log(`untouched joints: ${report.unmeasuredJoints.length}`);
}

await main();
