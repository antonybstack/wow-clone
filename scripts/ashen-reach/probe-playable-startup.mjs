/** Fresh-process playable/input measurement; no settled FPS claim.
 * CDP throttling: https://chromedevtools.github.io/devtools-protocol/tot/Network/#method-emulateNetworkConditions
 * Each run starts with an empty browser cache. OS/CDN/driver caches are not cleared.
 */
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {createHash} from 'node:crypto';
import assert from "node:assert/strict";
import { chromium } from "playwright";
import {migrateAppearance} from '../../src/character/appearance/contract.js';
import {findHumanIdentityPreset} from '../../src/character/appearance/human-identity.js';
import {ASHEN_PLAYABLE_CLIP_NAMES} from '../../src/character/runtime/ashen-playable-motion.js';
import {EQUIPMENT_ITEMS} from '../../src/ashen-reach/equipment-catalog.js';
import {installGpuEventProbe} from '../lib/probe-gpu-events.mjs';
import {startupBudget} from '../lib/startup-budget.mjs';
import {installNetworkFailureProbe} from '../lib/probe-network-failures.mjs';
import {browserOwnership} from '../lib/browser-ownership.mjs';
const gpuProbe = process.env.ASHEN_PROBE_GPU_EVENTS === '1';
const traceGpu = process.env.ASHEN_PROBE_CHROME_TRACE === '1';
const disableShaderCache = process.env.ASHEN_PROBE_DISABLE_SHADER_CACHE === '1';
const disableHttpCache = process.env.ASHEN_PROBE_DISABLE_HTTP_CACHE === '1';
const netLog = process.env.ASHEN_PROBE_NETLOG === '1';
const seed=process.env.ASHEN_PROBE_APPEARANCE?JSON.parse(await fs.readFile(process.env.ASHEN_PROBE_APPEARANCE,'utf8')):null;
const expectedSeed=seed?migrateAppearance(seed):null;
const identity=expectedSeed?.race==='human'?findHumanIdentityPreset(expectedSeed.components):null;
// Pin expectations to the build under test. Production may still use older
// content-addressed bodies than the current checkout; a valid dressed start
// must not become a false failure merely because its filename changed locally.
// Download and verify a release catalogue before timing, then pass its path.
// https://nodejs.org/api/crypto.html#cryptocreatehashalgorithm-options
const identityCatalogueFile=process.env.ASHEN_PROBE_IDENTITY_CATALOGUE||'public/ashen-reach/human-identity-v1/manifest.json';
const identityCatalogueBytes=identity&&identity.id!=='starter'?await fs.readFile(identityCatalogueFile):null;
const identityCatalogue=identityCatalogueBytes?JSON.parse(identityCatalogueBytes):null;
const identityPack=identity&&identity.id!=='starter'
  ? identityCatalogue.presets[identity.id].manifest:null;
if(identityPack)assert.deepEqual(identityPack.identity.components,identity.components,'Probe catalogue differs from the selected identity');
// Independent declared expectation, not the runtime selector: a failed coverage
// decision must fail this gate rather than teaching the verifier the same mistake.
const deferCoveredHair=process.env.ASHEN_PROBE_DEFER_COVERED_HAIR==='1';
const expectDeferredHair=deferCoveredHair&&identity?.id==='prime-ponytail'
  &&Object.values(expectedSeed.equipment).some(id=>EQUIPMENT_ITEMS[id]?.covers?.includes('head.scalp'));
const startingIdentityPack=expectDeferredHair?identityCatalogue.presets['prime-bald'].manifest:identityPack;
const destination = process.argv[2];
assert(destination, "Specify report.json");
const runs = Number(process.env.ASHEN_PROBE_RUNS || 5),
  profile = process.env.ASHEN_PROBE_PROFILE || "50mbps";
