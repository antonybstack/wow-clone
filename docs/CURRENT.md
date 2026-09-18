# Current direction — Ashen Reach

Updated 2026-09-17 after the user explicitly endorsed the reference-led implementation workflow and recent output. This is the entry point for resuming work. Dated reports are evidence of particular passes; conflicting older roadmaps, handoffs and logs have been removed rather than retained as a task queue.

## Product and visual target

The only playable game route is **Ashen Reach**, `ashen-reach.html`, in the repository root (Vite **5173**). Open `http://127.0.0.1:5173/ashen-reach.html?play&clean`. `character-lab.html` and `body-preview.html` are retained development tools; they are not game routes or the current scene/art target.

The visual direction is the user's concrete **Sword Hero gameplay screenshots**: gritty, low-poly, visibly textured 3D; selective darkness and warm lamps/fire; overgrown ground; strong Gothic silhouettes and atmospheric scale. The implemented scene targets the **night churchyard**. The green fortress/meadow and burning dragon images inform style; those environments are not implemented.

The user rejected the earlier five retro Blender POCs and grounded waystation because they still looked like the old game. Those generated POCs and local captures have been removed. Do not resume those candidates, the old valley/citadel roadmap, or photorealistic material polish by default. World of Warcraft remains a locomotion/control and long-term character-system reference; Elden Ring's earlier fidelity wording does not override the accepted screenshot-led art direction.

References and exact source URLs: [direct scene implementation](ashen-reach-direct-pass-2026-09-17.md). Local working images: `.dream-loop/sword-reference/target.png`, `demo4.jpg`, `demo10.jpg`, `demo2.jpg`. These are ignored working references; recover from the documented URLs/user attachments if absent. Reference pixels are not shipped game assets.

## Workflow to continue

Use [Dream Loop](../.agents/skills/dream-loop/SKILL.md): **inspect → bounded reuse/research → direct implementation → real play → screenshot/video review → specific correction → verification and delivery**.

The parent implements and reviews by default. Grok delegation is an optional tool when requested or useful within current authorization; the former Grok-only and subscription-tier mandates are superseded. Read the [workflow retrospective](reference-led-workflow-2026-09-17.md) for the evidence behind this choice.

Choose one consequential deliverable from the latest user request. The next tracked deliverable is the catalogue architecture pass in [the armory plan](armory-and-equipment-plan.md): explicit fit/occupancy contracts, bounded on-demand item loading and swap failure recovery, followed by the first distinct Orc fit. Preserve approved work, but replace design/code that contradicts a new explicit target. Do not pursue old milestone lists, build generalized infrastructure ahead of a convincing playable slice, or confuse passing tests with visual acceptance.

## Active initiative

[Armory and modular equipment living plan](armory-and-equipment-plan.md) is active. **C / Armory** opens the actual Human for orbit/zoom, animation preview and all seven equipment slots. Wayfarer, Pilgrim and **Graveweaver** outfit buttons support immediate selection and individual mixed pieces. The new original Ahrim-inspired magic set has a hood, mail vestment with amethyst clasp, long robe skirt, gloves, forked staff and grimoire; boots are shared. Selections remain equipped on return to play, and both held props stow during casts. Human is the only enabled race. Stage C remains open for general fit contracts and on-demand catalogue composition; then Stage D proves a distinct Orc with corrected fits. [Equipment authoring and limitations](ashen-equipment-authoring.md).

## Current implementation

| Area | Current facts and source |
| --- | --- |
| Engine | `@babylonjs/lite`, WebGPU; Vite 5173. No `@babylonjs/core`/Classic runtime APIs. |
| Scene | `src/ashen-reach/{main,scene,geometry,materials}.js`; standalone churchyard with new composition and foliage, textured diffuse WGSL surfaces, fog, lamps, wind and cloud motion. |
| Character | `public/ashen-reach/wanderer-equipment.glb`, source-compatible Human, original 65-joint bind/54 clips; fitted CC0 mail/cloth/magic garments, trousers, boots, hood and gloves, plus evaluated sword/staff/book attachments. Unequipping restores base appearance. |
| Motion | Shared `src/character/body.js`, native Lite mixer; 45 original clips retained, five authored directional imports, two Fire Blast layers, two Lava Ball layers: **54 clips**. [Gait/contact report](gait-contact-and-landing-2026-09-17.md). |
| Physics/input | Existing Havok controller and WoW controls: W/S, A/D turn, Q/E strafe, RMB look, Shift walk, Space jump. Physics owns movement; animation presents it. |
| Fire Blast | **1**; .28s wind-up, 120 damage, 20m range, 3s cooldown at release. Moving casts supported. [Body motion](fire-blast-body-animation-2026-09-17.md). |
| Lava Ball | **2**; 1.5s stationary charge, 240 impact damage, 24m range, 6s cooldown at release, 12m/s fixed flight. Movement/jump interrupts charge. [Implementation](lava-ball-first-spell-2026-09-17.md). |
| Target/combat | Tab selects the 600 HP training dummy; Escape clears target. Dummy recovers three seconds after defeat. Local prototype state, no backend authority. |
| Effects/audio | Native Lite pooled billboards, shader/point lights, skinned hand sockets, licensed Kenney sprites and Julien Matthey audio. Damage, gesture, release, sound and impact are coordinated. |

Do not assume key 2 is a held channel in normal Ashen play; that is an older diagnostic behavior available under `?animationLab`.

## Evidence and operational pointers

- Latest equipment validation: **29 automated tests**, **19 Graveweaver browser checks**; production build passing. The earlier Lava Ball delivery recorded 98 automated and 49 browser checks. These are pass-specific counts; rerun relevant checks after subsequent changes.
- Latest performance: roughly **144 FPS at 960×540**, foreground local Chrome, equipped character in gameplay and running armory; max 50 draws with the complete hood/robe/staff/book outfit in these short samples. This is not native-resolution, many-caster or MMO-scale proof. The **>120 FPS goal** remains.
- Evidence: the ignored local `ve-capture/ashen-reach/graveweaver/` directory contains the current front still and walkthrough when available. Latest reviewed gameplay video: [Graveweaver magic equipment walkthrough](https://ve.sparkify.dev/wow-clone/ashen-reach/graveweaver/2026-09-17-graveweaver-v1.mp4) (all slots, mixed swaps, motion, Fire Blast and Lava Ball). Older raw captures were removed during cleanup.
- Browser debug global: **`ASHEN`**, readiness `ASHEN.ready`. Recent owned Chrome uses **CDP 9337**; verify the live target before controlling it. Leave unrelated user Chrome/9222 alone. [Browser/capture guide](debug-view.md).
- Telegram progression media is authorized in this session. Read the local Telegram skill/helper when sending; keep credentials out of docs. Poll at sensible active-work boundaries; no monitoring persists after an ended turn.
- Work from the live checkout and inspect new code on resume. Do not reset, clean, stash or discard unrelated user/agent work. Blender MCP 9876 is not a prerequisite for every change and the live shrine must not be cleared to author an unrelated asset.

## Still open, not a task queue

Character anatomy/clothing quality, terrain-aware foot contact, full Human/Orc/Undead migration and modular armor, moving enemies/encounters, richer world dressing, and broader performance validation remain unfinished. Long-term race/equipment contracts are in [the character architecture roadmap](character-system-north-star.md), which now retains contracts and goals without the obsolete milestone queue/art targets.

Progression and SpacetimeDB integration remain out of scope until the client slice is ready. User approval of this workflow and the recent output is not a claim that the game is pixel-identical to the reference, AAA complete, or that every long-term milestone passed.
