# Boot sole candidate — native audition, 2026-10-07

**Candidate reviewed; canonical asset publication and production acceptance are
pending.** Production remains source **7d00c56**, Pages **5723a4ab**. This completes
the reproducible correction and private audition checkpoint, not the equipment
release or the original five-priority goal. The current physical iPhone exit and
original unexplained startup/input failures remain open.

## Defect and bounded correction

Human and Undead fitted Wayfarer boots had a large folded lower sole edge. The
authored footwear was smooth, and sampled bind/Idle/Sprint poses showed no new
large stretching from source Foot/Toe transforms. The fitted geometry already
contained the fold. Broad replacement of the lower foot worsened coverage and
was rejected. A wider 18–50 mm fade improved Human soles but exposed Undead toes;
that candidate was also rejected.

The accepted private candidate changes only **Y** in the authored lower band:
full correction below 18 mm, smooth fade to zero at 25 mm. It references the
same-side native body floor, puts the authored sole 6 mm below it, and uses 1.2×
authored sole height. X/Z, upper boot positions, topology, UVs, weights, joints,
bind matrices and textures remain intact; normals are recomputed. This is a
pinned two-fit derivative, not a general fitter or runtime deformation system.
Human shape transfer and Duskguard underlayer assembly remain with their existing
compilers. Orc geometry is unchanged.

`scripts/character-assets/build-boot-sole.mjs` reproduces the candidate from
`blender/characters/wardrobe/boot-sole.json` and tracked before-correction masters:

```sh
node scripts/character-assets/build-boot-sole.mjs .cache/character-mmo/boot-sole
node --test scripts/test-human-foot-coverage.mjs scripts/test-coverage-manifest.mjs scripts/test-coverage-partition.mjs
```

The builder refuses unpinned source/body bytes and outputs only an isolated
`.cache` candidate. Separate read-back checks preserve indices/non-position
attributes, X/Z and the upper band; the independent factory checker verifies the
65-joint palette and exact inverse binds. Two runs on this pinned host produce
identical bytes. All decoded candidate arrays match the private live audition;
the reproducible container adds the explicit `soft-skin` declaration required by
the existing factory verifier. No checker was weakened. Source rights remain the
accepted CC0 MakeHuman suits02 derivative and existing body/rig grants described
in [equipment authoring](../../../ashen-equipment-authoring.md).

Undead also needed the existing semantic `foot` coverage to have a real source
mesh boundary. `deriveFootCore(doc,race)` preserves the reviewed Human classifier
and measures Undead's own source landmarks. It partitions indices only when all
three triangle corners lie below the native ankle and each has >98% Foot/Toe
influence. **659** Undead foot triangles become `UndeadFootCore`; torso+foot+body
preserve all **8,741** oriented triangles, shared attributes, source animation,
mesh frames and binds. The coverage manifest owns the new adapter. Bare-foot
restoration requires visibility of both partitions, rather than replacing skin.
This follows native [glTF mesh](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#meshes)
and [skin](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#skins) contracts.

## Verification and motion review

Seventeen focused tests pass. These include source-frame/mixed-weight controls,
unsupported/missing-landmark refusal, actual Undead write/read preservation, and
the existing native-picked Human face/winding/ULP gate. Independent Grok 4.6/high
reviews find no consequential compiler or candidate-builder defect on the pinned
inputs. The builder review wrote its result before reaching its six-turn cap;
the CLI cancellation is retained and is not a successful worker exit.

Native private audition: **10/10** cases, two boot tiers on five profiles: original
Human, Prime tall/slender (height 1.15/build −0.95), Prime short/stout (0.90/+0.95),
neutral Orc and neutral Undead. Actual Human boot morphs are checked, not inferred
from creator labels. Both Undead boot tiers hide the active `UndeadFootCore`;
removing boots through the actual equipment UI restores it. Normal Human and
Undead movement each sprint, jump and land with Havok active, zero recovery
teleports and zero reported runtime/GPU errors. Native asset SHA/length checks
are enabled. All candidate requests return 200.

Root played the actual **32.898-second, 1280×720, square-pixel H.264 MP4**, reviewed
ordinary traversal plus diagnostic Armory front/side/gait footage, and inspected
bare restoration. The large folded soles improve and sampled Undead toes remain
concealed. Cuff/strap overlap and aliasing remain visible. Fast Armory run phases
sometimes leave the close diagnostic frame; normal gameplay is included. This
does not establish zero clipping across every animation or mixed outfit. It is
not a performance benchmark: this recording is paced near 60 Hz.

Reviewed motion was delivered as **Telegram 879** and the identical
[VE MP4](https://ve.sparkify.dev/wow-clone/ashen-reach/boot-sole-candidate-2026-10-07/audition.mp4).
Remote `video/mp4`, HTTP 206 range access and public/local SHA-256 equality pass.
Telegram returns matching 1280×720 dimensions; root separately played the direct
VE video at its native 1280×720 dimensions. This does not establish Telegram
fullscreen or current physical iPhone acceptance.

The private preview changes all relevant external manifests **and the inert HTML
identity catalogue**, whose inline recipes otherwise kept old Human boots. It
uses raw GLBs for the direct Undead loader. The final visibility probe scopes to
the current race, because parked Human source meshes remain in the scene. Failed
selector/raw-loader/embedded-catalogue/probe attempts are retained separately,
not counted as product failures or successful acceptance. Seeked pose checks wait
for the actual UI paint before screenshots.

Compact evidence is in
[the native receipt](../../../baselines/character-mmo/boot-sole-candidate-2026-10-07/receipt.json).
Full local reports, operators, rejected candidates, captures and independent
reviews remain under `.cache/character-mmo/boot-silhouette-2026-10-07/`.

## Next package: canonical publication and release

1. Generate the pinned Wayfarer candidates. Publish only the reviewed Human and
   Undead neutral derivatives through the existing asset metadata/provenance
   path. Preserve original masters and all unrelated equipment.
2. Update those races' Duskguard underlayer pins and use the existing builder;
   do not copy private audition files into production or bypass its source guards.
3. Regenerate Human shapes, starter compacts, coverage, identity equipment and
   affected remote/native bounds using current publication tools. Reuse accepted
   body/hood inputs and source animation. Check both external and embedded
   catalogue entries, decoded hashes and `body.meshes`/coverage adapter alignment.
4. Play canonical published assets: the ten reviewed cases, removal/restoration,
   swaps/failure/rollback/disposal and covered/uncovered identities. Add a native
   Undead picked-face fixture if an exposed face requires classifier adjustment.
   The conservative rule leaves mixed-influence ankle faces exposed; do not
   claim that every below-ankle face is hidden.
5. Build/seal once, run relevant release qualification and isolated first-play /
   settled route checks, then deploy and verify production. Preserve the one-second
   first-play fence and >120 FPS goal. Publish reviewed canonical motion and
   record the exact release/rollback. Fresh physical iPhone acceptance remains
   distinct from desktop emulation.

The original 14/60 preview fetch failures and 362 ms post-screenshot input
upper-bound outlier stay unexplained. Keep the queue at four; the completed
four/eight trial failed its p99 threshold. Do not reopen closed trials or repeat
unchanged cohorts to manufacture progress.
