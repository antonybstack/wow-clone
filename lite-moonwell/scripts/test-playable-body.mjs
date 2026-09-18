import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseGlb } from '../src/character/runtime/glb.js';
import {
  AUTHORED_BODY_IDS,
  HUMAN_V1_BODY_ID,
  LEGACY_BODY_ID,
  ORC_V1_BODY_ID,
  PLAYABLE_BODIES,
  UNDEAD_V1_BODY_ID,
  appearancePolicy,
  defaultLoadoutFor,
  deriveLegBoneNames,
  isAuthoredPlayable,
  itemAllowedOnBody,
  resolvePlayableBody,
  resolvePlayableClips,
  usesAdditiveCast,
} from '../src/character/runtime/playable-body.js';

const HUMAN = PLAYABLE_BODIES[HUMAN_V1_BODY_ID];
const LEGACY = PLAYABLE_BODIES[LEGACY_BODY_ID];
const AUTHORED_CLIPS = ['cast', 'idle', 'jumpLand', 'jumpLoop', 'jumpStart', 'run', 'walk'];

test('root default is clothed Human; explicit query escape hatches remain', () => {
  const root = resolvePlayableBody('');
  assert.equal(root.id, HUMAN_V1_BODY_ID);
  assert.equal(root.outfit, 'mage');
  assert.equal(resolvePlayableBody('?').id, HUMAN_V1_BODY_ID);
  assert.equal(resolvePlayableBody('?').outfit, 'mage');
  const human = resolvePlayableBody('?character=human-v1');
  assert.equal(human.id, HUMAN_V1_BODY_ID);
  assert.equal(human.outfit, 'mage');
  assert.equal(human.assetURL, '/characters/bodies/human-animated-v1.glb');
  assert.equal(human.clipMode, 'exact');
  assert.equal(resolvePlayableBody('?character=human-v1&outfit=starter').outfit, 'starter');
  assert.equal(resolvePlayableBody('?character=orc-v1&outfit=mage').outfit, 'starter');
  const bare = resolvePlayableBody('?character=human-v1&outfit=body');
  assert.equal(bare.id, HUMAN_V1_BODY_ID);
  assert.equal(bare.outfit, 'body');
  const legacy = resolvePlayableBody('?character=legacy');
  assert.equal(legacy.id, LEGACY_BODY_ID);
  assert.equal(legacy.assetURL, '/characters/base.glb');
  assert.equal(resolvePlayableBody('?character=unknown').id, LEGACY_BODY_ID);
});

test('orc and undead are explicit authored routes with own capsules and staff-only gear', () => {
  const orc = resolvePlayableBody('?character=orc-v1');
  const undead = resolvePlayableBody('?character=undead-v1');
  assert.equal(orc.id, ORC_V1_BODY_ID);
  assert.equal(undead.id, UNDEAD_V1_BODY_ID);
  assert.equal(orc.outfit, 'starter');
  assert.equal(undead.outfit, 'starter');
  assert.equal(orc.assetURL, '/characters/bodies/orc-animated-v1.glb');
  assert.equal(undead.assetURL, '/characters/bodies/undead-animated-v1.glb');
  assert.equal(orc.clipMode, 'exact');
  assert.equal(undead.clipMode, 'exact');
  assert.deepEqual(orc.clips, PLAYABLE_BODIES[HUMAN_V1_BODY_ID].clips);
  assert.equal(orc.capsule.height, 2.10);
  assert.equal(orc.capsule.radius, 0.38);
  assert.equal(undead.capsule.height, 1.66);
  assert.equal(undead.capsule.radius, 0.24);
  assert.equal(resolvePlayableBody('').capsule.height, 1.748);
  assert.equal(resolvePlayableBody('').capsule.radius, 0.28);
  assert.equal(resolvePlayableBody('?character=legacy').capsule, undefined);
  for (const id of AUTHORED_BODY_IDS) {
    const def = PLAYABLE_BODIES[id];
    assert.equal(isAuthoredPlayable(def), true);
    assert.equal(itemAllowedOnBody('staff', def), true);
    assert.equal(itemAllowedOnBody('hood', def), false);
    assert.equal(usesAdditiveCast(def), false);
    assert.equal(appearancePolicy(def).wipeTextures, false);
    assert.deepEqual(defaultLoadoutFor(def), [['mainHand', 'staff']]);
  }
  assert.equal(resolvePlayableBody('?character=orc-v1&outfit=body').outfit, 'body');
  assert.equal(resolvePlayableBody('?character=undead-v1&outfit=body').outfit, 'body');
});

