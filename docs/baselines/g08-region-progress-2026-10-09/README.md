# G08 — Actual region-processing progress, 2026-10-09

Product **62bb96d + 4b6707a**, pushed. Final sealed desktop preview:
[ordinary loading](https://aafce17b.fardel.pages.dev/?dev&play) /
[experimental physical-first](https://aafce17b.fardel.pages.dev/?dev&play&regionCore=1).
The wait covers regional packet download, native Brotli decode, GPU/Havok
installation and final supports. Navigation readiness is independent of later
full-tree detail, foliage, textures and NPC work.

## Implementation and native checks

The existing async stream publishes actual index/surface/support/detail/foliage/
finishing phases. Processing counters count ranges on the current attempt,
including idempotent retry ranges; static encoded packet size is separately
labelled. There is no compressed-byte download percentage or remaining-time
estimate. Intermediate progress is bounded to two notifications per second,
with immediate phase/final counts. No timer, frame hook, extra whole-packet array,
new decoder/geometry/importer/physics path or world rebake.

Ordinary live status uses native HTML progress above the actionbar. The same
snapshot appears in ?dev → Menu → Developer tools. Count changes stay out of live
speech. Safe-route readiness, retry/failure/disposal ownership remain unchanged.
Cached retries do not invent an index request, and navigation completion preserves
the progress node. The smaller packet remains experimental and is exposed through
the existing Developer tools reload toggle; default loading is unchanged.

- **43 CPU checks** pass: reporter phase/throttle/completion/snapshot/retry/labels,
  existing stream, prepared-region, region-streaming and startup assets.
- **Four progress cases locally and on final public bytes:** held core shows
  0/842 ranges and 14.4 MB, ordinary starting movement works and jumps remain closed;
  core 503 retry succeeds; foliage 503 retains open routes and retry; disposal with
  held detail removes the status permanently; slow native transport completes,
  clears UI and retains Havok/noFly/zero recoveries/GPU errors. Deliberate 503 console
  messages are recorded separately from unexpected errors.
- **Five existing candidate cases** pass locally and on final public bytes:
  default/toggle/retained spawn; partial detail fallback+detail-only retry;
  core failure/jump gate+retry; experimental query inert withoutdev; held-detail
  disposal. All 27 reduced-tree fallbacks stay visible during partial detail failure.
- **Default public held-packet check** shows 22.4 MB,0/1037 ranges, navigation closed,
  then successful completion/removal/disposal, with no runtime/GPU errors.
- **Twenty developer destinations** and **six native surface picks** pass locally
  and on final public bytes, including walking/focus/God/Fly/spawn gates. No changed
  architecture or collision. G06 ordinary climb/circuit evidence remains separate.
- **651 served artifacts** match finaldist:325 cache policies/eight regional policy
  checks. Seal 900b033a6da737a987207105e9b6bf1d2ccd47e48bb9948297c11f9b6f103278,
  648 files / 399200099 bytes, source 4b6707a6ea7502026ac77daefa322c1a5657866b.

Retained initial harness failure tried Retry through the open modal; root fixed
the harness to close the menu first. Initial live review found the expanded status
covering spells; moving it above the actionbar corrected the final public motion.
Grok 4.6/high source review hit 6-turn cap; bounded report-only resume ended at 3 turns.
[Source findings and root adjudication](source-review.md) distinguish observed
source from native proof; no reviewer performance claim is accepted.

## Motion, ownership and limits

Final public live MP4: 28.004079 s, 1280×720 viewport/canvas, DPR 1, SAR 1:1, rotation 0.
Native capture timestamps determine elapsed encoding. Synthetic 12 Mbit/s download/
20 ms latency illustrates phases; capture and unresolved other renderer make this
**not an isolated startup/FPS benchmark**. Seven-enemy gameplay remains intact.
[Direct VE MP4](https://ve.sparkify.dev/wow-clone/ashen-reach/gothic-exploration/2026-10-09/region-progress.mp4),
13683465 bytes / SHA256 c6bf85441c9de112371841c514a9203effb1949d8bfd8495f77394943800640c.
HTTP 200 video/mp4 exact bytes, 206 / 1024-byte range; actual local/direct playback reviewed.
Telegram delivery metadata and final owner teardown are recorded below after completion.

No accepted new speedup/FPS result. G06/G07/G08 isolated performance and the
candidate's paired cold-start/settled performance qualification remain open.
Preserve the unrelated user Shadowglass tab; its rendering status is unresolved
following rejected browser-internal inspection. No alternate bypass was attempted.
Production remains 5723a4ab / source 7d00c56, rechecked 2026-10-09T13:15:25.236Z;
startup production hold and physical-iPhone GPU-loss backlog remain separate.

Final delivery **Telegram 901**, returned 1280×720 matches the file; API duration is 29 seconds versus
28.004079 seconds in the file, matching the requested integer duration;
682 timestamped frames. Root inspected active final physical-range progress at
8.892 s, active direct VE full-tree progress at 19.064 s and clean ended playback at
28.004 s, with correct proportions/readable panel and clear spell controls.
Telegram application inline/fullscreen remains unverified.

All G08 owned contexts and slot 7 harness are closed: Chrome 99825 / CDP 10037,
Vite 99776+99820 / 5873, compiled 13042 / 7074 and media 10177 / 7077 stopped; predecessor
compiled 99863 / 4388 stopped on rebuild. Review tabs 1147996194/6198/6202/6206
closed. All four ports have no listener. Grok 97463 and its report-only resume
ended; no owned renderer remains. User Edge 2931 / fifteen original tabs, Chrome 13883 / 
NewTab and unrelated Vite4000 10171+10205 are preserved. Native ownership receipts
in the task cache record per-context close; no FPS claim relies on this audit.
