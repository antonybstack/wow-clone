// Bakes the macro landform (broad dunes + medium drifts + rock outcrops) into a
// single-channel float texture covering the whole playable field.
//
// Baked rather than evaluated live for one reason: the CPU needs the same
// heights for character grounding, footfall placement and spell hit points, and
// reading back a GPU bake is the only way to guarantee the two never disagree.
// Re-implementing the noise in JS would drift the moment f32 and f64 rounding
// diverged, and the character would float or sink by centimetres.

#include<snowNoise>
#include<snowTerrain>

varying vUV: vec2f;

uniform worldOrigin: vec2f;
uniform worldSize: f32;
uniform windAngle: f32;
uniform heightAmp: f32;

@fragment
fn main(input: FragmentInputs) -> FragmentOutputs {
    let p = uniforms.worldOrigin + input.vUV * uniforms.worldSize;

    var h = terrainMacro(p, uniforms.windAngle, uniforms.heightAmp);

    // Duskwell hollow: the floor must stay flat past the hero camera (~z=28).
    // The old rim sat at r=16–28 and filled the near field with a grass berm.
    let r = length(p);
    let glade = 1.0 - smoothstep(34.0, 54.0, r);
    h = mix(h, 1.08, glade);
    let dish = 1.0 - smoothstep(0.0, 20.0, r);
    h -= dish * 0.22;
    let rim = smoothstep(48.0, 62.0, r) * (1.0 - smoothstep(80.0, 110.0, r));
    h += rim * 3.4 * uniforms.heightAmp;

    // Rock displaces snow upward; snow then re-accumulates on the flatter faces,
    // which the snow material resolves from the mask in the aux bake.
    let rock = rockField(p, uniforms.windAngle);
    h += rock.x;

    fragmentOutputs.color = vec4f(h, rock.y, 0.0, 1.0);
}
