# Skeptical critique of the pasted “WoW / Elden Ring / GW2 / FFXIV / BDO / MHW / Destiny / BG3” clothing architecture

The pasted notes are a concatenation of LLM architecture essays. They mix a few real, decades-old techniques (texture compositing, geoset hide, bone-parented attachments, shared-skeleton skinning, per-body authored meshes) with engine-agnostic buzzwords and then attribute a single “runtime wrap / morph-from-Human-Male / hundreds of body zones / real-time collision deformers” system to every named game. The citations are mostly unrelated Reddit threads, a GW2 fashion forum post, a generic BDO wiki landing page, a Facebook group post, and a YouTube watch URL. They do not support the engineering claims.

Genre fingerprints in the paste: “Would you like to explore a specific technical aspect…”, numbered follow-up menus, Google `kgmid` entity links, “Master-Slave Skinned Mesh Renderer Alignment Architecture” (Unity + Unreal mashed together), FFXIV called a “Crystal Tools / Luminous Engine Variant” (Luminous is FFXV, not FFXIV), BG3 body types listed as “Standard, Strong, Short/Dwarf, and Half-Orc/Gnome” (wrong inventory of body types), and invented proper nouns (“Transmog Matrix”, “Strict Standardization Volumes”, “Universal Topology Mapping”, “Skin-Wrap Modifier Variant”, “Physics-Driven Weapon Sockets”).

This writeup answers the four assigned questions. It does not recommend implementing the pasted stack.

## Which pasted claims are contradicted by how those games actually ship assets?

### Takeaway

Shipped MMOs and action RPGs overwhelmingly author **per-race / per-body-type meshes** (or share a small family of bodies), **hide covered parts**, and **composite textures** or **dye channels**. They do **not** author one Human-Male armor and morph it at runtime onto Tauren, Lalafell, Charr, or a print-sculpt Orc. The paste’s “every MMO does this” claim is the inverse of the historical WoW, FFXIV, GW2, MHW, and BG3 pipelines.

### Cited Findings

**World of Warcraft — per-race character M2 + geosets + ~10 texture sections, not a Human-Male morpher**

