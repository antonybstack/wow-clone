/**
 * Shared sunset palette, surface illumination and filmic grade.
 * World-space fog and sunlight visibility live in volumetric-fog.js and are
 * applied once after opaque scene depth is available.
 */
const unit=(x,y,z)=>{const l=Math.hypot(x,y,z);return [x/l,y/l,z/l];};
const w3=a=>`vec3<f32>(${a.map(v=>v.toFixed(6)).join(',')})`;

/** Toward the sun, roughly 12 degrees above the northern ridge horizon. */
export const SUN_DIR=unit(-0.48,0.24,1.0);
export const SUN_COLOR=[1.00,0.70,0.45];
export const SKY_ZENITH=[0.29,0.67,1.00];
export const SKY_HORIZON=[1.02,0.58,0.47];
export const SKY_HORIZON_COOL=[0.50,0.66,0.83];
export const SKY_NADIR=[0.38,0.25,0.27];
export const SUN_GLOW=[3.40,2.55,0.70];
export const SKY_AMBIENT=[0.255,0.305,0.415];
export const GROUND_BOUNCE=[0.124,0.107,0.081];
export const EXPOSURE=1.35;
export const BLACK_LIFT=[0.018,0.023,0.034];
export const SATURATION=1.14;
export const FOG=SKY_HORIZON;

/** WGSL shared by world materials, foliage, lamps and the sky. */
export const ATMOS=`
const SUN_DIR=${w3(SUN_DIR)};
const SUN_COLOR=${w3(SUN_COLOR)};
const SUN_GLOW=${w3(SUN_GLOW)};


fn skyColor(dir:vec3<f32>)->vec3<f32>{
 let up=clamp(dir.y,-1.0,1.0);
 // A cool upper sky changes gradually into the broad rose-gold horizon.
 let band=pow(clamp(1.0-abs(up),0.0,1.0),7.0);
 let sd=max(dot(dir,SUN_DIR),0.0);
 let horizon=mix(${w3(SKY_HORIZON_COOL)},${w3(SKY_HORIZON)},pow(sd,3.0));
 var c=mix(${w3(SKY_ZENITH)},horizon,band);
 c=mix(c,${w3(SKY_NADIR)},smoothstep(0.0,-0.22,up));
 // The wide luminous skirt supplies the reference's near-white sunward air;
 // the narrow core gives bloom something to pick up without lifting the
 // opposite side of the sky.
 let glow=pow(sd,24.0)*0.24+pow(sd,6.0)*0.045;
 let disc=smoothstep(0.99995,0.99999,sd)*12.0;
 return c+SUN_GLOW*(glow*(0.35+0.65*band)+disc);
}

// The shared fullscreen volume integrates all air once, using scene depth and
// sunlight visibility. Surface materials no longer invent local shaft terms.
fn aerial(c:vec3<f32>,wp:vec3<f32>,cam:vec3<f32>)->vec3<f32>{return c;}

/** Key + hemispheric ambient + rim, the three terms the baseline was missing.
 *  Parameter k is the material's own light scale (surface()'s light option), kept
 *  per-material authoring intent survives the model change. */
fn shade(n:vec3<f32>,wp:vec3<f32>,cam:vec3<f32>,k:f32)->vec3<f32>{
 let nn=normalize(n+vec3<f32>(0.00001));
 let ndl=dot(nn,SUN_DIR);
 // A hard key for form, plus a wrapped tail so surfaces turned away from a
 // horizon-height sun still read as lit air rather than as holes.
 let key=SUN_COLOR*(max(ndl,0.0)*0.95+max((ndl+0.45)/1.45,0.0)*0.30);
 let hemi=mix(${w3(GROUND_BOUNCE)},${w3(SKY_AMBIENT)},nn.y*0.5+0.5);
 let v=normalize(cam-wp);
 // Fresnel rim, gated on facing the key, so edges separate from the haze.
 let rim=pow(1.0-clamp(dot(nn,v),0.0,1.0),3.2)*(0.30+0.70*max(ndl,0.0));
 return (key+hemi)*k+SUN_COLOR*rim*0.22*k;
}

/** Filmic tonemap (ACES fit) then a lifted-black, mid-saturated grade. Without
 *  this the lamp pools clip to a single flat yellow and the shadows clip to
 *  zero; both are visible in the baseline (04-town-gate-vista, 10-ridge-west). */
fn grade(cIn:vec3<f32>)->vec3<f32>{
 let x=cIn*${EXPOSURE.toFixed(3)};
 var t=clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14),vec3<f32>(0.0),vec3<f32>(1.0));
 t=t+${w3(BLACK_LIFT)}*(1.0-smoothstep(vec3<f32>(0.0),vec3<f32>(0.40),t));
 let l=dot(t,vec3<f32>(0.2126,0.7152,0.0722));
 return clamp(mix(vec3<f32>(l),t,${SATURATION.toFixed(3)}),vec3<f32>(0.0),vec3<f32>(1.0));
}
`;

/** JS mirror of the WGSL grade(), so code outside the shaders (clear colour,
 *  Babylon's own fog for the character GLBs, any future post chain) lands on the
 *  same screen value the world converges to instead of a hand-matched guess. */
export function gradeJS(c){
 const f=x=>{const v=x*EXPOSURE;return Math.min(1,Math.max(0,(v*(2.51*v+0.03))/(v*(2.43*v+0.59)+0.14)));};
 const t=c.map(f);
 const lift=t.map((v,i)=>v+BLACK_LIFT[i]*(1-(v<=0?0:v>=0.40?1:(()=>{const s=v/0.40;return s*s*(3-2*s);})())));
 const l=0.2126*lift[0]+0.7152*lift[1]+0.0722*lift[2];
 return lift.map(v=>Math.min(1,Math.max(0,l+(v-l)*SATURATION)));
}
/** The horizon haze as it appears on screen. */
export const FOG_SCREEN=gradeJS(SKY_HORIZON);
