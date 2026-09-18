import { parseGlb, readAccessor } from './glb.js';
import { RIG_HUMANOID_V1, resolveSemanticJoints } from './rig.js';

/** An exact bind contract: joint names alone cannot establish garment compatibility. */
export async function inspectBindContract(buffer) {
  const { json, binary } = parseGlb(buffer);
  if (json.skins?.length !== 1) throw new Error('Expected exactly one humanoid skin');
  const skin = json.skins[0], names = skin.joints.map(i => json.nodes[i]?.name);
  if (names.some(n => !n) || new Set(names).size !== names.length) throw new Error('Joint names must be present and unique');
  const semantics = resolveSemanticJoints(names);
  if (!semantics.complete) throw new Error(`Missing semantic joints: ${semantics.missing.join(', ')}`);
  const parents = new Map();
  for (let i = 0; i < json.nodes.length; i++) for (const child of json.nodes[i].children || []) {
    if (!json.nodes[child] || parents.has(child)) throw new Error('Invalid node hierarchy');
    parents.set(child, i);
  }
  function transform(node) {
    const value = node.matrix ? { matrix: node.matrix } : {
      translation: node.translation || [0, 0, 0], rotation: node.rotation || [0, 0, 0, 1], scale: node.scale || [1, 1, 1],
    };
    for (const values of Object.values(value)) if (values.some(v => !Number.isFinite(v))) throw new Error('Non-finite bind transform');
    return value;
  }
  function ancestry(index, includeNames) {
    const chain = [], seen = new Set();
    while (index !== undefined) {
      if (seen.has(index)) throw new Error('Cyclic joint hierarchy');
      seen.add(index);
      chain.unshift(includeNames ? { name: json.nodes[index].name || '', transform: transform(json.nodes[index]) } : transform(json.nodes[index]));
      index = parents.get(index);
    }
    return chain;
  }
  const inverseBind = readAccessor(json, binary, skin.inverseBindMatrices);
  if (inverseBind.length !== names.length * 16 || inverseBind.some(v => !Number.isFinite(v))) throw new Error('Invalid inverse bind matrices');
  const meshTransforms = [...new Set(json.nodes.flatMap((n, i) => n.skin === 0 && n.mesh !== undefined ? [JSON.stringify(ancestry(i, false))] : []))].sort();
  if (!meshTransforms.length) throw new Error('Skin has no bound meshes');
  const payload = { version: 1, rig: RIG_HUMANOID_V1, joints: skin.joints.map(i => ancestry(i, true)),
    inverseBind: Array.from(inverseBind), meshTransforms };
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(payload)));
  const signature = 'bind-v1:' + Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
  return { version: 1, rig: RIG_HUMANOID_V1, signature, jointCount: names.length, jointNames: names, semantics: semantics.resolved };
}

export function assertCompatibleBind(body, garment) {
  if (body?.version !== 1 || garment?.version !== 1 || !body.signature || body.signature !== garment.signature || body.rig !== garment.rig) {
    throw new Error('Incompatible bind contract: rebuild the garment fit variant for this body');
  }
}
