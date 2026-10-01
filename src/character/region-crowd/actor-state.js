/** Pure logical actor state for later exact/VAT render adapters.
 * Identity, appearance revision and the motion clock are keyed by a stable actor
 * ID. Never key them by a movable pool slot.
 *
 * Native bake includes the terminal frame: frameCount = round(duration*fps)+1.
 * https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/packages/babylon-lite/src/vat/vat-baker.ts
 *
 * Native VAT wraps the inclusive row interval (span = end - from + 1). The
 * default play interval is therefore the full baked frameCount, and wrapping
 * that extra terminal row drifts one frame per loop against the exact mixer,
 * which wraps at clip.duration.
 * https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/packages/babylon-lite/src/material/pbr/fragments/vat-fragment.ts
 * https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/packages/babylon-lite/src/skeleton/skeleton-updater.ts
 *
 * Loop sampling uses unique frames (frameCount − 1) as the VAT span so exact
 * goToFrame and native VAT stay on the same atlas rows across many loops.
 * Exact currentTime uses an explicit source duration when provided. Source
 * duration and native atlas timing can differ by quantization; this module
 * does not claim continuous-motion equality in that case.
 *
 * VAT params follow the native convention: from/end are atlas rows, offset is
 * frames, fps is Hz, and the shared shader clock is seconds. A not-yet-started
 * or ended non-looping action freezes a single-row interval at fps = 0.
 * https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/packages/babylon-lite/src/animation/animation-group.ts
 */
import {assertPlainRecord, validateAppearance} from '../appearance/contract.js';
import {actorPhaseSeconds} from '../crowd-probe/batches.js';

const trustedActors=new WeakSet();
const ACTOR_FIELDS = ['id', 'recipe', 'transform', 'motion', 'appearanceRevision'];
const TRANSFORM_FIELDS = ['x', 'y', 'z', 'yaw'];
const MOTION_FIELDS = ['clip', 'loop', 'startedAt', 'offsetSeconds'];
const CLIP_FIELDS = ['fromRow', 'frameCount', 'fps', 'duration'];

export class RegionActorError extends Error {
  constructor(code, path, message) {
    super(`${message} at ${path}`);
    this.name = 'RegionActorError';
    this.code = code;
    this.path = path;
  }
}

const fail = (code, path, message) => { throw new RegionActorError(code, path, message); };

function ownKeys(value, path) {
  assertPlainRecord(value, path);
  return Object.keys(value);
}

function rejectUnknown(value, allowed, path) {
  for (const key of ownKeys(value, path)) {
    if (!allowed.includes(key)) fail('UNKNOWN_FIELD', `${path}.${key}`, 'Unsupported field');
  }
}

function requireFields(value, required, path) {
  for (const key of required) {
    if (!Object.hasOwn(value, key)) fail('MISSING_FIELD', `${path}.${key}`, 'Required field is missing');
  }
}

function nonemptyString(value, path) {
  if (typeof value !== 'string' || value.length === 0) fail('INVALID_TYPE', path, 'Expected a nonempty string');
  return value;
}

function finiteNumber(value, path) {
  if (typeof value !== 'number' || !Number.isFinite(value)) fail('INVALID_VALUE', path, 'Expected a finite number');
  return value;
}

function positiveInt(value, path) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) {
    fail('INVALID_VALUE', path, 'Expected a positive integer');
  }
  return value;
}

function booleanValue(value, path) {
  if (typeof value !== 'boolean') fail('INVALID_TYPE', path, 'Expected a boolean');
  return value;
}

/** Euclidean wrap into [0, period). Matches native vatFrameRow for a positive span. */
function wrapUnit(value, period) {
  const wrapped = value - Math.floor(value / period) * period;
  return wrapped === 0 ? 0 : wrapped;
}

function readTransform(input, path) {
  if (input == null || typeof input !== 'object') fail('INVALID_TYPE', path, 'Expected a transform');
  rejectUnknown(input, TRANSFORM_FIELDS, path);
  requireFields(input, TRANSFORM_FIELDS, path);
  return Object.freeze({
    x: finiteNumber(input.x, `${path}.x`),
    y: finiteNumber(input.y, `${path}.y`),
    z: finiteNumber(input.z, `${path}.z`),
    yaw: finiteNumber(input.yaw, `${path}.yaw`),
  });
}

function readMotion(input, path, id, defaults) {
  if (input == null || typeof input !== 'object') fail('INVALID_TYPE', path, 'Expected motion');
  rejectUnknown(input, MOTION_FIELDS, path);
  requireFields(input, ['clip', 'loop'], path);
  const clip = nonemptyString(input.clip, `${path}.clip`);
  const loop = booleanValue(input.loop, `${path}.loop`);
  const startedAt = Object.hasOwn(input, 'startedAt')
    ? finiteNumber(input.startedAt, `${path}.startedAt`)
    : defaults ? 0 : fail('MISSING_FIELD', `${path}.startedAt`, 'Required field is missing');
  const offsetSeconds = Object.hasOwn(input, 'offsetSeconds')
    ? finiteNumber(input.offsetSeconds, `${path}.offsetSeconds`)
    : defaults ? actorPhaseSeconds(id) : fail('MISSING_FIELD', `${path}.offsetSeconds`, 'Required field is missing');
  return Object.freeze({clip, loop, startedAt, offsetSeconds});
}

