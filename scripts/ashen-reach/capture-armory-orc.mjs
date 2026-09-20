import {chromium} from 'playwright';
import { CDP_URL } from '../lib/cdp.mjs';
import fs from 'node:fs/promises';
const dir='ve-capture/ashen-reach/armory-orc';await fs.mkdir(dir,{recursive:true});
const browser=await chromium.connectOverCDP(CDP_URL);
const context=browser.contexts()[0];
const page=context.pages().find(p=>p.url().includes('ashen-reach.html'))||await context.newPage();
const errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.bringToFront();await page.goto(process.env.ASHEN_URL||'http://127.0.0.1:5173/ashen-reach.html?play&clean',{waitUntil:'commit'});await page.waitForFunction(()=>globalThis.ASHEN?.ready,null,{timeout:60000});
 await page.locator('#armory-launch').click();await page.waitForTimeout(300);
 await page.locator('[data-light]').check();
 await page.locator('[data-race]').selectOption('orc');await page.waitForTimeout(1100);
 const shots=[['front','idle','0'],['side','idle','0'],['front','carry','0.45'],['side','carry','0.45'],['front','lava','1.5'],['side','fire','0.28']];
 for(const [view,motion,time] of shots){
  await page.locator(`[data-view="${view}"]`).click();
  await page.locator('[data-motion]').selectOption(motion);
  await page.locator('[data-time-slider]').fill(time);
  await page.waitForTimeout(350);
  await page.screenshot({path:`${dir}/${view}-${motion}.png`});
 }
 console.log('captured',shots.length,'| errors:',errors.length);
}finally{await browser.close();}
