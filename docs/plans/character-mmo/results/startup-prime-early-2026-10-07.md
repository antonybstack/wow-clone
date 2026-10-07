# Early starting-world helper discovery — 2026-10-07

Status: **bounded experiment complete; default-off checkpoint; not release-qualified**.
This is a bounded follow-up to [the starting-world experiment](startup-prime-2026-10-07.md).
It does not replace that preview's two one-second misses or the earlier fourteen
unexplained fetch failures.

## Change and invariants

Start the existing conditional dynamic import as soon as the opt-in flag is known,
before saved-appearance/world/Havok setup. Immediately observe rejection while
retaining the original promise for the required await. Reuse Vite's existing
[async dependency preloading](https://vite.dev/guide/features#async-chunk-loading-optimization);
there is no new loader or retry. A source comment links that documentation.

The later body-pending checks, native scene registration/PBR rescan, opaque inert
loader, disposal/device-loss behavior, and dressed/grounded/completed-GPU/input
boundary remain. Flag zero initiates no helper import. The helper and Vite
configuration bytes are unchanged. Moving a request earlier can change whether
preparation runs; request timing alone is not a startup improvement.

## Verification method

Raw evidence: `.cache/character-mmo/startup-prime-early-2026-10-07/`.
Both plain Vite builds use `ASHEN_SAVED_BOOTSTRAP=1`; early/late comparison uses
`ASHEN_PRIME_STARTER_WORLD=1`. The late build is the immutable local `build-on-2`
from source 1503c9b. All assets and quality settings remain the same.

The comparison declares three alternating fresh-process pairs each for default
and catalogue-v8 maximum: late/early, early/late, late/early (12 visits total).
M1 Max, native 1280×720/DPR1, decimal 50 Mbit/s down/10 up/40 ms latency, initially
empty HTTP cache with native preload reuse; no forced shader-cache policy or GPU
trace. OS/driver caches are uncontrolled. This is measurement only, distinct
from the public disabled-HTTP-cache release gate. Keep every sample and failure.

Root audited Edge and Orca; no other game page was rendering. Temporary media
guards pause Telegram/Shadowglass/X during timing and restore their prior states
following cleanup. Each owned browser/server PID, port, URL and purpose is tracked.

## Retained setup and assertion failures

The first focused invocation has 20 unit passes and eight loading-screen fixture
errors: no browser was listening on the suite's default CDP 9337. That browser
suite also expects Vite/full-body request paths; it is not a built-startup check.
Do not describe these as eight product failures or claim that suite passed.
Main syntax and both Vite flag builds pass. The initial multi-argument Node syntax
command checks main.js only; the builds parse the other unchanged inputs.

All six native held/release, corrupt-gzip, disposal, device-loss and normal
default/maximum controls pass. Root reviewed the actual first-play/movement and
maximum PNGs: arms down, dressed body and equipped gear. Stills are not live
motion acceptance. The added helper-abort control's first assertion rejects the
browser's expected `net::ERR_FAILED` console line. Its actual loader remains
opaque/inert, contains the failed helper URL/native TypeError, never plays, has
no unhandled page error and requests the helper once. Preserve that attempt in
`import-attempt1`. The corrected assertion only accepts that exact network line
at the helper URL with a matching failed request; unrelated errors still fail.
The corrected helper-abort assertion and normal flag-zero control now pass.
Flag zero requests no helper and retains actual grounded/Havok movement.
All eight native controls pass; the original failed assertions remain available.

## Workflow observation

The reused operations session consumed about 1.95 million aggregate tokens
(including cached input) for the initial 12-call build/harness pass, before a
live check. Subsequent bounded operations use fresh Grok 4.6/high sessions with
prepared scripts and compact briefs. Parent implements and reviews; one worker
owns verification/timing. No new feature or test framework is justified here.

## Paired result and decision

Both local builds pass 349/349 delivery checks. All twelve visits pass dressed,
grounded/native canvas, selected identity/equipment, GPU completion and actual
input movement, with no recorded runtime/GPU errors. The input hashes remain
unchanged throughout. Shared Lite runtime bytes are identical between builds;
body/Havok URL and encoded payload sizes match in the compared rows.

| Outfit / pair | Late (ms) | Early (ms) | Late minus early (ms) |
| --- | ---: | ---: | ---: |
| Default 1 | 570.4 | 538.7 | 31.7 |
| Default 2 | 566.5 | 536.3 | 30.2 |
| Default 3 | 573.9 | 531.3 | 42.6 |
| Maximum 1 | 774.4 | 784.4 | −10.0 |
| Maximum 2 | 771.2 | 774.6 | −3.4 |
| Maximum 3 | 773.2 | 788.2 | −15.0 |

Helper discovery shifts from 371–413 ms to 189–196 ms. Both builds submit the
preparatory frame in every local visit. Default's early preparation fence is
complete before the dressed register starts; late default waits there. Maximum's
fence is already complete in both variants, while its early body attachment
starts 6.0–8.2 ms later. These are observed timing windows, not isolated GPU
execution or a proven causal decomposition. The default near-geometry transfer
also finishes earlier in the early rows; do not attribute the entire gain to the
helper's round trip. Three pairs do not establish statistical causal proof.

Retain the early-discovery implementation behind the existing default-off flag.
It removes measured late discovery and helps default in this bounded comparison,
but the maximum result is mixed with that benefit. **No new public cohort or
production promotion is justified by this comparison alone.** The next startup
work must address maximum headroom using its retained body/fence data, rather
than repeating this candidate until it produces favourable samples. Preserve
preview 43730b3e's two misses and the original unexplained fetch failures.

All owned native and probe browsers/preview servers have exited; listener ports
10037/7074/7075 are clear. Root removed the media guard and restored prior
Telegram/Shadowglass/X playback states. User Edge/Orca are preserved.
[Tracked receipt](../../../baselines/character-mmo/startup-prime-early-2026-10-07/receipt.json).
