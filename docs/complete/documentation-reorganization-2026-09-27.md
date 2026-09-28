# Character/MMO planning and documentation reorganization — 2026-09-27

Status: documentation work completed; the proposed M001–M100 implementation is **not started**. No runtime release was made.

## Delivered planning hierarchy

- [100 milestones in ten categories](../plans/character-mmo/vision-roadmap.md): customization proof, bodies/identity, equipment pipeline, creator/runtime, crowds, asset delivery, multiplayer presence, social/gameplay integration, launch/quarterly content, release/operations.
- [Next ten milestones](../plans/character-mmo/next-ten.md): sequential dependencies, inputs, scope, outputs and evidence gates before bulk wardrobe production.
- [M001](../plans/character-mmo/m001-baseline-and-asset-census.md), [M002](../plans/character-mmo/m002-appearance-contract.md), [M003](../plans/character-mmo/m003-crowd-feasibility.md): implementation-ready briefs with paths/APIs/steps, tests, acceptance, failure behavior and copyable handoff prompts for Claude Opus 5.5 or GPT-6 Sol medium.
- [Execution contract](../plans/character-mmo/execution-contract.md) and [architecture decisions/research](../plans/character-mmo/architecture.md): baseline isolation, native reuse, preserved startup gates, resource ownership, honest crowd limits and source-art dependencies.
- [Independent planning review disposition](../reviews/character-mmo-planning-review-2026-09-27.md): accepted corrections and unsupported inferences explicitly separated.

## Organization and preservation

Moved **55** prior root documents: **26 scoped reports** to `docs/complete/2026-09/` and **29 historical/mixed plans** to `docs/archive/plans/`. Completed scoped reports retain their recorded limitations; archival placement never declares unfinished work complete. Added status notices and rebased links without removing the original prose.

Preserved four prior entry-point snapshots (CURRENT, README, character architecture and startup guide) under `archive/state/`. Replaced CURRENT/README with concise active entry points and corrected the architecture/startup summaries to match the current source/release boundary. Existing authoring references remain accessible with a historical-scope notice where needed.

The [relocation map](../archive/relocations-2026-09-27.json) records every old/new path and the original content SHA-256. Baselines, reviews, approved references, source-art binaries and raw local captures were not moved or deleted. Existing worktree/media archives were not touched.

Two tiny root compatibility pointers retain documentation paths referenced from source files included in prepared-startup provenance: `environment-atmosphere-plan.md` and `rendering-performance-investigation-2026-09-26.md`. Updating those source comments would change their source hashes and unnecessarily invalidate prepared assets; the original game source bytes remain intact. Two non-game script references were updated to new documentation paths (an error message and a test comment).

Fixed one pre-existing broken Undead body-study Markdown link to its existing nested reference path. No reference image was replaced. Historical raw URLs, baseline records and dates remain historical.

## Verification

- Exactly M001–M100, without gaps/duplicates, in ten categorized roadmap sections; next-ten status rows and three detailed briefs remain planned.
- All 55 original document hashes match their pre-move git content; normalized prose comparison confirms only status notices, links and path references changed in moved records.
- Local Markdown file-link validation across documentation: no missing local targets after organization. Existing fragments/external URLs are not claimed fully audited.
- Prepared startup provenance verification passed with runtime sources/assets unchanged.
- `npm run build` passed; existing large-chunk advisory remains. No deployment.
- `node --test scripts/test-undead-race.mjs`: 20 passed.
- `git diff --check` passed. No game browser or server was launched for this documentation task; the bounded Grok review process completed.

Large game regressions were not rerun because the implementation changes are documentation and diagnostic documentation pointers. This verification does not establish new visual or crowd-performance acceptance. The pre-existing unrelated AGENTS.md edit remains unstaged.
