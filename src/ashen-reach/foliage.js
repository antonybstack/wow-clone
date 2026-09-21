/**
 * GPU-instanced foliage (FromSoftware / UE Landscape Grass pattern on Lite).
 *
 * One atlas, a few clump prototypes, a density field, then 8 m tiles streamed
 * around the player (near clumps + far cards, thinned with distance).
 * Vertex wind and player displacement live in the shader.
 */
import {
  createShaderMaterial,loadTexture2D,setShaderTexture,setShaderUniform,
  setThinInstances,setThinInstanceColors,setThinInstanceCount,
  enableThinInstanceDynamicDrawCount,
} from '@babylonjs/lite';
import {Batch,height,terrainNormal,rng,bakeLamp,add,sub} from './geometry.js';
import {ATMOS} from './atmosphere.js';

const ATLAS='/ashen-reach/foliage-atlas.png';
const cell=(cx,cy)=>{const s=.5,p=.014;return {u0:cx*s+p,v0:cy*s+p,u1:(cx+1)*s-p,v1:(cy+1)*s-p};};
const UV={meadow:cell(0,0),dry:cell(1,0),plant:cell(0,1),fern:cell(1,1)};

const OUT=`struct Out{@builtin(position) position:vec4<f32>,@location(0) p:vec3<f32>,@location(1) uv:vec2<f32>,@location(2) color:vec4<f32>,@location(3) normal:vec3<f32>,@location(4) lamp:f32};`;

async function createFoliageMaterial(engine){
 const tex=await loadTexture2D(engine,ATLAS,{invertY:false,srgb:false,mipMaps:true,minFilter:'linear',magFilter:'linear'});
 const mat=createShaderMaterial({
  name:'Ashen foliage',
  attributes:['position','normal','uv','color','uv2'],
  uniforms:['viewProjection','world','cameraPosition',
   {name:'time',type:'f32',defaultValue:0},
   {name:'playerPosition',type:'vec3<f32>',defaultValue:[0,0,0]},
   {name:'playerRadius',type:'f32',defaultValue:1.2},
   {name:'firePosition',type:'vec3<f32>',defaultValue:[0,0,0]},
   {name:'fireStrength',type:'f32',defaultValue:0},
   {name:'handFirePosition',type:'vec3<f32>',defaultValue:[0,0,0]},
   {name:'handFireStrength',type:'f32',defaultValue:0},
   {name:'lavaPosition',type:'vec3<f32>',defaultValue:[0,0,0]},
   {name:'lavaStrength',type:'f32',defaultValue:0},
  ],
  samplers:['albedo'],
  backFaceCulling:false,
  needAlphaTesting:true,
  vertexSource:`${OUT}
@vertex fn mainVertex(i:VertexInput)->Out{
 var o:Out;
 let instanceWorld=mat4x4<f32>(i.world0,i.world1,i.world2,i.world3);
 let finalWorld=shaderSystem.world*instanceWorld;
 var wp=(finalWorld*vec4<f32>(i.position,1.0)).xyz;
 let h=i.color.a;
 let gust=sin(shaderUniforms.time*1.12+wp.x*0.51+wp.z*0.39);
 let gust2=sin(shaderUniforms.time*0.34+wp.x*0.11-wp.z*0.17);
 let flutter=sin(shaderUniforms.time*6.8+wp.x*2.7+wp.z*2.1);
 let h2=h*h;
 wp.x+=(gust*0.17+gust2*0.11+flutter*0.028)*h2;
 wp.z+=(cos(shaderUniforms.time*0.88+wp.x*0.37)*0.12+flutter*0.02)*h2;
 let toP=wp.xz-shaderUniforms.playerPosition.xz;
 let pDist=length(toP);
 let reach=shaderUniforms.playerRadius;
 let push=h*smoothstep(reach,reach*0.12,pDist)*1.25;
 let dir=toP/max(pDist,0.001);
 wp.x+=dir.x*push;
 wp.z+=dir.y*push;
 wp.y-=push*0.22;
 o.position=shaderSystem.viewProjection*vec4<f32>(wp,1.0);
 o.p=wp;
 o.uv=i.uv;
 o.color=vec4<f32>(i.color.rgb*i.instanceColor.rgb,h);
 o.normal=normalize((finalWorld*vec4<f32>(i.normal,0.0)).xyz);
 o.lamp=i.instanceColor.a;
 return o;
}`,
  fragmentSource:`${OUT}
${ATMOS}
@fragment fn mainFragment(i:Out)->@location(0) vec4<f32>{
 var t=textureSample(albedo,albedoSampler,i.uv);
 let fade=smoothstep(46.0,58.0,distance(i.p,shaderSystem.cameraPosition));
 if(t.a<0.48+fade*0.22 || (t.r>0.88 && t.g<0.16)){discard;}
 // Blades are alpha-cut cards, so their authored normal is the card's, not the
 // plant's. Bending it toward vertical before shading keeps a clump reading as a
 // soft rounded mass under the key instead of as a row of flat billboards, and
 // the transmission term fakes the light that passes *through* a backlit leaf --
 // which, with the sun buried at the horizon, is most of what a grass field does
 // in the reference stills.
 let raw=normalize(i.normal+vec3<f32>(0.00001));
 let nn=normalize(i.normal+vec3<f32>(0.0,0.9,0.0)+vec3<f32>(0.00001));
 let trans=pow(max(-dot(raw,SUN_DIR),0.0),2.2);
 var light=shade(nn,i.p,shaderSystem.cameraPosition,0.92)+SUN_COLOR*trans*0.55;
 let lamp=i.lamp;
 var lampEff=lamp;
 if(lamp>1.4){lampEff=1.4+(1.0-exp(-(lamp-1.4)));}
 let lampColor=vec3<f32>(1.0,0.58,0.26);
 let fire=shaderUniforms.fireStrength/(1.0+pow(distance(i.p,shaderUniforms.firePosition)*0.85,2.0));
 let handFire=shaderUniforms.handFireStrength/(1.0+pow(distance(i.p,shaderUniforms.handFirePosition)*1.0,2.0));
 let lava=shaderUniforms.lavaStrength/(1.0+pow(distance(i.p,shaderUniforms.lavaPosition)*0.7,2.0));
 light=light+lampColor*lampEff+vec3<f32>(1.0,0.28,0.045)*(fire+handFire+lava);
 var c=t.rgb*i.color.rgb*light;
 let ng=smoothstep(40.0,55.0,i.p.z);
 c=mix(c,c*vec3<f32>(0.92,0.86,0.95),ng);
 c=aerial(c,i.p,shaderSystem.cameraPosition);
 return vec4<f32>(grade(c),1.0);
}`,
 });
 setShaderTexture(mat,'albedo',tex);
 return mat;
}

