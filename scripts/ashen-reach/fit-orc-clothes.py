"""Fit CC0 MakeClothes apparel to the bulked source-compatible Orc.

Isolated background Blender. Mirrors fit-armory-clothes.py: proxy fit, author
weights, tailor bisects, source-rest repose, mixamorig remap. The fitting cloud
is the reconstructed Orc MakeHuman body plus bulk displacements transferred
from orc-animated-v1.glb → orc-bulked.glb (nearest-neighbour; GLB export does
not keep MakeHuman vertex indices).
"""
import bpy, bmesh, sys, json, struct, math
from pathlib import Path
from mathutils import Matrix, Vector, Quaternion
from mathutils.kdtree import KDTree

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'scripts/character-assets'))
import mh_io, mh_studio, mh_race
from build_orc_v1 import T
from retarget_bone_map import BONE_PAIRS

SRC = ROOT / 'blender/characters/sources'
ASSETS = SRC / 'armory'
OUT = ROOT / '.cache/armory-assets'
OUT.mkdir(parents=True, exist_ok=True)
BODY_N = mh_io.BODY_VERTS

for ob in list(bpy.data.objects):
    bpy.data.objects.remove(ob, do_unlink=True)

ORC_TARGETS = [
    T("caucasian-male-young.target"),
    T("universal-male-young-maxmuscle-maxweight.target", 0.62),
    T("male-young-maxmuscle-maxweight-maxheight.target", 0.48),
    T("measure-shoulder-dist-incr.target", 1.0),
    T("torso-vshape-incr.target", 1.0),
    T("torso-scale-horiz-incr.target", 1.0),
    T("measure-frontchest-dist-incr.target", 1.0),
    T("measure-bust-circ-incr.target", 0.52),
    T("measure-underbust-circ-incr.target", 0.36),
    T("measure-upperarm-circ-incr.target", 0.62),
    T("measure-thigh-circ-incr.target", 0.62),
    T("measure-calf-circ-incr.target", 0.52),
    T("measure-wrist-circ-incr.target", 0.31),
    T("measure-neck-circ-incr.target", 0.26),
    T("torso-muscle-pectoral-incr.target", 0.40),
    T("torso-muscle-dorsi-incr.target", 0.40),
    T("chin-bones-incr.target", 0.85),
    T("chin-width-incr.target", 0.75),
    T("chin-height-incr.target", 0.55),
    T("chin-prognathism-incr.target", 0.70),
    T("eyebrows-trans-forward.target", 0.70),
    T("eyebrows-trans-down.target", 0.55),
    T("forehead-nubian-incr.target", 0.45),
    T("forehead-temple-incr.target", 0.40),
    T("l-ear-scale-incr.target", 0.80),
    T("r-ear-scale-incr.target", 0.80),
    T("l-ear-shape-pointed.target", 1.0),
    T("r-ear-shape-pointed.target", 1.0),
    T("l-hand-scale-incr.target", 0.70),
    T("r-hand-scale-incr.target", 0.70),
    T("l-foot-scale-incr.target", 0.55),
    T("r-foot-scale-incr.target", 0.55),
    T("eye-left-opened-up.target", 0.85),
    T("eye-right-opened-up.target", 0.85),
]


def load_glb_body(path):
    preexisting = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(path))
    new = [o for o in bpy.data.objects if o not in preexisting]
    arm = next((o for o in new if o.type == 'ARMATURE'), None)
    if arm:
        arm.animation_data_clear()
        for p in arm.pose.bones:
            p.matrix_basis.identity()
        bpy.context.view_layer.update()
    body = next(o for o in new if o.type == 'MESH' and 'Body' in o.name)
    mw = body.matrix_world
    pts = [mw @ v.co for v in body.data.vertices]
    return new, pts


