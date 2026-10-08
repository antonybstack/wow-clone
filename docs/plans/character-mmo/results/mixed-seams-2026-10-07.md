# Focused mixed armor seam review — 2026-10-07

The remaining neutral Orc/Undead close-view gap is now reviewed. No new gross
neck gap, waist skin breakthrough or open cuff was observed in these fixtures.
No asset or runtime change is justified by this bounded review. Proceed to one
authored shield; the production release hold remains open.

Source **722c4084da98548d8848d22d100929e0b53366d7**, product inputs
**22b7d4883138937b2e8e8d49ffd8d18c4ceff139eb171c52a3cd87aba65bb438**
(1,186 files, no uncommitted product input). Existing Human shape endpoint
evidence is retained in [M6 continuous clearance](m6-clearance-2026-10-06.md);
the 864-view mixed matrix is separate [earlier evidence](m6-mixed-fit-2026-10-06.md).

## Scope and actual observations

One native Chromium WebGPU game, 1280×720/DPR1, local compressed release preview.
Neutral Orc and Undead each wore the existing `hood-coat-robe` and `coat-plate`
fixtures from `scripts/character-assets/mixed-fit-cases.mjs`. Source run and Fire
Blast previews each played a full cycle at neck-front, waist-back and cuff-side:
**24 continuous chapters**, plus twelve idle screenshots. Inspection framing and
fill light are diagnostics; this is not an ordinary gameplay traversal or FPS
measurement. Havok stays active, source skeletons have 65 bones, recoveries are
zero, and runtime/GPU errors are absent. All 25 observed equipment/body responses
are HTTP 200; status alone is not a general body-integrity proof.

Root played the unchanged live MP4 in native Edge at normal and half speed,
observed time advancement and completion without a media error, and inspected
fifteen unprocessed frames extracted from that MP4 plus four capture stills.
The hood/coat neckline stays covered in the sampled run/cast views. The skirt
and coat retain their overlapped waist band; the uncovered and armored cuffs
retain their sleeve/hand boundary during the sampled bends. The tattered hem,
plate bulk/edge overlap, cloth pleats and aliasing remain visible limitations.
This does not claim zero clipping across every outfit or animation phase.

The first idle image retained old full-body framing/UI before the close framing
settled. Do not cite it as proof of a precise 0.2-second idle phase or close view.
The subsequent run/fire chapters visibly use the intended close views and retain
actual native pose state in the raw report. No unchanged matrix or endpoint
campaign was repeated to compensate for that idle limitation.

## Motion delivery and ownership

[Reviewed live MP4](https://ve.sparkify.dev/wow-clone/ashen-reach/mixed-seams-2026-10-07/b221d6cbc564-motion.mp4),
Telegram **885**. Exact SHA-256
**b221d6cbc5644c54c8647259807b5d20c839aaaeea8430070e5bc4e1c60708f7**,
9,723,762 bytes, H.264, **1280×720**, square pixels, rotation zero. The 515 frames
retain 34.265217 seconds of capture timestamps; encoded duration is 34.264954
seconds. Telegram returned matching width/height and rounded duration 35.
VE full GET matches the file hash and `video/mp4`; its 1,024-byte range is a valid
206 response. Root also played the direct VE file to completion in native Edge with intrinsic
and rendered dimensions 1280×720 and no media error. API metadata does not
establish Telegram inline/fullscreen playback.

Capture Chrome **63747**, GPU helper **63758**, preview **63725** on 7074 and CDP
10037 are closed. Root review tab **1147995936** used existing user Edge **2931**;
that owned tab and direct VE tab **1147995940** are closed and its range server **74685** on 7075 exited on SIGTERM
(143). Capture/encode and VE/TG native child operations exit 0; both Grok CLI
operations exit 0. User Edge's twelve other tabs and Orca are preserved.

Production stays **7d00c56 / Pages 5723a4ab**. There is no new startup, settled FPS,
physical-phone or release claim. The exhausted unchanged startup diagnostic
campaign remains closed; the unexplained failure remains an acceptance exit.

[Curated receipt](../../../baselines/character-mmo/mixed-seams-2026-10-07/receipt.json).
Raw report, capture manifest, PNGs, frames, MP4 and ownership history:
`.cache/character-mmo/mixed-seams-2026-10-07/`. The exact capture operator is retained
as [evidence text](../../../baselines/character-mmo/mixed-seams-2026-10-07/capture.mjs.txt);
restore it to its raw path to retain relative imports. It requires the pinned
matching `dist`, free owned ports 7074/10037, and the browser ownership audit.
