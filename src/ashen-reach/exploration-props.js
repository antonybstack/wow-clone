import {createPbrMaterial,createTransformNode,setParent,setMeshVisible} from '@babylonjs/lite';
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

/** A scene-owned, decorative box on the memorial's unchanged solid cap. Native
 * TRS moves its hinge; native visibility hides the claimed remembrance. No mesh
 * rebuild, collision mutation, timer or extra shadow cache is needed.
 * https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/packages/babylon-lite/src/scene/visibility.ts */
export function createMemorialReliquary(engine,scene,anchor,phase){
 const white=[1,1,1,1],casework=new Batch('Vaelmark reliquary case'),lid=new Batch('Vaelmark reliquary lid'),relic=new Batch('Vaelmark remembrance');
 casework.box([0,.025,0],[1.7,.05,1.35],white);
 for(const x of [-.80,.80])casework.box([x,.16,0],[.10,.30,1.35],white);
 for(const z of [-.625,.625])casework.box([0,.16,z],[1.5,.30,.10],white);
 // Shallow framing and an original cross differentiate it from a plain crate.
 lid.box([0,.0375,-.675],[1.74,.075,1.39],white);
 for(const x of [-.78,.78])lid.box([x,.09,-.675],[.045,.04,1.22],white);
 for(const z of [-.09,-1.26])lid.box([0,.09,z],[1.56,.04,.045],white);
 lid.box([0,.105,-.675],[.075,.04,.72],white);
 lid.box([0,.105,-.77],[.43,.04,.07],white);
 // Upright bronze seal faces the west aisle where the interaction is reached.
 for(let i=0;i<16;i++){const a=i/16*Math.PI*2,b=(i+1)/16*Math.PI*2;
  relic.tube([0,.23+Math.cos(a)*.18,Math.sin(a)*.18],[0,.23+Math.cos(b)*.18,Math.sin(b)*.18],.022,.022,white,5);}
 relic.box([0,.23,0],[.055,.28,.045],white);relic.box([0,.28,0],[.055,.045,.18],white);
 const base=createTransformNode('Vaelmark reliquary base',...anchor.reliquaryBase),hinge=createTransformNode('Vaelmark reliquary hinge',...anchor.reliquaryHinge);
 const materials=[createPbrMaterial({baseColorFactor:[.14,.12,.085,1],metallicFactor:.15,roughnessFactor:.88}),
  createPbrMaterial({baseColorFactor:[.29,.23,.12,1],metallicFactor:.48,roughnessFactor:.70}),
  createPbrMaterial({baseColorFactor:[.62,.41,.13,1],metallicFactor:.62,roughnessFactor:.45})];
 const batches=[casework,lid,relic],meshes=batches.map((b,i)=>b.commit(engine,scene,materials[i]));
 for(const [i,m]of meshes.entries()){setParent(m,i===1?hinge:base);m.position.set(0,0,0);m.rotationQuaternion.set(0,0,0,1);m.scaling.set(1,1,1);m.ashenNonCaster=true;}
 let time=0,active=false,open=false,claimed=false;
 const pose=t=>{const angle=t*1.35;hinge.rotationQuaternion.set(Math.sin(angle/2),0,0,Math.cos(angle/2));};
 const settle=value=>{claimed=['relic-claimed','returned'].includes(value);open=claimed||value==='bell-rung';active=false;time=open?1.6:0;pose(open?1:0);setMeshVisible(meshes[2],open&&!claimed);};
 settle(phase);
 return {meshes,triangles:batches.reduce((n,b)=>n+b.idx.length/3,0),
  restore:settle,
  reveal(){if(open||active)return;time=0;active=true;setMeshVisible(meshes[2],false);},
  claim(){claimed=true;open=true;active=false;time=1.6;pose(1);setMeshVisible(meshes[2],false);},
  update(dt){if(!active)return;const before=time;time=Math.min(1.6,time+dt);const t=time/1.6;pose(t*t*(3-2*t));if(before<=.8&&time>.8)setMeshVisible(meshes[2],true);if(time===1.6){active=false;open=true;}},
  snapshot(){return {time,active,open,claimed,relicVisible:!claimed&&(open||active&&time>.8),angle:hinge.rotationQuaternion.x};},
 };
}
