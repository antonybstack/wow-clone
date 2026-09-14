#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { executeBlender, pingBlender } from "./blender-mcp.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const exportPy = path.join(here, "blender_export.py");
const glbPath = path.join(root, "public", "moonwell.glb");
const runtimePath = path.join(root, "public", "moonwell-runtime.json");
const metaPath = path.join(root, "src", "glb-meta.js");
const blendPath = path.join(root, "blender", "moonwell.blend");

const args = new Set(process.argv.slice(2));
const stripTransmission = args.has("--strip-transmission");
const saveBlend = args.has("--save-blend") || args.has("--save");
const help = args.has("--help") || args.has("-h");

if (help) {
    console.log(`Export the live Blender scene to ${path.relative(root, glbPath)}

Usage: npm run export -- [flags]

  --strip-transmission  Temporarily zero Principled transmission for Lite-safe GLB
  --save-blend          Also write blender/moonwell.blend

Requires Blender with MCP for Blender connected on port 9876.
`);
    process.exit(0);
}

function pyString(value) {
    return JSON.stringify(value);
}

await pingBlender();

const code = `
EXPORT_PATH = ${pyString(glbPath)}
RUNTIME_PATH = ${pyString(runtimePath)}
BLEND_PATH = ${pyString(saveBlend ? blendPath : "")}
STRIP_TRANSMISSION = ${stripTransmission ? "True" : "False"}
exec(compile(open(${pyString(exportPy)}, encoding="utf-8").read(), "blender_export.py", "exec"))
`;

const result = await executeBlender(code, { timeoutMs: 180_000 });
const stdout = result?.result || "";
const match = stdout.match(/EXPORT_RESULT:(\{.*\})/s);
if (!match) {
    console.error(stdout || result);
    throw new Error("Export finished but did not print EXPORT_RESULT JSON");
}
const summary = JSON.parse(match[1]);
const stamp = Date.now();
const prev = fs.existsSync(metaPath) ? fs.readFileSync(metaPath, "utf8") : "";
const heroMatch = prev.match(/export const heroUrl = "[^"]+";/);
const heroLine = heroMatch ? heroMatch[0] : `export const heroUrl = "/hero.glb";`;
const meta = `export const glbUrl = "/moonwell.glb?v=${stamp}";
export const runtimeUrl = "/moonwell-runtime.json?v=${stamp}";
${heroLine}
export const exportedAt = ${JSON.stringify(summary.exportedAt || new Date().toISOString())};
export const bytes = ${Number(summary.bytes) || 0};
`;
fs.writeFileSync(metaPath, meta);

console.log(JSON.stringify({ ...summary, meta: path.relative(root, metaPath) }, null, 2));
if (summary.areaLightsAsPoints) {
    console.warn(`${summary.areaLightsAsPoints} AREA light(s) exported as Lite points.`);
}
