# Warlock render overhaul — implementation plan

Self-contained brief for an agent with **no prior chat context**. Goal: close the gap between the current live render and a dark-wizard reference plate by changing the **rendering design**, not by retuning albedos.

---

## 1. Goal

Make the playable third-person figure read like a high-fidelity dark wizard: near-black ambient, dual local lights (cool purple emitter at the staff tip, warm ember at the base), face-void hood, heavy tattered cloth, light living in the air (bloom + particles + fog scatter), and a painterly post grade.

**Do not** treat this as another palette / hem-length / pin-rate pass. Those were tried. Value percentiles vs the reference are already close; the failure is architectural (lighting model, occlusion of local lights, fabric mid-frequency detail, particle/emission design, post grade, environment recession).

### Reference assets (on disk)

| Role | Path |
|------|------|
| Target look | `.cursor` assets / user-provided warlock plate (also copied as `.shots/ref.png` if present) |
| Typical current failure plate | user screenshot of side profile with purple “plastic” cloak, flat sky, flower-shaped particles |
| Prior agent plates | `.shots/final-hero.png`, `.shots/pass5-*.png`, etc. |

If `.shots/ref.png` is missing, place the target painting there before running metrics.

### Success (measurable, not eyeballed)

On a **figure crop** and a **cloak-panel crop** of a fixed hero plate vs the reference:

| Metric | Reference (approx) | Current (approx) | Target |
|--------|--------------------|------------------|--------|
| Cloak hue circular std | ~27° | ~15° | ≥ 25° |
| Cloak single 30° hue-bin mass | low | **~82%** in one bin | **≤ 50%** |
| Mean saturation (figure) | ~0.50 | ~0.50 | stay ~0.5; don’t chase sat |
| Value p25/p50/p75 (figure) | ~24/40/59 | ~15/46/69 | within ~20% of ref |
| Visual | grey-blue cloth, purple only on emitters | monochrome violet plastic | grey cloth + chroma on emission only |

**Rule going forward:** key and fill are near-grey; **only emission carries chroma**.

---

## 2. Repo contract (non-negotiable)

This project is Babylon.js 9 **WebGPU** with a **fully custom** lighting / material / post pipeline. Read `.agents/skills/babylon/SKILL.md` before coding.

- `WebGPUEngine` only. WGSL via `ShaderMaterial` + `ShaderLanguage.WGSL`.
- Deep ESM imports from `@babylonjs/core/...`. No barrels.
- **Do not** light the hero with stock `DirectionalLight` / `PointLight` / `ShadowGenerator` / `PBRMaterial` / `DefaultRenderingPipeline` while the world stays on the custom path.
- Inspector is allowed as a **dev diagnostic** (F8). Use it to inspect RTTs and GPU time. Do not create stock lights or a default pipeline from its UI.
- Geometry is procedural (`MeshBuf`, cloth grids, character `build.js`). No glTF required for this overhaul (optional later; not the path of least resistance).
- Dev: `npm run dev` → Vite **5173**. Runtime debug handle: `globalThis.DUSKWELL` (alias `SNOWFLOW`).

**Rejected shortcut:** lighting the hero with stock Babylon PBR + PointLight shadows while the world stays on the custom SH/CSM path. Two lighting models in one frame will disagree at boots/hem worse than the current look.

---

## 3. Current architecture (what you are modifying)

| Area | Where |
|------|--------|
| Character materials / uniforms | `src/character/character.js` |
| Cloth sim + bind shapes | `src/character/cloth.js` |
| Body / hood / fur meshes | `src/character/build.js` |
| Character / cloth shading | `src/shaders/char.fragment.wgsl`, `cloth.vertex.wgsl` |
| Spell / held local lights (max 4) | `src/spells/spellLights.js`, `src/shaders/lib/spellLights.wgsl` |
| Staff, crystal, beads, held lights, aura particles | `src/world/grove.js` |
| Cascade shadows | `src/render/shadows.js` |
| Sky SH + LUT | `src/render/sky.js` |
| Post (SSR, TAA, bloom, DOF, AgX tonemap, shafts) | `src/post/postChain.js`, `src/shaders/post/*` |
| Particles | `src/vfx/particles.js`, `src/shaders/spray.fragment.wgsl` |
| Tunables | `src/core/settings.js` (`ambientIntensity`, `sunElevation`, `exposure`, `bloomStrength`, fog, etc.) |
| Gear albedo overrides | `src/game/loadout.ts` (`duskweave_robe` overwrites robe/mantle every frame) |

