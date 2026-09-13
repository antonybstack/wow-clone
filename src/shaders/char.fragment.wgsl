// -----------------------------------------------------------------------------
// The fabric material — shared by the skinned body and the simulated garments.
//
// A plain PBR dielectric is the wrong model for cloth and looks it. Three terms
// carry the difference:
//
//   sheen        A retroreflective lobe from the fibres standing proud of the
//                surface. It is why wool has a bright *rim* rather than a
//                bright *highlight*, and it is the single term that stops this
//                reading as painted plastic. Charlie distribution, which is an
//                inverted Gaussian: energy piles up at grazing angles instead
//                of around the mirror direction.
//   anisotropy   The weave has a direction. A GGX lobe stretched along the warp
//                gives the soft directional streak real woven cloth has, and it
//                is what makes the mantle's shoulder read as a fabric plane and
//                not a shaded cylinder.
//   transmission Thin fabric over a lit edge glows. Same back-scatter term the
//                snow uses, which is not a coincidence — it is the same physics
//                at a different mean free path.
//
// On top of that a procedural weave supplies a normal and a cavity at a scale
// far below the geometry, faded out by pixel footprint so it never aliases.
//
// Everything downstream of the BRDF — cascade selection, PCSS, aerial
// perspective — is the identical code the snow runs, from shared includes. The
// character has to sit in the same light as the field or it will look pasted on
// no matter how good the fabric is.
// -----------------------------------------------------------------------------

#include<snowNoise>
#include<snowShading>
#include<snowSpellLights>
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

/// Per material slot: rgb = albedo, a = base roughness.
uniform matAlbedo: array<vec4f, 8>;
/// Per material slot: (sheen, anisotropy, transmission, weave depth).
uniform matParams: array<vec4f, 8>;

uniform fogDensity: f32;
uniform fogHeightFalloff: f32;
uniform fogStart: f32;
uniform aerialStrength: f32;
uniform ambientIntensity: f32;
uniform sssStrength: f32;
/// Weave threads per metre. UVs arrive in metres of surface, so this is the
/// only place the physical scale of the cloth is decided.
uniform weaveDensity: f32;
uniform screenSize: vec2f;

uniform spellLightPos: array<vec4f, 4>;
uniform spellLightCol: array<vec4f, 4>;
uniform spellLightCount: f32;

#include<snowShadowLookup>

/// Charlie sheen distribution. `roughness` here is the fibre roughness, and it
/// wants to be high — 0.3 or below turns the rim into a hard line.
fn dCharlie(NdotH: f32, roughness: f32) -> f32 {
    let invR = 1.0 / max(0.05, roughness);
    let cos2h = NdotH * NdotH;
    let sin2h = max(1.0 - cos2h, 1e-4);
    return (2.0 + invR) * pow(sin2h, invR * 0.5) / (2.0 * PI);
}

/// Ashikhmin's visibility term — cheap, and the only one that keeps sheen
/// energy sane at grazing angles where the whole lobe lives.
fn vAshikhmin(NdotV: f32, NdotL: f32) -> f32 {
    return 1.0 / max(1e-4, 4.0 * (NdotL + NdotV - NdotL * NdotV));
}

/// Anisotropic GGX, Burley's parameterisation.
fn dGGXAniso(TdotH: f32, BdotH: f32, NdotH: f32, ax: f32, ay: f32) -> f32 {
    let a2 = ax * ay;
    let d = vec3f(ay * TdotH, ax * BdotH, a2 * NdotH);
    let d2 = dot(d, d);
    if (d2 < 1e-9) { return 0.0; }
    let b2 = a2 / d2;
    return a2 * b2 * b2 / PI;
}

/// Procedural plain weave: a tangent-space normal in xy and a cavity in z.
///
/// Warp and weft alternate which one is on top, and the one on top gets the
/// stronger ridge. That alternation is the whole read — two crossed sine
/// ridges without it look like a grid, not a textile.
fn weave(uv: vec2f) -> vec3f {
    let p = uv * 6.28318530718;
    let warp = sin(p.x);
    let weft = sin(p.y);
    let over = smoothstep(-0.35, 0.35, warp * weft);
    let nx = cos(p.x) * mix(0.30, 1.0, over);
    let ny = cos(p.y) * mix(1.0, 0.30, over);
    // Cavity is deepest where neither thread is at its crown.
    //
    // A 45% swing between crown and interstice is a value modulation you can
    // read across a room, and it is what turned the weave from a texture into a
    // visible lattice drawn over the garment. The gap between two threads is
    // shadowed, not unlit.
    let cav = 0.80 + 0.20 * max(abs(warp), abs(weft));
    return vec3f(nx, ny, cav);
}

