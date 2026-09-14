#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";

import { executeBlender, pingBlender } from "./blender-mcp.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const py = path.join(here, "plant_trees.py");

await pingBlender();
const code = `exec(compile(open(${JSON.stringify(py)}, encoding="utf-8").read(), "plant_trees.py", "exec"))`;
const result = await executeBlender(code, { timeoutMs: 180_000 });
process.stdout.write(result?.result || "");
