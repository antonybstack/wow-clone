# Review disposition — M5 candidate identity contract

Parent disposition, 2026-10-04: the review below describes the checkpoint **before**
the actor-generation and cancellation correction. Grok 4.6/high ran read-only;
the first 10-turn run reached its limit, and a four-turn resume produced the report.
It started no game instances and changed no product files.

The queued replacement defect is valid and corrected. The session now requires
`getActorGeneration`, captures its owner generation, rejects stale queued work,
passes a native AbortSignal plus `throwIfStale` to staging, checks ownership again
before recording success, and never restores undo history for a retired editor.
The live actor integration must supply a generation that advances on race/actor
replacement and invoke the guard **before visual commit**; a same-race replacement
must also advance it. Dispose the session with its editor. Identity, dye, shape
and detail edits on the same logical actor must not advance this owner generation.

Regression controls cover queued Human → Orc → Human, same-race replacement,
staging disposal, and replacement during undo. Production v6 storage/presence
refusal is also covered. Historical v5 is now constructed independently, and
v2–v4 derive their profiles from it, so activating the current registry cannot
make historical catalogues inherit head/hair capabilities. The explicit released
starter reset is a harmless canonical `{}` no-op on v5.

This is contract verification, not saved-identity or live visual acceptance.
[Implementation and remaining gates](../../plans/character-mmo/m5-saved-identity-2026-10-04.md).

---

# M5 identity-contract review — 2026-10-04

Read-only review of the working-tree identity vocabulary / identity-only undo checkpoint. No live identity transaction is claimed or demanded. Parent verification (175 character / 112 equipment / 6 startup-prefetch / 5 presence / production build) is taken as given.

## Summary

The candidate catalogue is a closed four-preset vocabulary on v6, production stays v5, v1–v5 records still cannot grow head/hair fields, and the v4 storage-decoder omission is actually closed. Failed `applyIdentity` does not mint undo, and a later shape/equipment/dye edit survives identity undo.

One ownership hole must be closed before the actor is wired: queued identity jobs are not bound to a generation, so a Human→Orc→Human replacement lets a pending `set` land on the new Human.

v5 `getAppearance()` plus an explicit candidate registry throwing `UNSUPPORTED_CATALOG` is the intended opt-in, not a production-path leak. There is no live caller yet.

## Proven defects

### 1. Queued identity apply survives a race round-trip

- **File:** `src/character/creator/production.js:19-40`
- **Trigger:** `createProductionIdentitySession` with the candidate registry and a v6 Human. Call `set('prime-bald')` without awaiting. Synchronously replace appearance with a migrated Orc, then with a fresh migrated Human starter. Await the pending set.
- **Practical effect:** The new Human becomes Prime bald (`components: {head:'human-prime-v1',hair:'human-bald-v1'}`) and `canUndo` is true. Identity chosen for the previous body is written onto a different character. The existing race test only swaps race after `set` has settled, then reads `canUndo`, so it never sees this.
- **Proof:** same sequence in-process: `selected=prime-bald`, `race=human`, undo armed.
- **Smallest correction:** Increment an epoch in `refresh()` whenever `getAppearance().race` changes. Capture the epoch (and `'human'`) at `set`/`undo` queue time. At the start of `commit`, and again after `applyIdentity` returns, abort without recording undo if epoch or race moved. Human→Orc already fail-closes when the job first runs as Orc; the round-trip is the case that currently writes.

Root cause is `refresh()` comparing only the current race string to the last seen value (`production.js:19`). If the job runs while the actor is Human again, `race === 'human'` and the captured preset is applied. The same comparison also leaves a queued job live across Human A → Human B with no Orc in between. Bind the job to the epoch, not to “currently human.”

`undo()` has a related restore path (`production.js:42`): it pops, then on `commit` failure pushes the entry back. If race became non-human between the pop and the throw, that push can re-arm identity history on the new race until a later `refresh` sees another race change. The epoch check belongs in `undo()` as well: if epoch moved, drop the popped value rather than re-pushing it.

## Not defects (deliberate / already closed)

