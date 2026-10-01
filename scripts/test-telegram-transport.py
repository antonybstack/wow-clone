"""Exercise real curl multipart decoding against a local server, without Telegram.

No production credentials, chat, upload or ledger mutation is involved.
"""
import json
from email.parser import BytesParser
from email.policy import default
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
import sys
import tempfile
import threading
import unittest
from urllib.parse import unquote
from unittest.mock import patch
import subprocess

sys.path.insert(0, str(Path(__file__).parent))
from telegram import send


class TransportTest(unittest.TestCase):
    def test_unicode_quotes_lines_and_file_name_survive_real_curl(self):
        received = {}

        class Handler(BaseHTTPRequestHandler):
            def log_message(self, *args):
                pass

            def do_POST(self):
                body = self.rfile.read(int(self.headers['Content-Length']))
                message = BytesParser(policy=default).parsebytes(
                    f'Content-Type: {self.headers["Content-Type"]}\r\n\r\n'.encode() + body)
                for part in message.iter_parts():
                    name = part.get_param('name', header='content-disposition')
                    received[name] = part.get_payload(decode=True).decode('utf-8')
                    if part.get_filename():
                        received['filename'] = part.get_filename()
                self.send_response(200)
                self.end_headers()
                self.wfile.write(b'{"ok":true,"result":{"message_id":1}}')

        server = HTTPServer(('127.0.0.1', 0), Handler)
        thread = threading.Thread(target=server.handle_request, daemon=True)
        thread.start()
        original_run = subprocess.run

        def local_run(args, **kwargs):
            # Only replace this test's synthetic destination. Production send()
            # still puts the real URL/token solely on stdin, never in argv.
            kwargs['input'] = kwargs['input'].replace(
                'https://api.telegram.org/botFAKE/sendVideo',
                f'http://127.0.0.1:{server.server_port}/sendVideo')
            self.assertNotIn('FAKE', ' '.join(args))
            return original_run(args, **kwargs)

        caption = '1280×720 — ±0.95; 🧙 "quoted"\nsecond line \\ literal'
        try:
            with tempfile.TemporaryDirectory(prefix='ashen-telegram-') as directory:
                path = Path(directory) / 'é video "review".mp4'
                path.write_text('test media', encoding='utf-8')
                with patch('telegram.subprocess.run', side_effect=local_run):
                    response = send('sendVideo', {'chat_id': 'TEST', 'caption': caption,
                                                 'width':1280,'height':720,'duration':2},
                                    'FAKE', path, 'video')
                self.assertTrue(response['ok'])
                self.assertEqual(received['caption'], caption)
                self.assertEqual(received['video'], 'test media')
                # curl percent-encodes quotes in multipart filenames (RFC 7578).
                self.assertEqual(unquote(received['filename']), path.name)
                self.assertEqual(received['width'], '1280')
                self.assertEqual(received['height'], '720')
        finally:
            thread.join(timeout=2)
            server.server_close()


if __name__ == '__main__':
    unittest.main()
