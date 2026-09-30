# Documentation map

Start with **[CURRENT.md](CURRENT.md)** for the shipped game and current initiative.

## Active plan

- **[Long-term vision: 100 milestones, ten categories](plans/character-mmo/vision-roadmap.md)**
- **[Next ten milestones](plans/character-mmo/next-ten.md)**
- **[Current-state review and changed priorities — 2026-09-29](reviews/current-state-priorities-2026-09-29.md)**
- **Completed proof briefs and reusable tooling:** [M001 — baseline/assets](plans/character-mmo/m001-baseline-and-asset-census.md), [M002 — appearance contract](plans/character-mmo/m002-appearance-contract.md), [M003 — crowd feasibility](plans/character-mmo/m003-crowd-feasibility.md), [M004 — Human template](plans/character-mmo/m004-human-template.md), [M005 — deformation proof](plans/character-mmo/m005-deformation-proof.md)
- [Execution contract and performance gates](plans/character-mmo/execution-contract.md)
- [Architecture decisions, capability checks and research](plans/character-mmo/architecture.md)

M001–M005 are completed proof work; M006's creator surface and M007's representative fit evidence exist, with production customization and source-art gaps still open. The active next-ten plan supersedes the original execution order, with detailed work packages and handoffs for its first three milestones. These ten are planned, not implemented. Earlier briefs remain evidence and reusable instructions; historical IDs are not a second task queue.

## Operating and authoring references

- [Character contracts](character-system-north-star.md)
- [Equipment source/authoring history and current runtime boundary](ashen-equipment-authoring.md)
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
