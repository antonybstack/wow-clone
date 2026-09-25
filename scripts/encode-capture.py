#!/usr/bin/env python3
"""Encode timestamped capture at its original dimensions and elapsed time."""
import json
from pathlib import Path
import subprocess
import sys
from lib.video_metadata import media_binary, probe_video, jpeg_dimensions


def encode(directory, destination):
    directory, destination = Path(directory).resolve(), Path(destination).resolve()
    manifest_path = directory / 'capture-manifest.json'
    manifest = json.loads(manifest_path.read_text())
    frames = manifest['frames']
    if len(frames) < 2:
        raise ValueError('At least two timestamped frames required')
    width, height = frames[0]['width'], frames[0]['height']
    if width % 2 or height % 2:
        raise ValueError('H.264 yuv420p requires even dimensions; capture an even viewport')
    lines = ['ffconcat version 1.0']
    for i, frame in enumerate(frames):
        if (frame['width'], frame['height']) != (width, height):
            raise ValueError('Capture dimensions changed during recording')
        name = frame['name']
        if Path(name).name != name or "'" in name or '\n' in name:
            raise ValueError('Unsafe frame name')
        # Read every actual JPEG header rather than trusting manifest dimensions.
        if jpeg_dimensions(directory / 'frames' / name) != (width, height):
            raise ValueError('Source frame dimensions differ from manifest')
        lines.extend([f"file 'frames/{name}'", 'option framerate 1000'])
        if i + 1 < len(frames):
            delta = frames[i + 1]['timestamp'] - frame['timestamp']
            if not 0 < delta < float('inf'):
                raise ValueError('Capture timestamps must increase')
            lines.append(f'duration {delta:.9f}')
    elapsed = frames[-1]['timestamp'] - frames[0]['timestamp']
    concat = directory / 'frames.ffconcat'
    concat.write_text('\n'.join(lines) + '\n')
    subprocess.run([media_binary('ffmpeg'), '-hide_banner', '-loglevel', 'warning', '-y',
                    '-f', 'concat', '-safe', '0', '-i', str(concat), '-map_metadata', '-1',
                    '-vf', 'setsar=1', '-c:v', 'libx264', '-x264-params', 'fps=60/1', '-preset', 'fast', '-crf', '19',
                    '-pix_fmt', 'yuv420p', '-fps_mode', 'vfr', '-video_track_timescale', '1000000',
                    '-metadata:s:v:0', 'rotate=0', '-movflags', '+faststart', str(destination)], check=True)
    encoded = probe_video(destination)
    if (encoded['width'], encoded['height']) != (width, height) or abs(encoded['duration'] - elapsed) > .05:
        raise ValueError('Encoded dimensions or elapsed time differ from the capture')
    manifest.update(encoded=encoded, elapsedSeconds=elapsed)
    manifest_path.write_text(json.dumps(manifest, indent=2) + '\n')
    print(json.dumps(encoded))


if __name__ == '__main__':
    encode(sys.argv[1], sys.argv[2])
