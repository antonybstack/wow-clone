# M003 — Native Babylon Lite crowd feasibility

Status: **completed as a bounded feasibility experiment, with production shadow and transition blockers**. Read the [M003 result](results/m003.md) before using these implementation instructions. Parent: [next ten](next-ten.md). Mandatory: [execution contract](execution-contract.md).

## Objective and scope

Answer whether existing compatible body/equipment assets can be rendered efficiently using native Lite baked animation and instancing, and expose the constraints that should govern customizable-body authoring. Deliver a developer-only experiment and measured decision. This is not the final crowd renderer, a network simulation, a new navigation system or proof that 1,000 fully detailed players can run at 144 FPS.

Keep all probe imports out of the default root route. Prefer a small separate developer HTML entry configured only in the existing development/full-build path. Inspect `vite.config.js`/actual config filename before editing: the Pages build must not acquire the probe or its payload. No dependencies or engine-version changes.

## Read first and reuse

Read the M001 census and M002 contract, `src/character/npc.js`, `src/character/body.js`, current equipment streaming ownership, current shaders/shadow registration, `scripts/harness/`, current frame metrics and recording helpers. Use the installed `@babylonjs/lite/index.d.ts` and corresponding `lib/` source for exact native APIs.

Verified planning-time native candidates in Lite 1.31.1:

- `prepareVat` / `prepareVatMany`: offline CPU preparation from actual mesh/animation groups.
- `createVatBakeResults`: GPU upload of prepared payloads; byte-identical sibling payloads can share texture storage.
- `attachVat`: installs baked skinning and drops the live skeleton; do not mutate the original playable actor.
- Returned handle `setInstances` / `setInstancesBlend`: per-instance playback/dual-clip parameters.
- Native thin-instance transforms/culling, native morph APIs and captured attachment bone matrices where supported.

Do not assume feature composition works just because each API exists. The VAT texture holds bone matrices, not a unique complete outfit mesh per frame. Validate bind/frame compatibility, resource ownership and simultaneous body/garment/material/shadow behavior before scaling. Per-instance independent morph weights are **unproven** and not required for this milestone; report the limitation for M004/M009.

## Gated implementation slices

Treat this milestone as three sequential, individually reviewable patches. The same implementer can complete them over multiple sessions; persist reports and resume at the unfinished gate.

- **M003a — one actor, then ten identical dressed instances.** Developer entry, correct animation/garments/prop, explicit resource ownership, direct shadow comparison, and ten teardown cycles. Do not run 100+ until this correctness gate passes. A reproduced native blocker closes this slice with the independent path retained.
- **M003b — repeated-outfit capacity curves.** Run 100/300/1,000 for independent and any correct native candidate. Retain failures and feasible limits. This requires no generalized mixed-outfit engine.
- **M003c — bounded varied-outfit proof and decision.** Use two existing compatible Human outfits, at ten actors first, to implement the explicit actor-to-item-batch map. If correct, run the mixed core cells and focused town/shadow/churn checks. If blocked, provide the smallest failing case, a measured independent mixed-outfit fallback, and the exact missing capability/cost. Multi-race batching is an extension after this gate; failure is recorded, not hidden behind Human substitution.

M003 is complete when these slices have either passed or produced their specified reproducible blocker/fallback evidence and a written next-ten decision. It does not require solving every native gap or delivering the final M009 renderer. M004 starts only after the recorded decision; no nude-color-pass shortcut counts as a dressed result.

## Hard compatibility and ownership rules

An instanced prototype has identical concrete mesh geometry, bind/frame, compatible material state and animation payload. Distinct pieces and differing fits create distinct batches. A project-owned map relates stable actor IDs to each batch's compact indices; native VAT indexes instances, not actor IDs. Exact arbitrary per-instance slender/stout morphs are outside M003. Only coherent uniform world scale may vary for this probe.

Never run `prepareVatMany` or `attachVat` against the actor/equipment created by the production `createStreamedEquipment` shared-palette path. Current garments borrow bone texture/matrix resources through copied skeleton metadata. Native preparation requires valid mixer/skeleton binding, and `attachVat` releases the live skeleton. Spreading or manually sharing skeleton objects can free another mesh's palette.

Use a separately loaded, disposable **probe-owned** source container. First prepare animation from its genuine animated body binding. For garments, choose and prove one bounded route: (a) an offline probe GLB assembled with glTF Transform, correctly remapping each validated garment's joint indices into the source skin while preserving its mesh bind frame, so the native mixer owns the real binding; or (b) a native-supported preparation/attachment route for independently loaded garment skeletons after proving that the prepared bone matrices are semantically identical. Reuse current preparation scripts' assembly patterns. No copied skeleton metadata, manual edits of Lite reference counters or assumptions that a bare object spread retains resources. Test that retiring the probe leaves an independent live control actor working. If neither route meets the native contract, document the blocker and use the independent dressed fallback.

