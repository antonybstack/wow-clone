# Long-term character system (Lite MMO paper doll)

**North star:** World of Warcraft’s model: **one humanoid skeleton**, a **clip library**, **slot attachments** (head / shoulders / chest / back / hands / legs / feet / mainHand / offHand), and **appearance params** (height, skin). Hundreds of combinations = more item GLBs, not more generated bodies.

**Now:** Mixamo `base.glb` + Lite `enableBoneControl` + Idle/Walk/Sprint/Jump/Spell + item GLBs on sockets (primitive fallback). Plate (`blender/ref/poc-a-plate.jpg`) is still the look bar.

**Constraints:** Babylon **Lite** only (`07-animation`, `13-skeleton`). No `@babylonjs/core` `beginAnimation` / `ImportMeshAsync`. No `npm run export` on `hero-a.blend`. VE on `ve.sparkify.dev/wow-clone/`. Lead **reviews stills/GIFs before upload**.

**Scope:** ~40–60 hours. Each L-milestone is independently playable.

| L | Hours | Pass |
|---|---|---|
| L1 Item GLB pipeline | 6–8 | `/characters/items/staff.glb` 200; unequip works |
| L2 Weapon grip | 4–6 | Idle/sprint/jump stills; no empty hand; no lamp-post |
| L3 Full-coverage clothes | 6–8 | Front + 3/4: no nude abs/groin/bare feet |
| L4 Animation completeness | 5–7 | HUD clip names match; no Sprint-as-back; no fake strafe |
| L5 Appearance v1 | 4–6 | Two heights + two skins; capsule matches feet |
| L6 Catalog + paper doll | 5–7 | Swap helm/weapon in one session |
| L7 NPC instances | 4–6 | Two skinned humans; Tab only hostiles |
| L8 Perf / LOD | 4–6 | 8 characters, 60 FPS M-series Chrome |

**Status 2026-09-14:** L1–L8 systems landed. Clothes/front + polish: rounded cowl, bell sleeves, waist. Still Mixamo dummy + blockout gear. L6 catalog is one item/slot (click unequips). Idle_Loop parks the staff at the hip — the plate holds it in front.

## L9 — Mage rest + transmog pair (next)

The look bar is still the plate: staff in front of the torso, not a hip rest. Paper-doll is only real if two items share a slot.

- Standing rest uses a Mixamo clip whose right hand is **up** (try `Sword_Idle` / `Idle_Torch_Loop` / `Spell_Simple_Idle_Loop`). HUD prints the real name. Walk/sprint/jump unchanged.
- Catalog: ≥2 helms and ≥2 weapons (tint/variant on the same GLB is fine). `C` click cycles helm and weapon without reload.
- Do **not** mark pass from a back shot.

**Pass:** front still of rest with staff crystal visible; VE of helm A vs helm B (or staff A vs B).

**Status:** Rest is `Spell_Simple_Idle_Loop` (staff up, not hip). Catalog has Void Cowl / Ash Cowl and Nightstaff / Emberstaff. Ember gem reads; cowl tint is subtle on wool.

Not this milestone: crowd 60 FPS, WalkingBackwards, plate-photoreal body.

**Explicitly later:** plate-photoreal body sculpt; Mixamo retarget of `hero-a.blend`; race/gender; bag economy; multiplayer appearance replication.

