/** Fresh-process playable/input measurement; no settled FPS claim.
 * CDP throttling: https://chromedevtools.github.io/devtools-protocol/tot/Network/#method-emulateNetworkConditions
 * Each run starts with an empty browser cache. OS/CDN/driver caches are not cleared.
 */
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {execFileSync} from 'node:child_process';
import assert from "node:assert/strict";
import { chromium } from "playwright";
import {migrateAppearance} from '../../src/character/appearance/contract.js';
import {findHumanIdentityPreset} from '../../src/character/appearance/human-identity.js';
import {ASHEN_PLAYABLE_CLIP_NAMES} from '../../src/character/runtime/ashen-playable-motion.js';
import {EQUIPMENT_ITEMS} from '../../src/ashen-reach/equipment-catalog.js';
import {installGpuEventProbe} from '../lib/probe-gpu-events.mjs';
import {startupBudget} from '../lib/startup-budget.mjs';
const gpuProbe = process.env.ASHEN_PROBE_GPU_EVENTS === '1';
const traceGpu = process.env.ASHEN_PROBE_CHROME_TRACE === '1';
const disableShaderCache = process.env.ASHEN_PROBE_DISABLE_SHADER_CACHE === '1';
const disableHttpCache = process.env.ASHEN_PROBE_DISABLE_HTTP_CACHE === '1';
const seed=process.env.ASHEN_PROBE_APPEARANCE?JSON.parse(await fs.readFile(process.env.ASHEN_PROBE_APPEARANCE,'utf8')):null;
const expectedSeed=seed?migrateAppearance(seed):null;
const identity=expectedSeed?.race==='human'?findHumanIdentityPreset(expectedSeed.components):null;
const identityPack=identity&&identity.id!=='starter'
  ? JSON.parse(await fs.readFile('public/ashen-reach/human-identity-v1/manifest.json','utf8')).presets[identity.id].manifest:null;
const destination = process.argv[2];
assert(destination, "Specify report.json");
const runs = Number(process.env.ASHEN_PROBE_RUNS || 5),
  profile = process.env.ASHEN_PROBE_PROFILE || "50mbps";
