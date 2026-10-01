import test from 'node:test';
import assert from 'node:assert/strict';
import {EQUIPMENT_PRESETS} from '../src/ashen-reach/equipment-catalog.js';
import {AppearanceError, validateAppearance} from '../src/character/appearance/contract.js';
import {appearanceFromEquipment} from '../src/character/appearance/from-equipment.js';
import {actorPhaseSeconds} from '../src/character/crowd-probe/batches.js';
import {
  RegionActorError, actorVatParams, createRegionActor, readClipMetadata,
  replaceActorAppearance, sampleActorMotion, setActorMotion,setActorTransform,
} from '../src/character/region-crowd/actor-state.js';

const wayfarer = () => appearanceFromEquipment({race: 'human', loadout: EQUIPMENT_PRESETS.wayfarer.loadout});
const warden = () => appearanceFromEquipment({race: 'human', loadout: EQUIPMENT_PRESETS.warden.loadout});
const orc = () => appearanceFromEquipment({race: 'orc', loadout: EQUIPMENT_PRESETS.wayfarer.loadout});
const nativeClip = (fromRow, duration, fps) => ({
  fromRow, frameCount: Math.round(duration * fps) + 1, fps, duration,
});
const clips = Object.freeze({
  Idle_Loop: nativeClip(0, 1, 30),
  Walk_Loop: nativeClip(31, 1, 30),
  Sprint_Loop: nativeClip(62, 1, 24),
  Spell_Simple_Enter: nativeClip(87, 0.8, 30),
  Jump_Land: nativeClip(112, 0.42, 60),
});
const origin = Object.freeze({x: 3, y: 1.2, z: -8, yaw: 0.4});
const actorOf = (id, extras = {}) => createRegionActor({
  id, recipe: extras.recipe ?? wayfarer(), transform: extras.transform ?? origin,
  ...(extras.appearanceRevision === undefined ? {} : {appearanceRevision: extras.appearanceRevision}),
  motion: extras.motion ?? {clip: 'Idle_Loop', loop: true, startedAt: 0, offsetSeconds: 0},
});
const code = (fn, expected) => assert.throws(fn, (error) => error instanceof RegionActorError && error.code === expected);

/** Native vatFrameRow: span = end-from+1, offset is frames, clock is seconds. */
function vatRow(params, now) {
  const span = Math.max(1, params.end - params.from + 1);
  const raw = params.frameOffset + now * params.fps;
  const wrapped = raw - Math.floor(raw / span) * span;
  return (params.from + wrapped) | 0;
}

test('stable identity and monotonically increasing appearance revision', () => {
  const actor = actorOf('region-7', {appearanceRevision: 4});
  assert.equal(actor.id, 'region-7');
  assert.equal(actor.appearanceRevision, 4);
  assert.deepEqual(actor.recipe, wayfarer());
  assert.deepEqual(actor.transform, origin);
  const dressed = replaceActorAppearance(actor, warden(), 9);
  assert.equal(dressed.id, 'region-7');
  assert.equal(dressed.appearanceRevision, 9);
  assert.deepEqual(dressed.recipe, warden());
  assert.equal(actor.appearanceRevision, 4);
  assert.deepEqual(actor.recipe, wayfarer());
  code(() => replaceActorAppearance(dressed, wayfarer(), 9), 'STALE_REVISION');
  code(() => replaceActorAppearance(dressed, wayfarer(), 3), 'STALE_REVISION');
  code(() => replaceActorAppearance(dressed, wayfarer(), 9.5), 'INVALID_VALUE');
});

