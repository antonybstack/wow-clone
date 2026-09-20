import {createShaderMaterial,loadTexture2D,setShaderTexture,setShaderUniform,createSphere,addToScene} from '@babylonjs/lite';

const OUT=`struct Out{@builtin(position) position:vec4<f32>,@location(0) p:vec3<f32>,@location(1) uv:vec2<f32>,@location(2) color:vec4<f32>,@location(3) normal:vec3<f32>,@location(4) lamp:f32};`;
export const FOG=[.080,.099,.083];
export async function surface(engine,name,url,{tint=[1,1,1],light=.6,alpha=false,wind=false,emission=0,pixels=128,uvScale=1,ground=false}={}){
 const tex=await loadTexture2D(engine,url,{invertY:false,srgb:false,mipMaps:true,minFilter:'nearest',magFilter:'nearest'});
 const mat=createShaderMaterial({name,attributes:['position','normal','uv','color','uv2'],uniforms:['worldViewProjection','world','cameraPosition',{name:'time',type:'f32',defaultValue:0},{name:'firePosition',type:'vec3<f32>',defaultValue:[0,0,0]},{name:'fireStrength',type:'f32',defaultValue:0},{name:'handFirePosition',type:'vec3<f32>',defaultValue:[0,0,0]},{name:'handFireStrength',type:'f32',defaultValue:0},{name:'lavaPosition',type:'vec3<f32>',defaultValue:[0,0,0]},{name:'lavaStrength',type:'f32',defaultValue:0}],samplers:ground?['albedo','paving']:['albedo'],backFaceCulling:false,needAlphaTesting:alpha,
 vertexSource:`${OUT}
 @vertex fn mainVertex(i:VertexInput)->Out{var o:Out;var p=i.position;${wind?'p.x+=sin(shaderUniforms.time*1.3+p.x*.7+p.z*.43)*i.color.a*.08;p.z+=cos(shaderUniforms.time*.8+p.x*.44)*i.color.a*.05;':''}o.position=shaderSystem.worldViewProjection*vec4<f32>(p,1);o.p=(shaderSystem.world*vec4<f32>(p,1)).xyz;o.uv=i.uv;o.color=i.color;o.normal=i.normal;o.lamp=i.uv2.x;return o;}`,
 fragmentSource:`${OUT}
 @fragment fn mainFragment(i:Out)->@location(0) vec4<f32>{
 let uv=(floor(i.uv*${uvScale}*${pixels}.0)+.5)/${pixels}.0;
 var t=textureSample(albedo,albedoSampler,uv);${alpha?'if(t.a<.52 || (t.r>.8 && t.g<.12)){discard;}':''}
 ${ground?'let path=abs(i.p.x-sin(i.p.z*.14)*1.25);let pave=textureSample(paving,pavingSampler,(floor(i.p.xz*64.0/2.4)+.5)/64.0);let amount=(1.0-smoothstep(.60,1.38,path+(t.r-.4)*.75))*(1.0-smoothstep(24.0,28.0,i.p.z));t=vec4<f32>(mix(t.rgb*.68,pave.rgb*1.4,amount),1.0);':''}
 let directional=.62+.38*abs(dot(normalize(i.normal+vec3<f32>(.00001)),normalize(vec3<f32>(-.4,.8,-.3))));
 let lamp=i.lamp;
 let fire=shaderUniforms.fireStrength/(1.0+pow(distance(i.p,shaderUniforms.firePosition)*.85,2.0));
 let handFire=shaderUniforms.handFireStrength/(1.0+pow(distance(i.p,shaderUniforms.handFirePosition)*1.0,2.0));
 let lava=shaderUniforms.lavaStrength/(1.0+pow(distance(i.p,shaderUniforms.lavaPosition)*.7,2.0));
 let light=vec3<f32>(${light}*directional)+vec3<f32>(.7,.75,.30)*lamp+vec3<f32>(1.0,.28,.045)*(fire+handFire+lava);
 var c=t.rgb*i.color.rgb*vec3<f32>(${tint.join(',')})*(light+${emission});
 let d=distance(i.p,shaderSystem.cameraPosition);let fog=1.0-exp(-max(d-9.0,0.0)*.010);
 c=mix(c,vec3<f32>(${FOG.join(',')}),fog);
 let vignette=1.0-.12*clamp(abs(i.position.x/960.0-.5),0.0,1.0);
 return vec4<f32>(c*vignette,1);
 }`});
 setShaderTexture(mat,'albedo',tex);if(ground)setShaderTexture(mat,'paving',await loadTexture2D(engine,'/tex/rock_wall_08/diff.jpg',{invertY:false,srgb:false,mipMaps:true,minFilter:'nearest',magFilter:'nearest'}));return mat;
}

export async function sky(engine,scene){
 const tex=await loadTexture2D(engine,'/ashen-reach/sky-generated.jpg',{invertY:false,mipMaps:true});
 const mat=createShaderMaterial({name:'Ashen cloud ceiling',attributes:['position','uv'],uniforms:['worldViewProjection',{name:'time',type:'f32',defaultValue:0}],samplers:['cloud'],backFaceCulling:false,depthWrite:false,
 vertexSource:`${OUT} @vertex fn mainVertex(i:VertexInput)->Out{var o:Out;o.position=shaderSystem.worldViewProjection*vec4<f32>(i.position,1);o.p=i.position;o.uv=i.uv;o.color=vec4<f32>(1);o.normal=vec3<f32>(0,1,0);return o;}`,
 fragmentSource:`${OUT} @fragment fn mainFragment(i:Out)->@location(0)vec4<f32>{let d=normalize(i.p);let uv=vec2<f32>(atan2(d.z,d.x)/6.283+.12+shaderUniforms.time*.0004,acos(d.y)/3.14159*.65);let t=textureSample(cloud,cloudSampler,uv).rgb;let l=dot(t,vec3<f32>(.3,.6,.1));let horizon=pow(1.0-abs(d.y),5.0);let c=vec3<f32>(.019,.035,.031)+smoothstep(.43,.82,l)*vec3<f32>(.16,.185,.135);return vec4<f32>(mix(c,vec3<f32>(.09,.112,.09),horizon*.22),1);}`});
 setShaderTexture(mat,'cloud',tex);const mesh=createSphere(engine,{diameter:600,segments:32});mesh.name='AshenSky';mesh.material=mat;mesh.renderOrder=-100;addToScene(scene,mesh);return {mat,update(t){setShaderUniform(mat,'time',t);}};
}
