/** Diagnose whether the active Human's textured hair triangles have a usable
 * boundary for a separate, hairless scalp mesh. Read-only asset inspection.
 * glTF TEXCOORD_0 addresses the material's base color image:
 * https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#meshes
 */
import {NodeIO, VertexLayout} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {MeshoptDecoder, MeshoptEncoder} from 'meshoptimizer';
import sharp from 'sharp';
import fs from 'node:fs/promises';

await MeshoptDecoder.ready;
await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder});
const doc = await io.read('public/ashen-reach/equipment/body.glb');
const prim = doc.getRoot().listMeshes().find(m => m.getName() === 'HumanV1Body').listPrimitives()[0];
const pos = prim.getAttribute('POSITION').getArray();
const uv = prim.getAttribute('TEXCOORD_0').getArray();
const indices = prim.getIndices().getArray();
const image = prim.getMaterial().getBaseColorTexture().getImage();
const {data, info} = await sharp(image).removeAlpha().raw().toBuffer({resolveWithObject:true});
const rgb = v => {
    const x = Math.max(0, Math.min(info.width - 1, Math.floor(uv[v * 2] * info.width)));
    const y = Math.max(0, Math.min(info.height - 1, Math.floor((1 - uv[v * 2 + 1]) * info.height)));
    const i = (y * info.width + x) * 3;
    return [data[i], data[i + 1], data[i + 2]];
};
const Y = v => pos[v * 3 + 1];
const rows = [];
for (let y = 1.5; y < 1.8; y += .025) {
    const vs = Array.from({length: pos.length / 3}, (_, i) => i).filter(v => Y(v) >= y && Y(v) < y + .025);
    const dark = vs.filter(v => rgb(v).reduce((a, b) => a + b, 0) / 3 < 90);
    rows.push({y: +y.toFixed(3), count: vs.length, dark: dark.length,
        uvDark: dark.length ? [Math.min(...dark.map(v => uv[v * 2])), Math.max(...dark.map(v => uv[v * 2])),
            Math.min(...dark.map(v => uv[v * 2 + 1])), Math.max(...dark.map(v => uv[v * 2 + 1]))].map(v => +v.toFixed(3)) : null});
}
console.log(JSON.stringify({texture:[info.width, info.height],rows,faceSamples:[
    [0.18, 0.91], [0.16, 0.86], [0.17, 0.98], [0.05, 0.92], [0.52, 0.52],
].map(([u, v]) => {const x=Math.floor(u*info.width),y=Math.floor((1-v)*info.height),i=(y*info.width+x)*3;return {uv:[u,v],rgb:Array.from(data.slice(i,i+3))}})}, null, 2));
for (const lower of [1.55, 1.60, 1.63, 1.65, 1.67, 1.70]) {
    const vs=Array.from({length:pos.length/3},(_,i)=>i).filter(v=>Y(v)>=lower && Y(v)<lower+.03);
    const groups=[-1,-.075,-.025,.025,.075,1].slice(0,-1).map((z,i)=>{
        const subset=vs.filter(v=>pos[v*3+2]>=z&&pos[v*3+2]<[-1,-.075,-.025,.025,.075,1][i+1]);
        const dark=subset.filter(v=>rgb(v).reduce((a,b)=>a+b,0)/3<100);
        return {zFrom:z,count:subset.length,dark:dark.length};
    });
    console.log(JSON.stringify({height:lower,groups}));
}
const triCount=indices.length/3;
const pointKey=v=>[0,1,2].map(k=>Math.round(pos[v*3+k]*1e4)).join(',');
const linked=new Map();
const triangles=Array.from({length:triCount},(_,t)=>{
    const ids=Array.from(indices.slice(t*3,t*3+3));
    const centroid=[0,1,2].map(k=>ids.reduce((s,v)=>s+pos[v*3+k],0)/3);
    const rgbMean=ids.reduce((s,v)=>s+rgb(v).reduce((a,b)=>a+b,0)/3,0)/3;
    for(const v of ids){const key=pointKey(v);if(!linked.has(key))linked.set(key,[]);linked.get(key).push(t);}
    return {ids,centroid,rgbMean};
});
for(const threshold of [70,90,110,130]){
    const eligible=new Set(triangles.flatMap((x,t)=>x.centroid[1]>1.54&&x.rgbMean<threshold?[t]:[]));
    const components=[];
    while(eligible.size){const seed=eligible.values().next().value;eligible.delete(seed);const queue=[seed];
        for(let k=0;k<queue.length;k++)for(const v of triangles[queue[k]].ids)for(const next of linked.get(pointKey(v))){if(eligible.delete(next))queue.push(next);}
        components.push(queue);
    }
    components.sort((a,b)=>b.length-a.length);
    console.log(JSON.stringify({threshold,eligible:components.reduce((s,c)=>s+c.length,0),components:components.slice(0,6).map(c=>({faces:c.length,
        bounds:[0,1,2].map(k=>[Math.min(...c.map(t=>triangles[t].centroid[k])),Math.max(...c.map(t=>triangles[t].centroid[k]))].map(x=>+x.toFixed(3)))}))}));
}
const threshold=110;
const eligible=new Set(triangles.flatMap((x,t)=>x.centroid[1]>1.54&&x.rgbMean<threshold?[t]:[]));
const components=[];
while(eligible.size){const seed=eligible.values().next().value;eligible.delete(seed);const queue=[seed];
    for(let k=0;k<queue.length;k++)for(const v of triangles[queue[k]].ids)for(const next of linked.get(pointKey(v))){if(eligible.delete(next))queue.push(next);}
    components.push(queue);
}
components.sort((a,b)=>b.length-a.length);
const selected=new Set(components[0]);
const base=[],marked=[];
for(let t=0;t<triCount;t++)(selected.has(t)?marked:base).push(...triangles[t].ids);
const buffer=doc.getRoot().listBuffers()[0];
prim.setIndices(doc.createAccessor().setType('SCALAR').setArray(Uint32Array.from(base)).setBuffer(buffer));
const red=doc.createMaterial('HairClassifierRed').setBaseColorFactor([1,0,0,1])
    .setMetallicFactor(0).setRoughnessFactor(1).setDoubleSided(true);
const markedPrim=doc.createPrimitive().setIndices(doc.createAccessor().setType('SCALAR')
    .setArray(Uint32Array.from(marked)).setBuffer(buffer)).setMaterial(red);
for(const key of prim.listSemantics())markedPrim.setAttribute(key,prim.getAttribute(key));
doc.getRoot().listMeshes()[0].addPrimitive(markedPrim);
io.setVertexLayout(VertexLayout.SEPARATE);
const output='.cache/character-mmo/m006/scalp-classifier-110.glb';
await fs.writeFile(output,await io.writeBinary(doc));
console.log(JSON.stringify({diagnostic:output,selectedFaces:selected.size,baseFaces:base.length/3}));