test('authored clip map is exact names and fails closed', () => {
  const ok = resolvePlayableClips(AUTHORED_CLIPS, HUMAN);
  assert.equal(ok.mode, 'exact');
  assert.deepEqual(ok.clips, {
    idle: 'idle',
    walk: 'walk',
    run: 'run',
    jumpStart: 'jumpStart',
    jumpLoop: 'jumpLoop',
    jumpLand: 'jumpLand',
    cast: 'cast',
  });
  assert.notEqual(ok.clips.run, 'idle');
  assert.notEqual(ok.clips.cast, 'idle');
  assert.throws(
    () => resolvePlayableClips(['idle', 'walk', 'jumpStart', 'jumpLoop', 'jumpLand', 'cast'], HUMAN),
    /missing required clips: run/,
  );
  assert.throws(
    () => resolvePlayableClips(['idle', 'walk', 'run', 'jumpStart', 'jumpLoop', 'jumpLand'], HUMAN),
    /missing required clips: cast/,
  );
  assert.equal(resolvePlayableClips(AUTHORED_CLIPS, LEGACY).mode, 'fuzzy');
});

test('Human animated GLB actually contains the required clip names', async () => {
  const file = await readFile(new URL('../public/characters/bodies/human-animated-v1.glb', import.meta.url));
  const { json } = parseGlb(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength));
  const names = (json.animations || []).map((a) => a.name);
  const resolved = resolvePlayableClips(names, HUMAN);
  assert.deepEqual(names.slice().sort(), AUTHORED_CLIPS.slice().sort());
  assert.equal(resolved.clips.run, 'run');
  assert.equal(resolved.clips.cast, 'cast');
  const joints = json.skins[0].joints.map((i) => json.nodes[i]?.name);
  const legs = deriveLegBoneNames(joints, HUMAN);
  assert.ok(legs.includes('Hips'));
  assert.ok(legs.includes('LeftUpLeg'));
  assert.ok(legs.includes('RightFoot'));
  assert.equal(legs.includes('finger3-1.R'), false);
  assert.equal(legs.includes('Head'), false);
  assert.equal(legs.includes('Spine2'), false);
});

test('source channel capabilities resolve from the actual GLB; optional absence does not break authored rigs', async () => {
  const definition = resolvePlayableBody('?character=human-source');
  const file = await readFile(new URL('../public/ashen-reach/wanderer.glb', import.meta.url));
  const { json } = parseGlb(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength));
  const names = json.animations.map(a => a.name);
  const resolved = resolvePlayableClips(names, definition);
  assert.equal(resolved.clips.spellEnter, 'Spell_Simple_Enter');
  assert.equal(resolved.clips.spellLoop, 'Spell_Simple_Idle_Loop');
  assert.equal(resolved.clips.spellExit, 'Spell_Simple_Exit');
  const missingOptional = resolvePlayableClips(names.filter(n => n !== 'Spell_Simple_Exit'), definition);
  assert.equal(missingOptional.clips.spellExit, undefined);
  assert.throws(() => resolvePlayableClips(names.filter(n => n !== 'Sprint_Loop'), definition), /missing required clips/);
  assert.equal(resolvePlayableClips(AUTHORED_CLIPS.concat('Spell_Simple_Idle_Loop'), HUMAN).clips.spellLoop, undefined);
});

test('appearance wipe is gated; Human keeps authored materials', () => {
  const human = appearancePolicy(HUMAN);
  const legacy = appearancePolicy(LEGACY);
  assert.equal(human.wipeTextures, false);
  assert.equal(human.mutateHeight, false);
  assert.equal(human.mutateSkin, false);
  assert.equal(legacy.wipeTextures, true);
  assert.equal(legacy.mutateHeight, true);
  assert.equal(legacy.mutateSkin, true);
});

test('Human default loadout is staff only and rejects legacy armor', () => {
  assert.deepEqual(defaultLoadoutFor(HUMAN), [['mainHand', 'staff']]);
  assert.equal(defaultLoadoutFor(LEGACY), null);
  assert.equal(itemAllowedOnBody('staff', HUMAN), true);
  assert.equal(itemAllowedOnBody('staffEmber', HUMAN), true);
  assert.equal(itemAllowedOnBody('hood', HUMAN), false);
  assert.equal(itemAllowedOnBody('cape', HUMAN), false);
  assert.equal(itemAllowedOnBody('tunic', HUMAN), false);
  assert.equal(itemAllowedOnBody('sleeveL', HUMAN), false);
  assert.equal(itemAllowedOnBody('bootL', HUMAN), false);
  assert.equal(itemAllowedOnBody('hood', LEGACY), true);
  assert.equal(itemAllowedOnBody('tunic', LEGACY), true);
  assert.equal(usesAdditiveCast(HUMAN), false);
  assert.equal(usesAdditiveCast(LEGACY), true);
});
