# Progressive startup — current lifecycle

Current release evidence: [bounded production customization](plans/character-mmo/results/production-customization-2026-09-30.md) and [public startup/GPU follow-up](plans/character-mmo/results/startup-gpu-2026-09-30.md). Read [CURRENT](CURRENT.md) before assuming a source asset or ordering from an older report remains active.

## Playable boundary

The normal fast-start route presents the selected supported Human silhouette and compact outfit with nearby terrain/collision first. Unsaved neutral play retains the existing compact starter. Havok, grounded state, the dressed player, a completed GPU frame, overlay removal and enabled input define playable readiness. Remaining finite-region geometry/details and character textures arrive in bounded background work behind a physical loading frontier. Full-region completion is a separate metric.

Primary code: `src/ashen-reach/main.js`, `starter-world.js`, `startup-assets.js`, `startup-fetch.js`, `startup-appearance.js`, `startup-preload.js`, `startup-trace.js`, and the equipment loader/stream. The main-route packs select actual Human/Orc/Undead manifests. Do not infer active source meshes from old profile labels.

## Reproducible assets and measurements

`scripts/ashen-reach/prepare-starter-character.mjs` derives compact assets from the current Human equipment body and selected starter clothes. It preserves geometry/bind/animation and prepares smaller initial textures with deferred full texture URLs. `prepare-starter-world.mjs` builds deterministic nearby/region payloads. Existing provenance/hash validation guards stale prepared assets.

Use `npm run prepare:startup` only when an intended source/preparation change requires rebuilding; it is not a routine prerequisite for a documentation or contract change. Read each script's current imports and source files before running it.

Use `probe-playable-startup.mjs` with the compressed production-build preview for cold timing, and `measure-region-fps.mjs` on an isolated uncapped browser for settled throughput. These are different experiments. Follow [browser ownership and capture](debug-view.md) and the [new milestone execution contract](plans/character-mmo/execution-contract.md).

The earlier 2026-09-27 50 Mbit/s / 40 ms production batch achieved p95 979.4 ms, 19/20 <=1 second, maximum 1,054.5 ms. Later release measurements are in the reports above; this historical batch is not a current-release timing claim. Physical iPhone startup/memory and crowded-city appearance convergence remain unmeasured. The new character initiative must keep creator/probe/full-wardrobe imports off the initial play path.

## Saved-character request discovery

An asynchronous HTML module starts the existing strict appearance-store migration and compact manifest/asset requests while the renderer graph downloads. Main shares their promises and still owns scene creation and the playable fence. Unsaved play imports neither optional appearance storage nor the Human family before play. Saved neutral/race/fallback records prefetch the same starter main uses. Native build checks enforce these graph boundaries, one shared loader instance and pinned provenance guards; stale deployment manifests fail visibly.

Run `node --test scripts/test-startup-prefetch.mjs` for sharing, migrations, retry and decoded-size cases. On an audited owned browser, `ASHEN_CDP_PORT=<port> ASHEN_TEST_URL=<exact build URL> node scripts/ashen-reach/check-startup-prefetch.mjs <report.json>` verifies requests complete while Lite is deliberately held and rejects stale manifests. This functional check is not a timing benchmark.

Optional `ASHEN_PROBE_GPU_EVENTS=1`, `ASHEN_PROBE_CHROME_TRACE=1` and `ASHEN_PROBE_DISABLE_SHADER_CACHE=1` diagnose startup. Normal acceptance cohorts leave all three unset. API call times and queue acknowledgements do not isolate shader compilation or GPU execution; even fresh profiles do not clear OS/Metal driver caches. Preserve first-use outliers.

## Historical notes

The [previous startup document](archive/state/startup-load-before-character-vision-2026-09-27.md) preserves older texture optimization and whole-world overlay assumptions. It is useful lineage, not the current readiness contract.
