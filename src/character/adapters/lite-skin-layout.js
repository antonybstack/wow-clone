/**
 * Narrow compatibility boundary for Lite's glTF animation internals.
 * Verified against @babylonjs/lite 1.28.0 and the 1.31.1 skeleton contract:
 * https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/docs/lite/architecture/13-skeleton.md
 * The documented palette equation is invMeshWorld * jointWorld * IBM.
 * These private fields have no public socket-pose equivalent in those releases.
 */
import { VERSION } from '@babylonjs/lite';

const SUPPORTED_VERSIONS = new Set(['1.28.0', '1.31.1']);
const INCOMPATIBLE = 'LITE_SKIN_LAYOUT: unsupported Babylon Lite glTF skin layout';

function assertSupportedVersion() {
  if (!SUPPORTED_VERSIONS.has(VERSION)) {
    throw new Error(`${INCOMPATIBLE}: version ${VERSION}; expected 1.28.0 or 1.31.1`);
  }
}

export function liteSocketLayoutReady({ skeleton, groups, skinned }) {
  return Boolean(skeleton?.bones?.length && skinned?.skeleton?.boneMatrices?.length &&
    groups?.some((group) => group?.targetedAnimations?.length || group?.isPlaying));
}

export function liteSkinBinding(groups) {
  for (const group of groups ?? []) {
    const skins = group?._gltfMixer?.[2];
    const binding = skins?.[0];
    if (binding?.boneMatrices?.length && binding.inverseBindMatrices?.length && binding.jointNodes?.length) {
      return binding;
    }
  }
  return null;
}

export function liteBoneNodeIndex(bone) {
  return bone?._nodeIndex;
}

export function liteDebugWorldMatrices(group) {
  return group?._ctrl?._debugWorldMat ?? null;
}

export function liteAnimationClip(group) {
  const clip = group?._gltfMixer?.[0];
  if (!clip && group?.targetedAnimations?.length) {
    assertSupportedVersion();
    throw new Error(`${INCOMPATIBLE}: loaded animation ${group.name || '(unnamed)'} has no mixer clip`);
  }
  if (clip) assertSupportedVersion();
  return clip ?? null;
}

/** Loading and optional bones stay nullable; a loaded skinned actor must expose a usable binding. */
export function assertLiteSocketLayout({ skeleton, groups, skinned, hand }) {
  if (!liteSocketLayoutReady({ skeleton, groups, skinned })) return;
  assertSupportedVersion();
  if (!hand || liteBoneNodeIndex(hand) === undefined) {
    throw new Error(`${INCOMPATIBLE}: loaded actor has no indexed main-hand bone`);
  }
  const binding = liteSkinBinding(groups);
  const index = binding?.jointNodes?.indexOf(liteBoneNodeIndex(hand)) ?? -1;
  if (index < 0 || binding.boneMatrices.length < (index + 1) * 16 ||
      binding.inverseBindMatrices.length < (index + 1) * 16) {
    throw new Error(`${INCOMPATIBLE}: loaded actor has no hand palette / inverse-bind binding`);
  }
}
