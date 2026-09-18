"""Offline tests for race correction helpers. No Blender."""
from __future__ import annotations

import hashlib
import json
import sys
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(HERE))
import mh_io  # noqa: E402
import mh_race  # noqa: E402

SRC = ROOT / "blender/characters/sources"


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    h.update(path.read_bytes())
    return h.hexdigest()


class MhRaceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        verts, uvs, faces = mh_io.load_obj(SRC / "base.obj")
        mh_io.apply_target(verts, SRC / "caucasian-male-young.target", 1.0)
        verts = mh_io.mh_to_blender_meters(verts)
        bverts, uvs, loops = mh_io.body_mesh(verts, uvs, faces)
        skel = mh_io.load_skel(SRC / "default.mhskel")
        bones = mh_io.bones_world(skel, verts)
        full_w, _, _ = mh_io.load_weights_full(SRC / "default_weights.mhw", mh_io.BONE_RENAME)
        cls.verts = verts
        cls.bverts = bverts
        cls.loops = loops
        cls.bones = bones
        cls.full_w = full_w
        cls.keep = mh_race.shorts_face_indices(loops, full_w, bverts, bones)
        cls.stats = mh_race.shorts_topology_stats(loops, cls.keep)

    def test_shorts_one_component_three_openings(self):
        self.assertGreater(len(self.keep), 200)
        self.assertEqual(len(self.stats["componentVertexCounts"]), 1, self.stats)
        loops = self.stats["boundaryLoopLengths"]
        self.assertGreaterEqual(len(loops), 3, loops)
        self.assertEqual(len(loops), 3, f"expected waist+two legs, got {loops}")

    def test_shorts_not_world_z_human_box(self):
        zs = []
        for fi in self.keep:
            for vi, _ in self.loops[fi]:
                zs.append(self.bverts[vi][2])
        # Must include pelvis (~0.85) and not jump to chest (~1.2+)
        self.assertLess(min(zs), 0.70)
        self.assertGreater(max(zs), 0.85)
        self.assertLess(max(zs), 1.12)

    def test_shorts_bisect_planes_from_named_joints(self):
        planes = mh_race.shorts_bisect_planes(self.bones)
        for key in ("waist", "hemLeft", "hemRight"):
            self.assertIn(key, planes)
            self.assertEqual(len(planes[key]["point"]), 3)
            self.assertEqual(len(planes[key]["normal"]), 3)
            n = planes[key]["normal"]
            norm = (n[0] ** 2 + n[1] ** 2 + n[2] ** 2) ** 0.5
            self.assertAlmostEqual(norm, 1.0, places=6)
        # Waist sits above both hems (hems are lower on the leg).
        self.assertLess(planes["hemLeft"]["point"][2], planes["waist"]["point"][2])
        self.assertLess(planes["hemRight"]["point"][2], planes["waist"]["point"][2])
        # Hems are mirrored left/right (symmetric rest pose).
        self.assertAlmostEqual(
            planes["hemLeft"]["point"][0], -planes["hemRight"]["point"][0], places=6
        )
        self.assertAlmostEqual(
            planes["hemLeft"]["point"][2], planes["hemRight"]["point"][2], places=6
        )
        # Waist normal is pelvis-relative (perpendicular to the Hips bone axis,
        # not a bare (0,0,1)) but still mostly vertical.
        by = {b["name"]: b for b in self.bones}
        hips_axis = mh_race._unit(
            mh_race._vsub(by["Hips"]["tail"], by["Hips"]["head"])
        )
        dot = mh_race._vdot(hips_axis, planes["waist"]["normal"])
        self.assertLess(abs(dot), 1e-6, "waist normal must be perpendicular to Hips bone axis")
        self.assertGreater(planes["waist"]["normal"][2], 0.9)

    def test_metrics_use_named_joints(self):
        m = mh_race.metrics(self.bverts, self.bones)
        self.assertAlmostEqual(m["heightM"], mh_race.HUMAN_HEIGHT_M, places=3)
        self.assertGreater(m["shoulderWidthM"], 0.25)
        self.assertLess(m["shoulderWidthM"], 0.50)
        self.assertGreater(m["handLengthM"], 0.12)
        self.assertLess(m["handLengthM"], 0.25)
        self.assertGreater(m["palmWidthM"], 0.06)
        self.assertLess(m["palmWidthM"], 0.12)
        self.assertIsNone(m["handProxyM"])
        self.assertEqual(m["shoulderWidthEndpoints"]["LeftArm.head"][0] > 0, True)
        self.assertEqual(m["shoulderWidthEndpoints"]["RightArm.head"][0] < 0, True)
        self.assertIn("LeftArm.head", m["shoulderWidthDefinition"])
        self.assertIn("finger3-3.L.tail", m["handLengthDefinition"])

    def test_region_of_shoulder_not_head_bin(self):
        # Same verts previously labeled Human head / Undead torso via world Z.
        r = mh_race.region_of_weights(self.full_w[1380])
        self.assertIn(r, ("shoulder", "arm", "torso", "neck"))
        self.assertNotEqual(r, "head")

    def test_height_normalize_scales_feet_to_zero(self):
        verts = [list(v) for v in self.verts]
        info = mh_race.normalize_standing_height(verts, 2.10)
        zs = [v[2] for v in verts[: mh_io.BODY_VERTS]]
        self.assertAlmostEqual(min(zs), 0.0, places=6)
        self.assertAlmostEqual(max(zs) - min(zs), 2.10, places=5)
        self.assertAlmostEqual(info["preHeightM"], mh_race.HUMAN_HEIGHT_M, places=3)

    def test_race_manifest_pins_every_file(self):
        spec = json.loads((HERE / "provenance-races.json").read_text())
        self.assertTrue(spec["files"])
        for item in spec["files"]:
            self.assertIsInstance(item, dict)
            self.assertRegex(item["sha256"], r"^[0-9a-f]{64}$")
            dest = SRC / Path(item["path"]).name
            self.assertTrue(dest.exists(), dest)
            self.assertEqual(sha256(dest), item["sha256"], item["path"])

    def test_human_manifest_untouched_shape(self):
        spec = json.loads((HERE / "provenance.json").read_text())
        self.assertEqual(spec["asset"], "human-v1")
        self.assertEqual(len(spec["files"]), 6)
        for item in spec["files"]:
            dest = ROOT / item["path"]
            self.assertEqual(sha256(dest), item["sha256"], item["path"])


