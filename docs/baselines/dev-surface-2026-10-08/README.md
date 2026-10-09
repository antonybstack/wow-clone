# Castle click teleport — October 8, 2026

Implementation **aa8f92e**, committed/pushed. The previous picker marched the
terrain heightfield and never queried architecture, so a castle click selected
terrain beneath it. Replaced the duplicated unprojection/height march with
Lite `createPickingRay` and the player's existing Havok world.

The first actual-input check also reproduced self-occlusion: the nearest ray hit
was the local character capsule. The self-filtered path uses a lazy1mm sphere
`shapeCast` with `ignoreBody`, as Lite1.31.1's public ray query has no body ignore.
It uses existing physics ownership/disposal; no first-play allocation, changed
collision masks or changed ordinary gameplay raycasts. Surface-normal clearance
uses the upright capsule support distance; floor/roof hover remains active.
Sky misses do nothing; click teleport waits for region collision. Invalid contact
normals now produce a HUD message, addressing the independent review's minor note.
[Controls and procedure](../../debug-view.md#reproduce-developer-navigation-from-the-ui).

Twelve CPU/native Havok checks pass. The [local](local-report.json) and
[public-preview](preview-report.json) actual-input checks each pass six chapters:
parapet, gallery, nave, ordinary ground, sloped cathedral roof and sky miss,
plus Fly-off settling onto the parapet. No runtime/GPU errors or recoveries.
The [reviewed live roof frame](roof-click.jpg) accompanies the actual MP4.
A second early harness attempt confirmed the parapet hit but timed out because
Esc first released canvas pointer lock; the harness now handles the existing
unlock guard. Both early failed reports remain in the raw cache, not discarded.
[Independent Grok4.6/high source review](source-review.md): no confirmed blocking defects.
The contact offset guarantees separation from the selected plane, not all adjacent
geometry in a concave corner or a tight ceiling; this remains a flying dev tool.

Preview **https://67e791f7.fardel.pages.dev/?dev&play&at=cathedral-parapet**.
Seal `83607470d09badd1c677e3b3046cfb60147859c721107c63922859fab1663b89`:
643files /347,218,544bytes. Staged four-flag Pages build and prepared asset
validation pass; prepared world/character assets are unchanged. All646served
checks pass, including320declared cache policies;326remain unclassified.
Canonical production remains **5723a4ab /7d00c56** under its existing startup hold,
confirmed from the Cloudflare project API. This is a preview correction.

Root reviewed actual live MP4 playback and sampled game frames. Telegram **892**
returns matching1280×720 metadata. H.264 /square pixels /rotation0 /17.064781s.
[Identical VE MP4](https://ve.sparkify.dev/wow-clone/ashen-reach/dev-surface/2026-10-08/aa8f92e.mp4):
`video/mp4`, valid206seeking, SHA256
`a22f5c3391398c26e1313c8ecb85c0e0f0b34dcbacfe77ef4f392012c9732682`.
No new Telegram application fullscreen verification is claimed.

Conditions: M1Max/native Chromium/1280×720/DPR1/normal headless pacing.
No FPS/load claim; user Edge2931's unrelated browser game1147996049/vel.gg
was preserved. Root Chrome15440/CDP10037 and Vite15257/listener15327/5873
are stopped, runner contexts closed and owned Edge media1147996075closed.
Grok owns no browser and its review is complete. Other user sessions are intact.
Raw captures/timestamps, failed reports, tests, build/deploy/seal/serving/media
checks and browser ownership: `.cache/dev-surface-2026-10-08/`.
