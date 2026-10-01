/** Publish the bounded M2 source family, with immutable bytes and explicit
 * recipe/runtime compatibility. This is a two-fit proof, not the item factory.
 * https://developers.cloudflare.com/pages/configuration/headers/
 */
import fs from 'node:fs/promises';import path from 'node:path';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const source='.cache/character-mmo/region-crowd',destination=process.argv[2]||'.cache/region-streaming-2026-10-01/published',hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const prepared=JSON.parse(await fs.readFile(`${source}/prepared.json`));assert(prepared.schema===1&&prepared.lite==='1.31.1'&&prepared.recipeVersion===2,'Run the pinned region preparation first');await fs.mkdir(destination,{recursive:true});const published=new Map();
async function copy(file,sha,bytes,extension){const data=await fs.readFile(path.join(source,file));assert.equal(hash(data),sha);assert.equal(data.length,bytes);const name=`${sha}.${extension}`;if(!published.has(name)){await fs.writeFile(path.join(destination,name),data);published.set(name,data.length);}return name;}
for(const variant of Object.values(prepared.manifest.variants))variant.file=await copy(variant.file,variant.sha256,variant.bytes,'glb');
for(const variant of Object.values(prepared.variants)){assert.equal(variant.escaped,0);for(const payload of variant.payloads)payload.file=await copy(payload.file,payload.sha256,payload.bytes,'bin');}
const bytes=Buffer.from(JSON.stringify(prepared)),sha256=hash(bytes),file=`${sha256}.json`;await fs.writeFile(path.join(destination,file),bytes);
const release={schema:1,lite:prepared.lite,recipeVersion:prepared.recipeVersion,prepared:{file,sha256,bytes:bytes.length},files:[...published].map(([file,bytes])=>({file,bytes})),scope:'Two neutral Human VAT fits plus exact supported build range; no arbitrary race/equipment fallback'};await fs.writeFile(path.join(destination,'manifest.json'),JSON.stringify(release,null,2));console.log(JSON.stringify({destination,...release,totalBytes:bytes.length+[...published.values()].reduce((a,b)=>a+b,0)}));
