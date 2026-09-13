// -----------------------------------------------------------------------------
// Shell fur.
//
// Each shell is a copy of the trim's surface, pushed further out. This shader
// decides, per pixel per shell, whether a strand is still present there. Two
// hashed quantities per strand cell do all the work:
//
//   length   how far up the shell stack this strand survives. Uniform-length
//            fur reads as a sponge; the variation is what makes it fur.
//   radius   the strand's cross-section, tapering to nothing at its own tip, so
//            the silhouette is pointed rather than cut off flat.
//
// Lighting is deliberately not a surface BRDF. A strand is a fibre: it scatters
// forward strongly, wraps light most of the way round, and its roots are buried
// in shadow. Wrapped diffuse plus a strong transmission lobe plus depth-based
// occlusion gets all three, and white fur against a low sun then does the thing
// white fur does, which is glow around its edges.
// -----------------------------------------------------------------------------

#include<snowNoise>
#include<snowShading>
#include<snowAtmosphere>

varying vWorld: vec3f;
varying vNormal: vec3f;
varying vUV: vec2f;
varying vAux: vec2f;
varying vViewDist: f32;

var skyLUT: texture_2d<f32>;
var skyLUTSampler: sampler;
var cascade0: texture_2d<f32>;
var cascade0Sampler: sampler;
var cascade1: texture_2d<f32>;
var cascade1Sampler: sampler;
var cascade2: texture_2d<f32>;
var cascade2Sampler: sampler;

uniform cameraPos: vec3f;
uniform sunDir: vec3f;
uniform sunRadiance: vec3f;
uniform shR: array<vec4f, 9>;

uniform cascadeMatrices: array<mat4x4f, 3>;
uniform cascadeSplits: vec4f;
uniform cascadeParams: array<vec4f, 3>;
uniform shadowTexel: f32;
uniform shadowSoftness: f32;
uniform shadowBias: f32;

uniform fogDensity: f32;
uniform fogHeightFalloff: f32;
uniform fogStart: f32;
uniform aerialStrength: f32;
uniform ambientIntensity: f32;

/// Strand cells per metre of surface. 260 is a 3.8 mm pitch.
uniform furDensity: f32;
uniform furColor: vec3f;

#include<snowShadowLookup>

@fragment
fn main(input: FragmentInputs) -> FragmentOutputs {
    let t = input.vAux.x;

    // ---------------------------------------------------------- strand field
    let g = input.vUV * uniforms.furDensity;
    let cell = floor(g);
    let h = hash21(cell);
    let jitter = hash22(cell + vec2f(11.3, 5.7)) - 0.5;

    // How far up this strand reaches. The old 0.30 floor meant a third of the
    // cells died in the bottom tenth of the stack and the length histogram was
    // uniform over the whole band, so the upper shells were mostly holes with a
    // few survivors sticking out — which is exactly what "white static" looks
    // like. A real pelt is the opposite: nearly every fibre reaches close to the
    // same height and the variation is in the last fifth. Narrow the spread and
    // the band closes up into plush with a broken edge instead of a comb.
    let strandLen = 0.62 + 0.38 * h;
    if (t > strandLen) { discard; }

    // Distance to the strand's own axis, in cell units.
    let d = length(fract(g) - 0.5 - jitter * 0.55);
    // Taper: full width at the root, narrowing toward the tip. sqrt held the
    // width almost to the end and then closed to a point, which is a needle;
    // a shallower exponent keeps the fibre blunt and its coverage even, so the
    // top of the stack still reads as a surface.
    let taper = 1.0 - (t / strandLen);
    let radius = 0.54 * (0.72 + 0.28 * hash21(cell + vec2f(3.1, 9.4))) * pow(max(taper, 0.0), 0.32);
    if (d > radius) { discard; }

    // ------------------------------------------------------------- shading
    let world = input.vWorld;
    let V = normalize(uniforms.cameraPos - world);
    let L = uniforms.sunDir;
    var N = normalize(input.vNormal);
    if (dot(N, V) < 0.0) { N = -N; }

    let noiseRot = ign(input.position.xy) * 6.28318530718;
    var shadow = sunShadow(world, N, input.vViewDist, noiseRot);
    // Matches the fabric's floor. They are adjacent surfaces on the same hood,
    // so a different floor on each draws a value step along the seam that has
    // nothing to do with the geometry.
    shadow = mix(0.10, 1.0, shadow);

    // Self-occlusion down the stack. Roots see almost no sky, tips see all of
    // it — this gradient is what gives shell fur its depth, and without it the
    // trim reads as a flat white band. Pulling the root floor down and squaring
    // harder is the other half of the plush read: the band needs a dark seam
    // where it meets the hood, or the trim looks stuck on rather than sewn in.
    //
    // Cubed off a 0.07 floor put three quarters of the stack under a third of
    // full occlusion, which is a dark mat with a bright fringe rather than a
    // pelt — and it made the band five times less efficient at turning albedo
    // into radiance than the fabric beside it, so the only way to get the trim
    // to read at all was to make it near-white. Quadratic off a higher floor
    // keeps the root seam without burying the body of the pile.
    let depth = t / max(strandLen, 1e-3);
    let selfAO = 0.16 + 0.84 * depth * depth;

    const INV_PI: f32 = 0.31830988618;
    let sun = uniforms.sunRadiance;
    let NdotL = dot(N, L);

    // Fibres wrap light almost all the way round.
    let diff = wrapDiffuse(NdotL, 0.65);
    var color = uniforms.furColor * INV_PI * sun * diff * shadow * selfAO;

    // Transmission — the term that makes a fur rim light up against a low sun.
    // At 0.85 this was strong enough to blow the tips to paper white and halo
    // them into the bloom, which is what turned the rim into a glowing fringe.
    let back = backScatter(N, L, V, 0.5, 3.0, 1.0);
    color += sun * uniforms.furColor * back * 0.50 * mix(0.4, 1.0, shadow) * selfAO;

    // A dim, wide specular. Fur is not glossy, but a completely matte white
    // reads as paper.
    if (NdotL > 0.0) {
        let H = normalize(V + L);
        let ds = distributionGGX(clamp(dot(N, H), 0.0, 1.0), 0.75);
        color += sun * ds * 0.05 * NdotL * shadow * selfAO;
    }

    let irradiance = shIrradiance(N, uniforms.shR) * uniforms.ambientIntensity;
    color += uniforms.furColor * INV_PI * irradiance * selfAO * input.vAux.y * 1.05;

    color = applyAerial(
        color, uniforms.cameraPos, world, -V, L,
        skyLUT, skyLUTSampler, sun,
        uniforms.fogDensity, uniforms.fogHeightFalloff, uniforms.fogStart,
        uniforms.aerialStrength
    );

    fragmentOutputs.color = vec4f(color, 1.0);
}
