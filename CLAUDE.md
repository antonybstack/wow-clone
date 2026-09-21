reference AGENTS.md

## Before you stop

If this turn touched anything visual — `src/ashen-reach/`, `src/character/`, `src/spells/`,
`public/ashen-reach/`, `blender/`, `ashen-reach.html` — the cycle is not finished until a
reviewed live GIF or MP4 of the change is on Telegram. Committing it and logging it is not
delivering it. Use the `deliver-visual-cycle` skill; the short version is:

```sh
node scripts/ashen-reach/record-vistas.mjs --tag v1   # or the matching record-*.mjs
# encode with the bundled ffmpeg, then LOOK AT THE CLIP YOURSELF
bash scripts/tg file <clip.mp4> "<what changed, and what still reads wrong>"
bash scripts/tg record <clip.mp4>                     # after committing
```

`.claude/hooks/telegram-motion-stop.py` reminds you once per turn. It is a reminder, not a
lock — but the only two honest ways past it are to send the clip, or to say in one line that
this turn was docs, tests, tooling or planning.
