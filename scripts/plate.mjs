// Hero-plate harness for the warlock render overhaul.
//
// Locks a fixed character / camera pose in the running WebGPU app, writes a
// PNG, then prints figure + cloak metrics against `.shots/ref.png`.
//
//   npm run plate                  # capture + compare
//   node scripts/plate.mjs --metrics-only --ours .shots/ours.png
//
// Capture talks to Vite on 5173 (starts it if needed) through Chrome DevTools
// Protocol. System Chrome is required because this app is WebGPU-only.

import { spawn } from "node:child_process";
import { createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import net from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync, inflateSync } from "node:zlib";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SHOTS = join(ROOT, ".shots");

const HERO = {
    x: 2.4,
    z: 18.5,
    // 3/4 from behind-left so the staff sits on the right of the frame, matching
    // the reference painting. yawOffset is added to the tree-facing yaw.
    yawOffset: 1.05,
    pitch: -0.02,
    distance: 4.6,
    fov: 38 * Math.PI / 180,
    shoulder: 0.12,
    pivotHeight: 1.42,
};

/** Hand-tuned on `.shots/ref.png` (270×380, the target painting). */
const REF_CROPS = {
    figure: { x: 0.07, y: 0.04, w: 0.63, h: 0.92 },
    // Solid mantle panel below the hood — not the fringe against the sky.
    cloak: { x: 0.24, y: 0.32, w: 0.24, h: 0.30 },
};

/** Hand-tuned on `.shots/ours.png` (the current failure plate). */
const OURS_CROPS = {
    figure: { x: 0.22, y: 0.18, w: 0.52, h: 0.80 },
    cloak: { x: 0.32, y: 0.40, w: 0.26, h: 0.30 },
};

/** Default for `plate-*.png` captured by this harness (portrait 720×960). */
const HERO_CROPS = {
    figure: { x: 0.18, y: 0.38, w: 0.58, h: 0.60 },
    // Spans the orb-lit right panel and the filled back so hue std sees the terminator.
    cloak: { x: 0.30, y: 0.46, w: 0.36, h: 0.34 },
};

const TARGETS = {
    cloakHueStd: { min: 25, label: "cloak hue circular std (deg)" },
    cloakBinMass: { max: 0.50, label: "cloak max 30° hue-bin mass" },
    figureSat: { around: 0.50, tol: 0.12, label: "figure mean saturation" },
};

function parseArgs(argv) {
    const out = {
        name: "hero",
        url: "http://127.0.0.1:5173/",
        ref: join(SHOTS, "ref.png"),
        ours: null,
        metricsOnly: false,
        dumpCrops: true,
        headless: false,
        width: 720,
        height: 960,
        settleMs: 2200,
        json: true,
        autoCrop: false,
    };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        const next = () => argv[++i];
        if (a === "--name") out.name = next();
        else if (a === "--url") out.url = next();
        else if (a === "--ref") out.ref = resolve(next());
        else if (a === "--ours") out.ours = resolve(next());
        else if (a === "--metrics-only") out.metricsOnly = true;
        else if (a === "--no-crops") out.dumpCrops = false;
        else if (a === "--dump-crops") out.dumpCrops = true;
        else if (a === "--headless") out.headless = true;
        else if (a === "--width") out.width = Number(next());
        else if (a === "--height") out.height = Number(next());
        else if (a === "--settle-ms") out.settleMs = Number(next());
        else if (a === "--json") out.json = true;
        else if (a === "--auto-crop") out.autoCrop = true;
        else if (a === "--help" || a === "-h") out.help = true;
        else throw new Error(`unknown arg: ${a}`);
    }
    return out;
}

function usage() {
    console.log(`Usage: node scripts/plate.mjs [options]
  --name hero            plate filename stem
  --url http://127.0.0.1:5173/
  --ref .shots/ref.png
  --ours PATH            skip capture; compare this PNG to --ref
  --metrics-only         do not launch a browser
  --auto-crop            detect figure/cloak boxes instead of presets
  --no-crops             do not write crop PNGs
  --headless             Chrome headless (WebGPU often fails; headed is default)
  --width 720 --height 960
  --settle-ms 2200
  --json                 write .shots/plate-<name>.json (default on)`);
}

