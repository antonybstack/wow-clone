"""Original short bronze-bell cue. Deterministic offline authoring, not a runtime
audio synthesizer. Playback/decoding/mute remain with Babylon Lite's audio owner.
No source recording or third-party samples. 3.6 s mono PCM16 is below 250 KB.
"""
from pathlib import Path
import math
import struct
import wave

RATE, SECONDS = 22050, 3.6
PARTIALS = [(130.81, .42, .65), (261.95, .25, .9), (315.18, .18, 1.3),
            (520.70, .14, 1.9), (659.30, .10, 2.6), (893.15, .07, 3.2)]
samples = []
for i in range(round(RATE * SECONDS)):
    t = i / RATE
    attack = min(1, t / .008)
    fade = min(1, (SECONDS - t) / .28)
    value = attack * fade * sum(amp * math.exp(-decay*t) * math.sin(math.tau*hz*t)
                                for hz, amp, decay in PARTIALS)
    samples.append(value)
scale = .88 * 32767 / max(abs(v) for v in samples)
path = Path('public/ashen-reach/exploration/vaelmark-bell.wav')
path.parent.mkdir(parents=True, exist_ok=True)
with wave.open(str(path), 'wb') as cue:
    cue.setnchannels(1)
    cue.setsampwidth(2)
    cue.setframerate(RATE)
    cue.writeframes(b''.join(struct.pack('<h', round(v * scale)) for v in samples))
print(f'{path}: {path.stat().st_size} bytes, {SECONDS}s, original modal bell')
