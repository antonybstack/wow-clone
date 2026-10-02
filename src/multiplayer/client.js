/** Lazy online presence adapter. SDK prediction/interpolation owns history and
 * clock sync; M2/M3 owns every remote representation and asset transaction.
 * https://docs.colyseus.io/netcode/client-prediction
 * https://docs.colyseus.io/room/reconnection
 */
import { Client, Predict } from "@colyseus/sdk";
import { onBeforeRender } from "@babylonjs/lite";
import {
  input as controls,
  pollInput,
  endFrame,
  isInputEnabled,
  onActionInput,
  onInputReset,
} from "../input.js";
import { sceneLifetime } from "../ashen-reach/scene-lifetime.js";
import { createRegionCrowd } from "../character/region-crowd/renderer.js";
import { REGION_ACTOR_RELEASE } from "../character/region-crowd/release.js";
import { createRegionActor } from "../character/region-crowd/actor-state.js";
import {
  PRESENCE_PROTOCOL,
  PRESENCE_CATALOG,
  matchesPresenceVersion,
  TICK_RATE,
  PHYSICS_SUBSTEPS,
  validatePresenceAppearance,
} from "./protocol.js";
import { COLLISION_RELEASE } from "./collision-release.js";

const updates = new WeakMap();
function enroll(scene, callback) {
  let live = updates.get(scene);
  if (!live) {
    live = new Set();
    updates.set(scene, live);
    onBeforeRender(scene, (ms) => {
      for (const fn of live) fn(ms);
    });
    sceneLifetime(scene).addEventListener("abort", () => live.clear(), {
      once: true,
    });
  }
  live.add(callback);
  return () => live.delete(callback);
}
async function initialState(room, signal) {
  if (room.state?.players?.get(room.sessionId)) return;
  signal.throwIfAborted();
  await new Promise((resolve, reject) => {
    // Keep the native signal subscription removable while a join is pending;
    // cancellation must not retain an initial-state listener until timeout.
    const finish = (error) => {
      clearTimeout(timer);
      room.onStateChange.remove(onState);
      signal.removeEventListener("abort", onAbort);
      error ? reject(error) : resolve();
    };
    const onState = () => {
      if (room.state?.players?.get(room.sessionId)) finish();
    };
    const onAbort = () =>
      finish(signal.reason || Error("Shared-region join was cancelled"));
    const timer = setTimeout(
      () => finish(Error("Shared region did not send its initial state")),
      15000,
    );
    room.onStateChange(onState);
    signal.addEventListener("abort", onAbort, { once: true });
    if (signal.aborted) onAbort();
    else onState();
  });
}
export async function joinPresence(
  game,
  endpoint,
  { onStatus = () => {}, signal } = {},
) {
  if (game.presence && !game.presence.closed)
    throw Error("Already joining or sharing a region");
  if (!game.regionReady)
    throw Error("The complete region must finish loading before joining");
  const accepted = validatePresenceAppearance(game.getAppearance());
  const lifetime = sceneLifetime(game.scene),
    cancel = new AbortController();
  const combined = AbortSignal.any([
    lifetime,
    cancel.signal,
    ...(signal ? [signal] : []),
  ]);
  combined.throwIfAborted();
  const base = new URL(endpoint, location.href);
  if (!["http:", "https:"].includes(base.protocol))
    throw Error("Presence endpoint needs HTTP(S)");
  if (
    base.protocol === "http:" &&
    !["127.0.0.1", "localhost", "[::1]"].includes(base.hostname)
  )
    throw Error("A public presence endpoint needs HTTPS");
  let room,
    crowd,
    predict,
    me,
    leaveFrame = () => {},
    leaveActions = () => {},
    leaveReset = () => {},
    heading = game.player.getFacing(),
    pendingJump = false,
    pendingAction = 0;
  const recipes = new Map(),
    pending = new Map(),
    errors = [];
  let lastAccepted = accepted,
    acceptedRevision = 1,
    appearanceChain = Promise.resolve(),
    closed = false,
    connected = false,
    applying = false,
    cleanupPromise;
  const applyLocal = async (value) => {
    combined.throwIfAborted();
    const gear = await game.equipment.setLoadout(value.equipment);
    if (gear.status !== "applied") throw Error("Outfit did not commit");
    combined.throwIfAborted();
    await game.creator.set("height", value.shape.height);
    combined.throwIfAborted();
    await game.creator.set("build", value.shape.build);
  };
  function convergeAppearance(recipe, revision) {
    if (closed || revision <= acceptedRevision) return;
    const validated = validatePresenceAppearance(recipe);
    const result = appearanceChain.then(async () => {
      if (closed || revision <= acceptedRevision) return;
      applying = true;
      try {
        await applyLocal(validated);
        lastAccepted = validated;
        acceptedRevision = revision;
      } finally {
        applying = false;
      }
    });
    appearanceChain = result.catch((error) => {
      if (!closed && !errors.includes(error.message))
        errors.push(error.message);
    });
  }
  const status = (value) => {
    api.status = value;
    onStatus(value);
  };
  const api = {
    status: "joining",
    errors,
    get connected() {
      return connected;
    },
    get closed() {
      return closed;
    },
    get appearanceApplying() {
      return applying;
    },
    get room() {
      return room;
    },
    get crowd() {
      return crowd;
    },
    get prediction() {
      return me;
    },
    target: null,
    snapshot() {
      return {
        status: api.status,
        connected,
        sessionId: room?.sessionId,
        players: room?.state?.players?.toJSON(),
        actors: crowd?.snapshot(),
        streaming: crowd?.streaming(),
        drift: me?.drift,
        errors: [...errors],
      };
    },
    changeAppearance(recipe) {
      const next = validatePresenceAppearance(recipe);
      const result = appearanceChain.then(async () => {
        if (!connected || closed)
          throw Error("Shared-region connection is unavailable");
        const previous = lastAccepted;
        applying = true;
        try {
          await applyLocal(next);
          combined.throwIfAborted();
          const self = room.state.players.get(room.sessionId),
            requestId = crypto.randomUUID();
          const response = await new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
              pending.delete(requestId);
              reject(Error("Appearance confirmation timed out"));
            }, 6000);
            pending.set(requestId, {
              resolve: (value) => {
                clearTimeout(timer);
                resolve(value);
              },
              reject: (error) => {
                clearTimeout(timer);
                reject(error);
              },
            });
            room.send("appearance", {
              requestId,
              expectedRevision: Math.max(acceptedRevision, self.revision),
              recipe: next,
            });
          });
          if (response.status !== "applied")
            throw Error(response.error || "Appearance was rejected");
          lastAccepted = next;
          acceptedRevision = response.revision;
          return response;
        } catch (error) {
          if (!closed) await applyLocal(previous);
          throw error;
        } finally {
          applying = false;
        }
      });
      appearanceChain = result.catch(() => {});
      return result;
    },
    async leave() {
      return stop(true);
    },
  };
  game.presence = api;
  function stop(consent) {
    if (closed) return cleanupPromise;
    closed = true;
    connected = false;
    leaveFrame();
    cleanupPromise = (async () => {
      cancel.abort();
      combined.removeEventListener("abort", abort);
      leaveActions();
      leaveReset();
      for (const request of pending.values())
        request.reject(Error("Shared region closed"));
      pending.clear();
      predict?.dispose();
      if (game.player.usingPhysics) game.player.setManualDrive(false);
      const cleanup = crowd?.dispose();
      if (consent && room) await room.leave().catch(() => {});
      await cleanup;
      recipes.clear();
      status("solo");
    })();
    return cleanupPromise;
  }
  const abort = () => {
    void stop(true);
  };
  combined.addEventListener("abort", abort, { once: true });
  try {
    status("joining");
    const response = await fetch(new URL("/presence", base), {
      signal: combined,
    });
    if (!response.ok) throw Error(`Shared region HTTP ${response.status}`);
    const discovery = await response.json();
    if (!matchesPresenceVersion(discovery, COLLISION_RELEASE.collisionHash))
      throw Error("Shared-region version differs; reload before joining");
    const sdk = new Client(base.href);
    room = await sdk.joinById(discovery.roomId, {
      protocol: PRESENCE_PROTOCOL,
      catalogVersion: PRESENCE_CATALOG,
      collisionHash: COLLISION_RELEASE.collisionHash,
      recipe: accepted,
    });
    // A cancellation can finish while the SDK seat join is still resolving.
    if (closed) {
      await room.leave();
      throw Error("Shared-region join was cancelled");
    }
    combined.throwIfAborted();
    await initialState(room, combined);
    crowd = await createRegionCrowd(game, {
      ...REGION_ACTOR_RELEASE,
      capacity: 8,
      clock: () => room.clock.renderNow() / 1000 - 0.1,
      signal: combined,
    });
    combined.throwIfAborted();
    const self = room.state.players.get(room.sessionId),
      wire = room.input();
    acceptedRevision = self.revision;
    if (wire.tickRate !== TICK_RATE || wire.subSteps !== PHYSICS_SUBSTEPS)
      throw Error("Unexpected shared movement timestep");
    game.player.setManualDrive(true);
    game.player.adoptMovementState(self);
    heading = self.facing;
    predict = Predict.get(room, { mode: "lerp", delay: 100 });
    predict.attachAll("players", {
      mode: "lerp",
      fields: ["x", "y", "z"],
      snap: 8,
    });
    for (const avatar of room.state.players.values())
      predict.attach(avatar, { mode: "lerp", fields: ["facing"], angle: true });
    me = predict.sim({
      input: wire,
      world: { player: game.player },
      smoothMs: 65,
      snap: 8,
      warnOnDivergence: 0.5,
      adopt: (w) =>
        w.player.adoptMovementState(room.state.players.get(room.sessionId)),
      step: (ctx, w, command) => {
        for (let i = 0; i < ctx.subSteps; i++)
          w.player.driveInput(ctx.subDt, command);
      },
      pose: (w) => {
        const p = w.player.getMovementState();
        return { x: p.x, y: p.y, z: p.z };
      },
    });
    room.onMessage("appearance-result", (response) => {
      const request = pending.get(response.requestId);
      if (request) {
        pending.delete(response.requestId);
        request.resolve(response);
      } else if (response.status === "applied")
        convergeAppearance(response.recipe, response.revision);
    });
    room.onDrop(() => {
      connected = false;
      status("reconnecting");
    });
    room.onReconnect(() => {
      connected = true;
      heading = room.state.players.get(room.sessionId).facing;
      status("shared");
    });
    room.onLeave(() => {
      void stop(false);
    });
    leaveActions = onActionInput((action) => {
      if (action === 3) pendingJump = true;
      else pendingAction = action;
    });
    leaveReset = onInputReset(() => {
      pendingJump = false;
      pendingAction = 0;
    });
    connected = true;
    status("shared");
    leaveFrame = enroll(game.scene, (ms) => {
      if (closed || !connected) return;
      const authoritative = room.state.players.get(room.sessionId);
      // A timed-out or disconnected request can still have committed. The
      // decoded server revision closes that uncertainty even without a receipt.
      if (!applying && authoritative?.revision > acceptedRevision)
        convergeAppearance(
          JSON.parse(authoritative.recipe),
          authoritative.revision,
        );
      const dt = Math.min(0.05, ms / 1000);
      pollInput();
      game.rig.applyLook();
      if (controls.rmb || controls.faceCamera) heading = game.rig.yaw;
      else if (controls.turn) {
        const turn = controls.turn * 2.55 * dt;
        heading += turn;
        if (!controls.lmb) game.rig.yaw += turn;
      }
      heading = Math.atan2(Math.sin(heading), Math.cos(heading));
      if (!isInputEnabled()) {
        pendingJump = false;
        pendingAction = 0;
      }
      pendingJump ||= Boolean(controls.jumpPressed);
      const due = predict.tick(performance.now());
      for (let i = 0; i < due; i++) {
        Object.assign(wire.data, {
          forward: controls.forward,
          strafe: controls.strafe,
          yaw: heading,
          walk: controls.walk,
          jump: controls.jump || pendingJump,
          action: pendingAction,
        });
        wire.send();
        pendingJump = false;
        pendingAction = 0;
      }
      game.player.presentMovement(dt, me.pose());
      game.body.root.position.y = -game.player.capsuleHeight / 2;
      endFrame();
      const live = new Set();
      for (const [id, avatar] of room.state.players) {
        if (id === room.sessionId) continue;
        live.add(id);
        let cached = recipes.get(id);
        if (!cached || cached.text !== avatar.recipe) {
          cached = {
            text: avatar.recipe,
            recipe: validatePresenceAppearance(JSON.parse(avatar.recipe)),
          };
          recipes.set(id, cached);
          predict.attach(avatar, {
            mode: "lerp",
            fields: ["facing"],
            angle: true,
          });
        }
        const recipe = cached.recipe,
          transform = {
            x: predict.value(avatar, "x"),
            y: predict.value(avatar, "y") - (1.748 * recipe.shape.height) / 2,
            z: predict.value(avatar, "z"),
            yaw: predict.value(avatar, "facing"),
          };
        const tier = id === api.target ? "exact" : "vat",
          key = `${avatar.revision}:${avatar.clip}:${avatar.motionStarted}:${tier}`;
        if (cached.key !== key) {
          cached.key = key;
          const actor = createRegionActor({
            id,
            recipe,
            appearanceRevision: avatar.revision,
            transform,
            motion: {
              clip: avatar.clip,
              loop: ["Idle_Loop", "Walk_Loop"].includes(avatar.clip),
              startedAt: avatar.motionStarted,
              offsetSeconds: 0,
            },
          });
          void crowd
            .set(actor, tier, { priority: id === api.target ? 1 : 2 })
            .catch((error) => {
              if (!closed && !errors.includes(error.message))
                errors.push(error.message);
            });
        } else crowd.setTransform(id, transform);
      }
      for (const actor of crowd.snapshot().actors)
        if (!live.has(actor.id)) {
          crowd.remove(actor.id);
          recipes.delete(actor.id);
        }
      // Pending arrivals can depart before their first representation commits.
      for (const id of recipes.keys())
        if (!live.has(id)) {
          crowd.remove(id);
          recipes.delete(id);
        }
    });
    return api;
  } catch (error) {
    await stop(true);
    throw error;
  }
}
