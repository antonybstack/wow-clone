---
name: deliver-visual-cycle
description: Close out any visual Ashen Reach change — environment, lighting, world, character, clothes, animation, camera, spells — by recording a live clip from the running game, reviewing it yourself, and sending it to Telegram with `scripts/tg`. Use this whenever you have finished or are about to stop after touching src/ashen-reach, src/character, src/spells, public/ashen-reach, blender/, or ashen-reach.html, and whenever a Stop hook reminds you about an undelivered clip. Also use it when asked to "share", "send", "deliver", or "show" game work.
---

# Delivering a visual cycle

A visual change is not delivered when the code is committed, and not when the tests
pass. It is delivered when a person has watched the thing move and you have told them
honestly what is still wrong with it. Everything below is in service of that.

Stills are review aids. They are how *you* find defects; they are not the deliverable.
A still cannot show aerial perspective, parallax, a fog gradient resolving with
distance, a gait, or a spell's timing — which is to say it cannot show most of what a
visual pass actually changes.

## The cycle

### 1. Record from the running game

Never an offline render, never the Blender viewport. The harness browser on your slot,
the real page, the real engine:

```sh
ASHEN_CDP_PORT=<slot cdp> ASHEN_URL='http://127.0.0.1:<slot vite>/ashen-reach.html?play&clean' \
  node scripts/ashen-reach/record-vistas.mjs --tag v1
```

- `record-vistas.mjs` — world, environment, lighting, atmosphere. Drives a scripted
  camera route through the town spine and writes timestamped JPEG frames plus
  `frames.ffconcat`.
- `record-*.mjs` (orc-clothes, two-handed, fire-blast, grips, …) — character, clothes,
  equipment and spell work, with engine audio.

Frames are timestamped rather than fixed-rate on purpose: the screencast delivers
frames at whatever rate the compositor allows, so encoding at a fixed `-r` from raw
frames stretches or compresses the motion and quietly lies about the timing.

### 2. Encode

`ffmpeg` is not on PATH. Use the bundled one:

```sh
"/Applications/BabylonJS Editor.app/Contents/bin/ffmpeg" -y -f concat -safe 0 -i frames.ffconcat \
  -c:v libx264 -crf 23 -preset slow -pix_fmt yuv420p -r 30 -movflags +faststart out.mp4
```

Keep it under 50 MB — that is the bot API's hard limit, and a send that exceeds it
fails rather than truncating. 1280×720 / 30 fps / crf 23 lands ~1 MB per second.

### 3. Watch it yourself, before anyone else does

This is the step that gets skipped, and it is the one that matters. Build a contact
sheet and actually look at every cell:

```sh
"/Applications/BabylonJS Editor.app/Contents/bin/ffmpeg" -y -i out.mp4 \
  -vf "fps=1/1.7,scale=640:-1,tile=4x4" -frames:v 1 sheet.png
```

Then read `sheet.png`. What to reject and re-shoot for:

- **A black or near-black cell.** The camera boom has clipped through a wall or a
  trunk. Move the waypoint; do not ship it.
- **Several seconds of empty ground.** A route that spends a third of its runtime on a
  featureless field has not shown the change. Re-route onto content.
- **A payoff shot that does not contain the payoff.** If the clip is about the sky and
  the closing camera has no sky in it, the closing camera is wrong.
- **Anything with a hard straight edge that should be organic.** Crop it at full
  resolution and enlarge it *before* deciding it is a defect — downscaled captures
  invite phantom defects — but if it survives the crop, it is real. Name what draws it
  by patching materials to flat debug colours (tagging works on this engine; hiding
  meshes fails silently), then fix it and re-record.

Re-recording is cheap. A clip with a known defect in it costs the reviewer's trust.

### 4. Send

```sh
bash scripts/tg file <out.mp4> "<what changed, why, and what still reads wrong>"
```

`scripts/tg` reads `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` from the environment.
Never print either, never put either in a caption, a doc, a log or a commit. It fails
loudly on `{"ok":false}` rather than treating a rejected upload as a success.

The caption is part of the deliverable. Include what changed and why, the measured
scene cost, and — not optional — the defects you can still see. A caption that only
lists wins is a caption the reviewer cannot plan from.

### 5. Record the delivery against the finished commit

Every send appends to `.claude/telegram-deliveries.log`, tagged with the commit that
was HEAD at the time. The Stop hook uses that ledger to ask "are there visual commits
newer than the last thing I actually sent?" — which is why it keeps working after you
commit, unlike the working-tree check it replaced.

If you sent the clip before committing (usual), point the ledger at the finished commit
afterwards instead of re-uploading:

```sh
bash scripts/tg record <out.mp4>
```

## If the Stop hook fires

It is telling you there are visual changes newer than your last delivery. Two honest
answers:

- Record, review and send. Then stop.
- Say in one line that the turn was docs, tests, tooling or planning, and stop.

What is not an answer is stopping silently because the code is committed and the tests
are green. That is the exact failure the gate exists to catch, and it has caught a real
one: an entire environment and lighting pass was committed, logged and left undelivered
because the previous gate only watched the working tree.
