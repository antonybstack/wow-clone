"""Check whether reconstructed Orc MH verts line up with unbulked/bulked GLBs."""
import bpy, sys, math
from pathlib import Path
from mathutils import Vector
ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'scripts/character-assets'))
import mh_io, mh_race
from build_orc_v1 import T

SRC = ROOT / 'blender/characters/sources'
for ob in list(bpy.data.objects):
    bpy.data.objects.remove(ob, do_unlink=True)

targets = [
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
deformed = mh_race.deform_body(
    SRC, targets, target_height=2.10, neck_forward_deg=13.0, lateral_x_scale=1.015
)
cloud = deformed['verts']
print('reconstructed cloud', len(cloud), 'body', mh_io.BODY_VERTS)
print('recon bbox z', min(v[2] for v in cloud[:mh_io.BODY_VERTS]), max(v[2] for v in cloud[:mh_io.BODY_VERTS]))
print('recon bbox x', min(v[0] for v in cloud[:mh_io.BODY_VERTS]), max(v[0] for v in cloud[:mh_io.BODY_VERTS]))


def load_body(path):
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
    return body, pts, arm


def stats(label, pts):
    xs, ys, zs = [p.x for p in pts], [p.y for p in pts], [p.z for p in pts]
    print(f'{label} n={len(pts)} x={min(xs):.3f}..{max(xs):.3f} y={min(ys):.3f}..{max(ys):.3f} z={min(zs):.3f}..{max(zs):.3f}')


def compare_prefix(a, b, n, label):
    n = min(n, len(a), len(b))
    ds = []
    for i in range(n):
        pa, pb = a[i], b[i]
        if hasattr(pa, 'x'):
            d = (Vector(pa) - Vector(pb)).length
        else:
            d = math.dist(pa, pb)
        ds.append(d)
    ds.sort()
    print(f'{label} n={n} median={ds[n//2]:.4f} p95={ds[int(n*0.95)]:.4f} max={ds[-1]:.4f} mean={sum(ds)/n:.4f}')
    return ds[n // 2]


body_u, pts_u, _ = load_body(ROOT / 'public/characters/bodies/orc-animated-v1.glb')
stats('unbulked-glb', pts_u)
compare_prefix(cloud, pts_u, mh_io.BODY_VERTS, 'recon vs unbulked index')

# nearest-neighbor sample
import random
rng = random.Random(0)
sample = rng.sample(range(mh_io.BODY_VERTS), 40)
nn = []
for i in sample:
    p = Vector(cloud[i])
    best = min((p - q).length for q in pts_u[::20])
    nn.append(best)
print('recon-to-unbulked subsampled NN (every 20th) sample40 mean', sum(nn) / len(nn), 'max', max(nn))

body_b, pts_b, _ = load_body(ROOT / '.cache/source-motion/orc-bulked.glb')
stats('bulked-glb', pts_b)
compare_prefix(pts_u, pts_b, min(len(pts_u), mh_io.BODY_VERTS), 'unbulked vs bulked index')

# orc-v1
try:
    _, pts_v1, _ = load_body(ROOT / 'public/characters/bodies/orc-v1.glb')
    stats('orc-v1-glb', pts_v1)
    compare_prefix(cloud, pts_v1, mh_io.BODY_VERTS, 'recon vs orc-v1 index')
except Exception as e:
    print('orc-v1 skip', e)
