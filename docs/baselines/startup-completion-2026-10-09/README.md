# Bounded first-completion diagnosis — 2026-10-09

**No causal startup correction demonstrated. Production is unchanged.** Two
predeclared fresh-process instrumented visits with Chrome shader disk cache and
HTTP cache disabled did not reproduce the retained [1,140.1 ms first-play
miss](../gothic-production-2026-10-09/README.md). Candidate completed at 720.8 ms;
production at 752.7 ms. First-render return → queue callback: 82.7/77.1 ms, versus
523.3 ms in the failed sample. These are callback wall times, not hardware GPU times.
No runtime/GPU/transport errors recorded. OS/driver/DNS/CDN caches are uncontrolled;
disabling Chrome's shader disk cache does not establish a cold Metal driver cache.

[Predeclared conditions](declaration.json), [candidate native report](candidate.json.gz),
[production native report](production.json.gz), [hashes and trace limits](receipt.json).
1280×720/DPR1,50 Mbps down / 10 Mbps up / 40 ms, one owned renderer, no recording/build/review
concurrent. Root inspected both actual starting-area stills. Chrome traces contain
Dawn/Metal/compositor work but successful traces cannot attribute an earlier
untraced miss. No unchanged acceptance cohort was reopened.

## Input probe correction

`scripts/ashen-reach/probe-playable-startup.mjs` now snapshots position and frame
at the actual nonrepeat KeyW event, after the screenshot. The native RAF polling
predicate compares against that snapshot, requiring >0.03 m movement and two new
frames. Idle drift before the key cannot satisfy it. It stores the observation
time before awaiting the next GPU-completed frame, preserving the old total bound
and reporting movement separately. Documentation links are in code.

| Visit | Key → RAF-observed motion upper bound | Subsequent completion/observation | Old combined upper bound |
| --- | ---: | ---: | ---: |
| Candidate |28.2 ms |23.8 ms |52.0 ms |
| Production |29.1 ms |23.3 ms |52.4 ms |

This is an observation bound, not exact input latency. The original 4284.2 ms total
included the later GPU fence; it cannot be relabelled as measured 4.3 s key-to-motion.
Later passing visits do not clear its concerning tail. The probe change adds no
runtime/game-module work and does not fix GPU initialization.

The [invalid God-mode local core-comparison fixture](../region-core-adoption-2026-10-09/README.md)
also records 4725.9 ms first play: world priming 363.4→3695.9 ms, then final first
queue 3708→4717.9 ms. Its God mode invalidates that navigation pair; it does not make
this startup tail disappear. No cause or fix is attributed from that untraced row.
Production remains held; the post-play core loader cannot correct either miss.

## Focused next startup work

Use the existing named pipeline/GPU event/Chrome trace facilities to attribute a
miss under a predeclared bounded experiment. Distinguish world-primed and skipped
branches, first-queue work and callback scheduling. Do not delete caches belonging
to user browsers, wrap application acceptance promises, retry unchanged cohorts
for passing samples or substitute submitted frames for dressed/grounded GPU
completion. A demonstrated correction needs a changed committed build/seal and
fresh public startup/native/served gates before promotion. This is the remaining
release work; mobile remains backlogged.

The compact console receipt also now names `inputMotionUpperBoundMs`,
`completionAfterMotionMs` and `inputTotalUpperBoundMs` explicitly. Grok identified
the old ambiguous `inputMs` label during review; d240f76 corrects it. A fresh
build matches every native-qualified runtime file; no game-bundle change or
additional diagnostic start is inferred from this operator-only edit.
