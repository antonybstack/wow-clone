/** Shadow-tested single scattering in world space. See docs/shadowed-volumetric-fog-plan-2026-09-23.md. */
import {
 createRenderTarget,createEffectWrapper,createEffectRenderTask,
 setEffectTexture,setEffectUniforms,disposeEffectWrapper,getViewProjectionMatrix,mat4Invert,getCameraPosition,
} from '@babylonjs/lite';
import {SUN_DIR,SUN_COLOR,EXPOSURE,SATURATION,BLACK_LIFT} from './atmosphere.js';

import {SUN_SHADOW_WGSL} from './sun-shadows.js';
const MAP_SIZE=2048,STEPS=48,UNIFORM_BYTES=512;
const fogShadowWGSL=SUN_SHADOW_WGSL.replaceAll('shaderUniforms.','u.').replaceAll('shaderSystem.view','u.view').replaceAll('u.sunFarMatrix','u.lightVP').replace(/var light=0.0;[\s\S]*?return light\/9.0;/,'return textureSampleCompareLevel(sunCascades,sunCascadesSampler,uv,layer,q.z);');
const vec=a=>`vec3<f32>(${a.join(',')})`;
function triangleSunBlocker(meshes,origin){
 const [dx,dy,dz]=SUN_DIR;
 for(const mesh of meshes){
  const positions=mesh._cpuPositions,indices=mesh._cpuIndices,m=mesh.worldMatrix;
  if(!positions||!indices)continue;
  const at=index=>{
   const x=positions[index*3],y=positions[index*3+1],z=positions[index*3+2];
   return [m[0]*x+m[4]*y+m[8]*z+m[12],m[1]*x+m[5]*y+m[9]*z+m[13],m[2]*x+m[6]*y+m[10]*z+m[14]];
  };
  for(let i=0;i<indices.length;i+=3){
   const a=at(indices[i]),b=at(indices[i+1]),c=at(indices[i+2]);
   const e1=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],e2=[c[0]-a[0],c[1]-a[1],c[2]-a[2]];
   const px=dy*e2[2]-dz*e2[1],py=dz*e2[0]-dx*e2[2],pz=dx*e2[1]-dy*e2[0];
   const det=e1[0]*px+e1[1]*py+e1[2]*pz;if(Math.abs(det)<1e-8)continue;
   const tx=origin[0]-a[0],ty=origin[1]-a[1],tz=origin[2]-a[2];
   const u=(tx*px+ty*py+tz*pz)/det;if(u<0||u>1)continue;
   const qx=ty*e1[2]-tz*e1[1],qy=tz*e1[0]-tx*e1[2],qz=tx*e1[1]-ty*e1[0];
   const v=(dx*qx+dy*qy+dz*qz)/det;if(v<0||u+v>1)continue;
   const t=(e2[0]*qx+e2[1]*qy+e2[2]*qz)/det;
   if(t>0.25&&t<2200)return mesh.name;
  }
 }
 return null;
}
const COMMON=`
struct Params {
 invVP:mat4x4<f32>,lightVP:mat4x4<f32>,camera:vec4<f32>,sun:vec4<f32>,
 medium:vec4<f32>,options:vec4<f32>,screen:vec4<f32>,sunCascade0:mat4x4<f32>,sunCascade1:mat4x4<f32>,sunCascade2:mat4x4<f32>,view:mat4x4<f32>,sunSplits:vec4<f32>,sunLengths:vec4<f32>,sunShadowParams:vec4<f32>
};
@group(0) @binding(0) var<uniform> u:Params;
@group(0) @binding(1) var sceneDepth:texture_depth_2d;
fn worldAt(uv:vec2<f32>,depth:f32)->vec3<f32>{
 let p=u.invVP*vec4<f32>(uv.x*2.0-1.0,1.0-uv.y*2.0,depth,1.0);
 return p.xyz/p.w;
}
fn pixelAt(uv:vec2<f32>)->vec2<i32>{
 return clamp(vec2<i32>(uv*vec2<f32>(textureDimensions(sceneDepth))),vec2<i32>(0),vec2<i32>(textureDimensions(sceneDepth))-1);
}
fn distanceAt(uv:vec2<f32>)->f32{
 let depth=textureLoad(sceneDepth,pixelAt(uv),0);
 return length(worldAt(uv,depth)-u.camera.xyz);
}
`;
const INTEGRATE=`${COMMON}
@group(0) @binding(2) var sunFar:texture_depth_2d;
@group(0) @binding(3) var sunFarSampler:sampler_comparison;
@group(0) @binding(4) var sunCascades:texture_depth_2d_array;
@group(0) @binding(5) var sunCascadesSampler:sampler_comparison;
${fogShadowWGSL}
fn visibility(p:vec3<f32>)->f32{
 if(u.options.x<.5){return 1.0;}
 return sunVisibility(p,vec3<f32>(0.0));
}
fn density(p:vec3<f32>)->f32{
 let basin=smoothstep(60.0,145.0,p.z)*(1.0-smoothstep(520.0,760.0,p.z))
  *(1.0-smoothstep(350.0,620.0,abs(p.x)));
 let low=exp(-max(p.y-6.0,0.0)/u.medium.z);
 return u.medium.x*(0.12*exp(-max(p.y,0.0)/90.0)+basin*low);
}
@fragment fn effectFragment(@builtin(position) pixel:vec4<f32>)->@location(0) vec4<f32>{
 let uv=pixel.xy/ceil(u.screen.xy*0.5);
 let endpoint=worldAt(uv,textureLoad(sceneDepth,pixelAt(uv),0));
 let delta=endpoint-u.camera.xyz;
 let distance=min(length(delta),u.medium.w);
 let dir=normalize(delta);
 let ds=distance/${STEPS}.0;
 let jitter=fract(52.9829189*fract(dot(pixel.xy,vec2<f32>(0.06711056,0.00583715))));
 let g=0.65;
 let phase=(1.0-g*g)/(12.56637*pow(1.0+g*g-2.0*g*dot(dir,u.sun.xyz),1.5));
 var transmittance=1.0;
 var scatter=vec3<f32>(0.0);
 var litWeight=0.0;
 var totalWeight=0.0;
 for(var k=0u;k<${STEPS}u;k++){
  let t=(f32(k)+jitter)*ds;
  let p=u.camera.xyz+dir*t;
  let extinction=density(p);
  let absorption=1.0-exp(-extinction*ds);
  let weight=transmittance*absorption;
  let light=visibility(p);
  scatter+=weight*(vec3<f32>(0.17,0.19,0.26)+${vec(SUN_COLOR)}*u.medium.y*phase*light);
  litWeight+=weight*light;totalWeight+=weight;
  transmittance*=1.0-absorption;
 }
 if(u.options.y>0.5 && u.options.y<1.5){
  return vec4<f32>(vec3<f32>(litWeight/max(totalWeight,0.00001)),transmittance);
 }
 if(u.options.y>1.5){return vec4<f32>(vec3<f32>(1.0-transmittance),transmittance);}
 return vec4<f32>(scatter,transmittance);
}`;
const COMPOSITE=`${COMMON}
@group(0) @binding(2) var source:texture_2d<f32>;
@group(0) @binding(3) var volume:texture_2d<f32>;
fn encode(c:vec3<f32>)->vec3<f32>{
 let x=c*${EXPOSURE};
 var t=clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14),vec3<f32>(0.0),vec3<f32>(1.0));
 t+=${vec(BLACK_LIFT)}*(1.0-smoothstep(vec3<f32>(0.0),vec3<f32>(0.4),t));
 let l=dot(t,vec3<f32>(0.2126,0.7152,0.0722));
 return clamp(mix(vec3<f32>(l),t,${SATURATION}),vec3<f32>(0.0),vec3<f32>(1.0));
}
// Ashen's material shaders currently grade before post. Undo that shared grade
// for the extinction/scattering composite, then grade once. Clipped highlights
// cannot be recovered; limiting the inverse avoids unbounded white sky values.
fn decode(c:vec3<f32>)->vec3<f32>{
 let l=dot(c,vec3<f32>(0.2126,0.7152,0.0722));
 let graded=(c-vec3<f32>(l))/${SATURATION}+vec3<f32>(l);
 var y=graded;
 for(var n=0u;n<4u;n++){y=graded-${vec(BLACK_LIFT)}*(1.0-smoothstep(vec3<f32>(0.0),vec3<f32>(0.4),y));}
 y=clamp(y,vec3<f32>(0.0),vec3<f32>(0.985));
 let a=2.43*y-2.51;let b=0.59*y-0.03;
 return max((-b-sqrt(max(b*b-4.0*a*(0.14*y),vec3<f32>(0.0))))/(2.0*a*${EXPOSURE}),vec3<f32>(0.0));
}
@fragment fn effectFragment(@builtin(position) pixel:vec4<f32>)->@location(0) vec4<f32>{
 let uv=pixel.xy/u.screen.xy;
 let color=textureLoad(source,vec2<i32>(pixel.xy),0).rgb;
 if(u.options.w<0.5){return vec4<f32>(color,1.0);}
 let d=distanceAt(uv);
 let dims=vec2<i32>(textureDimensions(volume));
 let coord=uv*vec2<f32>(dims)-0.5;
 let base=vec2<i32>(floor(coord));let f=fract(coord);
 var sum=vec4<f32>(0.0);var weights=0.0;
 for(var y=0;y<2;y++){for(var x=0;x<2;x++){
  let p=clamp(base+vec2<i32>(x,y),vec2<i32>(0),dims-1);
  let sampleUV=(vec2<f32>(p)+0.5)/vec2<f32>(dims);
  let gap=abs(distanceAt(sampleUV)-d);
  let spatial=mix(1.0-f.x,f.x,f32(x))*mix(1.0-f.y,f.y,f32(y));
  let weight=max(spatial,0.001)*exp(-gap/max(1.5,d*0.025));
  sum+=textureLoad(volume,p,0)*weight;weights+=weight;
 }}
 let fog=sum/max(weights,0.000001);
 if(u.options.y>0.5){return vec4<f32>(fog.rgb,1.0);}
 // If every low-resolution neighbor is across an occlusion edge, preserve the
 // opaque foreground rather than borrowing the background's bright fog.
 if(weights<0.00001){return vec4<f32>(color,1.0);}
 return vec4<f32>(encode(decode(color)*fog.a+fog.rgb),1.0);
}`;

