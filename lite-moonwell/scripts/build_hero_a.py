"""POC A — plate-faithful hooded mage. Cloth-sim cape. Not the shrine file."""
import math
import os
import random

import bmesh
import bpy
from mathutils import Vector, noise

ROOT = "/Users/antbly/dev/wow-clone/lite-moonwell"
BLEND = os.path.join(ROOT, "blender", "hero-a.blend")
TEX = os.path.join(ROOT, "public", "tex")
WOOL = os.path.join(TEX, "wool_grey", "diff.jpg")
REF = os.path.join(ROOT, "blender", "ref", "poc-a-plate.jpg")
RNG = random.Random(3)

SHRINE = {"MoonSun", "Ground", "LanternA_L", "WellGlow", "Dummy", "Basin"}
if any(n in bpy.data.objects for n in SHRINE):
    raise RuntimeError("Shrine is live. Save moonwell.blend first.")


def mat_wool(name, tint, scale=(2.8, 2.8, 1), rough=0.78):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    bsdf.inputs["Roughness"].default_value = rough
    texc = nt.nodes.new("ShaderNodeTexCoord")
    mapping = nt.nodes.new("ShaderNodeMapping")
    mapping.inputs["Scale"].default_value = scale
    nt.links.new(texc.outputs["UV"], mapping.inputs["Vector"])
    if os.path.exists(WOOL):
        img = bpy.data.images.load(WOOL, check_existing=True)
        n = nt.nodes.new("ShaderNodeTexImage")
        n.image = img
        nt.links.new(mapping.outputs["Vector"], n.inputs["Vector"])
        mix = nt.nodes.new("ShaderNodeMix")
        mix.data_type = "RGBA"
        mix.blend_type = "MULTIPLY"
        mix.inputs["Factor"].default_value = 1.0
        mix.inputs["B"].default_value = (*tint, 1)
        nt.links.new(n.outputs["Color"], mix.inputs["A"])
        nt.links.new(mix.outputs["Result"], bsdf.inputs["Base Color"])
    else:
        bsdf.inputs["Base Color"].default_value = (*tint, 1)
    return mat


def mat_solid(name, color, rough=0.6, metal=0.0, emit=None, es=0.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1)
    bsdf.inputs["Roughness"].default_value = rough
    if "Metallic" in bsdf.inputs:
        bsdf.inputs["Metallic"].default_value = metal
    if emit is not None and "Emission Color" in bsdf.inputs:
        bsdf.inputs["Emission Color"].default_value = (*emit, 1)
        bsdf.inputs["Emission Strength"].default_value = es
    return mat


def from_bm(name, bm, mat):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.update()
    obj = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(obj)
    if mat:
        obj.data.materials.append(mat)
    for p in obj.data.polygons:
        p.use_smooth = True
    return obj


