import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { inspectBindContract } from '../src/character/runtime/bind-contract.js';
import { composeStarterOutfit, STARTER_PROFILES } from '../src/character/runtime/compose-starter-outfit.js';
import { extractFitGarment } from '../src/character/runtime/extract-fit-garment.js';
import {
  FIT_ASSET_VERSION,
  FIT_CODES,
  SHAPE_IDENTITY,
  assertCopiedSkinBind,
  sourceGeometrySignature,
  validateCoverageOffsets,
} from '../src/character/runtime/fit-contract.js';
import {
  PLAYABLE_FIT_PROFILES,
  STARTER_ITEM_IDS,
  STARTER_ITEMS,
  parseFitManifest,
  resolveFit,
} from '../src/character/runtime/garment-catalog.js';
import { parseGlb, readAccessor } from '../src/character/runtime/glb.js';
import { bakeStarterFits, loadCanonicalBody } from './bake-starter-fits.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

function sha256(buf) {
  return createHash('sha256').update(buf instanceof Uint8Array ? buf : new Uint8Array(buf)).digest('hex');
}

function accHash(json, binary, index) {
  if (index == null) return null;
  const a = json.accessors[index];
  const data = readAccessor(json, binary, index);
  return {
    componentType: a.componentType,
    type: a.type,
    count: a.count,
    normalized: !!a.normalized,
    sha256: sha256(new Uint8Array(data.buffer, data.byteOffset, data.byteLength)),
  };
}

function composeFingerprint(buffer) {
  const { json, binary } = parseGlb(buffer);
  return {
    byteLength: buffer.byteLength,
    sha256: sha256(buffer),
    meshNames: json.meshes.map((m) => m.name),
    materials: json.materials.map((m) => ({ name: m.name, pbr: m.pbrMetallicRoughness })),
    skins: json.skins.map((s) => ({
      name: s.name,
      joints: s.joints,
      jointNames: s.joints.map((i) => json.nodes[i]?.name),
      ibm: accHash(json, binary, s.inverseBindMatrices),
    })),
    animations: (json.animations || []).map((a) => ({
      name: a.name,
      channels: a.channels.map((c) => ({ sampler: c.sampler, target: c.target })),
      samplers: a.samplers.length,
    })),
    meshes: json.meshes.map((m) => ({
      name: m.name,
      primitives: m.primitives.map((p) => ({
        material: p.material,
        attributes: Object.fromEntries(Object.entries(p.attributes).map(([k, v]) => [k, accHash(json, binary, v)])),
        indices: accHash(json, binary, p.indices),
      })),
    })),
  };
}

const before = JSON.parse(await readFile(new URL('../ve-capture/m3-garment-fit-bake/before-compose.json', import.meta.url)));

test('public fit GLB hashes are unchanged by resolver-only edits', async () => {
  const evidence = JSON.parse(await readFile(new URL('../ve-capture/m3-garment-fit-bake/evidence.json', import.meta.url)));
  for (const fit of evidence.fits) {
    const bytes = await readFile(new URL(`../public/characters/garments/${fit.file}`, import.meta.url));
    assert.equal(bytes.byteLength, fit.byteLength, fit.file);
    assert.equal(`sha256:${sha256(bytes)}`, fit.sha256, fit.file);
  }
});

test('canonical body bytes match pre-refactor provenance hashes', async () => {
  for (const profileId of PLAYABLE_FIT_PROFILES) {
    const loaded = await loadCanonicalBody(profileId, ROOT);
    assert.equal(loaded.sha256, `sha256:${before.bodies[profileId].sha256}`);
    assert.equal(loaded.byteLength, before.bodies[profileId].byteLength);
  }
});

test('composeStarterOutfit decoded output matches pre-refactor fingerprints after selection extract', { timeout: 120000 }, async () => {
  for (const profileId of PLAYABLE_FIT_PROFILES) {
    const { buffer } = await loadCanonicalBody(profileId, ROOT);
    const beforeBytes = new Uint8Array(buffer).slice();
    const composed = composeStarterOutfit(buffer, { profile: profileId, outfit: 'starter' });
    assert.deepEqual(new Uint8Array(buffer), beforeBytes);
    const fp = composeFingerprint(composed.buffer);
    const prev = before.composed[profileId].fingerprint;
    assert.equal(fp.sha256, prev.sha256, profileId);
    assert.deepEqual(fp.meshNames, prev.meshNames);
    assert.deepEqual(fp.materials, prev.materials);
    assert.deepEqual(fp.skins, prev.skins);
    assert.deepEqual(fp.animations, prev.animations);
    assert.deepEqual(fp.meshes, prev.meshes);
  }
});

