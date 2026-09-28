# Character customization and MMO vision — 100 milestone horizon

Status: **proposed roadmap; implementation has not begun**. Prepared 2026-09-27 from the user's customization, 30-set wardrobe, quarterly PvP tier and crowded-city goals. Historical releases are prerequisites, not milestones completed in this roadmap.

## Product direction

Ashen Reach should let players recognize themselves and others through race, body silhouette, age, hair, clothing, weapons and motion. A tall slender young adult Human with long hair and a short stout older bald adult Human must both work with the same wardrobe system. Support Human and Undead, preserve existing Orc, and make an Elf fit family possible without redesigning the catalogue. Launch content aims at 30 mixable armor sets, followed by repeatable quarterly tiers.

Use authored/generated source art normalized into editable production templates, procedural fitting/assembly, and tiered runtime representations. Generated source geometry is not automatically animation-ready or suitable for morph interpolation. Preserve the supplied art references and current Gothic region; the architecture is not a new art direction.

Hundreds or thousands of characters present in a hub does not promise identical detailed rendering for all. Exact nearby appearance, useful distant silhouettes, server interest management and measured device budgets are separate contracts. Population limits remain unknown until measured.

## Reading and execution

- [Next ten milestones](next-ten.md): dependencies, boundaries, outputs and exit gates.
- [Execution contract](execution-contract.md): applies to every implementing agent.
- Implementation briefs: [M001](m001-baseline-and-asset-census.md), [M002](m002-appearance-contract.md), [M003](m003-crowd-feasibility.md).
- [Architecture decisions and sources](architecture.md): technical rationale and unresolved choices.
- [Current shipped state](../../CURRENT.md): live product evidence.

The current task produces plans and documentation organization only. All M001–M100 are **planned**. Start M001 when implementing this initiative. Complete its evidence and commit before M002; then M003. IDs establish traceability, not equal effort or calendar promises. Categories after A are a dependency roadmap; tasks can later be scheduled when their dependencies are satisfied. They do not authorize a backend, combat or economy rewrite now. Replan after M003 and M010 before committing to asset volume or population claims.

## Success criteria and constraints

- Exact appearance recipes at close range; explicit bounded approximation at crowd detail.
- Compatible clothing and weapons through gameplay motion, with reviewed material/lighting appearance and no known visible penetration in the acceptance matrix.
- Shared animation, fit identity and resource ownership preserved; no blanket assumption that all humanoids share one bind.
- Retain the current starter-area latency gate on its documented network profile and current solo-region frame-rate acceptance. Define crowd quality tiers from measurements; physical iPhone results remain distinct from emulation.
- Content cost should scale with pieces × fit families × needed corrective fits, not the Cartesian product of complete outfits. Testing still covers interactions, including multi-item conflicts.
- Source licenses, generation/edit provenance, reproducible exports and versioned descriptors accompany every production asset.

## A — Prove customization and crowd feasibility

M001–M010; execute sequentially using the detailed briefs.

| ID | Milestone | Observable exit |
| --- | --- | --- |
| M001 | Asset census and baseline | Versioned asset/bind inventory and isolated current-game measurements establish what can be reused. |
| M002 | Appearance recipe and compatibility contract | A deterministic versioned descriptor round-trips current appearances without advertising unsupported sliders. |
| M003 | Native crowd feasibility prototype | Compare independent actors and compatible instanced baked animation at 100/300/1,000 actors; publish measured limits. |
| M004 | Canonical Human template | A licensed, editable Human template supports approved slender/stout endpoints and bounded uniform height. |
| M005 | Body and garment deformation proof | Two contrasting outfits follow the same shape controls through motion, with reliable coverage and rigid armor treatment. |
| M006 | Human creator vertical slice | The user's tall/slender/young/long-haired and short/stout/old/bald adults can be created, saved, restored and played. |
| M007 | Mixed equipment fit proof | Cross-set pieces obey semantic coverage and seam rules at body extremes, with visible motion review. |
| M008 | Race extensibility proof | Undead and an Elf prototype exercise explicit race fit adapters; current Orc remains working. |
| M009 | Crowd representation and streaming proof | A bounded prototype transitions exact actors to approximate crowds with prioritized asset loading and no unbounded cache. |
| M010 | Architecture acceptance and release gate | Integrate the slice, document device-specific population limits, and accept or revise the production architecture before bulk art. |

