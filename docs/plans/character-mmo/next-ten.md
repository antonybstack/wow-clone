# Character customization and armor — current milestone queue

Reprioritized **2026-10-02**; updated **2026-10-04**, released source **4063f49**. The queue now runs on one axis: **what a
player can change about their character, and how reliably armor pieces swap on the body.**
Multiplayer is parked at what it has already proved, not cancelled — see *Parked* below.

Milestones **1–4 are delivered** and are kept here with their evidence rather than deleted.
What follows them was reordered on 2026-10-02: the former hub-capacity, cooperative-loop and
further-multiplayer milestones leave the critical path, and **armor swapping becomes a
milestone in its own right** rather than an implicit property of the wardrobe work.

Renumbering changes no evidence and closes no gate. Missing head, hair, age and dye art is not
complete because the plan moved; the capability flags in
`src/character/creator/contract.js` stay false until the art passes, and flipping them is not
an exit. The [original M001–M010 sequence](../../archive/plans/character-mmo-next-ten-2026-09-27.md)
and the [long-term horizon](vision-roadmap.md) remain references, not a second queue.

## Priority and intended outcome

A player should be able to build a character they recognise, dress it from the catalogue,
change any piece at any time, and have all of that persist and reload exactly. Everything in
5–10 serves that sentence.

Two things gate it today, and both are measured rather than suspected:

* **Identity has a connected source audition; its first face art was rejected.**
  The user found the October 4 head disproportionate and jarring. The
  [face correction](results/m5-face-refactor-2026-10-04.md) is now implemented and
  delivered as a DEV audition; saved production identity remains the next task.
  The October 1 welded CC0 heads
  supersede the separate-head 44° normal break and fused-hair collapse experiments.
  The [October 4 checkpoint](results/m5-connected-identity-2026-10-04.md) reuses that source,
  adds eye morphs and current torso/eye/hair coverage, corrects the hood opening and
  removes discarded curve/rig dependencies. The named examples are playable DEV
  auditions. Saved identity, compact first-play budgets and release acceptance remain open.
* **Armor swapping works but is under-evidenced.** The catalogue now enumerates **6,912**
  combinations, 6,048 valid, with zero validator disagreements — the "768" carried in this plan
  dated from an 8-item catalogue and is corrected. Per-slot hot swapping under motion
  ([result](results/m6-swap-under-motion-2026-10-02.md)), failure and storm handling
  ([result](results/m6-swap-failure-2026-10-02.md)) and the coverage contract against the live
  engine ([result](results/m6-coverage-matrix-live-2026-10-02.md)) are now measured and pass.
  What remains unevidenced is the *look* of the mixed matrix and extreme-shape fit, which is
  measured for the **Human only**.

Performance and load time remain the first constraint. Keep the approved Gothic region, the
existing Human/Orc/Undead sources, source-compatible animation and Havok movement. No terrain
streaming, additional regions, combat redesign, arbitrary limb lengths or per-character cloth
simulation is in this queue.

Two inherited open items travel with this queue whatever its order, and neither blocks 5 or 6:
the [first-use GPU startup tail](results/startup-gpu-2026-09-30.md), explicitly deferred by the
user on 2026-09-30, and the released/candidate/unaccepted boundary catalogued in the
[current-state review](../../reviews/current-state-priorities-2026-09-29.md).

## Sequence

| # | Milestone | Player-visible result | Depends on | State |
| --- | --- | --- | --- | --- |
| 1 | Production body customization | Height/build edited, saved and played on the production URL. | — | **Delivered** |
| 2 | Correct crowd rendering in the region | Dressed actors animate and keep identity through detail changes. | 1 | **Delivered** |
| 3 | Bounded appearance streaming and memory | Outfit changes converge without stalls or growth. | 1–2 | **Delivered** |
| 4 | Authoritative multiplayer presence | Two to eight clients see one another move and change appearance. | 1–3 | **Delivered locally; public hosting parked** |
| 5 | Modular Human identity: head, hair, adult age | The young/long-haired and older/bald examples are real saved characters. | 1 | Connected source audition; saved identity/startup gates open |
| 6 | **Armor swapping as a verified capability** | Any piece in any slot can be changed at any moment, on any supported body, without a visual or fit defect. | 1, 3 | Open — evidence |
| 7 | Colour and material variation | A player can recolour pieces within an authored, published palette. | 6 | Delivered: bounded equipment colours; phone acceptance stays in 10 |
| 8 | Equipment authoring factory | New pieces reach the catalogue through a repeatable publishing pipeline. | 6; hair/headwear needs 5 | Partly built |
| 9 | Race fits and an Elf proof | One logical outfit resolves to correct Human/Orc/Undead/Elf fits. | 5, 6, 8 | Open — licensed source |
| 10 | Device acceptance and content release | The customization slice releases with real device limits and one published content update. | 1–9 | Open |

Execute one bounded package at a time. A negative experiment can close a research package; a
delivery milestone stays open until its player-visible exit passes. Replan on evidence at the
end of 6.

