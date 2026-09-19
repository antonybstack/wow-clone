# Action RPG modular armor across body types

Scope: how shipped single-player / action RPGs fit modular skinned armor across discrete body types (not infinite sliders). Engine mechanisms: Unreal Leader Pose / mesh merge, Unity `SkinnedMeshRenderer` bone remapping. Studios: Larian (BG3), Bungie (Destiny), Capcom (Monster Hunter), FromSoftware (Elden Ring). Clipping: hide-mesh, alpha, cloth capsules, authored fits.

Target application (for inferences only): WebGPU Babylon Lite game with a Human and a much bulkier print-sculpt Orc on the **same Mixamo 65-joint bind**. No body sliders. Catalogue of ~8 3D garments. Ashen Reach currently shrink-fits Orc garments onto the print-sculpt rest rather than MHCLO wrap.

---

## Does Unreal SetLeaderPoseComponent / Master Pose actually deform armor to a different body shape, or only share animation?

### Takeaway
Leader Pose (formerly Master Pose) **only shares the leader’s bone-transform buffer**. It does not wrap, shrink, or remesh armor onto a different body. Follower meshes keep their own rest-pose geometry and skin weights; extra or missing joints render in reference pose. Unity bone remapping is the same class of trick: animation sharing, not body-shape conversion.