## B — Production character bodies and identity

Depends on M010. Art direction remains the approved project direction; new reference choices are recorded before authoring.

| ID | Milestone | Observable exit |
| --- | --- | --- |
| M011 | Production Human anatomy | Finalize template topology, silhouette and deformation quality across accepted body ranges. |
| M012 | Production Human face family | Reusable facial shapes cover intended identity range without broken eyes, teeth or expressions. |
| M013 | Adult aging system | Authored age shapes and material changes remain readable and consistent across lighting and detail levels. |
| M014 | Human hair collection | Produce an approved modular hairstyle library with head fit and scalp coverage tests. |
| M015 | Helmet and hair compatibility | Define full, tucked and concealed hair behavior for every supported helmet category. |
| M016 | Skin and facial material library | Version shared skin, eye, brow and beard resources with bounded texture memory. |
| M017 | Production Undead anatomy | Preserve approved skull/body direction while implementing explicit exposed-bone and garment fit capabilities. |
| M018 | Production Elf anatomy | Finalize Elf silhouette, ears, face and hair fits without assuming Human geometry is interchangeable. |
| M019 | Orc compatibility consolidation | Keep existing Orc art and equipment functional under the new descriptors and validators. |
| M020 | Character accessibility and presentation | Creator controls support keyboard/touch, readable labels, undo, presets and honest unavailable-option states. |

## C — Equipment authoring factory

Depends on M005/M007 and production body contracts M011–M019.

| ID | Milestone | Observable exit |
| --- | --- | --- |
| M021 | Semantic body region standard | Define race-independent coverage IDs mapped to each concrete body partition. |
| M022 | Garment boundary standard | Version neck, waist, wrist and ankle interfaces plus overlap envelopes. |
| M023 | Soft garment fitting workflow | Reproducibly transfer authored garment fits to supported body shapes with artist corrections retained. |
| M024 | Rigid armor fitting workflow | Preserve plate shape and articulation using piece-specific fit transforms and compatible skinning. |
| M025 | Garment shape library | Produce reusable deformation references with per-item overrides and measured interpolation error. |
| M026 | Layer compatibility validator | Reject conflicting layers and select cuffs/tucks without hand-coded whole-outfit combinations. |
| M027 | Weapon and shield attachment standard | Stable grip, hand occupancy, offhand, stow and silhouette contracts cover supported weapons. |
| M028 | Two-handed contact library | Authored poses plus bounded contact corrections preserve both hands through gameplay. |
| M029 | Equipment detail generation | Build silhouette-preserving mesh detail levels with matching coverage, skinning and attachment behavior. |
| M030 | Asset publication contract | Manifest versions, hashes, provenance and compatibility metadata make one new item independently publishable. |

## D — Creator and appearance runtime

Depends on A and relevant B/C outputs; keep creator code outside initial play imports.

| ID | Milestone | Observable exit |
| --- | --- | --- |
| M031 | Creator scene and lighting | An isolated inspection experience shows accurate in-world materials under multiple reviewed light setups. |
| M032 | Body parameter editing | Bounded sliders update body, garment and attachment state coherently with reset and undo. |
| M033 | Face parameter editing | Stable morph semantics and capability-driven controls avoid unsupported asset combinations. |
| M034 | Hair beard and eye selection | Reusable components update atomically and obey current headwear constraints. |
| M035 | Dye and material selection | Shared palette parameters preserve batching and do not create one material per actor unnecessarily. |
| M036 | Appearance persistence and migration | Versioned descriptors survive reloads and supported schema upgrades with explicit unknown-version handling. |
| M037 | Asynchronous appearance transactions | Rapid changes, failed downloads, cancellation and teardown retain a coherent committed character. |
| M038 | Local shape preparation and cache | Evaluate stable body/garment shapes on change with bounded CPU/GPU memory and scheduled uploads. |
| M039 | Inspection and photo presentation | Nearby inspected actors can promote detail without stalling gameplay or leaking resources. |
| M040 | Creator production acceptance | All supported controls and presets pass usability, motion, fit, performance and device checks. |

