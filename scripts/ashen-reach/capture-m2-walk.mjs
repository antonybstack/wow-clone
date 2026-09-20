import {chromium} from 'playwright';
import fs from 'node:fs/promises';

// Walks the player north from spawn under normal WASD movement (no teleporting), through the
// lych-gate and the town gate, all the way into Hollowmere, proving the rectangular bounds clamp
// lets the whole road be walked live rather than clipping at the old radius-85 circle.
const outDir = 've-capture/ashen-reach/world-expansion-m2/walk';
await fs.mkdir(outDir, {recursive:true});

const browser = await chromium.connectOverCDP('http://127.0.0.1:9337');
const context = browser.contexts()[0];
let page = context.pages().find(p => p.url().includes('ashen-reach.html')) || await context.newPage();
await page.setViewportSize({width:960,height:540});
await page.bringToFront();
await page.goto('http://127.0.0.1:5173/ashen-reach.html?play&clean', {waitUntil:'commit'});
await page.waitForFunction(() => window.ASHEN?.ready, null, {timeout: 60000});
await page.waitForTimeout(1500);

await page.evaluate(() => {
 const A = window.ASHEN;
 A.reset();
 A.setView('play');
 A.player.setFacing(0);
 A.rig.yaw = 0;
 A.rig.pitch = .06;
});
await page.waitForTimeout(300);

const log = [];
await page.keyboard.down('KeyW');
for (let t = 2; t <= 30; t += 2) {
 await page.waitForTimeout(2000);
 const pos = await page.evaluate(() => {
  const p = window.ASHEN.player.body.position;
  return {x: +p.x.toFixed(2), y: +p.y.toFixed(2), z: +p.z.toFixed(2)};
 });
 log.push({t, ...pos});
 await page.screenshot({path: `${outDir}/t${String(t).padStart(2,'0')}-z${Math.round(pos.z)}.png`});
}
await page.keyboard.up('KeyW');
await page.waitForTimeout(300);
const finalPos = await page.evaluate(() => {
 const p = window.ASHEN.player.body.position;
 return {x: +p.x.toFixed(2), y: +p.y.toFixed(2), z: +p.z.toFixed(2)};
});

const result = {log, finalPos};
console.log(JSON.stringify(result, null, 2));
await fs.writeFile(`${outDir}/walk-log.json`, JSON.stringify(result, null, 2));
await browser.close();
