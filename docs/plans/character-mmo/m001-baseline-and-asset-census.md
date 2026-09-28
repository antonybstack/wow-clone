# M001 — Asset census and trustworthy baseline

Status: **planned, first implementation milestone**. Parent: [next ten](next-ten.md). Mandatory: [execution contract](execution-contract.md).

## Objective and completion boundary

Produce an accurate map of the current playable character/equipment assets and reproducible performance/visual evidence before changing them. This milestone adds an inspection/reporting tool and evidence; it does not implement sliders, a new race or a crowd renderer.

The source checkout is `/Users/antbly/dev/wow-clone`; use the actual checkout path in another environment. Resolve all commands from repository root. Do not assume HEAD equals the currently deployed source. Inspect actual routes: root `index.html`/`ashen-reach.html`, `ASHEN`, Vite 5173.

## Read first

- `docs/CURRENT.md`, `docs/debug-view.md`, `docs/character-system-north-star.md`.
- `src/ashen-reach/main.js`: body source URL, progressive startup branch, `packs`, race switching, background texture upgrade.
- `src/ashen-reach/equipment-contract.js`, `equipment-catalog.js`, `equipment-stream.js`, `equipment-loader.js`.
- `src/character/body.js`, `runtime/body-visual.js`, `adapters/lite-skin-layout.js`, `sockets.js`.
- `scripts/ashen-reach/prepare-starter-character.mjs`, `scripts/validate-character-body.mjs`, current race preparation/split scripts and their manifests.
- [Released performance evidence](../../complete/2026-09/one-second-startup-implementation-2026-09-27.md). Older MakeHuman profile documentation is not proof of the current Tripo-derived Human bind.

## Allowed changes and proposed outputs

- New inspection script: `scripts/character-assets/audit-active-character-assets.mjs`.
- Optional narrow benchmark ownership wrapper: `scripts/ashen-reach/run-character-baseline.mjs`, with explicit URL/port arguments and finally cleanup.
- Focused tests: `scripts/test-active-character-assets.mjs`, using small synthetic fixtures for malformed data and actual manifests for integration.
- Compact evidence: `docs/baselines/character-mmo/m001/{asset-census.json,conditions.json,region-fps.json,cold-50mbps.json,visual-review.md}`.
- Report: `docs/plans/character-mmo/results/m001.md`; update the status row and CURRENT when complete.
- Narrow measurement-script fixes only if required to record missing fields/close owned contexts; document them. No production art replacement, renderer refactor or dependency upgrade.

These paths are proposed deliverables, not files that already exist.

## Implementation steps

1. **Record state and ownership.** Save source commit, dirty paths, package versions and actual asset manifest hashes in conditions.json. Never serialize environment variables or secrets. Audit processes and open game pages before launching a browser. Establish one owned slot and log its ownership. Implement an explicit preflight/run/cleanup wrapper for the benchmark if the existing helpers cannot enforce this: require target URL and owned CDP port, inventory that browser's pages, blank only its owned landing page, assert exactly one measured game page, and re-inventory in finally. Record other-browser audit results; the wrapper cannot claim to discover every unrelated browser's tabs. Preserve unrelated AGENTS.md changes.
2. **Enumerate actual asset roots.** Follow the current main route's pack URLs; include progressive startup manifest, full Human, Orc and active Undead pack. Resolve `UNDEAD_PACK_DIR` from source. Do not indiscriminately audit every abandoned candidate. Enumerate every referenced item/body and procedural prop factory; mark procedural props separately from GLBs.
3. **Reuse asset tooling.** Use installed `@gltf-transform/core`, extensions and Meshopt decoder following current prep scripts. Decode gzip startup entries from their declared manifest metadata before parsing. Do not implement another GLB binary parser. Read metadata/arrays without rewriting inputs.
4. **Record file and semantic identity separately.** For each asset output URL/path, file bytes/hash, decoded bytes/hash where applicable, mesh/primitive counts, triangle and vertex counts, material/texture dimensions, joint names/order, parent hierarchy, rest transforms, inverse binds, mesh transforms, weighted influence count/range, animation names/durations and morph target count/names. Hash binary semantic arrays deterministically; no JSON conversion of huge geometry arrays into the report.
5. **Check relationships.** Compare each garment against its declared family's actual body. Verify joint-index remapping, bind/frame compatibility, normalized finite weights, required coverage names and explicit fit versions. Compare startup/full Human geometry/bind/animation while permitting their intentionally different textures/compression. Emit separate compatibility keys for joint order/hierarchy, inverse-bind matrices, mesh frame, fit family/shape version, and concrete coverage regions. A candidate sharing group must agree on all required deformation fields; material/geometry batching constraints are an additional M003 check. Record declared coverage, resolved alias and actual hidden meshes separately: an Undead hood intentionally has no HumanHair mesh to hide, which is a no-op rather than proof of equivalent Human coverage. Distinguish unsupported, missing, incompatible and valid results. Tolerances for floating data must be explicit and justified against existing validators; never compare only names, clip counts or whole-file hashes.
6. **Trace authorship and ownership.** Link each active asset to an existing source/preparation script, license/provenance record and editable source if present. Record missing source files as missing; do not download replacements or infer licenses. Describe which runtime resources are borrowed/shared and who disposes them. Identify old diagnostic profile data separately. Publish a source-readiness table for editable Human template, shape/age sources, long-hair source and Elf source; each row is available with exact path/license, requires authoring, or unavailable. Missing hair/Elf sources do not block the current-asset baseline, but gate later visual milestones.
7. **Test the inspector.** Cases: known valid rig; reordered joints with corresponding/inconsistent remaps; mesh-frame mismatch; non-finite/non-normalized weights; missing file; gzip manifest payload; identical bind with different animation file hash. It must exit nonzero for structural failures and preserve valid report rows before failure. Missing optional source artwork is a warning, not a fake runtime compatibility error.
8. **Run existing verification.** Execute the command block below. Record exit codes; investigate any inherited failures without broad repairs. Use `ASHEN_PAGES=1 npm run build` for the measured playable bundle (without invoking the deploy script); `npm run build` remains the full-route regression check. Build before browser measurements. Keep baseline artifacts immutable once recorded; corrections create a new run with a reason.
9. **Measure settled gameplay.** Use the execution contract's five routes × three 12-second runs. The current probe creates a new context; blank/close the owned harness's landing game first. Explicitly set `ASHEN_TEST_URL` and `ASHEN_CDP_PORT`; do not accidentally measure its default 7074 URL against a different build. The existing `measure-region-fps.mjs` currently deletes raw `row.frames` after summarizing: add an opt-in raw-interval output (default behavior unchanged), or write a narrow wrapper that preserves those intervals before summarization. Include a focused test that summary percentiles match the saved intervals. Record actual render dimensions and readiness/enemy count. If there are active unidentified renderers, mark contaminated and defer the claim.
10. **Measure cold play separately.** Stop the uncapped harness browser before the fresh-process probe. The current helper explicitly uses headless Chrome; record headless/headed mode as a condition. Match the actual historical command/artifact when making comparisons; do not infer headed mode from prose or switch modes silently. Start the compressed built preview, record its PID, and run twenty 50/40 trials. Track the sequential probe's owned processes; verify all exit. Retain maximum/outlier and failed runs. Stop the preview server when finished.
11. **Review motion separately.** Capture Human, Orc and Undead with current supported outfits, idle/walk/run/jump/casts and two-handed carry; front/side/back and regular play framing. Use existing recorders and actual supported races. Write a defect table with timestamp, race/outfit/action and inherited/new classification. Deliver a reviewed live MP4 per project procedure; no retouched/offline rendering substitutes.
12. **Close the report.** List usable source/bind families, unresolved fit/coverage problems, missing authoring dependencies, candidate crowd reuse constraints and the exact M002 inputs. Close owned browser processes and servers; commit/push the tool, tests and compact evidence, preserving unrelated work. Do not deploy.

