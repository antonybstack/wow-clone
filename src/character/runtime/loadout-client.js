/**
 * Main-thread owner of one persistent loadout worker per authored body.
 * Canonical source bytes are cloned into the worker and never transferred away.
 */
import { fitGlbUrl } from './garment-catalog.js';
import { LOADOUT_CODES, loadoutError, cloneLoadout } from './loadout-controller.js';

export function cloneArrayBuffer(source) {
  if (source instanceof ArrayBuffer) return source.slice(0);
  if (ArrayBuffer.isView(source)) {
    return source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength);
  }
  throw loadoutError(LOADOUT_CODES.INVALID_FIT, 'Expected ArrayBuffer');
}

function reconstructError(error) {
  if (!error) return loadoutError(LOADOUT_CODES.STAGING_FAILED, 'Loadout worker failed');
  if (error instanceof Error) return error;
  if (typeof error === 'object') {
    const err = loadoutError(error.code || LOADOUT_CODES.STAGING_FAILED, error.message || String(error));
    return err;
  }
  return loadoutError(LOADOUT_CODES.STAGING_FAILED, String(error));
}

async function defaultFetchFit(itemId, variant) {
  const url = variant?.glb || fitGlbUrl(itemId, variant?.profileId);
  const response = await fetch(url);
  if (!response.ok) {
    throw loadoutError(
      LOADOUT_CODES.ASSET_MISMATCH,
      `ASSET_MISMATCH: fetch ${url} failed ${response.status}`,
    );
  }
  return response.arrayBuffer();
}

function neededItemIds(loadout) {
  return [loadout.chest, loadout.legs, loadout.feet].filter((id) => typeof id === 'string' && id);
}

/**
 * @param {{
 *   canonicalBuffer: ArrayBuffer|Uint8Array,
 *   manifest: object,
 *   profileId: string,
 *   fitLoader?: (itemId: string, variant: object) => Promise<ArrayBuffer>,
 *   WorkerImpl?: typeof Worker,
 * }} opts
 */
export function createLoadoutClient(opts) {
  const canonicalBuffer = opts.canonicalBuffer;
  const manifest = opts.manifest;
  const profileId = opts.profileId;
  const fitLoader = opts.fitLoader || defaultFetchFit;
  const WorkerImpl = opts.WorkerImpl || globalThis.Worker;
  if (!WorkerImpl) {
    throw loadoutError(LOADOUT_CODES.STAGING_FAILED, 'Loadout client requires Worker');
  }

  if (!canonicalBuffer) {
    throw loadoutError(LOADOUT_CODES.INVALID_FIT, 'Loadout client requires a canonical body buffer');
  }

  const worker = new WorkerImpl(new URL('./loadout-worker.js', import.meta.url), { type: 'module' });
  const pending = new Map();
  let sequence = 0;
  let stopped = false;
  const postedFits = new Set();
  let composeChain = Promise.resolve();

  function request(data, transfer = []) {
    if (stopped) {
      return Promise.reject(loadoutError(LOADOUT_CODES.DISPOSED, 'Loadout composer disposed'));
    }
    return new Promise((resolve, reject) => {
      const id = ++sequence;
      pending.set(id, { resolve, reject });
      try {
        worker.postMessage({ id, ...data }, transfer);
      } catch (error) {
        pending.delete(id);
        reject(error);
      }
    });
  }

  function failAll(reason) {
    const err = reconstructError(reason);
    for (const job of pending.values()) job.reject(err);
    pending.clear();
  }

  function dispose(reason = loadoutError(LOADOUT_CODES.DISPOSED, 'Loadout composer disposed')) {
    if (stopped) return;
    stopped = true;
    worker.terminate();
    failAll(reason);
  }

  const onMessage = (data) => {
    const job = pending.get(data?.id);
    if (!job) return;
    pending.delete(data.id);
    if (data.error) job.reject(reconstructError(data.error));
    else job.resolve(data.result);
  };
  const onFail = (event) => dispose(loadoutError(
    LOADOUT_CODES.STAGING_FAILED,
    event?.message || event?.toString?.() || 'Loadout worker failed',
  ));
  if (typeof worker.on === 'function') {
    worker.on('message', onMessage);
    worker.on('error', onFail);
    worker.on('messageerror', () => onFail(new Error('Loadout worker returned an unreadable message')));
  } else {
    worker.onmessage = (event) => onMessage(event.data);
    worker.onerror = onFail;
    worker.onmessageerror = () => onFail(new Error('Loadout worker returned an unreadable message'));
  }

  const workerCanonical = cloneArrayBuffer(canonicalBuffer);
  const ready = request(
    { type: 'init', canonical: workerCanonical, manifest, profileId },
    [workerCanonical],
  );

  async function fitsFor(loadout) {
    const fits = {};
    const transfer = [];
    const itemIds = [];
    for (const itemId of neededItemIds(loadout)) {
      if (postedFits.has(itemId)) continue;
      const variant = manifest?.items?.[itemId]?.variants?.[profileId];
      if (!variant) {
        throw loadoutError(LOADOUT_CODES.MISSING_FIT, `MISSING_FIT: no variant for ${itemId} on ${profileId}`);
      }
      const buffer = cloneArrayBuffer(await fitLoader(itemId, variant));
      fits[itemId] = buffer;
      transfer.push(buffer);
      itemIds.push(itemId);
    }
    return { fits, transfer, itemIds };
  }

  async function composeNow(loadout) {
    await ready;
    const selection = cloneLoadout(loadout);
    const { fits, transfer, itemIds } = await fitsFor(selection);
    try {
      const result = await request({ type: 'compose', loadout: selection, fits }, transfer);
      for (const itemId of itemIds) postedFits.add(itemId);
      return result;
    } catch (error) {
      for (const itemId of neededItemIds(selection)) postedFits.delete(itemId);
      throw error;
    }
  }

  return {
    get canonicalBuffer() {
      return canonicalBuffer;
    },
    get profileId() {
      return profileId;
    },
    get postedFitIds() {
      return [...postedFits];
    },
    compose(loadout) {
      const run = composeChain.then(() => composeNow(loadout), () => composeNow(loadout));
      composeChain = run.then(() => undefined, () => undefined);
      return run;
    },
    dispose,
  };
}
