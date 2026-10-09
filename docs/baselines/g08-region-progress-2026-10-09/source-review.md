# G08 source review — region progress (uncommitted)

Reviewer: Grok 4.6, read-only. Compared working-tree `starter-world.js`, `region-progress.js`, `background-loading.js`, `main.js`, `menu.js`, `dev-tools.js` and `scripts/test-region-progress.mjs` to `docs/plans/gothic-exploration/g08-region-progress-2026-10-09.md`.

No browser, builds, tests, or FPS measurement. Root owns native/candidate/dev/surface acceptance (CPU43 / native4 / candidate5 / dev20 / surface6 reported passing at review time). Root later notes: excluded-start support denominator corrected; count speech avoided; progress moved above the action bar. Those corrections are recorded here as post-read; they are not re-verified in this file.

## What the source does

- Optional `onProgress` on `world.startRegion`, passed through `loadRegion` → `loadPreparedRegion` / `finishNavigation`.
- `createRegionProgressReporter` publishes at most every 500 ms for the same phase, always on phase change and on `processed === total` when `total > 0`. Snapshots are `{...value}`.
- Prepared path emits `index`, `surfaces` (or core packet), `supports`, optional `detail`, `foliage`, `finishing`. Packet `processed` counts every `readRegionBlocks` item on this attempt, including `install()` no-ops. `encodedBytes` is the static packet size on consume snapshots.
- Worker path never calls the reporter (except `finishNavigation` default no-op). Indeterminate status remains.
- `showBackgroundLoading().progress` no-ops unless `mode === 'loading'`. Retry/fail/dispose set other modes and replace or remove the root. `main.js` also drops callbacks when `backgroundDisposed` or `deviceLost`.
- Wiring is after `finishLoading` / playable. No timer and no render-loop progress hook. Developer tools expose `world.streaming.progress`. Menu appends the phase label through existing `refreshDevTools`.
- CPU tests in `scripts/test-region-progress.mjs` cover throttle/final/phase order, snapshot aliasing, and label wording (no percent/seconds/downloaded).

## Findings (at most three)

### 1. Progress truthfulness: retry always announces index, and `finishing` then goes silent

`loadPreparedRegion` always `reportProgress({phase:'index'})` before `preparedRegionIndex??readPacket(...)`. After a core success, a detail or foliage retry still publishes `index` even when the index is already in memory and surfaces/supports are skipped (`navigationComplete` / `regionDetailComplete`). The live label becomes “Reading the region index…” for work that is not happening.

`finishing` is published at the end of `loadPreparedRegion`, then `backgroundStatus.done()` waits on nearby foliage, full foliage, texture upgrade, folk, and hostiles. The widget stays on “Finishing region details; routes are open…” through that tail. Packet counters themselves match the plan (attempt ranges, including idempotent re-walks; static encoded size; not network bytes).

Surfaces copy places “(N MB packet)” next to a native `<progress>` driven by range counts. The count line says ranges/supports; the bar still reads as a fill of that packet. Not invented seconds, but easy to take as download percent.

Throttle math matches “two per second”: `now-last < 500` drops intermediates; phase changes and the first `processed === total` always publish. Duplicate finals of the same phase are suppressed.

### 2. Navigation announcement tears down the progress widget

`navigationReady()` sets `routesReady` and assigns `root.textContent = loadingText()` with no `mode` check. That destroys the label/bar/count built by `progress()`. The next published phase rebuilds them because `!root.contains(bar)`.

On the prepared path the wipe and the next `progress()` (`detail` at 0 or `foliage`) run in the same turn, so the generic “Adding region details…” string may never paint. The progress element is still thrown away and recreated; native bar state is lost. `role="status"` can queue both strings.

Retry/fail/dispose currently look closed: `progress()` returns when `mode !== 'loading'`; retry click sets `mode='loading'` and clears children; `dispose`/`fail` set terminal modes; `main.js` guards disposed/device-lost before calling `progress()`. `navigationReady` is one-shot (`ashen.navigationReady`), so overwriting Retry/Reload through that path is not reached in the present control flow. The missing mode guard remains a footgun if `onNavigationReady` ever runs again.

CPU tests do not drive `showBackgroundLoading` retry/disposal/progress.

### 3. First-play fence is respected; published ticks still run DOM work inside the 1 ms install slice

`onProgress` is attached only after playable. `createRegionProgressReporter` is not on RAF. `performance.now()` runs on every range; `{...value}` and DOM work run only on published ticks.

Those ticks are still on the `install` → `progress()` → 1 ms `yieldToFrame` stack. `backgroundStatus.progress` mutates DOM there. If the menu is open, `menu.refreshDevTools()` rebuilds developer status (and destination/button state) on the same stack. Phase boundaries always publish, so a burst of phases is extra main-thread work before the yield. This is a coupling observation, not a measured hitch or FPS claim.

## Unchecked

- Live game, MP4, Telegram, VE, public/desktop native, device-lost while a progress callback is on the stack.
- Isolated timing/FPS; extra renderer contamination.
- `scripts/test-region-progress.mjs` execution in this review.
- `showBackgroundLoading` hold/fail/retry/dispose DOM tests; five native failure cases; twenty landings; six surface picks.
- Worker-path UI beyond reading that it never reports counts.
- Whether root’s post-read action-bar move, support denominator, and count-speech split match the tree as of this file (menu already split phase text vs `aria-hidden` count in the last menu read; `background-loading.js` was still `bottom:24px` in the snapshot that was read).
- Unrelated dirty files (`AGENTS.md`, `docs/plans/character-mmo/next-ten.md`, pycache, wrangler).

## Root adjudication after review

Reviewer first run actually stopped `cancelled`,6 turns; the bounded report-only
resume stopped `end_turn`,3 turns. It produced no initial artifact before the cap.
Root independently read current code and tested the actual browser behavior.

Accepted/corrected: index phase now emits only for an actual index request;
navigation completion preserves the native progress node and respects terminal
widget modes. The support denominator excludes boxes already owned by the start.
Count text is excluded from live speech in both ordinary status and Developer
tools, with phase text replaced only when changed. Reviewed live motion exposed
an actionbar overlap, fixed by moving the panel above it. Those corrections are
in product4b6707a. No permanent new lifecycle or DOM harness was invented.

The final indeterminate phase accurately covers existing foliage/texture/NPC
completion; no fake counters were added. Processing ranges are explicitly labelled
beneath the bar and static packet size is not a downloaded byte counter. Published
DOM work remains inside the existing yielded install loop at a bounded cadence;
this is not evidence of a measured hitch. Isolated performance is pending; root
accepts no fresh speed/FPS claim from functional recording. Four progress cases,
five existing candidate cases, twenty destinations and six physical picks pass
on the final public preview. The native retry/disposal tests cover the widget
lifecycle that the source reviewer did not execute.
