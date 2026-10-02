/** Candidate-only offline native swept bounds over independently verified pieces.
 * Do this before mounting/mirroring or runtime allocation, once per piece hash.
 * Native bone-contribution bounds include the convex single-axis morph envelope.
 * https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/packages/babylon-lite/src/mesh/compute-max-extents.ts
 * https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/packages/babylon-lite/src/picking/deformed-vertex.ts
 */
import {VERSION,loadGltf,getContainerMeshes,computeMaxExtents,computeDeformedPositionToRef,
 goToFrame,disposeMeshGpu,setMorphTargetWeights} from '@babylonjs/lite';
import {APPEARANCE_CATALOG_VERSION} from '../appearance/contract.js';
import {acquireRegionAsset,regionAssetCacheSnapshot} from '../region-crowd/asset-cache.js';
import {sceneLifetime} from '../../ashen-reach/scene-lifetime.js';
import {yieldToFrame} from '../../ashen-reach/frame-budget.js';

export async function prepareNativeRemotePieces(game,{root='/__remote_pieces__',signal=sceneLifetime(game.scene),onProgress=()=>{}}={}){
 const response=await fetch(`${root}/manifest.json`,{signal});if(!response.ok)throw Error('Remote piece candidate absent');
 const manifest=await response.json();
 if(VERSION!=='1.31.1'||manifest.schema!==1||manifest.lite!==VERSION||manifest.catalogVersion!==APPEARANCE_CATALOG_VERSION||manifest.candidateOnly!==true)throw Error('Remote preparation contract changed');
 const result={schema:1,lite:VERSION,catalogVersion:APPEARANCE_CATALOG_VERSION,candidateOnly:true,manifest,races:{},points:0,escaped:0};
 async function load(entry){
  if(entry.file!==`${entry.file.split('-')[0]}-${entry.sha256}.glb`||!entry.verification?.geometryExact||!entry.verification?.bindAndFramesExact||!entry.verification?.sourceCurvesExact)throw Error('Unverified remote piece');
  const lease=acquireRegionAsset(`${root}/${entry.file}`,entry.sha256,entry.bytes,signal);
  try{return await loadGltf(game.engine,await lease.promise);}finally{lease.release();}
 }
 for(const [race,data]of Object.entries(manifest.races)){
  const body=await load(data.manifest.items.body),bodyMeshes=getContainerMeshes(body),donor=bodyMeshes.find(m=>m.skeleton);
  if(!donor||donor.skeleton.boneCount!==65){for(const m of bodyMeshes)disposeMeshGpu(m);throw Error('Remote race palette absent');}
  const groups=body.animationGroups;
  if(groups.length!==57){for(const m of bodyMeshes)disposeMeshGpu(m);throw Error('Remote race lost source curves');}
  for(const g of groups)g.loopAnimation=false;
  const pieces={};
  try{
   for(const [id,entry]of Object.entries(data.manifest.items)){
    signal.throwIfAborted();const container=id==='body'?body:await load(entry),meshes=getContainerMeshes(container),owned=[];
    try{
     for(const m of meshes){
      if(Array.from(m.worldMatrix).some((v,i)=>Math.abs(v-(i%5===0?1:0))>1e-6))throw Error('Remote bounds require the verified identity mesh frame');
      if(id!=='body'){if(m.skeleton?.boneCount!==65)throw Error('Remote piece skin absent');owned.push([m,m.skeleton]);m.skeleton={...m.skeleton,boneMatrices:donor.skeleton.boneMatrices,boneTexture:donor.skeleton.boneTexture};}
     }
     const bounds=meshes.map(m=>({name:m.name,minimum:[Infinity,Infinity,Infinity],maximum:[-Infinity,-Infinity,-Infinity]}));
     for(const g of groups){
      const extents=computeMaxExtents(meshes,g,game.engine,1/(g.frameRate||60));
      goToFrame(g,g.duration*(g.frameRate||60),game.engine);const terminal=computeMaxExtents(meshes);
      for(let i=0;i<meshes.length;i++)for(let k=0;k<3;k++){
       bounds[i].minimum[k]=Math.min(bounds[i].minimum[k],extents[i].minimum[k],terminal[i].minimum[k])-.0001;
       bounds[i].maximum[k]=Math.max(bounds[i].maximum[k],extents[i].maximum[k],terminal[i].maximum[k])+.0001;
      }
      await yieldToFrame();signal.throwIfAborted();
     }
     // Independently inspect actual skinned vertices at five source phases,
     // including the terminal row, at each permitted single-axis endpoint.
     const p={x:0,y:0,z:0};let points=0,escaped=0;
     for(const weights of race==='human'?[[0,0],[.95,0],[0,.95]]:[[0,0]]){
      for(const m of meshes)if(m.morphTargets)setMorphTargetWeights(game.engine,m.morphTargets,weights);
      for(const g of groups)for(const fraction of [0,.25,.5,.75,1]){
       goToFrame(g,g.duration*(g.frameRate||60)*fraction,game.engine);
       for(let i=0;i<meshes.length;i++)for(let v=0;v<meshes[i]._cpuPositions.length/3;v++){
        computeDeformedPositionToRef(meshes[i],v,p);points++;if([p.x,p.y,p.z].some((x,k)=>x<bounds[i].minimum[k]||x>bounds[i].maximum[k]))escaped++;
       }
       await yieldToFrame();signal.throwIfAborted();
      }
     }
     if(escaped||bounds.some(b=>[...b.minimum,...b.maximum].some(v=>!Number.isFinite(v))))throw Error(`Remote swept bound escape: ${race}/${id}: ${escaped}`);
     pieces[id]={sha256:entry.sha256,bounds,points,escaped};result.points+=points;result.escaped+=escaped;onProgress({race,id,points,escaped});
    }finally{for(const [m,s]of owned)m.skeleton=s;if(id!=='body')for(const m of meshes)disposeMeshGpu(m);}
   }
   result.races[race]={pieces,clips:Object.fromEntries(groups.map(g=>[g.name,{fromRow:0,frameCount:Math.round(g.duration*(g.frameRate||60))+1,fps:g.frameRate||60,duration:g.duration}]))};
  }finally{for(const m of bodyMeshes)disposeMeshGpu(m);}
 }
 result.finalByteCache=regionAssetCacheSnapshot();return result;
}
