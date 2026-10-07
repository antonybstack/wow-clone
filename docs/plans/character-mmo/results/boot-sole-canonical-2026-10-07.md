# Canonical boot sole integration — 2026-10-07

The reviewed sole candidate is integrated into canonical Human/Undead Wayfarer
boots and Duskguard underlayers, with all derived character assets prepared.
This is **local canonical acceptance**. Production remains source **7d00c56**,
Pages **5723a4ab**. Public qualification, promotion and current physical iPhone
acceptance remain open. [Curated native receipt](../../../baselines/character-mmo/boot-sole-canonical-2026-10-07/receipt.json).

## Implementation

`prepare-boot-sole.mjs --publish` reuses the existing equipment publication primitive,
factory bind verifier, lossless meshoptimizer encoding and Duskguard builder. It
rebuilds the pinned sole twice and requires identical bytes. Published underlayers
exactly match the reviewed sole arrays; existing plate arrays remain exact. Orc
source packs are unchanged. [Independent local publication review](../../../baselines/character-mmo/boot-sole-canonical-2026-10-07/publication-review.md).

Publication is staged, with each manifest replaced after its assets. It is not a
global transaction: a failure between the boots and greaves stages can leave a
partial local source update. No game/release runs until the complete derived
preparation succeeds. This pass completed Human shapes, starter compacts, source
coverage, identity equipment, offline remote pieces, native bounds and remote
publication in that order. Undead source-foot partitioning was implemented in the
[earlier candidate](boot-sole-candidate-2026-10-07.md), preserving source geometry,
65 joints, bind, skin and animation curves.

The shape/starter generators previously pruned old addressed boot files despite
retained immutable identity manifests still referencing them. Canonical preparation
now retains these files; isolated candidate output still permits pruning. Four
previous boot artifacts are byte-identical across HEAD, public source and this build.
This is finite source retention; garbage collection with manifest reachability is
future work. Source comments link the relevant native glTF and immutable-cache docs.

## Verification and retained failures

- Character suite: **231/231**; equipment suite: **115/115**.
- Native Lite 1.31.1 bounds: **51 pieces**, **162,617,865 points**, **zero escapes**,
  zero runtime/GPU errors. Final byte-cache entries/reservations/leases are zero;
  peak reservation 4,496,592 bytes within the existing 8,388,608-byte ceiling.
- Three identity presets refresh successfully; existing identity binaries are reused.
- Canonical built game: **ten cases**, five profiles × two boots, actual current
  asset requests, native verification, zero errors. Human and Undead ordinary Havok
  sprint/jump each add one jump, finish grounded and use zero recovery teleports.
  Removing boots restores the source foot.
- One built production bundle: **570 files**, **310,982,964 bytes**, all accepted
  startup flags enabled. Source product fingerprint matches the captured build.
  This build is not yet sealed or uploaded.

The first equipment invocation ran before refreshed native remote publication and
failed its stale-publication assertion. That failure is preserved under
`.cache/character-mmo/boot-silhouette-2026-10-07/before-remote-publication-test-order/`.
The operator order was corrected; native bounds/publication and equipment then
pass. The passing character suite was not repeated. The earlier preparation run
before retention changes is retained separately; provenance was regenerated after
the generator change. No failed attempt is replaced by the passing receipt.

## Reviewed live motion and delivery

Root reviewed the actual canonical **1280×720**, square-pixel, rotation-zero,
**33.300-second MP4** with natural playback and diagnostic Human endpoint/Undead
views. The focused large-sole-fold correction is accepted. Undead bare-foot
restoration and ordinary Havok movement are visible. Residual cuff/strap overlap,
forefoot pleats and aliasing remain; some close run frames crop the feet. This
acceptance does not establish zero clipping across all combinations.

Telegram **880** returns matching 1280×720 dimensions. The identical public
[VE MP4](https://ve.sparkify.dev/wow-clone/ashen-reach/boot-sole-canonical-2026-10-07/motion.mp4)
returns `video/mp4`, HTTP 200 and range 206, with matching SHA256
`338e83c9d632c3bca4a921e592be5b8fd277c39136b74d9af7a6a2b67f49b01a`.
This receipt does not claim Telegram inline/fullscreen or current iPhone playback.
Capture is separate from performance; **no new FPS or public startup claim**.

All owned native/capture browsers and Vite/preview servers are closed. The root
review tab and port-7075 server are also closed. Twelve user tabs remain intact;
Shadowglass was not activated. Raw evidence is under the two task-specific cache
folders named in the receipt; durable provenance and the compact receipt are tracked.

## Immediate next step

Commit/push this checkpoint, then seal the existing `dist` against that committed
product fingerprint. Qualify an immutable preview before promoting identical bytes.
Use **5723a4ab-5dfd-4902-959b-7496948ea51f** as the newly recorded rollback target;
the older e391 deployment remains historical. Compute delivery-check path/count
expectations from the new seal instead of copying the previous 552-row count.

Require every served file/hash/MIME/cache/missing-file control, three entries, four
declared twenty-start cohorts, relevant native boot swaps/rollback/movement, mobile
and WebKit gates, and fifteen separate settled 12-second route windows. Preserve
the ≤1,000 ms dressed/grounded/GPU/input fence and report 1280×720 uncapped seven-enemy
FPS/frame tails against the 144 FPS target and >120 FPS floor. No builds, encoding,
recording or extra game renderer during timing. Roll back production loading or
movement failure and retain all rejected samples. Original 14/60 fetch failures,
362 ms input outlier and physical-device acceptance remain open.
