import {
  addAnimationGroups,
  addToScene,
  computeDeformedPositionToRef,
  createAnimationManager,
  createCylinder,
  createPbrMaterial,
  createPointLight,
  createSphere,
  createTransformNode,
  enableAnimationBlending,
  enableBoneControl,
  getContainerMeshes,
  getBoneByName,
  loadGltf,
  loadTexture2D,
  mat4Decompose,
  mat4Invert,
  mat4Multiply,
  playAnimation,
  rebuildScenePbrPipelines,
  rebuildSceneRenderables,
  removeFromScene,
  setAnimationWeight,
  setPbrEmissive,
  setMeshVisible,
  setMorphTargetWeights,
  setParent,
  stopAnimation,
  updateAnimationManager,
} from "@babylonjs/lite";
import { createFixtureComposer } from "../runtime/fixture-composer.js";
import { parseGlb, readAccessor } from "../runtime/glb.js";
import { inspectBindContract, assertCompatibleBind } from "../runtime/bind-contract.js";

const STAFF_URL = "/characters/items/staff.glb";
const WOOD_ALBEDO_URL = "/characters/lab/wood-albedo.png";
const HIDDEN_MESHES = new Set(["Alpha_Joints"]);
/** Wrist → Middle1. 0 = wrist origin, 1 = knuckle. */
const PALM_BLEND = 0.8;
/** Staff-root local meters along the grip into the palm. Not a world-up slerp. */
const STAFF_GRIP_LOCAL = { x: 0, y: 0.04, z: -0.02 };
const STAFF_ORB_LOCAL_Y = 1.04;
const STAFF_FERRULE_LOCAL_Y = 0.995;
const WALNUT = [0.35, 0.22, 0.12];
const MAGENTA = [1.0, 0.25, 0.75];
const ORB_EMISSIVE = [0.5, 0.1, 0.32];
const WOOD_TINT = [1, 0.92, 0.82, 1];

const woodAlbedoByEngine = new WeakMap();

async function refreshScene(scene) {
  await rebuildSceneRenderables(scene);
  await rebuildScenePbrPipelines(scene);
}

function applyMixamoRootScale(root) {
  // Lite glTF root uses scale.x = -1 (RH → LH). Replace the Mixamo 0.01 export scale.
  if (root?.scaling) {
    root.scaling.x = -1;
    root.scaling.y = 1;
    root.scaling.z = 1;
  }
}

function setFixtureVisible(mesh, visible) {
  setMeshVisible(mesh, visible && !HIDDEN_MESHES.has(mesh.name));
}

function applyStaffPalm(root) {
  if (!root?.position) {
    return;
  }
  root.position.set(STAFF_GRIP_LOCAL.x, STAFF_GRIP_LOCAL.y, STAFF_GRIP_LOCAL.z);
}

function woodAlbedo(engine) {
  if (!woodAlbedoByEngine.has(engine)) woodAlbedoByEngine.set(engine, loadTexture2D(engine, WOOD_ALBEDO_URL, {
    srgb: true,
    mipMaps: true,
    invertY: true,
  }).catch(() => { woodAlbedoByEngine.delete(engine); return null; }));
  return woodAlbedoByEngine.get(engine);
}

async function stainWalnut(engine, mesh) {
  const woodTex = await woodAlbedo(engine);
  try {
    mesh.material = createPbrMaterial({
      name: `${mesh.name || "staff"}_walnut`,
      baseColorFactor: woodTex ? WOOD_TINT : [WALNUT[0], WALNUT[1], WALNUT[2], 1],
      metallicFactor: 0.04,
      roughnessFactor: woodTex ? 0.62 : 0.7,
      baseColorTexture: woodTex || undefined,
    });
  } catch {
    // glTF material replace can be picky; orb + grip still proceed.
  }
}

function showStaff(staff, visible) {
  if (!staff) {
    return;
  }
  const hidden = staff.keepHidden;
  for (const mesh of staff.meshes) {
    setMeshVisible(mesh, visible && !hidden?.has(mesh));
  }
  if (staff.light) staff.light.intensity = visible ? 0.28 : 0;
}

