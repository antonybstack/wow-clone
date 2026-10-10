# C05 ops result — 2026-10-10

Two independent commands. No live acceptance claims.

## Commands and exits

| # | command | log | exit |
|---|---------|-----|------|
| 1 | `python3 scripts/encode-capture.py .cache/combat-c05-2026-10-10/capture .cache/combat-c05-2026-10-10/c05-brand.mp4 2200` | `encode.log` | **0** |
| 2 | `npm run build` | `build-final.log` | **0** |

**Commands: 2/2 success, 0 failure.**

## Encode

Clip: `.cache/combat-c05-2026-10-10/c05-brand.mp4`  
size_bytes: **6851840**

`encode.log` tail / `probe_video`:

```json
{"width": 1280, "height": 720, "duration": 24.202764, "sampleAspectRatio": "1:1", "rotation": 0, "codec": "h264"}
```

| field | value |
|-------|-------|
| width | 1280 |
| height | 720 |
| duration | 24.202764 s |
| sampleAspectRatio | 1:1 |
| rotation | 0 |
| codec | h264 |

Non-fatal: `[swscaler] deprecated pixel format used, make sure you did set range correctly`

## Build

- Exit **0**
- `✓ built in 3.83s`
- Non-fatal: chunk >500 kB after minification
- Non-fatal: `INEFFECTIVE_DYNAMIC_IMPORT` (`src/ashen-reach/startup-assets.js`)

## Limitations

- Encoder and build only. No play, capture review, or live acceptance.
- Clip metadata is from the encoder probe / `scripts/lib/video_metadata.py`, not a game-session check.
- Build writes `dist/` as a side effect of `npm run build`.
