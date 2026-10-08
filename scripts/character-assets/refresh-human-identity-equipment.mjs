/** Equipment-only publication reuses the already accepted identity bytes. It must
 * not require an ignored face audition or regenerate unchanged head/hood assets.
 * Explicit --foot-coverage also repairs their reviewed index-only body mask.
 * Candidate metadata passes the existing complete identity verifier before writes.
 * https://nodejs.org/api/fs.html#fspromisesrenameoldpath-newpath
 */
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gzipSync,gunzipSync} from 'node:zlib';
import {NodeIO,VertexLayout} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {MeshoptDecoder,MeshoptEncoder} from 'meshoptimizer';
import {startupProvenance} from '../ashen-reach/startup-provenance.mjs';
import {verifyProductionHumanIdentities} from './verify-production-human-identities.mjs';
import {validateDescriptor, verifyPinnedInputs} from './equipment-factory-contract.mjs';
import {repairFootCoverage,restoreFootCoverageUnion} from './repair-foot-coverage.mjs';
import {verifyCoveragePartition} from './verify-coverage-partition.mjs';
import {identityGeometryHash,identityAnimationHash} from './human-identity-proof.mjs';
import {characterNormalProof,assertCharacterNormalProof} from './quantize-character-normals.mjs';
import {ASHEN_PLAYABLE_CLIP_NAMES} from '../../src/character/runtime/ashen-playable-motion.js';
const descriptorPath = process.argv[2]; assert(descriptorPath, 'Factory descriptor required');
const repairFeet=process.argv[3]==='--foot-coverage';
assert(process.argv.length<=4&&(process.argv[3]===undefined||repairFeet),'Use <descriptor> [--foot-coverage]');
const descriptor = validateDescriptor(JSON.parse(await fs.readFile(descriptorPath, 'utf8')));
await verifyPinnedInputs(descriptor);
assert(descriptor.humanShape, 'Equipment-only identity refresh requires the pinned accepted Human shape body');
const file = 'public/ashen-reach/human-identity-v1/manifest.json', folder = 'public/ashen-reach/human-identity-v1';
const current = JSON.parse(await fs.readFile('public/ashen-reach/human-shape-v1/manifest.json', 'utf8'));
const index = JSON.parse(await fs.readFile(file, 'utf8'));
assert.equal(current.items.body.coverageSource.sha256, descriptor.humanShape.body.decodedSha256,
    'Body changes require full identity preparation and visual acceptance');
