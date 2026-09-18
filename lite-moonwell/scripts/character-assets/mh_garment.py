"""Review-shorts garment for Human/Orc/Undead. Isolated Blender; no shrine / MCP.

Diagnostic overlay only. Boundaries are named-joint bisect planes from
mh_race.shorts_bisect_planes (waist + per-leg hem). No cloth-sim.
"""
from __future__ import annotations

import math
from collections import Counter

import bmesh
import bpy
from mathutils import Vector

# Warm grey (not blue-slate 0.18, 0.20, 0.24).
REVIEW_SHORTS_RGB = (0.24, 0.21, 0.18)
REVIEW_SHORTS_ROUGH = 0.85
SOLIDIFY_MIN_M = 0.008
SOLIDIFY_MAX_M = 0.014
SOLIDIFY_DEFAULT_M = 0.012


def _select_polys(obj, predicate):
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="DESELECT")
    bpy.ops.object.mode_set(mode="OBJECT")
    for poly in obj.data.polygons:
        poly.select = predicate(poly.index)
    bpy.ops.object.mode_set(mode="EDIT")


def _bisect_selection(plane, clear_outer=True, clear_inner=False):
    bpy.ops.mesh.bisect(
        plane_co=tuple(plane["point"]),
        plane_no=tuple(plane["normal"]),
        clear_inner=clear_inner,
        clear_outer=clear_outer,
    )


def mesh_boundary_loops(mesh):
    """Vertex-index loops along edges used by exactly one polygon.

    Walks by consuming boundary edges one at a time (an edge-disjoint
    decomposition), so it always terminates even at non-manifold boundary
    junctions (a vertex touched by >2 boundary edges).
    """
    ecount = Counter()
    for poly in mesh.polygons:
        ids = list(poly.vertices)
        n = len(ids)
        for a in range(n):
            e = tuple(sorted((ids[a], ids[(a + 1) % n])))
            ecount[e] += 1
    boundary = [e for e, c in ecount.items() if c == 1]
    adj = {}
    for u, v in boundary:
        adj.setdefault(u, []).append(v)
        adj.setdefault(v, []).append(u)
    unused = set(boundary)
    loops = []
    max_steps = len(boundary) + 4
    while unused:
        start, cur = next(iter(unused))
        unused.discard((start, cur))
        loop = [start, cur]
        prev = start
        steps = 0
        while cur != start and steps < max_steps:
            steps += 1
            nxt = None
            for cand in adj.get(cur, ()):
                if cand == prev and len(adj[cur]) <= 1:
                    continue
                e = tuple(sorted((cur, cand)))
                if e in unused:
                    nxt = cand
                    unused.discard(e)
                    break
            if nxt is None:
                break
            loop.append(nxt)
            prev, cur = cur, nxt
        loops.append(loop)
    return loops


def plane_signed_distances(points, plane):
    co = Vector(plane["point"])
    no = Vector(plane["normal"]).normalized()
    return [(Vector(p) - co).dot(no) for p in points]


def shorts_boundary_report(mesh, planes):
    """For each boundary loop, find its best-fit plane (smallest max |distance|)."""
    loops = mesh_boundary_loops(mesh)
    verts = mesh.vertices
    result = []
    for loop in loops:
        pts = [verts[vi].co for vi in loop]
        best_name, best_max_abs = None, None
        for plane_name, plane in planes.items():
            dists = plane_signed_distances(pts, plane)
            max_abs = max(abs(d) for d in dists)
            if best_max_abs is None or max_abs < best_max_abs:
                best_max_abs, best_name = max_abs, plane_name
        result.append(
            {"plane": best_name, "vertexCount": len(loop), "maxAbsPlaneDistanceM": best_max_abs}
        )
    return result


def _clamp_thickness(value):
    return min(SOLIDIFY_MAX_M, max(SOLIDIFY_MIN_M, float(value)))


def _best_loop_for_plane(mesh, loops, plane):
    best, best_d = None, None
    for loop in loops:
        if len(loop) < 3:
            continue
        pts = [mesh.vertices[vi].co for vi in loop]
        md = max(abs(d) for d in plane_signed_distances(pts, plane))
        if best_d is None or md < best_d:
            best, best_d = loop, md
    return best, best_d


def _project_loops_onto_planes(mesh, planes):
    loops = mesh_boundary_loops(mesh)
    verts = mesh.vertices
    for loop in loops:
        pts = [verts[vi].co for vi in loop]
        best_plane, best_d = None, None
        for plane in planes.values():
            md = max(abs(d) for d in plane_signed_distances(pts, plane))
            if best_d is None or md < best_d:
                best_d, best_plane = md, plane
        if best_plane is None:
            continue
        co = Vector(best_plane["point"])
        no = Vector(best_plane["normal"]).normalized()
        for vi in loop:
            p = verts[vi].co
            verts[vi].co = p - no * (p - co).dot(no)
    mesh.update()


