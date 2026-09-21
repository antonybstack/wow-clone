"""Build the playable Undead revenant on the 65-joint source bind.

Run in isolated Blender (not MCP 9876), same as the Orc:

    /Applications/Blender.app/Contents/MacOS/Blender --background \
        --python scripts/character-assets/undead_from_skull.py -- [flags]

Why this is not the Orc script with different numbers
-----------------------------------------------------
The retired `undead-v1` asset was a MakeHuman man on the obsolete 163-joint rig:
163 skin joints, 7 clips, hair, eyebrows and brown eyes, the same 14517-vertex
shell as the discarded legacy Orc. No lattice turns that head into a skull,
because orbits, a nasal aperture, zygomatic arches and a free mandible are
different forms, not displaced ones. So:

* the **head is a real skull** -- CC0 scan, `blender/characters/sources/undead-skull`,
  cranium + free mandible + 32 individual teeth, kept as its own shells and
  carrying its own surface detail into the joined body (there is no separate
  high-poly to bake a normal map from, so none is baked -- see bake_ao);
* the **body is authored around the bind itself**, as lofted superelliptical
  shells along the retargeted bone graph, so the surface cannot drift from the
  skeleton that deforms it;
* **weights are analytic**, from distance to the bone segments the region is
  allowed to use, then smoothed over the mesh graph. Bone-heat on a pile of
  disjoint shells fails or bleeds across fingers.

The skull, mandible and teeth are weighted rigidly to `mixamorig:Head`, which is
what keeps the jaw from swimming during motion.

Outputs
-------
    .cache/source-motion/undead-source-rest.glb    rest surfaces + temp armature
    .cache/source-motion/undead-source-joints.json 65 joint centres, metres, glTF Y-up

`scripts/character-assets/bind-source-undead.mjs` then assembles those onto
`public/characters/base.glb` and its 55 clips.

Flags
-----
    --no-bake       skip the Cycles normal/AO bake (fast silhouette iteration)
    --preview       write Workbench turnaround PNGs into the cache
    --height <m>    overall height, default 1.95
    --bake-size <n> bake resolution, default 1024
"""

import json
import math
import sys
from pathlib import Path

import bmesh
import bpy
from mathutils import Matrix, Vector

ROOT = Path(__file__).resolve().parents[2]
SKULL_OBJ = ROOT / 'blender/characters/sources/undead-skull/skull-obj/skull-Low4K.obj'
HUMAN_SRC = ROOT / 'public/characters/candidates/human-source-v1.glb'
CACHE = ROOT / '.cache/source-motion'
REST = CACHE / 'undead-source-rest.glb'
JOINTS_OUT = CACHE / 'undead-source-joints.json'
PREVIEW_DIR = CACHE / 'undead'

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []


def arg(flag, default):
    return argv[argv.index(flag) + 1] if flag in argv else default


DO_BAKE = '--no-bake' not in argv
DO_PREVIEW = '--preview' in argv
TARGET_HEIGHT = float(arg('--height', '1.95'))
BAKE_SIZE = int(arg('--bake-size', '1024'))
# AO ray length. Long rays make the legs occlude each other and the arms occlude the
# torso, which reads as grime rather than form; this is short enough to catch the
# orbits, under the jaw, the armpits and the intercostal hollows and nothing else.
AO_DISTANCE = float(arg('--ao-distance', '0.25'))
# Scales the raw curvature estimate in paint() into a 0..1 darkening. The raw
# values are small -- a deep orbit rim reads around 0.08 -- so this is a gain,
# not a blend factor. At 6.0 the term landed in anatomically correct places but
# only moved the cranium by a mean of 1.4 of 255, which does not read at the
# gameplay camera; 12.0 is the value the fix5 stills were picked against.
CAVITY_GAIN = float(arg('--cavity-gain', '12.0'))

# ---------------------------------------------------------------- proportions
# Concept: tall, gaunt, narrow silhouette, long bony hands. Half-widths in metres
# at TARGET_HEIGHT. The Human bind these are derived from is 1.789 m.
HUMAN_HEIGHT = 1.789
SHOULDER_HALF = 0.232      # arm root |x|. Human scaled would be 0.272 -- narrower.
HIP_HALF = 0.104           # leg root |x|
# Human reference at 1.789 m: upper arm 0.255, forearm 0.262, wrist-to-tip 0.211,
# fingertip span 1.956 = 1.094x height. Scaled to 1.95 that is 0.278 / 0.286 / 0.230.
UPPER_ARM = 0.288          # Arm -> ForeArm, 4% over scaled human
FOREARM = 0.300            # ForeArm -> Hand, 5% over
FINGER_SCALE = 1.22        # long bony hands. Final span lands near 1.12x height.
NECK_EXTRA = 0.022         # gaunt exposed neck

# Body radii. (rx = left-right half width, ry = front-back half depth).
TORSO_RINGS = [
    # (height as a fraction of hips->neck, half width, half depth, y offset).
    # frac 0 is the hip joint. Negative fracs build the pelvis down to the crotch;
    # they taper hard so the pelvis does not hang as a bulb between the thighs.
    (-0.115, 0.072, 0.064, 0.012),   # crotch
    (-0.062, 0.108, 0.088, 0.009),   # pelvic floor
    (-0.008, 0.132, 0.104, 0.016),   # iliac crest, widest point of the pelvis
    (0.10, 0.120, 0.103, 0.013),     # hips, carrying what is left of the buttock
    (0.27, 0.098, 0.082, -0.003),    # gaunt waist
    (0.43, 0.110, 0.095, -0.011),    # floating ribs
    (0.59, 0.127, 0.105, -0.015),    # lower ribcage
    (0.75, 0.136, 0.106, -0.012),    # chest
    (0.89, 0.136, 0.092, -0.004),    # clavicle shelf
    (1.00, 0.101, 0.078, 0.006),     # neck root
]
TORSO_SEGS = 24
TORSO_POWER = 2.25

NECK_R = (0.046, 0.044)
ARM_RADII = [(0.0, 0.058, 0.055), (0.18, 0.051, 0.049), (0.62, 0.042, 0.041), (1.0, 0.038, 0.037)]
FOREARM_RADII = [(0.0, 0.046, 0.045), (0.30, 0.040, 0.039), (1.0, 0.024, 0.023)]
THIGH_RADII = [(0.0, 0.086, 0.090), (0.35, 0.073, 0.077), (1.0, 0.058, 0.060)]
SHIN_RADII = [(0.0, 0.058, 0.060), (0.30, 0.055, 0.054), (1.0, 0.033, 0.032)]
LIMB_SEGS = 14
LIMB_POWER = 2.35

PALM_HALF_THICK = 0.0155
FINGER_R_BASE = 0.0110
FINGER_R_TIP = 0.0062
FINGER_SEGS = 8
REMESH_VOXEL = 0.0045      # torso/limbs only; hands and skull keep authored topology
REMESH_TRIS = 12000

# Skull placement. Scale is chosen so the cranium width reads narrow at play distance.
# Sized by height so the head reads at play distance. The raw scan is 0.199 tall
# at 0.150 wide; 0.225 tall puts the figure near 8.8 heads, gaunt but not pinheaded.
SKULL_HEIGHT = 0.225
SKULL_FORWARD = 0.010      # seat the ear canal over the Head joint, not the centroid
SKULL_DROP = 0.004         # nudge down so the crown sits on HeadTop_End
EYE_RADIUS = 0.0095
# Measured off the +X profile render: orbit centre sits 45% of the vertex-to-chin
# height below the crown and 17% of the depth back from the face.
EYE_X_FRACTION = 0.200     # of skull width, per side -> 60 mm interocular
EYE_Y_FRACTION = 0.215
EYE_Z_FRACTION = 0.450

