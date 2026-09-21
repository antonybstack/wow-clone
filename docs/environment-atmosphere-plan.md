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

## 8. Midground, colour and mist (p10–p21)

Three passes, each starting from a measurement rather than from an impression.

**Midground and skyline (`1094bf2`).** The bowl between the town and the ridge rings was
empty, and the rings themselves were flat cardboard. `ridgeRing` now sums three octaves of
`1-|sin|` over at least 96 segments and raises the result to a `sharp` exponent, so the
silhouette has summits and saddles instead of a scalloped top edge. `scarp()` is deleted
outright — it painted a near-black skirt onto smooth ground and produced the dark forked
"tape" bands across `12-wide-south-vista` through three separate generations of tuning; the
third time it was cheaper to remove the primitive than to retune it. The viaducts went with
it for the same reason. `mesaKeep` now stands on a closed `butte()` prism; it previously
stood on `crag()`, which is a fan of ten separate triangles and so read as a keep on stilts
with icicles at `08-east-meadow`. Scatter is grove-clustered rather than uniform, with three
tree silhouettes, and gated by `edgeOf()` at ≥40 m of clearance — without that gate trees
landed 17 m in front of the `07` camera as crude four-sided poles.

**Colour (`49d59d3`).** "Looks mustard" became a number: `04-town-gate-vista` measured 0.591
mean saturation with 85% of its chromatic pixels inside a single 30° hue bin. The cause was
two texture averages — `rock_wall_08` at 81/75/67 and `forrest_ground_01` at 145/135/94, both
already warm — multiplied by warm tints and then lit by a warm key. Fixed at the tints, not
at the grade. Cooling the limestone alone moved the concentration 85%→84%, because the
remaining mustard was the ground; cooling the earth too took `04` to 0.518/79% and `07`'s
warm bin from 67% to 50%. Separately, `10-ridge-west` was bare because `foliageDensity` had a
hard `if(rad>108)return 0` and that camera stands at x=-80 — art direction was never the
problem. Cutoff widened to 190 with the falloff stretched over the whole run.

**Valley mist (`d16b3b0`).** A second analytic height-fog layer at a 7 m e-folding height,
applied after `aerial()`'s own mix and with its own blue-weighted body. Documented in detail
in `atmosphere.js`; the short version is that the first attempt used density 0.028 and was
past its cap at *every* distance and height sampled, making it a flat 52% veil rather than a
layer. Shipped values keep the integral in its varying range: distant valley floor at the
0.42 cap, a crest 35 m above it at the same distance at 0.11.

### Corrections to earlier entries

- The "76% of `10-ridge-west` is far terrain" figure recorded during the p10 work is **wrong**
  and should not be built on. Material tagging cannot separate near `Earth` from `Far earth`
  because both use the material `Moss and burial earth`. Most of that 76% was near playable
  ground, which is why a change that rewrote every far-terrain vertex colour moved the shot
  by only 0.92.
- Mean-absolute-difference over a whole 1280×720 frame is a poor detector for localized
  defects. `12-wide-south-vista` measured 1.31 while showing an obvious change in a crop.
  Crop at full resolution before concluding anything. The per-shot animation noise floor is
  0.62–0.67 per channel and pose is not pinned by the capture script, so diffs up to ~4.7 can
  be pure noise.
- `capture-vistas.mjs` falls back to port **5173** unless `ASHEN_URL` is set; setting only
  `ASHEN_VITE_PORT` is not enough. A p20 run shot against another session's server and was
  only caught because the stats block came back with the pre-`1094bf2` triangle count. Always
  check the stats against the expected build before trusting a capture.

### Still carried

- `09-west-treeline`'s near trunk is a detail-free black mass filling a quarter of frame, and
  its flared base does not meet the ground. Raising `Dead bark` to `light:.56` did not rescue
  it — this is near-field tree geometry in `scene.js`, not atmosphere.
- The sky is still a flat navy field away from the sun.
- Light shafts at the gate lamps: the remaining half of Phase E.
- Frame time is pinned to the 144 Hz vsync cap in every measurement here. That means "did not
  regress"; none of these numbers establish headroom.

## 9. Phase E and the near trunks (p22–p26)

**Lamp light shafts (`e009b41`).** `src/ashen-reach/light-shafts.js`, the only thing in the
scene with its own material. Every other glow here is faked on opaque triangles with
per-vertex falloff because `surface()` has no blending, which is correct for a puddle
painted on a wall and impossible for a shaft — an opaque cone would punch a
lantern-coloured hole in the road behind it. `createShaderMaterial` does support
`needAlphaBlending` with `blendMode:'additive'`, so the cone only adds light and never
occludes. Depth testing on (a shaft hides behind a house), depth writing off (adjacent
cones sum rather than fight over draw order). Alpha is weighted by `|dot(normal,view)|` so
the silhouette dissolves — that hard outline is the usual tell on a cheap god-ray cone —
and back-face culling is off so the far wall sums toward the centre, which is where a real
ray crosses the most lit air. The one thing needing a second pass was that stacking: two
shells × two walls is four layers on the centre line, and the first alphas summed past
white at the lych gate, reading as a floodlight in fog. Halved. 10 shafts, 640 triangles,
150→152 draw calls. Anchors are collected at the fixtures, not derived from `lights`, since
that array mixes lamp heads with ground pools; all are z≥44, so §4's churchyard invariant
holds by construction.