assert(Number.isInteger(runs) && runs > 0 && runs <= 30);
// Opt in for release gates; ordinary investigations remain measurement-only.
const budgetMs=process.env.ASHEN_PROBE_MAX_MS===undefined?null:Number(process.env.ASHEN_PROBE_MAX_MS);
assert(budgetMs===null||(Number.isFinite(budgetMs)&&budgetMs>0),'Invalid ASHEN_PROBE_MAX_MS');
const conditions = {
  native: { latency: 0, downloadThroughput: -1, uploadThroughput: -1 },
  "50mbps": {
    latency: 40,
    downloadThroughput: 50e6 / 8,
    uploadThroughput: 10e6 / 8,
  },
  "10mbps": {
    latency: 80,
    downloadThroughput: 10e6 / 8,
    uploadThroughput: 2e6 / 8,
  },
};
assert(conditions[profile]);
const target = new URL(process.env.ASHEN_TEST_URL || "http://127.0.0.1:7074/");
target.searchParams.set("play", "");
target.searchParams.set("pixelRatio", "1");
const report = {
  conditions: {
    requestedRuns:runs, budgetMs,
    gpuProbe, traceGpu, disableShaderCache, disableHttpCache,
    profile, savedAppearance:seed,expectedAppearance:expectedSeed,
    network: conditions[profile],
    cpu: os.cpus()[0]?.model,
    viewport: [1280, 720],
    cache:
      `Fresh browser process/profile each run; HTTP cache ${disableHttpCache ? 'disabled through CDP (including prefetch reuse)' : 'initially empty, native prefetch reuse allowed'}; OS and GPU-driver caches uncontrolled`,
    timing:
      "Navigation start to grounded, dressed, GPU-completed frame with overlay removed and input enabled",
  },
  rows: [],
};
await fs.mkdir(path.dirname(destination), { recursive: true });
for (let run = 1; run <= runs; run++) {
  // Diagnostic only; never mix this forced cache policy with acceptance cohorts.
  // https://chromium.googlesource.com/chromium/src/+/HEAD/gpu/config/gpu_switches.cc
  const browser = await chromium.launch({ channel: "chrome", headless: true, args:disableShaderCache?['--disable-gpu-shader-disk-cache']:[] });
  const browserPid=execFileSync('ps',['-axo','pid=,ppid=,command='],{encoding:'utf8'}).split('\n').map(line=>/^\s*(\d+)\s+(\d+)\s+(.*)$/.exec(line)).find(m=>m&&Number(m[2])===process.pid&&/Chrome|Chromium/.test(m[3]))?.[1]||null;
  await fs.writeFile(destination+'.ownership.json',JSON.stringify({owner:'probe-playable-startup',controllerPid:process.pid,browserPid,cdpPort:null,url:target.href,purpose:`${profile} cold run ${run}`,active:true}));
  const errors=[],requests=new Map();let rowRecorded=false;
  try {
    const context = await browser.newContext({
        viewport: { width: 1280, height: 720 },
        deviceScaleFactor: 1,
        serviceWorkers: "block",
      }),
      page = await context.newPage();
    if(seed)await context.addInitScript(recipe=>localStorage.setItem('ashen.appearance.v2',JSON.stringify(recipe)),seed);
    if(gpuProbe)await context.addInitScript(installGpuEventProbe);
    const cdp = await context.newCDPSession(page);
    if(traceGpu)await cdp.send('Tracing.start',{categories:'gpu,gpu.dawn,gpu.dawn.validation,gpu.dawn.recording,gpu.dawn.gpu_work,disabled-by-default-gpu.dawn,disabled-by-default-gpu.service,toplevel,blink.user_timing,devtools.timeline',transferMode:'ReturnAsStream'});
    await cdp.send("Network.enable");
    // An empty profile and a disabled cache are different conditions: disabling
    // also prevents native prefetch reuse. Record the prescribed policy rather
    // than silently labelling an empty-profile cohort as cache-disabled.
    // https://chromedevtools.github.io/devtools-protocol/tot/Network/#method-setCacheDisabled
    if(disableHttpCache) await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
    await cdp.send("Network.emulateNetworkConditions", {
      offline: false,
      ...conditions[profile],
    });
    await page.addInitScript(() => {
      window.__loadGpuErrors = [];
      window.__loadTasks = [];
      new PerformanceObserver((list) =>
        window.__loadTasks.push(
          ...list
            .getEntries()
            .map((e) => ({ start: e.startTime, duration: e.duration })),
        ),
      ).observe({ type: "longtask", buffered: true });
      const original = GPUAdapter.prototype.requestDevice;
      GPUAdapter.prototype.requestDevice = async function (...args) {
        const device = await original.apply(this, args);
        device.addEventListener("uncapturederror", (e) =>
          window.__loadGpuErrors.push(e.error.message),
        );
        return device;
      };
      addEventListener("keydown", (e) => {
        if (e.code === "KeyW") window.__loadKeyAt = performance.now();
      });
    });
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    let clockOffset;
    cdp.on("Network.requestWillBeSent", (e) => {
      clockOffset ??= e.wallTime - e.timestamp;
      requests.set(e.requestId, {
        url: e.request.url,
        start: e.timestamp,
        chunks: [],
      });
    });
    cdp.on("Network.dataReceived", (e) =>
      requests
        .get(e.requestId)
        ?.chunks.push({ at: e.timestamp, bytes: e.encodedDataLength }),
    );
    // Keep transport evidence when a public cold cohort differs from a local
    // build or a deployment hostname. Record only diagnostic response fields,
    // never request credentials or the complete response-header collection.
    // https://chromedevtools.github.io/devtools-protocol/tot/Network/#event-responseReceived
    cdp.on("Network.responseReceived", ({requestId,response}) => {
      const r=requests.get(requestId);if(!r)return;
      const headers=Object.fromEntries(Object.entries(response.headers).map(([k,v])=>[k.toLowerCase(),v]));
      r.response={status:response.status,mimeType:response.mimeType,protocol:response.protocol,
        remoteIPAddress:response.remoteIPAddress,cfRay:headers['cf-ray']??null,
        cfCacheStatus:headers['cf-cache-status']??null,cacheControl:headers['cache-control']??null};
    });
    cdp.on("Network.loadingFinished", (e) => {
      const r = requests.get(e.requestId);
      if (r) Object.assign(r, { end: e.timestamp, bytes: e.encodedDataLength });
    });
    await page.goto(target.href, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => globalThis.ASHEN?.playableReady, null, {
      timeout: 30000,
    });
    const row = await page.evaluate(() => ({
      origin: performance.timeOrigin,
      shape: ASHEN.humanShape,
      heightScale: ASHEN.player.heightScale,
      // Observe the actual native actor at the playable boundary; saved recipe
      // bookkeeping alone could pass while the wrong head/body was rendering.
      // Native morph/skin ordering: https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#skins
      storedAppearance: JSON.parse(localStorage.getItem('ashen.appearance.v2')),
      rootScale: [ASHEN.body.root.scaling.x,ASHEN.body.root.scaling.y,ASHEN.body.root.scaling.z],
      nativeIdentity: ASHEN.scene.meshes.filter(m=>['HumanV1Body','HumanIdentityEyes','HumanIdentityBrows','HumanPonytail01'].includes(m.name)).map(m=>({name:m.name,visible:m.visible!==false,weights:m.morphTargets?Array.from(m.morphTargets.weights):null})),
      animationGroups: ASHEN.body.animationGroups.map(g=>g.name).sort(),
      race: ASHEN.equipment.race,
      equipment: ASHEN.equipment.getState(),
      dyes: ASHEN.equipment.getDyes(),
      marks: ASHEN.startup.timings(),
      resources: performance.getEntriesByType('resource').map(r=>({
        name:r.name,start:r.startTime,responseStart:r.responseStart,end:r.responseEnd,
        transferSize:r.transferSize,encodedBodySize:r.encodedBodySize,initiator:r.initiatorType,protocol:r.nextHopProtocol,
      })),
      navigation: performance.getEntriesByType('navigation').map(r=>({start:r.startTime,responseStart:r.responseStart,end:r.responseEnd,domContentLoaded:r.domContentLoadedEventEnd,protocol:r.nextHopProtocol})),
      playableMs: ASHEN.startup.timings().playable,
      grounded: ASHEN.player.getGrounded(),
      physics: ASHEN.player.getDebugState().usingPhysics,
      loader: !!document.getElementById("loading"),
      canvas: [
        document.getElementById("renderCanvas").width,
        document.getElementById("renderCanvas").height,
      ],
      position: {
        x: ASHEN.player.body.position.x,
        z: ASHEN.player.body.position.z,
      },
      frame: ASHEN.gpu.frames,
      gpuErrors: window.__loadGpuErrors,
      tasks: window.__loadTasks,
    }));
    const boundary = row.origin / 1000 - clockOffset + row.playableMs / 1000;
    row.requests = [...requests.values()]
      .filter((r) => r.start <= boundary)
      .map((r) => ({
        url: r.url,
        response: r.response,
        complete: r.end <= boundary,
        encodedBytesAtBoundary:
          r.end <= boundary
            ? r.bytes
            : r.chunks
                .filter((c) => c.at <= boundary)
                .reduce((n, c) => n + c.bytes, 0),
      }));
    row.encodedBytesAtBoundary = row.requests.reduce(
      (n, r) => n + r.encodedBytesAtBoundary,
      0,
    );
    await page.screenshot({
      path: destination.replace(/\.json$/, `-${run}.png`),
    });
    await page.keyboard.down("KeyW");
    await page.waitForFunction(
      ({ position, frame }) =>
        Math.hypot(
          ASHEN.player.body.position.x - position.x,
          ASHEN.player.body.position.z - position.z,
        ) > 0.03 && ASHEN.gpu.frames > frame + 1,
      row,
      { timeout: 2000 },
    );
    // Fence the frame that follows observed displacement, not just submission.
    await page.evaluate(async () => {
      await ASHEN.whenNextGpuFrame();
    });
    row.input = await page.evaluate(() => ({
      keyAt: window.__loadKeyAt,
      observedAt: performance.now(),
      position: {
        x: ASHEN.player.body.position.x,
        z: ASHEN.player.body.position.z,
      },
      frames: ASHEN.gpu.frames,
      gpuErrors: window.__loadGpuErrors,
    }));
    await page.keyboard.up("KeyW");
    row.input.responseUpperBoundMs = row.input.observedAt - row.input.keyAt;
    if(gpuProbe)row.gpuEvents=await page.evaluate(()=>{globalThis.__stopGpuEventProbe=true;return globalThis.__startupGpuEvents;});
    if(traceGpu) {
      const completed=new Promise(resolve=>cdp.once('Tracing.tracingComplete',resolve));
      await cdp.send('Tracing.end');
      const {stream}=await completed, chunks=[];
      for(;;){const chunk=await cdp.send('IO.read',{handle:stream});chunks.push(Buffer.from(chunk.data,chunk.base64Encoded?'base64':'utf8'));if(chunk.eof)break;}
      await cdp.send('IO.close',{handle:stream});
      await fs.writeFile(destination.replace(/\.json$/,`-${run}.trace.json`),Buffer.concat(chunks));
    }
    row.errors = errors;
    row.run = run;row.browserPid=browserPid;
    report.rows.push(row);rowRecorded=true;
    await fs.writeFile(destination, JSON.stringify(report, null, 2));
    if(seed) {
      assert.equal(row.race,expectedSeed.race);assert.deepEqual(row.equipment,expectedSeed.equipment);
      assert.deepEqual(row.dyes,expectedSeed.dyes);
      assert.deepEqual(migrateAppearance(row.storedAppearance),expectedSeed);
      if(seed.race==='human') {
        assert.equal(row.heightScale,seed.shape.height);
        assert.deepEqual(row.rootScale.map(Math.abs),[seed.shape.height,seed.shape.height,seed.shape.height]);
        if(row.shape)assert.deepEqual(row.shape.weights,[Math.max(0,-seed.shape.build),Math.max(0,seed.shape.build)]);
        else {assert.equal(seed.shape.build,0);assert.equal(seed.shape.height,1);}
      }
    }
    if(identityPack){
      const visible=row.nativeIdentity.filter(m=>m.visible).map(m=>m.name);
      assert(visible.includes('HumanIdentityEyes')&&visible.includes('HumanIdentityBrows'),'Selected native facial meshes must render at first play');
      const covered=Object.values(expectedSeed.equipment).some(id=>EQUIPMENT_ITEMS[id]?.covers?.includes('head.scalp'));
      assert.equal(visible.includes('HumanPonytail01'),identity.id==='prime-ponytail'&&!covered,'First-play hair must agree with the selected identity and headwear');
      assert.deepEqual(row.animationGroups,[...ASHEN_PLAYABLE_CLIP_NAMES].sort());
      const paths=row.requests.map(r=>new URL(r.url).pathname);
      assert(paths.includes(identityPack.compactItems.body.url),'The selected compact body must load before first play');
      assert(!paths.includes(identityPack.items.body.url),'Unused full motion library must not load before first play');
      const weights=[Math.max(0,-seed.shape.build),Math.max(0,seed.shape.build)];
      assert(row.nativeIdentity.find(m=>m.name==='HumanV1Body')?.weights,'Selected body must declare native morphs');
      for(const mesh of row.nativeIdentity.filter(m=>m.visible&&m.weights)){
        assert.equal(mesh.weights.length,2);
        mesh.weights.forEach((w,i)=>assert(Math.abs(w-weights[i])<1e-5,`${mesh.name} native morph ${i} differs at first play`));
      }
      row.selectedIdentity={id:identity.id,bodyUrl:identityPack.compactItems.body.url,bodySha256:identityPack.compactItems.body.sha256};
    }
    assert(row.grounded && row.physics && !row.loader);
    assert(row.marks['supported-frame-submitted'] >= row.marks['equipment-end']);
    assert(row.marks['supported-frame-completed'] >= row.marks['supported-frame-submitted']);
    assert(row.playableMs >= row.marks['supported-frame-completed']);
    assert.deepEqual(row.canvas, [1280, 720]);
    assert.deepEqual(errors, []);
    assert.deepEqual(row.input.gpuErrors, []);
    await fs.writeFile(destination, JSON.stringify(report, null, 2));
    console.log(
      JSON.stringify({
        run,
        playableMs: row.playableMs,
        inputMs: row.input.responseUpperBoundMs,
        bytes: row.encodedBytesAtBoundary,
      }),
    );
  } catch(error) {
    // A failed first-use fence is part of the cohort. Retain its row and process
    // ownership instead of disappearing on the first timeout. Do not count it as
    // a successful start or retry it under the same run number.
    const failure={name:error.name,message:error.message};
    if(rowRecorded)report.rows.at(-1).validationFailure=failure;
    else report.rows.push({run,browserPid,failed:true,failure,requests:[...requests.values()],errors});
    await fs.writeFile(destination,JSON.stringify(report,null,2));
    console.log(JSON.stringify({run,failed:true,failure}));
    process.exitCode=1;
  } finally {
    await browser.close();
    await fs.writeFile(destination+'.ownership.json',JSON.stringify({owner:'probe-playable-startup',browserPid,url:target.href,active:false}));
  }
}
if(budgetMs!==null){
  report.budget=startupBudget(report.rows,runs,budgetMs);
  await fs.writeFile(destination,JSON.stringify(report,null,2));
  console.log(JSON.stringify({startupBudget:report.budget}));
  if(!report.budget.passed)process.exitCode=1;
}
