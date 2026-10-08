# Exact material texture failure attribution — 2026-10-08

The old starter-world error wrapper could name a successful primary albedo map
when a shared secondary map failed. That reporting defect is reproduced and
corrected locally. It does **not** establish or correct the historical transport
failure. Production remains **7d00c56 / 5723a4ab**, and preview **514fe898** remains
rejected. [Receipt](../../../baselines/character-mmo/material-texture-attribution-2026-10-08/receipt.json),
[retained native evidence](../../../baselines/character-mmo/material-texture-attribution-2026-10-08/evidence.json.gz),
[bounded Grok review](../../../baselines/character-mmo/material-texture-attribution-2026-10-08/grok-review.md).

## Correction

Each native `loadTexture2D` call now supplies its actual remapped URL, material
name and sampler to the existing `Error.cause` helper. Starter surfaces retain
material preparation context without assigning their primary URL to every
failure. Optional full-resolution enhancements name their own source URL and
sampler. The helper moves into a renderer/catalogue-independent leaf so offline
world generation does not import the character request graph.

Lite still owns its native fetch, image preparation, upload and promise cache;
no additional request, cache or retry is introduced. Source comments link the
[pinned Lite implementation](https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/packages/babylon-lite/src/texture/texture-2d.ts)
and [native cause semantics](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error/cause).
The pure startup groups include the new leaf and the existing
`equipment-resources.js` selector. Both default and coalesced builds retain their
strict renderer/storage exclusion guards.

Native world preparation updates only manifest provenance. All twelve geometry
and texture payloads are byte-identical, and the complete scene manifest is
identical excluding provenance. Character/equipment assets, shader code, texture
options and loading order are unchanged.

## Verification

The retained attempts include three initial build failures: stale material
provenance, the new leaf missing from the coalesced allowlist, then the existing
pure resource selector missing from the default chunk group. Each is corrected
without relaxing a guard. Attempt 3 passes seven native cases. Attempt 5 passes
all **20 resource/asset/prefetch tests** and both default/four-flag builds, then
stops because the capture clicked an ambiguous `Technical details` label.
Scoping that QA click to `#loading-error summary` fixes the harness.

Attempt 6 reuses the successful candidate build and exits **0, seven of seven**:

| Control | Observed result |
| --- | --- |
| Legacy shared detail abort | Aborting `876257499921.webp` incorrectly names primary `b999b46aa8e9.webp`. |
| Candidate albedo abort | Exact `6dc86c298450.webp` URL and `albedo` sampler. |
| Candidate shared detail abort | Exact `876257499921.webp` URL and `stoneDetail` sampler. |
| Candidate shared paving abort | Exact `b999b46aa8e9.webp` URL; its other albedo consumer wins the shared rejection. |
| Candidate sky abort | Exact cloud URL/sampler and preserved native cause. |
| Optional enhancement abort | Exact original ground JPEG URL/sampler; playable Havok remains active with zero recoveries. |
| Ordinary movement | Actual W input moves 4.886 m; Havok active, zero recoveries, page/console/GPU errors empty. |

Required failures retain the loading/retry fence and the native `Failed to fetch`
cause. All seven cases have no uncaptured GPU errors. Shared resources can reject
several consumers; the checker does not invent a deterministic `Promise.all`
winner. Product fingerprints before/after the final run match. Every case owns
and closes one fresh native Chrome process at 1280×720/DPR1; both local servers
are stopped. User Edge/Orca and the discarded Shadowglass page remain untouched.

Root reviewed the actual expanded [old error UI](../../../baselines/character-mmo/material-texture-attribution-2026-10-08/legacy-shared-detail.png),
[corrected error UI](../../../baselines/character-mmo/material-texture-attribution-2026-10-08/shared-detail.png)
and [ordinary running game](../../../baselines/character-mmo/material-texture-attribution-2026-10-08/normal-movement.png).
Long preformatted lines exceed the visible details width; exact URL/sampler
checks use the full native DOM text retained in the evidence. These are
functional captures of unchanged art, not a new visual milestone or timing claim.

## Historical limit and next action

The failed maximum-uncovered preview row names the ground albedo through the old
wrapper. Its ground albedo, detail and paving parser preloads all report HTTP
200. That does not establish which native application read failed, and the new
controlled counterexample does not prove that the historical detail map failed.
Keep the original failed row and release hold. No speculative retry or another
unchanged public campaign follows this diagnostic correction.

The sky retains an outer sky-preparation context and inner cloud-sampler context
for the same URL. This repeats wording, preserves the native cause and performs
no second fetch; it does not justify another implementation/verification cycle.

Next correct a demonstrated request/body cause before declaring and qualifying
a new release candidate. Current physical iPhone acceptance, streaming/audio
tails, the original 14/60 failures and the 362 ms input upper-bound outlier remain
open. No production promotion, cold-start budget or new FPS measurement ran here.
