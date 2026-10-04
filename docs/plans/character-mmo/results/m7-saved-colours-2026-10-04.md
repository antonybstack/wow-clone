# M7 — saved equipment colours and atomic recolouring

2026-10-04. Resumed Claude's `1412770` checkpoint; human identity art and the unreviewed mixed-armor matrix remain separate work. Local acceptance is recorded below. Reviewed motion is [VE MP4](https://ve.sparkify.dev/wow-clone/ashen-reach/character-mmo/m7-saved-colours-2026-10-04.mp4) / Telegram **849**. Source **`4063f49`** is pushed and deployed; production verification is recorded below.

## Player-visible behaviour

Armory → Equipment colours offers the existing ten-entry `ashen-dye-v2` palette for worn helmet, torso, legs, boots, gloves and shoulders. Choose once to apply; Undo colour and Reset colours have their own bounded history. Undyed restores the authored material. Factory hand props have no dye channel. Slot colours follow an occupied slot across outfit changes, and disappear when it is emptied. Equipment/race changes clear colour undo; body changes preserve it.

The committed v5 recipe is the colour authority. A failed fetch or material build leaves the old garment visible and does not save an unrendered choice. Saved colours reach material creation before first play, including compact starters, full-detail promotion, Human shape promotion, race restoration and native remote-piece revisions. Existing disabled skin/hair/age controls are unchanged.

Claude's catalogue republish changes metadata only: all 45 piece hashes and 19,418,944 bytes remain unchanged. No asset regeneration was required.

## Native implementation and ownership

This exposes the existing glTF `baseColorFactor` at material creation; it does not add a shader or texture pipeline. The factor multiplies the texture and stays within 0–1, so it cannot exceed the source texture's untinted colour. It replaces the garment's original factor; a pale palette entry can therefore be lighter than a dark authored tint. The failed alternatives and palette decisions remain in the [mechanism](m7-dye-mechanism-2026-10-03.md) and [palette](m7-dye-palette-2026-10-04.md) reports.

The equipment loader stages a second resource for a colour identity that differs from its cached piece. It retains the committed owner until the visibility transaction succeeds; failure/supersession disposes only the hidden replacement. Resource ownership uses a Set, because two resources can have the same logical item ID during staging. Idle reuse compares colour identity.

A worn recolour awaits Lite's public [`rebuildScenePbrPipelines`](https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/packages/babylon-lite/src/scene/scene-rebuild.ts) before commit. The existing, version-guarded queue adapter now lives in `native-material-staging.js`, free of the developer crowd graph. It claims only this owner's queued meshes, using the reviewed [native queue](https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/packages/babylon-lite/src/scene/scene-material-swap.ts). Fresh streams and reusable idle pieces retain the normal native queue. Disposal hides retired garment owners immediately, then drains native work before releasing resources. A retired implementation does not rewrite shared-body coverage already owned by its successor.

[Grok review](../../../baselines/character-mmo/m7/persistence-2026-10-04/grok-review.md) identified the overly broad player fence and delayed visibility retirement. Both were accepted and corrected; [parent disposition](../../../baselines/character-mmo/m7/persistence-2026-10-04/grok-disposition.md) distinguishes that dated review from final acceptance.

## Evidence and limits

All raw reports are in [the baseline directory](../../../baselines/character-mmo/m7/persistence-2026-10-04/).

- Final unit checks: **166 character / 112 equipment / 5 presence**, zero failures. Pages build and provenance checks pass.
- Default-route persistence: **25 passing cases**; save/undo, first-playable native material, compact/full and shaped restoration, three race reloads, idle-colour reuse, invalid/empty/hand slots, held fetch, actual HTTP 500 and recovery. Returned status, visible materials, storage and recipe are compared together. Cache-disabled failure routes must assert a hit.
- Colour neutrality: **54 rows** across six slots and three races, zero geometry/coverage/visibility disagreements or accumulation. A separately coloured reference selects garment-responsive pixels; measured noise and tested colours use the same mask. The prior whole-crop run failed two Human shoulder rows due to background noise and is retained. No acceptance threshold was lowered; the smallest final margin is **1.14×** its noise-relative floor. Mask coverage is **4.37–19.28%** of the original crop.
- Live recolour: **40 changes**, **664 sampled membership frames**, idle control **179 frames**, zero absent-garment frames. Median/worst transaction latency **14.4 / 24.3 ms**. Separately preserved render intervals: **720 samples**, p95 **12.5 ms**, p99 **18.1 ms**, max **20.6 ms**; **10 >16.67 ms**, **0 >33.33 ms**. This meets the appearance-change budget, not an every-frame 60/144 Hz guarantee.
- Native remote-piece lifecycle: **13 cases**, dyed boot and same-body revision included; zero final owners, leases, pending builds, reservations or tracked GPU handles. Scene returns to **138 meshes / 38 dynamic casters**, zero runtime/GPU errors. Total driver/GPU memory remains unavailable.
- Normal spawn movement and cathedral entry/return at all four Human height/build endpoint pairs pass with Havok and no recovery teleports. Chromium native touch, interrupted input, real depth-fallback injection and desktop WebKit pass, including narrow-layout saved-colour selection. Programmatic select/change does not prove the OS picker UI. No new physical-iPhone acceptance claim.

