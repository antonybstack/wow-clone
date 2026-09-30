# Current state and priority review — 2026-09-29

Reviewed source HEAD: **2573439**, after the Armory creator merge and delivery-hook correction. This is a planning review. No game renderer, performance run, new visual acceptance or deployment was performed. Claude was idle when checked through Orca. The parent owns the documentation changes; a bounded Grok 4.6/high review inspected files only and finished successfully.

## What exists today

| Layer | Verified boundary | Implication |
| --- | --- | --- |
| Released | Production remains 76e3c41, Pages deployment 72fd1e3d-7d8d-4108-8f0f-d8eb9a42cbfe. Progressive startup, finite region, Human/Orc/Undead, equipment and current combat are playable. | There are 43 subsequent commits at the reviewed HEAD; the release does not contain those changes. |
| Committed runtime | Semantic coverage and garment repairs, Armory BODY surface, local creator persistence, pure appearance v1 contract, query-gated shape writers. | These are useful infrastructure, but body editing requires the developer candidate route. |
| Developer candidates | M004 body shapes, M005 fitted garments/plate, M006 hair/head and M003 crowd inputs. Shape and garment generation scripts are tracked, but served outputs are under ignored .cache. | A successful local candidate check does not make a capability available on Pages or prove source-input completeness in a fresh checkout. |
| Unaccepted experiments | Old/bald head join, full modular scalp/age/hair/dyes, arbitrary crowd shape variation, native VAT in the real town. | These need explicit bounded proof or a new source asset. Further content volume is premature. |
| Multiplayer | No active multiplayer server, authority or remote actor lifecycle was found in the reviewed product. | A synthetic crowd is a graphics experiment, not an MMO session. |

## Performance evidence and limits

The [2026-09-27 production release](../complete/2026-09/one-second-startup-implementation-2026-09-27.md) recorded 194–231 mean FPS over five routes on M1 Max, uncapped Chromium WebGPU, 1280×720 and seven enemies, without recording. Cold production starts at 50 Mbit/s / 40 ms recorded p95 979.4 ms, 19/20 within one second and maximum 1,054.5 ms. Those remain historical release results.

The [2026-09-29 paired solo check](../plans/character-mmo/results/solo-fps-paired-2026-09-29.md) compared db61e63 with 71804ca: meadow/town/cathedral 184–240 mean FPS, paired mean frame time within +0.14%, with no interval over 16.67 ms. It did not accept bridge/forest or test the later Armory merge at 25a8d25. The [startup follow-up](../plans/character-mmo/results/m006-startup-gate.md) found nearly identical same-day baseline/candidate results around 1.1 seconds; the old accepted commit was also slower than its earlier recorded result. Machine load and serving/protocol differences remain confounders. This supports no isolated regression in the tested comparison; it does not establish a current passing absolute gate or uniquely identify the cause.

The [crowd proof](../plans/character-mmo/results/m003.md) measured about 242 mean FPS for 300 mixed actors and about 77 for 1,000 in a flat scene. Full actors contained 20,521/39,638 triangles. One VAT actor fails the real town's custom shadow composition. A reverted shadow-exclusion experiment with a sub-120 baseline is not an accepted capacity result.

Physical iPhone 14 Pro Max was previously reported by the user at about 60 FPS. Current customized startup, memory, crowded hub and multiplayer device acceptance are unmeasured.

## Findings that change priority

