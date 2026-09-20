# Documentation cleanup — 2026-09-17

The user endorsed the screenshot-led, direct implementation workflow used for Ashen Reach and subsequent motion/spell work, then explicitly requested removal of older plans, logs, skills and docs that contradict it. This was a documentation cleanup; it did not implement a new game feature.

## Current entry points

- [CURRENT.md](../CURRENT.md): active route, accepted reference, runtime facts, controls, measured evidence and unfinished scope.
- [Workflow retrospective](reference-led-workflow-2026-09-17.md): the observed turning point, reusable method and concrete corrections from the accepted sequence.
- [Dream Loop](../../.agents/skills/dream-loop/SKILL.md): direct implementation, reuse, real play, visual review and focused correction.
- [Documentation map](../README.md): current implementation and still-useful technical references.

Root/game READMEs, local `AGENTS.md`, browser/capture guidance and skill entry points now route to this direction. Ashen Reach is the only playable game; the character lab and body preview remain development tools.

## Removed

- The old `.agents/plans/` and `docs/handoffs/` trees: superseded character/environment milestone queues, worker prompts, correction briefs and judge results.
- Rejected retro-POC/waystation plans, obsolete mage/jump implementation queues, superseded research/diagnosis plans and old orchestration/session learning logs.
- Old Dream Loop subscription-tier workflows, compulsory generation/asset-service instructions and their specialized helper scripts.
- The score-driven gauntlet skill and obsolete Classic Babylon reference. Dream Loop no longer requires Grok-only implementation, model changes or repeated numerical judging.
- Obsolete Dream Loop text/worker logs and rejected-POC cache transcripts. Older prose benchmark reports no longer guide acceptance of the active game.
- Historical snapshots created at the beginning of this cleanup. The user's later instruction was to delete incompatible guidance: **no replacement archive was kept**.

## Retained and corrected

Keep the accepted scene, gait, Fire Blast and Lava Ball reports, plus source-motion recovery and animation reuse details. These dated reports describe particular passes; current state lives in `CURRENT.md`.

Keep valid skin-bind/composition contracts, body validation and Human/Orc/Undead source/license provenance. Remove their stale “next milestone” queues and distinguish original race exports from the current source-compatible Human. Long-term race/equipment goals remain, without the obsolete art target or milestone order.

Blender export instructions remain only for explicitly requested legacy shrine work. Babylon guidance now describes Lite/WebGPU. Grok delegation and Grok Imagine remain optional tools; direct parent implementation is the default, and a selected Grok worker uses the user's latest high-effort preference subject to the installed CLI.

Runtime code, authoring sources, assets, licenses and the current published Graveweaver walkthrough were preserved. Superseded local screenshots, raw frame sequences, browser sessions, POC exports and old capture JSON were removed; the current front still and downloaded latest walkthrough remain under the ignored `ve-capture/ashen-reach/graveweaver/` directory for immediate review. Published historical walkthrough URLs remain in the relevant reports. Existing unrelated checkout changes and Git metadata/index were left intact.

The repository now ignores `ve-capture/`, `.shots/`, `.playwright-mcp/`, Blender backup files and generated retro/grounded POC exports. Source Blender files under `blender/characters/` and shipped runtime assets under `public/ashen-reach/` remain tracked candidates.

The old playable Moonwell route was subsequently removed. `index.html`, `src/main.js`, the old `src/world/` and legacy spell/equipment stack, old Moonwell scene assets, and their obsolete authoring/capture scripts are no longer part of the Vite build. Ashen Reach is now the only playable route; `character-lab.html` and `body-preview.html` are explicitly retained as development tools.

## Verification

Validated all five retained skills with the skill-creator validator and checked Dream Loop UI metadata as YAML. Scanned 39 retained Markdown files: no broken local Markdown links and no remaining references to deleted document names. Reviewed workflow-mandate matches: references to former Grok-only, subscription-tier and numerical judge policies explicitly mark them as superseded. Removed stale defaults and milestone queues from retained technical instructions. This is documentation-only; no new game build or gameplay-test result is claimed by this cleanup.

On future resumes, begin with `CURRENT.md` and the latest user request. Add a short result report only when it provides durable evidence or operational knowledge. Update the current entry point when behavior changes; remove superseded instructions rather than accumulating competing plans.
