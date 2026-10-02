# Next ten major milestones — production customization and a multiplayer hub

Reprioritized **2026-09-29**, release verification updated **2026-10-01**, game source **8ae4c2d**. Milestone **1 has a released, verified bounded customization subset**; the startup follow-up passes measured local/public p95 gates, while first-use GPU tails remain open. Milestone **2–3’s bounded region correctness/streaming integrations are complete; 4’s local client/authority slice is verified with public hosting pending; 5 has an unreleased source checkpoint and 6’s factory core is next; 7–10 remain planned**. The [public startup/GPU follow-up](results/startup-gpu-2026-09-30.md) adds shared early saved-character discovery and measures the resulting margin. First-use GPU outliers remain unattributed and explicitly deferred by the user on September 30; they do not block milestone 2. The [current-state review](../../reviews/current-state-priorities-2026-09-29.md) records what is released, active, candidate-only and unaccepted, plus verification and limitations. The [original M001–M010 sequence](../../archive/plans/character-mmo-next-ten-2026-09-27.md) is retained as history.

These numbers are the current execution order. Original M001–M100 IDs remain references to the [long-term horizon](vision-roadmap.md), not a second queue. Completed M001–M005 proof work is reused; M006 creator infrastructure and M007 representative fit evidence are retained. Missing age/hair art and untested shape settings are not marked complete by reorganizing the plan.

## Priority and intended outcome

First release the customization already proved, then establish crowd correctness and bounded asset ownership, then put two real players in the region. Complete modular Human identity, rehearse the wardrobe factory and add an Elf fit proof on that foundation. Finish with an actual crowded multiplayer hub, one cooperative region loop and a measured release.

Performance and load time remain the first constraint. Keep the approved Gothic region, existing Human/Orc/Undead sources, source-compatible animation and Havok movement. Use authored/generated source assets converted into editable templates, procedural fitting/assembly and cheaper crowd representations. No terrain streaming, additional regions, full combat redesign, arbitrary limb lengths or per-character cloth simulation is in these ten.

## Sequence

| # | Major milestone | Player-visible result | Depends on | Original horizon work |
| --- | --- | --- | --- | --- |
| 1 | Production body customization | Height/build can be edited, saved and played on the normal production URL. | Existing M004–M007 evidence | M006/M007 runtime, M032/M036, M051 |
| 2 | Correct crowd rendering in the region | Dressed actors animate, cast the intended shadows and retain identity through detail changes in Hollowmere. | 1; M003 failure cases | M009 correctness, M044/M045/M049 |
| 3 | Bounded appearance streaming and memory | Arriving players and outfit changes converge without stalled movement or steadily growing memory. | 1–2 | M037/M038, M052–M060 |
| 4 | Authoritative multiplayer presence | Two to eight real clients see one another move and change appearance in the current region. | 1–3 | M061–M068, first M070 gate |
| 5 | Modular Human identity | The tall/slender/young/long-haired and short/stout/older/bald examples both work as real saved characters. | 1, 3 and 4 | M006 art, M011–M016/M034/M035 |
| 6 | Wardrobe factory and five contrasting outfits | Cloth and articulated armor mix through a repeatable publishing pipeline. | Core: 1 and 3; hair/headwear integration: 5 | M021–M030, first M081/M082 slice |
| 7 | Race extensibility and Elf proof | One logical outfit resolves to correct Human/Orc/Undead/Elf fits, with honest race controls. | 4–6 | M008, M017–M019 |
| 8 | Scalable multiplayer hub | A varied busy town uses measured rendering and replication budgets, including reveal/arrival bursts. | 2–4 and 5–7 | M009/M010, M041–M050, M066/M069 |
| 9 | Cooperative region gameplay | Players travel and complete one existing-region encounter together, with consistent targets, actions and rewards. | 4 and 8 | Bounded M071–M080 |
| 10 | Device acceptance and content release rehearsal | A stable multiplayer slice is released with actual device limits and one independently published content update. | 1–9 | M089 rehearsal, M091–M098 |

