import { parseGlb, readAccessor, glbWriter } from './glb.js';

export const FIXTURE_PROFILE = 'mixamo-diagnostic-v1';
export const OUTFITS = Object.freeze({
  full: ['tunic', 'trousers', 'sleeve'],
  tunic: ['tunic'],
  trousers: ['trousers'],
  sleeve: ['sleeve'],
  body: [],
});

const PALETTES = {
  indigo: {
    tunic: [0.065, 0.13, 0.27, 1],
    trousers: [0.28, 0.15, 0.055, 1],
    sleeve: [0.09, 0.16, 0.34, 1],
  },
  copper: {
    tunic: [0.33, 0.085, 0.04, 1],
    trousers: [0.22, 0.11, 0.045, 1],
    sleeve: [0.42, 0.14, 0.05, 1],
  },
};

/** Outer offset of the closed tube. Inner sits at 20% of this so the volume is plump, not a card. */
const SHELL = { tunic: 0.038, trousers: 0.034, sleeve: 0.036 };

const BONE_NAMES = {
  tunic: ['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'LeftShoulder', 'RightShoulder'],
  trousers: ['Hips', 'LeftUpLeg', 'RightUpLeg', 'LeftLeg', 'RightLeg'],
  sleeve: ['LeftShoulder', 'RightShoulder', 'LeftArm', 'RightArm', 'LeftForeArm', 'RightForeArm'],
};

function isBareBone(name) {
  const n = shortName(name);
  return n.startsWith('Head') || n.includes('Hand') || n.includes('Foot') || n.includes('Toe');
}

function shortName(name) {
  return (name || '').replace(/^mixamorig:/, '');
}

function boneIndexSet(jointNames, names) {
  const want = new Set(names);
  const set = new Set();
  for (let i = 0; i < jointNames.length; i++) {
    if (want.has(shortName(jointNames[i]))) set.add(i);
  }
  return set;
}

export function dominantJoint(joints, weights, vertex) {
  let best = 0;
  let value = -1;
  const base = vertex * 4;
  for (let k = 0; k < 4; k++) {
    const w = weights[base + k];
    if (w > value) {
      value = w;
      best = joints[base + k];
    }
  }
  return best;
}

function edgeKey(a, b) {
  return a < b ? `${a},${b}` : `${b},${a}`;
}

function triangleOffsets(indices) {
  const out = [];
  for (let i = 0; i < indices.length; i += 3) out.push(i);
  return out;
}

function buildEdgeMap(indices, offsets) {
  const map = new Map();
  for (const i of offsets) {
    const verts = [indices[i], indices[i + 1], indices[i + 2]];
    const edges = [edgeKey(verts[0], verts[1]), edgeKey(verts[1], verts[2]), edgeKey(verts[2], verts[0])];
    for (const e of edges) {
      let list = map.get(e);
      if (!list) {
        list = [];
        map.set(e, list);
      }
      list.push(i);
    }
  }
  return map;
}

function neighbors(edgeMap, indices, offset) {
  const verts = [indices[offset], indices[offset + 1], indices[offset + 2]];
  const edges = [edgeKey(verts[0], verts[1]), edgeKey(verts[1], verts[2]), edgeKey(verts[2], verts[0])];
  const out = [];
  for (const e of edges) {
    for (const t of edgeMap.get(e) || []) {
      if (t !== offset) out.push(t);
    }
  }
  return out;
}

function connectedComponents(indices, selected) {
  if (!selected.length) return [];
  const edgeMap = buildEdgeMap(indices, selected);
  const seen = new Set();
  const comps = [];
  for (const start of selected) {
    if (seen.has(start)) continue;
    const stack = [start];
    seen.add(start);
    const comp = [];
    while (stack.length) {
      const t = stack.pop();
      comp.push(t);
      for (const n of neighbors(edgeMap, indices, t)) {
        if (!seen.has(n)) {
          seen.add(n);
          stack.push(n);
        }
      }
    }
    comps.push(comp);
  }
  comps.sort((a, b) => b.length - a.length);
  return comps;
}

/** Keep every sizable island so hips stay with the tunic, not only the biggest slab. */
export function keepLargeComponents(indices, selected) {
  const comps = connectedComponents(indices, selected);
  if (!comps.length) return selected;
  const min = Math.max(40, Math.min(100, Math.floor(selected.length * 0.08)));
  const kept = comps.filter((c) => c.length >= min);
  return (kept.length ? kept : comps.slice(0, 1)).flat();
}

export function dilate(indices, selected, forbiddenVertex) {
  const all = triangleOffsets(indices);
  const edgeMap = buildEdgeMap(indices, all);
  const set = new Set(selected);
  const extra = [];
  for (const i of selected) {
    for (const n of neighbors(edgeMap, indices, i)) {
      if (set.has(n)) continue;
      const a = indices[n];
      const b = indices[n + 1];
      const c = indices[n + 2];
      if (forbiddenVertex(a) || forbiddenVertex(b) || forbiddenVertex(c)) continue;
      set.add(n);
      extra.push(n);
    }
  }
  return [...selected, ...extra];
}

function selectByBones(indices, joints, weights, boneSet) {
  const selected = [];
  for (let i = 0; i < indices.length; i += 3) {
    let hits = 0;
    for (let k = 0; k < 3; k++) {
      if (boneSet.has(dominantJoint(joints, weights, indices[i + k]))) hits++;
    }
    if (hits >= 1) selected.push(i);
  }
  return selected;
}

function flattenTris(indices, offsets) {
  const out = [];
  for (const i of offsets) out.push(indices[i], indices[i + 1], indices[i + 2]);
  return out;
}

function boundaryEdges(indices, selected) {
  const count = new Map();
  const wind = new Map();
  for (const i of selected) {
    const v = [indices[i], indices[i + 1], indices[i + 2]];
    const edges = [[v[0], v[1]], [v[1], v[2]], [v[2], v[0]]];
    for (const [a, b] of edges) {
      const k = edgeKey(a, b);
      count.set(k, (count.get(k) || 0) + 1);
      if (!wind.has(k)) wind.set(k, [a, b]);
    }
  }
  const out = [];
  for (const [k, n] of count) {
    if (n === 1) out.push(wind.get(k));
  }
  return out;
}

/**
 * Compact used verts, emit outer + inner copies, stitch hem quads.
 * Outer = +thickness along normal; inner = +0.2 thickness (clear of the body).
 */
export function thickenTube(positions, normals, joints, weights, indices, selected, thickness, id) {
  const used = [];
  const remap = new Map();
  for (const i of selected) {
    for (let k = 0; k < 3; k++) {
      const v = indices[i + k];
      if (!remap.has(v)) {
        remap.set(v, used.length);
        used.push(v);
      }
    }
  }
  const n = used.length;
  const pos = new Float32Array(n * 2 * 3);
  const nor = new Float32Array(n * 2 * 3);
  const jnt = new joints.constructor(n * 2 * 4);
  const wgt = new Float32Array(n * 2 * 4);
  const inner = thickness * 0.22;
  for (let i = 0; i < n; i++) {
    const v = used[i];
    const nx = normals[v * 3];
    const ny = normals[v * 3 + 1];
    const nz = normals[v * 3 + 2];
    const px = positions[v * 3];
    const py = positions[v * 3 + 1];
    const pz = positions[v * 3 + 2];
    pos[i * 3] = px + nx * thickness;
    pos[i * 3 + 1] = py + ny * thickness;
    pos[i * 3 + 2] = pz + nz * thickness;
    pos[(n + i) * 3] = px + nx * inner;
    pos[(n + i) * 3 + 1] = py + ny * inner;
    pos[(n + i) * 3 + 2] = pz + nz * inner;
    nor[i * 3] = nx;
    nor[i * 3 + 1] = ny;
    nor[i * 3 + 2] = nz;
    nor[(n + i) * 3] = -nx;
    nor[(n + i) * 3 + 1] = -ny;
    nor[(n + i) * 3 + 2] = -nz;
    for (let k = 0; k < 4; k++) {
      jnt[i * 4 + k] = joints[v * 4 + k];
      jnt[(n + i) * 4 + k] = joints[v * 4 + k];
      wgt[i * 4 + k] = weights[v * 4 + k];
      wgt[(n + i) * 4 + k] = weights[v * 4 + k];
    }
  }
  const outIdx = [];
  for (const i of selected) {
    const a = remap.get(indices[i]);
    const b = remap.get(indices[i + 1]);
    const c = remap.get(indices[i + 2]);
    outIdx.push(a, b, c);
    outIdx.push(n + a, n + c, n + b);
  }
  for (const [a0, b0] of boundaryEdges(indices, selected)) {
    const a = remap.get(a0);
    const b = remap.get(b0);
    if (a == null || b == null) continue;
    outIdx.push(a, b, n + b);
    outIdx.push(a, n + b, n + a);
  }
  return {
    positions: pos,
    normals: nor,
    joints: jnt,
    weights: wgt,
    uvs: garmentUv(pos, id),
    indices: new Uint32Array(outIdx),
    sourceVerts: used,
  };
}

function fullness(positions) {
  const delta = new Float32Array(positions.length);
  for (let i = 0; i < positions.length; i += 3) {
    const weight = Math.max(0, 1 - Math.abs(positions[i + 1] - 1.07) / 0.65);
    delta[i] = positions[i] * 0.24 * weight;
    delta[i + 2] = positions[i + 2] * 0.32 * weight;
  }
  return delta;
}

/** Cylindrical UVs: torso around Y, sleeves around X (T-pose arms). */
export function garmentUv(positions, id) {
  const uv = new Float32Array((positions.length / 3) * 2);
  const twoPi = Math.PI * 2;
  for (let i = 0, v = 0; i < positions.length; i += 3, v += 2) {
    const x = positions[i];
    const y = positions[i + 1];
    const z = positions[i + 2];
    if (id === 'sleeve') {
      uv[v] = Math.atan2(z, y - 1.38) / twoPi + 0.5;
      uv[v + 1] = x * 0.55 + 0.5;
    } else {
      uv[v] = Math.atan2(z, x) / twoPi + 0.5;
      uv[v + 1] = y / 1.82;
    }
  }
  return uv;
}

function garmentMaterial(id, palette) {
  const colors = PALETTES[palette] || PALETTES.indigo;
  return {
    name: `Fixture ${palette} ${id}`,
    pbrMetallicRoughness: {
      baseColorFactor: colors[id],
      metallicFactor: 0,
      roughnessFactor: id === 'sleeve' ? 0.78 : 0.86,
    },
  };
}

/** Technical fixture only: body-derived shells test skin binding, not finished tailoring. */
export function composeFixture(source, { outfit = 'full', profile = FIXTURE_PROFILE, palette = 'indigo' } = {}) {
  if (profile !== FIXTURE_PROFILE) throw new Error(`Unsupported fit profile: ${profile}`);
  if (!Object.hasOwn(OUTFITS, outfit)) throw new Error(`Unsupported outfit: ${outfit}`);
  const { json, binary } = parseGlb(source);
  const skin = json.skins?.[0];
  if (json.skins?.length !== 1 || !skin.joints.every(i => json.nodes[i]?.name?.startsWith('mixamorig:'))) {
    throw new Error('Fixture requires the validated Mixamo rig');
  }
  const sourceNode = json.nodes.find(n => n.name === 'Alpha_Surface');
  if (!sourceNode || sourceNode.skin !== 0) throw new Error('Missing skinned Alpha_Surface');
  const primitive = json.meshes[sourceNode.mesh].primitives[0];
  const positions = readAccessor(json, binary, primitive.attributes.POSITION);
  const normals = readAccessor(json, binary, primitive.attributes.NORMAL);
  const indices = readAccessor(json, binary, primitive.indices);
  const jointsAttr = readAccessor(json, binary, primitive.attributes.JOINTS_0);
  const weightsAttr = readAccessor(json, binary, primitive.attributes.WEIGHTS_0);
  const writer = glbWriter(json, binary);
  const originalNodeIndex = json.nodes.indexOf(sourceNode);
  const parent = json.nodes.find(n => n.children?.includes(originalNodeIndex));
  if (!parent) throw new Error('Fixture mesh must have an explicit parent');
  const jointNames = skin.joints.map(i => json.nodes[i].name);
  const bare = new Set(jointNames.map((n, i) => isBareBone(n) ? i : -1).filter((i) => i >= 0));
  const forbiddenVertex = (v) => bare.has(dominantJoint(jointsAttr, weightsAttr, v));

  json.materials[0].pbrMetallicRoughness = { baseColorFactor: [0.19, 0.13, 0.095, 1], metallicFactor: 0, roughnessFactor: 0.8 };
  json.materials[1].pbrMetallicRoughness = { baseColorFactor: [0.62, 0.42, 0.31, 1], metallicFactor: 0, roughnessFactor: 0.72 };
  for (const mesh of json.meshes) {
    const p = mesh.primitives[0];
    const pos = readAccessor(json, binary, p.attributes.POSITION);
    if (p.attributes.TEXCOORD_0 == null) {
      p.attributes.TEXCOORD_0 = writer.append(garmentUv(pos, 'tunic'), 'VEC2');
    }
    p.targets = [{ POSITION: writer.append(fullness(pos), 'VEC3', true) }];
    mesh.weights = [0];
    mesh.extras = { targetNames: ['fullness'] };
  }

  const probes = {};
  const covered = new Set();
  for (const id of OUTFITS[outfit]) {
    const boneSet = boneIndexSet(jointNames, BONE_NAMES[id]);
    let selected = selectByBones(indices, jointsAttr, weightsAttr, boneSet);
    selected = keepLargeComponents(indices, selected);
    selected = dilate(indices, selected, forbiddenVertex);
    selected = keepLargeComponents(indices, selected);
    if (!selected.length) throw new Error(`Empty fixture garment ${id}`);
    for (const i of selected) covered.add(i);
    const tube = thickenTube(
      positions, normals, jointsAttr, weightsAttr, indices, selected,
      SHELL[id] ?? 0.036, id,
    );
    const meshIndex = json.meshes.length;
    const material = json.materials.length;
    json.materials.push(garmentMaterial(id, palette));
    json.meshes.push({
      name: `Fixture_${id}`,
      weights: [0],
      extras: { targetNames: ['fullness'], component: 'watertight-tube' },
      primitives: [{
        attributes: {
          POSITION: writer.append(tube.positions, 'VEC3', true),
          NORMAL: writer.append(tube.normals, 'VEC3'),
          TEXCOORD_0: writer.append(tube.uvs, 'VEC2'),
          JOINTS_0: writer.append(tube.joints, 'VEC4'),
          WEIGHTS_0: writer.append(tube.weights, 'VEC4'),
        },
        indices: writer.append(tube.indices, 'SCALAR'),
        material,
        targets: [{ POSITION: writer.append(fullness(tube.positions), 'VEC3', true) }],
      }],
    });
    const node = { ...structuredClone(sourceNode), name: `Fixture_${id}`, mesh: meshIndex };
    parent.children.push(json.nodes.length);
    json.nodes.push(node);
    // Compaction changes vertex identity: preserve the outer-shell → source mapping.
    // Comparing equal numeric indices across these meshes measures unrelated limbs.
    const stride = Math.max(1, Math.floor(tube.sourceVerts.length / 80));
    probes[id] = tube.sourceVerts.flatMap((bodyVertex, garmentVertex) =>
      garmentVertex % stride === 0 ? [{ bodyVertex, garmentVertex }] : []).slice(0, 80);
  }

  if (covered.size) {
    const remaining = [];
    for (let i = 0; i < indices.length; i += 3) {
      if (!covered.has(i)) remaining.push(indices[i], indices[i + 1], indices[i + 2]);
    }
    if (!remaining.length) throw new Error('Coverage hid Alpha_Surface');
    primitive.indices = writer.append(new Uint32Array(remaining), 'SCALAR');
  }

  json.asset.extras = { diagnosticOnly: true, profile, outfit, jointNames, shell: 'watertight-tube' };
  return {
    buffer: writer.finish(),
    manifest: {
      profile, outfit, probes, jointNames,
      sourceVertices: positions.length / 3,
      diagnosticOnly: true,
      shell: 'watertight-tube',
    },
  };
}
