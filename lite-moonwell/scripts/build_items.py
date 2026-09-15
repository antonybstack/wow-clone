"""Socket-local paper-doll blockouts → blender/items.blend + public/characters/items/*.glb.

Never moonwell. Geometry is Lite/glTF Y-up authored as Blender (x, -z, y)
so export_yup round-trips. Thickness via SOLIDIFY — not createRibbon sheets.
"""
import math
import os
import sys

import bmesh
import bpy
from mathutils import Vector

ROOT = "/Users/antbly/dev/wow-clone/lite-moonwell"
BLEND = os.path.join(ROOT, "blender", "items.blend")
ITEMS_DIR = os.path.join(ROOT, "public", "characters", "items")
SCRIPTS = os.path.dirname(os.path.abspath(__file__)) if "__file__" in globals() else os.path.join(ROOT, "scripts")

SHRINE = {"Ground", "Dummy"}
if any(n in bpy.data.objects for n in SHRINE):
    raise RuntimeError("Shrine is live. Stay out of moonwell.blend.")


def js(x, y, z):
    """Lite (x,y,z) → Blender so glTF yup yields the same Lite coords."""
    return (x, -z, y)


def ensure_object_mode():
    if bpy.ops.object.mode_set.poll():
        bpy.ops.object.mode_set(mode="OBJECT")


def wipe_default():
    ensure_object_mode()
    for ob in list(bpy.data.objects):
        bpy.data.objects.remove(ob, do_unlink=True)
    for me in list(bpy.data.meshes):
        bpy.data.meshes.remove(me)
    for mat in list(bpy.data.materials):
        bpy.data.materials.remove(mat)
    for col in list(bpy.data.collections):
        if col.name == "Collection":
            continue
        bpy.data.collections.remove(col)


TEX_WOOL = os.path.join(ROOT, "public", "tex", "wool_grey")


def mat_solid(name, color, rough=0.8, metal=0.0, emit=None, es=0.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1)
    bsdf.inputs["Roughness"].default_value = rough
    mat.use_backface_culling = False
    if "Metallic" in bsdf.inputs:
        bsdf.inputs["Metallic"].default_value = metal
    if emit is not None:
        if "Emission Color" in bsdf.inputs:
            bsdf.inputs["Emission Color"].default_value = (*emit, 1)
        if "Emission Strength" in bsdf.inputs:
            bsdf.inputs["Emission Strength"].default_value = es
    return mat


def _mix_multiply(nt, color, tex_color):
    try:
        mix = nt.nodes.new("ShaderNodeMix")
        mix.data_type = "RGBA"
        mix.blend_type = "MULTIPLY"
        fac = mix.inputs.get("Factor") or mix.inputs[0]
        fac.default_value = 0.72
        a = mix.inputs.get("A") or mix.inputs.get("Color1")
        b = mix.inputs.get("B") or mix.inputs.get("Color2")
        a.default_value = (*color, 1)
        nt.links.new(tex_color, b)
        return mix.outputs.get("Result") or mix.outputs.get("Color") or mix.outputs[0]
    except Exception:
        mix = nt.nodes.new("ShaderNodeMixRGB")
        mix.blend_type = "MULTIPLY"
        mix.inputs["Fac"].default_value = 0.72
        mix.inputs["Color1"].default_value = (*color, 1)
        nt.links.new(tex_color, mix.inputs["Color2"])
        return mix.outputs["Color"]


def mat_cloth(name, color, rough=0.86):
    """Wool albedo × tint. Plate cloth is indigo, not flat grey."""
    mat = mat_solid(name, color, rough=rough)
    diff = os.path.join(TEX_WOOL, "diff.jpg")
    if not os.path.exists(diff):
        return mat
    nt = mat.node_tree
    bsdf = nt.nodes.get("Principled BSDF")
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = bpy.data.images.load(diff)
    tex.location = (-620, 240)
    mixed = _mix_multiply(nt, color, tex.outputs["Color"])
    nt.links.new(mixed, bsdf.inputs["Base Color"])
    nor_path = os.path.join(TEX_WOOL, "nor.jpg")
    if os.path.exists(nor_path) and "Normal" in bsdf.inputs:
        ntex = nt.nodes.new("ShaderNodeTexImage")
        ntex.image = bpy.data.images.load(nor_path)
        try:
            ntex.image.colorspace_settings.name = "Non-Color"
        except Exception:
            pass
        ntex.location = (-620, 0)
        nmap = nt.nodes.new("ShaderNodeNormalMap")
        nmap.inputs["Strength"].default_value = 0.4
        nt.links.new(ntex.outputs["Color"], nmap.inputs["Color"])
        nt.links.new(nmap.outputs["Normal"], bsdf.inputs["Normal"])
    return mat


