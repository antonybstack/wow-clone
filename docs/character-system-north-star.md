# Character contracts and long-term direction

Current product and workflow: [CURRENT.md](CURRENT.md). This document retains the useful architecture goals; the earlier mage/photorealistic target, numbered milestone queue and mandatory Grok judge loops have been removed.

## Current playable foundation

Ashen Reach uses `public/ashen-reach/wanderer.glb`: a MakeHuman-derived Human fitted to the original 65-joint source-compatible rig. All 45 source clips remain, alongside five directional imports and four spell layers. Native Lite animation presents movement; Havok owns movement, heading and grounded/jump state. Do not resume procedural gait replacement as the baseline.

The surface-defined outfit is a stand-in. This is not proof of production clothing, a complete character creator or a scalable armor catalogue. Existing Human/Orc/Undead assets on the old 163-joint bind are not interchangeable with the source-compatible Human simply because joint names look similar.

## Long-term goal

Support distinct Human, Orc and Undead proportions, character appearance choices, and hundreds to thousands of armor/weapon combinations. Preserve readable silhouettes, smooth authored motion and the current screenshot-led visual style. WoW remains a reference for controls and equipment usability; the user's accepted Sword Hero imagery governs current art direction.

Prove a convincing equipped character in real gameplay before expanding the full combinatorial system. Future work should follow the user's chosen deliverable, not a historical milestone number. Backend/progression integration remains outside the current slice.

## Contracts worth preserving

- One evaluated character pose drives the body and all compatible skinned garments. A garment must share the correct rig/bind contract; copying another container's skeleton object is not binding.
- **Skinned garments:** torso clothing, trousers, soft boots/gloves, robes and capes need compatible skinning/deformation. Do not parent an entire robe to a torso socket.
- **Rigid equipment:** weapons, shields and suitable hard attachments use evaluated sockets. Bone scene nodes may remain at rest in Lite; use the existing evaluated skin/socket path.
- Body/race proportions require corresponding fitted meshes/garments and compatible animation, not a universal scalar applied to every item. Reuse compatible rig families and authored fit variants where practical; do not pretend one literal bind fits every race.
- Compatibility is joint order, rest hierarchy, inverse binds, mesh transforms and fit geometry—not names, clip count or whole-file hash alone. Animation-only additions may change file hashes without changing garment fit compatibility.
- Keep license/source lineage and reproducible derivations. Preserve source animation curves, units and bind transforms; introduce explicit profile/fit versions when those contracts change.
- Use native Lite animation and upstream tools. Compare the actual mesh through walk/run/turn/jump/cast/recovery, including transitions; finite joint arrays alone cannot establish convincing motion or ground contact.
- When changing loadouts, preserve visual ownership, socket bindings, pose continuity and scene registration. First prove one visible transition; expand coverage only when that path works. Do not build a generalized framework before a playable outfit.
- Keep the >120 FPS goal with honest measurement conditions. Single-body local samples do not prove crowd, native-resolution or all-race performance.

## Technical references

- [Character asset provenance](complete/character-asset-provenance.md): mannequin/rig/clip lineage, body validation, and Human/Orc/Undead source-asset license records, not current gameplay defaults.
- [Source-compatible Human](complete/source-motion-recovery-implementation-2026-09-17.md): fitted Human using original authored curves; the older root-route comparison is diagnostic.
- [Gait/contact](complete/gait-contact-and-landing-2026-09-17.md): centimetre-parent conversion, contact phase and landing layers.
- The former composition-adapter experiment was removed with the old Moonwell route; current equipment contracts live in [the armory plan](armory-and-equipment-plan.md) and [equipment authoring](ashen-equipment-authoring.md).
- [Fire Blast motion](complete/fire-blast-body-animation-2026-09-17.md): current cast profile and release behavior. Lava Ball behavior is documented in [CURRENT.md](CURRENT.md).
