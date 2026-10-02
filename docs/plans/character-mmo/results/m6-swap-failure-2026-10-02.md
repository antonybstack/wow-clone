# Milestone 6, task 2 — failed and superseded changes preserve the committed appearance

**2026-10-02.** Game source `8ae4c2d`, one owned rendering client at a time, functional only.
No FPS or production claim; nothing released and no asset changed.

The existing proof covered one slot on one race: a corrupt Duskguard cuirass on the Human. This
extends it to every slot with a network asset on all three published races, and adds the two
failures a player actually produces — clicking faster than the loader, and asking for something
that is not there.

## Result

**116 of 116 rows pass**, with zero console errors and zero GPU errors.
[Data](../../../baselines/character-mmo/m6/swap-failure.json) ·
[check](../../../../scripts/character-assets/check-armor-swap-failure.mjs).

| Case | Rows | Result |
| --- | --- | --- |
| Corrupt bytes served for a piece | 17 | all refused; worn appearance byte-identical |
| HTTP 500 for a piece | 17 | all refused; worn appearance byte-identical |
| Recovery after each injected failure | 34 | all `applied` on a genuine refetch |
| Swap storm — every item in the slot requested at once, six times | 24 | last request always wins; mesh count settles |
| Unknown item | 24 | all refused, `Item does not fit this slot` |

"Appearance byte-identical" means the equipment state, the sorted list of rendered mesh names
and the scene mesh count are all unchanged across the failed request.

**Two rows are untestable and are recorded as such rather than skipped:** the Undead helmet in
both injected modes. `graveweaverHood` is the only helmet in the catalogue and the Undead boot
loadout wears it, so it cannot be made un-fetched on a fresh page for that race.

## Two layers refuse a bad response, and they are not equally clear

Corrupt bytes are caught by the manifest's declared length before anything is parsed, and a 500
by the fetch itself. The Orc and Undead paths name the race, the piece and both byte counts:

> The orc Warden steel pauldrons is 1 bytes, not the 31032 its manifest declares
> Could not load the undead Duskguard greaves from …/duskguardGreaves-65e92cf980bd.glb

The Human path reports the same two conditions with only the URL:

> Unexpected size for …/wardenPauldrons-30914318b15c.glb
> …/graveweaverHood.glb: HTTP 500

Both refuse correctly, so this is not a defect; it is an asymmetry worth closing when the error
surface is next touched, because the Human message cannot be read without the manifest in hand.

## Making the injection real rather than apparent

This is most of the work, and it is the part that could have produced a confident false pass.
Three separate mechanisms each cause a routed failure to never be taken while the test reports
success:

1. **The loader memoises a prepared piece above its own residency cache.** `getStatus().cached`
   is bounded (`maxIdle = 2`) and evicting a piece from it does not force a refetch.
2. **The browser answers from its HTTP cache.** Every client here runs with
   `Network.setCacheDisabled`.
3. **The URL is not the one the manifest on disk predicts.** The default route boots from the
   startup pack, so `duskguardTassets` is served from `/ashen-reach/startup/character/` while
   `graveweaverSkirt` on the same page comes from `/ashen-reach/equipment/`. A route built from
   `equipment/manifest-coverage-v1.json` matched five slots out of six and silently missed the
   legs on every race.

So each injected case runs in a **fresh browser context** against pieces that context has never
loaded, and the handler decides from the request itself — matching the piece id against the
file name — rather than predicting a URL. Every row asserts the route was hit; `hits > 0` is
checked before the status is, and the minimum across all 34 injected rows is 1. The four
directories actually observed serving pieces are `/ashen-reach/equipment`,
`/ashen-reach/startup/character`, `/ashen-reach/equipment-orc` and `/ashen-reach/equipment-undead`.

Each injected failure is followed by a recovery row that equips the same piece with the route
removed, on the same page, so it is a real refetch rather than a cached result. All 34 recover.

## What this does not close

* Held and slow responses are not covered here. A response held open mid-request is tested for
  the Lector coat in the five-design transaction check; it is not yet per slot.
* Nothing about appearance *persistence* across a reload is retested; that is milestone 1's gate.
* The hand props are built by a factory and have no response to corrupt, so they appear only in
  the storm and unknown-item cases.
* Milestone 6 tasks 3 to 6 are untouched: the visual matrix, shape extremes beyond the Human,
  layering conflicts, and a cold-network swap budget.
