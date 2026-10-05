# M5 startup packaging review and disposition

Reviewer: Grok CLI `grok-4.6`, high effort, session
`01a10a53-5536-7eb2-99e1-c90064e2336d`. Read-only, no browser or worker checkout.
The final report is preserved in
[the baseline](../../baselines/character-mmo/m5/isolated-timing-2026-10-05/grok-review.md).
Its last source reads preceded several corrections; it did **not** independently
accept the final build, cold/FPS cohorts or pixels. Parent verification below is
separate from that review.

| Finding | Disposition and evidence |
| --- | --- |
| Selected prefetch checks request sharing but not the actor | Valid. The built-page helper now checks real root height, two native morph weights, body/eyes/brows visibility, covered ponytail visibility and the exact 22 playable groups at first play. |
| Default leak check omits identity modules/assets | Valid. It now includes both identity manifest and loader URLs, alongside shape/storage URLs. |
| Compiled identity provenance has no build assertion | Valid. The real source-owning identity chunk must contain the current seal; its static closure and the storage closure must be independent of Lite, main and shared-region code. The actually-hit stale-identity live case also refuses play. |
| Stale-identity wait says `updated`, error says `changed` | Corrected before the final passing run. The helper accepts the actual `updated|changed` refusal and requires a nonzero manifest interception count. It does not invent a new runtime error. |
| Only a hooded ponytail pilot was measured | Covered by the final 20-run exposed-ponytail cohort as well as the hooded cohort. Native first-play mesh visibility and source descriptors are recorded. |
| Dynamic boot group has no `test` | No confirmed defect. Rolldown explicitly supports a dynamic `name(id, context)` selector. The group uses only the ordinary main entry's static application graph; the earlier pure groups take precedence. Default and native Pages outputs need their own receipts. |
| Three pilot starts do not prove the cold gate; first-use GPU tail is unresolved | Agreed. Six final 20-run local cohorts are retained separately from all pilots. Fresh process/profile does not clear OS/GPU-driver caches. The earlier 2,930 ms row remains unexplained and is not erased by later passing runs. Public CDN/phone acceptance remains separate. |

The parent also caught and corrected an actual early-import regression: moving
`coverage-manifest` into the GPU-dependent boot chunk made selected-body discovery
wait for Lite. It belongs in the pure `appearance-common` group. The held-Lite
selected case now finishes the exact saved body request while `ASHEN` is still
absent. Native execution ordering creates entry facades, so build guards follow
the native chunk graph while retaining **exactly one source owner** for each
shared startup loader; they do not require a facade to contain implementation.

The changes reuse [Rolldown groups](https://rolldown.rs/reference/TypeAlias.CodeSplittingGroup)
and [native graph information](https://rolldown.rs/reference/Interface.ChunkingContext).
They add no second module loader, cache, animation mixer or skinning path. The
ordinary compressed build passes all ten live prefetch cases, eight saved-identity
cases, three desktop mobile cases, 200 character tests and ten focused startup
tests. See the result for exact build scope, media/isolation limits and outstanding
production gates; this bounded review does not close M5.
