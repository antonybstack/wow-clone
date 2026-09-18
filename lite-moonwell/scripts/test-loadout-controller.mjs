import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { composeLoadout } from '../src/character/runtime/compose-loadout.js';
import {
  applyLocoOverlay,
  locoOverlayFromSnapshot,
  restoreLocoOverlayMasks,
} from '../src/character/runtime/body-visual.js';
import { parseFitManifest } from '../src/character/runtime/garment-catalog.js';
import { createLoadoutClient } from '../src/character/runtime/loadout-client.js';
import {
  EMPTY_SKINNED_LOADOUT,
  LOADOUT_CODES,
  LOADOUT_STATUS,
  STARTER_SKINNED_LOADOUT,
  cloneLoadout,
  createLoadoutController,
  decorateOutfitManifest,
  loadoutEqual,
  normalizeCompleteLoadout,
} from '../src/character/runtime/loadout-controller.js';

const FULL = cloneLoadout(STARTER_SKINNED_LOADOUT);
const EMPTY = cloneLoadout(EMPTY_SKINNED_LOADOUT);
const NO_SHIRT = { chest: null, legs: 'starterTrousers', feet: 'starterBoots' };
const NO_LEGS = { chest: 'starterShirt', legs: null, feet: 'starterBoots' };

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function keyOf(loadout) {
  return `${loadout.chest}|${loadout.legs}|${loadout.feet}`;
}

function makeHarness({
  composeDelays = {},
  loadDelays = {},
  failLoadFor = new Set(),
  failPrepareFor = new Set(),
  failCommitFor = new Set(),
  initial = FULL,
} = {}) {
  const canonical = new ArrayBuffer(32);
  new Uint8Array(canonical).fill(9);
  let nextId = 0;
  const composeCalls = [];
  const loadCalls = [];
  const commits = [];
  const disposed = [];
  let live = { id: 'boot', loadout: cloneLoadout(initial), disposed: false };

  const compose = async (loadout) => {
    composeCalls.push(cloneLoadout(loadout));
    await delay(composeDelays[keyOf(loadout)] ?? 0);
    assert.equal(canonical.byteLength, 32, 'canonical buffer detached during compose');
    assert.equal(new Uint8Array(canonical)[0], 9);
    const buffer = new ArrayBuffer(8);
    new Uint8Array(buffer).set([loadout.chest ? 1 : 0, loadout.legs ? 1 : 0, loadout.feet ? 1 : 0, ++nextId]);
    return {
      buffer,
      manifest: { loadout: cloneLoadout(loadout), token: nextId },
    };
  };

  const loadContainer = async (buffer, composed, loadout) => {
    loadCalls.push(cloneLoadout(loadout));
    const candidate = { id: `c${++nextId}`, buffer, loadout: cloneLoadout(loadout), manifest: composed.manifest, disposed: false };
    await delay(loadDelays[keyOf(loadout)] ?? 0);
    if (failLoadFor.has(keyOf(loadout))) {
      const err = new Error('injected load failure');
      err.code = LOADOUT_CODES.STAGING_FAILED;
      throw err;
    }
    return candidate;
  };

  const prepareCandidate = async (loaded, composed, loadout) => {
    if (failPrepareFor.has(keyOf(loadout))) {
      const err = new Error('injected prepare failure');
      err.code = LOADOUT_CODES.STAGING_FAILED;
      throw err;
    }
    loaded.prepared = true;
    return loaded;
  };

  const disposeCandidate = (candidate) => {
    if (!candidate) return;
    if (candidate.disposed) {
      throw new Error(`double dispose of ${candidate.id}`);
    }
    candidate.disposed = true;
    disposed.push(candidate.id);
  };

  const commit = (candidate) => {
    if (!candidate?.prepared) {
      throw new Error('commit received an unprepared candidate');
    }
    if (candidate.disposed) {
      throw new Error(`commit of disposed ${candidate.id}`);
    }
    if (failCommitFor.has(keyOf(candidate.loadout))) {
      const err = new Error('injected commit failure');
      err.code = LOADOUT_CODES.COMMIT_FAILED;
      throw err;
    }
    live = candidate;
    commits.push(candidate.id);
  };

  const controller = createLoadoutController({
    compose,
    loadContainer,
    prepareCandidate,
    disposeCandidate,
    commit,
    getCurrentLoadout: () => live.loadout,
  });

  return {
    canonical,
    composeCalls,
    loadCalls,
    commits,
    disposed,
    get live() { return live; },
    controller,
    stillReadable() {
      assert.equal(canonical.byteLength, 32);
      assert.equal(new Uint8Array(canonical)[0], 9);
    },
  };
}