**Near trunks (`c61868f`).** Both halves of the long-carried `09-west-treeline` defect.
The flare did not meet the ground because every root tip took its height from `g`, the
terrain sampled at the *trunk centre*, so downhill roots ended in mid-air on any slope.
Tips now sample the ground beneath themselves and sink .14 below it. The first retry kept
the original reach and the roots ran out nearly flat, reading as spikes lying on the grass
rather than buttresses; shortening the reach and raising the origin put them near 45°. The
trunk read as a detail-free black mass because the bark texture was multiplied to nothing;
the lift is on the vertex colour rather than on `Dead bark`, because that material is shared
with the 565 far scatter trees, which want to stay silhouettes and still do — 07, 10 and 12
all moved less than the animation noise floor.

**Tooling.** `scripts/tg` now rejects captions over 1024 bytes *before* uploading. Telegram
enforces that limit by refusing the whole upload after the file has transferred, and it
does so as an HTTP 200 `{"ok":false}` — so a caller that pipes `tg file` through `tail`
loses the exit status and can go on to `tg record` a delivery that never happened. That
happened once here; the send was repeated successfully, so the ledger line is accurate, but
the guard is what stops it recurring. Related: do not pipe `tg file` into anything when
chaining with `&&`.

### Still carried

- The sky is a flat navy field away from the sun.
- `capture-vistas.mjs` needs `ASHEN_URL`, not just `ASHEN_VITE_PORT` (see §8).
- Every frame-time figure in §8 and §9 sits on the 144 Hz vsync cap: "did not regress", not
  headroom.

## 10. The sky and the far field (p27–p32)

Four deliveries, Telegram 696 through 699. The first two are the cloud deck; the
last two are aerial perspective, and one of them exists mainly to correct the
other.

**The deck was already there and invisible (p27–p28, Telegram 696).** The sky read
as a flat navy field away from the sunset, and the obvious guess — that the cloud
clear band was too wide — was wrong. Above ~20 degrees of elevation the deck was at
full strength already. What killed it was colour: the anti-sun end of the cloud tint
was `.055/.070/.098` against a sky that sits at `.076/.094/.128` at 26 degrees, so a
cloud differed from its own background by under 20%. Dropping the anti-sun tints to
roughly a third of the sky value gives the banks mass. Darkening alone gave them value
but no boundary, so the density-edge term that previously fired only near the sun is
now also applied ungated, carrying skylight rather than sunlight; that is what makes a
bank separate from its neighbour. The horizon clear band came in from ~20 degrees to
~13 at the same time.

**Form and motion (p29, Telegram 697).** The density thresholds spanned `.36–.82` and
`.48–.90` — most of the range of the field — so no bank ever had a silhouette. Halving
both spans sculpts one; a third, much finer sample of the same texture offsets both
ends of each window so the contour breaks into lobes instead of reading as a clean
JPEG isoline. Drift went from `.0004`/`.00021` to `.0014`/`.00062`; the old rate moved
the deck about 1% of the sky's circumference per half-minute, which is a painted
backdrop.

**The far field had no depth ordering (p30–p31, Telegram 698).** Two changes, and the
second one is here because the first was built on a measurement I had not taken.

- The hard `FOG_MAX` clamp is now a soft knee: below `FOG_KNEE=0.50` the curve is
  untouched, above it the fog saturates exponentially toward `FOG_FAR=0.74` instead of
  stopping. `FOG_FAR` deliberately stops short of 0.80 because section 6 records that a
  hard clamp there made the ridge rings the brightest thing in frame.
- `FOG_SCALE_H` comes down from 22 to 15. This is what actually fixed the citadel.

**Correction to my own entry for the knee.** I justified the knee by claiming the
clamp flattened the entire far field past ~125 m. It does not, and modelling the
integral rather than reading a screenshot is what showed it. At 260 m the integral is
0.83 on the ground plane — clamped — but 0.52 at the top of a 58 m tower and 0.50 on a
98 m crest at 400 m. Elevated distant geometry was **never** clamped, so removing the
clamp could not have been what fixed the citadel, and the p30 capture confirmed it: the
towers barely moved. The clamp only ever bound on low sightlines. The knee still earns
its place — distant *ground* now recedes instead of piling up on one value — but the
claim attached to it was wrong. What buries a tower is the height profile: at a 22 m
scale height the haze is still thick 56 m up, so about half of what reaches the eye
from a tower is inscatter, and that near-black stone's own shading (roughly 0.013 to
0.042) arrives as a 4% modulation on a much brighter constant. No exposure makes that
read as form. At 15 m the tower keeps 60% of itself instead of 48%, and the ground
plane moves only 0.68 to 0.67, so the near- and mid-field haze tuned in sections 7 and
8 is preserved.

