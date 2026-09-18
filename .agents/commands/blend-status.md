---
description: Ping Blender MCP and report moonwell GLB / scene status
---

This command concerns the legacy Moonwell shrine only. For Ashen Reach changes, use [current direction](../../lite-moonwell/docs/CURRENT.md). Read [the export boundaries](../skills/blender-lite/SKILL.md) before invoking a save/export; verify the connected file and shrine markers first.


From `lite-moonwell/`, run `npm run status`. Summarize whether Blender MCP is up, object count, and GLB mtime/size. If ping fails, tell the user to Connect MCP for Blender on port 9876.
