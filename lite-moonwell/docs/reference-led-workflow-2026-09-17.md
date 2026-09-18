# The workflow the user wants to preserve

Recorded 2026-09-17. The user identified the turning point as **around 9:55am today**, when they said the game still looked like the existing game, supplied exact gameplay screenshots, and requested direct implementation. That approximate time is the user's recollection, not a reconstructed timestamp audit. They explicitly praised the resulting scene match and every subsequent iteration through Lava Ball, and asked us to preserve the method and remove misleading older guidance.

The conclusion is a workflow preference supported by this sequence, not a controlled comparison proving that one model or tool is universally superior.

## What changed at the turning point

Earlier work included broad armor/race infrastructure, repeated Grok implementation/judge rounds, five retro POCs and a grounded waystation. There were useful technical results, but the user rejected the visual proposals: they retained too much of the old game's silhouettes, materials and overall appearance. More detail and new labels did not produce the requested aesthetic.

The correction supplied a concrete visual target and explicitly permitted discarding existing design. The parent implemented a separate **live Ashen Reach scene** against the nighttime Sword Hero churchyard screenshot. It changed the composition, foliage artwork, texture presentation, lighting/sky treatment and silhouettes, while reusing input, Havok movement and compatible source-rig animation. The other supplied screenshots informed the broader style; they were not all built as scenes.

The distinction mattered: **keep useful systems, not inherited visual decisions**. Reuse is a technical tool, not an obligation to preserve a rejected look. The successful pass used a pragmatic mix of existing licensed materials, newly generated foliage/grave textures, procedural low-poly scenery and custom WGSL. It did not require a new engine or a mandatory Blender/image-to-3D pipeline.

## The repeatable working loop

### 1. Convert the request into one visible outcome

Inspect the actual reference and current game. State the main gap in concrete terms: the camera is too high, the scene still inherits the old meadow, the cast only moves an arm, the explosion reads too weakly. Pick a focused deliverable with a natural review point.

For a new art direction, match large-scale composition, spatial hierarchy, silhouettes, palette, texture density and atmosphere before fine details. For an approved scene, preserve its visual language while improving the requested behavior. Do not regenerate the target merely because a generic workflow says to.

### 2. Inspect and reuse before writing a replacement

Read the relevant runtime and asset data. Look at installed API declarations/implementation when exact behavior matters. Research official/upstream tools or licensed assets if there is a concrete missing capability. Audition candidates on the actual skinned character, not just by animation name or a third-party thumbnail.

Stop research when a viable approach is supported. Examples from this stretch:

- Existing Quaternius source animation and the native Lite mixer beat further procedural gait invention.
- A vendored MIT retargeter supplied useful directional rotations; inspecting parent transforms identified our centimetre/metre translation error. Fixing the adapter was preferable to writing another retarget solver.
- Native Lite billboards, sockets and audio already solved much of the spell presentation. Existing Havok raycasts handled occlusion and projectile segments.
- The basic spell clip had little torso motion. Auditioning `Punch_Cross` exposed useful weight transfer; an offline, documented adaptation produced a stronger open-hand cast.

Reuse includes adapting existing work where needed; it does not mean forcing an incompatible skeleton, mesh or library into the game.

### 3. Implement a complete playable slice directly

The parent keeps visual intent, technical decisions and review in one short feedback loop. Direct implementation is now the default for this work. Delegation is still available when the user requests it or an authorized independent task has clear value; it is not forbidden and not a mandatory ceremony.

Make supporting architecture changes only as needed for the visible result. Preserve controls, source skeleton/binds, compatible authored curves and working infrastructure. Replace old scene/art code when the reference demands it. Keep edits and ownership clear in the dirty live checkout.

For spells, implement the whole interaction: eligibility, gesture, anticipation, release, travel if any, collision/damage, sound, effects, UI, interruption and recovery. A beautiful particle screenshot with incorrect damage timing is not the requested experience.

### 4. Play and review the actual result

Use owned Chrome/Playwright/CDP and real keyboard/button input. Check walking, turning, jumping and casting as relevant. Treat a fixed reference camera or lab view as diagnostic, then return to third-person play.

Capture video for temporal work. Review representative frames through anticipation, action and recovery; use a second angle when it exposes body mechanics or projectile travel. Keep the target on screen when judging impact. Record the real engine audio and DOM HUD; a canvas-only stream omits combat UI.

