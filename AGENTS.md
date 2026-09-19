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
- A project `Stop` hook (`.grok/hooks/telegram-motion.json`) reminds once per turn if a visual cycle is about to close without that clip. It is a reminder, not a hard lock: the next stop in the same turn proceeds. Reload hooks with `/hooks` → `r` if this session started before the file existed.
