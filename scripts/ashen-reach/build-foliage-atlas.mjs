/**
 * Pack a 1024² RGBA foliage atlas (2×2 cells) with true alpha.
 *
 * Cells: meadow blades, dry seed grass, broadleaf+flowers, fern.
 * Optional photographic sources (black-keyed) overlay the procedural cards.
 *
 *   node scripts/ashen-reach/build-foliage-atlas.mjs
 *   node scripts/ashen-reach/build-foliage-atlas.mjs --photo a.jpg b.jpg c.jpg d.jpg
 */
import {deflateSync} from 'node:zlib';
import {readFileSync, writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {dirname, resolve} from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = resolve(ROOT, 'public/ashen-reach/foliage-atlas.png');
const SIZE = 1024;
const CELL = 512;
const FF = '/Applications/BabylonJS Editor.app/Contents/bin/ffmpeg';

const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[n] = c;
}
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const t = Buffer.from(type);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([t, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function writePNG(path, w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1);
  }
  writeFileSync(path, Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', (() => {
      const b = Buffer.alloc(13);
      b.writeUInt32BE(w, 0);
      b.writeUInt32BE(h, 4);
      b[8] = 8; b[9] = 6;
      return b;
    })()),
    chunk('IDAT', deflateSync(raw, {level: 9})),
    chunk('IEND', Buffer.alloc(0)),
  ]));
}

function lerp(a, b, t) { return a + (b - a) * t; }
function mix3(a, b, t) { return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]; }
function clamp(x, a, b) { return Math.min(b, Math.max(a, x)); }

function stampDisk(px, w, h, x, y, r, cr, cg, cb, ca) {
  const x0 = Math.max(0, Math.floor(x - r - 1));
  const x1 = Math.min(w - 1, Math.ceil(x + r + 1));
  const y0 = Math.max(0, Math.floor(y - r - 1));
  const y1 = Math.min(h - 1, Math.ceil(y + r + 1));
  const r1 = r + 0.6;
  for (let py = y0; py <= y1; py++) {
    for (let px_ = x0; px_ <= x1; px_++) {
      const d = Math.hypot(px_ + 0.5 - x, py + 0.5 - y);
      const cov = clamp(r1 - d, 0, 1);
      if (cov <= 0) continue;
      const i = (py * w + px_) * 4;
      const a = ca * cov;
      const oa = px[i + 3] / 255;
      const na = a + oa * (1 - a);
      if (na <= 1e-5) continue;
      const ia = a / na;
      const io = oa * (1 - a) / na;
      px[i] = clamp(Math.round(cr * 255 * ia + px[i] * io), 0, 255);
      px[i + 1] = clamp(Math.round(cg * 255 * ia + px[i + 1] * io), 0, 255);
      px[i + 2] = clamp(Math.round(cb * 255 * ia + px[i + 2] * io), 0, 255);
      px[i + 3] = clamp(Math.round(na * 255), 0, 255);
    }
  }
}

function stampCapsule(px, w, h, x0, y0, x1, y1, r0, r1, c0, c1, a0, a1) {
  const steps = Math.max(4, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 1.6));
  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    stampDisk(
      px, w, h,
      lerp(x0, x1, t), lerp(y0, y1, t),
      lerp(r0, r1, t),
      lerp(c0[0], c1[0], t), lerp(c0[1], c1[1], t), lerp(c0[2], c1[2], t),
      lerp(a0, a1, t),
    );
  }
}

function blade(px, w, h, seed, opt) {
  let s = seed;
  const rnd = () => { s = (Math.imul(1664525, s) + 1013904223) | 0; return (s >>> 0) / 4294967296; };
  const baseX = opt.cx + (rnd() - 0.5) * opt.spread;
  const baseY = opt.bottom;
  const hgt = opt.minH + rnd() * (opt.maxH - opt.minH);
  const bend = (rnd() - 0.5) * opt.bend;
  const tipX = baseX + bend * hgt + (rnd() - 0.5) * 8;
  const tipY = baseY - hgt;
  const midX = lerp(baseX, tipX, 0.45) + (rnd() - 0.5) * opt.bend * 0.5;
  const midY = lerp(baseY, tipY, 0.5);
  const rRoot = opt.rootR * (0.75 + rnd() * 0.5);
  const rTip = opt.tipR * (0.7 + rnd() * 0.5);
  const cRoot = opt.root;
  const cTip = mix3(opt.mid, opt.tip, rnd());
  // two quadratic segments via mid control
  stampCapsule(px, w, h, baseX, baseY, midX, midY, rRoot, lerp(rRoot, rTip, 0.55), cRoot, mix3(cRoot, cTip, 0.45), 0.98, 0.92);
  stampCapsule(px, w, h, midX, midY, tipX, tipY, lerp(rRoot, rTip, 0.55), rTip, mix3(cRoot, cTip, 0.45), cTip, 0.92, 0.78);
  if (opt.seedHead && rnd() < opt.seedHead) {
    const hw = 3 + rnd() * 4, hh = 7 + rnd() * 10;
    const head = opt.head || cTip;
    for (let k = 0; k < 7; k++) {
      const u = (k / 6 - 0.5);
      stampDisk(px, w, h, tipX + u * hw, tipY + Math.abs(u) * 2, 1.1 + rnd() * 0.7, head[0], head[1], head[2], 0.85);
    }
    stampCapsule(px, w, h, tipX, tipY, tipX, tipY - hh, 1.2, 0.7, head, mix3(head, [0.82, 0.72, 0.38], 0.5), 0.88, 0.7);
  }
}

