# Character/MMO planning review and disposition — 2026-09-27

Scope: documentation and implementation readiness of M001–M003, the next ten and 100-milestone vision. No runtime experiment was performed. A separate Grok CLI session using **grok-4.6, high effort**, read the plans and selected installed Lite/game sources. The parent checked its conclusions against source and revised the plans. The reviewer did not re-review the final revision; readiness of the corrected briefs is the parent's assessment.

The first CLI pass hit its 18-turn limit without a verdict; the same session was resumed with an eight-turn report-only scope and completed. Both processes ended. No review browser, game server or subagent child was started. Raw local review output is ignored under `.dream-loop/character-mmo-planning-2026-09-27/`.

| Finding | Disposition and resulting change |
| --- | --- |
| Native VAT is not an arbitrary unique-body/outfit crowd renderer | Accepted. M003 explicitly defines compatible piece batches, a project-owned actor-to-batch index map and no per-instance slender/stout claim. |
| Converting shared-palette equipment can release another mesh's live skeleton resources | Accepted and confirmed in installed `vat-baker.js`. M003 requires separate probe-owned containers and real compatible mixer bindings; no copied skeleton metadata or manual reference-counter edits. The review's suggested manual skeleton sharing was not adopted as a safe recipe. |
| VAT color correctness does not establish shadow/socket correctness | Accepted as a verification risk. The reviewer did not fully trace shadow composition, so unsupported VAT shadows are not asserted as fact. A one-actor moving-shadow/prop comparison gates enrollment and shadow-on capacity claims. |
| M003 was too broad as one uninterrupted implementation | Accepted. Added M003a correctness/ownership, M003b repeated-outfit capacity, M003c bounded mixed-outfit proof; each can produce a reproducible blocker with measured fallback. M009 retains final renderer work. |
| Measurement prose alone does not prevent extra renderers/default URLs | Accepted. M001 now requires explicit target/owned-port preflight and cleanup, wrapping helpers if needed. Added the actual raw-interval preservation gap and Pages build mode to the brief. |
| Historical cold reference was necessarily headed Chrome | Not established. Current helper explicitly launches headless Chrome. Plan requires recording actual mode and matching historical commands/artifacts; it does not silently switch to headed based on the review's inference. |
| Diagnostic body profiles could be mistaken for shipped capabilities | Accepted. M002 uses explicit `fitFamily = FITS_BY_RACE[race].body`; source manifest profile IDs remain separate metadata. Elf and unsupported morph/age/hair controls are not v1 capabilities. |
| Census needs real coverage/bind identity and source readiness | Accepted. Added semantic compatibility components, resolved coverage effects and a Human/hair/age/Elf source-readiness table. Missing future art gates later milestones, not current-asset inspection. An intentional no-hair coverage no-op on Undead is not automatically a defect. |

Result: M001 and M002 have bounded code/data deliverables; M003 has sequential correctness and measurement gates rather than requiring a finished crowd framework. Implementation remains unstarted and capacity/art quality unproven. See [next ten](../plans/character-mmo/next-ten.md) and [the detailed briefs](../README.md).
