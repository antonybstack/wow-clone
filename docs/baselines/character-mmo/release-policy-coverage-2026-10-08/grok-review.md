# Release-policy coverage — one production cache conflict

One `run-ops.mjs` run, CLI 1. No retry, no browser, no rebuild. Production 5723a4ab, rejected preview 514fe898, historical request/body cause, phone exits, and release hold stay open. No prod-pass claim.

## Ops

Controller **64666**. Preserved build `.cache/character-mmo/queue-comparison-2026-10-07/budget-4` still 551 files / 296653100 B matching seal `3098125a…` (source `7d00c56c`). Root `dist/` was not used.

| step | pid | expected | actual |
|---|---|---|---|
| legacy-blind-policy | 64683 | 1 | 1 |
| http-controls | 64707 | 0 | 0 (27/27) |
| production-readonly | 64820 | 0 | 1 |

`sourceAfter` not recorded (stop after production). `sourceBefore` hashes recorded.

Old verifier counterexample: node test `not ok` because the legacy CLI exited **0** on equal `assets/v2/game-Abc.js` bytes with a wrong cache header. That is the intended false-pass of the old gate.

## Production-readonly failure (concrete)

554 rows. Byte `match` 554/554. Two missing-path 404s: status 404, `no-store`, `match` true. Five mutable manifests present (`no-cache`); `presence-v1/manifest.json` is not in this historical 551-file set and was not required.

One `cacheCorrect: false`:

`assets/v2/HavokPhysics-BqNY-4N9.wasm`

- actual: `public, max-age=31536000, immutable, public, max-age=60, must-revalidate`
- classified `legacy-wasm` because `file.endsWith('.wasm')` runs before the `assets/` immutable family
- expected: `public, max-age=60, must-revalidate`
- bytes and `application/wasm` match

That is two TTLs on one response (1y immutable plus 60s must-revalidate). Full directive-set equality correctly refuses it. Unhashed `HavokPhysics.wasm` has only the 60s policy and passes. `physics/HavokPhysics-8f4493dae88a.wasm.br` has immutable+`no-transform` and passes.

This is a real overlapping `_headers` match on hashed WASM under `/assets/`, not a byte-hash miss and not a false-pass. Reclassifying the file as `immutable-asset` would still fail until the served header is a single directive set.

`public/_headers` declares both `/assets/*` → 1y immutable and `/*.wasm` → 60s must-revalidate. Pages concatenates matching rules; that is the served dual header. The old asset check (`includes('immutable') && !includes('no-cache')`) would have accepted this row. Full directive-set equality is the gate that now fails it.

## Cleanup

PIDs 64666, 64683, 64707, 64820 terminal. Ports 5173/7074/7076/10037 idle. No owned Chrome. Edge 2931 and Orca 98938 untouched. Worker wrote only this cache tree.

---

# Attempt 2 — local Pages header split, production still overlapping

One `run-ops-2.mjs` run, CLI 0. Source hashes stable. Local Wrangler Pages fixture passed. This is not a production CDN pass. Attempt-1’s 554-row production failure remains the unreleased issue. Historical texture cause, release hold, and phone exits stay open.

## Ops

Controller **85775**.

| step | pid | exit |
|---|---|---|
| focused-tests | 85778 | 0 (32/32: 29 pages + 3 Havok) |
| default-build flags 0 | 86081 | 0 |
| release-build flags 1 | 86249 | 0 |
| native-pages-headers | 86377 | 0 |

Source sha256 unchanged: verifier `b94967f0…`, tests `5d192326…`, `_headers` `fde1a89e…`.

New HTTP pins present: bundled WASM cannot inherit the legacy-root lifetime; mixed TTL/no-store still fail.

## Local Pages fixture

Wrangler **4.146.0**, `pages dev` on **7078**, inspector **0**, persist `attempt-2/pages-state`. Parsed **27** header rules. Detached group **86378** (node/esbuild/workerd). SIGTERM group; native exit code **143**; `remainingProcessGroup: []`.

| file | cache | MIME | bytes |
|---|---|---|---|
| `HavokPhysics.wasm` | `public, max-age=60, must-revalidate` | application/wasm | 2094563 |
| `assets/v2/HavokPhysics-BqNY-4N9.wasm` | `public, max-age=31536000, immutable` | application/wasm | 2094563 |

Same body hash `02691776…`. Fixture is two WASM files + copied built `_headers`, no game HTML. Local matcher only; not CDN, not `.br` runtime/timing.

## Independent source / transform

`expectedCache` assigns `legacy-wasm` only to exact `HavokPhysics.wasm`. Bundled `assets/v2/*.wasm` is `immutable-asset`. `/*.wasm` in source and built `_headers` is MIME-only. Vite added `Link:` preload lines on HTML entries; it did not put `max-age=60` back on the splat. Fixture `_headers` equals candidate-dist `_headers`. Mixed dual-TTL HTTP control still expects `cacheCorrect: false` with `cachePolicy: immutable-asset`.

## Production

Do not recheck. Attempt-1 still records live `play.sparkify.dev` serving the bundled WASM as
`public, max-age=31536000, immutable, public, max-age=60, must-revalidate`. That gate stays failed until a genuine release.

## Cleanup

Owned PIDs including workerd 86425/86426 terminal. Ports 5173/7074/7076/7078/10037 idle. Edge 2931 and Orca 98938 untouched. Attempt-1 receipts kept. Worker wrote only this cache tree.
