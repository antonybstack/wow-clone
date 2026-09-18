/**
 * Factual inventory of a body GLB for offline retarget prep.
 * Does not bake clips or load the body into the game.
 *
 *   node scripts/character-assets/inspect-retarget-source.mjs [glb] [--out path.json]
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { parseGlb } from '../../src/character/runtime/glb.js';
import { inspectBindContract } from '../../src/character/runtime/bind-contract.js';
import { validateBody } from '../../src/character/runtime/validate-body.js';
import {
  createHumanV1RetargetProfile,
  mapHumanV1Semantics,
  validateRetargetProfile,
  RETARGET_SEMANTIC_STATES,
} from '../../src/character/runtime/retarget-contract.js';
import { RIG_HUMANOID_V1, SEMANTIC_JOINTS } from '../../src/character/runtime/rig.js';

function parseArgs(argv) {
  const args = argv.slice(2);
  let glbPath = 'public/characters/bodies/human-v1.glb';
  let out = 've-capture/m2c-retarget/source-inventory.json';
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--out') { out = args[++i]; continue; }
    if (!args[i].startsWith('-')) glbPath = args[i];
  }
  return { glbPath, out };
}

async function main() {
  const { glbPath, out } = parseArgs(process.argv);
  const resolved = resolve(glbPath);
  const file = await readFile(resolved);
  const bytes = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength);
  const { json } = parseGlb(bytes);
  const validation = await validateBody(bytes);
  const bind = await inspectBindContract(bytes);
  const nodeNames = (json.nodes || []).map((n) => n?.name).filter(Boolean);
  const jointNames = bind.jointNames;
  const mapping = mapHumanV1Semantics(jointNames);
  const profile = createHumanV1RetargetProfile(mapping);
  const check = validateRetargetProfile(profile, {
    nodeNames: jointNames,
    animationNames: json.animations?.map((a) => a.name).filter(Boolean) || [],
  }, { rigFamily: RIG_HUMANOID_V1, joints: SEMANTIC_JOINTS });

  const inventory = {
    schemaVersion: 1,
    sourcePath: glbPath,
    jointCount: bind.jointCount,
    nodeCount: json.nodes?.length ?? 0,
    nodeNames,
    jointNames,
    animationNames: json.animations?.map((a) => a.name).filter(Boolean) || [],
    morphNames: validation.summary.morphNames || [],
    bounds: validation.summary.bounds,
    heightLocalY: validation.summary.bounds
      ? validation.summary.bounds.max[1] - validation.summary.bounds.min[1]
      : null,
    bindSignature: bind.signature,
    validation: {
      valid: validation.valid,
      errors: validation.errors,
      warnings: validation.warnings,
    },
    mapping: {
      resolved: mapping.resolved,
      requiredMissing: mapping.requiredMissing,
      optionalMissing: mapping.optionalMissing,
      unmappedNodes: mapping.unmappedNodes,
      completeRequired: mapping.completeRequired,
    },
    retargetProfile: {
      sourceProfileId: profile.sourceProfileId,
      destinationRigFamily: profile.destinationRigFamily,
      mode: profile.mode,
      unitScale: profile.unitScale,
      axes: profile.axes,
      rootMotionPolicy: profile.rootMotionPolicy,
      bindCompatibilityRequired: profile.bindCompatibilityRequired,
      semanticStates: RETARGET_SEMANTIC_STATES,
      clipFiles: {},
    },
    contractValidation: check,
    notes: [
      'Zero exported animation clips. Authoring stress poses are not runtime clips.',
      'Bind signature differs from Mixamo base.glb; offline retarget only.',
      'Do not load this GLB into gameplay until an explicit preview task.',
    ],
  };

  if (out) {
    const dest = resolve(out);
    await mkdir(dirname(dest), { recursive: true });
    await writeFile(dest, `${JSON.stringify(inventory, null, 2)}\n`);
  }

  console.log(`source=${glbPath}`);
  console.log(`joints=${inventory.jointCount} nodes=${inventory.nodeCount} clips=${inventory.animationNames.length} morphs=${inventory.morphNames.length}`);
  console.log(`bind=${inventory.bindSignature}`);
  console.log(`heightLocalY=${inventory.heightLocalY}`);
  console.log(`requiredComplete=${mapping.completeRequired} optionalMissing=${mapping.optionalMissing.join(',') || '(none)'}`);
  console.log(`unmapped=${mapping.unmappedNodes.length} contractValid=${check.valid} warnings=${check.warnings.map((w) => w.code).join(',')}`);
  if (out) console.log(`wrote ${out}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
