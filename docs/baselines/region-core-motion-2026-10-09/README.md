# Physical-core woodland motion check — 2026-10-09

Completion audit found the candidate needed one combined live proof of trunk
contact, paused full-detail arrival and distance hysteresis. No product source,
geometry, loader or deployment was changed in this pass. Tested public source
4b6707a on [the final G08 preview](https://aafce17b.fardel.pages.dev/?dev&play&regionCore=1&at=west-keep).
The standard region loader remains default. This is functional evidence, not
isolated performance or load-time acceptance.

## Actual native results

Eight cases pass in the final [native report](native.json). Fifteen focused CPU
checks pass for baked woodland, region packets and streaming; [output](cpu-tests.txt).

- Existing Developer tools Westwatch spawn succeeds after physical core while the
  full-tree request is held. Selected tile `-1,1` draws its completed reduced mesh
  and registered reduced shadow despite requesting full detail.
- The actual baked trunk at (-100.259,15.296,178.373), width/depth0.662m,
  height4.076m, resists sustained ordinary W input. Z advances only0.000274m in
  the additional600ms contact hold. E sidestep then W moves around it and beyond
  the trunk. Havok active, Fly off, zero recoveries; approach/contact/escape traces
  are retained. Existing Fly is used only to stage the approach before capture.
- Full detail arrives while the ordinary menu pauses movement. Body position
  remains unchanged; full ordinary/shadow representations become visible and
  registered, reduced representations hide, native transform versions and woodland
  revision change. This proves invalidation/selection, not isolated GPU cache cost.
- Camera-to-tile-bounds distances97.810→132.026→157.924→124.839→91.639m draw
  full→full→reduced→reduced→full, with matching shadow visibility. Existing Fly
  and W/S/Space stage this diagnostic distance sweep; it is not normal traversal.
- Zero collected runtime/GPU errors or recovery teleports. No geometry is rebuilt
  during this check. Seven animated enemies remain present.

The [native helper](native-check.mjs) preserves its source for reproducibility;
run it from the repository root with the owned CDP endpoint and cache output. UI controls are existing Westwatch destination, Fly and ordinary movement;
heading setup uses existing player/rig APIs equivalent to RMB steering. The held
request is an explicit test fixture. This selected tile/trunk check complements
prior all-landings/surface/failure/retry/disposal proof; it is not every tree contact.

## Review, failures and delivery

The first helper used D to escape, which turns without RMB; E is the actual strafe
control. A second contact-plane assertion failed without enough trace to establish
cause; classify it as inconclusive staging, not a confirmed product defect or fix.
Structured traces were then added; all eight cases passed. Root's initial motion
review found the outward camera facing away from the target tile. A final capture
uses backward S while facing the forest; all eight cases pass again. Earlier
failures/original offscreen sweep remain in the ignored cache. No product change
was made to force acceptance.

Root reviewed actual final local motion and direct VE playback, including active
playback at11.840s and the31.753467s end. Visible trunks remain through the tested
transitions; no blank target tile was observed. Capture is784 timestamped live
frames, fixed1280×720/DPR1, square pixels, normalized rotation0. Native browser
media fragments aid review; the delivered MP4 is the complete unretouched capture.
HUD readings during recording are not benchmarks.

[Final VE MP4](https://ve.sparkify.dev/wow-clone/ashen-reach/gothic-exploration/2026-10-09/woodland-core-motion.mp4):
14,872,618 bytes, SHA256c3836a9f8de80c382d540f9fae2b43a940f6af7689718ce8727734d04abc6a82.
HTTP200/video/mp4/exact local bytes and1024-byte range206 pass. Telegram **902**
returned matching1280×720 dimensions; actual file duration31.753467s. Telegram
application inline/fullscreen remains unverified. Initial uploaded object was
replaced by this reviewed final capture before Telegram delivery.

## Remaining gates and ownership

Three isolated cold50Mbit/s candidate/control pairs, ≥20% median navigation gain,
first-play/install tails and fifteen settled FPS windows remain pending. G06–G08
isolated performance and production's separate required-texture hold are not waived.
An unrelated user Shadowglass renderer's status remains unresolved after the tool
rejected internal browser status inspection; no bypass or contaminated claim.

Root owned Chrome64512/CDP10037,Vite64469+64507/5873, then final
Chrome89526/CDP10037,Vite89483+89521/5873, one context at a time. Both harness
sets stopped; contexts closed. Media79423/7077 and Edge review1147996210/6213
are closed after delivery. User Edge2931/fifteen original tabs, Chrome13883/New Tab,
Orca and unrelated Vite4000 remain intact. [Final ownership](ownership.json).
Raw frames/helper logs remain `.cache/region-core-motion-2026-10-09`; manifest,
structured proof and final public MP4 provide durable recovery.
