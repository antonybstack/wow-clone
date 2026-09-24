# Loading screen refresh — 2026-09-24

## Problem and approach

The user's iPhone screenshot showed desktop keyboard instructions squeezed into a tall column over the loader. The help was visible before touch controls initialized, and the previous loading overlay did not cover it. The startup artwork, title and progress also lacked a coherent phone layout.

The replacement is an original inline SVG churchyard with layered mountains, a chapel, iron gates, lamps and mist. No new bitmap downloads are required. HTML-linked CSS styles the first response before the game module runs. Portrait phones use a two-line title; desktop uses one line; short landscape has a compact layout. Safe-area padding, coarse-pointer guidance and reduced-motion rules are included.

## Implementation

- `ashen-reach.html`: initial loading state, accessible status/progress markup, inline artwork, retry details, inert canvas.
- `src/ashen-reach/loading-screen.css`: responsive scene, typography, progress, mist, failure and exit states. Hides gameplay controls during startup.
- `src/ashen-reach/loading-screen.js`: six completed-stage progress values, slow-load message, keyboard guard, retry and transition lifecycle.
- `src/ashen-reach/main.js`: stage updates at actual initialization boundaries; reveal only after the dressed character and controls are ready. Combat and gameplay input remain paused while loading. Startup frames do not enter gameplay performance samples.

Progress represents completed stages, not downloaded bytes. There is no fake minimum loading duration. The initial rendered frame remains measurable as `ASHEN.presentMs`; `ASHEN.ready` follows the final fade and input enablement. Deferred hostile readiness retains its existing `whenHostiles` contract.

## Verification and corrections

`node --test scripts/test-loading-screen.mjs` passes all eight browser tests. These cover 320px and 430px phones, root-route redirect, desktop, short landscape, coarse-pointer desktop and reduced motion. The tests gate the initial module request to inspect the HTML/CSS before application initialization, check bounds and help visibility, then verify monotonic progress, ready state and menu interaction. A delayed body download checks blocked gameplay keys. A failed body download checks readable failure and successful retry.

Thirty existing GPU compatibility, touch input, targeting and spell visibility unit tests pass. The Chromium injected-depth-failure movement check and desktop WebKit native check also pass with no runtime/GPU errors. The Pages build passes. On published preview `7a5dd862`, native desktop WebKit with a mobile viewport passed the visible-world movement check (16.33 units), physics readiness and error checks.

Reviewed initial-layout screenshots at 320×568, 430×734, 844×390 and 1280×800. Review caught a moon cropped on portrait phones; its position was corrected. Small stage/header text was enlarged. Reviewed the live loading-to-game recording, including real touch movement and jump, after those corrections.

`node scripts/ashen-reach/record-loading-screen.mjs` records natural local startup and real touch input through the owned Chromium CDP endpoint. Capture: 430×734 viewport, device scale 1, mobile/touch emulation; approximately 322×550 game canvas. This run reached the initial frame at 957 ms and ready at 1,856 ms, then moved 10.14 units with no runtime/GPU errors. Those are local Mac observations, not iPhone timings or a performance benchmark. The MP4 is encoded at 60 FPS; it does not establish the project's >120 FPS runtime goal. Physical iPhone review remains pending.

## Delivery

The user confirmed verification and authorized commit/push on 2026-09-24. The requested subtitle removal is included. Earlier references to pending phone review describe the pre-handoff checks.

- Preview: https://7a5dd862.fardel.pages.dev/ashen-reach
- Reviewed motion: https://ve.sparkify.dev/wow-clone/ashen-reach/loading/2026-09-24-loading-to-play.mp4
- MP4 verified as HTTP 200 `video/mp4` and delivered through `tg file`, Telegram message **748**.
- Local evidence: `ve-capture/ashen-reach/loading-v1/`, with motion and report under `motion/`.
- Production remains on iPhone compatibility release `6a7a4f8` / Pages `ac8e866e`. This task does not deploy production or commit changes.

## Lessons

Validate loading UI before application JavaScript runs: a screenshot after `ASHEN.ready` cannot expose this regression. Test a held asset request and a failed request as well as the fast path. Keep visibility, input readiness and combat readiness under one explicit lifecycle. Gate gameplay keys during startup so early menu or camera input cannot disrupt initialization. Use real stage completion and separately describe slow loading; percentages would imply byte-level precision this loader does not have.