### Startup

Compressed local build, M1 Max, 1280×720, 50 Mbit/s with 40 ms latency; twenty fresh Chrome processes per cohort. Dressed, grounded, GPU-completed, input-enabled first play plus subsequent keyboard displacement. OS/CDN/GPU-driver caches uncontrolled.

| Cohort | p50 | p95 | Maximum | Failures |
| --- | ---: | ---: | ---: | ---: |
| Default | 874.8 ms | 885.4 ms | 886.1 ms | 0/20 |
| Saved Human endpoint / largest outfit / three dyes | 981.5 ms | 994.0 ms | **1,000.9 ms** | 0/20 |

Both p95 values meet the local one-second goal. One saved start exceeded one second and is retained. This does not close the previously deferred first-use GPU tail or establish uncached WAN/physical-phone startup.

These local cohorts precede the final authority-UI selector correction, which runs after play and changes no starter asset. The exact released build is checked separately below.

### Settled throughput

One intended game renderer, owned uncapped Chrome on CDP 10037, actual 1280×720 / device scale 1, seven enemies, Havok movement, no recording; three 12-second runs per route. Baseline is a separate Pages build of `1412770` with identical assets. Unrelated user Edge tabs and Vite servers were preserved; no other game page was rendering.

| Route | Candidate mean FPS, range | p95, range | p99, range | Worst | >16.67 ms |
| --- | ---: | ---: | ---: | ---: | ---: |
| Meadow | 221.0–221.2 | 5.7–5.8 ms | 8.1–9.5 ms | 12.4 ms | 0 |
| Town | 220.3–220.7 | 5.7–5.8 ms | 7.9–8.8 ms | 12.7 ms | 0 |
| Bridge | 246.4–247.5 | 5.4 ms | 6.0–7.2 ms | 10.9 ms | 0 |
| Cathedral | 253.2–253.8 | 5.2 ms | 5.4–6.1 ms | 11.7 ms | 0 |
| Forest | **236.7–244.1 observed** | 5.4–5.5 ms | 5.7–7.6 ms | 13.7 ms | 0 |

Mean-frame-time change against the pair is −0.29% to +0.13%. Forest triggers the existing cap heuristic in both builds: these observations exceed 144 FPS, but its exact uncapped ceiling remains unqualified. The original baseline run that stopped at the cap assertion is retained; a separately labelled forest cohort records all three rows. Meadow p99 variance prompted a single controlled follow-up: mean frame time **+2.81%**, average per-run p99 **+4.72%**, with baseline p99 **5.9/8.2/9.2 ms** versus candidate **8.1/8.2/8.1 ms**. The initial >5% aggregate tail difference did not repeat; variation remains in both builds and all rows are retained. This is not proof that every frame meets 144 Hz.

The largest saved outfit was also paired against the same baseline, with identical equipment and short/slender Human shape; only the candidate has its three saved colours. All fifteen runs in each build have **no cap flags**, including forest. [The paired report](../../../baselines/character-mmo/m7/persistence-2026-10-04/fps-largest-comparison.json) retains each row and interval count.

| Route | Dyed candidate mean FPS, range | p95, range | p99, range | Worst | Mean frame time change |
| --- | ---: | ---: | ---: | ---: | ---: |
| Meadow | 213.1–214.5 | 5.8 ms | 6.1–8.1 ms | 11.1 ms | −0.90% |
| Town | 214.1–215.2 | 5.8–7.6 ms | 6.0–9.5 ms | 12.1 ms | −1.65% |
| Bridge | 243.3–243.5 | 5.6–6.4 ms | 7.5–7.8 ms | 12.2 ms | −1.98% |
| Cathedral | 245.9–247.5 | 5.2–5.3 ms | 5.4–5.5 ms | 11.7 ms | −0.04% |
| Forest | 228.6–236.0 | 5.4–5.5 ms | 5.9–8.0 ms | 12.9 ms | +0.11% |

Across **41,478 candidate intervals**, zero exceed 16.67 or 33.33 ms. This clears the settled >144 FPS target with headroom. The paired route-average p95/p99 values all improve, with no repeatable >5% regression demonstrated. Recolour transactions retain their separate, slower tail above; these throughput runs do not include streaming or filming.

## Production release