test('nine compact fits parse with signatures, skin copy, and no body/image/animation payload', { timeout: 180000 }, async () => {
  for (const profileId of PLAYABLE_FIT_PROFILES) {
    const loaded = await loadCanonicalBody(profileId, ROOT);
    const src = parseGlb(loaded.buffer);
    const bodyNode = src.json.nodes.find((n) => n.name === STARTER_PROFILES[profileId].bodyMesh);
    const bind = await inspectBindContract(loaded.buffer);
    const geom = await sourceGeometrySignature(src.json, src.binary, bodyNode);
    const bodyPos = readAccessor(src.json, src.binary, src.json.meshes[bodyNode.mesh].primitives[0].attributes.POSITION);

    for (const itemId of STARTER_ITEM_IDS) {
      const extracted = await extractFitGarment(loaded.buffer, { profileId, itemId });
      const fit = parseGlb(extracted.buffer);
      const extras = fit.json.asset.extras.fit;
      assert.equal(extras.itemId, itemId);
      assert.equal(extras.profileId, profileId);
      assert.equal(extras.slot, STARTER_ITEMS[itemId].slot);
      assert.equal(extras.bindSignature, bind.signature);
      assert.equal(extras.sourceGeometrySignature, geom);
      assert.equal(extras.sourceBodySha256, loaded.sha256);
      assert.equal(extras.sourceMesh, STARTER_PROFILES[profileId].bodyMesh);
      assertCopiedSkinBind(src.json, src.binary, fit.json, fit.binary);

      assert.equal(fit.json.animations, undefined);
      assert.equal(fit.json.images, undefined);
      assert.equal(fit.json.textures, undefined);
      assert.equal(fit.json.samplers, undefined);
      assert.equal(fit.json.meshes.length, 1);
      assert.equal(fit.json.meshes[0].name, STARTER_ITEMS[itemId].meshName);
      assert.equal(fit.json.meshes.some((m) => m.name.includes('Body') || m.name.includes('Hair') || m.name.includes('Shorts')), false);

      const prims = fit.json.meshes[0].primitives;
      const pos = readAccessor(fit.json, fit.binary, prims[0].attributes.POSITION);
      assert.ok(pos.length >= 3);
      assert.ok(extras.coverage.triangleOffsets.length > 80);
      assert.ok(pos.length / 3 < bodyPos.length / 3, 'fit vertex count must be smaller than body');
      assert.equal(fit.json.accessors[prims[0].attributes.JOINTS_0].componentType, 5121);
      const joints = readAccessor(fit.json, fit.binary, prims[0].attributes.JOINTS_0);
      const weights = readAccessor(fit.json, fit.binary, prims[0].attributes.WEIGHTS_0);
      for (let i = 0; i < joints.length; i++) assert.ok(joints[i] < 163);
      for (let i = 0; i < weights.length; i += 4) {
        const sum = weights[i] + weights[i + 1] + weights[i + 2] + weights[i + 3];
        assert.ok(Math.abs(sum - 1) < 0.002);
      }
      validateCoverageOffsets(extras.coverage.triangleOffsets, src.json.accessors[src.json.meshes[bodyNode.mesh].primitives[0].indices].count);
      if (itemId === 'starterShirt') {
        assert.ok(prims.length >= 1);
        assert.equal(fit.json.materials[0].name, 'StarterIndigo');
        if (prims.length > 1) assert.equal(fit.json.materials[1].name, 'StarterBelt');
      } else {
        assert.equal(prims.length, 1);
      }
      if (itemId === 'starterTrousers') {
        assert.deepEqual(extras.hideNodes, [STARTER_PROFILES[profileId].shortsNode]);
      } else {
        assert.deepEqual(extras.hideNodes, []);
      }
      assert.ok(extracted.buffer.byteLength < loaded.byteLength * 0.25, `${itemId} ${profileId} not compact`);
      assert.equal(new Uint8Array(loaded.buffer).length, before.bodies[profileId].byteLength);
    }
  }
});