function drawMeadow(px, ox, oy) {
  const w = SIZE, h = SIZE;
  const cx = ox + CELL / 2, bottom = oy + CELL - 18;
  for (let i = 0; i < 86; i++) {
    blade(px, w, h, 9000 + i * 97, {
      cx, bottom, spread: 210, minH: 140, maxH: 430, bend: 0.28,
      rootR: 2.4, tipR: 0.7,
      root: [0.13, 0.18, 0.07], mid: [0.32, 0.46, 0.16], tip: [0.58, 0.66, 0.28],
      seedHead: 0.12, head: [0.62, 0.58, 0.28],
    });
  }
}

function drawDry(px, ox, oy) {
  const w = SIZE, h = SIZE;
  const cx = ox + CELL / 2, bottom = oy + CELL - 18;
  for (let i = 0; i < 74; i++) {
    blade(px, w, h, 4100 + i * 131, {
      cx, bottom, spread: 200, minH: 150, maxH: 445, bend: 0.38,
      rootR: 2.2, tipR: 0.65,
      root: [0.18, 0.16, 0.07], mid: [0.46, 0.42, 0.18], tip: [0.72, 0.64, 0.32],
      seedHead: 0.55, head: [0.78, 0.68, 0.32],
    });
  }
}

function drawBroadleaf(px, ox, oy) {
  const w = SIZE, h = SIZE;
  const cx = ox + CELL / 2, bottom = oy + CELL - 22;
  // stems
  for (let s = 0; s < 7; s++) {
    const a = (s - 3) * 0.18;
    const x0 = cx + (s - 3) * 18;
    const x1 = x0 + Math.sin(a) * 70;
    const y1 = bottom - 210 - (s % 3) * 40;
    stampCapsule(px, w, h, x0, bottom, x1, y1, 2.4, 1.2, [0.18, 0.22, 0.08], [0.28, 0.36, 0.12], 0.95, 0.8);
    // leaves as overlapping disks along the stem
    const leaves = 4 + (s % 3);
    for (let k = 1; k <= leaves; k++) {
      const t = k / (leaves + 0.2);
      const lx = lerp(x0, x1, t) + ((k % 2) ? 1 : -1) * (18 + k * 4);
      const ly = lerp(bottom, y1, t);
      const rx = 16 + k * 3, ry = 9 + k * 2;
      for (let i = 0; i < 18; i++) {
        const u = (i / 17 - 0.5) * 2;
        stampDisk(px, w, h, lx + u * rx, ly + (1 - u * u) * ry * 0.15, (1 - Math.abs(u) * 0.35) * 7.5, 0.28 + k * 0.03, 0.42 + k * 0.02, 0.16, 0.88);
      }
    }
  }
  // small pink flowers
  for (let f = 0; f < 9; f++) {
    const fx = cx + (f - 4) * 28 + ((f * 17) % 11) - 5;
    const fy = bottom - 160 - (f % 4) * 42;
    for (let p = 0; p < 5; p++) {
      const ang = p * 1.256;
      stampDisk(px, w, h, fx + Math.cos(ang) * 5, fy + Math.sin(ang) * 4, 2.4, 0.78, 0.48, 0.58, 0.9);
    }
    stampDisk(px, w, h, fx, fy, 1.6, 0.86, 0.72, 0.32, 0.95);
  }
}

