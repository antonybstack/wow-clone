/** Colyseus owns wire schemas, input buffering, clock sync and reconnect.
 * Only bounded inputs and validated logical appearances cross this boundary.
 * https://docs.colyseus.io/netcode/server-input
 * https://docs.colyseus.io/state/schema
 */
import { schema, t } from "@colyseus/schema";
import {
  validateAppearance,
  assertFields,
} from "../character/appearance/contract.js";
import { appearanceFromEquipment } from "../character/appearance/from-equipment.js";

export const PRESENCE_PROTOCOL = "ashen-presence-v1";
export const PRESENCE_ROOM = "ashen-reach";
export const ROOM_LIMIT = 8;
export const TICK_RATE = 30;
export const PATCH_INTERVAL = 50;
export const PHYSICS_SUBSTEPS = 2;
export const RECONNECT_SECONDS = 30;
export const HUMAN_CAPSULE = Object.freeze({ height: 1.748, radius: 0.28 });
export const PRESENCE_FITS = Object.freeze({
  wayfarer: Object.freeze({
    helmet: null,
    torso: "wayfarerTunic",
    legs: "wayfarerTrousers",
    boots: "wayfarerBoots",
    gloves: null,
    mainHand: "ironSword",
    offHand: null,
  }),
  warden: Object.freeze({
    helmet: "graveweaverHood",
    torso: "graveweaverTop",
    legs: "graveweaverSkirt",
    boots: "wayfarerBoots",
    gloves: "graveweaverGloves",
    mainHand: "graveweaverGreatstaff",
    offHand: null,
  }),
});
export function presenceAppearance(fit = "wayfarer", height = 1, build = 0) {
  if (!Object.hasOwn(PRESENCE_FITS, fit))
    throw Error("Unsupported shared-region outfit");
  const recipe = appearanceFromEquipment({
    race: "human",
    loadout: PRESENCE_FITS[fit],
  });
  return validateAppearance({
    ...recipe,
    shape: { ...recipe.shape, height, build },
  });
}
export function validatePresenceAppearance(recipe) {
  const accepted = validateAppearance(recipe);
  if (accepted.race !== "human")
    throw Error("Shared region currently supports Human only");
  if (
    !Object.values(PRESENCE_FITS).some((fit) =>
      Object.keys(fit).every((k) => fit[k] === accepted.equipment[k]),
    )
  )
    throw Error("Shared region currently supports Wayfarer and Warden only");
  return accepted;
}
export function validateAppearanceRequest(request) {
  assertFields(
    request,
    ["requestId", "expectedRevision", "recipe"],
    "appearanceRequest",
  );
  if (
    typeof request.requestId !== "string" ||
    request.requestId.length < 1 ||
    request.requestId.length > 64
  )
    throw Error("Invalid appearance request ID");
  if (
    !Number.isSafeInteger(request.expectedRevision) ||
    request.expectedRevision < 1
  )
    throw Error("Invalid expected appearance revision");
  return { ...request, recipe: validatePresenceAppearance(request.recipe) };
}
export const MoveInput = schema(
  {
    forward: t.float32().default(0),
    strafe: t.float32().default(0),
    yaw: t.float32().default(0),
    walk: t.boolean().default(false),
    jump: t.boolean().default(false),
    action: t.uint8().default(0),
  },
  "AshenMoveInput",
);
export const MOVEMENT_NUMBERS = Object.freeze([
  "x",
  "y",
  "z",
  "facing",
  "vy",
  "vx",
  "vz",
  "speed",
  "support",
  "airTime",
  "jumps",
  "landings",
  "recoveries",
  "jumpBuffer",
  "coyote",
  "moveScale",
  "heightScale",
  "controllerVx",
  "controllerVy",
  "controllerVz",
  "castBlend",
]);
export const MOVEMENT_BOOLEANS = Object.freeze([
  "grounded",
  "jumpInFlight",
  "previousJump",
]);
export const Avatar = schema(
  {
    ...Object.fromEntries(
      MOVEMENT_NUMBERS.map((k) => [k, t.float64().default(0)]),
    ),
    ...Object.fromEntries(
      MOVEMENT_BOOLEANS.map((k) => [k, t.boolean().default(false)]),
    ),
    id: t.string().default(""),
    recipe: t.string().default(""),
    revision: t.uint32().default(1),
    clip: t.string().default("Idle_Loop"),
    motionStarted: t.float64().default(0),
    connected: t.boolean().default(true),
  },
  "AshenAvatar",
);
export const RegionState = schema(
  {
    players: t.map(Avatar),
    protocol: t.string().default(PRESENCE_PROTOCOL),
    collisionHash: t.string().default(""),
    elapsed: t.float64().default(0),
  },
  "AshenRegion",
);
export function copyMovement(avatar, movement) {
  for (const field of [...MOVEMENT_NUMBERS, ...MOVEMENT_BOOLEANS])
    avatar[field] = movement[field];
}