- Each playable race/gender is a separate character model (`character/orc/male/orcmale.m2`, `character/human/male/humanmale.m2`, etc.), not a single shared armor mesh warped by race morphs. Race IDs and male/female display IDs are first-class in `ChrRaces`. — [wowdev ChrRaces](https://wowdev.wiki/index.php?title=DB/ChrRaces&oldid=25344); [example path list](https://raw.githubusercontent.com/Resike/BlizzardInterfaceResources/master/Resources/Data/ModelDisplayPath.lua)
- “For character models, each hairstyle/thick armor/etc is present in the mesh, so to render a character with a specific set of looks, different geosets (aka submeshes/mesh parts) will have to be enabled/disabled.” Official geoset types include Gloves, Boots, Sleeves, Legs, Shirt, Tabard, Robe, Cape, Torso, Toes — on the order of **tens of groups with a handful of variants each**, not “hundreds of tiny zones (e.g. upper forearm, lower calf, shoulders)” as a vertex-shader mask atlas. — [wowdev Character Customization](https://wowdev.wiki/index.php?title=Character_Customization&oldid=34753)
- Classic/WotLK-era body armor (chest, legs, boots, gloves, belt) is **not** a separate wrapped 3D mesh per item. Modders state that belts/bracers/mittens/boots/legs “do not have m2 and anim files in the objectcomponents folder. There are only BLP files in the texturecomponents folder.” Helms and shoulders **do** have separate M2s. Reply: “Those meshes are part of character model.” — [WoW Modding: M2 of some items](https://www.wowmodding.net/topic/1034-m2-anim-of-some-items/)
- ItemDisplayInfo drives **which geoset variant to enable** on that race’s character M2 (e.g. glove group 4 → 401–404 thin/folded/thick; boot group 5 → high/folded/puffed) plus **which body-texture patches to paste**. Helmets additionally use `HelmetGeosetVisData` to hide race-specific head geosets. — [wowdev ItemDisplayInfo](https://wowdev.wiki/index.php?title=DB/ItemDisplayInfo&oldid=30012)
- Texture compositing is real and **CPU/GPU paste into ~8–10 body sections** (upper/lower arm, hand, upper/lower torso, upper/lower leg, foot, plus later scalp/accessory), not “hundreds of zones.” The leaked/reimplemented vanilla client (`whoahq/whoa`) composites BLP skin + item textures into one `GxTex_Argb8888`/`Dxt1` base texture via `CCharacterComponent::RenderPrep*` / `PasteFromSkin` / `PasteToSection`. Layout example: ARM_UPPER 256×128, TORSO_UPPER 256×128, FOOT 256×64. — [whoahq Character Texture Pipeline](https://deepwiki.com/whoahq/whoa/5.2-character-texture-pipeline); [wowdev CharComponentTextureSections](https://wowdev.wiki/index.php?title=DB/CharComponentTextureSections&oldid=25346)
- Shadowlands customization is still **data-driven geosets + texture layers per ChrModel**, not a Human-Male armor template. Blizzard’s stated reason for the SL rewrite: “build up character models from multiple source textures instead of baking textures for each model/race/variation” — i.e. they were **already baking per race**, and wanted more data-driven texture assembly, not a runtime wrap. — [wowdev Character Customization](https://wowdev.wiki/index.php?title=Character_Customization&oldid=34753)
- Collection-style later armor (some chests/helms) can be separate skinned M2s that **share the character skeleton via bone remapping**. wow.export documents “collection-style models use character's bone matrices via remapping.” That is **shared-skeleton skinning of an already-authored mesh**, not morph-from-Human. — [wow.export CharacterExporter.js](https://raw.githubusercontent.com/Kruithne/wow.export/main/src/js/3D/exporters/CharacterExporter.js)

**Unreal Leader Pose / Unity bone remap — animation sharing, not body-shape wrap**

- Epic: Leader Pose “constructs the character by parenting skeletal mesh objects to a parent skeletal mesh object, and runs the animations exclusively on the parent.” Child meshes “do not use any Bone Transform Buffer and won't run any animations independently.” **Critical constraint:** “any child mesh object of the Leader Bone has to be a subset with the exact matching structure. You cannot have any other extra joints or skip any joints… extra or skipped joints will be rendered using the reference pose.” That is **pose sharing on an already-fitted mesh**, not “auto-wrap via morph targets.” Mesh merge even **drops morph targets**. — [Working with Modular Characters (UE 5.3)](https://dev.epicgames.com/documentation/en-us/unreal-engine/working-with-modular-characters-in-unreal-engine?application_version=5.3)
- Unity `SkinnedMeshRenderer.bones` can be remapped by name so clothing uses the character’s transforms. Community code copies the bone array; it does **not** change rest-pose volume. Clothing “needs to be skinned to the rig.” — [Unity SkinnedMeshRenderer.bones](https://docs.unity3d.com/ScriptReference/SkinnedMeshRenderer-bones.html); [Shared skeleton and animation state](https://discussions.unity.com/t/shared-skeleton-and-animation-state/13854)

**Elden Ring — discrete body type A/B, modest sliders, unit-size armor**

- Character creation is Body Type A/B plus Alter Body sliders (Head, Chest, Abdomen, Arms, Legs, Musculature Standard/Muscular). — [Fextralife Character Creation](https://eldenring.wiki.fextralife.com/Character_Creation)
- Eurogamer (German): “Alle Rüstungen haben eine Einheitsgröße und können von jedem Charakter getragen werden” — **all armors have a unit size** and can be worn by any character. Sliders do not author unique armor meshes. — [Eurogamer Elden Ring body sliders](https://www.eurogamer.de/elden-ring-koerper-aendern-kopf-brust-muskeln-bauch-arme-beine-behaarung)
- No FromSoftware engineering post was found that armor pieces carry matching morph targets (`Chest_Width`, `Arm_Muscular`) applied in lockstep with body sliders. The paste’s Elden Ring morph-target section is an Unreal marketplace tutorial projected onto FromSoftware.

**Guild Wars 2 — 4 dye channels are real; “human baseline + deformation matrices that warp Charr topology” is not documented**

- Dye: “Up to four different colors may be applied to an individual item”; result depends on cloth/leather/metal; API exposes `dye_slots` with optional **per-race overrides** (e.g. `HumanFemale`). That is **material-channel coloring**, not a mesh warp. — [GW2 Wiki Dye](https://wiki.guildwars2.com/wiki/Dye); [API dye channel thread](https://en-forum.guildwars2.com/topic/76946-api-and-dye-channel-definitions/)
- Cultural armor is **race-restricted authored sets**, not a runtime Charr deform of Human plate. — [GW2 Wiki Cultural armor](https://wiki.guildwars2.com/wiki/Racial_armor)
- Player reports (2013, still the public technical consensus): “humans, norn, and sylvari more or less share the same frame and armor meshes. **Charr and asura each require their own.** As things are now, that means 4 meshes for each armor.” Counter-claim in the same thread: some pieces look like stretched Human skins with clipping — i.e. **bad authored fits**, not a proud “deformation matrix.” — [r/Guildwars2 Asura armor issues](https://www.reddit.com/r/Guildwars2/comments/1ivksm/follow_charr_armor_issues_with_asura_armor_issues/)
- 2024 ArenaNet staff still **hand-adjust Charr legendary armor** (cover claws, more neck) from player screenshots. That is art revision, not an engine that “dynamically warps mesh topology to accommodate claws, tail holes, and a radically hunched spine.” — [Charr Obsidian Legendary Armor preview](https://en-forum.guildwars2.com/topic/143488-charr-obsidian-legendary-armor-updated-preview/)
- Paste citation [3] `r/Guildwars2/comments/1qyirj6` is a **2026 new-player question about loot/stats/dye**, not deformation matrices. — [How do armor sets work](https://www.reddit.com/r/Guildwars2/comments/1qyirj6/how_do_armor_sets_work_and_is_there_any_armor/)
- Paste citation [1] is a GW2 forum “art style and armors discussion”; [2] is r/GirlGamers “games like wow.” Neither is an ArenaNet pipeline document.

**FFXIV — per-race model files + hide flags + joint scale inheritance; Lalafell is not a Hyur blendshape**

- Gear files are named `c0101` Midlander male, `c0201` Midlander female, … `c1101` Lalafell male, `c1201` Lalafell female. “Depending on your race, you may find that most gear will not explicitly list your race here — this is because **many races share models**. In general, Hrothgar share models with Roegadyn; … Elezen, Au Ra, Miqo'te, and Viera will use the Hyur Highlander models of their respective gender.” — [FFXIV-Model-Exporting guide](https://github.com/Luggs123/FFXIV-Model-Exporting/blob/master/Guides/Main%20Guide.md)
- “FFXIV generally **scales joints for different races** (look into inheritance), **unless the piece of gear has a specific model for that race**.” “Roegadyn and Lalafell generally have their own models that aren’t scaled.” “**You cannot scale Hyur gear down for a Lalafell. The proportions are too different** and no amount of scaling will make it look right.” — [Daniel Barnes, FFXIV Modding with Blender](https://medium.com/@danielzbarnes/ffxiv-modding-insights-to-modding-with-blender-c10c45e817c5)
- Visibility is **attribute/shape-key flags** (`atr_arm`, `shp_arm`, BodyHideLongGloves, HeadShowEarMiqo, etc.), i.e. hide metadata — this part of the paste is directionally true, but it is **not** “aggressive deletion from the rendering pipeline of underlying limb meshes” as a unique FFXIV invention, and it is **not** a per-piece blendshape profile that preserves filigree on a Lalafell breastplate. — [XIV visibility reference](https://xivmodding.com/books/ff14-asset-reference-document/page/visibility-reference-tables)
- Paste citations [4] and [5] are r/gaming “WoW alternative” and r/rpg_gamers “fun detailed games.” Unrelated to Crystal Tools.

**Black Desert — bone-scale sliders + hide-body XML; not “real-time collision deformers” as the default armor fitter**

- A 2016 character-customization talk (comparing engines) states BDO body sliders “are **as far as I know not blend shapes at all they’re all just bone scale**” and that this **limits** how far you can push mass because clothing will clip. The proposed clothing solution in that talk is **matching-topology blendshape versions in a default pose** (an authoring/runtime morph of **same vertex count** clothing), not a collision hull that inflates armor off the body. — [Character Customization Discussion (YouTube)](https://www.youtube.com/watch?v=MGGN2826E7Q)
- BDO modding uses `partcutdesc.xml` “to erase the protruding body. You can not cut out clothes.” That is **hide body parts**, the same family as WoW geosets / FFXIV atr flags / BG3 vertex masks. — [Undertow BDO toolkit notes](https://www.undertow.club/threads/black-desert-online-nude-body-costume-mods-for-meta-injector-by-suzu.10110/page-63)
- Paste citation [6] `r/blackdesertonline/comments/407lpb` did not return an engineering post in this pass (Reddit often blocks fetch). Paste citation [7] `playblackdesert.com/en-us/Wiki?wikiNo=5` is a generic wiki URL, not a collision-deformer spec.

**Monster Hunter World — male and female armor are separately authored; Capcom said so**

- Capcom (Gamescom 2024), on Wilds: “In previous Monster Hunter games, **male and female armor were separate**.” “All characters can wear any gear” is the **new** Wilds change. World required a gender/body-type voucher to see the other set. — [PC Gamer](https://www.pcgamer.com/games/action/fashion-hunters-rejoice-as-monster-hunter-wilds-ditches-gendered-armor-capcom-confirms-all-characters-can-wear-any-gear/); [IGN](https://www.ign.com/articles/monster-hunter-wilds-finally-removes-gendered-armor-meaning-anyone-can-wear-anything)
- World files on disk are `f_equip` vs `m_equip`. Nexus guides **rename** `f_` → `m_` to mirror female armor onto male — proof the engine is **not** wrapping one mesh onto the other gender at runtime. — [Nexus: mirror female armor to males](https://www.nexusmods.com/monsterhunterworld/articles/482)
- Paste citation [1] `r/MonsterHunterWorld/comments/eu7g77` is “can you mix layered armor?” — a **gameplay** layered-armor question, not “Skeleton Sharing with Rigid Proximity Scaling” or “Physics-Driven Weapon Sockets.”

**Destiny 2 — class/gender authored armor + dye channels; “Transmog Matrix / voxelized standardization volumes” unfound**

- Bungie.net API wiki: gear has **dye slots** (default / locked / custom) with material properties (`primary_albedo_tint`, roughness, etc.) applied in the fragment shader. Armor channels in community dumps: ArmorPlate / ArmorCloth / ArmorSuit. That is **shader dyeing**, which the paste over-labels as “fully mathematical shaders” / “material ID system.” — [Bungie-net/api 3D Content Documentation (wiki page exists; 2019)](https://github.com/Bungie-net/api/wiki/3D-Content-Documentation); [Destiny-Collada-Generator Channels enum](https://github.com/TiredHobgoblin/Destiny-Collada-Generator/blob/Main/Shaders.cs)
- Bungie’s “Next Generation Armor” post is about **stat reworks**, not voxel volumes. — [Bungie Developer Insight](https://www.bungie.net/7/en/News/article/next_gen_armor)
- Paste citation [2] `r/DestinyTheGame/comments/1k5knhu` is a 2025 **art-direction rant** (“sci-fi soldier look vs fantasy”). It does not mention standardization volumes, under-mesh deletion, or a Transmog Matrix. — [Destiny 2’s armor design is frustrating](https://www.reddit.com/r/DestinyTheGame/comments/1k5knhu/destiny_2s_armor_design_is_frustrating)
- No primary Bungie source was found for “Strict Standardization Volumes” or “voxelized spatial boundary.” Hiding under-armor by not drawing the body in covered slots is **ordinary** (every game in this list does some version); “completely deletes underlying base body topology at runtime” as a unique Destiny pipeline is unsourced.

**Baldur’s Gate 3 — discrete body meshes per type; Larian tells modders to refit per race**

- Playable body files are separate GR2s: `HUM_F_NKD_Body_A`, `HUM_M_NKD_Body_A`, `HUM_FS_NKD_Body_A`, `HUM_MS_NKD_Body_A`, plus Dwarf/Halfling/Gnome/Dragonborn/Gith/Half-Orc prefixes. Humans/elves/drow/half-elves/tieflings **share** the HUM body; Gith/Dwarf/Gnome do not. Half-orcs default to HUM strong. — [BG3 Body Meshes Reference](https://wiki.bg3.community/Information/Meshes/Body-Meshes-Reference); [bg3.wiki Character creation](https://bg3.wiki/wiki/Character_creation) (“Elves, drow, half-elves, humans and tieflings have four options, all other races have two”)
- Official Armor Creation Guidelines (mod.io): “**If you want the armour to be available for other races, you’ll need to adjust it for each of those races individually.**” “certain races (e.g. dragonborn and dwarves) have different proportions.” “you’ll want to keep the **vertex order between versions identical**.” Boots/gloves: “Trouser and sleeve meshes need to **always be thinner** than the orange limit. They should **never stick out** … unless it is with the green vertex colour and will be hidden.” — [mod.io Armor Creation Guidelines](https://mod.io/g/baldursgate3/r/creation-guidelines-armor) (quoted via search index; page exists)
- Hide system is **vertex color + `VertexColorMaskSlots`** (Torso, upperarm, lowerarm, hands, feet, Sleeves, Pants, …) — about **twenty named slots**, not a runtime Skin-Wrap that compresses an inner shirt along vertex normals. — [bg3.wiki VertexColorMaskSlots](https://bg3.wiki/wiki/Modding:VertexColorMaskSlots); [bg3.wiki Meshes (Blender)](https://bg3.wiki/wiki/Modding:Meshes_(Blender))
- Community “Outfit Builder” uses **shapekeys as an authoring tool** to refit a mesh to another body type. That is DCC, not the runtime engine. — [Outfit Builder mention](https://bg3.wiki/wiki/Modding:Meshes_(Blender))
- Larian art: same rig reused; “elves and Tieflings also wear the same the exact same armor”; Gith “the armor is **adjusted to the figure**.” Modular **pieces** (body/belt/shoulders) are swapped, not wrapped. — [Adobe Substance: The Art and Technology Behind Creating Characters for Baldur’s Gate 3](https://www.youtube.com/watch?v=CVa4HJzHb_o)
- Paste body-type list “Standard, Strong, Short/Dwarf, and Half-Orc/Gnome” is **wrong**. Paste “Divinity Engine 4” is loosely OK. Paste “Universal Topology Mapping” / “dynamic Skin-Wrap Modifier Variant” are Blender modifier names, not a Larian runtime. Citations [3] YouTube `rZAB3VeLwQc` and [4] Facebook group post are not Larian engineering.

**Cloth capsules — real in Unreal, not “the MMO clipping solution”**

- Chaos Cloth collides against Physics Asset capsules/spheres; Epic recommends simple primitives for real-time. This is **cape/skirt simulation**, expensive, and orthogonal to fitting a boot onto a larger foot. — [Tech Artist’s Playbook for Chaos Performance](https://dev.epicgames.com/community/learning/tutorials/KWeX/unreal-engine-a-tech-artists-playbook-for-chaos-performance)
- NVIDIA PhysX Clothing / Chaos are **not** documented as WoW, FFXIV, or Destiny’s default armor-fit path.

**Closest real analog to “morph clothing to a body” is Skyrim BodySlide — an offline bake**

- Outfit Studio “Conform All” + “Copy Bone Weights” against a CBBE reference, then **Build** a static mesh for that slider preset. That is **authoring**, not a shipped MMO runtime. Search noise for “BDO armor collision deformer” mostly hits this Skyrim toolchain. — [Nexus BodySlide comments](https://www.nexusmods.com/fallout4/mods/43642?tab=posts)

### Inferences

- Classification **(a) real, documented**: texture compositing of ~8–10 body patches (WoW); geoset / hide-flag / vertex-mask coverage (WoW, FFXIV, BG3, BDO partcut); rigid bone attachments for helms/shoulders/weapons; shared-skeleton skinning (UE Leader Pose, Unity bones, WoW collections, FFXIV inheritance); 4 dye channels (GW2); shader dyes (Destiny); per-race or per-body-type authored armor (all of the named games that actually ship catalogues); optional cloth capsules for capes (Unreal).
- Classification **(b) real technique, wrong game / wrong stage**: Leader Pose and bone remapping attributed as “auto-wrap”; morph targets attributed as the MMO race fitter (they are used in character faces, some clothing sliders, and **offline** BodySlide); cloth capsules attributed as the default clipping fix for plate boots; mesh merge / texture bake attributed as menu-close behavior in every engine; FFXIV joint **scale inheritance** inflated into “blendshape profile per gear piece.”
- Classification **(c) hallucinated or inverted**: morph-from-Human-Male at runtime for every MMO; hundreds of body zones; real-time collision deformers as BDO’s default snug-fit; GW2 “deformation matrices” that punch tail holes; Destiny “Transmog Matrix” / voxel volumes; MHW “Physics-Driven Weapon Sockets” that read a cloak AABB; BG3 runtime Skin-Wrap compressing inner shirts; Elden Ring per-slider armor morphs; “Luminous Engine Variant” for FFXIV.
- The paste’s opening contrast — “Traditional games often hand-craft armor for each race, but an MMO requires a highly automated pipeline” — is **backwards**. The MMOs with the most races (WoW, FFXIV, GW2) are the ones that **kept** per-race (or per-body-family) authored assets. Automation in those pipelines is **texture paste, geoset tables, and joint-scale inheritance among similar skeletons**, not a universal wrap.

### Gaps

- No Blizzard GDC talk was found that describes authoring one Human-Male armor mesh and applying race delta morphs at load. If such a talk exists, it was not in the public wowdev / whoahq / ItemDisplayInfo record, which is the opposite architecture.
- Destiny 2’s exact under-mesh hide implementation (index-buffer trim vs. not drawing a body section vs. alpha) is not in a public Bungie engineering post. Community ripping shows dye channels; it does not show voxel volumes.
- BDO’s exact slider-to-clothing path (bone scale only vs. additional morphs on cash-shop outfits) is poorly documented in English first-party sources. Mod XML shows hide-body; it does not show collision hulls inflating armor.
- FromSoftware has no public armor-fit postmortem. Elden Ring slider range is small; clipping at extreme belly/chest is a known player complaint, which is **evidence against** a robust per-armor morph system.

## What is the MINIMUM system that solves Human-sized boots/gloves on a much larger Orc, vs a generalized “dynamic to any skeleton and mass” engine?

### Takeaway

The failure mode (Human boot sitting on an Orc shin, toes out, glove as a thin sleeve on a huge forearm) is a **rest-pose volume mismatch**. The minimum fix is **author an Orc-sized mesh that actually occupies the Orc foot/hand volume, skin it to the existing 65-joint bind, and hide or omit the uncovered body**. A generalized “dynamic to any skeleton and mass” engine is how you get shrink-wrapped Human mittens on an Orc, which is the current bug.

### Cited Findings

- Shrinkwrap / nearest-surface projection **cannot grow garment extent**. If the Human boot’s vertices do not extend past the Orc toes in rest pose, projecting them onto the Orc surface parks a Human-length boot on the Orc instep. That is a geometry fact, visible in every DCC shrinkwrap doc, and it is why MakeClothes-style tools require a **reference body of matching topology** rather than an arbitrary sculpt. (See the companion geometry-algorithm notes in this research folder; public DCC: Blender Shrinkwrap “Nearest Surface Point” moves vertices onto a surface, it does not inflate a last.)
- Larian’s official boot/glove rule is the industrial version of the same fact: **sleeves/trousers must stay inside a limit hull so boots/gloves can cover them; hide the overlap with vertex color**. They still require **a separately adjusted mesh per race**. — [mod.io Armor Creation Guidelines](https://mod.io/g/baldursgate3/r/creation-guidelines-armor)
- FFXIV: joint scale can reuse Hyur gear on Elezen/Miqo'te; **it cannot make a Lalafell boot from a Hyur boot**. — [Barnes](https://medium.com/@danielzbarnes/ffxiv-modding-insights-to-modding-with-blender-c10c45e817c5)
- WoW: Orc and Human are **different character M2s**. A boot geoset on `orcmale` is an Orc-proportioned submesh (or an Orc texture patch on the Orc foot), not a Human boot morphed by delta vectors. — [wowdev geosets](https://wowdev.wiki/index.php?title=Character_Customization&oldid=34753); [objectcomponents vs character mesh](https://www.wowmodding.net/topic/1034-m2-anim-of-some-items/)
- Unreal Leader Pose **will not fix this**. If you Leader-Pose a Human boot onto an Orc skeleton with different rest bone lengths, extra/skipped joints render in **reference pose**, and even a perfect bone-name match only applies **animation**. Rest-pose vertices stay Human-sized. — [UE Modular Characters](https://dev.epicgames.com/documentation/en-us/unreal-engine/working-with-modular-characters-in-unreal-engine?application_version=5.3)
- Copying body skin weights onto a boot (the paste’s “Dynamic Bone Weight Copying”) is a **DCC transfer** (BodySlide, Blender Data Transfer, FFXIV Transfer Weights). It assumes the boot vertices already sit on the body. Copying Orc foot weights onto a Human-sized boot still yields a Human-sized boot that deforms with the Orc ankle. — [Barnes Transfer Weights](https://medium.com/@danielzbarnes/ffxiv-modding-insights-to-modding-with-blender-c10c45e817c5)

**Minimum shipped-style system (2 discrete bodies, same rig family)**

1. **Two rest meshes per garment** (or one garment authored on the Orc volume from scratch): Human pack already exists; Orc pack must **cover** Orc foot/hand/calf/forearm, not be a scaled Human shell.
2. **One skeleton contract** (already true: Mixamo 65 joints). Skin Orc clothes to that bind in Blender. Runtime only plays the existing pose. No Leader-Pose framework required beyond what Lite GPU skinning already does.
3. **Coverage hiding**: a small set of flags (hands, feet, lower legs, torso, hair) to disable the nude body under opaque clothes. WoW geosets / FFXIV atr / BG3 VertexColorMaskSlots / BDO partcut are all this. For a one-piece Orc body, hiding is “don’t draw OrcV1Body where the garment is watertight,” or split the Orc body into the same few partitions Human already has.
4. **Rigid sockets** for weapons/shields (already in Ashen). Optional per-item offset if a chest piece is bulky — a **static authored vector**, not a runtime AABB push. WoW shoulders/weapons are bone-linked M2s with ItemDisplayInfo flags (mirror, inherit anim), not physics sockets. — [ItemDisplayInfo flags](https://wowdev.wiki/index.php?title=DB/ItemDisplayInfo&oldid=30012)
5. **Stop the wrap fitter** as the source of truth. Shrinkwrap is acceptable only as a **starting cage** that an artist then **inflates and extends** so boots have a last and gloves have a cuff.

**What is *not* required to solve this screenshot**

- Morph targets from Human Male to Orc (different topology: print-sculpt vs MakeHuman).
- Hundreds of body zones.
- Runtime cloth capsules.
- GPU texture bake of skin+shirt+tabard.
- Crowd LOD / pre-baked distant mesh.
- Transmog appearance matrix.
- Collision deformers that push armor off muscle sliders (there are no muscle sliders).

### Inferences

- “Dynamic to the skeleton and mass of the model” as a **runtime** requirement over-asks. Skeleton is already shared. Mass is a **rest-pose authoring** problem. The honest name for the minimum system is **per-race fitted skinned meshes + hide covered body**.
- If a third race (Undead) is added later, the same minimum repeats: **author or retopo-fit the 8 items onto that rest mesh**, reuse the bind, reuse coverage flags. That is how FFXIV adds a body family (Roe/Hroth, Lala) and how BG3 adds Gith vs HUM.
- A generalized wrap engine is the **wrong** complexity class: it tries to solve “any future body” before solving “this Orc’s boots.” The paste’s architecture is that generalized engine.

### Gaps

- No public source gives a polygon budget or hour-count for “refit 8 low-poly garments onto a second body.” Larian’s guide implies it is a normal art task (limit hulls + per-race adjust), not an engine project.
- Whether Ashen’s Orc2 single-surface body can hide “feet only” without a partition mesh is an implementation detail, not answered by AAA docs. Partitioning the Orc body (Human already has `BodyUnderBoots` etc.) is the historically standard fix.

## For a 2-race, 8-item, Babylon Lite WebGPU slice targeting >120 FPS, which AAA features would be waste?

### Takeaway

Almost everything the paste copies from MMO-scale and cloth-sim stacks is waste at this scope. Keep: per-race meshes, shared bind, a handful of hide flags, rigid sockets. Drop: runtime cloth, texture compositing bake, crowd LOD, transmog matrix, morph-from-human, hundreds of zones, collision deformers, mesh-merge-on-menu-close.

### Cited Findings

- **Texture compositing / unique GPU bake at load.** WoW does this to collapse skin+underwear+shirt+tabard+pants into **one** character texture so a **raid of unique players** is not N blend layers each. whoahq: 256–512 composite, mip 6–9, paste per section. Ashen already streams **separate garment GLBs** with their own materials; there is no shirt-on-skin UV atlas, no tabard, no 40-player raid. Baking would add a GPU readback/upload hitch for no draw-call win on two local actors. — [whoahq texture pipeline](https://deepwiki.com/whoahq/whoa/5.2-character-texture-pipeline)
- **Crowd LOD / “at distance disable 3D attachments, swap to pre-baked mesh.”** WoW continent impostors exist (`TEX` blob textures for far terrain). Player LOD is an MMO concern. This slice measures **one actor** at 144 FPS / 46 draws. — [wowdev TEX/v0](https://wowdev.wiki/index.php?title=TEX/v0&action=edit) (far-continent blobs); the paste’s player-LOD sentence is unsourced as a universal MMO law.
- **Runtime cloth capsules (PhysX / Chaos).** Epic: cloth vs capsules is a **real-time sim** with CCD/self-collision cost; recommended only where cloth must move. Ashen’s 8 garments are mail/cloth/boots/gloves/hood/skirt **skinned**, not simulated capes. Enabling Chaos-class cloth on WebGPU Lite would fight the >120 FPS goal for zero coverage of the boot/glove bug. — [Chaos cloth collision](https://dev.epicgames.com/community/learning/tutorials/KWeX/unreal-engine-a-tech-artists-playbook-for-chaos-performance)
- **Transmog matrix / appearance collection.** Blizzard’s 2024 Item Appearance APIs are **account collection** endpoints, not a runtime mesh fitter. Destiny “transmog” is ornament application on class armor. Ashen has **8 catalogue IDs** and no appearance-unlock layer. — [Wowhead transmog API news](https://www.wowhead.com/news/item-appearance-and-transmog-collection-apis-now-available-for-world-of-warcraft-345687)
- **Skeletal mesh merge on menu close.** UE documents merge as a **high setup cost** that **cannot transfer morph targets**, used when **50 characters × 3 components** would be 150 draws. Ashen: 1 player, ~8 optional meshes, already ~46 draws at 960×540. Merge is a solution to a problem this slice does not have. — [UE Modular Characters merge table](https://dev.epicgames.com/documentation/en-us/unreal-engine/working-with-modular-characters-in-unreal-engine?application_version=5.3)
- **Hundreds of body zones / vertex-shader disable.** WoW: ~40 geoset *types* with small IDs; compositing: **10 sections**. BG3: ~20 named mask slots. FFXIV: a compact hide-flag bitfield. Inventing hundreds of zones is extra metadata with no art to drive it.
- **Morph targets on every armor piece matching body sliders.** Ashen has **no sliders**. Orc is a different mesh. UE merge even drops morphs. Face morphs (if added later) do not belong on boots.
- **4-channel dye bake into a runtime material pass for WvW.** GW2 dyes exist because of a **fashion endgame** and 50-player fights. Ashen garments have authored albedos. A dye atlas is a product feature, not a fit fix.
- **Leader Pose / Copy Pose graphs.** Lite already skins multiple meshes with one evaluated pose if they share the bind. Building an Unreal-style Leader Pose component is duplicating GPU skinning. Copy Pose (full anim graph per piece) is what Epic labels **high Game Thread + high Render Thread**.
- **Weapon socket push-out from armor AABB.** MHW/WoW do not document this. Ashen already has per-item grip offsets. A one-off authored stow transform is cheaper than a collision query.

### Inferences

- Waste = anything whose justification in the paste is “thousands of players” or “hundreds of armor permutations” or “body sliders.” None of those are the current product.
- Keep (cheap, matches the actual bug): **second rest-pose mesh per item**, **coverage flags**, **shared 65-joint skin**, **sockets**.
- Performance risk of the pasted stack on Lite/WebGPU: cloth sim + unique texture bake + per-piece morph evaluation + extra hide-zone vertex shader all add CPU/GPU work **while still leaving Human-sized boots** if the rest mesh is wrong.

### Gaps

- Babylon Lite’s exact morph-target and cloth support is out of scope for this public-source pass. Even if morphs exist, they are the wrong tool for Human→Orc volume.
- No measurement of Lite draw-call cost for 8 skinned garments vs 1 merged mesh on this hardware. Given 46 draws / 6.94 ms mean at 960×540 (assignment context), merge is unlikely to be the 120 FPS lever.

## What is the honest recommended architecture: per-race authored fits + coverage hiding vs runtime wrap vs blendshapes vs cage?

### Takeaway

**Per-race authored fits + coverage hiding.** Use wrap/cage/blendshapes only as **Blender authoring aids** to produce those fits, then freeze the GLB. Do not ship a runtime wrap, a Human-Male morph bank, or a cage solver on the WebGPU frame.

### Cited Findings

| Approach | What public pipelines actually use it for | Verdict for Human vs much-larger Orc, 8 items |
| --- | --- | --- |
| **Per-race / per-body authored skinned meshes** | WoW character M2 geosets; FFXIV `cXXXX` files + Lala/Roe unique; GW2 4 meshes/armor (Human-family / Norn / Charr / Asura); MHW `m_equip`/`f_equip`; BG3 `HUM_F` vs `DWR` vs `GNO` with official “adjust for each race”; Larian same-rig, adjusted armor for Gith | **Recommended.** Directly solves volume. Matches every named game that looks good on non-human bodies. |
| **Coverage hiding** (geosets, atr flags, vertex masks, partcut) | WoW ItemDisplayInfo geoset groups; FFXIV hide flags; BG3 VertexColorMaskSlots; BDO partcutdesc | **Recommended, small.** Prevents Orc toes/skin showing if the boot is opaque. Human already has partitions; Orc2 needs equivalent or a watertight boot. |
| **Shared skeleton / Leader Pose / bone remap** | UE Leader Pose; Unity `bones`; WoW collection remapping; FFXIV joint inheritance among **similar** races | **Already have the bind.** Do not build a new runtime. Will **not** enlarge a Human boot. |
| **Texture compositing** | WoW CCharacterComponent paste into 10 sections | **Not needed** at 8 unique garment GLBs / 1 player. Revisit only if a future shirt-on-skin UV is adopted. |
| **Dye / shader channels** | GW2 4 channels; Destiny dyes; BG3 MSKColor | **Product cosmetics**, not a fit fix. Optional later. |
| **Runtime wrap / shrinkwrap** | Not the shipped MMO path. DCC starting point. Current Ashen fitter. | **Reject as runtime.** Failed on boots/gloves by construction (no new extent). |
| **Blendshapes / morph-from-Human** | Faces; some clothing sliders; BodySlide **offline**; same-topology clothing in some customizers | **Reject as runtime for Orc.** Print-sculpt topology ≠ Human. Would need a morph on **every** item × **every** race pair. FFXIV explicitly cannot blendshape Hyur→Lala. |
| **Cage / surface deform / RBF transfer** | DCC retarget (Maya wrap, Blender Surface Deform, commercial wrap deformers) | **Authoring only.** A cage can help **inflate** a Human tunic toward an Orc torso if an artist then **extends cuffs and soles**. Do not run it per frame. |
| **Cloth capsules** | Unreal Chaos capes/skirts | **Reject** for this catalogue. Skirt can stay skinned (WoW robe geoset, FFXIV skirt bones). |
| **Collision deformers (body pushes armor)** | Unsourced as a shipped default; expensive; still needs a garment that **covers** | **Reject.** |

- Larian (official): per-race adjust + hide-by-vertex-color + width limits for boots/gloves. — [mod.io guidelines](https://mod.io/g/baldursgate3/r/creation-guidelines-armor)
- FFXIV (modder, inheritance is client behavior): scale among a family; **unique mesh** when proportions break. — [Barnes](https://medium.com/@danielzbarnes/ffxiv-modding-insights-to-modding-with-blender-c10c45e817c5)
- WoW (format): race M2 + geoset + texture paste + attachment M2. — [wowdev](https://wowdev.wiki/index.php?title=Character_Customization&oldid=34753)
- Capcom: previous MH armor was **separate gendered meshes**. — [PC Gamer / Capcom](https://www.pcgamer.com/games/action/fashion-hunters-rejoice-as-monster-hunter-wilds-ditches-gendered-armor-capcom-confirms-all-characters-can-wear-any-gear/)
- Epic: Leader Pose = pose share, matching joint subset, **no** isolated physics; merge = draw-call tool that **kills morphs**. — [UE 5.3 modular characters](https://dev.epicgames.com/documentation/en-us/unreal-engine/working-with-modular-characters-in-unreal-engine?application_version=5.3)

### Inferences

- The pasted “completely refactor to be dynamic to skeleton and mass” request, if implemented as written, would **reproduce the bug** (runtime wrap/morph of Human assets) while adding systems Ashen does not have the catalogue, crowd, or sliders to justify.
- Honest architecture for this slice:
  1. **Source of truth:** `equipment/` Human GLBs and `equipment-orc/` Orc GLBs, same item IDs, `ORC_EQUIPMENT_FIT` already declared.
  2. **Art:** rebuild Orc boots/gloves/cuffs to **cover** the print-sculpt foot/hand (extrude a last and a gauntlet, do not shrinkwrap a Human shoe onto the dorsum). Tunics/trousers: inflate **and** extend hems; then skin to SourceArmature.
  3. **Runtime:** stream the race pack you already stream; hide body parts you already hide on Human; do not add a wrap compute pass.
  4. **Optional authoring tools:** Blender Surface Deform or a cage from Human→Orc as a **first guess**, followed by a mandatory coverage check (boot AABB contains Orc foot; glove contains Orc hand). That check is a **test**, not an engine.
- If the user later wants **sliders** (muscle, belly), *then* consider **same-topology morphs on body + clothes** (the honest BDO/BodySlide lesson) — still per-race base meshes, still not Human→Orc.

### Gaps

- No first-party Blizzard/ArenaNet/Square/Pearl Abyss paper was found that matches the pasted “Master-Slave Skinned Mesh Renderer Alignment Architecture” diagram. Treat that diagram as LLM original, not a reverse-engineered engine.
- Cage vs wrap vs sculpt-from-scratch for the 8 Orc items is an art-time choice. Public sources only constrain the **runtime** (don’t) and the **acceptance test** (garment must cover the larger body, then hide under-mesh).

---

## Appendix: paste citations vs what they actually are

| Paste citation | Actual page | Supports the claim? |
| --- | --- | --- |
| GW2 [1] en-forum topic 13250 art-style-and-armors | Player art-style discussion | No |
| GW2 [2] r/GirlGamers games_like_wow | Unrelated game-rec thread | No |
| GW2 [3] r/Guildwars2/1qyirj6 | New-player loot/dye/stats | Dye exists; no deformer |
| FFXIV [4] r/gaming WoW alternative | Unrelated | No |
| FFXIV [5] r/rpg_gamers detailed games | Unrelated | No |
| BDO [6] r/blackdesertonline/407lpb | Not independently verified here | Unproven |
| BDO [7] Wiki?wikiNo=5 | Generic wiki URL | No |
| MHW [1] r/MonsterHunterWorld/eu7g77 layered armor | Gameplay layered armor | No |
| Destiny [2] r/DestinyTheGame/1k5knhu | Art-direction complaint | No |
| BG3 [3] youtube rZAB3VeLwQc | Not a Larian engineering talk (unverified content) | No |
| BG3 [4] Facebook group post | Not a primary source | No |
)