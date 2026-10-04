# Milestone 6, task 6 — the swap budget enforced

**2026-10-03.** The budget was measured on 2026-10-02 and its ceilings were *proposed*; nothing
enforced them. This turns them into gates, and setting them honestly moved two of the four.

## The gates

[Budget](../../../../scripts/lib/swap-budget.mjs) ·
[offline test](../../../../scripts/test-swap-budget.mjs) ·
[live gate](../../../../scripts/character-assets/measure-swap-budget.mjs) ·
[run](../../../baselines/character-mmo/m6/swap-budget-gate.json).

| Ceiling | Value | Worst observed | Where it runs |
| --- | --- | --- | --- |
| Cold request latency | 200 ms | 127.2 ms | live, per piece per race |
| Worst frame in a swap | 33.33 ms | 15.5 ms | live |
| Warm swap, resident or rebuilt | 60 ms | 4.0 ms | live |
| Published bytes per piece | **896 KiB** | 414 KiB (live) / 768 KiB (all packs) | **offline, every test run** |

**51 live rows across three races, zero breaches**, and the byte gate runs in `npm run
test:equipment` with no browser, so an oversized piece fails before anyone measures anything.

## Two ceilings were wrong, and the gate is what showed it

**The byte ceiling was 512 KiB and that was below the published p95.** It had been generalised
from the pieces one measurement happened to fetch, which never touched the shape-family pack.
Across all four packs the distribution is 70 pieces, median 249 KB, p95 520 KB, **max 768 KB**
(`humanShape/pilgrimTunic`). The first run of the new test failed immediately on it.

The replacement is **derived from the latency ceiling rather than stated beside it**: a piece at
the ceiling must transfer, arrive and build within `coldLatencyMs` on the named profile, which
gives `(200 − 40 latency − 20 build) ms × 6.25 MB/s = 896 KiB`. A test asserts that relationship
so the two cannot drift apart again. The largest shipped piece is **84% of the ceiling**, so the
headroom is real but modest, and a separate test fails if content grows past 90%.

**The 10 ms resident ceiling was breached on its first live run**, by a 10.9 ms sample. Rather
than raise it, the distribution was characterised: across **240 re-equips** the median is 0.10 ms
and the p95 4.10, but the p99 is **21.10** and the maximum **26.90**. That tail is the rebuild
path showing through — the loader keeps only two idle pieces, so alternating between two items in
a slot evicts them, and some "resident" samples were really rebuilds.

So a caller cannot tell which path a change will take, and two ceilings were the wrong shape.
They are now **one warm-swap ceiling of 60 ms**, set from the rebuilt distribution (18.8 ms
median, 48.6 worst). A warm swap may exceed one frame legitimately — it is wall-clock work spread
across frames, not a stall — and the 33.33 ms frame ceiling is what bounds the part a player
feels.

## What this does not do

* The live gate needs a harness, so only the byte ceiling runs in ordinary CI.
* The cold figures are local dev-server fetches shaped by CDP throttling, not a CDN.
* Three Undead helmet rows remain untestable, as before: `graveweaverHood` is the only helmet and
  the Undead boot loadout wears it, so it cannot be made un-fetched.
