"""Build a 1.79 m hooded mage (Z-up, facing -Y) and export public/hero.glb.

Meant to run in a clean Blender file so the moonwell shrine is not touched.
Hood is an open cavity (not a closed bulb). Cloak is an open draped sheet
with fold mass and a tattered hem (not a lathe cone). Staff is in +X (right
hand). Cloth uses wool_grey; emission lives on the flame only.
"""
import math
import os
import random

import bmesh
import bpy
from mathutils import Matrix, Vector, noise

ROOT = "/Users/antbly/dev/wow-clone/lite-moonwell"
TEX = os.path.join(ROOT, "public", "tex")
EXPORT = os.path.join(ROOT, "public", "hero.glb")
BLEND = os.path.join(ROOT, "blender", "hero.blend")
HEIGHT = 1.79
rng = random.Random(11)

SHRINE_MARKERS = {"MoonSun", "Ground", "LanternA_L", "WellGlow", "Basin"}


def n3(x, y, z):
    return float(noise.noise(Vector((x, y, z))))


def load_image(path, non_color=False):
    if not path or not os.path.exists(path):
        return None
    img = bpy.data.images.load(path, check_existing=True)
    if non_color:
        img.colorspace_settings.name = "Non-Color"
    return img


def link(nt, a, b):
    nt.links.new(a, b)


def make_pbr(
    name,
    folder,
    *,
    uv_scale=(3.0, 3.0, 1.0),
    metallic=0.0,
    tint=(1, 1, 1),
    emission=None,
    emission_strength=0.0,
    roughness_boost=0.15,
    normal_strength=1.15,
    roughness=None,
):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    out.location = (720, 0)
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.location = (420, 0)
    link(nt, bsdf.outputs["BSDF"], out.inputs["Surface"])
    if "Metallic" in bsdf.inputs:
        bsdf.inputs["Metallic"].default_value = metallic
    if roughness is not None:
        bsdf.inputs["Roughness"].default_value = roughness

    texc = nt.nodes.new("ShaderNodeTexCoord")
    mapping = nt.nodes.new("ShaderNodeMapping")
    mapping.inputs["Scale"].default_value = uv_scale
    link(nt, texc.outputs["UV"], mapping.inputs["Vector"])

    def img_node(filename, non_color, y):
        img = load_image(os.path.join(TEX, folder, filename), non_color=non_color)
        if not img:
            return None
        node = nt.nodes.new("ShaderNodeTexImage")
        node.location = (-280, y)
        node.image = img
        if non_color:
            node.image.colorspace_settings.name = "Non-Color"
        link(nt, mapping.outputs["Vector"], node.inputs["Vector"])
        return node

    diff = img_node("diff.jpg", False, 280)
    if diff:
        mix = nt.nodes.new("ShaderNodeMix")
        mix.data_type = "RGBA"
        mix.blend_type = "MULTIPLY"
        mix.inputs["Factor"].default_value = 1.0
        mix.inputs["B"].default_value = (*tint, 1)
        link(nt, diff.outputs["Color"], mix.inputs["A"])
        color_out = mix.outputs["Result"]
        ao = img_node("ao.jpg", True, 80)
        if ao:
            mix2 = nt.nodes.new("ShaderNodeMix")
            mix2.data_type = "RGBA"
            mix2.blend_type = "MULTIPLY"
            mix2.inputs["Factor"].default_value = 0.55
            link(nt, color_out, mix2.inputs["A"])
            link(nt, ao.outputs["Color"], mix2.inputs["B"])
            color_out = mix2.outputs["Result"]
        link(nt, color_out, bsdf.inputs["Base Color"])
    else:
        bsdf.inputs["Base Color"].default_value = (*tint, 1)

    rough = img_node("rough.jpg", True, -80)
    if rough:
        add = nt.nodes.new("ShaderNodeMath")
        add.operation = "ADD"
        add.inputs[1].default_value = roughness_boost
        link(nt, rough.outputs["Color"], add.inputs[0])
        link(nt, add.outputs["Value"], bsdf.inputs["Roughness"])

    nor = img_node("nor.jpg", True, -400)
    if nor:
        nmap = nt.nodes.new("ShaderNodeNormalMap")
        nmap.inputs["Strength"].default_value = normal_strength
        link(nt, nor.outputs["Color"], nmap.inputs["Color"])
        link(nt, nmap.outputs["Normal"], bsdf.inputs["Normal"])

    metal = img_node("metal.jpg", True, -240)
    if metal and "Metallic" in bsdf.inputs:
        link(nt, metal.outputs["Color"], bsdf.inputs["Metallic"])

    if emission is not None:
        if "Emission Color" in bsdf.inputs:
            bsdf.inputs["Emission Color"].default_value = (*emission, 1)
            bsdf.inputs["Emission Strength"].default_value = emission_strength
        elif "Emission" in bsdf.inputs:
            bsdf.inputs["Emission"].default_value = (*emission, 1)
    return mat


def solid_mat(name, color, *, metallic=0.0, roughness=0.55, emission=None, emission_strength=0.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1)
    if "Metallic" in bsdf.inputs:
        bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    if emission is not None and "Emission Color" in bsdf.inputs:
        bsdf.inputs["Emission Color"].default_value = (*emission, 1)
        bsdf.inputs["Emission Strength"].default_value = emission_strength
    return mat


def shade_smooth(obj):
    for poly in obj.data.polygons:
        poly.use_smooth = True


def object_from_bmesh(name, bm, mat, smooth=True):
    try:
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    except Exception:
        pass
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    if mat:
        obj.data.materials.append(mat)
    if smooth:
        shade_smooth(obj)
    obj.location = (0.0, 0.0, 0.0)
    return obj


def uv_unwrap(obj):
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    if bpy.ops.object.mode_set.poll():
        bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    try:
        bpy.ops.uv.smart_project(angle_limit=66.0, island_margin=0.03)
    except Exception:
        bpy.ops.uv.unwrap(method="ANGLE_BASED", margin=0.03)
    bpy.ops.object.mode_set(mode="OBJECT")
    obj.select_set(False)


def apply_mods(obj):
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    for mod in list(obj.modifiers):
        try:
            bpy.ops.object.modifier_apply(modifier=mod.name)
        except Exception as exc:
            print("mod skip", obj.name, mod.name, exc)
    obj.select_set(False)


