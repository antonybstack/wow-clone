# How shipped MMOs fit clothing and armor onto different races and body types

Scope: documented production pipelines (engineering talks, official blogs, patents, and dated reverse-engineering of shipped clients). Marketing permutation counts and unsourced architecture lists are flagged. This is evidence for a small Babylon Lite WebGPU game with **two** Mixamo 65-joint bodies, not an MMO with thousands of concurrent players.

Source classes used below:

- **Official / first-party:** Blizzard Engineer’s Workshop (2020); Square Enix CEDEC 2010 (4Gamer report); ArenaNet character-art blog (2011); ZeniMax GDC 2015 “Tech Art in Tamriel”; CIG CitizenCon 2948 / Around the Verse transcripts; Funcom Conan Exiles modelling primer; Pearl Abyss Adventurer’s Guides; Roblox patents.
- **Unofficial reverse-engineering (treat as such):** wowdev.wiki M2/SKIN/DBC docs; whoahq/whoa reconstruction of the Vanilla-era `CCharacterComponent` client; TexTools / XIV modding docs; community WoW/GW2 writeups.

---

## How did World of Warcraft historically handle Human vs Orc/Tauren/Gnome armor? Per-race authored meshes vs runtime wrap vs texture-only layers?

### Takeaway

Classic-through-modern WoW does **not** wrap a single Human Male armor mesh onto Orc/Tauren/Gnome at runtime. Each race×gender has its own skinned character `.m2` with geosets already in the mesh; most armor is **texture pasted onto that race’s body UV**, while helmets/shoulders/belts (and later extra Legion pieces) are **separate attached models**, often per-race deformations of a Human Male hero piece. Texture compositing is CPU paste (later SIMD), not a GPU cloth wrap.

### Cited Findings