def _smooth_loops_in_plane(mesh, planes, iterations=3, front_waist_extra=6):
    """Laplacian-smooth boundary loops in their bisect plane (reduces hip nicks)."""
    verts = mesh.vertices
    waist = planes["waist"]
    for _ in range(iterations):
        loops = mesh_boundary_loops(mesh)
        for loop in loops:
            if len(loop) < 4:
                continue
            pts = [verts[vi].co.copy() for vi in loop]
            best_plane = None
            best_d = None
            for plane in planes.values():
                md = max(abs(d) for d in plane_signed_distances(pts, plane))
                if best_d is None or md < best_d:
                    best_d, best_plane = md, plane
            if best_plane is None:
                continue
            co = Vector(best_plane["point"])
            no = Vector(best_plane["normal"]).normalized()
            n = len(loop)
            new_co = []
            for i, vi in enumerate(loop):
                avg = (pts[(i - 1) % n] + pts[(i + 1) % n]) * 0.5
                p = pts[i].lerp(avg, 0.55)
                p = p - no * (p - co).dot(no)
                new_co.append(p)
            for vi, p in zip(loop, new_co):
                verts[vi].co = p
    waist_loops = mesh_boundary_loops(mesh)
    waist_loop, _ = _best_loop_for_plane(mesh, waist_loops, waist)
    if waist_loop and front_waist_extra:
        co = Vector(waist["point"])
        no = Vector(waist["normal"]).normalized()
        n = len(waist_loop)
        front = []
        for i, vi in enumerate(waist_loop):
            p = verts[vi].co
            if abs(p.x) < 0.055 and p.y < 0.0:
                front.append(i)
        for _ in range(front_waist_extra):
            pts = [verts[vi].co.copy() for vi in waist_loop]
            for i in front:
                avg = (pts[(i - 1) % n] + pts[(i + 1) % n]) * 0.5
                p = pts[i].lerp(avg, 0.7)
                p = p - no * (p - co).dot(no)
                verts[waist_loop[i]].co = p
    mesh.update()


def _dissolve_front_waist_tab(obj, waist_plane, min_turn_deg=22.0, max_x=0.055):
    """Kill the front-center waistband peninsula (navel/abs groove tab)."""
    bpy.ops.object.mode_set(mode="OBJECT")
    loops = mesh_boundary_loops(obj.data)
    waist_loop, _ = _best_loop_for_plane(obj.data, loops, waist_plane)
    if not waist_loop or len(waist_loop) < 8:
        return 0
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bm.verts.ensure_lookup_table()
    n = len(waist_loop)
    doomed = []
    for i, vi in enumerate(waist_loop):
        v = bm.verts[vi]
        if abs(v.co.x) > max_x or v.co.y > 0.0:
            continue
        p0 = bm.verts[waist_loop[(i - 1) % n]].co
        p1 = v.co
        p2 = bm.verts[waist_loop[(i + 1) % n]].co
        a = p1 - p0
        b = p2 - p1
        if a.length < 1e-8 or b.length < 1e-8:
            continue
        turn = math.degrees(a.angle(b))
        chord_mid = (p0 + p2) * 0.5
        if (p1 - chord_mid).y < -0.002 and (turn >= min_turn_deg or (p1 - chord_mid).length > 0.004):
            doomed.append(v)
    count = len(doomed)
    if doomed:
        bmesh.ops.dissolve_verts(bm, verts=list(dict.fromkeys(doomed)))
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.update()
    return count


def _vertex_normals(mesh):
    acc = [Vector((0.0, 0.0, 0.0)) for _ in mesh.vertices]
    for p in mesh.polygons:
        for vi in p.vertices:
            acc[vi] += p.normal
    out = []
    for n in acc:
        out.append(n.normalized() if n.length > 1e-8 else Vector((0.0, 0.0, 1.0)))
    return out


def _offset_shell(obj, thickness, planes):
    """Outward even offset. Boundary verts move in-plane so openings stay planar."""
    bpy.ops.object.mode_set(mode="OBJECT")
    mesh = obj.data
    mesh.update()
    vnor = _vertex_normals(mesh)
    loops = mesh_boundary_loops(mesh)
    plane_of = {}
    for loop in loops:
        if len(loop) < 3:
            continue
        pts = [mesh.vertices[vi].co for vi in loop]
        best_plane, best_d = None, None
        for plane in planes.values():
            md = max(abs(d) for d in plane_signed_distances(pts, plane))
            if best_d is None or md < best_d:
                best_d, best_plane = md, plane
        if best_plane is None:
            continue
        for vi in loop:
            plane_of[vi] = best_plane
    for i, v in enumerate(mesh.vertices):
        n = vnor[i]
        if i in plane_of:
            no = Vector(plane_of[i]["normal"]).normalized()
            n = n - no * n.dot(no)
            if n.length < 1e-8:
                continue
            n = n.normalized()
        v.co += n * thickness
    _project_loops_onto_planes(mesh, planes)


def _signed_point(p, plane):
    co = Vector(plane["point"])
    no = Vector(plane["normal"]).normalized()
    return (Vector(p) - co).dot(no)


