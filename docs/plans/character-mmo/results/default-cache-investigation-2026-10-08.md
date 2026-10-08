# Default cache observation — 2026-10-08

No runtime, deployment or zone configuration changes. This read-only check
closes the assumption that every asset without a custom Pages header should
receive a zero-second browser lifetime. It does not complete policy coverage or
explain the rejected preview's texture failure.

The retained production report from the preceding release-policy check contains
554 rows. Of its 270 successful responses without a declared custom cache
classification, 213 have `public, max-age=0, must-revalidate` and 57 have
`public, max-age=14400, must-revalidate`. Every one of those 270 decoded bodies
matches the sealed build. No new delivery sweep or game visit ran.

The 57 four-hour responses comprise 33 PNGs, seven JPEGs, six binary files, one
gzip file, nine WebPs and the standalone `meshopt_decoder.js`. The decoder is
25,486 decoded bytes, has executable JavaScript MIME, and matches SHA-256
`a706bbac4cfbea66798936a2c35d1036f594fec955514508e9c14ec329f020fd`.
These observations do not demonstrate stale decoder bytes or a reason to
replace Lite's existing decoder-loading path.

At 2026-10-08 12:49:57 UTC, native Cloudflare GET requests confirm the active
`sparkify.dev` zone's browser-cache TTL is **14,400 seconds** (HTTP 200).
Cache-rule and response-transform entrypoint reads return HTTP 403/code 10000;
active Page Rules reads return HTTP 403/code 9109. No credentials or request
headers are retained. The four-hour response observation is consistent with the
zone setting; unavailable rules prevent attribution of each response to that
setting alone.

[Cloudflare Pages defaults](https://developers.cloudflare.com/pages/configuration/serving-pages/#caching-and-performance)
describe zero-second browser revalidation.
[Cloudflare browser-cache TTL](https://developers.cloudflare.com/cache/how-to/edge-browser-cache-ttl/)
documents a four-hour default and circumstances where it overrides origin
lifetimes. Do not infer a complete effective policy from either default alone,
or turn the observed responses into an approved policy merely because they
currently match.

The verifier intentionally retains these 270 rows as unclassified. Establish a
declared contract or inspect effective rules before adding strict expectations.
The separately demonstrated bundled-WASM lifetime conflict and its local source
correction remain as recorded in the
[release-policy result](release-policy-coverage-2026-10-08.md).

The startup/body failure cause and current physical-device acceptance remain
open. Device inventory again contains only a simulated iPhone, with no connected
physical device. No unchanged startup/FPS campaign, speculative retry, decoder
migration or global cache-setting mutation follows from this observation.

Sanitized native responses and the exact prior-report digest/counts are retained
in [the receipt](../../../baselines/character-mmo/default-cache-investigation-2026-10-08/receipt.json).
