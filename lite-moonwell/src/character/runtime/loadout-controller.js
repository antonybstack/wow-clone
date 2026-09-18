/**
 * Race-safe skinned loadout requests. Scene/Babylon stay in the caller.
 * Newest request wins; failed or superseded work never overwrites the live outfit.
 */
import { LOADOUT_SLOTS } from './compose-loadout.js';
import { FIT_CODES, fitError } from './fit-contract.js';
import { ITEM_TO_COMPONENT, STARTER_ITEMS } from './garment-catalog.js';

export const LOADOUT_CODES = Object.freeze({
  ...FIT_CODES,
  UNSUPPORTED_BODY: 'UNSUPPORTED_BODY',
  STAGING_FAILED: 'STAGING_FAILED',
  COMMIT_FAILED: 'COMMIT_FAILED',
  MISSING_HAND: 'MISSING_HAND',
  DISPOSED: 'DISPOSED',
});

export const LOADOUT_STATUS = Object.freeze({
  applied: 'applied',
  superseded: 'superseded',
  failed: 'failed',
  unchanged: 'unchanged',
});

export const STARTER_SKINNED_LOADOUT = Object.freeze({
  chest: 'starterShirt',
  legs: 'starterTrousers',
  feet: 'starterBoots',
});

export const EMPTY_SKINNED_LOADOUT = Object.freeze({
  chest: null,
  legs: null,
  feet: null,
});
export const MAGE_SKINNED_LOADOUT = Object.freeze({chest:'mageCoat',legs:'starterTrousers',feet:'mageBoots'});

export function loadoutError(code, message) {
  return fitError(code, message);
}

export function cloneLoadout(loadout) {
  return {
    chest: loadout?.chest ?? null,
    legs: loadout?.legs ?? null,
    feet: loadout?.feet ?? null,
  };
}

