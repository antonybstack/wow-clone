"""Background Blender 5.2: MakeHuman hm08 + CC0 targets/proxies → human-v1.

Isolated process. Never opens an interactive Blender scene or MCP 9876.
Does not retarget. Bind pose change is expected (WP-2.3 re-retargets later).
"""
from __future__ import annotations

import hashlib
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(Path(__file__).resolve().parent))
import mh_garment  # noqa: E402
import mh_hair  # noqa: E402
import mh_io  # noqa: E402
import mh_race  # noqa: E402
import mh_studio  # noqa: E402

SRC = ROOT / "blender/characters/sources"
BLEND = ROOT / "blender/characters/human-v1.blend"
GLB = ROOT / "public/characters/bodies/human-v1.glb"
TEX = ROOT / "public/characters/bodies/human-v1-textures"
EVID = ROOT / "ve-capture/m2-human-v2"
REPORT = EVID / "build-report.json"
OLD_HASH = "3dde58634db176230a5a617f50460402453b7172b29864ea964039a44660050a"
BASE_GLB_HASH = "2f9e45d0f7d9faeae4c20e18585173d62953df1a8f0272f270bedb200927604c"
EYE_GLOBE_SCALE = 0.83
CORNEA_BULGE_M = 0.0022
LID_WRAP_CLEARANCE_M = 0.0009
LID_TARGET_FILES = (
    "eye-left-opened-up.target",
    "eye-right-opened-up.target",
)

HUMAN_TARGETS = (
    ("caucasian-male-young.target", 1.0),
    ("universal-male-young-maxmuscle-maxweight.target", 0.35),
    ("head-scale-vert-decr.target", 0.32),
    ("torso-vshape-incr.target", 1.0),
    ("torso-scale-horiz-incr.target", 0.30),
    ("measure-shoulder-dist-incr.target", 1.0),
    ("measure-waist-circ-decr.target", 1.0),
    ("torso-muscle-pectoral-incr.target", 0.55),
    ("torso-muscle-dorsi-incr.target", 0.50),
    ("l-eye-height1-incr.target", 0.22),
    ("r-eye-height1-incr.target", 0.22),
    ("l-eye-height2-incr.target", 0.12),
    ("r-eye-height2-incr.target", 0.12),
    ("eye-left-opened-up.target", 0.08),
    ("eye-right-opened-up.target", 0.08),
    ("nose-flaring-incr.target", 0.55),
    ("nose-nostrils-width-incr.target", 0.45),
    ("mouth-upperlip-volume-incr.target", 0.55),
    ("mouth-lowerlip-volume-incr.target", 0.50),
    ("mouth-philtrum-volume-incr.target", 0.70),
)


def T(name, w):
    return (SRC / name, w)


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def write_iris(dest: Path, size=512):
    """Fallback iris if brown_eye.png is missing. Iris UV radius 0.14 so sclera reads in Lite."""
    img = bpy.data.images.new(dest.name, size, size, alpha=True)
    px = [0.95, 0.95, 0.94, 1.0] * (size * size)
    cx = cy = (size - 1) * 0.5
    iris_r = 0.14 * size
    pupil_r = 0.05 * size
    hx = cx - 0.045 * size
    hy = cy + 0.04 * size
    hr = 0.028 * size
    for y in range(size):
        for x in range(size):
            dx = x - cx
            dy = y - cy
            d = math.sqrt(dx * dx + dy * dy)
            i = (y * size + x) * 4
            if d < pupil_r:
                px[i], px[i + 1], px[i + 2], px[i + 3] = 0.03, 0.015, 0.01, 1.0
            elif d < iris_r:
                t = (d - pupil_r) / (iris_r - pupil_r)
                px[i] = 0.36 + 0.08 * t
                px[i + 1] = 0.14 + 0.04 * t
                px[i + 2] = 0.05
                px[i + 3] = 1.0
            if (x - hx) * (x - hx) + (y - hy) * (y - hy) < hr * hr:
                px[i], px[i + 1], px[i + 2] = 0.98, 0.98, 0.99
    img.pixels = px
    img.filepath_raw = str(dest)
    img.file_format = "PNG"
    img.save()
    bpy.data.images.remove(img)


