import {createShaderMaterial,loadTexture2D,setShaderTexture,setShaderUniform,createSphere,addToScene} from '@babylonjs/lite';

const OUT=`struct Out{@builtin(position) position:vec4<f32>,@location(0) p:vec3<f32>,@location(1) uv:vec2<f32>,@location(2) color:vec4<f32>,@location(3) normal:vec3<f32>,@location(4) lamp:f32};`;
export const FOG=[.080,.099,.083];
export async function surface(engine,name,url,{tint=[1,1,1],light=.6,alpha=false,wind=false,emission=0,pixels=128,uvScale=1,ground=false,nightGrade=false}={}){
 const tex=await loadTexture2D(engine,url,{invertY:false,srgb:false,mipMaps:true,minFilter:'nearest',magFilter:'nearest'});
 const mat=createShaderMaterial({name,attributes:['position','normal','uv','color','uv2'],uniforms:['worldViewProjection','world','cameraPosition',{name:'time',type:'f32',defaultValue:0},{name:'firePosition',type:'vec3<f32>',defaultValue:[0,0,0]},{name:'fireStrength',type:'f32',defaultValue:0},{name:'handFirePosition',type:'vec3<f32>',defaultValue:[0,0,0]},{name:'handFireStrength',type:'f32',defaultValue:0},{name:'lavaPosition',type:'vec3<f32>',defaultValue:[0,0,0]},{name:'lavaStrength',type:'f32',defaultValue:0}],samplers:ground?['albedo','paving']:['albedo'],backFaceCulling:false,needAlphaTesting:alpha,
 vertexSource:`${OUT}
 @vertex fn mainVertex(i:VertexInput)->Out{var o:Out;var p=i.position;${wind?'p.x+=sin(shaderUniforms.time*1.3+p.x*.7+p.z*.43)*i.color.a*.08;p.z+=cos(shaderUniforms.time*.8+p.x*.44)*i.color.a*.05;':''}o.position=shaderSystem.worldViewProjection*vec4<f32>(p,1);o.p=(shaderSystem.world*vec4<f32>(p,1)).xyz;o.uv=i.uv;o.color=i.color;o.normal=i.normal;o.lamp=i.uv2.x;return o;}`,
 fragmentSource:`${OUT}
 @fragment fn mainFragment(i:Out)->@location(0) vec4<f32>{
 let uv=(floor(i.uv*${uvScale}*${pixels}.0)+.5)/${pixels}.0;
 var t=textureSample(albedo,albedoSampler,uv);${alpha?'if(t.a<.52 || (t.r>.8 && t.g<.12)){discard;}':''}
 ${ground?`let path=abs(i.p.x-sin(i.p.z*.14)*1.25);let pave=textureSample(paving,pavingSampler,(floor(i.p.xz*64.0/2.4)+.5)/64.0);let churchGate=1.0-smoothstep(24.0,28.0,i.p.z);let northGate=smoothstep(40.0,48.0,i.p.z);
 // Below z=40 this is byte-for-byte the original churchyard formula (amountChurch alone, using
 // churchGate which is itself 0 past z=28). amountStreet/amountPlaza are both multiplied by
 // northGate, which is exactly 0 for i.p.z<=40, so the town's wider main street and the well
 // plaza can never move a churchyard pixel.
 let amountChurch=(1.0-smoothstep(.60,1.38,path+(t.r-.4)*.75))*churchGate;
 let amountStreet=(1.0-smoothstep(1.05,2.65,path+(t.r-.4)*.9))*northGate;
 let plazaD=distance(i.p.xz,vec2<f32>(0.0,136.0));
 let amountPlaza=(1.0-smoothstep(4.2,8.6,plazaD+(t.r-.4)*1.4))*northGate;
 let amount=max(amountChurch,max(amountStreet,amountPlaza));
 t=vec4<f32>(mix(t.rgb*.68,pave.rgb*1.4,amount),1.0);`:''}
 let directional=.62+.38*abs(dot(normalize(i.normal+vec3<f32>(.00001)),normalize(vec3<f32>(-.4,.8,-.3))));
 let lamp=i.lamp;
 // M3c defect 1: the baked lamp-irradiance term summed unboundedly across every registered light
 // with no cap, AND used a colour (.7,.75,.30 -- G the highest channel, B the lowest) that was
 // never actually warm. Both compounded on the green-tinted ground/foliage tints (and on stone,
 // which has no other correction) into a bright, uniform yellow-green wash wherever pools
 // overlapped (the well square's ring of well+stall lights, the town gate's own two lights).
 // Fixed together: a soft knee (identity below ~a single fixture's own peak so the "genuinely
 // good" isolated lamp close-ups are unchanged, compressed above it so overlapping pools can no
 // longer blow past a bounded value) and a properly R-dominant warm colour. Both are gated by the
 // same z>40 boundary nightGrade already uses (smoothstep(40,55,i.p.z)), so at i.p.z<=40 lampGate
 // is exactly 0 and this reduces to the original formula byte-for-byte -- the churchyard's own two
 // lamps are untouched by construction.
 let lampGate=smoothstep(40.0,55.0,i.p.z);
 var lampKnee=lamp;
 if(lamp>1.4){lampKnee=1.4+(1.0-exp(-(lamp-1.4)));}
 let lampEff=mix(lamp,lampKnee,lampGate);
 let lampColor=mix(vec3<f32>(.7,.75,.30),vec3<f32>(1.0,.60,.28),lampGate);
 let fire=shaderUniforms.fireStrength/(1.0+pow(distance(i.p,shaderUniforms.firePosition)*.85,2.0));
 let handFire=shaderUniforms.handFireStrength/(1.0+pow(distance(i.p,shaderUniforms.handFirePosition)*1.0,2.0));
 let lava=shaderUniforms.lavaStrength/(1.0+pow(distance(i.p,shaderUniforms.lavaPosition)*.7,2.0));
 let light=vec3<f32>(${light}*directional)+lampColor*lampEff+vec3<f32>(1.0,.28,.045)*(fire+handFire+lava);
 var c=t.rgb*i.color.rgb*vec3<f32>(${tint.join(',')})*(light+${emission});
 ${nightGrade?'let ng=smoothstep(40.0,55.0,i.p.z);c=mix(c,c*vec3<f32>(.80,.72,.84),ng);':''}
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
