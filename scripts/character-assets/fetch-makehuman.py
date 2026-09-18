#!/usr/bin/env python3
"""Download pinned MakeHuman CC0 core assets. Does not copy GPL/AGPL code.

Existing files are integrity-checked against pinned SHA256 (Human and race
manifests). Presence without a matching digest is not accepted.
"""
from __future__ import annotations

import hashlib
import json
import sys
import urllib.request
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PROV = json.loads(Path(__file__).with_name("provenance.json").read_text())


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def fetch_item(url: str, dest: Path, expected: str | None = None, verify_only: bool = False, zip_member: str | None = None) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    rel = dest.relative_to(ROOT)
    if dest.exists():
        digest = sha256(dest)
        if expected is None:
            raise SystemExit(f"unpinned file {rel} (refusing to trust presence alone)")
        if digest == expected:
            print(f"ok {rel}")
            return
        if verify_only:
            raise SystemExit(f"hash mismatch {rel}: {digest} != {expected}")
        print(f"mismatch {rel}; re-fetch")
    elif verify_only:
        raise SystemExit(f"missing {rel}")
    if not expected:
        raise SystemExit(f"no sha256 pin for {rel}")
    if zip_member:
        cache = ROOT / ".cache" / Path(url).name
        cache.parent.mkdir(parents=True, exist_ok=True)
        if not cache.exists() or cache.stat().st_size < 1024:
            print(f"get {url}")
            urllib.request.urlretrieve(url, cache)
        print(f"unzip {zip_member} -> {rel}")
        with zipfile.ZipFile(cache) as zf:
            dest.write_bytes(zf.read(zip_member))
    else:
        print(f"get {url}")
        urllib.request.urlretrieve(url, dest)
    digest = sha256(dest)
    if digest != expected:
        raise SystemExit(f"hash mismatch {rel}: {digest} != {expected}")
    print(f"ok {rel} {digest}")


def race_entries(spec: dict) -> list[tuple[str, str]]:
    out = []
    for item in spec["files"]:
        if isinstance(item, str):
            raise SystemExit(f"race manifest entry {item!r} has no sha256 pin")
        out.append((item["path"], item["sha256"]))
    return out


def main() -> None:
    verify_only = "--verify-only" in sys.argv
    for item in PROV["files"]:
        fetch_item(
            item["url"],
            ROOT / item["path"],
            item["sha256"],
            verify_only=verify_only,
            zip_member=item.get("zipMember"),
        )
    extra = Path(__file__).with_name("provenance-human-v2.json")
    if extra.exists():
        spec = json.loads(extra.read_text())
        for item in spec["files"]:
            fetch_item(
                item["url"],
                ROOT / item["path"],
                item["sha256"],
                verify_only=verify_only,
                zip_member=item.get("zipMember"),
            )
    races = Path(__file__).with_name("provenance-races.json")
    if races.exists():
        spec = json.loads(races.read_text())
        base = spec["baseUrl"]
        dest_dir = ROOT / "blender/characters/sources"
        for rel, digest in race_entries(spec):
            fetch_item(base + rel, dest_dir / Path(rel).name, digest, verify_only=verify_only)


if __name__ == "__main__":
    main()
