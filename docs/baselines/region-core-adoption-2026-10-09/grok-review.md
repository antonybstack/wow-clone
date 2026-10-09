# Region-core timing / default / startup — independent source review

Grok 4.6/high. Source and recorded JSON only. No live verification, browsers, builds, tests, benchmarks, git mutation, deploy, or Telegram. Working tree was not reset. This is a partial evidence review, not acceptance. A turn cap is not a pass.

**Verdict.** The mortal 3-pair local comparison is arithmetically valid for the declared 50/10 Mbps 40 ms, God-off, ≥20% median `navigation-ready` target. Default-core source is compatible with the existing packet fallback and does not weaken EOF/coverage/fence checks in the files read; prior native/motion coverage is not this review’s acceptance, and root’s new native default checks were still in progress. No causal correction of the retained 1,140.1 ms production miss is in this evidence. No unresolved critical loader/validation defect was demonstrated in the files read after accounting for root’s later menu `at=` selection fix (`7673031`), which this review did not re-read or re-run.

## Accepted claims

- Mortal pairs in `.cache/region-core-timing-2026-10-09/pairs-mortal.json` meet the declared local median navigation-gain target: whole median 6069.300 ms, core median 4765.600 ms, gain 0.214802 (21.48%), `meets20Percent` true (`4765.600 ≤ 6069.300 × 0.8 = 4855.440`). Report `result` matches a recompute from `navigation.marks['navigation-ready']`. All three pair gains independently exceed 20% (21.48 / 21.26 / 21.46%).
- Mortal rows satisfy the helper’s recorded mortal conditions: `start.god===false`, `complete.god===false`, Fly off, Havok grounded, recoveries 0, enemies 7, empty GPU/runtime errors, canvas 1280×720, `regionCoreLoading` matches requested mode, local first-play 531.4–535.9 ms.
- Invalid `.cache/region-core-timing-2026-10-09/pairs.json` is one whole visit, God true at complete, assertion failure on `complete.god===false`, playable **4725.9 ms**, navigation 12962 ms. It is not a pair. Corrected helper (`scripts/ashen-reach/probe-region-core-timing.mjs` 47–51, 65) sets `ASHEN.dev.god=false` before W. That is a measurement correction. It is not a product God-mode fix, and the 4725.9 ms first-play stall in that fixture remains a retained startup concern.
- Dist identity in `artifact-check.json` (648 files, 399,200,099 bytes, seal `900b033a6da737a987207105e9b6bf1d2ccd47e48bb9948297c11f9b6f103278`) matches the G08 / aafce17b seal recorded in `docs/baselines/gothic-production-2026-10-09/README.md`. Timing visits used local `127.0.0.1:7074` against that frozen dist. Paired runs used helper SHA `2528395417645056839b070b9aa808e54aec687c133e024bb71c446cd3ae7f70`. Whole visits omitted `regionCore`; under the then-current `?dev && regionCore===1` gate that selected whole. No rerun after default adoption is in this cache.
- Settled core FPS on `https://aafce17b.fardel.pages.dev/?dev=&play=&clean=&regionCore=1&pixelRatio=1`: 15 windows, five routes × 3 × 12 s, seven enemies, Havok, movement on every window, empty `gpuErrors`, `fullWindowCap.vsyncCapped===false`, zero intervals >16.67 ms in the stored tails. This review recomputed `summarizeFrameIntervals` per window: every `row.tails` matches the raw `frames` exactly. Per-window `summary.fps` (600-sample) 186.776–235.544; all >120 and ≥144. No paired whole/core FPS claim is supported.
- `experimentalCore` is an additive schema-1 index field. Clients that ignore it still consume `index.geometry`. `coreLoading = regionCore && manifest.geometry.region?.experimentalCore===true` (`starter-world.js` 77) keeps the whole packet when core metadata is absent. No rebake is required for that compatibility.
- Prepared consume still validates core partition when `coreLoading` (`starter-world.js` 714–716, 738–743), still requires unique index/vertex coverage of every non-full-tree record before `finishNavigation`, still installs remaining boxes and disposes gates only there (673–689), still checks truncated/trailing bytes in `readRegionBlocks` (`region-stream.js` 33, 47–52). CPU fixtures in `scripts/test-prepared-region.mjs` and `scripts/test-region-stream.mjs` still refuse omitted/misclassified ranges and trailing bytes.
- `probe-playable-startup.mjs` 150–161 snapshots position/frame on the KeyW `keydown` (non-repeat). The motion wait (294–309) compares against that snapshot and records `motionObservedAt` from RAF polling. JSON then splits `motionUpperBoundMs` from `completionAfterMotionMs` after `whenNextGpuFrame()` (310–329). That prevents a pre-key idle drift from satisfying the move check, and it keeps the later GPU fence out of the motion upper bound.

