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

**C / Armory** opens inspection on the actual actor; Escape restores the prior view. `armory.getState()` reports diagnostic playback. Use [CURRENT](CURRENT.md) for availability and current scope; the [historical armory plan](archive/plans/armory-and-equipment-plan.md) retains earlier implementation evidence. Close the armory before gameplay tests; its modal input suspension is intentional.

- `combat.spell` is Fire Blast; `combat.lava` is Lava Ball. `combat.pendingSpell` distinguishes charging. Read `body.getState()` for phase, cast elapsed time and release marker.
- `player.getMotion()` / `getGrounded()` report controller state; they are not proof of visual sole contact. Hold Space across render frames when testing held-key jump input; a zero-duration synthetic press can be missed.
- For module-level probes, import the game's exact optimized Lite URL from transformed `/src/ashen-reach/main.js`, including its query. Do not separately import raw `/node_modules/@babylonjs/lite/lib/index.js`: duplicate caches/registries caused misleading black-scene and pipeline failures.
- Inspect actual renderable descendants/materials. A named glTF transform may own several primitives; its parent is not necessarily the mesh.
- Direct camera/state changes are allowed for diagnostic views but must be labelled. Gameplay claims require actual inputs and verified state transitions.

## Browser ownership and performance isolation

Treat every open game page as GPU work, including a page in a detached headless Chrome after its CDP client exits. At the start of a live task, before starting another browser, after each live check, and before handoff or final response:

1. Inventory browser parents and Vite processes (`ps -axo pid,command | rg '/Contents/MacOS/Google Chrome --|/node_modules/\.bin/vite|serve-startup-preview'`) and listening ports (`lsof -nP -iTCP -sTCP:LISTEN`). For each known owned CDP port, inspect `http://127.0.0.1:<port>/json/list` for game page URLs. Also check any visible browser running the game; a browser without CDP may still render. The process list alone does not tell you which tabs are active.
2. In the current task notes, record **owner (this session or named managed subagent), browser PID, CDP port, Vite port or production URL, page URL, and purpose**. Pass that ownership record to subagents before live work. Use one shared owned browser where practical; start another only for a named, isolated check. `scripts/harness/up.mjs --slot N` records the slot's Vite and Chrome PIDs; use its printed ports and `scripts/harness/down.mjs --slot N` for cleanup.
3. For FPS runs, inspect all known game tabs and ensure **only the measured game page is actively rendering**. Close or pause other pages owned by this session or its managed subagents and record what was done. Leave user and other agents' unrelated sessions untouched. If an active renderer remains unknown or cannot be isolated, mark the run contaminated and do not use it for a performance claim.
4. Close each owned Playwright context/page and stop its harness when the check finishes. `browser.close()` on a CDP connection may only disconnect; confirm the browser process and its game tab actually stopped. Recheck the inventory at handoff and session end. Keep any intentionally retained game instance in the ownership record so the next session knows it exists.

Repeated live checks should use a fresh owned Playwright `browser.newContext()` and close it in `finally`. Navigating the same page to `about:blank` can retain earlier game documents/renderers in Chromium's back/forward history; detaching CDP does not dispose them. Keep the harness's default page blank, audit targets before the next check, and restart only the owned harness if retained history/processes make isolation uncertain.

This rule follows the 2026-09-27 investigation: two abandoned game pages reduced the same walk from about **173 to 96 FPS**. A local server without a game page is not the same GPU load; count rendering pages, not merely ports.

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

Use a new revision or content hash in the object key when recapturing a pass. In
the October 4 mobile Armory check, overwriting a preliminary key returned fresh
HEAD metadata but stale GET/video bytes. The final hash-specific URL downloaded
the exact local SHA-256 and played correctly. Verify a full GET hash against the
local file as well as metadata; correct any already-sent caption to that final URL.

For character asset work, consult [blender-lite](../.agents/skills/blender-lite/SKILL.md) and [equipment authoring](ashen-equipment-authoring.md). The old shrine export npm commands no longer exist.

After a repository move, verify the Vite process working directory and HTTP route before attaching the browser. A listening port can belong to a server rooted in a removed directory. Record any temporary port in the pass evidence; root Vite defaults to 5173. If an owned browser has no game tab after a failed navigation, create one explicitly and wait for `ASHEN.ready`.

## Preserve video proportions and capture timing