function commitProto(engine,scene,batch,material){
 const mesh=batch.commit(engine,scene,material,[]);
 if(!mesh)return null;
 mesh.pickable=false;
 return mesh;
}

function clumpCards(name,uvs,opt){
 const b=new Batch(name);
 const count=opt.cards,H=opt.height,W=opt.width,spread=opt.spread??0.12;
 for(let k=0;k<count;k++){
  const a=opt.cross?k*Math.PI/2:(k/count)*Math.PI+ (k%2)*0.13;
  const uv=uvs[k%uvs.length];
  const h=H*(opt.cross?1:0.78+(k%5)*0.05);
  const w=W*(opt.cross?1.05:0.84+(k%3)*0.07);
  const ox=Math.cos(a*2)*spread*(opt.cross?0:0.55);
  const oz=Math.sin(a*2)*spread*(opt.cross?0:0.55);
  const ca=Math.cos(a),sa=Math.sin(a);
  b.quad(
   [-ca*w+ox,0,-sa*w+oz],[ca*w+ox,0,sa*w+oz],[ca*w+ox,h,sa*w+oz],[-ca*w+ox,h,-sa*w+oz],
   [[uv.u0,uv.v1],[uv.u1,uv.v1],[uv.u1,uv.v0],[uv.u0,uv.v0]],
   [[1,1,1,0],[1,1,1,0],[1,1,1,1],[1,1,1,1]],
   [0,1,0],
  );
 }
 return b;
}