Held staff lights are declared each frame via `spells.onBeforeApplyLights` → `grove.declareHeldLights`. They are **unshadowed** inverse-square wraps. That is why saturated violet reaches into every fold and turns the costume monochrome.

Character depth-caster / prepass materials already exist per mesh in `character.js` — reuse them for a local cube shadow, don’t invent a second mesh path.

---

## 4. Diagnosis (why prior “overhauls” failed)

Measured with canvas `getImageData` on reference vs live screenshot:

1. **Value ladder is not the bottleneck.** Whole-frame and figure luminance distributions are already in the same ballpark as the painting. Pushing mantle albedo up/down only recolourises the same plastic sheet.
2. **Hue is the bottleneck.** Cloak is ~82% mass in one violet hue bin because the **staff tip light is a saturated key** and has **no local occlusion**.
3. **Mid-frequency fabric detail is missing at viewing distance.** Weave fades with UV footprint (~1.5 m). What HF remains is wrong: particle edge wobble (flowers), fur shells (bristles).
4. **Background competes.** Lit canopy cards, mushrooms, NPC markers — reference background is a dark void.

Prior work that already exists and should be **kept as geometry base**, not treated as the finish line:

- Floor-length ragged robe + long mantle with streamers (`cloth.js`).
- Face void (skin AO collapse in `char.fragment.wgsl`).
- Tall staff, crystal, beads, tip/base lights, aura emit (`grove.js`).
- Pale mantle / dark robe palette defaults + loadout overrides.

That got silhouette closer. It did **not** get fidelity.

---

## 5. Implementation phases

Order is impact-ranked. **Do not skip Phase 0.** Each phase has acceptance gates; stop and re-plate before the next.

### Phase 0 — Plate harness (~0.5 day)

**Deliverable:** `scripts/plate.mjs` (or similar) that:

1. Assumes `npm run dev` on 5173 (or launches Vite).
2. Via Playwright / CDP, waits for `globalThis.DUSKWELL`.
3. Sets a **fixed** character position, facing, camera (`DUSKWELL.rig` yaw/pitch/distance), hides HUD if needed.
4. Saves PNG under `.shots/plate-<name>.png`.
5. Loads `.shots/ref.png` + plate, crops figure + cloak panel, prints metrics table (value percentiles, mean sat, hue circular std, max 30° hue-bin mass, optional HF energy).

**Optional:** expose `DUSKWELL.capturePlate(name)` later; harness first.

**Accept:** one command produces metrics for ref vs ours without manual browser fiddling.

```
npm run plate
# metrics-only against an existing shot:
node scripts/plate.mjs --metrics-only --ours .shots/ours.png
```

Writes `.shots/plate-hero.png`, crop dumps (`*-figure.png`, `*-cloak.png`), and prints the hue/value table. Capture drives system Chrome over CDP (no Playwright install).

---

### Phase 1 — Relight (highest impact, ~2 days)

#### 1a. Split emission vs illumination for the staff tip

**Files:** `src/world/grove.js` (`declareHeldLights`), crystal material / `grove.fragment.wgsl` (or dedicated crystal shader if split).

- Crystal / tip **emission** stays saturated HDR for bloom.
- Tip **spell light** becomes desaturated violet-grey, ~⅓ current intensity, shorter radius.
- Ember base light stays warm but also somewhat desaturated in the *illumination* channel; keep chroma on the particle/emissive ground cue.

**Accept:** cloak hue-bin mass drops before shadows land; cloth looks greyer under the same albedo.

#### 1b. Local cube shadow from the orb (hero light occlusion)

**New:** `src/render/localShadow.js` + `src/shaders/lib/localShadow.wgsl`.

- 6×256² (or 512² if budget allows) depth cube from tip world position.
- Casters: character body + cloth only (reuse existing depth materials).
- Sample in `char.fragment.wgsl`, and lightly in `snow.fragment.wgsl` / `grove.fragment.wgsl` near the hero so ground contact matches.
- Soft PCF; bias tuned so cowl interior and under-mantle go dark.

**Accept:** folds and cowl show real occlusion from tip light; plastic wrap lighting gone.