Landscape captures use a 1280×720 viewport. For a separate portrait run set `ASHEN_CAPTURE_WIDTH=390 ASHEN_CAPTURE_HEIGHT=844` (or the target device’s actual even viewport dimensions). Portrait evidence is a separate recording at the actual mobile viewport (for example 390×844), never a stretched landscape recording. `check-exploration.mjs --record` writes `capture-manifest.json`: viewport, canvas buffer and CSS dimensions, device pixel ratio, every JPEG's dimensions and CDP timestamp, elapsed capture time, and encoded dimensions after encoding. The frame validator rejects changing frame dimensions, a changed viewport/canvas, mismatched proportions, and missing timestamps. CDP JPEG completion can arrive out of capture order, especially in uncapped browsers. The manifest retains each frame’s arrival index, sorts by capture timestamp, and logs discarded exact duplicates; elapsed time comes from the ordered capture timestamps. Still captures run separately from an active screencast. Failed validation is a failed recording.

Encode an exploration capture with:

```sh
python3 scripts/encode-capture.py ve-capture/ashen-reach/<pass> ve-capture/ashen-reach/<pass>/walk.mp4
```

The encoder verifies source dimensions, preserves timestamp spacing with variable frame rate, sets square pixels and zero rotation, and checks encoded size and elapsed duration (50 ms tolerance). It never scales the source. Set `FFMPEG`/`FFPROBE` if the binaries are neither on PATH nor in the BabylonJS Editor bundle. This encoder is for silent traversal capture; audio-bearing spell recordings still need their recorded audio offset and synchronized audio track.

For a long Telegram attachment, supply an optional third argument in kbit/s, for example `python3 scripts/encode-capture.py <capture-directory> <clip.mp4> 2000`. It applies libx264's maximum bitrate/buffer controls, preserving the original 1280×720 pixels and capture timing. Inspect the encoded motion and check actual file size before upload; a bitrate cap trades compression detail for attachment size. See [FFmpeg libx264 options](https://ffmpeg.org/ffmpeg-codecs.html#libx264_002c-libx264rgb).