assert.equal(index.fitId, current.fitId); assert.equal(index.shapeFamily, current.shapeFamily);
assert.deepEqual(index.targetNames, current.targetNames);
const sha = bytes => createHash('sha256').update(bytes).digest('hex'), staged = new Map(), accepted = [];
let io;
if(repairFeet){
    await Promise.all([MeshoptDecoder.ready,MeshoptEncoder.ready]);
    io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder,'meshopt.encoder':MeshoptEncoder}).setVertexLayout(VertexLayout.SEPARATE);
}
async function repairBody(asset){
    const encoded=await fs.readFile('public'+asset.url),bytes=asset.compression==='gzip'?gunzipSync(encoded):encoded;
    assert.equal(sha(bytes),asset.sha256,'Identity body source changed');
    const reference=await io.readBinary(bytes),doc=await io.readBinary(bytes);
    restoreFootCoverageUnion(reference,'human');
    const other=root=>identityGeometryHash({listMeshes:()=>root.listMeshes().filter(m=>!['HumanV1Body','HumanFootCore'].includes(m.getName()))});
    const beforeOther=other(doc.getRoot()),curves=identityAnimationHash(doc.getRoot());
    const result=repairFootCoverage(doc,'human');
    const written=await io.writeBinary(doc),actual=(await io.readBinary(written)).getRoot();
    result.verification=verifyCoveragePartition(reference.getRoot(),actual,'HumanV1Body','HumanFootCore');
    assert.equal(other(actual),beforeOther,'Foot mask changed torso, eyes, brows or hair');
    assert.equal(identityAnimationHash(actual),curves,'Foot mask changed source curves');
    const packed=asset.compression==='gzip'?gzipSync(written,{level:9}):written;
    const name=`body${asset.detail==='playable'?'-compact':''}-foot-v2-${sha(packed).slice(0,12)}.${asset.compression==='gzip'?'bin':'glb'}`;
    const url=`/ashen-reach/human-identity-v1/${name}`;
    staged.set(folder+'/'+name,packed);
    return {asset:{...asset,url,bytes:written.length,sha256:sha(written),...(asset.encodedBytes!==undefined?{encodedBytes:packed.length}:{}),geometrySha256:identityGeometryHash(actual),animationsSha256:curves},result,root:actual};
}
for (const entry of Object.values(index.presets)) {
    const manifest = entry.manifest;
    let fullBody;
    // Garment geosets belong to shared equipment, unlike the identity's body
    // partition. Refresh them with the pieces so switching heads cannot restore
    // trousers under a newly published coat. glTF visibility is per mesh:
    // https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#meshes
    manifest.garmentLayerCoverage = structuredClone(current.garmentLayerCoverage);
    for (const tier of ['items', 'compactItems']) {
        let body = manifest[tier].body;const hood = manifest[tier].graveweaverHood;
        if(repairFeet){
            const repaired=await repairBody(body);body=repaired.asset;
            if(tier==='items'){manifest.identity.footCoverage=repaired.result;fullBody=repaired.root;}
            else{
                // Reuse the normal-only proof on both repaired written bodies.
                // Positions, skin, morphs, face membership, textures and native
                // playable curves must still match before the provenance edge
                // names the new full geometry. No position rounding is allowed.
                const measured=assertCharacterNormalProof(characterNormalProof(fullBody,{animationNames:new Set(ASHEN_PLAYABLE_CLIP_NAMES)}),characterNormalProof(repaired.root),body.normalPacking.tolerance);
                body.normalPacking={...body.normalPacking,sourceGeometrySha256:manifest.items.body.geometrySha256,measuredMaxComponentError:measured.maxComponentError};
            }
        }
        accepted.push('public' + body.url, 'public' + hood.url);
        manifest[tier] = {...current[tier], body, graveweaverHood: hood};
    }
    if(repairFeet){manifest.identity.head.url=manifest.items.body.url;manifest.identity.hair.url=manifest.items.body.url;}
    const bytes = Buffer.from(JSON.stringify(manifest)), name = `manifest-${manifest.identity.preset}-${sha(bytes).slice(0, 12)}.json`;
    const url = `/ashen-reach/human-identity-v1/${name}`;
    Object.assign(entry, {url, bytes: bytes.length, sha256: sha(bytes)});
    staged.set(`${folder}/${name}`, bytes);
}
// Content-addressed bodies are harmless before their descriptors advertise them.
// Keep the stable index unchanged until full descriptor verification passes.
if(repairFeet)for(const [path,bytes]of staged)if(path.endsWith('.bin')||path.endsWith('.glb'))await fs.writeFile(path,bytes);
index.provenance = await startupProvenance([
    'scripts/character-assets/prepare-production-human-identities.mjs',
    'scripts/character-assets/quantize-character-normals.mjs',
    'scripts/character-assets/compact-normal-policy.mjs',
    'scripts/character-assets/human-identity-proof.mjs',
    'scripts/character-assets/refresh-human-identity-equipment.mjs',
], ['public/ashen-reach/human-shape-v1/manifest.json', descriptorPath, ...new Set(accepted),
    'docs/baselines/character-mmo/m5/face-2026-10-04/source-summary.json',
    'docs/baselines/character-mmo/m5/face-2026-10-04/preparation.json',
    'docs/baselines/character-mmo/m5/face-2026-10-04/hood-old-fit.json',
    'docs/baselines/character-mmo/m5/face-2026-10-04/hood-young-fit.json']);
const indexBytes = Buffer.from(JSON.stringify(index));
await verifyProductionHumanIdentities({readFile: async path => path === file ? indexBytes : staged.get(path) ?? fs.readFile(path)});
// Addressed descriptors first, stable index last. Retain old immutable descriptors
// for an already running client's outstanding requests.
for (const [path, bytes] of staged) await fs.writeFile(path, bytes);
await fs.writeFile(`${file}.refresh-tmp`, indexBytes); await fs.rename(`${file}.refresh-tmp`, file);
console.log(JSON.stringify({refreshed: Object.keys(index.presets), identityBinariesReused: !repairFeet, footCoverageRepaired:repairFeet, ignoredAuditionsRequired: false}));