def solidify(obj, thickness=0.012, offset=-1.0, inner_mat=None):
    if inner_mat:
        if inner_mat.name not in [m.name for m in obj.data.materials]:
            obj.data.materials.append(inner_mat)
    mod = obj.modifiers.new("Solidify", "SOLIDIFY")
    mod.thickness = thickness
    mod.offset = offset
    mod.use_even_offset = True
    mod.use_quality_normals = True
    mod.use_rim = True
    if inner_mat and len(obj.data.materials) > 1:
        mod.material_offset = 1
        if hasattr(mod, "rim_material_offset"):
            mod.rim_material_offset = 1
    apply_mods(obj)


def displace_clouds(obj, strength=0.012, scale=0.55, name="ClothDisp"):
    tex = bpy.data.textures.new(name + obj.name, "CLOUDS")
    tex.noise_scale = scale
    tex.noise_depth = 2
    mod = obj.modifiers.new(name, "DISPLACE")
    mod.texture = tex
    mod.strength = strength
    mod.mid_level = 0.5
    apply_mods(obj)


def bezier3(t, p0, p1, p2, p3):
    u = 1.0 - t
    return (u * u * u) * p0 + (3 * u * u * t) * p1 + (3 * u * t * t) * p2 + (t * t * t) * p3


def ring_basis(tangent, side_hint=None):
    t = Vector(tangent)
    if t.length < 1e-8:
        t = Vector((0.0, 1.0, 0.0))
    t.normalize()
    side = Vector(side_hint) if side_hint is not None else Vector((1.0, 0.0, 0.0))
    side = side - t * side.dot(t)
    if side.length < 1e-6:
        side = Vector((0.0, 0.0, 1.0))
        side = side - t * side.dot(t)
    side.normalize()
    up = side.cross(t)
    if up.length < 1e-6:
        up = Vector((0.0, 0.0, 1.0))
    else:
        up.normalize()
    return side, up


def path_frames(centers):
    frames = []
    side = Vector((1.0, 0.0, 0.0))
    n = len(centers)
    for i, c in enumerate(centers):
        if i == 0:
            tan = centers[1] - centers[0]
        elif i == n - 1:
            tan = centers[-1] - centers[-2]
        else:
            tan = centers[i + 1] - centers[i - 1]
        side, up = ring_basis(tan, side_hint=side)
        frames.append((c, tan.normalized() if tan.length > 1e-8 else Vector((0.0, 1.0, 0.0)), side, up))
    return frames


def grid_surface(name, points, nu, nv, wrap_u, mat):
    bm = bmesh.new()
    verts = [bm.verts.new(p) for p in points]
    bm.verts.ensure_lookup_table()
    for j in range(nv - 1):
        for i in range(nu if wrap_u else nu - 1):
            i2 = (i + 1) % nu if wrap_u else i + 1
            a = verts[j * nu + i]
            b = verts[j * nu + i2]
            c = verts[(j + 1) * nu + i2]
            d = verts[(j + 1) * nu + i]
            try:
                bm.faces.new((a, b, c, d))
            except ValueError:
                pass
    return object_from_bmesh(name, bm, mat)


def punch_holes(obj, z_min, z_max, count, seed, neighbor_p=0.45):
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bm.faces.ensure_lookup_table()
    local = random.Random(seed)
    candidates = []
    for f in bm.faces:
        c = f.calc_center_median()
        if z_min < c.z < z_max:
            candidates.append(f)
    local.shuffle(candidates)
    kill = set(candidates[:count])
    extra = set()
    for f in list(kill):
        for e in f.edges:
            for f2 in e.link_faces:
                if f2 not in kill and local.random() < neighbor_p:
                    extra.add(f2)
    geom = list(kill | extra)
    if geom:
        bmesh.ops.delete(bm, geom=geom, context="FACES")
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.update()


def jagged_hem(obj, row_nu, extra_rows=3, z_cut=0.38):
    """Push the lowest verts down irregularly and add hanging triangles."""
    mesh = obj.data
    lows = [v for v in mesh.vertices if v.co.z < z_cut]
    for v in lows:
        x, y, z = v.co
        ang = math.atan2(x, -y)
        n = n3(x * 7.4, y * 7.4, 3.1)
        drop = 0.03 + 0.11 * abs(n) + 0.05 * abs(math.sin(5.0 * ang + 1.2))
        if n > 0.35:
            drop *= 0.25
        v.co.z = max(-0.005, z - drop * max(0.0, (z_cut - z) / max(z_cut, 1e-4)))
        rad = math.hypot(x, y)
        if rad > 1e-4:
            pull = 0.02 + 0.05 * abs(n)
            v.co.x *= 1.0 + pull * 0.15
            v.co.y *= 1.0 + pull * 0.15
    mesh.update()


def extrude_tatters(obj, n=16, seed=5):
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bm.edges.ensure_lookup_table()
    local = random.Random(seed)
    cands = [
        e for e in bm.edges
        if e.is_boundary and (e.verts[0].co.z + e.verts[1].co.z) * 0.5 < 0.55
    ]
    local.shuffle(cands)
    for e in cands[:n]:
        mid = (e.verts[0].co + e.verts[1].co) * 0.5
        ret = bmesh.ops.extrude_edge_only(bm, edges=[e])
        new_verts = [v for v in ret["geom"] if isinstance(v, bmesh.types.BMVert)]
        drop = 0.07 + local.random() * 0.16
        outward = Vector((mid.x, mid.y, 0.0))
        if outward.length > 1e-5:
            outward.normalize()
        for v in new_verts:
            v.co.z = max(0.0, v.co.z - drop)
            v.co += outward * (0.008 + 0.025 * local.random())
            v.co.x += (local.random() - 0.5) * 0.03
            v.co.y += (local.random() - 0.5) * 0.02
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.update()


