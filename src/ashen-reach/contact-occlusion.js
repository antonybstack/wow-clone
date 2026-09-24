/** Short visible-depth contact and ambient occlusion, composed before distant fog.
 * See docs/contact-occlusion-plan-2026-09-24.md. No history blending in this slice. */
import {
 createRenderTarget,createEffectWrapper,createEffectRenderTask,createScreenSpaceContactShadowsPostProcessTask,
 setEffectTexture,setEffectUniforms,disposeEffectWrapper,getViewProjectionMatrix,mat4Invert,getCameraPosition,
} from '@babylonjs/lite';
import {SUN_DIR} from './atmosphere.js';

const BYTES=192;
const COMMON=`
struct Params {invVP:mat4x4<f32>,vp:mat4x4<f32>,camera:vec4<f32>,ao:vec4<f32>,screen:vec4<f32>,options:vec4<f32>};
@group(0) @binding(0) var<uniform> u:Params;
@group(0) @binding(1) var depthMap:texture_depth_2d;
fn coord(uv:vec2<f32>)->vec2<i32>{return clamp(vec2<i32>(uv*u.screen.xy),vec2<i32>(0),vec2<i32>(u.screen.xy)-1);}
fn uvAt(p:vec2<i32>)->vec2<f32>{return (vec2<f32>(p)+.5)/u.screen.xy;}
fn world(p:vec2<i32>)->vec3<f32>{
 let uv=uvAt(p);let q=u.invVP*vec4<f32>(uv.x*2.0-1.0,1.0-uv.y*2.0,textureLoad(depthMap,p,0),1.0);
 return q.xyz/q.w;
}
fn normalAt(p:vec2<i32>,center:vec3<f32>)->vec3<f32>{
 let hi=vec2<i32>(u.screen.xy)-1;
 let l=world(clamp(p-vec2<i32>(1,0),vec2<i32>(0),hi));let r=world(clamp(p+vec2<i32>(1,0),vec2<i32>(0),hi));
 let t=world(clamp(p-vec2<i32>(0,1),vec2<i32>(0),hi));let b=world(clamp(p+vec2<i32>(0,1),vec2<i32>(0),hi));
 var dx=select(center-l,r-center,length(r-center)<length(center-l));
 var dy=select(center-t,b-center,length(b-center)<length(center-t));
 if(p.x==0){dx=r-center;}else if(p.x==hi.x){dx=center-l;}
 if(p.y==0){dy=b-center;}else if(p.y==hi.y){dy=center-t;}
 var n=cross(dx,dy);if(dot(n,u.camera.xyz-center)<0.0){n=-n;}
 return n/max(length(n),.000001);
}
`;
const AO=`${COMMON}
@fragment fn effectFragment(@builtin(position) pixel:vec4<f32>)->@location(0) vec4<f32>{
 let p=coord(pixel.xy/ceil(u.screen.xy*.5));
 if(u.options.x<.5 || textureLoad(depthMap,p,0)<=0.0){return vec4<f32>(0.0);}
 let center=world(p);let distance=length(center-u.camera.xyz);
 if(u.options.x<.5 || u.ao.w<.5 || distance>45.0){return vec4<f32>(0.0,distance,0.0,1.0);}
 let n=normalAt(p,center);let clip=u.vp*vec4<f32>(center,1.0);
 let projectionScale=length(vec3<f32>(u.vp[0][1],u.vp[1][1],u.vp[2][1]));
 let radiusPixels=min(80.0,u.ao.x*projectionScale*u.screen.y*.5/max(abs(clip.w),.01));
 var sum=0.0;
 for(var d=0u;d<8u;d++){
  let angle=(f32(d)+.25)*.78539816;let direction=vec2<f32>(cos(angle),sin(angle));var horizon=0.0;
  for(var s=1u;s<=3u;s++){
   let offset=direction*radiusPixels*f32(s)/3.0;let q=p+vec2<i32>(round(offset));
   if(any(q<vec2<i32>(0))||any(q>=vec2<i32>(u.screen.xy))){continue;}
   if(textureLoad(depthMap,q,0)<=0.0){continue;}
   let delta=world(q)-center;let len=length(delta);
   if(len>.015 && len<u.ao.x){
    let elevation=max(0.0,dot(n,delta/len)-.08);
    let falloff=1.0-len*len/(u.ao.x*u.ao.x);
    horizon=max(horizon,elevation*falloff);
   }
  }
  sum+=horizon;
 }
 let occlusion=clamp(sum*.25,0.0,1.0)*(1.0-smoothstep(20.0,45.0,distance));
 return vec4<f32>(occlusion,distance,0.0,1.0);
}`;
const COMPOSITE=`${COMMON}
@group(0) @binding(2) var source:texture_2d<f32>;
@group(0) @binding(3) var ambient:texture_2d<f32>;
@group(0) @binding(4) var contact:texture_2d<f32>;
@fragment fn effectFragment(@builtin(position) pixel:vec4<f32>)->@location(0) vec4<f32>{
 let p=vec2<i32>(pixel.xy);let color=textureLoad(source,p,0);
 if(u.options.x<.5 || textureLoad(depthMap,p,0)<=0.0){return color;}
 let distance=length(world(p)-u.camera.xyz);let dims=vec2<i32>(textureDimensions(ambient));
 let location=pixel.xy/u.screen.xy*vec2<f32>(dims)-.5;let base=vec2<i32>(floor(location));let fraction=fract(location);
 var sum=0.0;var weights=0.0;
 for(var y=0;y<2;y++){for(var x=0;x<2;x++){
  let q=clamp(base+vec2<i32>(x,y),vec2<i32>(0),dims-1);let v=textureLoad(ambient,q,0).rg;
  let bilinear=select(1.0-fraction.x,fraction.x,x==1)*select(1.0-fraction.y,fraction.y,y==1);
  let weight=bilinear*exp(-abs(v.y-distance)/max(.035,distance*.003));
  sum+=v.x*weight;weights+=weight;
 }}
 let ao=select(0.0,sum/max(weights,.00001),weights>.00001)*u.ao.w;
 let cs=textureLoad(contact,p,0).r*u.options.y*(1.0-smoothstep(20.0,45.0,distance));
 let amount=min(.25,ao*u.ao.y+cs*u.ao.z);
 if(u.options.z>.5){
  var mask=ao;if(u.options.z>1.5){mask=cs;}if(u.options.z>2.5){mask=amount;}
  return vec4<f32>(vec3<f32>(1.0-mask),color.a);
 }
 let highlight=max(color.r,max(color.g,color.b));
 let protect=1.0-smoothstep(.55,.88,highlight);
 return vec4<f32>(color.rgb*(1.0-amount*protect),color.a);
}`;

