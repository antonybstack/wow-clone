# Production deployment — Vaelmark sealed desktop build

2026-10-10. User-directed promotion of the already sealed 649-file desktop
preview to [play.sparkify.dev](https://play.sparkify.dev). Startup remains
unqualified. No rebuild, no threshold change, no 80-start cohort, no Telegram.

## Deployment

- Source HEAD **a7df082d9364706a11cecc03ceee3d32fccfbca6** (product-equivalent to
  sealed **4799023**; later commit is documentation).
- Seal **6ef7b8ef9bf46d6f336cb708aea1eb441b18eeeaf1cf2a02d66f7e24f1943517**,
  649 files / 399,412,147 bytes. `pages-seal.mjs verify` passed.
- Native canonical before upload: **5723a4ab-5dfd-4902-959b-7496948ea51f /**
  **7d00c56**, production, deploy success, alias play.sparkify.dev. Recorded as
  rollback. Historical working rollback **e39117b8 / 6004840** unchanged.
- Sealed upload `ASHEN_PAGES_SEAL=… PAGES_BRANCH=main npm run deploy`. Wrangler
  reused 648 already-uploaded files plus `_headers`.
- Native canonical after: **94db62ac-9d58-43ad-ad52-5d0001a6f3a1**,
  https://94db62ac.fardel.pages.dev, environment production, source a7df082,
  deploy success, alias play.sparkify.dev. Rechecked after live gates.

## Integrity

`verify-pages-release.mjs` against the immutable URL and
https://play.sparkify.dev: **652/652** matched on both, including exact decoded
bytes, Havok WASM, MIME, 325 declared cache policies, four HTML entry aliases,
five mutable manifests, eight region policies, 44 identity policies, 327
unclassified 200s, and two 404/no-store controls.

## Live production checks

Owned harness slot 8, Chrome 58891 / CDP 10137, idle about:blank between
checks. Public URLs only; no `/src` imports.

Default entry `https://play.sparkify.dev/?play&clean&pixelRatio=1`: Havok on,
recoveries 0, god/fly off, walked 16.81 units, GPU/page errors 0. 26323 ms to
`ASHEN.ready && navigationReady && hostilesReady`. That is full
navigation/hostile readiness, not a first-playable-frame sample. Existing
startup concern stays open (valid cold miss 1,140.1 ms; diagnostic 8,841.1 ms
first play). Brief live clip:
`.cache/gothic-prod-2026-10-10/default-entry/default-entry-walk.mp4` (76 frames,
2.73 s, 1280×720). Inspected start/mid/end frames. VE/TG 911/912 remain the
reviewed expedition motion.

First `check-vaelmark-reliquary.mjs` run with `ASHEN_EXPEDITION_RETURN=1
ASHEN_RECORD=0` completed crypt, west bell, reliquary, aisles, nave, chapel
return and Bell Watch knowledge asserts, then aborted on exact
`{progress,objective}` equality: mana 109.5304 → 109.5968 during the journal
wait. GPU/page errors empty; Havok/recoveries 0. Retained
[first failure](../../../baselines/gothic-production-2026-10-10/expedition-first-failure.json).
Fixture equality on ordinary mana regen, not a product loading/movement/integrity
failure. No rollback.

A scratch helper copy compared objective and level/xp/xpToNext/manaMax exactly
and allowed mana to rise at most `4×Δlife.time+0.01`, capped at manaMax. One
corrected public run passed five cases: connected inscription/bell/reliquary;
Hollowmere return; Bell Watch (five discoveries including `bell-watch-view`);
actual completed-episode reload without phase seeding; wayfarerTunic →
lectorCoat with journal retained on the following reload. Errors 0, recoveries 0,
Havok on, god/fly off. Capture-free action timing is headless 60 Hz and is not a
throughput claim.

A separate seeded localStorage script rewrote storage on every navigation. It is
a seeded-state/equipment check only and is not journal-persistence evidence.

## Known limitations

Startup is not qualified. Do not rerun unchanged 80-start cohorts or treat
26323 ms readiness as first play. Physical iPhone remains backlogged. Helper
mana-equality sensitivity is retained as the first expedition failure.

[Receipts](../../../baselines/gothic-production-2026-10-10/README.md).
