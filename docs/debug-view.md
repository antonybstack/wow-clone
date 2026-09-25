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

### Measure above the headless Chrome 60 FPS cap

The usual owned headless Chrome on CDP 9337 paced `requestAnimationFrame` at 60 Hz in a 2026-09-23 test. A 60 FPS result there measures the browser compositor limit, not the game's maximum throughput. For a separate uncapped benchmark, use the existing isolated harness:

```sh
node scripts/harness/up.mjs --slot 7 --headless --uncapped
ASHEN_CDP_PORT=10037 ASHEN_URL='http://127.0.0.1:5873/ashen-reach.html?play&clean' ASHEN_UNCAPPED=1 node scripts/ashen-reach/measure-scene-fps.mjs --seconds 7
node scripts/harness/down.mjs --slot 7
```

Slot 7 uses Vite 5873 and CDP 10037; choose another free slot if occupied, using the ports printed by `up.mjs`. `--uncapped` passes Chromium's `--disable-frame-rate-limit` and `--disable-gpu-vsync`. Keep the ordinary 9337 browser and unrelated user Chrome untouched. The measurement script reports `vsyncCapped`; verify it is `false` before claiming an uncapped result. Do not measure while recording.

At 960×540 internal render resolution in a 1280×720 viewport, the default headless browser measured 60.001 FPS with no enemies. The isolated uncapped browser measured about 493 FPS with no enemies and 425 FPS with seven enemies (600 retained frame samples; seven-enemy p95 3.5 ms, p99 10.9 ms). This used WebGPU on Apple Metal 3. These are scene and machine specific `requestAnimationFrame` intervals, not GPU timings or a promise that every frame fits the 8.33 ms budget. A visible display remains bounded by its refresh rate. Report resolution, enemy count, frame-time tails, browser flags and whether recording was active with future FPS claims.

Chromium's [switch definition](https://chromium.googlesource.com/chromium/src/+/refs/heads/main/components/viz/common/switches.cc) documents the frame-limiter flag.

### Other live checks

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

Put the message before `-f` (`-f` is a greedy array). Use `--pure` to skip plugins, and cross-check several camera angles because the spatial read can be inconsistent.

Treat nested-vision output as **advisory evidence, not ground truth**. Three rules from the Orc passes:

- **Prefer relative reads to absolute verdicts.** "Which phase/panel is more upright, and why" produced usable direction; "is this good" flip-flopped between runs on the same images.
- **Verify a consequential claim against the asset.** A reviewer called the Wayfarer tunic's silver beast emblem a "hole in the garment". Extracting the texture from the GLB and comparing it with a chest crop showed it was the intended embroidery, crushed by a 256 px nearest-neighbour downsample. Neither a worker's prose nor a reviewer's verdict substitutes for inspecting the artifact.
- **Crop for detail and re-ask with a different framing when reads contradict.** Full-body stills hide or invent face/chest defects; close crops plus a second question resolved them. A montage of all passes side by side (reference first) gave the most reliable progression read of the whole session.

`node scripts/ashen-reach/solve-two-hand-pose.mjs` is a superseded solver; do not restore it. Two-handed carry is the retargeted CC0 `Walk_Carry_Loop` clip.

Recording to MP4: `ffmpeg` is not on PATH. Use the bundled `/Applications/BabylonJS Editor.app/Contents/bin/ffmpeg` (7.1, libx264/aac). `scripts/ashen-reach/record-two-handed.mjs` writes timestamped JPEG frames, `frames.ffconcat`, `audio.webm` and `recording.json` (with `audioOffset`); encode with `-f concat -safe 0 -i frames.ffconcat -ss <audioOffset> -i audio.webm -c:v libx264 -pix_fmt yuv420p -fps_mode vfr -c:a aac -movflags +faststart -shortest`, then publish with `scripts/ve-upload.sh`.

Record errors and failure evidence, not just successful assertions. Never replace a failed assertion with a tautology or accept nullable counters as evidence. A black screenshot is a failure even when a structural test passes.

## Capture, review and performance

