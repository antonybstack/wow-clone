# Milestone 7, task 1 — choosing a dye mechanism, and what the measurements rule out

**2026-10-03.** Game source `8ae4c2d`. Investigation only: no source change, no asset change,
nothing released.

Milestone 7 asks for one colour mechanism to be chosen and proved, with its cost measured. This
is that decision, with the two mechanisms it rules out.

## The dye channel already exists in the art

The appearance contract reserves a `dyes` field and rejects every key in it —
`validateEmptyParameters` raises `UNSUPPORTED_PARAMETER` — and the capability list is empty for
all three races. So the recipe side is a stub.

The *content* side is not. Reading the published GLBs, the designs already differ largely by
`baseColorFactor` over a **shared base-colour texture**:

| Piece | material | baseColorFactor | base texture |
| --- | --- | --- | --- |
| wayfarerTunic | WayfarerTunic | 1, 1, 1 | 256², mean luma 0.443 |
| graveweaverTop | GraveweaverTop | 0.78, 0.86, 0.83 | **the same texture** |
| lectorCoat | *named* WayfarerTunic | 0.37, 0.48, 0.64 | **the same texture** |
| duskguardCuirass | *named* WayfarerTunic | 1, 1, 1 | **the same texture** |
| pilgrimTunic | PilgrimTunic | 1, 1, 1 | 256², mean luma 0.154 |

Identical histograms confirm the shared texture rather than a coincidence of means. **A dye
channel is therefore not a new rendering feature — it is the existing authored one, exposed.**

## The constraint that decides the palette

`baseColorFactor` is a **multiply** over the texture. A dye can darken and tint; it cannot
brighten. That is why the authored factors all sit in 0.37–0.86 against a texture whose mean
luma is 0.443 with 31% of its pixels in the top eighth — there is headroom to pull down, none to
push up.

Any palette must be defined as *tints of a light base*. A palette specified as bright colours
over a dark garment would come out as "slightly different dark", which is the failure mode this
note exists to prevent.

## Two mechanisms ruled out by measurement

Both were tested in the running game against a **static control**: two baseline samples of the
same tunic crop, 900 ms apart, both reading 32.34 mean pixel value — so the scene is not
drifting and any change is the experiment.

1. **Mutating `baseColorFactor` on the live material.** Setting it and bumping `_uboVersion`
   produced **no change** (32.34 → 32.34 region, and no visible difference in a side-by-side).
2. **Replacing the material at runtime** with `createPbrMaterial({…, baseColorFactor})`. The
   crop went **32.34 → 39.65** — *brighter*, not the black that an all-zero factor must produce.
   The replacement renders, but as a bare material: the normal, ORM and emissive maps and the
   `ashen-local-light-v1` / `ashen-linear-output-v1` plugins are gone, and the factor is not
   applied. An earlier attempt that also called `enableMaterialPlugins(scene)` mid-session
   **blacked out the whole frame** with `gpu.errors` still empty, which is consistent with the
   type documentation: plugins must be enabled before `registerScene`.

Materials in this setup are built into scene build groups at registration and are not usefully
mutable afterwards.

## The mechanism, and its cost

**Apply the dye where the piece's material is built from its glTF, in the equipment loader.**
That is the one path where `baseColorFactor` is already honoured — it is how the Lector coat is
blue today.

The consequence is that **a dye change costs a piece rebuild, not a uniform update**. That cost
is already measured: the *rebuilt* tier of the swap budget is **18.8 ms median, 48.6 ms worst**,
against 0.5 ms for a resident piece and 86.1 ms for a cold fetch
([budget](m6-swap-budget-2026-10-02.md)). A recolour is a rebuild, so a player dragging a colour
slider would re-run that path per commit — the control needs to commit on release, not per frame.

No asset regeneration is required, which matters: the catalogue is sealed twice and a change to
it forces `npm run prepare:human-shapes`, a full rebuild of the published Human family
([grip note](m6-review-defects-2026-10-03.md)). A dye driven from the recipe through the loader
avoids that entirely, because the authored factor stays the default and the recipe overrides it
at build time.