function brackenTuft(name,uv,lod){
 const b=new Batch(name);
 const fronds=lod?3:6, segs=lod?2:3, size=lod?1.05:0.92;
 for(let f=0;f<fronds;f++){
  const a=f*(Math.PI*2/fronds)+f*0.11, L=size*(0.75+(f%3)*0.08);
  const point=t=>[Math.cos(a)*L*t, L*(1.72*t-1.22*t*t)+0.02, Math.sin(a)*L*t];
  const side=[-Math.sin(a)*L*0.22,0,Math.cos(a)*L*0.22];
  for(let k=0;k<segs;k++){
   const t=k/segs,t1=(k+1)/segs,p=point(t),q=point(t1);
   const v0=uv.v1-(uv.v1-uv.v0)*t, v1=uv.v1-(uv.v1-uv.v0)*t1;
   b.quad(sub(p,side),add(p,side),add(q,side),sub(q,side),
    [[uv.u0,v0],[uv.u1,v0],[uv.u1,v1],[uv.u0,v1]],
    [[1,1,1,t],[1,1,1,t],[1,1,1,t1],[1,1,1,t1]],
    [0,1,0]);
  }
 }
 return b;
}

function writeMatrix(out,o,x,y,z,yaw,sx,sy,sz){
 const c=Math.cos(yaw),s=Math.sin(yaw);
 out[o]=c*sx; out[o+1]=0; out[o+2]=-s*sx; out[o+3]=0;
 out[o+4]=0; out[o+5]=sy; out[o+6]=0; out[o+7]=0;
 out[o+8]=s*sz; out[o+9]=0; out[o+10]=c*sz; out[o+11]=0;
 out[o+12]=x; out[o+13]=y; out[o+14]=z; out[o+15]=1;
}

function place(density,lights,opt){
 const roll=rng(opt.seed);
 const mats=[],cols=[];
 const {minX,maxX,minZ,maxZ,spacing,scale,yScale,tint,slopeMin=0.58,densityScale=1,sink=0.035,skip}=opt;
 for(let z=minZ;z<maxZ;z+=spacing){
  for(let x=minX;x<maxX;x+=spacing){
   const gx=x+roll()*spacing, gz=z+roll()*spacing;
   if(skip&&skip(gx,gz))continue;
   const d=density(gx,gz)*densityScale;
   if(d<=0.02||roll()>d)continue;
   const n=terrainNormal(gx,gz);
   if(n[1]<slopeMin)continue;
   const y=height(gx,gz)-sink;
   const yaw=roll()*Math.PI*2;
   const sy=(yScale[0]+roll()*(yScale[1]-yScale[0]));
   const sx=scale[0]+roll()*(scale[1]-scale[0]);
   writeMatrix(mats,mats.length,gx,y,gz,yaw,sx,sy,sx);
   const shade=tint[0]+roll()*(tint[1]-tint[0]);
   const dry=roll();
   const lamp=Math.min(1.85,bakeLamp(gx,y+0.45,gz,lights));
   cols.push(shade*(0.88+dry*0.16), shade, shade*(0.72+dry*0.08), lamp);
  }
 }
 return {
  count:mats.length/16,
  matrices:new Float32Array(mats),
  colors:new Float32Array(cols),
 };
}

const TILE=8, NEAR_R=15, FAR_R=28;

function bucketTiles(data){
 const map=new Map();
 for(let i=0;i<data.count;i++){
  const x=data.matrices[i*16+12], z=data.matrices[i*16+14];
  const tx=Math.floor(x/TILE), tz=Math.floor(z/TILE);
  const k=tx+tz*1024;
  let t=map.get(k);
  if(!t){t={cx:tx*TILE+TILE/2,cz:tz*TILE+TILE/2,idx:[]};map.set(k,t);}
  t.idx.push(i);
 }
 const tiles=[];
 for(const t of map.values()){
  const m=new Float32Array(t.idx.length*16), c=new Float32Array(t.idx.length*4);
  for(let j=0;j<t.idx.length;j++){
   const i=t.idx[j];
   m.set(data.matrices.subarray(i*16,i*16+16),j*16);
   c.set(data.colors.subarray(i*4,i*4+4),j*4);
  }
  tiles.push({cx:t.cx,cz:t.cz,count:t.idx.length,matrices:m,colors:c});
 }
 return tiles;
}

function makePool(near,far,tiles,maxNear,maxFar){
 const nM=new Float32Array(maxNear*16), nC=new Float32Array(maxNear*4);
 const fM=new Float32Array(maxFar*16), fC=new Float32Array(maxFar*4);
 setThinInstances(near,nM,maxNear);
 setThinInstances(far,fM,maxFar);
 setThinInstanceColors(near,nC);
 setThinInstanceColors(far,fC);
 setThinInstanceCount(near,0);
 setThinInstanceCount(far,0);
 enableThinInstanceDynamicDrawCount(near);
 enableThinInstanceDynamicDrawCount(far);
 return {near,far,tiles,nM,nC,fM,fC,maxNear,maxFar,nearCount:0,farCount:0};
}

