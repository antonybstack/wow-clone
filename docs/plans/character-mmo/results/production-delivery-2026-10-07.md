# Production startup and Fieldcoat release

2026-10-07. **Released and qualified** on [play.sparkify.dev](https://play.sparkify.dev).
Runtime source **7d00c56c06f02899e2319ffdddea97728013c0b1**, Pages
**5723a4ab-5dfd-4902-959b-7496948ea51f**
([immutable deployment](https://5723a4ab.fardel.pages.dev)).
Seal `3098125a7ecef760cffe0e1f9dd7aacce232bc9f57b6966b8f41b996239c5876`.
Working rollback: **6004840 / e39117b8-db74-4563-a6c0-b428c8d5d10e**.

The existing qualified preview bytes were restored through the native Pages
operation, with no upload, rebuild or regenerated asset. Release flags enable
saved bootstrap, starting-world preparation, lazy world buffers and covered-hair
deferral. Muted-audio and close-camera corrections and catalogue-v8 Fieldcoat
are included. Local experimental switches remain default-off.

## Actual production acceptance

Every **552** served-byte/MIME/cache check passes, including two genuine
404/no-store controls. Bare root, queried root and direct game entry pass with
one native Havok streaming request each and no fallback. The final native project
API confirms that this exact deployment remains canonical.

| Appearance | Valid starts | p95 | Worst | Over 1,000 ms |
| --- | ---: | ---: | ---: | ---: |
| Unsaved default | 20/20 | 824.8 ms | 831.1 ms | 0 |
| Current uncovered maximum | 20/20 | 848.9 ms | 878.2 ms | 0 |
| Previous covered maximum | 20/20 | 826.2 ms | 839.5 ms | 0 |
| Historical hood/cloth/Bastion | 20/20 | 790.1 ms | 800.7 ms | 0 |

The method was declared before visiting: M1 Max, native Chrome, fresh process and
profile per visit, HTTP cache disabled including prefetch reuse, decimal **50
Mbit/s down / 10 up / 40 ms**, **1280×720/DPR1**. OS, DNS, driver and CDN caches
are uncontrolled. References are paused; no recording, build, encoding or other
game renderer overlaps. Every selected appearance, grounded Havok, completed
GPU frame, loader/input fence and subsequent movement check passes. Runtime/GPU
errors, invalid starts and misses are zero. Root checked all eighty raw rows;
every cohort has twenty distinct browser PIDs. No retry replaces a sample.

Nine native phases pass: built-bundle movement, complete normal-control bridge/
cathedral return, nineteen Fieldcoat cases, both landscape sequences, portrait
touch/identity, actual injected WebGPU depth fallback, WebKit and performance.
Cathedral return ends at z142.08 with Havok active and zero recovery teleports.
Depth fallback is the native `empty-fragment` path, with no fallback/GPU error.
Mobile and WebKit are desktop engine emulation. Root reviewed actual production
maximum-outfit, nave-return, tall/slender Fieldcoat and restored 568px landscape
captures. The previously reviewed live MP4s remain the motion evidence.

Performance is separate from capture: native uncapped Chromium WebGPU, M1 Max,
1280×720/DPR1, seven enemies, the current maximum saved outfit, three complete
12-second windows each on meadow/town/bridge/cathedral/forest. All fifteen
windows exceed 144 FPS: **202.6–232.6 FPS**, maximum full-window p99 **6.2 ms**,
worst interval **11.7 ms**, zero intervals over 16.67 ms/errors/recoveries and
zero full-window pacing hints. The receipt retains every window and its actual
conditions; these are settled-region measurements, separate from streaming tails.

The [tracked receipt](../../../baselines/character-mmo/production-delivery-2026-10-07/receipt.json)
retains all 80 first-play samples, all 15 performance windows, source/fixture hashes,
actual phase exits, native purge/canonical evidence and failed attempts.

## Retained failed operations and delivery intervention

The [initial promotion](startup-public-covered-2026-10-07.md) served new HTML with
fourteen missing new paths and an older identity index. Its immutable deployment
passed. It was rejected and rolled back; the immediate rollback smoke failed,
then later entry checks passed after old bytes converged. Keep every failed row.

Independent Grok review confirms those fifteen byte mismatches are real. It also
identifies two operator defects: choosing list[0] instead of the native canonical
deployment, and rejecting documentation-only HEAD changes despite a matching
native product fingerprint. The corrected operation uses the native canonical
state and the existing seal verifier. A fresh comparison shows a post-rollback
cached candidate module on the custom domain while both old aliases return 404;
this is residual caching evidence, not proof of the original failures' cause.

Read-only dashboard/API checks find standard caching, no cache/Page Rule override,
correct proxied CNAME, no matching Worker route and Tiered Cache off. Existing
dashboard sign-in works. No DNS/rule, security setting, credential or grant changes
are made. Cloudflare documents the [native stale-asset purge remedy](https://developers.cloudflare.com/pages/configuration/serving-pages/#caching-and-performance)
and [exact-URL purge](https://developers.cloudflare.com/cache/how-to/purge-cache/purge-by-single-file/).

The first remediation restores the candidate at 18:33 UTC but its two-minute
parent-receipt boundary expires at 18:35. It rolls back before any production
cohort; immediate rollback entry fails again. The parent finishes the UI purge
after that boundary. This is an operator coordination failure and remains
recorded; it is not a rejected startup sample or an accepted release.

The corrected, separately recorded operation first passes all three entry checks
on the working rollback, restores the same successful production deployment at
18:40:42 UTC and allows a guarded five-minute UI boundary. It submits exactly
twenty game URLs; native Network response evidence confirms **HTTP 200 /
success:true**, with no errors, before the receipt at 18:41:46. All production
gates then pass; the final canonical API is checked again at 18:58:48.

This follows the [native restoration contract](https://developers.cloudflare.com/pages/configuration/rollbacks/).
Purge and alias convergence occur in the same interval and are not causally
isolated. The underlying mixed-version mechanism remains unproven. No unchanged
cohort or upload was repeated to manufacture acceptance. The first operator
timeout and all earlier failed delivery/rollback checks remain distinct.

## Verification maintenance and remaining limits

After the frozen release finishes, the canonical built checker is corrected to
require the exact `/assets/v2/<expectedBundle>` pathname, matching the configured
[Vite assetsDir](https://vite.dev/config/build-options.html#build-assetsdir).
Its own native smoke passes with **13.97 m** of normal movement, no failed request
or runtime/GPU error. This QA-only source change is not a rebuilt game or new
deployment; runtime source remains 7d00. A future sealed upload must obey the
source-fingerprint contract rather than relabel this existing seal.

Follow-ups retained by the independent review: extend cache-policy coverage to
shape/startup mutable manifests, distinguish error-response cache policy from an
immutable 200 asset policy, and record actual response hashes in failed integrity
rows. These classification improvements did not cause or hide the fifteen byte
failures; the current complete delivery gate passes.

The original rejected immutable preview's 14/60 fetch failures remain unexplained.
The preview's 362 ms post-screenshot input upper-bound outlier is unreproduced;
three instrumented visits observe first movement at 4.7–4.8 ms. Production input
checks all pass, with worst upper bounds 61.2/42.6/38.2/31.4 ms across the four
cohorts, but those bounds do not locate first displacement or establish a cause.
Streaming p99 around 21.5 ms and explicit sound activation cost remain separate
follow-ups. Actual fullscreen media playback and current physical iPhone acceptance
are unverified; desktop emulation and the historical ~60 FPS report do not replace
the prepared [physical-device receipt](../../../baselines/character-mmo/iphone-acceptance.md).

Fieldcoat Telegram 871 and covered-hair Telegram 878/identical VE MP4s were already
reviewed and delivered for these accepted visual changes; they are reused without
an unnecessary resend. This delivery operation adds no visual implementation.
The full five-priority goal remains active because required evidence is still
missing. Raw operations are under `.cache/character-mmo/production-delivery-2026-10-07/`
and `.cache/character-mmo/production-delivery-verified-2026-10-07/`.

## Final ownership and device audit

The final audit finds no owned Chrome/Grok/harness process, no game tab among
twelve user Edge tabs, and no embedded Orca tab. Every retained browser ownership
record is inactive. The diagnostic Cloudflare tab is closed. The temporary media
guards are removed; the one previously playing reference is restored, with no
failed or detached restore. User Edge PID 2931 and Orca PID 98938 remain intact;
the discarded Shadowglass tab is unactivated. The receipt includes this audit and
the canonical checker's native report, successful exit and closed ownership.

The fresh connected-device inventory at 19:03:25 UTC again finds one Mac, eleven
simulators and zero physical iPhones. Raw names/device identifiers stay local;
the tracked receipt retains only counts and the inventory hash. Physical-device
acceptance is still unverified.
