# Native startup failure diagnostics — 2026-10-07

The startup probe now preserves native transport, browser-log and CSP policy
evidence without wrapping application fetch/Response promises. It closes Chrome
even when saving its report fails. This is **QA progress**, not a loader fix or
public release acceptance. Boot preview **514fe898** stays rejected; production
remains **7d00c56 / 5723a4ab**.
[Native receipt](../../../baselines/character-mmo/startup-network-diagnostics-2026-10-07/receipt.json),
[bounded independent Grok reviews](../../../baselines/character-mmo/startup-network-diagnostics-2026-10-07/independent-review.md).

## Change

- Keep every `Network.loadingFailed`, including request IDs absent from the map,
  and correlate known request URL/status. Success rows now also retain failures.
- Save selected native network/security log fields. CSP can reject fetch before
  a transport event; save typed native policy issues separately.
- Optional `ASHEN_PROBE_NETLOG=1` uses Chrome's default native startup logging,
  separate exclusively reserved local files per process, 64 MB cap and no sensitive
  or raw-byte mode. It refuses an acceptance budget and output outside `.cache`.
- Reuse native browser process inventory for PID tracking. Snapshot reasons before
  shutdown, close Chrome, then persist the final report. A report I/O exception
  cannot skip browser closure. No request retry or loader behavior changes.
- Correct the cache-method description: CDP disables HTTP cache; it does not prove
  all within-visit HTML preload reuse is disabled. Historic declarations are kept.

Source comments and the [debug procedure](../../../debug-view.md#native-startup-failure-diagnostics)
link official CDP/Chromium documentation. No new engine, texture loader or fetch
shim is introduced.

## Native checks and corrections

The first control invocation exits 1 after three failure controls pass: it
incorrectly expects a transport event from a CSP-blocked fetch. That report is
retained. Grok identifies the wrong assumption; root adds native policy-issue
coverage and preserves checker diagnostics even on assertion failure.

The corrected invocation exits 0 with **five controls**: a normal 200, native body
truncation after 200, the same failure with its request row deliberately removed,
CORS with `MissingAllowOriginHeader`, and enforced `connect-src` CSP. The CSP case
has zero transport failures, a security message and a typed native policy issue.
These are actual HTTP/browser failures; none establishes the preview's cause.

One maximum-uncovered visit to the actual immutable preview exits 0. The declared
identity, dressed/grounded completed frame, active Havok, removed loader and input
checks pass; runtime/GPU errors and all three native diagnostic collections are
empty. Root reviewed the actual churchyard capture. NetLog parses after shutdown.
It is diagnostic only: no startup budget, FPS sample, recording or new visual
implementation. It does not replace any failed cohort.

Three further local HTTP/DOM fixtures invoke the **actual startup CLI**. Each
correctly exits 1; their checker exits 0. They prove failed rows retain 200/body
truncation and pre-transport CSP evidence, and an actual `EISDIR` report-write
failure still closes the owned Chrome. All reports that can be written and all
NetLogs parse. Those fixtures are not built-game acceptance. No unchanged checks
were repeated; every failed attempt and expected child exit is retained.

Both Grok workers are terminal. All six owned native browsers and fixture servers
are stopped; user Edge/Orca/Shadowglass remain intact. Reference media was not
changed for these diagnostic visits; none is performance qualification.

## Remaining work

Read-only native Pages state at **22:57:25 UTC** still identifies production
5723a4ab. All 570 `dist` files / 310,982,964 bytes match the existing historical
4ad2637 seal. QA source changes alter the product-input fingerprint, so that seal
must not be attributed to the new source or uploaded under a new commit. No build,
reseal or deployment ran.

The new collector makes a bounded native failure capture useful; fix the loader
only for a demonstrated cause. The original 14/60 failures, new maximum run 1,
362 ms input upper-bound outlier and current physical iPhone acceptance remain
open. Do not repeat unchanged qualification, add speculative retries, or reopen
the rejected queue-eight/silent-audio trials. Independent fit/equipment work may
continue while boot publication remains on hold.
