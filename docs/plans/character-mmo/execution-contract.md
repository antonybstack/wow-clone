# Execution contract for M001–M010

Status: M001–M005 completed; M006 source-art gate remains open after a licensed live ponytail audition; M007 semantic coverage verified with fit acceptance open. Read [CURRENT](../../CURRENT.md), the [next-ten plan](next-ten.md), and the single milestone brief assigned to you. These instructions are designed for Claude Opus 5.5 or GPT-6 Sol at medium effort. Do not implement all 100 milestones from an isolated brief.

## Baseline and ownership

1. Record current branch, HEAD and `git status --short`. Preserve unrelated changes, including the pre-existing AGENTS.md edit. Re-read live files; historical plans are evidence, not authority.
2. Keep Babylon Lite 1.31.1 and Havok 1.3.14 pinned for these milestones. Research installed declarations and native source before adding an adapter. Do not import Classic Babylon APIs. If an engine defect blocks a gate, isolate it and record the smallest upstream reproduction rather than silently upgrading.
3. Use one owned game renderer at a time for measurements. Follow [browser ownership](../../debug-view.md#browser-ownership-and-performance-isolation). Record owner, browser PID, CDP port, game URL/Vite port, purpose and teardown result. A harness landing page counts as a renderer: close or navigate it to `about:blank` before a probe creates its own game page. Never stop an unidentified user browser.
4. Do not spawn more workers unless current user/repository instructions authorize them. Any delegated live check has an explicit single owner and cannot render concurrently with a benchmark.
5. Keep measurements separate from video recording, browser profiling and asset-generation jobs. No comparison collected with unexplained competing renderers is acceptable.

## Scope and implementation rules

- Use existing source animation, equipment loader, fit validation, coverage, sockets and lifecycle helpers. Test a native API with one actor before scaling it.
- Every API introduced in a brief is a **proposed project API**, unless explicitly identified as an existing engine or repository API. Verify existing names and signatures in source.
- Add documentation links in comments at non-obvious boundaries: bind compatibility, deformation order, native baked-animation behavior, shared resource disposal, and scheduled upload limits. Cite an actual applicable API/specification; avoid decorative link lists.
- Keep diagnostics and asset authoring out of the initial play import graph. No creator or crowd payload becomes a startup dependency in M001–M003.
- No production body/garment replacement, gameplay collision change, backend adoption, 30-set production or deployment is part of M001–M003.
- Each milestone owns a results report, with implemented / measured / visual-reviewed / deferred labels. A prototype can finish with a documented negative result. It cannot claim the intended performance target passed when it failed.
- Generated fixtures and benchmark assets need source hashes, a deterministic recipe and licensing. Keep raw large captures in ignored `ve-capture/`; commit compact machine-readable reports, metadata and reviewed-media URLs.

## Measurement protocol

Existing evidence: [progressive startup release](../../complete/2026-09/one-second-startup-implementation-2026-09-27.md). Re-read the report after documentation moves; its current index is in [CURRENT](../../CURRENT.md).

### Settled gameplay regression

Use the same machine for paired baseline/candidate runs: M1 Max if available; uncapped Chromium WebGPU; actual 1280×720 render buffer and device scale 1; seven enemies; no recording. Use `scripts/ashen-reach/measure-region-fps.mjs` for meadow, town, bridge, cathedral and forest, three 12-second runs each after readiness/settling. Record browser/OS/GPU, power state if accessible, source and asset hashes, warm-up, network/cache state and all errors. Reject a capped run as evidence of throughput above the cap.

Report per-run and aggregate mean FPS, frame-time p50/p95/p99/max, counts above 6.94/8.33/16.67/33.33 ms, and raw intervals. Use nearest-rank percentiles and state whether intervals measure `requestAnimationFrame`, CPU work or GPU time. Averages above 144 do not mean every frame meets 6.94 ms. Missing GPU timestamps or memory metrics are marked unavailable, never zero.

Proposed preservation gate: each route remains >144 mean FPS on the established desktop profile, with >120 the historical floor; no repeatable >5% worsening in mean frame time or p95/p99 relative to a fresh paired baseline. A failed first comparison gets one paired confirmation and attribution, not endless reruns until success. If the current checkout already misses these values, record that inherited result in M001; do not rewrite the baseline or imply this planning task guarantees hardware capacity.

### Cold startup regression

Use `scripts/ashen-reach/probe-playable-startup.mjs` against a production build on the compressed preview server, not Vite transformation timings. Build with `ASHEN_PAGES=1 npm run build` for this comparison; never invoke the deploy script just to prepare a local measurement. Twenty fresh Chrome processes/profiles at 50 Mbit/s / 40 ms configured latency; 1280×720; ordinary pacing; no other game process. Measure navigation to dressed, grounded, GPU-completed frame, overlay removed and input enabled, then verify movement. Record network bytes and all failures. OS/DNS/CDN/driver caches are uncontrolled. Gate: p95 <=1,000 ms on this profile, with every outlier retained; this is not a universal one-second claim. The released reference achieved 19/20 <=1 s and a 1,054.5 ms maximum. Repeat native/10 Mbit/s profiles only when a change or uncertainty justifies them.

### Crowd feasibility

M003 defines a distinct matrix and does not inherit the solo seven-enemy result as proof. Report capacity curves; a 1,000-actor run can fail. Keep a settled diagnostic scene separate from actual-region confirmation. Include spawn/stream/churn tails separately from settled throughput. Later M009/M010 set supported crowd quality tiers from these results. Physical iPhone startup, memory and population capacity require physical hardware and may remain explicitly pending if unavailable.

## Verification and delivery

- Run focused tests for changed behavior, `npm run test:character`, `npm run test:equipment`, and `npm run build` where the brief requires them. Do not change expected assets/counts to make a mismatch disappear.
- Inspect actual game motion for visual/runtime work; numeric contracts do not establish tailoring. Check movement, jump/land, both spells, two-handed contact, race switching, cancelled loading and resource teardown when touched.
- A visual cycle requires a reviewed live MP4/GIF delivered with `bash scripts/tg file`, following [capture procedure](../../debug-view.md). Preserve viewport/canvas/frame/encoded dimensions, elapsed time, square pixels and delivery verification. Update its ledger after committing if needed. Never put credentials in an artifact.
- Commit and push only completed task files; report test/push failures. Update CURRENT and milestone result/status links with facts. Deployment of later accepted runtime milestones follows [DEPLOY](../../DEPLOY.md) and the existing production verification/rollback gates. M001–M003 have no deploy step.
- Before ending, shut down owned browser contexts/processes/harnesses and account for them in the report. Background review workers must also be finished or explicitly stopped.
