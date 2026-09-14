#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { blenderCommand, pingBlender } from "./blender-mcp.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const glbPath = path.join(root, "public", "moonwell.glb");
const runtimePath = path.join(root, "public", "moonwell-runtime.json");
const blendPath = path.join(root, "blender", "moonwell.blend");

function stat(file) {
    if (!fs.existsSync(file)) {
        return { exists: false, path: file };
    }
    const info = fs.statSync(file);
    return { exists: true, path: file, bytes: info.size, mtime: info.mtime.toISOString() };
}

const ping = await pingBlender();
const scene = await blenderCommand("get_scene_info");

console.log(JSON.stringify({
    blender: { ping, scene },
    glb: stat(glbPath),
    runtime: stat(runtimePath),
    blend: stat(blendPath),
}, null, 2));
