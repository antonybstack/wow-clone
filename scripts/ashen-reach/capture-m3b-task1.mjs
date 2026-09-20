import {chromium} from 'playwright';
import { CDP_URL } from '../lib/cdp.mjs';
import fs from 'node:fs/promises';

// Task 1 verification: same camera placements as the three M2b views the plan calls out as
// broken (wide-town, tavern-smithy, main-street), plus well-square where the defect was most
// visible (hard-edged polygon pools around the plaza). Captured after the groundGlow fix.
const outDir = 've-capture/ashen-reach/world-expansion-m3b/task1-after';
await fs.mkdir(outDir, {recursive:true});

const browser = await chromium.connectOverCDP(CDP_URL);
const context = browser.contexts()[0];
let page = context.pages().find(p => p.url().includes('ashen-reach.html')) || await context.newPage();
await page.setViewportSize({width:960,height:540});
await page.bringToFront();
await page.goto((process.env.ASHEN_URL||'http://127.0.0.1:5173/ashen-reach.html?play&clean')+'&noEnemies', {waitUntil:'commit'});
await page.waitForFunction(() => window.ASHEN?.ready, null, {timeout: 60000});
await page.waitForTimeout(1500);

const shots = [
 {name:'tavern-smithy', x:0, z:91, yaw:0, pitch:.10},
 {name:'main-street', x:0, z:80, yaw:0, pitch:.02},
 {name:'well-square', x:0, z:131, yaw:0, pitch:.10},
];

for (const s of shots) {
 await page.evaluate(({x,z,yaw,pitch}) => {
  const A = window.ASHEN;
  const y = A.world.groundHeight(x,z) + 1.7;
  A.player.setWorldPos(x, y, z);
  A.player.setFacing(yaw);
  A.rig.yaw = yaw;
  A.rig.pitch = pitch;
  A.rig.distance = A.rig.distanceTarget = 3.5;
  A.setView('play');
 }, s);
 await page.waitForTimeout(700);
 await page.screenshot({path: `${outDir}/${s.name}.png`});
}

await page.evaluate(() => {
 const A = window.ASHEN;
 const x=0, z=100;
 const y = A.world.groundHeight(x,z) + 1.7;
 A.player.setWorldPos(x, y, z);
 A.player.setFacing(0);
 A.rig.yaw = .35;
 A.rig.pitch = .85;
 A.rig.distance = A.rig.distanceTarget = 24;
 A.setView('play');
});
await page.waitForTimeout(900);
await page.screenshot({path: `${outDir}/wide-town.png`});

console.log('done');
await browser.close();
