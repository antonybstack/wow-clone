"""Shared isolated Blender studio for MakeHuman CC0 race bodies. No shrine / MCP."""
from __future__ import annotations

import json
import math
from collections import Counter
from pathlib import Path

import bpy
from mathutils import Quaternion, Vector

import mh_garment
import mh_io
import mh_race

AUTHOR_LENS_MM = 38.0
AUTHOR_FILL = 0.80
AUTHOR_RES = (960, 1280)
LINEUP_RES = (1600, 900)


def reset_empty():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def mat_clay(name, color, rough=0.72):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Roughness"].default_value = rough
    spec = bsdf.inputs.get("Specular IOR Level") or bsdf.inputs.get("Specular")
    if spec:
        spec.default_value = 0.15
    mat.diffuse_color = (*color, 1.0)
    return mat


def build_mesh(name, verts, uvs, loops):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata([tuple(v) for v in verts], [], [[c[0] for c in loop] for loop in loops])
    mesh.update()
    uv_layer = mesh.uv_layers.new(name="UVMap")
    li = 0
    for loop in loops:
        for _, ti in loop:
            if ti >= 0:
                uv_layer.data[li].uv = uvs[ti]
            li += 1
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    return obj


def build_armature(bones, arm_name, obj_name):
    arm = bpy.data.armatures.new(arm_name)
    obj = bpy.data.objects.new(obj_name, arm)
    bpy.context.collection.objects.link(obj)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.mode_set(mode="EDIT")
    ebones = {}
    for b in bones:
        eb = arm.edit_bones.new(b["name"])
        eb.head = Vector(b["head"])
        tail = Vector(b["tail"])
        if (tail - eb.head).length < 1e-5:
            tail = eb.head + Vector((0, 0, 0.02))
        eb.tail = tail
        eb.use_connect = False
        ebones[b["name"]] = eb
    for b in bones:
        if b["parent"] and b["parent"] in ebones:
            ebones[b["name"]].parent = ebones[b["parent"]]
    bpy.ops.object.mode_set(mode="OBJECT")
    return obj


def assign_weights(mesh_obj, limited):
    mesh = mesh_obj.data
    groups = {}
    for infl in limited:
        for name, _ in infl:
            if name not in groups:
                groups[name] = mesh_obj.vertex_groups.new(name=name)
    for vi, infl in enumerate(limited):
        for name, w in infl:
            groups[name].add([vi], w, "REPLACE")


def parent_armature(mesh_obj, arm_obj):
    if any(m.type == "ARMATURE" for m in mesh_obj.modifiers):
        raise RuntimeError(f"refusing second armature modifier on {mesh_obj.name}")
    mod = mesh_obj.modifiers.new("Armature", "ARMATURE")
    mod.object = arm_obj
    mod.use_vertex_groups = True
    mesh_obj.parent = arm_obj


def apply_identity(obj):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)


def setup_view():
    scene = bpy.context.scene
    try:
        scene.render.engine = "BLENDER_EEVEE_NEXT"
    except TypeError:
        scene.render.engine = "BLENDER_WORKBENCH"
    scene.render.resolution_x = AUTHOR_RES[0]
    scene.render.resolution_y = AUTHOR_RES[1]
    scene.render.film_transparent = False
    world = bpy.data.worlds.new("Studio")
    scene.world = world
    world.use_nodes = True
    bg = next(n for n in world.node_tree.nodes if n.type == "BACKGROUND")
    bg.inputs[0].default_value = (0.18, 0.19, 0.21, 1)
    bg.inputs[1].default_value = 1.0
    light_data = bpy.data.lights.new("Key", "AREA")
    light_data.energy = 250
    light_data.size = 2.0
    light = bpy.data.objects.new("Key", light_data)
    light.location = (1.6, -1.8, 2.2)
    bpy.context.collection.objects.link(light)
    fill = bpy.data.lights.new("Fill", "AREA")
    fill.energy = 80
    fill.size = 3.0
    fo = bpy.data.objects.new("Fill", fill)
    fo.location = (-1.8, -0.8, 1.4)
    bpy.context.collection.objects.link(fo)
    cam = bpy.data.cameras.new("AuthorCam")
    cam.lens = AUTHOR_LENS_MM
    cobj = bpy.data.objects.new("AuthorCam", cam)
    bpy.context.collection.objects.link(cobj)
    scene.camera = cobj
    return cobj


def look_at(cam, target, loc):
    cam.location = loc
    direction = Vector(target) - Vector(loc)
    cam.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def render(path):
    bpy.context.scene.render.filepath = str(path)
    bpy.context.scene.render.image_settings.file_format = "PNG"
    bpy.ops.render.render(write_still=True)


def body_aabb(obj):
    bpy.context.view_layer.update()
    xs, ys, zs = [], [], []
    for v in obj.data.vertices:
        w = obj.matrix_world @ v.co
        xs.append(w.x)
        ys.append(w.y)
        zs.append(w.z)
    return (min(xs), min(ys), min(zs)), (max(xs), max(ys), max(zs))


def frame_distance(height, fill=AUTHOR_FILL, lens=AUTHOR_LENS_MM, sensor=36.0):
    # Portrait AUTO fit: sensor_width is the vertical sensor size.
    tan_half = (sensor * 0.5) / lens
    return height / (2.0 * fill * tan_half)


def frame_full_figure(cam, obj, view="front", fill=AUTHOR_FILL):
    (xmin, ymin, zmin), (xmax, ymax, zmax) = body_aabb(obj)
    mid = Vector(((xmin + xmax) * 0.5, (ymin + ymax) * 0.5, (zmin + zmax) * 0.5))
    height = zmax - zmin
    dist = frame_distance(height, fill)
    if view == "front":
        loc = (mid.x, mid.y - dist, mid.z)
    elif view == "back":
        loc = (mid.x, mid.y + dist, mid.z)
    elif view == "side":
        loc = (mid.x + dist, mid.y, mid.z)
    elif view == "three_quarter":
        loc = (mid.x + dist * 0.72, mid.y - dist * 0.72, mid.z)
    else:
        raise ValueError(view)
    look_at(cam, tuple(mid), loc)
    return mid, dist


def frame_point(cam, target, dist):
    t = Vector(target)
    look_at(cam, tuple(t), (t.x, t.y - dist, t.z))


def bone_world(arm, name, end="head"):
    pb = arm.pose.bones.get(name)
    if pb is None:
        return None
    bpy.context.view_layer.update()
    vec = pb.head if end == "head" else pb.tail
    return arm.matrix_world @ vec


def rest_bone_matrices(arm, bones):
    """bone name -> 4x4 nested-list rest (bind) matrix, armature-world space."""
    bpy.context.view_layer.update()
    out = {}
    for b in bones:
        eb = arm.data.bones.get(b["name"])
        if eb is None:
            continue
        mat = arm.matrix_world @ eb.matrix_local
        out[b["name"]] = [list(row) for row in mat]
    return out


def posed_bone_matrices(arm, bones):
    """bone name -> 4x4 nested-list posed matrix at the armature's current pose,
    armature-world space."""
    bpy.context.view_layer.update()
    out = {}
    for b in bones:
        pb = arm.pose.bones.get(b["name"])
        if pb is None:
            continue
        mat = arm.matrix_world @ pb.matrix
        out[b["name"]] = [list(row) for row in mat]
    return out


def set_hide(obj, hide):
    if obj is None:
        return
    obj.hide_render = hide
    obj.hide_viewport = hide


def pose_bones(arm, spec):
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode="POSE")
    pb = arm.pose.bones
    for name, (axis, deg) in spec.items():
        if name not in pb:
            continue
        b = pb[name]
        b.rotation_mode = "XYZ"
        e = b.rotation_euler
        rad = math.radians(deg)
        if axis == "x":
            e.x = rad
        elif axis == "y":
            e.y = rad
        else:
            e.z = rad
    bpy.ops.object.mode_set(mode="OBJECT")


def world_positions(obj):
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    ev = obj.evaluated_get(dg)
    mat = ev.matrix_world
    return [mat @ v.co for v in ev.data.vertices]


def compare_skin(full_obj, reduced_obj, weights):
    a = world_positions(full_obj)
    b = world_positions(reduced_obj)
    n = min(len(a), len(b))
    dists = [((a[i] - b[i]).length, i) for i in range(n)]
    dists.sort(reverse=True)
    vals = [d for d, _ in dists]
    p95 = vals[int(0.05 * (len(vals) - 1))] if vals else 0.0
    worst = dists[:8]
    ids = [i for _, i in worst]
    return {
        "maxM": vals[0] if vals else 0.0,
        "p95M": p95,
        "worstVertexIds": ids,
        "worstDistancesM": [d for d, _ in worst],
        "worstRegions": [mh_race.region_of_weights(weights[i]) for i in ids],
        "worstDominantBones": [mh_race.dominant_bone(weights[i]) for i in ids],
        "vertexCountCompared": n,
        "samePose": True,
    }


