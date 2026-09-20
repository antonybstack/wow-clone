// Slot math for the parallel-worktree harness. Each slot gets its own Vite port, CDP port
// and Chrome profile dir, derived from a single integer so two agents never have to
// coordinate port numbers by hand.
//
// slot N -> Vite  5173 + N*100
//        -> CDP   9337 + N*100
//        -> profile /tmp/ashen-cdp-<cdpPort>
//
// Ports 5173, 9337 and 9222 are the shared defaults / another agent's live session and must
// never be produced by this math (slot 0 is refused for that reason).
export const PROTECTED_PORTS = new Set([5173, 9337, 9222]);
export const STATE_DIR = '/tmp/ashen-harness';

export function resolveSlot(rawSlot) {
  const slot = Number(rawSlot);
  if (!Number.isInteger(slot) || slot < 1) {
    throw new Error(`--slot must be a positive integer (got ${JSON.stringify(rawSlot)})`);
  }
  const vitePort = 5173 + slot * 100;
  const cdpPort = 9337 + slot * 100;
  if (PROTECTED_PORTS.has(vitePort) || PROTECTED_PORTS.has(cdpPort)) {
    throw new Error(`slot ${slot} collides with a protected port (5173/9337/9222); pick a different slot`);
  }
  const userDataDir = `/tmp/ashen-cdp-${cdpPort}`;
  const stateFile = `${STATE_DIR}/slot-${slot}.json`;
  const viteLog = `${STATE_DIR}/slot-${slot}-vite.log`;
  return { slot, vitePort, cdpPort, userDataDir, stateFile, viteLog };
}