## Commands and environment

Run sequentially; independently invoked scripts may create their own game tabs. Review their cleanup before use.

```bash
npm run test:character
npm run test:equipment
node --test scripts/test-active-character-assets.mjs
node scripts/character-assets/audit-active-character-assets.mjs --out docs/baselines/character-mmo/m001/asset-census.json
npm run build
ASHEN_PAGES=1 npm run build
```

The audit script and test are new interfaces to implement. Existing built-preview helper:

```bash
ASHEN_PREVIEW_PORT=7074 node scripts/ashen-reach/serve-startup-preview.mjs dist
```

Run it in a tracked terminal/process; choose another available port when 7074 belongs to someone else and update the URLs. After an owned uncapped harness is established and its initial game page is blank:

```bash
ASHEN_TEST_URL=http://127.0.0.1:7074/ ASHEN_CDP_PORT=<owned-port> node scripts/ashen-reach/measure-region-fps.mjs docs/baselines/character-mmo/m001/region-fps.json
```

`<owned-port>` is a placeholder: substitute the actual audited port; do not copy it literally. After shutting down that owned browser, the cold probe launches its own sequential fresh processes:

```bash
ASHEN_TEST_URL=http://127.0.0.1:7074/ ASHEN_PROBE_PROFILE=50mbps ASHEN_PROBE_RUNS=20 node scripts/ashen-reach/probe-playable-startup.mjs docs/baselines/character-mmo/m001/cold-50mbps.json
```

## Acceptance checklist

- [ ] All active body/garment/startup assets and procedural props are represented; files are untouched.
- [ ] Fit identity and ownership claims are backed by parsed data/current code.
- [ ] The inspector's negative tests fail for meaningful incompatibilities.
- [ ] Current gameplay tests/build have recorded outcomes; inherited failures are explicit.
- [ ] Measurements are isolated, reproducible and retain tails/outliers; previous release numbers are not relabelled as fresh results.
- [ ] Live character motion is reviewed and delivered; existing clipping limitations are visible in the report.
- [ ] M002 inputs and M003 candidate compatibility groups are identified.
- [ ] Owned processes are stopped, task changes committed/pushed, and status links updated.

## Copyable handoff

Implement M001 only in `docs/plans/character-mmo/m001-baseline-and-asset-census.md`, following its execution contract. Inspect live checkout changes and current source first. Produce the audit tool, meaningful tests, fresh isolated performance evidence and reviewed motion; do not change production art or start M002. Preserve unrelated files, close owned renderers, commit and push the completed milestone. If source data or hardware is unavailable, finish independent audit work and report the precise incomplete acceptance item without inventing results.
