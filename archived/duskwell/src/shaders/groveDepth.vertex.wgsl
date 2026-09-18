// Shadow-pass vertex for grove meshes. Positions are already world-space
// in the buffer; `world` is the frozen identity (or a small NPC offset).

attribute position: vec3f;

uniform lightViewProjection: mat4x4f;
uniform world: mat4x4f;

@vertex
fn main(input: VertexInputs) -> FragmentInputs {
    let wp = uniforms.world * vec4f(vertexInputs.position, 1.0);
    vertexOutputs.position = uniforms.lightViewProjection * wp;
}