Rigid props do not follow the existing live socket host after the skeleton is removed. Prefer one correctly rigid-weighted probe prop in the prepared skin, or sampled captured bone matrices with explicit conversion from skinning space to the authored socket frame. Budget any CPU prop updates separately. Test rotation, scale, clip transitions and stow against the live control; raw skinning matrices are not automatically world-space joint transforms.

Native color-pass support does not prove shadow support. Before crowd shadow-on or town-caster enrollment, compare the candidate's moving shadow silhouette to a live animated control in a reviewed capture. Inspect the actual Lite/material shadow path. If VAT shadows are unsupported or wrong, label this candidate tier shadowless, retain independent near casters, and record the missing capability; do not build a new shadow engine inside M003 or advertise shadow-off capacity as full-quality capacity.

## Proposed deliverables

- `character-crowd-probe.html` and `src/character/crowd-probe/` for a separately loaded diagnostic scene.
- `scripts/character-assets/prepare-crowd-probe.mjs` for deterministic offline payload preparation if needed.
- `scripts/ashen-reach/measure-character-crowd.mjs` for seeded sequential measurements, errors and cleanup.
- `scripts/test-crowd-probe-contract.mjs` for recipe grouping, budget limits and teardown ownership where pure testing is meaningful.
- `docs/baselines/character-mmo/m003/` containing conditions, raw intervals, rows, resource counts, asset hashes and review notes.
- `docs/plans/character-mmo/results/m003.md` with the selected path or concrete rejection/alternative.

Keep raw footage and intermediate generated art in ignored storage. Any served derived binary must be reproducible and explicitly excluded from Pages deployment; inspect the build/copy configuration rather than assuming a dev filename excludes it.

## Ordered implementation

1. **Start with one independent dressed Human.** Reuse its existing animation and compatible gear, material conventions and evaluated attachments. Verify visible body, outfit and weapon in idle/walk/cast, shadows and teardown. Do not clone the local player controller or run Havok for every synthetic remote actor. Positions and action intent are deterministic synthetic inputs.
2. **Add a seeded recipe population.** Use M002 current recipes; record seed, actual race/item distribution, transforms, clip/phase distribution and visible actor count. Keep actors inside the camera frustum for the worst-case diagnostic; include a second representative view with honest culling counts. No offscreen population may be reported as rendered throughput.
3. **Measure the independent baseline early.** Warm assets and shaders, then measure the same static and moving cohorts. Fix correctness problems before optimizing. A small flat scene identifies character costs; it does not establish actual-town capacity.
4. **Build a single native baked actor separately.** Preserve the original live actor and its skeleton resources. Prepare/upload baked animation using native APIs, drive independent phase, and verify selected animation frames against the live baseline from front/side/back. Retain skin vertex data and compatible materials. Confirm normals and deformation in shadows, not only the color pass.
5. **Dress the baked actor.** Follow the ownership recipe above before attaching any native VAT handle. Use actual skinned torso/legs/boots and a rigid prop. Compatible pieces must use the same animation clock/phase. Reuse a shared bone payload only where M001 proves identical bind/frame semantics; otherwise separate groups. Attach a prop through native supported captured matrices or rigidly weighted compatible geometry; if no safe path works, retain the live path and label the baked result incomplete. A static weapon at the bind pose is a failure.
6. **Instance the compatible cohort.** Group by concrete mesh/detail/material/fit/bind/animation-payload compatibility, not whole appearance recipe or race label alone. Each actor maintains a stable logical ID and independent transform/clip phase. Ensure all its pieces index the same logical actor even when each item's instance population differs. Do not assume array index N denotes the same actor in every item batch.
7. **Exercise variation honestly.** Test one repeated outfit, varied supported Human outfits, then supported multi-race fits. Use uniform height variation as a declared prototype only if applied coherently to body/gear/props; do not claim it proves slender/stout morphs. Independent unsupported bind groups may use the baseline renderer and must be counted separately. Do not collapse varied outfits to one invisible/base mesh to improve statistics.
8. **Add bounded churn and teardown.** Spawn/despawn batches, change selected equipment, move actors between compatible groups, cancel pending installs and dispose the scene. Keep resource ownership explicit; disposing one actor must not free shared geometry/animation/material resources. Batch growth needs a declared capacity and error/fallback at overflow. Large texture uploads cannot occur unbounded in one gameplay frame.
9. **Measure the matrix below.** Run isolated, no recording/profiler. Record GPU timing when available, CPU intervals and memory/resource counters without fabricating unsupported measurements. Stop an unsafe high-count run on device loss or prolonged unresponsiveness; retain the failure and condition rather than silently lowering the count.
10. **Confirm in the existing region.** Mount the same probe cohort through a lazy developer-only path into the town view for the most promising tier/count. Preserve seven normal enemies and current lighting; report their cost separately from synthetic crowd count. Repeat a no-crowd paired baseline. This confirms interaction with actual world/shadows; it is not production integration.
11. **Review motion separately.** Record phase variation, mixed equipment, visible shadows, weapon attachment, material differences, swaps and a teardown/rebuild. Capture at 1280×720 with timestamped manifest. Review and deliver the live MP4 per project rules; rendering statistics collected during it are not acceptance measurements.
12. **Decide and hand off.** State bottlenecks, viable compatible grouping keys, unsupported combinations, texture/geometry/animation memory, upload tails, crowd count versus quality curves, and minimum work required in M004/M009. If native batching fails, leave production unchanged and supply a minimal upstream repro plus a bounded alternative (e.g. independent actors with reduced detail/animation budget and a measured count limit). Commit/push the experiment and report; no deploy.

