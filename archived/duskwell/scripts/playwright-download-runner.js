async (page) => {
  const outDir = "/Users/antbly/dev/wow-clone/public/refs";
  const UA =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

  function classify(name, url) {
    const s = (name + " " + url).toLowerCase();
    if (/worldmap|map-|zone.?map|minimap|kalidar_map/.test(s)) return "map";
    if (/icon|quest|ability|inv_|spell_|ui-|logo|banner|button/.test(s)) return "ui/icon";
    if (/classic-art|aldrassil\.jpg|aldrassil-art|concept|artwork|painting|illustration|nightelves-800x|kalidar0/.test(s))
      return "art";
    if (/ingame|in-game|gameplay|screenshot|wallhere|wowhead|classic|start|800px-shadowglen|teldrassil1|dolanaar/.test(s))
      return "gameplay/in-game";
    if (/teldrassil\.jpg|tree\.jpg|shadowglen\.jpg/.test(s) && !/ingame|in-game|800px/.test(s)) return "art";
    return "gameplay/in-game";
  }

  async function saveBuffer(name, b64, byteLen, ct, kind, url) {
    const [download] = await Promise.all([
      page.waitForEvent("download", { timeout: 60000 }),
      page.evaluate(
        ({ b64, ct, name }) => {
          const a = document.createElement("a");
          a.href = "data:" + ct + ";base64," + b64;
          a.download = name;
          document.body.appendChild(a);
          a.click();
          a.remove();
        },
        { b64, ct, name }
      ),
    ]);
    const savePath = outDir + "/" + name;
    await download.saveAs(savePath);
    return { name, path: savePath, bytes: byteLen, kind: kind || classify(name, url), url };
  }

  async function saveViaRequest(name, url, kind) {
    try {
      const resp = await page.context().request.get(url, { headers: { "User-Agent": UA }, timeout: 60000 });
      if (!resp.ok()) return { name, error: resp.status() + " " + url, url };
      const buf = await resp.body();
      const ct = resp.headers()["content-type"] || "image/jpeg";
      if (buf.length < 3000 && !ct.includes("image")) return { name, error: "too small " + buf.length, url };
      return await saveBuffer(name, buf.toString("base64"), buf.length, ct, kind, url);
    } catch (e) {
      return { name, error: e.message, url };
    }
  }

  async function saveViaBrowserFetch(name, url, kind, referer) {
    try {
      if (referer) await page.goto(referer, { waitUntil: "domcontentloaded", timeout: 30000 });
      const fetched = await page.evaluate(async (url) => {
        const resp = await fetch(url);
        const buf = await resp.arrayBuffer();
        const bytes = new Uint8Array(buf);
        let binary = "";
        const chunk = 0x8000;
        for (let i = 0; i < bytes.length; i += chunk) {
          binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
        }
        return {
          status: resp.status,
          ct: resp.headers.get("content-type") || "image/jpeg",
          b64: btoa(binary),
          bytes: buf.byteLength,
        };
      }, url);
      if (fetched.status !== 200 || fetched.bytes < 3000) {
        return { name, error: fetched.status + " " + url, url };
      }
      return await saveBuffer(name, fetched.b64, fetched.bytes, fetched.ct, kind, url);
    } catch (e) {
      return { name, error: e.message, url };
    }
  }

  function extractWikiImages(html) {
    const imgs = new Set();
    for (const m of html.matchAll(/\/images\/(?:thumb\/)?([^"'?\s]+\.(?:jpg|jpeg|png|webp))/gi)) {
      let name = m[1];
      if (name.includes("/")) {
        const parts = name.split("/");
        name = parts[parts.length - 1].replace(/^\d+px-/, "");
      }
      imgs.add("https://warcraft.wiki.gg/images/" + name);
    }
    for (const m of html.matchAll(
      /https:\/\/warcraft\.wiki\.gg\/images\/(?:thumb\/)?[^"'\s]+\.(?:jpg|jpeg|png|webp)/gi
    )) {
      let url = m[0].split("?")[0];
      if (url.includes("/thumb/")) {
        const match = url.match(/\/thumb\/([^/]+\.(?:jpg|jpeg|png|webp))\/(\d+px-[^/]+)$/i);
        if (match) url = "https://warcraft.wiki.gg/images/thumb/" + match[1] + "/" + match[2];
      }
      imgs.add(url);
    }
    return [...imgs];
  }

  function shouldSkipWiki(base, url) {
    const lower = (base + " " + url).toLowerCase();
    return /worldmap|map-|icon|quest|ability|inv_|spell_|ui-|logo|banner|button|talent|interface|achievement|trade_|item_|npc_|creature_|race_|class_|faction_|gossip|cursor|blank|1x1|pixel|site-|network_|footer|badge|stub|blip|gif|svg|png\?|\.png$|\.gif$|\.svg$/.test(
      lower
    );
  }

  await page.goto("about:blank");

  const direct = [
    [
      "aldrassil-classic-art.jpg",
      "https://static.wikia.nocookie.net/wowpedia/images/4/4b/Aldrassil.jpg/revision/latest?cb=20060604152207",
      "art",
      "request",
    ],
    ["aldrassil-wiki.jpg", "https://warcraft.wiki.gg/images/4/4b/Aldrassil.jpg", "art", "browser"],
    [
      "shadowglen-gameplay-wallhere-1920.jpg",
      "https://get.wallhere.com/photo/1920x1080-1673607.jpg",
      "gameplay/in-game",
      "request",
    ],
    [
      "shadowglen-gameplay-1.jpg",
      "https://warcraft.wiki.gg/images/thumb/Shadowglen.jpg/800px-Shadowglen.jpg",
      "gameplay/in-game",
      "browser",
    ],
    ["shadowglen-gameplay-2.jpg", "https://warcraft.wiki.gg/images/8/8a/Shadowglen.jpg", "gameplay/in-game", "browser"],
    ["shadowglen-gameplay-3.jpg", "https://warcraft.wiki.gg/images/Teldrassil1.jpg", "gameplay/in-game", "browser"],
    ["shadowglen-gameplay-4.jpg", "https://warcraft.wiki.gg/images/Dolanaar.jpg", "gameplay/in-game", "browser"],
    ["teldrassil-wiki-tree.jpg", "https://warcraft.wiki.gg/images/4/4c/Teldrassil.jpg", "art", "browser"],
    ["shadowglen-wiki-start.jpg", "https://warcraft.wiki.gg/images/thumb/Shadowglen.jpg/800px-Shadowglen.jpg", "art", "browser"],
    [
      "shadowglen-gameplay-wowhead-1.jpg",
      "https://wow.zamimg.com/uploads/screenshots/normal/762033-teldrassil.jpg",
      "gameplay/in-game",
      "request",
    ],
    [
      "shadowglen-gameplay-wowhead-2.jpg",
      "https://wow.zamimg.com/uploads/screenshots/normal/1030955.jpg",
      "gameplay/in-game",
      "request",
    ],
    [
      "shadowglen-gameplay-wowhead-3.jpg",
      "https://wow.zamimg.com/uploads/screenshots/normal/1030956.jpg",
      "gameplay/in-game",
      "request",
    ],
  ];

  const written = [];
  const errors = [];
  const seen = new Set();
  const wikiReferer = "https://warcraft.wiki.gg/wiki/Shadowglen";

  for (const [name, url, kind, mode] of direct) {
    if (seen.has(url)) continue;
    seen.add(url);
    const r =
      mode === "browser"
        ? await saveViaBrowserFetch(name, url, kind, wikiReferer)
        : await saveViaRequest(name, url, kind);
    if (r.path) written.push(r);
    else errors.push(r);
  }

  const wikiPages = [
    ["shadowglen", "https://warcraft.wiki.gg/wiki/Shadowglen"],
    ["aldrassil", "https://warcraft.wiki.gg/wiki/Aldrassil"],
    ["teldrassil", "https://warcraft.wiki.gg/wiki/Teldrassil"],
  ];

  let wikiIdx = 1;
  for (const [prefix, pageUrl] of wikiPages) {
    await page.goto(pageUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
    const html = await page.content();
    const imgs = extractWikiImages(html);
    for (const imgUrl of imgs) {
      if (seen.has(imgUrl)) continue;
      const base = decodeURIComponent(imgUrl.split("/").pop());
      if (shouldSkipWiki(base, imgUrl)) continue;
      seen.add(imgUrl);
      const name = prefix + "-wiki-" + wikiIdx++ + "-" + base.replace(/\//g, "-");
      const r = await saveViaBrowserFetch(name, imgUrl, null, pageUrl);
      if (r.path) written.push(r);
      else errors.push(r);
    }
  }

  await page.goto("https://www.wowhead.com/zone=141/teldrassil/screenshots", {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });
  await page.waitForTimeout(2000);
  const whHtml = await page.content();
  const whImgs = [
    ...whHtml.matchAll(/https:\/\/wow\.zamimg\.com\/uploads\/screenshots\/normal\/[^"'\s]+\.(?:jpg|jpeg|png|webp)/gi),
  ].map((m) => m[0]);
  let whIdx = written.filter((w) => w.name.includes("wowhead")).length + 1;
  for (const url of [...new Set(whImgs)]) {
    if (seen.has(url)) continue;
    seen.add(url);
    const ext = (url.match(/\.(jpg|jpeg|png|webp)/i) || [".jpg"])[0];
    const r = await saveViaRequest("shadowglen-gameplay-wowhead-" + whIdx++ + ext, url, "gameplay/in-game");
    if (r.path) written.push(r);
    else errors.push(r);
  }

  return { count: written.length, written, errors: errors.slice(0, 20) };
}