def lathe(name, profile, segs, mat):
    bm = bmesh.new()
    rings = []
    for r, z in profile:
        ring = []
        for i in range(segs):
            a = 2 * math.pi * i / segs
            ring.append(bm.verts.new((r * math.sin(a), -r * math.cos(a), z)))
        rings.append(ring)
    bm.verts.ensure_lookup_table()
    for ri in range(len(rings) - 1):
        a, b = rings[ri], rings[ri + 1]
        for i in range(segs):
            j = (i + 1) % segs
            bm.faces.new((a[i], a[j], b[j], b[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return from_bm(name, bm, mat)


def apply_mod(obj, name):
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.modifier_apply(modifier=name)
    obj.select_set(False)


def smart_uv(obj):
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    try:
        bpy.ops.uv.smart_project(angle_limit=66, island_margin=0.03)
    except Exception:
        bpy.ops.uv.unwrap(method="ANGLE_BASED", margin=0.03)
    bpy.ops.object.mode_set(mode="OBJECT")
    obj.select_set(False)


if bpy.ops.object.mode_set.poll():
    bpy.ops.object.mode_set(mode="OBJECT")
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)

cloth = mat_wool("A_Cloth", (0.52, 0.60, 0.70), (3.0, 3.0, 1), 0.82)
robe_m = mat_wool("A_Robe", (0.28, 0.30, 0.34), (2.2, 3.6, 1), 0.8)
under = mat_wool("A_Under", (0.16, 0.15, 0.14), (2.0, 3.0, 1), 0.75)
void = mat_solid("A_Void", (0.008, 0.008, 0.01), rough=1.0)
leather = mat_solid("A_Leather", (0.14, 0.09, 0.07), rough=0.76)
wood = mat_solid("A_Wood", (0.26, 0.16, 0.09), rough=0.72)
metal = mat_solid("A_Metal", (0.22, 0.22, 0.24), rough=0.32, metal=0.78)
flame = mat_solid("A_Flame", (0.12, 0.04, 0.28), rough=0.18, emit=(0.55, 0.2, 1.0), es=14)
crystal = mat_solid("A_Crystal", (0.2, 0.1, 0.48), rough=0.2, emit=(0.4, 0.15, 0.9), es=2.6)

# --- collision body ---
bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=0.16, depth=1.15, location=(0, 0, 0.78))
body_col = bpy.context.active_object
body_col.name = "A_Collision"
body_col.modifiers.new("Collision", "COLLISION")
body_col.hide_render = True
body_col.display_type = "WIRE"

# inner robe (visible)
robe = lathe(
    "A_Robe",
    [(0.12, 0.28), (0.17, 0.45), (0.19, 0.85), (0.17, 1.18), (0.14, 1.32)],
    36,
    robe_m,
)
for v in robe.data.vertices:
    ang = math.atan2(v.co.x, -v.co.y)
    n = noise.noise(Vector((v.co.x * 6, v.co.y * 6, v.co.z * 4)))
    r = math.hypot(v.co.x, v.co.y)
    k = 1 + 0.035 * math.sin(10 * ang + v.co.z * 3) + 0.02 * n
    v.co.x *= k
    v.co.y *= k
robe.data.update()
for v in robe.data.vertices:
    if v.co.z < 0.38:
        n = noise.noise(Vector((v.co.x * 12, v.co.y * 12, 1)))
        if n < 0.15:
            v.co.z -= 0.04 + 0.08 * (0.15 - n)
robe.data.update()

under_r = lathe(
    "A_Under",
    [(0.10, 0.05), (0.13, 0.2), (0.14, 0.55), (0.13, 0.9)],
    24,
    under,
)

# boots
for side, nm in ((-1, "L"), (1, "R")):
    b = lathe(
        f"A_Boot{nm}",
        [(0.048, 0.0), (0.062, 0.025), (0.05, 0.16), (0.042, 0.28)],
        14,
        leather,
    )
    for v in b.data.vertices:
        v.co.x += 0.075 * side
        if v.co.z < 0.05:
            v.co.y -= 0.028
    b.data.update()

# gloves / sleeves
for side, nm in ((-1, "L"), (1, "R")):
    sl = lathe(
        f"A_Sleeve{nm}",
        [(0.05, 1.18), (0.065, 1.05), (0.06, 0.92), (0.048, 0.80)],
        14,
        cloth,
    )
    for v in sl.data.vertices:
        v.co.x += 0.17 * side
        v.co.y -= 0.04
    sl.data.update()
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=12, ring_count=8, radius=0.042, location=(0.24 * side, -0.05, 0.76)
    )
    g = bpy.context.active_object
    g.name = f"A_Glove{nm}"
    g.scale = (0.85, 1.2, 0.7)
    bpy.ops.object.transform_apply(scale=True)
    g.data.materials.append(leather)
    for p in g.data.polygons:
        p.use_smooth = True
bpy.data.objects["A_GloveR"].location = (0.30, 0.02, 1.10)

# --- cloth cape: high-res sheet pinned at cowl, open in front ---
sx, sy = 28, 36
bm = bmesh.new()
verts = []
for j in range(sy):
    t = j / (sy - 1)
    row = []
    z = 1.38 - t * 1.28
    for i in range(sx):
        u = i / (sx - 1)
        # u=0..1 around back: skip front opening. Map u to ang 0.45..5.83 (open at -Y)
        ang = 0.55 + u * (2 * math.pi - 1.10)
        r = 0.20 + 0.48 * (t ** 0.9)
        r += 0.16 * t * (0.5 - 0.5 * math.cos(ang))
        n = noise.noise(Vector((u * 8, t * 8, 2)))
        r += 0.03 * n * t
        x = r * math.sin(ang)
        y = -r * math.cos(ang)
        row.append(bm.verts.new((x, y, z)))
    verts.append(row)
for j in range(sy - 1):
    for i in range(sx - 1):
        bm.faces.new((verts[j][i], verts[j][i + 1], verts[j + 1][i + 1], verts[j + 1][i]))
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
cape = from_bm("A_Cape", bm, cloth)

# pin top two rows
vg = cape.vertex_groups.new(name="Pin")
me = cape.data
top = [v.index for v in me.vertices if v.co.z > 1.28]
vg.add(top, 1.0, "REPLACE")

