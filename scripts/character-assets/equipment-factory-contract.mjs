/** Pure contract for the descriptor-driven rigid equipment factory (M8).
 *
 * Everything here is deterministic and side-effect free except `verifyPinnedInputs` and the
 * publication executor, so the same checks gate an isolated build, its byte-identical
 * repeat and an explicit publication. Authoring stays in pinned Blender; this module
 * restores THAT accepted body's ordered bind and frame (native `normalizeHumanBind`),
 * proves rigidity/material/animation/morph policy, re-reads the written bytes through an
 * independent glTF Transform reader and the existing `verifyFactoryEquipmentBind` gate,
 * and derives Human slender/stout rigid targets with the existing `trackBodyRigid` field.
 * https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#skins
 * https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#morph-targets
 * https://gltf-transform.dev/modules/core/classes/NodeIO
 * https://docs.blender.org/manual/en/latest/advanced/command_line/arguments.html
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {FITS_BY_RACE} from '../../src/ashen-reach/equipment-contract.js';
import {EQUIPMENT_SLOTS} from '../../src/ashen-reach/equipment-catalog.js';
import {normalizeHumanBind} from './normalize-human-bind.mjs';
import {verifyFactoryEquipmentBind} from './verify-factory-equipment-bind.mjs';
import {retainFullStartupGeometry} from './startup-geometry-policy.mjs';
import {trackBodyRigid, trackBodyShape, recomputeNormals} from './girth-field.mjs';

export const FACTORY_SCHEMA = 1;
export const SOFT_FACTORY_SCHEMA = 2;
export const PINNED_BLENDER = '5.2.1';
export const HUMAN_SHAPE_FAMILY = 'ashen-human-shape-v1';
export const HUMAN_SHAPE_TARGETS = Object.freeze(['slender', 'stout']);
export const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

const ID = /^[a-z][A-Za-z0-9]{2,63}$/, MESH = /^[A-Z][A-Za-z0-9]{2,63}$/, HEX = /^[0-9a-f]{64}$/;
const DIRECTORY = /^[a-z0-9-]+$/;
const unit = (n) => Number.isFinite(n) && n >= 0 && n <= 1;
const isUnitArray = (a, n) => Array.isArray(a) && a.length === n && a.every(unit);
const relativePath = (p) => typeof p === 'string' && p.length > 0 && !path.isAbsolute(p) && !p.split(/[\\/]/).includes('..');

/** Validate the whole descriptor before anything is read, authored or written. Every race in
 * FITS_BY_RACE must be declared: a missing fit is a deliberate refusal, never a fallback. */