def shade_body_smooth(mesh):
    for p in mesh.polygons:
        p.use_smooth = True
    mesh.update()


def normals_outward(obj):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.object.mode_set(mode="OBJECT")


def image_node(nt, path, non_color=False):
    tex = nt.nodes.new("ShaderNodeTexImage")
    img = bpy.data.images.load(str(path), check_existing=True)
    tex.image = img
    if non_color:
        img.colorspace_settings.name = "Non-Color"
    return tex


def mat_pbr(
    name,
    albedo_path=None,
    normal_path=None,
    roughness_path=None,
    color=(1.0, 1.0, 1.0),
    rough=0.5,
    metallic=0.0,
    alpha_clip=None,
    specular=0.3,
    double_sided=False,
):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    out = next(n for n in nt.nodes if n.type == "OUTPUT_MATERIAL")
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metallic
    spec = bsdf.inputs.get("Specular IOR Level") or bsdf.inputs.get("Specular")
    if spec:
        spec.default_value = specular
    if albedo_path:
        tex = image_node(nt, albedo_path)
        nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
        if alpha_clip is not None:
            nt.links.new(tex.outputs["Alpha"], bsdf.inputs["Alpha"])
            mat.blend_method = "CLIP"
            clip = getattr(mat, "alpha_threshold", None)
            if clip is not None:
                mat.alpha_threshold = alpha_clip
            else:
                mat.blend_method = "HASHED"
    if roughness_path:
        rtex = image_node(nt, roughness_path, non_color=True)
        nt.links.new(rtex.outputs["Color"], bsdf.inputs["Roughness"])
    if normal_path:
        ntex = image_node(nt, normal_path, non_color=True)
        nrm = nt.nodes.new("ShaderNodeNormalMap")
        nt.links.new(ntex.outputs["Color"], nrm.inputs["Color"])
        nt.links.new(nrm.outputs["Normal"], bsdf.inputs["Normal"])
    mat.diffuse_color = (*color, 1.0)
    if hasattr(mat, "use_backface_culling"):
        mat.use_backface_culling = not double_sided
    if hasattr(mat, "use_backface_culling_shadow"):
        mat.use_backface_culling_shadow = not double_sided
    return mat


def write_skin_aux_maps(albedo_path, normal_path, roughness_path):
    """CC0 albedo → tangent-style normal (luma Sobel) + zoned roughness."""
    alb = bpy.data.images.load(str(albedo_path), check_existing=True)
    w, h = alb.size
    px = list(alb.pixels)
    luma = [0.0] * (w * h)
    for i in range(w * h):
        o = i * 4
        luma[i] = 0.2126 * px[o] + 0.7152 * px[o + 1] + 0.0722 * px[o + 2]

    def sample(x, y):
        x = 0 if x < 0 else (w - 1 if x >= w else x)
        y = 0 if y < 0 else (h - 1 if y >= h else y)
        return luma[y * w + x]

    npx = [0.0] * (w * h * 4)
    rpx = [0.0] * (w * h * 4)
    strength = 2.4
    for y in range(h):
        v = y / max(h - 1, 1)
        for x in range(w):
            u = x / max(w - 1, 1)
            dx = sample(x + 1, y) - sample(x - 1, y)
            dy = sample(x, y + 1) - sample(x, y - 1)
            nx = -dx * strength
            ny = -dy * strength
            nz = 1.0
            nlen = math.sqrt(nx * nx + ny * ny + nz * nz) or 1.0
            nx, ny, nz = nx / nlen, ny / nlen, nz / nlen
            i = (y * w + x) * 4
            npx[i] = nx * 0.5 + 0.5
            npx[i + 1] = ny * 0.5 + 0.5
            npx[i + 2] = nz * 0.5 + 0.5
            npx[i + 3] = 1.0
            rough = 0.52
            L = luma[y * w + x]
            if u > 0.52:
                if L > 0.42:
                    rough = 0.34
                if 0.55 < v < 0.85 and 0.62 < u < 0.92:
                    rough = min(rough, 0.32)
            if v < 0.22 and L > 0.55:
                rough = 0.26
            rpx[i] = rpx[i + 1] = rpx[i + 2] = rough
            rpx[i + 3] = 1.0

    def save(path, pixels):
        img = bpy.data.images.new(path.name, w, h, alpha=True)
        img.colorspace_settings.name = "Non-Color"
        img.pixels = pixels
        img.filepath_raw = str(path)
        img.file_format = "PNG"
        img.save()
        bpy.data.images.remove(img)

    save(normal_path, npx)
    save(roughness_path, rpx)


def rgb_to_hsv(r, g, b):
    mx = max(r, g, b)
    mn = min(r, g, b)
    df = mx - mn
    if df < 1e-12:
        h = 0.0
    elif mx == r:
        h = (60.0 * ((g - b) / df) + 360.0) % 360.0
    elif mx == g:
        h = (60.0 * ((b - r) / df) + 120.0) % 360.0
    else:
        h = (60.0 * ((r - g) / df) + 240.0) % 360.0
    s = 0.0 if mx < 1e-12 else df / mx
    return h, s, mx


def hsv_to_rgb(h, s, v):
    c = v * s
    x = c * (1.0 - abs((h / 60.0) % 2.0 - 1.0))
    m = v - c
    if h < 60.0:
        rp, gp, bp = c, x, 0.0
    elif h < 120.0:
        rp, gp, bp = x, c, 0.0
    elif h < 180.0:
        rp, gp, bp = 0.0, c, x
    elif h < 240.0:
        rp, gp, bp = 0.0, x, c
    elif h < 300.0:
        rp, gp, bp = x, 0.0, c
    else:
        rp, gp, bp = c, 0.0, x
    return rp + m, gp + m, bp + m


def write_albedo_hsv_shift(src: Path, dest: Path, hue_deg=0.0, sat_scale=1.0, val_scale=1.0):
    """Human CC0 albedo → hue/value-shifted copy. Not a flat Base Color tint."""
    img = bpy.data.images.load(str(src), check_existing=True)
    w, h = img.size
    px = list(img.pixels)
    for i in range(0, len(px), 4):
        hh, s, v = rgb_to_hsv(px[i], px[i + 1], px[i + 2])
        hh = (hh + hue_deg) % 360.0
        s = min(1.0, max(0.0, s * sat_scale))
        v = min(1.0, max(0.0, v * val_scale))
        r, g, b = hsv_to_rgb(hh, s, v)
        px[i], px[i + 1], px[i + 2] = r, g, b
        px[i + 3] = 1.0
    out = bpy.data.images.new(dest.name, w, h, alpha=True)
    out.pixels = px
    out.filepath_raw = str(dest)
    out.file_format = "PNG"
    out.save()
    bpy.data.images.remove(out)
    if img.users == 0:
        bpy.data.images.remove(img)


def write_hair_albedo(src: Path, dest: Path, rgb=(0.62, 0.38, 0.16)):
    """Greyscale short01 → opaque Lite-readable hair. No luma clip, no MASK."""
    img = bpy.data.images.load(str(src), check_existing=True)
    w, h = img.size
    px = list(img.pixels)
    br, bg, bb = rgb
    for i in range(0, len(px), 4):
        luma = 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]
        gain = 0.78 + 0.45 * luma
        if gain > 1.15:
            gain = 1.15
        px[i] = br * gain
        px[i + 1] = bg * gain
        px[i + 2] = bb * gain
        px[i + 3] = 1.0
    out = bpy.data.images.new(dest.name, w, h, alpha=True)
    out.pixels = px
    out.filepath_raw = str(dest)
    out.file_format = "PNG"
    out.save()
    bpy.data.images.remove(out)


