# Release policy coverage and WASM header correction — 2026-10-08

The expanded delivery gate finds one real production cache conflict and now
refuses it. The source correction passes native local Pages matching and is
ready for the pending batch. Production remains **7d00c56 / 5723a4ab**; no new
preview, seal, cold-start campaign or promotion ran.
[Receipt](../../../baselines/character-mmo/release-policy-coverage-2026-10-08/receipt.json),
[complete retained evidence](../../../baselines/character-mmo/release-policy-coverage-2026-10-08/evidence.json.gz),
[bounded Grok reviews](../../../baselines/character-mmo/release-policy-coverage-2026-10-08/grok-review.md).

## Defect and correction

The old release verifier accepts correct JavaScript bytes with a wrong cache
header: an actual HTTP counterexample makes the old CLI exit 0 and the new
regression test fail as expected. Its substring immutable checks also leave
several declared policy families unchecked or permit conflicting directives.

The checker now covers bundled assets, shape buffers/textures, presence data
when included, compressed world packets, legacy root WASM and all four game
entry URLs. Mutable indices retain `no-cache`. It compares complete configured
directive sets, allowing case/order/spacing/identical duplicates, and rejects
missing headers, fake immutable substrings, conflicting lifetimes and additional
private/no-store directives. The root and extensionless entries compare actual
HTML bytes and MIME. Prepared world packets require their native Brotli encoding
and declared binary MIME; matching encoded bytes without the decoding header
cannot pass. Existing timeout, failure/cause reports, hashes, executable MIME,
Havok bytes and both missing-path controls remain enforced.

One read-only production check uses the preserved 551-file/296,653,100-byte build
that matches every historical production seal hash. All **552 positive
artifact/entry responses** match their decoded expected
hashes; both 404 controls pass. The gate exits **1** for this response:

`assets/v2/HavokPhysics-BqNY-4N9.wasm`

Its cache header contains both `max-age=31536000, immutable` and
`max-age=60, must-revalidate`. Both `/assets/*` and `/*.wasm` match it. Pages
[combines matching header rules](https://developers.cloudflare.com/pages/configuration/headers/),
so this is a real configuration overlap. The initial checker classifies all
uncompressed WASM as legacy; the final checker correctly keeps the bundled file
in the immutable asset family. Either expected policy refuses the mixed header.

The source `_headers` now puts the short lifetime on `/HavokPhysics.wasm` only,
while preserving the broad WASM MIME rule. The bundled WASM receives the asset
lifetime. The active content-addressed compressed physics endpoint is unchanged.
No connection to the historical texture fetch/body failure is established.

## Final local verification

All **32 focused checks** pass: 29 actual HTTP/CLI release controls and three
Havok delivery checks. These include the exact mixed bundled-WASM header, missing
world encoding/MIME/no-transform, wrong alias/legacy MIME and native request/body
failures. Both default and four-flag Vite builds pass their existing strict guards.
All three source hashes remain stable during these gates.

The final built `_headers` is copied verbatim into an isolated two-WASM fixture.
Cached native **Wrangler 4.146.0 `pages dev`** parses 27 valid rules, using
Cloudflare's matcher. Both real responses
are HTTP 200, `application/wasm`, 2,094,563 bytes and the exact pinned binary hash:

| File | Actual cache policy |
| --- | --- |
| Legacy `HavokPhysics.wasm` | `public, max-age=60, must-revalidate` |
| Bundled `assets/v2/HavokPhysics-BqNY-4N9.wasm` | `public, max-age=31536000, immutable` |

The fixture has no game HTML or browser renderer. Its HTTP port is 7078;
inspector port is 0. Its owned node/esbuild/workerd process group is recorded,
terminated and verified empty; native shutdown is 143, checker exit 0. This
proves local rule matching, not production CDN behavior, `.br` emulator delivery,
runtime traversal or performance. Source comments retain documentation links.

## Remaining scope

The production failure is preserved and not rechecked unchanged. Release this
header correction with newly qualified bytes, then rerun actual preview/custom
domain delivery gates. The current production catalogue deliberately omits unused
presence files; its five mutable manifests pass, while six are exercised in the
HTTP fixtures. Files without a declared custom cache policy remain unclassified
(270 successful responses in this public check); the summary exposes that limit.
Local directory-walk/output errors can still prevent report creation.

The rejected boot preview, original 14/60 fetch failures, 362 ms input upper-bound
cause, loading/audio tails and current physical iPhone acceptance remain open.
No visual assets, capture, new FPS claim or production promotion belongs to this
metadata/QA correction. Edge/Orca and the discarded Shadowglass page are preserved.
