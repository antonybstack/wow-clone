/** Local art-study outfit. Preserves the original 65-joint bind and all source clips.
 * This is surface-assigned clothing for this POC, not the modular armor pipeline.
 */
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import fs from 'node:fs/promises';
import {prepareFireCast} from './prepare-fire-cast.mjs';
import {prepareLavaCast} from './prepare-lava-cast.mjs';
import {preparePyreCast} from './prepare-pyre-cast.mjs';
import {appendDirections} from './append-directions.mjs';
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc=await io.read('public/characters/candidates/human-source-v1.glb');
const root=doc.getRoot(),buffer=root.listBuffers()[0];
const texture=doc.createTexture('Rough undyed cloth').setImage(await fs.readFile('public/tex/wool_grey/diff.jpg')).setMimeType('image/jpeg');
const cloth=doc.createMaterial('Charcoal trousers').setBaseColorTexture(texture).setBaseColorFactor([.30,.34,.31,1]).setMetallicFactor(0).setRoughnessFactor(1);
cloth.getBaseColorTextureInfo().setMagFilter(9728).setMinFilter(9984);
const leather=doc.createMaterial('Worn dark leather').setBaseColorFactor([.095,.072,.049,1]).setMetallicFactor(0).setRoughnessFactor(1);
const mesh=root.listMeshes().find(m=>m.getName()==='HumanBody');
const original=mesh.listPrimitives()[0],pos=original.getAttribute('POSITION'),idx=original.getIndices().getArray(),p=pos.getArray();
const groups=[[],[],[]];
for(let k=0;k<idx.length;k+=3){const v=[idx[k],idx[k+1],idx[k+2]],x=v.reduce((s,i)=>s+p[i*3],0)/3,y=v.reduce((s,i)=>s+p[i*3+1],0)/3;let part=y<.91?1:0;if(y<.31||(y>.89&&y<.975)||(Math.abs(x)>.64&&Math.abs(x)<.78))part=2;groups[part].push(...v);}
const uv=new Float32Array(pos.getCount()*2);for(let i=0;i<pos.getCount();i++){uv[i*2]=p[i*3]*6;uv[i*2+1]=p[i*3+1]*6;}
const textileUV=doc.createAccessor('Woven cloth UV').setType('VEC2').setArray(uv).setBuffer(buffer);
mesh.removePrimitive(original);
for(let i=0;i<3;i++){const primitive=doc.createPrimitive().setMaterial([original.getMaterial(),cloth,leather][i]);for(const semantic of original.listSemantics())primitive.setAttribute(semantic,original.getAttribute(semantic));if(i===1)primitive.setAttribute('TEXCOORD_0',textileUV);primitive.setIndices(doc.createAccessor(`Wanderer part ${i}`).setType('SCALAR').setArray(new Uint32Array(groups[i])).setBuffer(buffer));mesh.addPrimitive(primitive);}
for(const node of root.listNodes())if(node.getMesh()?.getName()==='HumanShorts')node.setMesh(null);
await io.write('public/ashen-reach/wanderer.glb',doc);
console.log(JSON.stringify({clips:root.listAnimations().length,joints:root.listSkins()[0].listJoints().length,triangles:groups.map(g=>g.length/3)}));
await appendDirections();

await prepareFireCast();
await prepareLavaCast();
await preparePyreCast();
