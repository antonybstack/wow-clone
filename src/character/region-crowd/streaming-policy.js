/** Bounded desktop proof policy, measured in region-streaming-2026-10-01.
 * Eight exact arrivals fit the first eight-client room; two hidden idle fits
 * retain ~19.4 MB of observed mesh buffers/textures (driver total is unknown).
 * Lower overrides are experiments; physical phone capacity is not accepted.
 * https://developer.mozilla.org/en-US/docs/Web/API/GPUBuffer/size
 */
export const REGION_STREAMING_LIMITS=Object.freeze({pending:32,exact:8,idleExact:2});
export const REGION_IMMUTABLE_BYTES=8*1024*1024;
export const REGION_PRIORITIES=Object.freeze({local:0,targetParty:1,nearby:2,visibleDistant:3,refinement:4});
