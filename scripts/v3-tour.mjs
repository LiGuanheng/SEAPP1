import puppeteer from "puppeteer-core";
import { existsSync, writeFileSync, mkdirSync } from "node:fs";
import { battlePlan } from "./v3-ui-plan.mjs";
const executablePath =
  process.env.CHROME_PATH ||
  [
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  ].find(existsSync);
const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ["--no-sandbox", "--mute-audio", "--disable-background-timer-throttling"],
    defaultViewport: { width: 1600, height: 1000 },
  }),
  page = await browser.newPage(),
  errors = [],
  results = [],
  campaigns = [];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const check = (name, ok, evidence) => {
  results.push({ name, ok, evidence });
  console.log(ok ? "PASS" : "FAIL", name, JSON.stringify(evidence ?? ""));
};
const pan = async (x, y) => {
  const r = await page.$eval("#minimap", (e) => {
    const r = e.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  });
  await page.mouse.click(r.x + (r.w * x) / 4000, r.y + (r.h * y) / 3600);
};
const world = async (x, y) => {
  const p = await page.evaluate((x, y) => window.__SIEGE__.worldToScreen(x, y), x, y);
  const inside = await page.evaluate((p) => {
    const r = document.querySelector("#battle-canvas").getBoundingClientRect();
    return p.x >= r.x && p.x <= r.right && p.y >= r.y && p.y <= r.bottom;
  }, p);
  if (!inside) throw new Error("world target outside canvas " + JSON.stringify({ x, y, p }));
  await page.mouse.click(p.x, p.y);
};
async function launch(difficulty, strategy) {
  await page.waitForSelector('[data-action="new"]');
  await page.click('[data-action="new"]');
  await page.click(`[data-action="difficulty"][data-key="${difficulty}"]`);
  await page.click('[data-action="next"]');
  if (strategy === "slime") await page.click('[data-action="spec"][data-key="summon"]');
  await page.click('[data-action="next"]');
  await page.click(
    `[data-action="commander"][data-key="${strategy === "slime" ? "emperor" : "titan"}"]`,
  );
  await page.click('[data-action="next"]');
  if (strategy === "slime")
    await page.click('[data-action="buy-pre"][data-key="slime"][data-count="Infinity"]');
  else await page.click(`[data-action="preset"][data-key="${strategy}"]`);
  await page.click('[data-action="launch"]');
  await page.click('[data-action="skip-intro"]');
}
page.on("pageerror", (e) => errors.push(e.message));
page.on("response", (r) => {
  if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`);
});
mkdirSync("docs/screenshots/v3", { recursive: true });
try {
  await page.goto(process.argv[2] ?? "http://127.0.0.1:5186/", { waitUntil: "networkidle0" });
  for (const [difficulty, strategy, front] of [
    ["easy", "breach", "west"],
    ["normal", "breach", "west"],
    ["normal", "breach", "north"],
    ["hard", "breach", "west"],
  ]) {
    await launch(difficulty, strategy);
    await page.click(`[data-action="direction"][data-key="${front}"]`);
    await page.click('[data-action="rally-all"]');
    let inner = false,
      core = false,
      forward = false,
      titan = false,
      loot = false,
      bought = 0,
      loops = 0;
    while (loops++ < 650) {
      await page.evaluate(() => window.__SIEGE__.battle.advance(1.8));
      await wait(160);
      let plan = await page.evaluate(battlePlan);
      if (plan.snapshot.status !== "battle") break;
      for (const a of plan.actions) {
        const available = await page.evaluate(
          (a) =>
            a.type === "skill"
              ? window.__SIEGE__.battle.skillInfo(a.kind).available
              : window.__SIEGE__.battle.spellInfo(a.kind).available,
          a,
        );
        if (!available) continue;
        await pan(a.x, a.y);
        await page.click(`[data-action="${a.type}"][data-key="${a.kind}"]`);
        await world(a.x, a.y);
        if (a.kind === "titan") titan = true;
      }
      const post = plan.snapshot.outposts.find(
          (p) => p.front === front && p.captured && p.connected && !p.contested,
        ),
        destination = post ?? { west: { x: 250, y: 1800 }, north: { x: 2000, y: 230 } }[front];
      if (plan.canBuy) {
        const wanted = ["golem", "elf", "treant", "lizard", "goblin", "raider", "slime"];
        for (const k of wanted) {
          const el = await page.$(`[data-action="buy"][data-key="${k}"]:not(:disabled)`);
          if (!el) continue;
          const before = await page.evaluate(() => window.__SIEGE__.battle.money);
          await el.click();
          const after = await page.evaluate(() => window.__SIEGE__.battle.money);
          if (after < before) bought++;
          await page.click('[data-action="rally"]');
          await pan(destination.x, destination.y);
          await world(destination.x, destination.y);
          await page.click(`[data-action="quick-deploy"][data-key="${k}"]`);
          if (post && after < before) forward = true;
          break;
        }
      }
      if (plan.snapshot.stats.resourceIncome > 0) loot = true;
      if (!inner && plan.snapshot.stats.destroyed.inner > 0) {
        inner = true;
        await pan(1700, 1800);
        if (difficulty === "normal" && front === "west")
          await page.screenshot({ path: "docs/screenshots/v3/06-inner-battle.png" });
      }
      if (!core && plan.snapshot.crystalHp < 5500) {
        core = true;
        await pan(2000, 1800);
        if (difficulty === "normal" && front === "west")
          await page.screenshot({ path: "docs/screenshots/v3/07-crystal-battle.png" });
      }
    }
    const end = await page.evaluate(() => window.__SIEGE__.battle.snapshot());
    campaigns.push({
      difficulty,
      strategy,
      front,
      ...end,
      ui: { titan, loot, forward, bought, inner, core },
    });
    check(
      `${difficulty} ${front} full paid-UI campaign wins`,
      end.status === "victory" && end.crystalHp === 0,
      {
        time: end.time,
        firstCoreHit: end.firstCoreHit,
        walls: end.stats.walls,
        kills: end.stats.kills,
        spells: end.stats.spells,
        bought,
        forward,
      },
    );
    if (difficulty === "normal" && front === "west") {
      check(
        "actual titan wall cast, resource loot and paid forward reinforcements",
        titan && loot && forward,
        { titan, loot, forward, bought },
      );
      check(
        "inner/core defenses actually fired",
        end.stats.towerShots.inner > 0 && end.stats.towerShots.core > 0,
        end.stats.towerShots,
      );
    }
    await page.waitForSelector(".result-overlay", { timeout: 10000 });
    await page.screenshot({
      path: `docs/screenshots/v3/08-${difficulty}-${front}-${end.status}.png`,
    });
    if (difficulty === "easy") {
      await page.click('[data-action="retry"]');
      await page.click('[data-action="skip-intro"]');
      check(
        "retry resets mana, clock, crystal and inventory",
        await page.evaluate(() => {
          const b = window.__SIEGE__.battle;
          return (
            b.mana === 100 &&
            b.time < 1 &&
            b.crystal.hp === 5600 &&
            b.queued === 0 &&
            b.reserves > 0
          );
        }),
      );
    }
    await (
      (await page.$('.result-overlay [data-action="menu"]')) ??
      (await page.$('header [data-action="menu"]'))
    ).click();
  }
  await launch("normal", "slime");
  await page.click('[data-action="rally-all"]');
  let loops = 0;
  while (loops++ < 250) {
    await page.evaluate(() => window.__SIEGE__.battle.advance(5));
    await wait(100);
    const s = await page.evaluate(() => window.__SIEGE__.battle.snapshot());
    if (s.status !== "battle") break;
    const button = await page.$('[data-action="buy"][data-key="slime"]:not(:disabled)');
    if (button) {
      await button.click();
      await page.click('[data-action="quick-deploy"][data-key="slime"]');
    }
  }
  const loss = await page.evaluate(() => ({
    snapshot: window.__SIEGE__.battle.snapshot(),
    reason: window.__SIEGE__.battle.reason,
  }));
  campaigns.push({
    difficulty: "normal",
    strategy: "slime",
    front: "south",
    ...loss.snapshot,
    reason: loss.reason,
  });
  check(
    "basic front rush fails by genuine exhaustion",
    loss.snapshot.status === "defeat" &&
      loss.reason.includes("力竭") &&
      loss.snapshot.crystalHp === 5600,
    loss,
  );
  await page.waitForSelector(".result-overlay");
  await page.screenshot({ path: "docs/screenshots/v3/09-natural-exhaustion.png" });
  await (
    (await page.$('.result-overlay [data-action="menu"]')) ??
    (await page.$('header [data-action="menu"]'))
  ).click();
  await launch("normal", "breach");
  await page.evaluate(() => window.__SIEGE__.battle.advance(901));
  await page.waitForSelector(".result-overlay");
  const timeout = await page.evaluate(() => ({
    remaining: window.__SIEGE__.battle.remaining,
    status: window.__SIEGE__.battle.status,
    reason: window.__SIEGE__.battle.reason,
  }));
  check(
    "real timeout with undeployed reserves loses correctly",
    timeout.status === "defeat" && timeout.remaining === 0 && timeout.reason.includes("充能"),
    timeout,
  );
  await page.screenshot({ path: "docs/screenshots/v3/10-timeout.png" });
  await page.click('[data-action="reconfigure"]');
  check("failure can return to editable loadout", !!(await page.$('[data-action="launch"]')));
  check("no page or resource errors", errors.length === 0, errors);
} catch (e) {
  errors.push(String(e));
  throw e;
} finally {
  writeFileSync(
    "docs/v3/TOUR_RESULTS.json",
    JSON.stringify(
      {
        date: new Date().toISOString(),
        url: process.argv[2],
        method:
          "Actual wizard/presets, money purchases, rally-point deployments and mouse casts. Long combat uses the same fixed-60Hz Battle.advance, no HP/money/victory overrides.",
        results,
        campaigns,
        errors,
        pass:
          campaigns.length === 5 &&
          results.length >= 11 &&
          results.every((r) => r.ok) &&
          errors.length === 0,
      },
      null,
      2,
    ),
  );
  await browser.close();
}
if (campaigns.length !== 5 || results.length !== 11 || results.some((r) => !r.ok) || errors.length)
  process.exitCode = 1;