def from_bm(name, bm, mat):
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.update()
    obj = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(obj)
    if mat:
        obj.data.materials.append(mat)
    for p in me.polygons:
        p.use_smooth = True
    return obj


def apply_mod(obj):
    deps = bpy.context.evaluated_depsgraph_get()
    ev = obj.evaluated_get(deps)
    me = bpy.data.meshes.new_from_object(ev)
    old = obj.data
    obj.modifiers.clear()
    obj.data = me
    me.name = old.name
    bpy.data.meshes.remove(old)
    for p in obj.data.polygons:
        p.use_smooth = True


def solidify(obj, thick, offset=0.0):
    mod = obj.modifiers.new("Sol", "SOLIDIFY")
    mod.thickness = thick
    mod.offset = offset
    mod.use_even_offset = True
    mod.use_quality_normals = True
    apply_mod(obj)


def box_uv(obj, scale=1.4):
    me = obj.data
    bm = bmesh.new()
    bm.from_mesh(me)
    uv = bm.loops.layers.uv.verify()
    for face in bm.faces:
        n = face.normal
        ax = 0 if abs(n.x) >= abs(n.y) and abs(n.x) >= abs(n.z) else (1 if abs(n.y) >= abs(n.z) else 2)
        for lp in face.loops:
            c = lp.vert.co
            u, v = (c.y, c.z) if ax == 0 else ((c.x, c.z) if ax == 1 else (c.x, c.y))
            lp[uv].uv = (u * scale, v * scale)
    bm.to_mesh(me)
    bm.free()


def empty_root(name):
    ob = bpy.data.objects.new(name, None)
    ob.empty_display_type = "ARROWS"
    ob.empty_display_size = 0.08
    bpy.context.collection.objects.link(ob)
    return ob


def make_collection(name, objects):
    col = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(col)
    scene_col = bpy.context.scene.collection
    for ob in objects:
        if ob.name not in col.objects:
            col.objects.link(ob)
        if ob.name in scene_col.objects:
            scene_col.objects.unlink(ob)
    return col


def parent(child, root):
    child.parent = root
    child.matrix_parent_inverse = root.matrix_world.inverted()


def ribbon(name, paths, mat, thick, close_u=False):
    bm = bmesh.new()
    rows = []
    for path in paths:
        row = [bm.verts.new(js(*p)) for p in path]
        rows.append(row)
    bm.verts.ensure_lookup_table()
    for i in range(len(rows) - 1):
        a, b = rows[i], rows[i + 1]
        n = min(len(a), len(b))
        for j in range(n - 1):
            try:
                bm.faces.new((a[j], a[j + 1], b[j + 1], b[j]))
            except ValueError:
                pass
        if close_u and n > 2:
            try:
                bm.faces.new((a[n - 1], a[0], b[0], b[n - 1]))
            except ValueError:
                pass
    obj = from_bm(name, bm, mat)
    solidify(obj, thick, 0.0)
    box_uv(obj)
    return obj


def lathe_y(name, profile, segs, mat, rx=1.0, rz=1.0, cap_end=False):
    """profile: (radius, lite_y) rings. Axis = Lite +Y. rx/rz flatten the tube."""
    bm = bmesh.new()
    rings = []
    for r, y in profile:
        ring = []
        for i in range(segs):
            a = 2 * math.pi * i / segs
            ring.append(bm.verts.new(js(r * rx * math.sin(a), y, r * rz * math.cos(a))))
        rings.append(ring)
    bm.verts.ensure_lookup_table()
    for a, b in zip(rings, rings[1:]):
        for i in range(segs):
            j = (i + 1) % segs
            bm.faces.new((a[i], a[j], b[j], b[i]))
    if cap_end and rings:
        last = rings[-1]
        acc = Vector((0.0, 0.0, 0.0))
        for v in last:
            acc += v.co
        acc /= float(segs)
        c = bm.verts.new(acc)
        for i in range(segs):
            j = (i + 1) % segs
            try:
                bm.faces.new((c, last[i], last[j]))
            except ValueError:
                pass
    return from_bm(name, bm, mat)


def subsurf(obj, levels=1):
    mod = obj.modifiers.new("Sub", "SUBSURF")
    mod.levels = levels
    mod.render_levels = levels
    apply_mod(obj)


