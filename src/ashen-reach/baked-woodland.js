import {
  getCameraPosition,
  setMeshVisible,
  onSceneDispose,
} from "@babylonjs/lite";
import { distanceToWoodlandBounds, woodlandDetail } from "./woodland-tiles.js";

/** Reuse the established distance/hysteresis policy with prepared full/reduced meshes. */
export function createBakedWoodland(
  scene,
  records,
  byName,
  shadowByName = new Map(),
) {
  const visible = (mesh, value) => {
    if (!mesh) return; // Streamed records can arrive after first play.
    setMeshVisible(mesh, value);
    const shadow = shadowByName.get(mesh.name);
    if (shadow) setMeshVisible(shadow, value);
  };
  const tiles = new Map(
    records.map((r) => [
      r.key,
      {
        ...r,
        fullName: r.full,
        reducedName: r.reduced,
        full: byName.get(r.full),
        reduced: byName.get(r.reduced),
        detail: "full",
      },
    ]),
  );
  let disposed = false,
    revision = 0,
    transitions = 0;
  const tileByMeshName = new Map();
  const resolveMeshes = (tile) => {
    tile.full = byName.get(tile.fullName);
    tile.reduced = byName.get(tile.reducedName);
    visible(tile.full, tile.detail === "full");
    visible(tile.reduced, tile.detail === "reduced");
  };
  const camera = getCameraPosition(scene.camera);
  for (const t of tiles.values()) {
    tileByMeshName.set(t.fullName, t);
    tileByMeshName.set(t.reducedName, t);
    t.detail = woodlandDetail(
      distanceToWoodlandBounds(camera, t.bounds),
      "full",
    );
    visible(t.full, t.detail === "full");
    visible(t.reduced, t.detail === "reduced");
  }
  const api = {
    tiles,
    get meshes() { return [...tiles.values()].flatMap((t) => [t.full, t.reduced]).filter(Boolean); },
    meshArrived(name) {
      if (disposed) return;
      const tile = tileByMeshName.get(name);
      // Arrival inherits the current selection without spending another tile
      // transition. This also applies while a menu pauses world.update().
      // https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/docs/lite/architecture/01-scene.md
      if (tile) resolveMeshes(tile);
    },
    update() {
      if (disposed) return;
      const p = getCameraPosition(scene.camera);
      let candidate = null;
      for (const tile of tiles.values()) {
        // Resolve arriving native meshes through the same maps, preserving the
        // tile's existing distance/hysteresis selection and shadow visibility.
        // No placeholder mesh or separate LOD implementation is necessary.
        // https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/docs/lite/architecture/01-scene.md
        const full = byName.get(tile.fullName), reduced = byName.get(tile.reducedName);
        if (full !== tile.full || reduced !== tile.reduced) {
          resolveMeshes(tile);
        }
        const distance = distanceToWoodlandBounds(p, tile.bounds),
          next = woodlandDetail(distance, tile.detail);
        if (next === tile.detail) continue;
        const score = next === "full" ? distance : 10000 - distance;
        if (!candidate || score < candidate.score)
          candidate = { tile, next, score };
      }
      if (candidate) {
        const { tile, next } = candidate;
        tile.detail = next;
        visible(tile.full, next === "full");
        visible(tile.reduced, next === "reduced");
        const p = (tile.full ?? tile.reduced)?.position;
        p?.set(p.x, p.y, p.z);
        revision++;
        transitions++;
      }
    },
    get state() {
      return {
        disposed,
        revision,
        transitions,
        tiles: tiles.size,
        full: [...tiles.values()].filter((t) => t.detail === "full").length,
        triangles: [...tiles.values()].reduce(
          (n, t) => n + (t[t.detail]?._gpu?.indexCount ?? 0) / 3,
          0,
        ),
      };
    },
  };
  onSceneDispose(scene, () => {
    disposed = true;
    tiles.clear();
    tileByMeshName.clear();
  });
  return api;
}
