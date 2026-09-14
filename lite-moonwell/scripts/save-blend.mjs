#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";

import { executeBlender, pingBlender } from "./blender-mcp.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const blendPath = path.join(root, "blender", "moonwell.blend");

await pingBlender();
const code = `
import bpy, os
path = ${JSON.stringify(blendPath)}
os.makedirs(os.path.dirname(path), exist_ok=True)
if bpy.ops.object.mode_set.poll():
    bpy.ops.object.mode_set(mode="OBJECT")
bpy.ops.wm.save_as_mainfile(filepath=path, copy=True)
print("saved", path, os.path.getsize(path))
`;
const result = await executeBlender(code);
console.log((result?.result || "").trim() || `saved ${blendPath}`);