Capture elapsed time comes from CDP timestamps. Do not use `setpts=N/(60*TB)` to turn a slow capture into nominal 60 FPS: that changes action speed. Keep variable frame timing and assess performance in a separate unrecorded run. Historical fixed-rate clips are not valid timing evidence.

CDP screencast includes the DOM HUD; `canvas.captureStream()` alone does not. The spell recorder captures Lite's actual audio mix through `createAudioEngineMediaStream`, not microphone audio or a staged soundtrack. It writes JPEG frames, `frames.ffconcat`, `audio.webm` and `recording.json`. Align audio using the recorded offset when encoding H.264/AAC. Review representative frames across the whole action and a useful second angle. Keep caster and target visible for projectile review.

Measure foreground frame times separately from recording, after warm-up. Report actual buffer resolution, sample count, average, tails/stalls and whether other GPU work was active. Do not discard slow frames or call unsupported GPU timing zero. The current 960×540 buffer is an intentional pixel-art presentation; don't claim its ~144 FPS as native-resolution performance.

Runtime evidence goes under `ve-capture/ashen-reach/<pass>/`. A visual cycle is not delivered until a reviewed live **GIF or MP4** is on Telegram (`bash scripts/tg file <clip.mp4> "<caption>"`; `scripts/ashen-reach/record-vistas.mjs` records the world/lighting route, the `record-*.mjs` scripts cover character and spell work). Run `bash scripts/tg record <clip.mp4>` after committing so `.claude/telegram-deliveries.log` points at the finished commit and the Stop gate stops asking. Stills are for review and may accompany the clip; they are not the deliverable. Do not expose credentials. Poll at sensible boundaries while active; no monitoring persists after the turn ends. R2 publication is optional when separately useful/authorized, not a substitute for the Telegram motion file.

## Share a public video URL

The VE host is **`https://ve.sparkify.dev`**, backed by Cloudflare R2 bucket `fardel-ve`. A Telegram attachment does not automatically create a URL there. When public sharing is authorized, upload the reviewed video with the existing helper from `the repository root`:

```sh
scripts/ve-upload.sh ve-capture/ashen-reach/<pass>/<walkthrough>.mp4 wow-clone/ashen-reach/<pass>/<date>-<walkthrough>.mp4
```

The helper reads `CLOUDFLARE_API_TOKEN` from the environment and sets MP4/WebM MIME types explicitly. It uploads with Wrangler `--remote` and exits on failure; do not retry without `--remote`, since a local object is not published. Keep credentials out of output and links. Use pass-specific keys to avoid replacing previously shared evidence.

Before sharing the returned URL, check HTTP success, `Content-Type: video/mp4` (or `video/webm`), matching content length, and a byte-range GET returning `206`/`Content-Range`. Verify browser video metadata/playback when practical. Include the verified public URL in the normal chat response and the authorized Telegram caption/message so the user can copy it; sending the binary alone is insufficient for link sharing.

For character asset work, consult [blender-lite](../.agents/skills/blender-lite/SKILL.md) and [equipment authoring](ashen-equipment-authoring.md). The old shrine export npm commands no longer exist.

After a repository move, verify the Vite process working directory and HTTP route before attaching the browser. A listening port can belong to a server rooted in a removed directory. Record any temporary port in the pass evidence; root Vite defaults to 5173. If an owned browser has no game tab after a failed navigation, create one explicitly and wait for `ASHEN.ready`.

## Preserve video proportions and capture timing

Landscape captures use a 1280×720 viewport. For a separate portrait run set `ASHEN_CAPTURE_WIDTH=390 ASHEN_CAPTURE_HEIGHT=844` (or the target device’s actual even viewport dimensions). Portrait evidence is a separate recording at the actual mobile viewport (for example 390×844), never a stretched landscape recording. `check-exploration.mjs --record` writes `capture-manifest.json`: viewport, canvas buffer and CSS dimensions, device pixel ratio, every JPEG's dimensions and CDP timestamp, elapsed capture time, and encoded dimensions after encoding. The frame validator rejects changing frame dimensions, a changed viewport/canvas, mismatched proportions, and missing timestamps. CDP JPEG completion can arrive out of capture order, especially in uncapped browsers. The manifest retains each frame’s arrival index, sorts by capture timestamp, and logs discarded exact duplicates; elapsed time comes from the ordered capture timestamps. Still captures run separately from an active screencast. Failed validation is a failed recording.

