/** Reproducible linear-data texture: OpenGL tangent normal RGB, roughness A. */
import sharp from 'sharp';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
const base='https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/rock_wall_08/rock_wall_08_';
const inputs=await Promise.all(['nor_gl','rough'].map(async kind=>{const url=`${base}${kind}_1k.jpg`;const r=await fetch(url);if(!r.ok)throw Error(`${url}: ${r.status}`);return {url,data:Buffer.from(await r.arrayBuffer())};}));
const normal=await sharp(inputs[0].data).resize(512,512).removeAlpha().raw().toBuffer();
const rough=await sharp(inputs[1].data).resize(512,512).greyscale().raw().toBuffer();
const packed=Buffer.alloc(512*512*4);
for(let i=0;i<rough.length;i++){
 const n=[0,1,2].map(c=>normal[i*3+c]/127.5-1),len=Math.hypot(...n)||1;
 for(let c=0;c<3;c++)packed[i*4+c]=Math.round((n[c]/len*.5+.5)*255);
 packed[i*4+3]=rough[i];
}
const out='public/ashen-reach/stone-detail.png';
await sharp(packed,{raw:{width:512,height:512,channels:4}}).png().toFile(out);
console.log(JSON.stringify({output:out,inputs:inputs.map(i=>({url:i.url,sha256:createHash('sha256').update(i.data).digest('hex')})),bytes:(await fs.stat(out)).size}));
