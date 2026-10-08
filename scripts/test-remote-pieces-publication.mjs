/** The published remote-piece set is immutable, content-addressed and provenance-bound.
 * Pure file checks; no browser. The runtime contract is exercised live separately. */
import assert from 'node:assert/strict';import test from 'node:test';
import fs from 'node:fs/promises';import path from 'node:path';import {createHash} from 'node:crypto';
import {APPEARANCE_CATALOG_VERSION} from '../src/character/appearance/contract.js';
import {EQUIPMENT_ITEMS} from '../src/ashen-reach/equipment-catalog.js';

// Read the runtime's published-contract version from source rather than importing the
// renderer: it is browser-only and pulls the whole engine graph, which Node will not load.
// Parsing it still fails this suite if the runtime bumps the version without the publisher.
const rendererSource=await fs.readFile('src/character/remote-pieces/renderer.js','utf8');
const declared=/export const REMOTE_PIECES_PUBLISH_VERSION\s*=\s*(\d+)/.exec(rendererSource);
assert.ok(declared,'renderer no longer declares REMOTE_PIECES_PUBLISH_VERSION');
const REMOTE_PIECES_PUBLISH_VERSION=Number(declared[1]);

const DIR='public/ashen-reach/remote-pieces/v1';
const sha=b=>createHash('sha256').update(b).digest('hex');
const descriptor=JSON.parse(await fs.readFile(path.join(DIR,'prepared.json'),'utf8'));
const index=JSON.parse(await fs.readFile(path.join(DIR,'index.json'),'utf8'));
const lite=JSON.parse(await fs.readFile('node_modules/@babylonjs/lite/package.json','utf8')).version;

test('shared rigid resources are source-addressed and published before network support',async()=>{
 const expected=Object.fromEntries(Object.values(EQUIPMENT_ITEMS).filter(item=>item.asset).map(item=>[item.id,item.asset]));
 assert.deepEqual(descriptor.manifest.authoredProps,expected);
 assert.deepEqual(index.authoredProps,descriptor.published.authoredProps);
 for(const row of index.authoredProps) {
  const asset=expected[row.id];assert(asset,'Unknown authored prop publication');
  const bytes=await fs.readFile('public'+asset.url);assert.equal(bytes.length,asset.bytes);assert.equal(sha(bytes),asset.sha256);
  assert.equal(row.bytes,asset.bytes);assert.equal(row.sha256,asset.sha256);
 }
});

test('the published descriptor declares a version the runtime accepts',()=>{
    assert.equal(descriptor.candidateOnly,false);
    assert.equal(descriptor.manifest.candidateOnly,false);
    assert.equal(descriptor.published.version,REMOTE_PIECES_PUBLISH_VERSION);
    assert.match(descriptor.published.sourceCompilerSha256,/^[0-9a-f]{64}$/);
    assert.equal(descriptor.published.lite,lite);
    assert.equal(descriptor.published.catalogVersion,APPEARANCE_CATALOG_VERSION);
});

test('it pins the installed Lite and catalogue, not a remembered one',()=>{
    assert.equal(descriptor.lite,lite);
    assert.equal(descriptor.catalogVersion,APPEARANCE_CATALOG_VERSION);
    assert.equal(descriptor.manifest.lite,lite);
});

test('the native sweep found no bound escapes',()=>{
    assert.equal(descriptor.escaped,0);
    assert.ok(descriptor.points>0);
    for(const [race,data] of Object.entries(descriptor.races))
        for(const [id,piece] of Object.entries(data.pieces))
            assert.equal(piece.escaped,0,`${race}/${id} escaped its bounds`);
});

test('every published piece is content-addressed and matches its recorded hash',async()=>{
    let checked=0;
    for(const [race,data] of Object.entries(descriptor.manifest.races)){
        for(const [id,entry] of Object.entries(data.manifest.items)){
            assert.equal(entry.file,`${id}-${entry.sha256}.glb`,`${race}/${id} is not content-addressed`);
            const bytes=await fs.readFile(path.join(DIR,entry.file));
            assert.equal(bytes.byteLength,entry.bytes,`${race}/${id} byte length`);
            assert.equal(sha(bytes),entry.sha256,`${race}/${id} content hash`);
            // Bounds must belong to this exact hash, not an earlier build of the same piece.
            assert.equal(descriptor.races[race].pieces[id].sha256,entry.sha256,`${race}/${id} bounds hash`);
            checked++;
        }
    }
    assert.ok(checked>=45,`expected the full catalogue, checked ${checked}`);
});

test('the index agrees with the descriptor and the files on disk',async()=>{
    assert.equal(index.version,REMOTE_PIECES_PUBLISH_VERSION);
    assert.equal(index.sourceCompilerSha256,descriptor.published.sourceCompilerSha256);
    const onDisk=(await fs.readdir(DIR)).filter(f=>f.endsWith('.glb')).sort();
    const listed=[...new Set(index.pieces.map(p=>p.file))].sort();
    assert(listed.every(file=>onDisk.includes(file)),'published index points at missing files');
    // The publisher intentionally retains old immutable URLs for returning
    // clients. Every retained file must still match its own content address;
    // an unreferenced historical piece is not a stale current descriptor.
    for(const file of onDisk.filter(file=>!listed.includes(file))){
        const address=/-([a-f0-9]{64})\.glb$/.exec(file)?.[1];
        assert(address&&sha(await fs.readFile(`${DIR}/${file}`))===address,'invalid retained immutable piece');
    }
    assert.equal(index.totalBytes,index.pieces.reduce((n,p)=>n+p.bytes,0));
});

test('nothing stale: the descriptor names the compiler that is actually present',async()=>{
    const current=sha(await fs.readFile('scripts/character-assets/prepare-remote-pieces.mjs'));
    assert.equal(descriptor.published.sourceCompilerSha256,current,
        'published set was built by a different prepare-remote-pieces.mjs; re-prepare and re-publish');
    assert.equal(descriptor.manifest.compilerSha256,current);
    for(const data of Object.values(descriptor.manifest.races))assert.equal(sha(await fs.readFile(data.sourceManifest.path)),data.sourceManifest.sha256,'published source manifest changed; re-prepare and re-publish');
});