def glb_world(path):
    raw = path.read_bytes()
    g = json.loads(raw[20:20 + struct.unpack_from('<I', raw, 12)[0]])
    world = {}

    def visit(i, parent):
        n = g['nodes'][i]
        q = n.get('rotation', [0, 0, 0, 1])
        m = Matrix.LocRotScale(
            Vector(n.get('translation', [0, 0, 0])),
            Quaternion((q[3], *q[:3])),
            Vector(n.get('scale', [1, 1, 1])),
        )
        if 'matrix' in n:
            m = Matrix([n['matrix'][k::4] for k in range(4)])
        world[n.get('name', str(i))] = parent @ m
        for c in n.get('children', []):
            visit(c, parent @ m)

    for i in g['scenes'][g.get('scene', 0)]['nodes']:
        visit(i, Matrix.Identity(4))
    return g, world


deformed = mh_race.deform_body(
    SRC, ORC_TARGETS, target_height=2.10, neck_forward_deg=13.0, lateral_x_scale=1.015
)
cloud = [list(v) for v in deformed['verts']]
imported_u, unbulked_pts = load_glb_body(ROOT / 'public/characters/bodies/orc-animated-v1.glb')
imported_b, bulked_pts = load_glb_body(ROOT / '.cache/source-motion/orc-bulked.glb')
tree = KDTree(len(unbulked_pts))
for i, p in enumerate(unbulked_pts):
    tree.insert(p, i)
tree.balance()
n_map = min(BODY_N, len(cloud), len(unbulked_pts), len(bulked_pts))
NECK_Z = 1.815
NECK_FADE_START = 1.74
nn_dist = []
faded = 0
for i in range(n_map):
    _co, j, d = tree.find(Vector(cloud[i]))
    nn_dist.append(d)
    if j >= len(bulked_pts):
        continue
    src = unbulked_pts[j]
    fade = 1.0
    if src.z > NECK_FADE_START:
        fade = max(0.0, 1.0 - (src.z - NECK_FADE_START) / max(1e-6, NECK_Z - NECK_FADE_START))
        faded += 1
    if fade <= 1e-6:
        continue
    delta = (bulked_pts[j] - src) * fade
    cloud[i][0] += delta.x
    cloud[i][1] += delta.y
    cloud[i][2] += delta.z
