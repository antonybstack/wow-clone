# Resuming work in lite-moonwell

Read [docs/CURRENT.md](docs/CURRENT.md) before choosing the route or next work item. Follow the latest user request; historical milestone/handoff documents are not an active task queue.

- Current visual/gameplay slice: `ashen-reach.html` on Vite 5180. `src/ashen-reach/main.js` exposes `ASHEN`. The root Moonwell page and character lab serve different legacy/diagnostic roles.
- Use Babylon **Lite** / WebGPU, existing Havok movement and compatible source animation. Root wow-clone Classic/custom-engine rules do not apply here.
- Default to the [direct reference-led workflow](../.agents/skills/dream-loop/SKILL.md): inspect, reuse/research narrowly, implement, play, capture, review, correct and deliver. User endorsed this on 2026-09-17. Old Grok-only/Plus/Pro rules are superseded.
- Preserve the user's exact visual references and approved direction. Reuse useful infrastructure; change inherited art/design when it conflicts with the requested target.
- Keep >120 FPS as the goal and report measurement conditions. Current ~144 FPS evidence is at 960×540, not a native-resolution or multiplayer guarantee.
- Preserve unrelated live-checkout work. Read current code on resume; don't reset/stash/clean or assume HEAD contains the user's latest implementation.
- Run relevant verification and inspect actual game captures. Never equate tests or an offline render with visual acceptance. Do not require a new test suite for a documentation-only change.

For historical rationale, use [the workflow retrospective](docs/reference-led-workflow-2026-09-17.md). Load other docs/skills only when relevant to the task.