// ------------------------------------------------------------------ PNG I/O

function decodePng(buf) {
    let p = 8;
    let w = 0, h = 0, bitDepth = 0, colorType = 0, interlace = 0;
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
            interlace = data[12];
        } else if (type === "IDAT") {
            idat.push(data);
        } else if (type === "IEND") break;
        p += 12 + len;
    }
    if (bitDepth !== 8) throw new Error(`bit depth ${bitDepth} unsupported`);
    if (interlace) throw new Error("interlaced PNG unsupported");
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

const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
        t[n] = c >>> 0;
    }
    return t;
})();

function crc32(buf) {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
    const chunk = Buffer.alloc(12 + data.length);
    chunk.writeUInt32BE(data.length, 0);
    chunk.write(type, 4, 4, "ascii");
    data.copy(chunk, 8);
    chunk.writeUInt32BE(crc32(chunk.subarray(4, 8 + data.length)), 8 + data.length);
    return chunk;
}

function encodePngRgb(w, h, rgb) {
    const raw = Buffer.alloc((w * 3 + 1) * h);
    for (let y = 0; y < h; y++) {
        raw[y * (w * 3 + 1)] = 0;
        rgb.copy(raw, y * (w * 3 + 1) + 1, y * w * 3, (y + 1) * w * 3);
    }
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(w, 0);
    ihdr.writeUInt32BE(h, 4);
    ihdr[8] = 8;
    ihdr[9] = 2;
    return Buffer.concat([
        Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
        pngChunk("IHDR", ihdr),
        pngChunk("IDAT", deflateSync(raw)),
        pngChunk("IEND", Buffer.alloc(0)),
    ]);
}

function rgbAt(img, x, y) {
    const o = (y * img.w + x) * img.channels;
    return [img.px[o], img.px[o + 1], img.px[o + 2]];
}

function cropRgb(img, box) {
    const x0 = Math.max(0, Math.floor(box.x * img.w));
    const y0 = Math.max(0, Math.floor(box.y * img.h));
    const x1 = Math.min(img.w, Math.ceil((box.x + box.w) * img.w));
    const y1 = Math.min(img.h, Math.ceil((box.y + box.h) * img.h));
    const w = Math.max(1, x1 - x0);
    const h = Math.max(1, y1 - y0);
    const rgb = Buffer.alloc(w * h * 3);
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const [r, g, b] = rgbAt(img, x0 + x, y0 + y);
            const o = (y * w + x) * 3;
            rgb[o] = r; rgb[o + 1] = g; rgb[o + 2] = b;
        }
    }
    return { w, h, rgb, pxBox: { x0, y0, x1, y1 } };
}

// ------------------------------------------------------------------ colour

