/** Normalize the isolated native fitted hood before borrowing the actor palette.
 * https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#skins
 */
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {NodeIO,VertexLayout} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {normalizeHumanBind} from './normalize-human-bind.mjs';
const dir=process.env.ASHEN_IDENTITY_FIT_DIR||'.cache/character-mmo/identity-v1';
const fit=JSON.parse(await fs.readFile(`${dir}/hood-fit.json`,'utf8'));
assert.equal(createHash('sha256').update(await fs.readFile(`${dir}/hood-raw.glb`)).digest('hex'),fit.rawSha256,'Stale or failed hood export');
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).setVertexLayout(VertexLayout.SEPARATE);
const doc=await io.read(`${dir}/hood-raw.glb`),root=doc.getRoot();
const base=(await io.read('.cache/character-mmo/m004/human-shape-family-v1.glb')).getRoot();
normalizeHumanBind(root,base,'GraveweaverHood');
assert.equal(root.listMeshes().length,1);assert.equal(root.listSkins().length,1);
const mesh=root.listMeshes()[0];assert.equal(mesh.listPrimitives()[0].listTargets().length,2);
mesh.setWeights([0,0]);mesh.setExtras({...mesh.getExtras(),targetNames:['slender','stout']});
const bytes=await io.writeBinary(doc);
await fs.writeFile(`${dir}/hood.glb`,bytes);
assert(['young','old'].includes(fit.age));
await fs.writeFile(`${dir}/hood-${fit.age}.glb`,bytes);
await fs.writeFile(`${dir}/hood-${fit.age}-fit.json`,JSON.stringify({...fit,assembledSha256:createHash('sha256').update(bytes).digest('hex')},null,2));
const manifest=JSON.parse(await fs.readFile('.cache/character-mmo/m005/manifest.json','utf8'));
manifest.items.graveweaverHood.bytes=bytes.length;
manifest.items.graveweaverHood.sha256=createHash('sha256').update(bytes).digest('hex');
await fs.writeFile(`${dir}/hood-manifest.json`,JSON.stringify(manifest,null,2));
await fs.writeFile(`${dir}/hood-${fit.age}-manifest.json`,JSON.stringify(manifest,null,2));
console.log(JSON.stringify({bytes:bytes.length,sha256:manifest.items.graveweaverHood.sha256}));
