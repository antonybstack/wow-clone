import {getCameraPosition,onSceneDispose,setMeshVisible} from '@babylonjs/lite';
import {Batch} from './geometry.js';
import {appendWoodlandTree} from './woodland.js';

export const WOODLAND_TILE_SIZE=128;
export const woodlandTileKey=(x,z)=>`${Math.floor(x/WOODLAND_TILE_SIZE)},${Math.floor(z/WOODLAND_TILE_SIZE)}`;
export function distanceToWoodlandBounds(p,b){
 return Math.hypot(Math.max(b.min[0]-p.x,0,p.x-b.max[0]),Math.max(b.min[1]-p.y,0,p.y-b.max[1]),Math.max(b.min[2]-p.z,0,p.z-b.max[2]));
}
export const woodlandDetail=(distance,previous)=>distance<100?'full':distance>140?'reduced':previous;

/** Build both representations once. Every tile always remains a shadow caster,
 * including tiles outside the main camera frustum. */
export function createWoodlandTiles(variants){
 const tiles=new Map(),reducedVariants=variants.map(v=>v.reduced);let disposed=false,revision=0,transitions=0;
 const api={meshes:[],tiles,add(tree){
  const key=woodlandTileKey(tree.x,tree.z);
  let tile=tiles.get(key);
  if(!tile){tile={key,full:new Batch(`Woodland ${key} full`),reduced:new Batch(`Woodland ${key} reduced`),bounds:{min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]},detail:'full',trees:0};tiles.set(key,tile);}
  const first=tile.full.p.length;
  appendWoodlandTree(tile.full,variants,tree);
  appendWoodlandTree(tile.reduced,reducedVariants,tree);
  for(let i=first;i<tile.full.p.length;i++){
   const axis=i%3;tile.bounds.min[axis]=Math.min(tile.bounds.min[axis],tile.full.p[i]);tile.bounds.max[axis]=Math.max(tile.bounds.max[axis],tile.full.p[i]);
  }
  // Include the nominal spatial tile as well as any branches crossing its edges.
  const [tx,tz]=key.split(',').map(Number);
  tile.bounds.min[0]=Math.min(tile.bounds.min[0],tx*128);tile.bounds.max[0]=Math.max(tile.bounds.max[0],(tx+1)*128);
  tile.bounds.min[2]=Math.min(tile.bounds.min[2],tz*128);tile.bounds.max[2]=Math.max(tile.bounds.max[2],(tz+1)*128);
  tile.trees++;
 },commit(engine,scene,material,lights){
  const camera=getCameraPosition(scene.camera);
  for(const tile of tiles.values()){
   tile.triangles={full:tile.full.idx.length/3,reduced:tile.reduced.idx.length/3};
   tile.full=tile.full.commit(engine,scene,material,lights);tile.reduced=tile.reduced.commit(engine,scene,material,lights);
   tile.detail=woodlandDetail(distanceToWoodlandBounds(camera,tile.bounds),'full');
   setMeshVisible(tile.full,tile.detail==='full');setMeshVisible(tile.reduced,tile.detail==='reduced');
   api.meshes.push(tile.full,tile.reduced);
  }
  onSceneDispose(scene,()=>{disposed=true;tiles.clear();api.meshes.length=0;});
  api.update=()=>{
   if(disposed)return;
   const camera=getCameraPosition(scene.camera);let candidate=null,priority=Infinity;
   for(const tile of tiles.values()){
    const distance=distanceToWoodlandBounds(camera,tile.bounds),next=woodlandDetail(distance,tile.detail);
    if(next===tile.detail)continue;
    const score=next==='full'?distance:10000-distance;
    if(score<priority){candidate={tile,next};priority=score;}
   }
   // A single transition per frame bounds visibility-bundle work; no geometry allocation.
   if(candidate){const {tile,next}=candidate;tile.detail=next;
    setMeshVisible(tile.full,next==='full');setMeshVisible(tile.reduced,next==='reduced');
    // Lite caches shadow maps by caster transform version, not visibility. Its
    // observable vector setter marks the unchanged matrix dirty via the public API.
    const p=tile.full.position;p.set(p.x,p.y,p.z);
    revision++;transitions++;
   }
  };
  return api.meshes;
 },update(){},get state(){return {disposed,revision,transitions,tiles:tiles.size,full:[...tiles.values()].filter(t=>t.detail==='full').length,triangles:[...tiles.values()].reduce((n,t)=>n+(t.triangles?.[t.detail]??0),0)};}};
 return api;
}