function srgbToLinear(u) {
    const s = u / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function rgbToHsv(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const d = max - min;
    let h = 0;
    if (d > 1e-6) {
        if (max === r) h = ((g - b) / d) % 6;
        else if (max === g) h = (b - r) / d + 2;
        else h = (r - g) / d + 4;
        h *= 60;
        if (h < 0) h += 360;
    }
    return { h, s: max === 0 ? 0 : d / max, v: max };
}

function luma255(r, g, b) {
    const Y = 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
    return Math.pow(Math.max(Y, 0), 1 / 2.4) * 255;
}

function percentile(sorted, p) {
    if (!sorted.length) return 0;
    const i = (sorted.length - 1) * p;
    const lo = Math.floor(i), hi = Math.ceil(i);
    if (lo === hi) return sorted[lo];
    return sorted[lo] * (hi - i) + sorted[hi] * (i - lo);
}

function measureCrop(rgb, w, h) {
    const n = w * h;
    const values = new Float64Array(n);
    const hues = [];
    let satSum = 0;
    let black = 0;
    let hf = 0, hfN = 0;

    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const o = (y * w + x) * 3;
            const r = rgb[o], g = rgb[o + 1], b = rgb[o + 2];
            const hsv = rgbToHsv(r, g, b);
            const Y = luma255(r, g, b);
            values[y * w + x] = Y;
            satSum += hsv.s;
            if (Y < 8) black++;
            if (hsv.s > 0.12 && hsv.v > 0.08) hues.push(hsv.h);
            if (x + 1 < w && y + 1 < h) {
                const oR = o + 3;
                const oD = ((y + 1) * w + x) * 3;
                const yR = luma255(rgb[oR], rgb[oR + 1], rgb[oR + 2]);
                const yD = luma255(rgb[oD], rgb[oD + 1], rgb[oD + 2]);
                hf += Math.abs(Y - yR) + Math.abs(Y - yD);
                hfN++;
            }
        }
    }

    values.sort();
    const bins = new Array(12).fill(0);
    let cx = 0, cy = 0;
    for (const hue of hues) {
        bins[Math.min(11, Math.floor(hue / 30))]++;
        const rad = hue * Math.PI / 180;
        cx += Math.cos(rad);
        cy += Math.sin(rad);
    }
    const hn = hues.length || 1;
    const R = Math.hypot(cx / hn, cy / hn);
    const hueMean = hues.length ? (Math.atan2(cy, cx) * 180 / Math.PI + 360) % 360 : 0;
    const hueStd = hues.length && R > 1e-6 ? Math.sqrt(Math.max(0, -2 * Math.log(R))) * 180 / Math.PI : 0;
    const binMass = hues.length ? Math.max(...bins) / hues.length : 0;

    return {
        pixels: n,
        chromatic: hues.length,
        meanSat: satSum / n,
        hueMean,
        hueStd,
        binMass,
        bins: bins.map((c) => hues.length ? c / hues.length : 0),
        p25: percentile(values, 0.25),
        p50: percentile(values, 0.50),
        p75: percentile(values, 0.75),
        blackFrac: black / n,
        hf: hfN ? hf / hfN : 0,
    };
}

function erodeMask(mask, gw, gh) {
    const out = new Uint8Array(gw * gh);
    for (let y = 1; y < gh - 1; y++) {
        for (let x = 1; x < gw - 1; x++) {
            const i = y * gw + x;
            out[i] = mask[i] && mask[i - 1] && mask[i + 1] && mask[i - gw] && mask[i + gw] ? 1 : 0;
        }
    }
    return out;
}

function largestComponent(mask, gw, gh) {
    const seen = new Uint8Array(gw * gh);
    let best = null, bestN = 0;
    const stack = [];
    for (let i = 0; i < mask.length; i++) {
        if (!mask[i] || seen[i]) continue;
        stack.length = 0;
        stack.push(i);
        seen[i] = 1;
        let n = 0, minX = gw, minY = gh, maxX = 0, maxY = 0;
        while (stack.length) {
            const k = stack.pop();
            const x = k % gw, y = (k / gw) | 0;
            n++;
            if (x < minX) minX = x;
            if (y < minY) minY = y;
            if (x > maxX) maxX = x;
            if (y > maxY) maxY = y;
            const nbr = [k - 1, k + 1, k - gw, k + gw];
            for (const j of nbr) {
                if (j < 0 || j >= mask.length || seen[j] || !mask[j]) continue;
                const jx = j % gw;
                if (Math.abs(jx - x) > 1) continue;
                seen[j] = 1;
                stack.push(j);
            }
        }
        if (n > bestN) {
            bestN = n;
            best = { minX, minY, maxX, maxY, n };
        }
    }
    return best;
}

