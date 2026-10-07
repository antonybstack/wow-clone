# Fieldcoat factory and normal-game integration — 2026-10-06

**Production update, 2026-10-07:** Fieldcoat is delivered in source `7d00c56` /
Pages `5723a4ab`. The [qualified production result](production-delivery-2026-10-07.md)
records current startup, delivery and native functional/performance gates.
Physical iPhone acceptance remains unverified. The checkpoint below preserves
the original local result and its measurements.

Local fit/motion integration is accepted. Production remains `6004840` / Pages
`e39117b8`; startup, swap/performance and physical-device release gates remain
open. This result does not mark priority 4 complete before production delivery.

## Implemented

Schema 2 supports explicitly pinned soft-skin equipment. Schema 1 retains its
rigid restrictions. Fieldcoat derives from the existing immutable Lector master
for each race: shorter thigh-relative divided hem and raised front seams,
retaining the source collar, UVs, three materials and skin. Native Blender BMesh
and four-influence normalization own tailoring. The existing bind-restoration,
`trackBodyShape`, normal reconstruction, compact meshoptimizer and native piece
publication tools own fitting/storage. No new textures, skeleton, source clips
or runtime fitting system.

Catalogue v8 adds the item and preset; historical v7 and older registries remain
closed. Full/compact Human, identity, neutral Orc/Undead and remote-piece packs
are prepared. All fifteen protected body/hood file pins remain exact. The factory
repeat is byte-identical on the pinned host; cross-platform reproducibility is
not certified. All three Bastion control outputs remain byte-identical.

## Corrections from actual evidence

The initial live `?creator` attempt selected an old developer garment pack. The
checker now refuses that route; acceptance uses the ordinary game and Armory.

Root rejected live-2 because upper trousers protruded at the back waist. A proposed
vent-cut explanation was falsified: defensive face-boundary checks changed no
artifact bytes and reported no violations. The independent reviewer correctly
identified missing `trousers.upper` coverage. Adding it fixed the original Human
but live-3 failed immediately after selecting Prime: equipment-only identity
refresh copied pieces while retaining old garment layer rules. The refresh now
copies shared clothing rules while preserving identity-specific body partitions.
The publication verifier rejects even correctly addressed descriptors carrying
stale garment rules. The final live check confirms upper trousers hide and lower
trousers remain visible on every supported race and Human shape endpoint.

Broader integration found stale v7 enumeration totals and two test assumptions: v1 fixtures pinned a
containing module that grows with later catalogues; Fieldcoat's compressed index
stream used native cyclic triangle corners. The fixtures now pin the exact frozen
legacy data and retain historical source metadata/recipes. The index proof retains
triangle order, winding, duplicate membership and exact attributes; negative
controls reject reversed, reordered, missing or duplicated triangles.

## Evidence and limits

- Factory/registry suite: 31 pass. Character suite: 228 pass. Equipment suite:
  115 pass across the unaffected suite and corrected coverage file. Final
  identity/coverage/soft/v8 subset: 40 pass. Saved-bootstrap flag-1 build passes.
- Catalogue v8 enumerates 12,096 candidates and 10,584 valid combinations across
  four Human profiles. The actual maximum compact asset payload remains
  **2,300,424 bytes**; Fieldcoat does not increase it.
- Final normal-game live run: 19 cases, no runtime/GPU errors, no recovery
  teleports. Seven race/shape cases, adjacent Warden/Bastion, mixed Dusk/Grave,
  hood/hair, dyes, sword/staff source motion, actual Havok movement/jump/cast,
  save/reload and six failure/cancellation/admission controls.
- Native posed remote bounds: Human 6,007,230, Orc 2,202,195 and Undead 2,350,965
  points; zero escapes. This does not certify every mixed outfit combination.
- Root reviewed actual 1280×720 live playback and waist/race/shape captures.
  Clip: 62.069977 seconds; SHA256
  `f0573399bd5dfd13f03710d23233cb53ba04411aee933f1e4637168f3f624a27`.
  Capture timestamps determine elapsed time; recording is not an FPS sample.
- The coat retains a fitted source silhouette and divided upper/mid-thigh hem.
  No cloth simulation. Existing boot sole aliasing remains a separate follow-up.
- Reviewed motion is delivered as Telegram **871** and the identical
  [VE MP4](https://ve.sparkify.dev/wow-clone/ashen-reach/character-mmo/fieldcoat-2026-10-06.mp4).
  Public SHA-256 matches; MIME is `video/mp4`, and byte-range requests return 206.
  Root reviewed advancing Telegram inline/expanded and direct VE playback: 1280×720,
  `object-fit: contain`, no stretching. Telegram's fullscreen button leaves
  `document.fullscreenElement` unset in this browser; fullscreen acceptance remains
  unverified. API dimensions alone are not playback evidence. No new
  startup/performance claim. [Tracked receipt](../../../baselines/character-mmo/fieldcoat-2026-10-06/receipt.json).

Raw pipeline, failures, final states/captures and root review:
`.cache/character-mmo/fieldcoat-2026-10-06/`. Generated
`public/ashen-reach/fieldcoat-provenance.json` contains source/tool pins and written
factory proofs; those artifacts remain reviewable independently of ignored captures.
Root and worker closed their game contexts, slot-7 harness and local review player.

## Next gate

Cold/resident swaps pass all **12 pairs**: three fresh contexts per race plus
three saved Prime maximum-outfit contexts. Actual decoded responses are
558,164 / 601,296 / 631,988 bytes on neutral Human/Orc/Undead and 573,440 bytes
on the shaped saved Human. Cold maximum **157.9 ms**, resident maximum **4.5 ms**,
worst observed frame **25.4 ms**; no errors or budget breaches. Native 1280×720,
uncapped Chrome, one owned game at a time, legacy **50 Mibit/s / 40 ms** network.
Ceilings remain 200 ms cold, 60 ms warm, 33.33 ms frame and 917,504 bytes.
These samples bound swaps, not settled FPS or first play. Raw:
`.cache/character-mmo/fieldcoat-2026-10-06/swaps-1/` and the tracked receipt.

Settled route sampling completes **15 twelve-second windows**, three per route,
on M1 Max / native 1280×720 / DPR1 / headless Chromium with uncapped launch flags,
seven enemies, Havok and sun shadows; no recording or other active game renderer.
Meadow **219.1–220.0**, town **221.0–221.4**, bridge **253.3–253.6**, cathedral
**256.7–257.0**, forest **236.4–242.7 FPS**. Maximum p99 **5.9 ms**, worst
**10.5 ms**, zero intervals over 16.67 ms, errors or recovery teleports.

The strict uncapped-detector invocation failed at its first forest window;
that failure is retained. Only the two missing forest windows were collected
in a fresh process with the existing `ASHEN_RECORD_CAPPED=1` observation mode.
All three forest windows carry the 240 Hz detector hint. These observations
exceed 120/144 FPS but do not establish an uncapped hardware limit or a passed
strict detector gate. No detector/budget change. Receipts preserve both reports.
Every owned game context, harness and review tab is closed; exact listener/PID
audits pass. Temporary Telegram/Shadowglass media guards are removed, and all
connected media received their recorded prior playback state.

Test the proposed starting-world scheduling experiment. Qualify the full declared
startup cohorts before sealed preview/production promotion. The phone receipt
remains explicitly unverified until a physical device is available.
