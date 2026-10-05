/** Prepared content is invalid whenever its authoring inputs change. */
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import {verifyHumanCoveragePolicy} from '../character-assets/verify-human-coverage-policy.mjs';
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
export async function startupProvenance(roots, assets = []) {
  const files = new Map();
  async function visit(file) {
    file = path.normalize(file);
    if (files.has(file)) return;
    const bytes = await fs.readFile(file);
    files.set(file, digest(bytes));
    if (!/\.[cm]?js$/.test(file)) return;
    for (const match of bytes
      .toString()
      .matchAll(/(?:from\s*|import\s*\()\s*['"](\.[^'"]+)['"]/g)) {
      const next = path.resolve(path.dirname(file), match[1]);
      if (/\.[cm]?js$/.test(next))
        await visit(path.relative(process.cwd(), next));
    }
  }
  for (const file of [...roots, ...assets, "package-lock.json"]) await visit(file);
  const inputs = Object.fromEntries(
    [...files].sort(([a], [b]) => a.localeCompare(b)),
  );
  return { schema: 1, inputs, sha256: digest(JSON.stringify(inputs)) };
}
export async function verifyStartupAssets() {
  for (const kind of ["starter", "character"]) {
    const root = `public/ashen-reach/startup/${kind}`,
      manifest = JSON.parse(await fs.readFile(`${root}/manifest.json`, "utf8"));
    if(kind==='character')verifyHumanCoveragePolicy(manifest);
    if (manifest.provenance?.schema !== 1)
      throw Error(`Rebuild ${kind}: npm run prepare:startup`);
    for (const [file, expected] of Object.entries(manifest.provenance.inputs))
      if (digest(await fs.readFile(file)) !== expected)
        throw Error(
          `Stale ${kind} asset: ${file} changed. Run npm run prepare:startup`,
        );
    const urls =
      kind === "starter"
        ? [
            `${root}/${manifest.geometry.file}`,
            ...Object.values(manifest.textureURLs).map((url) => "public" + url),
          ]
        : [
            ...[
              "body",
              "wayfarerTunic",
              "wayfarerTrousers",
              "wayfarerBoots",
            ].map((id) => "public" + manifest.items[id].url),
            ...manifest.startup.textures.map((t) => "public" + t.url),
          ];
    for (const file of urls) {
      const bytes = await fs.readFile(file),
        hash = path.basename(file).match(/-([a-f0-9]{12})\./)?.[1];
      if (!hash || !digest(bytes).startsWith(hash))
        throw Error(`Corrupt prepared asset ${file}`);
    }
  }
}

/** Remove only obsolete content-addressed outputs owned by these generators. */
export async function pruneStartupAssets(kind) {
  const root = `public/ashen-reach/startup/${kind}`,
    manifest = await fs.readFile(`${root}/manifest.json`, "utf8");
  for (const name of await fs.readdir(root))
    if (
      /^[a-zA-Z-]+-[a-f0-9]{12}\.(bin|br|png|webp)$/.test(name) &&
      !manifest.includes(name)
    )
      await fs.unlink(`${root}/${name}`);
}
