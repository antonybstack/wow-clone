#include<snowNoise>
#include<snowAtmosphere>
#include<snowShading>
#include<snowRidge>

varying vDir: vec3f;

var skyLUT: texture_2d<f32>;
var skyLUTSampler: sampler;

uniform sunDir: vec3f;
uniform sunColor: vec3f;
uniform sunIntensity: f32;
uniform time: f32;
uniform windDir: vec2f;
uniform cloudAmount: f32;
uniform cameraPosition: vec3f;
/// Direct solar irradiance at the ground, on the same scale the LUT stores
/// radiance in — so the range is lit by the identical number the snow is.
uniform sunRadiance: vec3f;
uniform shR: array<vec4f, 9>;
uniform ambientIntensity: f32;
/// Peak height of the far range, metres. Zero switches it off entirely.
uniform ridgeAmp: f32;

// The field's own aerial perspective, so the range can be hazed by the same
// atmosphere the snow in front of it is. See `shadeRidge`.
uniform fogDensity: f32;
uniform fogHeightFalloff: f32;
uniform fogStart: f32;
uniform aerialStrength: f32;

/// Shade a point on the far range.
///
/// Deliberately the *snow field's* material logic, not a separate one: the same
/// wrapped diffuse, the same SH ambient, the same near-white albedo that is
/// never 1.0. A distant mountain rendered with its own ad-hoc lighting is the
/// classic way a matte painting announces itself — it does not sit in the same
/// light as the ground in front of it.
fn shadeRidge(hit: RidgeHit, dir: vec3f) -> vec3f {
    let N = hit.normal;
    let L = uniforms.sunDir;

    // Snow almost everywhere, rock only on the faces too steep to hold it. This
    // is a polar range, not an alpine one: there is no snow line to speak of, and
    // the first version's 120-460 m ramp put rock across the whole visible band
    // and turned the horizon into a dark smear. Rock is here for the *break* it
    // gives a white massif, not as a ground cover.
    let steep = 1.0 - N.y;
    let snowMask = clamp(1.0 - smoothstep(0.46, 0.80, steep), 0.0, 1.0);

    let rock = vec3f(0.045, 0.038, 0.032);
    let snow = vec3f(0.07, 0.13, 0.08);
    let albedo = mix(rock, snow, snowMask);

    let shadow = ridgeShadow(hit.pos, hit.height, L, uniforms.ridgeAmp);

    const INV_PI: f32 = 0.31830988618;
    let diff = wrapDiffuse(dot(N, L), mix(0.15, 0.62, snowMask));
    var col = albedo * INV_PI * uniforms.sunRadiance * diff * shadow;

    // --- subsurface ---------------------------------------------------------
    // The term the first version left out, and the reason the range read as a
    // different material from the field it stands behind.
    //
    // Snow is translucent. The snow shader spends most of its budget saying so,
    // and a mountain of snow with the sun behind it *glows* — it does not go to a
    // dark silhouette. Without this the range came out as dark warm shapes
    // against bright warm haze, which is the one combination that reads as dirt,
    // and it was most visible in exactly the framing where a range should look
    // its best: looking into a low sun.
    //
    // Same `snowSubsurface` the ground runs, so the two cannot disagree about
    // what back-lit snow does.
    let V = -dir;
    col += snowSubsurface(N, L, V, uniforms.sunRadiance, 0.45, snowMask, 1.0)
         * albedo * mix(0.5, 1.0, shadow);

    // Sky fill. At this distance it is most of what is left after extinction,
    // and it is the reason distant snow reads blue rather than grey.
    col += albedo * INV_PI * shIrradiance(N, uniforms.shR) * uniforms.ambientIntensity;

    // Bounce off the range's own snow, exactly as the field does off itself. A
    // white massif is lit from every direction by the rest of the massif, and
    // leaving it out is what makes shaded faces read as too dark by a stop.
    col += albedo * INV_PI * shIrradiance(vec3f(0.0, 1.0, 0.0), uniforms.shR)
         * uniforms.ambientIntensity * 0.30 * clamp(-N.y * 0.5 + 0.5, 0.0, 1.0)
         * snowMask;

    // ---- aerial perspective ------------------------------------------------
    //
    // The scene's own, not a second atmosphere of the range's own — and that
    // change is most of what makes the range sit *in* the landscape rather than
    // behind it.
    //
    // Deliberately *not* a second, physically-real atmosphere integrated over
    // the true kilometres. That gives the frame two different atmospheres and
    // the seam lands exactly where the eye is looking: the scene's haze is
    // roughly a hundred times thicker than real air, so an 800 m dune is hazed
    // as though it were eighty kilometres away while a 20 km massif gets a
    // genuine 20 km of it — and the range comes out sharper and more contrasty
    // than the ground in front of it, which reads as a matte painting hung
    // behind the set.
    //
    // What makes one atmosphere work at these distances is the height falloff
    // the field's fog already has: at 0.045 per metre the haze has a 22 m scale
    // height, so a summit at two kilometres sits almost entirely clear of it
    // while its own feet are buried. On the current settings a 2 km peak keeps
    // about two thirds of its contrast at 9 km and a fifth at 35 km, and
    // anything below ~300 m is gone by 8 km — peaks emerging from a sea of
    // haze, on the same curve the dunes 600 m away are already on.
    let hitPos = vec3f(hit.pos.x, hit.height, hit.pos.y);
    let t = aerialTransmittance(
        uniforms.cameraPosition, hitPos,
        uniforms.fogDensity, uniforms.fogHeightFalloff, uniforms.fogStart
    );
    let ext = clamp(1.0 - pow(t, uniforms.aerialStrength), 0.0, 1.0);

    // The identical inscatter the ground converges to. This is the part that has
    // to match exactly: the clipmap's far edge and the range's feet are adjacent
    // pixels in the frame, and if they resolve to two different "fully hazed"
    // colours there is a visible line between them whatever else is right. At
    // full extinction it is the plain sky lookup, which is what this shader draws
    // where the march missed — so a fully hazed massif and the sky beside it are
    // literally the same value.
    let inscatter = aerialInscatterSky(
        skyLUT, skyLUTSampler, dir, L, uniforms.sunRadiance, ext
    );

    return mix(col, inscatter, ext);
}