function packPool(pool,cx,cz){
 const nearR2=NEAR_R*NEAR_R, farR2=FAR_R*FAR_R, tileR=(FAR_R+TILE)*(FAR_R+TILE);
 let ni=0, fi=0;
 for(const tile of pool.tiles){
  const tdx=tile.cx-cx, tdz=tile.cz-cz;
  if(tdx*tdx+tdz*tdz>tileR)continue;
  const m=tile.matrices, c=tile.colors;
  for(let i=0;i<tile.count;i++){
   const x=m[i*16+12], z=m[i*16+14];
   const d2=(x-cx)*(x-cx)+(z-cz)*(z-cz);
   if(d2>farR2)continue;
   if(d2<nearR2){
    if(ni>=pool.maxNear)continue;
    pool.nM.set(m.subarray(i*16,i*16+16),ni*16);
    pool.nC.set(c.subarray(i*4,i*4+4),ni*4);
    ni++;
   }else{
    const d=Math.sqrt(d2);
    const keep=1-Math.max(0,(d-NEAR_R)/(FAR_R-NEAR_R))*0.72;
    const h=Math.abs(Math.sin(x*12.9898+z*78.233)*43758.5453)%1;
    if(h>keep)continue;
    if(fi>=pool.maxFar)continue;
    pool.fM.set(m.subarray(i*16,i*16+16),fi*16);
    pool.fC.set(c.subarray(i*4,i*4+4),fi*4);
    fi++;
   }
  }
 }
 setThinInstanceCount(pool.near,ni);
 setThinInstanceCount(pool.far,fi);
 setThinInstanceColors(pool.near,pool.nC);
 setThinInstanceColors(pool.far,pool.fC);
 pool.nearCount=ni; pool.farCount=fi;
}