# Palette. Ashen churchyard, not lime. Bone is warm old ivory, flesh is a colder
# grey-green so the skull reads lighter than the hide it sits on.
#
# These are LINEAR values and the quoted bytes are what bake_vertex_colours writes
# into the sRGB atlas -- quoted because the first build to encode correctly showed
# the old numbers had been chosen against the broken path. FLESH 0.352 landed as
# byte 90 and looked like dark hide; encoded properly it is byte 160, a pale neutral
# mannequin. Re-picked against the corrected encoding, from the fix1 stills.
BONE = (0.445, 0.413, 0.314, 1.0)          # byte 178,172,152 -- old ivory, not white
BONE_DEEP = (0.076, 0.061, 0.040, 1.0)     # orbits, nasal aperture, under the arches
TOOTH = (0.515, 0.485, 0.381, 1.0)
FLESH = (0.181, 0.191, 0.138, 1.0)         # byte 118,121,104 -- desiccated hide
FLESH_DARK = (0.048, 0.051, 0.037, 1.0)    # hollows: between ribs, armpit, groin
FLESH_PALE = (0.352, 0.352, 0.270, 1.0)    # bone pressing through: knees, elbows, ribs
# The neck used to be painted FLESH_DARK, which the v1 build rendered as a black void
# between jaw and collar -- mostly the encoding bug in bake_vertex_colours, but even
# corrected, 0.176 against a 0.352 torso is a hole rather than a shadow. Sinew in
# shadow: clearly darker than the torso, with room left for the AO under the jaw.
NECK = (0.093, 0.098, 0.072, 1.0)      # byte 86,88,76
AMBER = (0.95, 0.26, 0.03, 1.0)


def log(msg):
    print(f'[undead] {msg}', flush=True)


# ------------------------------------------------------------------ scene util
def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def object_mode():
    if bpy.context.object and bpy.context.object.mode != 'OBJECT':
        bpy.ops.object.mode_set(mode='OBJECT')


def select_only(ob):
    object_mode()
    bpy.ops.object.select_all(action='DESELECT')
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob


def apply_visual(ob):
    select_only(ob)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)


def tris_of(ob):
    return sum(len(p.vertices) - 2 for p in ob.data.polygons)


def world_bbox(objects):
    pts = []
    for ob in objects:
        mw = ob.matrix_world
        pts += [mw @ Vector(c) for c in ob.bound_box]
    if not pts:
        return None
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    return lo, hi


# --------------------------------------------------------------- the armature
def import_source_armature():
    """65 mixamorig bones at metre scale, rest pose, no mesh, no animation."""
    log(f'import source armature {HUMAN_SRC.name}')
    bpy.ops.import_scene.gltf(filepath=str(HUMAN_SRC))
    arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
    arm.name = 'UndeadArmature'
    if arm.animation_data:
        arm.animation_data_clear()
    arm.data.pose_position = 'REST'
    for p in arm.pose.bones:
        p.matrix_basis = Matrix.Identity(4)
    bpy.context.view_layer.update()
    select_only(arm)
    if arm.parent:
        bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    # Mixamo centimetre bones live under a 0.01 object scale; Apply Scale leaves
    # 32 m tails, so push the scale onto the edit bones by hand (Orc precedent).
    sx, sy, sz = arm.scale
    if abs(sx - 1.0) > 1e-6:
        bpy.ops.object.mode_set(mode='EDIT')
        for b in arm.data.edit_bones:
            b.head = Vector((b.head.x * sx, b.head.y * sy, b.head.z * sz))
            b.tail = Vector((b.tail.x * sx, b.tail.y * sy, b.tail.z * sz))
        for b in arm.data.edit_bones:
            if b.children:
                b.tail = b.children[0].head.copy()
            elif b.length < 1e-4 or b.length > 2.0:
                axis = (b.tail - b.head).normalized() if b.length > 1e-8 else Vector((0, 0, 1))
                b.tail = b.head + axis * 0.04
        bpy.ops.object.mode_set(mode='OBJECT')
        arm.scale = (1.0, 1.0, 1.0)
    bpy.context.view_layer.update()
    for ob in [o for o in bpy.data.objects if o.type != 'ARMATURE']:
        bpy.data.objects.remove(ob, do_unlink=True)
    mixa = [b.name for b in arm.data.bones if b.name.startswith('mixamorig:')]
    if len(mixa) != 65:
        raise RuntimeError(f'expected 65 mixamorig bones, have {len(mixa)}')
    log(f'  armature ok, {len(mixa)} mixamorig bones')
    return arm


def joint_world(arm):
    return {b.name: (arm.matrix_world @ b.head_local).copy() for b in arm.data.bones}


def retarget_skeleton(arm):
    """Human bind -> tall gaunt revenant. Edits world-space joint centres, then
    rewrites every edit bone from them, so subtrees travel with their parent."""
    select_only(arm)
    bpy.ops.object.mode_set(mode='EDIT')
    ebs = arm.data.edit_bones

    def subtree(name):
        out = []
        stack = [ebs[name]]
        while stack:
            b = stack.pop()
            out.append(b)
            stack.extend(b.children)
        return out

    def shift(name, delta):
        for b in subtree(name):
            b.head = b.head + delta
            b.tail = b.tail + delta

    scale = TARGET_HEIGHT / HUMAN_HEIGHT
    for b in ebs:
        b.head = b.head * scale
        b.tail = b.tail * scale
    log(f'  uniform scale {scale:.4f} -> nominal height {TARGET_HEIGHT:.3f} m')

    # Narrow the shoulder girdle, then rebuild the arm chain to explicit lengths.
    for sign, side in ((1.0, 'Left'), (-1.0, 'Right')):
        arm_b = ebs[f'mixamorig:{side}Arm']
        shift(f'mixamorig:{side}Arm', Vector((sign * SHOULDER_HALF - arm_b.head.x, 0, 0)))
        fore = ebs[f'mixamorig:{side}ForeArm']
        want = Vector((sign * UPPER_ARM, 0, 0)) + ebs[f'mixamorig:{side}Arm'].head
        shift(f'mixamorig:{side}ForeArm', want - fore.head)
        hand = ebs[f'mixamorig:{side}Hand']
        want = Vector((sign * FOREARM, 0, 0)) + ebs[f'mixamorig:{side}ForeArm'].head
        shift(f'mixamorig:{side}Hand', want - hand.head)
        # Long bony hands: grow the finger chains about the wrist.
        pivot = ebs[f'mixamorig:{side}Hand'].head.copy()
        for b in subtree(f'mixamorig:{side}Hand'):
            if b.name == f'mixamorig:{side}Hand':
                continue
            b.head = pivot + (b.head - pivot) * FINGER_SCALE
            b.tail = pivot + (b.tail - pivot) * FINGER_SCALE
        # Shoulder joint follows the girdle inward a little so the yoke is narrow.
        sh = ebs[f'mixamorig:{side}Shoulder']
        sh.head = Vector((sign * 0.026, sh.head.y, sh.head.z))

    # Narrow hips.
    for sign, side in ((1.0, 'Left'), (-1.0, 'Right')):
        up = ebs[f'mixamorig:{side}UpLeg']
        shift(f'mixamorig:{side}UpLeg', Vector((sign * HIP_HALF - up.head.x, 0, 0)))

    # Gaunt neck: lift the head chain.
    shift('mixamorig:Head', Vector((0, 0, NECK_EXTRA)))

    # Re-aim tails so every bone points at its child (Mixamo convention).
    for b in ebs:
        if b.children:
            b.tail = b.children[0].head.copy()
        elif b.length < 1e-4:
            b.tail = b.head + Vector((0, 0, 0.04))
    bpy.ops.object.mode_set(mode='OBJECT')
    bpy.context.view_layer.update()

    j = joint_world(arm)
    log(f'  hips  z={j["mixamorig:Hips"].z:.3f}   neck z={j["mixamorig:Neck"].z:.3f}')
    log(f'  head  z={j["mixamorig:Head"].z:.3f}   crown z={j["mixamorig:HeadTop_End"].z:.3f}')
    log(f'  shoulder |x|={abs(j["mixamorig:LeftArm"].x):.3f}  wrist |x|={abs(j["mixamorig:LeftHand"].x):.3f}')
    span = abs(j['mixamorig:LeftHandMiddle4'].x) * 2
    log(f'  fingertip span={span:.3f} m')
    return j


