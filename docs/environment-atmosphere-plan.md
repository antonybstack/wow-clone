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