@fragment
fn main(input: FragmentInputs) -> FragmentOutputs {
    let dir = normalize(input.vDir);
    let uv = dirToLatLong(dir);

    var col = textureSampleLevel(skyLUT, skyLUTSampler, uv, 0.0).rgb;

    // ------------------------------------------------------- far-field range
    // Above the band the march's ceiling test rejects immediately, so the upper
    // bound is only there to skip the call.
    //
    // The lower bound reaches well *below* the horizon on purpose, and an earlier
    // version's did not. Fading the range out at a fixed elevation angle drew a
    // dead straight horizontal line under the whole massif — a ruler across the
    // frame, which is the one thing a landscape never has. A real range's feet are
    // hidden by the land in front of it, and here that happens for free: the
    // clipmap is drawn *after* the sky and covers everything below its own
    // silhouette, so letting the range paint down past the horizon lets the near
    // dunes occlude it exactly where they actually stand. A ray at -0.05 from eye
    // height meets the ground inside eighty metres, so there is nowhere it can
    // escape the terrain and show a base.
    if (uniforms.ridgeAmp > 1.0 && dir.y < 0.230 && dir.y > -0.050) {
        let hit = ridgeMarch(uniforms.cameraPosition, dir, uniforms.ridgeAmp);
        if (hit.hit) {
            col = shadeRidge(hit, dir);
        }
    }

    // ------------------------------------------------------------- stars
    // Hashed one candidate per direction-space cell, so they are fixed to the
    // sky rather than to the screen and cost a single hash per pixel.
    //
    // Deliberately before the moon and the cirrus: both have to be able to
    // wash stars out, which is most of what sells a field of them as being
    // *behind* the rest of the sky.
    if (dir.y > 0.0) {
        let sc = dir * 210.0;
        let cell = floor(sc);
        let frac = sc - cell;
        let h3 = hash33(cell);
        // Roughly one cell in fifty lights up. Denser than this and a night sky
        // stops reading as stars and starts reading as sensor noise.
        let lit = step(0.980, h3.x);
        let centre = vec3f(0.5) + (h3 - vec3f(0.5)) * 0.5;
        let core = 1.0 - smoothstep(0.0, 0.34, length(frac - centre));
        let twinkle = 0.70 + 0.30 * sin(uniforms.time * (1.3 + h3.y * 2.4) + h3.z * 6.283);
        // Gone into the horizon haze, where the air path is longest.
        let alt = smoothstep(0.015, 0.28, dir.y);
        let star = lit * core * core * twinkle * alt * (0.30 + 0.70 * h3.y);
        col += vec3f(0.70, 0.79, 1.0) * star * 0.9;
    }

    // ----------------------------------------------------------- moon disc
    // The scene's one light source, and the reason the ground is lit at all.
    //
    // ~1.9 degrees across: nearly four times the true angular size, which is
    // the same lie every stylised night sky tells. At a truthful 0.53 degrees
    // a moon is four pixels across and reads as a dead spot rather than as the
    // body casting the shadows stretching across the glade.
    let mu = dot(dir, uniforms.sunDir);
    const MOON_SIN: f32 = 0.0332;          // sin(1.9 deg)
    const MOON_COS: f32 = 0.99945;         // cos(1.9 deg)
    if (mu > MOON_COS) {
        let r = sqrt(max(0.0, 1.0 - mu * mu)) / MOON_SIN;
        // Mare, sampled in world direction rather than in a disc-local frame:
        // the moon keeps one face to us, so the mottling should not swim when
        // the sun setting moves the disc across the dome.
        //
        // Faded out towards the rim, and kept shallow. At full strength across
        // the whole face the mottling moved where the disc crossed the clipping
        // point, and the moon came out with a visibly lumpy, polygonal edge.
        let mare = noise3(dir * 95.0) * 0.5 + 0.5;
        let face = mix(0.90, 1.0, mare * (1.0 - smoothstep(0.45, 0.95, r)));
        // Soft only in the last fifth, so it stays a disc and not a smudge.
        let edge = 1.0 - smoothstep(0.80, 1.0, r);
        col += uniforms.sunRadiance * 0.48 * face * edge;
    }

    // Halo — forward scatter in the first few degrees. Most of why the sky
    // immediately around a moon reads milky rather than black.
    // Same radiance family as the ground key (`sunRadiance`), not a separate
    // sunColor*intensity display path that could disagree once warmth changes.
    let halo = pow(max(0.0, mu), 2200.0) * 1.7 + pow(max(0.0, mu), 48.0) * 0.11;
    col += uniforms.sunRadiance * halo * 0.10;

    // ------------------------------------------------------------- cirrus
    // Thin, high, wind-aligned. Restrained on purpose: the reference skies are
    // mostly clean gradient, and clouds here exist to stop the upper sky from
    // being a flat wash, not to become subject matter.
    if (uniforms.cloudAmount > 0.001 && dir.y > 0.0) {
        // Project onto a high plane so bands converge at the horizon.
        let planeY = 1.0 / max(0.06, dir.y);
        var cp = dir.xz * planeY * 0.5 + uniforms.windDir * uniforms.time * 0.004;

        // Stretch across the wind so the streaks run with it.
        let a = atan2(uniforms.windDir.x, uniforms.windDir.y);
        cp = rot2(a) * cp;
        cp.x *= 0.28;

        let n = fbmd(cp, 4, 2.13, 0.52).x;
        var cloud = smoothstep(0.06, 0.34, n);
        // Fade out at the horizon and at the zenith.
        cloud *= smoothstep(0.0, 0.22, dir.y) * (1.0 - smoothstep(0.55, 1.0, dir.y) * 0.45);
        cloud *= uniforms.cloudAmount;

        // Same radiance scale as the dusk LUT. Display-referred greys (~0.5)
        // mixed into a 0.05 dome are what washed the sky to chalk lavender.
        //
        // The unlit body is cool and only just above the dome, so the band
        // reads as thin cloud catching moonlight rather than as a grey stain:
        // at 0.40 coverage against the old near-black cloud colour it was not
        // visible at all, which left the upper sky a dead flat wash.
        let sunLit = pow(max(0.0, mu * 0.5 + 0.5), 3.0);
        let cloudCol = mix(vec3f(0.026, 0.034, 0.062), uniforms.sunColor * 0.30, sunLit * 0.80);
        col = mix(col, cloudCol, cloud * 0.55);
    }

    fragmentOutputs.color = vec4f(col, 1.0);
}
