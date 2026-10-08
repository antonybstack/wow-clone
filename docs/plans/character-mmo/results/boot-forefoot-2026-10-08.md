# Authored forefoot and anatomical ankle coverage — 2026-10-08

Canonical preparation, written source proofs, fresh built-game motion and separate
performance measurement pass. Implementation **989ab52** is committed/pushed,
and reviewed motion is delivered as Telegram **888 / 889** with identical VE.
Production remains **5723a4ab / 7d00c56**; this work does not qualify a release or
complete the five-priority goal.

The baseline has a folded Human toe at short/stout and an Undead vamp ridge.
Reusing the original CC0 MakeHuman boot last restores authored toe form through
`build-boot-last.mjs`. Its forefoot blend retains the previously fitted ankle/cuff,
3530 vertices, wound source triangles, UVs, materials, source weights and native
65-joint bind. The accepted Orc last and greave plates remain unchanged.

The first geometry candidate exposed small Human ankle skin and an Undead grey
body triangle. Higher vamp geometry made Human clipping worse and is rejected.
A private native Blender nearest-face weight transfer did not remove the breach
and is also rejected; its changed weights are not part of the canonical candidate.

Native `setMeshVisible` isolation identifies the protrusion as body geometry.
Earlier probes using bare `mesh.visible` did not invalidate cached render bundles
and are invalid isolation evidence. The [native visibility procedure](../../../debug-view.md#inspect-deliberately)
now records this distinction and the preparation-exit gate.

The original FootCore policy hid only faces below the ankle whose corners carry
>98% Foot/Toe influence. Actual source anatomy leaves **382 Human / 373 Undead**
additional faces wholly below that same ankle boundary because their vertices
also carry Leg influence. Those weights are deformation influences, not anatomy
labels. The revised index-only policy includes the existing lower-leg/foot/toe
family below the unchanged boundary; crossing faces and any morph endpoint above
it stay visible. The old v1 policy remains available explicitly for historical
rebuilds. Boots-off restores the complete triangle union. Open footwear would
need a separately reviewed coverage policy; this evidence concerns the two
current opaque boots only.

The private mask candidate covers eleven canonical body artifacts and preserves
source attributes, morphs, skin, frame and source curves on written readback.
One actual native capture passes five profiles × Wayfarer/Duskguard, Human shape
endpoints and ordinary Human/Undead Havok sprint/jump with zero recoveries and no
runtime/GPU errors. Root reviews actual normal and half-speed playback; the
reproduced protrusion and white ankle peeks disappear. This supports canonical
integration, not final canonical acceptance or a performance claim.

Ten focused tests pass, including mixed ankle restoration, crossing/morph
boundaries, historical v1 reproduction and idempotent existing-partition repair.
The existing identity-equipment publisher gains explicit `--foot-coverage`:
repartition accepted body bytes, preserve eyes/brows/hair/torso/source clips,
refresh written geometry proofs and normal-policy source fingerprints, stage
addressed outputs and validate descriptors before the stable index changes.
The repair also retains every previously covered oriented face, including its
multiplicity. Independent review found that a count-only assertion could permit
one old face to become exposed while another replaced it. The producer now
refuses that case; its regression fixture exercises precisely that failure.
Before refreshing compact normal provenance, the existing surface checker compares
the repaired written full and compact bodies, including foot membership, exact
positions, skin, morphs, textures and playable curves. All three identities measure
maximum normal component error **0.0000296831**, below the existing 0.0001 bound.
The reviewer's assumption that compact positions were quantized was incorrect and
is withdrawn. No runtime fitter, extra skeleton or shader change is introduced.

The canonical pipeline passes **240 character tests**, **115 equipment tests**
and one native sweep of all **51 pieces / 162,782,025 sampled points**, with no
bounds escapes or native/GPU errors. Final byte leases and reservations are zero.
After the producer-proof correction, all six identity body hashes and three remote
source-manifest hashes remain exact, so the passed sweep is reused.

The corrected build uses all four accepted startup flags and preserves the exact
Havok binary. **347** locally served resource comparisons pass with browser
compression negotiation. Fresh canonical motion passes five profiles × two boots,
active 65-joint source animation, Human shape endpoints, ordinary Human/Undead
Havok sprint/jump and Undead bare-foot restoration, with zero recoveries or errors.
Root reviews the actual MP4 at normal and half speed: the demonstrated Human
ankle peeks and Undead protruding body triangle are absent. Cuff/knot/plate-edge
overlap, pleats, proud straps and aliasing remain. This is focused fit acceptance.
The silent recording is **1280×720**, square pixels, zero rotation and
**32.930136 seconds**, within 0.5 ms of its capture timestamps.

Preparation failures stay preserved: the first canonical attempt refused stale
v1/448 coverage metadata; the second refused stale starter-world provenance;
the targeted finish omitted the accepted saved-bootstrap flag and hit the existing
early-entry import guard. Exact v2/830 metadata, fresh world preparation and the
complete recorded build profile correct those failures. No guard was weakened.
The [build procedure](../../../DEPLOY.md#build-and-verify-before-publishing) now
records all four flags to prevent the omitted-flag failure from recurring.

Maximum-payload enumeration caught a separate integration regression before final
acceptance: the repaired compact body hashes no longer matched the strict
covered-hair proof pins, silently disabling the existing substitution. The
maximum grew from 2,170,524 to **2,367,719 bytes**. The existing decoded comparison,
now tracked as `prove-covered-hair-substitution.mjs`, proves the new bald/ponytail
pair has identical non-hair geometry, morphs, nodes, bind, playable curves, scenes
and material pixels. Only texture authoring names and the fully covered named
ponytail differ. Refreshing both exact pins restores the strict existing path;
unknown pairs still fall back to the selected body. The four existing policy tests
now run in `test:character`.

The corrected global maximum is **2,170,019 bytes**, 505 below the previous
accepted maximum. The hooded substitution saves 263,156 bytes; the actual maximum
is uncovered prime ponytail with mixed plate, skirt/staff, shield and shoulders.
Three fresh native controls pass normal held restoration, intentional restoration
failure with explicit retry, and uncovered startup; unhood/rehood/race-return,
saved identity and ordinary Havok movement remain valid. An additional 17.944797-second
live MP4 records the held-transfer restoration diagnostic at 1280×720 with square
pixels and zero rotation. These local controls establish functionality, not a new
public cold-start qualification.

Fifteen separate settled windows on the corrected maximum observe
**203.0–237.1 FPS**, maximum p95 **5.9 ms**, p99 **6.1 ms**, worst **14.4 ms**.
All 39,922 measured intervals remain below 16.67 ms; errors and recoveries are zero.
Conditions: Apple M1 Max, Chromium WebGPU with uncapped flags, 1280×720/DPR1,
seven enemies, three 12-second windows each on meadow/town/bridge/cathedral/forest;
no recording, builds, encoding, profiling or other game, with reference media paused.
Six bridge/cathedral windows retain possible 240 Hz pacing flags; those are
observed lower bounds and do not establish clean uncapped maximum throughput.
The first retained local run used the enlarged covered recipe and observed
201.9–239.1 FPS, p99≤6.2 ms and worst 13.1 ms. It remains separate from the final
corrected-recipe acceptance rather than being discarded.

Two Grok operation turns reached their CLI turn caps while their already launched
native controllers continued. Parent inspected the actual controller PIDs, awaited
native reports and confirmed each operation's real child exit and cleanup before
acceptance. CLI terminal failure remains recorded separately; it is neither a
native gate failure nor permission to launch a duplicate operation.

Independent Grok review confirms both corrected producer proofs and the new strict
covered-hair pins; no established new defect remains in those changes.
[Tracked receipt and raw compressed evidence](../../../baselines/character-mmo/boot-forefoot-2026-10-08/receipt.json)
retain both measured recipes, failures, native exits, proofs and ownership.
[Forefoot live MP4](https://ve.sparkify.dev/wow-clone/ashen-reach/boot-forefoot-2026-10-08/4286fb475f5c-forefoot.mp4)
and [covered-hair restoration MP4](https://ve.sparkify.dev/wow-clone/ashen-reach/boot-forefoot-2026-10-08/fad37c061a8a-covered-hair.mp4)
are byte-identical on VE with `video/mp4`, matching length and HTTP 206 seeking.
Telegram **888 / 889** return exact 1280×720 dimensions. Root reviews actual
Telegram Web inline/expanded and direct VE playback: the videos advance with
correct 16:9 proportions. Owned review tabs/servers are closed; prior reference
playback is restored. Actual Telegram desktop application fullscreen remains
unverified. Public startup qualification
stays held on its unexplained required-texture failure; unchanged cohorts will
not be rerun. Current physical iPhone acceptance remains open.

Evidence under `.cache/character-mmo/armor-fit-2026-10-08/`: baseline, candidate,
candidate-2, candidate-skin, native-isolation, audition-coverage, union proofs,
native child exits and append-only ownership history. Failed assembly and
pre-capture refusal remain preserved. These ignored diagnostics are not recovery
sources for canonical art; source masters, descriptor pins and tools are tracked.