class ReduceWeightsPoseAwareTests(unittest.TestCase):
    """Synthetic 6-influence vertex: no Blender, no armature, just a hand-built
    6-bone rig (identity rest matrices, two crafted sample poses) so the pose-
    aware solver has a ground truth to beat.
    """

    @staticmethod
    def _identity():
        return [[1.0 if i == j else 0.0 for j in range(4)] for i in range(4)]

    @staticmethod
    def _translate(dx, dy, dz):
        m = ReduceWeightsPoseAwareTests._identity()
        m[0][3], m[1][3], m[2][3] = dx, dy, dz
        return m

    def setUp(self):
        self.bones = ["B1", "B2", "B3", "B4", "B5", "B6"]
        self.parents = {b: None for b in self.bones}
        self.rest_mats = {b: self._identity() for b in self.bones}
        # Two sample poses. B5/B6 carry large, near-cancelling translations so a
        # naive "top-4 raw weight, fold rest onto first kept bone" reduction
        # (mh_io.reduce_weights's strategy) reproduces the full-weight target
        # noticeably worse than a least-squares fit over the same 4 bones.
        self.pose_mats = {
            "poseA": {
                "B1": self._translate(1, 0, 0),
                "B2": self._translate(0, 1, 0),
                "B3": self._translate(0, 0, 1),
                "B4": self._translate(1, 1, 1),
                "B5": self._translate(5, 5, 5),
                "B6": self._translate(-5, -5, -5),
            },
            "poseB": {
                "B1": self._translate(2, 0, 0),
                "B2": self._translate(0, 2, 0),
                "B3": self._translate(0, 0, 2),
                "B4": self._translate(2, 2, 2),
                "B5": self._translate(10, 10, 10),
                "B6": self._translate(-10, -10, -10),
            },
        }
        # 6 influences, all > the 0.01 non-negligible threshold -> must go
        # through the solver branch (not the plain top-4-fold passthrough).
        self.infl = {
            "B1": 0.30,
            "B2": 0.25,
            "B3": 0.20,
            "B4": 0.15,
            "B5": 0.06,
            "B6": 0.04,
        }
        self.rest_positions = [(0.0, 0.0, 0.0)]

    def _lbs(self, weights_dict, pose):
        import numpy as np

        p = (0.0, 0.0, 0.0, 1.0)
        total = [0.0, 0.0, 0.0]
        for name, w in weights_dict.items():
            mat = np.asarray(self.pose_mats[pose][name])
            r = mat @ np.asarray(p)
            total[0] += w * r[0]
            total[1] += w * r[1]
            total[2] += w * r[2]
        return total

    def test_solver_branch_used_for_6_influences(self):
        limited, stats = mh_race.reduce_weights_pose_aware(
            [self.infl], self.parents, self.rest_mats, self.pose_mats, self.rest_positions
        )
        self.assertEqual(stats["solvedVertexCount"], 1)
        self.assertEqual(len(limited), 1)
        self.assertLessEqual(len(limited[0]), 4)
        total_w = sum(w for _, w in limited[0])
        self.assertAlmostEqual(total_w, 1.0, places=6)
        for _, w in limited[0]:
            self.assertGreaterEqual(w, 0.0)

    def test_solver_beats_naive_top4_fold(self):
        import math

        limited, stats = mh_race.reduce_weights_pose_aware(
            [self.infl], self.parents, self.rest_mats, self.pose_mats, self.rest_positions
        )
        solved_weights = dict(limited[0])

        # Naive baseline: exactly mh_io.reduce_weights's own strategy (top-4 raw
        # weight, fold the remainder onto the first kept bone, normalize).
        naive_limited, _, _ = mh_io.reduce_weights([self.infl], self.parents, 4)
        naive_weights = dict(naive_limited[0])

        for pose in ("poseA", "poseB"):
            target = self._lbs(self.infl, pose)
            solved = self._lbs(solved_weights, pose)
            naive = self._lbs(naive_weights, pose)
            err_solved = math.dist(target, solved)
            err_naive = math.dist(target, naive)
            self.assertLess(
                err_solved,
                err_naive - 1e-9,
                f"{pose}: solved err {err_solved} should beat naive fold err {err_naive}",
            )
        # And the reported per-pose max error matches this vertex's own error
        # (only one vertex was solved).
        for pose in ("poseA", "poseB"):
            target = self._lbs(self.infl, pose)
            solved = self._lbs(solved_weights, pose)
            self.assertAlmostEqual(
                stats["poseMaxErrorM"][pose], math.dist(target, solved), places=9
            )

    def test_small_influence_count_passes_through(self):
        infl4 = {"B1": 0.4, "B2": 0.3, "B3": 0.2, "B4": 0.1}
        limited, stats = mh_race.reduce_weights_pose_aware(
            [infl4], self.parents, self.rest_mats, self.pose_mats, self.rest_positions
        )
        self.assertEqual(stats["solvedVertexCount"], 0)
        self.assertEqual(dict(limited[0]), infl4)