/**
 * Rigid staff on the main-hand socket. Garments stay skinned in the composed GLB;
 * the staff is a separate unskinned container parented to the copied joint node.
 */
async function attachStaff(engine, scene, sockets) {
  const hand = sockets?.sockets?.mainHand?.node;
  if (!hand) {
    throw new Error("Fixture staff requires a mainHand socket");
  }
  const container = await loadGltf(engine, STAFF_URL);
  const root = container.entities?.[0];
  if (!root) {
    throw new Error("staff.glb has no root");
  }
  const extras = [];
  try {
    for (const mesh of getContainerMeshes(container)) setMeshVisible(mesh, false);
    root.name = "Fixture_staff";
    addToScene(scene, container);
    setParent(root, hand);
    if (root.rotation) {
      root.rotation.x = 0;
      root.rotation.y = 0;
      root.rotation.z = 0;
    }
    if (root.rotationQuaternion) {
      root.rotationQuaternion.set(0, 0, 0, 1);
    }
    // Match equipment.js applyLocal for GLB items (undo loader RH→LH on the item).
    if (root.scaling) {
      root.scaling.set(-1, 1, 1);
    }
    applyStaffPalm(root);
    const meshes = getContainerMeshes(container);
    const keepHidden = new Set();
    for (const mesh of meshes) {
      mesh.receiveShadows = true;
      const name = mesh.name || "";
      if (/crystal|prong|collar/i.test(name)) {
        setMeshVisible(mesh, false);
        keepHidden.add(mesh);
      } else if (/shaft|grip/i.test(name)) {
        await stainWalnut(engine, mesh);
      }
    }
    const ferruleMat = createPbrMaterial({
      name: "StaffFerrule",
      baseColorFactor: [0.05, 0.05, 0.05, 1],
      metallicFactor: 0.35,
      roughnessFactor: 0.4,
    });
    // staff.glb shaft is Ø~0.056; 0.026–0.03 would sit inside the wood.
    const ferrule = createCylinder(engine, {
      height: 0.022,
      diameterTop: 0.056,
      diameterBottom: 0.06,
      tessellation: 20,
    });
    extras.push(ferrule);
    setMeshVisible(ferrule, false);
    ferrule.name = "StaffFerrule";
    ferrule.material = ferruleMat;
    ferrule.receiveShadows = true;
    addToScene(scene, ferrule);
    setParent(ferrule, root);
    ferrule.position.set(0, STAFF_FERRULE_LOCAL_Y, 0);
    if (ferrule.rotationQuaternion) {
      ferrule.rotationQuaternion.set(0, 0, 0, 1);
    }
    if (ferrule.scaling) {
      ferrule.scaling.set(1, 1, 1);
    }
    const orbMat = createPbrMaterial({
      name: "StaffOrb",
      baseColorFactor: [0.92, 0.18, 0.62, 1],
      metallicFactor: 0.08,
      roughnessFactor: 0.35,
      environmentIntensity: 0.22,
      directIntensity: 0.55,
    });
    setPbrEmissive(orbMat, ORB_EMISSIVE);
    const orb = createSphere(engine, { diameter: 0.06, segments: 24 });
    extras.push(orb);
    setMeshVisible(orb, false);
    orb.name = "StaffOrb";
    orb.material = orbMat;
    orb.receiveShadows = false;
    addToScene(scene, orb);
    setParent(orb, root);
    orb.position.set(0, STAFF_ORB_LOCAL_Y, 0);
    if (orb.rotationQuaternion) {
      orb.rotationQuaternion.set(0, 0, 0, 1);
    }
    if (orb.scaling) {
      orb.scaling.set(1, 1, 1);
    }
    const light = createPointLight([0, 1, 0], 0);
    extras.push(light);
    light.diffuse = MAGENTA;
    light.specular = [1.0, 0.32, 0.8];
    light.range = 0.55;
    addToScene(scene, light);
    return { root, meshes: [...meshes, orb, ferrule], container, light, crystal: orb, ferrule, keepHidden };
  } catch (error) {
    for (const extra of extras) {
      if (extra.parent) setParent(extra, null);
      removeFromScene(scene, extra);
    }
    setParent(root, null);
    removeFromScene(scene, container);
    throw error;
  }
}

