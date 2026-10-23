import puppeteer from "puppeteer-core";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
const executablePath =
  process.env.CHROME_PATH ||
  [
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  ].find(existsSync);
if (!executablePath) throw new Error("Chrome/Edge not found");
const browser = await puppeteer.launch({
  executablePath,
  headless: true,
  args: ["--no-sandbox", "--disable-background-timer-throttling", "--mute-audio"],
  defaultViewport: { width: 1440, height: 900 },
});
const page = await browser.newPage(),
  errors = [],
  results = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("response", (r) => {
  if (r.status() >= 400) errors.push(`HTTP ${r.status()} ${r.url()}`);
});
const dir = "docs/screenshots/v2";
mkdirSync(dir, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const check = (name, ok, evidence) => {
  results.push({ name, ok, evidence });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}`, evidence ?? "");
};
await page.goto(process.argv[2] ?? "http://127.0.0.1:5173/", {
  waitUntil: "networkidle2",
});
await page.waitForSelector('[data-action="new"]');
await page.screenshot({ path: `${dir}/01-menu.png` });
check("main menu", (await page.title()) === "异界围城：魔物之王 · Monster Sovereign");
await page.click('[data-action="help"]');
check("field manual opens", !!(await page.$(".manual")));
await page.click('[data-action="close-help"]');
await page.click('[data-action="new"]');
await page.click('[data-action="next"]');
await page.click('[data-action="next"]');
await page.click('[data-action="commander"][data-key="titan"]');
await page.click('[data-action="commander"][data-key="dragon"]');
await page.screenshot({ path: `${dir}/02-commanders.png` });
await page.click('[data-action="next"]');
await page.click('[data-action="preset"][data-key="breach"]');
await page.screenshot({ path: `${dir}/03-army.png` });
await page.click('[data-action="launch"]');
await wait(400);
await page.click('[data-action="skip-intro"]');
await wait(1000);
await page.screenshot({ path: `${dir}/04-city.png` });
await page.click('[data-action="overview"]');
await page.screenshot({ path: `${dir}/16-city-panorama.png` });
check("battle starts", await page.evaluate(() => window.__SIEGE__.battle.status === "battle"));
const point = await page.evaluate(() => window.__SIEGE__.worldToScreen(850, 1970));
await page.click('[data-action="all-deploy"]');
await page.mouse.click(point.x, point.y);
await wait(9000);
await page.screenshot({ path: `${dir}/05-legion.png` });
check(
  "legion deployed",
  await page.evaluate(() => window.__SIEGE__.battle.stats.deployed > 100),
  await page.evaluate(() => window.__SIEGE__.battle.snapshot()),
);
await page.click('[data-action="front"]');
await wait(250);
await page.screenshot({ path: `${dir}/06-front.png` });
await page.setViewport({ width: 1280, height: 720 });
await wait(400);
await page.screenshot({ path: `${dir}/07-1280.png` });
check(
  "720p HUD visible",
  await page.evaluate(() => {
    const r = document.querySelector(".battle-dock").getBoundingClientRect();
    return (
      r.bottom <= innerHeight &&
      document.querySelector(".battle-view").getBoundingClientRect().height > 350
    );
  }),
);
check("no uncaught browser exceptions", errors.length === 0, errors);
writeFileSync(
  "docs/V2_BROWSER_RESULTS.json",
  JSON.stringify({ date: new Date().toISOString(), results, errors }, null, 2),
);
await browser.close();
if (results.some((r) => !r.ok)) process.exitCode = 1;
