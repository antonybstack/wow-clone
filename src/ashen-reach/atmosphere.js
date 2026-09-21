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
/** The far-field ceiling is what keeps distance from erasing the skyline. It used to
 * be a hard clamp, FOG_MAX; it is now the FOG_KNEE/FOG_FAR pair below, for the reason
 * given there. The tuning history is still the reason those numbers are where they
 * are. Everything past
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
/*  FOG_SCALE_H came down from 22 to 15 to un-flatten the citadel, and the measurement
 *  that motivated it also corrected a wrong diagnosis of mine, so both are recorded
 *  here. I had assumed the old hard FOG_MAX clamp was what flattened the far field.
 *  It is not: the clamp only binds where the sightline stays low. Evaluating the
 *  integral at 260 m gives 0.83 on the ground plane -- clamped -- but 0.52 at the top
 *  of a 58 m tower and 0.50 on a 98 m ridge crest at 400 m, both of which were always
 *  well under the cap. Elevated distant geometry was never clamped, so removing the
 *  clamp could not have fixed it.
 *
 *  What actually buries the citadel is the height profile. At a 22 m scale height the
 *  haze is still thick 56 m up, so roughly half of what reaches the eye from a tower
 *  is inscatter, and the tower's own shading -- which spans about 0.013 to 0.042 for
 *  this near-black stone -- arrives as a 4% modulation on a much brighter constant.
 *  There is no exposure at which that reads as form. At 15 m the same tower keeps 60%
 *  of itself instead of 48%, which is the difference between a tan smudge and a
 *  silhouette with facets.
 *
 *  The ground plane barely moves under this change, 0.68 to 0.67, so the near- and
 *  mid-field haze tuned across the earlier passes is preserved. It buys the towers
 *  and the ridge crests back and leaves everything at eye level alone. */
export const FOG_DENSITY=0.0085,FOG_SCALE_H=15.0,FOG_FLOOR_Y=0.0;
/*  Where the hard FOG_MAX clamp becomes a soft knee, and where that knee asymptotes.
 *  The clamp was flattening the entire far field: 1-exp(-od) reaches 0.62 at about
 *  125 m of level ground, so the moor at 200 m, the citadel at 260 m and the outer
 *  ridge ring at 450 m were all assigned exactly the same fog. Beyond 125 m there was
 *  no aerial perspective at all, which is why the citadel reads as one flat wash with
 *  no separation between its front wall, its rear towers and the mountains behind it.
 *  Below FOG_KNEE the curve is untouched, so every near- and mid-field value tuned in
 *  the earlier passes is preserved to within 0.005; above it the fog keeps climbing
 *  toward FOG_FAR instead of stopping. That restores an ordering across the far field
 *  -- roughly 0.59 at 125 m, 0.69 at 260 m, 0.71 at 450 m -- which is what makes one
 *  ridge sit behind another.
 *
 *  FOG_FAR is deliberately not 0.80, even though the knee only approaches it
 *  asymptotically and would never actually reach it at any distance in this scene. The
 *  note above records that a hard clamp at 0.80 made the ridge rings the brightest
 *  thing in frame. This is a different mechanism -- an asymptote, not a ceiling that
 *  everything past 100 m piles up against -- but the failure it caused is close enough
 *  that the honest move is to stop at a value whose worst case, 0.71 on the outermost
 *  ring, still sits between the accepted 0.62 and the rejected 0.80. */
export const FOG_KNEE=0.50,FOG_FAR=0.74;
/*  How bright the haze is allowed to get in the deep field, as a fraction of the open
 *  sky in the same direction, and the distances over which it falls off.
 *
 *  aerial() has always mixed toward skyColor(dir) outright. That says a fully hazed
 *  object matches the sky exactly, which is why the crag beside the citadel measured
 *  *brighter* than the sky above it (188.9 vs 170.8 on 03-lych-gate) and why the
 *  citadel has never been more than 20% below its background no matter what was done
 *  to the fog curve or the sun lobe: those change how much inscatter there is, never
 *  what it converges to.
 *
 *  Two honest notes about this fix, because the first thing I tried was wrong.
 *
 *  It is art direction, not physics. The tempting story is "a 260 m path carries less
 *  inscatter than the infinite column behind it". That story does not survive contact
 *  with this fog: FOG_SCALE_H is 15 m, so a horizontal 260 m sightline passes through
 *  roughly seventeen times more haze than the vertical column does, and a strictly
 *  physical reading of this model would make the far field brighter than the sky, not
 *  darker. The model is a mood device, not an atmosphere. What is being asserted here
 *  is the art direction that distant land must sit below the sky it stands against --
 *  which is what every dusk reference in the folder does -- and this is the term that
 *  asserts it.
 *
 *  It is keyed to distance, not to fog. My first attempt ramped on the fog value with
 *  a knee at 0.35, reasoning that it would leave the tuned near field untouched. It did,
 *  and it also left the citadel untouched: the towers sit at fog 0.52, only a sixth of
 *  the way up that ramp, so they took an 8% change that measured +0.0 on the tower and
 *  -0.3 on the castle mass against p32. Fog is a poor proxy because the knee at
 *  FOG_KNEE has already flattened it exactly where the interesting geometry is. Ramping
 *  on distance instead puts full strength on the things that are actually far away, and
 *  starting at 110 m still leaves every near and mid-field value from p5, p10 and
 *  p15-p18 bit-identical, because nothing tuned in those passes is beyond 110 m.
 *
 *  The sun glow scales with it rather than being exempt: it is the same haze doing the
 *  scattering, and exempting it would just move the veil from one term to the other. */
export const HAZE_FAR=0.55,HAZE_D0=110.0,HAZE_D1=300.0;
export const FOG_NEAR=7.0,FOG_FULL=30.0;