def make_hanging_rags(cloak, mat, count=10):
    lows = sorted(cloak.data.vertices, key=lambda v: v.co.z)[: max(24, count * 3)]
    local = random.Random(13)
    local.shuffle(lows)
    objs = []
    for i, src in enumerate(lows[:count]):
        x, y, z0 = src.co
        length = 0.08 + local.random() * 0.16
        width = 0.018 + local.random() * 0.03
        ang = math.atan2(x, -y)
        bm = bmesh.new()
        cols, rows = 3, 7
        verts = []
        for rj in range(rows):
            tt = rj / (rows - 1)
            twist = 0.35 * math.sin(tt * 4.2 + i) + 0.2 * n3(i * 0.4, tt * 3, 2)
            dx = math.cos(ang + 1.57) * width * (1.0 - 0.55 * tt)
            dy = math.sin(ang + 1.57) * width * (1.0 - 0.55 * tt)
            droop = -length * (tt ** 1.15)
            flare = 0.02 * tt * math.sin(ang)
            for ci in range(cols):
                s = (ci / (cols - 1) - 0.5) * 2.0
                px = x + s * dx + twist * 0.02 * s + flare
                py = y + s * dy + twist * 0.015
                pz = max(0.0, z0 + droop + 0.01 * n3(px * 8, py * 8, tt * 4))
                verts.append(bm.verts.new((px, py, pz)))
        bm.verts.ensure_lookup_table()
        for rj in range(rows - 1):
            for ci in range(cols - 1):
                a = verts[rj * cols + ci]
                b = verts[rj * cols + ci + 1]
                c = verts[(rj + 1) * cols + ci + 1]
                d = verts[(rj + 1) * cols + ci]
                try:
                    bm.faces.new((a, b, c, d))
                except ValueError:
                    pass
        objs.append(object_from_bmesh(f"HeroRag{i}", bm, mat))
    return objs


def tube_along_polyline(name, centers, radius, segs, mat, radius_fn=None, cap=True):
    bm = bmesh.new()
    n = len(centers)
    rings = []
    frames = path_frames(centers)
    for i, (c, tan, side, up) in enumerate(frames):
        rad = radius_fn(i / max(n - 1, 1)) if radius_fn else radius
        ring = []
        for k in range(segs):
            a = 2 * math.pi * k / segs
            p = c + side * (rad * math.cos(a)) + up * (rad * math.sin(a))
            ring.append(bm.verts.new(p))
        rings.append(ring)
    bm.verts.ensure_lookup_table()
    for i in range(n - 1):
        for k in range(segs):
            k2 = (k + 1) % segs
            try:
                bm.faces.new((rings[i][k], rings[i][k2], rings[i + 1][k2], rings[i + 1][k]))
            except ValueError:
                pass
    if cap:
        try:
            bm.faces.new(list(reversed(rings[0])))
        except ValueError:
            pass
        try:
            bm.faces.new(rings[-1])
        except ValueError:
            pass
    bmesh.ops.triangulate(bm, faces=bm.faces)
    return object_from_bmesh(name, bm, mat)


def pinched_folds(ang, n, phase, depth):
    """Sharp inward creases with rounded ridges — reads as cloth, not a tube."""
    u = (ang / (2.0 * math.pi) * n + phase) % 1.0
    d = min(u, 1.0 - u)
    valley = math.exp(-(d / 0.075) ** 2)
    ridge = 0.62 * (1.0 - valley) * (0.45 + 0.55 * math.sin(2.0 * math.pi * u + 0.5))
    return -depth * valley + depth * ridge


def crumple_uneven(obj, amp=0.05, zmin=0.10, zmax=1.36):
    """Diagonal, irregular crumple — not even vertical flutes."""
    for v in obj.data.vertices:
        x, y, z = v.co
        r = math.hypot(x, y)
        if r < 0.04 or z < zmin or z > zmax:
            continue
        ang = math.atan2(x, -y)
        nloc = 3.6 + 3.4 * (0.5 + 0.5 * n3(math.cos(ang) * 1.4, math.sin(ang) * 1.4, 0.15))
        depth = amp * (0.55 + 0.7 * n3(math.sin(ang) * 2.1, z * 0.4, 1.7))
        twist = ang + 0.55 * z + 0.25 * n3(x * 2, y * 2, 0.4)
        dr = pinched_folds(twist, nloc, 0.13, depth)
        dr += 0.55 * pinched_folds(ang - 0.7 * z, nloc * 0.62 + 1.1, 0.48, depth * 0.45)
        dr += 0.018 * n3(x * 4.5, y * 4.5, z * 2.8)
        s = max(0.52, (r + dr) / r)
        v.co.x = x * s
        v.co.y = y * s
        v.co.z = z + 0.012 * n3(x * 3, y * 3, z * 5)
    obj.data.update()


def subdivide_mesh(obj, cuts=1):
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bmesh.ops.subdivide_edges(bm, edges=bm.edges, cuts=cuts)
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.update()


def make_robe(mat):
    nu, nv = 72, 36
    points = []
    for j in range(nv):
        t = j / (nv - 1)
        z = 0.055 + t * 1.28
        fall = 0.35 + 0.65 * (1.0 - t)
        for i in range(nu):
            ang = 2 * math.pi * i / nu
            r = 0.175 + 0.075 * (1.0 - t) ** 0.65
            twist = ang + 0.45 * z
            r += pinched_folds(twist, 4.6, 0.11, 0.050 * fall)
            r += pinched_folds(ang - 0.62 * z, 7.4, 0.47, 0.022 * fall)
            r += 0.018 * fall * n3(math.cos(ang) * 2.4, math.sin(ang) * 2.4, t * 3)
            if t < 0.08:
                r *= 0.55 + 5.6 * t
            x = r * math.sin(ang)
            y = -r * math.cos(ang) + 0.01
            if t < 0.06:
                y -= 0.02
            points.append(Vector((x, y, z)))
    obj = grid_surface("HeroRobe", points, nu, nv, True, mat)
    jagged_hem(obj, nu, z_cut=0.22)
    return obj


def cloak_ang(u, t=1.0):
    # Back-cape at the shoulders, wraps more toward the hem. Never a front lapel.
    a0 = math.radians(88.0 - 42.0 * (t ** 0.65))
    a1 = math.radians(272.0 + 42.0 * (t ** 0.65))
    return a0 + u * (a1 - a0)


