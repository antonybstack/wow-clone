import {createShaderMaterial,loadTexture2D,setShaderTexture,setShaderUniform,createSphere,addToScene} from '@babylonjs/lite';
import {ATMOS,SUN_DIR,FOG} from './atmosphere.js';

const OUT=`struct Out{@builtin(position) position:vec4<f32>,@location(0) p:vec3<f32>,@location(1) uv:vec2<f32>,@location(2) color:vec4<f32>,@location(3) normal:vec3<f32>,@location(4) lamp:f32};`;
export {FOG};
export async function surface(engine,name,url,{tint=[1,1,1],light=.6,alpha=false,wind=false,emission=0,pixels=128,uvScale=1,ground=false,nightGrade=false}={}){
 const tex=await loadTexture2D(engine,url,{invertY:false,srgb:false,mipMaps:true,minFilter:'nearest',magFilter:'nearest'});
 const mat=createShaderMaterial({name,attributes:['position','normal','uv','color','uv2'],uniforms:['worldViewProjection','world','cameraPosition',{name:'time',type:'f32',defaultValue:0},{name:'firePosition',type:'vec3<f32>',defaultValue:[0,0,0]},{name:'fireStrength',type:'f32',defaultValue:0},{name:'handFirePosition',type:'vec3<f32>',defaultValue:[0,0,0]},{name:'handFireStrength',type:'f32',defaultValue:0},{name:'lavaPosition',type:'vec3<f32>',defaultValue:[0,0,0]},{name:'lavaStrength',type:'f32',defaultValue:0}],samplers:ground?['albedo','paving']:['albedo'],backFaceCulling:false,needAlphaTesting:alpha,
 vertexSource:`${OUT}
 @vertex fn mainVertex(i:VertexInput)->Out{var o:Out;var p=i.position;${wind?'p.x+=sin(shaderUniforms.time*1.3+p.x*.7+p.z*.43)*i.color.a*.08;p.z+=cos(shaderUniforms.time*.8+p.x*.44)*i.color.a*.05;':''}o.position=shaderSystem.worldViewProjection*vec4<f32>(p,1);o.p=(shaderSystem.world*vec4<f32>(p,1)).xyz;o.uv=i.uv;o.color=i.color;o.normal=i.normal;o.lamp=i.uv2.x;return o;}`,
 fragmentSource:`${OUT}
 ${ATMOS}
 @fragment fn mainFragment(i:Out)->@location(0) vec4<f32>{
 ${ground?`let uvWarp=i.uv+vec2<f32>(0.08*sin(i.p.z*0.173+i.p.x*0.041),0.08*sin(i.p.x*0.161-i.p.z*0.037));
 let uvA=(floor(uvWarp*${uvScale}*${pixels}.0)+.5)/${pixels}.0;
 let uvB=(floor(vec2<f32>(uvWarp.y+0.17,-uvWarp.x+0.29)*${uvScale}*${pixels}.0)+.5)/${pixels}.0;
 let tileMix=smoothstep(0.38,0.62,0.5+0.5*sin(i.p.x*0.23+1.3)*sin(i.p.z*0.19+0.6));
 var t=mix(textureSample(albedo,albedoSampler,uvA),textureSample(albedo,albedoSampler,uvB),tileMix);`
:`let uv=(floor(i.uv*${uvScale}*${pixels}.0)+.5)/${pixels}.0;
 var t=textureSample(albedo,albedoSampler,uv);`}
 ${alpha?'if(t.a<.52 || (t.r>.8 && t.g<.12)){discard;}':''}
 ${ground?`let path=abs(i.p.x-sin(i.p.z*.14)*1.25);let pave=textureSample(paving,pavingSampler,(floor(i.p.xz*64.0/2.4)+.5)/64.0);let churchGate=1.0-smoothstep(24.0,28.0,i.p.z);let northGate=smoothstep(40.0,48.0,i.p.z);
 let amountChurch=(1.0-smoothstep(.60,1.38,path+(t.r-.4)*.75))*churchGate;
 let amountStreet=(1.0-smoothstep(1.05,2.65,path+(t.r-.4)*.9))*northGate;
 let plazaD=distance(i.p.xz,vec2<f32>(0.0,136.0));
 let amountPlaza=(1.0-smoothstep(4.2,8.6,plazaD+(t.r-.4)*1.4))*northGate;
 let amount=max(amountChurch,max(amountStreet,amountPlaza));
 t=vec4<f32>(mix(t.rgb*.68,pave.rgb*1.4,amount),1.0);`:''}
 // Baked static lamp irradiance (uv2.x, see geometry.js Batch.commit). The soft
 // knee still bounds overlapping pools; it is now applied everywhere rather than
 // gated north of z=40, since the churchyard's own lamps want the same bound and
 // the byte-identity that gate protected is no longer a goal (see
 // docs/environment-atmosphere-plan.md section 4).
 let lamp=i.lamp;
 var lampEff=lamp;
 if(lamp>1.4){lampEff=1.4+(1.0-exp(-(lamp-1.4)));}
 // Lantern warm, R-dominant, matching the fire terms below. The old (.7,.75,.30)
 // green-dominant "warm" light is gone: against the new cool skylight ambient the
 // lamps are the scene's only warm source and have to read as firelight.
 let lampColor=vec3<f32>(1.0,.58,.26);
 let fire=shaderUniforms.fireStrength/(1.0+pow(distance(i.p,shaderUniforms.firePosition)*.85,2.0));
 let handFire=shaderUniforms.handFireStrength/(1.0+pow(distance(i.p,shaderUniforms.handFirePosition)*1.0,2.0));
 let lava=shaderUniforms.lavaStrength/(1.0+pow(distance(i.p,shaderUniforms.lavaPosition)*.7,2.0));
 let light=shade(i.normal,i.p,shaderSystem.cameraPosition,${light})+lampColor*lampEff+vec3<f32>(1.0,.28,.045)*(fire+handFire+lava);
 var c=t.rgb*i.color.rgb*vec3<f32>(${tint.join(',')})*(light+${emission});
 ${nightGrade?'let ng=smoothstep(40.0,55.0,i.p.z);c=mix(c,c*vec3<f32>(.92,.86,.95),ng);':''}
 c=aerial(c,i.p,shaderSystem.cameraPosition);
 return vec4<f32>(grade(c),1);
 }`});
 setShaderTexture(mat,'albedo',tex);if(ground)setShaderTexture(mat,'paving',await loadTexture2D(engine,'/tex/rock_wall_08/diff.jpg',{invertY:false,srgb:false,mipMaps:true,minFilter:'nearest',magFilter:'nearest'}));return mat;
}

