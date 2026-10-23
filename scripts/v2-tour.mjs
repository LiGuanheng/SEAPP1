import puppeteer from "puppeteer-core";
import { existsSync, writeFileSync, mkdirSync } from "node:fs";
const executablePath = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
].find(existsSync);
const browser = await puppeteer.launch({
  executablePath,
  headless: true,
  args: ["--no-sandbox", "--mute-audio"],
  defaultViewport: { width: 1920, height: 1080 },
});
const page = await browser.newPage();
const results = [],
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const check = (name, ok, evidence) => {
  results.push({ name, ok, evidence });
  console.log(ok ? "PASS" : "FAIL", name, evidence ?? "");
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const dir = "docs/screenshots/v2";
mkdirSync(dir, { recursive: true });
try {
  await page.goto(process.argv[2] ?? "http://127.0.0.1:5173/", {
    waitUntil: "networkidle2",
  });
  await page.waitForSelector('[data-action="new"]');
  const init = async (strategy) => {
    await page.evaluate(
      (s) => window.__SIEGE__.startBattle(window.__SIEGE__.preset("normal", "evolve", s)),
      strategy,
    );
    await page.click('[data-action="skip-intro"]');
  };
  const clickWorld = async (x, y) => {
    const p = await page.evaluate((x, y) => window.__SIEGE__.worldToScreen(x, y), x, y);
    await page.mouse.click(p.x, p.y);
  };
  await init("breach");
  await page.click('[data-action="deploy"][data-key="titan"]');
  await clickWorld(950, 1890);
  await page.evaluate(() => window.__SIEGE__.battle.advance(2));
  await wait(150);
  await page.click('[data-action="front"]');
  const wall = await page.evaluate(() => {
    const b = window.__SIEGE__.battle,
      u = b.getUnit("titan");
    return b.structures
      .filter((s) => s.hp > 0 && s.weak && Math.hypot(s.x - u.x, s.y - u.y) < 280)
      .sort((a, b) => a.hp - b.hp)[0];
  });
  if (wall) {
    await page.keyboard.press("q");
    await clickWorld(wall.x, wall.y);
    await wait(150);
    check(
      "titan keyboard aimed skill breaks real wall",
      await page.evaluate((id) => window.__SIEGE__.battle.byId.get(id).hp === 0, wall.id),
    );
    await page.screenshot({ path: `${dir}/09-titan-breach.png` });
  } else check("titan has reachable wall", false);
  await page.click('[data-action="overview"]');
  await page.click('[data-action="all-deploy"]');
  await clickWorld(850, 2000);
  let forward = false,
    reinforced = false,
    crystalShot = false;
  for (let i = 0; i < 100; i++) {
    const snap = await page.evaluate(() => {
      const b = window.__SIEGE__.battle;
      if (b.status === "battle") {
        b.advance(0.8);
        for (const c of b.loadout.commanders) {
          const u = b.getUnit(c);
          if (u && b.skillInfo(c).available && c !== "titan") b.cast(c, u.x, u.y);
        }
      }
      return b.snapshot();
    });
    await wait(20);
    if (i === 12) {
      await page.click('[data-action="front"]');
      await page.screenshot({ path: `${dir}/10-army-battle.png` });
    }
    if (!forward && snap.outposts[0].captured) {
      forward = true;
      check("actual battle captured west post", true, snap);
      await page.screenshot({ path: `${dir}/11-forward-captured.png` });
      const bought = await page.evaluate(() => window.__SIEGE__.battle.buy("golem", 1));
      if (bought) {
        await page.click('[data-action="deploy"][data-key="golem"]');
        await clickWorld(850, 1360);
        reinforced = await page.evaluate(() => {
          const b = window.__SIEGE__.battle;
          return (
            b.loadout.inventory.golem === 0 &&
            (b.queue.some((q) => q.kind === "golem" && q.y === 1360) ||
              b.units.some((u) => u.kind === "golem" && Math.abs(u.homeY - 1360) < 50))
          );
        });
        check("new paid reinforcements deployed at captured front", reinforced);
      }
    }
    if (forward && i % 6 === 0)
      await page.evaluate(() => {
        const b = window.__SIEGE__.battle;
        if (b.buy("golem", 1)) b.deploy("golem", 850, 1360, Infinity);
      });
    if (!crystalShot && snap.crystalHp < 4800 && snap.status === "battle") {
      crystalShot = true;
      await page.click('[data-action="crystal"]');
      await page.screenshot({ path: `${dir}/12-crystal-battle.png` });
    }
    if (snap.status !== "battle") break;
  }
  await wait(1800);
  check(
    "ground strategy actual battle wins",
    await page.evaluate(() => window.__SIEGE__.battle.status === "victory"),
    await page.evaluate(() => window.__SIEGE__.battle.snapshot()),
  );
  await page.screenshot({ path: `${dir}/13-victory.png` });
  if (await page.$('[data-action="retry"]')) {
    await page.click('[data-action="retry"]');
    check(
      "retry clears battle time and destruction",
      await page.evaluate(
        () => window.__SIEGE__.battle.time === 0 && window.__SIEGE__.battle.stats.walls === 0,
      ),
    );
  }
  await init("sky");
  await page.click('[data-action="deploy"][data-key="dragon"]');
  await clickWorld(2330, 1890);
  await page.evaluate(() => window.__SIEGE__.battle.advance(1.5));
  await wait(100);
  await page.click('[data-action="front"]');
  const dragon = await page.evaluate(() => {
    const u = window.__SIEGE__.battle.getUnit("dragon");
    return { x: u.x, y: u.y };
  });
  await page.keyboard.press("q");
  await clickWorld(dragon.x, dragon.y - 210);
  await wait(150);
  check(
    "dragon keyboard aimed cone skill",
    await page.evaluate(() => window.__SIEGE__.battle.stats.skills === 1),
  );
  await page.screenshot({ path: `${dir}/14-dragon-breath.png` });
  await init("breach");
  await page.evaluate(() => window.__SIEGE__.battle.advance(600));
  await wait(1800);
  check(
    "timeout defeat is shown",
    await page.evaluate(
      () => window.__SIEGE__.battle.status === "defeat" && window.__SIEGE__.battle.remaining === 0,
    ),
  );
  await page.screenshot({ path: `${dir}/15-defeat.png` });
  await page.click('.result-actions [data-action="menu"]');
  check("return to menu works", !!(await page.$('[data-action="new"]')));
  check("no uncaught browser errors", errors.length === 0, errors);
  writeFileSync(
    "docs/V2_TOUR_RESULTS.json",
    JSON.stringify(
      {
        date: new Date().toISOString(),
        note: "Screenshots are rendered by Chrome from actual simulation. Long battle segments use deterministic fast-forward through the same simulation; titan/dragon skills use keyboard and mouse.",
        results,
        errors,
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
if (results.some((r) => !r.ok)) process.exitCode = 1;
