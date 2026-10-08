# Focused boot forefoot correction — 2026-10-07

The canonical offline builder now repairs the collapsed Human/Undead forefoot
above the accepted sole. Native preparation, functional checks and root's actual
live MP4 review pass. Reviewed motion is delivered as Telegram **881** and
[identical VE MP4](https://ve.sparkify.dev/wow-clone/ashen-reach/boot-forefoot-2026-10-07/motion.mp4).
This is local work; production remains
**7d00c56 / 5723a4ab**, with the startup reliability release hold unchanged.

## Change and evidence

The previous sole pass ended at authored Y 25 mm. Authored vertices in the
40–60 mm band had collapsed as low as 5.1 mm on Human. The focused pass restores
height only within authored Y 18–80 mm and Z beyond 100 mm, fading smoothly at
the boundaries. It runs after the sole pass and raises only vertices below the
target; an already-higher roof is preserved. Human raises 174 vertices, at most
53.0 mm; Undead raises 52, at most 38.9 mm.

The revision-2 descriptor retains the pinned masters and body inputs. Integrated
Human/Undead bytes exactly match the private audition. X/Z, indices, UVs, skin
weights, joints and inverse binds remain exact; normals are rebuilt through the
existing helper. Duskguard copies the reviewed underlayer and verifies unchanged
plate arrays. Publication now checks prospective underlayer pins before writes.
It remains staged per manifest, rather than a global transaction.

The existing pipeline prepares Human shapes, starter compacts, source coverage,
equipment-only identity refresh and remote pieces. Character bodies, accepted
face/hair/hood binaries, Orc equipment and all other item entries remain exact.
Older addressed assets are retained. No runtime fitter or source animation change.

## Verification

- Two byte-identical builds; independent decoded-array review finds no
  consequential builder/publication defect.
- Character **231/231**, equipment **115/115**; actual child exits 0.
- Native Lite bounds: **51 pieces**, **162,617,865 points**, zero escapes;
  final byte-cache entries/reservations/leases zero, peak **4,496,592 bytes**
  within the **8,388,608-byte** ceiling.
- Canonical build and ten live fit cases pass, including Human shape endpoints,
  neutral Orc/Undead, both boot types, source-foot restoration and ordinary
  Human/Undead Havok sprint/jump. Zero runtime errors or recovery teleports.
- New maximum compact outfit **2,103,397 bytes**, **673 bytes** above qualified
  production. This is payload evidence, not a new startup measurement.

The operations CLI reached its declared turn cap after the successful capture.
Only encoding/cleanup resumed; completed preparation/tests/capture were not repeated.
The [curated receipt](../../../baselines/character-mmo/boot-forefoot-2026-10-07/receipt.json)
retains actual child exits, source fingerprint, decoded-array comparison, live
cases and cleanup. Raw evidence: `.cache/character-mmo/boot-forefoot-2026-10-07/`.

Preparation uses the existing tools in this order: `prepare-boot-sole.mjs --publish`,
`prepare-production-human-shapes.mjs`, `prepare-starter-character.mjs`,
`prepare-coverage-release.mjs --publish`, `refresh-human-identity-equipment.mjs`
with the Fieldcoat descriptor, `prepare-remote-pieces.mjs`,
`prepare-remote-pieces-native.mjs`, then `publish-remote-pieces.mjs`. Character
asset tools are under `scripts/character-assets`; the starter tool is under
`scripts/ashen-reach`. The ordinary build-only Pages command enables saved
bootstrap, primed starter world, lazy world buffers and deferred covered hair.
`record-boot-fit-motion.mjs` records the frozen build into a fresh cache directory;
`scripts/encode-capture.py` preserves the capture timestamps.

## Visual review and remaining gates

The canonical idle camera retains the previous close comparison framing; the
run camera is wider to keep moving feet visible. Root compared actual current
and previous native stills, then reviewed the actual MP4 at normal and half speed,
including ordinary Human/Undead Havok motion. The large Human toe cavity and far
Undead vamp gap improve; leather pleats, cuff/strap overlap and aliasing remain.
This is a focused repair, not complete mixed-fit acceptance. The MP4 is
1280×720, square pixels, zero rotation and 32.981 seconds; capture elapsed time
is 32.981 seconds. Recording HUD values are not independent FPS measurements.
Telegram returned matching 1280×720 dimensions and a 33-second integer duration.
VE serves identical bytes as `video/mp4`, with a successful 206 byte-range check.
API dimensions do not establish new inline/fullscreen or physical iPhone acceptance.
All owned game and media-review tabs/servers are closed; user Edge/Orca remain intact.

No Pages upload/promotion, new startup cohort or new FPS measurement ran. The
rejected preview's required-texture failure, original 14/60 fetch failures,
362 ms input upper-bound outlier and physical iPhone acceptance remain open.
Do not extend the exhausted unchanged diagnostic campaign. Next independent fit
work starts at the retained cuff/strap overlap; shield proof remains subsequent.
