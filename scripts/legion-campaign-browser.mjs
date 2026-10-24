import puppeteer from "puppeteer-core";
import { writeFileSync, mkdirSync } from "node:fs";
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
  errors = [],
  history = [];
page.on("pageerror", (e) => errors.push(e.message));
const check = (name, ok, evidence) => {
  checks.push({ name, ok, evidence });
  console.log(ok ? "PASS" : "FAIL", name, JSON.stringify(evidence ?? ""));
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const snap = () => page.evaluate(() => window.__SIEGE__.battle.snapshot());
async function world(x, y) {
  let p = await page.evaluate((x, y) => window.__SIEGE__.worldToScreen(x, y), x, y);
  const visible = await page.$eval(
    "#battle-canvas",
    (e, p) => {
      const r = e.getBoundingClientRect();
      return p.x > r.x + 10 && p.x < r.right - 10 && p.y > r.y + 10 && p.y < r.bottom - 10;
    },
    p,
  );
  if (!visible) {
    const r = await page.$eval("#minimap", (e) => {
      const r = e.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height };
    });
    await page.mouse.click(r.x + (r.w * x) / 4000, r.y + (r.h * y) / 3600);
    p = await page.evaluate((x, y) => window.__SIEGE__.worldToScreen(x, y), x, y);
  }
  await page.mouse.click(p.x, p.y);
}
function plan() {
  const b = window.__SIEGE__.battle,
    a = b.units.filter((u) => u.side === 0 && u.hp > 0),
    e = b.units.filter((u) => u.side === 1 && u.hp > 0),
    cast = [];
  const d = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  for (const k of ["titan", "forest", "web", "king"]) {
    const u = b.getUnit(k);
    if (!u || !b.skillInfo(k).available) continue;
    let t;
    if (k === "titan")
      t = b.structures.find(
        (s) =>
          s.hp > 0 &&
          ["wall", "gate"].includes(s.kind) &&
          d(u, s) < 270 &&
          b.nav.clear(u, s, u.id, s.id),
      );
    else if (k === "forest")
      t = a
        .filter((v) => v.hp / v.maxHp < 0.6 && d(u, v) < 400)
        .sort((a, c) => a.hp / a.maxHp - c.hp / c.maxHp)[0];
    else if (k === "web") t = e.find((v) => d(u, v) < 400 && b.nav.clear(u, v, u.id, v.id));
    else if (a.filter((v) => d(u, v) < 180).length > 8) t = u;
    if (t) cast.push({ kind: k, x: t.x, y: t.y });
  }
  return {
    snapshot: b.snapshot(),
    cast,
    post: b.outposts.find((p) => p.front === "west"),
    goals: Object.fromEntries(
      [...new Set(a.map((u) => u.autoGoal?.label))].map((k) => [
        k,
        a.filter((u) => u.autoGoal?.label === k).length,
      ]),
    ),
  };
}
let purchases = 0,
  casts = 0,
  forward = 0,
  rallied = false,
  assault = false,
  frontShot = false,
  coreShot = false,
  result;