def eye_front_uvs(verts):
    """Front is Blender -Y. Back hemisphere samples sclera so inverted normals stay white."""
    uvs = [[0.92, 0.08] for _ in verts]
    for sign in (1.0, -1.0):
        ids = [i for i, v in enumerate(verts) if v[0] * sign >= 0.0]
        if not ids:
            continue
        cx = sum(verts[i][0] for i in ids) / len(ids)
        cy = sum(verts[i][1] for i in ids) / len(ids)
        cz = sum(verts[i][2] for i in ids) / len(ids)
        r = max(math.dist(verts[i], (cx, cy, cz)) for i in ids) or 1.0
        for i in ids:
            x, y, z = verts[i]
            if y > cy:
                continue
            uvs[i] = (0.5 + (x - cx) / (2.0 * r), 0.5 + (z - cz) / (2.0 * r))
    return uvs


def vert_uv_loops(loops):
    return [[(vi, vi) for vi, _ti in loop] for loop in loops]


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


def lid_vert_ids():
    ids = set()
    for name in LID_TARGET_FILES:
        ids |= mh_io.target_vert_ids(SRC / name)
    return ids


def load_fitted_proxy(mh_verts, clo_name, obj_name):
    clo = mh_io.load_mhclo(SRC / clo_name)
    obj_verts, uvs, faces = mh_io.load_obj(SRC / obj_name)
    fitted = mh_io.fit_proxy(mh_verts, clo)
    if len(fitted) != len(obj_verts):
        raise RuntimeError(f"{clo_name} mappings {len(fitted)} != obj verts {len(obj_verts)}")
    return fitted, uvs, mh_io.obj_loops(faces)


