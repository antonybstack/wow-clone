import fs from "fs";
import path from "path";

const dir = path.resolve("public/refs");
fs.mkdirSync(dir, { recursive: true });

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function classify(name, url) {
  const s = `${name} ${url}`.toLowerCase();
  if (/worldmap|map-|zone.?map|minimap|kalidar_map/.test(s)) return "map";
  if (/icon|quest|ability|inv_|spell_|ui-|logo|banner|button/.test(s)) return "ui/icon";
  if (/classic-art|aldrassil\.jpg|aldrassil-art|concept|artwork|painting|illustration|nightelves-800x|kalidar0[1-9]/.test(s))
    return "art";
  if (/ingame|in-game|gameplay|screenshot|wallhere|wowhead|800px-shadowglen|teldrassil1|dolanaar/.test(s))
    return "gameplay/in-game";
  if (/teldrassil\.jpg|tree\.jpg|shadowglen\.jpg/.test(s) && !/ingame|in-game|800px/.test(s)) return "art";
  return "gameplay/in-game";
}

async function fetchBuf(url, opts = {}) {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "*/*", ...opts.headers },
    redirect: "follow",
    ...opts,
  });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  return { buf, res };
}

async function download(name, url, meta = {}) {
  try {
    const { buf, res } = await fetchBuf(url);
    const ct = res.headers.get("content-type") || "";
    if (buf.length < 3000 && !ct.includes("image")) {
      console.log("SKIP", name, "too small or not image", buf.length, ct);
      return null;
    }
    const out = path.join(dir, name);
    fs.writeFileSync(out, buf);
    const kind = meta.kind || classify(name, url);
    console.log("OK", name, buf.length, ct, kind);
    return { name, bytes: buf.length, path: out, kind, url };
  } catch (e) {
    console.log("ERR", name, e.message);
    return null;
  }
}

function wikiFullUrl(url) {
  return url.replace(/\/thumb(\/)/i, "$1").replace(/\/(\d+)px-[^/]+$/i, "");
}