**The forward-scatter lobe was too wide (p32, Telegram 699).** `pow(dot,10)*0.40` is
still at 54% of full strength 20 degrees off the sun, so everything backlit in that
half of the frame was veiled rather than only the things near the disc. `pow 15 /
0.30`. Measured on 03-lych-gate: the citadel sat 16.6% below the sky directly above it
and now sits 20.0% below. That is a modest gain and is recorded as one — a backlit
castle at this distance should be far darker than either figure. 07-north-overlook
gained more, because its ridge trees sit exactly in the trimmed part of the lobe.

### Verified, not assumed

The deck clear band exists to stop a cloud-darkened dome from stepping against a pale
ridge at the ridgeline. Every sky change above was checked against that specific
defect by sampling horizon row means on 02-churchyard-south, 04-town-gate-vista and
10-ridge-west; they match the pre-sky build to within 1/255 throughout. The step never
returned.

### Instrument note

`capture-vistas.mjs` prints a fully correct stats block over a completely black frame.
A `let a=..,b=..;` in the sky shader — WGSL has no comma-separated `let` — produced an
invalid pipeline, which invalidated the whole render bundle, which dropped every mesh
in the scene. The counts are assembled on the CPU during scene build and never consult
the GPU, so they answer "which build loaded", not "did anything render". The giveaway
was a mean-abs diff of 40–90 on *every* shot including ones framing almost no sky.
Read the console over CDP; the WGSL parse error names the line.

### Still carried

- Into the sun the citadel is a tan smudge. 20% below its background is not a
  silhouette, and nothing short of changing the distant stone's own value or the haze
  at its base will move it much further.
- The crag beside the citadel is about 10% brighter than the sky above it. I believe
  this is correct — `skyColor()` peaks at the horizon, so a near-horizontal sightline
  full of haze genuinely outshines the dome further up — but it is the main reason the
  skyline reads soft, and it is recorded as a decision rather than as a fact.
- Cloud drift is legible now but the deck has no vertical structure; it is a ceiling,
  not weather.

## 11. The convergence target (p33–p36, Telegram 700)

### The thing every earlier pass missed

`aerial()` ended in `mix(c, inscatter, fog)` with `inscatter = skyColor(dir)`. That is
the statement "a fully hazed object is exactly as bright as the open sky", and it is
the reason the skyline read soft through this entire branch. FOG_MAX, the FOG_KNEE
soft knee, FOG_SCALE_H and the forward-scatter lobe are all arguments about *how much*
inscatter there is. None of them touch what it converges to, so none of them could
move a distant object more than a fraction of the way toward a silhouette — which is
exactly what the numbers showed each time.

`HAZE_FAR=0.55` takes the deep field's inscatter to 55% of the sky in the same
direction, ramped over 110–300 m. Measured on 03-lych-gate against p32, same patches:

| patch | p32 | p34 | vs its own sky |
|---|---|---|---|
| mountain left of citadel | 151.1 | 114.1 | 25% below → 43% |
| spire cluster | 149.5 | 131.1 | 26% → 35% |
| crag | 101.8 | 85.4 | 32% → 43% |
| sky above crag | 150.2 | 149.2 | control |
| sky left | 202.2 | 201.9 | control |
| town wall | 133.5 | 133.3 | control |
| gravestone | 159.4 | 159.5 | control |

This also retires the second entry on §10's "Still carried" list. I had recorded the
crag being brighter than the sky above it as a decision I believed was physically
right. It was not a decision worth keeping; it was this bug.

### Two things I got wrong on the way

**Keying the ramp to fog.** The first attempt (p33) ramped on the fog value with a knee
at 0.35, reasoning that it would spare the tuned near field. It did, and it also spared
the target: the citadel towers sit at fog 0.52, a sixth of the way up that ramp, and
measured **+0.0** on the tower and −0.3 on the castle mass. `FOG_KNEE` has already
flattened fog exactly where the interesting geometry is, which makes fog a poor proxy
for path length. Distance is the right key, and starting the ramp at 110 m leaves every
near- and mid-field value from p5, p10 and p15–p18 untouched anyway, because nothing
tuned in those passes is beyond 110 m.

**The physics story.** The tempting justification is "a 260 m path carries less
inscatter than the infinite column behind it". It does not survive `FOG_SCALE_H=15`:
under a 15 m scale height a horizontal sightline passes roughly seventeen times more
haze than the vertical column, so a strictly physical reading of this model makes the
far field *brighter* than the sky, not darker. The model is a mood device. The change
is art direction — distant land must sit below the sky it stands against — and the
comment in `atmosphere.js` says so rather than dressing it up.

