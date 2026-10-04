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

## Before you stop, part two: the queue

Finishing a milestone is not finishing the queue. `.claude/hooks/remaining-work-stop.py`
reads `docs/plans/character-mmo/next-ten.md` and reminds you once per turn when it still
names work you could be doing, so that "I delivered a package and reported it" stops reading
as a stopping point.

It separates two things on purpose. **Actionable** tasks are the ones to pick up. **Blocked**
ones carry a declared external dependency in the plan itself — `**Blocked`, "licensed source
dependency", "is a blocker", "parked" — and are listed but never demanded. So the way to stop
the gate naming something is to mark it in the plan, not to argue with it.

Three honest ways past it: do the work, say in one line why a named task is not actionable
(and mark it), or be told to stop. It also blocks when it *cannot read* the queue, because a
plan it fails to parse looks exactly like a plan with nothing left in it — the failure this
project has already shipped once. `python3 scripts/test-remaining-work-hook.py` pins both
directions, including that one.