function syncStaffLight(staff) {
  const wm = staff?.crystal?.worldMatrix;
  if (!staff?.light || !wm) {
    return;
  }
  staff.light.position.set(wm[12], wm[13] + 0.03, wm[14]);
}

function jointMeshLocal(boneMatrices, ibm, jointIndex) {
  if (jointIndex < 0 || !boneMatrices || !ibm) {
    return null;
  }
  const boneMat = boneMatrices.slice(jointIndex * 16, jointIndex * 16 + 16);
  const invIbm = mat4Invert(ibm.slice(jointIndex * 16, jointIndex * 16 + 16));
  if (!invIbm) {
    return null;
  }
  return mat4Multiply(boneMat, invIbm);
}

/**
 * Public-API rigid follow: mesh.skeleton.boneMatrices + composed IBM.
 * Does not read _gltfMixer / _ctrl.
 */
function syncStaffFromPalette(asset) {
  const body = asset.meshes.find((m) => m.name === "Alpha_Surface");
  const sock = asset.sockets?.sockets?.mainHand?.node;
  const mats = body?.skeleton?.boneMatrices;
  if (!body?.worldMatrix || !asset.root?.worldMatrix || !sock || !mats || !asset.ibm) {
    return;
  }
  const names = asset.manifest.jointNames;
  const hand = jointMeshLocal(mats, asset.ibm, names.indexOf("mixamorig:RightHand"));
  if (!hand) {
    return;
  }
  const palm = jointMeshLocal(mats, asset.ibm, names.indexOf("mixamorig:RightHandMiddle1"));
  const meshWorld = mat4Multiply(body.worldMatrix, hand);
  const invRoot = mat4Invert(asset.root.worldMatrix);
  if (!invRoot) {
    return;
  }
  const local = mat4Multiply(invRoot, meshWorld);
  const d = mat4Decompose(local);
  let px = d.translation.x;
  let py = d.translation.y;
  let pz = d.translation.z;
  if (palm) {
    const palmWorld = mat4Multiply(invRoot, mat4Multiply(body.worldMatrix, palm));
    const p = mat4Decompose(palmWorld);
    px = px + (p.translation.x - px) * PALM_BLEND;
    py = py + (p.translation.y - py) * PALM_BLEND;
    pz = pz + (p.translation.z - pz) * PALM_BLEND;
  }
  sock.position.set(px, py, pz);
  sock.rotationQuaternion.set(d.rotation.x, d.rotation.y, d.rotation.z, d.rotation.w);
  sock.scaling.set(1, 1, 1);
  applyStaffPalm(asset.staff?.root);
}

