# Documentation map

Start with **[CURRENT.md](CURRENT.md)** for the shipped game and current initiative.

## Current direction and plans

- **[Combat overhaul: investigation and 12-milestone plan](plans/combat-overhaul/plan-2026-10-10.md)** — latest requested planning focus: responsive inputs, instants while moving, procs, burns, area attacks, buffs, enemy decisions and an integrated Gothic encounter. Implementation has not started.

- **[Long-term game vision](plans/gothic-exploration/vision.md)** — a purposeful Gothic region, deeper adventure, character production and shared expeditions.
- **[Bell of Vaelmark execution plan](plans/gothic-exploration/next-24-hours-2026-10-09.md)** — G09–G18 desktop-preview branch completed; [release result](plans/gothic-exploration/results/expedition-release-2026-10-10.md). CURRENT records subsequent production deployment and the retained startup limitation.
- **[Completed Gothic foundations and acceptance scope](plans/gothic-exploration/plan.md)** — G01–G08 desktop previews; connected spaces and normal-control traversal already built.
- **[G01 result: playable undercroft, measurements and sealed preview](plans/gothic-exploration/results/undercroft-2026-10-08.md)** — complete locally/preview; existing lower route.
- **[G03 regional circuit and fork repairs](baselines/g03-region-2026-10-09/README.md)** — eight connected public destinations, reviewed motion.
- **[G04 map / G05 wall walk / G06 hall balcony](plans/gothic-exploration/next-slices-2026-10-09.md)** — delivered desktop previews; final integrated FPS acceptance is recorded in CURRENT. Production startup remains a separate hold.
- **[Deferred mobile findings and known iPhone specifications](backlog/mobile-2026-10-08.md)** — backlogged at the user's request.
- **[Previous release and factory execution plan](plans/character-mmo/next-12-hours-2026-10-05.md)** — retained requirements and evidence; follow CURRENT for the latest focus.
- **[Workflow review and immediate changes](reviews/workflow-2026-10-05.md)**

- **[Character and MMO capability horizon: 100 milestones](plans/character-mmo/vision-roadmap.md)** — retained long-term inventory; CURRENT controls execution order.
- **[Previous character milestone sequence](plans/character-mmo/next-ten.md)** — implementation history and remaining capabilities, not the active Gothic task queue.
- **[Current-state review and changed priorities — 2026-09-29](reviews/current-state-priorities-2026-09-29.md)**
- **Completed proof briefs and reusable tooling:** [M001 — baseline/assets](plans/character-mmo/m001-baseline-and-asset-census.md), [M002 — appearance contract](plans/character-mmo/m002-appearance-contract.md), [M003 — crowd feasibility](plans/character-mmo/m003-crowd-feasibility.md), [M004 — Human template](plans/character-mmo/m004-human-template.md), [M005 — deformation proof](plans/character-mmo/m005-deformation-proof.md)
- [Execution contract and performance gates](plans/character-mmo/execution-contract.md)
- [Architecture decisions, capability checks and research](plans/character-mmo/architecture.md)

M001–M005 are completed proof work. The previous character sequence released body customization, crowd/streaming proofs, the bounded saved Human creator and authored equipment colours; multiplayer is verified locally with public hosting parked. The rigid shoulder factory/content proof is also released. Mixed-outfit visual acceptance, the licensed Elf source and physical-device acceptance remain open. CURRENT owns the release and next action; historical IDs are not a second task queue.

## Operating and authoring references

- [Character contracts](character-system-north-star.md)
- [Equipment source/authoring history and current runtime boundary](ashen-equipment-authoring.md)
- [Repeatable rigid-item factory and content integration](equipment-factory.md)
- [Orc sculpt pipeline](orc-sculpt-pipeline.md)
- [Progressive startup lifecycle](startup-load.md)
- [Play and regression checks](play-test-plan.md)
- [Browser ownership, measurement, capture and Telegram](debug-view.md)
- [Owned worktree harness](parallel-worktree-harness.md): isolated slots are tools, not permission for concurrent game rendering during measurements.
- [Deployment and production rollback workflow](DEPLOY.md)
- [Sun-shadow technical reference](sun-shadow-architecture.md): check installed engine/current source before changing bridges.

## Evidence and history

| Location | Purpose |
| --- | --- |
| [complete/](complete/README.md) | Closed scoped implementation/release/review reports, including their limitations |
| [archive/](archive/README.md) | Superseded or mixed historical plans and previous entry-point snapshots; archived does not mean completed |
| [baselines/](baselines/) | Immutable measured artifacts and comparison evidence; paths retained |
| [reviews/](reviews/) | Independent reviews and their stated scope |
| [references/](references/) | User-approved visual references/source artifacts; paths retained |

See the [2026-09-27 reorganization audit](complete/documentation-reorganization-2026-09-27.md) and [machine-readable relocation map](archive/relocations-2026-09-27.json) for old paths. No baseline or reference asset was removed. Two small root compatibility pointers preserve source-hashed documentation references without invalidating prepared startup assets.

## Documentation lifecycle

Keep one current initiative in CURRENT. Put its active plans in `plans/<initiative>/`; append concise outcome reports under that initiative's `results/` as work finishes. Move closed reports into `complete/` when the initiative is retired and update links. Move superseded/mixed plans to `archive/` with an explicit status notice; never promote their unchecked tasks into a new queue or silently mark them complete.

Keep compact measurements, provenance and reviewed-media URLs in git. Large raw captures stay in ignored `ve-capture/`. Do not delete or rewrite historical baseline data during organization. Update relative Markdown links and source documentation references when moving files. Preserve prior entry-point snapshots when a significant new direction replaces their chronology.
