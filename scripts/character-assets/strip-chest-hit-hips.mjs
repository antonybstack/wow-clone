/** Remove only authored root travel from Hit_Chest before a playable GLB is written. */
export function stripChestHitHipsTranslation(doc, {allowPrepared = false} = {}) {
  const hits = doc.getRoot().listAnimations().filter(animation => animation.getName() === 'Hit_Chest');
  if (hits.length !== 1) throw new Error(`Expected one Hit_Chest clip, found ${hits.length}`);
  const hit = hits[0];
  const channels = hit.listChannels().filter(channel =>
    channel.getTargetPath() === 'translation' &&
    /(?:^|:)Hips$/.test(channel.getTargetNode()?.getName() || ''));
  if (allowPrepared && channels.length === 0) return {before: hit.listChannels().length,
    after: hit.listChannels().length};
  if (channels.length !== 1) throw new Error(`Expected one Hit_Chest Hips translation, found ${channels.length}`);
  // Animation.removeChannel owns graph references; other clips and tracks stay intact.
  // https://gltf-transform.dev/modules/core/classes/Animation#removechannel
  hit.removeChannel(channels[0]);
  return {before: hit.listChannels().length + 1, after: hit.listChannels().length};
}
