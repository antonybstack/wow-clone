// Shared CDP connection target for the scripts/ashen-reach and scripts/character-assets
// Playwright probes. Defaults preserve the long-standing owned-Chrome convention on port
// 9337; the parallel-worktree harness (scripts/harness/) overrides ASHEN_CDP_PORT per slot
// so several agents can each drive their own Chrome without colliding.
export const CDP_PORT = process.env.ASHEN_CDP_PORT || 9337;
export const CDP_URL = `http://127.0.0.1:${CDP_PORT}`;
