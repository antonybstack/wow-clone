import {createPbrMaterial,createTransformNode,setParent} from '@babylonjs/lite';
import {Batch} from './geometry.js';

/** Small scene-owned mechanism, built once after safe region arrival. Native
 * parent TRS invalidation handles its motion; the static masonry bell stays put.
 * https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/packages/babylon-lite/src/scene/transform-node.ts
 * These decorative meshes are excluded from Ashen's explicit world/actor shadow
 * caster lists, so a moving clapper cannot leave a cached static shadow behind. */
export function createBellMechanism(engine,scene,anchor){
 const white=[1,1,1,1],rope=new Batch('Vaelmark bell rope'),metal=new Batch('Vaelmark bell clapper');
 rope.tube([0,0,0],[0,-3.38,0],.034,.034,white,6);
 // A thick wrapped grip and closed pull ring are visible at walking height.
 rope.tube([0,-3.0,0],[0,-3.35,0],.085,.085,white,8);
 for(let i=0;i<12;i++){const a=i/12*Math.PI*2,b=(i+1)/12*Math.PI*2;
  rope.tube([Math.cos(a)*.12,-3.53+Math.sin(a)*.12,0],[Math.cos(b)*.12,-3.53+Math.sin(b)*.12,0],.032,.032,white,5);}
 metal.tube([0,0,0],[0,-1.08,0],.042,.042,white,8);
 metal.tube([0,-1.08,0],[0,-1.31,0],.15,.18,white,10);
 const ropeRoot=createTransformNode('Vaelmark rope pivot',...anchor.ropePivot),clapperRoot=createTransformNode('Vaelmark clapper pivot',...anchor.clapperPivot);
 const materials=[createPbrMaterial({baseColorFactor:[.40,.30,.14,1],metallicFactor:0,roughnessFactor:.94}),
  createPbrMaterial({baseColorFactor:[.55,.34,.13,1],metallicFactor:.65,roughnessFactor:.48})];
 const meshes=[rope.commit(engine,scene,materials[0]),metal.commit(engine,scene,materials[1])];
 setParent(meshes[0],ropeRoot);setParent(meshes[1],clapperRoot);
 // setParent preserves world space. Our batch vertices are pivot-local, so reset
 // its compensation just as the existing hand-prop owner does.
 // https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/packages/babylon-lite/src/scene/scene-node.ts
 for(const mesh of meshes){mesh.position.set(0,0,0);mesh.rotationQuaternion.set(0,0,0,1);mesh.scaling.set(1,1,1);mesh.ashenNonCaster=true;}
 let time=0,active=false,rings=0;
 return {
  meshes,triangles:(rope.idx.length+metal.idx.length)/3,
  ring(){time=0;active=true;rings++;},
  update(dt){if(!active)return;time=Math.min(3.6,time+dt);const envelope=Math.max(0,1-time/3.6),angle=Math.sin(time*9)*.42*envelope;
   clapperRoot.rotationQuaternion.set(0,0,Math.sin(angle/2),Math.cos(angle/2));
   ropeRoot.position.y=anchor.ropePivot[1]-Math.sin(Math.min(1,time/.6)*Math.PI)*.22*envelope;
   if(time===3.6){active=false;clapperRoot.rotationQuaternion.set(0,0,0,1);ropeRoot.position.y=anchor.ropePivot[1];}},
  snapshot(){return {active,time,rings,angle:clapperRoot.rotationQuaternion.z,ropeY:ropeRoot.position.y};},
 };
}