### A negative result worth not repeating: crest caps (p35, p36, reverted)

The far band is now a silhouette with no internal form, and the reason is structural:
the ridge rings enclose the camera, so we see their inner faces, and an inner face on
the half of the ring that frames the sunset has `ndl ≈ −0.96`. `shade()`'s wrapped tail
is zero by then, and its rim term needs a normal turning away from the eye, which a
flat camera-facing curtain never does. The visible ridges receive **no directional
light at all** — hemispheric ambient on a near-black stone is the whole of it.

I tried a snowline crest cap: a second quad above a height threshold carrying a large
vertex colour (they are float32 and multiply albedo, so multipliers above 1 are legal).
It cost 372 triangles and it does not work, for two reasons found in that order:

1. A snowline at 0.62 of the `hMin..hMax` *parameter* range is not 0.62 of the crests
   actually generated. `t = pow(ridged, sharp)` with sharp 1.35–2.1 pushes most segments
   far down the range, so only 43 of 334 segments crossed it and the whole feature
   measured inside the pose-noise floor on all twelve shots. A percentile of the
   generated heights fixes that.
2. It still does not show, because **the ring crests are occluded by nearer terrain in
   almost every gameplay framing**. A debug pass colouring the caps flat magenta put
   them at 0.2–0.6% of screen on three shots and nothing on the other nine, and even at
   a 12× albedo the band arrived as a muted dark pink, because 45–55% of a 300–500 m
   pixel is inscatter. At honest colours, the side-by-side crops on 02 and 11 are
   indistinguishable.

Reverted. Recorded here so the next pass does not spend the same day on it. The lever
for the northern skyline is the big pale near hill that actually occupies it, not the
rings behind it.

### Still carried

- The far band is a silhouette with no internal form, for the reason above. Fixing it
  needs light the curtains can actually receive, not a brighter material.
- The deep field now skews warm-brown rather than cool, because what survives the cut
  is the warm end of the inscatter.
- Cloud drift is legible but the deck has no vertical structure; it is a ceiling, not
  weather.

## 12. Form in the far field (p37–p41, Telegram 702)

### Correction to §10, and to my own instinct twice over

§10's "Still carried" said the citadel would not move further without "a change to
the distant stone's own value or the haze at its base". Only the second half was true.
Two measurements, both reverted:

| change | mountain patch on 03-lych-gate |
|---|---|
| tint `[.095,.115,.10]` → `[.082,.098,.135]` (cool) | 0.0 luminance, 0.3 in R−B |
| `light` .35 → .95, a 2.7× increase | +0.9 mean, spread 5.01 → **4.98** |

A 10× difference map of the retint capture is black across the whole skyline at
amplification. The arithmetic: the stone holds 48% of a 260 m pixel *by weight*, but
its shaded value spans 0.013–0.042 against an inscatter near 0.30, so it is about 13%
of the pixel *by value*. Weight and value are not the same lever, and I conflated them
when I wrote §10. Nothing that can be done to a near-black material outvotes seven
eighths of air.

This is worth stating plainly because it closes a whole family of ideas: distant-stone
retints, `light` changes, per-ridge tint tables, and vertex-colour tricks on the far
geometry are all bounded by that 13%, and the crest-cap experiment in §11 was the same
mistake in a different costume.

### What worked

`HAZE_BANK=0.22` modulates the deep field's haze with two crossed low-frequency waves.
The dominant one is stratified in world Y so the bands lie roughly horizontal, the way
haze in a valley does, with its height wobbling in x so they are not dead-flat lines; a
slower lateral term adds patchiness. Gated by the same 110–300 m ramp as `HAZE_FAR`.

| patch | before | after |
|---|---|---|
| mountain spread (sd) | 5.01 | **6.33** (+27%) |
| gravestone spread | 6.44 | 6.47 (control) |
| town wall spread | 6.80 | 6.80 (control) |
| sky left mean | 201.9 | 201.6 (control) |

### Instrument note, second entry

Two black-frame failures in this pass, both caught by the same signal from §10 — a
mean-abs diff of 40–84 on *every* shot — and both printing a fully correct stats block
over the black frame:

1. `let patch = ...` — `patch` is a WGSL reserved keyword.
2. `shaderUniforms.time` inside `aerial()`. It compiles in the surface materials and
   fails in `Lamp light shafts`, which declares no time uniform. Because the world is
   submitted in one render bundle, one invalid pipeline discards every mesh.

The second is why the banks are static. That is a constraint, not a preference, though
terrain-locked banks are arguably the better reading for still evening air.

### Still carried

- The banks do not drift. Giving `Lamp light shafts` a time uniform would allow it.
- The deep field skews warm-brown; what survives the `HAZE_FAR` cut is the warm end of
  the inscatter, and §12 establishes that the material side cannot correct it. If it is
  worth fixing, the lever is the inscatter's own colour, not the stone's.