## Mandatory measurement matrix

Use M001's hardware/browser/resolution/isolation protocol; three 12-second settled runs per completed cell after a declared warm-up. Each cell logs actual population and render counts.

| Axis | Required cases |
| --- | --- |
| Path | Existing independent animation; native baked/instanced candidate where correct |
| Count | 1 correctness, then 100 / 300 / 1,000; failed counts retained |
| Appearance | Repeated dressed Human; seeded mixed Human outfits; multi-race fits where correct |
| Motion | Idle with varied phase; deterministic walking with clip transitions |
| Shadows | Explicit off diagnostic; actual shadow configuration on for best feasible cohorts |
| Environment | Simple probe for the full core matrix; actual town for chosen candidate count/tier and paired no-crowd baseline |
| Churn | 60-second deterministic session: staged spawn, 25% outfit changes, despawn/rebuild; report intervals separately |
| Disposal | At least ten load/dispose cycles; resource counts plateau after warm-up; no dangling callbacks, rejected promises or GPU errors |

Run the matrix by M003a/b/c gate; only cells whose correctness prerequisites passed are attempted. An unattempted blocked cell gets a reason and independent fallback evidence, not a fabricated timing.

Core matrix = both correct paths × three counts × repeated/mixed Human × two motion states, shadows off in the probe. Multi-race and shadow-on are focused extension cells at each feasible count after their correctness gates, not an excuse to omit the core varied-outfit cases. A path that cannot dress an actor correctly is marked failed/incomplete, not benchmarked as an equivalent visual workload.

Record mean FPS, p50/p95/p99/max interval, threshold exceedances, animation-evaluation time where instrumentable, draw calls if observable, visible versus culled instances, triangle counts, uploaded bytes, pending/prepared work, and estimated versus measured memory separately. Describe how each metric is obtained. Preserve raw intervals and all run errors. The selected candidate also runs the existing solo five-route regression when shared runtime code changes; diagnostic-only imports need a build/import exclusion check instead.

## Meaningful tests

Test deterministic recipe-to-batch grouping; two distinct binds cannot share a batch; stable ID mapping when item populations differ; per-piece phase agreement; capacity rejection; disposing a single actor retains shared resources; final owner releases once; cancelled scene build cannot attach late meshes. Test actual native integration in the browser—mock success cannot prove native disposal or shader correctness.

## Acceptance and decision gate

- [ ] Dressed independent baseline and at least one correctly dressed candidate are visually compared, or a precise native blocker is reproduced.
- [ ] Populations/visibility/appearance diversity and quality settings are explicit in every result.
- [ ] Correct attachment, body coverage, phase, normals and shadows are verified at the tested detail.
- [ ] Core feasible cells and failures are retained, with frame tails and spawn/swap tails separate.
- [ ] Teardown/churn has no new runtime/GPU errors or monotonically growing owned resources.
- [ ] Default startup/default assets and shipped gameplay remain unchanged; build excludes probe from Pages.
- [ ] Report chooses a feasible direction or documents a concrete alternative and revises next-ten assumptions.
- [ ] Reviewed live motion, complete process cleanup, commit/push and milestone status recorded.

There is deliberately no fabricated 1,000-actor FPS acceptance number. M003 ends with evidence to set M009/M010 targets. A negative result is useful only when reproducible and connected to a specific next design decision.

## Copyable handoff

Implement M003 only from `docs/plans/character-mmo/m003-crowd-feasibility.md` after M001/M002 results. Use native installed Lite 1.31.1 features and current compatible dressed assets. Keep the probe separately imported and outside Pages/default startup. Prove one correctly animated/dressed actor before 100/300/1,000, compare independent and instanced paths with actual mixed outfits, and measure isolated frame tails, churn and resource ownership. Report unsupported morph/bind/material combinations honestly; preserve failed high-count trials. Review and deliver live motion, stop owned processes, commit/push the completed experiment and decision report. Do not implement the final crowd renderer, networking, new art or deploy.