## E — Crowd renderer and memory budgets

Depends on M003/M009/M010; later items require measured evidence, not a promise of 1,000 exact actors.

| ID | Milestone | Observable exit |
| --- | --- | --- |
| M041 | Representation priority scheduler | Screen size, visibility, party/target importance and frame budget select representation consistently. |
| M042 | Standard character detail levels | Reduce mesh, bones, materials and attachments while retaining race and equipment silhouettes. |
| M043 | Animation work budgeting | Prioritize nearby evaluation and bound CPU animation time under population spikes. |
| M044 | Shared baked animation library | Compatible rigs/binds share offline animation payloads with independent clip phase and transitions. |
| M045 | Modular crowd batching | Batch repeated equipment pieces and bodies across different outfits without phase or coverage disagreement. |
| M046 | Crowd shape approximation | Map detailed bodies to tested representative shapes with bounded visual transition error. |
| M047 | Material and texture pooling | Control bindings, texture residency and dye variation without per-character texture duplication. |
| M048 | Occlusion and visibility scheduling | Skip irrelevant work while preserving required shadow casters and handling reveal bursts. |
| M049 | Character shadow and effect budgets | Prioritize near shadows, hair motion, spell effects and nameplates within separate caps. |
| M050 | Distant representation and crowd acceptance | Review low-detail silhouettes or impostors and publish capacity curves for supported devices. |

## F — Startup and asset delivery at population scale

Depends on C/E and preserves the measured progressive startup contract.

| ID | Milestone | Observable exit |
| --- | --- | --- |
| M051 | Appearance-aware starter payload | Known local appearance starts with compact compatible assets and a defined fallback while details stream. |
| M052 | Asset request prioritization | Local, target and near-visible assets outrank distant appearance refinements. |
| M053 | Download and decode scheduling | Bound concurrency, decode work and upload slices during crowded entry. |
| M054 | Cross-character cache ownership | Shared resources survive individual actor teardown and evict only when unused. |
| M055 | Versioned asset bundles and delivery | Publish immutable bundles and compact manifests with safe cache invalidation. |
| M056 | Texture residency policy | Keep high-resolution maps near important actors and track actual device memory limits. |
| M057 | Crowded-entry readiness metrics | Measure local playable time and appearance convergence separately under cold-network conditions. |
| M058 | Failure and offline tolerance | Partial asset failure yields explicit compatible fallbacks and retry without startup deadlock. |
| M059 | Device loss and memory recovery | Rebuild or reload within supported device constraints without accumulating abandoned resources. |
| M060 | Streaming endurance acceptance | Repeated city entry/exit and wardrobe churn reach a memory plateau without frame-time drift. |

## G — Multiplayer presence foundation

Conditional future work after M010; backend choice is an explicit decision, not an assumed SpacetimeDB commitment.

| ID | Milestone | Observable exit |
| --- | --- | --- |
| M061 | Authority and transport decision | Select server authority, update rates, deployment model and spatial interest strategy with a small measured prototype. |
| M062 | Identity and session lifecycle | Secure player/session identity supports reconnect and authenticated character selection. |
| M063 | Server-owned appearance records | Validate descriptor versions, supported values and equipment entitlements on the server. |
| M064 | Movement replication prototype | Authoritative movement snapshots reconcile the local player and interpolate remote players. |
| M065 | Remote actor lifecycle | Spawn, despawn, reconnect and late appearance arrival are idempotent and cancel safe. |
| M066 | Spatial interest management | Replicate relevant actors according to spatial and gameplay importance with bounded fan-out. |
| M067 | Appearance delta replication | Send revisions when appearance changes and deduplicate shared asset metadata. |
| M068 | Animation intent replication | Replicate compact action intent and timing, preserving readable remote transitions. |
| M069 | Population admission and partition policy | Define city/shard limits, visibility caps and overload behavior using measured capacity. |
| M070 | Multiplayer presence acceptance | Latency, packet loss, reconnection and crowded entry pass reproducible multi-client tests. |

## H — Social hub and relevant gameplay integration

Depends on G and existing gameplay contracts; expands only when multiplayer work is commissioned.

