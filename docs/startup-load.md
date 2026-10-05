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

## Historical notes

The [previous startup document](archive/state/startup-load-before-character-vision-2026-09-27.md) preserves older texture optimization and whole-world overlay assumptions. It is useful lineage, not the current readiness contract.
