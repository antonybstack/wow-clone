"""Human short02 hair proxy (CC0 system asset). No short01 crown-fill.

UV-sampled short02_diffuse.png (OpenGL v, PNG y-flip): crown (top 20% height,
ring>=2) 100% a=255. Hairline ring0 ~85% of samples a<8. MASK clips authored
fringe; it does not punch the crown. OPAQUE would paint those a=0 texels as
brown polygons (the short01 helmet error, at the hairline).
"""
from __future__ import annotations

from pathlib import Path

CLO = "short02.mhclo"
OBJ = "short02.obj"
DIFFUSE = "short02_diffuse.png"
NORMAL = "short02_normal.png"
# Same verified mat_pbr CLIP path as eyebrows (blend_method CLIP + alpha_threshold).
ALPHA_CLIP = 0.12
ROUGH = 0.72
SPECULAR = 0.18
DOUBLE_SIDED = True


def source_paths(src: Path) -> dict[str, Path]:
    return {
        "clo": src / CLO,
        "obj": src / OBJ,
        "diffuse": src / DIFFUSE,
        "normal": src / NORMAL,
    }


def mat_kwargs(albedo: Path, normal: Path | None) -> dict:
    return {
        "albedo_path": albedo,
        "normal_path": normal,
        "color": (1.0, 1.0, 1.0),
        "rough": ROUGH,
        "specular": SPECULAR,
        "alpha_clip": ALPHA_CLIP,
        "double_sided": DOUBLE_SIDED,
    }


def wire_export_mask(mat, cutoff=ALPHA_CLIP):
    """Insert Math GREATER_THAN so Khronos glTF export emits MASK, not BLEND.

    Blender 5 io_scene_gltf2 gather_alpha_info ignores Eevee blend_method and
    only sets alphaMode MASK when detect_alpha_clip finds Round / (1-(X<c)) /
    (X>c) on the Principled Alpha socket. mat_pbr only links Image Alpha.
    Hair-only: does not change mh_studio.mat_pbr used by skin/eyes/brows.
    """
    nt = mat.node_tree
    bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    alpha_in = next(i for i in bsdf.inputs if i.identifier == "Alpha")
    links = list(alpha_in.links)
    if not links:
        raise RuntimeError("HumanHair Alpha has no texture link")
    from_socket = links[0].from_socket
    nt.links.remove(links[0])
    math = nt.nodes.new("ShaderNodeMath")
    ops = [i.identifier for i in math.bl_rna.properties["operation"].enum_items]
    if "GREATER_THAN" not in ops:
        raise RuntimeError(f"no GREATER_THAN in {ops}")
    math.operation = "GREATER_THAN"
    math.inputs[1].default_value = float(cutoff)
    nt.links.new(from_socket, math.inputs[0])
    nt.links.new(math.outputs[0], alpha_in)
    return {"alphaMode": "MASK", "alphaCutoff": float(cutoff), "math": math.operation}