def _paint_iris_catchlights(px, w, h):
    """One spec disc per iris. Pixel origin matches Blender (y up)."""
    brown = []
    for y in range(h):
        for x in range(w):
            i = (y * w + x) * 4
            r, g, b = px[i], px[i + 1], px[i + 2]
            chroma = max(r, g, b) - min(r, g, b)
            if chroma > 0.12 and r > g + 0.04 and r > b + 0.04:
                brown.append((x, y))
    groups = []
    if brown:
        groups.append([p for p in brown if p[0] < w * 0.5])
        groups.append([p for p in brown if p[0] >= w * 0.5])
    else:
        groups = [[(int(0.28 * w), int(0.32 * h))], [(int(0.72 * w), int(0.68 * h))]]
    for cells in groups:
        if not cells:
            continue
        sx = sum(c[0] for c in cells) / len(cells)
        sy = sum(c[1] for c in cells) / len(cells)
        rad = math.sqrt(max(len(cells), 1) / math.pi)
        if rad < 6.0:
            rad = 0.045 * w
        hx = sx - 0.32 * rad
        hy = sy + 0.28 * rad
        hr = max(3.0, 0.22 * rad)
        hr2 = hr * hr
        y0 = max(0, int(hy - hr - 1))
        y1 = min(h - 1, int(hy + hr + 1))
        x0 = max(0, int(hx - hr - 1))
        x1 = min(w - 1, int(hx + hr + 1))
        for yy in range(y0, y1 + 1):
            for xx in range(x0, x1 + 1):
                d2 = (xx - hx) * (xx - hx) + (yy - hy) * (yy - hy)
                if d2 > hr2:
                    continue
                t = 1.0 - math.sqrt(d2) / hr
                k = t * t
                ii = (yy * w + xx) * 4
                px[ii] = px[ii] * (1.0 - k) + 0.98 * k
                px[ii + 1] = px[ii + 1] * (1.0 - k) + 0.98 * k
                px[ii + 2] = px[ii + 2] * (1.0 - k) + 0.99 * k


def write_eye_albedo(src: Path, dest: Path, hue_deg=0.0, sat_scale=1.0, val_scale=1.0, rough_dest=None):
    """CC0 brown_eye atlas: non-iris/non-pupil → white sclera. Optional iris HSV + catchlight."""
    img = bpy.data.images.load(str(src), check_existing=True)
    w, h = img.size
    px = list(img.pixels)
    for i in range(0, len(px), 4):
        r, g, b = px[i], px[i + 1], px[i + 2]
        chroma = max(r, g, b) - min(r, g, b)
        luma = 0.2126 * r + 0.7152 * g + 0.0722 * b
        is_pupil = luma < 0.11
        is_iris = (
            chroma > 0.12
            and r > g + 0.03
            and r > b + 0.03
            and 0.11 <= luma < 0.55
        )
        if is_iris:
            if hue_deg or sat_scale != 1.0 or val_scale != 1.0:
                hh, s, v = rgb_to_hsv(r, g, b)
                hh = (hh + hue_deg) % 360.0
                s = min(1.0, max(0.0, s * sat_scale))
                v = min(1.0, max(0.0, v * val_scale))
                rr, gg, bb = hsv_to_rgb(hh, s, v)
                px[i], px[i + 1], px[i + 2] = rr, gg, bb
        elif not is_pupil:
            px[i], px[i + 1], px[i + 2] = 0.96, 0.95, 0.93
        px[i + 3] = 1.0
    _paint_iris_catchlights(px, w, h)
    out = bpy.data.images.new(dest.name, w, h, alpha=True)
    out.pixels = px
    out.filepath_raw = str(dest)
    out.file_format = "PNG"
    out.save()
    bpy.data.images.remove(out)
    if rough_dest is not None:
        rpx = [0.28, 0.28, 0.28, 1.0] * (w * h)
        for i in range(0, len(px), 4):
            r, g, b = px[i], px[i + 1], px[i + 2]
            chroma = max(r, g, b) - min(r, g, b)
            luma = 0.2126 * r + 0.7152 * g + 0.0722 * b
            if luma > 0.92 and chroma < 0.08:
                rv = 0.07
            elif chroma > 0.12 or luma < 0.12:
                rv = 0.10
            else:
                rv = 0.30
            rpx[i] = rpx[i + 1] = rpx[i + 2] = rv
        rout = bpy.data.images.new(Path(rough_dest).name, w, h, alpha=True)
        rout.pixels = rpx
        rout.filepath_raw = str(rough_dest)
        rout.file_format = "PNG"
        rout.save()
        bpy.data.images.remove(rout)


def inflate(verts, amount):
    n = len(verts)
    cx = sum(v[0] for v in verts) / n
    cy = sum(v[1] for v in verts) / n
    cz = sum(v[2] for v in verts) / n
    out = []
    for v in verts:
        dx, dy, dz = v[0] - cx, v[1] - cy, v[2] - cz
        d = math.sqrt(dx * dx + dy * dy + dz * dz) or 1.0
        out.append([v[0] + dx / d * amount, v[1] + dy / d * amount, v[2] + dz / d * amount])
    return out


def eye_clusters(eye_verts):
    groups = (
        [i for i, v in enumerate(eye_verts) if v[0] >= 0.0],
        [i for i, v in enumerate(eye_verts) if v[0] < 0.0],
    )
    out = []
    for ids in groups:
        if not ids:
            continue
        cx = sum(eye_verts[i][0] for i in ids) / len(ids)
        cy = sum(eye_verts[i][1] for i in ids) / len(ids)
        cz = sum(eye_verts[i][2] for i in ids) / len(ids)
        radius = 0.0
        for i in ids:
            radius = max(radius, math.dist(eye_verts[i], (cx, cy, cz)))
        out.append({"ids": ids, "center": (cx, cy, cz), "radius": radius})
    return out


def shrink_eye_globes(eye_verts, scale=0.83):
    """Uniform scale about each globe centroid. 0.83 = 17% smaller."""
    for cl in eye_clusters(eye_verts):
        cx, cy, cz = cl["center"]
        for i in cl["ids"]:
            v = eye_verts[i]
            v[0] = cx + (v[0] - cx) * scale
            v[1] = cy + (v[1] - cy) * scale
            v[2] = cz + (v[2] - cz) * scale


def bulge_cornea(eye_verts, amount=0.0014, cone=0.52):
    """Front hemisphere dome. Blender −Y is camera-forward."""
    for cl in eye_clusters(eye_verts):
        cx, cy, cz = cl["center"]
        for i in cl["ids"]:
            v = eye_verts[i]
            dx, dy, dz = v[0] - cx, v[1] - cy, v[2] - cz
            d = math.sqrt(dx * dx + dy * dy + dz * dz) or 1.0
            fwd = -dy / d
            if fwd < cone:
                continue
            t = (fwd - cone) / (1.0 - cone)
            push = amount * t * t
            v[0] += dx / d * push
            v[1] += dy / d * push
            v[2] += dz / d * push


def tuck_globe_backs(eye_verts, back_scale=0.62):
    """Shrink the +Y hemisphere so the equator does not draw an orbital ring."""
    for cl in eye_clusters(eye_verts):
        cx, cy, cz = cl["center"]
        rad = cl["radius"] or 1.0
        for i in cl["ids"]:
            v = eye_verts[i]
            dy = v[1] - cy
            if dy <= 0.0:
                continue
            t = min(1.0, dy / rad)
            s = 1.0 - (1.0 - back_scale) * t
            v[0] = cx + (v[0] - cx) * s
            v[1] = cy + dy * s
            v[2] = cz + (v[2] - cz) * s


def wrap_lids_on_spheres(
    body_verts,
    eye_verts,
    lid_ids,
    clearance=0.0009,
    max_pull=0.012,
    upper_nz=0.18,
    lower_nz=-0.22,
):
    """Project lids onto globes. Clamp the fissure so the upper lid covers the iris top."""
    del max_pull
    clusters = eye_clusters(eye_verts)
    if not clusters:
        return 0
    n = 0
    for i in lid_ids:
        if i < 0 or i >= len(body_verts):
            continue
        v = body_verts[i]
        best = None
        best_d = 1e9
        for cl in clusters:
            d = math.dist(v, cl["center"])
            if d < best_d:
                best_d = d
                best = cl
        if best is None or best_d < 1e-8:
            continue
        cx, cy, cz = best["center"]
        dx, dy, dz = v[0] - cx, v[1] - cy, v[2] - cz
        if dy > 0.55 * best["radius"]:
            continue
        r = best["radius"] + clearance
        if best_d > r * 2.4:
            continue
        nx, ny, nz = dx / best_d, dy / best_d, dz / best_d
        if ny < 0.25:
            if nz > upper_nz:
                nz = upper_nz
            elif nz < lower_nz:
                nz = lower_nz
            if ny > -0.20:
                ny = -0.42
            nlen = math.sqrt(nx * nx + ny * ny + nz * nz) or 1.0
            nx, ny, nz = nx / nlen, ny / nlen, nz / nlen
        v[0] = cx + nx * r
        v[1] = cy + ny * r
        v[2] = cz + nz * r
        n += 1
    return n


def _luma_chroma(r, g, b):
    luma = 0.2126 * r + 0.7152 * g + 0.0722 * b
    chroma = max(r, g, b) - min(r, g, b)
    return luma, chroma


def _is_lid_skin(r, g, b):
    luma, chroma = _luma_chroma(r, g, b)
    if luma < 0.40 or luma > 0.82:
        return False
    if chroma < 0.10 or chroma > 0.42:
        return False
    if r < g - 0.02 or g < b - 0.06:
        return False
    if r > g + 0.22 and g < 0.50:
        return False
    return True


