import puppeteer from "puppeteer-core";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
const executablePath = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
].find(existsSync);
const browser = await puppeteer.launch({
  executablePath,
  headless: true,
  args: ["--no-sandbox", "--mute-audio"],
  defaultViewport: { width: 1440, height: 900 },
});
const page = await browser.newPage();
const results = [],
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const check = (name, ok, evidence) => {
  results.push({ name, ok, evidence });
  console.log(ok ? "PASS" : "FAIL", name, evidence ?? "");
};
const dir = "docs/screenshots/v2";
mkdirSync(dir, { recursive: true });
await page.goto(process.argv[2] ?? "http://127.0.0.1:5173/", {
  waitUntil: "networkidle2",
});
await page.waitForSelector('[data-action="new"]');
await page.click('[data-action="new"]');
await page.click('[data-action="next"]');
await page.click('[data-action="next"]');
await page.click('[data-action="commander"][data-key="titan"]');
await page.click('[data-action="next"]');
await page.click('[data-action="preset"][data-key="breach"]');
await page.click('[data-action="launch"]');
await page.click('[data-action="skip-intro"]');
await page.click('[data-action="pause"]');
const position = (x, y) =>
  page.evaluate((x, y) => window.__SIEGE__.worldToScreen(x, y), x, y);
const before = await page.evaluate(() => ({
  stock: window.__SIEGE__.battle.loadout.inventory.goblin,
  money: window.__SIEGE__.battle.money,
}));
await page.click('[data-action="deploy"][data-key="goblin"]');
const bad = await position(1600, 1000);
await page.mouse.click(bad.x, bad.y);
const after = await page.evaluate(() => ({
  stock: window.__SIEGE__.battle.loadout.inventory.goblin,
  money: window.__SIEGE__.battle.money,
}));
check(
  "illegal click consumes nothing",
  JSON.stringify(before) === JSON.stringify(after),
  after,
);
await page.keyboard.press("Escape");
await page.select("#deploy-batch", "3");
await page.click('[data-action="deploy"][data-key="goblin"]');
const good = await position(850, 1970);
await page.mouse.click(good.x, good.y);
check(
  "click deploy three batches from stock",
  await page.evaluate(
    (n) => window.__SIEGE__.battle.loadout.inventory.goblin === n - 60,
    before.stock,
  ),
);
const source = await page.$('[data-action="deploy"][data-key="slime"]');
const rect = await source.boundingBox();
await page.select("#deploy-batch", "1");
await page.setDragInterception(true);
const start = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
await page.mouse.dragAndDrop(start, good, { delay: 250 });
check(
  "native HTML5 drag deploy",
  await page.evaluate(
    () => window.__SIEGE__.battle.loadout.inventory.slime === 40,
  ),
  await page.evaluate(() => window.__SIEGE__.battle.snapshot()),
);
await page.mouse.dragAndDrop(start, bad, { delay: 200 });
check(
  "native illegal drag keeps inventory",
  await page.evaluate(
    () => window.__SIEGE__.battle.loadout.inventory.slime === 40,
  ),
);
await page.setDragInterception(false);
const frozen = await page.evaluate(() => window.__SIEGE__.battle.time);
await wait(600);
check(
  "pause freezes actual simulation",
  await page.evaluate((t) => window.__SIEGE__.battle.time === t, frozen),
);
await page.click('[data-action="pause"]');
await wait(2200);
await page.keyboard.press("a");
const move = await position(1000, 1920);
await page.mouse.click(move.x, move.y, { button: "right" });
check(
  "right click creates real movement orders",
  await page.evaluate(() =>
    window.__SIEGE__.battle.units.some(
      (u) => u.side === 0 && u.order?.type === "move",
    ),
  ),
);
await page.keyboard.down("Control");
await page.keyboard.press("1");
await page.keyboard.up("Control");
await page.keyboard.press("1");
check(
  "control group stored and recalled",
  await page.evaluate(
    () =>
      window.__SIEGE__.battle.groups[0].size > 0 &&
      window.__SIEGE__.battle.selected.size ===
        window.__SIEGE__.battle.groups[0].size,
  ),
);
await page.click('[data-action="charge"]');
await page.click('[data-action="all-deploy"]');
await page.mouse.click(good.x, good.y);
await page.screenshot({ path: `${dir}/08-native-deploy.png` });
check("no browser errors", errors.length === 0, errors);
writeFileSync(
  "docs/V2_INPUT_RESULTS.json",
  JSON.stringify({ date: new Date().toISOString(), results, errors }, null, 2),
);
await browser.close();
if (results.some((r) => !r.ok)) process.exitCode = 1;