def cloak_radius(ang, t, layer=0):
    r_top = 0.28 + 0.04 * abs(math.sin(ang))
    billow = 0.50 + 0.50 * math.cos(ang - 3.55)
    r_hem = 0.34 + 0.22 * billow
    r = r_top * (1.0 - t ** 1.0) + r_hem * (t ** 1.0)
    r += 0.09 * math.sin(t * math.pi) * (0.35 + 0.65 * billow)
    fall = 0.3 + 0.7 * t
    twist = ang + 0.48 * t
    r += pinched_folds(twist, 4.3, 0.19, 0.055 * fall)
    r += pinched_folds(ang - 0.72 * t, 7.1, 0.58, 0.022 * fall)
    r += 0.022 * t * n3(math.cos(ang) * 2.6, math.sin(ang) * 2.6, t * 5.0 + layer)
    lump = math.exp(-((t - 0.14) / 0.24) ** 2)
    r += 0.11 * lump * abs(n3(math.cos(ang) * 1.8, math.sin(ang) * 1.8, 0.6))
    return r


def cloak_z(ang, t, layer=0):
    z_top = 1.34 - 0.04 * layer
    hem = 0.04 + 0.28 * abs(math.sin(3.4 * ang + 0.5)) ** 1.2
    hem += 0.10 * (0.5 + 0.5 * math.cos(ang - math.pi))
    hem += 0.06 * n3(math.cos(ang) * 5.5, math.sin(ang) * 5.5, 9.0)
    z = z_top + (t ** 0.88) * (hem - z_top)
    return z


def _tear_grid(points, nu, nv, n_notch, seed):
    local = random.Random(seed)
    for _ in range(n_notch):
        i = local.randint(1, nu - 2)
        depth = local.randint(3, 9)
        width = local.randint(1, 3)
        for di in range(-width, width + 1):
            ii = min(nu - 1, max(0, i + di))
            span = width + 0.001
            fall = 1.0 - abs(di) / span
            for k in range(depth):
                j = nv - 1 - k
                idx = j * nu + ii
                src = (j - depth) * nu + ii
                if src < 0:
                    continue
                f = (k / depth) * fall
                a = points[src]
                b = points[idx]
                points[idx] = a.lerp(b, 1.0 - f * 0.92)
                if local.random() < 0.2 * fall and k > depth * 0.45:
                    points[idx] = points[idx].lerp(a, 0.35)
    return points


def make_cloak_sheet(name, mat, nv=44, nu=68, t_max=1.0, layer=0):
    points = []
    for j in range(nv):
        t = t_max * j / (nv - 1)
        for i in range(nu):
            u = i / (nu - 1)
            ang = cloak_ang(u, t)
            r = cloak_radius(ang, t, layer=layer)
            z = cloak_z(ang, t, layer=layer)
            x = r * math.sin(ang)
            y = -r * math.cos(ang)
            y += 0.06 * (1.0 - t) * (0.4 + 0.6 * math.cos(ang - math.pi))
            points.append(Vector((x, y, z)))
    if t_max > 0.8:
        _tear_grid(points, nu, nv, n_notch=34, seed=21 + layer)
    obj = grid_surface(name, points, nu, nv, False, mat)
    if t_max > 0.8:
        jagged_hem(obj, nu, z_cut=0.42)
        punch_holes(obj, 0.12, 1.05, 24, seed=11 + layer, neighbor_p=0.6)
    return obj


def make_cowl(mat):
    """Slumped back shawl that hangs down — not a horizontal roll/ruff."""
    nu, nv = 28, 16
    points = []
    a0 = math.radians(78.0)
    a1 = math.radians(282.0)
    for j in range(nv):
        t = j / (nv - 1)
        for i in range(nu):
            u = i / (nu - 1)
            ang = a0 + u * (a1 - a0)
            hang = t * 0.42 + 0.10 * t * abs(math.sin(2.4 * ang))
            z = 1.36 - hang - 0.05 * n3(u * 4, t * 3, 2)
            r = 0.17 + 0.18 * (t ** 0.8)
            r += 0.04 * n3(math.cos(ang) * 2.5, math.sin(ang) * 2.5, t * 4)
            r += 0.03 * math.sin(3.1 * ang + t * 5) * t
            x = r * math.sin(ang)
            y = -r * math.cos(ang) + 0.04 * (1.0 - t)
            points.append(Vector((x, y, z)))
    return grid_surface("HeroCowl", points, nu, nv, False, mat)


def make_slump_masses(mat):
    """Overlapping hanging cloth patches. Different lengths so they cannot form a ring."""
    objs = []
    specs = [
        (math.pi, 0.90, 0.50, 1.35, 0.19, 8),
        (math.pi + 0.72, 0.62, 0.38, 1.32, 0.22, 3),
        (math.pi - 0.78, 0.58, 0.34, 1.31, 0.21, 5),
        (4.45, 0.52, 0.30, 1.30, 0.23, 2),
        (1.82, 0.48, 0.26, 1.28, 0.22, 11),
    ]
    for pi, (ang_c, half, length, z0, r0, seed) in enumerate(specs):
        nu, nv = 14, 13
        points = []
        for j in range(nv):
            t = j / (nv - 1)
            for i in range(nu):
                u = i / (nu - 1)
                ang = ang_c + (u - 0.5) * 2.0 * half
                z = z0 - t * length - 0.06 * t * abs(math.sin(2.8 * u + seed))
                r = r0 + 0.15 * (t ** 0.72) + 0.05 * n3(u * 3.2, t * 4.1, seed)
                r += 0.035 * math.sin(2.2 * u * math.pi + t * 5 + seed) * t
                x = r * math.sin(ang)
                y = -r * math.cos(ang) + 0.025 * (1.0 - t)
                points.append(Vector((x, y, max(0.85, z))))
        objs.append(grid_surface(f"HeroSlump{pi}", points, nu, nv, False, mat))
    return objs


def hood_path(t):
    p0 = Vector((0.0, -0.18, 1.52))
    p1 = Vector((0.0, 0.04, 1.52))
    p2 = Vector((0.0, 0.06, 1.84))
    p3 = Vector((0.0, 0.15, 1.30))
    return bezier3(t, p0, p1, p2, p3)


def hood_radii(t):
    rx = 0.128 + 0.008 * math.sin(math.pi * min(1.0, t * 1.1))
    rz = 0.195 * (1.0 - 0.38 * t) + 0.04 * t
    return rx, rz