Source **`4063f4909a5d2bf9b30c71f700deeb26e18b7dca`** is pushed and released at [play.sparkify.dev](https://play.sparkify.dev). Cloudflare Pages deployment **`b3fdafd8-c343-4147-ae2e-760a155c8d06`**, immutable host [b3fdafd8.fardel.pages.dev](https://b3fdafd8.fardel.pages.dev). Previous production/rollback is **`0c2f92c1-a4f8-43ab-838f-45c0f622df4b`** / source **`8ae4c2d`**, read before release. No rollback was required for loading or movement.

All **494 served artifacts** match the build, including the five optional region-actor files and their cache policies; **275 executable/critical resources** also match with browser compression negotiation, including woodland geometry, textures and Havok. The public colour report records **24 successful colour cases plus one explicitly unavailable shared-region surface**. The local authority-control timer is tested locally; public hosting/transport remains parked. Spawn movement and all four Human endpoint cathedral entry/return routes pass with Havok and no recovery teleport. Chromium native touch, interrupted input, injected native depth fallback and desktop WebKit pass, including narrow-layout saved-colour controls; zero runtime/GPU errors. Production captures are retained with the reports.

Public startup used the same fresh-process, 50 Mbit/s / 40 ms, 1280×720 protocol, twenty rows per cohort. All eighty rows validate dressed/grounded/GPU-completed first play and subsequent input with no runtime/GPU errors. The original `.html` gate URL receives a **308** to `/ashen-reach`; the normal root is **200**. This is the documented [Pages route behaviour](https://developers.cloudflare.com/pages/configuration/serving-pages/#route-matching). Both sets are retained, rather than replacing a slow cohort with a faster URL. Sequential WAN cohorts and uncontrolled CDN/driver state limit attribution beyond the observed redirect.

| Production entry / character | p50 | p95 | Maximum | <=1 second |
| --- | ---: | ---: | ---: | ---: |
| `.html` / default | 921.8 ms | **1,015.3 ms** | 1,034.0 ms | 18/20 |
| `.html` / largest dyed | 1,021.8 ms | **1,065.7 ms** | 1,090.8 ms | 1/20 |
| Root / default | 887.9 ms | **954.2 ms** | 968.6 ms | 20/20 |
| Root / largest dyed | 995.9 ms | **1,037.2 ms** | 1,066.6 ms | 10/20 |

The ordinary default entry clears the one-second target; the largest saved outfit does **not** clear the public p95 target. This small WAN overrun is retained as a startup-budget follow-up, separate from the earlier multi-second first-use GPU stall. Neither is claimed repaired by recolouring. The deploy script now prints the canonical root entry, with its documentation reference; no served game artifact changes after `4063f49`.

M7's bounded equipment-colour release is accepted: save/restoration, atomic failure, native lifecycle, live motion and settled throughput pass. The one-second claim remains bounded to the default root cohort. Full M5/M6 art and physical-phone acceptance stay open. The narrow Armory captures prove scrollable colour controls, but also show its existing side panel obscures much of the character at 430 px; a dedicated mobile preview remains M10 work.

`production-release.json` records deployment and gates; `ownership.json` records final cleanup. All test contexts close after their checks, and both owned compressed-preview servers are stopped. The owned Chrome/Vite harness is stopped at handoff; unrelated user Edge tabs and Vite 5173/4000 sessions are preserved.

## Capture/preview corrections and follow-up

The compressed preview caches responses at startup. After rebuilding its ordinary uncompressed HTML showed the new bundle while browser-negotiated Brotli still served the prior build. The new shared-region colour-lock check caught this. Retained `functional-stale-preview` is a failed test of the earlier build, not erased evidence. The preview was restarted and the existing release verifier now negotiates browser compression before comparing served bytes to `dist`; the procedure is recorded in `debug-view.md`.

The first grip capture cut the sword hand off-screen. The final capture uses the existing Armory camera at a wider radius and selects the visible Walk control. Source dimensions, canvas, timestamps, SAR and encoded dimensions remain validated by the shared capture/encoder tools.

Remaining limitations: `sage`/`ash` are weakly separated in dim light; the channel is one whole-piece tint, not independently authored trim/metal channels; physical-phone startup/memory/customization and full mixed-armor visual acceptance remain open. The parked presence client still needs a separate non-Human local-correction audit: `applyLocal` assumes Human shape controls, despite published Orc/Undead recipes. This report does not re-open public hosting or accept that path.

## Motion delivery

The final live recording has **1,496 frames / 61.858 seconds**, original viewport and canvas **1280×720**, H.264, square pixels, rotation 0. Encoding preserves capture timestamps (encoded 61.857 seconds); filming/reload time is excluded from performance measurements. Telegram returned **1280×720 / 62 seconds** and the sanitized receipt matches the file hash. Native VE playback, 206 range delivery, seeking and fullscreen pass.

Telegram Web A was inspected in the existing Edge session: inline video **737×414.5625**, expanded **1280×720**, fullscreen player **2510×1279** with `object-fit: contain` and proportional 16:9 content. The screenshots retain correct character/UI proportions. The fullscreen control/screenshot was checked; the read-only DOM fullscreen flag was false, so this receipt describes the player's presentation. It is not Telegram desktop or iOS app acceptance. The viewer was closed and all Telegram videos paused before later FPS measurements.
