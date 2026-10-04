# M5 saved Human identity implementation

Scope: finish M5 tasks 2–5 on the corrected face approved by the user. Continue
autonomously under [the active goal](../../autonomous-continuation.md). Production
currently remains v5 / M7 source `4063f49`. Physical-phone acceptance stays in M10.

## Checkpoint A — bounded recipe and history

Implemented candidate `appearance-catalog-v6`, explicitly selected through
`APPEARANCE_IDENTITY_REGISTRY`. Production still uses the frozen v5 registry.
Choices are Original adventurer, Prime bald, Prime ponytail, Weathered bald.
The original starter normalizes to `components:{}`; other choices carry exact
`head` and `hair` identifiers. Prime and Weathered are distinct authored head
presets, not a continuous ageing slider. Weathered ponytail is unsupported.

Migration validates v1–v5 in their original registries before upgrading. Preserve
race, equipment, dyes, height/build and the existing starter identity. Unknown,
corrupt or future records remain refused and recoverable. The storage decoder's
omission of valid v4 records is corrected by using the migration allowlist in
the contract instead of duplicating it in the codec.

The identity editor session queues choices and stores component-only undo. The
actor callback still owns visual commit and persistence. A failed choice adds
no undo entry; failed undo retains its entry. Equipment/dye/shape changes survive
identity undo. Actor replacement expires history and refuses pending jobs, even
after a race round trip back to Human. The session requires an owner generation;
staging receives an AbortSignal and `throwIfStale`, which the transaction must
check before commit. Dispose the session with the editor. Candidate sessions require an
explicit registry until the playable integration is accepted.

Verification: fourteen new contract/history tests; full character suite **180/180**,
equipment **112/112**, startup-prefetch **6/6**, build pass. This checkpoint does
not activate a visible control or constitute M5 delivery.
[Independent Grok review and correction](../../reviews/character-mmo/m5-identity-contract-2026-10-04.md);
[verification receipt](../../baselines/character-mmo/m5/saved-identity-2026-10-04/contract-checkpoint.json).

## Checkpoint B — immutable selected packs

1. Prepare separate candidate outputs from the pinned corrected sources and fitted
   hood, using the existing source reproduction and native glTF pipeline. Never
   regenerate acceptance pins to accommodate a changed source.
2. Reuse released compact/full clothing descriptors. Only body and per-head hood
   change. Publish content-addressed descriptors, exact source hashes, ordered
   morph names, semantic body coverage, texture upgrade policy and a shared bind
   fingerprint. Head/hair descriptors identify the meshes of their authored
   connected-body pack; do not cut a new neck seam to make independent swapping.
   The preparatory census finds identical bind hashes across all three corrected
   sources, and identical 57 animation curve values to the release. The corrected
   bind/rest values retain small Blender-roundtrip differences from the release
   (maximum inverse-bind element difference 0.0013427734375). The old adapter
   accepts a tolerance rather than copying exact reference values. Before claiming
   an exact shared clothing bind, reuse that adapter with exact canonical
   bind/rest copying and verify the result with `assertCopiedSkinBind`; keep the
   accepted source/visual pins intact and record the normalized pack separately.
3. Use the current promise fetch/decompression cache. A saved nonstarter identity
   must select its compact pack in both early preload and main. The unsaved and
   explicit starter paths keep the released startup requests. Never boot the
   wrong face then call it successful incremental identity loading.
4. First measure the existing lossless body representation before reducing it.
   Source anatomy, bind, animation and silhouette must remain correct. If the
   cold gate fails, identify transfer/build/GPU cost, then use the existing native
   glTF Transform/meshoptimizer tools for a bounded compact representation. Do
   not invent an animation or skinning loader, alter elapsed animation time, or
   simplify the approved full-detail source to manufacture the performance gate.

The current prepared body encoded sizes are 991,320 bytes released,
1,246,960 Weathered bald, 1,241,709 Prime bald, 1,541,533 Prime ponytail. Their
animation accessors account for 1,248,560 decoded bytes per corrected source;
this census is not proof of the cold-start bottleneck or an acceptance result.

## Checkpoint C — one actor transaction and usable controls

1. Extend the existing `actorRequest` / `body.stageSource` transaction. Stage the
   selected body plus its equipment while the current actor remains visible.
   Reuse `createStreamedEquipment`, current coverage, dyes, shape writers,
   animation snapshot/restore, socket rebinding and native palette ownership.
2. Commit body, gear and components together on the native render boundary. On
   fetch/build/commit failure retain the prior actor, saved recipe, motion, shape,
   dyes and item selection. Clean cancelled/staged resources. Preserve inspection
   state and normal input. Detail upgrades may only touch their captured current
   actor/equipment and must abort after another change or scene disposal.
   Supply the identity session's owner generation, advance it on logical actor/race
   replacement (including same-race replacement), and call its `throwIfStale`
   immediately before commit. Ordinary shape/dye/identity/detail changes on that
   same logical actor do not advance it. Dispose the identity session when its
   creator is disposed. These ownership controls are required by the reviewed
   race-round-trip negative case, not optional cleanup.
3. Extend `rememberAppearance` so later equipment/dye/body edits retain committed
   components. Maintain the Human identity when switching away and back; Orc and
   Undead never acquire Human component identifiers. The parked shared-region
   path must reject unrenderable identity instead of labelling a starter actor
   with another person's identity.
4. Add a single authored identity select with the four choices and independent
   identity undo/reset. Read the committed recipe after every result. Explain
   distinct head presets in player terms. Do not offer arbitrary age/hair pairs
   or unaccepted skin/hair dye channels.
5. Activate v6 only with compatible published metadata and immutable manifest
   guards. v5 and historical component profiles are already constructed independently;
   retain that separation when changing the production export/version. Do not
   silently update the catalogue of old remote-piece artifacts; regenerate their
   metadata through the existing publisher and keep unchanged bytes unchanged.

## Checkpoint D — hair and acceptance, then release

Verify ponytail tie/material policy; hood hide/restore; shoulders/cape clearance;
body endpoints; every current outfit plus representative mixed combinations;
idle/walk/run/turn/jump/land/spells and one/two-handed weapons. Reuse the current
fit/motion harnesses. Resolve visible defects before claiming this capability.

Extend live save/reload and first-play checks to all supported combinations, with
gear and colours. Inject failures, overlapping changes and disposal. Include
desktop touch/portrait and WebKit without claiming physical-phone acceptance.

Measure 20 cold saved starts per prescribed cohort at 50 Mbit/s / 40 ms against a
verified compressed production build; retain every miss. Measure paired default
and selected settled routes separately from recording: M1 Max / 1280×720 / seven
enemies / uncapped Chromium WebGPU / three 12-second runs per five routes.
Each route mean must exceed 144 FPS. Report tails and repeatable >5% regressions.
Track and isolate the sole intended renderer before benchmarking.

Review actual live motion, encode using capture timestamps, publish to VE and
send the MP4 through `tg file`; inspect real playback proportions and explicitly
retain unavailable fullscreen/device limits. Commit/push, deploy through the
existing Pages workflow, record rollback, verify exact assets and ordinary
movement/loading/mobile-WebKit gates, then update CURRENT and close M5 only if
its saved first-play exit passes. Continue to remaining M6 defects/evidence.
