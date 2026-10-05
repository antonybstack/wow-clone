/** Real Lite viewport, resize, native orbit/pinch and modal lifetime checks.
 * Record portrait at its actual ratio; this is never a throughput benchmark.
 * https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/docs/lite/architecture/02-camera.md
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from 'playwright';
import sharp from 'sharp';
import {createArcRotateCamera,getViewMatrix,getViewProjectionMatrix,getEffectiveAspectRatio,resolveCameraViewport,projectWorldToScreenToRef} from '@babylonjs/lite';
import {browserOwnership} from '../lib/browser-ownership.mjs';
import {captureSurface,appendFrame,writeCaptureManifest} from '../lib/capture-manifest.mjs';

const out=process.argv[2],port=process.env.ASHEN_CDP_PORT,url=process.env.ASHEN_TEST_URL;
assert(out&&port&&url,'Require output directory, owned CDP port and ordinary URL');
await fs.mkdir(out,{recursive:true});
const browser=await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
assert(browser.contexts().flatMap(c=>c.pages()).every(p=>p.url()==='about:blank'),'Another owned game page is active');
const ownership=await browserOwnership(browser,{cdpPort:port,url,purpose:'Armory preview layout, controls and motion; timing contaminated by user WoW',renderingClients:1});
await fs.writeFile(`${out}/ownership.json`,JSON.stringify(ownership,null,2));
const recipe=JSON.parse(await fs.readFile(process.env.ASHEN_PROBE_APPEARANCE,'utf8'));
const report={url,scope:ownership.purpose,rows:[],errors:[]};
let context;
async function layout(page,label){
    await page.waitForTimeout(180);
    const state=await page.evaluate(()=>{
        const a=ASHEN,canvas=a.engine.canvas,r=document.querySelector('.armory-stage').getBoundingClientRect();
        const camera=a.armory.camera;
        return {stage:{x:r.x,y:r.y,width:r.width,height:r.height},viewport:{...a.armory.camera.viewport},
            pose:{alpha:camera.alpha,beta:camera.beta,radius:camera.radius,target:{x:camera.target.x,y:camera.target.y,z:camera.target.z},fov:camera.fov,near:camera.nearPlane,far:camera.farPlane},
            canvas:[canvas.width,canvas.height],window:[innerWidth,innerHeight],
            presenceHidden:getComputedStyle(document.querySelector('#presence-entry')).display==='none',
            horizontalOverflow:document.querySelector('#armory').scrollWidth>innerWidth,
            race:a.equipment.race,height:a.player.heightScale,cameraRadius:a.armory.camera.radius,
            physics:a.player.getDebugState().usingPhysics,recoveries:a.player.getDebugState().recoveries,gpu:a.gpu.errors.slice(),
            grounding:{ambient:a.grounding.state.ambient,compatible:a.grounding.state.contactViewportCompatible,contactEnabled:a.grounding.contactTask.enabled}};
    });
    const {stage:r,viewport:v,window:[w,h]}=state;
    // Cross-check the captured pose with the installed native matrix API in Node.
    // No second engine/module registry is imported into the running game. This
    // works for the sealed bundle as well as Vite; actual pixels are checked below.
    const p=state.pose,camera=createArcRotateCamera(p.alpha,p.beta,p.radius,p.target);
    camera.viewport=v;camera.fov=p.fov;camera.nearPlane=p.near;camera.farPlane=p.far;
    const [bw,bh]=state.canvas,projected={};
    projectWorldToScreenToRef(p.target,getViewMatrix(camera),getViewProjectionMatrix(camera,getEffectiveAspectRatio(camera,bw,bh)),
        {viewport:resolveCameraViewport(camera,bw,bh),backingWidth:bw,backingHeight:bh,cssWidth:w,cssHeight:h},projected);
    state.projected=projected;
    assert(r.width>=150&&r.height>=100,`${label}: preview is unusably small`);
    assert(Math.abs(v.x-r.x/w)<.001&&Math.abs(v.y-(1-(r.y+r.height)/h))<.001);
    assert(Math.abs(v.width-r.width/w)<.001&&Math.abs(v.height-r.height/h)<.001);
    assert(Math.abs(state.projected.cssX-(r.x+r.width/2))<3,`${label}: camera center misses preview`);
    assert(Math.abs(state.projected.cssY-(r.y+r.height/2))<3);
    assert(state.presenceHidden&&!state.horizontalOverflow&&state.physics&&state.recoveries===0);
    assert(state.grounding.ambient&&!state.grounding.compatible&&!state.grounding.contactEnabled,'Sub-viewport must use correct AO without native full-texture contacts');
    assert.deepEqual(state.gpu,[]);
    const png=await page.screenshot({path:`${out}/${label}.png`,scale:'css'});
    const crop={left:Math.ceil(r.x+2),top:Math.ceil(r.y+2),width:Math.floor(r.width-4),height:Math.floor(r.height-4)};
    const stats=await sharp(png).extract(crop).stats();
    assert(stats.entropy>2,`${label}: preview is covered or blank (entropy ${stats.entropy})`);
    return {...state,previewEntropy:stats.entropy};
}
try{
    context=await browser.newContext({viewport:{width:430,height:734},deviceScaleFactor:3,isMobile:true,hasTouch:true});
    await context.addInitScript(r=>localStorage.setItem('ashen.appearance.v2',JSON.stringify(r)),recipe);
    const page=await context.newPage();
    page.on('pageerror',e=>report.errors.push(e.message));
    page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
    await page.goto(url);await page.waitForFunction(()=>globalThis.ASHEN?.ready&&ASHEN.hostilesReady,null,{timeout:120000});
    await page.locator('#armory-launch').tap();
    report.rows.push({label:'portrait-full',state:await layout(page,'portrait-full')});
    let cdp,manifest,recording=false;const writes=[];
    try{
        if(process.argv.includes('--record')){
            await fs.mkdir(`${out}/frames`,{recursive:true});
            manifest={version:1,...await captureSurface(page),frames:[],purpose:'Portrait Armory native preview, identity, shape, motion and touch controls'};
            cdp=await context.newCDPSession(page);
            cdp.on('Page.screencastFrame',e=>{
                cdp.send('Page.screencastFrameAck',{sessionId:e.sessionId}).catch(()=>{});
                const name=`frame-${String(manifest.frames.length).padStart(5,'0')}.jpg`,bytes=Buffer.from(e.data,'base64');
                appendFrame(manifest,{name,timestamp:e.metadata.timestamp,bytes});writes.push(fs.writeFile(`${out}/frames/${name}`,bytes));
            });
            await cdp.send('Page.startScreencast',{format:'jpeg',quality:90,maxWidth:430,maxHeight:734,everyNthFrame:1});recording=true;
        }
        await page.getByRole('button',{name:'Face',exact:true}).tap();
        report.rows.push({label:'portrait-face',state:await layout(page,'portrait-face')});
        await page.getByLabel('Face and hair',{exact:true}).selectOption('weathered-bald');
        await page.waitForFunction(()=>ASHEN.creator.identity.selected==='weathered-bald');await page.evaluate(()=>ASHEN.creator.settled());
        report.rows.push({label:'portrait-weathered',state:await layout(page,'portrait-weathered')});
        await page.getByRole('button',{name:'Undo identity',exact:true}).tap();await page.evaluate(()=>ASHEN.creator.settled());
        assert.deepEqual(await page.evaluate(()=>ASHEN.getAppearance()),recipe);
        const height=page.getByRole('slider',{name:'Height',exact:true});await height.scrollIntoViewIfNeeded();await height.press('Home');
        await page.evaluate(()=>ASHEN.creator.settled());
        await page.getByRole('button',{name:'Full body',exact:true}).tap();
        const short=await layout(page,'portrait-short');assert.equal(short.height,.9);assert(Math.abs(short.cameraRadius-4.8*.9)<.01);
        report.rows.push({label:'portrait-short',state:short});
        await height.press('End');await page.evaluate(()=>ASHEN.creator.settled());
        const tall=await layout(page,'portrait-tall');assert.equal(tall.height,1.15);assert(Math.abs(tall.cameraRadius-4.8*1.15)<.01);
        report.rows.push({label:'portrait-tall',state:tall});
        const stage=await page.locator('.armory-stage').boundingBox(),touch=await context.newCDPSession(page);
        const alpha=await page.evaluate(()=>ASHEN.armory.camera.alpha),x=stage.x+stage.width*.4,y=stage.y+stage.height*.5;
        const dispatch=(type,points=[])=>touch.send('Input.dispatchTouchEvent',{type,touchPoints:points.map(p=>({radiusX:4,radiusY:4,force:1,...p}))});
        await dispatch('touchStart',[{id:1,x,y}]);await dispatch('touchMove',[{id:1,x:x+70,y}]);await dispatch('touchEnd');await page.waitForTimeout(350);
        assert(Math.abs(await page.evaluate(()=>ASHEN.armory.camera.alpha)-alpha)>.05,'Native touch orbit must turn camera');
        const radius=await page.evaluate(()=>ASHEN.armory.camera.radius);
        await dispatch('touchStart',[{id:2,x:x-40,y},{id:3,x:x+40,y}]);
        await dispatch('touchMove',[{id:2,x:x-70,y},{id:3,x:x+70,y}]);await dispatch('touchEnd');await page.waitForTimeout(250);
        assert(await page.evaluate(()=>ASHEN.armory.camera.radius)<radius-.2,'Native pinch must zoom');
        report.rows.push({label:'portrait-native-touch',state:await layout(page,'portrait-native-touch')});await touch.detach();
        await page.getByRole('button',{name:'Full body',exact:true}).tap();
        for(const motion of ['walk','run','fire','lava','pulse']){
            await page.locator('[data-motion]').selectOption(motion);await page.waitForTimeout(motion==='lava'||motion==='pulse'?1600:800);
        }
        await page.locator('#armory [data-race]').selectOption('orc');await page.waitForFunction(()=>ASHEN.equipment.race==='orc');
        report.rows.push({label:'portrait-orc',state:await layout(page,'portrait-orc')});
        await page.locator('#armory [data-race]').selectOption('undead');await page.waitForFunction(()=>ASHEN.equipment.race==='undead');
        report.rows.push({label:'portrait-undead',state:await layout(page,'portrait-undead')});
        await page.locator('#armory [data-race]').selectOption('human');await page.waitForFunction(()=>ASHEN.equipment.race==='human');
        await page.locator('[data-close]').first().tap();assert(!await page.evaluate(()=>ASHEN.armory.isOpen));
        await page.locator('#armory-launch').tap();await page.getByRole('button',{name:'Face',exact:true}).tap();
        report.rows.push({label:'portrait-reopened',state:await layout(page,'portrait-reopened')});
    }finally{
        if(recording){await cdp.send('Page.stopScreencast');await Promise.all(writes);await writeCaptureManifest(out,manifest,await captureSurface(page));await cdp.detach();}
    }
    // Resize a live modal to catch stale viewport bounds without reloading the actor.
    for(const [width,height]of [[390,844],[320,568],[844,390],[768,1024],[1280,720],[430,734]]){
        await page.setViewportSize({width,height});await page.getByRole('button',{name:'Full body',exact:true}).tap();
        report.rows.push({label:`resize-${width}x${height}`,state:await layout(page,`resize-${width}x${height}`)});
    }
    await page.locator('[data-close]').first().tap();
    assert(await page.locator('#presence-entry').isVisible(),'Shared-region entry must return after closing');
    await page.keyboard.down('KeyW');await page.waitForTimeout(400);await page.keyboard.up('KeyW');
    assert(!await page.evaluate(()=>ASHEN.scene.camera.viewport),'Play camera must remain full surface');
    assert(await page.evaluate(()=>ASHEN.grounding.state.contactViewportCompatible&&ASHEN.grounding.contactTask.enabled),'Native contacts must resume in gameplay');
    // Closing detaches the native per-frame input hook; repeated opening must
    // never accumulate another renderer/control loop. Disposal removes modal DOM.
    const hooks=await page.evaluate(()=>ASHEN.scene._beforeRender.length);
    for(let i=0;i<3;i++){
        await page.locator('#armory-launch').tap();
        assert.equal(await page.evaluate(()=>ASHEN.scene._beforeRender.length),hooks+1);
        await page.locator('[data-close]').first().tap();
        assert.equal(await page.evaluate(()=>ASHEN.scene._beforeRender.length),hooks);
    }
    await page.locator('#armory-launch').tap();await page.evaluate(()=>ASHEN.dispose());
    assert.equal(await page.locator('#armory,#armory-launch').count(),0);
    assert(!await page.evaluate(()=>document.body.classList.contains('armory-open')));
    report.lifecycle={reopenCycles:3,controlHooksAfterClose:hooks,disposedWhileOpen:true};
    assert.deepEqual(report.errors,[]);report.passed=true;
}catch(error){report.failure=error.stack;throw error;}
finally{
    await context?.close();await browser.close();
    await fs.writeFile(`${out}/report.json`,JSON.stringify(report,null,2));
    await fs.writeFile(`${out}/ownership.json`,JSON.stringify({...ownership,active:false,renderingClients:0},null,2));
    console.log(JSON.stringify({passed:report.passed,rows:report.rows.length,failure:report.failure,errors:report.errors}));
}