test('normalizeCompleteLoadout requires all three slots and rejects mismatches', () => {
  assert.deepEqual(normalizeCompleteLoadout(FULL), FULL);
  assert.deepEqual(normalizeCompleteLoadout({ chest: null, legs: null, feet: null }), EMPTY);
  assert.throws(() => normalizeCompleteLoadout({ chest: 'starterShirt' }), /missing slot/);
  assert.throws(() => normalizeCompleteLoadout({ chest: 'starterShirt', legs: null, feet: null, head: 'x' }), /unknown slot/);
  assert.throws(() => normalizeCompleteLoadout({ chest: 'starterBoots', legs: null, feet: null }), /occupies feet/);
  assert.throws(() => normalizeCompleteLoadout({ chest: 'nope', legs: null, feet: null }), /UNKNOWN_ITEM/);
});

test('decorateOutfitManifest keeps honest outfit + component ids for HUD/capture', () => {
  const full = decorateOutfitManifest({
    profile: 'human-v1',
    sourceMesh: 'HumanBody',
    sourceSkin: 0,
    components: [
      { itemId: 'starterShirt', slot: 'chest', sourceTriangles: 10 },
      { itemId: 'starterTrousers', slot: 'legs', sourceTriangles: 11 },
      { itemId: 'starterBoots', slot: 'feet', sourceTriangles: 12 },
    ],
  }, FULL);
  assert.equal(full.outfit, 'starter');
  assert.deepEqual(full.components.map((c) => c.id).sort(), ['boots', 'shirt', 'trousers']);
  const empty = decorateOutfitManifest({ components: [], sourceMesh: 'HumanBody' }, EMPTY);
  assert.equal(empty.outfit, 'body');
  assert.equal(empty.components.length, 0);
  const mixed = decorateOutfitManifest({
    components: [{ itemId: 'starterBoots', slot: 'feet' }],
  }, { chest: null, legs: null, feet: 'starterBoots' });
  assert.equal(mixed.outfit, 'mixed');
  assert.equal(mixed.components[0].id, 'boots');
});

test('later request commits first; stale compose cannot overwrite it', async () => {
  const h = makeHarness({
    initial: EMPTY,
    loadDelays: {
      [keyOf(FULL)]: 50,
    },
  });
  const slow = h.controller.setLoadout(FULL);
  await delay(15);
  const fast = h.controller.setLoadout(NO_SHIRT);
  const [slowOut, fastOut] = await Promise.all([slow, fast]);
  assert.equal(fastOut.status, LOADOUT_STATUS.applied);
  assert.equal(slowOut.status, LOADOUT_STATUS.superseded);
  assert.equal(slowOut.supersededBy, fastOut.requestId);
  assert.equal(h.commits.length, 1);
  assert.deepEqual(h.live.loadout, NO_SHIRT);
  assert.equal(h.disposed.length, 1);
  assert.notEqual(h.disposed[0], h.live.id);
  assert.equal(h.live.disposed, false);
  assert.ok(h.composeCalls.some((c) => loadoutEqual(c, FULL)));
  assert.ok(h.composeCalls.some((c) => loadoutEqual(c, NO_SHIRT)));
  h.stillReadable();
});

test('failed load preserves the live outfit and disposes the staged container once', async () => {
  const h = makeHarness({
    failPrepareFor: new Set([keyOf(NO_SHIRT)]),
  });
  const first = await h.controller.setLoadout(EMPTY);
  assert.equal(first.status, LOADOUT_STATUS.applied);
  assert.deepEqual(h.live.loadout, EMPTY);
  const liveId = h.live.id;
  const failed = await h.controller.setLoadout(NO_SHIRT);
  assert.equal(failed.status, LOADOUT_STATUS.failed);
  assert.equal(failed.error.code, LOADOUT_CODES.STAGING_FAILED);
  assert.deepEqual(h.live.loadout, EMPTY);
  assert.equal(h.live.id, liveId);
  assert.equal(h.commits.length, 1);
  assert.equal(h.disposed.length, 1);
  assert.notEqual(h.disposed[0], liveId);
  h.stillReadable();
});

