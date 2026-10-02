# Native remote per-piece renderer checkpoint

2026-10-01. Committed implementation checkpoint, **DEV-only and unreleased**. The user requested wrapping up at the remaining usage limit. Milestones 5–10 remain incomplete; no production or crowd-capacity claim.

The candidate renderer assembles the three accepted races and independent wardrobe pieces on native Lite body visuals, animation managers, evaluated sockets and the existing equipment loader. It preserves logical ID/revision/source clocks while body/shape/race changes stage hidden, and reuses the current body for equipment-only transactions. Limits are eight live exact owners plus one staging owner, 32 pending IDs/one preparation, zero idle garment retention and the existing 8 MiB immutable byte ceiling. No full-outfit permutation assets, additional decoder, animation mixer or remote Havok controller were added.

Written candidate geometry/bind/morph/source curves remain exact after texture-only tier preparation. Native `computeMaxExtents` supplies bounds per piece/hash, with terminal samples and morph envelopes; independent raw-source deformed checks total 142,120,095 points with zero escapes. Candidates and their descriptor remain under ignored `.cache`; the Vite-only mirror supplies them. Publication requires the remaining gates.

Loader additions are limited to verified decode leases, optional awaited material-ready commit, drain and bounded idle retention. The normal player retains its hook-free synchronous commit. The existing accepted non-rendering morph/PBR primer was extracted into a shared engine promise, correcting the reproduced black-world/unresolved-morph GPU failure on first remote boot. This is initialization reuse, not a reopened async-shader investigation.

Independent Grok 4.6/high review found a valid concurrent boot-retirement race. Retirement now fences **the entire preparation**, including non-interruptible native decode and an equipment boot that has not returned, before retiring borrowed body palettes. Removal also retires unpublished owned stages. Per-request cancellation stays separate from resource lifetime. Hidden/dispose failures cannot skip the equipment loader's disposal, and failed appearance requests restore an active committed token/commit predicate. Native hand/back easing advances over time; identical source-frame mixer samples are reused between 60 Hz rows, with forced evaluation after gear changes.

The review's raw cast-terminal comparison describes a real **representation distinction**, not accepted raw-VAT equality: the remote adapter deliberately reuses the player's additive upper/lower cast composition, finger/carry policy and ease-in/out, returning its overlay to idle at action endpoints. M2 raw `goToFrame`/VAT clips do not encode that composition. Do not switch exact actors to raw VAT or claim phase/pose equivalence from the logical clock alone. M8 must bake/validate matching composed representations. The review's full-family PBR rebuild cost and deferred native GPU retirement totals remain unmeasured concerns.

Actual final functional checks pass: eight native owners/ninth rejection; ten complete three-race lifecycle cycles; held body with 20 deduplicated updates preserving latest transform/clock; stale/conflicting revisions; corrupt garment preserving the committed recipe; 32-ID queue admission and cancellation; disposal during unreturned equipment boot; disposal with the installed native material wait deliberately held by the harness. Final scene meshes/casters return to baseline, and owned objects, immutable leases/reservations and pending builds are zero. Runtime/GPU errors are zero. Concurrent native decode is fenced by implementation; a separately held body-decoder case is still pending.

