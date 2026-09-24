# iPhone rendering and input investigation

Status: input fixes and a capability-selected shadow compatibility fix are implemented. The user confirmed visible movement in Safari on the affected iPhone using isolated preview **`76899bd7`**. Its report confirms the original depth bundle fails validation and the fallback succeeds without subsequent reported GPU errors. Production is unchanged; Edge verification of the fix and production release remain pending.

Device supplied by the user: iPhone 14 Pro Max, iOS 26.7, Edge. Reference: `/tmp/C490C081-1867-4211-B32B-D5BF1E883B92.mov`, copied intact to ignored `ve-capture/ashen-reach/iphone-regression/user-reference.mov`.

## Physical device result — Safari confirmed

The user reported that movement now displays in Safari on the preview and supplied this diagnostic report:

```json
{
  "build": "iphone-depth-probe-1",
  "ua": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.6.2 Mobile/15E148 Safari/604.1",
  "depthBundle": "empty-fragment",
  "probeError": "setPipeline: validation failed",
  "fallbackError": null,
  "errors": [],
  "frames": 1710,
  "worldCasterFragment": true,
  "canvas": [322, 581],
  "player": {"x": -1.5472157651258447, "z": 0.625375732828394}
}
```

The failing original probe, successful fallback probe, active world-caster fragment, and restored visible movement confirm the compatibility mechanism on this device. `frames` counts scene callbacks, not independently verified GPU presentations or an FPS benchmark. Keep the exact user agent as evidence; it reports Safari 26.6.2, while the user's initial OS description was 26.7. Do not infer the installed OS version from that discrepancy.

Acceptance is specific to this Safari preview session. The original Edge report and prolonged device stability still need release verification. No additional graphics reduction was needed.

## What the recording shows

The 11.57-second recording alternates between black canvas frames and apparently old startup images, including both the clothed and undressed player. Consecutive frames around 6.9 seconds show this particularly clearly. The DOM HUD, joystick knob, target labels and minimap continue changing. This suggests that the apparent movement freeze can be a presentation failure while simulation continues. It does not establish a specific shader, touch handler, or browser defect as the cause.

Production is V12 (`8c20843`, Pages `3d6eb578`). Input code did not change between the V10 baseline and V12.

## Reproduction and evidence