def make_hood(cloth, void_mat):
    nu, nv = 32, 20
    outer_pts = []
    inner_pts = []
    centers = [hood_path(j / (nv - 1)) for j in range(nv)]
    frames = path_frames(centers)
    for j in range(nv):
        t = j / (nv - 1)
        c, tan, side, up = frames[j]
        rx, rz = hood_radii(t)
        for i in range(nu):
            a = 2 * math.pi * i / nu
            wrinkle = 1.0 + 0.04 * math.sin(6.0 * a + t * 2.5)
            offset = side * (rx * math.cos(a) * wrinkle) + up * (rz * math.sin(a) * wrinkle)
            p = c + offset
            # Recess the entire lower half of the opening — no grey visor bar.
            if j < 6 and math.sin(a) < 0.42:
                p = p + Vector((0.0, 0.14 + 0.02 * j, -0.06))
                p.x *= 0.4
            outer_pts.append(p)
            shrink = 0.72
            inward = tan * 0.01 if tan.length else Vector((0, 0.01, 0))
            inner_pts.append(c + offset * shrink + inward)
    hood = grid_surface("HeroHood", outer_pts, nu, nv, True, cloth)
    lining = grid_surface("HeroHoodLining", inner_pts, nu, nv, True, void_mat)
    bm = bmesh.new()
    bm.from_mesh(lining.data)
    bmesh.ops.reverse_faces(bm, faces=bm.faces)
    bm.to_mesh(lining.data)
    bm.free()
    lining.data.update()

    # Cut remaining lower-front cloth so the oval is a hole, not a visor.
    bm = bmesh.new()
    bm.from_mesh(hood.data)
    kill = [f for f in bm.faces if (lambda c: c.y < -0.02 and c.z < 1.56 and abs(c.x) < 0.16)(f.calc_center_median())]
    if kill:
        bmesh.ops.delete(bm, geom=kill, context="FACES")
    bm.to_mesh(hood.data)
    bm.free()
    hood.data.update()

    # Black oval just inside the opening — the face is the hole.
    bm = bmesh.new()
    su, sv = 16, 8
    for j in range(sv):
        v = j / (sv - 1)
        yy = -0.14 + 0.16 * v
        radx = 0.11 * (1.0 - 0.12 * v)
        radz = 0.175 * (1.0 - 0.12 * v)
        for i in range(su):
            a = 2 * math.pi * i / su
            bm.verts.new((radx * math.cos(a), yy, 1.50 + radz * math.sin(a)))
    bm.verts.ensure_lookup_table()
    for j in range(sv - 1):
        for i in range(su):
            i2 = (i + 1) % su
            try:
                bm.faces.new((
                    bm.verts[j * su + i],
                    bm.verts[j * su + i2],
                    bm.verts[(j + 1) * su + i2],
                    bm.verts[(j + 1) * su + i],
                ))
            except ValueError:
                pass
    try:
        bm.faces.new([bm.verts[(sv - 1) * su + i] for i in range(su)])
    except ValueError:
        pass
    cavity = object_from_bmesh("HeroHoodCavity", bm, void_mat)
    bm = bmesh.new()
    cap_c = Vector((0.0, -0.155, 1.50))
    cap_center = bm.verts.new(cap_c)
    cap_ring = []
    for i in range(24):
        a = 2 * math.pi * i / 24
        cap_ring.append(bm.verts.new((cap_c.x + 0.13 * math.cos(a), cap_c.y, cap_c.z + 0.20 * math.sin(a))))
    bm.verts.ensure_lookup_table()
    for i in range(24):
        try:
            bm.faces.new((cap_center, cap_ring[i], cap_ring[(i + 1) % 24]))
        except ValueError:
            pass
    cap = object_from_bmesh("HeroHoodCap", bm, void_mat)
    return hood, lining, cavity, cap


def make_sleeve(name, mat, side):
    """side +1 is character right (+X). Right arm raised to the staff."""
    if side > 0:
        path = [
            Vector((0.16, 0.02, 1.30)),
            Vector((0.22, 0.02, 1.24)),
            Vector((0.28, 0.01, 1.16)),
            Vector((0.32, 0.00, 1.10)),
            Vector((0.34, 0.00, 1.065)),
        ]
        rads = [0.075, 0.072, 0.068, 0.055, 0.042]
    else:
        path = [
            Vector((-0.16, 0.02, 1.30)),
            Vector((-0.20, 0.00, 1.16)),
            Vector((-0.22, -0.02, 1.00)),
            Vector((-0.20, -0.04, 0.86)),
            Vector((-0.18, -0.05, 0.74)),
        ]
        rads = [0.075, 0.070, 0.066, 0.058, 0.046]
    n = 10
    centers = []
    for i in range(n):
        t = i / (n - 1)
        # piecewise lerp along path
        s = t * (len(path) - 1)
        k = min(int(s), len(path) - 2)
        f = s - k
        centers.append(path[k].lerp(path[k + 1], f))

    def rfn(tt):
        s = tt * (len(rads) - 1)
        k = min(int(s), len(rads) - 2)
        f = s - k
        r = rads[k] * (1 - f) + rads[k + 1] * f
        r += 0.008 * math.sin(tt * 9.0) + 0.006 * n3(side * 2, tt * 4, 1)
        return r

    obj = tube_along_polyline(name, centers, 0.06, 14, mat, radius_fn=rfn)
    # tatter the cuff (lowest / last ring-ish verts)
    mesh = obj.data
    if side > 0:
        cuff_z = 1.09
        for v in mesh.vertices:
            if v.co.z < cuff_z:
                v.co.z -= 0.01 + 0.025 * abs(n3(v.co.x * 12, v.co.y * 12, 4))
                v.co.x += 0.01 * n3(v.co.z * 8, v.co.y * 8, 2)
    else:
        cuff_z = 0.80
        for v in mesh.vertices:
            if v.co.z < cuff_z:
                v.co.z -= 0.02 + 0.04 * abs(n3(v.co.x * 10, v.co.y * 10, 5))
    mesh.update()
    return obj