Execute one bounded work package at a time. Do not launch ten writers or ten game renderers. A negative experiment can close a research package; a delivery milestone stays open until its player-visible exit passes. Replan on evidence at the end of 3 and 8, preserving IDs/results rather than forcing a failed assumption into production. If milestone 5 hits a source-art blocker, the milestone 6 factory core may proceed on accepted bodies; its hair/headwear integration still waits for 5, before hub acceptance.

## Shared acceptance

- **Solo desktop:** M1 Max, uncapped Chromium WebGPU, actual 1280×720 render buffer, device scale 1, seven enemies, three 12-second runs on each of meadow/town/bridge/cathedral/forest, without recording. Each route must exceed 144 mean FPS; investigate repeatable >5% regressions in mean frame time or p95/p99 against a fresh paired baseline. Report interval tails and samples over 6.94/8.33/16.67/33.33 ms. This is throughput, not a guarantee that every frame meets 144 Hz.
- **Default cold play:** p95 <=1,000 ms at 50 Mbit/s / 40 ms in 20 fresh browser processes against the compressed production build, using the existing dressed/grounded/GPU-completed/input-enabled definition and a movement check. Retain every outlier. The released milestone 1 build passes this local profile, but the follow-up public-URL cohorts pass p95 but retain a 1,248 ms saved-outfit first run and earlier multi-second GPU outliers; retain that first-use limitation as a deferred follow-up while continuing the authorized milestones. A quiet-machine requirement does not permit dropping bad rows.
- **Customized cold play:** separately measure supported saved Human characters, including endpoints and the largest supported outfit. Goal is the same one-second playable area, with the selected height/build silhouette present at the first playable frame. Material/mesh detail may arrive progressively under a documented policy. Loading the default character and silently replacing identity is not success. Other race paths have separately reported gates until compact starters are proved.
- **Crowd:** preserve the solo gates and publish separate capacity/quality tables. Milestone 2's 100 actors test correctness and lifecycle, with measured cost but no crowd FPS pass bar. The milestone 8 hub experiment targets 100 genuinely visible dressed actors above 120 mean FPS on the desktop profile, while seeking 144. Neither that count nor 300/1,000 is currently accepted. A missed count is a failed target with a measured lower ceiling, not a pass obtained by hiding actors.
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
7. Repeat at one and ten varied actors, then a 100-actor correctness smoke test. Swap outfits, remove a middle batch member, promote the same target repeatedly and tear down during a pending load. No slot/ID confusion, bind pose, black meshes, ghost casters or disposed shared resources. Measure its cost without applying milestone 8's crowd FPS target here.
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

Use server-assigned room-scoped actor IDs and authenticated expiring reconnect credentials from the selected library. An untrusted caller cannot claim another actor ID. Durable account-bound character records belong to milestone 9; a full account product is not required for this presence slice. Server owns the validated appearance revision and movement state. Clients send bounded inputs/requests, not arbitrary asset URLs or authoritative positions.

Preserve the current 0.90–1.15 height-scaled movement capsule and validate the same dimensions on the server; do not introduce a visual-only height policy implicitly. A different movement policy requires a separately accepted traversal change. Remote clients interpolate snapshots and use the milestone 2–3 actor path; they do not each instantiate a local Havok player controller. Reuse shared terrain/collision data or a reproducible server collision export; validate doors, bridges and slopes, not only a flat spawn area. Combat hit-volume fairness remains an explicit milestone 9 decision.

Test joins/leaves, out-of-order input, reconnect, stale appearance revisions and late assets at 40/100/200 ms latency with representative loss/jitter. Use deterministic network-only clients for service load; own every rendering client used for visual checks. Offline solo play remains available.

**Exit:** two to eight players can enter, traverse and see the same supported appearances and action timing; authoritative validation rejects impossible movement/appearance without corrupting state; reconnect does not duplicate actors. Record server tick tails, per-client bytes, correction distances and device frame cost. No combat/economy authority claim yet.

## 5 — Modular Human head, hair, adult age and palette

**Scope:** finish the two original example characters through a production source family. Preserve the supplied Human reference and neutral/starter option.

Author a complete scalp and a continuous neck boundary with matching skinning/tangents; preserve M004 correspondence where possible or explicitly rebuild/version the family and garment fit where not. Begin with a grey-material geometry/pose proof at neck and hood, then texture/palette. Pause further old-head atlas/normal sweeps until the geometry premise changes.

