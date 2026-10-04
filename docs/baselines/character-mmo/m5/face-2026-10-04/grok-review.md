# Face refactor review — 2026-10-04

Read-only. No renderer, Blender, commit, or delivery. Parent owns live checks. Engineering contracts (neck weld, morph, bind, 162-row stills) cannot approve this art.

Inspected: `docs/plans/character-mmo/face-refactor-2026-10-04.md`; `build-human-identity-source.py`, `mh_io.py`, `bake-human-identity-atlas.py`; live Armory PNGs `accepted-fits/{young,old}-neutral-bare-{front,side}.png` plus hair/hood rows and the parent’s released front/side/face stills; M004 girth; MakeHuman `caucasian-male-{young,old}.target`, `low-poly.mhclo`, `brown_eye.png`; in-tree Human v1 / M006 fit recipes.

Offline landmark check of the CC0 OBJ+targets (no Blender) reproduces the parent’s numbers exactly.

## What the stills show

Released Human (same 22° body camera): compact skull on the Mixamo shoulders, hair covering the vault, almond eyes with visible sclera, chin that continues the heroic chest.

Rejected identity, same camera, Height 1.00 / Build 0.00, Head unequipped:

- Young front: cranium wider than the delts want, orbits like caves, irises filling the fissure, weak mouth, receding chin against a bodybuilder torso.
- Young side: egg vault on a thinner neck, forehead sloping back, jaw behind the pecs.
- Old front/side: the same pumpkin, face slid down the skull, eyes ~4 cm lower, heavy lids, a different person welded at 150 cm.
- Ponytail: a small cap on that vault; hairline too high; the cranial volume is still the subject.
- Warden hood: crown authored to the oversized skull, face recessed in a hole. Consequence of the head, not a separate anatomy bug.

## Affine vs canonical (confirmed)

Identity fit in `build-human-identity-source.py:89`:

` (x*133+0.3, y*105+11, (z-1.5)*119+150) `

MakeHuman young after `mh_coords_to_blender` (meters, feet planted): head width 17.666 cm, top 174.813 cm, eye-proxy centroid 164.02 cm. Old own-ground: width 16.986 cm, top 171.824 cm, eyes 160.54 cm.

| | width cm | top cm | eye center cm |
|---|---|---|---|
| Canonical M004 head (above 1.56 m) | 18.66 | 175.999 | — |
| Rejected young | 23.496 | 179.527 | 166.68 |
| Rejected old | 22.591 | 175.971 | 162.54 |
| MH young × this affine | 23.496 | 179.527 | 166.68 |
| MH old × this affine | 22.591 | 175.971 | 162.54 |
| Same young at M006’s `x*110, y*105+6` | 19.433 | 179.527 | — |
| Young ×100 (meters as cm, isotropic) | 17.666 | 174.813 | 164.02 |

X 133 is a 33% width inflate on a head that was already within 1 cm of canonical. Z 119 is the M006 *old* stretch-to-Tripo-crown, reused on young, so young overshoots 176 cm by 3.5 cm. Y 105+11 vs M006’s +6 is a further 5 cm anterior offset; the weld then snaps the rim back, so the face is thrust forward of the Mixamo neck.

The 133 X scale matches “make the MH neck at z=1.50 as wide as a heroic Mixamo neck.” Young MH neck width at that plane is 17.46 cm; 17.46×1.33≈23.2. The weld already copies Mixamo rim positions (`b.co = a.co` at line 165). Pre-scaling the skull to neck girth is wasted on the rim and fatal on the cranium.

`assemble-human-identity-source.mjs` Head girth ease above 1.57 m is ~0.26% width. It is not this defect.

---

## Five corrections (highest observable impact)

### 1. Source geometry — replace the anisotropic skull scale

Drop `x*133`. Lock each age at the Mixamo neck (150 cm weld), then scale the remaining head toward canonical 18.66 cm width and 176.0 cm crown. Isotropic meters-as-cm (`*100`) already lands young at 17.67 / 174.8. M006’s in-tree diagnostic `x*110, y*105+6, z*119` is the previous attempt; identity regressed the X term.

Do not author a new 3-axis fudge. Measure the MH neck *ring* that will weld, map that ring to the M004 rim, then a similarity (or a canonical bounding box) on vertices above it. Depth (`y`) stays with width; the current 133 vs 105 turns a naturally deeper MH head (17.7 × 22.1 cm) into a 23.5 × 23.2 cm sphere.

### 2. Source geometry — stop mapping whole-body age stature through `(z-1.5)`

`caucasian-male-old.target` is a race+age+sex macro, not a face. Own-ground stature young 174.813 cm vs old 171.824 cm (Δ 2.99 cm). Independent plant only shifts zmin by 1.87 mm; the leak is the shared 1.50 m pivot on a shorter old figure.

