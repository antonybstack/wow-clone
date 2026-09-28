#!/usr/bin/env python3
"""Measure per-bone girth ratios for a lean and a heavy human from the CC0 MakeHuman source.

Why this exists
---------------
M004 needs slender/stout body shapes for the *current* Human template, whose
topology comes from the Tripo source (3,274 vertices) and has no morph targets.
The MakeHuman hm08 base mesh has a different topology, so its shape targets
cannot be copied across as vertex deltas. What does transfer is the *measurement*:
how much thinner or thicker each limb and torso segment becomes between a lean
body and a heavy body of the same stature. This script extracts those ratios as
numbers; ``build-human-shape-family.mjs`` applies them to our own mesh.

Sources, all CC0 and already vendored with hashes in
``scripts/character-assets/provenance.json`` and ``provenance-races.json``:
  * ``base.obj``                 hm08 base mesh, includes the joint helper cubes
  * ``caucasian-male-young.target``   the macro target human-v1 was built with
  * ``universal-male-old-minmuscle-minweight.target``    lean direction
  * ``universal-male-young-maxmuscle-maxweight.target``  heavy direction
  * ``default.mhskel``           joint definitions (vertex-index centroids)
  * ``default_weights.mhw``      per-bone vertex weights on the same topology

MakeHuman target format is one ``index dx dy dz`` line per moved vertex; a body
is ``base + sum(weight * target)``. The skeleton is derived from helper-cube
centroids rather than stored transforms, which is why ``default.mhskel`` lists
vertex indices for every joint. See
https://github.com/makehumancommunity/makehuman/blob/master/makehuman/data/rigs/default.mhskel

Method
------
Three bodies are built from the same base: lean, heavy, and a midpoint at 0.5 of
each direction. Each is normalised to a common stature about its own ground
plane, because M004 treats height as a separate control and the macro targets
move stature as well as girth. For every measured bone, girth is the
weight-averaged perpendicular distance from the bone's head-to-tail axis over
the body-surface vertices that bone actually drives. The reported ratio is
``girth(lean or heavy) / girth(mid)``.

The ratios are a girth field, not a full anatomical resculpt: they say how much
wider a segment gets, not where fat or muscle sits within it.
"""
import hashlib
import json
import math
import sys
from pathlib import Path

SRC = Path('blender/characters/sources')
OUT = Path('docs/baselines/character-mmo/m004/makehuman-girth.json')

FILES = {
    'base': SRC / 'base.obj',
    'macro': SRC / 'caucasian-male-male-young.target',  # replaced below
    'lean': SRC / 'universal-male-old-minmuscle-minweight.target',
    'heavy': SRC / 'universal-male-young-maxmuscle-maxweight.target',
    'skel': SRC / 'default.mhskel',
    'weights': SRC / 'default_weights.mhw',
}
FILES['macro'] = SRC / 'caucasian-male-young.target'

# MakeHuman segment -> the mixamorig joint that owns the same flesh on our Human.
# MakeHuman numbers the spine downward (spine05 sits at the pelvis), which is the
# opposite of the mixamorig chain, so the mapping is written out rather than derived.
SEGMENTS = {
    'mixamorig:Hips': ['spine05', 'pelvis.L', 'pelvis.R'],
    'mixamorig:Spine': ['spine04'],
    'mixamorig:Spine1': ['spine03'],
    'mixamorig:Spine2': ['spine02', 'spine01'],
    'mixamorig:Neck': ['neck01', 'neck02', 'neck03'],
    'mixamorig:Head': ['head'],
    'mixamorig:LeftShoulder': ['clavicle.L', 'shoulder01.L'],
    'mixamorig:RightShoulder': ['clavicle.R', 'shoulder01.R'],
    'mixamorig:LeftArm': ['upperarm01.L', 'upperarm02.L'],
    'mixamorig:RightArm': ['upperarm01.R', 'upperarm02.R'],
    'mixamorig:LeftForeArm': ['lowerarm01.L', 'lowerarm02.L'],
    'mixamorig:RightForeArm': ['lowerarm01.R', 'lowerarm02.R'],
    'mixamorig:LeftHand': ['wrist.L'],
    'mixamorig:RightHand': ['wrist.R'],
    'mixamorig:LeftUpLeg': ['upperleg01.L', 'upperleg02.L'],
    'mixamorig:RightUpLeg': ['upperleg01.R', 'upperleg02.R'],
    'mixamorig:LeftLeg': ['lowerleg01.L', 'lowerleg02.L'],
    'mixamorig:RightLeg': ['lowerleg01.R', 'lowerleg02.R'],
    'mixamorig:LeftFoot': ['foot.L'],
    'mixamorig:RightFoot': ['foot.R'],
}

