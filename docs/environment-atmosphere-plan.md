# Environment / atmosphere pass — targeting the Elden Ring reference bar

Branch `env-lighting`, worktree `.claude/worktrees/env-lighting`, base `b69611b` (main).
Harness slot 8: Vite 5973, CDP 10137.

## 1. What the references actually do

Seven Elden Ring stills in `docs/references/impressive-landscape-scenery-samples/`.
Reviewed all seven. The shared vocabulary, in rough order of how much of the
"AAA" impression each carries:

1. **Aerial perspective.** Distance = desaturation *and luminance lift toward the
   sky colour*. Four to six readable depth layers in every shot. Fog pools in
   valleys; ridges emerge out of it.
2. **One dominant warm key against a cool ambient.** Golden sun / Erdtree light,
   blue-teal shadow. A complementary split, not a single grey lamp term.
3. **Volumetric shafts** from that single source through the haze.
4. **The character is a dark silhouette** against a bright hazy background, with
   a rim light describing the edge. `image copy 4.png` is literally our
   over-the-shoulder gameplay framing.
5. **Sky occupies 40–60 % of frame** and is a major light contributor: layered
   gradient plus lit cloud, not a flat dome.
6. **Bloom on the source** plus emissive accents (embers in `image copy 5.png`).
7. **Muted limited palette, filmic tonemap, lifted blacks** — never pure black
   (`image copy 6.png` is the extreme).
8. **Silhouette landmarks at distance** as focal anchors — spires, viaducts.
9. **High-frequency detail only in the foreground.**

We already have 8 and 9 (`horizon.js` builds spires, viaducts, mesa keeps;
`foliage.js` thins with distance). Everything else is missing or inverted.

## 2. Baseline, measured

`node scripts/ashen-reach/capture-vistas.mjs --tag baseline`, 12 fixed cameras at
ordinary gameplay framing, 1280×720 →
`ve-capture/ashen-reach/env-lighting/baseline/`.
Scene: 127 145 tris, 15 draw batches, 90 818 foliage instances.

What the stills show, and the line of code responsible:

| Defect | Cause |
| --- | --- |
| Distance **darkens** to near-black; no readable depth layers (`10-ridge-west`, `07-north-overlook` are mud) | `FOG=[.080,.099,.083]` in `materials.js` is darker than everything it fogs, and the term is pure distance |
| Hard black band at the horizon (`12-wide-south-vista`, y≈255–275) | the sky dome shader never applies the fog term, so ground→fog and sky→dome meet at a seam no colour choice can hide |
| No form on any surface; everything reads flat | `directional=.62+.38*abs(dot(n,L))` — `abs()` lights a back-face identically to a front-face |
| No warm/cool split | key and ambient are the same grey; the only colour is the lamp term |
| Highlights clip flat (`04-town-gate-vista` towers are one yellow), shadows crush to 0 | no tonemapping on world materials; `toneMappingEnabled=false` |
| Player merges into the background (`01`, `12`) | no rim light |
| No bloom anywhere | no post-process chain on the gameplay scene |
| Sky is a featureless dark lid | `sky()` is a 2-stop gradient over one cloud texture, unlit |

Every one of these lives in the shader/material layer, not in the world builder.
`scene.js` places good content; it is lit badly.

## 3. Plan

Art direction: keep Ashen Reach's identity, but move the time of day from "flat
night" to **blue hour** — sun just below the northern horizon, behind the Citadel
of Vaelmark. That buys every reference trait at once: a bright hazy band for
landmarks and the player to silhouette against, a grazing warm key that rims
ridges, a cool sky ambient that makes the existing warm lamps read as
complementary accents, and a sky worth looking at.

- **A. Atmosphere core.** One shared WGSL block exported from `materials.js` and
  injected into `surface()` *and* `foliage.js` so they cannot drift:
  `skyColor(dir)` (analytic zenith→horizon gradient + warm sun lobe),
  height-fog + distance integral mixing toward `skyColor(viewDir)`, and a filmic
  curve with lifted blacks. Fixes defects 1, 2, 5 and 7 above.
- **B. Lighting model.** Real `saturate(dot(n,sunDir))` key, hemispheric ambient
  (sky tint from above, ground bounce below), Fresnel rim tinted with the key.
  Fixes 3, 4, 6.
- **C. Sky rewrite.** Drive the dome from the same `skyColor(dir)`, so the
  horizon seam is gone *by construction* rather than by tuning. Cloud texture
  lights from `sunDir` with a warm rim on the sun side.
- **D. Post chain.** Scene render target → `createBloomPostProcessTask` →
  present, following the pattern already working in
  `src/character/preview/studio.js`.
- **E. Depth-layer content.** Mist bands pooled at valley height so ridges
  emerge from them (reference trait 1), and light shafts at the gate lamps
  (trait 3).

## 4. The z<=40 churchyard invariant

`materials.js`, `geometry.js` and `scene.js` all carry comments promising the
churchyard south of z=40 stays byte-identical. That invariant existed so earlier
milestones could diff cleanly. A scene-wide art-direction change cannot honour it
and shouldn't: keeping the churchyard on the old flat-night model would make the
starting area the worst-looking part of the map. **This pass deliberately
supersedes it**, globally. The `nightGrade` / `lampGate` z-gates stay as
*regional* grading (town warmer than graveyard), they just no longer imply
byte-identity.

## 5. Verification

Re-shoot all 12 vistas with `--tag <step>` after each phase and compare against
`baseline/` at identical cameras — per
`compare-stills-only-after-pinning-build-and-framing`, the before shot is
re-taken from the tree, never recalled. Watch `sceneTriangles` and the uncapped
frame cost, not the vsync-capped FPS number.

## 6. Log

(appended as work lands)
