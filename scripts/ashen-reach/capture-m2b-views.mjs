import {chromium} from 'playwright';
import { CDP_URL } from '../lib/cdp.mjs';
import fs from 'node:fs/promises';

// M2b "after" views: same camera placements as capture-m2-views.mjs, so before/after can be
// compared pixel-for-pixel at each named shot.
const outDir = 've-capture/ashen-reach/world-expansion-m2b/views';
await fs.mkdir(outDir, {recursive:true});

const browser = await chromium.connectOverCDP(CDP_URL);
const context = browser.contexts()[0];
let page = context.pages().find(p => p.url().includes('ashen-reach.html')) || await context.newPage();
await page.setViewportSize({width:960,height:540});
await page.bringToFront();
await page.goto(process.env.ASHEN_URL||'http://127.0.0.1:5173/ashen-reach.html?play&clean', {waitUntil:'commit'});
await page.waitForFunction(() => window.ASHEN?.ready, null, {timeout: 60000});
await page.waitForTimeout(1500);

const shots = [
 {name:'house-row', x:0, z:76, yaw:0, pitch:.10, desc:'the first two houses either side of the street, just past the town gate'},
 {name:'tavern-smithy', x:0, z:91, yaw:0, pitch:.10, desc:'the tavern (west) and smithy with forge glow (east)'},
 {name:'smithy-close', x:9, z:94, yaw:2.5, pitch:.12, desc:'close on the smithy door and forge glow'},
 {name:'chapel-house3', x:0, z:108, yaw:0, pitch:.10, desc:'house three (west) and the chapel with cross finial (east)'},
 {name:'watchtower-house4', x:0, z:121, yaw:0, pitch:.20, desc:'house four (west) and the watchtower with beacon (east)'},
 {name:'well-square', x:0, z:131, yaw:0, pitch:.10, desc:'entering the well square: well, stalls, lit windows around the plaza'},
 {name:'well-close', x:0, z:133, yaw:3.14159, pitch:.08, desc:'close on the well and its hanging lantern'},
 {name:'main-street', x:0, z:80, yaw:0, pitch:.02, desc:'looking straight up the main street through Hollowmere'},
 {name:'north-edge', x:0, z:141, yaw:3.14159, pitch:.12, desc:'at the north edge of the reachable terrain, looking back south over the town'},
];

const results = [];
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
 results.push(s);
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
results.push({name:'wide-town', desc:'pulled-back elevated overlook of Hollowmere'});

console.log(JSON.stringify(results, null, 2));
await fs.writeFile(`${outDir}/views.json`, JSON.stringify(results, null, 2));
await browser.close();