export function validateDescriptor(d) {
    const fail = (message) => { throw Error(`Factory descriptor: ${message}`); };
    if (!d || typeof d !== 'object' || ![FACTORY_SCHEMA, SOFT_FACTORY_SCHEMA].includes(d.schema)) fail('schema must be 1 (rigid) or 2 (soft-skin)');
    const soft = d.schema === SOFT_FACTORY_SCHEMA;
    if (!ID.test(d.id ?? '')) fail('invalid logical id');
    if (!MESH.test(d.mesh ?? '')) fail('invalid mesh name');
    if (!EQUIPMENT_SLOTS.includes(d.slot)) fail(`unknown slot ${d.slot}`);
    if (typeof d.layer !== 'string' || !d.layer) fail('missing layer');
    if (!Array.isArray(d.occupies) || !d.occupies.includes(d.slot) || d.occupies.some((s) => !EQUIPMENT_SLOTS.includes(s))
        || new Set(d.occupies).size !== d.occupies.length) fail('occupancy must list known slots including its own');
    if (soft) {
        if (d.deformation !== 'soft-skin' || d.rigidBones !== undefined || d.structure !== undefined)
            fail('factory v2 supports soft-skin garments without rigid policy');
    } else {
        if (d.deformation !== 'rigid-bone') fail('factory v1 supports rigid-bone plates only');
        if (d.structure && (!Number.isInteger(d.structure.partsPerBone) || d.structure.partsPerBone < 1)) fail('structure partsPerBone must be positive');
        if (!Array.isArray(d.rigidBones) || !d.rigidBones.length || d.rigidBones.some((b) => typeof b !== 'string' || !b)
            || new Set(d.rigidBones).size !== d.rigidBones.length) fail('rigidBones must name the intended bones');
    }
    if (d.blenderVersion !== PINNED_BLENDER) fail(`Blender must be pinned to ${PINNED_BLENDER}`);
    if (!relativePath(d.builder?.path) || !d.builder.path.endsWith('.py') || !HEX.test(d.builder?.sha256 ?? '')) fail('builder path and sha256 required');
    // The builder may import a shared library builder; every transitive file it executes is pinned.
    const dependencies = d.builder.dependencies ?? [];
    if (!Array.isArray(dependencies) || dependencies.some((x) => !relativePath(x?.path) || !x.path.endsWith('.py') || !HEX.test(x?.sha256 ?? ''))
        || new Set([d.builder.path, ...dependencies.map((x) => x.path)]).size !== dependencies.length + 1) fail('builder dependencies need unique path and sha256');
    if (typeof d.sourceRights !== 'string' || d.sourceRights.length < 10) fail('sourceRights must state provenance and licence');
    const validMaterial = m => m && Number.isInteger(m.revision) && m.revision >= 1 && isUnitArray(m.baseColor, 4) && unit(m.metallic) && unit(m.roughness);
    if (!soft && !validMaterial(d.material))
        fail('material policy needs a positive revision and baseColor[4], metallic, roughness within 0..1');
    if (soft && (!Array.isArray(d.materials) || !d.materials.length || d.materials.some(m => !validMaterial(m)
        || typeof m.name !== 'string' || !m.name || typeof m.doubleSided !== 'boolean' || m.alphaMode !== 'OPAQUE'
        || !(m.baseColorTextureSha256 === null || HEX.test(m.baseColorTextureSha256 ?? '')))
        || new Set(d.materials.map(m => m.name)).size !== d.materials.length))
        fail('soft material policy needs unique names, PBR factors, opaque/culling policy and pinned base textures');
    if (!soft && (d.detail?.full !== 'authored-shell' || d.detail?.compact !== 'same-rigid-geometry'))
        fail('rigid detail policy is full authored-shell and compact same-rigid-geometry');
    if (soft && (d.detail?.full !== 'authored-cloth' || d.detail?.compact !== 'native-simplified-soft-skin'))
        fail('soft detail policy is full authored-cloth and compact native-simplified-soft-skin');
    const races = Object.keys(FITS_BY_RACE), declared = Object.keys(d.fits ?? {});
    for (const race of races) if (!d.fits?.[race]) fail(`missing ${race} fit; refusing to fall back`);
    for (const race of declared) if (!races.includes(race)) fail(`unknown race ${race}`);
    for (const race of races) {
        const fit = d.fits[race];
        if (!DIRECTORY.test(fit.directory ?? '') || !MESH.test(fit.bodyMesh ?? '') || !relativePath(fit.source) || !HEX.test(fit.sha256 ?? ''))
            fail(`${race} fit needs directory, bodyMesh, source and sha256`);
        for (const key of ['body', 'rig', 'bind', 'shape'])
            if (fit.interface?.[key] !== FITS_BY_RACE[race][key]) fail(`${race} interface ${key} differs from the accepted fit`);
        if (soft && (!relativePath(fit.garment?.source) || fit.garment.source.startsWith('.cache')
            || !HEX.test(fit.garment?.sha256 ?? '') || !MESH.test(fit.garment?.mesh ?? '')))
            fail(`${race} soft fit needs a separately pinned tracked garment master and mesh`);
    }
    const s = d.humanShape;
    if (s !== undefined) {
        // The shape body is the tracked published gzip coverage source: the encoded file and the
        // decoded GLB are both pinned, and an untracked .cache candidate is never a shape input.
        if (s.family !== HUMAN_SHAPE_FAMILY || s.mode !== (soft ? 'trackBodyShape' : 'trackBodyRigid') || !relativePath(s.body?.source) || s.body.source.startsWith('.cache')
            || !HEX.test(s.body?.sha256 ?? '') || !HEX.test(s.body?.decodedSha256 ?? '') || s.body?.compression !== 'gzip'
            || !MESH.test(s.body?.bodyMesh ?? '')) fail(`humanShape needs family, ${soft ? 'trackBodyShape' : 'trackBodyRigid'} mode and a pinned tracked gzip shape body`);
    }
    return d;
}

