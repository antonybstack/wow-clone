#!/usr/bin/env node
// Bring up one parallel-worktree harness slot: its own Vite dev server, its own Chrome
// profile and CDP port, pointed at each other, waited on until ASHEN.ready is true.
//
// Usage: node scripts/harness/up.mjs --slot 1 [--headless] [--uncapped] [--route ashen-reach.html?play&clean]
//
// Prints the environment variables to export so scripts/lib/cdp.mjs and the ASHEN_URL
// convention already used by scripts/ashen-reach/* target this slot instead of the shared
// 5173/9337 defaults.
import { spawn, execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { resolveSlot, STATE_DIR } from './slots.mjs';
import { syncPublicAssets } from './sync-public-assets.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
}

const slotArg = arg('slot');
if (!slotArg) {
  console.error('Usage: node scripts/harness/up.mjs --slot <N> [--headless] [--uncapped] [--route <path>]');
  process.exit(1);
}

const { slot, vitePort, cdpPort, userDataDir, stateFile, viteLog } = resolveSlot(slotArg);
const headless = process.argv.includes('--headless');
const uncapped = process.argv.includes('--uncapped');
const route = arg('route', 'ashen-reach.html?play&clean');

function isAlive(pid) {
  if (!pid) return false;
  try { process.kill(pid, 0); return true; } catch { return false; }
}

// Who is actually listening on a port, and out of which working directory.
//
// This exists because "something answers on the port" is not the same claim as "my slot is
// up". An orphaned `npm run dev` from another worktree holds the port, our own Vite exits
// with "port already in use", and the readiness fetch below succeeds anyway -- so the slot
// reports success while every capture silently renders someone else's tree. That happened
// on 2026-09-20 to three of four slots at once and produced a full set of plausible,
// worthless screenshots. Identity, not liveness, is the thing worth checking.
function listenerOwner(port) {
  const pid = run(`lsof -nP -iTCP:${port} -sTCP:LISTEN -t`).split('\n')[0];
  if (!pid) return null;
  const cwd = run(`lsof -a -p ${pid} -d cwd -Fn`).split('\n').find((l) => l.startsWith('n'))?.slice(1) ?? '';
  return { pid: Number(pid), cwd };
}