test('failed loader before a container is returned leaves the live outfit in place', async () => {
  const h = makeHarness({
    failLoadFor: new Set([keyOf(NO_LEGS)]),
  });
  const first = await h.controller.setLoadout(EMPTY);
  assert.equal(first.status, LOADOUT_STATUS.applied);
  const liveId = h.live.id;
  const failed = await h.controller.setLoadout(NO_LEGS);
  assert.equal(failed.status, LOADOUT_STATUS.failed);
  assert.equal(h.live.id, liveId);
  assert.deepEqual(h.live.loadout, EMPTY);
  assert.equal(h.disposed.length, 0);
  h.stillReadable();
});

test('identical selection is unchanged and still cancels an in-flight swap', async () => {
  const h = makeHarness({
    loadDelays: { [keyOf(EMPTY)]: 50 },
  });
  const inflight = h.controller.setLoadout(EMPTY);
  await delay(15);
  const same = await h.controller.setLoadout(FULL);
  assert.equal(same.status, LOADOUT_STATUS.unchanged);
  const delayed = await inflight;
  assert.equal(delayed.status, LOADOUT_STATUS.superseded);
  assert.deepEqual(h.live.loadout, FULL);
  assert.equal(h.commits.length, 0);
  assert.equal(h.disposed.length, 1);
  h.stillReadable();
});

test('authored nonadditive cast restore reapplies loco leg mask and keeps clip time', () => {
  const locoMask = { kind: 'include-legs' };
  const walk = { name: 'walk', mask: undefined, currentTime: 0.42, isPlaying: true };
  const idle = { name: 'idle', mask: locoMask, currentTime: 0.11, isPlaying: true };
  const cast = { name: 'cast', mask: { kind: 'exclude-legs' }, currentTime: 0.17, isPlaying: true };
  const authored = {
    additiveCast: false,
    locoMask,
    locoClips: [walk, idle],
    spellShoot: cast,
  };
  assert.equal(locoOverlayFromSnapshot(authored, { castingShoot: true }), true);
  restoreLocoOverlayMasks(authored, { castingShoot: true });
  assert.equal(walk.mask, locoMask);
  assert.equal(idle.mask, locoMask);
  assert.equal(walk.currentTime, 0.42);
  assert.equal(cast.currentTime, 0.17);
  assert.equal(cast.isPlaying, true);
  for (const channelPhase of ['enter', 'loop', 'exit']) {
    restoreLocoOverlayMasks(authored, { castingShoot: false, channelPhase });
    assert.equal(walk.mask, locoMask, `channel ${channelPhase} keeps locomotion on legs`);
  }
  restoreLocoOverlayMasks(authored, { castingShoot: false });
  assert.equal(walk.mask, undefined);
  assert.equal(idle.mask, undefined);
  applyLocoOverlay(authored, true);
  assert.equal(walk.mask, locoMask);

  const mixamo = {
    additiveCast: true,
    locoMask: null,
    locoClips: [{ name: 'Walk_Loop', mask: undefined }],
  };
  assert.equal(locoOverlayFromSnapshot(mixamo, { castingShoot: true }), false);
  restoreLocoOverlayMasks(mixamo, { castingShoot: true });
  assert.equal(mixamo.locoClips[0].mask, undefined);
});

test('injected commit failure keeps the live identity and retires the candidate once', async () => {
  const h = makeHarness({
    failCommitFor: new Set([keyOf(EMPTY)]),
  });
  const liveId = h.live.id;
  const liveLoadout = cloneLoadout(h.live.loadout);
  const failed = await h.controller.setLoadout(EMPTY);
  assert.equal(failed.status, LOADOUT_STATUS.failed);
  assert.equal(failed.error.code, LOADOUT_CODES.COMMIT_FAILED);
  assert.equal(h.live.id, liveId);
  assert.deepEqual(h.live.loadout, liveLoadout);
  assert.equal(h.commits.length, 0);
  assert.equal(h.disposed.length, 1);
  assert.notEqual(h.disposed[0], liveId);
  assert.equal(h.live.disposed, false);
  h.stillReadable();
});

