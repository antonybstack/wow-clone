/**
 * M007: garment fit at body extremes **under motion**, not in the rest pose.
 *
 * `measure-shape-garment-fit.mjs` measures the shared rest pose and says in its own header
 * that a clean rest-pose result would not prove a clean walk cycle. This poses the body and
 * the garments through the actual clips with the actual bind, and runs the same coverage
 * classification at sampled times.
 *
 * The control is the **neutral body in the same pose**, not the rest pose. A crouch exposes
 * the small of the back on any body; only the difference against neutral at that same instant
 * is something the shape broke. Comparing a posed shaped body against a rest-pose neutral
 * would report the pose as a defect.
 *
 * Height is swept separately rather than crossed with everything else. It is a uniform scale
 * on the visual root and the garments hang from that same root, so body and cloth scale
 * together and the *fit* cannot change. The measurement is not quite scale-free, though: the
 * coverage ray is an absolute 60 mm, so at 1.15x it reaches relatively less far and a few
 * marginal vertices change side. `ASHEN_HEIGHT_SWEEP=1` measures that directly instead of
 * asserting invariance, and the result is reported as the metric's own scale sensitivity.
 *
 * Deformation order is morph-then-skin, matching the renderer. Skinning is validated against
 * the bind pose before any measurement runs; see `pose-skin.mjs`.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {MeshoptDecoder, MeshoptEncoder} from 'meshoptimizer';
import {boundaryVertices, classifyCoverage, rayHitsTriangle, vertexNormals} from './garment-coverage.mjs';
import {
    animationDuration, applyMorph, bindPoseResidual, globalMatrices, globalMatricesByName,
    jointMatrices, jointMatricesFromNamed, poseNodes, skinPositions,
} from './pose-skin.mjs';

const BODY = '.cache/character-mmo/m004/human-shape-family-v1.glb';
const FIT_DIR = '.cache/character-mmo/m005';
const OUT = process.env.ASHEN_POSED_FIT_REPORT || 'docs/baselines/character-mmo/m007/posed-garment-fit.json';
const SAMPLES = Number(process.env.ASHEN_POSE_SAMPLES || 5);
const NEAR_M = 0.06;   // beyond this a body vertex is not in the garment's neighbourhood
// A newly uncovered vertex this close to a garment's own edge is hem churn, not a defect.
// Under motion the raw covered/uncovered count is dominated by body vertices crossing a hem
// as the torso turns: the exchange is near-symmetric (across 600 rows the mean of
// newlyUncovered - newlyCovered is -3.0, i.e. slightly more skin goes *under* the cloth than
// comes out of it), which is not what a garment failing to contain a body looks like. The
// headline number therefore excludes the hem band and counts only skin that escaped well
// inside the garment's area.
const HEM_M = Number(process.env.ASHEN_HEM_M || 0.03);

/**
 * Body regions no equipped slot claims, by the joint that skins them.
 *
 * With no gloves and no helmet in these outfits, hands and head are bare in the neutral
 * configuration and in every shaped one, so they can never be something a shape broke. They
 * still register as "newly uncovered" because the 60 mm ray happens to reach a trouser leg
 * or a hem next to a hanging hand on one body and not on the other. On the worst slender
 * row that artifact was the entire result: all 80 flagged vertices were skinned by
 * `mixamorig:*Hand*` and finger joints. M007's coverage contract already says which slots
 * claim which body segments; this is the same idea applied per vertex.
 */
const UNCLAIMED_JOINT = /Hand|Thumb|Index|Middle|Ring|Pinky|Head|Neck|Eye/;
const TARGETS = ['slender', 'stout'];

