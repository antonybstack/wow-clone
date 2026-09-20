import { chromium } from "playwright";
import { CDP_URL } from "../lib/cdp.mjs";

const base =
  process.env.ASHEN_URL ||
  "http://127.0.0.1:5173/ashen-reach.html?play&clean";
const label = process.argv[2] || "after";
const url = label === "before" ? base.replace("play&clean", "play&clean&noEnemies") : base;

const browser = await chromium.connectOverCDP(CDP_URL);
const page = browser.contexts()[0].pages().find((p) =>
  p.url().includes("ashen-reach.html"),
);
try {
  await page.bringToFront();
  await page.goto(url, { waitUntil: "commit" });
  await page.waitForFunction(() => window.ASHEN?.ready, null, {
    timeout: 60000,
  });
  await page.waitForTimeout(1200);
  await page.evaluate(() => ASHEN.setView("play"));
  await page.keyboard.down("KeyW");
  await page.waitForTimeout(1500);
  await page.evaluate(() => ASHEN.metrics.reset?.());
  await page.waitForTimeout(6000);
  await page.keyboard.up("KeyW");
  const result = await page.evaluate((kind) => {
    const s = ASHEN.metrics.summary();
    return {
      label: kind,
      ...s,
      viewport: s.viewport || { w: innerWidth, h: innerHeight },
      dpr: s.dpr ?? devicePixelRatio,
      enemies: ASHEN.combat.enemies?.length ?? 0,
      enemyStates: (ASHEN.combat.enemies || []).map((e) => e.state),
    };
  }, label);
  result.uncappedLaunch = process.env.ASHEN_UNCAPPED === "1";
  result.cap = result.vsyncCapped
    ? `SITTING ON A ${result.capHz} Hz CAP. ${result.capReason}. Frame time is the compositor interval, not headroom.`
    : result.capReason || "cap detector not present";
  console.log(JSON.stringify(result, null, 2));
} finally {
  await page.keyboard.up("KeyW").catch(() => {});
  await browser.close();
}
