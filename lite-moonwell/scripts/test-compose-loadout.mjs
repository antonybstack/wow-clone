import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';


import { inspectBindContract } from '../src/character/runtime/bind-contract.js';
import { composeLoadout, LOADOUT_SLOTS } from '../src/character/runtime/compose-loadout.js';
import { composeStarterOutfit, STARTER_PROFILES } from '../src/character/runtime/compose-starter-outfit.js';
import { dominantJoint } from '../src/character/runtime/compose-fixture.js';
import { FIT_CODES, fileSha256, sourceGeometrySignature } from '../src/character/runtime/fit-contract.js';
import {
  PLAYABLE_FIT_PROFILES,
  STARTER_ITEM_IDS,
  parseFitManifest,
} from '../src/character/runtime/garment-catalog.js';
import { glbWriter, parseGlb, readAccessor } from '../src/character/runtime/glb.js';

const BODIES = {
  'human-v1': 'public/characters/bodies/human-animated-v1.glb',
  'orc-v1': 'public/characters/bodies/orc-animated-v1.glb',
  'undead-v1': 'public/characters/bodies/undead-animated-v1.glb',
};
const COMBOS = [
  {},
  { chest: 'starterShirt' },
  { legs: 'starterTrousers' },
  { feet: 'starterBoots' },
  { chest: 'starterShirt', legs: 'starterTrousers' },
  { chest: 'starterShirt', feet: 'starterBoots' },
  { legs: 'starterTrousers', feet: 'starterBoots' },
  { chest: 'starterShirt', legs: 'starterTrousers', feet: 'starterBoots' },
];

async function loadBuf(rel) {
  const file = await readFile(new URL(`../${rel}`, import.meta.url));
  return file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength);
}

function parented(json, name) {
  const idx = json.nodes.findIndex((n) => n.name === name);
  return idx >= 0 && json.nodes.some((n) => n.children?.includes(idx));
}

function rewriteGlb(buffer, mutate) {
  const copy = buffer.slice(0);
  const { json, binary } = parseGlb(copy);
  mutate(json, binary);
  return glbWriter(json, binary).finish();
}

function accEq(jsonA, binA, ia, jsonB, binB, ib) {
  const a = jsonA.accessors[ia];
  const b = jsonB.accessors[ib];
  assert.equal(a.componentType, b.componentType);
  assert.equal(a.type, b.type);
  assert.equal(a.count, b.count);
  assert.equal(!!a.normalized, !!b.normalized);
  assert.deepEqual(Array.from(readAccessor(jsonA, binA, ia)), Array.from(readAccessor(jsonB, binB, ib)));
}

const catalog = parseFitManifest(JSON.parse(await readFile(new URL('../public/characters/garments/starter-fits.v1.json', import.meta.url))));
const bodies = {};
const fits = {};
for (const profileId of PLAYABLE_FIT_PROFILES) {
  bodies[profileId] = await loadBuf(BODIES[profileId]);
  fits[profileId] = {};
  for (const itemId of STARTER_ITEM_IDS) {
    const file = catalog.items[itemId].variants[profileId].file;
    fits[profileId][itemId] = await loadBuf(`public/characters/garments/${file}`);
  }
}

function coverageUnion(profileId, loadout) {
  const set = new Set();
  for (const slot of LOADOUT_SLOTS) {
    const itemId = loadout[slot];
    if (!itemId) continue;
    const { json } = parseGlb(fits[profileId][itemId]);
    for (const off of json.asset.extras.fit.coverage.triangleOffsets) set.add(off);
  }
  return set;
}

function remainingFrom(srcIndices, covered) {
  const out = [];
  for (let i = 0; i < srcIndices.length; i += 3) {
    if (!covered.has(i)) out.push(srcIndices[i], srcIndices[i + 1], srcIndices[i + 2]);
  }
  return out;
}

