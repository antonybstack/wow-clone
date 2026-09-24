# Golden-hour mountain fog — 2026-09-23

The user-supplied World of Warcraft Forever screenshot is preserved at `.dream-loop/sun-fog-reference/wow-forever-sunset.jpeg` for local comparison. Its useful lighting relationships are a near-white low sun on the left, peach fog hiding the valley floor, mauve mountain layers that remain distinct, blue upper sky on the right, and warm foreground structures that retain shape. The target is this lighting and depth composition in Ashen Reach's own world.

## Research direction

- [Epic's exponential height fog documentation](https://dev.epicgames.com/documentation/unreal-engine/exponential-height-fog-in-unreal-engine) describes low-place density and a separate directional inscattering color/exponent. This maps to Ashen Reach's existing analytic height fog plus a stronger sun-facing basin term.
- [Epic's volumetric fog documentation](https://dev.epicgames.com/documentation/unreal-engine/volumetric-fog-in-unreal-engine) recommends keeping global density modest and concentrating scattering or local density where shafts should read. It also identifies shadowed directional light as the basis for volumetric rays.
- [NVIDIA GPU Gems 3, Chapter 13](https://developer.nvidia.com/gpugems/gpugems3/part-ii-light-and-shadows/chapter-13-volumetric-light-scattering-post-process) explains radial light scattering and why an occlusion mask matters. It provides a fallback if the existing depth-occluded sky rays cannot produce the reference's soft light break.

## Milestones

## Delivered V9 local pass

Six repeatable live views were captured before and after the change. Final frames are in `ve-capture/ashen-reach/sun-fog/v9-final/`; the user's exact screenshot is retained locally at `.dream-loop/sun-fog-reference/wow-forever-sunset.jpeg`.

The implementation moves the low sun left of the citadel, opens cloud cover around its glow, grades the sky from warm light to blue, and separates fog color from sky brightness. Height-limited peach mist catches the northern basin. Mountain rings now use a dedicated mauve material. A shared angular shaft field modulates both sky and fog. The valley bands are a stylized approximation, not shadow-mapped volumetric light; individual trees and rocks do not occlude those bands.

The final 18.5-second 1280×720/60 FPS live MP4, `ve-capture/ashen-reach/env-lighting/video-v9-sun-fog-2026-09-23/v9-sun-fog.mp4`, was reviewed and sent to Telegram as message 741. `npm run build`, `git diff --check`, and six live captures pass with zero console or black-frame errors. The capture script now detects black world frames after a shader compile failure found during iteration.

With seven enemies in uncapped headless Chrome on Apple Metal 3 and no recording, two 960×540 internal-resolution / 1280×720 viewport runs averaged 407 and 378 FPS over 600 samples (p95 3.8/4.6 ms, p99 38.3/21.3 ms). At 1280×720 internal, the 600-sample run averaged 308 FPS (p95 6.1 ms, p99 53.8 ms). Average throughput exceeds 120 FPS under these conditions; occasional long frames remain. Production was not deployed.

1. Capture fixed ordinary and elevated north/south game views; compare the supplied image for palette, fog layering, and silhouettes. Preserve the exact reference locally.
2. Establish a readable sunset sky: move the sun toward the left horizon, expose warm light near it, keep an open blue upper sky, and reduce cloud cover where it hides the solar glow.
3. Concentrate peach-colored height fog in the northern mountain basin. Give distant landforms separate values while retaining the citadel and nearby silhouettes. Keep the player and foreground buildings legible.
4. Shape soft rays from actual mountain/cloud occlusion. Test the existing sky-ray route first; use a compact occlusion-based post pass only if the live result still reads as painted sky stripes.
5. Review matched screenshots and live motion, correct the largest defect, check shader/build/runtime behavior and uncapped FPS, then deliver a reviewed MP4 on Telegram. Production deployment is a separate user action.

Acceptance: the sunward view visibly carries a bright left-hand glow and peach valley fog, the sky reads cooler above and to the right, at least two ridge layers remain distinct, and the light break looks soft in motion. State the measurement resolution and any remaining approximation honestly.
