/**
 * V16 isotropic lantern specular, in linear HDR.
 * Append after LOCAL_LIGHT_WGSL. Uses its localRadiance0/1 (including shadows)
 * and shaderUniforms.localPosition0/1; native PBR replaces shaderUniforms. with
 * material. Pass world position/normal, a surface-to-camera vector, perceptual
 * roughness and linear RGB F0. Strength is applied by the caller, not here.
 * No extra textures, uniforms, display transform or ambient/specular lighting.
 */
export const LOCAL_SPECULAR_WGSL = `
// GGX distribution, Schlick Fresnel and Schlick-Smith visibility. Keep names
// separate from Lite's native BRDF helpers. Clamp the response, not HDR radiance.
fn ashenLocalSpecularBRDF(n:vec3<f32>,v:vec3<f32>,l:vec3<f32>,roughness:f32,f0:vec3<f32>)->vec3<f32>{
 let nl=clamp(dot(n,l),0.0,1.0);let nv=clamp(dot(n,v),0.0,1.0);
 if(nl<=0.0 || nv<=0.0){return vec3<f32>(0.0);}
 let halfVector=v+l;let halfLength2=dot(halfVector,halfVector);
 if(halfLength2<0.00000001){return vec3<f32>(0.0);}
 let h=halfVector*inverseSqrt(halfLength2);
 let nh=clamp(dot(n,h),0.0,1.0);let vh=clamp(dot(v,h),0.0,1.0);
 let r=clamp(roughness,0.22,1.0);let alpha=r*r;let a2=alpha*alpha;
 let d=nh*nh*(a2-1.0)+1.0;
 let distribution=a2/(3.141592653589793*d*d);
 let k=(r+1.0)*(r+1.0)*0.125;
 // G(nl)*G(nv)*nl/(4*nl*nv), algebraically cancelled to avoid grazing 0/0.
 let visibilityCosine=nl/(4.0*(nl*(1.0-k)+k)*(nv*(1.0-k)+k));
 let base=clamp(f0,vec3<f32>(0.0),vec3<f32>(1.0));
 let t=1.0-vh;let t2=t*t;
 let fresnel=base+(vec3<f32>(1.0)-base)*(t2*t2*t);
 return min(fresnel*(distribution*visibilityCosine),vec3<f32>(16.0));
}
fn localSpecular(p:vec3<f32>,n:vec3<f32>,view:vec3<f32>,roughness:f32,f0:vec3<f32>)->vec3<f32>{
 let nn=dot(n,n);let vv=dot(view,view);
 if(nn<0.00000001 || vv<0.00000001){return vec3<f32>(0.0);}
 let normal=n*inverseSqrt(nn);let v=view*inverseSqrt(vv);
 var result=vec3<f32>(0.0);
 ${[0, 1].map(i => `{
  let delta=shaderUniforms.localPosition${i}.xyz-p;
  let l=delta*inverseSqrt(max(dot(delta,delta),0.00000001));
  let response=ashenLocalSpecularBRDF(normal,v,l,roughness,f0);
  if(any(response>vec3<f32>(0.0))){result+=localRadiance${i}(p,normal)*response;}
 }`).join('\n')}
 return result;
}`;

/** CPU reference for mathematical tests; returns BRDF * NdotL, not radiance. */
export function localSpecularBRDF(normal, view, light, roughness, f0) {
 const unit = value => {
  const length = Math.hypot(...value);
  return length >= 1e-4 && Number.isFinite(length) ? value.map(x => x / length) : null;
 };
 const n = unit(normal), v = unit(view), l = unit(light);
 const zero = [0, 0, 0];
 if (!n || !v || !l || !Number.isFinite(roughness) || !f0.every(Number.isFinite)) return zero;
 const dot = (a, b) => a.reduce((sum, x, i) => sum + x * b[i], 0);
 const clamp = x => Math.max(0, Math.min(1, x));
 const nl = clamp(dot(n, l)), nv = clamp(dot(n, v));
 if (nl <= 0 || nv <= 0) return zero;
 const h = unit(v.map((x, i) => x + l[i]));
 if (!h) return zero;
 const nh = clamp(dot(n, h)), vh = clamp(dot(v, h));
 const r = Math.max(.22, Math.min(1, roughness)), a2 = r ** 4;
 const d = nh * nh * (a2 - 1) + 1;
 const distribution = a2 / (Math.PI * d * d);
 const k = (r + 1) ** 2 / 8;
 const visibilityCosine = nl / (4 * (nl * (1 - k) + k) * (nv * (1 - k) + k));
 return f0.map(value => {
  const base = clamp(value), fresnel = base + (1 - base) * (1 - vh) ** 5;
  return Math.min(16, fresnel * distribution * visibilityCosine);
 });
}
