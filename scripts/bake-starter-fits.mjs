/**
 * Bake compact starterShirt/Trousers/Boots fit GLBs for human/orc/undead.
 * Usage: node scripts/bake-starter-fits.mjs [--out dir]
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { inspectBindContract } from '../src/character/runtime/bind-contract.js';
import { extractFitGarment } from '../src/character/runtime/extract-fit-garment.js';
import { sourceGeometrySignature } from '../src/character/runtime/fit-contract.js';
import {
  FIT_ASSET_VERSION,
  FIT_SCHEMA_VERSION,
  PLAYABLE_FIT_PROFILES,
  SHAPE_IDENTITY,
  STARTER_ITEM_IDS,
  STARTER_ITEMS,
  fitGlbRel,
  fitGlbUrl,
} from '../src/character/runtime/garment-catalog.js';
import { parseGlb } from '../src/character/runtime/glb.js';
import { STARTER_PROFILES } from '../src/character/runtime/compose-starter-outfit.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export const CANONICAL_BODIES = Object.freeze({
  'human-v1': 'public/characters/bodies/human-animated-v1.glb',
  'orc-v1': 'public/characters/bodies/orc-animated-v1.glb',
  'undead-v1': 'public/characters/bodies/undead-animated-v1.glb',
});

function sha256Hex(buf) {
  return createHash('sha256').update(buf instanceof Uint8Array ? buf : new Uint8Array(buf)).digest('hex');
}

export async function loadCanonicalBody(profileId, root = ROOT) {
  const rel = CANONICAL_BODIES[profileId];
  if (!rel) throw new Error(`Unknown profile ${profileId}`);
  const file = await readFile(resolve(root, rel));
  const buffer = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength);
  return { rel, buffer, sha256: `sha256:${sha256Hex(buffer)}`, byteLength: buffer.byteLength };
}

export async function bakeStarterFits({ outDir, root = ROOT } = {}) {
  const dest = resolve(outDir || resolve(root, 'public/characters/garments'));
  await mkdir(dest, { recursive: true });
  const hashesBefore = {};
  const bodies = {};
  const items = Object.fromEntries(STARTER_ITEM_IDS.map((id) => [id, {
    ...STARTER_ITEMS[id],
    variants: {},
  }]));

  for (const profileId of PLAYABLE_FIT_PROFILES) {
    const loaded = await loadCanonicalBody(profileId, root);
    hashesBefore[profileId] = loaded.sha256;
    const bind = await inspectBindContract(loaded.buffer);
    const { json, binary } = parseGlb(loaded.buffer);
    const bodyNode = json.nodes.find((n) => n.name === STARTER_PROFILES[profileId].bodyMesh);
    const geom = await sourceGeometrySignature(json, binary, bodyNode);
    bodies[profileId] = {
      asset: `/${loaded.rel.replace(/^public\//, '')}`,
      bindSignature: bind.signature,
      sourceGeometrySignature: geom,
      sourceBodySha256: loaded.sha256,
      sourceMesh: STARTER_PROFILES[profileId].bodyMesh,
      sourceSkin: bodyNode.skin,
      byteLength: loaded.byteLength,
    };

    for (const itemId of STARTER_ITEM_IDS) {
      const extracted = await extractFitGarment(loaded.buffer, { profileId, itemId });
      const rel = fitGlbRel(itemId, profileId, FIT_ASSET_VERSION);
      const bytes = new Uint8Array(extracted.buffer);
      await writeFile(resolve(dest, rel), bytes);
      const variant = {
        profileId,
        bindSignature: extracted.extras.bindSignature,
        sourceGeometrySignature: extracted.extras.sourceGeometrySignature,
        sourceBodySha256: extracted.extras.sourceBodySha256,
        glb: fitGlbUrl(itemId, profileId, FIT_ASSET_VERSION),
        file: rel,
        shapeId: SHAPE_IDENTITY,
        version: FIT_ASSET_VERSION,
        cacheKey: extracted.extras.cacheKey,
        byteLength: extracted.buffer.byteLength,
        sha256: `sha256:${sha256Hex(extracted.buffer)}`,
        hideNodes: extracted.extras.hideNodes,
        coverageCount: extracted.extras.coverage.triangleOffsets.length,
      };
      items[itemId].variants[profileId] = variant;
    }

    const after = await loadCanonicalBody(profileId, root);
    if (after.sha256 !== loaded.sha256) {
      throw new Error(`Canonical body mutated during bake: ${profileId}`);
    }
  }

  const manifest = {
    schema: FIT_SCHEMA_VERSION,
    version: FIT_ASSET_VERSION,
    generatedBy: 'scripts/bake-starter-fits.mjs',
    shapeId: SHAPE_IDENTITY,
    bodies,
    items,
    hashesBefore,
  };
  const manifestName = 'starter-fits.v1.json';
  const manifestJson = `${JSON.stringify(manifest, null, 2)}\n`;
  await writeFile(resolve(dest, manifestName), manifestJson);
  return { dest, manifest, manifestName };
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const outFlag = process.argv.indexOf('--out');
  const outDir = outFlag >= 0 ? resolve(process.argv[outFlag + 1]) : undefined;
  const result = await bakeStarterFits({ outDir });
  const sizes = [];
  for (const itemId of STARTER_ITEM_IDS) {
    for (const profileId of PLAYABLE_FIT_PROFILES) {
      const v = result.manifest.items[itemId].variants[profileId];
      sizes.push(`${v.file} ${v.byteLength} ${v.sha256}`);
    }
  }
  console.log(JSON.stringify({ dest: result.dest, files: sizes, bodies: result.manifest.bodies }, null, 2));
}
