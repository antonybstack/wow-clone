// Bakes the atmospheric scattering integral into an equirectangular LUT.
// Re-run only when the sun moves, never per frame.

#include<snowNoise>
#include<snowAtmosphere>

varying vUV: vec2f;

uniform sunDir: vec3f;
uniform sunIntensity: f32;
uniform groundBounce: vec3f;

@fragment
fn main(input: FragmentInputs) -> FragmentOutputs {
    let dir = latLongToDir(input.vUV);
    var col = nishitaSky(dir, uniforms.sunDir, uniforms.sunIntensity, uniforms.groundBounce);

    // Moonlit Duskwell. Radiance, not display — a 0.4-up mix is what
    // bleached the dome to pastel lavender and then the SH fill.
    //
    // Green sits above red on purpose. This LUT is the scene's *only* ambient
    // source: it is projected to spherical harmonics and becomes the fill on
    // every surface in the world. The previous magenta dome projected to a DC
    // term of (0.288, 0.151, 0.358) — green at half of red — so no leaf, no
    // blade of grass and no patch of skin could read as anything but violet,
    // however its albedo was authored. Fixing the hue here is what lets every
    // other palette in the scene mean what it says.
    // Readable indigo night sky — richer than photometric dusk so SH fill
    // keeps shadowed grass and bark in navy midtones instead of crushed black
    // (the Elden Ring night trick: dark, not empty).
    let zenith = vec3f(0.028, 0.040, 0.095);
    let horizon = vec3f(0.062, 0.088, 0.135);
    let h = pow(clamp(dir.y * 0.5 + 0.5, 0.0, 1.0), 0.95);
    let dusk = mix(horizon, zenith, h);
    col = mix(col, dusk, 0.82);
    col += vec3f(0.012, 0.020, 0.034) * pow(1.0 - abs(dir.y), 5.0);

    fragmentOutputs.color = vec4f(col, 1.0);
}
