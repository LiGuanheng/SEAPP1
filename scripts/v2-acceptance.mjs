import puppeteer from "puppeteer-core";
import { existsSync, writeFileSync } from "node:fs";
const executablePath =
  process.env.CHROME_PATH ??
  [
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  ].find(existsSync);
const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ["--no-sandbox", "--mute-audio"],
    defaultViewport: { width: 1440, height: 900 },
  }),
  page = await browser.newPage(),
  results = [],
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const check = (name, ok, evidence) => {
  results.push({ name, ok, evidence });
  console.log(ok ? "PASS" : "FAIL", name, evidence ?? "");
};
const clickWorld = async (x, y) => {
  const p = await page.evaluate((x, y) => window.__SIEGE__.worldToScreen(x, y), x, y);
  await page.mouse.click(p.x, p.y);
};
const init = async (spec, strategy) => {
  await page.evaluate(
    (spec, strategy) =>
      window.__SIEGE__.startBattle(window.__SIEGE__.preset("normal", spec, strategy)),
    spec,
    strategy,
  );
  await page.click('[data-action="skip-intro"]');
  await page.click('[data-action="overview"]');
};
try {
  await page.goto(process.argv[2] ?? "http://127.0.0.1:5173/", { waitUntil: "networkidle2" });
  await page.waitForSelector('[data-action="new"]');
  for (const [hero, strategy] of [
    ["moon", "breach"],
    ["forest", "breach"],
    ["web", "sky"],
    ["emperor", "swarm"],
  ]) {
    await init("evolve", strategy);
    await page.click(`[data-action="deploy"][data-key="${hero}"]`);
    await clickWorld(850, 2070);
    if (hero === "emperor") {
      await page.click('[data-action="deploy"][data-key="slime"]');
      await clickWorld(850, 2070);
    }
    await page.evaluate(() => window.__SIEGE__.battle.advance(1));
    await wait(50);
    const aim = await page.evaluate((k) => {
      const b = window.__SIEGE__.battle,
        u = b.getUnit(k);
      return { x: u.x, y: u.y, key: ["q", "w", "e", "r"][b.loadout.commanders.indexOf(k)] };
    }, hero);
    await page.keyboard.press(aim.key);
    await clickWorld(aim.x, aim.y);
    check(
      `${hero} manual targeted skill`,
      await page.evaluate(() => window.__SIEGE__.battle.stats.skills === 1),
    );
  }
  await init("evolve", "breach");
  await page.click('[data-action="deploy"][data-key="king"]');
  await clickWorld(850, 2070);
  await page.click('[data-action="deploy"][data-key="goblin"]');
  await clickWorld(850, 2070);
  await page.evaluate(() => window.__SIEGE__.battle.advance(1));
  const blessing = await page.evaluate(() => {
    const u = window.__SIEGE__.battle.getUnit("king");
    return { x: u.x, y: u.y };
  });
  await page.keyboard.press("f");
  await clickWorld(blessing.x, blessing.y);
  check(
    "evolution F buffs actual troops",
    await page.evaluate(() =>
      window.__SIEGE__.battle.units.some((u) => u.side === 0 && u.kind !== "king" && u.buff > 0),
    ),
  );
  await init("summon", "swarm");
  await page.click('[data-action="deploy"][data-key="king"]');
  await clickWorld(850, 2130);
  await page.evaluate(() => window.__SIEGE__.battle.advance(0.2));
  await page.keyboard.press("f");
  await clickWorld(850, 2130);
  check(
    "summoner F queues exactly 30 free slimes",
    await page.evaluate(
      () =>
        window.__SIEGE__.battle.queued +
          window.__SIEGE__.battle.units.filter((u) => u.kind === "slime" && u.side === 0).length ===
        30,
    ),
  );
  await init("element", "breach");
  await page.click('[data-action="deploy"][data-key="king"]');
  await clickWorld(1600, 1970);
  await page.evaluate(() => window.__SIEGE__.battle.advance(1));
  const target = await page.evaluate(() =>
    window.__SIEGE__.battle.structures.find(
      (s) => s.kind === "gate" && s.x === 1550 && s.y === 1700,
    ),
  );
  await page.keyboard.press("f");
  await clickWorld(target.x, target.y);
  check(
    "elemental F deals real 140 area damage",
    await page.evaluate(
      (id, hp) => window.__SIEGE__.battle.byId.get(id).hp === hp - 140,
      target.id,
      target.hp,
    ),
  );
  await page.evaluate(() => window.__SIEGE__.menu());
  await page.click('[data-action="new"]');
  await page.click('[data-action="next"]');
  await page.click('[data-action="spec"][data-key="summon"]');
  await page.click('[data-action="next"]');
  await page.click('[data-action="commander"][data-key="emperor"]');
  await page.click('[data-action="next"]');
  await page.click('[data-action="buy-pre"][data-key="slime"][data-count="Infinity"]');
  await page.click('[data-action="launch"]');
  await page.click('[data-action="skip-intro"]');
  await page.click('[data-action="overview"]');
  await page.click('[data-action="all-deploy"]');
  await clickWorld(1600, 2200);
  let snap;
  for (let i = 0; i < 300; i++) {
    snap = await page.evaluate(() => {
      const b = window.__SIEGE__.battle;
      if (b.status === "battle") {
        if (b.buy("slime", Infinity)) b.deploy("slime", 1600, 2200, Infinity);
        b.advance(2);
      }
      return { ...b.snapshot(), reason: b.reason };
    });
    if (snap.status !== "battle") break;
    await wait(5);
  }
  await wait(1700);
  check(
    "natural exhaustion after spending real resources",
    snap.status === "defeat" &&
      snap.reason.includes("力竭") &&
      snap.active === 0 &&
      snap.reserves === 0,
    snap,
  );
  await page.screenshot({ path: "docs/screenshots/v2/18-exhaustion.png" });
  check("no uncaught browser errors", errors.length === 0, errors);
  writeFileSync(
    "docs/V2_ACCEPTANCE_RESULTS.json",
    JSON.stringify(
      {
        date: new Date().toISOString(),
        note: "All skills use actual deployment, keys and map targeting. Exhaustion uses UI-bought pure slime army and spends earned money through the normal ledger, without HP or wallet overrides.",
        results,
        errors,
      },
      null,
      2,
    ),
  );
  if (results.some((r) => !r.ok)) process.exitCode = 1;
} finally {
  await browser.close();
}
