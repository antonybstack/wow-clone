/** Read-only production waterfall probe. Fresh browser per run; initially empty cache.
 * OS/DNS/CDN/driver caches are not cleared. Throttling is a desktop simulation.
 * Usage: node scripts/ashen-reach/probe-uncached-startup.mjs <report.json>
 * Optional ASHEN_PROBE_RUNS (default 3), ASHEN_TEST_URL, ASHEN_PROBE_PROFILES
 * (comma-separated native,50mbps,10mbps), ASHEN_PROBE_DISABLE_CACHE=1 for a
 * diagnostic that also prevents same-navigation prefetch reuse.
 * No FPS/visual acceptance is claimed.
 * CDP network units: https://chromedevtools.github.io/devtools-protocol/tot/Network/#method-emulateNetworkConditions
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {execFileSync} from 'node:child_process';
import {chromium} from 'playwright';

const destination = process.argv[2];
if (!destination) throw Error('Specify report.json');
const runs = Number(process.env.ASHEN_PROBE_RUNS || 3);
const disableCache = process.env.ASHEN_PROBE_DISABLE_CACHE === '1';
if (!Number.isInteger(runs) || runs < 1 || runs > 20) throw Error('Invalid run count');
const profiles = {
  native: {latency: 0, downloadThroughput: -1, uploadThroughput: -1},
  '50mbps': {latency: 40, downloadThroughput: 50e6 / 8, uploadThroughput: 10e6 / 8},
  '10mbps': {latency: 80, downloadThroughput: 10e6 / 8, uploadThroughput: 2e6 / 8},
};
const selected = (process.env.ASHEN_PROBE_PROFILES || 'native,50mbps,10mbps').split(',');
if (selected.some(p => !profiles[p])) throw Error('Unknown profile');
const url = new URL(process.env.ASHEN_TEST_URL || 'https://play.sparkify.dev/');
url.searchParams.set('play', '');
url.searchParams.set('clean', '');
url.searchParams.set('startupMarks', '');
url.searchParams.set('pixelRatio', '1');
const report = {
  schemaVersion: 1,
  date: new Date().toISOString(), sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], {encoding:'utf8'}).trim(),
  target: url.href, cpu: os.cpus()[0]?.model, platform: `${os.platform()} ${os.release()}`, profiles,
  cacheDisabled: disableCache,
  conditions: 'Fresh Chromium process/profile each run, initially empty HTTP cache, service workers blocked. OS/DNS/CDN/GPU-driver cache uncontrolled. Headless desktop 1280x720, device scale 1; no CPU throttle. Not physical iPhone or FPS acceptance.',
  rows: [],
};
await fs.mkdir(path.dirname(destination), {recursive:true});
const save = () => fs.writeFile(destination, JSON.stringify(report, null, 2) + '\n');
for (const profile of selected) for (let run = 1; run <= runs; run++) {
  const browser = await chromium.launch({channel:'chrome', headless:true});
  try {
    report.browser = browser.version();
    const context = await browser.newContext({viewport:{width:1280,height:720}, deviceScaleFactor:1, serviceWorkers:'block'});
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.setCacheDisabled', {cacheDisabled:disableCache});
    await cdp.send('Network.emulateNetworkConditions', {offline:false, ...profiles[profile]});
    await page.addInitScript(() => {
      performance.setResourceTimingBufferSize(2000);
      window.__probeTasks = [];
      new PerformanceObserver(list => window.__probeTasks.push(...list.getEntries().map(e => ({start:e.startTime,duration:e.duration}))))
        .observe({type:'longtask',buffered:true});
    });
    const requests = new Map(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    cdp.on('Network.requestWillBeSent', e => requests.set(e.requestId, {url:e.request.url,type:e.type,requestTime:e.timestamp,initiator:e.initiator.type}));
    cdp.on('Network.responseReceived', e => {
      const r = requests.get(e.requestId); if (!r) return;
      const h = Object.fromEntries(Object.entries(e.response.headers).map(([k,v]) => [k.toLowerCase(),v]));
      Object.assign(r, {status:e.response.status,responseTime:e.timestamp,protocol:e.response.protocol,fromDiskCache:!!e.response.fromDiskCache,
        contentType:e.response.mimeType,encoding:h['content-encoding'],cacheStatus:h['cf-cache-status'],cacheControl:h['cache-control'],timing:e.response.timing});
    });
    cdp.on('Network.loadingFinished', e => { const r = requests.get(e.requestId); if(r) Object.assign(r,{finishTime:e.timestamp,encodedBytes:e.encodedDataLength}); });
    cdp.on('Network.loadingFailed', e => errors.push(`request failed: ${requests.get(e.requestId)?.url}: ${e.errorText}`));
    await page.goto(url.href,{waitUntil:'domcontentloaded',timeout:120000});
    await page.waitForFunction(() => globalThis.ASHEN?.ready && ASHEN.hostilesReady && performance.getEntriesByName('ashen-startup-first-gpu-completed').length, null, {timeout:120000});
    const row = await page.evaluate(() => ({
      finalUrl:location.href, navigation:performance.getEntriesByType('navigation').map(e=>e.toJSON()),
      marks:Object.fromEntries(performance.getEntriesByType('mark').filter(e=>e.name.startsWith('ashen-startup-')).map(e=>[e.name.slice(14),e.startTime])),
      resources:performance.getEntriesByType('resource').map(e=>({name:e.name,initiatorType:e.initiatorType,
        startTime:e.startTime,duration:e.duration,fetchStart:e.fetchStart,requestStart:e.requestStart,
        responseStart:e.responseStart,responseEnd:e.responseEnd,transferSize:e.transferSize,
        encodedBodySize:e.encodedBodySize,decodedBodySize:e.decodedBodySize,nextHopProtocol:e.nextHopProtocol})), longTasks:window.__probeTasks,
      enemies:ASHEN.combat.enemies.length,physics:ASHEN.player.getDebugState(),
      loadingVisible:!!document.getElementById('loading'),canvas:{width:document.getElementById('renderCanvas').width,height:document.getElementById('renderCanvas').height},
    }));
    Object.assign(row,{profile,run,requests:[...requests.values()],errors});
    // The root document client redirect creates a second timeOrigin. CDP document
    // request timestamps preserve that otherwise invisible navigation overhead.
    const documents = row.requests.filter(r=>r.type==='Document');
    row.rootToGameRequestMs = documents.length > 1 ? (documents.at(-1).requestTime-documents[0].requestTime)*1000 : 0;
    row.readyFromRootApproxMs = row.rootToGameRequestMs + row.marks.ready;
    report.rows.push(row);
    await save();
    console.log(JSON.stringify({profile,run,readyMs:row.marks.ready,rootReadyApproxMs:row.readyFromRootApproxMs,encodedBytes:row.requests.reduce((n,r)=>n+(r.encodedBytes||0),0),errors}));
    if (errors.length || !row.physics.usingPhysics || row.enemies !== 7 || row.loadingVisible) throw Error('Startup validation failed');
  } catch(e) {
    report.failure = {profile,run,message:e.stack}; await save(); throw e;
  } finally { await browser.close(); }
}