- Playable characters historically live at per-race paths such as `character/orc/male/orcmale.m2`, `character/human/male/humanmale.m2`, `character/tauren/male/taurenmale.m2`, `character/gnome/male/gnomemale.m2` (and female counterparts). Those paths appear throughout Blizzard interface resource dumps of display IDs. — [Resike/BlizzardInterfaceResources `ModelDisplayPath.lua`](https://raw.githubusercontent.com/Resike/BlizzardInterfaceResources/master/Resources/Data/ModelDisplayPath.lua)
- wowdev: “For character models, each hairstyle/thick armor/etc is present in the mesh, so to render a character with a specific set of looks, different geosets (aka submeshes/mesh parts) will have to be enabled/disabled.” Geoset groups include gloves (04\*\*), boots (05\*\*), sleeves (08\*\*), legs (09\*\*), chest (10\*\*), pants (11\*\*), tabard (12\*\*), robe (13\*\*), cape (15\*\*), belt (18\*\*), armored torso (22\*\*), plus later groups for tails, tusks, Mechagnome limb replacements, Dracthyr body size, etc. — [wowdev Character Customization](https://wowdev.wiki/Character_Customization) (unofficial)
- `ItemDisplayInfo` does not store a single shared armor mesh. It stores (a) optional left/right **attached model names** (shoulders, helms), (b) **geosetGroup** integers that turn on/off those body geosets, and (c) **eight/nine section textures** (UpperArm, LowerArm, Hands, UpperTorso, LowerTorso, UpperLeg, LowerLeg, Foot, later Accessory). — [wowdev DB/ItemDisplayInfo](https://wowdev.wiki/DB/ItemDisplayInfo) (unofficial)
- Vanilla-era client reconstruction: `CCharacterComponent` composites those sections into one character skin. There are **10 body sections** (ARM_UPPER through HEAD_LOWER), not hundreds. Paste is CPU: opaque / 1-bit / 8-bit alpha into `s_textureBuffer` (256–512, ARGB8888 or DXT1), then uploaded. Item slots have a hardcoded priority table (shirt < chest < bracers < gloves on the lower arm, etc.). Paths load from `Item/TextureComponents/...`. — [whoahq/whoa Character Texture Pipeline](https://deepwiki.com/whoahq/whoa/5.2-character-texture-pipeline); source files [`CCharacterComponent.cpp`](https://github.com/whoahq/whoa/blob/74bc963a/src/component/CCharacterComponent.cpp) (unofficial reconstruction of ~1.12)
- `CharComponentTextureSections` stores the **pixel rectangles** of those sections inside the combined skinning texture (X/Y/Width/Height per layout). Enum: ARMS_UPPER, ARMS_LOWER, HANDS, TORSO_UPPER, TORSO_LOWER, LEGS_UPPER, LEGS_LOWER, FEET, ACCESSORY, SCALP_UPPER, SCALP_LOWER. — [wowdev DB/CharComponentTextureSections](https://wowdev.wiki/DB/CharComponentTextureSections) (unofficial)
- Independent 2018 reconstruction (Pandaren female + Bloodwake): the body is **one mesh of ~90 submeshes**; armor on the body is “a dozen of small textures” pasted onto a shared UV layout whose left half is “the exact same layout for every single playable race”; helmets/shoulders/belt buckles are **separate models**. Helmet filenames carry race+sex suffixes (`_paf` = Pandaren Female); “Each race has its own helmet models, one for each sex, which are more often than not deformed versions of the base helmet modeled around the male human (`_hu_m`).” — [Ze Workshop, 2018-10-24](https://zeworkshop.wordpress.com/2018/10/24/recreating-world-of-warcrafts-character-textures-in-unity/)
- Same writeup: since Legion, some sets add extra **skinned collection pieces** (wrists/hands/hips/boots) as additional submeshes, not just helm/shoulder attachments. — [Ze Workshop, 2018-10-24](https://zeworkshop.wordpress.com/2018/10/24/recreating-world-of-warcrafts-character-textures-in-unity/)
- Official Shadowlands engineering (2020): **before** the rewrite, “each unique set of customization options required its own texture.” New options sent permutations “into the range of millions,” so they “wrote a brand-new character system to **procedurally generate player textures on the fly**.” Texture processing was “rewritten from scratch using **SIMD**” plus shared-resource caching so duplicate characters reuse work. Intermediate example: greyscale + mask → procedurally colorized tattoo. This is **CPU SIMD compositing of customization/skin layers**, not a documented GPU cloth-fit bake, and not a change to the per-race body mesh strategy. — [Blizzard Engineer’s Workshop, 2020-11](https://news.blizzard.com/en-gb/article/23564386/engineers-workshop-enhancing-character-customization)
- Official history in the same article: launch (2004) optimized for low min-spec (even individual fingers were a budget question); per race×gender only **five** customization features (later eight in Legion); designers abused the **item paste hierarchy** (shirts first) to fake Demon Hunter tattoos via alpha. New DB layout is data-driven geosets/materials rather than a baked texture per combo. Silent conversion used “almost 9,000 rules.” — [Blizzard Engineer’s Workshop, 2020-11](https://news.blizzard.com/en-gb/article/23564386/engineers-workshop-enhancing-character-customization)
- Heritage armor (Tauren/Gnome 2019; Orc/Human 2023) is **race-locked transmog**, i.e. unique authored sets, not a shared mesh worn by other races. Wowhead: “The items have a race restriction.” — [Blizzard news, Heritage Armor](https://news.blizzard.com/en-us/article/22994612/rise-up-and-stand-tall-with-new-tauren-and-gnome-heritage-armor); [Wowhead, 2023-03-21](https://www.wowhead.com/news/orc-and-human-heritage-armor-models-now-in-dressing-room-332038)
- Player-forum engineering folklore (not Blizzard): “armor in wow is mostly textures. Majority of armor sets contains up to 4 models attached: Left Shoulder, Right Shoulder, Belt Buckle and Helmet. … Helmets are actually adjusted to fit different heads. Shoulders and buckles are just attached to special attachment points that are just bones with set scaling.” Also: “They have actually said that they are exploring AI tools … a big chunk of gear still requires custom fittings.” Treat as **unsourced player claim** unless a Blizzard quote is produced. — [EU WoW forums, 2024-09-06](https://eu.forums.blizzard.com/en/wow/t/armor-fitting-tool-idea/534704)

### Inferences

- Historical WoW clothing on Human vs Orc/Tauren/Gnome is a **hybrid of three authored things**, not runtime wrap:
  1. **Per-race body `.m2`** with all geoset variants already in the file (skinny vs bulky gloves, robe vs pants, armored torso, tails/tusks).
  2. **Shared-layout section textures** (`Item/TextureComponents`) composited onto that race’s skin UV (so the same chest texture *layout* can paint an Orc and a Human, but it is painted onto different meshes).
  3. **Per-race attached 3D pieces** (helms especially) that artists deform from a Human Male hero mesh.
- Tauren/Gnome/Orc bulk is **not** solved by wrapping Human armor. It is solved by a different body mesh + geoset LOD of “thick” gloves/boots/torso + race-scaled attachments. Texture-only layers are the cheap bulk of chest/legs/gloves/boots; 3D swap is reserved for silhouette (helm/shoulder/cloak/robe geosets, later collection pieces).
- “Runtime wrap” in the cloth-simulation / cage-fit sense is **not** how WoW shipped player armor.

### Gaps

- No first-party Blizzard document was found that states “we deform every armor from Human Male at runtime.” The `_hu_m` helmet observation is community (Ze Workshop 2018), consistent with file suffixes, but not an official pipeline paper.
- Exact modern (Shadowlands+) GPU vs CPU split for the *item* texture paste (as opposed to customization tattoos) is not fully documented in the 2020 blog; the blog describes SIMD procedural generation of customization permutations.
- No public count of unique helm meshes per race×item. Community says “each race has its own helmet models”; that is plausible from suffixes but not enumerated here.

---

## What is documented about Guild Wars 2, FFXIV, Black Desert clothing/armor across races?

### Takeaway

**GW2** authors separate armor **meshes per race (and per weight class)** and *replaces* body parts rather than wrapping clothes; mixing weights leaves holes because cutoffs differ. **FFXIV** authors a small set of **base race meshes** (Midlander M/F, Highlander M, Roe M, Lalafell, plus unique hats) and **runtime bone-scales** the rest down a documented ancestry tree; hide/show uses mesh attributes + shape keys, computed when gear changes. **BDO** is not a shared-race clothing problem: each **class is its own body/skeleton**, and Pearl outfits are **class-locked authored meshes** that hide the combat gear; body sliders morph the class body, they do not retarget another class’s clothes.

### Cited Findings

#### Guild Wars 2

- Official 2011 (Aaron Coberly, character art lead): armor is **six interchangeable parts** (helm, shoulders, coat, legs, gloves, boots). One piece can **replace multiple slots** (coat that includes shoulders+helm). Dye was the permutation multiplier (“over a billion unique looks”). Body-shape sliders were promised; professions share **weight class** appearance, not unique class meshes. — [ArenaNet blog “Designing Humans”, 2011-02-09](https://web.archive.org/web/20110212143639/http://www.arena.net/blog/designing-humans)
- Wiki: cultural (racial) armor is **hard-locked per race** — nine sets per race (3 tiers × 3 weights). — [GW2 wiki Cultural armor](https://wiki.guildwars2.com/wiki/Racial_armor)
- Wiki gallery rules: Asura and Charr armor screenshots use **one gender (“both”)** because “female and male armor appearances are identical”; Human/Norn/Sylvari need separate male and female shots. — [GW2W:Armor gallery formatting](https://wiki.guildwars2.com/wiki/Guild_Wars_2_Wiki:Armor_gallery_formatting)
- Player technical consensus, repeatedly stated as matching old ArenaNet answers (original 2012 forums deleted; treat as **second-hand**): “If you change your body armor skin, you don’t just put a new coat on, but technically **replace the upper body** of your character model with that of the new skin.” Light/medium/heavy have **different cut-off points**; mixing weights produces **holes you can see through**, “like three different brands of lego.” Medium chests carry skirts/coattails; light/heavy put dangly bits on legs. — [GW2 forums “Free For All”, 2019-09-26](https://en-forum.guildwars2.com/topic/61406-free-for-all/); [GW2 forums, 2022-03-21](https://en-forum.guildwars2.com/topic/111720-it%E2%80%99s-2022-isn%E2%80%99t-it-time-we-made-armor-styles-interchangeable/)
- 2013 Reddit (player, not ArenaNet): “humans, norn, and sylvari more or less share the same frame and armor meshes. Charr and asura each require their own. … that means **4 meshes for each armor**. Adding different female armor to the asura and charr would mean 6.” A reply disputes quality (“stretched human armor”) but not the mesh-count economics. — [r/Guildwars2, 2013-07-23](https://www.reddit.com/r/Guildwars2/comments/1ivksm/follow_charr_armor_issues_with_asura_armor_issues/)
- Datamine anecdote (2014): new outfit models were added **per race/gender into the .dat**; “The humanoid versions are basically the same with different proportions.” Asura needed unique hoods/boots for ears. — [r/Guildwars2 datamine, 2014-11-09](https://www.reddit.com/r/Guildwars2/comments/2lrvz6/datamining_new_outfit_models_asura_charr_and/)

#### Final Fantasy XIV

- Official CEDEC 2010 (Keiichi Baba, Haruya Ishii; Square Enix character model/texture chiefs), reported 2010-09-01: goals included “as many variations as possible in limited capacity.” Hyur shipped **two clans** (Midlander + muscular Highlander) specifically for overseas body-type demand. Equipment mix clipping was solved with two runtime techniques combined:
  1. **Show/hide polygons** on part of an equipment mesh.
  2. **Shape deformation** (“シェイプ変形”) — animate vertices to change the whole equipment shape.
  Plus per-body-part **cut planes** and per-item **display priority**. “Shape deformation and priority calculations are performed **in real time every time the player changes equipment**.” Texture variation: 60 cloth/leather/metal textures × parameters → ~250 looks; synthesis (crafting) retints the same boot mesh. — [4Gamer CEDEC 2010 report](https://www.4gamer.net/games/092/G009287/20100901009/)
- Unofficial but detailed TexTools/modding docs (treat as reverse-engineering of the **shipped file format**, not Square PR):
  - Each gear file can contain **racial models** keyed `c0101` Midlander Male … `c1801` Viera Female. “If your item lists HYUR (M) as the only item available, that means all of the other races will **scale and be based off of this SINGULAR model**.” — [XIVGuide “Exporting from TexTools”, 2024-09-15](https://github-wiki-see.page/m/rgd87/XIVGuide/wiki/Exporting-from-TexTools); [TexTools Advanced Import](https://docs.google.com/document/d/1WQ559bkwMQqJu-W1sZ97G04TNLsWt1JfX9T37GYdBas/edit)
  - Ancestry tree (modding docs): **four families** — Females from Midlander F; most males from Midlander M; “Huge Males” Roe M → Hroth M; Lalafell separate. “With clever math models can **rescale on the fly** to fit different races without requiring a separate unique model.” — [XIVGuide](https://github-wiki-see.page/m/rgd87/XIVGuide/wiki/Exporting-from-TexTools)
  - “When items are shared among races, the item goes through Square-Enix’s **racial bone scaling** if the player it’s equipped on is not the same as the Base Race of the Item.” Weights that are not “pixel-perfect” scale badly. — [TexTools 1.9.7 Advanced Import Guide](https://docs.google.com/document/d/1WQ559bkwMQqJu-W1sZ97G04TNLsWt1JfX9T37GYdBas/edit)
  - Recommended unique meshes: accessories/gloves/boots can often be Midlander M only; **body/leg gear** wants the five “bold” bases; **hats usually unique per race**. Adding a racial model in TexTools “will attempt to racially transform one of the other models.” — [TexTools Item Metadata Settings Guide](https://docs.google.com/document/d/1M04dbdV1qUt0EzRalvwbB1oI3aPT6t8KEf9KgQfGn6E/edit)
  - Hide-body: mesh **attributes** (`atr_nek` neck, `atr_hij` wrist, `atr_ude` elbow, `atr_sne` shin, `atr_kos` waist, …) auto-hide parts when overlapping gear is equipped. **Shapes** (`shp_kat` / `shp_ude` / `shp_hij` for long/mid/short gloves; boot equivalents) are morphs triggered when an attribute hides. Visibility flags on metadata (`BodyHideLongGloves`, `BodyShowLeg`, …) are the inverse. — [xivmodding Attribute tables](https://xivmodding.com/books/ff14-asset-reference-document/page/attribute-reference-tables); [Shapes reference](https://xivmodding.com/books/ff14-asset-reference-document/page/shapes-reference-table/export/html); [TexTools Advanced Import](https://docs.google.com/document/d/1WQ559bkwMQqJu-W1sZ97G04TNLsWt1JfX9T37GYdBas/edit)
- Official-adjacent player coverage: Viera/Hrothgar **could not wear most hats** from Shadowbringers (2019) until patch 7.3 (2025); Yoshida: team “managed most of them, except for metal pieces like helmets.” This is the public cost of **not** auto-fitting unique heads. — [PC Gamer, 2025-06-23](https://www.pcgamer.com/games/final-fantasy/final-fantasy-14-is-doing-what-it-should-have-done-6-years-ago-and-fulfilling-its-promise-to-let-every-race-wear-hats/)
- Dawntrail graphical update (Game Developer / 2023) discusses per-race **skin/fur shaders** (Hyur/Elezen skin vs Lalafell doll-like vs Hrothgar fur), not a new clothing-fit algorithm. — [Game Developer, 2023-11-22](https://www.gamedeveloper.com/art/what-goes-into-graphically-updating-a-decade-old-mmorpg-like-final-fantasy-xiv)

#### Black Desert Online

- Official Adventurer’s Guide: character creation exposes **body Shape** (height/width), **Muscle** (torso/arms/legs separately), tattoos, plus face sliders. Appearance can be changed later via Beauty Salon / coupons. This is **per-class morph of that class’s body**, not a shared clothing cage. — [BDO wiki “Customization”, wikiNo=5](https://www.naeu.playblackdesert.com/wiki?wikiNo=5)
- Official outfit docs: “**Each outfit box can only be opened and equipped by the designated class.**” Combat equipment and appearance slots are separate; a Pearl outfit **hides** the corresponding armor visuals. — [BDO wiki “Outfit Additional Details”, wikiNo=395](https://www.naeu.playblackdesert.com/Wiki?wikiNo=395); [BDO wiki “Outfits & Costumes”, wikiNo=67](https://www.naeu.playblackdesert.com/Wiki?wikiNo=67)
- Japanese community wiki (game mechanics, not Pearl Abyss engineering): paid costumes are **sold per class**; you can buy another class’s box but “the costumes you can equip are of course only those for your own class.” An Outfit Swap Box exists specifically “to allow your character to wear other classes’ exclusive outfits” as a special product — i.e. the default engine does **not** share outfit meshes across classes. — [blackdesert.swiki.jp アバター](https://blackdesert.swiki.jp/index.php?cmd=edit&page=%E3%82%A2%E3%83%90%E3%82%BF%E3%83%BC); [Pearl Abyss Asia wiki, Outfit Swap Box](https://blackdesert.pearlabyss.com/Asia/en-US/Game/InGame/Wiki?_masterWikiNo=218)
- No Pearl Abyss GDC/CEDEC paper was found that describes a runtime clothing-fit solver across classes. Public material is store/UX documentation.

### Inferences

- **GW2 ≈ authored mesh swap per race×weight**, with body-part replacement (not overlay). Human/Norn/Sylvari are close enough to share a humanoid frame; Charr/Asura are extra mesh families. Weight-class cutoff is a **permanent art-contract**, not a bug.
- **FFXIV ≈ one (or few) authored meshes + runtime bone scale + attribute hide + shape-key cuff morphs.** Midlander Male is the documented *base* for many male items, which is the closest shipped analog to “morph from Human Male,” but it is **bone scale of an already-skinned item**, not generating a new mesh from Human morph targets at load. Unique heads (Viera/Hrothgar hats) still require hand work years later.
- **BDO ≈ unique mesh per class (the “race”)**, morph sliders on that body, outfits authored per class. Sharing clothes across bodies is a **shop SKU problem**, not a solver problem.

### Gaps

- No ArenaNet engineering post with file formats, bone counts, or a first-party quote on the four-mesh-per-armor figure (the 4-mesh number is 2013 player economics).
- Square Enix has not published the actual bone-scale matrices; TexTools documents the *behavior* and race IDs.
- Pearl Abyss has not published how body sliders interact with outfit skinning (morph the body only vs morph clothes with the body). Official UI copy only says you can adjust body shape.

---

## What is the actual role of texture compositing vs 3D mesh swap vs hide-body-parts?

### Takeaway

Shipped MMOs overwhelmingly use **hide/replace body parts + a small number of attached 3D pieces**, with **texture compositing** used to cheaply vary the *look* of the remaining body mesh. Runtime cloth wrap / cage-fit exists in other products (Roblox, Kingdom Come, Star Citizen cloth) but is **not** the historical WoW/GW2/FFXIV/BDO player-armor path. Layer-mix is resolved with **priority tables, cut planes, or attributes**, computed on equip, then the result is a static skinned mesh.

### Cited Findings

#### Texture compositing (cheap albedo / material variation on a shared body UV)

- WoW: 8–10 **component sections** pasted with slot priority into one character texture; base skin opaque, items alpha-over. Vanilla client does this in `CCharacterComponent::RenderPrep*` on GPU lock/latch. — [whoahq texture pipeline](https://deepwiki.com/whoahq/whoa/5.2-character-texture-pipeline); [wowdev CharComponentTextureSections](https://wowdev.wiki/DB/CharComponentTextureSections)
- WoW Shadowlands: customization permutations in the millions forced **procedural on-the-fly texture generation** with SIMD and sharing, replacing “one unique texture per option combo.” — [Blizzard Engineer’s Workshop, 2020](https://news.blizzard.com/en-gb/article/23564386/engineers-workshop-enhancing-character-customization)
- FFXIV CEDEC 2010: 60 material textures × shader parameters → ~250 looks; crafting synthesis changes boot albedo without a new mesh. Dawntrail gear uses **colorset rows + index maps** (modding docs) rather than a full-body bake. — [4Gamer CEDEC 2010](https://www.4gamer.net/games/092/G009287/20100901009/); [XIVGuide textures](https://github-wiki-see.page/m/rgd87/XIVGuide/wiki/Exporting-from-TexTools)
- Destiny “Mashup” (GDC talk, Bungie): bits flagged as armor/cloth/suit take **dye channels**; each player gets their own texture/poly budget because unique gear is expected. This is **bit assembly + material flags**, not MMO race wrap. — [GDC “Building Customizable Characters for Bungie’s Destiny”](https://www.youtube.com/watch?v=V9KBUXyGnAA)
- Star Citizen “layer blend shader” (CitizenCon 2948): characters are items; materials are masked per region and combined at render so armor color/style can swap without unique baked whole-body textures. — [CitizenCon 2948 panel](https://www.youtube.com/watch?v=JQEQmO9uX28)

#### 3D mesh swap / part replacement (the actual silhouette)

- WoW: geosets already in the race `.m2`; items pick which glove/boot/robe/torso geoset is on; helms/shoulders/cloaks are attached `.m2`s. Priority: gloves beat chest sleeves, chest robe beats pants, etc. Decompiled WoD `GeosRenderPrep` is linked from wowdev. — [wowdev ItemDisplayInfo](https://wowdev.wiki/DB/ItemDisplayInfo)
- GW2: changing a chest **replaces the upper-body mesh**. Weights are incompatible at the seam. Outfits are a fourth “weight” that covers all slots so artists need not seam against every existing skin. — [GW2 forums 2019](https://en-forum.guildwars2.com/topic/61406-free-for-all/); [ArenaNet 2011](https://web.archive.org/web/20110212143639/http://www.arena.net/blog/designing-humans)
- ESO (GDC 2015, Richard Katz, ZeniMax): “geometry is broken up into body parts **eight for the basic body** — torso, heads, upper arms, lower arms, hands, upper legs, lower legs and feet — another **half dozen deformable clothing bits**.” At launch “about a **dozen variations per gender**”; later “up to about **thirty variants on some body sections**” plus rigid attachments. Seams, skin weights, and vertex normals must match exactly. Playable characters needed **one draw call**, humanoids **≤77 bones**, no LOD of geometry or skeleton, up to **200 players** on screen in PvP. — [GDC YouTube “Tech Art in Tamriel”](https://www.youtube.com/watch?v=5YBJaXHFoSA); [GDC Vault listing](https://www.gdcvault.com/play/1022291/Technical-Artist-Bootcamp-Tech-Art)
- Conan Exiles (Funcom internal primer, published): modular slots Head/Top/Bottom/Hands/Feet with **hard seams**. Long gloves/boots swap to `_tucked` meshes and **hide** Forearms/Legs. “Polygons on the body that are not visible under the armor meshes are **deleted**. The body mesh is **attached to the armor piece**.” Male→female is **offline lattice/FFD conversion**, not runtime. Skin Wrap in Max, then a Skin modifier. — [Conan Exiles Armor and Clothing modelling Primer](https://www.conanexiles.com/wp-content/wiki/2693791979.html)
- Skyrim ( Bethesda, via modder explanation of vanilla): an ArmorAddon **replaces the whole torso nif** (body+armor together), it does not overlay a separate armor mesh on a nude body. Custom races therefore need new nifs for every armor. — [Nexus Creation Kit thread, 2017](https://forums.nexusmods.com/topic/6211136-le-default-body-mesh-appears-when-custom-meshed-race-wears-armor/)

#### Hide-body-parts / zone culling (don’t draw what clothes cover)

- FFXIV: attributes + visibility flags + shape keys, evaluated **on equip**. CEDEC 2010 already described polygon show/hide + cut planes + priority. — [4Gamer](https://www.4gamer.net/games/092/G009287/20100901009/); [xivmodding attributes](https://xivmodding.com/books/ff14-asset-reference-document/page/attribute-reference-tables)
- Star Citizen (Josh Herman / Paul Riccio, Around the Verse + CitizenCon 2948): **zone culling**. Early: hide whole torso/arm/leg. Later: “I think it’s **32 zones** I might get that wrong but it’s between **30 and 40 zones**” (another quote: “around 20, just over 20 even zones that split up say the upper arm”). Clothing culls body; armor culls clothing. Performance + anti-clip. Not hundreds. — [CitizenCon 2948](https://youtu.be/JQEQmO9uX28?t=1269); [r/starcitizen ATV transcript, 2017-03-02](https://www.reddit.com/r/starcitizen/comments/5x6wqg/around_the_verse_hurricane_character/)
- Conan: EquipmentVariationTable flags tuck/hide (long gloves hide Forearms and tuck Upperbody). — [Funcom primer](https://www.conanexiles.com/wp-content/wiki/2693791979.html)
- Roblox patent (2022): cage-to-cage fit **plus hidden-surface removal** so covered inner layers are not rendered. This is a **different product class** (UGC avatars, arbitrary bodies). — [US 2022/0292791 A1](https://patents.google.com/patent/US20220292791A1)

#### What is *not* the MMO-armor default

- Kingdom Come: Deliverance (Warhorse, Tomas Barak talk): **five layers** (body, cloth, chain, plate, decoration). Artists author morphs that **guide an adaptive algorithm**; morphs are **baked once when the character changes**, “there’s **no run time applying**” of those morphs. Quality “comparable to handmade assets.” This is a single-player layered-armor solver, not an MMO race-fit. — [“Adaptive Clothing System in Kingdom Come: Deliverance”](https://www.youtube.com/watch?v=ceX237jpqLs)
- Roblox layered clothing: inner/outer **cages**, runtime mapping of clothing inner cage → body or previous layer outer cage. Explicitly sold as avoiding “pre-defined geometries.” — [US 2022/0292791](https://patents.justia.com/patent/20220292791)
- Older avatar patent US20070273711: clothing vertices follow the same bones/morphs as the body so clothes “automatically conform” as the user edits the avatar. General avatar tech, not a shipped MMO postmortem. — [US20070273711A1](https://patents.google.com/patent/US20070273711A1/en)

### Inferences

- For WoW-like and FFXIV-like games, **texture compositing ≠ fitting**. Compositing changes albedo on a UV that already matches the mesh. Fitting is either (a) a different mesh, (b) bone scale of that mesh, or (c) hide/morph cuffs so seams meet.
- Hide-body-parts is the universal cheap clip fix (WoW geosets, FFXIV attributes, ESO part swap, Conan delete-hidden-body, SC zone cull). **Zone counts in shipped talks are tens, not hundreds.**
- Full 3D mesh swap is what you do when silhouette changes (robe vs pants, Charr vs Human, Lalafell vs Midlander, BDO class outfits).
- Runtime wrap/cage-fit is what you do when **user-generated or heavily morphed bodies** cannot be pre-authored (Roblox, theoretically Star Citizen cloth layers). It is the expensive path.

### Gaps

- No public measurement of how much of a modern WoW raid-tier set is still “texture on body” vs collection-model 3D. Legion onward clearly added more 3D bits; the exact ratio is not in Blizzard’s 2020 blog.
- ESO’s “second set of weights for customizing body shape” is stated in the GDC talk; whether those morph weights are applied to **armor** pieces the same way as the nude body is not spelled out in the available transcript snippets.

---

## What do GDC talks, engineering blogs, patents, or postmortems say?

### Takeaway

Primary engineering sources agree on **pre-authored modular parts with matched seams/weights**, **equip-time hide or morph**, and **texture-layer baking/compositing to dodge permutation explosion**. They do **not** describe MMOs generating Orc armor from Human Male morph targets at runtime, nor GPU cloth-fit at character load. Patents that *do* describe runtime cage-fit are Roblox (2021–) and generic avatar filings.

### Cited Findings

Dated primary / near-primary sources (year in the claim):

| Year | Source | What it actually says |
| --- | --- | --- |
| 2010 | Square Enix CEDEC, Baba & Ishii via 4Gamer | Hide polygons + shape deform + cut planes + priority, **recomputed on equip**; Midlander vs Highlander as two authored Hyur bodies; 60 textures → 250 looks. — [4Gamer](https://www.4gamer.net/games/092/G009287/20100901009/) |
| 2011 | ArenaNet, Aaron Coberly | Six modular slots, multi-slot replacement, dye permutation math, weight-class sharing. — [ArenaNet blog](https://web.archive.org/web/20110212143639/http://www.arena.net/blog/designing-humans) |
| 2015 | ZeniMax / Richard Katz, GDC “Tech Art in Tamriel” | 8 body parts + ~6 clothing bits; 12→30 variants/section; **two weight sets** (animation bones + body/face customize) that must seam-match; copy-normals / copy-weights **authoring tools**; 77-bone cap; 1 draw call; 200-player PvP. — [YouTube](https://www.youtube.com/watch?v=5YBJaXHFoSA) [Vault](https://www.gdcvault.com/play/1022291/Technical-Artist-Bootcamp-Tech-Art) |
| ~2015 | Bungie Destiny Mashup GDC | Artist tool places/scales/skins **bits** onto arrangements; one-button skinning; optional stored weights; unique per-player texture budget. — [YouTube](https://www.youtube.com/watch?v=V9KBUXyGnAA) |
| 2016–2018 | CIG CitizenCon 2948 / ATV | Item-port characters; **30–40 (not 100s) zone culls**; clothing culls body, armor culls clothing; layer-blend shader. — [YouTube](https://www.youtube.com/watch?v=JQEQmO9uX28) [ATV transcript](https://www.reddit.com/r/starcitizen/comments/5x6wqg/around_the_verse_hurricane_character/) |
| 2017+ | Funcom Conan primer (internal guide published) | Hard seams, tucked alternate meshes, **delete hidden body geo**, attach remaining body to the armor nif, **offline** male→female FFD. — [conanexiles.com wiki](https://www.conanexiles.com/wp-content/wiki/2693791979.html) |
| 2018 | whoahq/whoa + wowdev (unofficial) | Vanilla WoW: 10-section CPU paste, geoset priority, `Item/TextureComponents`. — [whoahq](https://deepwiki.com/whoahq/whoa/5.2-character-texture-pipeline) [wowdev](https://wowdev.wiki/DB/ItemDisplayInfo) |
| 2020 | Blizzard Engineer’s Workshop | SIMD **procedural texture generation** because customization perms hit millions; data-driven geosets/materials; 9,000 conversion rules. — [news.blizzard.com](https://news.blizzard.com/en-gb/article/23564386/engineers-workshop-enhancing-character-customization) |
| ~2016–2018 | Warhorse KCD talk | Layer morphs **baked once** on character change; no per-frame morph. — [YouTube](https://www.youtube.com/watch?v=ceX237jpqLs) |
| 2021–2022 | Roblox US20220292791 | Runtime **cage-to-cage** clothing fit + HSR; any body × any clothes. — [Justia](https://patents.justia.com/patent/20220292791) [Google Patents](https://patents.google.com/patent/US20220292791A1) |
| 2006 | US20070273711 | Clothing follows body bones/morphs for customizable avatars (generic). — [Google Patents](https://patents.google.com/patent/US20070273711A1/en) |

### Inferences

- The recurring AAA MMO recipe is: **author N body types × modular slots with identical seam contracts**, hide covered geo, composite textures to multiply dyes/materials, attach a few rigid bits. Tools copy weights/normals **in DCC**, not at player login.
- Permutation control is always some combination of: dye/colorset (GW2, FFXIV, Destiny, Conan tint maps), texture paste (WoW), and procedural tint (WoW SL tattoos, SC layer shader).
- When a studio **does** talk about morph-fitting clothes (KCD, Roblox, Conan M→F), they either bake offline or they are not fitting 10 MMO races onto one Human Male source at runtime.

### Gaps

- No Blizzard GDC vault talk equivalent to Katz’s ESO session was found for the *armor-on-race* problem (the 2020 blog is customization/textures).
- No Pearl Abyss engineering talk on outfit skinning was found.
- ArenaNet’s original 2012 developer post on weight-class rigs is lost with the old forums; current citations are player restatements.

---

## Which of the user’s pasted claims are documented vs speculative?

Claims as given: **(A)** morph targets from Human Male, **(B)** runtime bone-weight copying, **(C)** hundreds of body zones, **(D)** GPU texture bake at load.

### Takeaway

**A** is a half-truth if read as “FFXIV bone-scales many items from Midlander Male” or “WoW helms are often sculpted from Human Male”; it is **false** as “Orc/Tauren/Gnome armor is a Human Male morph target at runtime.” **B** is documented as an **authoring-time** weight-copy tool (ESO, Destiny, Conan Skin Wrap), not as a player-login algorithm. **C** is exaggerated: documented zone counts are **~8–40**. **D** is speculative for these MMOs: WoW’s documented bake is **CPU paste / SIMD**, uploaded to a GPU texture; FFXIV uses materials/colorsets; nobody found described a GPU compute bake of fitted clothes at load.

### Cited Findings

#### (A) Morph targets from Human Male — **partially analogous, mostly speculative as stated**

- Documented analog: FFXIV **Midlander Male (`c0101`) is the ancestor** of many male racial models; missing racial meshes are **bone-scaled** from that base. Highlander, Roe, Lalafell, and many hats are **separate authored meshes**. — [XIVGuide](https://github-wiki-see.page/m/rgd87/XIVGuide/wiki/Exporting-from-TexTools); [CEDEC 2010 Highlander](https://www.4gamer.net/games/092/G009287/20100901009/)
- Documented analog: WoW **helmets** often exist as per-race deformations of `_hu_m`. — [Ze Workshop 2018](https://zeworkshop.wordpress.com/2018/10/24/recreating-world-of-warcrafts-character-textures-in-unity/)
- Documented **counterexample**: WoW **bodies** are distinct `.m2`s (`orcmale.m2` vs `humanmale.m2`); armor on the torso is textures + geosets **of that mesh**. — [ModelDisplayPath.lua](https://raw.githubusercontent.com/Resike/BlizzardInterfaceResources/master/Resources/Data/ModelDisplayPath.lua); [wowdev geosets](https://wowdev.wiki/Character_Customization)
- Documented **counterexample**: GW2 Charr/Asura need their **own armor meshes**; mixing even humanoid *weights* leaves holes. — [GW2 forums 2019](https://en-forum.guildwars2.com/topic/61406-free-for-all/)
- Documented **offline** morph: Conan male→female uses FFD/lattice in Max, then a second export. KCD bakes clothing morphs when the character is customized, not from “Human Male” as a racial source. — [Funcom primer](https://www.conanexiles.com/wp-content/wiki/2693791979.html); [KCD talk](https://www.youtube.com/watch?v=ceX237jpqLs)
- **Not found:** a shipped MMO postmortem that says player Orc/Tauren/Gnome/Lalafell armor is generated from Human Male morph targets at runtime.

#### (B) Runtime bone-weight copying — **authoring-time yes; runtime mostly no**

- ESO GDC: tools **save skin weights to XML**, copy weights and vertex normals across part seams; dynamic meshes have **two weight sets** (animation + morph). This is a **pipeline tool**, described in the context of Max, not a client runtime that copies Human weights onto an Orc at login. — [Tech Art in Tamriel](https://www.youtube.com/watch?v=5YBJaXHFoSA)
- Destiny Mashup: “custom one button skinning tool”; optional custom weights **stored on the bit**. Authoring. — [Destiny GDC](https://www.youtube.com/watch?v=V9KBUXyGnAA)
- Conan: “Skin Wrap any stragglers” in 3ds Max before export. — [Funcom primer](https://www.conanexiles.com/wp-content/wiki/2693791979.html)
- FFXIV: runtime is **bone scaling of already-weighted verts**, which *reuses* weights rather than copying them from another mesh at runtime. Bad weights produce bad scale. — [TexTools Advanced Import](https://docs.google.com/document/d/1WQ559bkwMQqJu-W1sZ97G04TNLsWt1JfX9T37GYdBas/edit)
- Roblox patent: runtime **cage vertex mapping**, which is a form of deformer, not copying skin-weight arrays between skeletons. — [US20220292791](https://patents.justia.com/patent/20220292791)
- **Not found:** a WoW/GW2/BDO client that copies bone weights from Human Male onto another race’s clothing mesh when the player loads.

#### (C) Hundreds of body zones — **not documented; tens are**

- WoW texture sections: **10** (whoahq `NUM_COMPONENT_SECTIONS` / wowdev TEXTURE_SECTION enum). Geoset *groups* are on the order of **~50 numbered categories**, each with a handful of variants — not hundreds of independent zones. — [whoahq](https://deepwiki.com/whoahq/whoa/5.2-character-texture-pipeline); [wowdev Character Customization](https://wowdev.wiki/Character_Customization)
- ESO: **8** body parts + **~6** clothing bits. — [GDC 2015](https://www.youtube.com/watch?v=5YBJaXHFoSA)
- Star Citizen: speakers say **~20**, or **30–40**. One 2017 quote: “around 20, just over 20 even zones that split up say the upper arm.” — [CitizenCon 2948](https://youtu.be/JQEQmO9uX28?t=1269); [ATV transcript](https://www.reddit.com/r/starcitizen/comments/5x6wqg/around_the_verse_hurricane_character/)
- FFXIV attributes: a **small named set** (neck, wrist, elbow, shin, waist, gloves, boots, plus ~10 variant letters). — [xivmodding attributes](https://xivmodding.com/books/ff14-asset-reference-document/page/attribute-reference-tables)
- **Not found:** a shipped MMO claiming hundreds of independent clothing-cull zones.

#### (D) GPU texture bake at load — **speculative for these MMOs**

- Vanilla WoW: composition is **CPU paste** into `s_textureBuffer`, triggered when the GPU **locks/latches** the texture (`UpdateBaseTexture` on `GxTex_Lock` / `GxTex_Latch`). That is “bake then upload,” but the bake is **CPU**. Optional DXT1 compress. CVar `componentThread` existed and was **“not implemented.”** — [whoahq](https://deepwiki.com/whoahq/whoa/5.2-character-texture-pipeline)
- Shadowlands: “all texture processing code was rewritten from scratch using **SIMD**” and shared-resource management. SIMD is a **CPU** vector instruction story. The blog does not say compute-shader bake. — [Engineer’s Workshop 2020](https://news.blizzard.com/en-gb/article/23564386/engineers-workshop-enhancing-character-customization)
- FFXIV: color is **colorset + index/mask textures** sampled by the character shader; CEDEC 2010 morph/priority is “real time when equipment changes,” not a GPU lightmap-style bake. — [4Gamer](https://www.4gamer.net/games/092/G009287/20100901009/); [XIVGuide](https://github-wiki-see.page/m/rgd87/XIVGuide/wiki/Exporting-from-TexTools)
- KCD: morphs **baked once** into meshes after a character change — described as a CPU/offline-style bake, “no run time applying.” — [KCD talk](https://www.youtube.com/watch?v=ceX237jpqLs)
- **Not found:** Blizzard/ArenaNet/Square Enix/Pearl Abyss documentation of a GPU compute pass that bakes fitted clothing textures at character load.

### Inferences (including what this means for two Mixamo bodies)

- The user’s four claims read like a **mash-up of FFXIV racial scale + ESO authoring tools + Star Citizen zone culling + WoW texture compositing**, then generalized into a single runtime architecture. No shipped MMO in this set implements that union.
- For Ashen Reach (two 65-joint Mixamo bodies, Human and print-sculpt Orc, same catalogue):
  - **Closest documented pattern that actually ships:** FFXIV/Conan/GW2-lite — **author (or offline shrink-fit) a second mesh per garment**, hide covered body, optionally bone-scale if topology matches. That is already the project’s Orc pack (`equipment-orc/`), not MHCLO/runtime wrap.
  - **Do not import:** Human-Male morph-target generation, runtime weight copy, hundreds of zones, or a GPU clothing bake. Those are either DCC tools, other genres (Roblox/KCD), or undocumented.
  - **Cheap WoW lesson that does apply:** keep **one UV layout** for both races if you want shared albedo; still keep **two meshes**. Texture paste cannot fix an Orc fist swallowing a Human-sized shaft (the project’s own grip notes).
  - **Cheap FFXIV lesson that does apply:** if topology and vertex order stay identical, **bone scale + a few shape keys at the cuffs** can replace a full second mesh for *close* bodies. Human vs print-sculpt Orc is closer to Highlander vs Midlander than to Lalafell vs Midlander; it is **not** close enough that bone scale alone is documented to look good (TexTools: “results may vary,” Viera hats still unique).
  - **Cheap ESO/SC lesson:** 8–40 hide zones beat clipping; **matched seam weights** matter more than a solver. Copy weights in Blender at authoring time (Skin Wrap equivalent), don’t invent a runtime copier.
  - Performance: ESO needed 1 draw call and 77 bones for 200 players. This project already measures ~144 FPS / ~46 draws for one Orc. A WoW-style CPU texture composite of 10 sections is unnecessary at two bodies × eight garments.

### Gaps

- The original user paste was not recovered as a primary document in-repo during this pass; claims are evaluated as stated in the research brief.
- Whether modern retail WoW moved any of the `CCharacterComponent` paste onto compute shaders after 2020 is unknown; the last first-party word is SIMD CPU.
- No source was found that Blizzard copies Human Male **skin weights** onto Orc armor at runtime.

---

## Marketing vs engineering (short flag list)

- “Over a billion unique looks” (GW2 2011) and ESO outfit-station permutation theater (2018 livestream quoting 10^176) are **dye × slot combinatorics**, not mesh-fit claims. — [ArenaNet 2011](https://web.archive.org/web/20110212143639/http://www.arena.net/blog/designing-humans); [ESO Live Update 17](https://www.youtube.com/watch?v=ZDbzTZDflC8)
- Heritage armor trailers and BDO Pearl Shop pages are **content marketing**; they do not describe solvers.
- Player threads proposing a “Universal Armor Rig” for WoW (2024) are **speculation**, including the AI-fitting rumor.

## Sources not used (sparse / low quality)

- Generic “MMO character customization architecture” blogs and LLM-style lists: no dates, no file formats, no studio.
- Skyrim UUAMR / BodySlide: relevant to single-player Bethesda replace-the-nif, not an MMO pipeline.
- BDO Pearl Shop patch notes: SKU lists, not engineering.