def ico(name, loc_lite, radius, mat, subdiv=1):
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=subdiv, radius=radius)
    dx, dy, dz = js(*loc_lite)
    for v in bm.verts:
        v.co += Vector((dx, dy, dz))
    return from_bm(name, bm, mat)


# --- path arrays matching equipment.js primitives (Lite space) ---

def cowl_grid():
    """Closed rounded hood with a compact oval face hole. No ear flaps.

    Mixamo Head: +Y feet, +Z face. Hole is a UV patch on the front only;
    crown and neck stay full rings so the silhouette is an egg, not a funnel.
    """
    nu, nv = 28, 11
    rings = []
    for j in range(nv):
        t = j / (nv - 1)
        y = -0.22 + t * 0.40
        r = 0.07 + 0.13 * math.sin(math.pi * min(1.0, t * 1.05))
        z0 = -0.03 + 0.07 * math.sin(math.pi * t)
        ring = []
        for i in range(nu):
            a = 2 * math.pi * i / nu
            ring.append((math.sin(a) * r, y, math.cos(a) * r + z0))
        rings.append(ring)
    hole_j = set(range(4, 7))
    hole_i = set()
    for i in range(nu):
        a = 2 * math.pi * i / nu
        if a < 0.55 or a > (2 * math.pi - 0.55):
            hole_i.add(i)
    return rings, nu, nv, hole_i, hole_j


def cape_paths():
    """Back-only cloak. Narrow span so idle hip/staff is not buried in the cloth."""
    cols = 13
    a0 = math.pi * 0.68
    a1 = math.pi * 1.32
    fold = [0, 0.04, 0.012, 0.07, 0.02, 0.09, 0.03, 0.09, 0.02, 0.07, 0.012, 0.04, 0]
    hem = [0.05, 0.01, 0.09, 0.02, 0.14, 0.04, 0.16, 0.04, 0.10, 0.02, 0.07, 0.01, 0.05]
    rows = [
        {"y": -0.16, "r": 0.15, "zPush": -0.05},
        {"y": 0.06, "r": 0.22, "zPush": -0.12},
        {"y": 0.30, "r": 0.30, "zPush": -0.18},
        {"y": 0.56, "r": 0.36, "zPush": -0.22},
        {"y": 0.84, "r": 0.34, "zPush": -0.20},
        {"y": 1.12, "r": 0.28, "zPush": -0.14},
    ]
    last = len(rows) - 1
    paths = []
    for c in range(cols):
        t = c / (cols - 1)
        a = a0 + t * (a1 - a0)
        path = []
        for ri, row in enumerate(rows):
            r = max(0.08, (row["r"] - fold[c]))
            y = row["y"] + hem[c] * (1 if ri == last else ri / last * 0.3)
            path.append((math.sin(a) * r, y, math.cos(a) * r + row["zPush"]))
        paths.append(path)
    return paths


def shawl_paths():
    """Shoulder wrap on the torso socket. Open at the chest so the cowl void reads."""
    cols = 16
    a0 = math.pi * 0.22
    a1 = math.pi * 1.78
    rows = [
        {"y": -0.42, "r": 0.20, "z": 0.03},
        {"y": -0.30, "r": 0.30, "z": 0.05},
        {"y": -0.16, "r": 0.34, "z": 0.04},
        {"y": -0.04, "r": 0.32, "z": 0.02},
        {"y": 0.08, "r": 0.24, "z": -0.02},
    ]
    paths = []
    for c in range(cols):
        t = c / (cols - 1)
        a = a0 + t * (a1 - a0)
        fold = 0.035 * abs(math.sin(t * math.pi * 3))
        path = []
        for row in rows:
            r = max(0.10, row["r"] - fold)
            path.append((math.sin(a) * r, row["y"], math.cos(a) * r + row["z"]))
        paths.append(path)
    return paths


