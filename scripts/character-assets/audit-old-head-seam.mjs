/** Measure the optional M006 old-head source seam without changing its art.
 * Mesh boundaries, UV seams and material colors are different failure modes;
 * this probe reports them separately before another neck/atlas adjustment.
 * glTF mesh/UV semantics: https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#meshes
 */
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import sharp from 'sharp';

const file = process.argv[2] ?? '.cache/character-mmo/m006/human-old-bald-candidate.glb';
const root = (await new NodeIO().registerExtensions(ALL_EXTENSIONS).read(file)).getRoot();
const meshes = Object.fromEntries(root.listMeshes().map(mesh => [mesh.getName(), mesh]));
const body = meshes.HumanV1Body?.listPrimitives()[0];
const head = meshes.OldBaldHeadV2Diagnostic?.listPrimitives()[0];
if (!body || !head) throw Error('Expected HumanV1Body and OldBaldHeadV2Diagnostic');

async function sampleTexture(primitive) {
    const image = primitive.getMaterial()?.getBaseColorTexture()?.getImage();
    if (!image) throw Error('Missing body/head basecolor texture');
    const {data, info} = await sharp(image).removeAlpha().raw().toBuffer({resolveWithObject: true});
    const uv = primitive.getAttribute('TEXCOORD_0')?.getArray();
    if (!uv) throw Error('Missing body/head TEXCOORD_0');
    return i => {
        const u = Math.min(info.width - 1, Math.max(0, Math.round(uv[i * 2] * (info.width - 1))));
        const v = Math.min(info.height - 1, Math.max(0, Math.round((1 - uv[i * 2 + 1]) * (info.height - 1))));
        const offset = (v * info.width + u) * info.channels;
        return Array.from(data.subarray(offset, offset + 3));
    };
}

function neckRing(primitive, sample) {
    const positions = primitive.getAttribute('POSITION').getArray();
    const colors = [];
    for (let i = 0; i < positions.length / 3; i++) {
        if (Math.abs(positions[i * 3 + 1] - 1.5) < .002) colors.push(sample(i));
    }
    if (colors.length < 20) throw Error(`Too few neck-ring vertices: ${colors.length}`);
    return {vertices: colors.length, meanSRGB: [0, 1, 2].map(c =>
        Math.round(colors.reduce((sum, rgb) => sum + rgb[c], 0) / colors.length))};
}

function headBoundaries(primitive) {
    const positions = primitive.getAttribute('POSITION').getArray();
    const indices = primitive.getIndices().getArray();
    const key = i => [0, 1, 2].map(c => Math.round(positions[i * 3 + c] * 1e4)).join(',');
    const edges = new Map();
    for (let i = 0; i < indices.length; i += 3) {
        for (const [a, b] of [[indices[i], indices[i + 1]], [indices[i + 1], indices[i + 2]], [indices[i + 2], indices[i]]]) {
            const ends = [key(a), key(b)].sort();
            const edge = ends.join('|');
            edges.set(edge, (edges.get(edge) ?? 0) + 1);
        }
    }
    return [...edges].filter(([, count]) => count === 1).filter(([edge]) =>
        edge.split('|').some(vertex => Math.abs(Number(vertex.split(',')[1]) / 1e4 - 1.5) >= .005)).length;
}

function backUvDiscontinuities(primitive, sample) {
    const positions = primitive.getAttribute('POSITION').getArray();
    const groups = new Map();
    for (let i = 0; i < positions.length / 3; i++) {
        const x = positions[i * 3], y = positions[i * 3 + 1], z = positions[i * 3 + 2];
        if (Math.abs(x) > .005 || z > -.10 || y < 1.55) continue;
        const key = [x, y, z].map(v => Math.round(v * 1e5)).join(',');
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(i);
    }
    const discontinuities = [];
    for (const indices of groups.values()) {
        if (indices.length < 2) continue;
        const colors = indices.map(sample);
        const spread = [0, 1, 2].map(c => Math.max(...colors.map(rgb => rgb[c])) - Math.min(...colors.map(rgb => rgb[c])));
        if (spread.some(value => value >= 40)) discontinuities.push({
            position: [0, 1, 2].map(c => Number(positions[indices[0] * 3 + c].toFixed(4))),
            spreadSRGB: spread,
        });
    }
    return discontinuities;
}

const bodySample = await sampleTexture(body);
const headSample = await sampleTexture(head);
const report = {
    file,
    bodyNeck: neckRing(body, bodySample),
    headNeck: neckRing(head, headSample),
    headOpenEdgesBeyondNeck: headBoundaries(head),
    backCenterUvDiscontinuities: backUvDiscontinuities(head, headSample),
};
console.log(JSON.stringify(report, null, 2));
