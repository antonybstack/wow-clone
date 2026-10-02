/** Colyseus owns wire schemas, input buffering, clock sync and reconnect.
 * Only bounded inputs and validated logical appearances cross this boundary.
 * https://docs.colyseus.io/netcode/server-input
 * https://docs.colyseus.io/state/schema
 */
import { schema, t } from "@colyseus/schema";
import {
  APPEARANCE_CATALOG_VERSION,
  validateAppearance,
  assertFields,
} from "../character/appearance/contract.js";
import { appearanceFromEquipment } from "../character/appearance/from-equipment.js";
import { PRESENCE_PIECE_CATALOGUE } from "./presence-catalogue.js";

export const PRESENCE_PROTOCOL = "ashen-presence-v1";
// Appearance changes can preserve the movement protocol yet break older clients.
// Reject incompatible seats before they can receive undecodable room state.
// https://docs.colyseus.io/room/authentication
export const PRESENCE_CATALOG = APPEARANCE_CATALOG_VERSION;
export function matchesPresenceVersion(value, collisionHash) {
  return value?.protocol === PRESENCE_PROTOCOL &&
    value.catalogVersion === PRESENCE_CATALOG && value.collisionHash === collisionHash;
}
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
    shoulders: null,
  }),
  warden: Object.freeze({
    helmet: "graveweaverHood",
    torso: "graveweaverTop",
    legs: "graveweaverSkirt",
    boots: "wayfarerBoots",
    gloves: "graveweaverGloves",
    mainHand: "graveweaverGreatstaff",
    offHand: null,
    shoulders: null,
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
/**
 * A seat may only claim an appearance the shared region can actually render.
 *
 * This used to be Human plus two hand-listed outfits. It is now checked against
 * `PRESENCE_PIECE_CATALOGUE`, which the publisher derives from the pieces it just published,
 * so the server's authority cannot outrun the assets: a race or an item that was never
 * published is refused here rather than accepted and then failing on every other client.
 *
 * Widening this means publishing pieces, not editing a list. Identity fields and races with
 * no published body stay refused by construction.
 */
export function validatePresenceAppearance(recipe) {
  const accepted = validateAppearance(recipe);
  if (PRESENCE_PIECE_CATALOGUE.catalogVersion !== APPEARANCE_CATALOG_VERSION)
    throw Error("Published piece catalogue is stale against the appearance catalogue");
  const supported = PRESENCE_PIECE_CATALOGUE.races[accepted.race];
  if (!supported)
    throw Error(
      `Shared region has no published ${accepted.race} body; supported: ${Object.keys(PRESENCE_PIECE_CATALOGUE.races).join(", ")}`,
    );
  for (const [slot, id] of Object.entries(accepted.equipment)) {
    if (id == null) continue;
    if (!supported.includes(id))
      throw Error(`Shared region has no published ${accepted.race} fit for ${id} in ${slot}`);
  }
  return accepted;
}
/**
 * Capsule height scale for a seat, for any supported race.
 *
 * Only the Human has a verified shape family, so by the appearance contract the Orc and the
 * Undead carry an empty `shape` object. Reading `recipe.shape.height` directly therefore
 * yields undefined for two of the three published races and feeds that straight into the
 * physics capsule. Their bodies are authored at the default scale, so the absent value is 1.
 */
export function presenceHeightScale(recipe) {
  const height = recipe?.shape?.height;
  if (height === undefined) return 1;
  if (!Number.isFinite(height) || height <= 0)
    throw Error("Invalid seat height scale");
  return height;
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
    catalogVersion: t.string().default(PRESENCE_CATALOG),
    collisionHash: t.string().default(""),
    elapsed: t.float64().default(0),
  },
  "AshenRegion",
);
export function copyMovement(avatar, movement) {
  for (const field of [...MOVEMENT_NUMBERS, ...MOVEMENT_BOOLEANS])
    avatar[field] = movement[field];
}