- **Candidate registry is opt-in.** `validateAppearance(identityRecipe)` and `decodeMigratingAppearance(v6Text)` against production throw `UNSUPPORTED_CATALOG`. `createProductionIdentitySession` defaults to `APPEARANCE_REGISTRY`. `set('prime-bald')` on a v5 appearance with the default registry is `UNSUPPORTED_PARAMETER` and does not call `applyIdentity`. A caller that passes `APPEARANCE_IDENTITY_REGISTRY` and a still-v5 getter will see `UNSUPPORTED_CATALOG` until that caller migrates; that is the next package’s actor boundary, not a current production write.
- **Unknown schema codes.** `migrateAppearance` now rejects `schemaVersion` other than 1 or 2 with `UNSUPPORTED_SCHEMA` (`contract.js:214`) before the legacy allowlist. Unknown catalogues stay `UNSUPPORTED_CATALOG`.
- **v4 storage.** `decodeMigratingAppearance` / `loadAppearance` migrate a valid v4 record, keep the original bytes until save, and refuse a v4 document with dyes (`UNSUPPORTED_PARAMETER`) while preserving the stored text.
- **Historical component domains.** v1–v5 still have empty `capabilities.components`. Injecting Prime/Weathered components is `UNSUPPORTED_PARAMETER` on every historical registry.
- **Vocabulary.** Four presets only; starter canonicalizes to `{}`; mixes, partial objects, `age`, URLs, accessors, and `__proto__` are refused; Orc/Undead cannot carry Human identity; recipes contain identifiers, not asset URLs.
- **Failure / later edits.** Injected `applyIdentity` refusal leaves encoded appearance unchanged and does not push undo; a failed undo re-pushes. Shape, `lectorCoat`, and `indigo` survive identity undo.
- **Flags and parked multiplayer.** `HUMAN_SHAPE_CAPABILITIES.faceOrAge` / `hair` remain false. `APPEARANCE_CATALOG_VERSION` is still `appearance-catalog-v5`. Presence handshake already rejects `appearance-catalog-v6`. `validatePresenceAppearance` uses production `validateAppearance`, so a v6 recipe cannot seat.

## Missing tests

- **Race change across a queued `set` / `undo`**, including Human→Orc→Human and Human A→Human B. The current race test only mutates after settlement.
- **`loadAppearance` of a v6 identity record.** Probe: `restored:false`, warning `UNSUPPORTED_CATALOG`, original bytes kept. Behavior is correct; it is not in `scripts/test-human-identity-recipe.mjs`.
- **In-flight `applyIdentity` then race change**, asserting no undo record and no successful history on the new race.
- Presence *recipe* (not only handshake catalog string) carrying Prime/Weathered components. Handshake coverage exists; an appearance-request row would lock the ownership boundary the parked protocol relies on.

## Future integration (do not block this checkpoint)

- The live transaction must treat canonical `{}` as the released starter mesh, including undo-to-starter. The session correctly passes `{}` after validate.
- When promoting v6, freeze v5 as a copy with empty component capabilities. `APPEARANCE_V5_REGISTRY=APPEARANCE_REGISTRY` is a valid alias while production is v5; it will inherit identity if the production object is edited in place. v2/v3/v4 snapshot `APPEARANCE_REGISTRY.profiles` at load and must keep `components:[]` when that object grows.
- Do not point `store.js` or presence at `APPEARANCE_IDENTITY_REGISTRY` until selected-startup acceptance. Dye/body sessions still validate against production v5; they need a registry argument only when committed appearance becomes v6.
- Production creator still exposes independent disabled age/hair controls. Activation must offer the four presets, not those two axes (Weathered+ponytail is not a reviewed identity).
- `selected` reports `'starter'` for any Human `{}` even on the default v5 registry. Harmless while unwired; gate it on `registry.profiles.human.capabilities.components.length` when UI reads it.

## Verdict

Integrate the v6 vocabulary after fixing defect 1. Production paths remain v5-compatible. The live identity transaction, compact startup, and capability flags are the next package.
