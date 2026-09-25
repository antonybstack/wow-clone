/** Cotangent frame from continuous UVs; albedo can keep its pixel quantization. */
export const SURFACE_DETAIL_WGSL=`
fn stoneNormal(p:vec3<f32>,uv:vec2<f32>,normal:vec3<f32>,encoded:vec3<f32>,strength:f32)->vec3<f32>{
 let dp1=dpdx(p);let dp2=dpdy(p);let duv1=dpdx(uv);let duv2=dpdy(uv);
 let perpendicular2=cross(dp2,normal);let perpendicular1=cross(normal,dp1);
 let tangent=perpendicular2*duv1.x+perpendicular1*duv2.x;
 // Image V runs downward; match Lite's cotangent path for OpenGL normal maps.
 let bitangent=-(perpendicular2*duv1.y+perpendicular1*duv2.y);
 let scale=inverseSqrt(max(max(dot(tangent,tangent),dot(bitangent,bitangent)),.00000001));
 let sampled=encoded*2.0-1.0;
 let mapped=normalize(tangent*scale*sampled.x+bitangent*scale*sampled.y+normal*max(sampled.z,.05));
 return normalize(mix(normal,mapped,clamp(strength,0.0,1.0)));
}`;
