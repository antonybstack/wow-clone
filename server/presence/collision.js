/** Static headless Havok world, using the pinned Lite cook/ownership APIs.
 * NullEngine cannot perform a render world-matrix pass. The exported vertices
 * are already world-space, so CPU cook sources explicitly retain identity TRS.
 * `_gpu` is only Lite's isMesh discriminator here: there are no GPU resources.
 * Keep this version guard and real mesh/controller parity checks on migration.
 * https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/packages/babylon-lite/src/physics/havok.ts
 * https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/packages/babylon-lite/src/engine/null-engine.ts
 */
import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import Havok from "@babylonjs/havok";
import {
  VERSION,
  createNullEngine,
  createSceneContext,
  createHavokWorld,
  createTransformNode,
  stepScene,
  disposeScene,
} from "@babylonjs/lite";
import {
  addStaticColliders,
  createPhysicsOwnership,
  setupPlayer,
} from "../../src/player.js";
import { sampleTerrainSurface } from "../../src/ashen-reach/terrain-grid.js";
import { height as terrainHeight } from "../../src/ashen-reach/geometry.js";
import { HUMAN_CAPSULE } from "../../src/multiplayer/protocol.js";
import { COLLISION_RELEASE } from "../../src/multiplayer/collision-release.js";
const hash = (b) => createHash("sha256").update(b).digest("hex");
let runtime;
export async function createRegionPhysics() {
  if (VERSION !== "1.31.1")
    throw Error("Headless collision adapter requires reviewed Lite 1.31.1");
  const root = "public/ashen-reach/presence-v1",
    json = await fs.readFile(`${root}/${COLLISION_RELEASE.file}`);
  if (
    json.length !== COLLISION_RELEASE.bytes ||
    hash(json) !== COLLISION_RELEASE.collisionHash
  )
    throw Error("Server collision metadata mismatch");
  const metadata = JSON.parse(json),
    bytes = await fs.readFile(`${root}/${metadata.data.file}`);
  if (
    bytes.length !== metadata.data.bytes ||
    hash(bytes) !== metadata.data.sha256
  )
    throw Error("Server collision geometry mismatch");
  if (metadata.sourceHash !== COLLISION_RELEASE.sourceHash)
    throw Error("Server collision source mismatch");
  runtime ||= Havok({
    wasmBinary: await fs.readFile("public/HavokPhysics.wasm"),
  });
  const engine = createNullEngine(),
    scene = createSceneContext(engine, { defaultRenderTask: false });
  const world = createHavokWorld(scene, await runtime, {
    x: 0,
    y: -20.8,
    z: 0,
  });
  const owner = createPhysicsOwnership({});
  owner.setWorld(world);
  try {
    const descriptors = metadata.chunks.map((chunk, index) => {
      const mesh = createTransformNode(`CPU_collision_${index}`);
      mesh._gpu = null;
      mesh._cpuPositions = new Float32Array(
        bytes.buffer,
        bytes.byteOffset + chunk.positionOffset,
        chunk.positionCount,
      );
      mesh._cpuIndices = new Uint32Array(
        bytes.buffer,
        bytes.byteOffset + chunk.indexOffset,
        chunk.indexCount,
      );
      return {
        type: "mesh",
        mesh,
        node: createTransformNode(`Static_collision_${index}`),
      };
    });
    const counts = addStaticColliders(
      world,
      descriptors.concat(metadata.boxes),
      owner,
    );
    if (
      counts.skipped ||
      counts.meshCount !== metadata.chunks.length ||
      counts.boxCount !== metadata.boxes.length
    )
      throw Error("Incomplete server collision");
    const players = new Set();
    let disposed = false;
    return {
      engine,
      scene,
      world,
      counts,
      collisionHash: COLLISION_RELEASE.collisionHash,
      step(ms) {
        stepScene(engine, scene, ms);
      },
      async actor(x = 0, z = 0, height = 1) {
        if (disposed) throw Error("Server world is disposed");
        const player = await setupPlayer(
          engine,
          scene,
          { yaw: 0, update() {}, applyLook() {} },
          {
            headless: true,
            manualStep: true,
            physicsWorld: world,
            capsule: HUMAN_CAPSULE,
            spawn: {
              x,
              y:
                sampleTerrainSurface(x, z, terrainHeight) +
                HUMAN_CAPSULE.height * 0.5,
              z,
            },
            groundHeight: (x, z) => sampleTerrainSurface(x, z, terrainHeight),
            boundsRadius: Infinity,
          },
        );
        player.setHeightScale(height);
        players.add(player);
        return {
          player,
          dispose() {
            if (players.delete(player)) player.dispose();
          },
        };
      },
      dispose() {
        if (disposed) return;
        disposed = true;
        for (const p of players) p.dispose();
        players.clear();
        owner.dispose();
        disposeScene(scene);
      },
    };
  } catch (error) {
    owner.dispose();
    disposeScene(scene);
    throw error;
  }
}
