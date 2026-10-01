import test from "node:test";
import assert from "node:assert/strict";
import { appearanceFromEquipment } from "../src/character/appearance/from-equipment.js";
import {
  presenceAppearance,
  validatePresenceAppearance,
  validateAppearanceRequest,
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
  assert.throws(() =>
    validatePresenceAppearance(appearanceFromEquipment({ race: "orc" })),
  );
  const unsupported = JSON.parse(JSON.stringify(presenceAppearance()));
  unsupported.equipment.shoulders = "wardenPauldrons";
  assert.throws(()=>validatePresenceAppearance(unsupported),/Wayfarer and Warden/);
  unsupported.equipment.shoulders = null;
  unsupported.equipment.mainHand = null;
  assert.throws(
    () => validatePresenceAppearance(unsupported),
    /Wayfarer and Warden/,
  );
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