def _is_socket_artifact(r, g, b):
    luma, chroma = _luma_chroma(r, g, b)
    white = luma > 0.78 and chroma < 0.16
    iris = chroma > 0.10 and r > g + 0.02 and luma < 0.50
    canthus = r > g + 0.14 and r > b + 0.10 and luma < 0.66
    cyan = b > r + 0.03 and b > g - 0.02 and chroma > 0.07
    socket = luma < 0.52 and chroma > 0.12 and r > g + 0.04
    return white or iris or canthus or cyan or socket


def _paint_inner_socket_islands(px, w, h, skin):
    """MH inner-eye membrane islands → lid skin (not sclera white)."""
    n = 0
    sr, sg, sb = skin
    y0 = int(h * 0.54)
    y1 = int(h * 0.65)
    x1 = int(w * 0.17)
    for y in range(y0, min(h, y1 + 1)):
        for x in range(0, x1 + 1):
            i = (y * w + x) * 4
            r, g, b = px[i], px[i + 1], px[i + 2]
            if _is_socket_artifact(r, g, b) or (r > 0.88 and g > 0.86 and b > 0.84):
                px[i], px[i + 1], px[i + 2] = sr, sg, sb
                n += 1
    return n


def paint_eye_socket_skin(src: Path, dest: Path, uvs, loops, lid_ids, radius_uv=0.042):
    """Replace painted eyeball / canthus / orbital rings on the body albedo with lid skin."""
    img = bpy.data.images.load(str(src), check_existing=True)
    w, h = img.size
    px = list(img.pixels)
    seeds = []
    for loop in loops:
        for vi, ti in loop:
            if vi in lid_ids and 0 <= ti < len(uvs):
                seeds.append(uvs[ti])
    fallback = (0.78, 0.58, 0.47)
    skin = []
    abs_probes = ((0.808, 0.460), (0.800, 0.430), (0.812, 0.410))
    rel_probes = ((0.0, 0.0), (-0.028, 0.0), (-0.040, -0.012), (-0.022, -0.028), (0.012, -0.022), (0.0, -0.045))
    sample_uvs = list(abs_probes)
    for seed in (seeds[:80] if seeds else [(0.83, 0.48)]):
        su, sv = seed[0], seed[1]
        for du, dv in rel_probes:
            sample_uvs.append((min(1.0, max(0.0, su + du)), min(1.0, max(0.0, sv + dv))))
    for uu, vv in sample_uvs:
        x = min(w - 1, max(0, int(round(uu * (w - 1)))))
        y = min(h - 1, max(0, int(round(vv * (h - 1)))))
        i = (y * w + x) * 4
        r, g, b = px[i], px[i + 1], px[i + 2]
        if _is_lid_skin(r, g, b):
            skin.append((r, g, b))
    sr, sg, sb = fallback
    if skin:
        sr = sum(s[0] for s in skin) / len(skin)
        sg = sum(s[1] for s in skin) / len(skin)
        sb = sum(s[2] for s in skin) / len(skin)
    n = 0
    if seeds:
        r2 = radius_uv * radius_uv
        marked = [False] * (w * h)
        rad_px = radius_uv * max(w, h)
        for u, v in seeds:
            cx = u * (w - 1)
            cy = v * (h - 1)
            x0 = max(0, int(cx - rad_px - 1))
            x1 = min(w - 1, int(cx + rad_px + 1))
            y0 = max(0, int(cy - rad_px - 1))
            y1 = min(h - 1, int(cy + rad_px + 1))
            for y in range(y0, y1 + 1):
                for x in range(x0, x1 + 1):
                    du = x / max(w - 1, 1) - u
                    dv = y / max(h - 1, 1) - v
                    if du * du + dv * dv <= r2:
                        marked[y * w + x] = True
        for pi, flag in enumerate(marked):
            if not flag:
                continue
            i = pi * 4
            r, g, b = px[i], px[i + 1], px[i + 2]
            if _is_socket_artifact(r, g, b):
                px[i], px[i + 1], px[i + 2] = sr, sg, sb
                n += 1
    n += _paint_inner_socket_islands(px, w, h, (sr, sg, sb))
    out = bpy.data.images.new(dest.name, w, h, alpha=True)
    out.pixels = px
    out.filepath_raw = str(dest)
    out.file_format = "PNG"
    out.save()
    bpy.data.images.remove(out)
    return {"paintedPixels": n, "seeds": len(seeds), "skinSamples": len(skin)}


def _body_stature_m(body_verts):
    n = min(len(body_verts), mh_io.BODY_VERTS)
    return max(v[2] for v in body_verts[:n])


def inflate_crown_cards(hair_verts, hair_loops, body_verts, amount=0.014):
    """Grow short01 cards on the upper scalp so they overlap. Existing verts only."""
    stature = _body_stature_m(body_verts)
    acc = [[0.0, 0.0, 0.0] for _ in hair_verts]
    cnt = [0] * len(hair_verts)
    z_cut = stature - 0.07
    for loop in hair_loops:
        vs = [hair_verts[c[0]] for c in loop]
        cz = sum(v[2] for v in vs) / len(vs)
        if cz < z_cut:
            continue
        cx = sum(v[0] for v in vs) / len(vs)
        cy = sum(v[1] for v in vs) / len(vs)
        for c in loop:
            v = hair_verts[c[0]]
            dx, dy, dz = v[0] - cx, v[1] - cy, v[2] - cz
            d = math.sqrt(dx * dx + dy * dy + dz * dz) or 1.0
            i = c[0]
            acc[i][0] += dx / d * amount
            acc[i][1] += dy / d * amount
            acc[i][2] += dz / d * amount
            cnt[i] += 1
    n = 0
    for i, k in enumerate(cnt):
        if not k:
            continue
        hair_verts[i][0] += acc[i][0] / k
        hair_verts[i][1] += acc[i][1] / k
        hair_verts[i][2] += acc[i][2] / k
        n += 1
    return n


def flatten_hair_crown(hair_verts, body_verts, pull=0.34, z_band=0.06):
    """Press short01 crown onto a scalp cap. No lift above existing hair."""
    stature = _body_stature_m(body_verts)
    n_body = min(len(body_verts), mh_io.BODY_VERTS)
    high_body = [v for v in body_verts[:n_body] if v[2] >= stature - 0.045]
    if not high_body:
        high_body = body_verts[:n_body]
    cx = sum(v[0] for v in high_body) / len(high_body)
    cy = sum(v[1] for v in high_body) / len(high_body)
    zmax = max(v[2] for v in hair_verts)
    moved = 0
    for v in hair_verts:
        r = math.hypot(v[0] - cx, v[1] - cy)
        t = (v[2] - (zmax - z_band)) / z_band
        if t <= 0.0 and not (r < 0.045 and v[2] > stature - 0.015):
            continue
        t = min(1.0, max(0.0, t))
        if r < 0.045:
            t = 1.0
        v[0] += (cx - v[0]) * pull * t * t
        v[1] += (cy - v[1]) * pull * 0.22 * t * t
        r = math.hypot(v[0] - cx, v[1] - cy)
        z_cap = stature + 0.011 + 0.007 * max(0.0, 1.0 - (r / 0.075) ** 2)
        v[2] = z_cap if t >= 0.999 else v[2] * (1.0 - t) + z_cap * t
        if v[2] > zmax:
            v[2] = zmax
        moved += 1
    return moved


def _delaunay_xy(points):
    n = len(points)
    if n < 3:
        return []
    xs = [p[0] for p in points]
    ys = [p[1] for p in points]
    minx, maxx = min(xs), max(xs)
    miny, maxy = min(ys), max(ys)
    d = max(maxx - minx, maxy - miny, 1e-6) * 8.0
    mx, my = (minx + maxx) * 0.5, (miny + maxy) * 0.5
    pts = list(points) + [(mx - d, my - d), (mx + d, my - d), (mx, my + d)]
    super_ids = {n, n + 1, n + 2}
    tris = [(n, n + 1, n + 2)]

    def circ(i, j, k):
        ax, ay = pts[i]
        bx, by = pts[j]
        cx, cy = pts[k]
        det = 2.0 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by))
        if abs(det) < 1e-16:
            return None
        a2 = ax * ax + ay * ay
        b2 = bx * bx + by * by
        c2 = cx * cx + cy * cy
        ux = (a2 * (by - cy) + b2 * (cy - ay) + c2 * (ay - by)) / det
        uy = (a2 * (cx - bx) + b2 * (ax - cx) + c2 * (bx - ax)) / det
        return ux, uy, (ux - ax) ** 2 + (uy - ay) ** 2

    for p in range(n):
        bad = []
        px, py = pts[p]
        for t in tris:
            c = circ(*t)
            if c is None:
                bad.append(t)
                continue
            ux, uy, r2 = c
            dx, dy = px - ux, py - uy
            if dx * dx + dy * dy <= r2 * 1.0000001:
                bad.append(t)
        bad_set = set(bad)
        edges = []
        for i, j, k in bad:
            edges.extend(((i, j), (j, k), (k, i)))
        tris = [t for t in tris if t not in bad_set]
        cnt = Counter((a, b) if a < b else (b, a) for a, b in edges)
        for (a, b), q in cnt.items():
            if q == 1:
                tris.append((p, a, b))
    out = []
    for i, j, k in tris:
        if i in super_ids or j in super_ids or k in super_ids:
            continue
        out.append((i, j, k))
    return out


