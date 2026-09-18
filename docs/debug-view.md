# Play, inspect and capture Ashen Reach

The actual Lite game is the visual authority. Blender renders and posed diagnostics are authoring evidence, not gameplay acceptance.

## Open the right route

From the repository root, run `npm run dev`, then open `http://127.0.0.1:5173/ashen-reach.html?play&clean`. Current game global: **ASHEN**, readiness: `ASHEN.ready`. The character lab and body preview expose diagnostic globals only; do not use their state or frame rates as Ashen evidence.

Recent sessions use an owned Chrome profile on **CDP 9337**. Check the target URL and ownership before driving it; leave unrelated user Chrome/9222 alone. The local shell preference is fish (`/opt/homebrew/bin/fish` on this machine). Browser tools or Playwright connected to CDP are both valid; missing MCP wrappers do not make local Playwright unusable.

```js
import {chromium} from 'playwright';
const browser = await chromium.connectOverCDP('http://127.0.0.1:9337');
const page = browser.contexts()[0].pages().find(p => p.url().includes('ashen-reach.html'));
await page.bringToFront();
await page.goto('http://127.0.0.1:5173/ashen-reach.html?play&clean', {waitUntil:'commit'});
await page.waitForFunction(() => window.ASHEN?.ready, null, {timeout:60000});
// Real key/button input for gameplay verification; inspect screenshot/video too.
```

Wait for Vite reloads to settle before navigating/capturing; simultaneous reloads can interrupt navigation. If a wait fails, inspect the live page and server rather than swallowing the error. `waitForFunction` timeout belongs in the third argument. Prefer commit + explicit ready to full load waits that can hang while the game is already running.

## Inspect deliberately

`ASHEN` exposes `engine`, `scene`, `rig`, `player`, `body`, `world`, `combat`, `armory`, `input`, `setView`, `reset`, and `metrics.summary()`.

**C / Armory** opens inspection on the actual actor; Escape restores the prior view. `armory.getState()` reports diagnostic playback. Equipment/race availability and the current implementation stage are in [the living plan](armory-and-equipment-plan.md). Close the armory before gameplay tests; its modal input suspension is intentional.

- `combat.spell` is Fire Blast; `combat.lava` is Lava Ball. `combat.pendingSpell` distinguishes charging. Read `body.getState()` for phase, cast elapsed time and release marker.
- `player.getMotion()` / `getGrounded()` report controller state; they are not proof of visual sole contact. Hold Space across render frames when testing held-key jump input; a zero-duration synthetic press can be missed.
- For module-level probes, import the game's exact optimized Lite URL from transformed `/src/ashen-reach/main.js`, including its query. Do not separately import raw `/node_modules/@babylonjs/lite/lib/index.js`: duplicate caches/registries caused misleading black-scene and pipeline failures.
- Inspect actual renderable descendants/materials. A named glTF transform may own several primitives; its parent is not necessarily the mesh.
- Direct camera/state changes are allowed for diagnostic views but must be labelled. Gameplay claims require actual inputs and verified state transitions.

## Existing harnesses

Use only checks relevant to the change; inspect scripts before running them against an owned browser.

```sh
node scripts/ashen-reach/check-cast-motion.mjs
node scripts/ashen-reach/check-fire-blast-play.mjs
node scripts/ashen-reach/check-fire-blast-polish.mjs
node scripts/ashen-reach/check-lava-ball.mjs
node scripts/ashen-reach/measure-lava-ball.mjs
node scripts/ashen-reach/record-lava-ball.mjs
node scripts/ashen-reach/check-two-handed.mjs
node scripts/ashen-reach/measure-armory.mjs --warden
```

Browser scripts accept `ASHEN_URL` to select an explicitly chosen server and share one CDP target; run them sequentially.

## See an image when tool results are OCR'd

In this environment, image tool results (reading a PNG, `browser_take_screenshot`) can arrive as `[OCR from image]` text only, so do not review visuals from them or equate them with acceptance. The active model is multimodal; to actually see an image, run a nested, tool-free call and read its text:

```sh
opencode run --pure -m opencode-go/deepseek-v4.1-flash "Answer from the attached image only; do not call any tools. <question>" -f ve-capture/ashen-reach/<pass>/<frame>.png
```

Put the message before `-f` (`-f` is a greedy array). Use `--pure` to skip plugins, and cross-check several camera angles because the spatial read can be inconsistent. `node scripts/ashen-reach/solve-two-hand-pose.mjs` is the two-handed arm-pose solver.

Recording to MP4: `ffmpeg` is not on PATH. Use the bundled `/Applications/BabylonJS Editor.app/Contents/bin/ffmpeg` (7.1, libx264/aac). `scripts/ashen-reach/record-two-handed.mjs` writes timestamped JPEG frames, `frames.ffconcat`, `audio.webm` and `recording.json` (with `audioOffset`); encode with `-f concat -safe 0 -i frames.ffconcat -ss <audioOffset> -i audio.webm -c:v libx264 -pix_fmt yuv420p -fps_mode vfr -c:a aac -movflags +faststart -shortest`, then publish with `scripts/ve-upload.sh`.

Record errors and failure evidence, not just successful assertions. Never replace a failed assertion with a tautology or accept nullable counters as evidence. A black screenshot is a failure even when a structural test passes.

## Capture, review and performance

CDP screencast includes the DOM HUD; `canvas.captureStream()` alone does not. The spell recorder captures Lite's actual audio mix through `createAudioEngineMediaStream`, not microphone audio or a staged soundtrack. It writes JPEG frames, `frames.ffconcat`, `audio.webm` and `recording.json`. Align audio using the recorded offset when encoding H.264/AAC. Review representative frames across the whole action and a useful second angle. Keep caster and target visible for projectile review.

Measure foreground frame times separately from recording, after warm-up. Report actual buffer resolution, sample count, average, tails/stalls and whether other GPU work was active. Do not discard slow frames or call unsupported GPU timing zero. The current 960×540 buffer is an intentional pixel-art presentation; don't claim its ~144 FPS as native-resolution performance.

Runtime evidence goes under `ve-capture/ashen-reach/<pass>/`. Use session authorization to send reviewed video/stills with the local Telegram helper (`~/.grok/skills/telegram/scripts/tg file ...`). Do not expose credentials. Poll at sensible boundaries while active; no monitoring persists after the turn ends. R2 publication is optional when separately useful/authorized, not a prerequisite to Telegram delivery.

## Share a public video URL

The VE host is **`https://ve.sparkify.dev`**, backed by Cloudflare R2 bucket `fardel-ve`. A Telegram attachment does not automatically create a URL there. When public sharing is authorized, upload the reviewed video with the existing helper from `the repository root`:

```sh
scripts/ve-upload.sh ve-capture/ashen-reach/<pass>/<walkthrough>.mp4 wow-clone/ashen-reach/<pass>/<date>-<walkthrough>.mp4
```

The helper reads `CLOUDFLARE_API_TOKEN` from the environment and sets MP4/WebM MIME types explicitly. It uploads with Wrangler `--remote` and exits on failure; do not retry without `--remote`, since a local object is not published. Keep credentials out of output and links. Use pass-specific keys to avoid replacing previously shared evidence.

Before sharing the returned URL, check HTTP success, `Content-Type: video/mp4` (or `video/webm`), matching content length, and a byte-range GET returning `206`/`Content-Range`. Verify browser video metadata/playback when practical. Include the verified public URL in the normal chat response and the authorized Telegram caption/message so the user can copy it; sending the binary alone is insufficient for link sharing.

For character asset work, consult [blender-lite](../.agents/skills/blender-lite/SKILL.md) and [equipment authoring](ashen-equipment-authoring.md). The old shrine export npm commands no longer exist.

After a repository move, verify the Vite process working directory and HTTP route before attaching the browser. A listening port can belong to a server rooted in a removed directory. Record any temporary port in the pass evidence; root Vite defaults to 5173. If an owned browser has no game tab after a failed navigation, create one explicitly and wait for `ASHEN.ready`.
