# Physical-core default adoption — 2026-10-09

**Three valid pairs meet the ≥20% navigation target: 6.07 → 4.77 seconds,
21.48% faster.** Separate settled core performance passes at 188.5–240.3 FPS.
Physical surfaces and reduced trees now load first by default in source and
[desktop preview ba01c765](https://ba01c765.fardel.pages.dev/?dev&play).
Production remains 5723a4ab / source 7d00c56; the post-play loader does not fix the
unexplained first GPU completion misses or satisfy public cold-start qualification.

Product commits a89b0d4/d298d26/7673031; operator log-label correction d240f76.
New build/seal for 7673031: 648 files/399,200,086 bytes, seal SHA
`a3f9df8636e233e4734a316c5b60929ab68bf8346d079d4f9a0bdbfd0d263f9c`.
[Preview seal](preview-seal.json), [fresh operator-only rebuild equivalence](build-equivalence.json).
All 648 runtime files hash-match after d240f76; the old seal's broad source-input
check cannot authorize another upload after that script change. Any later
promotion still needs an upload-valid fresh seal and independent release gates.

## Measured benefit and cost

Same frozen old G08/aafce17b bundle for both modes; local compressed static server,
M1 Max, fresh native Chrome process/profile each visit, HTTP cache disabled,
50 Mbps down / 10 Mbps up / 40 ms, 1280×720/DPR1, uncapped WebGPU. Native W input in the
starting meadow; God/Fly off, Havok grounded, no recoveries or recorded runtime/
GPU errors, seven enemies at full completion. No recording/profiling/build/review
concurrent. OS/driver caches uncontrolled. This is safe-navigation availability,
not measured travel time, public cold proof or a matched steady-FPS improvement.

| Pair/order | Whole navigation | Core navigation | Gain |
| --- | ---: | ---: | ---: |
|1 whole→core |6069.3 ms |4765.6 ms |21.48% |
|2 core→whole |6101.2 ms |4803.9 ms |21.26% |
|3 whole→core |6015.4 ms |4724.4 ms |21.46% |

Median full-ready is 8292.3 → 8726.6 ms: **434.3 ms later**, 5.2%. Encoded all-request
CDP bytes at navigation: 29,079,907 →21,068,630; full-ready: 38,154,695 →40,784,456,
**6.9% more overall**. Packet-only combined transfer rises 11.7% (25.03 vs 22.40 MB).
The navigation benefit is accepted with this explicit later-detail/transfer cost.
Local first play 531.4–535.9 ms is separate from public startup qualification.
Loading-interval tails are retained; worst valid-pair interval 51.9 ms, not claimed
as a steady-performance result. Exact range/EOF validation, all physical collision,
starting fence and reduced-tree completion checks remain unchanged.
[Declaration](timing-declaration.json), [compact timings/tails](timing-receipt.json),
[all pairs and raw intervals](pairs-mortal.json.gz), [frozen payload check](artifact-check.json).

**Retained invalid fixture:** the original first whole visit left ?dev God mode
on and failed the declared mortal condition; it is excluded from navigation pairs.
It also recorded **4725.9 ms first play**, including a 3332.5 ms world-priming queue
window and 1009.9 ms final first-queue window. Fixing the helper's God state does
not clear this startup concern. [Original row](invalid-god-fixture.json.gz),
[startup diagnosis/limits](../startup-completion-2026-10-09/README.md).
The corrected declaration's original wording “not a product failure” refers to
its God-state assertion; it must not be read as dismissal of the startup tail.

The paired helper SHA is frozen in its declaration. For reproducing either mode
on old/new products, the committed helper now sets explicit `regionCore=0/1`.
Recorded URLs omitted 0 under the old default-off predicate; the paired dist was
not changed or resealed to the later default. No comparison rerun for passing
numbers followed adoption.

## Settled performance

Three 12-second windows each on meadow/town/bridge/cathedral/forest, M1 Max,
uncapped Chromium WebGPU, 1280×720/DPR1, seven enemies, no GPU timestamp queries,
recording, encoding, build, review or other game renderer. Diagnostic initial
placements/God mode, Havok active/Fly off. Every window records native movement,
zero recovery changes and an empty existing GPU-error ledger.

**188.5–240.3 FPS**, maximum p95 **6.1 ms**, p99 **6.5 ms**, worst **13.6 ms**;
zero intervals >16.67 ms, full-window pacing flags or recorded runtime/GPU errors.
Root exactly recomputed all 38,631 raw intervals against both native summary
functions. [Receipt](performance-receipt.json), [all frames](fps.json.gz).
Measured existing aafce17b/core path before default selection; no geometry,
collision, shadows or per-frame work changes in adoption. No paired FPS gain claim.

## Default and reproduction

Ordinary entry now chooses the existing core path; only ?dev&regionCore=0 opts
out. Missing core metadata retains the loader's whole-packet compatibility path.
The additive schema field `experimentalCore` keeps its existing name; assets and
packet partition were not rebaked. Developer tools shows actual loader mode and
“Reload with whole-region loading” / “Reload with physical surfaces first”. Both
preserve the selected destination and comparison flag in shareable spawn links.

The first native roundtrip found a real selector reset to cathedral-nave. It is
retained in [failed-selector.json](failed-selector.json), corrected by initializing
from URL `at=` in 7673031, rebuilt with a restarted compressed server, then passed
five local cases. [Full local report](native-local.json.gz): default/whole/core
roundtrip; truncated detail retains routes and reduced trees then retries only
detail; core failure keeps navigation closed until retry; ordinary entry ignores
the dev-only opt-out; disposal aborts held detail without resurrection.

Final immutable public checks pass: [three native entries](entry-public.txt),
[twenty developer landings](destinations-public.json.gz), [six physical surface
picks](surfaces-public.json.gz), and [all five default/UI/fault/retry/disposal
cases](native-public.json.gz). All required native runtime/GPU lists are empty;
intentional 503 core failure is separately expected and labelled. No recoveries.
[651 delivered artifact rows](served-preview.json.gz) match exact local bytes.
No production mutation: [fresh canonical metadata](production.json).
Previous [woodland motion proof](../region-core-motion-2026-10-09/README.md) retains
normal trunk contact/escape, paused full arrival and 100/140 m visibility/shadows.
Prior geometry coverage remains evidence; no source review replaces native play.

## Reviewed motion and independent review

Root reviewed the actual 12.795695-second 1280×720 MP4, sampled 3/6/10-second original
frames, and local/direct VE playback and seeking. Diagnostic deliberate truncated
detail, developer jump/God mode, native short balcony movement, Fly off, retry and
menu. The shown loading failure is injected; this is functional evidence, no FPS
claim from recording. Square pixels/rotation 0 and elapsed timestamps preserved.
**Telegram 903**, API dimensions verified; Telegram application inline/fullscreen
playback remains unverified. [Actual direct VE video/mp4](https://ve.sparkify.dev/wow-clone/ashen-reach/gothic-exploration/2026-10-09/core-default.mp4),
[VE byte/range/native playback receipt](ve-receipt.json).

Fresh Grok 4.6/high used 8 bounded turns plus 3 report-only turns. Its
[partial independent review](grok-review.md) checked paired arithmetic, native
flags, per-window tails and source coverage/fallback. Root resolved its remaining
selector/log-label concerns, recomputed full-window stats and reviewed actual
motion; [root disposition](root-review.json). Review did not independently accept
live default playback, public startup or production. Both startup concerns remain.

## Ownership cleanup

One owned game renderer per live check. Settled Chrome 50968/CDP10037 and
Vite 50905+50929/5873 closed before source review/build/capture. Native Chrome 73894
and corrected 79125, then public 94843, closed with each slot 7 harness; corresponding
Vite processes stopped. Comparison server 39964, native 74369/80023 on 7074 and
media 88343 on 7077 stopped; Edge local/VE review tabs 1147996224/6228 closed.
The invalid comparison Chrome 43575, six valid comparison browsers and two
diagnostic browsers closed finally; PIDs remain in native ownership receipts.
Grok reviewer/one report-only resume ended. Preserved user Edge 2931/fifteen tabs,
Chrome 13883/New Tab, Orca and unrelated Vite 4000. Final inventory has no owned
game renderer. This cleanup is independent of startup/FPS acceptance.
