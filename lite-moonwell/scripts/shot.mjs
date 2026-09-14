#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { blenderCommand, pingBlender } from "./blender-mcp.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dest = path.join(root, ".cache", "blender-view.png");

await pingBlender();
fs.mkdirSync(path.dirname(dest), { recursive: true });
const result = await blenderCommand("get_viewport_screenshot", {
    filepath: dest,
    max_size: 1600,
    format: "png",
});
console.log(JSON.stringify({ ...result, filepath: dest, bytes: fs.existsSync(dest) ? fs.statSync(dest).size : 0 }, null, 2));