export function createContactOcclusion(engine,scene,sourceRT){
 const state={enabled:true,ambient:true,contact:true,radius:.55,ambientStrength:.30,contactStrength:.14,debug:0,resolution:[],aoResolution:[]};
 // Native task captures a camera once. Forward reads AND cache writes to the
 // active camera, since the game swaps reference/play cameras without rebuilding.
 const camera=new Proxy({}, {get:(_,key)=>scene.camera[key],set:(_,key,value)=>{scene.camera[key]=value;return true;}});
 const contactTask=createScreenSpaceContactShadowsPostProcessTask({name:'ashen-contact-shadows',sourceTexture:sourceRT,camera,
  lightDirection:{x:-SUN_DIR[0],y:-SUN_DIR[1],z:-SUN_DIR[2]},composition:'none',resolutionScale:1,
  stepCount:12,maxDistance:.30,thickness:.12,bias:.015,normalBias:.025,temporalWeight:0,temporalSamples:1,spatialRadius:.8,
 },engine,scene);
 const size={width:1,height:1};
 const aoRT=createRenderTarget({lbl:'ashen-ambient-occlusion',format:'rg16float',samples:1,size});
 const output=createRenderTarget({lbl:'ashen-contact-composite',format:engine.format,samples:1,size:engine});
 const binding=(name,binding,kind,extra={})=>({name,binding,kind,...extra});
 const common=[binding('params',0,'uniform',{uniformByteLength:BYTES}),binding('depth',1,'texture',{textureSampleType:'depth'})];
 const aoEffect=createEffectWrapper(engine,{name:'Local ambient occlusion',fragmentWGSL:AO,bindings:common});
 const composeEffect=createEffectWrapper(engine,{name:'Bounded contact composition',fragmentWGSL:COMPOSITE,bindings:[...common,binding('source',2,'texture'),binding('ambient',3,'texture'),binding('contact',4,'texture')]});
 const aoTask=createEffectRenderTask({name:'ashen-ambient-occlusion',effect:aoEffect,target:aoRT},engine,scene);
 const compositeTask=createEffectRenderTask({name:'ashen-contact-composite',effect:composeEffect,target:output},engine,scene);
 const data=new Float32Array(BYTES/4);let lastCamera=null,lastPosition=null;
 function update(){
  const vp=getViewProjectionMatrix(scene.camera,sourceRT._width/sourceRT._height),inv=mat4Invert(vp),p=getCameraPosition(scene.camera);
  if(inv)data.set(inv,0);data.set(vp,16);data.set([p.x,p.y,p.z,1],32);
  data.set([Math.max(.05,Math.min(1.5,state.radius)),Math.max(0,Math.min(1,state.ambientStrength)),Math.max(0,Math.min(1,state.contactStrength)),+state.ambient],36);
  data.set([sourceRT._width,sourceRT._height,0,0],40);data.set([+(state.enabled&&!!inv),+state.contact,state.debug,0],44);
  setEffectUniforms(aoEffect,data);setEffectUniforms(composeEffect,data);
 }
 const contactExecute=contactTask.execute.bind(contactTask);
 contactTask.execute=()=>{
  const p=getCameraPosition(scene.camera);
  if(lastCamera!==scene.camera || (lastPosition&&Math.hypot(p.x-lastPosition.x,p.y-lastPosition.y,p.z-lastPosition.z)>3))contactTask.resetVersion++;
  lastCamera=scene.camera;lastPosition={x:p.x,y:p.y,z:p.z};contactTask.enabled=state.enabled&&state.contact;
  return contactExecute();
 };
 const record=aoTask.record.bind(aoTask),execute=aoTask.execute.bind(aoTask);
 aoTask.record=()=>{
  size.width=Math.ceil(sourceRT._width/2);size.height=Math.ceil(sourceRT._height/2);
  state.resolution=[sourceRT._width,sourceRT._height];state.aoResolution=[size.width,size.height];
  const depth={view:sourceRT._depthTexture.createView({aspect:'depth-only'}),depth:true};
  setEffectTexture(aoEffect,'depth',depth);setEffectTexture(composeEffect,'depth',depth);update();record();
  setEffectTexture(composeEffect,'source',{view:sourceRT._colorView});setEffectTexture(composeEffect,'ambient',{view:aoRT._colorView});
  setEffectTexture(composeEffect,'contact',{view:contactTask.shadowTexture._colorView});
 };
 aoTask.execute=()=>{update();return execute();};
 for(const [task,effect] of [[aoTask,aoEffect],[compositeTask,composeEffect]]){
  const dispose=task.dispose.bind(task);task.dispose=()=>{dispose();disposeEffectWrapper(effect);};
 }
 return {state,contactTask,aoTask,compositeTask,output,aoRT,sourceRT};
}