1. **Ship the already proved body work.** [human-shape.js](../../src/character/runtime/human-shape.js) names developer URLs; [Vite](../../vite.config.js) serves them from .cache. [main.js](../../src/ashen-reach/main.js) bypasses the compact character start for candidates and enables writers only on explicit routes. The Armory on the normal route explains a developer flag. A production asset/upgrade path is the highest-value next deliverable.
2. **Unify appearance before replication.** [Appearance v1](../../src/character/appearance/contract.js) rejects every shape/component/dye value. [Creator persistence](../../src/character/creator/store.js) saves another versioned record. The runtime does not apply the M002 recipe as its source of committed identity. Reuse the validators/loaders and establish one recipe; retain a separate temporary editing draft.
3. **Freeze a tested control domain.** Both creator build axes currently allow 0..1 independently. The posed matrix in [measure-posed-garment-fit.mjs](../../scripts/character-assets/measure-posed-garment-fit.mjs) uses single-axis weight **1.0**, while the reviewed live clips use **0.95**. Intermediate and simultaneous-axis blends lack acceptance. Old CURRENT wording attributed 0.95 to both. Production controls must be limited to an explicitly reviewed domain.
4. **Fix crowd correctness in the actual region before scaling.** Reuse the native VAT/thin-instance path and existing piece grouping. Resolve the custom-shadow composition failure, live-to-baked transition failure, actor identity, phase, bounds and final-owner disposal with one/ten actors before population work. A library can reduce bookkeeping; it cannot establish compatibility with this shadow bridge.
5. **Replace the head-art experiment with a source task.** [The old-head result](../plans/character-mmo/results/m006-old-head-neck-albedo.md) identifies a geometric/tangent discontinuity; atlas and normal sweeps have not passed live review. The fused starter hair prevents bald. The next art proof needs a complete scalp, a coherent neck connection and separate hair, with the approved Human direction retained.
6. **Prove a repeatable item pipeline before 30 sets.** Coverage, fit IDs, source animation and on-demand equipment already exist. Pilgrim still uses the supported legacy coverage adapter; this is migration debt, not evidence of a visibility regression. The pauldron is carried by a diagnostic body, not an equipment slot. A real cloth/plate publishing rehearsal will establish cost and contracts.

## Reprioritization

The [next ten](../plans/character-mmo/next-ten.md) combine recipe, bounded fit and production release into one milestone rather than counting each small prerequisite as a major milestone. Crowd correctness and resource budgets precede more source art. A small authoritative multiplayer slice moves ahead of bulk race/wardrobe production, so identity and actor lifecycle are tested with real clients early. Human head/hair, five contrasting outfits and an Elf proof then exercise the same pipeline before hub-scale acceptance and cooperative gameplay.

The independent review supported the identity, candidate-only, fit-domain and crowd blockers. Its suggested tiny recipe/asset/fit milestones were consolidated. Its proposal to defer backend selection altogether was rejected: the small two-client authority experiment owns the decision, while large-scale service architecture remains later work. Neutral-only Orc/Undead is a current capability boundary, not a calendar commitment.

A final Grok challenge clarified compact neutral startup versus an on-demand editable family and a shape-correct saved starter; corrected remote-client dependencies; named the waist, wrist and Undead bind repairs as publication invariants; and scoped the 100-actor FPS target to milestone 8. The wardrobe factory core can proceed if head art is blocked. Presence uses room-scoped authenticated reconnect identity and preserves the current scaled movement capsule; durable character identity and combat hit policy arrive with milestone 9. The suggestion to weaken customized one-second acceptance was not adopted: progressive detail is allowed, but the saved silhouette and startup goal remain required.

Pause speculative rendering feature trials, more old-head atlas/normal sweeps, full 30-set production, independent limb sliders, per-actor cloth simulation, new regions and broader combat redesign. Preserve their historical evidence; these are not the next queue.

## Verification performed for this review

- npm run test:character: **106/106 passed**.
- npm run test:equipment: **71/71 passed**.
- ASHEN_PAGES=1 npm run build: **passed**, prepared-startup validation included.
- Inspected current source, candidate URL/build boundaries, original milestone reports and recent commits.
- No new live game, motion, FPS, startup or device claim. Existing MP4 report links are prior reviewed evidence; this review did not re-review full playback.
- Unrelated AGENTS.md edits and the existing hook __pycache__ directory are outside this task.

## Narrow research for reuse

Native Lite 1.31.1 already supports CPU preparation followed by GPU upload of baked animation, per-instance phase/blending and thin instances. This matches the M003 direction; custom-scene integration still needs proof. See the [version-pinned VAT specification](https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/docs/lite/architecture/15-vertex-animation-texture.md).

The MIT [@litools/instancer](https://github.com/eldinor/lite-instancer) is a candidate for stable IDs, pooled slots and multi-part VAT bookkeeping. Registry version 0.7.0 declares a Lite peer range of ^1.31.0, which includes the installed version; that range alone does not establish runtime compatibility. Evaluate a pinned release in the one-actor proof before adopting it.

[Colyseus state synchronization](https://docs.colyseus.io/state) and [netcode](https://docs.colyseus.io/netcode) are concrete reuse candidates for the authority spike. Assess the supported version's transport, prediction/reconciliation and lifecycle against Havok and this game; a dependency has not been selected or installed.