- Cloud drift is legible but the deck has no vertical structure; it is a ceiling, not
  weather.

## 13. Cool air (p42, Telegram 703)

§12's last carried defect was that the deep field skewed warm-brown. The cause is
mechanical: `HAZE_FAR` scales the whole inscatter term down by 45% at distance, and
what is left over is dominated by the warm part of it — the sun lobe and the warm
horizon band of `skyColor()`. Nothing about that cut is selective, so cutting it
preserves the hue and only loses the value.

§12 had already closed the material half of the lever (the 13%-by-value arithmetic),
so the only remaining place to put the change is the colour of the air itself.

### What landed

`HAZE_TINT = [0.90, 1.00, 1.26]` multiplies the `skyColor(dir)` term of far inscatter
and nothing else. The sun lobe is deliberately excluded: it is the one part of the
inscatter that *should* be the sun's colour, and tinting it turns the sunset cold
while doing nothing for the mountains, which are nowhere near the disc. Gated by the
same `far = smoothstep(HAZE_D0, HAZE_D1, d)` ramp as `HAZE_FAR` and `HAZE_BANK`.

Measured on `03-lych-gate`, p41 → p42:

| patch | R−B | luminance |
|---|---|---|
| mountain left of citadel | 51.5 → **33.6** (−35%) | 115.8 → 115.6 |
| crag mass | 15.8 → **7.7** (−51%) | 82.6 → 83.2 |
| spire cluster | 34.7 → **27.1** (−22%) | 132.4 → 131.5 |
| sky left (control) | 4.4 → 4.3 | 201.6 → 201.9 |
| gravestone (control) | 82.4 → 82.4 | 159.4 → 159.5 |
| town wall (control) | 61.6 → 61.6 | 133.3 → 133.3 |

This is the first far-field change in three passes where the number moved by a large
fraction rather than by a decimal, and the reason is the same arithmetic that killed
the other three: the haze is seven eighths of the pixel out there, so a change to the
haze gets seven eighths of the leverage. §12 said this in the negative; §13 is the
positive form of the same sentence. Stop proposing far-field material edits.

Luminance held flat on all three far patches — under one unit on each — so the
colour moved without the contrast structure built in §11 and §12 moving with it.

Reviewed on the live clip, not just the stills: the two contact sheets show the town
interiors keeping their lamplight warmth (all inside 110 m, so the gate excludes
them) while the ridgelines read cool grey-blue against a still-warm sky.

### Still carried

- Haze banks do not drift. `Lamp light shafts` declares no time uniform, and `aerial()`
  is inlined into it, so this needs a shader-side change before it can be animated.
- The cloud deck is a ceiling, not weather: drift is legible but there is no vertical
  structure in it.
- The sun lobe is now the only warm thing in the deep field by construction. If the
  scene ever moves the sun off the horizon, `HAZE_TINT` will need re-checking, since
  the lobe currently overlaps the citadel silhouette and hides the boundary.

## 14. The deck in perspective (p43, Telegram 704)

§13's remaining carried defect was "the cloud deck is a ceiling, not weather."
Three previous passes had attacked that through density: narrower thresholds, a
jitter octave, faster drift, stronger lit/unlit separation. All of them helped a
little and none of them fixed it, which was the signal that the diagnosis was
wrong.

The diagnosis was wrong. The deck was sampled at
`vec2(atan2(d.z,d.x)/6.283, acos(d.y)/3.14159)` — a pure spherical mapping, under
which a bank subtends the same angle whether it is overhead or near the horizon.
That is not a ceiling seen from underneath; it is a dome with clouds painted on
the inside, and the missing cue was **perspective, not motion**. No density or
drift parameter can supply perspective.

### What landed

A ray at elevation `d.y` meets a plane at height `H` at horizontal distance
`H/d.y`, so `d.xz/d.y` is that plane in world coordinates up to a scale. Sampling
there gives foreshortening for free: banks spread overhead and compress toward the
horizon. Two consequences fall out of it rather than needing to be added:

- **Drift becomes a wind vector.** A translation of the plane is what wind
  physically is, so the three layers now share a bearing to within 20 degrees and
  differ only in rate. They parallax against each other instead of sliding as one
  sheet, which is what the old dome rotation always did no matter how the rates
  were staggered.
- **The compression near the horizon is self-limiting.** `|d.y|` is clamped at
  0.045, which sits inside the existing `deck = smoothstep(0.025,0.22,|d.y|)`
  fade, so the region where the projection would run away is already being faded
  out; mipmaps absorb the rest. No aliasing appeared on any of the twelve shots.

Scales were chosen to preserve the apparent bank size the dome mapping had at 30
degrees of elevation — roughly where the gameplay camera sits — so the pass buys
perspective without silently rescaling the whole sky.

