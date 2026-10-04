# Human face proportion refactor — 2026-10-04

The user rejected the earlier connected Human face as disproportionate and
jarring. The corrected source uses an anatomical similarity fit, aligned eye
landmarks, a more defined jaw/mouth, fitted brows and detailed eyes. The rejected
audition's engineering checks remain valid for its mechanics; its art judgement
is withdrawn. This result is a corrected DEV audition, not a production identity
release or a claim of user aesthetic approval.

## Diagnosis and implemented correction

The old fit multiplied head width by 133%, depth by 105% and height by 119%.
It also reused a ground-relative pivot after applying a whole-body age target:
the older eye sockets ended up approximately 4.1 cm lower on the same torso.
The head was displaced rearward relative to the released face. Enlarging the
hood to clear that skull compounded its silhouette.

All head, eye and hair vertices now share a uniform metre-to-centimetre transform.
Each age's source eye centres align independently to the measured face landmark,
so body stature changes do not become changes in facial placement. Native
MakeHuman face targets define the jaw, lips and eyes without rebuilding its
anatomy solver. Body/muscle targets are excluded: the actual released torso,
compatible 65-joint bind and 57 source clips are retained.

| Emitted geometry, neutral | Head width | Crown height |
| --- | --- | --- |
| Released Human, including fused hair | 18.66 cm | 176.00 cm |
| Rejected young | 23.50 cm | 179.53 cm |
| Corrected young / ponytail | 17.67 cm | 175.67 cm |
| Rejected older | 22.59 cm | 175.97 cm |
| Corrected older | 16.99 cm | 176.22 cm |

[Independent measurements](../../../baselines/character-mmo/m5/face-2026-10-04/proportions.json)
read the actual emitted meshes. The regression guard also reparses the
hash-pinned rejected body packs and detects both failures. Its thresholds guard
scale/placement; they do not decide whether a face looks good. Bald skull width
is not expected to equal the released head's outer hair width.
The optional negative-control audit requires the preserved rejected DEV cache
matching the earlier committed preparation hashes. A fresh checkout can reproduce
the corrected source independently; it cannot run that historical byte comparison
until those rejected packs are restored. The audit fails explicitly when missing.

Native globe shrink, cornea and back-tuck helpers were reused with a conservative
95% globe scale. The historical 83%/aggressive lid-wrap recipe was tried in the
live game and produced slit eyes; it was removed. The original CC0 eye atlas now
retains sclera and iris detail rather than flattened whites and painted fixed
catchlights. The CC0 brow proxy follows the same Head skin/morph field, with
native Shrinkwrap and 1.5 mm standoff. A texture-ownership bug was also corrected:
matching `eye` in a texture name accidentally reduced `eyebrow001` to 256 pixels.
Only textures owned by the actual eye mesh now receive that cap; the source brow
detail survives full texture promotion.

The neck uses native BMesh smoothing through all shape layers and a shorter
six-centimetre colour transition. A neck-circumference target caused flared wings
and was removed after live review. The current hood retains its original crown
size, with its opening fitted to the corrected eye envelope and its posterior
lining retained. Hood preparation verifies the actual target skull hash to reject
a fit left over from another head.

The head reproduction script no longer rebuilds unrelated M005 clothing caches.
Its earlier side effect overwrote the historical Pilgrim fit using a subsequently
reweighted public source. The original immutable source reproduced the historical
`669469f3…` bytes exactly; that cache was restored and its old report preserved.
Current clothing is decoded from the actual published manifest by the review
preparer. The explicit unfitted-hood control also now carries provenance instead
of failing the runtime's preparation guard before `ASHEN.ready`.

## Verification and review

Full `node scripts/character-assets/reproduce-human-identity-review.mjs` source,
native Blender 5.2.1 authoring/baking, hood and pack reproduction passes with the
tracked source pins. [Receipt](../../../baselines/character-mmo/m5/face-2026-10-04/reproduction.json).
The source contract checks exact curves, joint palette, retained clothing surface,
welded neck, eye/brow morph correspondence, alpha and source brow texture detail.
Across 855 pose samples per source, neck split position/normal differences are
zero. Below 1.46 m, all 2,617 clothing-interface samples retain positions to
1.16e-6 m. 166 character, 112 equipment and six startup-prefetch tests and the
production build pass.

The final live matrix uses neutral, short stout and tall slender, all three
identities, six current outfits and front/side/back views. Source hashes are
recorded alongside each row. All 162 rows pass with Havok active, zero recoveries
and no GPU/page errors; saved characters remain unchanged. Actual close front,
three-quarter and profile motion is included in the delivery, together with hood
on/off, eight authored preview motions and normal walking/jumping/casting.