## Rejected claims

- Public / production startup qualification, driver-cache coldness, or a causal fix of the 1,140.1 ms miss. `.cache/startup-completion-2026-10-09/{candidate,production}.json` are one visit each, Chrome shader disk cache off, playable 720.8 ms / 752.7 ms. Queue windows are ~75 ms / ~65 ms. The failed release sample’s first-completion window was 523.3 ms (`docs/baselines/gothic-production-2026-10-09/README.md`). These diagnostics do not reproduce or explain that miss. Production remains held.
- Default-core product acceptance, promotion, or a matched FPS improvement versus whole. Settled FPS is core-only on aafce17b. Timing is local 50/10/40 ms, OS/driver caches uncontrolled, `shaderDiskCacheDisabled:false`.
- Using the invalid God=true visit as timing, or treating the God disable as a product repair of the 4725.9 ms playable stall.
- Endorsing promotion from the after-first-play region-core loader change. Background region starts after playable (`bg-start` after `playable` in both the failed sample and the shader-cache-off visits).

## Q1 — 3-pair local navigation gain

Declared: three independent cold pairs, 50 Mbps down / 10 up / 40 ms, fresh Chrome, HTTP cache disabled, God/Fly off, Havok, seven enemies, median `navigation-ready` gain ≥20%, local first-play ≤1 s. OS/driver caches uncontrolled. Local comparison only.

| pair | order | whole nav ms | core nav ms |
| ---: | --- | ---: | ---: |
| 1 | whole→core | 6069.300 | 4765.600 |
| 2 | core→whole | 6101.200 | 4803.900 |
| 3 | whole→core | 6015.400 | 4724.400 |

First-play medians: whole 534.7 ms, core 532.5 ms (all ≤1 s locally). Full-ready (`complete.marks.ready`) medians: whole 8292.3 ms, core 8726.6 ms (core **slower** to full region, +434 ms / +5.2%). Encoded CDP bytes at the declared boundary (all requests): navigation 29,079,907 vs 21,068,630 (−8,011,277 / −27.5%); complete 38,154,695 vs 40,784,456 (**+2,629,761 / +6.9%**). The complete delta matches the plan’s extra 2,629,510 B split cost to CDP granularity. Navigation gain is a smaller first packet; total transfer and full-ready time increase.

Current helper `scripts/ashen-reach/probe-region-core-timing.mjs:26` sets `regionCore` to `mode==='core'?'1':'0'` before every visit. Checkpoint 1’s claim that it deletes the flag is obsolete. The recorded mortal pairs were taken with the older helper SHA `25283954…`, which omitted the flag on whole visits; that was correct for the frozen aafce17b `?dev && regionCore===1` gate. Do not treat a post-adoption helper edit as a new timing cohort.

Headless Chrome is used (`probe-region-core-timing.mjs:30`) and is not named in the declaration; it does not overturn the declared local arithmetic. n=3 is the declared method.

## Q2 — smallest safe default adoption (source)

Current files already implement the proposal:

- `src/ashen-reach/main.js:202` `const regionCore=!params.has('dev')||params.get('regionCore')!=='0'` — non-dev always core; `?dev&regionCore=0` opts out.
- `src/ashen-reach/dev-tools.js:159` `url.searchParams.set('regionCore',world.regionCoreLoading?'0':'1')` — switching core→whole sets `0`; deleting the flag would keep default core.
- `src/ashen-reach/menu.js:213–218` labels describe whole vs physical-first; “experimental” is gone from the button.

Source-safe under prior coverage for: packet fallback when `experimentalCore` is absent; `validateRegionCore` before core consume; incomplete-surface fence; box/gate `finishNavigation`; trailing-byte EOF; woodland reduced-until-full completion (prior candidate/motion baselines, not re-verified here). CPU tests still cover partition/trailing corruption. They do not cover the query-string default gate.

`scripts/ashen-reach/check-region-core.mjs` now names five native default/UI/fault cases, including ordinary non-dev core with `regionCore=0` ignored (line 38) and UI opt-out/back-in that must keep `at=` and shareable `regionCore`. Root independently found destination selection reset to cathedral-nave after a whole→core roundtrip, fixed menu initial selection from URL `at=` in `7673031`, rebuilt and restarted the compressed server; final native checks were in progress at review time. This review did not re-read `7673031` and did not see a passing native report. Prior `region-core-candidate` / `region-core-motion` native/motion proof remains `?dev&regionCore=1` on aafce17b and is separate. Root still owes changed-default UI/fault/native plus a reviewed MP4 before adoption is accepted.

