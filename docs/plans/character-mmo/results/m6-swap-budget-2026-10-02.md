# Milestone 6, task 6 — what a piece change actually costs

**2026-10-02.** Game source `8ae4c2d`, one owned rendering client at a time, no production claim.

The motion matrix measured 18.8 ms median, but 119 of its 120 equip rows rebuilt a piece from
bytes the browser already held. That is the *rebuild* cost, not the cost a player pays the first
time they put something on. This measures all three tiers, and separates request latency from
frame cost, which are different claims.

## Result

**51 cold rows**, three repeats per slot per race, each in a fresh context with the HTTP cache
disabled, against a piece that context had never loaded, at **50 Mbit/s / 40 ms** — the same
network profile as the shared cold-start gate. Every row asserts the fetch actually happened
before it reports a number.
[Data](../../../baselines/character-mmo/m6/swap-budget.json) ·
[measurement](../../../../scripts/character-assets/measure-swap-budget.mjs).

| Tier | What it is | n | median | p95 | worst |
| --- | --- | --- | --- | --- | --- |
| **Cold** | piece fetched over the network | 51 | **86.1 ms** | 121.8 | 122.6 |
| **Rebuilt** | bytes already held, piece rebuilt | 168 | **18.8 ms** | 32.8 | 48.6 |
| **Resident** | still in the loader's cache | 36 | **0.5 ms** | 4.3 | 4.8 |

The loader keeps two idle pieces, so the rebuilt tier is the common one in ordinary play and the
resident tier only applies to a piece just taken off.

Cold latency by slot — it tracks asset size, not slot:

| Slot | n | median | worst | bytes (median) |
| --- | --- | --- | --- | --- |
| torso | 9 | 118.1 | 122.6 | largest pieces, up to 404 KiB |
| helmet | 6 | 113.4 | 121.8 | |
| boots | 9 | 96.2 | 100.8 | |
| gloves | 9 | 81.0 | 91.6 | |
| legs | 9 | 78.9 | 82.2 | |
| shoulders | 9 | 55.3 | 64.7 | 26 KiB, the smallest piece |

## Frame cost is the part that matters, and it is not the same number

A 122 ms fetch is not a stall; a 122 ms frame would be. Measured across the cold swap window:

* **Worst frame: median 14.1 ms, p95 21.2 ms, maximum 21.9 ms.**
* **Zero of 51 exceed 33.33 ms**, the gate.
* **11 of 51 exceed 16.67 ms** — so a cold swap can drop a frame at 60 Hz. The warm path never
  did: 0 of 168 rows in the motion matrix went over 16.67 ms, worst 14.9.

That is the honest statement of the cost: putting on a piece for the first time can cost one
frame at 60 Hz; putting on a piece you have worn before cannot.

## Proposed ceilings

Derived from the measurements with headroom, so a future piece that breaks them fails rather
than being noticed later. These are proposals — **nothing enforces them yet**, and wiring this
measurement into a gate is the remaining work:

| Gate | Proposed ceiling | Worst observed |
| --- | --- | --- |
| Cold request latency at 50 Mbit/s / 40 ms | 200 ms | 122.6 ms |
| Worst frame during any swap | 33.33 ms | 21.9 ms cold, 14.9 ms warm |
| Resident re-equip | 10 ms | 4.8 ms |
| Published bytes per piece | 512 KiB | 404 KiB (Orc Graveweaver hood) |

## Scope and exclusions

* **Hand slots are excluded**, by catalogue shape rather than by name: a factory prop is built in
  the page and has no response to fetch, so it has no cold cost. They appear in the swap matrix
  and the failure matrix instead.
* **Three rows are skipped and recorded**: the Undead helmet, where `graveweaverHood` is the only
  helmet in the catalogue and the Undead boot loadout wears it, so it cannot be made un-fetched.
* Throttling is applied **after** startup, so this measures the swap and not the cold-start gate.
* These are local dev-server fetches shaped by CDP throttling, not a CDN measurement.