/** A second, much shallower haze layer that does the job the 22 m one only gestures
 *  at. With one scale height, a crest 20 m above a valley floor sits in 90% of the
 *  same fog as the floor does, so "ridges emerging from mist" comes out as "the
 *  whole landscape is slightly grey". At a 6.5 m e-folding height the integral is
 *  nearly saturated at ground level and nearly empty two storeys up, which is what
 *  puts a distinct waterline on a hillside and lets the woodland above it read
 *  against the woodland below.
 *
 *  It is applied after aerial's own mix and with its own colour, which is why the
 *  two do not collapse into one: the deep layer converges distance onto the sky
 *  behind it, while this one is a bright cool body of air that far low ground sits
 *  *inside*. MIST_MAX below 1 keeps the valley floor visible through it -- a
 *  saturating mist erases the ground instead of pooling on it. */
/*  Numbers, because the first attempt at this layer failed in a way that looked like a
 *  colour problem and was actually a range problem. At density 0.028 the integral was
 *  past the cap at *every* sample I checked -- 80 m of flat ground and a summit 80 m up
 *  at 400 m both came out at 0.52 -- so the layer had no height discrimination at all
 *  and painted a flat grey veil over the whole frame (p19-mist). A mist that saturates
 *  everywhere is just a lower exposure.
 *
 *  These values keep the integral in the part of its range where it still varies: a
 *  distant valley floor reaches the 0.42 cap, while a crest 35 m above that same floor,
 *  at the same distance, sits at 0.11. That four-to-one gap across 35 m of height is the
 *  whole effect. NEAR/FULL push the ramp out past the playable clearing so the grass the
 *  player stands in stays crisp -- at 30 m the layer contributes nothing. */
export const MIST_DENSITY=0.0028,MIST_SCALE_H=7.0,MIST_FLOOR_Y=1.5,MIST_MAX=0.42;
export const MIST_NEAR=45.0,MIST_FULL=130.0;
/** Barely tinted and only slightly cool. The first pass used 1.16/1.18/1.26 over
 *  skyColor(), which is already the brightest value in frame at the horizon; combined
 *  with the saturated integral it blew the sun band out and erased the citadel. Once the
 *  opacity profile was fixed the band went the other way and read as almost nothing: at
 *  1.04 the mist body landed at the same luminance as the tan slope it covers, so 36%
 *  coverage changed the picture by almost no contrast at all. The fix is the body, not
 *  more opacity -- it is blue-weighted, so it separates from warm ground by hue as well
 *  as by value, which is what makes a waterline read without greying the frame. */
export const MIST_TINT=[1.14,1.19,1.34];

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
 let raw=1.0-exp(-max(od,0.0));
 // Soft knee rather than a clamp, see FOG_KNEE above. Saturating exponentially toward
 // FOG_FAR keeps the function monotonic and bounded, so nothing can ever fully erase
 // the skyline -- which is the property FOG_MAX was protecting -- while still leaving
 // the far field with a slope to order it by.
 var fog=raw;
 if(raw>${FOG_KNEE.toFixed(3)}){fog=${FOG_KNEE.toFixed(3)}+(${FOG_FAR.toFixed(3)}-${FOG_KNEE.toFixed(3)})*(1.0-exp(-(raw-${FOG_KNEE.toFixed(3)})/(${FOG_FAR.toFixed(3)}-${FOG_KNEE.toFixed(3)})));}
 // Forward scattering: looking toward the buried sun, the haze itself glows.
 // Forward-scatter glow, tightened from pow 10 / 0.40 to pow 15 / 0.30. At the old
 // width it was still at 54% of full strength 20 degrees off the sun, which is most
 // of the southern sky, so every backlit thing in that half of the frame was veiled
 // by it rather than only the things actually near the disc. The citadel sat 17%
 // below the sky it stands against -- a backlit castle should be far darker than
 // that -- and the crag beside it came out *brighter* than the dome, which is the
 // "reads as a mist bank rather than land" failure the FOG_MAX note describes,
 // reappearing locally in the sun direction. Narrower keeps the glow where the light
 // actually is and gives the silhouettes their value back.
 // Finite-path inscatter, see HAZE_FAR above. Near and mid field pass through at 1.0.
 let hz=mix(1.0,${HAZE_FAR.toFixed(3)},smoothstep(${HAZE_D0.toFixed(1)},${HAZE_D1.toFixed(1)},d));
 let inscatter=(skyColor(dir)+SUN_COLOR*pow(max(dot(dir,SUN_DIR),0.0),15.0)*0.30)*hz;
 var out=mix(c,inscatter,fog);
 // Ground mist. Same analytic integral, a quarter of the scale height, so it fills
 // the low ground and clears off the crests instead of greying everything equally.
 let mb=${MIST_DENSITY.toFixed(5)}*d*exp(-(cam.y-${MIST_FLOOR_Y.toFixed(1)})/${MIST_SCALE_H.toFixed(1)});
 var mo:f32;
 if(abs(dy)<0.05){mo=mb;}
 else{mo=mb*(1.0-exp(-dy/${MIST_SCALE_H.toFixed(1)}))*(${MIST_SCALE_H.toFixed(1)}/dy);}
 mo=mo*smoothstep(${MIST_NEAR.toFixed(1)},${MIST_FULL.toFixed(1)},d);
 let mist=min(1.0-exp(-max(mo,0.0)),${MIST_MAX.toFixed(3)});
 let mistBody=skyColor(vec3<f32>(dir.x,0.02,dir.z))*${w3(MIST_TINT)}
  +SUN_COLOR*pow(max(dot(dir,SUN_DIR),0.0),9.0)*0.14;
 return mix(out,mistBody,mist);
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
