# Current game review — 2026-09-18

Review of checkout `ea7df36`, after the two-handed carry and equipped Orc additions. This is a diagnosis, not implementation or visual approval. No game code changed. Existing `.claude/` work was left intact. Commit metadata does not reliably establish which agent authored each defect.

## Evidence and scope

Ran the root Ashen Reach route on Vite 5173 in real headed Chrome/WebGPU. Inspected Human and Orc in Graveweaver/Warden outfits from front and side, paused idle/run/carry previews, and actual gameplay idle, backward movement, strafe, run, jump, Fire Blast and Lava Ball. Gameplay diagnostic front/side cameras were used to expose contact/posture; they do not represent the normal player camera. Screenshots and probe scripts are under ignored `.cache/current-review/`. The 25 equipment tests pass. Initial outfit/race capture produced no runtime exceptions. Visual defects below remain despite these passes.

## Findings, in priority order

### 1. Greatstaff movement replaces the directional locomotion system — high

`src/character/body.js:530` unconditionally selects `Walk_Carry_Loop` while two-handed equipment is active. Live probes show the same clip for backward movement, strafe and forward run on both races. The code chooses walk/run playback rate, but does not preserve direction-specific leg motion. Idle parks that full-body walk at a selected phase; actual front/side screenshots show an exaggerated backward lean, elevated chin and bent-knee carrying stance. A neutral-looking source timestamp is not a proper armed idle.

Retain the working directional lower-body locomotion. Audition a suitable weapon carry/idle source animation on the actual character, then isolate an upper-body carry layer where appropriate. Verify forward/back/strafe/turn, starts/stops and jumps in gameplay. Do not fix this by searching endlessly for a different frozen walking frame.

Evidence: `human-play-idle.png`, `human-play-side.png`, `play-states.json`.

### 2. Orc equipment is not visually fitted in the live renderer — high

The Graveweaver hood does not cover the Orc head; brown cloth protrudes at the shoulders/waist, and the robe silhouette separates into angular slabs during movement. The selected hood being marked visible is not evidence of a correct fit. This is beyond minor seam polish. The large bright tusks and glossy facial appearance also need another art pass, after geometry correctness.

Audit garment positions, armature rest space, inverse binds and weights against the final bulked Orc **as loaded by the game**. Then review coverage masks at the waist/neck/wrists. The packaging script currently partitions body coverage by coarse height/width thresholds (`scripts/ashen-reach/prepare-orc-equipment.mjs:97`); these need visual seam validation. The precise cause of every garment displacement has not been isolated in this review, so do not assume a material tweak or larger hide mask fixes it.

Evidence: `orc-graveweaver-idle-front.png`, `orc-warden-run-front.png`.

### 3. Human finger translations are applied to Orc joints — high

`src/character/runtime/hand-grip.js:33` writes `source-hand-poses.json` translations into every equipped body's finger bones. Those samples belong to Human bind/shape 1. Example local translations: Human LeftHandIndex1 approximately `[-1.72,11.64,0.05]`; the Orc asset uses `[-5.10,15.11,1.61]` in source rig units. Copying Human translations changes the Orc's finger spacing/length rather than simply closing its hand. Prop grip offsets likewise remain common catalogue values.

Preserve each active rig's own rest translations. Use reviewed race-specific rotation/grip profiles and prop offsets. Check bare and gloved palms/undersides against actual prop surfaces. Evidence: `finger-bind.json`; catalogue and hand evaluator.

### 4. Armory standard previews misrepresent equipped gameplay — medium

`src/character/runtime/inspection-preview.js:9` always selects the generic idle/walk/run clips. The separate Carry option auditions a source clip, whereas actual equipped gameplay substitutes the carry locomotion. A Human Warden shown under Idle in Armory holds the greatstaff one-handed; gameplay uses the backward-leaning two-handed stance. Thus the developer tool can conceal the defect being reviewed.

Offer an equipment-aware gameplay preview as the default, and label raw source-clip audition separately. Validation must include the real gameplay path, not only the specially selected Carry option.

### 5. Failed race switches leave the actor and UI inconsistent — high reliability issue

`src/ashen-reach/main.js:69` hides equipment and swaps the body before the replacement equipment pack finishes loading. There is no rollback. Reproduced by returning HTTP 503 only for the Orc equipment manifest: `equipment.race` and selector still reported Human, while `body.parked` was true and Orc brows were visible. The error message was then cleared by `setRaceUi()` in `src/ashen-reach/armory.js:83`.

Prepare/validate the replacement before committing, or restore actor, sockets, equipment visibility and selection on failure. Keep the error visible. Add a browser failure-path check. The injected failure was removed and the page reloaded after the test. Evidence: `failure.log`, `failed-race-switch.png`.

### 6. Current acceptance checks overstate visual readiness — medium

The two-handed test measures **wrist joints** against an infinite shaft axis. That is useful for alignment but does not prove finger contact or a convincing posture. Orc tests largely assert mesh presence/visibility, race flags and spell damage. Those all can pass while the hood is displaced and the robe is visibly broken.

Keep these functional checks. Add actual palm/prop contact samples, direction-aware locomotion assertions, failure recovery, and a short reviewed gameplay capture per race/outfit. Documentation should call the Orc a prototype until those visible failures are corrected.

## Recommended next deliverable

Repair Human armed idle and directional movement first, using a suitable source motion and preserving the existing locomotion system. Correct the shared finger-bind bug and race-switch rollback alongside that focused repair. Then re-fit and visually validate the Orc outfits before adding Undead, more equipment, or more character-system architecture.

Keep the catalogue, native Lite mixer, Havok movement, asset provenance and streaming foundation. The weak points are the carry integration, race-specific fitting and visual acceptance, not a reason to restart the game. Eased prop interpolation is a useful foundation, but should eventually be coordinated with an actual draw/stow gesture rather than treated as a finished interaction.

Performance sample: approximately 144 FPS in foreground Chrome, 1280×900 browser viewport / **960×675 actual render**, single Human wearing Graveweaver, idle gameplay and running Armory preview, no recording, up to 47 draw calls. Performance was not the limiting issue in this sample; this is not native-resolution or Orc/crowd performance proof.