/** Read one pinned file and refuse if it is missing or its sha256 differs. */
async function readPinned(label, file, expected, read) {
    let bytes;
    try { bytes = await read(file); } catch { throw Error(`Factory input missing: ${label} ${file}`); }
    if (sha256(bytes) !== expected) throw Error(`Factory input changed: ${label} ${file}; revise the descriptor explicitly`);
    return bytes;
}

/** The pinned Human shape body as decoded GLB bytes: encoded and decoded hashes both checked.
 * https://nodejs.org/api/zlib.html#zlibgunzipsyncbuffer-options */
export async function readPinnedShapeBody(d, read = fs.readFile) {
    const body = d.humanShape.body, encoded = await readPinned('human shape body', body.source, body.sha256, read);
    let decoded;
    try { decoded = gunzipSync(encoded); } catch (error) { throw Error(`Factory input undecodable: human shape body ${body.source}: ${error.message}`); }
    if (sha256(decoded) !== body.decodedSha256) throw Error(`Factory input changed: decoded human shape body ${body.source}`);
    return decoded;
}

/** Hash every pinned input before mutation. `read` is injectable for tests. */
export async function verifyPinnedInputs(d, races = Object.keys(FITS_BY_RACE), read = fs.readFile) {
    await readPinned('builder', d.builder.path, d.builder.sha256, read);
    for (const dependency of d.builder.dependencies ?? []) await readPinned('builder dependency', dependency.path, dependency.sha256, read);
    for (const race of races) {
        await readPinned(`${race} source`, d.fits[race].source, d.fits[race].sha256, read);
        if (d.schema === SOFT_FACTORY_SCHEMA) await readPinned(`${race} garment`, d.fits[race].garment.source, d.fits[race].garment.sha256, read);
    }
    if (d.humanShape && races.includes('human')) await readPinnedShapeBody(d, read);
}

/** Restore THAT accepted body's joint order, inverse binds, rest TRS and mesh frame after
 * Blender, exactly as the reviewed Warden compiler does, then mark explicit rigidity. */
export function restoreSourceFrame(root, base, d, bodyMesh) {
    if (root.listMeshes().length !== 1 || root.listMeshes()[0].getName() !== d.mesh)
        throw Error(`Authored plate must be exactly one mesh named ${d.mesh}`);
    normalizeHumanBind(root, base, d.mesh, bodyMesh);
    root.listSkins()[0].getInverseBindMatrices().setArray(base.listSkins()[0].getInverseBindMatrices().getArray().slice());
    const joints = new Map(base.listSkins()[0].listJoints().map((n) => [n.getName(), n]));
    const copyTRS = (target, source) => target.setTranslation(source.getTranslation()).setRotation(source.getRotation()).setScale(source.getScale());
    for (const n of root.listNodes()) if (joints.has(n.getName())) copyTRS(n, joints.get(n.getName()));
    for (const n of root.listNodes()) if (!n.getMesh() && !joints.has(n.getName())) {
        const matching = base.listNodes().find((b) => b.getName() === n.getName());
        if (matching) copyTRS(n, matching);
    }
    const frame = base.listNodes().find((n) => n.getMesh()?.getName() === bodyMesh);
    if (!frame) throw Error(`Accepted body lacks ${bodyMesh}`);
    for (const n of root.listNodes().filter((x) => x.getMesh())) n.setMatrix(frame.getWorldMatrix());
    for (const p of root.listMeshes()[0].listPrimitives()) p.setExtras({...p.getExtras(), deformation: d.deformation});
}