## Parked

Milestones that left the critical path on 2026-10-02. Their results stand and nothing is
reverted; they are simply not what the next packages work on.

* **Public multiplayer hosting.** Local two-client and eight-seat behaviour is proved
  ([result](results/native-presence-2026-10-01.md)); the account rejected Cloudflare
  Containers without Workers Paid, so there is no verified public endpoint.
* **Scalable hub capacity** (former milestone 8) and the **cooperative region loop** (former
  milestone 9).
* **Latency, jitter and socket-outage matrix.** Needs Toxiproxy, absent on this machine;
  transport has only been exercised on loopback.
* `Sword_Attack` **has no composed pose**, so remote actors fall back to locomotion and the
  renderer counts it as `uncomposedMotions`. That returns with the hub work.

## Shared acceptance

- **Solo desktop:** M1 Max, uncapped Chromium WebGPU, actual 1280×720 render buffer, device scale 1, seven enemies, three 12-second runs on each of meadow/town/bridge/cathedral/forest, without recording. Each route must exceed 144 mean FPS; investigate repeatable >5% regressions in mean frame time or p95/p99 against a fresh paired baseline. Report interval tails and samples over 6.94/8.33/16.67/33.33 ms. This is throughput, not a guarantee that every frame meets 144 Hz.
- **Default cold play:** p95 <=1,000 ms at 50 Mbit/s / 40 ms in 20 fresh browser processes against the compressed production build, using the existing dressed/grounded/GPU-completed/input-enabled definition and a movement check. Retain every outlier. The released milestone 1 build passes this local profile, but the follow-up public-URL cohorts pass p95 but retain a 1,248 ms saved-outfit first run and earlier multi-second GPU outliers; retain that first-use limitation as a deferred follow-up while continuing the authorized milestones. A quiet-machine requirement does not permit dropping bad rows.
- **Customized cold play:** separately measure supported saved Human characters, including endpoints and the largest supported outfit. Goal is the same one-second playable area, with the selected height/build silhouette present at the first playable frame. Material/mesh detail may arrive progressively under a documented policy. Loading the default character and silently replacing identity is not success. Other race paths have separately reported gates until compact starters are proved.
- **Crowd:** preserve the solo gates and publish separate capacity/quality tables. Milestone 2's 100 actors test correctness and lifecycle, with measured cost but no crowd FPS pass bar. The hub-capacity experiment that targeted 100 genuinely visible dressed actors above 120 mean FPS is **parked** with the multiplayer work; no count of 100, 300 or 1,000 is accepted. If it returns, a missed count is a failed target with a measured lower ceiling, not a pass obtained by hiding actors. The eight-seat native proof that does exist sustains ~170 mean FPS with zero frames above 16.67 ms, and that is a cost report, not a capacity claim.
- **Resource tails:** report startup, settled, streaming and promotion frames separately; no unexplained repeatable >33.33 ms stall caused by a normal single appearance change. Fix the cause or explicitly lower the supported workload. Unknown GPU memory/timing stays unavailable, never zero.
- **Visual and device:** review live motion, preserve fit/coverage/grips and ordinary traversal, test touch and WebKit where affected, and deliver reviewed MP4/GIF through the existing Telegram/VE procedure. Physical iPhone results are separate from emulation and required before a new phone support claim.
- **Ownership and release:** follow the [execution contract](execution-contract.md), [browser ownership](../../debug-view.md#browser-ownership-and-performance-isolation) and [deployment/rollback procedure](../../DEPLOY.md). Track every renderer. Multiplayer functional checks may own several explicitly tracked clients; FPS checks use one rendering client plus non-rendering protocol load generators. Commit/push each accepted package. Production releases require exact bundle/assets, loading/movement and rollback verification.

## 1 — Production body customization

Status: bounded customization released and production functionally verified; prescribed local gates pass, but reliable public one-second startup remains open. [Result, evidence and next performance work](results/production-customization-2026-09-30.md).

**Why first:** several milestones proved body and garment work that players cannot use on the ordinary deployed route. Shipping this subset produces value and establishes the one appearance identity needed by every later milestone.

**Entry points:** main.js; runtime/human-shape.js; appearance/contract.js and codec.js; creator/contract.js and store.js; equipment-stream.js and equipment-loader.js; the M004/M005 builders; scripts/ashen-reach/prepare-human-equipment.mjs, prepare-orc-equipment.mjs, apply-orc-wrist-coverage.mjs and prepare-undead-equipment.mjs; prepare-starter-character.mjs; Vite candidate middleware. Preserve the exact neutral body, bind, 57 source clips and current garment repairs.

**Publication invariants:** retain the [Human skirt inner-trouser repair](results/m007-human-waist.md), which keeps embedded trousers only where every triangle vertex is below local Y=0.8 m; generate its morph targets from the repaired topology. Preserve the Orc Graveweaver glove's skinned cuff and the [active Orc wrist coverage partition](results/m007-orc-wrist-coverage.md). The full Orc source rebuild currently differs from the reviewed active body, so it is a new candidate requiring proof, not a drop-in regeneration. Preserve the [Undead garments' actual body rest pose and inverse binds](results/m007-undead-rebind.md), joint remap and manifest bind hash. Validate these contracts after publication and starter mirroring; never overwrite repaired artifacts with an older source pack.

