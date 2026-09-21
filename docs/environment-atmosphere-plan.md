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

Captures live in `ve-capture/ashen-reach/env-lighting/<tag>/`, all 12 cameras,
1280x720, identical framing by construction (`capture-vistas.mjs`).

### `baseline` -> `p1-atmos` -> `p2-grade` -> `p3-silhouette` (commit `ff0af06`)

Phases A-C. `atmosphere.js` added as the single source of truth; `materials.js`
(`surface` and `sky`), `foliage.js` and `main.js` all read from it. The horizon
seam is gone by construction: the dome and `aerial()`'s inscatter both call the
same `skyColor(dir)`.

`01-churchyard-spawn` reached the reference vocabulary at `p3` — layered aerial
depth, citadel as silhouette in warm haze, backlit trees, player reading dark
against the glow.

**Wrong diagnosis, corrected.** Three pale faceted bands across the upper frame
of `07-north-overlook` were attributed to a cloud/aerial mismatch: the dome is
cloud-darkened and `aerial()` cannot sample the cloud texture, so a far ridge
should read as a pale slab over a darker sky. The horizon-clearing `deck` term
in `sky()` was added to fix that. **It did not**, and neither did dropping
`FOG_MAX` 0.90 -> 0.80; the bands were unchanged through `p2` and `p3`. The
hypothesis was wrong. `deck` is kept because a thinning deck at the horizon is
correct anyway, but it fixed nothing.

**What the bands actually were.** Two mesh-identification probes failed before
one worked, and both failures are worth recording because they look like
evidence:

- `mesh.isVisible=false` produced 32 byte-identical images. The flag does not
  affect rendering on this engine.
- Splicing the mesh out of `scene.meshes` produced 32 byte-identical images too.
  The draw list is cached elsewhere.

What worked was tagging: patch `surface()`, `sky()` and `foliage.js` to return
flat per-material colours and re-shoot. That answered it in one frame — at
cameras `04` and `07` **there is no sky in frame at all**, and every pixel above
the grass is `surface()` geometry. A second pass with a per-material palette
identified it as `Moss and burial earth`, i.e. the far terrain.

Measured from the `07` camera:

| | angle above horizontal |
|---|---|
| far-terrain silhouette (`distantRelief` rim) | **25.3 deg** |
| tallest ridge ring (`horizon.js`) | 24.5 deg |
| top of frame | 17.5 deg |

`distantRelief`'s 92 m bowl rim was taller than the mountains it was supposed to
sit behind, so it occluded the whole skyline and every pixel of sky. Every
northward vista was a fogged basin. The "mist banks" were that wall.

`rim = 92/(1+exp(-(d-120)/32))` -> `46/(1+exp(-(d-210)/60))` puts the earth
silhouette at 10.6 deg, under the rings, restoring ground / foothills / ridge /
sky. `distantRelief` is zero inside the playable rectangle, so no in-bounds
pixel and no collider moved.

### `p4-skyline` -> `p5-fogdepth`

With the sky back, the ridge rings became the brightest thing in frame: at
`FOG_MAX` 0.80 they kept only a fifth of their own near-black stone. Density
0.0165 was also ~70% saturated by 80 m, so the mid ground greyed out at the same
rate as the horizon and the picture had two depth layers instead of five.
0.0085 / 0.62 separates near / mid / far / ridge / sky. `10-ridge-west` is the
clearest read: the near ridge is now a dark silhouette against pale haze.

### `p6-bloom` -> `p7-bloomtune` -> `p8-vignette` (commit `2efd3d8`)

Phase D. **The first bloom did nothing.** `ASHEN.post` reported `bloom:true`,
and p5 -> p6 showed a mean abs diff of 1.9 — but a *same-binary control run*
(`zz-control`) puts the animation noise floor at 0.62, and raising weight
0.34 -> 2.5 moved the picture by only 2.0. The material shaders already tonemap
to display range, so nothing cleared a 0.78 threshold. 0.55 / 0.65 / kernel 64
moves it by 11.2 against the same control and the glow through the bare branches
is plainly visible. Task creation is not evidence of reaching the screen.

Vignette is a composited overlay (`#vignette`), not a task — Lite has no
vignette post-process, and the in-shader one this pass removed was x-only
against a hardcoded 960 width.

### Cost

Unchanged across every tag: 127145 world triangles, 15 draw batches, 90818
foliage instances, 422555 scene triangles.

Frame cost is **not measured**, only bounded. GPU timestamp readback returns
zero samples through the frame-graph path, and at 2560x1440 both `?noPost` and
the full chain sit exactly on the 144 Hz vsync cap (6.944 ms). That is a floor:
it says the post passes fit inside the remaining headroom, not what they cost.

