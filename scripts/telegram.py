#!/usr/bin/env python3
"""Telegram delivery without credentials in argv, logs or persisted responses."""
import datetime
import hashlib
import json
import math
import os
from pathlib import Path
import subprocess
import sys
from lib.video_metadata import check_delivery, probe_video


def git(*args):
    return subprocess.check_output(['git', *args], text=True, stderr=subprocess.DEVNULL).strip()


def ledger(path):
    try:
        root, sha = Path(git('rev-parse', '--show-toplevel')), git('rev-parse', 'HEAD')
    except subprocess.CalledProcessError:
        return
    folder = root / '.claude'
    folder.mkdir(exist_ok=True)
    with (folder / 'telegram-deliveries.log').open('a') as out:
        out.write(f'{datetime.datetime.now(datetime.timezone.utc).isoformat()} {sha} {path}\n')


def send(method, fields, token, path=None, field=None):
    # curl uses the system trust store (including the development proxy CA).
    # Config travels over stdin, so credentials cannot appear in process arguments.
    config = [f'url = {json.dumps(f"https://api.telegram.org/bot{token}/{method}")}',
              'silent', 'show-error', 'max-time = 900']
    config.extend(f'form-string = {json.dumps(f"{key}={value}")}' for key, value in fields.items())
    if path:
        filename = str(path.resolve()).replace('\\', '\\\\').replace('"', '\\"')
        config.append('form = ' + json.dumps(f'{field}=@"{filename}"'))
    response = subprocess.run(['curl', '-q', '--config', '-'], input='\n'.join(config) + '\n',
                              capture_output=True, text=True)
    if response.returncode:
        raise ValueError(f'Telegram upload transport failed (curl {response.returncode})')
    try:
        return json.loads(response.stdout)
    except json.JSONDecodeError:
        raise ValueError('Telegram returned invalid JSON') from None


def main(args):
    if not args or args[0] not in ('file', 'text', 'record') or len(args) < 2:
        raise ValueError('usage: tg file <path> [caption] | tg text <message> | tg record <path>')
    command = args[0]
    if command == 'record':
        ledger(args[1])
        print(f'recorded delivery at {git("rev-parse", "--short", "HEAD")}')
        return
    token, chat = os.environ.get('TELEGRAM_BOT_TOKEN'), os.environ.get('TELEGRAM_CHAT_ID')
    if not token or not chat:
        raise ValueError('TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID must be set')
    fields, path, expected, field = {'chat_id': chat}, None, None, None
    if command == 'text':
        method, fields['text'] = 'sendMessage', ' '.join(args[1:])
    else:
        path, caption = Path(args[1]), ' '.join(args[2:])
        if not path.is_file():
            raise ValueError('File does not exist')
        if len(caption.encode('utf-16-le')) // 2 > 1024:
            raise ValueError('Telegram caption exceeds 1024 characters')
        fields['caption'] = caption
        suffix = path.suffix.lower()
        if suffix in ('.mp4', '.mov', '.webm'):
            expected = probe_video(path)
            method, field = 'sendVideo', 'video'
            fields.update(width=expected['width'], height=expected['height'],
                          duration=math.ceil(expected['duration']), supports_streaming='true')
        elif suffix == '.gif':
            method, field = 'sendAnimation', 'animation'
        elif suffix in ('.png', '.jpg', '.jpeg'):
            method, field = 'sendPhoto', 'photo'
        else:
            method, field = 'sendDocument', 'document'
    checked = check_delivery(send(method, fields, token, path, field), expected)
    if path:
        checked.update(file=path.name, sha256=hashlib.sha256(path.read_bytes()).hexdigest(),
                       sentAt=datetime.datetime.now(datetime.timezone.utc).isoformat())
        Path(str(path) + '.telegram.json').write_text(json.dumps(checked, indent=2) + '\n')
    if not checked['verified']:
        raise ValueError(checked['error'])
    ledger(str(path) if path else 'message')
    print(f'sent, message_id {checked["messageId"]}' +
          (f'; verified {expected["width"]}x{expected["height"]}, {expected["duration"]:.3f}s' if expected else ''))


if __name__ == '__main__':
    try:
        main(sys.argv[1:])
    except Exception as error:
        # Network exception strings may contain request details. Only our validation errors are safe.
        print(f'telegram failed: {error if isinstance(error, ValueError) else type(error).__name__}', file=sys.stderr)
        sys.exit(1)