test('appearance change preserves transform and motion; snapshots drop caller references', () => {
  const transform = {x: 10, y: 0, z: 2, yaw: -1.2};
  const recipe = structuredClone(wayfarer());
  const motion = {clip: 'Walk_Loop', loop: true, startedAt: 5, offsetSeconds: 0.2};
  const actor = createRegionActor({id: 'keep', recipe, transform, motion});
  transform.x = 99;
  recipe.race = 'orc';
  motion.clip = 'Idle_Loop';
  assert.equal(actor.transform.x, 10);
  assert.equal(actor.recipe.race, 'human');
  assert.equal(actor.motion.clip, 'Walk_Loop');
  const next = replaceActorAppearance(actor, orc(), 2);
  assert.equal(next.id, 'keep');
  assert.deepEqual(next.transform, {x: 10, y: 0, z: 2, yaw: -1.2});
  assert.deepEqual(next.motion, {clip: 'Walk_Loop', loop: true, startedAt: 5, offsetSeconds: 0.2});
  assert.equal(next.recipe.race, 'orc');
  const walked = sampleActorMotion(next, 5.2, clips);
  const params = actorVatParams(next, 5.2, clips);
  assert.equal(walked.clip, 'Walk_Loop');
  assert.equal(walked.frame, 12);
  assert.equal(vatRow(params, 5.2), walked.row);
  assert.throws(() => { next.transform.x = 0; }, TypeError);
});

test('identity seeds default phase and never uses a pool slot', () => {
  const a = createRegionActor({id: 'alpha', recipe: wayfarer(), transform: origin, motion: {clip: 'Idle_Loop', loop: true}});
  const b = createRegionActor({id: 'beta', recipe: wayfarer(), transform: origin, motion: {clip: 'Idle_Loop', loop: true}});
  assert.equal(a.appearanceRevision, 1);
  assert.equal(a.motion.offsetSeconds, actorPhaseSeconds('alpha'));
  assert.equal(b.motion.offsetSeconds, actorPhaseSeconds('beta'));
  assert.notEqual(a.motion.offsetSeconds, b.motion.offsetSeconds);
  const slot = createRegionActor({
    id: 'alpha', recipe: wayfarer(), transform: {x: 50, y: 0, z: 50, yaw: 0},
    motion: {clip: 'Idle_Loop', loop: true},
  });
  assert.equal(slot.motion.offsetSeconds, a.motion.offsetSeconds);
  const sampled = sampleActorMotion(a, 0, clips);
  assert.ok(sampled.timeSeconds >= 0 && sampled.timeSeconds < 1);
  assert.equal(vatRow(actorVatParams(a, 0, clips), 0), sampled.row);
});

test('matched loop and native VAT rows over many loops, including endpoints', () => {
  const idle = actorOf('loop', {motion: {clip: 'Idle_Loop', loop: true, startedAt: 0, offsetSeconds: 0}});
  const walk = setActorMotion(idle, {clip: 'Walk_Loop', loop: true, startedAt: 4, offsetSeconds: 0});
  for (const n of [0, 1, 2, 10, 100, 1000, 4096]) {
    for (const frac of [0, 0.5, 7 / 30]) {
      const now = n + frac;
      const sample = sampleActorMotion(idle, now, clips);
      const params = actorVatParams(idle, now, clips);
      const expected = frac === 0 ? 0 : frac === 0.5 ? 15 : 7;
      assert.equal(sample.ended, false);
      assert.equal(sample.frame, expected, `idle frame at ${now}`);
      assert.equal(sample.row, clips.Idle_Loop.fromRow + expected);
      assert.equal(params.end - params.from + 1, clips.Idle_Loop.frameCount - 1);
      assert.equal(vatRow(params, now), sample.row, `idle VAT at ${now}`);
      assert.ok(Math.abs(sample.timeSeconds - frac) < 1e-12, `idle time at ${now}`);
    }
    const atWalk = 4 + n + 0.5;
    const walking = sampleActorMotion(walk, atWalk, clips);
    assert.equal(walking.clip, 'Walk_Loop');
    assert.equal(walking.frame, 15);
    assert.equal(vatRow(actorVatParams(walk, atWalk, clips), atWalk), walking.row);
  }
  const meta = readClipMetadata(clips, 'Idle_Loop');
  assert.equal(meta.frameCount, 31);
  assert.equal(meta.cycleFrames, 30);
});

