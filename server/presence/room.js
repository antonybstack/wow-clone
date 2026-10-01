import fs from "node:fs/promises";
import { Room, ServerError } from "@colyseus/core";
import { createRegionPhysics } from "./collision.js";
import { REGION_ACTOR_RELEASE } from "../../src/character/region-crowd/release.js";
import {
  Avatar,
  RegionState,
  MoveInput,
  copyMovement,
  validatePresenceAppearance,
  validateAppearanceRequest,
  PRESENCE_PROTOCOL,
  ROOM_LIMIT,
  TICK_RATE,
  PATCH_INTERVAL,
  PHYSICS_SUBSTEPS,
  RECONNECT_SECONDS,
} from "../../src/multiplayer/protocol.js";
import { assertFields } from "../../src/character/appearance/contract.js";
import { COLLISION_RELEASE } from "../../src/multiplayer/collision-release.js";
import { summarizeDurations } from "../../src/ashen-reach/metrics.js";

let activeRoom = null;
export function currentPresenceRoom() {
  return activeRoom;
}

/** One bounded room. Colyseus supplies session IDs, validated input buffers,
 * fixed-step handshake, patches and expiring/rotating reconnect credentials.
 * https://docs.colyseus.io/netcode/server-input
 * https://docs.colyseus.io/room/reconnection
 */