**Startup policy:** an unsaved neutral Human continues to boot the compact starter. Opening BODY stages the editable morph family on demand and promotes it transactionally; the normal URL needs no developer flag. Do not fetch the full family before play merely to expose the controls. A saved shape boots an accepted compact representation carrying its selected height/build silhouette, then upgrades detail if needed. Compare compact morph data against other compatible representations in package 8; a full morph starter is allowed only if it passes the same measured gates. A neutral body followed by a silent shape replacement is not an accepted fallback. Both default and supported saved starts retain the one-second target; a failing saved-start gate keeps that release milestone open.

Work packages:

1. Record a source/asset dependency manifest for the accepted body/garment candidates, including source hashes, tooling versions, provenance and licenses. Reproduce them in a temporary checkout/export with no pre-existing .cache; write new result artifacts separately and preserve historical baselines. Missing inputs must be supplied or identified before publication.
2. Freeze the production build domain. The recommended first control is one signed build value, slender → neutral → stout, driving the existing two targets with only one nonzero axis. Validate weight 1.0 in live motion before offering it; retain the verified 0.95 bound if 1.0 fails. Uniform height stays 0.90–1.15. Simultaneous-axis blends remain unavailable until their separate fit matrix passes.
3. Review the actual production endpoints at both height extremes: full and mixed Wayfarer/Graveweaver, no gloves/headwear, idle/walk/run/turn/jump/land/spells and one/two-handed weapons. Include all newly permitted values rather than assuming the offline sample proves them. Resolve visible defects or constrain the declared range. Record exceptions as data.
4. Extend the existing appearance recipe with explicit schema/catalog migrations for the accepted Human shape and height. Keep Orc/Undead neutral-only. Store body, race and equipment as one committed appearance; editor undo/draft state can remain separate. Reuse existing equipment validation/coverage instead of another loader.
5. Migrate valid ashen.creator.v1 records and old appearance v1 fixtures. Preserve invalid or unsupported legacy records for recovery and show a clear explanation; do not silently subtract two old build axes to invent a supposedly equivalent shape. Test unknown versions, range changes, corrupted storage and blocked storage.
6. Publish immutable/versioned body and garment artifacts with compatible manifest/fit identities and a normal production URL. Check the publication invariants above, including the startup mirror. Keep authoring diagnostics outside the production graph. The normal Armory should stage the editable family on demand and offer verified controls without a query flag or developer instructions.
7. Support transactional body/outfit promotion using existing lifecycle and staging code: preserve transform, evaluated pose/action time, camera baseline, sockets, capsule height and committed appearance on failure/cancellation. Changing a slider repeatedly must not accumulate camera scaling or mutate another actor's shared resources.
8. Prepare and compare compact-start strategies for saved shapes under the startup policy above. Reuse Meshoptimizer/glTF Transform and existing startup provenance. Select on measured bytes, decode/upload work and visual equivalence at the first playable frame. Preserve matching fallback clothing and body coverage. Avoid baking the Cartesian product of body × entire outfits.
9. Run contract/equipment tests and clean-source Pages build, then isolated five-route FPS and default/saved-startup gates. Review live motion, commit/push and deploy through the established gate. Verify saved/restored appearance on the released URL.

**Exit:** a fresh checkout can reproduce the release; default and two distinct accepted Human shapes can play, dress, save/reload and use the Armory on production; the full exposed domain is reviewed; one recipe represents the actual character; all relevant performance/release gates pass. Age/hair/dyes remain honestly unavailable.

**Bounded implementer handoff:** Implement milestone 1 only, in the numbered packages above. Read CURRENT, this plan, the execution contract and M004–M007 results. Begin with domain/source reproduction and recipe migration; do not publish the old-head, plate or crowd experiments. Preserve unrelated edits. Produce a result report with exact recipe/fit versions, reproducibility, live-domain matrix, startup/FPS and release evidence. A failed asset or latency gate leaves this milestone open; do not solve it by advertising unsupported controls.

## 2 — Correct crowd rendering in the region

Status: bounded developer integration complete. [Result, failed experiments, raw measurements and live motion](results/region-actors-2026-10-01.md). Production presence and crowd capacity remain later exits.

