# Documentation map

Start with **[CURRENT.md](CURRENT.md)** for the live route, accepted direction, current controls and unfinished scope.

## Active references

Living docs: actively edited, describe current pipelines/plans, and are the ones to update when behavior changes.

- [Armory and equipment living plan](armory-and-equipment-plan.md): current implementation initiative and completion criteria.
- [Equipment authoring](ashen-equipment-authoring.md): first fitted Human garments, provenance, rebuild commands and attachment learnings.
- [Orc sculpt pipeline](orc-sculpt-pipeline.md): print-sculpt retopo, bind and the [garment fitter's stages/acceptance measures](orc-sculpt-pipeline.md#clothing-fit).
- [Armed character repair plan](armed-character-repair-plan.md): paused Human armed-pose/two-handed plan; resume when Orc work is not the current request.
- [Character architecture](character-system-north-star.md): long-term race/equipment contracts; historical milestone order is not a work queue.
- [Browser, play and capture](debug-view.md).

## Completed reports

**[docs/complete/](complete/)** holds closed, dated reports and provenance records: evidence of a specific finished pass, not actively edited, kept for lineage. Consult them for a specific implementation's rationale, not as a task queue.

- [Direct scene/reference implementation](complete/ashen-reach-direct-pass-2026-09-17.md)
- [Character asset provenance](complete/character-asset-provenance.md): Human/Orc/Undead source-body and mannequin lineage, license and validator record.
- [Live state review, 2026-09-18](complete/current-state-review-2026-09-18.md): baseline the armed repair plan was created from.
- [Documentation cleanup audit, 2026-09-17](complete/documentation-cleanup-2026-09-17.md): what was removed vs. retained in an earlier pass.
- [Fire Blast body motion](complete/fire-blast-body-animation-2026-09-17.md)
- [Gait/contact and landing](complete/gait-contact-and-landing-2026-09-17.md)
- [Lava Ball implementation](complete/lava-ball-first-spell-2026-09-17.md)
- [Reference-led workflow retrospective](complete/reference-led-workflow-2026-09-17.md): evidence behind the current parent-implements-and-reviews workflow.
- [Source-motion recovery implementation](complete/source-motion-recovery-implementation-2026-09-17.md): the source-compatible Human retarget.

## Documentation policy

Retained dated reports describe an endorsed pass or still-valid technical provenance. Their status notices distinguish that pass from current runtime behavior; read [CURRENT.md](CURRENT.md) for what is live now. Conflicting old plans, rejected-POC briefs, judge logs and superseded pass reports have been removed, not archived — the [cleanup audit](complete/documentation-cleanup-2026-09-17.md) records what was removed and retained at that time.

A doc moves from `docs/` into `docs/complete/` once it is a closed, non-edited milestone record rather than a plan someone is still executing against. Moving a report does not mean the code/assets it describes are dead — check `docs/complete/character-asset-provenance.md` before assuming the source bodies it documents are unused, for example. Do not rebuild a historical task queue or recursively load every report to resume a focused task.

Local `ve-capture/`, browser session files and Blender POC exports are ignored working evidence. Keep only the current pass locally when reviewing it; published walkthroughs are linked from the living reports.

The local Dream Loop skill is an ignored nested checkout. The tracked [endorsed workflow](complete/reference-led-workflow-2026-09-17.md) is the fallback for a fresh clone without that skill.
