import {chromium} from 'playwright';
import fs from 'node:fs/promises';

const outDir = 've-capture/ashen-reach/world-expansion-m1';
await fs.mkdir(outDir, {recursive:true});

const browser = await chromium.connectOverCDP('http://127.0.0.1:9337');
const context = browser.contexts()[0];
let page = context.pages().find(p => p.url().includes('ashen-reach.html')) || await context.newPage();
await page.setViewportSize({width:960,height:540});
await page.bringToFront();
await page.goto('http://127.0.0.1:5173/ashen-reach.html?play&clean', {waitUntil:'commit'});
await page.waitForFunction(() => window.ASHEN?.ready, null, {timeout: 60000});
await page.waitForTimeout(1500);

// Diagnostic camera placements along the new road (direct state set, labelled as such).
const shots = [
 {name:'lych-gate', x:0.0, z:38, yaw:0, pitch:0.05, desc:'looking north at the lych-gate from inside the churchyard'},
 {name:'climb-road', x:0.5, z:56, yaw:0, pitch:0.03, desc:'on the climbing road between the lych-gate and the town wall'},
 {name:'town-gatehouse', x:-1.0, z:68, yaw:0, pitch:0.02, desc:'approaching the gatehouse and outer wall'},
 {name:'through-gate', x:-1.0, z:90, yaw:3.14159, pitch:0.05, desc:'inside the wall, looking back through the gate'},
 {name:'hollowmere-overview', x:0, z:120, yaw:0.5, pitch:0.10, desc:'north end of the new road, overlooking the flattened pads'},
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
  A.setView('play');
 }, s);
 await page.waitForTimeout(700);
 await page.screenshot({path: `${outDir}/${s.name}.png`});
 results.push(s);
}
console.log(JSON.stringify(results, null, 2));
await browser.close();