export class PresenceRoom extends Room {
  async onCreate() {
    if (activeRoom)
      throw new ServerError(429, "The shared region is already running");
    activeRoom = this;
    this.maxClients = ROOM_LIMIT;
    this.autoDispose = false;
    this.maxMessagesPerSecond = 100;
    this.state = new RegionState();
    this.state.collisionHash = COLLISION_RELEASE.collisionHash;
    this.actors = new Map();
    this.tickDurations = [];
    this.tickLoads = new Map();
    this.ticks = 0;
    this.traffic = new Map();
    try {
      this.physics = await createRegionPhysics();
      const prepared = JSON.parse(
        await fs.readFile(
          `public${REGION_ACTOR_RELEASE.assetRoot}/${REGION_ACTOR_RELEASE.preparedAsset.file}`,
        ),
      );
      this.clips = prepared.variants.wayfarer.clips;
      this.inputs = this.defineInput(MoveInput, {
        bufferMaxSize: 64,
        // Missing packets release controls while gravity/support continue. Native
        // idle frames never advance the consumed-input acknowledgement.
        // https://docs.colyseus.io/netcode/server-input
        idle: (ctx) => ({
          forward: 0,
          strafe: 0,
          yaw: this.state.players.get(ctx.sessionId)?.facing ?? 0,
          walk: false,
          jump: false,
          action: 0,
        }),
        sanitize: {
          forward: [-1, 1],
          strafe: [-1, 1],
          yaw: [-Math.PI, Math.PI],
          action: [0, 2],
        },
      });
      this.setPatchRate(PATCH_INTERVAL);
      this.setFixedTimestep((ctx) => this.step(ctx), TICK_RATE, {
        subSteps: PHYSICS_SUBSTEPS,
      });
      this.onMessage("appearance", (client, request) =>
        this.changeAppearance(client, request),
      );
    } catch (error) {
      this.physics?.dispose();
      activeRoom = null;
      throw error;
    }
  }
  onAuth(client, options) {
    assertFields(options, ["protocol", "collisionHash", "recipe"], "join");
    if (
      options.protocol !== PRESENCE_PROTOCOL ||
      options.collisionHash !== COLLISION_RELEASE.collisionHash
    )
      throw new ServerError(
        4003,
        "Client and shared-region versions differ; reload before joining",
      );
    return { recipe: validatePresenceAppearance(options.recipe) };
  }
  async onJoin(client) {
    const recipe = client.auth.recipe;
    const used = new Set([...this.actors.values()].map((a) => a.spawnSlot));
    let spawnSlot = 0;
    while (used.has(spawnSlot)) spawnSlot++;
    const resource = await this.physics.actor(
      ((spawnSlot % 4) - 1.5) * 1.5,
      -6 - Math.floor(spawnSlot / 4) * 2,
      recipe.shape.height,
    );
    const avatar = new Avatar();
    avatar.id = client.sessionId;
    avatar.recipe = JSON.stringify(recipe);
    copyMovement(avatar, resource.player.getMovementState());
    this.actors.set(client.sessionId, {
      ...resource,
      spawnSlot,
      receipts: new Map(),
      lastAppearance: -Infinity,
      lastAction: -Infinity,
    });
    this.state.players.set(client.sessionId, avatar);
    this.watchTraffic(client);
  }
  watchTraffic(client) {
    const counters = this.traffic.get(client.sessionId) || {
      receivedBytes: 0,
      sentBytes: 0,
    };
    this.traffic.set(client.sessionId, counters);
    const receive = (data) => {
      counters.receivedBytes +=
        typeof data === "string" ? Buffer.byteLength(data) : data.byteLength;
    };
    client.ref.on("message", receive);
    client.ref.once("close", () => client.ref.off("message", receive));
    const raw = client.raw.bind(client);
    client.raw = (data, ...args) => {
      counters.sentBytes += data.byteLength;
      return raw(data, ...args);
    };
  }
  step(ctx) {
    const start = performance.now(),
      commands = [];
    this.state.elapsed = this.clock.elapsedTime / 1000;
    for (const [id, resource] of this.actors) {
      const avatar = this.state.players.get(id);
      const command = this.inputs.get(id).next();
      if (command) commands.push({ avatar, resource, command });
    }
    // Exactly one wire input per actor/network step, with two shared 60 Hz
    // Havok substeps. Never acknowledge a drained input that was not simulated.
    for (let i = 0; i < ctx.subSteps; i++) {
      this.physics.step(ctx.subDtMs);
      for (const { resource, command } of commands)
        resource.player.driveInput(ctx.subDt, command);
    }
    for (const { avatar, resource, command } of commands) {
      copyMovement(avatar, resource.player.getMovementState());
      const now = this.state.elapsed;
      if (command.action && now - resource.lastAction >= 0.8) {
        avatar.clip =
          command.action === 1 ? "Spell_Simple_Enter" : "Sword_Attack";
        avatar.motionStarted = now;
        resource.lastAction = now;
      } else {
        const action = !["Idle_Loop", "Walk_Loop"].includes(avatar.clip);
        const duration =
          this.clips[avatar.clip].duration ??
          (this.clips[avatar.clip].frameCount - 1) /
            this.clips[avatar.clip].fps;
        if (!action || now - avatar.motionStarted >= duration) {
          const clip = avatar.speed > 0.1 ? "Walk_Loop" : "Idle_Loop";
          if (clip !== avatar.clip) {
            avatar.clip = clip;
            avatar.motionStarted = now;
          }
        }
      }
    }
    const duration = performance.now() - start;
    this.ticks++;
    this.tickDurations.push(duration);
    if (this.tickDurations.length > 3600) this.tickDurations.shift();
    let load = this.tickLoads.get(this.actors.size);
    if (!load) {
      load = [];
      this.tickLoads.set(this.actors.size, load);
    }
    load.push(duration);
    if (load.length > 3600) load.shift();
  }
  changeAppearance(client, raw) {
    const resource = this.actors.get(client.sessionId),
      avatar = this.state.players.get(client.sessionId);
    if (!resource || !avatar) return;
    let request;
    try {
      request = validateAppearanceRequest(raw);
      const old = resource.receipts.get(request.requestId),
        fingerprint = JSON.stringify(request);
      if (old) {
        if (old.fingerprint !== fingerprint)
          throw Error("Request ID already belongs to another appearance");
        client.send("appearance-result", old.result);
        return;
      }
      if (request.expectedRevision !== avatar.revision)
        throw Error("Stale appearance revision");
      const now = this.clock.elapsedTime;
      if (now - resource.lastAppearance < 100)
        throw Error("Appearance updates are too frequent");
      resource.player.setHeightScale(request.recipe.shape.height);
      avatar.recipe = JSON.stringify(request.recipe);
      avatar.revision++;
      resource.lastAppearance = now;
      copyMovement(avatar, resource.player.getMovementState());
      const result = {
        requestId: request.requestId,
        status: "applied",
        revision: avatar.revision,
        recipe: request.recipe,
      };
      resource.receipts.set(request.requestId, { fingerprint, result });
      if (resource.receipts.size > 16)
        resource.receipts.delete(resource.receipts.keys().next().value);
      client.send("appearance-result", result);
    } catch (error) {
      client.send("appearance-result", {
        requestId:
          typeof raw?.requestId === "string" ? raw.requestId.slice(0, 64) : "",
        status: "rejected",
        revision: avatar.revision,
        error: error.message,
      });
    }
  }
  onDrop(client) {
    const avatar = this.state.players.get(client.sessionId);
    if (avatar) avatar.connected = false;
    this.allowReconnection(client, RECONNECT_SECONDS);
  }
  onReconnect(client) {
    const avatar = this.state.players.get(client.sessionId);
    if (avatar) avatar.connected = true;
    this.watchTraffic(client);
  }
  onLeave(client) {
    this.actors.get(client.sessionId)?.dispose();
    this.actors.delete(client.sessionId);
    this.state.players.delete(client.sessionId);
    this.traffic.delete(client.sessionId);
  }
  onDispose() {
    for (const resource of this.actors?.values() || []) resource.dispose();
    this.actors?.clear();
    this.physics?.dispose();
    if (activeRoom === this) activeRoom = null;
  }
  diagnostics() {
    const sorted = [...this.tickDurations].sort((a, b) => a - b),
      p = (q) => sorted[Math.max(0, Math.ceil(q * sorted.length) - 1)] ?? null;
    return {
      protocol: PRESENCE_PROTOCOL,
      roomId: this.roomId,
      collisionHash: COLLISION_RELEASE.collisionHash,
      clients: this.clients.length,
      actors: this.actors.size,
      capacity: ROOM_LIMIT,
      tickRate: TICK_RATE,
      physicsHz: TICK_RATE * PHYSICS_SUBSTEPS,
      patchIntervalMs: PATCH_INTERVAL,
      ticks: this.ticks,
      tickP95Ms: p(0.95),
      tickP99Ms: p(0.99),
      tickMaxMs: sorted.at(-1) ?? null,
      tickTailsByActorCount: [...this.tickLoads].map(([actors, samples]) => ({
        actors,
        ...summarizeDurations(samples),
      })),
      colliders: this.physics.counts,
      traffic: [...this.traffic].map(([id, counters]) => ({ id, ...counters })),
      memory: process.memoryUsage(),
    };
  }
}
