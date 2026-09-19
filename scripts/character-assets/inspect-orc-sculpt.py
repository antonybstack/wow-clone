"""Inspect the Sketchfab print sculpt vs the current source-bind Orc.

Isolated background Blender. Read-only besides a throwaway scene and
authoring stills under .cache/source-motion/orc-sculpt/.

The Sketchfab GLB/glTF is a soup of overlapping copies (~2.5M tris). Default
is the original FBX plus the current game Orc. Pass --all to also load the GLB.

    /Applications/Blender.app/Contents/MacOS/Blender --background \
        --python scripts/character-assets/inspect-orc-sculpt.py
"""
import json
import math
import sys
import bpy
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
HP_FBX = ROOT / 'blender/characters/sources/orc-print/Orc_22.fbx'
HP_GLB = ROOT / 'blender/characters/sources/orc-print/male_orc_for_print.glb'
SRC = ROOT / 'public/characters/candidates/orc-source-v1.glb'
OUT = ROOT / '.cache/source-motion/orc-sculpt'
OUT.mkdir(parents=True, exist_ok=True)
argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
LOAD_GLB = '--all' in argv
TARGET_HEIGHT = 2.10


def clear():
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    for m in list(bpy.data.meshes):
        bpy.data.meshes.remove(m)
    for a in list(bpy.data.armatures):
        bpy.data.armatures.remove(a)
    for img in list(bpy.data.images):
        bpy.data.images.remove(img)


def world_bbox(objects):
    lo = Vector((1e9, 1e9, 1e9))
    hi = Vector((-1e9, -1e9, -1e9))
    any_mesh = False
    for o in objects:
        if o.type != 'MESH' or not o.data.vertices:
            continue
        any_mesh = True
        mw = o.matrix_world
        for corner in o.bound_box:
            p = mw @ Vector(corner)
            lo.x, lo.y, lo.z = min(lo.x, p.x), min(lo.y, p.y), min(lo.z, p.z)
            hi.x, hi.y, hi.z = max(hi.x, p.x), max(hi.y, p.y), max(hi.z, p.z)
    if not any_mesh:
        return None
    return lo, hi


def mesh_tris(ob):
    return sum(len(p.vertices) - 2 for p in ob.data.polygons)


def arm_abduction_deg(ob):
    """Rough left/right arm lift from down, using far-x verts in the upper half."""
    mw = ob.matrix_world
    pts = [mw @ v.co for v in ob.data.vertices]
    if len(pts) < 50:
        return None
    xs, ys, zs = [p.x for p in pts], [p.y for p in pts], [p.z for p in pts]
    loz, hiz = min(zs), max(zs)
    height = hiz - loz
    if height < 1e-6:
        return None
    cx = (min(xs) + max(xs)) * 0.5
    # Shoulder band: 0.72–0.82 of height. Hand band: 0.45–0.70 (A/T) or higher.
    def band(z0, z1):
        return [p for p in pts if loz + height * z0 <= p.z <= loz + height * z1]

    shoulders = band(0.72, 0.84)
    hands = band(0.42, 0.72)
    if not shoulders or not hands:
        return None
    left_sh = min(shoulders, key=lambda p: p.x)
    right_sh = max(shoulders, key=lambda p: p.x)
    left_hand = min(hands, key=lambda p: p.x)
    right_hand = max(hands, key=lambda p: p.x)

    def abduction(sh, hand):
        v = hand - sh
        down = Vector((0.0, 0.0, -1.0))
        if v.length < 1e-4:
            return None
        return math.degrees(v.angle(down))

    left = abduction(left_sh, left_hand)
    right = abduction(right_sh, right_hand)
    return {
        'leftDeg': None if left is None else round(left, 1),
        'rightDeg': None if right is None else round(right, 1),
        'leftShoulder': [round(left_sh.x, 3), round(left_sh.y, 3), round(left_sh.z, 3)],
        'leftHand': [round(left_hand.x, 3), round(left_hand.y, 3), round(left_hand.z, 3)],
        'rightShoulder': [round(right_sh.x, 3), round(right_sh.y, 3), round(right_sh.z, 3)],
        'rightHand': [round(right_hand.x, 3), round(right_hand.y, 3), round(right_hand.z, 3)],
        'centerX': round(cx, 3),
    }


def pose_label(abduction):
    if not abduction or abduction.get('leftDeg') is None:
        return 'unknown'
    avg = (abduction['leftDeg'] + (abduction['rightDeg'] or abduction['leftDeg'])) * 0.5
    if avg >= 70:
        return 'T-pose'
    if avg >= 35:
        return 'A-pose'
    return 'relaxed/down'