def robe_paths():
    """Spine1 local: -Y head, +Y feet, +Z chest. Waist cinch + flared hem + armholes."""
    cols = 28
    rows = [
        {"y": -0.36, "r": 0.18, "z": 0.03},
        {"y": -0.24, "r": 0.28, "z": 0.05},
        {"y": -0.10, "r": 0.30, "z": 0.06},
        {"y": 0.08, "r": 0.23, "z": 0.04},
        {"y": 0.24, "r": 0.28, "z": 0.03},
        {"y": 0.46, "r": 0.34, "z": 0.02},
        {"y": 0.72, "r": 0.40, "z": 0.01},
        {"y": 0.96, "r": 0.44, "z": 0.00},
        {"y": 1.16, "r": 0.38, "z": 0.00},
    ]
    last = len(rows) - 1
    paths = []
    for c in range(cols):
        a = (c / cols) * math.pi * 2
        sa, ca = math.sin(a), math.cos(a)
        side = abs(sa)
        fold = 0.06 * abs(math.sin(a * 6.0)) + 0.02 * abs(math.sin(a * 13.0))
        hem = 0.11 * abs(math.sin(a * 3.2 + 0.5)) + 0.04 * abs(math.sin(a * 7.0))
        path = []
        for ri, row in enumerate(rows):
            r = row["r"] - fold
            y = row["y"]
            if y < 0.02:
                r *= 1.0 - 0.42 * (side ** 1.4)
            if ca < 0:
                r *= 0.90
            r = max(0.08, r)
            if ri == last:
                y += hem
            path.append((sa * r, y, ca * r + row["z"]))
        paths.append(path)
    paths.append([p for p in paths[0]])
    return paths


def build_staff(wood, wrap, metal, gem):
    root = empty_root("StaffRoot")
    shaft = lathe_y(
        "StaffShaft",
        [
            (0.018, -0.22),
            (0.022, -0.16),
            (0.016, -0.08),
            (0.015, 0.00),
            (0.026, 0.03),
            (0.028, 0.09),
            (0.022, 0.13),
            (0.014, 0.22),
            (0.013, 0.48),
            (0.012, 0.78),
            (0.016, 0.90),
            (0.020, 0.96),
            (0.010, 0.99),
        ],
        14,
        wood,
    )
    box_uv(shaft, 2.2)
    collar = lathe_y(
        "StaffCollar",
        [(0.018, 0.94), (0.024, 0.96), (0.022, 0.99), (0.014, 1.01)],
        12,
        metal,
    )
    box_uv(collar, 3.0)
    grip = lathe_y(
        "StaffGrip",
        [(0.020, 0.00), (0.030, 0.02), (0.031, 0.10), (0.022, 0.14)],
        12,
        wrap,
    )
    box_uv(grip, 2.4)
    crystal = ico("StaffCrystal", (0.0, 1.04, 0.0), 0.055, gem, 1)
    prong = lathe_y(
        "StaffProng",
        [(0.008, 0.98), (0.006, 1.06), (0.002, 1.12)],
        8,
        metal,
    )
    parts = [shaft, collar, grip, crystal, prong]
    for ob in parts:
        parent(ob, root)
    return root, parts


def build_cowl(cloth, inner):
    root = empty_root("CowlRoot")
    rings, nu, nv, hole_i, hole_j = cowl_grid()
    bm = bmesh.new()
    grid = []
    for ring in rings:
        row = [bm.verts.new(js(*p)) for p in ring]
        grid.append(row)
    bm.verts.ensure_lookup_table()
    for j in range(nv - 1):
        for i in range(nu):
            i2 = (i + 1) % nu
            if j in hole_j and i in hole_i and i2 in hole_i:
                continue
            try:
                bm.faces.new((grid[j][i], grid[j][i2], grid[j + 1][i2], grid[j + 1][i]))
            except ValueError:
                pass
    shell = from_bm("HoodShell", bm, cloth)
    solidify(shell, 0.026, 0.0)
    subsurf(shell, 1)
    box_uv(shell)
    void = ico("HoodVoid", (0.0, -0.04, 0.02), 0.11, inner, 1)
    disc_bm = bmesh.new()
    bmesh.ops.create_circle(disc_bm, cap_ends=True, cap_tris=True, segments=28, radius=0.12)
    bmesh.ops.triangulate(disc_bm, faces=disc_bm.faces)
    for v in disc_bm.verts:
        v.co = Vector(js(v.co.x * 1.2, -0.04 + v.co.y * 1.4, 0.12))
    disc = from_bm("HoodVoidDisc", disc_bm, inner)
    box_uv(disc)
    parts = [shell, void, disc]
    for ob in parts:
        parent(ob, root)
    return root, parts


def build_cape(cloth):
    root = empty_root("CapeRoot")
    cloak = ribbon("CapeCloth", cape_paths(), cloth, 0.020)
    subsurf(cloak, 1)
    parent(cloak, root)
    return root, [cloak]


def build_robe(cloth, leather):
    root = empty_root("RobeRoot")
    body = ribbon("RobeBody", robe_paths(), cloth, 0.024)
    subsurf(body, 1)
    shawl = ribbon("RobeShawl", shawl_paths(), cloth, 0.028)
    subsurf(shawl, 1)
    belt = lathe_y(
        "RobeBelt",
        [(0.225, 0.14), (0.245, 0.16), (0.245, 0.21), (0.220, 0.23)],
        18,
        leather,
    )
    box_uv(belt, 2.4)
    parts = [body, shawl, belt]
    for ob in parts:
        parent(ob, root)
    return root, parts


