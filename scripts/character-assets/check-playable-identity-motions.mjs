/** Exercise retained directional/overlay clips in the real native actor.
 * Ordinary keyboard movement; public actor APIs for hit/melee diagnostics;
 * the existing ?animationLab route for enter/loop/exit (normal 2 is Lava Ball).
 * This is functional evidence, never an FPS or cold-start benchmark.
 * https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/docs/lite/architecture/07-animation.md
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from 'playwright';
import {browserOwnership} from '../lib/browser-ownership.mjs';
import {ASHEN_PLAYABLE_CLIP_NAMES, ASHEN_MELEE_CLIP} from '../../src/character/runtime/ashen-playable-motion.js';
import {defaultAppearance} from '../../src/character/appearance/store.js';
import {validateAppearance} from '../../src/character/appearance/contract.js';
import {HUMAN_IDENTITY_PRESETS} from '../../src/character/appearance/human-identity.js';

const port=process.env.ASHEN_CDP_PORT,url=process.env.ASHEN_TEST_URL;
assert(port&&url,'Require an audited owned browser and ordinary built URL');
const out=process.argv[2];assert(out);await fs.mkdir(out,{recursive:true});
const browser=await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
assert(browser.contexts().flatMap(c=>c.pages()).every(p=>p.url()==='about:blank'),'Another owned renderer is active');
const ownership=await browserOwnership(browser,{cdpPort:port,url,
    purpose:'Native compact identity directional/hit/melee/channel diagnostics; no timing acceptance',renderingClients:1});
await fs.writeFile(`${out}/ownership.json`,JSON.stringify(ownership,null,2));
const report={url,scope:ownership.purpose,rows:[],errors:[]};
const snapshot=page=>page.evaluate(()=>({groups:ASHEN.body.groupNames,
    playing:ASHEN.body.getPlaying(),actor:ASHEN.body.getState(),label:ASHEN.body.getClipLabel(),
    physics:ASHEN.player.getDebugState().usingPhysics,recoveries:ASHEN.player.getDebugState().recoveries,
    gpuErrors:ASHEN.gpu.errors.slice(),appearance:ASHEN.getAppearance()}));
const waitClip=(page,name)=>page.waitForFunction(n=>ASHEN.body.getPlaying().some(g=>g.name===n&&g.w>.02),name,{timeout:5000});
const ready=page=>page.waitForFunction(()=>globalThis.ASHEN?.ready,null,{timeout:90000});
try {
    for(const preset of HUMAN_IDENTITY_PRESETS.filter(p=>p.sourceLabel)) {
        const recipe=validateAppearance({...defaultAppearance(),components:preset.components});
        const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1});
        const page=await context.newPage(),checks=[];
        page.on('pageerror',e=>report.errors.push(e.message));
        page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
        try {
            await context.addInitScript(r=>localStorage.setItem('ashen.appearance.v2',JSON.stringify(r)),recipe);
            await page.goto(url);await ready(page);
            await page.evaluate(()=>{ASHEN.dev.god=true;ASHEN.setView('play');});
            assert.deepEqual((await snapshot(page)).groups.sort(),[...ASHEN_PLAYABLE_CLIP_NAMES].sort());
            for(const [key,clip]of [['KeyS','Jog_Bwd_Loop'],['KeyQ','Jog_Left_Loop'],['KeyE','Jog_Right_Loop']]) {
                await page.keyboard.down(key);
                try {await waitClip(page,clip);checks.push({operation:key,state:await snapshot(page)});}
                finally {await page.keyboard.up(key);}
                await waitClip(page,'Idle_Loop');
            }
            const turns=[];
            for(const key of ['KeyA','KeyD']) {
                await page.keyboard.down(key);
                try {
                    await page.waitForFunction(()=>ASHEN.body.getPlaying().some(g=>/^Turn90_[LR]$/.test(g.name)&&g.w>.02),null,{timeout:5000});
                    const state=await snapshot(page),turn=state.playing.find(g=>/^Turn90_[LR]$/.test(g.name));
                    turns.push(turn.name);checks.push({operation:key,state});
                }finally {await page.keyboard.up(key);}
                await page.waitForFunction(()=>!ASHEN.body.getPlaying().some(g=>/^Turn90_[LR]$/.test(g.name)),null,{timeout:5000});
            }
            assert.deepEqual(turns.sort(),['Turn90_L','Turn90_R']);
            assert(await page.evaluate(()=>ASHEN.body.playHit()));await waitClip(page,'Hit_Chest');
            checks.push({operation:'native actor playHit diagnostic',state:await snapshot(page)});
            await page.waitForFunction(()=>!ASHEN.body.getPlaying().some(g=>g.name==='Hit_Chest'),null,{timeout:5000});
            assert(await page.evaluate(()=>ASHEN.body.playMelee()));await waitClip(page,ASHEN_MELEE_CLIP);
            const melee=await snapshot(page);assert(melee.actor.melee);
            checks.push({operation:'native actor playMelee diagnostic',state:melee});
            await page.waitForFunction(()=>!ASHEN.body.getState().melee,null,{timeout:5000});
            await page.screenshot({path:`${out}/${preset.id}-ordinary.png`});

            // Explicit diagnostic mode: normal game 2 is an authored Lava Ball,
            // so holding it cannot prove the generic channel enter/loop/exit.
            const diagnostic=new URL(url);diagnostic.search='?play&clean&animationLab';
            await page.goto(diagnostic.href);await ready(page);
            await page.evaluate(()=>{ASHEN.dev.god=true;ASHEN.setView('play');});
            await page.keyboard.down('Digit2');
            try {
                await waitClip(page,'Spell_Simple_Enter');checks.push({operation:'animationLab channel enter',state:await snapshot(page)});
                await waitClip(page,'Spell_Simple_Idle_Loop');checks.push({operation:'animationLab channel loop',state:await snapshot(page)});
                await page.screenshot({path:`${out}/${preset.id}-channel-loop.png`});
            }finally {await page.keyboard.up('Digit2');}
            await waitClip(page,'Spell_Simple_Exit');checks.push({operation:'animationLab channel exit',state:await snapshot(page)});
            await page.waitForFunction(()=>!ASHEN.body.getState().channelPhase,null,{timeout:5000});
            assert(checks.every(c=>c.state.physics&&c.state.recoveries===0&&c.state.gpuErrors.length===0));
            assert(checks.every(c=>c.state.groups.length===ASHEN_PLAYABLE_CLIP_NAMES.length));
            assert.deepEqual((await snapshot(page)).appearance,recipe);
            report.rows.push({preset:preset.id,checks,final:await snapshot(page)});
            console.log(JSON.stringify({preset:preset.id,checks:checks.length,passed:true}));
        }finally {await context.close();await fs.writeFile(`${out}/report.json`,JSON.stringify(report,null,2));}
    }
    assert.deepEqual(report.errors,[]);report.passed=true;
}finally {
    await browser.close();await fs.writeFile(`${out}/report.json`,JSON.stringify(report,null,2));
    await fs.writeFile(`${out}/ownership.json`,JSON.stringify({...ownership,active:false,renderingClients:0},null,2));
}
