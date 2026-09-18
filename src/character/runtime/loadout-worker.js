/**
 * Persistent compose worker. Holds one cloned canonical body + fit cache.
 * Never transfers the canonical source out.
 */
import { composeLoadout } from './compose-loadout.js';
import { fitGlbUrl } from './garment-catalog.js';

let canonical = null;
let manifest = null;
let profileId = null;
const fitCache = new Map();
let chain = Promise.resolve();

function asArrayBuffer(source) {
  if (source instanceof ArrayBuffer) return source;
  if (ArrayBuffer.isView(source)) {
    return source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength);
  }
  throw new Error('Expected ArrayBuffer');
}

function errorPayload(error) {
  const err = error instanceof Error ? error : new Error(String(error));
  return { code: err.code || 'STAGING_FAILED', message: err.message || String(error) };
}

function storeFits(fits) {
  if (!fits) return;
  for (const [itemId, raw] of Object.entries(fits)) {
    if (raw == null || fitCache.has(itemId)) continue;
    fitCache.set(itemId, asArrayBuffer(raw));
  }
}

function dropFits(itemIds) {
  for (const itemId of itemIds || []) {
    if (typeof itemId === 'string' && itemId) fitCache.delete(itemId);
  }
}

function loadoutItemIds(loadout) {
  return [loadout?.chest, loadout?.legs, loadout?.feet].filter((id) => typeof id === 'string' && id);
}

async function fetchFit(itemId) {
  const variant = manifest?.items?.[itemId]?.variants?.[profileId];
  if (!variant) {
    const err = new Error(`MISSING_FIT: no variant for ${itemId} on ${profileId}`);
    err.code = 'MISSING_FIT';
    throw err;
  }
  const url = variant.glb || fitGlbUrl(itemId, profileId);
  const response = await fetch(url);
  if (!response.ok) {
    const err = new Error(`ASSET_MISMATCH: fetch ${url} failed ${response.status}`);
    err.code = 'ASSET_MISMATCH';
    throw err;
  }
  return asArrayBuffer(await response.arrayBuffer());
}

async function fitsForLoadout(loadout) {
  const fits = {};
  for (const itemId of [loadout?.chest, loadout?.legs, loadout?.feet]) {
    if (typeof itemId !== 'string' || !itemId) continue;
    let buf = fitCache.get(itemId);
    if (!buf) {
      buf = await fetchFit(itemId);
      fitCache.set(itemId, buf);
    }
    fits[itemId] = buf;
  }
  return fits;
}

async function handle(data) {
  const { id, type } = data;
  try {
    if (type === 'init') {
      canonical = asArrayBuffer(data.canonical);
      manifest = data.manifest;
      profileId = data.profileId;
      storeFits(data.fits);
      self.postMessage({ id, result: { ok: true, bytes: canonical.byteLength } });
      return;
    }
    if (type === 'compose') {
      if (!canonical || !manifest || !profileId) {
        throw new Error('Loadout worker has no canonical body');
      }
      const loadout = data.loadout || {};
      try {
        storeFits(data.fits);
        const fits = await fitsForLoadout(loadout);
        const result = await composeLoadout(canonical, fits, { profileId, manifest, loadout });
        self.postMessage({ id, result: { buffer: result.buffer, manifest: result.manifest } }, [result.buffer]);
      } catch (error) {
        dropFits(loadoutItemIds(loadout));
        throw error;
      }
      return;
    }
    throw new Error(`Unknown loadout worker message ${type}`);
  } catch (error) {
    self.postMessage({ id, error: errorPayload(error) });
  }
}

self.onmessage = (event) => {
  chain = chain.then(() => handle(event.data), () => handle(event.data));
};