test('resolver rejects missing profile, wrong bind, permuted geometry, and bad coverage', { timeout: 180000 }, async () => {
  const human = await loadCanonicalBody('human-v1', ROOT);
  const orc = await loadCanonicalBody('orc-v1', ROOT);
  const shirt = await extractFitGarment(human.buffer, { profileId: 'human-v1', itemId: 'starterShirt' });
  const tmp = await mkdtemp(join(tmpdir(), 'starter-fits-'));
  try {
    const { manifest } = await bakeStarterFits({ outDir: tmp, root: ROOT });
    parseFitManifest(manifest);
    const humanBind = manifest.bodies['human-v1'].bindSignature;
    const humanGeom = manifest.bodies['human-v1'].sourceGeometrySignature;
    const humanContract = { bindSignature: humanBind, sourceGeometrySignature: humanGeom };

    for (const itemId of STARTER_ITEM_IDS) {
      for (const profileId of PLAYABLE_FIT_PROFILES) {
        const body = manifest.bodies[profileId];
        const resolved = resolveFit(itemId, profileId, {
          bindSignature: body.bindSignature,
          sourceGeometrySignature: body.sourceGeometrySignature,
        }, manifest);
        assert.equal(resolved.variant.profileId, profileId);
        assert.equal(resolved.variant.shapeId, SHAPE_IDENTITY);
        assert.equal(resolved.variant.version, FIT_ASSET_VERSION);
      }
    }
    const partial = { schema: manifest.schema, items: { starterShirt: { variants: { 'human-v1': manifest.items.starterShirt.variants['human-v1'] } } } };
    assert.equal(resolveFit('starterShirt', 'human-v1', humanContract, partial).variant.profileId, 'human-v1');
    assert.throws(() => resolveFit('starterBoots', 'human-v1', humanContract, partial), (err) => err.code === FIT_CODES.MISSING_FIT);

    assert.throws(() => resolveFit('starterShirt', 'elf-v1', {}, manifest), (err) => err.code === FIT_CODES.MISSING_FIT);
    assert.throws(() => resolveFit('noSuchItem', 'human-v1', humanContract, manifest), (err) => err.code === FIT_CODES.UNKNOWN_ITEM);
    assert.throws(() => resolveFit('starterShirt', 'human-v1', {}, manifest), (err) => err.code === FIT_CODES.INVALID_CONTRACT);
    assert.throws(() => resolveFit('starterShirt', 'human-v1', { bindSignature: humanBind }, manifest), (err) => err.code === FIT_CODES.INVALID_CONTRACT);
    assert.throws(() => resolveFit('starterShirt', 'human-v1', { sourceGeometrySignature: humanGeom }, manifest), (err) => err.code === FIT_CODES.INVALID_CONTRACT);
    assert.throws(() => resolveFit('starterShirt', 'human-v1', { bindSignature: '', sourceGeometrySignature: humanGeom }, manifest), (err) => err.code === FIT_CODES.INVALID_CONTRACT);
    assert.throws(() => resolveFit('starterShirt', 'human-v1', { bindSignature: humanBind, sourceGeometrySignature: 1 }, manifest), (err) => err.code === FIT_CODES.INVALID_CONTRACT);

    const badProfile = structuredClone(manifest);
    badProfile.items.starterShirt.variants['human-v1'].profileId = 'orc-v1';
    assert.throws(() => resolveFit('starterShirt', 'human-v1', humanContract, badProfile), (err) => err.code === FIT_CODES.INVALID_FIT);
    const badShape = structuredClone(manifest);
    badShape.items.starterShirt.variants['human-v1'].shapeId = 'fullness';
    assert.throws(() => resolveFit('starterShirt', 'human-v1', humanContract, badShape), (err) => err.code === FIT_CODES.INVALID_FIT);
    const badVersion = structuredClone(manifest);
    badVersion.items.starterShirt.variants['human-v1'].version = FIT_ASSET_VERSION + 1;
    assert.throws(() => resolveFit('starterShirt', 'human-v1', humanContract, badVersion), (err) => err.code === FIT_CODES.INVALID_FIT);

    assert.throws(
      () => resolveFit('starterShirt', 'orc-v1', humanContract, manifest),
      (err) => err.code === FIT_CODES.BIND_MISMATCH,
    );
    assert.throws(
      () => resolveFit('starterShirt', 'human-v1', { bindSignature: humanBind, sourceGeometrySignature: manifest.bodies['orc-v1'].sourceGeometrySignature }, manifest),
      (err) => err.code === FIT_CODES.GEOMETRY_MISMATCH,
    );

    const orcBind = await inspectBindContract(orc.buffer);
    assert.notEqual(orcBind.signature, shirt.extras.bindSignature);
    assert.throws(
      () => resolveFit('starterShirt', 'human-v1', { bindSignature: orcBind.signature, sourceGeometrySignature: humanGeom }, manifest),
      (err) => err.code === FIT_CODES.BIND_MISMATCH,
    );

    const copy = human.buffer.slice(0);
    const parsed = parseGlb(copy);
    const bodyNode = parsed.json.nodes.find((n) => n.name === 'HumanBody');
    const prim = parsed.json.meshes[bodyNode.mesh].primitives[0];
    const acc = parsed.json.accessors[prim.indices];
    const view = parsed.json.bufferViews[acc.bufferView];
    const offset = (view.byteOffset || 0) + (acc.byteOffset || 0);
    assert.equal(acc.componentType, 5123);
    const dv = new DataView(parsed.binary.buffer, parsed.binary.byteOffset, parsed.binary.byteLength);
    const a = dv.getUint16(offset, true);
    const b = dv.getUint16(offset + 2, true);
    const c = dv.getUint16(offset + 4, true);
    const d = dv.getUint16(offset + 6, true);
    const e = dv.getUint16(offset + 8, true);
    const f = dv.getUint16(offset + 10, true);
    dv.setUint16(offset, d, true);
    dv.setUint16(offset + 2, e, true);
    dv.setUint16(offset + 4, f, true);
    dv.setUint16(offset + 6, a, true);
    dv.setUint16(offset + 8, b, true);
    dv.setUint16(offset + 10, c, true);
    const permutedBind = await inspectBindContract(copy);
    const permutedGeom = await sourceGeometrySignature(parsed.json, parsed.binary, bodyNode);
    assert.equal(permutedBind.signature, humanBind);
    assert.notEqual(permutedGeom, humanGeom);
    assert.throws(
      () => resolveFit('starterShirt', 'human-v1', { bindSignature: permutedBind.signature, sourceGeometrySignature: permutedGeom }, manifest),
      (err) => err.code === FIT_CODES.GEOMETRY_MISMATCH,
    );

    assert.throws(() => validateCoverageOffsets([1], 99), (err) => err.code === FIT_CODES.COVERAGE_INVALID);
    assert.throws(() => validateCoverageOffsets([0, 0], 99), (err) => err.code === FIT_CODES.COVERAGE_INVALID);
    assert.throws(() => validateCoverageOffsets([90], 12), (err) => err.code === FIT_CODES.COVERAGE_INVALID);
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

test('bake is deterministic and leaves canonical bodies unchanged', { timeout: 180000 }, async () => {
  const a = await mkdtemp(join(tmpdir(), 'fits-a-'));
  const b = await mkdtemp(join(tmpdir(), 'fits-b-'));
  try {
    const first = await bakeStarterFits({ outDir: a, root: ROOT });
    const second = await bakeStarterFits({ outDir: b, root: ROOT });
    for (const itemId of STARTER_ITEM_IDS) {
      for (const profileId of PLAYABLE_FIT_PROFILES) {
        const fa = await readFile(join(a, first.manifest.items[itemId].variants[profileId].file));
        const fb = await readFile(join(b, second.manifest.items[itemId].variants[profileId].file));
        assert.equal(sha256(fa), sha256(fb), `${itemId} ${profileId}`);
        assert.equal(first.manifest.items[itemId].variants[profileId].sha256, second.manifest.items[itemId].variants[profileId].sha256);
      }
    }
    for (const profileId of PLAYABLE_FIT_PROFILES) {
      const loaded = await loadCanonicalBody(profileId, ROOT);
      assert.equal(loaded.sha256, first.manifest.hashesBefore[profileId]);
      assert.equal(loaded.sha256, `sha256:${before.bodies[profileId].sha256}`);
    }
  } finally {
    await rm(a, { recursive: true, force: true });
    await rm(b, { recursive: true, force: true });
  }
});
