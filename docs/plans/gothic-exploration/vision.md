# Ashen Reach long term game vision

Updated 2026-10-09. The immediate direction is **a Gothic region worth exploring**.
Build a complete, memorable expedition in the existing region, then expand its
replay value and shared play. The [next 24 hours](next-24-hours-2026-10-09.md) turn
that direction into executable work. [CURRENT](../../CURRENT.md) owns actual
implementation and production status.

## The player experience

A wanderer enters a ruined borderland, spots Vaelmark above the valley, and sets
out because the place suggests something worth finding. Roads, silhouettes,
light and sound help the player navigate. Buildings have believable interiors,
vertical routes, discoveries and consequences. A bell rung high above the nave
changes what can be found below. Returning to Hollowmere feels like finishing
an expedition rather than reaching the end of a geometry tour.

The long-term game combines that exploration with readable action combat,
recognizable custom characters and cooperative adventures. Its first region
must earn expansion through depth, performance and repeatable content creation.
The next day concentrates on exploration; combat expansion and public
multiplayer follow later.

## Product principles

1. **Places need purpose.** Important destinations offer an interaction,
   discovery, encounter or consequential view, plus a clear return route.
2. **Architecture teaches navigation.** Preserve the approved Gothic massing,
   cliff masonry, pointed recesses and restrained warm light. Help and maps
   support the space; ordinary play must remain understandable without dev tools.
3. **Actions have visible consequences.** Players hear a bell, see a reliquary
   respond and retain a discovery. Completion cannot exist only in a debug flag.
4. **Performance is part of the experience.** Keep the completed, dressed,
   grounded starting frame within the established one-second release contract.
   Target at least 144 FPS at 1280×720 under the documented desktop conditions,
   with a required floor above 120 FPS and explicit frame-time tails.
5. **Depth precedes area.** Finish the finite region before terrain streaming,
   another continent or a large new asset library.
6. **Content should become cheaper to add.** Small authored descriptors reuse
   interactions, routes, materials, compatible animation and asset publication.
   Build an abstraction when a second real use demonstrates the common part.
7. **Scale follows measured capacity.** A local presence proof is useful;
   thousands of nearby players require independently measured rendering,
   network interest and server budgets. It is not a promise to draw every actor
   at full detail.

## What already exists

G01–G08 provide the undercroft, improved approach, connected regional circuit,
region map, Eastwatch wall walk and balcony, cathedral guide and loading status.
The chapels, gallery, both bell stairs and exterior parapet also already exist.
Physical-core loading is the qualified desktop-preview default. Rebuilding
these features would not advance this vision.

The current combat loop includes shades, spells, experience and a repeatable
watchman objective. Saved appearance, mixed equipment and a local multiplayer
presence implementation are existing foundations with their recorded limits.
The new expedition needs its own persistent discovery state and interactions;
the current watchman objective is not a general quest engine.

