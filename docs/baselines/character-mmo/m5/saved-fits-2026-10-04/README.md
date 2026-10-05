# Saved-route fit evidence

See [result and limits](../../../../plans/character-mmo/results/m5-saved-fits-2026-10-04.md).
`fits.json` is the exact final live data, serialized compactly: 630 captures, 450
full-body rows with native actor/morph/coverage checks and 180 independent detail
rows. All runtime/console/GPU errors are empty; Havok is active with zero recoveries.
The deliberately inverted `negative-control.json`/log must fail. It changes the
prediction, not the game. These assertions do not substitute for image/motion review.

PNGs here are selected original game screenshots and labelled crop/resize review
sheets from actual game screenshots/decoded MP4 frames. No character pixels are
retouched. Every one of the 630 originals can be regenerated with the existing
helper; raw copies remain locally in `.cache/character-mmo/m5-saved-fits-2026-10-04/matrix`.
`decoded-samples.json` records the 51 actual MP4 sample times. Source JPEG frames
are in ignored `ve-capture/character-mmo/m5-saved-fits-2026-10-04/young-hair`;
`capture-manifest.json` records source surfaces, dimensions and timestamps.
Recover the exact clip through the content-addressed
[VE URL](https://ve.sparkify.dev/wow-clone/ashen-reach/character-mmo/m5-saved-fits-2026-10-04-a45481a376da.mp4),
then check SHA-256 `a45481a376da24a1addf265c5266cb78636f559ea559470902fec826c8bb59a8`.
Telegram 856 and sanitized delivery/playback receipts accompany this checkpoint.

Reproduction, after auditing the machine and owning one blank CDP harness:

```sh
ASHEN_IDENTITY_SAVED=1 ASHEN_CDP_PORT=10037 ASHEN_TEST_URL=http://127.0.0.1:7174/ \
  node scripts/character-assets/check-human-identity-current-fits.mjs
ASHEN_IDENTITY_SAVED=1 ASHEN_IDENTITY_FIT_CONTROL=1 ASHEN_IDENTITY_OUTFITS=graveweaver \
  ASHEN_CDP_PORT=10037 ASHEN_TEST_URL=http://127.0.0.1:7174/ \
  ASHEN_IDENTITY_REVIEW_OUT=.cache/character-mmo/saved-fit-control \
  node scripts/character-assets/check-human-identity-current-fits.mjs young-hair
ASHEN_IDENTITY_SAVED=1 ASHEN_IDENTITY_FIT_MOTION=1 ASHEN_CDP_PORT=10037 \
  ASHEN_TEST_URL=http://127.0.0.1:7174/ \
  ASHEN_IDENTITY_MOTION_OUT=ve-capture/character-mmo/m5-saved-fits-2026-10-04 \
  node scripts/character-assets/record-human-identity-review.mjs young-hair
```

The negative command exits 1; ordinary fits must exit 0. Restart the compressed
preview after a rebuild; park the harness's default game page before a helper;
close all owned contexts and run harness down afterward. Never benchmark while
an unrelated user renderer is active. These commands are not performance probes.
Tracked logs normalize nonsemantic trailing whitespace; raw output remains in the local .cache task directory.