# ------------------------------------------------------------ mesh generation
class Builder:
    """Accumulates lofted shells into one bmesh, tagging every vertex with the
    region it came from. Regions drive both the palette and which bones a vertex
    is allowed to be weighted to."""

    def __init__(self, registry=None):
        self.bm = bmesh.new()
        self.region_layer = self.bm.verts.layers.int.new('region')
        if registry is None:
            registry = ([], {})
        self.regions, self.region_id = registry

    def rid(self, name):
        if name not in self.region_id:
            self.region_id[name] = len(self.regions)
            self.regions.append(name)
        return self.region_id[name]

    def add_ring(self, center, ex, ey, rx, ry, segs, power, region):
        rid = self.rid(region)
        verts = []
        for i in range(segs):
            t = 2 * math.pi * i / segs
            c, s = math.cos(t), math.sin(t)
            p = 2.0 / power
            px = math.copysign(abs(c) ** p, c) * rx
            py = math.copysign(abs(s) ** p, s) * ry
            v = self.bm.verts.new(center + ex * px + ey * py)
            v[self.region_layer] = rid
            verts.append(v)
        return verts

    def add_point(self, co, region):
        v = self.bm.verts.new(co)
        v[self.region_layer] = self.rid(region)
        return v

    def bridge(self, a, b, flip=False):
        n = len(a)
        for i in range(n):
            j = (i + 1) % n
            quad = [a[i], a[j], b[j], b[i]]
            if flip:
                quad.reverse()
            try:
                self.bm.faces.new(quad)
            except ValueError:
                pass

    def fan(self, ring, apex, flip=False):
        n = len(ring)
        for i in range(n):
            j = (i + 1) % n
            tri = [ring[i], ring[j], apex]
            if flip:
                tri.reverse()
            try:
                self.bm.faces.new(tri)
            except ValueError:
                pass

    def tube(self, path, radii, region, segs=LIMB_SEGS, power=LIMB_POWER,
             up_hint=Vector((0, 0, 1)), cap_start=True, cap_end=True, cap_scale=0.62,
             over_start=0.0, over_end=0.0):
        """path: list of Vector centres. radii: list of (rx, ry) per centre.

        over_start / over_end push the ends further along their own axis so the
        shell buries itself inside its neighbour. Every tube has to be a closed
        volume: the voxel union is a mesh-to-volume pass, and an open cylinder
        converts to a sliver or to nothing. An earlier build left the limbs
        uncapped and the remesh deleted both legs.
        """
        assert len(path) == len(radii) >= 2
        path, radii = list(path), list(radii)
        if over_start > 0:
            d = (path[0] - path[1]).normalized()
            path.insert(0, path[0] + d * over_start)
            radii.insert(0, radii[0])
        if over_end > 0:
            d = (path[-1] - path[-2]).normalized()
            path.append(path[-1] + d * over_end)
            radii.append(radii[-1])
        rings = []
        frames = []
        for i, c in enumerate(path):
            if i == 0:
                d = (path[1] - path[0])
            elif i == len(path) - 1:
                d = (path[-1] - path[-2])
            else:
                d = (path[i + 1] - path[i - 1])
            d = d.normalized() if d.length > 1e-9 else Vector((0, 0, 1))
            ref = up_hint if abs(d.dot(up_hint)) < 0.94 else Vector((0, 1, 0))
            ex = d.cross(ref).normalized()
            ey = ex.cross(d).normalized()
            frames.append((d, ex, ey))
            rx, ry = radii[i]
            rings.append(self.add_ring(c, ex, ey, rx, ry, segs, power, region))
        for i in range(len(rings) - 1):
            self.bridge(rings[i], rings[i + 1])
        if cap_start:
            d, ex, ey = frames[0]
            rx, ry = radii[0]
            mid = self.add_ring(path[0] - d * min(rx, ry) * 0.5, ex, ey,
                                rx * cap_scale, ry * cap_scale, segs, power, region)
            self.bridge(mid, rings[0])
            self.fan(mid, self.add_point(path[0] - d * min(rx, ry) * 0.92, region), flip=True)
        if cap_end:
            d, ex, ey = frames[-1]
            rx, ry = radii[-1]
            mid = self.add_ring(path[-1] + d * min(rx, ry) * 0.5, ex, ey,
                                rx * cap_scale, ry * cap_scale, segs, power, region)
            self.bridge(rings[-1], mid)
            self.fan(mid, self.add_point(path[-1] + d * min(rx, ry) * 0.92, region))
        return rings

    def to_object(self, name):
        bm = self.bm
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
        me = bpy.data.meshes.new(name)
        bm.to_mesh(me)
        bm.free()
        ob = bpy.data.objects.new(name, me)
        bpy.context.collection.objects.link(ob)
        return ob


def lerp_radii(table, t):
    """table: [(t, rx, ry), ...] sorted by t."""
    if t <= table[0][0]:
        return table[0][1], table[0][2]
    if t >= table[-1][0]:
        return table[-1][1], table[-1][2]
    for i in range(len(table) - 1):
        t0, x0, y0 = table[i]
        t1, x1, y1 = table[i + 1]
        if t0 <= t <= t1:
            f = (t - t0) / max(1e-9, t1 - t0)
            return x0 + (x1 - x0) * f, y0 + (y1 - y0) * f
    return table[-1][1], table[-1][2]


def resample(a, b, n):
    return [a + (b - a) * (i / (n - 1)) for i in range(n)]