test('eight loadouts × three profiles: coverage union, shorts, source immutable', { timeout: 180000 }, async () => {
  for (const profileId of PLAYABLE_FIT_PROFILES) {
    const src = bodies[profileId];
    const srcHash = await fileSha256(src);
    const srcParsed = parseGlb(src);
    const bodyName = STARTER_PROFILES[profileId].bodyMesh;
    const shorts = STARTER_PROFILES[profileId].shortsNode;
    const bodyNode = srcParsed.json.nodes.find((n) => n.name === bodyName);
    const srcIdx = readAccessor(srcParsed.json, srcParsed.binary, srcParsed.json.meshes[bodyNode.mesh].primitives[0].indices);
    const srcJoints = srcParsed.json.skins[0].joints;
    const srcAnims = (srcParsed.json.animations || []).map((a) => ({ name: a.name, channels: a.channels.length, samplers: a.samplers.length }));

    for (const loadout of COMBOS) {
      const before = new Uint8Array(src).slice();
      const { buffer, manifest } = await composeLoadout(src, fits[profileId], { profileId, manifest: catalog, loadout });
      assert.deepEqual(new Uint8Array(src), before);
      assert.equal(await fileSha256(src), srcHash);
      const out = parseGlb(buffer);
      const outBody = out.json.nodes.find((n) => n.name === bodyName);
      const outIdx = readAccessor(out.json, out.binary, out.json.meshes[outBody.mesh].primitives[0].indices);
      const covered = coverageUnion(profileId, loadout);
      assert.deepEqual(Array.from(outIdx), remainingFrom(srcIdx, covered));
      assert.equal(manifest.coveredCount, covered.size);
      assert.deepEqual(out.json.skins[0].joints, srcJoints);
      assert.deepEqual(
        (out.json.animations || []).map((a) => ({ name: a.name, channels: a.channels.length, samplers: a.samplers.length })),
        srcAnims,
      );
      const expectShorts = !loadout.legs;
      assert.equal(parented(out.json, shorts), expectShorts, `${profileId} ${JSON.stringify(loadout)} shorts`);
      assert.equal(manifest.shortsHidden, !expectShorts);
      const added = Object.values(loadout).filter(Boolean).length;
      assert.equal(out.json.nodes.length, srcParsed.json.nodes.length + added);
      assert.equal(out.json.skins.length, 1);
      for (const itemId of Object.values(loadout).filter(Boolean)) {
        const node = out.json.nodes.find((n) => n.name === `Fit_${itemId}`);
        assert.ok(node, itemId);
        assert.equal(node.skin, outBody.skin);
        const mesh = out.json.meshes[node.mesh];
        for (const prim of mesh.primitives) {
          const pos = out.json.accessors[prim.attributes.POSITION];
          assert.ok(pos.min && pos.max);
          const weights = readAccessor(out.json, out.binary, prim.attributes.WEIGHTS_0);
          for (let i = 0; i < weights.length; i += 4) {
            assert.ok(Math.abs(weights[i] + weights[i + 1] + weights[i + 2] + weights[i + 3] - 1) < 0.002);
            assert.ok([0, 1, 2, 3].every((k) => Number.isFinite(weights[i + k])));
          }
        }
      }
    }
  }
});

test('removing torso restores shirt coverage only; overlap stays hidden by legs/feet', { timeout: 120000 }, async () => {
  for (const profileId of PLAYABLE_FIT_PROFILES) {
    const src = bodies[profileId];
    const full = await composeLoadout(src, fits[profileId], {
      profileId,
      manifest: catalog,
      loadout: { chest: 'starterShirt', legs: 'starterTrousers', feet: 'starterBoots' },
    });
    const noChest = await composeLoadout(src, fits[profileId], {
      profileId,
      manifest: catalog,
      loadout: { legs: 'starterTrousers', feet: 'starterBoots' },
    });
    const bodyName = STARTER_PROFILES[profileId].bodyMesh;
    const srcParsed = parseGlb(src);
    const bodyNode = srcParsed.json.nodes.find((n) => n.name === bodyName);
    const srcIdx = readAccessor(srcParsed.json, srcParsed.binary, srcParsed.json.meshes[bodyNode.mesh].primitives[0].indices);
    const legsFeet = parseGlb(noChest.buffer);
    const fullParsed = parseGlb(full.buffer);
    const outBody = legsFeet.json.nodes.find((n) => n.name === bodyName);
    const outIdx = readAccessor(legsFeet.json, legsFeet.binary, legsFeet.json.meshes[outBody.mesh].primitives[0].indices);
    const expected = remainingFrom(srcIdx, coverageUnion(profileId, { legs: 'starterTrousers', feet: 'starterBoots' }));
    assert.deepEqual(Array.from(outIdx), expected);
    const shirtOff = new Set(parseGlb(fits[profileId].starterShirt).json.asset.extras.fit.coverage.triangleOffsets);
    const restOff = coverageUnion(profileId, { legs: 'starterTrousers', feet: 'starterBoots' });
    const overlap = [...shirtOff].filter((o) => restOff.has(o));
    assert.ok(overlap.length > 0, `${profileId} expected shirt/leg overlap`);
    const remainingSet = new Set();
    for (let i = 0; i < outIdx.length; i += 3) remainingSet.add(`${outIdx[i]},${outIdx[i + 1]},${outIdx[i + 2]}`);
    for (const off of overlap) {
      const key = `${srcIdx[off]},${srcIdx[off + 1]},${srcIdx[off + 2]}`;
      assert.equal(remainingSet.has(key), false);
    }
    assert.equal(fullParsed.json.nodes.some((n) => n.name === 'Fit_starterShirt'), true);
    assert.equal(legsFeet.json.nodes.some((n) => n.name === 'Fit_starterShirt'), false);
  }
});