function freezeActor({id, appearanceRevision, recipe, transform, motion}) {
  const snapshot=Object.freeze({id, appearanceRevision, recipe, transform, motion});
  trustedActors.add(snapshot);return snapshot;
}

function readActor(actor) {
  if(trustedActors.has(actor))return actor;
  rejectUnknown(actor,ACTOR_FIELDS,'actor');
  requireFields(actor,ACTOR_FIELDS,'actor');
  if (actor == null || typeof actor !== 'object' || Array.isArray(actor)) {
    fail('INVALID_TYPE', 'actor', 'Expected an actor snapshot');
  }
  const id = nonemptyString(actor.id, 'actor.id');
  const appearanceRevision = positiveInt(actor.appearanceRevision, 'actor.appearanceRevision');
  if (actor.recipe == null || typeof actor.recipe !== 'object') fail('INVALID_TYPE', 'actor.recipe', 'Expected a recipe');
  const transform = readTransform(actor.transform, 'actor.transform');
  const motion = readMotion(actor.motion, 'actor.motion', id, false);
  return {id, appearanceRevision, recipe: validateAppearance(actor.recipe), transform, motion};
}

/**
 * Native clip record plus optional source duration.
 * Loop unique frames drop the duplicate terminal row. A one-row atlas stays one row.
 */
export function readClipMetadata(clips, name, path = 'clips') {
  if (clips == null || typeof clips !== 'object' || Array.isArray(clips) || Object.getPrototypeOf(clips) !== Object.prototype) {
    fail('INVALID_TYPE', path, 'Expected a plain clip map');
  }
  nonemptyString(name, `${path} name`);
  if (!Object.hasOwn(clips, name)) fail('UNKNOWN_CLIP', `${path}.${name}`, 'Unknown clip');
  const clip = clips[name];
  if (clip == null || typeof clip !== 'object') fail('INVALID_CLIP', `${path}.${name}`, 'Expected clip metadata');
  rejectUnknown(clip, CLIP_FIELDS, `${path}.${name}`);
  requireFields(clip, ['fromRow', 'frameCount', 'fps'], `${path}.${name}`);
  const fromRow = clip.fromRow;
  const frameCount = clip.frameCount;
  const fps = clip.fps;
  if (typeof fromRow !== 'number' || !Number.isSafeInteger(fromRow) || fromRow < 0) {
    fail('INVALID_CLIP', `${path}.${name}.fromRow`, 'Expected a nonnegative integer row');
  }
  if (typeof frameCount !== 'number' || !Number.isSafeInteger(frameCount) || frameCount < 1) {
    fail('INVALID_CLIP', `${path}.${name}.frameCount`, 'Expected a positive integer frame count');
  }
  if (fromRow + frameCount > Number.MAX_SAFE_INTEGER) {
    fail('OUT_OF_RANGE', `${path}.${name}.frameCount`, 'Clip rows exceed a safe integer atlas');
  }
  if (typeof fps !== 'number' || !Number.isFinite(fps) || fps <= 0) {
    fail('INVALID_CLIP', `${path}.${name}.fps`, 'Expected a finite fps greater than 0');
  }
  let duration = null;
  if (Object.hasOwn(clip, 'duration')) {
    duration = finiteNumber(clip.duration, `${path}.${name}.duration`);
    if (duration <= 0) fail('OUT_OF_RANGE', `${path}.${name}.duration`, 'Source duration must be greater than 0');
  }
  const cycleFrames = Math.max(1, frameCount - 1);
  const lastFrame = frameCount - 1;
  return Object.freeze({
    name, fromRow, frameCount, fps, duration, cycleFrames, lastFrame,
    nativeLoopPeriod: cycleFrames / fps,
    nativeActionPeriod: lastFrame / fps,
  });
}

function sourcePeriod(clip, loop) {
  const native = loop ? clip.nativeLoopPeriod : clip.nativeActionPeriod;
  return clip.duration ?? native;
}

function clipTime(clip, loop, clipLocal, ended) {
  const period = sourcePeriod(clip, loop);
  if (loop) {
    const periodOrNative = period > 0 ? period : clip.nativeLoopPeriod;
    return {timeSeconds: wrapUnit(clipLocal, periodOrNative), period: periodOrNative};
  }
  if (period <= 0) return {timeSeconds: 0, period: 0};
  if (ended) return {timeSeconds: period, period};
  return {timeSeconds: Math.min(Math.max(clipLocal, 0), period), period};
}

