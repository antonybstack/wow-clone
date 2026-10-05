import {BODY_SEGMENTS} from './coverage-contract.js';
/** A published body split and its semantic adapter are one versioned artifact.
 * Never infer that a fused body has geosets just because an item covers a slot.
 * https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#meshes
 */
export const PUBLISHED_COVERAGE_REVISION='conservative-geosets-v1';
// This is the semantic adapter schema. Reviewed geometry policies are recorded
// separately in coverageProof/identity; the build verifies them independently.
export function manifestBodyCoverage(manifest,race){
 const coverage=manifest.coverage;
 if(!coverage)return null;
 if(coverage.schema!==1||coverage.revision!==PUBLISHED_COVERAGE_REVISION||coverage.race!==race||!coverage.bodySegments||Array.isArray(coverage.bodySegments))throw Error('Unsupported published body coverage');
 const entries=Object.entries(coverage.bodySegments);
 if(!entries.length||entries.some(([mesh,segments])=>!mesh||!Array.isArray(segments)||!segments.length||new Set(segments).size!==segments.length||segments.some(s=>!BODY_SEGMENTS.includes(s))))throw Error('Invalid published body coverage adapter');
 const baseMeshes=entries.map(([mesh])=>mesh),body=manifest.items?.body;
 if(!body||JSON.stringify([...body.meshes].sort())!==JSON.stringify([...baseMeshes].sort()))throw Error('Published body meshes disagree with coverage');
 if(race!=='orc'&&body.coverageRevision!==coverage.revision)throw Error('Published body lacks matching coverage revision');
 return {baseMeshes,bodySegments:coverage.bodySegments,revision:coverage.revision};
}