/** Outfits as the catalogue actually mixes them. */
const OUTFITS = {
    wayfarer: ['wayfarerTunic', 'wayfarerTrousers', 'wayfarerBoots'],
    graveweaver: ['graveweaverTop', 'graveweaverSkirt', 'graveweaverGloves'],
    // The mixed cases M007 cares about: a piece from each set on one body.
    'mixed-top-wayfarer': ['wayfarerTunic', 'graveweaverSkirt', 'wayfarerBoots'],
    'mixed-top-graveweaver': ['graveweaverTop', 'wayfarerTrousers', 'wayfarerBoots'],
};
/** Clips that actually spend the garment's margin. */
const CLIPS = (process.env.ASHEN_POSE_CLIPS || [
    'Idle_Loop', 'Walk_Loop', 'Jog_Fwd_Loop', 'Sprint_Loop',
    'Jump_Start', 'Jump_Loop', 'Jump_Land',
    'Crouch_Idle_Loop', 'Crouch_Fwd_Loop', 'Roll',
    'Sword_Attack', 'FireBlast_Upper', 'PyreBurst_Upper', 'Turn90_L', 'Hit_Chest',
].join(',')).split(',');

await MeshoptDecoder.ready;
await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
    'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder,
});

const doc = await io.read(BODY);
const root = doc.getRoot();
const skin = root.listSkins()[0];
const bodyPrim = root.listMeshes().find(m => m.getName() === 'HumanV1Body').listPrimitives()[0];
const bodyBase = bodyPrim.getAttribute('POSITION').getArray();
const bodyJoints = bodyPrim.getAttribute('JOINTS_0').getArray();
const bodyWeights = bodyPrim.getAttribute('WEIGHTS_0').getArray();
const bodyIndices = bodyPrim.getIndices().getArray();
const bodyTargets = bodyPrim.listTargets();
const bodyTargetNames = root.listMeshes().find(m => m.getName() === 'HumanV1Body').getExtras()?.targetNames || TARGETS;

const residual = bindPoseResidual(root, skin, bodyBase, bodyJoints, bodyWeights);
if (residual > 1e-5) throw Error(`Skinning is wrong: bind-pose residual ${residual} m`);

// Vertices whose dominant joint belongs to a region none of these outfits covers.
const jointNames = skin.listJoints().map(j => j.getName());
const countable = new Uint8Array(bodyBase.length / 3);
for (let v = 0; v < countable.length; v++) {
    let best = -1, bw = -1;
    for (let k = 0; k < 4; k++) {
        const w = bodyWeights[v * 4 + k];
        if (w > bw) { bw = w; best = bodyJoints[v * 4 + k]; }
    }
    countable[v] = UNCLAIMED_JOINT.test(jointNames[best] ?? '') ? 0 : 1;
}
const excluded = countable.length - countable.reduce((a, b) => a + b, 0);

/** Load one refitted garment: its parts, each with its own targets on the same bind. */
async function loadGarment(id) {
    const gdoc = await io.read(path.join(FIT_DIR, `${id}.glb`));
    const groot = gdoc.getRoot();
    const gskin = groot.listSkins()[0];
    const parts = [];
    for (const mesh of groot.listMeshes()) {
        const names = mesh.getExtras()?.targetNames || [];
        for (const prim of mesh.listPrimitives()) {
            parts.push({
                name: mesh.getName(),
                base: prim.getAttribute('POSITION').getArray(),
                joints: prim.getAttribute('JOINTS_0')?.getArray(),
                weights: prim.getAttribute('WEIGHTS_0')?.getArray(),
                indices: prim.getIndices().getArray(),
                targets: prim.listTargets(),
                targetNames: names,
            });
        }
    }
    return {id, root: groot, skin: gskin, parts};
}
const garments = new Map();
for (const id of new Set(Object.values(OUTFITS).flat())) garments.set(id, await loadGarment(id));

const weightsFor = shape => bodyTargetNames.map(n => (n === shape ? 1 : 0));

