// Extract original source finger samples; never rewrite the source animation assets.
import {NodeIO} from '@gltf-transform/core';import {writeFileSync} from 'node:fs';
const d=await new NodeIO().read('public/ashen-reach/wanderer-equipment.glb');const a=d.getRoot().listAnimations().find(a=>a.getName()==='Idle_Loop');
const out=a.listChannels().filter(c=>/Hand(Thumb|Index|Middle|Ring|Pinky)[123]$/.test(c.getTargetNode().getName())&&c.getTargetPath()==='rotation').map(c=>{const n=c.getTargetNode();return {name:n.getName(),position:n.getTranslation(),rest:n.getRotation(),closed:Array.from(c.getSampler().getOutput().getArray()).slice(0,4)};});
writeFileSync('src/character/runtime/source-hand-poses.json','[\n'+out.map(sample=>'  '+JSON.stringify(sample)).join(',\n')+'\n]\n');