test('invalid selection fails closed without compose and without touching the live outfit', async () => {
  const h = makeHarness();
  const liveId = h.live.id;
  const bad = await h.controller.setLoadout({ chest: 'staff', legs: null, feet: null });
  assert.equal(bad.status, LOADOUT_STATUS.failed);
  assert.equal(bad.error.code, LOADOUT_CODES.UNKNOWN_ITEM);
  assert.equal(h.composeCalls.length, 0);
  assert.equal(h.live.id, liveId);
});

test('canonical buffer remains usable after overlapping compose work', async () => {
  const h = makeHarness({
    initial: { chest: 'starterShirt', legs: null, feet: null },
    loadDelays: {
      [keyOf(FULL)]: 40,
      [keyOf(NO_SHIRT)]: 25,
    },
  });
  const first = h.controller.setLoadout(FULL);
  await delay(10);
  const second = h.controller.setLoadout(NO_SHIRT);
  await delay(10);
  const third = h.controller.setLoadout(EMPTY);
  const results = await Promise.all([first, second, third]);
  const applied = results.filter((r) => r.status === LOADOUT_STATUS.applied);
  const superseded = results.filter((r) => r.status === LOADOUT_STATUS.superseded);
  assert.equal(applied.length, 1);
  assert.equal(applied[0].loadout.chest, null);
  assert.equal(applied[0].loadout.legs, null);
  assert.equal(applied[0].loadout.feet, null);
  assert.equal(superseded.length, 2);
  assert.deepEqual(h.live.loadout, EMPTY);
  assert.equal(h.commits.length, 1);
  const uniqueDisposed = new Set(h.disposed);
  assert.equal(uniqueDisposed.size, h.disposed.length);
  assert.ok(!h.disposed.includes(h.live.id));
  h.stillReadable();
});

async function loadBuf(rel) {
  const file = await readFile(new URL(`../${rel}`, import.meta.url));
  return file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength);
}

/** In-process Worker stand-in so Node tests exercise the client without worker_threads globals. */
function InProcessWorker() {
  this.onmessage = null;
  this.onerror = null;
  this._canonical = null;
  this._manifest = null;
  this._profileId = null;
  this._fits = {};
  this._queue = Promise.resolve();
}
InProcessWorker.prototype.postMessage = function postMessage(data) {
  this._queue = this._queue.then(async () => {
    try {
      const result = await this._handle(data);
      this.onmessage?.({ data: { id: data.id, result } });
    } catch (error) {
      this.onmessage?.({ data: { id: data.id, error: { code: error.code, message: error.message } } });
    }
  });
};
InProcessWorker.prototype.terminate = function terminate() {
  this._canonical = null;
};
InProcessWorker.prototype._handle = async function handle(data) {
  if (data.type === 'init') {
    this._canonical = data.canonical;
    this._manifest = data.manifest;
    this._profileId = data.profileId;
    Object.assign(this._fits, data.fits || {});
    return { ok: true, bytes: this._canonical.byteLength };
  }
  if (data.type === 'compose') {
    Object.assign(this._fits, data.fits || {});
    try {
      return await composeLoadout(this._canonical, this._fits, {
        profileId: this._profileId,
        manifest: this._manifest,
        loadout: data.loadout,
      });
    } catch (error) {
      for (const itemId of [data.loadout?.chest, data.loadout?.legs, data.loadout?.feet]) {
        if (itemId) delete this._fits[itemId];
      }
      throw error;
    }
  }
  throw new Error(`unknown ${data.type}`);
};

