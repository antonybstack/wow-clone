// A git worktree only gets tracked files; `public/` also holds a lot of large, gitignored
// binary assets (textures, preview GLBs) that live only in the main checkout's working tree.
// Without them Vite 404s, its SPA fallback serves index.html in place of the asset, and the
// game can never reach ASHEN.ready ("InvalidStateError: The source image could not be
// decoded."). This finds the main checkout (wherever this worktree was created from) and
// symlinks in whatever public/ files are missing here - read-only against the main checkout,
// safe to re-run, and every path involved is already covered by .gitignore.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export function findMainCheckoutRoot(repoRoot) {
  const commonDir = execFileSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], {
    cwd: repoRoot,
  }).toString().trim();
  // commonDir is `<mainRoot>/.git` for a worktree (and for the main checkout itself).
  return path.dirname(commonDir);
}

function walkFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkFiles(full));
    else if (entry.isFile() || entry.isSymbolicLink()) out.push(full);
  }
  return out;
}

export function syncPublicAssets(repoRoot) {
  const mainRoot = findMainCheckoutRoot(repoRoot);
  if (mainRoot === repoRoot) return { linked: 0, skipped: 'this is the main checkout' };

  const mainPublic = path.join(mainRoot, 'public');
  const worktreePublic = path.join(repoRoot, 'public');
  if (!fs.existsSync(mainPublic)) return { linked: 0, skipped: 'main checkout has no public/' };

  let linked = 0;
  for (const src of walkFiles(mainPublic)) {
    const rel = path.relative(mainPublic, src);
    const dest = path.join(worktreePublic, rel);
    if (fs.existsSync(dest)) continue; // real file, or already-linked - leave it alone
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.symlinkSync(src, dest);
    linked++;
  }
  return { linked, mainRoot };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
  console.log(syncPublicAssets(repoRoot));
}