assert(Number.isInteger(runs) && runs > 0 && runs <= 30);
// Opt in for release gates; ordinary investigations remain measurement-only.
const budgetMs=process.env.ASHEN_PROBE_MAX_MS===undefined?null:Number(process.env.ASHEN_PROBE_MAX_MS);
assert(budgetMs===null||(Number.isFinite(budgetMs)&&budgetMs>0),'Invalid ASHEN_PROBE_MAX_MS');
// NetLog is an opt-in investigation, never a replacement release/FPS sample.
assert(!netLog || budgetMs===null, 'NetLog diagnostics cannot assert a startup acceptance budget');
if(netLog){
  const relative=path.relative(path.resolve('.cache'),path.resolve(destination));
  assert(relative&&!relative.startsWith('..')&&!path.isAbsolute(relative),'Keep raw NetLogs under .cache');
}
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
    gpuProbe, traceGpu, disableShaderCache, disableHttpCache, deferCoveredHair, netLog,
    profile, savedAppearance:seed,expectedAppearance:expectedSeed,
    identityCatalogue:identityCatalogueBytes?{file:identityCatalogueFile,sha256:createHash('sha256').update(identityCatalogueBytes).digest('hex')}:null,
    network: conditions[profile],
    cpu: os.cpus()[0]?.model,
    viewport: [1280, 720],
    cache:
      `Fresh browser process/profile each run; HTTP cache ${disableHttpCache ? 'disabled through CDP' : 'initially empty'}; within-visit preload reuse is not independently disabled or proved; OS/DNS/CDN/GPU-driver caches uncontrolled`,
    timing:
      "Navigation start to grounded, dressed, GPU-completed frame with overlay removed and input enabled",
  },
  rows: [],
};
await fs.mkdir(path.dirname(destination), { recursive: true });
for (let run = 1; run <= runs; run++) {
  // Diagnostic only; never mix this forced cache policy with acceptance cohorts.
  // https://chromium.googlesource.com/chromium/src/+/HEAD/gpu/config/gpu_switches.cc
  // Native startup logging defaults to stripped private information; no raw-byte
  // or sensitive capture mode. Preserve a distinct file for every fresh process.
  // https://www.chromium.org/for-testers/providing-network-details/#advanced-logging-on-startup
  const netLogPath=netLog?path.resolve(`${destination}.run-${run}.netlog.json`):null;
  if(netLogPath){const reservation=await fs.open(netLogPath,'wx');await reservation.close();}
  const errors=[],pageErrors=[],requests=new Map(),earlyHints=[];let rowRecorded=false, page, networkProbe, browser, browserPid, ownership;
  try {
    browser=await chromium.launch({channel:'chrome',headless:true,args:[
      ...(disableShaderCache?['--disable-gpu-shader-disk-cache']:[]),
      ...(netLogPath?[`--log-net-log=${netLogPath}`,'--net-log-max-size-mb=64']:[]),
    ]});
    ownership={...await browserOwnership(browser,{cdpPort:null,url:target.href,purpose:`${profile} cold run ${run}`,renderingClients:1}),cdpPort:null,owner:'probe-playable-startup',controllerPid:process.pid};
    browserPid=ownership.browserPid;
    await fs.writeFile(destination+'.ownership.json',JSON.stringify(ownership));
    const context = await browser.newContext({
        viewport: { width: 1280, height: 720 },
        deviceScaleFactor: 1,
        serviceWorkers: "block",
      });
    page = await context.newPage();
    if(seed)await context.addInitScript(recipe=>localStorage.setItem('ashen.appearance.v2',JSON.stringify(recipe)),seed);
    if(gpuProbe)await context.addInitScript(installGpuEventProbe);
    const cdp = await context.newCDPSession(page);
    if(traceGpu)await cdp.send('Tracing.start',{categories:'gpu,gpu.dawn,gpu.dawn.validation,gpu.dawn.recording,gpu.dawn.gpu_work,disabled-by-default-gpu.dawn,disabled-by-default-gpu.service,toplevel,blink.user_timing,devtools.timeline',transferMode:'ReturnAsStream'});
    networkProbe=await installNetworkFailureProbe(cdp,requests);
    await cdp.send("Network.enable");
    // An empty profile and a disabled HTTP cache are different conditions.
    // Do not infer that this command disables every within-visit HTML preload
    // reuse mechanism; our native texture diagnostics observe such consumption.
    // https://chromedevtools.github.io/devtools-protocol/tot/Network/#method-setCacheDisabled
    // Chrome needs cache reuse for 103 preloads, even on a first visit:
    // https://developer.chrome.com/docs/web-platform/early-hints
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
        if (e.code !== "KeyW" || e.repeat) return;
        window.__loadKeyAt = performance.now();
        // Snapshot at the actual input event, after the screenshot, so idle
        // physics drift before the key cannot satisfy the movement assertion.
        // https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/repeat
        const a = globalThis.ASHEN;
        window.__loadInputStart = a && {
          position: {x: a.player.body.position.x, z: a.player.body.position.z},
          frame: a.gpu.frames,
        };
      });
    });
    page.on("pageerror", (e) => {errors.push(e.message);pageErrors.push({name:e.name,message:e.message,stack:e.stack});});
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    let clockOffset;
    cdp.on("Network.requestWillBeSent", (e) => {
      clockOffset ??= e.wallTime - e.timestamp;
      requests.set(e.requestId, {
        requestId: e.requestId,
        url: e.request.url,
        start: e.timestamp,
        initiator: e.initiator.type,
        initialPriority: e.request.initialPriority,
        priorityChanges: [],
        chunks: [],
      });
    });
    // Inspect native scheduling before changing fetchpriority. Async entry
    // scripts can receive a different priority from their modulepreload graph.
    // https://chromedevtools.github.io/devtools-protocol/tot/Network/#event-resourceChangedPriority
    cdp.on('Network.resourceChangedPriority', ({requestId,newPriority,timestamp}) => {
      requests.get(requestId)?.priorityChanges.push({priority:newPriority,at:timestamp});
    });
    cdp.on("Network.dataReceived", (e) =>
      requests
        .get(e.requestId)
        ?.chunks.push({ at: e.timestamp, bytes: e.encodedDataLength }),
    );
    // A final Link header does not prove 103 delivery or preload consumption.
    // Keep only public resource hints, not the complete headers (cookies etc.).
    // This event has no protocol timestamp; receiptAt is observer wall time.
    // https://chromedevtools.github.io/devtools-protocol/tot/Network/#event-responseReceivedEarlyHints
    cdp.on('Network.responseReceivedEarlyHints', ({requestId,headers}) => {
      const link=Object.entries(headers).find(([key])=>key.toLowerCase()==='link')?.[1]??null;
      earlyHints.push({requestId,receiptAt:Date.now(),link});
    });
    // Keep transport evidence when a public cold cohort differs from a local
    // build or a deployment hostname. Record only diagnostic response fields,
    // never request credentials or the complete response-header collection.
    // https://chromedevtools.github.io/devtools-protocol/tot/Network/#event-responseReceived
    cdp.on("Network.responseReceived", ({requestId,response}) => {
      const r=requests.get(requestId);if(!r)return;
      const headers=Object.fromEntries(Object.entries(response.headers).map(([k,v])=>[k.toLowerCase(),v]));
      r.response={status:response.status,mimeType:response.mimeType,protocol:response.protocol,
        remoteIPAddress:response.remoteIPAddress,cfRay:headers['cf-ray']??null,
        cfCacheStatus:headers['cf-cache-status']??null,cacheControl:headers['cache-control']??null,
        fromEarlyHints:response.fromEarlyHints??false,fromDiskCache:response.fromDiskCache??false,
        fromPrefetchCache:response.fromPrefetchCache??false};
    });
    cdp.on("Network.loadingFinished", (e) => {
      const r = requests.get(e.requestId);
      if (r) Object.assign(r, { end: e.timestamp, bytes: e.encodedDataLength });
    });
    await page.goto(target.href, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => globalThis.ASHEN?.playableReady ||
      (document.querySelector('#loading.failed') && document.querySelector('#loading-error pre')?.textContent),
      null, {timeout: 30000});
    await page.evaluate(() => {
      if (!globalThis.ASHEN?.playableReady)
        throw Error(document.querySelector('#loading-error pre')?.textContent || 'Startup failed before playable readiness');
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
    row.earlyHints=earlyHints.map(({requestId,receiptAt,link})=>({
      url:requests.get(requestId)?.url??null,receiptMs:receiptAt-row.origin,link,
    }));
    row.requests = [...requests.values()]
      .filter((r) => r.start <= boundary)
      .map((r) => ({
        requestId: r.requestId,
        url: r.url,
        initiator: r.initiator,
        initialPriority: r.initialPriority,
        priorityChanges: r.priorityChanges.filter(change=>change.at<=boundary).map(change=>({
          priority:change.priority,atMs:(change.at+clockOffset)*1000-row.origin,
        })),
        startMs: (r.start + clockOffset) * 1000 - row.origin,
        endMs: r.end===undefined?null:(r.end + clockOffset) * 1000 - row.origin,
        response: r.response,
        failure: r.failure,
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
      () => {
        const start = window.__loadInputStart;
        if (!start || Math.hypot(
          ASHEN.player.body.position.x - start.position.x,
          ASHEN.player.body.position.z - start.position.z,
        ) <= 0.03 || ASHEN.gpu.frames <= start.frame + 1) return false;
        // RAF polling gives an observation upper bound, not the exact instant
        // movement began. Keep it separate from the subsequent GPU fence.
        // https://playwright.dev/docs/api/class-page#page-wait-for-function
        window.__loadMotionAt = performance.now();
        return true;
      },
      null,
      { timeout: 2000 },
    );
    // Fence the frame that follows observed displacement, not just submission.
    await page.evaluate(async () => {
      await ASHEN.whenNextGpuFrame();
    });
    row.input = await page.evaluate(() => ({
      keyAt: window.__loadKeyAt,
      start: window.__loadInputStart,
      motionObservedAt: window.__loadMotionAt,
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
    row.input.motionUpperBoundMs = row.input.motionObservedAt - row.input.keyAt;
    row.input.completionAfterMotionMs = row.input.observedAt - row.input.motionObservedAt;
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
      assert(paths.includes(startingIdentityPack.compactItems.body.url),'The declared visible compact body must load before first play');
      if(expectDeferredHair)assert(!paths.includes(identityPack.compactItems.body.url),'Covered ponytail must not transfer before first play');
      assert(!paths.includes(identityPack.items.body.url),'Unused full motion library must not load before first play');
      const weights=[Math.max(0,-seed.shape.build),Math.max(0,seed.shape.build)];
      assert(row.nativeIdentity.find(m=>m.name==='HumanV1Body')?.weights,'Selected body must declare native morphs');
      for(const mesh of row.nativeIdentity.filter(m=>m.visible&&m.weights)){
        assert.equal(mesh.weights.length,2);
        mesh.weights.forEach((w,i)=>assert(Math.abs(w-weights[i])<1e-5,`${mesh.name} native morph ${i} differs at first play`));
      }
      row.selectedIdentity={id:identity.id,bodyUrl:startingIdentityPack.compactItems.body.url,bodySha256:startingIdentityPack.compactItems.body.sha256,
        deferredHair:expectDeferredHair,selectedBodyUrl:identityPack.compactItems.body.url};
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
    const state=await page?.evaluate(()=>({url:location.href,
      ashen:typeof globalThis.ASHEN,playable:globalThis.ASHEN?.playableReady??false,
      errorText:document.querySelector('#loading-error pre')?.textContent||document.querySelector('#error')?.textContent||''})).catch(e=>({unavailable:e.message}));
    if(rowRecorded)Object.assign(report.rows.at(-1),{validationFailure:failure,state,pageErrors});
    else report.rows.push({run,browserPid,failed:true,failure,state,pageErrors,requests:[...requests.values()],errors});
    await fs.writeFile(destination,JSON.stringify(report,null,2));
    console.log(JSON.stringify({run,failed:true,failure}));
    process.exitCode=1;
  } finally {
    // Snapshot before closing Chrome so teardown cancellations are not presented
    // as startup failures. Always retain evidence on success and exception paths.
    if(report.rows.length){
      report.rows.at(-1).networkDiagnostics={
        ...(networkProbe?.snapshot()??{transportFailures:[],browserLog:[],browserIssues:[]}),
        netLogPath, diagnosticOnly: netLog,
      };
    }
    // Close first even if writing the diagnostic report fails (disk, permissions,
    // bad output path). Failed evidence persistence must not orphan a renderer.
    try {
      await browser?.close();
      await fs.writeFile(destination+'.ownership.json',JSON.stringify({...ownership,owner:'probe-playable-startup',browserPid,url:target.href,active:false,renderingClients:0}));
    } finally {
      await fs.writeFile(destination,JSON.stringify(report,null,2));
    }
  }
}
if(budgetMs!==null){
  report.budget=startupBudget(report.rows,runs,budgetMs);
  await fs.writeFile(destination,JSON.stringify(report,null,2));
  console.log(JSON.stringify({startupBudget:report.budget}));
  if(!report.budget.passed)process.exitCode=1;
}
