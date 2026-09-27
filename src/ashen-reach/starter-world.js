import {
  createTransformNode,
  disposeMeshGpu,
  createSceneContext,
  disposeScene,
  setParent,
  waitForGpuIdle,
  addToScene,
  removeFromScene,
  createMeshFromData,
  createMeshFromStorageBuffer,
  createStorageBuffer,
  updateStorageBufferRange,
  disposeStorageBuffer,
  onSceneDispose,
  setMeshVisible,
  setShaderUniform,
  setShaderTexture,
  loadTexture2D,
} from "@babylonjs/lite";
import { surface, sky } from "./materials.js";
import { prepareLinearMaterial } from "./linear-materials.js";
import { Batch, height, buildingPads } from "./geometry.js";
import { sampleTerrainSurface } from "./terrain-grid.js";
import { createBakedWoodland } from "./baked-woodland.js";
import { createFoliageDensity } from "./foliage-density.js";
import { createFoliage } from "./foliage.js";
import { createLightShafts } from "./light-shafts.js";
import { createAshMotes } from "./ash-motes.js";
import { yieldToFrame } from "./frame-budget.js";

const ROOT = "/ashen-reach/startup/starter/";
async function checkedFetch(url) {
  const response = await fetch(url);
  if (!response.ok) throw Error(`${url}: HTTP ${response.status}`);
  return response;
}
export function preloadStarterWorld() {
  return checkedFetch(ROOT + "manifest.json").then(async (response) => {
    const manifest = await response.json();
    const expected=import.meta.env.VITE_STARTER_WORLD_SOURCE;
    if(expected&&manifest.provenance?.sha256!==expected)throw Error('The world has been updated. Reload to use the matching starting assets.');
    // Discover tiny first-frame maps while geometry is still in flight. Waiting
    // for geometry before surface() starts them adds multiple network round trips.
    const textures = Promise.all(
      // Vegetation is installed after input unlocks. Its larger atlas must
      // not compete with, or delay, the required ground/body downloads.
      [...new Set(Object.entries(manifest.textureURLs)
        .filter(([source]) => !source.endsWith('/foliage-atlas.png'))
        .map(([, url]) => url))].map((url) =>
        checkedFetch(url).then((r) => r.arrayBuffer()),
      ),
    );
    textures.catch(() => {});
    const response2 = await checkedFetch(ROOT + manifest.geometry.file);
    const bytes = await new Response(
      response2.body.pipeThrough(new DecompressionStream("gzip")),
    ).arrayBuffer();
    await textures;
    if (bytes.byteLength !== manifest.geometry.rawBytes)
      throw Error("Starting world geometry is truncated");
    return { manifest, bytes };
  });
}

/** Lite's storage-backed mesh keeps the final draw count and binding identity.
 * Upload ranges fill its zero-initialized buffers without rebuilding geometry
 * or creating one render mesh per network/worker chunk.
 * https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/packages/babylon-lite/src/mesh/mesh-from-storage.ts
 * https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/packages/babylon-lite/src/resource/storage-buffer.ts
 */
