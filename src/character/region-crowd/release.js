/** Optional region actors: import lazily after playable startup. Immutable names
 * and descriptor are produced by scripts/character-assets/publish-region-crowd.mjs.
 * Metadata changes also require updating its exact public/_headers entry.
 * https://developers.cloudflare.com/pages/configuration/headers/
 */
export const REGION_ACTOR_RELEASE = Object.freeze({
  assetRoot: '/ashen-reach/region-actors-v1',
  preparedAsset: Object.freeze({
    file: '46c726f07044d09f00aaf64d7e3e0347b3b4c5c641703d1f08ff993c326de05a.json',
    sha256: '46c726f07044d09f00aaf64d7e3e0347b3b4c5c641703d1f08ff993c326de05a',
    bytes: 15149,
  }),
});