Encode an exploration capture with:

```sh
python3 scripts/encode-capture.py ve-capture/ashen-reach/<pass> ve-capture/ashen-reach/<pass>/walk.mp4
```

The encoder verifies source dimensions, preserves timestamp spacing with variable frame rate, sets square pixels and zero rotation, and checks encoded size and elapsed duration (50 ms tolerance). It never scales the source. Set `FFMPEG`/`FFPROBE` if the binaries are neither on PATH nor in the BabylonJS Editor bundle. This encoder is for silent traversal capture; audio-bearing spell recordings still need their recorded audio offset and synchronized audio track.

`bash scripts/tg file <clip.mp4> "<caption including VE URL>"` probes the file and sends explicit width, height, rounded-up duration and streaming support via [Telegram sendVideo](https://core.telegram.org/bots/api#sendvideo). Files with missing dimensions/duration/pixel-aspect metadata, non-square pixels, or nonzero rotation are rejected before upload. Normalize rotated source pixels during encoding, then probe again; never swap only the reported dimensions.

The helper stores `<clip.mp4>.telegram.json` with the file hash, expected and returned dimensions/duration, message identifier, and verification result. It excludes credentials, chat/user details, captions and Telegram file identifiers. A returned size mismatch or duration error over one second fails the command and does not enter the successful-delivery ledger, even if Telegram accepted the upload. Credentials remain environment-only and are never command arguments. After the final commit use `bash scripts/tg record <clip.mp4>` to associate the delivery with the finished commit.

Verify the reviewed source frame against both Telegram inline and fullscreen playback; matching API metadata alone does not prove correct client rendering. Verify the VE video separately: HTTP `video/mp4`, byte ranges, browser `videoWidth`/`videoHeight`, and advancing playback time. Save which clients were actually checked. A physical iPhone remains separate acceptance from desktop emulation.

Regression checks: `python3 scripts/test-media-delivery.py` and `node --test scripts/test-capture-manifest.mjs` cover landscape, portrait, rotation, missing metadata, returned dimension/duration mismatches, dimension changes, timestamp rejection, and actual timestamp-preserving H.264 encoding.

2026-09-25 delivery verification: the existing cathedral file was re-sent as Telegram message **762**. Its source/encoded dimensions are **1280×720**, square pixels, zero rotation, 45.333 seconds; Telegram returned **1280×720**, 46 seconds. VE returned `video/mp4`, 33,024,425 bytes, and HTTP 206 for a byte-range request. Chromium reported native 1280×720, 45.333 seconds, advancing playback and no video error; its rendered frame was reviewed. Native Telegram is not installed on this Mac; Computer Use could not inspect Telegram web because Accessibility/Screen Recording permissions were pending. The user subsequently confirmed that Telegram message **762** plays with correct proportions. This client acceptance supplements the API check; automated inline/fullscreen UI inspection was not available.

Fresh capture integration on the pinned V23 release passed the full cathedral entry/exit route with active Havok and no recoveries or runtime/GPU errors. Landscape: 2,619 frames, 1280×720 source/viewport, 960×540 internal canvas, 45.108123 s source elapsed and 45.086 s encoded stream duration (22 ms difference); Chromium and WebKit both played the encoded file at native 1280×720 with advancing time and no video error. Portrait: 2,037 frames, 390×844 source/viewport, 292×633 internal canvas, 43.269106 s source elapsed and 43.269 s encoded, with all source frames retained. Twelve portrait frames arrived out of order and were reordered by their recorded capture timestamps. Both encodes have square pixels, zero rotation and supported H.264 level metadata (3.2 landscape / 3.1 portrait). These are recording pipeline checks; the portrait run is not physical iPhone or mobile layout acceptance. Evidence: `ve-capture/ashen-reach/telegram-proportions/{landscape-verified,portrait-ordered}/capture-manifest.json` and adjacent `report.json` / `walk.mp4`.