test('full loadout garment geometry matches composeStarterOutfit; head/hands remain', { timeout: 120000 }, async () => {
  const nameMap = { shirt: 'Fit_starterShirt', trousers: 'Fit_starterTrousers', boots: 'Fit_starterBoots' };
  for (const profileId of PLAYABLE_FIT_PROFILES) {
    const src = bodies[profileId];
    const composed = composeStarterOutfit(src, { profile: profileId, outfit: 'starter' });
    const loadout = await composeLoadout(src, fits[profileId], {
      profileId,
      manifest: catalog,
      loadout: { chest: 'starterShirt', legs: 'starterTrousers', feet: 'starterBoots' },
    });
    const a = parseGlb(composed.buffer);
    const b = parseGlb(loadout.buffer);
    const bodyName = STARTER_PROFILES[profileId].bodyMesh;
    const aBody = a.json.nodes.find((n) => n.name === bodyName);
    const bBody = b.json.nodes.find((n) => n.name === bodyName);
    assert.deepEqual(
      Array.from(readAccessor(a.json, a.binary, a.json.meshes[aBody.mesh].primitives[0].indices)),
      Array.from(readAccessor(b.json, b.binary, b.json.meshes[bBody.mesh].primitives[0].indices)),
    );
    assert.equal(aBody.skin, bBody.skin);
    assert.deepEqual(a.json.skins[aBody.skin].joints, b.json.skins[bBody.skin].joints);
    accEq(a.json, a.binary, a.json.skins[aBody.skin].inverseBindMatrices, b.json, b.binary, b.json.skins[bBody.skin].inverseBindMatrices);
    for (const [legacy, fitName] of Object.entries(nameMap)) {
      const aNode = a.json.nodes.find((n) => n.name === `Starter${legacy[0].toUpperCase()}${legacy.slice(1)}`);
      const bNode = b.json.nodes.find((n) => n.name === fitName);
      assert.equal(bNode.skin, bBody.skin);
      const aMesh = a.json.meshes[aNode.mesh];
      const bMesh = b.json.meshes[bNode.mesh];
      assert.equal(aMesh.primitives.length, bMesh.primitives.length);
      accEq(a.json, a.binary, aMesh.primitives[0].attributes.POSITION, b.json, b.binary, bMesh.primitives[0].attributes.POSITION);
      accEq(a.json, a.binary, aMesh.primitives[0].attributes.NORMAL, b.json, b.binary, bMesh.primitives[0].attributes.NORMAL);
      accEq(a.json, a.binary, aMesh.primitives[0].attributes.TEXCOORD_0, b.json, b.binary, bMesh.primitives[0].attributes.TEXCOORD_0);
      accEq(a.json, a.binary, aMesh.primitives[0].attributes.JOINTS_0, b.json, b.binary, bMesh.primitives[0].attributes.JOINTS_0);
      accEq(a.json, a.binary, aMesh.primitives[0].attributes.WEIGHTS_0, b.json, b.binary, bMesh.primitives[0].attributes.WEIGHTS_0);
      for (let p = 0; p < aMesh.primitives.length; p++) {
        accEq(a.json, a.binary, aMesh.primitives[p].indices, b.json, b.binary, bMesh.primitives[p].indices);
        assert.deepEqual(
          a.json.materials[aMesh.primitives[p].material].pbrMetallicRoughness,
          b.json.materials[bMesh.primitives[p].material].pbrMetallicRoughness,
        );
      }
    }
    const srcParsed = parseGlb(src);
    const srcBody = srcParsed.json.nodes.find((n) => n.name === bodyName);
    const srcPrim = srcParsed.json.meshes[srcBody.mesh].primitives[0];
    const srcJoints = readAccessor(srcParsed.json, srcParsed.binary, srcPrim.attributes.JOINTS_0);
    const srcWeights = readAccessor(srcParsed.json, srcParsed.binary, srcPrim.attributes.WEIGHTS_0);
    const outIdx = readAccessor(b.json, b.binary, b.json.meshes[bBody.mesh].primitives[0].indices);
    const jointNames = srcParsed.json.skins[0].joints.map((i) => srcParsed.json.nodes[i].name);
    const headJi = jointNames.indexOf('Head');
    const handJi = jointNames.indexOf('LeftHand');
    let headHits = 0;
    let handHits = 0;
    for (let i = 0; i < outIdx.length; i++) {
      const best = dominantJoint(srcJoints, srcWeights, outIdx[i]);
      if (best === headJi) headHits++;
      if (best === handJi) handHits++;
    }
    assert.ok(headHits > 10, `${profileId} head ${headHits}`);
    assert.ok(handHits > 10, `${profileId} hand ${handHits}`);
  }
});