# A segment's axis defaults to the first bone's head and the last bone's tail, which
# is right for every chain here. The pelvis is not a chain: MakeHuman's spine05 points
# forward and pelvis.L/R point sideways, while the mixamorig Hips-to-Spine rest axis is
# vertical. Measuring the pelvis against that vertical axis is what makes its width and
# depth ratios comparable with the radial scale applied on our own mesh.
AXIS_OVERRIDE = {
    'mixamorig:Hips': ('spine05____head', 'spine04____head'),
}

MIN_WEIGHT = 0.15  # below this a vertex is mostly driven by a neighbouring bone


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def read_obj(path):
    """Vertices plus the index set of the ``body`` group's faces (helpers excluded)."""
    verts = []
    body = set()
    group = None
    for line in path.read_text().splitlines():
        if line.startswith('v '):
            _, x, y, z = line.split()
            verts.append([float(x), float(y), float(z)])
        elif line.startswith('g '):
            group = line[2:].strip()
        elif line.startswith('f ') and group == 'body':
            for tok in line[2:].split():
                body.add(int(tok.split('/')[0]) - 1)
    return verts, body


def read_target(path):
    deltas = []
    for line in path.read_text().splitlines():
        if not line or line.startswith('#'):
            continue
        parts = line.split()
        if len(parts) < 4:
            continue
        deltas.append((int(parts[0]), float(parts[1]), float(parts[2]), float(parts[3])))
    return deltas


def build(base, layers):
    out = [v[:] for v in base]
    for deltas, weight in layers:
        for i, dx, dy, dz in deltas:
            v = out[i]
            v[0] += dx * weight
            v[1] += dy * weight
            v[2] += dz * weight
    return out


def normalise(verts, body, target_height):
    ys = [verts[i][1] for i in body]
    ground, top = min(ys), max(ys)
    height = top - ground
    k = target_height / height
    for v in verts:
        v[0] *= k
        v[1] = ground + (v[1] - ground) * k
        v[2] *= k
    return height


def centroid(verts, indices):
    n = len(indices)
    return [sum(verts[i][a] for i in indices) / n for a in range(3)]


def cross(a, b):
    return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]


def norm(v):
    length = math.sqrt(sum(c * c for c in v))
    return [c / length for c in v] if length > 1e-9 else None


def perp_frame(axis):
    """The two unit axes of the plane perpendicular to ``axis``: depth, then cross-width.

    ``e2`` is world Z projected into the plane, so it always means body depth
    (front-to-back). ``e1`` is ``cross(e2, axis)``: body width for a vertical
    segment such as the spine, and vertical thickness for a lateral segment such
    as a T/A-pose arm. Anchoring on Z rather than picking whichever world axis is
    least parallel keeps the frame identical on two rigs whose segment directions
    differ slightly, which an X-first rule did not: our Human's clavicle tilts
    ~22 deg off horizontal while MakeHuman's sits within 14 deg of it, and the
    two rules disagreed there. No segment in either rig runs near Z.
    """
    anchor = (0.0, 0.0, 1.0)
    along = sum(anchor[a] * axis[a] for a in range(3))
    residual = [anchor[a] - along * axis[a] for a in range(3)]
    magnitude = math.sqrt(sum(c * c for c in residual))
    if magnitude <= 0.25:
        return None, None, None
    e2 = norm(residual)
    e1 = norm(cross(e2, axis))
    return e1, e2, round(magnitude, 6)


def girth(verts, head, tail, weighted):
    """Weighted mean perpendicular distance from the axis, plus per-axis RMS extent."""
    ax = norm([tail[a] - head[a] for a in range(3)])
    if ax is None:
        return None
    e1, e2, residual = perp_frame(ax)
    if e1 is None:
        return None
    total = acc = acc1 = acc2 = 0.0
    for idx, w in weighted:
        p = verts[idx]
        d = [p[a] - head[a] for a in range(3)]
        along = sum(d[a] * ax[a] for a in range(3))
        perp = [d[a] - along * ax[a] for a in range(3)]
        acc += w * math.sqrt(sum(c * c for c in perp))
        c1 = sum(perp[a] * e1[a] for a in range(3))
        c2 = sum(perp[a] * e2[a] for a in range(3))
        acc1 += w * c1 * c1
        acc2 += w * c2 * c2
        total += w
    if total <= 0:
        return None
    return {
        'mean': acc / total,
        'e1': math.sqrt(acc1 / total),
        'e2': math.sqrt(acc2 / total),
        'zResidual': residual,
    }


