/** Manually imported M003 town reproduction. This module is never imported by
 * the shipped route. A single mounted VAT actor currently triggers the game's
 * custom CSM caster shader-composition error; preserve this isolated repro for
 * M009 rather than treating this helper as an accepted production renderer.
 * https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/src/vat/vat-baker.ts
 */
import {addToScene,attachVat,createVatBakeResults,disposeMeshGpu,getContainerMeshes,
  getViewMatrix,getViewProjectionMatrix,projectWorldToScreen,loadGltf,prepareVatMany,
  removeFromScene,setMeshVisible,setThinInstances} from '@babylonjs/lite';
import {decodeAppearance} from '../appearance/codec.js';
import {animationPhase,planCrowdBatches} from './batches.js';

export async function mountTownCrowd(game,{count=100,outfit='wayfarer',motion='walk',centerZ=120}={}) {
  if(!game?.engine||!game?.scene||!game?.world)throw Error('Expected a ready Ashen Reach game');
  if(!Number.isInteger(count)||count<1||count>300)throw RangeError('Town probe count must be 1–300');
  const manifestResponse=await fetch('/__crowd_probe__/manifest.json');
  if(!manifestResponse.ok)throw Error('Prepare the developer-only crowd assets first');
  const manifest=await manifestResponse.json(),variant=manifest.variants[outfit];
  if(!variant)throw Error(`Unknown town outfit ${outfit}`);
  const recipe=decodeAppearance(variant.recipe);
  const actors=Array.from({length:count},(_,i)=>({id:`town-${String(i).padStart(4,'0')}`,outfit,recipe}));
  const plan=planCrowdBatches(actors,manifest);
  const response=await fetch(`/__crowd_probe__/${variant.file}`);
  if(!response.ok)throw Error(`Town GLB HTTP ${response.status}`);
  const container=await loadGltf(game.engine,await response.arrayBuffer());
  let added=false;
  try {
    const meshes=getContainerMeshes(container).filter(mesh=>mesh.skeleton);
    const clips=(container.animationGroups||[]).filter(g=>['Idle_Loop','Walk_Loop'].includes(g.name));
    const prepared=prepareVatMany(meshes.map(mesh=>({mesh})),clips);
    const baked=createVatBakeResults(game.engine,prepared);
    let submittedPieces=0;
    const centers=[];
    for(let j=0;j<meshes.length;j++) {
      const mesh=meshes[j],handle=attachVat(game.engine,mesh,baked[j],'Idle_Loop');
      const batch=plan.batches.find(b=>b.mesh===mesh.name);
      if(!batch){setMeshVisible(mesh,false);continue;}
      const matrices=new Float32Array(count*16),params=new Float32Array(count*4);
      for(let i=0;i<count;i++) {
        const columns=Math.ceil(Math.sqrt(count)),row=Math.floor(i/columns),column=i%columns;
        const x=(column-(columns-1)/2)*1.8,z=centerZ+(row-(Math.ceil(count/columns)-1)/2)*1.8;
        const y=game.world.groundHeight(x,z),yaw=(i%7-3)*.13,c=Math.cos(yaw),s=Math.sin(yaw);
        if(j===0)centers.push({x,y:y+1,z});
        matrices.set([c,0,-s,0,0,1,0,0,s,0,c,0,x,y,z,1],i*16);
        const clip=handle.clips[motion==='walk'?'Walk_Loop':'Idle_Loop'];
        params.set([clip.fromRow,clip.fromRow+clip.frameCount-1,animationPhase(i),clip.fps],i*4);
      }
      setThinInstances(mesh,matrices,count);handle.setInstances(params);submittedPieces+=count;
    }
    // Suppress Lite's automatic glTF-group tick. VAT owns playback here.
    const groups=container.animationGroups;container.animationGroups=[];
    try {addToScene(game.scene,container);added=true;}finally{container.animationGroups=groups;}
    let disposed=false;
    return {count,outfit,submittedPieces,container,projectedActorCenters(){
      const canvas=game.engine._canvas||document.querySelector('canvas');
      const view=getViewMatrix(game.scene.camera),vp=getViewProjectionMatrix(game.scene.camera,canvas.width/canvas.height);
      const projection={viewport:{x:0,y:0,width:canvas.width,height:canvas.height},backingWidth:canvas.width,backingHeight:canvas.height};
      return centers.filter(p=>!projectWorldToScreen(p,view,vp,projection).offscreen).length;
    },dispose(){
      if(disposed)return;disposed=true;removeFromScene(game.scene,container);
    }};
  } catch(error) {
    if(added)removeFromScene(game.scene,container);
    else for(const mesh of getContainerMeshes(container))disposeMeshGpu(mesh);
    throw error;
  }
}