nn_dist.sort()
print(
    'BULK TRANSFER mapped', n_map,
    'nn median', round(nn_dist[n_map // 2], 4),
    'p95', round(nn_dist[int(n_map * 0.95)], 4),
    'max', round(nn_dist[-1], 4),
    'neckFaded', faded,
)
for ob in imported_u + imported_b:
    if ob.name in bpy.data.objects:
        bpy.data.objects.remove(ob, do_unlink=True)

# fit_proxy wants MakeHuman axes; invert the blender plant with zmin=0 (feet already at 0).
mh_cloud = [[v[0] * 10.0, v[2] * 10.0, -v[1] * 10.0] for v in cloud]
body, zmin = mh_io.mh_coords_to_blender(mh_cloud)
bones = mh_io.bones_world(mh_io.load_skel(SRC / 'default.mhskel'), body)
arm = mh_studio.build_armature(bones, 'OrcApparelRig', 'OrcApparelSource')
weights = [{} for _ in mh_cloud]
for bone, entries in json.loads((SRC / 'default_weights.mhw').read_text())['weights'].items():
    for index, value in entries:
        weights[index][mh_io.BONE_RENAME.get(bone, bone)] = value

meshes = []
report = []
catalogue = [
    ('rehmanpolanski_viking_tunic', 'TUNIC_Viking.png', 'WayfarerTunic'),
    ('rehmanpolanski_viking_boots', 'BootsViking.png', 'WayfarerBoots'),
    ('rehmanpolanski_viking_pants', 'PantsViking.png', 'WayfarerTrousers'),
    ('donitz_monk_robe', 'robe_brown__diffuse.png', 'PilgrimTunic'),
    ('rehmanpolanski_viking_tunic', 'TUNIC_Viking.png', 'GraveweaverTop'),
    ('donitz_monk_robe', 'robe_brown__diffuse.png', 'GraveweaverSkirt'),
    ('donitz_monk_robe_hood', 'robe_brown__diffuse.png', 'GraveweaverHood'),
    ('toigo_gloves_short', 'Gloves03UV.png', 'GraveweaverGloves'),
]
for source, texture, name in catalogue:
    clo = mh_io.load_mhclo(ASSETS / f'{source}.mhclo')
    points = mh_io.fit_proxy(mh_cloud, clo)
    _, uv, faces = mh_io.load_obj(ASSETS / clo['obj'])
    points, _ = mh_io.mh_coords_to_blender(points, zmin=zmin)
    ob = mh_studio.build_mesh(name, points, uv, mh_io.obj_loops(faces))
    rows = []
    for mapping in clo['mappings']:
        refs = [(mapping[1], 1)] if mapping[0] == 'helper' else list(zip(mapping[1:4], mapping[4:7]))
        row = {}
        for idx, w in refs:
            if idx >= len(weights):
                raise ValueError('Unweighted helper reference: ' + str(idx))
            for bone, value in weights[idx].items():
                row[bone] = row.get(bone, 0) + max(0, w) * value
        total = sum(row.values())
        assert total > 0
        rows.append({bone: w / total for bone, w in row.items() if w > 0})
    groups = {n: ob.vertex_groups.new(name=n) for n in sorted({n for row in rows for n in row})}
    for i, row in enumerate(rows):
        for bone, w in row.items():
            groups[bone].add([i], w, 'REPLACE')
    if name == 'PilgrimTunic':
        bm = bmesh.new()
        bm.from_mesh(ob.data)
        bmesh.ops.bisect_plane(
            bm, geom=list(bm.verts) + list(bm.edges) + list(bm.faces), dist=0.000001,
            plane_co=(0, 0, 0.62), plane_no=(0, 0, 1), clear_inner=True, clear_outer=False,
        )
        bm.to_mesh(ob.data)
        bm.free()
        ob.data.update()
    if name in ('GraveweaverTop', 'GraveweaverSkirt'):
        bm = bmesh.new()
        bm.from_mesh(ob.data)
        cuts = [(0.98, True)] if name == 'GraveweaverTop' else [(1.16, False), (0.06, True)]
        for z, below in cuts:
            bmesh.ops.bisect_plane(
                bm, geom=list(bm.verts) + list(bm.edges) + list(bm.faces), dist=0.000001,
                plane_co=(0, 0, z), plane_no=(0, 0, 1), clear_inner=below, clear_outer=not below,
            )
        if name == 'GraveweaverSkirt':
            for v in bm.verts:
                ease = max(0, min(1, (1.16 - v.co.z) / 0.20))
                v.co.x *= 1 + 0.06 * ease
                v.co.y = -0.03 + (v.co.y + 0.03) * (1 + 0.10 * ease)
        bm.to_mesh(ob.data)
        bm.free()
        ob.data.update()
    # Extra ease over bulked deltoids / barrel chest so sleeves and tunics clear flesh.
    if name in ('WayfarerTunic', 'PilgrimTunic', 'GraveweaverTop'):
        for v in ob.data.vertices:
            p = v.co
            if 1.15 < p.z < 1.82 and abs(p.x) > 0.06:
                t = max(0.0, min(1.0, (p.z - 1.15) / 0.50))
                grow = 1.0 + 0.12 * t
                v.co.x *= grow
                v.co.y = p.y * (1.0 + 0.05 * t)
            # Drop the front hem and push it forward so it overlaps the trousers.
            if p.z < 1.12 and p.y < 0.04 and abs(p.x) < 0.22:
                v.co.z -= 0.10
                v.co.y -= 0.025
    if name == 'GraveweaverHood':
        c = Vector((0.0, -0.02, 1.94))
        for v in ob.data.vertices:
            p = v.co.copy()
            v.co = c + (p - c) * 0.78
            # Keep the cowl behind the tusk tips; widen and drop the neck onto the traps.
            if v.co.y < c.y - 0.02:
                v.co.y = min(v.co.y + 0.055, c.y - 0.01)
                v.co.x *= 1.10
            if 1.68 < v.co.z < 1.88:
                v.co.x *= 1.10
                v.co.z -= 0.025
    if name in ('WayfarerTrousers',):
        for v in ob.data.vertices:
            if 0.55 < v.co.z < 1.28:
                t = max(0.0, min(1.0, (1.28 - v.co.z) / 0.45))
                v.co.x *= 1.0 + 0.18 * t
                if abs(v.co.x) < 0.16:
                    v.co.x *= 1.0 + 0.55 * t
                v.co.y *= 1.0 + 0.10 * t
            # Raise the rise so the inseam meets the tunic hem.
            if 1.00 < v.co.z < 1.28 and abs(v.co.x) < 0.20:
                v.co.z += 0.07
                v.co.y -= 0.02
    if name == 'GraveweaverGloves':
        # Grow slightly toward the elbow so the cuff meets the sleeve.
        for v in ob.data.vertices:
            p = v.co
            if abs(p.x) > 0.45 and p.z > 1.35:
                v.co.x *= 1.04
                v.co.z -= 0.012
    mh_studio.parent_armature(ob, arm)
    image = bpy.data.images.load(str(ASSETS / texture))
    # 256 + Closest turned the tunic's silver eagle into a pale ragged blotch.
    if name in ('WayfarerTunic', 'GraveweaverTop'):
        image.scale(512, 512)
        filt = 'Linear'
    else:
        image.scale(256, 256)
        filt = 'Closest'
    image.filepath_raw = str(OUT / f'Orc{name}.png')
    image.file_format = 'PNG'
    image.save()
    image.pack()
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    bsdf.inputs['Roughness'].default_value = 0.95
    tex = mat.node_tree.nodes.new('ShaderNodeTexImage')
    tex.image = image
    tex.interpolation = filt
    mat.node_tree.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
    ob.data.materials.append(mat)
    for face in ob.data.polygons:
        face.use_smooth = True
    meshes.append(ob)
    report.append({'item': name, 'vertices': len(points), 'polygons': len(faces), 'source': clo['obj']})

# Already in the unbulked A-rest that bulk_orc warped; do not A-pose again.
# Repose arms to the Orc source-rest directions, then bind to the 65-joint actor.
g, world = glb_world(ROOT / 'public/characters/candidates/orc-source-v1.glb')


def source_point(name):
    p = world['mixamorig:' + name].translation
    return Vector((p.x, -p.z, p.y))


def head(name):
    return arm.matrix_world @ arm.pose.bones[name].head


for side in ['Left', 'Right']:
    for a, b in [('Arm', 'ForeArm'), ('ForeArm', 'Hand')]:
        pb = arm.pose.bones[side + a]
        v = head(side + b) - head(side + a)
        desired = source_point(side + b) - source_point(side + a)
        q = v.rotation_difference(desired)
        pw = arm.matrix_world @ pb.matrix
        origin = pw.translation.copy()
        pb.matrix = arm.matrix_world.inverted() @ Matrix.Translation(origin) @ q.to_matrix().to_4x4() @ Matrix.Translation(-origin) @ pw
        bpy.context.view_layer.update()
mh_studio.bake_pose_as_rest(arm, meshes)

map_names = dict(BONE_PAIRS)
map_names.update({
    'Spine': 'mixamorig:Spine', 'spine04': 'mixamorig:Spine',
    'Spine2': 'mixamorig:Spine1', 'spine02': 'mixamorig:Spine1',
    'spine01': 'mixamorig:Spine2',
})
for bone in arm.data.bones:
    if bone.name in map_names:
        continue
    parent = bone.parent
    while parent and parent.name not in map_names:
        parent = parent.parent
    if not parent:
        raise ValueError('Unmapped bone ' + bone.name)
    map_names[bone.name] = map_names[parent.name]
for ob in meshes:
    bpy.context.view_layer.objects.active = ob
    ob.select_set(True)
    for mod in list(ob.modifiers):
        if mod.type == 'ARMATURE':
            bpy.ops.object.modifier_apply(modifier=mod.name)
    rows = []
    for v in ob.data.vertices:
        row = {}
        for group in v.groups:
            n = map_names[ob.vertex_groups[group.group].name]
            row[n] = row.get(n, 0) + group.weight
        row = dict(sorted(row.items(), key=lambda x: -x[1])[:4])
        total = sum(row.values())
        rows.append({n: w / total for n, w in row.items()})
    ob.vertex_groups.clear()
    groups = {n: ob.vertex_groups.new(name=n) for n in sorted({n for row in rows for n in row})}
    for i, row in enumerate(rows):
        for n, w in row.items():
            groups[n].add([i], w, 'REPLACE')

bpy.ops.object.select_all(action='DESELECT')
arm.select_set(True)
bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode='EDIT')
for bone in list(arm.data.edit_bones):
    arm.data.edit_bones.remove(bone)
for i in g['skins'][0]['joints']:
    name = g['nodes'][i]['name']
    p = world[name].translation
    bone = arm.data.edit_bones.new(name)
    bone.head = (p.x, -p.z, p.y)
    bone.tail = bone.head + Vector((0, 0, 0.05))
bpy.ops.object.mode_set(mode='OBJECT')
arm.data.pose_position = 'REST'

chest = world['mixamorig:Spine2'].translation
# glTF Y-up → Blender Z-up; character faces −Y, so −Y is the chest front.
cx, cy, cz = chest.x, -chest.z, chest.y
pendant_vertices = []
pendant_faces = []
pendant_materials = []


def pv(x, y, z):
    pendant_vertices.append((x, y, z))
    return len(pendant_vertices) - 1


def pf(indices, material=0):
    pendant_faces.append(indices)
    pendant_materials.append(material)


for side in [-1, 1]:
    points = [
        (cx + side * 0.10, cy - 0.02, cz + 0.16),
        (cx + side * 0.065, cy - 0.10, cz + 0.08),
        (cx, cy - 0.16, cz - 0.02),
    ]
    for a, b in zip(points, points[1:]):
        va = [pv(a[0] - 0.007, a[1], a[2]), pv(a[0] + 0.007, a[1], a[2]), pv(b[0] + 0.007, b[1], b[2]), pv(b[0] - 0.007, b[1], b[2])]
        pf(va)
outer = [pv(cx + math.sin(i * math.tau / 8) * 0.052, cy - 0.17, cz - 0.02 + math.cos(i * math.tau / 8) * 0.060) for i in range(8)]
inner = [pv(cx + math.sin(i * math.tau / 8) * 0.032, cy - 0.18, cz - 0.02 + math.cos(i * math.tau / 8) * 0.038) for i in range(8)]
center = pv(cx, cy - 0.20, cz - 0.02)
for i in range(8):
    pf((outer[i], outer[(i + 1) % 8], inner[(i + 1) % 8], inner[i]))
    pf((center, inner[i], inner[(i + 1) % 8]), 1)
mesh = bpy.data.meshes.new('GraveweaverPendant')
mesh.from_pydata(pendant_vertices, [], pendant_faces)
mesh.update()
pendant = bpy.data.objects.new('GraveweaverPendant', mesh)
bpy.context.collection.objects.link(pendant)
for name, color, metallic in [('Aged bronze', (0.38, 0.29, 0.12, 1), 0.5), ('Amethyst', (0.30, 0.14, 0.43, 1), 0.15)]:
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    bsdf.inputs['Base Color'].default_value = color
    bsdf.inputs['Metallic'].default_value = metallic
    bsdf.inputs['Roughness'].default_value = 0.65
    mesh.materials.append(mat)
for polygon, material in zip(mesh.polygons, pendant_materials):
    polygon.material_index = material
pendant.vertex_groups.new(name='mixamorig:Spine2').add(list(range(len(pendant_vertices))), 1, 'REPLACE')
meshes.append(pendant)
for ob in meshes:
    mh_studio.parent_armature(ob, arm)
    ob.select_set(True)
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / 'blender/characters/ashen-orc-wayfarer.blend'))
bpy.ops.export_scene.gltf(
    filepath=str(OUT / 'orc-apparel-rest.glb'),
    use_selection=True,
    export_format='GLB',
    export_animations=False,
    export_skins=True,
    export_all_influences=False,
    export_cameras=False,
    export_lights=False,
)
(OUT / 'orc-fit-report.json').write_text(json.dumps(report, indent=2))
print('ORC APPAREL FIT', report)
