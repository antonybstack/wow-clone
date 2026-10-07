/** Exercise the actual startup CLI's failure/finally paths with native HTTP/DOM.
 * These are diagnostic fixtures, not built-game or visual acceptance.
 * https://nodejs.org/api/child_process.html#child_processspawncommand-args-options
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';

const output=path.resolve(process.argv[2]||'.cache/character-mmo/startup-network-diagnostics-2026-10-07/failure-reports');
const relative=path.relative(path.resolve('.cache'),output);
assert(relative&&!relative.startsWith('..')&&!path.isAbsolute(relative),'Keep raw evidence under .cache');
await fs.mkdir(output); // Never overwrite a completed or failed run.
const report={controllerPid:process.pid,purpose:'Actual startup CLI failure evidence and cleanup; local fixtures only',cases:[],passed:false};
const server=http.createServer((req,res)=>{
  if(req.url.startsWith('/body')){
    res.writeHead(200,{'Content-Type':'application/octet-stream','Content-Length':'128'});
    res.write('partial');setTimeout(()=>res.socket?.destroy(),80);return;
  }
  const policy=req.url.startsWith('/policy');
  res.writeHead(200,{'Content-Type':'text/html',...(policy?{'Content-Security-Policy':"connect-src 'none'"}:{})});
  res.end(`<!doctype html><title>Expected startup failure control</title>
    <div id="loading"></div><div id="loading-error"><pre></pre></div>
    <script>fetch('/body').then(response=>response.blob()).catch(error=>{
      document.querySelector('#loading-error pre').textContent='Injected fixture: '+error.name+': '+error.message;
      document.querySelector('#loading').classList.add('failed');
    });</script>`);
});
try {
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  report.fixturePort=server.address().port;
  const inherited=Object.fromEntries(Object.entries(process.env).filter(([key])=>!key.startsWith('ASHEN_PROBE_')&&key!=='ASHEN_TEST_URL'));
  for(const id of ['truncated-body','policy','report-write-failure']){
    const file=path.join(output,id+'.json');
    if(id==='report-write-failure')await fs.mkdir(file); // Actual EISDIR, not a mock write rejection.
    const stdout=await fs.open(file+'.stdout','wx'),stderr=await fs.open(file+'.stderr','wx');
    let exit;
    try {
      const child=spawn(process.execPath,['scripts/ashen-reach/probe-playable-startup.mjs',file],{
        cwd:process.cwd(),env:{...inherited,ASHEN_TEST_URL:`http://127.0.0.1:${report.fixturePort}/${id==='policy'?'policy':'failure'}`,
          ASHEN_PROBE_RUNS:'1',ASHEN_PROBE_PROFILE:'native',ASHEN_PROBE_NETLOG:'1'},
        stdio:['ignore',stdout.fd,stderr.fd],
      });
      exit=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',(code,signal)=>resolve({code,signal,pid:child.pid}));});
    }finally{await stdout.close();await stderr.close();}
    const row={id,exit};report.cases.push(row);assert.equal(exit.code,1,'Injected invalid start must fail the actual CLI');
    row.ownership=JSON.parse(await fs.readFile(file+'.ownership.json','utf8'));
    assert.equal(row.ownership.active,false);assert.equal(row.ownership.renderingClients,0);
    let running=false;try{process.kill(row.ownership.browserPid,0);running=true;}catch(error){assert.equal(error.code,'ESRCH');}
    assert.equal(running,false,'Native Chrome must be gone before the CLI completes');
    const netLog=JSON.parse(await fs.readFile(file+'.run-1.netlog.json','utf8'));assert(netLog.events.length>0);row.netLogEvents=netLog.events.length;
    if(id==='report-write-failure'){
      assert.match(await fs.readFile(file+'.stderr','utf8'),/EISDIR/);row.actualReportWriteFailure=true;
    }else {
      const result=JSON.parse(await fs.readFile(file,'utf8'));assert.equal(result.rows.length,1);
      row.failure=result.rows[0];assert(row.failure.failed);assert.match(row.failure.state.errorText,/Injected fixture: TypeError: Failed to fetch/);
      const diagnostics=row.failure.networkDiagnostics;
      assert(diagnostics.diagnosticOnly);
      if(id==='truncated-body')assert(diagnostics.transportFailures.some(f=>f.responseStatus===200&&/ERR_CONTENT_LENGTH_MISMATCH/.test(f.errorText)));
      else assert(diagnostics.browserIssues.some(issue=>issue.code==='ContentSecurityPolicyIssue'&&!issue.isReportOnly&&issue.violatedDirective.startsWith('connect-src')));
    }
    row.passed=true;
    await fs.writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
  }
  report.passed=true;
}catch(error){report.failure=error.stack;process.exitCode=1;}
finally{
  server.closeAllConnections();if(server.listening)await new Promise(resolve=>server.close(resolve));
  report.fixtureClosed=true;await fs.writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
}
console.log(JSON.stringify({passed:report.passed,cases:report.cases.length,failure:report.failure,fixtureClosed:report.fixtureClosed}));
