#!/usr/bin/env python3
"""Stop-gate reminder: do not close a visual Ashen Reach cycle on stills alone."""
from __future__ import annotations

import json
import os
import re
import subprocess
import sys

VISUAL_PREFIXES = (
    "src/ashen-reach/",
    "public/ashen-reach/",
    "blender/",
    "scripts/ashen-reach/",
    ".agents/skills/blender-lite/",
)
GAME_RE = re.compile(
    r"\b(orc|wayfarer|graveweaver|churchyard|tunic|garment|sculpt|armory|"
    r"ve-capture|ashen-reach\.html|loincloth|walkthrough)\b",
    re.I,
)
MOTION_RE = re.compile(r"(?:tg file[^\n]*\.(?:gif|mp4)|\.mp4|\.gif|ve\.sparkify\.dev/\S+\.mp4)", re.I)
TELEGRAM_RE = re.compile(r"\b(telegram|tg file|message_id)\b", re.I)


def text_of(value) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value
    if isinstance(value, list):
        return "\n".join(text_of(item) for item in value)
    if isinstance(value, dict):
        return text_of(value.get("text") or value.get("content") or "")
    return str(value)


def dirty_paths(root: str) -> list[str]:
    try:
        out = subprocess.check_output(
            ["git", "-C", root, "status", "--porcelain", "-uall"],
            stderr=subprocess.DEVNULL,
            text=True,
            timeout=4,
        )
    except (OSError, subprocess.SubprocessError):
        return []
    paths = []
    for line in out.splitlines():
        if len(line) < 4:
            continue
        path = line[3:].split(" -> ")[-1].strip().strip('"')
        if not path:
            continue
        status = line[:2]
        # Print FBX leftovers and probe scripts are not a visual cycle.
        if path.startswith("blender/characters/sources/"):
            continue
        # Untracked probes must not count. New body/garment assets under
        # src/public still count even when untracked.
        if status == "??" and not path.startswith(("src/ashen-reach/", "public/ashen-reach/")):
            continue
        paths.append(path)
    return paths


def main() -> int:
    try:
        data = json.load(sys.stdin)
    except json.JSONDecodeError:
        return 0
    if data.get("reason") != "end_turn":
        return 0
    if data.get("subagentType"):
        return 0
    if data.get("stopHookActive"):
        return 0

    msg = text_of(data.get("lastAssistantMessage"))
    if MOTION_RE.search(msg) and TELEGRAM_RE.search(msg):
        return 0

    root = data.get("workspaceRoot") or os.environ.get("GROK_WORKSPACE_ROOT") or os.getcwd()
    visual_git = any(path.startswith(VISUAL_PREFIXES) for path in dirty_paths(root))
    if not visual_git and not GAME_RE.search(msg):
        return 0

    reason = (
        "This looks like a visual Ashen Reach cycle. Before stopping, send a reviewed live "
        "GIF or MP4 to Telegram with `tg file` (stills are not the end of the cycle). Put a VE "
        "video/mp4 URL in the caption if publication is authorized. If this turn was not visual "
        "work, say so and stop."
    )
    json.dump({"decision": "block", "reason": reason}, sys.stdout)
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