Old anatomical neck at the same stature fraction as young’s 1.50/1.748 is ~147.4 cm. Cutting old at 1.50 therefore takes a higher slice (narrower: 11.8 cm vs young 17.5 cm at that plane) and leaves only 21.8 cm of head above the cut vs young 24.8 cm. Affine ×1.19 turns the eye gap into 4.14 cm on the *same* Mixamo torso (166.68 vs 162.54). That is why the old face sits in the neck.

Align each age from its own neck ring, or keep young as the spatial frame and apply old as a delta with shared ground — the method already written in `review-human-age-transfer.py` (and that file still uses `x*110`, not 133). Age should read as brow, lid, jaw, skin. It should not lower the sockets.

### 3. Source geometry — restore the licensed Human v1 *face* stack; average Caucasian is the wrong base

Even at canonical scale, `caucasian-male-{age}.target` alone on Mixamo heroic pecs is a different facial language: round vault, large orbits, small mouth, receding chin. Bald and the Front camera make that the whole shot. Released hair was hiding the Mixamo vault; identity bald does not.

Do not sculpt a bespoke head. The project already has the CC0 knobs and a recipe:

`build_human_v1.py` / `mh_race.HUMAN_V2_TARGETS` apply, on top of Caucasian young: `head-scale-vert-decr` 0.32, eye-height 1/2, lid `opened-up`, nose flare/nostril, lip/philtrum volume. `build_orc_v1.py` already uses `measure-neck-circ-incr` and `chin-prognathism-incr`. `eyebrow001.mhclo` is in the same Human v1 path; identity never attaches it, so brows are only atlas paint.

Use the *face and neck* subset after a correct similarity. Do not dump `universal-male-young-maxmuscle-maxweight` through the identity affine: on this mesh it widens the skull (offline: head width 21.66 cm before ×133 → 28.8 cm). Neck thickness belongs on `measure-neck-circ-incr` before the weld, so the Mixamo rim is not carrying a skinny MH throat under a wide vault.

Fallback already in tree if the MH head cannot be made to sit on this torso: `review-human-age-transfer.py` keeps the released Mixamo face and interpolates only the young→old *delta*.

### 4. Eye / material — reuse globe shrink, lid wrap, and the v1 eye path

Identity pumps `low-poly.mhclo` through the same 133 affine, Head-weights 1.0, `mat_pbr` rough 0.15 / spec 0.7 / double-sided (`bake-human-identity-atlas.py:193–195`). No `shrink_eye_globes`, `tuck_globe_backs`, `bulge_cornea`, or `wrap_lids_on_spheres`.

Offline: both globes span 8.84 cm in MH meters → 11.76 cm after ×133, each globe stretched in X vs Y. Front stills: dark wet pits, almost no sclera, brows not framing the iris. `brown_eye.png` is a fine CC0 iris; `write_eye_albedo` already paints sclera and catchlights. Human v1 then does `EYE_GLOBE_SCALE = 0.83`, cornea bulge 2.2 mm, back tuck 0.62, lid wrap 0.9 mm (`build_human_v1.py:33–38, 175–179`; `mh_studio.py:635–690`).

Do that after the skull scale. Shrinking globes inside still-cavernous MH orbits without the eye-height / lid targets will leave empty sockets.

### 5. Camera — amplifier, not the defect

Front/side are `VFOV_DEGREES = 22`, zero pitch, 88% body fill (`cameras.js`). Released uses the same presets; the 26% extra head width is in those frames.

Face preset (`FACE_PITCH_UP = 0.13` ≈ 7.4° up, head height estimated as stature/7.5, fill 0.62) looks up into the orbits and crops a vault larger than the 1/7.5 model. It will keep looking cruel until the skull is canonical. Do not widen FOV or drop the camera to hide it. Re-shoot Face after (1)–(4). Hood lattice is a refit of the corrected head, same as the plan already requires.

---

## Is canonical-scale alignment enough?

Necessary, and it is the first thing a player reads (pumpkin width, young too tall, old sockets dropped). It is not sufficient.

After a neck-locked similarity to 18.66 × 176:

- Old still needs a per-age neck pivot or a face-only delta, or the 3 cm stature stays in the face.
- Average MH Caucasian + unshrunk low-poly globes + missing v1 face/eyebrow/lid stack still reads as a photoreal extra on a stylized hero body. Bald is the honest test; hair and hood currently conceal and then mismatch.
- Photoreal MH skin pores/wrinkles on the Mixamo painterly torso are secondary to the silhouette. Do not start there.

Wrong base style persists if identity keeps `caucasian-male-{age}` as the only target and the 133 affine as the only “fit.” Reuse MakeHuman macros and the Human v1 eye helpers already in `blender/characters/sources/` and `mh_studio.py`.

## Out of scope here

Neck weld topology, four-influence reduction, atlas nape paint, eye morph field 1.86e-9 m, saved-character isolation, production fences. Those can stay green while the head is rejected. Parent owns the next live Front/Side/Face/hood pass.
