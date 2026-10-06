# Saved-character startup bundling — 2026-10-06

**Preview only: strict public startup gate fails one of twenty starts.** Production remains
`6004840` / `e39117b8`. `ASHEN_SAVED_BOOTSTRAP=1` opts into a native Rolldown
group containing the existing pure save validator, selected identity descriptors
and shared early fetch helpers. Default builds keep the released split graph.
No custom module loader, second storage decoder or duplicated promise cache.

The candidate removes separate storage/identity module requests from saved
startup. First-time players download the small pure validator with their initial
graph, while asset selection and storage migration remain conditional. An
explicit source-module allowlist, renderer/network exclusion, 24 KiB compressed
early-graph ceiling, source-module singleton checks and compiled provenance
checks constrain that tradeoff. Native ESM execution ordering remains enabled.
See the adjacent [Rolldown reference](https://rolldown.rs/reference/TypeAlias.CodeSplittingGroup)
in `vite.config.js`.

Grok 4.6/high ran 33 unit tests, two builds and the live comparisons. Both builds
pass; the candidate has 536 files versus 539. The pure early graph is 10,588 bytes
under the build's Brotli calculation. `store-EWO4nvB8.js` contains the shared pure
code and imports only the native runtime/preload helpers. It has no dynamic
imports. All 279 `/ashen-reach/` asset files and the Lite renderer are byte-identical.
The local snapshots are `baseline-dist` and `candidate-dist` in the task directory.

## Functional check and harness correction

The first held-renderer check failed because its interceptor still matched
`/assets/lite-runtime-*`, while the release uses `/assets/v2/lite-runtime-*`.
This was not a candidate dependency failure. The harness now matches versioned
asset directories and asserts a real interception. It also expects zero identity
manifest requests when the catalogue is embedded, and injects a stale descriptor
into that actual embedded data rather than only an unused fetch fallback.

The corrected ten-case check passes: unsaved default; shaped and selected saved
assets completing while Lite is held; saved neutral; both legacy migrations;
unknown-version retention; and stale shape, identity and starter rejection.
Selected first play has the expected native source clips, morph weights, height,
equipment, hidden hood-covered hair, Havok support and no recorded GPU/runtime
errors. Each held-Lite case records one actual interception; each stale check
records one injected descriptor. Original failed evidence is retained separately.

## Local timing

One renderer at a time on the M1 Max, fresh Chromium processes/profiles,
1280×720/DPR 1, HTTP cache disabled, 50 Mbit/s down / 10 up / 40 ms latency.
Compressed local HTTP/1.1 snapshots on ports 7074/7075; three alternating saved
hood/Bastion runs per build, followed by one unsaved run each. No recording,
encoding or builds in the timing window. Telegram and reference-site videos
were paused and temporarily guarded against autoplay. OS/GPU caches are not reset.

| Visit | Split graph | Coalesced graph |
|---|---:|---:|
| Saved 1 | 876.3 ms | 836.2 ms |
| Saved 2 | 873.2 ms | 831.3 ms |
| Saved 3 | 872.7 ms | 829.5 ms |
| Unsaved 1 | 615.0 ms | 611.9 ms |

Saved body requests start at 276.5–277.8 ms in the control and 184.0–195.1 ms
in the candidate. They finish at 665.3–670.8 versus 624.7–628.1 ms: earlier
discovery saves about 40 ms at the playable boundary under these local conditions.
The unsaved pair is a smoke comparison, not a statistical performance claim.
All eight starts are grounded and accept input without recorded errors. Root
reviewed saved/default first-play captures: dressed characters and churchyard
are intact. Stills do not constitute release motion acceptance.

No normal rounding or other asset candidate is included.

## Public preview and release decision

Source `03dfbc7750e548e83ea38cd4430ef2fc8d97a625` is pushed. The explicit flag-1
rebuild is identical to all 536 frozen candidate files. Sealed preview
**498be045-42c7-4d89-8ee4-7580b9291ad1**
([immutable deployment](https://498be045.fardel.pages.dev)) passes **537 delivery
checks**: 535 served paths plus two missing-file controls. Seal SHA-256:
`5dff2f6f867b92023d810d7fc01a813a7ad9c9243771e6a4e061e2c626669866`.

Three alternating saved visits to old `e39117b8` and new `498be045` give
978.7 / 930.7 / 909.2 ms versus 955.7 / 897.8 / 941.3 ms. Default visits are
674.0 versus 690.2 ms. Body discovery improves in two pairs, worsens in one;
this small comparison does not establish a reliable public speedup. The candidate
does remove three saved requests and one unsaved request. Actual unsaved JavaScript
requests contain 12,583 additional raw bytes, or 3,584 bytes under the offline
gzip-9 model. That model is not actual wire traffic. The build report's broader
HTML-reference table includes conditional links and must not be used as an
unsaved transfer comparison.

The subsequent **strict 20-start candidate gate fails**: **p95 952.3 ms, maximum
1,025.1 ms, one miss (run 7)**. All twenty are valid, grounded, input-responsive
and free of recorded runtime/GPU errors. Fresh processes/profiles, cache disabled,
the same 50 Mbit/s profile and isolated media conditions apply. No favorable rerun
replaces that cohort. Do not promote the candidate or claim the public target met.

Run 7 has late discovery: HTML completes at 160.7 ms, the 44-byte early entry
facade at 322.5 ms, and the body starts at 340.3 ms. Body transfer itself is
479.0 ms, within the other visits' 450.8–507 ms range. The shared store finishes
at 310.3 ms. A next bounded code investigation can inspect actual browser request
priorities for this critical early graph, then consider native fetch priority
only if the trace supports it. Do not start another large cohort without a changed
candidate. Normal rounding remains an optional later margin improvement, not a
fix for delivery outliers.

## Custom-domain delivery is a separate unresolved variable

Three subsequent production-host diagnostics retain **1,265.0 / 925.2 /
1,987.8 ms**. They do not replace the historical failed production cohort.
The first spends 403.4 ms receiving HTML; its body is a cache HIT and takes
503 ms. The third completes HTML at 428.6 ms and spends **1,157 ms** fetching
the body, which reports MISS. Its body response has an `h3` protocol and a
`MAN` CF-Ray suffix; the HTML reports `h2` / `SEA`. The fast visit reports
`h2` / `LAX` and a body HIT.

**Protocol correction:** the operations summaries saying “all h2” describe only
navigation. All twenty immutable-preview body responses use **h3**, with LAX
suffixes. HTTP/3 alone therefore does not explain the custom-host outlier.
Cloudflare documents that CF-Ray suffixes can identify the origin-facing tier,
so these headers do not prove the client's physical route.
[CF-Ray reference](https://developers.cloudflare.com/fundamentals/reference/http-headers/#cf-ray).

Public DNS shows different Cloudflare address sets for the two hosts. A bounded
HTTP/2 curl check also sees a custom-domain body HIT and no `cf-cache-status`
header on the identical immutable body; both have the same ETag. This is evidence
of different delivery behavior, not proof of a misconfigured rule. Pages already
uses tiered caching, and proxied custom domains additionally inherit zone rules.
Do not disable HTTP/3, tiered caching or the DNS proxy based on a single MISS.
[Pages serving behavior](https://developers.cloudflare.com/pages/configuration/serving-pages/),
[custom-domain troubleshooting](https://developers.cloudflare.com/pages/configuration/debugging-pages/).

The deployment credential can read Pages metadata but its DNS request returns
403/code 10000. The Edge dashboard is signed out. An optional user sign-in request
is pending; the owned login tab is `1147995760`. No settings were changed. With
read access, inspect the custom-domain cache/origin rules and correlate the
19:04:03–19:04:08 UTC MISS with available tiered-cache request logs. Lack of paid
Log Explorer access must not be treated as a requirement to buy anything.
[Tiered-cache latency investigation](https://developers.cloudflare.com/cache/troubleshooting/investigating-tiered-cache-latency/).

[Tracked receipt](../../../baselines/character-mmo/startup-bootstrap-2026-10-06/receipt.json).
Raw evidence: `.cache/character-mmo/startup-bootstrap-2026-10-06/`, especially
`ops-build.md/json`, `prefetch.json`, `ops-browser.md/json`, the eight probe
reports/screenshots and ownership files. Failed old-harness artifacts have
`old-harness` in their names. All local game/probe processes are closed and the
7074/7075/5873/10037 ports are free at the end of that pass. Final root audit also
finds 5173/9337 free and no Chrome game browser. All Grok workers finished.
Temporary media guards are removed; original Telegram/reference playback is
restored. The Cloudflare login tab is the sole owned browser follow-up. It is not
a game renderer. No new visual release or Telegram motion delivery is claimed.
