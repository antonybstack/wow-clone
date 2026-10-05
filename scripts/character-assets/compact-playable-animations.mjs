import assert from 'node:assert/strict';
import {PropertyType} from '@gltf-transform/core';
import {prune} from '@gltf-transform/functions';
import {ASHEN_PLAYABLE_CLIP_NAMES} from '../../src/character/runtime/ashen-playable-motion.js';
import {identityAnimationHash, identityGeometryHash} from './human-identity-proof.mjs';

/** Remove only unused library clips, then native-prune their orphaned accessors.
 * Do not prune nodes, attributes, materials or morphs. Exact playable samples and
 * the complete approved visual remain; the full source library stays published.
 * https://gltf-transform.dev/modules/core/classes/Animation
 * https://gltf-transform.dev/modules/functions/functions/prune
 */
export async function compactPlayableAnimations(doc) {
    const root = doc.getRoot(), keep = new Set(ASHEN_PLAYABLE_CLIP_NAMES);
    const present = new Set(root.listAnimations().map(a => a.getName()));
    for (const name of keep) assert(present.has(name), `Missing playable source clip: ${name}`);
    const geometry = identityGeometryHash(root);
    const curves = identityAnimationHash(root, {names: keep});
    for (const animation of root.listAnimations()) {
        if (keep.has(animation.getName())) continue;
        // Disposing an Animation detaches its references, but its channel/sampler
        // graph can still retain accessors. Dispose its owned properties explicitly.
        for (const channel of animation.listChannels()) channel.dispose();
        for (const sampler of animation.listSamplers()) sampler.dispose();
        animation.dispose();
    }
    await doc.transform(prune({propertyTypes: [PropertyType.ACCESSOR, PropertyType.BUFFER],
        keepAttributes: true, keepExtras: true}));
    assert.equal(identityGeometryHash(root), geometry, 'Compact animation cleanup changed geometry');
    assert.equal(identityAnimationHash(root), curves, 'Compact animation cleanup changed playable curves');
    return root.listAnimations().map(a => a.getName());
}
