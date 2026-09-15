---
description: Export the live Blender moonwell scene to lite-moonwell GLB and reload Lite
---

Export the connected Blender scene into the Babylon Lite demo.

1. From `lite-moonwell/`, run `npm run export`. If the user asked to persist the .blend, add `-- --save-blend`. If Lite last crashed on transmission, use `npm run export:safe`.
2. If the command fails with connection refused, tell them to Connect the Blender MCP add-on on port 9876. Do not invent a GLB.
3. Report bytes, mesh/object counts, area lights approximated as points, and that http://localhost:5180 should full-reload. If Vite is not running, start `npm run dev` in `lite-moonwell` (port 5180).
4. Follow `.agents/skills/blender-lite/SKILL.md`.
