# Parallel worktree harness

Lets several agents each run and visually verify Ashen Reach at the same time, in their own
git worktree, without colliding on ports. Each **slot** gets its own Vite dev server, its own
Chrome profile and its own CDP port; one command brings a slot up, one command tears it down.

## Why

CDP `9337` is hardcoded across `scripts/ashen-reach/*` and `scripts/character-assets/*`, Vite
is pinned to `5173`, and Chrome instances collide without their own `--user-data-dir`. That
makes live browser verification a single shared resource. This harness parameterises all three
so a second (third, fourth, ...) agent can bring up its own copy.

**Ports `5173`, `9337` and `9222` are shared/owned by other sessions. Never target them from a
harness slot; slots start at `1` (Vite `5273`, CDP `9437`) and go up.**

## Slot math

For slot `N` (a positive integer):

| | formula | example (slot 1) | example (slot 2) |
|---|---|---|---|
| Vite port | `5173 + N*100` | 5273 | 5373 |
| CDP port | `9337 + N*100` | 9437 | 9537 |
| Chrome profile | `/tmp/ashen-cdp-<cdpPort>` | `/tmp/ashen-cdp-9437` | `/tmp/ashen-cdp-9537` |

`scripts/harness/slots.mjs` is the single source of this math; `up.mjs`/`down.mjs` both import
it, and it refuses a slot whose derived port would land on `5173`/`9337`/`9222`.

## Quick start

```sh
# 1. Create a worktree (skip if you already have one) and pick a slot number no one else is using.
git worktree add .claude/worktrees/my-task -b my-task

# 2. Bring the slot up: starts Vite, launches Chrome with its own profile pointed at it,
#    and waits for ASHEN.ready.
cd .claude/worktrees/my-task
node scripts/harness/up.mjs --slot 3
#   ...
#   export ASHEN_VITE_PORT=5473
#   export ASHEN_CDP_PORT=9637
#   export ASHEN_URL="http://127.0.0.1:5473/ashen-reach.html?play&clean"

# 3. Export those (or prefix each command) and run any existing check script against this slot.
export ASHEN_VITE_PORT=5473 ASHEN_CDP_PORT=9637 ASHEN_URL="http://127.0.0.1:5473/ashen-reach.html?play&clean"
node scripts/ashen-reach/check-armory.mjs

# 4. Tear it down when done.
node scripts/harness/down.mjs --slot 3
```

Add `--headless` to `up.mjs` to run Chrome without a visible window (useful when several slots
are up at once and you don't need to look at each one). Add `--clean` to `down.mjs` to also
delete the Chrome profile directory instead of leaving it for reuse.

`up.mjs` is idempotent: running it again for a slot that's already up just prints the same
export lines instead of starting a second copy.

## How scripts pick up a slot

- **CDP port**: `scripts/lib/cdp.mjs` exports `CDP_URL`, built from `ASHEN_CDP_PORT` (default
  `9337`). All `scripts/ashen-reach/*` and `scripts/character-assets/*` probes that connect over
  CDP import it instead of hardcoding `127.0.0.1:9337`.
- **Vite URL**: many check/record/probe scripts already read `process.env.ASHEN_URL` in place of
  their hardcoded `http://127.0.0.1:5173/...` default (this predates the harness); `up.mjs`
  prints the right value. Scripts that don't read `ASHEN_URL` yet still assume `5173` -
  point a browser at that slot's actual Vite port manually if you need one of those.
- **Vite's own port**: `vite.config.js` reads `ASHEN_VITE_PORT` (default `5173`).

With no environment variables set, all of the above default to exactly what they do today.

## What `up.mjs` actually does

1. Symlinks in any `public/` files this worktree is missing (textures, preview GLBs) from the
   main checkout it was created from. Worktrees only get git-tracked files, and a lot of the
   game's assets are gitignored binaries that only exist in the main checkout's working tree;
   without them Vite 404s and the game never reaches `ASHEN.ready`. This is read-only against
   the main checkout and safe to re-run.
2. Starts `npm run dev` with `ASHEN_VITE_PORT` set, waits for the port to answer.
3. Spawns Chrome (the real, system Google Chrome, not Playwright's bundled one) with
   `--remote-debugging-port`, its own `--user-data-dir` and `--window-size=1280,800`, pointed at
   that Vite's `ashen-reach.html?play&clean`.
4. Connects over CDP, waits for `window.ASHEN.ready`.
5. Writes `/tmp/ashen-harness/slot-<N>.json` (pids, ports, profile dir) so `down.mjs` knows what
   to stop, and prints the `export` lines.

`down.mjs` reads that state file, sends `SIGTERM` (then `SIGKILL` if needed) to each process
*group* (Vite's `npm run dev` and its child, Chrome), and removes the state file.

## Rough edges

- Chrome's default window size in this environment is much smaller than the 1280x720 some check
  scripts assume for pixel-coordinate clicks; `up.mjs` forces `1280x800` window / `1280x720`
  viewport to match.
- `vite.config.js` now sets `server.host: "127.0.0.1"` explicitly. Vite's unset default
  (`localhost`) resolved to IPv6-only (`::1`) in this environment, which every script's hardcoded
  `127.0.0.1` URL can't reach - this wasn't specific to the harness, but the harness is what
  surfaced it.
- Two slots run fully independently (separate Vite process group, separate Chrome profile and
  process group, separate CDP port) - there is no shared state between them, so run them with as
  many agents as you have slots for.