Name observed problems precisely. A green test suite cannot tell whether a spell feels powerful. Do not call staged poses, Blender renders or generated images live gameplay evidence.

### 5. Correct the largest remaining defect, then verify

The Lava Ball review is the clearest example: gameplay worked and tests passed, but the first video showed an impact too similar to Fire Blast. The correction enlarged the burst, added a ground-level flame ring using unused pool slots, and moved flame licks outside the opaque core. It then received another live review and performance measurement, including overlapping effects.

Other real corrections included a sky clipping band, excessive third-person foliage cost, too-small directional pelvis motion, auto-facing incorrectly suppressing a stationary cast stance, and missing synchronization between gesture and damage/audio.

Use tests for meaningful behavior and fragile contracts: source motion/bind preservation, one release/hit, no side effects on rejected casts, interrupted charges, mixed-spell cooldown/health behavior, and actual collision. Build the product. Measure frame times separately from recording, reporting render resolution and limitations. Stop expanding tests once relevant checks pass unless a new change or concern warrants more.

### 6. Deliver evidence and durable context

Send reviewed video/stills to the already-authorized Telegram conversation with a short caption describing controls, changed behavior and material caveats. Poll at sensible boundaries while active; do not promise an idle inbox watcher.

Document the final implementation, exact source/license/derivation, reproduction commands, observed validation and remaining boundaries. Distinguish “user likes the direction” from “all milestones complete.” Keep the current index brief; historical failures belong in scoped reports rather than accumulating as contradictory mandates in active skills.

## Evidence from the endorsed sequence

| Pass | Why it mattered | Record |
| --- | --- | --- |
| Ashen Reach reset | Replaced the old look against exact gameplay references; retained useful movement/animation infrastructure. The first third-person FPS result failed the target and was improved before delivery. | [Direct scene pass](ashen-reach-direct-pass-2026-09-17.md), `ve-capture/ashen-reach/reference.png`, `third-person.png`; Telegram 528–529. |
| Authored motion and gait | Reused compatible source motion, corrected translation units, synchronized gait contacts and lightened landing blending. | [Gait/contact](gait-contact-and-landing-2026-09-17.md), [source-motion recovery](source-motion-recovery-implementation-2026-09-17.md). |
| Fire Blast feedback | Joined target validation, pooled effects, actual sound, dummy recoil and Havok obstruction checks into a working interaction. | [Fire Blast body motion](fire-blast-body-animation-2026-09-17.md); Telegram 537–538. |
| Fire Blast body motion | Auditioned existing animation, adapted a full-body strike, and synchronized a .28s wind-up with damage/sound/fire. | [Body motion](fire-blast-body-animation-2026-09-17.md); Telegram 539–540. |
| Lava Ball | Added a 1.5s charge, fixed projectile flight, impact damage and coordinated cancellation; corrected visual weakness after reviewing video. | [Lava Ball](lava-ball-first-spell-2026-09-17.md); Telegram 541–542. |

Latest reported delivery evidence: 98 automated checks, 49 browser checks, build passing, roughly 144 FPS at **960×540** including overlapping effects. These are dated observations, not permanent guarantees or native-resolution performance claims. The visual/user feedback and the measured results support different conclusions; retain both.

## Behaviors to avoid returning to

- Treating “low poly” or “retro” as sufficient direction while ignoring exact silhouettes, palette and composition.
- Preserving rejected assets/design simply because they already exist.
- Broad research, concept batches, model switches or delegate/judge ceremonies before the next observable improvement.
- Replacing a capable library/controller/mixer without first inspecting and testing it.
- Promoting precise-looking plans, worker prose or validator counts to evidence of visual quality.
- Repeatedly polishing small artifacts while the main silhouette, motion or scene remains wrong.
- Claiming a reference was matched identically, all races/armor systems are done, or local FPS proves MMO readiness.

## How this was made discoverable

[CURRENT.md](CURRENT.md) owns current product facts. [Dream Loop](../../.agents/skills/dream-loop/SKILL.md) owns the repeatable process. [The docs index](README.md), the product README, local AGENTS entry and skill routing point there. Following the user's stronger cleanup instruction, conflicting milestone plans, rejected POC briefs, handoffs, judge/session logs and obsolete skill variants were removed outright. No replacement archive of those instructions is retained. Useful technical contracts and source/license provenance remain in focused current documents. See [cleanup audit](documentation-cleanup-2026-09-17.md).