test('non-looping action midpoint, end and terminal hold', () => {
  const actor = actorOf('cast', {motion: {clip: 'Spell_Simple_Enter', loop: false, startedAt: 2, offsetSeconds: 0}});
  const midAt = 2.5;
  const mid = sampleActorMotion(actor, midAt, clips);
  assert.equal(mid.ended, false);
  assert.equal(mid.frame, 15);
  assert.equal(mid.timeSeconds, 0.5);
  assert.equal(vatRow(actorVatParams(actor, midAt, clips), midAt), mid.row);
  const endAt = 2.8;
  const end = sampleActorMotion(actor, endAt, clips);
  assert.equal(end.ended, true);
  assert.equal(end.frame, clips.Spell_Simple_Enter.frameCount - 1);
  assert.equal(end.timeSeconds, 0.8);
  assert.equal(end.phase, 1);
  const holdAt = 12;
  const hold = sampleActorMotion(actor, holdAt, clips);
  const frozen = actorVatParams(actor, holdAt, clips);
  assert.equal(hold.ended, true);
  assert.equal(hold.frame, end.frame);
  assert.equal(hold.row, end.row);
  assert.deepEqual(frozen, {from: end.row, end: end.row, frameOffset: 0, fps: 0});
  assert.equal(vatRow(frozen, holdAt), hold.row);
  const playing = actorVatParams(actor, midAt, clips);
  assert.equal(playing.end - playing.from + 1, clips.Spell_Simple_Enter.frameCount);
  assert.equal(playing.fps, 30);
});

test('different clip fps keep native unique-frame wrap', () => {
  const sprint = actorOf('fps', {motion: {clip: 'Sprint_Loop', loop: true, startedAt: 0, offsetSeconds: 0}});
  const land = setActorMotion(sprint, {clip: 'Jump_Land', loop: false, startedAt: 0, offsetSeconds: 0});
  const atSprint = 12.5;
  const sprinted = sampleActorMotion(sprint, atSprint, clips);
  assert.equal(sprinted.frame, 12);
  assert.equal(readClipMetadata(clips, 'Sprint_Loop').frameCount, 25);
  assert.equal(actorVatParams(sprint, atSprint, clips).end - clips.Sprint_Loop.fromRow + 1, 24);
  assert.equal(vatRow(actorVatParams(sprint, atSprint, clips), atSprint), sprinted.row);
  const midLand = sampleActorMotion(land, 0.21, clips);
  assert.equal(midLand.ended, false);
  assert.equal(midLand.frame, 12);
  const done = sampleActorMotion(land, 0.42, clips);
  assert.equal(done.ended, true);
  assert.equal(done.frame, clips.Jump_Land.frameCount - 1);
  assert.equal(vatRow(actorVatParams(land, 3, clips), 3), done.row);
});

test('pause holds the sampled pose; future timestamps stay on the start pose', () => {
  const paused = actorOf('hold', {motion: {clip: 'Walk_Loop', loop: true, startedAt: 1, offsetSeconds: 0.2}});
  const now = 1.4;
  const first = sampleActorMotion(paused, now, clips);
  const again = sampleActorMotion(paused, now, clips);
  assert.deepEqual(again, first);
  assert.equal(vatRow(actorVatParams(paused, now, clips), now), first.row);
  const pending = actorOf('later', {motion: {clip: 'Idle_Loop', loop: true, startedAt: 8, offsetSeconds: 0.25}});
  const before = sampleActorMotion(pending, 3, clips);
  const atStart = sampleActorMotion(pending, 8, clips);
  assert.equal(before.frame, atStart.frame);
  assert.equal(before.timeSeconds, atStart.timeSeconds);
  assert.deepEqual(actorVatParams(pending, 3, clips), {
    from: atStart.row, end: atStart.row, frameOffset: 0, fps: 0,
  });
  const action = actorOf('windup', {motion: {clip: 'Spell_Simple_Enter', loop: false, startedAt: 5, offsetSeconds: 0}});
  const early = sampleActorMotion(action, 1, clips);
  assert.equal(early.ended, false);
  assert.equal(early.frame, 0);
  assert.equal(actorVatParams(action, 1, clips).fps, 0);
});