/** Reuse the Lector compiler's canonical triangle ordering for new soft items.
 * Native BMesh exports can permute equal triangles between isolated processes.
 * Cyclic rotation preserves winding; sorting keeps duplicate triangles and every
 * vertex/skin/UV stream. V1 plate serialization remains unchanged.
 * https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#primitiveindices
 */
export function canonicalizeFactoryTriangles(root) {
    for (const mesh of root.listMeshes()) for (const p of mesh.listPrimitives()) {
        const accessor = p.getIndices(), source = accessor.getArray(), triangles = [];
        for (let i = 0; i < source.length; i += 3) {
            const triangle = Array.from(source.subarray(i, i + 3)), start = triangle.indexOf(Math.min(...triangle));
            triangles.push(triangle.slice(start).concat(triangle.slice(0, start)));
        }
        triangles.sort((a,b) => a[0]-b[0] || a[1]-b[1] || a[2]-b[2]);
        accessor.setArray(new source.constructor(triangles.flat()));
    }
}

/** Soft clothing uses the existing four-influence glTF/native bind gate, separately
 * from v1's strict single-bone plate policy. Texture images are pinned after export;
 * a material factor alone cannot prove that the intended cloth survived Blender.
 * https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#skinned-mesh-attributes
 */
export function assertEquipmentPolicy(root, d, options = {}) {
    if (d.schema === FACTORY_SCHEMA) return assertPlatePolicy(root, d, options);
    if (d.schema !== SOFT_FACTORY_SCHEMA || d.deformation !== 'soft-skin') throw Error('Unsupported equipment policy');
    if (root.listAnimations().length) throw Error('Equipment must not carry animation clips');
    if (root.listMeshes().length !== 1 || root.listMeshes()[0].getName() !== d.mesh || root.listSkins().length !== 1)
        throw Error(`Soft garment must be one skinned mesh named ${d.mesh}`);
    const seen = new Set(); let vertices = 0, triangles = 0, blendedVertices = 0;
    for (const mesh of root.listMeshes()) for (const p of mesh.listPrimitives()) {
        const count = p.getAttribute('POSITION')?.getCount(), w = p.getAttribute('WEIGHTS_0'), j = p.getAttribute('JOINTS_0');
        if (p.getExtras().deformation !== 'soft-skin' || w?.getType() !== 'VEC4' || j?.getType() !== 'VEC4'
            || w.getCount() !== count || j.getCount() !== count || p.getAttribute('WEIGHTS_1') || p.getAttribute('JOINTS_1'))
            throw Error('Soft garment lacks four-influence skin streams');
        const weights = w.getArray(), joints = j.getArray();
        for (let i = 0; i < weights.length; i += 4) {
            let sum = 0, influences = 0;
            for (let k = 0; k < 4; k++) {
                if (!Number.isFinite(weights[i+k]) || weights[i+k] < 0 || !Number.isInteger(joints[i+k]) || joints[i+k] < 0 || joints[i+k] >= 65)
                    throw Error('Invalid soft garment weights');
                sum += weights[i+k]; if (weights[i+k] > 0) influences++;
            }
            if (Math.abs(sum - 1) > 2e-6) throw Error('Unnormalized soft garment weights');
            if (influences > 1) blendedVertices++;
        }
        if (options.allowShapeTargets ? p.listTargets().length !== 2 : p.listTargets().length) throw Error('Unexpected morph targets on soft garment');
        if (options.allowShapeTargets) {
            if (JSON.stringify(mesh.getExtras().targetNames) !== JSON.stringify(HUMAN_SHAPE_TARGETS)) throw Error('Human shape target names/order differ from the accepted family');
            for (const t of p.listTargets()) for (const semantic of ['POSITION','NORMAL']) {
                const a = t.getAttribute(semantic);
                if (a?.getType() !== 'VEC3' || a.getCount() !== count || !a.getArray().every(Number.isFinite)) throw Error(`Invalid Human shape ${semantic} stream`);
            }
        }
        const material = p.getMaterial(), policy = d.materials.find(m => m.name === material?.getName());
        if (!policy) throw Error('Undeclared soft garment material');
        seen.add(policy.name);
        const actual = [...material.getBaseColorFactor(), material.getMetallicFactor(), material.getRoughnessFactor()];
        if (actual.some((v,i) => !Number.isFinite(v) || Math.abs(v - [...policy.baseColor,policy.metallic,policy.roughness][i]) > 1e-6)
            || material.getDoubleSided() !== policy.doubleSided || material.getAlphaMode() !== policy.alphaMode
            || (material.getBaseColorTexture() ? sha256(material.getBaseColorTexture().getImage()) : null) !== policy.baseColorTextureSha256
            || material.getNormalTexture() || material.getOcclusionTexture() || material.getEmissiveTexture() || material.getMetallicRoughnessTexture()
            || material.getEmissiveFactor().some(v => v !== 0)) throw Error('Soft material/texture differs from its descriptor revision');
        vertices += count; triangles += p.getIndices().getCount() / 3;
    }
    if (seen.size !== d.materials.length || !blendedVertices) throw Error('Soft garment has unused materials or no blended skin');
    return {vertices, triangles, blendedVertices, materials: [...seen].sort()};
}

