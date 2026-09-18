"""Background Blender: MakeHuman CC0 macros + authored rest hunch → undead-v1."""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(Path(__file__).resolve().parent))
import mh_studio  # noqa: E402

SRC = ROOT / "blender/characters/sources"


def T(rel, w=1.0):
    return (SRC / rel, w)


def main():
    mh_studio.run_race(
        {
            "src": SRC,
            "prefix": "UndeadV1",
            "blend": ROOT / "blender/characters/undead-v1.blend",
            "glb": ROOT / "public/characters/bodies/undead-v1.glb",
            "tex": ROOT / "public/characters/bodies/undead-v1-textures",
            "evid": ROOT / "ve-capture/m2d-races/undead",
            "report": ROOT / "ve-capture/m2d-races/undead/build-report.json",
            "target_height_m": 1.66,
            "hunch": {"pivot_name": "Spine2", "max_deg": 16.0},
            "hair_inflate": 0.017,
            "albedo_hsv": {"hue_deg": 70.0, "sat_scale": 0.30, "val_scale": 0.58},
            "hair_rgb": (0.40, 0.42, 0.36),
            "eye_hsv": {"hue_deg": 25.0, "sat_scale": 0.45, "val_scale": 0.88},
            "copyright": "Undead v1 derived from MakeHuman hm08 core assets (CC0)",
            "source_note": (
                "hm08 + caucasian-male-old + weighted minmuscle/minweight/minheight "
                "+ sunken face macros + Spine2 rest hunch 16°; CC0 albedo HSV-shifted "
                "grey-green; low-poly eyes + short01 + eyebrow001; height 1.66 m"
            ),
            "targets": [
                T("caucasian-male-old.target"),
                T("universal-male-old-minmuscle-minweight.target", 0.35),
                T("male-old-minmuscle-minweight-minheight.target", 0.05),
                T("measure-shoulder-dist-decr.target", 0.45),
                T("measure-bust-circ-decr.target", 0.36),
                T("measure-upperarm-circ-decr.target", 0.20),
                T("measure-thigh-circ-decr.target", 0.25),
                T("measure-calf-circ-decr.target", 0.22),
                T("measure-waist-circ-decr.target", 0.32),
                T("measure-neck-circ-decr.target", 0.16),
                T("measure-wrist-circ-decr.target", 0.14),
                T("chin-triangle.target", 0.85),
                T("chin-width-decr.target", 0.70),
                T("chin-height-decr.target", 0.65),
                T("head-scale-vert-decr.target", 0.40),
                T("eyebrows-trans-down.target", 0.60),
                T("forehead-temple-incr.target", 0.35),
                T("l-hand-scale-decr.target", 0.25),
                T("r-hand-scale-decr.target", 0.25),
                T("l-hand-fingers-length-incr.target", 0.55),
                T("r-hand-fingers-length-incr.target", 0.55),
                T("l-foot-scale-decr.target", 0.35),
                T("r-foot-scale-decr.target", 0.35),
                T("eye-left-opened-up.target", 0.70),
                T("eye-right-opened-up.target", 0.70),
                T("l-eye-height1-incr.target", 0.35),
                T("r-eye-height1-incr.target", 0.35),
            ],
        }
    )


if __name__ == "__main__":
    main()