def _shave_outside_planes(obj, planes, eps=0.001):
    """Delete faces whose centroid sits outside a bisect plane (tab / hem poke)."""
    bpy.ops.object.mode_set(mode="OBJECT")
    doomed = []
    for p in obj.data.polygons:
        c = p.center
        if _signed_point(c, planes["waist"]) > eps:
            doomed.append(p.index)
            continue
        if c.x > 1e-4 and _signed_point(c, planes["hemLeft"]) > eps:
            doomed.append(p.index)
        elif c.x < -1e-4 and _signed_point(c, planes["hemRight"]) > eps:
            doomed.append(p.index)
    if not doomed:
        return
    doomed_set = set(doomed)
    _select_polys(obj, lambda idx, s=doomed_set: idx in s)
    bpy.ops.mesh.delete(type="FACE")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.delete_loose()
    bpy.ops.object.mode_set(mode="OBJECT")
    obj.data.update()


def make_shorts(body, keep_faces, name, face_leg, offset=SOLIDIFY_DEFAULT_M, planes=None):
    """Continuous review garment from pelvis/upper-thigh topology. Diagnostic only.

    Every boundary (waist, left hem, right hem) comes from a bisect cut on a
    named-joint plane (see mh_race.shorts_bisect_planes), never from the raw
    face-selection edge. The hem bisects are scoped to their own leg via a
    per-face "shorts_leg" int attribute set before any geometry is deleted, so
    it survives Blender's index renumbering.

    Thickening is an outward vertex offset in [8, 14] mm (``offset``).
    Boundary verts move in the bisect plane. No cloth-sim. Front waistband
    tab is dissolved and the waist loop is Laplacian-smoothed in-plane.
    """
    if not keep_faces:
        return None, []
    thickness = _clamp_thickness(offset)
    bpy.ops.object.select_all(action="DESELECT")
    body.select_set(True)
    bpy.context.view_layer.objects.active = body
    bpy.ops.object.duplicate()
    shorts = bpy.context.active_object
    shorts.name = name
    shorts.data.name = name
    if any(m.type == "ARMATURE" for m in shorts.modifiers):
        raise RuntimeError("shorts duplicate inherited an armature modifier")

    leg_attr = shorts.data.attributes.new(name="shorts_leg", type="INT", domain="FACE")
    leg_values = [face_leg.get(fi, 0) for fi in range(len(shorts.data.polygons))]
    leg_attr.data.foreach_set("value", leg_values)

    keep = set(keep_faces)
    _select_polys(shorts, lambda idx: idx not in keep)
    bpy.ops.mesh.delete(type="FACE")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.delete_loose()
    bpy.ops.object.mode_set(mode="OBJECT")

    boundary_report = []
    if planes:
        _select_polys(shorts, lambda idx: True)
        _bisect_selection(planes["waist"])
        bpy.ops.object.mode_set(mode="OBJECT")

        leg_attr = shorts.data.attributes["shorts_leg"]
        cur_leg = [0] * len(shorts.data.polygons)
        leg_attr.data.foreach_get("value", cur_leg)
        for leg_code, plane in ((1, planes["hemLeft"]), (2, planes["hemRight"])):
            _select_polys(shorts, lambda idx, lc=leg_code: cur_leg[idx] == lc)
            _bisect_selection(plane)
            bpy.ops.object.mode_set(mode="OBJECT")

        shorts.data.attributes.remove(shorts.data.attributes["shorts_leg"])
        shorts.data.update()
        _dissolve_front_waist_tab(shorts, planes["waist"])
        _smooth_loops_in_plane(shorts.data, planes)
        _project_loops_onto_planes(shorts.data, planes)
        _offset_shell(shorts, thickness, planes)
        _shave_outside_planes(shorts, planes)
        _dissolve_front_waist_tab(shorts, planes["waist"])
        _smooth_loops_in_plane(shorts.data, planes, iterations=2, front_waist_extra=6)
        _project_loops_onto_planes(shorts.data, planes)
        shorts.data.update()
        zmax = max(v.co.z for v in shorts.data.vertices)
        stature = max(v.co.z for v in body.data.vertices)
        if zmax > stature + 1e-6:
            raise RuntimeError(f"shorts zmax {zmax:.4f} m > body stature {stature:.4f} m")
        boundary_report = shorts_boundary_report(shorts.data, planes)
    else:
        if "shorts_leg" in shorts.data.attributes:
            shorts.data.attributes.remove(shorts.data.attributes["shorts_leg"])
        shorts.data.update()
        for v in shorts.data.vertices:
            n = Vector((0, 0, 0))
            for p in shorts.data.polygons:
                if v.index in p.vertices:
                    n += p.normal
            if n.length > 1e-8:
                v.co += n.normalized() * thickness
        shorts.data.update()

    for p in shorts.data.polygons:
        p.use_smooth = True
    shorts.data.update()
    return shorts, boundary_report
