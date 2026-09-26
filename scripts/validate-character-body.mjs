/**
 * Offline body GLB validator CLI.
 *
 *   node scripts/validate-character-body.mjs <path.glb> [--profile <id>] [--out <report.json>]
 *
 * Exit 0: validation succeeded (warnings allowed; not production acceptance).
 * Exit 1: invalid asset.
 * Exit 2: bad arguments, missing path, or unknown profile.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { validateBody } from '../src/character/runtime/validate-body.js';
import { BODY_PROFILES } from '../src/character/runtime/body-profile.js';
import { fixtureGlbInput } from './character-fixture-input.mjs';

function usage() {
  return 'Usage: node scripts/validate-character-body.mjs <path.glb> [--profile <id>] [--out <report.json>]';
}

function failArgs(message) {
  console.error(message);
  console.error(usage());
  console.error(`Known profiles: ${Object.keys(BODY_PROFILES).join(', ')}`);
  process.exit(2);
}

function parseArgs(argv) {
  const args = argv.slice(2);
  let glbPath;
  let profile;
  let out;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--profile' || arg === '--out') {
      const value = args[i + 1];
      if (!value || value.startsWith('-')) failArgs(`Missing value for ${arg}`);
      if (arg === '--profile') profile = value;
      else out = value;
      i += 1;
      continue;
    }
    if (arg.startsWith('-')) failArgs(`Unknown flag: ${arg}`);
    if (glbPath) failArgs(`Unexpected extra argument: ${arg}`);
    glbPath = arg;
  }
  if (!glbPath) failArgs('Missing GLB path');
  return { glbPath, profile, out };
}

function codes(issues) {
  return [...new Set(issues.map((i) => i.code))].join(', ') || '(none)';
}

function printReport(path, report) {
  const status = report.valid ? 'OK' : 'INVALID';
  const morphs = report.summary.morphNames?.length ? report.summary.morphNames.join(', ') : '(none)';
  const bind = report.summary.bindSignature || '(none)';
  console.log(`${status}  ${path}`);
  console.log(`  valid=${report.valid} errors=${report.errors.length} warnings=${report.warnings.length}`);
  console.log(`  meshes=${report.summary.meshCount} primitives=${report.summary.primitiveCount} joints=${report.summary.jointCount} morphs=${morphs}`);
  console.log(`  bind=${bind}`);
  if (report.errors.length) console.log(`  errors: ${codes(report.errors)}`);
  if (report.warnings.length) console.log(`  warnings: ${codes(report.warnings)}`);
  console.log('  warnings are not production acceptance; M2 authored-body gates remain open');
}

async function main() {
  const { glbPath, profile, out } = parseArgs(process.argv);
  if (profile && !Object.hasOwn(BODY_PROFILES, profile)) {
    failArgs(`Unknown profile: ${profile}`);
  }
  const resolved = resolve(glbPath);
  let bytes;
  try {
    bytes = await readFile(resolved);
  } catch (err) {
    failArgs(`Cannot read ${resolved}: ${err.message}`);
  }
  const input = await fixtureGlbInput(bytes);
  const report = await validateBody(input, profile ? { profile } : {});
  printReport(glbPath, report);
  if (out) {
    await writeFile(resolve(out), `${JSON.stringify(report, null, 2)}\n`);
    console.log(`  wrote ${out}`);
  }
  process.exit(report.valid ? 0 : 1);
}

await main();