class ReduceWeightsSpinePelvisRegression(unittest.TestCase):
    """Reproduces Human vid 4335: Spine 0.666 vs pelvis pair, fitting poses that
    never move Spine/pelvis (so those columns are identical) while a small
    limb bone moves. Prior reducer drops Spine; the protected/prior path must
    keep it and match a held-out Hips/Spine/leg differential.
    """

    @staticmethod
    def _identity():
        return [[1.0 if i == j else 0.0 for j in range(4)] for i in range(4)]

    @staticmethod
    def _translate(dx, dy, dz):
        m = ReduceWeightsSpinePelvisRegression._identity()
        m[0][3], m[1][3], m[2][3] = dx, dy, dz
        return m

    def setUp(self):
        self.bones = [
            "Spine",
            "spine04",
            "pelvis.R",
            "pelvis.L",
            "RightUpLeg",
            "LeftUpLeg",
            "upperleg02.R",
            "upperleg02.L",
        ]
        self.parents = {b: None for b in self.bones}
        self.rest_mats = {b: self._identity() for b in self.bones}
        ident = {b: self._identity() for b in self.bones}
        # Fitting samples: Spine and all pelvis bones stay at rest (tied).
        # Only RightUpLeg translates — the old max-error race keeps the limb
        # bone and discards Spine.
        pose_leg = dict(ident)
        pose_leg["RightUpLeg"] = self._translate(0.0, 0.0, 0.20)
        pose_leg2 = dict(ident)
        pose_leg2["RightUpLeg"] = self._translate(0.0, 0.0, 0.10)
        self.fit_poses = {"tied_rest": ident, "tied_leg": pose_leg, "tied_leg2": pose_leg2}
        # Held-out: Spine and pelvis move differently; thigh also moves.
        held = dict(ident)
        held["Spine"] = self._translate(0.0, 0.0, 0.15)
        held["spine04"] = self._translate(0.0, 0.0, 0.12)
        held["pelvis.R"] = self._translate(0.08, 0.0, 0.0)
        held["pelvis.L"] = self._translate(-0.08, 0.0, 0.0)
        held["LeftUpLeg"] = self._translate(0.0, 0.05, 0.0)
        self.held_poses = {"heldout_torso_leg": held}
        self.infl = {
            "Spine": 0.666,
            "spine04": 0.110,
            "pelvis.R": 0.058,
            "pelvis.L": 0.058,
            "RightUpLeg": 0.049,
            "LeftUpLeg": 0.049,
            "upperleg02.R": 0.008,
            "upperleg02.L": 0.008,
        }
        self.rest_positions = [(0.0, -0.13, 0.91)]

    def _lbs(self, weights_dict, pose_mats):
        import numpy as np

        p = np.array(list(self.rest_positions[0]) + [1.0])
        acc = np.zeros(3)
        tot = sum(weights_dict.values()) or 1.0
        rest = np.asarray(self.rest_mats["Spine"])
        for name, w in weights_dict.items():
            D = np.asarray(pose_mats[name]) @ np.linalg.inv(rest)
            acc += (w / tot) * (D @ p)[:3]
        return acc

    def _run(self, pose_mats_by_pose, **kwargs):
        return mh_race.reduce_weights_pose_aware(
            [self.infl],
            self.parents,
            self.rest_mats,
            pose_mats_by_pose,
            self.rest_positions,
            **kwargs,
        )

    def test_prior_reducer_dilutes_spine_on_tied_samples(self):
        limited, stats = self._run(
            self.fit_poses, protect_min_weight=0.0, prior_lambda=0.0, tie_m=0.0
        )
        w = dict(limited[0])
        self.assertEqual(stats["solvedVertexCount"], 1)
        self.assertLess(
            w.get("Spine", 0.0),
            0.45,
            f"prior reducer should dilute Spine (source 0.666) when samples are tied; got {limited[0]}",
        )

    def test_protected_reducer_keeps_spine_on_tied_samples(self):
        limited, _ = self._run(self.fit_poses)
        names = {n for n, _ in limited[0]}
        self.assertIn("Spine", names, limited[0])
        w_spine = dict(limited[0])["Spine"]
        self.assertGreater(w_spine, 0.5, limited[0])
        self.assertLessEqual(len(limited[0]), 4)
        self.assertAlmostEqual(sum(w for _, w in limited[0]), 1.0, places=6)
        for _, w in limited[0]:
            self.assertGreaterEqual(w, 0.0)

    def test_heldout_torso_leg_beats_prior_reducer(self):
        import math

        limited, _ = self._run(self.fit_poses)
        solved = dict(limited[0])
        target = self._lbs(self.infl, self.held_poses["heldout_torso_leg"])
        pred = self._lbs(solved, self.held_poses["heldout_torso_leg"])
        err = math.dist(target, pred)

        old, _ = self._run(
            self.fit_poses, protect_min_weight=0.0, prior_lambda=0.0, tie_m=0.0
        )
        old_w = dict(old[0])
        old_pred = self._lbs(old_w, self.held_poses["heldout_torso_leg"])
        old_err = math.dist(target, old_pred)
        self.assertLess(err, old_err - 0.015, f"old {old_err} new {err} new_w {solved} old_w {old_w}")
        self.assertLess(err, 0.025, f"held-out err {err} m with {solved}")

    def test_fitting_torso_differential_holdout_under_8mm(self):
        """Production path: SKIN_POSES-like Hips/Spine samples in the fit set."""
        import math

        ident = {b: self._identity() for b in self.bones}
        spine_bend = dict(ident)
        spine_bend["Spine"] = self._translate(0.0, 0.0, 0.10)
        spine_bend["spine04"] = self._translate(0.0, 0.0, 0.06)
        pelvis_yaw = dict(ident)
        pelvis_yaw["pelvis.R"] = self._translate(0.06, 0.0, 0.0)
        pelvis_yaw["pelvis.L"] = self._translate(-0.06, 0.0, 0.0)
        counter = dict(ident)
        counter["Spine"] = self._translate(0.0, 0.0, -0.08)
        counter["pelvis.R"] = self._translate(0.04, 0.0, 0.0)
        counter["pelvis.L"] = self._translate(-0.04, 0.0, 0.0)
        fit = dict(self.fit_poses)
        fit["torso_spine_bend"] = spine_bend
        fit["torso_pelvis_twist"] = pelvis_yaw
        fit["torso_counter"] = counter
        limited, _ = self._run(fit)
        solved = dict(limited[0])
        self.assertGreater(solved.get("Spine", 0.0), 0.5, limited[0])
        target = self._lbs(self.infl, self.held_poses["heldout_torso_leg"])
        pred = self._lbs(solved, self.held_poses["heldout_torso_leg"])
        err = math.dist(target, pred)
        self.assertLess(err, 0.008, f"held-out err {err} m with {solved}")


if __name__ == "__main__":
    unittest.main()
