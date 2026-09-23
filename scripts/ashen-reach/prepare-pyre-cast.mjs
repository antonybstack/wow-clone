/** Offline overhead slam for Pyre Burst.
 * Source: Quaternius CC0 Sword_Attack (cocked chop) + Idle_Loop.
 * The weapon hand keeps the chop. The off hand follows at a shorter reach
 * with an idle wrist, so it does not mirror into a claw. Fingers stay at
 * rest and the live grip owns them. The hit eases back to idle over half a
 * second. Split upper/lower for native additive layering.
 */
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {MeshoptDecoder, MeshoptEncoder} from 'meshoptimizer';
import {quat} from 'gl-matrix';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {sample, smooth, lower} from './prepare-fire-cast.mjs';

const DURATION = 1.9;
const RELEASE = 1.1;
const HOLD_UNTIL = 1.38;
const RECOVER = 0.52;
const NAMES = ['PyreBurst_Upper', 'PyreBurst_Lower'];
const BODY = 'public/ashen-reach/wanderer.glb';
const TARGETS = [
  'public/ashen-reach/wanderer-equipment.glb',
  'public/ashen-reach/equipment/body.glb',
  'public/ashen-reach/equipment-undead/body.glb',
  'public/ashen-reach/equipment-orc/body.glb',
  'public/characters/candidates/undead-source-v1.glb',
  'public/characters/candidates/orc-source-v1.glb',
];

function sourceTime(t) {
  // Raise, then a fast chop that arrives on the 1.1s release and holds.
  // Recovery is the layer weight returning to idle, not a jump to the
  // end of the source swing.
  const keys = [
    [0, 0.04],
    [0.28, 0.2],
    [0.72, 0.32],
    [0.98, 0.44],
    [1.1, 0.58],
    [HOLD_UNTIL, 0.62],
    [DURATION, 0.62],
  ];
  for (let i = 1; i < keys.length; i++)
    if (t <= keys[i][0]) {
      const [a, x] = keys[i - 1],
        [b, y] = keys[i];
      return x + (y - x) * ((t - a) / (b - a || 1));
    }
  return 1.533;
}

function mirrorQuat(q) {
  return [q[0], -q[1], -q[2], q[3]];
}

async function ioWithMeshopt() {
  await MeshoptDecoder.ready;
  await MeshoptEncoder.ready;
  return new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({
      'meshopt.decoder': MeshoptDecoder,
      'meshopt.encoder': MeshoptEncoder,
    });
}

export async function copyNamedClips(sourcePath, targetPath, names) {
  const io = await ioWithMeshopt();
  const source = await io.read(sourcePath);
  const target = await io.read(targetPath);
  const targetRoot = target.getRoot();
  const targetNodes = new Map(targetRoot.listNodes().map((n) => [n.getName(), n]));
  const buffer = targetRoot.listBuffers()[0];
  for (const name of names)
    for (const old of targetRoot.listAnimations().filter((a) => a.getName() === name))
      old.dispose();
  const copied = [];
  for (const name of names) {
    const animation = source.getRoot().listAnimations().find((a) => a.getName() === name);
    if (!animation) throw Error(`Missing source clip ${name}`);
    const next = target.createAnimation(name);
    const accessors = new Map();
    const copyAccessor = (original) => {
      if (!accessors.has(original))
        accessors.set(
          original,
          target
            .createAccessor()
            .setType(original.getType())
            .setArray(original.getArray().slice())
            .setBuffer(buffer),
        );
      return accessors.get(original);
    };
    for (const channel of animation.listChannels()) {
      const node = targetNodes.get(channel.getTargetNode().getName());
      if (!node) throw Error(`${targetPath} missing ${channel.getTargetNode().getName()}`);
      const src = channel.getSampler();
      const sampler = target
        .createAnimationSampler()
        .setInterpolation(src.getInterpolation())
        .setInput(copyAccessor(src.getInput()))
        .setOutput(copyAccessor(src.getOutput()));
      next.addSampler(sampler);
      next.addChannel(
        target
          .createAnimationChannel()
          .setTargetNode(node)
          .setTargetPath(channel.getTargetPath())
          .setSampler(sampler),
      );
    }
    copied.push({name, channels: next.listChannels().length});
  }
  await fs.writeFile(targetPath, await io.writeBinary(target));
  return copied;
}

