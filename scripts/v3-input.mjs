import puppeteer from "puppeteer-core";
import { existsSync, writeFileSync, mkdirSync } from "node:fs";
const executablePath =
  process.env.CHROME_PATH ||
  [
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  ].find(existsSync);
const browser = await puppeteer.launch({
  executablePath,
  headless: true,
  args: ["--no-sandbox", "--mute-audio"],
  defaultViewport: { width: 1600, height: 1000 },
});
const page = await browser.newPage(),
  results = [],
  errors = [];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const check = (name, ok, evidence) => {
  results.push({ name, ok, evidence });
  console.log(ok ? "PASS" : "FAIL", name, JSON.stringify(evidence ?? ""));
};
const point = (x, y) => page.evaluate((x, y) => window.__SIEGE__.worldToScreen(x, y), x, y);
const clickWorld = async (x, y) => {
  const p = await point(x, y);
  await page.mouse.click(p.x, p.y);
};
const pan = async (x, y) => {
  const r = await page.$eval("#minimap", (e) => {
    const r = e.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  });
  await page.mouse.click(r.x + (r.w * x) / 4000, r.y + (r.h * y) / 3600);
};
const stock = (k) => page.evaluate((k) => window.__SIEGE__.battle.loadout.inventory[k], k);
page.on("pageerror", (e) => errors.push(e.message));
page.on("response", (r) => {
  if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`);
});
mkdirSync("docs/screenshots/v3", { recursive: true });
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
  check(
    "default bulk mode is three batches",
    (await page.$eval("#deploy-batch", (e) => e.value)) === "3",
  );
  const m = await page.evaluate(() => window.__SIEGE__.battle.money),
    s = await stock("slime");
  await page.select("#buy-batch", "3");
  await page.click('[data-action="buy"][data-key="slime"]');
  check("purchase clamps to affordable batches exactly once", (await stock("slime")) === s + 40, {
    moneyBefore: m,
    moneyAfter: await page.evaluate(() => window.__SIEGE__.battle.money),
  });
  await page.select("#deploy-batch", "1");
  await page.click('[data-action="direction"][data-key="west"]');
  await page.click('[data-action="deploy"][data-key="goblin"]');
  const good = await point(250, 2000),
    g = await stock("goblin");
  await page.mouse.move(good.x, good.y);
  await page.mouse.down();
  await wait(1050);
  await page.screenshot({ path: "docs/screenshots/v3/02-hold-deploy.png" });
  await page.mouse.up();
  const held = await stock("goblin");
  await wait(450);
  check("real mouse hold commits more than one batch", g - held === 60, { before: g, after: held });
  check("release stops the stream", (await stock("goblin")) === held);
  check(
    "mode stays selected after deployment",
    await page.evaluate(() => window.__SIEGE__.renderer.mode.type === "deploy"),
  );
  await page.keyboard.press("Escape");
  await page.click('[data-action="deploy"][data-key="slime"]');
  await clickWorld(250, 2000);
  await clickWorld(280, 2000);
  check(
    "two ordinary clicks repeat without selecting card again",
    (await stock("slime")) === s + 40 - 80,
  );
  await page.keyboard.press("Escape");
  await page.click('[data-action="rally"]');
  await clickWorld(250, 1600);
  const ra = await stock("raider");
  await page.click('[data-action="quick-deploy"][data-key="raider"]');
  check(
    "one-click deploy uses the configured rally point",
    (await stock("raider")) === ra - 12,
    await page.evaluate(() => window.__SIEGE__.renderer.rally),
  );
  await page.keyboard.down("Shift");
  await page.click('[data-action="quick-deploy"][data-key="raider"]');
  await page.keyboard.up("Shift");
  check("Shift commits all remaining stock once", (await stock("raider")) === 0);
  await page.click('[data-action="overview"]');
  await page.click('[data-action="deploy"][data-key="lizard"]');
  const before = await stock("lizard");
  await clickWorld(2000, 1800);
  check("illegal core click consumes no inventory", (await stock("lizard")) === before);
  await page.keyboard.press("Escape");
  for (const [front, k] of [
    ["north", "lizard"],
    ["east", "elf"],
    ["south", "slime"],
  ]) {
    await page.click(`[data-action="direction"][data-key="${front}"]`);
    await page.click(`[data-action="quick-deploy"][data-key="${k}"]`);
  }
  await wait(1600);
  const fronts = await page.evaluate(() => [
    ...new Set(window.__SIEGE__.battle.units.filter((u) => u.side === 0).map((u) => u.front)),
  ]);
  check("real deployed units appear at all four fronts", fronts.length === 4, fronts);
  await page.click('[data-action="direction"][data-key="north"]');
  await page.click('[data-action="pause"]');
  await page.setDragInterception(true);
  const source = await page.$('[data-action="deploy"][data-key="titan"]'),
    rect = await source.boundingBox();
  const drop = await point(2000, 230);
  await page.mouse.dragAndDrop({ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }, drop, {
    delay: 200,
  });
  await page.setDragInterception(false);
  check(
    "native hero drag still deploys",
    await page.evaluate(
      () =>
        !window.__SIEGE__.battle.heroInventory.has("titan") &&
        window.__SIEGE__.battle.queue.some((q) => q.kind === "titan"),
    ),
  );
  const paused = await page.evaluate(() => window.__SIEGE__.battle.time);
  await wait(250);
  check(
    "pause freezes actual time",
    await page.evaluate((t) => window.__SIEGE__.battle.time === t, paused),
  );
  await page.click('[data-action="pause"]');
  await wait(800);
  for (const [key, spell] of [
    ["z", "rage"],
    ["x", "heal"],
    ["c", "barrier"],
  ]) {
    const p = await page.evaluate(() => {
      const b = window.__SIEGE__.battle,
        u = b.getUnit("titan") ?? b.units.find((u) => u.side === 0 && u.hp > 0);
      return { x: u.x, y: u.y };
    });
    await pan(p.x, p.y);
    await page.keyboard.press(key);
    await clickWorld(p.x, p.y);
    check(
      `${spell} keyboard + real target casts`,
      await page.evaluate((k) => window.__SIEGE__.battle.spellReadyAt.has(k), spell),
    );
  }
  const spells = await page.evaluate(() => window.__SIEGE__.battle.stats.spells);
  await page.keyboard.press("v");
  check(
    "insufficient mana gives feedback without spending",
    await page.evaluate(
      (n) =>
        window.__SIEGE__.battle.stats.spells === n &&
        document.querySelector("#notice").textContent.includes("魔力不足"),
      spells,
    ),
  );
  await page.evaluate(() => window.__SIEGE__.battle.advance(26));
  await wait(100);
  const meteor = await page.evaluate(() => {
    const b = window.__SIEGE__.battle,
      u = b.getUnit("titan") ?? b.units.find((u) => u.side === 0 && u.hp > 0);
    return { x: u.x, y: u.y };
  });
  await pan(meteor.x, meteor.y);
  await page.setDragInterception(true);
  const spellRect = await (await page.$('[data-spell="meteor"]')).boundingBox(),
    target = await point(meteor.x, meteor.y);
  await page.mouse.dragAndDrop(
    { x: spellRect.x + spellRect.width / 2, y: spellRect.y + spellRect.height / 2 },
    target,
    { delay: 200 },
  );
  await page.setDragInterception(false);
  check(
    "native spell drag uses mana and commits meteor",
    await page.evaluate(() => window.__SIEGE__.battle.spellReadyAt.has("meteor")),
  );
  await page.screenshot({ path: "docs/screenshots/v3/03-spells-and-front.png" });
  await page.click('[data-action="overview"]');
  await page.screenshot({ path: "docs/screenshots/v3/04-four-fronts.png" });
  await page.keyboard.press("Escape");
  const bounds = await page.evaluate(() => {
    const us = window.__SIEGE__.battle.units.filter((u) => u.side === 0 && u.hp > 0);
    return {
      x1: Math.min(...us.map((u) => u.x)) - 30,
      y1: Math.min(...us.map((u) => u.y)) - 30,
      x2: Math.max(...us.map((u) => u.x)) + 30,
      y2: Math.max(...us.map((u) => u.y)) + 30,
    };
  });
  const corner1 = await point(bounds.x1, bounds.y1),
    corner2 = await point(bounds.x2, bounds.y2);
  await page.mouse.move(corner1.x, corner1.y);
  await page.mouse.down();
  await page.mouse.move(corner2.x, corner2.y, { steps: 12 });
  await page.mouse.up();
  check(
    "real mouse box selection",
    await page.evaluate(() => window.__SIEGE__.battle.selected.size > 0),
  );
  await page.keyboard.press("a");
  await page.keyboard.down("Control");
  await page.keyboard.press("1");
  await page.keyboard.up("Control");
  await page.keyboard.press("1");
  check(
    "control group saves and recalls living units",
    await page.evaluate(() => {
      const b = window.__SIEGE__.battle;
      return b.selected.size > 0 && b.groups[0].size >= b.selected.size;
    }),
  );
  const move = await point(2000, 3430);
  await page.mouse.click(move.x, move.y, { button: "right" });
  check(
    "right click issues actual movement orders",
    await page.evaluate(() =>
      window.__SIEGE__.battle.units.some((u) => u.side === 0 && u.order?.type === "move"),
    ),
  );
  const tower = await page.evaluate(() => {
    const s = window.__SIEGE__.battle.structures.find((s) => s.kind === "arrow" && s.hp > 0);
    return { id: s.id, x: s.x, y: s.y };
  });
  const focus = await point(tower.x, tower.y - 20);
  await page.mouse.click(focus.x, focus.y, { button: "right" });
  check(
    "visible tower receives explicit focus orders",
    await page.evaluate(
      (id) =>
        window.__SIEGE__.battle.units.some(
          (u) => u.side === 0 && u.order?.type === "attack" && u.order.target === id,
        ),
      tower.id,
    ),
  );
  await page.setViewport({ width: 1280, height: 720 });
  await wait(300);
  await page.screenshot({ path: "docs/screenshots/v3/05-720p-ui.png" });
  check(
    "720p spell and deployment controls stay inside viewport",
    await page.evaluate(() =>
      [".battle-dock", ".spell-row", ".resource-row"].every((s) => {
        const r = document.querySelector(s).getBoundingClientRect();
        return r.x >= 0 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1;
      }),
    ),
  );
  await page.keyboard.press("Escape");
  await page.click('[data-action="help"]');
  check(
    "manual includes new fast-deploy instructions",
    await page.$eval(
      ".manual",
      (e) => e.textContent.includes("长按") && e.textContent.includes("Z/X/C/V"),
    ),
  );
  await page.click('[data-action="close-help"]');
  await page.click('[data-action="menu"]');
  check(
    "menu disposes battle canvas",
    await page.evaluate(() => document.querySelectorAll("canvas").length === 0),
  );
  check("no page or resource errors", errors.length === 0, errors);
} catch (e) {
  errors.push(String(e));
  throw e;
} finally {
  writeFileSync(
    "docs/v3/INPUT_RESULTS.json",
    JSON.stringify(
      {
        date: new Date().toISOString(),
        url: process.argv[2],
        results,
        errors,
        pass: results.length === 25 && results.every((r) => r.ok) && errors.length === 0,
      },
      null,
      2,
    ),
  );
  await browser.close();
}
if (results.length !== 25 || results.some((r) => !r.ok) || errors.length) process.exitCode = 1;