function autoCrops(img) {
    const { w, h } = img;
    const gw = 48, gh = 48;
    const cellW = w / gw, cellH = h / gh;
    const mask = new Uint8Array(gw * gh);
    for (let cy = 0; cy < gh; cy++) {
        for (let cx = 0; cx < gw; cx++) {
            const x0 = Math.floor(cx * cellW);
            const x1 = Math.max(x0 + 1, Math.floor((cx + 1) * cellW));
            const y0 = Math.floor(cy * cellH);
            const y1 = Math.max(y0 + 1, Math.floor((cy + 1) * cellH));
            let hit = 0, n = 0;
            for (let y = y0; y < y1; y += 2) {
                for (let x = x0; x < x1; x += 2) {
                    const [r, g, b] = rgbAt(img, x, y);
                    const hsv = rgbToHsv(r, g, b);
                    n++;
                    const yn = y / h;
                    if (yn < 0.10) continue;
                    if (yn > 0.58 && hsv.h >= 70 && hsv.h <= 165 && hsv.s > 0.08 && hsv.v > 0.18) continue;
                    const clothHue = hsv.h >= 210 && hsv.h <= 310;
                    const cloak = clothHue && hsv.s > 0.36 && hsv.v > 0.12 && hsv.v < 0.88;
                    if (cloak) hit++;
                }
            }
            mask[cy * gw + cx] = n && hit / n > 0.32 ? 1 : 0;
        }
    }
    const eroded = erodeMask(mask, gw, gh);
    const box = largestComponent(eroded, gw, gh) || largestComponent(mask, gw, gh);
    if (!box) {
        return {
            figure: { x: 0.22, y: 0.10, w: 0.52, h: 0.84 },
            cloak: { x: 0.26, y: 0.28, w: 0.24, h: 0.36 },
        };
    }
    const pad = 1.2;
    const minX = Math.max(0, box.minX - pad);
    const minY = Math.max(0, box.minY - pad);
    const maxX = Math.min(gw - 1, box.maxX + pad);
    const maxY = Math.min(gh - 1, box.maxY + pad);
    const figure = {
        x: minX / gw,
        y: minY / gh,
        w: (maxX - minX + 1) / gw,
        h: (maxY - minY + 1) / gh,
    };
    const cloak = {
        x: figure.x + figure.w * 0.08,
        y: figure.y + figure.h * 0.28,
        w: figure.w * 0.44,
        h: figure.h * 0.36,
    };
    return { figure, cloak };
}

function cropsFor(path, img, forceAuto) {
    const base = path.replace(/\\/g, "/");
    // The painting's boxes stay fixed. --auto-crop is for live plates only.
    if (base.endsWith("/ref.png") || base.endsWith("ref.png")) return REF_CROPS;
    if (forceAuto) return autoCrops(img);
    if (base.endsWith("/ours.png") || base.endsWith("ours.png")) return OURS_CROPS;
    if (/\/plate-[^/]+\.png$/.test(base)) return HERO_CROPS;
    return autoCrops(img);
}

function fmt(n, d = 1) {
    return Number.isFinite(n) ? n.toFixed(d) : "—";
}

function gate(ok) {
    return ok ? "ok" : "FAIL";
}

function report(name, crops, metrics) {
    const rows = [
        ["cloak hue circ std", fmt(metrics.cloak.hueStd, 1), "≥ 25"],
        ["cloak max 30° bin", fmt(metrics.cloak.binMass, 2), "≤ 0.50"],
        ["cloak hue mean", fmt(metrics.cloak.hueMean, 0), "grey-blue ~226"],
        ["figure mean sat", fmt(metrics.figure.meanSat, 2), "~0.50"],
        ["figure V p25/p50/p75", `${fmt(metrics.figure.p25, 0)}/${fmt(metrics.figure.p50, 0)}/${fmt(metrics.figure.p75, 0)}`, "~24/40/59"],
        ["figure black frac", fmt(metrics.figure.blackFrac, 2), "ref ~0.19"],
        ["cloak HF energy", fmt(metrics.cloak.hf, 1), "higher = folds"],
        ["cloak chromatic px", String(metrics.cloak.chromatic), ""],
    ];
    console.log(`\n${name}  ${metrics.w}×${metrics.h}`);
    console.log(`  figure crop  x=${fmt(crops.figure.x, 2)} y=${fmt(crops.figure.y, 2)} w=${fmt(crops.figure.w, 2)} h=${fmt(crops.figure.h, 2)}`);
    console.log(`  cloak crop   x=${fmt(crops.cloak.x, 2)} y=${fmt(crops.cloak.y, 2)} w=${fmt(crops.cloak.w, 2)} h=${fmt(crops.cloak.h, 2)}`);
    const labelW = 22;
    for (const [label, value, target] of rows) {
        console.log(`  ${label.padEnd(labelW)} ${String(value).padStart(12)}    ${target}`);
    }
    const hueOk = metrics.cloak.hueStd >= TARGETS.cloakHueStd.min;
    const binOk = metrics.cloak.binMass <= TARGETS.cloakBinMass.max;
    console.log(`  gates: hue-std ${gate(hueOk)}   bin-mass ${gate(binOk)}`);
    return { hueOk, binOk };
}

