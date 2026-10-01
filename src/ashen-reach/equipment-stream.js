import {prepareLinearMaterial} from './linear-materials.js';
import {
  addToScene,
  getContainerMeshes,
  loadGltf,
  removeFromScene,
  setMeshVisible,
  setParent,
} from "@babylonjs/lite";
import { createArmingSword } from "./arming-sword.js";
import {
  BASE_VISIBLE_MESHES,
  BODY_REGIONS,
  EQUIPMENT_ITEMS,
  EQUIPMENT_PRESETS,
  gripHold,
  resolveEquipmentVisibility,
  validateLoadout,
} from "./equipment-catalog.js";
import {
  HUMAN_EQUIPMENT_FIT,
  assertAssetFit,
  raceForFit,
  resolveHandEquip,
} from "./equipment-contract.js";
import { RACE_BODY_SEGMENTS, resolveCoverage } from "./coverage-contract.js";
import {validateGarmentLayerCoverage,resolveGarmentLayerVisibility} from './garment-layer-coverage.js';
import { installEquipmentGrips, spellStowsWeapon } from "./equipment-grips.js";
import { createEquipmentLoader } from "./equipment-loader.js";
import { createMageProp } from "./mage-props.js";
import {
  advancePropTransition,
  beginPropTransition,
} from "./prop-transition.js";

/**
 * Keep the existing part/hideWhenSlots resolver, but derive streamed body visibility from
 * the semantic adapter. A glTF mesh can only be hidden as a whole, so a fused Human head
 * remains visible when a hood covers its scalp. See docs/plans/character-mmo/m007-mixed-equipment.md
 * and https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#meshes.
 */
function packVisibility(selected, race, provisionalUndead, bodySegments, garmentLayerCoverage) {
  const vis = resolveEquipmentVisibility(selected);
  // The older diagnostic Undead pack uses six physical body geosets and is still exercised
  // by its compatibility tests. It is not the active single-body-mesh Undead pack. Keep its
  // authored region masks until that provisional asset is retired; see
  // docs/CURRENT.md#current-character-boundary-and-unresolved-risks.
  if (provisionalUndead) return vis;
  const hidden = new Set(resolveCoverage(selected, EQUIPMENT_ITEMS, race, bodySegments).hiddenMeshes);
  for (const name of Object.keys(bodySegments)) vis[name] = !hidden.has(name);
  if(garmentLayerCoverage)Object.assign(vis,resolveGarmentLayerVisibility(selected,EQUIPMENT_ITEMS,garmentLayerCoverage));
  return vis;
}