Production remains an older qualified release while startup completion and a
historical required-texture failure remain unresolved. See the evidence and
release rules in the [24-hour plan](next-24-hours-2026-10-09.md#release-decision).

## Capability horizons

These are ordered outcomes, not calendar promises or a second autonomous queue.
Reassess after each playable horizon. The existing
[100-milestone character and MMO roadmap](../character-mmo/vision-roadmap.md)
remains the detailed capability inventory for identity, wardrobe and scale;
its old next-action prose does not override CURRENT.

| Horizon | Major outcomes | Acceptance before expansion |
| --- | --- | --- |
| 1. The Vaelmark expedition | Discover the undercroft inscription; climb and ring the west bell; reveal and claim a memorial relic; return with saved knowledge. Improve the route's readability. | A fresh player can complete and revisit the entire loop with ordinary controls, no recovery teleports, visible feedback and reliable persistence. This is the next-day core. |
| 2. A region with distinct destinations | Eastwatch provides a lookout and dispatch; Hollowmere resolves the expedition; Westwatch and Southwatch earn distinct exploration beats; towers become useful observations, not duplicate checklists. | Each destination has a recognizable purpose, route and return. A 30–45 minute regional session is a design target to playtest, not a current duration claim. |
| 3. Stronger adventure and combat | Improve existing enemy tells and reactions; give one regional encounter meaningful positioning; introduce a bounded reward choice; develop one replayable expedition variant. | Defeat, retreat and retry are understandable; traversal and current controls remain reliable; rewards cannot be repeatedly duplicated. Use current compatible character motion before commissioning more. |
| 4. Character identity and equipment production | Finish accepted Human identity/fit limits; close mixed-outfit defects; normalize Undead/Orc compatibility; prove a licensed Elf family; rehearse five contrasting production sets. | Appearance survives movement, equipment changes and saves with reviewed motion. A new item follows the existing factory without whole-outfit exception code. The 30-set launch and quarterly tiers remain later production goals. |
| 5. Shared expeditions | Reassess the existing authoritative presence slice; qualify a public host; add party-aware interaction ownership and saved progression; synchronize one cooperative expedition and encounter. | Server validates entitlement and progression; disconnect/reconnect and simultaneous interaction are correct; local-only discoveries are explicitly imported or reset by a documented policy. |
| 6. A busy social hub | Integrate measured character detail priorities, shared resources, bounded nameplates/effects, interest management and admission limits. | Publish real device/population capacity curves and long-session memory results. Increase admitted population only after rendering and service budgets pass. |
| 7. Sustainable content releases | Standardize a destination kit, encounter kit and equipment release; produce another adventure within the existing region; then assess region expansion. | A second piece of content reuses the tools with lower measured authoring effort, predictable patch size and a rehearsed rollback. |
| 8. Release quality across devices | Resolve the deferred iPhone device-loss sequence; define honest desktop/mobile quality tiers; run endurance and real-player trials; establish minimal operational diagnostics. | Supported hardware passes actual-device startup, play, recovery and memory checks. Desktop emulation never substitutes for physical iPhone acceptance. |

Horizon 8 contains cross-cutting quality work that can be pulled forward when
the user changes device priority. Mobile is explicitly deferred for this window.

## Technical direction

Keep Babylon Lite 1.31.1/WebGPU, Havok movement, the current camera, native source
animation and the prepared-world pipeline. Reuse the landmark registry and
cathedral metadata as the source of spatial truth. New discoveries attach stable
content IDs to those locations; they do not create another navigation graph.

For this first expedition, persist a small versioned, local browser record of
discovered entries and completed interactions. Cosmetic journal recognition is
the reward. It does not grant equipment ownership, combat stats or multiplayer
authority. Preserve unknown records and report session-only operation when
storage fails. Later server progression can consume explicit domain events
without inheriting a promise that browser saves are trusted.

Continue to load optional content after first play. Reuse two local shadow slots,
the established world shaders and the deferred native audio owner. New bells
and relics should require a few reusable meshes, not a new lighting renderer,
physics system or cutscene framework.

Native capability decisions need links beside the corresponding implementation.
For example, Lite's [async compilation module](https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/docs/lite/architecture/53-async-shader-pipeline-compilation.md)
prepares ShaderMaterial pipelines; it does not cover PBR, post-process or all
other pipelines. Its existence alone does not establish a startup fix.

## Visual direction and retained references

Use the user's original images in
`ve-capture/ashen-reach/gothic-world/references/`: `02-cliff-cathedral.png`,
`03-fortified-entrance.png`, and `04-arch-vista.png`. Preserve their exact files.
They guide architectural hierarchy and atmosphere; they are not textures or
backdrops to ship. If the ignored folder is missing in a fresh checkout, use the
linked reviewed G01/G02 evidence from CURRENT as an interim baseline and record
the missing original. Do not silently invent a replacement reference.

Assess bridge approach, nave, undercroft descent, memorial, bell landing,
gallery and exterior silhouette from the ordinary camera. Fix a specific visible
gap per pass. Existing captures establish history; new changes require reviewed
live motion before acceptance.

## How progress is judged

Count complete playable experiences, useful destinations and defects removed.
Record the public build a player can actually use, known release holds, clean
traversal outcomes, saved progress, measured frame tails and reviewed video.
Test counts, screenshots and document volume are supporting evidence rather than
the outcome. At the end of each execution window, choose the next work from
what materially improves the game and from actual player feedback.
