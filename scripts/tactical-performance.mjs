import puppeteer from "puppeteer-core";
import { existsSync, writeFileSync, mkdirSync } from "node:fs";
import os from "node:os";
const executablePath =
  process.env.CHROME_PATH ||
  [
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  ].find(existsSync);
const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: [
      "--no-sandbox",
      "--mute-audio",
      "--enable-precise-memory-info",
      "--disable-background-timer-throttling",
    ],
    defaultViewport: { width: 1920, height: 1080 },
  }),
  page = await browser.newPage(),
  errors = [];
const result = {
  date: new Date().toISOString(),
  url: process.argv[2],
  machine: {
    platform: os.platform(),
    logicalCores: os.cpus().length,
    totalRamGiB: os.totalmem() / 1024 ** 3,
  },
  errors,
  pass: false,
};
page.on("pageerror", (e) => errors.push(e.message));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const point = (x, y) => page.evaluate((x, y) => window.__SIEGE__.worldToScreen(x, y), x, y);
async function sample(seconds) {
  return page.evaluate(
    (seconds) =>
      new Promise((resolve) => {
        const b = window.__SIEGE__.battle,
          start = performance.now(),
          intervals = [],
          counts = [],
          queued = [],
          deployed = b.stats.deployed,
          lost = b.stats.lost,
          kills = b.stats.kills;
        let last = start;
        const tick = (now) => {
          intervals.push(now - last);
          last = now;
          counts.push(b.active);
          queued.push(b.queued);
          if (now - start >= seconds * 1000) {
            const sorted = [...intervals].sort((a, b) => a - b);
            resolve({
              seconds: (now - start) / 1000,
              frames: intervals.length,
              averageFps: (intervals.length * 1000) / (now - start),
              p95FrameMs: sorted[Math.floor(sorted.length * 0.95)],
              longFramesOver50ms: intervals.filter((n) => n > 50).length,
              minFriendly: Math.min(...counts),
              maxFriendly: Math.max(...counts),
              queuedStart: queued[0],
              queuedEnd: queued.at(-1),
              deployed: b.stats.deployed - deployed,
              lost: b.stats.lost - lost,
              kills: b.stats.kills - kills,
            });
          } else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
    seconds,
  );
}
mkdirSync("docs/screenshots/v3.1", { recursive: true });
try {
  await page.goto(process.argv[2] ?? "http://127.0.0.1:5186/", { waitUntil: "networkidle0" });
  await page.waitForSelector('[data-action="new"]');
  await page.click('[data-action="new"]');
  await page.click('[data-action="next"]');
  await page.click('[data-action="next"]');
  await page.click('[data-action="commander"][data-key="titan"]');
  await page.click('[data-action="next"]');
  await page.click('[data-action="preset"][data-key="swarm"]');
  await page.click('[data-action="launch"]');
  await page.click('[data-action="skip-intro"]');
  await page.click('[data-action="all-deploy"]');
  const p = await point(1050, 3430);
  await page.mouse.click(p.x, p.y);
  await page.waitForFunction(() => window.__SIEGE__.battle.active === 300, { timeout: 10000 });
  await page.keyboard.press("a");
  const hold = await point(1060, 3410);
  await page.mouse.click(hold.x, hold.y, { button: "right" });
  await wait(4000);
  result.selected = await page.evaluate(() => window.__SIEGE__.battle.selected.size);
  result.stable = await sample(10);
  result.jsHeapMiB = (await page.metrics()).JSHeapUsedSize / 1024 ** 2;
  result.browser = await page.evaluate(() => navigator.userAgent);
  await page.screenshot({ path: "docs/screenshots/v3.1/11-stable-300.png" });
  await page.click('[data-action="charge"]');
  result.attackWarmupSimulationSeconds = await page.evaluate(() => {
    const b = window.__SIEGE__.battle,
      t = b.time;
    while (b.status === "battle" && b.time - t < 45 && b.stats.lost < 8 && b.stats.kills < 8)
      b.advance(2);
    return b.time - t;
  });
  await page.click('[data-action="front"]');
  result.attack = await sample(10);
  await page.screenshot({ path: "docs/screenshots/v3.1/12-mass-attack.png" });
  await page.evaluate(() => {
    window.__retired = window.__SIEGE__.battle;
  });
  await page.click('[data-action="menu"]');
  await page.evaluate(() => {
    window.__retiredTime = window.__retired.time;
  });
  await wait(400);
  result.lifecycle = await page.evaluate(() => ({
    canvases: document.querySelectorAll("canvas").length,
    retiredStopped: window.__retired.time === window.__retiredTime,
  }));
  result.pass =
    result.stable.minFriendly === 300 &&
    result.stable.maxFriendly === 300 &&
    result.stable.averageFps >= 30 &&
    result.attack.averageFps >= 30 &&
    (result.attack.lost > 0 || result.attack.kills > 0) &&
    result.selected === 300 &&
    result.lifecycle.canvases === 0 &&
    result.lifecycle.retiredStopped &&
    errors.length === 0;
} catch (e) {
  errors.push(String(e));
  throw e;
} finally {
  writeFileSync("docs/v3.1/PERFORMANCE_RESULTS.json", JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
  await browser.close();
}
if (!result.pass) process.exitCode = 1;