def stitch_hair_crown(hair_verts, hair_uvs, hair_loops, body_verts, max_edge=0.058):
    """Fill crown gaps with faces among existing short01 verts. No new verts, no disc."""
    del hair_uvs
    stature = _body_stature_m(body_verts)
    n_body = min(len(body_verts), mh_io.BODY_VERTS)
    high_body = [v for v in body_verts[:n_body] if v[2] >= stature - 0.045]
    cx = sum(v[0] for v in high_body) / len(high_body)
    cy = sum(v[1] for v in high_body) / len(high_body)
    ids = [
        i
        for i, v in enumerate(hair_verts)
        if v[2] >= stature + 0.004 and math.hypot(v[0] - cx, v[1] - cy) < 0.048
    ]
    vert_uv = {}
    existing = set()
    for loop in hair_loops:
        corners = [c[0] for c in loop]
        existing.add(tuple(sorted(corners)))
        for vi, ti in loop:
            if vi not in vert_uv:
                vert_uv[vi] = ti
    if len(ids) < 3:
        zmax = max(v[2] for v in hair_verts)
        return {
            "addedVerts": 0,
            "stitchedFaces": 0,
            "hairZmaxM": zmax,
            "statureM": stature,
            "deltaAboveStatureM": zmax - stature,
        }
    pts = [(hair_verts[i][0], hair_verts[i][1]) for i in ids]
    added = 0
    for a, b, c in _delaunay_xy(pts):
        ia, ib, ic = ids[a], ids[b], ids[c]
        key = tuple(sorted((ia, ib, ic)))
        if key in existing:
            continue
        va, vb, vc = hair_verts[ia], hair_verts[ib], hair_verts[ic]
        e1 = math.dist(va, vb)
        e2 = math.dist(vb, vc)
        e3 = math.dist(vc, va)
        if max(e1, e2, e3) > max_edge:
            continue
        abx, aby = vb[0] - va[0], vb[1] - va[1]
        acx, acy = vc[0] - va[0], vc[1] - va[1]
        if abx * acy - aby * acx < 0.0:
            ib, ic = ic, ib
        ua = vert_uv.get(ia, 0)
        ub = vert_uv.get(ib, 0)
        uc = vert_uv.get(ic, 0)
        hair_loops.append([(ia, ua), (ib, ub), (ic, uc)])
        existing.add(key)
        added += 1
    zmax = max(v[2] for v in hair_verts)
    return {
        "addedVerts": 0,
        "stitchedFaces": added,
        "crownVerts": len(ids),
        "hairZmaxM": zmax,
        "statureM": stature,
        "deltaAboveStatureM": zmax - stature,
        "center": [cx, cy, zmax],
    }


HAIR_FILL_UV = (0.33, 0.68)


def close_hair_crown_gap(hair_verts, hair_uvs, hair_loops, body_verts):
    """Close the short01 crown hole in HumanHair. No second object. z <= existing hair zmax."""
    stature = _body_stature_m(body_verts)
    n_body = min(len(body_verts), mh_io.BODY_VERTS)
    high_body = [v for v in body_verts[:n_body] if v[2] >= stature - 0.05]
    if not high_body:
        high_body = body_verts[:n_body]
    cx = sum(v[0] for v in high_body) / len(high_body)
    cy = sum(v[1] for v in high_body) / len(high_body)
    zmax = max(v[2] for v in hair_verts)
    pulled = 0
    for v in hair_verts:
        r = math.hypot(v[0] - cx, v[1] - cy)
        if r > 0.085 or v[2] < stature - 0.06:
            continue
        target_z = min(zmax, stature + 0.012 + 0.010 * max(0.0, 1.0 - (r / 0.08) ** 2))
        if v[2] < target_z:
            v[2] += (target_z - v[2]) * 0.72
            pulled += 1
        if v[1] > cy - 0.01 and v[2] > stature - 0.04:
            v[1] += (cy - 0.028 - v[1]) * 0.45
            pulled += 1
            if v[2] > zmax:
                v[2] = zmax

    hair_uvs.append([HAIR_FILL_UV[0], HAIR_FILL_UV[1]])
    fill_ti = len(hair_uvs) - 1
    added_ids = []
    front_scalp = [
        v
        for v in body_verts[:n_body]
        if v[2] > stature - 0.04 and abs(v[0] - cx) < 0.07
    ]
    front_y = min((v[1] for v in front_scalp), default=cy - 0.09)
    y0 = front_y - 0.007
    y1 = cy + 0.018
    nx, ny = 13, 11
    grid = [[None] * ny for _ in range(nx)]
    for ix in range(nx):
        tx = ix / (nx - 1)
        x = cx + (tx * 2.0 - 1.0) * 0.058
        for iy in range(ny):
            ty = iy / (ny - 1)
            y = y0 + ty * (y1 - y0)
            # Rise from front hairline over the crown. f_y > 0 ⇒ front-facing normals.
            rise = math.sin(ty * math.pi)
            span = max(0.0, 1.0 - ((x - cx) / 0.062) ** 2)
            z = stature + 0.005 + 0.024 * rise * span
            if z > zmax:
                z = zmax
            hair_verts.append([x, y, z])
            vi = len(hair_verts) - 1
            added_ids.append(vi)
            grid[ix][iy] = vi

    existing = set()
    for loop in hair_loops:
        existing.add(tuple(sorted(c[0] for c in loop)))
    added_faces = 0
    for ix in range(nx - 1):
        for iy in range(ny - 1):
            a = grid[ix][iy]
            b = grid[ix + 1][iy]
            c = grid[ix + 1][iy + 1]
            d = grid[ix][iy + 1]
            for tri in ((a, b, c), (a, c, d)):
                key = tuple(sorted(tri))
                if key in existing:
                    continue
                ia, ib, ic = tri
                hair_loops.append([(ia, fill_ti), (ib, fill_ti), (ic, fill_ti)])
                existing.add(key)
                added_faces += 1

    zmax2 = max(v[2] for v in hair_verts)
    if zmax2 > zmax:
        for v in hair_verts:
            if v[2] > zmax:
                v[2] = zmax
        zmax2 = zmax
    return {
        "addedVerts": len(added_ids),
        "stitchedFaces": added_faces,
        "pulledVerts": pulled,
        "crownVerts": len(added_ids),
        "hairZmaxM": zmax2,
        "statureM": stature,
        "deltaAboveStatureM": zmax2 - stature,
        "center": [cx, cy, zmax2],
    }


def load_fitted_proxy(src: Path, mh_verts, clo_name, obj_name):
    clo = mh_io.load_mhclo(src / clo_name)
    obj_verts, uvs, faces = mh_io.load_obj(src / obj_name)
    fitted = mh_io.fit_proxy(mh_verts, clo)
    if len(fitted) != len(obj_verts):
        raise RuntimeError(f"{clo_name} mappings {len(fitted)} != obj verts {len(obj_verts)}")
    return fitted, uvs, mh_io.obj_loops(faces)


def weight_all(mesh_obj, bone_name):
    vg = mesh_obj.vertex_groups.new(name=bone_name)
    vg.add(list(range(len(mesh_obj.data.vertices))), 1.0, "REPLACE")


def weight_by_x_sign(mesh_obj, plus_bone, minus_bone):
    g_plus = mesh_obj.vertex_groups.new(name=plus_bone)
    g_minus = mesh_obj.vertex_groups.new(name=minus_bone)
    for v in mesh_obj.data.vertices:
        if v.co.x >= 0.0:
            g_plus.add([v.index], 1.0, "REPLACE")
        else:
            g_minus.add([v.index], 1.0, "REPLACE")


def align_pose_bone(arm, name, target_arm_space):
    pb = arm.pose.bones.get(name)
    if pb is None:
        return
    bpy.context.view_layer.update()
    current = pb.vector.normalized()
    target = Vector(target_arm_space).normalized()
    if current.length < 1e-8 or target.length < 1e-8:
        return
    if current.dot(target) > 0.999999:
        return
    q = current.rotation_difference(target)
    head = pb.head.copy()
    mat = (q.to_matrix() @ pb.matrix.to_3x3()).to_4x4()
    mat.translation = head
    pb.matrix = mat
    bpy.context.view_layer.update()