Provide bald and one long hairstyle as actual separate components, two readable adult-age appearances from the same accepted source family and bounded skin/hair palette channels. Hair has normal/tucked/hidden headwear behavior; age is not a skin tint. Keep eyes/brows and head/body materials coherent, long hair clear of cape/shoulders in the supported motion matrix, and near/far variants within budgets.

**Exit:** both original user examples can be created, saved, restored, equipped and shown to another milestone 4 client on production. Live front/side/back and gameplay review closes the neck, scalp, hood and age-readability gates. Assets are reproducible and optional detail payloads stay within startup/stream budgets. Two failed source approaches trigger a source/design re-evaluation rather than an indefinite parameter sweep.

The [October 1 source checkpoint](results/identity-source-2026-10-01.md) preserves compatible animation and proves a connected neck/scalp in sampled poses, with reviewed live motion. Hood opening and old-stout garment fit still fail; production identity controls remain disabled. Follow the permitted factory-core route below while those source-family fits remain open.

## 6 — Equipment authoring factory and five contrasting outfits

Status: [five real designs integrated and locally reviewed](results/five-design-catalogue-2026-10-01.md), with catalogue v4 migration, reproducible per-piece/full/compact publishing, mixed-boundary motion and four passing cold cohorts. Unreleased; equipped forest uncapped qualification, remote composition and M5 headwear remain open. The [DEV native remote checkpoint](results/remote-pieces-native-2026-10-01.md) passes functional ownership/retirement checks and delivers Telegram 838; isolated cost, publication and actual presence expansion remain pending. Continue [native per-piece remote integration](remote-piece-implementation.md), then the remaining [factory execution plan](wardrobe-factory-implementation.md).

Define the actual release slots/layers and semantic neck/waist/wrist/ankle interfaces. Turn the diagnostic rigid pauldron into a real item only with an actual slot/layer and compatibility policy. Produce **five distinct complete outfit designs in total**, counting current designs only where their declared required pieces really exist; include at least one soft cloth outfit and one articulated rigid armor outfit. Presets using the same pieces do not count as new sets.

The core factory uses accepted milestone 1 bodies and milestone 3 ownership; adult age and long hair are not prerequisites. Integrate the milestone 5 headwear/hair cases once that source family passes, before milestone 8. If art is blocked, report factory acceptance separately from the still-pending headwear extension.

Reuse the existing fitting field, rig/bind checks, semantic coverage and glTF tooling. Add artist corrective fits and silhouette-preserving detail generation where required; do not create a full-outfit binary for every combination. Publish per-piece immutable artifacts and compact manifests. Keep rigid plates rigid and weapon/shield grips coherent through the current source actions.

**Exit:** adding one item is a repeatable source → fit → validate → preview → publish operation with license/hash/version data, reversible asset release and measured authoring time/payload. All five designs mix at permitted boundaries, shapes and poses; one new cloth and one new rigid design go through reviewed live motion. The evidence sets the 30-set content budget and defect/corrective-fit cost.

## 7 — Race extensibility and an Elf fit proof

Consolidate current Orc/Undead under the one recipe/actor/publishing contract, retaining their approved sources and distinct binds. Neutral-only controls stay explicit until a real shape family is accepted; do not gate the milestone on inventing sliders for every race.

Create one licensed editable Elf body/head/hair source with an approved distinct silhouette and ears, one complete proof outfit plus one mixed boundary case. Test Human/Elf garment sharing through actual frame/topology/bind/fit evidence; otherwise generate family-specific fits. Use existing source-compatible animation or a verified offline retarget, not a new procedural gait. Race switching remains transactional and cancellation-safe.

**Exit:** supported shared logical item IDs resolve to validated race-specific assets; the current three races retain catalogue support and the Elf proof items gain explicit Elf fits. New items lacking a race fit remain unavailable for that race. A remote client sees the correct race/appearance, and no fallback silently dresses an Elf in an incompatible Human fit. Current races regress cleanly. Elf source absence remains an open delivery dependency, never a capability flag or a renamed Human.

## 8 — Scalable rendering and replication in the actual hub

