/**
 * M006: bring the optional old head's skin atlas into the body's skin space.
 *
 * The old/bald candidate joins a MakeHuman head to the Tripo body at a neck cut. Each
 * carries its own basecolor atlas painted by a different pipeline, so the join shows a
 * bright line: `audit-old-head-seam.mjs` measured the body rim at sRGB 162/141/130 and the
 * head rim at 229/179/143.
 *
 * Four corrections were tried before this one and all were rejected in live review: a whole
 * head PBR basecolor factor from the rim mean, a vertex-color fade from the rim, a
 * per-vertex rim ratio against the nearest body texel, and remapping the bright UV side of
 * the rear scalp onto its coincident dark side. Every one of them operated at *render* time
 * -- a material factor, a vertex attribute, a UV swap -- on an atlas that stays wrong. A
 * single multiplier also crushes tones that were already dark, which is why the face went
 * muddy while the band survived.
 *
 * This rewrites the atlas instead. It fits a per-channel affine in CIELAB from the head's
 * own skin statistics to the body's, matching both mean and spread, so the head's painted
 * detail -- the wrinkles and pores that are the whole point of an older face -- survives
 * while its tone and contrast land where the body's skin lives. This is the standard
 * statistical colour transfer, not a tint:
 * Reinhard et al., "Color Transfer between Images", IEEE CG&A 21(5), 2001.
 * https://doi.org/10.1109/38.946629
 *
 * Statistics are taken from texels the meshes actually use, on both sides of the join, so
 * the fit is about skin that meets at the cut rather than about whatever else the atlases
 * contain. Two settings were swept against the seam audit, which measures the rim tone and
 * the rear scalp UV spread separately:
 *
 *   band 0.14 m, spread matched  -> rim delta 20, scalp spread 138 -> 160 (worse)
 *   band 0.03 m, spread held     -> rim delta  9, scalp spread 128
 *   band 0.015 m, spread held    -> rim delta  0, scalp spread 130
 *
 * The rim delta is the quantity being fitted, so a zero there is the transform working as
 * specified, not an independent result. The scalp spread is *not* fitted, and it is how the
 * spread clamp earned its place: rescaling the head's contrast to the body band's magnifies
 * whatever difference already exists between two UV islands.
 *
 * A tapered variant was built and **rejected**. Applying the correction at full strength
 * everywhere matches the join and leaves the face slightly cool, because the fit comes from
 * neck skin and a neck is cooler than a face. Easing the correction from full at the cut to
 * `FACE_STRENGTH` over `FADE_M` above it restored the face's warmth and put a hard-edged
 * pale patch across the nape: the weight changes sharply where two UV islands meet there,
 * so a smooth weight in 3D is a step in texture space. Dilating the rasterised weight by
 * six passes did not remove it, which is how we know the step is in the islands and not in
 * the texels no triangle covered. The taper is reachable through `ASHEN_FACE_STRENGTH` and
 * is off by default; a cool face is a smaller defect than a patch on the neck.
 *
 * The weight is rasterised into the atlas by barycentric interpolation over the head's own
 * triangles, so it follows the UV layout rather than assuming one.
 *
 * The output is a new image in a new candidate GLB under ignored `.cache/`; the shipped
 * Human and its atlas are untouched.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import sharp from 'sharp';

const SOURCE = process.argv[2] ?? '.cache/character-mmo/m006/human-old-bald-candidate.glb';
const OUT = process.argv[3] ?? '.cache/character-mmo/m006/human-old-bald-atlas-matched.glb';
const REPORT = 'docs/baselines/character-mmo/m006/old-head-atlas-match.json';
const BODY_MESH = 'HumanV1Body';
const HEAD_MESH = 'OldBaldHeadV2Diagnostic';
const CUT_Y = 1.5;          // the neck cut, in metres
// How far from the cut skin counts as "meets at the join". A wide band fits statistics
// that are not about the join: at 0.14 m the body side pulls in chest and shoulder and the
// head side pulls in the jaw and lower face, and the corrected rim landed 31 sRGB from the
// body rim even with the spread left alone. The fit has to be about the skin that actually
// touches.
const BAND_M = Number(process.env.ASHEN_BAND_M ?? 0.015);
const FADE_M = Number(process.env.ASHEN_FADE_M ?? 0.13);        // taper distance above the cut
// 1.0 disables the taper. It is kept because the taper is reachable and was measured, not
// because it is in use: see the header.
const FACE_STRENGTH = Number(process.env.ASHEN_FACE_STRENGTH ?? 1.0);

const srgbToLinear = c => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const linearToSrgb = c => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);
const D65 = [0.95047, 1, 1.08883];
const f = t => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
const fInv = t => (t ** 3 > 216 / 24389 ? t ** 3 : (116 * t - 16) * 27 / 24389);

function rgbToLab(r, g, b) {
    const [R, G, B] = [r, g, b].map(v => srgbToLinear(v / 255));
    const x = (0.4124564 * R + 0.3575761 * G + 0.1804375 * B) / D65[0];
    const y = (0.2126729 * R + 0.7151522 * G + 0.0721750 * B) / D65[1];
    const z = (0.0193339 * R + 0.1191920 * G + 0.9503041 * B) / D65[2];
    const [fx, fy, fz] = [f(x), f(y), f(z)];
    return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

function labToRgb(L, a, bb) {
    const fy = (L + 16) / 116, fx = fy + a / 500, fz = fy - bb / 200;
    const x = fInv(fx) * D65[0], y = fInv(fy) * D65[1], z = fInv(fz) * D65[2];
    const R = 3.2404542 * x - 1.5371385 * y - 0.4985314 * z;
    const G = -0.9692660 * x + 1.8760108 * y + 0.0415560 * z;
    const B = 0.0556434 * x - 0.2040259 * y + 1.0572252 * z;
    return [R, G, B].map(v => Math.max(0, Math.min(255, Math.round(linearToSrgb(Math.max(0, Math.min(1, v))) * 255))));
}

async function readAtlas(primitive) {
    const texture = primitive.getMaterial()?.getBaseColorTexture();
    const image = texture?.getImage();
    if (!image) throw Error('missing basecolor texture');
    const {data, info} = await sharp(Buffer.from(image)).removeAlpha().raw().toBuffer({resolveWithObject: true});
    return {texture, data, info};
}

/** Texels the mesh actually uses, restricted to vertices within `BAND_M` of the cut. */
function bandTexels(primitive, atlas) {
    const positions = primitive.getAttribute('POSITION').getArray();
    const uv = primitive.getAttribute('TEXCOORD_0').getArray();
    const {data, info} = atlas;
    const out = [];
    for (let i = 0; i < positions.length / 3; i++) {
        if (Math.abs(positions[i * 3 + 1] - CUT_Y) > BAND_M) continue;
        const u = Math.min(info.width - 1, Math.max(0, Math.round(uv[i * 2] * (info.width - 1))));
        const v = Math.min(info.height - 1, Math.max(0, Math.round((1 - uv[i * 2 + 1]) * (info.height - 1))));
        const offset = (v * info.width + u) * info.channels;
        out.push(rgbToLab(data[offset], data[offset + 1], data[offset + 2]));
    }
    if (out.length < 20) throw Error(`only ${out.length} band texels`);
    return out;
}