/**
 * The sky dome. Driven by the same skyColor() the ground's aerial perspective
 * converges onto, so the horizon seam the baseline had is gone by construction
 * rather than by matching two colours that were free to drift apart.
 *
 * The cloud texture is used as a *density* field, not as colour: clouds are lit
 * from SUN_DIR, so the deck reads bright and warm on the sun side, cool and
 * heavy away from it, and picks up a hot rim where a bank edges the glow --
 * the layered, lit ceiling the references have in place of a flat lid.
 */
export async function sky(engine,scene){
 const tex=await loadTexture2D(engine,'/ashen-reach/sky-generated.jpg',{invertY:false,mipMaps:true});
 const mat=createShaderMaterial({name:'Ashen cloud ceiling',attributes:['position','uv'],uniforms:['worldViewProjection',{name:'time',type:'f32',defaultValue:0}],samplers:['cloud'],backFaceCulling:false,depthWrite:false,
 vertexSource:`${OUT} @vertex fn mainVertex(i:VertexInput)->Out{var o:Out;o.position=shaderSystem.worldViewProjection*vec4<f32>(i.position,1);o.p=i.position;o.uv=i.uv;o.color=vec4<f32>(1);o.normal=vec3<f32>(0,1,0);return o;}`,
 fragmentSource:`${OUT}
 ${ATMOS}
 @fragment fn mainFragment(i:Out)->@location(0)vec4<f32>{
 let d=normalize(i.p);
 var c=skyColor(d);
 // Two cloud layers at different scales and drift rates give the deck parallax
 // and keep a single tiling texture from reading as a repeated pattern.
 // Drift was .0004 and .00021, which moves the deck 1% of the sky's circumference
 // over a half-minute -- below the threshold where anything reads as weather, so
 // the ceiling was effectively a painted backdrop. These are still slow enough that
 // nothing streaks during combat; they are just fast enough that standing still for
 // a few seconds shows the banks going somewhere.
 let uvA=vec2<f32>(atan2(d.z,d.x)/6.283+.12+shaderUniforms.time*.0014,acos(d.y)/3.14159*.65);
 let uvB=vec2<f32>(atan2(d.z,d.x)/6.283*2.1-.31-shaderUniforms.time*.00062,acos(d.y)/3.14159*1.15+.17);
 // A third, much finer sample, used only to perturb the density thresholds below
 // rather than to add density of its own. Drifting on its own axis keeps it from
 // locking to either bank.
 let uvC=vec2<f32>(atan2(d.z,d.x)/6.283*5.3+.07+shaderUniforms.time*.0009,acos(d.y)/3.14159*3.1-.22);
 let dA=dot(textureSample(cloud,cloudSampler,uvA).rgb,vec3<f32>(.3,.6,.1));
 let dB=dot(textureSample(cloud,cloudSampler,uvB).rgb,vec3<f32>(.3,.6,.1));
 let dC=dot(textureSample(cloud,cloudSampler,uvC).rgb,vec3<f32>(.3,.6,.1))-.5;
 // Density, not colour. Thick where the texture is bright.
 // The cloud deck has to thin out toward the horizon, and not only because real
 // decks do. aerial() converges distant geometry onto skyColor(dir) but cannot
 // sample this cloud texture, so anywhere the dome is cloud-darkened and the
 // ground is not, a 400 m ridgeline reads as a pale slab pasted over a darker
 // sky -- exactly the stepped bands in the p1-atmos capture 07-north-overlook.
 // Clearing the clouds across the band where far geometry actually sits makes
 // the two agree instead of requiring them to be matched by hand.
 // The clear band only has to cover where far *geometry* sits, since that is the
 // mismatch it exists to prevent. The tallest ridge ring tops out near 20 degrees,
 // but FOG_MAX is 0.62 now (it was 0.93 when this was first tuned), so a ridge keeps
 // well over a third of its own dark stone and no longer reads as a pale slab against
 // a clouded dome. Pulling the band in from ~20 degrees to ~13 hands most of the sky
 // the gameplay camera actually frames back to the cloud deck.
 let deck=smoothstep(0.025,0.22,abs(d.y));
 // Narrow windows, jittered by the fine octave. The old .36-.82 and .48-.90 spans
 // took almost the whole range of the density field to go from clear to solid, which
 // is why every bank was a soft blob with no silhouette: there was no value at which
 // the deck had an actual boundary. Halving the span sculpts one, and offsetting both
 // ends by dC breaks the contour into lobes rather than turning it into the clean arc
 // of a JPEG isoline, which is what a hard threshold on a single sample would give.
 let jA=dC*.30;
 let jB=dC*.26;
 let high=smoothstep(.45+jA,.69+jA,dA)*deck;
 let low=smoothstep(.55+jB,.83+jB,dB)*smoothstep(.55,.06,abs(d.y))*deck;
 // Clouds lit by the buried sun: bright warm underside toward the glow, cool
 // and dense away from it, with a hot rim at the density edge on the sun side.
 let sd=max(dot(d,SUN_DIR),0.0);
 // The anti-sun ends of these two were the real reason the sky read as a flat navy
 // field: at .055/.070/.098 a cloud was within 20% of the sky it was painted over at
 // 26 degrees elevation, so the deck was present and invisible. Away from the glow a
 // dusk cloud is a dark mass, not a slightly different blue -- these are now roughly a
 // third of the sky value there, which is what gives the dome structure to read.
 let litHigh=mix(vec3<f32>(.024,.034,.058),vec3<f32>(.54,.34,.24),pow(sd,1.7));
 let litLow=mix(vec3<f32>(.018,.024,.038),vec3<f32>(.78,.44,.24),pow(sd,1.2));
 let band=(high*(1.0-high)+low*(1.0-low))*4.0;
 let rim=pow(sd,5.0)*band;
 c=mix(c,litHigh,high*.72);
 c=mix(c,litLow,low*.80);
 c=c+SUN_COLOR*rim*.55;
 // The same density-edge term as the sun rim above, but ungated by sun direction
 // and carrying skylight rather than sunlight. Darkening alone gave the anti-sun deck value but
 // no boundary, so neighbouring banks merged into one smudge; a bank needs an edge
 // that is brighter than both the cloud and the sky behind it to read as a separate
 // body. Sampling skyColor() just above the horizon keeps it cold, so this adds
 // definition to the northern sky without leaking the sunset's warmth into it.
 c=c+skyColor(vec3<f32>(d.x,0.10,d.z))*band*.12;
 // A thin band of haze right at the horizon line, the same colour the ground's
 // aerial() converges to, so the two meet with no value step at all.
 c=mix(c,skyColor(vec3<f32>(d.x,0.0,d.z)),pow(1.0-abs(d.y),9.0)*.75);
 return vec4<f32>(grade(c),1);}`});
 setShaderTexture(mat,'cloud',tex);const mesh=createSphere(engine,{diameter:2200,segments:32});mesh.name='AshenSky';mesh.material=mat;mesh.renderOrder=-100;addToScene(scene,mesh);return {mat,update(t){setShaderUniform(mat,'time',t);}};
}
