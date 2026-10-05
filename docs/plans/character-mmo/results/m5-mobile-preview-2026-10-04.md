# M5 mobile Armory preview

The portrait Armory now keeps the character centered in a full-width live preview
above scrolling equipment controls. It previously centered the actor in the whole
canvas while the side panel obscured half of the preview. Heading and motion
controls have their own space, outfit buttons wrap, and the shared-region entry
is hidden while the modal is open. Human height changes update framing immediately.
The approved character assets and source motion are unchanged. **M5 remains open
and unreleased.** Production remains M7 `4063f49` / Pages
`b3fdafd8-c343-4147-ae2e-760a155c8d06`.

## Native camera and lighting

The existing scene, actor and renderer serve the preview. CSS owns its rectangle;
a ResizeObserver forwards that rectangle to Lite 1.31.1's normalized camera
viewport. Native `attachControl` and `setCameraLimits` replace the hand-written
orbit/wheel handlers and add two-finger pinch. Controls attach only while open,
detach on close, and are disposed with the scene. This adds no renderer or animation
loop. `setFocus` retains its existing diagnostic race-scale contract.
[Pinned camera documentation](https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/docs/lite/architecture/02-camera.md)
is linked in the source comments.

Custom ambient occlusion and volumetric fog now use native effective aspect and
viewport pixel bounds when reconstructing depth. Off-viewport samples cannot
borrow depth or fog from the panel area. The full-surface play camera remains the
default when the modal closes.

**An engine limitation is handled explicitly:** the installed native contact-shadow
pass adjusts camera aspect but reconstructs world positions from full-texture UVs.
It does not map the viewport offset/scale. It is disabled for a partial viewport,
while correct custom ambient occlusion and world shadows remain enabled. Native
contacts resume in normal gameplay. This reuses the native pass where supported
and does not introduce another contact caster.
[Pinned implementation](https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/packages/babylon-lite/src/post-process/screen-space-contact-shadows.ts).

## Verification and visual review

- Character tests **200/200** and lighting/projection checks **10/10** pass; the
  production build passes. All **849** built files are hashed. The **286** compared
  art/physics payloads remain identical to the previous playable-library checkpoint.
- **15 final built live layout cases** cover face and full body, identity change
  and independent undo, both Human height endpoints, native touch orbit and pinch,
  Human/Orc/Undead return, and live modal resize through **390×844, 320×568,
  844×390, 768×1024, 1280×720 and 430×734**. Camera target projection is checked
  through the installed native math API, and actual preview image entropy rejects
  an opaque/blank stage. Real captures, rather than state assertions alone, were
  reviewed. The final check also proves the partial-viewport contact guard and
  restored gameplay contacts.
- Three repeated open/close cycles add exactly one native control hook while open
  and retain the original count on close. Scene disposal while open removes both
  modal and launcher. No test context remains open.
- **Three final desktop mobile checks** pass: Chromium native touch (eight checks),
  WebKit keyboard travel/touch controls (four), and a real injected depth-bundle
  rejection with the empty-fragment fallback (eight). Each covers saved identity,
  undo, shape and dye controls, Havok, and displayed-world movement. There are no
  runtime or GPU errors. Chromium also covers capture loss, cancel, modal and blur.
  These use **430×734 CSS / DPR 3 / 322×550 render buffer**. They are desktop
  emulation and are not physical iPhone acceptance.

The final portrait recording contains **968** timestamped live frames. Source
elapsed time is **10.100126 s**, encoded time **10.099637 s** (−0.489 ms),
**430×734**, H.264, square pixels, zero rotation. Twenty decoded MP4 samples and
the actual public playback were reviewed. Free pinch zoom can crop the actor;
the Full body button restores the common framing. Inspection casts preview the
source pose and do not deal gameplay damage.

## Delivery and limits

Telegram **855** returns matching 430×734 dimensions; its duration metadata is
rounded up to **11 s** for the **10.099637 s** file, within the delivery check's
one-second tolerance. Its corrected
caption contains the final
[VE video](https://ve.sparkify.dev/wow-clone/ashen-reach/character-mmo/m5-mobile-preview-2026-10-04-b78dff00487c.mp4).
The downloaded public file matches local SHA-256
`b78dff00487c1b69a7656a93433664ec3cdc297c9d5d965beaa8a1124e8a5fd5`,
with `video/mp4`, 1,653,120 bytes and a 206 range response. VE actual play reaches
the end; paused native seeking moves 5.049818 → 4.948823 s. The owned tab is closed.
Telegram inline motion advances 0.614497 → 4.360089 s and expanded motion
4.312795 → 6.997576 s, both with `contain` and correct portrait proportions.
The fullscreen button changes its icon but native fullscreen activation is not
confirmed; Telegram Desktop remains unavailable. The user's Telegram page is
preserved with all four videos paused and the viewer at 3.830401 s.

Replacing a preliminary VE object exposed stale GET/video bytes despite current
HEAD metadata. The final object uses a content-specific key, and its full GET hash
matches. The caption is corrected; the sharing procedure records this check.

No startup or FPS measurement was attempted: user-owned WoW **92396** remains
actively rendering. New camera/post-process performance acceptance requires an
isolated run; full/half-size post targets are retained, so a smaller preview is not
a performance claim. Physical iPhone, complete outfit/motion fits, isolated cold
cohorts and the release gates remain open. All owned game browsers, Vite/preview
servers and reviewer processes are stopped. User Vite 5173/4000 and unrelated
Grok/Edge/WoW are preserved.

[Machine-readable evidence and captures](../../../baselines/character-mmo/m5/mobile-preview-2026-10-04/)
and [independent source review with parent disposition](../../../reviews/character-mmo/m5-mobile-preview-2026-10-04.md).
Next: finish the normal saved-route outfit/motion fits, then run the isolated
startup/FPS cohorts and production gates when the machine allows valid measurements.