async function scrapeWikiImages(pageUrl) {
  const res = await fetch(pageUrl, { headers: { "User-Agent": UA } });
  const html = await res.text();
  const imgs = new Set();
  for (const m of html.matchAll(/\/images\/(?:thumb\/)?([^"'?\s]+\.(?:jpg|jpeg|png|webp))/gi)) {
    let name = m[1];
    if (name.includes("/")) name = name.split("/").pop().replace(/^\d+px-/, "");
    imgs.add(`https://warcraft.wiki.gg/images/${name}`);
  }
  for (const m of html.matchAll(
    /https:\/\/warcraft\.wiki\.gg\/images\/[^"'\s]+\.(?:jpg|jpeg|png|webp)(?:\/[^"'\s]*)?/gi
  )) {
    imgs.add(wikiFullUrl(m[0].split("?")[0]));
  }
  return [...imgs];
}

async function scrapeWowheadScreenshots(zoneId) {
  const url = `https://www.wowhead.com/zone=${zoneId}/screenshots`;
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "text/html" } });
  if (!res.ok) return [];
  const html = await res.text();
  const imgs = new Set();
  for (const m of html.matchAll(
    /https:\/\/wow\.zamimg\.com\/uploads\/screenshots\/normal\/[^"'\s]+\.(?:jpg|jpeg|png|webp)/gi
  )) {
    imgs.add(m[0]);
  }
  return [...imgs];
}

function shouldSkipWikiImage(base, url) {
  const lower = `${base} ${url}`.toLowerCase();
  return /worldmap|map-|icon|quest|ability|inv_|spell_|ui-|logo|banner|button|talent|interface|achievement|trade_|item_|npc_|creature_|race_|class_|faction_|gossip|cursor|blank|1x1|pixel|site-|network_|footer|badge|stub|blip|\.gif$|\.svg$|\.png$/.test(
    lower
  );
}

// Curated direct URLs (wowpedia in-game paths often 404; wiki.gg needs browser cookies — use hash/thumb URLs)
const direct = [
  [
    "aldrassil-classic-art.jpg",
    "https://static.wikia.nocookie.net/wowpedia/images/4/4b/Aldrassil.jpg/revision/latest?cb=20060604152207",
    { kind: "art" },
  ],
  ["aldrassil-wiki.jpg", "https://warcraft.wiki.gg/images/4/4b/Aldrassil.jpg", { kind: "art" }],
  [
    "shadowglen-gameplay-wallhere-1920.jpg",
    "https://get.wallhere.com/photo/1920x1080-1673607.jpg",
    { kind: "gameplay/in-game" },
  ],
  [
    "shadowglen-gameplay-1.jpg",
    "https://warcraft.wiki.gg/images/thumb/Shadowglen.jpg/800px-Shadowglen.jpg",
    { kind: "gameplay/in-game" },
  ],
  ["shadowglen-gameplay-2.jpg", "https://warcraft.wiki.gg/images/8/8a/Shadowglen.jpg", { kind: "gameplay/in-game" }],
  ["shadowglen-gameplay-3.jpg", "https://warcraft.wiki.gg/images/Teldrassil1.jpg", { kind: "gameplay/in-game" }],
  ["shadowglen-gameplay-4.jpg", "https://warcraft.wiki.gg/images/Dolanaar.jpg", { kind: "gameplay/in-game" }],
  ["teldrassil-wiki-tree.jpg", "https://warcraft.wiki.gg/images/4/4c/Teldrassil.jpg", { kind: "art" }],
  [
    "shadowglen-gameplay-wowhead-1.jpg",
    "https://wow.zamimg.com/uploads/screenshots/normal/762033-teldrassil.jpg",
    { kind: "gameplay/in-game" },
  ],
];

const written = [];
const seenUrls = new Set();

for (const [name, url, meta] of direct) {
  if (seenUrls.has(url)) continue;
  seenUrls.add(url);
  const r = await download(name, url, meta);
  if (r) written.push(r);
}

const wikiPages = [
  ["shadowglen", "https://warcraft.wiki.gg/wiki/Shadowglen"],
  ["aldrassil", "https://warcraft.wiki.gg/wiki/Aldrassil"],
  ["teldrassil", "https://warcraft.wiki.gg/wiki/Teldrassil"],
];

let wikiIdx = 1;
for (const [prefix, pageUrl] of wikiPages) {
  try {
    const imgs = await scrapeWikiImages(pageUrl);
    console.log("WIKI", prefix, imgs.length, "images found");
    for (const imgUrl of imgs) {
      if (seenUrls.has(imgUrl)) continue;
      const base = path.basename(decodeURIComponent(imgUrl.split("/").pop()));
      if (shouldSkipWikiImage(base, imgUrl)) continue;
      seenUrls.add(imgUrl);
      const name = `${prefix}-wiki-${wikiIdx++}-${base}`;
      const r = await download(name, imgUrl);
      if (r) written.push(r);
    }
  } catch (e) {
    console.log("WIKI ERR", prefix, e.message);
  }
}

try {
  const wh = await scrapeWowheadScreenshots(141);
  console.log("WOWHEAD", wh.length, "screenshots");
  let i = written.filter((w) => w.name.includes("wowhead")).length + 1;
  for (const url of wh.slice(0, 10)) {
    if (seenUrls.has(url)) continue;
    seenUrls.add(url);
    const ext = url.match(/\.(jpg|jpeg|png|webp)/i)?.[0] || ".jpg";
    const r = await download(`shadowglen-gameplay-wowhead-${i++}${ext}`, url);
    if (r) written.push(r);
  }
} catch (e) {
  console.log("WOWHEAD ERR", e.message);
}

const manifest = written.map((w) => ({
  path: w.path,
  name: w.name,
  bytes: w.bytes,
  kind: w.kind,
  url: w.url,
}));
fs.writeFileSync(path.join(dir, "manifest.json"), JSON.stringify(manifest, null, 2));

console.log("\n=== WRITTEN FILES ===");
for (const w of written) {
  console.log(w.path, w.bytes, w.kind);
}

console.log(
  "\nNOTE: warcraft.wiki.gg blocks bare server fetches (403). If downloads fail, run:",
  "node via Playwright runner at scripts/playwright-download-runner.js"
);
