import {createShaderMaterial,loadTexture2D,setShaderTexture,setShaderUniform,createSphere,addToScene} from '@babylonjs/lite';
import {ATMOS,SUN_DIR,FOG} from './atmosphere.js';

const OUT=`struct Out{@builtin(position) position:vec4<f32>,@location(0) p:vec3<f32>,@location(1) uv:vec2<f32>,@location(2) color:vec4<f32>,@location(3) normal:vec3<f32>,@location(4) lamp:f32};`;
import {SUN_SHADOW_UNIFORMS,SUN_SHADOW_SAMPLERS,SUN_SHADOW_WGSL,bindSunReceiver} from './sun-shadows.js';
import {LOCAL_LIGHT_UNIFORMS,LOCAL_LIGHT_SAMPLERS,LOCAL_LIGHT_WGSL} from './local-light-shared.js';
import {bindLocalReceiver} from './local-lights.js';
import {LOCAL_SPECULAR_WGSL} from './local-specular.js';
import {SURFACE_DETAIL_WGSL} from './surface-detail.js';
export {FOG};

/** Spell light is written onto every world material. Shafts, ash, and the sky
 *  do not declare those uniforms, and a missing one throws out of the frame. */
export function paintLitUniform(material, name, value) {
  if (!material?._uniformValues?.has(name)) return;
  setShaderUniform(material, name, value);
}
export async function surface(engine,name,url,{tint=[1,1,1],light=.6,alpha=false,wind=false,emission=0,skyFill=0,pixels=128,uvScale=1,ground=false,nightGrade=false,detail=false}={}){
 const tex=await loadTexture2D(engine,url,{invertY:false,srgb:false,mipMaps:true,minFilter:'nearest',magFilter:'nearest'});
 const mat=createShaderMaterial({name,attributes:['position','normal','uv','color','uv2'],uniforms:['worldViewProjection','world','cameraPosition','view',...SUN_SHADOW_UNIFORMS,...LOCAL_LIGHT_UNIFORMS,{name:'localSpecularStrength',type:'f32',defaultValue:1},{name:'surfaceDetailStrength',type:'f32',defaultValue:1},{name:'time',type:'f32',defaultValue:0},{name:'firePosition',type:'vec3<f32>',defaultValue:[0,0,0]},{name:'fireStrength',type:'f32',defaultValue:0},{name:'handFirePosition',type:'vec3<f32>',defaultValue:[0,0,0]},{name:'handFireStrength',type:'f32',defaultValue:0},{name:'lavaPosition',type:'vec3<f32>',defaultValue:[0,0,0]},{name:'lavaStrength',type:'f32',defaultValue:0}],samplers:[...SUN_SHADOW_SAMPLERS,...LOCAL_LIGHT_SAMPLERS,...(detail?['stoneDetail']:[]),...(ground?['albedo','paving']:['albedo'])],backFaceCulling:false,needAlphaTesting:alpha,
 vertexSource:`${OUT}
 @vertex fn mainVertex(i:VertexInput)->Out{var o:Out;var p=i.position;${wind?'p.x+=sin(shaderUniforms.time*1.3+p.x*.7+p.z*.43)*i.color.a*.08;p.z+=cos(shaderUniforms.time*.8+p.x*.44)*i.color.a*.05;':''}o.position=shaderSystem.worldViewProjection*vec4<f32>(p,1);o.p=(shaderSystem.world*vec4<f32>(p,1)).xyz;o.uv=i.uv;o.color=i.color;o.normal=i.normal;o.lamp=i.uv2.x;return o;}`,
 fragmentSource:`${OUT}
 ${ATMOS} ${SUN_SHADOW_WGSL} ${LOCAL_LIGHT_WGSL} ${LOCAL_SPECULAR_WGSL} ${detail?SURFACE_DETAIL_WGSL:''}
 @fragment fn mainFragment(i:Out)->@location(0) vec4<f32>{
 ${ground?`let uvWarp=i.uv+vec2<f32>(0.08*sin(i.p.z*0.173+i.p.x*0.041),0.08*sin(i.p.x*0.161-i.p.z*0.037));
 let uvA=(floor(uvWarp*${uvScale}*${pixels}.0)+.5)/${pixels}.0;
 let uvB=(floor(vec2<f32>(uvWarp.y+0.17,-uvWarp.x+0.29)*${uvScale}*${pixels}.0)+.5)/${pixels}.0;
 let tileMix=smoothstep(0.38,0.62,0.5+0.5*sin(i.p.x*0.23+1.3)*sin(i.p.z*0.19+0.6));
 var t=mix(textureSample(albedo,albedoSampler,uvA),textureSample(albedo,albedoSampler,uvB),tileMix);`
:`let uv=(floor(i.uv*${uvScale}*${pixels}.0)+.5)/${pixels}.0;
 var t=textureSample(albedo,albedoSampler,uv);`}
 ${alpha?'if(t.a<.52 || (t.r>.8 && t.g<.12)){discard;}':''}
 ${ground?`let path=abs(i.p.x-sin(i.p.z*.14)*1.25);let pave=textureSample(paving,pavingSampler,(floor(i.p.xz*64.0/2.4)+.5)/64.0);let churchGate=1.0-smoothstep(24.0,28.0,i.p.z);let southFade=smoothstep(-142.0,-95.0,i.p.z);let northGate=smoothstep(40.0,48.0,i.p.z);
 let amountChurch=(1.0-smoothstep(.60,1.38,path+(t.r-.4)*.75))*churchGate*southFade;
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
 // Recover form on the outer moor where it is shadowed by the low sun. The
 // churchyard (z<=40) and Hollowmere's lamp corridor get exactly zero fill.
 let outerLandFill=${ground?'vec3<f32>(.15,.16,.18)*smoothstep(40.0,90.0,i.p.z)*max(smoothstep(18.0,45.0,abs(i.p.x)),smoothstep(120.0,175.0,i.p.z))':'vec3<f32>(0.0)'};
 let geometricN=normalize(i.normal+vec3<f32>(.00001));
 var materialN=geometricN;var materialRoughness=.92;
 ${detail?`let detailUV=${ground?'i.p.xz/2.4':`i.uv*${uvScale}`};
 let packedDetail=textureSample(stoneDetail,stoneDetailSampler,detailUV);
 let detailFade=(1.0-smoothstep(10.0,38.0,distance(i.p,shaderSystem.cameraPosition)))*smoothstep(40.0,52.0,i.p.z)*shaderUniforms.surfaceDetailStrength;
 let detailMask=${ground?'amount':'1.0'};
 materialN=stoneNormal(i.p,detailUV,geometricN,packedDetail.rgb,detailFade*detailMask*.45);
 materialRoughness=mix(.92,clamp(packedDetail.a*.60+.28,.45,.94),detailMask*detailFade);`:''}
 let light=shade(materialN,i.p,shaderSystem.cameraPosition,${light},sunVisibility(i.p,normalize(i.normal+vec3<f32>(.00001))))+outerLandFill+vec3<f32>(.80,.86,1.0)*${skyFill}+lampColor*lampEff+localIrradiance(i.p,materialN)+vec3<f32>(1.0,.28,.045)*(fire+handFire+lava);
 var c=srgbToLinear(t.rgb)*i.color.rgb*vec3<f32>(${tint.join(',')})*(light+${emission});
 c+=localSpecular(i.p,materialN,normalize(shaderSystem.cameraPosition-i.p+vec3<f32>(.00001)),materialRoughness,vec3<f32>(.04))*shaderUniforms.localSpecularStrength*${emission>0?'0.0':'1.0'};
 ${nightGrade?'let ng=smoothstep(40.0,55.0,i.p.z);c=mix(c,c*vec3<f32>(.92,.86,.95),ng);':''}
 c=aerial(c,i.p,shaderSystem.cameraPosition);
 return vec4<f32>(c,1);
 }`});
 if(detail)setShaderTexture(mat,'stoneDetail',await loadTexture2D(engine,'/ashen-reach/stone-detail.png',{invertY:false,srgb:false,mipMaps:true,minFilter:'linear',magFilter:'linear'}));
 bindSunReceiver(engine,mat);bindLocalReceiver(engine,mat);setShaderTexture(mat,'albedo',tex);if(ground)setShaderTexture(mat,'paving',await loadTexture2D(engine,'/tex/rock_wall_08/diff.jpg',{invertY:false,srgb:false,mipMaps:true,minFilter:'nearest',magFilter:'nearest'}));return mat;
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
 // The deck is projected onto a flat slab overhead, not onto the dome. A ray at
 // elevation d.y meets a plane at height H at horizontal distance H/d.y, so
 // d.xz/d.y is that plane in world coordinates up to a scale -- which means a
 // bank subtends a large angle overhead and compresses toward the horizon,
 // exactly as a real ceiling does. The dome mapping this replaced could not do
 // that: atan2(d.z,d.x) gives every bank the same angular width at every
 // elevation, so the sky was a lid with clouds painted on the inside of it, and
 // no amount of drift or density tuning was ever going to fix that, because the
 // missing cue was perspective rather than motion.
 //
 // The clamp on |d.y| bounds the projection where it would otherwise run to
 // infinity. 0.045 is inside the deck fade below, so the compressed region is
 // already being faded out by the time the clamp engages; mipMaps carry the rest.
 let ay=max(abs(d.y),0.045);
 let pl=vec2<f32>(d.x,d.z)/ay;
 // Drift is now a translation of the plane, i.e. an actual wind vector, rather
 // than a rotation of the dome. The three layers share a direction within about
 // 20 degrees -- one weather system, not three -- and differ in rate, which is
 // what makes them parallax against each other instead of sliding as one sheet.
 let wA=vec2<f32>(0.82,0.57)*shaderUniforms.time*0.0016;
 let wB=vec2<f32>(0.90,0.44)*shaderUniforms.time*0.0009;
 // Scales preserve the apparent bank size the dome mapping had at 30 degrees of
 // elevation, which is roughly where the gameplay camera sits, so this pass buys
 // perspective without also silently rescaling the whole sky.
 let uvA=pl*0.090+vec2<f32>(.12,-.06)+wA;
 let uvB=pl*0.190+vec2<f32>(-.31,.17)+wB;
 // A third, much finer sample, used only to perturb the density thresholds below
 // rather than to add density of its own. Drifting on its own axis keeps it from
 // locking to either bank.
 let uvC=pl*0.480+vec2<f32>(.07,-.22)+vec2<f32>(0.75,0.66)*shaderUniforms.time*0.0021;
 let dA=dot(textureSample(cloud,cloudSampler,uvA).rgb,vec3<f32>(.3,.6,.1));
 let dB=dot(textureSample(cloud,cloudSampler,uvB).rgb,vec3<f32>(.3,.6,.1));
 let dC=dot(textureSample(cloud,cloudSampler,uvC).rgb,vec3<f32>(.3,.6,.1))-.5;
 // The slope of the density field along the sun's horizontal bearing. Positive
 // where the deck thins toward the sun, which is the near face of a bank -- the
 // side a raking sun actually strikes.
 //
 // This replaces a self-shadow term that sampled density 0.075 uv toward the sun
 // and measured nothing: sd moved 1.3 on a 47-unit patch, inside the noise. The
 // reason was not the strength. With the sun 6 degrees above the horizon, a slab
 // of thickness 0.3H throws its shadow 9.6 thicknesses downwind, about a quarter
 // of the sky, so the sample was decorrelated from the bank supposedly casting it
 // and darkened at random rather than in register. A low sun does not shade a deck
 // from within; it rakes across it. The offset here is deliberately small -- well
 // inside one bank -- because what is wanted is which way a piece of deck faces,
 // not what is standing between it and the sun.
 let sunXZ=normalize(vec2<f32>(SUN_DIR.x,SUN_DIR.z));
 let dG=dot(textureSample(cloud,cloudSampler,uvA+sunXZ*0.018).rgb,vec3<f32>(.3,.6,.1));
 let slope=clamp((dA-dG)*3.4,-1.0,1.0);
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
 // but a ridge crest at 400 m now retains about 63% of its own dark stone rather than
 // the 7% it kept when this band was first tuned, so it no longer reads as a pale slab
 // against a clouded dome. (That figure used to be justified by FOG_MAX=0.62; FOG_MAX
 // is gone, and the number that matters here was never the cap anyway -- a crest that
 // high was always below it. It is FOG_SCALE_H=15 that buys the crest back.) Pulling the band in from ~20 degrees to ~13 hands most of the sky
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
 // slope is deliberately *not* folded into these two. Tried it at .85 and .70 and
 // it cost 19 units of mean and 3.4 of spread on the sky patch, because pow(sd,n)
 // is already at its ceiling exactly where the deck is bright: a multiplier on a
 // saturated term can only subtract on average, and clamping the negative half at
 // zero while the positive half caps at 1.30 makes that asymmetry worse. slope
 // earns its place additively, on the rim below, where it can only add.
let litHigh=mix(vec3<f32>(.23,.30,.40),vec3<f32>(1.15,.61,.46),pow(sd,1.7));
let litLow=mix(vec3<f32>(.29,.34,.42),vec3<f32>(1.34,.67,.44),pow(sd,1.2));
 let band=(high*(1.0-high)+low*(1.0-low))*4.0;
 // The rim was non-directional, so it lit the far side of every bank as brightly
 // as the near one and the deck read as outlined rather than modelled. slope is
 // added here rather than mixed in: the existing rim keeps its full strength and
 // an edge that faces the sun gets up to 2.1x it. Written as a weight -- say
 // (0.30+0.90*slope) -- this would have been the same subtractive trap as above,
 // since max(slope,0) averages about a third across the field.
 let rim=pow(sd,5.0)*band*(1.0+1.10*max(slope,0.0));
// Open the deck around the low sun so the actual sky radiance and distant
// silhouettes carry the vista. Thin cloud edges still catch the warm key.
let sunOpening=1.0-smoothstep(.62,.96,sd)*.78;
c=mix(c,litHigh,high*.34*sunOpening);
c=mix(c,litLow,low*.40*sunOpening);
c=c+SUN_COLOR*rim*.25;
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
 // Sun shafts are integrated through shadowed world-space fog in the post pass.
 return vec4<f32>(c,1);}`});
 setShaderTexture(mat,'cloud',tex);const mesh=createSphere(engine,{diameter:2200,segments:32});mesh.name='AshenSky';mesh.material=mat;mesh.renderOrder=-100;addToScene(scene,mesh);return {mat,update(t){setShaderUniform(mat,'time',t);}};
}