const stats = (samples) => [0, 1, 2].map((c) => {
    const values = samples.map(s => s[c]);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
    return {mean, sd: Math.sqrt(variance)};
});

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(SOURCE);
const root = doc.getRoot();
const meshes = Object.fromEntries(root.listMeshes().map(m => [m.getName(), m]));
const bodyPrim = meshes[BODY_MESH]?.listPrimitives()[0];
const headPrim = meshes[HEAD_MESH]?.listPrimitives()[0];
if (!bodyPrim || !headPrim) throw Error(`expected ${BODY_MESH} and ${HEAD_MESH}`);

const bodyAtlas = await readAtlas(bodyPrim);
const headAtlas = await readAtlas(headPrim);
const target = stats(bandTexels(bodyPrim, bodyAtlas));
const source = stats(bandTexels(headPrim, headAtlas));

// Per channel: recentre and rescale spread. Guard a degenerate spread so a flat channel
// cannot blow up; a gain far from 1 would be a sign the two samples are not comparable.
// How far the spread may be rescaled. Matching the body band's spread outright stretches
// L* by 2.1x here, because that band carries the body's baked torso shading while the head
// atlas is comparatively flat. That stretch also magnifies any difference already present
// between two UV islands: it cut the neck delta to 20 and pushed the rear scalp seam spread
// from 138 to 160. A tight clamp keeps the tone match and leaves the head's own contrast
// alone, which is the part the rear seam is sensitive to.
// How much of the fitted L* offset to apply. The head and the body differ in hue far more
// than in lightness: measured across the rendered join, the uncorrected candidate is only
// 8 sRGB apart in luminance but 44 apart in warmth (R-B). Applying the full L* offset moved
// the head down ~67 sRGB, turning a luminance match into a 20-point mismatch and making the
// worst per-channel error at the join *worse* than doing nothing (23 -> 28), which is what
// put a dark ashen mask on a pale body. Chroma is fitted in full; lightness is left to the
// head's own art, which is also what preserves its shading and pore detail.
// 0: chroma is matched in full, lightness is left to the head's own art.
//
// An earlier sweep chose 0.20. That sweep was measured by searching each build for its own
// largest step in the neck band, and once the correction lands the join stops being the
// largest step there, so the search drifted onto the brow and the window edge and scored the
// wrong rows. Re-swept across the join row itself -- pinned from the uncorrected control,
// where the camera and pose are identical -- the worst per-channel step across the seam,
// front-quarter / back, is:
//
//   uncorrected 21.7 / 33.2    L=0  8.0 / 7.4    L=0.10  4.2 / 9.6
//   L=0.20  4.7 / 13.7         L=0.30  7.6 / 16.8      L=0.40  12.1 / 17.6
//
// A seam is judged by where it is worst, not by the average of two views, so 0 wins: 8.0
// against 9.6 for the next best. It is also the value the physical argument above predicts.
const L_MATCH = Number(process.env.ASHEN_L_MATCH ?? 0);
const SPREAD_LIMIT = Number(process.env.ASHEN_SPREAD_LIMIT ?? 1.0);
const gains = source.map((s, c) => (s.sd > 1e-3
    ? Math.min(SPREAD_LIMIT, Math.max(1 / SPREAD_LIMIT, target[c].sd / s.sd))
    : 1));

