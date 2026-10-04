/** Give the boot a standoff where the foot currently fights it. Writes candidates only.
 *
 * Dyeing the boot separated the speckles at close range: the ankle ones take the dye and are the
 * boot's own geometry, the toe ones stay skin-coloured and are the body's foot. Measured, 38 of
 * 490 foot vertices are outside the shell at the idle, the closest by 0.01 mm — the surfaces are
 * coincident, not grossly interpenetrating, which is why it reads as scattered bright pixels
 * rather than a hole.
 *
 * The fix is the standoff M005 established for every other garment: push the shell out along its
 * own normals where the foot is exposed, with falloff, so nothing else about the silhouette
 * moves. 2.5 mm on a 250 mm foot is 1% — decisive against a 0.01 mm coincidence and invisible as
 * bulk.
 * https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#skins
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { NodeIO, VertexLayout } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import { classifyCoverage, vertexNormals } from './garment-coverage.mjs';
import { globalMatricesByName, jointMatricesFromNamed, poseNodes, skinPositions } from './pose-skin.mjs';

await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready]);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder })
    .setVertexLayout(VertexLayout.SEPARATE);
const BODY = 'public/ashen-reach/equipment/body.glb';
const OUT = process.env.ASHEN_BOOT_OUT || '.cache/character-mmo/boot-clearance';
assert(!path.resolve(OUT).startsWith(path.resolve('public') + path.sep), 'Candidates are not written into public/');
const CLIPS = (process.env.ASHEN_CLIPS || 'Idle_Loop,Walk_Loop,Sprint_Loop,Jog_Bwd_Loop').split(',');
const STANDOFF = Number(process.env.ASHEN_STANDOFF || 0.0025);
const FALLOFF = Number(process.env.ASHEN_FALLOFF || 0.035);
const FOOT_CUT = 0.12;
const sha = b => createHash('sha256').update(b).digest('hex');

const bodyRoot = (await io.read(BODY)).getRoot();
const bodySkin = bodyRoot.listSkins()[0];
const bodyPrim = bodyRoot.listMeshes().find(m => m.getName() === 'HumanV1Body').listPrimitives()[0];
const bodyBase = bodyPrim.getAttribute('POSITION').getArray();
const bodyJoints = bodyPrim.getAttribute('JOINTS_0').getArray();
const bodyWeights = bodyPrim.getAttribute('WEIGHTS_0').getArray();
const bodyIndices = bodyPrim.getIndices().getArray();
const clips = new Map(bodyRoot.listAnimations().map(c => [c.getName(), c]));

/** Posed body and the joint palette each clip produces, computed once and reused per boot. */
const poses = CLIPS.map(name => {
    assert(clips.has(name), `${BODY} has no clip ${name}`);
    const pose = poseNodes(bodyRoot, clips.get(name), 0);
    const byName = globalMatricesByName(bodyRoot, pose);
    const posed = skinPositions(bodyBase, bodyJoints, bodyWeights, jointMatricesFromNamed(bodySkin, byName));
    return { name, byName, posed, normals: vertexNormals(posed, bodyIndices) };
});

function partsOf(root, byName) {
    const skin = root.listSkins()[0];
    const mats = jointMatricesFromNamed(skin, byName);
    const parts = [];
    for (const mesh of root.listMeshes()) {
        for (const prim of mesh.listPrimitives()) {
            const p = prim.getAttribute('POSITION').getArray();
            const j = prim.getAttribute('JOINTS_0')?.getArray(), w = prim.getAttribute('WEIGHTS_0')?.getArray();
            parts.push({ prim, mesh: mesh.getName(), bind: p, positions: j && w ? skinPositions(p, j, w, mats) : p, indices: prim.getIndices().getArray() });
        }
    }
    return parts;
}
/** Body foot vertices the boot does not cover, in posed space. */
function exposedFoot(parts, pose) {
    const { distance, covered } = classifyCoverage(pose.posed, pose.normals, parts);
    const out = [];
    for (let v = 0; v < bodyBase.length / 3; v++) {
        if (bodyBase[v * 3 + 1] > FOOT_CUT || covered[v]) continue;
        if (!Number.isFinite(distance[v]) || distance[v] > 0.05) continue;
        out.push(v);
    }
    return out;
}

const report = { body: BODY, clips: CLIPS, standoff: STANDOFF, falloff: FALLOFF, rows: [] };
await fs.mkdir(OUT, { recursive: true });
for (const id of (process.env.ASHEN_BOOTS || 'wayfarerBoots,duskguardGreaves').split(',')) {
    const source = `public/ashen-reach/equipment/${id}.glb`;
    const document = await io.read(source);
    const root = document.getRoot();
    const before = [];
    // Accumulate, over every clip, how much each boot vertex must move out.
    const push = new Map();   // prim -> Float32Array of per-vertex scalar
    for (const pose of poses) {
        const parts = partsOf(root, pose.byName);
        const exposed = exposedFoot(parts, pose);
        before.push({ clip: pose.name, exposed: exposed.length });
        for (const part of parts) {
            if (!push.has(part.prim)) push.set(part.prim, new Float32Array(part.bind.length / 3));
            const scalar = push.get(part.prim);
            for (let g = 0; g < part.positions.length / 3; g++) {
                let nearest = Infinity;
                for (const v of exposed) {
                    const dx = part.positions[g * 3] - pose.posed[v * 3];
                    const dy = part.positions[g * 3 + 1] - pose.posed[v * 3 + 1];
                    const dz = part.positions[g * 3 + 2] - pose.posed[v * 3 + 2];
                    const d = Math.hypot(dx, dy, dz);
                    if (d < nearest) nearest = d;
                }
                if (nearest >= FALLOFF) continue;
                // Smoothstep, so the pushed region blends into the rest of the shell.
                const t = 1 - nearest / FALLOFF;
                scalar[g] = Math.max(scalar[g], STANDOFF * t * t * (3 - 2 * t));
            }
        }
    }
    // Apply in bind space along the bind normals: the boot rides the same joints as the foot,
    // so a bind-space standoff carries through every pose the fitting already validated.
    let moved = 0, maxMove = 0;
    for (const [prim, scalar] of push) {
        const position = prim.getAttribute('POSITION');
        const normal = prim.getAttribute('NORMAL');
        const p = Float32Array.from(position.getArray());
        const n = normal.getArray();
        for (let g = 0; g < scalar.length; g++) {
            if (!scalar[g]) continue;
            p[g * 3] += n[g * 3] * scalar[g];
            p[g * 3 + 1] += n[g * 3 + 1] * scalar[g];
            p[g * 3 + 2] += n[g * 3 + 2] * scalar[g];
            moved++; maxMove = Math.max(maxMove, scalar[g]);
        }
        position.setArray(p);
    }
    const target = path.join(OUT, `${id}.glb`);
    await io.write(target, document);
    // Re-measure against the written candidate, not the in-memory one.
    const after = [];
    const rebuilt = (await io.read(target)).getRoot();
    for (const pose of poses) after.push({ clip: pose.name, exposed: exposedFoot(partsOf(rebuilt, pose.byName), pose).length });
    const row = {
        item: id, source, candidate: target,
        sourceSha256: sha(await fs.readFile(source)), candidateSha256: sha(await fs.readFile(target)),
        movedVertices: moved, maxMoveM: +maxMove.toFixed(5), before, after,
    };
    report.rows.push(row);
    console.log(JSON.stringify({ item: id, moved, maxMove: row.maxMoveM, before: before.map(b => b.exposed), after: after.map(a => a.exposed) }));
}
await fs.writeFile(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
console.log('wrote', path.join(OUT, 'report.json'));
