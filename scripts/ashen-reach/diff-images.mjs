import sharp from 'sharp';
import fs from 'node:fs/promises';

const [beforePath, afterPath, outPath] = process.argv.slice(2);
if (!beforePath || !afterPath) {
 console.error('usage: node diff-images.mjs before.png after.png [diff-heat.png]');
 process.exit(1);
}

const [a, b] = await Promise.all([
 sharp(beforePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
 sharp(afterPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
]);

if (a.info.width !== b.info.width || a.info.height !== b.info.height) {
 console.log(JSON.stringify({ error: 'size mismatch', before: a.info, after: b.info }, null, 2));
 process.exit(1);
}

const { width, height } = a.info;
const n = width * height;
const heat = Buffer.alloc(n * 3);
let maxDiff = 0, sumDiff = 0, changedPixels = 0;
for (let i = 0; i < n; i++) {
 const o = i * 4;
 const dr = Math.abs(a.data[o] - b.data[o]);
 const dg = Math.abs(a.data[o + 1] - b.data[o + 1]);
 const db = Math.abs(a.data[o + 2] - b.data[o + 2]);
 const d = Math.max(dr, dg, db);
 if (d > 2) changedPixels++;
 sumDiff += d;
 if (d > maxDiff) maxDiff = d;
 const h = i * 3;
 heat[h] = d; heat[h + 1] = d > 2 ? 255 - d : 0; heat[h + 2] = 0;
}
const result = {
 width, height, pixels: n,
 maxChannelDiff: maxDiff,
 meanChannelDiff: +(sumDiff / n).toFixed(4),
 changedPixels, changedPct: +((changedPixels / n) * 100).toFixed(4),
};
if (outPath) await sharp(heat, { raw: { width, height, channels: 3 } }).png().toFile(outPath);
console.log(JSON.stringify(result, null, 2));
