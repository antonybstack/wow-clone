# Armed character and Orc repair plan

Status: **planned; implementation not started**. Created 2026-09-18 from the [live review](complete/current-state-review-2026-09-18.md), baseline `ea7df36`. This is the active repair plan, replacing further race/equipment expansion as the immediate priority. Update checkboxes and evidence after each completed slice; adjust approaches when live evidence disproves them.

## Goal and boundaries

Deliver a convincing Human staff/greatstaff character whose idle, directional movement, jumping and casting remain coherent; then make the existing Orc wear the same logical equipment without broken anatomy, displaced clothing or misleading previews.

Preserve Babylon **Lite**, WebGPU, Havok movement, the native animation manager, existing source animations, working spell timing, catalogue identifiers and streamed equipment. Keep the approved gritty Sword Hero-inspired churchyard direction. Do not restart the game, introduce Classic Babylon APIs, add Undead/more outfits, or undertake broad environment work during this repair.

**Finish each slice with actual gameplay and reviewed captures.** Mesh visibility, clip names, wrist-axis proximity and passing tests are supporting evidence, not visual acceptance. Do not repeat the prior mistake of labelling a prototype complete based only on those checks.

## Execution order

| Step | Deliverable | Dependency |
| --- | --- | --- |
| 0 | Preserve baseline and make validation representative | None |
| 1 | Neutral Human armed posture with correct directional legs | 0 |
| 2 | Active-rig finger data and race-specific prop contact | Start after the Human pose direction is selected; finish before Orc fit acceptance |
| 3 | Reliable race-switch transaction and visible failure feedback | Independent correctness repair; finish before relying on race comparison |
| 4 | Gameplay-equivalent Armory previews | Share the repaired composition from 1; do not build a second controller |
| 5 | Correct Orc garment binding, deformation and coverage | 2–4 |
| 6 | Consolidated visual regression, performance and delivery | All above |

The first user-visible delivery is **the repaired Human armed movement**, not a new architecture diagram or another race. Steps 2 and 3 are bounded shared correctness fixes. This order is not authorization to launch agents; direct implementation remains the default.

## 0. Baseline and review harness

- [ ] Read `docs/CURRENT.md`, this plan and current code; preserve unrelated checkout work, including `.claude/`.
- [ ] Confirm root `ashen-reach.html?play&clean` on Vite 5173 and owned Chrome/CDP target before interacting.
- [ ] Retain comparison captures of Human Warden live front/side idle, directional movement and casts; Orc Graveweaver front/side and movement. The initial evidence is in ignored `.cache/current-review/`, with reproducible probe scripts there. If absent, reproduce instead of trusting an old report.
- [ ] Record browser viewport and actual `ASHEN.metrics.summary().resolution`; these are not necessarily equal.
- [ ] Keep diagnostics out of the shipped product flow. Raw clip audition and close-up cameras are useful, but label them clearly.

Baseline: 25 equipment tests passed despite the reported defects. One review sample measured ~144 FPS at **960×675 actual render**, 1280×900 viewport, single Human, no recording. Do not inherit that number as proof of subsequent changes or native-resolution performance.

## 1. Human posture and directional locomotion

### Current cause

`src/character/body.js` chooses a directional gait, then the `if (twoHand && visual.handGrips?.()?.twoHanded)` block replaces it with `Walk_Carry_Loop`. This replaces backpedal, strafe and run leg motion as well as the upper body. Stationary playback moves to `TWO_HAND_STILL_TIME`; freezing a walk phase still produces the pronounced backward lean seen in gameplay.

Primary files:

- `src/character/body.js`: gait selection, blending, airborne/cast precedence and idle settle logic.
- `src/character/runtime/body-visual.js`: native groups, masks, additive setup and `locoClips` membership.
- `src/character/runtime/playable-body.js`: body/clip definitions, if new reviewed clips must be declared.
- `src/ashen-reach/equipment-grips.js`: committed equipment intent.
- `scripts/ashen-reach/append-carry.mjs`: current licensed import/retarget pipeline.

### Implementation direction