**Active from 2026-09-30:** milestone 1 is released. The user deferred investigation of the first-use GPU startup stall to [a recorded follow-up](results/startup-gpu-2026-09-30.md#deferred-follow-up--2026-09-30); it is not an additional prerequisite for starting this milestone. Retain ordinary startup and solo regression gates.

The [native composition/lifecycle checkpoint](results/crowd-region-2026-09-30.md) now fixes and verifies the first actual-town actors live under unchanged shadows, with reviewed motion and isolated performance. The later result closes exact/VAT transitions, action clocks, animated bounds and varied churn. Milestone 2 is complete; see the [released result](results/region-actors-2026-10-01.md) for exact/VAT transitions, clocks, bounds and lifecycle evidence.

**Why now:** the chosen native path fails on one actor in the actual scene. Increasing population or authoring hundreds of pieces before this is resolved would compound an unproved assumption.

**Entry points:** crowd-probe/batches.js and town.js; sun-shadows.js; scene-lifetime.js; native Lite VAT/thin-instance declarations and version-pinned source; prepared M003 inputs; exact actors from milestone 1. Keep Lite 1.31.1/Havok 1.3.14 pinned unless a separately evidenced engine fix requires a reviewed migration.

Work packages:

1. Reproduce one dressed VAT actor under the unchanged real-town shadow path. Keep an independent actor as the pose/appearance control; record the exact shader composer failure.
2. Compare the custom caster with native Lite shadow composition. Find the smallest correct integration. An explicit lower shadow tier is permissible for distant actors, but a blanket exclusion cannot stand in for proving near-actor shadow correctness. Preserve required offscreen shadow casters and terrain shadows.
3. Evaluate pinned @litools/instancer with the same single-actor case for stable IDs and multi-part playback. Confirm peer/runtime compatibility, disposal, dependency size and no duplicate Lite registry. Adopt only the pieces that reduce proven work; otherwise retain M003's small planner and native API. This library is not a shader-failure fix by itself.
4. Keep exact and baked actors in distinct owned render resources. Native attachVat drops the live skeleton; do not repeatedly attach/detach on the local player's container. Establish a shared logical actor ID, appearance revision, position and clip clock across representations.
5. Prove promotion/demotion at matched pose/action phase, including Idle/Walk and a non-looping action. Retain weapon placement, body coverage, shape silhouette, scale and direction. Use tested shape buckets for baked actors; local/inspected actors stay exact. No per-instance arbitrary-morph claim.
6. Establish conservative animated bounds for body, clothing and attachments; test frustum edge, building occlusion and reveal. Keep shadow visibility separate from color-pass visibility.
7. Repeat at one and ten varied actors, then a 100-actor correctness smoke test. Swap outfits, remove a middle batch member, promote the same target repeatedly and tear down during a pending load. No slot/ID confusion, bind pose, black meshes, ghost casters or disposed shared resources. Measure its cost without applying the parked hub milestone's crowd FPS target here.
8. Measure a fresh actual-town baseline/candidate and the solo routes separately from capture. Record draw submissions, prepared/upload bytes, CPU work and GPU data where available. Deliver reviewed live motion.

**Exit:** the actual region has correct declared shadows, dress/phase/bounds and transitions, with reversible lifecycle and passing solo gates. The result selects an integration and initial resource budgets; it does not declare a supported 300/1,000-player limit. If native VAT remains blocked, close a bounded investigation with a demonstrated alternative, revise this plan and finish the delivery through that alternative.

**Bounded implementer handoff:** Implement milestone 2 only after milestone 1 is accepted. Start at one actor and the recorded M003 failures. Use native Lite APIs and a measured instancer comparison. Fix actual-region correctness before scaling, preserve custom-world lighting and startup provenance, and report every approximation. The local player must never lose its live skeleton. Finish with a one/ten/100 actor motion/lifecycle report and isolated solo regression evidence.

## 3 — Bounded appearance streaming and memory

Status: complete as the bounded two-fit streaming slice; [released result](results/region-streaming-2026-10-01.md). It follows the [completed milestone 2 result](results/region-actors-2026-10-01.md). Native direct-count performance and exact/VAT render correctness are proved; full-detail 100-actor cost is 64–66 FPS and remains an unaccepted future hub workload.

**Why before networking:** a real arriving player should use the same tested transaction, cache and scheduling path as a synthetic actor; network arrival must not introduce a second asset lifecycle.

**Entry points:** equipment-stream.js/loader.js; scene-lifetime.js; frame-scheduler.js/frame-budget.js; background-loading.js; startup-assets.js; milestone 2 actor ownership. Extend these boundaries only where needed rather than rewriting main.js wholesale.

Work packages:

1. Inventory shared versus actor-owned resources: downloaded buffers, decoded meshes, morph/cached-shape data, textures/materials, baked animation, skeletons, attachments, instance buffers and scene registration. Record actual size counters and final-owner rules.
2. Key immutable resources by concrete asset/hash/fit/material-layout compatibility. Key actor state separately by actor ID and appearance revision. Deduplicate in-flight compatible loads and preserve cancellation for each consumer.
3. Establish explicit per-device limits from milestone 2 measurements for resident cache, active decodes, pending uploads and exact promotions. Use the existing frame scheduler for bounded CPU work; choose worker preparation only where profiling finds expensive transferable work. Do not assume moving work off-thread removes upload stalls.
4. Prioritize local appearance, current target/party, nearby visible actors and then distant refinements. Keep movement and input ready while details converge. A lower-detail fallback must belong to the same accepted race/build/equipment silhouette and advertise its pending detail.
5. Commit a complete validated appearance atomically. Keep the last coherent character on download/decode/upload failure or a superseded request. Request A completing after B must never overwrite B. Stage resource disposal only after no live consumer needs it.
6. Define eviction under a hard cache ceiling, with in-use resources protected. Test shared resources after one of two owners leaves, then after the final owner leaves; repeated disposal is idempotent. Report process/GPU measurement limitations alongside explicit resource counters.
7. Run arrival waves, rapid outfit/shape swaps, failure injection and repeated town entry/exit for at least ten complete cycles plus a 30-minute churn session. Track per-frame work, convergence time, bytes, owner counts and memory plateau. Include a slow 10 Mbit/s / 80 ms profile and loss/failure, not just warm cache.
8. Verify ordinary startup and solo gates, plus the separate streaming-tail gate. Settle and record without video before measuring; record reviewed burst/promotion motion afterwards. Commit/push the result and release accepted normal-path behavior through the same production gate.

**Exit:** bounded queues/cache and stable ownership exist on real actor arrivals; cancellation/failure preserves identity; repeated churn reaches a measured plateau; normal play remains responsive. Budget values and fallback policy are committed data, not unspecified tuning left to the next implementer.

**Bounded implementer handoff:** Implement milestone 3 only on accepted milestone 1–2 code. Extend the existing loader/lifetime/scheduler, with no network backend or new asset framework. First establish resource ownership and limits, then arrival/swap/churn evidence. Finish with the cache/queue policy, exact test workloads, memory counters/tails, live motion and production verification. Unknown metrics must remain unknown.

## 4 — Authoritative multiplayer presence

Status: local implementation and functional verification pass; public deployment remains pending the Cloudflare Workers Paid account gate. [Implementation, reviewed motion and remaining gates](results/multiplayer-presence-2026-10-01.md).

**Scope:** one current-region room, initially two real clients and a functional ceiling of eight. This is a new bounded online slice, not a thousand-player service commitment.

First close a library-selection and two-real-client package using a mature server/game networking library; Colyseus is the first candidate to assess, with at most one alternative if it fails the requirements. Record the selected version, host/operating cost, update/patch rates, prediction/reconciliation support, collision strategy and reasons. Reuse supported reconnect/state tools rather than building a generic networking framework. Then complete terrain collision parity, the eight-client checks and the latency/failure matrix below. Rejecting a library should not require finishing the eight-client workload.

Use server-assigned room-scoped actor IDs and authenticated expiring reconnect credentials from the selected library. An untrusted caller cannot claim another actor ID. Durable account-bound character records belong to the parked cooperative-loop milestone; a full account product is not required for this presence slice. Server owns the validated appearance revision and movement state. Clients send bounded inputs/requests, not arbitrary asset URLs or authoritative positions.

Preserve the current 0.90–1.15 height-scaled movement capsule and validate the same dimensions on the server; do not introduce a visual-only height policy implicitly. A different movement policy requires a separately accepted traversal change. Remote clients interpolate snapshots and use the milestone 2–3 actor path; they do not each instantiate a local Havok player controller. Reuse shared terrain/collision data or a reproducible server collision export; validate doors, bridges and slopes, not only a flat spawn area. Combat hit-volume fairness remains an explicit decision for the parked cooperative-loop milestone.

Test joins/leaves, out-of-order input, reconnect, stale appearance revisions and late assets at 40/100/200 ms latency with representative loss/jitter. Use deterministic network-only clients for service load; own every rendering client used for visual checks. Offline solo play remains available.

**Exit:** two to eight players can enter, traverse and see the same supported appearances and action timing; authoritative validation rejects impossible movement/appearance without corrupting state; reconnect does not duplicate actors. Record server tick tails, per-client bytes, correction distances and device frame cost. No combat/economy authority claim yet.

## 5 — Modular Human identity: head, hair and adult age

**Dependency:** milestone 1. The [connected identity checkpoint](results/m5-connected-identity-2026-10-04.md)
replaces the former separate-head/neck work. Preserve its source, exact 57 curves and
65-joint bind. A DEV audition does not satisfy saved production identity.

Tasks, in order:

1. **Connected head/scalp and current-fit source proof — corrected DEV audition
   delivered.** The [face refactor result](results/m5-face-refactor-2026-10-04.md)
   supersedes the rejected proportions; it does not claim user taste approval or
   saved/production identity acceptance. Reuse the welded
   October 1 source; verify the current garment pack rather than the obsolete M005
   nine-item audition. October 4 adds matching eyeball morphs, semantic eye/hair/torso
   ownership, a per-head brow opening and cleaned animation dependencies. Retained
   clothing geometry/shape/skin below 1.46 m is measured; live still and motion review
   have their own evidence. The shape domain remains Human height 0.90–1.15 and build
   −0.95..+0.95. Do not restart colour sweeps on the rejected neck cut.
2. **Define and publish the bounded identity recipe.** Keep the released starter as an
   explicit choice. Represent supported head and hair identifiers in the appearance
   registry with a new catalogue version and explicit migration from v5. Initially offer
   only authored, reviewed combinations; do not imply continuous ageing or arbitrary
   independent combinations. State whether prime/weathered are head presets or the
   same person's age transformation. Preserve equipment and colour authority through
   head/hair changes, undo, failed loads and reload.
3. **Selected identity before first play.** Publish immutable per-component/per-piece
   descriptors and shared bind provenance. Reuse the current staged body/equipment
   transaction, promise cache and compact/full upgrade. Default starter requests must
   have no new identity dependencies. Measure twenty cold selected starts against the
   production build at 50 Mbit/s / 40 ms; retain every overrun. The connected source body
   is larger than the released shape body and is not yet a one-second acceptance claim.
4. **Finish long-hair policy and motion fit.** The separate CC0 ponytail has ordered shape
   targets and hides/restores through hood coverage. Set an authored tie and bounded
   colour policy, review shoulders and cape clearance across the full outfit/motion
   matrix, and keep hair simulation outside this scope. Skin/hair colour controls remain
   unavailable until their own channels have actual accepted art.
5. **Production acceptance and capability flags.** Extend save/reload/first-frame,
   cancellation, disposal, desktop mobile and WebKit checks to the published identity
   combinations. Measure isolated settled throughput, review live motion, then release
   through the normal production gates. Only advertise age/hair capabilities that these
   combinations actually support. Physical-phone acceptance remains milestone 10.

**Exit:** both named examples — tall/slender/young/long-haired and short/stout/older/bald —
save, reload and enter gameplay with the saved identity visible at the first playable frame,
reviewed in live motion. Flipping a flag without art is an explicit failure, not an exit.

## 6 — Armor swapping as a verified capability

**Dependency:** milestones 1 and 3. The mechanism exists and is fast; the evidence is thin.
This milestone makes "change any piece at any time" a claim with measurements behind it.

What is already true: eight slots; **6,912** catalogue combinations enumerated and 6,048 valid
with zero occupancy disagreements, and 2,592 live garment combinations agreeing with the
coverage resolver; the Orc wrist, Human mixed waist and Undead bind defects are found and
repaired; hem over-reach is bounded. Two different swap paths are now timed and must not be
conflated — the **remote per-piece renderer** that dresses presence actors costs 66.8–78.4 ms
median against 120–182 ms for a restage, while the **player's own streamed equipment** costs a
median of **18.8 ms** across all eight slots. Neither figure is a cold-network cost.

Tasks:

1. ~~**Per-slot hot swap under motion.**~~ **Closed 2026-10-02**
   ([result](results/m6-swap-under-motion-2026-10-02.md), Telegram **841**). 168 rows — 8 slots
   × 7 motions × 3 races — pass with no pose reset, no dropped weapon and no frame over
   16.67 ms, worst 14.9 ms. The pose-reset detector is demonstrated against a control rather
   than assumed: it fires on 6 of 6 injected clip restarts and stays clean on 9 of 9 untouched
   windows, and the matrix's worst drift is one frame against the 140–890 ms a restart produces.
2. ~~**Swap storms and failure.**~~ **Closed 2026-10-02**
   ([result](results/m6-swap-failure-2026-10-02.md)). 116 rows pass: corrupt bytes and HTTP 500
   per slot per race, a recovery refetch after each, a six-round storm that fires every item in
   a slot at once, and unknown items. The worn appearance is byte-identical across every
   refusal. Two rows are untestable and recorded as such — the Undead boots wearing the only
   helmet in the catalogue. Held and slow responses remain per-design rather than per-slot.
3. **Visual review across the matrix.** **Design-by-race half closed 2026-10-02**
   ([result](results/m6-design-matrix-2026-10-02.md), Telegram **842**): 45 stills, 5 designs ×
   3 races × front/side/back, one pinned camera and a frozen pose; every declared piece renders,
   no GPU or console errors. Three judgement items recorded — the Duskguard cuirass reads as
   quilted padding rather than plate on all three races, the lilac staff head and grimoire are
   flat and unlit, and the Human Graveweaver hood bulges at the crown over the fused scalp hair.
   **Still open:** the mixed combinations, which are the overwhelming majority of the 6,048 valid loadouts. Method note carried
   forward: a single view at small scale is not enough to report a visual defect — two reads
   this milestone dissolved under another view.
4. ~~**Shape extremes beyond the Human.**~~ **Closed 2026-10-02**
   ([result](results/m6-shape-extremes-2026-10-02.md), Telegram **843**). 4,320 live
   combinations — 864 garment loadouts × 5 shapes — agree with the coverage resolver, zero
   disagreements. The supported domain is now stated rather than implied: Human
   0.90–1.15 × −0.95…+0.95, **Orc and Undead neutral only**, since neither has a verified shape
   family. One run reported 20 GPU errors on a shaped body and has not reproduced in three later
   runs; recorded as an unreproduced transient, not as fixed.
5. ~~**Layering and coverage conflicts.**~~ **Closed 2026-10-02**
   ([result](results/m6-coverage-matrix-live-2026-10-02.md)). 2,592 live combinations — 864
   garment loadouts × 3 races — agree with the resolver, zero disagreements, zero refusals. The
   first version of this check was vacuous: it read the static `RACE_BODY_SEGMENTS`, which omits
   the published `HumanTorsoCore` and `UndeadTorsoCore` geosets, so both sides of the comparison
   were empty on two of three races. An `ASHEN_CONTROL=1` inversion now fails all 2,592 rows
   while the real run passes all 2,592. What this does not prove is that the result *looks*
   right — a correctly hidden mesh can still leave a seam gap, which is task 3's remainder.
6. **A swap budget.** **Measured 2026-10-02** ([result](results/m6-swap-budget-2026-10-02.md)).
   Three tiers at 50 Mbit/s / 40 ms: **cold** 86.1 ms median / 122.6 worst, **rebuilt** 18.8 /
   48.6, **resident** 0.5 / 4.8. Frame cost is separate and is the one that matters: zero of 51
   cold swaps exceed 33.33 ms, but **11 of 51 exceed 16.67 ms**, so a first-time piece can drop
   a frame at 60 Hz where a rebuilt one never did (0 of 168). **Enforced 2026-10-03**
   ([result](results/m6-swap-budget-enforced-2026-10-03.md)): 200 ms cold latency, 33.33 ms
   worst frame, **60 ms warm swap**, **896 KiB** per piece. 51 live rows pass with zero
   breaches, and the byte gate runs offline in every test run. Setting them honestly moved two
   of the four: the 512 KiB byte ceiling sat below the published p95 — generalised from the
   pieces one measurement happened to fetch, never seeing the shape-family pack's 768 KB
   maximum — and is now *derived* from the latency ceiling; and the 10 ms resident ceiling was
   breached on its first run, so resident and rebuilt became one warm-swap ceiling after 240
   re-equips showed a p99 of 21.1 ms where 36 samples had shown a worst of 4.8.

**Exit:** every slot swaps correctly on every supported body and shape, during every motion in
the source set, with measured cost and reviewed live motion; failures preserve the committed
appearance.

**Route note:** this work runs on the default production path. The `?creator=1` DEV route
serves an older garment-fit candidate manifest carrying nine items, so shoulders, the Lector
coat and the four Duskguard pieces are unreachable there and `equip('shoulders', …)` answers
`No human fit`. The published packs all carry fifteen entries.

## 7 — Colour and material variation

**Dependency:** preserve milestone 6's accepted fit, coverage and swap behaviour. Catalogue v5 now exposes six equipment dye slots on Human/Orc/Undead. The independent skin/hair colour, age and hairstyle capabilities remain unavailable. [Saved-colours acceptance](results/m7-saved-colours-2026-10-04.md) supersedes the runtime-only state below; those dated findings remain evidence of what was tested.

Tasks:

The runtime persistence, creator controls and missing-garment fence were completed and released on 2026-10-04 as source `4063f49` / Pages `b3fdafd8-c343-4147-ae2e-760a155c8d06` (Telegram 849). The final result records the 25-row default-path check, native remote lifecycle, neutral geometry/coverage and 213–247 FPS with the largest dyed outfit at 1280×720. Public root startup p95 is 954 ms default / 1,037 ms largest dyed; the latter misses the one-second target and remains a follow-up. Physical-phone acceptance and the narrow Armory preview remain milestone 10.

1. **Mechanism chosen 2026-10-03** ([result](results/m7-dye-mechanism-2026-10-03.md)): drive
   the authored `baseColorFactor` from the recipe where the piece's material is built in the
   loader. The channel already exists in the art — Graveweaver `0.78,0.86,0.83` and Lector
   `0.37,0.48,0.64` are the *same* 256² texture tinted differently. Two alternatives are ruled
   out by measurement against a static control: mutating the factor on a live material does
   nothing, and replacing the material at runtime loses the ORM/normal/emissive maps and the
   ashen plugins without applying the factor. **The constraint that shapes the palette:** the
   factor multiplies the source texture and cannot exceed its untinted colour; a pale entry can lighten an originally dark factor. **The cost:** a dye
   change is a piece rebuild — 18.8 ms median, 48.6 worst — so the control must commit on
   release, not per frame. No asset regeneration, which keeps it clear of the sealed catalogue.
   **Built and proved the same day**: nine palette entries apply in the running game with no GPU
   errors, at **12 ms median / 19.7 worst**, against a static control of 0.04. Reviewed sheet: Telegram **845**.
   **Palette respent 2026-10-04** ([result](results/m7-dye-palette-2026-10-04.md), Telegram
   **848**): the v1 reading that entries should be spent "on saturation, not lightness" was
   drawn from each entry's distance from *undyed*, on a crop where the dye drives only 26% of
   the signal. In pairwise terms v1 was already saturated and had no spread — eight dyes 8–11
   units from undyed but **1.70–3.64 from each other**. `ashen-dye-v2` carries ten entries at a
   minimum pairwise separation of **3.80** against 1.70, a 2.24× improvement predicted at 2.19×
   before the run, for 7.5 ms median and zero GPU errors. **At that checkpoint:** the dye did not
   persist, since the recipe field rejected every key. Task 2 below now closes that defect. Two findings
   recorded against the mechanism rather than the palette: a dye change un-renders the piece for
   a median of 1 frame and up to 3 (~50 ms at 60 Hz) on 60% of changes, against an idle control
   of 0 gaps in 180 frames; and `sage`/`ash`, the designed minimum, is only just distinguishable
   at this scene's light level.
2. **Contract and publication completed 2026-10-04.** The v4→v5 migration retains the v4 registry, uses slot keys, excludes factory-built hands and normalises `undyed` away. Claude's `1412770` republish changes only metadata: all 45 asset hashes and 19.4 MB of piece bytes remain unchanged. The former re-encoding risk did not materialise. Runtime restoration now feeds dyes to every player stream and native remote revision before material registration; refused changes preserve the committed recipe and local storage.
3. **Creator controls completed 2026-10-04.** Equipment colours use the published race capability list, native selects, separate bounded undo and reset. Commit on `change`, with the old garment visible until its replacement's native material fence completes. Skin/hair colour capabilities stay false. Ordinary Armory colour edits are locked while local shared-region authority owns appearance; this control test does not establish public hosting.
4. ~~Prove a recoloured piece still passes the fit, coverage and swap gates from milestone 6.~~
   **Closed 2026-10-03** ([result](results/m7-dye-neutrality-2026-10-03.md)). 54 rows — 6 slots ×
   2 dyes × 3 races plus a plateau check per slot — pass with the visible mesh set, triangle
   count and coverage agreement all unchanged, and every plateau flat, so the rebuild path does
   not accumulate meshes. The colour shift is asserted too, since a neutrality check passes
   trivially when the dye silently fails; margins run 1.94× to 25.15× over a floor set by
   characterised capture noise. Two metrics were discarded first and the third chosen by
   measuring all three on the weakest case.

**Exit:** a player recolours pieces within an authored palette, the choice saves and reloads,
and no fit or coverage gate regresses.

## 8 — Equipment authoring factory

**Dependency:** milestone 6; hair and headwear integration waits for 5. The per-piece build and
publish path exists — `build-duskguard-armor.mjs`, `prepare-remote-pieces.mjs` and
`publish-remote-pieces.mjs`, the last refusing stale or mismatched input and republishing
byte-identically. What is missing is the authoring side: adding a *new* piece should be a
documented, repeatable operation rather than a bespoke script per design.

**Exit:** a new piece reaches the catalogue, the published set and the creator through the
documented pipeline, with provenance and licensing recorded, and passes milestone 6's gates
without hand-editing.

## 9 — Race fits and an Elf proof

**Dependency:** milestones 5, 6 and 8. Human, Orc and Undead fits exist for all 45 published
pieces. The Elf remains an explicit **licensed source dependency**: a missing Elf source is a
blocker, not permission to relabel the Human.

**Exit:** one logical outfit resolves to correct per-race assets with no silent Human
fallback, race controls stay honest, and Human/Orc/Undead regressions pass.

## 10 — Device acceptance and content release

**Dependency:** 1–9. Physical iPhone startup, memory and thermal behaviour remain unmeasured
and cannot be inferred from emulation. Release follows the existing production verification and
rollback procedure.

**Exit:** the customization slice releases with measured device limits and one independently
published content update.

## Reuse and deferred work

Prefer native Lite animation/VAT/thin instances, evaluated sockets, Havok movement, existing equipment/lifetime/scheduler boundaries, glTF Transform/Meshoptimizer, the Playwright ownership harness and current Pages/VE/Telegram tooling. Link applicable official docs in comments at non-obvious bind, animation, shader, ownership and networking boundaries.

The [version-pinned VAT specification](https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/docs/lite/architecture/15-vertex-animation-texture.md) is the crowd starting point. [@litools/instancer](https://github.com/eldinor/lite-instancer) and [Colyseus](https://docs.colyseus.io/netcode) were evaluated reuse candidates. Milestone 4 adopted pinned Colyseus 0.18 and that code stays in the tree while multiplayer is parked; the instancer remains unadopted. Their current documentation can exceed the pinned runtime; validate the selected exact versions.

Defer bulk 30-set production until milestones 6 and 8 establish the swap budget and the authoring pipeline; full facial slider libraries, independent bone-length changes, cloth/hair simulation per actor, world expansion, terrain streaming, new rendering-feature experiments without a measured bottleneck, full PvP/economy systems and broad service/sharding infrastructure. The chosen finite region and current art direction remain the product setting.