export async function preparePyreCast() {
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const d = await io.read(BODY);
  const root = d.getRoot();
  const sword = root.listAnimations().find((a) => a.getName() === 'Sword_Attack');
  const idle = root.listAnimations().find((a) => a.getName() === 'Idle_Loop');
  const pickup = root.listAnimations().find((a) => a.getName() === 'PickUp_Table');
  if (!sword || !idle || !pickup) throw Error('Pyre cast requires Sword_Attack, Idle_Loop and PickUp_Table');
  const baseline = new Map(
    idle.listChannels().map((c) => [c.getTargetNode().getName() + ':' + c.getTargetPath(), c]),
  );
  const swordBy = new Map(
    sword.listChannels().map((c) => [c.getTargetNode().getName() + ':' + c.getTargetPath(), c]),
  );
  const pickBy = new Map(
    pickup.listChannels().map((c) => [c.getTargetNode().getName() + ':' + c.getTargetPath(), c]),
  );
  for (const a of root.listAnimations().filter((a) => NAMES.includes(a.getName()))) a.dispose();
  const upper = d.createAnimation('PyreBurst_Upper');
  const legs = d.createAnimation('PyreBurst_Lower');
  const times = Float32Array.from({length: Math.round(DURATION * 60) + 1}, (_, i) => i / 60);
  const buffer = root.listBuffers()[0];
  const input = d.createAccessor('Pyre cast time').setType('SCALAR').setArray(times).setBuffer(buffer);
  for (const c of sword.listChannels()) {
    const node = c.getTargetNode();
    const name = node.getName();
    const path = c.getTargetPath();
    const rest = sample(baseline.get(name + ':' + path), 0);
    const n = rest.length;
    const values = new Float32Array(times.length * n);
    const finger = /mixamorig:(Left|Right)Hand(Thumb|Index|Middle|Ring|Pinky)/.test(name);
    const leftArm = /mixamorig:Left(Shoulder|Arm|ForeArm)$/.test(name);
    const leftHand = name === 'mixamorig:LeftHand';
    const crunch = pickBy.get(name + ':' + path);
    const mirrored = leftArm || leftHand;
    const sourceChannel = mirrored
      ? swordBy.get(name.replace('Left', 'Right') + ':' + path) || c
      : c;
    // How much of the source swing this joint is allowed to take.
    // The off-hand wrist stays near idle; a full mirror is the claw.
    const reach = finger ? 0 : leftHand ? 0.2 : leftArm ? 0.92 : lower(name) ? 0.34 : 1;
    for (let i = 0; i < times.length; i++) {
      const t = times[i];
      const weight = smooth(t / 0.18) * (1 - smooth((t - HOLD_UNTIL) / RECOVER));
      let pose = sample(sourceChannel, sourceTime(t));
      if (mirrored && path === 'rotation') pose = mirrorQuat(pose);
      if (path === 'rotation' && reach < 1) pose = Array.from(quat.slerp(quat.create(), rest, pose, reach));
      else if (path !== 'rotation' && reach < 1) pose = rest.map((v, j) => v + (pose[j] - v) * reach);
      if (crunch && (/Spine/.test(name) || lower(name))) {
        const crush = smooth((t - 0.96) / 0.12) * (1 - smooth((t - 1.22) / 0.18)) * 0.28;
        const bent = sample(crunch, 0.21);
        pose =
          n === 4
            ? Array.from(quat.slerp(quat.create(), pose, bent, crush))
            : pose.map((v, j) => v + (bent[j] - v) * crush);
      }
      values.set(
        n === 4
          ? quat.slerp(quat.create(), rest, pose, weight)
          : rest.map((v, j) => v + (pose[j] - v) * weight),
        i * n,
      );
    }
    const output = d
      .createAccessor(name + ' pyre cast')
      .setType(c.getSampler().getOutput().getType())
      .setArray(values)
      .setBuffer(buffer);
    const sampler = d
      .createAnimationSampler()
      .setInput(input)
      .setOutput(output)
      .setInterpolation('LINEAR');
    const dest = lower(name) ? legs : upper;
    dest
      .addSampler(sampler)
      .addChannel(
        d.createAnimationChannel().setTargetNode(node).setTargetPath(path).setSampler(sampler),
      );
  }
  const bytes = await io.writeBinary(d);
  const hash = createHash('sha256').update(bytes).digest('hex');
  await fs.writeFile(BODY, bytes);
  const recipe = {
    license: 'CC0-1.0',
    sourceClips: ['Sword_Attack', 'Idle_Loop', 'PickUp_Table'],
    changes:
      'Sword-hand overhead chop with a shorter off-hand brace. The strike arrives at the 1.1s release, holds through the nova, then eases back to idle. Fingers stay at rest so the live grip can keep the weapon.',
    duration: DURATION,
    releaseTime: RELEASE,
    hand: 'mainHand',
    outputSha256: hash,
    clips: [upper, legs].map((a) => ({name: a.getName(), channels: a.listChannels().length})),
  };
  await fs.writeFile(
    'public/ashen-reach/pyre-cast-provenance.json',
    JSON.stringify(recipe, null, 2) + '\n',
  );
  for (const name of ['animation-provenance', 'fire-cast-provenance', 'lava-cast-provenance']) {
    const p = 'public/ashen-reach/' + name + '.json';
    const v = JSON.parse(await fs.readFile(p, 'utf8'));
    v.outputSha256 = hash;
    if (name === 'animation-provenance') v.derivedPyreCast = recipe;
    if (name === 'lava-cast-provenance') v.outputSha256 = hash;
    await fs.writeFile(p, JSON.stringify(v, null, 2) + '\n');
  }
  const copies = [];
  for (const target of TARGETS) {
    try {
      await fs.access(target);
    } catch {
      continue;
    }
    copies.push({target, clips: await copyNamedClips(BODY, target, NAMES)});
  }
  console.log(JSON.stringify({recipe, copies}, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  await preparePyreCast();
