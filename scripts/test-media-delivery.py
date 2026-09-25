import copy
import importlib.util
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch
from lib.video_metadata import parse_probe, check_delivery, probe_video, media_binary

BASE = {'streams': [{'codec_type': 'video', 'codec_name': 'h264', 'width': 1280, 'height': 720,
                     'sample_aspect_ratio': '1:1', 'duration': '3.2'}]}


class VideoDelivery(unittest.TestCase):
    def test_landscape_and_portrait(self):
        for dimensions in [(1280, 720), (390, 844)]:
            data = copy.deepcopy(BASE)
            data['streams'][0].update(width=dimensions[0], height=dimensions[1])
            expected = parse_probe(data)
            response = {'ok': True, 'result': {'message_id': 10, 'chat': {'id': 'PRIVATE'},
                       'video': {'width': dimensions[0], 'height': dimensions[1], 'duration': 4,
                                 'file_id': 'PRIVATE'}}}
            checked = check_delivery(response, expected)
            self.assertTrue(checked['verified'])
            self.assertNotIn('PRIVATE', json.dumps(checked))

    def test_rotation(self):
        for key, value in [('tags', {'rotate': '90'}), ('side_data_list', [{'rotation': -90}])]:
            data = copy.deepcopy(BASE)
            data['streams'][0][key] = value
            with self.assertRaisesRegex(ValueError, 'rotation'):
                parse_probe(data)

    def test_missing_metadata(self):
        for key in ['width', 'height', 'duration', 'sample_aspect_ratio']:
            data = copy.deepcopy(BASE)
            del data['streams'][0][key]
            with self.assertRaises(ValueError):
                parse_probe(data)
        with self.assertRaises(ValueError):
            parse_probe({})

    def test_mismatched_response_and_missing_video(self):
        expected = parse_probe(BASE)
        for video in [{}, {'width': 720, 'height': 1280, 'duration': 4},
                      {'width': 1280, 'height': 720, 'duration': 99}]:
            self.assertFalse(check_delivery({'ok': True, 'result': {'video': video}}, expected)['verified'])
        self.assertFalse(check_delivery({'ok': False, 'error_code': 400}, expected)['verified'])

    def test_non_square_pixels(self):
        data = copy.deepcopy(BASE)
        data['streams'][0]['sample_aspect_ratio'] = '4:3'
        with self.assertRaisesRegex(ValueError, 'Square pixel'):
            parse_probe(data)

    def test_mismatched_delivery_never_enters_ledger(self):
        import telegram
        expected = parse_probe(BASE)
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / 'test.mp4'
            path.write_bytes(b'test')
            with patch.dict('os.environ', TELEGRAM_BOT_TOKEN='secret-token', TELEGRAM_CHAT_ID='secret-chat'), \
                 patch.object(telegram, 'probe_video', return_value=expected), \
                 patch.object(telegram, 'send', return_value={'ok': True, 'result': {'video': {'width': 720, 'height': 1280}}}), \
                 patch.object(telegram, 'ledger') as ledger:
                with self.assertRaisesRegex(ValueError, 'dimensions'):
                    telegram.main(['file', str(path)])
                ledger.assert_not_called()
            saved = Path(str(path) + '.telegram.json').read_text()
            self.assertNotIn('secret', saved)
            self.assertFalse(json.loads(saved)['verified'])

    def test_explicit_fields_and_secret_free_argv(self):
        import telegram
        with patch.object(telegram.subprocess, 'run', return_value=type('Result', (), {'returncode': 0, 'stdout': '{"ok": true}'})()) as run:
            telegram.send('sendVideo', dict(chat_id='secret-chat', width=1280, height=720, duration=46), 'secret-token')
            argv = run.call_args.args[0]
            self.assertNotIn('secret', str(argv))
            config = run.call_args.kwargs['input']
            for field in ['width=1280', 'height=720', 'duration=46']:
                self.assertIn(field, config)

    def test_actual_timestamp_encode_landscape_and_portrait(self):
        spec = importlib.util.spec_from_file_location('encoder', Path(__file__).with_name('encode-capture.py'))
        encoder = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(encoder)
        for width, height in [(1280, 720), (390, 844)]:
            with tempfile.TemporaryDirectory() as tmp:
                directory = Path(tmp)
                (directory / 'frames').mkdir()
                frames = []
                for i, timestamp in enumerate([20, 20.127, 20.510]):
                    name = f'frame-{i:05d}.jpg'
                    subprocess.run([media_binary('ffmpeg'), '-v', 'error', '-f', 'lavfi', '-i',
                                    f'color=c=blue:s={width}x{height}', '-frames:v', '1',
                                    str(directory / 'frames' / name)], check=True)
                    frames.append(dict(name=name, timestamp=timestamp, width=width, height=height))
                (directory / 'capture-manifest.json').write_text(json.dumps({'frames': frames}))
                encoder.encode(directory, directory / 'test.mp4')
                actual = probe_video(directory / 'test.mp4')
                self.assertEqual((actual['width'], actual['height']), (width, height))
                self.assertAlmostEqual(actual['duration'], .510, delta=.05)


if __name__ == '__main__':
    unittest.main()
