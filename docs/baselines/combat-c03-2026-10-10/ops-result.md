# C03 ops result — 2026-10-10

All three prepared commands finished. No product edits, commit, upload, send, browsers, or extra work.

## Command exit codes

| # | command | log | exit |
|---|---------|-----|------|
| 1 | `node --test` 8 combat scripts | `tests-final.log` | **0** |
| 2 | `npm run build` | `build.log` | **0** |
| 3 | `python3 scripts/encode-capture.py capture-v2 c03-native-combat.mp4 2200` | `encode.log` | **0** |

**Commands: 3/3 success, 0 failure.**

## Tests (`node --test`)

TAP footer from `tests-final.log`:

```
1..54
# tests 54
# suites 0
# pass 54
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 231.287084
```

Counted from TAP lines: `ok` **54**, `not ok` **0**.

| metric | count |
|--------|------:|
| tests | 54 |
| pass | 54 |
| fail | 0 |
| cancelled | 0 |
| skipped | 0 |
| todo | 0 |
| suites | 0 |

Files: `test-action-scheduler.mjs`, `test-combat-movement-policy.mjs`, `test-auto-attack.mjs`, `test-fire-blast.mjs`, `test-lava-ball.mjs`, `test-grave-pulse.mjs`, `test-spell-visibility.mjs`, `test-enemy-contact.mjs`.

Non-fatal: Node `NO_COLOR` ignored because `FORCE_COLOR` is set.

## Build (`npm run build`)

- Exit **0**
- `✓ built in 3.71s`
- Non-fatal: chunk >500 kB (`lite-runtime-B9tnD2YO.js` 824.30 kB)
- Non-fatal: `INEFFECTIVE_DYNAMIC_IMPORT` (`src/ashen-reach/startup-assets.js`)

## Encode / clip probe

Clip: `.cache/combat-c03-2026-10-10/c03-native-combat.mp4`
Size: **4780344** bytes (4,780,344)

Encoder already probed (same object as `scripts/lib/video_metadata.py` `probe_video`):

```json
{"width": 1280, "height": 720, "duration": 16.681415, "sampleAspectRatio": "1:1", "rotation": 0, "codec": "h264"}
```

| field | value |
|-------|-------|
| width | 1280 |
| height | 720 |
| duration | 16.681415 s |
| sampleAspectRatio | 1:1 |
| rotation | 0 |
| codec | h264 |
| size_bytes | 4780344 |

Non-fatal: `[swscaler] deprecated pixel format used, make sure you did set range correctly`

Approximate bitrate from size/duration: 4780344 * 8 / 16.681415 ≈ 2.293 Mbps.

## Totals

- Commands succeeded: **3**
- Commands failed: **0**
- Tests passed: **54**
- Tests failed: **0**
- Clip written and probed: **yes**