export function loadoutEqual(a, b) {
  if (!a || !b) return false;
  return a.chest === b.chest && a.legs === b.legs && a.feet === b.feet;
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

/**
 * Complete chest/legs/feet selection. Missing keys are invalid; null/'' is empty.
 * @param {object} loadout
 */
export function normalizeCompleteLoadout(loadout) {
  if (!loadout || typeof loadout !== 'object' || Array.isArray(loadout)) {
    throw loadoutError(LOADOUT_CODES.INVALID_LOADOUT, 'INVALID_LOADOUT: expected {chest,legs,feet}');
  }
  for (const key of Object.keys(loadout)) {
    if (!LOADOUT_SLOTS.includes(key)) {
      throw loadoutError(LOADOUT_CODES.INVALID_LOADOUT, `INVALID_LOADOUT: unknown slot ${key}`);
    }
  }
  for (const slot of LOADOUT_SLOTS) {
    if (!hasOwn(loadout, slot)) {
      throw loadoutError(LOADOUT_CODES.INVALID_LOADOUT, `INVALID_LOADOUT: missing slot ${slot}`);
    }
  }
  const worn = { chest: null, legs: null, feet: null };
  for (const slot of LOADOUT_SLOTS) {
    const itemId = loadout[slot];
    if (itemId == null || itemId === '') {
      worn[slot] = null;
      continue;
    }
    if (typeof itemId !== 'string') {
      throw loadoutError(LOADOUT_CODES.INVALID_LOADOUT, `INVALID_LOADOUT: ${slot} item must be a string or null`);
    }
    const item = STARTER_ITEMS[itemId];
    if (!item) {
      throw loadoutError(LOADOUT_CODES.UNKNOWN_ITEM, `UNKNOWN_ITEM: ${itemId}`);
    }
    if (item.slot !== slot) {
      throw loadoutError(
        LOADOUT_CODES.INVALID_LOADOUT,
        `INVALID_LOADOUT: ${itemId} occupies ${item.slot}, not ${slot}`,
      );
    }
    worn[slot] = itemId;
  }
  return worn;
}

export function outfitKindForLoadout(loadout) {
  if (loadoutEqual(loadout, MAGE_SKINNED_LOADOUT)) return 'mage';
  if (loadoutEqual(loadout, STARTER_SKINNED_LOADOUT)) return 'starter';
  if (loadoutEqual(loadout, EMPTY_SKINNED_LOADOUT)) return 'body';
  return 'mixed';
}

/**
 * Honest HUD/capture fields on top of composeLoadout's manifest.
 * `id` is the existing shirt/trousers/boots component name, not a fake item id.
 */
export function decorateOutfitManifest(composedManifest, loadout) {
  const worn = cloneLoadout(loadout);
  const components = (composedManifest?.components || []).map((c) => ({
    ...c,
    id: ITEM_TO_COMPONENT[c.itemId] || c.itemId,
  }));
  return {
    ...composedManifest,
    loadout: worn,
    components,
    outfit: outfitKindForLoadout(worn),
  };
}

function errorPayload(error, fallbackCode = LOADOUT_CODES.STAGING_FAILED) {
  if (!error) {
    return { code: fallbackCode, message: String(fallbackCode) };
  }
  if (typeof error === 'object' && error.code && error.message) {
    return { code: error.code, message: error.message };
  }
  const err = error instanceof Error ? error : new Error(String(error));
  return { code: err.code || fallbackCode, message: err.message || String(error) };
}

function outcome(status, requestId, loadout, extra = {}) {
  return {
    status,
    requestId,
    loadout: cloneLoadout(loadout),
    ...extra,
  };
}

/**
 * @param {{
 *   compose: (loadout: object) => Promise<{ buffer: ArrayBuffer|object, manifest: object }>,
 *   loadContainer: (buffer: *, composed: object, loadout: object) => Promise<*>,
 *   prepareCandidate?: (loaded: *, composed: object, loadout: object) => Promise<*>,
 *   disposeCandidate: (candidate: *) => void,
 *   waitCommit?: (fn: () => object) => Promise<object>,
 *   commit: (candidate: *, meta: object) => void,
 *   getCurrentLoadout?: () => object|null,
 * }} opts
 */
export function createLoadoutController(opts) {
  const compose = opts.compose;
  const loadContainer = opts.loadContainer;
  const prepareCandidate = opts.prepareCandidate || (async (loaded) => loaded);
  const disposeCandidate = opts.disposeCandidate;
  const waitCommit = opts.waitCommit || ((fn) => Promise.resolve(fn()));
  const commit = opts.commit;
  const getCurrentLoadout = opts.getCurrentLoadout || (() => null);

  let sequence = 0;
  let latest = 0;
  let stopped = false;

  const stale = (requestId) => stopped || requestId !== latest;

  const safeDispose = (candidate) => {
    if (candidate == null) return;
    disposeCandidate(candidate);
  };

  return {
    get latestRequestId() {
      return latest;
    },
    async setLoadout(selection) {
      if (stopped) {
        return outcome(LOADOUT_STATUS.failed, latest, EMPTY_SKINNED_LOADOUT, {
          error: errorPayload({ code: LOADOUT_CODES.DISPOSED, message: 'Loadout controller disposed' }),
        });
      }
      let loadout;
      try {
        loadout = normalizeCompleteLoadout(selection);
      } catch (error) {
        return outcome(LOADOUT_STATUS.failed, latest, getCurrentLoadout() || EMPTY_SKINNED_LOADOUT, {
          error: errorPayload(error, LOADOUT_CODES.INVALID_LOADOUT),
        });
      }

      const requestId = ++sequence;
      latest = requestId;

      const current = getCurrentLoadout();
      if (current && loadoutEqual(loadout, current)) {
        return outcome(LOADOUT_STATUS.unchanged, requestId, loadout, {
          supersededBy: null,
        });
      }

      const startedAt = Date.now();
      let loaded = null;
      let candidate = null;
      try {
        const composed = await compose(loadout);
        if (stale(requestId)) {
          return outcome(LOADOUT_STATUS.superseded, requestId, loadout, { supersededBy: latest });
        }
        loaded = await loadContainer(composed.buffer, composed, loadout);
        if (stale(requestId)) {
          safeDispose(loaded);
          return outcome(LOADOUT_STATUS.superseded, requestId, loadout, { supersededBy: latest });
        }
        candidate = await prepareCandidate(loaded, composed, loadout);
        if (stale(requestId)) {
          safeDispose(candidate ?? loaded);
          return outcome(LOADOUT_STATUS.superseded, requestId, loadout, { supersededBy: latest });
        }
        const prepareMs = Date.now() - startedAt;
        return await waitCommit(() => {
          if (stale(requestId)) {
            safeDispose(candidate ?? loaded);
            return outcome(LOADOUT_STATUS.superseded, requestId, loadout, { supersededBy: latest });
          }
          const commitAt = Date.now();
          try {
            commit(candidate, {
              requestId,
              loadout,
              manifest: composed.manifest,
              composed,
            });
            return outcome(LOADOUT_STATUS.applied, requestId, loadout, {
              manifest: composed.manifest,
              timings: { prepareMs, commitMs: Date.now() - commitAt },
            });
          } catch (error) {
            safeDispose(candidate ?? loaded);
            return outcome(LOADOUT_STATUS.failed, requestId, loadout, {
              error: errorPayload(error, LOADOUT_CODES.COMMIT_FAILED),
              timings: { prepareMs, commitMs: Date.now() - commitAt },
            });
          }
        });
      } catch (error) {
        safeDispose(candidate ?? loaded);
        if (stale(requestId)) {
          return outcome(LOADOUT_STATUS.superseded, requestId, loadout, { supersededBy: latest });
        }
        return outcome(LOADOUT_STATUS.failed, requestId, loadout, {
          error: errorPayload(error, LOADOUT_CODES.STAGING_FAILED),
          timings: { prepareMs: Date.now() - startedAt },
        });
      }
    },
    dispose(reason = loadoutError(LOADOUT_CODES.DISPOSED, 'Loadout controller disposed')) {
      if (stopped) return;
      stopped = true;
      latest = ++sequence;
      void reason;
    },
  };
}