function comparePair(refM, oursM) {
    const keys = [
        ["cloak.hueStd", "cloak hue circ std"],
        ["cloak.binMass", "cloak max 30° bin"],
        ["cloak.hueMean", "cloak hue mean"],
        ["figure.meanSat", "figure mean sat"],
        ["figure.p25", "figure V p25"],
        ["figure.p50", "figure V p50"],
        ["figure.p75", "figure V p75"],
        ["cloak.hf", "cloak HF energy"],
    ];
    const get = (obj, path) => path.split(".").reduce((o, k) => o[k], obj);
    console.log("\nref vs ours");
    console.log(`  ${"".padEnd(22)} ${"ref".padStart(10)} ${"ours".padStart(10)}`);
    for (const [path, label] of keys) {
        console.log(`  ${label.padEnd(22)} ${fmt(get(refM, path), 2).padStart(10)} ${fmt(get(oursM, path), 2).padStart(10)}`);
    }
}

function loadAndMeasure(path, forceAuto) {
    const img = decodePng(readFileSync(path));
    const used = cropsFor(path, img, forceAuto);
    const figure = cropRgb(img, used.figure);
    const cloak = cropRgb(img, used.cloak);
    return {
        img,
        crops: used,
        figure,
        cloak,
        metrics: {
            w: img.w,
            h: img.h,
            figure: measureCrop(figure.rgb, figure.w, figure.h),
            cloak: measureCrop(cloak.rgb, cloak.w, cloak.h),
        },
    };
}

function dumpCrops(stem, pack) {
    mkdirSync(SHOTS, { recursive: true });
    writeFileSync(join(SHOTS, `${stem}-figure.png`), encodePngRgb(pack.figure.w, pack.figure.h, pack.figure.rgb));
    writeFileSync(join(SHOTS, `${stem}-cloak.png`), encodePngRgb(pack.cloak.w, pack.cloak.h, pack.cloak.rgb));
}

// ------------------------------------------------------------------ capture

function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}

async function urlUp(url) {
    try {
        const res = await fetch(url, { signal: AbortSignal.timeout(1500) });
        return res.ok || res.status === 404;
    } catch {
        return false;
    }
}

async function ensureDev(url) {
    if (await urlUp(url)) return null;
    console.log(`starting Vite at ${url}`);
    const log = createWriteStream(join(ROOT, ".shots", "plate-vite.log"));
    mkdirSync(SHOTS, { recursive: true });
    const child = spawn("npm", ["run", "dev"], {
        cwd: ROOT,
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env, FORCE_COLOR: "0" },
    });
    child.stdout.pipe(log);
    child.stderr.pipe(log);
    for (let i = 0; i < 50; i++) {
        if (await urlUp(url)) return child;
        if (child.exitCode != null) throw new Error(`Vite exited ${child.exitCode}`);
        await sleep(200);
    }
    throw new Error("Vite did not come up on 5173");
}