const {data, info} = headAtlas;

// Per-texel correction strength, rasterised from the head's own triangles.
// NaN marks "no head triangle covers this texel". Filling those with a constant instead
// put a hard-edged pale patch across the nape, where a UV island boundary meets texels the
// bilinear filter still reaches. They are dilated from real neighbours below.
const strength = new Float32Array(info.width * info.height).fill(NaN);
{
    const positions = headPrim.getAttribute('POSITION').getArray();
    const uv = headPrim.getAttribute('TEXCOORD_0').getArray();
    const indices = headPrim.getIndices().getArray();
    const vertexWeight = (i) => {
        const above = positions[i * 3 + 1] - CUT_Y;
        const k = Math.max(0, Math.min(1, 1 - above / FADE_M));   // 1 at the cut, 0 by FADE_M
        return FACE_STRENGTH + (1 - FACE_STRENGTH) * k;
    };
    const px = i => [uv[i * 2] * (info.width - 1), (1 - uv[i * 2 + 1]) * (info.height - 1)];
    for (let t = 0; t < indices.length; t += 3) {
        const [a, b, c] = [indices[t], indices[t + 1], indices[t + 2]];
        const [pa, pb, pc] = [px(a), px(b), px(c)];
        const [wa, wb, wc] = [vertexWeight(a), vertexWeight(b), vertexWeight(c)];
        const minX = Math.max(0, Math.floor(Math.min(pa[0], pb[0], pc[0])) - 1);
        const maxX = Math.min(info.width - 1, Math.ceil(Math.max(pa[0], pb[0], pc[0])) + 1);
        const minY = Math.max(0, Math.floor(Math.min(pa[1], pb[1], pc[1])) - 1);
        const maxY = Math.min(info.height - 1, Math.ceil(Math.max(pa[1], pb[1], pc[1])) + 1);
        const area = (pb[0] - pa[0]) * (pc[1] - pa[1]) - (pc[0] - pa[0]) * (pb[1] - pa[1]);
        if (Math.abs(area) < 1e-9) continue;
        for (let y = minY; y <= maxY; y++) {
            for (let x = minX; x <= maxX; x++) {
                const l0 = ((pb[0] - x) * (pc[1] - y) - (pc[0] - x) * (pb[1] - y)) / area;
                const l1 = ((pc[0] - x) * (pa[1] - y) - (pa[0] - x) * (pc[1] - y)) / area;
                const l2 = 1 - l0 - l1;
                // A small negative tolerance fills the texels bilinear filtering reaches for
                // just outside a triangle, so an island edge does not band.
                if (l0 < -0.06 || l1 < -0.06 || l2 < -0.06) continue;
                strength[y * info.width + x] = l0 * wa + l1 * wb + l2 * wc;
            }
        }
    }
}