test('negative wrapped loop phase and loop endpoints', () => {
  const actor = actorOf('wrap', {motion: {clip: 'Idle_Loop', loop: true, startedAt: 0, offsetSeconds: -0.25}});
  const sample = sampleActorMotion(actor, 0, clips);
  assert.equal(sample.timeSeconds, 0.75);
  assert.equal(sample.frame, 22);
  assert.equal(vatRow(actorVatParams(actor, 0, clips), 0), sample.row);
  const end = sampleActorMotion(actorOf('end', {motion: {clip: 'Idle_Loop', loop: true, startedAt: 0, offsetSeconds: 0}}), 3, clips);
  assert.equal(end.timeSeconds, 0);
  assert.equal(end.frame, 0);
  assert.equal(end.phase, 0);
});

test('malformed actor, clock and clip metadata fail closed', () => {
  code(() => createRegionActor({id: '', recipe: wayfarer(), transform: origin, motion: {clip: 'Idle_Loop', loop: true}}), 'INVALID_TYPE');
  code(() => actorOf('bad', {transform: {x: 1, y: 2, z: Infinity, yaw: 0}}), 'INVALID_VALUE');
  code(() => actorOf('bad', {motion: {clip: 'Idle_Loop', loop: 'yes'}}), 'INVALID_TYPE');
  code(() => sampleActorMotion(actorOf('a'), Infinity, clips), 'INVALID_VALUE');
  code(() => sampleActorMotion(actorOf('a'), 0, {Walk_Loop: clips.Walk_Loop}), 'UNKNOWN_CLIP');
  const idle = actorOf('a');
  code(() => sampleActorMotion(idle, 0, {Idle_Loop: {fromRow: 0, frameCount: 0, fps: 30}}), 'INVALID_CLIP');
  code(() => sampleActorMotion(idle, 0, {Idle_Loop: {fromRow: -1, frameCount: 8, fps: 30}}), 'INVALID_CLIP');
  code(() => sampleActorMotion(idle, 0, {Idle_Loop: {fromRow: 0, frameCount: 8, fps: 0}}), 'INVALID_CLIP');
  code(() => sampleActorMotion(idle, 0, {Idle_Loop: {fromRow: 1.5, frameCount: 8, fps: 30}}), 'INVALID_CLIP');
  code(() => sampleActorMotion(idle, 0, {Idle_Loop: {fromRow: 0, frameCount: 8, fps: 30, duration: -1}}), 'OUT_OF_RANGE');
  code(() => sampleActorMotion(idle, 0, {Idle_Loop: {fromRow: 0, frameCount: 8, fps: NaN}}), 'INVALID_CLIP');
  code(() => sampleActorMotion(idle, 0, null), 'INVALID_TYPE');
  code(() => setActorMotion(idle, {clip: '', loop: true}), 'INVALID_TYPE');
  assert.throws(() => createRegionActor({id: 'x', recipe: {race: 'elf'}, transform: origin, motion: {clip: 'Idle_Loop', loop: true}}), AppearanceError);
  const frozen = validateAppearance(wayfarer());
  assert.deepEqual(idle.recipe, frozen);
});

test('transform updates preserve identity, revision and shared motion',()=>{
 const a=actorOf('move'),b=setActorTransform(a,{x:-2,y:0,z:4,yaw:1.2});
 assert.equal(b.id,a.id);assert.equal(b.appearanceRevision,a.appearanceRevision);
 assert.deepEqual(b.motion,a.motion);assert.deepEqual(a.transform,origin);
 code(()=>setActorTransform(a,{x:0,y:0,z:NaN,yaw:0}),'INVALID_VALUE');
});

test('foreign actor records reject accessors before reading them',()=>{
 let reads=0;const a={...actorOf('untrusted')};Object.defineProperty(a,'id',{enumerable:true,get(){reads++;return 'unsafe';}});
 assert.throws(()=>sampleActorMotion(a,0,clips),AppearanceError);assert.equal(reads,0);
});