test('loadout client clones canonical into the worker and keeps the source usable', { timeout: 120000 }, async () => {
  const source = await loadBuf('public/characters/bodies/human-animated-v1.glb');
  const before = source.byteLength;
  const first = new Uint8Array(source)[0];
  const catalog = parseFitManifest(JSON.parse(
    await readFile(new URL('../public/characters/garments/starter-fits.v1.json', import.meta.url), 'utf8'),
  ));
  const client = createLoadoutClient({
    canonicalBuffer: source,
    manifest: catalog,
    profileId: 'human-v1',
    WorkerImpl: InProcessWorker,
    fitLoader: async (itemId, variant) => loadBuf(`public/characters/garments/${variant.file}`),
  });
  try {
    const empty = await client.compose(EMPTY);
    assert.equal(source.byteLength, before);
    assert.equal(new Uint8Array(source)[0], first);
    assert.ok(empty.buffer.byteLength > 1000);
    assert.equal(empty.manifest.shortsHidden, false);
    const dressed = await client.compose(FULL);
    assert.equal(source.byteLength, before);
    assert.ok(dressed.buffer.byteLength > 1000);
    assert.equal(dressed.manifest.loadout.chest, 'starterShirt');
    assert.equal(dressed.manifest.shortsHidden, true);
    const emptyAgain = await client.compose(EMPTY);
    assert.equal(source.byteLength, before);
    assert.ok(emptyAgain.buffer.byteLength > 1000);
  } finally {
    client.dispose();
  }
});

test('partial fit fetch failure does not mark unsent fits; retry composes the full loadout', { timeout: 120000 }, async () => {
  const source = await loadBuf('public/characters/bodies/human-animated-v1.glb');
  const before = source.byteLength;
  const catalog = parseFitManifest(JSON.parse(
    await readFile(new URL('../public/characters/garments/starter-fits.v1.json', import.meta.url), 'utf8'),
  ));
  const fetched = [];
  let failTrousers = true;
  const client = createLoadoutClient({
    canonicalBuffer: source,
    manifest: catalog,
    profileId: 'human-v1',
    WorkerImpl: InProcessWorker,
    fitLoader: async (itemId, variant) => {
      fetched.push(itemId);
      if (failTrousers && itemId === 'starterTrousers') {
        const err = new Error('transient trousers fetch');
        err.code = LOADOUT_CODES.ASSET_MISMATCH;
        throw err;
      }
      return loadBuf(`public/characters/garments/${variant.file}`);
    },
  });
  try {
    const failed = await client.compose(FULL).then(() => null, (error) => error);
    assert.ok(failed);
    assert.equal(failed.code, LOADOUT_CODES.ASSET_MISMATCH);
    assert.deepEqual(client.postedFitIds, []);
    assert.equal(source.byteLength, before);
    failTrousers = false;
    const dressed = await client.compose(FULL);
    assert.equal(dressed.manifest.shortsHidden, true);
    assert.equal(dressed.manifest.loadout.legs, 'starterTrousers');
    assert.ok(fetched.filter((id) => id === 'starterShirt').length >= 2);
    assert.ok(fetched.filter((id) => id === 'starterTrousers').length >= 2);
    assert.equal(source.byteLength, before);
  } finally {
    client.dispose();
  }
});

test('invalid fit bytes are dropped and a later request can retry', { timeout: 120000 }, async () => {
  const source = await loadBuf('public/characters/bodies/human-animated-v1.glb');
  const catalog = parseFitManifest(JSON.parse(
    await readFile(new URL('../public/characters/garments/starter-fits.v1.json', import.meta.url), 'utf8'),
  ));
  let poisonTrousers = true;
  const fetched = [];
  const client = createLoadoutClient({
    canonicalBuffer: source,
    manifest: catalog,
    profileId: 'human-v1',
    WorkerImpl: InProcessWorker,
    fitLoader: async (itemId, variant) => {
      fetched.push(itemId);
      if (poisonTrousers && itemId === 'starterTrousers') {
        return loadBuf('public/characters/garments/starterTrousers.orc-v1.v1.glb');
      }
      return loadBuf(`public/characters/garments/${variant.file}`);
    },
  });
  try {
    const failed = await client.compose(FULL).then(() => null, (error) => error);
    assert.ok(failed);
    assert.equal(failed.code, LOADOUT_CODES.ASSET_MISMATCH);
    assert.deepEqual(client.postedFitIds, []);
    poisonTrousers = false;
    const dressed = await client.compose(FULL);
    assert.equal(dressed.manifest.loadout.chest, 'starterShirt');
    assert.equal(dressed.manifest.loadout.legs, 'starterTrousers');
    assert.equal(dressed.manifest.shortsHidden, true);
    assert.ok(fetched.filter((id) => id === 'starterTrousers').length >= 2);
  } finally {
    client.dispose();
  }
});
