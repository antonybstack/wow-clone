// Playwright MCP runner: paste the exported function body into browser_run_code_unsafe.
// Kept in-repo so the download logic stays versioned with the Node script.

export const PLAYWRIGHT_DOWNLOAD_FN = String.raw`async (page) => {
  const outDir = '/Users/antbly/dev/wow-clone/public/refs';
  const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

  function classify(name, url) {
    const s = (name + ' ' + url).toLowerCase();
    if (/worldmap|map-|zone.?map|minimap/.test(s)) return 'map';
    if (/icon|quest|ability|inv_|spell_|ui-|logo|banner|button/.test(s)) return 'ui/icon';
    if (/classic-art|aldrassil\\.jpg|aldrassil-art|concept|artwork|painting|illustration/.test(s)) return 'art';
    if (/ingame|in-game|gameplay|screenshot|wallhere|wowhead|classic|start\\.jpg|_start/.test(s)) return 'gameplay/in-game';
    if (/teldrassil\\.jpg|tree\\.jpg|shadowglen\\.jpg/.test(s) && !/ingame|in-game/.test(s)) return 'art';
    return 'gameplay/in-game';
  }

  function wikiFullUrl(url) {
    return url.replace(/\\/thumb(\\/)/i, '$1').replace(/\\/(\\d+)px-[^/]+$/i, '');
  }

  async function saveImage(name, url, kind) {
    try {
      const resp = await page.context().request.get(url, { headers: { 'User-Agent': UA } });
      if (!resp.ok()) return { name, error: resp.status() + ' ' + url };
      const buf = await resp.body();
      const ct = resp.headers()['content-type'] || 'image/jpeg';
      if (buf.length < 3000 && !ct.includes('image')) return { name, error: 'too small ' + buf.length };
      const b64 = buf.toString('base64');
      const [download] = await Promise.all([
        page.waitForEvent('download', { timeout: 30000 }),
        page.evaluate(({ b64, ct, name }) => {
          const a = document.createElement('a');
          a.href = 'data:' + ct + ';base64,' + b64;
          a.download = name;
          document.body.appendChild(a);
          a.click();
          a.remove();
        }, { b64, ct, name }),
      ]);
      const savePath = outDir + '/' + name;
      await download.saveAs(savePath);
      return { name, path: savePath, bytes: buf.length, kind: kind || classify(name, url), url };
    } catch (e) {
      return { name, error: e.message, url };
    }
  }

  async function scrapeWiki(pageUrl) {
    const res = await page.context().request.get(pageUrl, { headers: { 'User-Agent': UA } });
    const html = await res.text();
    const imgs = new Set();
    for (const m of html.matchAll(/(?:src|href|data-src)="(\\/images\\/[^"]+\\.(?:jpg|jpeg|png|webp)(?:\\/[^"]*)?)"/gi)) {
      imgs.add(wikiFullUrl('https://warcraft.wiki.gg' + m[1].split('?')[0]));
    }
    for (const m of html.matchAll(/https:\\/\\/warcraft\\.wiki\\.gg\\/images\\/[^"'\\s]+\\.(?:jpg|jpeg|png|webp)(?:\\/[^"'\\s]*)?/gi)) {
      imgs.add(wikiFullUrl(m[0].split('?')[0]));
    }
    return [...imgs];
  }

  async function scrapeWowhead(zoneId) {
    const res = await page.context().request.get('https://www.wowhead.com/zone=' + zoneId + '/screenshots', { headers: { 'User-Agent': UA } });
    if (!res.ok()) return [];
    const html = await res.text();
    const imgs = new Set();
    for (const m of html.matchAll(/https:\\/\\/wow\\.zamimg\\.com\\/uploads\\/screenshots\\/[^"'\\s]+\\.(?:jpg|jpeg|png|webp)/gi)) imgs.add(m[0]);
    for (const m of html.matchAll(/data-full="([^"]+)"/gi)) if (/\\.(jpg|jpeg|png|webp)/i.test(m[1])) imgs.add(m[1]);
    return [...imgs];
  }

  function shouldSkipWiki(base) {
    const lower = base.toLowerCase();
    return /worldmap|map-|icon|quest|ability|inv_|spell_|ui-|logo|banner|button|talent|interface|achievement|trade_|item_|npc_|creature_|race_|class_|faction_|gossip|cursor|blank|1x1|pixel/.test(lower);
  }

  await page.goto('about:blank');

  const direct = [
    ['aldrassil-classic-art.jpg', 'https://static.wikia.nocookie.net/wowpedia/images/4/4b/Aldrassil.jpg/revision/latest?cb=20060604152207', 'art'],
    ['aldrassil-wiki.jpg', 'https://warcraft.wiki.gg/images/4/4b/Aldrassil.jpg', 'art'],
    ['shadowglen-gameplay-wallhere-1920.jpg', 'https://get.wallhere.com/photo/1920x1080-1673607.jpg', 'gameplay/in-game'],
    ['shadowglen-wiki-start.jpg', 'https://static.wikia.nocookie.net/wowpedia/images/8/8a/Shadowglen.jpg/revision/latest?cb=20060604152207', 'art'],
    ['teldrassil-wiki-tree.jpg', 'https://static.wikia.nocookie.net/wowpedia/images/4/4c/Teldrassil.jpg/revision/latest?cb=20060604152207', 'art'],
    ['shadowglen-gameplay-1.jpg', 'https://static.wikia.nocookie.net/wowpedia/images/2/2e/Aldrassil_in-game.jpg/revision/latest?cb=20120613160524', 'gameplay/in-game'],
    ['shadowglen-gameplay-2.jpg', 'https://static.wikia.nocookie.net/wowpedia/images/1/1a/Shadowglen_in-game.jpg/revision/latest?cb=20120613160524', 'gameplay/in-game'],
    ['shadowglen-gameplay-3.jpg', 'https://static.wikia.nocookie.net/wowpedia/images/9/9e/Shadowglen_start.jpg/revision/latest?cb=20120613160524', 'gameplay/in-game'],
    ['shadowglen-gameplay-4.jpg', 'https://static.wikia.nocookie.net/wowpedia/images/0/0a/Teldrassil_in-game.jpg/revision/latest?cb=20120613160524', 'gameplay/in-game'],
    ['shadowglen-gameplay-5.jpg', 'https://static.wikia.nocookie.net/wowpedia/images/3/3c/ShadowglenClassic.jpg/revision/latest?cb=20180510092157', 'gameplay/in-game'],
    ['shadowglen-gameplay-6.jpg', 'https://static.wikia.nocookie.net/wowpedia/images/a/a0/Aldrassil_tree.jpg/revision/latest?cb=20120613160524', 'gameplay/in-game'],
    ['shadowglen-gameplay-7.jpg', 'https://static.wikia.nocookie.net/wowpedia/images/8/8a/Shadowglen.jpg/revision/latest?cb=20060604152207', 'gameplay/in-game'],
  ];

  const written = [];
  const seen = new Set();

  for (const [name, url, kind] of direct) {
    if (seen.has(url)) continue;
    seen.add(url);
    const r = await saveImage(name, url, kind);
    if (r.path) written.push(r); else console.log('ERR', name, r.error);
  }

  const wikiPages = [
    ['shadowglen', 'https://warcraft.wiki.gg/wiki/Shadowglen'],
    ['aldrassil', 'https://warcraft.wiki.gg/wiki/Aldrassil'],
    ['teldrassil', 'https://warcraft.wiki.gg/wiki/Teldrassil'],
  ];
  let wikiIdx = 1;
  for (const [prefix, pageUrl] of wikiPages) {
    const imgs = await scrapeWiki(pageUrl);
    for (const imgUrl of imgs) {
      if (seen.has(imgUrl)) continue;
      const base = decodeURIComponent(imgUrl.split('/').pop());
      if (shouldSkipWiki(base)) continue;
      if (!/\\.(jpg|jpeg|png|webp)$/i.test(base)) continue;
      seen.add(imgUrl);
      const name = prefix + '-wiki-' + wikiIdx++ + '-' + base;
      const r = await saveImage(name, imgUrl);
      if (r.path) written.push(r);
    }
  }

  const wh = await scrapeWowhead(141);
  let whIdx = 1;
  for (const url of wh.slice(0, 10)) {
    if (seen.has(url)) continue;
    seen.add(url);
    const ext = (url.match(/\\.(jpg|jpeg|png|webp)/i) || ['.jpg'])[0];
    const r = await saveImage('shadowglen-gameplay-wowhead-' + whIdx++ + ext, url, 'gameplay/in-game');
    if (r.path) written.push(r);
  }

  for (const [i, url] of [
    'https://get.wallhere.com/photo/1673607.jpg',
    'https://get.wallhere.com/photo/1920x1080/1673607.jpg',
    'https://i.wallhere.com/photos/1673607.jpg',
  ].entries()) {
    if (seen.has(url)) continue;
    seen.add(url);
    const r = await saveImage('shadowglen-wallhere-alt-' + (i + 1) + '.jpg', url, 'gameplay/in-game');
    if (r.path) written.push(r);
  }

  return { count: written.length, written };
}`;
