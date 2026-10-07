/** Native controls for startup failure evidence, not game/FPS acceptance.
 * Actual HTTP 200/body truncation, CORS and CSP failures exercise CDP reasons.
 * https://chromedevtools.github.io/devtools-protocol/tot/Network/#event-loadingFailed
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {installNetworkFailureProbe} from '../lib/probe-network-failures.mjs';
import {browserOwnership} from '../lib/browser-ownership.mjs';

const destination=path.resolve(process.argv[2]||'.cache/character-mmo/startup-network-diagnostics-2026-10-07/controls.json');
const relative=path.relative(path.resolve('.cache'),destination);
assert(relative&&!relative.startsWith('..')&&!path.isAbsolute(relative),'Reports and raw NetLog stay under .cache');
await fs.mkdir(path.dirname(destination),{recursive:true});
const netLogPath=destination+'.netlog.json';
const reservation=await fs.open(netLogPath,'wx');await reservation.close();
const report={purpose:'Native failure collector controls; no game/startup/FPS acceptance',cases:[],passed:false,netLogPath};
let browser,ownership,probe;
const server=http.createServer((req,res)=>{
  if(req.url.startsWith('/body-')){
    res.writeHead(200,{'Content-Type':'application/octet-stream','Content-Length':'128','X-Private-Fixture':'omitted-header-sentinel'});
    res.write('partial');setTimeout(()=>res.socket?.destroy(),80);return;
  }
  if(req.url==='/cors'){res.writeHead(200,{'Content-Type':'text/plain'});res.end('cross-origin');return;}
  res.writeHead(200,{'Content-Type':'text/html',...(req.url==='/csp'?{'Content-Security-Policy':"connect-src 'none'"}:{})});
  res.end('<!doctype html><title>Network diagnostic control</title>');
});
const crossOrigin=http.createServer((req,res)=>{res.writeHead(200,{'Content-Type':'text/plain'});res.end('no access-control header');});
try{
  await Promise.all([new Promise(resolve=>server.listen(0,'127.0.0.1',resolve)),new Promise(resolve=>crossOrigin.listen(0,'127.0.0.1',resolve))]);
  const url=`http://127.0.0.1:${server.address().port}`;
  const corsUrl=`http://127.0.0.1:${crossOrigin.address().port}/cors`;
  browser=await chromium.launch({channel:'chrome',headless:true,args:[`--log-net-log=${netLogPath}`]});
  ownership={...await browserOwnership(browser,{cdpPort:null,url,purpose:report.purpose,renderingClients:0}),cdpPort:null,controllerPid:process.pid,owner:'grok-startup-network-controls',active:true};
  report.ownership=ownership;report.servers=[server.address().port,crossOrigin.address().port];
  await fs.writeFile(destination+'.ownership.json',JSON.stringify(ownership,null,2));
  const context=await browser.newContext(),page=await context.newPage(),cdp=await context.newCDPSession(page),requests=new Map();
  probe=await installNetworkFailureProbe(cdp,requests);
  cdp.on('Network.requestWillBeSent',e=>requests.set(e.requestId,{url:e.request.url}));
  cdp.on('Network.responseReceived',e=>{
    const row=requests.get(e.requestId);if(row)row.response={status:e.response.status};
    if(e.response.url.endsWith('/body-orphan'))requests.delete(e.requestId);
  });
  await cdp.send('Network.enable');await page.goto(url);
  const consume=resource=>page.evaluate(async resource=>{
    let status=null;
    try{const response=await fetch(resource);status=response.status;await response.blob();return {status,failed:false};}
    catch(error){return {status,failed:true,name:error.name,message:error.message};}
  },resource);
  const good=await consume(url+'/good');assert.equal(good.failed,false);assert.equal(probe.snapshot().transportFailures.length,0);report.cases.push({name:'successful response',application:good,passed:true});
  const collect=async(name,resource,expected)=>{
    const before=probe.snapshot().transportFailures.length;
    const application=await consume(resource);assert(application.failed,name+' must fail natively');
    for(let tries=0;tries<100&&probe.snapshot().transportFailures.length===before;tries++)await page.waitForTimeout(20);
    const failures=probe.snapshot().transportFailures.slice(before);assert.equal(failures.length,1,name+' must retain exactly one native failure');
    const failure=failures[0];expected(application,failure);
    report.cases.push({name,application,failure,passed:true});
  };
  await collect('body fails after 200',url+'/body-known',(a,f)=>{assert.equal(a.status,200);assert.equal(f.responseStatus,200);assert(f.trackedRequest);assert.match(f.errorText,/ERR_/);});
  await collect('orphan request ID is retained',url+'/body-orphan',(a,f)=>{assert.equal(a.status,200);assert.equal(f.trackedRequest,false);assert.equal(f.url,null);assert(f.requestId);assert.match(f.errorText,/ERR_/);});
  await collect('native CORS reason',corsUrl,(a,f)=>{assert(f.corsErrorStatus?.corsError);assert(f.trackedRequest);});
  await page.goto(url+'/csp');
  const issuesBefore=probe.snapshot().browserIssues.length,blockedURL=url+'/blocked';
  const blocked=await consume(blockedURL);assert(blocked.failed);
  for(let tries=0;tries<100&&probe.snapshot().browserIssues.length===issuesBefore;tries++)await page.waitForTimeout(20);
  const issues=probe.snapshot().browserIssues.slice(issuesBefore);
  assert(issues.some(issue=>issue.blockedURL===blockedURL&&issue.violatedDirective.startsWith('connect-src')&&!issue.isReportOnly),'CSP requires a native enforced policy issue, not a promised transport event');
  report.cases.push({name:'native CSP reason before transport',application:blocked,issues,passed:true});
  report.networkDiagnostics=probe.snapshot();
  assert(report.networkDiagnostics.browserLog.some(e=>['network','security'].includes(e.source)),'Native browser reasons must be observed');
  assert(!JSON.stringify(report.networkDiagnostics).includes('omitted-header-sentinel'),'Private response headers must not be copied');
  report.passed=true;
}catch(error){report.failure=error.stack;process.exitCode=1;}
finally{
  // Retain every observed reason even when a later assertion fails; snapshot
  // before shutdown excludes cancellations caused by the check itself.
  if(probe)report.networkDiagnostics=probe.snapshot();
  await browser?.close();
  for(const owned of [server,crossOrigin]){owned.closeAllConnections();if(owned.listening)await new Promise(resolve=>owned.close(resolve));}
  if(ownership)await fs.writeFile(destination+'.ownership.json',JSON.stringify({...ownership,active:false,renderingClients:0},null,2));
  report.cleanedUp=true;
  if(report.passed){
    try{const log=JSON.parse(await fs.readFile(netLogPath,'utf8'));assert(log.events.length>0);report.netLogEvents=log.events.length;}
    catch(error){report.passed=false;report.failure=error.stack;process.exitCode=1;}
  }
  await fs.writeFile(destination,JSON.stringify(report,null,2)+'\n');
}
console.log(JSON.stringify({passed:report.passed,cases:report.cases.length,failure:report.failure,cleanedUp:report.cleanedUp}));
