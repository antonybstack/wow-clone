"""Replace blob trees with Poly Haven trees. Decimate bark only; thin leaf cards."""
import math
import os

import bpy
from mathutils import Vector

MODELS = "/Users/antbly/dev/wow-clone/lite-moonwell/public/models"

if bpy.ops.object.mode_set.poll():
    bpy.ops.object.mode_set(mode="OBJECT")

for obj in list(bpy.context.scene.objects):
    if obj.name.startswith("Tree") or obj.name.startswith("Tmpl_"):
        bpy.data.objects.remove(obj, do_unlink=True)
print("cleared old trees")


def import_gltf(path):
    before = set(bpy.context.scene.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    return [o for o in bpy.context.scene.objects if o not in before]


def clip_leaves(obj):
    for slot in obj.material_slots:
        mat = slot.material
        if not mat or "leaf" not in mat.name.lower():
            continue
        mat.blend_method = "CLIP"
        if hasattr(mat, "alpha_threshold"):
            mat.alpha_threshold = 0.45
        if hasattr(mat, "use_backface_culling"):
            mat.use_backface_culling = False


def prepare_tree(asset_id, object_name):
    path = os.path.join(MODELS, asset_id, f"{asset_id}_1k.gltf")
    imported = import_gltf(path)
    root = imported[0]
    bpy.ops.object.select_all(action="DESELECT")
    root.select_set(True)
    bpy.context.view_layer.objects.active = root
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.separate(type="MATERIAL")
    bpy.ops.object.mode_set(mode="OBJECT")
    parts = [o for o in bpy.context.selected_objects if o.type == "MESH"]
    print(asset_id, "parts", [(p.name, [s.material.name if s.material else None for s in p.material_slots], len(p.data.polygons)) for p in parts])

    # Photogrammetry trees: most faces are leaf cards. Never collapse-decimate those.
    parts_by_faces = sorted(parts, key=lambda p: len(p.data.polygons), reverse=True)
    for index, part in enumerate(parts_by_faces):
        mat_name = (part.material_slots[0].material.name if part.material_slots and part.material_slots[0].material else "").lower()
        is_leaf = index == 0 or "leaf" in mat_name
        bpy.ops.object.select_all(action="DESELECT")
        part.select_set(True)
        bpy.context.view_layer.objects.active = part
        if is_leaf:
            bpy.ops.object.mode_set(mode="EDIT")
            bpy.ops.mesh.select_mode(type="FACE")
            bpy.ops.mesh.select_all(action="DESELECT")
            bpy.ops.mesh.select_random(ratio=0.78, seed=7)
            bpy.ops.mesh.delete(type="FACE")
            bpy.ops.object.mode_set(mode="OBJECT")
            clip_leaves(part)
            print("  thinned leaves", part.name, mat_name, "faces", len(part.data.polygons))
        else:
            mod = part.modifiers.new("Lod", "DECIMATE")
            mod.decimate_type = "COLLAPSE"
            mod.ratio = 0.12
            bpy.ops.object.modifier_apply(modifier="Lod")
            print("  decimated bark", part.name, mat_name, "faces", len(part.data.polygons))

    bpy.ops.object.select_all(action="DESELECT")
    for part in parts:
        part.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    if len(parts) > 1:
        bpy.ops.object.join()
    tree = bpy.context.active_object
    tree.name = object_name
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    min_z = min((tree.matrix_world @ Vector(c)).z for c in tree.bound_box)
    tree.location.z -= min_z
    bpy.ops.object.transform_apply(location=True, rotation=False, scale=False)
    clip_leaves(tree)
    print(asset_id, "ready verts", len(tree.data.vertices), "faces", len(tree.data.polygons), "h", round(tree.dimensions.z, 3))
    tree.hide_set(True)
    tree.hide_render = True
    return tree


t_large = prepare_tree("island_tree_01", "Tmpl_Island1")
t_mid = prepare_tree("island_tree_02", "Tmpl_Island2")

PLACEMENTS = [
    ("TreeA", (-2.55, -1.35), 2.55, 25, t_large),
    ("TreeB", (2.70, -0.85), 2.15, 160, t_mid),
    ("TreeC", (2.15, 1.85), 3.15, -40, t_large),
    ("TreeD", (-2.20, 1.55), 1.95, 80, t_mid),
    ("TreeE", (-1.55, -2.55), 1.55, 200, t_mid),
]


def plant(name, xy, height, yaw_deg, template):
    template.hide_set(False)
    template.hide_render = False
    bpy.ops.object.select_all(action="DESELECT")
    template.select_set(True)
    bpy.context.view_layer.objects.active = template
    bpy.ops.object.duplicate()
    inst = bpy.context.active_object
    template.hide_set(True)
    template.hide_render = True
    inst.name = name
    s = height / (inst.dimensions.z or 1.0)
    inst.scale = (s, s, s)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    inst.location = (xy[0], xy[1], 0.02)
    inst.rotation_euler[2] = math.radians(yaw_deg)
    clip_leaves(inst)
    print("planted", name, "h", round(inst.dimensions.z, 3), "faces", len(inst.data.polygons))
    return inst


for spec in PLACEMENTS:
    plant(*spec)

for tmpl in (t_large, t_mid):
    bpy.data.objects.remove(tmpl, do_unlink=True)

print("done", [o.name for o in bpy.context.scene.objects if o.name.startswith("Tree")])
