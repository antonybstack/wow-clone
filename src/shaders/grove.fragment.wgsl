#include<snowNoise>
#include<snowShading>
#include<snowAtmosphere>

varying vWorld: vec3f;
varying vN: vec3f;
varying vViewDist: f32;

var skyLUT: texture_2d<f32>;
var skyLUTSampler: sampler;
var groveAtlas: texture_2d<f32>;
var groveAtlasSampler: sampler;
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
uniform ambientIntensity: f32;
uniform fogDensity: f32;
uniform fogHeightFalloff: f32;
uniform fogStart: f32;
uniform aerialStrength: f32;
/// 0 bark, 1 leaf, 2 well, 3 wisp, 4 stone, 5 flora, 6 plaster
uniform groveKind: f32;
uniform tint: vec3f;
uniform time: f32;
uniform cascadeMatrices: array<mat4x4f, 3>;
uniform cascadeSplits: vec4f;
uniform cascadeParams: array<vec4f, 3>;
uniform shadowTexel: f32;
uniform shadowSoftness: f32;
uniform shadowBias: f32;

#include<snowShadowLookup>

@fragment
fn main(input: FragmentInputs) -> FragmentOutputs {
    var N = normalize(input.vN);
    let world = input.vWorld;
    let V = normalize(uniforms.cameraPos - world);
    let L = uniforms.sunDir;
    const INV_PI: f32 = 0.31830988618;

    var albedo = uniforms.tint;
    var roughness = 0.72;
    let kind = uniforms.groveKind;
    var emit = vec3f(0.0);

    // Babylon WGSL `main` returns FragmentOutputs — never bare-return.
    if (kind > 2.5 && kind < 3.5) {
        let pulse = 0.45 + 0.55 * (0.5 + 0.5 * sin(uniforms.time * 2.2 + world.x * 3.0));
        // Bright at the centre, gone at the silhouette, and faint throughout.
        //
        // At a flat 0.62 alpha the moonwell's glow announced itself as a
        // hard-edged polygon hanging over the glade; at 0.62 with a falloff it
        // became a solid pale dome sitting on the water like an igloo. A glow
        // has to stay thin enough to see the water through.
        let soft = pow(max(dot(N, V), 0.0), 2.2);
        fragmentOutputs.color = vec4f(uniforms.tint * pulse, 0.14 * soft);
    } else if (kind > 6.5 && kind < 7.5) {
        // Held staff crystal — a small HDR core that bloom can catch.
        let pulse = 0.72 + 0.28 * (0.5 + 0.5 * sin(uniforms.time * 5.5));
        let core = pow(max(dot(N, V), 0.0), 1.15);
        let rim = pow(1.0 - max(dot(N, V), 0.0), 2.8);
        let rgb = uniforms.tint * pulse * (0.55 + 2.4 * core) + uniforms.tint * rim * 0.85;
        fragmentOutputs.color = vec4f(rgb, clamp(0.35 + 0.55 * core, 0.0, 0.92));
    } else {
        if (kind < 0.5) {
            // Moonlit bark: cool grey with vertical fibre and dark grooves.
            //
            // The pattern this replaces was a sine of a sine taken around the
            // trunk, which drew a single wavy stripe spiralling up every tree
            // in the glade — identical on all of them, and reading as painted
            // wallpaper rather than as bark. Real bark fibre runs *along* the
            // trunk, so the noise is high frequency around and low along it.
            let around = atan2(N.z, N.x);
            let barkUv = vec2f(fract(around * 1.4) * 0.49 + 0.005, fract(world.y * 0.06));
            let barkS = textureSample(groveAtlas, groveAtlasSampler, barkUv).rgb;
            // The along-trunk frequency matters as much as the around one. Too
            // low and the fibre never breaks, so the grooves run unbroken from
            // root to crown and the trunk reads as brushed metal.
            let fibre = noise2(vec2f(around * 11.0, world.y * 1.30)) * 0.5 + 0.5;
            let groove = noise2(vec2f(around * 26.0, world.y * 0.55)) * 0.5 + 0.5;
            let grain = clamp(fibre * 0.62 + groove * 0.38, 0.0, 1.0);
            // A real value range, but still a dark wood. The old 0.09-0.20 was
            // a barbell against the bright canopy and every trunk read as a
            // black silhouette pole; open the top too far instead and the
            // glade fills with pale birch.
            albedo = mix(vec3f(0.038, 0.041, 0.050), vec3f(0.105, 0.112, 0.130), smoothstep(0.16, 0.90, grain));
            albedo = mix(albedo, albedo * barkS, 0.28);
            albedo = mix(albedo, uniforms.tint, 0.14);
            // Per-trunk value variation, quantised to two-metre cells so it is
            // near constant over any one trunk. Without it the forest wall is
            // ninety identical pale poles standing in a row.
            let trunkVar = noise2(floor(world.xz * 0.5) * 1.37) * 0.5 + 0.5;
            albedo *= 0.58 + 0.80 * trunkVar;
            let moss = smoothstep(-0.10, 0.62, N.y)
                * (0.30 + 0.70 * (noise2(world.xz * 1.05) * 0.5 + 0.5));
            albedo = mix(albedo, vec3f(0.055, 0.115, 0.058), moss * 0.32);
            roughness = 0.88;
        } else if (kind < 1.5) {
            // Dusk umbrellas — dusty rose / muted amber / moss.
            //
            // Saturation is the whole fix here. The old rose was a 0.36 red
            // against a 0.055 green, which under a magenta fill came out as
            // bubblegum and made the canopy read as a bowl of sweets. These sit
            // at roughly a third of that chroma, in the AgX midtones, and let
            // the moss variant actually read as a different species rather
            // than as a stray green pixel.
            let cell = floor(world.xz * 0.52 + vec2f(world.y * 0.14));
            let hue = fract(sin(dot(cell, vec2f(127.1, 311.7))) * 43758.5453);
            let rose = vec3f(0.225, 0.105, 0.150);
            let gold = vec3f(0.215, 0.150, 0.070);
            let green = vec3f(0.080, 0.145, 0.075);
            albedo = mix(rose, gold, step(0.52, hue));
            albedo = mix(albedo, green, step(0.80, hue));
            albedo = mix(albedo, uniforms.tint, 0.22);
            let speckle = noise2(world.xz * 7.5 + world.y * 2.2) * 0.5 + 0.5;
            albedo *= 0.72 + 0.38 * speckle;
            // The canopy has a top and a bottom. Without this every puff shades
            // identically all the way round and the crown reads as a cluster of
            // free-floating spheres instead of as foliage over a glade.
            albedo *= 0.60 + 0.40 * clamp(N.y * 0.5 + 0.5, 0.0, 1.0);
            if (dot(N, V) < 0.0) {
                albedo *= 0.42;
                N = -N;
            }
            roughness = 0.90;
        } else if (kind < 2.5) {
            // Moonwell: deep water that mostly shows the sky it reflects, with
            // only a breath of its own light. A flat 0.32 emissive over a cyan
            // tint is what made both pools read as swimming-pool paint sitting
            // on top of the grass rather than as water sunk into it.
            let pulse = 0.55 + 0.45 * sin(uniforms.time * 1.4);
            albedo = mix(vec3f(0.012, 0.030, 0.052), uniforms.tint, 0.34 + 0.22 * pulse);
            roughness = 0.06;
            emit = uniforms.tint * 0.10;
        } else if (kind < 4.5) {
            // Stone, rim and timber. Grain along the longest axis of the piece,
            // approximated from the face normal: a plank lit as flat tint is
            // the cardboard-cutout look the hut's porch had.
            let n = noise2(world.xz * 1.8 + world.y * 0.6);
            albedo *= 0.75 + 0.25 * n;
            let vert = 1.0 - abs(N.y);
            let grain = noise2(vec2f(world.x * 2.4 + world.z * 2.4, world.y * 14.0)) * 0.5 + 0.5;
            albedo *= mix(1.0, 0.84 + 0.32 * grain, vert * 0.7);
            roughness = 0.78;
        } else if (kind < 5.5) {
            // Caps: pale on top, gilled and faintly luminous underneath.
            //
            // The flat `tint * 0.22` emissive this replaces lit the entire cap
            // evenly, top and bottom alike, which removed every cue that the
            // thing had a form — hence the flat pink parasols. Light belongs
            // under a mushroom, in the gills, where it also does the useful
            // job of separating the cap's rim from the grass behind it.
            let up = clamp(N.y, -1.0, 1.0);
            let top = smoothstep(-0.12, 0.58, up);
            let deep = uniforms.tint * vec3f(0.34, 0.38, 0.50);
            albedo = mix(deep, uniforms.tint, top);
            // N.xz points radially outward on a cap, so the normal alone gives
            // the angle around it without needing the cap's own centre.
            //
            // Guarded because atan2(0, 0) is undefined, and a flat up-facing
            // flower disc has exactly that normal for every one of its
            // fragments. Unguarded it returned NaN, `under` being zero could
            // not swallow it, and the bloom downsample smeared the result into
            // black tiles across the whole frame.
            let radial = vec2f(N.x, N.z);
            let around = select(0.0, atan2(N.z, N.x), length(radial) > 1.0e-4);
            let gill = 0.5 + 0.5 * sin(around * 30.0);
            let under = 1.0 - smoothstep(-0.42, 0.08, up);
            albedo *= 1.0 - 0.34 * gill * under;
            let pulse = 0.82 + 0.18 * sin(uniforms.time * 1.4 + world.x * 2.2 + world.z * 1.7);
            emit = uniforms.tint * vec3f(0.32, 0.58, 0.78) * 0.34 * under * pulse;
            roughness = 0.62;
        } else {
            // Warm plaster, not a white cube.
            let n = noise2(world.xz * 2.2 + world.y * 1.1);
            albedo *= 0.72 + 0.22 * (n * 0.5 + 0.5);
            // Daub between timbers, and a trowelled surface. A single smooth
            // noise over a 6-metre wall left it reading as one flat panel.
            let coarse = noise2(vec2f(world.x + world.z, world.y) * 7.5) * 0.5 + 0.5;
            albedo *= 0.86 + 0.28 * coarse;
            let studs = smoothstep(0.42, 0.50, abs(fract((world.x + world.z) * 0.62) - 0.5));
            albedo = mix(albedo * 0.62, albedo, studs);
            roughness = 0.74;
        }

        let NdotL = dot(N, L);
        let diff = wrapDiffuse(NdotL, 0.28);
        // Same CSM the lawn and the hero sample. Grove used to cast shadows on
        // grass but never receive them, so trunks and crowns stayed full-bright
        // under their own canopy — and sunK was a bandage for that.
        let pix = input.position.xy;
        let noiseRot = ign(pix) * 6.28318530718;
        var shadow = 1.0;
        if (NdotL > -0.35) {
            shadow = sunShadow(world, N, input.vViewDist, noiseRot);
        }
        // Night shadow floor — trunks under canopy stay bark-readable.
        shadow = mix(0.38, 1.0, shadow);
        var color = albedo * INV_PI * uniforms.sunRadiance * max(diff, 0.04) * shadow;
        color += albedo * INV_PI * shIrradiance(N, uniforms.shR) * uniforms.ambientIntensity;
        color += emit;
        if (kind > 0.5 && kind < 1.5) {
            let rim = pow(1.0 - max(dot(N, V), 0.0), 2.2);
            color += albedo * rim * 0.18 * mix(0.35, 1.0, shadow);
        }

        let dist = length(world - uniforms.cameraPos);
        if (kind > 0.5 && kind < 1.5) {
            color *= 1.0 - 0.20 * smoothstep(32.0, 88.0, dist);
        }
        // Forest wall only. Earlier ramps turned mid trunks into chalk poles.
        let fogAmt = smoothstep(52.0, 120.0, dist);
        color = applyAerial(
            color, uniforms.cameraPos, world, -V, L,
            skyLUT, skyLUTSampler, uniforms.sunRadiance,
            uniforms.fogDensity, uniforms.fogHeightFalloff, uniforms.fogStart,
            uniforms.aerialStrength * fogAmt
        );

        fragmentOutputs.color = vec4f(color, 1.0);
    }
}
