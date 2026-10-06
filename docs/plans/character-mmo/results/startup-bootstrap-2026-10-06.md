# Saved-character startup bundling — 2026-10-06

**Local candidate passes; public comparison pending.** Production remains
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

The candidate justifies a public immutable preview comparison. It does **not**
replace the failed production 20-start result or meet the public release gate
by inference. No normal rounding or other asset candidate is included.

Evidence: `.cache/character-mmo/startup-bootstrap-2026-10-06/`, especially
`ops-build.md/json`, `prefetch.json`, `ops-browser.md/json`, the eight probe
reports/screenshots and ownership files. Failed old-harness artifacts have
`old-harness` in their names. All local game/probe processes are closed and the
7074/7075/5873/10037 ports are free at the end of that pass.