export function createVolumetricFog(engine,scene,sourceRT,sun,world,shadows,sourceColor=sourceRT){
 const sg=shadows.far,casters=shadows.casters;
 const halfSize={width:1,height:1};
 const fogRT=createRenderTarget({lbl:'sunlit-fog-half',format:'rgba16float',samples:1,size:halfSize});
 const output=createRenderTarget({lbl:'sunlit-fog-composite',format:engine.format,samples:1,size:engine});
 const binding=(name,binding,kind,extra={})=>({name,binding,kind,...extra});
 const common=[binding('params',0,'uniform',{uniformByteLength:UNIFORM_BYTES}),binding('depth',1,'texture',{textureSampleType:'depth'})];
 const integrate=createEffectWrapper(engine,{name:'Shadowed volume integration',fragmentWGSL:INTEGRATE,bindings:[...common,
  binding('shadow',2,'texture',{textureSampleType:'depth'}),binding('shadowSampler',3,'sampler',{samplerType:'comparison',textureBinding:'shadow'}),
 binding('cascades',4,'texture',{textureSampleType:'depth',viewDimension:'2d-array'}),binding('cascadeSampler',5,'sampler',{samplerType:'comparison',textureBinding:'cascades'})]});
 const composite=createEffectWrapper(engine,{name:'Depth-aware fog composite',fragmentWGSL:COMPOSITE,bindings:[...common,
  binding('source',2,'texture'),binding('volume',3,'texture')]});
 const fogTask=createEffectRenderTask({name:'shadowed-fog-integrate',effect:integrate,target:fogRT},engine,scene);
 const compositeTask=createEffectRenderTask({name:'shadowed-fog-composite',effect:composite,target:output},engine,scene);
 const state={enabled:true,shadows:true,debug:0,density:0.006,sunPower:3.4,height:48,maxDistance:850,steps:STEPS,mapSize:MAP_SIZE,casters:casters.length,shadowVersion:0};
 const uniforms=new Float32Array(UNIFORM_BYTES/4);
 // Lite currently exposes generator and render-target GPU views only through
 // these internal fields. Keep that small version-sensitive bridge here.
 if(!sg._depthTexture||!sg._lightMatrix)throw new Error('Lite shadow texture/matrix bridge changed');
 const shadowTexture={view:sg._depthTexture.createView(),sampler:sg._depthSampler,depth:true};
 setEffectTexture(integrate,'shadow',shadowTexture);setEffectTexture(integrate,'cascades',shadows.csmTexture);
 function update(){
  const inv=mat4Invert(getViewProjectionMatrix(scene.camera,sourceRT._width/sourceRT._height));
  if(!inv)return;
  const camera=getCameraPosition(scene.camera);
  uniforms.set(inv,0);uniforms.set(sg._lightMatrix,16);
  uniforms.set([camera.x,camera.y,camera.z,1],32);uniforms.set([...SUN_DIR,0],36);
  uniforms.set([state.density,state.sunPower,state.height,state.maxDistance],40);
  uniforms.set([+state.shadows,state.debug,0.00008,+state.enabled],44);
  uniforms.set([sourceRT._width,sourceRT._height,MAP_SIZE,0],48);
  uniforms.set(shadows.data.subarray(0,48),52);uniforms.set(shadows.view,100);
  uniforms.set(shadows.data.subarray(64,68),116);uniforms.set(shadows.data.subarray(68,72),120);
  uniforms.set([+shadows.state.enabled,1/MAP_SIZE,shadows.state.range,.1],124);
  setEffectUniforms(integrate,uniforms);setEffectUniforms(composite,uniforms);
  state.shadowVersion=sg._version;
 }
 const recordFog=fogTask.record.bind(fogTask),executeFog=fogTask.execute.bind(fogTask);
 fogTask.record=()=>{
  halfSize.width=Math.ceil(sourceRT._width/2);halfSize.height=Math.ceil(sourceRT._height/2);
  state.resolution=[sourceRT._width,sourceRT._height];state.integrationResolution=[halfSize.width,halfSize.height];
  const depth={view:sourceRT._depthTexture.createView({aspect:'depth-only'}),depth:true};
  setEffectTexture(integrate,'depth',depth);setEffectTexture(composite,'depth',depth);
  update();recordFog();
  setEffectTexture(composite,'source',{view:sourceColor._colorView});
  setEffectTexture(composite,'volume',{view:fogRT._colorView});
 };
 fogTask.execute=()=>{update();return executeFog();};
 const disposeFog=fogTask.dispose.bind(fogTask),disposeComposite=compositeTask.dispose.bind(compositeTask);
 fogTask.dispose=()=>{disposeFog();disposeEffectWrapper(integrate);};
 compositeTask.dispose=()=>{disposeComposite();disposeEffectWrapper(composite);};
 return {state,fogTask,compositeTask,output,shadowGenerator:sg,casters,
  setCasters(meshes){shadows.setFarCasters(meshes);state.casters=meshes.length;},
  get lightMatrix(){return Array.from(sg._lightMatrix);},
  async probeSun(points){
   // Independent triangle raycasts check the real light-space depth map; this
   // diagnostic runs only on demand, never in the gameplay frame loop.
   const device=engine._device;
   const data=new Float32Array(points.length*8);
   points.forEach((p,i)=>data.set([...p,1],i*8));
   const params=device.createBuffer({size:64,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});
   const samples=device.createBuffer({size:data.byteLength,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST});
   const read=device.createBuffer({size:data.byteLength,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST});
   try{
    device.queue.writeBuffer(params,0,sg._lightMatrix);device.queue.writeBuffer(samples,0,data);
    const module=device.createShaderModule({code:`
     struct Sample {p:vec4<f32>,result:vec4<f32>};
     @group(0) @binding(0) var<uniform> matrix:mat4x4<f32>;
     @group(0) @binding(1) var depth:texture_depth_2d;
     @group(0) @binding(2) var<storage,read_write> samples:array<Sample>;
     @compute @workgroup_size(64) fn probe(@builtin(global_invocation_id) id:vec3<u32>){
      if(id.x>=arrayLength(&samples)){return;}
      let q=matrix*samples[id.x].p;
      let uv=vec2<f32>(q.x*.5+.5,.5-q.y*.5);
      let p=clamp(vec2<i32>(uv*vec2<f32>(textureDimensions(depth))),vec2<i32>(0),vec2<i32>(textureDimensions(depth))-1);
      let z=textureLoad(depth,p,0);
      samples[id.x].result=vec4<f32>(select(0.0,1.0,q.z-0.00008<=z),q.z,z,1.0);
     }`});
    const pipeline=device.createComputePipeline({layout:'auto',compute:{module,entryPoint:'probe'}});
    const group=device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:[
     {binding:0,resource:{buffer:params}},{binding:1,resource:shadowTexture.view},{binding:2,resource:{buffer:samples}}]});
    const encoder=device.createCommandEncoder();const pass=encoder.beginComputePass();
    pass.setPipeline(pipeline);pass.setBindGroup(0,group);pass.dispatchWorkgroups(Math.ceil(points.length/64));pass.end();
    encoder.copyBufferToBuffer(samples,0,read,0,data.byteLength);device.queue.submit([encoder.finish()]);
    await read.mapAsync(GPUMapMode.READ);const values=new Float32Array(read.getMappedRange()).slice();read.unmap();
    return points.map((p,i)=>{
     const blocker=triangleSunBlocker(casters,p);
     return {point:p,gpuLit:values[i*8+4],cpuLit:!blocker,blocker,lightDepth:values[i*8+5],mapDepth:values[i*8+6]};
    });
   }finally{params.destroy();samples.destroy();read.destroy();}
  },
 };
}
