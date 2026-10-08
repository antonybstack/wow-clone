import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {MeshoptDecoder,MeshoptEncoder} from 'meshoptimizer';
import {assertTriangleRotations} from './character-assets/triangle-index-contract.mjs';

await Promise.all([MeshoptEncoder.ready,MeshoptDecoder.ready]);
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder});
// Use the retained pre-encoding source. The already compressed public plate
// is idempotent under a second encode and would not expose the rotation.
const old=(await io.readBinary(await fs.readFile('blender/characters/wardrobe/sources/orc-wayfarerBoots-before-straps.glb'))).getRoot().listMeshes()[0].listPrimitives()[0].getIndices().getArray();

test('actual native Meshopt triangle encoding preserves ordered wound faces despite index rotations',()=>{
 const raw=new Uint8Array(old.buffer,old.byteOffset,old.byteLength),packed=MeshoptEncoder.encodeGltfBuffer(raw,old.length,old.BYTES_PER_ELEMENT,'TRIANGLES');
 const decoded=new Uint8Array(raw.length);MeshoptDecoder.decodeGltfBuffer(decoded,old.length,old.BYTES_PER_ELEMENT,packed,'TRIANGLES');
 const indices=new old.constructor(decoded.buffer);
 assertTriangleRotations(indices,old);
 assert(indices.some((v,i)=>v!==old[i]),'The retained Orc fixture must expose the actual codec rotation');
});

test('encoding allowance rejects reversed winding, swapped faces, changed vertices and dropped duplicates',()=>{
 const source=Uint16Array.from([0,1,2,3,4,5,0,1,2]);
 for(const bad of [[0,2,1,3,4,5,0,1,2],[3,4,5,0,1,2,0,1,2],[0,1,6,3,4,5,0,1,2],[0,1,2,3,4,5]])assert.throws(()=>assertTriangleRotations(Uint16Array.from(bad),source));
});
