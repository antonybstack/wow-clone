"""Parametric Mixamo → hm08 bake. Same bone map as Human v1.

Isolated Blender 5.2 `--background` only. Never MCP 9876 or an interactive Blender scene.

  /Applications/Blender.app/Contents/MacOS/Blender --background --python \\
    scripts/character-assets/retarget_profile.py -- --profile human|orc|undead
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from retarget_human_v1 import configure_profile, main  # noqa: E402


def parse_profile():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser(prog="retarget_profile.py")
    parser.add_argument("--profile", choices=("human", "orc", "undead"), required=True)
    return parser.parse_args(argv)


if __name__ == "__main__":
    args = parse_profile()
    configure_profile(args.profile)
    main()
