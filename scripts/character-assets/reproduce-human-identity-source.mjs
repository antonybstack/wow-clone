/** Rebuild the unreleased identity checkpoint without overwriting historical reports.
 * Blender's default process status can be zero after a Python exception. Always
 * use --python-exit-code and stop before consuming any downstream artifact.
 * https://docs.blender.org/manual/en/latest/advanced/command_line/arguments.html
 */
import fs from 'node:fs/promises';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
const dir='.cache/character-mmo/identity-v1';
await fs.mkdir(dir,{recursive:true});
const labels=process.argv.slice(2).length?process.argv.slice(2):['old','young','young-hair'];
assert(labels.length&&labels.every(s=>['old','young','old-hair','young-hair'].includes(s)));
async function run(command,args,extra={}){
 const child=spawn(command,args,{stdio:'inherit',env:{...process.env,...extra}});
 await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',(code,signal)=>code===0?resolve():reject(Error(`${command} failed: ${signal||code}`)));});
}
const node=(script,args=[],extra={})=>run(process.execPath,[`scripts/character-assets/${script}`, ...args],extra);
const blender=(script,args)=>run(process.env.ASHEN_BLENDER||'/Applications/Blender.app/Contents/MacOS/Blender',
 ['--background','--factory-startup','--python-exit-code','1','--python',`scripts/character-assets/${script}`,'--',...args]);
await run('python3',['scripts/character-assets/fetch-makehuman.py','--verify-only']);
await node('build-human-shape-family.mjs',[],{ASHEN_SHAPE_REPORT:`${dir}/canonical-body.json`});
for(const label of labels){
 const [age,hair]=label.split('-');
 await blender('build-human-identity-source.py',[age,...(hair?['hair']:[])]);
 await node('assemble-human-identity-source.mjs',[label,'grey']);
 await blender('bake-human-identity-atlas.py',[label]);
 await node('assemble-human-identity-source.mjs',[label,'painted']);
}
await node('check-human-identity-contract.mjs',labels);
// Clothing is prepared by reproduce-human-identity-review from the current
// published pack. Head authoring must not overwrite unrelated M005 caches or
// refit obsolete source clothing as a side effect.
console.log('Source checkpoint rebuilt. Live visual, fit, startup and performance acceptance remain separate gates.');