sub = cape.modifiers.new("Sub", "SUBSURF")
sub.levels = 1
sub.render_levels = 1
cl = cape.modifiers.new("Cloth", "CLOTH")
cl.settings.quality = 10
cl.settings.mass = 0.35
cl.settings.tension_stiffness = 8
cl.settings.compression_stiffness = 8
cl.settings.shear_stiffness = 8
cl.settings.bending_stiffness = 0.4
cl.settings.vertex_group_mass = "Pin"
cl.collision_settings.use_collision = True
cl.collision_settings.distance_min = 0.01
cl.point_cache.frame_start = 1
cl.point_cache.frame_end = 48

scene = bpy.context.scene
scene.frame_start = 1
scene.frame_end = 48
scene.frame_set(1)
bpy.ops.ptcache.free_bake_all()
bpy.ops.ptcache.bake_all(bake=True)
scene.frame_set(48)
bpy.context.view_layer.objects.active = cape
cape.select_set(True)
# apply cloth at baked frame
try:
    bpy.ops.object.modifier_apply(modifier="Sub")
except Exception:
    pass
try:
    bpy.ops.object.modifier_apply(modifier="Cloth")
except Exception as exc:
    print("cloth apply", exc)

# extra tatter on hem after sim
for v in cape.data.vertices:
    if v.co.z > 0.35:
        continue
    n = noise.noise(Vector((v.co.x * 14, v.co.y * 14, 4)))
    if n < 0.2:
        v.co.z -= 0.06 + 0.12 * (0.2 - n)
cape.data.update()

# punch a few holes by deleting faces near hem
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.select_all(action="DESELECT")
bpy.ops.object.mode_set(mode="OBJECT")
for p in cape.data.polygons:
    c = cape.matrix_world @ p.center if False else Vector(p.center)
    if c.z < 0.55 and RNG.random() < 0.08:
        p.select = True
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.delete(type="FACE")
bpy.ops.object.mode_set(mode="OBJECT")

sol = cape.modifiers.new("Solidify", "SOLIDIFY")
sol.thickness = 0.01
sol.offset = 1
apply_mod(cape, "Solidify")

# hanging strips
for i in range(12):
    ang = 0.7 + i * 0.42
    t = RNG.random()
    z0 = 0.18 + t * 0.4
    leng = 0.16 + RNG.random() * 0.28
    r = 0.42 + 0.12 * RNG.random()
    x = r * math.sin(ang)
    y = -r * math.cos(ang) + 0.1
    bm = bmesh.new()
    w = 0.014 + RNG.random() * 0.022
    bm.faces.new((
        bm.verts.new((x - w, y, z0)),
        bm.verts.new((x + w, y, z0)),
        bm.verts.new((x + w * 0.5, y + 0.04, z0 - leng)),
        bm.verts.new((x - w * 0.3, y - 0.02, z0 - leng * 0.92)),
    ))
    from_bm(f"A_Strip{i}", bm, cloth)

# cowl
cowl = lathe(
    "A_Cowl",
    [(0.16, 1.24), (0.24, 1.30), (0.28, 1.38), (0.22, 1.48), (0.16, 1.52)],
    28,
    cloth,
)
for v in cowl.data.vertices:
    n = noise.noise(Vector((v.co.x * 7, v.co.y * 7, v.co.z * 5)))
    v.co.x *= 1 + 0.04 * n
    v.co.y *= 1 + 0.04 * n
    v.co.y -= 0.03
cowl.data.update()

# hood + void
hood = lathe(
    "A_Hood",
    [(0.12, 1.42), (0.20, 1.50), (0.23, 1.60), (0.19, 1.72), (0.10, 1.79), (0.02, 1.78)],
    24,
    cloth,
)
for v in hood.data.vertices:
    v.co.y -= 0.08 + 0.05 * ((v.co.z - 1.42) / 0.38)
hood.data.update()
lining = lathe(
    "A_Void",
    [(0.0, 1.48), (0.10, 1.50), (0.13, 1.60), (0.10, 1.70), (0.0, 1.68)],
    18,
    void,
)
for v in lining.data.vertices:
    v.co.y -= 0.10
lining.data.update()
bpy.context.view_layer.objects.active = lining
lining.select_set(True)
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.mesh.flip_normals()
bpy.ops.object.mode_set(mode="OBJECT")
lining.select_set(False)

# staff (right hand +X)
sx, sy = 0.30, 0.02
bm = bmesh.new()
segs, rings = 10, 30
for ri in range(rings):
    t = ri / (rings - 1)
    z = 0.02 + t * 2.10
    rad = 0.017 - 0.006 * t
    wob = 0.008 * math.sin(t * 14)
    for si in range(segs):
        a = 2 * math.pi * si / segs
        bm.verts.new((sx + rad * math.cos(a), sy + wob + rad * math.sin(a), z))
