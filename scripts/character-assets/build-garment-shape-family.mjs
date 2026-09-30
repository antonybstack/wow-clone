/**
 * M005: give the Human garments the same shape family the body has.
 *
 * Every Human garment is skinned to the same 65-joint rest skeleton in the same metre
 * space as the body, so the M004 girth field applies to them unchanged. Cloth pieces take
 * the field per vertex and drape with the body; a rigid plate takes one translation for the
 * whole piece, so it rides outward over a thicker torso without bending.
 *
 * The output keeps everything the equipment pipeline depends on: same vertex count and
 * order, same joint order, same inverse binds, same UVs, same materials, same mesh frame.
 * Only two morph targets are added, and weight 0 is the shipped garment in every semantic
 * accessor. `compose-loadout.js` rejects morph targets on an *offline composed* fit, so
 * these candidates are served to the streamed path, not composed into a baked outfit.
 *
 * Written non-interleaved for the same reason the body candidate is: Lite 1.31.1's glTF
 * morph feature ignores `bufferView.byteStride`.
 *
 * Usage: node scripts/character-assets/build-garment-shape-family.mjs
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {NodeIO, VertexLayout} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {MeshoptDecoder, MeshoptEncoder} from 'meshoptimizer';
import {buildSegments, recomputeNormals, restWorld, rigidShape, softShape, trackBodyRigid, trackBodyShape} from './girth-field.mjs';
import {extendHems, vertexNormals} from './garment-coverage.mjs';

const GIRTH = 'docs/baselines/character-mmo/m004/makehuman-girth.json';
const BODY = process.env.ASHEN_GARMENT_BODY || '.cache/character-mmo/m004/human-shape-family-v1.glb';
// 'track' moves each garment vertex by the body's displacement beneath it, preserving the
// authored standoff. 'field' applies the girth field to the garment's own offsets, which
// over-moves cloth that sits further from the bone than the skin does. Both are kept so the
// M005 report can compare them on the same measurement instead of asserting one is better.
const MODE = process.env.ASHEN_FIT_MODE === 'field' ? 'field' : 'track';
// A reference fit preserves standoff; it cannot invent length, so a heavier silhouette runs
// past where a garment ends. The hem pass stretches the last band of the existing hem to
// cover what the shape uncovered, inside the shape target only. Off with ASHEN_HEMS=0, so
// the report can state what the fit alone achieves.
const HEMS = process.env.ASHEN_HEMS !== '0';
const OUT_DIR = process.env.ASHEN_GARMENT_OUT || (MODE === 'field' ? '.cache/character-mmo/m005-field' : '.cache/character-mmo/m005');
const OUT_REPORT = process.env.ASHEN_GARMENT_REPORT
    || (MODE === 'field' ? 'docs/baselines/character-mmo/m005/garment-shape-family-field.json'
        : 'docs/baselines/character-mmo/m005/garment-shape-family.json');
const TARGET_NAMES = ['slender', 'stout'];

/** `rigid: true` means the piece keeps its shape and only moves. */
const GARMENTS = [
    {item: 'wayfarerTunic', file: 'public/ashen-reach/equipment/wayfarerTunic.glb', rigid: false},
    {item: 'wayfarerTrousers', file: 'public/ashen-reach/equipment/wayfarerTrousers.glb', rigid: false},
    {item: 'wayfarerBoots', file: 'public/ashen-reach/equipment/wayfarerBoots.glb', rigid: false},
    {item: 'pilgrimTunic', file: 'public/ashen-reach/equipment/pilgrimTunic.glb', rigid: false},
    {item: 'graveweaverTop', file: 'public/ashen-reach/equipment/graveweaverTop.glb', rigid: false},
    {item: 'graveweaverSkirt', file: 'public/ashen-reach/equipment/graveweaverSkirt.glb', rigid: false},
    {item: 'graveweaverHood', file: 'public/ashen-reach/equipment/graveweaverHood.glb', rigid: false},
    {item: 'graveweaverGloves', file: 'public/ashen-reach/equipment/graveweaverGloves.glb', rigid: false},
    // The catalogue has no rigid element, so M005 authors one:
    // scripts/character-assets/build_warden_pauldrons.py. Prototype, developer-only,
    // deliberately not in public/ and not in the production catalogue.
    {item: 'wardenPauldrons', file: '.cache/character-mmo/m005/warden-pauldrons.glb', rigid: true, out: '.cache/character-mmo/m005/warden-pauldrons-shaped.glb'},
];