| patch (`01-churchyard-spawn`) | mean | spread |
|---|---|---|
| sky mid, dome → slab | 189.0 → 164.6 | 37.69 → **47.09** (+25%) |
| sky mid, + directional rim | 164.6 → 172.4 | 47.09 → 47.18 |
| sky right, + directional rim | 114.2 → 117.2 | 31.33 → **33.71** (+7.6%) |
| gravestone (control) | 129.9 → 129.8 | 53.84 → 53.84 |
| grass (control) | 58.7 → 58.9 | 21.78 → 22.00 |

An amplified difference map confirms the change lands entirely in the sky band;
everything below the horizon is pose and foliage noise.

The rim change makes the existing edge term directional, weighted by the density
gradient along the sun's horizontal bearing, so a sun-facing edge gets up to 2.1x
the glow and the far side of a bank no longer lights as brightly as the near one.

### Two negative results, one lesson

Both attempts at giving the deck relief failed, and for the same reason twice.

1. **Self-shadow**, sampling density 0.075 uv toward the sun and subtracting it
   from the lit term. Moved spread by 1.3 on a 47-unit patch — inside the noise.
   The cause was geometric, not a tuning miss: with the sun about 6 degrees above
   the horizon, a slab of thickness 0.3H throws its shadow 9.6 thicknesses
   downwind, roughly a quarter of the sky, so the sample was decorrelated from the
   bank supposedly casting it and darkened at random rather than in register. **A
   low sun does not shade a deck from within; it rakes across it.**
2. **Folding the sun-bearing gradient into `litHigh`/`litLow`** as a multiplier on
   `pow(sd,n)`. Cost 19 units of mean and 3.4 of spread, and the crop read visibly
   greyer. `pow(sd,n)` is already at its ceiling exactly where the deck is bright,
   so a multiplier on it can only subtract on average — and clamping the negative
   half at 0 while the positive half caps at 1.30 makes the asymmetry worse.

The general form, worth carrying forward: **a term that modulates an
already-saturated quantity is a subtraction wearing a multiplier's clothes.** The
same gradient that cost 19 units mixed in gained 7.8 added to the rim, unchanged
in every other respect. If a new sky or lighting term measures as net dimming,
check whether it is riding on something that was already at 1.0 before reaching
for a bigger coefficient.

This is a sibling of §12's weight-versus-value error: both are cases where an
intervention was applied at a point in the pipeline that had no headroom left.

### Still carried

- Haze banks do not drift. `Lamp light shafts` declares no time uniform and
  `aerial()` is inlined into it, so this needs a shader-side change first.
- **The gameplay camera sits low and frames very little sky.** Six of the twelve
  vistas show the deck only as a thin strip above the horizon, and the recorded
  flythrough undersells this pass badly compared to the stills. That is a framing
  fact about the game, not about the sky, and it caps how much any further deck
  work is worth. Before spending another pass up there, it is worth asking whether
  the camera should ever tilt up at all.
- The slab has one height. Real decks have two or three at genuinely different
  altitudes, which would show as differential parallax when the camera translates.
  The three layers here share a projection and differ only in scale and drift.

## 15. The haze drifts (p44, Telegram 705)

