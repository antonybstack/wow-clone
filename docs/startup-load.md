# Progressive startup — current lifecycle

Current candidate and release evidence: [saved Human creator](plans/character-mmo/results/m5-shared-human-release-2026-10-05.md).
Read [CURRENT](CURRENT.md) for the actual deployed source and open gates.

## Playable boundary

The normal fast-start route presents the selected supported Human silhouette and compact outfit with nearby terrain/collision first. Unsaved neutral play retains the existing compact starter. Havok, grounded state, the dressed player, a completed GPU frame, overlay removal and enabled input define playable readiness. Remaining finite-region geometry/details and character textures arrive in bounded background work behind a physical loading frontier. Full-region completion is a separate metric.

Primary code: `src/ashen-reach/main.js`, `starter-world.js`, `startup-assets.js`, `startup-fetch.js`, `startup-appearance.js`, `startup-preload.js`, `startup-trace.js`, and the equipment loader/stream. The main-route packs select actual Human/Orc/Undead manifests. Do not infer active source meshes from old profile labels.

## Reproducible assets and measurements

`scripts/ashen-reach/prepare-starter-character.mjs` derives compact assets from the current Human equipment body and selected starter clothes. It preserves geometry/bind/animation and prepares smaller initial textures with deferred full texture URLs. `prepare-starter-world.mjs` builds deterministic nearby/region payloads. Existing provenance/hash validation guards stale prepared assets.

The starting-world manifest describes two native HTTP-Brotli packets. Required
`geometry` contains starting terrain/collision, landmarks, nearby foliage and a
conservative tree preview (149,963 encoded bytes). Optional `geometry.skyline`
contains two exact non-colliding near tree blocks and 44 distant proxies
(593,607 bytes). Trunk collision remains required; the preview keeps obstacles
visible when optional loading fails. Its exact block dependencies retire it as
detail arrives, avoiding sustained overlap. Settled geometry stays exact.
Only the required packet is preloaded before play. `startSkyline()` begins after
the playable fence, yields mesh creation across frames, and updates the shadow
list once. Region completion retires the proxies through Lite's ref-counted
`removeFromScene`; retirement/disposal aborts their fetch and prevents late
installation. Optional failure can retry without duplicating already installed
meshes. The legacy combined packet remains readable.

HTML preloads the eight required textures. Surface construction consumes those
responses, while the sky's exact URL/options are started early through Lite's
per-device `loadTexture2D` promise cache. Do not fetch and discard texture bytes
to warm an HTTP cache: with cache-disabled navigation that consumes the preload
and triggers duplicate downloads. The actual material/sky loads still gate play.
See [native preload behavior](https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/rel/preload)
and [pinned Lite texture loading](https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/packages/babylon-lite/src/texture/texture-2d.ts).

The world-specific `verify-starter-geometry.mjs` checks immutable SHA/filename,
encoded/decoded lengths and complete aligned attribute ranges before publishing
the mutable manifest, and again at build. It lives outside shared character
compiler provenance to avoid regenerating unrelated characters. Full-region
render/collision, source motion, and the dressed/grounded/GPU-completed playable
contract remain unchanged; the first playable distant skyline arrives later.

Use `npm run prepare:startup` only when an intended source/preparation change requires rebuilding; it is not a routine prerequisite for a documentation or contract change. Read each script's current imports and source files before running it.

Use `probe-playable-startup.mjs` with the compressed production-build preview for cold timing, and `measure-region-fps.mjs` on an isolated uncapped browser for settled throughput. These are different experiments. Follow [browser ownership and capture](debug-view.md) and the [new milestone execution contract](plans/character-mmo/execution-contract.md).

The earlier 2026-09-27 50 Mbit/s / 40 ms production batch achieved p95 979.4 ms, 19/20 <=1 second, maximum 1,054.5 ms. Later release measurements are in the reports above; this historical batch is not a current-release timing claim. Physical iPhone startup/memory and crowded-city appearance convergence remain unmeasured. The new character initiative must keep creator/probe/full-wardrobe imports off the initial play path.

## Saved-character request discovery

An asynchronous HTML module starts the existing strict appearance-store migration and compact manifest/asset requests while the renderer graph downloads. Main shares their promises and still owns scene creation and the playable fence. Unsaved play imports neither optional appearance storage nor the Human family before play. Saved neutral/race/fallback records prefetch the same starter main uses. Native build checks enforce these graph boundaries, one shared loader instance and pinned provenance guards; stale deployment manifests fail visibly.

Run `node --test scripts/test-startup-prefetch.mjs` for sharing, migrations, retry and decoded-size cases. On an audited owned browser, `ASHEN_CDP_PORT=<port> ASHEN_TEST_URL=<exact build URL> node scripts/ashen-reach/check-startup-prefetch.mjs <report.json>` verifies requests complete while Lite is deliberately held and rejects stale manifests. This functional check is not a timing benchmark.

Optional `ASHEN_PROBE_GPU_EVENTS=1`, `ASHEN_PROBE_CHROME_TRACE=1` and `ASHEN_PROBE_DISABLE_SHADER_CACHE=1` diagnose startup. Normal acceptance cohorts leave all three unset. API call times and queue acknowledgements do not isolate shader compilation or GPU execution; even fresh profiles do not clear OS/Metal driver caches. Preserve first-use outliers.

