---
name: grok-imagine
description: >
  Generate or edit images with xAI Imagine when that provider is requested or
  selected for a concrete bitmap asset. Optional alongside other available
  image-generation tools; not a prerequisite for game or dream-loop work.
---

# Grok Imagine

Use for an explicitly selected xAI image task. Prefer a suitable native image tool already available in the session when no provider is specified; do not spawn Grok solely because the task needs a texture. Supplied gameplay references remain the target.

There is **no** `grok imagine` subcommand. Imagine is a Grok Build **agent tool**.

## Which path

| You have | Do |
|---|---|
| `image_gen` / `image_edit` in your tool list | Call them. Do **not** nest `grok -p`. |
| No Imagine tools | `scripts/imagine.sh` below (needs `grok` on PATH and `grok login`) |

`image_gen` = new image. `image_edit` = existing file (path or `data:image/…;base64,…`).

## Native tools (Grok Build)

```
image_gen  prompt=<text>  aspect_ratio=16:9|9:16|1:1|auto
image_edit prompt=<text>  image=["/abs/path.png"]
```

Tell the user the **session-relative** path (`images/1.jpg`). Files live under `~/.grok/sessions/<url-encoded-cwd>/<session-id>/images/`.

Prompt: subject → pose → setting → style → composition → lighting. No “concept art” if the output must look like an in-engine screenshot.

## CLI (OpenCode and other agents)

From repo root:

```bash
.agents/skills/grok-imagine/scripts/imagine.sh --ratio 16:9 --out /abs/out.jpg -- "PROMPT"
.agents/skills/grok-imagine/scripts/imagine.sh --edit /abs/ref.png --out /abs/out.jpg -- "what changed"
```

The script runs `grok -p --yolo --verbatim --output-format json`, finds the newest file in that session’s `images/`, copies to `--out` if set, prints the path.

Requires: `grok` on PATH, logged-in CLI, network. `--tools image_gen,image_edit` so the inner agent does not edit the repo.

## This repo

Inspect **existing files** before writing a target. Paths differ:

- World landscape plate: repo-root `.dream-loop/target.png` (do not overwrite when generating character sheets).
- Character AI sheets: `lite-moonwell/.dream-loop/character/` (`human-anatomical-target.png`, `moonwell-mage-kit-target.png`). These are **not** live Lite or Blender screenshots and are not orthographic topology.
- Older look plates: `lite-moonwell/blender/ref/`.

Phone VE of the **running game** is `npm run ve` (R2), not Imagine. Do not generate HUD text, numbers, or diagrams — build those in code. Do not treat left/right staff hands on a back plate as a verified mesh bug without checking anatomical vs image-space right.