1. Preserve the original directional gait result. Equipped carry intent must not replace the lower-body gait with a universal full-body walk. Remove the live dependence on parking a walking clip at `TWO_HAND_STILL_TIME` once the replacement is ready.
2. Audition existing compatible weapon-ready/carry clips first. Use the current CC0/MIT import infrastructure for a narrowly researched alternative if necessary. Verify licence, rig compatibility, axis/scale and the actual character silhouette before integrating. A box-carry pose is not automatically a suitable staff stance.
3. Establish a neutral armed idle: feet planted, pelvis balanced, torso and head upright, elbows comfortably bent, wrists neither folded nor locked. Review front **and side**, at gameplay distance and close-up. Do not search indefinitely for a less-bad frozen walk timestamp.
4. Separate **directional lower-body locomotion** from **equipped upper-body presentation** using the native Lite mixer. First demonstrate a single Human greatstaff hold over idle/walk/run; extend to backward/strafe/turn only after that visual proof.
5. Choose additive versus absolute layering after testing installed Lite blending semantics. For additive carry, generate an explicit compatible reference pose and correctly formed local rotation deltas; simply marking an arbitrary clip additive can subtract the wrong frame. For absolute carry, compose masks and complementary weights so base upper-body animation does not dilute or double the carry contribution. Do not assume two full-weight overlapping groups create priority layering.
6. Keep pelvis/root translation, leg timing and movement ownership in the locomotion/controller path. Limit carry influence to reviewed spine/clavicle/arm joints; avoid inheriting the carry source's backward root/pelvis lean. Do not suppress normal gait head motion unless the weapon hold actually requires it.
7. Spell motion must take precedence over carry arms. Blend carry out/in around the existing cast lifecycle, including cancellation; preserve Fire Blast movement and Lava Ball stationary charge/interruption. Use existing cast state, not a duplicate timer.
8. Define airborne behavior deliberately. If releasing the off-hand for a jump, visibly open/release it; if retaining a two-handed hold, preserve the required arm layer while the native jump controls the legs. Do not accidentally drop to an unrelated source arm pose with a supposedly attached two-handed grip.
9. Preserve source assets and rig binds. Put derived clips in the established reproducible asset pipeline; update clip preservation checks only for intended additions, never weaken them to hide lost source motion.

Conceptual ownership, **not an existing API or a command to create a framework**:

```text
controller motion -> directional gait + phase
committed equipment -> desired hold profile
cast / airborne state -> hold influence and release policy
native mixer -> one composed pose
finger grip evaluator -> overrides submitted before that evaluation
socket sync -> held props and spell origins
```

The current code already has these pieces; change the smallest relevant boundaries. Never evaluate a second animation clock or bake the skeleton after animation to impose a pose.

### Acceptance

- [x] Armed idle no longer has the exaggerated backward lean or sky-facing chin.
- [x] W, Shift+W, S, Q/E and A/D retain appropriate run/walk/back/strafe/turn behavior and unchanged controller speeds.
- [x] Diagonal movement, repeated start/stop and turning do not lose the hold or change body scale.
- [x] Both hands make believable contact with the greatstaff during the declared two-handed phases; staff/book one-handed outfit remains convincing.
- [x] Jump/land, moving Fire Blast, Lava Ball release and movement/jump cancellation work without hand snapping or pose lockup.
- [ ] A short real gameplay recording, including side view, is reviewed before calling this complete. *(Reviewed live stills front/side/back for every input below; no video captured in this pass.)*

### Step 1 completion record — 2026-09-18 (partial: locomotion repaired, staff angle still wrong)

**What changed** (three files, no commit):

