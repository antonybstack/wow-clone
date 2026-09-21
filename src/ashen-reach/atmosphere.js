/**
 * Ashen Reach's atmosphere model — one source of truth for sky colour, aerial
 * perspective, the key/ambient split and the tonemap, shared verbatim by every
 * material that draws world geometry (`materials.js`'s surface(), the sky dome,
 * and `foliage.js`).
 *
 * Why one module: the previous look had four independent copies of "directional
 * shading + lamp term + fog" (opaque surfaces, ground surfaces, foliage, sky) and
 * the sky's copy omitted fog entirely. That omission is what produced the hard
 * black band along the horizon in the baseline capture `12-wide-south-vista` --
 * ground converged to a dark fog colour while the dome stayed lighter, and no
 * choice of colours at the seam can hide a discontinuity that is structural.
 * Emitting the same WGSL text into all of them makes that class of seam
 * impossible rather than merely tuned away.
 *
 * Art direction: blue hour. The sun sits just below the northern horizon --
 * behind the Citadel of Vaelmark at z=260 -- which is what buys the Elden Ring
 * reference traits all at once: a bright hazy band for the citadel, ridgelines
 * and the player to silhouette against; a grazing warm key that rims every
 * ridge; a cool sky ambient that turns Hollowmere's existing warm lanterns into
 * complementary accents instead of the only colour in frame.
 */

const unit=(x,y,z)=>{const l=Math.hypot(x,y,z);return [x/l,y/l,z/l];};
const w3=a=>`vec3<f32>(${a.map(v=>v.toFixed(6)).join(',')})`;

/** Direction *toward* the sun. Low (elevation ~6 degrees) and to the north, a
 *  little west of the main street axis so the light rakes across the street
 *  rather than running straight down it. */
export const SUN_DIR=unit(-0.26,0.105,1.0);
export const SUN_COLOR=[1.00,0.70,0.45];
export const SKY_ZENITH=[0.026,0.046,0.082];
export const SKY_HORIZON=[0.250,0.262,0.288];
export const SKY_NADIR=[0.046,0.048,0.044];
/** Cool skylight from above and a warm dark bounce from the ground below: the
 *  complementary split the references run on. */
export const SKY_AMBIENT=[0.255,0.305,0.415];
export const GROUND_BOUNCE=[0.124,0.107,0.081];

/** Height-fog parameters. `SCALE_H` is the e-folding height of the haze, so a
 *  ridge crest at y=+60 sits in thin air while its base sits in thick fog --
 *  "ridges emerging from a fog-filled valley" falls out of the integral rather
 *  than being authored. */
/** FOG_MAX is what keeps distance from erasing the skyline. Everything past
 *  ~200 m saturates the integral, so this cap alone sets how far below the sky a
 *  ridge or the citadel sits. At 0.93 they washed out to slightly *lighter* than
 *  the dome above them and read as mist banks rather than land (p2-grade
 *  07-north-overlook); 0.80 still left the ridge rings as the brightest thing in
 *  frame once the bowl rim stopped hiding them (p4-skyline 07 and 10). 0.62 keeps
 *  well over a third of the near-black distant stone, which is what makes a ridge
 *  read as land rather than as cloud.
 *
 *  Density is the other half of the same problem and pulls the opposite way. At
 *  0.0165 the integral was already ~70% saturated by 80 m, so the *mid* ground
 *  greyed out at the same rate as the horizon and the picture had two depth
 *  layers instead of five. 0.0085 is about 50% at 80 m and still saturating by
 *  250 m, which separates near / mid / far / ridge / sky. */
export const FOG_DENSITY=0.0085,FOG_SCALE_H=22.0,FOG_FLOOR_Y=0.0,FOG_MAX=0.62;
export const FOG_NEAR=7.0,FOG_FULL=30.0;

export const EXPOSURE=1.35;
/** Lifted, slightly cool blacks. The references never reach pure black; the
 *  baseline did constantly (`10-ridge-west` is mostly clipped-to-zero mud). */
export const BLACK_LIFT=[0.018,0.023,0.034];
export const SATURATION=1.14;

/** The colour distance converges to. Exported so main.js can clear the surface
 *  and drive Babylon's own built-in fog (which lights the character GLBs, not
 *  these shader materials) to the same value -- otherwise the character fogs
 *  toward one colour and the world it stands in toward another. */
export const FOG=SKY_HORIZON;

/** WGSL shared by every world material. Pure functions, no uniforms of its own
 *  beyond what the caller already declares. */
export const ATMOS=`
const SUN_DIR=${w3(SUN_DIR)};
const SUN_COLOR=${w3(SUN_COLOR)};

fn skyColor(dir:vec3<f32>)->vec3<f32>{
 let up=clamp(dir.y,-1.0,1.0);
 // Horizon band is broad and bright, zenith deep blue. pow() keeps the band
 // tight enough to read as a horizon rather than a wash over the whole dome.
 let band=pow(clamp(1.0-abs(up),0.0,1.0),2.6);
 var c=mix(${w3(SKY_ZENITH)},${w3(SKY_HORIZON)},band);
 c=mix(c,${w3(SKY_NADIR)},smoothstep(0.0,-0.22,up));
 // The sun is below the horizon, so what shows is its glow through the haze:
 // a tight core plus a wide skirt, both strongest near the horizon line.
 let sd=max(dot(dir,SUN_DIR),0.0);
 let glow=pow(sd,11.0)*1.25+pow(sd,4.0)*0.22;
 return c+SUN_COLOR*glow*(0.30+0.70*band);
}

/** Aerial perspective. Analytic integral of an exponential height-fog along the
 *  view ray, so optical depth depends on *where* the ray travelled, not just how
 *  far -- valleys pool and crests clear. Inscattered colour is skyColor() in the
 *  view direction, which is why far geometry converges onto the sky behind it
 *  instead of onto a constant, and why the dome and the ground can never seam. */
fn aerial(c:vec3<f32>,wp:vec3<f32>,cam:vec3<f32>)->vec3<f32>{
 let toP=wp-cam;
 let d=length(toP);
 let dir=toP/max(d,0.0001);
 let dy=toP.y;
 let base=${FOG_DENSITY.toFixed(5)}*d*exp(-(cam.y-${FOG_FLOOR_Y.toFixed(1)})/${FOG_SCALE_H.toFixed(1)});
 var od:f32;
 if(abs(dy)<0.05){od=base;}
 else{od=base*(1.0-exp(-dy/${FOG_SCALE_H.toFixed(1)}))*(${FOG_SCALE_H.toFixed(1)}/dy);}
 // A clear near field: the player and the props they are standing among must
 // stay crisp, or the haze reads as a dirty lens instead of as distance.
 od=od*smoothstep(${FOG_NEAR.toFixed(1)},${FOG_FULL.toFixed(1)},d);
 let fog=min(1.0-exp(-max(od,0.0)),${FOG_MAX.toFixed(3)});
 // Forward scattering: looking toward the buried sun, the haze itself glows.
 let inscatter=skyColor(dir)+SUN_COLOR*pow(max(dot(dir,SUN_DIR),0.0),10.0)*0.40;
 return mix(c,inscatter,fog);
}

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
