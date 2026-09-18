// -----------------------------------------------------------------------------
// snowLocalShadow — cube-face lookup for the staff-tip point light.
//
// Six R32F maps, one per cubemap face, written by the same displaced depth
// shaders the sun cascades use. Stored NDC z; sampled with the matching
// view-projection. Y is *added* in the NDC→UV convert because Babylon flips
// clip Y when rendering into an RTT (see snowShadowLookup).
//
// Contract — a material including this must declare:
//
//   uniform localShadowPos: vec4f            (xyz tip, w far metres)
//   uniform localShadowBias: f32
//   uniform localShadowEnabled: f32
//   uniform localShadowMatrices: array<mat4x4f, 6>
//   var local0..local5: texture_2d<f32> + matching samplers
// -----------------------------------------------------------------------------

fn localFace(d: vec3f) -> i32 {
    let a = abs(d);
    if (a.x >= a.y && a.x >= a.z) { return select(1, 0, d.x >= 0.0); }
    if (a.y >= a.x && a.y >= a.z) { return select(3, 2, d.y >= 0.0); }
    return select(5, 4, d.z >= 0.0);
}

fn sampleLocalFace(face: i32, uv: vec2f) -> f32 {
    switch face {
        case 0: { return textureSampleLevel(local0, local0Sampler, uv, 0.0).r; }
        case 1: { return textureSampleLevel(local1, local1Sampler, uv, 0.0).r; }
        case 2: { return textureSampleLevel(local2, local2Sampler, uv, 0.0).r; }
        case 3: { return textureSampleLevel(local3, local3Sampler, uv, 0.0).r; }
        case 4: { return textureSampleLevel(local4, local4Sampler, uv, 0.0).r; }
        case 5: { return textureSampleLevel(local5, local5Sampler, uv, 0.0).r; }
        default: { return 1.0; }
    }
}

/// 1 = fully lit by the orb, 0 = occluded. Safe to call when disabled.
fn localShadowAt(world: vec3f, geoN: vec3f) -> f32 {
    if (uniforms.localShadowEnabled < 0.5) { return 1.0; }
    let key = uniforms.localShadowPos.xyz;
    let far = uniforms.localShadowPos.w;
    let toLight = key - world;
    let dist2 = dot(toLight, toLight);
    if (dist2 > far * far) { return 1.0; }

    let dir = world - key;
    let face = localFace(dir);
    let m = uniforms.localShadowMatrices[face];

    let Ln = toLight * inverseSqrt(max(dist2, 1e-8));
    let ndl = max(dot(geoN, Ln), 0.0);
    let biased = world + geoN * uniforms.localShadowBias * (1.4 + 4.0 * (1.0 - ndl));

    let clip = m * vec4f(biased, 1.0);
    let w = max(clip.w, 1e-6);
    let ndc = clip.xyz / w;
    if (any(abs(ndc.xy) > vec2f(0.997)) || ndc.z < 0.0 || ndc.z > 1.0) { return 1.0; }

    // Same Y convention as the cascade maps (RTT clip-Y flip).
    let uv = vec2f(ndc.x * 0.5 + 0.5, ndc.y * 0.5 + 0.5);
    let texel = 1.0 / 256.0;
    let zBias = 0.0022;
    var s = 0.0;
    s += step(ndc.z, sampleLocalFace(face, uv + vec2f(-texel, -texel)) + zBias);
    s += step(ndc.z, sampleLocalFace(face, uv + vec2f( texel, -texel)) + zBias);
    s += step(ndc.z, sampleLocalFace(face, uv + vec2f(-texel,  texel)) + zBias);
    s += step(ndc.z, sampleLocalFace(face, uv + vec2f( texel,  texel)) + zBias);
    return s * 0.25;
}
