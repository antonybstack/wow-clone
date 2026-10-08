# Attempt 6 — scoped details click, seven native cases

One `run-ops-6.mjs` run, CLI 0. Reused attempt-5 `candidate-dist` and root `dist/`. No rebuild. Attempts 1–5 kept. Controlled abort attribution holds. This does not prove the historical failed URL/stage/cause, timing, or lift the release hold / phone gate. Parent owns acceptance.

## Ops

Controller **28987**. Product sha256 `e483292800300ceca1ac25767bd87b1359519c871c01b32db9df0d611dc67de3` unchanged (1229 files, 7 uncommitted).

| step | pid | exit | notes |
|---|---|---|---|
| baseline-server :7076 `dist` | 29034 | SIGTERM | owner grok-material-attribution, CDP 0 |
| candidate-server :7074 attempt-5 candidate | 29056 | SIGTERM | same |
| native-controls | 29058 | 0 | 7/7 |

Chrome PIDs 29072, 29107, 29169, 29201, 29239, 29271, 29813 each opened and closed. `gpuErrors` empty.

## First lines vs abort

**Legacy** abort `texture-876257499921.webp` (stone-detail):

`Error: Startup resource …/texture-b999b46aa8e9.webp: surface Timeworn limestone preparation failed: Failed to fetch`

Old wrapper names limestone albedo.

**Current shared-detail** same abort:

`Error: Surface Moss and burial earth preparation failed: Startup resource …/texture-876257499921.webp: material Moss and burial earth sampler stoneDetail preparation failed: Failed to fetch`

Outer material name, inner actual hashed URL and `stoneDetail`.

Albedo names `texture-6dc86c298450.webp` / `albedo`. Paving abort `texture-b999b46aa8e9.webp` reported Timeworn limestone `albedo` (`Promise.all` winner). Enhancement: unhashed `/tex/forrest_ground_01/diff.jpg` / `albedo enhancement`, playable Havok stayed. Movement: z +4.89, recoveries 0, usingPhysics true, page/console errors empty.

**Sky** still nests `sky preparation` around `sampler cloud preparation` for `texture-4b862185d5f5.webp`. Same URL twice; extra wording, not a second fetch policy.

Native `Failed to fetch` remains `Error.cause`.

## Captures viewed

Both error stills have `#loading-error` Technical details open. Legacy visible line starts `Startup resource /ashen-reach/startup/starter/texture-` (limestone albedo path, not the aborted detail file). Current visible line starts `Surface Moss and burial earth preparation failed`. Inner hashed URL/slot is clipped in the bitmap; full chain is in `native.json`. Normal-movement still is the playable churchyard walk (Grave Shade, HUD). Parent accepts screenshots.

## Tiny product / grouping (frozen this run)

`startup-resource-error.js` is try/catch `Error.cause` only. `materials.js` imports that leaf. `startup-fetch.js` re-exports it. Coalesced `savedStartupModules` and non-coalesced `startup-bootstrap` regex include the leaf. `equipment-resources.js` sits in default `appearance-common` so early preload does not import the renderer chunk. Attempt 5 already built both modes; this run did not rebuild.

## Cleanup

Owned PIDs listed above are terminal. Ports 5173/7074/7076/10037 idle. Edge 2931 and Orca 98938 untouched. Worker wrote only this cache tree.