- `src/character/runtime/body-visual.js`: added `CARRY_UPPER_BONES` (both shoulders, arms, forearms, hands) and a complementary mask pair built once per visual — `visual.carryMask` (Include) for `Walk_Carry_Loop`, `visual.carryLocoMask` (Exclude) for the clips that give those joints up. Removed `clips.twoHand` from `locoClips`, so the carry can no longer enter stance normalization, pose-transition crossfades, landing weight scaling, gait-contact prepositioning or the cast loco overlay. Exported `TWO_HAND_STILL_TIME` (moved from `body.js`) and `CARRY_WEIGHT`.
- `src/character/body.js`: deleted the `if (twoHand && visual.handGrips?.()?.twoHanded) { target = twoHand; … }` override; directional target selection, speed ratios, gait phase/contacts and normalization are untouched. Added `updateCarry(dt, motion, castOverlay)`, called once per frame from `update()` after `applyLocoOverlay` and before the single `evaluateHandAnimation` → `updateAnimationManager`. It applies the mask pair, plays the carry at `CARRY_WEIGHT`, keeps the existing moving cadence (`WALK_RATIO`/`RUN_RATIO`) and the stationary ease to `TWO_HAND_STILL_TIME` over `TWO_HAND_SETTLE`, and restores masks and stops the clip in the same frame when the hold ends. `getClipLabel()` now reports the carry as an extra instead of replacing the gait name; `endInspection()` re-establishes the layer before evaluating.
- `src/character/runtime/inspection-preview.js`: the standard Idle/Walk/Run/Jump/Landing options mirror the equipped gameplay composition when a two-handed prop is held (step 4's parity, applied narrowly here); the raw audition is relabelled "Two-handed carry (raw source clip)".

**Why complementary masks rather than a fractional weight.** Lite's weighted glTF mixer slerps a joint by accumulated weight (`weight / (accumulated + weight)`), and `setAnimationWeight` rejects weights above 1, so a carry layer sharing a joint with a weight-1 gait clip can never exceed a 50/50 blend — the arms would sit between the gait swing and the hold and both hands would leave the shaft. Exclusive ownership per joint plus `CARRY_WEIGHT = 1 - Number.EPSILON` (selects the weighted mixer, rounds to 1 in its Float32 accumulators) gives the carry the arms outright and keeps accumulated rotation weight ≥ 1, so `uploadTarget`'s rest-pose blend never pulls a joint toward bind. The carry clip animates rotation only on those joints (its lone translation channel is on Hips, which the mask drops), so no unnormalized translation/scale accumulation is possible. Cost: engaging/releasing the layer is a mask switch, not a crossfade — see limitations.

**Checks run.** `npm run build`; `npm run test:equipment` (25 pass); `npm run test:character` (75 pass); live on the owned Chrome/CDP 9337 against Vite 5173: `check-two-handed` (18 pass, including both-hands-on-shaft at three Armory phases, during live movement and after both spells), `check-graveweaver` (19), `check-armory` (26), `check-grips` (19), `check-orc-equipment` (17), `check-fire-blast-play` (14), `check-lava-ball` (16), `check-gait-play` (all checks true, worst phase disagreement 2.2e-16). Zero runtime/WebGPU errors in every run.

**Live play and reviewed captures** (ignored `.cache/armed-repair/shots/`, probes beside them):

| Input | Composition observed live | Reviewed capture |
| --- | --- | --- |
| Idle | `Idle_Loop` + `Walk_Carry_Loop` | `repair-1/idle-front.png`, `idle-side.png`, `idle-back.png` |
| W | `Sprint_Loop` + carry | `repair-1/run-fwd-side.png`, `run-fwd-front.png` |
| Shift+W | `Walk_Loop` + carry | `repair-1/walk-fwd-side.png` |
| S | `Jog_Bwd_Loop` + carry | `repair-1/back-side.png` |
| Q / E | `Jog_Left_Loop` / `Jog_Right_Loop` + carry | `repair-1/strafe-left-front.png`, `strafe-right-front.png` |
| A / D | `Turn90_L` / `Turn90_R` + carry | `repair-1/turn-left-front.png`, `turn-right-front.png` |
| W+E diagonal | `Sprint_Loop` 0.50 + `Jog_Right_Loop` 0.50 + carry | `repair-1/diagonal-front.png` |
| Space | `Jump_Start`/`Jump_Loop` + carry (hold retained airborne by design) | `repair-1/jump-side.png` |
| Digit1 / Digit2 | carry released, `FireBlast_*` / `LavaBall_*` own the arms; carry returns after recovery | `repair-1/fire-side.png`, `after-fire-front.png`, `lava-side.png`, `after-lava-front.png` |
| W + Digit1 (moving cast) | `Sprint_Loop` + `FireBlast_Upper`, staff stows to back, then run + carry with the staff back in hand | `moving-cast/moving-cast.png`, `moving-after.png` |
| Armory Idle/Run while armed | equipped composition now shown (`Idle_Loop` + carry), raw clip kept as a separate option | `armory/preview-idle.png`, `preview-run.png`, `preview-carry.png`, `after-armory.png` |

Before/after: `shots/baseline/idle-side.png` (arched backward lean, chin up, single `Walk_Carry_Loop` at weight 1 for **every** state) versus `shots/repair-1/idle-side.png` (upright torso, level hood) and the directional clip names above.

**Performance.** Owned foreground Chrome/WebGPU, 1280×900 viewport, **963×636 actual render**, single Human in Warden with the greatstaff, no recording, 4 s samples: idle 144.0 FPS, mean 6.94 ms, p95 7.60 ms, 44 draw calls, 126 512 triangles; running (W held) 144.0 FPS, mean 6.94 ms, p95 7.60 ms. The 144 figure is display-capped, so this is "comfortably above the 120 FPS goal at this resolution", not a headroom measurement or native-resolution/crowd proof.

**Remaining defects and limits — this step is not visually finished:**

1. **The greatstaff still reads as a horizontal pole across the waist.** The hold is upright and both hands are on the shaft, but the shaft is roughly level and juts out to both sides in the ordinary third-person camera; it is not the diagonal/planted staff carry the outfit wants. This is inherent to the CC0 box/pole `Walk_Carry_Loop` arm pose combined with the solved grip, not to the chosen phase: auditioning the equipped composition across the loop (`shots/phases/phase-*.png`, 0.0–1.33 s) shows the staff level at every phase. Fixing it needs a reviewed staff-specific arm pose (or a small reviewed correction on top of the carry), which is deliberately out of this step's scope.
2. **Engaging/releasing the carry is a mask switch, not a crossfade.** Equip/unequip, cast start and cast recovery change arm ownership in one frame. It is masked in practice by the 0.35 s prop travel and the cast gesture, but a fast unequip during a run can show a single-frame arm change.
3. **Carry arm cadence is not gait-synchronised.** While moving, the carry advances at `WALK_RATIO`/`RUN_RATIO`, independent of `gaitContacts` phase; arm sway and footfalls are not locked together. It is not noticeable at gameplay distance in the captures, but it is a real approximation.
4. **Running tilts the staff with the sprint torso lean** (`run-fwd-front.png`): because the arms are local to the leaning chest, the shaft pitches diagonally during a sprint. That reads better than the idle hold, but it was not art-directed.
5. **No gameplay video was captured** in this pass; acceptance above rests on reviewed stills from the real renderer at the gameplay camera plus labelled diagnostic front/side orbits.
6. The Orc receives the same layer — live switch to Orc + Warden shows `Idle_Loop`/`Sprint_Loop` + carry with both hands on the shaft (`shots/orc/orc-idle-front.png`, `orc-run-front.png`) — but it inherits limitation 1, and its garment fitting is still the unreviewed prototype from step 5. No Orc art claim is made here.

## 2. Finger anatomy and physical prop contact

### Current cause

`src/character/runtime/hand-grip.js` submits Human `source-hand-poses.json` translations to every active body through `setBonePoseDeferred`. Orc joints have different local translations. Example LeftHandIndex1: Human approximately `[-1.72,11.64,0.05]`, Orc `[-5.10,15.11,1.61]`, in source rig units. This alters Orc anatomy even before choosing the correct curl.

Primary files: `hand-grip.js`, `source-hand-poses.json`, `equipment-grips.js`, `equipment-catalog.js`, `equipment-contract.js`, `equipment-stream.js`, `equipment.js`, `src/character/sockets.js`, and the source/pack preparation scripts.

### Implementation direction

- Obtain each visual's **own immutable rest-local translations and rotations**, keyed by its fit/bind identity and bone name. Extract a compact profile during asset preparation if native public runtime metadata is insufficient. Do not read animated transforms as rest values or add scattered undocumented engine-private accesses.
- Continue using deferred poses before the single mixer evaluation. Where that API requires translation as well as rotation, pass the active rig's translation. Even when releasing grip for casting, do not write Human rest values into the Orc.
- Cache by active visual/profile; invalidate naturally when changing skeleton. Validate profile compatibility instead of falling back silently to Human.
- Reuse rotation deltas only when joint frames genuinely match. Otherwise author/retarget a reviewed Orc grip profile. Shared names and a shared joint count do not establish identical bind axes.
- Extend item fit resolution to supply race-specific **grip position, rotation and pose** while preserving the same item ID. Resolve these consistently in both streamed and retained preloaded paths. If a fallback path cannot support a race, disable that combination with a truthful message rather than showing mismatched gear.
- Define the greatstaff's actual grip zones in prop-local coordinates. Right hand owns the rigid prop; the off-hand must contact its finite intended segment. Start with a compatible authored hold and fitted offsets. If residual off-hand drift remains, evaluate a small existing compatible IK/correction solution; do not start a generic full-body solver project.
- Keep the book's physical carrying strap. Verify its hand contact after pose changes. Match shaft/strap thickness to the hand rather than hiding penetration by enlarging gloves.

### Acceptance

- [ ] Active rig rest translations remain unchanged across grip/relaxed/cast states.
- [ ] Human and Orc profiles are validated against their own fit identity.
- [ ] Bare and gloved fingers wrap the intended surface from palm, back and underside views.
- [ ] Contact tests use palm/finger landmarks and finite prop grip regions; a wrist lying on an infinite line is insufficient.
- [ ] Tolerances derive from actual shaft radius/hand dimensions and report penetration and separation separately. Avoid arbitrary broad thresholds chosen to pass existing broken poses.
- [ ] Tests cover full cycles and transitions, not only three convenient carry timestamps.

## 3. Transactional race changes

### Reproduced failure

A simulated HTTP 503 for the Orc equipment manifest left an Orc visible with `equipment.race === 'human'` and the Human selector still active. `main.js` hides old equipment and swaps the body before new equipment succeeds. `body.restoreSource()` currently retires the active Orc immediately, so fixing only Human→Orc with a catch block does not solve rollback in the reverse direction. `armory.js` then clears the failure feedback in its final UI refresh.

Primary files: `src/ashen-reach/main.js`, `src/character/body.js` (`swapSource`, `restoreSource` and visual lifecycle), `src/ashen-reach/equipment-stream.js`, `equipment-loader.js`, `armory.js`, and socket rebinding.

### Implementation direction

Use a small two-phase transaction: **prepare while the current actor remains valid, then commit the prepared replacement**.

1. Snapshot committed race, loadout, visibility and preview intent. Gate conflicting UI mutations while preparing; do not let an equipment change race against a stale loadout snapshot.
2. Load/validate the candidate body, compatible rig/profile and selected garments without replacing the active body or destroying the old one. Candidate preparation must not install its grip provider on the active visual or rebind shared spell sockets prematurely.
3. Separate preparation from visibility/commit in the current helpers as needed. Use a candidate body facade/private candidate sockets or a preparation-only equipment stage. Candidate meshes and props must remain hidden; check actual mesh visibility semantics rather than assuming hiding one root hides all children.
4. Validate all async work before committing. Switch body reference, equipment implementation, grip provider, sockets, race and UI state together at a frame boundary with no awaits inside the commit. Preserve the old snapshot until that commit succeeds.
5. Dispose superseded equipment/body resources only after commit. Borrowed garment palettes must follow their existing ownership contract: restore owned skeleton resources before disposal so the actor's palette is not freed.
6. On failed preparation, dispose the candidate and keep the old actor completely usable. On cancellation/stale request, discard only that candidate. If commit can throw, restore the retained old state before retiring anything.
7. Make both Human→Orc and Orc→Human symmetric. Do not destructively call `restoreSource()` until a rollback-safe replacement exists.
8. Keep a dedicated error state in Armory; routine race/UI refresh must not overwrite it. Clear it after a successful retry or explicit dismissal.

These are proposed responsibilities, not existing API names. Avoid replacing the equipment loader or introducing a general transaction framework.

### Acceptance

- [ ] Inject failed manifest, body and selected-garment requests in each direction; original actor, outfit, sockets and selector remain consistent and usable.
- [ ] A clear error remains visible; retry succeeds.
- [ ] Rapid requests or closing Armory while preparation is pending cannot commit stale UI/body state.
- [ ] No visible duplicate characters, empty actor frame or disposed palette use.
- [ ] Returning to Human preserves committed item selection and spell functionality.

## 4. Trustworthy Armory previews

Primary files: `src/character/runtime/inspection-preview.js`, `body.js`, `body-visual.js`, and `src/ashen-reach/armory.js`.

- Share the repaired pose-composition policy between gameplay and the default preview. Standard Idle/Walk/Run must reflect equipped carry and finger behavior.
- Drive preview with a controlled motion description and deterministic time; **do not simulate actual Havok movement or emit combat events** to preview a pose.
- Keep raw source-clip audition as an explicitly labelled diagnostic mode, including the original Carry clip if useful. It must not masquerade as equipped gameplay.
- Seek base and overlay phases coherently. Pause must freeze all contributors; scrub must not continue advancing a hidden carry or recovery clock.
- Restore clip masks, weights, loop settings and gameplay ownership on close and race switch. Repeated open/close must not accumulate layers or change gait behavior.
- [ ] Compare gameplay and preview at matched controlled states for each outfit/race, including active clips/weights and evaluated pose landmarks.
- [ ] Visually verify front/side idle, walk, run, jump and spells; previews cause no damage, cooldown or audio side effects.

## 5. Orc garment correctness before further art polish

Primary authoring files: `scripts/ashen-reach/fit-orc-clothes.py`, `prepare-orc-equipment.mjs`, `split-orc-equipment.mjs`, their documented inputs/provenance, and `public/ashen-reach/equipment-orc/`.

The review established **visible displacement**, not the exact cause of every garment failure. Do not assume one global offset will fix hood, torso and skirt.

### Audit sequence

1. Reproduce the fully equipped Orc in the **runtime split pack**. Compare against the final bulked Orc, not the earlier unbulked body or an offline render alone.
2. Compare garment mesh world transforms, vertex coordinate space, joint-name/order mapping, inverse binds and rest joint world matrices before and after rebinding. The current pack assembler maps joint indices and assigns the actor skin; prove that the garment vertices are already in that skin's bind space.
3. Verify that deformations used to bulk/reshape the Orc were applied consistently to both body correspondence and garment fitting. Audit nearest-neighbour correspondence around nearby but distinct surfaces such as fingers, tusks, face, armpits and crossed garment panels.
4. Correct one garment at a time: hood/head opening, torso/neck/waist, gloves/wrists, trousers/boots, then robe skirt. Inspect neutral, walk, run, cast and crouched/airborne extremes before moving to the next.
5. Audit weights after matching rest-space geometry. Long robe panels must follow pelvis/legs smoothly enough to avoid rigid slab separation; use reasonable weights/topology appropriate for the retro style rather than adding a cloth simulation prematurely.
6. Only then correct body-coverage masks and seam overlaps. Coarse body-height thresholds are an initial partition, not a fitted seam contract. Do not mask away large regions merely to conceal misplaced garments.
7. Rebuild the split assets and hash manifest from the corrected canonical pack. Validate every output garment against the body binding; the presence of one `bindSha256` field alone is not proof that every output matches.
8. Retain source/licence metadata and reproducible commands. Do not patch generated GLBs independently without updating their authoring source.

### Acceptance

- [ ] Hood surrounds the head and accommodates ears/tusks intentionally; hair hiding is independent and correct.
- [ ] Neck/waist/wrist/ankle joins stay covered without large protrusions or missing-body holes.
- [ ] All three original outfits and Warden remain coherent through ordinary movement and both spells.
- [ ] Unequipping individual pieces restores the appropriate base body; mixed combinations still work.
- [ ] Live split-pack evidence agrees with authoring/combined-pack output.
- [ ] After fit correctness, review Orc face/tusk silhouette, gloss and material contrast against the approved dark-fantasy direction. Do not claim facial art approval from geometry validation alone.

## 6. Verification and completion record

Run checks relevant to the changes. Existing starting points:

```sh
npm run test:equipment
npm run build
node scripts/ashen-reach/check-graveweaver.mjs
node scripts/ashen-reach/check-grips.mjs
node scripts/ashen-reach/check-two-handed.mjs
node scripts/ashen-reach/check-orc-equipment.mjs
node scripts/ashen-reach/check-armory.mjs
```

Inspect these scripts before running; several current assertions encode incomplete visual criteria. Extend them for the specific regressions above without deleting valid checks just to obtain green results. Browser checks share the owned Chrome page and must run sequentially. Set `ASHEN_URL` if the actual server differs; do not test a stale old server.

- [ ] Functional checks cover both races, both hand modes, swaps, errors, cancellation and source-motion preservation.
- [ ] Record normal gameplay and diagnostic front/side/hand views. Review sampled motion frames yourself; avoid presenting only the best still.
- [ ] Measure >120 FPS goal separately from recording. Report actual render size, viewport, actor/outfit, sample duration and frame-time distribution. Do not reduce resolution silently to meet the target.
- [ ] Send reviewed progression evidence through the authorized Telegram workflow; include a verified public video URL when publishing a video.
- [ ] Update this plan and `docs/CURRENT.md` with actual completion, evidence links and remaining limitations. Preserve honest prototype status where visual acceptance remains open.

For each step, append a short completion record: **what changed; relevant checks; reviewed capture; actual performance conditions if measured; remaining limits**. No step is currently completed by this document.

### Orc source pass — 2026-09-18 (partial, visual acceptance open)

Opus audited the Orc source and updated `scripts/character-assets/bulk_orc.py` to enlarge the head as a weighted source deformation, shorten and narrow the tusks, reduce the topknot bead bulges, broaden skin-detail contrast, use matte skin/garment materials, and darken the bare shorts. The candidate was regenerated through the reproducible Blender source pipeline (`bulk_orc.py` → `bind_source_orc.py` → `bind-source-orc.mjs`) and the race-aware runtime pack was rebuilt with `prepare-orc-equipment.mjs` and `split-orc-equipment.mjs`. Provenance hashes in `public/characters/candidates/orc-source-v1.provenance.json` and the runtime Orc manifest were refreshed.

`check-orc-equipment.mjs` passed all 17 checks, `npm run test:equipment` passed 25 tests, `npm run test:character` passed 75 tests, and `npm run build` passed. Live captures are in `.cache/orc-repair/after3-*`. The result now has visibly mottled green skin and a matte surface, but it is **not accepted as production-quality Orc art**: the Armory front view still exposes a direction/orientation mismatch, the face reads poorly at gameplay distance, and ear/tusk proportions remain crude. Opus hit its Claude session limit before completing its final review; these captures and the unresolved defects require a second pass before marking the Orc milestone complete. No Human armed-animation changes were made by this pass.

### Orc face correction — 2026-09-19 (source iteration, reviewable prototype)

The parent follow-up simplified the generated face instead of adding more overlays: `bulk_orc.py` now uses a small tied hair/beard mass, two restrained brow volumes, a single muzzle/jaw volume, and short downward tusks rooted below the lip. The source was regenerated through Blender, rebound, and split into the runtime Orc pack. Live captures are `.cache/orc-repair/after5-front.png`, `.cache/orc-repair/after5-side.png`, and `.cache/orc-repair/after5-rotated.png`; Telegram messages 589–590 contain the front and side review. The front and profile now read as a coherent stylized Orc head, while the remaining art gap is torso/garment musculature and stronger facial material/eye readability compared with the supplied reference. `check-orc-equipment.mjs` (17), `npm run test:equipment` (25), `npm run test:character` (75), and `npm run build` pass. This remains a reviewable prototype, not final AAA-quality Orc art.

### Orc anatomy refactor — 2026-09-19 (reviewable prototype, live-verified)

Target: the user's heroic bodybuilder-orc reference, `.agents/skills/blender-lite/references/orc-concept-art.png`.

**What changed.** `scripts/character-assets/bulk_orc.py` was rewritten around seven explicit stages (proportions → muscles → face field → features → head scale → loincloth → materials), mesh-only, so the skeleton and every fitted joint centre stay valid and all 55 clips still apply. The five `OrcV1*` mesh names the runtime pack, manifest and browser checks depend on are preserved.

Specific corrections, each traced to a measured cause rather than guessed:

- Limb girth is applied about a real joint-head→joint-head axis with a tapered profile. MakeHuman bone *tails* are arbitrary stubs; using them collapsed the axis and inflated each limb into a sphere, which is what made the previous pass read as smooth tubes.
- The per-bone torso width dict was replaced with a continuous height profile. Six spine bones stepping 1.46→1.04 put a visible ridge at every weight transition and banded the torso.
- Volumes now inflate *radially* and creases press straight in with no radial lobe. Displacing a patch along a constant direction flattens it (slab shoulders, plate chest), and weighting a groove by the radial lobe makes it die away from the midline (invisible abs).
- **The front-torso muscle table was authored on the unwarped MakeHuman body but evaluated after the stage-1 depth warp had pushed the chest forward by up to 32%.** The pectoral ellipsoid sat ~0.12 behind the skin and the abdominal creases only clipped its back edge, which is why deepening the abs by hand never made them read. `warped_mass()` now carries each torso volume through the same warp. This single fix is what made the pecs, serratus, rectus blocks, linea alba and transverse divisions appear.
- The clavicle shelf was narrowed (1.44→1.24) and the trapezius reshaped into a ridge with a trap/deltoid groove; at full torso width the silhouette ran out flat to a sharp corner and read as angular epaulettes.
- Face: one displacement field, no bolt-on kits. The brow ridge was moved forward onto the actual surface and the forehead set back above it (measured: cranium front reached −0.268 while the brow only reached −0.249, so the forehead overhung its own brow). The nose was shortened and widened and its downward shelf removed — it had become the frontmost point on the head and hooked over the mouth, reading as a beak in profile — and the mandible plus a new chin block carry the jaw forward to near-level with the nose.
- Tusks are measured off the finished mouth, rooted just *outside* the corner and kept short. At `corner_x * 0.82` with a 0.046 sweep they crossed in front of the muzzle with tips at the brow.
- The topknot is seated on a *measured* crown point. The authored constant put it at y = 0.058 where the warped cranium only reaches −0.185, so it exported floating a hand's width behind the head.
- The loincloth belt is measured off the warped hips (a naive waist ring sampled the A-pose fingertips, which pass through belt height, and stretched the belt into a plank spanning the arm span). Panels are now near hip-width and near parallel-sided, and each row drapes from the belt anchor onto the measured thigh surface — at 0.115 half-width tapering to 45% with a constant authored depth they read as a thong hanging 0.09 clear of the leg.
- Skin is deep matte olive. The glTF exporter copies the *original* file bytes for any image that still has a source path, silently discarding in-memory pixel edits; `img.pack()` fixes it. Shipped albedo mean is 0.156 / 0.328 / 0.119 linear, verified by extracting the texture back out of `public/ashen-reach/equipment-orc/body.glb`.

**Checks run.** `bind_source_orc.py` (5 meshes, 52 fitted centres); `bind-source-orc.mjs` (55 clips, 65 joints, all five meshes); `validate-character-body.mjs --profile orc-male-v1` → `valid=true errors=0 warnings=2` (PROFILE_NOT_PRODUCTION, TRANSFORM_NON_IDENTITY); `node --test scripts/test-source-motion.mjs` 5/5; `fit-orc-clothes.py` refit all eight garments; `prepare-orc-equipment.mjs` → `outputSha256 664f56f3…`; `split-orc-equipment.mjs`; `check-orc-equipment.mjs` 17/17; `check-armory.mjs` 26/26; `npm run test:equipment` 25/25; `npm run test:character` 75/75; `npm run build` passes.

**Reviewed captures (live, not offline).** `ve-capture/ashen-reach/orc-refactor/nude-{front,side,back,face,full}.png` — the unequipped body with every slot cleared, via `scripts/ashen-reach/capture-orc-nude.mjs` — and `ve-capture/ashen-reach/armory-orc/*.png` with the Wayfarer set in idle, carry, fire and lava poses. Garments show no clipping on the new musculature. The offline sheets in `.cache/orc-refactor/pass*/` are authoring aids only; every defect listed above was confirmed or rejected against the live captures.

**Performance.** 144.0 FPS, mean 6.94 ms, p95 8.30 ms over 600 samples, measured by `scripts/ashen-reach/measure-orc-fps.mjs` while running the Orc forward in the churchyard (not in the Armory, not during recording). Render resolution 960×609, 44 draw calls, 9 batches, 126,512 triangles, owned Chrome on CDP 9337. This is at or on the display's 144 Hz cap, so it is a floor, not a ceiling; it is also local sub-native resolution and not MMO-scale proof.

**Remaining limits.**
- **Deliberate deviation from the reference:** the reference orc is bald. The equipment contract requires a mesh named `OrcV1Hair` for the helmet slot to hide, so a small dark tied scalp lock was kept instead of removing it.
- The reference figure is taller and longer-limbed; this Orc is stockier, inheriting the source rig's proportions (the skeleton is deliberately untouched).
- Skin is a flat tinted albedo with generated detail — no pore/scar map, no subsurface.
- The brow shelf overhangs the nose by ~0.037 in the sagittal profile, which is strong; worth a look if it reads as a visor at close camera.
- A faint shading seam remains on the upper back where the skin-detail texture tiles.
- No Human or armed-animation behaviour was changed by this pass.

This is a reviewable prototype and a large step toward the reference, not final production Orc art. Visual acceptance is the user's call.