def stats(label, objects):
    meshes = [o for o in objects if o.type == 'MESH']
    arms = [o for o in objects if o.type == 'ARMATURE']
    print(f'\n=== {label} ===')
    print(f'objects={len(objects)} meshes={len(meshes)} armatures={len(arms)}')
    for arm in arms:
        print(f'  armature {arm.name} bones={len(arm.data.bones)}')
        for b in list(arm.data.bones)[:12]:
            h = arm.matrix_world @ b.head_local
            print(f'    bone {b.name} head=({h.x:.3f},{h.y:.3f},{h.z:.3f})')
    total_tris = 0
    mesh_rows = []
    biggest = None
    for o in meshes:
        tris = mesh_tris(o)
        total_tris += tris
        bb = world_bbox([o])
        if bb is None:
            continue
        lo, hi = bb
        size = hi - lo
        row = {
            'name': o.name,
            'verts': len(o.data.vertices),
            'tris': tris,
            'materials': [s.material.name if s.material else None for s in o.material_slots],
            'bbox': {
                'min': [round(lo.x, 4), round(lo.y, 4), round(lo.z, 4)],
                'max': [round(hi.x, 4), round(hi.y, 4), round(hi.z, 4)],
                'size': [round(size.x, 4), round(size.y, 4), round(size.z, 4)],
            },
            'hasUV': bool(o.data.uv_layers),
            'hasVertexColor': bool(o.data.color_attributes or o.data.vertex_colors),
        }
        mesh_rows.append(row)
        print(
            f'  mesh {o.name} verts={len(o.data.vertices)} tris~={tris} '
            f'bbox=({lo.x:.3f},{lo.y:.3f},{lo.z:.3f})-({hi.x:.3f},{hi.y:.3f},{hi.z:.3f}) '
            f'size=({size.x:.3f},{size.y:.3f},{size.z:.3f}) uv={row["hasUV"]}'
        )
        if biggest is None or tris > biggest['tris']:
            biggest = row
    combined = world_bbox(meshes)
    combined_row = None
    abduction = None
    if combined:
        lo, hi = combined
        size = hi - lo
        combined_row = {
            'min': [round(lo.x, 4), round(lo.y, 4), round(lo.z, 4)],
            'max': [round(hi.x, 4), round(hi.y, 4), round(hi.z, 4)],
            'size': [round(size.x, 4), round(size.y, 4), round(size.z, 4)],
            'heightZ': round(size.z, 4),
        }
        print(f'  combined_bbox heightZ={size.z:.3f} size=({size.x:.3f},{size.y:.3f},{size.z:.3f})')
        print(f'  total_tris~={total_tris}')
        body = next((o for o in meshes if biggest and o.name == biggest['name']), meshes[0] if meshes else None)
        if body:
            abduction = arm_abduction_deg(body)
            if abduction:
                print(f'  arm_abduction {abduction} pose={pose_label(abduction)}')
    return {
        'label': label,
        'meshCount': len(meshes),
        'armatureCount': len(arms),
        'armatures': [{'name': a.name, 'bones': len(a.data.bones)} for a in arms],
        'meshes': mesh_rows,
        'totalTris': total_tris,
        'combined': combined_row,
        'largestMesh': biggest['name'] if biggest else None,
        'armAbduction': abduction,
        'pose': pose_label(abduction),
        'scaleToTarget': None if not combined_row or combined_row['heightZ'] < 1e-6 else round(TARGET_HEIGHT / combined_row['heightZ'], 4),
    }


def clay(ob, color):
    mat = bpy.data.materials.new(f'Clay_{ob.name}')
    mat.use_nodes = True
    bsdf = next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    bsdf.inputs['Base Color'].default_value = (*color, 1.0)
    ob.data.materials.clear()
    ob.data.materials.append(mat)


def render_views(tag, meshes, frame_meshes=None):
    frame = frame_meshes or meshes
    bb = world_bbox(frame)
    if not bb:
        return []
    lo, hi = bb
    centre = (lo + hi) * 0.5
    height = max(hi.z - lo.z, 0.05)
    scene = bpy.context.scene
    for engine in ('BLENDER_WORKBENCH', 'BLENDER_EEVEE_NEXT', 'BLENDER_EEVEE'):
        try:
            scene.render.engine = engine
            break
        except TypeError:
            continue
    scene.render.resolution_x = 720
    scene.render.resolution_y = 720
    scene.render.film_transparent = False
    scene.render.image_settings.file_format = 'PNG'
    scene.display.shading.light = 'STUDIO'
    scene.display.shading.color_type = 'MATERIAL'
    cam_name = f'{tag}Cam'
    cam = bpy.data.objects.get(cam_name)
    if cam is None:
        cam_data = bpy.data.cameras.new(cam_name)
        cam_data.lens = 70
        cam = bpy.data.objects.new(cam_name, cam_data)
        bpy.context.collection.objects.link(cam)
    scene.camera = cam
    cam_data = cam.data
    written = []
    hidden = []
    wanted = set(meshes)
    for o in bpy.data.objects:
        if o.type == 'MESH' and o not in wanted:
            hidden.append((o, o.hide_render, o.hide_viewport))
            o.hide_render = True
            o.hide_viewport = True
    for name, azimuth in (('front', 0.0), ('side', 90.0), ('threequarter', 38.0)):
        framed = height * 1.12
        dist = framed / (2.0 * math.tan(cam_data.angle * 0.5)) * 1.05
        rad = math.radians(azimuth)
        target = Vector((centre.x, centre.y, centre.z))
        cam.location = (
            target.x + math.sin(rad) * dist,
            target.y - math.cos(rad) * dist,
            target.z + framed * 0.06,
        )
        cam.rotation_euler = (target - cam.location).to_track_quat('-Z', 'Y').to_euler()
        path = OUT / f'inspect-{tag}-{name}.png'
        scene.render.filepath = str(path)
        bpy.ops.render.render(write_still=True)
        written.append(str(path.relative_to(ROOT)))
        print(f'  wrote {path}')
    for o, hr, hv in hidden:
        o.hide_render = hr
        o.hide_viewport = hv
    return written


