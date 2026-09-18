import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {parseGlb,readAccessor} from '../src/character/runtime/glb.js';
const b=await readFile('public/characters/bodies/human-animated-v1.glb');
const {json,binary}=parseGlb(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength));
const animations=json.animations.map(a=>({...a,samplers:a.samplers.map(s=>({...s,input:Array.from(readAccessor(json,binary,s.input)),output:Array.from(readAccessor(json,binary,s.output))}))}));
await mkdir('.cache/armed-mage',{recursive:true});
await writeFile('.cache/armed-mage/source.json',JSON.stringify({sha256:createHash('sha256').update(b).digest('hex'),nodes:json.nodes,skins:json.skins,animations}));
