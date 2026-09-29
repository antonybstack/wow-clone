# M007 Orc wrist coverage follow-up

Status: **wrist breakthrough corrected in the active Orc body; M007 remains open for the full mixed-outfit fit matrix** (2026-09-29). This follows the [close-fit checkpoint](m007-close-fit-and-orc-wrist.md).

## Finding and correction

The green triangles visible between the Pilgrim sleeve and Graveweaver glove came from `BodyExposed`, despite the glove hiding `BodyHands`. A live mesh-visibility isolation identified that source. The apparent waist patches in the same outfit belong to the Pilgrim tunic's own folds and belt ends; trimming the Graveweaver skirt's embedded trousers made no visible improvement and was rejected.

`scripts/ashen-reach/orc-wrist-coverage.mjs` moves **426 existing triangles** from `BodyExposed` to `BodyHands` and **540** to `BodyUnderTunic` in the active Orc GLB. It changes index membership only: body vertices, materials, skin weights, rig, 57 animations, total triangles, draw submissions and GLB byte length remain unchanged. The active binary is reproduced exactly from the previous binary by `scripts/ashen-reach/apply-orc-wrist-coverage.mjs` (SHA-256 `b055e29393ca3a22998f19ec83f600390ec583f2f7b677ede902bea149a0250b`). A version query on the body URL keeps browser caches from mixing old geometry with the new manifest.

The full `prepare-orc-equipment.mjs` pipeline calls the same correction after its vertex-vote partition. An isolated rebuild succeeded, but that source currently partitions **580 hand** and **539 sleeve** forearm triangles and produces a different 6.44 MB body. It is a future authoring candidate, not a replacement for the reviewed 8.52 MB active body. The correction therefore validates a bounded anatomical count rather than requiring the active pack's exact count; any future rebuild still needs fresh live review.

## Review and verification

Close front and side views with and without gloves were inspected in the live Armory. The gloved green breakthrough is gone; the bare green hand remains visible at the sleeve. Five mixed outfit passes then orbited, walked, ran, jumped and swapped torso items in the live renderer. The candidate body and manifest were each requested once through the ordinary streamed loader with zero page/console errors. The shipped body is byte-identical to that candidate, and the isolated active-body benchmark also loaded it without errors. Reviewed [1280×720 live motion](https://ve.sparkify.dev/wow-clone/ashen-reach/character-mmo/m007-orc-wrist-coverage-compact-2026-09-29.mp4) is Telegram **809**, returned as 1280×720 and 34.840 s. The VE response served `video/mp4` with byte-range seeking (`206`). A 59.6 MB first encode received Telegram HTTP 413; the reviewed 28.5 MB square-pixel, variable-frame-timing encode was delivered. The unused first VE object was removed.

`npm run test:equipment` passed 71/71, active/startup character tests passed 11/11, active census covered 36 files with zero errors, and `ASHEN_PAGES=1 npm run build` succeeded. The Orc pack test checks the versioned URL, manifest hash, bind, exact active coverage counts and total triangles.

Performance was sampled without recording on an M1 Max, isolated uncapped Chromium WebGPU at 1280×720, active Orc in Graveweaver gear, seven enemies, three 12-second runs per route. Town mean FPS was **188.4, 194.7, 182.9**; bridge **216.3, 216.9, 217.5**. Town p95 frame times were **6.2, 10.7, 6.2 ms**, bridge **5.7, 5.7, 5.6 ms**; worst town **11.7 ms**, bridge **8.7 ms**. The second town run had 149/600 sampled intervals over 8.33 ms. A prior Orc Graveweaver run also showed a 10.5 ms town p95; the current versus older runs differ in scene triangle counts, so they do not establish a causal FPS change from this index reassignment. The >120 mean-FPS goal passed; frame pacing remains worth tracking.

## Remaining M007 work

Other race and outfit seams, authored shape extremes and live motion across the complete fit matrix still need acceptance. The separate M006 old/bald Human source, scalp texture, age read and creator state remain open. No production release is implied by this checkpoint.