def main():
    verts, body = read_obj(FILES['base'])
    skel = json.loads(FILES['skel'].read_text())
    weights = json.loads(FILES['weights'].read_text())['weights']
    macro = read_target(FILES['macro'])
    lean = read_target(FILES['lean'])
    heavy = read_target(FILES['heavy'])

    bodies = {
        'lean': build(verts, [(macro, 1.0), (lean, 1.0)]),
        'mid': build(verts, [(macro, 1.0), (lean, 0.5), (heavy, 0.5)]),
        'heavy': build(verts, [(macro, 1.0), (heavy, 1.0)]),
    }
    raw_heights = {}
    ref = None
    for name in ('mid', 'lean', 'heavy'):
        if ref is None:
            ys = [bodies['mid'][i][1] for i in body]
            ref = max(ys) - min(ys)
        raw_heights[name] = normalise(bodies[name], body, ref)

    def weighted_for(bones):
        acc = {}
        for bone in bones:
            for idx, w in weights.get(bone, []):
                if idx in body and w >= MIN_WEIGHT:
                    acc[idx] = max(acc.get(idx, 0.0), w)
        return sorted(acc.items())

    rows = {}
    for joint, bones in SEGMENTS.items():
        weighted = weighted_for(bones)
        if not weighted:
            print(f'no weighted vertices for {joint}', file=sys.stderr)
            return 1
        head_key, tail_key = AXIS_OVERRIDE.get(
            joint, (skel['bones'][bones[0]]['head'], skel['bones'][bones[-1]]['tail']))
        measured = {}
        for name, verts_n in bodies.items():
            head = centroid(verts_n, skel['joints'][head_key])
            tail = centroid(verts_n, skel['joints'][tail_key])
            g = girth(verts_n, head, tail, weighted)
            if g is None:
                print(f'degenerate axis for {joint} on {name}', file=sys.stderr)
                return 1
            measured[name] = g
        rows[joint] = {
            'bones': bones,
            'vertices': len(weighted),
            'axis': [head_key, tail_key],
            'perpZResidual': measured['mid']['zResidual'],
            'girth': {k: {a: round(v[a], 6) for a in ('mean', 'e1', 'e2')} for k, v in measured.items()},
            'axisLabels': ['crossWidth', 'depth'],
            'slender': round(measured['lean']['mean'] / measured['mid']['mean'], 6),
            'stout': round(measured['heavy']['mean'] / measured['mid']['mean'], 6),
            'slenderAxes': [round(measured['lean']['e1'] / measured['mid']['e1'], 6),
                            round(measured['lean']['e2'] / measured['mid']['e2'], 6)],
            'stoutAxes': [round(measured['heavy']['e1'] / measured['mid']['e1'], 6),
                          round(measured['heavy']['e2'] / measured['mid']['e2'], 6)],
        }

    report = {
        'schema': 1,
        'generatedBy': 'scripts/character-assets/measure-makehuman-girth.py',
        'method': {
            'bodies': {
                'lean': 'base + caucasian-male-young + universal-male-old-minmuscle-minweight',
                'mid': 'base + caucasian-male-young + 0.5*lean-target + 0.5*heavy-target',
                'heavy': 'base + caucasian-male-young + universal-male-young-maxmuscle-maxweight',
            },
            'statureNormalisedTo': round(ref, 6),
            'rawStature': {k: round(v, 6) for k, v in raw_heights.items()},
            'girth': 'weight-averaged perpendicular distance from the bone head-to-tail axis',
            'axes': 'e1/e2 are weighted RMS extents along the two axes of the perpendicular plane, '
                    'e2 = world Z projected into that plane (body depth), e1 = cross(e2, axis)',
            'minBoneWeight': MIN_WEIGHT,
            'units': 'MakeHuman decimetre-scale source units; only ratios are used downstream',
        },
        'license': 'CC0 1.0 Universal (MakeHuman graphical assets)',
        'sources': {k: {'path': str(v), 'sha256': sha256(v)} for k, v in FILES.items()},
        'segments': rows,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(report, indent=1) + '\n')
    print(f'wrote {OUT}')
    for joint, row in rows.items():
        print(f"  {joint:26s} slender {row['slender']:.4f} {row['slenderAxes']}  "
              f"stout {row['stout']:.4f} {row['stoutAxes']}  {row['vertices']}v")
    return 0


if __name__ == '__main__':
    sys.exit(main())