### Tests

`test:equipment` 47/47. `test:character` has 8 failures; the same suite fails at
the base commit `b69611b` (9 failures there) and this work touches no character
file, so they are pre-existing and unrelated.

### Still carried

- **Phase E is not started** — no mist bands pooled at valley height, no light
  shafts at the gate lamps.
- `12-wide-south-vista` has a hard dark horizontal band at y≈255-285. It is the
  `valley` trough in `distantRelief` (a uniform ring at d=48) reading as a
  stripe. Not diagnosed further.
- The ridge rings read as flat cardboard at `10-ridge-west`: `ridgeRing` uses
  36-48 segments over a 230-500 m radius, so each quad spans 30-80 m with a flat
  top edge.
- `07-north-overlook` still shows no sky, because the rings span ~10-24 deg and
  the frame tops out at 17.5 deg at that camera's pitch.
- `04-town-gate-vista` is very mustard; the limestone tint may be over-saturated
  against the new warm key.

## 7. Delivery pass (p9 + motion)

**The bar across the south vista was mine, not inherited.** §6 listed "the hard dark
band at y≈255-285 in `12-wide-south-vista`" as a carried defect and guessed at the
uniform `valley` trough ring. That guess was wrong, and the correction matters because
it changes who owns the defect. A material-tag probe at the shot-12 camera returned the
band in *green* — `Distant black stone` — so it was never terrain at all. It was the
three `scarp()` calls in `horizon.js` at radius 128 around (0,40).

A scarp is a downward curtain: quads from `groundHeight+1.5` down to `groundHeight-drop`.
It reads as a cliff **only where the ground beyond it is lower**. They were authored
against the first bowl rim, which reached 92 m by d≈120, so r=128 put them on a real
edge. The rim change in §6 — half the height, arriving twice as far out — left them
standing on flat ground (the measured profile at x=0 runs −0.8 m at z=−100 and does not
begin climbing until z≈−112), where the 1.5 m lip is a fence in front of a rising slope.
So the §6 fix created this defect; it was not pre-existing.

r=200 puts the southern arc at z=−160, where the ground is ~18 m up and climbing.
Full 12-shot re-shoot (`p9-scarp` vs `p8-vignette`), mean abs diff per channel against
the 0.62–0.67 animation noise floor:

| shot | diff | | shot | diff |
|---|---|---|---|---|
| 12-wide-south-vista | **4.89** | | 09-west-treeline | 1.91 |
| 02-churchyard-south | **3.29** | | 11-silhouette-back | 1.83 |
| 05-main-street | **3.28** | | 06-well-plaza | 1.28 |
| 04-town-gate-vista | **2.67** | | 08-east-meadow | 1.04 |
| 10-ridge-west | **2.29** | | 03-lych-gate | 0.92 |
| 01-churchyard-spawn | **2.06** | | 07-north-overlook | 0.56 |

No shot regressed on inspection. Cost: 127145 → 127187 triangles (+42), draw batches
unchanged at 15.

**Delivered:** 27.2 s live MP4, 1280×720, 30 fps, 27.0 MB, recorded by the new
`scripts/ashen-reach/record-vistas.mjs` at 94.9 fps capture-time, Telegram message 689.
Route: south ridgeline → churchyard → lych gate → town gate → main street → well plaza
→ turn back to the lit town. Two takes were rejected before that one: the first spent a
third of its runtime on empty field at the west meadow and north overlook and boomed the
camera through a wall for a black frame; the second still carried the scarp bar through
its opening 3.5 s.

**Why this section exists at all.** The §6 work was committed, logged, and never sent.
The `Stop` gate that was supposed to prevent that could not have: it lived in
`.grok/hooks/`, which Claude Code does not read, and it decided "is this visual work?"
from `git status`, so committing — the normal last act of a session — blinded it. And
`tg`, named in AGENTS.md and `docs/debug-view.md`, did not exist on disk. Fixed in
`2f77c26`: `scripts/tg` (env-only credentials, loud failure on `{"ok":false}`, delivery
ledger), `.claude/hooks/telegram-motion-stop.py` registered in `.claude/settings.json`
and reading committed history against that ledger, and the `deliver-visual-cycle` skill.

### Still carried

- `04-town-gate-vista` reads very mustard; the limestone tint is likely over-saturated
  against the new warm key.
- `10-ridge-west` ridge rings still read as flat cardboard — `ridgeRing` uses 36–48
  segments over 230–500 m radii, i.e. 30–80 m quads with flat top edges.
- `07-north-overlook` shows almost no sky: the rings span ~10–24° against a 17.5°
  top-of-frame.
- Phase E is not started: mist bands pooled at valley height, light shafts at the gate
  lamps.