/// Karis' analytic split-sum environment BRDF.
///
/// Not an optimisation — a correction. Multiplying prefiltered sky radiance by
/// `fresnelSchlickRough` alone overestimates badly at grazing angles on a rough
/// surface: the roughness clamp makes the reflectance run to `1 - roughness`
/// there, which for wool is 0.2 of the *whole sky* on every silhouette pixel.
/// The result was a navy robe rendering as pale grey whenever the camera looked
/// across it, with a dark albedo that had nothing to do with the outcome.
fn envBRDFApprox(f0: vec3f, roughness: f32, NdotV: f32) -> vec3f {
    let c0 = vec4f(-1.0, -0.0275, -0.572, 0.022);
    let c1 = vec4f(1.0, 0.0425, 1.04, -0.04);
    let r = vec4f(roughness) * c0 + c1;
    let a004 = min(r.x * r.x, exp2(-9.28 * NdotV)) * r.x + r.y;
    return f0 * (-1.04 * a004 + r.z) + (1.04 * a004 + r.w);
}

/// Screen-space cotangent frame. Works identically for the skinned body and the
/// Catmull-Rom garments, neither of which carries an authored tangent.
fn cotangentFrame(N: vec3f, dp1: vec3f, dp2: vec3f, duv1: vec2f, duv2: vec2f) -> mat3x3f {
    let dp2perp = cross(dp2, N);
    let dp1perp = cross(N, dp1);
    let T = dp2perp * duv1.x + dp1perp * duv2.x;
    let Bv = dp2perp * duv1.y + dp1perp * duv2.y;
    let invmax = inverseSqrt(max(max(dot(T, T), dot(Bv, Bv)), 1e-12));
    return mat3x3f(T * invmax, Bv * invmax, N);
}