def make_glove(name, mat, center, along, radius=0.038):
    along = along.normalized()
    side, up = ring_basis(along)
    bm = bmesh.new()
    segs, rings = 12, 8
    for j in range(rings):
        t = j / (rings - 1)
        c = center + along * (radius * 1.6 * (t - 0.45))
        rad = radius * (0.75 + 0.35 * math.sin(t * math.pi))
        if t > 0.75:
            rad *= 0.7
        for i in range(segs):
            a = 2 * math.pi * i / segs
            bm.verts.new(c + side * (rad * math.cos(a)) + up * (rad * math.sin(a) * 0.85))
    bm.verts.ensure_lookup_table()
    for j in range(rings - 1):
        for i in range(segs):
            i2 = (i + 1) % segs
            bm.faces.new((
                bm.verts[j * segs + i],
                bm.verts[j * segs + i2],
                bm.verts[(j + 1) * segs + i2],
                bm.verts[(j + 1) * segs + i],
            ))
    try:
        bm.faces.new(list(reversed([bm.verts[i] for i in range(segs)])))
        bm.faces.new([bm.verts[(rings - 1) * segs + i] for i in range(segs)])
    except ValueError:
        pass
    return object_from_bmesh(name, bm, mat)


def make_boot(name, mat, side):
    nu, nv = 16, 10
    points = []
    for j in range(nv):
        t = j / (nv - 1)
        z = 0.002 + t * 0.30
        for i in range(nu):
            ang = 2 * math.pi * i / nu
            r = 0.048 + 0.018 * (1.0 - t) ** 0.6
            r += 0.006 * math.sin(3 * ang)
            x = r * math.sin(ang) + 0.075 * side
            y = -r * math.cos(ang)
            if t < 0.28:
                # toe toward facing (-Y)
                y -= 0.045 * (1.0 - t / 0.28) * max(0.0, math.cos(ang))
                if math.cos(ang) > 0:
                    r2 = 0.01 * (1.0 - t / 0.28)
                    x += r2 * math.sin(ang) * 0
            points.append(Vector((x, y, z)))
    obj = grid_surface(name, points, nu, nv, True, mat)
    solidify(obj, thickness=0.006, offset=1.0)
    return obj


def make_staff(wood, metal, wrap_mat, flame_mat, core_mat):
    staff_x, staff_y = 0.355, 0.015
    n = 36
    centers = []
    for i in range(n):
        t = i / (n - 1)
        z = 0.01 + t * 1.70
        wob = 0.012 * math.sin(t * 13.0) + 0.007 * math.cos(t * 7.5)
        wob2 = 0.006 * math.sin(t * 21.0 + 1.2)
        centers.append(Vector((staff_x + wob, staff_y + wob2, z)))

    def rfn(t):
        r = 0.020 - 0.005 * t
        r += 0.0045 * math.sin(t * 16.0)
        if t > 0.86:
            r += 0.016 * ((t - 0.86) / 0.14)
        return r

    staff = tube_along_polyline("HeroStaff", centers, 0.016, 12, wood, radius_fn=rfn)

    bands = []
    for i, z in enumerate((0.42, 0.78, 1.18, 1.52)):
        bpy.ops.mesh.primitive_torus_add(
            major_radius=0.021,
            minor_radius=0.0042,
            major_segments=18,
            minor_segments=8,
            location=(staff_x + 0.004 * math.sin(z * 8), staff_y, z),
        )
        band = bpy.context.active_object
        band.name = f"HeroBand{i}"
        band.rotation_euler = (math.radians(8.0 * (i - 1)), math.radians(6.0), 0.0)
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
        band.data.materials.append(metal)
        shade_smooth(band)
        bands.append(band)

    # leather wrap near the grip
    wrap_centers = [Vector((staff_x, staff_y, 0.98 + k * 0.012)) for k in range(12)]
    wrap = tube_along_polyline("HeroWrap", wrap_centers, 0.019, 10, wrap_mat, radius_fn=lambda t: 0.019)

    # split torch prongs at the tip
    tip_z = 1.70
    prongs = []
    for k, ox in enumerate((-0.012, 0.0, 0.012)):
        p0 = Vector((staff_x + ox * 0.4, staff_y, tip_z - 0.02))
        p1 = Vector((staff_x + ox, staff_y - 0.004 * k, tip_z + 0.055))
        pr = tube_along_polyline(
            f"HeroProng{k}",
            [p0, p0.lerp(p1, 0.5), p1],
            0.006,
            8,
            wood,
            radius_fn=lambda t, _k=k: 0.007 - 0.003 * t,
        )
        prongs.append(pr)

    # Flame — teardrop, not a sphere. Purple only.
    flame_profile = [
        (0.004, 0.00),
        (0.020, 0.010),
        (0.030, 0.028),
        (0.026, 0.055),
        (0.016, 0.085),
        (0.008, 0.115),
        (0.000, 0.135),
    ]
    bm = bmesh.new()
    segs = 14
    rings = []
    base = Vector((staff_x, staff_y, 1.73))
    for r, z in flame_profile:
        ring = []
        for i in range(segs):
            a = 2 * math.pi * i / segs
            wob = 1.0 + 0.12 * math.sin(3 * a + z * 8)
            ring.append(bm.verts.new((
                base.x + r * math.cos(a) * wob * 0.72,
                base.y + r * math.sin(a) * wob * 0.72,
                base.z + z,
            )))
        rings.append(ring)
    bm.verts.ensure_lookup_table()
    for ri in range(len(rings) - 1):
        for i in range(segs):
            j = (i + 1) % segs
            bm.faces.new((rings[ri][i], rings[ri][j], rings[ri + 1][j], rings[ri + 1][i]))
    flame = object_from_bmesh("HeroFlame", bm, flame_mat)

    bm = bmesh.new()
    rings = []
    for r, z in flame_profile:
        ring = []
        for i in range(10):
            a = 2 * math.pi * i / 10
            ring.append(bm.verts.new((
                base.x + r * 0.45 * math.cos(a),
                base.y + r * 0.45 * math.sin(a),
                base.z + z * 0.72 + 0.01,
            )))
        rings.append(ring)
    bm.verts.ensure_lookup_table()
    for ri in range(len(rings) - 1):
        for i in range(10):
            j = (i + 1) % 10
            bm.faces.new((rings[ri][i], rings[ri][j], rings[ri + 1][j], rings[ri + 1][i]))
    core = object_from_bmesh("HeroFlameCore", bm, core_mat)

    bpy.ops.mesh.primitive_uv_sphere_add(segments=10, ring_count=6, radius=0.012, location=(staff_x, staff_y, 1.74))
    tip = bpy.context.active_object
    tip.name = "HeroStaffTip"
    tip.data.materials.append(flame_mat)
    shade_smooth(tip)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

    return [staff, wrap, flame, core, tip] + bands + prongs