`bash scripts/tg file <clip.mp4> "<caption including VE URL>"` probes the file and sends explicit width, height, rounded-up duration and streaming support via [Telegram sendVideo](https://core.telegram.org/bots/api#sendvideo). Files with missing dimensions/duration/pixel-aspect metadata, non-square pixels, or nonzero rotation are rejected before upload. Normalize rotated source pixels during encoding, then probe again; never swap only the reported dimensions.

The helper stores `<clip.mp4>.telegram.json` with the file hash, expected and returned dimensions/duration, message identifier, and verification result. It excludes credentials, chat/user details, captions and Telegram file identifiers. A returned size mismatch or duration error over one second fails the command and does not enter the successful-delivery ledger, even if Telegram accepted the upload. Credentials remain environment-only and are never command arguments. After the final commit use `bash scripts/tg record <clip.mp4>` to associate the delivery with the finished commit.

Verify the reviewed source frame against both Telegram inline and fullscreen playback; matching API metadata alone does not prove correct client rendering. Verify the VE video separately: HTTP `video/mp4`, byte ranges, browser `videoWidth`/`videoHeight`, and advancing playback time. Save which clients were actually checked. A physical iPhone remains separate acceptance from desktop emulation.

The sender uses literal UTF-8 in curl's stdin config. JSON `\uXXXX` escapes are not curl config escapes: they previously turned `1280×720` into `1280u00d7720`. [curl's config quoting rules](https://everything.curl.dev/cmdline/configfile.html#when-to-use-quotes) explain why. `python3 -B scripts/test-telegram-transport.py` exercises real curl multipart parsing against a local server with Unicode, emoji, quotes, newlines and a Unicode filename; it sends nothing to Telegram. Older delivered captions are historical evidence and are not rewritten.

Regression checks: `python3 scripts/test-media-delivery.py` and `node --test scripts/test-capture-manifest.mjs` cover landscape, portrait, rotation, missing metadata, returned dimension/duration mismatches, dimension changes, timestamp rejection, and actual timestamp-preserving H.264 encoding.

2026-09-25 delivery verification: the existing cathedral file was re-sent as Telegram message **762**. Its source/encoded dimensions are **1280×720**, square pixels, zero rotation, 45.333 seconds; Telegram returned **1280×720**, 46 seconds. VE returned `video/mp4`, 33,024,425 bytes, and HTTP 206 for a byte-range request. Chromium reported native 1280×720, 45.333 seconds, advancing playback and no video error; its rendered frame was reviewed. Native Telegram is not installed on this Mac; Computer Use could not inspect Telegram web because Accessibility/Screen Recording permissions were pending. The user subsequently confirmed that Telegram message **762** plays with correct proportions. This client acceptance supplements the API check; automated inline/fullscreen UI inspection was not available.

Fresh capture integration on the pinned V23 release passed the full cathedral entry/exit route with active Havok and no recoveries or runtime/GPU errors. Landscape: 2,619 frames, 1280×720 source/viewport, 960×540 internal canvas, 45.108123 s source elapsed and 45.086 s encoded stream duration (22 ms difference); Chromium and WebKit both played the encoded file at native 1280×720 with advancing time and no video error. Portrait: 2,037 frames, 390×844 source/viewport, 292×633 internal canvas, 43.269106 s source elapsed and 43.269 s encoded, with all source frames retained. Twelve portrait frames arrived out of order and were reordered by their recorded capture timestamps. Both encodes have square pixels, zero rotation and supported H.264 level metadata (3.2 landscape / 3.1 portrait). These are recording pipeline checks; the portrait run is not physical iPhone or mobile layout acceptance. Evidence: `ve-capture/ashen-reach/telegram-proportions/{landscape-verified,portrait-ordered}/capture-manifest.json` and adjacent `report.json` / `walk.mp4`.

## Progressive startup measurements (2026-09-27)

After editing the procedural world, its dependencies, starter source assets, or package lock, run `npm run prepare:startup` before `ASHEN_PAGES=1 npm run build`. The build rejects stale source fingerprints and corrupt content-addressed outputs. Generated startup manifests revalidate; hashed binaries/textures remain cacheable. `?legacyStart` keeps the full procedural path available for diagnostics. `VITE_FAST_START=0 ASHEN_LITE_BUNDLE=0 npm run build` restores the earlier packaging/startup combination.

`ASHEN.whenPlayable` means grounded Havok, dressed source animation, a completed GPU frame, removed overlay and enabled movement. `whenCombat`, `whenHostiles`, and `whenRegion` describe later stages. Existing `ASHEN.ready` still means the complete region. An early flag or first submitted frame alone does not demonstrate playable startup.

```sh
ASHEN_TEST_URL='https://play.sparkify.dev/?play&clean&pixelRatio=1' ASHEN_PROBE_RUNS=20 ASHEN_PROBE_PROFILE=50mbps node scripts/ashen-reach/probe-playable-startup.mjs /tmp/playable-20.json
ASHEN_TEST_URL='https://play.sparkify.dev/?play&clean&pixelRatio=1' ASHEN_PROBE_RUNS=3 ASHEN_PROBE_PROFILE=10mbps node scripts/ashen-reach/probe-playable-startup.mjs /tmp/playable-slow.json
ASHEN_CDP_PORT=11237 ASHEN_TEST_URL='https://play.sparkify.dev/?play&clean&pixelRatio=1' node scripts/ashen-reach/measure-region-fps.mjs /tmp/region-fps.json
```

Use a verified owned uncapped harness for FPS. Run only one game measurement at a time. Close owned contexts and stop owned harnesses afterwards: disconnecting a CDP client leaves its page rendering. Two abandoned harness renderers reduced the same walking test from 173 to 96 FPS during this investigation. Preserve unrelated user browser sessions.

Use the canonical production root (`https://play.sparkify.dev/?play&clean&pixelRatio=1`) for the normal entry cohort. Pages redirects `.html` URLs to extensionless URLs ([Cloudflare route matching](https://developers.cloudflare.com/pages/configuration/serving-pages/#route-matching)); our `/ashen-reach.html` check observed a 308 and an additional network round trip. Keep redirected cohorts under their own names and retain every row. Choosing another entry URL does not fix first-use GPU stalls or prove every saved outfit meets one second. Local Vite routes still use their existing `.html` paths.

The cold probe launches a fresh Chromium process/profile for each navigation, measures the actual playable boundary and input response through a subsequent GPU fence, and records completed encoded traffic. It does not clear operating-system, DNS, CDN or GPU-driver caches. Report the machine, viewport and throttling, every run, p50/p95/max, misses and slower profiles. A compressed local preview measures local transport/CPU; it does not establish production CDN performance. `serve-startup-preview.mjs` precomputes compressed HTML/JS/CSS at startup: **restart it after every rebuild**. Otherwise a browser requesting Brotli can receive the previous build while curl receives the current uncompressed files. Before measuring or recording, run `ASHEN_RELEASE_URL=http://127.0.0.1:<preview-port> node scripts/verify-pages.mjs <report.json>`; the verifier negotiates browser compression and compares decoded served bytes against `dist`. Record that receipt with the cohort. Physical iPhone startup remains a separate test.

Run `check-progressive-startup.mjs` against a built preview to inject initial body failure, partial worker failure, partial GPU upload failure, early touch/combat/race switching, and disposal. `check-device-loss.mjs --during-startup` checks loss while the region is loading. The visible physical frontier must remain until collision is safe; successful retry must retain the player and avoid duplicate Havok shapes.

`record-progressive-startup.mjs` captures continuous input during the upgrade with a fixed 1280×720 surface and timestamped capture manifest. Encode with `scripts/encode-capture.py`; measure FPS separately. Review first playable, frontier removal, equipment/texture enhancement and completed motion before VE/Telegram delivery. Telegram dimensions are checked by `scripts/tg`; correct API metadata alone does not replace human inline/fullscreen playback review.

The prepared starter terrain uses an actual Brotli `.br` file. Serve it with `Content-Encoding: br` and `Content-Type: application/octet-stream`; native HTTP decoding produces the validated raw vertex arrays. Pages `_headers`, the Vite dev/preview middleware and the compressed measurement preview all supply these headers. A different static server must do the same. Never label an uncompressed file as Brotli. The release verifier compares the decoded HTTP response with the decompressed stored asset; content-addressed filename checks still hash the stored compressed bytes. Starter character/clothes retain their existing lossless gzip envelope.


After `npm run prepare:startup`, restart any running Vite dev server: the HTML preload plugin reads generated manifests when the server starts. Production cold-start reports use fresh browser processes/profiles and nearest-rank percentiles (`ceil(p × n)`, one-based); state the maximum and count under the target alongside p95. Readiness requires the first dressed, grounded frame's native GPU completion, not merely scene construction or render submission. See [the final startup report](complete/2026-09/one-second-startup-implementation-2026-09-27.md).


## Connected Human identity audition (M5)

This DEV route reuses the actual game, native equipment loader and Havok movement.
The [source result](plans/character-mmo/results/m5-connected-identity-2026-10-04.md)
records acceptance and limitations. It is not a saved or released identity choice.

From the root, reproduce the pinned connected source and current per-head hood:

```sh
node scripts/character-assets/reproduce-human-identity-review.mjs
```

With matching source GLBs already present, `--reuse-source` validates their hashes
and rebuilds only the current hood fits and prepared audition packs. Do not
regenerate the tracked `source-summary.json` to suppress a mismatch; inspect the
source change first. Native Blender 5.2.1, pinned source downloads and the existing
M004/M005 pipeline are the recovery path for ignored `.cache` assets.

After auditing renderer ownership, open one of these on the current owned Vite server:
`/ashen-reach.html?play&clean&pixelRatio=1&humanIdentity=old`, `young` or `young-hair`.
Use the Armory for height/build and clothing changes. Edits are temporary; the
route ignores existing appearance storage and does not overwrite it. Alternate
race and Shared region belong to the ordinary game route. Mixing other body
candidate parameters into this route is rejected.

The middleware serves a single explicit label and hashed file from
`.cache/character-mmo/identity-review-v1`. It never substitutes the production
`human-shape-v1` manifest globally. The optional module and source assets must be
absent from a production build. Coverage names in the manifest own the eye,
separate hair and torso meshes; a hood hides hair while preserving the face.

Run `check-human-identity-current-fits.mjs` with `ASHEN_IDENTITY_DIRECT=1` against
an audited `ASHEN_CDP_PORT` / `ASHEN_TEST_URL`. Its source-control mode instead
intercepts the manifest explicitly. `record-human-identity-review.mjs` uses the
same owned browser and records the named body extremes with native animation
inspection plus real walk/jump/cast/attack controls. Encode its timestamped frames
with `scripts/encode-capture.py`; record performance separately. Freeze runtime
and asset changes while recording: a Vite development reload invalidates the film.
Close contexts, pause video players and tear down the owned harness afterwards.
