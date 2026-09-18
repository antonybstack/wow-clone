"""Hips character-space delta: behavior tests, not a copy of the implementation formula."""
from __future__ import annotations

import math
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from mathutils import Matrix, Vector

import retarget_anatomy as ra  # noqa: E402


def angle_deg(A, B):
    qa = A.to_quaternion()
    qb = B.to_quaternion()
    return math.degrees(qa.rotation_difference(qb).angle)


def axis_angle(R):
    q = R.to_quaternion()
    ax, an = q.axis, math.degrees(q.angle)
    return ax, an


class HipsCharacterDeltaTests(unittest.TestCase):
    def test_identity_source_leaves_dest_rest(self):
        src_rest = Matrix.Rotation(math.radians(73), 3, "X")
        dst_rest = Matrix.Rotation(math.radians(41), 3, "Y") @ Matrix.Rotation(math.radians(12), 3, "Z")
        C = Matrix.Identity(3)
        out = ra.hips_dest_pose_rotation(src_rest, src_rest, dst_rest, C)
        self.assertLess(angle_deg(out, dst_rest), 1e-4)

    def test_yaw_around_shared_up_matches_angle(self):
        """Same world up (+Z): source 20° yaw becomes dest 20° yaw, rest aims ignored."""
        src_rest = Matrix.Rotation(math.radians(90), 3, "X")  # aim along -Y
        yaw = Matrix.Rotation(math.radians(20), 3, "Z")
        src_pose = yaw @ src_rest
        dst_rest = Matrix.Rotation(math.radians(15), 3, "Y")
        C = Matrix.Identity(3)
        out = ra.hips_dest_pose_rotation(src_pose, src_rest, dst_rest, C)
        delta = out @ dst_rest.inverted()
        ax, an = axis_angle(delta)
        self.assertAlmostEqual(an, 20.0, places=4)
        self.assertGreater(abs(ax.z), 0.99)

    def test_src_y_up_dest_z_up_maps_yaw_to_dest_up(self):
        """Src character up +Y, dest up +Z; 25° src yaw about +Y → dest yaw about +Z."""
        # columns: right, forward, up
        Fs = Matrix((Vector((1, 0, 0)), Vector((0, 0, 1)), Vector((0, 1, 0)))).transposed()
        Fd = Matrix((Vector((1, 0, 0)), Vector((0, -1, 0)), Vector((0, 0, 1)))).transposed()
        C = ra.nearest_rotation(Fd @ Fs.inverted())
        src_rest = Matrix.Rotation(math.radians(80), 3, "X")
        yaw_src = Matrix.Rotation(math.radians(25), 3, "Y")
        src_pose = yaw_src @ src_rest
        dst_rest = Matrix.Rotation(math.radians(33), 3, "X")
        out = ra.hips_dest_pose_rotation(src_pose, src_rest, dst_rest, C)
        delta = out @ dst_rest.inverted()
        ax, an = axis_angle(delta)
        self.assertAlmostEqual(an, 25.0, places=3)
        self.assertGreater(abs(ax.z), 0.98)

    def test_scaled_matrices_still_orthonormal_output(self):
        scale = Matrix.Diagonal((0.01, 0.01, 0.01)).to_3x3()
        src_rest = scale @ Matrix.Rotation(math.radians(90), 3, "X")
        yaw = Matrix.Rotation(math.radians(10), 3, "Z")
        src_pose = scale @ yaw @ Matrix.Rotation(math.radians(90), 3, "X")
        dst_rest = Matrix.Rotation(math.radians(5), 3, "Y")
        out = ra.hips_dest_pose_rotation(src_pose, src_rest, dst_rest, Matrix.Identity(3))
        self.assertAlmostEqual(out.determinant(), 1.0, places=5)
        cols = [Vector(out.col[i]) for i in range(3)]
        for c in cols:
            self.assertAlmostEqual(c.length, 1.0, places=5)
        self.assertLess(abs(cols[0].dot(cols[1])), 1e-5)
        delta = out @ dst_rest.inverted()
        _, an = axis_angle(ra.nearest_rotation(delta))
        self.assertAlmostEqual(an, 10.0, places=3)

    def test_reflection_not_exported(self):
        bad = Matrix.Identity(3)
        bad[0] = -bad[0]
        out = ra.nearest_rotation(bad)
        self.assertGreater(out.determinant(), 0.99)

    def test_character_frame_uses_head_not_hips_aim(self):
        anat = {
            "Hips": {"head": Vector((0.0, 0.06, 0.93))},
            "Head": {"head": Vector((0.0, -0.02, 1.62))},
            "LeftUpLeg": {"head": Vector((0.11, 0.0, 0.93))},
            "RightUpLeg": {"head": Vector((-0.11, 0.0, 0.93))},
        }
        F = ra.character_frame(anat)
        up = Vector(F.col[2])
        self.assertGreater(up.z, 0.9)


if __name__ == "__main__":
    unittest.main(argv=[sys.argv[0]])
