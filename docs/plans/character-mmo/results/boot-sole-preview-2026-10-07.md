# Canonical boot preview rejected — 2026-10-07

Canonical boot source **4ad2637** is committed/pushed and locally accepted. Its
sealed public preview **514fe898** is **rejected** after one required texture
failure. Production remains **7d00c56 / 5723a4ab**; no promotion or rollback ran.
[All forty attempted samples and compact native receipt](../../../baselines/character-mmo/boot-sole-preview-2026-10-07/receipt.json).

## Public qualification

One existing build was sealed and uploaded once: 570 files / 310,982,964 bytes,
seal SHA256 `fc5bec8da2efc78ef1b60620a271ad27b4e46c46b00a05c2a380381550aabbfb`.
The [immutable preview](https://514fe898.fardel.pages.dev) passes all **571**
file/hash/MIME/cache/missing-file checks and **three** entry aliases.

| Appearance | Valid starts / attempts | p95 of valid starts | Worst valid start | Failures |
| --- | ---: | ---: | ---: | ---: |
| Default | 20/20 | 752.1 ms | 756.8 ms | 0 |
| Maximum uncovered | 19/20 | 971.1 ms | 971.1 ms | 1 |

Every valid start is below 1,000 ms. The maximum cohort still fails: run 1 reports
`texture-6dc86c298450.webp`, surface “Moss and burial earth,” `Failed to fetch`.
The remaining two appearance cohorts, native release phases and fifteen settled
FPS windows did not start. There is **no new FPS claim or public acceptance**.

Conditions: M1 Max, fresh native Chrome process/profile per visit, 1280×720/DPR1,
CDP HTTP cache disabled, decimal 50 Mbit/s down / 10 up / 40 ms, no recording,
one intended game renderer, reference media paused. OS/DNS/driver/CDN caches are
uncontrolled. The original declaration overstates the cache setting as disabling
all native prefetch reuse; later diagnostic observations do not support that
label. Preserve the original declaration and samples; no settings were changed.

## Failure evidence and diagnostic limits

The failed visit records one parser-preload request for the texture, HTTP 200,
`image/webp`, HTTP/2, 5,294 encoded bytes, and no recorded `loadingFailed` event.
The qualification collector can omit failures whose request ID it did not track.
The native Lite path uses `fetch(url).blob()`; this evidence does not distinguish
request rejection from body consumption or prove successful application loading.

One bounded six-visit diagnostic follows, alternating cache-disabled settings
`true,false,true,false,true,true`, always with fresh native Chrome profiles. It
adds CDP browser logs, orphan transport-failure retention, default native NetLog
and fetch/body observers. All six complete with a 200 response and a successful
4,838-byte blob for the texture; no application/transport/browser-log failure is
captured. Promise observers add microtasks, so these visits are diagnostic only.
Successful within-visit consumption with one wire request also prevents claiming
that CDP cache disabling eliminates every preload reuse mechanism.

The 5,294 encoded-byte count and 4,838-byte blob use different accounting. Native
NetLog cache bookkeeping `-2` and HTTP/2 teardown `-3` are not a captured failed
URL request. **The cause remains unproved.** Six clean diagnostic visits clear
neither this failed row nor the historical 14/60 failures. The original 362 ms
input upper-bound outlier and current physical iPhone acceptance remain open.
No speculative retry, cache-busting, preload removal or dependency change ships.

## State and next action

Read-only native Pages state at **22:36:05 UTC** confirms production **5723a4ab**
and source **7d00c56**. The seal still verifies against committed product inputs.
All owned preview/diagnostic browsers and harnesses are closed; ports are free,
user sessions remain intact and reference media has been restored. Full native
reports and raw NetLogs stay in the task cache; the compact receipt is tracked.

First close the request/body diagnostic gap with native browser evidence that
does not wrap application fetch promises. Change the loader only for a
demonstrated cause. Keep this preview rejected and preserve every sample. A
material correction must pass a newly declared sealed release; do not repeat
unchanged qualification until it passes. Independent mixed-fit and equipment
work can proceed while this release remains on hold.