§12, §13 and §14 each carried the same line: "haze banks do not drift; `Lamp light
shafts` declares no time uniform, and `aerial()` is inlined into it." That was
recorded as a constraint across three passes. It was half of one.

### Correction to §12 and §13

The shafts uniform was real and is fixed with one line in `light-shafts.js`. After
fixing it the drift **still measured exactly 0.0** against a static control. The
second half: nothing in the game had ever written a value to the `time` uniform on
any `surface()` material. Foliage, the sky dome and the lava ball each drive their
own; the twelve `surface()` materials were left at `defaultValue: 0` forever. So
`shaderUniforms.time` inside `aerial()` was a compile-time-legal constant zero, and
would have been even if the shafts material had never existed.

This is worth stating plainly because §12 and §13 both assert the shafts uniform as
*the* reason, and someone reading them would fix that and conclude the feature was
broken. The surface materials' vertex `wind` branch, which also reads `time`, has
been dead the whole time too — no caller passes `wind:true`, so it never emitted.

### Correction to the instrument

The first measurement said the banks were not moving. It could not have said
anything else. `capture-vistas.mjs` calls `page.goto` per run, restarting the
simulation clock, so two runs shoot each vista at the same elapsed time. Running it
twice and finding the far field identical to 0.1 units proved only that the harness
is deterministic. `scripts/_tmp-hold.mjs` parks one camera and shoots across live
time in a single session, which is the instrument this question needed.

The giveaway that should have come first: the static and drifting builds produced
*identical* numbers, not merely similar ones. Two different shaders agreeing to
within 0.1 on a 140-unit patch is a statement about the harness, not the shaders.

### Measured

`03-lych-gate`, `spire-cluster` patch, one session:

| build | t+0 | t+12s | t+24s |
|---|---|---|---|
| static control | 129.5 | 129.5 | 129.5 |
| drifting | 128.3 | **118.2** | **115.0** |

Controls over the same span: town wall 0.9, crag 0.2 — the same as the static
build's own run-to-run noise. `mtn-left-cit` moves 3.1 and its spread rises from
18.36 to 21.03, so the banks add form as they pass, not just value.

Rate is 5.0 m/s on the same bearing as the cloud deck. That shared bearing is not
decoration: §14's flat-slab projection puts the deck's uv axes on world x and z, so
a single wind vector genuinely describes both, and the two effects move together
instead of advertising that they are unrelated. The rate is calibrated rather than
picked — a constant 200 m offset moves that patch by 6.4 luminance, which sets the
scale for everything else. It is faster than the evening looks; that is the usual
price of making a soft multiplicative effect legible at all.

### Still carried

- The gameplay camera sits low and frames very little sky (§14). This pass is
  mostly invisible in the recorded flythrough for that reason, and it caps the
  value of further sky work. **This is now the largest open question in this
  document** — not a defect in the sky but a fact about how the game is framed.
- The slab has one height (§14); the three cloud layers share a projection.
- Nothing has been done about the ground's own mid-distance, which is what the
  camera actually frames.

## 16. The ground had no form to light (p45–p52, Telegram 706)

§15 ended by naming the ground's mid-distance as the open item. This pass went
after it and spent four experiments on the wrong layer before measuring the right
one.

### Correction to §15's framing

§15 treats the mid-field as a lighting problem. It is not. Every shading fix
tried here measured at or below its band's noise, and the reason is arithmetic:
at a 5.8° sun the flat ground's `ndl` is 0.101, so

```
key  = SUN_COLOR*(0.101*0.95 + ((0.101+0.45)/1.45)*0.30) = 0.2100
hemi = SKY_AMBIENT                                       = 0.4617 - 0.2100
```

The hard key is **15.9% of ground luminance**. Masking *all* of it moves the
frame less than the haze does. Any pass that modulates the key is fighting for a
sixth of the signal, and the tonemap takes back part of even that — `grade()`
compresses highs, so a change that raises a band's mean tends to *lower* its sd.
Several of the negative results below have exactly that signature.

### The actual cause: a hole in the relief spectrum

Measuring the heightfield rather than the shaders:

| source | amplitude | wavelength |
| --- | --- | --- |
| `terrainRaw` | 0.46 m | 14–33 m |
| `distantRelief` | 12 m | 224–286 m |

**Nothing between one metre and two hundred** — exactly the range a camera
standing on the ground reads as landscape. `terrainNormal` was therefore near-
constant across the whole mid-field, so `farShade`'s slope term and `shade()`'s
own cosine had nothing to respond to. The ground had no form to light, which is
why every shading fix measured nothing.

### What shipped

A mid-scale swell in `geometry.js`, 4 m peak to trough at 70–80 m, reusing
`climb()`'s own smoothstep ease so it is exactly zero for `z<=40`. Costs no
triangles. Max grade 1 in 6 — a gentle hill to walk over.

Band spread, 40-row bands at 200/240/280/320:

```
07-north-overlook  p44 21.12 12.36  7.92 11.19
                   p52 28.63 21.70 13.17  7.98   +35% +77% +66% -29%
10-ridge-west      p44 39.85 26.27 10.31  6.77
                   p52 35.84 29.92 17.92 10.55   -10% +14% +74% +56%
01-churchyard      p44 50.64 63.36 73.54 53.16
                   p52 50.73 63.64 73.80 53.02   invariant holds