// Grow the rasterised weights outward so island edges carry a neighbour's value rather
// than a step to a default.
{
    const w = info.width, h = info.height;
    for (let pass = 0; pass < 6; pass++) {
        const next = Float32Array.from(strength);
        let filled = 0;
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const i = y * w + x;
                if (!Number.isNaN(strength[i])) continue;
                let sum = 0, n = 0;
                for (let dy = -1; dy <= 1; dy++) {
                    for (let dx = -1; dx <= 1; dx++) {
                        const yy = y + dy, xx = x + dx;
                        if (yy < 0 || yy >= h || xx < 0 || xx >= w) continue;
                        const v = strength[yy * w + xx];
                        if (!Number.isNaN(v)) { sum += v; n++; }
                    }
                }
                if (n) { next[i] = sum / n; filled++; }
            }
        }
        strength.set(next);
        if (!filled) break;
    }
    for (let i = 0; i < strength.length; i++) if (Number.isNaN(strength[i])) strength[i] = FACE_STRENGTH;
}

const corrected = Buffer.alloc(data.length);
for (let i = 0, texel = 0; i < data.length; i += info.channels, texel++) {
    const [L, a, b] = rgbToLab(data[i], data[i + 1], data[i + 2]);
    const lab = [L, a, b].map((v, c) => {
        const fitted = target[c].mean + (v - source[c].mean) * gains[c];
        return c === 0 ? v + (fitted - v) * L_MATCH : fitted;
    });
    const rgb = labToRgb(lab[0], Math.max(-128, Math.min(127, lab[1])), Math.max(-128, Math.min(127, lab[2])));
    const w = strength[texel];
    corrected[i] = Math.round(data[i] + (rgb[0] - data[i]) * w);
    corrected[i + 1] = Math.round(data[i + 1] + (rgb[1] - data[i + 1]) * w);
    corrected[i + 2] = Math.round(data[i + 2] + (rgb[2] - data[i + 2]) * w);
    for (let c = 3; c < info.channels; c++) corrected[i + c] = data[i + c];
}
const png = await sharp(corrected, {raw: {width: info.width, height: info.height, channels: info.channels}})
    .png({compressionLevel: 9}).toBuffer();
headPrim.getMaterial().getBaseColorTexture().setImage(png).setMimeType('image/png');

await fs.mkdir(path.dirname(OUT), {recursive: true});
const outBytes = await io.writeBinary(doc);
await fs.writeFile(OUT, outBytes);

const report = {
    schema: 1,
    generatedBy: 'scripts/character-assets/match-old-head-atlas.mjs',
    method: 'per-channel affine in CIELAB fitted on texels both meshes use within the neck band, applied to the head atlas',
    reference: 'Reinhard et al., Color Transfer between Images, IEEE CG&A 21(5) 2001',
    source: {path: SOURCE},
    output: {path: OUT, sha256: createHash('sha256').update(outBytes).digest('hex'), bytes: outBytes.byteLength},
    band: {cutY: CUT_Y, metres: BAND_M},
    spreadLimit: SPREAD_LIMIT,
    lightnessMatch: L_MATCH,
    taper: {fadeMetres: FADE_M, faceStrength: FACE_STRENGTH},
    atlas: {width: info.width, height: info.height, channels: info.channels},
    labStats: {
        bodyBand: target.map(s => ({mean: Number(s.mean.toFixed(3)), sd: Number(s.sd.toFixed(3))})),
        headBand: source.map(s => ({mean: Number(s.mean.toFixed(3)), sd: Number(s.sd.toFixed(3))})),
        gains: gains.map(g => Number(g.toFixed(4))),
    },
};
await fs.mkdir(path.dirname(REPORT), {recursive: true});
await fs.writeFile(REPORT, `${JSON.stringify(report, null, 1)}\n`);
console.log('body band L*a*b*', target.map(s => `${s.mean.toFixed(1)}±${s.sd.toFixed(1)}`).join('  '));
console.log('head band L*a*b*', source.map(s => `${s.mean.toFixed(1)}±${s.sd.toFixed(1)}`).join('  '));
console.log('gains', gains.map(g => g.toFixed(3)).join(', '));
console.log(`wrote ${OUT} (${outBytes.byteLength} bytes)`);
