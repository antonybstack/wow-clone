# Deploy

Ashen Reach is the playable game. It replaces the Fardel Babylon client on **play.sparkify.dev**.

## How Fardel shipped

Fardel’s browser client was a Vite `web/dist` upload to Cloudflare Pages project **`fardel`**, custom domain `play.sparkify.dev` (CNAME → `fardel.pages.dev`). Command:

```bash
npx wrangler@4 pages deploy dist --project-name=fardel --branch main
```

SpacetimeDB (`db` / `dev-db`) is unrelated to this static client. Visual evidence still uses R2 `fardel-ve` → `ve.sparkify.dev`.

## Ashen Reach

Same Pages project and hostname. The deploy script builds the playable routes;
`index.html` contains the game directly, without a redirect. It copies the textures,
bodies and equipment the game loads. Unused `public/models` tree bins (over the
25 MB Pages file limit) stay off the upload.

Always stage `public/404.html`. Pages otherwise serves root HTML for missing
paths, including missing scripts. During the 2026-10-06 rollback investigation,
some CSS/JS URLs returned cached HTML with status 200. Vite's stable `assets/v2`
namespace moves the repaired build off those polluted URLs; content hashes remain
Vite-owned. Do not add timestamp queries or a custom runtime loader.
[Pages routing and caching](https://developers.cloudflare.com/pages/configuration/serving-pages/)
and [Vite assetsDir](https://vite.dev/config/build-options.html#build-assetsdir)
describe the native mechanisms. This change does not purge old browser/CDN rows.

The staged root must include `HavokPhysics.wasm`. Without it, Cloudflare Pages can return the app HTML at that URL, leaving the game without a collision world and making spells report every target as blocked. The deploy script compares the built WebAssembly file with the source before publishing. An older deployment cached that HTML fallback for a year, so the client now requests a versioned WebAssembly URL and the legacy root WASM revalidates after 60 seconds. Keep this cache rule specific to `/HavokPhysics.wasm`: a `/*.wasm` cache rule also matches bundled `/assets/` WASM and combines contradictory lifetimes. The broad MIME rule remains valid. Production builds now use a content-addressed, build-time Brotli copy with native HTTP decoding; the versioned endpoint remains available for legacy/development consumers. Verify that the generated `/physics/HavokPhysics-<hash>.wasm.br` response decodes to the exact original binary, has `application/wasm` / `Content-Encoding: br`, and that the game reports `ASHEN.player.getDebugState().usingPhysics === true`. The asset verifier checks HTTP delivery; the native movement gate checks active Havok. See [Havok delivery](startup-load.md#havok-delivery) for the local Pages emulator limitation.

```bash
export CLOUDFLARE_API_TOKEN=…   # already in the Mac Studio shell
npm run deploy
```

Live:

- https://play.sparkify.dev
- https://play.sparkify.dev/ashen-reach.html?play&clean

`CLOUDFLARE_ACCOUNT_ID` defaults to `6ea5db25020bce6cbefd6c1cc999bef3`. Override `PAGES_PROJECT` / `PAGES_BRANCH` only if you are not targeting `fardel` / `main`.

## Build and verify before publishing

`ASHEN_BUILD_ONLY=1 npm run deploy` runs the same staged Pages build and Havok
comparison without publishing. Run the cold-load and performance gates against
that `dist`, using the compressed startup preview. Once they pass, seal it and
upload **those exact bytes** without a rebuild:

For the current accepted startup profile, preserve all four build flags:

```bash
ASHEN_BUILD_ONLY=1 ASHEN_SAVED_BOOTSTRAP=1 ASHEN_PRIME_STARTER_WORLD=1 \
  ASHEN_LAZY_WORLD_BUFFERS=1 ASHEN_DEFER_COVERED_HAIR=1 npm run deploy
```

Use the flags recorded with the candidate being verified. The current profile
coalesces the pure saved-character bootstrap, primes the starting world, defers
untouched world buffers and defers completely covered hair. Omitting the saved
bootstrap flag caused the October 8 local build to fail the early-entry import
guard; restoring the recorded profile passed without changing that guard.
Preparation, a successful build and local motion do not qualify production.
Changing flags requires a new build and its corresponding gates; an upload from
a seal uses the already verified bytes.

```bash
node scripts/character-assets/pages-seal.mjs seal --dist dist --out .cache/<release>/pages-seal.json --scope "<what was gated>"
# commit/push the product inputs (a seal taken before the commit is fine)
ASHEN_PAGES_SEAL=.cache/<release>/pages-seal.json npm run deploy
```

For a delivery change, first upload the same seal with `PAGES_BRANCH=<preview>`
and verify its deployment-specific URL. Run
`node scripts/character-assets/verify-pages-release.mjs dist <URL> <report.json>`
on both preview and the final custom domain. It checks actual unmodified URLs,
decoded bytes, executable MIME types, cache policies and two missing-path 404
controls. Each build row retains actual/expected decoded SHA-256; the missing-path
rows retain actual hashes. The mutable indices include Human shape, both starter
indices and presence when actually published; the current production build omits
server-only presence. Non-OK response caching is classified separately from a
successful immutable asset policy, while missing bytes/status still fail.
Each artifact and missing-path request retains fetch/body failures as failed rows;
other checks finish and the report is written before the gate fails. Native
request/body timeout is 30 seconds (`ASHEN_VERIFY_TIMEOUT_MS` overrides it with
a positive integer). Rows retain source SHA-256, the known decoded expected hash,
native failure stage/causes and available response metadata; failed bodies do not
receive a partial-byte hash. Missing required immutable/Havok cache headers fail
explicitly. Local directory-walk/output errors can still prevent report creation.
Declared policies also cover bundled assets, shape/identity textures, presence
collision, compressed world packets and legacy root WASM. Complete directive-set
checks reject conflicting lifetimes and missing headers. Root `/` and
extensionless `/ashen-reach` receive independent decoded-byte/MIME/cache checks
against their HTML files. World packets require native Brotli and binary MIME.
The summary reports successful policy coverage and unclassified files with no
declared custom rule; metadata collection alone is not cache qualification.
[Expanded gate and retained production conflict](plans/character-mmo/results/release-policy-coverage-2026-10-08.md).
A hash match fetched through a cache-busting query does not establish
the correctness of URLs used by players. Stop live/performance gates if integrity
fails; retain failed rows and diagnostic headers. Record the previous deployment
before promotion and judge rollback against its known delivery state.

Use `ASHEN_PROBE_RUNS=20 ASHEN_PROBE_MAX_MS=1000` for the startup release gate,
alongside the prescribed profile, disabled HTTP cache, seed and exact build URL.
It requires a complete valid cohort and zero starts above the inclusive limit,
retains every failed row and returns nonzero when the budget fails. Without
`ASHEN_PROBE_MAX_MS`, the tool is a measurement only; exit zero makes no timing
claim. Restart the compressed preview after each build and keep all timing
separate from builds, encoding, capture and other active game pages.

The seal records the SHA-256 of every `dist` file, including `_headers` and
`_redirects`, plus the source HEAD. It also records a fingerprint of the product
inputs: git blob IDs for `src`, `public`, `scripts`, the root HTML, the Vite
config and the package files, covering uncommitted and untracked files as well.
The seal file must live outside `dist` and is never overwritten.

Sealed upload skips staging and the build. It refuses in these cases:
- a changed, missing or extra file, a symlink, or an unsafe path
- a tampered seal
- a Havok binary that differs from `public/HavokPhysics.wasm`
- uncommitted product inputs (unrelated docs, `.cache` and `__pycache__` files are ignored)
- committed inputs whose fingerprint differs from the sealed one

A later documentation-only commit is accepted, and Pages attributes the upload
to that HEAD, which verifiably contains the same product bytes. Changed product
inputs need a new build, new gates and a new seal. Plain `npm run deploy` still
rebuilds and uploads unsealed; use it only when no gate evidence depends on the
bytes. Server-only `ashen-reach/presence-v1` collision is omitted from Pages;
the browser compares the compiled world release identifier.

## Mixed custom-domain delivery

Check the actual **canonical deployment** through the native Pages project API.
After rollback, `latest_deployment` can still describe the rejected newer upload;
deployment-list order alone is not proof of what production serves. Compare the
custom domain, the production `fardel.pages.dev` alias and both immutable URLs.
Keep response bytes, hashes, status, MIME/cache directives and request identifiers.
An API acknowledgement is not proof of working asset delivery or movement.

Cloudflare documents stale custom-domain caching and its native purge remedy in
[Serving Pages](https://developers.cloudflare.com/pages/configuration/serving-pages/#caching-and-performance).
First inspect actual routing/cache configuration. Do not add speculative cache
rules, weaken the DNS proxy or introduce query-based runtime cache busting. Use
[purge by exact URL](https://developers.cloudflare.com/cache/how-to/purge-cache/purge-by-single-file/)
for a bounded list of affected game paths when justified. Include final HTML
routes and mutable manifests, preserve path case, and record the exact list and
native acknowledgement. A game release does not require purging unrelated VE or
other zone content. Passing after a purge alone does not prove its causal effect;
native deployment convergence may occur during the same interval.

The native [Pages rollback operation](https://developers.cloudflare.com/pages/configuration/rollbacks/)
can also restore a newer successful production deployment after an earlier one
has been selected. Prefer that existing immutable candidate when it already
contains the qualified sealed bytes; an unchanged upload or rebuild adds no
qualification evidence. Verify its production environment, successful deploy
stage, source commit and exact seal before restoring it. Record the old canonical
deployment and refuse a rollback that would overwrite another operator's release.

Keep an intervention provisional until every served-byte/cache check and entry
alias passes, then run the predeclared startup and functional/performance gates
once. Retain every failed phase and sample; do not retry unchanged cohorts until
they pass. On a required gate failure, restore the recorded working deployment
and verify actual entry/movement after delivery converges. Preserve the first
failed rollback verification as well as a later passing check. A current-device
or performance claim requires its own corresponding evidence.

Shared-region controls are published as an optional lazy client surface. They
remain unavailable on the public URL unless `VITE_PRESENCE_URL` selects a
verified compatible HTTPS backend. The separate Colyseus/Cloudflare Containers
host and its account gate are documented in [the presence result](plans/character-mmo/results/multiplayer-presence-2026-10-01.md).
Static client deployment does not establish a public multiplayer release.

Early Hints generation must **insert Link into the existing route block**.
Repeated identical route blocks are not merged by Cloudflare's
[configuration builder](https://github.com/cloudflare/workers-sdk/blob/main/packages/workers-shared/utils/configuration/constructConfiguration.ts):
the last assignment replaces the previous rule for that path. The corrected
build retains HTML `public, max-age=60, must-revalidate` together with Link,
including the extensionless `/ashen-reach` route. The public verifier checks
both policies, plus `no-store` on missing-file 404 responses. Distinct matching
patterns still follow the documented header-combination behavior.