## What this does not do

* Nothing is implemented. The recipe field still rejects every key, and no capability is raised.
* The remaining task-1 work is the per-piece override in the loader, the palette definition, and
  a measurement of the cost against a real published piece rather than against the budget's
  general rebuild figure.
* Tasks 2 to 4 — the recipe migration, creator controls, and re-running milestone 6's fit and
  coverage gates on a dyed piece — are untouched.

---

## Built and proved, same day

The mechanism above is implemented and measured in the running game. Reviewed palette sheet:
Telegram **845**. [Data](../../../baselines/character-mmo/m7/dye-live.json) ·
[check](../../../../scripts/character-assets/check-dye-live.mjs) ·
[palette](../../../../src/ashen-reach/dye-palette.js).

**Nine entries, all applying, no GPU errors**, against a static control — two identical captures
0.04 apart in mean sRGB, so nothing in the scene supplies the difference.

| dye | factor | separation from undyed | cost |
| --- | --- | --- | --- |
| undyed | 1, 1, 1 | 0 | 6.8 ms |
| bone | 0.88, 0.84, 0.74 | **2.84** | 19.7 |
| ash | 0.46, 0.47, 0.45 | 8.24 | 7.9 |
| slate | 0.30, 0.36, 0.42 | 9.74 | 14.9 |
| indigo | 0.22, 0.28, 0.58 | 9.87 | 13.0 |
| moss | 0.26, 0.42, 0.20 | 10.86 | 6.5 |
| oxblood | 0.62, 0.14, 0.12 | **11.29** | 6.6 |
| rust | 0.70, 0.34, 0.14 | 9.90 | 16.4 |
| plum | 0.38, 0.18, 0.44 | 10.18 | 12.0 |

**Cost: 12 ms median, 19.7 ms worst** — below the 18.8 ms general rebuild median, because the
piece being redyed is usually still resident.

**The predicted constraint is now visible.** `bone` at 2.84 and `ash` at 8.24 are the two
weakest, and in the sheet the undyed, bone and ash garments are hard to tell apart. A multiply
cannot brighten, so the light end of a palette is wasted on dark cloth in dark lighting. The
saturated entries — oxblood, moss, plum, indigo — read immediately. **A future palette should
spend its entries on saturation, not on lightness.**

### How it is wired

* `src/ashen-reach/dye-palette.js` — the palette, pure, with every channel asserted ≤ 1 at module
  load so an inexpressible entry cannot be added. It sits beside `equipment-catalog.js` rather
  than under `src/character/appearance/` because the build gates the default startup graph
  against reaching that directory, and the loader needs this vocabulary eagerly.
* `equipment-stream.js` applies `options.getDye(item.id)` to each mesh's material immediately
  before `addToScene`, which is the window `prepareLinearMaterial` already uses.
* `equipment-loader.js` gains `forget(id)`, which drops a prepared piece so the next request
  rebuilds it. It refuses to forget a piece that is currently worn, because disposing a live
  entry would take its meshes out from under the committed appearance.
* `ASHEN.equipment.setDye(id, dye)` empties the slot, forgets the piece and re-equips it, through
  the same `equipRequest` boundary as every other change, so a failed dye cannot leave a torn
  appearance. `getDyes()` reads the committed map.
* All four `createStreamedEquipment` call sites resolve dyes through one map, so a dye survives a
  race switch and a body restage.

### Still open

* **Not wired to the saved recipe.** `dyes` still rejects every key and no capability is raised,
  so a dye does not persist across a reload. That is task 2, and it needs a schema migration and
  a catalogue-version decision, which has its own blast radius: presence validation asserts that
  `appearance-catalog-v5` is rejected today.
* No creator control, and milestone 6's fit and coverage gates have not been re-run on a dyed
  piece.
* The palette itself is a first pass, and the measurement above says to rebalance it toward
  saturation before it is shown to anyone.