/** Public-API assembly proof. No garment owns an animation controller. */
export async function createFixtureCharacter(options) {
  const { engine, scene, source, x = 0, palette = "indigo" } = options;
  const sourceBind = await inspectBindContract(source);
  const composer = createFixtureComposer(source);
  enableBoneControl();
  let current;
  let disposed = false;
  let revision = 0;
  let queue = Promise.resolve();
  let clip = options.clip || "Idle_Loop";
  let paused = false;
  let morph = 0;
  let yaw = options.yaw ?? Math.PI;
  let outfit = options.outfit || "full";
  let visible = true;
  const events = [];
  let retiredCount = 0;
  let retiredMeshesStillInScene = 0;
  const pointA = { x: 0, y: 0, z: 0 };
  const pointB = { x: 0, y: 0, z: 0 };

  function pose(asset, name, time = 0) {
    const group = asset.groups.find((g) => g.name === name);
    if (!group) {
      throw new Error(`Missing animation: ${name}`);
    }
    for (const g of asset.groups) {
      stopAnimation(g);
      setAnimationWeight(g, 0);
    }
    group.loopAnimation = true;
    group.currentTime = time;
    setAnimationWeight(group, 1);
    playAnimation(group);
    asset.active = group;
    updateAnimationManager(asset.manager, 0);
    asset.sockets?.sync?.();
    syncStaffLight(asset.staff);
  }

  function shape(asset) {
    for (const mesh of asset.meshes) {
      if (mesh.morphTargets) {
        setMorphTargetWeights(engine, mesh.morphTargets, [morph]);
      }
    }
  }

  function retire(asset) {
    for (const group of asset.groups) {
      stopAnimation(group);
    }
    if (asset.staff) {
      showStaff(asset.staff, false);
      if (asset.staff.light) {
        removeFromScene(scene, asset.staff.light);
      }
      for (const extra of [asset.staff.crystal, asset.staff.ferrule]) {
        if (extra) {
          setParent(extra, null);
          removeFromScene(scene, extra);
        }
      }
      setParent(asset.staff.root, null);
      removeFromScene(scene, asset.staff.container);
    }
    removeFromScene(scene, asset.container);
    retiredCount += asset.meshes.length;
    retiredMeshesStillInScene += asset.meshes.filter((m) => scene.meshes.includes(m)).length;
  }

  async function assemble(next) {
    const start = performance.now();
    const composed = await composer.compose({ outfit: next, palette });
    assertCompatibleBind(sourceBind, composed.bind);
    const container = await loadGltf(engine, composed.buffer);
    const root = container.entities[0];
    const meshes = getContainerMeshes(container);
    const groups = container.animationGroups || [];
    const manager = createAnimationManager({ engine });
    addAnimationGroups(manager, groups);
    enableAnimationBlending(manager);
    for (const mesh of meshes) {
      mesh.receiveShadows = true;
      setFixtureVisible(mesh, false);
    }
    addToScene(scene, container);
    applyMixamoRootScale(root);
    root.position.x = x;
    if (root.rotation) {
      root.rotation.y = yaw;
    }
    const parsed = parseGlb(composed.buffer);
    const ibm = readAccessor(parsed.json, parsed.binary, parsed.json.skins[0].inverseBindMatrices);
    const skeleton = container.skeletons?.[0] || meshes.find((m) => m.skeleton)?.skeleton;
    const asset = {
      container,
      root,
      meshes,
      groups,
      manager,
      manifest: composed.manifest,
      ibm,
      active: null,
    };
    const handNode = createTransformNode("Fixture_mainHandSocket");
    setParent(handNode, root);
    asset.sockets = {
      sockets: { mainHand: { node: handNode, bone: getBoneByName(skeleton, "mixamorig:RightHand") } },
      sync: () => syncStaffFromPalette(asset),
    };
    try {
      asset.staff = await attachStaff(engine, scene, asset.sockets);
      showStaff(asset.staff, false);
      pose(asset, clip, current?.active?.currentTime || 0);
      shape(asset);
      await refreshScene(scene);
    } catch (error) {
      retire(asset);
      throw error;
    }
    asset.assemblyMs = performance.now() - start;
    return asset;
  }

  const api = {
    update(deltaSeconds) {
      if (!current || disposed) {
        return;
      }
      if (!paused) {
        updateAnimationManager(current.manager, Math.min(deltaSeconds, 0.05) * 1000);
      }
      current.sockets?.sync?.();
      syncStaffLight(current.staff);
    },
    setPose(name, time = 0, freeze = false) {
      pose(current, name, time);
      clip = name;
      paused = freeze;
    },
    setPaused(value) {
      paused = !!value;
    },
    setShape(value) {
      if (!Number.isFinite(value) || value < -1 || value > 1) {
        throw new Error("Fixture fullness must be between -1 and 1");
      }
      morph = value;
      shape(current);
    },
    setYaw(value) {
      yaw = value;
      current.root.rotation.y = value;
    },
    setVisible(value) {
      visible = !!value;
      for (const mesh of current.meshes) {
        setFixtureVisible(mesh, value);
      }
      showStaff(current.staff, value);
    },
    setOutfit(next) {
      const ticket = ++revision;
      const operation = queue.catch(() => {}).then(async () => {
        if (disposed || ticket !== revision) {
          return { stale: true };
        }
        const staged = await assemble(next);
        if (disposed || ticket !== revision) {
          retire(staged);
          await refreshScene(scene);
          return { stale: true };
        }
        pose(staged, clip, current?.active?.currentTime || 0);
        shape(staged);
        const old = current;
        for (const mesh of old.meshes) {
          setFixtureVisible(mesh, false);
        }
        showStaff(old.staff, false);
        for (const mesh of staged.meshes) {
          setFixtureVisible(mesh, visible);
        }
        showStaff(staged.staff, visible);
        staged.root.rotation.y = yaw;
        current = staged;
        outfit = next;
        retire(old);
        await refreshScene(scene);
        const result = { outfit, assemblyMs: staged.assemblyMs, meshes: staged.meshes.length };
        events.push(result);
        if (events.length > 20) events.shift();
        return result;
      });
      queue = operation;
      return operation;
    },
    diagnostics() {
      const body = current.meshes.find((m) => m.name === "Alpha_Surface");
      const garments = current.meshes.filter((m) => m.name.startsWith("Fixture_"));
      let maxShellGap = 0;
      let paletteError = 0;
      let probes = 0;
      for (const mesh of garments) {
        const id = mesh.name.replace("Fixture_", "");
        for (const { bodyVertex, garmentVertex } of current.manifest.probes[id] ?? []) {
          if (!computeDeformedPositionToRef(body, bodyVertex, pointA) || !computeDeformedPositionToRef(mesh, garmentVertex, pointB)) {
            throw new Error("Missing deformation probe");
          }
          // CPU deformation returns mesh-local points. Compare in runtime meters.
          for (const [point, wm] of [[pointA, body.worldMatrix], [pointB, mesh.worldMatrix]]) {
            const { x, y, z } = point;
            point.x = wm[0] * x + wm[4] * y + wm[8] * z + wm[12];
            point.y = wm[1] * x + wm[5] * y + wm[9] * z + wm[13];
            point.z = wm[2] * x + wm[6] * y + wm[10] * z + wm[14];
          }
          maxShellGap = Math.max(
            maxShellGap,
            Math.hypot(pointA.x - pointB.x, pointA.y - pointB.y, pointA.z - pointB.z),
          );
          probes++;
        }
        const a = body.skeleton?.boneMatrices;
        const b = mesh.skeleton?.boneMatrices;
        if (!a || !b || a.length !== b.length) throw new Error('Incompatible skin palette');
        if (a && b) {
          const n = a.length;
          for (let i = 0; i < n; i++) {
            paletteError = Math.max(paletteError, Math.abs(a[i] - b[i]));
          }
        }
      }
      const skeletons = new Set(current.meshes.filter((m) => m.skeleton).map((m) => m.skeleton));
      const hand = current.sockets?.sockets?.mainHand;
      return {
        outfit,
        clip,
        time: current.active?.currentTime ?? 0,
        paused,
        fullness: morph,
        assemblyMs: current.assemblyMs,
        meshes: current.meshes.length,
        staffMeshes: current.staff?.meshes.length ?? 0,
        staffSocket: hand?.bone?.name ?? null,
        skinBindings: current.meshes.filter((m) => m.skeleton).length,
        uniqueSkeletons: skeletons.size,
        animationManagers: current.manager ? 1 : 0,
        joints: current.manifest.jointNames.length,
        bindSignature: sourceBind.signature,
        maxShellGap,
        paletteError,
        probes,
        retiredMeshesStillInScene,
        retiredMeshCount: retiredCount,
        swaps: events.slice(),
        diagnosticOnly: true,
      };
    },
    getMeshes() {
      return [...current.meshes, ...(current.staff?.meshes ?? [])];
    },
    getGroupNames() {
      return current.groups.map((g) => g.name);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      composer.dispose();
      revision++;
      if (current) {
        retire(current);
      }
    },
  };

  try { current = await assemble(outfit); }
  catch (error) { composer.dispose(); throw error; }
  for (const mesh of current.meshes) {
    setFixtureVisible(mesh, true);
  }
  showStaff(current.staff, true);
  return api;
}
