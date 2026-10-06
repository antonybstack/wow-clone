/** Descriptor-driven rigid equipment factory (M8): prepare, verify and (explicitly) publish.
 *
 *   node scripts/character-assets/equipment-factory.mjs <descriptor.json> --out .cache/<dir> [--races human,orc] [--repeat] [--publish]
 *
 * - Validates the whole descriptor and every pinned hash (builder, each race source, the Human
 *   shape body) BEFORE writing anything. A race missing from the descriptor is refused.
 * - Authors each race in an isolated pinned Blender process through the descriptor's builder
 *   (ASHEN_PLATE_SOURCE / OUT / BLEND / BODY_MESH, as build_warden_pauldrons.py already uses).
 * - Restores THAT source body's bind/frame, checks rigidity/material/no clips/no morphs, then
 *   re-reads the written bytes independently through the existing native bind gate.
 * - Optionally derives the Human slender/stout rigid targets with the existing girth field.
 * - --repeat (implied by --publish) rebuilds into a second isolated directory and requires
 *   byte-identical artifacts. --publish writes immutable files first and manifests last.
 * No hardcoded item ids: everything comes from the descriptor and the shared fit contract.
 * https://docs.blender.org/manual/en/latest/advanced/command_line/arguments.html
 * https://gltf-transform.dev/modules/core/classes/NodeIO
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn, execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {NodeIO, VertexLayout} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {MeshoptDecoder} from 'meshoptimizer';
import {FITS_BY_RACE} from '../../src/ashen-reach/equipment-contract.js';
import {verifyFactoryEquipmentBind} from './verify-factory-equipment-bind.mjs';
import {
    validateDescriptor, verifyPinnedInputs, restoreSourceFrame, assertPlatePolicy, verifyWrittenPlate,
    addHumanShapeTargets, planPublication, executePublication, readPinnedShapeBody, assertGlbContainer, sha256, PINNED_BLENDER, HUMAN_SHAPE_TARGETS,
} from './equipment-factory-contract.mjs';

const TOOL_SOURCES = ['scripts/character-assets/equipment-factory.mjs', 'scripts/character-assets/equipment-factory-contract.mjs',
    'scripts/character-assets/normalize-human-bind.mjs', 'scripts/character-assets/verify-factory-equipment-bind.mjs',
    'scripts/character-assets/girth-field.mjs', 'scripts/character-assets/startup-geometry-policy.mjs'];

export function parseArguments(argv) {
    const [descriptor, ...rest] = argv, options = {descriptor, races: Object.keys(FITS_BY_RACE), repeat: false, publish: false, out: null};
    for (let i = 0; i < rest.length; i++) {
        if (rest[i] === '--out') options.out = rest[++i];
        else if (rest[i] === '--races') options.races = (rest[++i] ?? '').split(',').filter(Boolean);
        else if (rest[i] === '--repeat') options.repeat = true;
        else if (rest[i] === '--publish') options.publish = options.repeat = true;
        else throw Error(`Unknown argument ${rest[i]}`);
    }
    if (!descriptor || !options.out) throw Error('Usage: equipment-factory.mjs <descriptor.json> --out .cache/<dir> [--races a,b] [--repeat] [--publish]');
    const relative = path.relative(path.resolve('.cache'), path.resolve(options.out));
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw Error('--out must be an isolated directory under .cache');
    if (options.races.some((r) => !FITS_BY_RACE[r]) || !options.races.length) throw Error('Unknown or empty --races');
    if (new Set(options.races).size !== options.races.length) throw Error('Duplicate --races');
    const all = Object.keys(FITS_BY_RACE);
    if (options.publish && (options.races.length !== all.length || !all.every((r) => options.races.includes(r)))) throw Error('--publish requires every race fit');
    return options;
}

async function runBlender(blender, d, race, work) {
    const fit = d.fits[race], raw = path.join(work, `${race}-raw.glb`);
    const child = spawn(blender, ['--background', '--factory-startup', '--python-exit-code', '1', '--python', d.builder.path], {
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 120000,
        env: {PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: process.env.TMPDIR,
            ASHEN_PLATE_SOURCE: fit.source, ASHEN_PLATE_OUT: raw, ASHEN_PLATE_BLEND: path.join(work, `${race}.blend`), ASHEN_PLATE_BODY_MESH: fit.bodyMesh},
    });
    let log = '';
    child.stdout.on('data', (b) => { log += b; }); child.stderr.on('data', (b) => { log += b; });
    await new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', (code, signal) => code === 0 ? resolve() : reject(Error(`${race} authoring failed: ${signal || code}\n${log.slice(-2000)}`))); });
    await fs.writeFile(path.join(work, `${race}-blender.log`), log);
    return raw;
}

/** One complete isolated build of every requested race. */
async function build(io, d, races, blender, work) {
    // Exclusive directory: a builder exiting successfully without writing can never
    // reuse a previous raw export and make --repeat report a false success.
    await fs.mkdir(path.dirname(work), {recursive: true});
    await fs.mkdir(work);
    const results = {};
    for (const race of races) {
        const fit = d.fits[race], base = (await io.read(fit.source)).getRoot();
        const doc = await io.read(await runBlender(blender, d, race, work)), root = doc.getRoot();
        restoreSourceFrame(root, base, d, fit.bodyMesh);
        assertPlatePolicy(root, d);
        const bytes = Buffer.from(await io.writeBinary(doc));
        const verification = await verifyWrittenPlate(io, bytes, base, d, fit.bodyMesh);
        await fs.writeFile(path.join(work, `${d.id}-${race}.glb`), bytes);
        let structure = null;
        if (d.structure) {
            structure = JSON.parse(await fs.readFile(path.join(work, `${race}-raw.structure.json`), 'utf8'));
            if (structure.item !== d.id || structure.mesh !== d.mesh || structure.source !== fit.source
                || structure.structure?.length !== d.rigidBones.length
                || d.rigidBones.some(bone => !structure.structure.some(row => row.bone === `mixamorig:${bone}`
                    && row.parts?.length === d.structure.partsPerBone
                    && row.parts.every(p => p.sourceFaces > 0 && p.closedLayerVertices > 0))))
                throw Error(`${race} structural report differs from the descriptor`);
        }
        results[race] = {bytes, sha256: sha256(bytes), verification, structure};
        if (race === 'human' && d.humanShape) {
            // Re-read and re-verify the pinned gzip shape body for each build, so build-2 proves the same input.
            const shapeDoc = await io.readBinary(bytes), shapeBody = (await io.readBinary(await readPinnedShapeBody(d))).getRoot();
            const fits = addHumanShapeTargets(shapeDoc, shapeBody, d.humanShape.body.bodyMesh);
            const shapeBytes = Buffer.from(await io.writeBinary(shapeDoc));
            assertGlbContainer(shapeBytes);
            const check = (await io.readBinary(shapeBytes)).getRoot();
            assertPlatePolicy(check, d, {allowShapeTargets: true});
            // Project the freshly parsed artifact to neutral only after validating its
            // exact target streams above. Reuse the stricter neutral bind/geometry gate;
            // removing targets here changes no published bytes, weights or base positions.
            for (const mesh of check.listMeshes()) for (const p of mesh.listPrimitives())
                for (const target of p.listTargets()) p.removeTarget(target);
            const bind = verifyFactoryEquipmentBind(check, base, fit.bodyMesh);
            await fs.writeFile(path.join(work, `${d.id}-human-shape.glb`), shapeBytes);
            results.humanShape = {bytes: shapeBytes, sha256: sha256(shapeBytes), targets: [...HUMAN_SHAPE_TARGETS], fits, bind};
        }
    }
    return results;
}

