# M5 saved Human identity implementation

Scope: finish M5 tasks 2–5 on the corrected face approved by the user. Continue
autonomously under [the active goal](../../autonomous-continuation.md). Production
currently remains v5 / M7 source `4063f49`. Physical-phone acceptance stays in M10.

## Checkpoint A — bounded recipe and history

Implemented `appearance-catalog-v6`, now activated in the local integration.
The public production deployment still uses v5; its decoder profile stays frozen
independently from v6.
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
check before commit. Dispose the session with the editor. The ordinary local route
now uses this session and checks ownership at its native commit boundary.

Original contract checkpoint verification: fourteen contract/history tests;
character **180/180**, equipment **112/112**, startup-prefetch **6/6**, build pass.
The later local integration below adds the visible control; M5 release remains open.
[Independent Grok review and correction](../../reviews/character-mmo/m5-identity-contract-2026-10-04.md);
[verification receipt](../../baselines/character-mmo/m5/saved-identity-2026-10-04/contract-checkpoint.json).

## Checkpoint B — immutable selected packs

**Implemented:** three sealed connected-body packs, canonical bind/rest copying,
unchanged accepted geometry/source curves, embedded compact textures and full-map
upgrades, shared clothing and default starter path. The same runtime coverage adapter
guards publication and loading. Eight sealed-pack tests include deliberate defects.
Do not change the source acceptance pins to change compact detail.

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

The current lossless body encoded sizes are 991,320 bytes released,
1,246,743 Weathered bald, 1,241,379 Prime bald, 1,541,329 Prime ponytail. Their
animation accessors account for 1,248,560 decoded bytes per corrected source;
this census is not proof of the cold-start bottleneck or an acceptance result.

## Checkpoint C — one actor transaction and usable controls

**Implemented locally:** all five integration steps below. The publisher regenerates
v6 remote metadata through its original native bounds sweep (142,120,095 points);
all 45 piece binaries remain unchanged. Nonstarter heads remain refused by the
parked shared-region protocol, which has no published head fit. Actual controls,
save/first-frame identity, race return, failed source loads, retry and disposal pass.
The valid Grok coverage finding was fixed before these checks. See
[the checkpoint result](results/m5-saved-identity-2026-10-04.md).

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

**Native packaging/local timing checkpoint implemented, 2026-10-05:** Rolldown
static grouping and independent pure saved validation pass 120/120 local ordinary
compressed starts, p95 808–972 ms, with actual native identity/shape at first play.
Measured art/physics remains exact. Native Pages staging separately verifies 513
served artifacts, 20 identity cache policies and ten prefetch/eight saved cases.
Nine FPS cohorts and six affected-route repeats retain media-isolation/cap/tail
limits. Reviewed Pages motion is Telegram 857 / VE. This closes the recorded local
ordinary-build overrun; it does not establish final Pages/public/device acceptance.
[Result and continuation](results/m5-startup-packaging-2026-10-05.md).

Next concrete fit package:

1. Reproduce the light right upper-back patch seen in the saved tall/stout,
   exposed-ponytail, largest mixed outfit during normal W movement. Record actual
   active clip/mask/phase, native mesh ownership and compact/full clothing stage.
   A static walk comparison did not reproduce it; its UI labels were stale after
   API-driven changes, so retain it as diagnostic evidence only.
2. Use matched bald/ponytail and native component-visibility controls at the **same
   observed pose** to identify the part before changing art. Do not label a hair
   tip, hand, neck or garment pixel as skin from colour alone. Reuse the current
   native mixer/coverage/source authoring path; preserve the approved face and binds.
3. Correct a reproduced valid defect, then review the exposed/hooded identities
   across representative presets, body endpoints, ordinary composed gait/casts and
   compact/full clothing. Raw carry previews remain diagnostics, not melee damage.
   Keep visible boot sole/seam work explicit in M6 and the authorized defect queue.
4. Run final **Pages-output** cold/FPS cohorts after all required source changes,
   with media/game isolation checked at useful boundaries. Retain variable bridge
   tails and first-use GPU outliers. Then commit/push and release through the normal
   public bundle/asset/load/movement/rollback gate; no approval round is needed.