/** Policy gate on a candidate or read-back document: rigid single-bone weights on exactly the
 * declared bones, the declared material revision, no clips and (neutral) no morphs. */
export function assertPlatePolicy(root, d, {allowShapeTargets = false} = {}) {
    if (root.listAnimations().length) throw Error('Equipment must not carry animation clips');
    const skin = root.listSkins()[0];
    if (!skin) throw Error('Equipment plate is unskinned');
    const names = skin.listJoints().map((n) => n.getName()), allowed = new Set(d.rigidBones.map((b) => `mixamorig:${b}`)), seen = new Set();
    let vertices = 0, triangles = 0;
    for (const mesh of root.listMeshes()) for (const p of mesh.listPrimitives()) {
        const targets = p.listTargets().length;
        if (allowShapeTargets ? targets !== HUMAN_SHAPE_TARGETS.length : targets) throw Error(`Unexpected morph targets on ${mesh.getName()}`);
        if (allowShapeTargets) {
            if (JSON.stringify(mesh.getExtras().targetNames) !== JSON.stringify(HUMAN_SHAPE_TARGETS))
                throw Error('Human shape target names/order differ from the accepted family');
            const count = p.getAttribute('POSITION').getCount();
            for (const target of p.listTargets()) for (const semantic of ['POSITION', 'NORMAL']) {
                const attribute = target.getAttribute(semantic), values = attribute?.getArray();
                if (attribute?.getType() !== 'VEC3' || attribute.getCount() !== count || !values.every(Number.isFinite))
                    throw Error(`Invalid Human shape ${semantic} stream`);
                if (semantic === 'NORMAL' && values.some(v => v !== 0)) throw Error('Rigid Human plate normals must not deform');
            }
        }
        if (p.getExtras().deformation !== 'rigid-bone') throw Error('Missing explicit rigid deformation');
        const w = p.getAttribute('WEIGHTS_0')?.getArray(), j = p.getAttribute('JOINTS_0')?.getArray();
        if (!w || !j) throw Error('Plate lacks skin weights');
        for (let v = 0; v < w.length; v += 4) {
            const bone = names[j[v]];
            if (w[v] !== 1 || w[v + 1] !== 0 || w[v + 2] !== 0 || w[v + 3] !== 0 || !allowed.has(bone))
                throw Error(`${mesh.getName()} is not single-bone rigid on ${d.rigidBones.join('/')}`);
            seen.add(bone);
        }
        const material = p.getMaterial();
        const actual = material ? [...material.getBaseColorFactor(), material.getMetallicFactor(), material.getRoughnessFactor()] : [];
        const expected = [...d.material.baseColor, d.material.metallic, d.material.roughness];
        if (actual.length !== expected.length || actual.some((n, i) => Math.abs(n - expected[i]) > 1e-6))
            throw Error('Material differs from its descriptor revision');
        vertices += p.getAttribute('POSITION').getCount(); triangles += p.getIndices().getCount() / 3;
    }
    if (seen.size !== allowed.size) throw Error('A declared rigid bone carries no geometry');
    if (!retainFullStartupGeometry(root, {deformation: d.deformation})) throw Error('Compact policy would simplify a rigid plate');
    return {vertices, triangles, bones: [...seen].sort()};
}

