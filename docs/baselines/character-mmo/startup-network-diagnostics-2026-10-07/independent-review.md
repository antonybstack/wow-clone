# Native failure collector — corrected controls review

2026-10-07. QA-only collector (`probe-network-failures.mjs`, `probe-playable-startup.mjs`, `check-startup-network-diagnostics.mjs`). Working-tree collector; git HEAD `28f1b64`. No runtime/loader change. Preview **514fe898** stays rejected. Historical 14/60 and 362 ms exits stay open. Diagnostic only.

## Commands

Corrected controls: `node scripts/ashen-reach/check-startup-network-diagnostics.mjs …/controls-corrected.json` **exit 0**, `passed: true`, 5 cases. Prior `controls.json` / exit 1 left untouched (sha `299bc9a4ea9febbdcff5999070d6f4514a6f0aa1`).

Public smoke (once, prescribed env): `ASHEN_TEST_URL=https://514fe898.fardel.pages.dev` `ASHEN_PROBE_RUNS=1` `ASHEN_PROBE_PROFILE=50mbps` `ASHEN_PROBE_DISABLE_HTTP_CACHE=1` `ASHEN_PROBE_NETLOG=1` plus maximum-uncovered seed and `dist/ashen-reach/human-identity-v1/manifest.json` → `…/public-smoke.json` **exit 0**. Visit `https://514fe898.fardel.pages.dev/?play=&pixelRatio=1`.

## Controls

Owned Chrome **52357** / GPU **52363** / controller **52330** / fixture ports **55537/55538** are stopped. Sidecar `controllerPid` 52330, `active: false`. NetLog Default, parsed after close: **2781** events. `cleanedUp: true`. Header sentinel absent. No `window.fetch` / `Response` wrappers.

Passed: HTTP 200 success (zero transport failures); body truncated after 200 → `net::ERR_CONTENT_LENGTH_MISMATCH`, `responseStatus` 200, `trackedRequest` true; orphan retained (`trackedRequest` false, `url` null, `requestId` `52370.5`); CORS → `MissingAllowOriginHeader`. CSP `connect-src 'none'`: application `TypeError: Failed to fetch`, **0** `loadingFailed`, one Audits issue `ContentSecurityPolicyIssue` / `blockedURL` `http://127.0.0.1:55537/blocked` / `violatedDirective` `connect-src` / `isReportOnly` false / `violationType` `kURLViolation`. Browser log also records the enforced `connect-src 'none'` block. `finally` snapshots `networkDiagnostics` on the passing path; failure-path snapshot is in source and was not re-failed this run.

## Public smoke

Owned Chrome **53773** / GPU **53779** / controller **53745** stopped. NetLog Default, parsed after close: **46548** events, 7 mention `texture-6dc86c298450.webp`, none CSP / `ERR_` / `FAILED`. `networkDiagnostics`: 0 transport failures, 0 issues, 0 log entries. 30 requests, all HTTP 200, none failed. Parser preload of `texture-6dc86c298450.webp` HTTP 200, 5149 encoded bytes, `cache-control` `public, max-age=0, must-revalidate`. Playable 859.5 ms, input upper bound 46.9 ms, errors empty. Probe still `public-smoke-1.png` (playable churchyard). One clean visit does not explain or clear the rejected 1/20 `Failed to fetch`.

# Startup failure-path CLI fixtures

Authoritative: `failure-reports/report.json`, `failure-reports-wrapper.exit`. One run of `node scripts/ashen-reach/check-startup-failure-report.mjs`. Wrapper **exit 0**, `passed: true`, cases **3**. Not FPS/startup/visual acceptance. No retry.

## Children (expected exit 1)

| id | childPid | childExit | Chrome | URL | NetLog events |
| --- | --- | --- | --- | --- | --- |
| truncated-body | 61619 | **1** | 61645 | `http://127.0.0.1:55777/failure?play=&pixelRatio=1` | 1860 |
| policy | 61679 | **1** | 61699 | `http://127.0.0.1:55777/policy?play=&pixelRatio=1` | 1775 |
| report-write-failure | 61752 | **1** | 61753 | `http://127.0.0.1:55777/failure?play=&pixelRatio=1` | 1892 |

truncated-body: `Injected fixture: TypeError: Failed to fetch`; transport `net::ERR_CONTENT_LENGTH_MISMATCH` after HTTP 200. policy: same injected fetch error; `ContentSecurityPolicyIssue` `connect-src` (not report-only). report-write-failure: actual **EISDIR** on JSON path (directory); NetLog still parsed.

All three ownership `active: false`, `renderingClients: 0`. Native reports JSON-parse; NetLogs have `constants`/`events`/`polledData`.

## Cleanup

Controller **61618** GONE. Chrome 61645, 61699, 61753 and GPU helpers GONE. Fixture port **55777** closed. 10037/7074/5173 free. No leftover probe process.

Material defects observed: **none**.
