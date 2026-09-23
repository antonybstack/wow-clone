# Resuming work in Ashen Reach

Read [docs/CURRENT.md](docs/CURRENT.md) before choosing the route or next work item. Follow the latest user request; historical milestone documents are not an active task queue.

- The active game is the root `index.html` / `ashen-reach.html` slice on Vite 5173. `src/ashen-reach/main.js` exposes `ASHEN`.
- Use Babylon Lite / WebGPU, existing Havok movement and compatible source animation.
- Follow the direct reference-led workflow in `.agents/skills/dream-loop/SKILL.md`: inspect, reuse or research narrowly, implement, play, capture, review, correct and deliver.
- Preserve the user's exact visual references and approved direction. Reuse useful infrastructure; change inherited art/design when it conflicts with the requested target.
- Keep >120 FPS as the goal and report measurement conditions.
- Preserve unrelated live-checkout work. Read current code on resume; do not reset, stash, clean, or assume HEAD contains the latest implementation.
- Run relevant verification and inspect actual game captures. Never equate tests or an offline render with visual acceptance.
- A visual cycle (character, clothes, animation, camera, spells, world) is not delivered until a reviewed **live GIF or MP4** is on Telegram via `tg file`. Stills are review aids, not the end of the cycle. Put a VE `video/mp4` URL in the caption when publication is authorized. PNG-only Telegram is incomplete.
- `tg` is `scripts/tg` (`bash scripts/tg file <clip.mp4> "<caption>"`). It reads `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` from the environment — never put either in a file, a caption, or a log. Every successful send is appended to `.claude/telegram-deliveries.log` with the commit that was HEAD at the time; if you sent the clip before committing the work, run `bash scripts/tg record <clip.mp4>` afterwards so the ledger points at the finished commit.
- Two project `Stop` hooks remind once per turn if a visual cycle is about to close without that clip: `.claude/hooks/telegram-motion-stop.py` (Claude Code, registered in `.claude/settings.json`) and `.grok/hooks/telegram-motion.json` (Grok CLI). They are reminders, not hard locks: the next stop in the same turn proceeds. Reload hooks with `/hooks` → `r` if this session started before the files existed.
- The Claude Code gate decides “is there undelivered visual work?” from **committed** history since the last ledger entry, not only from `git status`. An earlier version read the working tree alone and so went silent the moment the work was committed — which is exactly how an entire environment/lighting pass shipped as stills with no clip. Do not narrow it back to the working tree.

# General Guidance

## Instruction following

The user's instructions take precedence over guidelines provided in a skill. If explicit user instructions conflict with a skill's instructions, prioritize the user's instructions.

## Writing Style

Avoid using slop words or phrases like "Bottom Line:" in conclusions, "delve," "foster," "leverage," "it's worth noting," "importantly," "Question? Answer." or "This isn't about X. It's about Y.", "genuinely" or hyphenated compound descriptions and adjectives. Do not use concluding summary statements such as "In short:..", "The simplest mental model is:...".

State the intended action directly. Avoid adding what you won't do, what will remain unchanged, or how you'll separate or categorize results. Do not use contrastive framing such as "X, not Y" or "X—not Y" that introduces an unprompted alternative that the user didn't ask about. Avoid acronyms that are not general knowledge. Avoid invented compound labels like "exact-head checks" and "editorial-row layouts", vague qualifiers, and canned transitions; use plain verbs and prepositions to state the actual relationship directly.

## Initiative and follow-through

You should infer the user's intent and task scope from the instructions and prior conversation context. Your job is to bias towards action and carry the user's intended task to completion.

When the user expresses intent to perform new work or fix an existing issue, persist until the user's intended goal is complete. Progress autonomously towards the user's goal (e.g. creating isolated worktrees / checkouts if needed, resolving merge conflicts, read-only actions, creating draft PRs etc.) unless they are clearly destructive or irreversible.

## Subagent delegation

If at any point you can parallelize work by delegating tasks to another agent (no matter if you are the root or subagent), you should do so using collaboration tools if it could save time or improve quality.

Messages that you send to other agents and your final answer may be read by a human, so ensure they are legible. Always put proper spaces between words and/or numbers.