try {
  await page.goto(url, { waitUntil: "networkidle0" });
  await page.click('[data-action="new"]');
  await page.click('[data-action="next"]');
  await page.click('[data-action="next"]');
  await page.click('[data-action="commander"][data-key="titan"]');
  await page.click('[data-action="next"]');
  await page.click('[data-action="preset"][data-key="breach"]');
  await page.screenshot({ path: shots + "04-preparation.png" });
  await page.click('[data-action="launch"]');
  await page.click('[data-action="skip-intro"]');
  await page.click('[data-action="overview"]');
  for (const p of [
    [250, 1200],
    [250, 2400],
  ]) {
    await page.click('[data-action="deploy"][data-key="raider"]');
    await world(...p);
    await page.keyboard.press("Escape");
  }
  await page.click('[data-action="all-deploy"]');
  await world(250, 1800);
  const initial = await snap();
  for (let i = 0; i < 300; i++) {
    const info = await page.evaluate(plan),
      s = info.snapshot;
    if (s.status !== "battle") break;
    history.push({
      time: s.time,
      stats: s.stats,
      automatic: s.automation,
      goals: info.goals,
      core: s.crystalHp,
    });
    const kinds = ["golem", "elf", "treant", "lizard"];
    for (let j = 0; j < 4; j++) {
      const k = kinds[(purchases + j) % 4],
        can = await page.$eval(`[data-action="buy"][data-key="${k}"]`, (e) => !e.disabled);
      if (!can) continue;
      await page.click(`[data-action="buy"][data-key="${k}"]`);
      const dest =
        info.post.captured && info.post.connected && !info.post.contested
          ? info.post
          : { x: 250, y: 1800 };
      await page.click('[data-action="rally"]');
      await world(dest.x, dest.y);
      await page.click(`[data-action="quick-deploy"][data-key="${k}"]`);
      purchases++;
      if (dest === info.post) forward++;
      break;
    }
    if (casts < 8 && info.cast.length) {
      const c = info.cast[0],
        before = s.stats.skills;
      await page.click(`[data-action="skill"][data-key="${c.kind}"]`);
      await world(c.x, c.y);
      if ((await snap()).stats.skills > before) casts++;
      else await page.keyboard.press("Escape");
    }
    if (!frontShot && info.post.captured) {
      await page.click('[data-action="direction"][data-key="west"]');
      await page.screenshot({ path: shots + "05-auto-frontline.png" });
      frontShot = true;
    }
    if (!rallied && s.time > 45 && s.crystalHp === 5600) {
      await page.click('[data-action="legion"][data-key="rally"]');
      await world(250, 900);
      rallied = true;
    }
    if (rallied && !assault && s.time > 65) {
      await page.screenshot({ path: shots + "06-reinforcement-muster.png" });
      await page.click('[data-action="legion"][data-key="assault"]');
      assault = true;
    }
    if (!coreShot && s.stats.towerShots.core > 0) {
      await page.click('[data-action="crystal"]');
      await page.screenshot({ path: shots + "07-auto-final-assault.png" });
      coreShot = true;
    }
    await page.evaluate(() => window.__SIEGE__.battle.advance(2));
    await wait(25);
  }
  result = await snap();
  check(
    "automatic army captured a genuine front and looted actual resources",
    frontShot && result.stats.resourceIncome > 0,
    { income: result.stats.resourceIncome, post: result.outposts.find((p) => p.front === "west") },
  );
  check(
    "player purchased and deployed reinforcements without issuing routes or focus targets",
    purchases >= 5 && forward > 0,
    { purchases, forward, casts },
  );
  check("player explicitly requested safe regroup and final assault", rallied && assault);
  check(
    "normal low-input campaign genuinely wins",
    result.status === "victory" && result.crystalHp === 0,
    { status: result.status, time: result.time, stats: result.stats },
  );
  check(
    "manual task count stayed zero throughout automatic combat",
    history.every((h) => h.automatic.manual === 0),
  );
  check(
    "active skills stayed within the finite player budget",
    result.stats.skills === casts && casts <= 8 && result.stats.spells === 0,
    { casts, skills: result.stats.skills, spells: result.stats.spells },
  );
  if (result.status === "victory") {
    await page.waitForSelector('[data-action="retry"]');
    await page.screenshot({ path: shots + "08-victory.png" });
    await page.click('[data-action="retry"]');
    await page.click('[data-action="skip-intro"]');
    check(
      "victory retry restores default automatic sweep and clean inventory accounting",
      await page.evaluate(() => {
        const b = window.__SIEGE__.battle;
        return (
          b.automatic &&
          b.legion.command === "sweep" &&
          b.stats.deployed === 0 &&
          b.crystal.hp === 5600
        );
      }),
    );
    await page.evaluate(() => window.__SIEGE__.battle.advance(901));
    await page.waitForSelector('[data-action="retry"]');
    check("real timeout defeat remains available", (await snap()).status === "defeat");
    await page.screenshot({ path: shots + "09-defeat.png" });
    await page.click('[data-action="retry"]');
    await page.click('[data-action="skip-intro"]');
    check(
      "defeat retry resets commander and legion state",
      await page.evaluate(() => {
        const b = window.__SIEGE__.battle;
        return (
          b.legion.command === "sweep" && b.legion.muster === null && b.time < 3 && b.mana === 100
        );
      }),
    );
  } else await page.screenshot({ path: shots + "debug-campaign.png" });
  check("no browser errors", !errors.length, errors);
  void initial;
} catch (e) {
  errors.push(String(e));
  console.error(e);
} finally {
  writeFileSync(
    "docs/v4.0/CAMPAIGN_BROWSER.json",
    JSON.stringify(
      {
        date: new Date().toISOString(),
        url,
        checks,
        errors,
        result,
        history,
        purchases,
        casts,
        forward,
        pass: checks.length === 10 && checks.every((c) => c.ok) && !errors.length,
      },
      null,
      2,
    ),
  );
  await browser.close();
}
if (checks.length !== 10 || checks.some((c) => !c.ok) || errors.length) process.exitCode = 1;
