#!/usr/bin/env node
// Tear down one parallel-worktree harness slot: stop its Vite server and its Chrome, and
// remove its state file. Usage: node scripts/harness/down.mjs --slot 1 [--clean]
import fs from 'node:fs';
import { resolveSlot } from './slots.mjs';

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
}

const slotArg = arg('slot');
if (!slotArg) {
  console.error('Usage: node scripts/harness/down.mjs --slot <N> [--clean]');
  process.exit(1);
}
const { slot, stateFile, userDataDir } = resolveSlot(slotArg);
const clean = process.argv.includes('--clean');

if (!fs.existsSync(stateFile)) {
  console.log(`Slot ${slot} has no state file (${stateFile}); nothing to stop.`);
  process.exit(0);
}
const state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));

function isAlive(pid) {
  if (!pid) return false;
  try { process.kill(pid, 0); return true; } catch { return false; }
}

async function killGroup(pid, label) {
  if (!isAlive(pid)) {
    console.log(`${label} (pid ${pid}) is already gone.`);
    return;
  }
  try {
    process.kill(-pid, 'SIGTERM'); // negative pid = whole process group (spawned with detached: true)
  } catch (err) {
    console.log(`${label}: SIGTERM to group failed (${err.message}), trying the pid directly.`);
    try { process.kill(pid, 'SIGTERM'); } catch { /* already gone */ }
  }
  const start = Date.now();
  while (isAlive(pid) && Date.now() - start < 5000) {
    await new Promise((r) => setTimeout(r, 200));
  }
  if (isAlive(pid)) {
    console.log(`${label}: still alive after SIGTERM, sending SIGKILL.`);
    try { process.kill(-pid, 'SIGKILL'); } catch { try { process.kill(pid, 'SIGKILL'); } catch { /* gone */ } }
  }
  console.log(`${label} stopped.`);
}

await killGroup(state.chromePid, `Slot ${slot} Chrome`);
await killGroup(state.vitePid, `Slot ${slot} Vite`);

fs.rmSync(stateFile, { force: true });
if (clean) {
  fs.rmSync(userDataDir, { recursive: true, force: true });
  console.log(`Removed profile dir ${userDataDir}.`);
}
console.log(`Slot ${slot} is down.`);
