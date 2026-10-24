import puppeteer from "puppeteer-core";
import { writeFileSync, mkdirSync } from "node:fs";
const browser = await puppeteer.launch({
    executablePath:
      process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true,
    args: ["--no-sandbox", "--mute-audio"],
    defaultViewport: { width: 1600, height: 1000 },
  }),
  page = await browser.newPage(),
  results = [],
  errors = [];
const wait = (ms) => new Promise((r) => setTimeout(r, ms)),
  check = (name, ok, evidence) => {
    results.push({ name, ok, evidence });
    console.log(ok ? "PASS" : "FAIL", name, JSON.stringify(evidence ?? ""));
  };
page.on("pageerror", (e) => errors.push(e.message));
const point = (x, y) => page.evaluate((x, y) => window.__SIEGE__.worldToScreen(x, y), x, y);
try {
  await page.goto(process.argv[2] ?? "http://127.0.0.1:5186/", { waitUntil: "networkidle0" });
  await page.waitForSelector('[data-action="new"]');
  await page.click('[data-action="new"]');
  await page.click('[data-action="next"]');
  await page.click('[data-action="next"]');
  await page.click('[data-action="commander"][data-key="titan"]');
  await page.click('[data-action="next"]');
  await page.click('[data-action="preset"][data-key="breach"]');
  await page.click('[data-action="launch"]');
  await page.click('[data-action="skip-intro"]');
  await page.click('[data-action="overview"]');
  await page.click('[data-action="all-deploy"]');
  let p = await point(1050, 3410);
  await page.mouse.click(p.x, p.y);
  await wait(2100);
  const before = await page.evaluate(() =>
    window.__SIEGE__.battle.units
      .filter((u) => u.side === 0 && u.hp > 0)
      .map((u) => ({ id: u.id, x: u.x, y: u.y })),
  );
  await wait(600);
  check(
    "deployed troops wait in place",
    await page.evaluate(
      (a) =>
        a.every((p) => {
          const u = window.__SIEGE__.battle.byId.get(p.id);
          return u.x === p.x && u.y === p.y && u.order.type === "hold";
        }),
      before,
    ),
  );
  await page.click('[data-action="army-mode"][data-key="field"]');
  await page.click('[data-action="deploy"][data-key="goblin"]');
  check(
    "field card selects living troops instead of spending stock",
    await page.evaluate(() => {
      const b = window.__SIEGE__.battle;
      return (
        b.selected.size ===
          b.units.filter((u) => u.kind === "goblin" && u.side === 0 && u.hp > 0).length &&
        b.selected.size > 0
      );
    }),
  );
  const waypoints = [
    [1050, 3390],
    [1050, 3200],
    [1300, 3200],
  ];
  p = await point(...waypoints[0]);
  await page.mouse.move(p.x, p.y);
  await page.mouse.down({ button: "right" });
  for (const w of waypoints.slice(1)) {
    p = await point(...w);
    await page.mouse.move(p.x, p.y, { steps: 8 });
  }
  await page.screenshot({ path: "docs/screenshots/v3.1/01-route-preview.png" });
  await page.mouse.up({ button: "right" });
  check(
    "right drag creates route bends",
    await page.evaluate(() =>
      window.__SIEGE__.battle
        .members(window.__SIEGE__.battle.selected)
        .every((u) => u.route?.points.length >= 3),
    ),
  );
  await page.keyboard.down("Shift");
  p = await point(1400, 3200);
  await page.mouse.click(p.x, p.y, { button: "right" });
  await page.keyboard.up("Shift");
  check(
    "Shift right click appends waypoint",
    await page.evaluate(() =>
      window.__SIEGE__.battle
        .members(window.__SIEGE__.battle.selected)
        .every(
          (u) =>
            u.route?.points.length >= 2 &&
            Math.hypot(u.route.points.at(-1).x - 1400, u.route.points.at(-1).y - 3200) < 2,
        ),
    ),
  );
  await page.select("#target-priority", "ranged");
  check(
    "priority dropdown updates selected troops",
    await page.evaluate(() =>
      window.__SIEGE__.battle
        .members(window.__SIEGE__.battle.selected)
        .every((u) => u.priority === "ranged"),
    ),
  );
  await page.mouse.click((await point(1550, 3410)).x, (await point(1550, 3410)).y);
  await page.keyboard.press("a");
  await page.keyboard.press("s");
  check(
    "stop key cancels all current routes",
    await page.evaluate(() =>
      window.__SIEGE__.battle
        .members(window.__SIEGE__.battle.selected)
        .every((u) => u.order.type === "hold" && !u.route),
    ),
  );
  await page.click('[data-action="guardian"]');
  await page.screenshot({ path: "docs/screenshots/v3.1/02-core-guardian.png" });
  check(
    "guardian HUD and core elites exist",
    await page.$eval("#guardian-status", (e) => e.textContent.includes("日轮守护骑士")),
  );
  await page.setViewport({ width: 1280, height: 720 });
  await wait(250);
  await page.screenshot({ path: "docs/screenshots/v3.1/03-720p-controls.png" });
  check(
    "commands fit 720p",
    await page.$eval(".command-footer", (e) => {
      const r = e.getBoundingClientRect();
      return r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1;
    }),
  );
  check("no browser errors", errors.length === 0, errors);
} catch (e) {
  errors.push(String(e));
  throw e;
} finally {
  writeFileSync(
    "docs/v3.1/ORDERS_BROWSER_RESULTS.json",
    JSON.stringify(
      {
        date: new Date().toISOString(),
        results,
        errors,
        pass: results.length === 9 && results.every((r) => r.ok) && !errors.length,
      },
      null,
      2,
    ),
  );
  await browser.close();
}
if (results.some((r) => !r.ok) || errors.length) process.exitCode = 1;
