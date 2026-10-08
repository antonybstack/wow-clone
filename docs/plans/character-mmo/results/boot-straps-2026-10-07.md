# Focused boot strap clearance — 2026-10-07

The existing offline equipment pipeline now gives the four authored ankle straps
6 mm of radial clearance on Human, Undead and Orc boots, including the Duskguard
underlayer. This is a focused local fit correction. Production remains
**7d00c56 / 5723a4ab**; the startup reliability release hold stays open.
Reviewed motion is Telegram **883** and
[identical VE MP4](https://ve.sparkify.dev/wow-clone/ashen-reach/boot-straps-2026-10-07/75a371ad847b-motion.mp4).

## Change and evidence

The actual previous live boot clip shows bright coincident strap/shell seams.
Authored component inspection identifies two leather shells and four separate
straps, 214 vertices each. The pinned before-straps masters retain the accepted
sole/forefoot correction and exactly match the previous canonical assets.

`build-boot-straps.mjs` moves only the 856 strap vertices in rest XZ around each
native Foot joint. Y, shell positions/normals, topology, UVs, skin weights,
materials, source joints and inverse binds stay exact. The existing normal helper
rebuilds strap normals. The existing strict factory bind checker validates all
three fits against their accepted bodies before and after GLB readback; each has
65 joints and zero palette delta. No runtime fitter or animation change.

The revision-1 descriptor pins the authored source, three before-straps masters,
three bodies, named joints and selected components. Native private audition and
canonical publication use identical candidate bytes. Two independent builder runs
are byte-identical. The existing publisher is reused with `--publish --straps`;
ordinary `--publish` retains the sole path. Duskguard uses its existing compiler
and reviewed boot underlayer, with unchanged plate attributes.

The first canonical publication stopped on an exact Orc plate-index assertion.
Meshopt may cyclically rotate each triangle during index compression, as documented
in its [index codec](https://github.com/zeux/meshoptimizer#index-compression).
The corrected strap path permits only this representation change, retaining face
order, winding, multiplicity and every semantic array. It independently decodes
the encoded result and checks those invariants again. The ordinary sole path keeps
its exact-index check. An actual native codec control exposes the rotation; four
negative mutations are refused. Provenance reports the compiler's Orc index
inequality honestly. Root's final decoded canonical comparison also finds all
three plates' index arrays equal to the prior canonical output.

Publication remains staged per manifest, rather than a global transaction. The
first failed attempt left three canonical boots updated while greaves/derivatives
remained old. No game verification or deployment ran in that partial state. The
corrected ordered pass completed all derivatives before building or capturing.

## Verification

- Character **231/231**, equipment **115/115**, native codec controls **2/2**.
- Native Lite bounds: **51 pieces**, **162,617,865 points**, zero escapes. Final
  byte-cache entries, reserved bytes and leases are zero; peak **4,496,592 bytes**
  within the **8,388,608-byte** ceiling.
- Human shapes, starter compacts, coverage, identity equipment and remote pieces
  use the existing preparation commands; the canonical build passes.
- Root's independent decoded comparison verifies prototype/canonical/immutable
  byte equality, unchanged plate attributes and reviewed underlayers. All fifteen
  other catalogue entries per race remain exact. Older addressed files remain.
- Largest compact outfit **2,103,172 bytes**: **225 bytes smaller** than the prior
  local forefoot build, **448 bytes above** qualified production. This is payload
  evidence, not a startup timing result.
- A fresh independent Grok 4.6/high review finds no material code defect. Its
  visual assessment uses stills and reports; root owns actual motion acceptance.

The [curated receipt](../../../baselines/character-mmo/boot-straps-2026-10-07/receipt.json)
retains native exits, descriptor/bind proof, decoded comparisons, full native
bounds rows, live cases, reviewed-file hash and the failed publication receipt.
The live capture's product fingerprint is
`55ea4549acdf72b917983b36a05220afd924fa98dbb8687ba80386968e83d722`
(1,180 files); current product inputs match it exactly.

Preparation uses `prepare-boot-sole.mjs --publish --straps`, followed by the existing
Human-shape, starter, coverage, equipment-only identity and offline remote tools;
then native remote bounds, remote publication and equipment tests. The build-only
Pages command enables saved bootstrap, primed starter world, lazy world buffers
and deferred covered hair. No seal, Pages upload or promotion runs in this pass.
Rebuild the current reviewed packs with `--publish --straps`; current Duskguard
underlayer pins select that derivative. Reproducing an earlier sole pass needs
its matching prospective underlayer pins, which are checked before publication.
Run the native codec controls directly with
`node --test scripts/test-triangle-index-contract.mjs`.

The retained early failures are an Orc body-mesh name, missing older Orc deformation
extras, source triangle representation, the private preview's final receipt path,
an already-compressed idempotent codec-test fixture, and the first partial
publication. Their corrected native commands succeed; none establishes a runtime
defect. Raw evidence is `.cache/character-mmo/boot-ankle-2026-10-07/`.

## Visual review and remaining work

Root reviewed the actual canonical 1280×720 MP4 at normal and half speed,
including Human endpoints, Orc/Undead run, normal Havok motion and restored
Undead source feet. The accepted private trial reduces coincident strap/shell seams; its
idle framing is wider than the prior canonical clip, so it cannot establish an
idle aliasing improvement. Canonical capture retains the previous close idle
camera and existing wider run framing for comparison. Root compared matching
Human side/idle frames against the preceding canonical pass. Ten cases pass with
65 bones, zero runtime/GPU errors, grounded Human/Undead jump finishes and zero
recovery teleports. All required captured boot/greave asset responses are 200;
the separate Orc proof uses those saved responses, without another visit.

The MP4 contains 999 fixed-size source frames and
lasts **33.332118 seconds**, versus **33.332610 seconds** of captured elapsed time.
It has square pixels and zero rotation. Recording HUD values are not FPS evidence.
The inherited recorder's overlay still says “Canonical boot sole”; the pinned
asset URLs and source fingerprint identify this strap pass.

Telegram returns matching 1280×720 dimensions and a 34-second integer duration.
VE returns `video/mp4`, identical full-GET SHA-256 and a successful 206 byte-range
response. Root separately checks direct browser playback: native/rendered
1280×720, advancing time from 8.579 to 20.844 seconds and no video error. These
checks do not establish new Telegram inline/fullscreen or physical iPhone acceptance.
All owned game and media-review tabs/servers are closed; user Edge/Orca stay intact.

Leather pleats, knot/cuff overlap, aliasing and the inherited Orc ankle shell
cavity remain. Some straps sit locally proud. Open-cuff ray parity and distance
counts are diagnostics; source overlap and remaining posed intersections mean
this is not zero-clipping or complete mixed-fit acceptance.

No new public startup cohort or independent FPS measurement runs. The rejected
preview's required-texture failure, original 14/60 fetch failures, 362 ms input
upper-bound outlier and current physical iPhone acceptance remain open. Do not
extend the exhausted unchanged diagnostic campaign. Further fit work should
inspect the remaining shell/cuff defect and neck/waist/wrist combinations, then
prove the authored shield through existing sockets and equipment transactions.

Workflow follow-up: the complete native bounds pass took **470.280 seconds** even
though only six equipment pieces changed. Investigate reuse of unchanged-piece
proofs only with pinned native Lite version, policy, body palette, source clips,
morph inputs and compiler inputs. This pass still runs all 51 pieces; a file hash
alone is insufficient to skip its native checks.
