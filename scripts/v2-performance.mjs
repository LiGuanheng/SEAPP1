import puppeteer from "puppeteer-core";
import { existsSync, writeFileSync } from "node:fs";
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
const page = await browser.newPage(),
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
try {
  const loaded = Date.now();
  await page.goto(process.argv[2] ?? "http://127.0.0.1:5173/", { waitUntil: "networkidle2" });
  await page.waitForSelector('[data-action="new"]');
  const bootMs = Date.now() - loaded;
  await page.evaluate(() =>
    window.__SIEGE__.startBattle(window.__SIEGE__.preset("easy", "summon", "swarm")),
  );
  await page.click('[data-action="skip-intro"]');
  await page.evaluate(() => {
    const b = window.__SIEGE__.battle;
    b.deployAll(850, 2230);
    for (let i = 0; i < 780; i++) {
      b.advance(1 / 60);
      if (i % 60 === 0)
        b.command(
          b.units.filter((u) => u.side === 0 && u.hp > 0).map((u) => u.id),
          { type: "move", x: 850, y: 2170 },
        );
    }
    window.__SIEGE__.renderer.camera = { x: 1300, y: 1870, zoom: 0.65 };
  });
  await wait(800);
  const sampled = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const start = performance.now();
        let last = start;
        const deltas = [],
          counts = [];
        const frame = (now) => {
          deltas.push(now - last);
          last = now;
          counts.push(window.__SIEGE__.battle.active);
          if (now - start < 10000) requestAnimationFrame(frame);
          else {
            const sorted = [...deltas].sort((a, b) => a - b);
            resolve({
              sampleSeconds: (now - start) / 1000,
              renderedFrames: deltas.length,
              averageFps: (deltas.length * 1000) / (now - start),
              p95FrameMs: sorted[Math.floor(sorted.length * 0.95)],
              minFriendly: Math.min(...counts),
              maxFriendly: Math.max(...counts),
              queued: window.__SIEGE__.battle.queued,
              heapMiB: performance.memory ? performance.memory.usedJSHeapSize / 1048576 : null,
              userAgent: navigator.userAgent,
              logicalCores: navigator.hardwareConcurrency,
              deviceMemoryGiB: navigator.deviceMemory ?? null,
            });
          }
        };
        requestAnimationFrame(frame);
      }),
  );
  await page.keyboard.press("a");
  const selected = await page.evaluate(() => window.__SIEGE__.battle.selected.size);
  await page.screenshot({ path: "docs/screenshots/v2/17-300-units.png" });
  await page.evaluate(() => {
    window.__retiredBattle = window.__SIEGE__.battle;
    window.__retiredTime = window.__retiredBattle.time;
    window.__retiredPaused = window.__retiredBattle.paused;
    window.__SIEGE__.startBattle(window.__SIEGE__.preset("normal", "evolve", "breach"));
  });
  await page.click('[data-action="skip-intro"]');
  await page.keyboard.press("Space");
  await wait(600);
  const lifecycle = await page.evaluate(() => ({
    canvasCount: document.querySelectorAll("canvas").length,
    oldSceneStopped: window.__retiredBattle.time === window.__retiredTime,
    oldListenersReleased: window.__retiredBattle.paused === window.__retiredPaused,
    currentPaused: window.__SIEGE__.battle.paused,
  }));
  await page.evaluate(() => {
    delete window.__retiredBattle;
    delete window.__retiredTime;
    delete window.__retiredPaused;
  });
  const result = {
    date: new Date().toISOString(),
    environment:
      "Real headless Chrome on local Windows host; requestAnimationFrame measured for 10s. No extrapolated FPS.",
    bootMs,
    viewport: { width: 1920, height: 1080 },
    ...sampled,
    selected,
    lifecycle,
    errors,
    pass:
      sampled.minFriendly === 300 &&
      sampled.averageFps >= 30 &&
      selected === 300 &&
      lifecycle.canvasCount === 2 &&
      lifecycle.oldSceneStopped &&
      lifecycle.oldListenersReleased &&
      errors.length === 0,
  };
  writeFileSync("docs/V2_PERFORMANCE_RESULTS.json", JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
  if (!result.pass) process.exitCode = 1;
} finally {
  await browser.close();
}
