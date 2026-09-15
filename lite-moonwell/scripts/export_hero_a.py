"""Export hero-a.blend → public/hero.glb. Refuses the shrine. Does not write moonwell.glb."""
import os
import re
import time

import bpy

ROOT = "/Users/antbly/dev/wow-clone/lite-moonwell"
EXPORT = os.path.join(ROOT, "public", "hero.glb")
BLEND = os.path.join(ROOT, "blender", "hero-a.blend")
META = os.path.join(ROOT, "src", "glb-meta.js")
SHRINE = {"MoonSun", "Ground", "LanternA_L", "WellGlow", "Dummy", "Basin"}
HIDE = {"A_LookPlate", "A_Collision", "HeroLookPlate", "HeroCollision"}


def ensure_object_mode():
    if bpy.ops.object.mode_set.poll():
        bpy.ops.object.mode_set(mode="OBJECT")


def rename_a_to_hero():
    mapping = []
    for obj in list(bpy.data.objects):
        if obj.name.startswith("A_"):
            new = "Hero" + obj.name[2:]
            mapping.append((obj.name, new))
            obj.name = new
    return mapping


if any(n in bpy.data.objects for n in SHRINE):
    raise RuntimeError("Shrine is live — open hero-a.blend first.")

ensure_object_mode()
renamed = rename_a_to_hero()
print("RENAMED", renamed[:12], "...", len(renamed))

for name in list(HIDE):
    obj = bpy.data.objects.get(name)
    if obj:
        obj.hide_set(True)
        obj.hide_render = True
        obj.hide_viewport = True

for obj in bpy.data.objects:
    if obj.type in {"CAMERA", "LIGHT"}:
        obj.hide_set(True)
        obj.hide_render = True

root = bpy.data.objects.get("HeroRoot")
if root is None:
    bpy.ops.object.empty_add(type="ARROWS", location=(0, 0, 0))
    root = bpy.context.active_object
    root.name = "HeroRoot"

for obj in bpy.data.objects:
    if obj == root or obj.parent:
        continue
    if obj.type not in {"MESH", "ARMATURE", "EMPTY"}:
        continue
    if obj.name in HIDE or obj.type in {"CAMERA", "LIGHT"}:
        continue
    if obj.name.startswith("Hero") or obj.name.startswith("A_"):
        obj.parent = root

bpy.ops.object.select_all(action="DESELECT")
root.select_set(True)
bpy.context.view_layer.objects.active = root

try:
    bpy.ops.file.pack_all()
except Exception as exc:
    print("pack_all", exc)

os.makedirs(os.path.dirname(EXPORT), exist_ok=True)
bpy.ops.export_scene.gltf(
    filepath=EXPORT,
    export_format="GLB",
    export_apply=True,
    export_yup=True,
    export_lights=False,
    export_cameras=False,
    export_extras=False,
    export_animations=False,
    export_skins=False,
    export_morph=False,
    use_selection=False,
    use_visible=True,
    export_materials="EXPORT",
    export_texcoords=True,
    export_normals=True,
    export_tangents=True,
    export_image_format="AUTO",
)

stamp = str(int(time.time() * 1000))
text = open(META, encoding="utf-8").read()
text2, n = re.subn(
    r'export const heroUrl = "/hero\.glb\?v=\d+";',
    f'export const heroUrl = "/hero.glb?v={stamp}";',
    text,
    count=1,
)
if n != 1:
    if "export const heroUrl" in text:
        text2 = re.sub(
            r'export const heroUrl = "[^"]+";',
            f'export const heroUrl = "/hero.glb?v={stamp}";',
            text,
            count=1,
        )
    else:
        text2 = text.rstrip() + f'\nexport const heroUrl = "/hero.glb?v={stamp}";\n'
open(META, "w", encoding="utf-8").write(text2)

bpy.ops.wm.save_as_mainfile(filepath=BLEND)
print("HERO_EXPORT", EXPORT, "bytes", os.path.getsize(EXPORT), "heroUrl", stamp)
