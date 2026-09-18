# Fire Blast sound

`fireball-julien-matthey.wav` is **Fireball** by **Julien Matthey**, shared under **CC0 1.0**.

- License/source page: https://opengameart.org/content/fireball-1
- Original linked source: https://freesound.org/people/Julien%20Matthey/sounds/105016/
- Download: https://opengameart.org/sites/default/files/105016__julien-matthey__jm-fx-fireball-01.wav
- License: https://creativecommons.org/publicdomain/zero/1.0/
- Downloaded 2026-09-17. Original WAV bytes preserved; filename shortened locally.
- Runtime playback: 0.9× speed, 0.8 sound volume, 0.65 master volume; no synthesised replacement audio. Playback, user-gesture unlock, mute and master-mix recording use Babylon Lite's existing audio API.

The adjacent Kenney license applies to the particle PNGs; this audio has separate authorship as described here.

SHA-256: `3992598c814de25c318780e506aeda673a7e410b7b3c4f0793883483ff9766b8`.

## Lava Ball reuse

`lava-charge.wav` derives from the same CC0 source above. FFmpeg recipe:

```sh
ffmpeg -i fireball-julien-matthey.wav -af 'areverse,atrim=duration=1.5,lowpass=f=1400,afade=t=in:d=0.7,afade=t=out:st=1.38:d=0.12' -c:a pcm_s16le lava-charge.wav
```

The charge plays at 0.48 volume through the shared 0.65 master. Release reuses the original at 0.75 playback rate / 0.36 volume; impact at 0.62 rate / 0.72 volume. `lava-audio-provenance.json` records the derivative's hash. No additional third-party source or license was introduced.