def make_brooch(metal, void_mat):
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=16, radius=0.028, depth=0.008,
        location=(0.0, -0.175, 1.27),
        rotation=(math.radians(90), 0, 0),
    )
    disc = bpy.context.active_object
    disc.name = "HeroBrooch"
    disc.data.materials.append(metal)
    shade_smooth(disc)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

    bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=8, radius=0.014, location=(0.0, -0.182, 1.27))
    gem = bpy.context.active_object
    gem.name = "HeroBroochGem"
    gem.scale = (1.0, 0.45, 1.0)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    gem.data.materials.append(metal)
    shade_smooth(gem)
    return [disc, gem]


def make_chains(metal):
    objs = []
    # small hanging beads on the chest — not above the hood
    specs = [
        (0.04, -0.16, 1.18, 0.007),
        (-0.03, -0.15, 1.10, 0.009),
        (0.06, -0.14, 1.02, 0.006),
        (-0.05, -0.13, 0.96, 0.008),
        (0.02, -0.17, 1.14, 0.005),
    ]
    for i, (x, y, z, r) in enumerate(specs):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=10, ring_count=6, radius=r, location=(x, y, z))
        bead = bpy.context.active_object
        bead.name = f"HeroBead{i}"
        bead.data.materials.append(metal)
        shade_smooth(bead)
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
        objs.append(bead)
        # thin link above each bead
        p0 = Vector((x * 0.3, y - 0.01, 1.26))
        p1 = Vector((x, y, z + r))
        link_obj = tube_along_polyline(
            f"HeroChain{i}",
            [p0, p0.lerp(p1, 0.5) + Vector((0.01 * (i - 2), 0, 0)), p1],
            0.0022,
            6,
            metal,
        )
        objs.append(link_obj)
    return objs


def drape_cloth(obj, colliders, frames=28):
    if not obj.vertex_groups.get("Pin"):
        return False
    for col in colliders:
        if not any(m.type == "COLLISION" for m in col.modifiers):
            col.modifiers.new("Col", "COLLISION")
            col.collision.thickness_outer = 0.018
            col.collision.thickness_inner = 0.012
    mod = obj.modifiers.new("Cloth", "CLOTH")
    cs = mod.settings
    cs.quality = 6
    cs.mass = 0.28
    cs.tension_stiffness = 14.0
    cs.compression_stiffness = 12.0
    cs.shear_stiffness = 6.0
    cs.bending_stiffness = 0.7
    cs.vertex_group_mass = "Pin"
    coll = mod.collision_settings
    coll.use_collision = True
    coll.use_self_collision = True
    coll.distance_min = 0.012
    coll.self_distance_min = 0.012
    scene = bpy.context.scene
    scene.gravity = (0.0, 0.0, -9.81)
    scene.frame_start = 1
    scene.frame_end = frames
    try:
        scene.frame_set(1)
        for f in range(1, frames + 1):
            scene.frame_set(f)
        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)
        bpy.ops.object.modifier_apply(modifier="Cloth")
        obj.select_set(False)
        return True
    except Exception as exc:
        print("drape failed", obj.name, exc)
        try:
            obj.modifiers.remove(mod)
        except Exception:
            pass
        return False


def make_body_collider():
    bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=0.17, depth=1.15, location=(0.0, 0.02, 0.72))
    body = bpy.context.active_object
    body.name = "HeroColliderBody"
    bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=8, radius=0.16, location=(0.0, 0.0, 1.28))
    head = bpy.context.active_object
    head.name = "HeroColliderHead"
    head.scale = (1.0, 1.15, 1.05)
    bpy.ops.object.transform_apply(scale=True)
    return [body, head]


def clamp_meshes(objs, xmax=1.25, ymax=1.35, zmin=-0.01, zmax=2.2):
    for obj in objs:
        if obj is None or obj.type != "MESH":
            continue
        bad = 0
        for v in obj.data.vertices:
            x, y, z = v.co
            if abs(x) > xmax or abs(y) > ymax or z > zmax or z < zmin:
                bad += 1
            v.co.x = max(-xmax, min(xmax, x))
            v.co.y = max(-ymax, min(ymax, y))
            v.co.z = max(zmin, min(zmax, z))
        if bad:
            print("CLAMP", obj.name, bad)
        obj.data.update()


def scale_to_height(hero_meshes, root):
    body_skip = (
        "Staff", "Flame", "Band", "Crystal", "Bead", "Charm", "Tip",
        "Wrap", "Chain", "Brooch", "Pendant", "Prong", "Collider",
    )
    for obj in hero_meshes:
        obj.parent = None
        bpy.ops.object.select_all(action="DESELECT")
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
        obj.select_set(False)
    clamp_meshes(hero_meshes)
    for obj in hero_meshes:
        zs = [v.co.z for v in obj.data.vertices]
        xs = [v.co.x for v in obj.data.vertices]
        if zs:
            print("BBOX", obj.name, "x", round(min(xs), 3), round(max(xs), 3), "z", round(min(zs), 3), round(max(zs), 3))
    zs = []
    for obj in hero_meshes:
        if any(s in obj.name for s in body_skip):
            continue
        for v in obj.data.vertices:
            zs.append(v.co.z)
    if not zs:
        return
    zmin, zmax = min(zs), max(zs)
    h = zmax - zmin
    if h < 0.2:
        return
    s = HEIGHT / h
    print("BODY_HEIGHT", h, "SCALE", s, "Z", zmin, zmax)
    if abs(s - 1.0) > 0.02 or abs(zmin) > 0.002:
        for obj in hero_meshes:
            for v in obj.data.vertices:
                v.co.x *= s
                v.co.y *= s
                v.co.z = (v.co.z - zmin) * s
            obj.data.update()
    for obj in hero_meshes:
        obj.parent = root