def build_sleeve(cloth):
    """Upper-arm sleeve to just past the elbow. Modest cuff, capped so caster
    rest does not look into a hollow trumpet. Hands stay Mixamo.
    """
    root = empty_root("SleeveRoot")
    tube = lathe_y(
        "SleeveCloth",
        [
            (0.200, -0.08),
            (0.188, 0.04),
            (0.175, 0.16),
            (0.168, 0.26),
            (0.176, 0.36),
        ],
        16,
        cloth,
        rx=0.92,
        rz=1.08,
        cap_end=True,
    )
    subsurf(tube, 1)
    box_uv(tube, 2.0)
    parent(tube, root)
    return root, [tube]


def build_sleeve_fore(cloth):
    root = empty_root("SleeveForeRoot")
    tube = lathe_y(
        "SleeveForeCloth",
        [
            (0.175, -0.10),
            (0.165, 0.02),
            (0.155, 0.16),
            (0.145, 0.30),
            (0.130, 0.42),
        ],
        14,
        cloth,
    )
    box_uv(tube, 2.0)
    parent(tube, root)
    return root, [tube]


def build_boot(leather):
    root = empty_root("BootRoot")
    # Mixamo foot +Y toward toes; negative Y is up the shin in bind.
    boot = lathe_y(
        "BootLeather",
        [
            (0.055, -0.20),
            (0.062, -0.10),
            (0.072, -0.02),
            (0.080, 0.04),
            (0.086, 0.10),
            (0.070, 0.16),
            (0.040, 0.22),
            (0.012, 0.26),
        ],
        14,
        leather,
    )
    box_uv(boot, 2.2)
    sole = lathe_y(
        "BootSole",
        [
            (0.088, 0.00),
            (0.090, 0.04),
            (0.082, 0.12),
            (0.050, 0.20),
            (0.016, 0.25),
        ],
        12,
        leather,
    )
    box_uv(sole, 2.0)
    parent(boot, root)
    parent(sole, root)
    return root, [boot, sole]


wipe_default()

cloth = mat_cloth("ItemCloth", (0.28, 0.30, 0.38), rough=0.88)
cape_m = mat_cloth("ItemCape", (0.16, 0.14, 0.24), rough=0.86)
robe_m = mat_cloth("ItemRobe", (0.20, 0.22, 0.30), rough=0.84)
inner = mat_solid("ItemVoid", (0.004, 0.002, 0.008), rough=1.0)
wood = mat_solid("ItemWood", (0.22, 0.12, 0.07), rough=0.72)
wrap = mat_solid("ItemWrap", (0.14, 0.09, 0.06), rough=0.78)
metal = mat_solid("ItemMetal", (0.22, 0.22, 0.24), rough=0.32, metal=0.78)
gem = mat_solid("ItemCrystal", (0.38, 0.16, 0.72), rough=0.28, emit=(0.42, 0.14, 0.85), es=2.4)

leather = mat_solid("ItemLeather", (0.12, 0.08, 0.06), rough=0.78)

staff_root, staff_parts = build_staff(wood, wrap, metal, gem)
cowl_root, cowl_parts = build_cowl(cloth, inner)
cape_root, cape_parts = build_cape(cape_m)
robe_root, robe_parts = build_robe(robe_m, leather)
sleeve_root, sleeve_parts = build_sleeve(robe_m)
fore_root, fore_parts = build_sleeve_fore(robe_m)
boot_root, boot_parts = build_boot(leather)

make_collection("staff", [staff_root, *staff_parts])
make_collection("cowl", [cowl_root, *cowl_parts])
make_collection("cape", [cape_root, *cape_parts])
make_collection("robe", [robe_root, *robe_parts])
make_collection("sleeve", [sleeve_root, *sleeve_parts])
make_collection("sleeve-fore", [fore_root, *fore_parts])
make_collection("boot", [boot_root, *boot_parts])

os.makedirs(os.path.dirname(BLEND), exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=BLEND)
print("SAVED", BLEND, os.path.getsize(BLEND))

sys.path.insert(0, SCRIPTS)
from export_item import export_item  # noqa: E402

for item_id in ("staff", "cowl", "cape", "robe", "sleeve", "sleeve-fore", "boot"):
    export_item(item_id, item_id)

print("ITEMS_BUILT", ITEMS_DIR, os.listdir(ITEMS_DIR))