def main():
    mh_studio.reset_empty()
    TEX.mkdir(parents=True, exist_ok=True)
    EVID.mkdir(parents=True, exist_ok=True)

    verts_mh, uvs, faces = mh_io.load_obj(SRC / "base.obj")
    mh_io.apply_targets(verts_mh, [T(n, w) for n, w in HUMAN_TARGETS])
    eye_mh, eye_uvs, eye_loops = load_fitted_proxy(verts_mh, "low-poly.mhclo", "low-poly.obj")
    hair_mh, hair_uvs, hair_loops = load_fitted_proxy(verts_mh, mh_hair.CLO, mh_hair.OBJ)
    brow_mh, brow_uvs, brow_loops = load_fitted_proxy(verts_mh, "eyebrow001.mhclo", "eyebrow001.obj")

    body_bl, zmin = mh_io.mh_coords_to_blender(verts_mh)
    eye_bl, _ = mh_io.mh_coords_to_blender(eye_mh, zmin=zmin)
    for v in eye_bl:
        v[1] -= 0.0035
    mh_studio.shrink_eye_globes(eye_bl, EYE_GLOBE_SCALE)
    mh_studio.bulge_cornea(eye_bl, CORNEA_BULGE_M)
    mh_studio.tuck_globe_backs(eye_bl)
    lids = lid_vert_ids()
    lids_wrapped = mh_studio.wrap_lids_on_spheres(body_bl, eye_bl, lids, LID_WRAP_CLEARANCE_M)
    hair_bl, _ = mh_io.mh_coords_to_blender(hair_mh, zmin=zmin)
    brow_bl, _ = mh_io.mh_coords_to_blender(brow_mh, zmin=zmin)
    brow_bl = inflate(brow_bl, 0.002)
    bverts, uvs, loops = mh_io.body_mesh(body_bl, uvs, faces)
    skel = mh_io.load_skel(SRC / "default.mhskel")
    bones = mh_io.bones_world(skel, body_bl)
    full_w, helper_entries, zero_ids = mh_io.load_weights_full(SRC / "default_weights.mhw", mh_io.BONE_RENAME)
    if zero_ids:
        raise RuntimeError(f"body verts with no source weight: count={len(zero_ids)} ids={zero_ids[:32]}")
    parents = mh_io.parent_map(bones)

    arm = mh_studio.build_armature(bones, "HumanV1Rig", "HumanV1")
    rest_mats = mh_studio.rest_bone_matrices(arm, bones)
    pose_mats_by_pose = {}
    for pose_name, spec in mh_race.SKIN_POSES:
        mh_studio.clear_pose(arm)
        if spec:
            mh_studio.pose_bones(arm, spec)
        pose_mats_by_pose[pose_name] = mh_studio.posed_bone_matrices(arm, bones)
    mh_studio.clear_pose(arm)
    limited, red_stats = mh_race.reduce_weights_pose_aware(
        full_w, parents, rest_mats, pose_mats_by_pose, bverts, max_influences=4
    )
    keep_shorts = mh_race.shorts_face_indices(loops, full_w, bverts, bones)
    shorts_stats = mh_race.shorts_topology_stats(loops, keep_shorts)
    face_leg = mh_race.shorts_face_leg(loops, bverts, keep_shorts)
    bisect_planes = mh_race.shorts_bisect_planes(bones)

    albedo = SRC / "young_lightskinned_male_diffuse.png"
    painted_albedo = TEX / "albedo.png"
    normal_path = TEX / "normal.png"
    rough_path = TEX / "roughness.png"
    hair_tex = TEX / "hair.png"
    hair_normal = TEX / "hair-normal.png"
    eye_tex = TEX / "eye.png"
    eye_rough = TEX / "eye-rough.png"
    socket_paint = mh_studio.paint_eye_socket_skin(albedo, painted_albedo, uvs, loops, lids)
    mh_studio.write_skin_aux_maps(painted_albedo, normal_path, rough_path)
    hair_src = mh_hair.source_paths(SRC)
    hair_tex.write_bytes(hair_src["diffuse"].read_bytes())
    hair_normal.write_bytes(hair_src["normal"].read_bytes())
    src_eye = SRC / "brown_eye.png"
    if src_eye.exists():
        (TEX / "brown_eye.png").write_bytes(src_eye.read_bytes())
        mh_studio.write_eye_albedo(src_eye, eye_tex, rough_dest=eye_rough)
    else:
        write_iris(eye_tex)
        eye_uvs = eye_front_uvs(eye_bl)
        eye_loops = vert_uv_loops(eye_loops)
        eye_rough = None
    (TEX / "eyebrow.png").write_bytes((SRC / "eyebrow001.png").read_bytes())

    body = mh_studio.build_mesh("HumanBody", bverts, uvs, loops)
    skin = mh_studio.mat_pbr(
        "HumanSkin",
        albedo_path=painted_albedo,
        normal_path=normal_path,
        roughness_path=rough_path,
        color=(0.62, 0.48, 0.40),
        rough=0.5,
    )
    body.data.materials.append(skin)
    mh_studio.assign_weights(body, limited)
    bpy.ops.object.select_all(action="DESELECT")
    body.select_set(True)
    bpy.context.view_layer.objects.active = body
    bpy.ops.object.duplicate()
    body_full = bpy.context.active_object
    body_full.name = "HumanBodyFullW"
    body_full.vertex_groups.clear()
    mh_studio.assign_weights(body_full, [[(n, w) for n, w in infl.items()] for infl in full_w])
    height = max(v[2] for v in bverts) - min(v[2] for v in bverts)
    shorts, shorts_boundary = mh_garment.make_shorts(
        body,
        keep_shorts,
        "HumanShorts",
        face_leg,
        offset=0.012 * (height / mh_race.HUMAN_HEIGHT_M),
        planes=bisect_planes,
    )
    shorts_mat = mh_studio.mat_clay(
        "ReviewShorts", mh_garment.REVIEW_SHORTS_RGB, mh_garment.REVIEW_SHORTS_ROUGH
    )
    if shorts:
        shorts.data.materials.clear()
        shorts.data.materials.append(shorts_mat)

    eyes = mh_studio.build_mesh("HumanEyes", eye_bl, eye_uvs, eye_loops)
    hair = mh_studio.build_mesh("HumanHair", hair_bl, hair_uvs, hair_loops)
    brows = mh_studio.build_mesh("HumanBrows", brow_bl, brow_uvs, brow_loops)
    mh_studio.normals_outward(eyes)
    mh_studio.normals_outward(hair)
    eyes.data.materials.append(
        mh_studio.mat_pbr(
            "HumanEyes",
            albedo_path=eye_tex,
            roughness_path=eye_rough,
            color=(1, 1, 1),
            rough=0.12,
            specular=0.72,
            double_sided=True,
        )
    )
    hair_mat = mh_studio.mat_pbr("HumanHair", **mh_hair.mat_kwargs(hair_tex, hair_normal))
    hair_alpha = mh_hair.wire_export_mask(hair_mat, mh_hair.ALPHA_CLIP)
    hair.data.materials.append(hair_mat)
    brows.data.materials.append(
        mh_studio.mat_pbr(
            "HumanBrows",
            albedo_path=SRC / "eyebrow001.png",
            color=(0.12, 0.07, 0.04),
            rough=0.55,
            alpha_clip=0.12,
        )
    )
    mh_studio.weight_by_x_sign(eyes, "eye.L", "eye.R")
    mh_studio.weight_all(hair, "Head")
    mh_studio.weight_all(brows, "Head")

    meshes = [body, body_full, shorts, eyes, hair, brows]
    for obj in meshes:
        if obj is None:
            continue
        mh_studio.parent_armature(obj, arm)
        mh_studio.apply_identity(obj)
        mh_studio.shade_body_smooth(obj.data)
    mh_studio.set_hide(body_full, True)

    mh_studio.apply_human_rest_pose(arm, abduction_deg=45.0, elbow_flex_deg=7.0)
    mh_studio.bake_pose_as_rest(arm, meshes)
    mh_studio.set_hide(body_full, True)
    pose_report = mh_studio.rest_pose_from_arm(arm)
    bverts_rest = [[v.co.x, v.co.y, v.co.z] for v in body.data.vertices]
    bones_rest = []
    bpy.context.view_layer.update()
    for b in arm.data.bones:
        bones_rest.append(
            {
                "name": b.name,
                "head": list(arm.matrix_world @ b.head_local),
                "tail": list(arm.matrix_world @ b.tail_local),
            }
        )
    props = mh_io.proportion_metrics(bverts_rest, bones_rest)
    pose_report["helpers"] = mh_io.rest_limb_metrics(bones_rest)

    cam = mh_studio.setup_view()
    mh_studio.set_hide(shorts, False)
    for name, view in (
        ("authoring-front.png", "front"),
        ("authoring-back.png", "back"),
        ("authoring-side.png", "side"),
        ("authoring-three-quarter.png", "three_quarter"),
    ):
        mh_studio.frame_full_figure(cam, body, view)
        mh_studio.render(EVID / name)
    mh_studio.set_hide(shorts, True)
    mh_studio.frame_full_figure(cam, body, "front")
    mh_studio.render(EVID / "authoring-anatomy-front.png")
    mh_studio.set_hide(shorts, False)

    skin_by_pose = {}
    body_full.hide_viewport = False
    body_full.hide_render = True
    for pose_name, spec in mh_race.SKIN_POSES:
        mh_studio.clear_pose(arm)
        if spec:
            mh_studio.pose_bones(arm, spec)
        skin_by_pose[pose_name] = mh_studio.compare_skin(body_full, body, full_w)
        skin_by_pose[pose_name]["pose"] = pose_name
    body_full.hide_viewport = True
    mh_studio.clear_pose(arm)

    head = mh_studio.bone_world(arm, "Head") or Vector((0, 0, height * 0.92))
    mh_studio.frame_point(cam, (head.x, head.y - 0.04, head.z + 0.02), 0.42)
    mh_studio.render(EVID / "authoring-face.png")

    keep = {"HumanV1", "HumanBody", "HumanShorts", "HumanEyes", "HumanHair", "HumanBrows"}
    mh_studio.export_glb(
        GLB,
        keep,
        "Human v2 derived from MakeHuman hm08 core assets + system CC0 proxies (CC0)",
    )
    BLEND.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND))

    new_hash = sha256(GLB)
    region_counts = {}
    for vi in red_stats["affectedVertexIds"]:
        r = mh_race.region_of_weights(full_w[vi])
        region_counts[r] = region_counts.get(r, 0) + 1
    red_stats_out = {k: v for k, v in red_stats.items() if k != "affectedVertexIds"}
    red_stats_out["affectedVertexIdsSample"] = red_stats["affectedVertexIds"][:24]
    red_stats_out["affectedRegions"] = region_counts
    report = {
        "bodyVerts": len(bverts),
        "bodyQuads": len(loops),
        "jointsAuthored": len(bones),
        "proxies": {
            "eyes": {
                "verts": len(eye_bl),
                "bones": ["eye.L", "eye.R"],
                "globeScale": EYE_GLOBE_SCALE,
                "corneaBulgeM": CORNEA_BULGE_M,
                "lidWrapClearanceM": LID_WRAP_CLEARANCE_M,
                "lidVerts": len(lids),
                "lidsWrapped": lids_wrapped,
            },
            "hair": {
                "proxy": mh_hair.CLO,
                "verts": len(hair_bl),
                "bone": "Head",
                "alphaClip": mh_hair.ALPHA_CLIP,
                "rough": mh_hair.ROUGH,
                "crownFill": False,
                "exportAlpha": hair_alpha,
            },
            "eyebrows": {"verts": len(brow_bl), "bone": "Head"},
            "socketPaint": socket_paint,
        },
        "zeroWeightAssignedToHips": False,
        "zeroWeightBodyVertexCount": 0,
        "helperWeightEntriesOmitted": helper_entries,
        "weightReduction": red_stats_out,
        "skinCompareFullVs4ByPose": skin_by_pose,
        "skinCompareStressFullVs4": skin_by_pose.get("stress_combo", {}),
        "shorts": {
            "method": (
                "mh_garment.make_shorts: named-joint bisect, front waist tab dissolve, "
                "outward offset 8-14 mm in-plane at openings, no cloth-sim, warm grey"
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
        "targets": [{"path": n, "weight": w} for n, w in HUMAN_TARGETS],
        "proportions": props,
        "restPose": pose_report,
        "textures": {
            "albedo": str(TEX / "albedo.png"),
            "normal": str(normal_path),
            "roughness": str(rough_path),
            "hair": str(hair_tex),
            "hairNormal": str(hair_normal),
            "eye": str(eye_tex),
            "eyeRough": str(eye_rough) if eye_rough else None,
        },
        "humanV1Sha256Old": OLD_HASH,
        "humanV1Sha256New": new_hash,
        "baseGlbSha256Unchanged": BASE_GLB_HASH,
        "shading": "polygon.use_smooth=True; CC0 albedo+sobel normal+zoned roughness",
        "forward": "Blender -Y / glTF +Z",
        "up": "Blender +Z / glTF +Y",
        "units": "meters",
        "source": "hm08 + CC0 targets + system eyes/hair/eyebrow/skin",
        "evidenceLabel": "Blender authoring stills; live Lite plates are separate",
        **mh_race.metrics(bverts, bones),
    }
    REPORT.write_text(json.dumps(report, indent=2))
    print("BUILD_OK", json.dumps(report))


if __name__ == "__main__":
    main()