Reviewed live native motion: three races × five designs, source gait/jump/airborne/landing/casts, front/rear and same-body changes. [VE MP4](https://ve.sparkify.dev/wow-clone/ashen-reach/character-mmo/remote-pieces-native-2026-10-01.mp4), Telegram **838**, 1280×720/SAR1/rotation0, 102.75481 seconds, matching returned dimensions. Native Edge playback/seek preserved proportions; its owned tab was closed. Local foreground hidden only for fit review; this is not multiplayer or normal-control traversal. The capture predates the final lifetime fence and identical-frame evaluation optimization; their functional tests pass, but final integrated motion must be recaptured before release. Telegram client fullscreen remains unverified.

Evidence is in [the baseline folder](../../../baselines/character-mmo/remote-pieces-native-2026-10-01/README.md). Character 157 and presence 3 tests passed; final equipment/build results are stored there. No isolated performance claim: the measurement script is authored but **unexecuted**. Production stays source 8ae4c2d / Pages 0c2f92c1-a4f8-43ab-838f-45c0f622df4b.

## Resume from here

1. Review final independent findings disposition against current source; verify held decoder/remove and current-generation race/shape swaps with eight committed owners plus one stage. Add native composed-pose bound/socket checks, including Human endpoints, Orc grip and zero dangling parents.
2. Run `measure-remote-pieces.mjs` only after process/tab audit: isolated one renderer, seven enemies, 1280×720, three 12-second runs for 0/1/8 exact owners. It is a diagnostic meadow comparison, not the prescribed solo five-route gate or M8 crowd acceptance. Retain all cap flags and interval tails; measure streaming separately. Existing equipped forest uncapped qualification remains open; no repeat-until-pass or deferred GPU first-use investigation.
3. Publish immutable individual pieces and verified bounds only after these gates. Switch the lazy presence renderer and then expand authoritative validation to the supported three-race/item contract. Match protocol/discovery/seat compatibility and local transactional race/shape convergence; do not unlock unsupported identity/Elf fields.
4. Two real clients/eight seats: movement, appearance changes, latency/failure/reconnect, source phase, disposal; recapture reviewed final motion and deliver VE/Telegram. Repeat normal startup/cold/solo, cathedral, touch fallback and WebKit gates. Release only after full production verification/rollback records.
5. Continue M5 head/hair/age fit and persistence, M7 licensed distinct Elf, M8 hub tiers, M9 cooperative authority, M10 endurance/content/device gates. Physical phone, paid public-host account, true TCP loss and real-user acceptance stay distinct pending dependencies.

## Composition checks (added 2026-10-01)

`scripts/character-assets/check-remote-pieces-composition.mjs` covers the four gaps this
result named. One owned context, no recording, no FPS claim. All pass; raw rows in
`composition-checks.json`.

| check | result |
|---|---|
| remove during a held native source | owner 1→0, lease 1→0, reserved bytes 0, scene at baseline **while the source is still held**; releasing it does not resurrect the actor |
| eight committed seats + one stage, race change | `owned` reaches exactly 9, the 8 stay committed, replacement commits atomically, old body retired |
| eight committed seats + one stage, shape change | same, `height` 1.15 → 0.9 |
| two owners sharing one scene material build | removing one leaves the survivor with 15 meshes and no GPU errors |
| composed pose / bounds / sockets, Human | 20 meshes, 0 without finite written bounds, 11 sockets all parented to that actor's origin, main-hand weapon 95 mm from the hand socket |
| composed pose / bounds / sockets, Orc | 28 meshes, 0 unbounded, 11 sockets, weapon 96 mm |

Orc and Human main-hand grips evaluate differently — (0.460, 1.025, −0.107) against
(0.277, 0.886, −0.079) in actor-local metres — so the Orc palm policy demonstrably runs on a
natively staged body rather than only through a Human→Orc rebind.

Two corrections to the checks themselves, both of which had been passing on nothing:

* The retirement fence does **not** block `remove()` on an abortable fetch. `retire()` aborts
  the owner's controller before awaiting its preparation, so the fetch is cancelled; the
  fence exists for work that cannot be interrupted. The assertion now proves no leak instead
  of a block that never happens.
* Lite's world matrix is array-*like* — length 16, indexable, no `.m` or `.asArray`. The first
  socket reader missed every shape it tested, returned `null`, and passed the socket and grip
  assertions vacuously. Both now fail loudly if the transform cannot be read.

A route hold cannot stage-gate a race another seat already uses, nor any reshape: the
immutable cache serves an already-fetched body with no request. The stage is held at the
installed material-build boundary instead.

## Exact-owner cost (first run of the performance gate)

`measure-remote-pieces.mjs` had never run. Two defects in it were fixed before it produced a
number, and the second is the one that matters:

1. It read `ASHEN.canvas`, which does not exist, and crashed before any measurement.
2. With that fixed, its own surface assertion caught the real problem: the engine applies
   `maxDevicePixelRatio 0.75` unless the route pins `pixelRatio=1`, so a default URL renders
   **960×540 inside a 1280×720 window**. Reporting that as the 1280×720 gate would have been
   a manufactured pass. The measured run pins `pixelRatio=1` and asserts the render buffer.

Verified surface: canvas 1280×720, devicePixelRatio 1, seven enemies, physics on, zero page
errors. Diagnostic open meadow, identical camera across counts, three 12-second runs each, no
recording, one renderer.

| exact owners | mean FPS | mean ms | p95 ms | p99 ms | max ms | >6.94 ms | >8.33 ms | >16.67 ms | cap flag |
|---|---|---|---|---|---|---|---|---|---|
| 0 | 213.7 | 4.679 | 5.0–5.1 | 8.7–9.5 | 9.9 | 55–71 | 34–48 | **0** | none |
| 1 | 207.4 | 4.822 | 8.8–8.9 | 10.0 | 11.7 | 278–298 | 203–219 | **0** | none |
| 8 | 160.5 | 6.217–6.252 | 6.7–6.8 | 7.1–7.2 | 11.7 | 32–50 | 3–7 | **0** | none |

Eight natively composed exact owners cost **+1.552 ms of mean frame time (+33.2%)**, about
0.194 ms each, and no run put a single frame over 16.67 ms. No run tripped a cap heuristic;
every `capReason` reports the mean is not locked to a display interval.

One observation rather than an explanation: the **one-owner** rows have the widest spread of
the three — p95 8.8–8.9 ms against a 4.82 ms mean, and ~290 frames over 6.94 ms, where eight
owners sit tightly at p95 6.7–6.8. The distribution at one owner is bimodal in a way neither
zero nor eight is. That is recorded, not accounted for.

**Scope.** This is the diagnostic meadow comparison its header declares, not the prescribed
solo five-route gate and not M8 hub capacity. It says what eight exact owners cost in one
scene; it does not retire the open equipped-forest 240 Hz cap qualification, and appearance
streaming and promotion are still unmeasured separately.

## Final behaviour recaptured (2026-10-01)

The Telegram 838 capture predates the final retirement fence and the identical-frame sample
optimisation, so the three-race × five-design motion was recaptured on current source at a
pinned `pixelRatio=1`.

1,247 frames, 103.933 s, 1280×720, zero page and zero GPU errors. Every owner, lease, byte
reservation and pending build returned to zero, scene meshes and dynamic casters back to
baseline. Three body loads against twelve live equipment changes with `peakOwned` 2 — the
same-body reuse path held across all five designs on each race, rather than restaging per
outfit.

Reviewed motion: Telegram **839**,
[VE](https://ve.sparkify.dev/wow-clone/ashen-reach/character-mmo/remote-pieces-final-2026-10-01.mp4)
(`video/mp4`, HTTP 200, `accept-ranges: bytes`, 206 on a range request, 28,288,526 bytes).

### Retracted: the "Orc Duskguard cuirass defect"

An earlier revision of this section, and Telegram 839's caption, reported the Orc in
`duskguardCuirass` as a defect that blocked publishing that piece. **That was wrong.** The
comparison was against an *Undead in a different design* — Wayfarer mail, which is textured —
so the Duskguard design's own smooth untextured plate was mistaken for an Orc-specific
failure. Compared like with like, Human, Orc and Undead in Duskguard at the same pose and
camera all read the same way; the Orc is simply larger.

Everything measured since agrees:

| | human | orc | undead |
|---|---|---|---|
| cuirass bbox (m) | 0.385 × 0.494 × 0.367 | 0.639 × 0.737 × 0.597 | 0.395 × 0.518 × 0.380 |
| depth / width | 0.953 | 0.935 | 0.962 |
| vertices / triangles | 5,217 / 8,258 | **7,101 / 10,452** | 6,522 / 9,166 |
| materials | identical names, roughness 0.419, metallic 0.899, untextured | same | same |

The Orc carries *more* geometry than the Human, not less, and the proportions match. The
"30% smaller file" in the first report was the prepared remote descriptor, whose byte size is
texture-dominated under texture-only preparation and says nothing about geometry — that
inference was unsound.

What remains is an observation about the design rather than a fit defect: the Duskguard
plate is untextured with no normal map, so its form comes entirely from geometry and vertex
normals and it reads smooth at every size. That is most noticeable on the Orc because the
surfaces are largest. It is an art-quality question for the design, not a race fit problem,
and **it does not block publishing the piece.**