def apply_human_rest_pose(arm, abduction_deg=45.0, elbow_flex_deg=7.0):
    """A-pose 45° abduction, slight elbow flex, wrists along forearm, head +Z."""
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode="POSE")
    abd = math.radians(abduction_deg)
    flex = math.radians(elbow_flex_deg)
    left_arm = Vector((math.sin(abd), 0.0, -math.cos(abd)))
    right_arm = Vector((-math.sin(abd), 0.0, -math.cos(abd)))
    align_pose_bone(arm, "LeftArm", left_arm)
    align_pose_bone(arm, "RightArm", right_arm)
    align_pose_bone(arm, "upperarm02.L", left_arm)
    align_pose_bone(arm, "upperarm02.R", right_arm)

    def flex_dir(upper, sign):
        axis = upper.cross(Vector((0.0, -1.0, 0.0)))
        if axis.length < 1e-5:
            axis = Vector((0.0, 1.0, 0.0))
        axis.normalize()
        return Quaternion(axis, flex) @ upper

    left_fore = flex_dir(left_arm, 1)
    right_fore = flex_dir(right_arm, -1)
    align_pose_bone(arm, "LeftForeArm", left_fore)
    align_pose_bone(arm, "RightForeArm", right_fore)
    align_pose_bone(arm, "lowerarm02.L", left_fore)
    align_pose_bone(arm, "lowerarm02.R", right_fore)
    align_pose_bone(arm, "LeftHand", left_fore)
    align_pose_bone(arm, "RightHand", right_fore)
    align_pose_bone(arm, "Head", Vector((0.0, 0.0, 1.0)))
    align_pose_bone(arm, "Neck", Vector((0.0, 0.0, 1.0)))
    bpy.ops.object.mode_set(mode="OBJECT")


def bake_pose_as_rest(arm, mesh_objs):
    bpy.context.view_layer.update()
    for obj in mesh_objs:
        if obj is None:
            continue
        obj.hide_viewport = False
        obj.hide_render = False
    bpy.context.view_layer.update()
    for obj in mesh_objs:
        if obj is None:
            continue
        bpy.ops.object.select_all(action="DESELECT")
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        for mod in list(obj.modifiers):
            if mod.type == "ARMATURE":
                bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.ops.object.select_all(action="DESELECT")
    arm.select_set(True)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode="POSE")
    bpy.ops.pose.select_all(action="SELECT")
    bpy.ops.pose.armature_apply()
    bpy.ops.object.mode_set(mode="OBJECT")
    for obj in mesh_objs:
        if obj is None:
            continue
        parent_armature(obj, arm)


def rest_pose_from_arm(arm):
    bpy.context.view_layer.update()

    def aim(name, other=None):
        a = arm.data.bones.get(name)
        if a is None:
            return None
        head = arm.matrix_world @ a.head_local
        if other:
            b = arm.data.bones.get(other)
            if b is None:
                return None
            tail = arm.matrix_world @ b.head_local
        else:
            tail = arm.matrix_world @ a.tail_local
        v = (tail - head).normalized()
        return v

    def ang(a, b):
        if a is None or b is None:
            return None
        return math.degrees(a.angle(b))

    down = Vector((0.0, 0.0, -1.0))
    up = Vector((0.0, 0.0, 1.0))
    la = aim("LeftArm", "LeftForeArm")
    lf = aim("LeftForeArm", "LeftHand")
    lh = aim("LeftHand")
    hd = aim("Head")
    elbow = None
    if la is not None and lf is not None:
        elbow = math.degrees(la.angle(lf))
    return {
        "abductionDeg": ang(la, down),
        "elbowFlexDeg": elbow,
        "wristAimDeg": ang(lf, lh),
        "headPitchDeg": ang(hd, up),
    }


def clear_pose(arm):
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode="POSE")
    for b in arm.pose.bones:
        b.rotation_mode = "XYZ"
        b.rotation_euler = (0, 0, 0)
        b.rotation_quaternion = (1, 0, 0, 0)
        b.location = (0, 0, 0)
        b.scale = (1, 1, 1)
    bpy.ops.object.mode_set(mode="OBJECT")


def export_glb(glb_path: Path, keep_names, copyright):
    glb_path.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.object.select_all(action="DESELECT")
    for obj in bpy.context.scene.objects:
        obj.select_set(obj.name in keep_names)
        obj.hide_render = obj.name not in keep_names
        obj.hide_viewport = False
    bpy.ops.export_scene.gltf(
        filepath=str(glb_path),
        export_format="GLB",
        use_selection=True,
        export_yup=True,
        export_apply=True,
        export_skins=True,
        export_all_influences=False,
        export_influence_nb=4,
        export_animations=False,
        export_morph=False,
        export_cameras=False,
        export_lights=False,
        export_extras=False,
        export_rest_position_armature=True,
        export_texcoords=True,
        export_normals=True,
        export_materials="EXPORT",
        export_image_format="AUTO",
        export_copyright=copyright,
    )


def _restore_visibility(body, shorts, body_full):
    set_hide(body, False)
    set_hide(shorts, False)
    set_hide(body_full, True)
    for obj in bpy.context.scene.objects:
        if obj.type in {"ARMATURE", "MESH"} and obj not in (body_full,):
            if obj.name.endswith("BodyFullW"):
                continue
            obj.hide_render = False
            obj.hide_viewport = False


def maybe_render_lineup(cam, evid, current_prefix):
    """Same-scale Human/Orc/Undead front. Does not edit Human source files."""
    repo = evid.parents[2]
    human_glb = repo / "public/characters/bodies/human-v1.glb"
    orc_glb = repo / "public/characters/bodies/orc-v1.glb"
    undead_glb = repo / "public/characters/bodies/undead-v1.glb"
    if not (human_glb.exists() and orc_glb.exists() and undead_glb.exists()):
        return None
    imported = []

    def load(path, x):
        preexisting = set(bpy.data.objects)
        bpy.ops.import_scene.gltf(filepath=str(path))
        new = [o for o in bpy.data.objects if o not in preexisting]
        roots = [o for o in new if o.parent is None or o.parent not in new]
        for o in roots:
            o.location.x += x
        for o in new:
            imported.append(o)
            if o.type == "MESH":
                o.hide_render = False
                o.hide_viewport = False

    for obj in list(bpy.data.objects):
        if obj.type in {"MESH", "ARMATURE"} and obj.name.startswith(current_prefix):
            obj.hide_render = True
            obj.hide_viewport = True
    load(human_glb, -1.35)
    load(orc_glb, 0.0)
    load(undead_glb, 1.25)
    bpy.context.view_layer.update()
    zs = []
    xs = []
    for o in imported:
        if o.type != "MESH" or "Body" not in o.name:
            continue
        for v in o.data.vertices:
            w = o.matrix_world @ v.co
            zs.append(w.z)
            xs.append(w.x)
    if not zs:
        return None
    height = max(zs) - min(zs)
    mid = Vector(((min(xs) + max(xs)) * 0.5, 0.0, (min(zs) + max(zs)) * 0.5))
    scene = bpy.context.scene
    scene.render.resolution_x = LINEUP_RES[0]
    scene.render.resolution_y = LINEUP_RES[1]
    # Landscape AUTO: sensor_width is horizontal. Size distance from height with vertical FOV.
    sensor_v = 36.0 * LINEUP_RES[1] / LINEUP_RES[0]
    dist_h = height / (2.0 * 0.82 * ((sensor_v * 0.5) / AUTHOR_LENS_MM))
    span = max(xs) - min(xs)
    dist_w = span / (2.0 * 0.92 * (18.0 / AUTHOR_LENS_MM))
    dist = max(dist_h, dist_w)
    look_at(cam, tuple(mid), (mid.x, mid.y - dist, mid.z))
    out = evid.parent / "authoring-scale-lineup.png"
    render(out)
    scene.render.resolution_x = AUTHOR_RES[0]
    scene.render.resolution_y = AUTHOR_RES[1]
    for o in list(imported):
        bpy.data.objects.remove(o, do_unlink=True)
    return str(out)


def _apply_cloud_deform(fn, body_verts, clouds, bones, **kwargs):
    info = fn(body_verts, bones, **kwargs)
    for cloud in clouds:
        fn(cloud, bones, **kwargs)
    return info