/** Pose one outfit and the body, and count body vertices this shape leaves uncovered. */
function coverageAt(shape, outfit, clipName, time) {
    // `__bind__` is the unanimated bind pose. It is what reproduces the rest-pose metric, so
    // it is the control that says this posed pipeline agrees with the one already accepted.
    const clip = clipName === '__bind__' ? null : root.listAnimations().find(a => a.getName() === clipName);
    if (!clip && clipName !== '__bind__') throw Error(`Missing clip ${clipName}`);
    const bodyPose = poseNodes(root, clip, time);
    const mats = jointMatrices(skin, globalMatrices(root, bodyPose));
    // The garments have no animation of their own; at runtime they hang on the body's
    // skeleton, so they are driven by the body's posed joints matched by name.
    const bodyGlobalByName = globalMatricesByName(root, bodyPose);
    const morphed = shape === 'neutral' ? bodyBase : applyMorph(bodyBase, bodyTargets, weightsFor(shape));
    const posed = skinPositions(morphed, bodyJoints, bodyWeights, mats);
    const normals = vertexNormals(posed, bodyIndices);

    const parts = [];
    for (const id of OUTFITS[outfit]) {
        const garment = garments.get(id);
        const gmats = garment.skin ? jointMatricesFromNamed(garment.skin, bodyGlobalByName) : null;
        for (const part of garment.parts) {
            const idx = part.targetNames.indexOf(shape);
            const shaped = shape === 'neutral' || idx < 0
                ? part.base
                : applyMorph(part.base, part.targets, part.targetNames.map((_, i) => (i === idx ? 1 : 0)));
            const posedPart = gmats && part.joints && part.weights
                ? skinPositions(shaped, part.joints, part.weights, gmats)
                : shaped;
            parts.push({positions: posedPart, indices: part.indices});
        }
    }
    return {...classifyCoverage(posed, normals, parts), posed, parts};
}

/** Posed positions of every vertex on a garment's open edges: hems, cuffs and collars. */
function hemPoints(parts) {
    const points = [];
    for (const part of parts) {
        for (const v of boundaryVertices(part.indices)) {
            points.push(part.positions[v * 3], part.positions[v * 3 + 1], part.positions[v * 3 + 2]);
        }
    }
    return points;
}

const VIEW_DIRS = 8;       // horizontal directions a camera orbiting the character uses
const VIEW_REACH = 0.8;    // metres of cloth to look through before calling a vertex exposed

/**
 * Is this body vertex actually visible, or merely outside the 60 mm coverage ray?
 *
 * Coverage along the vertex normal is not the same as being seen. The Graveweaver skirt
 * flares away from the hip, so a hip vertex can fail the 60 mm ray while sitting behind
 * cloth from every direction anyone looks from. On the worst stout row in this matrix, 113
 * vertices are newly uncovered and 109 of them are hidden from all eight directions: the
 * inherited coverage count overstates the visible defect by more than an order of magnitude
 * once garments flare. This is the third metric in this file's lineage to fail that way; see
 * the header of `measure-shape-garment-fit.mjs` for the first two.
 *
 * **The body occludes itself**, so it is an occluder here too. Without that, every vertex on
 * an inner thigh is called exposed because the ray toward the other leg meets no cloth, and
 * the metric reports a large slender-body defect that is not in the rendered frame — checked
 * against neutral/slender/stout stills, where the trousers cover the hip in all three.
 */
function exposedToCamera(posed, v, parts, bodyOccluder) {
    const px = posed[v * 3], py = posed[v * 3 + 1], pz = posed[v * 3 + 2];
    for (let k = 0; k < VIEW_DIRS; k++) {
        const a = (k * 2 * Math.PI) / VIEW_DIRS, dx = Math.cos(a), dz = Math.sin(a);
        let blocked = false;
        for (const part of [...parts, bodyOccluder]) {
            const gp = part.positions, gi = part.indices;
            for (let t = 0; t < gi.length && !blocked; t += 3) {
                const p0 = gi[t] * 3, p1 = gi[t + 1] * 3, p2 = gi[t + 2] * 3;
                // Skip the triangles that use this very vertex, or the surface it sits on
                // blocks its own ray immediately.
                if (gi[t] === v || gi[t + 1] === v || gi[t + 2] === v) continue;
                if (rayHitsTriangle(px, py, pz, dx, 0, dz, VIEW_REACH,
                    gp[p0], gp[p0 + 1], gp[p0 + 2], gp[p1], gp[p1 + 1], gp[p1 + 2], gp[p2], gp[p2 + 1], gp[p2 + 2])) blocked = true;
            }
            if (blocked) break;
        }
        if (!blocked) return true;   // some direction sees it
    }
    return false;
}

