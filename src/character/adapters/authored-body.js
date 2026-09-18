import {
  addAnimationGroups,
  addToScene,
  clearAnimationManager,
  computeMaxExtents,
  createAnimationManager,
  enableAnimationBlending,
  enableBoneControl,
  getContainerMeshes,
  loadGltf,
  playAnimation,
  rebuildScenePbrPipelines,
  rebuildSceneRenderables,
  removeFromScene,
  setAnimationWeight,
  setMeshVisible,
  stopAnimation,
  updateAnimationManager,
} from "@babylonjs/lite";

enableBoneControl();

async function refreshScene(scene) {
  await rebuildSceneRenderables(scene);
  await rebuildScenePbrPipelines(scene);
}

function unionExtents(extents) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const e of extents) {
    for (let i = 0; i < 3; i++) {
      min[i] = Math.min(min[i], e.minimum[i]);
      max[i] = Math.max(max[i], e.maximum[i]);
    }
  }
  if (!Number.isFinite(min[0])) {
    return { min: [0, 0, 0], max: [0, 1.75, 0], height: 1.75 };
  }
  return { min, max, height: Math.max(0.01, max[1] - min[1]) };
}

function stopAll(groups) {
  for (const group of groups) {
    stopAnimation(group);
    setAnimationWeight(group, 0);
  }
}

function setMeshesVisible(meshes, visible) {
  for (const mesh of meshes) {
    setMeshVisible(mesh, visible);
  }
}

function poseAsset(asset, name, time = 0) {
  if (!name) {
    stopAll(asset.groups);
    asset.active = null;
    return;
  }
  const group = asset.groups.find((g) => g.name === name);
  if (!group) {
    throw new Error(`Missing animation: ${name}`);
  }
  stopAll(asset.groups);
  group.loopAnimation = true;
  group.currentTime = time;
  setAnimationWeight(group, 1);
  playAnimation(group);
  asset.active = group;
  updateAnimationManager(asset.manager, 0);
}

function applySession(asset, session) {
  if (asset.root?.rotation) {
    asset.root.rotation.y = session.yaw;
  }
  const names = asset.groups.map((g) => g.name);
  const preferred = session.clip && names.includes(session.clip) ? session.clip : names[0] || null;
  if (preferred) {
    poseAsset(asset, preferred, session.time || 0);
    session.clip = preferred;
  } else {
    poseAsset(asset, null);
    session.clip = null;
    session.time = 0;
  }
}

/**
 * Single authored-body actor. Public Lite load/scene/animation APIs only.
 * No Mixamo 0.01 root compensation. Object yaw is independent of clip channels.
 */