def export_glb():
    try:
        bpy.ops.file.pack_all()
    except Exception as exc:
        print("pack_all skipped", exc)
    os.makedirs(os.path.dirname(EXPORT), exist_ok=True)
    bpy.ops.object.select_all(action="DESELECT")
    for obj in bpy.data.objects:
        if obj.name.startswith("Hero") and obj.type in {"MESH", "EMPTY"}:
            obj.select_set(True)
            obj.hide_set(False)
            obj.hide_render = False
            obj.hide_viewport = False
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
        use_selection=True,
        use_visible=True,
        export_materials="EXPORT",
        export_texcoords=True,
        export_normals=True,
        export_tangents=True,
        export_image_format="AUTO",
    )
    print("HERO_EXPORT", EXPORT, "bytes", os.path.getsize(EXPORT))


def build():
    names = {o.name for o in bpy.data.objects}
    if names & SHRINE_MARKERS:
        raise RuntimeError("Refusing to build hero in moonwell shrine file: " + ", ".join(sorted(names & SHRINE_MARKERS)))

    if bpy.ops.object.mode_set.poll():
        bpy.ops.object.mode_set(mode="OBJECT")
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for block in (bpy.data.meshes, bpy.data.materials, bpy.data.images, bpy.data.textures, bpy.data.cameras, bpy.data.lights):
        for item in list(block):
            if item.users == 0:
                block.remove(item)

    cloth = make_pbr(
        "HeroCloth",
        "wool_grey",
        uv_scale=(2.6, 2.6, 1),
        tint=(0.84, 0.86, 0.82),
        roughness_boost=0.18,
        normal_strength=1.25,
    )
    robe_mat = make_pbr(
        "HeroRobe",
        "wool_grey",
        uv_scale=(2.2, 3.4, 1),
        tint=(0.48, 0.47, 0.44),
        roughness_boost=0.24,
        normal_strength=1.05,
    )
    wood = make_pbr(
        "HeroWood",
        "bark_brown_02",
        uv_scale=(1.6, 4.5, 1),
        tint=(0.72, 0.58, 0.42),
        roughness_boost=0.08,
        normal_strength=0.95,
    )
    metal = make_pbr(
        "HeroMetal",
        "metal_plate",
        uv_scale=(2.2, 2.2, 1),
        metallic=0.85,
        tint=(0.22, 0.22, 0.24),
        roughness_boost=0.04,
        normal_strength=1.0,
    )
    leather = make_pbr(
        "HeroLeather",
        "leather_white",
        uv_scale=(2.4, 2.4, 1),
        tint=(0.32, 0.20, 0.13),
        roughness_boost=0.12,
        normal_strength=0.9,
    )
    glove_mat = make_pbr(
        "HeroGloveMat",
        "leather_white",
        uv_scale=(3.0, 3.0, 1),
        tint=(0.16, 0.12, 0.10),
        roughness_boost=0.18,
        normal_strength=0.8,
    )
    void_mat = solid_mat("HeroVoid", (0.008, 0.008, 0.01), roughness=1.0)
    flame_mat = solid_mat(
        "HeroFlameMat",
        (0.45, 0.08, 1.0),
        roughness=0.18,
        emission=(0.45, 0.08, 1.0),
        emission_strength=4.5,
    )
    core_mat = solid_mat(
        "HeroFlameCoreMat",
        (0.75, 0.22, 1.0),
        roughness=0.12,
        emission=(0.75, 0.22, 1.0),
        emission_strength=7.0,
    )

    robe = make_robe(robe_mat)
    cloak = make_cloak_sheet("HeroCloak", cloth, nv=48, nu=72, t_max=1.0, layer=0)
    cowl = make_cowl(cloth)
    slumps = make_slump_masses(cloth)
    hood, lining, cavity, cap = make_hood(cloth, void_mat)
    sleeve_r = make_sleeve("HeroSleeveR", cloth, 1)
    sleeve_l = make_sleeve("HeroSleeveL", cloth, -1)
    glove_r = make_glove("HeroGloveR", glove_mat, Vector((0.345, 0.00, 1.055)), Vector((0.15, 0.0, -0.4)), 0.036)
    glove_l = make_glove("HeroGloveL", glove_mat, Vector((-0.18, -0.05, 0.73)), Vector((0.05, -0.1, -0.7)), 0.034)
    boot_l = make_boot("HeroBootL", leather, -1)
    boot_r = make_boot("HeroBootR", leather, 1)
    staff_objs = make_staff(wood, metal, leather, flame_mat, core_mat)
    brooch_objs = make_brooch(metal, void_mat)
    chain_objs = make_chains(metal)
    extrude_tatters(cloak, n=22, seed=5)

    subdivide_mesh(robe, cuts=1)
    subdivide_mesh(cloak, cuts=1)
    crumple_uneven(robe, amp=0.048, zmin=0.10, zmax=1.34)
    crumple_uneven(cloak, amp=0.044, zmin=0.12, zmax=1.32)
    crumple_uneven(cowl, amp=0.032, zmin=0.95, zmax=1.40)
    for s in slumps:
        crumple_uneven(s, amp=0.036, zmin=0.90, zmax=1.40)

    displace_clouds(cloak, strength=0.014, scale=0.28, name="CloakDisp")
    displace_clouds(robe, strength=0.012, scale=0.36, name="RobeDisp")
    displace_clouds(cowl, strength=0.014, scale=0.22, name="CowlDisp")
    for i, s in enumerate(slumps):
        displace_clouds(s, strength=0.016, scale=0.20, name=f"SlumpDisp{i}")
    clamp_meshes([cloak, robe, cowl, *slumps, hood, lining, cavity, cap])

    bpy.ops.object.empty_add(type="ARROWS", location=(0, 0, 0))
    root = bpy.context.active_object
    root.name = "HeroRoot"

    hero_meshes = [o for o in bpy.data.objects if o.type == "MESH" and o.name.startswith("Hero")]
    for obj in hero_meshes:
        obj.data.name = obj.name
        obj.parent = root
        try:
            uv_unwrap(obj)
        except Exception as exc:
            print("uv fail", obj.name, exc)

    scale_to_height(hero_meshes, root)

    # cameras/lights out of the export
    for obj in list(bpy.data.objects):
        if obj.type in {"CAMERA", "LIGHT"} and obj.name != "HeroRoot":
            bpy.data.objects.remove(obj, do_unlink=True)

    export_glb()
    os.makedirs(os.path.dirname(BLEND), exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=BLEND)
    print("HERO_SAVED", BLEND, "meshes", len(hero_meshes))
    return root


build()