export async function main(argv = process.argv.slice(2)) {
    const options = parseArguments(argv);
    const descriptorBytes = await fs.readFile(options.descriptor), d = validateDescriptor(JSON.parse(descriptorBytes));
    await verifyPinnedInputs(d, options.races);
    const blender = process.env.ASHEN_BLENDER || '/Applications/Blender.app/Contents/MacOS/Blender';
    const blenderVersion = execFileSync(blender, ['--version'], {encoding: 'utf8'}).trim();
    if (!blenderVersion.startsWith(`Blender ${PINNED_BLENDER} `)) throw Error(`Factory requires pinned Blender ${PINNED_BLENDER}`);
    // Lossless separate vertex streams: Lite 1.31.1 morph loading ignores byteStride.
    await MeshoptDecoder.ready;
    const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder': MeshoptDecoder}).setVertexLayout(VertexLayout.SEPARATE);
    const first = await build(io, d, options.races, blender, path.join(options.out, 'build-1'));
    let repeated = null;
    if (options.repeat) {
        const second = await build(io, d, options.races, blender, path.join(options.out, 'build-2'));
        for (const key of Object.keys(first)) if (first[key].sha256 !== second[key]?.sha256) throw Error(`Rebuild is not byte-identical: ${key}`);
        repeated = true;
    }
    await verifyPinnedInputs(d, options.races); // nothing pinned may change while Blender ran
    const toolSources = await Promise.all([...TOOL_SOURCES, d.builder.path, ...(d.builder.dependencies ?? []).map((x) => x.path)].map(async (p) => ({path: p, sha256: sha256(await fs.readFile(p))})));
    const report = {
        schema: 1, item: d.id, mesh: d.mesh, slot: d.slot, layer: d.layer, occupies: d.occupies, deformation: d.deformation,
        descriptor: {path: options.descriptor, sha256: sha256(descriptorBytes)}, blender: PINNED_BLENDER,
        host: {platform: process.platform, arch: process.arch, blenderVersion}, toolSources,
        sourceRights: d.sourceRights, material: d.material, detail: d.detail, byteIdenticalRebuild: repeated,
        races: Object.fromEntries(options.races.map((r) => [r, {source: {path: d.fits[r].source, sha256: d.fits[r].sha256},
            interface: d.fits[r].interface, artifact: {sha256: first[r].sha256, bytes: first[r].bytes.length},
            structure: first[r].structure, ...first[r].verification}])),
        humanShape: first.humanShape ? {family: d.humanShape.family, sha256: first.humanShape.sha256, bytes: first.humanShape.bytes.length,
            targets: first.humanShape.targets, body: d.humanShape.body, bind: first.humanShape.bind} : null,
    };
    await fs.writeFile(path.join(options.out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
    if (options.publish) {
        const manifests = {};
        for (const race of options.races) manifests[race] = JSON.parse(await fs.readFile(`public/ashen-reach/${d.fits[race].directory}/manifest.json`, 'utf8'));
        const builds = Object.fromEntries(options.races.map((r) => [r, first[r]]));
        await executePublication(planPublication(d, builds, manifests, {...report, generatedBy: 'scripts/character-assets/equipment-factory.mjs'}));
    }
    console.log(JSON.stringify({item: d.id, races: options.races, byteIdenticalRebuild: repeated, racePacksPublished: options.publish,
        integrationRequired: options.publish ? ['prepare:human-shapes', 'prepare:human-identities', 'prepare:startup', 'coverage and native remote compilation', 'live acceptance and sealed Pages release'] : [],
        artifacts: Object.fromEntries(Object.entries(first).map(([k, v]) => [k, v.sha256.slice(0, 12)]))}));
    return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    main().catch((error) => { console.error(`Equipment factory refused: ${error.message}`); process.exit(1); });
}