#### 1c. Key / rim / ambient for the figure

**Files:** `src/core/settings.js`, `src/character/character.js` (or char shader), `src/render/sky.js` if sun/moon vector changes.

- Moon / sun: lower elevation for hero framing; cool grey-blue key, **not** a flat 46° fill.
- Character ambient: ~40% of scene SH intensity; remove / shrink directionless pedestal term in `char.fragment.wgsl`.
- Optional camera-relative rim (cool, narrow Fresnel) independent of saturated spell light.

**Accept:** silhouette separation without painting the whole cape violet.

#### 1d. Cloth-to-body capsule AO

**Files:** `char.fragment.wgsl` or CPU upload of capsule params from the same capsules in `cloth.js`.

Analytic AO where cloak wraps torso/arms. Cheap; darkens contact without needing SSAO.

**Phase 1 accept (mandatory metrics):**

- Cloak hue circular std ≥ 25°
- No single 30° hue bin > 50%
- Fold contrast on cloak crop within ~20% of reference (local stddev or HF energy)

---

### Phase 2 — Surfaces (~2 days)

#### 2a. Fabric detail stack

**New:** bake or load tileable 512² wrinkle + fibre normal/roughness (pattern exists: `src/shaders/detailBake.fragment.wgsl`). Sample at **two scales** in fabric UV in `char.fragment.wgsl`. **Do not** distance-fade the mid scale to death at 3–6 m.

#### 2b. Ragged silhouette via alpha-test

UV noise threshold near robe hem / mantle edge / hood rim. Same discard path in **prepass + shadow + local-shadow casters** (materials are already split in `character.js`). Geometric scallops alone read as “trim”; broken edges read as “tattered”.

**TAA risk:** jittered discard shimmer → use stable hash in UV space and/or alpha-to-coverage.

#### 2c. Remove hood/cuff fur shells as the primary edge

`build.js` / `buildFur`: drop or gut fur; replace with alpha fray on cloth/hood. Fur shells currently fight the warlock read.

#### 2d. Fabric response to local lights

Kill broad GGX from spell lights on wool; sheen at grazing only; high roughness with variance from 2a.

#### 2e. Wear

Hem soot/mud darkening, ridge lightening, deeper crease darkening (AO/curvature already present — strengthen selectively).

**Accept:** silhouette perimeter looks broken; cloak local contrast approaches ref; no fur “bristle rim”.

---

### Phase 3 — Emission and particles as light (~1 day)

**Files:** `spray.fragment.wgsl`, `particles.js`, `grove.js` `emitAura`, atmosphere lib.

- Magic particles: **no** edge wobble flowers; gaussian core; HDR; 2–8 mm world size + screen-size clamp; soft-particle depth fade.
- Analytic point-light **in-scatter** along view ray in fog (closed form for point light in homogeneous medium) so orb/ember glow *in air* — `src/shaders/lib/` atmosphere include used by snow/char/tonemap path as appropriate.
- Emissive HDR ground decal / soft disc under staff base for ember pool.

**Accept:** particles read as sparks, not petals; visible air glow around tip without raising cloth chroma.

---

### Phase 4 — Post grade (~1 day)

**Files:** `src/shaders/post/tonemap.fragment.wgsl`, `postChain.js`, `settings.js`.

After AgX:

- ASC-CDL lift/gamma/gain
- Split-tone: shadows → blue-grey, highlights → warm
- Midtone desaturation
- Luminance-dependent animated grain
- Vignette
- Extra wide, low-energy bloom tier for **halation**; bloom threshold so mostly **emission** blooms (raise threshold / gate on luminance)

Hero framing defaults: ~35° FOV, slight low angle, DOF isolating figure (`dof.fragment.wgsl` already in tree).

**Accept:** stills look “graded”, not “game UI over a lit set”; bloom on crystal/embers, not on whole cloak.

---

### Phase 5 — Environment recession (~0.5 day)

**Files:** `settings.js` fog/aerial, `grove.fragment.wgsl`, sky, mushroom/wisp intensities, HUD/nameplates if needed for plates.

- Dense dark violet-grey haze beyond ~8 m so grove → silhouettes
- Darker sky gradient; dim mushrooms / NPC glow / nameplates for hero plates
- Reference background is a void — stop lighting the set like a daytime diorama

