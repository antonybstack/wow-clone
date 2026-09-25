"""Strict video inspection shared by capture encoding and Telegram delivery."""
import json
import math
import os
from pathlib import Path
import shutil
import subprocess


def media_binary(name):
    configured = os.environ.get(name.upper())
    found = configured or shutil.which(name)
    bundled = Path('/Applications/BabylonJS Editor.app/Contents/bin') / name
    if found:
        return found
    if bundled.is_file():
        return str(bundled)
    raise ValueError(f'{name} unavailable; set {name.upper()} to its executable')


def parse_probe(data):
    stream = next((s for s in data.get('streams', []) if s.get('codec_type') == 'video'), None)
    if not stream:
        raise ValueError('Video stream missing')
    width, height = stream.get('width'), stream.get('height')
    if not isinstance(width, int) or not isinstance(height, int) or min(width, height) <= 0:
        raise ValueError('Video dimensions missing or invalid')
    duration = float(stream.get('duration') or data.get('format', {}).get('duration') or 0)
    if not math.isfinite(duration) or duration <= 0:
        raise ValueError('Video duration missing or invalid')
    sar = stream.get('sample_aspect_ratio')
    if sar != '1:1':
        raise ValueError(f'Square pixel metadata required, got {sar!r}; normalize before delivery')
    rotations = [stream.get('tags', {}).get('rotate', 0)]
    rotations += [side['rotation'] for side in stream.get('side_data_list', []) if 'rotation' in side]
    if any(not math.isfinite(float(r)) or float(r) % 360 != 0 for r in rotations):
        raise ValueError('Video rotation must be normalized into pixels before delivery')
    return {'width': width, 'height': height, 'duration': duration,
            'sampleAspectRatio': sar, 'rotation': 0, 'codec': stream.get('codec_name')}


def probe_video(path):
    result = subprocess.run([media_binary('ffprobe'), '-v', 'error', '-show_streams',
                             '-show_format', '-of', 'json', str(path)], capture_output=True, text=True)
    if result.returncode:
        raise ValueError('ffprobe could not inspect the video')
    return parse_probe(json.loads(result.stdout))


def check_delivery(body, expected=None):
    # Never retain chat/user identifiers, tokens, captions or Telegram file IDs.
    result = body.get('result') or {}
    actual = result.get('video') or {}
    metadata = {'ok': body.get('ok') is True, 'messageId': result.get('message_id'),
                'expected': expected, 'returned': {k: actual.get(k) for k in ('width', 'height', 'duration')}
                if expected else None, 'verified': False}
    if not metadata['ok']:
        metadata['error'] = f"Telegram rejected send (code {body.get('error_code', 'unknown')})"
    elif expected and (actual.get('width'), actual.get('height')) != (expected['width'], expected['height']):
        metadata['error'] = 'Telegram returned dimensions that differ from the file'
    elif expected and (not isinstance(actual.get('duration'), (int, float)) or
                       not math.isfinite(actual['duration']) or abs(actual['duration'] - expected['duration']) > 1.01):
        metadata['error'] = 'Telegram returned missing or mismatched duration'
    else:
        metadata['verified'] = True
    return metadata


def jpeg_dimensions(path):
    data = Path(path).read_bytes()
    if data[:2] != b'\xff\xd8':
        raise ValueError('Source frame is not JPEG')
    offset = 2
    while offset + 8 < len(data):
        if data[offset] != 255:
            break
        offset += 1
        while data[offset] == 255:
            offset += 1
        marker = data[offset]
        offset += 1
        if marker in (0xda, 0xd9):
            break
        length = int.from_bytes(data[offset:offset + 2], 'big')
        if marker in (0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf):
            return (int.from_bytes(data[offset + 5:offset + 7], 'big'),
                    int.from_bytes(data[offset + 3:offset + 5], 'big'))
        if length < 2:
            break
        offset += length
    raise ValueError('Source JPEG dimensions missing')
