import assert from 'node:assert/strict';

/** The adapter revision describes semantic mesh visibility; these separate
 * source policies pin the actually reviewed index partitions. A historical
 * strict partition is useful for source auditions but must not reach release.
 * https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#meshes
 */
export function verifyHumanCoveragePolicy(manifest,{identity=false}={}){
 const row=identity?manifest.identity:manifest.coverageProof?.find(r=>r.id==='body');
 const torso=identity?row?.torsoCoverage:row,foot=identity?row?.footCoverage:row?.footCoverage;
 assert.equal(identity?torso?.revision:torso?.partitionPolicy,'human-medial-back-v1','Missing reviewed Human back policy');
 assert.equal(torso?.partition?.coveredTriangles,446,'Unreviewed Human torso partition');
 assert.equal(foot?.revision,'human-ankle-foot-v1','Missing reviewed Human foot policy');
 assert.equal(foot?.partition?.coveredTriangles,448,'Unreviewed Human foot partition');
 const proof=identity?torso?.verification:row?.verification;
 assert.equal(proof?.triangles,torso.partition.originalTriangles,'Invalid Human triangle union');
 assert.equal(foot.partition.originalTriangles,proof.triangles-torso.partition.coveredTriangles,'Invalid Human sequential partition');
 for(const field of ['attributesExact','morphsExact','skinExact','framesExact','sourceAnimationExact'])assert.equal(proof[field],true,`Missing Human ${field} proof`);
 assert.deepEqual(manifest.coverage?.bodySegments?.HumanFootCore,['foot'],'Missing Human foot adapter');
 assert(!manifest.coverage.bodySegments.HumanV1Body.includes('foot'),'Foot must have its own visibility boundary');
 for(const body of [manifest.items?.body,manifest.compactItems?.body].filter(Boolean))assert(body.meshes.includes('HumanFootCore'),'Body lacks reviewed foot mesh');
}
