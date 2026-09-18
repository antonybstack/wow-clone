// Sample pixels out of a PNG screenshot and report them in linear light.
//
// Exists because a WebGPU canvas cannot be read back through drawImage without
// preserveDrawingBuffer, so the only way to get numbers out of a frame is to
// decode the screenshot the harness already writes.
//
//   node scripts/px.mjs shot.png 0.45,0.75 0.45,0.62 ...
//
// Coordinates are normalised. Output is the 8-bit sRGB triple and the linear
// value it decodes to, which is what the shader arithmetic is stated in.

import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";

function decodePng(buf) {
    let p = 8;
    let w = 0, h = 0, bitDepth = 0, colorType = 0;
    const idat = [];
    while (p < buf.length) {
        const len = buf.readUInt32BE(p);
        const type = buf.toString("ascii", p + 4, p + 8);
        const data = buf.subarray(p + 8, p + 8 + len);
        if (type === "IHDR") {
            w = data.readUInt32BE(0);
            h = data.readUInt32BE(4);
            bitDepth = data[8];
            colorType = data[9];
        } else if (type === "IDAT") {
            idat.push(data);
        } else if (type === "IEND") break;
        p += 12 + len;
    }
    if (bitDepth !== 8) throw new Error(`bit depth ${bitDepth} unsupported`);
    const channels = { 0: 1, 2: 3, 4: 2, 6: 4 }[colorType];
    if (!channels) throw new Error(`colour type ${colorType} unsupported`);

    const raw = inflateSync(Buffer.concat(idat));
    const stride = w * channels;
    const out = Buffer.alloc(h * stride);
    let rp = 0;
    for (let y = 0; y < h; y++) {
        const filter = raw[rp++];
        const row = raw.subarray(rp, rp + stride);
        rp += stride;
        const cur = out.subarray(y * stride, (y + 1) * stride);
        const prev = y > 0 ? out.subarray((y - 1) * stride, y * stride) : null;
        for (let x = 0; x < stride; x++) {
            const a = x >= channels ? cur[x - channels] : 0;
            const b = prev ? prev[x] : 0;
            const c = prev && x >= channels ? prev[x - channels] : 0;
            let v = row[x];
            if (filter === 1) v += a;
            else if (filter === 2) v += b;
            else if (filter === 3) v += (a + b) >> 1;
            else if (filter === 4) {
                const pa = Math.abs(b - c), pb = Math.abs(a - c);
                const pc = Math.abs(a + b - 2 * c);
                v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
            }
            cur[x] = v & 0xff;
        }
    }
    return { w, h, channels, px: out };
}

const toLinear = (u) => {
    const s = u / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
};

const [file, ...coords] = process.argv.slice(2);
const img = decodePng(readFileSync(file));

// A single pixel lands on grain or a weave thread as often as not, so every
// sample is the mean of a small patch.
const R = 3;
for (const coord of coords) {
    const [u, v] = coord.split(",").map(Number);
    const cx = Math.round(u * (img.w - 1));
    const cy = Math.round(v * (img.h - 1));
    let n = 0;
    const acc = [0, 0, 0];
    for (let y = cy - R; y <= cy + R; y++) {
        for (let x = cx - R; x <= cx + R; x++) {
            if (x < 0 || y < 0 || x >= img.w || y >= img.h) continue;
            const o = (y * img.w + x) * img.channels;
            acc[0] += img.px[o];
            acc[1] += img.px[o + 1];
            acc[2] += img.px[o + 2];
            n++;
        }
    }
    const srgb = acc.map((c) => c / n);
    const lin = srgb.map(toLinear);
    const lum = 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
    console.log(
        `${coord}  px(${cx},${cy})  srgb ${srgb.map((c) => c.toFixed(0).padStart(3)).join(" ")}` +
        `  lin ${lin.map((c) => c.toFixed(4)).join(" ")}  Y ${lum.toFixed(4)}`
    );
}