/** Metres from a body vertex to the nearest garment edge. */
function distanceToHem(posed, v, hems) {
    const x = posed[v * 3], y = posed[v * 3 + 1], z = posed[v * 3 + 2];
    let best = Infinity;
    for (let i = 0; i < hems.length; i += 3) {
        const dx = x - hems[i], dy = y - hems[i + 1], dz = z - hems[i + 2];
        const d = dx * dx + dy * dy + dz * dz;
        if (d < best) best = d;
    }
    return Math.sqrt(best);
}

/**
 * Scale sensitivity of the metric to the creator's height range.
 *
 * Scaling every position uniformly is exactly what the height slider does to the rendered
 * character, so any change in the count is the metric's own absolute 60 mm ray, not a fit
 * change. Reported rather than asserted away.
 */
async function heightSweep() {
    const scaled = (arr, k) => { const out = new Float32Array(arr.length); for (let i = 0; i < arr.length; i++) out[i] = arr[i] * k; return out; };
    const out = [];
    for (const height of [0.9, 1.0, 1.15]) {
        for (const shape of TARGETS) {
            const clip = root.listAnimations().find(a => a.getName() === 'Idle_Loop');
            const bodyPose = poseNodes(root, clip, 0);
            const mats = jointMatrices(skin, globalMatrices(root, bodyPose));
            const byName = globalMatricesByName(root, bodyPose);
            const measure = which => {
                const morphed = which === 'neutral' ? bodyBase : applyMorph(bodyBase, bodyTargets, weightsFor(which));
                const posed = scaled(skinPositions(morphed, bodyJoints, bodyWeights, mats), height);
                const parts = [];
                for (const id of OUTFITS.wayfarer) {
                    const g = garments.get(id);
                    const gm = g.skin ? jointMatricesFromNamed(g.skin, byName) : null;
                    for (const part of g.parts) {
                        const i = part.targetNames.indexOf(which);
                        const sh = which === 'neutral' || i < 0 ? part.base
                            : applyMorph(part.base, part.targets, part.targetNames.map((_, k) => (k === i ? 1 : 0)));
                        parts.push({positions: scaled(gm && part.joints ? skinPositions(sh, part.joints, part.weights, gm) : sh, height),
                            indices: part.indices});
                    }
                }
                return {...classifyCoverage(posed, vertexNormals(posed, bodyIndices), parts), posed, parts};
            };
            const control = measure('neutral'), result = measure(shape);
            let lost = 0;
            for (let v = 0; v < control.covered.length; v++) {
                if (!countable[v]) continue;
                if (control.covered[v] && !result.covered[v]) lost++;
            }
            out.push({height, shape, newlyUncovered: lost});
        }
    }
    return out;
}

const rows = [];
let worst = null;
for (const outfit of Object.keys(OUTFITS)) {
    for (const clipName of CLIPS) {
        const clip = clipName === '__bind__' ? null : root.listAnimations().find(a => a.getName() === clipName);
        if (!clip && clipName !== '__bind__') { console.warn(`skipping missing clip ${clipName}`); continue; }
        const duration = clip ? (animationDuration(clip) || 0) : 0;
        for (let s = 0; s < SAMPLES; s++) {
            const time = duration * (SAMPLES === 1 ? 0 : s / (SAMPLES - 1));
            const control = coverageAt('neutral', outfit, clipName, time);
            for (const shape of TARGETS) {
                const result = coverageAt(shape, outfit, clipName, time);
                // Same definitions as the rest-pose metric: covered means a ray along the
                // body vertex's own outward normal reaches the cloth, and the number that
                // matters is what this shape lost against neutral at this same instant.
                const hems = hemPoints(result.parts);
                let lost = 0, gained = 0, inRegion = 0, covered = 0, worstGap = 0, deep = 0, deepWorst = 0, exposed = 0;
                for (let v = 0; v < control.covered.length; v++) {
                    if (!countable[v]) continue;
                    if (result.distance[v] <= NEAR_M) inRegion++;
                    if (result.covered[v]) covered++;
                    if (control.covered[v] && !result.covered[v]) {
                        lost++;
                        if (result.distance[v] !== Infinity) worstGap = Math.max(worstGap, result.distance[v]);
                        if (distanceToHem(result.posed, v, hems) > HEM_M) {
                            deep++;
                            if (result.distance[v] !== Infinity) deepWorst = Math.max(deepWorst, result.distance[v]);
                        }
                        if (exposedToCamera(result.posed, v, result.parts,
                            {positions: result.posed, indices: bodyIndices})) exposed++;
                    }
                    if (!control.covered[v] && result.covered[v]) gained++;
                }
                const row = {outfit, clip: clipName, time: Number(time.toFixed(3)), shape,
                    inGarmentRegion: inRegion,
                    coveredByGarment: covered,
                    newlyUncovered: lost,
                    newlyUncoveredAwayFromHem: deep,
                    exposedToCamera: exposed,
                    newlyCovered: gained,
                    worstNewGapMm: Number((worstGap * 1000).toFixed(1)),
                    worstDeepGapMm: Number((deepWorst * 1000).toFixed(1))};
                rows.push(row);
                if (!worst || row.exposedToCamera > worst.exposedToCamera) worst = row;
            }
        }
    }
}