Use the accepted diverse body/head/hair/cloth/plate/race library to establish exact nearby, standard and distant tiers. Select by projected size, visibility, target/party relevance and frame budget with hysteresis. Bound promotions, animation evaluation, shadow casters, nameplates and effects separately. Approximate distant shapes with tested buckets while retaining race and outfit identity.

Introduce server spatial interest/admission/update budgets using the chosen networking library's supported tools. Presence, replicated interest, visible actors, animated actors, exact-detail actors and shadowed actors are different counters. Test moving crowds around buildings and sudden reveal/arrival waves; offscreen actors required for shadows remain accounted for.

Measure 100/300/1,000 logical actors with actual varied outfits in diagnostic and real-region runs. Seek 100 genuinely visible actors above 120 mean FPS on desktop, with 144 as the improvement target; 300/1,000 are stress/capacity points, not promised counts. Evaluate physical-phone tiers independently. A lower measured limit must be reported as a missed experimental target and used explicitly for product admission/quality, never concealed by the camera.

**Exit:** a device-specific count/quality table has settled and arrival-tail evidence, bounded memory and server fan-out, correct targeting/identity through tier changes, and passing solo/startup gates. This is the architecture acceptance point before bulk 30-set production.

## 9 — One cooperative loop in the current region

Connect the existing traversal/objective/encounter foundation into one repeatable party activity across the current region. Two to eight players can meet, travel, target enemies, use the current attacks/spells, complete the objective and return with an idempotent reward.

Server validates cooldowns, resources, range, hits, enemy state and reward grants; clients render the current effects from accepted intent/events. Establish the cosmetic-height combat rule and test it across races/body extremes. Add only the party/inventory/character persistence needed for this loop, using established auth/storage services from the authority decision. Keep cosmetic recipe and gameplay item entitlement distinct.

**Exit:** functional multiplayer tests show consistent outcomes through loss/reconnect, no duplicate damage/rewards or client-asserted entitlement, and usable target/nameplate/party presentation at the supported crowd tier. Movement, current visual direction and solo performance remain intact. Broader classes, PvP balance, economy and crafting stay outside this milestone.

## 10 — Hardware, endurance and an independent content update

Run a browser/device matrix and at least two hours of current-region play, appearance churn, arrivals and reconnects. Physical iPhone 14 Pro Max needs actual startup, memory, touch, thermal and supported-population evidence; emulation cannot close that gate. Unsupported or unavailable devices remain explicitly pending, without a new support claim.

Rehearse a single new armor/content tier using the factory: record authoring effort, fitted variants, patch bytes, compatibility/version migration, publication and rollback. This is a recurring-content pipeline rehearsal; it does not assert that a full quarterly PvP season or 30 sets already exists.

Release the accepted multiplayer slice through verified client, server and asset compatibility gates. Drill rollback while preserving character/appearance/reward records. Run a bounded real-user trial and compare it with synthetic counts. Reconcile the 100-milestone horizon, actual content cost and supported capacities.

**Exit:** a measured multiplayer release with documented desktop/phone limits, stable endurance, successful content update/rollback and an evidence-based next ten. A whole MMO launch or guaranteed thousand-player hub is not implied.

## Reuse and deferred work

Prefer native Lite animation/VAT/thin instances, evaluated sockets, Havok movement, existing equipment/lifetime/scheduler boundaries, glTF Transform/Meshoptimizer, the Playwright ownership harness and current Pages/VE/Telegram tooling. Link applicable official docs in comments at non-obvious bind, animation, shader, ownership and networking boundaries.

The [version-pinned VAT specification](https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/docs/lite/architecture/15-vertex-animation-texture.md) is the crowd starting point. [@litools/instancer](https://github.com/eldinor/lite-instancer) and [Colyseus](https://docs.colyseus.io/netcode) were evaluated reuse candidates. Milestone 4 adopts pinned Colyseus 0.18; the instancer remains unadopted. Their current documentation can exceed the pinned runtime; validate the selected exact versions.

Defer bulk 30-set production until 6/8 establish the pipeline and budgets; full facial slider libraries, independent bone-length changes, cloth/hair simulation per actor, world expansion, terrain streaming, new rendering-feature experiments without a measured bottleneck, full PvP/economy systems and broad service/sharding infrastructure. The chosen finite region and current art direction remain the product setting.
