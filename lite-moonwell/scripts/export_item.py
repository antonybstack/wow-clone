"""Export selected objects or a named collection to public/characters/items/<id>.glb.

Refuses shrine (Ground / Dummy) and moonwell.blend. Yup, visible only.
Live file must be hero-a.blend or items.blend.

Usage (Blender background):
  blender blender/items.blend --background --python scripts/export_item.py -- --id staff
  blender blender/items.blend --background --python scripts/export_item.py -- --id staff --collection staff

Injected globals (blender-mcp exec): ITEM_ID, ITEM_COLLECTION
"""
import json
import os
import sys

import bpy

ROOT = "/Users/antbly/dev/wow-clone/lite-moonwell"
ITEMS_DIR = os.path.join(ROOT, "public", "characters", "items")
SHRINE = {"Ground", "Dummy"}
BLEND_OK = {"hero-a.blend", "items.blend"}


def _after_ddash(argv):
    if "--" in argv:
        return argv[argv.index("--") + 1 :]
    return []


def _cli():
    item_id = globals().get("ITEM_ID") or os.environ.get("ITEM_ID")
    collection = (
        globals().get("ITEM_COLLECTION")
        or globals().get("COLLECTION")
        or os.environ.get("ITEM_COLLECTION")
        or os.environ.get("COLLECTION")
    )
    args = _after_ddash(sys.argv)
    i = 0
    while i < len(args):
        a = args[i]
        if a in ("--id", "-i") and i + 1 < len(args):
            item_id = args[i + 1]
            i += 2
            continue
        if a in ("--collection", "-c") and i + 1 < len(args):
            collection = args[i + 1]
            i += 2
            continue
        if a.startswith("--id="):
            item_id = a.split("=", 1)[1]
            i += 1
            continue
        if a.startswith("--collection="):
            collection = a.split("=", 1)[1]
            i += 1
            continue
        if not a.startswith("-") and not item_id:
            item_id = a
            i += 1
            continue
        i += 1
    return (item_id or "").strip(), (collection or "").strip() or None


def refuse_shrine():
    hit = [n for n in SHRINE if n in bpy.data.objects]
    if hit:
        raise RuntimeError(f"Shrine is live ({', '.join(hit)}) — open items.blend or hero-a.blend, never moonwell.")
    fp = bpy.data.filepath or ""
    base = os.path.basename(fp).lower()
    if base and "moonwell" in base:
        raise RuntimeError(f"Refusing {fp} — live file must be hero-a.blend or items.blend.")
    if fp and base not in BLEND_OK:
        print("WARN live blend is", fp, "— expected items.blend or hero-a.blend")


def ensure_object_mode():
    if bpy.ops.object.mode_set.poll():
        bpy.ops.object.mode_set(mode="OBJECT")


def collection_objects(name):
    col = bpy.data.collections.get(name)
    if col is None:
        raise RuntimeError(f"No collection named {name!r}")
    return [ob for ob in col.all_objects]


def select_export(item_id, collection):
    ensure_object_mode()
    bpy.ops.object.select_all(action="DESELECT")
    use_collection = ""
    selected = []
    if collection:
        selected = collection_objects(collection)
        use_collection = collection
    else:
        selected = [ob for ob in bpy.context.selected_objects]
        if not selected:
            if bpy.data.collections.get(item_id):
                selected = collection_objects(item_id)
                use_collection = item_id
    if not selected:
        raise RuntimeError("Nothing to export — select objects or pass --collection <name>.")
    meshes = [ob for ob in selected if ob.type == "MESH" and not ob.hide_get()]
    if not meshes:
        raise RuntimeError("Export set has no visible mesh.")
    for ob in selected:
        ob.hide_set(False)
        ob.hide_viewport = False
        ob.hide_render = False
        ob.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    return selected, use_collection


def export_item(item_id, collection=None):
    refuse_shrine()
    if not item_id:
        raise RuntimeError("ITEM_ID required")
    if "/" in item_id or "\\" in item_id or ".." in item_id:
        raise RuntimeError(f"Bad item id {item_id!r}")
    selected, use_collection = select_export(item_id, collection)
    os.makedirs(ITEMS_DIR, exist_ok=True)
    dest = os.path.join(ITEMS_DIR, f"{item_id}.glb")
    kwargs = dict(
        filepath=dest,
        export_format="GLB",
        export_apply=True,
        export_yup=True,
        export_lights=False,
        export_cameras=False,
        export_extras=False,
        export_animations=False,
        export_skins=False,
        export_morph=False,
        use_visible=True,
        export_materials="EXPORT",
        export_texcoords=True,
        export_normals=True,
        export_tangents=True,
        export_image_format="AUTO",
        export_keep_originals=False,
    )
    if use_collection:
        kwargs["collection"] = use_collection
        kwargs["use_selection"] = False
    else:
        kwargs["use_selection"] = True
    result = bpy.ops.export_scene.gltf(**kwargs)
    bytes_out = os.path.getsize(dest) if os.path.exists(dest) else 0
    summary = {
        "export": str(result),
        "id": item_id,
        "glb": dest,
        "bytes": bytes_out,
        "collection": use_collection or None,
        "objects": [ob.name for ob in selected],
        "meshes": [ob.name for ob in selected if ob.type == "MESH"],
        "blend": bpy.data.filepath or None,
    }
    print("ITEM_EXPORT:" + json.dumps(summary))
    return summary


if __name__ == "__main__":
    _id, _col = _cli()
    if not _id:
        raise RuntimeError("Pass --id <item>")
    export_item(_id, _col)