const byOutfit = {};
for (const row of rows) {
    const key = `${row.outfit}/${row.shape}`;
    byOutfit[key] ??= {samples: 0, worst: 0, worstClip: null, total: 0};
    const e = byOutfit[key];
    e.samples++;
    e.total += row.exposedToCamera;
    e.worstUncovered = Math.max(e.worstUncovered ?? 0, row.newlyUncovered);
    if (row.exposedToCamera > e.worst) { e.worst = row.exposedToCamera; e.worstClip = `${row.clip}@${row.time}s`; }
}

const heightRows = process.env.ASHEN_HEIGHT_SWEEP === '1' ? await heightSweep() : null;
if (heightRows) {
    console.log('height sweep (Wayfarer, Idle_Loop@0, newly uncovered away from unclaimed regions):');
    for (const r of heightRows) console.log(`  height ${r.height.toFixed(2)}  ${r.shape.padEnd(8)} ${r.newlyUncovered}`);
}

const report = {
    generatedBy: 'scripts/character-assets/measure-posed-garment-fit.mjs',
    heightSweep: heightRows,
    body: BODY, garmentDir: FIT_DIR,
    bindPoseResidualM: Number(residual.toExponential(3)),
    method: 'morph then linear blend skin; control is the neutral body in the same pose at the same instant',
    clips: CLIPS.filter(c => root.listAnimations().some(a => a.getName() === c)),
    thresholds: {
        nearMetres: NEAR_M, coverRayMetres: 0.06, hemExclusionMetres: HEM_M,
        viewDirections: VIEW_DIRS, viewReachMetres: VIEW_REACH,
    },
    excludedVertices: {
        count: excluded, of: countable.length,
        reason: 'dominant skinning joint belongs to a region no equipped slot covers (hands, fingers, head, neck)',
    },
    metrics: {
        newlyUncovered: 'covered on the neutral body and not on this shape, in the same pose at the same instant',
        newlyUncoveredAwayFromHem: 'the same, excluding vertices within hemExclusionMetres of a garment edge',
        exposedToCamera: 'the headline: newly uncovered AND visible from at least one of viewDirections horizontal directions, with cloth and the body itself as occluders',
    },
    samplesPerClip: SAMPLES,
    outfits: OUTFITS,
    summary: Object.fromEntries(Object.entries(byOutfit).map(([k, v]) =>
        [k, {worstExposedToCamera: v.worst, at: v.worstClip, meanExposedToCamera: Number((v.total / v.samples).toFixed(2)),
            worstNewlyUncovered: v.worstUncovered, samples: v.samples}])),
    worstOverall: worst,
    rows,
};
await fs.mkdir(path.dirname(OUT), {recursive: true});
await fs.writeFile(OUT, JSON.stringify(report, null, 1) + '\n');
console.log(`bind-pose residual ${residual.toExponential(2)} m`);
for (const [k, v] of Object.entries(report.summary)) {
    console.log(`  ${k.padEnd(30)} worst ${String(v.worstExposedToCamera).padStart(3)} exposed at ${(v.at ?? '-').padEnd(26)} (mean ${v.meanExposedToCamera}; raw newly-uncovered peaks at ${v.worstNewlyUncovered})`);
}
console.log(`worst overall: ${JSON.stringify(worst)}`);
console.log(`wrote ${OUT} (${rows.length} rows)`);