export async function createStarterWorld(engine, scene, prepared) {
  const { manifest, bytes } = await prepared;
  engine.ashenTextureURLs = manifest.textureURLs;
  engine.ashenTextureUpgrades = [];
  const mats = await Promise.all(
    manifest.surfaces.map((s) => surface(engine, s.name, s.url, s.options)),
  );
  mats.forEach((m) => prepareLinearMaterial(scene, m));
  // Shadow passes read only positions. A separate compact native vertex stream
  // avoids fetching each 64-byte colour vertex for every shadow cascade.
  // https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/docs/lite/architecture/17-cascaded-shadow.md
  const shadowScene = createSceneContext(engine, { defaultRenderTask: false });
  const meshes = [],
    shadowMeshes = [],
    colliders = [],
    allocations = [],
    byName = new Map(),
    shadowByName = new Map();
  let disposed = false,
    worker = null,
    foliage = null,
    regionPromise = null,
    wakeWorker = null,
    gateMesh = null,
    gates = null;
  const proxies = new Map(),
    installedBlocks = new Set(),
    installedCollisions = new Set(),
    installedBoxes = new Set(),
    collisionSources = new Set();
  const streaming = {
    blocks: 0,
    worstInstallMs: 0,
    backgroundWorstInstallMs: 0,
    backgroundSlowest: null,
    totalInstallMs: 0,
    allocatedBytes: 0,
  };
  const records = manifest.meshes.map((record) => {
    if (!record.world) return { ...record };
    const vertices = createStorageBuffer(engine, record.vertices * 64, {
      vertex: true,
      label: record.name,
    });
    const indices = createStorageBuffer(engine, record.indices * 4, {
      index: true,
      label: record.name + " indices",
    });
    const shadowVertices = createStorageBuffer(engine, record.vertices * 16, {
      vertex: true,
      label: record.name + " shadow positions",
    });
    allocations.push(vertices, indices, shadowVertices);
    const mesh = createMeshFromStorageBuffer(engine, record.name, {
      storage: vertices,
      indices,
      indexFormat: "uint32",
      indexCount: record.indices,
      vertexCount: record.vertices,
      arrayStride: 64,
      attributeOffsets: { position: 0, normal: 16, uv: 32, uv2: 40, color: 48 },
      boundMin: record.boundMin,
      boundMax: record.boundMax,
    });
    mesh.material = mats[record.material];
    mesh.pickable = false;
    addToScene(scene, mesh);
    meshes.push(mesh);
    byName.set(record.name, mesh);
    const shadowMesh = createMeshFromStorageBuffer(
      engine,
      record.name + " shadow",
      {
        storage: shadowVertices,
        indices,
        indexFormat: "uint32",
        indexCount: record.indices,
        vertexCount: record.vertices,
        arrayStride: 16,
        attributeOffsets: { position: 0 },
        boundMin: record.boundMin,
        boundMax: record.boundMax,
      },
    );
    shadowMesh.material = mesh.material;
    shadowMesh.pickable = false;
    setParent(shadowMesh, mesh);
    addToScene(shadowScene, shadowMesh);
    shadowMeshes.push(shadowMesh);
    shadowByName.set(record.name, shadowMesh);
    return {
      ...record,
      mesh,
      verticesBuffer: vertices,
      indexBuffer: indices,
      shadowVertices,
    };
  });
  streaming.allocatedBytes = allocations.reduce(
    (sum, buffer) => sum + buffer.byteLength,
    0,
  );
  function install(block, player) {
    const started = performance.now(),
      key = `${block.meshId}:${block.indexOffset}`;
    if (installedBlocks.has(key)) return;
    const record = records[block.meshId],
      b = block.buffers;
    if (record.collision && !installedCollisions.has(key)) {
      const collider = createMeshFromData(
        engine,
        record.name + " collision",
        b.positions,
        b.normals,
        b.indices,
      );
      setMeshVisible(collider, false);
      collisionSources.add(collider);
      const entry = {
        type: "mesh",
        mesh: collider,
        node: createTransformNode(record.name + " collision transform"),
      };
      if (player) {
        try { player.installStaticColliders([entry]); }
        finally { releaseCollisionSource(collider); }
      }
      colliders.push(entry);
      // A later GPU upload may throw. Its retry must not cook another copy of
      // collision that is already live in Havok.
      installedCollisions.add(key);
    }
    if (record.world) {
      const count = b.positions.length / 3,
        interleaved = new Float32Array(count * 16),
        positions = new Float32Array(count * 4);
      for (let i = 0; i < count; i++) {
        const target = i * 16,
          p = i * 3,
          u = i * 2,
          c = i * 4;
        for (let q = 0; q < 3; q++) {
          interleaved[target + q] = b.positions[p + q];
          interleaved[target + 4 + q] = b.normals[p + q];
        }
        interleaved[target + 3] = 1;
        for (let q = 0; q < 3; q++) positions[i * 4 + q] = b.positions[p + q];
        positions[i * 4 + 3] = 1;
        for (let q = 0; q < 2; q++) {
          interleaved[target + 8 + q] = b.uvs[u + q];
          interleaved[target + 10 + q] = b.uv2[u + q];
        }
        for (let q = 0; q < 4; q++)
          interleaved[target + 12 + q] = b.colors[c + q];
      }
      const indices = Uint32Array.from(
        b.indices,
        (index) => index + block.vertexOffset,
      );
      updateStorageBufferRange(
        engine,
        record.verticesBuffer,
        interleaved,
        block.vertexOffset * 64,
      );
      updateStorageBufferRange(
        engine,
        record.indexBuffer,
        indices,
        block.indexOffset * 4,
      );
      updateStorageBufferRange(
        engine,
        record.shadowVertices,
        positions,
        block.vertexOffset * 16,
      );
      // Geometry contents changed without changing its allocation. Public transform
      // dirtiness invalidates any shadow cache just as woodland detail changes do.
      const p = record.mesh.position;
      p.set(p.x, p.y, p.z);
      if (block.indexOffset + b.indices.length === record.indices) {
        const proxy = proxies.get(record.name);
        if (proxy) setMeshVisible(proxy, false);
      }
    }
    installedBlocks.add(key);
    streaming.blocks++;
    const ms = performance.now() - started;
    streaming.worstInstallMs = Math.max(streaming.worstInstallMs, ms);
    streaming.totalInstallMs += ms;
    if (player && ms > streaming.backgroundWorstInstallMs) {
      streaming.backgroundWorstInstallMs = ms;
      streaming.backgroundSlowest = {
        name: record.name,
        triangles: b.indices.length / 3,
      };
    }
  }
  function releaseCollisionSource(mesh) {
    // Native Havok copies CPU triangle data during shape creation. Streamed
    // bodies use a separate identity transform because these vertices are world
    // space. The source never joins a render scene, so no submitted draw owns it.
    // https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/packages/babylon-lite/src/physics/havok.ts
    // https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/packages/babylon-lite/src/mesh/mesh-dispose.ts
    disposeMeshGpu(mesh);
    collisionSources.delete(mesh);
  }

  const readBlock = (block) =>
    Object.fromEntries(
      Object.entries(block.attributes).map(([key, a]) => [
        key,
        key === "indices"
          ? new Uint32Array(bytes, a.offset, a.length)
          : new Float32Array(bytes, a.offset, a.length),
      ]),
    );
  for (const block of manifest.geometry.blocks) {
    install({ ...block, buffers: readBlock(block) });
  }
  for (const block of manifest.geometry.proxies ?? []) {
    const b = readBlock(block),
      mesh = createMeshFromData(
        engine,
        block.name + " skyline",
        b.positions,
        b.normals,
        b.indices,
        b.uvs,
        b.uv2,
        undefined,
        b.colors,
      );
    mesh.material = mats[block.material];
    addToScene(scene, mesh);
    proxies.set(block.name, mesh);
    meshes.push(mesh);
    shadowMeshes.push(mesh);
  }
  const intersectsStart = (entry) => {
    const { position: p, size: s } = entry,
      b = manifest.bounds;
    return (
      p.x + s.x / 2 >= b.minX &&
      p.x - s.x / 2 <= b.maxX &&
      p.z + s.z / 2 >= b.minZ &&
      p.z - s.z / 2 <= b.maxZ
    );
  };
  colliders.push(...manifest.boxes.filter(intersectsStart));
  const m = manifest.metadata,
    woodland = createBakedWoodland(
      scene,
      manifest.woodland,
      byName,
      shadowByName,
    );
  const shafts = await createLightShafts(engine, scene, m.shafts ?? []);
  if (shafts?.mesh) meshes.push(shafts.mesh);
  const clouds = await sky(engine, scene),
    motes = await createAshMotes(engine, scene, { lights: m.lights });
  if (motes?.mesh) meshes.push(motes.mesh);
  // Functions intentionally do not cross the JSON/worker boundary.
  const route = m.cathedral.route;
  route.heightAt = (z) =>
    route.start[1] +
    (route.end[1] - route.start[1]) *
      Math.max(
        0,
        Math.min(1, (z - route.start[2]) / (route.end[2] - route.start[2])),
      );
  const stats = {
    ...m.sourceStats,
    shaftTriangles: shafts?.triangles ?? 0,
    motes: motes?.count ?? 0,
    moteTriangles: motes?.triangles ?? 0,
    foliageInstances: 0,
  };
  Object.defineProperties(stats, {
    triangles: {
      enumerable: true,
      get: () => m.fixedTriangles + woodland.state.triangles,
    },
    drawBatches: {
      enumerable: true,
      get: () => meshes.filter((mesh) => mesh.visible !== false).length,
    },
  });
  const api = {
    ...m,
    streaming,
    woodland,
    meshes,
    shadowMeshes,
    colliders,
    buildingPads,
    groundHeight: (x, z) => sampleTerrainSurface(x, z, height),
    stats,
    foliage: null,
    whenFoliage: null,
    nearbyReady: false,
    update(t, playerPos) {
      woodland.update();
      foliage?.update(t, playerPos);
      clouds.update(t);
      shafts?.update(t);
      motes?.update(t);
      for (const mat of mats) setShaderUniform(mat, "time", t);
    },
    startNearbyFoliage() {
      return (api.whenNearbyFoliage ??= createFoliage(engine, scene, {
        placements: Object.fromEntries(
          Object.entries(manifest.foliage).map(([name, block]) => [
            name,
            { count: block.count, ...readBlock(block) },
          ]),
        ),
      }).then((created) => {
        foliage = api.foliage = created;
        meshes.push(...created.meshes);
        stats.foliageInstances = created.stats.instances;
        api.nearbyReady = true;
        return created;
      }).catch(error=>{api.whenNearbyFoliage=null;throw error;}));
    },
    startFoliage() {
      return (api.whenFoliage ??= api
        .startNearbyFoliage()
        .then(() => foliage.replacePlacements(api.preparedFoliage))
        .then(() => {
          api.preparedFoliage = null;
          stats.foliageInstances = foliage.stats.instances;
          return foliage;
        }));
    },
    startRegion(player) {
      if (disposed)
        return Promise.reject(Error("Scene disposed during region load"));
      return (regionPromise ??= loadRegion(player).catch((error) => {
        regionPromise = null;
        throw error;
      }));
    },
    releaseInitialCollisionSources() {
      for (const mesh of collisionSources) releaseCollisionSource(mesh);
    },
    retireProxies() {
      for (const mesh of proxies.values()) {
        const index = meshes.indexOf(mesh);
        if (index >= 0) meshes.splice(index, 1);
        const shadowIndex = shadowMeshes.indexOf(mesh);
        if (shadowIndex >= 0) shadowMeshes.splice(shadowIndex, 1);
        removeFromScene(scene, mesh);
      }
      proxies.clear();
    },
  };
  async function loadRegion(player) {
    // A visible temporary railing and Havok boundary prevent walking onto a
    // surface whose collision has not arrived. No coordinate clamps or teleports.
    if (!gates) {
      const b = manifest.bounds,
        gateEntries = [],
        gateBatch = new Batch("Opening paths fence");
      for (const [x, z, w, d] of [
        [b.minX + 3, 4, 1, 34],
        [b.maxX - 3, 4, 1, 34],
        [0, b.minZ + 3, 27, 1],
        [0, b.maxZ - 3, 27, 1],
      ]) {
        const y = height(x, z),
          alongX = w > d,
          length = alongX ? w : d;
        for (let step = 0; step <= Math.ceil(length / 4); step++) {
          const offset = -length / 2 + (step * length) / Math.ceil(length / 4),
            px = x + (alongX ? offset : 0),
            pz = z + (alongX ? 0 : offset),
            g = height(px, pz);
          gateBatch.box(
            [px, g + 1.75, pz],
            [0.24, 3.5, 0.24],
            [0.55, 0.48, 0.36, 0],
          );
        }
        for (const h of [0.8, 1.9, 3])
          gateBatch.box(
            [x, y + h, z],
            [alongX ? w : 0.14, 0.16, alongX ? 0.14 : d],
            [0.65, 0.57, 0.43, 0],
          );
        gateEntries.push({
          type: "box",
          position: { x, y: y + 1.5, z },
          size: { x: w, y: 4, z: d },
        });
      }
      gateMesh = gateBatch.commit(engine, scene, mats[2], m.lights);
      gates = player.installStaticColliders(gateEntries);
    }
    const queue = [];
    let done = false,
      error = null;
    worker = new Worker(new URL("./world-worker.js", import.meta.url), {
      type: "module",
    });
    worker.onmessage = ({ data }) => {
      if (
        data.header &&
        JSON.stringify(data.header.meshes) !== JSON.stringify(manifest.meshes)
      )
        error = Object.assign(Error(
          "Prepared world and generator versions differ; reload after rebuilding the starting assets",
        ), {reloadRequired:true});
      if (data.foliage) api.preparedFoliage = data.foliage;
      if (data.batch) queue.push(data.batch);
      if (data.done) done = true;
      if (data.error) error = Error(data.error);
      wakeWorker?.();
    };
    worker.onerror = (event) => {
      error = Error(event.message);
      wakeWorker?.();
    };
    worker.postMessage({ start: true });
    try {
      while (!done || queue.length) {
        if (disposed) throw Error("Scene disposed during region load");
        if (error) throw error;
        if (!queue.length) {
          await new Promise((resolve) => {
            wakeWorker = resolve;
          });
          wakeWorker = null;
          continue;
        }
        const started = performance.now();
        do {
          install(queue.shift(), player);
          worker.postMessage({ ack: true });
        } while (queue.length && performance.now() - started < 1);
        await yieldToFrame();
      }
      if (error) throw error;
      let boxStart = performance.now();
      for (const [index, entry] of manifest.boxes.entries()) {
        if (intersectsStart(entry) || installedBoxes.has(index)) continue;
        if (disposed) throw Error("Scene disposed during collision load");
        player.installStaticColliders([entry]);
        colliders.push(entry);
        installedBoxes.add(index);
        if (performance.now() - boxStart >= 1) {
          await yieldToFrame();
          boxStart = performance.now();
        }
      }
      // Every route now has real collision. Texture enhancement must not keep
      // the player boxed in while independent network requests finish.
      gates.dispose();
      gates = null;
      removeFromScene(scene, gateMesh);
      gateMesh = null;
    } finally {
      worker?.terminate();
      worker = null;
    }
  }
  api.upgradeTextures = async () => {
    for (const { mat, slots } of engine.ashenTextureUpgrades) {
      for (const [slot, url, filter, srgb = false] of slots) {
        const texture = await loadTexture2D(engine, url, {
          invertY: false,
          srgb,
          mipMaps: true,
          minFilter: filter,
          magFilter: filter,
        });
        if (disposed) throw Error("Scene disposed during texture load");
        setShaderTexture(mat, slot, texture);
        await yieldToFrame();
      }
    }
    delete engine.ashenTextureUpgrades;
    delete engine.ashenTextureURLs;
  };
  onSceneDispose(scene, () => {
    disposed = true;
    worker?.terminate();
    wakeWorker?.();
    for (const mesh of collisionSources) releaseCollisionSource(mesh);
    disposeScene(shadowScene);
    // Storage buffers are caller-owned; let already submitted shadow work finish.
    const release = () => {
      for (const buffer of allocations) disposeStorageBuffer(buffer);
    };
    void waitForGpuIdle(engine).then(release, release);
  });
  return api;
}
