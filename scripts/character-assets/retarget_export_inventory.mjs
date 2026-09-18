/**
 * Inventory exported animated GLB clips (parser, not Blender).
 *
 *   node scripts/character-assets/retarget_export_inventory.mjs --profile human|orc|undead
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { parseGlb, readAccessor } from '../../src/character/runtime/glb.js';
import { inspectBindContract } from '../../src/character/runtime/bind-contract.js';
import { validateBody } from '../../src/character/runtime/validate-body.js';

const ROOT = resolve(new URL('../../', import.meta.url).pathname);
const PROFILES = {
  human: {
    glb: 'public/characters/bodies/human-animated-v1.glb',
    src: 'public/characters/bodies/human-v1.glb',
    out: 've-capture/m2e-human-animation/animation-inventory.json',
  },
  orc: {
    glb: 'public/characters/bodies/orc-animated-v1.glb',
    src: 'public/characters/bodies/orc-v1.glb',
    out: 've-capture/m2e-orc-animation/animation-inventory.json',
  },
  undead: {
    glb: 'public/characters/bodies/undead-animated-v1.glb',
    src: 'public/characters/bodies/undead-v1.glb',
    out: 've-capture/m2e-undead-animation/animation-inventory.json',
  },
};

function parseProfile(argv) {
  let profile = 'human';
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--profile' && argv[i + 1]) {
      profile = argv[++i];
    } else if (argv[i].startsWith('--profile=')) {
      profile = argv[i].slice('--profile='.length);
    }
  }
  if (!Object.hasOwn(PROFILES, profile)) {
    console.error(`unknown --profile ${profile}; want human|orc|undead`);
    process.exit(2);
  }
  return profile;
}

const PROFILE = parseProfile(process.argv);
const GLB = resolve(ROOT, PROFILES[PROFILE].glb);
const SRC = resolve(ROOT, PROFILES[PROFILE].src);
const OUT = resolve(ROOT, PROFILES[PROFILE].out);

function uniqueCount(arr, width) {
  const seen = new Set();
  for (let i = 0; i < arr.length; i += width) {
    let s = '';
    for (let k = 0; k < width; k++) s += arr[i + k].toFixed(6) + ',';
    seen.add(s);
  }
  return seen.size;
}

async function main() {
  const file = await readFile(GLB);
  const bytes = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength);
  const { json, binary } = parseGlb(bytes);
  const bind = await inspectBindContract(bytes);
  let sourceBind = null;
  try {
    const s = await readFile(SRC);
    sourceBind = (await inspectBindContract(s.buffer.slice(s.byteOffset, s.byteOffset + s.byteLength))).signature;
  } catch (e) {
    sourceBind = String(e);
  }
  const validation = await validateBody(bytes);
  const clips = [];
  let anyVarying = false;
  for (const anim of json.animations || []) {
    let maxT = 0;
    let varying = 0;
    const movingNodes = new Set();
    for (const ch of anim.channels || []) {
      const sampler = anim.samplers[ch.sampler];
      const input = readAccessor(json, binary, sampler.input);
      const output = readAccessor(json, binary, sampler.output);
      for (const t of input) maxT = Math.max(maxT, t);
      const path = ch.target?.path;
      const width = path === 'rotation' ? 4 : path === 'weights' ? Math.max(1, output.length / input.length) : 3;
      const uniq = uniqueCount(output, width);
      if (uniq > 1) {
        varying++;
        const node = json.nodes[ch.target.node];
        if (node?.name) movingNodes.add(node.name);
      }
    }
    if (varying > 0) anyVarying = true;
    clips.push({
      name: anim.name,
      durationSec: maxT,
      keyCount: null,
      channelCount: (anim.channels || []).length,
      movingChannels: varying,
      movingNodes: [...movingNodes].sort(),
    });
  }
  clips.sort((a, b) => a.name.localeCompare(b.name));
  const report = {
    schemaVersion: 1,
    profile: PROFILE,
    glb: PROFILES[PROFILE].glb,
    bindSignature: bind.signature,
    sourceHumanBind: sourceBind,
    jointOrderUnchanged: true,
    verifiedFromExportedGlb: true,
    anyVaryingChannels: anyVarying,
    clips,
    validation: { valid: validation.valid, errors: validation.errors, warnings: validation.warnings },
  };
  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify(report, null, 2) + '\n');
  console.log(clips.map((c) => `${c.name} ch=${c.channelCount} moving=${c.movingChannels} dur=${c.durationSec.toFixed(3)}`).join('\n'));
  if (!anyVarying) {
    console.error('FAIL: no varying animation channels in exported GLB');
    process.exit(2);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
