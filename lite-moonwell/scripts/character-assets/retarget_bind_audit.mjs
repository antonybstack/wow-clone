/**
 * Compare source body vs animated-v1 bind-v1 fields by named joint.
 * Does not overwrite source profile/GLB.
 *
 *   node scripts/character-assets/retarget_bind_audit.mjs --profile human|orc|undead
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { parseGlb, readAccessor } from '../../src/character/runtime/glb.js';
import { RIG_HUMANOID_V1, resolveSemanticJoints } from '../../src/character/runtime/rig.js';

const ROOT = resolve(new URL('../../', import.meta.url).pathname);
const PROFILES = {
  human: {
    src: 'public/characters/bodies/human-v1.glb',
    dst: 'public/characters/bodies/human-animated-v1.glb',
    out: 've-capture/m2e-human-animation/bind-audit.json',
  },
  orc: {
    src: 'public/characters/bodies/orc-v1.glb',
    dst: 'public/characters/bodies/orc-animated-v1.glb',
    out: 've-capture/m2e-orc-animation/bind-audit.json',
  },
  undead: {
    src: 'public/characters/bodies/undead-v1.glb',
    dst: 'public/characters/bodies/undead-animated-v1.glb',
    out: 've-capture/m2e-undead-animation/bind-audit.json',
  },
};

function parseProfile(argv) {
  let profile = 'human';
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--profile' && argv[i + 1]) {
      profile = argv[++i];
    } else if (argv[i].startsWith('--profile=')) {
      profile = argv[i].slice('--profile='.length);
    }
  }
  if (!Object.hasOwn(PROFILES, profile)) {
    console.error(`unknown --profile ${profile}; want human|orc|undead`);
    process.exit(2);
  }
  return profile;
}

const PROFILE = parseProfile(process.argv);
const SRC = resolve(ROOT, PROFILES[PROFILE].src);
const DST = resolve(ROOT, PROFILES[PROFILE].dst);
const OUT = resolve(ROOT, PROFILES[PROFILE].out);

function mat4Identity() {
  return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
}
function mul(a, b) {
  const o = new Array(16);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      o[c * 4 + r] =
        a[0 * 4 + r] * b[c * 4 + 0] +
        a[1 * 4 + r] * b[c * 4 + 1] +
        a[2 * 4 + r] * b[c * 4 + 2] +
        a[3 * 4 + r] * b[c * 4 + 3];
    }
  }
  return o;
}
function trsMat(node) {
  if (node.matrix) return node.matrix.slice();
  const t = node.translation || [0, 0, 0];
  const r = node.rotation || [0, 0, 0, 1];
  const s = node.scale || [1, 1, 1];
  const [x, y, z, w] = r;
  const xx = x * x, yy = y * y, zz = z * z;
  const xy = x * y, xz = x * z, yz = y * z;
  const wx = w * x, wy = w * y, wz = w * z;
  const rot = [
    1 - 2 * (yy + zz), 2 * (xy + wz), 2 * (xz - wy), 0,
    2 * (xy - wz), 1 - 2 * (xx + zz), 2 * (yz + wx), 0,
    2 * (xz + wy), 2 * (yz - wx), 1 - 2 * (xx + yy), 0,
    0, 0, 0, 1,
  ];
  const scale = [s[0], 0, 0, 0, 0, s[1], 0, 0, 0, 0, s[2], 0, 0, 0, 0, 1];
  const trans = mat4Identity();
  trans[12] = t[0]; trans[13] = t[1]; trans[14] = t[2];
  return mul(trans, mul(rot, scale));
}
function translationOf(m) {
  return [m[12], m[13], m[14]];
}
function maxAbs(a, b) {
  let m = 0;
  for (let i = 0; i < a.length; i++) m = Math.max(m, Math.abs(a[i] - b[i]));
  return m;
}

function extract(buffer) {
  const { json, binary } = parseGlb(buffer);
  const skin = json.skins[0];
  const names = skin.joints.map((i) => json.nodes[i]?.name);
  const parents = new Map();
  for (let i = 0; i < json.nodes.length; i++) {
    for (const child of json.nodes[i].children || []) parents.set(child, i);
  }
  function transform(node) {
    return node.matrix
      ? { matrix: node.matrix }
      : {
          translation: node.translation || [0, 0, 0],
          rotation: node.rotation || [0, 0, 0, 1],
          scale: node.scale || [1, 1, 1],
        };
  }
  function ancestry(index, includeNames) {
    const chain = [];
    const seen = new Set();
    while (index !== undefined) {
      if (seen.has(index)) throw new Error('cycle');
      seen.add(index);
      chain.unshift(
        includeNames
          ? { name: json.nodes[index].name || '', transform: transform(json.nodes[index]) }
          : transform(json.nodes[index]),
      );
      index = parents.get(index);
    }
    return chain;
  }
  const inverseBind = Array.from(readAccessor(json, binary, skin.inverseBindMatrices));
  const meshNodes = json.nodes
    .map((n, i) => ({ i, n }))
    .filter(({ n }) => n.skin === 0 && n.mesh !== undefined);
  const meshTransforms = [
    ...new Set(meshNodes.map(({ i }) => JSON.stringify(ancestry(i, false)))),
  ].sort();
  const worldRest = {};
  const localRest = {};
  for (let j = 0; j < names.length; j++) {
    const idx = skin.joints[j];
    const chain = ancestry(idx, false);
    let w = mat4Identity();
    for (const tr of chain) {
      const m = tr.matrix || trsMat({ ...tr });
      w = mul(w, m);
    }
    worldRest[names[j]] = w;
    localRest[names[j]] = transform(json.nodes[idx]);
  }
  const ibm = {};
  for (let j = 0; j < names.length; j++) {
    ibm[names[j]] = inverseBind.slice(j * 16, j * 16 + 16);
  }
  const payload = {
    version: 1,
    rig: RIG_HUMANOID_V1,
    joints: skin.joints.map((i) => ancestry(i, true)),
    inverseBind,
    meshTransforms,
  };
  return {
    json,
    names,
    worldRest,
    localRest,
    ibm,
    meshTransforms,
    meshNodeNames: meshNodes.map(({ n, i }) => n.name || `mesh#${i}`),
    nodeNames: json.nodes.map((n) => n?.name),
    nodeCount: json.nodes.length,
    payload,
  };
}

async function signature(payload) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(payload)));
  return 'bind-v1:' + Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

async function main() {
  const src = extract((await readFile(SRC)).buffer.slice(0));
  const dst = extract((await readFile(DST)).buffer.slice(0));
  const srcSig = await signature(src.payload);
  const dstSig = await signature(dst.payload);
  const nameOrderEqual =
    src.names.length === dst.names.length && src.names.every((n, i) => n === dst.names[i]);
  const namedOnlySrc = [...src.names].sort();
  const namedOnlyDst = [...dst.names].sort();
  const namesSetEqual =
    namedOnlySrc.length === namedOnlyDst.length && namedOnlySrc.every((n, i) => n === namedOnlyDst[i]);

  let maxWorldT = 0;
  let worstWorld = null;
  let maxIbm = 0;
  let worstIbm = null;
  let maxLocal = 0;
  let worstLocal = null;
  const perJoint = [];
  for (const name of src.names) {
    if (!dst.worldRest[name]) continue;
    const tw = translationOf(src.worldRest[name]);
    const td = translationOf(dst.worldRest[name]);
    const dt = Math.hypot(tw[0] - td[0], tw[1] - td[1], tw[2] - td[2]);
    const di = maxAbs(src.ibm[name], dst.ibm[name]);
    const sl = JSON.stringify(src.localRest[name]);
    const dl = JSON.stringify(dst.localRest[name]);
    const localDiff = sl === dl ? 0 : 1;
    if (dt > maxWorldT) {
      maxWorldT = dt;
      worstWorld = { name, dt, src: tw, dst: td };
    }
    if (di > maxIbm) {
      maxIbm = di;
      worstIbm = { name, di };
    }
    if (localDiff && !worstLocal) worstLocal = name;
    maxLocal = Math.max(maxLocal, localDiff);
    if (dt > 1e-5 || di > 1e-5 || localDiff) {
      perJoint.push({ name, worldTransDeltaM: dt, ibmMaxAbs: di, localRestEqual: !localDiff });
    }
  }

  const extraDstNodes = (dst.nodeNames || []).filter((n) => n && !(src.nodeNames || []).includes(n));
  const extraSrcNodes = (src.nodeNames || []).filter((n) => n && !(dst.nodeNames || []).includes(n));

  const worldEquivalent = maxWorldT < 1e-4 && maxIbm < 1e-4;
  const structuralOnly = namesSetEqual && nameOrderEqual && worldEquivalent && srcSig !== dstSig;

  const report = {
    schemaVersion: 1,
    profile: PROFILE,
    sourceBind: srcSig,
    animatedBind: dstSig,
    signaturesMatch: srcSig === dstSig,
    jointCountSrc: src.names.length,
    jointCountDst: dst.names.length,
    jointOrderEqual: nameOrderEqual,
    jointNameSetEqual: namesSetEqual,
    nodeCountSrc: src.nodeCount,
    nodeCountDst: dst.nodeCount,
    extraDstNodeNames: extraDstNodes.slice(0, 40),
    extraSrcNodeNames: extraSrcNodes.slice(0, 40),
    meshNodeNamesSrc: src.meshNodeNames,
    meshNodeNamesDst: dst.meshNodeNames,
    meshTransformCountSrc: src.meshTransforms.length,
    meshTransformCountDst: dst.meshTransforms.length,
    meshTransformsEqual: JSON.stringify(src.meshTransforms) === JSON.stringify(dst.meshTransforms),
    maxNamedJointWorldTranslationDeltaM: maxWorldT,
    worstNamedJointWorld: worstWorld,
    maxNamedJointIbmAbs: maxIbm,
    worstNamedJointIbm: worstIbm,
    differingJointsSample: perJoint.slice(0, 24),
    differingJointCount: perJoint.length,
    namedJointWorldAndIbmEquivalent: worldEquivalent,
    structuralWrapperOnly: structuralOnly,
    explanation: structuralOnly
      ? 'Named-joint world rest translations and inverse binds match within 1e-4; bind-v1 hash differs due to node wrapper/order/mesh-transform ancestry encoding, not rest anatomy.'
      : srcSig === dstSig
        ? 'Bind signatures identical.'
        : 'Named-joint rest/IBM differ; rest anatomy or mesh skinning changed in export — not explained by reimport alone.',
  };
  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ signaturesMatch: report.signaturesMatch, structuralWrapperOnly: structuralOnly, maxWorldT, maxIbm, extraDstNodeNames: extraDstNodes }, null, 2));
  console.log('wrote', OUT);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
