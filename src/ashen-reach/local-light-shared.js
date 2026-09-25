/** One contract for world surfaces, native PBR and participating air. */
export const LOCAL_LIGHT_COUNT=2;
export const LOCAL_MAP_SIZE=512;
export const LOCAL_LIGHT_UNIFORMS=Array.from({length:LOCAL_LIGHT_COUNT},(_,i)=>[
 {name:`localMatrix${i}`,type:'mat4x4<f32>'},
 ...['Position','Direction','Color','Params'].map(n=>({name:`local${n}${i}`,type:'vec4<f32>'})),
]).flat();
export const LOCAL_LIGHT_SAMPLERS=Array.from({length:LOCAL_LIGHT_COUNT},(_,i)=>({name:`localShadow${i}`,sampleType:'depth',comparison:true}));
export const LOCAL_LIGHT_WGSL=`
fn localAttenuation(p:vec3<f32>,pos:vec4<f32>,direction:vec4<f32>,params:vec4<f32>)->f32{
 let delta=p-pos.xyz;let d=length(delta);
 let cone=smoothstep(direction.w,params.x,dot(delta/max(d,.0001),direction.xyz));
 let range=max(0.0,1.0-d*d/(pos.w*pos.w));
 return cone*range*range/(1.0+d*d*.22);
}
${[0,1].map(i=>`
fn localVisibility${i}(p:vec3<f32>,normal:vec3<f32>)->f32{
 if(shaderUniforms.localParams${i}.w<.5){return 1.0;}
 let q=shaderUniforms.localMatrix${i}*vec4<f32>(p+normal*.008,1.0);
 if(q.w<=0.0){return 0.0;}
 let ndc=q.xyz/q.w;let uv=vec2<f32>(ndc.x*.5+.5,.5-ndc.y*.5);
 if(ndc.z<0.0 || ndc.z>1.0 || any(uv<vec2<f32>(0.0)) || any(uv>vec2<f32>(1.0))){return 0.0;}
 return textureSampleCompareLevel(localShadow${i},localShadow${i}Sampler,uv,ndc.z-shaderUniforms.localParams${i}.y);
}
fn localRadiance${i}(p:vec3<f32>,normal:vec3<f32>)->vec3<f32>{
 let energy=shaderUniforms.localColor${i}.w*localAttenuation(p,shaderUniforms.localPosition${i},shaderUniforms.localDirection${i},shaderUniforms.localParams${i});
 if(energy<.0001){return vec3<f32>(0.0);}
 return shaderUniforms.localColor${i}.rgb*energy*localVisibility${i}(p,normal);
}`).join('\n')}
fn localIrradiance(p:vec3<f32>,normal:vec3<f32>)->vec3<f32>{
 let l0=normalize(shaderUniforms.localPosition0.xyz-p);
 let l1=normalize(shaderUniforms.localPosition1.xyz-p);
 return localRadiance0(p,normal)*max(dot(normal,l0),0.0)+localRadiance1(p,normal)*max(dot(normal,l1),0.0);
}`;

/** Keep established slots until a challenger is appreciably closer. */
export function desiredLocalLights(lights,slots,position){
 const distance=l=>Math.hypot(l.position[0]-position.x,l.position[2]-position.z);
 return [...lights].sort((a,b)=>(distance(a)-(slots.some(s=>s.light===a)?2:0))-(distance(b)-(slots.some(s=>s.light===b)?2:0))).slice(0,LOCAL_LIGHT_COUNT);
}
export function advanceLocalSlots(slots,desired,dt){
 const step=Math.min(.05,Math.max(0,dt))*3;
 for(const s of slots){
  if(!desired.includes(s.light)){
   s.weight=Math.max(0,s.weight-step);
   if(s.weight===0)s.light=null;
  }
 }
 for(const s of slots){
  if(!s.light)s.light=desired.find(l=>!slots.some(other=>other.light===l))??null;
  if(s.light&&desired.includes(s.light))s.weight=Math.min(1,s.weight+step);
 }
}