export async function createFoliage(engine,scene,{lights=[],density=()=>0,landmarks=[]}={}){
 const material=await createFoliageMaterial(engine);
 const grassNear=commitProto(engine,scene,clumpCards('Grass near',[UV.meadow,UV.meadow,UV.dry],{cards:3,height:0.74,width:0.26,spread:0.12}),material);
 const grassFar=commitProto(engine,scene,clumpCards('Grass far',[UV.meadow,UV.dry],{cards:2,height:0.84,width:0.36,spread:0,cross:true}),material);
 const plantNear=commitProto(engine,scene,clumpCards('Plant near',[UV.plant],{cards:3,height:0.55,width:0.36,spread:0.10}),material);
 const plantFar=commitProto(engine,scene,clumpCards('Plant far',[UV.plant],{cards:2,height:0.60,width:0.42,spread:0,cross:true}),material);
 const brackenNear=commitProto(engine,scene,brackenTuft('Bracken near',UV.fern,false),material);
 const brackenFar=commitProto(engine,scene,brackenTuft('Bracken far',UV.fern,true),material);

 const grassCore=place(density,lights,{seed:83861,minX:-38,maxX:38,minZ:-16,maxZ:146,spacing:0.36,scale:[0.85,1.25],yScale:[0.72,1.28],tint:[0.78,1.12],densityScale:1});
 const grassShoulder=place(density,lights,{seed:91011,minX:-88,maxX:88,minZ:-90,maxZ:160,spacing:0.62,scale:[0.9,1.3],yScale:[0.7,1.15],tint:[0.74,1.05],densityScale:0.85,skip:(x,z)=>x>-38&&x<38&&z>-16&&z<146});
 // The shoulder stopped dead at x=+-88 / z=160, and 10-ridge-west stands the camera at
 // x=-80: eight metres from the edge of every blade of grass in the world. Everything west
 // of the player was bare ground, which is why that frame measured 0.19 saturation and read
 // as an empty plane with a glow on it. This outer band is four times the spacing, so it is
 // moor rather than meadow and costs a fraction of the instances per square metre, but it
 // carries texture out to where the scattered woodland starts and closes the gap between
 // the two.
 const grassMoor=place(density,lights,{seed:31573,minX:-150,maxX:150,minZ:-150,maxZ:215,spacing:1.32,scale:[1.0,1.5],yScale:[0.62,1.05],tint:[0.66,0.94],densityScale:0.62,skip:(x,z)=>x>-88&&x<88&&z>-90&&z<160});
 const parts=[grassCore,grassShoulder,grassMoor];
 const grass={
  count:parts.reduce((a,p)=>a+p.count,0),
  matrices:new Float32Array(parts.reduce((a,p)=>a+p.matrices.length,0)),
  colors:new Float32Array(parts.reduce((a,p)=>a+p.colors.length,0)),
 };
 for(let i=0,m=0,c=0;i<parts.length;i++){
  grass.matrices.set(parts[i].matrices,m);m+=parts[i].matrices.length;
  grass.colors.set(parts[i].colors,c);c+=parts[i].colors.length;
 }

 const plants=place(density,lights,{seed:2711,minX:-40,maxX:40,minZ:-12,maxZ:144,spacing:1.55,scale:[0.9,1.45],yScale:[0.85,1.25],tint:[0.82,1.08],densityScale:0.22,sink:0.02,slopeMin:0.7});
 const bracken=place(density,lights,{seed:490,minX:-26,maxX:26,minZ:-12,maxZ:142,spacing:1.12,scale:[0.85,1.35],yScale:[0.8,1.2],tint:[0.85,1.12],densityScale:0.34,sink:0.02});

 if(landmarks.length){
  const extra=new Float32Array(landmarks.length*16);
  const extraC=new Float32Array(landmarks.length*4);
  for(let i=0;i<landmarks.length;i++){
   const L=landmarks[i];
   const y=height(L.x,L.z)-0.02;
   writeMatrix(extra,i*16,L.x,y,L.z,L.yaw??i*0.7,L.scale??1.2,L.scale??1.2,L.scale??1.2);
   extraC.set([1,1,1,Math.min(1.85,bakeLamp(L.x,y+0.5,L.z,lights))],i*4);
  }
  const mergedM=new Float32Array(bracken.matrices.length+extra.length);
  const mergedC=new Float32Array(bracken.colors.length+extraC.length);
  mergedM.set(bracken.matrices); mergedM.set(extra,bracken.matrices.length);
  mergedC.set(bracken.colors); mergedC.set(extraC,bracken.colors.length);
  bracken.matrices=mergedM; bracken.colors=mergedC; bracken.count+=landmarks.length;
 }

 const grassPool=makePool(grassNear,grassFar,bucketTiles(grass),8192,24576);
 const plantPool=makePool(plantNear,plantFar,bucketTiles(plants),512,768);
 const brackenPool=makePool(brackenNear,brackenFar,bucketTiles(bracken),768,1024);
 const pools=[grassPool,plantPool,brackenPool];
 packPool(grassPool,0,0);
 packPool(plantPool,0,0);
 packPool(brackenPool,0,0);

 const meshes=[grassNear,grassFar,plantNear,plantFar,brackenNear,brackenFar].filter(Boolean);
 const protoTris=meshes.reduce((n,m)=>(m._gpu?.indexCount??0)/3+n,0);
 let packedX=0, packedZ=0;
 return {
  meshes,material,pools,
  stats:{
   grass:grass.count,plants:plants.count,bracken:bracken.count,
   instances:grass.count+plants.count+bracken.count,
   drawnNear:grassPool.nearCount+plantPool.nearCount+brackenPool.nearCount,
   drawnFar:grassPool.farCount+plantPool.farCount+brackenPool.farCount,
   prototypeTriangles:protoTris,draws:meshes.length,
  },
  update(t,playerPos){
   setShaderUniform(material,'time',t);
   if(!playerPos)return;
   setShaderUniform(material,'playerPosition',[playerPos.x,playerPos.y,playerPos.z]);
   setShaderUniform(material,'playerRadius',1.55);
   const x=playerPos.x, z=playerPos.z;
   if((x-packedX)*(x-packedX)+(z-packedZ)*(z-packedZ)<4)return;
   packedX=x; packedZ=z;
   for(const pool of pools)packPool(pool,x,z);
   const s=this.stats;
   s.drawnNear=grassPool.nearCount+plantPool.nearCount+brackenPool.nearCount;
   s.drawnFar=grassPool.farCount+plantPool.farCount+brackenPool.farCount;
  },
 };
}