```

The churchyard row is the invariant check: `h(0,0)` and `h(0,40)` are unchanged
bit-for-bit, and the render agrees to 0.3.

### Negative results, kept because they cost four cycles

- **Baked sun shadow in `uv2.y`.** Plumbing was perfect — a debug capture
  writing `vec4(i.sun, i.sun*0.2, 1.0-i.sun, 1)` proved the channel arrives — but
  at 5.8° the shadowed fraction of the play area is small and it rides on that
  15.9% key. Worth 4–11% on three bands, against a whole-shot exposure shift.
  Cut. Note it is also homeless for foliage: `instanceColor` is fully spoken for
  (rgb tint, a lamp) and the patch is recycled as the player moves.
- **`earthShade` macro albedo.** Targeted the wrong mesh. A second tag capture
  (`fine` red vs far blue) showed the fine earth ends at y≈370 in shot 07 and the
  dead band at y=280–320 is *entirely* far mesh.
- **`farShade` tight third octave, two amplitudes.** The `near` radial fade was
  anchored on the town centre, but shot 07 stands at the northern edge looking
  further north, so the band sat at ~360 m where `near = 0` — the term was zeroed
  exactly where the shot looks. Removing the fade and tripling the amplitude then
  made the band *smoother* (sd 8.45 → 7.25), the tonemap signature above.

### Instrument change: `capture-vistas.mjs` pixel diffs now have a floor

Since §15 wired `time` into every `surface()` material, a **same-build control**
gives a mean-abs-diff of 0.54–3.44 (worst on dressed/animated shots 02, 05, 06,
11). Two algebraically identical builds differed by 1.78–8.74. Band sd, by
contrast, agreed to within 0.18 across p51/p52/p52-ctrl while p44→p52 moved 5–8
units. **Use band statistics for before/after conclusions; whole-frame
mean-abs-diff is now only a global-catastrophe detector** (40–84 = black frame).
Run a same-build control before trusting any diff.

### Still carried

- 07's 320–360 band lost 29% and 10-ridge-west's 200–240 lost 10%.
- `08-east-meadow` and `12-wide-south-vista` gain nothing: the swell is zero
  south of `z=40` by design, to hold the churchyard invariant.
- **Foliage takes no terrain shadow**, so grass is lit identically on both faces
  of every crest. Per-fragment shadowing would need a texture rather than a
  vertex channel, with casters from trees and buildings and a reach that excludes
  `distantRelief`.
- From §14: the cloud slab has one height (three layers share a projection), and
  the gameplay camera frames very little sky — still the largest open question.

## 17. Grass follows the ground (p53–p54, Telegram 707)

§16's clip disclosed its own largest leftover: grass was lit identically on both
faces of every crest the swell had just created. §16 also said fixing it needed a
shadow texture. **That was wrong, and the correction is the interesting part.**

The foliage pass bends each alpha-cut blade card toward vertical before shading —
that bend is what makes a clump read as a rounded mass rather than a row of flat
billboards. But it bent toward a *constant* `+Y`, so every blade on the field
shared one shading normal.

A shadow texture is the right tool when the caster is an object. Here the caster
is **the terrain itself**, and the terrain is a closed-form function, so its slope
can be evaluated per fragment: four trig calls, no memory, no vertex channel
(`instanceColor` is full — rgb tint, a lamp), no bake, and nothing to keep in
sync as the foliage patch recycles. `TERRAIN_SLOPE_WGSL` in `geometry.js` emits
the analytic derivative of `climb()+swell()` immediately beside the JS it mirrors.

Only the mid-scale terms are included. `terrainRaw`'s 0.30/0.16 octaves live at
14–33 m, below a grass clump, and would read as noise rather than form.

Verified against finite differences of `height()`: **max error 3.4e-10** over 5130
samples inside the play rectangle and off the building pads. The first run of that
check reported 4.4e-1 — at a building pad, where `height()` flattens by design,
and then 3.9e-1 at `z=198`, outside the play rectangle where the basin term
starts. Both were the check meeting the terrain's other features, not an error.

Slope is exaggerated **2.2×** for shading only, the way a normal-map intensity is.
The true grade tops out at 1 in 4.7 and tilts the normal 12°, which is real but a
gentle read across a hundred metres of haze; a three-way stack at 1.0× and 2.2×
is monotonic, and only at 2.2× does the meadow have a lit flank and a shaded one.

### Instrument: band sd has a blind spot, and it nearly cost this pass

Band sd moved **0.2–0.6 against a 0.06 control** — by §16's own standard, a
negative result, and the signs were mixed across shots. It was wrong. Band sd
measures spread *within* a row band, so an effect that brightens some elements and
darkens others inside the same band barely moves it, however large the per-element
change is.

The amplified difference map settled it in one image: the same-build control is
uncorrelated white speckle on the near grass, while the signal is **large coherent
orange per-clump patches organised along the terrain**. Per-shot mean-abs-diff
rises above the control floor only on the north-looking shots — 03 (3.84 vs 1.12),
04 (4.00 vs 2.64), 05, 07 (1.61 vs 0.54), 09 — which is exactly where the swell is.

**So the instrument rule from §16 needs a caveat.** Band sd is right for *"does
this region have more form"*. It is blind to *"did individual elements change"* —
use a difference map against a same-build control for that, and read its
structure, not just its magnitude.

### Invariant

Holds by construction, not just by measurement: at `z=40`, `t=0` gives `e=0` and
`de=0`, so the slope is exactly `(0,1,0)` and eases in C1. No seam is possible.
`12-wide-south-vista` moves 0.71 against a 0.66 control, `08-east-meadow` 1.06
against 1.46, and the lych-gate crop is pixel-identical south of the gate.

### Still carried

- **Trees and buildings cast nothing on grass.** *That* one does need a texture,
  with a reach that excludes `distantRelief`.
- From §16: 07's 320–360 band and 10-ridge-west's 200–240 still lost spread to the
  swell; the two southern vistas gain nothing by design.
- From §14: the cloud slab has one height, and the gameplay camera frames very
  little sky — still the largest open question in this document.