def build_body(j):
    """Lofted shells along the retargeted bone graph.

    Two objects come back sharing one region registry. The torso and limbs get
    voxel-unioned and collapsed, which erases the silhouette step where one tube
    abuts the next. The hands do not: remesh-then-collapse turns 11 mm fingers to
    mush, and the hands are half of what the concept is asking for.

    Every shell here is closed and overlaps its neighbour, because the union is a
    mesh-to-volume pass and open tubes vanish in it.
    """
    registry = ([], {})
    B = Builder(registry)
    H = Builder(registry)

    # ---- torso: pelvis to neck root, gaunt waist, slight spinal lean
    hips = j['mixamorig:Hips']
    neck = j['mixamorig:Neck']
    span = neck.z - hips.z
    path, radii = [], []
    for frac, rx, ry, dy in TORSO_RINGS:
        z = hips.z + span * frac
        y = hips.y + (neck.y - hips.y) * max(0.0, frac) + dy
        path.append(Vector((0.0, y, z)))
        radii.append((rx, ry))
    B.tube(path, radii, 'torso', segs=TORSO_SEGS, power=TORSO_POWER,
           up_hint=Vector((0, 1, 0)), cap_scale=0.55)

    # ---- neck: buried in the torso below and inside the cranium above
    head = j['mixamorig:Head']
    nk = resample(neck, head, 5)
    B.tube(nk, [NECK_R] * len(nk), 'neck', segs=16, power=2.1,
           up_hint=Vector((0, 1, 0)), over_start=0.045, over_end=0.055, cap_scale=0.7)

    for sign, side in ((1.0, 'Left'), (-1.0, 'Right')):
        lo = side.lower()
        sh = j[f'mixamorig:{side}Shoulder']
        up = j[f'mixamorig:{side}Arm']
        fore = j[f'mixamorig:{side}ForeArm']
        wrist = j[f'mixamorig:{side}Hand']

        # ---- shoulder yoke: clavicle out to the deltoid
        yoke = resample(sh, up, 4)
        B.tube(yoke, [(0.066, 0.056), (0.064, 0.055), (0.061, 0.055), (0.058, 0.055)],
               f'arm{lo}', over_start=0.035, over_end=0.040)

        # ---- upper arm and forearm
        ua = resample(up, fore, 6)
        B.tube(ua, [lerp_radii(ARM_RADII, i / 5) for i in range(6)], f'arm{lo}',
               over_start=0.040, over_end=0.032)

        # The palm carries the round-to-flat wrist transition, so the forearm can
        # taper below the palm's proximal thickness and bury its cap inside it.
        palm_dir_pre = (j[f'mixamorig:{side}HandMiddle1'] - wrist).normalized()
        wrist_root = wrist - palm_dir_pre * 0.048
        fa = resample(fore, wrist_root, 6)
        B.tube(fa, [lerp_radii(FOREARM_RADII, i / 5) for i in range(6)], f'arm{lo}',
               over_start=0.032, over_end=0.026)

        # ---- palm: round at the wrist, flat by the knuckles
        knuckles = [j[f'mixamorig:{side}Hand{f}1'] for f in ('Index', 'Middle', 'Ring', 'Pinky')]
        knuckle_mid = sum(knuckles, Vector()) / len(knuckles)
        palm_dir = (knuckle_mid - wrist_root).normalized()
        across = (j[f'mixamorig:{side}HandIndex1'] - j[f'mixamorig:{side}HandPinky1']).normalized()
        palm_n = palm_dir.cross(across).normalized()
        half_w = (j[f'mixamorig:{side}HandIndex1'] - j[f'mixamorig:{side}HandPinky1']).length * 0.62
        shape = [(0.00, 0.030, 0.028, 2.15),
                 (0.28, 0.035, 0.024, 2.35),
                 (0.60, half_w * 0.88, 0.019, 2.65),
                 (1.00, half_w * 1.06, 0.0145, 2.95)]
        palm_path = resample(wrist_root, knuckle_mid + palm_dir * 0.006, 4)
        palm_rings = []
        for i, c in enumerate(palm_path):
            _, w, th, pw = shape[i]
            palm_rings.append(H.add_ring(c, across, palm_n, w, th, 16, pw, f'hand{lo}'))
        for i in range(len(palm_rings) - 1):
            H.bridge(palm_rings[i], palm_rings[i + 1])
        H.fan(palm_rings[0], H.add_point(palm_path[0] - palm_dir * 0.016, f'hand{lo}'), flip=True)
        H.fan(palm_rings[-1], H.add_point(palm_path[-1] + palm_dir * 0.008, f'hand{lo}'))

        # ---- fingers: bony, knuckle-swollen, tapering to a point
        for fname in ('Thumb', 'Index', 'Middle', 'Ring', 'Pinky'):
            chain = [j[f'mixamorig:{side}Hand{fname}{k}'] for k in (1, 2, 3, 4)]
            pts, rads = [], []
            scale = 0.86 if fname == 'Thumb' else 1.0
            if fname == 'Pinky':
                scale = 0.84
            for seg in range(3):
                a, b = chain[seg], chain[seg + 1]
                steps = 3 if seg < 2 else 4
                for k in range(steps):
                    f = k / steps
                    pts.append(a + (b - a) * f)
                    g = (seg + f) / 3.0
                    r = (FINGER_R_BASE + (FINGER_R_TIP - FINGER_R_BASE) * g) * scale
                    r *= 1.0 + 0.26 * math.exp(-(f ** 2) / 0.012)
                    rads.append((r, r * 0.92))
            pts.append(chain[3])
            rads.append((FINGER_R_TIP * scale * 0.7,) * 2)
            H.tube(pts, rads, f'finger{lo}{fname}', segs=FINGER_SEGS, power=2.6,
                   over_start=0.018, cap_scale=0.5)

        # ---- legs
        hip = j[f'mixamorig:{side}UpLeg']
        knee = j[f'mixamorig:{side}Leg']
        ankle = j[f'mixamorig:{side}Foot']
        th = resample(hip, knee, 6)
        B.tube(th, [lerp_radii(THIGH_RADII, i / 5) for i in range(6)], f'leg{lo}',
               over_start=0.060, over_end=0.036)
        shin = resample(knee, ankle, 6)
        B.tube(shin, [lerp_radii(SHIN_RADII, i / 5) for i in range(6)], f'leg{lo}',
               over_start=0.036, over_end=0.030)

        # ---- foot. One continuous sole from heel to toe tip, plus a short column
        # dropping the shin into it. The sole was already flat on z=0 in rest, and the
        # sweep confirms the Undead's lowest vertex sits *closer* to the floor than the
        # Orc's across the whole of Idle_Loop (1.4-1.8 cm vs 2.3-2.9 cm), so the
        # feet-not-touching read is not root height -- it is silhouette. The first
        # attempt bolted a longer heel tube onto the back of the ankle, which just
        # turned the foot into a T with a notch in it (ve-capture/m11a/fix2). Lofting
        # heel and sole as a single tube puts mass behind the ankle without the seam.
        toe = j[f'mixamorig:{side}ToeBase']
        tip = j[f'mixamorig:{side}Toe_End']
        B.tube([Vector((ankle.x, ankle.y, ankle.z)), Vector((ankle.x, ankle.y, 0.040))],
               [(0.032, 0.034), (0.034, 0.036)], f'foot{lo}', segs=14, power=2.8,
               over_start=0.040, over_end=0.010, cap_scale=0.6)
        f_path = [Vector((ankle.x, ankle.y + 0.072, 0.034)),
                  Vector((ankle.x, ankle.y + 0.022, 0.032)),
                  Vector((ankle.x, (ankle.y + toe.y) * 0.5, 0.030)),
                  Vector((toe.x, toe.y, 0.024)),
                  Vector((tip.x, tip.y, 0.016))]
        f_rad = [(0.031, 0.034), (0.036, 0.032), (0.038, 0.030), (0.042, 0.026),
                 (0.030, 0.016)]
        B.tube(f_path, f_rad, f'foot{lo}', segs=14, power=2.8,
               over_start=0.006, over_end=0.006, cap_scale=0.55)

    main = B.to_object('UndeadV1Main')
    hands = H.to_object('UndeadV1Hands')
    regions = registry[0]
    main['regions'] = regions
    log(f'  torso/limb shells: verts={len(main.data.vertices)} tris={tris_of(main)}')
    log(f'  hand shells:       verts={len(hands.data.vertices)} tris={tris_of(hands)}')
    log(f'  regions={len(regions)}')
    return main, hands, regions


def import_skull(j):
    """CC0 skull -> character frame (up +Z, front -Y), scaled and seated on Head."""
    if not SKULL_OBJ.exists():
        raise FileNotFoundError(
            f'{SKULL_OBJ} missing. See blender/characters/sources/undead-skull/README.md')
    before = set(bpy.data.objects)
    try:
        bpy.ops.wm.obj_import(filepath=str(SKULL_OBJ))
    except AttributeError:
        bpy.ops.import_scene.obj(filepath=str(SKULL_OBJ))
    new = [o for o in bpy.data.objects if o not in before and o.type == 'MESH']
    skull = new[0] if len(new) == 1 else None
    if skull is None:
        select_only(new[0])
        for o in new[1:]:
            o.select_set(True)
        bpy.ops.object.join()
        skull = bpy.context.view_layer.objects.active
    skull.name = 'UndeadSkullHP'
    skull.data.name = 'UndeadSkullHP'
    # Frame, settled by a six-axis turntable of the raw OBJ: once the importer's
    # own Y-up to Z-up conversion is applied, the bbox is x 1.921 (width),
    # y 2.547 (front to back), z 2.852 (vertex to gnathion), and the +X profile
    # renders an upright head facing image-left. So the scan lands already at
    # up = +Z, front = -Y, which is this project's frame, and needs no rotation.
    #
    # That conversion lives on the object as rotation_euler, not in the mesh data.
    # Two earlier passes zeroed rotation_euler here, which silently undid it and
    # left the skull lying on its back -- both rendered the occiput where the face
    # belongs. Bake the import transform, do not overwrite it.
    apply_visual(skull)
    lo, hi = world_bbox([skull])
    s = SKULL_HEIGHT / (hi.z - lo.z)
    skull.scale = (s, s, s)
    apply_visual(skull)
    lo, hi = world_bbox([skull])
    crown = j['mixamorig:HeadTop_End'].z
    dx = -(lo.x + hi.x) * 0.5
    dz = crown - hi.z - SKULL_DROP
    # Seat the skull so the auditory meatus region sits over the Head joint.
    dy = j['mixamorig:Head'].y - (lo.y + hi.y) * 0.5 - SKULL_FORWARD
    skull.location = (dx, dy, dz)
    apply_visual(skull)
    lo, hi = world_bbox([skull])
    log(f'  skull scale={s:.5f} bbox z {lo.z:.3f}..{hi.z:.3f} (crown target {crown:.3f})')
    log(f'  skull size {tuple(round(v, 4) for v in (hi - lo))}')
    return skull


def unify(ob, voxel=REMESH_VOXEL, target_tris=REMESH_TRIS):
    """Voxel-union the overlapping tubes into one closed skin, then collapse to
    budget. Without this every tube boundary shows as a silhouette step."""
    before = tris_of(ob)
    select_only(ob)
    m = ob.modifiers.new('Remesh', 'REMESH')
    m.mode = 'VOXEL'
    m.voxel_size = voxel
    m.use_smooth_shade = True
    bpy.ops.object.modifier_apply(modifier=m.name)
    dense = tris_of(ob)
    if dense > target_tris:
        d = ob.modifiers.new('Decimate', 'DECIMATE')
        d.decimate_type = 'COLLAPSE'
        d.ratio = target_tris / dense
        bpy.ops.object.modifier_apply(modifier=d.name)
    log(f'  unify {ob.name}: {before} -> voxel {dense} -> collapse {tris_of(ob)} tris')
    return ob


def transfer_regions(dst, src):
    """Remesh drops attributes. Re-tag every new vertex from the nearest vertex of
    the authored shells, so painting and weight restriction still key off region."""
    from mathutils import kdtree
    sm = src.data
    kd = kdtree.KDTree(len(sm.vertices))
    smw = src.matrix_world
    for i, v in enumerate(sm.vertices):
        kd.insert(smw @ v.co, i)
    kd.balance()
    src_attr = sm.attributes['region']
    if 'region' in dst.data.attributes:
        dst.data.attributes.remove(dst.data.attributes['region'])
    out = dst.data.attributes.new('region', 'INT', 'POINT')
    dmw = dst.matrix_world
    for i, v in enumerate(dst.data.vertices):
        _, idx, _ = kd.find(dmw @ v.co)
        out.data[i].value = src_attr.data[idx].value
    log(f'  region tags transferred onto {len(dst.data.vertices)} vertices')


