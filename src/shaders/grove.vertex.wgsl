attribute position: vec3f;
attribute normal: vec3f;

uniform viewProjection: mat4x4f;
uniform world: mat4x4f;
uniform cameraPos: vec3f;

varying vWorld: vec3f;
varying vN: vec3f;
varying vViewDist: f32;

@vertex
fn main(input: VertexInputs) -> FragmentInputs {
    let wp = uniforms.world * vec4f(vertexInputs.position, 1.0);
    vertexOutputs.position = uniforms.viewProjection * wp;
    vertexOutputs.vWorld = wp.xyz;
    let n4 = uniforms.world * vec4f(vertexInputs.normal, 0.0);
    vertexOutputs.vN = normalize(n4.xyz);
    vertexOutputs.vViewDist = distance(wp.xyz, uniforms.cameraPos);
}