Grok 4.6/high performed a read-only source/image critique, then a follow-up. Its
useful native recipes were tested rather than accepted automatically. It confirms
the disproportionate skull and age offset are corrected. Its suggestion to widen
the older head to the released *hair* bounds was not implemented: it would undo
the uniform anatomical fit without a matching bald reference. The dark aged
brow pigment and ponytail01's high frontal hairline remain style-polish items,
not evidence of a continuous-age or arbitrary-hairstyle capability. The subsequent
texture-ownership fix preserves brow strands; pigmentation is a separate choice.
[Initial critique](../../../baselines/character-mmo/m5/face-2026-10-04/grok-review.md),
[follow-up before the final brow-detail fix](../../../baselines/character-mmo/m5/face-2026-10-04/grok-followup.md).

Documentation references accompany the authoring APIs, including
[MakeHuman targets](https://static.makehumancommunity.org/mpfb/docs/assets/concept_targets.html),
[fitted assets](https://static.makehumancommunity.org/mpfb/docs/assets/concept_clothes_hair_bodyparts.html),
[native Shrinkwrap](https://docs.blender.org/manual/en/latest/modeling/modifiers/deform/shrinkwrap.html)
and the existing glTF skin/morph/disposal links. New head/eyes/brows/hair use the
pinned CC0 sources; the retained project torso/rig/animation rights are unchanged.

## Performance, motion delivery and remaining scope

M1 Max, Chromium 154 / WebGPU with uncapped flags, 1280×720 viewport and
canvas / pixel ratio 1, seven enemies, Lector, short stout (+0.95 build / 0.90
height). Each cohort walked meadow, town, bridge, cathedral and forest for three
12-second runs per route. No capture, authoring, encoder or other game page ran
during sampling. Released control, older and ponytail ran sequentially, not as
an interleaved causal experiment.

| Cohort | Route mean FPS range | Pooled p95 | Pooled p99 | Worst interval |
| --- | --- | --- | --- | --- |
| Released control | 213.8–251.9 | 5.6 ms | 6.1 ms | 14.1 ms |
| Corrected older | 208.6–242.8 | 5.7 ms | 6.2 ms | 13.3 ms |
| Corrected ponytail | 209.3–245.0 | 5.6 ms | 6.1 ms | 12.7 ms |

Zero of **81,572 candidate intervals** exceed 16.67 ms; **343 exceed the 6.94 ms
144 Hz budget**, so the result is not a promise of 144 FPS on every frame. The
older/ponytail meadow run 3 p99 is 9.2/9.0 ms; these bursts are retained, not
hidden by the pooled tails. Older route mean frame time is +1.9% to +3.8% versus
the released control; ponytail is −0.4% to +2.8%. The small cost of these detailed
candidates stays within the local throughput target. Near-240-Hz cap heuristics
flag one control and seven candidate full windows, plus two candidate rolling
windows. All are labelled in the [summary](../../../baselines/character-mmo/m5/face-2026-10-04/fps-summary.json)
and preserved raw reports; they do not establish uncapped headroom beyond that
pacing. No runtime errors, GPU errors or recovery teleports were observed.

The reviewed [74.096-second live MP4](https://ve.sparkify.dev/wow-clone/ashen-reach/character-mmo/m5-face-refactor-2026-10-04.mp4)
is Telegram **851**. Original frames, viewport, canvas and encoder are 1280×720,
square pixels, normalized rotation. Capture elapsed time is preserved to 1.2 ms
across the three concatenated segments. Telegram returns 1280×720 and a rounded
75-second duration. The public object serves `video/mp4`, 43,035,310 bytes, HTTP
200 and byte-range HTTP 206. VE play/seek and Telegram Web inline/media-viewer
motion preserve 16:9. Native fullscreen activation did not visibly succeed in
this automation session for either player, so **fullscreen and Telegram Desktop
remain unverified**, rather than inferred from the matching metadata.
[Delivery](../../../baselines/character-mmo/m5/face-2026-10-04/delivery-manifest.json),
[Telegram response](../../../baselines/character-mmo/m5/face-2026-10-04/telegram-delivery.json),
[playback review](../../../baselines/character-mmo/m5/face-2026-10-04/playback-review.json).

All owned game contexts and slot 7 Chrome/Vite are stopped; its ports are closed.
The owned VE tab is closed, Telegram viewer/chat exited with zero playing media,
and unrelated user browsers/Vites remain intact.
[Final ownership audit](../../../baselines/character-mmo/m5/face-2026-10-04/final-browser-ownership.json).

Default production continues to use the released Human. Saved identity, selected
compact startup, broad hairstyle authoring and device/production acceptance remain
M5 work. No character capability flag was raised by this source refactor.
