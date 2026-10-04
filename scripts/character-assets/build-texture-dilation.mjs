/** Fill the white background of a garment atlas with its own island colours. Candidates only.
 *
 * The pale specks along garment seams are not geometry, a material or a pass. Every one of those
 * was ruled out: dyeing the piece, pushing the shell 10 mm off the foot, single-sided faces,
 * dropping the normal map, the ORM, the emissive, the lighting plugins, specular AA, the
 * grounding/occlusion pass and the whole post pipeline. The atlases are UV islands on a **pure
 * white background with no dilation** -- 25.7% of the boot's albedo and 30.6% of the tunic's is
 * pure white -- so bilinear filtering and every mip level blend that white into the island
 * borders, which is a bright fringe along exactly the seams and silhouettes where the specks are.
 *
 * `pilgrimTunic` has no white background at all, and it is the one design that reads clean.
 *
 * The fix is the standard one: flood the background outward from the island edges so a texel
 * sampled just outside an island carries the island's colour rather than white. Background is
 * found by flooding inward from the border, so white *inside* an island is left alone.
 * https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#texture-data
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { NodeIO, VertexLayout } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';

await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready]);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder })
    .setVertexLayout(VertexLayout.SEPARATE);
const OUT = process.env.ASHEN_DILATE_OUT || '.cache/character-mmo/texture-dilation';
assert(!path.resolve(OUT).startsWith(path.resolve('public') + path.sep), 'Candidates are not written into public/');
const THRESHOLD = Number(process.env.ASHEN_WHITE || 250);
const sha = b => createHash('sha256').update(b).digest('hex');

/** Background = pure white reachable from the border, so white inside an island survives. */
function backgroundMask(data, width, height, channels) {
    const isWhite = i => data[i * channels] >= THRESHOLD && data[i * channels + 1] >= THRESHOLD && data[i * channels + 2] >= THRESHOLD;
    const background = new Uint8Array(width * height);
    const queue = [];
    for (let x = 0; x < width; x++) {
        for (const y of [0, height - 1]) { const i = y * width + x; if (isWhite(i) && !background[i]) { background[i] = 1; queue.push(i); } }
    }
    for (let y = 0; y < height; y++) {
        for (const x of [0, width - 1]) { const i = y * width + x; if (isWhite(i) && !background[i]) { background[i] = 1; queue.push(i); } }
    }
    while (queue.length) {
        const i = queue.pop(), x = i % width, y = (i / width) | 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
            const j = ny * width + nx;
            if (background[j] || !isWhite(j)) continue;
            background[j] = 1; queue.push(j);
        }
    }
    return background;
}

/** Repeatedly give each background texel the mean of its filled neighbours. */
function dilate(data, width, height, channels, background, passes) {
    const filled = Uint8Array.from(background, v => (v ? 0 : 1));
    for (let pass = 0; pass < passes; pass++) {
        const next = Uint8Array.from(filled);
        let changed = 0;
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const i = y * width + x;
                if (filled[i]) continue;
                let r = 0, g = 0, b = 0, n = 0;
                for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
                    const nx = x + dx, ny = y + dy;
                    if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
                    const j = ny * width + nx;
                    if (!filled[j]) continue;
                    r += data[j * channels]; g += data[j * channels + 1]; b += data[j * channels + 2]; n++;
                }
                if (!n) continue;
                data[i * channels] = Math.round(r / n);
                data[i * channels + 1] = Math.round(g / n);
                data[i * channels + 2] = Math.round(b / n);
                next[i] = 1; changed++;
            }
        }
        filled.set(next);
        if (!changed) return pass + 1;
    }
    return passes;
}

const report = { threshold: THRESHOLD, rows: [] };
await fs.mkdir(OUT, { recursive: true });
for (const id of (process.env.ASHEN_ITEMS || 'wayfarerBoots,duskguardGreaves,wayfarerTunic,graveweaverTop,lectorCoat,duskguardCuirass,wayfarerTrousers,graveweaverSkirt,duskguardTassets,graveweaverGloves,duskguardVambraces,wardenPauldrons,graveweaverHood').split(',')) {
    const source = `public/ashen-reach/equipment/${id}.glb`;
    if (!await fs.stat(source).catch(() => null)) { console.log(JSON.stringify({ item: id, skipped: 'no published glb' })); continue; }
    const document = await io.read(source);
    const textures = [...new Set(document.getRoot().listMaterials().map(m => m.getBaseColorTexture()).filter(Boolean))];
    let touched = 0, before = 0, after = 0, passesUsed = 0;
    for (const texture of textures) {
        const image = sharp(Buffer.from(texture.getImage()));
        const { width, height } = await image.metadata();
        const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
        const background = backgroundMask(data, width, height, info.channels);
        const count = background.reduce((a, v) => a + v, 0);
        if (!count) continue;
        before += count / (width * height);
        passesUsed = Math.max(passesUsed, dilate(data, width, height, info.channels, background, 64));
        const encoded = await sharp(data, { raw: { width, height, channels: info.channels } }).png({ compressionLevel: 9 }).toBuffer();
        texture.setImage(encoded).setMimeType('image/png');
        const check = await sharp(encoded).raw().toBuffer({ resolveWithObject: true });
        after += backgroundMask(check.data, width, height, check.info.channels).reduce((a, v) => a + v, 0) / (width * height);
        touched++;
    }
    if (!touched) { console.log(JSON.stringify({ item: id, backgroundShare: 0, note: 'already dilated' })); continue; }
    const target = path.join(OUT, `${id}.glb`);
    await io.write(target, document);
    const row = {
        item: id, source, candidate: target, textures: touched, passes: passesUsed,
        backgroundShareBefore: +(before / touched).toFixed(4), backgroundShareAfter: +(after / touched).toFixed(4),
        sourceSha256: sha(await fs.readFile(source)), candidateSha256: sha(await fs.readFile(target)),
        sourceBytes: (await fs.stat(source)).size, candidateBytes: (await fs.stat(target)).size,
    };
    report.rows.push(row);
    console.log(JSON.stringify({ item: id, before: row.backgroundShareBefore, after: row.backgroundShareAfter, passes: row.passes, bytes: `${row.sourceBytes}->${row.candidateBytes}` }));
}
await fs.writeFile(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
console.log('wrote', path.join(OUT, 'report.json'));