function run(command) {
  try { return execSync(command, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
  catch { return ''; }
}

// A listener belongs to this slot only if it is serving this checkout. Worktrees have
// distinct roots, which is exactly what makes the check decisive here.
function assertOwnPort(port, what) {
  const owner = listenerOwner(port);
  if (!owner) throw new Error(`Nothing is listening on ${port} for ${what}.`);
  if (owner.cwd !== repoRoot) {
    throw new Error(
      `Port ${port} is held by pid ${owner.pid} running out of ${owner.cwd || 'an unknown directory'}, not ${repoRoot}.\n` +
      `That is a foreign server, most likely an orphan from another worktree. This slot would have served its code.\n` +
      `Kill it (kill ${owner.pid}) or use a different slot; do not capture anything until this port is yours.`,
    );
  }
  return owner;
}

function printEnv(flags = {}) {
  console.log('');
  console.log(`export ASHEN_VITE_PORT=${vitePort}`);
  console.log(`export ASHEN_CDP_PORT=${cdpPort}`);
  console.log(`export ASHEN_URL="http://127.0.0.1:${vitePort}/${route}"`);
  if (flags.uncapped) console.log('export ASHEN_UNCAPPED=1');
  console.log('');
}

async function waitFor(check, { timeoutMs = 30000, intervalMs = 300, what = 'condition' } = {}) {
  const start = Date.now();
  let lastErr;
  while (Date.now() - start < timeoutMs) {
    try {
      if (await check()) return;
    } catch (err) {
      lastErr = err;
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`Timed out waiting for ${what}${lastErr ? `: ${lastErr.message}` : ''}`);
}

fs.mkdirSync(STATE_DIR, { recursive: true });
fs.mkdirSync(userDataDir, { recursive: true });

if (fs.existsSync(stateFile)) {
  const prev = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
  if (isAlive(prev.vitePid) && isAlive(prev.chromePid)) {
    console.log(`Slot ${slot} is already up (Vite pid ${prev.vitePid}, Chrome pid ${prev.chromePid}).`);
    printEnv({ uncapped: !!prev.uncapped });
    process.exit(0);
  }
  fs.rmSync(stateFile, { force: true });
}

console.log(`Slot ${slot}: Vite ${vitePort}, CDP ${cdpPort}, profile ${userDataDir}`);

// 0. In a worktree, public/ is missing gitignored binary assets that only exist in the main
// checkout's working tree; link them in so the game actually has textures to render.
const synced = syncPublicAssets(repoRoot);
console.log(synced.skipped ? `Asset sync: ${synced.skipped}.` : `Asset sync: linked ${synced.linked} missing public/ file(s) from ${synced.mainRoot}.`);

// 1. Vite, on its own port (vite.config.js reads ASHEN_VITE_PORT, default 5173).
// Refuse the port before spawning if a foreign server already holds it, so the failure names
// the squatter instead of surfacing as inexplicable captures an hour later.
const squatter = listenerOwner(vitePort);
if (squatter && squatter.cwd !== repoRoot) {
  console.error(`Slot ${slot}: port ${vitePort} is already held by pid ${squatter.pid} serving ${squatter.cwd || 'an unknown directory'}.`);
  console.error(`This checkout is ${repoRoot}. Kill that process (kill ${squatter.pid}) or pick another slot.`);
  process.exit(1);
}

const viteLogFd = fs.openSync(viteLog, 'a');
const vite = spawn('npm', ['run', 'dev'], {
  cwd: repoRoot,
  env: { ...process.env, ASHEN_VITE_PORT: String(vitePort) },
  detached: true,
  stdio: ['ignore', viteLogFd, viteLogFd],
});
vite.unref();

await waitFor(async () => {
  try {
    await fetch(`http://127.0.0.1:${vitePort}/`);
    return true;
  } catch {
    return false;
  }
}, { what: `Vite on ${vitePort} (see ${viteLog})`, timeoutMs: 30000 });
// Answering is not enough: confirm the answer comes from this checkout, and that the Vite we
// spawned is the one still running rather than a corpse that lost a port race.
const viteOwner = assertOwnPort(vitePort, `Vite on slot ${slot}`);
if (!isAlive(vite.pid)) {
  throw new Error(`Our Vite (pid ${vite.pid}) exited; ${vitePort} is served by pid ${viteOwner.pid}. See ${viteLog}.`);
}
console.log(`Vite up on ${vitePort} (pid ${vite.pid}, listener ${viteOwner.pid}, serving ${viteOwner.cwd})`);

// 2. Chrome, its own profile and CDP port, pointed at that Vite. Prefer the real, system
// Google Chrome (what the existing owned-Chrome-on-9337 convention uses, per docs/debug-view.md)
// over Playwright's bundled browser, which is version-pinned and may not be installed locally.
const SYSTEM_CHROME_CANDIDATES = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
];
const chromePath = SYSTEM_CHROME_CANDIDATES.find((p) => fs.existsSync(p)) ?? chromium.executablePath();
const targetUrl = `http://127.0.0.1:${vitePort}/${route}`;
const chrome = spawn(chromePath, [
  `--remote-debugging-port=${cdpPort}`,
  `--user-data-dir=${userDataDir}`,
  '--no-first-run',
  '--no-default-browser-check',
  '--window-size=1280,800', // match the 1280x720 viewport the ashen-reach check scripts assume
  ...(headless ? ['--headless=new'] : []),
  // Opt-in only. Default Chrome argv stays identical so other slots are unaffected.
  ...(uncapped ? ['--disable-gpu-vsync', '--disable-frame-rate-limit'] : []),
  targetUrl,
], { detached: true, stdio: 'ignore' });
chrome.unref();

await waitFor(async () => {
  const res = await fetch(`http://127.0.0.1:${cdpPort}/json/version`);
  return res.ok;
}, { what: `Chrome CDP on ${cdpPort}`, timeoutMs: 30000 });
console.log(`Chrome up on CDP ${cdpPort} (pid ${chrome.pid})`);

// Persist state now so `down.mjs` can clean up even if the readiness wait below fails.
fs.writeFileSync(stateFile, JSON.stringify({
  slot, vitePort, cdpPort, userDataDir, vitePid: vite.pid, chromePid: chrome.pid,
  headless, uncapped,
  startedAt: new Date().toISOString(),
}, null, 2));

// 3. Wait for the game itself to report ready, through that same CDP connection.
const browser = await chromium.connectOverCDP(`http://127.0.0.1:${cdpPort}`);
const context = browser.contexts()[0];
// Match on the port too, not just the route. A stale Chrome on this CDP port may already hold
// an ashen-reach.html page pointed at a different slot, and accepting it would hand back a
// browser that looks correct and renders the wrong tree.
const ours = (p) => p.url().includes(`127.0.0.1:${vitePort}/ashen-reach.html`);
await waitFor(async () => context.pages().some(ours),
  { what: `ashen-reach.html page on ${vitePort}`, timeoutMs: 15000 });
const page = context.pages().find(ours);
await page.setViewportSize({ width: 1280, height: 720 }).catch(() => {}); // real window; sticks for later connections
await page.waitForFunction(() => window.ASHEN?.ready, null, { timeout: 60000 });
console.log('ASHEN.ready is true.');
// Disconnect without closing: Chrome was spawned above as its own detached process and
// keeps running after this CDP connection (and this node process) goes away.
browser.close().catch(() => {});

console.log(`Slot ${slot} is up.${uncapped ? ' Chrome launched with --disable-gpu-vsync --disable-frame-rate-limit.' : ''}`);
printEnv({ uncapped });
