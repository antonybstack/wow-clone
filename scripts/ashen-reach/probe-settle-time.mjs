/** Reload, equip Warden, let the carry settle, measure real masked hand
 * geometry. Diagnostic only. */
import {chromium} from 'playwright';
const browser = await chromium.connectOverCDP('http://127.0.0.1:9337');
const page = browser.contexts()[0].pages().find(p => p.url().includes('ashen-reach.html'));
await page.bringToFront();
await page.goto((process.env.ASHEN_URL||'http://127.0.0.1:5173/ashen-reach.html?play&clean'), {waitUntil:'commit', timeout:60000});
await page.waitForFunction(() => globalThis.ASHEN?.ready, null, {timeout:60000});
await page.waitForTimeout(600);
await page.evaluate(async()=>{await ASHEN.equipment.equipPreset('warden');});
await page.waitForTimeout(1400);
const data = await page.evaluate(() => {
  const s = ASHEN.combat.fx.sockets, bw = ASHEN.player.body.worldMatrix;
  const xf = (m,x,y,z)=>[m[0]*x+m[4]*y+m[8]*z+m[12], m[1]*x+m[5]*y+m[9]*z+m[13], m[2]*x+m[6]*y+m[10]*z+m[14]];
  const hw = n => { const bone = ASHEN.body.skeleton.bones.find(x=>x.name===n); const c = s.toCapsule(bone); return xf(bw, c.x, c.y, c.z); };
  const twoHand = ASHEN.body.animationGroups.find(g=>g.name==='Walk_Carry_Loop');
  return { left: hw('mixamorig:LeftHand'), right: hw('mixamorig:RightHand'), t: twoHand?.currentTime, w: twoHand?.weight };
});
const L=data.left, R=data.right;
const dx=L[0]-R[0], dy=L[1]-R[1], dz=L[2]-R[2];
const horiz=Math.hypot(dx,dz);
const ang=Math.atan2(Math.abs(dy),horiz)*180/Math.PI;
console.log(JSON.stringify({...data, dy:+dy.toFixed(4), horiz:+horiz.toFixed(4), angDeg:+ang.toFixed(2)}, null, 2));
await browser.close();
