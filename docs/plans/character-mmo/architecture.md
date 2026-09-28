# Character architecture decisions and research

Status: recommended architecture, 2026-09-27. Capability verification is scoped; no crowd or arbitrary body-customization implementation is claimed.

## Durable decisions

1. **Authored templates plus procedural fitting/assembly.** Generated/reused/sculpted source art must become an editable licensed production mesh. Stable topology is required within a morph family; every race need not share topology. Procedural secondary details and material variants remain useful.
2. **Appearance is a versioned recipe.** Store race/body profile, implemented shape parameters, component IDs, dyes and cosmetic item IDs. Server equipment entitlement and authoritative gameplay remain separate future contracts. Never transmit arbitrary client URLs or generated vertex arrays as normal appearance state.
3. **Fit identity is explicit.** Separate rig hierarchy/order, bind transforms, mesh frame, body shape version and material layout. Semantic equivalence can survive animation-only asset changes; source hashes alone are not fit IDs. Different binds cannot share a pose palette merely because their bone names match.
4. **Bounded shape space.** Initially uniform height and authored slender/stout shapes; age is adult face/material/hair presentation. Independent limb lengths, procedural anatomy solvers and cloth simulation for every actor are deferred. Treat the original Human, sculpt Orc and current Undead as separate production sources; old MakeHuman diagnostic profiles are not the active body.
5. **Coherent fitting.** Body and garments share parameter meaning, not necessarily identical deltas or topology. Rigid plates retain shape; coverage hides genuinely covered body regions; lower garments obey explicit layer precedence. Author corrective fits for extreme shape combinations. Changing skeleton proportions requires new inverse binds/retarget/contact validation, not an incidental scale hack.
6. **Two runtime assembly strategies.** Exact nearby representations may cache fitted vertices and selectively merge compatible parts. Distant representations prioritize reusable piece meshes, materials and shape buckets. Per-actor merging can destroy cross-actor instancing. No decision to build either merge framework until M003 identifies costs.
7. **Native animation reuse.** Existing evaluated pose drives compatible nearby garments. Offline baked animation is a candidate for crowds. Share baked matrices only within a compatible bind family; world-scale height can remain per-instance. Per-instance arbitrary morphs, dye layouts, attachments and shadow correctness need a real integration proof.
8. **Budget by importance.** Screen size, visibility, party/target status and frame time choose detail. Preserve silhouette/colors, stabilize transitions, bound promotions, and separately limit shadows, hair, effects and nameplates. Keep omitted/approximated appearances honest in reports.
9. **Preparation on change.** Stable body shape can be evaluated on appearance change, with bounded caches and frame-sliced uploads. Realtime editor sliders may use native morphs. Network arrival, wardrobe swaps and city entry cannot each trigger unbounded synchronous construction.
10. **Multiplayer interest is separate from graphics.** Presence, replication relevance and rendered detail are different counts. Remote actors interpolate validated server state; they do not each run a local Havok player controller. Collision/hit dimensions for visual height need an explicit fairness/design decision before networked combat.

## Existing repository boundary

- `src/ashen-reach/main.js`: progressive startup, Human/Orc/Undead pack selection, race lifecycle.
- `src/ashen-reach/equipment-contract.js`, `equipment-catalog.js`: fit declarations, coverage union, slot occupancy, current presets. Coverage still uses Human mesh names and adapters, not the future semantic region standard.
- `equipment-stream.js`, `equipment-loader.js`: staged garment loads, shared pose resources and cancellation; preserve their ownership rules.
- `src/character/body.js`, `runtime/body-visual.js`, `sockets.js`, `adapters/lite-skin-layout.js`: source motion and evaluated attachments.
- `src/character/runtime/body-profile.js` also contains older diagnostic profiles. Audit actual main-route use before reuse.
- `scripts/ashen-reach/prepare-starter-character.mjs`: derives the compact dressed startup assets from current equipment; preserves geometry and animation while deferring full body textures.

Installed `@babylonjs/lite` is pinned to **1.31.1**. Inspection confirmed `setMorphTargetWeights`, `prepareVat`/`prepareVatMany`, `createVatBakeResults`, `attachVat`, and per-instance `setInstances`/`setInstancesBlend` declarations. Its VAT path stores baked bone matrices and drops the live skeleton when attached. These are primitives, not a complete modular crowd renderer. Confirm loader, shared-resource disposal, skin frame, per-instance inputs and shadow behavior in M003. The Lite docs MCP was not exposed in this planning session; the installed declarations and official repository remain the verified capability sources.

## Research references and limits

- [Babylon Lite official repository/documentation](https://github.com/BabylonJS/Babylon-Lite): prefer its architecture/API docs plus the installed version. Latest docs can exceed 1.31.1.
- [Khronos glTF specification](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html): morph targets and skinning are standard asset concepts; the format alone does not implement garment fitting.
- [Epic parametric clothing](https://dev.epicgames.com/documentation/metahuman/getting-started-for-creating-parametric-clothing-in-metahuman?lang=en-US): multiple reference fits reduce distortion when body shapes differ substantially. Adopt the authoring principle, not Unreal runtime code.
- [Epic modular characters](https://dev.epicgames.com/documentation/unreal-engine/working-with-modular-characters-in-unreal-engine): pose sharing versus mesh merging has CPU/render/setup tradeoffs. Native Lite implementation requires separate verification.
- [Epic animation budget allocator](https://dev.epicgames.com/documentation/en-us/unreal-engine/animation-budget-allocator-in-unreal-engine) and [animation sharing](https://dev.epicgames.com/documentation/en-us/unreal-engine/animation-sharing-plugin-in-unreal-engine): references for throttled/shared animation work, not available Lite plugins.
- [Existing glTF Transform tools](https://gltf-transform.dev/): repository already uses glTF Transform and Meshoptimizer. Reuse these for asset inspection/preparation; deformation-safe compression and simplification need visual verification.

## Decision register

| Decision | Owner / evidence | Default until resolved |
| --- | --- | --- |
| Current sources/binds/coverage truth | M001 asset census | Current shipped assets remain authoritative |
| Appearance schema and migrations | M002 contract tests | Reject unsupported versions/parameters; no invented capabilities |
| Native baked path and modular batching feasibility | M003 measurements | Existing independent actors stay production default |
| Human template source/topology and shape endpoints | M004 source comparison + motion | Preserve approved reference; no arbitrary source swap |
| Per-family morph/cache strategy | M005 + M003 | Exact nearby shapes first, no per-instance morph claim |
| Elf sharing versus distinct fit | M008 anatomy/fit evidence | Distinct fit identity until equivalence is proven |
| Crowd tier capacity and texture/material strategy | M009/M010 capacity curves | No guaranteed 1,000 detailed actors or 144 FPS crowd claim |
| Gameplay dimensions for visual height | M004 prototype; M077 multiplayer gate | Existing gameplay capsule/rules remain unchanged; reject unsafe visual range |
| Backend/service architecture | M061 measured prototype | No selection or network rewrite now |
| Production wardrobe scope and quarterly cadence | M081/M089 | 30 sets and quarterly tiers are product targets, not delivery estimates |