/** GLB container framing, checked before parsing: glTF Transform reads a truncated BIN chunk
 * without complaint, so the header length and every chunk boundary are verified here.
 * https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#binary-gltf-layout */
export function assertGlbContainer(bytes) {
    const view = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (view.length < 20 || view.readUInt32LE(0) !== 0x46546c67 || view.readUInt32LE(4) !== 2 || view.readUInt32LE(8) !== view.length)
        throw Error('Unreadable factory artifact: GLB header length or magic is wrong');
    let offset = 12, chunk = 0;
    for (; offset < view.length; chunk++) {
        if (offset + 8 > view.length) throw Error('Unreadable factory artifact: truncated chunk header');
        const length = view.readUInt32LE(offset), type = view.readUInt32LE(offset + 4);
        if (length % 4 || offset + 8 + length > view.length) throw Error('Unreadable factory artifact: chunk exceeds the file');
        if (chunk === 0 && type !== 0x4e4f534a) throw Error('Unreadable factory artifact: first chunk is not JSON');
        offset += 8 + length;
    }
    if (offset !== view.length || chunk < 2) throw Error('Unreadable factory artifact: incomplete GLB chunks');
}

/** Independent read-back: framing, fresh parse of the written bytes, then the policy and the
 * existing native palette/bounds gate against the accepted body. Corrupt bytes fail here. */
export async function verifyWrittenPlate(io, bytes, baseRoot, d, bodyMesh) {
    let root;
    assertGlbContainer(bytes);
    try { root = (await io.readBinary(bytes)).getRoot(); } catch (error) { throw Error(`Unreadable factory artifact: ${error.message}`); }
    const policy = assertEquipmentPolicy(root, d);
    const bind = verifyFactoryEquipmentBind(root, baseRoot, bodyMesh);
    return {...policy, bind};
}

/** Reuse the existing offline Human shape transfer: trackBodyRigid keeps plates
 * unbent with zero normal deltas; trackBodyShape and recomputeNormals fit cloth.
 * Runtime still evaluates the same two native glTF morph targets before skinning.
 * https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#morph-targets */
