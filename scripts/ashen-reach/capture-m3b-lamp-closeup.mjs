import {chromium} from 'playwright';
import { CDP_URL } from '../lib/cdp.mjs';
import fs from 'node:fs/promises';

const outDir = 've-capture/ashen-reach/world-expansion-m3b/lamp-closeup';
await fs.mkdir(outDir, {recursive:true});

const browser = await chromium.connectOverCDP(CDP_URL);
const context = browser.contexts()[0];
let page = context.pages().find(p => p.url().includes('ashen-reach.html')) || await context.newPage();
await page.setViewportSize({width:960,height:540});
await page.bringToFront();
await page.goto('http://127.0.0.1:5173/ashen-reach.html?play&clean&noEnemies', {waitUntil:'commit'});
await page.waitForFunction(() => window.ASHEN?.ready, null, {timeout: 60000});
await page.waitForTimeout(1200);

const shots = [
 {name:'street-lamp-z94', x: Math.sin(94*.14)*1.25+3.4, z:90, yaw:.5, pitch:.55, dist:7},
 {name:'street-lamp-z94-top', x: Math.sin(94*.14)*1.25+3.4, z:94, yaw:0, pitch:.9, dist:10},
 {name:'lych-gate-lamp', x: Math.sin(58*.14)*1.25+2.8, z:54, yaw:.5, pitch:.5, dist:6},
 {name:'well-topdown', x:0, z:136, yaw:.2, pitch:.85, dist:12},
];
for (const s of shots) {
 await page.evaluate(({x,z,yaw,pitch,dist}) => {
  const A = window.ASHEN;
  const y = A.world.groundHeight(x,z) + 1.7;
  A.player.setWorldPos(x, y, z);
  A.player.setFacing(yaw);
  A.rig.yaw = yaw;
  A.rig.pitch = pitch;
  A.rig.distance = A.rig.distanceTarget = dist;
  A.setView('play');
 }, s);
 await page.waitForTimeout(700);
 await page.screenshot({path: `${outDir}/${s.name}.png`});
}
console.log('done');
await browser.close();