function chromePath() {
    if (process.env.CHROME) return process.env.CHROME;
    const candidates = [
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "/usr/bin/google-chrome-stable",
        "/usr/bin/google-chrome",
        "/usr/bin/chromium",
        "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    ];
    for (const p of candidates) if (existsSync(p)) return p;
    throw new Error("Chrome not found. Set CHROME to a WebGPU-capable binary.");
}

function freePort() {
    return new Promise((resolve, reject) => {
        const s = net.createServer();
        s.listen(0, "127.0.0.1", () => {
            const { port } = s.address();
            s.close(() => resolve(port));
        });
        s.on("error", reject);
    });
}

class Cdp {
    constructor(ws) {
        this.ws = ws;
        this.id = 0;
        this.pending = new Map();
        ws.addEventListener("message", (ev) => {
            const msg = JSON.parse(typeof ev.data === "string" ? ev.data : ev.data.toString());
            if (msg.id == null) return;
            const slot = this.pending.get(msg.id);
            if (!slot) return;
            this.pending.delete(msg.id);
            if (msg.error) slot.reject(new Error(msg.error.message || JSON.stringify(msg.error)));
            else slot.resolve(msg.result);
        });
    }

    send(method, params = {}) {
        const id = ++this.id;
        return new Promise((resolve, reject) => {
            this.pending.set(id, { resolve, reject });
            this.ws.send(JSON.stringify({ id, method, params }));
        });
    }

    evaluate(expression, awaitPromise = false) {
        return this.send("Runtime.evaluate", {
            expression,
            awaitPromise,
            returnByValue: true,
        }).then((r) => {
            if (r.exceptionDetails) {
                const d = r.exceptionDetails;
                throw new Error(d.text || d.exception?.description || "evaluate failed");
            }
            return r.result?.value;
        });
    }
}

function applyPoseSource(hero) {
    return `(() => {
        const hero = ${JSON.stringify(hero)};
        const D = globalThis.DUSKWELL;
        if (!D) throw new Error("DUSKWELL missing");
        const x = hero.x, z = hero.z;
        const y = D.terrain.heightAt(x, z);
        D.character.position.set(x, y, z);
        D.character.velocity.set(0, 0, 0);
        D.character.speed = 0;
        D.character.speed01 = 0;
        const facing = Math.atan2(-x, -z);
        D.character.facing = facing;
        D.rig.yaw = facing + hero.yawOffset;
        D.rig.pitch = hero.pitch;
        D.rig.distance = D.rig.distanceTarget = hero.distance;
        D.rig.baseFov = hero.fov;
        D.rig.fov = hero.fov;
        if (D.rig.camera) D.rig.camera.fov = hero.fov;
        D.rig.trauma = 0;
        D.rig.shoulder = hero.shoulder;
        if (hero.pivotHeight != null) D.rig.pivotHeight = hero.pivotHeight;
        if (D.hud && D.hud.el) D.hud.el.style.display = "none";
        if (D.overlay && D.overlay.el) {
            D.overlay.el.classList.remove("show");
            D.overlay.visible = false;
        }
        document.getElementById("hint")?.classList.remove("show");
        document.getElementById("boot")?.remove();
        return { x, y, z, facing, yaw: D.rig.yaw, pitch: D.rig.pitch, distance: D.rig.distance };
    })()`;
}

async function capturePlate(opts) {
    const outPath = join(SHOTS, `plate-${opts.name}.png`);
    mkdirSync(SHOTS, { recursive: true });

    const port = await freePort();
    const profile = join(tmpdir(), `duskwell-plate-${process.pid}`);
    const args = [
        `--remote-debugging-port=${port}`,
        `--remote-debugging-address=127.0.0.1`,
        `--user-data-dir=${profile}`,
        `--window-size=${opts.width},${opts.height}`,
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-sync",
        "--ignore-gpu-blocklist",
        "--enable-gpu",
        "--enable-unsafe-webgpu",
        "about:blank",
    ];
    if (opts.headless) args.unshift("--headless=new");

    const chrome = spawn(chromePath(), args, { stdio: "ignore" });
    let ws;
    try {
        let version = null;
        for (let i = 0; i < 50; i++) {
            try {
                const res = await fetch(`http://127.0.0.1:${port}/json/version`);
                if (res.ok) {
                    version = await res.json();
                    break;
                }
            } catch { /* not up yet */ }
            if (chrome.exitCode != null) throw new Error(`Chrome exited ${chrome.exitCode}`);
            await sleep(100);
        }
        if (!version) throw new Error("Chrome DevTools did not come up");

        let page = null;
        for (let i = 0; i < 25; i++) {
            const pagesRes = await fetch(`http://127.0.0.1:${port}/json/list`);
            const pages = await pagesRes.json();
            page = pages.find((p) => p.type === "page" && p.webSocketDebuggerUrl);
            if (page) break;
            await sleep(100);
        }
        const wsUrl = page?.webSocketDebuggerUrl;
        if (!wsUrl) throw new Error("no Chrome page target for CDP");
        ws = new WebSocket(wsUrl);
        await new Promise((resolve, reject) => {
            ws.addEventListener("open", resolve);
            ws.addEventListener("error", () => reject(new Error("CDP websocket failed")));
        });
        const cdp = new Cdp(ws);
        await cdp.send("Page.enable");
        await cdp.send("Runtime.enable");
        await cdp.send("Emulation.setDeviceMetricsOverride", {
            width: opts.width,
            height: opts.height,
            deviceScaleFactor: 1,
            mobile: false,
        });
        await cdp.send("Page.navigate", { url: opts.url });

        const ready = await cdp.evaluate(`new Promise((resolve, reject) => {
            const t0 = Date.now();
            (function tick() {
                if (globalThis.DUSKWELL) return resolve({ gpu: !!navigator.gpu });
                if (document.querySelector("#nogpu.show")) return reject(new Error("WebGPU unavailable"));
                if (Date.now() - t0 > 120000) return reject(new Error("timed out waiting for DUSKWELL"));
                setTimeout(tick, 200);
            })();
        })`, true);
        if (!ready?.gpu) throw new Error("navigator.gpu is missing in this Chrome");

        const pose = await cdp.evaluate(applyPoseSource(HERO));
        await cdp.evaluate(`new Promise((r) => setTimeout(r, ${opts.settleMs}))`, true);
        await cdp.evaluate(applyPoseSource(HERO));
        await cdp.evaluate(`new Promise((r) => {
            let n = 0;
            (function tick() { if (++n >= 20) r(); else requestAnimationFrame(tick); })();
        })`, true);

        const shot = await cdp.send("Page.captureScreenshot", { format: "png", fromSurface: true });
        writeFileSync(outPath, Buffer.from(shot.data, "base64"));
        return { outPath, pose };
    } finally {
        try { ws?.close(); } catch { /* already closed */ }
        chrome.kill("SIGTERM");
        await sleep(300);
        if (chrome.exitCode == null) chrome.kill("SIGKILL");
    }
}

// ------------------------------------------------------------------ main

const args = parseArgs(process.argv.slice(2));
if (args.help) {
    usage();
    process.exit(0);
}

mkdirSync(SHOTS, { recursive: true });

if (!args.metricsOnly && !args.ours) {
    const child = await ensureDev(args.url);
    try {
        const cap = await capturePlate(args);
        args.ours = cap.outPath;
        console.log(`wrote ${cap.outPath}`);
        console.log(`pose  x=${fmt(cap.pose.x, 2)} y=${fmt(cap.pose.y, 2)} z=${fmt(cap.pose.z, 2)}  facing=${fmt(cap.pose.facing, 3)} yaw=${fmt(cap.pose.yaw, 3)} pitch=${fmt(cap.pose.pitch, 3)} dist=${fmt(cap.pose.distance, 2)}`);
    } finally {
        if (child) child.kill("SIGTERM");
    }
}

if (!args.ours) args.ours = join(SHOTS, "ours.png");

const refPack = loadAndMeasure(args.ref, args.autoCrop);
const oursPack = loadAndMeasure(args.ours, args.autoCrop);

if (args.dumpCrops) {
    dumpCrops("ref", refPack);
    dumpCrops(`plate-${args.name}`, oursPack);
}

const refGates = report("ref", refPack.crops, refPack.metrics);
const oursGates = report(args.ours.replace(ROOT + "/", ""), oursPack.crops, oursPack.metrics);
comparePair(refPack.metrics, oursPack.metrics);

const summary = {
    name: args.name,
    refPath: args.ref,
    oursPath: args.ours,
    hero: HERO,
    refCrops: refPack.crops,
    oursCrops: oursPack.crops,
    refMetrics: refPack.metrics,
    oursMetrics: oursPack.metrics,
    gates: {
        ref: refGates,
        ours: oursGates,
        phase1: oursGates.hueOk && oursGates.binOk,
    },
};
if (args.json) {
    const jsonPath = join(SHOTS, `plate-${args.name}.json`);
    writeFileSync(jsonPath, JSON.stringify(summary, null, 2));
    console.log(`\nwrote ${jsonPath}`);
}

console.log(
    `\nPhase 1 gates (ours): hue-std ${gate(oursGates.hueOk)}  bin-mass ${gate(oursGates.binOk)}` +
    (oursGates.hueOk && oursGates.binOk ? "  — overhaul target met" : "  — expected FAIL until relight")
);
