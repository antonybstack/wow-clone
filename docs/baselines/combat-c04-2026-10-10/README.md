# C04 — readable combat and persistent bindings

Runtime: fae4e9e + C04 working tree. Source-independent input timing remains owned by the C02 scheduler.

## Implemented

- Stable target name/health panel. Shared cooldown has its own thin bar; personal cooldown has the existing icon sweep and numeric remaining time. Queued actions have an outline and explicit text; unusable actions include a short reason and full accessible label. Cast bar has the current ability name.
- Six pooled floating damage labels preserve simultaneous area hits and stack overlapping screen positions. Repeated identical errors are throttled. Aura/proc HUD locations are ready for subsequent mechanics.
- Menu → Keybindings changes spells 1–3 and Attack, rejects duplicates/reserved movement keys, persists to browser storage, supports matching number-pad aliases, and updates action-bar/help labels. Keys are physical QWERTY positions, consistent with the existing movement implementation; localized keycap labels remain a limitation. [KeyboardEvent.code](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/code).
- Read-only resource/geometry previews reuse scheduler validation at 10 Hz; final acceptance remains on the actual input update. No VFX assets or renderer changes.

## Verification

**60 CPU tests and production build pass.** Six checks in the combined native capture pass: queued/cast/cooldown UI; fixed target while strafing; mana refusal/area labels; actual menu rebind/conflict/original-key disabled; moving casts after Orc/Undead/Human switches; actual reload retains keys.

The extra mortal check initially waited beyond a gravestone without entering melee range. The separate native-contact helper walks forward for 1 s using W and passes: **0.554s windup→contact, HP 100→84, God off, Havok active**, no runtime errors. This is a bounded contact check, not the complete mortal chapel traversal. Retained first-attempt and combined failure receipts describe helper timing mistakes; they are not suppressed.

Initial helper mistakes corrected: asserting a cast still existed after a screenshot consumed the final queue window; expecting 20 mana after only 40+20 spent; omitted final capture surface. Native trace proved queue acceptance/release throughout. Source UI correction: overlapping 90 + 90 now stack vertically rather than reading 900.

## Performance

Same isolated M1 Max / uncapped Chromium 155 WebGPU / 1280×720 DPR 1 / seven-enemy fixtures as C03. Three 12 s submitted-frame runs per dummy/pack; developer God on for bounded spell workload. Pack targets can die; not a sustained full-target storm. No recording, encoding, build, video playback or other game renderer overlapped.

| Fixture | Run | FPS | p50 ms | p95 ms | p99 ms | Worst ms | >16.67 | >33.33 | >50 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| dummy | 1 | 165.4 | 5.8 | 6.8 | 8.3 | 23.0 | 15 | 0 | 0 |
| dummy | 2 | 165.4 | 5.8 | 6.8 | 8.6 | 23.5 | 15 | 0 | 0 |
| dummy | 3 | 165.6 | 5.8 | 6.8 | 7.4 | 24.0 | 14 | 0 | 0 |
| pack | 1 | 188.5 | 5.2 | 6.3 | 6.5 | 23.0 | 3 | 0 | 0 |
| pack | 2 | 188.3 | 5.2 | 6.2 | 6.5 | 22.3 | 2 | 0 | 0 |
| pack | 3 | 188.3 | 5.2 | 6.3 | 6.6 | 23.1 | 2 | 0 | 0 |

dummy: matched median FPS change -0.02%; median p99 change +0.80ms.

pack: matched median FPS change -0.12%; median p99 change +0.00ms.

All six runs pass FPS/p99 and matched median budgets. Raw intervals retained; zero runtime/GPU errors. This does not qualify the full upcoming kit, enemy caster/area load, physical mobile or startup.

## Motion and remaining scope

[Live 27.82 s native check montage](https://ve.sparkify.dev/wow-clone/ashen-reach/combat/2026-10-10/c04-feedback.mp4): 1280×720, square pixels, no rotation, h264, silent. Diagnostic placements/armory swaps between checks. Root reviewed ordinary native playback and detailed stills. The wait behind the gravestone remains in this clip; the separate passing mortal contact is a trace/still receipt. Race switches prove accepted casts, not full silhouette acceptance: the Orc sampling is partly occluded by a gravestone. C10 needs a clear open-ground normal/slow-motion pass for every source rig/equipment shape.

C05 begins the sustainable kit: free Fire filler, in-combat mana, shared ordered damage and Ashen Brand. C06 adds procs and independent projectiles; C07–C12 remain outstanding. Full native 100-action chain, mortal chapel route, death/blur/soak and production release gates remain open. Production remains a7df082.

## Delivery and cleanup

Implementation commit **f955297** is pushed. Root-reviewed local and public native video playback/seek pass; public bytes exactly match, video/mp4 and HTTP206 pass. Telegram **915** returned matching 1280×720 dimensions and 28 s rounded duration. Application inline/fullscreen remains unverified. All root game contexts, slot 8 Chrome/Vite, preview 7075 and video tabs are closed; no managed workers remain active. User's unrelated tabs and Vite 5173/4000 remain.