test('fail closed: orc fit, permuted geometry, bad coverage, slot, asset hash; source untouched', { timeout: 120000 }, async () => {
  const human = bodies['human-v1'];
  const before = new Uint8Array(human).slice();
  const expectUntouched = async (fn, code) => {
    await assert.rejects(fn, (err) => err.code === code);
    assert.deepEqual(new Uint8Array(human), before);
  };

  await expectUntouched(
    () => composeLoadout(human, { starterShirt: fits['orc-v1'].starterShirt }, {
      profileId: 'human-v1',
      manifest: catalog,
      loadout: { chest: 'starterShirt' },
    }),
    FIT_CODES.ASSET_MISMATCH,
  );

  const permuted = human.slice(0);
  const parsed = parseGlb(permuted);
  const bodyNode = parsed.json.nodes.find((n) => n.name === 'HumanBody');
  const prim = parsed.json.meshes[bodyNode.mesh].primitives[0];
  const acc = parsed.json.accessors[prim.indices];
  const view = parsed.json.bufferViews[acc.bufferView];
  const offset = (view.byteOffset || 0) + (acc.byteOffset || 0);
  const dv = new DataView(parsed.binary.buffer, parsed.binary.byteOffset, parsed.binary.byteLength);
  const vals = [0, 2, 4, 6, 8, 10].map((d) => dv.getUint16(offset + d, true));
  dv.setUint16(offset, vals[3], true);
  dv.setUint16(offset + 2, vals[4], true);
  dv.setUint16(offset + 4, vals[5], true);
  dv.setUint16(offset + 6, vals[0], true);
  dv.setUint16(offset + 8, vals[1], true);
  dv.setUint16(offset + 10, vals[2], true);
  const permBind = await inspectBindContract(permuted);
  const origBind = await inspectBindContract(human);
  assert.equal(permBind.signature, origBind.signature);
  const permGeom = await sourceGeometrySignature(parsed.json, parsed.binary, bodyNode);
  const origGeom = catalog.bodies['human-v1'].sourceGeometrySignature;
  assert.notEqual(permGeom, origGeom);
  await assert.rejects(
    () => composeLoadout(permuted, fits['human-v1'], {
      profileId: 'human-v1',
      manifest: catalog,
      loadout: { chest: 'starterShirt' },
    }),
    (err) => err.code === FIT_CODES.GEOMETRY_MISMATCH,
  );

  const animOnly = rewriteGlb(human, (json, binary) => {
    const sampler = json.animations[0].samplers[0];
    const a = json.accessors[sampler.output];
    assert.equal(a.componentType, 5126);
    const bv = json.bufferViews[a.bufferView];
    const off = (bv.byteOffset || 0) + (a.byteOffset || 0);
    const view = new DataView(binary.buffer, binary.byteOffset, binary.byteLength);
    view.setFloat32(off, view.getFloat32(off, true) + 0.001, true);
  });
  assert.notEqual(await fileSha256(animOnly), await fileSha256(human));
  const animParsed = parseGlb(animOnly);
  const animBody = animParsed.json.nodes.find((n) => n.name === 'HumanBody');
  assert.equal((await inspectBindContract(animOnly)).signature, origBind.signature);
  assert.equal(await sourceGeometrySignature(animParsed.json, animParsed.binary, animBody), origGeom);
  const dressed = await composeLoadout(animOnly, fits['human-v1'], {
    profileId: 'human-v1',
    manifest: catalog,
    loadout: { chest: 'starterShirt' },
  });
  assert.equal(dressed.manifest.loadout.chest, 'starterShirt');
  assert.ok(parseGlb(dressed.buffer).json.nodes.some((n) => n.name === 'Fit_starterShirt'));
  assert.notEqual(dressed.manifest.sourceBodySha256, catalog.bodies['human-v1'].sourceBodySha256);

  const badOff = rewriteGlb(fits['human-v1'].starterShirt, (json) => {
    json.asset.extras.fit.coverage.triangleOffsets.push(1);
  });
  const fixture = structuredClone(catalog);
  fixture.items.starterShirt.variants['human-v1'].sha256 = await fileSha256(badOff);
  await expectUntouched(
    () => composeLoadout(human, { ...fits['human-v1'], starterShirt: badOff }, {
      profileId: 'human-v1',
      manifest: fixture,
      loadout: { chest: 'starterShirt' },
    }),
    FIT_CODES.COVERAGE_INVALID,
  );

  await expectUntouched(
    () => composeLoadout(human, fits['human-v1'], {
      profileId: 'human-v1',
      manifest: catalog,
      loadout: { chest: 'starterBoots' },
    }),
    FIT_CODES.INVALID_LOADOUT,
  );
  await expectUntouched(
    () => composeLoadout(human, fits['human-v1'], {
      profileId: 'human-v1',
      manifest: catalog,
      loadout: { head: 'starterShirt' },
    }),
    FIT_CODES.INVALID_LOADOUT,
  );
  await expectUntouched(
    () => composeLoadout(human, fits['human-v1'], {
      profileId: 'human-v1',
      manifest: catalog,
      loadout: { chest: 'mageRobe' },
    }),
    FIT_CODES.UNKNOWN_ITEM,
  );
  await expectUntouched(
    () => composeLoadout(human, {}, {
      profileId: 'human-v1',
      manifest: catalog,
      loadout: { chest: 'starterShirt' },
    }),
    FIT_CODES.ASSET_MISMATCH,
  );
});

