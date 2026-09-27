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
    setMeshVisible(mesh, value);
    const shadow = shadowByName.get(mesh.name);
    if (shadow) setMeshVisible(shadow, value);
  };
  const tiles = new Map(
    records.map((r) => [
      r.key,
      {
        ...r,
        full: byName.get(r.full),
        reduced: byName.get(r.reduced),
        detail: "full",
      },
    ]),
  );
  let disposed = false,
    revision = 0,
    transitions = 0;
  const camera = getCameraPosition(scene.camera);
  for (const t of tiles.values()) {
    t.detail = woodlandDetail(
      distanceToWoodlandBounds(camera, t.bounds),
      "full",
    );
    visible(t.full, t.detail === "full");
    visible(t.reduced, t.detail === "reduced");
  }
  const api = {
    tiles,
    meshes: [...tiles.values()].flatMap((t) => [t.full, t.reduced]),
    update() {
      if (disposed) return;
      const p = getCameraPosition(scene.camera);
      let candidate = null;
      for (const tile of tiles.values()) {
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
        const p = tile.full.position;
        p.set(p.x, p.y, p.z);
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
          (n, t) => n + (t[t.detail]._gpu?.indexCount ?? 0) / 3,
          0,
        ),
      };
    },
  };
  onSceneDispose(scene, () => {
    disposed = true;
    tiles.clear();
    api.meshes.length = 0;
  });
  return api;
}