export async function createStreamedEquipment(
  engine,
  scene,
  body,
  sockets,
  options = {},
) {
  const manifestUrl =
    options.manifestUrl || "/ashen-reach/equipment/manifest.json";
  const baseMeshes = options.baseMeshes || BASE_VISIBLE_MESHES;
  const expectedFit = options.fitId || HUMAN_EQUIPMENT_FIT;
  const bootLoadout = options.bootLoadout || {
    torso: "wayfarerTunic",
    legs: "wayfarerTrousers",
    boots: "wayfarerBoots",
    mainHand: "ironSword",
  };
  // Explicit race selection. The pack names the race it is; the fit must agree. Nothing here
  // infers "human" from "not orc", so a third race cannot arrive wearing Human assumptions.
  const race = options.race ?? raceForFit(expectedFit);
  if (raceForFit(expectedFit) !== race)
    throw Error(
      `Pack declares race ${race} but carries the ${expectedFit.body} fit`,
    );
  // A head style may add a separately hideable mesh to the same body and rig.
  // Keep the default race adapter exact, while requiring an explicit semantic
  // adapter for each variant mesh. A hood can then hide a ponytail without
  // hiding the Human's fused head/face.
  const bodySegments = options.bodySegments || RACE_BODY_SEGMENTS[race];
  const garmentLayerCoverage=options.garmentLayerCoverage?validateGarmentLayerCoverage(options.garmentLayerCoverage,EQUIPMENT_ITEMS,baseMeshes):null;
  // Reuse the validated startup manifest. A no-cache HTTP manifest otherwise
  // incurs another conditional request on the input-critical path.
  let manifest=options.manifest;
  if(!manifest){
    const response=await fetch(manifestUrl);
    if(!response.ok)throw Error(`No ${race} equipment manifest at ${manifestUrl}`);
    try{manifest=await response.json();}
    catch{throw Error(`The ${race} equipment manifest at ${manifestUrl} is not valid JSON`);}
  }
  // A pack that declares its fit must be the pack we asked for: this catches a packs-table
  // entry left pointing at another race's directory, which would otherwise load and look fine.
  if (manifest.fitId !== expectedFit.body)
    throw Error(
      `Equipment pack is ${manifest.fitId || "unlabelled"}, not ${expectedFit.body}`,
    );
  const base = getContainerMeshes(body.container),
    donor = base.find((m) => m.skeleton);
  if (!donor || donor.skeleton.boneCount !== 65)
    throw Error("Unsupported equipment rig");
  const entries = new Map();
  let visible = options.visible !== false,
    stopped = false;
  const bindings = Object.fromEntries(
    baseMeshes.map((name) => [name, base.filter((m) => m.name === name)]),
  );
  const uncovered = Object.entries(bindings)
    .filter(([, meshes]) => !meshes.length)
    .map(([name]) => name);
  if (uncovered.length)
    throw Error(`Missing ${race} body coverage: ${uncovered.join(", ")}`);
  const provisionalUndead = race === "undead" && manifest.provisional === true &&
    baseMeshes.length === BODY_REGIONS.length && BODY_REGIONS.every((name) => baseMeshes.includes(name));
  if(provisionalUndead&&garmentLayerCoverage)throw Error('Provisional pack has no garment layer adapter');
  const described = Object.keys(bodySegments || {});
  const missingAdapter = baseMeshes.filter((name) => !described.includes(name));
  const missingBase = described.filter((name) => !baseMeshes.includes(name));
  if (!provisionalUndead && (missingAdapter.length || missingBase.length))
    throw Error(`The ${race} semantic body adapter disagrees with its pack: ` +
      `missing adapter ${missingAdapter.join(", ") || "none"}; ` +
      `missing base mesh ${missingBase.join(", ") || "none"}`);
  const initial = {
    helmet: null,
    torso: null,
    legs: null,
    boots: null,
    gloves: null,
    mainHand: null,
    offHand: null,
  };
  function setAttachment(entry, stow) {
    const item = entry.item;
    if (!item.factory) return;
    const where = stow ? "back" : "hand";
    if (entry.attachment === where) return;
    const hold = gripHold(item, race);
    const target = stow
      ? item.stow
      : { position: hold.position, rotation: hold.rotation };
    const first = entry.attachment === null;
    setParent(entry.root, sockets.sockets[stow ? "back" : item.slot].node);
    const q = entry.root.rotationQuaternion,
      from = {
        position: [
          entry.root.position.x,
          entry.root.position.y,
          entry.root.position.z,
        ],
        rotation: [q.x, q.y, q.z, q.w],
      };
    entry.attachment = where;
    entry.root.scaling.set(hold.scale, hold.scale, hold.scale);
    if (first) {
      entry.root.position.set(...target.position);
      entry.root.rotationQuaternion.set(...target.rotation);
      entry.transition = null;
    } else beginPropTransition(entry, from.position, from.rotation, target);
  }
  async function prepare(id, requestSignal) {
    const signal = AbortSignal.any([requestSignal, AbortSignal.timeout(15000)]);
    signal.throwIfAborted();
    const item = EQUIPMENT_ITEMS[id];
    let textureEntries = [];
    let root,
      container,
      meshes,
      owned = [];
    try {
      if (item.factory) {
        const prop =
          item.factory === "sword"
            ? createArmingSword(
                engine,
                scene,
                sockets.sockets[item.slot].node,
                item.gripRotation,
              )
            : createMageProp(engine, scene, item.factory);
        ({ root, meshes } = prop);
      } else {
        const asset = manifest.items[id];
        textureEntries = asset?.textures || [];
        if (options.shapeFamily && asset?.shapeFamily !== options.shapeFamily)
          throw Error(`The ${race} ${item.name} has no compatible ${options.shapeFamily} deformation`);
        // An item this pack does not carry is an unsupported combination, not a cue to
        // reach for the Human asset. Say which race is missing it.
        if (!asset) throw Error(`No ${race} fit for ${item.name}`);
        if (asset.bytes > 16 * 1024 * 1024)
          throw Error("Equipment asset exceeds supported size");
        // Throws unless the manifest entry's fit is the one this item declares for this
        // race. No Human default: see declaredFitForRace in equipment-contract.js.
        assertAssetFit(asset, item, race);
        const response = options.loadBuffer?null:await fetch(asset.url, { signal });
        if (response&&!response.ok)
          throw Error(
            `Could not load the ${race} ${item.name} from ${asset.url}`,
          );
        const bytes = options.loadBuffer?await options.loadBuffer(asset):await response.arrayBuffer();
        if (bytes.byteLength !== asset.bytes)
          throw Error(
            `The ${race} ${item.name} is ${bytes.byteLength} bytes, not the ${asset.bytes} its manifest declares`,
          );
        const verify =
          import.meta.env?.DEV !== false ||
          new URLSearchParams(globalThis.location?.search || "").has(
            "verifyAssets",
          );
        if (verify) {
          const digest = Array.from(
            new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
            (n) => n.toString(16).padStart(2, "0"),
          ).join("");
          if (digest !== asset.sha256)
            throw Error(
              `The ${race} ${item.name} at ${asset.url} does not match its manifest hash`,
            );
        }
        signal.throwIfAborted();
        container = await loadGltf(engine, bytes);
        root = container.entities[0];
        meshes = getContainerMeshes(container);
        signal.throwIfAborted();
        for (const part of item.parts)
          if (!meshes.some((m) => m.name === part.mesh))
            throw Error("Missing garment part: " + part.mesh);
        for(const part of garmentLayerCoverage?.partsByItem[id]||[])
          if(!meshes.some(m=>m.name===part.mesh))throw Error('Missing garment coverage part: '+part.mesh);
        for (const mesh of meshes) {
          if (!mesh.skeleton || mesh.skeleton.boneCount !== 65)
            throw Error("Garment skin mismatch");
          // Pack builders prove identical joint order, inverse binds and identity mesh
          // frame before this palette is borrowed. Names and bone count alone cannot
          // establish glTF skin compatibility:
          // https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#skins
          // Borrow only the live palette, retaining this mesh's own vertex skin buffers.
          // Restore its owned skeleton BEFORE disposal so the actor palette is never freed.
          owned.push([mesh, mesh.skeleton]);
          mesh.skeleton = {
            ...mesh.skeleton,
            boneTexture: donor.skeleton.boneTexture,
            boneMatrices: donor.skeleton.boneMatrices,
          };
          mesh.receiveShadows = true;
        }
        // Stage with this actor's committed weights before the visibility commit.
        // A post-commit writer would expose one neutral garment frame.
        // https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#morph-targets
        if (options.getShapeWeights && meshes.some(mesh => mesh.morphTargets)) {
          const {setMorphTargetWeights} = await import('@babylonjs/lite');
          for (const mesh of meshes) if (mesh.morphTargets)
            setMorphTargetWeights(engine, mesh.morphTargets, options.getShapeWeights());
        }
        setParent(root, body.root);
        root.position.set(0, 0, 0);
        root.rotationQuaternion.set(0, 0, 0, 1);
        root.scaling.set(1, 1, 1);
        setMeshVisible(root, false);
        for (const mesh of meshes) setMeshVisible(mesh, false);
        for (const mesh of meshes) prepareLinearMaterial(scene, mesh.material);
        addToScene(scene, container);
      }
      setMeshVisible(root, false);
      let dead = false, textureUpgrade = null;
      const entry = {
        item,
        root,
        meshes,
        attachment: null,
        async upgradeTextures(shouldAbort = () => false) {
          if (dead || shouldAbort() || !container || !textureEntries.length) return;
          const {upgradeStarterCharacter} = await import('./startup-assets.js');
          textureUpgrade ||= upgradeStarterCharacter(engine, scene, container, {startup:{textures:textureEntries}}, () => dead || shouldAbort()).then(completed => {if(!completed)textureUpgrade = null;return completed;}).catch(error => {textureUpgrade = null; throw error;});
          await textureUpgrade;
        },
        releasePalette() {
          if(dead)return ()=>{};
          const borrowed=owned.map(([mesh])=>[mesh,mesh.skeleton]);
          for(const [mesh,skeleton]of owned)mesh.skeleton=skeleton;
          return ()=>{if(!dead)for(const [mesh,skeleton]of borrowed)mesh.skeleton=skeleton;};
        },
        dispose() {
          if (dead) return;
          dead = true;
          for (const [mesh, skeleton] of owned) mesh.skeleton = skeleton;
          // removeFromScene nulls parent without splicing `children`. A later
          // socket rebind would follow that frozen garment and leave weapons behind.
          if (root?.parent) setParent(root, null);
          removeFromScene(scene, container || root);
          entries.delete(id);
        },
      };
      if (stopped) {
        entry.dispose();
        throw Error("Equipment disposed");
      }
      entries.set(id, entry);
      return entry;
    } catch (error) {
      for (const [mesh, skeleton] of owned) mesh.skeleton = skeleton;
      if (root?.parent) setParent(root, null);
      if (root) removeFromScene(scene, container || root);
      throw error;
    }
  }
  function apply(next) {
    const mask = packVisibility(next, race, provisionalUndead, bodySegments, garmentLayerCoverage);
    for (const [name, meshes] of Object.entries(bindings))
      for (const mesh of meshes) setMeshVisible(mesh, visible && mask[name]);
    const casting = spellStowsWeapon(body);
    sockets.sync([
      sockets.sockets.mainHand,
      sockets.sockets.offHand,
      sockets.sockets.back,
    ]);
    for (const entry of entries.values()) {
      const equipped = next[entry.item.slot] === entry.item.id;
      if (equipped) setAttachment(entry, casting);
      setMeshVisible(entry.root, visible && equipped);
      if (equipped && entry.item.parts)
        for (const mesh of entry.meshes)
          setMeshVisible(mesh, visible && !!mask[mesh.name]);
    }
  }
  const loader = createEquipmentLoader({
    initial,
    validate: validateLoadout,
    prepare,
    commit(next) {
      try {
        apply(next);
      } catch (error) {
        apply(loader.getState());
        throw error;
      }
    },
    maxIdle: 2,
  });
  const equipment = {
    items: EQUIPMENT_ITEMS,
    presets: EQUIPMENT_PRESETS,
    setLoadout: (patch) =>
      loader.request(
        resolveHandEquip(loader.getState(), patch, EQUIPMENT_ITEMS),
      ),
    equip: (slot, id) =>
      loader.request(
        resolveHandEquip(loader.getState(), { [slot]: id }, EQUIPMENT_ITEMS),
      ),
    equipPreset(id) {
      if (!Object.hasOwn(EQUIPMENT_PRESETS, id))
        return Promise.resolve({ status: "failed", error: "Unknown outfit" });
      return loader.request(EQUIPMENT_PRESETS[id].loadout);
    },
    getState: loader.getState,
    getStatus: loader.getStatus,
    releasePalettes() {
      const restore=[...entries.values()].map(entry=>entry.releasePalette());
      return ()=>restore.forEach(fn=>fn());
    },
    async upgradeTextures(shouldAbort = () => false) {
      for (const entry of entries.values()) {
        if(shouldAbort())return;
        await entry.upgradeTextures(shouldAbort);
      }
    },
    setVisible(value) {
      visible = value;
      apply(loader.getState());
    },
    update(dt = 0) {
      const selected = loader.getState();
      const casting = spellStowsWeapon(body);
      if (!visible) return;
      sockets.sync([
        sockets.sockets.mainHand,
        sockets.sockets.offHand,
        sockets.sockets.back,
      ]);
      for (const entry of entries.values())
        if (selected[entry.item.slot] === entry.item.id)
          setAttachment(entry, casting);
      for (const entry of entries.values())
        if (selected[entry.item.slot] === entry.item.id)
          advancePropTransition(entry, dt);
    },
    get attachment() {
      return entries.get(loader.getState().mainHand)?.attachment || "hand";
    },
    dispose() {
      stopped = true;
      loader.dispose();
    },
  };
  installEquipmentGrips(body, loader.getState);
  const boot = await equipment.setLoadout(bootLoadout);
  if (boot.status !== "applied") {
    equipment.dispose();
    throw Error(boot.error || "Equipment boot failed");
  }
  return equipment;
}