test('material dedup is by complete content; textures fail closed', { timeout: 60000 }, async () => {
  const human = bodies['human-v1'];
  const shirt = fits['human-v1'].starterShirt;
  const sameName = rewriteGlb(shirt, (json) => {
    json.materials[1].name = json.materials[0].name;
  });
  const sameNameManifest = structuredClone(catalog);
  sameNameManifest.items.starterShirt.variants['human-v1'].sha256 = await fileSha256(sameName);
  const a = parseGlb((await composeLoadout(human, { starterShirt: sameName }, {
    profileId: 'human-v1',
    manifest: sameNameManifest,
    loadout: { chest: 'starterShirt' },
  })).buffer);
  const shirtNode = a.json.nodes.find((n) => n.name === 'Fit_starterShirt');
  const shirtMesh = a.json.meshes[shirtNode.mesh];
  const mat0 = a.json.materials[shirtMesh.primitives[0].material];
  const mat1 = a.json.materials[shirtMesh.primitives[1].material];
  assert.equal(mat0.name, mat1.name);
  assert.notDeepEqual(mat0.pbrMetallicRoughness.baseColorFactor, mat1.pbrMetallicRoughness.baseColorFactor);
  assert.notEqual(shirtMesh.primitives[0].material, shirtMesh.primitives[1].material);

  const identical = rewriteGlb(shirt, (json) => {
    json.materials[1] = structuredClone(json.materials[0]);
  });
  const identManifest = structuredClone(catalog);
  identManifest.items.starterShirt.variants['human-v1'].sha256 = await fileSha256(identical);
  const b = parseGlb((await composeLoadout(human, { starterShirt: identical }, {
    profileId: 'human-v1',
    manifest: identManifest,
    loadout: { chest: 'starterShirt' },
  })).buffer);
  const bNode = b.json.nodes.find((n) => n.name === 'Fit_starterShirt');
  const bMesh = b.json.meshes[bNode.mesh];
  assert.equal(bMesh.primitives[0].material, bMesh.primitives[1].material);

  const textured = rewriteGlb(shirt, (json) => {
    json.materials[0].pbrMetallicRoughness.baseColorTexture = { index: 0 };
  });
  const texManifest = structuredClone(catalog);
  texManifest.items.starterShirt.variants['human-v1'].sha256 = await fileSha256(textured);
  await assert.rejects(
    () => composeLoadout(human, { starterShirt: textured }, {
      profileId: 'human-v1',
      manifest: texManifest,
      loadout: { chest: 'starterShirt' },
    }),
    (err) => err.code === FIT_CODES.TEXTURE_UNSUPPORTED,
  );
});