const sha = bytes => createHash('sha256').update(bytes).digest('hex');

function semanticHash(prim, skin) {
    const h = createHash('sha256');
    for (const key of ['POSITION', 'NORMAL', 'TEXCOORD_0', 'TANGENT', 'JOINTS_0', 'WEIGHTS_0']) {
        const acc = prim.getAttribute(key);
        if (!acc) continue;
        const arr = acc.getArray();
        h.update(key);
        h.update(Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength));
    }
    const idx = prim.getIndices().getArray();
    h.update(Buffer.from(idx.buffer, idx.byteOffset, idx.byteLength));
    h.update(skin.listJoints().map(j => j.getName()).join('|'));
    const ibm = skin.getInverseBindMatrices().getArray();
    h.update(Buffer.from(ibm.buffer, ibm.byteOffset, ibm.byteLength));
    return h.digest('hex');
}

async function main() {
    await MeshoptDecoder.ready;
    await MeshoptEncoder.ready;
    const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
        'meshopt.decoder': MeshoptDecoder,
        'meshopt.encoder': MeshoptEncoder,
    }).setVertexLayout(VertexLayout.SEPARATE);
    const girth = JSON.parse(await fs.readFile(GIRTH, 'utf8'));
    await fs.mkdir(OUT_DIR, {recursive: true});

    // The body's own shaped positions, read back from the M004 candidate so the garments
    // track exactly the body they will be worn on rather than a recomputed approximation.
    const bodyDoc = await io.read(BODY);
    const bodyMesh = bodyDoc.getRoot().listMeshes().find(m => m.getName() === 'HumanV1Body');
    const bodyPrim = bodyMesh.listPrimitives()[0];
    const bodyPositions = bodyPrim.getAttribute('POSITION').getArray();
    const bodyTargetNames = bodyMesh.getExtras().targetNames;
    const bodyDeltas = {};
    bodyPrim.listTargets().forEach((target, i) => {
        bodyDeltas[bodyTargetNames[i]] = target.getAttribute('POSITION').getArray();
    });
    for (const name of TARGET_NAMES) {
        if (!bodyDeltas[name]) throw Error(`Body candidate has no '${name}' target; rebuild it first`);
    }
    // The hem pass asks whether the body is still covered, which needs the body's own
    // shaped positions and normals, not just its deltas.
    const bodyIndices = bodyPrim.getIndices().getArray();
    const bodyNeutralNormals = vertexNormals(bodyPositions, bodyIndices);
    const shapedBodies = {};
    for (const name of TARGET_NAMES) {
        const positions = Float32Array.from(bodyPositions);
        for (let i = 0; i < positions.length; i++) positions[i] += bodyDeltas[name][i];
        shapedBodies[name] = {positions, normals: vertexNormals(positions, bodyIndices)};
    }

    const rows = [];
    for (const garment of GARMENTS) {
        // Production families are reproducible from the eight tracked canonical garments.
        // The diagnostic plate requires an ignored Blender output and is not a catalogue item.
        if (garment.rigid && process.env.ASHEN_SKIP_PLATE === '1') continue;
        const sourceBytes = await fs.readFile(garment.file);
        const doc = await io.read(garment.file);
        const root = doc.getRoot();
        const skin = root.listSkins()[0];
        if (!skin) throw Error(`${garment.item} has no skin`);
        const joints = skin.listJoints();
        if (joints.length !== 65) throw Error(`${garment.item} has ${joints.length} joints, expected 65`);
        const {segments} = MODE === 'field' ? buildSegments(joints, restWorld(root), girth) : {segments: null};
        const buffer = root.listBuffers()[0];
        for (const ext of root.listExtensionsUsed()) {
            if (ext.extensionName === 'EXT_meshopt_compression') ext.dispose();
        }

        // Collect every primitive first. The hem pass needs the whole garment at once,
        // because a body vertex left bare by one piece can only be reached by that piece's
        // hem, and coverage is asked of the garment as a whole.
        const prims = [];
        for (const mesh of root.listMeshes()) {
            for (const prim of mesh.listPrimitives()) {
                if (prim.listTargets().length) throw Error(`${garment.item}/${mesh.getName()} already has morph targets`);
                prims.push({
                    mesh, prim,
                    positions: prim.getAttribute('POSITION').getArray(),
                    count: prim.getAttribute('POSITION').getCount(),
                    jointsArr: prim.getAttribute('JOINTS_0').getArray(),
                    weightsArr: prim.getAttribute('WEIGHTS_0').getArray(),
                    indices: prim.getIndices().getArray(),
                    baseNormals: prim.getAttribute('NORMAL').getArray(),
                    before: semanticHash(prim, skin),
                    shapes: {},
                });
            }
        }

        const neutralParts = prims.map(p => ({positions: p.positions, indices: p.indices}));
        const hemReports = {};
        for (const name of TARGET_NAMES) {
            const shapedParts = prims.map((p) => {
                const result = MODE === 'track'
                    ? (garment.rigid
                        ? trackBodyRigid(p.positions, bodyPositions, bodyDeltas[name], {jointsArr: p.jointsArr, weightsArr: p.weightsArr})
                        : trackBodyShape(p.positions, bodyPositions, bodyDeltas[name]))
                    : (garment.rigid
                        ? rigidShape(p.positions, p.jointsArr, p.weightsArr, segments, name)
                        : softShape(p.positions, p.jointsArr, p.weightsArr, segments, name));
                return {result, positions: result.shaped, indices: p.indices};
            });

            // A plate has no hem to stretch, and stretching it would be exactly the bending
            // this milestone forbids.
            if (!garment.rigid && HEMS) {
                const shapedBody = shapedBodies[name];
                hemReports[name] = extendHems(
                    shapedParts, neutralParts,
                    shapedBody.positions, shapedBody.normals,
                    bodyPositions, bodyNeutralNormals,
                );
            }

            prims.forEach((p, i) => {
                const shaped = shapedParts[i].positions;
                const result = shapedParts[i].result;
                const shapedNormals = garment.rigid ? p.baseNormals : recomputeNormals(shaped, p.indices, p.count);
                const posDelta = new Float32Array(p.count * 3);
                const normDelta = new Float32Array(p.count * 3);
                let moved = 0, maxDelta = 0, sumDelta = 0;
                for (let v = 0; v < p.count; v++) {
                    for (let a = 0; a < 3; a++) {
                        posDelta[v * 3 + a] = shaped[v * 3 + a] - p.positions[v * 3 + a];
                        normDelta[v * 3 + a] = shapedNormals[v * 3 + a] - p.baseNormals[v * 3 + a];
                    }
                    const m = Math.hypot(posDelta[v * 3], posDelta[v * 3 + 1], posDelta[v * 3 + 2]);
                    if (m > 1e-6) moved++;
                    sumDelta += m;
                    if (m > maxDelta) maxDelta = m;
                }
                const target = doc.createPrimitiveTarget(name)
                    .setAttribute('POSITION', doc.createAccessor(`${p.mesh.getName()}_${name}_POSITION`)
                        .setType('VEC3').setArray(posDelta).setBuffer(buffer))
                    .setAttribute('NORMAL', doc.createAccessor(`${p.mesh.getName()}_${name}_NORMAL`)
                        .setType('VEC3').setArray(normDelta).setBuffer(buffer));
                p.prim.addTarget(target);
                p.shapes[name] = {
                    movedVertices: moved,
                    maxDisplacementM: Number(maxDelta.toFixed(6)),
                    meanDisplacementM: Number((sumDelta / p.count).toFixed(6)),
                    ...(garment.rigid ? {rigidPieces: result.fits} : {}),
                };
            });
        }

        const pieces = prims.map(p => ({
            mesh: p.mesh.getName(), vertices: p.count, triangles: p.indices.length / 3,
            before: p.before, shapes: p.shapes,
        }));
        for (const p of prims) {
            p.mesh.setWeights(TARGET_NAMES.map(() => 0));
            p.mesh.setExtras({...(p.mesh.getExtras() || {}), targetNames: [...TARGET_NAMES]});
        }

        const outPath = garment.out || path.join(OUT_DIR, path.basename(garment.file));
        const outBytes = await io.writeBinary(doc);
        await fs.writeFile(outPath, outBytes);

        // Neutral identity against the shipped garment, on the written file.
        const check = await io.read(outPath);
        const cRoot = check.getRoot();
        const cSkin = cRoot.listSkins()[0];
        let piece = 0;
        for (const mesh of cRoot.listMeshes()) {
            for (const prim of mesh.listPrimitives()) {
                const after = semanticHash(prim, cSkin);
                if (after !== pieces[piece].before) throw Error(`${garment.item}/${mesh.getName()} changed its base geometry or bind`);
                if (prim.listTargets().length !== TARGET_NAMES.length) throw Error(`${garment.item}/${mesh.getName()} lost its targets`);
                pieces[piece].neutralSha256 = after;
                delete pieces[piece].before;
                piece++;
            }
        }

        rows.push({
            item: garment.item,
            rigid: garment.rigid,
            hems: Object.keys(hemReports).length ? hemReports : null,
            source: {path: garment.file, sha256: sha(sourceBytes)},
            output: {path: outPath, sha256: sha(outBytes), bytes: outBytes.byteLength},
            pieces,
        });
        console.log(`${garment.item.padEnd(18)} ${MODE} ${garment.rigid ? 'rigid' : 'cloth'} pieces=${pieces.length} `
            + pieces.map(p => `${p.mesh}(${p.vertices}v slender ${(p.shapes.slender.maxDisplacementM * 1000).toFixed(1)}mm `
                + `stout ${(p.shapes.stout.maxDisplacementM * 1000).toFixed(1)}mm)`).join(' '));
    }

    // A manifest the real streamed loader accepts, so the refitted pack can be served to
    // the actual game route instead of only measured offline. `equipment-stream.js` checks
    // the declared byte length and SHA-256 of every item, so both are recomputed here.
    const shipped = JSON.parse(await fs.readFile('public/ashen-reach/equipment/manifest.json', 'utf8'));
    const bodyBytes = await fs.readFile(BODY);
    const manifest = {
        schema: shipped.schema,
        fitId: shipped.fitId,
        sourceSha256: sha(bodyBytes),
        items: {
            body: {
                url: '/__human_shape__/human-shape-family-v1.glb',
                bytes: bodyBytes.byteLength,
                sha256: sha(bodyBytes),
                meshes: shipped.items.body.meshes,
            },
        },
    };
    for (const row of rows) {
        const base = shipped.items[row.item];
        if (!base) continue;   // the prototype plate is not a catalogue item
        manifest.items[row.item] = {
            url: `/__garment_fit__/${path.basename(row.output.path)}`,
            bytes: row.output.bytes,
            sha256: row.output.sha256,
            meshes: base.meshes,
            fit: base.fit,
        };
    }
    const manifestPath = path.join(OUT_DIR, 'manifest.json');
    await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 1)}\n`);
    console.log(`wrote ${manifestPath} (${Object.keys(manifest.items).length} items)`);

    await fs.mkdir(path.dirname(OUT_REPORT), {recursive: true});
    await fs.writeFile(OUT_REPORT, `${JSON.stringify({
        schema: 1,
        generatedBy: 'scripts/character-assets/build-garment-shape-family.mjs',
        fitProfile: 'ashen-human-shape-v1',
        mode: MODE,
        body: {path: BODY, sha256: sha(await fs.readFile(BODY))},
        targetNames: [...TARGET_NAMES],
        girthSource: {path: GIRTH, sha256: sha(await fs.readFile(GIRTH))},
        hemPass: HEMS,
        note: MODE === 'track'
            ? 'Each garment vertex moves by the body displacement beneath it, preserving authored standoff; a rigid piece takes the mean of that as one translation.'
            : 'Cloth takes the girth field applied to its own offsets; a rigid piece takes one translation for the whole piece.',
        garments: rows,
        manifest: {path: path.join(OUT_DIR, 'manifest.json')},
    }, null, 1)}\n`);
    console.log(`wrote ${OUT_REPORT}`);
}

await main();
