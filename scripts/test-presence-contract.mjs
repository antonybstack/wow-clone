import test from "node:test";
import assert from "node:assert/strict";
import { appearanceFromEquipment } from "../src/character/appearance/from-equipment.js";
import { EQUIPMENT_ITEMS } from "../src/ashen-reach/equipment-catalog.js";
import { PRESENCE_PIECE_CATALOGUE } from "../src/multiplayer/presence-catalogue.js";
import {
  PRESENCE_PROTOCOL,
  PRESENCE_CATALOG,
  PRESENCE_FITS,
  matchesPresenceVersion,
  presenceAppearance,
  validatePresenceAppearance,
  validateAppearanceRequest,
  presenceHeightScale,
} from "../src/multiplayer/protocol.js";

test("shared appearance accepts only published fits and the reviewed body domain", () => {
  for (const fit of ["wayfarer", "warden"])
    for (const height of [0.9, 1.15])
      for (const build of [-0.95, 0.95])
        assert.deepEqual(
          validatePresenceAppearance(presenceAppearance(fit, height, build))
            .shape,
          { family: "ashen-human-shape-v1", height, build },
        );
  assert.throws(() => presenceAppearance("invented"));
  assert.throws(() => presenceAppearance("wayfarer", 1.151, 0));
  assert.throws(() => presenceAppearance("wayfarer", 1, 0.951));
});

test("seats are validated against the published piece catalogue, not a hand-listed pair", () => {
  // The three published races are admitted; any other is refused by construction.
  for (const race of Object.keys(PRESENCE_PIECE_CATALOGUE.races))
    assert.equal(
      validatePresenceAppearance(
        appearanceFromEquipment({ race, loadout: PRESENCE_FITS.wayfarer }),
      ).race,
      race,
      `${race} has published pieces and must be admitted`,
    );
  assert.throws(
    () => validatePresenceAppearance({ ...presenceAppearance(), race: "elf" }),
    /no published elf body|Unsupported|UNKNOWN/i,
    "an unpublished race must not be admitted by naming it",
  );

  // Mixing published pieces across designs is now legitimate; it was refused before only
  // because the gate listed two whole outfits rather than checking the pieces.
  const mixed = JSON.parse(JSON.stringify(presenceAppearance()));
  mixed.equipment.shoulders = "wardenPauldrons";
  assert.equal(validatePresenceAppearance(mixed).equipment.shoulders, "wardenPauldrons");

  // An item with no published fit is refused, naming the slot.
  const unpublished = JSON.parse(JSON.stringify(presenceAppearance()));
  unpublished.equipment.torso = "inventedCuirass";
  assert.throws(() => validatePresenceAppearance(unpublished));

  // Every catalogue entry is a real item, so the gate cannot admit a typo.
  for (const [race, ids] of Object.entries(PRESENCE_PIECE_CATALOGUE.races))
    for (const id of ids)
      assert.ok(EQUIPMENT_ITEMS[id], `${race} catalogue names unknown item ${id}`);
});

test("appearance requests cannot claim positions or another actor and reject getters before evaluating", () => {
  const request = {
    requestId: "edit",
    expectedRevision: 1,
    recipe: presenceAppearance(),
  };
  assert.deepEqual(validateAppearanceRequest(request), request);
  for (const extra of [
    { x: 100 },
    { actorId: "other" },
    { requestId: "" },
    { requestId: "x".repeat(65) },
    { expectedRevision: 0 },
    { expectedRevision: Infinity },
  ])
    assert.throws(() => validateAppearanceRequest({ ...request, ...extra }));
  let read = false;
  const getter = { ...request };
  Object.defineProperty(getter, "recipe", {
    enumerable: true,
    get() {
      read = true;
      return request.recipe;
    },
  });
  assert.throws(() => validateAppearanceRequest(getter));
  assert.equal(read, false);
});

test("discovery and seat versions reject old, missing and mismatched catalogues", () => {
  const value = {protocol:PRESENCE_PROTOCOL, catalogVersion:PRESENCE_CATALOG, collisionHash:'region'};
  assert(matchesPresenceVersion(value, 'region'));
  // The rejected versions have to move with the current catalogue: v5 is now what the published
  // set carries, so the "future catalogue" case is v6 and v4 joins the superseded ones.
  for (const mismatch of [{catalogVersion:undefined}, {catalogVersion:'appearance-catalog-v3'},
    {catalogVersion:'appearance-catalog-v4'}, {catalogVersion:'appearance-catalog-v5'},
    {protocol:'old'}, {collisionHash:'other'}])
    assert.equal(matchesPresenceVersion({...value, ...mismatch}, 'region'), false);
});

test("seat height scale is defined for every published race", () => {
  // Only the Human has a verified shape family, so the other two carry an empty shape by
  // contract. Reading recipe.shape.height directly yielded undefined for two of the three
  // published races and fed that into the physics capsule.
  for (const race of Object.keys(PRESENCE_PIECE_CATALOGUE.races)) {
    const recipe = validatePresenceAppearance(
      appearanceFromEquipment({ race, loadout: PRESENCE_FITS.wayfarer }),
    );
    const scale = presenceHeightScale(recipe);
    assert.ok(Number.isFinite(scale) && scale > 0, `${race} seat height is ${scale}`);
  }
  assert.equal(presenceHeightScale(presenceAppearance("wayfarer", 1.15, 0)), 1.15);
  assert.equal(presenceHeightScale({ shape: {} }), 1);
  for (const bad of [{ shape: { height: 0 } }, { shape: { height: NaN } }, { shape: { height: -1 } }])
    assert.throws(() => presenceHeightScale(bad));
});
