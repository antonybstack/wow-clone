"""Measure the CC0 skull and the 65-joint source bind before authoring the Undead.

Run:
  /Applications/Blender.app/Contents/MacOS/Blender --background \
      --python scripts/character-assets/inspect-undead-sources.py
"""
import json
import sys
from pathlib import Path

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
SKULL_OBJ = ROOT / 'blender/characters/sources/undead-skull/skull-obj/skull-Low4K.obj'
HUMAN_SRC = ROOT / 'public/characters/candidates/human-source-v1.glb'


def log(msg):
    print(f'[inspect] {msg}', flush=True)
    sys.stdout.flush()


def clear():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def bbox(ob):
    mw = ob.matrix_world
    pts = [mw @ Vector(c) for c in ob.bound_box]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    return lo, hi


clear()
log(f'skull obj exists={SKULL_OBJ.exists()} {SKULL_OBJ}')
if SKULL_OBJ.exists():
    try:
        bpy.ops.wm.obj_import(filepath=str(SKULL_OBJ))
    except AttributeError:
        bpy.ops.import_scene.obj(filepath=str(SKULL_OBJ))
    for ob in [o for o in bpy.data.objects if o.type == 'MESH']:
        lo, hi = bbox(ob)
        size = hi - lo
        tris = sum(len(p.vertices) - 2 for p in ob.data.polygons)
        log(f'  mesh {ob.name}: verts={len(ob.data.vertices)} tris={tris} '
            f'loose_parts=? size={tuple(round(v, 4) for v in size)} lo={tuple(round(v, 4) for v in lo)}')
        log(f'    materials={[m.name for m in ob.data.materials]} uvs={[l.name for l in ob.data.uv_layers]}')
        # Count disconnected shells: a separate mandible would show as 2.
        import bmesh
        bm = bmesh.new(); bm.from_mesh(ob.data)
        seen = set(); shells = []
        for v in bm.verts:
            if v.index in seen:
                continue
            stack = [v]; comp = 0; seen.add(v.index)
            while stack:
                cur = stack.pop(); comp += 1
                for e in cur.link_edges:
                    o = e.other_vert(cur)
                    if o.index not in seen:
                        seen.add(o.index); stack.append(o)
            shells.append(comp)
        bm.free()
        shells.sort(reverse=True)
        log(f'    shells={len(shells)} sizes={shells[:8]}')

clear()
log(f'human source {HUMAN_SRC}')
bpy.ops.import_scene.gltf(filepath=str(HUMAN_SRC))
arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
arm.data.pose_position = 'REST'
bpy.context.view_layer.update()
names = [b.name for b in arm.data.bones if b.name.startswith('mixamorig:')]
log(f'  armature {arm.name} scale={tuple(round(s,5) for s in arm.scale)} mixamorig bones={len(names)}')
pts = {}
for b in arm.data.bones:
    if not b.name.startswith('mixamorig:'):
        continue
    h = arm.matrix_world @ b.head_local
    pts[b.name] = (h.x, h.z, -h.y)  # glTF Y-up
interest = ['mixamorig:Hips', 'mixamorig:Spine2', 'mixamorig:Neck', 'mixamorig:Head',
            'mixamorig:HeadTop_End', 'mixamorig:LeftShoulder', 'mixamorig:LeftArm',
            'mixamorig:LeftForeArm', 'mixamorig:LeftHand', 'mixamorig:LeftHandMiddle1',
            'mixamorig:LeftHandMiddle4', 'mixamorig:LeftUpLeg', 'mixamorig:LeftLeg',
            'mixamorig:LeftFoot', 'mixamorig:LeftToeBase']
for n in interest:
    if n in pts:
        log(f'    {n:34s} {tuple(round(v,4) for v in pts[n])}')
meshes = [o for o in bpy.data.objects if o.type == 'MESH']
for ob in meshes:
    lo, hi = bbox(ob)
    log(f'  mesh {ob.name}: verts={len(ob.data.vertices)} size={tuple(round(v,4) for v in (hi-lo))}')
(ROOT / '.cache').mkdir(exist_ok=True)
(ROOT / '.cache/undead-human-joints.json').write_text(json.dumps(pts, indent=2) + '\n')
log('wrote .cache/undead-human-joints.json')
log('DONE')
