"""Background Blender: MakeHuman CC0 macros → orc-v1. Isolated; never shrine/MCP."""
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
            "prefix": "OrcV1",
            "blend": ROOT / "blender/characters/orc-v1.blend",
            "glb": ROOT / "public/characters/bodies/orc-v1.glb",
            "tex": ROOT / "public/characters/bodies/orc-v1-textures",
            "evid": ROOT / "ve-capture/m2d-races/orc",
            "report": ROOT / "ve-capture/m2d-races/orc/build-report.json",
            "target_height_m": 2.10,
            "neck_forward_deg": 13.0,
            "lateral_x_scale": 1.015,
            "hair_inflate": 0.022,
            "albedo_hsv": {"hue_deg": 92.0, "sat_scale": 1.10, "val_scale": 0.78},
            "hair_rgb": (0.42, 0.24, 0.08),
            "copyright": "Orc v1 derived from MakeHuman hm08 core assets (CC0)",
            "source_note": (
                "hm08 + caucasian-male-young + weighted maxmuscle/maxweight/maxheight "
                "+ shoulder/v-shape/horiz macros + Neck rest +13° + 1.015 lateral X; "
                "CC0 albedo HSV-shifted green; low-poly eyes + short01 + eyebrow001; "
                "height normalize 2.10 m"
            ),
            "targets": [
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
            ],
        }
    )


if __name__ == "__main__":
    main()
