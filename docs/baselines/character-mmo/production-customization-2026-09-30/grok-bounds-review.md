# Bounds / texture-upgrade review — production customization 2026-09-30

Read-only. Compared `local-light-bounds.js`, `local-lights.js`, `sun-shadows.js`, `startup-assets.js` `upgradeStarterCharacter`, `main.js` call sites, `test-local-light-bounds.mjs` against installed Lite 1.31.1 `enable-morph-target-shadows`, `enable-skeleton-shadows`, `texture-acquire`/`texture-release`, `rebuildMaterial`.

## Verdict

Morph range selection matches Lite’s signed-weight extent rule and is conservative for the production Human (one axis, rest `boundMin`/`boundMax`, then existing bone/world union). Native morph bounds are correctly composed onto skeleton bounds on CSM and both local PCF generators. One reachable lifetime gap remains on the late texture upgrade after family commit.

## High-impact finding

### 1. Body abort does not stop the follow-on garment upgrade

`src/ashen-reach/main.js:665-666` and `src/ashen-reach/equipment-stream.js:266-270`, `357-358`

After family commit, texture detail is:

```js
void (async () => {
  await upgradeStarterCharacter(..., () => lifetime.aborted || body.container !== detailContainer);
  await detailEquipment.upgradeTextures?.();
})()
```

`upgradeStarterCharacter` returning early is success. `upgradeTextures` then still runs. Garment abort is only `() => dead` (`equipment-stream.js:269`). Scene abort and `body.container` change do not set `dead`.

This upgrade is outside `actorRequest`. `switchRace` can `swapSource` (container already Orc) while `detailEquipment` is still the live Human pack, then dispose it. Checkpoints in `startup-assets.js:74,92-94` do not run during `await rebuildMaterial` (`material-rebuild.js:8-14,22-23` walks `scene.meshes` and may import a runtime mesh build).

Lite `acquireTexture` / `finally { releaseTexture(texture) }` (`startup-assets.js:90-99`) correctly drops the temporary owner at those checkpoints. It does not cancel an in-flight rebuild, and it does not cover the second call.

**Fix:** One abort predicate for body and garments (`lifetime.aborted || body.container !== detailContainer || impl !== detailEquipment`). If the body upgrade returns early, skip `upgradeTextures`. Do not start `rebuildMaterial` when the predicate is already true; join this job with `actorRequest` or set `dead` as soon as the pack is superseded.

## Not defects (for this change)

- **Unknown morph still included.** Empty `{}` / non-integer `count` / non-finite weights return null and include (`local-light-bounds.js:13-15,28,117-119`). Same policy as VAT/thin-instance. Tests in `test-local-light-bounds.mjs:119-125,248-263`. Unsupported/malformed fallback, not an under-include of a well-formed Human.
- **Signed extents vs native.** `min += w * range[w<0 ? 1 : 0]`, `max += w * range[w<0 ? 0 : 1]` matches `enable-morph-target-shadows.js:45-54`. Local cache also invalidates replaced `target.positions` (native only checks `targets` array identity). Over-include vs native per-bone vertex boxes is the existing skin union.
- **Generator wiring.** `enableSkeletonShadows` then `enableMorphTargetShadows` (`local-lights.js:43`, `sun-shadows.js:113`). Morph is provider index 1; skeleton `getLocalBounds` reads previous morph via `getPreviousDeformableShadowBounds` (`deformable-shadow-casters.js:5-12,68-88`). Local selection uses source meshes (`local-lights.js:70`), not the shadow proxies.
- **Crowd / VAT.** Explicit unknown-include (`local-light-bounds.js:58-60,116`). Out of scope.
- **Starter `texturesP` path.** `main.js:567-569` still requires `body.container === starterBodyContainer` before upgrade. Unchanged.

Parent stout 195–234 FPS and cached far lamp maps are consistent with well-formed morph meshes no longer taking the unknown-include path.
