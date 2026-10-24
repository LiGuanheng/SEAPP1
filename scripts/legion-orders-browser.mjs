import puppeteer from "puppeteer-core";
import { mkdirSync, writeFileSync } from "node:fs";
const url = process.argv[2] ?? "http://127.0.0.1:4186/SEAPP1/",
  shots = "docs/screenshots/v4.0/";
mkdirSync(shots, { recursive: true });
const browser = await puppeteer.launch({
    executablePath:
      process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true,
    args: ["--no-sandbox", "--mute-audio"],
    defaultViewport: { width: 1600, height: 1000 },
  }),
  page = await browser.newPage(),
  checks = [],
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const check = (name, ok, evidence) => {
  checks.push({ name, ok, evidence });
  console.log(ok ? "PASS" : "FAIL", name, JSON.stringify(evidence ?? ""));
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const tick = async (n) => {
  await page.evaluate((n) => window.__SIEGE__.battle.advance(n), n);
  await wait(30);
};
const point = (x, y) => page.evaluate((x, y) => window.__SIEGE__.worldToScreen(x, y), x, y);
async function world(x, y, button = "left") {
  const p = await point(x, y);
  await page.mouse.click(p.x, p.y, { button });
}
async function launch(custom = false) {
  await page.goto(url, { waitUntil: "networkidle0" });
  await page.click('[data-action="new"]');
  await page.click('[data-action="next"]');
  await page.click('[data-action="next"]');
  await page.click('[data-action="commander"][data-key="titan"]');
  await page.click('[data-action="next"]');
  if (!custom) await page.click('[data-action="preset"][data-key="breach"]');
  else
    for (let i = 0; i < 2; i++)
      await page.click('[data-action="buy-pre"][data-key="wolf"][data-count="3"]');
  await page.click('[data-action="launch"]');
  await page.click('[data-action="skip-intro"]');
  await page.click('[data-action="overview"]');
}
try {
  await launch();
  check(
    "automatic control and four legion commands are the default",
    (await page.evaluate(
      () => window.__SIEGE__.battle.automatic && window.__SIEGE__.battle.legion.command === "sweep",
    )) && (await page.$$('[data-action="legion"]')).length === 4,
  );
  const stock = await page.evaluate(() => window.__SIEGE__.battle.loadout.inventory.raider);
  await page.click('[data-action="deploy"][data-key="raider"]');
  await world(250, 1200);
  await page.keyboard.press("Escape");
  await tick(3);
  check(
    "one batch deploys exactly twelve raiders and immediately gives them automatic tasks",
    await page.evaluate((s) => {
      const b = window.__SIEGE__.battle,
        a = b.units.filter((u) => u.side === 0 && u.kind === "raider");
      return (
        b.loadout.inventory.raider === s - 12 &&
        a.length === 12 &&
        a.every((u) => u.control === "auto" && u.autoGoal) &&
        a.some((u) => Math.hypot(u.x - 250, u.y - 1200) > 70)
      );
    }, stock),
  );
  for (let i = 0; i < 30; i++) {
    if (await page.evaluate(() => window.__SIEGE__.battle.stats.resourceIncome > 0)) break;
    await tick(1);
  }
  check(
    "raiders earn actual resource income without any target or route command",
    await page.evaluate(() => window.__SIEGE__.battle.stats.resourceIncome > 0),
  );
  await page.click('[data-action="deploy"][data-key="golem"]');
  await world(250, 1800);
  await page.keyboard.press("Escape");
  await tick(1);
  await page.click('[data-action="army-mode"][data-key="field"]');
  await page.click('[data-action="deploy"][data-key="golem"]');
  await world(250, 1000, "right");
  const routeId = await page.evaluate(
    () => window.__SIEGE__.battle.members(window.__SIEGE__.battle.selected)[0].route?.id,
  );
  await page.click('[data-action="legion"][data-key="assault"]');
  await tick(1);
  check(
    "whole-army final assault preserves an independently drawn route",
    await page.evaluate((id) => {
      const b = window.__SIEGE__.battle;
      return b.members(b.selected).every((u) => u.control === "manual" && u.route?.id === id);
    }, routeId),
  );
  await page.select("#legion-scope", "selected");
  await page.click('[data-action="legion"][data-key="loot"]');
  await tick(0.1);
  check(
    "selected command changes only the selected troops",
    await page.evaluate(() => {
      const b = window.__SIEGE__.battle;
      return (
        b.members(b.selected).every((u) => u.control === "auto" && u.tactic === "loot") &&
        b.units.filter((u) => u.side === 0 && u.kind === "raider").every((u) => !u.tactic) &&
        b.legion.command === "assault"
      );
    }),
  );
  await page.click('[data-action="auto-control"]');
  await page.click('[data-action="army-mode"][data-key="stock"]');
  await page.click('[data-action="deploy"][data-key="elf"]');
  await world(250, 900);
  await page.keyboard.press("Escape");
  await tick(2);
  check(
    "manual mode leaves newly deployed units idle",
    await page.evaluate(() => {
      const b = window.__SIEGE__.battle;
      return (
        !b.automatic &&
        b.units
          .filter((u) => u.side === 0 && u.kind === "elf")
          .every((u) => u.control === "idle" && u.order?.type === "hold")
      );
    }),
  );
  await page.click('[data-action="auto-control"]');
  await page.click('[data-action="army-mode"][data-key="field"]');
  await page.click('[data-action="deploy"][data-key="golem"]');
  await world(250, 1000, "right");
  await page.select("#legion-scope", "all");
  await page.click('[data-action="legion"][data-key="sweep"]');
  await tick(1);
  check(
    "re-enabled auto and global sweep still respect a later manual task",
    await page.evaluate(() => {
      const b = window.__SIEGE__.battle;
      return (
        b.automatic &&
        b.members(b.selected).every((u) => u.control === "manual") &&
        b.units.filter((u) => u.side === 0 && u.kind === "elf").every((u) => u.control === "auto")
      );
    }),
  );
  await page.click('[data-action="resume-auto"]');
  check(
    "explicit selected resume releases that task back to AI",
    await page.evaluate(() =>
      window.__SIEGE__.battle
        .members(window.__SIEGE__.battle.selected)
        .every((u) => u.control === "auto" && !u.order),
    ),
  );
  await page.screenshot({ path: shots + "01-legion-controls.png" });
  await page.setViewport({ width: 1280, height: 720 });
  await wait(150);
  check(
    "commands and unit dock fit a 720p screen",
    (await page.$eval(".legion-strip", (e) => {
      const r = e.getBoundingClientRect();
      return r.right <= innerWidth + 1 && r.bottom < innerHeight;
    })) &&
      (await page.$eval(
        ".dock-footer",
        (e) => e.getBoundingClientRect().bottom <= innerHeight + 1,
      )),
  );
  await page.screenshot({ path: shots + "02-720p.png" });
  await page.setViewport({ width: 1600, height: 1000 });
  await launch(true);
  for (const p of [
    [250, 850],
    [3750, 850],
    [1100, 230],
    [1050, 3430],
  ]) {
    await page.click('[data-action="deploy"][data-key="wolf"]');
    await world(...p);
    await page.keyboard.press("Escape");
  }
  await tick(0.6);
  await page.click('[data-action="legion"][data-key="rally"]');
  await world(250, 900);
  check(
    "rally is a real map command rather than a deployment marker",
    await page.evaluate(
      () =>
        window.__SIEGE__.battle.legion.command === "rally" &&
        window.__SIEGE__.battle.legion.muster?.x < 260,
    ),
  );
  for (let i = 0; i < 105; i++) await tick(1);
  const rally = await page.evaluate(() => {
    const b = window.__SIEGE__.battle,
      a = b.units.filter((u) => u.side === 0 && u.kind === "wolf" && u.hp > 0);
    return {
      count: a.length,
      within: a.filter((u) => Math.hypot(u.x - 250, u.y - 900) < 205).length,
      maxDistance: Math.max(...a.map((u) => Math.hypot(u.x - 250, u.y - 900))),
      stats: b.snapshot(),
    };
  });
  check(
    "wolves deployed on four sides actually gather at the safe location",
    rally.count === 48 && rally.within === 48,
    rally,
  );
  await page.click('[data-action="legion"][data-key="rally"]');
  await world(250, 900);
  await page.screenshot({ path: shots + "03-four-front-muster.png" });
  const before = await page.evaluate(() => {
    const b = window.__SIEGE__.battle;
    return { money: b.money, skills: b.stats.skills, spells: b.stats.spells };
  });
  await page.click('[data-action="legion"][data-key="assault"]');
  await tick(5);
  check(
    "final assault resumes the gathered army without spending or casting",
    await page.evaluate((a) => {
      const b = window.__SIEGE__.battle;
      return (
        b.legion.command === "assault" &&
        b.units.some((u) => u.side === 0 && u.autoGoal?.kind === "breach") &&
        b.money >= a.money &&
        b.stats.skills === a.skills &&
        b.stats.spells === a.spells
      );
    }, before),
  );
  check("no browser errors", !errors.length, errors);
} catch (e) {
  errors.push(String(e));
  console.error(e);
} finally {
  writeFileSync(
    "docs/v4.0/ORDERS_BROWSER.json",
    JSON.stringify(
      {
        date: new Date().toISOString(),
        url,
        checks,
        errors,
        pass: checks.length === 13 && checks.every((c) => c.ok) && !errors.length,
      },
      null,
      2,
    ),
  );
  await browser.close();
}
if (checks.length !== 13 || checks.some((c) => !c.ok) || errors.length) process.exitCode = 1;