function drawFern(px, ox, oy) {
  const w = SIZE, h = SIZE;
  const cx = ox + CELL / 2, bottom = oy + CELL - 16;
  const tipX = cx + 18, tipY = oy + 28;
  stampCapsule(px, w, h, cx, bottom, tipX, tipY, 3.2, 1.1, [0.16, 0.2, 0.08], [0.3, 0.4, 0.14], 0.96, 0.8);
  const pinnae = 18;
  for (let i = 2; i < pinnae; i++) {
    const t = i / pinnae;
    const sx = lerp(cx, tipX, t), sy = lerp(bottom, tipY, t);
    const len = (1 - t) * 92 + 18;
    const ang = 0.95 + Math.sin(i * 0.7) * 0.08;
    for (const side of [-1, 1]) {
      const ex = sx + side * Math.cos(ang) * len;
      const ey = sy - Math.sin(ang * 0.35) * len * 0.25;
      stampCapsule(px, w, h, sx, sy, ex, ey, 2.8 * (1 - t * 0.4), 0.8, [0.22, 0.34, 0.12], [0.4, 0.52, 0.2], 0.92, 0.75);
      const leaflets = 5 + (i % 3);
      for (let k = 1; k <= leaflets; k++) {
        const u = k / (leaflets + 0.3);
        const lx = lerp(sx, ex, u), ly = lerp(sy, ey, u);
        const lr = (1 - u) * 7 + 2;
        stampDisk(px, w, h, lx, ly - 2, lr, 0.3 + t * 0.08, 0.46 + t * 0.06, 0.16, 0.86);
      }
    }
  }
}

function keyPhotoOntoCell(atlas, photoRgba, pw, ph, ox, oy) {
  for (let y = 0; y < CELL; y++) {
    for (let x = 0; x < CELL; x++) {
      const sx = Math.min(pw - 1, Math.floor(x * pw / CELL));
      const sy = Math.min(ph - 1, Math.floor(y * ph / CELL));
      const si = (sy * pw + sx) * 4;
      const r = photoRgba[si], g = photoRgba[si + 1], b = photoRgba[si + 2];
      const lum = (r + g + b) / 3;
      const chroma = Math.max(r, g, b) - Math.min(r, g, b);
      // black-key: keep botanical greens/golds, drop the void
      let a = photoRgba[si + 3];
      if (lum < 18 && chroma < 14) a = 0;
      else if (lum < 36 && chroma < 22) a = Math.round(a * (lum - 18) / 18);
      if (a < 8) continue;
      const di = ((oy + y) * SIZE + (ox + x)) * 4;
      const oa = atlas[di + 3] / 255;
      const na = a / 255;
      const outA = na + oa * (1 - na);
      const ia = na / Math.max(outA, 1e-5);
      const io = oa * (1 - na) / Math.max(outA, 1e-5);
      atlas[di] = clamp(Math.round(r * ia + atlas[di] * io), 0, 255);
      atlas[di + 1] = clamp(Math.round(g * ia + atlas[di + 1] * io), 0, 255);
      atlas[di + 2] = clamp(Math.round(b * ia + atlas[di + 2] * io), 0, 255);
      atlas[di + 3] = clamp(Math.round(outA * 255), 0, 255);
    }
  }
}

function decodePngRgba(path) {
  // ffmpeg → raw rgba
  const tmp = path + '.raw';
  const probe = spawnSync(FF, ['-i', path], {encoding: 'utf8'});
  const text = (probe.stderr || '') + (probe.stdout || '');
  const m = text.match(/Stream #0:0.*?(\d+)x(\d+)/);
  if (!m) throw new Error('cannot probe ' + path + '\n' + text.slice(-400));
  const w = +m[1], h = +m[2];
  const run = spawnSync(FF, ['-y', '-i', path, '-f', 'rawvideo', '-pix_fmt', 'rgba', tmp], {encoding: 'utf8'});
  if (run.status !== 0) throw new Error(run.stderr || 'ffmpeg decode failed');
  const buf = readFileSync(tmp);
  try { writeFileSync(tmp, ''); } catch {}
  return {rgba: new Uint8Array(buf), w, h};
}

const rgba = new Uint8Array(SIZE * SIZE * 4);
const photoFlag = process.argv.includes('--photo');
const files = photoFlag ? process.argv.slice(process.argv.indexOf('--photo') + 1).slice(0, 4) : [];
if (!files.length) {
  drawMeadow(rgba, 0, 0);
  drawDry(rgba, CELL, 0);
  drawBroadleaf(rgba, 0, CELL);
  drawFern(rgba, CELL, CELL);
}
const origins = [[0, 0], [CELL, 0], [0, CELL], [CELL, CELL]];
for (let i = 0; i < files.length; i++) {
  const src = resolve(files[i]);
  const decoded = decodePngRgba(src);
  keyPhotoOntoCell(rgba, decoded.rgba, decoded.w, decoded.h, origins[i][0], origins[i][1]);
  console.log('keyed', src, decoded.w + 'x' + decoded.h, '→ cell', i);
}

writePNG(OUT, SIZE, SIZE, rgba);
console.log('wrote', OUT, SIZE + 'x' + SIZE);