export async function createAuthoredBody({ engine, scene, url }) {
  let current = null;
  let disposed = false;
  let revision = 0;
  let queue = Promise.resolve();
  const session = { clip: null, time: 0, paused: false, yaw: Math.PI };
  let lastError = null;

  function retire(asset) {
    if (!asset || asset.retired) {
      return;
    }
    asset.retired = true;
    stopAll(asset.groups);
    if (asset.manager) {
      clearAnimationManager(asset.manager);
    }
    setMeshesVisible(asset.meshes, false);
    if (asset.inScene) {
      removeFromScene(scene, asset.container);
      asset.inScene = false;
    }
  }

  async function assemble(nextUrl) {
    const container = await loadGltf(engine, nextUrl);
    const root = container.entities?.[0];
    if (!root) {
      throw new Error("Authored body has no root");
    }
    const meshes = getContainerMeshes(container);
    const groups = container.animationGroups || [];
    const manager = createAnimationManager({ engine });
    if (groups.length) {
      addAnimationGroups(manager, groups);
      enableAnimationBlending(manager);
    }
    setMeshesVisible(meshes, false);
    for (const mesh of meshes) {
      mesh.receiveShadows = true;
    }
    addToScene(scene, container);
    const asset = {
      url: nextUrl,
      container,
      root,
      meshes,
      groups,
      manager,
      active: null,
      extents: null,
      inScene: true,
      retired: false,
    };
    try {
      const extents = unionExtents(computeMaxExtents(meshes));
      if (root.position) {
        root.position.y -= extents.min[1];
      }
      asset.extents = unionExtents(computeMaxExtents(meshes));
    } catch (error) {
      retire(asset);
      throw error;
    }
    return asset;
  }

  async function commit(staged) {
    applySession(staged, session);
    const old = current;
    if (old) {
      setMeshesVisible(old.meshes, false);
    }
    setMeshesVisible(staged.meshes, true);
    current = staged;
    lastError = null;
    if (old) {
      retire(old);
    }
    await refreshScene(scene);
  }

  const api = {
    get url() {
      return current?.url ?? null;
    },
    get clipNames() {
      return current ? current.groups.map((g) => g.name) : [];
    },
    get clips() {
      return current
        ? current.groups.map((g) => ({ name: g.name, duration: g.duration }))
        : [];
    },
    get currentClip() {
      return current?.active?.name ?? session.clip;
    },
    get currentTime() {
      return current?.active?.currentTime ?? (current?.groups.length ? session.time : null);
    },
    get extents() {
      return current?.extents ?? null;
    },
    get lastError() {
      return lastError;
    },
    getMeshes() {
      return current ? [...current.meshes] : [];
    },
    samplePalette() {
      const samples = [];
      for (const mesh of current?.meshes ?? []) {
        const mats = mesh.skeleton?.boneMatrices;
        if (mats?.length) {
          samples.push(Array.from(mats.subarray(0, Math.min(mats.length, 64))));
        }
      }
      return samples;
    },
    diagnostics() {
      const meshes = current?.meshes ?? [];
      const skeletons = new Set(meshes.filter((m) => m.skeleton).map((m) => m.skeleton));
      return {
        url: current?.url ?? null,
        clipNames: api.clipNames,
        clips: api.clips,
        clip: current?.active?.name ?? (current?.groups.length ? session.clip : null),
        time: current?.active?.currentTime ?? (current?.groups.length ? session.time : null),
        paused: session.paused,
        yaw: session.yaw,
        meshCount: meshes.length,
        skinBindings: meshes.filter((m) => m.skeleton).length,
        uniqueSkeletons: skeletons.size,
        animationManagers: current?.manager ? 1 : 0,
        animationGroupCount: current?.groups.length ?? 0,
        extents: current?.extents ?? null,
        lastError,
        palette: api.samplePalette(),
      };
    },
    update(deltaSeconds) {
      if (!current || disposed || session.paused || !current.groups.length) {
        return;
      }
      updateAnimationManager(current.manager, Math.min(deltaSeconds, 0.05) * 1000);
      if (current.active) {
        session.time = current.active.currentTime;
      }
    },
    setClip(name, time = 0, freeze = false) {
      session.clip = name || null;
      session.time = time;
      session.paused = freeze;
      if (current) {
        poseAsset(current, name, time);
      }
    },
    seek(time) {
      session.time = time;
      if (!current?.active) {
        return;
      }
      current.active.currentTime = time;
      updateAnimationManager(current.manager, 0);
    },
    setPaused(value) {
      session.paused = !!value;
    },
    setYaw(value) {
      session.yaw = value;
      if (current?.root?.rotation) {
        current.root.rotation.y = value;
      }
    },
    load(nextUrl) {
      const ticket = ++revision;
      const operation = queue.catch(() => {}).then(async () => {
        if (disposed || ticket !== revision) {
          return { stale: true };
        }
        let staged;
        try {
          staged = await assemble(nextUrl);
        } catch (error) {
          lastError = error.message || String(error);
          throw error;
        }
        if (disposed || ticket !== revision) {
          retire(staged);
          await refreshScene(scene);
          return { stale: true };
        }
        await commit(staged);
        return { url: staged.url, meshes: staged.meshes.length, clips: staged.groups.length };
      });
      queue = operation;
      return operation;
    },
    dispose() {
      if (disposed) {
        return;
      }
      disposed = true;
      revision++;
      if (current) {
        retire(current);
        current = null;
      }
    },
  };

  const first = await assemble(url);
  await commit(first);
  return api;
}
