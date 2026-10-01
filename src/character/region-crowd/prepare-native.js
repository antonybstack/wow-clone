/** Developer preparation only; not imported by the gameplay route.
 * Reuse native animation evaluation and conservative swept bounds instead of
 * implementing a second skinning pipeline. Sample every stored VAT row, then
 * independently verify vertex containment with Lite's CPU deformer.
 * https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/packages/babylon-lite/src/mesh/compute-max-extents.ts
 * https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/packages/babylon-lite/src/vat/vat-baker.ts
 * https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/packages/babylon-lite/src/picking/deformed-vertex.ts
 */
import {VERSION,loadGltf,getContainerMeshes,prepareVatMany,computeMaxExtents,goToFrame,disposeMeshGpu,computeDeformedPositionToRef,setMorphTargetWeights} from '@babylonjs/lite';
import {APPEARANCE_SCHEMA_VERSION} from '../appearance/contract.js';
export async function prepare(game){
 const manifest=await (await fetch('/__region_crowd__/manifest.json')).json(),result={schema:1,lite:VERSION,recipeVersion:APPEARANCE_SCHEMA_VERSION,manifest,variants:{}};
 for(const [name,entry] of Object.entries(manifest.variants)){
  const c=await loadGltf(game.engine,await (await fetch(`/__region_crowd__/${entry.file}`)).arrayBuffer()),meshes=getContainerMeshes(c);
  try{
   // computeMaxExtents returns world-space bounds. These fitted GLBs must keep
   // identity mesh frames so those bounds are also valid prototype-local bounds.
   if(meshes.some(m=>Array.from(m.worldMatrix).some((v,i)=>Math.abs(v-(i%5===0?1:0))>1e-6)))throw Error('Region fitted mesh must have an identity source frame');
   // Action terminal rows must be clamped, not wrapped back to their start.
   const groups=c.animationGroups;for(const g of groups)g.loopAnimation=false;
   const minimums=meshes.map(()=>[Infinity,Infinity,Infinity]),maximums=meshes.map(()=>[-Infinity,-Infinity,-Infinity]);
   for(const g of groups){
    const extents=computeMaxExtents(meshes,g,game.engine,1/(g.frameRate||60));
    goToFrame(g,g.duration*(g.frameRate||60),game.engine);const terminal=computeMaxExtents(meshes);
    for(let i=0;i<meshes.length;i++)for(let k=0;k<3;k++){
     minimums[i][k]=Math.min(minimums[i][k],extents[i].minimum[k],terminal[i].minimum[k])-.0001;
     maximums[i][k]=Math.max(maximums[i][k],extents[i].maximum[k],terminal[i].maximum[k])+.0001;
    }
   }
   const prepared=prepareVatMany(meshes.map(mesh=>({mesh})),groups);
   // Validate every neutral source vertex at every baked row against the native
   // conservative bound; CPU deformer is only a verification control, not runtime skinning.
   let escaped=0,points=0;const p={x:0,y:0,z:0};
   for(const weights of [[0,0],[.95,0],[0,.95]]){
   for(const m of meshes)if(m.morphTargets)setMorphTargetWeights(game.engine,m.morphTargets,weights);
   for(const g of groups){const fps=g.frameRate||60,frames=Math.round(g.duration*fps)+1;
    for(let f=0;f<frames;f++){goToFrame(g,f,game.engine);for(let i=0;i<meshes.length;i++)for(let v=0;v<meshes[i]._cpuPositions.length/3;v++){
     computeDeformedPositionToRef(meshes[i],v,p);points++;
     if([p.x,p.y,p.z].some((x,k)=>x<minimums[i][k]||x>maximums[i][k]))escaped++;
    }}
   }
   }
   result.variants[name]={shapeControls:[[0,0],[.95,0],[0,.95]],sha256:entry.sha256,clips:Object.fromEntries(groups.map(g=>[g.name,{...prepared[0].clips[g.name],duration:g.duration}])),points,escaped,
    bounds:meshes.map((m,i)=>({name:m.name,minimum:minimums[i],maximum:maximums[i]})),
    payloads:prepared.map(p=>({...p,data:Array.from(p.data)}))};
  }finally{for(const m of meshes)disposeMeshGpu(m);}
 }
 return result;
}
