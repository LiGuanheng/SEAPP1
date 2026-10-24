import puppeteer from "puppeteer-core";
import { writeFileSync, mkdirSync } from "node:fs";
import { battlePlan } from "./v3-ui-plan.mjs";
const browser = await puppeteer.launch({
  executablePath:
    process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
  args: ["--no-sandbox", "--mute-audio"],
  defaultViewport: { width: 1600, height: 1000 },
});
const page = await browser.newPage(),
  errors = [],
  checks = [],
  shots = "docs/screenshots/v3.1/";
mkdirSync(shots, { recursive: true });
page.on("pageerror", (e) => errors.push(e.message));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const check = (name, ok, evidence) => {
  checks.push({ name, ok, evidence });
  console.log(ok ? "PASS" : "FAIL", name, JSON.stringify(evidence ?? ""));
};
const snapshot = () => page.evaluate(() => window.__SIEGE__.battle.snapshot());
const tick = async (n) => {
  await page.evaluate((n) => window.__SIEGE__.battle.advance(n), n);
  await wait(25);
};
async function world(x, y, button = "left") {
  const p = await page.evaluate((x, y) => window.__SIEGE__.worldToScreen(x, y), x, y);
  await page.mouse.click(p.x, p.y, { button });
}
async function route(points) {
  for (const [i, p] of points.entries()) {
    if (i) await page.keyboard.down("Shift");
    await world(...p, "right");
    if (i) await page.keyboard.up("Shift");
  }
}
async function launch(difficulty = "normal") {
  await page.click('[data-action="new"]');
  await page.click(`[data-action="difficulty"][data-key="${difficulty}"]`);
  await page.click('[data-action="next"]');
  await page.click('[data-action="next"]');
  await page.click('[data-action="commander"][data-key="titan"]');
  await page.click('[data-action="next"]');
  await page.click('[data-action="preset"][data-key="breach"]');
  await page.click('[data-action="launch"]');
  await page.click('[data-action="skip-intro"]');
  await page.click('[data-action="overview"]');
}
async function groupBox(x, y, key) {
  const r = await page.evaluate(
    (x, y) => [
      window.__SIEGE__.worldToScreen(x - 115, y - 115),
      window.__SIEGE__.worldToScreen(x + 115, y + 115),
    ],
    x,
    y,
  );
  await page.mouse.move(r[0].x, r[0].y);
  await page.mouse.down();
  await page.mouse.move(r[1].x, r[1].y, { steps: 5 });
  await page.mouse.up();
  await page.keyboard.down("Control");
  await page.keyboard.press(key);
  await page.keyboard.up("Control");
}
async function activeSkills() {
  const plan = await page.evaluate(battlePlan);
  // The planner reads game state only. All skills go through the actual buttons and canvas.
  for (const a of plan.actions) {
    const selector = `[data-action="${a.type}"][data-key="${a.kind}"]`;
    if (await page.$eval(selector, (e) => e.disabled)) continue;
    await page.click(selector);
    await world(a.x, a.y);
  }
}
let result;
try {
  await page.goto(process.argv[2] ?? "http://127.0.0.1:5186/", { waitUntil: "networkidle0" });
  await page.screenshot({ path: shots + "04-menu.png" });
  await launch();
  await page.select("#deploy-batch", "1");
  await page.click('[data-action="deploy"][data-key="raider"]');
  await world(250, 1250);
  await page.keyboard.press("Escape");
  await tick(0.6);
  await groupBox(250, 1250, "1");
  await route([[410, 1200]]);
  await page.click('[data-action="army-mode"][data-key="stock"]');
  await page.click('[data-action="deploy"][data-key="raider"]');
  await world(250, 2350);
  await page.keyboard.press("Escape");
  await tick(0.6);
  await groupBox(250, 2350, "2");
  await route([[440, 2400]]);
  await page.click('[data-action="all-deploy"]');
  await world(250, 1800);
  await tick(2.5);
  const before = await snapshot();
  for (let i = 0; i < 25 && (await snapshot()).stats.lootSites < 2; i++) await tick(1);
  const raid = await snapshot();
  check(
    "two physical outer raids award real spendable money",
    raid.stats.lootSites >= 2 && raid.money > before.money,
    raid,
  );
  await page.screenshot({ path: shots + "05-outer-raiding.png" });
  // Select a saved scout group and move along a clean outer corridor, then verify arrival.
  await page.keyboard.press("1");
  await route([
    [250, 1200],
    [250, 950],
  ]);
  for (let i = 0; i < 25; i++) await tick(0.5);
  check(
    "UI route reaches destination and returns to waiting",
    await page.evaluate(() => {
      const b = window.__SIEGE__.battle,
        a = b.members(b.selected);
      return a.length > 0 && a.every((u) => u.order?.type === "hold" && u.y < 1080);
    }),
  );
  // A second raid stage, using both flanks and existing control groups.
  await page.keyboard.press("1");
  await route([
    [250, 200],
    [1400, 200],
    [1400, 420],
  ]);
  await page.keyboard.press("2");
  await route([
    [440, 3450],
    [1500, 3450],
    [1500, 3230],
  ]);
  for (let i = 0; i < 60 && (await snapshot()).stats.lootSites < 4; i++) await tick(1);
  await page.keyboard.press("1");
  await route([
    [1400, 150],
    [2750, 150],
    [2750, 400],
  ]);
  await page.keyboard.press("2");
  await route([
    [1500, 3450],
    [2580, 3450],
    [2580, 3200],
  ]);
  for (let i = 0; i < 75 && (await snapshot()).stats.lootSites < 6; i++) await tick(1);
  await page.click('[data-action="army-mode"][data-key="stock"]');
  let purchases = 0;
  const forwardPurchases = [];
  const buying = ["golem", "elf", "treant", "elf"];
  async function buy() {
    const m = (await snapshot()).money,
      k = buying[purchases % buying.length];
    if (m < 150) return;
    const previousMaxId = await page.evaluate(() =>
      Math.max(0, ...window.__SIEGE__.battle.units.filter((u) => u.side === 0).map((u) => u.id)),
    );
    await page.click(`[data-action="buy"][data-key="${k}"]`);
    purchases++;
    const post = await page.evaluate(() =>
      window.__SIEGE__.battle.outposts.find((p) => p.front === "west"),
    );
    await page.click('[data-action="all-deploy"]');
    await world(post.captured && !post.contested && post.connected ? 950 : 250, 1800);
    if (post.captured && !post.contested && post.connected) {
      const evidence = await page.evaluate((last) => {
        const b = window.__SIEGE__.battle;
        return {
          newAtFront: b.units.filter(
            (u) => u.side === 0 && u.id > last && Math.hypot(u.x - 950, u.y - 1800) < 160,
          ).length,
          queuedAtFront: b.queue
            .filter((q) => Math.hypot(q.x - 950, q.y - 1800) < 160)
            .reduce((n, q) => n + q.count, 0),
        };
      }, previousMaxId);
      if (evidence.newAtFront + evidence.queuedAtFront > 0) forwardPurchases.push(evidence);
    }
  }
  for (let i = 0; i < 8; i++) {
    await buy();
    await tick(0.4);
  }
  const mainPath = [
    [850, 1900],
    [880, 2250],
    [950, 1800],
  ];
  await page.keyboard.press("a");
  await page.select("#target-priority", "resources");
  await route(mainPath);
  let stage = 0,
    lastOrder = -10,
    guardianShot = false,
    combatShot = false;
  const history = [];
  for (let i = 0; i < 200; i++) {
    const state = await snapshot();
    if (state.status !== "battle") break;
    await buy();
    await activeSkills();
    const intel = await page.evaluate(() => {
      const b = window.__SIEGE__.battle,
        at = (kind, x, y) => b.structures.find((s) => s.kind === kind && s.x === x && s.y === y);
      return {
        post: b.outposts.find((p) => p.front === "west"),
        targets: [
          at("arrow", 710, 1730),
          at("cannon", 1450, 2250),
          at("holy", 1400, 1320),
          at("gate", 1600, 1800),
          b.units.find((u) => u.kind === "captain"),
          b.crystal,
        ].map((t) => ({ id: t.id, x: t.x, y: t.y, hp: t.hp })),
        bursts: b.stats.guardianBursts,
      };
    });
    if (stage === 0 && intel.post.captured) {
      stage = 1;
      await page.screenshot({ path: shots + "06-forward-reinforcement.png" });
      check("frontline capture permits paid reinforcement", intel.post.connected && purchases > 0, {
        post: intel.post,
        purchases,
      });
    }
    while (stage > 0 && stage <= 6 && intel.targets[stage - 1].hp <= 0) {
      stage++;
      lastOrder = -10;
    }
    if (stage > 0 && stage <= 6 && state.time - lastOrder > 4) {
      await page.keyboard.press("a");
      await page.select("#target-priority", "ranged");
      const t = intel.targets[stage - 1];
      await world(t.x, t.y, "right");
      lastOrder = state.time;
    }
    if (stage >= 4 && !combatShot) {
      await page.click('[data-action="crystal"]');
      await page.screenshot({ path: shots + "07-inner-assault.png" });
      await page.click('[data-action="overview"]');
      combatShot = true;
    }
    if (intel.bursts && !guardianShot) {
      await page.click('[data-action="guardian"]');
      await page.screenshot({ path: shots + "08-guardian-fight.png" });
      await page.click('[data-action="overview"]');
      guardianShot = true;
    }
    await tick(2);
    history.push({ stage, ...(await snapshot()) });
  }
  result = { ...(await snapshot()), purchases, forwardPurchases, history };
  check(
    "newly purchased units actually enter at captured front",
    forwardPurchases.length > 0,
    forwardPurchases,
  );
  check(
    "paid reinforcements were actually deployed",
    result.stats.deployed > before.stats.deployed && purchases >= 5,
    { deployed: result.stats.deployed, purchases },
  );
  check(
    "normal campaign reaches genuine crystal victory",
    result.status === "victory" && result.crystalHp === 0,
    {
      status: result.status,
      time: result.time,
      crystalHp: result.crystalHp,
      purchases,
      stats: result.stats,
    },
  );
  if (result.status === "victory") await page.waitForSelector('[data-action="retry"]');
  await page.screenshot({
    path: shots + (result.status === "victory" ? "09-victory.png" : "debug-campaign.png"),
  });
  if (result.status === "victory") {
    await page.click('[data-action="retry"]');
    await page.click('[data-action="skip-intro"]');
    const fresh = await snapshot();
    check(
      "victory retry starts a fresh battle",
      fresh.status === "battle" && fresh.crystalHp === 5600 && fresh.stats.deployed === 0,
      fresh,
    );
    await page.click('[data-action="speed"]');
    await page.evaluate(() => window.__SIEGE__.battle.advance(901));
    await page.waitForSelector('[data-action="retry"]');
    check("timeout produces genuine defeat", (await snapshot()).status === "defeat");
    await page.screenshot({ path: shots + "10-defeat.png" });
    await page.click('[data-action="retry"]');
    await page.click('[data-action="skip-intro"]');
    check(
      "defeat retry resets the clock and mana",
      await page.evaluate(() => {
        const b = window.__SIEGE__.battle;
        return b.time < 3 && b.mana === 100 && b.stats.kills === 0;
      }),
    );
  }
  check("no browser errors", !errors.length, errors);
} catch (e) {
  errors.push(String(e));
  console.error(e);
} finally {
  writeFileSync(
    "docs/v3.1/TACTICAL_BROWSER_RESULTS.json",
    JSON.stringify(
      {
        date: new Date().toISOString(),
        checks,
        errors,
        result,
        pass: checks.length >= 10 && checks.every((c) => c.ok) && !errors.length,
      },
      null,
      2,
    ),
  );
  await browser.close();
}
if (errors.length || checks.some((c) => !c.ok) || checks.length < 10) process.exitCode = 1;
