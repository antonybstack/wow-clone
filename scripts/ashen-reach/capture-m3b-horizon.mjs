import {chromium} from 'playwright';
import { CDP_URL } from '../lib/cdp.mjs';
import fs from 'node:fs/promises';

// Milestone 3 evidence: the vista from the town gate (the plan's stated M3 gate), the citadel
// from an overlook, and from the north edge of town. Revision 2: the first pass placed the
// camera literally inside the gate passage (z=75, under its lintel) and inside/against the
// watchtower building and well-square market stalls (pads[7]={x:13,z:128}, pads[8]={x:0,z:136},
// stalls at roughly z=134-139), so those shots showed only nearby wall/roof geometry, not the
// citadel. This pass moves every camera position clear of that geometry (checked against
// buildingPads in geometry.js and the townGate() footprint in scene.js) before capturing again.
const outDir = 've-capture/ashen-reach/world-expansion-m3b/horizon';
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
 // Standing south of the gate (gate wall/lintel is at z~74.3-75.7), looking north through the
 // open gateway, up the main street, toward the citadel.
 {name:'town-gate-vista', x:0, z:68, yaw:0, pitch:.14, dist:6, desc:'south of the town gate, looking north through it up the road toward the citadel'},
 {name:'town-gate-vista-tight', x:0, z:68, yaw:0, pitch:.06, dist:4, desc:'town gate, low eye-level pitch'},
 // Elevated pulled-back overlook well clear of any building footprint.
 {name:'citadel-overlook', x:0, z:110, yaw:.10, pitch:.28, dist:34, desc:'elevated pulled-back overlook: town in the midground, citadel and ridgeline on the horizon'},
 {name:'citadel-overlook-tight', x:0, z:128, yaw:0, pitch:.30, dist:24, desc:'closer elevated overlook from near the watchtower pad, pulled back and up clear of its roof'},
 // North edge of the reachable terrain, offset well west of the well-square stalls (x<0 pad
 // footprints stop at x=-13-11/2=-18.5) and elevated above stall-roof height.
 {name:'north-edge-citadel', x:-22, z:141, yaw:.44, pitch:.20, dist:8, desc:'at the north edge of the reachable terrain, west of the stalls, facing the citadel'},
 {name:'north-edge-citadel-wide', x:-22, z:139, yaw:.44, pitch:.30, dist:20, desc:'north edge, pulled back and up, clear of all stall/watchtower geometry'},
 // South of the watchtower pad (pads[7]={x:13,z:128,w:11,d:9} spans z 123.5-132.5), looking
 // north so the watchtower silhouette sits in the foreground with the citadel behind it.
 {name:'watchtower-citadel', x:13, z:116, yaw:0, pitch:.20, dist:9, desc:'south of the watchtower, looking north past it toward the citadel'},
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
await fs.writeFile(`${outDir}/shots.json`, JSON.stringify(shots, null, 2));
await browser.close();
