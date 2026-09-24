/** Scene radiance is linear. Only the final presentation pass encodes for SDR. */
export const HDR_FORMAT='rgba16float';
export const DEFAULT_EXPOSURE=.9;
export const DEFAULT_SATURATION=1.05;
const clamp=x=>Math.min(1,Math.max(0,x));
export function srgbToLinear(x){x=Math.max(0,x);return x<=.04045?x/12.92:((x+.055)/1.055)**2.4;}
export function linearToSrgb(x){x=Math.max(0,x);return x<=.0031308?x*12.92:1.055*x**(1/2.4)-.055;}
export function displayColor(rgb,{exposure=DEFAULT_EXPOSURE,saturation=DEFAULT_SATURATION}={}){
 const t=rgb.map(v=>{const x=Math.max(0,v)*exposure;return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14));});
 const l=t[0]*.2126+t[1]*.7152+t[2]*.0722;
 return t.map(v=>linearToSrgb(clamp(l+(v-l)*saturation)));
}
export const COLOR_DECODE_WGSL=`
fn srgbToLinear(c:vec3<f32>)->vec3<f32>{
 let x=max(c,vec3<f32>(0.0));
 return select(pow((x+.055)/1.055,vec3<f32>(2.4)),x/12.92,x<=vec3<f32>(.04045));
}`;
export const DISPLAY_WGSL=`
fn displayColor(radiance:vec3<f32>,exposure:f32,saturation:f32)->vec3<f32>{
 let x=max(radiance,vec3<f32>(0.0))*exposure;
 let t=clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),vec3<f32>(0.0),vec3<f32>(1.0));
 let l=dot(t,vec3<f32>(.2126,.7152,.0722));
 let c=clamp(mix(vec3<f32>(l),t,saturation),vec3<f32>(0.0),vec3<f32>(1.0));
 return select(1.055*pow(c,vec3<f32>(1.0/2.4))-.055,c*12.92,c<=vec3<f32>(.0031308));
}`;
