import {chromium} from 'playwright';
import { CDP_URL } from '../lib/cdp.mjs';
import fs from 'node:fs/promises';

// M3c defect 2 evidence: the town-gate vista judged at ORDINARY play framing (main.js's actual
// default rig.pitch=.04 / distance=3.5 -- not the .25-pitch/dist-6 framing M3b used to claim the
// vista "found"), plus two other sightlines proving the citadel did not become a sky-filling wall.
// Tag via argv[2] ('before'|'after') selects the output directory only.
const tag = process.argv[2] || 'after';
const outDir = `ve-capture/ashen-reach/world-expansion-m3c/defect2-${tag}`;
await fs.mkdir(outDir, {recursive:true});

const browser = await chromium.connectOverCDP(CDP_URL);
const context = browser.contexts()[0];
let page = context.pages().find(p => p.url().includes('ashen-reach.html')) || await context.newPage();
await page.setViewportSize({width:960,height:540});
await page.bringToFront();
await page.goto((process.env.ASHEN_URL||'http://127.0.0.1:5173/ashen-reach.html?play&clean')+'&noEnemies', {waitUntil:'commit'});
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

const shots = [
 // Ordinary play default (main.js: rig.pitch=.04, distance=3.5) standing just south of the town
 // gate (gate wall/lintel z~73-77), looking north through it up the road toward the citadel.
 {name:'town-gate-vista-ordinary', x:0, z:70, yaw:0, pitch:.04, dist:3.5},
 // A few metres further back, same ordinary pitch, so the gate opening is fully in frame.
 {name:'town-gate-vista-ordinary-back', x:0, z:64, yaw:0, pitch:.06, dist:3.5},
 // Standing right at the gate opening itself, ordinary pitch.
 {name:'town-gate-vista-at-gate', x:0, z:73, yaw:0, pitch:.05, dist:3.5},
 // Sanity checks the citadel did not become a sky-filling wall: the closest reachable approach
 // (north edge, z=141) and a mid-street framing.
 {name:'north-edge-sanity', x:-6, z:141, yaw:0, pitch:.10, dist:5},
 {name:'main-street-sanity', x:0, z:80, yaw:0, pitch:.02, dist:3.5},
];

for (const s of shots) await shootAt(s);

console.log('done:', tag);
await fs.writeFile(`${outDir}/shots.json`, JSON.stringify(shots, null, 2));
await browser.close();