**Accept:** figure dominates; background no longer steals the eye in the hero plate.

---

### Phase 6 — Geometry polish (last, ~1 day)

Only after 1–4. Same mesh under new lighting should already look different.

- Slender proportions under cloak if needed
- Staff hand pose / no shaft intersection
- Hands / pooling contact on ground
- Optional: more streamer columns, bead chain readability

**Do not** start here. Geometry was not the measured failure mode.

---

## 6. Suggested work order for the next agent

```
Phase 0 harness
  → Phase 1a emission/illumination split (fast, proves hue metric)
  → Phase 1b local cube shadow (main fidelity unlock)
  → Phase 1c–1d ambient/rim/capsule AO
  → re-plate + metrics gate
  → Phase 2 surfaces
  → Phase 3 particles/atmosphere
  → Phase 4 grade
  → Phase 5 recession
  → Phase 6 geometry only if still needed
```

Commit after each phase gate with a message that names the **metric** improved (e.g. “local tip shadows cut cloak hue-bin mass”).

---

## 7. Files likely touched (checklist)

**New**

- [x] `scripts/plate.mjs` (or `scripts/plate-metrics.mjs`)
- [x] `src/render/localShadow.js`
- [x] `src/shaders/lib/localShadow.wgsl`
- [ ] Fabric detail bake assets / `lib/fabricDetail.wgsl` (or extend detail bake)

**Core edits**

- [x] `src/world/grove.js`
- [x] `src/shaders/char.fragment.wgsl`
- [ ] `src/shaders/spray.fragment.wgsl`
- [ ] `src/shaders/post/tonemap.fragment.wgsl`
- [ ] `src/post/postChain.js`
- [x] `src/character/character.js` (casters, uniforms, maybe drop fur)
- [ ] `src/character/build.js`
- [ ] `src/core/settings.js`
- [ ] `src/shaders/lib/spellLights.wgsl` (if wrap/spec behaviour changes)
- [ ] `src/main.js` (wire local shadow update each frame)

**Maybe**

- [ ] `src/shaders/snow.fragment.wgsl`, `grove.fragment.wgsl`
- [ ] `src/game/loadout.ts` (only if albedo must track new lighting — prefer not)

---

## 8. Verification recipes

### Metrics in browser (no harness yet)

Serve ref at `http://localhost:5173/.shots/ref.png` (copy painting into `.shots/ref.png`). Evaluate crops with canvas `getImageData`; compute luminance percentiles, HSV saturation, circular hue std, 12-bin hue histogram.

### Manual plate via `DUSKWELL`

```js
const D = globalThis.DUSKWELL;
D.rig.yaw = /* fixed */; D.rig.pitch = /* fixed */;
D.rig.distance = D.rig.distanceTarget = /* ~3–4 */;
D.character.facing = D.rig.yaw + Math.PI; // or desired
// wait for cloth settle, screenshot
```

### Perf budget

Character ~24k tris is fine. Local cube shadow: 6 small depth passes of body+cloth only. Stay at display refresh if possible; note regressions in the commit.

### Console

Shader compile errors show as WebGPU validation / black screen. Fix WGSL `let` immutability, array uniforms, etc. before tuning looks.

---

## 9. Explicit non-goals / anti-patterns

- Do **not** call another albedo-only or loadout-only change an “overhaul”.
- Do **not** raise saturated tip light intensity to “pop” the plate.
- Do **not** add stock Babylon lights/shadows/PBR for the hero.
- Do **not** start with Blender/glTF unless Phase 1–4 are done and geometry is still the bottleneck.
- Do **not** spend days on canopy leaf cards before the figure’s lighting model is fixed (canopy is Phase 5 recession / later set dressing).

---

## 10. Estimated effort

| Phase | Effort |
|-------|--------|
| 0 Plate harness | ~0.5 d |
| 1 Relight + local shadows | ~2 d |
| 2 Surfaces | ~2 d |
| 3 Emission / particles / air light | ~1 d |
| 4 Post grade | ~1 d |
| 5 Environment recession | ~0.5 d |
| 6 Geometry polish | ~1 d |
| **Total** | **~7–8 working days** |

---

## 11. One-sentence north star

**Grey cloth shaped by occluded cool light and warm ground fill; purple exists only as emission in the air and on the staff — then grade the frame like a still, not like a lit toy.**