def run_race(cfg):
    """cfg: prefix, blend, glb, evid, report, targets, hunch, neck_forward_deg,
    target_height_m, lateral_x_scale, albedo_hsv, hair_rgb, hair_inflate, eye_hsv,
    tex, copyright, source_note. skin_rgb is ignored (CC0 albedo + HSV shift)."""
    reset_empty()
    src = cfg["src"]
    verts_mh, uvs, faces = mh_race.deform_mh(src, cfg["targets"])
    eye_mh, eye_uvs, eye_loops = load_fitted_proxy(src, verts_mh, "low-poly.mhclo", "low-poly.obj")
    hair_mh, hair_uvs, hair_loops = load_fitted_proxy(src, verts_mh, "short01.mhclo", "short01.obj")
    brow_mh, brow_uvs, brow_loops = load_fitted_proxy(src, verts_mh, "eyebrow001.mhclo", "eyebrow001.obj")
    body_bl, zmin = mh_io.mh_coords_to_blender(verts_mh)
    eye_bl, _ = mh_io.mh_coords_to_blender(eye_mh, zmin=zmin)
    hair_bl, _ = mh_io.mh_coords_to_blender(hair_mh, zmin=zmin)
    brow_bl, _ = mh_io.mh_coords_to_blender(brow_mh, zmin=zmin)
    skel = mh_io.load_skel(src / "default.mhskel")
    proxies = (eye_bl, hair_bl, brow_bl)
    hunch_info = neck_info = height_info = lateral_info = None
    if cfg.get("hunch"):
        bones = mh_io.bones_world(skel, body_bl)
        hunch_info = _apply_cloud_deform(
            mh_race.apply_hunch_from_joint, body_bl, proxies, bones, **cfg["hunch"]
        )
    if cfg.get("neck_forward_deg"):
        bones = mh_io.bones_world(skel, body_bl)
        neck_info = _apply_cloud_deform(
            mh_race.apply_neck_forward, body_bl, proxies, bones, deg=cfg["neck_forward_deg"]
        )
    if cfg.get("target_height_m"):
        height_info = mh_race.normalize_standing_height(body_bl, cfg["target_height_m"])
        for cloud in proxies:
            mh_race.scale_vert_cloud(cloud, height_info["uniformScale"])
    lat = cfg.get("lateral_x_scale")
    if lat and abs(lat - 1.0) > 1e-9:
        lateral_info = mh_race.flare_lateral_x(body_bl, lat)
        for cloud in proxies:
            mh_race.flare_lateral_x(cloud, lat)
    height_m = cfg.get("target_height_m") or (
        max(v[2] for v in body_bl[: mh_io.BODY_VERTS]) - min(v[2] for v in body_bl[: mh_io.BODY_VERTS])
    )
    eye_push = 0.004 * (height_m / mh_race.HUMAN_HEIGHT_M)
    for v in eye_bl:
        v[1] -= eye_push
    hair_bl = inflate(hair_bl, cfg.get("hair_inflate", 0.018))
    brow_bl = inflate(brow_bl, 0.002)
    bverts, uvs, loops = mh_io.body_mesh(body_bl, uvs, faces)
    bones = mh_io.bones_world(skel, body_bl)
    built = {
        "hunch": hunch_info,
        "neckForward": neck_info,
        "heightNormalize": height_info,
        "lateralX": lateral_info,
    }
    full_w, helper_entries, zero_ids = mh_io.load_weights_full(src / "default_weights.mhw", mh_io.BONE_RENAME)
    if zero_ids:
        raise RuntimeError(f"body verts with no source weight: count={len(zero_ids)} ids={zero_ids[:32]}")
    parents = mh_io.parent_map(bones)

    prefix = cfg["prefix"]
    arm = build_armature(bones, f"{prefix}Rig", prefix)
    rest_mats = rest_bone_matrices(arm, bones)
    pose_mats_by_pose = {}
    for pose_name, spec in mh_race.SKIN_POSES:
        clear_pose(arm)
        if spec:
            pose_bones(arm, spec)
        pose_mats_by_pose[pose_name] = posed_bone_matrices(arm, bones)
    clear_pose(arm)

    limited, red_stats = mh_race.reduce_weights_pose_aware(
        full_w, parents, rest_mats, pose_mats_by_pose, bverts, max_influences=4
    )
    keep_shorts = mh_race.shorts_face_indices(loops, full_w, bverts, bones)
    shorts_stats = mh_race.shorts_topology_stats(loops, keep_shorts)
    face_leg = mh_race.shorts_face_leg(loops, bverts, keep_shorts)
    bisect_planes = mh_race.shorts_bisect_planes(bones)

    tex = Path(cfg["tex"]) if cfg.get("tex") else cfg["glb"].parent / f"{cfg['glb'].stem}-textures"
    tex.mkdir(parents=True, exist_ok=True)
    src_albedo = src / "young_lightskinned_male_diffuse.png"
    albedo = tex / "albedo.png"
    hsv = cfg.get("albedo_hsv") or {}
    write_albedo_hsv_shift(
        src_albedo,
        albedo,
        hue_deg=hsv.get("hue_deg", 0.0),
        sat_scale=hsv.get("sat_scale", 1.0),
        val_scale=hsv.get("val_scale", 1.0),
    )
    normal_path = tex / "normal.png"
    rough_path = tex / "roughness.png"
    write_skin_aux_maps(albedo, normal_path, rough_path)
    hair_tex = tex / "hair.png"
    write_hair_albedo(src / "short01_diffuse.png", hair_tex, cfg.get("hair_rgb", (0.62, 0.38, 0.16)))
    eye_tex = tex / "eye.png"
    eye_hsv = cfg.get("eye_hsv") or {}
    write_eye_albedo(
        src / "brown_eye.png",
        eye_tex,
        hue_deg=eye_hsv.get("hue_deg", 0.0),
        sat_scale=eye_hsv.get("sat_scale", 1.0),
        val_scale=eye_hsv.get("val_scale", 1.0),
    )
    (tex / "brown_eye.png").write_bytes((src / "brown_eye.png").read_bytes())
    (tex / "eyebrow.png").write_bytes((src / "eyebrow001.png").read_bytes())

    body = build_mesh(f"{prefix}Body", bverts, uvs, loops)
    skin = mat_pbr(
        f"{prefix}Skin",
        albedo_path=albedo,
        normal_path=normal_path,
        roughness_path=rough_path,
        color=(1.0, 1.0, 1.0),
        rough=0.5,
    )
    body.data.materials.append(skin)
    shorts_mat = mat_clay("ReviewShorts", mh_garment.REVIEW_SHORTS_RGB, mh_garment.REVIEW_SHORTS_ROUGH)
    assign_weights(body, limited)
    bpy.ops.object.select_all(action="DESELECT")
    body.select_set(True)
    bpy.context.view_layer.objects.active = body
    bpy.ops.object.duplicate()
    body_full = bpy.context.active_object
    body_full.name = f"{prefix}BodyFullW"
    if any(m.type == "ARMATURE" for m in body_full.modifiers):
        raise RuntimeError("full-weight duplicate inherited an armature modifier")
    body_full.vertex_groups.clear()
    assign_weights(body_full, [[(n, w) for n, w in infl.items()] for infl in full_w])
    height = max(v[2] for v in bverts) - min(v[2] for v in bverts)
    shorts, shorts_boundary = mh_garment.make_shorts(
        body,
        keep_shorts,
        f"{prefix}Shorts",
        face_leg,
        offset=0.012 * (height / mh_race.HUMAN_HEIGHT_M),
        planes=bisect_planes,
    )
    if shorts:
        shorts.data.materials.clear()
        shorts.data.materials.append(shorts_mat)
        parent_armature(shorts, arm)
    eyes = build_mesh(f"{prefix}Eyes", eye_bl, eye_uvs, eye_loops)
    hair = build_mesh(f"{prefix}Hair", hair_bl, hair_uvs, hair_loops)
    brows = build_mesh(f"{prefix}Brows", brow_bl, brow_uvs, brow_loops)
    normals_outward(eyes)
    normals_outward(hair)
    eyes.data.materials.append(
        mat_pbr(
            f"{prefix}Eyes",
            albedo_path=eye_tex,
            color=(1, 1, 1),
            rough=0.22,
            specular=0.55,
            double_sided=True,
        )
    )
    hair.data.materials.append(
        mat_pbr(
            f"{prefix}Hair",
            albedo_path=hair_tex,
            color=(1, 1, 1),
            rough=0.45,
            specular=0.25,
            double_sided=True,
        )
    )
    brows.data.materials.append(
        mat_pbr(
            f"{prefix}Brows",
            albedo_path=src / "eyebrow001.png",
            color=(0.12, 0.07, 0.04),
            rough=0.55,
            alpha_clip=0.12,
        )
    )
    weight_by_x_sign(eyes, "eye.L", "eye.R")
    weight_all(hair, "Head")
    weight_all(brows, "Head")
    parent_armature(body, arm)
    parent_armature(body_full, arm)
    parent_armature(eyes, arm)
    parent_armature(hair, arm)
    parent_armature(brows, arm)
    body_full.hide_render = True
    body_full.hide_viewport = True
    apply_identity(body)
    apply_identity(body_full)
    if shorts:
        apply_identity(shorts)
    apply_identity(eyes)
    apply_identity(hair)
    apply_identity(brows)
    for mesh in (body, body_full, shorts, eyes, hair, brows):
        if mesh is None:
            continue
        shade_body_smooth(mesh.data)

    cam = setup_view()
    evid = cfg["evid"]
    evid.mkdir(parents=True, exist_ok=True)

    # Review clothes on
    set_hide(shorts, False)
    for name, view in (
        ("authoring-front.png", "front"),
        ("authoring-back.png", "back"),
        ("authoring-side.png", "side"),
        ("authoring-three-quarter.png", "three_quarter"),
    ):
        frame_full_figure(cam, body, view)
        render(evid / name)

    # Anatomy diagnosis: shorts hidden
    set_hide(shorts, True)
    frame_full_figure(cam, body, "front")
    render(evid / "authoring-anatomy-front.png")
    frame_full_figure(cam, body, "side")
    render(evid / "authoring-anatomy-side.png")
    set_hide(shorts, False)

    skin_by_pose = {}
    body_full.hide_viewport = False
    body_full.hide_render = True
    for pose_name, spec in mh_race.SKIN_POSES:
        clear_pose(arm)
        if spec:
            pose_bones(arm, spec)
        skin_by_pose[pose_name] = compare_skin(body_full, body, full_w)
        skin_by_pose[pose_name]["pose"] = pose_name
        if pose_name == "stress_combo":
            frame_full_figure(cam, body, "three_quarter", fill=0.78)
            render(evid / "authoring-deform-elbow-knee-arm.png")
            hand = bone_world(arm, "RightHand") or Vector((0.4, -0.05, 1.2))
            frame_point(cam, (hand.x, hand.y, hand.z), 0.55)
            render(evid / "authoring-deform-arm-close.png")
        if pose_name == "bent_elbow":
            frame_full_figure(cam, body, "three_quarter", fill=0.78)
            render(evid / "authoring-deform-bent-elbow.png")
        if pose_name == "bent_knee":
            frame_full_figure(cam, body, "side", fill=0.78)
            render(evid / "authoring-deform-bent-knee.png")
        if pose_name == "raised_arm":
            frame_full_figure(cam, body, "front", fill=0.78)
            render(evid / "authoring-deform-raised-arm.png")
            # Step 0 diagnosis: same camera, full-weight body vs reduced-weight body.
            shoulder_pt = bone_world(arm, "RightArm") or Vector((-0.2, -0.02, height * 0.8))
            frame_point(
                cam,
                (shoulder_pt.x, shoulder_pt.y - 0.02, shoulder_pt.z + 0.01),
                height * 0.20,
            )
            render(evid / "authoring-deform-shoulder-reduced.png")
            body.hide_render = True
            body_full.hide_render = False
            render(evid / "authoring-deform-shoulder-full.png")
            body.hide_render = False
            body_full.hide_render = True
        if pose_name == "head_turn":
            head = bone_world(arm, "Head") or Vector((0, 0, height * 0.92))
            frame_point(cam, (head.x, head.y, head.z), 0.55)
            render(evid / "authoring-deform-head-turn.png")
    body_full.hide_viewport = True
    clear_pose(arm)

    head = bone_world(arm, "Head") or Vector((0, 0, height * 0.92))
    frame_point(cam, (head.x, head.y - 0.04, head.z + 0.02), 0.42)
    render(evid / "authoring-face.png")
    lfoot = bone_world(arm, "LeftFoot") or Vector((0.1, 0, 0.05))
    rfoot = bone_world(arm, "RightFoot") or Vector((-0.1, 0, 0.05))
    feet = ((lfoot + rfoot) * 0.5) if lfoot and rfoot else Vector((0, 0, 0.05))
    frame_point(cam, (feet.x, feet.y, 0.06), 0.55)
    render(evid / "authoring-feet.png")
    hand = bone_world(arm, "LeftHand") or Vector((0.45, -0.05, 0.9))
    mid = bone_world(arm, "finger3-3.L", "tail")
    aim = hand if mid is None else (hand + mid) * 0.5
    frame_point(cam, (aim.x, aim.y, aim.z), 0.28)
    render(evid / "authoring-hand.png")

    keep = {prefix, f"{prefix}Body", f"{prefix}Shorts", f"{prefix}Eyes", f"{prefix}Hair", f"{prefix}Brows"}
    export_glb(cfg["glb"], keep, cfg["copyright"])
    lineup = maybe_render_lineup(cam, evid, prefix)
    # restore current race for blend save
    for obj in bpy.data.objects:
        if obj.name.startswith(prefix):
            obj.hide_render = obj.name.endswith("BodyFullW")
            obj.hide_viewport = obj.name.endswith("BodyFullW")
    cfg["blend"].parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(cfg["blend"]))

    m = mh_race.metrics(bverts, bones)
    human_m = mh_race.human_v2_reference_metrics(src)
    m["normalizedVsHuman"] = mh_race.ratios_vs_human(m, human_m)
    ref_keys = (
        "heightM",
        "shoulderWidthM",
        "handLengthM",
        "palmWidthM",
        "upperArmM",
        "foreArmM",
        "thighM",
        "shinM",
        "upperArmRadiusM",
        "thighRadiusM",
        "limbThicknessM",
        "neckForwardDeg",
    )
    m["humanReferenceM"] = {k: human_m.get(k) for k in ref_keys}
    region_counts = {}
    for vi in red_stats["affectedVertexIds"]:
        r = mh_race.region_of_weights(full_w[vi])
        region_counts[r] = region_counts.get(r, 0) + 1
    red_stats_out = {k: v for k, v in red_stats.items() if k != "affectedVertexIds"}
    red_stats_out["affectedVertexIdsSample"] = red_stats["affectedVertexIds"][:24]
    red_stats_out["affectedRegions"] = region_counts
    red_stats_out["regionRule"] = "dominant semantic bone from default_weights.mhw, not world-Z bins"
    worst_combo = skin_by_pose.get("stress_combo", {})
    report = {
        "bodyVerts": len(bverts),
        "bodyQuads": len(loops),
        "jointsAuthored": len(bones),
        "maxDiscardedInfluence": red_stats["maxDiscardedInfluence"],
        "zeroWeightAssignedToHips": False,
        "zeroWeightBodyVertexCount": 0,
        "helperWeightEntriesOmitted": helper_entries,
        "weightReduction": red_stats_out,
        "skinCompareFullVs4ByPose": skin_by_pose,
        "skinCompareStressFullVs4": worst_combo,
        "skinCompareNote": (
            "max/p95 are full-weight vs 4-influence on matching rest coordinates. "
            "Global p95 near zero does not imply local deformation quality."
        ),
        "shorts": {
            "method": (
                "mh_garment.make_shorts: hm08 pelvis/thigh + 5-ring grow; waist/hem bisect "
                "on mh_race.shorts_bisect_planes; front waist tab dissolve; "
                "outward offset 8-14 mm (in-plane at openings), no cloth-sim; warm grey"
            ),
            **shorts_stats,
            "bisectPlanes": bisect_planes,
            "boundaryLoops": shorts_boundary,
            "boundaryLoopCount": len(shorts_boundary),
            "maxAbsPlaneDistanceM": (
                max((b["maxAbsPlaneDistanceM"] for b in shorts_boundary), default=None)
            ),
            "diagnosticOnly": True,
        },
        "proxies": {
            "eyes": {"verts": len(eye_bl), "bones": ["eye.L", "eye.R"]},
            "hair": {"verts": len(hair_bl), "bone": "Head", "inflateM": cfg.get("hair_inflate", 0.018)},
            "eyebrows": {"verts": len(brow_bl), "bone": "Head"},
        },
        "textures": {
            "albedo": str(albedo),
            "normal": str(normal_path),
            "roughness": str(rough_path),
            "hair": str(hair_tex),
            "eye": str(eye_tex),
        },
        "albedoHsv": hsv,
        "shading": "polygon.use_smooth=True; CC0 albedo HSV-shifted + sobel normal + zoned roughness; opaque hair; brown_eye doubleSided",
        "morphs": [],
        "runtimeClips": [],
        "forward": "Blender -Y / glTF +Z",
        "up": "Blender +Z / glTF +Y",
        "units": "meters",
        "source": cfg["source_note"],
        "targets": [{"path": str(p.name), "weight": w} for p, w in cfg["targets"]],
        "hunch": built["hunch"],
        "neckForward": built["neckForward"],
        "lateralX": built["lateralX"],
        "heightNormalize": built["heightNormalize"],
        "lineupImage": lineup,
        "evidenceLabel": "Blender authoring stills, not live game",
        **m,
    }
    cfg["report"].parent.mkdir(parents=True, exist_ok=True)
    cfg["report"].write_text(json.dumps(report, indent=2))
    print("BUILD_OK", json.dumps(report))
    return report