When probing an older release with a custom saved Human identity, set
`ASHEN_PROBE_IDENTITY_CATALOGUE=<verified-release-catalogue.json>`. Obtain and
verify that release's catalogue before timing; the probe records its SHA-256 and
checks identity components. The local checkout's content-addressed body filename
may differ from production and must not turn a valid start into a false failure.
The default is the local published catalogue, appropriate for the matching build.
See the [corrected comparison and resource controls](plans/character-mmo/results/startup-resume-2026-10-06.md).
Startup failure diagnostics retain the exact asset URL, operation and native
cause, including a body read that fails after HTTP 200. A failed release entry
halts further cohorts; successful diagnostics do not erase the failed cohort.

Material texture preparation now names the actual failed sampler URL (`albedo`,
shared detail, paving or cloud); an older surface-wide wrapper could misattribute
a secondary-map failure to its primary albedo. Full-resolution enhancements name
their original source URL. The native Lite loader/cache and complete cause chain
are preserved. [Controlled attribution result](plans/character-mmo/results/material-texture-attribution-2026-10-08.md).
On audited local builds, run
`ASHEN_TEST_URL=<candidate URL> ASHEN_MATERIAL_BASELINE_URL=<preserved old build URL> node scripts/ashen-reach/check-material-texture-errors.mjs <report.json>`
for seven sequential native failure/movement controls. The old-build URL is
optional; without it the six candidate controls run. This is functional evidence,
not cold-start/FPS qualification or an explanation of a historical failed read.

## Historical notes

The [previous startup document](archive/state/startup-load-before-character-vision-2026-09-27.md) preserves older texture optimization and whole-world overlay assumptions. It is useful lineage, not the current readiness contract.

## Havok delivery

Production builds emit a content-addressed `physics/HavokPhysics-<hash>.wasm.br`
from the pinned, unchanged `public/HavokPhysics.wasm`. Build-time Brotli quality 11
reduces the encoded binary to 501,493 bytes. Vite's shared delivery plugin selects
one URL for the HTML preload and the existing memoized Havok `locateFile` option.
The browser owns HTTP decoding and Emscripten owns streaming compilation; no
additional runtime loader or decompressor is introduced. Development keeps the
versioned public endpoint. The original WASM remains in the release for legacy
consumers and the existing deployment integrity guard.

The generated response requires `Content-Type: application/wasm`,
`Content-Encoding: br`, and immutable `Cache-Control` with `no-transform`.
[Streaming compilation](https://developer.mozilla.org/en-US/docs/WebAssembly/Reference/JavaScript_interface/instantiateStreaming_static)
requires the WASM MIME type; [Cloudflare compression](https://developers.cloudflare.com/speed/optimization/content/compression/)
must preserve the prepared representation. The full release verifier requests
browser compression formats and compares the decoded response with both the
prepared file and original WASM, including MIME, encoding and caching checks.

The local `wrangler pages dev` version used on 2026-10-05 double-encoded this
already-compressed WASM. Its failed startup reports are retained; they are not
valid timing evidence. The real Pages preview returned the exact decoded binary.
Use the existing compressed Node preview for local load measurements and validate
the actual Pages preview's response headers and native browser behavior before
production. Do not remove the MIME check or substitute a fallback physics engine
to make a broken response pass. See `scripts/test-havok-delivery.mjs` for the
build/URL/preview contract.

### Rejected world-only warmup experiment (2026-10-05)

Do not register/render the live starting scene before the actor is attached to hide
GPU startup behind the body transfer. A local experiment using native
`registerSceneWithShadowSupport` → `renderFrame` → `waitForGpuIdle` →
`unregisterScene` reduced initial timing, but a held-body/full-region check exposed
a bind-pose actor and thousands of invalid GPU sampler bindings after streaming.
The experiment was never deployed and was removed. Its five apparently valid cold
starts covered only the playable boundary and are **not** functional acceptance.

Priming native morph support avoided an earlier `morphedPos` compilation error, but
did not establish late actor/streaming correctness. Native unregister preserves
resources; it does not undo the first scene build. See [Lite's pinned scene lifecycle](https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/packages/babylon-lite/src/scene/scene-core.ts).
Keep the existing actor-before-first-register ordering. Inspect live motion through
full region readiness before running a large performance matrix on a startup experiment.
Evidence and the rejected source are retained under
`.cache/character-mmo/startup-headroom-2026-10-05/`; the tracked result records the
accepted release and the unfinished one-second largest-outfit target.

### Embedded identity catalogue

The production game HTML includes the build-verified Human identity runtime catalogue
as an inert `application/json` data block. Native module/resource hints precede it;
the early async module tag follows the completed block, so even cached modules
see it before executing. `preloadHumanIdentityCatalogue` reads it
through the existing shared promise, and the identity loader still checks compiled
provenance, schema, selected preset, shape and coverage before requesting any body.
HTML carries no user recipe or storage-derived URL. The build escapes `<` so a
future label cannot terminate the raw-text script block, and caps data at 96 KiB.
See [HTML data blocks](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/script/type).

Hosts without this block, including Vite development, retain the fixed catalogue
fetch. A malformed block rejects and clears the shared promise; a mismatched
provenance is refused by the existing loader. The ordinary saved-appearance
migration/validation and asset fetch/decompression caches remain authoritative.
This removes one saved-body request dependency at the cost of approximately 6.6 KB
of extra compressed HTML for every visitor; compare default and saved cohorts.
It does not change actor installation, first-frame fences or scene registration.

The embedded copy omits only `provenance.inputs`, the authoring source-file audit
list already checked by the build. The aggregate provenance SHA, schema and every
preset manifest/asset/coverage descriptor remain identical. The full audit list
remains at the standalone public manifest URL. This keeps compressed HTML below
12 KB on the measured build; default-page overhead remains in the acceptance data.