report = {'targetHeightM': TARGET_HEIGHT, 'sources': {}}

clear()
if HP_FBX.exists():
    print('IMPORT FBX', HP_FBX)
    bpy.ops.import_scene.fbx(filepath=str(HP_FBX))
    raw = stats('print FBX raw', list(bpy.data.objects))
    report['sources']['fbxRaw'] = raw
    meshes = [o for o in bpy.data.objects if o.type == 'MESH']
    bb = world_bbox(meshes)
    if bb:
        lo, hi = bb
        height = hi.z - lo.z
        if height > 1e-6:
            scale = TARGET_HEIGHT / height
            root_obs = [o for o in bpy.data.objects if o.parent is None]
            for o in root_obs:
                o.scale *= scale
            bpy.context.view_layer.update()
            for o in list(bpy.data.objects):
                if o.type in {'MESH', 'EMPTY', 'ARMATURE'}:
                    bpy.context.view_layer.objects.active = o
                    o.select_set(True)
            try:
                bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
            except Exception as err:
                print('apply scale skipped', err)
            bpy.ops.object.select_all(action='DESELECT')
            bpy.context.view_layer.update()
            bb2 = world_bbox([o for o in bpy.data.objects if o.type == 'MESH'])
            if bb2:
                lo2, hi2 = bb2
                dz = -lo2.z
                for o in bpy.data.objects:
                    if o.parent is None:
                        o.location.z += dz
                bpy.context.view_layer.update()
        scaled = stats('print FBX scaled to 2.10m, feet on z=0', list(bpy.data.objects))
        report['sources']['fbxScaled'] = scaled
        meshes = [o for o in bpy.data.objects if o.type == 'MESH']
        colors = [
            (0.85, 0.55, 0.22),
            (0.22, 0.72, 0.38),
            (0.25, 0.45, 0.85),
            (0.85, 0.25, 0.45),
            (0.75, 0.75, 0.20),
            (0.55, 0.30, 0.80),
            (0.90, 0.90, 0.90),
        ]
        for i, o in enumerate(meshes):
            clay(o, colors[i % len(colors)])
        report['renders'] = render_views('fbx', meshes)
        report['partRenders'] = {}
        for o in meshes:
            safe = ''.join(c if c.isalnum() else '_' for c in o.name)[:40]
            report['partRenders'][o.name] = render_views(f'part-{safe}', [o], frame_meshes=meshes)
        keep_names = {'腳掌3', 'orc_11_copy4', 'Extract4'}
        keep = [o for o in meshes if o.name in keep_names]
        if keep:
            report['keepRenders'] = render_views('keep', keep, frame_meshes=meshes)
            print('KEEP PARTS', [o.name for o in keep])
else:
    print('MISSING', HP_FBX)
    report['sources']['fbxRaw'] = {'missing': str(HP_FBX)}

if LOAD_GLB:
    clear()
    if HP_GLB.exists():
        print('IMPORT GLB', HP_GLB)
        bpy.ops.import_scene.gltf(filepath=str(HP_GLB))
        report['sources']['glb'] = stats('print GLB', list(bpy.data.objects))
    else:
        print('MISSING', HP_GLB)
        report['sources']['glb'] = {'missing': str(HP_GLB)}
else:
    report['sources']['glb'] = {'skipped': 'pass --all to load the Sketchfab GLB soup'}

clear()
if SRC.exists():
    print('IMPORT SOURCE ORC', SRC)
    bpy.ops.import_scene.gltf(filepath=str(SRC))
    report['sources']['currentOrc'] = stats('current source Orc', list(bpy.data.objects))
    arm = next((o for o in bpy.data.objects if o.type == 'ARMATURE'), None)
    if arm:
        names = [b.name for b in arm.data.bones]
        report['sources']['currentOrc']['boneNames'] = names
        report['sources']['currentOrc']['mixamorigCount'] = sum(1 for n in names if n.startswith('mixamorig:'))
else:
    print('MISSING', SRC)
    report['sources']['currentOrc'] = {'missing': str(SRC)}

out_json = OUT / 'inspect.json'
out_json.write_text(json.dumps(report, indent=2) + '\n')
print('\nWROTE', out_json)
print('INSPECT COMPLETE')
