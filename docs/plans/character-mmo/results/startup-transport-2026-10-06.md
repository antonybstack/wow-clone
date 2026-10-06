# Public startup transport — 2026-10-06

Production source `6004840`, Pages `e39117b8-db74-4563-a6c0-b428c8d5d10e`.
The earlier clean 20-visit disabled-cache gate remains failed: p95 1,219.6 ms,
worst 1,358.5 ms, 14/20 above one second. This investigation does not replace it.

## Findings

[Pages Early Hints](https://developers.cloudflare.com/pages/configuration/early-hints/)
is always enabled, including custom domains; the zone setting does not control
Pages. Eight HTTP/2 navigation-style GETs covered custom and immutable deployment
hosts, root and query URL, twice each. Seven contained HTTP 103 and ten startup
hints; all four custom-domain samples did. All final responses were 200 HTML with
`public, max-age=60, must-revalidate`. The read-only Pages API identified the
expected deployment and custom domain. DNS API access returned 403; no settings
or permissions changed. A missing 103 in one response is not proof of a broken
configuration: Cloudflare can omit it when final headers are already available.
Raw sanitized HTTP evidence is in `.cache/character-mmo/startup-transport-2026-10-06/`.

[Chrome documents](https://developer.chrome.com/docs/web-platform/early-hints)
that disabling its HTTP cache prevents Early Hints reuse. Fresh profiles with an
initially empty cache are a different condition: native same-navigation preload
reuse remains possible. The probe now records the native 103 event, public Link
values, initiator, request timing and `fromEarlyHints`/cache flags. It does not
record complete headers or credentials. Source links accompany the code.

Six sequential fresh Chromium processes, M1 Max, 1280×720/DPR 1, 50 Mbit/s down,
10 up, 40 ms latency, saved ponytail/hood/Bastion recipe, alternating policies:

| Visit | HTTP cache disabled | Playable ms | 103 events | Consumed hinted resources |
|---|---:|---:|---:|---:|
| native 1 | no | 1,077.9 | 1 | 10 |
| disabled 1 | yes | 962.2 | 1 | 0 |
| native 2 | no | 1,123.1 | 1 | 10 |
| disabled 2 | yes | 1,100.3 | 1 | 0 |
| native 3 | no | 1,094.8 | 1 | 10 |
| disabled 3 | yes | 1,110.1 | 1 | 0 |

All six grounded starts, Havok and movement checks passed with no recorded errors.
The parent inspected the native first-start screenshot; the worker inspected both
conditions. These stills verify the diagnostic scene, not new motion acceptance.
[Receipt](../../../baselines/character-mmo/startup-transport-2026-10-06/receipt.json).

The hints work for a normal empty-profile visit. Three visits per condition do
not establish a speed difference, and switching cache policy did not achieve
one second. A cached module's recorded request can start at HTML completion even
though its underlying early prefetch happened sooner. Do not infer “no early
fetching” from that request start, or use this document-target trace to certify
complete prefetch wire bytes or absence of duplicate browser-internal transfers.
103 receipt time is observer arrival time; the event has no protocol timestamp.

## Saved descriptor candidate — not promoted

The two pure saved-character descriptor modules start only when the conditional
HTML preload runs. In native visits the body starts at 395–421 ms and finishes at
866–915 ms; the dressed first completed frame takes another 205–212 ms. The
ponytail compact body alone transfers 1,115,442 encoded bytes.

Candidate `4a42496` added the existing build-validated saved descriptor graph to
the native 103 hints, adding approximately 5.2 KB encoded for unsaved visitors without
executing storage code or fetching any selected character before validation. The
HTML, runtime graph, geometry, source motion and readiness fence stay identical.
The optional graph already has renderer/shared-region exclusion and a 24 KiB raw
size cap. Native Pages limits and existing cache headers remain enforced. The actual artifact difference and preview consumption/timing were checked below. Lossless body compression was measured independently: the selected seven-piece
transfer shrinks from 2,166,532 to 2,033,196 bytes with Brotli quality 11, saving
133,336 bytes (6.15%), or only 21.3 ms of payload time at 50 Mbit/s. All decoded
SHA/length and byte-for-byte roundtrip checks pass. The parent does not accept
the worker's “substantive gain” recommendation for this gap: broad packing and
manifest changes are not justified yet. No assets or formats changed. Raw
`compression-table.json` and `compression-report.md` retain the measurements;
that worker reached its ten-turn cap after the report, so its requested final
unit-test follow-up was not completed. The main operations worker separately
passed all 20 relevant tests and the build.

## Preview comparison and decision

Candidate `4a42496` built successfully and passed 20 focused tests. All 539
artifact keys are identical to production; only `_headers` changes. Preview
[136f36fd](https://136f36fd.fardel.pages.dev), deployment
`136f36fd-e5d2-4945-9a2e-d40dfff97e24`, passes 538 served-artifact checks and two
missing-file controls. HTML cache policies and all twelve hints are correct.
Game and asset bytes remain identical to production.

Eight fresh-process visits alternate old/new immutable hosts and both cache
policies, twice. Same saved character and network conditions as above:

| Condition | Old visit 1 / 2, ms | Candidate visit 1 / 2, ms |
|---|---:|---:|
| Initially empty cache, reuse enabled | 2,800.2 / 846.5 | 1,427.6 / 867.4 |
| HTTP cache disabled | 976.3 / 981.8 | 901.4 / 907.4 |

Every visit has one 103 event. Native reuse is ten resources on the old host,
twelve on the candidate; disabled-cache visits reuse none. All movement/physics
checks pass with no recorded errors. Root reviewed the second candidate native
capture; the worker reviewed the first. No new visual bytes were changed, so this
transport experiment does not create a new motion-delivery cycle.

The first old visit spends 1,968.3 ms from first render return to supported GPU
completion. The first candidate visit instead waits for a world texture until
1,164.4 ms; its GPU window is 124.2 ms. Retain both outliers and distinguish them.
The previously documented GPU first-use tail is not fixed.

HTML-end to body-request discovery on native visits is **109.4 / 79.6 ms old**
and **117.4 / 59.0 ms candidate**. Faster document delivery accounts for much of
the apparent disabled-cache improvement. Two visits per cell establish neither
a reliable discovery gain nor a regression. This does not justify charging all
unsaved visits extra bytes or spending another large cohort on this hypothesis.
**Do not promote this preview.** Commit `d5393cf` removes the extra hints from the
default build; `4a42496` and the immutable preview preserve the experiment. The
probe's new diagnostic fields remain. Production remains `6004840` / `e39117b8`.
Local `dist` still contains the rejected preview: rebuild before any later seal.

## Exact accessor deduplication — no change

A second bounded offline check applies native glTF Transform
[accessor deduplication](https://gltf-transform.dev/modules/functions/functions/dedup)
to the three current compact bodies. Control reserialization and deduplicated
output both equal the published gzip bytes exactly. Geometry, all 22 selected
animation curves, mesh/node/skin identities and inverse binds match. **Zero
accessors or bytes removed.** No preparation or asset change is warranted.
Detailed Brotli and dedup tables are retained in the tracked receipt. The raw
prototype and phase reports remain in the ignored task directory.

## Next bounded implementation check

Stop repeating hint or lossless-wrapper experiments. Investigate native
`KHR_mesh_quantization` for compact character **normals/tangents only**, first as
an unpublished size/error experiment. [glTF Transform quantize](https://gltf-transform.dev/modules/functions/functions/quantize)
and [Lite 1.31.1's native loader](https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/packages/babylon-lite/src/loader-gltf/gltf-ext-quantization.ts)
provide the existing encoding/decoding path; no custom runtime decoder is needed.
Installed source confirms dequantization after meshopt. Current Vite groups Lite
modules together; verify actual output rather than assume a new late chunk.

Start at 16-bit normal precision with explicit attribute/target patterns,
`normalizeWeights:false` and controlled cleanup. Positions, UVs, weights, bind
matrices, source curves, sockets and silhouette must remain exact. Do not clamp
morph deltas outside the representable range. The installed transform can compact
unused primitive vertices even when cleanup is false: compare rendered indexed
triangles/attributes and coverage partitions, not only raw accessor lengths.
Measure actual gzip savings against byte-identical control serialization before
changing a published pack. Stop if savings are small. If worthwhile, review the
actual native actor at shape corners and in motion, then use existing asset,
startup and release gates. This is a next action, not an accepted optimization.

## Ownership and workflow

Grok operations session `01a11217-d931-71f0-8394-6c90b41f1187` owned the six
public diagnostic processes and eight paired preview processes. All fourteen
ownership files record closed browsers; final audit finds no surviving Chrome,
probe or game listener. No Vite or local preview server was started. Root removed
the temporary Telegram autoplay guard and left its four videos paused, restored
the user's originally playing first Shadowglass video, and kept its second
paused. Final Edge inventory has no game tab. User Edge/Orca remain intact.
Both Grok workers have finished. There is no unowned rendering or background work.

The preview operations pass hit its turn cap after raw evidence was complete;
a short continuation produced its receipt without rerunning visits. A prior
self-matching cleanup command stopped the initial launcher before its visits;
the eight actual visits are intact. Future worker briefs require incremental
receipts and exact owned PID cleanup, avoiding report-only recovery passes and
broad process matching. No new production deployment or timing pass is claimed.