| ID | Milestone | Observable exit |
| --- | --- | --- |
| M071 | Finite hub multiplayer traversal | Current region routes and collision work with local authority and interpolated remote actors. |
| M072 | Remote interaction and targeting | Targets remain selectable across representation changes with stable identities. |
| M073 | Party presence prioritization | Party members keep suitable update/detail priority without unbounded exceptions. |
| M074 | Nameplate and crowd readability | Names, target indicators and occlusion have explicit rendering and interaction limits. |
| M075 | Equipment authority integration | Game equipment state and cosmetic appearance remain distinct and consistently validated. |
| M076 | Combat presentation replication | Current actions and effects synchronize without trusting client damage or spawning unlimited effects. |
| M077 | Customization and combat dimensions | Define fair collision/hit rules for visual height changes and verify visual/contact consistency. |
| M078 | Social communication integration | Implement chosen social channels with service limits and appropriate player controls. |
| M079 | Hub instance and travel lifecycle | Transfer presence between hub instances without duplicate actors or lost appearance state. |
| M080 | Representative crowded gameplay acceptance | Traversal, targeting, party, combat presentation and customization remain coherent under real population load. |

## I — Launch wardrobe and recurring content

Bulk production follows M010 and the production fitting factory; 30 sets are a target, not 30 guaranteed compatible designs today.

| ID | Milestone | Observable exit |
| --- | --- | --- |
| M081 | Thirty-set content specification | Define actual slot counts, race coverage, silhouettes, dyes, weapon scope and downloadable budgets. |
| M082 | First five production sets | Five contrasting sets pass the complete fit and publishing pipeline. |
| M083 | Sets six through ten | Publish the next five sets while measuring authoring time and defect rates. |
| M084 | Sets eleven through fifteen | Expand coverage without growing pair-specific exception code uncontrollably. |
| M085 | Sets sixteen through twenty | Verify accumulated cross-set seam and layering compatibility. |
| M086 | Sets twenty-one through twenty-five | Keep fitting, build time and memory within established production budgets. |
| M087 | Sets twenty-six through thirty | Complete the launch catalogue with explicit exclusions and asset provenance. |
| M088 | Whole-catalogue compatibility campaign | Combine exhaustive rule checks with boundary-pair, extremal-body and reviewed motion sampling. |
| M089 | Quarterly PvP tier rehearsal | Produce and publish one new tier through the same workflow; measure lead time and patch payload. |
| M090 | Live wardrobe lifecycle | Handle new versions, retired appearances, migrations, rollback and ownership preservation. |

## J — Release readiness and sustainable operation

Depends on relevant preceding gates; population promises and schedules are fixed only after evidence.

| ID | Milestone | Observable exit |
| --- | --- | --- |
| M091 | Hardware and browser support matrix | Publish measured resolution, quality and population targets per supported device class. |
| M092 | Performance regression automation | Detect startup, frame-tail, memory and crowd-capacity regressions with isolated reproducible runs. |
| M093 | Asset and network abuse resistance | Validate untrusted descriptors, bound resource requests and test malformed or oversized inputs. |
| M094 | Long-running stability campaign | Hours of traversal, crowd churn and outfit swaps show stable memory and recovery behavior. |
| M095 | Telemetry and privacy decisions | Collect the minimum operational metrics needed to diagnose capacity without unnecessary personal data. |
| M096 | Content and service rollback drill | Revert incompatible assets or server/client versions with preserved appearance records. |
| M097 | Closed population trial | Observe real mixed-device users and revise simulated-load assumptions. |
| M098 | Release candidate acceptance | Close fit, gameplay, rendering, startup and multiplayer blockers with evidence and explicit residual limits. |
| M099 | Launch capacity and operations | Set measured concurrency limits, incident procedures and monitoring ownership. |
| M100 | Quarterly review and roadmap renewal | Use player evidence and content cost to revise priorities and the next ten milestones. |

## Decisions deferred until evidence exists

Exact body parameter ranges; race-specific rig sharing; runtime morph versus cached shape evaluation; quality/population budgets per device; batching keys; texture atlas/array layout; remote physics policy; backend and authoritative movement implementation; launch slot count and full set composition. Each has an owning milestone above. Deferred means no speculative framework or unsupported UI claim now.
