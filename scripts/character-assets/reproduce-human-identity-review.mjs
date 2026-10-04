/** Reproduce the connected source audition without writing production assets.
 * Reuse the pinned source pipeline, native Blender authoring and native glTF IO.
 * The source summary is an acceptance pin, never regenerated to make a pass.
 * https://docs.blender.org/manual/en/latest/advanced/command_line/arguments.html
 * https://gltf-transform.dev/modules/core/classes/NodeIO
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import assert from 'node:assert/strict';
import {NodeIO,VertexLayout} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {MeshoptDecoder} from 'meshoptimizer';
const flags=process.argv.slice(2);assert(flags.every(f=>f==='--reuse-source'));
const dir=path.resolve(process.env.ASHEN_IDENTITY_HOOD_DIR||'.cache/character-mmo/m5-face-2026-10-04');
await fs.mkdir(dir,{recursive:true});
const sha=b=>createHash('sha256').update(b).digest('hex');
async function run(command,args,extra={}){
 const child=spawn(command,args,{stdio:'inherit',env:{...process.env,...extra}});
 await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',(code,signal)=>code===0?resolve():reject(Error(`${command} failed: ${signal||code}`)));});
}
const node=(file,args=[],extra={})=>run(process.execPath,[`scripts/character-assets/${file}`,...args],extra);
if(!flags.includes('--reuse-source'))await node('reproduce-human-identity-source.mjs',['old','young','young-hair']);
const pins=JSON.parse(await fs.readFile(process.env.ASHEN_IDENTITY_SOURCE_SUMMARY||'docs/baselines/character-mmo/m5/face-2026-10-04/source-summary.json','utf8'));
for(const asset of pins.assets)assert.equal(sha(await fs.readFile(`.cache/character-mmo/identity-v1/human-${asset.label}-painted.glb`)),asset.sha256,`${asset.label}: source reproduction differs; inspect before recording a new pin`);
await node('check-human-identity-contract.mjs',['old','young','young-hair']);
const manifest=JSON.parse(await fs.readFile('public/ashen-reach/human-shape-v1/manifest.json','utf8'));
const descriptor=manifest.items.graveweaverHood;
const decoded=gunzipSync(await fs.readFile(`public${descriptor.url}`));
assert.equal(sha(decoded),descriptor.sha256,'Published hood source differs');
await MeshoptDecoder.ready;
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder}).setVertexLayout(VertexLayout.SEPARATE);
const doc=await io.readBinary(decoded);
for(const extension of doc.getRoot().listExtensionsUsed())if(extension.extensionName==='EXT_meshopt_compression')extension.dispose();
const hoodSource=path.join(dir,'current-hood.glb');
await fs.writeFile(hoodSource,await io.writeBinary(doc));
for(const age of ['old','young']){
 const output=path.join(dir,`hood-${age}`);
 const env={ASHEN_IDENTITY_FIT_DIR:output,ASHEN_IDENTITY_HOOD_SOURCE:hoodSource};
 await run(process.env.ASHEN_BLENDER||'/Applications/Blender.app/Contents/MacOS/Blender',
  ['--background','--factory-startup','--python-exit-code','1','--python','scripts/character-assets/fit-human-identity-hood.py','--',age],env);
 await node('assemble-human-identity-hood.mjs',[],env);
}
await node('prepare-human-identity-review.mjs');
console.log('Prepared DEV humanIdentity=old|young|young-hair. Saved identity and production release gates remain open.');