export function addHumanShapeTargets(doc, shapeBodyRoot, shapeBodyMesh, {deformation = 'rigid-bone'} = {}) {
    if (!['soft-skin','rigid-bone'].includes(deformation)) throw Error('Unsupported Human shape deformation');
    const mesh = shapeBodyRoot.listMeshes().find((m) => m.getName() === shapeBodyMesh);
    const body = mesh?.listPrimitives()[0], names = mesh?.getExtras()?.targetNames;
    if (!body || !Array.isArray(names)) throw Error('Shape body lacks named targets');
    const bodyPositions = body.getAttribute('POSITION').getArray(), deltas = {};
    body.listTargets().forEach((t, i) => { deltas[names[i]] = t.getAttribute('POSITION').getArray(); });
    for (const name of HUMAN_SHAPE_TARGETS) if (!deltas[name]) throw Error(`Shape body has no '${name}' target`);
    const root = doc.getRoot(), buffer = root.listBuffers()[0], fits = {};
    for (const plate of root.listMeshes()) {
        for (const p of plate.listPrimitives()) {
            if (p.listTargets().length) throw Error('Plate already has morph targets');
            const positions = p.getAttribute('POSITION').getArray(), count = positions.length / 3;
            for (const name of HUMAN_SHAPE_TARGETS) {
                // Same fit and normal reconstruction as build-garment-shape-family;
                // all work is offline. Runtime continues using native Lite morphs.
                const soft = deformation === 'soft-skin';
                const result = soft ? trackBodyShape(positions, bodyPositions, deltas[name])
                    : trackBodyRigid(positions, bodyPositions, deltas[name],
                        {jointsArr: p.getAttribute('JOINTS_0').getArray(), weightsArr: p.getAttribute('WEIGHTS_0').getArray()});
                const delta = new Float32Array(count * 3), normalDelta = new Float32Array(count * 3);
                const normals = p.getAttribute('NORMAL').getArray();
                const shapedNormals = soft ? recomputeNormals(result.shaped, p.getIndices().getArray(), count) : normals;
                for (let i = 0; i < delta.length; i++) {delta[i] = result.shaped[i] - positions[i]; normalDelta[i] = shapedNormals[i] - normals[i];}
                p.addTarget(doc.createPrimitiveTarget(name)
                    .setAttribute('POSITION', doc.createAccessor(`${plate.getName()}_${name}_POSITION`).setType('VEC3').setArray(delta).setBuffer(buffer))
                    .setAttribute('NORMAL', doc.createAccessor(`${plate.getName()}_${name}_NORMAL`).setType('VEC3').setArray(normalDelta).setBuffer(buffer)));
                fits[name] = soft ? {moved: result.moved, maxDelta: result.maxDelta, meanDelta: result.meanDelta} : result.fits;
            }
        }
        plate.setWeights(HUMAN_SHAPE_TARGETS.map(() => 0));
        plate.setExtras({...(plate.getExtras() || {}), targetNames: [...HUMAN_SHAPE_TARGETS]});
    }
    return fits;
}

/** Deterministic publication plan: immutable content-addressed files, the canonical source
 * copy the shape pipeline reads, provenance, then manifests LAST. Nothing is written here. */
export function planPublication(d, builds, manifests, provenance) {
    const files = [], manifestWrites = [];
    for (const [race, build] of Object.entries(builds)) {
        const fit = d.fits[race], short = build.sha256.slice(0, 12), dir = `public/ashen-reach/${fit.directory}`;
        const url = `/ashen-reach/${fit.directory}/${d.id}-${short}.glb`;
        files.push({path: `${dir}/${d.id}-${short}.glb`, bytes: build.bytes}, {path: `${dir}/${d.id}.glb`, bytes: build.bytes});
        const manifest = structuredClone(manifests[race]);
        if (!manifest?.items) throw Error(`${race} manifest has no items`);
        manifest.items[d.id] = {url, bytes: build.bytes.length, sha256: build.sha256, meshes: [d.mesh], fit: FITS_BY_RACE[race]};
        manifestWrites.push({path: `${dir}/manifest.json`, bytes: Buffer.from(JSON.stringify(manifest, null, 2) + '\n')});
    }
    files.push({path: `public/ashen-reach/${d.id}-provenance.json`, bytes: Buffer.from(JSON.stringify(provenance, null, 2) + '\n')});
    return {files, manifests: manifestWrites};
}

/** Execute a plan: every file first, then each manifest by temp+rename. A failure before the
 * manifest phase leaves every advertised manifest untouched. `ops` is injectable for tests. */
export async function executePublication(plan, ops = {
    write: (p, b) => fs.writeFile(p, b), rename: (a, b) => fs.rename(a, b),
}) {
    for (const f of plan.files) await ops.write(f.path, f.bytes);
    for (const m of plan.manifests) { await ops.write(`${m.path}.factory-tmp`, m.bytes); await ops.rename(`${m.path}.factory-tmp`, m.path); }
}
