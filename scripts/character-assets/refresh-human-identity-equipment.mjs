/** Equipment-only publication reuses the already accepted identity bytes. It must
 * not require an ignored face audition or regenerate unchanged head/hood assets.
 * Candidate metadata passes the existing complete identity verifier before writes.
 * https://nodejs.org/api/fs.html#fspromisesrenameoldpath-newpath
 */
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {startupProvenance} from '../ashen-reach/startup-provenance.mjs';
import {verifyProductionHumanIdentities} from './verify-production-human-identities.mjs';
import {validateDescriptor, verifyPinnedInputs} from './equipment-factory-contract.mjs';
const descriptorPath = process.argv[2]; assert(descriptorPath, 'Factory descriptor required');
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
for (const entry of Object.values(index.presets)) {
    const manifest = entry.manifest;
    for (const tier of ['items', 'compactItems']) {
        const body = manifest[tier].body, hood = manifest[tier].graveweaverHood;
        accepted.push('public' + body.url, 'public' + hood.url);
        manifest[tier] = {...current[tier], body, graveweaverHood: hood};
    }
    const bytes = Buffer.from(JSON.stringify(manifest)), name = `manifest-${manifest.identity.preset}-${sha(bytes).slice(0, 12)}.json`;
    const url = `/ashen-reach/human-identity-v1/${name}`;
    Object.assign(entry, {url, bytes: bytes.length, sha256: sha(bytes)});
    staged.set(`${folder}/${name}`, bytes);
}
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
console.log(JSON.stringify({refreshed: Object.keys(index.presets), identityBinariesReused: true, ignoredAuditionsRequired: false}));
