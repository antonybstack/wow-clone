# G09 source review — 2026-10-09

**Verdict: retain the production hold. No supported new causal hypothesis. Do not run a runtime experiment from this review.**

This session read the retained receipts and failed samples, then ended at the CLI turn cap before the listed `src/ashen-reach` files. A later resume forbade further reads. Findings below are from those retained artifacts only. They do not treat either miss as fixed.

## Files checked

- `docs/baselines/startup-completion-2026-10-09/README.md`
- `docs/baselines/startup-completion-2026-10-09/receipt.json`
- `docs/baselines/gothic-production-2026-10-09/README.md`
- `docs/baselines/gothic-production-2026-10-09/failure-receipt.json`
- `docs/baselines/gothic-production-2026-10-09/failed-cold-default.json` (conditions, marks, resources through playable, playable/input/error fields)
- `docs/baselines/region-core-adoption-2026-10-09/README.md` (invalid-fixture section)
- `docs/baselines/region-core-adoption-2026-10-09/invalid-god-fixture.json.gz` (conditions, start/complete marks, god flag, failure)
- `docs/CURRENT.md` (current-state paragraph only)
- `docs/plans/gothic-exploration/next-24-hours-2026-10-09.md` (G09 bound only)

## Files remaining unchecked

These were in the allowed source list and were not opened:

- `src/ashen-reach/main.js` startup sections
- `src/ashen-reach/prime-starter-world.js`
- `src/ashen-reach/register-late-features.js`
- `src/ashen-reach/render-loop.js`
- `src/ashen-reach/frame-scheduler.js`
- `src/ashen-reach/startup-trace.js`
- Installed Lite (no precise hypothesis reached the threshold to inspect it)
- `scripts/ashen-reach/probe-playable-startup.mjs` (named in the plan; outside the resume’s existing-observation set)

## Observed marks

### Public first-valid cold start (held)

`failed-cold-default.json`: preview `aafce17b`, source `7b9f567…` / product `4b6707a`, Chrome PID 75164, `disableShaderCache:false`, HTTP cache disabled, 50 Mbps / 40 ms, 1280×720, `gpuProbe:false`, `traceGpu:false`, `tasks:[]`. Dressed, grounded, Havok active, empty runtime/GPU/transport errors. Frame 5 at playable. 29 requests / 2,193,984 encoded bytes at the boundary.

| Mark | ms |
| --- | ---: |
| begin | 477.4 |
| world-end | 528.9 |
| havok-end | 555.0 |
| prime-world-skipped | 555.1 |
| body-end | 569.4 |
| equipment-end | 581.5 |
| register-start → register-end | 586.3 → 602.9 (16.6) |
| first-render-return | 608.6 |
| supported-frame-submitted | 633.8 |
| first-gpu-completed | 1131.9 |
| supported-frame-completed | 1139.7 |
| playable | 1140.1 |
| bg-start | 1141.0 |

First-render-return → first-gpu-completed = **523.3 ms**. Supported submit → complete = 505.9 ms. Region index request is after playable. Priming did not run; the skip is recorded because the body request had already settled (`body-coverage-…bin` resource end 529.8, before `prime-world-skipped`).

Input upper bound 4284.2 ms includes harness screenshot and a later GPU fence. It is not isolated key-to-motion.

### Later instrumented visits (do not explain the miss)

Failure-receipt diagnostics, same network/viewport, optional GPU events + Chrome trace, no acceptance budget:

- candidate `aafce17b`: playable 739.5 ms, first-queue callback 80.0 ms, 53 `createRenderPipeline` labels
- production `5723a4ab`: playable 912.8 ms, first-queue callback 81.5 ms, same 53 labels

Startup-completion shader-disk-cache-off visits: candidate 720.8 ms / 82.7 ms first-render-return→callback; production 752.7 ms / 77.1 ms. Receipt: successful traces do not attribute an earlier untraced 523 ms callback window. OS/driver/DNS/CDN caches remain uncontrolled.

### Invalid God fixture (retained startup concern)

`invalid-god-fixture.json.gz`, local `http://127.0.0.1:7074/?dev=&play=&clean=&pixelRatio=1`, mode `whole`, `complete.god === true`, assertion `true !== false`. Navigation pair is invalid. Startup marks remain:

| Mark | ms |
| --- | ---: |
| prime-world-start | 347.2 |
| prime-world-registered | 359.0 |
| prime-world-submitted | 363.4 |
| body-start | 462.0 |
| register-start | 491.4 |
| prime-world-completed | 3695.9 |
| register-end | 3704.9 |
| first-render-return | 3708.0 |
| supported-frame-submitted | 3721.2 |
| first-gpu-completed | 4717.9 |
| playable | 4725.9 |
| bg-start | 4726.8 |

World-prime submit → complete = **3332.5 ms**. First-render-return → first-gpu-completed = **1009.9 ms**. Register-end is 9.0 ms after prime-world-completed. Body/equipment and register-start run while priming is in flight; register-end does not. `bg-start` is after playable here as well.

## Discriminator (not a cause)

The two retained long starts occupy **different named windows**:

1. Public 1140.1 ms: priming skipped; the over-budget interval is the first GPU-queue callback after first render return (523.3 ms).
2. Local God fixture 4725.9 ms: priming ran and completed 3332.5 ms after submit; registration ends immediately after that completion; a second ~1.01 s first-queue window follows.

That mark split is already stated in the startup-completion and region-core-adoption READMEs. It does not name a shader, pipeline, callback scheduler, or game module. A single ShaderMaterial-async trial cannot cover both windows, and the existing async ShaderMaterial experiment is already negative and excludes PBR/post.

Queue callback times in all of these rows are `GPUQueue.onSubmittedWorkDone` wall times. They are not hardware GPU durations.

## Hypothesis

**None new and supported.**

A game-source claim would need a read of the unchecked startup modules plus a discriminator that the untraced 523.3 ms public window can actually fail. Successful ~80 ms traced visits cannot assign compositor/Dawn/Metal work back onto that untraced sample. Driver-cache coldness is uncontrolled even with Chrome shader disk cache off. Core loading starts at `bg-start` after playable in both long samples and is not a candidate.

Repeating an unchanged diagnostic visit, enabling async ShaderMaterial by default, wrapping acceptance promises, or substituting a submitted frame would not be a supported next step from this review.

## Root action

Retain the release hold. Do not authorize a G09 runtime experiment from this report. G10 may proceed independently. Reopen startup work only if someone completes the unchecked source read and produces a new discriminating, source-backed hypothesis, or if a distinct attributed miss appears.