Highest-impact residual for adoption: native default/UI roundtrip was not green in this cache; the cathedral-nave selection reset is a real product defect class that source inspection of the loader did not catch. Treat it as fixed only after the in-progress native pass, not from this document.

## Q3 — startup measurement correction

Retained original valid release miss: 1,140.1 ms, production unchanged (`docs/baselines/gothic-production-2026-10-09`, `failed-cold-default.json` `disableShaderCache:false`). First queue/callback delay unknown; no causal fix.

Shader-disk-cache-off visits (`declaration.json` probe SHA `43c69c63153f24d5c3ba5fa18eb5e80d4016918752c4c35ab43b36bde5320d11`, matching current `probe-playable-startup.mjs`): candidate 720.8 ms, production 752.7 ms; motion upper bounds 28.2 / 29.1 ms; fence-after-motion 23.8 / 23.3 ms. They do not prove driver-cache coldness.

The keydown snapshot does prevent pre-key drift false positives. The JSON split does avoid calling total fence lag “input latency.” Console still prints `inputMs: row.input.responseUpperBoundMs` (line 385), which includes the fence; operators reading only the log line can still mislabel it. That is a harness-label issue, not a promotion argument.

The invalid core-timing God=true row’s 4725.9 ms playable is a separate retained startup concern, not evidence that disabling God repaired first play.

## Settled FPS — what this review did and did not finish

Finished here: 15 rows present; routes meadow/town/bridge/cathedral/forest × 3; empty top-level `errors`; per-window `summarizeFrameIntervals(frames) === tails`; enemies 7; recoveries 0 before and after; physics true; `gpuErrors` length 0; all windows moved; all `vsyncCapped===false`; no stored tail interval >16.67 ms; 600-sample `summary.fps` all >120 and ≥144.

Not finished here: independent aggregate of all 38,631 raw intervals into one min/max. Root reports that aggregate as 188.5456–240.3185 FPS, p99 6.5 ms, worst 13.6 ms, zero >16.67 ms / errors / GPU ledger / recoveries / caps. That is root’s recompute, not this review’s.

`summary` is a 600-sample window; `fullWindow`/`tails` use every captured interval. They are different windows. Both still clear the floor in the stored rows. No matched improvement versus whole is claimed or evidenced.

## Highest-impact defects

1. **Default adoption is not accepted on this evidence.** Loader/fallback/validation source is compatible; the destination-select reset after whole→core is a demonstrated native UI defect, later patched in `7673031`, with native recheck still in progress. Missing from this review: passing native default/non-dev/fault report and reviewed MP4.
2. **Production 1,140.1 ms miss is unfixed.** Shader-cache-off <1 s visits and the region-core loader (post-playable) are not a causal correction. Do not promote from them.
3. **Invalid God=true fixture also failed local first play at 4725.9 ms.** Retain as startup concern. Do not bury it under the God-state measurement fix.

No other unresolved critical consume/EOF/fence/coverage defect was shown in `starter-world.js` / `region-stream.js` / prepared tests as read.

## Checked vs unchecked

**Checked:** mortal/invalid pair JSON arithmetic and flags; corrected vs original declarations; current helper `regionCore` 0/1 vs the frozen SHA used for pairs; artifact-check seal vs gothic-production G08 identity; first-play / full-ready / encoded-byte tradeoffs; per-window FPS tails via `summarizeFrameIntervals`; GPU-error arrays, uncapped flags, movement, seven enemies; `main.js` / `dev-tools.js` / `menu.js` default and labels; `coreLoading` fallback; `validateRegionCore`, incomplete-surface gate, `finishNavigation`, trailing-byte EOF; prepared/stream CPU tests; `probe-playable-startup.mjs` keydown snapshot and fence split; startup-completion JSON playable/input fields; gothic-production retained miss text; prior candidate/motion README claims as documents (not re-executed).

**Unchecked / not this review:** live play, native default pass after `7673031`, commit `7673031` body, reviewed MP4, public cold start, driver-cache contents, headed vs headless effect, 38,631-interval aggregate (root’s), `summarizeDurations` recompute of every `fullWindow` object, woodland visibility runtime, production 5723a4ab mutation, iPhone, concurrent-renderer isolation beyond ownership JSON, helper SHA of the current dirty helper versus `25283954`.
