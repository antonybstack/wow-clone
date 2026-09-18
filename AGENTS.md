# Resuming work in Ashen Reach

Read [docs/CURRENT.md](docs/CURRENT.md) before choosing the route or next work item. Follow the latest user request; historical milestone documents are not an active task queue.

- The active game is the root `index.html` / `ashen-reach.html` slice on Vite 5173. `src/ashen-reach/main.js` exposes `ASHEN`.
- Use Babylon Lite / WebGPU, existing Havok movement and compatible source animation.
- Follow the direct reference-led workflow in `.agents/skills/dream-loop/SKILL.md`: inspect, reuse or research narrowly, implement, play, capture, review, correct and deliver.
- Preserve the user's exact visual references and approved direction. Reuse useful infrastructure; change inherited art/design when it conflicts with the requested target.
- Keep >120 FPS as the goal and report measurement conditions.
- Preserve unrelated live-checkout work. Read current code on resume; do not reset, stash, clean, or assume HEAD contains the latest implementation.
- Run relevant verification and inspect actual game captures. Never equate tests or an offline render with visual acceptance.