@fragment
fn main(input: FragmentInputs) -> FragmentOutputs {
    let world = input.vWorld;
    let V = normalize(uniforms.cameraPos - world);
    let L = uniforms.sunDir;

    // Garments are open sheets and the hood is a shell, so the camera sees both
    // sides of nearly everything. Rather than depend on winding — which for
    // procedurally lofted geometry is one sign error away from inside-out — the
    // normal is simply turned to face the viewer. For a surface this thin that
    // is also physically the right answer.
    var N = normalize(input.vNormal);
    let twoSided = dot(N, V) < 0.0;
    if (twoSided) { N = -N; }
    let geoN = N;

    let slot = clamp(i32(input.vAux.x + 0.5), 0, 7);
    let alb4 = uniforms.matAlbedo[slot];
    let par = uniforms.matParams[slot];
    var albedo = alb4.rgb;
    var roughness = alb4.a;
    let sheenAmt = par.x;
    let aniso = par.y;
    let transmit = par.z;
    let weaveDepth = par.w;

    // ------------------------------------------------------------ weave detail
    let wuv = input.vUV * uniforms.weaveDensity;
    let dp1 = dpdx(world);
    let dp2 = dpdy(world);
    let duv1 = dpdx(wuv);
    let duv2 = dpdy(wuv);
    let TBN = cotangentFrame(N, dp1, dp2, duv1, duv2);

    // Fade the weave out once a thread is under a pixel, or it aliases into a
    // crawling moire — the same footprint logic the snow's detail layers use.
    // At two hundred threads a metre this means the weave only exists in the
    // near field, which is exactly where a real one is visible.
    let uvFoot = max(length(duv1), length(duv2));
    let weaveFade = 1.0 - smoothstep(0.10, 0.45, uvFoot);
    var cavity = 1.0;
    if (weaveDepth > 0.001 && weaveFade > 0.001) {
        let w = weave(wuv);
        N = normalize(N + (TBN[0] * w.x + TBN[1] * w.y) * weaveDepth * weaveFade * 0.32);
        cavity = mix(1.0, w.z, weaveFade * 0.7);
    }

    // Slub: real yarn is not uniform, and a little variation in the base tone
    // does more for "this is a woven thing" than another specular term. Runs at
    // centimetre scale, an order of magnitude coarser than the weave, so unlike
    // the weave it survives to the distance the figure is actually seen at.
    let slub = noise2(input.vUV * vec2f(9.0, 26.0)) * 0.5 + 0.5;
    albedo *= 0.90 + 0.20 * slub;
    roughness = clamp(roughness * (0.94 + 0.12 * slub), 0.05, 1.0);

    // Baked at the vertex, times the weave cavity. No screen-space occlusion:
    // it is a two-metre silhouette against forty metres of lawn, and the pass
    // does not pay for itself on this content.
    var ao = input.vAux.y * cavity;

    // The eyes, on the one slot where the occlusion bake is carrying a feature
    // rather than broad shading.
    //
    // An eye is not dark because it is recessed. A socket a centimetre deep
    // moves N·L by a couple of degrees and shifts the fill by a few percent,
    // which is why a face with sockets sculpted into it still came back a bare
    // egg — the darkness of an eye is a statement about lashes, iris and pupil,
    // and that is albedo. But occlusion is the only per-vertex channel the mesh
    // carries, so `sculptFace` writes the eyes into it and this reads the bottom
    // of its range back out as a tint. It is safe because it is scoped to skin,
    // and on skin nothing but the sculpt ever reaches down here: the deepest
    // honest value on the skin slot is the crown of the cowl at 0.46 and the
    // base of the neck at 0.45, and the eye centres are at 0.14.
    //
    // The upper end of the ramp is what draws the eye rather than a bruise. A
    // vertex one segment outboard of an eye centre sits at 0.44, so putting the
    // ramp's top there keeps the darkening inside a single quad of the face and
    // lets the interpolation across it do the soft edge a lid actually has.
    if (slot == 4) {
        // Warlock face void: deep cowl occlusion collapses skin toward black.
        albedo *= mix(0.06, 1.0, smoothstep(0.08, 0.48, input.vAux.y));
    }

    // Fold occlusion from surface curvature.
    //
    // The cloth sim produces real folds, and they were invisible. A Lambert
    // term across a smooth fold is very nearly flat — the normal turns by a few
    // degrees over a centimetre, and under a broad night fill that is a percent
    // or two of shading. What the eye actually reads as a crease is the *second*
    // derivative, and nothing in the pipeline was looking at it, so a simulated
    // robe came back as a smooth orange cone.
    //
    // The divergence of the normal over the surface is mean curvature, and it is
    // signed: negative in a valley, positive on a ridge. Projecting each screen
    // derivative of the normal onto the matching derivative of world position
    // and normalising by its length squared gives it in 1/m, so the reciprocal
    // of the scale below is a fold radius.
    //
    // The scale is set by the smallest thing that has to register, which is an
    // eye socket: a 2 cm dish a centimetre deep has a curvature near 20 1/m. A
    // first pass put full effect at 100 1/m — a 1 cm fold — on the theory that
    // only tight creases should darken, and the result was that nothing on the
    // model darkened at all. The sockets came back at 4%, which is to say the
    // face was still an egg. 0.030 puts a socket and a robe pleat both solidly
    // on the curve.
    //
    // Two details matter. It uses the geometric normal, before the weave
    // perturbs it, or the weave's own ridges get counted as folds and the
    // garment gains a second layer of grime at thread scale. And the darkening
    // is clamped, because derivatives blow up across a UV seam or a silhouette
    // edge and an unbounded version draws black outlines around everything.
    let dNx = dpdx(geoN);
    let dNy = dpdy(geoN);
    let curvature = dot(dNx, dp1) / max(dot(dp1, dp1), 1e-12)
                  + dot(dNy, dp2) / max(dot(dp2, dp2), 1e-12);
    ao *= 1.0 - 0.42 * smoothstep(0.0, 1.0, -curvature * 0.030);

    // A shell's inside sees a fraction of the sky its outside does, and the hood
    // is one swept sheet: a single baked value at a vertex has to serve both
    // faces of it, so it can only ever be a compromise between a lit crown and
    // a dark cavity. The facing test is the missing half of that. It applies to
    // the open garment panels too, and correctly — the inside of a sleeve or a
    // robe hem really is occluded.
    //
    // Ramped rather than branched. `twoSided` flips state exactly where the
    // normal turns away from the eye, so using it directly drew a hard-edged
    // black crescent along the inside of the cowl — the one place on the model
    // where the surface curls past the silhouette in full view. Fading over a
    // narrow band around grazing puts the occlusion in without the edge.
    let facing = dot(normalize(input.vNormal), V);
    ao *= mix(1.0, 0.42, smoothstep(0.06, -0.06, facing));

    // ------------------------------------------------------------- lighting
    let NdotL = dot(N, L);
    let NdotV = clamp(dot(N, V), 1e-4, 1.0);
    let noiseRot = ign(input.position.xy) * 6.28318530718;

    var shadow = 1.0;
    if (NdotL > -0.4) {
        shadow = sunShadow(world, geoN, input.vViewDist, noiseRot);
    }
    // Night shadow floor — robe weave must remain visible in shade.
    //
    // This floor and the fill below were both doing the same job, and between
    // them they were paying for the figure's form twice. A floor of 0.26 leaves
    // under a 4:1 ratio across a cast shadow edge before the ambient is added,
    // and once it is there is barely 2:1 left — which over a body that is
    // mostly smooth tubes is not a terminator, it is a wash. Keeping shade
    // legible is the fill's job, because the fill is broad and can be raised
    // without flattening anything; the floor's only job is to stop the darkest
    // garment going to absolute black.
    shadow = mix(0.10, 1.0, shadow);

    let sun = uniforms.sunRadiance;
    const INV_PI: f32 = 0.31830988618;

    // --- diffuse -----------------------------------------------------------
    // Wrapped a little: fabric is not opaque at fibre scale, and the terminator
    // on a sleeve is genuinely soft.
    //
    // "A little" is the operative word and 0.32 was not it. Wrap pushes the
    // terminator round past the geometric one and flattens the gradient leading
    // up to it, which is the same gradient that tells the eye a sleeve is a
    // cylinder: at 0.32 a fully lit face was only four times a face at right
    // angles to the moon, so an arm turned through ninety degrees changed value
    // by less than the slub noise laid over it. 0.14 is still soft enough for
    // wool — it is a couple of degrees of bleed, not twenty.
    let diff = wrapDiffuse(NdotL, 0.14);
    var color = albedo * INV_PI * sun * diff * shadow;

    // --- transmission through thin cloth -----------------------------------
    if (transmit > 0.001) {
        let back = backScatter(N, L, V, 0.4, 4.0, 1.0);
        color += sun * albedo * back * transmit * uniforms.sssStrength
               * mix(0.35, 1.0, shadow);
    }

    // --- specular: anisotropic weave ---------------------------------------
    if (NdotL > 0.0) {
        let H = normalize(V + L);
        let NdotH = clamp(dot(N, H), 0.0, 1.0);
        let VdotH = clamp(dot(V, H), 0.0, 1.0);

        let ar = max(0.04, roughness * roughness);
        let ax = ar * (1.0 + aniso);
        let ay = ar / (1.0 + aniso);
        let D = dGGXAniso(dot(TBN[0], H), dot(TBN[1], H), NdotH, ax, ay);
        let Vis = visSmithGGXCorrelated(NdotV, max(NdotL, 1e-4), roughness);
        let F = fresnelSchlick(VdotH, vec3f(0.035));
        color += sun * D * Vis * F * NdotL * shadow;

        // --- sheen ---------------------------------------------------------
        // Tinted toward the albedo but desaturated: fibre scatter is closer to
        // white than the bulk colour, which is why a navy robe rims pale blue.
        //
        // Two corrections, both learned by looking at the render rather than at
        // the paper. First, the Ashikhmin visibility term runs away when both
        // cosines are small, so the lobe is clamped. Second — and this is the
        // one that mattered — Charlie is an *inverted* distribution: it is near
        // its peak everywhere except close to the mirror direction, so applied
        // flat it is not a rim, it is a uniform veil over the entire garment.
        // At full strength it lifted a navy robe to the same value as the snow
        // behind it and erased the silhouette completely.
        //
        // The grazing gate puts the energy back where fibre scatter actually
        // shows: the edge, where the line of sight passes along the pile rather
        // than into it.
        let sheenTint = mix(vec3f(1.0), normalize(albedo + 1e-4), 0.35);
        let ds = dCharlie(NdotH, 0.42);
        // The constant is a veil over the whole panel — Charlie is near its peak
        // everywhere except the mirror direction, so whatever fraction is not
        // gated by grazing lands flat across the garment and subtracts directly
        // from its modelling. Enough to keep the broad faces from reading as
        // matte paper, no more.
        let graze = 0.06 + 0.94 * pow(1.0 - NdotV, 2.0);
        let sheenLobe = min(ds * vAshikhmin(NdotV, max(NdotL, 1e-4)) * NdotL, 0.25);
        color += sun * sheenTint * sheenLobe * graze * sheenAmt * shadow;
    }

    // --- ambient ------------------------------------------------------------
    var irradiance = shIrradiance(N, uniforms.shR) * uniforms.ambientIntensity;
    // Ground bounce: light coming back off the lawn, so it lands on downward
    // faces — the underside of the mantle, the inside of a sleeve. Directional,
    // so it adds shape rather than removing it.
    let up = clamp(-N.y * 0.5 + 0.5, 0.0, 1.0);
    irradiance += shIrradiance(vec3f(0.0, 1.0, 0.0), uniforms.shR)
                * uniforms.ambientIntensity * 0.26 * up;
    // A flat pedestal, and the one term here with no direction in it at all, so
    // every unit of it is pure contrast loss. It was at 0.20 — against an SH
    // irradiance whose own swing top to bottom is not much larger, which meant
    // roughly a third of the fill on the model was arriving from nowhere in
    // particular. Enough to keep the darkest robe off black, no more, and with
    // the costume's reflectances now where they should be that takes very
    // little: the darkest slot is leather at 0.048, and it only has to clear
    // the point where the display quantises it into the black.
    irradiance += shIrradiance(vec3f(0.0, 1.0, 0.0), uniforms.shR)
                * uniforms.ambientIntensity * 0.025;

    color += albedo * INV_PI * irradiance * ao;

    // Moon rim — Elden-style silhouette separation. Cool key along the Fresnel
    // edge even when the face is in shadow, so the figure never dissolves into
    // the canopy behind it. Independent of sheen so leather and robe both get it.
    //
    // A rim is only a rim while it stays on the edge. At an exponent of 2.8 and
    // a third of the sun's radiance this one reached a long way inboard and
    // became a uniform pale halo over the whole model — the term that did more
    // than any other to make the costume look like one moulded piece. Narrower
    // and dimmer: a bright line on the contour, nothing on the broad faces.
    //
    // This term is additive and does not scale with albedo, so its weight is
    // relative to whatever the garment underneath happens to be. Against the
    // old near-black costume 0.22 of the moon's radiance was several times the
    // surface it sat on and read as a chrome edge; against a robe at its proper
    // reflectance it only has to be a highlight.
    let moonRim = pow(1.0 - NdotV, 4.2);
    color += sun * moonRim * 0.16 * ao;

    // Ambient sheen: the sky wrapping around a fuzzy silhouette.
    let rim = pow(1.0 - NdotV, 4.0);
    let skyAmb = shIrradiance(N, uniforms.shR) * uniforms.ambientIntensity * INV_PI;
    color += skyAmb * rim * sheenAmt * 0.55 * ao;

    // Ambient specular from the sky at a roughness-selected mip.
    let R = reflect(-V, N);
    let mip = sqrt(roughness) * 6.0;
    let skyRefl = textureSampleLevel(skyLUT, skyLUTSampler, dirToLatLong(R), mip).rgb;
    color += skyRefl * envBRDFApprox(vec3f(0.035), roughness, NdotV)
           * uniforms.ambientIntensity * ao;

    // --- spell light --------------------------------------------------------
    // The caster is standing inside the thing they are casting, so this is the
    // one material where the spell lights are almost always the *dominant*
    // source: a 13-degree sun is behind the figure for most of the framing this
    // demo uses, and a robe lit only by sky ambient is a silhouette. A ribbon of
    // water held at arm's length is what puts light back on the front of it.
    //
    // Wrapped harder than the sun's diffuse, because at half a metre the light
    // is a broad source rather than a point, and thin cloth over a bright
    // emitter genuinely does carry light around the fold.
    if (uniforms.spellLightCount > 0.5) {
        color += spellLightingSurface(
            world, N, V, albedo, vec3f(0.035), roughness, 0.35,
            uniforms.spellLightPos, uniforms.spellLightCol, uniforms.spellLightCount
        ) * ao;
    }

    // ------------------------------------------------------- aerial perspective
    let fogAmt = smoothstep(40.0, 95.0, length(world - uniforms.cameraPos));
    color = applyAerial(
        color, uniforms.cameraPos, world, -V, L,
        skyLUT, skyLUTSampler, sun,
        uniforms.fogDensity, uniforms.fogHeightFalloff, uniforms.fogStart,
        uniforms.aerialStrength * fogAmt
    );

    fragmentOutputs.color = vec4f(color, 1.0);
}