bm.verts.ensure_lookup_table()
for ri in range(rings - 1):
    for si in range(segs):
        a = ri * segs + si
        b = ri * segs + (si + 1) % segs
        c = (ri + 1) * segs + (si + 1) % segs
        d = (ri + 1) * segs + si
        bm.faces.new((bm.verts[a], bm.verts[b], bm.verts[c], bm.verts[d]))
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
from_bm("A_Staff", bm, wood)
for i, z in enumerate((0.55, 1.15, 1.62, 1.95)):
    bpy.ops.mesh.primitive_torus_add(
        major_radius=0.022, minor_radius=0.004, location=(sx, sy, z),
        major_segments=14, minor_segments=8,
    )
    band = bpy.context.active_object
    band.name = f"A_Band{i}"
    band.data.materials.append(metal)
bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=0.036, location=(sx, sy, 2.08))
cr = bpy.context.active_object
cr.name = "A_Crystal"
cr.scale = (0.7, 0.7, 1.3)
bpy.ops.object.transform_apply(scale=True)
cr.data.materials.append(crystal)
bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=0.05, location=(sx, sy, 2.16))
fl = bpy.context.active_object
fl.name = "A_Flame"
fl.scale = (0.5, 0.5, 1.55)
bpy.ops.object.transform_apply(scale=True)
fl.data.materials.append(flame)

# beads
for i, (z, dx) in enumerate(((0.98, 0.03), (1.12, 0.05), (1.28, 0.04))):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=10, ring_count=6, radius=0.012 + i * 0.003, location=(0.04 + dx, -0.13, z))
    bead = bpy.context.active_object
    bead.name = f"A_Bead{i}"
    bead.data.materials.append(metal if i else crystal)

body_col.hide_set(True)

# reference plane
if os.path.exists(REF):
    img = bpy.data.images.load(REF, check_existing=True)
    mat = bpy.data.materials.new("A_Ref")
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    em = nt.nodes.new("ShaderNodeEmission")
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = img
    nt.links.new(tex.outputs["Color"], em.inputs["Color"])
    nt.links.new(em.outputs["Emission"], out.inputs["Surface"])
    bpy.ops.mesh.primitive_plane_add(size=2.0, location=(1.55, 0.9, 1.05))
    pl = bpy.context.active_object
    pl.name = "A_LookPlate"
    pl.rotation_euler = (math.pi / 2, 0, 0)
    pl.scale = (0.78, 1, 1.22)
    pl.data.materials.append(mat)

for o in list(bpy.data.objects):
    if o.type == "MESH" and o.name.startswith("A_") and o.name not in ("A_Collision", "A_LookPlate"):
        try:
            smart_uv(o)
        except Exception:
            pass

# lights
scene.render.engine = "BLENDER_EEVEE"
world = scene.world or bpy.data.worlds.new("W")
scene.world = world
world.use_nodes = True
bg = world.node_tree.nodes.get("Background")
if bg:
    bg.inputs[0].default_value = (0.14, 0.145, 0.16, 1)
    bg.inputs[1].default_value = 0.5
for o in list(bpy.data.objects):
    if o.type == "LIGHT":
        bpy.data.objects.remove(o, do_unlink=True)
bpy.ops.object.light_add(type="AREA", location=(1.6, -2.6, 2.6))
key = bpy.context.active_object
key.data.energy = 380
key.data.size = 1.8
key.rotation_euler = (1.05, 0.2, 0.5)
bpy.ops.object.light_add(type="AREA", location=(-1.8, 1.8, 2.0))
rim = bpy.context.active_object
rim.data.energy = 70
rim.data.color = (0.55, 0.65, 0.9)
bpy.ops.object.light_add(type="POINT", location=(sx, sy, 2.16))
pl = bpy.context.active_object
pl.data.energy = 14
pl.data.color = (0.55, 0.22, 1.0)
pl.data.shadow_soft_size = 0.06

if scene.camera is None:
    bpy.ops.object.camera_add()
    scene.camera = bpy.context.active_object
cam = scene.camera
cam.location = (1.55, -3.1, 1.45)
cam.rotation_euler = (Vector((0.05, 0.05, 0.95)) - cam.location).to_track_quat("-Z", "Y").to_euler()

os.makedirs(os.path.dirname(BLEND), exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=BLEND)
print("HERO_A", BLEND, "objects", len(bpy.data.objects))