- Chromium with a genuinely coarse pointer, mobile viewport, DPR 3 and native CDP touch events moved the character. A narrow desktop viewport alone had not tested this path.
- Installed Playwright WebKit 2359 / Safari 26.6 on the Mac. Both local and production rendered clothing and movement without runtime errors. This is **desktop WebKit on a Mac GPU**, not the reported iPhone/Edge build.
- A roughly 45-second WebKit soak showed stable texture allocation (99 created, 9 destroyed, approximately 102 MB live under the probe's estimate), advancing shadow frames and movement, no reported device loss or runtime errors. Texture accounting is not total GPU memory accounting.
- The new browser check examines composited screenshots for predominantly black frames and compares world pixels before/after travel. It checks Havok, device loss, uncaptured GPU errors, resizing, actual Chromium touch travel, interruption and recovery. WebKit travel uses keyboard input because the public Playwright WebKit touchscreen API only exposes taps.
- The browser check passes on both desktop engines. A finite screenshot sample cannot exclude every flicker; passing does not close the hardware report.

Evidence is under `ve-capture/ashen-reach/iphone-regression/`, including the original frame sequence, WebKit soak, browser reports and a live Chromium touch recovery clip.

Reviewed motion: [12.72-second Chromium touch recovery MP4](https://ve.sparkify.dev/wow-clone/ashen-reach/iphone-regression/2026-09-24-mobile-recovery.mp4), 430×734, encoded at 60 FPS, scene 322×550. Includes test resets to the southern path and viewport resizing. This is functional evidence from desktop touch emulation; capture/encoding rate is not a performance benchmark. Public response verified as `video/mp4` with byte-range support.

Delivered via `tg file` as Telegram message **745**, explicitly labeled desktop emulation with iPhone flicker still open.

## Confirmed input defects and fixes

1. Stick/jump ownership survived lost pointer capture or input resets. Subsequent fingers could be refused. Controls now release private ownership, held axes and capture together.
2. Blur cleared public input but left private touch movement/jump held; polling restored it. Blur and hidden-document transitions now clear all held state and notify controls. There is no persistent blur latch requiring a later focus event before a new legitimate press works.
3. A global cancellation handler released the world finger when an unrelated finger was cancelled. World releases now check pointer ownership, including `button: -1` cancellation/capture-loss events, and do not synthesize a click.
4. Disabled controls and failed pointer capture can no longer queue movement or retain an unusable pointer owner. Jump now has the same ownership rules as the stick.

`scripts/test-touch-input-lifecycle.mjs` imports the actual source modules into a small event/capture fixture. Against the committed pre-fix modules, 14 of its 16 cases fail; all 16 pass with the patch. Together with stick, targeting and spell visibility tests, 25 tests pass. Build passes. These fixes address proven input bugs; they are not presented as a fix for stale/black canvas presentation.

## Run again

```sh
node --test scripts/test-touch-input-lifecycle.mjs scripts/test-touch-stick.mjs scripts/test-targeting.mjs scripts/test-spell-visibility.mjs
node scripts/ashen-reach/check-mobile-runtime.mjs --record
npx playwright install webkit
node scripts/ashen-reach/check-mobile-runtime.mjs --webkit
npm run build
```

The Chromium check connects to the owned CDP endpoint from `scripts/lib/cdp.mjs`, creates and closes its own context, and leaves existing tabs alone. WebKit launches and closes its own browser. Set `ASHEN_TEST_URL` to test another build; production is expected to fail the new input interruption cases until the fix is released. The screenshot checks measure visible changes, not performance. No new >120 FPS claim is made from these mobile-sized capture runs.

## Remaining investigation

The user confirmed the failure persists with `noPost`, `pixelRatio=0.35`, in both Edge and Safari, and with screen recording off. The simulation and HUD progress while the scene appears frozen/flickers. These comparisons do not exclude the shadow passes: both sun maps still execute with `noPost`, and their resolution remains 2048 regardless of canvas pixel ratio.

### Concrete shadow candidate and implementation

The separate [WebKit 319980 fix](https://github.com/WebKit/WebKit/commit/eefdc13c0e17cb0f37b0b272b482ed598f0b8c61), committed July 22, 2026, corrects rejection of fragmentless pipelines in depth-only render bundles. This is an exact match for Lite's opaque world shadow caster: no color target, `depth32float`, absent fragment stage, encoded in a render bundle. Native PBR/standard shadow views already retain their no-color fragment stage. All passes share the frame's command encoder; rejecting a shadow bundle can reject the submission that also draws the scene.

Implementation milestones:

1. **Identify and test the operation — done.** `gpu-compatibility.js` probes a vertex-only depth bundle inside a validation error scope before scene compilation. If rejected, it verifies an explicit empty fragment variant separately. This selects by actual device behavior, not user agent.
2. **Retain graphics and correct the failing path — done.** On the verified fallback path, the world shadow material uses Lite's public `depthOnlyFragment: true` option and an empty fragment entry point. Geometry, shadow bias, cascades, fog, bloom, movement and native bundles remain active. GPU API constructors are not patched. Devices passing the original probe use their original path.
3. **Reproduce the mechanism and verify — done on desktop engines.** The browser test can inject a real WebGPU validation error for fragmentless depth bundles. Disabling the fix recreates a black game canvas with an active HUD; the pixel check fails and GPU errors are captured. With the fix, Chromium and WebKit both render moving scenes without uncaptured GPU errors. This is an injected reproduction of the identified mechanism, not proof of the physical phone's underlying defect. Thirty unit tests pass; the Pages build passes.
4. **Physical device confirmation — Safari passed.** The user's [preview](https://76899bd7.fardel.pages.dev/ashen-reach?play&clean&gpuDiagnostics) report is preserved above. The panel collects no automatic remote telemetry. Desktop WebKit smoke also passes (17.48 units of visible movement, no GPU errors). Edge acceptance remains pending.
5. **Production release — pending.** Commit/push/release have not been performed for this patch. Preserve the capability probe rather than assuming every Safari version needs the fallback, then verify the production build on the affected device after release.

Run the positive and negative controls locally (Vite and owned Chromium must be running):

```sh
node --test scripts/test-gpu-compatibility.mjs
node scripts/ashen-reach/check-mobile-runtime.mjs --inject-depth-bundle-failure --record
node scripts/ashen-reach/check-mobile-runtime.mjs --webkit --inject-depth-bundle-failure
# Expected failure: black canvas and rejected submissions with the pre-fix caster.
node scripts/ashen-reach/check-mobile-runtime.mjs --inject-depth-bundle-failure --disable-depth-fallback
```

The negative control intercepts only the local Vite shadow module to disable the fallback. It does not edit the checkout. Test injection instruments browser GPU calls only; none of that instrumentation ships in the game. Artifacts use separate `*-depth-rejected-runtime` and `*-depth-fallback-runtime` directories.

Reviewed [12.88-second fallback motion clip](https://ve.sparkify.dev/wow-clone/ashen-reach/iphone-regression/2026-09-24-depth-fallback.mp4): native Chromium touch, full graphics, injected rejection with capability-selected fallback, capture interruption recovery and resize. 430×734 output at 60 FPS encoding, 322×550 scene. This is not an iPhone performance measurement; the >120 FPS target remains separate.

Public clip verified as `video/mp4` with byte-range support and delivered through `tg file`, Telegram **746**. The published diagnostic panel was also inspected at 430×734; its Copy report button and collapse control are visible.

Primary research: [WebKit canvas flicker report 301627](https://bugs.webkit.org/show_bug.cgi?id=301627) describes a similar historical symptom and reports a fix in Safari 26.4. Its duplicate [302711](https://bugs.webkit.org/show_bug.cgi?id=302711) concerns Metal command encoding and instanced vertex buffers. The user reports 26.7, so those reports are useful comparisons, **not an established diagnosis**. [Playwright browser documentation](https://playwright.dev/docs/browsers) describes its browser builds; emulation does not reproduce the physical device's GPU/compositor.

## Retrospective

The V12 production smoke checked keyboard movement and portrait rendering, but missed real touch interruptions and did not test displayed-frame freshness. Keep those as separate acceptance checks. Preserve the user's consecutive frames: a screenshot or changing JavaScript position can look healthy while the presentation layer fails. Keep unit fixes, desktop reproduction, and physical-device acceptance explicitly distinct in handoffs.
