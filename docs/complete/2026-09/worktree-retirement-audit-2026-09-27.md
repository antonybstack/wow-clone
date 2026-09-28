Historical scoped report: this records the pass described below, including its stated limitations. It is not an active task queue. See [current state](../../CURRENT.md) and [the new roadmap](../../plans/character-mmo/vision-roadmap.md).

# Worktree retirement audit — 2026-09-27

All **31 secondary worktrees** were inspected and removed. `git worktree list --porcelain` now shows only the active `/Users/antbly/dev/wow-clone` checkout on `main`. No game code was merged or deployed during this cleanup. The unrelated, pre-existing `AGENTS.md` edit in the active checkout was left untouched.

## Merge decision

Thirty worktree tips were ancestors of current `main`; they contain **zero commits missing from `main`**. Their uncommitted files were either earlier versions of released changes, isolated experiments, disposable recording probes, generated assets, or local dependencies. The earlier static-shadow and asynchronous-shader trials are already recorded in [the performance investigation](../../archive/plans/rendering-performance-investigation-2026-09-26.md); their candidate code was not accepted. The Lite F2–F7 work was subsequently implemented and released from `main`, as recorded in [the release report](babylon-lite-f1-f7-release-2026-09-26.md). No uncommitted source file passed the bar for merging over the released implementation.

`m11a` was the sole exception: **21 unique commits** contain an alternate Undead body based on a CC0 skull, modeling scripts, and review notes. Its [branch review notes](https://github.com/antonybstack/wow-clone/blob/archive/undead-sculpt-2026-09-21/docs/undead-race-plan.md) explicitly marked the sculpt unaccepted, with remaining silhouette and anatomy defects and a capture instrument that needs repair. It has not been substituted for the current playable Tripo-derived Undead. The exact commits remain on local branch `m11a` and were pushed to remote branch **`archive/undead-sculpt-2026-09-21`** at `715cc93`. That branch can be reviewed later without keeping a live worktree or changing production art.

| Group | Worktrees reviewed and removed | Decision |
| --- | --- | --- |
| Rendering and startup experiments | `ashen-async-investigation`, `ashen-csm-investigation-20260926`, `ashen-terrain-baseline-c250197` | Earlier probes; findings already documented, later production path supersedes code. |
| Babylon Lite follow-up candidates | `ashen-f2b-hud`, `ashen-f3-chest`, `ashen-f6-late-features`, `ashen-lite-f2a`, `ashen-lite-f2a-base`, `ashen-lite-f7-contact`, `ashen-lite128-m0`, `ashen-lite1311-clean`, `ashen-lite1311-f1`, `ashen-lite1311-f4`, `ashen-lite1311-f5a` | Released or superseded on `main`; dirty candidate files preserved locally. |
| Infrastructure and startup | `agent-a6f500382d5fcb777`, `env-lighting` | Commits already on `main`; raw captures preserved. |
| Other completed milestone checkouts | `m10`, `m11b`, `m12-assets`, `m3c`, `m4-combat`, `m4c`, `m5-progression`, `m6a`, `m6b`, `m7a`, `m7b`, `m8a`, `m8b`, `m9` | Commits already on `main`; loose recorder scripts preserved. |
| Unaccepted Undead sculpt | `m11a` | Retain and publish branch for later art review; do not merge into released game. |

## Local preservation and verification

Before removal, each dirty path was inventoried. **19 compressed archives** covering uncommitted files and local ledgers were written to `.dream-loop/worktree-retirement-2026-09-27/`; regular files with recorded SHA-256 values were checked inside the archives. This includes the original ignored CC0 skull download and extracted source in `m11a`, plus local Telegram ledgers where present. The adjacent `manifest.json` records all 31 original paths, heads, statuses, files, and capture locations. These archives are local ignored artifacts, not committed source.

**16 capture directories** were moved, without copying or discarding them, to `ve-capture/worktree-retirement-2026-09-27/`. They occupy about **11 GB**, mostly raw `env-lighting` video frames. The remaining generated `dist` and dependency copies were removed with their worktrees. The worktree archive and capture directory can be reviewed or pruned separately; this audit does not claim that the 11 GB was freed.

After removal, the only registered worktree is `main`; the remote Undead archive branch resolves to `715cc93`. No game browser was launched and no visual or FPS acceptance claim is made for this administrative cleanup.