def label_skull(ob, registry):
    """Tag cranium / mandible / teeth by connected component, in the same region
    numbering the body uses, so joining merges the attribute cleanly."""
    regions, region_id = registry
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bm.verts.ensure_lookup_table()
    seen, comps = set(), []
    for v in bm.verts:
        if v.index in seen:
            continue
        stack, comp = [v], []
        seen.add(v.index)
        while stack:
            c = stack.pop()
            comp.append(c.index)
            for e in c.link_edges:
                o = e.other_vert(c)
                if o.index not in seen:
                    seen.add(o.index)
                    stack.append(o)
        comps.append(comp)
    bm.free()
    comps.sort(key=len, reverse=True)
    if 'region' in ob.data.attributes:
        ob.data.attributes.remove(ob.data.attributes['region'])
    attr = ob.data.attributes.new('region', 'INT', 'POINT')
    for k, comp in enumerate(comps):
        name = 'cranium' if k == 0 else ('mandible' if k == 1 else 'teeth')
        if name not in region_id:
            region_id[name] = len(regions)
            regions.append(name)
        rid = region_id[name]
        for i in comp:
            attr.data[i].value = rid
    log(f'  skull components={len(comps)} sizes={[len(c) for c in comps[:4]]}')
    return comps


def skull_shells(ob):
    """Split the skull into cranium / mandible / teeth by connected component."""
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bm.verts.ensure_lookup_table()
    seen = set()
    comps = []
    for v in bm.verts:
        if v.index in seen:
            continue
        stack = [v]
        seen.add(v.index)
        comp = []
        while stack:
            c = stack.pop()
            comp.append(c.index)
            for e in c.link_edges:
                o = e.other_vert(c)
                if o.index not in seen:
                    seen.add(o.index)
                    stack.append(o)
        comps.append(comp)
    bm.free()
    comps.sort(key=len, reverse=True)
    label = {}
    for k, comp in enumerate(comps):
        name = 'cranium' if k == 0 else ('mandible' if k == 1 else 'teeth')
        for i in comp:
            label[i] = name
    log(f'  skull components={len(comps)} sizes={[len(c) for c in comps[:4]]}')
    return label


# --------------------------------------------------------------------- colour
SKULL_REGIONS = ('cranium', 'mandible', 'teeth')


def paint(ob, j=None):
    """Author vertex colours. The albedo bake reads this layer."""
    me = ob.data
    if not me.color_attributes:
        me.color_attributes.new(name='Col', type='FLOAT_COLOR', domain='POINT')
    col = me.color_attributes['Col']
    region_attr = me.attributes.get('region')
    regions = list(ob.get('regions') or [])
    mw = ob.matrix_world
    lo, hi = world_bbox([ob])
    height = hi.z - lo.z

    # Cavity term. The cranium reads as a smooth egg because it is painted one flat
    # value and there is genuinely nothing there to bake: AO on a convex dome returns
    # 1 everywhere, and the normal map was a no-op (see bake_ao). Curvature is the
    # one signal that does distinguish the temporal fossa, the orbit rims, the space
    # under the zygomatic arches and the tooth gaps, because those are concave while
    # the dome is not. Positive means the neighbours sit above the vertex's tangent
    # plane, i.e. the vertex is in a hollow.
    nbrs = [[] for _ in range(len(me.vertices))]
    for e in me.edges:
        a, b = e.vertices
        nbrs[a].append(b)
        nbrs[b].append(a)
    cavity = [0.0] * len(me.vertices)
    for i, v in enumerate(me.vertices):
        n = v.normal
        acc = 0.0
        for k in nbrs[i]:
            d = me.vertices[k].co - v.co
            length = d.length
            if length > 1e-9:
                acc += d.dot(n) / length
        if nbrs[i]:
            cavity[i] = acc / len(nbrs[i])

    for i, v in enumerate(me.vertices):
        p = mw @ v.co
        name = ''
        if region_attr and i < len(region_attr.data):
            rid = region_attr.data[i].value
            if 0 <= rid < len(regions):
                name = regions[rid]
        if name in SKULL_REGIONS:
            kind = name
            base = TOOTH if kind == 'teeth' else BONE
            # Sink the orbits, the nasal aperture and the space under the arches.
            c = base
            if kind != 'teeth' and j is not None:
                head = j['mixamorig:Head']
                # local frame relative to the head
                dz = p.z - head.z
                dy = p.y - head.y
                depth = 0.0
                # orbits: paired hollows, upper face, forward
                eye_z = dz - 0.085
                for sx in (1, -1):
                    ex = p.x - sx * 0.030
                    d = math.sqrt(ex * ex + eye_z * eye_z * 1.4)
                    if dy < -0.010:
                        depth = max(depth, math.exp(-(d / 0.024) ** 2))
                # nasal aperture: centred, just below the orbits
                nz = dz - 0.055
                dn = math.sqrt((p.x / 0.6) ** 2 + (nz / 1.5) ** 2)
                if dy < -0.020:
                    depth = max(depth, 0.92 * math.exp(-(dn / 0.020) ** 2))
                if depth > 0:
                    c = tuple(base[k] + (BONE_DEEP[k] - base[k]) * min(1.0, depth) for k in range(4))
            cav = min(1.0, max(0.0, cavity[i] * CAVITY_GAIN))
            if cav > 0:
                c = tuple(c[k] + (BONE_DEEP[k] - c[k]) * (0.75 * cav) for k in range(4))
            col.data[i].color = c
            continue

        c = FLESH
        if name.startswith('finger') or name.startswith('hand'):
            c = FLESH_PALE
        elif name.startswith('foot'):
            c = FLESH
        elif name == 'neck':
            c = NECK
        if name == 'torso':
            t = (p.z - lo.z) / max(1e-6, height)
            # Rib shadows: horizontal banding across the chest, full strength facing
            # forward and fading out by the time the surface faces backward. Without the
            # normal gate the bands wrapped right around and read as garbled chevrons
            # across the upper back, where there are no ribs to shadow. The frequency is
            # also down from 62 rad/m: at ~2 cm vertex spacing that was under three
            # samples per period, so the interpolation aliased into zigzags.
            if 0.64 < t < 0.82:
                ny = (mw.to_3x3() @ v.normal).normalized().y
                fade = min(1.0, max(0.0, (0.30 - ny) / 0.80))
                band = 0.5 + 0.5 * math.cos(p.z * 46.0)
                c = tuple(FLESH[k] + (FLESH_DARK[k] - FLESH[k]) * (0.45 * band * fade)
                          for k in range(4))
            elif t < 0.36:
                c = tuple(FLESH[k] + (FLESH_DARK[k] - FLESH[k]) * 0.35 for k in range(4))
        # knees and elbows: bone pressing through
        if j is not None and (name.startswith('leg') or name.startswith('arm')):
            for jn in ('LeftLeg', 'RightLeg', 'LeftForeArm', 'RightForeArm'):
                d = (p - j[f'mixamorig:{jn}']).length
                if d < 0.055:
                    f = 1.0 - d / 0.055
                    c = tuple(c[k] + (FLESH_PALE[k] - c[k]) * f for k in range(4))
        cav = min(1.0, max(0.0, cavity[i] * CAVITY_GAIN))
        if cav > 0:
            c = tuple(c[k] + (FLESH_DARK[k] - c[k]) * (0.45 * cav) for k in range(4))
        col.data[i].color = c
    log('  vertex colours authored')


# ---------------------------------------------------------------- UV and bake
def smart_uv(ob):
    select_only(ob)
    if not ob.data.uv_layers:
        ob.data.uv_layers.new(name='UVMap')
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=1.0472, island_margin=0.006)
    bpy.ops.object.mode_set(mode='OBJECT')


def shade_smooth(ob):
    select_only(ob)
    bpy.ops.object.shade_smooth()
    try:
        bpy.ops.object.modifier_add(type='WEIGHTED_NORMAL')
        bpy.ops.object.modifier_apply(modifier=ob.modifiers[-1].name)
    except Exception as err:
        log(f'  weighted normal skipped: {err}')


