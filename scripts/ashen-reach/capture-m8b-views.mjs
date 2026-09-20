import {chromium} from 'playwright';
import { CDP_URL } from '../lib/cdp.mjs';
import fs from 'node:fs/promises';

// M8b evidence. Tag via argv[2] ('before'|'after'|'control') selects the output directory only.
// Reuses M7a's five camera positions so pairs are pixel-comparable, plus facade-at-15m shots
// the profile numbers cannot speak to. Connects over CDP and does not close the browser --
// slot 2's Chrome was launched by the harness, not by this script.
const tag = process.argv[2] || 'after';
const outDir = `ve-capture/ashen-reach/world-expansion-m8b/${tag}`;
await fs.mkdir(outDir, {recursive:true});

const browser = await chromium.connectOverCDP(CDP_URL);
const context = browser.contexts()[0];
let page = context.pages().find(p => p.url().includes('ashen-reach.html')) || await context.newPage();
await page.setViewportSize({width:960,height:540});
await page.bringToFront();
await page.goto((process.env.ASHEN_URL||'http://127.0.0.1:5373/ashen-reach.html?play&clean')+'&noEnemies', {waitUntil:'commit'});
await page.waitForFunction(() => window.ASHEN?.ready, null, {timeout: 60000});
await page.waitForTimeout(1500);

async function shootAt({name,x,z,yaw,pitch,dist}) {
 await page.evaluate(({x,z,yaw,pitch,dist}) => {
  const A = window.ASHEN;
  const y = A.world.groundHeight(x,z) + 1.7;
  A.player.setWorldPos(x, y, z);
  A.player.setFacing(yaw);
  A.rig.yaw = yaw;
  A.rig.pitch = pitch;
  A.rig.distance = A.rig.distanceTarget = dist;
  A.setView('play');
 }, {x,z,yaw,pitch,dist});
 await page.waitForTimeout(700);
 await page.screenshot({path: `${outDir}/${name}.png`});
}

await shootAt({name:'wide-town', x:0, z:100, yaw:.35, pitch:.85, dist:24});
await shootAt({name:'street-level-wide', x:0, z:70, yaw:0, pitch:.10, dist:3.5});
await shootAt({name:'street-lamp-z94', x: Math.sin(94*.14)*1.25+3.4, z:90, yaw:.5, pitch:.55, dist:7});
await shootAt({name:'well-square', x:0, z:131, yaw:0, pitch:.10, dist:3.5});

// Building at ~15 m: west-side house on pad 0 (centre x=-9, z=82). Stand in the street 15 m
// east of that centre and look at the gable. Ordinary play pitch/distance.
await shootAt({name:'facade-15m-house', x:6, z:82, yaw:Math.PI/2, pitch:.08, dist:3.5});
// Tavern on pad 2 (centre x=-12, z=98), same treatment.
await shootAt({name:'facade-15m-tavern', x:3, z:98, yaw:Math.PI/2, pitch:.08, dist:3.5});
// Three-quarter from ~15 m along the street toward pad-0 (x=-9,z=82), so roof line and door share the frame.
await shootAt({name:'facade-15m-house-oblique', x:0, z:70, yaw:Math.atan2(-9,12), pitch:.12, dist:3.5});

await page.evaluate(() => { window.ASHEN.reset(); });
await page.waitForTimeout(500);
await page.evaluate(() => { window.ASHEN.setView('play'); });
await page.waitForTimeout(1200);
await page.screenshot({path: `${outDir}/churchyard-spawn.png`});

console.log('done:', tag, outDir);
// Drop the CDP socket without browser.close() -- this Chrome belongs to the harness.
process.exit(0);
