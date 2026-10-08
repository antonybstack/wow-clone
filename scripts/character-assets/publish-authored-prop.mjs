/** Publish only a descriptor-verified native export at its catalogue content address.
 * Original sources remain in Blender; runtime owners share one immutable GLB.
 * https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#binary-gltf-layout
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {NodeIO,VertexLayout} from '@gltf-transform/core';
import {EQUIPMENT_ITEMS} from '../../src/ashen-reach/equipment-catalog.js';
import {sha256} from './equipment-factory-contract.mjs';
import {validatePropDescriptor,verifyAuthoredProp} from './prepare-authored-prop.mjs';
const SOURCES={bastionShield:'blender/characters/props/bastion-shield'};

export async function verifyPublishedAuthoredProps({readFile=fs.readFile}={}) {
  const rows=[];
  for(const item of Object.values(EQUIPMENT_ITEMS).filter(item=>item.asset)) {
    const source=SOURCES[item.id];assert(source,'Authored prop has no pinned source');
    const descriptor=validatePropDescriptor(JSON.parse(await readFile(source+'.json','utf8')));
    assert.equal(sha256(await readFile(descriptor.builder.path)),descriptor.builder.sha256,'Unpinned authored prop builder');
    const bytes=await readFile(source+'.glb');
    assert.equal(bytes.length,item.asset.bytes,'Authored prop byte count differs');
    assert.equal(sha256(bytes),item.asset.sha256,'Authored prop source differs from catalogue');
    const report=await verifyAuthoredProp(new NodeIO().setVertexLayout(VertexLayout.SEPARATE),bytes,descriptor);
    assert.deepEqual(item.asset.meshes,report.materialGroups.map(()=>descriptor.mesh),'Authored native mesh declaration differs');
    assert.deepEqual(await readFile('public'+item.asset.url),bytes,'Published authored prop differs from reviewed source');
    rows.push({id:item.id,url:item.asset.url,sha256:item.asset.sha256,bytes:bytes.length,triangles:report.triangles,draws:report.materialGroups.length});
  }
  return rows;
}

if(process.argv[1]&&path.resolve(process.argv[1])===new URL(import.meta.url).pathname) {
  for(const item of Object.values(EQUIPMENT_ITEMS).filter(item=>item.asset)) {
    const source=SOURCES[item.id];assert(source,'Authored prop has no pinned source');
    const descriptor=validatePropDescriptor(JSON.parse(await fs.readFile(source+'.json','utf8')));
    assert.equal(sha256(await fs.readFile(descriptor.builder.path)),descriptor.builder.sha256);
    const bytes=await fs.readFile(source+'.glb');
    assert.equal(sha256(bytes),item.asset.sha256);assert.equal(bytes.length,item.asset.bytes);
    await verifyAuthoredProp(new NodeIO().setVertexLayout(VertexLayout.SEPARATE),bytes,descriptor);
    const target='public'+item.asset.url;await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,bytes);
  }
  console.log(JSON.stringify(await verifyPublishedAuthoredProps()));
}
