import { chromium } from "playwright";
import { CDP_URL } from "../lib/cdp.mjs";
const b = await chromium.connectOverCDP(CDP_URL);
const p = b.contexts()[0].pages().find(x => x.url().includes("ashen-reach.html"));
await p.reload({ waitUntil: "load" });
await p.waitForFunction(() => globalThis.ASHEN?.ready === true, null, { timeout: 60000 });
console.log("reloaded, ASHEN.ready");
console.log(JSON.stringify(await p.evaluate(() => ASHEN.metrics.summary()), null, 1));
await b.close();