### Cited Findings
- Epic’s modular-character docs: `Set Leader Pose Component` “constructs the character by parenting skeletal mesh objects to a parent skeletal mesh object, and **runs the animations exclusively on the parent**.” Children “do not use any Bone Transform Buffer and won’t run any animations independently”; they “can only run animations played on the Leader Pose Component’s Bone Transform Buffer.” — [Working with Modular Characters (UE 5.8)](https://dev.epicgames.com/documentation/en-us/unreal-engine/working-with-modular-characters-in-unreal-engine)
- Same page: “any child mesh object of the Leader Bone **has to be a subset with the exact matching structure**. You cannot have any other extra joints or skip any joints. Since there is no Bone Buffer data for extra joints, any extra or skipped joints will be rendered using the **reference pose**.” Child meshes “cannot run unique animations, or simulate physics independently from the Leader Pose component.” — [Working with Modular Characters](https://dev.epicgames.com/documentation/en-us/unreal-engine/working-with-modular-characters-in-unreal-engine)
- Engine API: `leader_pose_component` — “If set, this SkeletalMeshComponent will **not use its SpaceBase for bone transform**, but will use the **component space transforms from the LeaderPoseComponent**. This is used when constructing a character using **multiple skeletal meshes sharing the same skeleton** within the same Actor.” `master_pose_component` was renamed to `leader_pose_component`. — [unreal.SkinnedMeshComponent (UE 5.4 Python)](https://docs.unrealengine.com/5.4/en-US/PythonAPI/class/SkinnedMeshComponent.html?application_version=5.4)
- Blueprint node: `SetLeaderPoseComponent` takes Target, New Leader Bone Component, Force Update, In Follower Should Tick Pose. No body-shape, wrap, or morph-transfer parameters. — [Set Leader Pose Component](https://dev.epicgames.com/documentation/unreal-engine/BlueprintAPI/Components/SkinnedMesh/SetLeaderPoseComponent?lang=en-US)
- Comparison table (Epic): Leader Pose supports **morph targets: Yes**; physics: **No**; game-thread cost Min, **render-thread cost High** (still one draw per component). Copy Pose From Mesh also supports morphs but is expensive on both threads. **Skeletal Mesh Merge** is cheapest to render (one mesh) but **morph targets: No**. — [Working with Modular Characters](https://dev.epicgames.com/documentation/en-us/unreal-engine/working-with-modular-characters-in-unreal-engine)
- Mesh merge: `FSkeletalMeshMerge` “Utility for merging a list of skeletal meshes into a single mesh.” Optional `FRefPoseOverride` can override reference-skeleton bone poses during merge. That still composites **authored** meshes onto one skeleton; it does not generate a new garment from a different body surface. Merged mesh “only run[s] one animation at once” and “transferring Morph Targets to the merged mesh is not supported” (workaround exists via `FMorphTargetDelta`). — [FSkeletalMeshMerge](https://docs.unrealengine.com/documentation/en-us/unreal-engine/API/Runtime/Engine/FSkeletalMeshMerge?application_version=5.0); [Working with Modular Characters](https://dev.epicgames.com/documentation/en-us/unreal-engine/working-with-modular-characters-in-unreal-engine)
- Cloth on followers: `BindClothToLeaderPoseComponent` makes follower cloth take **leader cloth transforms** instead of simulating separately. “The meshes used in the components **must be identical** for the cloth to bind correctly.” That is cloth-sim sharing, not armor wrap. — [USkeletalMeshComponent::BindClothToLeaderPoseComponent](https://dev.epicgames.com/documentation/unreal-engine/API/Runtime/Engine/USkeletalMeshComponent/BindClothToLeaderPoseComponent?lang=en-US)
- Community restatement of the same engine contract: child “does not have any bone transform buffer… it just uses Body’s bone transform buffer when rendered.” Limitation: “Child has to have SUBSET of exact matching structure.” Extra joints “will render in the origin of the mesh.” — [ikrima gamedevguide, Master Pose vs Copy Pose vs Mesh Merge](https://github.com/ikrima/gamedevguide/raw/master/docs/ue4guide/gameplay-programming/animation-subsystem/master-pose-vs-copy-pose-vs-mesh-merge.md) (secondary; matches Epic docs)
- Unity equivalent: a `SkinnedMeshRenderer` deforms via `bones[]` plus `Mesh.bindposes`. “Each matrix in `bindposes` is the **inverse of the transformation matrix of the bone, calculated when the bone is in its base state (its bind pose)**.” The bones array is assignable at runtime. — [Mesh.bindposes](https://docs.unity3d.com/6000.5/Documentation/ScriptReference/Mesh-bindposes.html); [SkinnedMeshRenderer.bones](https://docs.unity3d.com/6000.0/Documentation/ScriptReference/SkinnedMeshRenderer-bones.html)
- Standard Unity clothing trick: keep clothing on the same rig, then replace `SkinnedMeshRenderer.bones` by **name** so garments follow the character skeleton. Community “Equipmentizer” script maps `TargetMeshRenderer.bones` onto the clothing renderer. — [Unity Discussions: How to make clothes animate along with character](https://discussions.unity.com/t/tutorial-how-to-make-clothes-animate-along-with-character/667297)
- Remapping bones **does not rewrite rest-pose vertices**. Bindposes stay those of the garment’s authored rest. If live bones have a different rest (longer arms, bulkier chest) than the bindpose assumed, vertices follow bone motion from the **old** rest offsets — they do not snap to a new skin surface. Name-based transfer tools exist; they reparent/remap, they do not wrap. — [Unity.Systems.SkinnedMeshTransfer](https://github.com/CanTalat-Yakan/Unity.Systems.SkinnedMeshTransfer); [Unity Discussions: remap skeleton of SkinnedMeshRenderer](https://discussions.unity.com/t/what-is-the-correct-way-to-remap-the-skeleton-of-skinnedmeshrenderer/872512)
- Skinning quality is a bone-influence cap (1/2/4/unlimited), not a body-fit control. — [Skinned Mesh Renderer component reference](https://docs.unity3d.com/6000.0/Documentation/Manual/class-SkinnedMeshRenderer.html)
- Rigid accessories (helmets, swords) are often bound to **one existing bone** rather than adding extra bones, so they move with the joint but cannot independent-simulate. — [Combining Skinned Meshes (MeshBaker talk)](https://www.youtube.com/watch?v=LA_BLaDCoqg)

### Inferences
- Leader Pose / Unity bone remap = **one skeleton pose, many skinned shells**. The shell’s silhouette is whatever was modeled in its bind pose. A Human-authored mail shirt remapped onto a bulkier Orc skeleton will **animate** with the Orc, but its vertices remain Human-offset from those bones. That is poke-through or “floating cloth,” not a fit.
- Morph targets on Leader Pose children are **per-mesh blendshapes the artist authored**, not an automatic “make this cuirass match that torso.” Mesh merge even **drops** morphs.
- `FRefPoseOverride` during merge can retarget the **skeleton rest**, not the garment surface. Useful if two bodies share a skeleton with different bone lengths; still requires garments whose rest vertices were built for that rest.
- For Ashen Reach (same 65 Mixamo joints, two rest shapes): engine-level pose sharing is already what Lite skinning does. It will **not** replace the current print-sculpt shrink-fit of the eight garments. Sharing the Human pack on the Orc bind without a rest-space refit is the Leader Pose failure mode.

### Gaps
- Epic docs never use the words wrap, shrink-wrap, or MHCLO. No official statement that Leader Pose “fits armor to a different body.”
- No first-party measurement of how far bone-length differences can go before Leader Pose garments look broken.
- Unreal Mutable / Chaos Cloth + modular physics-asset merging is a newer path; this pass did not pull Mutable’s own docs. Forum users treat it as a hide-mesh / merge plugin, not a body-type wrap. — [UE forum: cloth collisions for modular character](https://forums.unrealengine.com/t/how-to-handle-cloth-collisions-for-modular-character/2514439)

---

## What did Larian publicly say about BG3 body types and armor?

### Takeaway
Larian **refused body sliders**. They ship **discrete body types** (four on HUM-like races, two on others) and **author a unique armor mesh per race/body type**. Official toolkit docs tell modders to refit per race, match body topology, hide covered skin with vertex-color masks, and obey sleeve/boot **limitation volumes**. Public interviews talk design (“look cool”) more than the mesh pipeline; the pipeline is in the official armor guides.

### Cited Findings

**Public interviews (design, not mesh tech)**
- Alena Dubrovina (lead character artist on BG3 clothing/armor; later interviewed as art director) on why there are no skinny/broad/height sliders: the scanning pipeline showed “**small millimeter changes can make or break a face completely**.” Heavy slider creators risk “faces being a bit blank and characterless.” Height and extra body types are “a **potential area of improvement** for us in the future both for our faces and body types.” — [Game Developer, “Building an inclusive character creator…”, 17 Nov 2023](https://www.gamedeveloper.com/art/building-an-inclusive-character-creator-for-the-fantasy-world-of-baldur-s-gate-3)
- Same interview: gender is not defined by body, genitals, or voice; identity is a separate CC choice. — [Game Developer](https://www.gamedeveloper.com/art/building-an-inclusive-character-creator-for-the-fantasy-world-of-baldur-s-gate-3)
- Dubrovina to PC Gamer on outfits: wild concept armor was cut when “tech animators would point out that they were not practical for animated characters.” On barbarian “armor” that must not look protective: “The main thing is looking cool, and fitting in the game setting, and telling the story that it needs to tell.” — [PC Gamer, 5 Feb 2024](https://www.pcgamer.com/larians-art-director-on-the-outfits-of-baldurs-gate-3-and-why-making-them-fit-matters-but-the-main-thing-is-looking-cool/)
- Substance 3D magazine (Dubrovina / Larian character art): armor shader is built for **color customization** (ID maps, 12 potential colors), not for body-shape morphs. — [Bringing Life to Legends: Character Art in Baldur’s Gate 3](https://substance3d.adobe.com/magazine/bringing-life-to-legends-character-art-in-baldurs-gate-3/)

**Official Larian / BG3 toolkit (authoring contract)**
- Official **Armor Creation Guidelines** (mod.io, tagged Official): separate **HUM_F** and **HUM_M** basemeshes and limitation FBX files. “If you want the armour to be available for other races, you’ll need to **adjust it for each of those races individually**.” Package of limit guides for other races is provided. — [Armor - Creation Guidelines (mod.io)](https://mod.io/g/baldursgate3/r/creation-guidelines-armor)
- Same guide, “Armor Across Races”: dragonborn and dwarves have different proportions; meshes need “**enough loops available** to support all of the race/gender variations, as you’ll want to keep the **vertex order between versions identical**.” Example: a glove “looks a lot more low res on male dwarves (DWR_M) because it’s **heavily stretched**.” “Armours need to be **scaled proportionally**. Collars on dwarves… need to be shorter than on humans.” — [Armor - Creation Guidelines](https://mod.io/g/baldursgate3/r/creation-guidelines-armor)
- Same guide, topology: armor should have “the **same topology as the naked body**,” especially on skin-tight pieces “where you cannot hide the body mesh.” Joint topology must be preserved **even when hidden**, or it “will pop out of the overlying model when animated.” Rigid objects must not sit on rotation points. — [Armor - Creation Guidelines](https://mod.io/g/baldursgate3/r/creation-guidelines-armor)
- **Limitation volumes** (not called “standardization volumes”): trousers/sleeves must stay **inside** an orange width limit; gloves/boots must stay **outside** it, “snugly around it,” so “all trouser–boot and sleeve–glove combinations will work together and **not intersect**.” Green vertex colour marks regions that **will be hidden**. Gloves must reach a length disc or there are gaps. — [Armor - Creation Guidelines](https://mod.io/g/baldursgate3/r/creation-guidelines-armor)
- Official **Adding Armour** (Larian BG3 modding docs): armor resources expose **Slot ID**, **Supports Vertex Color Masking**, **Tags**, **Vertex Color Mask Slots**. “Supports Vertex Color Masking is needed for the **hiding system we use on equipment**” (sleeves hide under gloves, trousers hide under boots). Shader name must contain **VertCut**. Vertex Color Mask Slots on a shirt example: Shoulders, Upperarm, Torso, Underwear_bra, Nipple covers. Trousers example: underwear, private parts, thighs, knees, shins, pants. “These vary slightly across **genders and races**.” Equipment Composer assigns “the correct visual and colour presets **for all races**.” Fallback armor from another race is allowed if you do not author every race. — [Adding Armour (docs.baldursgate3.game)](https://docs.baldursgate3.game/Adding_Armour)
- Divinity Engine / DOS2 character docs (same studio pipeline, still linked as Larian docs): playable armor requires “**Create meshes for each race and gender. So you need to have 8 meshes + 8 skeleton version variation.**” “Your armor pieces needs to be made and cut the same way as pre-existing equipment, so they could fit with each other.” Player characters keep unequippable naked body parts “which **are hidden when player equips armor**.” Cloth sim: zero thickness, `Cloth=1`, vertex paint black=fixed / red=simulated. Helmets skinned to one bone should be `Rigid = true`. Export **only needed bones**, always include character root. — [My first: Character (docs.larian.game)](https://docs.larian.game/My_first:_Character)

**What shipped (player-facing + unpacked assets)**
- Body type is a CC enum, **not a slider**. “Elves, drow, half-elves, humans and tieflings have **four** options, all other races have **two**. **Body type cannot be changed after character creation.**” Race also cannot change. Identity (female/male/non-binary) is separate from body type. — [bg3.wiki Character creation](https://bg3.wiki/wiki/Character_creation)
- Unpacked nude bodies are separate assets: `HUM_F_NKD_Body_A` (type 1), `HUM_M` (2), `HUM_FS` (3, strong fem), `HUM_MS` (4, strong masc), plus TIF/GTY/DWR/HFL/GNO/HRC/DGB male/female. Elves/drow reuse HUM meshes with different materials. — [bg3.wiki Modding:Body Models](https://bg3.wiki/wiki/Modding:Body_Models); [BG3 Modding Community Body Meshes Reference](https://wiki.bg3.community/Information/Meshes/Body-Meshes-Reference)
- Armor file convention: `RACE_BODYTYPE_ARM` / `_CLT` (`HUM_F_ARM`, `GTY_M_ARM`, `HUM_FS`, `HUM_MS`, …). Weight-paint tutorials assume the outfit is **already fitted to one body type**. Community Outfit Builder uses **shapekeys** to refit a mesh to another body type — a modder tool, not the runtime. — [Weight Painting Armor and Clothes](https://wiki.bg3.community/Tutorials/Visual/Weight-Painting-Armor); [Modding:Meshes (Blender)](https://bg3.wiki/wiki/Modding:Meshes_(Blender))
- Hide system in data: `VertexColorMaskSlots` with region names (`Torso` `#013201`, `hands`, `feet`, `Private_Parts`, `Sleeves`, `Pants`, `Never Hide Hair`). Red vertex colour drives cloth physics; more red = more motion. Helmets can also hide Head/Beard/Ears via mesh **name tags**. — [Modding:VertexColorMaskSlots](https://bg3.wiki/wiki/Modding:VertexColorMaskSlots)
- “The game’s armour system works by **vertex paint**. It uses this, in combination with the .lsx code, to tell it what to hide and what to show. For example, an armour mesh may **unload the body’s torso** as it will not be shown.” — [Modding:Meshes (Blender)](https://bg3.wiki/wiki/Modding:Meshes_(Blender))

### Inferences
- BG3 is the closest AAA analogue to Ashen Reach: **no sliders**, **two-to-four discrete bodies**, **same logical catalogue**, **per-body authored garments**. Larian did not wrap one Human cuirass onto a dwarf or “strong” body at runtime.
- Official “limitation meshes” are authored **clearance volumes** so mix-and-match slots (glove over sleeve, boot over pant) do not intersect. That is cheaper than cloth-vs-armor collision for a small catalogue.
- Hide-under-mesh is first-class: vertex colour + VertCut shader + `VertexColorMaskSlots`. They still require matching joint topology on hidden body, because leftover verts can pop through animation.
- Public “look cool / no sliders” quotes explain **why** they paid for discrete types. The mesh cost is in the toolkit: N races × body types × slots.

### Gaps
- No Larian GDC/Dev Days talk was found that walks the **runtime** hide/vertcut implementation or polygon budgets per body type. Dev Days / GDC hits in search were mostly character-creator inclusion, not armor tech.
- Exact count of unique armor GR2s per item (how many body types they actually filled vs fallback) is not in the official guides. Equipment Composer explicitly allows fallbacks.
- Half-orc (`HRC`) limit meshes were reported missing from the public zip by a commenter on the official guide — unverified here.

---

## Destiny 2 / Bungie: standardization volumes, deleting under-mesh — any primary sources?

### Takeaway
**No primary Bungie source uses “standardization volumes.”** Destiny’s published character tech is GDC 2014 (Scott Shepherd): **bits** assembled in **Mashup**, four slots (head/chest/arms/legs), per-class memory budgets, a female-physique **authoring** tool, and wrap/blendshape experiments that **worked for cloth, not as a general female converter**. Deleting/hiding under-mesh is **not** documented in those talks; clipping was an artist-preview problem (`Mantini`). Armor 2.0/3.0 blogs are **stats/mods**, not meshes.

### Cited Findings

**GDC 2014 — Building Customizable Characters for Destiny (Scott Shepherd, Technical Art Lead)**
- Player bodies break into **four slots**: head, chest, arms, legs. Gear is collected into those slots. Class identity is a silhouette (Titan V, Warlock inverse-V, Hunter in between) plus a fifth cosmetic class item. — [Polygon GDC report, 21 Mar 2014](http://www.polygon.com/2014/3/21/5533684/bungies-destiny-extensive-character-customization); [Datto GDC summary on Bungie.net](https://www.bungie.net/en/Forums/Post/64332998?page=0&sort=0); [GDC Vault / YouTube talk](https://www.youtube.com/watch?v=sSSMC4O6J8Q)
- Halo Reach-style helmet add-ons did not scale. An accidental **z-buffer** of add-ons from one helmet onto another “worked,” which inspired breaking characters into reusable **bits** (buckles, visors, pads, straps) assembled into **arrangements**. — [Datto summary](https://www.bungie.net/en/Forums/Post/64332998?page=0&sort=0); [YouTube talk](https://www.youtube.com/watch?v=sSSMC4O6J8Q)
- **Mashup** is an internal assembler: any bit can be “brought in, **placed, rotated, scaled to fit the arrangement** as needed, all without affecting the original bit geometry.” — [YouTube talk transcript](https://www.youtube.com/watch?v=sSSMC4O6J8Q)
- Materials: each arrangement has dyes for **armor / cloth / suit** (leather or rubber). Bits are flagged as one of those types. — [YouTube talk](https://www.youtube.com/watch?v=sSSMC4O6J8Q); [Datto](https://www.bungie.net/en/Forums/Post/64332998?page=0&sort=0)
- Memory: each character has a budget; **class redistributes** it (Titan arms+chest get more; Warlock chest gets more than arms). Not a player-facing volume. — [Datto](https://www.bungie.net/en/Forums/Post/64332998?page=0&sort=0)
- Female conversion: “The team also made tools that would **automatically help alter bits for the female physique**, eliminating the need for programmers to ‘massage the geometry’ manually every time a costume piece needed to be made for a woman.” Goal: chest pieces and pants “fit and look the way they should on both avatar genders.” — [Polygon](http://www.polygon.com/2014/3/21/5533684/bungies-destiny-extensive-character-customization)
- Q&A on **wrap deformers / blend shapes** to create female gear: Shepherd: using wraps and blendshape wrap deformers “for things like **cloth and soft organics, it worked very well**.” (Implication: not the general solution for hard armor bits; they built a dedicated female-alter tool instead.) — [YouTube talk Q&A](https://www.youtube.com/watch?v=sSSMC4O6J8Q); shorter Q&A upload [Building Customizable Characters for Bungie's Destiny](https://www.youtube.com/watch?v=V9KBUXyGnAA)
- Clipping / intersection: they did **not** claim a runtime under-mesh delete. Q&A on mix-and-match self-intersection: “mostly just… **quick and easy tools for checking animations** we have in Maya animation previews” — one button to see the arrangement move. Datto: they built **“Mantini”** to preview arrangements for colour and “any technical issues, like **clipping between gear**.” — [YouTube Q&A](https://www.youtube.com/watch?v=V9KBUXyGnAA); [Datto](https://www.bungie.net/en/Forums/Post/64332998?page=0&sort=0)
- Player-facing randomization of bits was **rejected**: “We wanted artists to still maintain control of the overall design.” Mashup is an **authoring** multiplier, not a loot-gen mesh wrap. — [Datto follow-up](https://www.bungie.net/en/Forums/Post/64333005?sort=0&page=0&path=1)
- Japanese contemporaneous report: designers pick base parts (head/torso/arms/legs), tweak, and can finish a new part in “about **3 hours**” because bases are shared. — [Inside Games / GameSpark GDC 2014](https://www.inside-games.jp/article/2014/03/31/75624.html)

**What is *not* Destiny mesh tech**
- Bungie.net “Next Generation Armor” / Armor 3.0 (2024–2025) is **stat archetypes, set bonuses, energy mods**. No mesh, volume, or under-mesh language. — [Developer Insight - Next Generation Armor](https://www.bungie.net/7/en/News/article/next_gen_armor); [Director’s Cut Part II (Armor 2.0, 2019)](https://www.bungie.net/7/en/News/article/48064)
- Digital Foundry Destiny 2 tech interview covers PBR, GPU particles, volumetrics — **not** character assembly. — [Digital Foundry, 2017](https://www.digitalfoundry.net/articles/digitalfoundry-2017-destiny-2-tech-interview)

**“Standardization volumes” search**
- Queries for `"standardization volume(s)"` + Destiny/Bungie/armor returned **ASTM body-armor fitting standards**, Skyrim xEdit stat scripts, s&box clothing triangle budgets, NATO clothing sizing — **not** Bungie. No hit in Shepherd’s talk summaries, Polygon, Datto, or Bungie.net armor blogs.

### Inferences
- Destiny’s body-type problem was **male vs female Guardian**, solved **offline**: Mashup scale/place bits, plus a female-physique deformer for bits. Runtime is swap-slot meshes that already fit that sex/class. That is closer to Ashen Reach’s **two authored packs** than to a live wrap.
- Wrap deformers were tried and **kept for cloth/soft bits only**. Hard armor bits were reused as rigid pieces with per-arrangement TRS. Do not expect a wrap to save a bulky Orc cuirass from a Human rest.
- Z-buffering bits (layer small geo on a base helmet) is overdraw-as-authoring, **not** hide-mesh of a body. Under-suit “suit” dye layer is a material channel, not a deleted torso.
- “Standardization volumes” as a term is **very likely a different franchise** (often Blizzard/WoW character pipeline vernacular) mixed into this question. Treat as **unverified for Destiny**.

### Gaps
- Full GDC Vault transcript is behind login; this note uses Polygon, Datto’s contemporaneous summary, YouTube auto-transcript, and Japanese reports. Quotes of Shepherd on wrap deformers are from the YouTube Q&A, not a published paper.
- No public Bungie doc on deleting the body under armor, GPU skinning of bits, or whether D2 still uses Mashup.
- Titan/Hunter/Warlock are class silhouettes, not Human/Orc-scale body types. Species (Human/Awoken/Exo) is stated as cosmetic. — [Wikipedia Destiny](https://en.wikipedia.org/wiki/Destiny_(video_game)) (tertiary)

---

## Monster Hunter: male/female as separate authored sets vs runtime wrap?

### Takeaway
Through **World and Rise**, Capcom **authored two full visual sets** per armor (male / female, later “type 1 / type 2”) and **locked** them to body type. That is **not** a runtime wrap. **Wilds** still has two designs; the change is **unlocking** so any hunter can equip either. Modding folders (`f_equip` / `m_equip`) and per-part `.mod3` meshes confirm separate assets. No MT Framework talk found that describes wrap/shrink of armor across bodies.

### Cited Findings
- Capcom developer, Gamescom 2024 livestream, quoted by PC Gamer: “**In previous Monster Hunter games, male and female armor were separate.** I’m happy to confirm that in Monster Hunter Wilds, there’s **no more male and female armor. All characters can wear any gear.**” Same article: World/Rise stats were identical across genders; **appearance was completely different** (male bulkier, female often more skin). Rise dropped the words male/female but **type 1 vs type 2 armor differences remained**. — [PC Gamer, 21 Aug 2024](https://www.pcgamer.com/games/action/fashion-hunters-rejoice-as-monster-hunter-wilds-ditches-gendered-armor-capcom-confirms-all-characters-can-wear-any-gear/)
- GameSpot: Wilds “showed a character equipping **both male and female armor pieces from the same armor set**.” “The **two different sets will still be present**… you can choose which version… for each individual piece.” First time in the series armor is not locked to created gender. — [GameSpot, 21 Aug 2024](https://www.gamespot.com/articles/monster-hunter-wilds-wont-have-gender-locked-armor-a-series-first/1100-6526033/)
- Japanese report of the same stream: historically Rathian male set is knight plate, female is “armor dress”; Wilds removes the lock so each design can be worn by either hunter. — [Inside Games, 22 Aug 2024](https://www.inside-games.jp/article/2024/08/22/158611.html)
- World file layout used by modders: `nativePC/pl/f_equip` vs `m_equip`. A Nexus guide mirrors female mods to male by **renaming `f_` → `m_`** — i.e. the game loads a **gendered folder**, not a wrap. — [Nexus: How to mirror all your female armor mods to males](https://www.nexusmods.com/monsterhunterworld/articles/482)
- World models are **per-slot meshes** (head/body/arms/waist/legs) in `.mod3` with their **own bones**; legs often include a fuller skeleton. A fan wardrobe tool “map[s] all the models onto” **one armature per gender** because “most model categories include only the bones they need.” — [monster-hunter-wardrobe README](https://codeberg.org/morganamagpie/monster-hunter-wardrobe); [MHW Mod3 Structure Notes](https://github.com/Ezekial711/MonsterHunterWorldModding/wiki/Mod3-Structure-Notes)
- Splitting outfits: duplicate a full mesh onto each equipment slot then **erase unneeded body parts** per slot. That is authored hide-by-deletion, not a wrap. — [How to Split a Single Mesh Outfit into Player Equippable Parts](https://github.com/Ezekial711/MonsterHunterWorldModding/wiki/How-to-Split-a-Single-Mesh-Outfit-into-Player-Equippable-Parts)
- Wilds mesh-swap tutorial comments: some base armors “do not have the other gender’s outfit as an option… **purely because it’s not changed outside of proportions**.” Other sets remain separate IDs. — **speculation / commenter**, [MH Wilds Mesh Swap Tutorial](https://www.youtube.com/watch?v=cJIXzNn0XXA)
- Layered armor (Rise DLC example): “This set can be used **regardless of hunter type**” but “changes your entire look and **cannot be applied to individual body parts**.” Transmog, not wrap. — [Steam: Minoto Hunter layered armor](https://store.steampowered.com/app/2167452/Monster_Hunter_Rise__Minoto_Hunter_layered_armor_set/)
- Capcom kept **MT Framework** for World because “there are some things you can only do in MT Framework that really benefit Monster Hunter” and existing **custom toolsets**. The interview does **not** mention clothing wrap. — [Wccftech / EDGE 313, producer Ryuji Tsujimoto](https://wccftech.com/capcom-mt-framework-monster-hunter-world/)

### Inferences
- MH World is the **expensive** version of Ashen Reach’s problem: every set is modeled twice (or more). Wilds reduces lock-in, not modeling count.
- Runtime is slot-swap of skinned parts already bound to that hunter’s armature. Jiggle (`.ctc`) and colliders (`.ccl`) are per-mesh extras, not a body wrap.
- If Wilds still stores two meshes per piece, “all characters can wear any gear” is **catalogue unlock**, not one mesh deforming to both bodies.

### Gaps
- No Capcom GDC/CEDEC **armor-fit** talk was found. MT Framework public material is engine-strategy, not character assembly.
- How Wilds actually stores “male design on female body” (second mesh vs proportion-only scale vs new wrap) is **not documented** in the Gamescom quotes. Commenters conflict; treat as unknown.
- Palico / NPC armor pipelines not researched.

---

## FromSoftware: is Elden Ring armor actually dynamic to sliders, or discrete body meshes?

### Takeaway
**Both, stacked, and neither is a wrap.** Discrete **Type A / Type B** bodies; many armor FLVERs exist as **male and female** (`_m_` / `_f_`). **Body sliders** (head/chest/abdomen/arms/legs + Standard/Muscular) exist and **scale the body**; Eurogamer states armor is **one-size** (anyone can wear it). Player/modder evidence: armor **follows those scales** as skinned meshes, and **invisible-flag masks** hide body parts under armor. There is **no** per-slider unique armor mesh. Extreme sliders clip; some pieces look “shrink-wrapped” because one armor rest is bone-scaled.

### Cited Findings

**Discrete types + sliders (player-facing)**
- CC: Body Type **A (male) / B (female)**; Age young/mature/aged “only affects appearance.” Alter Body sliders: **Head, Chest, Abdomen, Legs**, body hair, **Musculature: Standard vs Muscular**. — [Elden Ring Wiki: Character Creation](https://eldenring.wiki.fextralife.com/Character_Creation)
- Eurogamer.de on Chest: “**Alle Rüstungen haben eine Einheitsgröße und können von jedem Charakter getragen werden.**” (All armors have a **unit size** and can be worn by any character.) Sliders do not change stats or which armor you can equip. Head/chest/abdomen/arms/legs sliders **cross-influence** each other. Muscular “shows more muscle definition”; “the **fundamental body structure stays the same**.” — [Eurogamer.de, 4 Jul 2022](https://www.eurogamer.de/elden-ring-koerper-aendern-kopf-brust-muskeln-bauch-arme-beine-behaarung)

**Per-gender meshes + hide masks (engine/modding)**
- FromSoftware `EquipParamProtector` (shared family; Bloodborne dump is public and matches ER usage): `equipModelGender` enum includes **Split by Gender** vs **Shared**; separate `iconIdM` / `iconIdF`; `faceScaleM_*` / `faceScaleF_*`; dozens of **`invisibleFlag00`…** booleans; `useFaceScale`. Mask enum: Show/Hide per male/female. — [soulsmodding EquipParamProtector (BB)](https://soulsmodding.com/doku.php?id=bb-refmat:param:equipparamprotector)
- ER helmet-invisibility mods: in `EquipParamProtector`, set model ID and **Mask 00–97 / InvisibleFlags** so the **head (and overlapping body) is not drawn**. — [Nexus: Invisible (Hidden) Helmets comments](https://www.nexusmods.com/eldenring/mods/560?tab=posts)
- ER armor files on disk: gendered FLVERs (`lg_m_1290`, `_f_` counterparts). Modder resource ships **ER_Base_Male** and **ER_Base_female** body files for fitting armor. — [Nexus: basic body files for modding armor meshes](https://www.nexusmods.com/eldenring/mods/10082); [Nexus FLVER resize tutorial](https://forums.nexusmods.com/topic/13194633-resizing-meshes-with-the-flver-editor-tutorial/)
- Modder claim (LoversLab, **not** FromSoftware): “From software uses **masking body parts** system for hiding body parts that clippings with armor models” and “**Armor models are not support body size sliders on game engine level.**” — [LoversLab thread, 21 Mar 2022](https://www.loverslab.com/topic/185275-elden-ring-nude/page/13/) — **mark as unofficial / unverified against engine source**

**What players observe (secondary, consistent)**
- r/EldenBling: “the bigger/more muscular your character’s body is, the **larger armor sets will appear**… especially noticeable w/ heavy armor.” Inverse: tiny chest/abdomen makes bulky sets look sleeker. — [r/Eldenring “Fashion Tip: Body Sliders”](https://www.reddit.com/r/Eldenring/comments/1dnrkp4/fashion_tip_body_sliders/)
- Veteran’s chest “less bloated” if chest slider is turned down. Cape clipping reduced by **decreasing torso/abdomen**, which “the chest piece decreases in overall size, pulling the cape closer.” — [r/EldenBling Veteran’s chest](https://www.reddit.com/r/EldenBling/comments/tp81n8/if_you_turn_the_chest_slider_all_the_way_down_it/); [Cape clipping tip](https://www.reddit.com/r/EldenBling/comments/1blrbb4/fashion_tip_for_cape_clipping)
- Fingerprint / Crucible pieces “morph” or squash the body/head — players interpret this as armor **imposing a shape**, i.e. one rest mesh fighting slider scale. — [r/Eldenring body morphing](https://www.reddit.com/r/Eldenring/comments/wcbne8/body_morphing_in_some_armor_sets/)
- Isolated authored exceptions: Twinned armor **raises the weapon hold** so it clears the attached silver head; some chest/arm combos **raise/lower arm guards**; “plumper” sets **flare the arms**. These are **per-piece pose/offset hacks**, not a general wrap. — [r/GamingDetails Twinned armor](https://www.reddit.com/r/GamingDetails/comments/tdokli/in_elden_ring_when_you_have_the_twinned_armor/)

### Inferences
- Elden Ring is **not** “armor dynamically authored to every slider.” It is: **2 body meshes** × **1 (or 2 gendered) armor mesh per piece** × **bone/blend scale from sliders** × **bitmasks that delete under-mesh**.
- Eurogamer’s “Einheitsgröße” means **no unique armor asset per slider value**, not “armor ignores the body.” Skinned armor riding scaled bones **will** look bigger on a bigger chest. That is the same math as putting Human clothes on a bulkier Orc **without** rest-space refit — and why extreme ER sliders clip.
- Hide-mesh (`invisibleFlag*`) is the real clipping solution, same family as BG3 VertCut. Face-scale fields on helmets are a **narrow** morph, not a body wrap.
- Ashen Reach has **no sliders**, so the ER slider path is irrelevant. The relevant FromSoft lesson is: **gendered (or race) duplicate meshes + hide flags**, not live wrap.

### Gaps
- No FromSoftware GDC/CEDEC talk on Elden Ring character assembly was found.
- Whether sliders are bone scale, blendshapes, or both is **not** in official docs. Player + modder evidence is consistent with **bone/mesh scale + masks**, but the LoversLab “armor has no slider morphs” claim is unofficial.
- Nightreign / other From titles not compared.

---

## What clipping solutions are real: hide submeshes, alpha masks, cloth capsules, per-piece authored fits?

### Takeaway
All four are real; **AAA RPGs with mix-and-match slots lean on (1) hide/delete under-mesh and (4) per-body authored fits**. Alpha masks are a cheaper hide. Cloth capsules are for **sim cloth vs limbs**, not for fitting a cuirass to an Orc. Engine pose-sharing (Leader Pose, Unity bone map) is **not** a clipping solution. For ~8 garments × 2 discrete bodies, the documented AAA pattern is **author the second rest + hide covered skin**, which is what Ashen Reach already does.

### Cited Findings

**1. Hide / delete under-mesh (primary in RPGs)**
- Larian: player naked parts “**are hidden when player equips armor**.” VertCut + vertex-colour regions + `VertexColorMaskSlots` unload torso, arms, feet, genitals, hair, etc. Covered topology must still exist or it pops through. — [docs.larian.game](https://docs.larian.game/My_first:_Character); [Adding Armour](https://docs.baldursgate3.game/Adding_Armour); [VertexColorMaskSlots](https://bg3.wiki/wiki/Modding:VertexColorMaskSlots)
- FromSoftware: `invisibleFlag*` / Mask 00–97 on `EquipParamProtector` hide body sections under a protector. Standard ER mod advice for clipping is **toggle those masks**, not wrap the armor. — [soulsmodding EquipParamProtector](https://soulsmodding.com/doku.php?id=bb-refmat:param:equipparamprotector); [Nexus hidden helmets](https://www.nexusmods.com/eldenring/mods/560?tab=posts)
- Monster Hunter World: erase unused parts per equipment slot; LOD grouping can glue decorations together so they cannot be hidden independently. — [MHW split-outfit wiki](https://github.com/Ezekial711/MonsterHunterWorldModding/wiki/How-to-Split-a-Single-Mesh-Outfit-into-Player-Equippable-Parts)
- Generic gamedev: limited outfits → **flatten and delete interior geo**. Many outfits → **region IDs on the body** + a bitmask uniform that **aborts vertices** (NaN position) or uses a clothing-mask texture on alpha. — [GameDev StackExchange: hide body under clothing](https://gamedev.stackexchange.com/questions/188675/how-do-you-have-the-clothing-mesh-hide-the-body-mesh-underneath) (page fetch failed this pass; snippet from search is the source of this bullet — **confirm if quoting in a final report**)
- Unity editor tool: raycast-from-outside occlusion to **build a new mesh hiding overlapped verts**; T/A-pose only; armpits/inner thighs fail. — [CharacterClippingProtector](https://github.com/Hines94/CharacterClippingProtector)
- Unreal Mutable (third-party/plugin, not Epic Leader Pose): “hide specific areas completely… set it to non-existent so it won’t be processed.” — [YouTube: Modular Complex Armor Physics](https://www.youtube.com/watch?v=gw9d-eGMlUI)

**2. Alpha masks**
- StackExchange answer (same thread as above): a **clothing mask texture** driving the body shader’s alpha so a T-shirt blacks out torso UVs. Region-ID bitmask is the GPU-cheaper variant (one uniform).
- BG3 VertCut is the production version of this idea (vertex colour + dedicated shader), not a grayscale texture per outfit.
- Larian limitation guides: green vertex colour = **will be hidden** (sleeve tucked into glove). That is authored alpha/hide, not runtime SDF.

**3. Cloth capsules / physics colliders**
- Unity Cloth: “Cloth **does not react to all colliders** in a scene.” Only **capsule, sphere, and conical capsule (two spheres)** on the Cloth component’s lists. “These restrictions all exist to help boost performance.” Simulation is **one-way** (cloth does not push the world). Designed for **fabrics**, requires a Skinned Mesh Renderer. — [Unity Manual: Cloth](https://docs.unity3d.com/Manual/class-Cloth.html)
- Same: conical capsules “are useful for **modelling limbs of a character**.” Collision thickness / solver frequency / tethers are the anti-clip knobs. — [Unity Cloth](https://docs.unity3d.com/Manual/class-Cloth.html); [Bugnet: cloth clipping through body](https://bugnet.io/blog/how-to-fix-cloth-clipping-through-the-character-body)
- Unreal modular cloth: Chaos/clothing is bound to **one Physics Asset**. A cape on a torso piece **will not see** arm/leg colliders from other modular meshes unless you share a full-body physics asset or sibling collision. Leader Pose **disables independent physics** on children. `BindClothToLeaderPoseComponent` requires **identical** meshes. — [UE forum modular cloth](https://forums.unrealengine.com/t/how-to-handle-cloth-collisions-for-modular-character/2514439); [Chaos cloth modular](https://forums.unrealengine.com/t/how-should-i-set-up-chaos-cloth-simulaiton-collision-with-a-modular-character-approach/1545297); [BindClothToLeaderPoseComponent](https://dev.epicgames.com/documentation/unreal-engine/API/Runtime/Engine/USkeletalMeshComponent/BindClothToLeaderPoseComponent?lang=en-US)
- Larian: cloth has **no thickness**; red vertex paint = simulated, black = pinned. That is garment-local sim, not a fit-to-Orc-chest solver. — [docs.larian.game](https://docs.larian.game/My_first:_Character)
- MHW: `.ctc` jigglebone chains + `.ccl` colliders — per-armor authored, not a wrap. — [MHW wiki jigglebone page linked from Mod3 notes](https://github.com/Ezekial711/MonsterHunterWorldModding/wiki/Mod3-Structure-Notes)

**4. Per-piece authored fits (including sockets)**
- BG3: **one mesh per race/body type**, limitation volumes for slot compatibility, topology match to that nude, Equipment Composer per-race assignment, optional fallback. — [Armor Creation Guidelines](https://mod.io/g/baldursgate3/r/creation-guidelines-armor)
- Monster Hunter World: **two authored fashions** per set, `f_equip`/`m_equip`. Wilds unlocks both. — [PC Gamer](https://www.pcgamer.com/games/action/fashion-hunters-rejoice-as-monster-hunter-wilds-ditches-gendered-armor-capcom-confirms-all-characters-can-wear-any-gear/); [Nexus mirror guide](https://www.nexusmods.com/monsterhunterworld/articles/482)
- Destiny Mashup: artist **places/rotates/scales bits to the arrangement**; female physique tool **authors** the second gender; Maya preview catches clipping. Not runtime. — [YouTube GDC](https://www.youtube.com/watch?v=sSSMC4O6J8Q); [Polygon](http://www.polygon.com/2014/3/21/5533684/bungies-destiny-extensive-character-customization)
- Elden Ring: `_m`/`_f` FLVERs + one-size skinned to sliders; occasional **per-piece grip/arm offsets**. — [Eurogamer.de](https://www.eurogamer.de/elden-ring-koerper-aendern-kopf-brust-muskeln-bauch-arme-beine-behaarung); [r/GamingDetails Twinned](https://www.reddit.com/r/GamingDetails/comments/tdokli/in_elden_ring_when_you_have_the_twinned_armor/)
- Unity rigid gear: parent to an existing bone (helmet→head, breastplate→chest) to avoid extra bones; weapons that must detach keep their own bone. — [MeshBaker combining skinned meshes](https://www.youtube.com/watch?v=LA_BLaDCoqg)
- DOS2/BG3: single-bone helmets marked **Rigid**; only needed bones exported; character root always included. That is **socket-like rigid attach**, not wrap. — [docs.larian.game](https://docs.larian.game/My_first:_Character)

**What is *not* a clipping solution**
- Unreal Leader Pose / Unity `bones[]` remap: share animation. Morphs only if **authored on that mesh**. Extra joints → reference pose / origin. — [UE modular characters](https://dev.epicgames.com/documentation/en-us/unreal-engine/working-with-modular-characters-in-unreal-engine)
- Destiny wrap deformers: Shepherd said they **worked for cloth/soft organics**, not as the general female-armor path. — [GDC Q&A](https://www.youtube.com/watch?v=sSSMC4O6J8Q)

### Inferences
- Ranked by how often shipped ARPGs use them for **armor on multiple bodies**:
  1. **Per-body authored garment** (BG3, MH, Destiny male/female, ER A/B meshes).
  2. **Hide covered body** (BG3 VertCut, ER invisible flags, MH deleted parts, Larian unequipped-body hide).
  3. **Authored mix-slot clearance** (BG3 orange/green limitation meshes; Destiny Mantini; MH slot cuts).
  4. **Cloth capsules** for capes/skirts/hoods only; they need a collider volume that matches the **current** body+armor, which modular setups struggle with.
  5. **Alpha/region masks** as a cheaper hide when you cannot unload a submesh.
  6. **Runtime wrap / MHCLO-like** — **not** what these five studios document for armor. Destiny tried it for cloth bits and still built a female authoring tool.
- For Ashen Reach (2 bodies, 8 garments, same 65 joints, no sliders): duplicating the catalogue onto the print-sculpt rest and hiding Human under-mesh is **the AAA-sized solution**, not a compromise. Leader Pose-style sharing already exists (shared Mixamo pose). It will not bulk the mail to Grommash. Cloth capsules will not save a hood from tusks; that is an authored hood/tusk clearance, same class as BG3 dwarf collars.
- Sockets (hands, back stow) stay **rigid offsets on bones**. Race-specific grip TRS is the Destiny “scale the bit in Mashup” analogue, not a wrap.

### Gaps
- GameDev StackExchange page failed to fetch this pass; the hide-mesh/alpha summary is from the search snippet and should be re-opened before a public report quotes it verbatim.
- No primary Bungie/FromSoftware/Capcom source describes **alpha-card under-armor** as their main path.
- Babylon Lite / WebGPU has no Leader Pose node; the analogue is sharing the skeleton texture/bone buffer across garment meshes. Not re-verified against Lite docs in this pass.
- Performance numbers (>120 FPS, draw counts) were not collected from the cited games; Epic only gives relative thread costs for the three Unreal assembly methods.