def make_material(name, color, roughness=0.86, vertex_color=None, emission=None, strength=0.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    bsdf.inputs['Base Color'].default_value = color
    bsdf.inputs['Roughness'].default_value = roughness
    bsdf.inputs['Metallic'].default_value = 0.0
    if emission is not None:
        for key in ('Emission Color', 'Emission'):
            if key in bsdf.inputs:
                bsdf.inputs[key].default_value = emission
                break
        if 'Emission Strength' in bsdf.inputs:
            bsdf.inputs['Emission Strength'].default_value = strength
    if vertex_color:
        node = nt.nodes.new('ShaderNodeVertexColor')
        node.layer_name = vertex_color
        nt.links.new(node.outputs['Color'], bsdf.inputs['Base Color'])
    return mat


def ensure_cycles():
    scn = bpy.context.scene
    try:
        scn.render.engine = 'CYCLES'
    except TypeError as err:
        log(f'  cycles unavailable: {err}')
        return False
    scn.cycles.samples = 24
    scn.cycles.use_denoising = False
    try:
        scn.cycles.device = 'CPU'
    except Exception:
        pass
    return True


def bake_ao(low, size):
    """Ambient occlusion of the finished body, from the body alone.

    This deliberately does NOT use selected-to-active. The previous version baked
    NORMAL and AO against a cage that was a *copy of these very surfaces* sitting in
    the same place, so every AO ray left the low-poly and immediately struck its own
    duplicate: the map read fully occluded everywhere. Measured in the shipped v1
    atlas, whose dominant colour is 0.102 linear against an authored FLESH of 0.352 --
    flat at the f = 1 - 0.55(1 - occ) floor. That is what made the whole body a uniform
    dark olive and the neck a void. The normal bake was a no-op for the same reason
    (high and low were the same surface, so it exported a uniform 128,128,255 image);
    it is dropped rather than faked, since the skull scan's detail is already in the
    low-poly and there is no higher-resolution source to bake from.
    """
    if not ensure_cycles():
        return None
    ao = bpy.data.images.new('UndeadV1BodyAO', size, size, alpha=False)
    ao.generated_color = (1, 1, 1, 1)
    ao.colorspace_settings.name = 'Non-Color'
    scn = bpy.context.scene
    if scn.world is None:
        scn.world = bpy.data.worlds.new('UndeadBakeWorld')
    try:
        scn.world.light_settings.distance = AO_DISTANCE
    except Exception as err:
        log(f'  AO distance not settable: {err}')
    scn.cycles.samples = 64
    scn.cycles.use_denoising = True
    scn.render.bake.use_selected_to_active = False
    scn.render.bake.use_clear = True
    for mat in low.data.materials:
        nt = mat.node_tree
        node = nt.nodes.new('ShaderNodeTexImage')
        node.image = ao
        node.select = True
        nt.nodes.active = node
    bpy.ops.object.select_all(action='DESELECT')
    low.select_set(True)
    bpy.context.view_layer.objects.active = low
    result = None
    try:
        bpy.ops.object.bake(type='AO', use_selected_to_active=False)
        result = ao
        log('  baked AO (self-occlusion)')
    except Exception as err:
        log(f'  bake AO failed: {err}')
    for mat in low.data.materials:
        nt = mat.node_tree
        for n in [x for x in nt.nodes if x.type == 'TEX_IMAGE' and x.image == ao]:
            nt.nodes.remove(n)
    if result is not None:
        # An AO map that reads the same value everywhere is not measuring occlusion;
        # print the spread so a future build cannot silently go flat again.
        vals = list(result.pixels)[0::4]
        log('  AO min=%.3f mean=%.3f max=%.3f' % (min(vals), sum(vals) / len(vals), max(vals)))
    return result


def bake_vertex_colours(ob, size, ao_img=None):
    """Rasterise the vertex-colour layer through the UVs into an albedo image,
    then multiply AO in. Far cheaper and steadier than a Cycles diffuse bake."""
    me = ob.data
    col = me.color_attributes.get('Col')
    uv = me.uv_layers.active
    img = bpy.data.images.new('UndeadV1BodyAlbedo', size, size, alpha=False)
    px = [0.0] * (size * size * 4)
    filled = [False] * (size * size)

    def vert_col(idx):
        c = col.data[idx].color
        return (c[0], c[1], c[2])

    def put(x, y, rgb):
        if 0 <= x < size and 0 <= y < size:
            i = (y * size + x)
            px[i * 4 + 0] = rgb[0]
            px[i * 4 + 1] = rgb[1]
            px[i * 4 + 2] = rgb[2]
            px[i * 4 + 3] = 1.0
            filled[i] = True

    for poly in me.polygons:
        loops = list(poly.loop_indices)
        for k in range(1, len(loops) - 1):
            tri = (loops[0], loops[k], loops[k + 1])
            uvs = [uv.data[li].uv for li in tri]
            cols = [vert_col(me.loops[li].vertex_index) for li in tri]
            xs = [u.x * size for u in uvs]
            ys = [u.y * size for u in uvs]
            minx, maxx = int(math.floor(min(xs))) - 1, int(math.ceil(max(xs))) + 1
            miny, maxy = int(math.floor(min(ys))) - 1, int(math.ceil(max(ys))) + 1
            d = ((ys[1] - ys[2]) * (xs[0] - xs[2]) + (xs[2] - xs[1]) * (ys[0] - ys[2]))
            if abs(d) < 1e-12:
                continue
            for y in range(max(0, miny), min(size, maxy + 1)):
                for x in range(max(0, minx), min(size, maxx + 1)):
                    cx, cy = x + 0.5, y + 0.5
                    a = ((ys[1] - ys[2]) * (cx - xs[2]) + (xs[2] - xs[1]) * (cy - ys[2])) / d
                    b = ((ys[2] - ys[0]) * (cx - xs[2]) + (xs[0] - xs[2]) * (cy - ys[2])) / d
                    g = 1.0 - a - b
                    if a < -0.06 or b < -0.06 or g < -0.06:
                        continue
                    a, b, g = max(a, 0.0), max(b, 0.0), max(g, 0.0)
                    s = a + b + g
                    a, b, g = a / s, b / s, g / s
                    put(x, y, tuple(a * cols[0][i] + b * cols[1][i] + g * cols[2][i]
                                    for i in range(3)))
    # dilate so island edges do not bleed background
    for _ in range(4):
        snapshot = list(filled)
        for y in range(size):
            for x in range(size):
                i = y * size + x
                if snapshot[i]:
                    continue
                acc = [0.0, 0.0, 0.0]
                n = 0
                for dy in (-1, 0, 1):
                    for dx in (-1, 0, 1):
                        nx, ny = x + dx, y + dy
                        if 0 <= nx < size and 0 <= ny < size and snapshot[ny * size + nx]:
                            k = (ny * size + nx) * 4
                            acc[0] += px[k]
                            acc[1] += px[k + 1]
                            acc[2] += px[k + 2]
                            n += 1
                if n:
                    put(x, y, (acc[0] / n, acc[1] / n, acc[2] / n))
    if ao_img is not None:
        ao_px = list(ao_img.pixels)
        for i in range(size * size):
            occ = ao_px[i * 4] if i * 4 < len(ao_px) else 1.0
            f = 1.0 - 0.55 * (1.0 - occ)
            px[i * 4 + 0] *= f
            px[i * 4 + 1] *= f
            px[i * 4 + 2] *= f
        log('  multiplied AO into albedo')
    # Everything above is linear, and it has to be: the vertex colours are linear and
    # AO is a linear multiply. But images.new() without float_buffer gives an 8-bit
    # buffer, and assigning .pixels to one of those stores value*255 verbatim -- no
    # colour management runs. The v1 atlas therefore shipped FLESH 0.352 as byte 90,
    # which glTF then decoded as sRGB back down to 0.102 linear: a third of the
    # authored brightness, uniformly, which is what made the whole body read dark
    # olive and the FLESH_DARK neck read as a void. Encode explicitly here so the
    # byte in the PNG means what the glTF baseColorTexture sRGB decode expects.
    for i in range(size * size * 4):
        if i % 4 == 3:
            continue
        v = min(1.0, max(0.0, px[i]))
        px[i] = 12.92 * v if v <= 0.0031308 else 1.055 * (v ** (1 / 2.4)) - 0.055
    log('  encoded albedo linear -> sRGB')
    img.pixels = px
    img.pack()
    log(f'  albedo baked {size}x{size}')
    return img


def assign_final_material(ob, albedo, normal):
    mat = bpy.data.materials.new('UndeadV1BodyMat')
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    bsdf.inputs['Roughness'].default_value = 0.88
    bsdf.inputs['Metallic'].default_value = 0.0
    tex = nt.nodes.new('ShaderNodeTexImage')
    tex.image = albedo
    nt.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
    if normal is not None:
        ntex = nt.nodes.new('ShaderNodeTexImage')
        ntex.image = normal
        ntex.image.colorspace_settings.name = 'Non-Color'
        nmap = nt.nodes.new('ShaderNodeNormalMap')
        nt.links.new(ntex.outputs['Color'], nmap.inputs['Color'])
        nt.links.new(nmap.outputs['Normal'], bsdf.inputs['Normal'])
    ob.data.materials.clear()
    ob.data.materials.append(mat)
    return mat


# --------------------------------------------------------------------- weights
REGION_BONES = {
    'torso': ('Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'LeftShoulder', 'RightShoulder',
              'LeftArm', 'RightArm', 'LeftUpLeg', 'RightUpLeg'),
    'neck': ('Spine2', 'Neck', 'Head'),
}


def region_bone_names(region, all_bones):
    if region in REGION_BONES:
        return [f'mixamorig:{n}' for n in REGION_BONES[region]]
    if region in ('cranium', 'mandible', 'teeth', 'skull'):
        return ['mixamorig:Head']
    for sign, side in (('left', 'Left'), ('right', 'Right')):
        if region.startswith(f'arm{sign}'):
            return [f'mixamorig:{side}{n}' for n in
                    ('Shoulder', 'Arm', 'ForeArm', 'Hand')] + ['mixamorig:Spine2']
        if region.startswith(f'hand{sign}'):
            return [f'mixamorig:{side}{n}' for n in ('ForeArm', 'Hand')] + \
                   [b for b in all_bones if b.startswith(f'mixamorig:{side}Hand')]
        if region.startswith(f'finger{sign}'):
            fname = region[len(f'finger{sign}'):]
            return [f'mixamorig:{side}Hand'] + \
                   [f'mixamorig:{side}Hand{fname}{k}' for k in (1, 2, 3, 4)]
        if region.startswith(f'leg{sign}'):
            return [f'mixamorig:{side}{n}' for n in ('UpLeg', 'Leg', 'Foot')] + ['mixamorig:Hips']
        if region.startswith(f'foot{sign}'):
            return [f'mixamorig:{side}{n}' for n in ('Leg', 'Foot', 'ToeBase', 'Toe_End')]
    return list(all_bones)


def dist_to_segment(p, a, b):
    ab = b - a
    d = ab.length_squared
    if d < 1e-12:
        return (p - a).length
    t = max(0.0, min(1.0, (p - a).dot(ab) / d))
    return (a + ab * t - p).length


def analytic_skin(ob, arm, regions, smoothing=4):
    """Weight by distance to the bone segments the region is allowed to use, then
    smooth over the mesh graph. Bone heat fails across disjoint shells and bleeds
    between adjacent fingers; this does neither."""
    object_mode()
    bpy.context.view_layer.update()
    segs = {}
    for b in arm.data.bones:
        if not b.name.startswith('mixamorig:'):
            continue
        segs[b.name] = (arm.matrix_world @ b.head_local, arm.matrix_world @ b.tail_local)
    all_bones = list(segs)

    me = ob.data
    region_attr = me.attributes.get('region')
    mw = ob.matrix_world
    allowed_cache = {}
    weights = []
    for i, v in enumerate(me.vertices):
        p = mw @ v.co
        region = 'torso'
        if region_attr and i < len(region_attr.data):
            rid = region_attr.data[i].value
            if 0 <= rid < len(regions):
                region = regions[rid]
        if region not in allowed_cache:
            allowed_cache[region] = [n for n in region_bone_names(region, all_bones) if n in segs]
        allowed = allowed_cache[region] or all_bones
        scored = []
        for name in allowed:
            a, b = segs[name]
            d = dist_to_segment(p, a, b)
            scored.append((1.0 / ((d + 0.012) ** 4), name))
        scored.sort(reverse=True)
        top = scored[:4]
        total = sum(w for w, _ in top) or 1.0
        weights.append({n: w / total for w, n in top})

    # Laplacian smoothing over mesh edges keeps elbows and knees from creasing.
    if smoothing:
        adj = [[] for _ in me.vertices]
        for e in me.edges:
            a, b = e.vertices
            adj[a].append(b)
            adj[b].append(a)
        # The skull, jaw and teeth stay rigid to Head. Smoothing them against the
        # neck is what makes a jaw swim during motion.
        rigid = set()
        for i, v in enumerate(me.vertices):
            if region_attr and i < len(region_attr.data):
                rid = region_attr.data[i].value
                if 0 <= rid < len(regions) and regions[rid] in SKULL_REGIONS:
                    rigid.add(i)
        for _ in range(smoothing):
            nxt = []
            for i, w in enumerate(weights):
                if i in rigid or not adj[i]:
                    nxt.append(w)
                    continue
                acc = {}
                for k, val in w.items():
                    acc[k] = acc.get(k, 0.0) + val * 0.45
                share = 0.55 / len(adj[i])
                for nb in adj[i]:
                    for k, val in weights[nb].items():
                        acc[k] = acc.get(k, 0.0) + val * share
                items = sorted(acc.items(), key=lambda kv: -kv[1])[:4]
                total = sum(v for _, v in items) or 1.0
                nxt.append({k: v / total for k, v in items})
            weights = nxt

    ob.vertex_groups.clear()
    groups = {}
    for i, w in enumerate(weights):
        for name, val in w.items():
            if val < 1e-5:
                continue
            if name not in groups:
                groups[name] = ob.vertex_groups.new(name=name)
            groups[name].add([i], val, 'REPLACE')
    for mod in list(ob.modifiers):
        if mod.type == 'ARMATURE':
            ob.modifiers.remove(mod)
    mod = ob.modifiers.new('Armature', 'ARMATURE')
    mod.object = arm
    mod.use_vertex_groups = True
    mw_keep = ob.matrix_world.copy()
    ob.parent = arm
    ob.parent_type = 'OBJECT'
    ob.matrix_world = mw_keep
    unweighted = sum(1 for v in me.vertices if not v.groups)
    log(f'  analytic weights: groups={len(groups)} unweighted={unweighted}/{len(me.vertices)}')
    if unweighted:
        raise RuntimeError(f'{unweighted} unweighted vertices')
    return groups


# --------------------------------------------------------- contract side meshes
def primitive(name, loc, scale, mat):
    object_mode()
    bpy.ops.mesh.primitive_uv_sphere_add(segments=14, ring_count=10, radius=1.0, location=loc)
    ob = bpy.context.view_layer.objects.active
    ob.name = name
    ob.data.name = name
    ob.scale = scale
    apply_visual(ob)
    ob.data.materials.clear()
    ob.data.materials.append(mat)
    return ob


def attach_to_bone(ob, arm, bone):
    vg = ob.vertex_groups.new(name=bone)
    vg.add(list(range(len(ob.data.vertices))), 1.0, 'REPLACE')
    mw = ob.matrix_world.copy()
    ob.parent = arm
    ob.parent_type = 'OBJECT'
    ob.matrix_world = mw
    mod = ob.modifiers.new('Armature', 'ARMATURE')
    mod.object = arm
    mod.use_vertex_groups = True


def add_contract_meshes(arm, j, orbit_centres):
    """Five mesh names must exist. The Undead's eyes are real art, not a placeholder:
    the concept has two small amber lights deep in the orbits. Hair/Brows/Shorts are
    the minimal stand-ins the contract needs (the outfit is a later milestone)."""
    out = []
    # Strength was 7.5. The exporter writes emissiveFactor normalised to the largest
    # channel with KHR_materials_emissive_strength carrying the rest, and the Lite
    # engine honours that extension, so 7.5 pushed both R and G past 1.0 -- the eyes
    # clipped to pale yellow-white. 1.6 stopped the clipping but the fix1 face still
    # read yellow, not amber, so AMBER is redder now and the strength is down again:
    # at 1.1 the green channel lands near 0.3, which survives the tonemap as orange.
    eye_mat = make_material('UndeadV1Eyes', (0.06, 0.022, 0.004, 1.0), roughness=0.35,
                            emission=AMBER, strength=1.1)
    bm = bmesh.new()
    for c in orbit_centres:
        sub = bmesh.new()
        bmesh.ops.create_uvsphere(sub, u_segments=12, v_segments=9, radius=EYE_RADIUS)
        for v in sub.verts:
            v.co += c
        me_tmp = bpy.data.meshes.new('tmp')
        sub.to_mesh(me_tmp)
        sub.free()
        bm.from_mesh(me_tmp)
        bpy.data.meshes.remove(me_tmp)
    me = bpy.data.meshes.new('UndeadV1Eyes')
    bm.to_mesh(me)
    bm.free()
    eyes = bpy.data.objects.new('UndeadV1Eyes', me)
    bpy.context.collection.objects.link(eyes)
    eyes.data.materials.append(eye_mat)
    attach_to_bone(eyes, arm, 'mixamorig:Head')
    out.append(eyes)
    log(f'  amber eyes at {[tuple(round(v, 3) for v in c) for c in orbit_centres]}')

    head = j['mixamorig:Head']
    hips = j['mixamorig:Hips']
    hair_mat = make_material('UndeadV1Hair', (0.05, 0.045, 0.04, 1.0), roughness=0.9)
    brow_mat = make_material('UndeadV1Brows', (0.05, 0.045, 0.04, 1.0), roughness=0.9)
    cloth_mat = make_material('UndeadV1Cloth', (0.20, 0.19, 0.165, 1.0), roughness=0.95)
    hair = primitive('UndeadV1Hair', (0, head.y + 0.02, head.z + 0.03), (0.006,) * 3, hair_mat)
    brows = primitive('UndeadV1Brows', (0, head.y + 0.02, head.z + 0.02), (0.005,) * 3, brow_mat)
    for ob in (hair, brows):
        attach_to_bone(ob, arm, 'mixamorig:Head')
        out.append(ob)
    shorts = primitive('UndeadV1Shorts', (0, hips.y, hips.z), (0.016,) * 3, cloth_mat)
    attach_to_bone(shorts, arm, 'mixamorig:Hips')
    out.append(shorts)
    return out


def write_joints(arm):
    points = {}
    for b in arm.data.bones:
        if not b.name.startswith('mixamorig:'):
            continue
        h = arm.matrix_world @ b.head_local
        points[b.name] = [h.x, h.z, -h.y]   # Blender Z-up -> glTF Y-up
    if len(points) != 65:
        raise RuntimeError(f'joints JSON would have {len(points)} mixamorig bones')
    JOINTS_OUT.parent.mkdir(parents=True, exist_ok=True)
    JOINTS_OUT.write_text(json.dumps(points, indent=2) + '\n')
    log(f'  wrote {JOINTS_OUT.name} ({len(points)} joints)')


def export_glb(path, objects):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects:
        if o.type == 'MESH':
            o.data.name = o.name
        o.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    path.parent.mkdir(parents=True, exist_ok=True)
    kwargs = dict(filepath=str(path), use_selection=True, export_format='GLB',
                  export_yup=True, export_animations=False, export_skins=True,
                  export_all_influences=False, export_materials='EXPORT',
                  export_cameras=False, export_lights=False, export_texcoords=True,
                  export_normals=True)
    try:
        bpy.ops.export_scene.gltf(**kwargs, export_tangents=True)
    except TypeError:
        bpy.ops.export_scene.gltf(**kwargs)
    log(f'  exported {path.name} ({path.stat().st_size} bytes)')


def render_preview(meshes, tag):
    bb = world_bbox(meshes)
    if not bb:
        return
    lo, hi = bb
    ctr = (lo + hi) * 0.5
    span = max((hi - lo).x, (hi - lo).z) * 1.12
    scn = bpy.context.scene
    scn.render.engine = 'BLENDER_WORKBENCH'
    scn.render.resolution_x = 700
    scn.render.resolution_y = 1000
    cam_data = bpy.data.cameras.new('prev')
    cam_data.type = 'ORTHO'
    cam_data.ortho_scale = span * 1.45
    cam = bpy.data.objects.new('prev', cam_data)
    bpy.context.collection.objects.link(cam)
    scn.camera = cam
    PREVIEW_DIR.mkdir(parents=True, exist_ok=True)
    views = {
        'front': ((ctr.x, ctr.y - span * 3, ctr.z), (math.pi / 2, 0, 0)),
        'side': ((ctr.x + span * 3, ctr.y, ctr.z), (math.pi / 2, 0, math.pi / 2)),
        'back': ((ctr.x, ctr.y + span * 3, ctr.z), (math.pi / 2, 0, math.pi)),
    }
    for name, (loc, rot) in views.items():
        cam.location = loc
        cam.rotation_euler = rot
        scn.render.filepath = str(PREVIEW_DIR / f'{tag}-{name}.png')
        bpy.ops.render.render(write_still=True)
    # face close-up
    head_z = hi.z - (hi.z - lo.z) * 0.06
    cam_data.ortho_scale = 0.30
    cam.location = (ctr.x, ctr.y - span * 3, head_z)
    cam.rotation_euler = (math.pi / 2, 0, 0)
    scn.render.resolution_x = 800
    scn.render.resolution_y = 800
    scn.render.filepath = str(PREVIEW_DIR / f'{tag}-face.png')
    bpy.ops.render.render(write_still=True)
    bpy.data.objects.remove(cam, do_unlink=True)
    log(f'  preview renders -> {PREVIEW_DIR}')


def main():
    log(f'UNDEAD FROM SKULL height={TARGET_HEIGHT} bake={DO_BAKE} preview={DO_PREVIEW}')
    clear_scene()
    arm = import_source_armature()
    j = retarget_skeleton(arm)

    main_shells, hands, regions = build_body(j)
    registry = (regions, {n: i for i, n in enumerate(regions)})

    # Union the torso and limbs, then re-tag from the authored shells.
    shells_ref = main_shells.copy()
    shells_ref.data = main_shells.data.copy()
    shells_ref.name = 'UndeadShellsRef'
    bpy.context.collection.objects.link(shells_ref)
    unify(main_shells)
    transfer_regions(main_shells, shells_ref)
    bpy.data.objects.remove(shells_ref, do_unlink=True)

    skull = import_skull(j)
    label_skull(skull, registry)
    regions = registry[0]

    lo, hi = world_bbox([skull])
    w, d, h = hi.x - lo.x, hi.y - lo.y, hi.z - lo.z
    orbit_z = hi.z - h * EYE_Z_FRACTION
    orbit_y = lo.y + d * EYE_Y_FRACTION
    orbit_centres = [Vector((w * EYE_X_FRACTION, orbit_y, orbit_z)),
                     Vector((-w * EYE_X_FRACTION, orbit_y, orbit_z))]

    select_only(main_shells)
    hands.select_set(True)
    skull.select_set(True)
    bpy.context.view_layer.objects.active = main_shells
    bpy.ops.object.join()
    body = bpy.context.view_layer.objects.active
    body.name = 'UndeadV1Body'
    body.data.name = 'UndeadV1Body'
    body['regions'] = regions
    log(f'  joined body: verts={len(body.data.vertices)} tris={tris_of(body)}')

    select_only(body)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.object.mode_set(mode='OBJECT')
    shade_smooth(body)

    paint(body, j)
    smart_uv(body)

    placeholder = make_material('UndeadV1BakeTemp', BONE, vertex_color='Col')
    body.data.materials.clear()
    body.data.materials.append(placeholder)

    ao_img = bake_ao(body, BAKE_SIZE) if DO_BAKE else None

    albedo = bake_vertex_colours(body, BAKE_SIZE, ao_img)
    assign_final_material(body, albedo, None)

    analytic_skin(body, arm, regions)
    extras = add_contract_meshes(arm, j, orbit_centres)

    write_joints(arm)
    export_glb(REST, [arm, body] + extras)
    if DO_PREVIEW:
        render_preview([body] + extras, 'rest')

    bb = world_bbox([body])
    counts = {}
    ra = body.data.attributes.get('region')
    for i in range(len(body.data.vertices)):
        nm = regions[ra.data[i].value] if ra else '?'
        counts[nm] = counts.get(nm, 0) + 1
    summary = {
        'height': round(bb[1].z - bb[0].z, 4),
        'shoulderSpan': round(2 * abs(j['mixamorig:LeftArm'].x), 4),
        'fingertipSpan': round(2 * abs(j['mixamorig:LeftHandMiddle4'].x), 4),
        'skullHeight': round(h, 4),
        'bodyVerts': len(body.data.vertices),
        'bodyTris': tris_of(body),
        'restBytes': REST.stat().st_size,
        'regionVerts': counts,
        'meshes': ['UndeadV1Body', 'UndeadV1Eyes', 'UndeadV1Hair', 'UndeadV1Brows',
                   'UndeadV1Shorts'],
    }
    CACHE.mkdir(parents=True, exist_ok=True)
    (CACHE / 'undead-build.json').write_text(json.dumps(summary, indent=2) + '\n')
    log('BUILD COMPLETE ' + json.dumps(summary))


try:
    main()
except Exception:
    import traceback
    traceback.print_exc()
    raise