**Saved-route fit checkpoint implemented:** 630 live views cover the three selected
identities, all five Human body cases, every seven named preset plus bare and two
mixes. Native actor weights/root scale, actual body/garment visibility and photographed
controls are checked; an inverted hair prediction fails. The authored native hair/
tie/material policy is documented, with bounded live motion delivered as Telegram
856. [Result and explicit limits](results/m5-saved-fits-2026-10-04.md). All 286 built
art/physics payloads stay exact; only identity provenance is resealed for a source
comment. This is not the exhaustive outfit/motion/mix exit or isolated performance
acceptance. User WoW was active during checks but is absent at the final cleanup
audit. Run fresh isolated cohorts next; correct existing boot sole/seam defects and
remaining fit gaps, then complete release gates.

**Mobile Armory checkpoint implemented:** native Lite stage viewport/orbit/pinch,
responsive portrait controls and live Human-height framing. Custom AO/fog match
the viewport; native 1.31.1 contacts are disabled in a partial viewport because
their depth UVs assume the full texture, then restored during gameplay. Character
200/200, lighting/projection 10/10, 15 final built layout cases, disposal/reopen and
three final desktop mobile checks pass. Reviewed motion is Telegram 855; VE exact
file hash/play/seek and Telegram inline/expanded proportions pass. Native fullscreen,
Telegram Desktop and physical phone remain unverified. Full saved-route outfit/
motion fits and isolated startup/FPS/release gates remain open while user WoW runs.
[Result](results/m5-mobile-preview-2026-10-04.md).

**Native playable-library checkpoint implemented:** same approved visual and exact
22 playable curves at first play, about 399 KB/body saved; all full 57-curve assets
unchanged. Native pruning and shared runtime/compiler/melee names replace the
need to promote a second body just to restore unused library motions. Character
200/200, startup 14/14, sealed 16/16, ordinary refinement/save checks, 30 extra
native operations, three final desktop mobile checks and local Pages 848 artifacts / 20 identity cache policies pass.
Reviewed motion Telegram 854; VE play/seek passes.
[Result](results/m5-playable-library-2026-10-04.md).

The earlier promotion proposal below applies when compacting the visible body or
playable motion behavior. This library subset preserves both, so the existing
gear-only refinement keeps its actual actor/group objects/phase. Isolated startup
and FPS cohorts remain open while user WoW runs. Continue full outfit/motion fits,
then isolated measurement/release; the mobile layout checkpoint above is delivered.

**First compact checkpoint implemented:** lossless dense native accessor storage,
compact fitted hood and overlapped selected catalogue/module request. Character
195/195, startup 14/14, 11 live refinement cases, 8 repeated saved-route cases,
7 desktop mobile/WebKit cases, native Pages bytes/cache policies and final build pass.
Reviewed motion is Telegram 853. [Result](results/m5-compact-identity-startup-2026-10-04.md).
The full approved body/face and all 57 curves remain exact; no full-body promotion
was needed for this storage/hood pass. No cold-cohort/FPS acceptance is claimed while
user WoW is running. Next inspect remaining payload and complete outfit/motion fits;
run isolated cohorts and release gates once conditions allow.

**Previous diagnostic context:** the three 50 Mbit/s / 40 ms compressed-build cold pilots
take 2502.6, 1198.0 and 1149.4 ms. They retain the selected face and supported
silhouette; none meets one second. Keep the first-use GPU tail distinct from the
repeatable payload overrun. Inspect bytes/decode/upload marks, begin with the
head-specific hood using the existing glTF Transform/meshoptimizer compact policy
(now delivered), then measure whether protected face geometry and hair detail need a bounded compact
representation. Keep full accepted sources lossless. If the compact body differs,
promote its full body and gear through the existing native transaction after play,
with actor/shape/gear/dye/phase guards and measured staging cost. Do not simply replace
the identity with a starter or add a second skinning/animation system. Use small
pilot runs to choose a representation, then run the complete 20-run cohorts below.

Already reviewed: saved source motion at neutral/short-stout/tall-slender, fitted
hood hiding/restoring separate hair, actual choice/undo, normal walk/jump/cast/attack
(Telegram 852). Largest hooded ponytail paired route repeat: 208–242 FPS;
0.9–4.3% additional mean frame cost. The slower first cohort remains evidence;
near-240 Hz flags limit ceiling claims. This does not close unhooded throughput,
Weathered/default cohorts, all outfit combinations, touch/WebKit or production gates.

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
