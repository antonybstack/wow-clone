# G02 source review — approach / portal / arch omit

**Verdict: no blockers.** Up to 3 material defects: none.

Reviewer: Grok 4.6/high. Working tree as of this review. Parent owns implementation, browser, captures, performance, and release. This is source review of generated triangles and CPU tests; it is not visual acceptance.

## Scope

Read `docs/CURRENT.md` and Gothic plan **G02 only** (`docs/plans/gothic-exploration/plan.md` Following slices). Diff reviewed:

- `src/ashen-reach/gothic-cathedral.js`
- `src/ashen-reach/dev-tools.js`
- `scripts/test-gothic-cathedral.mjs`

`cathedral-exploration.js` and `cathedral-undercroft.js` are unchanged; they consume the shared `arch` / `prism` helpers. Unrelated `AGENTS.md` and `docs/plans/character-mmo/next-ten.md` edits were left untouched.

## Method

- Built live `buildGothicCathedral` batches and the HEAD `gothic-cathedral.js` (current exploration/geometry/buildings) for triangle counts.
- Möller–Trumbore on the **returned collision triangles** and on isolated closed-vs-omit arch meshes (same `pointed` / `prism` / `solid` winding as production).
- Re-ran `node --test scripts/test-gothic-cathedral.mjs`: **14/14 pass**.

## Arch joint-cap omit

`arch()` now omits radial faces 1 and 3 on interior voussoirs (`gothic-cathedral.js` `prism(..., omitEdges)`). Caps at ±depth, inner soffit, outer extrados, and the two imposts remain.

Isolated default 20-segment arches (240 closed tris → 164 omit, **76 saved**):

| mesh | interior joint tunnel (closed hits / omit misses) | exterior crease hits (closed = omit) |
|---|---|---|
| portal ring | 17 / 18 | 18 = 18 |
| bridge arcade | 14 / 18 | 18 = 18 |
| undercroft vault | 15 / 18 | 18 = 18 |
| chapel door | 16 / 18 | 18 = 18 |
| altar window | 17 / 18 | 18 = 18 |

Interior tunnels through omitted joints are present (expected hollow stone). Exterior rays at the extrados crease still hit every sample; soffit and extrados coverage matched the closed solids (11/11 and 10/10). No exterior miss where the closed solid hit.

Live collision:

- Undercroft vault: 255 upward samples over x∈[−11,−3], z∈[324,338], **0 misses**; hit Y 39.96–43.92 (`floorY−5.6` chamber).
- Bridge arcade soffits at four bays × two sides: **8/8 hits**.
- Chapel doorways at x=±12, z=328: open at h=1 / 3.5 / 4.7; jamb solid at z=326.

Shared `arch` therefore changes G01 vaults/doors as well as G02 rings. CPU route tests that consume those meshes still pass (undercroft circuit, chapel capsule clearance, altar aperture).

## Facade recess, shoulders, rear wall

Replacement of `wall([side*8, floorY+12, 304], [8,24,1.8])` with recessed back wall, inner/outer shoulders, plinth, and collision spandrel.

Dense collision rays, both sides, x∈[4.05,11.95] step 0.25, h∈[1,23] step 0.5 (**2880 samples**): **0 through-holes** 301→306, **0 rear misses** 306→303. Front hits all face −Z (incoming from the approach).

Lancet grid x∈[6.2,9.8] step 0.2, h∈[7,16] step 0.25: **0 nave leaks**.

Measured front planes (exact on these samples):

- Recess at |x|≈8.5, h 8–15: **z=303.9** (52 hits)
- Outer wall |x|≈11.1, h 8–15: **z=303.1** (26)
- Portal shoulder |x|≈4.9, h 8–15: **z=302.3** (52)
- Plinth |x|≈8.5, h 1–6: **z=303.1** (44)
- Pointed head |x|≈8.5, h 22–23: **z=303.1** (12)
- Nave-facing plane at h∈{1,5,8,11,16,20,23}: **z=304.9** (64/64 per height)

Shoulder inner face is at **|x|=4.00** (`4.95−0.95`). Approach |x|≤3.99 at h∈{0.3,1,1.8} from z=299→308 is clear. Default capsule radius 0.28 / test padding 0.38 at x=±3.62 is clear. First solid at |x|=4.00 is z=302.3 (projecting shoulder). The 8 m portal width is unchanged; the jamb is 0.8 m further south.

At gallery height h=8.5 / 9, rays that start at z=306 first hit the **existing** gallery south rail/platform (`platform(0,8.5,307,17,2)` and rail at z=306). That is pre-existing G01 geometry, above the portal arch tip (y=8). Facade rear at h=11 remains 304.9 with outward winding.

## Budget

G02 asked for geometry savings before adding masonry. Counts from the same builder:

| | render | collision | headroom vs 60k / 15k |
|---|---|---|---|
| HEAD | 59826 | 14600 | 174 / 400 |
| live | 53398 | 13556 | 6602 / 1444 |
| delta | −6428 | −1044 | |

Omit savings more than cover the new shoulders, recesses, and trim.

## Other diff

`dev-tools.js`: failed click-teleport now calls the existing `message()` helper (`getCombat()?.hud?.message`). Previous `combat.hud` was unbound in `tick`. No cathedral geometry effect.

New CPU test `blind facade lancets have real recess depth and retain a solid interior wall` matches the planes above (1e-6).

## Limits

- No browser, Havok, prepared-packet regeneration, FPS, or live clip.
- Ray tests are two-sided CPU Möller–Trumbore on authored triangles; engine one-sided filtering and contact generation were not run.
- Interior voussoir cavities are real; this review only shows they are closed from the exterior on the sampled crease/soffit/extrados/impost rays.
- HEAD triangle compare swapped only `gothic-cathedral.js`; exploration helpers were already current and have no G02 diff.
- Capsule used 0.28 (default) and 0.38 (existing tests); no physical walk.
- `PORTAL_TRIM` colour and shaft x 8.8→10.45 were not judged visually.
- Gallery z=306 contamination at h≈8.5 is documented so it is not mistaken for a new facade hole.