function frameFromLocal(clip, loop, clipLocal, ended) {
  if (!loop) {
    if (ended) return clip.lastFrame;
    if (clipLocal <= 0) return 0;
    return Math.min(clip.lastFrame, Math.max(0, Math.floor(clipLocal * clip.fps)));
  }
  const wrapped = wrapUnit(clipLocal * clip.fps, clip.cycleFrames);
  return Math.min(clip.cycleFrames - 1, Math.max(0, Math.floor(wrapped)));
}

/** Playing frames use the native shader clock: row = from + (offset + t*fps) mod span. */
function playingFrame(clip, motion, now) {
  const span = motion.loop ? clip.cycleFrames : clip.frameCount;
  const frameOffset = (motion.offsetSeconds - motion.startedAt) * clip.fps;
  const wrapped = wrapUnit(frameOffset + now * clip.fps, span);
  return {
    frameOffset,
    span,
    frame: Math.min(span - 1, Math.max(0, Math.floor(wrapped))),
  };
}

function actionEnded(clip, motion, started, clipLocal, raw) {
  const period = sourcePeriod(clip, false);
  const local = started ? clipLocal : motion.offsetSeconds;
  if (period <= 0) return started || local >= 0;
  return local >= period || (started && raw >= clip.lastFrame);
}

function evaluate(actor, nowSeconds, clips) {
  const motion = actor.motion;
  const clip = readClipMetadata(clips, motion.clip);
  const now = finiteNumber(nowSeconds, 'nowSeconds');
  const started = now >= motion.startedAt;
  const elapsed = started ? now - motion.startedAt : 0;
  const clipLocal = elapsed + motion.offsetSeconds;
  const playing = playingFrame(clip, motion, now);
  const raw = playing.frameOffset + now * clip.fps;
  const ended = motion.loop ? false : actionEnded(clip, motion, started, clipLocal, raw);
  const freeze = !started || (!motion.loop && (ended || clipLocal < 0));
  const timed = clipTime(clip, motion.loop, clipLocal, ended);
  const frame = freeze
    ? frameFromLocal(clip, motion.loop, started ? clipLocal : motion.offsetSeconds, ended)
    : playing.frame;
  const row = clip.fromRow + frame;
  const phase = timed.period > 0 ? (ended ? 1 : timed.timeSeconds / timed.period) : 0;
  const vat = freeze
    ? Object.freeze({from: row, end: row, frameOffset: 0, fps: 0})
    : Object.freeze({
      from: clip.fromRow,
      end: clip.fromRow + playing.span - 1,
      frameOffset: playing.frameOffset,
      fps: clip.fps,
    });
  const sample = Object.freeze({
    clip: clip.name,
    loop: motion.loop,
    timeSeconds: timed.timeSeconds,
    frame,
    row,
    ended,
    phase,
  });
  return {sample, vat};
}

export function createRegionActor(input) {
  if (input == null || typeof input !== 'object') fail('INVALID_TYPE', '$', 'Expected a plain actor record');
  rejectUnknown(input, ACTOR_FIELDS, '$');
  requireFields(input, ['id', 'recipe', 'transform', 'motion'], '$');
  const id = nonemptyString(input.id, '$.id');
  const appearanceRevision = Object.hasOwn(input, 'appearanceRevision')
    ? positiveInt(input.appearanceRevision, '$.appearanceRevision')
    : 1;
  return freezeActor({
    id,
    appearanceRevision,
    recipe: validateAppearance(input.recipe),
    transform: readTransform(input.transform, '$.transform'),
    motion: readMotion(input.motion, '$.motion', id, true),
  });
}

export function replaceActorAppearance(actor, recipe, revision) {
  const current = readActor(actor);
  if (typeof revision !== 'number' || !Number.isSafeInteger(revision)) {
    fail('INVALID_VALUE', 'revision', 'Expected a positive integer');
  }
  if (revision <= current.appearanceRevision) fail('STALE_REVISION', 'revision', 'Appearance revision must increase');
  return freezeActor({
    id: current.id,
    appearanceRevision: revision,
    recipe: validateAppearance(recipe),
    transform: current.transform,
    motion: current.motion,
  });
}

export function setActorMotion(actor, motion) {
  const current = readActor(actor);
  return freezeActor({
    id: current.id,
    appearanceRevision: current.appearanceRevision,
    recipe: validateAppearance(current.recipe),
    transform: current.transform,
    motion: readMotion(motion, 'motion', current.id, true),
  });
}

export function sampleActorMotion(actor, nowSeconds, clips) {
  return evaluate(readActor(actor), nowSeconds, clips).sample;
}

export function actorVatParams(actor, nowSeconds, clips) {
  return evaluate(readActor(actor), nowSeconds, clips).vat;
}

/** Position changes share the same ID, revision and action clock. */
export function setActorTransform(actor, transform) {
  const current=readActor(actor);
  return freezeActor({...current,transform:readTransform(transform,'transform')});
}
