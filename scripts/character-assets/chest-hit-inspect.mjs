import {createHash} from 'node:crypto';

/** Hash every animation channel and keyframe except the one intentionally removed. */
export function inspectChestHit(doc) {
  const animations=doc.getRoot().listAnimations();
  const chest=animations.find(a=>a.getName()==='Hit_Chest');
  const head=animations.find(a=>a.getName()==='Hit_Head');
  const isHipsTranslation=channel=>channel.getTargetPath()==='translation' &&
    /(?:^|:)Hips$/.test(channel.getTargetNode()?.getName()||'');
  const hash=createHash('sha256');
  for (const animation of animations) {
    for (const channel of animation.listChannels()) {
      if (animation===chest && isHipsTranslation(channel)) continue;
      const sampler=channel.getSampler();
      const key=[animation.getName(),channel.getTargetNode()?.getName(),
        channel.getTargetPath(),sampler.getInterpolation()].join('|');
      hash.update(key+'\n');
      for (const accessor of [sampler.getInput(),sampler.getOutput()]) {
        const array=accessor.getArray();
        hash.update(accessor.getType()+'|'+array.constructor.name+'|'+array.length+'\n');
        hash.update(Buffer.from(array.buffer,array.byteOffset,array.byteLength));
      }
    }
  }
  return {clips:animations.length,chest:chest?.listChannels().length,
    chestHips:chest?.listChannels().filter(isHipsTranslation).length,
    head:head?.listChannels().length,headHips:head?.listChannels().filter(isHipsTranslation).length,
    preservedSha256:hash.digest('hex')};
}
